import React, { useState, useEffect, useRef } from 'react';
import {
  Home, BookOpen, Clock, ListTodo, Settings,
  Music,
  Calendar, Layers, Plus,
} from 'lucide-react';
import { AppProvider, useApp } from './store/AppContext';
import ErrorBoundary from './components/ErrorBoundary';

import Inicio from './components/views/Inicio';
import Estudio from './components/views/Estudio';
import Tareas from './components/views/Tareas';
import Notas from './components/views/Notas';
import Musica from './components/views/Musica';
import Planificacion from './components/views/Planificacion';
import Ajustes from './components/views/Ajustes';
import Cursos from './components/views/Cursos';
import CursosHub from './components/views/CursosHub';
import OAuthCallback from './components/OAuthCallback';
import SupabaseCallback from './components/SupabaseCallback';
import GlobalPlayer from './components/GlobalPlayer';

type ViewId = 'inicio' | 'estudio' | 'tareas' | 'notas' | 'musica' | 'planificacion' | 'cursos' | 'ajustes' | 'curso_detalle';

interface AppContentProps {
  setGlobalView: (view: ViewId) => void;
}

function AppContent() {
  const { settings, courses, navigateTo, setNavigateTo, importState, updateSettings } = useApp();
  const [activeView, setActiveView] = useState<ViewId>('inicio');

  useEffect(() => {
    if (navigateTo) {
      let mappedView = navigateTo as string;
      if (mappedView === 'apuntes') mappedView = 'notas';
      if (mappedView === 'flujo') mappedView = 'planificacion';
      setActiveView(mappedView as ViewId);
      setNavigateTo(null);
    }
  }, [navigateTo, setNavigateTo]);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isOAuthCallback, setIsOAuthCallback] = useState(false);
  const [isSupabaseCallback, setIsSupabaseCallback] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/oauth/callback')) {
      setIsOAuthCallback(true);
    }
    if (path.startsWith('/auth/callback')) {
      setIsSupabaseCallback(true);
    }
  }, []);

  // Close cursos popup when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (coursesPopupRef.current && !coursesPopupRef.current.contains(e.target as Node)) {
        setShowCoursesPopup(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [showCoursesPopup, setShowCoursesPopup] = useState(false);
  const coursesPopupRef = useRef<HTMLDivElement>(null);
  const backgroundLoadAttemptedRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'claro') {
      root.setAttribute('data-theme', 'claro');
    } else if (settings.theme === 'oscuro') {
      root.setAttribute('data-theme', 'oscuro');
    } else {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', isDark ? 'oscuro' : 'claro');
    }
    const c = settings.accentColor;
    root.style.setProperty('--accent', c);
    root.style.setProperty('--font-primary', settings.fontFamily);
    // Derive rgba variants from hex color
    const h2r = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };
    const { r, g, b } = h2r(c);
    root.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.12)`);
    root.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.30)`);
    root.style.setProperty('--accent-dim', `rgba(${r},${g},${b},0.06)`);
    root.style.setProperty('--led-color', c);
    root.style.setProperty('--led-glow', `rgba(${r},${g},${b},0.45)`);
    root.style.setProperty('--led-dim', `rgba(${r},${g},${b},0.08)`);
    root.style.setProperty('--led-segment-off', `rgba(${r},${g},${b},0.06)`);
    
    const applyBg = (url: string) => {
      root.style.setProperty('--app-bg-image', `url("${url}")`);
      root.style.setProperty('--app-bg-blend', 'normal');
    };
    const removeBg = () => {
      root.style.removeProperty('--app-bg-image');
      root.style.removeProperty('--app-bg-blend');
    };

    if (settings.backgroundImage) {
      applyBg(settings.backgroundImage);
    } else {
      removeBg();
    }
    
    root.style.setProperty('--ui-opacity', (settings.uiOpacity ?? 0.85).toString());
    root.style.setProperty('--bg-brightness', `${settings.backgroundBrightness ?? 100}%`);
    root.style.setProperty('--bg-blur', `${settings.backgroundBlur ?? 0}px`);
    root.style.setProperty('--bg-overlay', `${(settings.backgroundOverlay ?? 0) / 100}`);
  }, [settings.theme, settings.accentColor, settings.fontFamily, settings.backgroundImage, settings.uiOpacity, settings.backgroundBrightness, settings.backgroundBlur, settings.backgroundOverlay]);

  const initials = settings.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const NAV_ITEMS = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'estudio', label: 'Estudio', icon: Clock },
    { id: 'tareas', label: 'Tareas', icon: ListTodo },
    { id: 'notas', label: 'Notas', icon: BookOpen },
    { id: 'musica', label: 'Música', icon: Music },
    { id: 'planificacion', label: 'Planificador', icon: Calendar },
    { id: 'cursos', label: 'Cursos', icon: Layers },
  ];

  const handleCourseClick = (courseId: string) => {
    setSelectedCourseId(courseId);
    setActiveView('curso_detalle');
  };

  return (
    <div className="app-layout">
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>

        {/* ─── Logo / Home Anchor (click to toggle) ─── */}
        <div className="sidebar-logo" onClick={() => setIsCollapsed(!isCollapsed)} style={{ cursor: 'pointer' }}>
          <img src="/owa_logo.png" alt="OWA Studio" className="sidebar-logo-img" />
          {!isCollapsed && <span className="sidebar-logo-text">OWA Studio</span>}
        </div>

        {/* ─── Navigation ─── */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <div key={item.id} style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  if (item.id === 'cursos' && isCollapsed) {
                    setShowCoursesPopup(prev => !prev);
                  } else {
                    setActiveView(item.id as ViewId);
                    setShowCoursesPopup(false);
                  }
                }}
                className={`sidebar-nav-btn ${activeView === item.id ? 'active' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon size={20} strokeWidth={1.5} />
                {!isCollapsed && <span className="sidebar-nav-label">{item.label}</span>}
              </button>
              {/* Collapsed sidebar: cursos popup */}
              {item.id === 'cursos' && isCollapsed && showCoursesPopup && (
                <div ref={coursesPopupRef}
                  style={{
                    position: 'absolute', left: '100%', top: 0, marginLeft: 8,
                    width: 220, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                    borderRadius: 12, padding: 8, zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '8px 10px 4px' }}>
                    Mis Cursos
                  </div>
                  {courses.map(course => (
                    <button key={course.id} onClick={() => { setSelectedCourseId(course.id); setActiveView('curso_detalle'); setShowCoursesPopup(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', textAlign: 'left', transition: 'background 150ms' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: course.color, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.name}</span>
                    </button>
                  ))}
                  <button onClick={() => { setSelectedCourseId('NEW'); setActiveView('curso_detalle'); setShowCoursesPopup(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer', textAlign: 'left', marginTop: 4 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Plus size={12} /> Añadir curso
                  </button>
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* ─── Spacer ─── */}
        <div className="sidebar-spacer" />

        {/* ─── Settings (always at bottom) ─── */}
        <div className="sidebar-footer">
          <button onClick={() => setActiveView('ajustes')} className={`sidebar-nav-btn ${activeView === 'ajustes' ? 'active' : ''}`}>
            <Settings size={20} strokeWidth={1.5} />
            {!isCollapsed && <span className="sidebar-nav-label">Ajustes</span>}
          </button>
        </div>
      </aside>

      <main className="main-area">
        {isSupabaseCallback ? (
          <SupabaseCallback />
        ) : isOAuthCallback ? (
          <OAuthCallback />
        ) : (
          <div key={activeView} className="fade-in-animation" style={{ flex: 1, overflow: 'hidden' }}>
            {activeView === 'inicio' && <Inicio />}
            {activeView === 'estudio' && <Estudio />}
            {activeView === 'tareas' && <Tareas />}
            {activeView === 'notas' && <Notas />}
            {activeView === 'musica' && <Musica />}
            {activeView === 'planificacion' && <Planificacion />}
            {activeView === 'cursos' && <CursosHub onSelectCourse={(courseId) => { setSelectedCourseId(courseId); setActiveView('curso_detalle'); }} />}
            {activeView === 'ajustes' && <Ajustes />}
          {activeView === 'curso_detalle' && <Cursos initialCourseId={selectedCourseId || undefined} />}
          </div>
        )}
        <GlobalPlayer isCollapsed={isCollapsed} />
      </main>

      {importState.active && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10, 10, 12, 0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.3s ease-out',
        }}>
          <div style={{
            background: 'rgba(20, 20, 25, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: '32px 40px',
            width: '100%',
            maxWidth: 460,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 50px rgba(225, 29, 72, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}>
            {/* High-tech rotating gradient loader */}
            <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 24 }}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" stroke="rgba(255,255,255,0.03)" strokeWidth="4" fill="none" />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke="var(--accent)"
                  strokeWidth="4"
                  strokeDasharray="213"
                  strokeDashoffset={213 - (213 * importState.overallProgress) / 100}
                  strokeLinecap="round"
                  fill="none"
                  transform="rotate(-90 40 40)"
                  style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                />
              </svg>
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)'
              }}>
                {importState.overallProgress}%
              </div>
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em' }}>
              Procesando Biblioteca de Música
            </h3>
            
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Cargando canción <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{importState.current}</span> de <span style={{ fontWeight: 600 }}>{importState.total}</span>
            </p>

            <div style={{
              width: '100%',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 8,
              padding: 12,
              marginBottom: 20,
              border: '1px solid rgba(255,255,255,0.04)',
              textAlign: 'left'
            }}>
              <div style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 4
              }}>
                Archivo actual
              </div>
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: 10
              }}>
                {importState.fileName || 'Preparando archivo...'}
              </div>

              {/* Individual phase checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: importState.phase === 'loading_file' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: importState.phase === 'loading_file' ? 'var(--accent)' : (['extracting_metadata', 'validating_audio', 'finished'].includes(importState.phase) ? '#10B981' : 'transparent'),
                    boxShadow: importState.phase === 'loading_file' ? '0 0 8px var(--accent)' : 'none'
                  }} />
                  <span style={{ textDecoration: (['extracting_metadata', 'validating_audio', 'finished'].includes(importState.phase)) ? 'line-through' : 'none', opacity: (['extracting_metadata', 'validating_audio', 'finished'].includes(importState.phase)) ? 0.5 : 1 }}>
                    Lectura e indexación en disco
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: importState.phase === 'extracting_metadata' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: importState.phase === 'extracting_metadata' ? 'var(--accent)' : (['validating_audio', 'finished'].includes(importState.phase) ? '#10B981' : 'transparent'),
                    boxShadow: importState.phase === 'extracting_metadata' ? '0 0 8px var(--accent)' : 'none'
                  }} />
                  <span style={{ textDecoration: (['validating_audio', 'finished'].includes(importState.phase)) ? 'line-through' : 'none', opacity: (['validating_audio', 'finished'].includes(importState.phase)) ? 0.5 : 1 }}>
                    Extracción de metadatos ID3 (Título, Artista, Portada)
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: importState.phase === 'validating_audio' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: importState.phase === 'validating_audio' ? 'var(--accent)' : (importState.phase === 'finished' ? '#10B981' : 'transparent'),
                    boxShadow: importState.phase === 'validating_audio' ? '0 0 8px var(--accent)' : 'none'
                  }} />
                  <span style={{ textDecoration: importState.phase === 'finished' ? 'line-through' : 'none', opacity: importState.phase === 'finished' ? 0.5 : 1 }}>
                    Validación de reproducción y duración de audio
                  </span>
                </div>
              </div>
            </div>

            {/* Horizontal Overall Progress Bar */}
            <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${importState.overallProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent-glow) 100%)',
                boxShadow: '0 0 8px var(--accent-glow)',
                transition: 'width 0.3s ease-out'
              }} />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
              <span>Procesando...</span>
              <span>Por favor, no cierres la aplicación</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
