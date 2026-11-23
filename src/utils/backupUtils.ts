import type { Task, TaskList } from '../types';
import type { MergeableWorkspaceSnapshot } from './syncMerge';

export interface WorkspaceBackupPayload {
  app: 'TickTick Pro';
  version: number;
  exportedAt: string;
  data: MergeableWorkspaceSnapshot;
}

export function serializeWorkspaceBackup(snapshot: MergeableWorkspaceSnapshot): string {
  const payload: WorkspaceBackupPayload = {
    app: 'TickTick Pro',
    version: 2,
    exportedAt: new Date().toISOString(),
    data: snapshot,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseWorkspaceBackup(rawJson: string): MergeableWorkspaceSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Invalid JSON file. Please select a valid TickTick Pro backup.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup file is empty or malformed.');
  }

  const record = parsed as Record<string, unknown>;
  const dataObj =
    record.data && typeof record.data === 'object'
      ? (record.data as MergeableWorkspaceSnapshot)
      : (record as MergeableWorkspaceSnapshot);

  if (
    !Array.isArray(dataObj.tasks) &&
    !Array.isArray(dataObj.habits) &&
    !Array.isArray(dataObj.lists)
  ) {
    throw new Error('Backup does not contain recognizable tasks, lists, or habits data.');
  }

  return dataObj;
}

function escapeCsvCell(value: string | number | undefined | null): string {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function priorityLabel(p: Task['priority']): string {
  if (p === 5) return 'High';
  if (p === 3) return 'Medium';
  if (p === 1) return 'Low';
  return 'None';
}

export function tasksToCsv(tasks: Task[], lists: TaskList[]): string {
  const listNameById = new Map(lists.map((l) => [l.id, l.name]));
  const headers = [
    'ID',
    'Title',
    'List',
    'Status',
    'Priority',
    'Due Date',
    'Start Time',
    'Tags',
    'Notes',
    'Completed At',
    'Created At',
  ];

  const rows = tasks
    .filter((t) => t.status !== 'trash')
    .map((t) => [
      t.id,
      t.title,
      t.listId === 'inbox' ? 'Inbox' : listNameById.get(t.listId) || t.listId,
      t.status,
      priorityLabel(t.priority),
      t.dueDate || '',
      t.startTime || '',
      (t.tags || []).join('; '),
      t.content || '',
      t.completedAt || '',
      t.createdAt || '',
    ]);

  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

export function triggerBrowserDownload(content: string, filename: string, mimeType: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
