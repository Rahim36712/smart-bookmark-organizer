import test from 'node:test';
import assert from 'node:assert';
import { GeminiService, prepareBookmarkForAi } from '../core/gemini-service.js';
import { BookmarkTreeManager } from '../core/bookmark-tree.js';
import { BookmarkCategorizer } from '../core/categorizer.js';
import { SettingsManager, DEFAULT_SETTINGS } from '../core/storage.js';

test('GeminiService - Configuration and Prompt Building', async (t) => {
  await t.test('removes private URL details before AI requests', () => {
    const prepared = prepareBookmarkForAi({ id: '1', title: 'Search', url: 'https://example.com/path?q=private#section' }, {
      geminiStripQueryParams: true,
      geminiExcludePrivateUrls: true
    });
    assert.strictEqual(prepared.url, 'https://example.com/path');
    assert.strictEqual(prepareBookmarkForAi({ id: '2', title: 'Router', url: 'http://192.168.1.1/admin' }, {}), null);
    assert.strictEqual(prepareBookmarkForAi({ id: '3', title: 'Local', url: 'file:///C:/secret.txt' }, {}), null);
  });

  await t.test('isConfigured accurately checks api key presence', () => {
    const service = new GeminiService();
    assert.strictEqual(service.isConfigured(), false);

    service.setApiKey('');
    assert.strictEqual(service.isConfigured(), false);

    service.setApiKey('   ');
    assert.strictEqual(service.isConfigured(), false);

    service.setApiKey('AIzaSyD_short');
    assert.strictEqual(service.isConfigured(), true);
  });

  await t.test('buildPrompt includes bookmark titles, URLs and category suggestions', () => {
    const service = new GeminiService('AIzaSyFakeKey');
    const bookmarks = [
      { id: 'b1', title: 'React Documentation', url: 'https://react.dev' },
      { id: 'b2', title: 'DAAD Scholarship Germany', url: 'https://www.daad.de' }
    ];
    const categories = [
      { name: 'Programming' },
      { name: 'Germany' }
    ];

    const prompt = service.buildPrompt(bookmarks, categories);
    assert.ok(prompt.includes('gemini-3.6-flash') === false); // prompt itself shouldn't require model name
    assert.ok(prompt.includes('Programming'), 'Prompt includes Programming category');
    assert.ok(prompt.includes('Germany'), 'Prompt includes Germany category');
    assert.ok(prompt.includes('React Documentation'), 'Prompt includes bookmark title');
    assert.ok(prompt.includes('https://react.dev'), 'Prompt includes bookmark URL');
    assert.ok(prompt.includes('"id": "b1"'), 'Prompt includes bookmark ID');
  });
});

