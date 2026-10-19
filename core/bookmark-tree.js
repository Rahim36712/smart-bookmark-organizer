/**
 * Bookmark Tree Scanner, Organizer & Duplicate Detector
 * Recursively scans all Chrome bookmark folders and handles safe reorganizations.
 */

import { BookmarkCategorizer } from './categorizer.js';
import { protectedFolderIds } from './organization-safety.js';

export const SAMPLE_TEST_BOOKMARKS = [
  // 1. AI & Technology (4)
  {
    title: 'Hugging Face – The AI Community building the future',
    url: 'https://huggingface.co/models',
    targetFolder: 'Old Folder A'
  },
  {
    title: 'Anthropic Claude – Next-Gen AI Assistant & Prompting',
    url: 'https://claude.ai',
    targetFolder: 'Random Links'
  },
  {
    title: 'PyTorch – Production Ready Machine Learning & Deep Learning',
    url: 'https://pytorch.org',
    targetFolder: 'Unsorted'
  },
  {
    title: 'Perplexity AI – Interactive Conversational Search Engine',
    url: 'https://www.perplexity.ai',
    targetFolder: 'Bookmarks Bar'
  },

  // 2. Germany (4)
  {
    title: 'DAAD – German Academic Exchange Service & Scholarships in Germany',
    url: 'https://www.daad.de/en/',
    targetFolder: 'Old Folder A'
  },
  {
    title: 'Uni-Assist – Application Services for International Students in Germany',
    url: 'https://my.uni-assist.de',
    targetFolder: 'Random Links'
  },
  {
    title: 'Make it in Germany – Official Portal for Skilled Workers & Visas',
    url: 'https://www.make-it-in-germany.com/en/',
    targetFolder: 'Unsorted'
  },
  {
    title: 'WG-Gesucht – Student Flatshares and Apartments in Germany',
    url: 'https://www.wg-gesucht.de',
    targetFolder: 'Bookmarks Bar'
  },

  // 3. Study Abroad (4)
  {
    title: 'QS Top Universities – World University Rankings 2026',
    url: 'https://www.topuniversities.com/world-university-rankings',
    targetFolder: 'Old Folder A'
  },
  {
    title: 'Fulbright Foreign Student Program – Fellowships & Grants',
    url: 'https://us.fulbrightonline.org',
    targetFolder: 'Random Links'
  },
  {
    title: 'IELTS Official – English Language Proficiency Test Booking & Prep',
    url: 'https://www.ielts.org',
    targetFolder: 'Unsorted'
  },
  {
    title: 'Campus France – Higher Education and Degree Applications in France',
    url: 'https://www.campusfrance.org/en',
    targetFolder: 'Old Folder A'
  },

  // 4. Gaming (4)
  {
    title: 'Steam Community – Discussions, Workshop & Game Hub',
    url: 'https://steamcommunity.com',
    targetFolder: 'Random Links'
  },
  {
    title: 'IGN – Latest Video Game Reviews, Walkthroughs & Cheats',
    url: 'https://www.ign.com',
    targetFolder: 'Unsorted'
  },
  {
    title: 'PC Gamer – PC Gaming News, Reviews & Hardware Guides',
    url: 'https://www.pcgamer.com',
    targetFolder: 'Bookmarks Bar'
  },
  {
    title: 'Nexus Mods – Video Game Mods and Gaming Community',
    url: 'https://www.nexusmods.com',
    targetFolder: 'Old Folder A'
  },

  // 5. Trading & Finance (4)
  {
    title: 'TradingView – Track All Financial Markets, Forex & Crypto Charts',
    url: 'https://www.tradingview.com',
    targetFolder: 'Random Links'
  },
  {
    title: 'The5ers – Instant Funding Prop Trading Program',
    url: 'https://the5ers.com',
    targetFolder: 'Unsorted'
  },
  {
    title: 'Forex Factory – Economic Calendar & Foreign Exchange Markets',
    url: 'https://www.forexfactory.com',
    targetFolder: 'Bookmarks Bar'
  },
  {
    title: 'Investopedia – Stock Market Terms, Technical Analysis & Investing',
    url: 'https://www.investopedia.com',
    targetFolder: 'Old Folder A'
  },

  // 6. Health & Wellness (5)
  {
    title: 'PubMed – National Library of Medicine & Biomedical Research',
    url: 'https://pubmed.ncbi.nlm.nih.gov',
    targetFolder: 'Random Links'
  },
  {
    title: 'MuscleWiki – Free Workout Workouts & Muscle Exercises',
    url: 'https://musclewiki.com',
    targetFolder: 'Unsorted'
  },
  {
    title: 'Nutrifactor – Dietary Supplements & Multivitamins',
    url: 'https://www.nutrifactor.com.pk',
    targetFolder: 'Bookmarks Bar'
  },
  {
    title: 'Healthline – Medical Information, Fitness & Nutrition Guides',
    url: 'https://www.healthline.com',
    targetFolder: 'Old Folder A'
  },
  {
    title: 'Mayo Clinic – Clinical Health Information and Medical Care',
    url: 'https://www.mayoclinic.org',
    targetFolder: 'Random Links'
  }
];

