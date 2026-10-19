import { needsBookmarkReview, assignReviewedFolder } from '../core/classification-evidence.js';
import { escapeHtml, showToast } from './dashboard-utils.js';

const alert = message => showToast(message);

export function renderBookmarkReview(state, refresh, remember) {
  const panel = document.getElementById('bookmarkReview');
  if (!panel) return;
  const items = state.plan.filter(needsBookmarkReview);
  panel.hidden = state.reviewComplete || !items.length;
  if (panel.hidden) { panel.replaceChildren(); return; }
  const limit = Number(panel.dataset.limit || 50);
  panel.innerHTML = `<details class="review-details">
    <summary><span><strong>${items.length} ${items.length === 1 ? 'bookmark needs' : 'bookmarks need'} your choice</strong><small>Open to choose a folder or leave them where they are.</small></span><span class="review-chevron">▾</span></summary>
    <div class="review-details-body">
      <button type="button" class="btn btn-outline keep-all">Leave all in place</button>
      <div class="review-links"></div>
      ${items.length > limit ? `<button type="button" class="btn btn-outline show-more">Show more (${items.length - limit} remaining)</button>` : ''}
      <p class="review-save-status" role="status"></p>
    </div>
  </details>`;
  const list = panel.querySelector('.review-links');
  for (const item of items.slice(0, limit)) {
    const row = document.createElement('div');
    row.className = 'review-link';
    const paths = new Map();
    if (item.proposedCategoryId !== 'other' && item.proposedPath?.length) {
      paths.set(item.proposedPath.join(' / '), item.proposedPath);
    }
    for (const cat of state.categories) {
      paths.set(cat.name, [cat.name]);
      for (const sub of cat.subcategories || []) paths.set(`${cat.name} / ${sub.name}`, [cat.name, sub.name]);
    }
    const options = [...paths.keys()];
    row.innerHTML = `<div class="review-link-info"><strong>${escapeHtml(item.title || 'Untitled bookmark')}</strong>
      <span>${escapeHtml(item.url)}</span><small>${escapeHtml(item.matchReason || 'No confident match')}</small>
      <small>Suggested: ${escapeHtml(item.proposedFolderDisplay)}${item.alternatives?.length ? ` · Also possible: ${escapeHtml(item.alternatives.map(a => a.categoryName).join(', '))}` : ''}</small></div>
      <div class="review-link-actions"><select class="form-select" aria-label="Folder for ${escapeHtml(item.title || 'bookmark')}">
      <option value="">Choose a folder…</option>${options.map((name, i) => `<option value="${i}">${escapeHtml(name)}</option>`).join('')}</select>
      ${item.proposedCategoryId !== 'other' ? '<button type="button" class="btn btn-outline accept">Use suggestion</button>' : ''}
      <button type="button" class="btn btn-outline keep">Leave in place</button></div>`;
    const choose = async path => {
      assignReviewedFolder(item, path, state.categories);
      let error = null;
      try { await remember(item.url, path); } catch (err) { error = err; }
      refresh();
      if (error) {
        // The current choice still applies even when Chrome storage is full.
        alert('Folder chosen for this run, but the preference could not be saved.');
      }
    };
    row.querySelector('select').onchange = e => {
      if (e.target.value !== '') void choose(paths.get(options[Number(e.target.value)]));
    };
    const accept = row.querySelector('.accept');
    if (accept) accept.onclick = () => void choose(item.proposedPath);
    row.querySelector('.keep').onclick = () => {
      item.reviewDecision = 'keep'; item.selected = false; refresh();
    };
    list.appendChild(row);
  }
  panel.querySelector('.keep-all').onclick = () => {
    for (const item of items) { item.reviewDecision = 'keep'; item.selected = false; }
    refresh();
  };
  const more = panel.querySelector('.show-more');
  if (more) more.onclick = () => { panel.dataset.limit = String(limit + 50); refresh(); };
}

export function showOrganizationResult(state, result) {
  state.reviewComplete = true;
  const panel = document.getElementById('organizationResult');
  if (!panel) return;
  panel.hidden = false;
  const moved = new Set((result.movedItems || []).map(item => item.id));
  const folders = new Map();
  for (const item of state.plan) {
    if (!moved.has(item.id)) continue;
    const name = item.proposedFolderDisplay;
    folders.set(name, (folders.get(name) || 0) + 1);
  }
  panel.innerHTML = `<h2>${result.cancelled ? 'Organization stopped' : result.failedItems?.length ? 'Organization partly completed' : 'Organization complete'}</h2>
    <p><strong>${result.totalMoved}</strong> bookmarks moved. Unselected links were left in their original locations.</p>
    ${result.failedItems?.length ? `<p>${result.failedItems.length} bookmarks could not be moved. Start a new review to retry.</p>` : ''}
    <ul>${[...folders].map(([name, count]) => `<li>${escapeHtml(name)} — ${count}</li>`).join('')}</ul>
    <p>Changes are saved in Undo history. Start a new review whenever you want to organize more bookmarks.</p>
    <button type="button" class="btn btn-primary" id="btnNewBookmarkReview">Start a new review</button>`;
  document.getElementById('bookmarkReview').hidden = true;
  document.getElementById('viewSimpleMode').style.display = 'none';
  document.getElementById('viewAdvancedMode').style.display = 'none';
  panel.querySelector('button').onclick = () => document.getElementById('btnRescan').click();
}
