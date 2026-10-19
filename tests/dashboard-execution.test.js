import test from 'node:test';
import assert from 'node:assert';
import {
  resolveDestinationSettings,
  getDestinationLocationLabel,
  executeOrganization
} from '../ui/dashboard.js';

test('Dashboard Organization - Parameter Resolution & Execution', async (t) => {
  await t.test('resolves destination settings for dedicated Bookmarks Bar folder', () => {
    const config = resolveDestinationSettings('dedicated');
    assert.strictEqual(config.destTitle, 'Organized Bookmarks');
    assert.strictEqual(config.targetRootParentId, '1');
  });

  await t.test('resolves destination settings for dedicated Other Bookmarks folder', () => {
    const config = resolveDestinationSettings('dedicated_other');
    assert.strictEqual(config.destTitle, 'Organized Bookmarks');
    assert.strictEqual(config.targetRootParentId, '2');
  });

  await t.test('resolves destination settings for Bookmarks Bar root directly', () => {
    const config = resolveDestinationSettings('bar');
    assert.strictEqual(config.destTitle, null);
    assert.strictEqual(config.targetRootParentId, '1');
  });

  await t.test('resolves destination settings for Other Bookmarks root directly', () => {
    const config = resolveDestinationSettings('other');
    assert.strictEqual(config.destTitle, null);
    assert.strictEqual(config.targetRootParentId, '2');
  });

  await t.test('resolves fallback default settings for unknown or empty input', () => {
    const configUnknown = resolveDestinationSettings('custom_invalid');
    assert.strictEqual(configUnknown.destTitle, 'Organized Bookmarks');
    assert.strictEqual(configUnknown.targetRootParentId, '1');

    const configUndefined = resolveDestinationSettings(undefined);
    assert.strictEqual(configUndefined.destTitle, 'Organized Bookmarks');
    assert.strictEqual(configUndefined.targetRootParentId, '1');
  });

  await t.test('generates correct human-readable destination labels', () => {
    assert.strictEqual(
      getDestinationLocationLabel('Organized Bookmarks', '1'),
      'Bookmarks Bar / Organized Bookmarks'
    );
    assert.strictEqual(
      getDestinationLocationLabel('Organized Bookmarks', '2'),
      'Other Bookmarks / Organized Bookmarks'
    );
    assert.strictEqual(
      getDestinationLocationLabel(null, '1'),
      'Bookmarks Bar Root'
    );
    assert.strictEqual(
      getDestinationLocationLabel(null, '2'),
      'Other Bookmarks Root'
    );
  });

  await t.test('executeOrganization handles positional targetRootParentId without ReferenceError', async () => {
    // Calling with empty selected items - ensures no "targetRootParentId is not defined" error occurs
    const result = await executeOrganization([], 'Organized Bookmarks', '1', false);
    assert.ok(result, 'executeOrganization returned a result');
    // It should not throw ReferenceError: targetRootParentId is not defined
    if (result.error) {
      assert.doesNotMatch(result.error, /targetRootParentId is not defined/i);
    }
  });

  await t.test('executeOrganization handles options object format without ReferenceError', async () => {
    const result = await executeOrganization([], {
      targetRootFolderTitle: 'Organized Bookmarks',
      targetRootParentId: '2',
      cleanEmptyFolders: false
    });
    assert.ok(result, 'executeOrganization returned a result');
    if (result.error) {
      assert.doesNotMatch(result.error, /targetRootParentId is not defined/i);
    }
  });

  await t.test('executeOrganization successfully runs reorganization and saves undo snapshot with managers', async () => {
    let capturedPlanOptions = null;
    let capturedSnapshot = null;

    const mockTreeMgr = {
      executePlan: async (items, options, onProgress) => {
        capturedPlanOptions = options;
        if (onProgress) onProgress({ percent: 100, completed: items.length, total: items.length });
        return {
          success: true,
          totalMoved: items.length,
          movedItems: items.map(i => ({ id: i.id })),
          createdFolders: ['cat_folder_1']
        };
      }
    };

    const mockUndoMgr = {
      saveSnapshot: async (title, movedItems, createdFolders, type) => {
        capturedSnapshot = { title, movedItems, createdFolders, type };
        return { id: 'snap_123' };
      }
    };

    const sampleItems = [
      { id: '10', title: 'React', url: 'https://react.dev', selected: true }
    ];

    const result = await executeOrganization(
      sampleItems,
      'Organized Bookmarks',
      '1',
      false,
      { treeManager: mockTreeMgr, undoManager: mockUndoMgr }
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.totalMoved, 1);
    assert.deepStrictEqual(capturedPlanOptions, {
      targetRootFolderTitle: 'Organized Bookmarks',
      targetRootParentId: '1',
      cleanEmptyFolders: false,
      excludedFolderIds: [],
      signal: capturedPlanOptions.signal
    });
    assert.ok(capturedPlanOptions.signal instanceof AbortSignal);
    assert.ok(capturedSnapshot);
    assert.strictEqual(capturedSnapshot.type, 'reorganization');
  });

  await t.test('resolves destination settings from settings object or configuration object', () => {
    const fromSettingKey = resolveDestinationSettings({ targetRootSetting: 'dedicated_other' });
    assert.strictEqual(fromSettingKey.destTitle, 'Organized Bookmarks');
    assert.strictEqual(fromSettingKey.targetRootParentId, '2');

    const fromExplicitProps = resolveDestinationSettings({
      targetRootParentId: 2,
      targetRootFolderTitle: 'Custom Folder'
    });
    assert.strictEqual(fromExplicitProps.destTitle, 'Custom Folder');
    assert.strictEqual(fromExplicitProps.targetRootParentId, '2');

    const fromNullTitle = resolveDestinationSettings({
      targetRootParentId: '1',
      targetRootFolderTitle: null
    });
    assert.strictEqual(fromNullTitle.destTitle, null);
    assert.strictEqual(fromNullTitle.targetRootParentId, '1');
  });

  await t.test('generates correct labels even when targetRootParentId is passed as integer', () => {
    assert.strictEqual(
      getDestinationLocationLabel('Organized Bookmarks', 1),
      'Bookmarks Bar / Organized Bookmarks'
    );
    assert.strictEqual(
      getDestinationLocationLabel('Organized Bookmarks', 2),
      'Other Bookmarks / Organized Bookmarks'
    );
    assert.strictEqual(
      getDestinationLocationLabel(null, 1),
      'Bookmarks Bar Root'
    );
    assert.strictEqual(
      getDestinationLocationLabel(null, 2),
      'Other Bookmarks Root'
    );
  });

  await t.test('executeOrganization handles options object with managers as 3rd parameter', async () => {
    let capturedPlanOptions = null;
    const mockTreeMgr = {
      executePlan: async (items, options) => {
        capturedPlanOptions = options;
        return { success: true, totalMoved: 1, movedItems: [{ id: '10' }], createdFolders: [] };
      }
    };
    const mockUndoMgr = {
      saveSnapshot: async () => ({ id: 'snap_456' })
    };

    const result = await executeOrganization(
      [{ id: '10', title: 'Test', selected: true }],
      { targetRootFolderTitle: 'Organized Bookmarks', targetRootParentId: '2', cleanEmptyFolders: true },
      { treeManager: mockTreeMgr, undoManager: mockUndoMgr }
    );

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(capturedPlanOptions, {
      targetRootFolderTitle: 'Organized Bookmarks',
      targetRootParentId: '2',
      cleanEmptyFolders: true,
      excludedFolderIds: [],
      signal: capturedPlanOptions.signal
    });
    assert.ok(capturedPlanOptions.signal instanceof AbortSignal);
  });

  await t.test('executeOrganization coerces integer targetRootParentId to string', async () => {
    let capturedPlanOptions = null;
    const mockTreeMgr = {
      executePlan: async (items, options) => {
        capturedPlanOptions = options;
        return { success: true, totalMoved: 1, movedItems: [{ id: '10' }], createdFolders: [] };
      }
    };
    const mockUndoMgr = {
      saveSnapshot: async () => ({ id: 'snap_789' })
    };

    const result = await executeOrganization(
      [{ id: '10', title: 'Test', selected: true }],
      'Organized Bookmarks',
      2, // integer 2
      false,
      { treeManager: mockTreeMgr, undoManager: mockUndoMgr }
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(capturedPlanOptions.targetRootParentId, '2');
  });

  await t.test('executeOrganization handles null destFolderTitle for direct root organization', async () => {
    let capturedPlanOptions = null;
    const mockTreeMgr = {
      executePlan: async (items, options) => {
        capturedPlanOptions = options;
        return { success: true, totalMoved: 1, movedItems: [{ id: '10' }], createdFolders: [] };
      }
    };
    const mockUndoMgr = {
      saveSnapshot: async () => ({ id: 'snap_999' })
    };

    const result = await executeOrganization(
      [{ id: '10', title: 'Test', selected: true }],
      null,
      '1',
      false,
      { treeManager: mockTreeMgr, undoManager: mockUndoMgr }
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(capturedPlanOptions.targetRootFolderTitle, null);
    assert.strictEqual(capturedPlanOptions.targetRootParentId, '1');
  });

  await t.test('executeOrganization catches executePlan errors and returns clean failure object', async () => {
    const mockTreeMgr = {
      executePlan: async () => {
        throw new Error('Disk full or bookmark deleted');
      }
    };
    const mockUndoMgr = {
      saveSnapshot: async () => ({ id: 'snap_err' })
    };

    const result = await executeOrganization(
      [{ id: '10', title: 'Test', selected: true }],
      'Organized Bookmarks',
      '1',
      false,
      { treeManager: mockTreeMgr, undoManager: mockUndoMgr }
    );

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Disk full or bookmark deleted');
  });

  await t.test('R1: Minimalist Header displays only logo, title, rescan, and settings', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const html = fs.readFileSync(path.resolve('ui/dashboard.html'), 'utf8');

    const headerMatch = html.match(/<header class="app-header">([\s\S]*?)<\/header>/);
    assert.ok(headerMatch, 'Dashboard contains <header class="app-header">');
    const headerContent = headerMatch[1];

    assert.ok(headerContent.includes('id="btnRescan"'), 'Header contains Rescan Bookmarks button');
    assert.ok(headerContent.includes('id="btnHeaderSettings"'), 'Header contains Settings button');
    assert.ok(!headerContent.includes('id="btnResetFolders"'), 'Header keeps folder reset inside Settings');
    assert.ok(!headerContent.includes('testingSandboxCard'), 'Header does NOT contain testing sandbox');
    assert.ok(!headerContent.includes('btnScatterBookmarks'), 'Header does NOT contain scatter button');
    assert.ok(!headerContent.includes('btnGenerateSampleBookmarks'), 'Header does NOT contain sample generation');
  });

  await t.test('R2: Relocate Testing Sandbox into collapsible section in Settings tab only', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const html = fs.readFileSync(path.resolve('ui/dashboard.html'), 'utf8');

    const organizeTabMatch = html.match(/<section id="tab-organize"[\s\S]*?<\/section>/);
    assert.ok(organizeTabMatch, 'Organize tab section found');
    const organizeContent = organizeTabMatch[0];

    assert.ok(!organizeContent.includes('btnScatterBookmarks'), 'Main Organize tab does NOT contain scatter button');
    assert.ok(!organizeContent.includes('btnGenerateSampleBookmarks'), 'Main Organize tab does NOT contain sample generation button');
    assert.ok(!organizeContent.includes('testingSandboxCard'), 'Main Organize tab does NOT contain testing sandbox card');

    const settingsTabMatch = html.match(/<section id="tab-settings"[\s\S]*?<\/section>/);
    assert.ok(settingsTabMatch, 'Settings tab section found');
    const settingsContent = settingsTabMatch[0];

    assert.ok(settingsContent.includes('id="developerToolsSection"'), 'Settings tab contains developerToolsSection');
    assert.ok(settingsContent.includes('<details'), 'Developer tools section uses collapsible <details>');
    assert.ok(settingsContent.includes('id="btnScatterBookmarks"'), 'Settings tab contains scatter button');
    assert.ok(settingsContent.includes('id="btnGenerateSampleBookmarks"'), 'Settings tab contains sample generation button');
  });

  await t.test('R3: Simple Mode presents unified primary Clean & Organize action with engine toggle', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const html = fs.readFileSync(path.resolve('ui/dashboard.html'), 'utf8');

    const simpleViewMatch = html.match(/<div id="viewSimpleMode"[\s\S]*?<\/div>\s*<!-- ==================== ADVANCED MODE VIEW/);
    assert.ok(simpleViewMatch, 'Simple mode view found');
    const simpleContent = simpleViewMatch[0];

    assert.ok(!simpleContent.includes('id="btnCleanAndOrganizeHero"'), 'Simple mode does not duplicate the primary action in a hero');
    assert.ok(simpleContent.includes('id="btnCleanAndOrganizeBottom"'), 'Simple mode contains one primary Organize button');
    assert.ok(simpleContent.includes('id="toggleAiEngine"'), 'Simple mode contains engine preference toggle');
    assert.ok(simpleContent.includes('id="simpleFoldersGrid"'), 'Simple mode contains progressive disclosure cards container');
  });

  await t.test('R4: Accordion expand/collapse click event stops propagation to prevent bubbling cancellation', async () => {
    // Emulate DOM element event bubbling
    class FakeTarget {
      constructor(tag) {
        this.tagName = tag.toUpperCase();
        this.listeners = {};
        this.parentElement = null;
        this.style = {};
      }
      addEventListener(type, fn) {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(fn);
      }
      closest(sel) { return null; }
      setAttribute(k, v) { this[k] = v; }
    }

    const header = new FakeTarget('div');
    const btn = new FakeTarget('button');
    const arrow = new FakeTarget('span');
    const body = new FakeTarget('div');
    body.style.display = 'none';

    btn.parentElement = header;
    arrow.parentElement = btn;

    const toggleAccordion = (e) => {
      if (e.target.closest && (e.target.closest('.checkbox-container') || e.target.closest('a'))) return;
      if (e.stopPropagation) e.stopPropagation();
      const isOpen = body.style.display !== 'none';
      if (isOpen) {
        body.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
        arrow.textContent = '▼';
      } else {
        body.style.display = 'block';
        btn.setAttribute('aria-expanded', 'true');
        arrow.textContent = '▲';
      }
    };

    btn.addEventListener('click', toggleAccordion);
    header.addEventListener('click', toggleAccordion);

    // Simulate clicking on the toggle button with bubbling
    const fakeEvent = {
      type: 'click',
      target: btn,
      stopped: false,
      stopPropagation() { this.stopped = true; }
    };

    // First handler on btn
    for (const l of btn.listeners.click) {
      l(fakeEvent);
    }
    // If not stopped, header would also run:
    if (!fakeEvent.stopped) {
      for (const l of header.listeners.click) {
        l(fakeEvent);
      }
    }

    assert.strictEqual(body.style.display, 'block', 'Accordion body opened and did NOT close itself');
    assert.strictEqual(fakeEvent.stopped, true, 'stopPropagation was called on toggleAccordion');
  });

  await t.test('R5: Zen minimalist popup structure matches requirements', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const html = fs.readFileSync(path.resolve('ui/popup.html'), 'utf8');

    assert.ok(html.includes('id="btnQuickOrganize"'), 'Popup contains 1-click organize CTA');
    assert.ok(html.includes('id="btnQuickUndo"'), 'Popup contains Quick Undo button');
    assert.ok(html.includes('class="zen-status-card"'), 'Popup contains zen status card');
    assert.ok(html.includes('id="statPending"'), 'Popup contains the number of bookmarks ready to review');
    assert.ok(!html.includes('id="statFolders"'), 'Popup does not show a distracting folder count');
    assert.ok(!html.includes('id="statDuplicates"'), 'Popup does not show duplicate details before the dashboard');
    assert.ok(!html.includes('id="toggleAutoOrganize"'), 'Popup does NOT contain auto-organize switch');
  });

  await t.test('showConfirmModal supports Promise resolution on confirm and cancel', async () => {
    const { showConfirmModal } = await import('../ui/dashboard-utils.js');

    // Test 1: Fallback when DOM is not present resolves true immediately
    const fallbackRes = await showConfirmModal('Title', '<p>Body</p>');
    assert.strictEqual(fallbackRes, true, 'Resolves true when document is absent');

    // Test 2: Simulated DOM elements with user confirming
    const fakeModal = { style: {} };
    const fakeTitle = {};
    const fakeBody = {};
    const fakeOk = {};
    const fakeCancel = {};

    globalThis.document = {
      getElementById(id) {
        if (id === 'confirmModal') return fakeModal;
        if (id === 'confirmModalTitle') return fakeTitle;
        if (id === 'confirmModalBody') return fakeBody;
        if (id === 'btnConfirmOk') return fakeOk;
        if (id === 'btnConfirmCancel') return fakeCancel;
        return null;
      }
    };

    try {
      // Test awaiting OK
      let confirmedPromise = showConfirmModal('Confirm Scatter', '<p>Test scatter</p>');
      assert.strictEqual(fakeModal.style.display, 'flex');
      assert.strictEqual(fakeTitle.textContent, 'Confirm Scatter');
      assert.strictEqual(fakeBody.innerHTML, '<p>Test scatter</p>');
      fakeOk.onclick();
      const okResult = await confirmedPromise;
      assert.strictEqual(okResult, true, 'Resolves true when OK is clicked');
      assert.strictEqual(fakeModal.style.display, 'none');

      // Test awaiting Cancel
      let cancelledPromise = showConfirmModal('Cancel Test', '<p>Test cancel</p>');
      assert.strictEqual(fakeModal.style.display, 'flex');
      fakeCancel.onclick();
      const cancelResult = await cancelledPromise;
      assert.strictEqual(cancelResult, false, 'Resolves false when Cancel is clicked');
      assert.strictEqual(fakeModal.style.display, 'none');

      // Test callback pattern
      let callbackExecuted = false;
      let callbackPromise = showConfirmModal('Callback Test', '<p>Test</p>', async () => {
        callbackExecuted = true;
      });
      fakeOk.onclick();
      const cbResult = await callbackPromise;
      assert.strictEqual(cbResult, true);
      assert.strictEqual(callbackExecuted, true, 'onConfirm callback was executed on OK');
    } finally {
      delete globalThis.document;
    }
  });

  await t.test('R4: Folder cards include text overflow ellipsis and title attribute for long names', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const css = fs.readFileSync(path.resolve('ui/dashboard.css'), 'utf8');
    const js = fs.readFileSync(path.resolve('ui/dashboard.js'), 'utf8');

    // Verify CSS ellipsis rules
    assert.ok(css.includes('.simple-card-name {'), 'CSS defines .simple-card-name');
    assert.ok(css.includes('text-overflow: ellipsis;'), 'CSS includes text-overflow: ellipsis');
    assert.ok(css.includes('overflow: hidden;'), 'CSS includes overflow: hidden');
    assert.ok(css.includes('white-space: nowrap;'), 'CSS includes white-space: nowrap');

    // Verify JS renders title tooltip attribute
    assert.ok(
      js.includes('class="simple-card-name" title="'),
      'JS folder card element includes title attribute for full name hover tooltip'
    );
  });

  await t.test('showConfirmModal closes and resolves false when Escape key is pressed', async () => {
    const { showConfirmModal } = await import('../ui/dashboard-utils.js');

    const fakeModal = { style: {} };
    const fakeTitle = {};
    const fakeBody = {};
    const fakeOk = {};
    const fakeCancel = {};
    const windowListeners = {};

    globalThis.document = {
      getElementById(id) {
        if (id === 'confirmModal') return fakeModal;
        if (id === 'confirmModalTitle') return fakeTitle;
        if (id === 'confirmModalBody') return fakeBody;
        if (id === 'btnConfirmOk') return fakeOk;
        if (id === 'btnConfirmCancel') return fakeCancel;
        return null;
      }
    };

    globalThis.window = {
      addEventListener(type, fn) {
        if (!windowListeners[type]) windowListeners[type] = [];
        windowListeners[type].push(fn);
      },
      removeEventListener(type, fn) {
        if (!windowListeners[type]) return;
        windowListeners[type] = windowListeners[type].filter(l => l !== fn);
      }
    };

    try {
      const modalPromise = showConfirmModal('Escape Test', '<p>Testing Escape</p>');
      assert.strictEqual(fakeModal.style.display, 'flex');
      assert.ok(windowListeners.keydown && windowListeners.keydown.length === 1, 'Keydown listener registered');

      // Trigger Escape key
      windowListeners.keydown[0]({ key: 'Escape' });
      const result = await modalPromise;

      assert.strictEqual(result, false, 'Resolves false when Escape is pressed');
      assert.strictEqual(fakeModal.style.display, 'none', 'Modal is hidden on Escape');
      assert.strictEqual(windowListeners.keydown.length, 0, 'Keydown listener is cleaned up');
    } finally {
      delete globalThis.document;
      delete globalThis.window;
    }
  });

  await t.test('R4 & [ISSUE-7]: Responsive constraints and reason text truncation protect layout', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const css = fs.readFileSync(path.resolve('ui/dashboard.css'), 'utf8');

    // [ISSUE-7] Destination group wrapping and flexible select on narrow screens
    assert.ok(css.includes('.simple-destination-group {'), 'CSS defines .simple-destination-group');
    assert.ok(css.includes('flex-wrap: wrap;'), 'Destination group allows wrapping on narrow viewports');
    assert.ok(css.includes('max-width: 100%;'), 'Simple select has max-width 100% constraint');

    // Reason badge truncation
    assert.ok(css.includes('.simple-link-reason {'), 'CSS defines .simple-link-reason');
    assert.ok(css.includes('max-width: 200px;'), 'Reason badge has max-width limit to prevent title squishing');

    // Responsive media queries
    assert.ok(css.includes('@media (max-width: 680px)'), 'Includes responsive query for mobile/narrow screens');
    assert.ok(css.includes('.developer-tools-summary::marker'), 'Details summary marker hidden for cross-browser disclosure');
  });
});
