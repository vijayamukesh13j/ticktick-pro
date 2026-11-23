import { describe, expect, it } from 'vitest';
import type { Habit, PomodoroSession, Task } from '../types';
import {
  mergeFocusSessions,
  mergeHabitsByLogs,
  mergeTasksByUpdatedAt,
} from './syncMerge';

const makeTask = (id: string, title: string, updatedAt: string): Task => ({
  id,
  title,
  content: '',
  isNote: false,
  listId: 'inbox',
  status: 'todo',
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

describe('syncMerge conflict resolution', () => {
  const now = new Date('2026-11-23T12:00:00Z');

  it('merges tasks by updatedAt timestamp without losing unique items from either device', () => {
    const local = [
      makeTask('shared-1', 'Local Newer Title', '2026-11-23T11:00:00Z'),
      makeTask('shared-2', 'Local Older Title', '2026-11-23T08:00:00Z'),
      makeTask('local-only', 'Created Offline', '2026-11-23T09:00:00Z'),
    ];
    const remote = [
      makeTask('shared-1', 'Remote Older Title', '2026-11-23T10:00:00Z'),
      makeTask('shared-2', 'Remote Newer Title', '2026-11-23T11:30:00Z'),
      makeTask('remote-only', 'Created on Phone', '2026-11-23T10:30:00Z'),
    ];

    const merged = mergeTasksByUpdatedAt(local, remote, now);
    const byId = Object.fromEntries(merged.map((t) => [t.id, t.title]));

    expect(byId['shared-1']).toBe('Local Newer Title');
    expect(byId['shared-2']).toBe('Remote Newer Title');
    expect(byId['local-only']).toBe('Created Offline');
    expect(byId['remote-only']).toBe('Created on Phone');
  });

  it('merges habit logs across dates using newest timestamp per day', () => {
    const baseHabit: Habit = {
      id: 'h1',
      name: 'Read',
      quote: '',
      icon: 'book',
      color: '#10b981',
      section: 'evening',
      frequencyType: 'daily',
      frequencyDays: [0, 1, 2, 3, 4, 5, 6],
      frequencyCount: 7,
      goalType: 'check',
      targetValue: 1,
      unit: 'times',
      autoPopLog: false,
      logs: {},
      createdAt: '2026-11-01T00:00:00Z',
    };

    const localHabit: Habit = {
      ...baseHabit,
      logs: {
        '2026-11-22': { value: 1, completed: true, timestamp: '2026-11-22T20:00:00Z' },
        '2026-11-23': { value: 1, completed: true, note: 'Local newer', timestamp: '2026-11-23T11:00:00Z' },
      },
    };
    const remoteHabit: Habit = {
      ...baseHabit,
      logs: {
        '2026-11-21': { value: 1, completed: true, timestamp: '2026-11-21T19:00:00Z' },
        '2026-11-23': { value: 1, completed: true, note: 'Remote older', timestamp: '2026-11-23T09:00:00Z' },
      },
    };

    const merged = mergeHabitsByLogs([localHabit], [remoteHabit]);
    expect(Object.keys(merged[0].logs).sort()).toEqual(['2026-11-21', '2026-11-22', '2026-11-23']);
    expect(merged[0].logs['2026-11-23'].note).toBe('Local newer');
  });

  it('merges focus sessions by ID and prunes entries older than 7 days', () => {
    const sLocal: PomodoroSession = {
      id: 'p1',
      taskTitle: 'Local Session',
      mode: 'stopwatch',
      startTime: '2026-11-23T10:00:00Z',
      endTime: '2026-11-23T10:30:00Z',
      durationMinutes: 30,
      note: '',
    };
    const sRemote: PomodoroSession = {
      id: 'p2',
      taskTitle: 'Remote Session',
      mode: 'pomo',
      startTime: '2026-11-22T10:00:00Z',
      endTime: '2026-11-22T10:25:00Z',
      durationMinutes: 25,
      note: '',
    };
    const sExpired: PomodoroSession = {
      id: 'p3',
      taskTitle: 'Old Session',
      mode: 'pomo',
      startTime: '2026-11-10T10:00:00Z',
      endTime: '2026-11-10T10:25:00Z',
      durationMinutes: 25,
      note: '',
    };

    const merged = mergeFocusSessions([sLocal], [sRemote, sExpired], now);
    expect(merged.map((s) => s.id)).toEqual(['p1', 'p2']);
  });
});
