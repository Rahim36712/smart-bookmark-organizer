/**
 * Categorization Engine for Chrome Bookmarks
 * 100% offline, privacy-first heuristic classification using
 * domain taxonomy, keyword weighting, Unicode NLP tokenization, and compound rules.
 */

import { DEFAULT_CATEGORIES, OTHER_CATEGORY } from './default-rules.js';
import { isSharedPlatform, normalizeBookmarkUrl } from './classification-evidence.js';

export const TOPIC_ARCHETYPES = [
  {
    id: 'modern_ai_tools',
    topic: 'Modern AI Tools',
    icon: '🤖',
    color: '#8338ec',
    categoryTarget: 'AI & Technology',
    targetPath: ['AI & Technology', 'Modern AI Tools & LLMs'],
    tags: ['#ai', '#tools'],
    keywords: [
      'nvidia nim', 'nim', 'ml hive', 'mlhive', 'notebooklm', 'gemini notebook',
      'unaimytext', 'humanize ai', 'natively', 'bypass ai', 'llm', 'ai tool',
      'chatgpt', 'claude', 'hugging face', 'generative ai', 'prompt', 'deepseek', 'cursor'
    ],
    domains: ['build.nvidia.com', 'mlhive.com', 'notebooklm.google.com', 'unaimytext.com', 'natively.ai', 'deepseek.com']
  },
  {
    id: 'startups_innovation',
    topic: 'Startups & Innovation',
    icon: '🚀',
    color: '#f72585',
    categoryTarget: 'Startups & Innovation',
    targetPath: ['Startups & Innovation', 'Incubators & Hubs'],
    tags: ['#startup', '#innovation'],
    keywords: [
      'startup', 'siber koza', 'siberkoza', 'incubator', 'accelerator', 'innovation hub',
      'entrepreneurship', 'pitch deck', 'founder', 'seed funding', 'venture capital',
      'angel investor', 'series a', 'startup ideas'
    ],
    domains: ['siberkoza.com', 'innovationhub.pk', 'ycombinator.com', 'techstars.com']
  },
  {
    id: 'gaming_emulators',
    topic: 'Gaming & Emulators',
    icon: '🎮',
    color: '#7209b7',
    categoryTarget: 'Gaming & Emulators',
    targetPath: ['Gaming & Emulators', 'Emulators & ROMs'],
    tags: ['#gaming', '#emulator'],
    keywords: [
      'tekken', 'emulator', 'emulators', 'rom', 'roms', 'game download', 'pc games',
      'fitgirl', 'dodi', 'steam', 'retroarch', 'pcsx2', 'rpcs3', 'ppsspp', 'gameplay',
      'oceanofgames', 'game repack'
    ],
    domains: ['tekken.com', 'steampowered.com', 'fitgirl-repacks.site', 'dodi-repacks.site', 'retroarch.com', 'pcsx2.net']
  },
  {
    id: 'trading_finance',
    topic: 'Trading & Finance',
    icon: '📈',
    color: '#06d6a0',
    categoryTarget: 'Finance',
    targetPath: ['Finance', 'Trading & Prop Firms'],
    tags: ['#trading', '#finance'],
    keywords: [
      'the5ers', '5ers', 'trader zone', 'prop trading', 'funded trader', 'funded account',
      'forex', 'mt4', 'mt5', 'tradingview', 'candlestick', 'crypto trading', 'scalping'
    ],
    domains: ['the5ers.com', 'tradingview.com', 'ftmo.com']
  },
  {
    id: 'study_abroad_visas',
    topic: 'Study Abroad / Visas',
    icon: '✈️',
    color: '#028090',
    categoryTarget: 'Study Abroad',
    targetPath: ['Study Abroad', 'Visas & Immigration Portals'],
    tags: ['#visa', '#study'],
    keywords: [
      'tristar', 'ts apply', 'times consultant', 'luna scholar', 'mitacs',
      'globalink', 'student visa', 'visa consultant', 'visa application', 'study abroad',
      'vfs global', 'ds-160', 'study visa'
    ],
    domains: ['tristareducation.com', 'timesconsultant.com', 'lunascholar.com', 'mitacs.ca', 'vfsglobal.com']
  },
  {
    id: 'academic_notes',
    topic: 'Academic Notes',
    icon: '📝',
    color: '#2a9d8f',
    categoryTarget: 'Education',
    targetPath: ['Education', 'Academic Notes & Solved Papers'],
    tags: ['#notes', '#study'],
    keywords: [
      'fbise', 'federal board', 'maths notes', 'math notes', 'solved papers',
      'past papers', 'class notes', 'formula sheet', 'class 11', 'class 12',
      'model papers', 'board exam'
    ],
    domains: ['fbise.edu.pk', 'classnotes.xyz', 'mathcity.org', 'ilmkidunya.com']
  },
  {
    id: 'health_fitness',
    topic: 'Health & Fitness',
    icon: '💪',
    color: '#588157',
    categoryTarget: 'Health & Fitness',
    targetPath: ['Health & Fitness', 'Workouts & Exercises'],
    tags: ['#health', '#fitness'],
    keywords: [
      'musclewiki', 'nutrifactor', 'workout', 'exercises', 'supplements',
      'multivitamin', 'hypertrophy', 'gym', 'calisthenics', 'brain function',
      'whey protein', 'nootropics'
    ],
    domains: ['musclewiki.com', 'nutrifactor.com', 'examine.com']
  }
];

