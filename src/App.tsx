import React, { useState, useEffect } from 'react';
import {
  Home, BookOpen, Clock, ListTodo, Settings,
  ChevronLeft, ChevronRight, Music,
  Calendar, Layers, Plus, ChevronDown, Search,
} from 'lucide-react';
import { AppProvider, useApp } from './store/AppContext';
import ErrorBoundary from './components/ErrorBoundary';
import { Toaster } from 'react-hot-toast';

import Inicio from './components/views/Inicio';
import Estudio from './components/views/Estudio';
import Tareas from './components/views/Tareas';
import Notas from './components/views/Notas';
import Musica from './components/views/Musica';
import Planificacion from './components/views/Planificacion';
import Ajustes from './components/views/Ajustes';
import Cursos from './components/views/Cursos';
import Investigacion from './components/views/Investigacion';
import OAuthCallback from './components/OAuthCallback';
import SupabaseCallback from './components/SupabaseCallback';
import GlobalPlayer from './components/GlobalPlayer';

type ViewId = 'inicio' | 'estudio' | 'tareas' | 'notas' | 'musica' | 'planificacion' | 'investigacion' | 'ajustes' | 'curso_detalle';

interface AppContentProps {
  setGlobalView: (view: ViewId) => void;
}

function AppContent() {
  const { settings, courses, navigateTo, setNavigateTo } = useApp();
  const [activeView, setActiveView] = useState<ViewId>('inicio');

  useEffect(() => {
    if (navigateTo) {
      setActiveView(navigateTo);
      setNavigateTo(null);
    }
  }, [navigateTo, setNavigateTo]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showCourses, setShowCourses] = useState(true);
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
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

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
  }, [settings.theme, settings.accentColor, settings.fontFamily]);

  const initials = settings.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const NAV_ITEMS = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'estudio', label: 'Estudio', icon: Clock },
    { id: 'tareas', label: 'Tareas', icon: ListTodo },
    { id: 'notas', label: 'Notas', icon: BookOpen },
    { id: 'musica', label: 'Música', icon: Music },
    { id: 'planificacion', label: 'Planificador', icon: Calendar },
    { id: 'investigacion', label: 'Investigar', icon: Search },
  ];

  const handleCourseClick = (courseId: string) => {
    setSelectedCourseId(courseId);
    setActiveView('curso_detalle');
  };

  return (
    <div className="app-layout">
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>

        {/* ─── Logo / Home Anchor ─── */}
        <div className="sidebar-logo">
          <img src="/owa_logo.png" alt="OWA Studio" className="sidebar-logo-img" />
          {!isCollapsed && <span className="sidebar-logo-text">OWA Studio</span>}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="sidebar-collapse-btn">
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* ─── Navigation ─── */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as ViewId)}
              className={`sidebar-nav-btn ${activeView === item.id ? 'active' : ''}`}
              title={isCollapsed ? item.label : undefined}
            >
              <item.icon size={18} strokeWidth={1.75} />
              {!isCollapsed && <span className="sidebar-nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* ─── Mis Cursos ─── */}
        {!isCollapsed && (
          <div className="sidebar-cursos">
            <div className="sidebar-cursos-header" onClick={() => setShowCourses(!showCourses)}>
              <span className="sidebar-cursos-title">Mis Cursos</span>
              <ChevronDown size={12} className={`sidebar-cursos-chevron ${showCourses ? 'open' : ''}`} />
            </div>
            {showCourses && (
              <div className="sidebar-cursos-list">
                {courses.map(course => (
                  <button
                    key={course.id}
                    onClick={() => handleCourseClick(course.id)}
                    className="sidebar-curso-btn"
                  >
                    <div className="sidebar-curso-dot" style={{ background: course.color }} />
                    <span className="sidebar-curso-name">{course.name}</span>
                  </button>
                ))}
                <button onClick={() => { setSelectedCourseId('NEW'); setActiveView('curso_detalle'); }} className="sidebar-curso-add">
                  <Plus size={13} strokeWidth={2} />
                  <span>Añadir curso</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── Spacer ─── */}
        <div className="sidebar-spacer" />

        {/* ─── User / Settings ─── */}
        <div className="sidebar-footer">
          <button onClick={() => setActiveView('ajustes')} className={`sidebar-nav-btn ${activeView === 'ajustes' ? 'active' : ''}`}>
            <Settings size={18} strokeWidth={1.75} />
            {!isCollapsed && <span className="sidebar-nav-label">Ajustes</span>}
          </button>

          {!isCollapsed && (
            <div className="sidebar-user-card">
              <div className="sidebar-user-avatar">{initials}</div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{settings.userName}</span>
                <span className="sidebar-user-status">Productivo</span>
              </div>
              <div className="sidebar-user-progress">
                <div className="sidebar-user-progress-track">
                  <div className="sidebar-user-progress-fill" />
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="main-area">
        {isSupabaseCallback ? (
          <SupabaseCallback />
        ) : isOAuthCallback ? (
          <OAuthCallback />
        ) : (
          <div key={activeView} className="fade-in-animation" style={{ height: '100%' }}>
            {activeView === 'inicio' && <Inicio />}
            {activeView === 'estudio' && <Estudio />}
            {activeView === 'tareas' && <Tareas />}
            {activeView === 'notas' && <Notas />}
            {activeView === 'musica' && <Musica />}
            {activeView === 'planificacion' && <Planificacion />}
            {activeView === 'investigacion' && <Investigacion />}
            {activeView === 'ajustes' && <Ajustes />}
          {activeView === 'curso_detalle' && <Cursos initialCourseId={selectedCourseId || undefined} />}
          </div>
        )}
        <GlobalPlayer isCollapsed={isCollapsed} />
      </main>

      <Toaster position="bottom-right" toastOptions={{ style: { background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 12, fontSize: 13 } }} />
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
