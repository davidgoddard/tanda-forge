import { describe, expect, it } from "vitest";
import { buildAudioSimilarityIndex } from "../app/src/renderer/state/audio-similarity-index";
import type { ConfirmedAudioSimilarityGroup } from "../app/src/shared/audio-similarity";

const group = (trackIds: string[], relationshipType: ConfirmedAudioSimilarityGroup["relationshipType"], preferredTrackId: string | null = null): ConfirmedAudioSimilarityGroup => ({
  id: trackIds.join(","), trackIds, relationshipType, preferredTrackId, updatedAt: "2026-11-27",
});

describe("audio similarity indexes", () => {
  it("keeps a fresh unconfigured library inert", () => {
    const result = buildAudioSimilarityIndex({ hiddenTrackIds: [], confirmedGroups: [] });
    expect([...result.similarityEquivalentTrackIds]).toEqual([]);
    expect([...result.similarityHiddenTrackIds]).toEqual([]);
    expect([...result.similarityPreferredTrackIds]).toEqual([]);
  });

  it("indexes every confirmed member and its elected master without mutating the report", () => {
    const groups = [group(["a", "b"], "identical", "b")];
    const result = buildAudioSimilarityIndex({ hiddenTrackIds: ["hidden"], confirmedGroups: groups });
    expect(result.similarityEquivalentTrackIds.get("a")).toEqual(new Set(["a", "b"]));
    expect(result.similarityEquivalentTrackIds.get("a")).toBe(result.similarityEquivalentTrackIds.get("b"));
    expect(result.similarityPreferredTrackIds.get("a")).toBe("b");
    expect(result.similarityRelationshipByTrackId.get("b")).toBe("identical");
    expect(result.similarityHiddenTrackIds.has("hidden")).toBe(true);
    expect(groups).toEqual([group(["a", "b"], "identical", "b")]);
  });

  it("preserves broad group lookup and explicit preferred members across overlapping groups", () => {
    const broad = group(["a", "b", "c"], "same-composition");
    const narrow = group(["a", "b"], "identical", "b");
    const result = buildAudioSimilarityIndex({ hiddenTrackIds: [], confirmedGroups: [broad, narrow] });
    expect(result.similarityEquivalentTrackIds.get("a")).toEqual(new Set(["a", "b", "c"]));
    expect(result.similarityRelationshipByTrackId.get("a")).toBe("same-composition");
    expect(result.similarityPreferredTrackIds.get("a")).toBe("b");
    expect(result.similarityPreferredTrackIds.has("c")).toBe(false);
  });

  it("does not carry stale groups or hidden tracks into a refreshed index", () => {
    const previous = buildAudioSimilarityIndex({ hiddenTrackIds: ["a"], confirmedGroups: [group(["a", "b"], "same-recording")] });
    const next = buildAudioSimilarityIndex({ hiddenTrackIds: [], confirmedGroups: [group(["c", "d"], "same-orchestra")] });
    expect(next.similarityEquivalentTrackIds.has("a")).toBe(false);
    expect(next.similarityHiddenTrackIds.size).toBe(0);
    expect(previous.similarityEquivalentTrackIds.has("a")).toBe(true);
  });
});
