import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, Pause, Play, Trash2, Maximize2, Square } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { streamChat, AIMessage, AIToolCall } from '../../lib/ai/aiProvider';
import { AI_TOOL_DEFINITIONS, executeToolCall, AppContextActions } from '../../lib/ai/aiTools';
import { buildContextSnapshot } from '../../lib/ai/aiContext';
import { composeSystemPrompt } from '../../lib/ai/aiPrompts';

const MAX_TOOL_ROUNDS = 4;
const LONG_RESPONSE_CHARS = 220;

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(52, 211, 153, ${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}

function shade(hex: string, amt: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return '#34d399';
  const ch = (c: string) => {
    const v = Math.max(0, Math.min(255, parseInt(c, 16) + amt));
    return v.toString(16).padStart(2, '0');
  };
  return `#${ch(m[1])}${ch(m[2])}${ch(m[3])}`;
}

function stripMd(raw: string): string {
  const el = document.createElement('div');
  el.innerHTML = raw || '';
  let t = (el.textContent || el.innerText || '').replace(/[#*_`~>]/g, '').replace(/\s+/g, ' ').trim();
  return t;
}

interface VoiceLiveOverlayProps {
  open: boolean;
  onClose: () => void;
}

export default function VoiceLiveOverlay({ open, onClose }: VoiceLiveOverlayProps) {
  const appCtx = useApp();
  const {
    settings, tasks, notes, courses, tracks, habits, plannedSessions, planEvents,
    dailyStudyTime, weeklyStudyTime, currentTrackId, isPlayingMusic, isTimerActive,
    sessionType, sessionTime, pomodoroSessions,
  } = appCtx;

  const [phase, setPhase] = useState<'idle' | 'listening' | 'processing' | 'responding'>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [paused, setPaused] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [eraseTick, setEraseTick] = useState(0);
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef(0);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => onClose(), 240);
  }, [closing, onClose]);

  const transcriptRef = useRef('');
  const busyRef = useRef(false);
  const pausedRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const historyRef = useRef<AIMessage[]>([]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const abortRef = useRef<AbortController | null>(null);
  const lastSpeechTsRef = useRef(0);

  const appCtxRef = useRef(appCtx);
  appCtxRef.current = appCtx;

  const brainColor = settings.owaBrainColor || '#34d399';
  const brainColorRef = useRef(brainColor);
  brainColorRef.current = brainColor;

  const getContextActions = (): AppContextActions => {
    const a = appCtxRef.current;
    return {
      addTask: a.addTask, updateTask: a.updateTask, deleteTask: a.deleteTask,
      toggleTaskStatus: a.toggleTaskStatus, tasks: a.tasks,
      addNote: a.addNote, updateNote: a.updateNote, deleteNote: a.deleteNote,
      restoreNote: a.restoreNote, permanentlyDeleteNote: a.permanentlyDeleteNote, notes: a.notes,
      addCourse: a.addCourse, updateCourse: a.updateCourse, deleteCourse: a.deleteCourse, courses: a.courses,
      planEvents: a.planEvents, setPlanEvents: a.setPlanEvents,
      addHabit: a.addHabit, updateHabit: a.updateHabit, deleteHabit: a.deleteHabit, habits: a.habits,
      playTrack: a.playTrack, toggleMusicPlayback: a.toggleMusicPlayback, setMusicVolume: a.setMusicVolume,
      setIsPlayingMusic: a.setIsPlayingMusic, tracks: a.tracks, currentTrackId: a.currentTrackId,
      isPlayingMusic: a.isPlayingMusic, musicQueue: a.musicQueue, setMusicQueue: a.setMusicQueue,
      queueSource: a.queueSource, setQueueSource: a.setQueueSource,
      shuffleMode: a.shuffleMode, setShuffleMode: a.setShuffleMode,
      repeatMode: a.repeatMode, setRepeatMode: a.setRepeatMode,
      playlists: a.playlists, addPlaylist: a.addPlaylist, updatePlaylist: a.updatePlaylist,
      deletePlaylist: a.deletePlaylist, toggleTrackFavorite: a.toggleTrackFavorite,
      addTrack: a.addTrack, updateTrack: a.updateTrack, deleteTrack: a.deleteTrack,
      musicVolume: a.musicVolume, searchYouTubeMusic: a.searchYouTubeMusic,
      pipUrl: a.pipUrl, setPipUrl: a.setPipUrl,
      plannedSessions: a.plannedSessions, addPlannedSession: a.addPlannedSession,
      updatePlannedSession: a.updatePlannedSession,
      isTimerActive: a.isTimerActive, sessionType: a.sessionType, sessionTime: a.sessionTime,
      dailyStudyTime: a.dailyStudyTime, pomodoroSessions: a.pomodoroSessions,
      setSessionType: a.setSessionType, setSessionTime: a.setSessionTime, toggleTimer: a.toggleTimer, resetTimer: a.resetTimer,
      setIsTimerActive: a.setIsTimerActive, isRest: a.isRest, setIsRest: a.setIsRest,
      setNavigateTo: a.setNavigateTo, settings: a.settings, updateSettings: a.updateSettings,
      addNotification: a.addNotification,
    };
  };

  const startMic = useCallback(async () => {
    try {
      const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = navigator.language || 'es-ES';
        rec.onresult = (e: any) => {
          const txt = Array.from(e.results)
            .map((r: any) => r[0].transcript)
            .join(' ')
            .trim();
          if (txt) {
            lastSpeechTsRef.current = Date.now();
            transcriptRef.current = txt;
            setTranscript(txt);
          }
        };
        rec.onend = () => {
          if (!busyRef.current && !pausedRef.current && open) {
            try { rec.start(); } catch {}
          }
        };
        rec.onerror = () => {
          try { rec.stop(); } catch {}
        };
        recognitionRef.current = rec;
        try { rec.start(); } catch {}
      }
    } catch {}

    setPhase('listening');
  }, [open]);

  const stopMic = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.onend = null; recognitionRef.current.stop(); } catch {}
    }
    recognitionRef.current = null;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback((text: string) => {
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(stripMd(text).slice(0, 900));
      u.lang = 'es-ES';
      u.rate = 1.02;
      window.speechSynthesis.speak(u);
    } catch {}
  }, []);

  const sendTurn = useCallback(async (text: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase('processing');
    setResponse('');
    setErrorMsg('');
    transcriptRef.current = '';
    setTranscript('');
    lastSpeechTsRef.current = 0;
    let abortedFlag = false;
    try {
      const a = appCtxRef.current;
      const apiKey = (a.settings.owaBrainApiKey || '').trim();
      const baseUrl = (a.settings.owaBrainBaseUrl || '').trim() || undefined;
      const model = a.settings.owaBrainModel || 'big-pickle';
      const ctx = getContextActions();
      const selectedCourseId = (() => {
        try { return localStorage.getItem('owa_selected_course_id'); } catch { return null; }
      })();
      const snapshot = buildContextSnapshot({
        currentView: 'voz',
        tasks: ctx.tasks, notes: ctx.notes, courses: ctx.courses, tracks: ctx.tracks,
        habits: ctx.habits, plannedSessions: ctx.plannedSessions, events: ctx.planEvents,
        weeklyStudyTime: a.weeklyStudyTime,
        settings: { userName: a.settings.userName, pomodoroTime: a.settings.pomodoroTime },
        currentTrackId: ctx.currentTrackId, isPlayingMusic: ctx.isPlayingMusic,
        isTimerActive: ctx.isTimerActive, sessionType: ctx.sessionType,
        sessionTime: ctx.sessionTime, dailyStudyTime: ctx.dailyStudyTime,
        pomodoroSessions: ctx.pomodoroSessions,
        selectedCourseId,
      });
      const system = composeSystemPrompt(snapshot, false, {
        providerId: a.settings.owaBrainProvider, providerName: a.settings.owaBrainProvider,
        modelName: model, vision: false,
      });
      const history = historyRef.current.slice(-8);
      const runningMessages: AIMessage[] = [
        { role: 'system', content: system } as AIMessage,
        ...history,
        { role: 'user', content: text } as AIMessage,
      ];
      const controller = new AbortController();
      abortRef.current = controller;
      let accumulatedContent = '';
      let accumulatedReasoning = '';
      const roundToolMessages: AIMessage[] = [];

      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        if (controller.signal.aborted) { abortedFlag = true; break; }
        const stream = streamChat(
          { apiKey, model, baseUrl, temperature: 0.6, signal: controller.signal },
          runningMessages, AI_TOOL_DEFINITIONS
        );
        const toolCallsThisRound: AIToolCall[] = [];
        let roundReasoning = '';
        let hadError = false;
        for await (const chunk of stream) {
          if (chunk.type === 'aborted') { abortedFlag = true; break; }
          if (chunk.type === 'text' && chunk.text) {
            accumulatedContent += chunk.text;
            setResponse(accumulatedContent);
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            toolCallsThisRound.push(chunk.toolCall);
          } else if (chunk.type === 'done' && chunk.reasoning) {
            roundReasoning = chunk.reasoning;
          } else if (chunk.type === 'error' && chunk.error) {
            hadError = true;
          }
        }
        if (abortedFlag) break;
        if (roundReasoning) accumulatedReasoning = roundReasoning;
        if (toolCallsThisRound.length === 0) {
          if (hadError && !accumulatedContent && !accumulatedReasoning) {
            setErrorMsg('Hubo un problema con el motor de IA. Inténtalo de nuevo.');
          }
          break;
        }
        for (const tc of toolCallsThisRound) {
          if (controller.signal.aborted) { abortedFlag = true; break; }
          const result = await Promise.race([
            executeToolCall(tc.function.name, tc.function.arguments, getContextActions()),
            new Promise<{ success: false; message: string }>(resolve =>
              setTimeout(() => resolve({ success: false, message: 'La herramienta tardó demasiado.' }), 40000)
            ),
          ]);
          const assistantToolMsg = {
            role: 'assistant',
            content: null,
            tool_calls: [tc],
            reasoning_content: roundReasoning || undefined,
          } as AIMessage;
          const toolResultMsg = {
            role: 'tool',
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify(result),
          } as AIMessage;
          runningMessages.push(assistantToolMsg);
          runningMessages.push(toolResultMsg);
          if (!abortedFlag) roundToolMessages.push(assistantToolMsg, toolResultMsg);
        }
        if (controller.signal.aborted) { abortedFlag = true; break; }
        if (round === MAX_TOOL_ROUNDS) break;
      }
      abortRef.current = null;

      const answer = (accumulatedContent || accumulatedReasoning || (abortedFlag ? 'Respuesta detenida.' : 'Hecho.')).trim();
      setResponse(answer);
      setPhase('responding');
      historyRef.current = [
        ...historyRef.current,
        { role: 'user', content: text } as AIMessage,
        ...roundToolMessages,
        { role: 'assistant', content: answer } as AIMessage,
      ].slice(-20);
      if (!abortedFlag) {
        speak(answer);
        if (answer.length > LONG_RESPONSE_CHARS) {
          window.dispatchEvent(new CustomEvent('owa-open-brain'));
          window.dispatchEvent(new CustomEvent('owa-brain-voice-message', { detail: { text: answer } }));
        }
      }
      setTimeout(() => setPhase('listening'), abortedFlag ? 400 : 1800);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setPhase('listening');
    } finally {
      abortRef.current = null;
      busyRef.current = false;
      if (!pausedRef.current && open) {
        const rec = recognitionRef.current;
        if (rec) { try { rec.start(); } catch {} }
      }
    }
  }, [speak, open]);

  useEffect(() => {
    if (!open) return;
    startMic();
    return () => stopMic();
  }, [open, startMic, stopMic]);

  useEffect(() => {
    if (!open) return;
    const iv = window.setInterval(() => {
      if (busyRef.current || pausedRef.current) return;
      if (phaseRef.current !== 'listening') return;
      const t = transcriptRef.current.trim();
      if (!t) return;
      if (Date.now() - lastSpeechTsRef.current >= 1700) {
        sendTurn(t);
      }
    }, 250);
    return () => window.clearInterval(iv);
  }, [open, sendTurn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.code === 'KeyA' && open) {
        e.preventDefault();
        requestClose();
      }
      if (e.key === 'Enter' && !e.repeat && open) {
        const t = transcriptRef.current.trim();
        if (t && !busyRef.current && !pausedRef.current) {
          e.preventDefault();
          sendTurn(t);
        }
      }
      if (e.key === 'Escape' && open) requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, requestClose, sendTurn]);

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  if (!open && !closing) return null;

  const togglePause = () => {
    if (paused) {
      pausedRef.current = false;
      setPaused(false);
      setPhase('listening');
      const rec = recognitionRef.current;
      if (rec) { try { rec.start(); } catch {} }
    } else {
      pausedRef.current = true;
      setPaused(true);
      setPhase('idle');
      const rec = recognitionRef.current;
      if (rec) { try { rec.stop(); } catch {} }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }
  };

  const erase = () => {
    transcriptRef.current = '';
    setTranscript('');
    setResponse('');
    setErrorMsg('');
    lastSpeechTsRef.current = 0;
    setEraseTick(t => t + 1);
  };

  const canSend = transcriptRef.current.trim().length > 0 && !busyRef.current && !pausedRef.current;
  const longResponse = response.length > LONG_RESPONSE_CHARS;
  const shownTranscript = transcript.length > 170 ? '…' + transcript.slice(-170) : transcript;

  const aura = (
    <div
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 170,
        zIndex: 99999, pointerEvents: 'none', overflow: 'visible',
        animation: closing ? 'voiceLiveOut 240ms ease forwards' : 'voiceLiveIn 300ms ease',
      }}
    >
      <div
        style={{
          position: 'absolute', left: '50%', bottom: -20, transform: 'translateX(-50%)',
          width: 440, height: 130, borderRadius: '50%',
          background: `radial-gradient(closest-side, ${hexToRgba(brainColor, 0.14)}, transparent 72%)`,
          filter: 'blur(24px)',
        }}
      />
    </div>
  );

  const panel = (
    <div
      style={{
        position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)',
        zIndex: 100000, width: 'min(92vw, 560px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        animation: closing ? 'voiceLiveOutCenter 240ms ease forwards' : 'voiceLiveInCenter 300ms ease',
      }}
    >
      {errorMsg && (
        <div style={{ fontSize: 11.5, color: '#f87171', textAlign: 'center', background: 'rgba(4,5,9,0.5)', borderRadius: 8, padding: '5px 12px' }}>{errorMsg}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={togglePause}
          title={paused ? 'Reanudar micrófono' : 'Pausar micrófono'}
          style={{
            width: 42, height: 42, borderRadius: 13,
            background: paused ? hexToRgba(brainColor, 0.16) : 'rgba(255,255,255,0.05)',
            border: `1px solid ${paused ? hexToRgba(brainColor, 0.45) : 'var(--border-soft)'}`,
            color: paused ? brainColor : 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 150ms',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          {paused ? <Play size={15} /> : <Pause size={15} />}
        </button>
        <button
          onClick={erase}
          title="Borrar texto"
          style={{
            width: 42, height: 42, borderRadius: 13,
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-soft)',
            color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 150ms',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-soft)'; }}
        >
          <Trash2 size={14} />
        </button>
        {phase === 'processing' && (
          <button
            onClick={() => abortRef.current?.abort()}
            title="Detener respuesta"
            style={{
              width: 42, height: 42, borderRadius: 13,
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.40)',
              color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 150ms',
              backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.22)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.65)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.40)'; }}
          >
            <Square size={13} />
          </button>
        )}
        <button
          onClick={() => { const t = transcriptRef.current.trim(); if (t && !busyRef.current && !pausedRef.current) sendTurn(t); }}
          title="Enviar (Enter)"
          disabled={!canSend}
          style={{
            width: 42, height: 42, borderRadius: 13,
            background: `linear-gradient(135deg, ${brainColor}, ${shade(brainColor, -45)})`,
            border: 'none',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: canSend ? 'pointer' : 'not-allowed',
            opacity: canSend ? 1 : 0.45,
            boxShadow: canSend ? `0 6px 20px ${hexToRgba(brainColor, 0.4)}` : 'none',
            transition: 'all 150ms',
          }}
          onMouseEnter={e => { if (canSend) e.currentTarget.style.filter = 'brightness(1.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );

  const showResponse = response && (phase === 'responding' || !transcript);

  const transcriptTop = (
    <div
      key={`${eraseTick}-${showResponse ? 'resp' : 'trans'}`}
      style={{
        position: 'fixed', top: 'min(12vh, 110px)', left: '50%', transform: 'translateX(-50%)',
        zIndex: 100000, width: 'min(92vw, 880px)', textAlign: 'center', pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        animation: closing ? 'voiceLiveOutCenter 240ms ease forwards' : 'voiceLiveInCenter 350ms ease',
      }}
    >
      <div
        style={{
          fontSize: showResponse ? 38 : 31,
          fontWeight: 300,
          lineHeight: showResponse ? 1.32 : 1.4,
          color: showResponse || transcript ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontFamily: "'Inter Tight', sans-serif",
          display: '-webkit-box', WebkitLineClamp: showResponse ? 3 : 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', textOverflow: 'ellipsis',
          textShadow: '0 2px 20px rgba(0,0,0,0.65)',
        }}
      >
        {showResponse
          ? (response.length > 260 ? stripMd(response).slice(0, 260) + '…' : stripMd(response))
          : (shownTranscript || (phase === 'processing' ? 'Procesando tu petición…' : phase === 'responding' ? 'Charvis responde…' : 'Habla ahora…'))}
        {showResponse && phase === 'responding' && (
          <span
            style={{
              display: 'inline-block', width: 2.5, height: '1.02em', marginLeft: 3,
              verticalAlign: '-0.12em', background: brainColor, borderRadius: 1,
              animation: 'voiceCaretBlink 0.85s step-end infinite',
            }}
          />
        )}
      </div>
      {showResponse && longResponse && (
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('owa-open-brain'))}
          title="Abrir la respuesta completa en Charvis"
          style={{
            pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: brainColor, background: hexToRgba(brainColor, 0.10),
            border: `1px solid ${hexToRgba(brainColor, 0.35)}`, borderRadius: 999,
            padding: '8px 16px', cursor: 'pointer',
            boxShadow: `0 4px 16px rgba(0,0,0,0.25), 0 0 20px ${hexToRgba(brainColor, 0.15)}`,
            transition: 'all 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = hexToRgba(brainColor, 0.18); }}
          onMouseLeave={e => { e.currentTarget.style.background = hexToRgba(brainColor, 0.10); }}
        >
          <Maximize2 size={11} />
          Ver respuesta completa
        </button>
      )}
    </div>
  );

  return createPortal(
    <>
      {aura}
      {transcriptTop}
      {panel}
    </>,
    document.body
  );
}