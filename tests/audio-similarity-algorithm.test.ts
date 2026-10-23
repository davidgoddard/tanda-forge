import { describe, expect, it } from "vitest";
import {
  compareComparableAudioFeatures,
  extractComparableAudioFeatures,
  findComparableAudioMatches,
  groupComparableAudioMatches,
} from "../app/src/main/audio-similarity/algorithm";

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

  it("rejects unusably short decoded audio", () => {
    expect(() => extractComparableAudioFeatures(new Int16Array(100))).toThrow(/too short/i);
  });
});
