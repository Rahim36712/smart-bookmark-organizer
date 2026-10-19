import test from 'node:test';
import assert from 'node:assert';
import { UndoManager } from '../core/undo-manager.js';

function createMockStorage() {
  const store = {};
  return {
    get: async (key) => ({ [key]: store[key] }),
    set: async (items) => { Object.assign(store, items); },
    _store: store
  };
}

function createMockBookmarksApi() {
  let nextId = 200;
  const items = new Map([
    ['1', { id: '1', title: 'Bookmarks Bar', children: [] }],
    ['13', { id: '13', title: 'Old Folder', children: [] }],
    ['10', { id: '10', title: 'React Docs', parentId: '1', index: 0, url: 'https://react.dev' }],
    ['15', { id: '15', title: 'DAAD Germany', parentId: '13', index: 1, url: 'https://www.daad.de' }]
  ]);

  const removedLog = [];

  return {
    items,
    removedLog,
    get: async (id) => items.has(id) ? [JSON.parse(JSON.stringify(items.get(id)))] : [],
    getChildren: async (parentId) => {
      const results = [];
      for (const item of items.values()) {
        if (item.parentId === parentId) {
          results.push(JSON.parse(JSON.stringify(item)));
        }
      }
      return results;
    },
    create: async ({ parentId, title, url }) => {
      const id = String(nextId++);
      const node = { id, parentId, title: title || '', url };
      items.set(id, node);
      return JSON.parse(JSON.stringify(node));
    },
    move: async (id, { parentId, index }) => {
      const item = items.get(id);
      if (!item) throw new Error('Not found');
      item.parentId = parentId;
      if (typeof index === 'number') item.index = index;
      return item;
    },
    remove: async (id) => {
      removedLog.push(id);
      items.delete(id);
      return true;
    },
    getTree: async () => [{ id: '0', title: 'Root', children: Array.from(items.values()) }]
  };
}

