import { BookmarkTreeManager } from '../core/bookmark-tree.js';
import { BookmarkCategorizer } from '../core/categorizer.js';
import { OTHER_CATEGORY } from '../core/default-rules.js';
import { UndoManager } from '../core/undo-manager.js';
import { buildFolderResetPlan, resetBookmarkFolders } from '../core/folder-reset.js';
import { SettingsManager } from '../core/storage.js';
import { GeminiService } from '../core/gemini-service.js';
import { eligibleBookmarks, applyConfidenceDefaults, markCurrentDestinations } from '../core/organization-safety.js';
import { renderGuidance, renderReviewSummary } from './dashboard-guidance.js';
import { renderBookmarkReview, showOrganizationResult } from './dashboard-review.js';
import { DashboardDuplicatesController } from './dashboard-duplicates.js';
import { DashboardHistoryController } from './dashboard-history.js';
import { DashboardSettingsController } from './dashboard-settings.js';
import { escapeHtml, safeBookmarkHref, showConfirmModal, showToast, resolveDestinationSettings, getDestinationLocationLabel } from './dashboard-utils.js';
export { resolveDestinationSettings, getDestinationLocationLabel } from './dashboard-utils.js';

const alert = message => showToast(message);

// Core State
const state = {
  scanResult: null,
  categorizer: null,
  categories: [],
  plan: [],
  filteredPlan: [],
  planSource: 'heuristic',
  reviewComplete: false,
  activeCategoryFilter: 'all',
  activeSourceFolderFilter: 'all',
  searchQuery: '',
  settings: {},
  uiMode: 'simple',
  geminiService: new GeminiService()
};

// Managers
const treeManager = new BookmarkTreeManager();
const undoManager = new UndoManager();
const settingsManager = new SettingsManager();

// Controllers
let duplicatesController = null;
let historyController = null;
let settingsController = null;
let organizationController = null;

// DOM Elements
const elements = typeof document !== 'undefined' ? {
  tabs: document.querySelectorAll('.nav-tab'),
  tabPanes: document.querySelectorAll('.tab-pane'),

  btnModeSimple: document.getElementById('btnModeSimple'),
  btnModeAdvanced: document.getElementById('btnModeAdvanced'),
  btnSwitchToAdvancedFromSimple: document.getElementById('btnSwitchToAdvancedFromSimple'),
  btnSwitchToSimpleFromAdvanced: document.getElementById('btnSwitchToSimpleFromAdvanced'),
  viewSimpleMode: document.getElementById('viewSimpleMode'),
  viewAdvancedMode: document.getElementById('viewAdvancedMode'),

  btnHeaderSettings: document.getElementById('btnHeaderSettings'),
  toggleAiEngine: document.getElementById('toggleAiEngine'),
  lblEngineToggle: document.getElementById('lblEngineToggle'),
  btnCleanAndOrganizeBottom: document.getElementById('btnCleanAndOrganizeBottom'),
  btnCleanBottomText: document.getElementById('btnCleanBottomText'),

  btnSimpleHeuristicOrganize: document.getElementById('btnSimpleHeuristicOrganize'),
  btnSimpleAiOrganize: document.getElementById('btnSimpleAiOrganize'),
  selectSimpleDestination: document.getElementById('selectSimpleDestination'),
  simpleFoldersGrid: document.getElementById('simpleFoldersGrid'),
  simpleStatsSummary: document.getElementById('simpleStatsSummary'),
  btnSimpleApply: document.getElementById('btnSimpleApply'),
  txtSimpleApplyCount: document.getElementById('txtSimpleApplyCount'),

  headerStatusPill: document.getElementById('headerStatusPill'),
  headerStatusDot: document.getElementById('headerStatusDot'),
  headerStatusText: document.getElementById('headerStatusText'),

  metricTotalBookmarks: document.getElementById('metricTotalBookmarks'),
  metricTotalFolders: document.getElementById('metricTotalFolders'),
  metricCategoriesCount: document.getElementById('metricCategoriesCount'),
  metricDuplicatesCount: document.getElementById('metricDuplicatesCount'),

  selectDestinationRoot: document.getElementById('selectDestinationRoot'),
  selectGroupingMode: document.getElementById('selectGroupingMode'),
  inputHybridThreshold: document.getElementById('inputHybridThreshold'),
  hybridThresholdGroup: document.getElementById('hybridThresholdGroup'),
  chkCleanEmptyFolders: document.getElementById('chkCleanEmptyFolders'),

  testingSandboxCard: document.getElementById('testingSandboxCard'),
  btnScatterBookmarks: document.getElementById('btnScatterBookmarks'),
  btnGenerateSampleBookmarks: document.getElementById('btnGenerateSampleBookmarks'),
  btnRemoveSampleBookmarks: document.getElementById('btnRemoveSampleBookmarks'),
  scatterNoticeBanner: document.getElementById('scatterNoticeBanner'),
  scatterNoticeMessage: document.getElementById('scatterNoticeMessage'),
  btnQuickUndoScatter: document.getElementById('btnQuickUndoScatter'),

  btnOpenTestingTools: document.getElementById('btnOpenTestingTools'),
  testingModal: document.getElementById('testingModal'),
  btnCloseTestingModal: document.getElementById('btnCloseTestingModal'),
  btnDoneTestingModal: document.getElementById('btnDoneTestingModal'),
  btnModalScatterBookmarks: document.getElementById('btnModalScatterBookmarks'),
  btnModalGenerateSample: document.getElementById('btnModalGenerateSample'),
  btnModalRemoveSample: document.getElementById('btnModalRemoveSample'),

  categoryPills: document.getElementById('categoryPills'),
  inputSearch: document.getElementById('inputSearch'),
  btnClearSearch: document.getElementById('btnClearSearch'),

  chkSelectAll: document.getElementById('chkSelectAll'),
  txtSelectionCount: document.getElementById('txtSelectionCount'),
  batchCategorySelect: document.getElementById('batchCategorySelect'),
  selectSourceFolder: document.getElementById('selectSourceFolder'),
  btnApplyBatch: document.getElementById('btnApplyBatch'),
  btnInvertSelection: document.getElementById('btnInvertSelection'),

  previewTableBody: document.getElementById('previewTableBody'),

  txtApplyCount: document.getElementById('txtApplyCount'),
  btnApplyOrganization: document.getElementById('btnApplyOrganization'),
  btnExportBeforeOrganize: document.getElementById('btnExportBeforeOrganize'),
  btnRescan: document.getElementById('btnRescan'),
  btnExportFullBackup: document.getElementById('btnExportFullBackup'),

  progressModal: document.getElementById('progressModal'),
  progressModalTitle: document.getElementById('progressModalTitle'),
  progressModalDesc: document.getElementById('progressModalDesc'),
  progressBarFill: document.getElementById('progressBarFill'),
  progressStats: document.getElementById('progressStats'),

  proposalReviewCard: document.getElementById('proposalReviewCard'),
  foldersProposalGrid: document.getElementById('foldersProposalGrid'),
  uncategorizedAlert: document.getElementById('uncategorizedAlert'),
  uncategorizedCountText: document.getElementById('uncategorizedCountText'),
  btnFilterUncategorized: document.getElementById('btnFilterUncategorized'),
  btnAutoSplitAll: document.getElementById('btnAutoSplitAll'),
  btnProposeNewFolder: document.getElementById('btnProposeNewFolder')
} : {};

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    // Only initialize if we are on the dashboard page
    if (!document.getElementById('viewSimpleMode') && !document.getElementById('previewTableBody')) {
      return;
    }
    setupNavigation();
    setupSubControllers();
    setupEventListeners();
    document.getElementById('btnResetFolders')?.addEventListener('click', handleResetFolders);

    await loadConfiguration();
    await performScanAndRender();
    if (location.hash === '#history') document.querySelector('[data-tab="tab-history"]')?.click();
  });
}

function setupNavigation() {
  if (!elements.tabs) return;
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => activatePane(tab.dataset.tab, tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const tabs = [...elements.tabs];
      const currentIndex = tabs.indexOf(tab);
      const nextIndex = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[nextIndex].focus();
      tabs[nextIndex].click();
    });
  });

  if (elements.btnHeaderSettings) {
    elements.btnHeaderSettings.addEventListener('click', () => activatePane('tab-settings'));
  }
}

