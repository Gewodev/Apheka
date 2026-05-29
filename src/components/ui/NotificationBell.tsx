import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, Check, Info, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { useApp } from '../../store/AppContext';

export default function NotificationBell() {
  const { notifications, removeNotification, clearNotifications } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const iconMap: Record<string, React.ReactNode> = {
    success: <CheckCircle size={14} style={{ color: '#10B981', flexShrink: 0 }} />,
    error: <AlertCircle size={14} style={{ color: '#EF4444', flexShrink: 0 }} />,
    info: <Info size={14} style={{ color: '#3B82F6', flexShrink: 0 }} />,
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(!open)}
        style={{ position: 'relative', padding: 8, borderRadius: '50%', background: 'var(--bg-deep)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms' }}
        className="hover:border-borderStrong hover:text-white">
        <Bell size={16} />
        {notifications.length > 0 && (
          <span style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: '#EF4444', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-base)', lineHeight: 1 }}>
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 340, maxHeight: 400, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.5)', overflow: 'hidden', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Notificaciones</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {notifications.length > 0 && (
                <button onClick={() => { if (confirm('¿Limpiar todas las notificaciones?')) clearNotifications(); }} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 500, background: 'var(--bg-deep)', border: '1px solid var(--border-default)', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                  Limpiar
                </button>
              )}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, fontWeight: 400 }}>
                Sin notificaciones
              </div>
            ) : (
              [...notifications].reverse().map((n, i) => (
                <div key={n.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 8, margin: '2px 0', transition: 'background 150ms' }} className="hover:bg-white/[0.02]">
                  {iconMap[n.type] || iconMap.info}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4, margin: 0 }}>{n.message}</p>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3, margin: 0 }}>
                      {new Date(n.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <X size={10} style={{ color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0, marginTop: 2 }} onClick={() => removeNotification(n.id)} />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
