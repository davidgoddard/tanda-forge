import {test} from 'vitest';
import assert from 'node:assert/strict';
import {resolveMetricalTie} from '../app/src/main/bpm/analyzer/hybrid-recurrence.js';
const result = (a, b, score = .95) => ({bpm: a, candidates: [{bpm: a, score: 1}, {bpm: b, score}]});
const options = {metricalTieRatio: .94, center: 60};
test('close 3:2 grouping uses tempo prior and exposes original evidence ranking', () => {
  const input = result(84, 56);
  const output = resolveMetricalTie(input, options);
  assert.equal(output.bpm, 56);
  assert.equal(output.candidates[0].bpm, 84);
  assert.equal(input.bpm, 84);
  assert.equal(output.metricalTie.evidenceWinnerBpm, 84);
});
test('tie-break preserves strong winners, unrelated ratios, and prior-favoured duple rates', () => {
  for (const input of [result(84, 56, .93), result(84, 60), result(63, 42), {bpm: null, candidates: []}]) {
    assert.equal(resolveMetricalTie(input, options), input);
  }
  const input = result(84, 56);
  assert.equal(resolveMetricalTie(input, {...options, metricalTieRatio: 0}), input);
});
