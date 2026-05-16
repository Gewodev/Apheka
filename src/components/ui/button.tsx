import React from 'react';

const variantStyles: Record<string, React.CSSProperties> = {
  primary: { background: 'var(--accent)', color: '#fff' },
  secondary: { background: 'transparent', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' },
  ghost: { background: 'transparent', color: 'var(--text-tertiary)' },
  danger: { background: 'var(--error)', color: '#fff' },
  outline: { background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' },
};

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius-sm)' },
  md: { padding: '8px 16px', fontSize: 13, borderRadius: 'var(--radius-md)' },
  lg: { padding: '10px 24px', fontSize: 14, borderRadius: 'var(--radius-md)' },
  icon: { padding: 8, borderRadius: 'var(--radius-md)', aspectRatio: '1' },
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, disabled, style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontWeight: 500,
          height: size === 'sm' ? 32 : 36,
          cursor: 'pointer',
          border: 'none',
          transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          opacity: disabled || loading ? 0.5 : 1,
          pointerEvents: disabled || loading ? 'none' : 'auto',
          ...variantStyles[variant],
          ...sizeStyles[size],
          ...style,
        }}
        {...props}
      >
        {loading && (
          <svg className="animate-spin" width={16} height={16} viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
