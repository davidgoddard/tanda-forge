import {test} from 'vitest';
import assert from 'node:assert/strict';
import {resolveBassGrouping, groupingAlternatives} from '../app/src/main/bpm/analyzer/bass-grouping.js';
const result = (...pairs) => ({bpm: pairs[0]?.[0] ?? null, candidates: pairs.map(([bpm, score]) => ({bpm, score}))});

test('strong bass evidence resolves triple grouping while retaining ranked candidates', () => {
  const original = result([90, .8], [60, .65]);
  const corrected = resolveBassGrouping(original, result([60, .9], [90, .4], [45, .5]), result([90, .8]));
  assert.equal(corrected.bpm, 60);
  assert.equal(corrected.candidates[0].bpm, 90);
  assert.equal(original.bpm, 90);
  assert.equal(corrected.bassGrouping.acfCorroborates, false);
});

test('small bass advantage requires a close broadband candidate and ACF corroboration', () => {
  const original = result([50, .85], [75, .84]);
  const bass = result([75, .9], [50, .84]);
  assert.equal(resolveBassGrouping(original, bass, result([150, .8])).bpm, 75);
  assert.equal(resolveBassGrouping(original, bass, result([50, .8])), original);
  const weak = result([50, .85], [75, .65]);
  assert.equal(resolveBassGrouping(weak, bass, result([75, .8])), weak);
});

test('half-rate bass support protects original grouping; weak/unrelated evidence abstains', () => {
  const original = result([90, .8], [60, .65]);
  assert.equal(resolveBassGrouping(original, result([60, .9], [45, .89]), result([90, .8])), original);
  assert.equal(resolveBassGrouping(original, result([60, .4], [90, .1]), result([60, .8])), original);
  assert.equal(resolveBassGrouping(original, result([70, .9]), result([60, .8])), original);
  assert.deepEqual(groupingAlternatives(result()), []);
  assert.deepEqual(groupingAlternatives(result([90, .8], [60, .4])), []);
});