/**
 * Local Topic Clustering Engine
 * Groups unclassified bookmarks by discovering shared semantic topics,
 * common domain stems, or recurring n-gram phrases.
 */
export class TopicClusterer {
  constructor(archetypes = TOPIC_ARCHETYPES) {
    this.archetypes = archetypes;
  }

  /**
   * Match a single bookmark against topic archetypes
   */
  matchSingleBookmark(bookmark) {
    if (!bookmark || !bookmark.url) return null;
    let parsed;
    try { parsed = new URL(bookmark.url); } catch { return null; }
    if (!['https:', 'http:'].includes(parsed.protocol)) return null;
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const url = `${hostname} ${parsed.pathname}`.toLowerCase();
    const title = (bookmark.title || '').toLowerCase();
    const full = `${title} ${url}`;

    for (const arch of this.archetypes) {
      if (arch.domains) {
        for (const dom of arch.domains) {
          if (hostname === dom || hostname.endsWith('.' + dom)) {
            return {
              id: arch.id,
              topic: arch.topic,
              categoryTarget: arch.categoryTarget,
              targetPath: arch.targetPath,
              icon: arch.icon,
              color: arch.color,
              tags: arch.tags,
              matchReason: `Topic cluster match: ${dom}`
            };
          }
        }
      }

      if (arch.keywords) {
        for (const kw of arch.keywords) {
          if (hasWordOrPhrase(full, kw)) {
            return {
              id: arch.id,
              topic: arch.topic,
              categoryTarget: arch.categoryTarget,
              targetPath: arch.targetPath,
              icon: arch.icon,
              color: arch.color,
              tags: arch.tags,
              matchReason: `Topic cluster keyword: "${kw}"`
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Cluster a collection of unclassified or low-confidence bookmarks.
   */
  clusterBookmarks(items) {
    const assignments = new Map();
    const unassigned = [];

    // Stage 1: Archetype matching
    for (const item of items) {
      const match = this.matchSingleBookmark(item);
      if (match) {
        assignments.set(item.id, {
          categoryName: match.categoryTarget,
          proposedPath: match.targetPath,
          proposedFolderDisplay: match.targetPath.join(' / '),
          confidence: 'medium',
          score: 48,
          icon: match.icon,
          color: match.color,
          matchReason: `Topic Clustering: ${match.topic}`,
          tags: match.tags
        });
      } else {
        unassigned.push(item);
      }
    }

    // Stage 2: Discover shared domain roots among remaining items (distinct items count >= 2)
    const domainGroups = new Map();
    for (const item of unassigned) {
      try {
        const u = new URL(item.url);
        const root = extractDomainRoot(u.hostname);
        if (root && root.length >= 2) {
          if (!domainGroups.has(root)) domainGroups.set(root, new Map());
          domainGroups.get(root).set(item.id, item);
        }
      } catch {}
    }

    for (const [root, itemMap] of domainGroups.entries()) {
      if (itemMap.size >= 2) {
        const folderName = capitalize(root);
        for (const item of itemMap.values()) {
          if (!assignments.has(item.id)) {
            assignments.set(item.id, {
              categoryName: folderName,
              proposedPath: [folderName],
              proposedFolderDisplay: folderName,
              confidence: 'heuristic',
              score: 35,
              icon: '🌐',
              color: '#3a86ff',
              matchReason: `Clustered by shared domain: ${root}`,
              tags: [`#${root}`]
            });
          }
        }
      }
    }

    // Stage 3: Discover shared title bigrams (distinct items count >= 2)
    const phraseGroups = new Map();
    const stopWords = new Set([
      'the', 'and', 'for', 'with', 'from', 'this', 'that', 'your', 'free',
      'online', 'download', 'home', 'page', 'official', 'about', 'guide',
      'tutorial', 'best', 'more', 'view', 'read', 'into', 'over', 'under',
      'in', 'on', 'at', 'to', 'is', 'it', 'by', 'as', 'or', 'an', 'if',
      'my', 'we', 'do', 'no', 'so', 'up', 'all', 'can', 'get', 'has',
      'how', 'its', 'let', 'may', 'new', 'now', 'off', 'old', 'one',
      'our', 'see', 'set', 'too', 'top', 'use', 'way', 'who', 'why'
    ]);

    for (const item of unassigned) {
      if (assignments.has(item.id)) continue;
      const tokens = (item.title || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 2 && !stopWords.has(w));

      const seenBigramsForThisItem = new Set();
      for (let i = 0; i < tokens.length - 1; i++) {
        const bigram = `${tokens[i]} ${tokens[i + 1]}`;
        if (!seenBigramsForThisItem.has(bigram)) {
          seenBigramsForThisItem.add(bigram);
          if (!phraseGroups.has(bigram)) phraseGroups.set(bigram, new Map());
          phraseGroups.get(bigram).set(item.id, item);
        }
      }
    }

    const sortedPhrases = Array.from(phraseGroups.entries())
      .filter(([_, map]) => map.size >= 2)
      .sort((a, b) => b[1].size - a[1].size);

    for (const [phrase, itemMap] of sortedPhrases) {
      const folderName = phrase.split(' ').map(capitalize).join(' ');
      for (const item of itemMap.values()) {
        if (!assignments.has(item.id)) {
          assignments.set(item.id, {
            categoryName: folderName,
            proposedPath: [folderName],
            proposedFolderDisplay: folderName,
            confidence: 'heuristic',
            score: 30,
            icon: '📑',
            color: '#4361ee',
            matchReason: `Clustered by shared topic: "${phrase}"`,
            tags: [`#${phrase.replace(/\s+/g, '-')}`]
          });
        }
      }
    }

    return assignments;
  }
}

/**
 * Clutter Auto-Splitter
 * Analyzes folders with >12 bookmarks and detects logical sub-themes.
 */
export class ClutterSplitter {
  detectClutter(planItems, threshold = 12) {
    const folderGroups = new Map();

    for (const item of planItems) {
      if (item.selected === false) continue;
      const folder = item.proposedFolderDisplay || (item.proposedPath ? item.proposedPath.join(' / ') : 'Uncategorized');
      if (!folderGroups.has(folder)) {
        folderGroups.set(folder, []);
      }
      folderGroups.get(folder).push(item);
    }

    const recommendations = [];

    for (const [folderName, items] of folderGroups.entries()) {
      if (items.length > threshold) {
        const subfolderClusters = this.clusterFolderItems(items, folderName);
        if (subfolderClusters && subfolderClusters.length >= 2) {
          recommendations.push({
            folderName,
            totalCount: items.length,
            threshold,
            reason: `Folder contains ${items.length} bookmarks (exceeds recommended maximum of ${threshold})`,
            subfolders: subfolderClusters
          });
        }
      }
    }

    return recommendations;
  }

  clusterFolderItems(items, parentFolderName) {
    const subGroups = new Map();
    const domainCounts = new Map();
    const parentSegments = parentFolderName.split(' / ').map(s => s.trim().toLowerCase());
    const lastParentSegment = parentSegments[parentSegments.length - 1] || '';

    // Count domain occurrences across items
    for (const item of items) {
      let domainRoot = '';
      try {
        const url = new URL(item.url);
        domainRoot = extractDomainRoot(url.hostname);
      } catch {}

      if (domainRoot) {
        domainCounts.set(domainRoot, (domainCounts.get(domainRoot) || 0) + 1);
      }
    }

    const frequentDomains = new Set();
    for (const [dom, count] of domainCounts.entries()) {
      if (count >= 2) frequentDomains.add(dom);
    }

    for (const item of items) {
      let subName = null;
      try {
        const url = new URL(item.url);
        const root = extractDomainRoot(url.hostname);
        if (frequentDomains.has(root)) {
          subName = capitalize(root);
        }
      } catch {}

      if (!subName) {
        // Find a tag that does not simply duplicate the parent folder name
        const primaryTag = (item.tags || []).find(t => {
          const clean = t.replace(/^#/, '').toLowerCase();
          return clean !== 'review' && !parentSegments.includes(clean);
        });
        if (primaryTag) {
          subName = capitalize(primaryTag.replace(/^#/, ''));
        } else {
          subName = 'General';
        }
      }

      // Avoid creating a subfolder that repeats the exact parent segment
      if (subName.toLowerCase() === lastParentSegment) {
        subName = 'General';
      }

      if (!subGroups.has(subName)) subGroups.set(subName, []);
      subGroups.get(subName).push(item.id);
    }

    // A split must produce at least 2 distinct subfolders
    if (subGroups.size < 2) {
      return [];
    }

    return Array.from(subGroups.entries()).map(([subName, bookmarkIds]) => ({
      name: subName,
      fullPath: `${parentFolderName} / ${subName}`,
      count: bookmarkIds.length,
      bookmarkIds
    }));
  }

  applySplits(planItems, recommendations) {
    const idToSplitMap = new Map();
    for (const rec of recommendations) {
      for (const sub of rec.subfolders) {
        for (const id of sub.bookmarkIds) {
          idToSplitMap.set(id, {
            subName: sub.name,
            fullPath: sub.fullPath
          });
        }
      }
    }

    for (const item of planItems) {
      if (idToSplitMap.has(item.id)) {
        const split = idToSplitMap.get(item.id);
        item.proposedSubcategoryName = split.subName;
        item.proposedFolderDisplay = split.fullPath;
        item.proposedPath = split.fullPath.split(' / ');
      }
    }

    return planItems;
  }
}

export class BookmarkCategorizer {
  constructor(categories = DEFAULT_CATEGORIES, options = {}) {
    this.categories = categories;
    this.options = {
      useSubcategories: true,
      minScoreThreshold: 15,
      ...options
    };
    if (this.options.groupingMode === 'flat') {
      this.options.useSubcategories = false;
    }
    this.learnedRules = options.learnedRules || [];
    this.clusterer = new TopicClusterer();
    this.clutterSplitter = new ClutterSplitter();
  }

  /**
   * Update active learned rules
   */
  setLearnedRules(rules) {
    this.learnedRules = Array.isArray(rules) ? rules : [];
  }

  /**
   * Safe URL decoder that does not throw URIError on malformed percent sequences
   */
  safeDecode(str) {
    if (!str) return '';
    try {
      return decodeURIComponent(str);
    } catch {
      return str;
    }
  }

  /**
   * Parse and extract components from a URL safely
   */
  parseUrl(urlString) {
    if (!urlString || typeof urlString !== 'string') {
      return { hostname: '', pathname: '', search: '', tld: '', valid: false };
    }
    try {
      const url = new URL(urlString);
      const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
      const pathname = this.safeDecode(url.pathname).toLowerCase();
      // Ignore tracking tokens, video IDs, and referral URLs as topic evidence.
      const search = ['q', 'query', 'search'].map(key => url.searchParams.get(key) || '').join(' ').toLowerCase();
      const tld = hostname.includes('.') ? '.' + hostname.split('.').pop() : '';
      return { hostname, pathname, search, tld, valid: ['http:', 'https:'].includes(url.protocol) };
    } catch {
      return { hostname: '', pathname: '', search: '', tld: '', valid: false };
    }
  }

  /**
   * Tokenize text into words, removing punctuation
   */
  tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s\-_.]/gu, ' ')
      .split(/[\s\-_/]+/)
      .filter(w => w.length > 1);
  }

  /**
   * Checks if string contains a keyword with full Unicode letter/number boundary awareness
   */
  hasKeyword(text, keyword) {
    return hasWordOrPhrase(text, keyword);
  }

  /**
   * Generate clean contextual smart tags for a bookmark
   */
  generateSmartTags(bookmark, result = {}) {
    if (!bookmark) return [];
    const tags = new Set();
    const text = `${bookmark.title || ''} ${bookmark.url || ''}`.toLowerCase();
    const catId = result.categoryId || '';
    const catName = (result.categoryName || '').toLowerCase();

    // Category tags
    if (catId === 'ai_technology' || catName.includes('ai') || catName.includes('modern ai')) {
      tags.add('#ai');
      if (this.hasKeyword(text, 'llm') || this.hasKeyword(text, 'gpt') || this.hasKeyword(text, 'claude')) tags.add('#llm');
    }
    if (catId === 'study_abroad' || catName.includes('study abroad') || catName.includes('visa')) {
      tags.add('#study');
      if (this.hasKeyword(text, 'visa') || this.hasKeyword(text, 'embassy') || this.hasKeyword(text, 'consultant')) tags.add('#visa');
    }
    if (catId === 'programming' || catName.includes('programming')) {
      tags.add('#dev');
      tags.add('#coding');
    }
    if (catId === 'finance' || catName.includes('finance') || catName.includes('trading')) {
      tags.add('#finance');
      if (this.hasKeyword(text, 'trading') || this.hasKeyword(text, 'prop') || this.hasKeyword(text, 'forex') || this.hasKeyword(text, 'the5ers')) tags.add('#trading');
    }
    if (catId === 'startups_innovation' || catName.includes('startup') || catName.includes('innovation')) {
      tags.add('#startup');
      tags.add('#innovation');
    }
    if (catId === 'gaming' || catName.includes('gaming') || catName.includes('emulator')) {
      tags.add('#gaming');
      if (this.hasKeyword(text, 'emulator') || this.hasKeyword(text, 'rom') || this.hasKeyword(text, 'iso') || this.hasKeyword(text, 'repack')) tags.add('#emulator');
    }
    if (catId === 'health_wellness' || catName.includes('health') || catName.includes('fitness')) {
      tags.add('#health');
      tags.add('#fitness');
    }
    if (catId === 'education' || catName.includes('education') || catName.includes('academic notes')) {
      tags.add('#education');
      if (this.hasKeyword(text, 'notes') || this.hasKeyword(text, 'solved papers') || this.hasKeyword(text, 'fbise')) tags.add('#notes');
    }
    if (catId === 'research' || catName.includes('research')) {
      tags.add('#research');
    }
    if (catId === 'entertainment' || catName.includes('entertainment')) {
      tags.add('#entertainment');
    }
    if (catId === 'tools_productivity' || catName.includes('tools')) {
      tags.add('#tools');
    }

    // Specific entity tags
    if (this.hasKeyword(text, 'nvidia') || this.hasKeyword(text, 'nim')) tags.add('#nvidia');
    if (this.hasKeyword(text, 'the5ers') || this.hasKeyword(text, '5ers')) tags.add('#trading');
    if (this.hasKeyword(text, 'tekken')) tags.add('#gaming');
    if (this.hasKeyword(text, 'musclewiki') || this.hasKeyword(text, 'workout')) tags.add('#fitness');
    if (this.hasKeyword(text, 'nutrifactor') || this.hasKeyword(text, 'vitamins')) tags.add('#health');
    if (this.hasKeyword(text, 'github')) tags.add('#github');
    if (this.hasKeyword(text, 'youtube')) tags.add('#video');
    if (this.hasKeyword(text, 'germany') || this.hasKeyword(text, 'deutschland')) tags.add('#germany');

    if (tags.size === 0) {
      if (result.categoryId && result.categoryId !== 'other') {
        tags.add('#' + result.categoryId.replace(/^topic_/, '').replace(/_/g, '-'));
      } else {
        tags.add('#review');
      }
    }

    return Array.from(tags).slice(0, 4);
  }

  /**
   * Categorize a single bookmark
   * @param {Object} bookmark - { url, title, folderPath }
   * @returns {Object} Categorization result
   */
  categorize(bookmark) {
    if (!bookmark || !bookmark.url) {
      return this.createFallbackResult('Invalid bookmark or missing URL');
    }

    const { hostname, pathname, search, tld, valid } = this.parseUrl(bookmark.url);
    if (!valid) return this.createFallbackResult('Internal or unsupported link: choose a folder manually');
    const sharedPlatform = isSharedPlatform(hostname);
    const title = bookmark.title || '';
    const fullUrl = `${hostname} ${pathname} ${search}`;
    const fullText = `${title} ${fullUrl}`;
    const folderHint = (bookmark.folderPath || []).join(' ').toLowerCase();

    // 1. Check Adaptive Learned Rules FIRST
    if (this.learnedRules && this.learnedRules.length > 0) {
      // A page-specific correction takes precedence over a broad website rule.
      const orderedRules = [...this.learnedRules].sort((a, b) => Number(b?.type === 'url') - Number(a?.type === 'url'));
      for (const rule of orderedRules) {
        if (!rule || !rule.pattern) continue;
        const pat = rule.pattern.toLowerCase();
        let matched = false;

        if (rule.type === 'url') {
          matched = normalizeBookmarkUrl(bookmark.url) === normalizeBookmarkUrl(rule.pattern);
        } else if (rule.type === 'domain' || (!rule.type && pat.includes('.'))) {
          matched = hostname === pat || hostname.endsWith('.' + pat);
        } else {
          matched = this.hasKeyword(fullText, pat);
        }

        if (matched) {
          const targetPath = Array.isArray(rule.targetPath) && rule.targetPath.length > 0
            ? rule.targetPath
            : (rule.targetFolder ? rule.targetFolder.split(' / ') : [rule.targetCategory || 'Custom']);

          const catObj = this.categories.find(c => c.name.toLowerCase() === targetPath[0].toLowerCase());
          const categoryName = catObj ? catObj.name : targetPath[0];
          const subcategoryName = targetPath[1] || null;

          const res = {
            categoryId: catObj ? catObj.id : 'learned',
            categoryName,
            subcategoryId: subcategoryName ? 'learned_sub' : null,
            subcategoryName,
            fullCategoryPath: targetPath,
            folderName: targetPath.join(' / '),
            confidence: sharedPlatform && rule.type === 'domain' ? 'medium' : 'high',
            score: 100,
            matchReason: `Learned preference for "${rule.pattern}"${sharedPlatform && rule.type === 'domain' ? '; website-wide rule: review this page’s topic' : ''}`,
            icon: catObj ? (catObj.icon || '🧠') : '🧠',
            color: catObj ? (catObj.color || '#4361ee') : '#4361ee',
            isLearned: true,
            preserveChosenPath: rule.type === 'url'
          };
          res.tags = this.generateSmartTags(bookmark, res);
          return res;
        }
      }
    }

    let bestCategory = null;
    let highestScore = 0;
    let bestReasons = [];
    const candidates = [];

    for (const category of this.categories) {
      let score = 0;
      const reasons = [];

      // 1. Domain match (Weight: 50)
      if (hostname && category.domains) {
        for (const dom of category.domains) {
          const cleanDom = dom.toLowerCase().replace(/^www\./, '');
          if (hostname === cleanDom || hostname.endsWith('.' + cleanDom)) {
            score += sharedPlatform ? 10 : 50;
            reasons.push(`Domain match: ${dom}`);
            break;
          }
        }
      }

      // 2. TLD match (Weight: 15)
      if (tld && category.tlds && category.tlds.includes(tld)) {
        score += 15;
        reasons.push(`TLD match: ${tld}`);
      }

      // 3. Title Keywords match (Weight: 20 per match, up to 60)
      if (category.titleKeywords) {
        let titleMatches = 0;
        for (const kw of category.titleKeywords) {
          if (this.hasKeyword(title, kw)) {
            score += 20;
            titleMatches++;
            reasons.push(`Title keyword: "${kw}"`);
            if (titleMatches >= 3) break;
          }
        }
      }

      // 4. URL Keywords match (Weight: 15 per match, up to 45)
      if (category.urlKeywords) {
        let urlMatches = 0;
        for (const kw of category.urlKeywords) {
          if (this.hasKeyword(fullUrl, kw)) {
            score += 15;
            urlMatches++;
            reasons.push(`URL keyword: "${kw}"`);
            if (urlMatches >= 3) break;
          }
        }
      }

      // 5. Existing Folder Hint (Weight: 15 for name match, 10 for keyword match)
      if (folderHint) {
        if (this.hasKeyword(folderHint, category.name)) {
          score += 5;
          reasons.push(`Folder context: "${category.name}"`);
        } else if (category.titleKeywords) {
          for (const kw of category.titleKeywords) {
            if (this.hasKeyword(folderHint, kw)) {
              score += 8;
              reasons.push(`Folder keyword: "${kw}"`);
              break;
            }
          }
        }
      }

      // 6. Compound Rules and Disambiguation
      // Special boost for Germany
      if (category.id === 'germany') {
        if (tld === '.de' && (this.hasKeyword(fullText, 'study') || this.hasKeyword(fullText, 'university') || this.hasKeyword(fullText, 'visa') || this.hasKeyword(fullText, 'student') || this.hasKeyword(fullText, 'wohnung') || this.hasKeyword(fullText, 'arbeit') || this.hasKeyword(fullText, 'leben'))) {
          score += 35;
          reasons.push('German context combined with .de TLD');
        }
      }

      // Special boost for Study Abroad
      if (category.id === 'study_abroad') {
        if (this.hasKeyword(fullText, 'scholarship') || this.hasKeyword(fullText, 'toefl') || this.hasKeyword(fullText, 'ielts') || this.hasKeyword(fullText, 'gre') || this.hasKeyword(fullText, 'study abroad') || this.hasKeyword(fullText, 'university ranking')) {
          score += 25;
          reasons.push('High-signal study abroad indicator');
        }
      }

      // Special boost for Programming
      if (category.id === 'programming') {
        if (['github.com', 'stackoverflow.com', 'developer.mozilla.org'].some(dom => hostname === dom || hostname.endsWith('.' + dom))) {
          score += sharedPlatform ? 10 : 40;
          reasons.push('Primary developer hub domain');
        }
      }

      // Special boost for AI & Technology
      if (category.id === 'ai_technology') {
        if (this.hasKeyword(fullText, 'chatgpt') || this.hasKeyword(fullText, 'openai') || this.hasKeyword(fullText, 'claude') || this.hasKeyword(fullText, 'hugging face') || this.hasKeyword(fullText, 'llm') || this.hasKeyword(fullText, 'nvidia nim') || this.hasKeyword(fullText, 'notebooklm')) {
          score += 35;
          reasons.push('Primary AI ecosystem keyword');
        }
      }

      if (category.id === 'startups_innovation') {
        if (this.hasKeyword(fullText, 'siber koza') || this.hasKeyword(fullText, 'incubator') || this.hasKeyword(fullText, 'accelerator') || this.hasKeyword(fullText, 'pitch deck')) {
          score += 35;
          reasons.push('Startup hub indicator');
        }
      }

      if (category.id === 'gaming') {
        if (this.hasKeyword(fullText, 'tekken') || this.hasKeyword(fullText, 'emulator') || this.hasKeyword(fullText, 'roms') || this.hasKeyword(fullText, 'game download')) {
          score += 35;
          reasons.push('Gaming / emulator indicator');
        }
      }

      // Apply base priority weighting to break ties
      const totalScore = score + (category.priority ? (category.priority / 10) : 0);
      candidates.push({ categoryId: category.id, categoryName: category.name, score: totalScore, evidenceScore: score });

      if (totalScore > highestScore) {
        highestScore = totalScore;
        bestCategory = category;
        bestReasons = reasons;
      }
    }

    if (!bestCategory || highestScore < this.options.minScoreThreshold) {
      const topicMatch = this.clusterer.matchSingleBookmark(bookmark);
      if (topicMatch) {
        const catObj = this.categories.find(c => c.name.toLowerCase() === topicMatch.categoryTarget.toLowerCase());
        const res = {
          categoryId: catObj ? catObj.id : ('topic_' + topicMatch.id),
          categoryName: catObj ? catObj.name : topicMatch.categoryTarget,
          subcategoryId: topicMatch.targetPath[1] ? 'sub_topic' : null,
          subcategoryName: topicMatch.targetPath[1] || null,
          fullCategoryPath: topicMatch.targetPath,
          folderName: topicMatch.targetPath.join(' / '),
          confidence: 'medium',
          score: 42,
          matchReason: topicMatch.matchReason,
          icon: topicMatch.icon,
          color: topicMatch.color,
          tags: topicMatch.tags
        };
        return res;
      }

      return this.createFallbackResult('No matching category with sufficient confidence');
    }

    // Determine subcategory if available and enabled
    let bestSubcategory = null;
    if (this.options.useSubcategories && bestCategory.subcategories && bestCategory.subcategories.length > 0) {
      let highestSubScore = 0;
      for (const sub of bestCategory.subcategories) {
        let subScore = 0;
        if (sub.domains && hostname) {
          for (const sdom of sub.domains) {
            const cleanSubDom = sdom.toLowerCase().replace(/^www\./, '');
            if (hostname === cleanSubDom || hostname.endsWith('.' + cleanSubDom)) {
              subScore += 30;
              break;
            }
          }
        }
        if (sub.keywords) {
          for (const skw of sub.keywords) {
            if (this.hasKeyword(fullText, skw) || (folderHint && this.hasKeyword(folderHint, skw))) {
              subScore += 15;
            }
          }
        }
        if (subScore > highestSubScore) {
          highestSubScore = subScore;
          bestSubcategory = sub;
        }
      }
    }

    let confidence = 'low';
    if (highestScore >= 50) confidence = 'high';
    else if (highestScore >= 35) confidence = 'medium';
    const alternatives = candidates.filter(c => c.categoryId !== bestCategory.id && c.evidenceScore >= 15)
      .sort((a, b) => b.score - a.score).slice(0, 2);
    const margin = alternatives.length ? highestScore - alternatives[0].score : highestScore;
    if (margin < 15 && confidence === 'high') confidence = 'medium';
    if (margin < 8) bestReasons.unshift(`Competing topic: ${alternatives[0]?.categoryName}; review suggested`);

    const fullCategoryPath = [bestCategory.name];
    if (bestSubcategory) {
      fullCategoryPath.push(bestSubcategory.name);
    }

    const result = {
      categoryId: bestCategory.id,
      categoryName: bestCategory.name,
      subcategoryId: bestSubcategory ? bestSubcategory.id : null,
      subcategoryName: bestSubcategory ? bestSubcategory.name : null,
      fullCategoryPath,
      folderName: fullCategoryPath.join(' / '),
      confidence,
      alternatives,
      score: highestScore,
      matchReason: bestReasons.slice(0, 3).join(', ') || 'Keyword similarity match',
      icon: bestCategory.icon || '📁',
      color: bestCategory.color || '#3a86ff'
    };

    result.tags = this.generateSmartTags(bookmark, result);
    return result;
  }

  /**
   * Apply topic clustering across uncategorized/fallback items in a plan
   * @param {Array} planItems - Proposed plan items
   * @param {Object} options - Options such as useSubcategories
   * @returns {Array} Updated plan items
   */
  clusterUncategorized(planItems, options = {}) {
    const unclassified = planItems.filter(item =>
      item.proposedCategoryId === OTHER_CATEGORY.id ||
      item.confidence === 'none' ||
      item.proposedCategoryName === OTHER_CATEGORY.name
    );

    if (unclassified.length === 0) return planItems;

    const clusterMap = this.clusterer.clusterBookmarks(unclassified);
    const useSubcategories = options.groupingMode === 'flat' ? false : (options.useSubcategories !== false);

    for (const item of planItems) {
      if (clusterMap.has(item.id)) {
        const cluster = clusterMap.get(item.id);
        const catObj = this.categories.find(c => c.name.toLowerCase() === cluster.categoryName.toLowerCase());

        let targetPath = cluster.proposedPath || [cluster.categoryName];
        let subName = (targetPath.length > 1) ? targetPath[1] : null;

        if (!useSubcategories) {
          targetPath = [cluster.categoryName];
          subName = null;
        }

        item.proposedCategoryId = catObj ? catObj.id : ('cluster_' + cluster.categoryName.toLowerCase().replace(/\s+/g, '_'));
        item.proposedCategoryName = cluster.categoryName;
        item.proposedSubcategoryId = subName ? 'sub_cluster' : null;
        item.proposedSubcategoryName = subName;
        item.proposedPath = targetPath;
        item.proposedFolderDisplay = targetPath.join(' / ');
        item.confidence = cluster.confidence;
        item.score = cluster.score;
        item.matchReason = cluster.matchReason;
        item.icon = cluster.icon || (catObj ? catObj.icon : '📁');
        item.color = cluster.color || (catObj ? catObj.color : '#4361ee');
        item.tags = cluster.tags || this.generateSmartTags(item, item);
        item.selected = true; // Auto-include item once it is successfully clustered
      }
    }

    return planItems;
  }

  /**
   * Clutter detection helper
   */
  detectClutterAndSuggestSplits(planItems, threshold = 12) {
    return this.clutterSplitter.detectClutter(planItems, threshold);
  }

  /**
   * Clutter application helper
   */
  applySubfolderSplits(planItems, recommendations) {
    return this.clutterSplitter.applySplits(planItems, recommendations);
  }

  /**
   * Fallback result for unmatched bookmarks
   */
  createFallbackResult(reason = 'Unclassified') {
    return {
      categoryId: OTHER_CATEGORY.id,
      categoryName: OTHER_CATEGORY.name,
      subcategoryId: null,
      subcategoryName: null,
      fullCategoryPath: [OTHER_CATEGORY.name],
      folderName: OTHER_CATEGORY.name,
      confidence: 'none',
      score: 0,
      matchReason: reason,
      icon: OTHER_CATEGORY.icon || '❓',
      color: OTHER_CATEGORY.color || '#8d99ae',
      tags: ['#review']
    };
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWordOrPhrase(text, keyword) {
  if (!text || !keyword) return false;
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();

  if (lowerKeyword.includes(' ') || lowerKeyword.includes('-') || lowerKeyword.includes('.')) {
    return lowerText.includes(lowerKeyword);
  }

  try {
    const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(lowerKeyword)}(?![\\p{L}\\p{N}])`, 'iu');
    return regex.test(lowerText);
  } catch {
    return lowerText.includes(lowerKeyword);
  }
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function extractDomainRoot(hostname) {
  if (!hostname || typeof hostname !== 'string') return '';
  const clean = hostname.toLowerCase().replace(/^www\./, '');
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(clean)) return clean;
  const parts = clean.split('.');
  if (parts.length <= 1) return parts[0] || '';
  if (parts.length === 2) return parts[0];

  const secondLast = parts[parts.length - 2];
  if (parts.length >= 3 && secondLast.length <= 3 && ['co', 'com', 'edu', 'gov', 'net', 'org', 'ac'].includes(secondLast)) {
    return parts[parts.length - 3] || parts[0];
  }
  return parts[parts.length - 2];
}
