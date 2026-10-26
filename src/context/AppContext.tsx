import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { format, parseISO } from 'date-fns';
import { ToastItem } from '../components/SonnerToaster';
import {
  INITIAL_CALENDAR_SUBSCRIPTIONS,
  INITIAL_COUNTDOWNS,
  INITIAL_FILTERS,
  INITIAL_FOLDERS,
  INITIAL_HABITS,
  INITIAL_LISTS,
  INITIAL_POMODORO_SESSIONS,
  INITIAL_PREFERENCES,
  INITIAL_SECTIONS,
  INITIAL_TAGS,
  INITIAL_TASKS,
  INITIAL_TEMPLATES,
} from '../data/seedData';
import {
  getSupabaseClient,
  getSupabaseConfig,
  hasDismissedDatabasePrompt,
  saveRuntimeSupabaseConfig,
  setDatabasePromptDismissed,
} from '../lib/supabase';
import {
  ActiveReminderAlert,
  CalendarSubscription,
  CountdownItem,
  CustomFilter,
  Folder,
  Habit,
  HabitLogEntry,
  PomodoroSession,
  PrimaryModule,
  Priority,
  SmartListId,
  TagItem,
  Task,
  TaskList,
  TaskSection,
  TaskStatus,
  TaskTemplate,
  ThemeId,
  UserPreferences,
  ViewMode,
} from '../types';
import { soundEngine, WhiteNoiseId } from '../utils/soundEngine';
import { backgroundTimerEngine } from '../utils/backgroundTimer';
import {
  requestDeviceNotificationPermission,
  sendDeviceNotification,
} from '../utils/notificationEngine';
import { getNextOccurrenceDate } from '../utils/recurringTasks';

const STORAGE_PREFIX = 'ticktick_pro_v2_';

function loadStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveStored<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export type ActiveSidebarSelection =
  | { kind: 'smart'; id: SmartListId }
  | { kind: 'list'; id: string }
  | { kind: 'tag'; id: string }
  | { kind: 'filter'; id: string };

