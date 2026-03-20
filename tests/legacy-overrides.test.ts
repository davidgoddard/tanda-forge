import { describe, expect, it } from "vitest";

import {
  deserializeLegacyOverrides,
  serializeLegacyOverrides,
  type LegacyOverride,
} from "../app/src/shared/legacy-overrides";

describe("legacy override persistence", () => {
  it("round-trips valid overrides", () => {
    const source = new Map<string, Map<string, LegacyOverride>>([
      [
        "root-1",
        new Map([
          [
            "Artist/Track.mp3",
            {
              title: "Track",
              artist: "Artist",
              bpm: 62,
              instrumental: false,
              loudnessDb: -19.5,
              gainDb: 3.5,
            },
          ],
        ]),
      ],
    ]);

    const encoded = serializeLegacyOverrides(source);
    const decoded = deserializeLegacyOverrides(encoded);
    expect(decoded.get("root-1")?.get("Artist/Track.mp3")?.title).toBe("Track");
    expect(decoded.get("root-1")?.get("Artist/Track.mp3")?.instrumental).toBe(false);
    expect(decoded.get("root-1")?.get("Artist/Track.mp3")?.gainDb).toBeCloseTo(3.5);
  });

  it("drops malformed fields and survives invalid JSON", () => {
    const decoded = deserializeLegacyOverrides("{bad");
    expect(decoded.size).toBe(0);

    const malformed = deserializeLegacyOverrides(
      JSON.stringify({
        root: {
          "x.mp3": { title: "x", bpm: "fast", gainDb: null, instrumental: "no", noise: true },
        },
      }),
    );
    const row = malformed.get("root")?.get("x.mp3");
    expect(row?.title).toBe("x");
    expect(row?.gainDb).toBeNull();
    expect((row as Record<string, unknown>)?.instrumental).toBeUndefined();
    expect((row as Record<string, unknown>)?.noise).toBeUndefined();
    expect((row as Record<string, unknown>)?.bpm).toBeUndefined();
  });
});
