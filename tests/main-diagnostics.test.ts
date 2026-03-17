import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  appendLogEntry,
  getDiagnosticsPaths,
  PLAYBACK_DIAGNOSTIC_LOG,
  readLogTail,
} from "../app/src/main/diagnostics.js";

const createDataPaths = (root: string) => () => ({
  root,
  dbPath: path.join(root, "tanda-player.db"),
  waveformsDir: path.join(root, "waveforms"),
  compressedCacheDir: path.join(root, "compressed-audio-cache"),
  logDir: root,
});

describe("main diagnostics helpers", () => {
  it("reports diagnostics paths from the active data root", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-diag-"));
    const paths = getDiagnosticsPaths(createDataPaths(root), "/ffmpeg", "/ffprobe");
    expect(paths).toEqual({
      userData: root,
      waveformsDir: path.join(root, "waveforms"),
      compressedCacheDir: path.join(root, "compressed-audio-cache"),
      ffmpegPath: "/ffmpeg",
      ffprobePath: "/ffprobe",
      playbackLogPath: path.join(root, PLAYBACK_DIAGNOSTIC_LOG),
    });
  });

  it("appends and tails diagnostics log entries", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-diag-"));
    const getPaths = createDataPaths(root);
    appendLogEntry(getPaths, PLAYBACK_DIAGNOSTIC_LOG, ["one", "two"]);
    appendLogEntry(getPaths, PLAYBACK_DIAGNOSTIC_LOG, ["three"]);
    const result = readLogTail(getPaths, PLAYBACK_DIAGNOSTIC_LOG, 2);
    expect(result.lines).toEqual(["two", "three"]);
    expect(result.path).toBe(path.join(root, PLAYBACK_DIAGNOSTIC_LOG));
  });
});
