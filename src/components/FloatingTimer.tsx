import { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Monitor, MonitorOff } from 'lucide-react';
import { useApp } from '../store/AppContext';

interface TimerSync {
  sessionTime: number;
  isTimerActive: boolean;
  isRest: boolean;
  sessionType: 'pomodoro' | 'chrono';
  pomodoroTime: number;
  shortBreakTime: number;
}

const segs: Record<string, boolean[]> = {
  '0': [true,true,true,true,true,true,false], '1': [false,true,true,false,false,false,false],
  '2': [true,true,false,true,true,false,true], '3': [true,true,true,true,false,false,true],
  '4': [false,true,true,false,false,true,true], '5': [true,false,true,true,false,true,true],
  '6': [true,false,true,true,true,true,true], '7': [true,true,true,false,false,false,false],
  '8': [true,true,true,true,true,true,true], '9': [true,true,true,true,false,true,true],
};

const segPolys: [number,number][][] = [
  [[14,4],[58,4],[50,12],[22,12]],
  [[68,14],[60,18],[60,50],[68,54]],
  [[68,66],[60,70],[60,102],[68,106]],
  [[22,108],[50,108],[58,116],[14,116]],
  [[4,66],[12,70],[12,102],[4,106]],
  [[4,14],[12,18],[12,50],[4,54]],
  [[10,60],[18,56],[54,56],[62,60],[54,64],[18,64]],
];

function DigitSVG({ d, color, width = 42, height = 68 }: { d: string; color: string; width?: number; height?: number }) {
  const s = segs[d] || segs['0'];
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

function ColonSVG({ color, width = 16, height = 68 }: { color: string; width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 120" style={{ display: 'block' }}>
      <rect x={8} y={38} width={8} height={8} rx={4} ry={4} fill={color}
        style={{ filter: `drop-shadow(0 0 5px ${color}90) drop-shadow(0 0 12px ${color}50)`, transition: 'fill 150ms ease-out' }} />
      <rect x={8} y={74} width={8} height={8} rx={4} ry={4} fill={color}
        style={{ filter: `drop-shadow(0 0 5px ${color}90) drop-shadow(0 0 12px ${color}50)`, transition: 'fill 150ms ease-out' }} />
    </svg>
  );
}

export default function FloatingTimer() {
  const { settings } = useApp();
  const [timer, setTimer] = useState<TimerSync>({
    sessionTime: 0, isTimerActive: false, isRest: false,
    sessionType: 'pomodoro', pomodoroTime: 1500, shortBreakTime: 300,
  });
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const lastSyncRef = useRef(Date.now());
  const displayRef = useRef(timer);
  displayRef.current = timer;

  useEffect(() => {
    const unlisten = listen('timer:update', (event: any) => {
      try {
        const data = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
        setTimer({
          sessionTime: data.sessionTime ?? 0,
          isTimerActive: data.isTimerActive ?? false,
          isRest: data.isRest ?? false,
          sessionType: data.sessionType ?? 'pomodoro',
          pomodoroTime: data.pomodoroTime ?? 1500,
          shortBreakTime: data.shortBreakTime ?? 300,
        });
        lastSyncRef.current = Date.now();
      } catch { /* ignore */ }
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  useEffect(() => {
    if (!timer.isTimerActive) return;
    const interval = setInterval(() => {
      const elapsed = Math.round((Date.now() - lastSyncRef.current) / 1000);
      if (elapsed > 0) {
        setTimer(prev => ({ ...prev, sessionTime: displayRef.current.sessionTime + elapsed }));
        lastSyncRef.current = Date.now();
      }
    }, 200);
    return () => clearInterval(interval);
  }, [timer.isTimerActive]);

  const { sessionTime, isRest, sessionType, pomodoroTime, shortBreakTime } = timer;
  let displaySec = sessionTime;
  if (sessionType === 'pomodoro') {
    if (isRest) displaySec = Math.max(0, shortBreakTime - (sessionTime - pomodoroTime));
    else displaySec = Math.max(0, pomodoroTime - sessionTime);
  }
  const timeStr = `${Math.floor(displaySec / 60).toString().padStart(2, '0')}:${(displaySec % 60).toString().padStart(2, '0')}`;
  const isActive = timer.isTimerActive;
  const color = !isActive ? '#6B7280' : (isRest ? (settings.timerBreakColor || '#10B981') : (sessionType === 'chrono' ? (settings.timerChronoColor || '#3B82F6') : (settings.timerFocusColor || '#E11D48')));
  const bgColor = settings.floatingBgColor || '#020203';
  const statusText = !isActive ? 'PAUSADO' : (isRest ? 'DESCANSO' : 'ENFOQUE');

  const toggleAlwaysOnTop = async () => {
    const next = !alwaysOnTop;
    try {
      const win = getCurrentWebviewWindow();
      await win.setAlwaysOnTop(next);
      setAlwaysOnTop(next);
    } catch { /* ignore */ }
  };

  return (
    <div data-tauri-drag-region style={{
      width: '100vw', height: '100vh',
      background: bgColor,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', userSelect: 'none',
      fontFamily: "'Inter Tight', sans-serif",
      gap: 6, cursor: 'grab',
    }}>
      <div data-tauri-drag-region style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2,
      }}>
        <div style={{
          width: 5, height: 5, borderRadius: '50%',
          background: color,
          boxShadow: isActive ? `0 0 6px ${color}` : 'none',
          transition: 'background 200ms',
        }} />
        <span style={{
          fontSize: 10, fontWeight: 700, color, letterSpacing: '0.1em',
          textTransform: 'uppercase', transition: 'color 200ms',
        }}>
          {statusText}
        </span>
      </div>
      <div data-tauri-drag-region style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        {timeStr.split('').map((ch, i) =>
          ch === ':'
            ? <ColonSVG key={i} color={color} />
            : <DigitSVG key={i} d={ch} color={color} />
        )}
      </div>
      <button onClick={toggleAlwaysOnTop}
        style={{
          position: 'absolute', bottom: 4, right: 4,
          background: 'rgba(255,255,255,0.04)', border: 'none',
          color: alwaysOnTop ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)',
          cursor: 'pointer', padding: 3, borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 150ms', lineHeight: 0,
        }}
        title={alwaysOnTop ? 'Siempre al frente (haz clic para cambiar)' : 'Ventana normal (haz clic para cambiar)'}
      >
        {alwaysOnTop ? <Monitor size={10} /> : <MonitorOff size={10} />}
      </button>
    </div>
  );
}