function activatePane(targetTab, activeTab = null) {
  if (!targetTab) return;
  if (elements.tabs) {
    elements.tabs.forEach(tab => {
      const selected = tab === activeTab;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
  }
  if (elements.tabPanes) {
    elements.tabPanes.forEach(pane => {
      const selected = pane.id === targetTab;
      pane.classList.toggle('active', selected);
      pane.hidden = !selected;
    });
  }
  if (elements.btnHeaderSettings) {
    elements.btnHeaderSettings.setAttribute('aria-pressed', String(targetTab === 'tab-settings'));
  }

  if (targetTab === 'tab-history' && historyController) historyController.render();
  if (targetTab === 'tab-duplicates' && duplicatesController) {
    duplicatesController.render(state.scanResult ? state.scanResult.duplicates : []);
  }
  if (targetTab === 'tab-settings') {
    if (settingsController) settingsController.render();
    updateTestingState();
  }
}

function updateEngineToggleUi(isAi) {
  if (elements.lblEngineToggle) {
    elements.lblEngineToggle.textContent = isAi ? 'Gemini AI' : 'Local suggestions';
  }
  if (elements.btnCleanBottomText) {
    elements.btnCleanBottomText.textContent = isAi && state.planSource !== 'ai' ? 'Generate AI preview for' : 'Organize';
  }
}

function setupSubControllers() {
  duplicatesController = new DashboardDuplicatesController(treeManager, undoManager, performScanAndRender);
  historyController = new DashboardHistoryController(undoManager, performScanAndRender);
  settingsController = new DashboardSettingsController(settingsManager, async () => {
    await loadConfiguration();
    await performScanAndRender();
  });
}

async function loadConfiguration() {
  state.settings = await settingsManager.getSettings();
  state.categories = await settingsManager.getCategories();
  state.learnedRules = await settingsManager.getLearnedRules();
  state.uiMode = state.settings.uiMode || 'simple';

  state.geminiService.setApiKey(state.settings.geminiApiKey || '');
  state.geminiService.setEnabled(Boolean(state.settings.geminiEnabled));
  if (state.settings.geminiModel) {
    state.geminiService.setModel(state.settings.geminiModel);
  }

  // Header status & AI organize button visibility
  const hasGemini = Boolean(state.settings.geminiEnabled && state.settings.geminiApiKey && state.settings.geminiApiKey.trim().length > 5);
  if (elements.headerStatusPill && elements.headerStatusText && elements.headerStatusDot) {
    if (hasGemini) {
      elements.headerStatusText.textContent = `✨ Gemini (${state.geminiService.model}) configured · automatic fallback`;
      elements.headerStatusDot.className = 'privacy-dot gemini-dot';
    } else {
      elements.headerStatusText.textContent = '100% Offline · Zero Data Leaves Your Device';
      elements.headerStatusDot.className = 'privacy-dot';
    }
  }

  if (elements.btnSimpleAiOrganize) {
    elements.btnSimpleAiOrganize.style.display = hasGemini ? 'inline-flex' : 'none';
  }

  if (elements.toggleAiEngine) {
    elements.toggleAiEngine.checked = hasGemini;
  }
  updateEngineToggleUi(hasGemini);

  if (elements.chkCleanEmptyFolders) {
    elements.chkCleanEmptyFolders.checked = Boolean(state.settings.cleanEmptyFolders);
  }
  const savedGroupingMode = state.settings.groupingMode || (state.settings.useSubcategories === false ? 'flat' : 'hybrid');
  if (elements.selectGroupingMode) {
    elements.selectGroupingMode.value = savedGroupingMode;
  }
  if (elements.inputHybridThreshold) {
    elements.inputHybridThreshold.value = state.settings.hybridThreshold || 10;
  }
  if (elements.hybridThresholdGroup) {
    elements.hybridThresholdGroup.style.display = (savedGroupingMode === 'hybrid') ? 'flex' : 'none';
  }
  if (elements.selectDestinationRoot) {
    let settingVal = state.settings.targetRootSetting;
    if (!settingVal) {
      if (String(state.settings.targetRootParentId) === '2') {
        settingVal = state.settings.targetRootFolderTitle ? 'dedicated_other' : 'other';
      } else {
        settingVal = state.settings.targetRootFolderTitle ? 'dedicated' : 'bar';
      }
    }
    elements.selectDestinationRoot.value = settingVal;
    if (elements.selectSimpleDestination) {
      elements.selectSimpleDestination.value = settingVal;
    }
  }

  state.categorizer = new BookmarkCategorizer(state.categories, {
    useSubcategories: state.settings.useSubcategories,
    learnedRules: state.learnedRules
  });

  populateBatchDropdown();
  applyUiMode(state.uiMode);
  await updateTestingState();
}

async function performScanAndRender() {
  state.reviewComplete = false;
  const resultPanel = typeof document !== 'undefined' ? document.getElementById('organizationResult') : null;
  if (resultPanel) resultPanel.hidden = true;
  applyUiMode(state.uiMode);
  try {
    if (elements.simpleStatsSummary) {
      elements.simpleStatsSummary.textContent = '🔄 Scanning and analyzing bookmarks...';
    }
    if (elements.previewTableBody) {
      elements.previewTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-message">
            <div style="font-size: 24px; margin-bottom: 8px;">🔄</div>
            Scanning full bookmark hierarchy across all folders...
          </td>
        </tr>
      `;
    }

    state.scanResult = await treeManager.scanBookmarks();

    if (elements.metricTotalBookmarks) {
      elements.metricTotalBookmarks.textContent = state.scanResult.stats.totalBookmarks.toLocaleString();
    }
    const scatteredCount = typeof state.scanResult.stats.scatteredFoldersCount === 'number'
      ? state.scanResult.stats.scatteredFoldersCount
      : state.scanResult.folders.filter(f => !f.isSystem).length;
    if (elements.metricTotalFolders) {
      elements.metricTotalFolders.textContent = scatteredCount.toLocaleString();
    }
    if (elements.metricDuplicatesCount) {
      elements.metricDuplicatesCount.textContent = state.scanResult.stats.duplicateCount.toLocaleString();
    }

    const groupingMode = elements.selectGroupingMode ? elements.selectGroupingMode.value : (state.settings.groupingMode || 'hybrid');
    const hybridThreshold = elements.inputHybridThreshold ? parseInt(elements.inputHybridThreshold.value, 10) : (state.settings.hybridThreshold || 10);
    state.plan = treeManager.buildProposedPlan(eligibleBookmarks(state.scanResult, state.settings), state.categorizer, {
      groupingMode,
      hybridThreshold,
      useSubcategories: groupingMode !== 'flat'
    });
    state.planSource = 'heuristic';
    applyConfidenceDefaults(state.plan, state.settings);
    renderGuidance(state, settingsManager, async () => { await loadConfiguration(); await performScanAndRender(); });
    updateEngineToggleUi(Boolean(state.settings.geminiEnabled && state.settings.geminiApiKey));

    const uniqueCategories = new Set(state.plan.map(p => p.proposedCategoryName));
    if (elements.metricCategoriesCount) {
      elements.metricCategoriesCount.textContent = uniqueCategories.size;
    }

    populateSourceFolderDropdown();
    renderSimpleFolderCards();
    renderStage1FolderProposals();
    renderCategoryPills();
    applyFilterAndRenderTable();
    updateCounters();

    if (elements.scatterNoticeBanner && elements.btnQuickUndoScatter && elements.btnQuickUndoScatter.dataset.snapshotId) {
      try {
        const snapshots = await undoManager.getAllSnapshots();
        const activeScatter = snapshots.find(s => s.id === elements.btnQuickUndoScatter.dataset.snapshotId);
        if (!activeScatter || activeScatter.status === 'restored') {
          elements.scatterNoticeBanner.style.display = 'none';
        }
      } catch {}
    }

    if (duplicatesController) duplicatesController.render(state.scanResult.duplicates);
    if (historyController) historyController.render();
  } catch (err) {
    console.error('Scan error:', err);
    if (elements.simpleStatsSummary) elements.simpleStatsSummary.textContent = 'Could not read bookmarks. Try Scan again.';
    if (elements.previewTableBody) {
      elements.previewTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-message" style="color: var(--danger);">
            Scan failed: ${escapeHtml(err.message)}
          </td>
        </tr>
      `;
    }
  }
}

export function applyUiMode(mode) {
  state.uiMode = mode || 'simple';
  if (state.reviewComplete) {
    if (elements.viewSimpleMode) elements.viewSimpleMode.style.display = 'none';
    if (elements.viewAdvancedMode) elements.viewAdvancedMode.style.display = 'none';
    return;
  }
  if (state.uiMode === 'advanced') {
    if (elements.btnModeSimple) elements.btnModeSimple.classList.remove('active');
    if (elements.btnModeAdvanced) elements.btnModeAdvanced.classList.add('active');
    if (elements.viewSimpleMode) elements.viewSimpleMode.style.display = 'none';
    if (elements.viewAdvancedMode) elements.viewAdvancedMode.style.display = 'block';
  } else {
    if (elements.btnModeSimple) elements.btnModeSimple.classList.add('active');
    if (elements.btnModeAdvanced) elements.btnModeAdvanced.classList.remove('active');
    if (elements.viewSimpleMode) elements.viewSimpleMode.style.display = 'block';
    if (elements.viewAdvancedMode) elements.viewAdvancedMode.style.display = 'none';
  }
}

export async function setUiMode(mode) {
  applyUiMode(mode);
  if (mode === 'simple') {
    renderSimpleFolderCards();
    syncSimpleSelectionState();
  } else if (mode === 'advanced') {
    renderStage1FolderProposals();
    syncStage1SelectionState();
    renderCategoryPills();
    applyFilterAndRenderTable();
  }
  if (typeof document !== 'undefined') {
    const organizeTab = document.querySelector('[data-tab="tab-organize"]');
    const organizePane = document.getElementById('tab-organize');
    if (organizeTab && organizePane && !organizePane.classList.contains('active')) {
      activatePane('tab-organize', organizeTab);
    }
  }
  await settingsManager.saveSettings({ uiMode: mode });
}

export function renderSimpleFolderCards() {
  if (!elements.simpleFoldersGrid) return;
  if (state.scanResult) markCurrentDestinations(state.plan, state.scanResult, state.settings);

  // Preserve open accordion drawers across re-renders
  const openFolders = new Set();
  elements.simpleFoldersGrid.querySelectorAll('.simple-folder-card.accordion-open').forEach(c => {
    if (c.dataset.folder) openFolders.add(c.dataset.folder);
  });

  const folderMap = new Map();

  for (const item of state.plan) {
    const folder = item.proposedFolderDisplay || (item.proposedPath ? item.proposedPath.join(' / ') : 'Uncategorized');
    if (!folderMap.has(folder)) {
      folderMap.set(folder, {
        name: folder,
        items: [],
        icon: item.icon || '📁',
        color: item.color || '#4361ee'
      });
    }
    folderMap.get(folder).items.push(item);
  }

  elements.simpleFoldersGrid.innerHTML = '';

  const totalBookmarks = state.plan.length;
  const folderCount = folderMap.size;
  if (elements.simpleStatsSummary) {
    elements.simpleStatsSummary.textContent = `${totalBookmarks.toLocaleString()} bookmarks grouped into ${folderCount} smart folders`;
  }

  if (folderMap.size === 0) {
    elements.simpleFoldersGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
        No bookmarks found to organize.
      </div>
    `;
    return;
  }

  for (const [folderName, group] of folderMap.entries()) {
    const card = document.createElement('div');
    const wasOpen = openFolders.has(folderName);
    const allSelected = group.items.every(i => i.selected);
    const anySelected = group.items.some(i => i.selected);

    card.className = `simple-folder-card ${!anySelected ? 'excluded' : ''} ${wasOpen ? 'accordion-open' : ''}`;
    card.dataset.folder = folderName;

    // Build the accordion drawer with all bookmarks in this folder
    const linksHtml = group.items.map(item => `
      <div class="simple-card-link-row ${!item.selected ? 'excluded' : ''}" data-id="${item.id}">
        <label class="checkbox-container" title="Include/Exclude this bookmark">
          <input type="checkbox" class="simple-link-chk" data-id="${item.id}" ${item.selected ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
        <span class="simple-link-icon">${item.icon || '🔗'}</span>
        <div class="simple-link-details">
          <div class="simple-link-title-row">
            ${safeBookmarkHref(item.url)
              ? `<a href="${escapeHtml(safeBookmarkHref(item.url))}" target="_blank" rel="noopener noreferrer" class="simple-link-title" title="${escapeHtml(item.title || item.url)}">${escapeHtml(item.title || item.url)}</a>`
              : `<span class="simple-link-title" title="This bookmark type is not opened from the extension">${escapeHtml(item.title || item.url)}</span>`}
            ${item.isAlreadyOrganized ? '<span class="status-organized-badge" title="Already in proposed folder">In Place</span>' : ''}
          </div>
          <span class="simple-link-url" title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</span>
          <span class="move-preview">From ${escapeHtml(item.currentLocation)} → ${escapeHtml(folderName)}</span>
          <span class="review-quality">${item.confidence === 'high' ? 'Strong match' : 'Please review this suggestion'}</span>
        </div>
        ${item.matchReason ? `<span class="simple-link-reason" title="${escapeHtml(item.matchReason)}">${escapeHtml(item.matchReason)}</span>` : ''}
      </div>
    `).join('');

    card.innerHTML = `
      <div class="simple-card-header">
        <div class="simple-card-folder">
          <span class="folder-object" aria-hidden="true"><span class="folder-back"></span><span class="folder-paper paper-one"></span><span class="folder-paper paper-two"></span><span class="folder-front"><span>${escapeHtml(group.icon)}</span></span></span>
          <div class="simple-card-title-wrap">
            <div class="simple-card-name" title="${escapeHtml(folderName)}">${escapeHtml(folderName)}</div>
          </div>
        </div>
        <div class="simple-card-header-actions">
          <span class="simple-card-count">${group.items.length} ${group.items.length === 1 ? 'bookmark' : 'bookmarks'}</span>
          <label class="checkbox-container" title="Include/Exclude all bookmarks in this folder">
            <input type="checkbox" class="simple-folder-chk" ${allSelected ? 'checked' : ''}>
            <span class="checkmark"></span>
          </label>
          <button class="btn-card-accordion-toggle" aria-label="Show links in ${escapeHtml(folderName)}" title="Expand / collapse bookmark list" aria-expanded="${wasOpen ? 'true' : 'false'}" type="button">
            <span class="accordion-arrow">${wasOpen ? '▲' : '▼'}</span>
          </button>
        </div>
      </div>
      <div class="simple-card-accordion-body" style="display: ${wasOpen ? 'block' : 'none'};">
        <div class="simple-card-links-list">
          ${linksHtml}
        </div>
      </div>
    `;

    // Folder checkbox listener
    const folderChk = card.querySelector('.simple-folder-chk');
    folderChk.indeterminate = (!allSelected && anySelected);

    folderChk.addEventListener('change', (e) => {
      const checked = e.target.checked;
      folderChk.indeterminate = false;
      for (const item of group.items) {
        item.selected = checked;
      }
      if (checked) card.classList.remove('excluded');
      else card.classList.add('excluded');

      // Update link checkboxes inside the card
      card.querySelectorAll('.simple-link-chk').forEach(lChk => {
        lChk.checked = checked;
        const row = lChk.closest('.simple-card-link-row');
        if (row) {
          if (checked) row.classList.remove('excluded');
          else row.classList.add('excluded');
        }
      });

      syncStage1SelectionState();
      renderTable();
      updateCounters();
    });

    // Link checkbox listeners inside accordion drawer
    card.querySelectorAll('.simple-link-chk').forEach(lChk => {
      lChk.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const item = group.items.find(i => i.id === id);
        if (item) {
          item.selected = e.target.checked;
          const row = lChk.closest('.simple-card-link-row');
          if (row) {
            if (item.selected) row.classList.remove('excluded');
            else row.classList.add('excluded');
          }
        }

        const any = group.items.some(i => i.selected);
        const all = group.items.every(i => i.selected);
        folderChk.checked = all;
        folderChk.indeterminate = (!all && any);
        if (any) card.classList.remove('excluded');
        else card.classList.add('excluded');

        syncStage1SelectionState();
        renderTable();
        updateCounters();
      });
    });

    // Accordion expand/collapse toggle
    const accordionBody = card.querySelector('.simple-card-accordion-body');
    const accordionToggle = card.querySelector('.btn-card-accordion-toggle');
    const arrow = card.querySelector('.accordion-arrow');

    const toggleAccordion = (e) => {
      if (e.target.closest('.checkbox-container') || e.target.closest('a')) return;
      e.stopPropagation();
      const isOpen = accordionBody.style.display !== 'none';
      if (isOpen) {
        accordionBody.style.display = 'none';
        card.classList.remove('accordion-open');
        accordionToggle.setAttribute('aria-expanded', 'false');
        arrow.textContent = '▼';
      } else {
        accordionBody.style.display = 'block';
        card.classList.add('accordion-open');
        accordionToggle.setAttribute('aria-expanded', 'true');
        arrow.textContent = '▲';
      }
    };

    accordionToggle.addEventListener('click', toggleAccordion);
    card.querySelector('.simple-card-header').addEventListener('click', toggleAccordion);

    elements.simpleFoldersGrid.appendChild(card);
  }
}

export function syncSimpleSelectionState() {
  if (!elements.simpleFoldersGrid) return;
  const cards = elements.simpleFoldersGrid.querySelectorAll('.simple-folder-card');
  cards.forEach(card => {
    const nameEl = card.querySelector('.simple-card-name');
    const folderChk = card.querySelector('.simple-folder-chk');
    if (!nameEl || !folderChk) return;
    const folder = card.dataset.folder || nameEl.textContent.trim();
    const folderItems = state.plan.filter(i => (i.proposedFolderDisplay || (i.proposedPath ? i.proposedPath.join(' / ') : 'Uncategorized')) === folder);
    if (folderItems.length === 0) return;
    const allSelected = folderItems.every(i => i.selected);
    const anySelected = folderItems.some(i => i.selected);
    folderChk.checked = allSelected;
    folderChk.indeterminate = (!allSelected && anySelected);
    if (anySelected) {
      card.classList.remove('excluded');
    } else {
      card.classList.add('excluded');
    }

    // Sync individual link checkboxes inside card
    card.querySelectorAll('.simple-link-chk').forEach(lChk => {
      const id = lChk.dataset.id;
      const item = folderItems.find(i => i.id === id);
      if (item) {
        lChk.checked = item.selected;
        const row = lChk.closest('.simple-card-link-row');
        if (row) {
          if (item.selected) row.classList.remove('excluded');
          else row.classList.add('excluded');
        }
      }
    });
  });
}

export async function organizeWithGeminiAi() {
  if (!state.settings.geminiApiKey || state.settings.geminiApiKey.trim().length < 6) {
    activatePane('tab-settings');
    if (elements.toggleAiEngine) {
      elements.toggleAiEngine.checked = false;
    }
    updateEngineToggleUi(false);
    alert('Please enter and verify your free Google Gemini API key in Settings first.');
    return false;
  }

  if (elements.progressModalTitle) elements.progressModalTitle.textContent = 'Gemini AI Analyzing Bookmarks...';
  if (elements.progressModalDesc) elements.progressModalDesc.textContent = `Categorizing bookmarks with ${state.geminiService.model} hybrid reasoning...`;
  if (elements.progressBarFill) elements.progressBarFill.style.width = '10%';
  if (elements.progressStats) elements.progressStats.textContent = 'Contacting Gemini API...';
  if (elements.progressModal) elements.progressModal.style.display = 'flex';

  try {
    if (!state.scanResult) {
      state.scanResult = await treeManager.scanBookmarks();
    }
    state.geminiService.onStatus = event => {
      if (elements.progressModalDesc) elements.progressModalDesc.textContent = event.message;
    };
    const bookmarks = state.scanResult ? eligibleBookmarks(state.scanResult, state.settings) : [];
    if (bookmarks.length === 0) {
      if (elements.progressModal) elements.progressModal.style.display = 'none';
      state.geminiService.onStatus = null;
      alert('No bookmarks found to organize.');
      return false;
    }

    const groupingMode = elements.selectGroupingMode ? elements.selectGroupingMode.value : (state.settings.groupingMode || 'hybrid');
    const hybridThreshold = elements.inputHybridThreshold ? parseInt(elements.inputHybridThreshold.value, 10) : (state.settings.hybridThreshold || 10);
    const proposedPlan = await treeManager.buildProposedPlanWithAi(
      bookmarks,
      state.categorizer,
      state.geminiService,
      {
        groupingMode,
        hybridThreshold,
        useSubcategories: groupingMode !== 'flat',
        useGemini: true,
        geminiStripQueryParams: state.settings.geminiStripQueryParams !== false,
        geminiExcludePrivateUrls: state.settings.geminiExcludePrivateUrls !== false
      },
      (prog) => {
        if (elements.progressBarFill) elements.progressBarFill.style.width = `${prog.percent}%`;
        if (elements.progressStats) elements.progressStats.textContent = `Gemini AI: ${prog.percent}% (${prog.completed} / ${prog.total})`;
      }
    );

    state.plan = applyConfidenceDefaults(proposedPlan, state.settings);
    const hasAiGeneratedItems = proposedPlan.some(p => p.isAiGenerated);

    if (!hasAiGeneratedItems && bookmarks.length > 0) {
      console.warn('Gemini AI returned 0 AI-categorized items, reverting engine toggle to local heuristics.');
      state.planSource = 'heuristic';
      if (elements.toggleAiEngine) {
        elements.toggleAiEngine.checked = false;
      }
      updateEngineToggleUi(false);
      // Use local results for this preview without disabling AI for future runs.
    } else {
      state.planSource = 'ai';
      if (elements.toggleAiEngine) {
        elements.toggleAiEngine.checked = true;
      }
      updateEngineToggleUi(true);
    }

    if (elements.headerStatusText && state.geminiService && state.geminiService.model) {
      elements.headerStatusText.textContent = hasAiGeneratedItems
        ? `✨ Gemini (${state.geminiService.model}) · local fallback available`
        : 'Local classification used · AI temporarily unavailable';
    }
    const modelBadge = document.getElementById('geminiModelBadge');
    if (modelBadge && state.geminiService && state.geminiService.model) {
      modelBadge.textContent = state.geminiService.model;
    }
    const report = state.geminiService.lastRunReport;
    const notice = document.getElementById('organizationNotice');
    if (report && notice) {
      notice.hidden = false;
      notice.textContent = `${report.aiCount} bookmarks classified with AI; ${report.localCount} using local rules. ${report.localCount ? (report.message || 'Some AI results were missing; local suggestions are ready for review.') : `Active model: ${state.geminiService.model}.`}`;
    }
    state.geminiService.onStatus = null;

    const uniqueCategories = new Set(state.plan.map(p => p.proposedCategoryName));
    if (elements.metricCategoriesCount) {
      elements.metricCategoriesCount.textContent = uniqueCategories.size;
    }

    renderStage1FolderProposals();
    renderSimpleFolderCards();
    renderCategoryPills();
    applyFilterAndRenderTable();
    updateCounters();

    if (elements.progressModal) elements.progressModal.style.display = 'none';
    return true;
  } catch (err) {
    console.error('Gemini organization error:', err);
    state.geminiService.onStatus = null;
    if (elements.progressModal) elements.progressModal.style.display = 'none';
    if (elements.toggleAiEngine) {
      elements.toggleAiEngine.checked = false;
    }
    updateEngineToggleUi(false);
    alert('Gemini AI error: ' + err.message + '\nFalling back to local categorization.');
    await performScanAndRender();
    if (elements.toggleAiEngine) elements.toggleAiEngine.checked = false;
    updateEngineToggleUi(false);
    return false;
  }
}

function renderStage1FolderProposals() {
  if (!elements.foldersProposalGrid) return;

  const folderMap = new Map();
  let uncategorizedCount = 0;

  for (const item of state.plan) {
    const folder = item.proposedFolderDisplay || (item.proposedPath ? item.proposedPath.join(' / ') : 'Uncategorized');
    const isUncat = item.proposedCategoryId === 'other' || item.confidence === 'none' || folder.includes('Uncategorized');
    if (isUncat) uncategorizedCount++;

    if (!folderMap.has(folder)) {
      folderMap.set(folder, {
        name: folder,
        items: [],
        hasLearned: false,
        isUncategorized: isUncat,
        icon: item.icon || (isUncat ? '❓' : '📁'),
        color: item.color || '#4361ee'
      });
    }
    const grp = folderMap.get(folder);
    grp.items.push(item);
    if (item.isLearned) grp.hasLearned = true;
  }

  // Update Uncategorized Alert
  if (elements.uncategorizedAlert) {
    if (uncategorizedCount > 0) {
      elements.uncategorizedAlert.style.display = 'flex';
      if (elements.uncategorizedCountText) {
        elements.uncategorizedCountText.textContent = `${uncategorizedCount} bookmark${uncategorizedCount === 1 ? '' : 's'} need review`;
      }
    } else {
      elements.uncategorizedAlert.style.display = 'none';
    }
  }

  // Detect cluttered folders (>12 items)
  const clutterRecs = (state.categorizer && typeof state.categorizer.detectClutterAndSuggestSplits === 'function')
    ? state.categorizer.detectClutterAndSuggestSplits(state.plan, 12)
    : [];
  const clutteredFolderNames = new Set(clutterRecs.map(r => r.folderName));

  const allFolderNames = Array.from(folderMap.keys());
  elements.foldersProposalGrid.innerHTML = '';

  for (const [folderName, group] of folderMap.entries()) {
    const card = document.createElement('div');
    card.className = 'folder-proposal-card';
    const allSelected = group.items.every(i => i.selected);
    const anySelected = group.items.some(i => i.selected);
    if (!anySelected) card.classList.add('excluded');

    const isCluttered = clutteredFolderNames.has(folderName);

    card.innerHTML = `
      <div class="folder-card-top">
        <label class="checkbox-container" title="Include / Exclude all bookmarks in this folder">
          <input type="checkbox" class="folder-select-chk" ${allSelected ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
        <div class="folder-card-meta">
          <span class="folder-count-badge">${group.items.length} bookmarks</span>
        </div>
      </div>

      <div class="folder-name-row">
        <span class="folder-icon">${group.icon}</span>
        <input type="text" class="folder-name-input" value="${escapeHtml(folderName)}" title="Click to rename folder globally">
      </div>

      <div class="folder-card-badges">
        ${group.hasLearned ? '<span class="learned-badge">🧠 Learned Rule</span>' : ''}
        ${group.isUncategorized ? '<span class="confidence-badge confidence-none">❓ Needs Review</span>' : ''}
        ${isCluttered ? `<span class="clutter-badge btn-split-clutter" title="Folder exceeds 12 items. Click to auto-split into subcategories.">⚡ Clutter (${group.items.length}) &middot; Auto-Split</span>` : ''}
      </div>

      <div class="folder-actions-row">
        <span style="font-size: 11px; color: var(--text-muted);">Merge into:</span>
        <select class="form-select folder-merge-select">
          <option value="" disabled selected>Select target...</option>
          ${allFolderNames.filter(f => f !== folderName).map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('')}
        </select>
      </div>
    `;

    // Folder selection checkbox
    card.querySelector('.folder-select-chk').addEventListener('change', (e) => {
      const checked = e.target.checked;
      for (const item of group.items) {
        item.selected = checked;
      }
      if (checked) card.classList.remove('excluded');
      else card.classList.add('excluded');
      renderTable();
      updateCounters();
    });

    // Inline renaming
    const nameInput = card.querySelector('.folder-name-input');
    let isRenaming = false;
    const commitRename = async () => {
      if (isRenaming) return;
      const newName = nameInput.value.trim();
      if (!newName || newName === folderName) {
        nameInput.value = folderName;
        return;
      }
      isRenaming = true;
      try {
        const newPath = newName.split(' / ').map(s => s.trim()).filter(Boolean);
        const catObj = state.categories.find(c => c.name.toLowerCase() === newPath[0].toLowerCase());

        for (const item of group.items) {
          item.proposedFolderDisplay = newName;
          item.proposedPath = newPath;
          item.proposedCategoryName = newPath[0];
          item.proposedSubcategoryName = newPath[1] || null;
          item.proposedCategoryId = catObj ? catObj.id : 'custom';
          item.icon = catObj ? (catObj.icon || '📁') : '📁';
          item.color = catObj ? (catObj.color || '#4361ee') : '#4361ee';
          item.confidence = 'high';
          item.isLearned = true;
          item.selected = true;
          item.matchReason = 'Folder renamed globally';
        }

        // Save learned domain rules for all bookmarks in this renamed folder
        for (const item of group.items) {
          try {
            const urlObj = new URL(item.url);
            const domain = urlObj.hostname.replace(/^www\./, '');
            if (domain) {
              await settingsManager.saveLearnedRule(item.url, newName, 'url');
            }
          } catch {}
        }

        if (newPath[0]) {
          await settingsManager.saveLearnedRule(newPath[0], newName, 'keyword');
        }
        const rules = await settingsManager.getLearnedRules();
        state.categorizer.setLearnedRules(rules);

        renderStage1FolderProposals();
        renderSimpleFolderCards();
        renderCategoryPills();
        applyFilterAndRenderTable();
      } finally {
        isRenaming = false;
      }
    };

    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        nameInput.blur();
      }
    });
    nameInput.addEventListener('blur', commitRename);

    // Merge into
    const mergeSelect = card.querySelector('.folder-merge-select');
    mergeSelect.addEventListener('change', async (e) => {
      const targetFolder = e.target.value;
      if (!targetFolder) return;
      const targetPath = targetFolder.split(' / ').map(s => s.trim()).filter(Boolean);
      const catObj = state.categories.find(c => c.name.toLowerCase() === targetPath[0].toLowerCase());

      for (const item of group.items) {
        item.proposedFolderDisplay = targetFolder;
        item.proposedPath = targetPath;
        item.proposedCategoryName = targetPath[0];
        item.proposedSubcategoryName = targetPath[1] || null;
        item.proposedCategoryId = catObj ? catObj.id : 'custom';
        item.icon = catObj ? (catObj.icon || '📁') : '📁';
        item.color = catObj ? (catObj.color || '#4361ee') : '#4361ee';
        item.confidence = 'high';
        item.isLearned = true;
        item.selected = true;
        item.matchReason = `Merged from "${folderName}"`;

        try {
          const urlObj = new URL(item.url);
          const domain = urlObj.hostname.replace(/^www\./, '');
          if (domain) {
            await settingsManager.saveLearnedRule(item.url, targetFolder, 'url');
          }
        } catch {}
      }

      const rules = await settingsManager.getLearnedRules();
      state.categorizer.setLearnedRules(rules);

      renderStage1FolderProposals();
      renderSimpleFolderCards();
      renderCategoryPills();
      applyFilterAndRenderTable();
    });

    // Auto-split clutter button
    const splitBtn = card.querySelector('.btn-split-clutter');
    if (splitBtn) {
      splitBtn.addEventListener('click', () => {
        const specificRec = clutterRecs.filter(r => r.folderName === folderName);
        if (specificRec.length > 0) {
          state.categorizer.applySubfolderSplits(state.plan, specificRec);
          renderStage1FolderProposals();
          renderSimpleFolderCards();
          renderCategoryPills();
          applyFilterAndRenderTable();
        }
      });
    }

    elements.foldersProposalGrid.appendChild(card);
  }
}


function populateSourceFolderDropdown() {
  if (!elements.selectSourceFolder) return;
  const folders = state.scanResult ? state.scanResult.scatteredFolders : [];
  let html = '<option value="all" selected>All Source Locations</option>';
  for (const f of folders) {
    const title = f.path && f.path.length > 0 ? f.path.join(' / ') : f.title;
    html += `<option value="${escapeHtml(title)}">${escapeHtml(title)} (${f.childCount || 0})</option>`;
  }
  elements.selectSourceFolder.innerHTML = html;
}

function renderCategoryPills() {
  const counts = new Map();
  counts.set('all', state.plan.length);

  for (const item of state.plan) {
    const cat = item.proposedCategoryName;
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }

  elements.categoryPills.innerHTML = '';

  const allPill = document.createElement('div');
  allPill.className = `cat-pill ${state.activeCategoryFilter === 'all' ? 'active' : ''}`;
  allPill.innerHTML = `<span>📚 All Bookmarks</span> <span class="cat-pill-count">${state.plan.length}</span>`;
  allPill.addEventListener('click', () => {
    state.activeCategoryFilter = 'all';
    updatePillsActiveState();
    applyFilterAndRenderTable();
  });
  elements.categoryPills.appendChild(allPill);

  const sortedCategories = Array.from(counts.keys())
    .filter(k => k !== 'all')
    .sort((a, b) => counts.get(b) - counts.get(a));

  for (const catName of sortedCategories) {
    const matchingCat = state.categories.find(c => c.name === catName);
    let icon = matchingCat ? matchingCat.icon : '📁';
    if (catName === OTHER_CATEGORY.name || catName.includes('Uncategorized')) {
      icon = OTHER_CATEGORY.icon || '❓';
    }

    const pill = document.createElement('div');
    pill.className = `cat-pill ${state.activeCategoryFilter === catName ? 'active' : ''}`;
    pill.dataset.category = catName;
    pill.innerHTML = `<span>${icon} ${escapeHtml(catName)}</span> <span class="cat-pill-count">${counts.get(catName)}</span>`;
    pill.addEventListener('click', () => {
      state.activeCategoryFilter = catName;
      updatePillsActiveState();
      applyFilterAndRenderTable();
    });
    elements.categoryPills.appendChild(pill);
  }
}

function updatePillsActiveState() {
  document.querySelectorAll('.cat-pill').forEach(pill => {
    if (state.activeCategoryFilter === 'all' && pill.textContent.includes('All Bookmarks')) {
      pill.classList.add('active');
    } else if (pill.dataset.category === state.activeCategoryFilter) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
}

function getCategorySelectOptions(selectedDisplay) {
  let html = '';
  const groupingMode = elements.selectGroupingMode ? elements.selectGroupingMode.value : (state.settings.groupingMode || 'hybrid');
  const useSubcategories = groupingMode !== 'flat';

  for (const cat of state.categories) {
    if (useSubcategories && cat.subcategories && cat.subcategories.length > 0) {
      html += `<optgroup label="${cat.icon || '📁'} ${escapeHtml(cat.name)}">`;
      html += `<option value="${escapeHtml(cat.name)}" ${selectedDisplay === cat.name ? 'selected' : ''}>${cat.icon || '📁'} ${escapeHtml(cat.name)} (Top-Level)</option>`;
      for (const sub of cat.subcategories) {
        const full = `${cat.name} / ${sub.name}`;
        html += `<option value="${escapeHtml(full)}" ${selectedDisplay === full ? 'selected' : ''}>&nbsp;&nbsp;↳ ${escapeHtml(sub.name)}</option>`;
      }
      html += `</optgroup>`;
    } else {
      html += `<option value="${escapeHtml(cat.name)}" ${selectedDisplay === cat.name ? 'selected' : ''}>${cat.icon || '📁'} ${escapeHtml(cat.name)}</option>`;
    }
  }

  const uncatName = OTHER_CATEGORY.name;
  html += `<option value="${escapeHtml(uncatName)}" ${selectedDisplay === uncatName ? 'selected' : ''}>${OTHER_CATEGORY.icon || '❓'} ${escapeHtml(uncatName)}</option>`;
  return html;
}

function populateBatchDropdown() {
  elements.batchCategorySelect.innerHTML = `
    <option value="" disabled selected>Batch change category...</option>
    ${getCategorySelectOptions('')}
  `;
}

function applyFilterAndRenderTable() {
  const query = state.searchQuery.toLowerCase().trim();
  const sourceFilter = elements.selectSourceFolder ? elements.selectSourceFolder.value : 'all';

  state.filteredPlan = state.plan.filter(item => {
    if (state.activeCategoryFilter !== 'all') {
      if (state.activeCategoryFilter === OTHER_CATEGORY.name) {
        const isUncat = item.proposedCategoryName === OTHER_CATEGORY.name ||
          item.proposedCategoryId === OTHER_CATEGORY.id ||
          item.confidence === 'none' ||
          (item.proposedFolderDisplay && item.proposedFolderDisplay.includes('Uncategorized'));
        if (!isUncat) return false;
      } else if (item.proposedCategoryName !== state.activeCategoryFilter) {
        return false;
      }
    }
    if (sourceFilter !== 'all' && item.currentLocation !== sourceFilter && !item.currentLocation.startsWith(sourceFilter)) {
      return false;
    }
    if (query) {
      const matchTitle = item.title.toLowerCase().includes(query);
      const matchUrl = item.url.toLowerCase().includes(query);
      const matchLoc = item.currentLocation.toLowerCase().includes(query);
      const matchCat = item.proposedFolderDisplay.toLowerCase().includes(query);
      const matchTags = (item.tags || []).some(t => t.toLowerCase().includes(query));
      if (!matchTitle && !matchUrl && !matchLoc && !matchCat && !matchTags) return false;
    }
    return true;
  });

  renderTable();
  updateCounters();
}

function renderTable() {
  if (state.filteredPlan.length === 0) {
    elements.previewTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-message">No bookmarks match the current filter.</td>
      </tr>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const item of state.filteredPlan) {
    const tr = document.createElement('tr');
    if (!item.selected) tr.classList.add('excluded');

    const catIcon = item.icon || '📁';
    const tagsHtml = (item.tags || []).map(t =>
      `<span class="smart-tag ${state.searchQuery === t ? 'active' : ''}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`
    ).join(' ');

    let confidenceBadgeHtml = '';
    if (item.isLearned) {
      confidenceBadgeHtml = `<span class="confidence-badge confidence-learned" title="${escapeHtml(item.matchReason)}">🧠 Learned</span>`;
    } else if (item.confidence === 'none' || item.proposedCategoryId === 'other' || item.proposedCategoryName.includes('Uncategorized')) {
      confidenceBadgeHtml = `<span class="confidence-badge confidence-none" title="${escapeHtml(item.matchReason)}">❓ Review</span>`;
    } else if (item.confidence === 'high') {
      confidenceBadgeHtml = `<span class="confidence-badge confidence-high" title="${escapeHtml(item.matchReason)}">🟢 High</span>`;
    } else if (item.confidence === 'medium') {
      confidenceBadgeHtml = `<span class="confidence-badge confidence-medium" title="${escapeHtml(item.matchReason)}">🟡 Medium</span>`;
    } else {
      confidenceBadgeHtml = `<span class="confidence-badge confidence-heuristic" title="${escapeHtml(item.matchReason)}">🔵 Heuristic</span>`;
    }

    tr.innerHTML = `
      <td>
        <label class="checkbox-container">
          <input type="checkbox" class="row-chk" data-id="${item.id}" ${item.selected ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
      </td>
      <td>
        <div class="bookmark-cell">
          <div class="bookmark-title-row">
            <span class="bookmark-favicon-badge" title="${escapeHtml(item.proposedCategoryName)}">${catIcon}</span>
            <span class="bookmark-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</span>
            ${item.isAlreadyOrganized ? '<span class="status-organized-badge" title="Already in proposed category folder">In Place</span>' : ''}
          </div>
          ${safeBookmarkHref(item.url)
            ? `<a href="${escapeHtml(safeBookmarkHref(item.url))}" target="_blank" rel="noopener noreferrer" class="bookmark-url" title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</a>`
            : `<span class="bookmark-url" title="This bookmark type is not opened from the extension">${escapeHtml(item.url)}</span>`}
          ${tagsHtml ? `<div class="bookmark-tags-row">${tagsHtml}</div>` : ''}
        </div>
      </td>
      <td>
        <span class="location-badge" title="${escapeHtml(item.currentLocation)}">
          📁 ${escapeHtml(item.currentLocation)}
        </span>
      </td>
      <td>
        <div class="category-select-wrapper">
          <select class="form-select row-category-select" data-id="${item.id}">
            ${getCategorySelectOptions(item.proposedFolderDisplay)}
          </select>
        </div>
      </td>
      <td>
        ${confidenceBadgeHtml}
      </td>
    `;

    tr.querySelector('.row-chk').addEventListener('change', (e) => {
      item.selected = e.target.checked;
      if (item.selected) tr.classList.remove('excluded');
      else tr.classList.add('excluded');
      updateCounters();
    });

    tr.querySelectorAll('.smart-tag').forEach(tagEl => {
      tagEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const tagText = tagEl.dataset.tag;
        if (state.searchQuery === tagText) {
          elements.inputSearch.value = '';
          state.searchQuery = '';
          elements.btnClearSearch.style.display = 'none';
        } else {
          elements.inputSearch.value = tagText;
          state.searchQuery = tagText;
          elements.btnClearSearch.style.display = 'block';
        }
        applyFilterAndRenderTable();
      });
    });

    tr.querySelector('.row-category-select').addEventListener('change', async (e) => {
      const newDisplay = e.target.value;
      const path = newDisplay.split(' / ').map(s => s.trim());
      const catObj = state.categories.find(c => c.name === path[0]);

      item.proposedFolderDisplay = newDisplay;
      item.proposedPath = path;
      item.proposedCategoryId = catObj ? catObj.id : 'custom';
      item.proposedCategoryName = path[0];
      item.proposedSubcategoryName = path[1] || null;
      item.icon = catObj ? catObj.icon : '📁';
      item.color = catObj ? catObj.color : '#4361ee';
      item.confidence = 'high';
      item.isLearned = true;
      item.selected = true;
      item.matchReason = 'Learned from user selection';

      // Save learned rule for the domain
      try {
        const urlObj = new URL(item.url);
        const domain = urlObj.hostname.replace(/^www\./, '');
        if (domain) {
          await settingsManager.saveLearnedRule(item.url, newDisplay, 'url');
          const updatedRules = await settingsManager.getLearnedRules();
          state.categorizer.setLearnedRules(updatedRules);
        }
      } catch {}

      const iconBadge = tr.querySelector('.bookmark-favicon-badge');
      if (iconBadge) {
        iconBadge.textContent = item.icon;
      }

      renderStage1FolderProposals();
      renderSimpleFolderCards();
      renderCategoryPills();
      applyFilterAndRenderTable();
    });

    fragment.appendChild(tr);
  }

  elements.previewTableBody.innerHTML = '';
  elements.previewTableBody.appendChild(fragment);
}

function syncStage1SelectionState() {
  if (!elements.foldersProposalGrid) return;
  const cards = elements.foldersProposalGrid.querySelectorAll('.folder-proposal-card');
  cards.forEach(card => {
    const input = card.querySelector('.folder-name-input');
    const chk = card.querySelector('.folder-select-chk');
    if (!input || !chk) return;
    const folder = input.value.trim();
    const folderItems = state.plan.filter(i => (i.proposedFolderDisplay || (i.proposedPath ? i.proposedPath.join(' / ') : 'Uncategorized')) === folder);
    if (folderItems.length === 0) return;
    const allSelected = folderItems.every(i => i.selected);
    const anySelected = folderItems.some(i => i.selected);
    chk.checked = allSelected;
    chk.indeterminate = (!allSelected && anySelected);
    if (anySelected) {
      card.classList.remove('excluded');
    } else {
      card.classList.add('excluded');
    }
  });
}

function updateCounters() {
  if (state.scanResult) markCurrentDestinations(state.plan, state.scanResult, state.settings);
  renderReviewSummary(state);
  renderBookmarkReview(state, () => {
    renderSimpleFolderCards();
    renderStage1FolderProposals();
    renderCategoryPills();
    applyFilterAndRenderTable();
    updateCounters();
  }, async (url, path) => {
    await settingsManager.saveLearnedRule(url, path, 'url');
    state.categorizer.setLearnedRules(await settingsManager.getLearnedRules());
  });
  const selectedCount = state.plan.filter(p => p.selected).length;
  const moveCount = state.plan.filter(p => p.selected && !p.isAlreadyOrganized).length;
  const canGenerateAi = Boolean(state.settings.geminiEnabled && state.settings.geminiApiKey && state.planSource !== 'ai');
  if (elements.btnCleanAndOrganizeBottom) elements.btnCleanAndOrganizeBottom.disabled = !moveCount && !canGenerateAi;
  if (elements.btnApplyOrganization) elements.btnApplyOrganization.disabled = !moveCount;
  if (elements.txtSelectionCount) {
    elements.txtSelectionCount.textContent = `Selected: ${selectedCount} / ${state.plan.length}`;
  }
  if (elements.txtApplyCount) {
    elements.txtApplyCount.textContent = moveCount.toLocaleString();
  }
  if (elements.txtSimpleApplyCount) {
    elements.txtSimpleApplyCount.textContent = moveCount.toLocaleString();
  }
  if (elements.chkSelectAll) {
    elements.chkSelectAll.checked = selectedCount > 0 && selectedCount === state.plan.length;
    elements.chkSelectAll.indeterminate = selectedCount > 0 && selectedCount < state.plan.length;
  }
  if (elements.metricCategoriesCount) {
    const uniqueCategories = new Set(state.plan.map(p => p.proposedCategoryName));
    elements.metricCategoriesCount.textContent = uniqueCategories.size;
  }
  syncStage1SelectionState();
  syncSimpleSelectionState();
}

function setupEventListeners() {
  document.getElementById('btnCancelOrganization')?.addEventListener('click', () => {
    organizationController?.abort();
    if (elements.progressModalDesc) elements.progressModalDesc.textContent = 'Stopping after the current bookmark. Completed moves can be undone.';
  });
  if (elements.inputSearch) {
    elements.inputSearch.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (elements.btnClearSearch) elements.btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
      applyFilterAndRenderTable();
    });
  }

  if (elements.btnClearSearch) {
    elements.btnClearSearch.addEventListener('click', () => {
      if (elements.inputSearch) elements.inputSearch.value = '';
      state.searchQuery = '';
      elements.btnClearSearch.style.display = 'none';
      applyFilterAndRenderTable();
    });
  }

  if (elements.selectSourceFolder) {
    elements.selectSourceFolder.addEventListener('change', () => {
      applyFilterAndRenderTable();
    });
  }

  if (elements.chkSelectAll) {
    elements.chkSelectAll.addEventListener('change', (e) => {
      for (const item of state.filteredPlan) {
        item.selected = e.target.checked;
      }
      renderTable();
      updateCounters();
    });
  }

  if (elements.btnInvertSelection) {
    elements.btnInvertSelection.addEventListener('click', () => {
      for (const item of state.filteredPlan) {
        item.selected = !item.selected;
      }
      renderTable();
      updateCounters();
    });
  }

  if (elements.btnApplyBatch) {
    elements.btnApplyBatch.addEventListener('click', async () => {
      const newCategory = elements.batchCategorySelect ? elements.batchCategorySelect.value : '';
      if (!newCategory) {
        alert('Please select a category from the dropdown to apply.');
        return;
      }

      const path = newCategory.split(' / ').map(s => s.trim());
      const catObj = state.categories.find(c => c.name === path[0]);
      let modified = 0;

      for (const item of state.filteredPlan) {
        if (item.selected) {
          item.proposedFolderDisplay = newCategory;
          item.proposedPath = path;
          item.proposedCategoryId = catObj ? catObj.id : 'custom';
          item.proposedCategoryName = path[0];
          item.proposedSubcategoryName = path[1] || null;
          item.icon = catObj ? (catObj.icon || '📁') : '📁';
          item.color = catObj ? (catObj.color || '#4361ee') : '#4361ee';
          item.confidence = 'high';
          item.isLearned = true;
          item.matchReason = 'Batch assigned';
          modified++;

          try {
            const urlObj = new URL(item.url);
            const domain = urlObj.hostname.replace(/^www\./, '');
            if (domain) {
              await settingsManager.saveLearnedRule(item.url, newCategory, 'url');
            }
          } catch {}
        }
      }

      const updatedRules = await settingsManager.getLearnedRules();
      state.categorizer.setLearnedRules(updatedRules);

      renderStage1FolderProposals();
      renderSimpleFolderCards();
      renderCategoryPills();
      renderTable();
      updateCounters();
      alert(`Reassigned ${modified} bookmarks to "${newCategory}".`);
    });
  }

  const handleGroupingModeOrThresholdChange = async () => {
    const groupingMode = elements.selectGroupingMode ? elements.selectGroupingMode.value : 'hybrid';
    const hybridThreshold = elements.inputHybridThreshold ? parseInt(elements.inputHybridThreshold.value, 10) : 10;

    if (elements.hybridThresholdGroup) {
      elements.hybridThresholdGroup.style.display = (groupingMode === 'hybrid') ? 'flex' : 'none';
    }

    await settingsManager.saveSettings({
      groupingMode,
      hybridThreshold,
      useSubcategories: groupingMode !== 'flat'
    });
    state.settings.groupingMode = groupingMode;
    state.settings.hybridThreshold = hybridThreshold;
    state.settings.useSubcategories = groupingMode !== 'flat';

    const bookmarks = state.scanResult ? eligibleBookmarks(state.scanResult, state.settings) : [];
    state.plan = treeManager.buildProposedPlan(bookmarks, state.categorizer, {
      groupingMode,
      hybridThreshold,
      useSubcategories: groupingMode !== 'flat'
    });
    applyConfidenceDefaults(state.plan, state.settings);
    state.planSource = 'heuristic';
    populateBatchDropdown();
    renderStage1FolderProposals();
    renderSimpleFolderCards();
    renderCategoryPills();
    applyFilterAndRenderTable();
    updateCounters();
  };

  if (elements.selectGroupingMode) {
    elements.selectGroupingMode.addEventListener('change', handleGroupingModeOrThresholdChange);
  }
  if (elements.inputHybridThreshold) {
    elements.inputHybridThreshold.addEventListener('change', async (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val) || val < 5) val = 5;
      if (val > 25) val = 25;
      e.target.value = val;
      await handleGroupingModeOrThresholdChange();
    });
  }

  if (elements.btnAutoSplitAll) {
    elements.btnAutoSplitAll.addEventListener('click', () => {
      const recs = (state.categorizer && typeof state.categorizer.detectClutterAndSuggestSplits === 'function')
        ? state.categorizer.detectClutterAndSuggestSplits(state.plan, 12)
        : [];
      if (recs.length === 0) {
        alert('No cluttered folders (>12 bookmarks) detected.');
        return;
      }
      state.categorizer.applySubfolderSplits(state.plan, recs);
      renderStage1FolderProposals();
      renderSimpleFolderCards();
      renderCategoryPills();
      applyFilterAndRenderTable();
      alert(`⚡ Successfully split ${recs.length} crowded folders into logical subcategories!`);
    });
  }

  if (elements.btnFilterUncategorized) {
    elements.btnFilterUncategorized.addEventListener('click', () => {
      state.activeCategoryFilter = OTHER_CATEGORY.name;
      updatePillsActiveState();
      applyFilterAndRenderTable();
    });
  }

  if (elements.btnProposeNewFolder) {
    elements.btnProposeNewFolder.addEventListener('click', async () => {
      let folderName = '';
      const promptResult = showConfirmModal(
        'Create a proposed folder',
        '<label for="inputProposedFolderName" class="form-label">Folder name</label><input id="inputProposedFolderName" class="form-input" type="text" maxlength="120" placeholder="Example: Work / Research">',
        () => {
          folderName = document.getElementById('inputProposedFolderName')?.value || '';
        }
      );
      document.getElementById('inputProposedFolderName')?.focus();
      const confirmed = await promptResult;
      if (!confirmed) return;
      if (!folderName || !folderName.trim()) return;
      const cleanName = folderName.trim();
      const path = cleanName.split(' / ').map(s => s.trim()).filter(Boolean);
      const catObj = state.categories.find(c => c.name.toLowerCase() === path[0].toLowerCase());

      const selected = state.plan.filter(p => p.selected);
      if (selected.length > 0) {
        for (const item of selected) {
          item.proposedFolderDisplay = cleanName;
          item.proposedPath = path;
          item.proposedCategoryId = catObj ? catObj.id : 'custom';
          item.proposedCategoryName = path[0];
          item.proposedSubcategoryName = path[1] || null;
          item.icon = catObj ? (catObj.icon || '📁') : '📁';
          item.color = catObj ? (catObj.color || '#4361ee') : '#4361ee';
          item.confidence = 'high';
          item.isLearned = true;
          item.matchReason = 'Assigned to new proposed folder';

          try {
            const urlObj = new URL(item.url);
            const domain = urlObj.hostname.replace(/^www\./, '');
            if (domain) {
              await settingsManager.saveLearnedRule(item.url, cleanName, 'url');
            }
          } catch {}
        }
      } else {
        alert(`New proposed folder "${cleanName}" created. You can now assign bookmarks to it from the table or batch select.`);
      }

      await settingsManager.saveLearnedRule(path[0], cleanName, 'keyword');
      const updatedRules = await settingsManager.getLearnedRules();
      state.categorizer.setLearnedRules(updatedRules);

      renderStage1FolderProposals();
      renderSimpleFolderCards();
      renderCategoryPills();
      applyFilterAndRenderTable();
    });
  }

  // Mode Switcher listeners
  if (elements.btnModeSimple) {
    elements.btnModeSimple.addEventListener('click', () => setUiMode('simple'));
  }
  if (elements.btnModeAdvanced) {
    elements.btnModeAdvanced.addEventListener('click', () => setUiMode('advanced'));
  }
  if (elements.btnSwitchToAdvancedFromSimple) {
    elements.btnSwitchToAdvancedFromSimple.addEventListener('click', () => setUiMode('advanced'));
  }
  if (elements.btnSwitchToSimpleFromAdvanced) {
    elements.btnSwitchToSimpleFromAdvanced.addEventListener('click', () => setUiMode('simple'));
  }

  // Engine Preference Toggle in Simple Mode (Gemini AI vs Fast Local Heuristics)
  if (elements.toggleAiEngine) {
    elements.toggleAiEngine.addEventListener('change', async (e) => {
      const useAi = e.target.checked;
      const hasKey = Boolean(state.settings.geminiApiKey && state.settings.geminiApiKey.trim().length > 5);

      if (useAi && !hasKey) {
        alert('Please configure and verify your free Google Gemini API key in Settings first.');
        elements.toggleAiEngine.checked = false;
        updateEngineToggleUi(false);
        activatePane('tab-settings');
        const keyInput = document.getElementById('inputGeminiApiKey');
        if (keyInput) keyInput.focus();
        return;
      }

      await settingsManager.saveSettings({ geminiEnabled: useAi });
      state.settings.geminiEnabled = useAi;
      state.geminiService.setEnabled(useAi);
      updateEngineToggleUi(useAi);

      if (useAi) {
        await organizeWithGeminiAi();
      } else {
        await performScanAndRender();
      }
    });
  }

  // Unified Primary Action: Clean & Organize Bookmarks
  const handleUnifiedOrganize = async () => {
    if (state.scanResult) markCurrentDestinations(state.plan, state.scanResult, state.settings);
    const isAi = elements.toggleAiEngine
      ? elements.toggleAiEngine.checked
      : Boolean(state.settings.geminiEnabled && state.settings.geminiApiKey && state.settings.geminiApiKey.trim().length > 5);

    if (isAi && state.planSource !== 'ai') {
      const ok = await organizeWithGeminiAi();
      if (!ok) return;
      return; // Give the user a chance to inspect the newly generated AI preview.
    }

    const selectedItems = state.plan.filter(p => p.selected && !p.isAlreadyOrganized);
    if (selectedItems.length === 0) {
      alert('Please select at least one bookmark or folder to organize.');
      return;
    }

    const destSetting = elements.selectSimpleDestination
      ? elements.selectSimpleDestination.value
      : (elements.selectDestinationRoot ? elements.selectDestinationRoot.value : 'dedicated');
    const { destTitle, targetRootParentId } = resolveDestinationSettings(destSetting);

    const cleanEmpty = elements.chkCleanEmptyFolders ? elements.chkCleanEmptyFolders.checked : Boolean(state.settings.cleanEmptyFolders);
    const destLocationLabel = getDestinationLocationLabel(destTitle, targetRootParentId);

    showConfirmModal(
      'Ready to organize?',
      `<p>Organize <strong>${selectedItems.length}</strong> bookmarks into smart category folders?</p>
       <ul style="margin: 12px 0 12px 20px; font-size: 13px; line-height: 1.6;">
         <li>Destination: <strong>${destLocationLabel}</strong></li>
         <li>Suggestions: <strong>${state.planSource === 'ai' ? 'Gemini AI' : 'On your device'}</strong></li>
         <li>Remove empty folders afterward: <strong>${cleanEmpty ? 'Yes' : 'No'}</strong></li>
       </ul>
       <p>Unselected links stay where they are. Restore completed moves from <strong>Undo history</strong>, which keeps your latest 20 snapshots.</p>`,
      async () => {
        await executeOrganization(selectedItems, destTitle, targetRootParentId, cleanEmpty);
      }
    );
  };

  if (elements.btnCleanAndOrganizeBottom) {
    elements.btnCleanAndOrganizeBottom.addEventListener('click', handleUnifiedOrganize);
  }
  if (elements.btnSimpleApply) {
    elements.btnSimpleApply.addEventListener('click', handleUnifiedOrganize);
  }

  // Simple Mode AI & local organize buttons (kept for backward compatibility)
  if (elements.btnSimpleAiOrganize) {
    elements.btnSimpleAiOrganize.addEventListener('click', () => organizeWithGeminiAi());
  }
  if (elements.btnSimpleHeuristicOrganize) {
    elements.btnSimpleHeuristicOrganize.addEventListener('click', async () => {
      if (elements.simpleStatsSummary) {
        elements.simpleStatsSummary.textContent = '🔄 Organizing bookmarks with smart heuristics...';
      }
      await loadConfiguration();
      await performScanAndRender();
      if (elements.simpleStatsSummary) {
        const total = state.plan.length;
        const foldersCount = elements.simpleFoldersGrid ? elements.simpleFoldersGrid.querySelectorAll('.simple-folder-card').length : 0;
        elements.simpleStatsSummary.textContent = `✓ ${total.toLocaleString()} bookmarks organized into ${foldersCount} smart folders. Ready to apply!`;
      }
    });
  }

  // Simple Mode Destination Select
  if (elements.selectSimpleDestination) {
    elements.selectSimpleDestination.addEventListener('change', async (e) => {
      if (elements.selectDestinationRoot) {
        elements.selectDestinationRoot.value = e.target.value;
      }
      const { destTitle, targetRootParentId } = resolveDestinationSettings(e.target.value);
      state.settings.targetRootSetting = e.target.value;
      state.settings.targetRootFolderTitle = destTitle;
      state.settings.targetRootParentId = targetRootParentId;
      await settingsManager.saveSettings({
        targetRootSetting: e.target.value,
        targetRootFolderTitle: destTitle,
        targetRootParentId
      });
      renderSimpleFolderCards();
      updateCounters();
    });
  }

  if (elements.selectDestinationRoot) {
    elements.selectDestinationRoot.addEventListener('change', async (e) => {
      if (elements.selectSimpleDestination) {
        elements.selectSimpleDestination.value = e.target.value;
      }
      const { destTitle, targetRootParentId } = resolveDestinationSettings(e.target.value);
      state.settings.targetRootSetting = e.target.value;
      state.settings.targetRootFolderTitle = destTitle;
      state.settings.targetRootParentId = targetRootParentId;
      await settingsManager.saveSettings({
        targetRootSetting: e.target.value,
        targetRootFolderTitle: destTitle,
        targetRootParentId
      });
      renderSimpleFolderCards();
      updateCounters();
    });
  }

  if (elements.btnRescan) {
    elements.btnRescan.addEventListener('click', async () => {
      await loadConfiguration();
      await performScanAndRender();
    });
  }

  if (elements.btnExportFullBackup) {
    elements.btnExportFullBackup.addEventListener('click', () => {
      if (historyController) historyController.downloadBackupJson();
    });
  }

  if (elements.btnExportBeforeOrganize) {
    elements.btnExportBeforeOrganize.addEventListener('click', () => {
      if (historyController) historyController.downloadBackupJson();
    });
  }

  if (elements.btnApplyOrganization) {
    elements.btnApplyOrganization.addEventListener('click', () => {
      const selectedItems = state.plan.filter(p => p.selected && !p.isAlreadyOrganized);
      if (selectedItems.length === 0) {
        alert('Please select at least one bookmark to organize.');
        return;
      }

      const destSetting = elements.selectDestinationRoot ? elements.selectDestinationRoot.value : 'dedicated';
      const { destTitle, targetRootParentId } = resolveDestinationSettings(destSetting);

      const cleanEmpty = elements.chkCleanEmptyFolders ? elements.chkCleanEmptyFolders.checked : false;
      const destLocationLabel = getDestinationLocationLabel(destTitle, targetRootParentId);

      showConfirmModal(
        'Apply Bookmark Organization',
        `<p>Organize <strong>${selectedItems.length}</strong> bookmarks into smart category folders?</p>
         <ul style="margin: 12px 0 12px 20px; font-size: 13px; line-height: 1.6;">
           <li>Destination: <strong>${destLocationLabel}</strong></li>
           <li>Hierarchy: <strong>${elements.selectGroupingMode ? elements.selectGroupingMode.value : 'hybrid'}</strong></li>
           <li>Clean empty folders: <strong>${cleanEmpty ? 'Yes' : 'No'}</strong></li>
         </ul>
         <p>A full <strong>reversible undo snapshot</strong> will be created so you can restore anytime with 1 click.</p>`,
        async () => {
          await executeOrganization(selectedItems, destTitle, targetRootParentId, cleanEmpty);
        }
      );
    });
  }

  // Testing Sandbox
  if (elements.btnScatterBookmarks) {
    elements.btnScatterBookmarks.addEventListener('click', handleScatterBookmarks);
  }
  if (elements.btnGenerateSampleBookmarks) {
    elements.btnGenerateSampleBookmarks.addEventListener('click', handleGenerateSampleBookmarks);
  }
  if (elements.btnRemoveSampleBookmarks) {
    elements.btnRemoveSampleBookmarks.addEventListener('click', handleRemoveSampleBookmarks);
  }

  if (elements.btnQuickUndoScatter) {
    elements.btnQuickUndoScatter.addEventListener('click', async () => {
      const snapshotId = elements.btnQuickUndoScatter.dataset.snapshotId;
      if (!snapshotId) return;
      try {
        await undoManager.restoreSnapshot(snapshotId);
        if (elements.scatterNoticeBanner) elements.scatterNoticeBanner.style.display = 'none';
        await performScanAndRender();
        if (historyController) await historyController.render();
        updateHistoryBadge();
        await updateTestingState();
        alert('↩️ Bookmarks restored to original structure successfully!');
      } catch (err) {
        alert(`Restore failed: ${err.message}`);
      }
    });
  }

  // Testing Sandbox Modal
  if (elements.btnOpenTestingTools && elements.testingModal) {
    elements.btnOpenTestingTools.addEventListener('click', async () => {
      await updateTestingState();
      elements.testingModal.style.display = 'flex';
    });
  }
  if (elements.btnCloseTestingModal && elements.testingModal) {
    elements.btnCloseTestingModal.addEventListener('click', () => {
      elements.testingModal.style.display = 'none';
    });
  }
  if (elements.btnDoneTestingModal && elements.testingModal) {
    elements.btnDoneTestingModal.addEventListener('click', () => {
      elements.testingModal.style.display = 'none';
    });
  }
  if (elements.btnModalScatterBookmarks) {
    elements.btnModalScatterBookmarks.addEventListener('click', async () => {
      if (elements.testingModal) elements.testingModal.style.display = 'none';
      await handleScatterBookmarks();
    });
  }
  if (elements.btnModalGenerateSample) {
    elements.btnModalGenerateSample.addEventListener('click', async () => {
      await handleGenerateSampleBookmarks();
    });
  }
  if (elements.btnModalRemoveSample) {
    elements.btnModalRemoveSample.addEventListener('click', async () => {
      await handleRemoveSampleBookmarks();
    });
  }
}

