import React, { useState } from 'react';
import {
  BarChart3,
  Calendar,
  CheckSquare,
  Cloud,
  CloudOff,
  Compass,
  Crown,
  Download,
  Flame,
  Grid2X2,
  Hourglass,
  MoreHorizontal,
  Search,
  Settings,
  Timer,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PrimaryModule } from '../types';

export const NavigationRail: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    setIsCommandOpen,
    setIsInstallModalOpen,
    openSettingsTab,
    pomoRunning,
    pomoTimerRunning,
    stopwatchRunning,
    pomoMode,
    pomoSecondsLeft,
    stopwatchSeconds,
    preferences,
    supabaseStatus,
    tasks,
  } = useApp();

  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const todayCount = tasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'trash' && t.status !== 'wont_do'
  ).length;

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const navItems: {
    id: PrimaryModule;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    badge?: string | number;
    isPremiumFeature?: boolean;
  }[] = [
    {
      id: 'tasks',
      label: 'Tasks',
      shortLabel: 'Tasks',
      icon: <CheckSquare className="w-[18px] h-[18px]" strokeWidth={1.75} />,
      badge: todayCount > 0 ? todayCount : undefined,
    },
    {
      id: 'calendar',
      label: 'Calendar (5 Views)',
      shortLabel: 'Calendar',
      icon: <Calendar className="w-[18px] h-[18px]" strokeWidth={1.75} />,
      isPremiumFeature: true,
    },
    {
      id: 'pomodoro',
      label: 'Pomodoro & Focus',
      shortLabel: 'Focus',
      icon: <Timer className="w-[18px] h-[18px]" strokeWidth={1.75} />,
      badge: pomoRunning
        ? formatTimer(pomoMode === 'pomo' ? pomoSecondsLeft : stopwatchSeconds)
        : pomoTimerRunning
          ? formatTimer(pomoSecondsLeft)
          : stopwatchRunning
            ? formatTimer(stopwatchSeconds)
            : undefined,
    },
    {
      id: 'habits',
      label: 'Habit Tracker',
      shortLabel: 'Habits',
      icon: <Flame className="w-[18px] h-[18px]" strokeWidth={1.75} />,
    },
    {
      id: 'matrix',
      label: 'Eisenhower Matrix',
      shortLabel: 'Matrix',
      icon: <Grid2X2 className="w-[18px] h-[18px]" strokeWidth={1.75} />,
    },
    {
      id: 'countdown',
      label: 'Countdown',
      shortLabel: 'Countdown',
      icon: <Hourglass className="w-[18px] h-[18px]" strokeWidth={1.75} />,
    },
    {
      id: 'statistics',
      label: 'Statistics & Score',
      shortLabel: 'Stats',
      icon: <BarChart3 className="w-[18px] h-[18px]" strokeWidth={1.75} />,
      isPremiumFeature: true,
    },
    {
      id: 'templates',
      label: 'Templates & Hub',
      shortLabel: 'Templates',
      icon: <Compass className="w-[18px] h-[18px]" strokeWidth={1.75} />,
      isPremiumFeature: true,
    },
  ];

  const primaryMobileItems = navItems.slice(0, 4);
  const overflowMobileItems = navItems.slice(4);
  const isOverflowActive = overflowMobileItems.some((item) => item.id === activeModule);

  return (
    <>
      {/* Desktop Far-Left Vertical Rail (md and up) */}
      <aside
        aria-label="Primary Module Navigation"
        style={{ backgroundColor: 'var(--brand-rail-bg)' }}
        className="hidden md:flex w-14 shrink-0 flex-col items-center py-3 text-zinc-400 select-none z-20 border-r border-white/[0.07]"
      >
        {/* Profile & Premium Crown */}
        <button
          onClick={() => openSettingsTab('premium')}
          title={`${preferences.fullName} — TickTick Premium Active (Achievement Score: ${preferences.achievementScore})`}
          className="relative group mb-4 focus:outline-none"
        >
          <div
            style={{ backgroundColor: 'var(--brand-primary)' }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-xs ring-1 ring-white/15"
          >
            {preferences.fullName
              .split(' ')
              .map((p) => p[0])
              .join('')
              .slice(0, 2)}
          </div>
          {preferences.isPremium && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center ring-2 ring-zinc-950">
              <Crown className="w-2 h-2 fill-current" strokeWidth={2} />
            </span>
          )}
        </button>

        {/* Main Module Icons */}
        <nav className="flex-1 flex flex-col items-center gap-1 w-full px-1.5">
          {navItems.map((item) => {
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                title={item.label}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative w-10 h-10 rounded-lg flex items-center justify-center ${
                  isActive
                    ? 'bg-white/[0.11] text-white ring-1 ring-white/[0.08]'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]'
                }`}
              >
                {isActive && (
                  <span
                    style={{ backgroundColor: 'var(--brand-primary)' }}
                    className="absolute left-0 w-[3px] h-4 rounded-r-full"
                  />
                )}
                {item.icon}
                {item.badge !== undefined && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 px-1 min-w-[16px] h-[15px] rounded-md text-[10px] font-mono-num font-semibold flex items-center justify-center ring-1 ring-zinc-950 ${
                      item.id === 'pomodoro'
                        ? 'bg-rose-500 text-white'
                        : 'bg-zinc-700 text-zinc-100'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions: Command Search, Supabase Sync Status, Settings */}
        <div className="flex flex-col items-center gap-1 w-full px-1.5 pt-2 border-t border-white/[0.07]">
          <button
            onClick={() => setIsCommandOpen(true)}
            title="Command Palette & Global Search (Ctrl+K)"
            aria-label="Open Command Palette"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]"
          >
            <Search className="w-4 h-4" strokeWidth={1.75} />
          </button>

          <button
            onClick={() => openSettingsTab('supabase')}
            title={
              supabaseStatus === 'connected'
                ? 'Supabase Backend Connected (Click to manage sync)'
                : 'Local-First Mode Active (Click to connect Supabase Backend)'
            }
            aria-label="Supabase Backend Settings"
            className="relative w-10 h-10 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]"
          >
            {supabaseStatus === 'connected' || supabaseStatus === 'syncing' ? (
              <Cloud className="w-4 h-4 text-emerald-400" strokeWidth={1.75} />
            ) : (
              <CloudOff className="w-4 h-4 text-zinc-400" strokeWidth={1.75} />
            )}
            <span
              className={`absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full ring-2 ring-zinc-950 ${
                supabaseStatus === 'connected'
                  ? 'bg-emerald-400'
                  : supabaseStatus === 'syncing'
                    ? 'bg-blue-400 animate-ping'
                    : 'bg-amber-400'
              }`}
            />
          </button>

          <button
            onClick={() => setIsInstallModalOpen(true)}
            title="Install TickTick Pro App (Mobile / Desktop PWA)"
            aria-label="Install App"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]"
          >
            <Download className="w-4 h-4" strokeWidth={1.75} />
          </button>

          <button
            onClick={() => openSettingsTab('general')}
            title="Settings, Themes & Keyboard Shortcuts"
            aria-label="Open Settings"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]"
          >
            <Settings className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (<768px) with native safe-area inset */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 min-h-[3.5rem] bg-white/95 backdrop-blur-md border-t border-zinc-200/80 grid grid-cols-5 items-center px-1 select-none pb-[env(safe-area-inset-bottom,0px)]"
      >
        {primaryMobileItems.map((item) => {
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveModule(item.id);
                setMobileMoreOpen(false);
              }}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center py-1.5 rounded-lg gap-0.5 tactile-press ${
                isActive ? 'text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-700'
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.badge !== undefined && (
                  <span
                    className={`absolute -top-1.5 -right-3 px-1 min-w-[15px] h-[14px] rounded text-[9px] font-mono-num font-bold flex items-center justify-center ${
                      item.id === 'pomodoro'
                        ? 'bg-rose-500 text-white'
                        : 'bg-zinc-900 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight">{item.shortLabel}</span>
              {isActive && (
                <span className="absolute bottom-0 w-4 h-0.5 bg-zinc-950 rounded-full" />
              )}
            </button>
          );
        })}

        {/* 5th Tab: More Modules, Search & Settings Drawer */}
        <button
          onClick={() => setMobileMoreOpen((v) => !v)}
          aria-label="More Modules and Settings"
          className={`relative flex flex-col items-center justify-center py-1.5 rounded-lg gap-0.5 tactile-press ${
            isOverflowActive || mobileMoreOpen
              ? 'text-zinc-950 font-semibold'
              : 'text-zinc-400 hover:text-zinc-700'
          }`}
        >
          <MoreHorizontal className="w-[18px] h-[18px]" strokeWidth={1.75} />
          <span className="text-[10px] tracking-tight">More</span>
          {(isOverflowActive || mobileMoreOpen) && (
            <span className="absolute bottom-0 w-4 h-0.5 bg-zinc-950 rounded-full" />
          )}
        </button>
      </nav>

      {/* Mobile Vaul-Style Bottom Sheet for More Modules & Global Tools */}
      {mobileMoreOpen && (
        <div
          onClick={() => setMobileMoreOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-[2px] flex items-end animate-backdrop"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white rounded-t-2xl border-t border-zinc-200/80 p-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] space-y-4 animate-sheet-up max-h-[85vh] overflow-y-auto"
          >
            {/* Vaul Drag Handle Pill */}
            <div className="w-10 h-1 rounded-full bg-zinc-300 mx-auto" />

            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2.5">
                <div
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-xs"
                >
                  {preferences.fullName
                    .split(' ')
                    .map((p) => p[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5">
                    {preferences.fullName}
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-700 text-[10px] font-semibold">
                      <Crown className="w-2.5 h-2.5 fill-current" /> Pro
                    </span>
                  </div>
                  <div className="text-[11px] font-mono-num text-zinc-400">
                    Achievement Score: {preferences.achievementScore}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setMobileMoreOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Additional Modules Grid */}
            <div className="grid grid-cols-2 gap-2">
              {overflowMobileItems.map((item) => {
                const isActive = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveModule(item.id);
                      setMobileMoreOpen(false);
                    }}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs font-medium ${
                      isActive
                        ? 'bg-zinc-900 text-white border-zinc-900 font-semibold'
                        : 'bg-zinc-50/80 text-zinc-800 border-zinc-200/80 hover:bg-zinc-100'
                    }`}
                  >
                    {item.icon}
                    <span className="truncate">{item.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Global Actions: Search, Supabase, Settings, Install App */}
            <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-zinc-100">
              <button
                onClick={() => {
                  setMobileMoreOpen(false);
                  setIsCommandOpen(true);
                }}
                className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-zinc-50 border border-zinc-200/80 text-[11px] font-medium text-zinc-700"
              >
                <Search className="w-4 h-4 text-zinc-600" strokeWidth={1.75} />
                <span>Search</span>
              </button>

              <button
                onClick={() => {
                  setMobileMoreOpen(false);
                  openSettingsTab('supabase');
                }}
                className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-zinc-50 border border-zinc-200/80 text-[11px] font-medium text-zinc-700"
              >
                {supabaseStatus === 'connected' ? (
                  <Cloud className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
                ) : (
                  <CloudOff className="w-4 h-4 text-amber-600" strokeWidth={1.75} />
                )}
                <span>Sync</span>
              </button>

              <button
                onClick={() => {
                  setMobileMoreOpen(false);
                  openSettingsTab('general');
                }}
                className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-zinc-50 border border-zinc-200/80 text-[11px] font-medium text-zinc-700"
              >
                <Settings className="w-4 h-4 text-zinc-600" strokeWidth={1.75} />
                <span>Settings</span>
              </button>

              <button
                onClick={() => {
                  setMobileMoreOpen(false);
                  setIsInstallModalOpen(true);
                }}
                className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-blue-50/80 border border-blue-200/70 text-[11px] font-medium text-blue-700"
              >
                <Download className="w-4 h-4 text-blue-600" strokeWidth={1.75} />
                <span>Install</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