test('GeminiService - Mocked API Requests and Responses', async (t) => {
  const originalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  await t.test('testConnection succeeds with valid 200 response', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url, opts) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"status":"OK"}' }] } }]
        })
      };
    };

    const service = new GeminiService('AIzaSyValidKey123');
    const result = await service.testConnection();
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.model, 'gemini-3.6-flash');
    assert.ok(capturedUrl.includes('gemini-3.6-flash'), 'Endpoint URL uses gemini-3.6-flash model');
    assert.ok(capturedUrl.includes('key=AIzaSyValidKey123'), 'Endpoint URL contains API key');
  });

  await t.test('testConnection throws descriptive error on 400/403 failure', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: { message: 'API key not valid. Please pass a valid API key.' }
      })
    });

    const service = new GeminiService('AIzaSyBadKey');
    await assert.rejects(
      async () => service.testConnection(),
      /API key not valid/i
    );
  });

  await t.test('categorizeBatch parses structured JSON response correctly', async () => {
    const mockGeminiOutput = [
      {
        id: '101',
        category: 'Programming',
        subcategory: 'Web Development',
        icon: '💻',
        reason: 'React UI framework guide',
        tags: ['React', 'JavaScript', 'Frontend']
      },
      {
        id: '102',
        category: 'Germany',
        subcategory: 'Study & Visa',
        icon: '🇩🇪',
        reason: 'German DAAD scholarship portal',
        tags: ['Germany', 'Scholarship', 'Study']
      }
    ];

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(mockGeminiOutput) }]
            }
          }
        ]
      })
    });

    const service = new GeminiService('AIzaSyTestKey');
    const result = await service.categorizeBatch([
      { id: '101', title: 'React Docs', url: 'https://react.dev' },
      { id: '102', title: 'DAAD Germany', url: 'https://daad.de' }
    ]);

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, '101');
    assert.strictEqual(result[0].category, 'Programming');
    assert.strictEqual(result[0].subcategory, 'Web Development');
    assert.strictEqual(result[1].id, '102');
    assert.strictEqual(result[1].category, 'Germany');
  });

  await t.test('categorizeBatch strips markdown backticks if returned by model', async () => {
    const mockOutput = [
      { id: '103', category: 'AI & Technology', subcategory: 'LLMs', icon: '🤖', reason: 'AI guide', tags: ['AI'] }
    ];

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '```json\n' + JSON.stringify(mockOutput) + '\n```' }]
            }
          }
        ]
      })
    });

    const service = new GeminiService('AIzaSyTestKey');
    const result = await service.categorizeBatch([
      { id: '103', title: 'Gemini AI', url: 'https://ai.google.dev' }
    ]);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].category, 'AI & Technology');
  });

  await t.test('categorizeAll batches items and fires onProgress callback', async () => {
    let callCount = 0;
    globalThis.fetch = async (url, opts) => {
      callCount++;
      const body = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify([{ id: 'b' + callCount, category: 'Tech', icon: '💻' }]) }]
              }
            }
          ]
        })
      };
    };

    const progressReports = [];
    const service = new GeminiService('AIzaSyTestKey');
    const bookmarks = [
      { id: 'b1', title: 'Site 1', url: 'https://site1.com' },
      { id: 'b2', title: 'Site 2', url: 'https://site2.com' },
      { id: 'b3', title: 'Site 3', url: 'https://site3.com' }
    ];

    const results = await service.categorizeAll(bookmarks, [], { batchSize: 2 }, (p) => {
      progressReports.push({ ...p });
    });

    assert.strictEqual(callCount, 2, 'Split 3 items into 2 batches of size 2');
    assert.strictEqual(results.length, 2);
    assert.ok(progressReports.length >= 2, 'Fired onProgress for each batch');
    assert.strictEqual(progressReports[progressReports.length - 1].percent, 100);
  });
});

