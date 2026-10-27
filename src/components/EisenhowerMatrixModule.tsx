import React, { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  format,
  isAfter,
  isBefore,
  isToday,
  isTomorrow,
  parseISO,
  startOfToday,
} from 'date-fns';
import {
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit2,
  FileText,
  Flag,
  Folder,
  Grid2X2,
  HelpCircle,
  Inbox,
  Layers,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pin,
  Plus,
  RotateCcw,
  Sliders,
  Sparkles,
  Tag,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Priority, Task, TaskAttachment } from '../types';

export type GroupOption = 'time' | 'list' | 'priority' | 'tag' | 'none';
export type SortOption = 'time' | 'title' | 'priority' | 'list';
export type OrderOption = 'asc' | 'desc';

interface QuadrantConfig {
  id: 'q1' | 'q2' | 'q3' | 'q4';
  roman: string;
  circleNumber: string;
  title: string;
  subtitle: string;
  badgeBg: string;
  titleColor: string;
  borderColor: string;
  accentColor: string;
  defaultPriority: Priority;
  defaultDue?: string;
}

const DEFAULT_QUADRANTS: QuadrantConfig[] = [
  {
    id: 'q1',
    roman: 'I',
    circleNumber: '❶',
    title: 'Urgent & Important',
    subtitle: 'Do First: Crisis, pressing deadlines, and urgent bugs',
    badgeBg: 'bg-rose-500 text-white',
    titleColor: 'text-rose-600',
    borderColor: 'border-rose-200',
    accentColor: '#f43f5e',
    defaultPriority: 5,
  },
  {
    id: 'q2',
    roman: 'II',
    circleNumber: '❷',
    title: 'Not Urgent & Important',
    subtitle: 'Schedule: Deep work, strategic planning, and personal growth',
    badgeBg: 'bg-amber-500 text-white',
    titleColor: 'text-amber-600',
    borderColor: 'border-amber-200',
    accentColor: '#f59e0b',
    defaultPriority: 3,
  },
  {
    id: 'q3',
    roman: 'III',
    circleNumber: '❸',
    title: 'Urgent & Unimportant',
    subtitle: 'Delegate: Interruptions, urgent favors, and routine chores',
    badgeBg: 'bg-blue-500 text-white',
    titleColor: 'text-blue-600',
    borderColor: 'border-blue-200',
    accentColor: '#3b82f6',
    defaultPriority: 1,
  },
  {
    id: 'q4',
    roman: 'IV',
    circleNumber: '❹',
    title: 'Not Urgent & Unimportant',
    subtitle: "Don't Do: Distractions, busywork, and time wasters",
    badgeBg: 'bg-emerald-500 text-white',
    titleColor: 'text-emerald-600',
    borderColor: 'border-emerald-200',
    accentColor: '#10b981',
    defaultPriority: 0,
  },
];

