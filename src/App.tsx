import React, { Suspense, lazy } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NavigationRail } from './components/NavigationRail';
import { SplashScreen } from './components/SplashScreen';
import { SonnerToaster } from './components/SonnerToaster';
import { TaskDetailPane } from './components/TaskDetailPane';
import { TaskSidebar } from './components/TaskSidebar';
import { TaskWorkspace } from './components/TaskWorkspace';
import { AppProvider, useApp } from './context/AppContext';

// Code-split secondary modules and modals for lightning-fast initial load
const CalendarModule = lazy(() =>
  import('./components/CalendarModule').then((m) => ({ default: m.CalendarModule }))
);
const PomodoroModule = lazy(() =>
  import('./components/PomodoroModule').then((m) => ({ default: m.PomodoroModule }))
);
const HabitTrackerModule = lazy(() =>
  import('./components/HabitTrackerModule').then((m) => ({ default: m.HabitTrackerModule }))
);
const EisenhowerMatrixModule = lazy(() =>
  import('./components/EisenhowerMatrixModule').then((m) => ({ default: m.EisenhowerMatrixModule }))
);
const CountdownModule = lazy(() =>
  import('./components/CountdownModule').then((m) => ({ default: m.CountdownModule }))
);
const StatisticsModule = lazy(() =>
  import('./components/StatisticsModule').then((m) => ({ default: m.StatisticsModule }))
);
const SettingsAndSupabaseModal = lazy(() =>
  import('./components/SettingsAndSupabaseModal').then((m) => ({ default: m.SettingsAndSupabaseModal }))
);
const CommandPaletteModal = lazy(() =>
  import('./components/CommandPaletteModal').then((m) => ({ default: m.CommandPaletteModal }))
);
const ActiveReminderModal = lazy(() =>
  import('./components/ActiveReminderModal').then((m) => ({ default: m.ActiveReminderModal }))
);
const InstallAppModal = lazy(() =>
  import('./components/InstallAppModal').then((m) => ({ default: m.InstallAppModal }))
);
const DatabaseSetupPromptModal = lazy(() =>
  import('./components/DatabaseSetupPromptModal').then((m) => ({ default: m.DatabaseSetupPromptModal }))
);

const ModuleLoadingFallback: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-50/80 select-none animate-pulse">
    <div className="w-10 h-10 rounded-2xl bg-zinc-200/80 mb-3" />
    <div className="h-3 w-32 bg-zinc-200 rounded-full mb-2" />
    <div className="h-2 w-48 bg-zinc-200/60 rounded-full" />
  </div>
);

