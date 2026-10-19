import test from 'node:test';
import assert from 'node:assert';
import { BookmarkCategorizer, TopicClusterer, ClutterSplitter } from '../core/categorizer.js';
import { BookmarkTreeManager } from '../core/bookmark-tree.js';
import { SettingsManager } from '../core/storage.js';

test('Expanded Taxonomy & Specific Target Categorization', async (t) => {
  const categorizer = new BookmarkCategorizer();

  const testCases = [
    { title: 'NVIDIA NIM Inference Microservice', url: 'https://build.nvidia.com/meta/llama-3_1-70b-instruct', expectedCat: 'ai_technology' },
    { title: 'ML Hive - Machine Learning Community & Hub', url: 'https://mlhive.com/resources', expectedCat: 'ai_technology' },
    { title: 'Gemini Notebook Research Assistant', url: 'https://notebooklm.google.com/notebook/123', expectedCat: 'ai_technology' },
    { title: 'UnAIMyText - Bypass AI Detectors', url: 'https://unaimytext.com/', expectedCat: 'ai_technology' },
    { title: 'Natively AI - Turn Web Apps into Native Mobile Apps', url: 'https://natively.ai/', expectedCat: 'ai_technology' },
    { title: 'Siber Koza Innovation and Acceleration Hub', url: 'https://siberkoza.com/programs', expectedCat: 'startups_innovation' },
    { title: 'TS Apply - Tristar Education Student Visa Portal', url: 'https://apply.tristar.com/dashboard', expectedCat: 'study_abroad' },
    { title: 'Times Consultant Study Abroad Advisory', url: 'https://timesconsultant.com/services', expectedCat: 'study_abroad' },
    { title: 'Luna Scholar Global Scholarship Opportunities', url: 'https://lunascholar.com/explore', expectedCat: 'study_abroad' },
    { title: 'Mitacs Globalink Research Internship', url: 'https://www.mitacs.ca/en/programs/globalink', expectedCat: 'study_abroad' },
    { title: 'The5ers Funded Trader & Prop Trading Program', url: 'https://the5ers.com/scaling-plan', expectedCat: 'finance' },
    { title: 'FBISE Maths Notes and Solved Class 12 Past Papers', url: 'https://fbise.edu.pk/notes/mathematics', expectedCat: 'education' },
    { title: 'MuscleWiki - Targeted Muscle Exercises & Workouts', url: 'https://musclewiki.com/biceps', expectedCat: 'health_wellness' },
    { title: 'Nutrifactor Dietary Supplements & Multivitamins', url: 'https://nutrifactor.com/products/vitamins', expectedCat: 'health_wellness' },
    { title: 'TEKKEN 8 PC Game Download & Patch Notes', url: 'https://tekken.com/tekken-8', expectedCat: 'gaming' },
    { title: 'Ettercap Network Sniffer and MITM Suite', url: 'https://www.ettercap-project.org/downloads', expectedCat: 'programming' },
    { title: 'Internet Download Manager (IDM) Extension', url: 'https://www.internetdownloadmanager.com/download.html', expectedCat: 'tools_productivity' },
    { title: 'XDA Developers Android ROMs & Kernel Tweaks', url: 'https://forum.xda-developers.com/c/samsung-galaxy.1234', expectedCat: 'programming' }
  ];

  for (const tc of testCases) {
    await t.test(`categorizes ${tc.title} into ${tc.expectedCat}`, () => {
      const res = categorizer.categorize({ title: tc.title, url: tc.url });
      assert.strictEqual(res.categoryId, tc.expectedCat, `Expected ${tc.expectedCat} for ${tc.title} but got ${res.categoryId}`);
      assert.ok(res.confidence === 'high' || res.confidence === 'medium', `Confidence should be high/medium, got ${res.confidence}`);
    });
  }

  await t.test('unrecognized bookmarks fall back to Uncategorized (Needs Review)', () => {
    const res = categorizer.categorize({
      title: 'Random Mystery Page 9872',
      url: 'https://unknown-domain-xyz-12345.org/test'
    });
    assert.strictEqual(res.categoryId, 'other');
    assert.strictEqual(res.categoryName, 'Uncategorized (Needs Review)');
    assert.strictEqual(res.confidence, 'none');
    assert.ok(res.tags.includes('#review'));
  });
});

