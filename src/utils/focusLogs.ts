import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { PomodoroSession } from '../types';

export const FOCUS_LOG_RETENTION_DAYS = 7;

/**
 * Checks whether a focus session (Pomodoro or Stopwatch) falls within the last `maxDays` calendar days
 * (default: 7 days, i.e. today and the previous 6 days). Sessions older than `maxDays` days return false.
 */
export function isFocusSessionWithinDays(
  session: PomodoroSession,
  now: Date = new Date(),
  maxDays: number = FOCUS_LOG_RETENTION_DAYS
): boolean {
  const timestamp = session.startTime || session.endTime;
  if (!timestamp) return false;
  try {
    const sessionDate = parseISO(timestamp);
    if (isNaN(sessionDate.getTime())) return false;
    const diff = differenceInCalendarDays(now, sessionDate);
    return diff < maxDays;
  } catch {
    return false;
  }
}

/**
 * Removes Pomodoro and Stopwatch focus logs older than `maxDays` days (default: 7 days).
 */
export function pruneOldFocusSessions(
  sessions: PomodoroSession[],
  now: Date = new Date(),
  maxDays: number = FOCUS_LOG_RETENTION_DAYS
): PomodoroSession[] {
  return sessions.filter((session) => isFocusSessionWithinDays(session, now, maxDays));
}
