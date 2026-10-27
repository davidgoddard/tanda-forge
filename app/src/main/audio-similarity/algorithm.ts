export const SIMILARITY_SAMPLE_RATE = 8000;
export const ENVELOPE_BINS = 128;
export const CHROMA_BINS = 48;
const FFT_SIZE = 1024;

export type ComparableAudioFeatures = {
  envelope: number[];
  chroma: number[][];
  transition: number[][];
  coarse: number[];
};

export type ComparableAudioRecord = {
  trackId: string;
  effectiveDurationMs: number;
  features: ComparableAudioFeatures;
};

export type AudioSimilarityComparison = {
  score: number;
  envelopeScore: number;
  chromaScore: number;
  transitionScore: number;
  coarseScore: number;
  pitchShift: number;
};

const normalise = (values: number[]) => {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return magnitude > 0 ? values.map((value) => value / magnitude) : values.map(() => 0);
};

const cosine = (left: number[], right: number[]) => {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  const denominator = Math.sqrt(leftMagnitude * rightMagnitude);
  return denominator > 0 ? Math.max(-1, Math.min(1, dot / denominator)) : 0;
};

const fixedRmsBins = (samples: Int16Array, count: number) => {
  const bins = Array.from({ length: count }, () => 0);
  for (let bin = 0; bin < count; bin += 1) {
    const start = Math.floor((bin * samples.length) / count);
    const end = Math.max(start + 1, Math.floor(((bin + 1) * samples.length) / count));
    let sum = 0;
    for (let index = start; index < Math.min(end, samples.length); index += 1) {
      const value = samples[index] / 32768;
      sum += value * value;
    }
    bins[bin] = Math.sqrt(sum / Math.max(1, end - start));
  }
  const sorted = [...bins].sort((a, b) => a - b);
  const scale = sorted[Math.floor(sorted.length * 0.9)] || 1;
  return normalise(bins.map((value) => Math.log1p((value / scale) * 9)));
};

const fftMagnitudes = (samples: Float64Array) => {
  const real = Float64Array.from(samples);
  const imaginary = new Float64Array(samples.length);
  for (let index = 1, reverse = 0; index < samples.length; index += 1) {
    let bit = samples.length >> 1;
    for (; reverse & bit; bit >>= 1) reverse ^= bit;
    reverse ^= bit;
    if (index < reverse) {
      [real[index], real[reverse]] = [real[reverse], real[index]];
    }
  }
  for (let length = 2; length <= samples.length; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    for (let start = 0; start < samples.length; start += length) {
      for (let offset = 0; offset < length / 2; offset += 1) {
        const cos = Math.cos(angle * offset);
        const sin = Math.sin(angle * offset);
        const even = start + offset;
        const odd = even + length / 2;
        const oddReal = real[odd] * cos - imaginary[odd] * sin;
        const oddImaginary = real[odd] * sin + imaginary[odd] * cos;
        real[odd] = real[even] - oddReal;
        imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal;
        imaginary[even] += oddImaginary;
      }
    }
  }
  return Array.from({ length: samples.length / 2 }, (_, index) =>
    Math.hypot(real[index], imaginary[index]),
  );
};

const extractChroma = (samples: Int16Array) => {
  const result: number[][] = [];
  for (let bin = 0; bin < CHROMA_BINS; bin += 1) {
    const center = Math.floor(((bin + 0.5) * samples.length) / CHROMA_BINS);
    const frame = new Float64Array(FFT_SIZE);
    const start = center - FFT_SIZE / 2;
    for (let index = 0; index < FFT_SIZE; index += 1) {
      const sourceIndex = start + index;
      const sample = sourceIndex >= 0 && sourceIndex < samples.length
        ? samples[sourceIndex] / 32768
        : 0;
      frame[index] = sample * (0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (FFT_SIZE - 1)));
    }
    const magnitudes = fftMagnitudes(frame);
    const chroma = Array.from({ length: 12 }, () => 0);
    for (let frequencyBin = 2; frequencyBin < magnitudes.length; frequencyBin += 1) {
      const frequency = (frequencyBin * SIMILARITY_SAMPLE_RATE) / FFT_SIZE;
      if (frequency < 55 || frequency > 2000) continue;
      const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
      chroma[((midi % 12) + 12) % 12] += magnitudes[frequencyBin] ** 2;
    }
    result.push(normalise(chroma.map((value) => Math.sqrt(value))));
  }
  return result;
};

