import { memo } from 'react';

const stylesheet = `
@keyframes plantBreathe {
  0% { transform: scaleY(0.65) translateY(8px); opacity: 0.5; }
  50% { transform: scaleY(1) translateY(0); opacity: 1; }
  100% { transform: scaleY(0.65) translateY(8px); opacity: 0.5; }
}
@keyframes leafSway {
  0% { transform: rotate(-4deg); }
  50% { transform: rotate(4deg); }
  100% { transform: rotate(-4deg); }
}
@keyframes stemSway {
  0% { transform: rotate(-1deg); }
  50% { transform: rotate(1deg); }
  100% { transform: rotate(-1deg); }
}
@keyframes stackBook {
  0% { transform: translateY(8px) rotate(-2deg); opacity: 0; }
  30% { transform: translateY(0) rotate(1deg); opacity: 1; }
  70% { transform: translateY(0) rotate(1deg); opacity: 1; }
  100% { transform: translateY(0) rotate(0deg); opacity: 1; }
}
@keyframes pageFlip {
  0% { transform: scaleX(1); }
  25% { transform: scaleX(0); }
  50% { transform: scaleX(1); }
  75% { transform: scaleX(0); }
  100% { transform: scaleX(1); }
}
@keyframes twinkle {
  0% { opacity: 0.2; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.1); }
  100% { opacity: 0.2; transform: scale(0.8); }
}
@keyframes waveMove {
  0% { transform: translateX(-8px); opacity: 0.3; }
  50% { transform: translateX(0); opacity: 0.8; }
  100% { transform: translateX(8px); opacity: 0.3; }
}
@keyframes leafFall {
  0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translateY(20px) rotate(30deg); opacity: 0; }
}
@keyframes breatheCircle {
  0% { transform: scale(0.75); opacity: 0.3; }
  50% { transform: scale(1); opacity: 0.7; }
  100% { transform: scale(0.75); opacity: 0.3; }
}
`;

export const PlantAnimation = memo(({ color }: { color: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 68, width: 68 }}>
    <svg width="56" height="64" viewBox="0 0 56 64" fill="none" style={{ display: 'block' }}>
      <style>{stylesheet}</style>
      <g style={{ animation: 'plantBreathe 4s ease-in-out infinite', transformOrigin: 'bottom center' }}>
        <rect x="14" y="48" width="28" height="16" rx="3" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
        <rect x="18" y="48" width="20" height="4" rx="1.5" fill={color} fillOpacity="0.08" />
      </g>
      <g style={{ animation: 'stemSway 3s ease-in-out infinite', transformOrigin: '28px 48px' }}>
        <path d="M28 48 Q28 36 28 30 Q28 24 28 18" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" strokeOpacity="0.5" />
        <g style={{ animation: 'leafSway 2.4s ease-in-out infinite', transformOrigin: '28px 30px', animationDelay: '0.2s' }}>
          <path d="M28 28 Q36 24 34 32 Q32 36 28 32" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="0.6" strokeOpacity="0.4" />
        </g>
        <g style={{ animation: 'leafSway 2.8s ease-in-out infinite', transformOrigin: '28px 22px', animationDelay: '0.6s' }}>
          <path d="M28 22 Q20 18 22 26 Q24 30 28 26" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="0.6" strokeOpacity="0.35" />
        </g>
        <g style={{ animation: 'leafSway 2s ease-in-out infinite', transformOrigin: '28px 16px', animationDelay: '0s' }}>
          <path d="M28 16 Q34 12 33 20 Q31 24 28 20" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="0.6" strokeOpacity="0.45" />
        </g>
      </g>
      <circle cx="19" cy="43" r="2" fill={color} fillOpacity="0.08" />
      <circle cx="37" cy="45" r="1.5" fill={color} fillOpacity="0.06" />
    </svg>
  </div>
));

