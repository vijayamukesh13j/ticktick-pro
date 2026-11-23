import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  CheckSquare,
  Cloud,
  Download,
  Flame,
  Grid2X2,
  Hourglass,
  Play,
  Search,
  Settings,
  Timer,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { parseNaturalLanguageTask } from '../utils/nlpParser';

export const CommandPaletteModal: React.FC = () => {
  const {
    isCommandOpen,
    setIsCommandOpen,
    tasks,
    lists,
    habits,
    countdowns,
    setActiveModule,
    setSelectedTaskId,
    setSidebarSelection,
    addTask,
    openSettingsTab,
    setPomoMode,
    setPomoRunning,
    syncWorkspaceToSupabase,
    exportBackupJson,
    exportTasksCsv,
  } = useApp();

  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();

  const matchingTasks = useMemo(() => {
    const active = tasks.filter((t) => t.status !== 'trash');
    if (!normalizedQuery) return active.slice(0, 5);
    return active
      .filter(
        (t) =>
          t.title.toLowerCase().includes(normalizedQuery) ||
          t.content.toLowerCase().includes(normalizedQuery) ||
          t.tags.some((tg) => tg.toLowerCase().includes(normalizedQuery))
      )
      .slice(0, 6);
  }, [tasks, normalizedQuery]);

  const matchingHabits = useMemo(() => {
    if (!normalizedQuery) return [];
    return habits
      .filter(
        (h) =>
          h.name.toLowerCase().includes(normalizedQuery) ||
          h.quote.toLowerCase().includes(normalizedQuery)
      )
      .slice(0, 4);
  }, [habits, normalizedQuery]);

  const matchingCountdowns = useMemo(() => {
    if (!normalizedQuery) return [];
    return countdowns
      .filter(
        (c) =>
          c.title.toLowerCase().includes(normalizedQuery) ||
          c.category.toLowerCase().includes(normalizedQuery)
      )
      .slice(0, 4);
  }, [countdowns, normalizedQuery]);

  const quickActions = useMemo(
    () => [
      {
        label: 'Start Pomodoro Timer Now',
        keywords: 'focus pomo timer start',
        icon: <Play className="w-4 h-4 text-rose-500" strokeWidth={1.75} />,
        shortcut: 'P S',
        action: () => {
          setPomoMode('pomo');
          setPomoRunning(true);
          setActiveModule('pomodoro');
          setIsCommandOpen(false);
        },
      },
      {
        label: 'Start Stopwatch Now',
        keywords: 'stopwatch timer focus start countup',
        icon: <Timer className="w-4 h-4 text-blue-600" strokeWidth={1.75} />,
        shortcut: 'S W',
        action: () => {
          setPomoMode('stopwatch');
          setPomoRunning(true);
          setActiveModule('pomodoro');
          setIsCommandOpen(false);
        },
      },
      {
        label: 'Sync Cloud Now (Supabase)',
        keywords: 'sync cloud database supabase push',
        icon: <Cloud className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />,
        shortcut: 'S Y',
        action: () => {
          setIsCommandOpen(false);
          void syncWorkspaceToSupabase();
        },
      },
      {
        label: 'Export Full Workspace Backup (JSON)',
        keywords: 'export backup json download save',
        icon: <Download className="w-4 h-4 text-zinc-600" strokeWidth={1.75} />,
        shortcut: 'E J',
        action: () => {
          exportBackupJson();
          setIsCommandOpen(false);
        },
      },
      {
        label: 'Export Tasks Spreadsheet (CSV)',
        keywords: 'export csv tasks spreadsheet download',
        icon: <Download className="w-4 h-4 text-zinc-600" strokeWidth={1.75} />,
        shortcut: 'E C',
        action: () => {
          exportTasksCsv();
          setIsCommandOpen(false);
        },
      },
      {
        label: 'Go to Tasks Workspace',
        keywords: 'tasks inbox todo list',
        icon: <CheckSquare className="w-4 h-4 text-zinc-600" strokeWidth={1.75} />,
        shortcut: 'G T',
        action: () => {
          setActiveModule('tasks');
          setIsCommandOpen(false);
        },
      },
      {
        label: 'Go to Calendar (Month / Week / Day / Agenda)',
        keywords: 'calendar schedule time block',
        icon: <Calendar className="w-4 h-4 text-zinc-600" strokeWidth={1.75} />,
        shortcut: 'G C',
        action: () => {
          setActiveModule('calendar');
          setIsCommandOpen(false);
        },
      },
      {
        label: 'Open Habit Tracker',
        keywords: 'habits streak rest day routine',
        icon: <Flame className="w-4 h-4 text-zinc-600" strokeWidth={1.75} />,
        shortcut: 'G H',
        action: () => {
          setActiveModule('habits');
          setIsCommandOpen(false);
        },
      },
      {
        label: 'Switch to Eisenhower Matrix',
        keywords: 'matrix quadrants urgent important',
        icon: <Grid2X2 className="w-4 h-4 text-zinc-600" strokeWidth={1.75} />,
        shortcut: 'G M',
        action: () => {
          setActiveModule('matrix');
          setIsCommandOpen(false);
        },
      },
      {
        label: 'Open Countdowns & Templates Hub',
        keywords: 'countdown milestone exam birthday',
        icon: <Hourglass className="w-4 h-4 text-zinc-600" strokeWidth={1.75} />,
        shortcut: 'G D',
        action: () => {
          setActiveModule('countdown');
          setIsCommandOpen(false);
        },
      },
      {
        label: 'View Productivity Statistics & Score',
        keywords: 'stats analytics overview chart',
        icon: <BarChart3 className="w-4 h-4 text-zinc-600" strokeWidth={1.75} />,
        shortcut: 'G S',
        action: () => {
          setActiveModule('statistics');
          setIsCommandOpen(false);
        },
      },
      {
        label: 'Open Settings & Supabase Cloud Sync',
        keywords: 'settings preferences themes supabase backup',
        icon: <Settings className="w-4 h-4 text-zinc-600" strokeWidth={1.75} />,
        shortcut: '⌘ ,',
        action: () => {
          setIsCommandOpen(false);
          openSettingsTab('supabase');
        },
      },
    ],
    [
      setPomoMode,
      setPomoRunning,
      setActiveModule,
      setIsCommandOpen,
      syncWorkspaceToSupabase,
      exportBackupJson,
      exportTasksCsv,
      openSettingsTab,
    ]
  );

  const filteredActions = useMemo(() => {
    if (!normalizedQuery) return quickActions;
    return quickActions.filter(
      (a) =>
        a.label.toLowerCase().includes(normalizedQuery) ||
        a.keywords.toLowerCase().includes(normalizedQuery)
    );
  }, [quickActions, normalizedQuery]);

  if (!isCommandOpen) return null;

  const handleQuickCreateFromQuery = () => {
    if (!query.trim()) return;
    const parsed = parseNaturalLanguageTask(query);
    addTask({
      title: parsed.cleanTitle,
      dueDate: parsed.dueDate,
      startDate: parsed.dueDate,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      durationMinutes: parsed.durationMinutes,
      priority: parsed.priority ?? 0,
      tags: parsed.tags,
      recurrenceRule: parsed.recurrenceRule,
    });
    setQuery('');
    setActiveModule('tasks');
    setIsCommandOpen(false);
  };

  return (
    <div
      onClick={() => setIsCommandOpen(false)}
      className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px] flex items-start justify-center pt-20 p-4 animate-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl surface-floating rounded-xl overflow-hidden animate-modal"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200/80">
          <Search className="w-4 h-4 text-zinc-400" strokeWidth={1.75} />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsCommandOpen(false);
              if (
                e.key === 'Enter' &&
                query.trim() &&
                matchingTasks.length === 0 &&
                matchingHabits.length === 0 &&
                matchingCountdowns.length === 0 &&
                filteredActions.length === 0
              ) {
                handleQuickCreateFromQuery();
              }
            }}
            placeholder="Search tasks, habits, countdowns, run quick actions, or type NLP task..."
            className="flex-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 font-mono text-[10px] text-zinc-500">
            ESC
          </kbd>
          <button
            onClick={() => setIsCommandOpen(false)}
            className="p-1 rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 space-y-3">
          {query.trim() && (
            <button
              onClick={handleQuickCreateFromQuery}
              className="w-full text-left px-3 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold flex items-center justify-between"
            >
              <span>+ Create Task via Smart NLP: "{query}"</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/15 text-zinc-100">
                Enter
              </span>
            </button>
          )}

          {/* Matching Tasks */}
          {matchingTasks.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-mono-num">
                Tasks ({matchingTasks.length})
              </div>
              <div className="space-y-0.5">
                {matchingTasks.map((t) => {
                  const list = lists.find((l) => l.id === t.listId);
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setActiveModule('tasks');
                        if (t.listId === 'inbox') {
                          setSidebarSelection({ kind: 'smart', id: 'inbox' });
                        } else {
                          setSidebarSelection({ kind: 'list', id: t.listId });
                        }
                        setSelectedTaskId(t.id);
                        setIsCommandOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-100 text-xs text-zinc-800"
                    >
                      <span className="truncate font-medium">{t.title}</span>
                      <span className="text-[10px] text-zinc-400 shrink-0 ml-2">
                        {list?.name || 'Inbox'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Matching Habits */}
          {matchingHabits.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-mono-num">
                Habits ({matchingHabits.length})
              </div>
              <div className="space-y-0.5">
                {matchingHabits.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => {
                      setActiveModule('habits');
                      setIsCommandOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-100 text-xs text-zinc-800"
                  >
                    <span className="flex items-center gap-2 truncate font-medium">
                      <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span className="truncate">{h.name}</span>
                    </span>
                    <span className="text-[10px] text-zinc-400 shrink-0 ml-2 capitalize">
                      {h.section}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matching Countdowns */}
          {matchingCountdowns.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-mono-num">
                Countdowns ({matchingCountdowns.length})
              </div>
              <div className="space-y-0.5">
                {matchingCountdowns.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveModule('countdown');
                      setIsCommandOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-100 text-xs text-zinc-800"
                  >
                    <span className="flex items-center gap-2 truncate font-medium">
                      <Hourglass className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="truncate">{c.title}</span>
                    </span>
                    <span className="text-[10px] font-mono-num text-zinc-400 shrink-0 ml-2">
                      {c.targetDate}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions & Navigation */}
          {filteredActions.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Quick Actions & Navigation
              </div>
              <div className="space-y-0.5">
                {filteredActions.map((act, i) => (
                  <button
                    key={i}
                    onClick={act.action}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-100 text-xs text-zinc-700 font-medium"
                  >
                    <span className="flex items-center gap-2.5">
                      {act.icon}
                      <span>{act.label}</span>
                    </span>
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200/80 font-mono text-[10px] text-zinc-500">
                      {act.shortcut}
                    </kbd>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
