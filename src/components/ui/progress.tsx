import React from 'react';

export interface ProgressProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const variantColors: Record<string, string> = {
  default: 'var(--accent)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--error)',
};

export const Progress = ({ value, max = 100, showLabel, variant = 'default' }: ProgressProps) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="progress-track" style={{ flex: 1 }}>
        <div className="progress-fill" style={{ width: `${percentage}%`, background: variantColors[variant] }} />
      </div>
      {showLabel && (
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', minWidth: 40, textAlign: 'right' }}>
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
};
