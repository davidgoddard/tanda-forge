import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listLegacyStyles,
  loadLegacyLibrary,
  normalizeLegacyTandaName,
} from "../app/src/main/legacy-import";

const tempPaths: string[] = [];

const writeLegacyFile = (payload: unknown) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-legacy-"));
  const filePath = path.join(dir, "library.dat");
  fs.writeFileSync(filePath, JSON.stringify(payload), "utf-8");
  tempPaths.push(dir);
  return filePath;
};

afterEach(() => {
  while (tempPaths.length > 0) {
    const dir = tempPaths.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("loadLegacyLibrary gain parsing", () => {
  it("accepts numeric strings and derives gain from meanGain (legacy gain is peak, not playback gain)", () => {
    const legacyPath = writeLegacyFile({
      "/music/test.mp3": {
        track: { title: "Test", artist: "Artist" },
        analysis: { meanGain: "-19.5" },
      },
      "/music/with-gain.mp3": {
        track: { title: "With Gain", artist: "Artist" },
        analysis: { meanGain: -12, gain: "-2.3" },
      },
    });

    const entries = loadLegacyLibrary(legacyPath);
    const derived = entries.get("music/test.mp3");
    const explicit = entries.get("music/with-gain.mp3");

    expect(derived?.loudnessDb).toBeCloseTo(-19.5);
    expect(derived?.gainDb).toBeCloseTo(3.5);
    expect(explicit?.loudnessDb).toBeCloseTo(-12);
    expect(explicit?.gainDb).toBeCloseTo(-4);
  });

  it("marks tracks with no classifier style as ? so legacy mappings can be applied", () => {
    const legacyPath = writeLegacyFile({
      "/music/unclassified.mp3": {
        track: { title: "Unclassified", artist: "Artist", genre: "Tango" },
      },
    });

    const entries = loadLegacyLibrary(legacyPath);
    expect(entries.get("music/unclassified.mp3")?.genre).toBe("?");
  });

  it("imports classifier instrumental, bpm, notes, style, and sub-style fields", () => {
    const legacyPath = writeLegacyFile({
      "/music/classified.mp3": {
        track: { title: "Classified", artist: "Artist" },
        classifiers: {
          style: "Tango",
          "sub-style": "Traditional",
          instrumental: false,
          notes: "LoFi Hard",
          bpm: 55,
        },
      },
      "/music/instrumental.mp3": {
        track: { title: "Instrumental", artist: "Artist" },
        classifiers: {
          style: "Milonga",
          instrumental: true,
        },
      },
    });

    const entries = loadLegacyLibrary(legacyPath);
    expect(entries.get("music/classified.mp3")).toMatchObject({
      genre: "Tango - Traditional",
      instrumental: false,
      notes: "LoFi Hard",
      bpm: 55,
    });
    expect(entries.get("music/instrumental.mp3")).toMatchObject({
      genre: "Milonga",
      instrumental: true,
    });
  });

  it("derives year from a trailing title year, including before a trailing bracket suffix, and splits semicolon artist credits into artist plus singer", () => {
    const legacyPath = writeLegacyFile({
      "/music/sung.mp3": {
        track: {
          title: "El Flete 1942",
          artist: "Carlos Di Sarli; Alberto Podesta",
        },
        classifiers: {
          instrumental: true,
          bpm: 64,
        },
      },
      "/music/plain.mp3": {
        track: {
          title: "A Media Luz",
          artist: "Edgardo Donato",
        },
        classifiers: {
          instrumental: true,
        },
      },
      "/music/bracketed.mp3": {
        track: {
          title: "Dulce Perdon (Vals) 1935 (Reliquias-flac)",
          artist: "Carlos Di Sarli",
        },
        classifiers: {
          instrumental: true,
        },
      },
      "/music/punctuated.mp3": {
        track: {
          title: "Didi 1937. (Reliquias-flac)",
          artist: "Roberto Firpo",
        },
        classifiers: {
          instrumental: true,
        },
      },
    });

    const entries = loadLegacyLibrary(legacyPath);
    expect(entries.get("music/sung.mp3")).toMatchObject({
      title: "El Flete 1942",
      artist: "Carlos Di Sarli",
      singer: "Alberto Podesta",
      year: "1942",
      bpm: 64,
      instrumental: false,
    });
    expect(entries.get("music/plain.mp3")).toMatchObject({
      artist: "Edgardo Donato",
      instrumental: true,
    });
    expect(entries.get("music/bracketed.mp3")).toMatchObject({
      title: "Dulce Perdon (Vals) 1935 (Reliquias-flac)",
      artist: "Carlos Di Sarli",
      year: "1935",
      instrumental: true,
    });
    expect(entries.get("music/punctuated.mp3")).toMatchObject({
      title: "Didi 1937. (Reliquias-flac)",
      artist: "Roberto Firpo",
      year: "1937",
      instrumental: true,
    });
  });

  it("lists distinct legacy styles with counts", () => {
    const legacyPath = writeLegacyFile({
      "/music/a.mp3": {
        track: { title: "A", artist: "Artist", genre: "Vals" },
      },
      "/music/b.mp3": {
        track: { title: "B", artist: "Artist", genre: "Vals" },
      },
      "/music/c.mp3": {
        track: { title: "C", artist: "Artist", genre: "Waltz" },
      },
      "/music/d.mp3": {
        track: { title: "D", artist: "Artist" },
        classifiers: { style: "Milonga" },
      },
      "/music/e.mp3": {
        track: { title: "E", artist: "Artist" },
        classifiers: { style: "Tango", "sub-style": "Nuevo" },
      },
    });

    const styles = listLegacyStyles(legacyPath);
    expect(styles).toEqual([
      { value: "?", normalized: "?", count: 3 },
      { value: "Milonga", normalized: "Milonga", count: 1 },
      { value: "Tango - Nuevo", normalized: "Tango - Nuevo", count: 1 },
    ]);
  });

  it("normalizes legacy auto-generated tanda names to blank", () => {
    expect(normalizeLegacyTandaName("Auto Generated Tanda")).toBe("");
    expect(normalizeLegacyTandaName(" auto generated tanda ")).toBe("");
    expect(normalizeLegacyTandaName("Saved Auto-Generated Tanda")).toBe("");
    expect(normalizeLegacyTandaName(" saved auto-generated tanda ")).toBe("");
    expect(normalizeLegacyTandaName('"Saved Auto-Generated Tanda"')).toBe("");
    expect(normalizeLegacyTandaName("Saved Auto Generated Tanda")).toBe("");
    expect(normalizeLegacyTandaName("Saved Auto–Generated Tanda")).toBe("");
    expect(normalizeLegacyTandaName("My Custom Tanda")).toBe("My Custom Tanda");
    expect(normalizeLegacyTandaName("")).toBe("");
  });
});
