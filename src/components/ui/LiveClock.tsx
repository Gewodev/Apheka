import React, { useState, useEffect } from 'react';

// Reloj aislado: su tick re-renderiza SOLO este componente, no la vista entera.
// Antes Tareas/Música re-renderizaban sus miles de líneas cada segundo por el reloj.
export default function LiveClock({ children }: { children: (now: Date) => React.ReactNode }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  return <>{children(now)}</>;
}