const rotate = (values: number[], shift: number) =>
  values.map((_, index) => values[(index + shift) % values.length]);

const cosineRotated = (left: number[], right: number[], shift: number) => {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index];
    const rightValue = right[(index + shift) % right.length];
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }
  const denominator = Math.sqrt(leftMagnitude * rightMagnitude);
  return denominator > 0 ? Math.max(-1, Math.min(1, dot / denominator)) : 0;
};

const averageChroma = (frames: number[][]) =>
  normalise(Array.from({ length: 12 }, (_, note) =>
    frames.reduce((sum, frame) => sum + frame[note], 0),
  ));

export const extractComparableAudioFeatures = (
  samples: Int16Array,
): ComparableAudioFeatures => {
  if (samples.length < FFT_SIZE) throw new Error("The decoded track is too short to compare.");
  const envelope = fixedRmsBins(samples, ENVELOPE_BINS);
  const chroma = extractChroma(samples);
  const transition = chroma.slice(1).map((frame, index) =>
    normalise(frame.map((value, note) => value - chroma[index][note])),
  );
  const average = averageChroma(chroma);
  const dominant = average.indexOf(Math.max(...average));
  const coarse = [
    ...rotate(average, dominant),
    ...Array.from({ length: 16 }, (_, index) => envelope[index * 8]),
  ];
  return { envelope, chroma, transition, coarse: normalise(coarse) };
};

const bestRotatedSequenceScore = (left: number[][], right: number[][]) => {
  let bestScore = -1;
  let bestShift = 0;
  for (let shift = 0; shift < 12; shift += 1) {
    const score = left.reduce(
      (sum, frame, index) => sum + cosineRotated(frame, right[index] ?? [], shift),
      0,
    ) / Math.max(1, left.length);
    if (score > bestScore) {
      bestScore = score;
      bestShift = shift;
    }
  }
  return { score: Math.max(0, bestScore), shift: bestShift };
};

export const compareComparableAudioFeatures = (
  left: ComparableAudioFeatures,
  right: ComparableAudioFeatures,
): AudioSimilarityComparison => {
  const envelopeScore = Math.max(0, cosine(left.envelope, right.envelope));
  const chroma = bestRotatedSequenceScore(left.chroma, right.chroma);
  const transitionScore = Math.max(0, left.transition.reduce(
    (sum, frame, index) =>
      sum + cosineRotated(frame, right.transition[index] ?? [], chroma.shift),
    0,
  ) / Math.max(1, left.transition.length));
  const coarseScore = Math.max(0, cosine(left.coarse, right.coarse));
  const score = envelopeScore * 0.28 + chroma.score * 0.27
    + transitionScore * 0.35 + coarseScore * 0.1;
  return {
    score,
    envelopeScore,
    chromaScore: chroma.score,
    transitionScore,
    coarseScore,
    pitchShift: chroma.shift,
  };
};

export type AudioSimilarityMatch = AudioSimilarityComparison & {
  leftTrackId: string;
  rightTrackId: string;
};

const lowerBoundDuration = (
  durations: Array<{ duration: number; index: number }>,
  target: number,
) => {
  let low = 0;
  let high = durations.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (durations[middle].duration < target) low = middle + 1;
    else high = middle;
  }
  return low;
};

const upperBoundDuration = (
  durations: Array<{ duration: number; index: number }>,
  target: number,
) => {
  let low = 0;
  let high = durations.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (durations[middle].duration <= target) low = middle + 1;
    else high = middle;
  }
  return low;
};

const buildDurationIndex = (records: ComparableAudioRecord[]) => records
  .map((record, index) => ({ duration: record.effectiveDurationMs, index }))
  .sort((left, right) => left.duration - right.duration || left.index - right.index);

