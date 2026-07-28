import test from 'node:test';
import assert from 'node:assert/strict';
import { buildParentReportHtml, buildParentReportModel } from '../public/modules/parent-report.js';

const sampleReport = {
  athleteName: 'Maya Johnson',
  teamName: 'LAIR U17',
  opponent: 'Valley SC',
  sessionGoal: 'Prepare for showcase selection',
  analyzedAt: '2026-07-27T17:15:00.000Z',
  summary: 'She showed good composure and made several useful reads.',
  overallAssessment: 'A solid performance with clear next steps.',
  strengths: ['Strong set position', 'Quick recovery after the first action'],
  improvements: ['Starts too deep on the first touch', 'Hesitates before coming forward'],
  keyMoments: [
    {
      timestamp: '12:30',
      description: 'She reads the danger early and gets organized quickly.',
      coachingNote: 'Coach-only note should not export.',
      confidence: 0.91,
    },
  ],
  trainingPlan: ['Set position and first step timing'],
  nextSteps: ['Keep working on closing space with control'],
  rawResponse: '{"coachOnly":"hidden"}',
};

test('buildParentReportModel hides coach-only details and stays positive', () => {
  const model = buildParentReportModel(sampleReport);

  assert.equal(model.athleteName, 'Maya Johnson');
  assert.equal(model.teamName, 'LAIR U17');
  assert.equal(model.keyMoments[0].description, 'She reads the danger early and gets organized quickly.');
  assert.match(model.growthAreas[0], /Keep building on/i);
  assert.equal(model.reviewNote.includes('coach-only notes'), true);
});

test('buildParentReportHtml omits coach-only fields', () => {
  const html = buildParentReportHtml(buildParentReportModel(sampleReport));

  assert.doesNotMatch(html, /Coach note:/i);
  assert.doesNotMatch(html, /Confidence:/i);
  assert.doesNotMatch(html, /rawResponse/i);
  assert.match(html, /Parent and player report/i);
  assert.match(html, /Coach-only details are intentionally hidden|parent and player version is intentionally cleaned up/i);
});