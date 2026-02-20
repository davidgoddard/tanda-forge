import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { loadLegacyLibrary } from "../app/src/main/legacy-import";

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
  it("accepts numeric strings and derives gain when only meanGain exists", () => {
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
    expect(explicit?.gainDb).toBeCloseTo(-2.3);
  });
});
