/** Coalesce media/resize bursts and never let pointer recovery block the UI. */
export function createPointerRecovery(restore: () => Promise<unknown>, now = () => Date.now()) {
  let pending = false, last = -Infinity;
  return async (force = false) => {
    if (pending || (!force && now() - last < 750)) return;
    pending = true; last = now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([restore(),new Promise<void>(resolve=>{timer=setTimeout(resolve,1500);})]); } catch { /* Pointer recovery must not interrupt playback/fullscreen. */ }
    finally { clearTimeout(timer); pending = false; }
  };
}
