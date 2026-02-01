import { describe, expect, it } from "vitest";
import { DEFAULT_CORTINA_SET_ID, getCortinaSetName } from "../app/src/shared/cortina-utils";

describe("getCortinaSetName", () => {
  it("uses first folder when relative path has a subfolder", () => {
    expect(getCortinaSetName("salsa/track.mp3")).toBe("salsa");
    expect(getCortinaSetName("salsa/sub/track.mp3")).toBe("salsa");
  });

  it("uses default set when cortina file sits at root", () => {
    expect(getCortinaSetName("track.mp3")).toBe(DEFAULT_CORTINA_SET_ID);
  });

  it("falls back to root label when no relative path", () => {
    expect(getCortinaSetName("", "My Cortinas")).toBe("My Cortinas");
  });

  it("falls back to root path name when no relative path or label", () => {
    expect(getCortinaSetName("", undefined, "/Volumes/Cortinas"))
      .toBe("Cortinas");
  });
});
