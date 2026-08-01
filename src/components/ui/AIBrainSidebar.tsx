import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Brain, X, Send, Sparkles, Trash2, Bot, User, Zap,
  CheckCircle2, AlertCircle, RefreshCw, ChevronRight, Music, CheckSquare, Calendar, Globe, BookOpen, Layers
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { streamChat, AI_MODELS, DEFAULT_MODEL, type AIMessage, type AIToolCall } from '../../lib/ai/aiProvider';
import { buildContextSnapshot } from '../../lib/ai/aiContext';
import { composeSystemPrompt } from '../../lib/ai/aiPrompts';
import { AI_TOOL_DEFINITIONS, executeToolCall, type AppContextActions } from '../../lib/ai/aiTools';

interface AIBrainSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatItem {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: { name: string; args: string; result?: string; status: 'pending' | 'success' | 'error' }[];
  timestamp: string;
  isStreaming?: boolean;
}

const STORAGE_KEY_MESSAGES = 'owa_brain_messages_v1';

export default function AIBrainSidebar({ isOpen, onClose }: AIBrainSidebarProps) {
  const appCtx = useApp();
  const { settings, updateSettings, tasks, notes, courses, tracks, habits, plannedSessions, isTimerActive, sessionType, sessionTime, dailyStudyTime, pomodoroSessions, currentTrackId, isPlayingMusic } = appCtx;

  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeModel, setActiveModel] = useState<string>(() => settings.owaBrainModel || DEFAULT_MODEL);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MESSAGES);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: `¡Hola, **${settings.userName || 'Estudiante'}**! Soy **Owa Brain**, el centro de control agéntico de OWA Studio.\n\nPuedo controlar toda tu aplicación: crear tareas, planificar sesiones, poner música, buscar en tus notas o consultar en internet.\n\n¿Qué deseas hacer hoy?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  // Save messages history
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages]);

  // Auto scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages, scrollToBottom]);

  // Context Actions mapping
  const getContextActions = (): AppContextActions => ({
    addTask: appCtx.addTask,
    updateTask: appCtx.updateTask,
    deleteTask: appCtx.deleteTask,
    tasks: appCtx.tasks,
    addNote: appCtx.addNote,
    updateNote: appCtx.updateNote,
    notes: appCtx.notes,
    addCourse: appCtx.addCourse,
    updateCourse: appCtx.updateCourse,
    courses: appCtx.courses,
    addEvent: appCtx.addEvent,
    events: appCtx.events,
    addHabit: appCtx.addHabit,
    updateHabit: appCtx.updateHabit,
    habits: appCtx.habits,
    playTrack: appCtx.playTrack,
    toggleMusicPlayback: appCtx.toggleMusicPlayback,
    setMusicVolume: appCtx.setMusicVolume,
    setIsPlayingMusic: appCtx.setIsPlayingMusic,
    tracks: appCtx.tracks,
    currentTrackId: appCtx.currentTrackId,
    isPlayingMusic: appCtx.isPlayingMusic,
    musicQueue: appCtx.musicQueue,
    setMusicQueue: appCtx.setMusicQueue,
    plannedSessions: appCtx.plannedSessions,
    addPlannedSession: appCtx.addPlannedSession,
    updatePlannedSession: appCtx.updatePlannedSession,
    deletePlannedSession: appCtx.deletePlannedSession,
    isTimerActive: appCtx.isTimerActive,
    sessionType: appCtx.sessionType,
    sessionTime: appCtx.sessionTime,
    dailyStudyTime: appCtx.dailyStudyTime,
    pomodoroSessions: appCtx.pomodoroSessions,
    setSessionType: appCtx.setSessionType,
    toggleTimer: appCtx.toggleTimer,
    setNavigateTo: appCtx.setNavigateTo,
    settings: appCtx.settings,
  });

  const handleSendMessage = async (customPrompt?: string) => {
    const userText = (customPrompt || input).trim();
    if (!userText || isGenerating) return;

    if (!customPrompt) setInput('');

    const userMsgId = `user_${Date.now()}`;
    const assistantMsgId = `asst_${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newUserMsg: ChatItem = {
      id: userMsgId,
      role: 'user',
      content: userText,
      timestamp,
    };

    const newAsstMsg: ChatItem = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp,
      isStreaming: true,
    };

    setMessages(prev => [...prev, newUserMsg, newAsstMsg]);
    setIsGenerating(true);

    try {
      // 1. Build app snapshot
      const snapshot = buildContextSnapshot({
        currentView: 'app',
        tasks,
        notes,
        courses,
        tracks,
        habits,
        plannedSessions,
        settings,
        currentTrackId,
        isPlayingMusic,
        isTimerActive,
        sessionType,
        sessionTime,
        dailyStudyTime,
        pomodoroSessions,
      });

      // 2. Compose dynamic system prompt
      const systemPrompt = composeSystemPrompt(snapshot);

      // 3. Prepare AI message payload
      const apiMessages: AIMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(-10)
          .map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        { role: 'user', content: userText },
      ];

      const apiKey = settings.owaBrainApiKey || 'sk-g01wCU9bMt2jF29dcyumLGTdYLgYTlBbbh1fdzfFxirbYzEIg4yw51QAMvuXYaHl';
      const baseUrl = settings.owaBrainBaseUrl || 'https://openrouter.ai/api/v1';

      // Stream call
      const stream = streamChat(
        {
          apiKey,
          model: activeModel,
          baseUrl,
          temperature: 0.6,
        },
        apiMessages,
        AI_TOOL_DEFINITIONS
      );

      let accumulatedContent = '';
      const toolCallsExecuted: AIToolCall[] = [];

      for await (const chunk of stream) {
        if (chunk.type === 'text' && chunk.text) {
          accumulatedContent += chunk.text;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, content: accumulatedContent }
                : m
            )
          );
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          toolCallsExecuted.push(chunk.toolCall);
        } else if (chunk.type === 'error') {
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, content: accumulatedContent || `⚠️ Error: ${chunk.error}`, isStreaming: false }
                : m
            )
          );
        }
      }

      // Handle tool calls if any were requested
      if (toolCallsExecuted.length > 0) {
        const toolStatusList: NonNullable<ChatItem['toolCalls']> = [];
        const toolResultMessages: AIMessage[] = [...apiMessages];

        for (const tc of toolCallsExecuted) {
          const result = await executeToolCall(
            tc.function.name,
            tc.function.arguments,
            getContextActions()
          );

          toolStatusList.push({
            name: tc.function.name,
            args: tc.function.arguments,
            result: result.message,
            status: result.success ? 'success' : 'error',
          });

          // Add to tool call results
          toolResultMessages.push({
            role: 'assistant',
            content: null,
            tool_calls: [tc],
          });
          toolResultMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify(result),
          });
        }

        // Display executed tools badge in assistant message
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsgId
              ? { ...m, toolCalls: toolStatusList }
              : m
          )
        );

        // Perform second completion call so model gives final summary after tool execution
        const secondStream = streamChat(
          {
            apiKey,
            model: activeModel,
            baseUrl,
            temperature: 0.6,
          },
          toolResultMessages
        );

        for await (const chunk of secondStream) {
          if (chunk.type === 'text' && chunk.text) {
            accumulatedContent += chunk.text;
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMsgId
                  ? { ...m, content: accumulatedContent }
                  : m
              )
            );
          }
        }
      }

      setMessages(prev =>
        prev.map(m => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m))
      );
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: `⚠️ Hubo un problema conectando con el motor de IA: ${
                  err instanceof Error ? err.message : String(err)
                }`,
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearHistory = () => {
    const welcomeMsg: ChatItem = {
      id: 'welcome',
      role: 'assistant',
      content: `¡Historial limpiado! **Owa Brain** listo para asistirte en tus tareas y estudio.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([welcomeMsg]);
    try {
      localStorage.removeItem(STORAGE_KEY_MESSAGES);
    } catch {}
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '420px',
        maxWidth: '100vw',
        zIndex: 99990,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(10, 10, 15, 0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '-12px 0 36px rgba(0, 0, 0, 0.5)',
        transition: 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        color: 'var(--text-primary, #fff)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* ─── Header ─── */}
      <div
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(255, 255, 255, 0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(225, 29, 72, 0.25))',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8',
              boxShadow: '0 0 16px rgba(99, 102, 241, 0.3)',
            }}
          >
            <Brain size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Owa Brain</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 6,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399' }} />
                Jarvis OS
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.45)', display: 'block', marginTop: 1 }}>
              Atajo: <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>Alt + Q</kbd>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleClearHistory}
            title="Limpiar chat"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.45)',
              padding: 6,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.45)')}
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              padding: 6,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)')}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ─── Model Selector bar ─── */}
      <div
        style={{
          padding: '8px 16px',
          background: 'rgba(0, 0, 0, 0.2)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={12} style={{ color: '#818cf8' }} /> Motor de IA:
        </span>
        <select
          value={activeModel}
          onChange={e => {
            setActiveModel(e.target.value);
            updateSettings({ owaBrainModel: e.target.value });
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 6,
            color: '#fff',
            fontSize: 11,
            padding: '3px 8px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {AI_MODELS.map(m => (
            <option key={m.id} value={m.id} style={{ background: '#181824', color: '#fff' }}>
              {m.name} ({m.provider})
            </option>
          ))}
        </select>
      </div>

      {/* ─── Messages List ─── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {/* Sender Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 4,
                fontSize: 10,
                color: 'rgba(255, 255, 255, 0.4)',
                padding: '0 4px',
              }}
            >
              {msg.role === 'user' ? (
                <>
                  <span>Tú</span>
                  <User size={10} />
                </>
              ) : (
                <>
                  <Bot size={10} style={{ color: '#818cf8' }} />
                  <span style={{ color: '#818cf8', fontWeight: 600 }}>Owa Brain</span>
                </>
              )}
              <span>• {msg.timestamp}</span>
            </div>

            {/* Content Container */}
            <div
              style={{
                maxWidth: '90%',
                padding: '12px 14px',
                borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                background:
                  msg.role === 'user'
                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(129, 140, 248, 0.25))'
                    : 'rgba(255, 255, 255, 0.05)',
                border:
                  msg.role === 'user'
                    ? '1px solid rgba(99, 102, 241, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: 13,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                boxShadow: msg.role === 'user' ? '0 4px 14px rgba(99, 102, 241, 0.2)' : 'none',
              }}
            >
              {msg.content}

              {/* Tool Calls execution chips */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {msg.toolCalls.map((tc, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        background:
                          tc.status === 'success'
                            ? 'rgba(16, 185, 129, 0.12)'
                            : 'rgba(239, 68, 68, 0.12)',
                        border:
                          tc.status === 'success'
                            ? '1px solid rgba(16, 185, 129, 0.3)'
                            : '1px solid rgba(239, 68, 68, 0.3)',
                        fontSize: 11,
                        color: tc.status === 'success' ? '#34d399' : '#f87171',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {tc.status === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                      <span style={{ fontWeight: 600 }}>⚡ {tc.name}:</span>
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>{tc.result}</span>
                    </div>
                  ))}
                </div>
              )}

              {msg.isStreaming && !msg.content && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                  <RefreshCw size={12} className="spin-animation" /> Pensando y ejecutando...
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ─── Action Prompt Chips ─── */}
      <div
        style={{
          padding: '8px 14px',
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          background: 'rgba(0,0,0,0.15)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}
        className="no-scrollbar"
      >
        <button
          onClick={() => handleSendMessage('Pon música para estudiar')}
          style={chipStyle}
        >
          <Music size={11} /> Pon música
        </button>
        <button
          onClick={() => handleSendMessage('Crea una tarea urgente de repaso')}
          style={chipStyle}
        >
          <CheckSquare size={11} /> Nueva tarea
        </button>
        <button
          onClick={() => handleSendMessage('Planifica una sesión de estudio hoy')}
          style={chipStyle}
        >
          <Calendar size={11} /> Planificar
        </button>
        <button
          onClick={() => handleSendMessage('Buscar en la web información de Historia')}
          style={chipStyle}
        >
          <Globe size={11} /> Buscar Web
        </button>
      </div>

      {/* ─── Input Box ─── */}
      <div
        style={{
          padding: '12px 16px 16px 16px',
          background: 'rgba(15, 15, 24, 0.95)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendMessage();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 12,
            padding: '4px 6px 4px 12px',
          }}
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ordena a Owa Brain (ej: crea tarea, pon música)..."
            disabled={isGenerating}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isGenerating}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: input.trim() && !isGenerating
                ? 'linear-gradient(135deg, #6366f1, #e11d48)'
                : 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() && !isGenerating ? 'pointer' : 'not-allowed',
              opacity: input.trim() && !isGenerating ? 1 : 0.4,
              transition: 'all 150ms',
            }}
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}

const chipStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 14,
  color: 'rgba(255, 255, 255, 0.85)',
  fontSize: 11,
  padding: '4px 10px',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  transition: 'all 150ms',
};
