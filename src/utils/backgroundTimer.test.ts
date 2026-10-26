import { beforeEach, describe, expect, it } from 'vitest';
import { backgroundTimerEngine } from './backgroundTimer';

describe('BackgroundTimerEngine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with default values when storage is empty', () => {
    const state = backgroundTimerEngine.getInitialState(1500);
    expect(state.isRunning).toBe(false);
    expect(state.mode).toBe('pomo');
    expect(state.pomoPhase).toBe('work');
    expect(state.secondsLeft).toBe(1500);
    expect(state.stopwatchSeconds).toBe(0);
    expect(state.targetEndTimestamp).toBeNull();
    expect(state.stopwatchBaseTimestamp).toBeNull();
  });

  it('correctly calculates stopwatch elapsed time based on wall-clock base timestamp', () => {
    const elapsedInitial = 45;
    backgroundTimerEngine.startStopwatch(elapsedInitial);

    const baseStr = localStorage.getItem('ticktick_timer_stopwatch_base');
    expect(baseStr).not.toBeNull();
    const base = Number(baseStr);
    expect(base).toBeLessThanOrEqual(Date.now() - elapsedInitial * 1000);

    const isRunning = localStorage.getItem('ticktick_timer_running');
    expect(isRunning).toBe('true');
    const mode = localStorage.getItem('ticktick_timer_mode');
    expect(mode).toBe('stopwatch');
  });

  it('correctly calculates pomodoro remaining time based on wall-clock target timestamp', () => {
    const duration = 25 * 60; // 1500s
    backgroundTimerEngine.startPomodoro(duration, 'work', 'Deep Work Session');

    const targetEndStr = localStorage.getItem('ticktick_timer_target_end');
    expect(targetEndStr).not.toBeNull();
    const targetEnd = Number(targetEndStr);
    expect(targetEnd).toBeGreaterThan(Date.now());

    const isRunning = localStorage.getItem('ticktick_timer_running');
    expect(isRunning).toBe('true');
    const phase = localStorage.getItem('ticktick_timer_phase');
    expect(phase).toBe('work');
  });

  it('pauses and removes wall-clock targets without losing current progress', () => {
    backgroundTimerEngine.startStopwatch(60);
    backgroundTimerEngine.pauseTimer();

    expect(localStorage.getItem('ticktick_timer_running')).toBe('false');
    expect(localStorage.getItem('ticktick_timer_stopwatch_base')).toBeNull();
    expect(localStorage.getItem('ticktick_timer_stopwatch_secs')).toBeDefined();
  });

  it('resets timer cleanly to default values', () => {
    backgroundTimerEngine.startPomodoro(1500, 'work');
    backgroundTimerEngine.resetTimer(1500);

    expect(localStorage.getItem('ticktick_timer_running')).toBe('false');
    expect(localStorage.getItem('ticktick_timer_seconds_left')).toBe('1500');
    expect(localStorage.getItem('ticktick_timer_stopwatch_secs')).toBe('0');
    expect(localStorage.getItem('ticktick_timer_target_end')).toBeNull();
  });

  it('keeps stopwatch running when pomodoro mode is inspected or reset independently', () => {
    backgroundTimerEngine.startStopwatch(30);
    expect(localStorage.getItem('ticktick_timer_stopwatch_base')).not.toBeNull();

    // Resetting only pomo mode does not stop or reset the running stopwatch
    backgroundTimerEngine.resetTimer(1500, 'pomo');
    expect(localStorage.getItem('ticktick_timer_stopwatch_base')).not.toBeNull();
    expect(localStorage.getItem('ticktick_timer_running')).toBe('true');

    const state = backgroundTimerEngine.getInitialState(1500);
    expect(state.stopwatchRunning).toBe(true);
    expect(state.pomoRunning).toBe(false);
    expect(state.stopwatchSeconds).toBeGreaterThanOrEqual(30);
  });
});
