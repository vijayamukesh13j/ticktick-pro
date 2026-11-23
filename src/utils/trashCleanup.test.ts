import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import {
  TRASH_RETENTION_DAYS,
  isTrashTaskExpired,
  pruneExpiredTrashTasks,
} from './trashCleanup';

const makeTask = (id: string, status: Task['status'], updatedAt: string): Task => ({
  id,
  title: `Task ${id}`,
  content: '',
  isNote: false,
  listId: 'inbox',
  status,
  priority: 0,
  tags: [],
  isAllDay: true,
  reminders: [],
  constantReminder: false,
  emailReminder: false,
  estimatedPomos: 0,
  completedPomos: 0,
  focusSeconds: 0,
  subtasks: [],
  attachments: [],
  comments: [],
  activities: [],
  isPinned: false,
  sortOrder: 0,
  createdAt: updatedAt,
  updatedAt,
});

describe('trashCleanup 30-day retention', () => {
  const now = new Date('2026-11-23T12:00:00');

  it('never expires non-trashed tasks even if very old', () => {
    const oldTodo = makeTask('t1', 'todo', '2025-01-01T10:00:00');
    const oldCompleted = makeTask('t2', 'completed', '2025-01-01T10:00:00');
    expect(isTrashTaskExpired(oldTodo, now, TRASH_RETENTION_DAYS)).toBe(false);
    expect(isTrashTaskExpired(oldCompleted, now, TRASH_RETENTION_DAYS)).toBe(false);
  });

  it('keeps recently trashed tasks (< 30 days) and purges tasks >= 30 days old', () => {
    const trashDay29 = makeTask('t29', 'trash', '2026-10-25T10:00:00');
    const trashDay30 = makeTask('t30', 'trash', '2026-10-24T10:00:00');
    const trashDay45 = makeTask('t45', 'trash', '2026-10-09T10:00:00');

    expect(isTrashTaskExpired(trashDay29, now)).toBe(false);
    expect(isTrashTaskExpired(trashDay30, now)).toBe(true);
    expect(isTrashTaskExpired(trashDay45, now)).toBe(true);

    const pruned = pruneExpiredTrashTasks([trashDay29, trashDay30, trashDay45], now);
    expect(pruned.map((t) => t.id)).toEqual(['t29']);
  });
});
