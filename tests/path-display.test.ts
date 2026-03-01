import { describe, expect, it } from "vitest";

import { basenameForDisplay } from "../app/src/shared/path-display";

describe("basenameForDisplay", () => {
  it("returns the filename for unix-style paths", () => {
    expect(basenameForDisplay("/music/tango/track.mp3")).toBe("track.mp3");
  });

  it("returns the filename for windows-style paths", () => {
    expect(basenameForDisplay("C:\\music\\cortinas\\cortina.flac")).toBe("cortina.flac");
  });

  it("handles whitespace and trailing separators", () => {
    expect(basenameForDisplay("  /music/folder/  ")).toBe("folder");
    expect(basenameForDisplay("")).toBe("");
  });
});
