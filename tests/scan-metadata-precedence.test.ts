import { describe, expect, it } from "vitest";
import { resolveScannedTrackMetadata } from "../app/src/main/library/scan";

describe("resolveScannedTrackMetadata", () => {
  const styleMap = new Map([
    ["tango", "Tango"],
    ["milonga", "Milonga"],
  ]);

  it("preserves stored editable metadata on rescan for existing tracks", () => {
    const result = resolveScannedTrackMetadata({
      filePath: "/music/Tango/song-a.mp3",
      existing: {
        title: "Stored Title",
        artist: "Stored Artist",
        album: "Stored Album",
        year: "1941",
        genre: "Tango - Nuevo",
        singer: "Stored Singer",
        notes: "Stored Notes",
        instrumental: 0,
        bpm: 64,
      },
      tags: {
        title: "Tag Title",
        artist: "Tag Artist",
        album: "Tag Album",
        year: "1938",
        genre: "Milonga",
        singer: "Tag Singer",
      },
      legacy: null,
      styleMap,
    });

    expect(result).toMatchObject({
      title: "Stored Title",
      artist: "Stored Artist",
      album: "Stored Album",
      year: "1941",
      genre: "Tango - Nuevo",
      singer: "Stored Singer",
      notes: "Stored Notes",
      instrumental: false,
      bpm: 64,
    });
  });

  it("imports tag metadata for new tracks", () => {
    const result = resolveScannedTrackMetadata({
      filePath: "/music/Tango/song-b.mp3",
      tags: {
        title: "Tag Title",
        artist: "Tag Artist",
        album: "Tag Album",
        year: "1938",
        genre: "Milonga",
        singer: "Tag Singer",
      },
      legacy: null,
      styleMap,
    });

    expect(result).toMatchObject({
      title: "Tag Title",
      artist: "Tag Artist",
      album: "Tag Album",
      year: "1938",
      genre: "Milonga",
      singer: "Tag Singer",
    });
  });
});
