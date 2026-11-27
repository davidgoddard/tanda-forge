import { expect, it, vi } from "vitest";
import { runDesignerGeneration } from "../app/src/renderer/controllers/tanda-designer-generation";
import type { TandaDraft } from "../app/src/renderer/domain";

it("completes the existing draft and passes its combination history to generation", async () => {
  const draft: TandaDraft = {
    id: "draft", name: "", rating: 0, styles: [],
    trackSlots: [null, null, "anchor"], manualTrackIds: ["anchor"],
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
  expect(draft.triedGeneratedCombinations).toHaveLength(2);
  expect(installDraft).not.toHaveBeenCalled();
  expect(refresh).toHaveBeenCalledWith(["Tango"], true);
});
