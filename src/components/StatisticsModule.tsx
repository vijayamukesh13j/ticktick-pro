import React, { useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { Award, BarChart3, CheckCircle2, Flame, Timer, TrendingUp } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { pruneOldFocusSessions } from '../utils/focusLogs';

export const StatisticsModule: React.FC = () => {
  const { tasks, habits, pomodoroSessions, preferences, lists } = useApp();

  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const activeTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'trash');
  const completionRate =
    tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  const recentFocusSessions = useMemo(
    () => pruneOldFocusSessions(pomodoroSessions),
    [pomodoroSessions]
  );
  const totalFocusMinutes = recentFocusSessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const totalHabitCheckins = habits.reduce(
    (acc, h) => acc + Object.values(h.logs).filter((l) => l.completed).length,
    0
  );

  const today = new Date();
  const last7Days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));

  return (
    <div className="flex-1 h-full bg-zinc-50/70 overflow-y-auto p-3.5 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        {/* Header & TickTick Achievement Score Card (Disciplined Dark Zinc, Zero AI Slop Gradients) */}
        <div className="rounded-2xl bg-zinc-900 text-zinc-100 p-4 sm:p-6 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-400/10 border border-amber-400/20 text-amber-300 text-[11px] font-semibold">
              <Award className="w-3.5 h-3.5" strokeWidth={1.75} /> Executive Telemetry
            </div>
            <h1 className="text-lg font-semibold tracking-tight">
              Productivity & Achievement Statistics
            </h1>
            <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
              Your Achievement Score increases as you complete tasks on time, log Pomodoros, and maintain daily habit streaks.
            </p>
          </div>
          <div className="bg-zinc-950/90 border border-white/[0.08] rounded-xl px-5 py-3 text-center shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
              Achievement Score
            </div>
            <div className="text-3xl font-bold font-mono-num text-white mt-0.5">
              {preferences.achievementScore}
            </div>
            <div className="text-[10px] font-mono-num text-emerald-400 font-medium mt-0.5">
              Level 8 • Top 3% Focus
            </div>
          </div>
        </div>

        {/* 4 Key KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 surface-card rounded-xl">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Completed Tasks</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
            </div>
            <div className="text-2xl font-bold font-mono-num text-zinc-900 mt-2">
              {completedTasks.length}
            </div>
            <div className="text-[11px] font-mono-num text-emerald-600 mt-1">
              {completionRate}% completion rate
            </div>
          </div>

          <div className="p-4 surface-card rounded-xl">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Focus Duration (7d)</span>
              <Timer className="w-4 h-4 text-blue-600" strokeWidth={1.75} />
            </div>
            <div className="text-2xl font-bold font-mono-num text-zinc-900 mt-2">
              {Math.floor(totalFocusMinutes / 60)}h {totalFocusMinutes % 60}m
            </div>
            <div className="text-[11px] font-mono-num text-zinc-500 mt-1">
              Across {recentFocusSessions.length} focus sessions
            </div>
          </div>

          <div className="p-4 surface-card rounded-xl">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Habit Check-ins</span>
              <Flame className="w-4 h-4 text-orange-500" strokeWidth={1.75} />
            </div>
            <div className="text-2xl font-bold font-mono-num text-zinc-900 mt-2">
              {totalHabitCheckins}
            </div>
            <div className="text-[11px] font-mono-num text-zinc-500 mt-1">
              {habits.length} active daily habits
            </div>
          </div>

          <div className="p-4 surface-card rounded-xl">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Pending Workload</span>
              <TrendingUp className="w-4 h-4 text-zinc-700" strokeWidth={1.75} />
            </div>
            <div className="text-2xl font-bold font-mono-num text-zinc-900 mt-2">
              {activeTasks.length}
            </div>
            <div className="text-[11px] font-mono-num text-zinc-500 mt-1">
              {activeTasks.filter((t) => t.priority === 5).length} high-priority tasks
            </div>
          </div>
        </div>

        {/* Charts Row: 7-Day Focus & Habit Trend + List Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 7-Day Activity Bar Chart */}
          <div className="p-5 surface-card rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-zinc-900 flex items-center gap-2 uppercase tracking-wider">
                <BarChart3 className="w-4 h-4 text-zinc-700" strokeWidth={1.75} />
                7-Day Focus & Habit Consistency
              </h2>
              <span className="text-[11px] font-mono-num text-zinc-400">Last 7 Days</span>
            </div>

            <div className="h-44 flex items-end justify-between gap-3 pt-4 px-2">
              {last7Days.map((d) => {
                const dStr = format(d, 'yyyy-MM-dd');
                const dayFocus = recentFocusSessions
                  .filter((s) => s.startTime.startsWith(dStr))
                  .reduce((a, b) => a + b.durationMinutes, 0);
                const dayHabits = habits.filter((h) => h.logs[dStr]?.completed).length;
                const heightPct = Math.max(12, Math.min(100, dayFocus + dayHabits * 14));

                return (
                  <div key={dStr} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full h-32 bg-zinc-100 rounded-lg flex items-end overflow-hidden p-0.5 border border-zinc-200/60">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className="w-full rounded-md bg-zinc-900 transition-all duration-200"
                        title={`${dayFocus}m focus, ${dayHabits} habits completed`}
                      />
                    </div>
                    <span className="text-[10px] font-mono-num text-zinc-500">
                      {format(d, 'EEE')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Task Distribution by List & Priority */}
          <div className="p-5 surface-card rounded-xl space-y-4">
            <h2 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
              Task Distribution by List
            </h2>
            <div className="space-y-3">
              {lists.map((list) => {
                const count = tasks.filter((t) => t.listId === list.id).length;
                const pct = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0;
                return (
                  <div key={list.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-700 flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: list.color }}
                        />
                        {list.name}
                      </span>
                      <span className="font-mono-num text-zinc-500">
                        {count} tasks ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        style={{ width: `${Math.max(5, pct)}%`, backgroundColor: list.color }}
                        className="h-full rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
