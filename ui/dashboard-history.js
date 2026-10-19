import { escapeHtml, showConfirmModal, showToast } from './dashboard-utils.js';

const alert = message => showToast(message);

export class DashboardHistoryController {
  constructor(undoManager, onRefreshRequested) {
    this.undoManager = undoManager;
    this.onRefreshRequested = onRefreshRequested;

    this.container = document.getElementById('snapshotsList');
    this.badge = document.getElementById('badgeHistoryCount');
    this.btnExport = document.getElementById('btnDownloadCurrentBackup');
    this.fileImport = document.getElementById('fileImportBackup');

    this.progressModal = document.getElementById('progressModal');
    this.progressTitle = document.getElementById('progressModalTitle');
    this.progressDesc = document.getElementById('progressModalDesc');
    this.progressBar = document.getElementById('progressBarFill');
    this.progressStats = document.getElementById('progressStats');

    this.setupActions();
  }

  setupActions() {
    if (this.btnExport) {
      this.btnExport.addEventListener('click', async () => {
        await this.downloadBackupJson();
      });
    }

    if (this.fileImport) {
      this.fileImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          alert('This backup is larger than 5 MB and cannot be imported safely.');
          e.target.value = '';
          return;
        }

        const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const jsonText = ev.target.result;
          const parsed = JSON.parse(jsonText);
          const tree = parsed.tree || (Array.isArray(parsed) ? parsed : null);
          if (!tree) {
            throw new Error('Invalid backup file format. Missing bookmark tree structure.');
          }

          const exportDate = parsed.exportedAt
            ? new Date(parsed.exportedAt).toLocaleString()
            : 'Unknown Date';

          showConfirmModal(
            'Import Bookmarks from Backup',
            `<p>Reconstruct folders and bookmarks from backup (Exported: <strong>${escapeHtml(exportDate)}</strong>)?</p>
             <p style="margin-top: 8px; font-size: 13px; color: var(--text-muted);">
               All backed-up bookmarks will be safely created into a new dedicated folder (<strong>Restored Backup</strong>) under your Bookmarks Bar. No existing bookmarks will be deleted.
             </p>`,
            async () => {
              this.progressTitle.textContent = 'Importing Backup...';
              this.progressDesc.textContent = 'Rebuilding folders and bookmarks from JSON file...';
              this.progressBar.style.width = '50%';
              this.progressModal.style.display = 'flex';

              try {
                const result = await this.undoManager.importBackup(jsonText, {}, (prog) => {
                  this.progressStats.textContent = `Imported ${prog.importedBookmarksCount} bookmarks...`;
                });

                setTimeout(async () => {
                  this.progressModal.style.display = 'none';
                  alert(`🎉 Successfully imported ${result.importedBookmarksCount} bookmarks into "${result.rootFolderTitle}"!`);
                  if (this.onRefreshRequested) await this.onRefreshRequested();
                  await this.render();
                }, 400);
              } catch (importErr) {
                this.progressModal.style.display = 'none';
                alert('Import error: ' + importErr.message);
              }
            }
          );
        } catch (err) {
          alert('Failed to read backup file: ' + err.message);
        } finally {
          // Reset file input so same file can be picked again if needed
          e.target.value = '';
        }
      };
      reader.readAsText(file);
      });
    }
  }

  async downloadBackupJson() {
    try {
      const jsonStr = await this.undoManager.exportFullBackup();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `chrome_bookmarks_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error exporting backup: ' + err.message);
    }
  }

  async render() {
    const snapshots = await this.undoManager.getAllSnapshots();
    this.badge.textContent = snapshots.length;

    if (snapshots.length === 0) {
      this.container.innerHTML = `
        <div class="empty-message">
          <div style="font-size: 32px; margin-bottom: 10px;">📜</div>
          <h3>No Reorganization History</h3>
          <p style="margin-top: 6px; font-size: 13px;">Whenever you organize bookmarks or clean duplicates, a reversible snapshot is stored here.</p>
        </div>
      `;
      return;
    }

    this.container.innerHTML = '';

    for (const snap of snapshots) {
      const card = document.createElement('div');
      card.className = 'snapshot-card';

      const dateStr = new Date(snap.timestamp).toLocaleString();
      const isActive = snap.status === 'active' || snap.status === 'pending';
      const isPending = snap.status === 'pending';
      const snapTypeLabel = snap.type === 'duplicate_removal'
        ? 'Duplicate Cleanup'
        : snap.type === 'auto_organization'
        ? 'Automatic Organization'
        : snap.type === 'folder_reset'
        ? 'Folder Reset'
        : snap.type === 'import'
        ? 'Backup Import'
        : snap.type === 'scatter'
        ? '🎲 Bookmark Scatter'
        : snap.type === 'sample_generation'
        ? '🧪 Sample Generation'
        : 'Reorganization';

      card.innerHTML = `
        <div>
          <div class="snapshot-title">${escapeHtml(snap.title)}</div>
          <div class="snapshot-meta">
            <span>📅 ${dateStr}</span>
            <span>📦 ${snap.totalMoved || (snap.items ? snap.items.length : 0)} items</span>
            <span style="font-size: 11px; background: #e0e7ff; color: #3730a3; padding: 1px 6px; border-radius: 4px; font-weight: 600;">
              ${snapTypeLabel}
            </span>
            <span class="snapshot-status ${isActive ? 'status-active' : 'status-restored'}">
              ${isPending ? 'Recovery Available' : isActive ? 'Active State' : 'Restored'}
            </span>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary btn-sm btn-restore-snap" data-id="${snap.id}" ${!isActive ? 'disabled' : ''}>
            ↩️ Restore This State
          </button>
          <button class="btn btn-outline btn-sm btn-delete-snap" data-id="${snap.id}" title="Remove record">
            🗑️
          </button>
        </div>
      `;

      card.querySelector('.btn-restore-snap').addEventListener('click', () => {
        let actionPrompt = `Restore <strong>${snap.totalMoved}</strong> bookmarks back to their exact previous folders and indices?`;
        if (snap.type === 'duplicate_removal') {
          actionPrompt = `Restore <strong>${snap.totalMoved}</strong> previously removed duplicate bookmarks back to their folders?`;
        } else if (snap.type === 'folder_reset') {
          actionPrompt = `Restore the original folder structure, including empty folders, and return <strong>${snap.totalMoved}</strong> bookmarks to their previous locations?`;
        } else if (snap.type === 'scatter') {
          actionPrompt = `Restore <strong>${snap.totalMoved}</strong> scattered bookmarks back to their original organized folders and clean up test folders?`;
        } else if (snap.type === 'sample_generation') {
          const count = snap.items ? snap.items.length : 25;
          actionPrompt = `Remove the <strong>${count}</strong> sample bookmarks generated for testing and clean up test folders?`;
        } else if (snap.type === 'import') {
          actionPrompt = `Remove the <strong>${snap.totalMoved || 0}</strong> bookmarks created by this backup import? Any other bookmarks added later will be kept.`;
        }

        showConfirmModal(
          'Revert Organization State',
          `<p>${actionPrompt}</p>`,
          async () => {
            this.progressTitle.textContent = 'Restoring Bookmarks...';
            this.progressDesc.textContent = 'Relocating bookmarks back to their original state...';
            this.progressBar.style.width = '0%';
            this.progressModal.style.display = 'flex';

            let res;
            try {
              res = await this.undoManager.restoreSnapshot(snap.id, (prog) => {
              this.progressBar.style.width = `${prog.percent}%`;
              this.progressStats.textContent = `${prog.percent}% (${prog.completed} / ${prog.total})`;
              });
            } catch (error) {
              this.progressModal.style.display = 'none';
              alert(`Restore stopped: ${error.message}. The snapshot is available to retry.`);
              return;
            }

            setTimeout(async () => {
              this.progressModal.style.display = 'none';
              if (snap.type === 'folder_reset') {
                const notice = document.getElementById('organizationNotice');
                if (notice) {
                  notice.hidden = false;
                  notice.textContent = res.success
                    ? 'Folder reset undone. The original folders and bookmark order have been restored.'
                    : 'Folder reset partly undone. Some items could not be restored; retry from Undo history.';
                }
              }
              alert(res.success ? `Successfully restored ${res.restoredCount} bookmarks!` : `Restored ${res.restoredCount} bookmarks; ${res.failedCount} operations failed. Check Undo history to retry a folder reset.`);
              if (this.onRefreshRequested) await this.onRefreshRequested();
              await this.render();
            }, 350);
          }
        );
      });

      card.querySelector('.btn-delete-snap').addEventListener('click', () => {
        showConfirmModal(
          'Delete Snapshot',
          `<p>Remove snapshot <strong>"${escapeHtml(snap.title)}"</strong> from history?</p>`,
          async () => {
            await this.undoManager.deleteSnapshot(snap.id);
            await this.render();
          }
        );
      });

      this.container.appendChild(card);
    }
  }
}
