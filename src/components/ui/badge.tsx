import React from 'react';
import clsx from 'clsx';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}

const variantStyles = {
  default: 'bg-bg-elevated text-text-secondary border-border-default',
  success: 'bg-success-subtle text-success border-success/20',
  warning: 'bg-warning-subtle text-warning border-warning/20',
  danger: 'bg-danger-subtle text-danger border-danger/20',
  info: 'bg-accent-subtle text-accent border-accent-border',
};

export const Badge = ({ className, variant = 'default', size = 'sm', children, ...props }: BadgeProps) => (
  <span
    className={clsx(
      'inline-flex items-center font-medium border rounded-full',
      variantStyles[variant],
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      className
    )}
    {...props}
  >
    {children}
  </span>
);
