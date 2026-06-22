import { useState, useEffect, useRef } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Coffee } from 'lucide-react';
import { DigitSVG, ColonSVG } from './LEDDigits';
import { ANIMATIONS } from './FloatingAnimations';

const FONTS: Record<string, { family: string; name: string }> = {
  led: { family: "'Share Tech Mono', monospace", name: 'LED' },
  outfit: { family: "'Outfit', sans-serif", name: 'Outfit' },
  'dm-sans': { family: "'DM Sans', sans-serif", name: 'DM Sans' },
  playfair: { family: "'Playfair Display', serif", name: 'Playfair' },
  space: { family: "'Space Grotesk', sans-serif", name: 'Space Grotesk' },
  jakarta: { family: "'Plus Jakarta Sans', sans-serif", name: 'Jakarta' },
  sora: { family: "'Sora', sans-serif", name: 'Sora' },
  inter: { family: "'Inter', sans-serif", name: 'Inter' },
};

interface TimerSync {
  sessionTime: number;
  isTimerActive: boolean;
  isRest: boolean;
  sessionType: string;
  pomodoroTime: number;
  shortBreakTime: number;
  longBreakTime?: number;
  restStartTime?: number;
  pomodoroSessions?: number;
  pomodoroGoal?: number;
  pomodoroComplete?: boolean;
}

interface SettingsSync {
  floatingBgMode?: string;
  floatingBgColor?: string;
  floatingFont?: string;
  floatingHideInFocus?: boolean;
  floatingAnimationType?: string;
  timerFocusColor?: string;
  timerBreakColor?: string;
  timerLongBreakColor?: string;
  timerChronoColor?: string;
  appBgColor?: string;
  accentColor?: string;
}

