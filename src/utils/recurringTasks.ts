import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  differenceInCalendarDays,
  parseISO,
  format,
  getDay,
  getDate,
  getMonth,
  getDaysInMonth,
} from 'date-fns';
import { Task } from '../types';

/**
 * Calculates the next due date for a recurring task based on its rule.
 */
export function getNextOccurrenceDate(baseDateStr: string, rule: string): string {
  try {
    const d = parseISO(baseDateStr);
    if (isNaN(d.getTime())) {
      return format(addDays(new Date(), 1), 'yyyy-MM-dd');
    }

    switch (rule.toLowerCase()) {
      case 'daily':
        return format(addDays(d, 1), 'yyyy-MM-dd');
      case 'weekdays': {
        const next = addDays(d, 1);
        const dayOfWeek = getDay(next);
        if (dayOfWeek === 6) {
          // Saturday -> advance to Monday (+2 days)
          return format(addDays(next, 2), 'yyyy-MM-dd');
        }
        if (dayOfWeek === 0) {
          // Sunday -> advance to Monday (+1 day)
          return format(addDays(next, 1), 'yyyy-MM-dd');
        }
        return format(next, 'yyyy-MM-dd');
      }
      case 'weekly':
        return format(addWeeks(d, 1), 'yyyy-MM-dd');
      case 'monthly':
        return format(addMonths(d, 1), 'yyyy-MM-dd');
      case 'yearly':
        return format(addYears(d, 1), 'yyyy-MM-dd');
      default:
        return format(addDays(d, 1), 'yyyy-MM-dd');
    }
  } catch {
    return format(addDays(new Date(), 1), 'yyyy-MM-dd');
  }
}

/**
 * Checks if a task is scheduled on a given target date, taking into account
 * its primary dueDate and any active recurrence rule.
 */
export function isTaskDueOnDate(task: Task, targetDateStr: string): boolean {
  if (task.status === 'trash' || task.status === 'wont_do') return false;
  const dueDate = task.dueDate?.slice(0, 10);

  // Exact match on dueDate
  if (dueDate === targetDateStr) return true;

  // Non-recurring, unscheduled, or already completed tasks only appear on their exact date
  if (!task.recurrenceRule || !dueDate || task.status === 'completed') return false;

  // A recurring task does not project into the past before its base dueDate
  if (targetDateStr < dueDate) return false;

  try {
    const baseDate = parseISO(dueDate);
    const targetDate = parseISO(targetDateStr);
    if (isNaN(baseDate.getTime()) || isNaN(targetDate.getTime())) return false;

    const rule = task.recurrenceRule.toLowerCase();

    switch (rule) {
      case 'daily':
        return true;
      case 'weekdays': {
        const dow = getDay(targetDate);
        return dow >= 1 && dow <= 5;
      }
      case 'weekly':
        return getDay(targetDate) === getDay(baseDate);
      case 'monthly':
        return getDate(targetDate) === Math.min(getDate(baseDate), getDaysInMonth(targetDate));
      case 'yearly':
        return (
          getMonth(targetDate) === getMonth(baseDate) &&
          getDate(targetDate) === Math.min(getDate(baseDate), getDaysInMonth(targetDate))
        );
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Checks if a task occurs at least once within an inclusive date range [startStr, endStr].
 */
export function isTaskDueInDateRange(task: Task, startStr: string, endStr: string): boolean {
  if (task.status === 'trash' || task.status === 'wont_do') return false;
  const dueDate = task.dueDate?.slice(0, 10);
  if (dueDate && dueDate >= startStr && dueDate <= endStr) return true;
  if (!task.recurrenceRule || !dueDate || task.status === 'completed') return false;

  // Cannot occur if the first occurrence is after the end date
  if (dueDate > endStr) return false;

  // Check each day in the range (typically 7-31 days)
  let curr = parseISO(startStr);
  const end = parseISO(endStr);
  while (curr <= end) {
    const cStr = format(curr, 'yyyy-MM-dd');
    if (isTaskDueOnDate(task, cStr)) return true;
    curr = addDays(curr, 1);
  }
  return false;
}

/**
 * Checks if a completed task was completed within the given number of past days (default: 3 days).
 * Uses completedAt if present, otherwise falls back to updatedAt.
 */
export function isCompletedWithinDays(
  task: Task,
  today: Date = new Date(),
  maxDays: number = 3
): boolean {
  if (task.status !== 'completed') return false;
  const timestamp = task.completedAt || task.updatedAt;
  if (!timestamp) return true;
  try {
    const completedDate = parseISO(timestamp);
    if (isNaN(completedDate.getTime())) return true;
    const diff = differenceInCalendarDays(today, completedDate);
    return diff <= maxDays;
  } catch {
    return true;
  }
}

