import { SAMPLE_TEST_BOOKMARKS } from '../core/bookmark-tree.js';
const tree = [{ id: '0', title: '', children: [
  { id: '1', parentId: '0', title: 'Bookmarks Bar', children: [
    { id: '10', parentId: '1', title: 'Saved for later', children: SAMPLE_TEST_BOOKMARKS.map((b, i) => ({ id: String(100 + i), parentId: '10', index: i, title: b.title, url: b.url })) },
    { id: '11', parentId: '1', title: 'Personal', children: [{ id: '200', parentId: '11', title: 'My journal', url: 'https://example.com/journal' }] }
  ] },
  { id: '2', parentId: '0', title: 'Other Bookmarks', children: [] }
]}];
const nodes = () => { const all = []; const visit = n => { all.push(n); n.children?.forEach(visit); }; tree.forEach(visit); return all; };
const find = id => nodes().find(n => n.id === id);
let nextId = 300;
const data = {};
window.chrome = {
  storage: { local: { get: async key => ({ [key]: structuredClone(data[key]) }), set: async entries => Object.assign(data, structuredClone(entries)) } },
  runtime: { getURL: p => '/' + p },
  tabs: { create: ({ url }) => window.open(url) },
  bookmarks: {
    getTree: async () => structuredClone(tree),
    getChildren: async id => structuredClone(find(id)?.children || []),
    get: async id => find(id) ? [structuredClone(find(id))] : [],
    create: async ({ parentId, title, url }) => { const n = { id: String(nextId++), parentId, title, ...(url ? { url } : { children: [] }) }; find(parentId).children.push(n); return structuredClone(n); },
    move: async (id, { parentId, index }) => { const n = find(id); const old = find(n.parentId); old.children = old.children.filter(c => c.id !== id); n.parentId = parentId; find(parentId).children.splice(index ?? find(parentId).children.length, 0, n); return structuredClone(n); },
    remove: async id => { const n = find(id); const parent = find(n.parentId); parent.children = parent.children.filter(c => c.id !== id); }
  }
};
