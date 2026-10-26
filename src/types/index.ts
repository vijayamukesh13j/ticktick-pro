export type Priority = 0 | 1 | 3 | 5; // 0: None, 1: Low (Blue), 3: Medium (Amber), 5: High (Red)

export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'wont_do' | 'trash';

export type ViewMode = 'list' | 'kanban' | 'timeline';

export type PrimaryModule =
  | 'tasks'
  | 'calendar'
  | 'pomodoro'
  | 'habits'
  | 'matrix'
  | 'countdown'
  | 'statistics'
  | 'templates';

export type SmartListId =
  | 'all'
  | 'today'
  | 'overdue'
  | 'tomorrow'
  | 'next7days'
  | 'inbox'
  | 'assigned'
  | 'completed'
  | 'wont_do'
  | 'trash'
  | 'summary';

export type ThemeId =
  | 'classic-blue'
  | 'dark-obsidian'
  | 'forest-emerald'
  | 'sunset-amber'
  | 'sakura-rose'
  | 'nordic-slate';

export interface ActiveReminderAlert {
  task: Task;
  reminderLabel: string;
  triggeredAt: string;
  isConstant?: boolean;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  priority?: Priority;
  reminderAt?: string; // Premium: Checklist item reminder
}

export interface TaskAttachment {
  id: string;
  name: string;
  size: string;
  type: 'image' | 'pdf' | 'doc' | 'audio' | 'link';
  url: string;
  uploadedAt: string;
}

export interface TaskComment {
  id: string;
  author: string;
  avatarColor: string;
  text: string;
  createdAt: string;
}

export interface TaskActivity {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
}

export interface Task {
  id: string;
  title: string;
  content: string; // Markdown notes/description
  isNote: boolean; // Premium/Core: Convert Task to Note
  listId: string; // 'inbox' or custom list ID
  sectionId?: string;
  status: TaskStatus;
  priority: Priority;
  tags: string[];
  startDate?: string; // ISO date or datetime (for Duration / Timeline / Time-blocking)
  dueDate?: string; // ISO date or datetime
  startTime?: string; // 'HH:mm'
  endTime?: string; // 'HH:mm'
  isAllDay: boolean;
  durationMinutes?: number; // Premium: Task duration
  recurrenceRule?: string; // 'daily' | 'weekly' | 'weekdays' | 'monthly' | 'yearly' | 'custom'
  reminders: string[]; // Up to 5 reminder offsets e.g. ['On time', '5m before', '1h before']
  constantReminder: boolean; // Premium: Constant Reminder (keeps ringing)
  emailReminder: boolean; // Premium: Email Reminder
  locationReminder?: string; // Premium: Location trigger
  timezone?: string;
  assignee?: string;
  estimatedPomos: number;
  completedPomos: number;
  focusSeconds: number;
  subtasks: Subtask[];
  attachments: TaskAttachment[];
  comments: TaskComment[];
  activities: TaskActivity[]; // Premium: Revision & Activity history
  eisenhowerQuadrant?: 'q1' | 'q2' | 'q3' | 'q4';
  isPinned: boolean;
  sortOrder: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  isCollapsed: boolean;
  sortOrder: number;
}

export interface TaskSection {
  id: string;
  listId: string;
  name: string;
  sortOrder: number;
}

export interface TaskList {
  id: string;
  folderId?: string;
  name: string;
  color: string;
  icon: string;
  emoji?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  listType?: 'task' | 'note';
  showInSmartList?: 'all' | 'hidden';
  backgroundStyle: 'none' | 'gradient-ocean' | 'gradient-sunset' | 'gradient-forest' | 'dots' | 'grid';
  viewMode: ViewMode;
  isShared: boolean;
  members: { name: string; email: string; avatarColor: string; role: 'owner' | 'editor' }[];
  sortOrder: number;
}

export interface TagItem {
  id: string;
  name: string;
  color: string;
  parentTag?: string;
}

export interface CustomFilter {
  id: string;
  name: string;
  color: string;
  criteria: {
    priorities: Priority[];
    tags: string[];
    listIds: string[];
    dateRange: 'any' | 'today' | 'overdue' | 'next7days' | 'nodate';
    status: 'todo' | 'completed' | 'all';
    keyword?: string;
  };
}

export interface HabitLogEntry {
  value: number;
  completed: boolean;
  note?: string;
  mood?: 'great' | 'good' | 'neutral' | 'tired' | 'stressed';
  timestamp: string;
}

export interface Habit {
  id: string;
  name: string;
  quote: string;
  icon: string;
  color: string;
  section: 'morning' | 'afternoon' | 'evening' | 'anytime';
  frequencyType: 'daily' | 'weekly_days' | 'weekly_count';
  frequencyDays: number[]; // 0-6 (Sun-Sat)
  frequencyCount: number; // e.g., 5 days/week
  goalType: 'check' | 'quantified';
  targetValue: number; // e.g., 1 for check, 2000 for ml water, 30 for mins reading
  unit: string; // 'times', 'ml', 'mins', 'pages'
  reminderTime?: string;
  autoPopLog: boolean;
  logs: Record<string, HabitLogEntry>; // key: 'YYYY-MM-DD'
  createdAt: string;
}

export interface PomodoroSession {
  id: string;
  taskId?: string;
  taskTitle: string;
  mode: 'pomo' | 'stopwatch';
  startTime: string;
  endTime: string;
  durationMinutes: number;
  note: string;
  whiteNoiseUsed?: string;
}

export interface CountdownItem {
  id: string;
  title: string;
  targetDate: string; // 'YYYY-MM-DD'
  category: 'milestone' | 'birthday' | 'anniversary' | 'holiday' | 'exam' | 'work';
  color: string;
  icon: string;
  repeatCycle: 'none' | 'yearly' | 'monthly';
  isPinned: boolean;
}

export interface TaskTemplate {
  id: string;
  name: string;
  category: string;
  title: string;
  content: string;
  priority: Priority;
  tags: string[];
  subtasks: { title: string }[];
  durationMinutes?: number;
}

export interface CalendarSubscription {
  id: string;
  name: string;
  url: string;
  color: string;
  provider: 'google' | 'outlook' | 'apple' | 'ics';
  enabled: boolean;
  events: {
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location?: string;
  }[];
}

export interface UserPreferences {
  fullName: string;
  email: string;
  isPremium: boolean;
  theme: ThemeId;
  achievementScore: number;
  pomoDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  autoStartBreaks: boolean;
  autoStartPomos: boolean;
  dailyPomoGoal: number;
  dailyFocusMinutesGoal: number;
  timezone: string;
  soundAlertEnabled: boolean;
}
