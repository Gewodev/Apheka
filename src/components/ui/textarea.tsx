import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
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
