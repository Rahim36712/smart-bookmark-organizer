import test from 'node:test';
import assert from 'node:assert/strict';
import { BookmarkCategorizer } from '../core/categorizer.js';
import { BookmarkTreeManager } from '../core/bookmark-tree.js';
import { SettingsManager } from '../core/storage.js';
import { needsBookmarkReview, assignReviewedFolder } from '../core/classification-evidence.js';
import { executeOrganization } from '../ui/dashboard.js';

test('shared hosts follow the page topic instead of the platform category', () => {
  const categorizer = new BookmarkCategorizer();
  for (const [title, url, category] of [
    ['Python programming tutorial', 'https://www.youtube.com/watch?v=abc', 'programming'],
    ['Machine learning with PyTorch and LLM models', 'https://github.com/example/llm-course', 'ai_technology'],
    ['Forex trading strategies', 'https://www.reddit.com/r/forex/comments/abc', 'finance'],
    ['Workout exercises and fitness', 'https://www.youtube.com/watch?v=xyz', 'health_wellness']
  ]) assert.equal(categorizer.categorize({ title, url }).categoryId, category, title);
});

test('tracking parameters and domain lookalikes cannot create confident matches', () => {
  const categorizer = new BookmarkCategorizer();
  assert.equal(categorizer.categorize({ title: 'Saved page', url: 'https://example.org/?utm_campaign=forex-trading' }).categoryId, 'other');
  const lookalike = categorizer.categorize({ title: 'Dashboard', url: 'https://github.com.evil.example/' });
  assert.notEqual(lookalike.confidence, 'high');
  assert.doesNotMatch(lookalike.matchReason, /Primary developer hub|Domain match/);
  assert.equal(categorizer.clusterer.matchSingleBookmark({ title: 'Saved page', url: 'https://example.org/?ref=mitacs.ca' }), null);
  assert.equal(categorizer.categorize({ title: 'Python AI', url: 'chrome://bookmarks/' }).confidence, 'none');
});

test('close category scores require review even with many keyword matches', () => {
  const categorizer = new BookmarkCategorizer([
    { id: 'one', name: 'One', titleKeywords: ['alpha', 'beta', 'gamma'] },
    { id: 'two', name: 'Two', titleKeywords: ['alpha', 'beta', 'gamma'] }
  ]);
  const result = categorizer.categorize({ title: 'alpha beta gamma', url: 'https://example.org/' });
  assert.equal(result.confidence, 'medium');
  assert.equal(result.alternatives[0].categoryName, 'Two');
});

test('page corrections preserve URL identity and do not train the whole host', async () => {
  const data = {};
  const settings = new SettingsManager({ get: async key => ({ [key]: data[key] }), set: async value => Object.assign(data, value) });
  await settings.saveLearnedRule('https://youtube.com/watch?v=ABC&utm_source=test', ['Education'], 'url');
  await settings.saveLearnedRule('youtube.com', ['Entertainment'], 'domain');
  const categorizer = new BookmarkCategorizer(undefined, { learnedRules: await settings.getLearnedRules() });
  const corrected = categorizer.categorize({ title: 'Lesson', url: 'https://www.youtube.com/watch?utm_source=other&v=ABC' });
  assert.equal(corrected.categoryName, 'Education');
  assert.equal(corrected.confidence, 'high');
  const different = categorizer.categorize({ title: 'Other video', url: 'https://youtube.com/watch?v=abc' });
  assert.equal(different.categoryName, 'Entertainment');
  assert.equal(different.confidence, 'medium');
});

test('review choice selects the exact folder and leave-in-place suppresses repeated prompts', () => {
  const item = { confidence: 'medium', proposedCategoryId: 'programming', selected: false };
  assert.equal(needsBookmarkReview(item), true);
  assignReviewedFolder(item, ['Programming', 'Python'], [{ id: 'programming', name: 'Programming' }]);
  assert.equal(item.selected, true);
  assert.equal(needsBookmarkReview(item), false);
  assert.deepEqual(item.proposedPath, ['Programming', 'Python']);
  assert.equal(needsBookmarkReview({ confidence: 'none', reviewDecision: 'keep' }), false);
  assert.equal(needsBookmarkReview({ confidence: 'medium', isAlreadyOrganized: true }), false);
});

test('rescan preserves an explicitly chosen page subfolder even in small groups', () => {
  const categorizer = new BookmarkCategorizer(undefined, { learnedRules: [
    { type: 'url', pattern: 'https://example.com/scholarship', targetPath: ['Study Abroad', 'Scholarships & Funding'] }
  ] });
  for (const groupingMode of ['flat', 'hybrid']) {
    const [item] = new BookmarkTreeManager().buildProposedPlan([
      { id: '1', title: 'Scholarship', url: 'https://example.com/scholarship', parentId: '1' }
    ], categorizer, { groupingMode });
    assert.deepEqual(item.proposedPath, ['Study Abroad', 'Scholarships & Funding']);
  }
});

test('AI uncertainty and conflict are reviewed; saved page corrections override AI', async () => {
  const tree = new BookmarkTreeManager();
  const bookmarks = [{ id: '1', title: 'OpenAI ChatGPT', url: 'https://chatgpt.com', parentId: '1' }];
  const ai = { isConfigured: () => true, categorizeAll: async () => [{ id: '1', category: 'Shopping', confidence: 'high' }] };
  const categorizer = new BookmarkCategorizer();
  const [conflict] = await tree.buildProposedPlanWithAi(bookmarks, categorizer, ai, { useClustering: false });
  assert.equal(conflict.confidence, 'medium');
  assert.equal(conflict.alternatives[0].categoryName, 'AI & Technology');
  categorizer.setLearnedRules([{ type: 'url', pattern: bookmarks[0].url, targetPath: ['Research'] }]);
  const [corrected] = await tree.buildProposedPlanWithAi(bookmarks, categorizer, ai, { useClustering: false });
  assert.equal(corrected.proposedCategoryName, 'Research');
  assert.equal(corrected.isLearned, true);
});

test('unclassified selection cannot create a Needs Review folder during organization', async () => {
  let called = false;
  const result = await executeOrganization([{ proposedCategoryId: 'other', confidence: 'none' }], {
    managers: { treeManager: { executePlan: async () => { called = true; } } }
  });
  assert.equal(result.success, false);
  assert.equal(called, false);
});
