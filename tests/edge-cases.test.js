import test from 'node:test';
import assert from 'node:assert';
import { BookmarkCategorizer } from '../core/categorizer.js';
import { BookmarkTreeManager } from '../core/bookmark-tree.js';
import { UndoManager } from '../core/undo-manager.js';

test('Edge Cases & Robustness Test Suite', async (t) => {
  const categorizer = new BookmarkCategorizer();
  const treeManager = new BookmarkTreeManager();

  await t.test('handles non-HTTP and special URLs gracefully without crashing', () => {
    const specialUrls = [
      'chrome://bookmarks/',
      'about:blank',
      'javascript:void(0)',
      'data:text/html,<h1>Test</h1>',
      'file:///C:/Users/User/Documents/report.pdf',
      'https://',
      '',
      null,
      undefined
    ];

    for (const url of specialUrls) {
      const res = categorizer.categorize({ title: 'Special Link', url });
      assert.ok(res, `Should return valid result for ${url}`);
      assert.strictEqual(typeof res.categoryId, 'string');
      assert.strictEqual(typeof res.categoryName, 'string');
      assert.ok(Array.isArray(res.fullCategoryPath));
    }
  });

  await t.test('handles real German umlauts and international characters in titles and URLs', () => {
    const germanUmlaut = categorizer.categorize({
      title: 'Ausländerbehörde München - Aufenthaltserlaubnis beantragen',
      url: 'https://stadt.muenchen.de/service/info/auslaenderangelegenheiten/1063836/'
    });
    assert.strictEqual(germanUmlaut.categoryId, 'germany');

    const wohnung = categorizer.categorize({
      title: 'Günstige 2-Zimmer-Wohnung mieten mit Wohnungsgeberbestätigung',
      url: 'https://www.wg-gesucht.de/wohnungen-in-Berlin.html'
    });
    assert.strictEqual(wohnung.categoryId, 'germany');
  });

  await t.test('handles Unicode word boundary correctly for words starting with umlaut or ending with ß', () => {
    assert.strictEqual(categorizer.hasKeyword('Wir machen eine Übung heute', 'übung'), true);
    assert.strictEqual(categorizer.hasKeyword('Das Zimmer ist groß', 'groß'), true);
    assert.strictEqual(categorizer.hasKeyword('Das Zimmer ist großartig', 'groß'), false); // Not substring false positive
  });

  await t.test('handles malformed percent-encoded sequences in URLs without throwing', () => {
    const res = categorizer.categorize({
      title: 'React Search Result',
      url: 'https://github.com/facebook/react/search?q=%E0%A4%A'
    });
    assert.strictEqual(res.categoryId, 'programming');
  });

  await t.test('normalizes complex URLs with diverse tracking parameters correctly', () => {
    const url1 = 'https://example.com/blog/article/?utm_source=newsletter&utm_medium=email&utm_campaign=spring2026';
    const url2 = 'https://EXAMPLE.COM/blog/article?ref=twitter&fbclid=IwAR123';
    const url3 = 'https://example.com/blog/article/';

    const norm1 = treeManager.normalizeUrl(url1);
    const norm2 = treeManager.normalizeUrl(url2);
    const norm3 = treeManager.normalizeUrl(url3);

    assert.strictEqual(norm1, 'https://example.com/blog/article');
    assert.strictEqual(norm2, 'https://example.com/blog/article');
    assert.strictEqual(norm3, 'https://example.com/blog/article');
  });

  await t.test('handles YouTube share links with si parameter during duplicate normalization', () => {
    const yt1 = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const yt2 = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=abcdef123456';
    const norm1 = treeManager.normalizeUrl(yt1);
    const norm2 = treeManager.normalizeUrl(yt2);
    assert.strictEqual(norm1, norm2);
  });

  await t.test('handles empty bookmark tree or missing children arrays gracefully', async () => {
    const emptyMockApi = {
      getTree: async () => []
    };
    const emptyManager = new BookmarkTreeManager(emptyMockApi);
    const scan = await emptyManager.scanBookmarks();
    assert.strictEqual(scan.bookmarks.length, 0);
    assert.strictEqual(scan.folders.length, 0);
    assert.strictEqual(scan.duplicates.length, 0);
  });

  await t.test('handles deep 10-level nested folders without recursion limits', async () => {
    let deepNode = { id: 'leaf', title: 'Deep Bookmark', url: 'https://python.org' };
    for (let i = 10; i >= 1; i--) {
      deepNode = {
        id: `folder_${i}`,
        title: `Subfolder Level ${i}`,
        children: [deepNode]
      };
    }
    const rootNode = {
      id: '0',
      title: 'Root',
      children: [deepNode]
    };

    const deepMockApi = {
      getTree: async () => [rootNode]
    };
    const deepManager = new BookmarkTreeManager(deepMockApi);
    const scan = await deepManager.scanBookmarks();

    assert.strictEqual(scan.bookmarks.length, 1);
    assert.strictEqual(scan.bookmarks[0].id, 'leaf');
    assert.strictEqual(scan.bookmarks[0].folderPath.length, 10);
  });

  await t.test('snapshot restore handles missing/deleted bookmarks gracefully', async () => {
    const store = {};
    const mockStorage = {
      get: async (k) => ({ [k]: store[k] }),
      set: async (v) => { Object.assign(store, v); }
    };

    // Bookmarks API returns empty array for get (simulating bookmark deleted by user)
    const mockApi = {
      get: async () => [],
      move: async () => { throw new Error('Not found'); },
      getChildren: async () => []
    };

    const undo = new UndoManager(mockStorage, mockApi);
    const snap = await undo.saveSnapshot('Reorganization with deleted item', [
      { id: 'deleted_123', originalParentId: '1', originalIndex: 0 }
    ]);

    const res = await undo.restoreSnapshot(snap.id);
    assert.strictEqual(res.success, false); // Accurately returns false when items failed
    assert.strictEqual(res.restoredCount, 0);
    assert.strictEqual(res.failedCount, 1);
  });

  await t.test('categorizer safely handles IP addresses and ports in URL domain extraction', () => {
    const ipRes = categorizer.categorize({
      title: 'Router Admin Portal',
      url: 'http://192.168.1.1:8080/dashboard'
    });
    assert.ok(ipRes, 'Should handle IP address without error');
    assert.strictEqual(typeof ipRes.categoryId, 'string');

    const localhostRes = categorizer.categorize({
      title: 'Local Dev Server',
      url: 'http://localhost:3000/app'
    });
    assert.ok(localhostRes);
  });
});
