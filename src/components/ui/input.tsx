import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, style, ...props }, ref) => {
    return (
      <div style={{ width: '100%' }}>
        {label && (
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            {label}
          </label>
        )}
        <div style={{ position: 'relative' }}>
          {icon && (
            <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className="input-base"
            style={{
              ...(icon ? { paddingLeft: 36 } : {}),
              ...(error ? { borderColor: 'var(--error)' } : {}),
              ...style,
            }}
            {...props}
          />
        </div>
        {error && <p style={{ marginTop: 4, fontSize: 11, color: 'var(--error)' }}>{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }>(
  ({ label, error, style, ...props }, ref) => {
    return (
      <div style={{ width: '100%' }}>
        {label && (
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className="input-base"
          style={{
            minHeight: 80,
            resize: 'vertical',
            paddingTop: 12,
            ...(error ? { borderColor: 'var(--error)' } : {}),
            ...style,
          }}
          {...props}
        />
        {error && <p style={{ marginTop: 4, fontSize: 11, color: 'var(--error)' }}>{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
