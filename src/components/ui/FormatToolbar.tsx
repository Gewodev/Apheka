import React from 'react';
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, Heading3, Highlighter, AlignLeft, AlignCenter } from 'lucide-react';

export type ToolbarItem = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'list' | 'orderedList' | 'heading3' | 'highlight' | 'alignLeft' | 'alignCenter';

interface FormatToolbarProps {
  onFormat: (cmd: string, value?: string) => void;
  color?: string;
  toolbarItems?: ToolbarItem[];
  activeFormats?: Record<string, boolean>;
}

const btnStyle: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 6, border: 'none', background: 'transparent',
  cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
  justifyContent: 'center', transition: 'background-color 120ms ease, color 120ms ease', flexShrink: 0,
};

const sepStyle: React.CSSProperties = {
  width: 1, height: 16, background: 'var(--border-subtle)', margin: '0 4px', flexShrink: 0,
};

const ALL: ToolbarItem[] = ['bold','italic','underline','strikethrough','list','orderedList','heading3','highlight','alignLeft','alignCenter'];

const CONF: Record<ToolbarItem, { icon: React.ComponentType<{size?: number}>, cmd: string, value?: string, title: string, stateCmd?: string }> = {
  bold: { icon: Bold, cmd: 'bold', title: 'Negrita', stateCmd: 'bold' },
  italic: { icon: Italic, cmd: 'italic', title: 'Cursiva', stateCmd: 'italic' },
  underline: { icon: Underline, cmd: 'underline', title: 'Subrayado', stateCmd: 'underline' },
  strikethrough: { icon: Strikethrough, cmd: 'strikeThrough', title: 'Tachado', stateCmd: 'strikeThrough' },
  list: { icon: List, cmd: 'insertUnorderedList', title: 'Lista', stateCmd: 'insertUnorderedList' },
  orderedList: { icon: ListOrdered, cmd: 'insertOrderedList', title: 'Lista ordenada', stateCmd: 'insertOrderedList' },
  heading3: { icon: Heading3, cmd: 'formatBlock', value: '<h3>', title: 'Título', stateCmd: 'heading3' },
  highlight: { icon: Highlighter, cmd: 'hiliteColor', value: 'rgba(234,179,8,0.2)', title: 'Resaltar' },
  alignLeft: { icon: AlignLeft, cmd: 'justifyLeft', title: 'Alinear' },
  alignCenter: { icon: AlignCenter, cmd: 'justifyCenter', title: 'Centrar' },
};

const SEP_AFTER: ToolbarItem[] = ['strikethrough', 'orderedList'];

export function FormatToolbar({ onFormat, color, toolbarItems, activeFormats }: FormatToolbarProps) {
  const items = toolbarItems || ALL;
  const hoverBg = color ? `color-mix(in srgb, ${color} 8%, transparent)` : 'var(--bg-hover)';
  const activeBg = color ? `color-mix(in srgb, ${color} 12%, transparent)` : 'var(--bg-hover)';
  const activeColor = color || 'var(--accent)';
  return (
    <div className="note-format-toolbar" role="toolbar" aria-label="Formato del texto" onMouseDown={e => { const t = e.target as HTMLElement; if (e.button === 0 && t.tagName !== 'INPUT') e.preventDefault(); }} style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
      background: 'transparent',
      borderBottom: '1px solid var(--border-subtle)',
      flexShrink: 0, overflowX: 'auto',
    }}>
      {items.map((key) => {
        const cfg = CONF[key];
        const Icon = cfg.icon;
        const stateCmd = cfg.stateCmd;
        const isActive = stateCmd && activeFormats?.[stateCmd];
        return (
          <React.Fragment key={key}>
            <button
              onClick={() => onFormat(cfg.cmd, cfg.value)}
              style={{
                ...btnStyle,
                border: isActive ? `1px solid color-mix(in srgb, ${activeColor} 45%, var(--border-default))` : '1px solid transparent',
                background: isActive ? activeBg : 'transparent',
                color: isActive ? activeColor : 'var(--text-secondary)',
                boxShadow: 'none',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = isActive ? activeBg : hoverBg; }}
              onMouseLeave={e => { e.currentTarget.style.background = isActive ? activeBg : 'transparent'; }}
              aria-label={cfg.title} aria-pressed={!!isActive} title={cfg.title}><Icon size={16} /></button>
            {SEP_AFTER.includes(key) && <div style={sepStyle} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
