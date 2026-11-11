import { describe, expect, it } from "vitest";
import { buildTandaTrackLabel } from "../app/src/renderer/modules/tanda-track-view";

describe("tanda track view", () => {
  it("appends rounded BPM to the end of a tanda track label", () => {
    expect(buildTandaTrackLabel("La Cumparsita — Aníbal Troilo", 63.6)).toBe(
      "La Cumparsita — Aníbal Troilo · 64 bpm",
    );
  });

  it.each([null, undefined, 0, Number.NaN])(
    "omits BPM when it is not defined as a positive value (%s)",
    (bpm) => {
      expect(buildTandaTrackLabel("La Cumparsita — Aníbal Troilo", bpm)).toBe(
        "La Cumparsita — Aníbal Troilo",
      );
    },
  );
});
