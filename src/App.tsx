import { useState, useCallback, useEffect } from 'react';
import {
  LayoutDashboard,
  Settings,
  Brain,
  Music2,
  ListTodo,
  FileText,
  Book,
  Calendar,
  Sparkles,
  ChevronLeft,
  Activity,
  Terminal,
  Layers,
  Box
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';

import { AppProvider, useApp } from './store/AppContext';
import Inicio from './components/views/Inicio';
import Estudio from './components/views/Estudio';
import Tareas from './components/views/Tareas';
import Notas from './components/views/Notas';
import Cursos from './components/views/Cursos';
import Musica from './components/views/Musica';
import Planificacion from './components/views/Planificacion';
import Ajustes from './components/views/Ajustes';

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useApp();

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  return <>{children}</>;
}

export type ViewType = 'inicio' | 'estudio' | 'tareas' | 'notas' | 'cursos' | 'musica' | 'planificacion' | 'ajustes';

const NAV_ITEMS: { id: ViewType; label: string; icon: React.ElementType }[] = [
  { id: 'inicio', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tareas', label: 'Operaciones', icon: ListTodo },
  { id: 'estudio', label: 'Enfoque', icon: Brain },
  { id: 'planificacion', label: 'Cronograma', icon: Calendar },
  { id: 'notas', label: 'Archivo', icon: FileText },
  { id: 'cursos', label: 'Sectores', icon: Book },
  { id: 'musica', label: 'Ambiente', icon: Music2 },
];

function AppContent() {
  const [activeView, setActiveView] = useState<ViewType>('inicio');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { incrementSessionTime } = useApp();
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [timerMode, setTimerMode] = useState<'pomodoro' | 'break' | 'chrono'>('pomodoro');

  const handleViewChange = useCallback((view: string) => {
    const validViews = ['inicio', 'estudio', 'tareas', 'notas', 'cursos', 'musica', 'planificacion', 'ajustes'];
    if (validViews.includes(view)) {
      setActiveView(view as ViewType);
      const contentArea = document.querySelector('.content-area');
      if (contentArea) contentArea.scrollTop = 0;
    }
  }, []);

  useEffect(() => {
    let interval: number | undefined;
    if (isTimerActive) {
      interval = setInterval(() => {
        incrementSessionTime();
      }, 1000) as unknown as number;
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isTimerActive, incrementSessionTime]);

  return (
    <div className="app-layout">
      {/* SIDEBAR - ARCHITECTURAL PRECISION */}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} border-r border-white/[0.03] bg-surface/80 backdrop-blur-3xl z-50`}>
        <div className="sidebar-header p-12">
          {!isCollapsed && (
            <div className="flex items-center gap-5 group cursor-default">
              <div className="w-14 h-14 rounded-[24px] bg-accent flex items-center justify-center shadow-[0_20px_40px_rgba(225,29,72,0.3)] transition-transform duration-500 hover:rotate-12">
                <Terminal size={28} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-black tracking-tighter text-3xl text-primary leading-none">OWA</span>
                <span className="text-[10px] font-black text-accent uppercase tracking-[0.4em] mt-1.5">Studio</span>
              </div>
            </div>
          )}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className={`w-12 h-12 flex items-center justify-center hover:bg-white/5 rounded-2xl transition-all text-muted hover:text-primary ${isCollapsed ? 'mx-auto' : ''}`}
          >
            <ChevronLeft size={24} className={isCollapsed ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
        </div>

        <div className="sidebar-nav px-8 py-10 flex flex-col gap-3 flex-1">
          {!isCollapsed && (
            <div className="flex items-center gap-3 mb-6 px-4">
              <Layers size={12} className="text-accent" />
              <span className="text-[10px] font-black text-tertiary uppercase tracking-[0.4em]">Sistemas</span>
            </div>
          )}
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleViewChange(item.id)}
              className={`nav-btn group relative h-16 rounded-[20px] flex items-center gap-5 px-6 transition-all duration-300 ${
                activeView === item.id 
                ? 'active text-accent' 
                : 'text-tertiary hover:bg-white/[0.03] hover:text-primary'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
              title={isCollapsed ? item.label : undefined}
            >
              <item.icon size={22} className={`shrink-0 transition-transform duration-500 ${activeView === item.id ? 'scale-110' : 'group-hover:scale-110'}`} />
              {!isCollapsed && (
                <span className={`text-[11px] font-black uppercase tracking-[0.25em] transition-all duration-300 ${activeView === item.id ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`}>
                  {item.label}
                </span>
              )}
              {activeView === item.id && (
                <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer p-10">
          <button
            onClick={() => handleViewChange('ajustes')}
            className={`nav-btn group relative h-16 rounded-[20px] flex items-center gap-5 px-6 transition-all ${
              activeView === 'ajustes' 
              ? 'active text-accent' 
              : 'text-tertiary hover:bg-white/[0.03] hover:text-primary'
            } ${isCollapsed ? 'justify-center px-0' : ''}`}
            title="Configuración"
          >
            <Settings size={22} className={`shrink-0 transition-transform duration-500 ${activeView === 'ajustes' ? 'scale-110' : 'group-hover:scale-110'}`} />
            {!isCollapsed && (
              <span className={`text-[11px] font-black uppercase tracking-[0.25em] ${activeView === 'ajustes' ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`}>
                Ajustes
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA - MASTERED SPACING */}
      <main className="main-area relative">
        <div className="bg-grid-pattern opacity-[0.03]" />
        <div className="content-area" key={activeView}>
          <div className="relative z-10">
            {activeView === 'inicio' && <Inicio />}
            {activeView === 'estudio' && <Estudio isActive={isTimerActive} setIsActive={setIsTimerActive} mode={timerMode} setTimerMode={setTimerMode} />}
            {activeView === 'tareas' && <Tareas />}
            {activeView === 'notas' && <Notas />}
            {activeView === 'cursos' && <Cursos onSelect={handleViewChange} />}
            {activeView === 'musica' && <Musica />}
            {activeView === 'planificacion' && <Planificacion />}
            {activeView === 'ajustes' && <Ajustes />}
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <ThemeProvider>
        <AppContent />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 5000,
            style: {
              background: '#08080A',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '32px',
              fontSize: '11px',
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: '0.3em',
              padding: '24px 40px',
              boxShadow: '0 40px 80px rgba(0,0,0,0.8)',
              backdropFilter: 'blur(30px)',
            },
            success: {
              iconTheme: {
                primary: '#E11D48',
                secondary: '#FFFFFF',
              },
            },
          }}
        />
      </ThemeProvider>
    </AppProvider>
  );
}

export default App;
