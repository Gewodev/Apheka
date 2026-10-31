import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const LAST_SESSION_KEY = 'owa_last_planned_session';

function dateKey(courseId: string) { return `owa_estudio_planner_date_${courseId}`; }
function manualKey(courseId: string) { return `owa_estudio_planner_manual_${courseId}`; }

export interface PlannerDay {
  plannerDate: string;
  setPlannerDate: (iso: string) => void;
  markManual: (iso: string) => void;
}

export function usePlannerDay(courseId?: string | null): PlannerDay {
  const [plannerDate, setPlannerDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const lastDayRef = useRef(format(new Date(), 'yyyy-MM-dd'));
  const [todayTick, setTodayTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      const cur = format(new Date(), 'yyyy-MM-dd');
      if (cur === lastDayRef.current) return;
      lastDayRef.current = cur;
      if (courseId) {
        try { localStorage.setItem(manualKey(courseId), '0'); } catch { /* noop */ }
        try { localStorage.setItem(dateKey(courseId), cur); } catch { /* noop */ }
      }
      setTodayTick(x => x + 1);
    }, 30000);
    return () => clearInterval(t);
  }, [courseId]);

  useEffect(() => {
    setPlannerDate(format(new Date(), 'yyyy-MM-dd'));
  }, [todayTick]);

  useEffect(() => {
    if (!courseId) return;
    try {
      const lastRaw = localStorage.getItem(LAST_SESSION_KEY);
      if (lastRaw) {
        localStorage.removeItem(LAST_SESSION_KEY);
        const last = JSON.parse(lastRaw);
        if (last && last.courseId === courseId && typeof last.date === 'string' && ISO_DAY_RE.test(last.date)) {
          setPlannerDate(last.date);
          try { localStorage.setItem(dateKey(courseId), last.date); } catch { /* noop */ }
          try { localStorage.setItem(manualKey(courseId), format(new Date(), 'yyyy-MM-dd')); } catch { /* noop */ }
          return;
        }
      }
    } catch { /* noop */ }
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const manualRaw = localStorage.getItem(manualKey(courseId));
    const manualDay = manualRaw && ISO_DAY_RE.test(manualRaw) ? manualRaw : null;
    const saved = localStorage.getItem(dateKey(courseId));
    const savedOk = saved && ISO_DAY_RE.test(saved) ? saved : null;
    if (manualDay === todayStr && savedOk) {
      setPlannerDate(savedOk);
      return;
    }
    if (manualDay && manualDay !== todayStr) {
      try { localStorage.setItem(manualKey(courseId), '0'); } catch { /* noop */ }
    }
    setPlannerDate(todayStr);
    try { localStorage.setItem(dateKey(courseId), todayStr); } catch { /* noop */ }
  }, [courseId]);

  const markManual = (iso: string) => {
    if (!courseId) return;
    try { localStorage.setItem(manualKey(courseId), format(new Date(), 'yyyy-MM-dd')); } catch { /* noop */ }
    try { localStorage.setItem(dateKey(courseId), iso); } catch { /* noop */ }
    setPlannerDate(iso);
  };

  return { plannerDate, setPlannerDate, markManual };
}
