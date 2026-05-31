export const segPolys: [number, number][][] = [
  [[14, 4], [58, 4], [50, 12], [22, 12]],
  [[68, 14], [60, 18], [60, 50], [68, 54]],
  [[68, 66], [60, 70], [60, 102], [68, 106]],
  [[22, 108], [50, 108], [58, 116], [14, 116]],
  [[4, 66], [12, 70], [12, 102], [4, 106]],
  [[4, 14], [12, 18], [12, 50], [4, 54]],
  [[10, 60], [18, 56], [54, 56], [62, 60], [54, 64], [18, 64]],
];

const segMap: Record<string, boolean[]> = {
  '0': [true, true, true, true, true, true, false],
  '1': [false, true, true, false, false, false, false],
  '2': [true, true, false, true, true, false, true],
  '3': [true, true, true, true, false, false, true],
  '4': [false, true, true, false, false, true, true],
  '5': [true, false, true, true, false, true, true],
  '6': [true, false, true, true, true, true, true],
  '7': [true, true, true, false, false, false, false],
  '8': [true, true, true, true, true, true, true],
  '9': [true, true, true, true, false, true, true],
};

export function DigitSVG({ d, color, width = 42, height = 68 }: { d: string; color: string; width?: number; height?: number }) {
  const s = segMap[d] || segMap['0'];
  return (
    <svg width={width} height={height} viewBox="0 0 72 120" style={{ display: 'block' }}>
      {segPolys.map((poly, i) => (
        <polygon key={i} points={poly.map(p => p.join(',')).join(' ')}
          fill={s[i] ? color : 'rgba(255,255,255,0.015)'}
          style={{
            transition: 'fill 150ms cubic-bezier(0.4, 0, 0.2, 1)',
            filter: s[i] ? `drop-shadow(0 0 5px ${color}90) drop-shadow(0 0 12px ${color}50)` : 'none',
          }}
        />
      ))}
    </svg>
  );
}

export function ColonSVG({ color, width = 16, height = 68 }: { color: string; width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 120" style={{ display: 'block' }}>
      <rect x={8} y={38} width={8} height={8} rx={4} ry={4} fill={color}
        style={{ filter: `drop-shadow(0 0 5px ${color}90) drop-shadow(0 0 12px ${color}50)`, transition: 'fill 150ms ease-out' }} />
      <rect x={8} y={74} width={8} height={8} rx={4} ry={4} fill={color}
        style={{ filter: `drop-shadow(0 0 5px ${color}90) drop-shadow(0 0 12px ${color}50)`, transition: 'fill 150ms ease-out' }} />
    </svg>
  );
}
