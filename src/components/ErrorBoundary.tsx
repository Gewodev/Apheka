import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  stack?: string;
}

const ERROR_LOG_KEY = 'owa_error_log_v1';

function persistError(error: Error, stack: string | undefined) {
  try {
    const entry = {
      at: new Date().toISOString(),
      message: error.message,
      stack: stack || error.stack || '',
      href: window.location.hash || '',
    };
    const prev = JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || '[]');
    prev.push(entry);
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(prev.slice(-10)));
  } catch {
    /* noop */
  }
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, stack: undefined };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const stack = errorInfo.componentStack || undefined;
    console.error('Error capturado:', error, errorInfo);
    persistError(error, stack);
    if (stack) this.setState({ stack });
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div style={{
          height: '100vh',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-base)',
          color: 'var(--text-primary)',
          fontFamily: 'Inter, sans-serif'
        }}>
          <div className="bento-card" style={{
            padding: 48,
            maxWidth: 520,
            width: '90%',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.73 3h16.9a2 2 0 0 0 1.73-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>

            <h1 style={{
              fontSize: 24,
              fontWeight: 600,
              marginBottom: 8,
              color: 'var(--text-primary)'
            }}>
              Algo salió mal
            </h1>

            <p style={{
              fontSize: 14,
              color: 'var(--text-secondary)',
              marginBottom: 24,
              lineHeight: 1.6
            }}>
              Se produjo un error inesperado. Puedes intentar reiniciar la aplicación.
            </p>

            <div style={{
              background: 'var(--bg-elevated)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
              textAlign: 'left',
              width: '100%',
              border: '1px solid var(--border-default)'
            }}>
              <p style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-tertiary)',
                marginBottom: 8
              }}>
                Detalles técnicos:
              </p>
              <p style={{
                fontSize: 12,
                color: 'var(--error)',
                fontFamily: 'JetBrains Mono, monospace',
                wordBreak: 'break-word'
              }}>
                {this.state.error.message}
              </p>
              {this.state.stack && (
                <div style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: '1px solid var(--border-soft)',
                  maxHeight: 180,
                  overflowY: 'auto'
                }}>
                  <p style={{
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    fontFamily: 'JetBrains Mono, monospace',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.5
                  }}>
                    {this.state.stack}
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button
                onClick={() => {
                  try {
                    const txt = `West error\n${this.state.error?.message || ''}\n${this.state.stack || this.state.error?.stack || ''}`;
                    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt);
                  } catch { /* noop */ }
                }}
                style={{ flex: 1, padding: '14px', borderRadius: 10, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Copiar detalles
              </button>
              <button
                onClick={() => window.location.reload()}
                className="btn-primary"
                style={{ flex: 1, padding: '14px' }}
              >
                Reiniciar Aplicación
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
