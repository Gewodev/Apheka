import React, { createContext, useContext } from 'react';

interface TabsContextValue {
  value: string;
  onValueChange: (v: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export const Tabs = ({ value, onValueChange, children }: {
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
}) => (
  <TabsContext.Provider value={{ value, onValueChange }}>
    <div>{children}</div>
  </TabsContext.Provider>
);

export const TabsList = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)' }}>
    {children}
  </div>
);

export const TabsTrigger = ({ value, children }: { value: string; children: React.ReactNode }) => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabsTrigger must be used within Tabs');
  const isActive = ctx.value === value;
  return (
    <button
      onClick={() => ctx.onValueChange(value)}
      style={{
        flex: 1,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 500,
        borderRadius: 'var(--radius-md)',
        border: 'none',
        cursor: 'pointer',
        background: isActive ? 'var(--accent)' : 'transparent',
        color: isActive ? '#fff' : 'var(--text-secondary)',
        transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, children }: { value: string; children: React.ReactNode }) => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabsContent must be used within Tabs');
  if (ctx.value !== value) return null;
  return <div style={{ marginTop: 16 }}>{children}</div>;
};
