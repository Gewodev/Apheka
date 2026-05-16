import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Play, Pause, X, Square, Minus } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { PhysicalPosition } from '@tauri-apps/api/window';
import { useApp } from '../store/AppContext';

interface TimerState {
  sessionTime: number;
  isTimerActive: boolean;
  activeTaskId: string | null;
  isRest: boolean;
}

export default function FloatingTimer() {
  const { tasks, toggleTimer: contextToggleTimer, isTimerActive: contextActive, sessionTime: contextTime, activeTaskId: contextTaskId } = useApp();
  const [timerState, setTimerState] = useState<TimerState>({
    sessionTime: contextTime,
    isTimerActive: contextActive,
    activeTaskId: contextTaskId,
    isRest: false,
  });
  const [hasBorder, setHasBorder] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const stateRef = useRef(timerState);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    stateRef.current = timerState;
  }, [timerState]);

  const syncToMain = useCallback((state: TimerState) => {
    setTimerState(state);
  }, []);

  useEffect(() => {
    syncToMain({
      sessionTime: contextTime,
      isTimerActive: contextActive,
      activeTaskId: contextTaskId,
      isRest: false,
    });
  }, [contextTime, contextActive, contextTaskId, syncToMain]);

  useEffect(() => {
    const unlisten = listen('timer:update', (event: any) => {
      try {
        const data = JSON.parse(event.payload as string) as TimerState;
        syncToMain(data);
      } catch {
        const data = event.payload as TimerState;
        syncToMain(data);
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [syncToMain]);

  useEffect(() => {
    if (timerState.isTimerActive) {
      intervalRef.current = window.setInterval(() => {
        setTimerState(prev => ({ ...prev, sessionTime: prev.sessionTime + 1 }));
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerState.isTimerActive]);

  const activeTask = tasks.find(t => t.id === timerState.activeTaskId);
  const m = Math.floor(timerState.sessionTime / 60);
  const s = timerState.sessionTime % 60;
  const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  const color = timerState.isRest ? '#10B981' : '#E11D48';

  const handleToggleBorder = async () => {
    const newVal = !hasBorder;
    setHasBorder(newVal);
    try { await invoke('toggle_floating_timer_border', { show: newVal }); } catch (e) { console.error(e); }
  };

  const handleClose = async () => {
    try { await invoke('close_floating_timer'); } catch { getCurrentWindow().close(); }
  };

  const handleToggleTimer = () => {
    contextToggleTimer();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragOffset.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = useCallback(async (e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragOffset.current.x;
    const dy = e.clientY - dragOffset.current.y;
    dragOffset.current = { x: e.clientX, y: e.clientY };
    try {
      const win = getCurrentWindow();
      const pos = await win.outerPosition();
      await win.setPosition(new PhysicalPosition(pos.x + dx, pos.y + dy));
    } catch (err) {
      console.error('Drag error:', err);
    }
  }, [isDragging]);

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'rgba(8, 8, 10, 0.92)',
        border: hasBorder ? `2px solid ${color}` : 'none',
        borderRadius: hasBorder ? 16 : 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#fff',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        cursor: isDragging ? 'grabbing' : 'default',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Colored Indicator Bar */}
      <div
        style={{
          height: 4,
          width: '100%',
          background: color,
          boxShadow: `0 0 12px ${color}80`,
          flexShrink: 0,
        }}
      />

      {/* Timer Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 16px', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: color,
              animation: timerState.isTimerActive ? 'floatPulse 1.5s ease-in-out infinite' : 'none',
              boxShadow: timerState.isTimerActive ? `0 0 8px ${color}` : 'none',
            }}
          />
          <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-secondary)' }}>
            {timerState.isRest ? 'Descanso' : 'Enfoque'}
          </span>
        </div>

        <span
          style={{
            fontSize: 36,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            letterSpacing: '-0.03em',
            textShadow: `0 0 30px ${color}30`,
            fontFamily: 'Outfit, Inter, system-ui, sans-serif',
          }}
        >
          {timeStr}
        </span>

        <span
          style={{
            fontSize: 10,
            color: 'var(--text-tertiary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
          }}
        >
          {activeTask ? activeTask.title : 'Sesión libre'}
        </span>
      </div>

      {/* Controls */}
      <div style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 6 }}>
        <button
          onClick={handleToggleBorder}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
          title={hasBorder ? 'Ocultar borde' : 'Mostrar borde'}
        >
          {hasBorder ? <Minus size={12} /> : <Square size={12} />}
        </button>
        <button
          onClick={handleToggleTimer}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            cursor: 'pointer',
            boxShadow: `0 4px 16px ${color}40`,
          }}
        >
          {timerState.isTimerActive ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" style={{ marginLeft: 2 }} />}
        </button>
        <button
          onClick={handleClose}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
          title="Cerrar"
        >
          <X size={12} />
        </button>
      </div>

      <style>{`
        @keyframes floatPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
