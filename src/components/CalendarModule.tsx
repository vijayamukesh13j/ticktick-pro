import React, { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfToday,
  startOfWeek,
  subMonths,
} from 'date-fns';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  Plus,
  Repeat,
  Sparkles,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TaskDetailPane } from './TaskDetailPane';
import { isTaskDueOnDate } from '../utils/recurringTasks';
import { Task } from '../types';

type CalendarSubView = 'month' | 'week' | 'day' | 'multiday' | 'agenda';

const MAX_MONTH_VISIBLE = 3;
const MAX_ALLDAY_VISIBLE = 2;

export const CalendarModule: React.FC = () => {
  const {
    tasks,
    lists,
    selectedTaskId,
    setSelectedTaskId,
    addTask,
    updateTask,
    toggleTaskStatus,
    calendarSubscriptions,
    addCalendarSubscription,
    toggleCalendarSubscription,
  } = useApp();

  const [subView, setSubView] = useState<CalendarSubView>('month');
  const [cursorDate, setCursorDate] = useState<Date>(startOfToday());
  const [showUnscheduledDrawer, setShowUnscheduledDrawer] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return false;
    return true;
  });
  const [showSubModal, setShowSubModal] = useState(false);
  const [subName, setSubName] = useState('');
  const [subUrl, setSubUrl] = useState('');
  const [subProvider, setSubProvider] = useState<'google' | 'outlook' | 'apple' | 'ics'>('google');
  const [quickCellDate, setQuickCellDate] = useState<string | null>(null);
  const [quickCellTitle, setQuickCellTitle] = useState('');
  const [expandedDayDate, setExpandedDayDate] = useState<string | null>(null);
  const [expandedDayNewTitle, setExpandedDayNewTitle] = useState('');
  const [selectedCellDate, setSelectedCellDate] = useState<string | null>(null);

  const today = startOfToday();
  const todayStr = format(today, 'yyyy-MM-dd');

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'trash' && t.status !== 'wont_do'),
    [tasks]
  );

  const unscheduledTasks = useMemo(
    () => activeTasks.filter((t) => !t.dueDate && t.status !== 'completed'),
    [activeTasks]
  );

  const externalEvents = useMemo(
    () =>
      calendarSubscriptions
        .filter((s) => s.enabled)
        .flatMap((s) =>
          s.events.map((ev) => ({
            ...ev,
            color: s.color,
            calendarName: s.name,
          }))
        ),
    [calendarSubscriptions]
  );

  const sortDayTasks = (dayTaskList: Task[]): Task[] => {
    return [...dayTaskList].sort((a, b) => {
      const aDone = a.status === 'completed';
      const bDone = b.status === 'completed';
      if (aDone !== bDone) return aDone ? 1 : -1;

      const aTimed = Boolean(a.startTime && !a.isAllDay);
      const bTimed = Boolean(b.startTime && !b.isAllDay);
      if (aTimed !== bTimed) return aTimed ? -1 : 1;

      if (aTimed && bTimed && a.startTime && b.startTime) {
        const timeCmp = a.startTime.localeCompare(b.startTime);
        if (timeCmp !== 0) return timeCmp;
      }

      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.title.localeCompare(b.title);
    });
  };

  const getTaskAccentColor = (task: Task): string => {
    if (task.status === 'completed') return '#d4d4d8';
    if (task.priority === 5) return '#f43f5e';
    if (task.priority === 3) return '#f59e0b';
    if (task.priority === 1) return '#3b82f6';
    return lists.find((l) => l.id === task.listId)?.color || '#52525b';
  };

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursorDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursorDate), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursorDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursorDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursorDate]);

  const multiDays = useMemo(
    () => Array.from({ length: 3 }, (_, i) => addDays(cursorDate, i)),
    [cursorDate]
  );

  const hours = Array.from({ length: 24 }, (_, i) => i); // 00:00 to 23:00 (Full 24 hours)

  const handleNavigate = (dir: -1 | 1) => {
    if (subView === 'month') {
      setCursorDate((d) => (dir === 1 ? addMonths(d, 1) : subMonths(d, 1)));
    } else if (subView === 'week') {
      setCursorDate((d) => addDays(d, dir * 7));
    } else if (subView === 'multiday') {
      setCursorDate((d) => addDays(d, dir * 3));
    } else {
      setCursorDate((d) => addDays(d, dir));
    }
  };

  const handleCreateOnDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCellDate || !quickCellTitle.trim()) return;
    addTask({
      title: quickCellTitle.trim(),
      dueDate: quickCellDate,
      startDate: quickCellDate,
      listId: 'inbox',
    });
    setQuickCellTitle('');
    setQuickCellDate(null);
  };

  const handleCreateInExpandedDay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedDayDate || !expandedDayNewTitle.trim()) return;
    addTask({
      title: expandedDayNewTitle.trim(),
      dueDate: expandedDayDate,
      startDate: expandedDayDate,
      listId: 'inbox',
    });
    setExpandedDayNewTitle('');
  };

  const headerDateLabel = useMemo(() => {
    if (subView === 'month') {
      return format(cursorDate, 'MMMM yyyy');
    }
    if (subView === 'week') {
      const start = startOfWeek(cursorDate);
      const end = endOfWeek(cursorDate);
      if (format(start, 'yyyy') !== format(end, 'yyyy')) {
        return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
      }
      if (format(start, 'MMM') !== format(end, 'MMM')) {
        return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
      }
      return `${format(start, 'MMMM d')} – ${format(end, 'd, yyyy')}`;
    }
    if (subView === 'multiday') {
      const end = addDays(cursorDate, 2);
      return `${format(cursorDate, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
    }
    if (subView === 'day') {
      return format(cursorDate, 'EEEE, MMMM d, yyyy');
    }
    if (subView === 'agenda') {
      const end = addDays(cursorDate, 6);
      return `${format(cursorDate, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
    }
    return format(cursorDate, 'MMMM yyyy');
  }, [cursorDate, subView]);

  return (
    <div className="flex-1 flex h-full min-w-0 bg-white">
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Calendar Header — Clean Date Range + Chevrons (No redundant Today button) */}
        <header className="min-h-12 md:h-13 py-2 md:py-0 px-3 sm:px-5 border-b border-zinc-200/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center justify-between w-full md:w-auto gap-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <CalendarIcon className="w-4 h-4 text-zinc-700 shrink-0" strokeWidth={1.75} />
              <h1 className="text-sm font-semibold text-zinc-900 tracking-tight font-mono-num truncate">
                {headerDateLabel}
              </h1>
            </div>

            <div className="flex items-center gap-0.5 bg-zinc-100 rounded-lg p-0.5 border border-zinc-200/70 shrink-0">
              <button
                type="button"
                onClick={() => handleNavigate(-1)}
                aria-label="Previous period"
                className="p-1 rounded-md hover:bg-white text-zinc-600 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => handleNavigate(1)}
                aria-label="Next period"
                className="p-1 rounded-md hover:bg-white text-zinc-600 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          {/* 5 Calendar View Switcher + External Calendar Sync + Unscheduled Drawer Toggle */}
          <div className="flex items-center justify-between w-full md:w-auto gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
            <div className="inline-flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/70 shrink-0">
              {(
                [
                  ['month', 'Month'],
                  ['week', 'Week'],
                  ['multiday', '3-Day'],
                  ['day', 'Day'],
                  ['agenda', 'Agenda'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setSubView(id)}
                  className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-medium ${
                    subView === id
                      ? 'bg-white text-zinc-900 font-semibold shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setShowSubModal(true)}
                title="Sync External Calendars"
                className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200/80 hover:bg-zinc-50 text-zinc-700 font-mono-num"
              >
                <Globe className="w-3.5 h-3.5 text-zinc-600" strokeWidth={1.75} />
                <span className="hidden lg:inline">Sync ({calendarSubscriptions.length})</span>
              </button>

              <button
                onClick={() => setShowUnscheduledDrawer((v) => !v)}
                className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium border font-mono-num whitespace-nowrap ${
                  showUnscheduledDrawer
                    ? 'bg-zinc-900 border-zinc-900 text-white'
                    : 'border-zinc-200/80 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                Arrange ({unscheduledTasks.length})
              </button>
            </div>
          </div>
        </header>

        {/* Calendar Body + Optional Unscheduled Drawer */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Main Calendar Grid */}
          <div
            key={`${subView}-${format(cursorDate, 'yyyy-MM-dd')}`}
            className="flex-1 overflow-y-auto animate-view-switch"
          >
            {subView === 'month' && (
              <div className="flex flex-col h-full min-h-[620px]">
                <div className="grid grid-cols-7 border-b border-zinc-200/80 bg-zinc-50/80 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="py-2 text-center border-r border-zinc-100">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="flex-1 grid grid-cols-7 auto-rows-fr">
                  {monthDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isCurrentMonth = isSameMonth(day, cursorDate);
                    const isTodayCell = isSameDay(day, today);
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const dayTasks = sortDayTasks(
                      activeTasks.filter((t) => isTaskDueOnDate(t, dateStr))
                    );
                    const dayEvents = externalEvents.filter((ev) => ev.date === dateStr);

                    // Combine events + tasks with a strict visual cap of MAX_MONTH_VISIBLE (3)
                    type CombinedItem =
                      | { kind: 'event'; id: string; title: string; time?: string; color: string }
                      | { kind: 'task'; task: Task };

                    const combinedItems: CombinedItem[] = [
                      ...dayEvents.map((ev) => ({
                        kind: 'event' as const,
                        id: ev.id,
                        title: ev.title,
                        time: ev.startTime,
                        color: ev.color,
                      })),
                      ...dayTasks.map((task) => ({
                        kind: 'task' as const,
                        task,
                      })),
                    ];

                    const visibleItems = combinedItems.slice(0, MAX_MONTH_VISIBLE);
                    const hiddenItems = combinedItems.slice(MAX_MONTH_VISIBLE);

                    return (
                      <div
                        key={dateStr}
                        data-testid={`calendar-day-${dateStr}`}
                        onClick={() => {
                          if (
                            (typeof window !== 'undefined' && window.innerWidth < 640) ||
                            combinedItems.length > 0
                          ) {
                            setExpandedDayDate(dateStr);
                          } else {
                            setQuickCellDate(dateStr);
                          }
                        }}
                        className={`group min-h-[78px] sm:min-h-[112px] p-1.5 border-b border-r border-zinc-200/60 flex flex-col cursor-pointer transition-colors ${
                          !isCurrentMonth
                            ? 'bg-zinc-50/60 text-zinc-400'
                            : isWeekend
                              ? 'bg-zinc-50/25 hover:bg-zinc-50/70'
                              : 'bg-white hover:bg-zinc-50/50'
                        }`}
                      >
                        {/* Cell Top Row: Date Number + Quiet Task Count / Quick Add */}
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs font-mono-num w-6 h-6 rounded-md flex items-center justify-center ${
                              isTodayCell
                                ? 'bg-zinc-900 text-white font-semibold'
                                : isCurrentMonth
                                  ? 'text-zinc-700 font-medium'
                                  : 'text-zinc-400'
                            }`}
                          >
                            {format(day, 'd')}
                          </span>

                          <div className="flex items-center gap-1">
                            {combinedItems.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedDayDate(dateStr);
                                }}
                                title={`View all ${combinedItems.length} items on ${format(day, 'MMM d')}`}
                                className="inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-mono-num font-semibold text-zinc-500 bg-zinc-100/80 sm:bg-transparent sm:text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
                              >
                                {combinedItems.length}
                              </button>
                            )}
                            <button
                              type="button"
                              aria-label={`Quick add on ${dateStr}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuickCellDate(dateStr);
                              }}
                              className="hidden sm:inline-flex p-0.5 rounded text-zinc-300 opacity-0 group-hover:opacity-100 hover:text-zinc-700 transition-opacity"
                            >
                              <Plus className="w-3 h-3" strokeWidth={1.75} />
                            </button>
                          </div>
                        </div>

                        {/* Mobile Preview Pill + Clean Dots (<640px) — Tap cell to open Day Overview Popup */}
                        <div className="sm:hidden flex flex-col gap-1 mt-0.5 flex-1 justify-between">
                          {combinedItems.length > 0 && (
                            <div
                              style={{
                                borderLeftColor:
                                  combinedItems[0].kind === 'event'
                                    ? combinedItems[0].color
                                    : getTaskAccentColor(combinedItems[0].task),
                              }}
                              className="px-1 py-0.5 rounded-[3px] bg-zinc-100/90 border-l-2 text-[9px] font-medium text-zinc-700 truncate leading-tight"
                            >
                              {combinedItems[0].kind === 'event'
                                ? combinedItems[0].title
                                : combinedItems[0].task.title}
                            </div>
                          )}
                          <div className="flex items-center justify-center gap-1">
                            {combinedItems.slice(0, 4).map((item, idx) => {
                              const dotColor =
                                item.kind === 'event'
                                  ? item.color
                                  : getTaskAccentColor(item.task);
                              return (
                                <span
                                  key={idx}
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: dotColor }}
                                />
                              );
                            })}
                            {combinedItems.length > 4 && (
                              <span className="text-[9px] font-mono-num text-zinc-400">
                                +{combinedItems.length - 4}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Tablet/Desktop Flat Typographic Bars — Capped at 3, Zero Scrollbars */}
                        <div className="hidden sm:flex flex-col gap-1 flex-1">
                          {visibleItems.map((item) => {
                            if (item.kind === 'event') {
                              return (
                                <div
                                  key={item.id}
                                  style={{ borderLeftColor: item.color }}
                                  className="h-[21px] px-1.5 rounded-[4px] bg-sky-50/70 border-l-[2.5px] text-[11px] text-zinc-700 truncate flex items-center gap-1.5 font-medium"
                                >
                                  {item.time && (
                                    <span className="font-mono-num text-[10px] text-zinc-400 shrink-0">
                                      {item.time}
                                    </span>
                                  )}
                                  <span className="truncate">{item.title}</span>
                                </div>
                              );
                            }

                            const { task } = item;
                            const isSelectedHere =
                              selectedTaskId === task.id && selectedCellDate === dateStr;
                            const isDone = task.status === 'completed';
                            const accentColor = getTaskAccentColor(task);

                            return (
                              <div
                                key={task.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCellDate(dateStr);
                                  setSelectedTaskId(task.id);
                                }}
                                style={{ borderLeftColor: accentColor }}
                                className={`h-[21px] px-1.5 rounded-[4px] border-l-[2.5px] text-[11px] leading-none flex items-center gap-1.5 transition-colors ${
                                  isSelectedHere
                                    ? 'bg-blue-50/95 text-blue-950 ring-1 ring-blue-500/30 font-semibold'
                                    : isDone
                                      ? 'bg-zinc-50 text-zinc-400'
                                      : 'bg-zinc-100/75 hover:bg-zinc-200/65 text-zinc-800 font-medium'
                                }`}
                              >
                                {task.startTime && (
                                  <span
                                    className={`font-mono-num text-[10px] shrink-0 ${
                                      isDone ? 'text-zinc-300' : 'text-zinc-500'
                                    }`}
                                  >
                                    {task.startTime}
                                  </span>
                                )}
                                <span className="truncate flex-1">{task.title}</span>
                                {task.recurrenceRule && (
                                  <Repeat className="w-2.5 h-2.5 shrink-0 text-zinc-400" />
                                )}
                              </div>
                            );
                          })}

                          {/* Overflow Summary Pill (+N more) */}
                          {hiddenItems.length > 0 && (
                            <button
                              type="button"
                              data-testid={`calendar-more-${dateStr}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedDayDate(dateStr);
                              }}
                              className="h-[20px] px-1.5 rounded-[4px] bg-zinc-100/60 hover:bg-zinc-200/80 text-[10px] font-mono-num font-semibold text-zinc-500 hover:text-zinc-900 flex items-center justify-between transition-colors mt-auto"
                            >
                              <span>+{hiddenItems.length} more</span>
                              <span className="flex items-center gap-0.5">
                                {hiddenItems.slice(0, 4).map((hi, idx) => {
                                  const c =
                                    hi.kind === 'event'
                                      ? hi.color
                                      : getTaskAccentColor(hi.task);
                                  return (
                                    <span
                                      key={idx}
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{ backgroundColor: c }}
                                    />
                                  );
                                })}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(subView === 'week' || subView === 'multiday' || subView === 'day') && (
              <div
                className={`flex flex-col ${
                  subView === 'day'
                    ? 'w-full min-w-0'
                    : subView === 'multiday'
                      ? 'min-w-[340px] sm:min-w-0 w-full'
                      : 'min-w-[640px]'
                }`}
              >
                {(() => {
                  const cols =
                    subView === 'week'
                      ? weekDays
                      : subView === 'multiday'
                        ? multiDays
                        : [cursorDate];

                  const allDayCap = subView === 'day' ? 5 : MAX_ALLDAY_VISIBLE;

                  return (
                    <>
                      {/* Column Headers + Compact All-Day Row */}
                      <div
                        style={{
                          gridTemplateColumns: `64px repeat(${cols.length}, minmax(0, 1fr))`,
                        }}
                        className="grid border-b border-zinc-200/80 bg-zinc-50/95 backdrop-blur-xs sticky top-0 z-10"
                      >
                        <div className="p-2 text-[10px] font-semibold text-zinc-400 border-r border-zinc-200/80 flex items-end justify-center">
                          All-Day
                        </div>
                        {cols.map((d) => {
                          const dStr = format(d, 'yyyy-MM-dd');
                          const dayAllTasks = sortDayTasks(
                            activeTasks.filter((t) => isTaskDueOnDate(t, dStr))
                          );
                          const allDayTasks = dayAllTasks.filter(
                            (t) => !t.startTime || t.isAllDay
                          );
                          const visibleAllDay = allDayTasks.slice(0, allDayCap);
                          const hiddenAllDayCount = Math.max(
                            0,
                            allDayTasks.length - visibleAllDay.length
                          );

                          return (
                            <div
                              key={dStr}
                              className="p-2 border-r border-zinc-200/80 flex flex-col gap-1 min-w-0"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <button
                                  type="button"
                                  onClick={() => setExpandedDayDate(dStr)}
                                  title={`View schedule for ${format(d, 'EEEE, MMM d')}`}
                                  className="flex items-center gap-1.5 min-w-0 hover:opacity-80 transition-opacity cursor-pointer"
                                >
                                  <span className="text-[11px] font-medium text-zinc-500">
                                    {format(d, 'EEE')}
                                  </span>
                                  <span
                                    className={`text-xs font-mono-num px-1.5 py-0.5 rounded-md ${
                                      dStr === todayStr
                                        ? 'bg-zinc-900 text-white font-semibold'
                                        : 'text-zinc-800 font-semibold'
                                    }`}
                                  >
                                    {format(d, 'd')}
                                  </span>
                                </button>
                                {dayAllTasks.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedDayDate(dStr)}
                                    title={`View all ${dayAllTasks.length} tasks on ${format(d, 'MMM d')}`}
                                    className="text-[10px] font-mono-num text-zinc-400 hover:text-zinc-800 px-1 py-0.5 rounded hover:bg-zinc-200/60 transition-colors"
                                  >
                                    {dayAllTasks.length}d
                                  </button>
                                )}
                              </div>

                              {visibleAllDay.length > 0 && (
                                <div className="space-y-1 pt-0.5">
                                  {visibleAllDay.map((t) => {
                                    const accentColor = getTaskAccentColor(t);
                                    const isSelectedHere =
                                      selectedTaskId === t.id && selectedCellDate === dStr;
                                    return (
                                      <div
                                        key={t.id}
                                        onClick={() => {
                                          setSelectedCellDate(dStr);
                                          setSelectedTaskId(t.id);
                                        }}
                                        style={{ borderLeftColor: accentColor }}
                                        className={`h-[21px] px-1.5 rounded-[4px] border border-zinc-200/70 border-l-[2.5px] text-[10px] font-medium truncate cursor-pointer flex items-center justify-between gap-1 transition-colors ${
                                          isSelectedHere
                                            ? 'bg-blue-50 text-blue-950 ring-1 ring-blue-500/30 font-semibold'
                                            : t.status === 'completed'
                                              ? 'bg-zinc-100/70 text-zinc-400'
                                              : 'bg-white hover:bg-zinc-100/80 text-zinc-800'
                                        }`}
                                      >
                                        <span className="truncate">{t.title}</span>
                                        {t.recurrenceRule && (
                                          <Repeat className="w-2.5 h-2.5 shrink-0 text-zinc-400" />
                                        )}
                                      </div>
                                    );
                                  })}

                                  {hiddenAllDayCount > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedDayDate(dStr)}
                                      className="w-full h-[19px] px-1.5 rounded-[4px] bg-zinc-200/60 hover:bg-zinc-200 text-[10px] font-mono-num font-semibold text-zinc-600 hover:text-zinc-900 text-left transition-colors"
                                    >
                                      +{hiddenAllDayCount} more all-day
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Hourly Time-Blocking Rows */}
                      {hours.map((hr) => {
                        const hrPrefix = String(hr).padStart(2, '0');
                        return (
                          <div
                            key={hr}
                            style={{
                              gridTemplateColumns: `64px repeat(${cols.length}, minmax(0, 1fr))`,
                            }}
                            className="grid border-b border-zinc-100 min-h-[54px]"
                          >
                            <div className="px-2 py-1 text-[10px] font-mono-num text-zinc-400 border-r border-zinc-200/80 text-right">
                              {hrPrefix}:00
                            </div>
                            {cols.map((d) => {
                              const dStr = format(d, 'yyyy-MM-dd');
                              const slotTasks = sortDayTasks(
                                activeTasks.filter(
                                  (t) =>
                                    isTaskDueOnDate(t, dStr) &&
                                    t.startTime &&
                                    t.startTime.startsWith(hrPrefix)
                                )
                              );
                              const slotEvents = externalEvents.filter(
                                (ev) => ev.date === dStr && ev.startTime.startsWith(hrPrefix)
                              );

                              const maxHourlyVisible = subView === 'day' ? 6 : 2;
                              const visibleSlotTasks = slotTasks.slice(0, maxHourlyVisible);
                              const hiddenSlotCount = Math.max(
                                0,
                                slotTasks.length - visibleSlotTasks.length
                              );

                              return (
                                <div
                                  key={`${dStr}-${hr}`}
                                  onClick={() => setQuickCellDate(dStr)}
                                  className="p-1 border-r border-zinc-100 hover:bg-zinc-50/60 space-y-1 cursor-pointer min-w-0"
                                >
                                  {slotEvents.map((ev) => (
                                    <div
                                      key={ev.id}
                                      style={{ borderLeftColor: ev.color }}
                                      className="px-2 py-1 rounded-[4px] bg-sky-50/70 border border-sky-200/60 border-l-[2.5px] text-[10px] text-zinc-800 font-medium"
                                    >
                                      <div className="font-mono-num text-zinc-500">
                                        {ev.startTime} – {ev.endTime}
                                      </div>
                                      <div className="truncate">{ev.title}</div>
                                    </div>
                                  ))}
                                  {visibleSlotTasks.map((t) => {
                                    const accentColor = getTaskAccentColor(t);
                                    const isSelectedHere =
                                      selectedTaskId === t.id && selectedCellDate === dStr;
                                    return (
                                      <div
                                        key={t.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedCellDate(dStr);
                                          setSelectedTaskId(t.id);
                                        }}
                                        style={{ borderLeftColor: accentColor }}
                                        className={`px-2 py-1 rounded-[4px] border border-l-[3px] text-[11px] font-medium cursor-pointer transition-colors ${
                                          isSelectedHere
                                            ? 'bg-blue-50 border-blue-300 text-blue-950'
                                            : t.priority === 5
                                              ? 'bg-rose-50/80 border-rose-200/70 text-rose-950'
                                              : t.priority === 3
                                                ? 'bg-amber-50/80 border-amber-200/70 text-amber-950'
                                                : 'bg-zinc-50/90 hover:bg-zinc-100 border-zinc-200/80 text-zinc-800'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between text-[10px] font-mono-num text-zinc-500">
                                          <span>
                                            {t.startTime}
                                            {t.endTime ? ` – ${t.endTime}` : ''}
                                          </span>
                                          {t.durationMinutes && <span>{t.durationMinutes}m</span>}
                                        </div>
                                        <div className="truncate font-semibold flex items-center justify-between gap-1">
                                          <span className="truncate">{t.title}</span>
                                          {t.recurrenceRule && (
                                            <Repeat className="w-2.5 h-2.5 shrink-0 text-zinc-400" />
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {hiddenSlotCount > 0 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedDayDate(dStr);
                                      }}
                                      className="w-full h-[19px] px-1.5 rounded-[4px] bg-zinc-100 hover:bg-zinc-200 text-[10px] font-mono-num font-semibold text-zinc-600 text-left"
                                    >
                                      +{hiddenSlotCount} more in this hour
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            )}

            {subView === 'agenda' && (
              <div className="max-w-3xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-5">
                {Array.from({ length: 7 }, (_, i) => addDays(cursorDate, i)).map((day) => {
                  const dStr = format(day, 'yyyy-MM-dd');
                  const dayTasks = sortDayTasks(
                    activeTasks.filter((t) => isTaskDueOnDate(t, dStr))
                  );
                  const dayEvents = externalEvents.filter((ev) => ev.date === dStr);

                  return (
                    <div
                      key={dStr}
                      className="surface-card rounded-xl p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                        <span className="text-xs font-semibold text-zinc-900">
                          {format(day, 'EEEE, MMMM d')}
                        </span>
                        <span className="text-[11px] font-mono-num text-zinc-400">
                          {dayTasks.length + dayEvents.length} items
                        </span>
                      </div>

                      {dayTasks.length === 0 && dayEvents.length === 0 ? (
                        <p className="text-xs text-zinc-400">No scheduled items</p>
                      ) : (
                        <div className="space-y-1.5">
                          {dayEvents.map((ev) => (
                            <div
                              key={ev.id}
                              className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-100 text-xs text-zinc-800"
                            >
                              <span className="font-semibold">{ev.title}</span>
                              <span className="font-mono-num text-[11px] text-zinc-500">
                                {ev.startTime} – {ev.endTime}
                              </span>
                            </div>
                          ))}
                          {dayTasks
                            .filter((t) => t.status !== 'completed')
                            .map((t) => (
                              <div
                                key={t.id}
                                onClick={() => {
                                  setSelectedCellDate(dStr);
                                  setSelectedTaskId(t.id);
                                }}
                                className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-50 hover:bg-zinc-100/80 text-xs cursor-pointer border border-zinc-200/60"
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={false}
                                    disabled={Boolean(t.recurrenceRule) && t.dueDate !== dStr}
                                    title={
                                      Boolean(t.recurrenceRule) && t.dueDate !== dStr
                                        ? 'Future occurrence'
                                        : undefined
                                    }
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      toggleTaskStatus(t.id);
                                    }}
                                    className="rounded text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed"
                                  />
                                  <span className="font-medium text-zinc-800">
                                    {t.title}
                                  </span>
                                </div>
                                <span className="font-mono-num text-[11px] text-zinc-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" strokeWidth={1.75} />
                                  {t.startTime || 'All-Day'}
                                </span>
                              </div>
                            ))}

                          {dayTasks.some((t) => t.status === 'completed') && (
                            <div className="pt-2 space-y-1">
                              <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 px-1">
                                <ChevronDown className="w-3 h-3" />
                                <span>
                                  Completed{' '}
                                  {dayTasks.filter((t) => t.status === 'completed').length}
                                </span>
                              </div>
                              {dayTasks
                                .filter((t) => t.status === 'completed')
                                .map((t) => (
                                  <div
                                    key={t.id}
                                    onClick={() => {
                                      setSelectedCellDate(dStr);
                                      setSelectedTaskId(t.id);
                                    }}
                                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-50/60 hover:bg-zinc-100/80 text-xs cursor-pointer border border-zinc-200/40"
                                  >
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={true}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          toggleTaskStatus(t.id);
                                        }}
                                        className="rounded text-zinc-400"
                                      />
                                      <span className="font-medium text-zinc-400">
                                        {t.title}
                                      </span>
                                    </div>
                                    <span className="font-mono-num text-[11px] text-zinc-400 flex items-center gap-1">
                                      <Clock className="w-3 h-3" strokeWidth={1.75} />
                                      {t.startTime || 'All-Day'}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Unscheduled Tasks Arrangement Drawer */}
          {showUnscheduledDrawer && (
            <>
              <div
                onClick={() => setShowUnscheduledDrawer(false)}
                className="lg:hidden fixed inset-0 z-30 bg-zinc-950/40 backdrop-blur-[2px] animate-backdrop"
              />
              <aside className="fixed inset-x-0 bottom-0 z-40 max-h-[68dvh] rounded-t-2xl shadow-2xl lg:shadow-none lg:rounded-none lg:max-h-none lg:static lg:z-auto w-full lg:w-64 border-t lg:border-t-0 lg:border-l border-zinc-200/80 bg-white lg:bg-zinc-50/70 p-4 pb-20 lg:p-3 flex flex-col shrink-0 animate-sheet-up lg:[animation:none]">
                <div className="lg:hidden w-10 h-1 rounded-full bg-zinc-300 mx-auto mb-3 shrink-0" />
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-zinc-600" strokeWidth={1.75} />
                    Arrange Tasks
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono-num text-zinc-400">
                      {unscheduledTasks.length} undated
                    </span>
                    <button
                      onClick={() => setShowUnscheduledDrawer(false)}
                      className="lg:hidden p-1 rounded-md text-zinc-400 hover:bg-zinc-100"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 mb-3">
                  Schedule any undated task to time-block it onto your active calendar date.
                </p>
                <div className="space-y-2 overflow-y-auto flex-1">
                  {unscheduledTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-2.5 rounded-lg bg-white border border-zinc-200/80 space-y-2"
                    >
                      <div className="text-xs font-medium text-zinc-800">{t.title}</div>
                      <button
                        onClick={() =>
                          updateTask(
                            t.id,
                            {
                              dueDate: format(cursorDate, 'yyyy-MM-dd'),
                              startDate: format(cursorDate, 'yyyy-MM-dd'),
                              startTime: '10:00',
                              durationMinutes: 60,
                            },
                            `Time-blocked onto ${format(cursorDate, 'MMM d')} at 10:00`
                          )
                        }
                        className="w-full py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-semibold font-mono-num"
                      >
                        + Schedule on {format(cursorDate, 'MMM d')}
                      </button>
                    </div>
                  ))}
                </div>
              </aside>
            </>
          )}
        </div>
      </div>

      {/* Right Task Detail Inspector */}
      <TaskDetailPane />

      {/* Day Schedule Overview Popover / Sheet (Opens on +N more or day count click) */}
      {expandedDayDate && (
        <div
          onClick={() => setExpandedDayDate(null)}
          className="fixed inset-0 z-50 bg-zinc-950/35 backdrop-blur-[1px] flex items-center justify-center p-4 animate-backdrop"
        >
          <div
            role="dialog"
            aria-label="Day Schedule Overview"
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-zinc-200/90 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80dvh] animate-modal"
          >
            {(() => {
              const dayObj = parseISO(expandedDayDate);
              const dayTasks = sortDayTasks(
                activeTasks.filter((t) => isTaskDueOnDate(t, expandedDayDate))
              );
              const dayEvents = externalEvents.filter((ev) => ev.date === expandedDayDate);
              const completedCount = dayTasks.filter((t) => t.status === 'completed').length;

              return (
                <>
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-zinc-200/80 flex items-center justify-between bg-zinc-50/60">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">
                        {format(dayObj, 'EEEE, MMMM d, yyyy')}
                      </h3>
                      <p className="text-[11px] font-mono-num text-zinc-500 mt-0.5">
                        {dayTasks.length} {dayTasks.length === 1 ? 'task' : 'tasks'}
                        {dayEvents.length > 0 ? ` · ${dayEvents.length} events` : ''}
                        {completedCount > 0 ? ` · ${completedCount} completed` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Close day overview"
                      onClick={() => setExpandedDayDate(null)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200/60 transition-colors"
                    >
                      <X className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>

                  {/* Chronological Item List */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                    {dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        style={{ borderLeftColor: ev.color }}
                        className="px-3 py-2 rounded-lg bg-sky-50/60 border border-sky-200/60 border-l-[3px] flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-zinc-800 truncate">{ev.title}</div>
                          <div className="text-[10px] text-zinc-500">{ev.calendarName}</div>
                        </div>
                        <span className="font-mono-num text-[11px] text-zinc-600 shrink-0 ml-2">
                          {ev.startTime} – {ev.endTime}
                        </span>
                      </div>
                    ))}

                    {dayTasks.length === 0 && dayEvents.length === 0 ? (
                      <div className="py-8 text-center text-xs text-zinc-400">
                        No tasks scheduled for this date.
                      </div>
                    ) : (
                      dayTasks.map((t) => {
                        const isDone = t.status === 'completed';
                        const accentColor = getTaskAccentColor(t);
                        const taskList = lists.find((l) => l.id === t.listId);

                        return (
                          <div
                            key={t.id}
                            onClick={() => {
                              setSelectedCellDate(expandedDayDate);
                              setSelectedTaskId(t.id);
                              setExpandedDayDate(null);
                            }}
                            style={{ borderLeftColor: accentColor }}
                            className={`px-3 py-2 rounded-lg border border-zinc-200/70 border-l-[3px] flex items-center justify-between gap-2.5 cursor-pointer transition-colors ${
                              isDone
                                ? 'bg-zinc-50/60 text-zinc-400'
                                : 'bg-white hover:bg-zinc-50 text-zinc-900'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <input
                                type="checkbox"
                                checked={isDone}
                                disabled={Boolean(t.recurrenceRule) && t.dueDate !== expandedDayDate}
                                title={
                                  Boolean(t.recurrenceRule) && t.dueDate !== expandedDayDate
                                    ? 'Future occurrence'
                                    : undefined
                                }
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleTaskStatus(t.id)}
                                className="rounded text-zinc-900 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium truncate flex items-center gap-1.5">
                                  <span className="truncate">{t.title}</span>
                                  {t.recurrenceRule && (
                                    <Repeat className="w-3 h-3 text-zinc-400 shrink-0" />
                                  )}
                                </div>
                                {taskList && (
                                  <div className="text-[10px] text-zinc-400 truncate">
                                    {taskList.name}
                                  </div>
                                )}
                              </div>
                            </div>

                            <span className="font-mono-num text-[11px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded shrink-0">
                              {t.startTime || 'All-Day'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Quick Add Footer inside Day Overview */}
                  <form
                    onSubmit={handleCreateInExpandedDay}
                    className="p-3 border-t border-zinc-200/80 bg-zinc-50/60 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={expandedDayNewTitle}
                      onChange={(e) => setExpandedDayNewTitle(e.target.value)}
                      placeholder={`+ Add task on ${format(dayObj, 'MMM d')}...`}
                      className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white focus:outline-none focus:border-zinc-900"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold shrink-0"
                    >
                      Add
                    </button>
                  </form>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Quick Create Task on Selected Date Modal */}
      {quickCellDate && (
        <div
          onClick={() => setQuickCellDate(null)}
          className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-backdrop"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateOnDate}
            className="surface-floating rounded-xl w-full max-w-sm p-5 space-y-3 animate-modal"
          >
            <h3 className="text-sm font-semibold text-zinc-900">
              Schedule Task on {format(parseISO(quickCellDate), 'EEEE, MMM d')}
            </h3>
            <input
              type="text"
              autoFocus
              required
              value={quickCellTitle}
              onChange={(e) => setQuickCellTitle(e.target.value)}
              placeholder="Task title..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 focus:outline-none focus:border-zinc-900"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuickCellDate(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800"
              >
                Add to Calendar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* External Calendar Subscriptions Modal (Premium) */}
      {showSubModal && (
        <div
          onClick={() => setShowSubModal(false)}
          className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-backdrop"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="surface-floating rounded-xl w-full max-w-md p-5 space-y-4 animate-modal"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-zinc-700" strokeWidth={1.75} />
                External Calendar Subscriptions
              </h3>
              <button
                onClick={() => setShowSubModal(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="space-y-2">
              {calendarSubscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 border border-zinc-200/80"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-800 flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: sub.color }}
                      />
                      {sub.name}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400 truncate">{sub.url}</div>
                  </div>
                  <button
                    onClick={() => toggleCalendarSubscription(sub.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                      sub.enabled
                        ? 'bg-emerald-50 border border-emerald-200/80 text-emerald-700'
                        : 'bg-zinc-200 text-zinc-600'
                    }`}
                  >
                    {sub.enabled ? 'Synced' : 'Paused'}
                  </button>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (subName.trim() && subUrl.trim()) {
                  addCalendarSubscription(subName.trim(), subUrl.trim(), subProvider, '#0ea5e9');
                  setSubName('');
                  setSubUrl('');
                }
              }}
              className="space-y-2.5 pt-2 border-t border-zinc-200/80"
            >
              <div className="text-xs font-semibold text-zinc-700">
                Subscribe via ICS / Webcal URL
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="Calendar Name (e.g. Outlook)"
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300"
                />
                <select
                  value={subProvider}
                  onChange={(e) => setSubProvider(e.target.value as typeof subProvider)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 bg-white"
                >
                  <option value="google">Google Calendar</option>
                  <option value="outlook">Outlook Calendar</option>
                  <option value="apple">Apple iCloud</option>
                  <option value="ics">Custom ICS Feed</option>
                </select>
              </div>
              <input
                type="text"
                required
                value={subUrl}
                onChange={(e) => setSubUrl(e.target.value)}
                placeholder="webcal:// or https://.../basic.ics"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 font-mono"
              />
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" strokeWidth={2} /> Connect Calendar Feed
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
