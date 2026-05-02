import React, { useState } from 'react';
import { User, Palette, Bell, Moon, Sun, Monitor, Download, Upload, Trash2, Info, Laptop, Target, Clock, Shield, Sparkles } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import toast from 'react-hot-toast';

export default function Ajustes() {
  const { settings, updateSettings } = useApp();
  const [showResetModal, setShowResetModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  const handleExportData = () => {
    const data = localStorage.getItem('owa_studio_data');
    if (data) {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `owa-studio-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Configuración exportada correctamente');
    }
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target?.result as string);
            localStorage.setItem('owa_studio_data', JSON.stringify(data));
            window.location.reload();
          } catch (err) {
            toast.error('Error al importar archivo');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleResetData = () => {
    localStorage.removeItem('owa_studio_data');
    setShowResetModal(false);
    window.location.reload();
  };

  return (
    <div className="page-container">
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-12">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-tertiary uppercase tracking-widest">Preferencia</span>
          <h1 className="text-5xl font-bold text-primary tracking-tight">Configuración</h1>
          <p className="text-sm text-secondary font-medium">Personaliza tu espacio de trabajo editorial</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: SETTINGS */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
          
          {/* PROFILE */}
          <div className="bento-card">
            <div className="flex items-center gap-3 mb-8">
              <User size={18} className="text-accent" />
              <span className="text-xs font-bold text-tertiary uppercase tracking-widest">Perfil de Usuario</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-3xl font-bold text-accent">
                OS
              </div>
              <div>
                <h3 className="text-xl font-bold text-primary">Usuario de Owa Studio</h3>
                <p className="text-sm text-secondary font-medium">Plan Personal · v1.2.0</p>
              </div>
            </div>
          </div>

          {/* APPEARANCE */}
          <div className="bento-card">
            <div className="flex items-center gap-3 mb-8">
              <Palette size={18} className="text-accent" />
              <span className="text-xs font-bold text-tertiary uppercase tracking-widest">Sistema y Estilo</span>
            </div>

            <div className="space-y-10">
              <div>
                <label className="block text-[10px] font-bold text-tertiary uppercase tracking-widest mb-4">Interfaz Visual</label>
                <div className="flex gap-3">
                  {[
                    { v: 'oscuro', i: Moon, label: 'Oscuro' },
                    { v: 'claro', i: Sun, label: 'Claro' },
                    { v: 'sistema', i: Monitor, label: 'Sistema' },
                  ].map(t => (
                    <button
                      key={t.v}
                      onClick={() => updateSettings({ theme: t.v as any })}
                      className={`flex items-center gap-3 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border ${
                        settings.theme === t.v
                          ? 'bg-elevated border-default text-primary shadow-sm'
                          : 'bg-surface border-default text-tertiary hover:bg-hover hover:text-secondary'
                      }`}
                    >
                      <t.i size={14} className={settings.theme === t.v ? 'text-accent' : ''} />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-bold text-tertiary uppercase tracking-widest mb-3">Meta Diaria (Minutos)</label>
                  <input
                    type="number"
                    value={settings.dailyGoal}
                    onChange={(e) => updateSettings({ dailyGoal: parseInt(e.target.value) || 240 })}
                    className="w-full bg-elevated border border-default p-3 rounded-xl text-primary font-bold outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-tertiary uppercase tracking-widest mb-3">Sesiones Objetivo</label>
                  <input
                    type="number"
                    value={settings.pomodoroGoal || 4}
                    onChange={(e) => updateSettings({ pomodoroGoal: parseInt(e.target.value) || 4 })}
                    className="w-full bg-elevated border border-default p-3 rounded-xl text-primary font-bold outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* NOTIFICATIONS */}
          <div className="bento-card">
            <div className="flex items-center gap-3 mb-8">
              <Bell size={18} className="text-accent" />
              <span className="text-xs font-bold text-tertiary uppercase tracking-widest">Notificaciones</span>
            </div>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center p-4 rounded-xl hover:bg-hover transition-colors">
                <div>
                  <p className="text-sm font-bold text-primary">Alertas de Sistema</p>
                  <p className="text-xs text-secondary">Recordatorios de tareas y sesiones</p>
                </div>
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded border-default bg-surface accent-accent"
                  checked={settings.notifications}
                  onChange={(e) => updateSettings({ notifications: e.target.checked })}
                />
              </div>

              <div className="flex justify-between items-center p-4 rounded-xl hover:bg-hover transition-colors">
                <div>
                  <p className="text-sm font-bold text-primary">Efectos Sonoros</p>
                  <p className="text-xs text-secondary">Feedback auditivo al completar objetivos</p>
                </div>
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded border-default bg-surface accent-accent"
                  checked={settings.soundEffects}
                  onChange={(e) => updateSettings({ soundEffects: e.target.checked })}
                />
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: ACTIONS & INFO */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
          
          <div className="bento-card">
            <div className="flex items-center gap-3 mb-8">
              <Shield size={18} className="text-accent" />
              <span className="text-xs font-bold text-tertiary uppercase tracking-widest">Gestión de Datos</span>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={handleExportData} className="btn bg-surface border-default text-secondary hover:text-primary justify-start px-6">
                <Download size={16} /> Exportar Backup
              </button>
              <button onClick={handleImportData} className="btn bg-surface border-default text-secondary hover:text-primary justify-start px-6">
                <Upload size={16} /> Importar Datos
              </button>
              <button onClick={() => setShowResetModal(true)} className="btn bg-danger/10 text-danger hover:bg-danger/20 justify-start px-6 border-none">
                <Trash2 size={16} /> Borrar Todo
              </button>
            </div>
          </div>

          <div className="bento-card flex flex-col items-center text-center p-10">
            <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-accent to-accent-subtle flex items-center justify-center text-white shadow-2xl mb-6">
              <Sparkles size={40} />
            </div>
            <h2 className="text-2xl font-bold text-primary mb-1">Owa Studio</h2>
            <p className="text-xs font-bold text-tertiary uppercase tracking-widest mb-6">Professional Suite</p>
            <p className="text-sm text-secondary leading-relaxed mb-8">
              Diseñado para mentes ambiciosas que buscan un equilibrio entre estética y productividad extrema.
            </p>
            <button 
              onClick={() => setShowAboutModal(true)}
              className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline"
            >
              Documentación y Créditos
            </button>
          </div>

        </div>

      </div>

      {/* MODALS */}
      {showResetModal && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-8">
              <h2 className="text-lg font-bold mb-2">¿Restablecer datos?</h2>
              <p className="text-secondary text-sm leading-relaxed mb-8">Esta acción eliminará permanentemente todas tus notas, cursos y progreso. No hay vuelta atrás.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowResetModal(false)} className="btn bg-transparent text-tertiary">Cancelar</button>
                <button onClick={handleResetData} className="btn bg-danger text-white">Restablecer</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}