export const EisenhowerMatrixModule: React.FC = () => {
  const {
    tasks,
    lists,
    templates,
    tags: appTags,
    selectedTaskId,
    setSelectedTaskId,
    addTask,
    updateTask,
    toggleTaskStatus,
    deleteTask,
    duplicateTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    addTaskComment,
    pushToast,
  } = useApp();

  const todayStr = format(startOfToday(), 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(startOfToday(), 1), 'yyyy-MM-dd');
  const in7DaysStr = format(addDays(startOfToday(), 7), 'yyyy-MM-dd');

  // Load custom quadrant titles/descriptions from localStorage
  const [quadrantConfigs, setQuadrantConfigs] = useState<QuadrantConfig[]>(() => {
    try {
      const stored = localStorage.getItem('ticktick_eisenhower_quadrants_config');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return DEFAULT_QUADRANTS;
  });

  // Global settings
  const [hideCompleted, setHideCompleted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ticktick_eisenhower_hide_completed') === 'true';
    } catch {
      return false;
    }
  });

  const [quadrantSettings, setQuadrantSettings] = useState<
    Record<'q1' | 'q2' | 'q3' | 'q4', {
      groupBy: GroupOption;
      sortBy: SortOption;
      order: OrderOption;
    }>
  >(() => {
    try {
      const stored = localStorage.getItem('ticktick_eisenhower_quadrant_settings');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return {
      q1: { groupBy: 'time', sortBy: 'time', order: 'asc' },
      q2: { groupBy: 'time', sortBy: 'time', order: 'asc' },
      q3: { groupBy: 'time', sortBy: 'time', order: 'asc' },
      q4: { groupBy: 'time', sortBy: 'time', order: 'asc' },
    };
  });

  // Collapsed status for individual groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Mobile segmented focus filter
  const [mobileQuadrantFilter, setMobileQuadrantFilter] = useState<
    'all' | 'q1' | 'q2' | 'q3' | 'q4'
  >('all');
  const [collapsedQuadrants, setCollapsedQuadrants] = useState<Record<string, boolean>>({});

  // Modals & Menu Popovers
  const [showTopMoreMenu, setShowTopMoreMenu] = useState(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [isManageViewOpen, setIsManageViewOpen] = useState(false);
  const [editingQuadrant, setEditingQuadrant] = useState<QuadrantConfig | null>(null);
  const [activeQuadrantMenuQId, setActiveQuadrantMenuQId] = useState<
    'q1' | 'q2' | 'q3' | 'q4' | null
  >(null);

  // Mobile Action Sheet for Moving a Task to another Quadrant
  const [movingTask, setMovingTask] = useState<Task | null>(null);

  // In-Quadrant Quick-Add Card State (Screenshots 1 & 2)
  const [activeQuickAddQId, setActiveQuickAddQId] = useState<
    'q1' | 'q2' | 'q3' | 'q4' | null
  >(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [quickAddContent, setQuickAddContent] = useState('');
  const [quickAddDueDate, setQuickAddDueDate] = useState<string | undefined>(undefined);
  const [quickAddPriority, setQuickAddPriority] = useState<Priority>(0);
  const [quickAddListId, setQuickAddListId] = useState<string>('inbox');
  const [quickAddTags, setQuickAddTags] = useState<string[]>([]);
  const [quickAddIsNote, setQuickAddIsNote] = useState<boolean>(false);
  const [quickAddAttachments, setQuickAddAttachments] = useState<TaskAttachment[]>([]);
  const [showQuickAddMoreMenu, setShowQuickAddMoreMenu] = useState(false);
  const [showQuickAddDatePopover, setShowQuickAddDatePopover] = useState(false);
  const [showQuickAddListPopover, setShowQuickAddListPopover] = useState(false);
  const [showQuickAddTagPicker, setShowQuickAddTagPicker] = useState(false);
  const [showQuickAddTemplatePicker, setShowQuickAddTemplatePicker] = useState(false);

  // Fast inline quick-add inputs
  const [inlineQuickInputs, setInlineQuickInputs] = useState<
    Record<'q1' | 'q2' | 'q3' | 'q4', string>
  >({
    q1: '',
    q2: '',
    q3: '',
    q4: '',
  });

  // Task Detail Popover state
  const [matrixPopoverTaskId, setMatrixPopoverTaskId] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showPopoverSubtaskCompleted, setShowPopoverSubtaskCompleted] = useState(true);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [showPopoverMoreMenu, setShowPopoverMoreMenu] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ticktick_eisenhower_hide_completed', String(hideCompleted));
    } catch {
      // ignore
    }
  }, [hideCompleted]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'ticktick_eisenhower_quadrant_settings',
        JSON.stringify(quadrantSettings)
      );
    } catch {
      // ignore
    }
  }, [quadrantSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'ticktick_eisenhower_quadrants_config',
        JSON.stringify(quadrantConfigs)
      );
    } catch {
      // ignore
    }
  }, [quadrantConfigs]);

  // Click outside listener for desktop popovers
  useEffect(() => {
    const handleWindowClick = () => {
      setShowTopMoreMenu(false);
      setActiveQuadrantMenuQId(null);
      setShowQuickAddMoreMenu(false);
      setShowQuickAddDatePopover(false);
      setShowQuickAddListPopover(false);
      setShowQuickAddTagPicker(false);
      setShowQuickAddTemplatePicker(false);
    };
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  const resolveTaskQuadrant = (task: Task): 'q1' | 'q2' | 'q3' | 'q4' => {
    if (task.eisenhowerQuadrant) return task.eisenhowerQuadrant;
    const isUrgent = Boolean(task.dueDate && task.dueDate <= todayStr);
    const isImportant = task.priority === 5 || task.priority === 3;
    if (isUrgent && isImportant) return 'q1';
    if (!isUrgent && isImportant) return 'q2';
    if (isUrgent && !isImportant) return 'q3';
    return 'q4';
  };

  const matrixTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== 'trash' && t.status !== 'wont_do');
  }, [tasks]);

  const selectedTask = tasks.find((t) => t.id === matrixPopoverTaskId) || null;

  // Open Quick-Add Card for a quadrant
  const handleOpenQuickAddCard = (qId: 'q1' | 'q2' | 'q3' | 'q4') => {
    const qCfg = quadrantConfigs.find((q) => q.id === qId);
    setActiveQuickAddQId(qId);
    setQuickAddTitle('');
    setQuickAddContent('');
    setQuickAddPriority(qCfg ? qCfg.defaultPriority : 0);
    setQuickAddDueDate(qId === 'q1' || qId === 'q3' ? todayStr : undefined);
    setQuickAddListId('inbox');
    setQuickAddTags([]);
    setQuickAddIsNote(false);
    setQuickAddAttachments([]);
    setShowQuickAddMoreMenu(false);
  };

  // Submit Quick-Add
  const handleSubmitQuickAddCard = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeQuickAddQId || !quickAddTitle.trim()) return;

    addTask({
      title: quickAddTitle.trim(),
      content: quickAddContent.trim(),
      priority: quickAddPriority,
      dueDate: quickAddDueDate,
      startDate: quickAddDueDate,
      listId: quickAddListId,
      tags: quickAddTags,
      isNote: quickAddIsNote,
      attachments: quickAddAttachments,
      eisenhowerQuadrant: activeQuickAddQId,
    });

    pushToast({
      title: quickAddIsNote ? 'Note Created' : 'Task Added to Matrix',
      description: `Added to ${quadrantConfigs.find((q) => q.id === activeQuickAddQId)?.title}`,
      kind: 'success',
    });

    setActiveQuickAddQId(null);
    setQuickAddTitle('');
    setQuickAddContent('');
  };

  // Grouping helper for tasks inside a quadrant
  const groupQuadrantTasks = (
    quadrantTasks: Task[],
    qId: 'q1' | 'q2' | 'q3' | 'q4'
  ) => {
    const setting = quadrantSettings[qId] || { groupBy: 'time', sortBy: 'time', order: 'asc' };

    const visibleTasks = hideCompleted
      ? quadrantTasks.filter((t) => t.status !== 'completed')
      : quadrantTasks;

    if (setting.groupBy === 'none') {
      return [{ groupKey: 'all', title: '', tasks: visibleTasks }];
    }

    if (setting.groupBy === 'time') {
      const groups: { groupKey: string; title: string; tasks: Task[] }[] = [
        { groupKey: 'no_date', title: 'No Date', tasks: [] },
        { groupKey: 'overdue', title: 'Overdue', tasks: [] },
        { groupKey: 'today', title: 'Today', tasks: [] },
        { groupKey: 'tomorrow', title: 'Tomorrow', tasks: [] },
        { groupKey: 'week', title: 'Next 7 Days', tasks: [] },
        { groupKey: 'later', title: 'Later', tasks: [] },
      ];

      visibleTasks.forEach((t) => {
        if (!t.dueDate) {
          groups[0].tasks.push(t);
        } else if (isBefore(parseISO(t.dueDate), startOfToday())) {
          groups[1].tasks.push(t);
        } else if (isToday(parseISO(t.dueDate))) {
          groups[2].tasks.push(t);
        } else if (isTomorrow(parseISO(t.dueDate))) {
          groups[3].tasks.push(t);
        } else if (
          isAfter(parseISO(t.dueDate), addDays(startOfToday(), 1)) &&
          isBefore(parseISO(t.dueDate), addDays(startOfToday(), 8))
        ) {
          groups[4].tasks.push(t);
        } else {
          groups[5].tasks.push(t);
        }
      });

      return groups.filter((g) => g.tasks.length > 0);
    }

    if (setting.groupBy === 'list') {
      const map = new Map<string, Task[]>();
      visibleTasks.forEach((t) => {
        const key = t.listId || 'inbox';
        const arr = map.get(key) || [];
        arr.push(t);
        map.set(key, arr);
      });

      return Array.from(map.entries()).map(([listId, listTasks]) => {
        const foundList = lists.find((l) => l.id === listId);
        return {
          groupKey: `list-${listId}`,
          title: foundList ? `${foundList.emoji ? `${foundList.emoji} ` : ''}${foundList.name}` : 'Inbox',
          tasks: listTasks,
        };
      });
    }

    if (setting.groupBy === 'priority') {
      const groups = [
        { groupKey: 'p5', title: 'High Priority (Urgent)', tasks: [] as Task[] },
        { groupKey: 'p3', title: 'Medium Priority', tasks: [] as Task[] },
        { groupKey: 'p1', title: 'Low Priority', tasks: [] as Task[] },
        { groupKey: 'p0', title: 'No Priority', tasks: [] as Task[] },
      ];
      visibleTasks.forEach((t) => {
        if (t.priority === 5) groups[0].tasks.push(t);
        else if (t.priority === 3) groups[1].tasks.push(t);
        else if (t.priority === 1) groups[2].tasks.push(t);
        else groups[3].tasks.push(t);
      });
      return groups.filter((g) => g.tasks.length > 0);
    }

    return [{ groupKey: 'all', title: '', tasks: visibleTasks }];
  };

  const renderTaskPrefixIcon = (task: Task) => {
    const emojiMatch = task.title.match(/^(\p{Extended_Pictographic})/u);
    if (emojiMatch) {
      return <span className="text-sm select-none">{emojiMatch[0]}</span>;
    }
    if (task.isNote) {
      return <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    }
    return null;
  };

  const cleanTaskTitle = (title: string) => {
    return title.replace(/^(\p{Extended_Pictographic})\s*/u, '');
  };

  const renderQuadrantTaskRow = (task: Task, qId: 'q1' | 'q2' | 'q3' | 'q4') => {
    const isDone = task.status === 'completed';
    const isSelected = matrixPopoverTaskId === task.id || selectedTaskId === task.id;
    const taskList = lists.find((l) => l.id === task.listId);
    const prefixIcon = renderTaskPrefixIcon(task);
    const displayTitle = prefixIcon ? cleanTaskTitle(task.title) : task.title;

    return (
      <div
        key={task.id}
        onClick={() => {
          setSelectedTaskId(task.id);
          setMatrixPopoverTaskId(task.id);
          setShowPopoverMoreMenu(false);
        }}
        className={`group flex items-center justify-between gap-2.5 px-3 py-2 sm:py-1.5 rounded-xl text-xs cursor-pointer transition-all ${
          isSelected
            ? 'bg-blue-50/90 text-zinc-900 shadow-2xs'
            : 'hover:bg-zinc-100/90 text-zinc-800'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Square Checkbox (Touch friendly 44px hit-box on mobile) */}
          <button
            type="button"
            aria-label={`Mark "${task.title}" as ${isDone ? 'incomplete' : 'completed'}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleTaskStatus(task.id);
            }}
            className={`w-4 h-4 rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
              isDone
                ? 'bg-zinc-400 border-zinc-400 text-white'
                : task.priority === 5
                  ? 'border-rose-500 hover:bg-rose-50'
                  : task.priority === 3
                    ? 'border-amber-500 hover:bg-amber-50'
                    : task.priority === 1
                      ? 'border-blue-500 hover:bg-blue-50'
                      : 'border-zinc-300 hover:border-zinc-500'
            }`}
          >
            {isDone && <Check className="w-2.5 h-2.5 stroke-[2.75] animate-check" />}
          </button>

          {/* Optional Prefix Emoji/Icon */}
          {prefixIcon && <div className="shrink-0">{prefixIcon}</div>}

          {/* Task Title */}
          <span
            className={`truncate font-medium text-xs sm:text-[12px] leading-tight ${
              isDone ? 'text-zinc-400 line-through' : 'text-zinc-800'
            }`}
          >
            {displayTitle}
          </span>
        </div>

        {/* Right side items */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Subtask count */}
          {task.subtasks && task.subtasks.length > 0 && (
            <span className="text-[10px] text-zinc-400 font-mono-num hidden xs:inline">
              {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
            </span>
          )}

          {/* Due date if active */}
          {task.dueDate && !isDone && (
            <span
              className={`text-[10px] font-mono-num ${
                task.dueDate === todayStr ? 'text-blue-600 font-medium' : 'text-zinc-400'
              }`}
            >
              {task.dueDate === todayStr
                ? 'Today'
                : format(parseISO(task.dueDate), 'MMM d')}
            </span>
          )}

          {/* List badge */}
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 max-w-[70px] sm:max-w-[90px] truncate">
            {taskList ? (
              <>
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: taskList.color || '#94a3b8' }}
                />
                <span className="truncate">{taskList.name}</span>
              </>
            ) : (
              <>
                <Inbox className="w-3 h-3 text-zinc-400 shrink-0" />
                <span className="truncate">Inbox</span>
              </>
            )}
          </span>

          {/* Mobile Quick-Move Pill (opens Mobile Move Sheet on tap) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMovingTask(task);
            }}
            className="md:hidden px-1.5 py-0.5 rounded text-[10px] font-mono-num bg-zinc-100 text-zinc-600 border border-zinc-200 active:bg-zinc-200"
            title="Move to another quadrant"
          >
            {qId.toUpperCase()}
          </button>

          {/* Desktop Hover Quick Mover Dropdown */}
          <select
            aria-label="Move to quadrant"
            value={qId}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) =>
              updateTask(task.id, {
                eisenhowerQuadrant: e.target.value as 'q1' | 'q2' | 'q3' | 'q4',
              })
            }
            className="hidden md:inline-block opacity-0 group-hover:opacity-100 text-[10px] font-mono-num bg-zinc-100 hover:bg-zinc-200 px-1 py-0.5 rounded border border-zinc-200 text-zinc-600 cursor-pointer transition-opacity"
          >
            <option value="q1">Q1</option>
            <option value="q2">Q2</option>
            <option value="q3">Q3</option>
            <option value="q4">Q4</option>
          </select>
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex-1 flex h-full min-w-0 bg-zinc-50/70 overflow-hidden text-zinc-900">
      <div className="flex-1 flex flex-col h-full min-w-0 p-3 sm:p-5 overflow-y-auto pb-24 md:pb-5">
        {/* Main Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-zinc-900 flex items-center gap-2 tracking-tight">
              <Grid2X2 className="w-4 h-4 text-zinc-800" strokeWidth={2} />
              Eisenhower Matrix
            </h1>
            <span className="text-xs font-mono-num text-zinc-400">
              {matrixTasks.filter((t) => t.status !== 'completed').length} active
            </span>
          </div>

          {/* Top-Right Page More Menu (...) */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowTopMoreMenu(!showTopMoreMenu);
              }}
              title="Matrix options"
              aria-label="Eisenhower Matrix options"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/70 transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" strokeWidth={2} />
            </button>

            {/* Responsive Top More Menu: Overlay Bottom Sheet on Mobile, Dropdown on Desktop */}
            {showTopMoreMenu && (
              <>
                <div
                  className="fixed inset-0 z-30 bg-black/40 md:hidden"
                  onClick={() => setShowTopMoreMenu(false)}
                />
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="fixed inset-x-0 bottom-14 md:inset-auto md:right-0 md:top-8 z-40 md:w-48 rounded-t-2xl md:rounded-xl bg-white shadow-2xl md:shadow-xl border md:border border-zinc-200 p-4 md:py-1.5 md:px-0 text-xs text-zinc-700 animate-in fade-in slide-in-from-bottom md:slide-in-from-top-2 duration-150"
                >
                  <div className="w-10 h-1 bg-zinc-300 rounded-full mx-auto mb-3 md:hidden" />
                  <div className="md:hidden text-xs font-bold text-zinc-900 mb-2 px-1">
                    Eisenhower Matrix Options
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsManageViewOpen(true);
                      setShowTopMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 md:py-2 hover:bg-zinc-100 rounded-lg md:rounded-none text-left"
                  >
                    <Layers className="w-4 md:w-3.5 h-4 md:h-3.5 text-zinc-500" />
                    <span>Manage View</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setHideCompleted((prev) => !prev);
                      setShowTopMoreMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 md:py-2 hover:bg-zinc-100 rounded-lg md:rounded-none text-left"
                  >
                    <span className="flex items-center gap-2.5">
                      <CheckSquare className="w-4 md:w-3.5 h-4 md:h-3.5 text-zinc-500" />
                      <span>Hide Completed</span>
                    </span>
                    {hideCompleted && <Check className="w-4 md:w-3.5 h-4 md:h-3.5 text-blue-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserGuideOpen(true);
                      setShowTopMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 md:py-2 hover:bg-zinc-100 rounded-lg md:rounded-none text-left border-t border-zinc-100"
                  >
                    <HelpCircle className="w-4 md:w-3.5 h-4 md:h-3.5 text-zinc-500" />
                    <span>User Guide</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile Segmented Quadrant Tabs (Taste Skill: single-row chip rail, keeps first task in top 35% of phone screen) */}
        <div className="md:hidden mb-3 -mx-1 px-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 py-0.5">
          <button
            type="button"
            onClick={() => setMobileQuadrantFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 ${
              mobileQuadrantFilter === 'all'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-white text-zinc-600 border border-zinc-200/90 hover:bg-zinc-50'
            }`}
          >
            <span>All Quadrants</span>
            <span
              className={`font-mono-num text-[11px] px-1.5 py-0.2 rounded-full ${
                mobileQuadrantFilter === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-zinc-100 text-zinc-500'
              }`}
            >
              {matrixTasks.filter((t) => t.status !== 'completed').length}
            </span>
          </button>

          {quadrantConfigs.map((q) => {
            const count = matrixTasks.filter(
              (t) => resolveTaskQuadrant(t) === q.id && t.status !== 'completed'
            ).length;
            const isSelected = mobileQuadrantFilter === q.id;
            const shortName =
              q.id === 'q1'
                ? 'Do First'
                : q.id === 'q2'
                  ? 'Schedule'
                  : q.id === 'q3'
                    ? 'Delegate'
                    : "Don't Do";

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setMobileQuadrantFilter(q.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? `${q.borderColor} bg-white ring-2 ring-zinc-900/15 shadow-xs text-zinc-900 font-semibold`
                    : 'bg-white text-zinc-600 border border-zinc-200/90 hover:bg-zinc-50'
                }`}
              >
                <span className={`text-xs font-bold ${q.titleColor}`}>{q.circleNumber}</span>
                <span>{shortName}</span>
                <span
                  className={`font-mono-num text-[11px] px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? 'bg-zinc-100 text-zinc-800 font-semibold'
                      : 'bg-zinc-100 text-zinc-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 2x2 Quadrants Grid (Desktop: 2x2, Mobile: Natural-height Feed or Focused Single Quadrant) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 md:flex-1 md:min-h-[560px] pb-8 md:pb-0">
          {quadrantConfigs.map((q) => {
            const qAllTasks = matrixTasks.filter((t) => resolveTaskQuadrant(t) === q.id);
            const qActiveTasks = qAllTasks.filter((t) => t.status !== 'completed');
            const qCompletedTasks = qAllTasks.filter((t) => t.status === 'completed');
            const isHiddenOnMobile =
              mobileQuadrantFilter !== 'all' && mobileQuadrantFilter !== q.id;
            const isCollapsedByHeader = Boolean(collapsedQuadrants[q.id]);
            const groupedSections = groupQuadrantTasks(qAllTasks, q.id);
            const isQuickAddActive = activeQuickAddQId === q.id;
            const isQuadrantMenuOpen = activeQuadrantMenuQId === q.id;

            return (
              <section
                key={q.id}
                className={`${
                  isHiddenOnMobile ? 'hidden md:flex' : 'flex'
                } relative bg-white rounded-2xl md:rounded-xl border border-zinc-200/90 shadow-2xs flex-col overflow-hidden transition-all ${
                  mobileQuadrantFilter !== 'all' ? 'min-h-[380px] flex-1' : 'h-auto'
                } md:h-full`}
              >
                {/* Quadrant Header */}
                <div className="px-3.5 py-2.5 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-zinc-50/60">
                  <div
                    onClick={() => {
                      if (window.innerWidth < 768) {
                        setCollapsedQuadrants((prev) => ({
                          ...prev,
                          [q.id]: !prev[q.id],
                        }));
                      }
                    }}
                    className="flex items-center gap-2 cursor-pointer md:cursor-default select-none min-w-0"
                  >
                    <span className={`text-base font-bold leading-none shrink-0 ${q.titleColor}`}>
                      {q.circleNumber}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h2 className={`text-xs font-bold tracking-tight truncate ${q.titleColor}`}>
                          {q.title}
                        </h2>
                        <span className="text-[10px] text-zinc-400 font-medium hidden xs:inline">
                          · {q.id === 'q1' ? 'Do First' : q.id === 'q2' ? 'Schedule' : q.id === 'q3' ? 'Delegate' : "Don't Do"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions on Quadrant Header: count pill, [+], and [...] */}
                  <div className="flex items-center gap-1 text-zinc-400 shrink-0">
                    <span className="font-mono-num text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full mr-1">
                      {qActiveTasks.length}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenQuickAddCard(q.id)}
                      title={`Add task to ${q.title}`}
                      aria-label={`Add task to ${q.title}`}
                      className="p-1.5 sm:p-1 rounded-lg hover:bg-zinc-200/70 hover:text-zinc-800 transition-colors"
                    >
                      <Plus className="w-4 h-4" strokeWidth={2} />
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveQuadrantMenuQId(isQuadrantMenuOpen ? null : q.id);
                        }}
                        title={`Options for ${q.title}`}
                        aria-label={`Options for ${q.title}`}
                        className="p-1.5 sm:p-1 rounded-lg hover:bg-zinc-200/70 hover:text-zinc-800 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" strokeWidth={2} />
                      </button>

                      {/* Responsive Quadrant Header Dropdown: Bottom Sheet on Mobile, Popover on Desktop */}
                      {isQuadrantMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-30 bg-black/40 md:hidden"
                            onClick={() => setActiveQuadrantMenuQId(null)}
                          />
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="fixed inset-x-0 bottom-14 md:inset-auto md:right-0 md:top-7 z-40 md:w-48 rounded-t-2xl md:rounded-xl bg-white shadow-2xl md:shadow-xl border md:border border-zinc-200 p-5 md:py-1.5 md:px-0 text-xs text-zinc-700 max-h-[85vh] md:max-h-none overflow-y-auto animate-in fade-in slide-in-from-bottom md:slide-in-from-top-2 duration-150"
                          >
                            <div className="w-10 h-1 bg-zinc-300 rounded-full mx-auto mb-3 md:hidden" />
                            <div className="md:hidden flex items-center justify-between mb-3 px-1">
                              <span className="text-sm font-semibold text-zinc-900">Options for {q.title}</span>
                              <button
                                type="button"
                                onClick={() => setActiveQuadrantMenuQId(null)}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-700 py-1 px-2 rounded-lg bg-blue-50"
                              >
                                Done
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingQuadrant(q);
                                setActiveQuadrantMenuQId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 md:py-1.5 hover:bg-zinc-100 rounded-lg md:rounded-none text-left"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-zinc-500" />
                              <span>Edit</span>
                            </button>

                            {/* Group by submenu */}
                            <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-t border-zinc-100 mt-1">
                              Group by
                            </div>
                            {(['time', 'list', 'priority', 'none'] as GroupOption[]).map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  setQuadrantSettings((prev) => ({
                                    ...prev,
                                    [q.id]: { ...prev[q.id], groupBy: opt },
                                  }));
                                  setActiveQuadrantMenuQId(null);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-1.5 md:py-1 text-xs hover:bg-zinc-100 capitalize ${
                                  quadrantSettings[q.id]?.groupBy === opt
                                    ? 'text-blue-600 font-semibold'
                                    : 'text-zinc-600'
                                }`}
                              >
                                <span>{opt}</span>
                                {quadrantSettings[q.id]?.groupBy === opt && (
                                  <Check className="w-3 h-3 text-blue-600" />
                                )}
                              </button>
                            ))}

                            {/* Sort by submenu */}
                            <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-t border-zinc-100 mt-1">
                              Sort by
                            </div>
                            {(['time', 'title', 'priority', 'list'] as SortOption[]).map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  setQuadrantSettings((prev) => ({
                                    ...prev,
                                    [q.id]: { ...prev[q.id], sortBy: opt },
                                  }));
                                  setActiveQuadrantMenuQId(null);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-1.5 md:py-1 text-xs hover:bg-zinc-100 capitalize ${
                                  quadrantSettings[q.id]?.sortBy === opt
                                    ? 'text-blue-600 font-semibold'
                                    : 'text-zinc-600'
                                }`}
                              >
                                <span>{opt}</span>
                                {quadrantSettings[q.id]?.sortBy === opt && (
                                  <Check className="w-3 h-3 text-blue-600" />
                                )}
                              </button>
                            ))}

                            {/* Order submenu */}
                            <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-t border-zinc-100 mt-1">
                              Order
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setQuadrantSettings((prev) => ({
                                  ...prev,
                                  [q.id]: { ...prev[q.id], order: 'asc' },
                                }));
                                setActiveQuadrantMenuQId(null);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-1.5 md:py-1 text-xs hover:bg-zinc-100 ${
                                quadrantSettings[q.id]?.order === 'asc'
                                  ? 'text-blue-600 font-semibold'
                                  : 'text-zinc-600'
                              }`}
                            >
                              <span>Oldest First</span>
                              {quadrantSettings[q.id]?.order === 'asc' && (
                                <Check className="w-3 h-3 text-blue-600" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setQuadrantSettings((prev) => ({
                                  ...prev,
                                  [q.id]: { ...prev[q.id], order: 'desc' },
                                }));
                                setActiveQuadrantMenuQId(null);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-1.5 md:py-1 text-xs hover:bg-zinc-100 ${
                                quadrantSettings[q.id]?.order === 'desc'
                                  ? 'text-blue-600 font-semibold'
                                  : 'text-zinc-600'
                              }`}
                            >
                              <span>Newest First</span>
                              {quadrantSettings[q.id]?.order === 'desc' && (
                                <Check className="w-3 h-3 text-blue-600" />
                              )}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Single Responsive Quick-Add Card (In-Quadrant on Desktop, Bottom Sheet on Mobile) */}
                {isQuickAddActive && (
                  <>
                    <div
                      className="fixed inset-0 z-40 bg-black/60 md:hidden"
                      onClick={() => setActiveQuickAddQId(null)}
                    />
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="fixed inset-x-0 bottom-14 md:relative md:bottom-auto md:inset-auto z-50 md:z-auto m-0 md:m-3 p-5 md:p-3.5 rounded-t-2xl md:rounded-xl bg-white md:bg-zinc-900 text-zinc-900 md:text-zinc-100 shadow-2xl md:shadow-xl border md:border border-zinc-200 md:border-zinc-800 space-y-3.5 md:space-y-3 pb-5 md:pb-3.5 animate-in fade-in slide-in-from-bottom md:slide-in-from-none duration-200"
                    >
                      {/* Mobile Top Drag Handle */}
                      <div className="w-10 h-1 bg-zinc-300 rounded-full mx-auto -mt-1 md:hidden" />

                      {/* Header row: Due Date | Priority Flag | Close button */}
                      <div className="flex items-center justify-between">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowQuickAddDatePopover(!showQuickAddDatePopover)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 md:py-1 rounded-lg text-xs font-medium text-zinc-700 md:text-zinc-300 hover:text-zinc-900 md:hover:text-white bg-zinc-100 md:bg-zinc-800 hover:bg-zinc-200 md:hover:bg-zinc-700 transition-colors"
                          >
                            <Calendar className="w-3.5 h-3.5 text-blue-600 md:text-zinc-400" />
                            <span>
                              {quickAddDueDate
                                ? quickAddDueDate === todayStr
                                  ? 'Today'
                                  : quickAddDueDate === tomorrowStr
                                    ? 'Tomorrow'
                                    : format(parseISO(quickAddDueDate), 'MMM d')
                                : 'Due Date'}
                            </span>
                          </button>

                          {showQuickAddDatePopover && (
                            <div className="absolute left-0 top-8 z-40 w-44 rounded-xl bg-white md:bg-zinc-800 border border-zinc-200 md:border-zinc-700 shadow-xl p-1.5 text-xs text-zinc-800 md:text-zinc-200">
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickAddDueDate(undefined);
                                  setShowQuickAddDatePopover(false);
                                }}
                                className="w-full text-left px-2 py-1 rounded hover:bg-zinc-100 md:hover:bg-zinc-700"
                              >
                                No Date
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickAddDueDate(todayStr);
                                  setShowQuickAddDatePopover(false);
                                }}
                                className="w-full text-left px-2 py-1 rounded hover:bg-zinc-100 md:hover:bg-zinc-700"
                              >
                                Today
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickAddDueDate(tomorrowStr);
                                  setShowQuickAddDatePopover(false);
                                }}
                                className="w-full text-left px-2 py-1 rounded hover:bg-zinc-100 md:hover:bg-zinc-700"
                              >
                                Tomorrow
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickAddDueDate(in7DaysStr);
                                  setShowQuickAddDatePopover(false);
                                }}
                                className="w-full text-left px-2 py-1 rounded hover:bg-zinc-100 md:hover:bg-zinc-700"
                              >
                                Next Week
                              </button>
                              <div className="pt-1 border-t border-zinc-200 md:border-zinc-700">
                                <input
                                  type="date"
                                  value={quickAddDueDate || todayStr}
                                  onChange={(e) => {
                                    setQuickAddDueDate(e.target.value);
                                    setShowQuickAddDatePopover(false);
                                  }}
                                  className="w-full bg-zinc-50 md:bg-zinc-900 border border-zinc-200 md:border-zinc-700 rounded px-2 py-1 text-[11px] text-zinc-800 md:text-zinc-200"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Priority Flag */}
                        <div className="flex items-center gap-1">
                          {([5, 3, 1, 0] as Priority[]).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setQuickAddPriority(p)}
                              className={`p-1 rounded-md transition-colors ${
                                quickAddPriority === p
                                  ? 'bg-zinc-200 md:bg-zinc-800 ring-1 ring-zinc-400 md:ring-white/20'
                                  : 'opacity-40 hover:opacity-100'
                              }`}
                            >
                              <Flag
                                className={`w-3.5 h-3.5 ${
                                  p === 5
                                    ? 'text-rose-500 fill-rose-500'
                                    : p === 3
                                      ? 'text-amber-500 fill-amber-500'
                                      : p === 1
                                        ? 'text-blue-500 fill-blue-500'
                                        : 'text-zinc-400'
                                }`}
                              />
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setActiveQuickAddQId(null)}
                            className="md:hidden p-1 text-zinc-400 hover:text-zinc-700 ml-1"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Inputs: Title and Commands / Notes */}
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          autoFocus
                          value={quickAddTitle}
                          onChange={(e) => setQuickAddTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSubmitQuickAddCard();
                            }
                            if (e.key === 'Escape') {
                              setActiveQuickAddQId(null);
                            }
                          }}
                          placeholder="What would you like to do?"
                          className="w-full text-base md:text-sm font-semibold bg-transparent text-zinc-900 md:text-white placeholder:text-zinc-400 md:placeholder:text-zinc-500 focus:outline-none"
                        />

                        <textarea
                          rows={2}
                          value={quickAddContent}
                          onChange={(e) => setQuickAddContent(e.target.value)}
                          placeholder="Write something or type / for commands"
                          className="w-full text-xs text-zinc-600 md:text-zinc-300 placeholder:text-zinc-400 md:placeholder:text-zinc-500 bg-transparent focus:outline-none resize-none leading-relaxed"
                        />
                      </div>

                      {/* Tags preview */}
                      {quickAddTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {quickAddTags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 md:bg-zinc-800 text-[11px] text-zinc-700 md:text-zinc-300"
                            >
                              #{tag}
                              <button
                                type="button"
                                onClick={() => setQuickAddTags((prev) => prev.filter((t) => t !== tag))}
                                className="text-zinc-400 hover:text-zinc-700 md:hover:text-zinc-200"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Bottom Bar: List Selector | Action Menu | Submit Buttons */}
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-100 md:border-zinc-800 text-xs">
                        {/* List Selector Pill */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowQuickAddListPopover(!showQuickAddListPopover)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 md:py-1 rounded-lg bg-zinc-100 md:bg-zinc-800 text-zinc-700 md:text-zinc-300 hover:text-zinc-900 md:hover:text-white hover:bg-zinc-200 md:hover:bg-zinc-700 transition-colors"
                          >
                            {quickAddListId === 'inbox' ? (
                              <>
                                <Inbox className="w-3.5 h-3.5 text-zinc-400" />
                                <span>Inbox</span>
                              </>
                            ) : (
                              <>
                                <Folder className="w-3.5 h-3.5 text-zinc-400" />
                                <span>{lists.find((l) => l.id === quickAddListId)?.name || 'Inbox'}</span>
                              </>
                            )}
                          </button>

                          {showQuickAddListPopover && (
                            <div className="absolute left-0 bottom-8 z-40 w-44 rounded-xl bg-white md:bg-zinc-800 border border-zinc-200 md:border-zinc-700 shadow-xl p-1 text-xs text-zinc-800 md:text-zinc-200">
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickAddListId('inbox');
                                  setShowQuickAddListPopover(false);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-zinc-100 md:hover:bg-zinc-700 text-left"
                              >
                                <Inbox className="w-3.5 h-3.5 text-zinc-400" />
                                <span>Inbox</span>
                              </button>
                              {lists.map((l) => (
                                <button
                                  key={l.id}
                                  type="button"
                                  onClick={() => {
                                    setQuickAddListId(l.id);
                                    setShowQuickAddListPopover(false);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-zinc-100 md:hover:bg-zinc-700 text-left"
                                >
                                  {l.emoji ? <span>{l.emoji}</span> : <Folder className="w-3.5 h-3.5 text-zinc-400" />}
                                  <span>{l.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Right Action Menu (...) & Submit Button */}
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowQuickAddMoreMenu(!showQuickAddMoreMenu)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 md:hover:text-white hover:bg-zinc-100 md:hover:bg-zinc-800 transition-colors"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>

                            {/* Quick Add More Menu */}
                            {showQuickAddMoreMenu && (
                              <div className="absolute right-0 bottom-8 z-40 w-48 rounded-xl bg-white md:bg-zinc-800 border border-zinc-200 md:border-zinc-700 shadow-xl py-1 text-xs text-zinc-800 md:text-zinc-200">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowQuickAddTagPicker(true);
                                    setShowQuickAddMoreMenu(false);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-zinc-100 md:hover:bg-zinc-700 text-left"
                                >
                                  <Tag className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>Tags</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const name = prompt('Attachment title / filename:', 'document.pdf');
                                    if (name) {
                                      setQuickAddAttachments((prev) => [
                                        ...prev,
                                        {
                                          id: `att-${Date.now()}`,
                                          name,
                                          url: '#',
                                          size: '128 KB',
                                          type: 'doc',
                                          uploadedAt: new Date().toISOString(),
                                        },
                                      ]);
                                    }
                                    setShowQuickAddMoreMenu(false);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-zinc-100 md:hover:bg-zinc-700 text-left"
                                >
                                  <Paperclip className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>Upload Attachment</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowQuickAddTemplatePicker(true);
                                    setShowQuickAddMoreMenu(false);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-zinc-100 md:hover:bg-zinc-700 text-left"
                                >
                                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>Add from Template</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickAddIsNote(!quickAddIsNote);
                                    setShowQuickAddMoreMenu(false);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-zinc-100 md:hover:bg-zinc-700 text-left"
                                >
                                  <FileText className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>{quickAddIsNote ? 'Convert to Task' : 'Convert to Note'}</span>
                                </button>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setActiveQuickAddQId(null)}
                            className="px-2.5 py-1 text-xs text-zinc-500 md:text-zinc-400 hover:text-zinc-900 md:hover:text-white"
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSubmitQuickAddCard()}
                            disabled={!quickAddTitle.trim()}
                            className="px-3.5 py-1.5 md:py-1 rounded-xl md:rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium text-xs shadow-sm transition-colors"
                          >
                            Add Task
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Quadrant Body & Quick-Add: Hidden when collapsed by mobile header */}
                {!isCollapsedByHeader && (
                  <>
                    <div className="p-2.5 sm:p-3 space-y-2 md:flex-1 md:overflow-y-auto">
                      {qActiveTasks.length === 0 && qCompletedTasks.length === 0 ? (
                        <div className="py-7 px-4 flex flex-col items-center justify-center text-center select-none text-zinc-400">
                          <div className="w-8 h-8 rounded-full bg-zinc-100/90 flex items-center justify-center mb-1.5 text-zinc-400">
                            <Check className="w-4 h-4" strokeWidth={2} />
                          </div>
                          <span className="text-xs font-medium text-zinc-500">No tasks in this quadrant</span>
                        </div>
                      ) : (
                        <>
                          {groupedSections.map((group) => {
                            const isCollapsed = collapsedGroups[`${q.id}-${group.groupKey}`];
                            return (
                              <div key={group.groupKey} className="space-y-0.5">
                                {group.title && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCollapsedGroups((prev) => ({
                                        ...prev,
                                        [`${q.id}-${group.groupKey}`]: !prev[`${q.id}-${group.groupKey}`],
                                      }))
                                    }
                                    className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 select-none text-left"
                                  >
                                    {isCollapsed ? (
                                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                                    )}
                                    <span>{group.title}</span>
                                    <span className="font-mono-num text-[11px] text-zinc-400 font-normal ml-1">
                                      {group.tasks.length}
                                    </span>
                                  </button>
                                )}

                                {!isCollapsed && (
                                  <div className="space-y-0.5">
                                    {group.tasks.map((task) => renderQuadrantTaskRow(task, q.id))}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Completed section */}
                          {!hideCompleted && qCompletedTasks.length > 0 && (
                            <div className="pt-2 border-t border-zinc-100">
                              <button
                                type="button"
                                onClick={() =>
                                  setCollapsedGroups((prev) => ({
                                    ...prev,
                                    [`${q.id}-completed`]: !prev[`${q.id}-completed`],
                                  }))
                                }
                                className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-700 px-2 py-1"
                              >
                                {collapsedGroups[`${q.id}-completed`] ? (
                                  <ChevronRight className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                                <span>Completed</span>
                                <span className="font-mono-num text-[11px]">
                                  {qCompletedTasks.length}
                                </span>
                              </button>

                              {!collapsedGroups[`${q.id}-completed`] && (
                                <div className="space-y-0.5 pt-0.5">
                                  {qCompletedTasks.map((task) => renderQuadrantTaskRow(task, q.id))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Instant Inline Quick-Add Input (Bottom of Quadrant) */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const text = inlineQuickInputs[q.id].trim();
                        if (!text) return;
                        addTask({
                          title: text,
                          priority: q.defaultPriority,
                          dueDate: q.defaultDue,
                          startDate: q.defaultDue,
                          eisenhowerQuadrant: q.id,
                        });
                        setInlineQuickInputs((prev) => ({ ...prev, [q.id]: '' }));
                      }}
                      className="px-3 py-2 sm:py-1.5 border-t border-zinc-100 flex items-center gap-2 bg-zinc-50/60"
                    >
                      <Plus className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <input
                        type="text"
                        value={inlineQuickInputs[q.id]}
                        onChange={(e) =>
                          setInlineQuickInputs((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        placeholder={`Add to ${q.title}...`}
                        className="flex-1 text-xs bg-transparent focus:outline-none text-zinc-800 placeholder:text-zinc-400 py-0.5"
                      />
                    </form>
                  </>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* Mobile Floating Action Button (FAB) to Add Task */}
      <button
        type="button"
        onClick={() => handleOpenQuickAddCard(mobileQuadrantFilter === 'all' ? 'q1' : mobileQuadrantFilter)}
        className="md:hidden fixed bottom-18 right-4 z-20 w-12 h-12 rounded-full bg-zinc-900 text-white shadow-xl flex items-center justify-center hover:bg-zinc-800 active:scale-95 transition-all"
        title="Add Task to Matrix"
        aria-label="Quick add task"
      >
        <Plus className="w-6 h-6" strokeWidth={2.25} />
      </button>

      {/* Mobile Slide-Up Quadrant Mover Sheet */}
      {movingTask && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setMovingTask(null)}
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end p-0 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white rounded-t-3xl shadow-2xl border-t border-zinc-200 p-5 space-y-3 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] text-zinc-900 animate-in slide-in-from-bottom"
          >
            <div className="w-10 h-1 bg-zinc-300 rounded-full mx-auto -mt-1 mb-2" />
            <h3 className="text-sm font-bold text-zinc-900">Move Task to Quadrant</h3>
            <p className="text-xs text-zinc-500 truncate">{movingTask.title}</p>
            <div className="space-y-2 pt-1">
              {quadrantConfigs.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    updateTask(movingTask.id, { eisenhowerQuadrant: q.id });
                    pushToast({
                      title: 'Moved Task',
                      description: `Moved to ${q.title}`,
                      kind: 'success',
                    });
                    setMovingTask(null);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-200 bg-zinc-50/70 hover:bg-zinc-100 text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-sm">{q.circleNumber}</span>
                    <div>
                      <div className="text-xs font-bold text-zinc-800">{q.title}</div>
                      <div className="text-[11px] text-zinc-500">{q.subtitle}</div>
                    </div>
                  </div>
                  {resolveTaskQuadrant(movingTask) === q.id && (
                    <Check className="w-4 h-4 text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Task Detail Popover Card on Click */}
      {selectedTask && (
        <div
          onClick={() => setMatrixPopoverTaskId(null)}
          className="fixed inset-0 z-50 bg-zinc-950/20 backdrop-blur-[1px] flex items-center justify-center p-4 animate-backdrop"
        >
          <div
            role="dialog"
            aria-label="Floating Task Inspector"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] rounded-2xl bg-white border border-zinc-200/90 shadow-2xl flex flex-col max-h-[82vh] overflow-hidden animate-popover"
          >
            {/* Popover Top Header Bar */}
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  aria-label="Toggle task completion"
                  onClick={() => toggleTaskStatus(selectedTask.id)}
                  className={`w-4 h-4 rounded-[4px] border-[1.5px] flex items-center justify-center ${
                    selectedTask.status === 'completed'
                      ? 'bg-zinc-400 border-zinc-400 text-white'
                      : selectedTask.priority === 5
                        ? 'border-rose-500'
                        : selectedTask.priority === 3
                          ? 'border-amber-500'
                          : selectedTask.priority === 1
                            ? 'border-blue-500'
                            : 'border-zinc-300'
                  }`}
                >
                  {selectedTask.status === 'completed' && (
                    <Check className="w-2.5 h-2.5 stroke-[2.75]" />
                  )}
                </button>

                <span className="h-3.5 w-[1px] bg-zinc-200" />

                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 cursor-pointer hover:bg-blue-50 px-2 py-1 rounded-md">
                  <Calendar className="w-3.5 h-3.5 strokeWidth={1.75}" />
                  <input
                    type="date"
                    value={selectedTask.dueDate || todayStr}
                    onChange={(e) =>
                      updateTask(selectedTask.id, { dueDate: e.target.value })
                    }
                    className="bg-transparent text-xs font-medium text-blue-600 focus:outline-none cursor-pointer"
                  />
                </label>
              </div>

              <div className="flex items-center gap-0.5">
                {([5, 3, 1, 0] as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => updateTask(selectedTask.id, { priority: p })}
                    title={`Priority ${p}`}
                    className={`p-1 rounded-md ${
                      selectedTask.priority === p
                        ? 'bg-zinc-100'
                        : 'opacity-40 hover:opacity-100'
                    }`}
                  >
                    <Flag
                      strokeWidth={1.75}
                      className={`w-3.5 h-3.5 ${
                        p === 5
                          ? 'text-rose-500 fill-rose-500'
                          : p === 3
                            ? 'text-amber-500 fill-amber-500'
                            : p === 1
                              ? 'text-blue-500 fill-blue-500'
                              : 'text-zinc-400'
                      }`}
                    />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setMatrixPopoverTaskId(null)}
                  aria-label="Close task popover"
                  className="p-1 rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 ml-1"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>

            {/* Popover Body: Editable Title, Markdown Notes, Smart Card & Subtasks */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              <input
                type="text"
                value={selectedTask.title}
                onChange={(e) => updateTask(selectedTask.id, { title: e.target.value })}
                className={`w-full text-base font-bold focus:outline-none ${
                  selectedTask.status === 'completed' ? 'text-zinc-400' : 'text-zinc-900'
                }`}
              />

              <textarea
                rows={3}
                value={selectedTask.content}
                onChange={(e) => updateTask(selectedTask.id, { content: e.target.value })}
                placeholder="Tap here to add content, or even use markdown..."
                className="w-full text-xs text-zinc-600 leading-relaxed bg-transparent focus:outline-none resize-none"
              />

              {/* Subtasks inside Popover */}
              <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-blue-700">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
                    Checklist & Steps
                  </span>
                  <span className="font-mono-num text-[10px] text-blue-500">
                    {selectedTask.subtasks.filter((s) => s.completed).length}/
                    {selectedTask.subtasks.length}
                  </span>
                </div>

                <div className="space-y-1">
                  {selectedTask.subtasks
                    .filter((s) => !s.completed)
                    .map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-blue-100/80 text-xs"
                      >
                        <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sub.completed}
                            onChange={() => toggleSubtask(selectedTask.id, sub.id)}
                            className="rounded text-blue-600"
                          />
                          <span className="text-zinc-800 truncate">{sub.title}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => deleteSubtask(selectedTask.id, sub.id)}
                          className="text-zinc-300 hover:text-rose-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                  {selectedTask.subtasks.some((s) => s.completed) && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowPopoverSubtaskCompleted((v) => !v)}
                        className="flex items-center gap-1 text-[10px] font-semibold text-blue-600/80 mb-1"
                      >
                        {showPopoverSubtaskCompleted ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                        Completed ({selectedTask.subtasks.filter((s) => s.completed).length})
                      </button>
                      {showPopoverSubtaskCompleted &&
                        selectedTask.subtasks
                          .filter((s) => s.completed)
                          .map((sub) => (
                            <div
                              key={sub.id}
                              className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-white/70 text-xs mb-1"
                            >
                              <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={sub.completed}
                                  onChange={() => toggleSubtask(selectedTask.id, sub.id)}
                                  className="rounded text-zinc-400"
                                />
                                <span className="text-zinc-400 line-through truncate">{sub.title}</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => deleteSubtask(selectedTask.id, sub.id)}
                                className="text-zinc-300 hover:text-rose-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newSubtaskTitle.trim()) {
                        addSubtask(selectedTask.id, newSubtaskTitle);
                        setNewSubtaskTitle('');
                      }
                    }}
                    className="flex items-center gap-1.5 pt-1"
                  >
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="+ Add checklist step..."
                      className="flex-1 px-2.5 py-1 rounded-lg bg-white border border-blue-200/70 text-xs focus:outline-none"
                    />
                  </form>
                </div>
              </div>

              {/* Comments */}
              {showCommentBox && (
                <div className="space-y-2 pt-2 border-t border-zinc-100">
                  {selectedTask.comments.map((c) => (
                    <div key={c.id} className="text-xs bg-zinc-50 p-2 rounded-lg">
                      <span className="font-semibold text-zinc-800">{c.author}: </span>
                      <span className="text-zinc-600">{c.text}</span>
                    </div>
                  ))}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newCommentText.trim()) {
                        addTaskComment(selectedTask.id, newCommentText);
                        setNewCommentText('');
                      }
                    }}
                    className="flex gap-1.5"
                  >
                    <input
                      type="text"
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Write a comment..."
                      className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-zinc-200"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 text-white text-xs font-medium"
                    >
                      Send
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Popover Bottom Bar */}
            <div className="relative px-4 py-2.5 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <select
                  aria-label="Task List"
                  value={selectedTask.listId}
                  onChange={(e) =>
                    updateTask(selectedTask.id, { listId: e.target.value })
                  }
                  className="text-xs font-medium text-zinc-600 bg-white px-2.5 py-1 rounded-lg border border-zinc-200/80 focus:outline-none cursor-pointer"
                >
                  <option value="inbox">📥 Inbox</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.emoji ? `${l.emoji} ` : ''}
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 text-zinc-400">
                <button
                  type="button"
                  onClick={() =>
                    updateTask(selectedTask.id, {
                      content: selectedTask.content
                        ? `${selectedTask.content}\n- `
                        : '- ',
                    })
                  }
                  title="Insert Markdown Bullet"
                  className="p-1.5 rounded-lg hover:bg-zinc-200/60 hover:text-zinc-700"
                >
                  <Type className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowCommentBox((v) => !v)}
                  title="Comments"
                  className="p-1.5 rounded-lg hover:bg-zinc-200/60 hover:text-zinc-700"
                >
                  <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPopoverMoreMenu((v) => !v)}
                  title="More task actions"
                  className="p-1.5 rounded-lg hover:bg-zinc-200/60 hover:text-zinc-700"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              </div>

              {showPopoverMoreMenu && (
                <div className="absolute right-4 bottom-11 z-30 w-40 rounded-xl bg-zinc-900 text-zinc-100 shadow-xl border border-zinc-800 py-1.5 text-xs animate-popover">
                  <button
                    type="button"
                    onClick={() => {
                      updateTask(selectedTask.id, { isPinned: !selectedTask.isPinned });
                      setShowPopoverMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left"
                  >
                    <Pin className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{selectedTask.isPinned ? 'Unpin' : 'Pin'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      duplicateTask(selectedTask.id);
                      setShowPopoverMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left"
                  >
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Duplicate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      deleteTask(selectedTask.id);
                      setMatrixPopoverTaskId(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-rose-500/20 text-rose-400 text-left"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Guide Modal */}
      {isUserGuideOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsUserGuideOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 pb-20 sm:pb-5 overflow-y-auto animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden my-auto text-zinc-900"
          >
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                    <Grid2X2 className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900">
                      Eisenhower Matrix User Guide
                    </h3>
                    <p className="text-xs text-zinc-500">
                      The time management framework trusted by world leaders
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUserGuideOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quote */}
              <blockquote className="p-3 bg-zinc-50 border-l-2 border-blue-600 rounded-r-lg text-xs text-zinc-600 italic">
                &ldquo;What is important is seldom urgent, and what is urgent is seldom important.&rdquo;
                <span className="block text-[11px] font-semibold text-zinc-800 not-italic mt-0.5">
                  — Dwight D. Eisenhower (34th U.S. President)
                </span>
              </blockquote>

              {/* The 4 Quadrants Visual */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/50 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                    <span>❶</span> Urgent & Important (Do First)
                  </div>
                  <p className="text-[11.5px] text-zinc-600 leading-snug">
                    Crises, hard deadlines, system outages, and pressing emergencies. Tackle these immediately before anything else.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                    <span>❷</span> Not Urgent & Important (Schedule)
                  </div>
                  <p className="text-[11.5px] text-zinc-600 leading-snug">
                    Strategic planning, deep work, health, relationships, and learning. This quadrant produces 80% of long-term success.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                    <span>❸</span> Urgent & Unimportant (Delegate)
                  </div>
                  <p className="text-[11.5px] text-zinc-600 leading-snug">
                    Interruptions, unexpected favors, routine admin, and trivial requests. Automate, batch, or delegate whenever possible.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                    <span>❹</span> Not Urgent & Unimportant (Don&apos;t Do)
                  </div>
                  <p className="text-[11.5px] text-zinc-600 leading-snug">
                    Time wasters, doomscrolling, busywork, and unproductive habits. Eliminate ruthlessly to protect your focus.
                  </p>
                </div>
              </div>

              {/* Practical Tips */}
              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 space-y-1.5">
                <div className="font-semibold text-zinc-800">Productivity Pro-Tips:</div>
                <ul className="list-disc pl-4 space-y-0.5 text-[11.5px]">
                  <li>On mobile, use the <strong>Quadrant Navigator</strong> to focus on one quadrant or view all.</li>
                  <li>Tap the <strong>Q1-Q4 badge</strong> on any task to immediately move it to another quadrant.</li>
                  <li>Tap <strong>+</strong> in any quadrant header or the bottom FAB to open the mobile quick-add sheet.</li>
                </ul>
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsUserGuideOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage View Modal */}
      {isManageViewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsManageViewOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 pb-20 sm:pb-5 overflow-y-auto animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden my-auto text-zinc-900"
          >
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-zinc-700" />
                  Manage Matrix View
                </h3>
                <button
                  type="button"
                  onClick={() => setIsManageViewOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Completed Tasks Visibility
                  </label>
                  <button
                    type="button"
                    onClick={() => setHideCompleted(!hideCompleted)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-50"
                  >
                    <span>Hide Completed Tasks</span>
                    <input
                      type="checkbox"
                      checked={hideCompleted}
                      onChange={() => {}}
                      className="rounded text-blue-600 pointer-events-none"
                    />
                  </button>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Quadrant Names & Customization
                  </label>
                  <div className="space-y-2">
                    {quadrantConfigs.map((q) => (
                      <div key={q.id} className="flex items-center gap-2">
                        <span className="font-bold text-xs w-5 text-center">{q.circleNumber}</span>
                        <input
                          type="text"
                          value={q.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuadrantConfigs((prev) =>
                              prev.map((item) => (item.id === q.id ? { ...item, title: val } : item))
                            );
                          }}
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => {
                      setQuadrantConfigs(DEFAULT_QUADRANTS);
                      setHideCompleted(false);
                      pushToast({ title: 'Reset to Eisenhower Defaults', kind: 'info' });
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset to Defaults
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsManageViewOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 text-white font-semibold text-xs hover:bg-zinc-800"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Quadrant Modal */}
      {editingQuadrant && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setEditingQuadrant(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden my-auto text-zinc-900"
          >
            <div className="p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
                <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-zinc-700" />
                  Edit Quadrant {editingQuadrant.roman}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingQuadrant(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Quadrant Title
                  </label>
                  <input
                    type="text"
                    value={editingQuadrant.title}
                    onChange={(e) =>
                      setEditingQuadrant({ ...editingQuadrant, title: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Description / Rule
                  </label>
                  <textarea
                    rows={2}
                    value={editingQuadrant.subtitle}
                    onChange={(e) =>
                      setEditingQuadrant({ ...editingQuadrant, subtitle: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs leading-relaxed resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingQuadrant(null)}
                    className="px-3 py-2 text-xs text-zinc-500 hover:text-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuadrantConfigs((prev) =>
                        prev.map((q) => (q.id === editingQuadrant.id ? editingQuadrant : q))
                      );
                      setEditingQuadrant(null);
                      pushToast({ title: 'Quadrant Updated', kind: 'success' });
                    }}
                    className="px-4 py-2 rounded-xl bg-zinc-900 text-white font-semibold text-xs hover:bg-zinc-800"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Tag Selector Picker Modal */}
      {showQuickAddTagPicker && (
        <div
          onClick={() => setShowQuickAddTagPicker(false)}
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-72 bg-white rounded-xl shadow-2xl border border-zinc-200 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-zinc-500" />
                Select Tags
              </span>
              <button
                type="button"
                onClick={() => setShowQuickAddTagPicker(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {appTags.map((t) => {
                const isSelected = quickAddTags.includes(t.name);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setQuickAddTags((prev) => prev.filter((tag) => tag !== t.name));
                      } else {
                        setQuickAddTags((prev) => [...prev, t.name]);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    }`}
                  >
                    #{t.name}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setShowQuickAddTagPicker(false)}
              className="w-full py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Quick Add Template Selector Modal */}
      {showQuickAddTemplatePicker && (
        <div
          onClick={() => setShowQuickAddTemplatePicker(false)}
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-80 bg-white rounded-xl shadow-2xl border border-zinc-200 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                <Copy className="w-3.5 h-3.5 text-zinc-500" />
                Apply Template
              </span>
              <button
                type="button"
                onClick={() => setShowQuickAddTemplatePicker(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setQuickAddTitle(tpl.title);
                    setQuickAddContent(tpl.content || '');
                    if (tpl.priority) setQuickAddPriority(tpl.priority);
                    setShowQuickAddTemplatePicker(false);
                    pushToast({ title: 'Template Loaded', description: tpl.title, kind: 'info' });
                  }}
                  className="w-full flex flex-col p-2 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 text-left transition-colors"
                >
                  <span className="text-xs font-semibold text-zinc-900">{tpl.title}</span>
                  {tpl.content && (
                    <span className="text-[11px] text-zinc-500 truncate">{tpl.content}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
