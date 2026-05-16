import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}

const variantStyles: Record<string, React.CSSProperties> = {
  default: { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' },
  success: { background: 'rgba(16,185,129,0.15)', color: 'var(--success)' },
  warning: { background: 'rgba(245,158,11,0.15)', color: 'var(--warning)' },
  danger: { background: 'rgba(239,68,68,0.15)', color: 'var(--error)' },
  info: { background: 'var(--accent-soft)', color: 'var(--accent)' },
};

export const Badge = ({ variant = 'default', size = 'sm', children, style, ...props }: BadgeProps) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      fontWeight: 600,
      borderRadius: 'var(--radius-full)',
      fontSize: size === 'sm' ? 10 : 12,
      padding: size === 'sm' ? '2px 8px' : '4px 12px',
      ...variantStyles[variant],
      ...style,
    }}
    {...props}
  >
    {children}
  </span>
);