test('BookmarkTreeManager.buildProposedPlanWithAi - Integration & Fallbacks', async (t) => {
  const treeManager = new BookmarkTreeManager();
  const categorizer = new BookmarkCategorizer();

  const bookmarks = [
    { id: 'bm1', title: 'React Documentation', url: 'https://react.dev', parentId: '1', index: 0 },
    { id: 'bm2', title: 'Uni-Assist Germany Portal', url: 'https://my.uni-assist.de', parentId: '1', index: 1 }
  ];

  await t.test('uses Gemini AI classifications when configured and successful', async () => {
    const mockGeminiService = {
      isConfigured: () => true,
      categorizeAll: async () => [
        {
          id: 'bm1',
          category: 'Software Engineering',
          subcategory: 'Frontend UI',
          icon: '⚛️',
          reason: 'Semantic match for React docs',
          tags: ['React', 'Web']
        }
        // bm2 intentionally omitted to test hybrid fallback for missing items
      ]
    };

    const plan = await treeManager.buildProposedPlanWithAi(
      bookmarks,
      categorizer,
      mockGeminiService,
      { useSubcategories: true }
    );

    assert.strictEqual(plan.length, 2);

    // bm1 classified by Gemini AI
    const p1 = plan.find(p => p.id === 'bm1');
    assert.ok(p1, 'Plan includes bm1');
    assert.strictEqual(p1.isAiGenerated, true);
    assert.strictEqual(p1.proposedCategoryName, 'Software Engineering');
    assert.strictEqual(p1.proposedSubcategoryName, 'Frontend UI');
    assert.strictEqual(p1.proposedFolderDisplay, 'Software Engineering / Frontend UI');
    assert.strictEqual(p1.icon, '⚛️');
    assert.ok(p1.matchReason.includes('Gemini AI'));
    assert.strictEqual(p1.selected, true);

    // bm2 fell back seamlessly to local categorizer (Germany)
    const p2 = plan.find(p => p.id === 'bm2');
    assert.ok(p2, 'Plan includes bm2');
    assert.strictEqual(p2.isAiGenerated, false);
    assert.strictEqual(p2.proposedCategoryId, 'germany');
    assert.strictEqual(p2.proposedCategoryName, 'Germany');
  });

  await t.test('flattens path when useSubcategories is false in AI mode', async () => {
    const mockGeminiService = {
      isConfigured: () => true,
      categorizeAll: async () => [
        {
          id: 'bm1',
          category: 'Programming',
          subcategory: 'React',
          icon: '💻',
          reason: 'Code'
        }
      ]
    };

    const plan = await treeManager.buildProposedPlanWithAi(
      [bookmarks[0]],
      categorizer,
      mockGeminiService,
      { useSubcategories: false }
    );

    assert.strictEqual(plan[0].proposedCategoryName, 'Programming');
    assert.strictEqual(plan[0].proposedSubcategoryName, null);
    assert.strictEqual(plan[0].proposedFolderDisplay, 'Programming');
  });

  await t.test('falls back 100% locally when GeminiService is null or unconfigured', async () => {
    const plan = await treeManager.buildProposedPlanWithAi(
      bookmarks,
      categorizer,
      null // no AI service
    );

    assert.strictEqual(plan.length, 2);
    for (const item of plan) {
      assert.strictEqual(item.isAiGenerated, false);
    }
    // Local categorizer correctly identified Germany for bm2
    const germanyItem = plan.find(p => p.id === 'bm2');
    assert.strictEqual(germanyItem.proposedCategoryId, 'germany');
  });

  await t.test('falls back gracefully to local categorization if Gemini throws an error', async () => {
    const failingService = {
      isConfigured: () => true,
      categorizeAll: async () => {
        throw new Error('503 Service Unavailable: Gemini overloaded');
      }
    };

    // Should NOT throw! Must catch and fall back seamlessly to local engine
    const plan = await treeManager.buildProposedPlanWithAi(
      bookmarks,
      categorizer,
      failingService
    );

    assert.strictEqual(plan.length, 2);
    assert.strictEqual(plan[0].isAiGenerated, false);
    assert.strictEqual(plan[1].isAiGenerated, false);
    assert.strictEqual(plan[1].proposedCategoryId, 'germany');
  });
});

test('Storage & UI Mode Configuration', async (t) => {
  await t.test('DEFAULT_SETTINGS contains simple uiMode and gemini configs', () => {
    assert.strictEqual(DEFAULT_SETTINGS.uiMode, 'simple');
    assert.strictEqual(DEFAULT_SETTINGS.geminiEnabled, false);
    assert.strictEqual(DEFAULT_SETTINGS.geminiApiKey, '');
    assert.strictEqual(DEFAULT_SETTINGS.geminiModel, 'gemini-3.6-flash');
  });

  await t.test('SettingsManager saves and retrieves Gemini configuration', async () => {
    const memoryStorage = {
      data: {},
      async get(key) {
        return { [key]: this.data[key] };
      },
      async set(items) {
        Object.assign(this.data, items);
      }
    };

    const manager = new SettingsManager(memoryStorage);

    // Initial default
    const initialConfig = await manager.getGeminiConfig();
    assert.strictEqual(initialConfig.enabled, false);
    assert.strictEqual(initialConfig.apiKey, '');
    assert.strictEqual(initialConfig.model, 'gemini-3.6-flash');

    // Save new configuration
    await manager.saveGeminiConfig({
      enabled: true,
      apiKey: 'AIzaSyTestStorageKey',
      model: 'gemini-3.6-flash'
    });

    const updatedConfig = await manager.getGeminiConfig();
    assert.strictEqual(updatedConfig.enabled, true);
    assert.strictEqual(updatedConfig.apiKey, 'AIzaSyTestStorageKey');
    assert.strictEqual(updatedConfig.model, 'gemini-3.6-flash');

    // Check uiMode persistence
    await manager.saveSettings({ uiMode: 'advanced' });
    const settings = await manager.getSettings();
    assert.strictEqual(settings.uiMode, 'advanced');
    assert.strictEqual(settings.geminiApiKey, 'AIzaSyTestStorageKey');
    assert.strictEqual(memoryStorage.data.organizer_settings.geminiApiKey, undefined);
    assert.strictEqual(memoryStorage.data.organizer_gemini_api_key, 'AIzaSyTestStorageKey');

    await manager.forgetGeminiApiKey();
    const forgotten = await manager.getGeminiConfig();
    assert.strictEqual(forgotten.apiKey, '');
    assert.strictEqual(forgotten.enabled, false);
  });
});