export default function FloatingTimer() {
  const [time, setTime] = useState('00:00');
  const [color, setColor] = useState('#E11D48');
  const [label, setLabel] = useState('Pausado');
  const [bgColor, setBgColor] = useState('#020203');
  const [fontKey, setFontKey] = useState('led');
  const [hideInFocus, setHideInFocus] = useState(false);
  const [animType, setAnimType] = useState('plant');
  const [decorated, setDecorated] = useState(true);
  const decoratedRef = useRef(true);
  const [showDecoBtn, setShowDecoBtn] = useState(false);
  const customColors = useRef({ focus: '#E11D48', brk: '#10B981', longBrk: '#F59E0B', chrono: '#3B82F6' });
  const lastSync = useRef<TimerSync & { ts: number }>({
    sessionTime: 0, isTimerActive: false, isRest: false,
    sessionType: 'pomodoro', pomodoroTime: 1500, shortBreakTime: 300, ts: 0,
  });

  function applySettings(p: SettingsSync) {
    const bgMode = p.floatingBgMode || 'custom';
    setBgColor(bgMode === 'app' ? (p.appBgColor || '#020203') : (p.floatingBgColor || '#020203'));
    setFontKey(p.floatingFont && FONTS[p.floatingFont] ? p.floatingFont : 'led');
    setHideInFocus(!!p.floatingHideInFocus);
    if (p.floatingAnimationType && ANIMATIONS[p.floatingAnimationType]) {
      setAnimType(p.floatingAnimationType);
    }
    customColors.current = {
      focus: p.timerFocusColor || '#E11D48',
      brk: p.timerBreakColor || '#10B981',
      longBrk: p.timerLongBreakColor || '#F59E0B',
      chrono: p.timerChronoColor || '#3B82F6',
    };
    const s = lastSync.current;
    const cc = customColors.current;
    const isLongBreak = s.isRest && s.pomodoroGoal && s.pomodoroSessions && s.pomodoroSessions > 0 && s.pomodoroSessions % s.pomodoroGoal === 0;
    setColor(s.isRest ? (isLongBreak ? cc.longBrk : cc.brk) : s.sessionType === 'pomodoro' ? cc.focus : cc.chrono);
  }

  useEffect(() => {
    const bg = bgColor;
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
  }, [bgColor]);

  useEffect(() => {
    const unlisten1 = listen('timer:sync', (e: any) => {
      try {
        const p: TimerSync = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
        lastSync.current = { ...p, ts: Date.now() };
        updateDisplay();
        updateLabel(p);
        updateColor(p);
      } catch {}
    });
    const unlisten2 = listen('settings:sync', (e: any) => {
      try {
        const p: SettingsSync = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
        applySettings(p);
      } catch {}
    });
    emit('settings:sync:request').catch(() => {});
    emit('timer:sync:request').catch(() => {});
    const iv = setInterval(updateDisplay, 500);
    return () => {
      clearInterval(iv);
      unlisten1.then(fn => fn());
      unlisten2.then(fn => fn());
    };
  }, []);

  function updateDisplay() {
    const s = lastSync.current;
    const elapsed = s.sessionTime + (s.isTimerActive ? Math.floor((Date.now() - s.ts) / 1000) : 0);
    let display: number;
    if (s.pomodoroComplete && !s.isRest) {
      display = 0;
    } else if (s.sessionType === 'pomodoro' && !s.isRest) {
      display = Math.max(0, (s.pomodoroTime || 1500) - elapsed);
    } else if (s.isRest) {
      const restElapsed = elapsed - (s.restStartTime ?? s.sessionTime);
      const isLongBreak = s.pomodoroGoal && s.pomodoroSessions && s.pomodoroSessions > 0 && s.pomodoroSessions % s.pomodoroGoal === 0;
      const restDuration = isLongBreak && s.longBreakTime ? s.longBreakTime : (s.shortBreakTime || 300);
      display = Math.max(0, restDuration - restElapsed);
    } else {
      display = elapsed;
    }
    const m = Math.floor(display / 60);
    const sec = display % 60;
    setTime(`${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`);
  }

  function updateLabel(s: TimerSync) {
    if (s.pomodoroComplete && !s.isRest) setLabel('Completado');
    else if (s.isRest) {
      const isLongBreak = s.pomodoroGoal && s.pomodoroSessions && s.pomodoroSessions > 0 && s.pomodoroSessions % s.pomodoroGoal === 0;
      setLabel(isLongBreak ? 'Descanso largo' : 'Descanso');
    } else if (s.isTimerActive) setLabel('Concentrado');
    else setLabel('Pausado');
  }

  function updateColor(s: TimerSync) {
    const cc = customColors.current;
    if (s.pomodoroComplete && !s.isRest) {
      setColor(cc.chrono);
    } else if (s.isRest) {
      const isLongBreak = s.pomodoroGoal && s.pomodoroSessions && s.pomodoroSessions > 0 && s.pomodoroSessions % s.pomodoroGoal === 0;
      setColor(isLongBreak ? cc.longBrk : cc.brk);
    } else if (s.sessionType === 'pomodoro') setColor(cc.focus);
    else setColor(cc.chrono);
  }

  async function toggleDecorations() {
    try {
      const w = getCurrentWindow();
      const next = !decoratedRef.current;
      await w.setDecorations(next);
      decoratedRef.current = next;
      setDecorated(next);
    } catch {}
  }

  async function startDrag(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.closest('.deco-btn')) return;
    try { await getCurrentWindow().startDragging(); } catch {}
  }

  // Show decorations button only when cursor hovers top-right ~50px zone
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const w = window.innerWidth, h = window.innerHeight;
      const near = e.clientX > w - 50 && e.clientY < 50;
      setShowDecoBtn(near);
    }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const isActive = lastSync.current.isTimerActive;
  const isPomodoro = lastSync.current.sessionType === 'pomodoro';
  const hideTime = hideInFocus && isActive;
  const useLed = fontKey === 'led';
  const showAnimation = hideTime && isPomodoro;
  const AnimComponent = showAnimation && animType && ANIMATIONS[animType]
    ? ANIMATIONS[animType].component
    : null;
  const pomodoroComplete = lastSync.current.pomodoroComplete && !lastSync.current.isRest;

  const digits = time.split('');
  const fontInfo = FONTS[fontKey] || FONTS.led;

  return (
    <div
      onMouseDown={startDrag}
      style={{
        width: '100vw', height: '100vh',
        background: bgColor, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'grab', userSelect: 'none', WebkitUserSelect: 'none',
        position: 'relative', gap: 0,
      }}
    >
      <span
        className="deco-btn"
        onClick={(e) => { e.stopPropagation(); toggleDecorations(); }}
        title={decorated ? 'Quitar borde' : 'Restaurar borde'}
        style={{
          position: 'absolute', top: 6, right: 6, zIndex: 20,
          width: 28, height: 28, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#aaa', cursor: 'pointer', lineHeight: 1,
          background: showDecoBtn ? 'rgba(255,255,255,0.1)' : 'transparent',
          border: showDecoBtn ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
          opacity: showDecoBtn ? 1 : 0,
          transition: 'opacity 200ms, background 200ms, border-color 200ms',
          pointerEvents: showDecoBtn ? 'auto' : 'none',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          {decorated
            ? <><rect x="2" y="2" width="12" height="12" rx="1.5" /><line x1="2" y1="5.5" x2="14" y2="5.5" /></>
            : <rect x="1.4" y="1.4" width="13.2" height="13.2" rx="2.5" />
          }
        </svg>
      </span>

      <div style={{ height: 18, display: 'flex', alignItems: 'center', marginTop: -10, marginBottom: 4 }}>
        {!showAnimation && !pomodoroComplete && (
          <span style={{
            fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 9,
            color, letterSpacing: '0.1em', textTransform: 'uppercase',
            opacity: hideTime ? 0 : 0.8, lineHeight: 1,
            transition: 'opacity 300ms',
          }}>
            {hideTime ? '●●●' : label}
          </span>
        )}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
        minHeight: 48,
        opacity: (!pomodoroComplete && hideTime && !showAnimation) ? 0 : 1,
        transition: 'opacity 400ms',
      }}>
        {pomodoroComplete ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Coffee size={14} color={color} />
            </div>
            <span style={{
              fontFamily: fontInfo.family, fontWeight: 350, fontSize: 24,
              color, letterSpacing: '0.01em', lineHeight: 1.3, padding: '0 2px',
              textAlign: 'center',
            }}>
              Te espera un descanso
            </span>
          </div>
        ) : showAnimation && AnimComponent ? (
          <AnimComponent color={color} />
        ) : useLed ? (
          digits.map((ch, i) =>
            ch === ':'
              ? <ColonSVG key={i} color={color} width={11} height={52} />
              : <DigitSVG key={i} d={ch} color={color} width={32} height={52} />
          )
        ) : (
          <span style={{
            fontFamily: fontInfo.family, fontWeight: 300, fontSize: 48,
            color, letterSpacing: '0.02em', lineHeight: 1, padding: '0 2px',
          }}>
            {time}
          </span>
        )}
      </div>
    </div>
  );
}
