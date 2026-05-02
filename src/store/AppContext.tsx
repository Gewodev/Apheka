import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface Task {
  id: string;
  title: string;
  course: string;
  courseColor: string;
  status: 'inicio' | 'progreso' | 'completado' | 'simple_done';
  priority: 'high' | 'medium' | 'low';
  urgent: boolean;
  dueDate?: string;
  checkType: 'simple' | 'progressive';
  createdAt: string;
  completedAt?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  course: string;
  courseColor: string;
  groupId?: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
}

export interface NoteGroup {
  id: string;
  name: string;
  color: string;
}

export interface Course {
  id: string;
  name: string;
  color: string;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  hoursStudied: number;
  nextExam?: string;
  grade?: string;
}

export interface ScheduleBlock {
  id: string;
  dayIndex: number;
  title: string;
  course: string;
  color: string;
  startTime: string;
  endTime: string;
}

export interface Settings {
  theme: 'claro' | 'oscuro' | 'sistema';
  fontSize: 'small' | 'medium' | 'large';
  language: string;
  notifications: boolean;
  soundEffects: boolean;
  dailyGoal: number;
  pomodoroGoal: number;
}

interface AppState {
  tasks: Task[];
  notes: Note[];
  noteGroups: NoteGroup[];
  courses: Course[];
  schedule: ScheduleBlock[];
  settings: Settings;
  sessionTime: number;
  pomodoroSessions: number;
}

interface AppContextType extends AppState {
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'status'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTaskStatus: (id: string) => void;
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  addNoteGroup: (name: string, color: string) => void;
  addScheduleBlock: (block: Omit<ScheduleBlock, 'id'>) => void;
  deleteScheduleBlock: (id: string) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  incrementSessionTime: () => void;
  incrementPomodoroSessions: () => void;
  resetPomodoroSessions: () => void;
  addCourse: (course: Omit<Course, 'id'>) => void;
  deleteCourse: (id: string) => void;
}

const defaultCourses: Course[] = [
  { id: '1', name: 'Matemáticas', color: '#6366f1', progress: 72, totalTasks: 25, completedTasks: 18, hoursStudied: 12.5, nextExam: '20 Abril', grade: '7.2' },
  { id: '2', name: 'Física', color: '#10b981', progress: 58, totalTasks: 18, completedTasks: 10, hoursStudied: 8.3, nextExam: '22 Abril', grade: '6.8' },
  { id: '3', name: 'Historia', color: '#f59e0b', progress: 85, totalTasks: 12, completedTasks: 10, hoursStudied: 6.2, nextExam: '25 Abril', grade: '8.1' },
  { id: '4', name: 'Inglés', color: '#ec4899', progress: 90, totalTasks: 20, completedTasks: 18, hoursStudied: 5.8, grade: '8.4' },
  { id: '5', name: 'Computación', color: '#06b6d4', progress: 45, totalTasks: 15, completedTasks: 7, hoursStudied: 4.5, grade: '6.5' },
];

const defaultSettings: Settings = {
  theme: 'oscuro',
  fontSize: 'medium',
  language: 'es',
  notifications: true,
  soundEffects: true,
  dailyGoal: 240,
  pomodoroGoal: 4,
};

