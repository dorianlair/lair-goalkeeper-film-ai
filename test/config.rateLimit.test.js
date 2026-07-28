import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfig } from '../src/config.js';

const originalEnv = { ...process.env };

test.after(() => {
  process.env = originalEnv;
});

test('getConfig exposes analyze endpoint rate-limit defaults and parses overrides', () => {
  process.env.GEMINI_API_KEY = 'test-key';
  delete process.env.ANALYZE_RATE_LIMIT_WINDOW_MS;
  delete process.env.ANALYZE_RATE_LIMIT_MAX_REQUESTS;

  const defaults = getConfig();
  assert.equal(defaults.analyzeRateLimitWindowMs, 10 * 60 * 1000);
  assert.equal(defaults.analyzeRateLimitMaxRequests, 20);

  process.env.ANALYZE_RATE_LIMIT_WINDOW_MS = '45000';
  process.env.ANALYZE_RATE_LIMIT_MAX_REQUESTS = '7';

  const overridden = getConfig();
  assert.equal(overridden.analyzeRateLimitWindowMs, 45000);
  assert.equal(overridden.analyzeRateLimitMaxRequests, 7);
});
