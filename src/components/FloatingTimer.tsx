import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { X, Square } from 'lucide-react';
import { useApp } from '../store/AppContext';

interface TimerState {
  sessionTime: number;
  isTimerActive: boolean;
  activeTaskId: string | null;
  isRest: boolean;
  sessionType: 'pomodoro' | 'chrono';
  pomodoroTime: number;
  shortBreakTime: number;
}

// 7-segment digital configurations
const segs: Record<string, boolean[]> = {
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

const segPolys: [number, number][][] = [
  [[14, 4], [58, 4], [50, 12], [22, 12]], // A (Top)
  [[68, 14], [60, 18], [60, 50], [68, 54]], // B (Top-Right)
  [[68, 66], [60, 70], [60, 102], [68, 106]], // C (Bottom-Right)
  [[22, 108], [50, 108], [58, 116], [14, 116]], // D (Bottom)
  [[4, 66], [12, 70], [12, 102], [4, 106]], // E (Bottom-Left)
  [[4, 14], [12, 18], [12, 50], [4, 54]], // F (Top-Left)
  [[10, 60], [18, 56], [54, 56], [62, 60], [54, 64], [18, 64]], // G (Middle)
];

function DigitSVG({ d, color, width = 32, height = 52 }: { d: string; color: string; width?: number; height?: number }) {
  const s = segs[d] || segs['0'];
  const pts = (poly: [number, number][]) => poly.map(p => p.join(',')).join(' ');
  return (
    <svg width={width} height={height} viewBox="0 0 72 120" style={{ display: 'block' }}>
      {segPolys.map((poly, i) => (
        <polygon
          key={i}
          points={pts(poly)}
          fill={s[i] ? color : 'rgba(255, 255, 255, 0.015)'}
          style={{
            transition: 'fill 150ms cubic-bezier(0.4, 0, 0.2, 1)',
            filter: s[i] ? `drop-shadow(0 0 3px ${color}70) drop-shadow(0 0 8px ${color}35)` : 'none',
          }}
        />
      ))}
    </svg>
  );
}

function ColonSVG({ color, width = 12, height = 52 }: { color: string; width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 120" style={{ display: 'block' }}>
      <rect
        x={8}
        y={38}
        width={8}
        height={8}
        rx={4}
        ry={4}
        fill={color}
        style={{
          filter: `drop-shadow(0 0 3px ${color}70) drop-shadow(0 0 8px ${color}35)`,
          transition: 'fill 150ms ease-out',
        }}
      />
      <rect
        x={8}
        y={74}
        width={8}
        height={8}
        rx={4}
        ry={4}
        fill={color}
        style={{
          filter: `drop-shadow(0 0 3px ${color}70) drop-shadow(0 0 8px ${color}35)`,
          transition: 'fill 150ms ease-out',
        }}
      />
    </svg>
  );
}

function LEDTime({ time, color }: { time: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      {time.split('').map((ch, i) =>
        ch === ':' ? (
          <ColonSVG key={i} color={color} />
        ) : (
          <DigitSVG key={i} d={ch} color={color} />
        )
      )}
    </div>
  );
}

export default function FloatingTimer() {
  const { tasks, isTimerActive: contextActive, sessionTime: contextTime, activeTaskId: contextTaskId, settings, isRest: contextRest, sessionType: contextType } = useApp();
  
  const [timerState, setTimerState] = useState<TimerState>({
    sessionTime: contextTime,
    isTimerActive: contextActive,
    activeTaskId: contextTaskId,
    isRest: contextRest,
    sessionType: contextType,
    pomodoroTime: settings.pomodoroTime ?? 1500,
    shortBreakTime: settings.shortBreakTime ?? 300,
  });

  const [isDecorated, setIsDecorated] = useState(true);

  // Sync with main app store changes
  useEffect(() => {
    setTimerState({
      sessionTime: contextTime,
      isTimerActive: contextActive,
      activeTaskId: contextTaskId,
      isRest: contextRest,
      sessionType: contextType,
      pomodoroTime: settings.pomodoroTime ?? 1500,
      shortBreakTime: settings.shortBreakTime ?? 300,
    });
  }, [contextTime, contextActive, contextTaskId, contextRest, contextType, settings.pomodoroTime, settings.shortBreakTime]);

  // Listen to IPC events from main window via Rust router
  useEffect(() => {
    const unlisten = listen('timer:update', (event: any) => {
      try {
        const data = JSON.parse(event.payload as string) as TimerState;
        setTimerState(data);
      } catch {
        const data = event.payload as TimerState;
        setTimerState(data);
      }
    });
    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  // Dual-drive ticking engine: tick locally when active to prevent any lag, corrected instantly by main window events
  useEffect(() => {
    let interval: number | null = null;
    if (timerState.isTimerActive) {
      interval = window.setInterval(() => {
        setTimerState(prev => ({
          ...prev,
          sessionTime: prev.sessionTime + 1,
        }));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerState.isTimerActive]);

  const activeTask = tasks.find(t => t.id === timerState.activeTaskId);

  // Calculate high-fidelity display countdown or count-up
  const pomodoroTime = timerState.pomodoroTime || settings.pomodoroTime || 1500;
  const shortBreakTime = timerState.shortBreakTime || settings.shortBreakTime || 300;

  let displayTime = 0;
  if (timerState.sessionType === 'pomodoro') {
    if (timerState.isRest) {
      const restElapsed = timerState.sessionTime - pomodoroTime;
      displayTime = Math.max(0, shortBreakTime - restElapsed);
    } else {
      displayTime = Math.max(0, pomodoroTime - timerState.sessionTime);
    }
  } else {
    displayTime = timerState.sessionTime;
  }

  const m = Math.floor(displayTime / 60);
  const s = displayTime % 60;
  const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  const accentHex = settings.accentColor || '#E11D48';
  const color = timerState.isRest
    ? '#10B981' // Descanso (Green/Emerald)
    : timerState.sessionType === 'chrono'
      ? '#3B82F6' // Cronómetro (Blue)
      : accentHex; // Enfoque (Accent Red/Rose)

  const activeLabel = timerState.isRest
    ? 'Descanso'
    : timerState.sessionType === 'chrono'
      ? 'Cronómetro'
      : 'Enfoque';

  const toggleDecorations = async () => {
    const win = getCurrentWindow();
    await win.setDecorations(!isDecorated);
    setIsDecorated(!isDecorated);
  };

  const closeWindow = async () => {
    const win = getCurrentWindow();
    await win.close();
  };

  return (
    <div
      data-tauri-drag-region
      className="container"
      style={{
        width: '100vw',
        height: '100vh',
        background: '#020203',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        userSelect: 'none',
        position: 'relative',
        boxSizing: 'border-box',
        padding: '12px',
        border: !isDecorated ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
        borderRadius: !isDecorated ? '10px' : '0px',
        fontFamily: 'Outfit, Inter, system-ui, sans-serif',
      }}
    >
      {/* Dynamic atmospheric ambient glow behind the digits */}
      <div
        data-tauri-drag-region
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '140px',
          height: '100px',
          background: `radial-gradient(circle, ${color}10 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Elegant minimalist hover overlay */}
      <div className="hover-controls" style={{ zIndex: 10 }}>
        <button
          onClick={toggleDecorations}
          title={isDecorated ? "Ocultar bordes" : "Mostrar bordes"}
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'none',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.4)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 150ms ease, transform 150ms ease',
          }}
        >
          <Square size={13} />
        </button>
        <button
          onClick={closeWindow}
          title="Cerrar timer"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'none',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.4)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 150ms ease, transform 150ms ease',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Main Content Layout */}
      <div
        data-tauri-drag-region
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          zIndex: 2,
        }}
      >
        {/* State label with a micro breathing pulse dot */}
        <div
          data-tauri-drag-region
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: color,
              animation: timerState.isTimerActive ? 'floatPulse 2s ease-in-out infinite' : 'none',
              boxShadow: timerState.isTimerActive ? `0 0 6px ${color}` : 'none',
            }}
          />
          <span
            data-tauri-drag-region
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            {activeLabel}
          </span>
        </div>

        {/* High-Fidelity 7-Segment SVG LED Digital Timer */}
        <div data-tauri-drag-region style={{ cursor: 'grab', display: 'flex', justifyContent: 'center' }}>
          <LEDTime time={timeStr} color={color} />
        </div>

        {/* Muted active task banner (shown only if linked) */}
        <div
          data-tauri-drag-region
          style={{
            height: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            maxWidth: '160px',
          }}
        >
          {activeTask ? (
            <span
              data-tauri-drag-region
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.35)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textAlign: 'center',
              }}
            >
              {activeTask.title}
            </span>
          ) : (
            <span
              data-tauri-drag-region
              style={{
                fontSize: 8,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.15)',
              }}
            >
              Sin tarea activa
            </span>
          )}
        </div>
      </div>

      <style>{`
        @keyframes floatPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        .hover-controls {
          opacity: 0;
          pointer-events: none;
          transition: opacity 250ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .container:hover .hover-controls {
          opacity: 1;
          pointer-events: auto;
        }
        .hover-controls button:hover {
          color: rgba(255, 255, 255, 0.9) !important;
          transform: scale(1.08);
        }
      `}</style>
    </div>
  );
}

