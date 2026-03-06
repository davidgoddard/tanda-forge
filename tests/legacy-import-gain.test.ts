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
