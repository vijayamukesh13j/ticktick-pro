import { expect, test } from '@playwright/test';

test.describe('TickTick Pro — Desktop & Mobile E2E Suite', () => {
  test('Smart NLP Quick-Add, View Switcher (List / Kanban / Timeline), and Task Completion', async ({
    page,
  }) => {
    await page.goto('/');

    // Verify Tasks workspace header is visible (defaults to 'Today' smart view)
    await expect(page.locator('h1', { hasText: 'Today' })).toBeVisible();

    // Test Smart NLP Quick-Add input
    const quickInput = page.locator('input[placeholder*="Try NLP"]');
    await expect(quickInput).toBeVisible();

    await quickInput.fill('Verify Playwright E2E flow today for 25m !high #qa');

    // Verify live NLP token detection banner appears before submitting
    await expect(page.getByText('Smart NLP recognized:')).toBeVisible();
    await expect(page.getByText('#qa').first()).toBeVisible();

    await quickInput.press('Enter');

    // Verify newly created task appears in the list with its parsed #qa tag and 25m duration
    await expect(page.getByText('Verify Playwright E2E flow').first()).toBeVisible();
    await expect(page.getByText('25m').first()).toBeVisible();

    // Verify Inline List & Tag Autocomplete while typing a task
    await quickInput.fill('Prepare architecture review Core');
    const autocompleteMenu = page.getByTestId('quick-add-autocomplete');
    await expect(autocompleteMenu).toBeVisible();
    const listOption = page.getByTestId('autocomplete-option-list-Q4 Core Launch');
    await expect(listOption).toBeVisible();
    await listOption.dispatchEvent('mousedown');
    await expect(page.getByTestId('quick-selected-list-chip')).toContainText('Q4 Core Launch');

    // Also type partial existing tag name ("supa") and select #supabase from autocomplete
    await quickInput.fill('Prepare architecture review supa');
    await expect(autocompleteMenu).toBeVisible();
    const tagOption = page.getByTestId('autocomplete-option-tag-supabase');
    await expect(tagOption).toBeVisible();
    await tagOption.dispatchEvent('mousedown');
    await expect(quickInput).toHaveValue('Prepare architecture review #supabase ');
    await quickInput.press('Enter');
    await expect(page.getByText('Prepare architecture review').first()).toBeVisible();

    // Switch to Kanban view
    await page.locator('button[title="Kanban View"]').click();
    await expect(page.getByText('To Do').first()).toBeVisible();
    await expect(page.getByText('In Progress').first()).toBeVisible();

    // Switch to Timeline (Gantt) view
    await page.locator('button[title="Timeline View"]').click();
    await expect(page.getByText('Timeline Duration View')).toBeVisible();

    // Return to List view
    await page.locator('button[title="List View"]').click();
  });

  test('Edit/Delete Lists, Folders & Tags, Resizable PC Inspector, Focus/Habit Log Filtering & Deletion, and Blank Reset', async ({
    page,
    isMobile,
  }) => {
    if (isMobile) return;

    await page.goto('/');

    // 1. Verify PC Right Inspector is initially closed, then opens on task click
    await expect(page.locator('aside[aria-label="Task Detail Inspector"]')).toHaveCount(0);
    const firstTask = page.locator('[data-testid="task-item"]').first();
    await firstTask.click();
    await expect(page.locator('[aria-label="Resize Right Inspector"]')).toBeVisible();

    // Verify Priority dropdown menu opens cleanly without clipping and can change priority
    const priorityButton = page.locator('button[aria-label="Task Priority"]');
    await expect(priorityButton).toBeVisible();
    await priorityButton.click();
    await expect(page.getByRole('button', { name: 'High Priority' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Medium' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Low Priority' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'No Priority' })).toBeVisible();
    // Select Low Priority and Save
    await page.getByRole('button', { name: 'Low Priority' }).click();
    await expect(page.getByRole('button', { name: 'High Priority' })).toHaveCount(0);
    await expect(priorityButton).toContainText('P1');
    await page.locator('button[aria-label="Save Task Changes"]').click();

    await page.getByRole('button', { name: 'Test Alert' }).first().click();
    await expect(page.locator('[role="alertdialog"]')).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
    await expect(page.locator('[role="alertdialog"]')).toHaveCount(0);

    // 2. Edit a Folder name & Delete a Tag via Three-Dots (...) Context Menu in Sidebar
    await page.locator('button[aria-label="Folder options Product & Engineering"]').click();
    await page.locator('button[aria-label="Rename folder Product & Engineering"]').click();
    const folderInput = page.locator('aside[aria-label="Lists, Tags, and Filters"] form input[type="text"]').first();
    await folderInput.fill('Core Engineering');
    await folderInput.press('Enter');
    await expect(page.getByText('Core Engineering').first()).toBeVisible();

    // Edit a List via Three-Dots (...) Menu -> 2-Column Edit List Modal with Live Preview
    await page.locator('button[aria-label="List options Q4 Core Launch"]').click();
    await page.locator('button[aria-label="Edit list Q4 Core Launch"]').click();
    await expect(page.getByText('Edit List')).toBeVisible();
    await expect(page.getByText('View Type')).toBeVisible();
    const listModalInput = page.locator('form input[placeholder="Name"]');
    await listModalInput.fill('Q4 Launch Renamed');
    await page.locator('form').getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Q4 Launch Renamed').first()).toBeVisible();

    // Delete a Tag via Three-Dots (...) Menu
    await page.locator('button[aria-label="Tag options finance"]').click();
    await page.locator('button[aria-label="Delete tag finance"]').click();

    // 3. Test Pomodoro / Stopwatch Focus Log Filters & Deletion
    const desktopRail = page.locator('aside[aria-label="Primary Module Navigation"]');
    await desktopRail.locator('button[aria-label="Pomodoro & Focus"]').click();
    await expect(page.getByText(/Focus Record Log/i)).toBeVisible();

    // Filter Focus Logs by Stopwatch / Pomo
    await page.getByRole('button', { name: 'Stopwatch', exact: true }).last().click();
    await page.getByRole('button', { name: 'All', exact: true }).last().click();

    // Delete a Focus Session Log
    const deleteFocusBtns = page.locator('button[title="Remove focus log"]');
    const beforeFocusCount = await deleteFocusBtns.count();
    expect(beforeFocusCount).toBeGreaterThan(0);
    await deleteFocusBtns.first().click();
    await expect(deleteFocusBtns).toHaveCount(beforeFocusCount - 1);

    // 4. Test Habit Tracker Log Filters, Deletion & Visual Goal Presets Modal
    await desktopRail.locator('button[aria-label="Habit Tracker"]').click();
    await expect(page.getByText(/Habit Journal & Mood Logs/i)).toBeVisible();

    const deleteHabitLogBtns = page.locator('button[aria-label^="Delete habit log"]');
    const beforeHabitLogCount = await deleteHabitLogBtns.count();
    expect(beforeHabitLogCount).toBeGreaterThan(0);
    await deleteHabitLogBtns.first().click();
    await expect(deleteHabitLogBtns).toHaveCount(beforeHabitLogCount - 1);

    // Test New Habit Modal with Visual Presets (Simple Check-in vs Count / Measure)
    await page.getByRole('button', { name: /New Habit/i }).click();
    await expect(page.getByText('How do you want to track it?')).toBeVisible();
    await page.getByRole('button', { name: /Count \/ Measure/i }).click();
    await page.getByRole('button', { name: 'Pages 20 pages/day' }).click();
    await expect(page.getByText(/Goal: 20 pages\/day/i)).toBeVisible();
    await page.getByPlaceholder('e.g. Practice Guitar 20m').fill('Read Technical Book');
    await page.getByRole('button', { name: 'Create Habit' }).click();
    await expect(page.getByText('Read Technical Book').last()).toBeVisible();

    // 5. Test Supabase Cloud Connection via Custom / Demo Project, Push & Pull
    await desktopRail.locator('button[aria-label="Supabase Backend Settings"]').click();
    await expect(page.getByText('Local-First Mode')).toBeVisible();
    await page.getByRole('button', { name: /Fill Demo Project/i }).click();
    await page.getByRole('button', { name: /Save & Connect Supabase/i }).click();
    await expect(page.getByText('Connected (Live Sync)')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Push to Supabase/i }).click();
    await expect(page.getByText(/(Pushed .* tasks|Pushed to Supabase|Connected to Supabase)/i).first()).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Pull from Supabase/i }).click();
    await expect(
      page.getByText(/(Pulled .* tasks|Connected to Supabase Cloud|workspace is up to date)/i).first()
    ).toBeVisible({ timeout: 15000 });
    await page.locator('button[title="Close Settings"]').click();

    // 6. Test Reset to Blank Workspace
    await desktopRail.locator('button[aria-label="Tasks"]').click();
    await page.getByRole('button', { name: /Reset to Blank Workspace/i }).click();
    await page.getByRole('button', { name: /Yes, Start Blank/i }).click();
    await expect(page.getByText('All clear')).toBeVisible();

    // Restore clean demo data for subsequent tests
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('All Modules Navigation (Calendar, Pomodoro, Habits, Matrix, Countdown, Statistics)', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');

    if (!isMobile) {
      const desktopRail = page.locator('aside[aria-label="Primary Module Navigation"]');
      await expect(desktopRail).toBeVisible();

      // 1. Calendar (5 Views)
      await desktopRail.locator('button[aria-label="Calendar (5 Views)"]').click();
      await expect(page.getByRole('button', { name: 'Month', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Agenda', exact: true }).click();
      await expect(page.getByText(/items/i).first()).toBeVisible();

      // 2. Pomodoro & Focus
      await desktopRail.locator('button[aria-label="Pomodoro & Focus"]').click();
      await expect(page.getByText('Focusing On Task')).toBeVisible();
      await expect(page.getByRole('button', { name: /Start Focus/i })).toBeVisible();

      // 3. Habit Tracker
      await desktopRail.locator('button[aria-label="Habit Tracker"]').click();
      await expect(page.getByText('Habit Tracker').first()).toBeVisible();

      // 4. Eisenhower Matrix + Floating Task Detail Popover on Click
      await desktopRail.locator('button[aria-label="Eisenhower Matrix"]').click();
      await expect(page.getByText('Urgent & Important').first()).toBeVisible();
      await expect(page.getByText('Not Urgent & Important').first()).toBeVisible();
      const q1Input = page.locator('input[placeholder*="Add to Urgent & Important"]');
      await q1Input.fill('Inspect Matrix Popover Task');
      await q1Input.press('Enter');
      await page.getByText('Inspect Matrix Popover Task').first().click();
      await expect(page.locator('[aria-label="Floating Task Inspector"]')).toBeVisible();
      await page.locator('button[aria-label="Close task popover"]').click();

      // 5. Countdown
      await desktopRail.locator('button[aria-label="Countdown"]').click();
      await expect(page.getByText('Countdown').first()).toBeVisible();

      // 6. Statistics & Score
      await desktopRail.locator('button[aria-label="Statistics & Score"]').click();
      await expect(page.getByText('Achievement Score').first()).toBeVisible();
    } else {
      const mobileNav = page.locator('nav[aria-label="Mobile Bottom Navigation"]');
      await expect(mobileNav).toBeVisible();

      // Verify initial mobile state: TaskDetailPane sheet is NOT blocking the viewport
      await expect(page.locator('h1', { hasText: 'Today' })).toBeVisible();
      await expect(page.locator('aside[aria-label="Task Detail Inspector"]')).toHaveCount(0);

      // Open off-canvas Slide-Over Drawer on mobile
      await page.locator('button[aria-label="Toggle Sidebar"]').click();
      const sidebar = page.locator('aside').filter({ hasText: 'Lists' }).first();
      await expect(sidebar).toBeVisible();

      // Select 'All Tasks' in mobile drawer and verify drawer auto-closes on mobile selection
      await sidebar.getByRole('button', { name: /All Tasks/i }).click();
      await expect(page.locator('h1', { hasText: 'All Tasks' })).toBeVisible();

      // Tap a task on mobile to slide up the Vaul-style TaskDetailPane bottom sheet
      await page.waitForTimeout(350);
      const firstTask = page.locator('[data-testid="task-item"]').first();
      await firstTask.click();
      const closeDetailBtn = page.locator('button[aria-label="Close Detail Pane"]');
      await expect(closeDetailBtn).toBeVisible();
      // Verify mobile Go Back (popstate) closes the TaskDetailPane bottom sheet without leaving the app
      await page.goBack();
      await expect(page.locator('aside[aria-label="Task Detail Inspector"]')).toHaveCount(0);

      // Verify mobile left-edge swipe handle opens the left navigation sidebar
      await page.getByTestId('mobile-left-edge-swipe-zone').click();
      await expect(sidebar).toBeVisible();
      await page.locator('button[aria-label="Close Sidebar"]').click();

      // Navigate via Mobile Bottom Bar: Calendar
      await mobileNav.locator('button[aria-label="Calendar (5 Views)"]').click();
      await expect(page.getByRole('button', { name: 'Month', exact: true })).toBeVisible();

      // Navigate via Mobile Bottom Bar: Pomodoro / Focus
      await mobileNav.locator('button[aria-label="Pomodoro & Focus"]').click();
      await expect(page.getByText('Focusing On Task')).toBeVisible();
      await expect(page.getByRole('button', { name: /Start Focus/i })).toBeVisible();

      // Navigate via Mobile Bottom Bar: Habit Tracker
      await mobileNav.locator('button[aria-label="Habit Tracker"]').click();
      await expect(page.getByText('Habit Tracker').first()).toBeVisible();
      await page.getByRole('button', { name: 'Weekly View' }).click();
      const leftCol = page.getByTestId('habit-weekly-left-column');
      const datesScroll = page.getByTestId('habit-weekly-dates-scroll');
      await expect(leftCol).toBeVisible();
      await expect(datesScroll).toBeVisible();
      await expect(page.getByTestId('habit-weekly-today-header')).toBeVisible();
      const leftBoxBefore = await leftCol.boundingBox();
      await datesScroll.evaluate((el) => {
        el.scrollLeft = 0;
      });
      const leftBoxAfter = await leftCol.boundingBox();
      expect(leftBoxAfter?.x).toBe(leftBoxBefore?.x);

      // Open Mobile "More" Vaul-Style Bottom Sheet and navigate to Eisenhower Matrix & Stats
      await mobileNav.locator('button[aria-label="More Modules and Settings"]').click();
      await expect(page.getByRole('button', { name: 'Matrix' })).toBeVisible();
      await page.getByRole('button', { name: 'Matrix' }).click();
      await expect(page.getByText('Urgent & Important').first()).toBeVisible();

      // Open Mobile "More" sheet again and open Statistics
      await mobileNav.locator('button[aria-label="More Modules and Settings"]').click();
      await page.getByRole('button', { name: 'Stats' }).click();
      await expect(page.getByText('Achievement Score').first()).toBeVisible();
    }
  });

  test('PWA Mobile Installation, Manifest & Standalone App Capabilities', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');

    // 1. Verify Manifest and PWA Meta tags in document head
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', './manifest.webmanifest');

    const appleMeta = page.locator('meta[name="apple-mobile-web-app-capable"]');
    await expect(appleMeta).toHaveAttribute('content', 'yes');

    // 2. Open Install App Modal
    if (!isMobile) {
      await page.locator('button[aria-label="Install App"]').click();
    } else {
      page.on('console', msg => console.log('PAGE LOG:', msg.text()));
      const mobileNav = page.locator('nav[aria-label="Mobile Bottom Navigation"]');
      await mobileNav.locator('button[aria-label="More Modules and Settings"]').click();
      await page.getByRole('button', { name: 'Install', exact: true }).click();
    }

    // 3. Verify Install App Modal Content
    await expect(page.getByRole('heading', { name: 'TickTick Pro', level: 3 })).toBeVisible();
    await expect(page.getByText(/Progressive Web App/i)).toBeVisible();

    // Close the modal
    await page.getByLabel('Close', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'TickTick Pro', level: 3 })).not.toBeVisible();
  });

  test('Filters and Tags Accordion Minimization and Horizontal/Vertical Tag Layouts', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');

    if (isMobile) {
      // Open mobile sidebar drawer
      await page.locator('button[aria-label="Toggle Sidebar"]').click();
    }

    // 1. Accordion Minimization for Filters
    const toggleFiltersBtn = page.locator('button[aria-label="Toggle Filters Section"]');
    await expect(toggleFiltersBtn).toBeVisible();
    await toggleFiltersBtn.click(); // collapse
    await expect(page.getByText('High Priority Deep Work')).not.toBeVisible();

    await toggleFiltersBtn.click(); // expand
    await expect(page.getByText('High Priority Deep Work')).toBeVisible();

    // 2. Accordion Minimization for Tags
    const toggleTagsBtn = page.locator('button[aria-label="Toggle Tags Section"]');
    await expect(toggleTagsBtn).toBeVisible();
    await toggleTagsBtn.click(); // collapse
    await expect(page.locator('button[aria-label="Horizontal Tag Layout"]')).toBeVisible();

    await toggleTagsBtn.click(); // expand

    // 3. Horizontal vs Vertical Tag Layout Switcher
    const horizLayoutBtn = page.locator('button[aria-label="Horizontal Tag Layout"]');
    const vertLayoutBtn = page.locator('button[aria-label="Vertical Tag Layout"]');

    // Switch to Horizontal Pills
    await horizLayoutBtn.click();
    await expect(page.getByText('#deep-work').first()).toBeVisible();

    // Switch to Vertical List
    await vertLayoutBtn.click();
    await expect(page.getByText('deep-work', { exact: true }).first()).toBeVisible();
  });

  test('Background Wall-Clock Persistence & Wakeup for Pomodoro Timer & Stopwatch', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');

    if (!isMobile) {
      await page
        .locator('aside[aria-label="Primary Module Navigation"] button[aria-label="Pomodoro & Focus"]')
        .click();
    } else {
      await page
        .locator('nav[aria-label="Mobile Bottom Navigation"] button[aria-label="Pomodoro & Focus"]')
        .click();
    }

    // Switch to Stopwatch mode & verify Stopwatch chronograph dial animation
    await page.getByRole('button', { name: 'Stopwatch' }).first().click();
    await expect(page.getByTestId('stopwatch-dial')).toBeVisible();
    await page.getByRole('button', { name: /Start Focus/i }).click();

    // Verify localStorage has the wall-clock base timestamp
    const baseTimestamp = await page.evaluate(() =>
      localStorage.getItem('ticktick_timer_stopwatch_base')
    );
    expect(baseTimestamp).not.toBeNull();

    // Simulate 20 seconds passing in background by shifting the base timestamp back
    await page.evaluate(() => {
      const current = Number(localStorage.getItem('ticktick_timer_stopwatch_base'));
      localStorage.setItem('ticktick_timer_stopwatch_base', String(current - 20000));
      // Dispatch visibilitychange to simulate returning to the app
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Verify stopwatch immediately displays at least 20 seconds without pausing
    await expect(page.locator('.surface-card').getByText(/00:2/)).toBeVisible();

    // Click Pomodoro tab while Stopwatch is running — verify Stopwatch does NOT stop!
    await page.getByRole('button', { name: 'Pomodoro', exact: true }).first().click();
    await expect(page.getByTestId('pomo-timer-dial')).toBeVisible();
    await expect(page.getByTestId('stopwatch-running-indicator')).toBeVisible();

    // Switch back to Stopwatch and verify it is still running at >= 20 seconds
    await page.getByRole('button', { name: 'Stopwatch', exact: true }).first().click();
    await expect(page.getByTestId('stopwatch-dial')).toBeVisible();
    await expect(page.locator('.surface-card').getByText(/00:2/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Pause/i })).toBeVisible();

    // Reset stopwatch
    await page.locator('button[title="Reset Timer"]').click();
    await expect(page.locator('text=00:00').first()).toBeVisible();
  });

  test('Focus Mode Selection (Pomodoro vs Stopwatch) on Specific Task & Default 0 Est Pomos', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');

    if (!isMobile) {
      // 1. Create a brand new task
      const quickInput = page.locator('input[placeholder*="Try NLP"]');
      await quickInput.fill('Task Without Pomo Estimate');
      await quickInput.press('Enter');

      // 2. Click the task to open Detail Pane
      await page.getByText('Task Without Pomo Estimate').first().click();

      // Verify button says "Start Focus" (NOT "Focus (0/1 Pomo)")
      const focusBtn = page.getByRole('button', { name: 'Start Focus' });
      await expect(focusBtn).toBeVisible();

      // 3. Click Focus button to open mode chooser
      await focusBtn.click();
      await expect(page.getByText('Choose Focus Mode')).toBeVisible();
      await expect(page.getByText('Pomodoro Timer')).toBeVisible();
      await expect(page.getByText('Stopwatch')).toBeVisible();

      // 4. Select Stopwatch mode
      await page.locator('button').filter({ hasText: 'Stopwatch' }).last().click();

      // 5. Verify it navigated to Pomodoro module in Stopwatch mode focusing on this task
      await expect(page.getByText('Focusing On Task')).toBeVisible();
      await expect(page.locator('select').filter({ hasText: 'Task Without Pomo Estimate' })).toBeVisible();

      // 6. Verify starting the Stopwatch recorded an activity in the task's Activity Log
      await page
        .locator('aside[aria-label="Primary Module Navigation"] button[aria-label="Tasks"]')
        .click();
      await page.getByText('Task Without Pomo Estimate').first().click();
      await page.getByRole('button', { name: /Activity Log/i }).click();
      await expect(page.getByText('Started Stopwatch focus session')).toBeVisible();
    }
  });

  test('First-Time User Database Prompt, Custom Credentials Storage & Same Browser Persistence', async ({
    page,
    isMobile,
  }) => {
    // 1. Simulate new user arriving: clear all storage and set flag to enable setup prompt modal
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('ticktick_e2e_show_db_modal', 'true');
    });
    await page.reload();

    // 2. Verify Database Setup Prompt modal is displayed with clear private workspace messaging
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Connect Your Database')).toBeVisible();
    await expect(page.getByText('Private by default')).toBeVisible();

    // Verify inputs for custom Supabase URL and Anon Key are present
    const urlInput = page.locator('input[placeholder*="your-project.supabase.co"]');
    const keyInput = page.locator('input[placeholder*="eyJhbGciOi"]');
    await expect(urlInput).toBeVisible();
    await expect(keyInput).toBeVisible();

    // 3. Test instructions toggle
    await page.getByText(/How to get free Supabase keys/i).click();
    await expect(page.getByText(/How to create your free Supabase database/i)).toBeVisible();

    // 4. Test "Try Demo DB" fills valid demo credentials
    await page.getByRole('button', { name: /Try Demo DB/i }).click();
    const filledUrl = await urlInput.inputValue();
    expect(filledUrl).toContain('supabase.co');

    // Mock remote Supabase REST response to verify new-device connection pulls personal data instead of keeping mock data
    const todayIso = new Date().toLocaleDateString('en-CA');
    await page.route('**/rest/v1/ticktick_workspace*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'default',
            name: 'Vijay Personal',
            payload: {
              deviceId: 'cloud-dev-1',
              updatedAt: Date.now(),
              userName: 'Vijay Personal',
              tasks: [
                {
                  id: 'personal-task-999',
                  title: 'My Personal Cloud Task From DB',
                  content: 'Synced from personal database',
                  isNote: false,
                  listId: 'inbox',
                  status: 'todo',
                  priority: 5,
                  tags: [],
                  dueDate: todayIso,
                  startDate: todayIso,
                  isAllDay: true,
                  reminders: [],
                  constantReminder: false,
                  emailReminder: false,
                  estimatedPomos: 1,
                  completedPomos: 0,
                  focusSeconds: 0,
                  subtasks: [],
                  attachments: [],
                  comments: [],
                  activities: [],
                  isPinned: true,
                  sortOrder: 0,
                  createdAt: todayIso,
                  updatedAt: todayIso,
                },
              ],
              lists: [],
              folders: [],
              sections: [],
              tags: [],
              habits: [],
              pomodoroSessions: [],
              countdowns: [],
            },
          }),
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
    });

    // 5. Connect to database
    await page.getByRole('button', { name: /Connect & Sync Database/i }).click();

    // Verify modal is dismissed and personal task from DB replaces mock seed data
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByText('My Personal Cloud Task From DB').first()).toBeVisible();
    await expect(
      page.getByText('Finalize Supabase RLS Policies & Realtime Sync Architecture')
    ).toHaveCount(0);

    // 6. Test Same Browser Persistence:
    // Reload the page without clearing storage to simulate the same user revisiting the browser
    await page.reload();

    // Prompt must NOT be shown again
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Verify credentials are preserved in localStorage
    const savedUrl = await page.evaluate(() => localStorage.getItem('ticktick_supabase_url'));
    expect(savedUrl).toContain('supabase.co');

    // Verify in Settings that the database credentials remain present
    if (!isMobile) {
      const desktopRail = page.locator('aside[aria-label="Primary Module Navigation"]');
      await desktopRail.locator('button[aria-label="Supabase Backend Settings"]').click();
      await expect(page.getByText('Connected (Live Sync)')).toBeVisible({ timeout: 10000 });
      const settingsUrlInput = page.locator('form input[type="url"]');
      await expect(settingsUrlInput).toHaveValue(savedUrl || '');
    }
  });

  test('Eisenhower Matrix: In-Quadrant Quick-Add Card, Group by/Sort/Order, Manage View & User Guide', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');

    if (!isMobile) {
      const desktopRail = page.locator('aside[aria-label="Primary Module Navigation"]');
      await desktopRail.locator('button[aria-label="Eisenhower Matrix"]').click();
    } else {
      const mobileNav = page.locator('nav[aria-label="Mobile Bottom Navigation"]');
      await mobileNav.locator('button[aria-label="More Modules and Settings"]').click();
      await page.getByRole('button', { name: 'Matrix' }).click();
    }

    // 1. Verify Header and Top More Menu (...)
    await expect(page.getByRole('heading', { name: 'Eisenhower Matrix' })).toBeVisible();
    await page.locator('button[aria-label="Eisenhower Matrix options"]').click();
    await expect(page.getByText('Manage View').first()).toBeVisible();
    await expect(page.getByText('Hide Completed').first()).toBeVisible();
    await expect(page.getByText('User Guide').first()).toBeVisible();

    // 2. Open User Guide Modal
    await page.getByText('User Guide').first().click();
    await expect(page.getByText('Eisenhower Matrix User Guide')).toBeVisible();
    await expect(page.getByText(/What is important is seldom urgent/i)).toBeVisible();
    await page.getByRole('button', { name: 'Got It' }).click();
    await expect(page.getByText('Eisenhower Matrix User Guide')).toHaveCount(0);

    // 3. Test In-Quadrant Floating Quick-Add Card in Quadrant II (Not Urgent & Important)
    await page.locator('button[aria-label="Add task to Not Urgent & Important"]').click();
    const taskInput = page.locator('input[placeholder="What would you like to do?"]');
    await expect(taskInput).toBeVisible();
    await expect(page.locator('textarea[placeholder*="Write something or type / for commands"]')).toBeVisible();

    // Fill task title and submit
    await taskInput.fill('Deep Work Strategic Roadmap');
    await page.getByRole('button', { name: 'Add Task', exact: true }).click();
    await expect(page.getByText('Deep Work Strategic Roadmap').first()).toBeVisible();

    // 4. Test Quadrant Header (...) Menu (Edit, Group by, Sort by, Order)
    await page.locator('button[aria-label="Options for Urgent & Unimportant"]').click();
    await expect(page.getByText('Edit').first()).toBeVisible();
    await expect(page.getByText('Oldest First').first()).toBeVisible();
    await expect(page.getByText('Newest First').first()).toBeVisible();

    // Dismiss menu by clicking Done on mobile or clicking outside on desktop
    const doneBtn = page.getByRole('button', { name: 'Done', exact: true });
    if (await doneBtn.isVisible()) {
      await doneBtn.click();
    } else {
      await page.locator('h1', { hasText: 'Eisenhower Matrix' }).click();
    }
  });

  test('Bug 1 Verification: Task Detail Sidebar Opens on Click, Explicit Save Required, Closes on Background Click or Trash', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');

    // Initially inspector is closed
    await expect(page.locator('aside[aria-label="Task Detail Inspector"]')).toHaveCount(0);

    // 1. Click task to open
    const firstTask = page.locator('[data-testid="task-item"]').first();
    await firstTask.click();
    const inspector = page.locator('aside[aria-label="Task Detail Inspector"]');
    await expect(inspector).toBeVisible();

    // 2. Edit title inside inspector
    const titleInput = inspector.locator('input[type="text"]').first();
    await titleInput.fill('Task Title Edited Unsaved');

    // Verify Save button is active and Unsaved changes banner appears
    const saveBtn = page.locator('button[aria-label="Save Task Changes"]');
    await expect(saveBtn).toBeVisible();
    await expect(page.getByText('Unsaved changes').first()).toBeVisible();

    // 3. Click Save button
    await saveBtn.click();
    await expect(page.getByText('Saved').first()).toBeVisible();

    // Task list shows the saved title
    await expect(page.getByText('Task Title Edited Unsaved').first()).toBeVisible();

    if (!isMobile) {
      // 4. Click whitespace in TaskWorkspace to dismiss sidebar
      await page.locator('[data-testid="workspace-blank-space"]').click();
      await expect(page.locator('aside[aria-label="Task Detail Inspector"]')).toHaveCount(0);

      // 5. Open again and delete task -> inspector immediately closes
      await page.getByText('Task Title Edited Unsaved').first().click();
      await expect(inspector).toBeVisible();
      await page.locator('button[title="Move to Trash"]').click();
      await expect(page.locator('aside[aria-label="Task Detail Inspector"]')).toHaveCount(0);
    } else {
      // Mobile: Click Close button
      await page.locator('button[aria-label="Close Detail Pane"]').click();
      await expect(page.locator('aside[aria-label="Task Detail Inspector"]')).toHaveCount(0);
    }
  });

  test('Bug 2 Verification: Calendar Date Range Header Label, Today Button Removed & High-Density Day Overview Popover', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');

    if (isMobile) {
      await page.locator('nav[aria-label="Mobile Bottom Navigation"] button[aria-label="Calendar (5 Views)"]').click();
    } else {
      await page.locator('aside[aria-label="Primary Module Navigation"] button[aria-label="Calendar (5 Views)"]').click();
    }

    // Verify Calendar is rendered
    await expect(page.getByRole('button', { name: 'Month', exact: true })).toBeVisible();

    // Verify Today button is completely removed from Calendar header
    await expect(page.locator('header button', { hasText: 'Today' })).toHaveCount(0);

    // Verify navigation chevrons exist
    await expect(page.locator('button[aria-label="Previous period"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Next period"]')).toBeVisible();

    // On desktop Month view, verify busy day shows "+N more" pill and opens Day Schedule Overview;
    // On mobile Month view, verify tapping any day cell opens Day Schedule Overview popup
    if (!isMobile) {
      const moreBtn = page.locator('button[data-testid^="calendar-more-"]').first();
      await expect(moreBtn).toBeVisible();
      await moreBtn.click();
      const dayDialog = page.locator('[role="dialog"][aria-label="Day Schedule Overview"]');
      await expect(dayDialog).toBeVisible();
      await page.locator('button[aria-label="Close day overview"]').click();
      await expect(dayDialog).toHaveCount(0);
    } else {
      const mobileDayCell = page.locator('[data-testid^="calendar-day-"]').nth(15);
      await mobileDayCell.click();
      const dayDialog = page.locator('[role="dialog"][aria-label="Day Schedule Overview"]');
      await expect(dayDialog).toBeVisible();
      await page.locator('button[aria-label="Close day overview"]').click();
      await expect(dayDialog).toHaveCount(0);
    }

    // Verify Month view header title
    const headerTitle = page.locator('header h1');
    await expect(headerTitle).toBeVisible();
    const monthText = await headerTitle.textContent();
    expect(monthText).toContain('2026');

    // Switch to Week view and verify header changes to range + 24-hour slots (00:00 to 23:00)
    await page.getByRole('button', { name: 'Week', exact: true }).click();
    const weekText = await headerTitle.textContent();
    expect(weekText).toBeDefined();
    await expect(page.getByText('00:00').first()).toBeVisible();
    await expect(page.getByText('23:00').first()).toBeVisible();

    // Switch to Day view and verify header contains day format
    await page.getByRole('button', { name: 'Day', exact: true }).click();
    const dayText = await headerTitle.textContent();
    expect(dayText).toBeDefined();

    // Switch to Agenda view and verify header
    await page.getByRole('button', { name: 'Agenda', exact: true }).click();
    const agendaText = await headerTitle.textContent();
    expect(agendaText).toBeDefined();
  });
});
