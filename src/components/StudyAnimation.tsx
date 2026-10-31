import {useAppSlice} from "../store/AppContext";
import { useMemo } from 'react';
import { useApp } from '../store/AppContext';

export default function StudyAnimation() {
  const { settings } = useAppSlice(["settings"]);
  const glowColor = settings.accentColor || '#E11D48';

  const style = useMemo(() => ({
    container: {
      display: 'flex', alignItems: 'center', justifyContent: 'center' as const,
      flex: 1, width: '100%', overflow: 'hidden',
    },
    svg: {
      width: 120, height: 60,
    },
  }), []);

  return (
    <div style={style.container}>
      <svg viewBox="0 0 120 60" style={style.svg}>
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={glowColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Desk */}
        <rect x="15" y="42" width="90" height="3" rx="1.5" fill={glowColor} opacity="0.5" />
        <rect x="20" y="45" width="6" height="12" rx="1" fill={glowColor} opacity="0.2" />
        <rect x="94" y="45" width="6" height="12" rx="1" fill={glowColor} opacity="0.2" />
        {/* Book */}
        <rect x="40" y="32" width="30" height="10" rx="1" fill={glowColor} opacity="0.35">
          <animate attributeName="opacity" values="0.35;0.5;0.35" dur="3s" repeatCount="indefinite" />
        </rect>
        <rect x="42" y="34" width="26" height="1" fill="#020203" opacity="0.6" />
        <rect x="42" y="37" width="18" height="1" fill="#020203" opacity="0.4" />
        {/* Lamp */}
        <line x1="85" y1="42" x2="82" y2="22" stroke={glowColor} strokeWidth="1.5" opacity="0.4" />
        <line x1="82" y1="22" x2="95" y2="18" stroke={glowColor} strokeWidth="1.5" opacity="0.4" />
        <circle cx="95" cy="18" r="3" fill={glowColor} opacity="0.6">
          <animate attributeName="opacity" values="0.6;0.9;0.6" dur="2s" repeatCount="indefinite" />
          <animate attributeName="r" values="3;4;3" dur="2s" repeatCount="indefinite" />
        </circle>
        {/* Glow cone */}
        <polygon points="95,21 40,42 70,42" fill="url(#sg)" opacity="0.4">
          <animate attributeName="opacity" values="0.4;0.6;0.4" dur="2s" repeatCount="indefinite" />
        </polygon>
        {/* Person silhouette - head */}
        <circle cx="30" cy="20" r="6" fill={glowColor} opacity="0.3" />
        {/* Person - body */}
        <rect x="25" y="26" width="10" height="16" rx="3" fill={glowColor} opacity="0.25" />
        {/* Person - arm reaching to book */}
        <line x1="35" y1="30" x2="42" y2="35" stroke={glowColor} strokeWidth="2" opacity="0.3">
          <animate attributeName="x2" values="42;44;42" dur="4s" repeatCount="indefinite" />
        </line>
        {/* Focus pulse */}
        <circle cx="30" cy="28" r="18" fill="none" stroke={glowColor} strokeWidth="0.5" opacity="0">
          <animate attributeName="r" values="18;28" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0" dur="3s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}
