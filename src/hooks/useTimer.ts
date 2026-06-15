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
  } = useApp();

  // Local UI state
  const [chronoRoundCounted, setChronoRoundCounted] = useState(false);
  const [chronoRounds, setChronoRounds] = useState(0);
  const chronoGoal = settings.chronoGoal ?? 25 * 60; // seconds, default 25â€¯min

  const hasTriggeredRef = useRef(false);
  const restStartRef = useRef(0);

  // ---------------------------------------------------------------------------
  // Timer sideâ€‘effects â€“ runs when the timer is active
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Pomodoro completion
    if (
      isTimerActive &&
      !isRest &&
      sessionType === 'pomodoro' &&
      sessionTime >= (settings.pomodoroTime ?? 1500) &&
      !hasTriggeredRef.current
    ) {
      hasTriggeredRef.current = true;
      setIsRest(true);
      restStartRef.current = sessionTime;
      incrementPomodoroSessions();
      setShowCompletion(true);
    }

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

    // Reset helpers when timer stops or mode changes
    if (isRest || !isTimerActive || sessionType !== 'pomodoro') {
      hasTriggeredRef.current = false;
    }
    if (!isTimerActive || sessionType !== 'chrono') {
      setChronoRoundCounted(false);
    }
  }, [
    isTimerActive,
    sessionTime,
    sessionType,
    isRest,
    settings.pomodoroTime,
    chronoGoal,
    chronoRoundCounted,
  ]);

  // Note: The core timer interval has been consolidated into AppContext.tsx to avoid double-ticking.
  // The global interval increments sessionTime, dailyStudyTime, weeklyStudyTime, and task studyTime.


  // ---------------------------------------------------------------------------
  // Helper UI calculations
  // ---------------------------------------------------------------------------
  const displayTime =
    sessionType === 'pomodoro'
      ? Math.max(0, (settings.pomodoroTime ?? 1500) - sessionTime)
      : sessionTime;

  const progressPct =
    sessionType === 'pomodoro' && settings.pomodoroTime
      ? Math.min(100, (sessionTime / settings.pomodoroTime) * 100)
      : 0;

  const restElapsed = isRest ? sessionTime - restStartRef.current : 0;
  const restTimeLeft = isRest ? Math.max(0, (settings.shortBreakTime ?? 300) - restElapsed) : 0;
  const restProgressPct = isRest && settings.shortBreakTime
    ? Math.min(100, (restElapsed / settings.shortBreakTime) * 100)
    : 0;

  const currentProgress = isRest ? restProgressPct : progressPct;

  // ---------------------------------------------------------------------------
  // UI event handlers â€“ thin wrappers that also keep the global context in sync
  // ---------------------------------------------------------------------------
  const handleToggle = useCallback(() => {
    setIsTimerActive(prev => !prev);
  }, [setIsTimerActive]);

  const handleReset = useCallback(() => {
    if (isTimerActive) {
      return;
    }
    // Persist the session if it was long enough (>= 10s)
    if (sessionTime >= 10) {
      addStudySession({
        type: sessionType,
        startedAt: new Date(Date.now() - sessionTime * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        duration: sessionTime,
        taskId: activeTaskId ?? undefined,
        courseId: undefined,
        pauseCount: 0,
        pauseDuration: 0,
      });
    }
    // Reset timer state
    resetTimer();
  }, [sessionTime, sessionType, activeTaskId, addStudySession, resetTimer, isTimerActive]);

  const handleTypeChange = useCallback(
    (type: 'pomodoro' | 'chrono') => {
      if (isTimerActive || isRest) {
        return;
      }
      setSessionType(type);
      setSessionTime(0);
    },
    [isTimerActive, isRest, setSessionType, setSessionTime],
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
    pomodoroProgress: Math.min(pomodoroSessions, settings.pomodoroGoal ?? 4),
    pomodoroGoal: settings.pomodoroGoal ?? 4,
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



