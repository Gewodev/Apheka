import { FLOATING_FONTS } from '../lib/floatingFonts';
import './floating-timer.css';
import { memo, useState, useEffect, useRef } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { DigitSVG, ColonSVG } from './LEDDigits';
import { ANIMATIONS } from './FloatingAnimations';

const FONTS = FLOATING_FONTS;
const TimerDigit=memo(DigitSVG),TimerColon=memo(ColonSVG);

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
  const [closeError, setCloseError] = useState('');
  const closing = useRef(false);
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
    let disposed=false;
    let tick:ReturnType<typeof setTimeout>|null=null;
    const refresh=()=>{
      if(tick!==null){clearTimeout(tick);tick=null;}
      if(disposed)return;
      updateDisplay();
      const s=lastSync.current;
      if(s.isTimerActive&&(!s.pomodoroComplete||s.isRest)&&document.visibilityState==='visible'){
        tick=setTimeout(refresh,1012-((Date.now()-s.ts)%1000));
      }
    };
    const unlisten1 = listen('timer:sync', (e: any) => {
      try {
        const p: TimerSync = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
        lastSync.current = { ...p, ts: Date.now() };
        refresh();
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
    document.addEventListener('visibilitychange',refresh);
    return () => {
      disposed=true;
      if(tick!==null)clearTimeout(tick);
      document.removeEventListener('visibilitychange',refresh);
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

  async function startDrag(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest('.close-btn')) return;
    try { await getCurrentWindow().startDragging(); } catch {}
  }

  async function closeTimer() {
    if (closing.current) return;
    closing.current = true;
    setCloseError('');
    try { await invoke('close_floating_timer'); }
    catch { setCloseError('No se pudo cerrar. Pulsa la X para reintentar.'); }
    finally { closing.current = false; }
  }

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
  const digitWidth=Math.min(26,112/Math.max(1,time.replace(':','').length));
  const fontInfo = FONTS[fontKey] || FONTS.led;

  return (
    <div
      className="floating-timer-surface"
      onMouseDown={startDrag}
      style={{
        width: '100vw', height: '100vh', borderRadius:16, overflow:'hidden',
        background: bgColor, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'grab', userSelect: 'none', WebkitUserSelect: 'none',
        position: 'relative', gap: 4, padding:'14px 10px 10px',boxSizing:'border-box',
      }}
    >
      <button type="button"
        className="close-btn floating-timer-close"
        aria-label="Cerrar timer"
        onMouseDown={e => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); void closeTimer(); }}
        title={closeError || 'Cerrar timer'}
        style={{
          position: 'absolute', top: 6, right: 6, zIndex: 20,
          width: 22, height: 22, borderRadius: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.5)', cursor: 'pointer', lineHeight: 1,
          background: 'transparent',
          border: 'none',
          ...(closeError?{opacity:1}:{}),
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="4" x2="12" y2="12" />
          <line x1="12" y1="4" x2="4" y2="12" />
        </svg>
      </button>
      {closeError && <span role="alert" style={{position:'absolute',bottom:2,left:4,right:4,fontSize:9,color:'#fca5a5',textAlign:'center'}}>{closeError}</span>}

      <div style={{ height:18,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 18px',width:'100%',boxSizing:'border-box',flexShrink:0 }}>
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
        minHeight:48,width:'100%',flexShrink:0,
        opacity: (!pomodoroComplete && hideTime && !showAnimation) ? 0 : 1,
        transition: 'opacity 400ms',
      }}>
        {pomodoroComplete ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 5, padding: '0 8px', textAlign: 'center',
          }}>
            <span style={{
              fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 11,
              color, letterSpacing: '0.01em', lineHeight: 1.3,
            }}>
              Te espera un descanso
            </span>
            <span style={{
              fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 7.5,
              color, opacity: 0.45, letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1,
            }}>
              Completado
            </span>
          </div>
        ) : showAnimation && AnimComponent ? (
          <AnimComponent color={color} />
        ) : useLed ? (
          digits.map((ch, i) =>
            ch === ':'
              ? <TimerColon key={i} color={color} width={8} height={48} />
              : <TimerDigit key={i} d={ch} color={color} width={digitWidth} height={48} />
          )
        ) : (
          <span style={{
            fontFamily: fontInfo.family, fontWeight: 300, fontSize: 44,
            color, letterSpacing: '0.02em', lineHeight: 1, padding: '0 2px',
          }}>
            {time}
          </span>
        )}
      </div>
    </div>
  );
}
