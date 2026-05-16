import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  error: Error;
  resetErrorBoundary: () => void;
}

export default function ErrorFallback({ error, resetErrorBoundary }: Props) {
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
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 16,
        padding: 48,
        maxWidth: 520,
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
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
          <AlertTriangle size={28} color="var(--error)" />
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
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          textAlign: 'left'
        }}>
          <p style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            marginBottom: 8
          }}>
            Detalles del error:
          </p>
          <p style={{
            fontSize: 12,
            color: 'var(--error)',
            fontFamily: 'monospace',
            wordBreak: 'break-word'
          }}>
            {error.message}
          </p>
        </div>

        <button
          onClick={resetErrorBoundary}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 24px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 200ms'
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <RefreshCw size={16} />
          Reiniciar Aplicación
        </button>
      </div>
    </div>
  );
}
