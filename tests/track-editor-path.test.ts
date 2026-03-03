import { describe, expect, it } from "vitest";
import { resolveTrackEditorPathLines } from "../app/src/renderer/track-editor-path";

describe("track editor path lines", () => {
  it("shows only original path when compression is disabled", () => {
    expect(
      resolveTrackEditorPathLines({
        originalPath: "/music/a.mp3",
        compressionEnabled: false,
        compressedPath: "/cache/a.wav",
        compressedLabel: "Compressed:",
        pendingLabel: "(pending)",
      }),
    ).toEqual({
      originalLine: "/music/a.mp3",
      compressedLine: "",
    });
  });

  it("shows compressed path when compression is enabled and available", () => {
    expect(
      resolveTrackEditorPathLines({
        originalPath: "/music/a.mp3",
        compressionEnabled: true,
        compressedPath: "/cache/a.wav",
        compressedLabel: "Compressed:",
        pendingLabel: "(pending)",
      }),
    ).toEqual({
      originalLine: "/music/a.mp3",
      compressedLine: "Compressed: /cache/a.wav",
    });
  });

  it("shows pending marker when compression is enabled but not available", () => {
    expect(
      resolveTrackEditorPathLines({
        originalPath: "/music/a.mp3",
        compressionEnabled: true,
        compressedPath: null,
        compressedLabel: "Compressed:",
        pendingLabel: "(pending)",
      }),
    ).toEqual({
      originalLine: "/music/a.mp3",
      compressedLine: "Compressed: (pending)",
    });
  });
});
