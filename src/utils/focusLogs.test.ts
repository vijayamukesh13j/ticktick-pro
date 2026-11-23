import { describe, expect, it } from 'vitest';
import type { PomodoroSession } from '../types';
import {
  FOCUS_LOG_RETENTION_DAYS,
  isFocusSessionWithinDays,
  pruneOldFocusSessions,
} from './focusLogs';

const makeSession = (
  id: string,
  startTime: string,
  mode: 'pomo' | 'stopwatch' = 'pomo',
  durationMinutes = 25
): PomodoroSession => ({
  id,
  taskTitle: `Task ${id}`,
  mode,
  startTime,
  endTime: startTime,
  durationMinutes,
  note: '',
});

describe('focusLogs 7-day retention', () => {
  const now = new Date('2026-11-23T12:00:00');

  it('keeps both Pomodoro and Stopwatch sessions within the last 7 calendar days', () => {
    const todayPomo = makeSession('today', '2026-11-23T09:00:00', 'pomo');
    const sixDaysAgoStopwatch = makeSession('day6', '2026-11-17T08:00:00', 'stopwatch');

    expect(isFocusSessionWithinDays(todayPomo, now, FOCUS_LOG_RETENTION_DAYS)).toBe(true);
    expect(isFocusSessionWithinDays(sixDaysAgoStopwatch, now, FOCUS_LOG_RETENTION_DAYS)).toBe(true);
  });

  it('removes sessions that are 7 or more days old', () => {
    const sevenDaysAgoPomo = makeSession('day7', '2026-11-16T23:59:59', 'pomo');
    const tenDaysAgoStopwatch = makeSession('day10', '2026-11-13T10:00:00', 'stopwatch');

    expect(isFocusSessionWithinDays(sevenDaysAgoPomo, now, FOCUS_LOG_RETENTION_DAYS)).toBe(false);
    expect(isFocusSessionWithinDays(tenDaysAgoStopwatch, now, FOCUS_LOG_RETENTION_DAYS)).toBe(false);
  });

  it('prunes old sessions while preserving recent ones and order', () => {
    const sessions: PomodoroSession[] = [
      makeSession('s1', '2026-11-23T10:00:00', 'pomo'),
      makeSession('s2', '2026-11-19T14:00:00', 'stopwatch'),
      makeSession('s3', '2026-11-17T09:00:00', 'pomo'),
      makeSession('s4', '2026-11-16T18:00:00', 'stopwatch'),
      makeSession('s5', '2026-11-01T10:00:00', 'pomo'),
      makeSession('s6', 'invalid-date', 'pomo'),
    ];

    const pruned = pruneOldFocusSessions(sessions, now);
    expect(pruned.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
  });
});
