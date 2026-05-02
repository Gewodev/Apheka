import React from 'react';
import clsx from 'clsx';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  size?: 'sm' | 'md';
}

export const Toggle = ({ checked, onChange, label, description, size = 'md' }: ToggleProps) => (
  <div className="flex items-center justify-between gap-3">
    {(label || description) && (
      <div>
        {label && <span className="text-sm font-medium text-text-primary">{label}</span>}
        {description && <p className="text-xs text-text-tertiary mt-0.5">{description}</p>}
      </div>
    )}
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        size === 'sm' ? 'h-5 w-9' : 'h-6 w-11',
        checked ? 'bg-accent' : 'bg-bg-active'
      )}
    >
      <span
        className={clsx(
          'pointer-events-none inline-block rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out',
          size === 'sm' ? 'h-4 w-4 translate-x-0.5' : 'h-5 w-5 translate-x-0.5',
          checked && (size === 'sm' ? 'translate-x-[18px]' : 'translate-x-[22px]')
        )}
      />
    </button>
  </div>
);
