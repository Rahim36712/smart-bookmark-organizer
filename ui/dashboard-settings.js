import { escapeHtml, showConfirmModal, showToast } from './dashboard-utils.js';
import { GeminiService } from '../core/gemini-service.js';

const alert = message => showToast(message);
const GEMINI_API_ORIGIN = 'https://generativelanguage.googleapis.com/*';

async function ensureGeminiPermission() {
  if (typeof chrome === 'undefined' || !chrome.permissions?.contains || !chrome.permissions?.request) return true;
  const permission = { origins: [GEMINI_API_ORIGIN] };
  if (await chrome.permissions.contains(permission)) return true;
  return chrome.permissions.request(permission);
}

async function releaseGeminiPermission() {
  if (typeof chrome === 'undefined' || !chrome.permissions?.remove) return;
  await chrome.permissions.remove({ origins: [GEMINI_API_ORIGIN] });
}

export class DashboardSettingsController {
  constructor(settingsManager, onSettingsChanged) {
    this.settingsManager = settingsManager;
    this.onSettingsChanged = onSettingsChanged;
    this.geminiService = new GeminiService();

    this.toggleAuto = document.getElementById('settingAutoOrganize');
    this.toggleClean = document.getElementById('settingCleanEmpty');
    this.toggleSub = document.getElementById('settingUseSubcategories');
    this.selectGroupingMode = document.getElementById('settingGroupingMode');
    this.inputHybridThreshold = document.getElementById('settingHybridThreshold');
    this.settingHybridThresholdRow = document.getElementById('settingHybridThresholdRow');
    this.categoriesList = document.getElementById('settingsCategoriesList');
    this.learnedRulesList = document.getElementById('settingsLearnedRulesList');
    this.btnOpenAddModal = document.getElementById('btnOpenAddCategoryModal');
    this.btnReset = document.getElementById('btnResetDefaultRules');
    this.btnClearLearned = document.getElementById('btnClearLearnedRules');

    // Gemini AI controls
    this.toggleGemini = document.getElementById('settingGeminiEnabled');
    this.selectGeminiModel = document.getElementById('selectGeminiModel');
    this.geminiModelBadge = document.getElementById('geminiModelBadge') || document.querySelector('.gemini-pill-badge');
    this.inputGeminiApiKey = document.getElementById('inputGeminiApiKey');
    this.btnToggleApiKey = document.getElementById('btnToggleApiKeyVisibility');
    this.btnTestGeminiKey = document.getElementById('btnTestGeminiKey');
    this.btnForgetGeminiKey = document.getElementById('btnForgetGeminiKey');
    this.geminiConsent = document.getElementById('settingGeminiConsent');
    this.geminiStripQueryParams = document.getElementById('settingGeminiStripQueryParams');
    this.geminiExcludePrivateUrls = document.getElementById('settingGeminiExcludePrivateUrls');
    this.geminiTestStatus = document.getElementById('geminiTestStatus');

    this.addModal = document.getElementById('addCategoryModal');
    this.inputName = document.getElementById('inputNewCatName');
    this.inputIcon = document.getElementById('inputNewCatIcon');
    this.inputDomains = document.getElementById('inputNewCatDomains');
    this.inputKeywords = document.getElementById('inputNewCatKeywords');
    this.btnSaveCat = document.getElementById('btnSaveNewCategory');
    this.btnCancelCat = document.getElementById('btnCancelAddCategory');

    this.setupListeners();
  }

