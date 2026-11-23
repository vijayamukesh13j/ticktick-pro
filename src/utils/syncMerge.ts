import type {
  CalendarSubscription,
  CountdownItem,
  CustomFilter,
  Folder,
  Habit,
  HabitLogEntry,
  PomodoroSession,
  TagItem,
  Task,
  TaskList,
  TaskSection,
  TaskTemplate,
  UserPreferences,
} from '../types';
import { pruneOldFocusSessions } from './focusLogs';
import { pruneExpiredTrashTasks } from './trashCleanup';

export interface MergeableWorkspaceSnapshot {
  tasks?: Task[];
  lists?: TaskList[];
  folders?: Folder[];
  sections?: TaskSection[];
  tags?: TagItem[];
  habits?: Habit[];
  pomodoroSessions?: PomodoroSession[];
  countdowns?: CountdownItem[];
  customFilters?: CustomFilter[];
  templates?: TaskTemplate[];
  calendarSubscriptions?: CalendarSubscription[];
  preferences?: Partial<UserPreferences>;
}

function toEpoch(iso?: string): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Merges two task arrays by task ID, selecting the entry with the newer `updatedAt`
 * timestamp when both devices modified the same task.
 */
export function mergeTasksByUpdatedAt(
  localTasks: Task[],
  remoteTasks: Task[],
  now: Date = new Date()
): Task[] {
  const byId = new Map<string, Task>();
  for (const t of localTasks) {
    byId.set(t.id, t);
  }
  for (const remoteTask of remoteTasks) {
    const existing = byId.get(remoteTask.id);
    if (!existing) {
      byId.set(remoteTask.id, remoteTask);
    } else {
      const localTs = toEpoch(existing.updatedAt || existing.createdAt);
      const remoteTs = toEpoch(remoteTask.updatedAt || remoteTask.createdAt);
      byId.set(remoteTask.id, remoteTs >= localTs ? remoteTask : existing);
    }
  }
  return pruneExpiredTrashTasks(Array.from(byId.values()), now);
}

/**
 * Merges two habit arrays by ID, combining per-date check-in/skip logs using the newest
 * `timestamp` per date so multi-device habit check-ins never overwrite each other.
 */
export function mergeHabitsByLogs(localHabits: Habit[], remoteHabits: Habit[]): Habit[] {
  const byId = new Map<string, Habit>();
  for (const h of localHabits) {
    byId.set(h.id, h);
  }
  for (const remoteHabit of remoteHabits) {
    const existing = byId.get(remoteHabit.id);
    if (!existing) {
      byId.set(remoteHabit.id, remoteHabit);
    } else {
      const mergedLogs: Record<string, HabitLogEntry> = { ...existing.logs };
      for (const [dateStr, remoteLog] of Object.entries(remoteHabit.logs || {})) {
        const localLog = mergedLogs[dateStr];
        if (!localLog || toEpoch(remoteLog.timestamp) >= toEpoch(localLog.timestamp)) {
          mergedLogs[dateStr] = remoteLog;
        }
      }
      byId.set(remoteHabit.id, {
        ...existing,
        ...remoteHabit,
        logs: mergedLogs,
      });
    }
  }
  return Array.from(byId.values());
}

/**
 * Merges two focus session arrays by ID, keeping only the last 7 days sorted newest-first.
 */
export function mergeFocusSessions(
  localSessions: PomodoroSession[],
  remoteSessions: PomodoroSession[],
  now: Date = new Date()
): PomodoroSession[] {
  const byId = new Map<string, PomodoroSession>();
  for (const s of localSessions) byId.set(s.id, s);
  for (const s of remoteSessions) byId.set(s.id, s);
  const merged = pruneOldFocusSessions(Array.from(byId.values()), now);
  return merged.sort((a, b) => toEpoch(b.startTime) - toEpoch(a.startTime));
}

function mergeById<T extends { id: string }>(localItems?: T[], remoteItems?: T[]): T[] | undefined {
  if (!localItems && !remoteItems) return undefined;
  const byId = new Map<string, T>();
  for (const item of localItems || []) byId.set(item.id, item);
  for (const item of remoteItems || []) byId.set(item.id, item);
  return Array.from(byId.values());
}

/**
 * Conflict-safe multi-device workspace snapshot merger.
 */
export function mergeWorkspaceSnapshots(
  local: MergeableWorkspaceSnapshot,
  remote: MergeableWorkspaceSnapshot,
  now: Date = new Date()
): MergeableWorkspaceSnapshot {
  return {
    tasks:
      local.tasks || remote.tasks
        ? mergeTasksByUpdatedAt(local.tasks || [], remote.tasks || [], now)
        : undefined,
    lists: mergeById(local.lists, remote.lists),
    folders: mergeById(local.folders, remote.folders),
    sections: mergeById(local.sections, remote.sections),
    tags: mergeById(local.tags, remote.tags),
    habits:
      local.habits || remote.habits
        ? mergeHabitsByLogs(local.habits || [], remote.habits || [])
        : undefined,
    pomodoroSessions:
      local.pomodoroSessions || remote.pomodoroSessions
        ? mergeFocusSessions(local.pomodoroSessions || [], remote.pomodoroSessions || [], now)
        : undefined,
    countdowns: mergeById(local.countdowns, remote.countdowns),
    customFilters: mergeById(local.customFilters, remote.customFilters),
    templates: mergeById(local.templates, remote.templates),
    calendarSubscriptions: mergeById(local.calendarSubscriptions, remote.calendarSubscriptions),
    preferences:
      local.preferences || remote.preferences
        ? { ...local.preferences, ...remote.preferences }
        : undefined,
  };
}
