import test from 'node:test';
import assert from 'node:assert';
import { BookmarkTreeManager, SAMPLE_TEST_BOOKMARKS } from '../core/bookmark-tree.js';
import { BookmarkCategorizer } from '../core/categorizer.js';
import { SettingsManager, DEFAULT_SETTINGS } from '../core/storage.js';
import { UndoManager } from '../core/undo-manager.js';

// Mock Chrome Bookmarks API helper
function createMockBookmarksApi(initialTree) {
  let nodes = JSON.parse(JSON.stringify(initialTree));
  let nextId = 500;

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

// Mock chrome.storage.local helper
function createMockStorageArea(initialState = {}) {
  const store = { ...initialState };
  return {
    get: async (keys) => {
      if (typeof keys === 'string') {
        return { [keys]: store[keys] };
      }
      if (Array.isArray(keys)) {
        const res = {};
        for (const k of keys) res[k] = store[k];
        return res;
      }
      return { ...store };
    },
    set: async (items) => {
      Object.assign(store, items);
    },
    remove: async (keys) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      for (const k of arr) delete store[k];
    },
    clear: async () => {
      for (const k in store) delete store[k];
    }
  };
}

// =========================================================================
// SECTION 1: SMART HYBRID FOLDER ORGANIZATION TESTS
// =========================================================================

