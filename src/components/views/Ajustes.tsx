import React, { useEffect, useState } from 'react';
import { 
  User, Bell, Palette, LogOut,
  Moon, Sun, Type, Check,
  Timer, Target, Zap, Clock, Brain, BookOpen,
  Download, FolderOpen, Music, Sliders
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import toast from 'react-hot-toast';
import { open } from '@tauri-apps/plugin-dialog';
import { getDownloadPath, setDownloadPath } from '../../lib/musicApi';

export default function Ajustes() {
  const { settings, updateSettings } = useApp();

  const fonts = [
    { name: 'Inter', family: "'Inter', sans-serif" },
    { name: 'Outfit', family: "'Outfit', sans-serif" },
    { name: 'JetBrains Mono', family: "'JetBrains Mono', monospace" },
    { name: 'Roboto', family: "'Roboto', sans-serif" },
  ];

  const [downloadPath, setDownloadPathState] = useState('');
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'm4a'>('mp3');

  useEffect(() => {
    getDownloadPath().then(setDownloadPathState).catch(() => {});
  }, []);

  const handleFontChange = (font: string) => {
    updateSettings({ fontFamily: font });
    document.documentElement.style.setProperty('--font-primary', font);
    toast.success(`Tipografía cambiada`);
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-background">
      {/* Top Header */}
      <header className="h-20 px-8 flex items-center justify-between shrink-0 border-b border-borderDark/50">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-textMain">
            Configuración <Sliders className="text-textDim ml-1" size={24} />
          </h1>
          <p className="text-textDim text-sm mt-1">Personaliza y optimiza tu entorno de estudio y productividad.</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-surface2 px-3 py-1.5 rounded-full border border-borderDark">
            <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_var(--success)]"></div>
            <span className="text-xs text-textMain/90 font-medium">Sistema Activo</span>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 custom-scroll">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column */}
          <div className="flex flex-col gap-8">
            
            {/* Perfil */}
            <section className="bg-surface2 border border-borderDark rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                <User size={80} className="text-accent" />
              </div>
              <h3 className="text-sm font-semibold text-textDim uppercase tracking-wider mb-6 flex items-center gap-2">
                <User size={16} className="text-accent" /> Perfil de Usuario
              </h3>
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-2xl font-bold text-accent shadow-[0_0_15px_var(--accent-glow)] shrink-0">
                  {settings.userName ? settings.userName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-xs text-textDim mb-1 font-medium">Nombre de Usuario</label>
                  <input 
                    type="text" 
                    value={settings.userName} 
                    onChange={e => updateSettings({ userName: e.target.value })} 
                    className="bg-background border border-borderDark rounded-xl px-4 py-2.5 text-sm text-textMain placeholder-textDim focus:outline-none focus:border-accent w-full transition-colors font-medium" 
                    placeholder="Tu nombre" 
                  />
                </div>
              </div>
            </section>

            {/* Apariencia */}
            <section className="bg-surface2 border border-borderDark rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-textDim uppercase tracking-wider mb-6 flex items-center gap-2">
                <Palette size={16} className="text-accent" /> Apariencia y Diseño
              </h3>
              
              <div className="space-y-8">
                {/* Tema */}
                <div className="flex items-center justify-between border-b border-borderDark/50 pb-6">
                  <div>
                    <div className="text-sm font-medium text-textMain">Modo Visual</div>
                    <div className="text-xs text-textDim mt-1">Selecciona el tema de la interfaz</div>
                  </div>
                  <div className="flex bg-background p-1.5 rounded-xl border border-borderDark gap-1">
                    <button 
                      onClick={() => updateSettings({ theme: 'oscuro' })} 
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${settings.theme === 'oscuro' ? 'bg-surface2 text-textMain border border-borderDark shadow-sm' : 'text-textDim hover:text-textMain'}`}
                    >
                      <Moon size={14} /> Oscuro
                    </button>
                    <button 
                      onClick={() => updateSettings({ theme: 'claro' })} 
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${settings.theme === 'claro' ? 'bg-surface2 text-textMain border border-borderDark shadow-sm' : 'text-textDim hover:text-textMain'}`}
                    >
                      <Sun size={14} /> Claro
                    </button>
                  </div>
                </div>

                {/* Tipografía */}
                <div className="border-b border-borderDark/50 pb-6">
                  <div className="text-sm font-medium text-textMain mb-1">Tipografía Global</div>
                  <div className="text-xs text-textDim mb-4">Define la fuente principal de la aplicación</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {fonts.map(font => (
                      <button 
                        key={font.name} 
                        onClick={() => handleFontChange(font.family)} 
                        className={`p-4 rounded-xl border flex flex-col items-center justify-center transition-all ${settings.fontFamily === font.family ? 'bg-accent text-white border-accent shadow-[0_0_15px_var(--accent-glow)]' : 'bg-background border-borderDark text-textMain hover:border-textDim/50'}`}
                      >
                        <div className="text-xl font-bold mb-1" style={{ fontFamily: font.family }}>Aa</div>
                        <div className="text-xs font-medium opacity-90">{font.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color de Acento */}
                <div>
                  <div className="text-sm font-medium text-textMain mb-1">Color de Acento</div>
                  <div className="text-xs text-textDim mb-4">Personaliza el color de los elementos destacados</div>
                  <div className="flex flex-wrap gap-4">
                    {['#E11D48', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'].map(color => (
                      <button 
                        key={color} 
                        onClick={() => updateSettings({ accentColor: color })} 
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all transform hover:scale-110 ${settings.accentColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-background shadow-lg' : ''}`}
                        style={{ backgroundColor: color, boxShadow: settings.accentColor === color ? `0 0 15px ${color}` : 'none' }}
                      >
                        {settings.accentColor === color && <Check size={16} className="text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </section>

          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-8">
            
            {/* Configuración de Estudio */}
            <section className="bg-surface2 border border-borderDark rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-textDim uppercase tracking-wider mb-6 flex items-center gap-2">
                <Brain size={16} className="text-accent" /> Configuración de Estudio (Pomodoro)
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-background border border-borderDark rounded-xl p-4 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-textDim uppercase tracking-wider mb-3">
                    <Timer size={14} className="text-accent" /> Tiempo de enfoque
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={settings.pomodoroTime / 60} 
                      onChange={e => updateSettings({ pomodoroTime: parseInt(e.target.value) * 60 || 1500 })} 
                      className="bg-surface2 border border-borderDark rounded-lg px-3 py-2 text-base text-textMain font-bold focus:outline-none focus:border-accent w-full" 
                      min="1" max="120" 
                    />
                    <span className="text-xs text-textDim font-medium">min</span>
                  </div>
                </div>

                <div className="bg-background border border-borderDark rounded-xl p-4 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-textDim uppercase tracking-wider mb-3">
                    <Zap size={14} className="text-success" /> Descanso corto
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={settings.shortBreakTime / 60} 
                      onChange={e => updateSettings({ shortBreakTime: parseInt(e.target.value) * 60 || 300 })} 
                      className="bg-surface2 border border-borderDark rounded-lg px-3 py-2 text-base text-textMain font-bold focus:outline-none focus:border-accent w-full" 
                      min="1" max="30" 
                    />
                    <span className="text-xs text-textDim font-medium">min</span>
                  </div>
                </div>

                <div className="bg-background border border-borderDark rounded-xl p-4 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-textDim uppercase tracking-wider mb-3">
                    <Target size={14} className="text-info" /> Meta diaria
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={settings.dailyGoal} 
                      onChange={e => updateSettings({ dailyGoal: parseInt(e.target.value) || 240 })} 
                      className="bg-surface2 border border-borderDark rounded-lg px-3 py-2 text-base text-textMain font-bold focus:outline-none focus:border-accent w-full" 
                      min="1" 
                    />
                    <span className="text-xs text-textDim font-medium">min</span>
                  </div>
                </div>

                <div className="bg-background border border-borderDark rounded-xl p-4 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-textDim uppercase tracking-wider mb-3">
                    <BookOpen size={14} className="text-warning" /> Metas Pomodoro
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={settings.pomodoroGoal} 
                      onChange={e => updateSettings({ pomodoroGoal: parseInt(e.target.value) || 4 })} 
                      className="bg-surface2 border border-borderDark rounded-lg px-3 py-2 text-base text-textMain font-bold focus:outline-none focus:border-accent w-full" 
                      min="1" max="20" 
                    />
                    <span className="text-xs text-textDim font-medium">ciclos</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Descargas */}
            <section className="bg-surface2 border border-borderDark rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-textDim uppercase tracking-wider mb-6 flex items-center gap-2">
                <Download size={16} className="text-accent" /> Gestión de Descargas (Música)
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-textDim uppercase tracking-wider mb-2">Carpeta de Destino</label>
                  <div className="flex gap-4 items-center">
                    <div className="flex-1 flex items-center gap-3 bg-background border border-borderDark rounded-xl px-4 py-2.5 min-w-0">
                      <FolderOpen size={16} className="text-textDim shrink-0" />
                      <span className="text-xs font-medium text-textMain truncate">{downloadPath || 'Descargas/OWA Music'}</span>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const folder = await open({ directory: true, multiple: false, title: 'Carpeta de descargas' });
                          if (folder) {
                            setDownloadPathState(String(folder));
                            await setDownloadPath(String(folder));
                            toast.success('Carpeta de descarga actualizada');
                          }
                        } catch (e) { console.error(e); toast.error('No se pudo cambiar la carpeta'); }
                      }}
                      className="bg-surface border border-borderDark hover:bg-borderDark text-textMain px-4 py-2.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 shrink-0"
                    >
                      <FolderOpen size={14} /> Cambiar
                    </button>
                  </div>
                </div>

                <div className="border-t border-borderDark/50 pt-6">
                  <label className="block text-xs font-semibold text-textDim uppercase tracking-wider mb-3">Formato de Audio</label>
                  <div className="flex gap-3">
                    {['mp3', 'm4a'].map(f => (
                      <button
                        key={f}
                        onClick={() => setAudioFormat(f as 'mp3' | 'm4a')}
                        className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${audioFormat === f ? 'bg-accent text-white shadow-[0_0_15px_var(--accent-glow)]' : 'bg-background border border-borderDark text-textDim hover:text-textMain'}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-textDim mt-2 font-medium">MP3 recomendado para máxima compatibilidad con todos los reproductores.</p>
                </div>
              </div>
            </section>

            {/* Notificaciones */}
            <section className="bg-surface2 border border-borderDark rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-textDim uppercase tracking-wider mb-6 flex items-center gap-2">
                <Bell size={16} className="text-accent" /> Alertas y Sonidos
              </h3>
              
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-background border border-borderDark rounded-xl cursor-pointer hover:border-borderDark/80 transition-colors">
                  <div>
                    <span className="text-sm font-medium text-textMain block">Alertas de temporizador</span>
                    <span className="text-xs text-textDim">Notificar al completar ciclos de estudio o descansos</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={settings.notifications} 
                    onChange={e => updateSettings({ notifications: e.target.checked })} 
                    className="w-5 h-5 rounded border-borderDark text-accent focus:ring-accent bg-surface2 cursor-pointer" 
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-background border border-borderDark rounded-xl cursor-pointer hover:border-borderDark/80 transition-colors">
                  <div>
                    <span className="text-sm font-medium text-textMain block">Efectos de sonido</span>
                    <span className="text-xs text-textDim">Reproducir sonidos al interactuar con tareas y temporizador</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={settings.soundEffects} 
                    onChange={e => updateSettings({ soundEffects: e.target.checked })} 
                    className="w-5 h-5 rounded border-borderDark text-accent focus:ring-accent bg-surface2 cursor-pointer" 
                  />
                </label>
              </div>
            </section>

            {/* Cerrar Sesión */}
            <div className="flex justify-start">
              <button className="flex items-center gap-2 px-6 py-3 rounded-xl border border-danger/30 bg-danger/10 hover:bg-danger/20 text-danger text-sm font-semibold transition-colors">
                <LogOut size={16} /> Cerrar Sesión
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