async function updateTestingState() {
  try {
    const hasSamples = await treeManager.hasSampleBookmarks();
    if (elements.btnGenerateSampleBookmarks) {
      elements.btnGenerateSampleBookmarks.style.display = hasSamples ? 'none' : 'inline-flex';
    }
    if (elements.btnRemoveSampleBookmarks) {
      elements.btnRemoveSampleBookmarks.style.display = hasSamples ? 'inline-flex' : 'none';
    }
    if (elements.btnModalGenerateSample) {
      elements.btnModalGenerateSample.style.display = hasSamples ? 'none' : 'inline-flex';
    }
    if (elements.btnModalRemoveSample) {
      elements.btnModalRemoveSample.style.display = hasSamples ? 'inline-flex' : 'none';
    }
  } catch (err) {
    console.warn('Could not update testing state:', err);
  }
}

function showScatterNotice(count, snapshotId) {
  if (!elements.scatterNoticeBanner) return;
  if (elements.scatterNoticeMessage) {
    elements.scatterNoticeMessage.textContent = `🎲 Scattered ${count} bookmarks into test folders! An automatic reversible undo snapshot was saved.`;
  }
  if (elements.btnQuickUndoScatter) {
    elements.btnQuickUndoScatter.dataset.snapshotId = snapshotId || '';
  }
  elements.scatterNoticeBanner.style.display = 'flex';
}