  setupListeners() {
    if (this.toggleAuto) {
      this.toggleAuto.addEventListener('change', async (e) => {
        await this.settingsManager.saveSettings({ autoOrganize: e.target.checked });
        if (this.onSettingsChanged) await this.onSettingsChanged();
      });
    }

    if (this.toggleClean) {
      this.toggleClean.addEventListener('change', async (e) => {
        await this.settingsManager.saveSettings({ cleanEmptyFolders: e.target.checked });
        if (this.onSettingsChanged) await this.onSettingsChanged();
      });
    }

    if (this.selectGroupingMode) {
      this.selectGroupingMode.addEventListener('change', async (e) => {
        const mode = e.target.value;
        if (this.settingHybridThresholdRow) {
          this.settingHybridThresholdRow.style.display = (mode === 'hybrid') ? 'flex' : 'none';
        }
        await this.settingsManager.saveSettings({
          groupingMode: mode,
          useSubcategories: mode !== 'flat'
        });
        if (this.onSettingsChanged) await this.onSettingsChanged();
      });
    }

    if (this.toggleSub) {
      this.toggleSub.addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        const current = await this.settingsManager.getSettings();
        const mode = enabled ? (current.groupingMode === 'flat' ? 'hybrid' : current.groupingMode) : 'flat';
        await this.settingsManager.saveSettings({ useSubcategories: enabled, groupingMode: mode });
        if (this.onSettingsChanged) await this.onSettingsChanged();
      });
    }

    if (this.inputHybridThreshold) {
      this.inputHybridThreshold.addEventListener('change', async (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 5) val = 5;
        if (val > 25) val = 25;
        e.target.value = val;
        await this.settingsManager.saveSettings({ hybridThreshold: val });
        if (this.onSettingsChanged) await this.onSettingsChanged();
      });
    }

    // Gemini AI listeners
    if (this.toggleGemini) {
      this.toggleGemini.addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        const currentKey = this.inputGeminiApiKey ? this.inputGeminiApiKey.value.trim() : '';

        if (enabled && (!currentKey || currentKey.length < 6)) {
          alert('Please enter and verify your Gemini API key to enable AI features.');
          this.toggleGemini.checked = false;
          if (this.inputGeminiApiKey) this.inputGeminiApiKey.focus();
          return;
        }

        if (enabled && !this.geminiConsent?.checked) {
          alert('Please confirm that you understand bookmark titles and cleaned URLs are sent to Google.');
          this.toggleGemini.checked = false;
          return;
        }

        if (enabled && !(await ensureGeminiPermission())) {
          alert('Google access was not allowed. Gemini stays off and local suggestions still work.');
          this.toggleGemini.checked = false;
          return;
        }

        await this.settingsManager.saveSettings({ geminiEnabled: enabled, geminiConsentAccepted: enabled });
        if (this.onSettingsChanged) await this.onSettingsChanged();
      });
    }

    if (this.geminiStripQueryParams) {
      this.geminiStripQueryParams.addEventListener('change', async e => {
        await this.settingsManager.saveSettings({ geminiStripQueryParams: e.target.checked });
        if (this.onSettingsChanged) await this.onSettingsChanged();
      });
    }

    if (this.geminiExcludePrivateUrls) {
      this.geminiExcludePrivateUrls.addEventListener('change', async e => {
        await this.settingsManager.saveSettings({ geminiExcludePrivateUrls: e.target.checked });
        if (this.onSettingsChanged) await this.onSettingsChanged();
      });
    }

    if (this.btnToggleApiKey && this.inputGeminiApiKey) {
      this.btnToggleApiKey.addEventListener('click', () => {
        const isPassword = this.inputGeminiApiKey.type === 'password';
        this.inputGeminiApiKey.type = isPassword ? 'text' : 'password';
        this.btnToggleApiKey.textContent = isPassword ? '🙈 Hide' : '👁️ Show';
      });
    }

    if (this.selectGeminiModel) {
      this.selectGeminiModel.addEventListener('change', async (e) => {
        const selectedModel = e.target.value;
        await this.settingsManager.saveSettings({ geminiModel: selectedModel });
        if (this.geminiService) {
          this.geminiService.setModel(selectedModel);
        }
        if (this.geminiModelBadge) {
          this.geminiModelBadge.textContent = selectedModel === 'auto'
            ? (this.geminiService ? this.geminiService.model : 'gemini-3.6-flash')
            : selectedModel;
        }
        if (this.onSettingsChanged) await this.onSettingsChanged();
      });
    }

    if (this.btnTestGeminiKey && this.inputGeminiApiKey) {
      this.btnTestGeminiKey.addEventListener('click', async () => {
        const key = this.inputGeminiApiKey.value.trim();
        if (!key) {
          this.showGeminiStatus('Please enter a Gemini API key first.', false);
          return;
        }
        if (!this.geminiConsent?.checked) {
          this.showGeminiStatus('Please confirm that you understand what is sent to Google.', false);
          return;
        }

        const selectedModel = this.selectGeminiModel ? this.selectGeminiModel.value : 'auto';
        this.geminiService.setModel(selectedModel);

        this.btnTestGeminiKey.disabled = true;
        this.btnTestGeminiKey.textContent = 'Verifying...';
        this.showGeminiStatus(`Connecting to Google Gemini API (${this.geminiService.model})...`, null);
        this.geminiService.onStatus = event => this.showGeminiStatus(event.message, null);

        try {
          const permissionGranted = await ensureGeminiPermission();
          if (!permissionGranted) {
            this.showGeminiStatus('Google access was not allowed. Gemini stays off and local suggestions still work.', false);
            return;
          }
          const testResult = await this.geminiService.testConnection(key);
          const connectedModel = (testResult && testResult.model) || this.geminiService.model;
          const modelToSave = selectedModel === 'auto' ? 'auto' : connectedModel;

          if (this.selectGeminiModel && selectedModel !== 'auto' && selectedModel !== connectedModel) {
            this.selectGeminiModel.value = connectedModel;
          }

          await this.settingsManager.saveSettings({
            geminiApiKey: key,
            geminiEnabled: true,
            geminiConsentAccepted: true,
            geminiModel: modelToSave
          });
          if (this.toggleGemini) this.toggleGemini.checked = true;
          if (this.geminiModelBadge) {
            this.geminiModelBadge.textContent = connectedModel;
          }

          this.showGeminiStatus(`✓ Verified & connected to ${connectedModel}!`, true);
          if (this.onSettingsChanged) await this.onSettingsChanged();
        } catch (err) {
          console.error('Gemini verification error:', err);
          this.showGeminiStatus(`✗ Verification failed: ${err.message}`, false);
        } finally {
          this.geminiService.onStatus = null;
          this.btnTestGeminiKey.disabled = false;
          this.btnTestGeminiKey.textContent = 'Verify & Save';
        }
      });
    }

    if (this.btnForgetGeminiKey) {
      this.btnForgetGeminiKey.addEventListener('click', () => {
        showConfirmModal(
          'Remove Gemini API Key',
          '<p>Remove the saved Gemini key and return to local suggestions?</p>',
          async () => {
            await this.settingsManager.forgetGeminiApiKey();
            await releaseGeminiPermission();
            this.geminiService.setApiKey('');
            if (this.inputGeminiApiKey) this.inputGeminiApiKey.value = '';
            if (this.toggleGemini) this.toggleGemini.checked = false;
            if (this.geminiConsent) this.geminiConsent.checked = false;
            this.showGeminiStatus('Gemini key removed. Local suggestions are active.', true);
            if (this.onSettingsChanged) await this.onSettingsChanged();
          }
        );
      });
    }

    if (this.btnOpenAddModal) {
      this.btnOpenAddModal.addEventListener('click', () => {
        if (this.addModal) this.addModal.style.display = 'flex';
      });
    }

    if (this.btnCancelCat) {
      this.btnCancelCat.addEventListener('click', () => {
        if (this.addModal) this.addModal.style.display = 'none';
      });
    }

    if (this.addModal) {
      this.addModal.addEventListener('click', (e) => {
        if (e.target === this.addModal) {
          this.addModal.style.display = 'none';
        }
      });
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && this.addModal && this.addModal.style.display === 'flex') {
            this.addModal.style.display = 'none';
          }
        });
      }
    }

    if (this.btnSaveCat) {
      this.btnSaveCat.addEventListener('click', async () => {
        const name = this.inputName ? this.inputName.value.trim() : '';
        if (!name) {
          alert('Please provide a category name.');
          return;
        }

      const icon = this.inputIcon.value.trim() || '📁';
      const domains = this.inputDomains.value.split(',').map(s => s.trim()).filter(Boolean);
      const keywords = this.inputKeywords.value.split(',').map(s => s.trim()).filter(Boolean);

      const newCategory = {
        id: 'custom_' + Date.now(),
        name,
        icon,
        color: '#4361ee',
        domains,
        titleKeywords: keywords,
        urlKeywords: keywords,
        subcategories: []
      };

      const categories = await this.settingsManager.getCategories();
      const customOnly = categories.filter(c => c.id.startsWith('custom_'));
      customOnly.push(newCategory);
      await this.settingsManager.saveCustomCategories(customOnly);

      this.addModal.style.display = 'none';
      this.inputName.value = '';
      this.inputDomains.value = '';
      this.inputKeywords.value = '';

      alert(`Category "${name}" saved!`);
      if (this.onSettingsChanged) await this.onSettingsChanged();
      });
    }

    if (this.btnReset) {
      this.btnReset.addEventListener('click', () => {
        showConfirmModal(
          'Reset Taxonomy Rules',
          '<p>Reset all category taxonomies, rules, and settings back to factory defaults?</p><p style="margin-top: 8px; font-size: 13px; color: var(--text-muted);">Custom categories and learned preferences will be cleared.</p>',
          async () => {
            await this.settingsManager.resetToDefaults();
            alert('Categories and rules reset to defaults.');
            if (this.onSettingsChanged) await this.onSettingsChanged();
          }
        );
      });
    }

    if (this.btnClearLearned) {
      this.btnClearLearned.addEventListener('click', () => {
        showConfirmModal(
          'Clear Learned Rules',
          '<p>Clear all adaptive learned preferences? The extension will revert to default heuristic matching.</p>',
          async () => {
            await this.settingsManager.clearLearnedRules();
            alert('Learned rules cleared.');
            if (this.onSettingsChanged) await this.onSettingsChanged();
          }
        );
      });
    }
  }

  showGeminiStatus(message, isSuccess) {
    if (!this.geminiTestStatus) return;
    this.geminiTestStatus.textContent = message;
    this.geminiTestStatus.style.display = 'block';
    this.geminiTestStatus.className = 'gemini-status-message ' +
      (isSuccess === true ? 'gemini-status-success' : isSuccess === false ? 'gemini-status-error' : '');
  }

  async render() {
    const settings = await this.settingsManager.getSettings();
    const categories = await this.settingsManager.getCategories();

    if (this.toggleAuto) this.toggleAuto.checked = Boolean(settings.autoOrganize);
    if (this.toggleClean) this.toggleClean.checked = Boolean(settings.cleanEmptyFolders);
    const activeMode = settings.groupingMode || (settings.useSubcategories === false ? 'flat' : 'hybrid');
    if (this.selectGroupingMode) this.selectGroupingMode.value = activeMode;
    if (this.settingHybridThresholdRow) {
      this.settingHybridThresholdRow.style.display = (activeMode === 'hybrid') ? 'flex' : 'none';
    }
    if (this.toggleSub) this.toggleSub.checked = activeMode !== 'flat';
    if (this.inputHybridThreshold) this.inputHybridThreshold.value = settings.hybridThreshold || 10;

    if (this.toggleGemini) {
      this.toggleGemini.checked = Boolean(settings.geminiEnabled);
    }
    if (this.geminiConsent) this.geminiConsent.checked = Boolean(settings.geminiConsentAccepted);
    if (this.geminiStripQueryParams) this.geminiStripQueryParams.checked = settings.geminiStripQueryParams !== false;
    if (this.geminiExcludePrivateUrls) this.geminiExcludePrivateUrls.checked = settings.geminiExcludePrivateUrls !== false;
    if (this.inputGeminiApiKey) {
      this.inputGeminiApiKey.value = settings.geminiApiKey || '';
    }
    if (this.selectGeminiModel) {
      const validModels = ['auto', ...GeminiService.FALLBACK_MODELS];
      const savedModel = settings.geminiModel || 'auto';
      this.selectGeminiModel.value = validModels.includes(savedModel) ? savedModel : 'gemini-3.6-flash';
    }
    if (this.geminiModelBadge) {
      const activeModel = (settings.geminiModel && settings.geminiModel !== 'auto')
        ? settings.geminiModel
        : (this.geminiService ? this.geminiService.model : 'gemini-3.6-flash');
      this.geminiModelBadge.textContent = activeModel;
    }

    if (this.categoriesList) this.categoriesList.innerHTML = '';

    for (const cat of categories) {
      const isCustom = cat.id.startsWith('custom_');
      const item = document.createElement('div');
      item.className = 'cat-config-item';

      item.innerHTML = `
        <div class="cat-config-badge">
          <span>${cat.icon || '📁'}</span>
          <span>${escapeHtml(cat.name)}</span>
          ${isCustom ? '<span style="font-size: 10px; background: #e0e7ff; color: #4338ca; padding: 1px 6px; border-radius: 6px;">Custom</span>' : ''}
        </div>
        <div style="font-size: 11px; color: var(--text-muted);">
          ${cat.domains ? cat.domains.length : 0} domains &middot; ${cat.titleKeywords ? cat.titleKeywords.length : 0} keywords
        </div>
      `;

      this.categoriesList.appendChild(item);
    }

    if (this.learnedRulesList) {
      const learned = await this.settingsManager.getLearnedRules();
      this.learnedRulesList.innerHTML = '';
      if (!learned || learned.length === 0) {
        this.learnedRulesList.innerHTML = '<div style="padding: 12px; font-size: 13px; color: var(--text-muted);">No learned rules yet. As you rename folders and manually reassign bookmarks, your preferences will appear here automatically.</div>';
      } else {
        for (const rule of learned) {
          const item = document.createElement('div');
          item.className = 'cat-config-item';
          item.innerHTML = `
            <div class="cat-config-badge">
              <span>🧠</span>
              <span><strong>${escapeHtml(rule.pattern)}</strong> &rarr; ${escapeHtml(rule.targetFolder || rule.targetCategory)}</span>
              <span style="font-size: 10px; background: #e0e7ff; color: #4338ca; padding: 1px 6px; border-radius: 6px;">${rule.type || 'domain'}</span>
            </div>
            <button class="btn btn-sm btn-outline btn-remove-learned" data-pattern="${escapeHtml(rule.pattern)}" style="padding: 2px 8px; font-size: 11px;">Remove</button>
          `;
          item.querySelector('.btn-remove-learned').addEventListener('click', async (e) => {
            const pat = e.target.dataset.pattern;
            await this.settingsManager.removeLearnedRule(pat);
            if (this.onSettingsChanged) await this.onSettingsChanged();
          });
          this.learnedRulesList.appendChild(item);
        }
      }
    }
  }
}
