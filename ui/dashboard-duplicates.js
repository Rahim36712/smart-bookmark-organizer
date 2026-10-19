import { escapeHtml, safeBookmarkHref, showConfirmModal, showToast } from './dashboard-utils.js';

const alert = message => showToast(message);

export class DashboardDuplicatesController {
  constructor(treeManager, undoManager, onRefreshRequested) {
    this.treeManager = treeManager;
    this.undoManager = undoManager;
    this.onRefreshRequested = onRefreshRequested;
    this.selectedDuplicateIds = new Set();

    this.container = document.getElementById('duplicateClustersList');
    this.btnDelete = document.getElementById('btnDeleteSelectedDuplicates');
    this.txtCount = document.getElementById('txtDuplicateSelectedCount');

    this.setupActions();
  }

  setupActions() {
    if (this.btnDelete) {
      this.btnDelete.onclick = () => {
        const count = this.selectedDuplicateIds.size;
        if (count === 0) return;

      showConfirmModal(
        '⚠️ Confirm Duplicate Removal',
        `<p style="color: var(--danger); font-weight: 600;">You have selected ${count} duplicate bookmark(s) to remove.</p>
         <p style="margin-top: 8px; font-size: 13px; line-height: 1.5;">
           The primary copy of each bookmark will be safely preserved in your collection.
         </p>
         <p style="margin-top: 8px; font-size: 13px; line-height: 1.5; color: var(--text-muted);">
           🛡️ <strong>100% Reversible:</strong> An undo snapshot will be saved so you can restore these removed duplicates anytime from the Restore &amp; Undo tab.
         </p>`,
        async () => {
          const ids = Array.from(this.selectedDuplicateIds);
          const plannedRecords = [];
          for (const id of ids) {
            try {
              const bookmark = (await this.treeManager.bookmarksApi.get(id))?.[0];
              if (bookmark?.url) {
                plannedRecords.push({
                  id: bookmark.id,
                  title: bookmark.title,
                  url: bookmark.url,
                  originalParentId: bookmark.parentId,
                  originalIndex: bookmark.index
                });
              }
            } catch {}
          }

          // Save recovery information before deleting the first bookmark.
          const safetySnapshot = plannedRecords.length && this.undoManager
            ? await this.undoManager.saveSnapshot(
              `Duplicate cleanup in progress (${plannedRecords.length} bookmarks)`,
              plannedRecords,
              [],
              'duplicate_removal',
              { status: 'pending' }
            )
            : null;
          const results = await this.treeManager.removeDuplicates(ids);

          const deletedRecords = results.filter(r => r.success && r.bookmark).map(r => ({
              id: r.bookmark.id,
              title: r.bookmark.title,
              url: r.bookmark.url,
              originalParentId: r.bookmark.parentId,
              originalIndex: r.bookmark.index
            }));
          if (safetySnapshot && deletedRecords.length) {
            await this.undoManager.updateSnapshot(safetySnapshot.id, {
              title: `Duplicate cleanup: removed ${deletedRecords.length} duplicate bookmarks`,
              items: deletedRecords,
              status: 'active'
            });
          } else if (safetySnapshot) {
            await this.undoManager.deleteSnapshot(safetySnapshot.id);
          }

          const failedCount = results.length - deletedRecords.length;
          alert(failedCount
            ? `${deletedRecords.length} duplicate bookmarks removed. ${failedCount} could not be removed.`
            : `${deletedRecords.length} duplicate bookmarks removed. You can restore them from Undo history.`);
          if (this.onRefreshRequested) await this.onRefreshRequested();
        }
      );
      };
    }
  }

  updateCounter() {
    const count = this.selectedDuplicateIds.size;
    if (this.txtCount) this.txtCount.textContent = count;
    if (this.btnDelete) this.btnDelete.disabled = count === 0;
  }

  render(duplicates) {
    this.selectedDuplicateIds.clear();
    this.updateCounter();

    if (!duplicates || duplicates.length === 0) {
      this.container.innerHTML = `
        <div class="empty-message">
          <div style="font-size: 32px; margin-bottom: 10px;">✨</div>
          <h3>No Duplicate Bookmarks Detected</h3>
          <p style="margin-top: 6px; font-size: 13px;">Every bookmark in your collection points to a unique destination URL.</p>
        </div>
      `;
      return;
    }

    this.container.innerHTML = '';

    for (const group of duplicates) {
      const card = document.createElement('div');
      card.className = 'duplicate-cluster';

      let itemsHtml = '';
      group.bookmarks.forEach((bm, idx) => {
        const isMaster = idx === 0;
        const dateStr = bm.dateAdded ? new Date(bm.dateAdded).toLocaleDateString() : 'Unknown';

        itemsHtml += `
          <div class="duplicate-item-row">
            <div class="duplicate-item-info">
              <label class="checkbox-container">
                <input type="checkbox" class="duplicate-chk" data-id="${bm.id}" ${isMaster ? '' : 'checked'}>
                <span class="checkmark"></span>
              </label>
              <div>
                <div style="font-weight: 600; font-size: 13px;">
                  ${escapeHtml(bm.title)}
                  ${isMaster ? '<span style="font-size: 10px; color: #059669; background: #d1fae5; padding: 2px 6px; border-radius: 6px; margin-left: 6px;">Primary Copy (Keep)</span>' : ''}
                </div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                  📁 Location: <strong>${escapeHtml((bm.folderPath || []).join(' > ') || 'Bookmarks Bar')}</strong> &middot; Added: ${dateStr}
                </div>
              </div>
            </div>
            ${safeBookmarkHref(bm.url)
              ? `<a href="${escapeHtml(safeBookmarkHref(bm.url))}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">Open Link</a>`
              : '<span class="btn btn-outline btn-sm" aria-disabled="true">Cannot open safely</span>'}
          </div>
        `;

        if (!isMaster) {
          this.selectedDuplicateIds.add(bm.id);
        }
      });

      card.innerHTML = `
        <div class="duplicate-cluster-header">
          <div>
            <div class="duplicate-url-title">${escapeHtml(group.normalizedUrl)}</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px;">
              ${group.count} copies across scattered folders
            </div>
          </div>
        </div>
        <div class="duplicate-items-list">
          ${itemsHtml}
        </div>
      `;

      card.querySelectorAll('.duplicate-chk').forEach(chk => {
        chk.addEventListener('change', (e) => {
          const id = e.target.dataset.id;
          if (e.target.checked) {
            this.selectedDuplicateIds.add(id);
          } else {
            this.selectedDuplicateIds.delete(id);
          }
          this.updateCounter();
        });
      });

      this.container.appendChild(card);
    }

    this.updateCounter();
  }
}
