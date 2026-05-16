// Simple, lightweight design system proxy using design-tokens.json
import tokens from '../../design-tokens.json';

export const DESIGN_TOKENS = tokens as any;

// Small helper to access a color token safely
export function color(name: string): string {
  // naive path resolver: e.g., 'colors.accent' or 'colors.text.primary'
  const parts = name.split('.');
  let v: any = tokens;
  for (const p of parts) v = v?.[p];
  return v ?? '#000';
}

// Export a compact theme object for quick usage in components
export const Theme = {
  colors: {
    bgBase: color('colors.bg.base'),
    bgSurface: color('colors.bg.surface'),
    bgElevated: color('colors.bg.elevated'),
    textPrimary: color('colors.text.primary'),
    textSecondary: color('colors.text.secondary'),
    textMuted: color('colors.text.muted'),
    accent: color('colors.accent')
  },
  typography: {
    fontFamily: tokens.typography?.fontFamily || 'Inter, system-ui, sans-serif',
  },
  spacing: tokens.spacing as Record<string, number>,
  radii: tokens.radii as Record<string, number>
};
