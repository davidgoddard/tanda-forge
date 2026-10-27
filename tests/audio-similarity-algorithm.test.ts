import { describe, expect, it } from "vitest";
import {
  type ComparableAudioRecord,
  compareComparableAudioFeatures,
  extractComparableAudioFeatures,
  findComparableAudioMatches,
  findComparableAudioMatchesCooperatively,
  groupComparableAudioMatches,
} from "../app/src/main/audio-similarity/algorithm";

const exhaustiveMatches = (records: ComparableAudioRecord[], threshold: number) => {
  const matches = [];
  let candidatePairs = 0;
  for (let left = 0; left < records.length; left += 1) {
    for (let right = left + 1; right < records.length; right += 1) {
      const durationRatio = records[left].effectiveDurationMs / records[right].effectiveDurationMs;
      if (durationRatio < 0.72 || durationRatio > 1.39) continue;
      const comparison = compareComparableAudioFeatures(
        records[left].features,
        records[right].features,
      );
      if (comparison.coarseScore < 0.35) continue;
      candidatePairs += 1;
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

const phrase = (gain: number, notes = [220, 261.63, 329.63, 293.66]) => {
  const samples = new Int16Array(8000 * 5);
  for (let index = 0; index < samples.length; index += 1) {
    const progress = index / samples.length;
    const note = notes[Math.min(notes.length - 1, Math.floor(progress * notes.length))];
    const envelope = 0.2 + 0.8 * Math.sin(Math.PI * progress) ** 2;
    samples[index] = Math.round(Math.sin(2 * Math.PI * note * index / 8000) * gain * envelope * 32767);
  }
  return samples;
};

describe("integrated audio similarity algorithm", () => {
  it("is resilient to gain differences", () => {
    const loud = extractComparableAudioFeatures(phrase(0.9));
    const quiet = extractComparableAudioFeatures(phrase(0.25));
    expect(compareComparableAudioFeatures(loud, quiet).score).toBeGreaterThan(0.95);
  });

  it("shortlists, compares, and flat-groups similar tracks", () => {
    const first = extractComparableAudioFeatures(phrase(0.8));
    const second = extractComparableAudioFeatures(phrase(0.3));
    const different = extractComparableAudioFeatures(
      phrase(0.8, [174.61, 233.08, 277.18, 369.99]),
    );
    const { matches } = findComparableAudioMatches([
      { trackId: "a", effectiveDurationMs: 5000, features: first },
      { trackId: "b", effectiveDurationMs: 5000, features: second },
      { trackId: "c", effectiveDurationMs: 5000, features: different },
    ], 0.9);
    expect(matches.some((match) => match.leftTrackId === "a" && match.rightTrackId === "b")).toBe(true);
    expect(groupComparableAudioMatches(matches)).toContainEqual(["a", "b"]);
  });

  it("preserves matching results while yielding and remains cancellable", async () => {
    const first = extractComparableAudioFeatures(phrase(0.8));
    const second = extractComparableAudioFeatures(phrase(0.3));
    const records = [
      { trackId: "a", effectiveDurationMs: 5000, features: first },
      { trackId: "b", effectiveDurationMs: 5000, features: second },
      { trackId: "c", effectiveDurationMs: 5000, features: first },
    ];
    const expected = findComparableAudioMatches(records, 0.9);
    const progress: Array<[number, number]> = [];
    await expect(findComparableAudioMatchesCooperatively(
      records, new AbortController().signal, 0.9, 0,
      (processed, total) => progress.push([processed, total]),
    )).resolves.toEqual(expected);
    expect(progress.at(-1)).toEqual([3, 3]);

    const controller = new AbortController();
    setImmediate(() => controller.abort());
    await expect(findComparableAudioMatchesCooperatively(
      [...records, ...records.map((record, index) => ({
        ...record, trackId: `${record.trackId}-${index}`,
      }))],
      controller.signal,
      0.9,
      0,
    )).rejects.toThrow(/cancelled/i);
  });

  it("returns every match found by exhaustive comparison across duration boundaries", async () => {
    const sourceFeatures = [
      extractComparableAudioFeatures(phrase(0.8)),
      extractComparableAudioFeatures(phrase(0.3)),
      extractComparableAudioFeatures(phrase(0.8, [174.61, 233.08, 277.18, 369.99])),
    ];
    const durations = [7200, 7199, 9999, 10000, 13899, 13900, 13901, 19305];
    const records = durations.map((effectiveDurationMs, index) => ({
      trackId: `track-${index}`,
      effectiveDurationMs,
      features: sourceFeatures[index % sourceFeatures.length],
    }));
    const expected = exhaustiveMatches(records, 0.79);

    expect(findComparableAudioMatches(records)).toEqual(expected);
    await expect(findComparableAudioMatchesCooperatively(
      records,
      new AbortController().signal,
      0.79,
      0,
    )).resolves.toEqual(expected);
  });

  it("rejects unusably short decoded audio", () => {
    expect(() => extractComparableAudioFeatures(new Int16Array(100))).toThrow(/too short/i);
  });
});
