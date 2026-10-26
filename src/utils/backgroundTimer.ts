/**
 * TickTick Pro Background Timer & Stopwatch Engine
 *
 * Solves browser timer suspension when the screen is locked, phone display is turned off,
 * or the application is running in the background.
 *
 * Architectural Pillars:
 * 1. Wall-Clock Absolute Timestamp Anchoring (Date.now()) - Zero time drift, immune to throttling
 * 2. Background Web Worker Ticker (Blob URL) - Runs in an isolated thread independent of DOM throttling
 * 3. Screen Wake Lock API (navigator.wakeLock) - Prevents phone screens from auto-sleeping during focus
 * 4. Service Worker Background Alert Scheduling - Dispatches OS notifications even if tab is sleeping
 * 5. Multi-Event Visibility Re-Sync (visibilitychange, focus, pageshow) - Immediate catchup on wake
 */

import { sendDeviceNotification } from './notificationEngine';
import { soundEngine } from './soundEngine';

export interface BackgroundTimerState {
  isRunning: boolean;
  pomoRunning: boolean;
  stopwatchRunning: boolean;
  mode: 'pomo' | 'stopwatch';
  pomoPhase: 'work' | 'short_break' | 'long_break';
  targetEndTimestamp: number | null; // For Pomodoro countdown
  stopwatchBaseTimestamp: number | null; // For Stopwatch count-up
  secondsLeft: number;
  stopwatchSeconds: number;
}

const STORAGE_KEYS = {
  RUNNING: 'ticktick_timer_running',
  MODE: 'ticktick_timer_mode',
  PHASE: 'ticktick_timer_phase',
  TARGET_END: 'ticktick_timer_target_end',
  STOPWATCH_BASE: 'ticktick_timer_stopwatch_base',
  SECONDS_LEFT: 'ticktick_timer_seconds_left',
  STOPWATCH_SECS: 'ticktick_timer_stopwatch_secs',
};

class BackgroundTimerEngine {
  private worker: Worker | null = null;
  private wakeLockSentinel: any = null;
  private onTickCallback: ((remaining: number, elapsed: number) => void) | null = null;
  private onPomoCompleteCallback: (() => void) | null = null;
  private isHandlingComplete = false;

  constructor() {
    this.initWorker();
    this.bindVisibilityListeners();
  }

