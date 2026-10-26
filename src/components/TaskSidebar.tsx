import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { format, addDays, isBefore, parseISO, startOfToday } from 'date-fns';
import {
  AlertCircle,
  Archive,
  Ban,
  Calendar,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Columns3,
  Copy,
  Crown,
  Eraser,
  FileText,
  Filter,
  FolderPlus,
  GanttChart,
  Hash,
  Inbox,
  Layers,
  LayoutGrid,
  List as ListIcon,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Share2,
  Smile,
  Trash2,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { ActiveSidebarSelection, useApp } from '../context/AppContext';
import { Priority, SmartListId, TaskList, ViewMode } from '../types';
import { isTaskDueOnDate, isTaskDueInDateRange } from '../utils/recurringTasks';

const LIST_EMOJIS = ['👋', '📋', '🚀', '💼', '🎯', '📚', '💡', '🏠', '🔥', '✨', '🎨', '⚡'];

const LIST_COLOR_PRESETS = [
  '#f87171',
  '#fb923c',
  '#facc15',
  '#a3e635',
  '#34d399',
  '#38bdf8',
  '#818cf8',
];

export const TaskSidebar: React.FC = () => {
  const {
    sidebarSelection,
    setSidebarSelection,
    tasks,
    lists,
    folders,
    tags,
    customFilters,
    addList,
    updateList,
    duplicateList,
    deleteList,
    addFolder,
    updateFolder,
    deleteFolder,
    toggleFolderCollapse,
    addTag,
    updateTag,
    deleteTag,
    addCustomFilter,
    deleteCustomFilter,
    clearAllWorkspaceData,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
  } = useApp();

  // Active three-dots context menu state
  const [openMenu, setOpenMenu] = useState<{
    kind: 'list' | 'folder' | 'tag' | 'filter';
    id: string;
  } | null>(null);

  // Create / Edit List Modal State (Rich 2-Column TickTick Modal)
  const [showListModal, setShowListModal] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [listName, setListName] = useState('');
  const [listEmoji, setListEmoji] = useState<string>('👋');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [listColor, setListColor] = useState<string>('#38bdf8');
  const [listFolderId, setListFolderId] = useState<string>('');
  const [listViewMode, setListViewMode] = useState<ViewMode>('list');
  const [listType, setListType] = useState<'task' | 'note'>('task');
  const [showInSmartList, setShowInSmartList] = useState<'all' | 'hidden'>('all');

  // Create / Edit Folder State
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  // Create / Edit Tag State
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingTagColor, setEditingTagColor] = useState('#3b66f5');

  // Create Smart Filter Modal State
  const [showNewFilterModal, setShowNewFilterModal] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [filterDateRange, setFilterDateRange] = useState<
    'any' | 'today' | 'overdue' | 'next7days'
  >('any');

  // Blank Workspace Confirmation State
  const [confirmBlankReset, setConfirmBlankReset] = useState(false);

  // Filters and Tags Accordion & Layout States
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ticktick_filters_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [isTagsCollapsed, setIsTagsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ticktick_tags_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [tagLayout, setTagLayout] = useState<'vertical' | 'horizontal'>(() => {
    try {
      return (
        (localStorage.getItem('ticktick_tag_layout') as 'vertical' | 'horizontal') || 'horizontal'
      );
    } catch {
      return 'horizontal';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ticktick_filters_collapsed', String(isFiltersCollapsed));
    } catch {}
  }, [isFiltersCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem('ticktick_tags_collapsed', String(isTagsCollapsed));
    } catch {}
  }, [isTagsCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem('ticktick_tag_layout', tagLayout);
    } catch {}
  }, [tagLayout]);

  // Close context menu when clicking outside
  useEffect(() => {
    if (!openMenu) return;
    const handleGlobalClick = () => setOpenMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [openMenu]);

  if (isSidebarCollapsed) return null;

  const handleSelectAndCloseOnMobile = (sel: ActiveSidebarSelection) => {
    setSidebarSelection(sel);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarCollapsed(true);
    }
  };

  const openCreateListModal = () => {
    setEditingListId(null);
    setListName('');
    setListEmoji('👋');
    setListColor('#38bdf8');
    setListFolderId('');
    setListViewMode('list');
    setListType('task');
    setShowInSmartList('all');
    setShowEmojiPicker(false);
    setShowListModal(true);
  };

  const openEditListModal = (list: TaskList, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenMenu(null);
    setEditingListId(list.id);
    setListName(list.name);
    setListEmoji(list.emoji || '👋');
    setListColor(list.color || '');
    setListFolderId(list.folderId || '');
    setListViewMode(list.viewMode);
    setListType(list.listType || 'task');
    setShowInSmartList(list.showInSmartList || 'all');
    setShowEmojiPicker(false);
    setShowListModal(true);
  };

  const handleSaveList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!listName.trim()) return;
    const effectiveColor = listColor || '#94a3b8';
    if (editingListId) {
      updateList(editingListId, {
        name: listName.trim(),
        emoji: listEmoji,
        color: effectiveColor,
        folderId: listFolderId || undefined,
        viewMode: listViewMode,
        listType,
        showInSmartList,
      });
    } else {
      const created = addList(
        listName,
        effectiveColor,
        listFolderId || undefined,
        listViewMode,
        {
          emoji: listEmoji,
          listType,
          showInSmartList,
        }
      );
      handleSelectAndCloseOnMobile({ kind: 'list', id: created.id });
    }
    setListName('');
    setEditingListId(null);
    setShowListModal(false);
  };

  const handleCreateFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!filterName.trim()) return;
    addCustomFilter({
      name: filterName.trim(),
      color: '#3b66f5',
      criteria: {
        priorities: filterPriority === 'all' ? [] : [filterPriority],
        tags: [],
        listIds: [],
        dateRange: filterDateRange,
        status: 'todo',
      },
    });
    setFilterName('');
    setShowNewFilterModal(false);
  };

  const today = startOfToday();
  const todayStr = format(today, 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(today, 1), 'yyyy-MM-dd');
  const next7Str = format(addDays(today, 7), 'yyyy-MM-dd');

  const activeTasks = tasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'trash' && t.status !== 'wont_do'
  );

  const counts = {
    all: activeTasks.length,
    today: activeTasks.filter(
      (t) => t.dueDate && (isTaskDueOnDate(t, todayStr) || isBefore(parseISO(t.dueDate), today))
    ).length,
    overdue: activeTasks.filter((t) => Boolean(t.dueDate && isBefore(parseISO(t.dueDate), today)))
      .length,
    tomorrow: activeTasks.filter((t) => t.dueDate && isTaskDueOnDate(t, tomorrowStr)).length,
    next7days: activeTasks.filter((t) => isTaskDueInDateRange(t, todayStr, next7Str)).length,
    inbox: activeTasks.filter((t) => t.listId === 'inbox').length,
    assigned: activeTasks.filter((t) => Boolean(t.assignee)).length,
  };

  const smartItems: { id: SmartListId; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      id: 'all',
      label: 'All Tasks',
      icon: <Layers className="w-4 h-4 text-zinc-500" strokeWidth={1.75} />,
      count: counts.all,
    },
    {
      id: 'today',
      label: 'Today',
      icon: <Calendar className="w-4 h-4 text-blue-600" strokeWidth={1.75} />,
      count: counts.today,
    },
    {
      id: 'overdue',
      label: 'Overdue',
      icon: <AlertCircle className="w-4 h-4 text-rose-600" strokeWidth={1.75} />,
      count: counts.overdue,
    },
    {
      id: 'tomorrow',
      label: 'Tomorrow',
      icon: <CalendarClock className="w-4 h-4 text-amber-600" strokeWidth={1.75} />,
      count: counts.tomorrow,
    },
    {
      id: 'next7days',
      label: 'Next 7 Days',
      icon: <CalendarDays className="w-4 h-4 text-zinc-600" strokeWidth={1.75} />,
      count: counts.next7days,
    },
    {
      id: 'inbox',
      label: 'Inbox',
      icon: <Inbox className="w-4 h-4 text-sky-600" strokeWidth={1.75} />,
      count: counts.inbox,
    },
    {
      id: 'assigned',
      label: 'Assigned to Me',
      icon: <UserCheck className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />,
      count: counts.assigned,
    },
    {
      id: 'summary',
      label: 'Smart Summary',
      icon: <FileText className="w-4 h-4 text-zinc-600" strokeWidth={1.75} />,
    },
  ];

  const visibleLists = lists.filter((l) => !l.isArchived);
  const ungroupedLists = visibleLists
    .filter((l) => !l.folderId)
    .sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));

  const renderListRow = (list: TaskList) => {
    const isSelected = sidebarSelection.kind === 'list' && sidebarSelection.id === list.id;
    const listCount = activeTasks.filter((t) => t.listId === list.id).length;
    const isMenuOpen = openMenu?.kind === 'list' && openMenu.id === list.id;

    return (
      <div
        key={list.id}
        onClick={() => handleSelectAndCloseOnMobile({ kind: 'list', id: list.id })}
        className={`relative group flex items-center justify-between px-2.5 py-2 md:py-1.5 rounded-lg text-xs cursor-pointer ${
          isSelected
            ? 'bg-blue-500/10 text-zinc-900 font-semibold'
            : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900'
        }`}
      >
        <span className="flex items-center gap-2 truncate min-w-0">
          {list.emoji ? (
            <span className="text-xs leading-none shrink-0">{list.emoji}</span>
          ) : (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: list.color }}
            />
          )}
          <span className="truncate">{list.name}</span>
          {list.isPinned && (
            <Pin className="w-2.5 h-2.5 text-blue-600 fill-blue-600 shrink-0" strokeWidth={1.75} />
          )}
          {list.isShared && (
            <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-200/80 text-zinc-600 font-medium shrink-0">
              Team
            </span>
          )}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(isMenuOpen ? null : { kind: 'list', id: list.id });
            }}
            title={`More options for "${list.name}"`}
            aria-label={`List options ${list.name}`}
            className={`p-1 rounded hover:bg-zinc-200/80 text-zinc-400 hover:text-zinc-800 transition-opacity ${
              isMenuOpen ? 'opacity-100 bg-zinc-200/80 text-zinc-800' : 'md:opacity-0 md:group-hover:opacity-100'
            }`}
          >
            <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>

          {listCount > 0 && (
            <span className="text-[11px] font-mono-num text-zinc-400 pl-0.5">{listCount}</span>
          )}
          {list.color && (
            <span
              className="w-2 h-2 rounded-full shrink-0 ml-0.5"
              style={{ backgroundColor: list.color }}
            />
          )}
        </div>

        {/* Floating Three-Dots Context Menu (TickTick Popover) */}
        {isMenuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-2 top-8 z-50 w-44 rounded-xl bg-zinc-900 text-zinc-100 shadow-2xl border border-zinc-800 py-1.5 text-xs animate-popover"
          >
            <button
              type="button"
              aria-label={`Edit list ${list.name}`}
              onClick={(e) => openEditListModal(list, e)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-zinc-800 text-left"
            >
              <Pencil className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.75} />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => {
                updateList(list.id, { isPinned: !list.isPinned });
                setOpenMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-zinc-800 text-left"
            >
              <Pin className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.75} />
              <span>{list.isPinned ? 'Unpin' : 'Pin'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                duplicateList(list.id);
                setOpenMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-zinc-800 text-left"
            >
              <Copy className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.75} />
              <span>Duplicate</span>
            </button>
            <button
              type="button"
              onClick={() => {
                updateList(list.id, { isShared: !list.isShared });
                setOpenMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-zinc-800 text-left"
            >
              <Share2 className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.75} />
              <span>{list.isShared ? 'Stop Sharing' : 'Share'}</span>
            </button>
            <div className="my-1 border-t border-zinc-800" />
            <button
              type="button"
              onClick={() => {
                updateList(list.id, { isArchived: true });
                setOpenMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-zinc-800 text-left"
            >
              <Archive className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.75} />
              <span>Archive</span>
            </button>
            <button
              type="button"
              aria-label={`Delete list ${list.name}`}
              onClick={() => {
                deleteList(list.id);
                setOpenMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-rose-500/20 text-rose-400 text-left"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" strokeWidth={1.75} />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Slide-Over Backdrop (<768px) */}
      <div
        onClick={() => setIsSidebarCollapsed(true)}
        className="md:hidden fixed inset-0 z-30 bg-zinc-950/40 backdrop-blur-[2px] animate-backdrop"
      />

      <aside
        aria-label="Lists, Tags, and Filters"
        className="fixed inset-y-0 left-0 z-40 w-[280px] max-w-[85vw] pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0 md:static md:z-auto md:w-60 shrink-0 bg-zinc-50 border-r border-zinc-200/80 flex flex-col h-full select-none overflow-y-auto shadow-2xl md:shadow-none animate-drawer-left md:[animation:none]"
      >
        {/* Mobile Drawer Header */}
        <div className="md:hidden flex items-center justify-between px-3.5 pt-3 pb-2 border-b border-zinc-200/70">
          <span className="text-xs font-semibold text-zinc-900 tracking-tight">
            Lists, Filters & Tags
          </span>
          <button
            onClick={() => setIsSidebarCollapsed(true)}
            aria-label="Close Sidebar"
            className="p-1 rounded-md text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Smart Lists Section */}
        <div className="p-2.5 space-y-0.5">
          {smartItems.map((item) => {
            const isSelected = sidebarSelection.kind === 'smart' && sidebarSelection.id === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectAndCloseOnMobile({ kind: 'smart', id: item.id })}
                className={`w-full flex items-center justify-between px-2.5 py-2 md:py-1.5 rounded-lg text-xs font-medium ${
                  isSelected
                    ? 'bg-zinc-900/[0.06] text-zinc-900 font-semibold'
                    : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`text-[11px] font-mono-num ${
                      isSelected ? 'text-zinc-900 font-semibold' : 'text-zinc-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="border-t border-zinc-200/70 mx-3 my-1" />

        {/* Folders & Custom Lists Section */}
        <div className="px-2.5 py-2">
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-mono-num">
              Lists ({visibleLists.length}/299)
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setShowNewFolderInput((v) => !v)}
                title="New Folder"
                aria-label="New Folder"
                className="p-1 rounded-md hover:bg-zinc-200/70 text-zinc-400 hover:text-zinc-700"
              >
                <FolderPlus className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
              <button
                onClick={openCreateListModal}
                title="New List"
                aria-label="New List"
                className="p-1 rounded-md hover:bg-zinc-200/70 text-zinc-400 hover:text-zinc-700"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          {showNewFolderInput && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newFolderName.trim()) {
                  addFolder(newFolderName);
                  setNewFolderName('');
                  setShowNewFolderInput(false);
                }
              }}
              className="mb-2 px-1 animate-popover"
            >
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name + Enter..."
                autoFocus
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 bg-white focus:outline-none focus:border-zinc-900"
              />
            </form>
          )}

          {/* Folders */}
          <div className="space-y-1">
            {folders.map((folder) => {
              const folderLists = visibleLists.filter((l) => l.folderId === folder.id);
              const isEditingThisFolder = editingFolderId === folder.id;
              const isFolderMenuOpen = openMenu?.kind === 'folder' && openMenu.id === folder.id;

              return (
                <div key={folder.id} className="space-y-0.5">
                  {isEditingThisFolder ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (editingFolderName.trim()) {
                          updateFolder(folder.id, editingFolderName);
                        }
                        setEditingFolderId(null);
                      }}
                      className="flex items-center gap-1 px-1.5 py-1 bg-white rounded-lg border border-zinc-300"
                    >
                      <input
                        type="text"
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        autoFocus
                        className="flex-1 min-w-0 text-xs text-zinc-900 focus:outline-none"
                      />
                      <button
                        type="submit"
                        title="Save folder name"
                        className="p-1 rounded bg-zinc-900 text-white"
                      >
                        <Check className="w-3 h-3" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingFolderId(null)}
                        title="Cancel"
                        className="p-1 rounded text-zinc-400 hover:bg-zinc-100"
                      >
                        <X className="w-3 h-3" strokeWidth={2} />
                      </button>
                    </form>
                  ) : (
                    <div
                      onClick={() => toggleFolderCollapse(folder.id)}
                      className="relative group flex items-center justify-between px-2 py-1.5 md:py-1 rounded-md text-xs font-semibold text-zinc-600 hover:bg-zinc-200/50 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5 truncate min-w-0">
                        {folder.isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={1.75} />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={1.75} />
                        )}
                        <span className="truncate">{folder.name}</span>
                      </span>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenu(
                              isFolderMenuOpen ? null : { kind: 'folder', id: folder.id }
                            );
                          }}
                          title={`Folder options for "${folder.name}"`}
                          aria-label={`Folder options ${folder.name}`}
                          className={`p-1 rounded hover:bg-zinc-200/80 text-zinc-400 hover:text-zinc-800 transition-opacity ${
                            isFolderMenuOpen
                              ? 'opacity-100 bg-zinc-200/80 text-zinc-800'
                              : 'md:opacity-0 md:group-hover:opacity-100'
                          }`}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </button>
                        <span className="text-[10px] font-mono-num text-zinc-400">
                          {folderLists.length}
                        </span>
                      </div>

                      {isFolderMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-2 top-7 z-50 w-40 rounded-xl bg-zinc-900 text-zinc-100 shadow-2xl border border-zinc-800 py-1.5 text-xs font-normal animate-popover"
                        >
                          <button
                            type="button"
                            aria-label={`Rename folder ${folder.name}`}
                            onClick={() => {
                              setEditingFolderId(folder.id);
                              setEditingFolderName(folder.name);
                              setOpenMenu(null);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-zinc-800 text-left"
                          >
                            <Pencil className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.75} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete folder ${folder.name}`}
                            onClick={() => {
                              deleteFolder(folder.id);
                              setOpenMenu(null);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-rose-500/20 text-rose-400 text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" strokeWidth={1.75} />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {!folder.isCollapsed && (
                    <div className="pl-3 space-y-0.5">
                      {folderLists.map(renderListRow)}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ungrouped Lists */}
            {ungroupedLists.map(renderListRow)}
          </div>
        </div>

        <div className="border-t border-zinc-200/70 mx-3 my-1" />

        {/* Smart Custom Filters */}
        <div className="px-2.5 py-2">
          <div className="flex items-center justify-between px-2 mb-1">
            <button
              type="button"
              onClick={() => setIsFiltersCollapsed((v) => !v)}
              aria-label="Toggle Filters Section"
              className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
            >
              {isFiltersCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={1.75} />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={1.75} />
              )}
              <span>Filters ({customFilters.length})</span>
            </button>
            <button
              onClick={() => {
                setIsFiltersCollapsed(false);
                setShowNewFilterModal(true);
              }}
              title="Create Smart Filter"
              aria-label="Create Smart Filter"
              className="p-1 rounded-md hover:bg-zinc-200/70 text-zinc-400 hover:text-zinc-700"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>
          {!isFiltersCollapsed && (
            <div className="space-y-0.5 animate-accordion-down">
              {customFilters.length === 0 ? (
                <div className="px-2 py-1 text-[11px] text-zinc-400 italic">No custom filters yet</div>
              ) : (
                customFilters.map((flt) => {
                  const isSelected =
                    sidebarSelection.kind === 'filter' && sidebarSelection.id === flt.id;
                  return (
                    <div
                      key={flt.id}
                      className={`group flex items-center justify-between px-2.5 py-2 md:py-1.5 rounded-lg text-xs cursor-pointer ${
                        isSelected
                          ? 'bg-zinc-900/[0.06] text-zinc-900 font-semibold'
                          : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900'
                      }`}
                      onClick={() => handleSelectAndCloseOnMobile({ kind: 'filter', id: flt.id })}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Filter
                          className="w-3.5 h-3.5 shrink-0"
                          style={{ color: flt.color }}
                          strokeWidth={1.75}
                        />
                        <span className="truncate">{flt.name}</span>
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCustomFilter(flt.id);
                        }}
                        title="Delete filter"
                        className="md:opacity-0 md:group-hover:opacity-100 text-zinc-400 hover:text-rose-500 p-0.5"
                      >
                        <Trash2 className="w-3 h-3" strokeWidth={1.75} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200/70 mx-3 my-1" />

        {/* Tags Section (with Accordion, Vertical & Horizontal Wrap Layouts, Three-Dots Menu) */}
        <div className="px-2.5 py-2">
          <div className="flex items-center justify-between px-2 mb-1.5">
            <button
              type="button"
              onClick={() => setIsTagsCollapsed((v) => !v)}
              aria-label="Toggle Tags Section"
              className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
            >
              {isTagsCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={1.75} />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={1.75} />
              )}
              <span>Tags ({tags.length})</span>
            </button>

            <div className="flex items-center gap-1">
              {/* Layout Mode Segmented Control: Vertical List vs Horizontal Pills */}
              <div className="flex items-center bg-zinc-200/60 p-0.5 rounded-md">
                <button
                  type="button"
                  onClick={() => setTagLayout('vertical')}
                  title="Vertical List Layout"
                  aria-label="Vertical Tag Layout"
                  className={`p-1 rounded text-xs transition-colors ${
                    tagLayout === 'vertical'
                      ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                      : 'text-zinc-400 hover:text-zinc-700'
                  }`}
                >
                  <ListIcon className="w-3 h-3" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => setTagLayout('horizontal')}
                  title="Horizontal Pills Layout"
                  aria-label="Horizontal Tag Layout"
                  className={`p-1 rounded text-xs transition-colors ${
                    tagLayout === 'horizontal'
                      ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                      : 'text-zinc-400 hover:text-zinc-700'
                  }`}
                >
                  <LayoutGrid className="w-3 h-3" strokeWidth={1.75} />
                </button>
              </div>

              <button
                onClick={() => {
                  setIsTagsCollapsed(false);
                  setShowNewTagInput((v) => !v);
                }}
                title="New Tag"
                aria-label="New Tag"
                className="p-1 rounded-md hover:bg-zinc-200/70 text-zinc-400 hover:text-zinc-700"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          {!isTagsCollapsed && (
            <div className="animate-accordion-down">
              {showNewTagInput && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newTagName.trim()) {
                      addTag(newTagName, '#3b66f5');
                      setNewTagName('');
                      setShowNewTagInput(false);
                    }
                  }}
                  className="mb-2 px-1 animate-popover"
                >
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="#tag name + Enter..."
                    autoFocus
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 bg-white focus:outline-none focus:border-zinc-900"
                  />
                </form>
              )}

              {/* Inline Tag Edit Form */}
              {editingTagId && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editingTagName.trim()) {
                      updateTag(editingTagId, editingTagName, editingTagColor);
                    }
                    setEditingTagId(null);
                  }}
                  className="mb-2 p-2 rounded-lg bg-white border border-zinc-300 space-y-2 animate-popover"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Edit Tag
                  </div>
                  <input
                    type="text"
                    value={editingTagName}
                    onChange={(e) => setEditingTagName(e.target.value)}
                    autoFocus
                    className="w-full px-2 py-1 text-xs rounded border border-zinc-200 focus:outline-none focus:border-zinc-900"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {['#2563eb', '#059669', '#d97706', '#e11d48', '#7c3aed', '#0d9488'].map(
                        (c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditingTagColor(c)}
                            style={{ backgroundColor: c }}
                            className={`w-4 h-4 rounded-full ${
                              editingTagColor === c ? 'ring-2 ring-offset-1 ring-zinc-900' : ''
                            }`}
                          />
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingTagId(null)}
                        className="px-2 py-0.5 rounded text-[10px] text-zinc-500 hover:bg-zinc-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-900 text-white"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {tags.length === 0 ? (
                <div className="mx-1 p-3 rounded-lg bg-zinc-200/50 text-[11px] text-zinc-500 leading-relaxed">
                  Categorize your tasks with tags. Quickly select a tag by typing{' '}
                  <span className="font-mono font-semibold text-zinc-700">'#'</span> when adding a
                  task
                </div>
              ) : tagLayout === 'horizontal' ? (
                /* Horizontal Rectangle Cells Cloud */
                <div className="flex flex-wrap gap-1 px-0.5 py-1">
                  {tags.map((tag) => {
                    const isSelected =
                      sidebarSelection.kind === 'tag' && sidebarSelection.id === tag.name;
                    const isTagMenuOpen = openMenu?.kind === 'tag' && openMenu.id === tag.id;
                    return (
                      <div key={tag.id} className="relative inline-flex">
                        <div
                          onClick={() =>
                            handleSelectAndCloseOnMobile({ kind: 'tag', id: tag.name })
                          }
                          className={`group flex items-center gap-1.5 px-2 py-0.5 rounded-[5px] text-[11px] font-medium cursor-pointer border transition-all ${
                            isSelected
                              ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs'
                              : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200/90 shadow-2xs hover:border-zinc-300'
                          }`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="truncate max-w-[110px]">#{tag.name}</span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenu(isTagMenuOpen ? null : { kind: 'tag', id: tag.id });
                            }}
                            title={`Tag options for #${tag.name}`}
                            aria-label={`Tag options ${tag.name}`}
                            className={`p-0.5 rounded hover:bg-black/10 transition-colors ${
                              isSelected
                                ? 'text-zinc-300 hover:text-white'
                                : 'text-zinc-400 hover:text-zinc-800'
                            }`}
                          >
                            <MoreHorizontal className="w-2.5 h-2.5" strokeWidth={1.75} />
                          </button>
                        </div>

                        {isTagMenuOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute left-0 top-full mt-1.5 z-50 w-36 rounded-xl bg-zinc-900 text-zinc-100 shadow-2xl border border-zinc-800 py-1.5 text-xs animate-popover"
                          >
                            <button
                              type="button"
                              aria-label={`Edit tag ${tag.name}`}
                              onClick={() => {
                                setEditingTagId(tag.id);
                                setEditingTagName(tag.name);
                                setEditingTagColor(tag.color);
                                setOpenMenu(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-zinc-800 text-left"
                            >
                              <Pencil className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.75} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete tag ${tag.name}`}
                              onClick={() => {
                                deleteTag(tag.id);
                                setOpenMenu(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-rose-500/20 text-rose-400 text-left"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" strokeWidth={1.75} />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Vertical List Rows */
                <div className="space-y-0.5">
                  {tags.map((tag) => {
                    const isSelected =
                      sidebarSelection.kind === 'tag' && sidebarSelection.id === tag.name;
                    const isTagMenuOpen = openMenu?.kind === 'tag' && openMenu.id === tag.id;
                    return (
                      <div
                        key={tag.id}
                        onClick={() => handleSelectAndCloseOnMobile({ kind: 'tag', id: tag.name })}
                        className={`relative group flex items-center justify-between px-2.5 py-1.5 md:py-1 rounded-lg text-xs cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-900/[0.06] text-zinc-900 font-semibold'
                            : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 truncate min-w-0">
                          <Hash
                            className="w-3 h-3 shrink-0"
                            style={{ color: tag.color }}
                            strokeWidth={1.75}
                          />
                          <span className="truncate">{tag.name}</span>
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenu(isTagMenuOpen ? null : { kind: 'tag', id: tag.id });
                            }}
                            title={`Tag options for #${tag.name}`}
                            aria-label={`Tag options ${tag.name}`}
                            className={`p-1 rounded hover:bg-zinc-200/80 text-zinc-400 hover:text-zinc-800 transition-opacity ${
                              isTagMenuOpen
                                ? 'opacity-100 bg-zinc-200/80 text-zinc-800'
                                : 'md:opacity-0 md:group-hover:opacity-100'
                            }`}
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </button>
                        </div>

                        {isTagMenuOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-2 top-7 z-50 w-40 rounded-xl bg-zinc-900 text-zinc-100 shadow-2xl border border-zinc-800 py-1.5 text-xs animate-popover"
                          >
                            <button
                              type="button"
                              aria-label={`Edit tag ${tag.name}`}
                              onClick={() => {
                                setEditingTagId(tag.id);
                                setEditingTagName(tag.name);
                                setEditingTagColor(tag.color);
                                setOpenMenu(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-zinc-800 text-left"
                            >
                              <Pencil className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.75} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete tag ${tag.name}`}
                              onClick={() => {
                                deleteTag(tag.id);
                                setOpenMenu(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-rose-500/20 text-rose-400 text-left"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" strokeWidth={1.75} />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Archive / Completed / Won't Do / Trash & Start Blank */}
        <div className="mt-auto p-2.5 border-t border-zinc-200/80 space-y-0.5">
          <button
            onClick={() => handleSelectAndCloseOnMobile({ kind: 'smart', id: 'completed' })}
            className={`w-full flex items-center justify-between px-2.5 py-2 md:py-1.5 rounded-lg text-xs ${
              sidebarSelection.kind === 'smart' && sidebarSelection.id === 'completed'
                ? 'bg-zinc-900/[0.06] text-zinc-900 font-semibold'
                : 'text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.75} />
              Completed
            </span>
            <span className="text-[11px] font-mono-num">
              {tasks.filter((t) => t.status === 'completed').length}
            </span>
          </button>

          <button
            onClick={() => handleSelectAndCloseOnMobile({ kind: 'smart', id: 'wont_do' })}
            className={`w-full flex items-center justify-between px-2.5 py-2 md:py-1.5 rounded-lg text-xs ${
              sidebarSelection.kind === 'smart' && sidebarSelection.id === 'wont_do'
                ? 'bg-zinc-900/[0.06] text-zinc-900 font-semibold'
                : 'text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <XCircle className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.75} />
              Won't Do
            </span>
            <span className="text-[11px] font-mono-num">
              {tasks.filter((t) => t.status === 'wont_do').length}
            </span>
          </button>

          <button
            onClick={() => handleSelectAndCloseOnMobile({ kind: 'smart', id: 'trash' })}
            className={`w-full flex items-center justify-between px-2.5 py-2 md:py-1.5 rounded-lg text-xs ${
              sidebarSelection.kind === 'smart' && sidebarSelection.id === 'trash'
                ? 'bg-zinc-900/[0.06] text-zinc-900 font-semibold'
                : 'text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5 text-rose-500" strokeWidth={1.75} />
              Trash
            </span>
            <span className="text-[11px] font-mono-num">
              {tasks.filter((t) => t.status === 'trash').length}
            </span>
          </button>

          {/* Start Blank / Clear All Data Button */}
          <div className="pt-2 mt-1 border-t border-zinc-200/70">
            {!confirmBlankReset ? (
              <button
                type="button"
                onClick={() => setConfirmBlankReset(true)}
                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-rose-600 bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200/70"
              >
                <Eraser className="w-3.5 h-3.5" strokeWidth={1.75} />
                Reset to Blank Workspace
              </button>
            ) : (
              <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 space-y-1.5 animate-popover">
                <div className="text-[10px] font-semibold text-rose-800">
                  Clear all tasks, lists, habits & logs?
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      clearAllWorkspaceData();
                      setConfirmBlankReset(false);
                    }}
                    className="flex-1 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-semibold"
                  >
                    Yes, Start Blank
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmBlankReset(false)}
                    className="px-2 py-1 rounded bg-white text-zinc-600 text-[10px] font-medium border border-zinc-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rich 2-Column TickTick Modal: Edit List / Add List with Live Preview (Portaled to document.body) */}
        {showListModal &&
          createPortal(
            <div
              onClick={() => setShowListModal(false)}
              className="fixed inset-0 z-[100] bg-zinc-950/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-backdrop"
            >
              <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSaveList}
                className="surface-floating rounded-t-2xl sm:rounded-2xl w-full max-w-[680px] p-6 pb-8 sm:pb-6 animate-sheet-up sm:animate-modal bg-white border border-zinc-200 shadow-2xl overflow-hidden"
              >
                <div className="sm:hidden w-10 h-1 rounded-full bg-zinc-300 mx-auto -mt-1 mb-3" />

                {/* Modal Header */}
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-semibold text-zinc-900">
                    {editingListId ? 'Edit List' : 'Add List'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowListModal(false)}
                    aria-label="Close modal"
                    className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <X className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>

                {/* 2-Column Body */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-stretch">
                  {/* Left Column: Form Controls */}
                  <div className="sm:col-span-7 space-y-4 min-w-0">
                    {/* Unified Emoji + Name Input */}
                    <div className="relative flex items-center rounded-lg border border-blue-500 ring-2 ring-blue-500/10 bg-white">
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker((v) => !v)}
                        title="Choose list icon"
                        className="px-3 py-2 border-r border-zinc-200 text-sm hover:bg-zinc-50 flex items-center justify-center shrink-0"
                      >
                        {listEmoji || <Smile className="w-4 h-4 text-zinc-400" />}
                      </button>
                      <input
                        type="text"
                        required
                        autoFocus
                        value={listName}
                        onChange={(e) => setListName(e.target.value)}
                        placeholder="Name"
                        className="flex-1 min-w-0 px-3 py-2 text-xs text-zinc-900 focus:outline-none bg-transparent"
                      />

                      {showEmojiPicker && (
                        <div className="absolute left-0 top-11 z-30 p-2 rounded-xl bg-white border border-zinc-200 shadow-xl grid grid-cols-6 gap-1 animate-popover">
                          {LIST_EMOJIS.map((em) => (
                            <button
                              key={em}
                              type="button"
                              onClick={() => {
                                setListEmoji(em);
                                setShowEmojiPicker(false);
                              }}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm hover:bg-zinc-100 ${
                                listEmoji === em ? 'bg-blue-50 ring-1 ring-blue-500' : ''
                              }`}
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* List Color Swatches */}
                    <div className="grid grid-cols-[115px_1fr] items-center gap-2">
                      <label className="text-xs font-medium text-zinc-600">List Color</label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setListColor('')}
                          title="No Color"
                          className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ${
                            !listColor
                              ? 'border-zinc-900 text-zinc-900 ring-2 ring-offset-1 ring-zinc-300'
                              : 'border-zinc-300 text-zinc-400'
                          }`}
                        >
                          <Ban className="w-3 h-3" strokeWidth={2} />
                        </button>
                        {LIST_COLOR_PRESETS.map((c) => (
                          <button
                            type="button"
                            key={c}
                            onClick={() => setListColor(c)}
                            style={{ backgroundColor: c }}
                            className={`w-5 h-5 rounded-full transition-transform shrink-0 ${
                              listColor === c ? 'ring-2 ring-offset-2 ring-zinc-900 scale-105' : ''
                            }`}
                          />
                        ))}
                        <label
                          title="Custom Color"
                          className="w-5 h-5 rounded-full cursor-pointer border border-zinc-300 bg-[conic-gradient(from_90deg,#ef4444,#f59e0b,#10b981,#3b82f6,#8b5cf6,#ef4444)] relative overflow-hidden shrink-0"
                        >
                          <input
                            type="color"
                            value={listColor || '#38bdf8'}
                            onChange={(e) => setListColor(e.target.value)}
                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                          />
                        </label>
                      </div>
                    </div>

                    {/* View Type Visual Cards (List / Kanban / Timeline with Crown) */}
                    <div className="grid grid-cols-[115px_1fr] items-center gap-2">
                      <label className="text-xs font-medium text-zinc-600">View Type</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            { id: 'list', label: 'List', icon: ListIcon, pro: false },
                            { id: 'kanban', label: 'Kanban', icon: Columns3, pro: false },
                            { id: 'timeline', label: 'Timeline', icon: GanttChart, pro: true },
                          ] as const
                        ).map((v) => {
                          const Icon = v.icon;
                          const active = listViewMode === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => setListViewMode(v.id)}
                              title={`${v.label} View`}
                              className={`relative h-10 rounded-lg border flex items-center justify-center transition-colors ${
                                active
                                  ? 'border-blue-600 bg-blue-50/70 text-blue-600 ring-1 ring-blue-600/30'
                                  : 'border-zinc-200 bg-zinc-50/60 text-zinc-500 hover:bg-zinc-100'
                              }`}
                            >
                              <Icon className="w-4 h-4" strokeWidth={1.75} />
                              {v.pro && (
                                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center">
                                  <Crown className="w-2.5 h-2.5 text-amber-600 fill-amber-500" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Folder Selector */}
                    <div className="grid grid-cols-[115px_1fr] items-center gap-2">
                      <label className="text-xs font-medium text-zinc-600">Folder</label>
                      <select
                        value={listFolderId}
                        onChange={(e) => setListFolderId(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-zinc-200 bg-zinc-50/70 text-zinc-700 focus:outline-none focus:border-blue-500 truncate"
                      >
                        <option value="">None</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* List Type Selector */}
                    <div className="grid grid-cols-[115px_1fr] items-center gap-2">
                      <label className="text-xs font-medium text-zinc-600">List Type</label>
                      <select
                        value={listType}
                        onChange={(e) => setListType(e.target.value as 'task' | 'note')}
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-zinc-200 bg-zinc-50/70 text-zinc-700 focus:outline-none focus:border-blue-500"
                      >
                        <option value="task">Task List</option>
                        <option value="note">Note List</option>
                      </select>
                    </div>

                    {/* Show in Smart List Selector */}
                    <div className="grid grid-cols-[115px_1fr] items-center gap-2">
                      <label className="text-xs font-medium text-zinc-600">
                        Show in Smart List
                      </label>
                      <select
                        value={showInSmartList}
                        onChange={(e) => setShowInSmartList(e.target.value as 'all' | 'hidden')}
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-zinc-200 bg-zinc-50/70 text-zinc-700 focus:outline-none focus:border-blue-500"
                      >
                        <option value="all">All tasks</option>
                        <option value="hidden">Do not show</option>
                      </select>
                    </div>
                  </div>

                  {/* Right Column: Live Interactive Workspace Preview */}
                  <div className="sm:col-span-5 rounded-xl bg-zinc-100/80 border border-zinc-200/80 p-3.5 flex flex-col justify-between select-none min-w-0">
                    <div className="rounded-lg bg-white border border-zinc-200/80 p-3 shadow-xs space-y-2.5 flex-1">
                      {/* Preview Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs">{listEmoji}</span>
                          <span className="text-xs font-semibold text-zinc-900 truncate">
                            {listName.trim() || 'Welcome'}
                          </span>
                        </div>
                        <MoreHorizontal className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                      </div>

                      {/* Preview Add Bar */}
                      <div className="h-5 rounded bg-zinc-100 px-2 flex items-center">
                        <Plus className="w-2.5 h-2.5 text-zinc-300" />
                      </div>

                      {/* Dynamic Preview Layout by View Mode */}
                      {listViewMode === 'list' && (
                        <div className="space-y-2 pt-1">
                          <div className="text-[8px] font-semibold uppercase tracking-wider text-zinc-400">
                            Today
                          </div>
                          {[1, 2, 3].map((idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-1">
                                <span
                                  className="w-2.5 h-2.5 rounded-[3px] border"
                                  style={{ borderColor: listColor || '#cbd5e1' }}
                                />
                                <div className="h-2 rounded bg-zinc-100 flex-1" />
                              </div>
                              <span
                                className="text-[8px] font-mono-num"
                                style={{ color: listColor || '#3b82f6' }}
                              >
                                Today
                              </span>
                            </div>
                          ))}
                          <div className="text-[8px] font-semibold uppercase tracking-wider text-zinc-400 pt-1">
                            Completed
                          </div>
                          {[1, 2].map((idx) => (
                            <div key={idx} className="flex items-center gap-1.5 opacity-60">
                              <span className="w-2.5 h-2.5 rounded-[3px] bg-zinc-300 flex items-center justify-center text-white">
                                <Check className="w-2 h-2" />
                              </span>
                              <div className="h-2 rounded bg-zinc-100 flex-1" />
                            </div>
                          ))}
                        </div>
                      )}

                      {listViewMode === 'kanban' && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {['To Do', 'Doing'].map((col) => (
                            <div
                              key={col}
                              className="rounded bg-zinc-50 p-1.5 space-y-1.5 border border-zinc-100"
                            >
                              <div className="text-[8px] font-semibold text-zinc-400">{col}</div>
                              {[1, 2].map((card) => (
                                <div
                                  key={card}
                                  className="p-1.5 rounded bg-white border border-zinc-200/70 space-y-1"
                                >
                                  <div className="h-1.5 w-3/4 rounded bg-zinc-200" />
                                  <div
                                    className="h-1 w-1/3 rounded"
                                    style={{ backgroundColor: listColor || '#38bdf8' }}
                                  />
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}

                      {listViewMode === 'timeline' && (
                        <div className="space-y-2 pt-1">
                          <div className="grid grid-cols-4 gap-1 text-[8px] text-zinc-400 font-mono-num border-b border-zinc-100 pb-1">
                            <span>Mon</span>
                            <span>Tue</span>
                            <span>Wed</span>
                            <span>Thu</span>
                          </div>
                          {[
                            { start: 'ml-0 w-2/3', label: 'Phase 1' },
                            { start: 'ml-4 w-3/4', label: 'Phase 2' },
                            { start: 'ml-2 w-1/2', label: 'Launch' },
                          ].map((bar, i) => (
                            <div key={i} className="h-3.5 flex items-center">
                              <div
                                style={{ backgroundColor: listColor || '#38bdf8' }}
                                className={`h-2.5 rounded ${bar.start} opacity-80`}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end gap-2.5 pt-5 mt-5 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setShowListModal(false)}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs"
                  >
                    {editingListId ? 'Save' : 'Create'}
                  </button>
                </div>
              </form>
            </div>,
            document.body
          )}

        {/* Modal: Create Smart Filter (Portaled to document.body) */}
        {showNewFilterModal &&
          createPortal(
            <div
              onClick={() => setShowNewFilterModal(false)}
              className="fixed inset-0 z-[100] bg-zinc-950/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-backdrop"
            >
              <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleCreateFilter}
                className="surface-floating rounded-t-2xl sm:rounded-xl w-full max-w-sm p-5 pb-8 sm:pb-5 space-y-4 animate-sheet-up sm:animate-modal bg-white"
              >
                <div className="sm:hidden w-10 h-1 rounded-full bg-zinc-300 mx-auto -mt-1 mb-2" />
                <h3 className="text-sm font-semibold text-zinc-900">Create Smart Filter</h3>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">
                    Filter Name
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    placeholder="e.g. Urgent This Week"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 focus:outline-none focus:border-zinc-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Priority</label>
                    <select
                      value={filterPriority}
                      onChange={(e) =>
                        setFilterPriority(
                          e.target.value === 'all' ? 'all' : (Number(e.target.value) as Priority)
                        )
                      }
                      className="w-full px-2.5 py-2 text-xs rounded-lg border border-zinc-300 bg-white"
                    >
                      <option value="all">Any Priority</option>
                      <option value={5}>High Priority</option>
                      <option value={3}>Medium Priority</option>
                      <option value={1}>Low Priority</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Due Date</label>
                    <select
                      value={filterDateRange}
                      onChange={(e) =>
                        setFilterDateRange(
                          e.target.value as 'any' | 'today' | 'overdue' | 'next7days'
                        )
                      }
                      className="w-full px-2.5 py-2 text-xs rounded-lg border border-zinc-300 bg-white"
                    >
                      <option value="any">Any Date</option>
                      <option value="today">Today</option>
                      <option value="overdue">Overdue</option>
                      <option value="next7days">Next 7 Days</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewFilterModal(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800"
                  >
                    Save Filter
                  </button>
                </div>
              </form>
            </div>,
            document.body
          )}
      </aside>
    </>
  );
};
