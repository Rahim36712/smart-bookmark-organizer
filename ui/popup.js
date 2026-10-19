import { BookmarkTreeManager } from '../core/bookmark-tree.js';
import { BookmarkCategorizer } from '../core/categorizer.js';
import { SettingsManager } from '../core/storage.js';
import { UndoManager } from '../core/undo-manager.js';
import { eligibleBookmarks, applyConfidenceDefaults, markCurrentDestinations } from '../core/organization-safety.js';

document.addEventListener('DOMContentLoaded', async () => {
  const status = document.getElementById('statusMessage');
  const openDashboard = (hash = '') => chrome.tabs.create({ url: chrome.runtime.getURL('ui/dashboard.html') + hash });
  document.getElementById('btnQuickOrganize').onclick = () => openDashboard();
  document.getElementById('btnQuickUndo').onclick = () => openDashboard('#history');
  try {
    const manager = new SettingsManager();
    const settings = await manager.getSettings();
    const treeManager = new BookmarkTreeManager();
    const scan = await treeManager.scanBookmarks();
    const categorizer = new BookmarkCategorizer(await manager.getCategories(), {
      learnedRules: await manager.getLearnedRules(), useSubcategories: settings.useSubcategories
    });
    const plan = applyConfidenceDefaults(treeManager.buildProposedPlan(eligibleBookmarks(scan, settings), categorizer, settings), settings);
    markCurrentDestinations(plan, scan, settings);
    const pending = plan.filter(p => p.selected && !p.isAlreadyOrganized).length;
    document.getElementById('statPending').textContent = pending.toLocaleString();
    document.getElementById('popupModeBadge').textContent = settings.geminiEnabled && settings.geminiApiKey ? 'Gemini AI enabled' : 'Local mode · private';
    status.textContent = pending ? pending + ' links have local folder suggestions. Review them before moving.' : 'Your library is ready to review. You choose what moves.';
    const snapshots = await new UndoManager().getAllSnapshots();
    const active = snapshots.find(s => s.status === 'active' || s.status === 'pending');
    document.getElementById('btnQuickUndo').hidden = !active;
  } catch (err) {
    status.textContent = 'Could not read your bookmarks. Open the dashboard and try Scan again.';
    console.error(err);
  }
});