const MainShell: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    toasts,
    dismissToast,
    isInstallModalOpen,
    setIsInstallModalOpen,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    selectedTaskId,
    setSelectedTaskId,
    isCommandOpen,
    setIsCommandOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    sidebarSelection,
    setSidebarSelection,
  } = useApp();

  const touchStartRef = React.useRef<{ x: number; y: number; target: EventTarget | null } | null>(
    null
  );
  const moduleHistoryRef = React.useRef<typeof activeModule[]>([]);
  const prevModuleRef = React.useRef(activeModule);
  const isHandlingPopStateRef = React.useRef(false);

  // Track module history for mobile Go Back navigation
  React.useEffect(() => {
    if (prevModuleRef.current !== activeModule) {
      moduleHistoryRef.current.push(prevModuleRef.current);
      if (moduleHistoryRef.current.length > 10) {
        moduleHistoryRef.current.shift();
      }
      prevModuleRef.current = activeModule;
    }
  }, [activeModule]);

  // Push history entry when mobile layers open so mobile OS back-swipe / hardware back works natively
  const hasActiveBackLayer =
    isCommandOpen ||
    isSettingsOpen ||
    isInstallModalOpen ||
    Boolean(selectedTaskId) ||
    (!isSidebarCollapsed && typeof window !== 'undefined' && window.innerWidth < 768) ||
    activeModule !== 'tasks' ||
    sidebarSelection.kind !== 'smart' ||
    sidebarSelection.id !== 'today';

  React.useEffect(() => {
    if (isHandlingPopStateRef.current) {
      isHandlingPopStateRef.current = false;
      return;
    }
    if (hasActiveBackLayer) {
      window.history.pushState({ ticktickBackLayer: true }, '');
    }
  }, [
    isCommandOpen,
    isSettingsOpen,
    isInstallModalOpen,
    selectedTaskId,
    isSidebarCollapsed,
    activeModule,
    sidebarSelection.kind,
    sidebarSelection.id,
    hasActiveBackLayer,
  ]);

  const handleGoBack = React.useCallback((): boolean => {
    if (isCommandOpen) {
      setIsCommandOpen(false);
      return true;
    }
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
      return true;
    }
    if (isInstallModalOpen) {
      setIsInstallModalOpen(false);
      return true;
    }
    if (selectedTaskId) {
      setSelectedTaskId(null);
      return true;
    }
    if (!isSidebarCollapsed && typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarCollapsed(true);
      return true;
    }
    if (activeModule !== 'tasks') {
      const prev = moduleHistoryRef.current.pop() || 'tasks';
      setActiveModule(prev);
      return true;
    }
    if (sidebarSelection.kind !== 'smart' || sidebarSelection.id !== 'today') {
      setSidebarSelection({ kind: 'smart', id: 'today' });
      return true;
    }
    return false;
  }, [
    isCommandOpen,
    setIsCommandOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isInstallModalOpen,
    setIsInstallModalOpen,
    selectedTaskId,
    setSelectedTaskId,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    activeModule,
    setActiveModule,
    sidebarSelection,
    setSidebarSelection,
  ]);

  React.useEffect(() => {
    const onPopState = () => {
      isHandlingPopStateRef.current = true;
      handleGoBack();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [handleGoBack]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      target: e.target,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length !== 1) return;
    const { x: startX, y: startY, target } = touchStartRef.current;
    touchStartRef.current = null;

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - startX;
    const deltaY = endY - startY;

    // Must be a clear horizontal swipe gesture
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.45) {
      return;
    }

    // Ignore swipes inside horizontally scrollable containers unless started right at the left screen edge
    if (startX > 28 && target instanceof HTMLElement) {
      const scrollableParent = target.closest(
        '[data-testid="habit-weekly-dates-scroll"], input[type="range"]'
      );
      if (scrollableParent) return;
    }

    // Right swipe (deltaX > 55)
    if (deltaX > 55) {
      // 1. If TaskDetailPane is open on mobile, right-swipe acts as Go Back to close it
      if (selectedTaskId && window.innerWidth < 1024 && startX <= 120) {
        setSelectedTaskId(null);
        return;
      }
      // 2. In Tasks module when sidebar is closed, right-swipe opens the left navigation bar
      if (activeModule === 'tasks' && isSidebarCollapsed && !selectedTaskId && startX <= 200) {
        setIsSidebarCollapsed(false);
        return;
      }
      // 3. From the left edge in other modules, right-swipe acts as Go Back (or opens Tasks nav)
      if (activeModule !== 'tasks' && startX <= 48) {
        handleGoBack();
        return;
      }
    }

    // Left swipe (deltaX < -55): close mobile left navigation bar when open
    if (deltaX < -55 && !isSidebarCollapsed && window.innerWidth < 768) {
      setIsSidebarCollapsed(true);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="h-[100dvh] w-screen overflow-hidden flex flex-col md:flex-row bg-zinc-50 text-zinc-900 antialiased"
    >
      {/* Desktop Far-Left Icon Rail + Mobile Bottom Tab Bar */}
      <NavigationRail />

      {/* Mobile Left-Edge Swipe Handle Indicator for Left Nav / Go Back */}
      {isSidebarCollapsed && !selectedTaskId && (
        <div
          data-testid="mobile-left-edge-swipe-zone"
          onClick={() => {
            if (activeModule === 'tasks') {
              setIsSidebarCollapsed(false);
            } else {
              handleGoBack();
            }
          }}
          title={activeModule === 'tasks' ? 'Swipe right to open navigation' : 'Swipe right to go back'}
          className="md:hidden fixed left-0 top-1/2 -translate-y-1/2 z-20 w-2 h-14 flex items-center justify-start group cursor-pointer"
        >
          <span className="w-1 h-10 rounded-r-full bg-zinc-300/60 group-hover:bg-blue-500/70 group-active:scale-y-110 transition-all" />
        </div>
      )}

      {/* Center + Right Module Switcher */}
      <div
        key={activeModule}
        className="flex-1 flex h-full min-w-0 min-h-0 overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0 animate-module-enter"
      >
        {activeModule === 'tasks' && (
          <div className="flex-1 flex h-full min-w-0 overflow-hidden relative">
            <TaskSidebar />
            <TaskWorkspace />
            <TaskDetailPane />
          </div>
        )}

        {activeModule === 'calendar' && (
          <ErrorBoundary moduleName="Calendar" onReset={() => setActiveModule('tasks')}>
            <Suspense fallback={<ModuleLoadingFallback />}>
              <CalendarModule />
            </Suspense>
          </ErrorBoundary>
        )}

        {activeModule === 'pomodoro' && (
          <ErrorBoundary moduleName="Pomodoro & Focus" onReset={() => setActiveModule('tasks')}>
            <Suspense fallback={<ModuleLoadingFallback />}>
              <PomodoroModule />
            </Suspense>
          </ErrorBoundary>
        )}

        {activeModule === 'habits' && (
          <ErrorBoundary moduleName="Habit Tracker" onReset={() => setActiveModule('tasks')}>
            <Suspense fallback={<ModuleLoadingFallback />}>
              <HabitTrackerModule />
            </Suspense>
          </ErrorBoundary>
        )}

        {activeModule === 'matrix' && (
          <ErrorBoundary moduleName="Eisenhower Matrix" onReset={() => setActiveModule('tasks')}>
            <Suspense fallback={<ModuleLoadingFallback />}>
              <EisenhowerMatrixModule />
            </Suspense>
          </ErrorBoundary>
        )}

        {(activeModule === 'countdown' || activeModule === 'templates') && (
          <ErrorBoundary moduleName="Countdown & Templates" onReset={() => setActiveModule('tasks')}>
            <Suspense fallback={<ModuleLoadingFallback />}>
              <CountdownModule />
            </Suspense>
          </ErrorBoundary>
        )}

        {activeModule === 'statistics' && (
          <ErrorBoundary moduleName="Statistics & Analytics" onReset={() => setActiveModule('tasks')}>
            <Suspense fallback={<ModuleLoadingFallback />}>
              <StatisticsModule />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>

      {/* Global Overlays & Modals */}
      <SplashScreen />

      <Suspense fallback={null}>
        <CommandPaletteModal />
        <SettingsAndSupabaseModal />
        <ActiveReminderModal />
        <InstallAppModal
          isOpen={isInstallModalOpen}
          onClose={() => setIsInstallModalOpen(false)}
        />
        <DatabaseSetupPromptModal />
      </Suspense>

      <SonnerToaster toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary moduleName="TickTick Pro">
      <AppProvider>
        <MainShell />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