function updateHistoryBadge() {
  undoManager.getAllSnapshots().then(snapshots => {
    const badge = document.getElementById('badgeHistoryCount');
    if (badge) badge.textContent = snapshots.length;
  }).catch(() => {});
}

async function handleScatterBookmarks() {
  const count = state.scanResult ? state.scanResult.stats.totalBookmarks : 0;
  if (count === 0) {
    alert('No bookmarks found to scatter. Try generating sample bookmarks first!');
    return;
  }

  const confirmed = await showConfirmModal(
    'Scatter Bookmarks for Testing?',
    `<p>Unpack <strong>${count}</strong> bookmarks and scatter them across test folders (<em>Old Folder A</em>, <em>Random Links</em>, <em>Unsorted</em>, and Bookmarks Bar)?</p>
     <p style="margin-top: 10px; font-size: 13px; color: var(--text-muted);">
       🛡️ <strong>A recovery snapshot is saved automatically first</strong>, so you can restore the moved bookmarks with 1 click.
     </p>`
  );
  if (!confirmed) return;

  try {
    const result = await treeManager.scatterBookmarks(null, { undoManager });
    await performScanAndRender();
    if (historyController) await historyController.render();
    updateHistoryBadge();
    showScatterNotice(result.totalMoved, result.snapshot ? result.snapshot.id : null);
  } catch (err) {
    alert(`Scatter operation failed: ${err.message}`);
  }
}

