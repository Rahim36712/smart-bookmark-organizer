import test from 'node:test';
import assert from 'node:assert';
import { BookmarkTreeManager } from '../core/bookmark-tree.js';
import { BookmarkCategorizer } from '../core/categorizer.js';

// Mock Chrome Bookmarks API
function createMockBookmarksApi(initialTree) {
  let nodes = JSON.parse(JSON.stringify(initialTree));
  let nextId = 100;

  function findNode(tree, id) {
    for (const item of tree) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findNode(item.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  function removeNodeFromParent(tree, id) {
    for (let i = 0; i < tree.length; i++) {
      if (tree[i].id === id) {
        return tree.splice(i, 1)[0];
      }
      if (tree[i].children) {
        const removed = removeNodeFromParent(tree[i].children, id);
        if (removed) return removed;
      }
    }
    return null;
  }

  return {
    getTree: async () => JSON.parse(JSON.stringify(nodes)),
    getChildren: async (parentId) => {
      const parent = findNode(nodes, parentId);
      return parent && parent.children ? JSON.parse(JSON.stringify(parent.children)) : [];
    },
    get: async (id) => {
      const node = findNode(nodes, id);
      return node ? [JSON.parse(JSON.stringify(node))] : [];
    },
    create: async ({ parentId, title, url }) => {
      const parent = findNode(nodes, parentId);
      if (!parent) throw new Error(`Parent ${parentId} not found`);
      if (!parent.children) parent.children = [];
      const newNode = {
        id: String(nextId++),
        parentId,
        title: title || '',
        url: url || undefined,
        children: url ? undefined : []
      };
      parent.children.push(newNode);
      return JSON.parse(JSON.stringify(newNode));
    },
    move: async (id, { parentId, index }) => {
      const node = removeNodeFromParent(nodes, id);
      if (!node) throw new Error(`Node ${id} not found`);
      const newParent = findNode(nodes, parentId);
      if (!newParent) throw new Error(`Target parent ${parentId} not found`);
      if (!newParent.children) newParent.children = [];
      node.parentId = parentId;
      if (typeof index === 'number') {
        newParent.children.splice(index, 0, node);
      } else {
        newParent.children.push(node);
      }
      return JSON.parse(JSON.stringify(node));
    },
    remove: async (id) => {
      const removed = removeNodeFromParent(nodes, id);
      if (!removed) throw new Error(`Node ${id} not found`);
      return true;
    }
  };
}

test('BookmarkTreeManager - Recursive Scanning and Duplicate Detection', async (t) => {
  const sampleTree = [
    {
      id: '0',
      title: 'Root',
      children: [
        {
          id: '1',
          title: 'Bookmarks Bar',
          parentId: '0',
          children: [
            { id: '10', title: 'React Docs', url: 'https://react.dev/', parentId: '1' },
            {
              id: '11',
              title: 'Dev Old Folder',
              parentId: '1',
              children: [
                { id: '12', title: 'GitHub React', url: 'https://github.com/facebook/react?utm_source=twitter', parentId: '11' },
                {
                  id: '13',
                  title: 'Deep Nested Subfolder',
                  parentId: '11',
                  children: [
                    { id: '14', title: 'React Github Duplicate', url: 'https://github.com/facebook/react/', parentId: '13' },
                    { id: '15', title: 'DAAD Germany', url: 'https://www.daad.de/en/', parentId: '13' }
                  ]
                }
              ]
            }
          ]
        },
        {
          id: '2',
          title: 'Other Bookmarks',
          parentId: '0',
          children: [
            { id: '20', title: 'Arxiv Attention', url: 'https://arxiv.org/abs/1706.03762', parentId: '2' }
          ]
        }
      ]
    }
  ];

  const mockApi = createMockBookmarksApi(sampleTree);
  const manager = new BookmarkTreeManager(mockApi);

  await t.test('recursively scans all bookmarks across all folders and subfolders', async () => {
    const scan = await manager.scanBookmarks();
    assert.strictEqual(scan.stats.totalBookmarks, 5);
    assert.strictEqual(scan.folders.length, 5); // Root, Bookmarks Bar, Dev Old Folder, Deep Nested Subfolder, Other Bookmarks

    // Scattered folders (user-created folders) should exclude system folders
    assert.strictEqual(scan.stats.scatteredFoldersCount, 2); // Dev Old Folder, Deep Nested Subfolder

    // Verify deep bookmark was scanned with correct folder path
    const daad = scan.bookmarks.find(b => b.id === '15');
    assert.ok(daad);
    assert.deepStrictEqual(daad.folderPath, ['Bookmarks Bar', 'Dev Old Folder', 'Deep Nested Subfolder']);
  });

  await t.test('detects duplicate URLs even with query tracking and trailing slashes', async () => {
    const scan = await manager.scanBookmarks();
    assert.strictEqual(scan.duplicates.length, 1);
    assert.strictEqual(scan.duplicates[0].bookmarks.length, 2);
    assert.strictEqual(scan.duplicates[0].normalizedUrl, 'https://github.com/facebook/react');
  });

  await t.test('preserves distinct local and custom ports in normalizeUrl', () => {
    const u1 = manager.normalizeUrl('http://localhost:3000/app?utm_source=test');
    const u2 = manager.normalizeUrl('http://localhost:8080/app');
    assert.strictEqual(u1, 'http://localhost:3000/app');
    assert.strictEqual(u2, 'http://localhost:8080/app');
    assert.notStrictEqual(u1, u2);
  });

  await t.test('builds proposed reorganization plan with smart categories', async () => {
    const scan = await manager.scanBookmarks();
    const categorizer = new BookmarkCategorizer();
    const plan = manager.buildProposedPlan(scan.bookmarks, categorizer);

    assert.strictEqual(plan.length, 5);

    const daadItem = plan.find(p => p.id === '15');
    assert.strictEqual(daadItem.proposedCategoryId, 'germany');

    const arxivItem = plan.find(p => p.id === '20');
    assert.strictEqual(arxivItem.proposedCategoryId, 'research');

    const reactItem = plan.find(p => p.id === '10');
    assert.strictEqual(reactItem.proposedCategoryId, 'programming');
  });

  await t.test('executes reorganization safely into hierarchical category folders', async () => {
    const scan = await manager.scanBookmarks();
    const categorizer = new BookmarkCategorizer();
    const plan = manager.buildProposedPlan(scan.bookmarks, categorizer);

    const progressUpdates = [];
    const result = await manager.executePlan(plan, {
      targetRootFolderTitle: 'Organized Bookmarks',
      targetRootParentId: '1'
    }, (prog) => progressUpdates.push(prog));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.totalMoved, 5);
    assert.strictEqual(progressUpdates.length, 5);

    // Verify tree after organization
    const updatedTree = await mockApi.getTree();
    const bookmarksBar = updatedTree[0].children[0];
    const organizedFolder = bookmarksBar.children.find(c => c.title === 'Organized Bookmarks');
    assert.ok(organizedFolder, 'Organized Bookmarks folder should exist');
    assert.ok(organizedFolder.children.length > 0, 'Organized Bookmarks folder should have children');
  });

  await t.test('executes reorganization into Other Bookmarks using targetRootParentId: "2"', async () => {
    const freshApi = createMockBookmarksApi(sampleTree);
    const freshManager = new BookmarkTreeManager(freshApi);
    const scan = await freshManager.scanBookmarks();
    const categorizer = new BookmarkCategorizer();
    const plan = freshManager.buildProposedPlan(scan.bookmarks, categorizer);

    const result = await freshManager.executePlan(plan, {
      targetRootFolderTitle: 'Organized Bookmarks',
      targetRootParentId: '2'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.totalMoved, 5);

    const updatedTree = await freshApi.getTree();
    const otherBookmarks = updatedTree[0].children[1];
    assert.strictEqual(otherBookmarks.id, '2');
    const organizedFolder = otherBookmarks.children.find(c => c.title === 'Organized Bookmarks');
    assert.ok(organizedFolder, 'Organized Bookmarks should exist under Other Bookmarks');
    assert.strictEqual(organizedFolder.parentId, '2');
  });

  await t.test('executes reorganization using targetParentId alias seamlessly', async () => {
    const freshApi = createMockBookmarksApi(sampleTree);
    const freshManager = new BookmarkTreeManager(freshApi);
    const scan = await freshManager.scanBookmarks();
    const categorizer = new BookmarkCategorizer();
    const plan = freshManager.buildProposedPlan(scan.bookmarks, categorizer);

    const result = await freshManager.executePlan(plan, {
      targetRootFolderTitle: 'Organized Bookmarks',
      targetParentId: '2'
    });

    assert.strictEqual(result.success, true);
    const updatedTree = await freshApi.getTree();
    const otherBookmarks = updatedTree[0].children[1];
    const organizedFolder = otherBookmarks.children.find(c => c.title === 'Organized Bookmarks');
    assert.ok(organizedFolder, 'Should recognize targetParentId alias and place into Other Bookmarks');
  });

  await t.test('removes duplicates while returning complete bookmark details for undo', async () => {
    const res = await manager.removeDuplicates(['14']);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].success, true);
    assert.ok(res[0].bookmark);
    assert.strictEqual(res[0].bookmark.id, '14');
  });
});
