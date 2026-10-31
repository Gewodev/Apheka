/** One serialized fullscreen operation for the whole desktop workspace. */
export interface FullscreenPort {
  read(): Promise<boolean>;
  write(active: boolean): Promise<void>;
  focusContent(): Promise<void>;
}
export interface FullscreenState { active: boolean; busy: boolean; error: string | null }

export function createFullscreenController(port: FullscreenPort, beforeChange: () => void = () => {},
  delay: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 50)), timeoutMs = 3000) {
  let state: FullscreenState = { active: false, busy: false, error: null };
  const listeners = new Set<() => void>();
  let operation: Promise<void> | null = null;
  let revision = 0;
  const bounded = <T>(promise:Promise<T>):Promise<T> => new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Fullscreen API timed out')),timeoutMs);
    promise.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
  const publish = (next: Partial<FullscreenState>) => {
    state = { ...state, ...next };
    listeners.forEach(notify => notify());
  };
  const refresh = async () => {
    const at = ++revision;
    if (state.busy) return;
    try {
      const active = await bounded(port.read());
      if (revision === at && !state.busy && active !== state.active) publish({ active, error:null });
    } catch { /* A background query must not replace the last confirmed state. */ }
  };
  const change = (requested?: boolean): Promise<void> => {
    if (operation) return operation;
    ++revision;
    // The microtask also protects calls made synchronously by another listener.
    operation = Promise.resolve().then(async () => {
      try {
        const current = await bounded(port.read());
        const target = requested ?? !current;
        if (current === target) { publish({ active: current }); return; }
        beforeChange();
        await bounded(port.write(target));
        let actual = await bounded(port.read());
        for (let i = 0; actual !== target && i < 12; i++) {
          await delay();
          actual = await bounded(port.read());
        }
        publish({ active: actual });
        if (actual !== target) throw new Error('Fullscreen transition not confirmed');
        // On Windows the WebView can lose input focus while its parent changes size.
        await bounded(port.focusContent());
      } catch {
        try { publish({ active: await bounded(port.read()) }); } catch { /* Keep confirmed state. */ }
        publish({ error: 'No se pudo completar el cambio de pantalla. Vuelve a intentarlo con el botón o con F11.' });
      } finally { operation = null; publish({ busy: false }); }
    });
    publish({ busy: true, error: null });
    return operation;
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh,
    toggle: () => change(),
    exit: () => operation ? operation.then(() => change(false)) : change(false),
  };
}