test('TopicClusterer - Archetypes, Domain Clusters, and Bigram Discovery', async (t) => {
  const clusterer = new TopicClusterer();

  await t.test('matches topic archetypes for unclassified items', () => {
    const match = clusterer.matchSingleBookmark({
      title: 'Guide to Prompt Engineering and LLM Tuning',
      url: 'https://customsite.io/article'
    });
    assert.ok(match);
    assert.strictEqual(match.categoryTarget, 'AI & Technology');
    assert.ok(match.tags.includes('#ai'));
  });

  await t.test('clusters shared domain roots when frequency >= 2', () => {
    const items = [
      { id: '1', title: 'Portal Home', url: 'https://sub1.internalportal.net/home' },
      { id: '2', title: 'User Settings', url: 'https://sub2.internalportal.net/settings' }
    ];

    const clusters = clusterer.clusterBookmarks(items);
    assert.strictEqual(clusters.size, 2);
    assert.strictEqual(clusters.get('1').categoryName, 'Internalportal');
    assert.strictEqual(clusters.get('2').categoryName, 'Internalportal');
    assert.strictEqual(clusters.get('1').confidence, 'heuristic');
  });

  await t.test('clusters shared title bigrams when frequency >= 2', () => {
    const items = [
      { id: '10', title: 'Quantum Computing Fundamentals Chapter 1', url: 'https://alpha.org/ch1' },
      { id: '11', title: 'Quantum Computing Algorithms Deep Dive', url: 'https://beta.com/ch2' }
    ];

    const clusters = clusterer.clusterBookmarks(items);
    assert.strictEqual(clusters.size, 2);
    assert.strictEqual(clusters.get('10').categoryName, 'Quantum Computing');
    assert.strictEqual(clusters.get('11').categoryName, 'Quantum Computing');
  });

  await t.test('does NOT cluster a single bookmark with a repeated phrase in its title', () => {
    const items = [
      { id: '99', title: 'Deep Learning Review - Deep Learning Trends', url: 'https://single-item.org' }
    ];
    const clusters = clusterer.clusterBookmarks(items);
    assert.strictEqual(clusters.size, 0, 'Single bookmark must not be self-clustered');
  });

  await t.test('clusters 2-letter and 3-letter terms such as Web Development and API Documentation', () => {
    const items = [
      { id: 'w1', title: 'Web Development Basics', url: 'https://w1.io' },
      { id: 'w2', title: 'Web Development Advanced', url: 'https://w2.io' },
      { id: 'a1', title: 'API Documentation Best Practices', url: 'https://a1.io' },
      { id: 'a2', title: 'API Documentation Tools', url: 'https://a2.io' }
    ];
    const clusters = clusterer.clusterBookmarks(items);
    assert.strictEqual(clusters.size, 4);
    assert.strictEqual(clusters.get('w1').categoryName, 'Web Development');
    assert.strictEqual(clusters.get('a1').categoryName, 'Api Documentation');
  });
});

test('ClutterSplitter - Clutter Detection and Subfolder Splitting', async (t) => {
  const splitter = new ClutterSplitter();

  // Create 15 items in "Development" folder
  const planItems = [];
  for (let i = 1; i <= 15; i++) {
    const domain = i <= 8 ? 'github.com' : 'stackoverflow.com';
    planItems.push({
      id: `dev_${i}`,
      title: `Item ${i}`,
      url: `https://${domain}/page/${i}`,
      proposedFolderDisplay: 'Development',
      proposedPath: ['Development'],
      tags: i <= 8 ? ['#dev', '#github'] : ['#dev', '#stackoverflow']
    });
  }

  await t.test('detects folders exceeding threshold of 12', () => {
    const recs = splitter.detectClutter(planItems, 12);
    assert.strictEqual(recs.length, 1);
    assert.strictEqual(recs[0].folderName, 'Development');
    assert.strictEqual(recs[0].totalCount, 15);
    assert.ok(recs[0].subfolders.length >= 2);
  });

  await t.test('applies subfolder splits cleanly', () => {
    const recs = splitter.detectClutter(planItems, 12);
    splitter.applySplits(planItems, recs);

    const subfolders = new Set(planItems.map(p => p.proposedFolderDisplay));
    assert.ok(subfolders.size >= 2);
    assert.ok(planItems.every(p => p.proposedPath.length >= 2));
  });

  await t.test('properly splits hierarchical folders with pre-existing proposedSubcategoryName', () => {
    const hierItems = [];
    for (let i = 1; i <= 14; i++) {
      const domain = i <= 7 ? 'github.com' : 'gitlab.com';
      hierItems.push({
        id: `hier_${i}`,
        title: `Repo ${i}`,
        url: `https://${domain}/project/${i}`,
        proposedFolderDisplay: 'Programming / Repositories',
        proposedPath: ['Programming', 'Repositories'],
        proposedSubcategoryName: 'Repositories',
        tags: ['#dev', '#coding']
      });
    }

    const recs = splitter.detectClutter(hierItems, 12);
    assert.strictEqual(recs.length, 1);
    assert.strictEqual(recs[0].folderName, 'Programming / Repositories');
    assert.ok(recs[0].subfolders.length >= 2);
    assert.ok(recs[0].subfolders.some(s => s.name === 'Github'));
    assert.ok(recs[0].subfolders.some(s => s.name === 'Gitlab'));

    splitter.applySplits(hierItems, recs);
    assert.ok(hierItems.some(i => i.proposedFolderDisplay === 'Programming / Repositories / Github'));
    assert.ok(hierItems.some(i => i.proposedFolderDisplay === 'Programming / Repositories / Gitlab'));
  });

  await t.test('does not recommend splits when all bookmarks belong to an inseparable single group', () => {
    const singleGroupItems = [];
    for (let i = 1; i <= 15; i++) {
      singleGroupItems.push({
        id: `same_${i}`,
        title: `Same Title ${i}`,
        url: `https://single-domain.org/page/${i}`,
        proposedFolderDisplay: 'Programming / Repositories',
        proposedPath: ['Programming', 'Repositories'],
        proposedSubcategoryName: 'Repositories',
        tags: ['#dev']
      });
    }

    const recs = splitter.detectClutter(singleGroupItems, 12);
    assert.strictEqual(recs.length, 0, 'Should not recommend split if all items would fall in a single folder');
  });
});

