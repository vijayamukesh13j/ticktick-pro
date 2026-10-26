import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity,
  Bell,
  BellRing,
  BookmarkPlus,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Flag,
  FolderInput,
  Hash,
  Mail,
  MapPin,
  MessageSquare,
  Paperclip,
  Play,
  Plus,
  Repeat,
  Save,
  Timer,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Priority, Task } from '../types';
import { parseNaturalLanguageTask } from '../utils/nlpParser';

interface TaskDraft {
  title: string;
  content: string;
  priority: Priority;
  listId: string;
  startDate: string;
  dueDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number | '';
  estimatedPomos: number;
  recurrenceRule: string;
  assignee: string;
  reminders: string[];
  constantReminder: boolean;
  emailReminder: boolean;
  locationReminder: string;
  tags: string[];
  isNote: boolean;
}

const getInitialDraft = (t: Task): TaskDraft => ({
  title: t.title ?? '',
  content: t.content ?? '',
  priority: t.priority ?? 0,
  listId: t.listId ?? 'inbox',
  startDate: t.startDate ?? '',
  dueDate: t.dueDate ?? '',
  startTime: t.startTime ?? '',
  endTime: t.endTime ?? '',
  durationMinutes: t.durationMinutes ?? '',
  estimatedPomos: t.estimatedPomos ?? 0,
  recurrenceRule: t.recurrenceRule ?? '',
  assignee: t.assignee ?? '',
  reminders: t.reminders ? [...t.reminders] : [],
  constantReminder: !!t.constantReminder,
  emailReminder: !!t.emailReminder,
  locationReminder: t.locationReminder ?? '',
  tags: t.tags ? [...t.tags] : [],
  isNote: !!t.isNote,
});

