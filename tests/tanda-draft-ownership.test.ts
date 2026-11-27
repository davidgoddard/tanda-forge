import { describe, expect, it } from "vitest";
import { finalizeTandaOwnership, resolveTandaEditorHost } from "../app/src/renderer/modules/tanda-draft-ownership";
import type { TandaDraft } from "../app/src/renderer/domain";

const master: TandaDraft = {
  id: "master", name: "Canaro", styles: ["Tango"], rating: 0,
  trackSlots: ["track"], totalDurationMs: 1000,
};
const variant: TandaDraft = {
  ...master, id: "variant", origin: "playlist", masterTandaId: master.id, playlistUnsaved: true,
};
const empty: TandaDraft = { ...master, id: "empty", origin: "designer", trackSlots: [null] };

const setup = (draft: TandaDraft) => ({
  playlistItems: [{ kind: "tanda" as const, tandaId: draft.id }],
  tandaDrafts: [draft, empty, { ...empty, id: "duplicate" }],
  tandaCache: new Map([[master.id, master], [draft.id, draft]]),
  persistedTandaIds: new Set([master.id]),
  clipboardCollections: [],
  createEmptyTanda: () => { throw new Error("Existing empty draft should be reused"); },
});

describe("tanda draft ownership", () => {
  it("hosts the editor in the playlist only for an open playlist row", () => {
    expect(resolveTandaEditorHost("playlist-tab", 0)).toBe("playlist-tab");
    expect(resolveTandaEditorHost("playlist-tab", null)).toBe("tanda-designer-tab");
    expect(resolveTandaEditorHost(null, 0)).toBe("tanda-designer-tab");
  });

  it("restores an unchanged playlist variant to its saved master", () => {
    const state = setup(variant);
    const result = finalizeTandaOwnership(variant, "playlist-tab", state);
    expect(result.playlistItems).toEqual([{ kind: "tanda", tandaId: master.id }]);
    expect(state.tandaCache.has(variant.id)).toBe(false);
    expect(state.tandaCache.get(master.id)).toBe(master);
    expect(result.tandaDrafts).toEqual([empty]);
    expect(result.selectedTandaId).toBe(empty.id);
  });

  it("keeps a changed variant under its own ID and caches a detached copy", () => {
    const edited = { ...variant, trackSlots: ["replacement"] };
    const state = setup(edited);
    const result = finalizeTandaOwnership(edited, "playlist-tab", state);
    expect(result.playlistItems).toBe(state.playlistItems);
    const cached = state.tandaCache.get(edited.id);
    expect(cached).toMatchObject(edited);
    expect(cached?.trackSlots).not.toBe(edited.trackSlots);
    expect(state.tandaCache.get(master.id)).toBe(master);
  });
});
