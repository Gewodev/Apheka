import React, { useState, useEffect } from 'react';

// Reloj aislado: su tick re-renderiza SOLO este componente, no la vista entera.
// Antes Tareas/Música re-renderizaban sus miles de líneas cada segundo por el reloj.
export default function LiveClock({ children }: { children: (now: Date) => React.ReactNode }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer:ReturnType<typeof setTimeout>|undefined;
    const tick=()=>{
      if(timer)clearTimeout(timer);
      if(document.hidden)return;
      setNow(new Date());
      timer=setTimeout(tick,1000-Date.now()%1000);
    };
    document.addEventListener('visibilitychange',tick);
    tick();
    return()=>{if(timer)clearTimeout(timer);document.removeEventListener('visibilitychange',tick);};
  }, []);
  return <>{children(now)}</>;
}
