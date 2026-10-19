import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibleBookmarks, protectedFolderIds, applyConfidenceDefaults, markCurrentDestinations } from '../core/organization-safety.js';
import { BookmarkTreeManager } from '../core/bookmark-tree.js';

test('folder protection follows IDs through nested and renamed folders', () => {
  const folders = [{ id: 'child', parentId: 'private' }, { id: 'private', parentId: '1', title: 'Renamed' }];
  assert.deepEqual([...protectedFolderIds(folders, ['private'])], ['private', 'child']);
  assert.deepEqual(eligibleBookmarks({ folders, bookmarks: [{ id: 'a', parentId: 'child' }, { id: 'b', parentId: '1' }] }, { excludedFolderIds: ['private'] }).map(b => b.id), ['b']);
});

test('safe defaults leave uncertain suggestions unselected without reselecting excluded items', () => {
  const plan = [{ confidence: 'high', selected: true }, { confidence: 'medium', selected: true }, { confidence: 'none', selected: false }, { confidence: 'high', selected: false }];
  assert.deepEqual(applyConfidenceDefaults(plan, {}).map(p => p.selected), [true, false, false, false]);
  assert.equal(applyConfidenceDefaults([{ confidence: 'medium', selected: true }], { highConfidenceOnly: false })[0].selected, true);
});

test('cancellation before organization makes no bookmark API writes', async () => {
  const manager = new BookmarkTreeManager({ create: () => assert.fail('must not create') });
  const controller = new AbortController(); controller.abort();
  const result = await manager.executePlan([{ id: 'a' }], { signal: controller.signal });
  assert.equal(result.cancelled, true);
  assert.equal(result.totalMoved, 0);
});

test('stop after first move returns completed moves for undo and skips cleanup', async () => {
  const controller = new AbortController();
  const moved = [];
  const manager = new BookmarkTreeManager({ move: async id => { moved.push(id); controller.abort(); } });
  manager.ensureFolderHierarchy = async () => 'destination';
  manager.cleanEmptyScatteredFolders = async () => assert.fail('must not clean after stopping');
  const result = await manager.executePlan([{ id: 'a' }, { id: 'b' }], { signal: controller.signal, cleanEmptyFolders: true });
  assert.deepEqual(moved, ['a']);
  assert.equal(result.movedItems[0].id, 'a');
  assert.equal(result.cancelled, true);
});

test('protected destination cannot create subfolders', async () => {
  const manager = new BookmarkTreeManager({ getChildren: async () => [{ id: 'private', title: 'Private' }], create: () => assert.fail('must not create in protected folder') });
  await assert.rejects(manager.ensureFolderHierarchy(['Private', 'New'], '1', new Map(), new Set(), new Set(['private'])), /protected/);
});

test('execution rechecks current bookmark parents before moving', async () => {
  const manager = new BookmarkTreeManager({ move: () => assert.fail('protected bookmark must stay put') });
  manager.scanBookmarks = async () => ({ folders: [{ id: 'private', parentId: '1' }], bookmarks: [{ id: 'a', parentId: 'private' }] });
  const result = await manager.executePlan([{ id: 'a', currentParentId: '1' }], { excludedFolderIds: ['private'] });
  assert.equal(result.totalMoved, 0);
});

test('failed moves are reported separately from successful moves', async () => {
  const manager = new BookmarkTreeManager({ move: async () => { throw new Error('No longer exists'); } });
  manager.ensureFolderHierarchy = async () => 'destination';
  const result = await manager.executePlan([{ id: 'missing' }]);
  assert.equal(result.success, false);
  assert.equal(result.totalMoved, 0);
  assert.equal(result.failedItems[0].id, 'missing');
});

test('already-in-place status respects the chosen destination instead of a matching folder name', () => {
  const scan = { folders: [{ id: 'old', parentId: '2', title: 'Programming' }, { id: 'new', parentId: '1', title: 'Programming' }] };
  const plan = [{ currentParentId: 'old', proposedPath: ['Programming'] }];
  markCurrentDestinations(plan, scan, { targetRootParentId: '1', targetRootFolderTitle: null });
  assert.equal(plan[0].isAlreadyOrganized, false);
  markCurrentDestinations(plan, scan, { targetRootParentId: '2', targetRootFolderTitle: null });
  assert.equal(plan[0].isAlreadyOrganized, true);
});

test('empty folder cleanup never enters a protected subtree', async () => {
  const removed = [];
  const manager = new BookmarkTreeManager({
    getTree: async () => [{ id: '0', children: [{ id: 'private', parentId: '0', children: [{ id: 'empty', parentId: 'private', children: [] }] }] }],
    getChildren: async id => { assert.notEqual(id, 'private'); assert.notEqual(id, 'empty'); return []; },
    remove: async id => removed.push(id)
  });
  await manager.cleanEmptyScatteredFolders(new Set(['private']));
  assert.deepEqual(removed, []);
});
