import React, { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import {
  CheckCircle2,
  Clock,
  Headphones,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Timer,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WHITE_NOISE_OPTIONS } from '../utils/soundEngine';
import { UiIcon } from './UiIcon';

export const PomodoroModule: React.FC = () => {
  const {
    tasks,
    preferences,
    updatePreferences,
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
    pomodoroSessions,
    logManualFocusSession,
    deletePomodoroSession,
    clearPomodoroSessions,
  } = useApp();

  const [sessionNote, setSessionNote] = useState('');
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualMinutes, setManualMinutes] = useState(25);
  const [manualNote, setManualNote] = useState('');
  const [showPomoSettings, setShowPomoSettings] = useState(false);
  const [mobileTab, setMobileTab] = useState<'timer' | 'history'>('timer');

  // Focus Log Filter States
  const [logRangeFilter, setLogRangeFilter] = useState<'all' | 'today' | '7days'>('all');
  const [logModeFilter, setLogModeFilter] = useState<'all' | 'pomo' | 'stopwatch'>('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  const filteredSessions = useMemo(() => {
    const todayPrefix = format(new Date(), 'yyyy-MM-dd');
    const sevenDaysAgoPrefix = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    return pomodoroSessions.filter((sess) => {
      const dateStr = sess.startTime.slice(0, 10);
      if (logRangeFilter === 'today' && dateStr !== todayPrefix) return false;
      if (logRangeFilter === '7days' && dateStr < sevenDaysAgoPrefix) return false;
      if (logModeFilter !== 'all' && sess.mode !== logModeFilter) return false;
      if (logSearchQuery.trim()) {
        const q = logSearchQuery.toLowerCase();
        const matchTitle = sess.taskTitle.toLowerCase().includes(q);
        const matchNote = (sess.note || '').toLowerCase().includes(q);
        if (!matchTitle && !matchNote) return false;
      }
      return true;
    });
  }, [pomodoroSessions, logRangeFilter, logModeFilter, logSearchQuery]);

  const openTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'trash');

  const displaySeconds = pomoMode === 'pomo' ? pomoSecondsLeft : stopwatchSeconds;
  const mins = Math.floor(displaySeconds / 60);
  const secs = displaySeconds % 60;

  const totalPhaseSeconds =
    pomoPhase === 'work'
      ? preferences.pomoDuration * 60
      : pomoPhase === 'short_break'
        ? preferences.shortBreakDuration * 60
        : preferences.longBreakDuration * 60;

  const progressRatio =
    pomoMode === 'pomo'
      ? Math.max(0, Math.min(1, 1 - pomoSecondsLeft / Math.max(1, totalPhaseSeconds)))
      : (stopwatchSeconds % 1500) / 1500;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todaySessions = pomodoroSessions.filter((s) => s.startTime.startsWith(todayStr));
  const todayFocusMinutes = todaySessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const totalFocusMinutes = pomodoroSessions.reduce((acc, s) => acc + s.durationMinutes, 0);

  const circleRadius = 110;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference * (1 - progressRatio);

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full bg-zinc-50/70 overflow-y-auto">
      {/* Mobile Top Segmented Tab Switcher */}
      <div className="lg:hidden px-3 pt-3 pb-2 shrink-0 bg-white/70 backdrop-blur-xs border-b border-zinc-200/80">
        <div className="grid grid-cols-2 bg-zinc-100 p-0.5 rounded-xl border border-zinc-200/70 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMobileTab('timer')}
            className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              mobileTab === 'timer'
                ? 'bg-white text-zinc-950 shadow-2xs font-semibold'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            <span>Focus Timer</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('history')}
            className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              mobileTab === 'history'
                ? 'bg-white text-zinc-950 shadow-2xs font-semibold'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Records & Stats ({pomodoroSessions.length})</span>
          </button>
        </div>
      </div>

      {/* Left / Center: Interactive Focus Timer & White Noise Studio */}
      <div
        className={`flex-1 p-3.5 sm:p-6 flex-col items-center justify-start lg:justify-center ${
          mobileTab === 'timer' ? 'flex' : 'hidden lg:flex'
        }`}
      >
        <div className="w-full max-w-md surface-card rounded-2xl p-4 sm:p-6 flex flex-col items-center space-y-4 sm:space-y-5">
          {/* Mode Switcher: Pomo vs Stopwatch + Timer Settings (Switching tabs NEVER stops a running timer) */}
          <div className="w-full flex items-center justify-between">
            <div className="inline-flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/70">
              <button
                onClick={() => setPomoMode('pomo')}
                className={`px-3.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 ${
                  pomoMode === 'pomo'
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <span>Pomodoro</span>
                {pomoTimerRunning && (
                  <span
                    data-testid="pomo-running-indicator"
                    className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"
                  />
                )}
              </button>
              <button
                onClick={() => setPomoMode('stopwatch')}
                className={`px-3.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 ${
                  pomoMode === 'stopwatch'
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <span>Stopwatch</span>
                {stopwatchRunning && (
                  <span
                    data-testid="stopwatch-running-indicator"
                    className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
                  />
                )}
              </button>
            </div>

            <button
              onClick={() => setShowPomoSettings((v) => !v)}
              title="Customize Pomodoro Durations"
              className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            >
              <Settings2 className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>

          {/* Phase Pills for Pomodoro Mode */}
          {pomoMode === 'pomo' && (
            <div className="flex flex-wrap sm:flex-nowrap justify-center items-center gap-1.5 font-mono-num animate-view-switch">
              {(
                [
                  ['work', `Focus (${preferences.pomoDuration}m)`],
                  ['short_break', `Short (${preferences.shortBreakDuration}m)`],
                  ['long_break', `Long (${preferences.longBreakDuration}m)`],
                ] as const
              ).map(([phaseId, label]) => (
                <button
                  key={phaseId}
                  onClick={() => setPomoPhase(phaseId)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                    pomoPhase === phaseId
                      ? 'bg-zinc-900 text-white border-zinc-900 font-semibold'
                      : 'bg-zinc-50 text-zinc-600 border-zinc-200/80 hover:bg-zinc-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Target Task Selector */}
          <div className="w-full">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 text-center mb-1">
              Focusing On Task
            </label>
            <select
              value={activePomoTaskId || ''}
              onChange={(e) => setActivePomoTaskId(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200/90 bg-zinc-50 text-xs font-medium text-zinc-800 focus:outline-none focus:border-zinc-900"
            >
              <option value="">General Deep Work Session</option>
              {openTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}{' '}
                  {t.estimatedPomos > 0
                    ? `(${t.completedPomos}/${t.estimatedPomos} Pomo)`
                    : t.completedPomos > 0
                      ? `(${t.completedPomos} Pomo)`
                      : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Distinct Animated Dial: Pomodoro Orbital Breathing Dial vs Stopwatch 60-Tick Chronograph */}
          {pomoMode === 'pomo' ? (
            <div
              data-testid="pomo-timer-dial"
              className="relative w-48 h-48 sm:w-56 sm:h-56 md:w-60 md:h-60 flex items-center justify-center animate-view-switch"
            >
              {/* Breathing Aura Ring when Pomodoro is running */}
              {pomoTimerRunning && (
                <div
                  className={`absolute inset-3 rounded-full pointer-events-none animate-pomo-breathe ${
                    pomoPhase === 'work' ? 'bg-blue-500/15' : 'bg-emerald-500/15'
                  }`}
                />
              )}

              <svg className="w-full h-full -rotate-90" viewBox="0 0 260 260">
                {/* Inner decorative dashed ring */}
                <circle
                  cx="130"
                  cy="130"
                  r={circleRadius - 14}
                  stroke="#e4e4e7"
                  strokeWidth="1.5"
                  strokeDasharray="4 6"
                  fill="none"
                />
                {/* Track ring */}
                <circle
                  cx="130"
                  cy="130"
                  r={circleRadius}
                  stroke="#f4f4f5"
                  strokeWidth="8"
                  fill="none"
                />
                {/* Countdown progress arc */}
                <circle
                  cx="130"
                  cy="130"
                  r={circleRadius}
                  stroke={pomoPhase === 'work' ? '#2563eb' : '#10b981'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-500"
                />
                {/* Glowing Orbital Comet Tip */}
                {(() => {
                  const angleRad = progressRatio * 2 * Math.PI;
                  const tipX = 130 + circleRadius * Math.cos(angleRad);
                  const tipY = 130 + circleRadius * Math.sin(angleRad);
                  return (
                    <g>
                      {pomoTimerRunning && (
                        <circle
                          cx={tipX}
                          cy={tipY}
                          r="9"
                          fill={pomoPhase === 'work' ? '#3b82f6' : '#10b981'}
                          opacity="0.3"
                        />
                      )}
                      <circle
                        cx={tipX}
                        cy={tipY}
                        r="5"
                        fill={pomoPhase === 'work' ? '#2563eb' : '#10b981'}
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                    </g>
                  );
                })()}
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 mb-1">
                  {pomoPhase === 'work' ? 'Countdown Timer' : 'Break Timer'}
                </span>
                <span className="text-4xl sm:text-5xl font-bold font-mono-num tracking-tight text-zinc-900">
                  {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </span>
                <span className="text-xs font-medium text-zinc-400 mt-1 sm:mt-1.5 flex items-center gap-1.5">
                  {pomoTimerRunning && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                  )}
                  {pomoTimerRunning ? 'Deep work in progress' : 'Ready to focus'}
                </span>
              </div>
            </div>
          ) : (
            <div
              data-testid="stopwatch-dial"
              className="relative w-48 h-48 sm:w-56 sm:h-56 md:w-60 md:h-60 flex items-center justify-center animate-view-switch"
            >
              {/* Expanding Sonar Ripple Ring when Stopwatch is running */}
              {stopwatchRunning && (
                <div className="absolute inset-4 rounded-full border-2 border-emerald-500/40 pointer-events-none animate-stopwatch-ripple" />
              )}

              <svg className="w-full h-full" viewBox="0 0 260 260">
                {/* 60 Radial Chronograph Second Ticks */}
                {Array.from({ length: 60 }, (_, idx) => {
                  const angleDeg = idx * 6 - 90;
                  const angleRad = (angleDeg * Math.PI) / 180;
                  const isMajor = idx % 5 === 0;
                  const outerR = circleRadius + 4;
                  const innerR = isMajor ? circleRadius - 8 : circleRadius - 3;
                  const x1 = 130 + innerR * Math.cos(angleRad);
                  const y1 = 130 + innerR * Math.sin(angleRad);
                  const x2 = 130 + outerR * Math.cos(angleRad);
                  const y2 = 130 + outerR * Math.sin(angleRad);
                  const activeSecond = stopwatchSeconds % 60;
                  const isLit = stopwatchRunning
                    ? idx <= activeSecond
                    : stopwatchSeconds > 0 && idx <= activeSecond;

                  return (
                    <line
                      key={idx}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isLit ? '#10b981' : isMajor ? '#d4d4d8' : '#e4e4e7'}
                      strokeWidth={isMajor ? '2.5' : '1.5'}
                      strokeLinecap="round"
                    />
                  );
                })}

                {/* Sweeping Chronograph Radar Hand when running */}
                {stopwatchRunning && (
                  <g className="animate-stopwatch-sweep">
                    <line
                      x1="130"
                      y1="130"
                      x2="130"
                      y2={130 - (circleRadius - 14)}
                      stroke="#10b981"
                      strokeWidth="2"
                      strokeLinecap="round"
                      opacity="0.65"
                    />
                    <circle cx="130" cy={130 - (circleRadius - 14)} r="3.5" fill="#10b981" />
                  </g>
                )}
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 mb-1">
                  Chronograph
                </span>
                <span className="text-4xl sm:text-5xl font-bold font-mono-num tracking-tight text-zinc-900">
                  {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </span>
                <span className="text-xs font-medium text-zinc-400 mt-1 sm:mt-1.5 flex items-center gap-1.5">
                  {stopwatchRunning && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  )}
                  {stopwatchRunning ? 'Stopwatch counting up' : 'Ready to focus'}
                </span>
              </div>
            </div>
          )}

          {/* Controls: Start / Pause / Reset / Complete & Log */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setPomoRunning(!pomoRunning)}
              className="px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs flex items-center gap-2"
            >
              {pomoRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" /> Pause
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> Start Focus
                </>
              )}
            </button>

            <button
              onClick={resetPomoTimer}
              title="Reset Timer"
              className="p-2.5 rounded-xl border border-zinc-200/90 text-zinc-600 hover:bg-zinc-100"
            >
              <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
            </button>

            <button
              onClick={() => {
                completeCurrentPomoSession(sessionNote);
                setSessionNote('');
              }}
              title="Finish & Log Focus Session Now"
              className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" strokeWidth={1.75} /> Finish & Log
            </button>
          </div>

          {/* Premium White Noise / Ambient Sound Mixer */}
          <div className="w-full pt-4 border-t border-zinc-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
                <Headphones className="w-4 h-4 text-zinc-600" strokeWidth={1.75} />
                White Noise & Ambient Sound
              </span>
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.75} />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={whiteNoiseVolume}
                  onChange={(e) => setWhiteNoiseVolume(Number(e.target.value))}
                  aria-label="White noise volume"
                  className="w-20 accent-zinc-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {WHITE_NOISE_OPTIONS.map((opt) => {
                const isSelected = activeWhiteNoise === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setActiveWhiteNoise(opt.id)}
                    className={`p-2 rounded-lg border text-left ${
                      isSelected
                        ? 'bg-zinc-900 border-zinc-900 text-white'
                        : 'bg-zinc-50/80 border-zinc-200/80 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <div className="text-xs font-semibold flex items-center gap-1.5">
                      <UiIcon name={opt.icon} className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{opt.name}</span>
                    </div>
                    <div
                      className={`text-[10px] truncate mt-0.5 ${
                        isSelected ? 'text-zinc-300' : 'text-zinc-400'
                      }`}
                    >
                      {opt.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Focus Statistics & Record History */}
      <div
        className={`w-full lg:w-[420px] border-t lg:border-t-0 lg:border-l border-zinc-200/80 bg-white p-4 sm:p-6 flex-col space-y-5 sm:space-y-6 shrink-0 ${
          mobileTab === 'history' ? 'flex' : 'hidden lg:flex'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 tracking-tight">
              Focus Overview & Timeline
            </h2>
            <p className="text-xs text-zinc-400 font-mono-num mt-0.5">
              Daily Goal: {todayFocusMinutes} / {preferences.dailyFocusMinutesGoal} mins
            </p>
          </div>
          <button
            onClick={() => setShowManualModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.75} /> Add Record
          </button>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
            <div className="text-[11px] font-medium text-zinc-500">Today's Pomo</div>
            <div className="text-xl font-bold font-mono-num text-zinc-900 mt-1">
              {todaySessions.length}{' '}
              <span className="text-xs font-normal text-zinc-400">
                / {preferences.dailyPomoGoal}
              </span>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
            <div className="text-[11px] font-medium text-zinc-500">Today's Focus</div>
            <div className="text-xl font-bold font-mono-num text-blue-600 mt-1">
              {Math.floor(todayFocusMinutes / 60)}h {todayFocusMinutes % 60}m
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
            <div className="text-[11px] font-medium text-zinc-500">Total Sessions</div>
            <div className="text-xl font-bold font-mono-num text-zinc-900 mt-1">
              {pomodoroSessions.length}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
            <div className="text-[11px] font-medium text-zinc-500">Total Focus Duration</div>
            <div className="text-xl font-bold font-mono-num text-emerald-600 mt-1">
              {Math.floor(totalFocusMinutes / 60)}h {totalFocusMinutes % 60}m
            </div>
          </div>
        </div>

        {/* Focus Timeline Log with Filters & Delete Actions */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Focus Record Log ({filteredSessions.length}/{pomodoroSessions.length})
            </h3>
            {pomodoroSessions.length > 0 && (
              <button
                type="button"
                onClick={clearPomodoroSessions}
                title="Clear all focus logs"
                className="text-[10px] font-semibold text-rose-600 hover:text-rose-700 px-1.5 py-0.5 rounded hover:bg-rose-50"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Filter Bar: Date Range, Mode (Pomo/Stopwatch), and Search */}
          <div className="space-y-2 mb-3">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="inline-flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/70">
                {(
                  [
                    ['all', 'All Dates'],
                    ['today', 'Today'],
                    ['7days', '7 Days'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setLogRangeFilter(id)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                      logRangeFilter === id
                        ? 'bg-white text-zinc-900 shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="inline-flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/70">
                {(
                  [
                    ['all', 'All'],
                    ['pomo', 'Pomo'],
                    ['stopwatch', 'Stopwatch'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setLogModeFilter(id)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                      logModeFilter === id
                        ? 'bg-white text-zinc-900 shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200/80">
              <Search className="w-3 h-3 text-zinc-400 shrink-0" strokeWidth={1.75} />
              <input
                type="text"
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                placeholder="Filter focus logs by task or note..."
                className="flex-1 min-w-0 bg-transparent text-[11px] text-zinc-800 placeholder:text-zinc-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2 overflow-y-auto flex-1 pr-1">
            {filteredSessions.length === 0 ? (
              <div className="text-center py-8 text-xs text-zinc-400">
                No focus sessions match the active filter.
              </div>
            ) : (
              filteredSessions.map((sess) => (
                <div
                  key={sess.id}
                  className="group p-3 rounded-xl border border-zinc-200/80 bg-zinc-50/50 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-800 truncate">
                      {sess.taskTitle}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-mono-num font-bold text-zinc-900">
                        +{sess.durationMinutes}m
                      </span>
                      <button
                        type="button"
                        onClick={() => deletePomodoroSession(sess.id)}
                        title="Remove focus log"
                        aria-label={`Delete focus log ${sess.taskTitle}`}
                        className="p-1 rounded hover:bg-rose-50 text-zinc-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                  {sess.note && <p className="text-[11px] text-zinc-500">{sess.note}</p>}
                  <div className="flex items-center justify-between text-[10px] font-mono-num text-zinc-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" strokeWidth={1.75} />
                      {sess.startTime.slice(0, 10)} ({sess.mode.toUpperCase()})
                    </span>
                    {sess.whiteNoiseUsed && (
                      <span className="inline-flex items-center gap-1">
                        <Headphones className="w-3 h-3" strokeWidth={1.75} />
                        {sess.whiteNoiseUsed}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal: Manual Focus Record */}
      {showManualModal && (
        <div
          onClick={() => setShowManualModal(false)}
          className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-backdrop"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              logManualFocusSession(
                manualTitle || 'Deep Focus Session',
                manualMinutes,
                new Date().toISOString(),
                manualNote
              );
              setManualTitle('');
              setManualNote('');
              setShowManualModal(false);
            }}
            className="surface-floating rounded-xl w-full max-w-sm p-5 space-y-3 animate-modal"
          >
            <h3 className="text-sm font-semibold text-zinc-900">Add Manual Focus Record</h3>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Task / Topic</label>
              <input
                type="text"
                required
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="What did you focus on?"
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 focus:outline-none focus:border-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Duration (Minutes)
              </label>
              <input
                type="number"
                min={5}
                max={300}
                value={manualMinutes}
                onChange={(e) => setManualMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 font-mono-num focus:outline-none focus:border-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Focus Note</label>
              <input
                type="text"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Key accomplishments..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 focus:outline-none focus:border-zinc-900"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800"
              >
                Save Focus Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Pomo Timer Settings */}
      {showPomoSettings && (
        <div
          onClick={() => setShowPomoSettings(false)}
          className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-backdrop"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="surface-floating rounded-xl w-full max-w-sm p-5 space-y-4 animate-modal"
          >
            <h3 className="text-sm font-semibold text-zinc-900">Pomodoro Timer Settings</h3>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Focus (m)
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={preferences.pomoDuration}
                  onChange={(e) =>
                    updatePreferences({ pomoDuration: Math.max(5, Number(e.target.value)) })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 font-mono-num"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Short Break
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={preferences.shortBreakDuration}
                  onChange={(e) =>
                    updatePreferences({ shortBreakDuration: Math.max(1, Number(e.target.value)) })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 font-mono-num"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Long Break
                </label>
                <input
                  type="number"
                  min={5}
                  max={60}
                  value={preferences.longBreakDuration}
                  onChange={(e) =>
                    updatePreferences({ longBreakDuration: Math.max(5, Number(e.target.value)) })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 font-mono-num"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowPomoSettings(false)}
                className="px-4 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
