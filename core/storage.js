/**
 * Chrome Storage Wrapper & Settings Manager
 * 100% local storage persistence for user configuration and custom rules.
 */

import { DEFAULT_CATEGORIES } from './default-rules.js';
import { normalizeBookmarkUrl } from './classification-evidence.js';

export const DEFAULT_SETTINGS = {
  autoOrganize: false,
  onboardingComplete: false,
  highConfidenceOnly: true,
  excludedFolderIds: [],
  groupingMode: 'hybrid', // 'hybrid', 'flat', 'hierarchical'
  hybridThreshold: 10, // Min bookmarks in category to split into subfolders (5-25)
  useSubcategories: true, // Legacy compatibility
  cleanEmptyFolders: false,
  targetRootSetting: 'dedicated',
  targetRootFolderTitle: 'Organized Bookmarks',
  targetRootParentId: '1', // Bookmarks bar
  minScoreThreshold: 15,
  uiMode: 'simple', // 'simple' or 'advanced'
  geminiEnabled: false,
  geminiApiKey: '',
  geminiModel: 'gemini-3.6-flash',
  geminiConsentAccepted: false,
  geminiStripQueryParams: true,
  geminiExcludePrivateUrls: true
};

export class SettingsManager {
  constructor(storageArea = null) {
    this.storage = storageArea || (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local ? chrome.storage.local : null);
    this.SETTINGS_KEY = 'organizer_settings';
    this.GEMINI_API_KEY_KEY = 'organizer_gemini_api_key';
    this.CUSTOM_CATEGORIES_KEY = 'organizer_custom_categories';
    this.LEARNED_RULES_KEY = 'organizer_learned_rules';
  }

  /**
   * Get user settings with defaults fallback
   */
  async getSettings() {
    if (!this.storage) return { ...DEFAULT_SETTINGS };
    const result = await this.storage.get(this.SETTINGS_KEY);
    const storedSettings = result[this.SETTINGS_KEY] || {};
    const keyResult = await this.storage.get(this.GEMINI_API_KEY_KEY);
    const separateKey = keyResult[this.GEMINI_API_KEY_KEY];
    const legacyKey = storedSettings.geminiApiKey || '';
    const settings = { ...DEFAULT_SETTINGS, ...storedSettings, geminiApiKey: separateKey !== undefined ? separateKey : legacyKey };
    if (legacyKey && separateKey === undefined) {
      const migratedSettings = { ...storedSettings };
      delete migratedSettings.geminiApiKey;
      await this.storage.set({
        [this.SETTINGS_KEY]: migratedSettings,
        [this.GEMINI_API_KEY_KEY]: legacyKey
      });
    }
    if (!settings.groupingMode) {
      settings.groupingMode = settings.useSubcategories === false ? 'flat' : 'hybrid';
    }
    if (typeof settings.hybridThreshold !== 'number' || isNaN(settings.hybridThreshold)) {
      settings.hybridThreshold = 10;
    }
    if (settings.geminiModel === 'gemini-2.5-flash') {
      settings.geminiModel = DEFAULT_SETTINGS.geminiModel;
    }
    return settings;
  }

  /**
   * Save user settings
   */
  async saveSettings(settings) {
    if (!this.storage) return;
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    if (settings.groupingMode !== undefined && settings.useSubcategories === undefined) {
      updated.useSubcategories = settings.groupingMode !== 'flat';
    }
    const apiKey = settings.geminiApiKey !== undefined
      ? String(settings.geminiApiKey || '').trim()
      : current.geminiApiKey || '';
    const storedSettings = { ...updated };
    delete storedSettings.geminiApiKey;
    await this.storage.set({
      [this.SETTINGS_KEY]: storedSettings,
      [this.GEMINI_API_KEY_KEY]: apiKey
    });
    return { ...updated, geminiApiKey: apiKey };
  }

  /**
   * Get Gemini AI configuration
   */
  async getGeminiConfig() {
    const settings = await this.getSettings();
    return {
      enabled: Boolean(settings.geminiEnabled),
      apiKey: settings.geminiApiKey || '',
      model: settings.geminiModel || DEFAULT_SETTINGS.geminiModel
    };
  }

