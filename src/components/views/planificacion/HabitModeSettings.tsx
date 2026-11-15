import React from 'react';
import {Droplets,Dumbbell} from 'lucide-react';
import {useAppSlice} from '../../../store/AppContext';

/**
 * Activacion de los habitos de agua y ejercicio.
 *
 * Vive en Ajustes (categoria Planificador): aqui se decide que metricas estan
 * activas y con que meta personal. El seguimiento diario se queda en el
 * apartado Habitos.
 */
export default function HabitModeSettings(){
  const a=useAppSlice(['habits','addHabit','updateHabit']);
  const modes=[
    {kind:'water' as const,label:'Agua',unit:'vasos',goal:8,icon:<Droplets size={18}/>,hint:'Vasos de agua registrados cada dia'},
    {kind:'exercise' as const,label:'Ejercicio',unit:'min',goal:30,icon:<Dumbbell size={18}/>,hint:'Minutos de ejercicio registrados cada dia'},
  ];
  return <section className="habit-modes" aria-label="Activacion de habitos de agua y ejercicio">
    <div className="habit-mode-options">
      {modes.map(mode=>{
        const active=a.habits.find(h=>h.metricKind===mode.kind&&!h.isArchived),archived=a.habits.find(h=>h.metricKind===mode.kind&&h.isArchived);
        return <button key={mode.kind} type="button" className="habit-mode-card" data-kind={mode.kind} data-active={active?true:false} aria-pressed={!!active}
          onClick={()=>{if(active)a.updateHabit(active.id,{isArchived:true});else if(archived)a.updateHabit(archived.id,{isArchived:false});else a.addHabit(mode.label,{metricKind:mode.kind,dailyGoal:mode.goal});}}>
          <span className="habit-mode-icon" aria-hidden="true">{mode.icon}</span>
          <span className="habit-mode-text"><strong>{mode.label}</strong><small>{mode.hint}</small></span>
          <span className="habit-mode-state">{active?'Activo':'Inactivo'}</span>
        </button>;
      })}
    </div>
    <p className="habit-modes-note">Al activar un habito aparece su medidor en el apartado Habitos, donde puedes registrar tu cantidad diaria y ajustar tu meta.</p>
  </section>;
}
