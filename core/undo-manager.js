/**
 * Undo & Snapshot Manager for Chrome Bookmark Organizer
 * Ensures 100% reversible operations, state preservation, bottom-up cleanup,
 * and JSON backup export / import reconstruction.
 */

import { restoreFolderReset } from './folder-reset.js';

export class UndoManager {
  constructor(storageArea = null, bookmarksApi = null) {
    this.storage = storageArea || (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local ? chrome.storage.local : null);
    this.bookmarksApi = bookmarksApi || (typeof chrome !== 'undefined' && chrome.bookmarks ? chrome.bookmarks : null);
    this.STORAGE_KEY = 'organizer_snapshots';
  }

  /**
   * Save a reorganization or operation snapshot
   */
  async saveSnapshot(title, movedItems, createdFolders = [], type = 'reorganization', details = {}) {
    const snapshot = {
      ...details,
      id: `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      title: title || `Reorganization of ${movedItems.length} bookmarks`,
      type,
      totalMoved: movedItems.length,
      items: movedItems,
      createdFolders: Array.from(createdFolders),
      status: details.status || 'active'
    };

    const snapshots = await this.getAllSnapshots();
    snapshots.unshift(snapshot); // Newest first

    // Limit history to 20 snapshots to save local storage
    if (snapshots.length > 20) {
      snapshots.length = 20;
    }

    if (this.storage) {
      await this.storage.set({ [this.STORAGE_KEY]: snapshots });
    }

    return snapshot;
  }

  /** Update an existing snapshot without changing its identity or order. */
  async updateSnapshot(snapshotId, updates = {}) {
    const snapshots = await this.getAllSnapshots();
    const index = snapshots.findIndex(snapshot => snapshot.id === snapshotId);
    if (index < 0) throw new Error('Undo snapshot no longer exists.');
    snapshots[index] = {
      ...snapshots[index],
      ...updates,
      id: snapshots[index].id,
      timestamp: snapshots[index].timestamp
    };
    if (updates.items) snapshots[index].totalMoved = updates.items.length;
    if (this.storage) await this.storage.set({ [this.STORAGE_KEY]: snapshots });
    return snapshots[index];
  }

  /**
   * Retrieve all snapshots
   */
  async getAllSnapshots() {
    if (!this.storage) return [];
    const result = await this.storage.get(this.STORAGE_KEY);
    return result[this.STORAGE_KEY] || [];
  }

  /**
   * Helper to ensure folder path exists when restoring back to original locations
   */
  async getOrCreateFolderPath(pathSegments, defaultParentId = '1') {
    if (!pathSegments || pathSegments.length === 0) return defaultParentId;

    let currentParentId = defaultParentId;
    for (const segment of pathSegments) {
      const clean = (segment || '').trim();
      if (!clean ||
          clean.toLowerCase() === 'bookmarks bar' ||
          clean.toLowerCase() === 'other bookmarks' ||
          clean.toLowerCase() === 'root') continue;

      try {
        const children = await this.bookmarksApi.getChildren(currentParentId);
        const existing = children.find(c => !c.url && c.title.toLowerCase() === clean.toLowerCase());
        if (existing) {
          currentParentId = existing.id;
        } else {
          const created = await this.bookmarksApi.create({
            parentId: currentParentId,
            title: clean
          });
          currentParentId = created.id;
        }
      } catch {
        return defaultParentId;
      }
    }
    return currentParentId;
  }

  /**
   * Revert a reorganization snapshot back to original state
   */
  async restoreSnapshot(snapshotId, onProgress = null) {
    if (!this.bookmarksApi) {
      throw new Error('Chrome Bookmarks API is not available.');
    }

    const snapshots = await this.getAllSnapshots();
    const snapshotIndex = snapshots.findIndex(s => s.id === snapshotId);
    if (snapshotIndex === -1) {
      throw new Error(`Snapshot ${snapshotId} not found.`);
    }

    const snapshot = snapshots[snapshotIndex];
    if (snapshot.type === 'folder_reset') {
      return restoreFolderReset(this, snapshot, onProgress);
    }
    const items = snapshot.items || [];
    let restoredCount = 0;
    let failedCount = 0;
    const total = items.length;

    if (snapshot.type === 'duplicate_removal') {
      // Recreate previously removed duplicate bookmarks
      for (let i = 0; i < total; i++) {
        const item = items[i];
        try {
          // A pending safety snapshot can include a deletion that never happened.
          // If the original bookmark still exists, there is nothing to recreate.
          let originalStillExists = false;
          if (item.id) {
            try {
              const original = await this.bookmarksApi.get(item.id);
              originalStillExists = Boolean(original?.length);
            } catch {}
          }
          if (!originalStillExists) {
            // Check if parent folder exists, fallback to '1' (Bookmarks Bar)
            let targetParentId = item.originalParentId || '1';
            try {
              const parent = await this.bookmarksApi.get(targetParentId);
              if (!parent || parent.length === 0) targetParentId = '1';
            } catch {
              targetParentId = '1';
            }

            const createProps = {
              parentId: targetParentId,
              title: item.title,
              url: item.url
            };
            if (typeof item.originalIndex === 'number') {
              createProps.index = item.originalIndex;
            }
            await this.bookmarksApi.create(createProps);
          }
          restoredCount++;
        } catch (err) {
          console.warn(`Could not restore duplicate bookmark ${item.title}:`, err);
          failedCount++;
        }

        if (onProgress) {
          onProgress({
            completed: i + 1,
            total,
            percent: Math.round(((i + 1) / total) * 100)
          });
        }
        await new Promise(r => setTimeout(r, 20));
      }
    } else if (snapshot.type === 'import') {
      // Undo imports by removing only the exact items created by that import.
      // User-created content inside an imported folder keeps that folder safe.
      for (let i = 0; i < total; i++) {
        const item = items[i];
        try {
          const exists = await this.bookmarksApi.get(item.id);
          if (exists?.length) await this.bookmarksApi.remove(item.id);
          restoredCount++;
        } catch (err) {
          console.warn(`Could not remove imported bookmark ${item.id}:`, err);
          failedCount++;
        }
        onProgress?.({ completed: i + 1, total, percent: total ? Math.round(((i + 1) / total) * 100) : 100 });
      }
      for (const folderId of [...(snapshot.createdFolders || [])].reverse()) {
        try {
          const exists = await this.bookmarksApi.get(folderId);
          if (!exists?.length) continue;
          const children = await this.bookmarksApi.getChildren(folderId);
          if (children.length) failedCount++;
          else await this.bookmarksApi.remove(folderId);
        } catch {
          // A folder already removed is an idempotent success.
        }
      }
    } else if (snapshot.type === 'sample_generation') {
      // Delete generated sample bookmarks
      for (let i = 0; i < total; i++) {
        const item = items[i];
        try {
          await this.bookmarksApi.remove(item.id);
          restoredCount++;
        } catch (err) {
          console.warn(`Could not remove sample bookmark ${item.id}:`, err);
          failedCount++;
        }

        if (onProgress) {
          onProgress({
            completed: i + 1,
            total,
            percent: Math.round(((i + 1) / total) * 100)
          });
        }
        await new Promise(r => setTimeout(r, 20));
      }

      // Clean up created empty folders bottom-up
      if (snapshot.createdFolders && snapshot.createdFolders.length > 0) {
        const reversedFolders = [...snapshot.createdFolders].reverse();
        for (const folderId of reversedFolders) {
          try {
            const children = await this.bookmarksApi.getChildren(folderId);
            if (children && children.length === 0) {
              await this.bookmarksApi.remove(folderId);
            }
          } catch {
            // ignore
          }
        }
      }

      // Also clean up any empty standard test folders
      const testFolderNames = new Set(['Old Folder A', 'Random Links', 'Unsorted']);
      try {
        const tree = await this.bookmarksApi.getTree();
        const cleanTestFolders = async (nodes) => {
          for (const node of nodes) {
            if (node.children) {
              await cleanTestFolders(node.children);
              if (testFolderNames.has(node.title)) {
                try {
                  const freshChildren = await this.bookmarksApi.getChildren(node.id);
                  if (freshChildren && freshChildren.length === 0) {
                    await this.bookmarksApi.remove(node.id);
                  }
                } catch {}
              }
            }
          }
        };
        await cleanTestFolders(tree);
      } catch {}

      // Clear tracking in storage
      if (this.storage) {
        try {
          await this.storage.set({ organizer_sample_bookmarks: null });
        } catch {}
      }
    } else {
      // Standard reorganization reversal or scatter reversal
      for (let i = 0; i < total; i++) {
        const item = items[i];
        try {
          // Verify bookmark still exists in Chrome
          const exists = await this.bookmarksApi.get(item.id);
          if (exists && exists.length > 0) {
            let targetParentId = item.originalParentId;

            // Check if original parent still exists
            let parentExists = false;
            try {
              const parentNode = await this.bookmarksApi.get(targetParentId);
              if (parentNode && parentNode.length > 0) {
                parentExists = true;
              }
            } catch {
              parentExists = false;
            }

            // If original parent was deleted (e.g. via cleanEmptyFolders), recreate it or fallback
            if (!parentExists) {
              if (item.originalFolderPath && item.originalFolderPath.length > 0) {
                const firstSegment = (item.originalFolderPath[0] || '').toLowerCase();
                const fallbackRoot = firstSegment.includes('other') || String(item.originalParentId) === '2' ? '2' : '1';
                targetParentId = await this.getOrCreateFolderPath(item.originalFolderPath, fallbackRoot);
              } else {
                targetParentId = String(item.originalParentId) === '2' ? '2' : '1';
              }
            }

            const moveProps = { parentId: targetParentId };
            if (typeof item.originalIndex === 'number') {
              moveProps.index = item.originalIndex;
            }

            try {
              await this.bookmarksApi.move(item.id, moveProps);
            } catch (moveErr) {
              if (moveProps.index !== undefined) {
                // Retry move without index if index out of bounds
                await this.bookmarksApi.move(item.id, { parentId: targetParentId });
              } else {
                throw moveErr;
              }
            }
            restoredCount++;
          } else {
            failedCount++;
          }
        } catch (err) {
          console.warn(`Could not restore bookmark ${item.id}:`, err);
          failedCount++;
        }

        if (onProgress) {
          onProgress({
            completed: i + 1,
            total,
            percent: Math.round(((i + 1) / total) * 100)
          });
        }

        await new Promise(r => setTimeout(r, 20));
      }

      // Clean up created empty folders bottom-up (reverse order: leaf first, parent last)
      if (snapshot.createdFolders && snapshot.createdFolders.length > 0) {
        const reversedFolders = [...snapshot.createdFolders].reverse();
        for (const folderId of reversedFolders) {
          try {
            const children = await this.bookmarksApi.getChildren(folderId);
            if (children && children.length === 0) {
              await this.bookmarksApi.remove(folderId);
            }
          } catch {
            // Folder may have already been removed or non-empty
          }
        }
      }

      // If restoring a scatter operation, also ensure empty test folders are cleaned up
      if (snapshot.type === 'scatter') {
        const testFolderNames = new Set(['Old Folder A', 'Random Links', 'Unsorted']);
        try {
          const tree = await this.bookmarksApi.getTree();
          const cleanScatterFolders = async (nodes) => {
            for (const node of nodes) {
              if (node.children) {
                await cleanScatterFolders(node.children);
                if (testFolderNames.has(node.title)) {
                  try {
                    const freshChildren = await this.bookmarksApi.getChildren(node.id);
                    if (freshChildren && freshChildren.length === 0) {
                      await this.bookmarksApi.remove(node.id);
                    }
                  } catch {}
                }
              }
            }
          };
          await cleanScatterFolders(tree);
        } catch {}
      }
    }

    // Update status in storage
    snapshots[snapshotIndex].status = failedCount ? 'active' : 'restored';
    if (!failedCount) snapshots[snapshotIndex].restoredAt = new Date().toISOString();

    if (this.storage) {
      await this.storage.set({ [this.STORAGE_KEY]: snapshots });
    }

    return {
      success: failedCount === 0,
      restoredCount,
      failedCount,
      total
    };
  }

  /**
   * Delete a snapshot from history
   */
  async deleteSnapshot(snapshotId) {
    const snapshots = await this.getAllSnapshots();
    const filtered = snapshots.filter(s => s.id !== snapshotId);
    if (this.storage) {
      await this.storage.set({ [this.STORAGE_KEY]: filtered });
    }
    return true;
  }

  /**
   * Export all bookmarks as a JSON backup
   */
  async exportFullBackup() {
    if (!this.bookmarksApi) {
      throw new Error('Chrome Bookmarks API is not available.');
    }
    const tree = await this.bookmarksApi.getTree();
    const backupData = {
      app: 'Smart Bookmark Organizer',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      tree
    };
    return JSON.stringify(backupData, null, 2);
  }

  /**
   * Import bookmarks from a backup JSON string.
   * Recreates folders and bookmarks safely into a designated folder.
   */
  async importBackup(backupJsonString, options = {}, onProgress = null) {
    if (!this.bookmarksApi) {
      throw new Error('Chrome Bookmarks API is not available.');
    }

    if (typeof backupJsonString !== 'string') throw new Error('Backup must be a JSON text file.');
    const maxBytes = Number(options.maxBytes || 5 * 1024 * 1024);
    if (new TextEncoder().encode(backupJsonString).length > maxBytes) {
      throw new Error('Backup is too large. The maximum supported size is 5 MB.');
    }

    let parsed;
    try {
      parsed = JSON.parse(backupJsonString);
    } catch {
      throw new Error('Invalid JSON file format.');
    }

    const tree = parsed.tree || (Array.isArray(parsed) ? parsed : null);
    if (!tree || !Array.isArray(tree) || tree.length === 0) {
      throw new Error('Backup does not contain a valid bookmark tree structure.');
    }

    const maxNodes = Number(options.maxNodes || 50000);
    const maxDepth = Number(options.maxDepth || 100);
    let nodeCount = 0;
    const validateNode = (node, depth = 0) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) throw new Error('Backup contains an invalid bookmark entry.');
      if (depth > maxDepth) throw new Error(`Backup folder nesting is deeper than ${maxDepth} levels.`);
      nodeCount++;
      if (nodeCount > maxNodes) throw new Error(`Backup contains more than ${maxNodes.toLocaleString()} entries.`);
      if (node.children !== undefined && !Array.isArray(node.children)) throw new Error('Backup contains a folder with invalid children.');
      if (node.url !== undefined) {
        if (typeof node.url !== 'string' || node.url.length > 8192) throw new Error('Backup contains an invalid or unusually long URL.');
        let protocol;
        try { protocol = new URL(node.url).protocol.toLowerCase(); }
        catch { throw new Error('Backup contains a malformed bookmark URL.'); }
        const safeProtocols = new Set(['http:', 'https:', 'ftp:', 'file:', 'chrome:', 'edge:', 'about:']);
        if (!safeProtocols.has(protocol) && !options.allowUnsafeSchemes) {
          throw new Error(`Backup contains a blocked ${protocol || 'unknown'} bookmark URL.`);
        }
      }
      for (const child of node.children || []) validateNode(child, depth + 1);
    };
    for (const node of tree) validateNode(node);

    const dateStr = parsed.exportedAt
      ? new Date(parsed.exportedAt).toLocaleDateString()
      : new Date().toLocaleDateString();

    const rootContainerTitle = options.containerFolderTitle || `Restored Backup (${dateStr})`;
    const targetParentId = String(options.targetParentId || options.targetRootParentId || '1'); // Bookmarks Bar

    // Create container folder for the imported tree
    const rootFolder = await this.bookmarksApi.create({
      parentId: targetParentId,
      title: rootContainerTitle
    });

    let importedBookmarksCount = 0;
    let importedFoldersCount = 1;
    const createdItems = [];
    const createdFolders = [rootFolder.id];
    let snapshot;
    try {
      snapshot = await this.saveSnapshot(
        `Backup import in progress (${dateStr})`,
        createdItems,
        createdFolders,
        'import',
        { status: 'pending' }
      );
    } catch (error) {
      try { await this.bookmarksApi.remove(rootFolder.id); } catch {}
      throw error;
    }

    const persistProgress = () => this.updateSnapshot(snapshot.id, {
      items: [...createdItems],
      createdFolders: [...createdFolders],
      status: 'pending'
    });

    const importNode = async (node, parentFolderId) => {
      if (node.children) {
        // System roots: traverse children directly into root container
        const isSystemRoot = !node.parentId || node.parentId === '0' || ['0', '1', '2', '3'].includes(node.id);

        let currentFolderId = parentFolderId;
        if (!isSystemRoot && node.title) {
          const newFolder = await this.bookmarksApi.create({
            parentId: parentFolderId,
            title: node.title
          });
          currentFolderId = newFolder.id;
          importedFoldersCount++;
          createdFolders.push(newFolder.id);
          await persistProgress();
        }

        for (const child of node.children) {
          await importNode(child, currentFolderId);
        }
      } else if (node.url) {
        const newBm = await this.bookmarksApi.create({
          parentId: parentFolderId,
          title: node.title || 'Untitled Bookmark',
          url: node.url
        });
        importedBookmarksCount++;
        createdItems.push({
          id: newBm.id,
          title: newBm.title,
          url: newBm.url,
          newParentId: parentFolderId
        });
        await persistProgress();

        if (onProgress) {
          onProgress({
            importedBookmarksCount,
            importedFoldersCount,
            currentTitle: newBm.title
          });
        }
      }
    };

    for (const topNode of tree) {
      await importNode(topNode, rootFolder.id);
    }

    await this.updateSnapshot(snapshot.id, {
      title: `Import of ${importedBookmarksCount} bookmarks from backup (${dateStr})`,
      items: [...createdItems],
      createdFolders: [...createdFolders],
      status: 'active'
    });

    return {
      success: true,
      rootFolderId: rootFolder.id,
      rootFolderTitle: rootContainerTitle,
      importedBookmarksCount,
      importedFoldersCount
    };
  }
}
