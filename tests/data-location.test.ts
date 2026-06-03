import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

vi.mock("electron", () => ({
  app: {
    getPath: () => "",
  },
}));

import { getDataPaths, resolveLegacyDataRoot } from "../app/src/main/data-location.js";

const writeJson = (filePath: string, data: unknown) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

describe("resolveLegacyDataRoot", () => {
  it("returns configured legacy data root when it exists", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-lite-"));
    const legacyUserData = path.join(tmp, "Tanda Player 2");
    const dataRoot = path.join(tmp, "custom", "_tp_data");
    fs.mkdirSync(dataRoot, { recursive: true });
    writeJson(path.join(legacyUserData, "tanda-player-config.json"), {
      dataRoot,
    });
    expect(resolveLegacyDataRoot(tmp)).toBe(dataRoot);
  });

  it("falls back to legacy userData when database exists", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-lite-"));
    const legacyUserData = path.join(tmp, "Tanda Player 2");
    fs.mkdirSync(legacyUserData, { recursive: true });
    fs.writeFileSync(path.join(legacyUserData, "tanda-player.db"), "");
    expect(resolveLegacyDataRoot(tmp)).toBe(legacyUserData);
  });

  it("uses legacy userData when config root is missing but db exists", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-lite-"));
    const legacyUserData = path.join(tmp, "Tanda Player 2");
    writeJson(path.join(legacyUserData, "tanda-player-config.json"), {
      dataRoot: path.join(tmp, "missing"),
    });
    fs.mkdirSync(legacyUserData, { recursive: true });
    fs.writeFileSync(path.join(legacyUserData, "tanda-player.db"), "");
    expect(resolveLegacyDataRoot(tmp)).toBe(legacyUserData);
  });

  it("includes render caches under the active data root", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-lite-"));
    process.env.TANDA_DATA_ROOT = tmp;
    try {
      expect(getDataPaths()).toEqual({
        root: tmp,
        dbPath: path.join(tmp, "tanda-player.db"),
        waveformsDir: path.join(tmp, "waveforms"),
        compressedCacheDir: path.join(tmp, "compressed-audio-cache"),
        playableCacheDir: path.join(tmp, "playable-audio-cache"),
        logDir: tmp,
      });
    } finally {
      delete process.env.TANDA_DATA_ROOT;
    }
  });
});
