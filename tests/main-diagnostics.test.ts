import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  appendLogEntry,
  getDiagnosticsDataReadiness,
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
    const paths = getDiagnosticsPaths(
      createDataPaths(root),
      { path: "/ffmpeg", source: "bundled" },
      { path: "/ffprobe", source: "path" },
      "/custom/tools",
    );
    expect(paths).toEqual({
      userData: root,
      waveformsDir: path.join(root, "waveforms"),
      compressedCacheDir: path.join(root, "compressed-audio-cache"),
      ffmpegPath: "/ffmpeg",
      ffmpegSource: "bundled",
      ffprobePath: "/ffprobe",
      ffprobeSource: "path",
      ffmpegToolsDir: "/custom/tools",
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

  it("reports suspiciously short and aggressively trimmed tracks", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-diag-"));
    const summary = getDiagnosticsDataReadiness(
      {
        prepare: () => ({
          all: () => [
            {
              id: "track-short",
              title: "Short Song",
              full_path: path.join(root, "music", "short.mp3"),
              relative_path: "Tango/short.mp3",
              loudness_db: -14,
              root_path: path.join(root, "music"),
              root_kind: "music",
              duration_ms: 42000,
              start_offset_ms: 0,
              end_trim_ms: 0,
              gain_db: -1,
              tag_error: "",
              analysis_error: "",
            },
            {
              id: "track-trimmed",
              title: "Trimmed Song",
              full_path: path.join(root, "music", "trimmed.mp3"),
              relative_path: "Tango/trimmed.mp3",
              loudness_db: -14,
              root_path: path.join(root, "music"),
              root_kind: "music",
              duration_ms: 180000,
              start_offset_ms: 5000,
              end_trim_ms: 22000,
              gain_db: -1,
              tag_error: "",
              analysis_error: "",
            },
          ],
        }),
      },
      createDataPaths(root),
    );

    expect(summary.shortDurationTracks).toEqual([
      {
        id: "track-short",
        title: "Short Song",
        relativePath: "Tango/short.mp3",
        durationMs: 42000,
        effectiveDurationMs: 42000,
        removedMs: 0,
      },
    ]);
    expect(summary.aggressivelyTrimmedTracks).toEqual([
      {
        id: "track-trimmed",
        title: "Trimmed Song",
        relativePath: "Tango/trimmed.mp3",
        durationMs: 180000,
        effectiveDurationMs: 153000,
        removedMs: 27000,
      },
    ]);
    expect(summary.compressedEligible).toBe(2);
    expect(summary.compressedReady).toBe(0);
    expect(summary.compressedMissing).toBe(0);
    expect(summary.compressedInvalidSource).toBe(2);
  });
});
