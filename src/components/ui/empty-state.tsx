import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
    {icon && <div style={{ color: 'var(--text-muted)', marginBottom: 16, opacity: 0.3 }}>{icon}</div>}
    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</h3>
    {description && <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>{description}</p>}
    {action && <div>{action}</div>}
  </div>
);
