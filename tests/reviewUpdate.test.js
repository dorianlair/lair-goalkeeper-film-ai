import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewUpdateAssignments } from '../src/reviewUpdate.js';

test('deduplicates assignments for the same column', () => {
  const patch = {
    reportKey: 'report-1',
    reportPath: 'report-2',
    focusAreas: ['a'],
  };

  const { assignments, values } = buildReviewUpdateAssignments(patch);

  assert.deepEqual(assignments, [
    'report_key = $1',
    'focus_areas = $2::jsonb',
  ]);
  assert.deepEqual(values, ['report-2', JSON.stringify(['a'])]);
});