export const BooksAnimation = memo(({ color }: { color: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 68, width: 68 }}>
    <style>{stylesheet}</style>
    <svg width="52" height="60" viewBox="0 0 52 60" fill="none" style={{ display: 'block' }}>
      <g style={{ animation: 'stackBook 3s ease-out infinite', transformOrigin: '26px 52px' }}>
        <rect x="14" y="44" width="26" height="6" rx="1" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="0.8" strokeOpacity="0.3" />
      </g>
      <g style={{ animation: 'stackBook 3s ease-out infinite', transformOrigin: '26px 42px', animationDelay: '0.5s' }}>
        <rect x="12" y="38" width="30" height="6" rx="1" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="0.8" strokeOpacity="0.35" />
        <line x1="22" y1="40" x2="32" y2="40" stroke={color} strokeWidth="0.5" strokeOpacity="0.2" />
      </g>
      <g style={{ animation: 'stackBook 3s ease-out infinite', transformOrigin: '26px 32px', animationDelay: '1s' }}>
        <rect x="10" y="32" width="34" height="6" rx="1" fill={color} fillOpacity="0.22" stroke={color} strokeWidth="0.8" strokeOpacity="0.4" />
        <line x1="18" y1="34" x2="36" y2="34" stroke={color} strokeWidth="0.5" strokeOpacity="0.25" />
        <line x1="16" y1="36" x2="28" y2="36" stroke={color} strokeWidth="0.4" strokeOpacity="0.15" />
      </g>
      <g style={{ animation: 'stackBook 3s ease-out infinite', transformOrigin: '26px 22px', animationDelay: '1.5s' }}>
        <rect x="8" y="26" width="38" height="6" rx="1" fill={color} fillOpacity="0.28" stroke={color} strokeWidth="0.8" strokeOpacity="0.45" />
        <line x1="16" y1="28" x2="40" y2="28" stroke={color} strokeWidth="0.5" strokeOpacity="0.3" />
        <line x1="14" y1="30" x2="30" y2="30" stroke={color} strokeWidth="0.4" strokeOpacity="0.2" />
      </g>
      <g style={{ animation: 'pageFlip 4s ease-in-out infinite', transformOrigin: '41px 50px' }}>
        <path d="M38 52 Q42 50 40 46" stroke={color} strokeWidth="0.8" fill="none" strokeOpacity="0.25" />
      </g>
      <g style={{ animation: 'pageFlip 4s ease-in-out infinite', transformOrigin: '41px 44px', animationDelay: '0.8s' }}>
        <path d="M40 46 Q44 44 42 40" stroke={color} strokeWidth="0.8" fill="none" strokeOpacity="0.2" />
      </g>
    </svg>
  </div>
));

export const StarsAnimation = memo(({ color }: { color: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 68, width: 68 }}>
    <style>{stylesheet}</style>
    <svg width="56" height="60" viewBox="0 0 56 60" fill="none" style={{ display: 'block' }}>
      {[
        { x: 28, y: 30, d: 1, delay: '0s' },
        { x: 14, y: 18, d: 0.6, delay: '0.6s' },
        { x: 42, y: 22, d: 0.7, delay: '1s' },
        { x: 18, y: 42, d: 0.5, delay: '1.5s' },
        { x: 38, y: 38, d: 0.5, delay: '0.3s' },
        { x: 28, y: 14, d: 0.4, delay: '2s' },
        { x: 8, y: 32, d: 0.35, delay: '1.2s' },
        { x: 48, y: 32, d: 0.4, delay: '0.8s' },
      ].map((s, i) => (
        <g key={i} style={{ animation: `twinkle ${2 + (i % 3) * 0.5}s ease-in-out infinite`, animationDelay: s.delay, transformOrigin: `${s.x}px ${s.y}px` }}>
          <circle cx={s.x} cy={s.y} r={s.d * 2.5} fill={color} fillOpacity="0.35" />
          <circle cx={s.x} cy={s.y} r={s.d * 1.2} fill={color} fillOpacity="0.6" />
        </g>
      ))}
    </svg>
  </div>
));

