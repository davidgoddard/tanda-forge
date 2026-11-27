import { expect, it } from "vitest";
import { createTandaPresentation } from "../app/src/renderer/modules/tanda-presentation";
import type { TrackRow } from "../app/src/shared/types";
import type { TandaDraft } from "../app/src/renderer/domain";

it("uses the current track metadata and retains the original slot index", () => {
  const draft: TandaDraft = {
    id: "draft", name: "", rating: 0, styles: [],
    trackSlots: [null, "missing", "track"], origin: "designer",
  };
  const tracks = new Map<string, TrackRow>();
  const presentation = createTandaPresentation({
    getTrack: (id) => tracks.get(id),
    getEffectiveTrackDurationMs: () => 120_000,
    formatTime: (seconds) => String(seconds),
    resolveNowPlayingTrackLabel: (track) => track.title,
    t: (key) => key,
  });

  expect(presentation.buildTandaDetailLines(draft)).toEqual([{ text: "tandaPlaceholder" }]);
  tracks.set("track", { id: "track", title: "Title", year: "1940" } as TrackRow);
  expect(presentation.buildTandaDetailLines(draft)).toEqual([
    { text: "Title (1940) · 120", trackId: "track", slotIndex: 2 },
  ]);
});