export class BookmarkTreeManager {
  constructor(bookmarksApi = null) {
    this.bookmarksApi = bookmarksApi || (typeof chrome !== 'undefined' && chrome.bookmarks ? chrome.bookmarks : null);
  }

  /**
   * Normalize URL to accurately detect duplicates despite tracking params, hashes, trailing slashes,
   * while preserving distinct ports (e.g., localhost:3000 vs localhost:8080).
   */
  normalizeUrl(urlString) {
    if (!urlString) return '';
    try {
      const url = new URL(urlString);
      url.hash = '';

      // Strip common tracking parameters across diverse platforms (Google, Meta, Twitter, YouTube, etc.)
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
        'fbclid', 'gclid', 'msclkid', 'mc_eid', 'ref', 'source', '_ga', '_gl', 'ncid',
        'igshid', 'si', 'feature', 'yclid', 'twclid', 'spm'
      ];
      for (const p of trackingParams) {
        url.searchParams.delete(p);
      }

      let pathname = url.pathname;
      if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }

      // Sort remaining search params for canonical representation
      url.searchParams.sort();
      const search = url.searchParams.toString() ? '?' + url.searchParams.toString() : '';

      // Use host (preserves port) rather than hostname
      return `${url.protocol}//${url.host.toLowerCase()}${pathname}${search}`;
    } catch {
      return urlString.trim().toLowerCase();
    }
  }

  /**
   * Recursively scan the entire bookmark tree
   */
  async scanBookmarks() {
    if (!this.bookmarksApi) {
      throw new Error('Chrome Bookmarks API is not available.');
    }

    const tree = await this.bookmarksApi.getTree();
    const allBookmarks = [];
    const allFolders = [];
    const folderMap = new Map();

    const systemIds = new Set(['0', '1', '2', '3', 'mobile', 'synced']);

    const traverse = (node, path = [], isTreeRoot = false) => {
      const isSystem = isTreeRoot || systemIds.has(node.id) || !node.parentId || node.parentId === '0';
      const currentPath = (node.title && !isTreeRoot) ? [...path, node.title] : path;

      if (node.children) {
        allFolders.push({
          id: node.id,
          title: node.title || (isTreeRoot ? 'Root' : 'Untitled Folder'),
          parentId: node.parentId,
          index: node.index,
          path: currentPath,
          childCount: node.children.length,
          isSystem
        });
        folderMap.set(node.id, {
          title: node.title,
          path: currentPath,
          isSystem
        });

        for (const child of node.children) {
          traverse(child, currentPath, false);
        }
      } else if (node.url) {
        allBookmarks.push({
          id: node.id,
          title: node.title || 'Untitled',
          url: node.url,
          parentId: node.parentId,
          index: node.index,
          dateAdded: node.dateAdded,
          folderPath: path,
          parentTitle: path.length > 0 ? path[path.length - 1] : 'Bookmarks Bar'
        });
      }
    };

    for (const rootNode of tree) {
      traverse(rootNode, [], true);
    }

    // Detect duplicate URLs
    const duplicates = this.detectDuplicates(allBookmarks);
    const scatteredFolders = allFolders.filter(f => !f.isSystem);

    return {
      tree,
      bookmarks: allBookmarks,
      folders: allFolders,
      scatteredFolders,
      duplicates,
      stats: {
        totalBookmarks: allBookmarks.length,
        totalFolders: allFolders.length,
        scatteredFoldersCount: scatteredFolders.length,
        duplicateCount: duplicates.length,
        duplicateBookmarksCount: duplicates.reduce((acc, d) => acc + d.bookmarks.length, 0)
      }
    };
  }

  /**
   * Detect duplicate bookmarks by normalized URL.
   * Sorts group items so the oldest / most established bookmark is primary.
   */
  detectDuplicates(bookmarks) {
    const urlMap = new Map();

    for (const b of bookmarks) {
      const norm = this.normalizeUrl(b.url);
      if (!norm) continue;

      if (!urlMap.has(norm)) {
        urlMap.set(norm, []);
      }
      urlMap.get(norm).push(b);
    }

    const duplicateGroups = [];
    for (const [normUrl, items] of urlMap.entries()) {
      if (items.length > 1) {
        // Sort items: prefer older dateAdded, or parentId === '1' (Bookmarks Bar)
        items.sort((a, b) => {
          if (a.parentId === '1' && b.parentId !== '1') return -1;
          if (b.parentId === '1' && a.parentId !== '1') return 1;
          return (a.dateAdded || 0) - (b.dateAdded || 0);
        });

        duplicateGroups.push({
          normalizedUrl: normUrl,
          count: items.length,
          bookmarks: items
        });
      }
    }

    return duplicateGroups;
  }

  /**
   * Apply grouping mode partitioning across the proposed plan.
   * - 'flat': Flattens all bookmarks directly into their top-level category folder.
   * - 'hierarchical': Retains all subcategories as separate subfolders.
   * - 'hybrid': If a top-level category has fewer bookmarks than hybridThreshold (default 10),
   *             keep all its bookmarks flat directly inside the category folder (no subfolders).
   *             Only categories with >= hybridThreshold bookmarks create subfolders.
   *
   * @param {Array} plan - The proposed plan items
   * @param {Object} options - Grouping options { groupingMode, hybridThreshold, useSubcategories }
   * @returns {Array} Updated plan
   */
  applyGroupingMode(plan, options = {}) {
    let mode = options.groupingMode;
    if (!mode) {
      if (options.useSubcategories === false) {
        mode = 'flat';
      } else if (options.useSubcategories === true) {
        mode = 'hierarchical';
      } else {
        mode = 'hybrid';
      }
    }

    let threshold = parseInt(options.hybridThreshold, 10);
    if (isNaN(threshold) || threshold < 1) {
      threshold = 10;
    }

    if (mode === 'hierarchical') {
      return plan;
    }

    if (mode === 'flat') {
      for (const item of plan) {
        if (item.preserveChosenPath) continue;
        const catName = item.proposedCategoryName || (item.proposedPath && item.proposedPath[0]) || 'Uncategorized';
        item.proposedCategoryName = catName;
        item.proposedPath = [catName];
        item.proposedFolderDisplay = catName;
        item.proposedSubcategoryId = null;
        item.proposedSubcategoryName = null;
        item.isAlreadyOrganized = (
          item.currentLocation === item.proposedFolderDisplay ||
          item.currentLocation.endsWith(' / ' + item.proposedFolderDisplay)
        );
      }
      return plan;
    }

    // mode === 'hybrid'
    const categoryCounts = new Map();
    for (const item of plan) {
      const catName = item.proposedCategoryName || (item.proposedPath && item.proposedPath[0]) || 'Uncategorized';
      categoryCounts.set(catName, (categoryCounts.get(catName) || 0) + 1);
    }

    for (const item of plan) {
      const catName = item.proposedCategoryName || (item.proposedPath && item.proposedPath[0]) || 'Uncategorized';
      const count = categoryCounts.get(catName) || 0;

      if (count < threshold && !item.preserveChosenPath) {
        item.proposedCategoryName = catName;
        item.proposedPath = [catName];
        item.proposedFolderDisplay = catName;
        item.proposedSubcategoryId = null;
        item.proposedSubcategoryName = null;
        item.isAlreadyOrganized = (
          item.currentLocation === item.proposedFolderDisplay ||
          item.currentLocation.endsWith(' / ' + item.proposedFolderDisplay)
        );
      }
    }

    return plan;
  }

  /**
   * Generate proposed reorganization plan
   */
  buildProposedPlan(bookmarks, categorizer = new BookmarkCategorizer(), options = {}) {
    const plan = [];

    for (const bookmark of bookmarks) {
      const result = categorizer.categorize(bookmark);

      let targetPath;
      if (result.fullCategoryPath && result.fullCategoryPath.length > 0) {
        targetPath = result.fullCategoryPath;
      } else {
        targetPath = [result.categoryName];
      }

      const currentLocation = (bookmark.folderPath && bookmark.folderPath.length > 0)
        ? bookmark.folderPath.join(' / ')
        : 'Bookmarks Bar';

      const proposedFolderDisplay = targetPath.join(' / ');

      // Check if bookmark is already organized in its proposed category
      const isAlreadyOrganized = (
        currentLocation === proposedFolderDisplay ||
        currentLocation.endsWith(' / ' + proposedFolderDisplay)
      );

      const isUnclassified = (
        result.categoryId === 'other' ||
        result.confidence === 'none' ||
        (result.categoryName && result.categoryName.includes('Uncategorized'))
      );

      plan.push({
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        currentParentId: bookmark.parentId,
        currentIndex: bookmark.index,
        originalFolderPath: bookmark.folderPath || [],
        currentLocation,
        proposedCategoryId: result.categoryId,
        proposedCategoryName: result.categoryName,
        proposedSubcategoryId: result.subcategoryId,
        proposedSubcategoryName: result.subcategoryName,
        proposedPath: targetPath,
        proposedFolderDisplay,
        confidence: result.confidence,
        alternatives: result.alternatives || [],
        score: result.score,
        matchReason: result.matchReason,
        icon: result.icon,
        color: result.color,
        tags: result.tags || (categorizer.generateSmartTags ? categorizer.generateSmartTags(bookmark, result) : []),
        isLearned: Boolean(result.isLearned),
        preserveChosenPath: Boolean(result.preserveChosenPath),
        isAlreadyOrganized,
        selected: !isUnclassified // Uncategorized items require explicit user review before moving
      });
    }

    // Run Topic Clustering across unclassified bookmarks
    if (options.useClustering !== false && typeof categorizer.clusterUncategorized === 'function') {
      categorizer.clusterUncategorized(plan, options);
    }

    // Optionally auto-split cluttered folders (>12 bookmarks), but only when subfolders are permitted
    const effectiveMode = options.groupingMode || (options.useSubcategories === false ? 'flat' : 'hybrid');
    if (effectiveMode !== 'flat' && options.autoSplitClutter && typeof categorizer.detectClutterAndSuggestSplits === 'function') {
      const recs = categorizer.detectClutterAndSuggestSplits(plan, options.clutterThreshold || 12);
      if (recs.length > 0) {
        categorizer.applySubfolderSplits(plan, recs);
      }
    }

    // Apply Smart Hybrid / Flat / Hierarchical grouping mode (final authority on folder structure)
    this.applyGroupingMode(plan, options);

    return plan;
  }

  /**
   * Generate proposed reorganization plan with optional Gemini AI semantic classification.
   * Seamlessly falls back to local heuristic categorization if Gemini is not configured,
   * disabled, or encounters a network error.
   */
  async buildProposedPlanWithAi(bookmarks, categorizer = new BookmarkCategorizer(), geminiService = null, options = {}, onProgress = null) {
    if (typeof options === 'function') {
      onProgress = options;
      options = {};
    }
    const aiMap = new Map();

    const isAiUsable = Boolean(
      geminiService &&
      typeof geminiService.isConfigured === 'function' &&
      geminiService.isConfigured() &&
      options.useGemini !== false
    );

    if (isAiUsable) {
      try {
        const categories = categorizer.categories || [];
        const aiResults = await geminiService.categorizeAll(bookmarks, categories, options, onProgress);
        if (Array.isArray(aiResults)) {
          for (const item of aiResults) {
            if (item && item.id) {
              aiMap.set(String(item.id), item);
            }
          }
        }
      } catch (err) {
        console.warn('Gemini AI categorization failed, falling back to local categorizer:', err);
      }
    }

    const plan = [];

    for (const bookmark of bookmarks) {
      const aiItem = aiMap.get(String(bookmark.id));
      const localResult = categorizer.categorize(bookmark);

      if (aiItem && typeof aiItem.category === 'string' && aiItem.category.trim() && !localResult.isLearned) {
        const catName = String(aiItem.category).trim();
        const subName = aiItem.subcategory ? String(aiItem.subcategory).trim() : null;

        const targetPath = subName ? [catName, subName] : [catName];
        const proposedFolderDisplay = targetPath.join(' / ');

        const currentLocation = (bookmark.folderPath && bookmark.folderPath.length > 0)
          ? bookmark.folderPath.join(' / ')
          : 'Bookmarks Bar';

        const isAlreadyOrganized = (
          currentLocation === proposedFolderDisplay ||
          currentLocation.endsWith(' / ' + proposedFolderDisplay)
        );

        const matchedCat = (categorizer.categories || []).find(
          c => c.name.toLowerCase() === catName.toLowerCase()
        );
        const unclassified = /uncategorized|needs review|^unknown$/i.test(catName);
        const conflict = localResult.confidence === 'high' && localResult.categoryName.toLowerCase() !== catName.toLowerCase();
        const aiConfidence = unclassified ? 'none' : conflict ? 'medium'
          : ['high', 'medium', 'low'].includes(aiItem.confidence) ? aiItem.confidence : 'medium';

        plan.push({
          id: bookmark.id,
          title: bookmark.title,
          url: bookmark.url,
          currentParentId: bookmark.parentId,
          currentIndex: bookmark.index,
          originalFolderPath: bookmark.folderPath || [],
          currentLocation,
          proposedCategoryId: unclassified ? 'other' : matchedCat ? matchedCat.id : 'gemini_ai',
          proposedCategoryName: catName,
          proposedSubcategoryId: subName ? 'gemini_sub' : null,
          proposedSubcategoryName: subName,
          proposedPath: targetPath,
          proposedFolderDisplay,
          confidence: aiConfidence,
          score: aiConfidence === 'high' ? 85 : aiConfidence === 'medium' ? 45 : 20,
          alternatives: conflict ? [{ categoryName: localResult.categoryName }] : [],
          matchReason: `✨ Gemini AI: ${aiItem.reason || 'Semantic classification'}${conflict ? `; local evidence suggests ${localResult.categoryName}` : ''}`,
          icon: aiItem.icon || (matchedCat ? matchedCat.icon : '📁'),
          color: matchedCat ? matchedCat.color : '#7b2cbf',
          tags: Array.isArray(aiItem.tags) && aiItem.tags.length > 0
            ? aiItem.tags
            : (categorizer.generateSmartTags ? categorizer.generateSmartTags(bookmark, { categoryName: catName }) : []),
          isLearned: false,
          isAiGenerated: true,
          isAlreadyOrganized,
          selected: !unclassified
        });
      } else {
        // Fallback to local heuristic categorization for this bookmark
        const result = categorizer.categorize(bookmark);

        let targetPath;
        if (result.fullCategoryPath && result.fullCategoryPath.length > 0) {
          targetPath = result.fullCategoryPath;
        } else {
          targetPath = [result.categoryName];
        }

        const currentLocation = (bookmark.folderPath && bookmark.folderPath.length > 0)
          ? bookmark.folderPath.join(' / ')
          : 'Bookmarks Bar';

        const proposedFolderDisplay = targetPath.join(' / ');

        const isAlreadyOrganized = (
          currentLocation === proposedFolderDisplay ||
          currentLocation.endsWith(' / ' + proposedFolderDisplay)
        );

        const isUnclassified = (
          result.categoryId === 'other' ||
          result.confidence === 'none' ||
          (result.categoryName && result.categoryName.includes('Uncategorized'))
        );

        plan.push({
          id: bookmark.id,
          title: bookmark.title,
          url: bookmark.url,
          currentParentId: bookmark.parentId,
          currentIndex: bookmark.index,
          originalFolderPath: bookmark.folderPath || [],
          currentLocation,
          proposedCategoryId: result.categoryId,
          proposedCategoryName: result.categoryName,
          proposedSubcategoryId: result.subcategoryId,
          proposedSubcategoryName: result.subcategoryName,
          proposedPath: targetPath,
          proposedFolderDisplay,
          confidence: result.confidence,
          score: result.score,
          matchReason: result.matchReason,
          icon: result.icon,
          color: result.color,
          tags: result.tags || (categorizer.generateSmartTags ? categorizer.generateSmartTags(bookmark, result) : []),
          isLearned: Boolean(result.isLearned),
          preserveChosenPath: Boolean(result.preserveChosenPath),
          isAiGenerated: false,
          isAlreadyOrganized,
          selected: !isUnclassified
        });
      }
    }

    // Run Topic Clustering across any unclassified bookmarks
    if (options.useClustering !== false && typeof categorizer.clusterUncategorized === 'function') {
      categorizer.clusterUncategorized(plan, options);
    }

    // Optionally auto-split cluttered folders (>12 bookmarks), but only when subfolders are permitted
    const effectiveMode = options.groupingMode || (options.useSubcategories === false ? 'flat' : 'hybrid');
    if (effectiveMode !== 'flat' && options.autoSplitClutter && typeof categorizer.detectClutterAndSuggestSplits === 'function') {
      const recs = categorizer.detectClutterAndSuggestSplits(plan, options.clutterThreshold || 12);
      if (recs.length > 0) {
        categorizer.applySubfolderSplits(plan, recs);
      }
    }

    // Apply Smart Hybrid / Flat / Hierarchical grouping mode (final authority on folder structure)
    this.applyGroupingMode(plan, options);

    return plan;
  }

  /**
   * Find or create folder hierarchy under a specified parent ID.
   * Keeps track of newly created folder IDs to enable clean, safe undo.
   */
  async ensureFolderHierarchy(pathSegments, rootParentId = '1', folderCache = new Map(), newlyCreatedFolderIds = null, protectedIds = new Set()) {
    let currentParentId = rootParentId;
    let accumulatedPath = String(rootParentId);
    const segments = Array.isArray(pathSegments) ? pathSegments : (pathSegments ? [pathSegments] : []);

    for (const segment of segments) {
      if (protectedIds.has(String(currentParentId))) throw new Error('Destination folder is protected.');
      const cleanSegment = (segment || '').trim();
      if (!cleanSegment) continue;

      accumulatedPath += '/' + cleanSegment.toLowerCase();

      if (folderCache.has(accumulatedPath)) {
        currentParentId = folderCache.get(accumulatedPath);
        continue;
      }

      // Check existing children in Chrome bookmarks
      const children = await this.bookmarksApi.getChildren(currentParentId);
      const existing = children.find(c => !c.url && c.title.toLowerCase() === cleanSegment.toLowerCase());

      if (existing) {
        currentParentId = existing.id;
      } else {
        // Create new folder
        const newFolder = await this.bookmarksApi.create({
          parentId: currentParentId,
          title: cleanSegment
        });
        currentParentId = newFolder.id;
        if (newlyCreatedFolderIds) {
          newlyCreatedFolderIds.add(currentParentId);
        }
      }

      folderCache.set(accumulatedPath, currentParentId);
    }

    if (protectedIds.has(String(currentParentId))) throw new Error('Destination folder is protected.');
    return currentParentId;
  }

  /**
   * Execute organization plan safely
   */
  async executePlan(itemsToOrganize, options = {}, onProgress = null) {
    if (!this.bookmarksApi) {
      throw new Error('Chrome Bookmarks API is not available.');
    }

    const targetRootFolderTitle = options.targetRootFolderTitle !== undefined
      ? options.targetRootFolderTitle
      : 'Organized Bookmarks';
    const targetRootParentId = String(options.targetRootParentId || options.targetParentId || '1');
    const cleanEmptyFolders = Boolean(options.cleanEmptyFolders);

    const folderCache = new Map();
    const newlyCreatedFolderIds = new Set();
    const movedItems = [];
    const failedItems = [];
    let protectedIds = new Set();
    if (options.excludedFolderIds?.length) {
      const scan = await this.scanBookmarks();
      protectedIds = protectedFolderIds(scan.folders, options.excludedFolderIds);
      const currentParents = new Map(scan.bookmarks.map(item => [item.id, item.parentId]));
      itemsToOrganize = itemsToOrganize.filter(item => !protectedIds.has(String(currentParents.get(item.id))));
      if (protectedIds.has(targetRootParentId)) throw new Error('Choose a destination outside your protected folders.');
    }
    if (!itemsToOrganize.length || options.signal?.aborted) {
      return { success: true, totalMoved: 0, movedItems, createdFolders: [], failedItems, cancelled: Boolean(options.signal?.aborted) };
    }

    // Ensure dedicated root folder exists if configured
    let baseParentId = targetRootParentId;
    if (targetRootFolderTitle && targetRootFolderTitle.trim()) {
      baseParentId = await this.ensureFolderHierarchy(
          [targetRootFolderTitle.trim()],
          targetRootParentId,
          folderCache,
          newlyCreatedFolderIds,
          protectedIds
      );
    }

    const total = itemsToOrganize.length;
    let completed = 0;

    for (const item of itemsToOrganize) {
      if (options.signal?.aborted) break;
      if (item.selected === false) {
        completed++;
        continue;
      }

      try {
        // Ensure category folder hierarchy
        const proposedPath = Array.isArray(item.proposedPath) && item.proposedPath.length > 0
          ? item.proposedPath
          : [item.proposedCategoryName || 'Uncategorized'];

          const destinationFolderId = await this.ensureFolderHierarchy(
            proposedPath,
            baseParentId,
            folderCache,
            newlyCreatedFolderIds,
            protectedIds
          );
          if (protectedIds.has(String(destinationFolderId))) throw new Error('Destination folder is protected.');

        // If bookmark is ALREADY in destination folder, do not reshuffle or trigger redundant move
        if (item.currentParentId === destinationFolderId) {
          completed++;
          if (onProgress) {
            onProgress({
              completed,
              total,
              percent: Math.round((completed / total) * 100),
              currentItem: item
            });
          }
          continue;
        }

        // Record for undo snapshot
        const record = {
          id: item.id,
          title: item.title,
          url: item.url,
          originalParentId: item.currentParentId,
          originalIndex: item.currentIndex,
          originalFolderPath: item.originalFolderPath || (item.currentLocation ? item.currentLocation.split(' / ') : []),
          newParentId: destinationFolderId
        };

        // Move bookmark
        await this.bookmarksApi.move(item.id, {
          parentId: destinationFolderId
        });

        movedItems.push(record);
        } catch (err) {
          failedItems.push({ id: item.id, message: err.message });
        console.error(`Failed to move bookmark ${item.id} (${item.title}):`, err);
      }

      completed++;
      if (onProgress) {
        onProgress({
          completed,
          total,
          percent: Math.round((completed / total) * 100),
          currentItem: item
        });
      }

      // Small throttle to avoid Chrome API rate limiting
      await new Promise(r => setTimeout(r, 25));
    }

    // Clean empty scattered folders if requested
      if (cleanEmptyFolders && !options.signal?.aborted) {
        await this.cleanEmptyScatteredFolders(protectedIds);
    }

    return {
      success: failedItems.length === 0,
      failedItems,
      cancelled: Boolean(options.signal?.aborted),
      totalMoved: movedItems.length,
      movedItems,
      createdFolders: Array.from(newlyCreatedFolderIds),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Remove empty non-system folders recursively bottom-up
   */
    async cleanEmptyScatteredFolders(protectedIds = new Set()) {
    try {
      const tree = await this.bookmarksApi.getTree();
      const systemIds = new Set(['0', '1', '2', '3', 'mobile', 'synced']);

        const removeEmpty = async (node) => {
          if (protectedIds.has(String(node.id))) return false;
        if (!node.children) return false;

        // Traverse bottom up so leaf subfolders are removed first
        for (let i = node.children.length - 1; i >= 0; i--) {
          await removeEmpty(node.children[i]);
        }

        // Re-check after removing child folders
        const freshChildren = await this.bookmarksApi.getChildren(node.id);
        const isSystem = !node.parentId || node.parentId === '0' || systemIds.has(node.id);

        if (freshChildren.length === 0 && !isSystem) {
          try {
            await this.bookmarksApi.remove(node.id);
            return true;
          } catch {
            return false;
          }
        }
        return false;
      };

      for (const root of tree) {
        await removeEmpty(root);
      }
    } catch (e) {
      console.warn('Empty folder cleanup notice:', e);
    }
  }

  /**
   * Explicitly delete duplicate bookmarks (requires user confirmation in UI).
   * Returns complete deleted bookmark details for reversible undo snapshots.
   */
  async removeDuplicates(bookmarkIds) {
    if (!this.bookmarksApi) {
      throw new Error('Chrome Bookmarks API is not available.');
    }
    const results = [];
    for (const id of bookmarkIds) {
      try {
        const nodeArr = await this.bookmarksApi.get(id);
        const node = nodeArr && nodeArr.length > 0 ? nodeArr[0] : null;

        await this.bookmarksApi.remove(id);
        results.push({
          id,
          success: true,
          bookmark: node ? {
            id: node.id,
            title: node.title,
            url: node.url,
            parentId: node.parentId,
            index: node.index,
            dateAdded: node.dateAdded
          } : null
        });
      } catch (err) {
        results.push({ id, success: false, error: err.message, bookmark: null });
      }
    }
    return results;
  }

  /**
   * Scatter existing bookmarks across test folders and the Bookmarks Bar for testing.
   * Saves a reversible undo snapshot so the user can 1-click restore their previous structure.
   *
   * @param {Array|null} bookmarks - Bookmarks to scatter (if null, scans all bookmarks)
   * @param {Object} options - Options including undoManager, targetRootParentId
   * @returns {Promise<Object>} Result with totalMoved, movedItems, createdFolders, and snapshot
   */
  async scatterBookmarks(bookmarks = null, options = {}) {
    if (!this.bookmarksApi) {
      throw new Error('Chrome Bookmarks API is not available.');
    }

    let itemsToScatter = bookmarks;
    if (!itemsToScatter || itemsToScatter.length === 0) {
      const scan = await this.scanBookmarks();
      itemsToScatter = scan.bookmarks || [];
    }

    if (itemsToScatter.length === 0) {
      return { success: false, totalMoved: 0, message: 'No bookmarks to scatter.' };
    }

    const targetRootParentId = String(options.targetRootParentId || '1');
    const folderNames = ['Old Folder A', 'Random Links', 'Unsorted'];
    const createdFolderIds = new Set();
    const folderCache = new Map();
    const folderIds = [];

    // Ensure test scatter folders exist
    for (const name of folderNames) {
      const folderId = await this.ensureFolderHierarchy([name], targetRootParentId, folderCache, createdFolderIds);
      folderIds.push(folderId);
    }

    // Destinations: the 3 test folders + the root parent itself (Bookmarks Bar)
    const destinations = [...folderIds, targetRootParentId];
    const movedItems = [];

    for (let i = 0; i < itemsToScatter.length; i++) {
      const item = itemsToScatter[i];
      const origParentId = item.currentParentId || item.parentId;
      const origIndex = typeof item.currentIndex === 'number' ? item.currentIndex : item.index;
      const origFolderPath = item.originalFolderPath || item.folderPath || (item.currentLocation ? item.currentLocation.split(' / ') : []);

      // Pick a destination target round-robin
      let destParentId = destinations[i % destinations.length];
      // If bookmark is already in that folder, pick another one so it actually moves
      if (String(origParentId) === String(destParentId)) {
        destParentId = destinations[(i + 1) % destinations.length];
      }

      const record = {
        id: item.id,
        title: item.title,
        url: item.url,
        originalParentId: origParentId,
        originalIndex: origIndex,
        originalFolderPath: origFolderPath,
        newParentId: destParentId
      };

      try {
        await this.bookmarksApi.move(item.id, { parentId: destParentId });
        movedItems.push(record);
      } catch (err) {
        console.warn(`Could not scatter bookmark ${item.id} (${item.title}):`, err);
      }
    }

    let snapshot = null;
    if (options.undoManager && typeof options.undoManager.saveSnapshot === 'function') {
      snapshot = await options.undoManager.saveSnapshot(
        `Scattered ${movedItems.length} bookmarks into test folders`,
        movedItems,
        Array.from(createdFolderIds),
        'scatter'
      );
    }

    return {
      success: true,
      totalMoved: movedItems.length,
      movedItems,
      createdFolders: Array.from(createdFolderIds),
      snapshot
    };
  }

  /**
   * Injects 25 realistic sample bookmarks across diverse categories (AI, Germany,
   * Study Abroad, Gaming, Trading, Health) into scattered test folders.
   *
   * @param {Object} options - Options including targetRootParentId, storage, undoManager
   * @returns {Promise<Object>} Result with createdBookmarks, createdFolders, and snapshot
   */
  async generateSampleBookmarks(options = {}) {
    if (!this.bookmarksApi) {
      throw new Error('Chrome Bookmarks API is not available.');
    }

    const targetRootParentId = String(options.targetRootParentId || '1');
    const folderCache = new Map();
    const createdFolderIds = new Set();
    const createdBookmarks = [];

    for (const sample of SAMPLE_TEST_BOOKMARKS) {
      let destParentId = targetRootParentId;
      if (sample.targetFolder && sample.targetFolder !== 'Bookmarks Bar') {
        destParentId = await this.ensureFolderHierarchy(
          [sample.targetFolder],
          targetRootParentId,
          folderCache,
          createdFolderIds
        );
      }

      try {
        const createdNode = await this.bookmarksApi.create({
          parentId: destParentId,
          title: sample.title,
          url: sample.url
        });
        createdBookmarks.push(createdNode);
      } catch (err) {
        console.warn(`Could not create sample bookmark ${sample.title}:`, err);
      }
    }

    // Save tracking data into storage if available
    const storage = options.storage || (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local ? chrome.storage.local : null);
    if (storage) {
      await storage.set({
        organizer_sample_bookmarks: {
          bookmarkIds: createdBookmarks.map(b => b.id),
          folderIds: Array.from(createdFolderIds),
          createdAt: Date.now()
        }
      });
    }

    let snapshot = null;
    if (options.undoManager && typeof options.undoManager.saveSnapshot === 'function') {
      snapshot = await options.undoManager.saveSnapshot(
        `Generated ${createdBookmarks.length} Sample Bookmarks`,
        createdBookmarks.map(b => ({
          id: b.id,
          title: b.title,
          url: b.url,
          parentId: b.parentId
        })),
        Array.from(createdFolderIds),
        'sample_generation'
      );
    }

    return {
      success: true,
      count: createdBookmarks.length,
      createdBookmarks,
      createdFolders: Array.from(createdFolderIds),
      snapshot
    };
  }

  /**
   * 1-Click remove all sample test bookmarks and their empty scattered folders.
   *
   * @param {Object} options - Options including storage
   * @returns {Promise<Object>} Result with removedBookmarksCount, removedFoldersCount
   */
  async removeSampleBookmarks(options = {}) {
    if (!this.bookmarksApi) {
      throw new Error('Chrome Bookmarks API is not available.');
    }

    const storage = options.storage || (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local ? chrome.storage.local : null);
    let sampleData = null;
    if (storage) {
      const res = await storage.get('organizer_sample_bookmarks');
      sampleData = res ? res.organizer_sample_bookmarks : null;
    }

    const sampleUrls = new Set(SAMPLE_TEST_BOOKMARKS.map(s => s.url.toLowerCase().replace(/\/+$/, '')));
    const sampleTitles = new Set(SAMPLE_TEST_BOOKMARKS.map(s => s.title));

    let removedBookmarksCount = 0;
    let removedFoldersCount = 0;
    const removedIds = new Set();

    if (sampleData && Array.isArray(sampleData.bookmarkIds)) {
      for (const bId of sampleData.bookmarkIds) {
        try {
          await this.bookmarksApi.remove(bId);
          removedBookmarksCount++;
          removedIds.add(bId);
        } catch {
          // Bookmark might already be removed
        }
      }
    }

    // Scan bookmarks to clean up any remaining sample bookmarks
    const scan = await this.scanBookmarks();
    for (const b of scan.bookmarks) {
      if (removedIds.has(b.id)) continue;
      const cleanUrl = (b.url || '').toLowerCase().replace(/\/+$/, '');
      if (sampleUrls.has(cleanUrl) || sampleTitles.has(b.title)) {
        try {
          await this.bookmarksApi.remove(b.id);
          removedBookmarksCount++;
          removedIds.add(b.id);
        } catch {
          // ignore
        }
      }
    }

    // Clean empty test folders
    const targetFolderNames = new Set(['Old Folder A', 'Random Links', 'Unsorted']);
    if (sampleData && Array.isArray(sampleData.folderIds)) {
      for (const fId of sampleData.folderIds) {
        try {
          const children = await this.bookmarksApi.getChildren(fId);
          if (children && children.length === 0) {
            await this.bookmarksApi.remove(fId);
            removedFoldersCount++;
          }
        } catch {
          // ignore
        }
      }
    }

    const freshScan = await this.scanBookmarks();
    for (const folder of freshScan.folders) {
      if (targetFolderNames.has(folder.title)) {
        try {
          const children = await this.bookmarksApi.getChildren(folder.id);
          if (children && children.length === 0) {
            await this.bookmarksApi.remove(folder.id);
            removedFoldersCount++;
          }
        } catch {
          // ignore
        }
      }
    }

    if (storage) {
      await storage.set({ organizer_sample_bookmarks: null });
    }

    return {
      success: true,
      removedBookmarksCount,
      removedFoldersCount
    };
  }

  /**
   * Check if sample bookmarks currently exist in bookmarks or storage
   */
  async hasSampleBookmarks(options = {}) {
    const storage = options.storage || (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local ? chrome.storage.local : null);
    if (storage) {
      const res = await storage.get('organizer_sample_bookmarks');
      if (res && res.organizer_sample_bookmarks && res.organizer_sample_bookmarks.bookmarkIds && res.organizer_sample_bookmarks.bookmarkIds.length > 0) {
        return true;
      }
    }
    const scan = await this.scanBookmarks();
    const sampleUrls = new Set(SAMPLE_TEST_BOOKMARKS.map(s => s.url.toLowerCase().replace(/\/+$/, '')));
    return scan.bookmarks.some(b => sampleUrls.has((b.url || '').toLowerCase().replace(/\/+$/, '')));
  }
}
