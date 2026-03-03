import { describe, expect, it } from "vitest";
import { resolvePlaylistWindowMs } from "../app/src/renderer/modules/playlist-view";

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
});