  /**
   * Save Gemini AI configuration
   */
  async saveGeminiConfig(config) {
    const update = {};
    if (config.enabled !== undefined) update.geminiEnabled = Boolean(config.enabled);
    if (config.apiKey !== undefined) update.geminiApiKey = String(config.apiKey).trim();
    if (config.model !== undefined) update.geminiModel = String(config.model).trim();
    return this.saveSettings(update);
  }

  async forgetGeminiApiKey() {
    return this.saveSettings({
      geminiApiKey: '',
      geminiEnabled: false,
      geminiConsentAccepted: false
    });
  }

  /**
   * Get active categories (default + custom)
   */
  async getCategories() {
    if (!this.storage) return DEFAULT_CATEGORIES;
    const result = await this.storage.get(this.CUSTOM_CATEGORIES_KEY);
    const custom = result[this.CUSTOM_CATEGORIES_KEY] || [];
    return [...DEFAULT_CATEGORIES, ...custom];
  }

  /**
   * Save custom user categories
   */
  async saveCustomCategories(categories) {
    if (!this.storage) return;
    await this.storage.set({ [this.CUSTOM_CATEGORIES_KEY]: categories });
  }

  /**
   * Get learned adaptive rules
   * @returns {Promise<Array>} Array of learned rule objects
   */
  async getLearnedRules() {
    if (!this.storage) return [];
    const result = await this.storage.get(this.LEARNED_RULES_KEY);
    return result[this.LEARNED_RULES_KEY] || [];
  }

  /**
   * Save or update an adaptive learned rule
   * @param {string} pattern - Domain (e.g. 'build.nvidia.com') or keyword phrase
   * @param {string|Array<string>} targetFolder - Proposed category or path array
   * @param {string} type - 'domain' or 'keyword'
   */
  async saveLearnedRule(pattern, targetFolder, type = 'domain') {
    if (!this.storage || !pattern || !targetFolder) return;
    const cleanPattern = type === 'url' ? normalizeBookmarkUrl(pattern) : type === 'keyword'
      ? String(pattern).toLowerCase().trim()
      : String(pattern).toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!cleanPattern) return;

    const targetPath = Array.isArray(targetFolder)
      ? targetFolder
      : String(targetFolder).split(' / ').map(s => s.trim()).filter(Boolean);
    const targetCategory = targetPath[0] || 'Uncategorized (Needs Review)';

    const existing = await this.getLearnedRules();
    // Filter out existing rule for the same pattern
    const filtered = existing.filter(r => type === 'url'
      ? !(r.type === 'url' && normalizeBookmarkUrl(r.pattern) === cleanPattern)
      : r.pattern.toLowerCase() !== cleanPattern.toLowerCase());

    const newRule = {
      pattern: cleanPattern,
      type,
      targetCategory,
      targetFolder: targetPath.join(' / '),
      targetPath,
      updatedAt: Date.now()
    };

    // Prepend so latest learned preference takes highest priority
    const updated = [newRule, ...filtered];
    await this.storage.set({ [this.LEARNED_RULES_KEY]: updated });
    return newRule;
  }

  /**
   * Remove a specific learned rule by pattern
   */
  async removeLearnedRule(pattern) {
    if (!this.storage || !pattern) return;
    const cleanPattern = String(pattern).toLowerCase().trim();
    const existing = await this.getLearnedRules();
    const filtered = existing.filter(r => r.type === 'url'
      ? normalizeBookmarkUrl(r.pattern) !== normalizeBookmarkUrl(pattern)
      : r.pattern.toLowerCase() !== cleanPattern);
    await this.storage.set({ [this.LEARNED_RULES_KEY]: filtered });
  }

  /**
   * Clear all learned rules
   */
  async clearLearnedRules() {
    if (!this.storage) return;
    await this.storage.set({ [this.LEARNED_RULES_KEY]: [] });
  }

  /**
   * Reset all settings, custom categories, and learned rules to defaults
   */
  async resetToDefaults() {
    if (!this.storage) return;
    const storedDefaults = { ...DEFAULT_SETTINGS };
    delete storedDefaults.geminiApiKey;
    await this.storage.set({
      [this.SETTINGS_KEY]: storedDefaults,
      [this.GEMINI_API_KEY_KEY]: '',
      [this.CUSTOM_CATEGORIES_KEY]: [],
      [this.LEARNED_RULES_KEY]: []
    });
  }
}
