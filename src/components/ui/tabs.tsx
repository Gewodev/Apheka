import React, { createContext, useContext } from 'react';
import clsx from 'clsx';

interface TabsContextValue {
  value: string;
  onValueChange: (v: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export const Tabs = ({ value, onValueChange, className, children }: {
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}) => (
  <TabsContext.Provider value={{ value, onValueChange }}>
    <div className={clsx('', className)}>{children}</div>
  </TabsContext.Provider>
);

export const TabsList = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={clsx('flex gap-1 p-1 bg-bg-elevated rounded-lg', className)}>
    {children}
  </div>
);

export const TabsTrigger = ({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabsTrigger must be used within Tabs');
  const isActive = ctx.value === value;
  return (
    <button
      onClick={() => ctx.onValueChange(value)}
      className={clsx(
        'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
        isActive
          ? 'bg-accent text-white shadow-sm'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
        className
      )}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, children }: { value: string; children: React.ReactNode }) => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabsContent must be used within Tabs');
  if (ctx.value !== value) return null;
  return <div className="mt-4">{children}</div>;
};