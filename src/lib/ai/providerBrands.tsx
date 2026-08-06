// ═══════════════════════════════════════════════════
//  CHARVIS — Logos de marca de los proveedores de IA
// ═══════════════════════════════════════════════════
import React from 'react';
import { CHARVIS_PROVIDERS } from './aiProviders';

export function providerBrandColor(id: string): string {
  return CHARVIS_PROVIDERS.find(p => p.id === id)?.brandColor || '#22c55e';
}

/** Marca en blanco (mark vectorial propio de cada proveedor), listo para poner sobre un tile de color. */
export function BrandMark({ id, size = 20 }: { id: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } };
  switch (id) {
    case 'opencode':
      // Sparkle de 4 puntas (OpenCode)
      return (
        <svg {...common} fill="#fff">
          <path d="M12 1.6 13.7 10.3 22.4 12 13.7 13.7 12 22.4 10.3 13.7 1.6 12 10.3 10.3Z" />
        </svg>
      );
    case 'openai':
      // Nudo de OpenAI (aprox. del flower/hexágono entrelazado)
      return (
        <svg {...common} fill="#fff">
          <path d="M20.94 11.83c-.09-2.5-1.3-4.8-3.3-6.3-1.9-1.4-4.3-1.9-6.6-1.4-1.6.3-3 1.1-4.1 2.2-1.5 1.5-2.3 3.5-2.3 5.6 0 .6.1 1.2.2 1.8.2 1.3.7 2.5 1.5 3.6 1.2 1.6 3 2.6 4.9 2.8 1 .1 2.1 0 3-.4.3-.1.5-.4.5-.7 0-.4-.4-.7-.8-.6-.7.2-1.4.2-2.1.1-1.5-.2-2.8-1-3.7-2.2-.6-.9-1-1.9-1.1-3 0-.3-.1-.7 0-1 .1-.5.3-1 .5-1.5.6-1.3 1.6-2.4 2.9-3 1.3-.6 2.8-.6 4.1 0 1.3.6 2.3 1.7 2.9 3 .3.7.5 1.4.5 2.2.1.4.4.7.9.7.5 0 .9-.4.9-.9.1-.4.1-.8 0-1.2Z" />
        </svg>
      );
    case 'gemini':
      // Estrella de 4 puntas de Gemini
      return (
        <svg {...common} fill="#fff">
          <path d="M12 0c2.9 5.7 6.3 9.1 12 12-5.7 2.9-9.1 6.3-12 12-2.9-5.7-6.3-9.1-12-12C5.7 9.1 9.1 5.7 12 0Z" />
        </svg>
      );
    case 'anthropic':
      // Asterisco/sunburst de Claude
      return (
        <svg {...common} stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
          <circle cx="12" cy="12" r="1.6" fill="#fff" stroke="none" />
        </svg>
      );
    case 'deepseek':
      // Ballena de DeepSeek
      return (
        <svg {...common} fill="#fff">
          <path d="M2.5 13.5c1-3.6 4.5-6.2 9.2-6.2 3.4 0 6.6 1.4 8.8 4.3-3.9.1-6.8 1.8-8.5 4.7-1.5-2-3.9-3.1-7-3.1-1 0-2 .1-2.5.3Z" />
          <path d="M19.8 8.2c1.7.9 3.1 2.3 4 4.1-.5-.1-1-.1-1.5-.1.7 1.8 1.2 3.7 1.5 5.7-1.1-1.5-2.5-2.7-4.1-3.6-.4-2.5-.3-4.3.1-6.1Z" />
        </svg>
      );
    case 'kimi':
      // Luna creciente de Moonshot
      return (
        <svg {...common} fill="#fff">
          <path d="M16.6 3.1a9 9 0 1 0 4.3 17.8 9.6 9.6 0 0 1-4.3-17.8Z" />
        </svg>
      );
    case 'mistral':
      // Monograma M de Mistral
      return (
        <svg {...common} fill="#fff">
          <path d="M4 4.5h3.1l4.9 8 4.9-8H20v15h-3.1v-8.2L12 19l-4.9-7.7V19.5H4Z" />
        </svg>
      );
    case 'groq':
      // "g" de Groq con rayo
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" fill="#fff" />
          <path d="M9.4 8.6c0-1.6 1.2-2.7 2.9-2.7 1.5 0 2.5.8 2.6 2.1 0 1.2-.6 2-2.2 2.3l-1 .1v1.6l1.1-.1c1.7-.2 2.6.7 2.6 2 0 1.5-1.3 2.5-3 2.5-1.8 0-3-.9-3-2.6h1.9c0 .6.5 1 1.1 1 .6 0 1.1-.3 1.1-1 0-.7-.5-1-1.2-1.1h-.6v-2l.6-.1c.8-.2 1.2-.7 1.2-1.4 0-.7-.5-1.1-1.2-1.1-.7 0-1.2.4-1.2 1H9.4Z" fill="#0b0b0f" />
        </svg>
      );
    case 'openrouter':
      // Nodo enrutable con 3 salidas
      return (
        <svg {...common} stroke="#fff" strokeWidth="2.1" strokeLinecap="round">
          <path d="M6 7.5 11 12l-5 4.5M18 7.5 13 12l5 4.5M12 2.5l-2.5 5M12 2.5 14.5 7.5M12 21.5l-2.5-5M12 21.5l2.5-5" />
          <circle cx="12" cy="12" r="2.6" fill="#fff" stroke="none" />
        </svg>
      );
    case 'xai':
      // X de xAI
      return (
        <svg {...common} stroke="#fff" strokeWidth="3" strokeLinecap="round">
          <path d="M5 4.5 19 19.5M19 4.5 5 19.5" />
        </svg>
      );
    default:
      return (
        <svg {...common} fill="#fff">
          <path d="M12 2 13.6 10.4 22 12 13.6 13.6 12 22 10.4 13.6 2 12 10.4 10.4Z" />
        </svg>
      );
  }
}

/** Tile redondo con el color de marca + la marca blanca. */
export function BrandLogo({ id, size = 40, radius = 12 }: { id: string; size?: number; radius?: number }) {
  const color = providerBrandColor(id);
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(145deg, ${color} 0%, ${color}dd 100%)`,
        border: `1px solid ${color}55`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: `0 4px 14px ${color}33, inset 0 1px 0 rgba(255,255,255,0.25)`,
      }}
    >
      <BrandMark id={id} size={Math.round(size * 0.5)} />
    </span>
  );
}