test('Smart Hybrid Organization - Threshold Behavior & Over-Nesting Prevention', async (t) => {
  const categorizer = new BookmarkCategorizer();
  const treeManager = new BookmarkTreeManager();

  await t.test('keeps category flat when bookmark count is fewer than default threshold of 10', () => {
    // 9 Study Abroad bookmarks (all match Study Abroad subcategories)
    const rawBookmarks = [
      { id: 'sa1', title: 'Study Abroad UCAS Undergraduate Admissions', url: 'https://ucas.com/apply' },
      { id: 'sa2', title: 'Study Abroad QS World University Rankings 2026', url: 'https://topuniversities.com/rankings' },
      { id: 'sa3', title: 'Study Abroad Times Higher Education Global Rankings', url: 'https://timeshighereducation.com' },
      { id: 'sa4', title: 'Study Abroad MastersPortal Degrees Abroad', url: 'https://mastersportal.com/search' },
      { id: 'sa5', title: 'Study Abroad Fulbright Fellowship Program', url: 'https://us.fulbrightonline.org' },
      { id: 'sa6', title: 'Study Abroad IELTS Exam Registration & Practice', url: 'https://ielts.org/book' },
      { id: 'sa7', title: 'Study Abroad TOEFL iBT Official Test Portal', url: 'https://ets.org/toefl' },
      { id: 'sa8', title: 'Study Abroad Erasmus+ Student Exchange Network', url: 'https://erasmus-plus.ec.europa.eu' },
      { id: 'sa9', title: 'Study Abroad Campus France Student Visa Services', url: 'https://campusfrance.org' }
    ];

    // Default options (groupingMode defaults to 'hybrid', hybridThreshold defaults to 10)
    const plan = treeManager.buildProposedPlan(rawBookmarks, categorizer);

    assert.strictEqual(plan.length, 9);
    for (const item of plan) {
      assert.strictEqual(item.proposedCategoryName, 'Study Abroad');
      // Must be kept FLAT directly inside category folder because count (9) < threshold (10)
      assert.strictEqual(item.proposedPath.length, 1, `Bookmark ${item.title} should have flat path of 1 segment`);
      assert.deepStrictEqual(item.proposedPath, ['Study Abroad']);
      assert.strictEqual(item.proposedFolderDisplay, 'Study Abroad');
      assert.strictEqual(item.proposedSubcategoryName, null);
    }
  });

  await t.test('creates subfolders when category bookmark count reaches or exceeds threshold of 10', () => {
    // 10 Study Abroad bookmarks
    const rawBookmarks = [
      { id: 'sa1', title: 'Study Abroad UCAS Undergraduate Admissions', url: 'https://ucas.com/apply' },
      { id: 'sa2', title: 'Study Abroad QS World University Rankings 2026', url: 'https://topuniversities.com/rankings' },
      { id: 'sa3', title: 'Study Abroad Times Higher Education Global Rankings', url: 'https://timeshighereducation.com' },
      { id: 'sa4', title: 'Study Abroad MastersPortal Degrees Abroad', url: 'https://mastersportal.com/search' },
      { id: 'sa5', title: 'Study Abroad Fulbright Fellowship Program', url: 'https://us.fulbrightonline.org' },
      { id: 'sa6', title: 'Study Abroad IELTS Exam Registration & Practice', url: 'https://ielts.org/book' },
      { id: 'sa7', title: 'Study Abroad TOEFL iBT Official Test Portal', url: 'https://ets.org/toefl' },
      { id: 'sa8', title: 'Study Abroad Erasmus+ Student Exchange Network', url: 'https://erasmus-plus.ec.europa.eu' },
      { id: 'sa9', title: 'Study Abroad Campus France Student Visa Services', url: 'https://campusfrance.org' },
      { id: 'sa10', title: 'Study Abroad Chevening Scholarships UK Application', url: 'https://chevening.org/apply' }
    ];

    const plan = treeManager.buildProposedPlan(rawBookmarks, categorizer, { groupingMode: 'hybrid', hybridThreshold: 10 });

    assert.strictEqual(plan.length, 10);
    // Since count (10) >= threshold (10), subfolders should now be created for items with matched subcategories
    const itemsWithSubfolders = plan.filter(p => p.proposedPath.length > 1);
    assert.ok(itemsWithSubfolders.length > 0, 'Should create subcategory subfolders when threshold is reached');

    const admissionsItem = plan.find(p => p.id === 'sa1');
    assert.ok(admissionsItem.proposedPath.length >= 2);
    assert.strictEqual(admissionsItem.proposedPath[0], 'Study Abroad');
    assert.ok(admissionsItem.proposedSubcategoryName);
  });

  await t.test('partitions selectively: large categories split into subfolders while small categories stay flat in the same plan', () => {
    const rawBookmarks = [
      // 10 Programming bookmarks (>= 10)
      { id: 'p1', title: 'React Documentation', url: 'https://react.dev' },
      { id: 'p2', title: 'Vue.js Framework Guide', url: 'https://vuejs.org' },
      { id: 'p3', title: 'Angular Core Docs', url: 'https://angular.io' },
      { id: 'p4', title: 'Svelte Reactive Components', url: 'https://svelte.dev' },
      { id: 'p5', title: 'MDN Web JavaScript Reference', url: 'https://developer.mozilla.org/js' },
      { id: 'p6', title: 'TypeScript Handbook', url: 'https://typescriptlang.org' },
      { id: 'p7', title: 'Python Official Language Reference', url: 'https://python.org/docs' },
      { id: 'p8', title: 'Node.js Runtime Documentation', url: 'https://nodejs.org/api' },
      { id: 'p9', title: 'Rust Language Book', url: 'https://rust-lang.org/book' },
      { id: 'p10', title: 'Go Dev Documentation', url: 'https://go.dev/doc' },

      // 3 Gaming bookmarks (< 10)
      { id: 'g1', title: 'Steam Video Games Community', url: 'https://steamcommunity.com' },
      { id: 'g2', title: 'IGN Game Reviews & Walkthroughs', url: 'https://ign.com' },
      { id: 'g3', title: 'Nexus Mods Game Modifications', url: 'https://nexusmods.com' }
    ];

    const plan = treeManager.buildProposedPlan(rawBookmarks, categorizer, {
      groupingMode: 'hybrid',
      hybridThreshold: 10
    });

    const progItems = plan.filter(p => p.proposedCategoryId === 'programming');
    const gameItems = plan.filter(p => p.proposedCategoryId === 'gaming');

    assert.strictEqual(progItems.length, 10);
    assert.strictEqual(gameItems.length, 3);

    // Programming (>= 10) should create subcategories
    const progWithSub = progItems.filter(p => p.proposedPath.length > 1);
    assert.ok(progWithSub.length > 0, 'Programming has >= 10 items and should produce subfolders');

    // Gaming (< 10) MUST remain flat
    for (const item of gameItems) {
      assert.strictEqual(item.proposedPath.length, 1, `Gaming item ${item.title} must be flat`);
      assert.deepStrictEqual(item.proposedPath, ['Gaming & Emulators']);
      assert.strictEqual(item.proposedSubcategoryName, null);
    }
  });

  await t.test('supports user-configurable custom thresholds between 5 and 25', () => {
    // 5 bookmarks
    const fiveBookmarks = [
      { id: 'f1', title: 'TradingView Financial Charts', url: 'https://tradingview.com' },
      { id: 'f2', title: 'The5ers Prop Trading Program', url: 'https://the5ers.com' },
      { id: 'f3', title: 'Forex Factory Calendar', url: 'https://forexfactory.com' },
      { id: 'f4', title: 'Investopedia Technical Indicators', url: 'https://investopedia.com' },
      { id: 'f5', title: 'Bloomberg Markets Daily', url: 'https://bloomberg.com/markets' }
    ];

    // With custom threshold = 5: 5 bookmarks >= 5 -> creates subfolders
    const planThreshold5 = treeManager.buildProposedPlan(fiveBookmarks, categorizer, {
      groupingMode: 'hybrid',
      hybridThreshold: 5
    });
    const sub5 = planThreshold5.filter(p => p.proposedPath.length > 1);
    assert.ok(sub5.length > 0, 'Threshold 5 should allow 5 items to create subcategories');

    // With custom threshold = 15: 5 bookmarks < 15 -> stays flat
    const planThreshold15 = treeManager.buildProposedPlan(fiveBookmarks, categorizer, {
      groupingMode: 'hybrid',
      hybridThreshold: 15
    });
    for (const item of planThreshold15) {
      assert.strictEqual(item.proposedPath.length, 1, 'Threshold 15 must keep 5 items flat');
      assert.strictEqual(item.proposedSubcategoryName, null);
    }
  });

  await t.test('strictly flattens everything when groupingMode is "flat"', () => {
    const rawBookmarks = [
      { id: 'p1', title: 'React Documentation', url: 'https://react.dev' },
      { id: 'p2', title: 'Vue.js Framework Guide', url: 'https://vuejs.org' },
      { id: 'p3', title: 'Angular Core Docs', url: 'https://angular.io' },
      { id: 'p4', title: 'Svelte Reactive Components', url: 'https://svelte.dev' },
      { id: 'p5', title: 'MDN Web JavaScript Reference', url: 'https://developer.mozilla.org/js' },
      { id: 'p6', title: 'TypeScript Handbook', url: 'https://typescriptlang.org' },
      { id: 'p7', title: 'Python Official Language Reference', url: 'https://python.org/docs' },
      { id: 'p8', title: 'Node.js Runtime Documentation', url: 'https://nodejs.org/api' },
      { id: 'p9', title: 'Rust Language Book', url: 'https://rust-lang.org/book' },
      { id: 'p10', title: 'Go Dev Documentation', url: 'https://go.dev/doc' },
      { id: 'p11', title: 'C++ Reference Manual', url: 'https://cppreference.com' },
      { id: 'p12', title: 'Docker Containers Hub', url: 'https://hub.docker.com' }
    ];

    const plan = treeManager.buildProposedPlan(rawBookmarks, categorizer, { groupingMode: 'flat' });

    assert.strictEqual(plan.length, 12);
    for (const item of plan) {
      assert.strictEqual(item.proposedPath.length, 1, 'Mode "flat" must never create subfolders');
      assert.strictEqual(item.proposedSubcategoryName, null);
    }
  });

  await t.test('always preserves subcategories when groupingMode is "hierarchical"', () => {
    const rawBookmarks = [
      { id: 'sa1', title: 'Uni-Assist Germany Admissions Portal', url: 'https://my.uni-assist.de/login' },
      { id: 'sa2', title: 'DAAD Scholarship Database Germany', url: 'https://daad.de/scholarships' }
    ];

    const plan = treeManager.buildProposedPlan(rawBookmarks, categorizer, { groupingMode: 'hierarchical' });

    assert.strictEqual(plan.length, 2);
    // Even with only 2 items, hierarchical mode forces subcategory folders
    assert.strictEqual(plan[0].proposedPath.length, 2);
    assert.strictEqual(plan[1].proposedPath.length, 2);
    assert.ok(plan[0].proposedSubcategoryName);
    assert.ok(plan[1].proposedSubcategoryName);
  });
});

