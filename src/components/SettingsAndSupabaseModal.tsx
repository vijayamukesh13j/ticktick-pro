import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Check,
  Cloud,
  Crown,
  Database,
  Download,
  DownloadCloud,
  Info,
  Keyboard,
  Palette,
  RefreshCw,
  Settings,
  Smartphone,
  UploadCloud,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  DEMO_SUPABASE_ANON_KEY,
  DEMO_SUPABASE_URL,
  getSupabaseConfig,
} from '../lib/supabase';
import { ThemeId } from '../types';
import {
  checkNotificationDiagnostic,
  NotificationDiagnostic,
  sendDeviceNotification,
} from '../utils/notificationEngine';

export const SettingsAndSupabaseModal: React.FC = () => {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    setIsInstallModalOpen,
    settingsInitialTab,
    openSettingsTab,
    preferences,
    updatePreferences,
    requestNotificationPermission,
    notificationPermission,
    pushToast,
    setTheme,
    resetDemoWorkspace,
    clearAllWorkspaceData,
    supabaseStatus,
    supabaseLastSyncedAt,
    supabaseErrorMessage,
    connectSupabase,
    disconnectSupabase,
    syncWorkspaceToSupabase,
    pullWorkspaceFromSupabase,
  } = useApp();

  const currentCfg = getSupabaseConfig();
  const [sbUrl, setSbUrl] = useState(currentCfg.url);
  const [sbAnonKey, setSbAnonKey] = useState(currentCfg.anonKey);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [notifDiag, setNotifDiag] = useState<NotificationDiagnostic | null>(null);

  useEffect(() => {
    if (isSettingsOpen) {
      const cfg = getSupabaseConfig();
      setSbUrl(cfg.url);
      setSbAnonKey(cfg.anonKey);
      checkNotificationDiagnostic().then(setNotifDiag);
    }
  }, [isSettingsOpen, notificationPermission]);

  if (!isSettingsOpen) return null;

  const themes: { id: ThemeId; name: string; primary: string; rail: string }[] = [
    { id: 'classic-blue', name: 'Linear Cobalt', primary: '#3b66f5', rail: '#121316' },
    { id: 'dark-obsidian', name: 'Obsidian Zinc', primary: '#18181b', rail: '#09090b' },
    { id: 'forest-emerald', name: 'Forest Emerald', primary: '#059669', rail: '#0c1f1a' },
    { id: 'sunset-amber', name: 'Warm Terracotta', primary: '#ea580c', rail: '#1f140e' },
    { id: 'sakura-rose', name: 'Crimson Studio', primary: '#e11d48', rail: '#1f1016' },
    { id: 'nordic-slate', name: 'Nordic Slate', primary: '#0284c7', rail: '#111a24' },
  ];

  const handleConnectSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await connectSupabase(sbUrl, sbAnonKey);
    setSyncMessage(
      ok
        ? 'Connected to Supabase and pulled your personal workspace data automatically.'
        : 'Could not verify Supabase credentials. Check URL and Anon Key.'
    );
  };

  return (
    <div
      onClick={() => setIsSettingsOpen(false)}
      className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl surface-floating rounded-t-2xl sm:rounded-xl overflow-hidden flex flex-col max-h-[88dvh] sm:max-h-[85vh] animate-sheet-up sm:animate-modal"
      >
        <div className="sm:hidden w-10 h-1 rounded-full bg-zinc-300 mx-auto mt-2.5 shrink-0" />
        {/* Top Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Settings className="w-4 h-4 text-zinc-700 shrink-0" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold text-zinc-900 tracking-tight truncate">
              Settings & Integrations
            </h2>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            title="Close Settings"
            aria-label="Close Settings"
            className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-200/80 bg-zinc-50 px-3 sm:px-6 gap-2 overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'general', label: 'General', Icon: Settings },
              { id: 'themes', label: 'Themes', Icon: Palette },
              { id: 'supabase', label: 'Supabase Backend', Icon: Database },
              { id: 'shortcuts', label: 'Shortcuts', Icon: Keyboard },
              { id: 'premium', label: 'TickTick Premium', Icon: Crown },
            ] as const
          ).map(({ id: tabId, label, Icon }) => (
            <button
              key={tabId}
              type="button"
              onClick={() => openSettingsTab(tabId)}
              className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                settingsInitialTab === tabId
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 ${tabId === 'premium' ? 'text-amber-500' : ''}`}
                strokeWidth={1.75}
              />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {settingsInitialTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={preferences.fullName}
                    onChange={(e) => updatePreferences({ fullName: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 focus:outline-none focus:border-zinc-900"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">
                    Syncs to Supabase database & across devices in real time.
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={preferences.email}
                    onChange={(e) => updatePreferences({ email: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 focus:outline-none focus:border-zinc-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
                <div>
                  <div className="text-xs font-semibold text-zinc-800">Completion Sound Effects</div>
                  <div className="text-[11px] text-zinc-500">
                    Play harmonic chime when checking off tasks, habits, or Pomodoros
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.soundAlertEnabled}
                  onChange={(e) => updatePreferences({ soundAlertEnabled: e.target.checked })}
                  className="w-4 h-4 rounded text-zinc-900"
                />
              </div>

              {/* Mobile & Desktop Push Notifications Card */}
              <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-blue-600" />
                      Mobile & Desktop Notifications
                      {notificationPermission === 'granted' && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          Active
                        </span>
                      )}
                      {notificationPermission === 'denied' && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60">
                          Blocked
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      {notificationPermission === 'granted'
                        ? 'Lock screen, status bar, and audio chimes are enabled'
                        : notificationPermission === 'denied'
                          ? 'Notifications are blocked in your phone/browser settings'
                          : 'Permission required to alert you when task reminders arrive'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {notificationPermission !== 'granted' ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await requestNotificationPermission();
                          checkNotificationDiagnostic().then(setNotifDiag);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                      >
                        Enable Alerts
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          const result = await sendDeviceNotification('TickTick Pro Mobile Alert 🔔', {
                            body: 'Test notification working! Your task reminders will alert on this device.',
                            icon: './icon-192.png',
                            playSound: true,
                          });
                          if (result.success) {
                            pushToast({
                              title: 'Test Alert Sent! 🔔',
                              description: 'Notification banner and audio chime dispatched to your device.',
                              kind: 'success',
                            });
                          } else {
                            pushToast({
                              title: 'Notice',
                              description: result.message,
                              kind: 'info',
                            });
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-xs font-semibold transition-colors"
                      >
                        Test Alert
                      </button>
                    )}
                  </div>
                </div>

                {/* iPhone / iOS Safari tab notice */}
                {notifDiag?.isIOS && !notifDiag?.isStandalone && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200/70 text-amber-900 text-[11px] leading-relaxed">
                    <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block text-amber-950">iPhone Safari Requirement:</strong>
                      Apple blocks web notifications in regular Safari browser tabs. To receive alerts on iPhone, tap Safari's <strong>Share (⎋)</strong> ➔ <strong>Add to Home Screen</strong>, then open TickTick Pro from your home screen.
                    </div>
                  </div>
                )}

                {/* Blocked in browser notice */}
                {notificationPermission === 'denied' && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200/70 text-rose-900 text-[11px] leading-relaxed">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block text-rose-950">How to Unblock on Phone:</strong>
                      Tap the tune/lock icon in your browser URL bar ➔ <strong>Permissions / Site settings</strong> ➔ Set <strong>Notifications</strong> to <strong>Allow</strong>, then refresh.
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 gap-3">
                <div>
                  <div className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                    Mobile Application (PWA)
                  </div>
                  <div className="text-[11px] text-blue-700">
                    Install TickTick Pro on your Android phone, iPhone, or Desktop for full-screen offline experience.
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setIsInstallModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" /> Install App
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-rose-50/70 border border-rose-200/80 gap-3">
                <div>
                  <div className="text-xs font-semibold text-rose-900">
                    Start Blank (Clear All Data)
                  </div>
                  <div className="text-[11px] text-rose-700">
                    Wipe all tasks, lists, folders, tags, habits, and focus logs to start fresh from an empty workspace
                  </div>
                </div>
                <button
                  onClick={() => {
                    clearAllWorkspaceData();
                    setIsSettingsOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1 shrink-0"
                >
                  Start Blank
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 gap-3">
                <div>
                  <div className="text-xs font-semibold text-zinc-900">Restore Demo Workspace</div>
                  <div className="text-[11px] text-zinc-500">
                    Restore sample demo tasks, habits, Pomodoro logs, and lists
                  </div>
                </div>
                <button
                  onClick={() => {
                    resetDemoWorkspace();
                    setIsSettingsOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-1 shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} /> Restore Demo
                </button>
              </div>
            </div>
          )}

          {settingsInitialTab === 'themes' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-500">
                Personalize your navigation rail and accent tokens with disciplined studio themes.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {themes.map((t) => {
                  const isSelected = preferences.theme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`p-3.5 rounded-xl border text-left flex items-center justify-between ${
                        isSelected
                          ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900/10'
                          : 'border-zinc-200/80 hover:bg-zinc-50/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center -space-x-1.5">
                          <span
                            className="w-5 h-5 rounded-full border border-white"
                            style={{ backgroundColor: t.rail }}
                          />
                          <span
                            className="w-5 h-5 rounded-full border border-white"
                            style={{ backgroundColor: t.primary }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-zinc-800">{t.name}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-zinc-900" strokeWidth={2} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {settingsInitialTab === 'supabase' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-900 text-zinc-100 border border-zinc-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-emerald-400" strokeWidth={1.75} />
                    Supabase Realtime + PostgreSQL Cloud Sync
                  </span>
                  <span
                    className={`text-[10px] font-mono-num px-2 py-0.5 rounded-md font-semibold ${
                      supabaseStatus === 'connected'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {supabaseStatus === 'connected' ? 'Connected (Live Sync)' : 'Local-First Mode'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Your PC and Mobile automatically sync live via{' '}
                  <span className="text-zinc-200 font-medium">Supabase Realtime Broadcast & Presence</span>{' '}
                  with zero database setup required. For persistent database rows when all devices are closed, run the 3-line SQL snippet below in your Supabase SQL Editor.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-zinc-800 block">
                      Supabase PostgreSQL Schema (Syncs User Name, Tasks, Lists & Workspace)
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Copy and run this in your Supabase SQL Editor so your name, tasks, and lists persist to individual tables:
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(
`-- 1. Workspace Table (stores full workspace state and user name)
CREATE TABLE IF NOT EXISTS public.ticktick_workspace (
  id TEXT PRIMARY KEY,
  name TEXT,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ticktick_workspace DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.ticktick_workspace TO anon, authenticated, service_role;

-- 2. User Profiles Table (syncs user display name)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  name TEXT,
  full_name TEXT,
  email TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;

-- 3. Tasks Table (syncs task name, status, priority, due date)
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY,
  name TEXT,
  title TEXT,
  content TEXT,
  status TEXT DEFAULT 'todo',
  priority INT DEFAULT 0,
  due_date TEXT,
  list_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.tasks TO anon, authenticated, service_role;

-- 4. Lists Table (syncs list names)
CREATE TABLE IF NOT EXISTS public.lists (
  id TEXT PRIMARY KEY,
  name TEXT,
  color TEXT,
  emoji TEXT
);
ALTER TABLE public.lists DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.lists TO anon, authenticated, service_role;`
                      );
                      setSyncMessage('Copied Complete PostgreSQL Schema SQL to clipboard!');
                    }}
                    className="px-2.5 py-1.5 rounded-md bg-zinc-900 text-white text-[11px] font-semibold hover:bg-zinc-800 shrink-0"
                  >
                    Copy Complete Schema SQL
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-zinc-700 bg-white p-2.5 rounded-lg border border-zinc-200/70 overflow-x-auto leading-relaxed">
{`-- Creates ticktick_workspace, profiles (name), tasks (name/title) & lists:
CREATE TABLE IF NOT EXISTS public.ticktick_workspace (
  id TEXT PRIMARY KEY, name TEXT, payload JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY, name TEXT, full_name TEXT, email TEXT, updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY, name TEXT, title TEXT, content TEXT, status TEXT, due_date TEXT
);
ALTER TABLE public.ticktick_workspace DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;`}
                </pre>
              </div>

              <form onSubmit={handleConnectSupabase} className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-zinc-700">
                    Supabase Project URL
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSbUrl(DEMO_SUPABASE_URL);
                      setSbAnonKey(DEMO_SUPABASE_ANON_KEY);
                    }}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-medium hover:underline"
                  >
                    Fill Demo Project
                  </button>
                </div>
                <input
                  type="url"
                  required
                  value={sbUrl}
                  onChange={(e) => setSbUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 font-mono focus:outline-none focus:border-zinc-900"
                />

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Supabase Anon / Public API Key
                  </label>
                  <input
                    type="password"
                    required
                    value={sbAnonKey}
                    onChange={(e) => setSbAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 font-mono focus:outline-none focus:border-zinc-900"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Your database credentials are saved securely in this browser for future visits.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold"
                  >
                    Save & Connect Supabase
                  </button>

                  {supabaseStatus === 'connected' && (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await syncWorkspaceToSupabase();
                          setSyncMessage(res.message);
                        }}
                        className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <UploadCloud className="w-3.5 h-3.5" strokeWidth={1.75} /> Push to Supabase
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const res = await pullWorkspaceFromSupabase();
                          setSyncMessage(res.message);
                        }}
                        className="px-3 py-2 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <DownloadCloud className="w-3.5 h-3.5" strokeWidth={1.75} /> Pull from Supabase
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          disconnectSupabase();
                          setSbUrl('');
                          setSbAnonKey('');
                          setSyncMessage('Switched back to Local-First storage.');
                        }}
                        className="px-3 py-2 rounded-lg text-xs text-rose-600 hover:bg-rose-50"
                      >
                        Disconnect
                      </button>
                    </>
                  )}
                </div>
              </form>

              {(syncMessage || supabaseErrorMessage || supabaseLastSyncedAt) && (
                <div className="p-3 rounded-lg bg-zinc-100 text-xs text-zinc-700 space-y-1 font-mono-num">
                  {syncMessage && <div>{syncMessage}</div>}
                  {supabaseErrorMessage && (
                    <div className="text-rose-600 font-medium">{supabaseErrorMessage}</div>
                  )}
                  {supabaseLastSyncedAt && (
                    <div className="text-[11px] text-zinc-400">
                      Last verified at {supabaseLastSyncedAt}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {settingsInitialTab === 'shortcuts' && (
            <div className="space-y-2 text-xs">
              {[
                ['Ctrl + K / Cmd + K', 'Open Command Palette & Global Search'],
                ['Enter (in Quick Add)', 'Create Task with Smart NLP Parsing'],
                ['#tag (in Quick Add)', 'Automatically assign or create tag'],
                ['!high / !med / !low', 'Set task priority via keyboard'],
                ['~ListName', 'Route task to target list'],
                ['Space / Enter (on Task)', 'Inspect selected task details'],
              ].map(([key, desc]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 border border-zinc-200/70"
                >
                  <span className="text-zinc-700 font-medium">{desc}</span>
                  <kbd className="px-2 py-1 rounded-md bg-white border border-zinc-200/90 font-mono text-[11px] text-zinc-800">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          )}

          {settingsInitialTab === 'premium' && (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider bg-amber-400/15 text-amber-300 border border-amber-400/20 px-2 py-0.5 rounded-md">
                    <Crown className="w-3 h-3 fill-current" /> All Premium Capabilities Active
                  </div>
                  <h3 className="text-base font-semibold tracking-tight">TickTick Premium Unlocked</h3>
                  <p className="text-xs text-zinc-400">
                    Every TickTick Premium capability is unlocked and active in this workspace.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {[
                  '299 Custom Lists & 999 Tasks per list',
                  '199 Subtasks / Checklists per task',
                  '5 Calendar Views (Month, Week, Day, 3-Day, Agenda)',
                  'Timeline Gantt View with Duration Bars',
                  'Task Start/End Duration & Time-Blocking',
                  'Constant Reminders & Email Reminders',
                  'Full White Noise Studio (Rain, Forest, Binaural, Pink/Brown)',
                  'Unlimited Habits + Quantified Goals & Mood Logs',
                  'Custom Smart Filters & Activity Revision History',
                  'External Calendar Subscriptions (Google, Outlook, iCloud)',
                ].map((feat) => (
                  <div
                    key={feat}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-50 border border-zinc-200/70 text-zinc-700 font-medium"
                  >
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2} />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
