import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFolderResetPlan, resetBookmarkFolders } from '../core/folder-reset.js';
import { UndoManager } from '../core/undo-manager.js';

function fixture() {
  const link = (id, title = id) => ({ id, title, url: `https://example.com/${id}` });
  const folder = (id, title, children = []) => ({ id, title, children });
  const tree = [folder('0', '', [
    folder('bar', 'Favoris', [link('a'), folder('f1', 'Same', [link('b'), folder('deep', '', [link('c')])]),
      link('d'), folder('f2', 'Same', [link('e')]), folder('empty', 'Empty')]),
    folder('other', 'Autres favoris', [folder('f3', 'Research', [link('f')])]),
    { ...folder('managed', 'Managed', [folder('policy', 'Policy', [link('private')])]), unmodifiable: 'managed' }
  ])];
  const indexTree = (nodes, parentId) => nodes.forEach((node, index) => {
    node.parentId = parentId;
    node.index = index;
    if (node.children) indexTree(node.children, node.id);
  });
  const all = () => {
    indexTree(tree);
    const nodes = [];
    const walk = node => { nodes.push(node); node.children?.forEach(walk); };
    tree.forEach(walk);
    return nodes;
  };
  const find = id => { const node = all().find(n => n.id === id); if (!node) throw new Error('Missing node'); return node; };
  let nextId = 1000;
  const events = [];
  const data = {};
  const storage = {
    get: async key => ({ [key]: structuredClone(data[key]) }),
    set: async values => { events.push('save'); Object.assign(data, structuredClone(values)); }
  };
  const api = {
    getTree: async () => { all(); return structuredClone(tree); },
    get: async id => [structuredClone(find(id))],
    getChildren: async id => structuredClone(find(id).children),
    create: async ({ parentId, title }) => {
      const node = folder(String(nextId++), title);
      find(parentId).children.push(node);
      all();
      events.push('create');
      return structuredClone(node);
    },
    move: async (id, { parentId, index }) => {
      const node = find(id);
      const target = find(parentId);
      const source = find(node.parentId);
      if (!target.children) throw new Error('Not a folder');
      if (index !== undefined && (index < 0 || index > target.children.length)) throw new Error('Invalid index');
      source.children.splice(source.children.indexOf(node), 1);
      target.children.splice(index ?? target.children.length, 0, node);
      all();
      events.push('move');
      return structuredClone(node);
    },
    remove: async id => {
      const node = find(id);
      assert.equal(node.children.length, 0, 'Only empty folders may be deleted');
      assert.notEqual(node.parentId, '0', 'Never delete browser sections');
      const parent = find(node.parentId);
      parent.children.splice(parent.children.indexOf(node), 1);
      events.push('remove');
    }
  };
  const shape = nodes => nodes.map(n => ({ title: n.title, ...(n.url ? { id: n.id, url: n.url } : { children: shape(n.children) }) }));
  return { api, storage, events, manager: new UndoManager(storage, api), shape, tree };
}

test('reset preserves every bookmark and browser section; undo restores exact structure/order', async () => {
  const f = fixture();
  const before = f.shape(await f.api.getTree());
  const plan = buildFolderResetPlan(await f.api.getTree());
  assert.equal(plan.moves.length, 4);
  const result = await resetBookmarkFolders(f.api, f.manager);
  assert.equal(f.events[0], 'save');
  assert.equal(result.totalMoved, 4);
  assert.equal(result.removedFolders, 5);
  assert.equal(result.failedCount, 0);
  assert.equal(result.managedCount, 1);
  assert.ok((await f.api.getChildren('bar')).every(n => n.url));
  assert.ok((await f.api.getChildren('other')).every(n => n.url));
  assert.equal((await f.api.get('private'))[0].parentId, 'policy');
  assert.equal((await f.manager.restoreSnapshot(result.snapshot.id)).success, true);
  assert.deepEqual(f.shape(await f.api.getTree()), before);
  assert.equal((await f.manager.getAllSnapshots())[0].status, 'restored');
});

