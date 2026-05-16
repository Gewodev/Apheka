import React, { useState, useEffect } from 'react';
import {
  Home, BookOpen, Clock, ListTodo, Settings,
  ChevronLeft, ChevronRight, Music,
  Calendar, Layers, Plus,
  Book, ChevronDown, ChevronUp
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
import GlobalPlayer from './components/GlobalPlayer';

type ViewId = 'inicio' | 'estudio' | 'tareas' | 'notas' | 'musica' | 'planificacion' | 'ajustes' | 'curso_detalle';

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
    root.style.setProperty('--accent', settings.accentColor);
    root.style.setProperty('--font-primary', settings.fontFamily);
  }, [settings.theme, settings.accentColor, settings.fontFamily]);

  const initials = settings.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const NAV_ITEMS = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'estudio', label: 'Estudio', icon: Clock },
    { id: 'tareas', label: 'Tareas', icon: ListTodo },
    { id: 'notas', label: 'Notas', icon: BookOpen },
    { id: 'musica', label: 'Música', icon: Music },
    { id: 'planificacion', label: 'Planificador', icon: Calendar },
  ];

  const handleCourseClick = (courseId: string) => {
    setSelectedCourseId(courseId);
    setActiveView('curso_detalle');
  };

  return (
    <div className="app-layout">
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div style={{ padding: '24px 12px', display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between' }}>
          {!isCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={16} color="#fff" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>OWA Studio</span>
            </div>
          )}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="btn-ghost" style={{ padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav style={{ flex: 1, padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as ViewId)}
              className={`nav-btn ${activeView === item.id ? 'active' : ''}`}
              title={isCollapsed ? item.label : undefined}
              style={isCollapsed ? { justifyContent: 'center', padding: '0 8px' } : {}}
            >
              <item.icon size={18} />
              {!isCollapsed && <span>{item.label}</span>}
            </button>
          ))}

          {!isCollapsed && (
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column' }}>
              <button
                onClick={() => setShowCourses(!showCourses)}
                className="btn-ghost"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', width: '100%', borderRadius: 6 }}
              >
                Mis Cursos
                {showCourses ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showCourses && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                  {courses.map(course => (
                    <button
                      key={course.id}
                      onClick={() => handleCourseClick(course.id)}
                      className="btn-ghost"
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', width: '100%', cursor: 'pointer' }}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: course.color, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.name}</span>
                    </button>
                  ))}
                  <button className="nav-btn" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, gap: 8 }}>
                    <Plus size={14} /> <span>Añadir Curso</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>

        <div style={{ padding: 12, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button onClick={() => setActiveView('ajustes')} className={`nav-btn ${activeView === 'ajustes' ? 'active' : ''}`}>
            <Settings size={18} />
            {!isCollapsed && <span>Ajustes</span>}
          </button>

          {!isCollapsed && (
            <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#fff', flexShrink: 0 }}>{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{settings.userName}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="main-area" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div key={activeView} className="fade-in-animation" style={{ height: '100%' }}>
          {activeView === 'inicio' && <Inicio />}
          {activeView === 'estudio' && <Estudio />}
          {activeView === 'tareas' && <Tareas />}
          {activeView === 'notas' && <Notas />}
          {activeView === 'musica' && <Musica />}
          {activeView === 'planificacion' && <Planificacion />}
          {activeView === 'ajustes' && <Ajustes />}
          {activeView === 'curso_detalle' && (
            <div className="page-container">
              <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Detalle del Curso</h1>
              <p style={{ color: 'var(--text-secondary)' }}>Contenido en desarrollo...</p>
            </div>
          )}
        </div>

        <GlobalPlayer />
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