const STORAGE_KEY = 'owa_studio_data';

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteGroups, setNoteGroups] = useState<NoteGroup[]>([
    { id: '1', name: 'Matemáticas', color: '#6366f1' },
    { id: '2', name: 'Física', color: '#10b981' },
    { id: '3', name: 'Historia', color: '#f59e0b' },
  ]);
  const [courses, setCourses] = useState<Course[]>(defaultCourses);
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [sessionTime, setSessionTime] = useState(0);
  const [pomodoroSessions, setPomodoroSessions] = useState(0);

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.tasks) setTasks(data.tasks);
        if (data.notes) setNotes(data.notes);
        if (data.noteGroups) setNoteGroups(data.noteGroups);
        if (data.courses) setCourses(data.courses);
        if (data.schedule) setSchedule(data.schedule);
        if (data.settings) setSettings({ ...defaultSettings, ...data.settings });
        if (data.sessionTime) setSessionTime(data.sessionTime);
        if (data.pomodoroSessions) setPomodoroSessions(data.pomodoroSessions);
      } catch (e) {
        console.error('Error loading data:', e);
      }
    }
  }, []);

  // Debounced save to localStorage
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      const data: Partial<AppState> = {
        tasks, notes, noteGroups, courses, schedule, settings, sessionTime, pomodoroSessions
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }, 500);
    return () => clearTimeout(saveTimeout);
  }, [tasks, notes, noteGroups, courses, schedule, settings, sessionTime, pomodoroSessions]);

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'status'>) => {
    const newTask: Task = {
      ...task,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      status: 'inicio',
    };
    setTasks(prev => [...prev, newTask]);
    
    setCourses(prev => prev.map(c => 
      c.name === task.course 
        ? { ...c, totalTasks: c.totalTasks + 1 }
        : c
    ));
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === id);
      if (task) {
        setCourses(prevCourses => prevCourses.map(c => 
          c.name === task.course 
            ? { 
                ...c, 
                totalTasks: Math.max(0, c.totalTasks - 1), 
                completedTasks: task.status === 'completado' || task.status === 'simple_done' 
                  ? Math.max(0, c.completedTasks - 1) 
                  : c.completedTasks 
              }
            : c
        ));
      }
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const toggleTaskStatus = useCallback((id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      
      let newStatus: Task['status'] = t.status;
      
      if (t.checkType === 'simple') {
        newStatus = t.status === 'simple_done' ? 'inicio' : 'simple_done';
      } else {
        if (t.status === 'inicio') newStatus = 'progreso';
        else if (t.status === 'progreso') newStatus = 'completado';
        else newStatus = 'inicio';
      }
      
      return {
        ...t,
        status: newStatus,
        completedAt: newStatus === 'completado' || newStatus === 'simple_done' ? new Date().toISOString() : undefined
      };
    }));
  }, []);

  const addNote = useCallback((note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newNote: Note = {
      ...note,
      id: Date.now().toString(),
      createdAt: now,
      updatedAt: now,
    };
    setNotes(prev => [...prev, newNote]);
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    setNotes(prev => prev.map(n => 
      n.id === id 
        ? { ...n, ...updates, updatedAt: new Date().toISOString() }
        : n
    ));
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  }, []);

  const addNoteGroup = useCallback((name: string, color: string) => {
    const newGroup: NoteGroup = {
      id: Date.now().toString(),
      name,
      color,
    };
    setNoteGroups(prev => [...prev, newGroup]);
  }, []);

  const addScheduleBlock = useCallback((block: Omit<ScheduleBlock, 'id'>) => {
    const newBlock: ScheduleBlock = {
      ...block,
      id: Date.now().toString(),
    };
    setSchedule(prev => [...prev, newBlock]);
  }, []);

  const deleteScheduleBlock = useCallback((id: string) => {
    setSchedule(prev => prev.filter(b => b.id !== id));
  }, []);

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const incrementSessionTime = useCallback(() => {
    setSessionTime(prev => prev + 1);
  }, []);

  const incrementPomodoroSessions = useCallback(() => {
    setPomodoroSessions(prev => prev + 1);
  }, []);

  const resetPomodoroSessions = useCallback(() => {
    setPomodoroSessions(0);
  }, []);

  const addCourse = useCallback((course: Omit<Course, 'id'>) => {
    const newCourse: Course = {
      ...course,
      id: Date.now().toString(),
    };
    setCourses(prev => [...prev, newCourse]);
  }, []);

  const deleteCourse = useCallback((id: string) => {
    setCourses(prev => prev.filter(c => c.id !== id));
    // Also delete related tasks and notes
    setTasks(prev => prev.filter(t => {
      const course = courses.find(c => c.id === id);
      return !course || t.course !== course.name;
    }));
    setNotes(prev => prev.filter(n => {
      const course = courses.find(c => c.id === id);
      return !course || n.course !== course.name;
    }));
  }, [courses]);

  const value: AppContextType = {
    tasks, notes, noteGroups, courses, schedule, settings, sessionTime, pomodoroSessions,
    addTask, updateTask, deleteTask, toggleTaskStatus,
    addNote, updateNote, deleteNote, addNoteGroup,
    addScheduleBlock, deleteScheduleBlock,
    updateSettings, incrementSessionTime, incrementPomodoroSessions, resetPomodoroSessions,
    addCourse, deleteCourse
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