test('Adaptive Local Learning - Learned Rules Override Default Heuristics', async (t) => {
  const categorizer = new BookmarkCategorizer();

  // Initially, github.com is categorized as programming
  const initial = categorizer.categorize({
    title: 'React Repository',
    url: 'https://github.com/facebook/react'
  });
  assert.strictEqual(initial.categoryId, 'programming');
  assert.strictEqual(Boolean(initial.isLearned), false);

  // User trains a learned rule: github.com should go to "AI & Technology / Code"
  categorizer.setLearnedRules([
    {
      pattern: 'github.com',
      type: 'domain',
      targetCategory: 'AI & Technology',
      targetPath: ['AI & Technology', 'Code'],
      targetFolder: 'AI & Technology / Code'
    }
  ]);

  const afterLearning = categorizer.categorize({
    title: 'React Repository',
    url: 'https://github.com/facebook/react'
  });

  assert.strictEqual(afterLearning.categoryId, 'ai_technology');
  assert.strictEqual(afterLearning.categoryName, 'AI & Technology');
  assert.strictEqual(afterLearning.subcategoryName, 'Code');
  assert.strictEqual(afterLearning.isLearned, true);
  // A legacy whole-site preference on a mixed-topic host needs page-level review.
  assert.strictEqual(afterLearning.confidence, 'medium');
  assert.strictEqual(afterLearning.score, 100);
});

test('SettingsManager - Learned Rules Persistence API', async (t) => {
  const memoryStore = {};
  const mockStorage = {
    get: async (keys) => {
      const res = {};
      if (Array.isArray(keys)) {
        for (const k of keys) res[k] = memoryStore[k];
      } else if (typeof keys === 'string') {
        res[keys] = memoryStore[keys];
      }
      return res;
    },
    set: async (items) => {
      Object.assign(memoryStore, items);
    }
  };

  const settingsMgr = new SettingsManager(mockStorage);

  await t.test('saves and retrieves learned rules', async () => {
    await settingsMgr.saveLearnedRule('example.com', 'Custom Category / Sub', 'domain');
    const rules = await settingsMgr.getLearnedRules();
    assert.strictEqual(rules.length, 1);
    assert.strictEqual(rules[0].pattern, 'example.com');
    assert.strictEqual(rules[0].targetCategory, 'Custom Category');
    assert.deepStrictEqual(rules[0].targetPath, ['Custom Category', 'Sub']);
  });

  await t.test('updates existing rule when saved again', async () => {
    await settingsMgr.saveLearnedRule('example.com', 'Updated Category', 'domain');
    const rules = await settingsMgr.getLearnedRules();
    assert.strictEqual(rules.length, 1);
    assert.strictEqual(rules[0].targetCategory, 'Updated Category');
  });

  await t.test('removes learned rule', async () => {
    await settingsMgr.removeLearnedRule('example.com');
    const rules = await settingsMgr.getLearnedRules();
    assert.strictEqual(rules.length, 0);
  });

  await t.test('clears all learned rules on reset', async () => {
    await settingsMgr.saveLearnedRule('a.com', 'Cat A', 'domain');
    await settingsMgr.saveLearnedRule('b.com', 'Cat B', 'domain');
    assert.strictEqual((await settingsMgr.getLearnedRules()).length, 2);

    await settingsMgr.resetToDefaults();
    assert.strictEqual((await settingsMgr.getLearnedRules()).length, 0);
  });

  await t.test('preserves slashes for keyword type rules', async () => {
    await settingsMgr.saveLearnedRule('CI/CD Pipelines', 'Programming / DevOps', 'keyword');
    const rules = await settingsMgr.getLearnedRules();
    const cicdRule = rules.find(r => r.pattern.includes('ci/cd'));
    assert.ok(cicdRule, 'Rule with slash pattern should exist');
    assert.strictEqual(cicdRule.pattern, 'ci/cd pipelines');
  });
});