test('UndoManager - Snapshot & Restore Reversibility', async (t) => {
  const mockStorage = createMockStorage();
  const mockBookmarksApi = createMockBookmarksApi();
  const undoManager = new UndoManager(mockStorage, mockBookmarksApi);

  await t.test('saves snapshots to storage with timestamp and items', async () => {
    const movedItems = [
      { id: '10', title: 'React Docs', originalParentId: '1', originalIndex: 0, newParentId: '99' },
      { id: '15', title: 'DAAD Germany', originalParentId: '13', originalIndex: 1, newParentId: '88' }
    ];

    // Simulate move has taken place in bookmarks API
    await mockBookmarksApi.move('10', { parentId: '99' });
    await mockBookmarksApi.move('15', { parentId: '88' });

    const snapshot = await undoManager.saveSnapshot('Test Reorganization', movedItems, ['99', '88']);
    assert.strictEqual(snapshot.totalMoved, 2);
    assert.strictEqual(snapshot.status, 'active');

    const snapshots = await undoManager.getAllSnapshots();
    assert.strictEqual(snapshots.length, 1);
    assert.strictEqual(snapshots[0].id, snapshot.id);
  });

  await t.test('supports pending snapshots and safe in-place updates', async () => {
    const pending = await undoManager.saveSnapshot('Pending operation', [{ id: '10' }], [], 'reorganization', { status: 'pending' });
    assert.strictEqual(pending.status, 'pending');
    const updated = await undoManager.updateSnapshot(pending.id, { title: 'Finished operation', status: 'active', items: [{ id: '10' }, { id: '15' }] });
    assert.strictEqual(updated.status, 'active');
    assert.strictEqual(updated.totalMoved, 2);
    await undoManager.deleteSnapshot(pending.id);
  });

  await t.test('restores bookmarks back to original parentId and index', async () => {
    const snapshots = await undoManager.getAllSnapshots();
    const snapshot = snapshots[0];

    const result = await undoManager.restoreSnapshot(snapshot.id);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.restoredCount, 2);

    // Verify bookmarks returned to original parents
    const item10 = (await mockBookmarksApi.get('10'))[0];
    assert.strictEqual(item10.parentId, '1');

    const item15 = (await mockBookmarksApi.get('15'))[0];
    assert.strictEqual(item15.parentId, '13');

    // Verify snapshot status updated
    const updatedSnapshots = await undoManager.getAllSnapshots();
    assert.strictEqual(updatedSnapshots[0].status, 'restored');
  });

  await t.test('cleans up created folders bottom-up (reverse order) on restore', async () => {
    // Setup nested created folders: root 'F_ROOT' -> child 'F_CHILD' -> 'F_LEAF'
    mockBookmarksApi.items.set('F_ROOT', { id: 'F_ROOT', parentId: '1', title: 'Organized Bookmarks' });
    mockBookmarksApi.items.set('F_CHILD', { id: 'F_CHILD', parentId: 'F_ROOT', title: 'Programming' });
    mockBookmarksApi.items.set('F_LEAF', { id: 'F_LEAF', parentId: 'F_CHILD', title: 'Web' });

    // Bookmark moved to F_LEAF
    mockBookmarksApi.items.set('10', { id: '10', title: 'React Docs', parentId: 'F_LEAF', url: 'https://react.dev' });

    const snap = await undoManager.saveSnapshot(
      'Nested Reorg',
      [{ id: '10', title: 'React Docs', originalParentId: '1', originalIndex: 0, newParentId: 'F_LEAF' }],
      ['F_ROOT', 'F_CHILD', 'F_LEAF'] // Stored in top-down order
    );

    mockBookmarksApi.removedLog.length = 0;
    const res = await undoManager.restoreSnapshot(snap.id);
    assert.strictEqual(res.success, true);

    // Verify all 3 empty folders were removed in reverse order (F_LEAF, F_CHILD, F_ROOT)
    assert.deepStrictEqual(mockBookmarksApi.removedLog, ['F_LEAF', 'F_CHILD', 'F_ROOT']);
  });

  await t.test('restores removed duplicate bookmarks into original parent folders', async () => {
    const snap = await undoManager.saveSnapshot(
      'Duplicate cleanup',
      [{ title: 'Duplicate React', url: 'https://react.dev', originalParentId: '1', originalIndex: 0 }],
      [],
      'duplicate_removal'
    );

    const res = await undoManager.restoreSnapshot(snap.id);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.restoredCount, 1);

    // Verify bookmark was recreated
    const barChildren = await mockBookmarksApi.getChildren('1');
    const recreated = barChildren.find(b => b.url === 'https://react.dev' && b.title === 'Duplicate React');
    assert.ok(recreated, 'Duplicate bookmark should be restored into original parent folder');
  });

  await t.test('exports valid JSON backup and imports it reconstructing structure', async () => {
    const jsonStr = await undoManager.exportFullBackup();
    const parsed = JSON.parse(jsonStr);
    assert.strictEqual(parsed.app, 'Smart Bookmark Organizer');
    assert.ok(parsed.tree);

    // Import the backup
    const importRes = await undoManager.importBackup(jsonStr, {
      containerFolderTitle: 'Restored Test Backup'
    });
    assert.strictEqual(importRes.success, true);
    assert.ok(importRes.importedBookmarksCount > 0);

    const importSnapshot = (await undoManager.getAllSnapshots()).find(snapshot => snapshot.type === 'import' && snapshot.status === 'active');
    assert.ok(importSnapshot, 'Import keeps an undo snapshot');
    const undoImport = await undoManager.restoreSnapshot(importSnapshot.id);
    assert.strictEqual(undoImport.success, true);
    assert.strictEqual(undoImport.restoredCount, importRes.importedBookmarksCount);
  });

  await t.test('rejects unsafe or oversized backup files before creating anything', async () => {
    const before = mockBookmarksApi.items.size;
    await assert.rejects(
      undoManager.importBackup(JSON.stringify([{ id: 'x', title: 'Unsafe', url: 'javascript:alert(1)' }])),
      /blocked javascript:/
    );
    await assert.rejects(
      undoManager.importBackup(' '.repeat(101), { maxBytes: 100 }),
      /too large/
    );
    assert.strictEqual(mockBookmarksApi.items.size, before);
  });
});
