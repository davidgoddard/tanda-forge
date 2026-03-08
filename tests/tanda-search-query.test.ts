import { describe, expect, it } from "vitest";
import {
  buildTandaSearchQuery,
  resolveTrackSearchStyles,
  resolveTandaSearchStyles,
} from "../app/src/shared/tanda-search";

describe("tanda search helpers", () => {
  it("builds a tanda query with artists, years, bpms, and name", () => {
    const query = buildTandaSearchQuery({
      name: "Golden Vals",
      tracks: [
        {
          artist: "Francisco Canaro",
          artist_summary: "Canaro",
          year: "1939,1940",
          bpm: 62.7,
        },
        {
          artist: "Juan D'Arienzo",
          year: "1942",
          bpm: 64,
        },
      ],
    });
    expect(query).toContain("Canaro");
    expect(query).toContain("1939");
    expect(query).toContain("1940");
    expect(query).toContain("63");
    expect(query).toContain("Golden Vals");
  });

  it("resolves explicit styles before derived styles", () => {
    const styles = resolveTandaSearchStyles({
      tandaStyles: ["Waltz"],
      tracks: [{ genre: "Milonga" }],
      availableStyles: ["Tango", "Waltz", "Milonga"],
    });
    expect(styles).toEqual(["Waltz"]);
  });

  it("derives styles from tracks when no explicit styles", () => {
    const styles = resolveTandaSearchStyles({
      tandaStyles: [],
      tracks: [{ genre: "Milonga" }],
      availableStyles: ["Tango", "Waltz", "Milonga"],
    });
    expect(styles).toEqual(["Milonga"]);
  });

  it("preserves exact track style variants for track similarity searches", () => {
    const styles = resolveTrackSearchStyles({
      trackStyle: "Tango - Traditional",
      availableStyles: ["Tango", "Tango - Traditional", "Tango - Alternative"],
    });
    expect(styles).toEqual(["Tango - Traditional"]);
  });

  it("returns empty styles when track style is blank", () => {
    const styles = resolveTrackSearchStyles({
      trackStyle: "",
      availableStyles: ["Tango"],
    });
    expect(styles).toEqual([]);
  });
});