test('Smart Tags Generation Across Categories', async (t) => {
  const categorizer = new BookmarkCategorizer();

  const aiRes = categorizer.categorize({ title: 'ChatGPT LLM Prompt', url: 'https://chatgpt.com/' });
  assert.ok(aiRes.tags.includes('#ai'));
  assert.ok(aiRes.tags.includes('#llm'));

  const gamingRes = categorizer.categorize({ title: 'PCSX2 PS2 Emulator', url: 'https://pcsx2.net/' });
  assert.ok(gamingRes.tags.includes('#gaming'));
  assert.ok(gamingRes.tags.includes('#emulator'));

  const visaRes = categorizer.categorize({ title: 'Tristar Student Visa Portal', url: 'https://apply.tristar.com/' });
  assert.ok(visaRes.tags.includes('#study'));
  assert.ok(visaRes.tags.includes('#visa'));

  const tradingRes = categorizer.categorize({ title: 'The5ers Funded Trader Prop Account', url: 'https://the5ers.com/' });
  assert.ok(tradingRes.tags.includes('#finance'));
  assert.ok(tradingRes.tags.includes('#trading'));

  const healthRes = categorizer.categorize({ title: 'MuscleWiki Bicep Workout', url: 'https://musclewiki.com/' });
  assert.ok(healthRes.tags.includes('#health'));
  assert.ok(healthRes.tags.includes('#fitness'));
});

test('BookmarkTreeManager integration with clustering and smart tags', async (t) => {
  const categorizer = new BookmarkCategorizer();
  const treeMgr = new BookmarkTreeManager();

  const rawBookmarks = [
    { id: 'b1', title: 'NVIDIA NIM Architecture', url: 'https://build.nvidia.com/models' },
    { id: 'b2', title: 'Unknown Alpha Service', url: 'https://unknown-service.net/a' },
    { id: 'b3', title: 'Unknown Beta Service', url: 'https://unknown-service.net/b' },
    { id: 'b4', title: 'Completely Unique Standalone Link 9999', url: 'https://unique-solitary-link.org/test' }
  ];

  const plan = treeMgr.buildProposedPlan(rawBookmarks, categorizer, { useSubcategories: true });

  assert.strictEqual(plan.length, 4);
  assert.ok(plan[0].tags.includes('#ai'));
  assert.strictEqual(plan[0].selected, true);

  // b2 and b3 should be clustered into 'Unknown-service' by TopicClusterer instead of left as 'other'
  assert.strictEqual(plan[1].proposedCategoryName, 'Unknown-service');
  assert.strictEqual(plan[2].proposedCategoryName, 'Unknown-service');
  assert.strictEqual(plan[1].confidence, 'heuristic');
  assert.strictEqual(plan[1].selected, true, 'Clustered items should be selected for organization');

  // b4 is truly unclassified and must NOT be pre-selected for moving into an Uncategorized folder
  assert.strictEqual(plan[3].proposedCategoryId, 'other');
  assert.strictEqual(plan[3].confidence, 'none');
  assert.strictEqual(plan[3].selected, false, 'Unclassified items must require explicit user review');

  // Verify flat mode flattens clustered items
  const flatPlan = treeMgr.buildProposedPlan(rawBookmarks, categorizer, { useSubcategories: false });
  assert.strictEqual(flatPlan[1].proposedPath.length, 1);
  assert.strictEqual(flatPlan[1].proposedSubcategoryName, null);
});
