import React, { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  differenceInCalendarDays,
  format,
  isBefore,
  parseISO,
  startOfToday,
} from 'date-fns';
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Columns3,
  Copy,
  FileText,
  Flag,
  GanttChart,
  Hourglass,
  List as ListIcon,
  Mic,
  Palette,
  PanelLeft,
  Paperclip,
  Pin,
  Plus,
  Repeat,
  RotateCcw,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Priority, Task, TaskList, ViewMode } from '../types';
import { parseNaturalLanguageTask } from '../utils/nlpParser';
import { isTaskDueOnDate, isTaskDueInDateRange } from '../utils/recurringTasks';

const PRIORITY_BORDER: Record<Priority, string> = {
  5: 'border-rose-500 text-rose-500 hover:bg-rose-50',
  3: 'border-amber-500 text-amber-500 hover:bg-amber-50',
  1: 'border-blue-500 text-blue-500 hover:bg-blue-50',
  0: 'border-zinc-300 text-zinc-400 hover:border-zinc-400',
};

const PRIORITY_BADGE: Record<Priority, { label: string; color: string }> = {
  5: { label: 'High', color: 'text-rose-700 bg-rose-50 border-rose-200/80' },
  3: { label: 'Med', color: 'text-amber-700 bg-amber-50 border-amber-200/80' },
  1: { label: 'Low', color: 'text-blue-700 bg-blue-50 border-blue-200/80' },
  0: { label: 'None', color: 'text-zinc-500 bg-zinc-100 border-zinc-200/80' },
};

