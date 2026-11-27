import { expect, it, vi } from "vitest";
import { runDesignerGeneration } from "../app/src/renderer/controllers/tanda-designer-generation";
import type { TandaDraft } from "../app/src/renderer/domain";

it.each([undefined, ["anchor"]])("completes a partial draft with manual track IDs %j", async (manualTrackIds) => {
  const draft: TandaDraft = {
    id: "draft", name: "", rating: 0, styles: [],
    trackSlots: [null, null, "anchor"], manualTrackIds,
    triedGeneratedCombinations: ["previous"], origin: "designer",
  };
  const generate = vi.fn(() => ({
    ...draft, styles: ["Tango"], generatedTrackIds: ["first", "second"],
  }));
  const installDraft = vi.fn();
  const refresh = vi.fn();
  await runDesignerGeneration({
    listTracks: async () => [],
    getTarget: () => ({ targetCount: 3, targetStyles: [] }),
    getActiveTanda: () => draft,
    cacheTrack: vi.fn(),
    getBpm: () => null,
    collectPlaylistArtistKeys: () => new Set(),
    generate,
    installDraft,
    refresh,
    setStatus: vi.fn(),
    showAlert: vi.fn(),
    t: (key) => key,
  });
  expect(generate).toHaveBeenCalledWith([], expect.objectContaining({
    anchorTrackIds: ["anchor"],
    triedGeneratedCombinations: new Set(["previous"]),
  }));
  expect(draft.trackSlots).toEqual(["anchor", "first", "second"]);
  expect(draft.manualTrackIds).toEqual(["anchor"]);
  expect(draft.triedGeneratedCombinations).toHaveLength(2);
  expect(installDraft).not.toHaveBeenCalled();
  expect(refresh).toHaveBeenCalledWith(["Tango"], true);
});

it.each([{ tracks: [] }, { tracks: ["anchor"] }])(
  "excludes playlist orchestras when filling a slot with $tracks",
  async ({ tracks }) => {
  const draft: TandaDraft = {
    id: "slot", name: "", rating: 0, styles: [],
    trackSlots: [...tracks, null], origin: "playlist",
  };
  const excludedArtists = new Set(["used elsewhere"]);
  const generate = vi.fn(() => null);
  const isCurrent = vi.fn(() => true);
  const deps = {
    listTracks: async () => [],
    getTarget: () => ({ targetCount: 3, targetStyles: [] }),
    getActiveTanda: () => draft,
    playlistSlot: { isCurrent },
    cacheTrack: vi.fn(),
    getBpm: () => null,
    collectPlaylistArtistKeys: () => excludedArtists,
    generate,
    installDraft: vi.fn(),
    refresh: vi.fn(),
    setStatus: vi.fn(),
    showAlert: vi.fn(),
    t: (key: string) => key,
  };
  await runDesignerGeneration(deps);
  expect(generate).toHaveBeenCalledWith([], expect.objectContaining({
    anchorTrackIds: tracks,
    excludedArtists,
  }));
  expect(draft.trackSlots).toEqual([...tracks, null]);
  expect(deps.refresh).not.toHaveBeenCalled();

  generate.mockClear();
  isCurrent.mockReturnValue(false);
  await runDesignerGeneration(deps);
  expect(generate).not.toHaveBeenCalled();
  },
);