  /**
   * Initializes an isolated Web Worker via Blob URL.
   * Web Workers run in background threads and are not throttled as aggressively as DOM timers.
   */
  private initWorker() {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') return;

    try {
      const workerCode = `
        let timerId = null;
        self.onmessage = function(e) {
          if (e.data === 'START') {
            if (timerId) clearInterval(timerId);
            timerId = setInterval(function() {
              self.postMessage('TICK');
            }, 500);
          } else if (e.data === 'STOP') {
            if (timerId) clearInterval(timerId);
            timerId = null;
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      this.worker.onmessage = (e) => {
        if (e.data === 'TICK') {
          this.sync();
        }
      };
    } catch (err) {
      console.warn('[TimerEngine] Web Worker creation fallback:', err);
    }
  }

  /**
   * Binds visibility, focus, and pageshow events to instantly recalculate wall-clock
   * time when the user turns their screen on or returns from the background.
   */
  private bindVisibilityListeners() {
    if (typeof window === 'undefined') return;

    const handleWakeup = () => {
      this.sync();
      // If timer is still running, re-acquire screen wake lock if it was released by OS
      const isRunning = localStorage.getItem(STORAGE_KEYS.RUNNING) === 'true';
      if (isRunning && !this.wakeLockSentinel) {
        this.requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleWakeup();
      }
    });

    window.addEventListener('focus', handleWakeup);
    window.addEventListener('pageshow', handleWakeup);
  }

  /**
   * Requests Screen Wake Lock so phones do not auto-lock while timer is running.
   */
  public async requestWakeLock() {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      this.wakeLockSentinel.addEventListener('release', () => {
        this.wakeLockSentinel = null;
      });
    } catch {
      // Ignored if battery saver or OS policy denies wake lock
    }
  }

  /**
   * Releases Screen Wake Lock.
   */
  public async releaseWakeLock() {
    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release();
      } catch {}
      this.wakeLockSentinel = null;
    }
  }

  /**
   * Schedules a background alert in the Service Worker.
   */
  private scheduleServiceWorkerAlert(targetTimestamp: number, phase: string, taskTitle: string) {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SCHEDULE_POMO_ALERT',
          targetTimestamp,
          title: '🎉 Focus Session Finished!',
          body: `You completed your ${phase === 'work' ? 'focus' : 'break'} block on "${taskTitle}".`,
        });
      }
    } catch {}
  }

  /**
   * Cancels background alert in the Service Worker.
   */
  private cancelServiceWorkerAlert() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CANCEL_POMO_ALERT',
        });
      }
    } catch {}
  }

  /**
   * Starts or resumes the Pomodoro countdown timer.
   */
  public startPomodoro(
    secondsRemaining: number,
    phase: 'work' | 'short_break' | 'long_break',
    taskTitle = 'Deep Focus'
  ) {
    this.isHandlingComplete = false;
    const now = Date.now();
    const targetEnd = now + secondsRemaining * 1000;

    localStorage.setItem(STORAGE_KEYS.RUNNING, 'true');
    localStorage.setItem(STORAGE_KEYS.MODE, 'pomo');
    localStorage.setItem(STORAGE_KEYS.PHASE, phase);
    localStorage.setItem(STORAGE_KEYS.TARGET_END, String(targetEnd));
    localStorage.setItem(STORAGE_KEYS.SECONDS_LEFT, String(secondsRemaining));

    this.requestWakeLock();
    this.scheduleServiceWorkerAlert(targetEnd, phase, taskTitle);

    if (this.worker) {
      this.worker.postMessage('START');
    }
    this.sync();
  }

  /**
   * Starts or resumes the Stopwatch count-up timer.
   */
  public startStopwatch(currentElapsedSeconds: number) {
    const now = Date.now();
    const baseTimestamp = now - currentElapsedSeconds * 1000;

    localStorage.setItem(STORAGE_KEYS.RUNNING, 'true');
    localStorage.setItem(STORAGE_KEYS.MODE, 'stopwatch');
    localStorage.setItem(STORAGE_KEYS.STOPWATCH_BASE, String(baseTimestamp));
    localStorage.setItem(STORAGE_KEYS.STOPWATCH_SECS, String(currentElapsedSeconds));

    this.requestWakeLock();
    this.cancelServiceWorkerAlert();

    if (this.worker) {
      this.worker.postMessage('START');
    }
    this.sync();
  }

  /**
   * Pauses the timer (or a specific mode) and stores current remaining/elapsed seconds.
   */
  public pauseTimer(mode?: 'pomo' | 'stopwatch') {
    this.sync();

    if (!mode || mode === 'pomo') {
      localStorage.removeItem(STORAGE_KEYS.TARGET_END);
      this.cancelServiceWorkerAlert();
    }
    if (!mode || mode === 'stopwatch') {
      localStorage.removeItem(STORAGE_KEYS.STOPWATCH_BASE);
    }

    const stillHasPomo = Boolean(localStorage.getItem(STORAGE_KEYS.TARGET_END));
    const stillHasStopwatch = Boolean(localStorage.getItem(STORAGE_KEYS.STOPWATCH_BASE));
    const anyRunning = stillHasPomo || stillHasStopwatch;

    localStorage.setItem(STORAGE_KEYS.RUNNING, anyRunning ? 'true' : 'false');

    if (!anyRunning) {
      this.releaseWakeLock();
      if (this.worker) {
        this.worker.postMessage('STOP');
      }
    }
  }

  /**
   * Resets the timer state (or a specific mode).
   */
  public resetTimer(defaultSeconds: number, mode?: 'pomo' | 'stopwatch') {
    if (!mode || mode === 'pomo') {
      localStorage.setItem(STORAGE_KEYS.SECONDS_LEFT, String(defaultSeconds));
      localStorage.removeItem(STORAGE_KEYS.TARGET_END);
      this.cancelServiceWorkerAlert();
    }
    if (!mode || mode === 'stopwatch') {
      localStorage.setItem(STORAGE_KEYS.STOPWATCH_SECS, '0');
      localStorage.removeItem(STORAGE_KEYS.STOPWATCH_BASE);
    }

    const stillHasPomo = Boolean(localStorage.getItem(STORAGE_KEYS.TARGET_END));
    const stillHasStopwatch = Boolean(localStorage.getItem(STORAGE_KEYS.STOPWATCH_BASE));
    const anyRunning = stillHasPomo || stillHasStopwatch;

    localStorage.setItem(STORAGE_KEYS.RUNNING, anyRunning ? 'true' : 'false');

    if (!anyRunning) {
      this.releaseWakeLock();
      if (this.worker) {
        this.worker.postMessage('STOP');
      }
    }

    this.sync();
  }

  /**
   * Synchronizes timer calculation against absolute wall-clock timestamps.
   * Supports both Pomodoro and Stopwatch running independently.
   */
  public sync() {
    const now = Date.now();
    const targetEndStr = localStorage.getItem(STORAGE_KEYS.TARGET_END);
    const baseTimestampStr = localStorage.getItem(STORAGE_KEYS.STOPWATCH_BASE);

    let remainingSeconds = Number(localStorage.getItem(STORAGE_KEYS.SECONDS_LEFT)) || 0;
    let elapsedSeconds = Number(localStorage.getItem(STORAGE_KEYS.STOPWATCH_SECS)) || 0;

    if (targetEndStr) {
      const targetEnd = Number(targetEndStr);
      remainingSeconds = Math.max(0, Math.ceil((targetEnd - now) / 1000));
      localStorage.setItem(STORAGE_KEYS.SECONDS_LEFT, String(remainingSeconds));
    }

    if (baseTimestampStr) {
      const baseTimestamp = Number(baseTimestampStr);
      elapsedSeconds = Math.max(0, Math.floor((now - baseTimestamp) / 1000));
      localStorage.setItem(STORAGE_KEYS.STOPWATCH_SECS, String(elapsedSeconds));
    }

    if (this.onTickCallback) {
      this.onTickCallback(remainingSeconds, elapsedSeconds);
    }

    if (targetEndStr && remainingSeconds === 0 && !this.isHandlingComplete) {
      this.isHandlingComplete = true;
      this.handlePomodoroFinished();
    }
  }

  /**
   * Handles timer completion: sounds alarm, triggers OS notification & calls callback.
   */
  private handlePomodoroFinished() {
    this.pauseTimer('pomo');
    soundEngine.playPomodoroCompleteAlarm();

    sendDeviceNotification('🎉 Focus Session Finished!', {
      body: 'Great work! You reached your target. Time for a well-deserved break.',
      playSound: true,
    });

    if (this.onPomoCompleteCallback) {
      this.onPomoCompleteCallback();
    }
  }

  /**
   * Registers callbacks for state updates and completion events.
   */
  public subscribe(
    onTick: (remaining: number, elapsed: number) => void,
    onPomoComplete: () => void
  ) {
    this.onTickCallback = onTick;
    this.onPomoCompleteCallback = onPomoComplete;
    this.sync();

    return () => {
      this.onTickCallback = null;
      this.onPomoCompleteCallback = null;
    };
  }

  /**
   * Gets the currently persisted state on initial app mount.
   */
  public getInitialState(defaultPomoSeconds: number): BackgroundTimerState {
    const mode = (localStorage.getItem(STORAGE_KEYS.MODE) as 'pomo' | 'stopwatch') || 'pomo';
    const pomoPhase =
      (localStorage.getItem(STORAGE_KEYS.PHASE) as 'work' | 'short_break' | 'long_break') || 'work';
    const targetEndStr = localStorage.getItem(STORAGE_KEYS.TARGET_END);
    const targetEndTimestamp = targetEndStr ? Number(targetEndStr) : null;
    const stopwatchBaseStr = localStorage.getItem(STORAGE_KEYS.STOPWATCH_BASE);
    const stopwatchBaseTimestamp = stopwatchBaseStr ? Number(stopwatchBaseStr) : null;

    const pomoRunning = Boolean(targetEndTimestamp);
    const stopwatchRunning = Boolean(stopwatchBaseTimestamp);
    const isRunning =
      localStorage.getItem(STORAGE_KEYS.RUNNING) === 'true' && (pomoRunning || stopwatchRunning);

    let secondsLeft = Number(localStorage.getItem(STORAGE_KEYS.SECONDS_LEFT)) || defaultPomoSeconds;
    let stopwatchSeconds = Number(localStorage.getItem(STORAGE_KEYS.STOPWATCH_SECS)) || 0;

    const now = Date.now();
    if (pomoRunning && targetEndTimestamp) {
      secondsLeft = Math.max(0, Math.ceil((targetEndTimestamp - now) / 1000));
    }
    if (stopwatchRunning && stopwatchBaseTimestamp) {
      stopwatchSeconds = Math.max(0, Math.floor((now - stopwatchBaseTimestamp) / 1000));
    }

    return {
      isRunning,
      pomoRunning,
      stopwatchRunning,
      mode,
      pomoPhase,
      targetEndTimestamp,
      stopwatchBaseTimestamp,
      secondsLeft,
      stopwatchSeconds,
    };
  }
}

export const backgroundTimerEngine = new BackgroundTimerEngine();