test('snapshot storage failure prevents all mutations', async () => {
  const f = fixture();
  f.storage.set = async () => { throw new Error('Storage full'); };
  await assert.rejects(resetBookmarkFolders(f.api, f.manager), /Storage full/);
  assert.deepEqual(f.events, []);
});

test('failed bookmark moves prevent folder deletion', async () => {
  const f = fixture();
  const move = f.api.move;
  f.api.move = async (id, destination) => {
    if (id === 'c') throw new Error('Move failed');
    return move(id, destination);
  };
  const result = await resetBookmarkFolders(f.api, f.manager);
  assert.ok(result.failedCount > 0);
  assert.equal((await f.api.get('c'))[0].parentId, 'deep');
  assert.ok((await f.api.get('f1'))[0]);
  f.api.move = move;
  assert.equal((await f.manager.restoreSnapshot(result.snapshot.id)).success, true);
});

test('empty-only hierarchies are reset and restored; repeated flat reset is a no-op', async () => {
  const f = fixture();
  f.tree[0].children = [{ id: 'bar', title: 'Bar', children: [{ id: 'empty', title: '', children: [] }] }];
  const before = f.shape(await f.api.getTree());
  const result = await resetBookmarkFolders(f.api, f.manager);
  assert.equal(result.totalMoved, 0);
  assert.equal(result.removedFolders, 1);
  assert.equal((await resetBookmarkFolders(f.api, f.manager)).snapshot, undefined);
  assert.equal((await f.manager.getAllSnapshots()).length, 1);
  assert.equal((await f.manager.restoreSnapshot(result.snapshot.id)).success, true);
  assert.deepEqual(f.shape(await f.api.getTree()), before);
});

test('partial undo stays retryable and reuses recreated folders', async () => {
  const f = fixture();
  const before = f.shape(await f.api.getTree());
  const result = await resetBookmarkFolders(f.api, f.manager);
  const move = f.api.move;
  f.api.move = async (id, target) => {
    if (id === 'c') throw new Error('Temporary failure');
    return move(id, target);
  };
  assert.equal((await f.manager.restoreSnapshot(result.snapshot.id)).success, false);
  assert.equal((await f.manager.getAllSnapshots())[0].status, 'active');
  const creates = f.events.filter(e => e === 'create').length;
  f.api.move = move;
  assert.equal((await f.manager.restoreSnapshot(result.snapshot.id)).success, true);
  assert.equal(f.events.filter(e => e === 'create').length, creates);
  assert.deepEqual(f.shape(await f.api.getTree()), before);
});

test('folder deletion failure preserves a usable undo snapshot', async () => {
  const f = fixture();
  const before = f.shape(await f.api.getTree());
  const remove = f.api.remove;
  f.api.remove = async id => { if (id === 'f2') throw new Error('Busy'); return remove(id); };
  const result = await resetBookmarkFolders(f.api, f.manager);
  assert.equal(result.failedCount, 1);
  assert.equal((await f.manager.restoreSnapshot(result.snapshot.id)).success, true);
  assert.deepEqual(f.shape(await f.api.getTree()), before);
});

test('concurrent additions are never recursively removed', async () => {
  const f = fixture();
  const remove = f.api.remove;
  let added = false;
  f.api.remove = async id => {
    if (!added) {
      added = true;
      const findNode = nodes => {
        for (const node of nodes) {
          if (node.id === id) return node;
          const nested = findNode(node.children || []);
          if (nested) return nested;
        }
      };
      const node = findNode(f.tree);
      if (node) node.children.push({ id: 'new', title: 'New link', url: 'https://example.com/new' });
    }
    return remove(id);
  };
  const result = await resetBookmarkFolders(f.api, f.manager);
  assert.ok(result.failedCount > 0);
  assert.ok((await f.api.get('new'))[0].url);
});