const durationCompatibleRightIndices = (
  records: ComparableAudioRecord[],
  durations: ReturnType<typeof buildDurationIndex>,
  leftIndex: number,
) => {
  const duration = records[leftIndex].effectiveDurationMs;
  const boundaryMargin = Math.max(1, Math.abs(duration)) * 1e-12;
  const first = lowerBoundDuration(durations, duration / 1.39 - boundaryMargin);
  const last = upperBoundDuration(durations, duration / 0.72 + boundaryMargin);
  const result: number[] = [];
  for (let position = first; position < last; position += 1) {
    const rightIndex = durations[position].index;
    if (rightIndex <= leftIndex) continue;
    const durationRatio = duration / records[rightIndex].effectiveDurationMs;
    if (durationRatio < 0.72 || durationRatio > 1.39) continue;
    result.push(rightIndex);
  }
  return result.sort((left, right) => left - right);
};

export const findComparableAudioMatches = (
  records: ComparableAudioRecord[],
  threshold = 0.79,
) => {
  const matches: AudioSimilarityMatch[] = [];
  let candidatePairs = 0;
  const durations = buildDurationIndex(records);
  for (let left = 0; left < records.length; left += 1) {
    for (const right of durationCompatibleRightIndices(records, durations, left)) {
      if (cosine(records[left].features.coarse, records[right].features.coarse) < 0.35) continue;
      candidatePairs += 1;
      const comparison = compareComparableAudioFeatures(
        records[left].features,
        records[right].features,
      );
      if (comparison.score >= threshold) {
        matches.push({
          leftTrackId: records[left].trackId,
          rightTrackId: records[right].trackId,
          ...comparison,
        });
      }
    }
  }
  return { candidatePairs, matches };
};

export const findComparableAudioMatchesCooperatively = async (
  records: ComparableAudioRecord[],
  signal: AbortSignal,
  threshold = 0.79,
  maximumBlockingMs = 12,
  progress?: (pairsProcessed: number, totalPairs: number) => void,
) => {
  const matches: AudioSimilarityMatch[] = [];
  let candidatePairs = 0;
  let pairsProcessed = 0;
  const totalPairs = records.length * (records.length - 1) / 2;
  const durations = buildDurationIndex(records);
  let yieldAt = Date.now() + maximumBlockingMs;
  for (let left = 0; left < records.length; left += 1) {
    const rowStart = pairsProcessed;
    for (const right of durationCompatibleRightIndices(records, durations, left)) {
      if (signal.aborted) throw new Error("Analysis was cancelled.");
      if (cosine(records[left].features.coarse, records[right].features.coarse) >= 0.35) {
        candidatePairs += 1;
        const comparison = compareComparableAudioFeatures(
          records[left].features,
          records[right].features,
        );
        if (comparison.score >= threshold) {
          matches.push({
            leftTrackId: records[left].trackId,
            rightTrackId: records[right].trackId,
            ...comparison,
          });
        }
      }
      if (Date.now() >= yieldAt) {
        progress?.(Math.min(totalPairs, rowStart + right - left), totalPairs);
        await new Promise<void>((resolve) => setImmediate(resolve));
        if (signal.aborted) throw new Error("Analysis was cancelled.");
        yieldAt = Date.now() + maximumBlockingMs;
      }
    }
    pairsProcessed = rowStart + records.length - left - 1;
  }
  progress?.(pairsProcessed, totalPairs);
  return { candidatePairs, matches };
};

export const groupComparableAudioMatches = (matches: AudioSimilarityMatch[]) => {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const current = parent.get(id) ?? id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const join = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
    parent.set(left, leftRoot);
    parent.set(right, leftRoot);
  };
  for (const match of matches) join(match.leftTrackId, match.rightTrackId);
  const groups = new Map<string, Set<string>>();
  for (const match of matches) {
    for (const id of [match.leftTrackId, match.rightTrackId]) {
      const root = find(id);
      const group = groups.get(root) ?? new Set<string>();
      group.add(id);
      groups.set(root, group);
    }
  }
  return [...groups.values()].map((members) => [...members]);
};