export const TaskDetailPane: React.FC = () => {
  const {
    tasks,
    lists,
    tags,
    addList,
    addTag,
    selectedTaskId,
    setSelectedTaskId,
    updateTask,
    toggleTaskStatus,
    deleteTask,
    duplicateTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    addTaskComment,
    addTaskAttachment,
    saveTaskAsTemplate,
    rightPaneWidth,
    setRightPaneWidth,
    triggerTaskReminderNow,
    requestNotificationPermission,
    notificationPermission,
    preferences,
    startTaskFocus,
  } = useApp();

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [showAttachForm, setShowAttachForm] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'comments' | 'activity'>('comments');
  const [templateSavedBanner, setTemplateSavedBanner] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isSubtasksCompletedCollapsed, setIsSubtasksCompletedCollapsed] = useState(false);
  const [showFocusMenu, setShowFocusMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [tagSearchInput, setTagSearchInput] = useState('');
  const [newListInput, setNewListInput] = useState('');
  const [titleAutoIndex, setTitleAutoIndex] = useState(0);
  const [titleAutoDismissed, setTitleAutoDismissed] = useState(false);
  const [titleAutoNavigated, setTitleAutoNavigated] = useState(false);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isSavedNotice, setIsSavedNotice] = useState(false);
  const priorityMenuRef = useRef<HTMLDivElement>(null);

  // Close priority dropdown on click outside
  useEffect(() => {
    if (!showPriorityMenu) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        priorityMenuRef.current &&
        !priorityMenuRef.current.contains(e.target as Node)
      ) {
        setShowPriorityMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showPriorityMenu]);

  const task = tasks.find((t) => t.id === selectedTaskId);

  // Synchronize draft when task changes or when recurring occurrence advances dates
  useEffect(() => {
    if (task) {
      setDraft(getInitialDraft(task));
      setActiveTaskId(task.id);
      setIsSavedNotice(false);
      setTitleAutoDismissed(true);
      setTitleAutoNavigated(false);
    } else {
      setDraft(null);
      setActiveTaskId(null);
    }
  }, [
    task?.id,
    task?.dueDate,
    task?.startDate,
    task?.recurrenceRule,
    task?.status,
  ]);

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = rightPaneWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      setRightPaneWidth(startWidth + delta);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const currentDraft = draft && task && activeTaskId === task.id ? draft : task ? getInitialDraft(task) : null;

  // Autocomplete for Lists & Tags (and creating new tags/lists) while editing the task name in the sidebar
  const titleAutocompleteData = useMemo(() => {
    if (titleAutoDismissed || !currentDraft || !task) return null;
    if (currentDraft.title === task.title) return null;

    const trailingMatch = currentDraft.title.match(/(?:^|\s)([^\s]+)$/);
    if (!trailingMatch) return null;

    const rawToken = trailingMatch[1];
    const tokenStartIndex = currentDraft.title.length - rawToken.length;
    const isExplicitTag = rawToken.startsWith('#');
    const isExplicitList = rawToken.startsWith('~') || rawToken.startsWith('^');
    const rawClean = rawToken.replace(/^[#~^]+/, '');
    const cleanQuery = rawClean.toLowerCase();

    if (!isExplicitTag && !isExplicitList && cleanQuery.length < 2) {
      return null;
    }

    type TitleSuggestionItem = {
      kind: 'list' | 'tag' | 'create-tag' | 'create-list';
      id: string;
      name: string;
      color: string;
    };

    const items: TitleSuggestionItem[] = [];

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
      if (
        isExplicitList &&
        rawClean.length >= 1 &&
        !lists.some((l) => l.name.toLowerCase() === cleanQuery)
      ) {
        items.push({
          kind: 'create-list',
          id: `new-list-${cleanQuery}`,
          name: rawClean,
          color: '#2563eb',
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
      if (
        isExplicitTag &&
        cleanQuery.length >= 1 &&
        !tags.some((t) => t.name.toLowerCase() === cleanQuery)
      ) {
        items.push({
          kind: 'create-tag',
          id: `new-tag-${cleanQuery}`,
          name: cleanQuery,
          color: '#2563eb',
        });
      }
    }

    if (items.length === 0) return null;

    return {
      rawToken,
      tokenStartIndex,
      items,
    };
  }, [currentDraft, task, lists, tags, titleAutoDismissed]);

  const applyTitleAutocomplete = (item: {
    kind: 'list' | 'tag' | 'create-tag' | 'create-list';
    id: string;
    name: string;
    color: string;
  }) => {
    if (!titleAutocompleteData || !currentDraft || !task) return;
    const cleanedTitle = currentDraft.title
      .slice(0, titleAutocompleteData.tokenStartIndex)
      .trimEnd();

    if (item.kind === 'list') {
      setDraft((d) => ({
        ...(d || getInitialDraft(task)),
        title: cleanedTitle || currentDraft.title,
        listId: item.id,
      }));
    } else if (item.kind === 'create-list') {
      const created = addList(item.name, item.color);
      setDraft((d) => ({
        ...(d || getInitialDraft(task)),
        title: cleanedTitle || currentDraft.title,
        listId: created.id,
      }));
    } else if (item.kind === 'tag') {
      setDraft((d) => {
        const base = d || getInitialDraft(task);
        const nextTags = base.tags.includes(item.name)
          ? base.tags
          : [...base.tags, item.name];
        return {
          ...base,
          title: cleanedTitle || currentDraft.title,
          tags: nextTags,
        };
      });
    } else if (item.kind === 'create-tag') {
      addTag(item.name, item.color);
      setDraft((d) => {
        const base = d || getInitialDraft(task);
        const nextTags = base.tags.includes(item.name)
          ? base.tags
          : [...base.tags, item.name];
        return {
          ...base,
          title: cleanedTitle || currentDraft.title,
          tags: nextTags,
        };
      });
    }
    setTitleAutoIndex(0);
    setTitleAutoDismissed(true);
    setTitleAutoNavigated(false);
  };

  const isDirty = Boolean(
    task &&
      currentDraft &&
      (currentDraft.title !== (task.title ?? '') ||
        currentDraft.content !== (task.content ?? '') ||
        currentDraft.priority !== (task.priority ?? 0) ||
        currentDraft.listId !== (task.listId ?? 'inbox') ||
        currentDraft.startDate !== (task.startDate ?? '') ||
        currentDraft.dueDate !== (task.dueDate ?? '') ||
        currentDraft.startTime !== (task.startTime ?? '') ||
        currentDraft.endTime !== (task.endTime ?? '') ||
        currentDraft.durationMinutes !== (task.durationMinutes ?? '') ||
        currentDraft.estimatedPomos !== (task.estimatedPomos ?? 0) ||
        currentDraft.recurrenceRule !== (task.recurrenceRule ?? '') ||
        currentDraft.assignee !== (task.assignee ?? '') ||
        currentDraft.constantReminder !== !!task.constantReminder ||
        currentDraft.emailReminder !== !!task.emailReminder ||
        currentDraft.locationReminder !== (task.locationReminder ?? '') ||
        currentDraft.isNote !== !!task.isNote ||
        currentDraft.reminders.length !== (task.reminders || []).length ||
        !currentDraft.reminders.every((r, idx) => r === (task.reminders || [])[idx]) ||
        currentDraft.tags.length !== (task.tags || []).length ||
        !currentDraft.tags.every((tg, idx) => tg === (task.tags || [])[idx]))
  );

  const handleSave = () => {
    if (!task || !currentDraft) return;
    const todayLocalStr = new Date().toLocaleDateString('en-CA');
    const resolvedDueDate =
      currentDraft.dueDate || (currentDraft.recurrenceRule ? todayLocalStr : undefined);
    const resolvedStartDate =
      currentDraft.startDate || (currentDraft.recurrenceRule ? resolvedDueDate : undefined);

    // Parse edited title for any inline #tags or ~listName so editing a saved task name can also assign lists or new tags!
    const parsedFromTitle = parseNaturalLanguageTask(currentDraft.title);
    let resolvedTitle = currentDraft.title.trim() || 'Untitled Task';
    let resolvedListId = currentDraft.listId;
    let resolvedTags = [...currentDraft.tags];

    if (parsedFromTitle.tags.length > 0 || parsedFromTitle.listName) {
      resolvedTitle = parsedFromTitle.cleanTitle || resolvedTitle;
    }

    if (parsedFromTitle.tags.length > 0) {
      parsedFromTitle.tags.forEach((tg) => {
        const cleanTg = tg.toLowerCase();
        if (!tags.some((existing) => existing.name.toLowerCase() === cleanTg)) {
          addTag(cleanTg, '#2563eb');
        }
        if (!resolvedTags.includes(cleanTg)) {
          resolvedTags.push(cleanTg);
        }
      });
    }

    if (parsedFromTitle.listName) {
      const matchedList = lists.find((l) =>
        l.name.toLowerCase().includes(parsedFromTitle.listName!.toLowerCase())
      );
      if (matchedList) {
        resolvedListId = matchedList.id;
      } else {
        const createdList = addList(parsedFromTitle.listName, '#2563eb');
        resolvedListId = createdList.id;
      }
    }

    setDraft((d) => ({
      ...(d || getInitialDraft(task)),
      title: resolvedTitle,
      listId: resolvedListId,
      tags: resolvedTags,
    }));

    updateTask(
      task.id,
      {
        title: resolvedTitle,
        content: currentDraft.content,
        priority: currentDraft.priority,
        listId: resolvedListId,
        startDate: resolvedStartDate,
        dueDate: resolvedDueDate,
        startTime: currentDraft.startTime || undefined,
        endTime: currentDraft.endTime || undefined,
        isAllDay: !currentDraft.startTime,
        durationMinutes:
          currentDraft.durationMinutes === ''
            ? undefined
            : Number(currentDraft.durationMinutes),
        estimatedPomos: currentDraft.estimatedPomos,
        recurrenceRule: currentDraft.recurrenceRule || undefined,
        assignee: currentDraft.assignee || undefined,
        reminders: currentDraft.reminders,
        constantReminder: currentDraft.constantReminder,
        emailReminder: currentDraft.emailReminder,
        locationReminder: currentDraft.locationReminder || undefined,
        tags: resolvedTags,
        isNote: currentDraft.isNote,
      },
      'Saved task changes'
    );
    setTitleAutoDismissed(true);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  const handleDiscard = () => {
    if (task) {
      setDraft(getInitialDraft(task));
    }
  };

  const handleStartFocus = (mode: 'pomo' | 'stopwatch') => {
    if (!task) return;
    if (isDirty) {
      handleSave();
    }
    setShowFocusMenu(false);
    startTaskFocus(task.id, mode);
  };

  // Keyboard shortcut: Ctrl+S / Cmd+S to save, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        setSelectedTaskId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // If no task selected, completely hide inspector
  if (!task || !currentDraft) {
    return null;
  }

  const isDone = task.status === 'completed';

  const focusButtonLabel =
    task.estimatedPomos > 0
      ? `Focus (${task.completedPomos}/${task.estimatedPomos} Pomo)`
      : task.completedPomos > 0
        ? `Focus (${task.completedPomos} Pomo done)`
        : 'Start Focus';

  return (
    <>
      {/* Mobile & Tablet Backdrop (<1024px) */}
      <div
        onClick={() => setSelectedTaskId(null)}
        className="lg:hidden fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px] animate-backdrop"
      />

      <aside
        aria-label="Task Detail Inspector"
        onTouchStart={(e) => {
          if (e.touches.length === 1) {
            (e.currentTarget as HTMLElement).dataset.touchX = String(e.touches[0].clientX);
            (e.currentTarget as HTMLElement).dataset.touchY = String(e.touches[0].clientY);
          }
        }}
        onTouchEnd={(e) => {
          const el = e.currentTarget as HTMLElement;
          const startX = Number(el.dataset.touchX || 0);
          const startY = Number(el.dataset.touchY || 0);
          if (!startX && !startY) return;
          const endX = e.changedTouches[0]?.clientX ?? startX;
          const endY = e.changedTouches[0]?.clientY ?? startY;
          const deltaX = endX - startX;
          const deltaY = endY - startY;
          // Swipe right from left side (Go Back) or swipe down from top header to dismiss on mobile
          if (
            (deltaX > 65 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4 && startX <= 120) ||
            (deltaY > 75 && Math.abs(deltaY) > Math.abs(deltaX) * 1.4 && startY <= 120)
          ) {
            setSelectedTaskId(null);
          }
        }}
        style={{ '--right-pane-width': `${rightPaneWidth}px` } as React.CSSProperties}
        className="fixed inset-x-0 bottom-0 top-6 sm:top-10 z-50 rounded-t-2xl shadow-2xl bg-white flex flex-col overflow-hidden animate-sheet-up lg:static lg:top-auto lg:z-10 lg:w-[var(--right-pane-width)] lg:h-full lg:rounded-none lg:shadow-none lg:border-t-0 lg:border-l border-zinc-200/80 lg:animate-inspector-in"
      >
        {/* Mobile Top Drag Pill Handle */}
        <div
          onClick={() => setSelectedTaskId(null)}
          className="lg:hidden w-full pt-2 pb-0.5 flex items-center justify-center bg-white shrink-0 cursor-pointer"
        >
          <span className="w-9 h-1 rounded-full bg-zinc-300/80" />
        </div>
        {/* PC Left-Edge Drag Resize Handle */}
        <div
          onMouseDown={handleMouseDownResize}
          title="Drag to resize right inspector (280px – 680px)"
          aria-label="Resize Right Inspector"
          className="hidden lg:flex absolute inset-y-0 left-0 w-2 cursor-col-resize items-center justify-center group z-20 hover:bg-blue-500/10"
        >
          <div
            className={`w-[2px] h-10 rounded-full transition-colors ${
              isResizing ? 'bg-blue-600' : 'bg-transparent group-hover:bg-zinc-400'
            }`}
          />
        </div>

        {/* Header: Status, List, Priority, Save button & Close button (No overlapping) */}
        <div className="min-h-12 px-3 border-b border-zinc-200/80 flex items-center justify-between gap-1.5 shrink-0 bg-white relative z-20">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
            {/* Status Checkbox */}
            <button
              type="button"
              aria-label={`Mark as ${isDone ? 'incomplete' : 'completed'}`}
              onClick={() => toggleTaskStatus(task.id)}
              className={`w-4 h-4 rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0 ${
                isDone
                  ? 'bg-zinc-400 border-zinc-400 text-white'
                  : 'border-zinc-400 hover:border-zinc-700'
              }`}
            >
              {isDone && <Check className="w-2.5 h-2.5 stroke-[2.75] animate-check" />}
            </button>

            {/* List Selector with safe shrink and truncation */}
            <select
              aria-label="Task List"
              value={currentDraft.listId}
              onChange={(e) => {
                const nextListId = e.target.value;
                setDraft((d) => ({
                  ...(d || getInitialDraft(task)),
                  listId: nextListId,
                }));
                updateTask(task.id, { listId: nextListId }, 'Moved task to list');
              }}
              className="text-xs font-medium text-zinc-700 bg-zinc-100 px-2 py-1 rounded-md border border-zinc-200/70 focus:outline-none min-w-0 max-w-[130px] flex-shrink truncate cursor-pointer hover:bg-zinc-200/60 transition-colors"
            >
              <option value="inbox">Inbox</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Right Side: Compact Priority Selector + Save Button + Close Button (Never overlaps) */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Priority Selector with dropdown menu */}
            <div className="relative" ref={priorityMenuRef}>
              <button
                type="button"
                onClick={() => setShowPriorityMenu((prev) => !prev)}
                title={`Priority: ${
                  currentDraft.priority === 5
                    ? 'High'
                    : currentDraft.priority === 3
                      ? 'Medium'
                      : currentDraft.priority === 1
                        ? 'Low'
                        : 'None'
                }`}
                aria-label="Task Priority"
                className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                  currentDraft.priority === 5
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : currentDraft.priority === 3
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : currentDraft.priority === 1
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <Flag
                  strokeWidth={1.75}
                  className={`w-3.5 h-3.5 ${
                    currentDraft.priority === 5
                      ? 'text-rose-500 fill-rose-500'
                      : currentDraft.priority === 3
                        ? 'text-amber-500 fill-amber-500'
                        : currentDraft.priority === 1
                          ? 'text-blue-500 fill-blue-500'
                          : 'text-zinc-400'
                  }`}
                />
                <span className="font-mono-num text-[11px]">P{currentDraft.priority}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>

              {showPriorityMenu && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-36 surface-floating bg-white rounded-xl p-1 shadow-xl border border-zinc-200/90 space-y-0.5 animate-popover origin-top-right">
                  {(
                    [
                      { p: 5, label: 'High Priority', color: 'text-rose-500 fill-rose-500' },
                      { p: 3, label: 'Medium', color: 'text-amber-500 fill-amber-500' },
                      { p: 1, label: 'Low Priority', color: 'text-blue-500 fill-blue-500' },
                      { p: 0, label: 'No Priority', color: 'text-zinc-400' },
                    ] as const
                  ).map(({ p, label, color }) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setDraft((d) => ({
                          ...(d || getInitialDraft(task)),
                          priority: p,
                        }));
                        setShowPriorityMenu(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 ${
                        currentDraft.priority === p
                          ? 'bg-zinc-100 font-semibold text-zinc-900'
                          : 'text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      <Flag className={`w-3.5 h-3.5 ${color}`} strokeWidth={1.75} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Prominent Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty && !isSavedNotice}
              title={
                isSavedNotice
                  ? 'Changes saved!'
                  : isDirty
                    ? 'Save changes (Ctrl+S)'
                    : 'No unsaved changes'
              }
              aria-label="Save Task Changes"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all shrink-0 ${
                isSavedNotice
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : isDirty
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                    : 'bg-zinc-100 text-zinc-400 cursor-default'
              }`}
            >
              {isSavedNotice ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save</span>
                  {isDirty && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-ping" />
                  )}
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedTaskId(null)}
              title="Close Detail Pane (Esc)"
              aria-label="Close Detail Pane"
              className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 bg-zinc-50 border border-zinc-200/80 ml-0.5 shrink-0"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Scrollable Inspector Body with mobile safe-area */}
        <div className="flex-1 overflow-y-auto p-4 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] space-y-5">
          {/* Title & Focus Pomo Button */}
          <div className="space-y-2.5">
            <div className="relative">
              <input
                type="text"
                value={currentDraft.title}
                onChange={(e) => {
                  setDraft((d) => ({
                    ...(d || getInitialDraft(task)),
                    title: e.target.value,
                  }));
                  setTitleAutoIndex(0);
                  setTitleAutoDismissed(false);
                  setTitleAutoNavigated(false);
                }}
                onKeyDown={(e) => {
                  if (titleAutocompleteData && titleAutocompleteData.items.length > 0) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setTitleAutoNavigated(true);
                      setTitleAutoIndex(
                        (prev) => (prev + 1) % titleAutocompleteData.items.length
                      );
                      return;
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setTitleAutoNavigated(true);
                      setTitleAutoIndex(
                        (prev) =>
                          (prev - 1 + titleAutocompleteData.items.length) %
                          titleAutocompleteData.items.length
                      );
                      return;
                    } else if (e.key === 'Tab') {
                      e.preventDefault();
                      const chosen =
                        titleAutocompleteData.items[titleAutoIndex] ||
                        titleAutocompleteData.items[0];
                      if (chosen) applyTitleAutocomplete(chosen);
                      return;
                    } else if (e.key === 'Enter' && titleAutoNavigated) {
                      e.preventDefault();
                      const chosen =
                        titleAutocompleteData.items[titleAutoIndex] ||
                        titleAutocompleteData.items[0];
                      if (chosen) applyTitleAutocomplete(chosen);
                      return;
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setTitleAutoDismissed(true);
                      setTitleAutoNavigated(false);
                      return;
                    }
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                placeholder="Task name... (type #tag or ~list to assign)"
                className={`w-full text-sm font-semibold focus:outline-none tracking-tight ${
                  isDone ? 'text-zinc-400' : 'text-zinc-900'
                }`}
              />
              <div className="text-[10px] text-zinc-400 mt-0.5">
                Tip: Type <span className="font-mono">#tag</span> or <span className="font-mono">~list</span> in the name to assign or create lists & tags
              </div>

              {/* Sidebar Task Name Autocomplete Dropdown for Lists & Tags */}
              {titleAutocompleteData && titleAutocompleteData.items.length > 0 && (
                <div
                  data-testid="detail-title-autocomplete"
                  className="absolute left-0 right-0 top-full mt-1 surface-floating bg-white rounded-xl border border-zinc-200/90 shadow-xl p-1.5 z-40 animate-popover"
                >
                  <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-100 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Assign List or Tag
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono-num">
                      Tab / Click
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {titleAutocompleteData.items.map((item, idx) => {
                      const isHighlighted = idx === titleAutoIndex;
                      return (
                        <button
                          key={`${item.kind}-${item.id}`}
                          type="button"
                          data-testid={`detail-autocomplete-${item.kind}-${item.name}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyTitleAutocomplete(item);
                          }}
                          onMouseEnter={() => setTitleAutoIndex(idx)}
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
                              {item.kind === 'tag'
                                ? `#${item.name}`
                                : item.kind === 'create-tag'
                                  ? `+ Create & assign tag "#${item.name}"`
                                  : item.kind === 'create-list'
                                    ? `+ Create & move to list "${item.name}"`
                                    : item.name}
                            </span>
                          </span>
                          <span
                            className={`text-[10px] font-mono-num px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                              isHighlighted
                                ? 'bg-white/15 text-zinc-200'
                                : 'bg-zinc-100 text-zinc-500'
                            }`}
                          >
                            {item.kind === 'list' || item.kind === 'create-list'
                              ? 'List'
                              : 'Tag'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowFocusMenu((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-zinc-900 text-white hover:bg-zinc-800 font-mono-num transition-colors shadow-2xs"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{focusButtonLabel}</span>
                  <ChevronDown
                    className={`w-3 h-3 text-zinc-300 transition-transform ${
                      showFocusMenu ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {showFocusMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowFocusMenu(false)}
                    />
                    <div className="absolute left-0 top-full mt-1.5 z-50 w-72 sm:w-80 rounded-xl bg-white shadow-xl border border-zinc-200/90 p-3 space-y-2.5 animate-sheet-up">
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                        <div className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
                          <Timer className="w-3.5 h-3.5 text-zinc-600" />
                          <span>Choose Focus Mode</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowFocusMenu(false)}
                          className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {/* Pomodoro Mode Card */}
                        <button
                          type="button"
                          onClick={() => handleStartFocus('pomo')}
                          className="w-full text-left p-2.5 rounded-lg border border-zinc-200/80 hover:border-zinc-900 hover:bg-zinc-50 transition-all flex items-start gap-2.5 group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200/80 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Timer className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-zinc-900">
                                Pomodoro Timer
                              </span>
                              <span className="text-[10px] font-mono-num font-semibold text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded">
                                {preferences.pomoDuration}m
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
                              Countdown interval with automatic rest breaks.
                            </p>
                            {task.estimatedPomos > 0 && (
                              <div className="text-[10px] text-zinc-400 mt-1 font-mono-num">
                                Target: {task.completedPomos}/{task.estimatedPomos} completed
                              </div>
                            )}
                          </div>
                        </button>

                        {/* Stopwatch Mode Card */}
                        <button
                          type="button"
                          onClick={() => handleStartFocus('stopwatch')}
                          className="w-full text-left p-2.5 rounded-lg border border-zinc-200/80 hover:border-zinc-900 hover:bg-zinc-50 transition-all flex items-start gap-2.5 group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-zinc-900">
                                Stopwatch
                              </span>
                              <span className="text-[10px] font-mono-num font-semibold text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded">
                                Count-up
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
                              Open-ended tracking from 00:00 without countdown pressure.
                            </p>
                          </div>
                        </button>
                      </div>

                      {/* Quick Estimated Pomos Configuration */}
                      <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                        <div className="text-[11px] text-zinc-600">
                          <span className="font-medium">Estimated Pomos:</span>
                          <span className="text-[10px] text-zinc-400 block">
                            0 = No target set
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((d) => ({
                                ...(d || getInitialDraft(task)),
                                estimatedPomos: Math.max(0, currentDraft.estimatedPomos - 1),
                              }))
                            }
                            className="w-6 h-6 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100 flex items-center justify-center text-xs font-bold"
                          >
                            -
                          </button>
                          <span className="w-6 text-center text-xs font-bold font-mono-num text-zinc-900">
                            {currentDraft.estimatedPomos}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((d) => ({
                                ...(d || getInitialDraft(task)),
                                estimatedPomos: currentDraft.estimatedPomos + 1,
                              }))
                            }
                            className="w-6 h-6 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100 flex items-center justify-center text-xs font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...(d || getInitialDraft(task)),
                    isNote: !currentDraft.isNote,
                  }))
                }
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200/70"
              >
                <FileText className="w-3 h-3" strokeWidth={1.75} />
                {currentDraft.isNote ? 'Switch to Task' : 'Convert to Note'}
              </button>

              <button
                type="button"
                onClick={() => {
                  saveTaskAsTemplate(task.id);
                  setTemplateSavedBanner(true);
                  setTimeout(() => setTemplateSavedBanner(false), 2000);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200/70"
              >
                <BookmarkPlus className="w-3 h-3" strokeWidth={1.75} />
                {templateSavedBanner ? 'Saved Template' : 'Save Template'}
              </button>
            </div>
          </div>

          {/* Schedule, Duration & Recurrence Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-zinc-50/80 border border-zinc-200/80 text-xs">
            <div>
              <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                <Calendar className="w-3 h-3" strokeWidth={1.75} /> Start Date
              </label>
              <input
                type="date"
                value={currentDraft.startDate}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...(d || getInitialDraft(task)),
                    startDate: e.target.value,
                  }))
                }
                className="w-full px-2 py-1 rounded-md border border-zinc-200/90 bg-white text-xs font-mono-num"
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                <Calendar className="w-3 h-3" strokeWidth={1.75} /> Due Date
              </label>
              <input
                type="date"
                value={currentDraft.dueDate}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...(d || getInitialDraft(task)),
                    dueDate: e.target.value,
                  }))
                }
                className="w-full px-2 py-1 rounded-md border border-zinc-200/90 bg-white text-xs font-mono-num"
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                <Clock className="w-3 h-3" strokeWidth={1.75} /> Start Time
              </label>
              <input
                type="time"
                value={currentDraft.startTime}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...(d || getInitialDraft(task)),
                    startTime: e.target.value,
                  }))
                }
                className="w-full px-2 py-1 rounded-md border border-zinc-200/90 bg-white text-xs font-mono-num"
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                <Clock className="w-3 h-3" strokeWidth={1.75} /> Duration (Mins)
              </label>
              <input
                type="number"
                min={5}
                step={5}
                value={currentDraft.durationMinutes}
                placeholder="e.g. 60"
                onChange={(e) =>
                  setDraft((d) => ({
                    ...(d || getInitialDraft(task)),
                    durationMinutes: e.target.value ? Number(e.target.value) : '',
                  }))
                }
                className="w-full px-2 py-1 rounded-md border border-zinc-200/90 bg-white text-xs font-mono-num"
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                <Timer className="w-3 h-3" strokeWidth={1.75} /> Est. Pomodoros
              </label>
              <input
                type="number"
                min={0}
                max={99}
                value={currentDraft.estimatedPomos || ''}
                placeholder="0 (None)"
                onChange={(e) =>
                  setDraft((d) => ({
                    ...(d || getInitialDraft(task)),
                    estimatedPomos: Math.max(0, parseInt(e.target.value, 10) || 0),
                  }))
                }
                className="w-full px-2 py-1 rounded-md border border-zinc-200/90 bg-white text-xs font-mono-num"
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                <Repeat className="w-3 h-3" strokeWidth={1.75} /> Repeat Rule
              </label>
              <select
                value={currentDraft.recurrenceRule}
                onChange={(e) => {
                  const nextRule = e.target.value;
                  const todayLocalStr = new Date().toLocaleDateString('en-CA');
                  setDraft((d) => {
                    const base = d || getInitialDraft(task);
                    return {
                      ...base,
                      recurrenceRule: nextRule,
                      dueDate: base.dueDate || (nextRule ? todayLocalStr : base.dueDate),
                      startDate: base.startDate || (nextRule ? base.dueDate || todayLocalStr : base.startDate),
                    };
                  });
                }}
                className="w-full px-2 py-1 rounded-md border border-zinc-200/90 bg-white text-xs"
              >
                <option value="">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Every Weekday (Mon-Fri)</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                <User className="w-3 h-3" strokeWidth={1.75} /> Assignee
              </label>
              <input
                type="text"
                value={currentDraft.assignee}
                placeholder="Assign member..."
                onChange={(e) =>
                  setDraft((d) => ({
                    ...(d || getInitialDraft(task)),
                    assignee: e.target.value,
                  }))
                }
                className="w-full px-2 py-1 rounded-md border border-zinc-200/90 bg-white text-xs"
              />
            </div>
          </div>

          {/* Reminders Block (Configurable Offsets, Constant Alert, Test & OS Permissions) */}
          <div className="p-3.5 rounded-xl bg-zinc-50/80 border border-zinc-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-700 flex items-center gap-1.5 font-mono-num">
                <Bell className="w-3.5 h-3.5 text-zinc-600" strokeWidth={1.75} />
                Reminders ({currentDraft.reminders.length}/5 Alerts)
              </span>

              <button
                type="button"
                onClick={() => triggerTaskReminderNow(task.id)}
                title="Test Reminder Alert Sound & Popup immediately"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 hover:bg-amber-200/80 text-amber-800 border border-amber-300/80 transition-colors"
              >
                <BellRing className="w-3 h-3 text-amber-600" />
                Test Alert
              </button>
            </div>

            {/* Reminder Offset Chips */}
            <div className="space-y-1.5">
              <div className="text-[10px] text-zinc-400 font-medium">Select alert times:</div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    'On time',
                    '5m before',
                    '15m before',
                    '30m before',
                    '1h before',
                    '1d before',
                  ] as const
                ).map((offset) => {
                  const isSelected = currentDraft.reminders.includes(offset);
                  return (
                    <button
                      key={offset}
                      type="button"
                      onClick={() => {
                        let next: string[];
                        if (isSelected) {
                          next = currentDraft.reminders.filter((r) => r !== offset);
                        } else {
                          if (currentDraft.reminders.length >= 5) return;
                          next = [...currentDraft.reminders, offset];
                        }
                        setDraft((d) => ({
                          ...(d || getInitialDraft(task)),
                          reminders: next,
                        }));
                      }}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                        isSelected
                          ? 'bg-zinc-900 border-zinc-900 text-white'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      {isSelected ? `✓ ${offset}` : `+ ${offset}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notification Permission Banner if not enabled */}
            {notificationPermission !== 'granted' && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50/70 border border-blue-200/70 text-[11px]">
                <span className="text-blue-800 font-medium">Enable OS desktop/mobile alerts</span>
                <button
                  type="button"
                  onClick={requestNotificationPermission}
                  className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[10px]"
                >
                  Enable Alerts
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1 border-t border-zinc-200/60">
              <label className="inline-flex items-center gap-1.5 text-xs text-zinc-700 bg-white px-2.5 py-1 rounded-md border border-zinc-200/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentDraft.constantReminder}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...(d || getInitialDraft(task)),
                      constantReminder: e.target.checked,
                    }))
                  }
                  className="rounded text-zinc-900"
                />
                <BellRing className="w-3.5 h-3.5 text-rose-500" strokeWidth={1.75} />
                <span>Constant Reminder (Repeats chime)</span>
              </label>

              <label className="inline-flex items-center gap-1.5 text-xs text-zinc-700 bg-white px-2.5 py-1 rounded-md border border-zinc-200/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentDraft.emailReminder}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...(d || getInitialDraft(task)),
                      emailReminder: e.target.checked,
                    }))
                  }
                  className="rounded text-zinc-900"
                />
                <Mail className="w-3.5 h-3.5 text-blue-600" strokeWidth={1.75} />
                <span>Email Alert</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={1.75} />
              <input
                type="text"
                value={currentDraft.locationReminder}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...(d || getInitialDraft(task)),
                    locationReminder: e.target.value,
                  }))
                }
                placeholder="Location reminder (e.g. Office HQ, Supermarket)..."
                className="w-full text-xs bg-white px-2.5 py-1 rounded-md border border-zinc-200/80 focus:outline-none focus:border-zinc-900"
              />
            </div>
          </div>

          {/* Subtasks / Checklists */}
          {!currentDraft.isNote && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-mono-num">
                  Subtasks & Checklist ({task.subtasks.filter((s) => s.completed).length}/
                  {task.subtasks.length})
                </span>
              </div>

              <div className="space-y-1">
                {task.subtasks
                  .filter((sub) => !sub.completed)
                  .map((sub) => (
                    <div
                      key={sub.id}
                      className="group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200/50"
                    >
                      <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => toggleSubtask(task.id, sub.id)}
                          className="rounded text-zinc-900"
                        />
                        <span className="text-xs truncate text-zinc-800">{sub.title}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => deleteSubtask(task.id, sub.id)}
                        className="opacity-100 lg:opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-500 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}

                {task.subtasks.some((sub) => sub.completed) && (
                  <div className="pt-1.5">
                    <button
                      type="button"
                      onClick={() => setIsSubtasksCompletedCollapsed((v) => !v)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-zinc-700 mb-1 px-1"
                    >
                      {isSubtasksCompletedCollapsed ? (
                        <ChevronRight className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      <span>
                        Completed {task.subtasks.filter((sub) => sub.completed).length}
                      </span>
                    </button>
                    {!isSubtasksCompletedCollapsed && (
                      <div className="space-y-1">
                        {task.subtasks
                          .filter((sub) => sub.completed)
                          .map((sub) => (
                            <div
                              key={sub.id}
                              className="group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-50/70 hover:bg-zinc-100/80 border border-zinc-200/40"
                            >
                              <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={true}
                                  onChange={() => toggleSubtask(task.id, sub.id)}
                                  className="rounded text-zinc-400"
                                />
                                <span className="text-xs truncate text-zinc-400">
                                  {sub.title}
                                </span>
                              </label>
                              <button
                                type="button"
                                onClick={() => deleteSubtask(task.id, sub.id)}
                                className="opacity-100 lg:opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-500 p-0.5"
                              >
                                <X className="w-3.5 h-3.5" strokeWidth={1.75} />
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newSubtaskTitle.trim()) {
                    addSubtask(task.id, newSubtaskTitle);
                    setNewSubtaskTitle('');
                  }
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="+ Add checklist item..."
                  className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200/90 focus:outline-none focus:border-zinc-900"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-800"
                >
                  Add
                </button>
              </form>
            </div>
          )}

          {/* Markdown Description / Notes */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Description & Markdown Notes
            </label>
            <textarea
              rows={5}
              value={currentDraft.content}
              onChange={(e) =>
                setDraft((d) => ({
                  ...(d || getInitialDraft(task)),
                  content: e.target.value,
                }))
              }
              placeholder="Write markdown notes, links, or code snippets..."
              className="w-full p-3 rounded-xl border border-zinc-200/90 text-xs text-zinc-700 font-mono leading-relaxed focus:outline-none focus:border-zinc-900"
            />
          </div>

          {/* Put into List (Move to Existing or New List) */}
          <div className="space-y-2 relative" data-testid="detail-move-to-list-section">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              <FolderInput className="w-3 h-3" strokeWidth={1.75} /> List (Put into List)
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setDraft((d) => ({
                    ...(d || getInitialDraft(task)),
                    listId: 'inbox',
                  }));
                  updateTask(task.id, { listId: 'inbox' }, 'Moved task to Inbox');
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                  currentDraft.listId === 'inbox'
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-zinc-50 text-zinc-600 border-zinc-200/80 hover:bg-zinc-100'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Inbox
              </button>
              {lists.map((l) => {
                const isSelectedList = currentDraft.listId === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    data-testid={`detail-list-pill-${l.name}`}
                    onClick={() => {
                      setDraft((d) => ({
                        ...(d || getInitialDraft(task)),
                        listId: l.id,
                      }));
                      updateTask(task.id, { listId: l.id }, `Moved task to list "${l.name}"`);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                      isSelectedList
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-zinc-50 text-zinc-600 border-zinc-200/80 hover:bg-zinc-100'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: l.color }}
                    />
                    {l.name}
                  </button>
                );
              })}
            </div>

            {/* Inline List Search / Create Input */}
            <div className="relative">
              <input
                type="text"
                value={newListInput}
                onChange={(e) => setNewListInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newListInput.trim()) {
                    e.preventDefault();
                    const clean = newListInput.trim().replace(/^[~^]+/, '');
                    if (!clean) return;
                    const existing = lists.find(
                      (l) => l.name.toLowerCase() === clean.toLowerCase()
                    );
                    const targetList = existing || addList(clean, '#2563eb');
                    setDraft((d) => ({
                      ...(d || getInitialDraft(task)),
                      listId: targetList.id,
                    }));
                    updateTask(
                      task.id,
                      { listId: targetList.id },
                      `Moved task to list "${targetList.name}"`
                    );
                    setNewListInput('');
                  }
                }}
                placeholder="+ Type list name to move or create new list..."
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200/90 focus:outline-none focus:border-zinc-900 bg-white"
              />
              {newListInput.trim().replace(/^[~^]+/, '').length > 0 && (() => {
                const rawQ = newListInput.trim().replace(/^[~^]+/, '');
                const q = rawQ.toLowerCase();
                const matching = lists.filter((l) => l.name.toLowerCase().includes(q));
                const exactExists = lists.some((l) => l.name.toLowerCase() === q);
                return (
                  <div className="absolute left-0 right-0 top-full mt-1 surface-floating bg-white rounded-xl border border-zinc-200/90 shadow-lg p-1 z-30 animate-popover">
                    {matching.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setDraft((d) => ({
                            ...(d || getInitialDraft(task)),
                            listId: l.id,
                          }));
                          updateTask(
                            task.id,
                            { listId: l.id },
                            `Moved task to list "${l.name}"`
                          );
                          setNewListInput('');
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 text-xs text-zinc-700 flex items-center justify-between"
                      >
                        <span className="flex items-center gap-1.5 font-medium">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: l.color }}
                          />
                          {l.name}
                        </span>
                        {currentDraft.listId === l.id && (
                          <span className="text-[10px] text-zinc-400">Current</span>
                        )}
                      </button>
                    ))}
                    {!exactExists && (
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const created = addList(rawQ, '#2563eb');
                          setDraft((d) => ({
                            ...(d || getInitialDraft(task)),
                            listId: created.id,
                          }));
                          updateTask(
                            task.id,
                            { listId: created.id },
                            `Moved task to new list "${created.name}"`
                          );
                          setNewListInput('');
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 text-xs text-blue-600 font-semibold flex items-center justify-between"
                      >
                        <span>+ Create & move to list "{rawQ}"</span>
                        <span className="text-[10px] uppercase">New List</span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Tags with Autocomplete Input */}
          <div className="space-y-2 relative">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Tags
            </span>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tg) => {
                const hasTag = currentDraft.tags.includes(tg.name);
                return (
                  <button
                    key={tg.id}
                    type="button"
                    onClick={() => {
                      const next = hasTag
                        ? currentDraft.tags.filter((t) => t !== tg.name)
                        : [...currentDraft.tags, tg.name];
                      setDraft((d) => ({
                        ...(d || getInitialDraft(task)),
                        tags: next,
                      }));
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                      hasTag
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-zinc-50 text-zinc-600 border-zinc-200/80 hover:bg-zinc-100'
                    }`}
                  >
                    <Hash className="w-2.5 h-2.5" strokeWidth={1.75} />
                    {tg.name}
                  </button>
                );
              })}
            </div>

            {/* Inline Tag Autocomplete Input */}
            <div className="relative">
              <input
                type="text"
                value={tagSearchInput}
                onChange={(e) => setTagSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tagSearchInput.trim()) {
                    e.preventDefault();
                    const clean = tagSearchInput.trim().replace(/^#/, '').toLowerCase();
                    if (!clean) return;
                    const existing = tags.find((t) => t.name.toLowerCase().includes(clean));
                    const chosenName = existing ? existing.name : clean;
                    if (!existing) {
                      addTag(chosenName, '#3b82f6');
                    }
                    if (!currentDraft.tags.includes(chosenName)) {
                      setDraft((d) => ({
                        ...(d || getInitialDraft(task)),
                        tags: [...currentDraft.tags, chosenName],
                      }));
                    }
                    setTagSearchInput('');
                  }
                }}
                placeholder="+ Type tag name to search or create..."
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200/90 focus:outline-none focus:border-zinc-900 bg-white"
              />
              {tagSearchInput.trim().replace(/^#/, '').length > 0 && (() => {
                const q = tagSearchInput.trim().replace(/^#/, '').toLowerCase();
                const matching = tags.filter((t) => t.name.toLowerCase().includes(q));
                if (matching.length === 0) return null;
                return (
                  <div className="absolute left-0 right-0 top-full mt-1 surface-floating bg-white rounded-xl border border-zinc-200/90 shadow-lg p-1 z-30 animate-popover">
                    {matching.map((tg) => {
                      const alreadySelected = currentDraft.tags.includes(tg.name);
                      return (
                        <button
                          key={tg.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (!alreadySelected) {
                              setDraft((d) => ({
                                ...(d || getInitialDraft(task)),
                                tags: [...currentDraft.tags, tg.name],
                              }));
                            }
                            setTagSearchInput('');
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 text-xs text-zinc-700 flex items-center justify-between"
                        >
                          <span className="flex items-center gap-1.5 font-medium">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: tg.color }}
                            />
                            #{tg.name}
                          </span>
                          {alreadySelected && (
                            <span className="text-[10px] text-zinc-400">Added</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Attachments Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-mono-num">
                Attachments ({task.attachments.length}/199 per day)
              </span>
              <button
                type="button"
                onClick={() => setShowAttachForm((v) => !v)}
                className="text-xs text-zinc-700 font-medium hover:text-zinc-900 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" strokeWidth={1.75} /> Attach
              </button>
            </div>

            {showAttachForm && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newAttachmentName.trim()) {
                    addTaskAttachment(task.id, newAttachmentName, newAttachmentUrl);
                    setNewAttachmentName('');
                    setNewAttachmentUrl('');
                    setShowAttachForm(false);
                  }
                }}
                className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2 animate-popover"
              >
                <input
                  type="text"
                  required
                  value={newAttachmentName}
                  onChange={(e) => setNewAttachmentName(e.target.value)}
                  placeholder="File or resource name..."
                  className="w-full px-2 py-1 text-xs rounded-md border border-zinc-200 bg-white"
                />
                <input
                  type="url"
                  value={newAttachmentUrl}
                  onChange={(e) => setNewAttachmentUrl(e.target.value)}
                  placeholder="https://... (optional link)"
                  className="w-full px-2 py-1 text-xs rounded-md border border-zinc-200 bg-white"
                />
                <button
                  type="submit"
                  className="w-full py-1.5 rounded-md bg-zinc-900 text-white text-xs font-semibold"
                >
                  Add Attachment
                </button>
              </form>
            )}

            {task.attachments.map((att) => (
              <a
                key={att.id}
                href={att.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2 rounded-lg border border-zinc-200/80 hover:bg-zinc-50 text-xs"
              >
                <span className="flex items-center gap-2 truncate font-medium text-zinc-700">
                  <Paperclip className="w-3.5 h-3.5 text-zinc-500 shrink-0" strokeWidth={1.75} />
                  {att.name}
                </span>
                <span className="text-[10px] font-mono-num text-zinc-400">{att.size}</span>
              </a>
            ))}
          </div>

          {/* Comments & Activity Log Tabs */}
          <div className="pt-2 border-t border-zinc-200/80">
            <div className="flex items-center gap-4 mb-3">
              <button
                type="button"
                onClick={() => setActiveBottomTab('comments')}
                className={`text-xs font-semibold flex items-center gap-1.5 pb-1 border-b-2 font-mono-num ${
                  activeBottomTab === 'comments'
                    ? 'border-zinc-900 text-zinc-900'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.75} />
                Comments ({task.comments.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveBottomTab('activity')}
                className={`text-xs font-semibold flex items-center gap-1.5 pb-1 border-b-2 font-mono-num ${
                  activeBottomTab === 'activity'
                    ? 'border-zinc-900 text-zinc-900'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700'
                }`}
              >
                <Activity className="w-3.5 h-3.5" strokeWidth={1.75} />
                Activity Log ({task.activities.length})
              </button>
            </div>

            {activeBottomTab === 'comments' ? (
              <div className="space-y-2.5">
                {task.comments.map((c) => (
                  <div key={c.id} className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200/60 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-800">{c.author}</span>
                      <span className="text-[10px] font-mono-num text-zinc-400">{c.createdAt}</span>
                    </div>
                    <p className="text-zinc-600">{c.text}</p>
                  </div>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newCommentText.trim()) {
                      addTaskComment(task.id, newCommentText);
                      setNewCommentText('');
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200/90 focus:outline-none focus:border-zinc-900"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-semibold"
                  >
                    Send
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {task.activities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start justify-between gap-2 text-[11px] text-zinc-600 py-1 border-b border-zinc-100"
                  >
                    <span>
                      <strong className="text-zinc-800">{act.actor}</strong>: {act.action}
                    </span>
                    <span className="text-[10px] font-mono-num text-zinc-400 shrink-0">
                      {act.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Floating Unsaved Changes Bar */}
        {isDirty && (
          <div className="sticky bottom-0 z-30 px-3.5 py-2 bg-blue-50/95 backdrop-blur-sm border-t border-blue-200/90 flex items-center justify-between shadow-md animate-sheet-up">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping shrink-0" />
              <span className="text-[11px] font-semibold text-blue-900 truncate">
                Unsaved changes
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleDiscard}
                className="px-2 py-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70 rounded-md transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1 px-3 py-1 text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-xs transition-colors"
              >
                <Save className="w-3 h-3" />
                <span>Save</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions: Updated timestamp, Duplicate & Trash */}
        <div className="min-h-11 px-4 border-t border-zinc-200/80 flex items-center justify-between text-xs text-zinc-400 shrink-0 font-mono-num bg-white pb-[env(safe-area-inset-bottom,0px)]">
          <span>Updated {task.updatedAt}</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => duplicateTask(task.id)}
              title="Duplicate Task"
              className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500"
            >
              <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => deleteTask(task.id)}
              title="Move to Trash"
              className="p-1.5 rounded-md hover:bg-rose-50 text-rose-500"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
