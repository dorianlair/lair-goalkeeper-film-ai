import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAnalysisText } from '../src/athletes.js';

test('summarizeAnalysisText parses strict JSON payloads', () => {
  const payload = JSON.stringify({
    summary: 'Strong command of box',
    overallAssessment: 'Promising distribution decisions',
  });

  const result = summarizeAnalysisText(payload);
  assert.equal(result.summary, 'Strong command of box');
  assert.equal(result.overallAssessment, 'Promising distribution decisions');
  assert.equal(typeof result.preview, 'string');
  assert.ok(result.preview.length > 0);
});

test('summarizeAnalysisText parses fenced JSON payloads', () => {
  const payload = [
    '```json',
    JSON.stringify({
      summary: 'Handled crosses consistently',
      overallAssessment: 'Good positioning under pressure',
    }),
    '```',
  ].join('\n');

  const result = summarizeAnalysisText(payload);
  assert.equal(result.summary, 'Handled crosses consistently');
  assert.equal(result.overallAssessment, 'Good positioning under pressure');
});

test('summarizeAnalysisText falls back safely on invalid payloads', () => {
  const result = summarizeAnalysisText('not-json');
  assert.deepEqual(result, {
    summary: '',
    overallAssessment: '',
    preview: 'not-json',
  });
});
