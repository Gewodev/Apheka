import React from 'react';
import clsx from 'clsx';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  error?: string;
}

export const Select = ({ className, label, options, error, ...props }: SelectProps) => (
  <div className="w-full">
    {label && (
      <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
        {label}
      </label>
    )}
    <select
      className={clsx(
        'w-full bg-bg-elevated border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all appearance-none bg-[url(data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2712%27%20height%3D%2712%27%20viewBox%3D%270%200%2012%2012%27%3E%3Cpath%20fill%3D%27%236b7280%27%20d%3D%27M6%208L1%203h10z%27%2F%3E%3C%2Fsvg%3E)] bg-[length:12px] bg-[right_12px_center] bg-no-repeat',
        error && 'border-danger focus:ring-danger/20',
        className
      )}
      {...props}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    {error && <p className="mt-1 text-xs text-danger">{error}</p>}
  </div>
);
