import {decodeFile} from './analyze.js';
import {onsetFeatures,windowEvidence} from './hybrid.js';
import {selectHybridRecurrence} from './hybrid-recurrence.js';
import {groupingAlternatives, selectBassGrouping} from './bass-grouping.js';

// Original settings: results/selection.json. Revisions: results/metrical-v2 and results/bass-v3.
export const DEFAULTS = Object.freeze({
  "spectralWeight": 0.75,
  "subdivisionWeight": 0.9,
  "center": 60,
  "prior": 0.3,
  "power": 1,
  "metricalTieRatio": 0.94,
  "bassGrouping": true,
  "maxBpm": 240
});
export const ALGORITHM = 'stft-windowed-recurrence-v3';
const SAMPLE_RATE = 11025;

function validateOptions(options) {
  if (typeof options.bassGrouping !== 'boolean') throw new Error('bassGrouping must be boolean');
  for (const name of ['spectralWeight', 'subdivisionWeight', 'metricalTieRatio']) {
    const value = options[name];
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`${name} must be between zero and one`);
    }
  }
  for (const name of ['center', 'power', 'maxBpm']) {
    if (!Number.isFinite(options[name]) || options[name] <= 0) {
      throw new Error(`${name} must be positive and finite`);
    }
  }
  if (!Number.isFinite(options.prior) || options.prior < 0) {
    throw new Error('prior must be nonnegative and finite');
  }
  if (options.maxBpm < 40 || options.maxBpm > 240) {
    throw new Error('maxBpm must be within the 40–240 BPM evidence grid');
  }
}

/** Analyze mono floating-point PCM at 11,025 Hz. No metadata is consulted. */
export function analyzeSamples(samples, options = {}) {
  if (!(samples instanceof Float32Array || samples instanceof Float64Array)) {
    throw new Error('Expected floating mono PCM at 11025 Hz');
  }
  for (const sample of samples) {
    if (!Number.isFinite(sample)) throw new Error('Non-finite PCM');
  }
  const settings = {...DEFAULTS, ...options};
  validateOptions(settings);
  const bands = onsetFeatures(samples);
  const evidence = windowEvidence(bands);
  const baseline = selectHybridRecurrence(evidence, settings);
  // Bass evidence is only needed when the broadband result has a credible
  // competing 3:2 grouping. These eight bands cover roughly 32–244 Hz.
  const bassEvidence = settings.bassGrouping && groupingAlternatives(baseline).length
    ? windowEvidence(bands.slice(0, 8)) : null;
  const result = bassEvidence ? selectBassGrouping(evidence, bassEvidence, settings) : baseline;
  const bassByStart = new Map((bassEvidence ?? []).map(window => [window.startSeconds, window]));
  const windows = evidence.map(window => {
    const bassWindow = bassByStart.get(window.startSeconds);
    const local = bassWindow ? selectBassGrouping([window], [bassWindow], settings)
      : selectHybridRecurrence([window], settings);
    return {
      startSeconds: window.startSeconds,
      durationSeconds: window.durationSeconds,
      bpm: local.bpm,
    };
  });
  const agreement = result.bpm === null || !windows.length ? null
    : windows.filter(window => window.bpm !== null &&
      Math.min(...[.5, 1, 2].map(factor =>
        Math.abs(window.bpm / (result.bpm * factor) - 1))) <= .05
    ).length / windows.length;
  const warnings = [];
  if (samples.length / SAMPLE_RATE >= (options.durationSeconds ?? 600) - .01) {
    warnings.push('Decode limit reached; the source may be longer.');
  }
  if (agreement !== null && agreement < .7) {
    warnings.push('Local windows disagree on tempo or beat grouping.');
  }
  return {
    algorithm: ALGORITHM,
    sampleRate: SAMPLE_RATE,
    actualDurationSeconds: samples.length / SAMPLE_RATE,
    settings: Object.fromEntries(Object.keys(DEFAULTS).map(key => [key, settings[key]])),
    ...result,
    windows,
    windowAgreementWithin5Percent: agreement,
    warnings,
    ...(options.includeEvidence ? {evidence, bassEvidence} : {}),
  };
}

/** FFmpeg decoding is asynchronous; DSP is synchronous. Use a worker in a GUI. */
export async function analyzeFile(filename, options = {}) {
  return analyzeSamples(await decodeFile(filename, options), options);
}