test('Smart Hybrid Organization - Gemini AI Integration', async (t) => {
  const categorizer = new BookmarkCategorizer();
  const treeManager = new BookmarkTreeManager();

  await t.test('Gemini AI respects hybrid threshold: flattens small AI categories under threshold 10', async () => {
    const bookmarks = [
      { id: 'ai1', title: 'Hugging Face Models Hub', url: 'https://huggingface.co/models' },
      { id: 'ai2', title: 'Anthropic Claude AI Assistant', url: 'https://claude.ai' },
      { id: 'ai3', title: 'PyTorch Deep Learning Framework', url: 'https://pytorch.org' }
    ];

    const mockGeminiService = {
      isConfigured: () => true,
      categorizeAll: async () => [
        { id: 'ai1', category: 'Artificial Intelligence', subcategory: 'Open Source Models', reason: 'AI models' },
        { id: 'ai2', category: 'Artificial Intelligence', subcategory: 'LLM Chatbots', reason: 'Claude assistant' },
        { id: 'ai3', category: 'Artificial Intelligence', subcategory: 'Machine Learning Frameworks', reason: 'PyTorch' }
      ]
    };

    // Run with default hybrid threshold 10 (3 bookmarks < 10)
    const plan = await treeManager.buildProposedPlanWithAi(
      bookmarks,
      categorizer,
      mockGeminiService,
      { groupingMode: 'hybrid', hybridThreshold: 10 }
    );

    assert.strictEqual(plan.length, 3);
    for (const item of plan) {
      assert.strictEqual(item.isAiGenerated, true);
      assert.strictEqual(item.proposedCategoryName, 'Artificial Intelligence');
      // Must be flattened to avoid over-nesting for 3 bookmarks
      assert.strictEqual(item.proposedPath.length, 1);
      assert.deepStrictEqual(item.proposedPath, ['Artificial Intelligence']);
      assert.strictEqual(item.proposedFolderDisplay, 'Artificial Intelligence');
      assert.strictEqual(item.proposedSubcategoryName, null);
    }
  });

  await t.test('Gemini AI creates subfolders when category has >= 10 bookmarks in hybrid mode', async () => {
    const bookmarks = [];
    const aiResults = [];
    for (let i = 1; i <= 10; i++) {
      bookmarks.push({ id: `ai_${i}`, title: `AI Tool ${i}`, url: `https://aitool${i}.ai` });
      aiResults.push({
        id: `ai_${i}`,
        category: 'Artificial Intelligence',
        subcategory: `Subdivision ${i % 2 === 0 ? 'A' : 'B'}`,
        reason: 'Semantic AI'
      });
    }

    const mockGeminiService = {
      isConfigured: () => true,
      categorizeAll: async () => aiResults
    };

    const plan = await treeManager.buildProposedPlanWithAi(
      bookmarks,
      categorizer,
      mockGeminiService,
      { groupingMode: 'hybrid', hybridThreshold: 10 }
    );

    assert.strictEqual(plan.length, 10);
    // Since count is 10 (>= 10), subcategories are preserved
    for (const item of plan) {
      assert.strictEqual(item.proposedPath.length, 2);
      assert.strictEqual(item.proposedPath[0], 'Artificial Intelligence');
      assert.ok(item.proposedSubcategoryName);
      assert.ok(item.proposedFolderDisplay.includes(' / '));
    }
  });
});

