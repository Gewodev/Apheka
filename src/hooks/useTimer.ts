import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../store/AppContext';

/**
 * Hook encapsulating the timer logic for the Estudio view.
 * Handles pomodoro & chrono modes, short breaks, round counting and sideâ€‘effects
 * (toasts, session persistence, pomodoro increment, etc.).
 */
export function useTimer() {
  // Global app state needed for sideâ€‘effects
  const {
    settings,
    incrementPomodoroSessions,
    addStudySession,
    isTimerActive,
    setIsTimerActive,
    sessionTime,
    setSessionTime,
    dailyStudyTime,
    setDailyStudyTime,
    weeklyStudyTime,
    setWeeklyStudyTime,
    activeTaskId,
    tasks,
    setTasks,
    isRest,
    setIsRest,
    sessionType,
    setSessionType,
    pomodoroSessions,
    setPomodoroSessions,
    // UI state for completion dialog
    showCompletion,
    setShowCompletion,
    resetTimer,
    addNotification,
    distractionCount,
    accumulatedPauseTime,
  } = useApp();

  // Local UI state
  const [chronoRoundCounted, setChronoRoundCounted] = useState(false);
  const [chronoRounds, setChronoRounds] = useState(0);
  const chronoGoal = settings.chronoGoal ?? 25 * 60; // seconds, default 25â€¯min

  const sessionTimeRef = useRef(sessionTime);
  sessionTimeRef.current = sessionTime;

  // ---------------------------------------------------------------------------
  // Timer sideâ€‘effects â€“ runs when the timer is active
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Cronómetro round detection â€“ count a round when the goal is reached
    if (
      isTimerActive &&
      sessionType === 'chrono' &&
      sessionTime >= chronoGoal &&
      !chronoRoundCounted
    ) {
      setChronoRounds((prev) => prev + 1);
      setChronoRoundCounted(true);
    }

    if (!isTimerActive || sessionType !== 'chrono') {
      setChronoRoundCounted(false);
    }
  }, [
    isTimerActive,
    sessionTime,
    sessionType,
    isRest,
    chronoGoal,
    chronoRoundCounted,
  ]);

  // Note: The core timer interval has been consolidated into AppContext.tsx to avoid double-ticking.
  // The global interval increments sessionTime, dailyStudyTime, weeklyStudyTime, and task studyTime.


  // ---------------------------------------------------------------------------
  // Helper UI calculations
  // ---------------------------------------------------------------------------
  const pomoLimit = settings.pomodoroTime || 1500;
  const displayTime =
    sessionType === 'pomodoro'
      ? Math.max(0, pomoLimit - sessionTime)
      : sessionTime;

  const progressPct =
    sessionType === 'pomodoro' && pomoLimit
      ? Math.min(100, (sessionTime / pomoLimit) * 100)
      : 0;

  const pomoGoal = (settings.pomodoroGoal ?? 4) || 1;
  const isLongBreak = isRest && pomodoroSessions > 0 && (pomodoroSessions % pomoGoal) === 0;
  const restDuration = isLongBreak ? (settings.longBreakTime || 900) : (settings.shortBreakTime || 300);
  const restElapsed = isRest ? sessionTime : 0;
  const restTimeLeft = isRest ? Math.max(0, restDuration - restElapsed) : 0;
  const restProgressPct = isRest && restDuration
    ? Math.min(100, (restElapsed / restDuration) * 100)
    : 0;

  const currentProgress = isRest ? restProgressPct : progressPct;

  // ---------------------------------------------------------------------------
  // UI event handlers â€“ thin wrappers that also keep the global context in sync
  // ---------------------------------------------------------------------------
  const handleToggle = useCallback(() => {
    setIsTimerActive(prev => !prev);
  }, [setIsTimerActive]);

  const handleReset = useCallback((opts?: { isDistraction?: boolean }) => {
    // Only persist when warned distraction session (>= 60s && !isBreak)
    // Unwarned short resets are discarded — they should not appear in activity feed
    if (sessionTime >= 10 && opts?.isDistraction) {
      addStudySession({
        type: sessionType,
        startedAt: new Date(Date.now() - sessionTime * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        duration: sessionTime,
        taskId: activeTaskId ?? undefined,
        courseId: undefined,
        pauseCount: distractionCount,
        pauseDuration: accumulatedPauseTime,
        isDistraction: true,
      });
    }
    resetTimer();
  }, [sessionTime, sessionType, activeTaskId, addStudySession, resetTimer, distractionCount, accumulatedPauseTime]);

  const handleTypeChange = useCallback(
    (type: 'pomodoro' | 'chrono') => {
      if (isTimerActive || isRest || sessionTime > 0) {
        return;
      }
      setSessionType(type);
      setSessionTime(0);
    },
    [isTimerActive, isRest, sessionTime, setSessionType, setSessionTime],
  );

  // ---------------------------------------------------------------------------
  // Exported values for the UI component
  // ---------------------------------------------------------------------------
  return {
    // mode
    sessionType,
    setSessionType,
    // chrono specifics
    chronoRounds,
    chronoGoal,
    // timer state
    isTimerActive,
    isRest,
    sessionTime,
    displayTime,
    restTimeLeft,
    currentProgress,
    // progress numbers for UI
    pomodoroProgress: Math.min(pomodoroSessions, pomoGoal),
    pomodoroGoal: pomoGoal,
    pomodoroSessions,
    // handlers
    handleToggle,
    handleReset,
    handleTypeChange,
    // state setters (for component overrides)
    setIsRest,
    setSessionTime,
    setChronoRounds,
    // UI helpers
    tipIndex: 0,
    conceptIndex: 0,
  };
}



