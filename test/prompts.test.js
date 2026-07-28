import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGoalkeeperPrompt } from '../src/prompts.js';

test('buildGoalkeeperPrompt includes key context and json contract', () => {
  const prompt = buildGoalkeeperPrompt({
    athleteName: 'Maya',
    teamName: 'LAIR U17',
    opponent: 'Valley SC',
    sessionGoal: 'Showcase prep',
    coachNotes: 'Watch distribution under pressure',
    focusAreas: ['distribution', 'decision-making'],
  });

  assert.match(prompt, /Athlete: Maya/);
  assert.match(prompt, /Team: LAIR U17/);
  assert.match(prompt, /Return only valid JSON/);
  assert.match(prompt, /"keyMoments"/);
  assert.match(prompt, /No markdown, no code fences/);
});
