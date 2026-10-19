/**
 * Background Service Worker (Manifest V3)
 * Manages background events, automatic organization of newly added bookmarks,
 * and maintains local state without any external network communication.
 */

import { BookmarkCategorizer } from '../core/categorizer.js';
import { BookmarkTreeManager } from '../core/bookmark-tree.js';
import { UndoManager } from '../core/undo-manager.js';
import { SettingsManager } from '../core/storage.js';
import { protectedFolderIds } from '../core/organization-safety.js';

const settingsManager = new SettingsManager();
const undoManager = new UndoManager();

// Initialize defaults on install
chrome.runtime.onInstalled.addListener(async (details) => {
  const current = await settingsManager.getSettings();
  console.log('Smart Bookmark Organizer installed.');
});

/**
 * Automatically organize future bookmarks when added
 */
async function autoOrganizeBookmark(id, bookmark) {
  try {
    // Only organize web links, not newly created folders
    if (!bookmark.url) return;

    // Small delay to allow Chrome bookmark dialog to settle and finalize title
    await new Promise(r => setTimeout(r, 600));

    // Re-fetch bookmark in case user changed title or deleted it immediately
    const freshNodes = await chrome.bookmarks.get(id);
    if (!freshNodes || freshNodes.length === 0) return;
    const currentBookmark = freshNodes[0];

    const settings = await settingsManager.getSettings();
    if (!settings.autoOrganize) return;

    const categories = await settingsManager.getCategories();
    const learnedRules = await settingsManager.getLearnedRules();
    const categorizer = new BookmarkCategorizer(categories, {
      useSubcategories: settings.useSubcategories,
      minScoreThreshold: settings.minScoreThreshold,
      learnedRules
    });

    const treeManager = new BookmarkTreeManager(chrome.bookmarks);
    const scan = await treeManager.scanBookmarks();
    const protectedIds = protectedFolderIds(scan.folders, settings.excludedFolderIds || []);
    if (protectedIds.has(String(currentBookmark.parentId))) return;

    // Classify newly created bookmark
    const result = categorizer.categorize(currentBookmark);
    if (settings.highConfidenceOnly !== false && result.confidence !== 'high') return;

    // Do not auto-move unclassifiable bookmarks into an Uncategorized folder; leave them for user review
    if (result.categoryId === 'other' || result.confidence === 'none' || (result.categoryName && result.categoryName.includes('Uncategorized'))) {
      console.log(`Bookmark "${currentBookmark.title}" is uncategorized and left for user review.`);
      return;
    }

    // Build target folder path
    const folderSegments = (settings.useSubcategories && result.fullCategoryPath && result.fullCategoryPath.length > 0)
      ? result.fullCategoryPath
      : [result.categoryName];

    // Ensure target folder exists under target root
    const folderCache = new Map();
    const newlyCreatedFolders = new Set();
    let baseParentId = settings.targetRootParentId || '1';

    if (settings.targetRootFolderTitle) {
      baseParentId = await treeManager.ensureFolderHierarchy(
        [settings.targetRootFolderTitle],
        baseParentId,
        folderCache,
        newlyCreatedFolders,
        protectedIds
      );
    }

    // Destination category folder ID
    const destinationFolderId = await treeManager.ensureFolderHierarchy(
      folderSegments,
      baseParentId,
      folderCache,
      newlyCreatedFolders,
      protectedIds
    );

    // If bookmark is already in the target folder, no need to move
    if (currentBookmark.parentId === destinationFolderId) {
      return;
    }

    const originalParentId = currentBookmark.parentId;
    const originalIndex = currentBookmark.index;

    const record = {
      id: currentBookmark.id,
      title: currentBookmark.title,
      url: currentBookmark.url,
      originalParentId,
      originalIndex,
      newParentId: destinationFolderId
    };

    // Group nearby automatic moves into one history entry while still saving
    // recovery information before each move.
    const snapshots = await undoManager.getAllSnapshots();
    const recentAuto = snapshots.find(snapshot =>
      snapshot.type === 'auto_organization' &&
      ['active', 'pending'].includes(snapshot.status) &&
      Date.now() - new Date(snapshot.timestamp).getTime() < 10 * 60 * 1000
    );
    const safetySnapshot = recentAuto
      ? await undoManager.updateSnapshot(recentAuto.id, {
        items: [...(recentAuto.items || []), record],
        createdFolders: [...new Set([...(recentAuto.createdFolders || []), ...newlyCreatedFolders])],
        status: 'pending'
      })
      : await undoManager.saveSnapshot(
        'Automatic organization in progress',
        [record],
        Array.from(newlyCreatedFolders),
        'auto_organization',
        { status: 'pending' }
      );

    // Move bookmark
    await chrome.bookmarks.move(currentBookmark.id, {
      parentId: destinationFolderId
    });

    await undoManager.updateSnapshot(safetySnapshot.id, {
      title: `Automatically organized ${safetySnapshot.items.length} recent bookmark${safetySnapshot.items.length === 1 ? '' : 's'}`,
      status: 'active'
    });

    console.log(`Auto-organized bookmark "${currentBookmark.title}" into ${folderSegments.join(' / ')}`);

  } catch (err) {
    console.error('Error during auto-organization of new bookmark:', err);
  }
}

// Serialize events so simultaneous bookmark saves cannot create duplicate folders
// or overwrite each other's undo history.
let autoOrganizeQueue = Promise.resolve();
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  autoOrganizeQueue = autoOrganizeQueue.then(() => autoOrganizeBookmark(id, bookmark));
});