async function handleResetFolders() {
  if (organizationController) return;
  const button = document.getElementById('btnResetFolders');
  button.disabled = true;
  organizationController = new AbortController();
  let started = false;
  try {
    const plan = buildFolderResetPlan(await chrome.bookmarks.getTree());
    if (!plan.folders.length && !plan.moves.length) {
      alert('Your bookmarks are already outside all removable folders.');
      return;
    }
    const confirmed = await showConfirmModal(
      'Reset all bookmark folders?',
      `<p>Move <strong>${plan.moves.length}</strong> bookmarks out of their folders and remove up to <strong>${plan.folders.length}</strong> custom folders, including empty folders.</p>
       <p>Links will sit directly in their current Bookmarks Bar, Other Bookmarks, or Mobile Bookmarks section. Chrome’s built-in sections and managed bookmarks stay in place.</p>
       <p>This reset includes folders you protected from organization. No bookmarks are deleted. An undo snapshot saves the original folders and link order before the reset starts.</p>
       <p>Keep this dashboard open until the reset finishes. Then use <strong>Review &amp; organize</strong> to arrange your links again.</p>`
    );
    if (!confirmed) return;
    started = true;
    const cancelButton = document.getElementById('btnCancelOrganization');
    if (cancelButton) cancelButton.hidden = true;
    elements.progressModalTitle.textContent = 'Resetting bookmark folders…';
    elements.progressModalDesc.textContent = 'Moving links out, then removing empty folders…';
    elements.progressBarFill.style.width = '0%';
    elements.progressStats.textContent = 'Saving undo snapshot…';
    elements.progressModal.style.display = 'flex';
    const result = await resetBookmarkFolders(chrome.bookmarks, undoManager, progress => {
      elements.progressBarFill.style.width = `${progress.percent}%`;
      elements.progressStats.textContent = `${progress.completed} / ${progress.total}`;
    });
    const notice = document.getElementById('organizationNotice');
    notice.hidden = false;
    notice.textContent = `${result.failedCount ? 'Reset partially completed.' : 'Reset complete.'} ${result.totalMoved} bookmarks moved out; ${result.removedFolders} folders removed. ${result.failedCount ? 'Some items could not be changed; non-empty folders were kept. ' : ''}${result.managedCount ? 'Managed items were kept. ' : ''}Use Review & organize to arrange your links, or Undo history to restore the original folders.`;
  } catch (error) {
    alert(`Folder reset stopped: ${error.message}. If changes started, restore them from Undo history.`);
  } finally {
    organizationController = null;
    button.disabled = false;
    if (started) {
      elements.progressModal.style.display = 'none';
      await performScanAndRender();
      if (historyController) await historyController.render();
    }
  }
}

