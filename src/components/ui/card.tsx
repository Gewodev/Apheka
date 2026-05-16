import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  compact?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable, compact, children, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: compact ? 12 : 20,
          transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          cursor: hoverable ? 'pointer' : undefined,
          ...(hoverable ? { border: '1px solid var(--border-default)' } : {}),
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = ({ children, style, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, ...style }} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, style, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', ...style }} {...props}>
    {children}
  </h3>
);

export const CardContent = ({ children, style, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div style={style} {...props}>
    {children}
  </div>
);