// =========================================================================
// SECTION 2: BOOKMARK SCATTER & REVERSIBLE UNDO SNAPSHOT TESTS
// =========================================================================

test('BookmarkTreeManager - Scatter Existing Bookmarks & Reversible Restore', async (t) => {
  const initialTree = [
    {
      id: '0',
      title: 'Root',
      children: [
        {
          id: '1',
          title: 'Bookmarks Bar',
          parentId: '0',
          children: [
            {
              id: '10',
              title: 'Organized Bookmarks',
              parentId: '1',
              children: [
                {
                  id: '11',
                  title: 'Study Abroad',
                  parentId: '10',
                  children: [
                    { id: '101', title: 'Uni-Assist', url: 'https://my.uni-assist.de', parentId: '11', index: 0 },
                    { id: '102', title: 'DAAD Germany', url: 'https://daad.de', parentId: '11', index: 1 },
                    { id: '103', title: 'QS Rankings', url: 'https://topuniversities.com', parentId: '11', index: 2 }
                  ]
                },
                {
                  id: '12',
                  title: 'AI Technology',
                  parentId: '10',
                  children: [
                    { id: '104', title: 'Hugging Face', url: 'https://huggingface.co', parentId: '12', index: 0 },
                    { id: '105', title: 'Claude AI', url: 'https://claude.ai', parentId: '12', index: 1 }
                  ]
                }
              ]
            }
          ]
        },
        { id: '2', title: 'Other Bookmarks', parentId: '0', children: [] }
      ]
    }
  ];

  const mockApi = createMockBookmarksApi(initialTree);
  const mockStorage = createMockStorageArea();
  const undoManager = new UndoManager(mockStorage, mockApi);
  const treeManager = new BookmarkTreeManager(mockApi);

  await t.test('scatters existing bookmarks across test folders and saves undo snapshot', async () => {
    const scan = await treeManager.scanBookmarks();
    assert.strictEqual(scan.bookmarks.length, 5);

    const scatterResult = await treeManager.scatterBookmarks(scan.bookmarks, {
      undoManager,
      targetRootParentId: '1'
    });

    assert.strictEqual(scatterResult.success, true);
    assert.strictEqual(scatterResult.totalMoved, 5);
    assert.strictEqual(scatterResult.createdFolders.length, 3); // Old Folder A, Random Links, Unsorted
    assert.ok(scatterResult.snapshot, 'Snapshot must be created');
    assert.strictEqual(scatterResult.snapshot.type, 'scatter');
    assert.strictEqual(scatterResult.snapshot.items.length, 5);

    // Verify bookmarks moved out of Organized Bookmarks
    const freshTree = await mockApi.getTree();
    const bar = freshTree[0].children[0];
    const testFolderA = bar.children.find(c => c.title === 'Old Folder A');
    const randomLinks = bar.children.find(c => c.title === 'Random Links');
    const unsorted = bar.children.find(c => c.title === 'Unsorted');

    assert.ok(testFolderA, 'Old Folder A should exist under Bookmarks Bar');
    assert.ok(randomLinks, 'Random Links should exist under Bookmarks Bar');
    assert.ok(unsorted, 'Unsorted should exist under Bookmarks Bar');

    // Total bookmarks in scattered locations + bar should equal 5
    const scatteredBookmarksCount =
      (testFolderA.children ? testFolderA.children.filter(c => c.url).length : 0) +
      (randomLinks.children ? randomLinks.children.filter(c => c.url).length : 0) +
      (unsorted.children ? unsorted.children.filter(c => c.url).length : 0) +
      (bar.children.filter(c => c.url).length);

    assert.strictEqual(scatteredBookmarksCount, 5, 'All 5 bookmarks must be scattered into test destinations');
  });

  await t.test('1-click restores original organized structure and deletes empty scatter test folders', async () => {
    const snapshots = await undoManager.getAllSnapshots();
    assert.strictEqual(snapshots.length, 1);
    const scatterSnapshot = snapshots[0];
    assert.strictEqual(scatterSnapshot.type, 'scatter');

    // Restore snapshot
    const restoreResult = await undoManager.restoreSnapshot(scatterSnapshot.id);
    assert.strictEqual(restoreResult.success, true);
    assert.strictEqual(restoreResult.restoredCount, 5);

    // Verify tree after restore
    const restoredTree = await mockApi.getTree();
    const bar = restoredTree[0].children[0];

    // Verify created scatter test folders were cleaned up bottom-up
    const testFolderA = bar.children.find(c => c.title === 'Old Folder A');
    const randomLinks = bar.children.find(c => c.title === 'Random Links');
    const unsorted = bar.children.find(c => c.title === 'Unsorted');
    assert.strictEqual(testFolderA, undefined, 'Old Folder A should be cleaned up on restore');
    assert.strictEqual(randomLinks, undefined, 'Random Links should be cleaned up on restore');
    assert.strictEqual(unsorted, undefined, 'Unsorted should be cleaned up on restore');

    // Verify all 5 bookmarks returned to their original parents
    const organizedFolder = bar.children.find(c => c.title === 'Organized Bookmarks');
    assert.ok(organizedFolder);
    const studyAbroad = organizedFolder.children.find(c => c.title === 'Study Abroad');
    assert.ok(studyAbroad);
    assert.strictEqual(studyAbroad.children.length, 3);
    assert.strictEqual(studyAbroad.children[0].id, '101');
    assert.strictEqual(studyAbroad.children[1].id, '102');
    assert.strictEqual(studyAbroad.children[2].id, '103');

    const aiFolder = organizedFolder.children.find(c => c.title === 'AI Technology');
    assert.ok(aiFolder);
    assert.strictEqual(aiFolder.children.length, 2);
    assert.strictEqual(aiFolder.children[0].id, '104');
    assert.strictEqual(aiFolder.children[1].id, '105');
  });
});

