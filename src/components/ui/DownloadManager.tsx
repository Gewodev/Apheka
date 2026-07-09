import React, { useState, useEffect, useCallback } from 'react';
import { X, Download, FileText, CheckCircle, AlertCircle, Loader2, ChevronUp, ChevronDown } from 'lucide-react';

export interface DownloadTask {
  id: string;
  name: string;
  type: 'pdf' | 'html' | 'json' | 'file' | 'audio';
  status: 'pending' | 'downloading' | 'completed' | 'error';
  progress?: number;
  error?: string;
  data?: Blob | string;
}

let taskIdCounter = 0;
const listeners = new Set<(tasks: DownloadTask[]) => void>();
let tasks: DownloadTask[] = [];

function notify() {
  for (const l of listeners) l([...tasks]);
}

export function createDownloadTask(name: string, type: DownloadTask['type']): string {
  const id = 'dl_' + (++taskIdCounter);
  tasks = [...tasks, { id, name, type, status: 'pending' }];
  notify();
  return id;
}

export function updateDownloadTask(id: string, updates: Partial<DownloadTask>) {
  tasks = tasks.map(t => t.id === id ? { ...t, ...updates } : t);
  notify();
}

export function completeDownloadTask(id: string, data?: Blob | string) {
  tasks = tasks.map(t => t.id === id ? { ...t, status: 'completed', progress: 100, data } : t);
  setTimeout(() => {
    tasks = tasks.filter(t => t.id !== id);
    notify();
  }, 5000);
  notify();
}

export function failDownloadTask(id: string, error: string) {
  tasks = tasks.map(t => t.id === id ? { ...t, status: 'error', error } : t);
  setTimeout(() => {
    tasks = tasks.filter(t => t.id !== id);
    notify();
  }, 8000);
  notify();
}

export function subscribeToTasks(cb: (tasks: DownloadTask[]) => void) {
  listeners.add(cb);
  cb([...tasks]);
  return () => { listeners.delete(cb); };
}

export function useDownloadTasks(): DownloadTask[] {
  const [state, setState] = useState<DownloadTask[]>([]);
  useEffect(() => subscribeToTasks(setState), []);
  return state;
}

export default function DownloadManager() {
  const [expanded, setExpanded] = useState(true);
  const downloadTasks = useDownloadTasks();

  if (downloadTasks.length === 0) return null;

  const activeCount = downloadTasks.filter(t => t.status === 'pending' || t.status === 'downloading').length;
  const isActive = activeCount > 0;

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
      width: 320, maxHeight: 360,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      fontSize: 12,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-elevated)',
        cursor: 'pointer',
      }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isActive ? (
            <Loader2 size={13} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
          ) : (
            <CheckCircle size={13} style={{ color: 'var(--success)' }} />
          )}
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 11 }}>
            {activeCount > 0 ? `Exportando (${activeCount})` : 'Exportaciones'}
          </span>
        </div>
        {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </div>
      {expanded && (
        <div style={{ overflow: 'auto', maxHeight: 280, padding: '4px 0' }}>
          {downloadTasks.map(task => (
            <div key={task.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px',
              borderBottom: '1px solid var(--border-subtle)',
              opacity: task.status === 'completed' ? 0.6 : 1,
            }}>
              {task.status === 'completed' ? (
                <CheckCircle size={12} style={{ color: 'var(--success)', flexShrink: 0 }} />
              ) : task.status === 'error' ? (
                <AlertCircle size={12} style={{ color: '#EF4444', flexShrink: 0 }} />
              ) : task.status === 'downloading' ? (
                <Loader2 size={12} style={{ color: 'var(--accent)', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
              ) : (
                <FileText size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.name}</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{task.type.toUpperCase()}</div>
              </div>
              {task.status === 'downloading' && task.progress != null && (
                <div style={{ width: 40, height: 3, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${task.progress}%`, height: '100%', background: 'var(--accent)', borderRadius: 2, transition: 'width 200ms' }} />
                </div>
              )}
              {task.status === 'error' && (
                <span style={{ fontSize: 9, color: '#EF4444', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.error}</span>
              )}
              <button onClick={() => {
                tasks = tasks.filter(t => t.id !== task.id);
                notify();
              }} style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', borderRadius: 3, flexShrink: 0 }}>
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
