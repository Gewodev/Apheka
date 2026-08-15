import React, { useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

// ─── Desplegable tipo "Agrupación/Tema" (clases .plan-select-popup en index.css) ───
// Compartido: Cursos, Planificador y Estudio. Opciones con color opcional muestran
// un punto del color antes del nombre (para cursos, por ejemplo).
export default function PlanSelectDropdown({ value, onChange, options, noneLabel, color }: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string; color?: string }[];
  noneLabel: string;
  color: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const sel = options.find(o => o.id === value);
  const filtered = options.filter(o => !query.trim() || o.label.toLowerCase().includes(query.trim().toLowerCase()));
  const close = () => { setOpen(false); setQuery(''); };
  return (
    <div ref={wrapRef} tabIndex={-1} style={{ position: 'relative', outline: 'none' }}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close(); }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: '100%', height: 42, borderRadius: 10, border: `1px solid ${open ? `${color}55` : 'var(--border-subtle)'}`, background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 38px 0 13px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif", cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 150ms', textAlign: 'left' }}>
        {sel?.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: sel.color, flexShrink: 0, boxShadow: `0 0 6px ${sel.color}` }} />}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: sel ? 'var(--text-primary)' : 'var(--text-muted)' }}>{sel ? sel.label : noneLabel}</span>
        <ChevronDown size={14} style={{ flexShrink: 0, color: open ? color : 'var(--text-muted)', transition: 'transform 180ms ease', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div className="plan-select-popup">
          <div className="psp-search-wrap">
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar…" className="psp-search" />
          </div>
          <div className="psp-list no-scrollbar">
            <button type="button" className={`psp-opt${value === '' ? ' sel' : ''}`} onClick={() => { onChange(''); close(); }}
              style={value === '' ? { background: `color-mix(in srgb, ${color} 12%, transparent)`, color, fontWeight: 600 } : undefined}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{noneLabel}</span>
              {value === '' && <Check size={12} style={{ color, flexShrink: 0 }} />}
            </button>
            {filtered.map(o => {
              const sel2 = o.id === value;
              return (
                <button key={o.id} type="button" className={`psp-opt${sel2 ? ' sel' : ''}`} onClick={() => { onChange(o.id); close(); }} title={o.label}
                  style={sel2 ? { background: `color-mix(in srgb, ${color} 12%, transparent)`, color, fontWeight: 600 } : undefined}>
                  {o.color && <span style={{ width: 7, height: 7, borderRadius: '50%', background: o.color, flexShrink: 0, boxShadow: sel2 ? `0 0 5px ${o.color}` : 'none' }} />}
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                  {sel2 && <Check size={12} style={{ color, flexShrink: 0 }} />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <span className="psp-empty">Sin resultados</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}