// =========================================================================
// SECTION 3: 25 SAMPLE TEST BOOKMARKS GENERATION & CLEANUP TESTS
// =========================================================================

test('BookmarkTreeManager - 25 Sample Bookmarks Injection & 1-Click Removal', async (t) => {
  const initialTree = [
    {
      id: '0',
      title: 'Root',
      children: [
        { id: '1', title: 'Bookmarks Bar', parentId: '0', children: [] },
        { id: '2', title: 'Other Bookmarks', parentId: '0', children: [] }
      ]
    }
  ];

  const mockApi = createMockBookmarksApi(initialTree);
  const mockStorage = createMockStorageArea();
  const treeManager = new BookmarkTreeManager(mockApi);
  const categorizer = new BookmarkCategorizer();

  await t.test('SAMPLE_TEST_BOOKMARKS contains exactly 25 realistic bookmarks across required diverse categories', () => {
    assert.strictEqual(SAMPLE_TEST_BOOKMARKS.length, 25, 'Must contain exactly 25 sample bookmarks');

    // Categorize all 25 sample bookmarks with the categorizer
    const categoriesSeen = new Set();
    for (const sample of SAMPLE_TEST_BOOKMARKS) {
      assert.ok(sample.title && sample.title.length > 5, `Sample bookmark has title: ${sample.title}`);
      assert.ok(sample.url && sample.url.startsWith('https://'), `Sample bookmark has valid URL: ${sample.url}`);
      assert.ok(sample.targetFolder, `Sample bookmark specifies targetFolder: ${sample.targetFolder}`);

      const cat = categorizer.categorize(sample);
      categoriesSeen.add(cat.categoryId);
    }

    // Verify required categories are represented: AI, Germany, Study Abroad, Gaming, Trading/Finance, Health
    assert.ok(categoriesSeen.has('ai_technology'), 'AI category represented');
    assert.ok(categoriesSeen.has('germany'), 'Germany category represented');
    assert.ok(categoriesSeen.has('study_abroad'), 'Study Abroad category represented');
    assert.ok(categoriesSeen.has('gaming'), 'Gaming category represented');
    assert.ok(categoriesSeen.has('finance'), 'Trading / Finance category represented');
    assert.ok(categoriesSeen.has('health_wellness'), 'Health & Wellness category represented');
  });

  await t.test('generates 25 sample bookmarks in scattered folders and tracks them in storage', async () => {
    const genResult = await treeManager.generateSampleBookmarks({
      targetRootParentId: '1',
      storage: mockStorage
    });

    assert.strictEqual(genResult.success, true);
    assert.strictEqual(genResult.count, 25);
    assert.strictEqual(genResult.createdBookmarks.length, 25);
    assert.ok(genResult.createdFolders.length > 0);

    const hasSamples = await treeManager.hasSampleBookmarks({ storage: mockStorage });
    assert.strictEqual(hasSamples, true);

    const scan = await treeManager.scanBookmarks();
    assert.strictEqual(scan.stats.totalBookmarks, 25);
  });

  await t.test('1-click removeSampleBookmarks completely deletes all 25 bookmarks and cleans up test folders', async () => {
    const remResult = await treeManager.removeSampleBookmarks({ storage: mockStorage });
    assert.strictEqual(remResult.success, true);
    assert.strictEqual(remResult.removedBookmarksCount, 25);
    assert.ok(remResult.removedFoldersCount > 0);

    const hasSamples = await treeManager.hasSampleBookmarks({ storage: mockStorage });
    assert.strictEqual(hasSamples, false);

    const scan = await treeManager.scanBookmarks();
    assert.strictEqual(scan.stats.totalBookmarks, 0, 'Zero bookmarks should remain after sample removal');

    // Verify test folders (Old Folder A, Random Links, Unsorted) were removed
    const tree = await mockApi.getTree();
    const bar = tree[0].children[0];
    const testFolderA = bar.children.find(c => c.title === 'Old Folder A');
    const randomLinks = bar.children.find(c => c.title === 'Random Links');
    const unsorted = bar.children.find(c => c.title === 'Unsorted');
    assert.strictEqual(testFolderA, undefined);
    assert.strictEqual(randomLinks, undefined);
    assert.strictEqual(unsorted, undefined);
  });
});

