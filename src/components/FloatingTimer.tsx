import { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { Monitor, MonitorOff, Square, Minus, X } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { DigitSVG, ColonSVG } from './LEDDigits';

interface TimerSync {
  sessionTime: number;
  isTimerActive: boolean;
  isRest: boolean;
  sessionType: 'pomodoro' | 'chrono';
  pomodoroTime: number;
  shortBreakTime: number;
}

export default function FloatingTimer() {
  const { settings } = useApp();
  const [timer, setTimer] = useState<TimerSync>({
    sessionTime: 0, isTimerActive: false, isRest: false,
    sessionType: 'pomodoro', pomodoroTime: 1500, shortBreakTime: 300,
  });
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [showBorder, setShowBorder] = useState(false);
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

  const toggleBorder = async () => {
    const next = !showBorder;
    try {
      await invoke('toggle_floating_timer_border', { show: next });
      setShowBorder(next);
    } catch { /* ignore */ }
  };

  const closeWindow = async () => {
    try {
      await invoke('close_floating_timer');
    } catch { /* ignore */ }
  };

  const btnStyle = (active: boolean, customColor?: string) => ({
    background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.025)',
    border: 'none',
    color: active ? (customColor || 'rgba(255,255,255,0.6)') : 'rgba(255,255,255,0.15)',
    cursor: 'pointer', padding: 4, borderRadius: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 150ms',
    lineHeight: 0,
  } as const);

  return (
    <div data-tauri-drag-region style={{
      width: '100vw', height: '100vh',
      background: bgColor,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', userSelect: 'none',
      fontFamily: "'Inter Tight', sans-serif",
      gap: 6, cursor: 'grab',
    }}>
      {/* Top toolbar — not draggable */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 6px',
      }}>
        <button onClick={toggleBorder}
          style={btnStyle(showBorder)}
          title={showBorder ? 'Ocultar bordes' : 'Mostrar bordes'}
        >
          {showBorder ? <Minus size={11} /> : <Square size={11} />}
        </button>
        <div style={{ display: 'flex', gap: 2 }}>
          <button onClick={closeWindow}
            style={btnStyle(false)}
            title="Cerrar ventana flotante"
          >
            <X size={11} />
          </button>
          <button onClick={toggleAlwaysOnTop}
            style={btnStyle(alwaysOnTop, color)}
            title={alwaysOnTop ? 'Siempre al frente' : 'Ventana normal'}
          >
            {alwaysOnTop ? <Monitor size={11} /> : <MonitorOff size={11} />}
          </button>
        </div>
      </div>

      {/* Status indicator */}
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

      {/* LED digits */}
      <div data-tauri-drag-region style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        {timeStr.split('').map((ch, i) =>
          ch === ':'
            ? <ColonSVG key={i} color={color} />
            : <DigitSVG key={i} d={ch} color={color} />
        )}
      </div>
    </div>
  );
}
