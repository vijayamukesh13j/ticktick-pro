import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format, subDays } from 'date-fns';
import {
  Award,
  Check,
  Flame,
  MessageSquarePlus,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Habit, HabitLogEntry } from '../types';
import { HABIT_ICON_KEYS, UiIcon } from './UiIcon';

interface HabitGoalPreset {
  id: string;
  label: string;
  unit: string;
  defaultTarget: number;
  example: string;
}

const HABIT_GOAL_PRESETS: HabitGoalPreset[] = [
  { id: 'glasses', label: 'Glasses', unit: 'glasses', defaultTarget: 8, example: '8 glasses/day' },
  { id: 'mins', label: 'Minutes', unit: 'mins', defaultTarget: 30, example: '30 mins/day' },
  { id: 'pages', label: 'Pages', unit: 'pages', defaultTarget: 20, example: '20 pages/day' },
  { id: 'times', label: 'Times', unit: 'times', defaultTarget: 3, example: '3 times/day' },
  { id: 'ml', label: 'Water (ml)', unit: 'ml', defaultTarget: 2000, example: '2000 ml/day' },
  { id: 'steps', label: 'Steps', unit: 'steps', defaultTarget: 10000, example: '10k steps/day' },
];

function getHabitStep(targetValue: number, unit: string): number {
  const normalizedUnit = (unit || '').trim().toLowerCase();
  if (normalizedUnit === 'glasses' || normalizedUnit === 'times') return 1;
  if (normalizedUnit === 'ml' && targetValue >= 500) return 250;
  if (normalizedUnit === 'steps' && targetValue >= 2000) return 2500;
  if (normalizedUnit === 'mins') {
    return targetValue <= 15 ? 5 : targetValue <= 45 ? 10 : 15;
  }
  if (normalizedUnit === 'pages') {
    return targetValue <= 10 ? 1 : targetValue <= 30 ? 5 : 10;
  }
  if (targetValue <= 10) return 1;
  return Math.max(1, Math.round(targetValue / 4));
}

