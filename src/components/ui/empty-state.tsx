import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
    {icon && (
      <div className="mb-4 text-text-tertiary/50">
        {icon}
      </div>
    )}
    <h3 className="text-sm font-semibold text-text-primary mb-1">{title}</h3>
    {description && (
      <p className="text-xs text-text-tertiary mb-4">{description}</p>
    )}
    {action}
  </div>
);
