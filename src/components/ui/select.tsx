import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  error?: string;
}

export const Select = ({ label, options, error, style, ...props }: SelectProps) => (
  <div style={{ width: '100%' }}>
    {label && (
      <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </label>
    )}
    <select
      className="input-base"
      style={{
        cursor: 'pointer',
        appearance: 'none',
        ...(error ? { borderColor: 'var(--error)' } : {}),
        ...style,
      }}
      {...props}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    {error && <p style={{ marginTop: 4, fontSize: 11, color: 'var(--error)' }}>{error}</p>}
  </div>
);
