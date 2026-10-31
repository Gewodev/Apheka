import { localDate } from './eventOccurrence.ts';

export function getGoalForDay(day: string, current: number, history?: Record<string, number>, initial?: number): number {
  const dates = Object.keys(history || {}).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key)).sort();
  const change = dates.reverse().find(key => key <= day);
  const value = change ? history![change] : initial ?? current;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Keep yesterday's streak while today is still in progress; use local calendar days. */
export function calculateStreak(totals: Record<string, number>, goal: number, history?: Record<string, number>, initial?: number, now = new Date()): number {
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const met = (date: Date) => {
    const day = localDate(date);
    const target = getGoalForDay(day, goal, history, initial);
    const seconds = totals[day];
    return target > 0 && Number.isFinite(seconds) && seconds >= target * 60;
  };
  if (!met(cursor)) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  const limit = Object.keys(totals).length;
  while (count < limit && met(cursor)) { count++; cursor.setDate(cursor.getDate() - 1); }
  return count;
}