test('Dashboard UI Mode Toggling and Resolution', async (t) => {
  const { applyUiMode, resolveDestinationSettings } = await import('../ui/dashboard.js');

  await t.test('applyUiMode toggles display states between simple and advanced modes', () => {
    assert.doesNotThrow(() => {
      applyUiMode('simple');
      applyUiMode('advanced');
      applyUiMode('unknown');
    });
  });

  await t.test('resolveDestinationSettings works seamlessly for both simple and advanced modes', () => {
    const resDedicated = resolveDestinationSettings('dedicated');
    assert.strictEqual(resDedicated.destTitle, 'Organized Bookmarks');
    assert.strictEqual(resDedicated.targetRootParentId, '1');

    const resOther = resolveDestinationSettings('dedicated_other');
    assert.strictEqual(resOther.destTitle, 'Organized Bookmarks');
    assert.strictEqual(resOther.targetRootParentId, '2');

    const resBar = resolveDestinationSettings('bar');
    assert.strictEqual(resBar.destTitle, null);
    assert.strictEqual(resBar.targetRootParentId, '1');
  });
});

test('GeminiService - Advanced Output Formats & Resilient Parsing', async (t) => {
  const originalFetch = globalThis.fetch;
  t.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  await t.test('parses markdown code fence without json keyword and leading/trailing newlines', async () => {
    const mockOutput = [
      { id: '1', category: 'Programming', icon: '💻' }
    ];

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: `\n\n\`\`\`\n${JSON.stringify(mockOutput)}\n\`\`\`\n\n` }]
            }
          }
        ]
      })
    });

    const service = new GeminiService('AIzaSyTestKey');
    const result = await service.categorizeBatch([{ id: '1', title: 'Code', url: 'https://code.dev' }]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].category, 'Programming');
  });

  await t.test('parses wrapped object response with categories, items or results array', async () => {
    const wrappedOutputs = [
      { categories: [{ id: '1', category: 'Tech', icon: '💻' }] },
      { items: [{ id: '1', category: 'Tech', icon: '💻' }] },
      { results: [{ id: '1', category: 'Tech', icon: '💻' }] },
      { data: [{ id: '1', category: 'Tech', icon: '💻' }] }
    ];

    for (const wrapped of wrappedOutputs) {
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(wrapped) }]
              }
            }
          ]
        })
      });

      const service = new GeminiService('AIzaSyTestKey');
      const result = await service.categorizeBatch([{ id: '1', title: 'Site', url: 'https://site.com' }]);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].category, 'Tech');
    }
  });

  await t.test('extracts JSON array when model includes conversational text before and after', async () => {
    const jsonStr = JSON.stringify([{ id: '1', category: 'Finance', icon: '💰' }]);
    const rawText = `Here is your categorized bookmark data:\n\n${jsonStr}\n\nHope this helps!`;

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: rawText }]
            }
          }
        ]
      })
    });

    const service = new GeminiService('AIzaSyTestKey');
    const result = await service.categorizeBatch([{ id: '1', title: 'Bank', url: 'https://bank.com' }]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].category, 'Finance');
  });

  await t.test('strips enclosing quotes from API keys and models/ prefix from model name', () => {
    const service1 = new GeminiService('"AIzaSyQuotedKey"', 'models/gemini-3.6-flash');
    assert.strictEqual(service1.apiKey, 'AIzaSyQuotedKey');
    assert.strictEqual(service1.model, 'gemini-3.6-flash');

    const service2 = new GeminiService("'AIzaSySingleQuoted'", 'gemini-3.6-flash');
    assert.strictEqual(service2.apiKey, 'AIzaSySingleQuoted');
  });

  await t.test('setEnabled controls isConfigured status', () => {
    const service = new GeminiService('AIzaSyValidKey', 'gemini-3.6-flash', true);
    assert.strictEqual(service.isConfigured(), true);

    service.setEnabled(false);
    assert.strictEqual(service.isConfigured(), false);

    service.setEnabled(true);
    assert.strictEqual(service.isConfigured(), true);
  });

  await t.test('categorizeAll aborts subsequent batches immediately upon invalid API key or 401/403', async () => {
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts++;
      return {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: { message: 'API key not valid. Please pass a valid API key.' }
        })
      };
    };

    const service = new GeminiService('AIzaSyBadKey');
    const bookmarks = [
      { id: '1', title: 'B1', url: 'https://1.com' },
      { id: '2', title: 'B2', url: 'https://2.com' },
      { id: '3', title: 'B3', url: 'https://3.com' },
      { id: '4', title: 'B4', url: 'https://4.com' }
    ];

    // Batch size 1 would normally make 4 attempts, but must abort after 1st attempt
    const results = await service.categorizeAll(bookmarks, [], { batchSize: 1 });
    assert.strictEqual(attempts, 1, 'Aborted after first batch failed with invalid API key');
    assert.strictEqual(results.length, 0);
  });

  await t.test('categorizeAll supports passing callback directly as 3rd parameter', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: JSON.stringify([{ id: '1', category: 'Tech' }]) }] } }
        ]
      })
    });

    const progressReports = [];
    const service = new GeminiService('AIzaSyKey');
    await service.categorizeAll([{ id: '1', title: 'A', url: 'https://a.com' }], [], (prog) => {
      progressReports.push(prog);
    });

    assert.strictEqual(progressReports.length, 1);
    assert.strictEqual(progressReports[0].percent, 100);
  });

  await t.test('testConnection automatically falls back when initial model is deprecated (e.g. 2.5-flash -> 3.6-flash)', async () => {
    const attemptedUrls = [];
    globalThis.fetch = async (url) => {
      attemptedUrls.push(url);
      if (url.includes('gemini-2.5-flash')) {
        return {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({
            error: {
              message: 'This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.6-flash for the latest features and improvements.'
            }
          })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"status":"OK"}' }] } }]
        })
      };
    };

    const service = new GeminiService('AIzaSyFallbackKey', 'gemini-2.5-flash');
    const result = await service.testConnection();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.model, 'gemini-3.6-flash');
    assert.strictEqual(service.model, 'gemini-3.6-flash');
    assert.strictEqual(attemptedUrls.length, 2);
    assert.ok(attemptedUrls[0].includes('gemini-2.5-flash'));
    assert.ok(attemptedUrls[1].includes('gemini-3.6-flash'));
  });

  await t.test('testConnection falls back on 404 Not Found error', async () => {
    const attemptedUrls = [];
    globalThis.fetch = async (url) => {
      attemptedUrls.push(url);
      if (url.includes('gemini-3.6-flash')) {
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({
            error: { message: 'models/gemini-3.6-flash is not found for API version v1beta' }
          })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"status":"OK"}' }] } }]
        })
      };
    };

    const service = new GeminiService('AIzaSyFallbackKey', 'gemini-3.6-flash');
    const result = await service.testConnection();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.model, 'gemini-3.8-flash');
    assert.strictEqual(service.model, 'gemini-3.8-flash');
    assert.ok(attemptedUrls[0].includes('gemini-3.6-flash'));
    assert.ok(attemptedUrls[1].includes('gemini-3.8-flash'));
  });

  await t.test('testConnection throws when all fallback models fail with deprecation', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({
        error: { message: 'Model is not found or deprecated.' }
      })
    });

    const service = new GeminiService('AIzaSyFallbackKey', 'gemini-3.6-flash');
    await assert.rejects(
      async () => service.testConnection(),
      /All fallback models failed: Model is not found or deprecated/i
    );
  });

  await t.test('categorizeBatch automatically switches models on deprecation error', async () => {
    const triedModels = [];
    const mockOutput = [
      { id: '1', category: 'Programming', subcategory: 'Web', icon: '💻', reason: 'Code', tags: ['code'] }
    ];

    globalThis.fetch = async (url) => {
      if (url.includes('gemini-2.5-flash')) {
        triedModels.push('gemini-2.5-flash');
        return {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({
            error: { message: 'This model models/gemini-2.5-flash is no longer available to new users.' }
          })
        };
      }
      triedModels.push('gemini-3.6-flash');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockOutput) }] } }]
        })
      };
    };

    const service = new GeminiService('AIzaSyKey', 'gemini-2.5-flash');
    const result = await service.categorizeBatch([{ id: '1', title: 'Test', url: 'https://test.com' }]);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].category, 'Programming');
    assert.strictEqual(service.model, 'gemini-3.6-flash');
    assert.deepStrictEqual(triedModels, ['gemini-2.5-flash', 'gemini-3.6-flash']);
  });

  await t.test('categorizeAll preserves switched model across subsequent batches', async () => {
    const attemptedModels = [];
    globalThis.fetch = async (url) => {
      if (url.includes('gemini-2.5-flash')) {
        attemptedModels.push('gemini-2.5-flash');
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ error: { message: 'Model not found' } })
        };
      }
      if (url.includes('gemini-3.6-flash')) {
        attemptedModels.push('gemini-3.6-flash');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: JSON.stringify([{ id: '1', category: 'Web' }]) }] } }]
          })
        };
      }
    };

    const service = new GeminiService('AIzaSyKey', 'gemini-2.5-flash');
    const bookmarks = [
      { id: '1', title: 'A', url: 'https://a.com' },
      { id: '2', title: 'B', url: 'https://b.com' }
    ];

    const results = await service.categorizeAll(bookmarks, [], { batchSize: 1 });
    assert.strictEqual(results.length, 2);
    // First batch tries gemini-2.5-flash, fails, then succeeds on gemini-3.6-flash.
    // Second batch should directly use gemini-3.6-flash without re-trying gemini-2.5-flash.
    assert.deepStrictEqual(attemptedModels, ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-3.6-flash']);
  });

  await t.test('getFallbackChain constructs correct order and FALLBACK_MODELS is valid', () => {
    const service = new GeminiService();
    const defaultChain = service.getFallbackChain();
    assert.deepStrictEqual(defaultChain, [
      'gemini-3.6-flash',
      'gemini-3.8-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite'
    ]);

    const customChain = service.getFallbackChain('gemini-3.8-flash');
    assert.deepStrictEqual(customChain, [
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite'
    ]);
  });

  await t.test('setModel correctly handles auto and models/ prefix', () => {
    const service = new GeminiService();
    service.setModel('auto');
    assert.strictEqual(service.model, 'gemini-3.6-flash');

    service.setModel('models/gemini-3.7-flash');
    assert.strictEqual(service.model, 'gemini-3.7-flash');

    service.setModel('gemini-3.5-flash-lite');
    assert.strictEqual(service.model, 'gemini-3.5-flash-lite');
  });

  await t.test('isModelUnavailableError accurately identifies deprecation and availability errors', () => {
    const service = new GeminiService();
    // 404 status
    assert.strictEqual(service.isModelUnavailableError('Not Found', 404), true);
    assert.strictEqual(service.isModelUnavailableError({ status: 404 }), true);
    assert.strictEqual(service.isModelUnavailableError(new Error('HTTP 404: Not Found')), true);

    // Phrases
    assert.strictEqual(service.isModelUnavailableError('This model is not available'), true);
    assert.strictEqual(service.isModelUnavailableError('Model is unavailable'), true);
    assert.strictEqual(service.isModelUnavailableError('This model models/gemini-2.5-flash is no longer available to new users.'), true);
    assert.strictEqual(service.isModelUnavailableError('Model has been retired'), true);
    assert.strictEqual(service.isModelUnavailableError('Model is deprecated'), true);
    assert.strictEqual(service.isModelUnavailableError('models/gemini-3.6-flash is not found for API version v1beta'), true);
    assert.strictEqual(service.isModelUnavailableError('Invalid model name', 400), true);

    // Non-model errors should NOT trigger fallback
    assert.strictEqual(service.isModelUnavailableError('API key not valid. Please pass a valid API key.', 400), false);
    assert.strictEqual(service.isModelUnavailableError('Unauthorized', 401), false);
    assert.strictEqual(service.isModelUnavailableError('Permission denied', 403), false);
    assert.strictEqual(service.isModelUnavailableError('Internal Server Error', 500), false);
    assert.strictEqual(service.isModelUnavailableError('Failed to fetch', 0), false);
  });

  await t.test('categorizeAll aborts remaining batches when all fallback models fail', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: { message: 'Model not found' } })
      };
    };

    const service = new GeminiService('AIzaSyKey', 'gemini-3.6-flash');
    const bookmarks = [
      { id: '1', title: 'A', url: 'https://a.com' },
      { id: '2', title: 'B', url: 'https://b.com' },
      { id: '3', title: 'C', url: 'https://c.com' }
    ];

    // With 3 bookmarks and batchSize: 1, there are 3 batches.
    // Batch 1 tries all 6 fallback models and fails with "All fallback models failed".
    // categorizeAll must abort immediately without executing batch 2 and batch 3.
    const results = await service.categorizeAll(bookmarks, [], { batchSize: 1 });
    assert.strictEqual(results.length, 0);
    assert.strictEqual(callCount, GeminiService.FALLBACK_MODELS.length, 'Tried every fallback model on batch 1 and then aborted immediately');
  });

  await t.test('SettingsManager migrates legacy gemini-2.5-flash to default model', async () => {
    const memoryStorage = {
      data: {
        organizer_settings: {
          geminiModel: 'gemini-2.5-flash',
          geminiEnabled: true,
          geminiApiKey: 'AIzaSyExistingKey'
        }
      },
      async get(key) {
        return { [key]: this.data[key] };
      },
      async set(items) {
        Object.assign(this.data, items);
      }
    };

    const manager = new SettingsManager(memoryStorage);
    const settings = await manager.getSettings();
    assert.strictEqual(settings.geminiModel, 'gemini-3.6-flash', 'Migrated gemini-2.5-flash to gemini-3.6-flash in getSettings');

    const config = await manager.getGeminiConfig();
    assert.strictEqual(config.model, 'gemini-3.6-flash', 'Migrated in getGeminiConfig');
  });
});

