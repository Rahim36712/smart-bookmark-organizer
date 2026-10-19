import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GeminiService, FALLBACK_MODELS } from '../core/gemini-service.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const bookmarks = [{ id: '1', title: 'JavaScript guide', url: 'https://example.com' }];
const success = () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '[{"id":"1","category":"Programming"}]' }] } }] }) });
const failure = (status, message = 'Service error', retry = null) => ({
  ok: false, status, headers: { get: () => retry }, json: async () => ({ error: { message } })
});

test('quota failure rotates models and honors Retry-After', async () => {
  const service = new GeminiService('test-key');
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? failure(429, 'Quota exceeded', '120') : success();
  const before = Date.now();
  assert.equal((await service.categorizeBatch(bookmarks)).length, 1);
  assert.equal(calls, 2);
  assert.equal(service.model, FALLBACK_MODELS[1]);
  assert.ok(service.modelHealth.get(FALLBACK_MODELS[0]).until >= before + 120000);
});

test('server, network, empty and malformed responses rotate to the next model', async () => {
  for (const bad of [
    () => failure(500), () => failure(503), () => failure(504),
    () => { throw new TypeError('Failed to fetch'); },
    () => ({ ok: true, json: async () => ({ candidates: [] }) }),
    () => ({ ok: true, json: async () => { throw new Error('invalid JSON'); } }),
    () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'not categories' }] } }] }) })
  ]) {
    const service = new GeminiService('test-key');
    let calls = 0;
    globalThis.fetch = async () => ++calls === 1 ? bad() : success();
    assert.equal((await service.categorizeBatch(bookmarks)).length, 1);
    assert.equal(calls, 2);
  }
});

test('timeouts abort both hung connections and hung response bodies', async () => {
  for (const bodyHangs of [false, true]) {
    const service = new GeminiService('test-key');
    service.requestTimeoutMs = 10;
    let calls = 0;
    let signal;
    globalThis.fetch = async (_, options) => {
      if (++calls > 1) return success();
      signal = options.signal;
      const pending = new Promise(() => {});
      return bodyHangs ? { ok: true, json: () => pending } : pending;
    };
    assert.equal((await service.categorizeBatch(bookmarks)).length, 1);
    assert.equal(signal.aborted, true);
    assert.equal(calls, 2);
  }
});

test('invalid credentials and invalid requests fail fast without leaking keys', async () => {
  for (const status of [400, 401, 403]) {
    const service = new GeminiService('secret-test-key');
    let calls = 0;
    globalThis.fetch = async () => { calls++; return failure(status, 'Invalid request secret-test-key'); };
    await assert.rejects(service.categorizeBatch(bookmarks), error => error.fatal && !error.message.includes('secret-test-key'));
    assert.equal(calls, 1);
  }
});

test('safety blocks stop model rotation', async () => {
  const service = new GeminiService('test-key');
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }) }; };
  await assert.rejects(service.categorizeBatch(bookmarks), error => error.fatal);
  assert.equal(calls, 1);
});

test('exhausted models cool down, recover, and reset health for a different key', async () => {
  const service = new GeminiService('test-key');
  let calls = 0;
  globalThis.fetch = async () => { calls++; return failure(429); };
  await assert.rejects(service.categorizeBatch(bookmarks), error => error.exhausted);
  assert.equal(calls, 6);
  await assert.rejects(service.categorizeBatch(bookmarks), error => error.exhausted);
  assert.equal(calls, 6);
  service.modelHealth.get(service.model).until = 0;
  globalThis.fetch = async () => { calls++; return success(); };
  await service.categorizeBatch(bookmarks);
  assert.equal(calls, 7);
  service.setApiKey('different-key');
  await service.testConnection();
  assert.equal(service.modelHealth.size, 0);
});

test('partial batches retain successful classifications and report local remainder', async () => {
  const service = new GeminiService('test-key');
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? success() : failure(429);
  const progress = [];
  const result = await service.categorizeAll([
    ...bookmarks,
    { id: '2', title: 'Second', url: 'https://example.com/second' },
    { id: '3', title: 'Third', url: 'https://example.com/third' }
  ], [], { batchSize: 1 }, p => progress.push(p));
  assert.deepEqual(result.map(item => item.id), ['1']);
  assert.equal(service.lastRunReport.aiCount, 1);
  assert.equal(service.lastRunReport.localCount, 2);
  assert.equal(progress.at(-1).percent, 100);
  assert.equal(calls, 7);
  assert.equal(service.enabled, true);
});
