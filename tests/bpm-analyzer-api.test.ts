import {test} from 'vitest';
import assert from 'node:assert/strict';
import {analyzeSamples} from '../app/src/main/bpm/analyzer/api.js';

test('public API preserves low and high pulse rates within an octave', () => {
  for (const bpm of [60, 83, 120, 157, 210]) {
    const samples = new Float32Array(11025 * 25);
    for (let t = .3; t < 25; t += 60 / bpm) {
      const start = Math.round(t * 11025);
      for (let j = 0; j < 250 && start + j < samples.length; j++) {
        samples[start + j] = Math.sin(j * .7) * Math.exp(-j / 40);
      }
    }
    const result = analyzeSamples(samples);
    const error = Math.min(...[.5, 1, 2].map(factor =>
      Math.abs(result.bpm / (bpm * factor) - 1)));
    assert.ok(error < .02, `${bpm} BPM produced ${result.bpm}`);
    assert.ok(result.windows.length > 0);
    assert.equal(result.windowAgreementWithin5Percent, 1);
  }
});

test('public API validates settings and abstains on silence', () => {
  assert.throws(() => analyzeSamples(new Float32Array(), {spectralWeight: 2}));
  assert.throws(() => analyzeSamples(new Float32Array(), {prior: NaN}));
  assert.throws(() => analyzeSamples(new Float32Array(), {maxBpm: 300}));
  assert.throws(() => analyzeSamples(new Float32Array(), {bassGrouping: 1}));
  const result = analyzeSamples(new Float32Array(11025 * 25));
  assert.equal(result.status, 'insufficient_evidence');
  assert.equal(result.bpm, null);
  assert.equal(result.windowAgreementWithin5Percent, null);
});
