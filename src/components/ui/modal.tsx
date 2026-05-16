import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeWidths = { sm: 360, md: 480, lg: 600 };

export const Modal = ({ isOpen, onClose, title, description, children, footer, size = 'md' }: ModalProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div
        style={{
          width: '100%',
          maxWidth: sizeWidths[size],
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
        }}
      >
        {(title || description) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              {title && <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>}
              {description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{description}</p>}
            </div>
            <button onClick={onClose} className="btn-ghost" style={{ padding: 6, borderRadius: 8, cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
        )}
        <div style={{ padding: 24 }}>{children}</div>
        {footer && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: 16, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
