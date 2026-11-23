import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Task } from '../types';

export const TRASH_RETENTION_DAYS = 30;

/**
 * Returns true if a trashed task has been in Trash for `maxDays` or more calendar days (default: 30 days).
 * Non-trashed tasks always return false.
 */
export function isTrashTaskExpired(
  task: Task,
  now: Date = new Date(),
  maxDays: number = TRASH_RETENTION_DAYS
): boolean {
  if (task.status !== 'trash') return false;
  const timestamp = task.updatedAt || task.createdAt;
  if (!timestamp) return false;
  try {
    const trashedDate = parseISO(timestamp);
    if (isNaN(trashedDate.getTime())) return false;
    const diff = differenceInCalendarDays(now, trashedDate);
    return diff >= maxDays;
  } catch {
    return false;
  }
}

/**
 * Automatically removes tasks that have been sitting in Trash for 30+ days while preserving all active,
 * completed, and recently trashed tasks.
 */
export function pruneExpiredTrashTasks(
  tasks: Task[],
  now: Date = new Date(),
  maxDays: number = TRASH_RETENTION_DAYS
): Task[] {
  return tasks.filter((task) => !isTrashTaskExpired(task, now, maxDays));
}
