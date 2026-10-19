import { escapeHtml } from './dashboard-utils.js';
import { eligibleBookmarks } from '../core/organization-safety.js';
import { needsBookmarkReview } from '../core/classification-evidence.js';

export function renderGuidance(state, settingsManager, refresh) {
  const welcome = document.getElementById('welcomeCard');
  if (welcome) welcome.hidden = Boolean(state.settings.onboardingComplete);
  const dismiss = document.getElementById('btnStartReview');
  if (dismiss) dismiss.onclick = async () => {
    await settingsManager.saveSettings({ onboardingComplete: true });
    state.settings.onboardingComplete = true;
    welcome.hidden = true;
    document.getElementById('reviewSummary')?.scrollIntoView({ behavior: 'smooth' });
  };
  const confidence = document.getElementById('highConfidenceOnly');
  if (confidence) {
    confidence.checked = state.settings.highConfidenceOnly !== false;
    confidence.onchange = async () => {
      await settingsManager.saveSettings({ highConfidenceOnly: confidence.checked });
      await refresh();
    };
  }
  const list = document.getElementById('protectedFolders');
  if (!list || !state.scanResult) return;
  const selected = new Set((state.settings.excludedFolderIds || []).map(String));
  list.innerHTML = state.scanResult.folders.filter(f => f.parentId && f.id !== '0').map(f => `
    <label class="protected-folder"><input type="checkbox" value="${escapeHtml(f.id)}" ${selected.has(String(f.id)) ? 'checked' : ''}>
    <span>${escapeHtml(f.path.join(' / ') || f.title)}</span></label>`).join('') || '<p>No folders yet.</p>';
  list.onchange = async () => {
    const ids = Array.from(list.querySelectorAll('input:checked'), input => input.value);
    await settingsManager.saveSettings({ excludedFolderIds: ids });
    await refresh();
  };
}

export function renderReviewSummary(state) {
  const summary = document.getElementById('reviewSummary');
  if (!summary || !state.scanResult) return;
  const ready = state.plan.filter(p => p.selected && !p.isAlreadyOrganized).length;
  const review = state.plan.filter(needsBookmarkReview).length;
  const kept = state.plan.filter(p => !p.selected && !p.isAlreadyOrganized && !needsBookmarkReview(p)).length;
  const inPlace = state.plan.filter(p => p.isAlreadyOrganized).length;
  const protectedCount = state.scanResult.bookmarks.length - eligibleBookmarks(state.scanResult, state.settings).length;
  const help = document.getElementById('reviewHelp');
  if (help) {
    const extra = [inPlace ? `${inPlace} already organized` : '', protectedCount ? `${protectedCount} protected` : ''].filter(Boolean).join(' · ');
    help.textContent = `${state.settings.highConfidenceOnly !== false ? 'Strong matches are selected first.' : 'All classified suggestions are selected first.'} Change the selection from any folder.${extra ? ` ${extra}.` : ''}`;
  }
  summary.innerHTML = `<div><strong>${ready}</strong><span>selected to move</span></div>
    <div><strong>${review}</strong><span>need review${kept ? ` · ${kept} left in place` : ''}</span></div>`;
}
