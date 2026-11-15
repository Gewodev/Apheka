// import HabitModes from './HabitModes'; // Solo en Ajustes > Planificador
import {useAppSlice} from "../../../store/AppContext";
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Plus, Trash2, Pencil, Archive, RefreshCcw, ArchiveRestore, Check, X, Droplets, Dumbbell, Target, Zap, Flame } from 'lucide-react';
import { useApp, Habit } from '../../../store/AppContext';
import { startOfWeek, addDays, startOfToday, isBefore, format } from 'date-fns';

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function HabitsView() {
  const { habits, addHabit, updateHabit, deleteHabit } = useAppSlice(["habits","addHabit","updateHabit","deleteHabit"]);
  const [isEditing, setIsEditing] = useState(false);
  const [isStreakView, setIsStreakView] = useState(false);
  const [isArchiveMode, setIsArchiveMode] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const newInputRef = useRef<HTMLInputElement>(null);

  const [focusDate]=useState(()=>{const d=sessionStorage.getItem('apheka_habit_focus_date');sessionStorage.removeItem('apheka_habit_focus_date');return d&&/^\d{4}-\d{2}-\d{2}$/.test(d)?new Date(d+'T12:00:00'):startOfToday();});
  const today = startOfToday();
  const weekStart = startOfWeek(focusDate, { weekStartsOn: 1 });
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const activeHabits = useMemo(() => habits.filter(h => !h.isArchived).sort((a, b) => (a.order || 0) - (b.order || 0)), [habits]);
  const archivedHabits = useMemo(() => habits.filter(h => h.isArchived).sort((a, b) => (a.order || 0) - (b.order || 0)), [habits]);
  const displayHabits = showArchived ? archivedHabits : activeHabits;
  const isLimitReached = activeHabits.length >= 99;

  useEffect(() => {
    if (isAdding && newInputRef.current) newInputRef.current.focus();
  }, [isAdding]);

  useEffect(() => {
    if (showArchived) { setIsEditing(false); setIsArchiveMode(false); }
    if (isArchiveMode) setShowArchived(false);
  }, [showArchived, isArchiveMode]);

  useEffect(() => {
    if (isEditing) { setIsAdding(false); setNewName(''); }
  }, [isEditing]);

  const handleAdd = useCallback(() => {
    if (newName.trim() && !isLimitReached) addHabit(newName.trim());
    setNewName('');
    setIsAdding(false);
  }, [newName, isLimitReached, addHabit]);

  const handleCheckbox = useCallback((habitId: string, dayIndex: number) => {
    const dateStr = format(weekDates[dayIndex], 'yyyy-MM-dd');
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    const newCompleted = habit.completedOn.includes(dateStr)
      ? habit.completedOn.filter(d => d !== dateStr)
      : [...habit.completedOn, dateStr];
    updateHabit(habitId, { completedOn: newCompleted });
  }, [habits, weekDates, updateHabit]);

  const weeklyDailyRates = useMemo(() => {
    if (activeHabits.length === 0) return Array(7).fill(0);
    return weekDates.map((date, di) => {
      const ds = format(date, 'yyyy-MM-dd');
      const count = activeHabits.filter(h => h.completedOn.includes(ds)).length;
      return Math.round((count / activeHabits.length) * 100);
    });
  }, [activeHabits, weekDates]);

  const finalAvgRate = useMemo(() => {
    if (activeHabits.length === 0) return 0;
    const avgDaily = weeklyDailyRates.reduce((s, r) => s + r, 0) / 7;
    const weekStrSet = new Set(weekDates.map(d => format(d, 'yyyy-MM-dd')));
    const habitAvgs = activeHabits.map(h => {
      const c = h.completedOn.filter(d => weekStrSet.has(d)).length;
      return (c / 7) * 100;
    });
    const avgHabit = habitAvgs.reduce((s, r) => s + r, 0) / activeHabits.length;
    return Math.round(avgDaily * 0.75 + avgHabit * 0.25);
  }, [activeHabits, weeklyDailyRates, weekDates]);

  const computeStreak = useCallback((completedOn: string[]) => {
    if (completedOn.length === 0) return 0;
    const set = new Set(completedOn);
    let maxStreak = 0, current = 0;
    for (const date of weekDates) {
      if (set.has(format(date, 'yyyy-MM-dd'))) {
        current++;
        maxStreak = Math.max(maxStreak, current);
      } else {
        current = 0;
      }
    }
    return maxStreak;
  }, [weekDates]);

  const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '36px minmax(0, 1fr) repeat(7, 40px) 52px',
    borderBottom: '1px solid var(--border-soft)',
  };
  const cellStyle: React.CSSProperties = {
    height: 46,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    color: 'var(--text-secondary)',
    fontWeight: 600,
    borderRight: '1px solid var(--border-soft)',
  };
  const checkboxStyle = (checked: boolean, disabled: boolean): React.CSSProperties => ({
    width: 18,
    height: 18,
    borderRadius: 4,
    border: `2px solid ${checked ? 'var(--accent)' : 'var(--border-strong)'}`,
    background: checked ? 'var(--accent)' : 'transparent',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.3 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 150ms',
    flexShrink: 0,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-soft)', flexShrink: 0 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Outfit',sans-serif", margin: 0 }}>
          {showArchived ? 'Hábitos Archivados' : 'Hábitos'}
        </h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowArchived(p => !p)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: showArchived ? 'rgba(225,29,72,0.08)' : 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}>
            <RefreshCcw size={13} /> {showArchived ? 'Volver' : 'Archivados'}
          </button>
          <button onClick={() => { setIsArchiveMode(p => !p); }}
            disabled={showArchived}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: isArchiveMode ? 'rgba(225,29,72,0.08)' : 'transparent', color: 'var(--text-secondary)', cursor: showArchived ? 'default' : 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, opacity: showArchived ? 0.3 : 1 }}>
            <Archive size={13} />
          </button>
          {!showArchived && !isArchiveMode && (
            <button onClick={() => setIsEditing(p => !p)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: isEditing ? 'rgba(225,29,72,0.08)' : 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Pencil size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {/* HabitModes solo en Ajustes > Planificador */}
        <div style={{ borderRadius: 12, border: '1px solid var(--border-soft)', overflow: 'hidden', background: 'color-mix(in srgb, var(--bg-elevated) 50%, transparent)' }}>
          {/* Header row */}
          <div style={{ ...rowStyle, borderBottom: '2px solid var(--border-soft)', background: 'color-mix(in srgb, var(--bg-elevated) 70%, transparent)', position: 'sticky', top: 0, zIndex: 2 }}>
            <div style={{ ...cellStyle, fontSize: 10, color: 'var(--text-muted)' }}>#</div>
            <div style={{ ...cellStyle, justifyContent: 'flex-start', paddingLeft: 12, fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Hábito
            </div>
            {DAYS.map((d, i) => (
              <div key={i} style={{ ...cellStyle, fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d}</div>
            ))}
            <button onClick={() => setIsStreakView(p => !p)}
              style={{ ...cellStyle, borderRight: 'none', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', background: 'transparent', border: 'none', borderLeft: '1px solid var(--border-soft)', height: 46, fontFamily: 'inherit' }}>
              {isStreakView ? 'Racha' : '%'}
            </button>
          </div>

          {/* Habit rows */}
          {displayHabits.map((habit, index) => {
            const isPast = isBefore(weekDates[0], today) && weekDates.every(d => isBefore(d, today));
            const isWaterHabit = habit.metricKind === 'water';
            const isExerciseHabit = habit.metricKind === 'exercise';
            const habitColor = isWaterHabit ? '#06B6D4' : isExerciseHabit ? '#F97316' : 'var(--accent)';
            const habitIcon = isWaterHabit ? <Droplets size={14} /> : isExerciseHabit ? <Dumbbell size={14} /> : null;
            const weeklyDone = weekDates.filter(d => habit.completedOn.includes(format(d, 'yyyy-MM-dd'))).length;
            const weeklyPct = Math.round((weeklyDone / 7) * 100);
            const handleRename = (newName: string) => {
              if (newName.trim() && newName.trim() !== habit.name) updateHabit(habit.id, { name: newName.trim() });
            };
            return (
              <div key={habit.id} style={rowStyle}>
                <div style={cellStyle}>
                  {showArchived ? (
                    <button onClick={() => updateHabit(habit.id, { isArchived: false, order: Date.now() })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4 }}>
                      <ArchiveRestore size={14} />
                    </button>
                  ) : isArchiveMode ? (
                    <button onClick={() => updateHabit(habit.id, { isArchived: true })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4 }}>
                      <Archive size={14} />
                    </button>
                  ) : isEditing ? (
                    <button onClick={() => deleteHabit(habit.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{index + 1}</span>
                  )}
                </div>
                <div style={{ ...cellStyle, justifyContent: 'flex-start', paddingLeft: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {habitIcon && <span style={{ color: habitColor }}>{habitIcon}</span>}
                  <HabitNameCell habit={habit} isEditing={isEditing && !showArchived} onRename={handleRename} />
                  {((isWaterHabit || isExerciseHabit) && habit.dailyGoal) && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: habitColor, background: `${habitColor}15`, padding: '2px 6px', borderRadius: 4 }}>
                      Meta: {habit.dailyGoal}{isWaterHabit ? ' vasos' : ' min'}
                    </span>
                  )}
                </div>
                {weekDates.map((date, di) => {
                  const ds = format(date, 'yyyy-MM-dd');
                  const checked = habit.completedOn.includes(ds);
                  const isFuture = isBefore(today, date);
                  const disabled = showArchived || (isPast && !isEditing) || isFuture;
                  const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                  return (
                    <div key={di} style={cellStyle}>
                      <div
                        onClick={() => { if (!disabled) handleCheckbox(habit.id, di); }}
                        style={{
                          ...checkboxStyle(checked, disabled),
                          borderColor: checked ? habitColor : disabled ? 'var(--border-soft)' : (isToday ? 'var(--accent)' : 'var(--border-strong)'),
                          background: checked ? habitColor : 'transparent',
                          boxShadow: checked ? `0 0 8px ${habitColor}60` : isToday && !checked ? `0 0 0 2px ${habitColor}30` : 'none',
                        }}>
                        {checked && <Check size={11} strokeWidth={3} style={{ color: '#fff' }} />}
                      </div>
                    </div>
                  );
                })}
                <div style={{ ...cellStyle, borderRight: 'none', borderLeft: '1px solid var(--border-soft)', fontSize: 13, fontWeight: 700, color: isStreakView ? 'var(--accent)' : habitColor }}>
                  {isStreakView ? computeStreak(habit.completedOn) : `${weeklyPct}%`}
                </div>
              </div>
            );
          })}

          {/* Add new habit row */}
          {isAdding && !showArchived && !isArchiveMode && (
            <div style={rowStyle}>
              <div style={cellStyle}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{displayHabits.length + 1}</span>
              </div>
              <div style={{ ...cellStyle, justifyContent: 'flex-start', paddingLeft: 12 }}>
                <input ref={newInputRef} value={newName} onChange={e => setNewName(e.target.value)}
                  onBlur={handleAdd} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setIsAdding(false); setNewName(''); } }}
                  placeholder="Nombre del hábito" maxLength={50}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit' }} />
              </div>
              {Array(7).fill(0).map((_, i) => (
                <div key={i} style={cellStyle}>
                  <div style={checkboxStyle(false, true)} />
                </div>
              ))}
              <div style={{ ...cellStyle, borderRight: 'none', borderLeft: '1px solid var(--border-soft)' }} />
            </div>
          )}

          {/* Footer row */}
          <div style={{ ...rowStyle, borderBottom: 'none', background: 'color-mix(in srgb, var(--bg-elevated) 40%, transparent)' }}>
            <div style={{ ...cellStyle, borderRight: 'none' }} />
            <div style={{ ...cellStyle, justifyContent: 'flex-start', paddingLeft: 12 }}>
              {!isAdding && !isEditing && !showArchived && !isArchiveMode && (
                <button onClick={() => { if (!isLimitReached) setIsAdding(true); }}
                  style={{ background: 'none', border: 'none', cursor: isLimitReached ? 'default' : 'pointer', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', opacity: isLimitReached ? 0.4 : 1 }}>
                  <Plus size={14} style={{ color: 'var(--accent)' }} /> Agregar hábito
                </button>
              )}
            </div>
            {weeklyDailyRates.map((rate, i) => (
              <div key={i} style={{ ...cellStyle, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                {rate}%
              </div>
            ))}
            <div style={{ ...cellStyle, borderRight: 'none', borderLeft: '1px solid var(--border-soft)', fontSize: 13, fontWeight: 700, color: isStreakView ? 'var(--text-muted)' : 'var(--accent)' }}>
              {isStreakView ? '-' : `${finalAvgRate}%`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HabitNameCell({ habit, isEditing, onRename }: { habit: Habit; isEditing: boolean; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(habit.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  useEffect(() => { setVal(habit.name); }, [habit.name]);

  const save = () => {
    if (val.trim()) onRename(val);
    else setVal(habit.name);
    setEditing(false);
  };

  const nameCellBase: React.CSSProperties = {
    height: 46,
    display: 'flex',
    alignItems: 'center',
    fontSize: 12,
    color: 'var(--text-secondary)',
    fontWeight: 600,
    borderRight: '1px solid var(--border-soft)',
  };

  if (isEditing) {
    return (
      <div style={{ ...nameCellBase, justifyContent: 'flex-start', paddingLeft: 12 }}>
        <input ref={inputRef} value={val} onChange={e => setVal(e.target.value)}
          onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setVal(habit.name); setEditing(false); } }}
          style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit' }} />
      </div>
    );
  }

  return (
    <div style={{ ...nameCellBase, justifyContent: 'flex-start', paddingLeft: 12, overflow: 'hidden' }}>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {habit.name}
      </span>
    </div>
  );
}
