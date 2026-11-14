import {selectRecurrence} from './recurrence-select.js';

export function hybridEvidence(windows, spectralWeight) {
  return windows.map(window => {
    const maximum = Math.max(...window.spectral, 1e-12);
    return {
      ...window,
      curve: window.curve.map((value, index) =>
        value ** (1 - spectralWeight) * (window.spectral[index] / maximum) ** spectralWeight),
    };
  });
}

// Keep evidence-ranked candidates intact so callers can inspect the ambiguity.
// This resolves a 3:2 grouping only; it does not classify musical style.
export function resolveMetricalTie(result, {metricalTieRatio = 0, center = 60} = {}) {
  const top = result.candidates[0];
  if (!top || !metricalTieRatio) return result;
  const alternative = result.candidates.find(candidate =>
    Math.abs(candidate.bpm / top.bpm - 2 / 3) < .01 &&
    candidate.score / top.score >= metricalTieRatio &&
    Math.abs(Math.log2(candidate.bpm / center)) < Math.abs(Math.log2(top.bpm / center)));
  if (!alternative) return result;
  return {...result, bpm: alternative.bpm, metricalTie: {
    evidenceWinnerBpm: top.bpm,
    selectedBpm: alternative.bpm,
    relativeScore: alternative.score / top.score,
  }};
}

export function selectHybridRecurrence(windows, {spectralWeight = .25, ...options} = {}) {
  return resolveMetricalTie(selectRecurrence(hybridEvidence(windows, spectralWeight), options), options);
}
