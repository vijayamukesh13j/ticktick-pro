import { describe, expect, it } from 'vitest';
import type { Task, TaskList } from '../types';
import {
  parseWorkspaceBackup,
  serializeWorkspaceBackup,
  tasksToCsv,
} from './backupUtils';

describe('backupUtils JSON & CSV portability', () => {
  const sampleTask: Task = {
    id: 't-1',
    title: 'Prepare "Q4", Report',
    content: 'Line 1\nLine 2',
    isNote: false,
    listId: 'work',
    status: 'todo',
    priority: 5,
    tags: ['finance', 'urgent'],
    dueDate: '2026-11-25',
    startTime: '09:30',
    isAllDay: false,
    reminders: [],
    constantReminder: false,
    emailReminder: false,
    estimatedPomos: 2,
    completedPomos: 0,
    focusSeconds: 0,
    subtasks: [],
    attachments: [],
    comments: [],
    activities: [],
    isPinned: false,
    sortOrder: 0,
    createdAt: '2026-11-23T08:00:00Z',
    updatedAt: '2026-11-23T08:00:00Z',
  };

  const sampleList: TaskList = {
    id: 'work',
    name: 'Work',
    color: '#3b82f6',
    icon: 'briefcase',
    backgroundStyle: 'none',
    viewMode: 'list',
    isShared: false,
    members: [],
    sortOrder: 0,
  };

  it('serializes and parses a workspace JSON backup round-trip', () => {
    const json = serializeWorkspaceBackup({
      tasks: [sampleTask],
      lists: [sampleList],
    });
    const parsed = parseWorkspaceBackup(json);
    expect(parsed.tasks?.length).toBe(1);
    expect(parsed.tasks?.[0].title).toBe('Prepare "Q4", Report');
    expect(parsed.lists?.[0].name).toBe('Work');
  });

  it('throws on invalid JSON or non-backup payloads', () => {
    expect(() => parseWorkspaceBackup('{not-json')).toThrow(/Invalid JSON/i);
    expect(() => parseWorkspaceBackup('{"foo": "bar"}')).toThrow(/recognizable/i);
  });

  it('exports tasks to RFC 4180 CSV with proper escaping and excludes trashed tasks', () => {
    const trashed: Task = { ...sampleTask, id: 't-trash', status: 'trash', title: 'Hidden' };
    const csv = tasksToCsv([sampleTask, trashed], [sampleList]);
    expect(csv).toContain('"Prepare ""Q4"", Report"');
    expect(csv).toContain('Work,todo,High,2026-11-25,09:30,finance; urgent');
    expect(csv).not.toContain('t-trash');
  });
});