export const HabitTrackerModule: React.FC = () => {
  const {
    habits,
    addHabit,
    updateHabit,
    toggleHabitDate,
    deleteHabitLog,
    clearHabitLogs,
    deleteHabit,
    rightPaneWidth,
    setRightPaneWidth,
  } = useApp();

  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(habits[0]?.id || null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [quote, setQuote] = useState('');
  const [icon, setIcon] = useState('flame');
  const [color, setColor] = useState('#10b981');
  const [section, setSection] = useState<Habit['section']>('morning');
  const [goalType, setGoalType] = useState<Habit['goalType']>('check');
  const [targetValue, setTargetValue] = useState(1);
  const [unit, setUnit] = useState('times');

  // Habit Log Filter State
  const [habitLogRange, setHabitLogRange] = useState<'all' | '7days' | '30days'>('all');
  const [habitMoodFilter, setHabitMoodFilter] = useState<'all' | 'great' | 'good' | 'neutral' | 'tired'>('all');
  const [mobileHabitView, setMobileHabitView] = useState<'today' | 'matrix'>('today');
  const [isResizing, setIsResizing] = useState(false);
  const matrixScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mobileHabitView === 'matrix' && matrixScrollRef.current) {
      matrixScrollRef.current.scrollLeft = matrixScrollRef.current.scrollWidth;
    }
  }, [mobileHabitView]);

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = rightPaneWidth;
    const onMouseMove = (moveEvent: MouseEvent) => {
      setRightPaneWidth(startWidth + (startX - moveEvent.clientX));
    };
    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const [logModalTarget, setLogModalTarget] = useState<{ habitId: string; dateStr: string } | null>(
    null
  );
  const [logMood, setLogMood] = useState<HabitLogEntry['mood']>('great');
  const [logNote, setLogNote] = useState('');

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const last7Days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i)),
    []
  );

  const calculateStreak = (habit: Habit): number => {
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const dStr = format(subDays(today, i), 'yyyy-MM-dd');
      if (habit.logs[dStr]?.completed) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  };

  const selectedHabit =
    habits.find((h) => h.id === selectedHabitId) ||
    (typeof window !== 'undefined' && window.innerWidth >= 1024 ? habits[0] : null);

  const openEditHabitModal = (habit: Habit) => {
    setEditingHabitId(habit.id);
    setName(habit.name);
    setQuote(habit.quote);
    setIcon(habit.icon);
    setColor(habit.color);
    setSection(habit.section);
    setGoalType(habit.goalType);
    setTargetValue(habit.targetValue);
    setUnit(habit.unit);
    setShowNewModal(true);
  };

  const handleCreateHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editingHabitId) {
      updateHabit(editingHabitId, {
        name: name.trim(),
        quote: quote.trim() || 'Small daily improvements lead to lasting compound results.',
        icon,
        color,
        section,
        goalType,
        targetValue: goalType === 'check' ? 1 : targetValue,
        unit: goalType === 'check' ? 'times' : unit,
      });
    } else {
      addHabit({
        name: name.trim(),
        quote: quote.trim() || 'Small daily improvements lead to lasting compound results.',
        icon,
        color,
        section,
        frequencyType: 'daily',
        frequencyDays: [0, 1, 2, 3, 4, 5, 6],
        frequencyCount: 7,
        goalType,
        targetValue: goalType === 'check' ? 1 : targetValue,
        unit: goalType === 'check' ? 'times' : unit,
        autoPopLog: true,
      });
    }
    setName('');
    setQuote('');
    setEditingHabitId(null);
    setShowNewModal(false);
  };

  const sections: { id: Habit['section']; label: string; iconKey: string }[] = [
    { id: 'morning', label: 'Morning Routine', iconKey: 'sunrise' },
    { id: 'afternoon', label: 'Afternoon', iconKey: 'sun' },
    { id: 'evening', label: 'Evening', iconKey: 'moon' },
    { id: 'anytime', label: 'Anytime', iconKey: 'zap' },
  ];

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full bg-white overflow-y-auto lg:overflow-hidden">
      {/* Main Habit Check-in Matrix */}
      <div className="flex-1 flex flex-col lg:h-full lg:overflow-y-auto p-4 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold text-zinc-900 flex items-center gap-2 tracking-tight">
              <Flame className="w-4 h-4 text-orange-500 shrink-0" strokeWidth={1.75} />
              Habit Tracker ({habits.length}/299)
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Tap any day circle to check in or increment quantified goals (ml, pages, mins).
            </p>
          </div>
          <button
            onClick={() => {
              setEditingHabitId(null);
              setName('');
              setQuote('');
              setIcon('flame');
              setColor('#10b981');
              setSection('morning');
              setGoalType('check');
              setTargetValue(8);
              setUnit('glasses');
              setShowNewModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold shrink-0"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.75} /> New Habit
          </button>
        </div>

        {/* Mobile View Switcher (<768px): Today's Fast Check-in vs 7-Day Matrix */}
        <div className="md:hidden grid grid-cols-2 bg-zinc-100 p-0.5 rounded-xl border border-zinc-200/70 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMobileHabitView('today')}
            className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              mobileHabitView === 'today'
                ? 'bg-white text-zinc-950 shadow-2xs font-semibold'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Today's Habits</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileHabitView('matrix')}
            className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              mobileHabitView === 'matrix'
                ? 'bg-white text-zinc-950 shadow-2xs font-semibold'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <span>Weekly View</span>
          </button>
        </div>

        {/* Mobile Native Checklist for Today */}
        {mobileHabitView === 'today' && (
          <div className="md:hidden space-y-3">
            {sections.map((sec) => {
              const secHabits = habits.filter((h) => h.section === sec.id);
              if (secHabits.length === 0) return null;

              return (
                <div key={sec.id} className="space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 px-1">
                    <UiIcon name={sec.iconKey} className="w-3 h-3 text-zinc-400" />
                    {sec.label}
                  </div>
                  {secHabits.map((habit) => {
                    const streak = calculateStreak(habit);
                    const todayLog = habit.logs[todayStr];
                    const isCompleted = Boolean(todayLog?.completed);
                    const isSelected = selectedHabit?.id === habit.id;

                    return (
                      <div
                        key={habit.id}
                        onClick={() => setSelectedHabitId(habit.id)}
                        className={`surface-card rounded-xl p-3 flex items-center justify-between gap-3 border ${
                          isSelected ? 'border-zinc-900' : 'border-zinc-200/80'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            style={{ backgroundColor: `${habit.color}15`, color: habit.color }}
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-black/[0.04]"
                          >
                            <UiIcon name={habit.icon} className="w-5 h-5" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-zinc-900 truncate flex items-center gap-1.5">
                              {habit.name}
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono-num font-medium text-orange-500">
                                <Flame className="w-3 h-3 fill-orange-500" />
                                {streak}d
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate mt-0.5 font-mono-num">
                              {habit.goalType === 'quantified'
                                ? `Logged: ${todayLog?.value || 0}/${habit.targetValue} ${habit.unit}`
                                : habit.quote}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLogModalTarget({ habitId: habit.id, dateStr: todayStr });
                            }}
                            title="Log Reflection"
                            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                          >
                            <MessageSquarePlus className="w-4 h-4" strokeWidth={1.75} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleHabitDate(habit.id, todayStr);
                            }}
                            style={{
                              backgroundColor: isCompleted ? habit.color : undefined,
                              borderColor: isCompleted ? habit.color : undefined,
                            }}
                            className={`w-9 h-9 rounded-full border-2 flex items-center justify-center font-bold font-mono-num text-xs tactile-press ${
                              isCompleted
                                ? 'text-white shadow-xs'
                                : 'border-zinc-300 text-zinc-400 hover:border-zinc-400'
                            }`}
                          >
                            {isCompleted ? (
                              <Check className="w-4 h-4 stroke-[2.75] animate-check" />
                            ) : habit.goalType === 'quantified' && (todayLog?.value || 0) > 0 ? (
                              <span className="text-[10px] text-zinc-900 font-semibold">
                                {Math.round(((todayLog?.value || 0) / habit.targetValue) * 100)}%
                              </span>
                            ) : null}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* 7-Day Column Header & Matrix (Horizontally scrollable on narrow mobile screens) */}
        <div
          className={`${
            mobileHabitView === 'matrix' ? 'block' : 'hidden md:block'
          } surface-card rounded-xl overflow-hidden`}
        >
          <div ref={matrixScrollRef} className="overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-[minmax(180px,1fr)_repeat(6,40px)_58px] items-center bg-zinc-50 pl-4 pr-2 py-2 border-b border-zinc-200/80 text-[11px] font-semibold text-zinc-500">
                <div>
                  Habit & Daily Goal
                  <span className="sm:hidden font-normal text-[10px] text-zinc-400 ml-1">
                    (← swipe days →)
                  </span>
                </div>
                {last7Days.map((d) => {
                  const dStr = format(d, 'yyyy-MM-dd');
                  const isTodayCol = dStr === todayStr;
                  return (
                    <div
                      key={dStr}
                      data-testid={isTodayCol ? 'habit-weekly-today-header' : undefined}
                      className={`text-center ${
                        isTodayCol
                          ? 'bg-blue-600 text-white rounded-lg py-1 px-1 shadow-2xs font-bold ring-2 ring-blue-500/20'
                          : ''
                      }`}
                    >
                      <div className={isTodayCol ? 'text-[9px] uppercase tracking-wider' : ''}>
                        {isTodayCol ? 'Today' : format(d, 'EEE')}
                      </div>
                      <div className="font-mono-num text-[10px]">{format(d, 'd')}</div>
                    </div>
                  );
                })}
              </div>

              {/* Grouped by Time of Day */}
              <div className="divide-y divide-zinc-100">
                {sections.map((sec) => {
                  const secHabits = habits.filter((h) => h.section === sec.id);
                  if (secHabits.length === 0) return null;

                  return (
                    <div key={sec.id}>
                      <div className="px-4 py-1.5 bg-zinc-50/70 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <UiIcon name={sec.iconKey} className="w-3 h-3 text-zinc-400" />
                        {sec.label}
                      </div>
                      {secHabits.map((habit) => {
                        const streak = calculateStreak(habit);
                        const isSelected = selectedHabit?.id === habit.id;

                        return (
                          <div
                            key={habit.id}
                            onClick={() => setSelectedHabitId(habit.id)}
                            className={`grid grid-cols-[minmax(180px,1fr)_repeat(6,40px)_58px] items-center pl-4 pr-2 py-2.5 cursor-pointer ${
                              isSelected ? 'bg-zinc-900/[0.03]' : 'hover:bg-zinc-50/70'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 pr-2">
                              <span
                                style={{ backgroundColor: `${habit.color}15`, color: habit.color }}
                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-black/[0.04]"
                              >
                                <UiIcon name={habit.icon} className="w-4 h-4" />
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-zinc-900 truncate flex items-center gap-1.5">
                                  <span className="truncate">{habit.name}</span>
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-mono-num font-semibold text-orange-500 shrink-0">
                                    <Flame className="w-3 h-3 fill-orange-500" />
                                    {streak}d
                                  </span>
                                </div>
                                <div className="text-[10px] text-zinc-400 truncate font-mono-num">
                                  {habit.goalType === 'quantified'
                                    ? `Goal: ${habit.targetValue} ${habit.unit}/day`
                                    : habit.quote}
                                </div>
                              </div>
                            </div>

                            {last7Days.map((d) => {
                              const dStr = format(d, 'yyyy-MM-dd');
                              const isTodayCol = dStr === todayStr;
                              const entry = habit.logs[dStr];
                              const isCompleted = entry?.completed;
                              const partialPct =
                                habit.goalType === 'quantified' && entry
                                  ? Math.min(100, Math.round((entry.value / habit.targetValue) * 100))
                                  : isCompleted
                                    ? 100
                                    : 0;

                              return (
                                <div
                                  key={dStr}
                                  className={`flex items-center justify-center ${
                                    isTodayCol
                                      ? 'bg-blue-50/60 border-l border-blue-200/60 py-1 rounded-r-lg'
                                      : ''
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleHabitDate(habit.id, dStr);
                                    }}
                                    title={
                                      entry
                                        ? `${entry.value}/${habit.targetValue} ${habit.unit}`
                                        : 'Click to check in'
                                    }
                                    style={{
                                      backgroundColor: isCompleted
                                        ? habit.color
                                        : partialPct > 0
                                          ? `${habit.color}26`
                                          : undefined,
                                      borderColor:
                                        isCompleted || partialPct > 0 ? habit.color : undefined,
                                    }}
                                    className={`${
                                      isTodayCol ? 'w-8 h-8 ring-2 ring-blue-500/20' : 'w-7 h-7'
                                    } rounded-full border flex items-center justify-center text-[10px] font-mono-num font-bold ${
                                      isCompleted
                                        ? 'text-white'
                                        : partialPct > 0
                                          ? 'text-zinc-900'
                                          : isTodayCol
                                            ? 'border-blue-400 bg-white hover:border-blue-600 text-zinc-400'
                                            : 'border-zinc-200 hover:border-zinc-400 text-zinc-300'
                                    }`}
                                  >
                                    {isCompleted ? (
                                      <Check className="w-3.5 h-3.5 stroke-[2.75] animate-check" />
                                    ) : partialPct > 0 ? (
                                      `${partialPct}%`
                                    ) : (
                                      ''
                                    )}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Selected Habit Statistics, Streak & Mood/Thought Log */}
      {selectedHabit && (
        <aside
          style={{ '--right-pane-width': `${rightPaneWidth}px` } as React.CSSProperties}
          className="w-full lg:w-[var(--right-pane-width)] relative border-t lg:border-t-0 lg:border-l border-zinc-200/80 bg-zinc-50/50 p-4 sm:p-6 flex flex-col space-y-5 lg:overflow-y-auto shrink-0"
        >
          {/* PC Left-Edge Drag Resize Handle */}
          <div
            onMouseDown={handleMouseDownResize}
            title="Drag to resize right inspector (280px – 680px)"
            aria-label="Resize Habit Inspector"
            className="hidden lg:flex absolute inset-y-0 left-0 w-2 cursor-col-resize items-center justify-center group z-20 hover:bg-blue-500/10"
          >
            <div
              className={`w-[2px] h-10 rounded-full transition-colors ${
                isResizing ? 'bg-blue-600' : 'bg-zinc-200/80 group-hover:bg-blue-600'
              }`}
            />
          </div>

          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <span
                style={{ backgroundColor: `${selectedHabit.color}18`, color: selectedHabit.color }}
                className="w-10 h-10 rounded-xl flex items-center justify-center border border-black/[0.04] shrink-0"
              >
                <UiIcon name={selectedHabit.icon} className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-zinc-900 truncate">{selectedHabit.name}</h2>
                <p className="text-[11px] text-zinc-500 italic truncate">"{selectedHabit.quote}"</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => openEditHabitModal(selectedHabit)}
                title="Edit Habit"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200/60"
              >
                <Pencil className="w-4 h-4" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => deleteHabit(selectedHabit.id)}
                title="Delete Habit"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => setSelectedHabitId(null)}
                title="Close Inspector"
                className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200/60"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-zinc-200/80">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Current Streak
              </div>
              <div className="text-xl font-bold font-mono-num text-zinc-900 mt-1 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                {calculateStreak(selectedHabit)} Days
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-zinc-200/80">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Total Check-ins
              </div>
              <div className="text-xl font-bold font-mono-num text-emerald-600 mt-1 flex items-center gap-1.5">
                <Award className="w-4 h-4" strokeWidth={1.75} />
                {Object.values(selectedHabit.logs).filter((l) => l.completed).length} Days
              </div>
            </div>
          </div>

          {/* Add Mood & Thought Log for Today */}
          <div className="p-4 rounded-xl bg-white border border-zinc-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5 font-mono-num">
                <Sparkles className="w-3.5 h-3.5 text-zinc-600" strokeWidth={1.75} />
                Today ({todayStr})
              </span>
              <div className="flex items-center gap-2">
                {selectedHabit.logs[todayStr] && (
                  <button
                    type="button"
                    onClick={() => deleteHabitLog(selectedHabit.id, todayStr)}
                    title="Remove today's check-in"
                    className="text-[11px] text-rose-600 font-semibold hover:text-rose-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" strokeWidth={1.75} /> Remove
                  </button>
                )}
                <button
                  onClick={() => setLogModalTarget({ habitId: selectedHabit.id, dateStr: todayStr })}
                  className="text-[11px] text-zinc-700 font-semibold hover:text-zinc-900 flex items-center gap-1"
                >
                  <MessageSquarePlus className="w-3 h-3" strokeWidth={1.75} /> Log Reflection
                </button>
              </div>
            </div>

            {selectedHabit.goalType === 'quantified' ? (
              (() => {
                const currentVal = selectedHabit.logs[todayStr]?.value || 0;
                const step = getHabitStep(selectedHabit.targetValue, selectedHabit.unit);
                const pct = Math.min(100, Math.round((currentVal / selectedHabit.targetValue) * 100));
                const isGoalMet = currentVal >= selectedHabit.targetValue;

                return (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono-num">
                      <span className="text-zinc-700 font-semibold">
                        {currentVal} / {selectedHabit.targetValue} {selectedHabit.unit}
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          isGoalMet ? 'text-emerald-600' : 'text-zinc-500'
                        }`}
                      >
                        {pct}% {isGoalMet ? '• Goal Reached ✓' : ''}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        style={{
                          width: `${pct}%`,
                          backgroundColor: isGoalMet ? '#10b981' : selectedHabit.color,
                        }}
                        className="h-full rounded-full transition-all duration-200"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {currentVal > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleHabitDate(selectedHabit.id, todayStr, -step)}
                          title={`Subtract ${step} ${selectedHabit.unit}`}
                          className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-[11px] font-mono-num font-semibold"
                        >
                          -{step}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleHabitDate(selectedHabit.id, todayStr, step)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-mono-num font-semibold"
                      >
                        + Add {step} {selectedHabit.unit}
                      </button>
                      {!isGoalMet && (
                        <button
                          type="button"
                          onClick={() =>
                            toggleHabitDate(
                              selectedHabit.id,
                              todayStr,
                              selectedHabit.targetValue - currentVal
                            )
                          }
                          className="py-1.5 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-semibold"
                        >
                          Complete All
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              <button
                onClick={() => toggleHabitDate(selectedHabit.id, todayStr)}
                className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
                  selectedHabit.logs[todayStr]?.completed
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
                }`}
              >
                {selectedHabit.logs[todayStr]?.completed ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Completed Today
                  </>
                ) : (
                  'Mark Today Complete'
                )}
              </button>
            )}
          </div>

          {/* Habit Check-in Journal Logs with Filters & Delete Actions */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Habit Journal & Mood Logs ({Object.keys(selectedHabit.logs).length})
              </h3>
              {Object.keys(selectedHabit.logs).length > 0 && (
                <button
                  type="button"
                  onClick={() => clearHabitLogs(selectedHabit.id)}
                  className="text-[10px] font-semibold text-rose-600 hover:text-rose-700 px-1.5 py-0.5 rounded hover:bg-rose-50"
                >
                  Clear History
                </button>
              )}
            </div>

            {/* Filter Bar: Date Range & Mood */}
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="inline-flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/70">
                {(
                  [
                    ['all', 'All'],
                    ['7days', '7 Days'],
                    ['30days', '30 Days'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setHabitLogRange(id)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                      habitLogRange === id
                        ? 'bg-white text-zinc-900 shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <select
                aria-label="Filter habit logs by mood"
                value={habitMoodFilter}
                onChange={(e) => setHabitMoodFilter(e.target.value as typeof habitMoodFilter)}
                className="text-[10px] font-semibold px-2 py-1 rounded-lg border border-zinc-200/80 bg-white text-zinc-700 focus:outline-none"
              >
                <option value="all">All Moods</option>
                <option value="great">Great</option>
                <option value="good">Good</option>
                <option value="neutral">Neutral</option>
                <option value="tired">Tired</option>
              </select>
            </div>

            {(() => {
              const cutoff7 = format(subDays(today, 7), 'yyyy-MM-dd');
              const cutoff30 = format(subDays(today, 30), 'yyyy-MM-dd');
              const filteredLogs = Object.entries(selectedHabit.logs)
                .filter(([dateKey, log]) => {
                  if (habitLogRange === '7days' && dateKey < cutoff7) return false;
                  if (habitLogRange === '30days' && dateKey < cutoff30) return false;
                  if (habitMoodFilter !== 'all' && (log.mood || 'great') !== habitMoodFilter) {
                    return false;
                  }
                  return true;
                })
                .sort(([a], [b]) => b.localeCompare(a));

              if (filteredLogs.length === 0) {
                return (
                  <div className="text-center py-6 text-xs text-zinc-400 bg-white rounded-xl border border-zinc-200/70">
                    No habit logs match the active filter.
                  </div>
                );
              }

              return filteredLogs.map(([dateKey, log]) => (
                <div
                  key={dateKey}
                  className="group p-3 rounded-xl bg-white border border-zinc-200/80 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-num font-semibold text-zinc-700">{dateKey}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono-num px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 font-medium capitalize">
                        {log.value} {selectedHabit.unit} • {log.mood || 'great'}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteHabitLog(selectedHabit.id, dateKey)}
                        title={`Delete habit log for ${dateKey}`}
                        aria-label={`Delete habit log ${dateKey}`}
                        className="p-1 rounded hover:bg-rose-50 text-zinc-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                  {log.note && <p className="text-zinc-500">{log.note}</p>}
                </div>
              ));
            })()}
          </div>
        </aside>
      )}

      {/* Modal: Create Habit */}
      {showNewModal && (
        <div
          onClick={() => setShowNewModal(false)}
          className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-backdrop"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateHabit}
            className="surface-floating bg-white rounded-xl w-full max-w-md max-h-[90dvh] overflow-y-auto p-5 space-y-4 animate-modal"
          >
            <h3 className="text-sm font-semibold text-zinc-900">
              {editingHabitId ? 'Edit Habit' : 'Create New Habit'}
            </h3>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Habit Name</label>
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Practice Guitar 20m"
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 focus:outline-none focus:border-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">Icon</label>
              <div className="flex flex-wrap gap-1.5">
                {HABIT_ICON_KEYS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setIcon(item.key)}
                    title={item.label}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                      icon === item.key
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                    }`}
                  >
                    <UiIcon name={item.key} className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Motivational Quote
              </label>
              <input
                type="text"
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="Why does this habit matter to you?"
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 focus:outline-none focus:border-zinc-900"
              />
            </div>

            {/* Time of Day */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">Time of Day</label>
              <div className="grid grid-cols-4 gap-1.5 bg-zinc-100 p-1 rounded-lg border border-zinc-200/70">
                {(
                  [
                    ['morning', 'Morning'],
                    ['afternoon', 'Afternoon'],
                    ['evening', 'Evening'],
                    ['anytime', 'Anytime'],
                  ] as const
                ).map(([secId, secLabel]) => (
                  <button
                    key={secId}
                    type="button"
                    onClick={() => setSection(secId)}
                    className={`py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                      section === secId
                        ? 'bg-white text-zinc-900 shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    {secLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Tracking Mode: Simple Check-in vs Preset Count/Measure */}
            <div className="space-y-2.5">
              <label className="block text-xs font-medium text-zinc-600">
                How do you want to track it?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGoalType('check')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    goalType === 'check'
                      ? 'border-zinc-900 bg-zinc-900/[0.03] ring-1 ring-zinc-900'
                      : 'border-zinc-200 hover:border-zinc-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-900">Simple Check-in</span>
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center border ${
                        goalType === 'check'
                          ? 'bg-zinc-900 border-zinc-900 text-white'
                          : 'border-zinc-300'
                      }`}
                    >
                      {goalType === 'check' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Done or Not Done (1 tap/day)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGoalType('quantified');
                    if (goalType === 'check' && targetValue <= 1) {
                      setUnit('glasses');
                      setTargetValue(8);
                    }
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    goalType === 'quantified'
                      ? 'border-zinc-900 bg-zinc-900/[0.03] ring-1 ring-zinc-900'
                      : 'border-zinc-200 hover:border-zinc-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-900">Count / Measure</span>
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center border ${
                        goalType === 'quantified'
                          ? 'bg-zinc-900 border-zinc-900 text-white'
                          : 'border-zinc-300'
                      }`}
                    >
                      {goalType === 'quantified' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Glasses, mins, pages, steps...
                  </p>
                </button>
              </div>

              {goalType === 'quantified' && (
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-3">
                  <div>
                    <div className="text-[11px] font-semibold text-zinc-600 mb-1.5">
                      1. Pick a Unit Preset
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {HABIT_GOAL_PRESETS.map((preset) => {
                        const isSelected = unit === preset.unit;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setUnit(preset.unit);
                              setTargetValue(preset.defaultTarget);
                            }}
                            className={`px-2.5 py-1.5 rounded-[6px] border text-left transition-all ${
                              isSelected
                                ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs'
                                : 'bg-white text-zinc-700 border-zinc-200/90 hover:bg-zinc-100'
                            }`}
                          >
                            <div className="text-[11px] font-semibold leading-tight">
                              {preset.label}
                            </div>
                            <div
                              className={`text-[10px] font-mono-num mt-0.5 ${
                                isSelected ? 'text-zinc-300' : 'text-zinc-400'
                              }`}
                            >
                              {preset.example}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="habit-daily-target-input"
                      className="block text-[11px] font-semibold text-zinc-600 mb-1.5"
                    >
                      2. Set Daily Target ({unit}/day)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const step = getHabitStep(targetValue, unit);
                          setTargetValue((v) => Math.max(1, v - step));
                        }}
                        className="w-8 h-8 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 font-mono-num font-bold text-sm flex items-center justify-center shrink-0"
                      >
                        -
                      </button>
                      <div className="relative flex-1">
                        <input
                          id="habit-daily-target-input"
                          type="number"
                          min={1}
                          value={targetValue}
                          onChange={(e) => setTargetValue(Math.max(1, Number(e.target.value)))}
                          className="w-full px-3 py-1.5 pr-16 text-xs font-semibold rounded-lg border border-zinc-300 bg-white font-mono-num focus:outline-none focus:border-zinc-900"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-zinc-400 pointer-events-none">
                          {unit}/day
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const step = getHabitStep(targetValue, unit);
                          setTargetValue((v) => v + step);
                        }}
                        className="w-8 h-8 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 font-mono-num font-bold text-sm flex items-center justify-center shrink-0"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Clear Live Tracking Preview */}
              <div className="px-3 py-2 rounded-lg bg-zinc-100/80 border border-zinc-200/70 text-[11px] text-zinc-600 flex items-center justify-between gap-2">
                <span>
                  <strong className="text-zinc-800">Preview:</strong>{' '}
                  {goalType === 'check'
                    ? '1 tap on the circle marks the day 100% complete ✓'
                    : `Goal: ${targetValue} ${unit}/day • Each tap adds +${getHabitStep(
                        targetValue,
                        unit
                      )} ${unit}`}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">Accent Color</label>
              <div className="flex gap-2">
                {['#10b981', '#0ea5e9', '#6366f1', '#f59e0b', '#ec4899', '#ef4444'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-5 h-5 rounded-full ${
                      color === c ? 'ring-2 ring-offset-2 ring-zinc-900' : ''
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800"
              >
                {editingHabitId ? 'Save Changes' : 'Create Habit'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Habit Mood & Reflection Log */}
      {logModalTarget && (
        <div
          onClick={() => setLogModalTarget(null)}
          className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-backdrop"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              toggleHabitDate(
                logModalTarget.habitId,
                logModalTarget.dateStr,
                undefined,
                logNote,
                logMood
              );
              setLogNote('');
              setLogModalTarget(null);
            }}
            className="surface-floating rounded-xl w-full max-w-sm p-5 space-y-3 animate-modal"
          >
            <h3 className="text-sm font-semibold text-zinc-900">Habit Check-in Reflection</h3>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">How did it feel?</label>
              <select
                value={logMood}
                onChange={(e) => setLogMood(e.target.value as HabitLogEntry['mood'])}
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 bg-white"
              >
                <option value="great">Great / Energized</option>
                <option value="good">Good / Steady</option>
                <option value="neutral">Neutral</option>
                <option value="tired">Tired</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Journal Note</label>
              <textarea
                rows={3}
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                placeholder="Write a quick reflection on your streak..."
                className="w-full p-2.5 text-xs rounded-lg border border-zinc-300 focus:outline-none focus:border-zinc-900"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLogModalTarget(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800"
              >
                Save Check-in
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