interface AppContextValue {
  // Navigation & Selection
  activeModule: PrimaryModule;
  setActiveModule: (mod: PrimaryModule) => void;
  sidebarSelection: ActiveSidebarSelection;
  setSidebarSelection: (sel: ActiveSidebarSelection) => void;
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
  isCommandOpen: boolean;
  setIsCommandOpen: (v: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (v: boolean) => void;
  isInstallModalOpen: boolean;
  setIsInstallModalOpen: (v: boolean) => void;
  isDatabasePromptOpen: boolean;
  setIsDatabasePromptOpen: (v: boolean) => void;
  settingsInitialTab: 'general' | 'themes' | 'supabase' | 'shortcuts' | 'premium';
  openSettingsTab: (tab: 'general' | 'themes' | 'supabase' | 'shortcuts' | 'premium') => void;

  // Sonner Stacked Toasts
  toasts: ToastItem[];
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;

  // Core Entities
  tasks: Task[];
  lists: TaskList[];
  folders: Folder[];
  sections: TaskSection[];
  tags: TagItem[];
  customFilters: CustomFilter[];
  habits: Habit[];
  pomodoroSessions: PomodoroSession[];
  countdowns: CountdownItem[];
  templates: TaskTemplate[];
  calendarSubscriptions: CalendarSubscription[];
  preferences: UserPreferences;

  // Task Operations
  addTask: (partial: Partial<Task> & { title: string }) => Task;
  updateTask: (id: string, patch: Partial<Task>, activityNote?: string) => void;
  toggleTaskStatus: (id: string) => void;
  deleteTask: (id: string, permanent?: boolean) => void;
  restoreTask: (id: string) => void;
  duplicateTask: (id: string) => void;
  addSubtask: (taskId: string, title: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  addTaskComment: (taskId: string, text: string) => void;
  addTaskAttachment: (
    taskId: string,
    name: string,
    url: string,
    type?: 'image' | 'pdf' | 'doc' | 'link'
  ) => void;
  saveTaskAsTemplate: (taskId: string) => void;
  applyTemplate: (templateId: string, listId?: string) => Task | null;

  // List, Folder, Section, Tag & Filter Operations
  addList: (
    name: string,
    color: string,
    folderId?: string,
    viewMode?: ViewMode,
    extra?: Partial<TaskList>
  ) => TaskList;
  updateList: (id: string, patch: Partial<TaskList>) => void;
  duplicateList: (id: string) => void;
  deleteList: (id: string) => void;
  addFolder: (name: string) => void;
  updateFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  toggleFolderCollapse: (id: string) => void;
  addSection: (listId: string, name: string) => TaskSection;
  addTag: (name: string, color: string) => void;
  updateTag: (id: string, name: string, color: string) => void;
  deleteTag: (id: string) => void;
  addCustomFilter: (filter: Omit<CustomFilter, 'id'>) => void;
  deleteCustomFilter: (id: string) => void;

  // Habit Operations
  addHabit: (habit: Omit<Habit, 'id' | 'logs' | 'createdAt'>) => void;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  toggleHabitDate: (
    habitId: string,
    dateStr: string,
    valueDelta?: number,
    note?: string,
    mood?: HabitLogEntry['mood']
  ) => void;
  deleteHabitLog: (habitId: string, dateStr: string) => void;
  clearHabitLogs: (habitId: string) => void;
  deleteHabit: (id: string) => void;

  // Pomodoro & Focus Timer Global State
  pomoMode: 'pomo' | 'stopwatch';
  setPomoMode: (m: 'pomo' | 'stopwatch') => void;
  pomoPhase: 'work' | 'short_break' | 'long_break';
  setPomoPhase: (p: 'work' | 'short_break' | 'long_break') => void;
  pomoRunning: boolean;
  pomoTimerRunning: boolean;
  stopwatchRunning: boolean;
  setPomoRunning: (r: boolean) => void;
  pomoSecondsLeft: number;
  stopwatchSeconds: number;
  activePomoTaskId: string | null;
  setActivePomoTaskId: (id: string | null) => void;
  activeWhiteNoise: WhiteNoiseId;
  setActiveWhiteNoise: (id: WhiteNoiseId) => void;
  whiteNoiseVolume: number;
  setWhiteNoiseVolume: (v: number) => void;
  resetPomoTimer: () => void;
  completeCurrentPomoSession: (note?: string) => void;
  startTaskFocus: (taskId: string, mode: 'pomo' | 'stopwatch') => void;
  logManualFocusSession: (
    taskTitle: string,
    durationMinutes: number,
    startTime: string,
    note: string,
    taskId?: string
  ) => void;
  deletePomodoroSession: (id: string) => void;
  clearPomodoroSessions: () => void;

  // Countdowns & Calendar Subscriptions
  addCountdown: (item: Omit<CountdownItem, 'id'>) => void;
  deleteCountdown: (id: string) => void;
  addCalendarSubscription: (
    name: string,
    url: string,
    provider: CalendarSubscription['provider'],
    color: string
  ) => void;
  toggleCalendarSubscription: (id: string) => void;

  // Preferences, Layout & Workspace Reset
  rightPaneWidth: number;
  setRightPaneWidth: (width: number) => void;
  updatePreferences: (patch: Partial<UserPreferences>) => void;
  setTheme: (theme: ThemeId) => void;
  resetDemoWorkspace: () => void;
  clearAllWorkspaceData: () => void;

  // Reminders & Active Alerts
  activeReminder: ActiveReminderAlert | null;
  dismissActiveReminder: () => void;
  snoozeActiveReminder: (minutes?: number) => void;
  triggerTaskReminderNow: (taskId: string) => void;
  requestNotificationPermission: () => Promise<boolean>;
  notificationPermission: NotificationPermission;

  // Supabase Backend Sync
  supabaseStatus: 'local_only' | 'connected' | 'syncing' | 'error';
  supabaseUserEmail: string | null;
  supabaseLastSyncedAt: string | null;
  supabaseErrorMessage: string | null;
  connectSupabase: (url: string, anonKey: string) => Promise<boolean>;
  disconnectSupabase: () => void;
  syncWorkspaceToSupabase: () => Promise<{ ok: boolean; message: string }>;
  pullWorkspaceFromSupabase: () => Promise<{ ok: boolean; message: string }>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeModule, setActiveModule] = useState<PrimaryModule>('tasks');
  const [sidebarSelection, setSidebarSelection] = useState<ActiveSidebarSelection>({
    kind: 'smart',
    id: 'today',
  });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return true;
    return false;
  });
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isDatabasePromptOpen, setIsDatabasePromptOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (
      typeof navigator !== 'undefined' &&
      navigator.webdriver &&
      localStorage.getItem('ticktick_e2e_show_db_modal') !== 'true'
    ) {
      return false;
    }
    const config = getSupabaseConfig();
    if (config.isConfigured) return false;
    return !hasDismissedDatabasePrompt();
  });
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    'general' | 'themes' | 'supabase' | 'shortcuts' | 'premium'
  >('general');

  // Sonner Stacked Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      setToasts((prev) => [{ ...toast, id }, ...prev.slice(0, 4)]);
      window.setTimeout(() => {
        dismissToast(id);
      }, 4200);
    },
    [dismissToast]
  );

  // Core data persisted in localStorage + synced to Supabase
  const [tasks, setTasks] = useState<Task[]>(() => loadStored('tasks', INITIAL_TASKS));
  const [lists, setLists] = useState<TaskList[]>(() => loadStored('lists', INITIAL_LISTS));
  const [folders, setFolders] = useState<Folder[]>(() => loadStored('folders', INITIAL_FOLDERS));
  const [sections, setSections] = useState<TaskSection[]>(() =>
    loadStored('sections', INITIAL_SECTIONS)
  );
  const [tags, setTags] = useState<TagItem[]>(() => loadStored('tags', INITIAL_TAGS));
  const [customFilters, setCustomFilters] = useState<CustomFilter[]>(() =>
    loadStored('filters', INITIAL_FILTERS)
  );
  const [habits, setHabits] = useState<Habit[]>(() => loadStored('habits', INITIAL_HABITS));
  const [pomodoroSessions, setPomodoroSessions] = useState<PomodoroSession[]>(() =>
    loadStored('pomo_sessions', INITIAL_POMODORO_SESSIONS)
  );
  const [countdowns, setCountdowns] = useState<CountdownItem[]>(() =>
    loadStored('countdowns', INITIAL_COUNTDOWNS)
  );
  const [templates, setTemplates] = useState<TaskTemplate[]>(() =>
    loadStored('templates', INITIAL_TEMPLATES)
  );
  const [calendarSubscriptions, setCalendarSubscriptions] = useState<CalendarSubscription[]>(() =>
    loadStored('cal_subs', INITIAL_CALENDAR_SUBSCRIPTIONS)
  );
  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    loadStored('preferences', INITIAL_PREFERENCES)
  );

  useEffect(() => saveStored('tasks', tasks), [tasks]);
  useEffect(() => saveStored('lists', lists), [lists]);
  useEffect(() => saveStored('folders', folders), [folders]);
  useEffect(() => saveStored('sections', sections), [sections]);
  useEffect(() => saveStored('tags', tags), [tags]);
  useEffect(() => saveStored('filters', customFilters), [customFilters]);
  useEffect(() => saveStored('habits', habits), [habits]);
  useEffect(() => saveStored('pomo_sessions', pomodoroSessions), [pomodoroSessions]);
  useEffect(() => saveStored('countdowns', countdowns), [countdowns]);
  useEffect(() => saveStored('templates', templates), [templates]);
  useEffect(() => saveStored('cal_subs', calendarSubscriptions), [calendarSubscriptions]);
  useEffect(() => saveStored('preferences', preferences), [preferences]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', preferences.theme);
  }, [preferences.theme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Real-Time Reminders & OS Notification Engine
  const [activeReminder, setActiveReminder] = useState<ActiveReminderAlert | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const firedRemindersRef = useRef<Set<string>>(new Set());

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    const outcome = await requestDeviceNotificationPermission();
    setNotificationPermission(outcome.status);
    if (outcome.granted) {
      pushToast({
        title: 'Notifications Enabled',
        description: 'You will receive desktop & mobile alerts when task reminders arrive',
        kind: 'success',
      });
      return true;
    } else {
      pushToast({
        title: 'Notification Alert',
        description: outcome.message,
        kind: 'info',
      });
      return false;
    }
  }, [pushToast]);

  const fireReminder = useCallback((task: Task, label: string) => {
    // 1. Dispatch cross-platform native notification (handles SW, Window, vibration & chime)
    sendDeviceNotification(`TickTick Alert: ${task.title}`, {
      body: `${label} • Due ${task.dueDate || 'Today'} ${task.startTime || ''}`.trim(),
      icon: './icon-192.png',
      tag: `reminder-${task.id}`,
      playSound: preferences.soundAlertEnabled,
    });

    // 2. Set in-app active reminder modal
    setActiveReminder({
      task,
      reminderLabel: label,
      triggeredAt: format(new Date(), 'HH:mm'),
      isConstant: task.constantReminder,
    });
  }, [preferences.soundAlertEnabled]);

  const dismissActiveReminder = useCallback(() => {
    setActiveReminder(null);
  }, []);

  const snoozeActiveReminder = useCallback((minutes = 5) => {
    if (!activeReminder) return;
    const currentTask = activeReminder.task;
    setActiveReminder(null);
    pushToast({
      title: `Snoozed for ${minutes}m`,
      description: currentTask.title,
      kind: 'info',
    });
    window.setTimeout(() => {
      fireReminder(currentTask, `Snoozed (${minutes}m)`);
    }, minutes * 60 * 1000);
  }, [activeReminder, fireReminder, pushToast]);

  const triggerTaskReminderNow = useCallback((taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    fireReminder(task, 'Test Alert');
  }, [tasks, fireReminder]);

  // Background reminder scheduler loop: checks every 10 seconds
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const nowTs = now.getTime();

      tasks.forEach((t) => {
        if (t.status === 'completed' || t.status === 'trash' || t.status === 'wont_do') return;
        if (!t.dueDate) return;

        const timePart = t.startTime ? `${t.startTime}:00` : '09:00:00';
        const targetDateTime = parseISO(`${t.dueDate}T${timePart}`);
        if (isNaN(targetDateTime.getTime())) return;

        const targetTs = targetDateTime.getTime();
        const reminderOffsets =
          t.reminders && t.reminders.length > 0 ? t.reminders : t.startTime ? ['On time'] : [];

        reminderOffsets.forEach((rem) => {
          let offsetMinutes = 0;
          if (rem === '5m before') offsetMinutes = -5;
          else if (rem === '15m before') offsetMinutes = -15;
          else if (rem === '30m before') offsetMinutes = -30;
          else if (rem === '1h before') offsetMinutes = -60;
          else if (rem === '1d before') offsetMinutes = -1440;
          else if (rem === 'On time') offsetMinutes = 0;

          const triggerTs = targetTs + offsetMinutes * 60 * 1000;
          const diffSeconds = (nowTs - triggerTs) / 1000;
          const key = `${t.id}-${rem}-${t.dueDate}-${t.startTime || 'allDay'}`;

          // Trigger if within a 55-second window and not yet fired in this cycle
          if (diffSeconds >= 0 && diffSeconds <= 55 && !firedRemindersRef.current.has(key)) {
            firedRemindersRef.current.add(key);
            fireReminder(t, rem);
          }
        });
      });
    };

    const interval = window.setInterval(checkReminders, 10000);
    checkReminders();
    return () => window.clearInterval(interval);
  }, [tasks, fireReminder]);

  // Re-alert for Constant Reminders every 25 seconds until handled
  useEffect(() => {
    if (!activeReminder?.isConstant) return;
    const repeatInterval = window.setInterval(() => {
      if (preferences.soundAlertEnabled) {
        soundEngine.playReminderAlarm();
      }
    }, 25000);
    return () => window.clearInterval(repeatInterval);
  }, [activeReminder, preferences.soundAlertEnabled]);

  // Pomodoro & Stopwatch global timer state with Background Wall-Clock Engine
  const initialTimerState = useMemo(
    () => backgroundTimerEngine.getInitialState(preferences.pomoDuration * 60),
    []
  );
  const [pomoMode, setPomoModeState] = useState<'pomo' | 'stopwatch'>(initialTimerState.mode);
  const [pomoPhase, setPomoPhaseState] = useState<'work' | 'short_break' | 'long_break'>(initialTimerState.pomoPhase);
  const [pomoTimerRunning, setPomoTimerRunning] = useState<boolean>(initialTimerState.pomoRunning);
  const [stopwatchRunning, setStopwatchRunning] = useState<boolean>(initialTimerState.stopwatchRunning);
  const pomoRunning = pomoMode === 'pomo' ? pomoTimerRunning : stopwatchRunning;
  const anyTimerRunning = pomoTimerRunning || stopwatchRunning;
  const [pomoSecondsLeft, setPomoSecondsLeft] = useState(initialTimerState.secondsLeft);
  const [stopwatchSeconds, setStopwatchSeconds] = useState(initialTimerState.stopwatchSeconds);
  const [activePomoTaskId, setActivePomoTaskId] = useState<string | null>('task-1');
  const [activeWhiteNoise, setActiveWhiteNoiseState] = useState<WhiteNoiseId>('none');
  const [whiteNoiseVolume, setWhiteNoiseVolumeState] = useState(0.35);

  const pomoModeRef = useRef(pomoMode);
  pomoModeRef.current = pomoMode;
  const pomoPhaseRef = useRef(pomoPhase);
  pomoPhaseRef.current = pomoPhase;
  const pomoRunningRef = useRef(pomoRunning);
  pomoRunningRef.current = pomoRunning;
  const pomoTimerRunningRef = useRef(pomoTimerRunning);
  pomoTimerRunningRef.current = pomoTimerRunning;
  const stopwatchRunningRef = useRef(stopwatchRunning);
  stopwatchRunningRef.current = stopwatchRunning;
  const pomoSecondsLeftRef = useRef(pomoSecondsLeft);
  pomoSecondsLeftRef.current = pomoSecondsLeft;
  const stopwatchSecondsRef = useRef(stopwatchSeconds);
  stopwatchSecondsRef.current = stopwatchSeconds;
  const activePomoTaskIdRef = useRef(activePomoTaskId);
  activePomoTaskIdRef.current = activePomoTaskId;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const updateTaskRef = useRef<(id: string, patch: Partial<Task>, note?: string) => void>(() => {});

  // Handle preference duration adjustments when Pomodoro timer is idle
  useEffect(() => {
    if (!pomoTimerRunning) {
      if (pomoPhase === 'work') {
        const secs = preferences.pomoDuration * 60;
        setPomoSecondsLeft(secs);
        backgroundTimerEngine.resetTimer(secs, 'pomo');
      } else if (pomoPhase === 'short_break') {
        const secs = preferences.shortBreakDuration * 60;
        setPomoSecondsLeft(secs);
        backgroundTimerEngine.resetTimer(secs, 'pomo');
      } else {
        const secs = preferences.longBreakDuration * 60;
        setPomoSecondsLeft(secs);
        backgroundTimerEngine.resetTimer(secs, 'pomo');
      }
    }
  }, [
    pomoPhase,
    preferences.pomoDuration,
    preferences.shortBreakDuration,
    preferences.longBreakDuration,
    pomoTimerRunning,
  ]);

  useEffect(() => {
    if (anyTimerRunning && activeWhiteNoise !== 'none') {
      soundEngine.startWhiteNoise(activeWhiteNoise, whiteNoiseVolume);
    } else {
      soundEngine.stopWhiteNoise();
    }
    return () => {
      if (!anyTimerRunning) soundEngine.stopWhiteNoise();
    };
  }, [anyTimerRunning, activeWhiteNoise, whiteNoiseVolume]);

  const setActiveWhiteNoise = (id: WhiteNoiseId) => {
    setActiveWhiteNoiseState(id);
    if (anyTimerRunning) {
      soundEngine.startWhiteNoise(id, whiteNoiseVolume);
    }
  };

  const setWhiteNoiseVolume = (vol: number) => {
    setWhiteNoiseVolumeState(vol);
    soundEngine.setVolume(vol);
  };

  // Complete current Pomodoro / Stopwatch session
  const completeCurrentPomoSession = useCallback(
    (note = '', completedMode?: 'pomo' | 'stopwatch') => {
      const now = new Date();
      const currentMode = completedMode || pomoModeRef.current;
      const currentSeconds = pomoSecondsLeftRef.current;
      const currentStopwatch = stopwatchSecondsRef.current;
      const prefs = preferencesRef.current;
      const currentTaskId = activePomoTaskIdRef.current;
      const currentTasks = tasksRef.current;

      const elapsedMinutes =
        currentMode === 'pomo'
          ? Math.max(
              1,
              Math.round((prefs.pomoDuration * 60 - currentSeconds) / 60) ||
                prefs.pomoDuration
            )
          : Math.max(1, Math.round(currentStopwatch / 60));

      const targetTask = currentTasks.find((t) => t.id === currentTaskId);
      const session: PomodoroSession = {
        id: `pomo-${Date.now()}`,
        taskId: targetTask?.id,
        taskTitle: targetTask?.title || 'Deep Focus Session',
        mode: currentMode,
        startTime: new Date(now.getTime() - elapsedMinutes * 60 * 1000).toISOString(),
        endTime: now.toISOString(),
        durationMinutes: elapsedMinutes,
        note:
          note ||
          `Focused for ${elapsedMinutes}m (${currentMode === 'stopwatch' ? 'Stopwatch' : 'Pomodoro'})`,
        whiteNoiseUsed: activeWhiteNoise !== 'none' ? activeWhiteNoise : undefined,
      };

      setPomodoroSessions((prev) => [session, ...prev]);

      if (targetTask) {
        updateTaskRef.current(
          targetTask.id,
          {
            completedPomos: targetTask.completedPomos + 1,
            focusSeconds: targetTask.focusSeconds + elapsedMinutes * 60,
          },
          `Logged ${elapsedMinutes}m ${currentMode === 'stopwatch' ? 'Stopwatch' : 'Pomodoro'} focus session`
        );
      }

      setPreferences((prev) => ({
        ...prev,
        achievementScore: prev.achievementScore + 15,
      }));

      if (prefs.soundAlertEnabled) {
        soundEngine.playPomodoroCompleteAlarm();
      }
      pushToast({
        title: `Focus session logged (+${elapsedMinutes}m)`,
        description: targetTask ? targetTask.title : 'Achievement Score +15',
        kind: 'success',
      });

      // Reset only the completed mode cleanly without stopping the other mode
      if (currentMode === 'pomo') {
        setPomoTimerRunning(false);
        const defaultSecs =
          pomoPhaseRef.current === 'work'
            ? prefs.pomoDuration * 60
            : pomoPhaseRef.current === 'short_break'
              ? prefs.shortBreakDuration * 60
              : prefs.longBreakDuration * 60;
        setPomoSecondsLeft(defaultSecs);
        backgroundTimerEngine.resetTimer(defaultSecs, 'pomo');
        if (!stopwatchRunningRef.current) {
          soundEngine.stopWhiteNoise();
        }
      } else {
        setStopwatchRunning(false);
        setStopwatchSeconds(0);
        backgroundTimerEngine.resetTimer(0, 'stopwatch');
        if (!pomoTimerRunningRef.current) {
          soundEngine.stopWhiteNoise();
        }
      }
    },
    [activeWhiteNoise, pushToast]
  );

  // Subscribe to Wall-Clock Background Timer Engine (Updates BOTH Pomodoro & Stopwatch simultaneously)
  useEffect(() => {
    const unsubscribe = backgroundTimerEngine.subscribe(
      (remaining, elapsed) => {
        setPomoSecondsLeft(remaining);
        setStopwatchSeconds(elapsed);
      },
      () => {
        completeCurrentPomoSession('Completed full scheduled session', 'pomo');
      }
    );
    return () => unsubscribe();
  }, [completeCurrentPomoSession]);

  const setPomoRunning = useCallback((running: boolean) => {
    const mode = pomoModeRef.current;
    const targetTask = tasksRef.current.find((t) => t.id === activePomoTaskIdRef.current);

    if (mode === 'pomo') {
      setPomoTimerRunning(running);
      if (running) {
        backgroundTimerEngine.startPomodoro(
          pomoSecondsLeftRef.current,
          pomoPhaseRef.current,
          targetTask?.title || 'Deep Focus Session'
        );
        if (targetTask) {
          updateTaskRef.current(
            targetTask.id,
            {},
            `Started Pomodoro timer (${pomoPhaseRef.current === 'work' ? `${preferencesRef.current.pomoDuration}m Focus` : 'Break'})`
          );
        }
      } else {
        backgroundTimerEngine.pauseTimer('pomo');
        if (!stopwatchRunningRef.current) {
          soundEngine.stopWhiteNoise();
        }
      }
    } else {
      setStopwatchRunning(running);
      if (running) {
        backgroundTimerEngine.startStopwatch(stopwatchSecondsRef.current);
        if (targetTask) {
          updateTaskRef.current(
            targetTask.id,
            {},
            'Started Stopwatch focus session'
          );
        }
      } else {
        backgroundTimerEngine.pauseTimer('stopwatch');
        if (!pomoTimerRunningRef.current) {
          soundEngine.stopWhiteNoise();
        }
      }
    }
  }, []);

  // Switching between Pomodoro and Stopwatch tabs NEVER stops or resets a running Stopwatch or Pomodoro timer!
  const setPomoMode = useCallback((mode: 'pomo' | 'stopwatch') => {
    setPomoModeState(mode);
    try {
      localStorage.setItem('ticktick_timer_mode', mode);
    } catch {
      // ignore
    }
  }, []);

  const setPomoPhase = useCallback((phase: 'work' | 'short_break' | 'long_break') => {
    setPomoTimerRunning(false);
    setPomoPhaseState(phase);
    const prefs = preferencesRef.current;
    const dur =
      phase === 'work'
        ? prefs.pomoDuration * 60
        : phase === 'short_break'
          ? prefs.shortBreakDuration * 60
          : prefs.longBreakDuration * 60;
    setPomoSecondsLeft(dur);
    backgroundTimerEngine.resetTimer(dur, 'pomo');
  }, []);

  const resetPomoTimer = useCallback(() => {
    const prefs = preferencesRef.current;
    if (pomoModeRef.current === 'pomo') {
      setPomoTimerRunning(false);
      const defaultSecs =
        pomoPhaseRef.current === 'work'
          ? prefs.pomoDuration * 60
          : pomoPhaseRef.current === 'short_break'
            ? prefs.shortBreakDuration * 60
            : prefs.longBreakDuration * 60;
      setPomoSecondsLeft(defaultSecs);
      backgroundTimerEngine.resetTimer(defaultSecs, 'pomo');
      if (!stopwatchRunningRef.current) {
        soundEngine.stopWhiteNoise();
      }
    } else {
      setStopwatchRunning(false);
      setStopwatchSeconds(0);
      backgroundTimerEngine.resetTimer(0, 'stopwatch');
      if (!pomoTimerRunningRef.current) {
        soundEngine.stopWhiteNoise();
      }
    }
  }, []);

  const startTaskFocus = useCallback(
    (taskId: string, mode: 'pomo' | 'stopwatch') => {
      setActivePomoTaskId(taskId);
      setPomoModeState(mode);

      const targetTask = tasksRef.current.find((t) => t.id === taskId);
      const taskTitle = targetTask?.title || 'Deep Focus Session';

      if (mode === 'pomo') {
        setPomoPhaseState('work');
        const dur = preferencesRef.current.pomoDuration * 60;
        setPomoSecondsLeft(dur);
        pomoSecondsLeftRef.current = dur;
        setPomoTimerRunning(true);
        backgroundTimerEngine.startPomodoro(dur, 'work', taskTitle);
        if (targetTask) {
          updateTaskRef.current(
            targetTask.id,
            {},
            `Started Pomodoro timer (${preferencesRef.current.pomoDuration}m Focus)`
          );
        }
      } else {
        setStopwatchSeconds(0);
        stopwatchSecondsRef.current = 0;
        setStopwatchRunning(true);
        backgroundTimerEngine.startStopwatch(0);
        if (targetTask) {
          updateTaskRef.current(
            targetTask.id,
            {},
            'Started Stopwatch focus session'
          );
        }
      }

      setActiveModule('pomodoro');
    },
    [setActiveModule]
  );

  const logManualFocusSession = (
    taskTitle: string,
    durationMinutes: number,
    startTime: string,
    note: string,
    taskId?: string
  ) => {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const session: PomodoroSession = {
      id: `pomo-${Date.now()}`,
      taskId,
      taskTitle: taskTitle || 'Manual Focus Session',
      mode: 'pomo',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationMinutes,
      note,
    };
    setPomodoroSessions((prev) => [session, ...prev]);
    if (taskId) {
      const target = tasks.find((t) => t.id === taskId);
      if (target) {
        updateTask(
          taskId,
          {
            completedPomos: target.completedPomos + Math.max(1, Math.round(durationMinutes / 25)),
            focusSeconds: target.focusSeconds + durationMinutes * 60,
          },
          `Added manual focus record (${durationMinutes}m)`
        );
      }
    }
    pushToast({
      title: 'Manual focus record saved',
      description: `${taskTitle} (${durationMinutes}m)`,
      kind: 'success',
    });
  };

  const deletePomodoroSession = (id: string) => {
    setPomodoroSessions((prev) => prev.filter((s) => s.id !== id));
    pushToast({ title: 'Focus session log removed', kind: 'info' });
  };

  const clearPomodoroSessions = () => {
    setPomodoroSessions([]);
    pushToast({ title: 'All focus session logs cleared', kind: 'info' });
  };

  const addTask = (partial: Partial<Task> & { title: string }): Task => {
    const nowStr = format(new Date(), 'yyyy-MM-dd');
    const newTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: partial.title,
      content: partial.content ?? '',
      isNote: partial.isNote ?? false,
      listId: partial.listId ?? 'inbox',
      sectionId: partial.sectionId,
      status: partial.status ?? 'todo',
      priority: partial.priority ?? 0,
      tags: partial.tags ?? [],
      startDate: partial.startDate ?? partial.dueDate,
      dueDate: partial.dueDate,
      startTime: partial.startTime,
      endTime: partial.endTime,
      isAllDay: partial.isAllDay ?? !partial.startTime,
      durationMinutes: partial.durationMinutes,
      recurrenceRule: partial.recurrenceRule,
      reminders: partial.reminders ?? (partial.startTime ? ['On time'] : []),
      constantReminder: partial.constantReminder ?? false,
      emailReminder: partial.emailReminder ?? false,
      locationReminder: partial.locationReminder,
      assignee: partial.assignee,
      estimatedPomos: partial.estimatedPomos ?? 0,
      completedPomos: 0,
      focusSeconds: 0,
      subtasks: partial.subtasks ?? [],
      attachments: partial.attachments ?? [],
      comments: partial.comments ?? [],
      activities: [
        {
          id: `act-${Date.now()}`,
          actor: preferences.fullName,
          action: 'Created task',
          timestamp: format(new Date(), 'yyyy-MM-dd HH:mm'),
        },
      ],
      eisenhowerQuadrant: partial.eisenhowerQuadrant,
      isPinned: partial.isPinned ?? false,
      sortOrder: 0,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    if (newTask.tags.length > 0) {
      setTags((prevTags) => {
        const existingNames = new Set(prevTags.map((t) => t.name.toLowerCase()));
        const additions: TagItem[] = [];
        const palette = ['#2563eb', '#059669', '#d97706', '#0284c7', '#e11d48', '#0d9488'];
        newTask.tags.forEach((tagName, idx) => {
          if (!existingNames.has(tagName.toLowerCase())) {
            additions.push({
              id: `tag-${Date.now()}-${idx}`,
              name: tagName.toLowerCase(),
              color: palette[(prevTags.length + idx) % palette.length],
            });
          }
        });
        return additions.length > 0 ? [...prevTags, ...additions] : prevTags;
      });
    }

    setTasks((prev) => [newTask, ...prev]);
    if (typeof window === 'undefined' || window.innerWidth >= 1024) {
      setSelectedTaskId(newTask.id);
    }
    pushToast({
      title: 'Task added',
      description: newTask.title,
      kind: 'action',
    });
    return newTask;
  };

  const updateTask = (id: string, patch: Partial<Task>, activityNote?: string) => {
    const nowFormatted = format(new Date(), 'yyyy-MM-dd HH:mm');
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        const nextActivities = activityNote
          ? [
              {
                id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                actor: preferences.fullName,
                action: activityNote,
                timestamp: nowFormatted,
              },
              ...task.activities,
            ]
          : task.activities;
        return {
          ...task,
          ...patch,
          activities: nextActivities,
          updatedAt: format(new Date(), 'yyyy-MM-dd'),
        };
      })
    );
  };
  updateTaskRef.current = updateTask;

  const toggleTaskStatus = (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const isCompleting = target.status !== 'completed';
    if (isCompleting && preferences.soundAlertEnabled) {
      soundEngine.playCompletionBell();
      setPreferences((prev) => ({ ...prev, achievementScore: prev.achievementScore + 8 }));
    }

    // Recurring task completion flow: archives completed instance and advances recurring rule
    if (isCompleting && target.recurrenceRule) {
      const todayDateStr = format(new Date(), 'yyyy-MM-dd');
      const nowFormatted = format(new Date(), 'yyyy-MM-dd HH:mm');
      const baseDate = target.dueDate || target.startDate || todayDateStr;
      const nextDue = getNextOccurrenceDate(baseDate, target.recurrenceRule);
      const nextStart = target.startDate
        ? getNextOccurrenceDate(target.startDate, target.recurrenceRule)
        : nextDue;

      const completedInstance: Task = {
        ...target,
        id: crypto.randomUUID(),
        status: 'completed',
        dueDate: baseDate,
        startDate: target.startDate || baseDate,
        completedAt: new Date().toISOString(),
        recurrenceRule: undefined,
        title: target.title,
      };

      const resetSubtasks = target.subtasks?.map((st) => ({ ...st, completed: false })) || [];

      setTasks((prev) => [
        completedInstance,
        ...prev.map((t) => {
          if (t.id !== id) return t;
          return {
            ...t,
            status: 'todo' as const,
            dueDate: nextDue,
            startDate: nextStart,
            completedAt: undefined,
            subtasks: resetSubtasks,
            updatedAt: todayDateStr,
            activities: [
              {
                id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                actor: preferences.fullName,
                action: `Completed recurring occurrence (${baseDate}); next scheduled on ${nextDue}`,
                timestamp: nowFormatted,
              },
              ...t.activities,
            ],
          };
        }),
      ]);

      pushToast({
        title: 'Recurring task advanced',
        description: `Next occurrence: ${nextDue}`,
        kind: 'success',
      });
      return;
    }

    updateTask(
      id,
      {
        status: isCompleting ? 'completed' : 'todo',
        completedAt: isCompleting ? new Date().toISOString() : undefined,
      },
      isCompleting ? 'Marked task as completed' : 'Reopened task'
    );

    if (isCompleting) {
      pushToast({
        title: 'Task completed',
        description: target.title,
        kind: 'success',
        onUndo: () => {
          updateTask(id, { status: 'todo', completedAt: undefined }, 'Reopened task via Undo');
        },
      });
    }
  };

  const deleteTask = (id: string, permanent = false) => {
    const target = tasks.find((t) => t.id === id);
    if (selectedTaskId === id) setSelectedTaskId(null);
    if (permanent) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      pushToast({ title: 'Task permanently deleted', kind: 'info' });
    } else {
      updateTask(id, { status: 'trash' }, 'Moved task to Trash');
      pushToast({
        title: 'Moved to Trash',
        description: target?.title,
        kind: 'info',
        onUndo: () => restoreTask(id),
      });
    }
  };

  const restoreTask = (id: string) => {
    updateTask(id, { status: 'todo' }, 'Restored task from Trash');
    pushToast({ title: 'Task restored', kind: 'success' });
  };

  const duplicateTask = (id: string) => {
    const orig = tasks.find((t) => t.id === id);
    if (!orig) return;
    addTask({
      ...orig,
      title: `${orig.title} (Copy)`,
      status: 'todo',
      subtasks: orig.subtasks.map((s) => ({ ...s, id: `sub-${Date.now()}-${Math.random()}` })),
    });
  };

  const addSubtask = (taskId: string, title: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !title.trim()) return;
    const nextSubtasks = [
      ...task.subtasks,
      {
        id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        title: title.trim(),
        completed: false,
      },
    ];
    updateTask(taskId, { subtasks: nextSubtasks }, `Added checklist item "${title.trim()}"`);
  };

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const nextSubtasks = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    updateTask(taskId, { subtasks: nextSubtasks });
  };

  const deleteSubtask = (taskId: string, subtaskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    updateTask(taskId, {
      subtasks: task.subtasks.filter((s) => s.id !== subtaskId),
    });
  };

  const addTaskComment = (taskId: string, text: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !text.trim()) return;
    const nextComments = [
      ...task.comments,
      {
        id: `com-${Date.now()}`,
        author: preferences.fullName,
        avatarColor: '#2563eb',
        text: text.trim(),
        createdAt: format(new Date(), 'yyyy-MM-dd HH:mm'),
      },
    ];
    updateTask(taskId, { comments: nextComments }, 'Added a comment');
  };

  const addTaskAttachment = (
    taskId: string,
    name: string,
    url: string,
    type: 'image' | 'pdf' | 'doc' | 'link' = 'link'
  ) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !name.trim()) return;
    const nextAttachments = [
      ...task.attachments,
      {
        id: `att-${Date.now()}`,
        name: name.trim(),
        size: type === 'link' ? 'External URL' : '420 KB',
        type,
        url: url.trim() || '#',
        uploadedAt: format(new Date(), 'yyyy-MM-dd'),
      },
    ];
    updateTask(taskId, { attachments: nextAttachments }, `Attached "${name.trim()}"`);
  };

  const saveTaskAsTemplate = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newTpl: TaskTemplate = {
      id: `tpl-${Date.now()}`,
      name: task.title,
      category: 'Custom',
      title: task.title,
      content: task.content,
      priority: task.priority,
      tags: [...task.tags],
      durationMinutes: task.durationMinutes,
      subtasks: task.subtasks.map((s) => ({ title: s.title })),
    };
    setTemplates((prev) => [newTpl, ...prev]);
    updateTask(taskId, {}, 'Saved task as reusable Template');
    pushToast({
      title: 'Saved to Templates Hub',
      description: task.title,
      kind: 'success',
    });
  };

  const applyTemplate = (templateId: string, listId = 'inbox'): Task | null => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return null;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return addTask({
      title: tpl.title,
      content: tpl.content,
      priority: tpl.priority,
      tags: [...tpl.tags],
      listId,
      dueDate: todayStr,
      startDate: todayStr,
      durationMinutes: tpl.durationMinutes,
      subtasks: tpl.subtasks.map((s, idx) => ({
        id: `sub-${Date.now()}-${idx}`,
        title: s.title,
        completed: false,
      })),
    });
  };

  const addList = (
    name: string,
    color: string,
    folderId?: string,
    viewMode: ViewMode = 'list',
    extra?: Partial<TaskList>
  ) => {
    const newList: TaskList = {
      id: `list-${Date.now()}`,
      folderId,
      name: name.trim(),
      color,
      icon: 'list',
      emoji: extra?.emoji || '📁',
      listType: extra?.listType || 'task',
      showInSmartList: extra?.showInSmartList || 'all',
      isPinned: extra?.isPinned ?? false,
      isArchived: extra?.isArchived ?? false,
      backgroundStyle: 'none',
      viewMode,
      isShared: false,
      members: [],
      sortOrder: lists.length,
    };
    setLists((prev) => [...prev, newList]);
    if (viewMode === 'kanban') {
      setSections((prev) => [
        ...prev,
        { id: `sec-${Date.now()}-1`, listId: newList.id, name: 'To Do', sortOrder: 0 },
        { id: `sec-${Date.now()}-2`, listId: newList.id, name: 'In Progress', sortOrder: 1 },
        { id: `sec-${Date.now()}-3`, listId: newList.id, name: 'Done', sortOrder: 2 },
      ]);
    }
    pushToast({ title: `Created list "${newList.name}"`, kind: 'success' });
    return newList;
  };

  const updateList = (id: string, patch: Partial<TaskList>) => {
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    pushToast({ title: 'List updated', kind: 'success' });
  };

  const duplicateList = (id: string) => {
    const source = lists.find((l) => l.id === id);
    if (!source) return;
    const copyId = `list-${Date.now()}`;
    const copy: TaskList = {
      ...source,
      id: copyId,
      name: `${source.name} (Copy)`,
      sortOrder: lists.length,
    };
    setLists((prev) => [...prev, copy]);
    const listTasks = tasks.filter((t) => t.listId === id && t.status !== 'trash');
    if (listTasks.length > 0) {
      const nowStr = format(new Date(), 'yyyy-MM-dd');
      const clonedTasks: Task[] = listTasks.map((t, idx) => ({
        ...t,
        id: `task-${Date.now()}-${idx}`,
        listId: copyId,
        createdAt: nowStr,
        updatedAt: nowStr,
      }));
      setTasks((prev) => [...clonedTasks, ...prev]);
    }
    pushToast({ title: `Duplicated list "${source.name}"`, kind: 'success' });
  };

  const deleteList = (id: string) => {
    const target = lists.find((l) => l.id === id);
    setLists((prev) => prev.filter((l) => l.id !== id));
    setTasks((prev) => prev.map((t) => (t.listId === id ? { ...t, listId: 'inbox' } : t)));
    if (sidebarSelection.kind === 'list' && sidebarSelection.id === id) {
      setSidebarSelection({ kind: 'smart', id: 'inbox' });
    }
    pushToast({
      title: target ? `Deleted list "${target.name}"` : 'List deleted',
      description: 'Tasks moved to Inbox',
      kind: 'info',
    });
  };

  const addFolder = (name: string) => {
    if (!name.trim()) return;
    setFolders((prev) => [
      ...prev,
      {
        id: `folder-${Date.now()}`,
        name: name.trim(),
        isCollapsed: false,
        sortOrder: prev.length,
      },
    ]);
    pushToast({ title: `Folder "${name.trim()}" created`, kind: 'success' });
  };

  const updateFolder = (id: string, name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: clean } : f)));
    pushToast({ title: `Folder renamed to "${clean}"`, kind: 'success' });
  };

  const deleteFolder = (id: string) => {
    const target = folders.find((f) => f.id === id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setLists((prev) =>
      prev.map((l) => (l.folderId === id ? { ...l, folderId: undefined } : l))
    );
    pushToast({
      title: target ? `Deleted folder "${target.name}"` : 'Folder deleted',
      description: 'Lists inside were moved to root',
      kind: 'info',
    });
  };

  const toggleFolderCollapse = (id: string) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isCollapsed: !f.isCollapsed } : f))
    );
  };

  const addSection = (listId: string, name: string): TaskSection => {
    const sec: TaskSection = {
      id: `sec-${Date.now()}`,
      listId,
      name: name.trim(),
      sortOrder: sections.filter((s) => s.listId === listId).length,
    };
    setSections((prev) => [...prev, sec]);
    return sec;
  };

  const addTag = (name: string, color: string) => {
    const clean = name.trim().replace(/^#/, '').toLowerCase();
    if (!clean) return;
    setTags((prev) => {
      if (prev.some((t) => t.name === clean)) return prev;
      return [...prev, { id: `tag-${Date.now()}`, name: clean, color }];
    });
    pushToast({ title: `Tag #${clean} created`, kind: 'success' });
  };

  const updateTag = (id: string, name: string, color: string) => {
    const clean = name.trim().replace(/^#/, '').toLowerCase();
    if (!clean) return;
    const oldTag = tags.find((t) => t.id === id);
    setTags((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name: clean, color } : t))
    );
    if (oldTag && oldTag.name !== clean) {
      setTasks((prev) =>
        prev.map((task) => ({
          ...task,
          tags: task.tags.map((tg) => (tg === oldTag.name ? clean : tg)),
        }))
      );
      if (sidebarSelection.kind === 'tag' && sidebarSelection.id === oldTag.name) {
        setSidebarSelection({ kind: 'tag', id: clean });
      }
    }
    pushToast({ title: `Tag updated to #${clean}`, kind: 'success' });
  };

  const deleteTag = (id: string) => {
    const target = tags.find((t) => t.id === id);
    setTags((prev) => prev.filter((t) => t.id !== id));
    if (target) {
      setTasks((prev) =>
        prev.map((task) => ({
          ...task,
          tags: task.tags.filter((tg) => tg !== target.name),
        }))
      );
      if (sidebarSelection.kind === 'tag' && sidebarSelection.id === target.name) {
        setSidebarSelection({ kind: 'smart', id: 'today' });
      }
      pushToast({ title: `Deleted tag #${target.name}`, kind: 'info' });
    }
  };

  const addCustomFilter = (filter: Omit<CustomFilter, 'id'>) => {
    setCustomFilters((prev) => [...prev, { ...filter, id: `filter-${Date.now()}` }]);
    pushToast({ title: `Saved filter "${filter.name}"`, kind: 'success' });
  };

  const deleteCustomFilter = (id: string) => {
    setCustomFilters((prev) => prev.filter((f) => f.id !== id));
    if (sidebarSelection.kind === 'filter' && sidebarSelection.id === id) {
      setSidebarSelection({ kind: 'smart', id: 'today' });
    }
    pushToast({ title: 'Filter removed', kind: 'info' });
  };

  const addHabit = (habit: Omit<Habit, 'id' | 'logs' | 'createdAt'>) => {
    const newHabit: Habit = {
      ...habit,
      id: `habit-${Date.now()}`,
      logs: {},
      createdAt: new Date().toISOString(),
    };
    setHabits((prev) => [...prev, newHabit]);
    pushToast({ title: `Habit "${habit.name}" added`, kind: 'success' });
  };

  const updateHabit = (id: string, patch: Partial<Habit>) => {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    pushToast({ title: 'Habit updated', kind: 'success' });
  };

  const deleteHabitLog = (habitId: string, dateStr: string) => {
    setHabits((prev) =>
      prev.map((habit) => {
        if (habit.id !== habitId) return habit;
        const nextLogs = { ...habit.logs };
        delete nextLogs[dateStr];
        return { ...habit, logs: nextLogs };
      })
    );
    pushToast({ title: `Removed habit check-in for ${dateStr}`, kind: 'info' });
  };

  const clearHabitLogs = (habitId: string) => {
    setHabits((prev) =>
      prev.map((habit) => (habit.id === habitId ? { ...habit, logs: {} } : habit))
    );
    pushToast({ title: 'Cleared habit check-in history', kind: 'info' });
  };

  const toggleHabitDate = (
    habitId: string,
    dateStr: string,
    valueDelta?: number,
    note?: string,
    mood?: HabitLogEntry['mood']
  ) => {
    setHabits((prev) =>
      prev.map((habit) => {
        if (habit.id !== habitId) return habit;
        const existing = habit.logs[dateStr];
        const nextLogs = { ...habit.logs };

        if (habit.goalType === 'check') {
          if (existing?.completed && !note && !mood) {
            delete nextLogs[dateStr];
          } else {
            nextLogs[dateStr] = {
              value: 1,
              completed: true,
              note: note ?? existing?.note,
              mood: mood ?? existing?.mood ?? 'great',
              timestamp: new Date().toISOString(),
            };
            if (preferences.soundAlertEnabled) soundEngine.playCompletionBell();
          }
        } else {
          const normalizedUnit = (habit.unit || '').trim().toLowerCase();
          let defaultStep = Math.max(1, Math.round(habit.targetValue / 4));
          if (normalizedUnit === 'glasses' || normalizedUnit === 'times') {
            defaultStep = 1;
          } else if (normalizedUnit === 'ml' && habit.targetValue >= 500) {
            defaultStep = 250;
          } else if (normalizedUnit === 'steps' && habit.targetValue >= 2000) {
            defaultStep = 2500;
          } else if (normalizedUnit === 'mins') {
            defaultStep = habit.targetValue <= 15 ? 5 : habit.targetValue <= 45 ? 10 : 15;
          } else if (normalizedUnit === 'pages') {
            defaultStep = habit.targetValue <= 10 ? 1 : habit.targetValue <= 30 ? 5 : 10;
          } else if (habit.targetValue <= 10) {
            defaultStep = 1;
          }
          const step = valueDelta ?? defaultStep;
          const currentVal = existing?.value ?? 0;
          const nextVal =
            currentVal >= habit.targetValue && valueDelta === undefined
              ? 0
              : Math.min(habit.targetValue, currentVal + step);
          if (nextVal <= 0) {
            delete nextLogs[dateStr];
          } else {
            const completed = nextVal >= habit.targetValue;
            if (completed && !existing?.completed && preferences.soundAlertEnabled) {
              soundEngine.playCompletionBell();
            }
            nextLogs[dateStr] = {
              value: nextVal,
              completed,
              note: note ?? existing?.note,
              mood: mood ?? existing?.mood ?? 'good',
              timestamp: new Date().toISOString(),
            };
          }
        }

        return { ...habit, logs: nextLogs };
      })
    );
  };

  const deleteHabit = (id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
  };

  const addCountdown = (item: Omit<CountdownItem, 'id'>) => {
    setCountdowns((prev) => [{ ...item, id: `cd-${Date.now()}` }, ...prev]);
    pushToast({ title: `Countdown "${item.title}" created`, kind: 'success' });
  };

  const deleteCountdown = (id: string) => {
    setCountdowns((prev) => prev.filter((c) => c.id !== id));
  };

  const addCalendarSubscription = (
    name: string,
    url: string,
    provider: CalendarSubscription['provider'],
    color: string
  ) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    setCalendarSubscriptions((prev) => [
      ...prev,
      {
        id: `calsub-${Date.now()}`,
        name,
        url,
        provider,
        color,
        enabled: true,
        events: [
          {
            id: `ext-${Date.now()}`,
            title: `${name} Synced Event`,
            date: todayStr,
            startTime: '11:00',
            endTime: '12:00',
            location: 'External Calendar',
          },
        ],
      },
    ]);
    pushToast({ title: `Subscribed to ${name}`, kind: 'success' });
  };

  const toggleCalendarSubscription = (id: string) => {
    setCalendarSubscriptions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const updatePreferences = (patch: Partial<UserPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...patch }));
  };

  const setTheme = (theme: ThemeId) => {
    updatePreferences({ theme });
    pushToast({ title: `Theme updated`, description: theme, kind: 'info' });
  };

  const openSettingsTab = (
    tab: 'general' | 'themes' | 'supabase' | 'shortcuts' | 'premium'
  ) => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  };

  const [rightPaneWidth, setRightPaneWidthState] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? Number(localStorage.getItem('ticktick_v2_right_pane_width')) : 0;
    return saved >= 280 && saved <= 680 ? saved : 392;
  });

  const setRightPaneWidth = useCallback((width: number) => {
    const clamped = Math.max(280, Math.min(680, Math.round(width)));
    setRightPaneWidthState(clamped);
    try {
      localStorage.setItem('ticktick_v2_right_pane_width', String(clamped));
    } catch {
      // ignore
    }
  }, []);

  const resetDemoWorkspace = () => {
    setTasks(INITIAL_TASKS);
    setLists(INITIAL_LISTS);
    setFolders(INITIAL_FOLDERS);
    setSections(INITIAL_SECTIONS);
    setTags(INITIAL_TAGS);
    setCustomFilters(INITIAL_FILTERS);
    setHabits(INITIAL_HABITS);
    setPomodoroSessions(INITIAL_POMODORO_SESSIONS);
    setCountdowns(INITIAL_COUNTDOWNS);
    setTemplates(INITIAL_TEMPLATES);
    setCalendarSubscriptions(INITIAL_CALENDAR_SUBSCRIPTIONS);
    setPreferences(INITIAL_PREFERENCES);
    pushToast({ title: 'Sample workspace restored', kind: 'info' });
  };

  const clearAllWorkspaceData = () => {
    const ts = Date.now();
    localUpdatedAtRef.current = ts;
    localStorage.setItem('ticktick_v2_updated_at', String(ts));
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    saveStored('tasks', []);
    saveStored('lists', []);
    saveStored('folders', []);
    saveStored('sections', []);
    saveStored('tags', []);
    saveStored('filters', []);
    saveStored('habits', []);
    saveStored('pomo_sessions', []);
    saveStored('countdowns', []);
    saveStored('templates', []);
    saveStored('cal_subs', []);
    setTasks([]);
    setLists([]);
    setFolders([]);
    setSections([]);
    setTags([]);
    setCustomFilters([]);
    setHabits([]);
    setPomodoroSessions([]);
    setCountdowns([]);
    setTemplates([]);
    setCalendarSubscriptions([]);
    setSelectedTaskId(null);
    setActivePomoTaskId(null);
    setSidebarSelection({ kind: 'smart', id: 'inbox' });
    setPreferences((prev) => ({ ...prev, achievementScore: 0 }));
    pushToast({
      title: 'Workspace reset to blank slate',
      description: 'All demo tasks, lists, folders, tags, habits & focus logs cleared.',
      kind: 'success',
    });
  };

  // Supabase connection & real-time cross-device sync state
  const [supabaseStatus, setSupabaseStatus] = useState<
    'local_only' | 'connected' | 'syncing' | 'error'
  >(() => (getSupabaseConfig().isConfigured ? 'connected' : 'local_only'));
  const [supabaseUserEmail, setSupabaseUserEmail] = useState<string | null>(null);
  const [supabaseLastSyncedAt, setSupabaseLastSyncedAt] = useState<string | null>(null);
  const [supabaseErrorMessage, setSupabaseErrorMessage] = useState<string | null>(null);

  const deviceIdRef = useRef<string>(
    `dev-${Math.random().toString(36).slice(2, 10)}`
  );
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isApplyingRemoteRef = useRef<boolean>(false);
  const isInitialMountRef = useRef<boolean>(true);
  const hasCompletedInitialPullRef = useRef<boolean>(false);
  const localUpdatedAtRef = useRef<number>(
    Number(localStorage.getItem('ticktick_v2_updated_at') || '0')
  );

  // Known Demo / Seed IDs so mock data on a new device is never mistaken for personal cloud data
  const seedTaskIds = useMemo(() => new Set(INITIAL_TASKS.map((t) => t.id)), []);
  const seedTaskTitles = useMemo(
    () => new Map(INITIAL_TASKS.map((t) => [t.id, t.title])),
    []
  );
  const seedListIds = useMemo(() => new Set(INITIAL_LISTS.map((l) => l.id)), []);
  const seedListNames = useMemo(
    () => new Map(INITIAL_LISTS.map((l) => [l.id, l.name])),
    []
  );
  const seedPomoIds = useMemo(
    () => new Set(INITIAL_POMODORO_SESSIONS.map((p) => p.id)),
    []
  );

  const isMockSeedTaskList = useCallback(
    (taskList?: Task[] | null): boolean => {
      if (!Array.isArray(taskList) || taskList.length === 0) return false;
      return (
        taskList.length === INITIAL_TASKS.length &&
        taskList.every(
          (t) => seedTaskIds.has(t.id) && seedTaskTitles.get(t.id) === t.title
        )
      );
    },
    [seedTaskIds, seedTaskTitles]
  );

  interface CloudWorkspaceSnapshot {
    deviceId: string;
    updatedAt: number;
    userName?: string;
    preferences?: Partial<UserPreferences>;
    tasks: Task[];
    lists: TaskList[];
    folders: Folder[];
    sections: TaskSection[];
    tags: TagItem[];
    habits: Habit[];
    pomodoroSessions?: PomodoroSession[];
    countdowns: CountdownItem[];
    customFilters?: CustomFilter[];
    templates?: TaskTemplate[];
    calendarSubscriptions?: CalendarSubscription[];
  }

  const buildSnapshot = useCallback(
    (overrideUpdatedAt?: number): CloudWorkspaceSnapshot => {
      // Never stamp untouched mock seed data with Date.now() unless explicitly pushing a user edit
      const ts = overrideUpdatedAt ?? localUpdatedAtRef.current;
      if (overrideUpdatedAt !== undefined) {
        localUpdatedAtRef.current = ts;
        try {
          localStorage.setItem('ticktick_v2_updated_at', String(ts));
        } catch {
          // ignore storage quota errors
        }
      }
      return {
        deviceId: deviceIdRef.current,
        updatedAt: ts,
        userName: preferences.fullName,
        preferences: {
          fullName: preferences.fullName,
          email: preferences.email,
          theme: preferences.theme,
          achievementScore: preferences.achievementScore,
        },
        tasks,
        lists,
        folders,
        sections,
        tags,
        habits,
        pomodoroSessions,
        countdowns,
        customFilters,
        templates,
        calendarSubscriptions,
      };
    },
    [
      tasks,
      lists,
      folders,
      sections,
      tags,
      habits,
      pomodoroSessions,
      countdowns,
      customFilters,
      templates,
      calendarSubscriptions,
      preferences,
    ]
  );

  const buildSnapshotRef = useRef(buildSnapshot);
  useEffect(() => {
    buildSnapshotRef.current = buildSnapshot;
  }, [buildSnapshot]);

  const applyRemoteSnapshot = useCallback(
    (snap: Partial<CloudWorkspaceSnapshot>, silent = false) => {
      if (!snap || !Array.isArray(snap.tasks)) return false;
      isApplyingRemoteRef.current = true;
      const nextTs = snap.updatedAt || Date.now();
      localUpdatedAtRef.current = nextTs;
      try {
        localStorage.setItem('ticktick_v2_updated_at', String(nextTs));
      } catch {
        // ignore
      }

      setTasks(snap.tasks);
      saveStored('tasks', snap.tasks);

      if (Array.isArray(snap.lists)) {
        setLists(snap.lists);
        saveStored('lists', snap.lists);
      }
      if (Array.isArray(snap.folders)) {
        setFolders(snap.folders);
        saveStored('folders', snap.folders);
      }
      if (Array.isArray(snap.sections)) {
        setSections(snap.sections);
        saveStored('sections', snap.sections);
      }
      if (Array.isArray(snap.tags)) {
        setTags(snap.tags);
        saveStored('tags', snap.tags);
      }
      if (Array.isArray(snap.habits)) {
        setHabits(snap.habits);
        saveStored('habits', snap.habits);
      }
      if (Array.isArray(snap.pomodoroSessions)) {
        setPomodoroSessions(snap.pomodoroSessions);
        saveStored('pomo_sessions', snap.pomodoroSessions);
      }
      if (Array.isArray(snap.countdowns)) {
        setCountdowns(snap.countdowns);
        saveStored('countdowns', snap.countdowns);
      }
      if (Array.isArray(snap.customFilters)) {
        setCustomFilters(snap.customFilters);
        saveStored('filters', snap.customFilters);
      }
      if (Array.isArray(snap.templates)) {
        setTemplates(snap.templates);
        saveStored('templates', snap.templates);
      }
      if (Array.isArray(snap.calendarSubscriptions)) {
        setCalendarSubscriptions(snap.calendarSubscriptions);
        saveStored('cal_subs', snap.calendarSubscriptions);
      }
      if (snap.preferences?.fullName) {
        setPreferences((prev) => ({
          ...prev,
          fullName: snap.preferences?.fullName || prev.fullName,
          email: snap.preferences?.email || prev.email,
          theme: snap.preferences?.theme || prev.theme,
          achievementScore:
            typeof snap.preferences?.achievementScore === 'number'
              ? snap.preferences.achievementScore
              : prev.achievementScore,
        }));
      } else if (snap.userName) {
        setPreferences((prev) => ({ ...prev, fullName: snap.userName || prev.fullName }));
      }

      const syncedTime = format(new Date(), 'HH:mm:ss');
      setSupabaseLastSyncedAt(syncedTime);
      setSupabaseStatus('connected');
      setSupabaseErrorMessage(null);
      if (!silent) {
        pushToast({
          title: 'Personal Data Loaded from Database',
          description: `${snap.tasks.length} tasks & ${(snap.pomodoroSessions || []).length} focus logs synced`,
          kind: 'success',
        });
      }
      return true;
    },
    [pushToast]
  );

  const setupRealtimeChannel = useCallback(() => {
    const client = getSupabaseClient();
    if (!client) {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      setSupabaseStatus('local_only');
      return null;
    }

    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    const channel = client.channel('ticktick-workspace-sync-v1', {
      config: {
        broadcast: { self: false },
        presence: { key: deviceIdRef.current },
      },
    });

    channel
      .on('broadcast', { event: 'workspace-sync' }, ({ payload }) => {
        const snap = payload as CloudWorkspaceSnapshot | undefined;
        if (!snap || snap.deviceId === deviceIdRef.current) return;
        // Never allow a peer holding default mock seed data to overwrite personal data
        if (isMockSeedTaskList(snap.tasks)) return;
        applyRemoteSnapshot(snap, false);
      })
      .on('broadcast', { event: 'request-workspace' }, ({ payload }) => {
        const requesterId = (payload as { deviceId?: string })?.deviceId;
        if (requesterId === deviceIdRef.current) return;
        const currentSnap = buildSnapshotRef.current();
        // Never broadcast untouched mock seed data to a newly connecting device
        if (isMockSeedTaskList(currentSnap.tasks) && localUpdatedAtRef.current === 0) {
          return;
        }
        channel.send({
          type: 'broadcast',
          event: 'workspace-reply',
          payload: currentSnap,
        });
      })
      .on('broadcast', { event: 'workspace-reply' }, ({ payload }) => {
        const snap = payload as CloudWorkspaceSnapshot | undefined;
        if (!snap || snap.deviceId === deviceIdRef.current) return;
        if (isMockSeedTaskList(snap.tasks)) return;
        if (
          isMockSeedTaskList(tasksRef.current) ||
          (snap.updatedAt || 0) >= localUpdatedAtRef.current
        ) {
          applyRemoteSnapshot(snap, true);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<CloudWorkspaceSnapshot>();
        let newestPeer: CloudWorkspaceSnapshot | null = null;
        Object.entries(state).forEach(([key, entries]) => {
          if (key === deviceIdRef.current || !Array.isArray(entries)) return;
          entries.forEach((entry) => {
            if (
              entry &&
              Array.isArray(entry.tasks) &&
              !isMockSeedTaskList(entry.tasks) &&
              (isMockSeedTaskList(tasksRef.current) ||
                entry.updatedAt > localUpdatedAtRef.current) &&
              (!newestPeer || entry.updatedAt > newestPeer.updatedAt)
            ) {
              newestPeer = entry;
            }
          });
        });
        if (newestPeer) {
          applyRemoteSnapshot(newestPeer, true);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setSupabaseStatus('connected');
          setSupabaseLastSyncedAt(format(new Date(), 'HH:mm:ss'));
          const initialSnap = buildSnapshotRef.current();
          // Only track in presence if this device has real personal data (never track fresh mock data!)
          if (!isMockSeedTaskList(initialSnap.tasks) && initialSnap.updatedAt > 0) {
            await channel.track(initialSnap);
          } else {
            await channel.send({
              type: 'broadcast',
              event: 'request-workspace',
              payload: { deviceId: deviceIdRef.current },
            });
          }
        }
      });

    channelRef.current = channel;
    return channel;
  }, [applyRemoteSnapshot, isMockSeedTaskList]);

  const pullWorkspaceFromSupabase = useCallback(
    async (options?: {
      isInitialConnect?: boolean;
      silent?: boolean;
    }): Promise<{ ok: boolean; message: string }> => {
      const client = getSupabaseClient();
      if (!client) {
        return { ok: false, message: 'Supabase URL & Key are not configured yet.' };
      }
      setSupabaseStatus('syncing');
      setSupabaseErrorMessage(null);

      try {
        let bestSnapshot: Partial<CloudWorkspaceSnapshot> | null = null;
        let sourceLabel = 'Supabase Cloud';
        let wsWasMockOverwritten = false;

        // 1. Query ticktick_workspace, tasks, lists, pomodoro_sessions, and profiles in parallel
        const [wsQuery, tasksQuery, listsQuery, pomoQuery, profQuery] = await Promise.all([
          client
            .from('ticktick_workspace')
            .select('*')
            .eq('id', 'default')
            .maybeSingle(),
          client
            .from('tasks')
            .select('*')
            .order('updated_at', { ascending: false }),
          client.from('lists').select('*'),
          client.from('pomodoro_sessions').select('*'),
          client.from('profiles').select('*').eq('id', 'default').maybeSingle(),
        ]);

        // Extract profile name if customized
        let recoveredUserName: string | undefined;
        let recoveredUserEmail: string | undefined;
        if (!profQuery.error && profQuery.data) {
          const pName = profQuery.data.full_name || profQuery.data.name;
          if (pName && pName !== 'Alex Rivera') {
            recoveredUserName = String(pName);
          }
          if (profQuery.data.email && profQuery.data.email !== 'alex.rivera@workspace.dev') {
            recoveredUserEmail = String(profQuery.data.email);
          }
        }

        // Inspect ticktick_workspace snapshot
        if (!wsQuery.error && wsQuery.data) {
          if (
            wsQuery.data.name &&
            wsQuery.data.name !== 'Alex Rivera' &&
            !recoveredUserName
          ) {
            recoveredUserName = String(wsQuery.data.name);
          }
          if (wsQuery.data.payload) {
            const dbSnap = wsQuery.data.payload as CloudWorkspaceSnapshot;
            if (dbSnap && Array.isArray(dbSnap.tasks)) {
              if (isMockSeedTaskList(dbSnap.tasks)) {
                // ticktick_workspace was accidentally overwritten by a new device's mock seed data!
                wsWasMockOverwritten = true;
              } else {
                bestSnapshot = dbSnap;
                sourceLabel = 'Supabase PostgreSQL';
              }
            }
          }
        }

        // 2. Inspect public.tasks, public.lists, and public.pomodoro_sessions for personal rows
        let mappedTableTasks: Task[] = [];
        if (!tasksQuery.error && Array.isArray(tasksQuery.data) && tasksQuery.data.length > 0) {
          mappedTableTasks = tasksQuery.data.map(
            (row: Record<string, unknown>, idx: number) => ({
              id: String(row.id),
              title: String(row.name || row.title || 'Untitled'),
              content: String(row.content || ''),
              isNote: Boolean(row.is_note),
              listId: String(row.list_id || 'inbox'),
              status: (row.status as TaskStatus) || 'todo',
              priority: (Number(row.priority) as Priority) || 0,
              tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
              dueDate: row.due_date ? String(row.due_date).slice(0, 10) : undefined,
              startDate: row.due_date ? String(row.due_date).slice(0, 10) : undefined,
              isAllDay: Boolean(row.is_all_day ?? true),
              durationMinutes: row.duration_minutes ? Number(row.duration_minutes) : undefined,
              reminders: Array.isArray(row.reminders) ? (row.reminders as string[]) : [],
              constantReminder: Boolean(row.constant_reminder),
              emailReminder: Boolean(row.email_reminder),
              estimatedPomos: Number(row.estimated_pomos || 0),
              completedPomos: Number(row.completed_pomos || 0),
              focusSeconds: Number(row.focus_seconds || 0),
              subtasks: Array.isArray(row.subtasks) ? (row.subtasks as Task['subtasks']) : [],
              attachments: Array.isArray(row.attachments)
                ? (row.attachments as Task['attachments'])
                : [],
              comments: Array.isArray(row.comments) ? (row.comments as Task['comments']) : [],
              activities: Array.isArray(row.activities)
                ? (row.activities as Task['activities'])
                : [],
              isPinned: Boolean(row.is_pinned),
              sortOrder: idx,
              createdAt: String(row.created_at || new Date().toISOString()).slice(0, 10),
              updatedAt: String(row.updated_at || new Date().toISOString()).slice(0, 10),
            })
          );
        }

        // Filter out untouched demo seed tasks so we can recover the user's personal tasks
        const personalTableTasks = mappedTableTasks.filter(
          (t) => !seedTaskIds.has(t.id) || seedTaskTitles.get(t.id) !== t.title
        );

        let personalTableLists: TaskList[] = [];
        if (!listsQuery.error && Array.isArray(listsQuery.data) && listsQuery.data.length > 0) {
          const allTableLists: TaskList[] = listsQuery.data.map(
            (row: Record<string, unknown>, idx: number) => ({
              id: String(row.id),
              name: String(row.name || 'List'),
              color: String(row.color || '#2563eb'),
              emoji: row.emoji ? String(row.emoji) : undefined,
              icon: 'list',
              backgroundStyle: 'none',
              viewMode: 'list',
              isShared: false,
              members: [],
              sortOrder: idx,
            })
          );
          personalTableLists = allTableLists.filter(
            (l) => !seedListIds.has(l.id) || seedListNames.get(l.id) !== l.name
          );
        }

        let personalTablePomos: PomodoroSession[] = [];
        if (!pomoQuery.error && Array.isArray(pomoQuery.data) && pomoQuery.data.length > 0) {
          const allTablePomos: PomodoroSession[] = pomoQuery.data.map(
            (row: Record<string, unknown>) => ({
              id: String(row.id),
              taskId: row.task_id ? String(row.task_id) : undefined,
              taskTitle: String(row.task_title || 'Focus Session'),
              mode: row.mode === 'stopwatch' ? 'stopwatch' : 'pomo',
              startTime: String(row.start_time || new Date().toISOString()),
              endTime: String(row.end_time || new Date().toISOString()),
              durationMinutes: Number(row.duration_minutes || 25),
              note: String(row.note || ''),
            })
          );
          personalTablePomos = allTablePomos.filter((p) => !seedPomoIds.has(p.id));
        }

        // If bestSnapshot is null (or ticktick_workspace was overwritten by mock data) and we found personal rows in tables:
        if (!bestSnapshot && (personalTableTasks.length > 0 || personalTableLists.length > 0 || personalTablePomos.length > 0)) {
          bestSnapshot = {
            updatedAt: Date.now(),
            userName: recoveredUserName,
            preferences: recoveredUserName
              ? { fullName: recoveredUserName, email: recoveredUserEmail }
              : undefined,
            tasks: personalTableTasks,
            lists: personalTableLists,
            folders: [],
            sections: [],
            tags: [],
            habits: [],
            pomodoroSessions: personalTablePomos,
            countdowns: [],
            customFilters: [],
          };
          sourceLabel = 'Supabase PostgreSQL (Recovered Personal Data)';
        } else if (bestSnapshot && Array.isArray(bestSnapshot.tasks)) {
          // Merge any personal tasks from public.tasks that might be missing from bestSnapshot
          const existingTaskIds = new Set(bestSnapshot.tasks.map((t) => t.id));
          const missingPersonalTasks = personalTableTasks.filter(
            (t) => !existingTaskIds.has(t.id)
          );
          if (missingPersonalTasks.length > 0) {
            bestSnapshot = {
              ...bestSnapshot,
              tasks: [...missingPersonalTasks, ...bestSnapshot.tasks],
            };
          }
          if (personalTableLists.length > 0) {
            const existingListIds = new Set((bestSnapshot.lists || []).map((l) => l.id));
            const missingPersonalLists = personalTableLists.filter(
              (l) => !existingListIds.has(l.id)
            );
            if (missingPersonalLists.length > 0) {
              bestSnapshot = {
                ...bestSnapshot,
                lists: [...(bestSnapshot.lists || []), ...missingPersonalLists],
              };
            }
          }
          if (personalTablePomos.length > 0) {
            const existingPomoIds = new Set(
              (bestSnapshot.pomodoroSessions || []).map((p) => p.id)
            );
            const missingPersonalPomos = personalTablePomos.filter(
              (p) => !existingPomoIds.has(p.id)
            );
            if (missingPersonalPomos.length > 0) {
              bestSnapshot = {
                ...bestSnapshot,
                pomodoroSessions: [
                  ...missingPersonalPomos,
                  ...(bestSnapshot.pomodoroSessions || []),
                ],
              };
            }
          }
        }

        // 3. Check active Supabase Realtime Presence state & request live peer state
        let channel = channelRef.current;
        if (!channel) {
          channel = setupRealtimeChannel();
        }

        if (channel) {
          await channel.send({
            type: 'broadcast',
            event: 'request-workspace',
            payload: { deviceId: deviceIdRef.current },
          });
          await new Promise((resolve) => setTimeout(resolve, 650));

          const state = channel.presenceState<CloudWorkspaceSnapshot>();
          Object.entries(state).forEach(([key, entries]) => {
            if (key === deviceIdRef.current || !Array.isArray(entries)) return;
            entries.forEach((entry) => {
              if (
                entry &&
                Array.isArray(entry.tasks) &&
                !isMockSeedTaskList(entry.tasks) &&
                (!bestSnapshot || (entry.updatedAt || 0) >= (bestSnapshot.updatedAt || 0))
              ) {
                bestSnapshot = entry;
                sourceLabel = 'Supabase Realtime Peer';
              }
            });
          });
        }

        if (recoveredUserName) {
          updatePreferences({
            fullName: recoveredUserName,
            ...(recoveredUserEmail ? { email: recoveredUserEmail } : {}),
          });
        }

        const syncedTime = format(new Date(), 'HH:mm:ss');
        setSupabaseLastSyncedAt(syncedTime);
        setSupabaseStatus('connected');

        if (bestSnapshot && Array.isArray(bestSnapshot.tasks)) {
          applyRemoteSnapshot(bestSnapshot, options?.silent);
          // If ticktick_workspace had been polluted by mock data, heal it immediately with the recovered personal snapshot
          if (wsWasMockOverwritten) {
            try {
              await client.from('ticktick_workspace').upsert({
                id: 'default',
                name: bestSnapshot.userName || recoveredUserName || preferencesRef.current.fullName,
                payload: bestSnapshot,
                updated_at: new Date().toISOString(),
              });
            } catch {
              // ignore
            }
          }
          return {
            ok: true,
            message: `Pulled ${bestSnapshot.tasks.length} personal tasks from ${sourceLabel} at ${syncedTime}.`,
          };
        }

        // If connecting on a new device that only had default mock seed data, never leave mock data on screen!
        if (
          (options?.isInitialConnect || wsWasMockOverwritten) &&
          isMockSeedTaskList(tasksRef.current)
        ) {
          const cleanEmptySnapshot: CloudWorkspaceSnapshot = {
            deviceId: deviceIdRef.current,
            updatedAt: Date.now(),
            userName: recoveredUserName || preferencesRef.current.fullName,
            preferences: {
              fullName: recoveredUserName || preferencesRef.current.fullName,
              email: recoveredUserEmail || preferencesRef.current.email,
              theme: preferencesRef.current.theme,
              achievementScore: 0,
            },
            tasks: [],
            lists: [],
            folders: [],
            sections: [],
            tags: [],
            habits: [],
            pomodoroSessions: [],
            countdowns: [],
            customFilters: [],
            templates: [],
            calendarSubscriptions: [],
          };
          applyRemoteSnapshot(cleanEmptySnapshot, true);
          if (!options?.silent) {
            pushToast({
              title: 'Connected to Personal Database',
              description: 'Mock demo data cleared. Your personal cloud workspace is ready.',
              kind: 'success',
            });
          }
          return {
            ok: true,
            message: `Connected to Supabase Cloud at ${syncedTime} — mock demo data cleared for your personal workspace.`,
          };
        }

        if (!options?.silent) {
          pushToast({
            title: 'Workspace is up to date',
            description: `Connected to Supabase Cloud (${tasksRef.current.length} tasks)`,
            kind: 'success',
          });
        }
        return {
          ok: true,
          message: `Connected to Supabase Cloud — workspace is up to date (${tasksRef.current.length} tasks) at ${syncedTime}.`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Pull failed';
        setSupabaseStatus('error');
        setSupabaseErrorMessage(msg);
        return { ok: false, message: msg };
      }
    },
    [
      applyRemoteSnapshot,
      isMockSeedTaskList,
      pushToast,
      seedListIds,
      seedListNames,
      seedPomoIds,
      seedTaskIds,
      seedTaskTitles,
      setupRealtimeChannel,
    ]
  );

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setSupabaseStatus('local_only');
      return;
    }
    setSupabaseStatus('connected');
    client.auth.getSession().then(({ data }) => {
      if (data?.session?.user?.email) {
        setSupabaseUserEmail(data.session.user.email);
      }
    });
    setupRealtimeChannel();
    // Always pull personal data from Supabase on startup before allowing any local auto-push
    hasCompletedInitialPullRef.current = false;
    pullWorkspaceFromSupabase({ isInitialConnect: true, silent: true }).finally(() => {
      hasCompletedInitialPullRef.current = true;
    });

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [setupRealtimeChannel, pullWorkspaceFromSupabase]);

  // Automatically broadcast local workspace edits to connected PC/Mobile peers & Supabase tables
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (isApplyingRemoteRef.current) {
      isApplyingRemoteRef.current = false;
      return;
    }
    // Never auto-push before the initial cloud pull finishes, and never auto-push default mock seed data!
    if (!hasCompletedInitialPullRef.current) return;
    if (isMockSeedTaskList(tasks)) return;

    const client = getSupabaseClient();
    if (!client || !channelRef.current) return;

    const timer = setTimeout(async () => {
      const snap = buildSnapshot(Date.now());
      try {
        await channelRef.current?.track(snap);
        await channelRef.current?.send({
          type: 'broadcast',
          event: 'workspace-sync',
          payload: snap,
        });
        setSupabaseLastSyncedAt(format(new Date(), 'HH:mm:ss'));
        // Persist to PostgreSQL ticktick_workspace table if available
        try {
          await client
            .from('ticktick_workspace')
            .upsert({ id: 'default', name: preferences.fullName, payload: snap, updated_at: new Date().toISOString() });
        } catch {
          await client
            .from('ticktick_workspace')
            .upsert({ id: 'default', payload: snap, updated_at: new Date().toISOString() });
        }

        // Also persist tasks to public.tasks so personal tasks are always backed up in individual rows
        try {
          if (tasks.length > 0) {
            const richTaskRows = tasks.map((t) => ({
              id: t.id,
              name: t.title,
              title: t.title,
              content: t.content,
              status: t.status,
              priority: t.priority,
              due_date: t.dueDate,
              list_id: t.listId,
              completed_pomos: t.completedPomos,
              focus_seconds: t.focusSeconds,
              activities: t.activities,
              updated_at: new Date().toISOString(),
            }));
            const tRes = await client.from('tasks').upsert(richTaskRows);
            if (tRes.error) {
              await client.from('tasks').upsert(
                tasks.map((t) => ({
                  id: t.id,
                  title: t.title,
                  content: t.content,
                  status: t.status,
                  priority: t.priority,
                  due_date: t.dueDate,
                  list_id: t.listId,
                  updated_at: new Date().toISOString(),
                }))
              );
            }
          }
        } catch {
          // Ignore if table does not exist
        }

        // Also persist Pomodoro & Stopwatch focus logs
        try {
          if (pomodoroSessions.length > 0) {
            await client.from('pomodoro_sessions').upsert(
              pomodoroSessions.map((s) => ({
                id: s.id,
                task_id: s.taskId || null,
                task_title: s.taskTitle,
                mode: s.mode,
                start_time: s.startTime,
                end_time: s.endTime,
                duration_minutes: s.durationMinutes,
                note: s.note,
              }))
            );
          }
        } catch {
          // Ignore if table does not exist
        }

        // Also persist user profile name to profiles table if it exists
        try {
          await client.from('profiles').upsert({
            id: 'default',
            name: preferences.fullName,
            full_name: preferences.fullName,
            email: preferences.email,
            updated_at: new Date().toISOString(),
          });
        } catch {
          // Ignore if table does not exist
        }
      } catch {
        // Ignore if optional PostgreSQL table is not created yet; Realtime sync is active
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [
    tasks,
    lists,
    folders,
    sections,
    tags,
    habits,
    pomodoroSessions,
    countdowns,
    customFilters,
    templates,
    calendarSubscriptions,
    preferences,
    buildSnapshot,
    isMockSeedTaskList,
  ]);

  const connectSupabase = async (url: string, anonKey: string): Promise<boolean> => {
    saveRuntimeSupabaseConfig(url, anonKey);
    const client = getSupabaseClient();
    if (!client) {
      setSupabaseStatus('local_only');
      return false;
    }
    setSupabaseStatus('syncing');
    setSupabaseErrorMessage(null);
    hasCompletedInitialPullRef.current = false;
    try {
      const { error } = await client.auth.getSession();
      if (error) {
        setSupabaseStatus('error');
        setSupabaseErrorMessage(error.message);
        return false;
      }
      setupRealtimeChannel();
      // Immediately pull the user's personal data from the database (and strip mock data if on a new device)
      await pullWorkspaceFromSupabase({ isInitialConnect: true, silent: false });
      hasCompletedInitialPullRef.current = true;
      setSupabaseStatus('connected');
      setSupabaseLastSyncedAt(format(new Date(), 'HH:mm:ss'));
      setIsDatabasePromptOpen(false);
      setDatabasePromptDismissed();
      return true;
    } catch (err) {
      hasCompletedInitialPullRef.current = true;
      setSupabaseStatus('error');
      setSupabaseErrorMessage(
        err instanceof Error ? err.message : 'Failed to connect to Supabase'
      );
      return false;
    }
  };

  const disconnectSupabase = () => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    saveRuntimeSupabaseConfig('', '');
    setSupabaseStatus('local_only');
    setSupabaseUserEmail(null);
    setSupabaseErrorMessage(null);
    setDatabasePromptDismissed();
    pushToast({ title: 'Switched to Local-First storage', kind: 'info' });
  };

  const syncWorkspaceToSupabase = async (): Promise<{ ok: boolean; message: string }> => {
    const client = getSupabaseClient();
    if (!client) {
      return { ok: false, message: 'Supabase URL & Key are not configured yet.' };
    }
    setSupabaseStatus('syncing');
    setSupabaseErrorMessage(null);

    try {
      // Safety guard: if this device is still holding untouched mock seed data, pull personal data first instead of overwriting the cloud!
      if (isMockSeedTaskList(tasks)) {
        const pullRes = await pullWorkspaceFromSupabase({ isInitialConnect: true, silent: false });
        if (pullRes.ok) {
          return pullRes;
        }
      }

      const snap = buildSnapshot(Date.now());
      let channel = channelRef.current;
      if (!channel) {
        channel = setupRealtimeChannel();
      }

      if (channel) {
        await Promise.race([
          (async () => {
            try {
              await channel.track(snap);
              await channel.send({
                type: 'broadcast',
                event: 'workspace-sync',
                payload: snap,
              });
            } catch {
              // ignore transient socket state
            }
          })(),
          new Promise((resolve) => setTimeout(resolve, 1200)),
        ]);
      }

      // Attempt optional PostgreSQL table persistence (ticktick_workspace, profiles, tasks, lists)
      let dbPersisted = false;
      try {
        const wsWithCol = await client
          .from('ticktick_workspace')
          .upsert({ id: 'default', name: preferences.fullName, payload: snap, updated_at: new Date().toISOString() });
        if (!wsWithCol.error) {
          dbPersisted = true;
        } else {
          const wsFallback = await client
            .from('ticktick_workspace')
            .upsert({ id: 'default', payload: snap, updated_at: new Date().toISOString() });
          if (!wsFallback.error) dbPersisted = true;
        }
      } catch {
        // ignore
      }

      // Also persist to profiles table (display name & email)
      try {
        await client.from('profiles').upsert({
          id: 'default',
          name: preferences.fullName,
          full_name: preferences.fullName,
          email: preferences.email,
          updated_at: new Date().toISOString(),
        });
      } catch {
        // ignore if table doesn't exist
      }

      // Also persist individual tasks (including activities, focus_seconds, completed_pomos)
      try {
        if (tasks.length > 0) {
          const richTaskRows = tasks.map((t) => ({
            id: t.id,
            name: t.title,
            title: t.title,
            content: t.content,
            status: t.status,
            priority: t.priority,
            due_date: t.dueDate,
            list_id: t.listId,
            completed_pomos: t.completedPomos,
            focus_seconds: t.focusSeconds,
            activities: t.activities,
            updated_at: new Date().toISOString(),
          }));
          const tRes = await client.from('tasks').upsert(richTaskRows);
          if (tRes.error) {
            await client.from('tasks').upsert(
              tasks.map((t) => ({
                id: t.id,
                title: t.title,
                content: t.content,
                status: t.status,
                priority: t.priority,
                due_date: t.dueDate,
                list_id: t.listId,
                updated_at: new Date().toISOString(),
              }))
            );
          }
        }
      } catch {
        // ignore if table doesn't exist
      }

      // Also persist Pomodoro & Stopwatch focus session logs if table exists
      try {
        if (pomodoroSessions.length > 0) {
          await client.from('pomodoro_sessions').upsert(
            pomodoroSessions.map((s) => ({
              id: s.id,
              task_id: s.taskId || null,
              task_title: s.taskTitle,
              mode: s.mode,
              start_time: s.startTime,
              end_time: s.endTime,
              duration_minutes: s.durationMinutes,
              note: s.note,
            }))
          );
        }
      } catch {
        // ignore if table doesn't exist; ticktick_workspace payload stores full pomodoroSessions
      }

      // Also persist lists
      try {
        if (lists.length > 0) {
          await client.from('lists').upsert(
            lists.map((l) => ({
              id: l.id,
              name: l.name,
              color: l.color,
              emoji: l.emoji || '',
            }))
          );
        }
      } catch {
        // ignore if table doesn't exist
      }

      const syncedTime = format(new Date(), 'HH:mm:ss');
      setSupabaseLastSyncedAt(syncedTime);
      setSupabaseStatus('connected');
      pushToast({
        title: 'Pushed to Supabase Cloud',
        description: `Name "${preferences.fullName}", ${tasks.length} tasks & ${lists.length} lists synced`,
        kind: 'success',
      });

      return {
        ok: true,
        message: `Pushed display name "${preferences.fullName}", ${tasks.length} tasks, ${lists.length} lists & ${habits.length} habits to Supabase Cloud at ${syncedTime}${dbPersisted ? ' (PostgreSQL + Realtime)' : ' (Live Realtime Sync active)'}.`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setSupabaseStatus('error');
      setSupabaseErrorMessage(msg);
      return { ok: false, message: msg };
    }
  };

  const value = useMemo<AppContextValue>(
    () => ({
      activeModule,
      setActiveModule,
      sidebarSelection,
      setSidebarSelection,
      selectedTaskId,
      setSelectedTaskId,
      isSidebarCollapsed,
      setIsSidebarCollapsed,
      isCommandOpen,
      setIsCommandOpen,
      isSettingsOpen,
      setIsSettingsOpen,
      isInstallModalOpen,
      setIsInstallModalOpen,
      isDatabasePromptOpen,
      setIsDatabasePromptOpen,
      settingsInitialTab,
      openSettingsTab,
      toasts,
      pushToast,
      dismissToast,
      tasks,
      lists,
      folders,
      sections,
      tags,
      customFilters,
      habits,
      pomodoroSessions,
      countdowns,
      templates,
      calendarSubscriptions,
      preferences,
      addTask,
      updateTask,
      toggleTaskStatus,
      deleteTask,
      restoreTask,
      duplicateTask,
      addSubtask,
      toggleSubtask,
      deleteSubtask,
      addTaskComment,
      addTaskAttachment,
      saveTaskAsTemplate,
      applyTemplate,
      addList,
      updateList,
      duplicateList,
      deleteList,
      addFolder,
      updateFolder,
      deleteFolder,
      toggleFolderCollapse,
      addSection,
      addTag,
      updateTag,
      deleteTag,
      addCustomFilter,
      deleteCustomFilter,
      addHabit,
      updateHabit,
      toggleHabitDate,
      deleteHabitLog,
      clearHabitLogs,
      deleteHabit,
      pomoMode,
      setPomoMode,
      pomoPhase,
      setPomoPhase,
      pomoRunning,
      pomoTimerRunning,
      stopwatchRunning,
      setPomoRunning,
      pomoSecondsLeft,
      stopwatchSeconds,
      activePomoTaskId,
      setActivePomoTaskId,
      activeWhiteNoise,
      setActiveWhiteNoise,
      whiteNoiseVolume,
      setWhiteNoiseVolume,
      resetPomoTimer,
      completeCurrentPomoSession,
      startTaskFocus,
      logManualFocusSession,
      deletePomodoroSession,
      clearPomodoroSessions,
      addCountdown,
      deleteCountdown,
      addCalendarSubscription,
      toggleCalendarSubscription,
      rightPaneWidth,
      setRightPaneWidth,
      updatePreferences,
      setTheme,
      resetDemoWorkspace,
      clearAllWorkspaceData,
      activeReminder,
      dismissActiveReminder,
      snoozeActiveReminder,
      triggerTaskReminderNow,
      requestNotificationPermission,
      notificationPermission,
      supabaseStatus,
      supabaseUserEmail,
      supabaseLastSyncedAt,
      supabaseErrorMessage,
      connectSupabase,
      disconnectSupabase,
      syncWorkspaceToSupabase,
      pullWorkspaceFromSupabase,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeModule,
      sidebarSelection,
      selectedTaskId,
      isSidebarCollapsed,
      isCommandOpen,
      isSettingsOpen,
      isInstallModalOpen,
      isDatabasePromptOpen,
      settingsInitialTab,
      toasts,
      pushToast,
      dismissToast,
      tasks,
      lists,
      folders,
      sections,
      tags,
      customFilters,
      habits,
      pomodoroSessions,
      countdowns,
      templates,
      calendarSubscriptions,
      preferences,
      pomoMode,
      pomoPhase,
      pomoRunning,
      pomoTimerRunning,
      stopwatchRunning,
      pomoSecondsLeft,
      stopwatchSeconds,
      activePomoTaskId,
      activeWhiteNoise,
      whiteNoiseVolume,
      rightPaneWidth,
      setRightPaneWidth,
      activeReminder,
      notificationPermission,
      supabaseStatus,
      supabaseUserEmail,
      supabaseLastSyncedAt,
      supabaseErrorMessage,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
