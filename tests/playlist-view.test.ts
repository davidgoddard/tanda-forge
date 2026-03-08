import { describe, expect, it } from "vitest";
import {
  matchesPlaylistFilter,
  resetPlaylistLastTandaState,
  resolvePlaylistWindowMs,
} from "../app/src/renderer/modules/playlist-view";

describe("playlist view helpers", () => {
  it("computes same-day playlist window", () => {
    const ms = resolvePlaylistWindowMs({
      startInput: "20:00",
      endInput: "23:00",
      defaultStartMinutes: 20 * 60,
      defaultEndMinutes: 3 * 60,
    });
    expect(ms).toBe(3 * 60 * 60 * 1000);
  });

  it("computes overnight playlist window", () => {
    const ms = resolvePlaylistWindowMs({
      startInput: "23:00",
      endInput: "02:00",
      defaultStartMinutes: 20 * 60,
      defaultEndMinutes: 3 * 60,
    });
    expect(ms).toBe(3 * 60 * 60 * 1000);
  });

  it("uses canonical orchestra matching for orchestra-chart playlist filters", () => {
    expect(
      matchesPlaylistFilter({
        filterText: "Francisco Canaro",
        orchestraFilter: "Francisco Canaro",
        fallbackText:
          "1938 - Edgardo Donato / Francisco Canaro Instrumental / Francisco Lomuto",
        canonicalArtists: ["Edgardo Donato", "Francisco Lomuto"],
      }),
    ).toBe(false);

    expect(
      matchesPlaylistFilter({
        filterText: "Francisco Canaro",
        orchestraFilter: "Francisco Canaro",
        fallbackText: "Canaro. Easy old faves - Francisco Canaro(3) - Sung",
        canonicalArtists: ["Francisco Canaro"],
      }),
    ).toBe(true);
  });

  it("clears the persisted last-tanda flag on startup", () => {
    const calls: Array<{ key: string; value: string }> = [];
    resetPlaylistLastTandaState(
      {
        setItem: (key, value) => {
          calls.push({ key, value });
        },
      },
      "tanda-playlist-current-last",
    );

    expect(calls).toEqual([
      { key: "tanda-playlist-current-last", value: "0" },
    ]);
  });
});