test('BookmarkTreeManager and Dashboard Utilities - Edge Cases', async (t) => {
  const { resolveDestinationSettings, getDestinationLocationLabel, safeBookmarkHref } = await import('../ui/dashboard-utils.js');
  const treeManager = new BookmarkTreeManager();

  await t.test('ensureFolderHierarchy handles undefined and non-array pathSegments safely', async () => {
    const mockBookmarksApi = {
      getChildren: async () => [],
      create: async (item) => ({ id: 'new_' + item.title, ...item })
    };
    const mgr = new BookmarkTreeManager(mockBookmarksApi);

    const folderId1 = await mgr.ensureFolderHierarchy(null, '1');
    assert.strictEqual(folderId1, '1');

    const folderId2 = await mgr.ensureFolderHierarchy('SingleFolder', '1');
    assert.strictEqual(folderId2, 'new_SingleFolder');
  });

  await t.test('dashboard-utils exports match expected signatures and behavior', () => {
    const dedicated = resolveDestinationSettings('dedicated');
    assert.strictEqual(dedicated.destTitle, 'Organized Bookmarks');
    assert.strictEqual(dedicated.targetRootParentId, '1');

    const label1 = getDestinationLocationLabel('Organized Bookmarks', '1');
    assert.strictEqual(label1, 'Bookmarks Bar / Organized Bookmarks');

    const label2 = getDestinationLocationLabel(null, '2');
    assert.strictEqual(label2, 'Other Bookmarks Root');

    assert.strictEqual(safeBookmarkHref('https://example.com/page'), 'https://example.com/page');
    assert.strictEqual(safeBookmarkHref('ftp://files.example.com/readme.txt'), 'ftp://files.example.com/readme.txt');
    assert.strictEqual(safeBookmarkHref('javascript:alert(1)'), null);
    assert.strictEqual(safeBookmarkHref('data:text/html,unsafe'), null);
    assert.strictEqual(safeBookmarkHref('not a url'), null);
  });
});