async function handleGenerateSampleBookmarks() {
  try {
    const result = await treeManager.generateSampleBookmarks({ undoManager });
    await performScanAndRender();
    if (historyController) await historyController.render();
    updateHistoryBadge();
    await updateTestingState();
    alert(`✨ Injected ${result.count} realistic sample bookmarks across AI, Germany, Study Abroad, Gaming, Trading & Health into scattered test folders! Switch to the Organize & Preview tab to review proposed folders.`);
  } catch (err) {
    alert(`Failed to generate sample bookmarks: ${err.message}`);
  }
}

async function handleRemoveSampleBookmarks() {
  const confirmed = await showConfirmModal(
    'Remove Sample Test Bookmarks?',
    'This will remove all 25 sample test bookmarks and clean up any empty test folders created for them.'
  );
  if (!confirmed) return;

  try {
    const result = await treeManager.removeSampleBookmarks();
    if (elements.scatterNoticeBanner) elements.scatterNoticeBanner.style.display = 'none';
    await performScanAndRender();
    if (historyController) await historyController.render();
    updateHistoryBadge();
    await updateTestingState();
    alert(`🧹 Removed ${result.removedBookmarksCount} sample test bookmarks cleanly.`);
  } catch (err) {
    alert(`Failed to remove sample bookmarks: ${err.message}`);
  }
}