export const WavesAnimation = memo(({ color }: { color: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 68, width: 68 }}>
    <style>{stylesheet}</style>
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{ display: 'block' }}>
      {[0, 1, 2].map(i => (
        <g key={i} style={{ animation: `waveMove ${2.5 + i * 0.4}s ease-in-out infinite`, animationDelay: `${i * 0.3}s` }}>
          <path d={`M4 ${28 + i * 4} Q18 ${20 + i * 4} 28 ${28 + i * 4} Q38 ${36 + i * 4} 52 ${28 + i * 4}`}
            stroke={color} strokeWidth="1.2" strokeOpacity={0.5 - i * 0.12} fill="none" strokeLinecap="round" />
        </g>
      ))}
      {[0, 1, 2].map(i => (
        <g key={i + 3} style={{ animation: `waveMove ${2.8 + i * 0.3}s ease-in-out infinite`, animationDelay: `${0.5 + i * 0.4}s` }}>
          <path d={`M4 ${28 - i * 4} Q18 ${20 - i * 4} 28 ${28 - i * 4} Q38 ${36 - i * 4} 52 ${28 - i * 4}`}
            stroke={color} strokeWidth="0.8" strokeOpacity={0.3 - i * 0.08} fill="none" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  </div>
));

export const LeavesAnimation = memo(({ color }: { color: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 68, width: 68 }}>
    <style>{stylesheet}</style>
    <svg width="56" height="60" viewBox="0 0 56 60" fill="none" style={{ display: 'block' }}>
      {[
        { x: 18, y: 22, d: 0, delay: '0s' },
        { x: 38, y: 18, d: 0.3, delay: '0.8s' },
        { x: 14, y: 38, d: 0.6, delay: '1.6s' },
        { x: 42, y: 34, d: 0.9, delay: '2.4s' },
        { x: 28, y: 12, d: 1.2, delay: '0.4s' },
        { x: 24, y: 44, d: 1.5, delay: '1.2s' },
      ].map((s, i) => (
        <g key={i} style={{ animation: `leafFall ${3 + (i % 2) * 0.8}s ease-in-out infinite`, animationDelay: s.delay, transformOrigin: `${s.x}px ${s.y}px` }}>
          <path d={`M${s.x} ${s.y} Q${s.x + 6} ${s.y - 4} ${s.x + 8} ${s.y + 2} Q${s.x + 4} ${s.y + 6} ${s.x} ${s.y + 2}`}
            fill={color} fillOpacity={0.2 + (i % 3) * 0.05} stroke={color} strokeWidth="0.5" strokeOpacity="0.3" />
        </g>
      ))}
    </svg>
  </div>
));

export const BreathingAnimation = memo(({ color }: { color: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 68, width: 68 }}>
    <style>{stylesheet}</style>
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" style={{ display: 'block' }}>
      <g style={{ animation: 'breatheCircle 4s ease-in-out infinite', transformOrigin: '26px 26px' }}>
        <circle cx="26" cy="26" r="20" fill={color} fillOpacity="0.06" stroke={color} strokeWidth="1" strokeOpacity="0.2" />
      </g>
      <g style={{ animation: 'breatheCircle 4s ease-in-out infinite', transformOrigin: '26px 26px', animationDelay: '0.5s' }}>
        <circle cx="26" cy="26" r="14" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1.2" strokeOpacity="0.3" />
      </g>
      <g style={{ animation: 'breatheCircle 4s ease-in-out infinite', transformOrigin: '26px 26px', animationDelay: '1s' }}>
        <circle cx="26" cy="26" r="8" fill={color} fillOpacity="0.16" stroke={color} strokeWidth="1.5" strokeOpacity="0.4" />
      </g>
      <g style={{ animation: 'breatheCircle 4s ease-in-out infinite', transformOrigin: '26px 26px', animationDelay: '1.5s' }}>
        <circle cx="26" cy="26" r="3" fill={color} fillOpacity="0.25" />
      </g>
    </svg>
  </div>
));

export const ANIMATIONS: Record<string, { component: typeof PlantAnimation; label: string; icon: string }> = {
  plant: { component: PlantAnimation, label: 'Planta', icon: '🌱' },
  books: { component: BooksAnimation, label: 'Libros', icon: '📚' },
  stars: { component: StarsAnimation, label: 'Estrellas', icon: '✨' },
  waves: { component: WavesAnimation, label: 'Ondas', icon: '〰️' },
  leaves: { component: LeavesAnimation, label: 'Hojas', icon: '🍃' },
  breathing: { component: BreathingAnimation, label: 'Respiración', icon: '○' },
};