// =========================================================================
// SECTION 4: DEFAULT SETTINGS & STORAGE PERSISTENCE TESTS
// =========================================================================

test('SettingsManager - Default Settings and Hybrid Mode Persistence', async (t) => {
  const mockStorage = createMockStorageArea();
  const settingsManager = new SettingsManager(mockStorage);

  await t.test('defaults to hybrid groupingMode and hybridThreshold of 10', async () => {
    assert.strictEqual(DEFAULT_SETTINGS.groupingMode, 'hybrid');
    assert.strictEqual(DEFAULT_SETTINGS.hybridThreshold, 10);

    const settings = await settingsManager.getSettings();
    assert.strictEqual(settings.groupingMode, 'hybrid');
    assert.strictEqual(settings.hybridThreshold, 10);
    assert.strictEqual(settings.useSubcategories, true);
  });

  await t.test('saves and retrieves updated groupingMode and hybridThreshold', async () => {
    await settingsManager.saveSettings({
      groupingMode: 'flat',
      hybridThreshold: 15
    });

    const updated = await settingsManager.getSettings();
    assert.strictEqual(updated.groupingMode, 'flat');
    assert.strictEqual(updated.hybridThreshold, 15);
    assert.strictEqual(updated.useSubcategories, false, 'useSubcategories should sync to false when flat');
  });

  await t.test('resets cleanly back to defaults', async () => {
    await settingsManager.resetToDefaults();
    const reset = await settingsManager.getSettings();
    assert.strictEqual(reset.groupingMode, 'hybrid');
    assert.strictEqual(reset.hybridThreshold, 10);
  });
});

