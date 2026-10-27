import { describe, it, expect } from 'vitest';
import {
  getNextOccurrenceDate,
  isTaskDueOnDate,
  isTaskDueInDateRange,
  isCompletedWithinDays,
} from './recurringTasks';
import { Task } from '../types';

describe('recurringTasks utility', () => {
  it('correctly advances daily tasks', () => {
    expect(getNextOccurrenceDate('2026-10-25', 'daily')).toBe('2026-10-26');
    expect(getNextOccurrenceDate('2026-12-31', 'daily')).toBe('2027-01-01');
  });

  it('correctly advances weekdays tasks skipping weekends', () => {
    // Friday -> Monday
    expect(getNextOccurrenceDate('2026-10-23', 'weekdays')).toBe('2026-10-26');
    // Monday -> Tuesday
    expect(getNextOccurrenceDate('2026-10-26', 'weekdays')).toBe('2026-10-27');
  });

  it('correctly advances weekly, monthly, and yearly tasks', () => {
    expect(getNextOccurrenceDate('2026-10-25', 'weekly')).toBe('2026-11-01');
    expect(getNextOccurrenceDate('2026-10-25', 'monthly')).toBe('2026-11-25');
    expect(getNextOccurrenceDate('2026-10-25', 'yearly')).toBe('2027-10-25');
  });

  it('evaluates isTaskDueOnDate for recurring rules', () => {
    const dailyTask: Task = {
      id: 'task-1',
      title: 'Daily Standup',
      content: '',
      isNote: false,
      isAllDay: true,
      status: 'todo',
      priority: 3,
      listId: 'inbox',
      dueDate: '2026-10-25',
      recurrenceRule: 'daily',
      tags: [],
      subtasks: [],
      attachments: [],
      comments: [],
      activities: [],
      reminders: [],
      constantReminder: false,
      emailReminder: false,
      estimatedPomos: 0,
      completedPomos: 0,
      focusSeconds: 0,
      isPinned: false,
      sortOrder: 0,
      createdAt: '2026-10-25T00:00:00.000Z',
      updatedAt: '2026-10-25T00:00:00.000Z',
    };

    // Past date before initial dueDate
    expect(isTaskDueOnDate(dailyTask, '2026-10-24')).toBe(false);
    // Exact due date
    expect(isTaskDueOnDate(dailyTask, '2026-10-25')).toBe(true);
    // Future date
    expect(isTaskDueOnDate(dailyTask, '2026-10-26')).toBe(true);
    expect(isTaskDueOnDate(dailyTask, '2026-11-15')).toBe(true);

    const weekdayTask: Task = {
      ...dailyTask,
      id: 'task-2',
      dueDate: '2026-10-23', // Friday
      recurrenceRule: 'weekdays',
    };
    expect(isTaskDueOnDate(weekdayTask, '2026-10-24')).toBe(false); // Saturday
    expect(isTaskDueOnDate(weekdayTask, '2026-10-25')).toBe(false); // Sunday
    expect(isTaskDueOnDate(weekdayTask, '2026-10-26')).toBe(true); // Monday

    const weeklyTask: Task = {
      ...dailyTask,
      id: 'task-3',
      dueDate: '2026-10-25', // Sunday
      recurrenceRule: 'weekly',
    };
    expect(isTaskDueOnDate(weeklyTask, '2026-10-25')).toBe(true); // Sunday
    expect(isTaskDueOnDate(weeklyTask, '2026-10-26')).toBe(false); // Monday
    expect(isTaskDueOnDate(weeklyTask, '2026-11-01')).toBe(true); // Next Sunday

    // Monthly task on 31st properly clamps to 30th in 30-day months
    const monthEndTask: Task = {
      ...dailyTask,
      id: 'task-31',
      dueDate: '2026-01-31',
      recurrenceRule: 'monthly',
    };
    expect(isTaskDueOnDate(monthEndTask, '2026-04-30')).toBe(true); // April has 30 days
    expect(isTaskDueOnDate(monthEndTask, '2026-02-28')).toBe(true); // Feb 2026 has 28 days

    // ISO datetime format normalization
    const isoTask: Task = {
      ...dailyTask,
      id: 'task-iso',
      dueDate: '2026-10-25T14:30:00.000Z',
      recurrenceRule: undefined,
    };
    expect(isTaskDueOnDate(isoTask, '2026-10-25')).toBe(true);
    expect(isTaskDueInDateRange(isoTask, '2026-10-24', '2026-10-26')).toBe(true);
  });

  it('checks isTaskDueInDateRange accurately', () => {
    const weeklyTask: Task = {
      id: 'task-3',
      title: 'Weekly Review',
      content: '',
      isNote: false,
      isAllDay: true,
      status: 'todo',
      priority: 1,
      listId: 'inbox',
      dueDate: '2026-10-25', // Sunday
      recurrenceRule: 'weekly',
      tags: [],
      subtasks: [],
      attachments: [],
      comments: [],
      activities: [],
      reminders: [],
      constantReminder: false,
      emailReminder: false,
      estimatedPomos: 0,
      completedPomos: 0,
      focusSeconds: 0,
      isPinned: false,
      sortOrder: 0,
      createdAt: '2026-10-25T00:00:00.000Z',
      updatedAt: '2026-10-25T00:00:00.000Z',
    };

    // Range Oct 26 to Oct 31 (Mon - Sat) -> does not include Sunday
    expect(isTaskDueInDateRange(weeklyTask, '2026-10-26', '2026-10-31')).toBe(false);
    // Range Oct 26 to Nov 02 -> includes Nov 01 (Sunday)
    expect(isTaskDueInDateRange(weeklyTask, '2026-10-26', '2026-11-02')).toBe(true);
  });

  it('filters completed tasks within past 3 days and cleans older tasks', () => {
    const today = new Date('2026-10-27T12:00:00.000Z');

    const baseTask: Task = {
      id: 'task-test',
      title: 'Completed Task',
      content: '',
      isNote: false,
      isAllDay: true,
      status: 'completed',
      priority: 1,
      listId: 'inbox',
      tags: [],
      subtasks: [],
      attachments: [],
      comments: [],
      activities: [],
      reminders: [],
      constantReminder: false,
      emailReminder: false,
      estimatedPomos: 0,
      completedPomos: 0,
      focusSeconds: 0,
      isPinned: false,
      sortOrder: 0,
      createdAt: '2026-10-20T00:00:00.000Z',
      updatedAt: '2026-10-27T00:00:00.000Z',
    };

    // Returns false if task is not completed
    expect(isCompletedWithinDays({ ...baseTask, status: 'todo' }, today, 3)).toBe(false);

    // Completed today (0 days ago) -> true
    expect(isCompletedWithinDays({ ...baseTask, completedAt: '2026-10-27T09:00:00.000Z' }, today, 3)).toBe(true);

    // Completed 1 day ago -> true
    expect(isCompletedWithinDays({ ...baseTask, completedAt: '2026-10-26T18:00:00.000Z' }, today, 3)).toBe(true);

    // Completed 2 days ago -> true
    expect(isCompletedWithinDays({ ...baseTask, completedAt: '2026-10-25T12:00:00.000Z' }, today, 3)).toBe(true);

    // Completed 3 days ago -> true
    expect(isCompletedWithinDays({ ...baseTask, completedAt: '2026-10-24T12:00:00.000Z' }, today, 3)).toBe(true);

    // Completed 4 days ago -> false (cleaned after 3 days)
    expect(isCompletedWithinDays({ ...baseTask, completedAt: '2026-10-23T12:00:00.000Z' }, today, 3)).toBe(false);

    // Completed 10 days ago -> false
    expect(isCompletedWithinDays({ ...baseTask, completedAt: '2026-10-17T12:00:00.000Z' }, today, 3)).toBe(false);

    // Fallback to updatedAt if completedAt is omitted
    expect(
      isCompletedWithinDays(
        { ...baseTask, completedAt: undefined, updatedAt: '2026-10-26T10:00:00.000Z' },
        today,
        3
      )
    ).toBe(true);
    expect(
      isCompletedWithinDays(
        { ...baseTask, completedAt: undefined, updatedAt: '2026-10-22T10:00:00.000Z' },
        today,
        3
      )
    ).toBe(false);
  });
});