export const TaskWorkspace: React.FC = () => {
  const {
    sidebarSelection,
    tasks,
    lists,
    sections,
    tags,
    customFilters,
    countdowns,
    selectedTaskId,
    setSelectedTaskId,
    addTask,
    updateTask,
    toggleTaskStatus,
    deleteTask,
    restoreTask,
    updateList,
    addSection,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    templates,
    applyTemplate,
    setActiveModule,
  } = useApp();

  const [quickInput, setQuickInput] = useState('');
  const [quickPriority, setQuickPriority] = useState<Priority | undefined>(undefined);
  const [quickSelectedListId, setQuickSelectedListId] = useState<string | null>(null);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteDismissed, setAutocompleteDismissed] = useState(false);
  const [autocompleteNavigated, setAutocompleteNavigated] = useState(false);
  const [fallbackViewMode, setFallbackViewMode] = useState<ViewMode>('list');
  const [sortBy, setSortBy] = useState<'priority' | 'dueDate' | 'title' | 'custom'>('priority');
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Collapsible section toggles
  const [isCountdownCollapsed, setIsCountdownCollapsed] = useState(false);
  const [isOverdueCollapsed, setIsOverdueCollapsed] = useState(false);
  const [isActiveSectionCollapsed, setIsActiveSectionCollapsed] = useState(false);
  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(false);
  const [isNarrowScreen, setIsNarrowScreen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 640
  );

  useEffect(() => {
    const handleResize = () => setIsNarrowScreen(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const today = startOfToday();
  const todayStr = format(today, 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(today, 1), 'yyyy-MM-dd');
  const next7Str = format(addDays(today, 7), 'yyyy-MM-dd');

  const activeList: TaskList | undefined =
    sidebarSelection.kind === 'list'
      ? lists.find((l) => l.id === sidebarSelection.id)
      : undefined;

  const viewMode: ViewMode = activeList ? activeList.viewMode : fallbackViewMode;

  const setViewMode = (mode: ViewMode) => {
    if (activeList) {
      updateList(activeList.id, { viewMode: mode });
    } else {
      setFallbackViewMode(mode);
    }
  };

  // Live NLP preview on quick-add input
  const parsedPreview = useMemo(() => {
    if (!quickInput.trim()) return null;
    return parseNaturalLanguageTask(quickInput);
  }, [quickInput]);

  // Inline Autocomplete for Existing Lists & Tags while typing a task
  const autocompleteData = useMemo(() => {
    if (autocompleteDismissed || !quickInput) return null;
    // Match the trailing word token if cursor is at the end (no trailing space)
    const trailingMatch = quickInput.match(/(?:^|\s)([^\s]+)$/);
    if (!trailingMatch) return null;

    const rawToken = trailingMatch[1];
    const tokenStartIndex = quickInput.length - rawToken.length;

    const isExplicitTag = rawToken.startsWith('#');
    const isExplicitList = rawToken.startsWith('~') || rawToken.startsWith('^');
    const cleanQuery = rawToken.replace(/^[#~^]+/, '').toLowerCase();

    // Require at least 1 char for explicit #/~ or at least 2 chars for plain word matching
    if (!isExplicitTag && !isExplicitList && cleanQuery.length < 2) {
      return null;
    }

    // Do not suggest if the exact #tag is already completed
    if (isExplicitTag && tags.some((t) => t.name.toLowerCase() === cleanQuery && rawToken.length > 1 && quickInput.endsWith(' '))) {
      return null;
    }

    type SuggestionItem = {
      kind: 'list' | 'tag';
      id: string;
      name: string;
      color: string;
    };

    const items: SuggestionItem[] = [];

    if (!isExplicitTag) {
      const matchingLists = lists.filter((l) =>
        cleanQuery.length === 0 ? true : l.name.toLowerCase().includes(cleanQuery)
      );
      for (const l of matchingLists.slice(0, 4)) {
        items.push({
          kind: 'list',
          id: l.id,
          name: l.name,
          color: l.color,
        });
      }
    }

    if (!isExplicitList) {
      const matchingTags = tags.filter((t) =>
        cleanQuery.length === 0 ? true : t.name.toLowerCase().includes(cleanQuery)
      );
      for (const tg of matchingTags.slice(0, 5)) {
        items.push({
          kind: 'tag',
          id: tg.id,
          name: tg.name,
          color: tg.color,
        });
      }
    }

    if (items.length === 0) return null;

    return {
      rawToken,
      tokenStartIndex,
      isExplicitPrefix: isExplicitTag || isExplicitList,
      items,
    };
  }, [quickInput, lists, tags, autocompleteDismissed]);

  const applyAutocompleteSuggestion = (item: {
    kind: 'list' | 'tag';
    id: string;
    name: string;
    color: string;
  }) => {
    if (!autocompleteData) return;
    const before = quickInput.slice(0, autocompleteData.tokenStartIndex);
    if (item.kind === 'tag') {
      setQuickInput(`${before}#${item.name} `);
    } else {
      setQuickSelectedListId(item.id);
      setQuickInput(before);
    }
    setAutocompleteIndex(0);
    setAutocompleteDismissed(false);
    setAutocompleteNavigated(false);
  };

  // Filter tasks according to current sidebar selection
  const filteredTasks = useMemo(() => {
    let base = tasks;

    if (sidebarSelection.kind === 'smart') {
      // Respect showInSmartList === 'hidden' on lists
      const hiddenListIds = new Set(
        lists.filter((l) => l.showInSmartList === 'hidden').map((l) => l.id)
      );
      base = base.filter((t) => !hiddenListIds.has(t.listId));

      switch (sidebarSelection.id) {
        case 'completed':
          return base.filter((t) => t.status === 'completed');
        case 'wont_do':
          return base.filter((t) => t.status === 'wont_do');
        case 'trash':
          return base.filter((t) => t.status === 'trash');
        case 'today':
          base = base.filter(
            (t) =>
              t.status !== 'trash' &&
              t.status !== 'wont_do' &&
              t.dueDate &&
              (isTaskDueOnDate(t, todayStr) || isBefore(parseISO(t.dueDate), today))
          );
          break;
        case 'overdue':
          base = base.filter(
            (t) =>
              t.status !== 'trash' &&
              t.status !== 'wont_do' &&
              t.status !== 'completed' &&
              Boolean(t.dueDate && isBefore(parseISO(t.dueDate), today))
          );
          break;
        case 'tomorrow':
          base = base.filter(
            (t) =>
              t.status !== 'trash' &&
              t.status !== 'wont_do' &&
              t.dueDate &&
              isTaskDueOnDate(t, tomorrowStr)
          );
          break;
        case 'next7days':
          base = base.filter(
            (t) =>
              t.status !== 'trash' &&
              t.status !== 'wont_do' &&
              isTaskDueInDateRange(t, todayStr, next7Str)
          );
          break;
        case 'inbox':
          base = base.filter(
            (t) => t.status !== 'trash' && t.status !== 'wont_do' && t.listId === 'inbox'
          );
          break;
        case 'assigned':
          base = base.filter(
            (t) => t.status !== 'trash' && t.status !== 'wont_do' && Boolean(t.assignee)
          );
          break;
        default:
          base = base.filter((t) => t.status !== 'trash' && t.status !== 'wont_do');
      }
    } else if (sidebarSelection.kind === 'list') {
      base = base.filter(
        (t) => t.status !== 'trash' && t.status !== 'wont_do' && t.listId === sidebarSelection.id
      );
    } else if (sidebarSelection.kind === 'tag') {
      base = base.filter(
        (t) =>
          t.status !== 'trash' &&
          t.status !== 'wont_do' &&
          t.tags.includes(sidebarSelection.id)
      );
    } else if (sidebarSelection.kind === 'filter') {
      const flt = customFilters.find((f) => f.id === sidebarSelection.id);
      if (flt) {
        base = base.filter((t) => {
          if (t.status === 'trash' || t.status === 'wont_do') return false;
          if (
            flt.criteria.priorities.length > 0 &&
            !flt.criteria.priorities.includes(t.priority)
          ) {
            return false;
          }
          if (
            flt.criteria.tags.length > 0 &&
            !flt.criteria.tags.some((tg) => t.tags.includes(tg))
          ) {
            return false;
          }
          if (
            flt.criteria.listIds.length > 0 &&
            !flt.criteria.listIds.includes(t.listId)
          ) {
            return false;
          }
          if (flt.criteria.dateRange === 'today' && (!t.dueDate || !isTaskDueOnDate(t, todayStr))) {
            return false;
          }
          if (
            flt.criteria.dateRange === 'next7days' &&
            !isTaskDueInDateRange(t, todayStr, next7Str)
          ) {
            return false;
          }
          if (
            flt.criteria.dateRange === 'overdue' &&
            (!t.dueDate || !isBefore(parseISO(t.dueDate), today))
          ) {
            return false;
          }
          return true;
        });
      }
    }

    return [...base].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (sortBy === 'priority') return b.priority - a.priority;
      if (sortBy === 'dueDate') {
        return (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99');
      }
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return a.sortOrder - b.sortOrder;
    });
  }, [tasks, lists, sidebarSelection, customFilters, sortBy, todayStr, tomorrowStr, next7Str]);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    const parsed = parseNaturalLanguageTask(quickInput);

    // Resolve target list from explicit autocomplete selection, ~listName, or current selection
    let targetListId = quickSelectedListId ?? (activeList ? activeList.id : 'inbox');
    if (!quickSelectedListId && parsed.listName) {
      const matched = lists.find(
        (l) => l.name.toLowerCase().includes(parsed.listName!.toLowerCase())
      );
      if (matched) targetListId = matched.id;
    }

    const defaultDueDate =
      parsed.dueDate ??
      (parsed.recurrenceRule
        ? todayStr
        : sidebarSelection.kind === 'smart' && sidebarSelection.id === 'today'
          ? todayStr
          : sidebarSelection.kind === 'smart' && sidebarSelection.id === 'tomorrow'
            ? tomorrowStr
            : undefined);

    addTask({
      title: parsed.cleanTitle,
      listId: targetListId,
      dueDate: defaultDueDate,
      startDate: defaultDueDate,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      durationMinutes: parsed.durationMinutes,
      priority: quickPriority ?? parsed.priority ?? 0,
      tags:
        sidebarSelection.kind === 'tag'
          ? Array.from(new Set([...parsed.tags, sidebarSelection.id]))
          : parsed.tags,
      recurrenceRule: parsed.recurrenceRule,
      isNote: activeList?.listType === 'note',
    });

    setQuickInput('');
    setQuickPriority(undefined);
    setQuickSelectedListId(null);
    setAutocompleteDismissed(false);
    setAutocompleteNavigated(false);
  };

  const handleVoiceInput = () => {
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

    if (!SpeechRec) {
      setQuickInput((prev) => `${prev} Review product roadmap tomorrow at 3pm #deep-work !high`.trim());
      return;
    }

    try {
      setIsListeningVoice(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRec as any)();
      recognition.lang = 'en-US';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        setQuickInput((prev) => `${prev} ${transcript}`.trim());
        setIsListeningVoice(false);
      };
      recognition.onerror = () => setIsListeningVoice(false);
      recognition.onend = () => setIsListeningVoice(false);
      recognition.start();
    } catch {
      setIsListeningVoice(false);
    }
  };

  // Heading Title
  const headerTitle = useMemo(() => {
    if (sidebarSelection.kind === 'smart') {
      const titles: Record<string, string> = {
        all: 'All Tasks',
        today: 'Today',
        overdue: 'Overdue',
        tomorrow: 'Tomorrow',
        next7days: 'Next 7 Days',
        inbox: 'Inbox',
        assigned: 'Assigned to Me',
        completed: 'Completed',
        wont_do: "Won't Do",
        trash: 'Trash',
        summary: 'Smart Weekly Summary',
      };
      return titles[sidebarSelection.id] || 'Tasks';
    }
    if (sidebarSelection.kind === 'list') return activeList?.name || 'List';
    if (sidebarSelection.kind === 'tag') return `#${sidebarSelection.id}`;
    if (sidebarSelection.kind === 'filter') {
      return customFilters.find((f) => f.id === sidebarSelection.id)?.name || 'Filter';
    }
    return 'Tasks';
  }, [sidebarSelection, activeList, customFilters]);

  // Background style class for Premium List Backgrounds (disciplined low-noise textures)
  const bgStyleClass = useMemo(() => {
    const style = activeList?.backgroundStyle || 'none';
    switch (style) {
      case 'gradient-ocean':
        return 'bg-sky-50/35';
      case 'gradient-sunset':
        return 'bg-amber-50/30';
      case 'gradient-forest':
        return 'bg-emerald-50/30';
      case 'dots':
        return 'bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] [background-size:16px_16px] bg-white';
      case 'grid':
        return 'bg-[linear-gradient(to_right,#f4f4f5_1px,transparent_1px),linear-gradient(to_bottom,#f4f4f5_1px,transparent_1px)] [background-size:24px_24px] bg-white';
      default:
        return 'bg-white';
    }
  }, [activeList?.backgroundStyle]);

  // If Smart Summary is selected, show TickTick's Markdown Weekly/Daily Summary Generator
  if (sidebarSelection.kind === 'smart' && sidebarSelection.id === 'summary') {
    const completedTasks = tasks.filter((t) => t.status === 'completed');
    const pendingTasks = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress');
    const markdownReport = `# Weekly Productivity Summary (${todayStr})\n\n## Completed (${completedTasks.length})\n${completedTasks
      .map((t) => `- [x] **${t.title}** ${t.tags.map((tg) => `#${tg}`).join(' ')}`)
      .join('\n')}\n\n## In Progress & Upcoming (${pendingTasks.length})\n${pendingTasks
      .map(
        (t) =>
          `- [ ] **${t.title}** (${t.dueDate || 'No date'}${t.durationMinutes ? `, ${t.durationMinutes}m` : ''})`
      )
      .join('\n')}`;

    return (
      <main className="flex-1 flex flex-col h-full bg-white overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto w-full space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-zinc-900 flex items-center gap-2 tracking-tight">
                <FileText className="w-4 h-4 text-zinc-700" strokeWidth={1.75} />
                Smart Summary & Standup Export
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                Auto-generated Markdown review of your completed tasks, active sprint items, and focus metrics.
              </p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(markdownReport);
                setCopiedSummary(true);
                setTimeout(() => setCopiedSummary(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800"
            >
              {copiedSummary ? (
                <Check className="w-3.5 h-3.5" strokeWidth={2} />
              ) : (
                <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
              )}
              {copiedSummary ? 'Copied Markdown' : 'Copy Markdown'}
            </button>
          </div>
          <pre className="p-4 rounded-xl bg-zinc-950 text-zinc-100 text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto border border-zinc-800">
            {markdownReport}
          </pre>
        </div>
      </main>
    );
  }

  const isTaskOverdue = (t: Task) =>
    t.status !== 'completed' &&
    t.status !== 'trash' &&
    t.status !== 'wont_do' &&
    Boolean(t.dueDate && isBefore(parseISO(t.dueDate), today));

  const isOverdueView = sidebarSelection.kind === 'smart' && sidebarSelection.id === 'overdue';
  const pinnedTasks = filteredTasks.filter((t) => t.isPinned && t.status !== 'completed');
  const overdueTasks = isOverdueView
    ? []
    : filteredTasks.filter((t) => !t.isPinned && isTaskOverdue(t));
  const openTasks = isOverdueView
    ? filteredTasks.filter((t) => !t.isPinned && t.status !== 'completed')
    : filteredTasks.filter((t) => !t.isPinned && t.status !== 'completed' && !isTaskOverdue(t));
  const doneTasks = filteredTasks.filter((t) => t.status === 'completed');

  const renderTaskRow = (task: Task) => {
    const isSelected = selectedTaskId === task.id;
    const isDone = task.status === 'completed';
    const isOverdue =
      !isDone && task.dueDate && isBefore(parseISO(task.dueDate), today);
    const taskList = lists.find((l) => l.id === task.listId);
    const completedSubs = task.subtasks.filter((s) => s.completed).length;

    return (
      <div
        key={task.id}
        data-task-id={task.id}
        data-testid="task-item"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedTaskId(task.id);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setSelectedTaskId(task.id);
        }}
        className={`group flex items-center gap-2.5 sm:gap-3 px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-[38px] rounded-lg border cursor-pointer ${
          isSelected
            ? 'bg-zinc-900/[0.04] border-zinc-300'
            : 'bg-white hover:bg-zinc-50/90 border-zinc-200/70'
        }`}
      >
        {/* Priority Checkbox or Note Icon */}
        {task.isNote ? (
          <span
            title="Note Item"
            className="w-4 h-4 rounded flex items-center justify-center text-amber-600 shrink-0"
          >
            <FileText className="w-4 h-4" strokeWidth={1.75} />
          </span>
        ) : (
          <button
            type="button"
            aria-label={`Mark "${task.title}" as ${isDone ? 'incomplete' : 'completed'}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleTaskStatus(task.id);
            }}
            className={`w-4 h-4 rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0 ${
              isDone
                ? 'bg-zinc-400 border-zinc-400 text-white'
                : PRIORITY_BORDER[task.priority]
            }`}
          >
            {isDone && <Check className="w-2.5 h-2.5 stroke-[2.75] animate-check" />}
          </button>
        )}

        {/* Title & Metadata Badges (NO line-through when completed) */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {task.isPinned && (
              <Pin className="w-3 h-3 text-blue-600 fill-blue-600 shrink-0" strokeWidth={1.75} />
            )}
            <span
              className={`text-xs font-medium truncate ${
                isDone ? 'text-zinc-400' : 'text-zinc-900'
              }`}
            >
              {task.title}
            </span>
          </div>

          {!isDone && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {task.subtasks.length > 0 && (
                <span className="text-[10px] font-mono-num text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                  {completedSubs}/{task.subtasks.length}
                </span>
              )}

              {task.durationMinutes && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono-num text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded">
                  <Clock className="w-2.5 h-2.5" strokeWidth={1.75} />
                  {task.startTime ? `${task.startTime} (${task.durationMinutes}m)` : `${task.durationMinutes}m`}
                </span>
              )}

              {task.recurrenceRule && (
                <span
                  title={`Repeats ${task.recurrenceRule}`}
                  className="inline-flex items-center gap-0.5 text-[10px] text-zinc-500"
                >
                  <Repeat className="w-2.5 h-2.5" strokeWidth={1.75} />
                  {task.recurrenceRule}
                </span>
              )}

              {task.constantReminder && (
                <span
                  title="Constant Reminder Active (Premium)"
                  className="inline-flex items-center gap-0.5 text-[10px] text-rose-700 bg-rose-50 border border-rose-200/70 px-1.5 py-0.5 rounded font-medium"
                >
                  <BellRing className="w-2.5 h-2.5" strokeWidth={1.75} />
                  Constant
                </span>
              )}

              {task.attachments.length > 0 && (
                <Paperclip className="w-3 h-3 text-zinc-400" strokeWidth={1.75} />
              )}

              {task.tags.map((tg) => (
                <span
                  key={tg}
                  className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600 font-medium"
                >
                  #{tg}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Source List Badge, Due Date & Trash/Restore */}
        <div className="flex items-center gap-2 shrink-0">
          {taskList && sidebarSelection.kind !== 'list' && (
            <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
              {taskList.emoji ? (
                <span className="text-xs leading-none">{taskList.emoji}</span>
              ) : (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: taskList.color }}
                />
              )}
              <span className="truncate max-w-[96px]">{taskList.name}</span>
            </span>
          )}

          {task.dueDate && !isDone && (
            <span
              className={`text-[11px] font-mono-num px-1.5 py-0.5 rounded ${
                isOverdue
                  ? 'text-rose-700 bg-rose-50 font-semibold'
                  : task.dueDate === todayStr
                    ? 'text-blue-600 font-medium'
                    : 'text-zinc-500'
              }`}
            >
              {task.dueDate === todayStr
                ? 'Today'
                : task.dueDate === tomorrowStr
                  ? 'Tomorrow'
                  : format(parseISO(task.dueDate), 'MMM d')}
            </span>
          )}

          {taskList?.color && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: taskList.color }}
            />
          )}

          {task.status === 'trash' ? (
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  restoreTask(task.id);
                }}
                title="Restore Task"
                className="p-1 rounded hover:bg-emerald-50 text-emerald-600"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteTask(task.id, true);
                }}
                title="Delete Permanently"
                className="p-1 rounded hover:bg-rose-50 text-rose-600"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateTask(task.id, { isPinned: !task.isPinned });
              }}
              title={task.isPinned ? 'Unpin task' : 'Pin task to top'}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900"
            >
              <Pin className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <main
      onClick={() => {
        if (selectedTaskId) setSelectedTaskId(null);
      }}
      className={`flex-1 flex flex-col h-full min-w-0 ${bgStyleClass}`}
    >
      {/* Top Toolbar */}
      <header
        onClick={(e) => e.stopPropagation()}
        className="h-12 sm:h-13 px-3 sm:px-4 border-b border-zinc-200/80 flex items-center justify-between gap-2 bg-white/90 backdrop-blur-xs shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title="Toggle Sidebar"
            aria-label="Toggle Sidebar"
            className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 shrink-0"
          >
            <PanelLeft className="w-4 h-4" strokeWidth={1.75} />
          </button>

          {activeList && (
            activeList.emoji ? (
              <span className="text-sm leading-none shrink-0">{activeList.emoji}</span>
            ) : (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: activeList.color }}
              />
            )
          )}

          <h1 className="text-sm font-semibold text-zinc-900 truncate tracking-tight max-w-[120px] sm:max-w-[240px] md:max-w-none">
            {headerTitle}
          </h1>

          <span className="text-[11px] font-mono-num px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-600 font-medium shrink-0">
            {openTasks.length + pinnedTasks.length}
          </span>

          {activeList?.isShared && (
            <div className="hidden sm:flex items-center -space-x-1.5 ml-2" title="Shared List Collaborators">
              {activeList.members.map((m) => (
                <span
                  key={m.email}
                  style={{ backgroundColor: m.avatarColor }}
                  className="w-5 h-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center ring-2 ring-white"
                  title={`${m.name} (${m.role})`}
                >
                  {m.name[0]}
                </span>
              ))}
              <span className="pl-2 text-[11px] text-zinc-400 flex items-center gap-1">
                <Users className="w-3 h-3" strokeWidth={1.75} /> Shared
              </span>
            </div>
          )}
        </div>

        {/* Right Controls: View Switcher (List / Kanban / Timeline), Sort, Templates, List Background */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div
            role="group"
            aria-label="View Mode Switcher"
            className="inline-flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/70"
          >
            <button
              onClick={() => setViewMode('list')}
              title="List View"
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium ${
                viewMode === 'list'
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span className="hidden md:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              title="Kanban View"
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium ${
                viewMode === 'kanban'
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span className="hidden md:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              title="Timeline View"
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium ${
                viewMode === 'timeline'
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <GanttChart className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span className="hidden md:inline">Timeline</span>
            </button>
          </div>

          <select
            aria-label="Sort tasks by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs px-2 sm:px-2.5 py-1.5 rounded-lg border border-zinc-200/80 bg-white text-zinc-600 focus:outline-none focus:border-zinc-900 max-w-[78px] sm:max-w-none"
          >
            <option value="priority">Priority</option>
            <option value="dueDate">Due Date</option>
            <option value="title">Title</option>
          </select>

          {/* List Background Picker (Premium) */}
          {activeList && (
            <div className="relative">
              <button
                onClick={() => setShowBgPicker((v) => !v)}
                title="Customize List Surface Texture (Premium)"
                className="p-1.5 rounded-lg border border-zinc-200/80 bg-white text-zinc-600 hover:bg-zinc-50"
              >
                <Palette className="w-4 h-4" strokeWidth={1.75} />
              </button>
              {showBgPicker && (
                <div className="absolute right-0 mt-1.5 w-44 surface-floating rounded-xl p-1.5 z-30 space-y-0.5 animate-popover origin-top-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-2 py-1">
                    Surface Texture
                  </div>
                  {(
                    [
                      ['none', 'Clean White'],
                      ['dots', 'Dot Matrix'],
                      ['grid', 'Blueprint Grid'],
                      ['gradient-ocean', 'Cool Tint'],
                      ['gradient-sunset', 'Warm Tint'],
                      ['gradient-forest', 'Sage Tint'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => {
                        updateList(activeList.id, { backgroundStyle: id });
                        setShowBgPicker(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs ${
                        activeList.backgroundStyle === id
                          ? 'bg-zinc-900 text-white font-medium'
                          : 'text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Smart NLP Quick-Add Bar */}
      {sidebarSelection.id !== 'trash' && sidebarSelection.id !== 'completed' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="px-3 sm:px-4 pt-2.5 sm:pt-3 pb-2 shrink-0"
        >
          <form onSubmit={handleQuickSubmit} className="relative">
            <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-lg bg-zinc-100/80 border border-zinc-200/90 focus-within:bg-white focus-within:border-zinc-900 focus-within:ring-2 focus-within:ring-zinc-900/5">
              <Plus className="w-4 h-4 text-zinc-400 shrink-0" strokeWidth={1.75} />

              {/* Selected List Chip when chosen via autocomplete */}
              {quickSelectedListId && (() => {
                const chosenList = lists.find((l) => l.id === quickSelectedListId);
                if (!chosenList) return null;
                return (
                  <span
                    data-testid="quick-selected-list-chip"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white border border-zinc-200/90 text-zinc-800 shadow-2xs shrink-0"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: chosenList.color }}
                    />
                    <span className="max-w-[96px] truncate">{chosenList.name}</span>
                    <button
                      type="button"
                      onClick={() => setQuickSelectedListId(null)}
                      title="Remove target list"
                      className="text-zinc-400 hover:text-zinc-700 ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                );
              })()}

              <input
                type="text"
                value={quickInput}
                onChange={(e) => {
                  setQuickInput(e.target.value);
                  setAutocompleteIndex(0);
                  setAutocompleteDismissed(false);
                  setAutocompleteNavigated(false);
                }}
                onKeyDown={(e) => {
                  if (!autocompleteData || autocompleteData.items.length === 0) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setAutocompleteNavigated(true);
                    setAutocompleteIndex((prev) =>
                      (prev + 1) % autocompleteData.items.length
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setAutocompleteNavigated(true);
                    setAutocompleteIndex((prev) =>
                      (prev - 1 + autocompleteData.items.length) %
                      autocompleteData.items.length
                    );
                  } else if (e.key === 'Tab') {
                    e.preventDefault();
                    const chosen =
                      autocompleteData.items[autocompleteIndex] ||
                      autocompleteData.items[0];
                    if (chosen) applyAutocompleteSuggestion(chosen);
                  } else if (e.key === 'Enter' && autocompleteNavigated) {
                    e.preventDefault();
                    const chosen =
                      autocompleteData.items[autocompleteIndex] ||
                      autocompleteData.items[0];
                    if (chosen) applyAutocompleteSuggestion(chosen);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setAutocompleteDismissed(true);
                    setAutocompleteNavigated(false);
                  }
                }}
                placeholder={
                  isNarrowScreen
                    ? `+ Add task... Try NLP (#tag or ~list)`
                    : `+ Add task to "${headerTitle}"... Try NLP or type a list/tag name for autocomplete`
                }
                className="flex-1 min-w-0 bg-transparent text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              />

              {/* Quick Priority Picker & Actions */}
              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                {/* Mobile: Single cycling flag button to preserve input width */}
                <button
                  type="button"
                  onClick={() => {
                    if (!quickPriority) setQuickPriority(5);
                    else if (quickPriority === 5) setQuickPriority(3);
                    else if (quickPriority === 3) setQuickPriority(1);
                    else setQuickPriority(undefined);
                  }}
                  title={
                    quickPriority
                      ? `Priority: ${PRIORITY_BADGE[quickPriority].label} (Tap to change)`
                      : 'Set Priority (Tap to cycle)'
                  }
                  className={`sm:hidden p-1.5 rounded-md flex items-center justify-center transition-colors ${
                    quickPriority
                      ? PRIORITY_BADGE[quickPriority].color
                      : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60'
                  }`}
                >
                  <Flag
                    className={`w-3.5 h-3.5 ${
                      quickPriority === 5
                        ? 'text-rose-500 fill-rose-500'
                        : quickPriority === 3
                          ? 'text-amber-500 fill-amber-500'
                          : quickPriority === 1
                            ? 'text-blue-500 fill-blue-500'
                            : 'text-zinc-400'
                    }`}
                    strokeWidth={1.75}
                  />
                </button>

                {/* Tablet / Desktop: Individual priority flag buttons */}
                <div className="hidden sm:flex items-center gap-1">
                  {([5, 3, 1] as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setQuickPriority(quickPriority === p ? undefined : p)}
                      title={`Set ${PRIORITY_BADGE[p].label} Priority`}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium border flex items-center gap-0.5 ${
                        quickPriority === p
                          ? PRIORITY_BADGE[p].color
                          : 'border-transparent text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700'
                      }`}
                    >
                      <Flag
                        className={`w-3 h-3 ${
                          p === 5
                            ? 'text-rose-500'
                            : p === 3
                              ? 'text-amber-500'
                              : 'text-blue-500'
                        }`}
                        strokeWidth={1.75}
                      />
                      <span>{PRIORITY_BADGE[p].label}</span>
                    </button>
                  ))}
                </div>

                {/* Voice Input Button */}
                <button
                  type="button"
                  onClick={handleVoiceInput}
                  title="Voice Input (Auto Speech-to-Text + NLP)"
                  className={`p-1.5 rounded-md ${
                    isListeningVoice
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>

                {/* Insert from Template Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTemplateMenu((v) => !v)}
                    title="Create from Reusable Template (Premium)"
                    className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/60"
                  >
                    <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                  {showTemplateMenu && (
                    <div className="absolute right-0 mt-2 w-64 surface-floating rounded-xl p-1.5 z-30 animate-popover origin-top-right">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-2 py-1">
                        Insert Task Template
                      </div>
                      {templates.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => {
                            applyTemplate(tpl.id, activeList?.id || 'inbox');
                            setShowTemplateMenu(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 text-xs text-zinc-700 flex items-center justify-between"
                        >
                          <span className="truncate font-medium">{tpl.name}</span>
                          <span className="text-[10px] font-mono-num text-zinc-400">
                            {tpl.subtasks.length} steps
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Inline Autocomplete Dropdown for Matching Existing Lists & Tags */}
            {autocompleteData && autocompleteData.items.length > 0 && (
              <div
                data-testid="quick-add-autocomplete"
                className="absolute left-0 right-0 sm:right-auto sm:w-80 top-full mt-1.5 surface-floating bg-white rounded-xl border border-zinc-200/90 shadow-xl p-1.5 z-40 animate-popover"
              >
                <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-100 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Matching Lists & Tags
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono-num">
                    Tab / Click to choose
                  </span>
                </div>
                <div className="max-h-52 overflow-y-auto space-y-0.5">
                  {autocompleteData.items.map((item, idx) => {
                    const isHighlighted = idx === autocompleteIndex;
                    return (
                      <button
                        key={`${item.kind}-${item.id}`}
                        type="button"
                        data-testid={`autocomplete-option-${item.kind}-${item.name}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyAutocompleteSuggestion(item);
                        }}
                        onMouseEnter={() => setAutocompleteIndex(idx)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          isHighlighted
                            ? 'bg-zinc-900 text-white font-medium'
                            : 'text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="truncate">
                            {item.kind === 'tag' ? `#${item.name}` : item.name}
                          </span>
                        </span>
                        <span
                          className={`text-[10px] font-mono-num px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            isHighlighted
                              ? 'bg-white/15 text-zinc-200'
                              : 'bg-zinc-100 text-zinc-500'
                          }`}
                        >
                          {item.kind === 'list' ? 'List' : 'Tag'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Live NLP Smart Recognition Pills */}
            {parsedPreview && parsedPreview.detectedTokens.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5 px-1 animate-popover">
                <span className="text-[10px] font-semibold text-zinc-600 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-blue-600" strokeWidth={1.75} /> Smart NLP recognized:
                </span>
                {parsedPreview.detectedTokens.map((tok, i) => (
                  <span
                    key={`${tok.raw}-${i}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono-num font-medium bg-zinc-900 text-white"
                  >
                    {tok.label}
                  </span>
                ))}
              </div>
            )}
          </form>
        </div>
      )}

      {/* Main Content Area: List / Kanban / Timeline */}
      <div
        key={`${sidebarSelection.kind}-${sidebarSelection.id}-${viewMode}`}
        className="flex-1 overflow-y-auto px-4 py-2 animate-view-switch"
      >
        {viewMode === 'list' && (
          <div className="space-y-4 pb-8">
            {/* Collapsible Countdown Section in Today View (matching Screenshot 3) */}
            {sidebarSelection.kind === 'smart' &&
              sidebarSelection.id === 'today' &&
              countdowns.length > 0 && (
                <section>
                  <button
                    type="button"
                    onClick={() => setIsCountdownCollapsed((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 mb-1.5 px-1"
                  >
                    {isCountdownCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.75} />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.75} />
                    )}
                    <span>Countdown</span>
                    <span className="text-[11px] font-mono-num text-zinc-400">
                      {countdowns.length}
                    </span>
                  </button>

                  {!isCountdownCollapsed && (
                    <div className="space-y-1 animate-section-expand">
                      {countdowns.map((cd) => {
                        const diffDays = differenceInCalendarDays(parseISO(cd.targetDate), today);
                        return (
                          <div
                            key={cd.id}
                            onClick={() => setActiveModule('countdown')}
                            className="flex items-center justify-between px-3 py-2 rounded-lg bg-white hover:bg-zinc-50 border border-zinc-200/70 text-xs cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="w-4 h-4 rounded flex items-center justify-center text-white shrink-0"
                                style={{ backgroundColor: cd.color }}
                              >
                                <Hourglass className="w-2.5 h-2.5" strokeWidth={2} />
                              </span>
                              <span className="font-medium text-zinc-900 truncate">{cd.title}</span>
                            </div>
                            <span
                              className="text-[11px] font-mono-num font-semibold shrink-0"
                              style={{ color: cd.color }}
                            >
                              {diffDays === 0
                                ? 'Today'
                                : diffDays > 0
                                  ? `${diffDays}d left`
                                  : `${Math.abs(diffDays)}d ago`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

            {/* Pinned Section */}
            {pinnedTasks.length > 0 && (
              <section>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 mb-1.5 px-1">
                  <Pin className="w-3.5 h-3.5 text-blue-600" strokeWidth={1.75} />
                  <span>Pinned</span>
                  <span className="text-[11px] font-mono-num text-zinc-400">
                    {pinnedTasks.length}
                  </span>
                </div>
                <div className="space-y-1">{pinnedTasks.map(renderTaskRow)}</div>
              </section>
            )}

            {/* Dedicated Collapsible Overdue Section (Tasks not completed by due date) */}
            {overdueTasks.length > 0 && (
              <section data-testid="overdue-section">
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <button
                    type="button"
                    onClick={() => setIsOverdueCollapsed((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700"
                  >
                    {isOverdueCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-rose-400" strokeWidth={1.75} />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-rose-400" strokeWidth={1.75} />
                    )}
                    <span>Overdue</span>
                    <span className="text-[11px] font-mono-num px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200/70">
                      {overdueTasks.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      overdueTasks.forEach((t) =>
                        updateTask(t.id, { dueDate: todayStr, startDate: todayStr }, 'Rescheduled overdue task to Today')
                      );
                    }}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 px-2 py-0.5 rounded hover:bg-rose-50 transition-colors"
                  >
                    Move all to Today
                  </button>
                </div>
                {!isOverdueCollapsed && (
                  <div className="space-y-1 animate-section-expand">{overdueTasks.map(renderTaskRow)}</div>
                )}
              </section>
            )}

            {/* Active / Today Tasks Section */}
            <section>
              {(openTasks.length > 0 || doneTasks.length > 0 || overdueTasks.length > 0) && (
                <button
                  type="button"
                  onClick={() => setIsActiveSectionCollapsed((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 mb-1.5 px-1"
                >
                  {isActiveSectionCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.75} />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.75} />
                  )}
                  <span>
                    {sidebarSelection.kind === 'smart' && sidebarSelection.id === 'today'
                      ? 'Today'
                      : sidebarSelection.kind === 'smart' && sidebarSelection.id === 'overdue'
                        ? 'Overdue'
                        : 'Tasks'}
                  </span>
                  <span className="text-[11px] font-mono-num text-zinc-400">
                    {openTasks.length}
                  </span>
                </button>
              )}

              {openTasks.length === 0 &&
              overdueTasks.length === 0 &&
              pinnedTasks.length === 0 &&
              doneTasks.length === 0 ? (
                <div className="text-center py-16 animate-view-switch">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-500 flex items-center justify-center mx-auto mb-3 border border-zinc-200/80">
                    <Check className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-700">All clear</h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Use the smart input bar above to capture tasks with natural language.
                  </p>
                </div>
              ) : (
                !isActiveSectionCollapsed && (
                  <div className="space-y-1 animate-section-expand">{openTasks.map(renderTaskRow)}</div>
                )
              )}
            </section>

            {/* Dedicated Collapsible Completed Section (NO line-through) */}
            {doneTasks.length > 0 && (
              <section className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsCompletedCollapsed((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 mb-1.5 px-1"
                >
                  {isCompletedCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.75} />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.75} />
                  )}
                  <span>Completed</span>
                  <span className="text-[11px] font-mono-num text-zinc-400">
                    {doneTasks.length}
                  </span>
                </button>
                {!isCompletedCollapsed && (
                  <div className="space-y-1 animate-section-expand">{doneTasks.map(renderTaskRow)}</div>
                )}
              </section>
            )}

            {/* Clickable blank workspace space to deselect task */}
            <div
              data-testid="workspace-blank-space"
              className="min-h-32 flex-1 cursor-default"
              onClick={() => setSelectedTaskId(null)}
            />
          </div>
        )}

        {viewMode === 'kanban' && (
          <div className="flex gap-3 sm:gap-4 h-full overflow-x-auto pb-4 items-start snap-x snap-mandatory sm:snap-none">
            {(() => {
              const listSections = activeList
                ? sections.filter((s) => s.listId === activeList.id)
                : [];

              const columns =
                listSections.length > 0
                  ? listSections.map((sec) => ({
                      id: sec.id,
                      title: sec.name,
                      activeItems: filteredTasks.filter(
                        (t) => t.sectionId === sec.id && t.status !== 'completed'
                      ),
                      completedItems: filteredTasks.filter(
                        (t) => t.sectionId === sec.id && t.status === 'completed'
                      ),
                      onAssign: (task: Task) => updateTask(task.id, { sectionId: sec.id }),
                    }))
                  : [
                      {
                        id: 'col-todo',
                        title: 'To Do',
                        activeItems: filteredTasks.filter((t) => t.status === 'todo'),
                        completedItems: [] as Task[],
                        onAssign: (task: Task) => updateTask(task.id, { status: 'todo' }),
                      },
                      {
                        id: 'col-progress',
                        title: 'In Progress',
                        activeItems: filteredTasks.filter((t) => t.status === 'in_progress'),
                        completedItems: [] as Task[],
                        onAssign: (task: Task) => updateTask(task.id, { status: 'in_progress' }),
                      },
                      {
                        id: 'col-done',
                        title: 'Completed',
                        activeItems: filteredTasks.filter((t) => t.status === 'completed'),
                        completedItems: [] as Task[],
                        onAssign: (task: Task) =>
                          updateTask(task.id, {
                            status: 'completed',
                            completedAt: new Date().toISOString(),
                          }),
                      },
                    ];

              const renderKanbanCard = (task: Task, colIdx: number) => {
                const isDone = task.status === 'completed';
                return (
                  <div
                    key={task.id}
                    onClick={(e) => {
          e.stopPropagation();
          setSelectedTaskId(task.id);
        }}
                    className={`p-3 rounded-lg bg-white border cursor-pointer ${
                      selectedTaskId === task.id
                        ? 'border-zinc-900 ring-1 ring-zinc-900/10'
                        : 'border-zinc-200/80 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTaskStatus(task.id);
                          }}
                          className={`mt-0.5 w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center shrink-0 ${
                            isDone
                              ? 'bg-zinc-400 border-zinc-400 text-white'
                              : PRIORITY_BORDER[task.priority]
                          }`}
                        >
                          {isDone && <Check className="w-2.5 h-2.5 stroke-[2.5]" />}
                        </button>
                        <span
                          className={`text-xs font-medium ${
                            isDone ? 'text-zinc-400' : 'text-zinc-900'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
                          PRIORITY_BADGE[task.priority].color
                        }`}
                      >
                        {PRIORITY_BADGE[task.priority].label}
                      </span>
                    </div>

                    {task.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {task.tags.map((tg) => (
                          <span
                            key={tg}
                            className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600"
                          >
                            #{tg}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-100 text-[10px] font-mono-num text-zinc-400">
                      <span>{task.dueDate || 'No due date'}</span>
                      <div className="flex items-center gap-1">
                        {colIdx > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              columns[colIdx - 1].onAssign(task);
                            }}
                            className="p-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-600"
                            title={`Move to ${columns[colIdx - 1].title}`}
                          >
                            <ArrowLeft className="w-3 h-3" strokeWidth={1.75} />
                          </button>
                        )}
                        {colIdx < columns.length - 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              columns[colIdx + 1].onAssign(task);
                            }}
                            className="p-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-600"
                            title={`Move to ${columns[colIdx + 1].title}`}
                          >
                            <ArrowRight className="w-3 h-3" strokeWidth={1.75} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              };

              return (
                <>
                  {columns.map((col, colIdx) => (
                    <div
                      key={col.id}
                      className="w-[82vw] sm:w-72 snap-center shrink-0 bg-zinc-100/70 rounded-xl p-3 flex flex-col max-h-full border border-zinc-200/80"
                    >
                      <div className="flex items-center justify-between mb-2.5 px-1">
                        <span className="text-xs font-semibold text-zinc-800">{col.title}</span>
                        <span className="text-[11px] font-mono-num px-1.5 py-0.5 rounded-md bg-white text-zinc-500 border border-zinc-200/70">
                          {col.activeItems.length + col.completedItems.length}
                        </span>
                      </div>

                      <div className="space-y-2 overflow-y-auto flex-1 pr-0.5">
                        {col.activeItems.map((task) => renderKanbanCard(task, colIdx))}

                        {col.completedItems.length > 0 && (
                          <div className="pt-2 border-t border-zinc-200/70 space-y-1.5">
                            <div className="text-[10px] font-semibold text-zinc-500 px-1 flex items-center gap-1">
                              <ChevronDown className="w-3 h-3" />
                              Completed {col.completedItems.length}
                            </div>
                            {col.completedItems.map((task) => renderKanbanCard(task, colIdx))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {activeList && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (newColumnName.trim()) {
                          addSection(activeList.id, newColumnName);
                          setNewColumnName('');
                        }
                      }}
                      className="w-64 shrink-0 bg-zinc-50/70 border border-dashed border-zinc-300 rounded-xl p-3"
                    >
                      <input
                        type="text"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        placeholder="+ Add Kanban Section..."
                        className="w-full text-xs bg-transparent focus:outline-none text-zinc-700"
                      />
                    </form>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {viewMode === 'timeline' && (
          <div className="surface-card rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GanttChart className="w-4 h-4 text-zinc-700" strokeWidth={1.75} />
                <span className="text-xs font-semibold text-zinc-900">
                  Timeline Duration View
                </span>
              </div>
              <span className="text-[11px] text-zinc-500">
                Click +1d on any bar to extend task duration
              </span>
            </div>

            {(() => {
              const days = Array.from({ length: 10 }, (_, i) => addDays(today, i - 1));
              const renderTimelineRow = (task: Task) => {
                const isDone = task.status === 'completed';
                const sDate = task.startDate ? parseISO(task.startDate) : today;
                const eDate = task.dueDate ? parseISO(task.dueDate) : sDate;
                const startOffset = Math.max(
                  0,
                  Math.min(9, differenceInCalendarDays(sDate, days[0]))
                );
                const endOffset = Math.max(
                  startOffset,
                  Math.min(9, differenceInCalendarDays(eDate, days[0]))
                );
                const spanCols = endOffset - startOffset + 1;

                return (
                  <div
                    key={task.id}
                    onClick={(e) => {
          e.stopPropagation();
          setSelectedTaskId(task.id);
        }}
                    className="grid grid-cols-[240px_repeat(10,minmax(56px,1fr))] border-b border-zinc-100 items-center hover:bg-zinc-50/70 cursor-pointer"
                  >
                    <div className="px-3 py-2.5 border-r border-zinc-200/80 flex items-center justify-between gap-2 truncate">
                      <span
                        className={`text-xs font-medium truncate ${
                          isDone ? 'text-zinc-400' : 'text-zinc-800'
                        }`}
                      >
                        {task.title}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextDue = format(addDays(eDate, 1), 'yyyy-MM-dd');
                            updateTask(task.id, {
                              startDate: format(sDate, 'yyyy-MM-dd'),
                              dueDate: nextDue,
                            });
                          }}
                          title="Extend duration +1 day"
                          className="px-1.5 py-0.5 text-[10px] font-mono-num rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                        >
                          +1d
                        </button>
                      </div>
                    </div>

                    <div className="col-span-10 grid grid-cols-10 items-center py-2 px-1 relative">
                      <div
                        style={{
                          gridColumnStart: startOffset + 1,
                          gridColumnEnd: startOffset + 1 + spanCols,
                        }}
                        className={`h-6 rounded-md px-2 flex items-center justify-between text-[10px] font-medium text-white ${
                          isDone
                            ? 'bg-zinc-400'
                            : task.priority === 5
                              ? 'bg-rose-600'
                              : task.priority === 3
                                ? 'bg-amber-600'
                                : 'bg-zinc-900'
                        }`}
                      >
                        <span className="truncate">{task.title}</span>
                        {task.durationMinutes && (
                          <span className="font-mono-num ml-1 opacity-80">
                            {task.durationMinutes}m
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              };

              return (
                <div className="overflow-x-auto">
                  <div className="min-w-[820px]">
                    {/* Timeline Header Row */}
                    <div className="grid grid-cols-[240px_repeat(10,minmax(56px,1fr))] border-b border-zinc-200/80 bg-zinc-50/60 text-[11px] font-semibold text-zinc-600">
                      <div className="px-3 py-2 border-r border-zinc-200/80">Task & Duration</div>
                      {days.map((d) => {
                        const dStr = format(d, 'yyyy-MM-dd');
                        const isTodayCol = dStr === todayStr;
                        return (
                          <div
                            key={dStr}
                            className={`px-1.5 py-2 text-center border-r border-zinc-100 ${
                              isTodayCol ? 'bg-zinc-900 text-white font-semibold' : ''
                            }`}
                          >
                            <div>{format(d, 'EEE')}</div>
                            <div className="font-mono-num text-[10px] opacity-80">
                              {format(d, 'MMM d')}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Active Timeline Task Rows */}
                    {[...pinnedTasks, ...openTasks].map(renderTimelineRow)}

                    {/* Completed Timeline Section */}
                    {doneTasks.length > 0 && (
                      <>
                        <div
                          onClick={() => setIsCompletedCollapsed((v) => !v)}
                          className="px-3 py-2 bg-zinc-50 border-b border-zinc-200/70 text-xs font-semibold text-zinc-600 flex items-center gap-1.5 cursor-pointer"
                        >
                          {isCompletedCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                          )}
                          <span>Completed</span>
                          <span className="text-[11px] font-mono-num text-zinc-400">
                            {doneTasks.length}
                          </span>
                        </div>
                        {!isCompletedCollapsed && doneTasks.map(renderTimelineRow)}
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </main>
  );
};