export async function executeOrganization(
  selectedItems,
  destFolderTitle,
  targetRootParentId = '1',
  cleanEmpty = false,
  managers = null
) {
  let activeManagers = managers;

  let destTitle = destFolderTitle;
  let parentId = targetRootParentId;
  let clean = cleanEmpty;

  // Support options object signature if passed:
  // executeOrganization(selectedItems, { targetRootFolderTitle, targetRootParentId, cleanEmptyFolders }, managers)
  if (destFolderTitle && typeof destFolderTitle === 'object' && !Array.isArray(destFolderTitle)) {
    destTitle = destFolderTitle.targetRootFolderTitle !== undefined
      ? destFolderTitle.targetRootFolderTitle
      : 'Organized Bookmarks';
    parentId = destFolderTitle.targetRootParentId || destFolderTitle.targetParentId || '1';
    clean = Boolean(destFolderTitle.cleanEmptyFolders);

    // If managers was passed as 2nd arg inside options or 3rd arg:
    if (destFolderTitle.managers) {
      activeManagers = destFolderTitle.managers;
    } else if (targetRootParentId && typeof targetRootParentId === 'object') {
      activeManagers = targetRootParentId;
    }
  }

  const activeTreeManager = (activeManagers && activeManagers.treeManager) || treeManager;
  const activeUndoManager = (activeManagers && activeManagers.undoManager) || undoManager;

  const resolvedTargetRootParentId = String(parentId || '1');
  const items = Array.isArray(selectedItems) ? selectedItems : [];
  if (items.some(item => item.proposedCategoryId === 'other' || item.confidence === 'none')) {
    const message = 'Choose a folder for the selected unclassified bookmarks in Review before organizing, or leave them in place.';
    if (typeof alert !== 'undefined') alert(message);
    return { success: false, error: message };
  }
  if (organizationController) return { success: false, error: 'An organization is already running.' };
  organizationController = new AbortController();
  const cancelButton = typeof document !== 'undefined' ? document.getElementById('btnCancelOrganization') : null;
  if (cancelButton) cancelButton.hidden = false;

  if (elements.progressModalTitle) elements.progressModalTitle.textContent = 'Organizing Bookmarks...';
  if (elements.progressModalDesc) elements.progressModalDesc.textContent = 'Relocating bookmarks into smart category folders...';
  if (elements.progressBarFill) elements.progressBarFill.style.width = '0%';
  if (elements.progressModal) elements.progressModal.style.display = 'flex';

  let safetySnapshot = null;
  try {
    const plannedRecords = items.filter(item => item.selected !== false).map(item => ({
      id: item.id,
      title: item.title,
      url: item.url,
      originalParentId: item.currentParentId,
      originalIndex: item.currentIndex,
      originalFolderPath: item.originalFolderPath || (item.currentLocation ? item.currentLocation.split(' / ') : [])
    }));
    if (plannedRecords.length) {
      safetySnapshot = await activeUndoManager.saveSnapshot(
        `Organization in progress (${plannedRecords.length} bookmarks)`,
        plannedRecords,
        [],
        'reorganization',
        { status: 'pending' }
      );
    }

    const result = await activeTreeManager.executePlan(
      items,
      {
        targetRootFolderTitle: destTitle,
        targetRootParentId: resolvedTargetRootParentId,
        cleanEmptyFolders: clean,
        excludedFolderIds: state.settings.excludedFolderIds || [],
        signal: organizationController.signal
      },
      (progress) => {
        if (elements.progressBarFill) elements.progressBarFill.style.width = `${progress.percent}%`;
        if (elements.progressStats) elements.progressStats.textContent = `${progress.percent}% (${progress.completed} / ${progress.total})`;
      }
    );

    if (safetySnapshot && result.movedItems && (result.movedItems.length > 0 || (result.createdFolders && result.createdFolders.length > 0))) {
      const snapshotTitle = `Reorganization of ${result.totalMoved} bookmarks`;
      if (typeof activeUndoManager.updateSnapshot === 'function') {
        await activeUndoManager.updateSnapshot(safetySnapshot.id, {
          title: snapshotTitle,
          items: result.movedItems,
          createdFolders: result.createdFolders,
          status: 'active'
        });
      } else {
        await activeUndoManager.saveSnapshot(snapshotTitle, result.movedItems, result.createdFolders, 'reorganization');
      }
    } else if (safetySnapshot && typeof activeUndoManager.deleteSnapshot === 'function') {
      await activeUndoManager.deleteSnapshot(safetySnapshot.id);
    }

    const completedPlan = state.plan;
    await (async () => {
      try {
        if (elements.progressModal) elements.progressModal.style.display = 'none';
        const outcome = `${result.cancelled ? 'Stopped.' : 'Done.'} ${result.totalMoved} bookmarks moved. ${result.failedItems?.length ? `${result.failedItems.length} could not be moved. ` : ''}${result.totalMoved ? 'Open Undo history to restore these changes.' : 'No bookmarks were moved.'}`;
        const notice = typeof document !== 'undefined' ? document.getElementById('organizationNotice') : null;
        if (notice) { notice.hidden = false; notice.textContent = outcome; }
        else if (typeof alert !== 'undefined') {
          if (result.totalMoved > 0) {
            alert(`🎉 Successfully organized ${result.totalMoved} bookmarks! A reversible undo snapshot was saved.`);
          } else {
            alert('ℹ All selected bookmarks are already organized in their destination folders!');
          }
        }
        if (typeof chrome !== 'undefined' && chrome.bookmarks) {
          await performScanAndRender();
          // Keep the results visible instead of immediately generating another
          // Needs Review screen after the user has finished organizing.
          const freshPlan = state.plan;
          state.plan = completedPlan;
          showOrganizationResult(state, result);
          state.plan = freshPlan;
        }
      } catch (postErr) {
        console.error('Post-organization refresh error:', postErr);
      }
    })();

    return result;
  } catch (err) {
    if (elements.progressModal) elements.progressModal.style.display = 'none';
    if (typeof alert !== 'undefined') {
      alert('Organization error: ' + err.message);
    } else if (typeof chrome !== 'undefined') {
      console.warn('Organization error:', err.message);
    }
    return { success: false, error: err.message };
  } finally {
    organizationController = null;
    if (cancelButton) cancelButton.hidden = true;
  }
}
