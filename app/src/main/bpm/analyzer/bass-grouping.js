import {selectHybridRecurrence} from './hybrid-recurrence.js';

// Evidence thresholds, not calibrated probabilities. Only resolve an existing
// 3:2 ambiguity; never manufacture a tempo by multiplying the selected BPM.
export const BASS_GROUPING = Object.freeze({
  ratioTolerance: .03,
  minimumCandidateRatio: .7,
  minimumBassScore: .5,
  strongBassMargin: .3,
  corroboratedBassMargin: .05,
  corroboratedCandidateRatio: .9,
});
const relativeError = (a, b) => Math.abs(a / b - 1);
const octaveError = (a, b) => Math.min(...[.5, 1, 2].map(f => relativeError(a, b * f)));

export function groupingAlternatives(result) {
  const top = result.candidates[0];
  if (!top || !result.bpm) return [];
  return result.candidates.filter(candidate =>
    [2 / 3, 1.5].some(f => relativeError(candidate.bpm, result.bpm * f) < BASS_GROUPING.ratioTolerance) &&
    candidate.score >= top.score * BASS_GROUPING.minimumCandidateRatio);
}

export function resolveBassGrouping(result, bassResult, acfResult) {
  const top = bassResult.candidates[0];
  if (!top || top.score < BASS_GROUPING.minimumBassScore) return result;
  const alternative = groupingAlternatives(result).find(candidate =>
    relativeError(candidate.bpm, top.bpm) < BASS_GROUPING.ratioTolerance);
  if (!alternative) return result;
  // Count half/double bass peaks as support for the original grouping too.
  const rival = Math.max(0, ...bassResult.candidates.filter(candidate =>
    octaveError(candidate.bpm, result.bpm) < BASS_GROUPING.ratioTolerance).map(candidate => candidate.score));
  const margin = 1 - rival / top.score;
  const candidateRatio = alternative.score / result.candidates[0].score;
  const corroborated = acfResult.bpm !== null &&
    octaveError(acfResult.bpm, alternative.bpm) < BASS_GROUPING.ratioTolerance;
  const strong = margin >= BASS_GROUPING.strongBassMargin;
  if (!strong && !(margin >= BASS_GROUPING.corroboratedBassMargin &&
      candidateRatio >= BASS_GROUPING.corroboratedCandidateRatio && corroborated)) return result;
  return {...result, bpm: alternative.bpm, bassGrouping: {
    previousBpm: result.bpm, selectedBpm: alternative.bpm, bassBpm: top.bpm,
    bassScore: top.score, relativeBassMargin: margin, candidateRatio,
    acfBpm: acfResult.bpm, acfCorroborates: corroborated,
    reason: strong ? 'strong bass grouping' : 'bass grouping corroborated by autocorrelation',
  }};
}

export function selectBassGrouping(windows, bassWindows, options) {
  const result = selectHybridRecurrence(windows, options);
  if (!groupingAlternatives(result).length || !bassWindows?.length) return result;
  const acousticOptions = {...options, metricalTieRatio: 0};
  return resolveBassGrouping(result,
    selectHybridRecurrence(bassWindows, acousticOptions),
    selectHybridRecurrence(windows, {...acousticOptions, spectralWeight: 0}));
}