// =========================================================================
// SECTION 5: ADVANCED EDGE CASES & ROBUSTNESS
// =========================================================================

test('Advanced Edge Cases & Robustness - Clutter Interaction, Undo & Index Fallback', async (t) => {
  const categorizer = new BookmarkCategorizer();
  const treeManager = new BookmarkTreeManager();

  await t.test('clutter auto-split never creates subfolders when groupingMode is "flat"', () => {
    const rawBookmarks = [];
    for (let i = 0; i < 8; i++) {
      rawBookmarks.push({ id: `hf_${i}`, title: `AI Research Tool Hugging Face ${i}`, url: `https://huggingface.co/models/${i}` });
    }
    for (let i = 0; i < 8; i++) {
      rawBookmarks.push({ id: `cl_${i}`, title: `AI Assistant Anthropic Claude ${i}`, url: `https://claude.ai/chat/${i}` });
    }

    const plan = treeManager.buildProposedPlan(rawBookmarks, categorizer, {
      groupingMode: 'flat',
      autoSplitClutter: true
    });

    assert.strictEqual(plan.length, 16);
    for (const item of plan) {
      assert.strictEqual(item.proposedPath.length, 1, 'Must strictly remain flat without subfolders');
      assert.strictEqual(item.proposedSubcategoryName, null);
    }
  });

  await t.test('clutter auto-split never creates subfolders in hybrid mode when count is below hybridThreshold', () => {
    const rawBookmarks = [];
    for (let i = 0; i < 8; i++) {
      rawBookmarks.push({ id: `hf_${i}`, title: `AI Research Tool Hugging Face ${i}`, url: `https://huggingface.co/models/${i}` });
    }
    for (let i = 0; i < 8; i++) {
      rawBookmarks.push({ id: `cl_${i}`, title: `AI Assistant Anthropic Claude ${i}`, url: `https://claude.ai/chat/${i}` });
    }

    // 16 bookmarks with hybridThreshold set to 20 (< 20 must remain flat)
    const plan = treeManager.buildProposedPlan(rawBookmarks, categorizer, {
      groupingMode: 'hybrid',
      hybridThreshold: 20,
      autoSplitClutter: true
    });

    assert.strictEqual(plan.length, 16);
    for (const item of plan) {
      assert.strictEqual(item.proposedPath.length, 1, 'Category under hybridThreshold 20 must remain flat');
      assert.strictEqual(item.proposedSubcategoryName, null);
    }
  });

  await t.test('1-click restore on sample_generation snapshot removes all 25 sample bookmarks and test folders', async () => {
    const initialTree = [
      {
        id: '0',
        title: 'Root',
        children: [
          { id: '1', title: 'Bookmarks Bar', parentId: '0', children: [] }
        ]
      }
    ];

    const mockApi = createMockBookmarksApi(initialTree);
    const mockStorage = createMockStorageArea();
    const undoManager = new UndoManager(mockStorage, mockApi);
    const treeMgr = new BookmarkTreeManager(mockApi);

    // Generate samples with undoManager
    const genResult = await treeMgr.generateSampleBookmarks({ undoManager, storage: mockStorage });
    assert.strictEqual(genResult.count, 25);

    const snapshots = await undoManager.getAllSnapshots();
    assert.strictEqual(snapshots.length, 1);
    assert.strictEqual(snapshots[0].type, 'sample_generation');
    assert.strictEqual(snapshots[0].items.length, 25);

    // Now restore the sample_generation snapshot
    const restoreRes = await undoManager.restoreSnapshot(snapshots[0].id);
    assert.strictEqual(restoreRes.success, true);
    assert.strictEqual(restoreRes.restoredCount, 25);

    // Bookmarks should be 0 and test folders removed
    const scan = await treeMgr.scanBookmarks();
    assert.strictEqual(scan.stats.totalBookmarks, 0);

    const tree = await mockApi.getTree();
    const bar = tree[0].children[0];
    assert.strictEqual(bar.children.length, 0);
  });

  await t.test('restore handles out-of-bounds index by retrying move without index', async () => {
    const initialTree = [
      {
        id: '0',
        title: 'Root',
        children: [
          {
            id: '1',
            title: 'Bookmarks Bar',
            parentId: '0',
            children: [
              { id: '10', title: 'Folder X', parentId: '1', children: [] }
            ]
          }
        ]
      }
    ];

    const mockApi = createMockBookmarksApi(initialTree);
    // Wrap move to simulate Chrome's index out-of-bounds error
    const originalMove = mockApi.move;
    mockApi.move = async (id, destination) => {
      if (typeof destination.index === 'number' && destination.index > 5) {
        throw new Error('Index out of bounds.');
      }
      return originalMove(id, destination);
    };

    const mockStorage = createMockStorageArea();
    const undoManager = new UndoManager(mockStorage, mockApi);

    // Create a bookmark in Folder X
    const bm = await mockApi.create({ parentId: '10', title: 'Test Link', url: 'https://example.com' });

    // Snapshot records originalIndex = 15 (which will trigger out-of-bounds error on move)
    const snapshot = await undoManager.saveSnapshot(
      'Test Out of Bounds',
      [
        {
          id: bm.id,
          title: bm.title,
          url: bm.url,
          originalParentId: '1',
          originalIndex: 15,
          newParentId: '10'
        }
      ],
      []
    );

    // Move to '10' first
    await originalMove(bm.id, { parentId: '10' });

    // Now restore: the move with index: 15 will fail, but fallback without index should succeed
    const restoreRes = await undoManager.restoreSnapshot(snapshot.id);
    assert.strictEqual(restoreRes.success, true);
    assert.strictEqual(restoreRes.restoredCount, 1);

    const freshTree = await mockApi.getTree();
    const bar = freshTree[0].children[0];
    const restoredBm = bar.children.find(c => c.id === bm.id);
    assert.ok(restoredBm, 'Bookmark was safely restored to Bookmarks Bar despite index error');
  });

  await t.test('multi-round scatter and restore cleanly cleans up test folders', async () => {
    const initialTree = [
      {
        id: '0',
        title: 'Root',
        children: [
          {
            id: '1',
            title: 'Bookmarks Bar',
            parentId: '0',
            children: [
              { id: 'b1', title: 'Test Bookmark 1', url: 'https://b1.com', parentId: '1' },
              { id: 'b2', title: 'Test Bookmark 2', url: 'https://b2.com', parentId: '1' }
            ]
          }
        ]
      }
    ];

    const mockApi = createMockBookmarksApi(initialTree);
    const mockStorage = createMockStorageArea();
    const undoManager = new UndoManager(mockStorage, mockApi);
    const treeMgr = new BookmarkTreeManager(mockApi);

    // Round 1: scatter
    const s1 = await treeMgr.scatterBookmarks(null, { undoManager, targetRootParentId: '1' });
    assert.strictEqual(s1.success, true);

    // Round 2: scatter again while test folders already exist
    const s2 = await treeMgr.scatterBookmarks(null, { undoManager, targetRootParentId: '1' });
    assert.strictEqual(s2.success, true);

    // Restore round 2
    const snapshots = await undoManager.getAllSnapshots();
    const res = await undoManager.restoreSnapshot(snapshots[0].id);
    assert.strictEqual(res.success, true);

    // Also restore round 1
    const res1 = await undoManager.restoreSnapshot(snapshots[1].id);
    assert.strictEqual(res1.success, true);

    // Verify all bookmarks are back on Bookmarks Bar and test folders are gone
    const tree = await mockApi.getTree();
    const bar = tree[0].children[0];
    const folderA = bar.children.find(c => c.title === 'Old Folder A');
    const links = bar.children.find(c => c.title === 'Random Links');
    const unsorted = bar.children.find(c => c.title === 'Unsorted');
    assert.strictEqual(folderA, undefined);
    assert.strictEqual(links, undefined);
    assert.strictEqual(unsorted, undefined);
    assert.strictEqual(bar.children.filter(c => c.url).length, 2);
  });
});

