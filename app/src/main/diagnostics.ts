import fs from "fs";
import os from "os";
import path from "path";
import { hasUsableCompressedRender, hasUsableWaveformPng } from "./library/analysis";
import {
  auditCompressionReadiness,
  listCompressionEligibleTracks,
} from "./library/compression-readiness";
import { DEFAULT_COMPRESSION_RENDER_PROFILE } from "../shared/audio-compression";

type DataPaths = {
  root: string;
  dbPath: string;
  waveformsDir: string;
  compressedCacheDir: string;
  logDir: string;
};

type DbLike = {
  prepare: (sql: string) => {
    all: () => unknown[];
  };
};

const SHORT_TRACK_DURATION_MS = 60_000;
const AGGRESSIVE_TRIM_REMOVED_MS = 20_000;

type SuspiciousTrackLength = {
  id: string;
  title: string;
  relativePath: string;
  durationMs: number;
  effectiveDurationMs: number;
  removedMs: number;
};

export const RENDERER_ERROR_LOG = "renderer-errors.log";
export const PLAYBACK_DIAGNOSTIC_LOG = "playback-diagnostics.log";
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const KEEP_LOG_BYTES = 4 * 1024 * 1024;

export const appendLogEntry = (
  getDataPaths: () => DataPaths,
  logName: string,
  lines: string[],
) => {
  const { logDir } = getDataPaths();
  const logPath = path.join(logDir, logName);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  try {
    const currentSize = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;
    if (currentSize > MAX_LOG_BYTES) {
      const handle = fs.openSync(logPath, "r");
      const start = Math.max(0, currentSize - KEEP_LOG_BYTES);
      const buffer = Buffer.allocUnsafe(currentSize - start);
      fs.readSync(handle, buffer, 0, buffer.length, start);
      fs.closeSync(handle);
      fs.writeFileSync(logPath, buffer);
    }
  } catch {
    // Best-effort log rotation only.
  }
  fs.appendFileSync(logPath, `${lines.join(os.EOL)}${os.EOL}`);
  return logPath;
};

export const clearDiagnosticsLogs = (getDataPaths: () => DataPaths) => {
  const { logDir } = getDataPaths();
  [RENDERER_ERROR_LOG, PLAYBACK_DIAGNOSTIC_LOG].forEach((logFile) => {
    try {
      const logPath = path.join(logDir, logFile);
      if (fs.existsSync(logPath)) {
        fs.unlinkSync(logPath);
      }
    } catch {
      // Best-effort log clear should not throw.
    }
  });
};

export const readLogTail = (
  getDataPaths: () => DataPaths,
  logName: string,
  limit: number,
) => {
  const safeLimit = Number.isFinite(limit) ? Math.min(500, Math.max(1, limit)) : 200;
  const { logDir } = getDataPaths();
  const logPath = path.join(logDir, logName);
  if (!fs.existsSync(logPath)) {
    return { path: logPath, lines: [] as string[] };
  }
  const raw = fs.readFileSync(logPath, "utf-8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(-safeLimit);
  return { path: logPath, lines };
};

export const getDiagnosticsPaths = (
  getDataPaths: () => DataPaths,
  ffmpeg: { path: string; source: "bundled" | "override" | "path" },
  ffprobe: { path: string; source: "bundled" | "override" | "path" },
  ffmpegToolsDir: string | null,
) => {
  const paths = getDataPaths();
  return {
    userData: paths.root,
    waveformsDir: paths.waveformsDir,
    compressedCacheDir: paths.compressedCacheDir,
    ffmpegPath: ffmpeg.path,
    ffmpegSource: ffmpeg.source,
    ffprobePath: ffprobe.path,
    ffprobeSource: ffprobe.source,
    ffmpegToolsDir: ffmpegToolsDir ?? "",
    playbackLogPath: path.join(paths.logDir, PLAYBACK_DIAGNOSTIC_LOG),
  };
};

export const verifyCachedFiles = (db: DbLike, getDataPaths: () => DataPaths) => {
  const { waveformsDir, compressedCacheDir } = getDataPaths();
  const validTrackIds = new Set(
    (db.prepare("select id from tracks").all() as Array<{ id: string }>).map((row) => row.id),
  );
  let waveformFiles = 0;
  let waveformRemoved = 0;
  try {
    if (fs.existsSync(waveformsDir)) {
      fs.readdirSync(waveformsDir, { withFileTypes: true }).forEach((entry) => {
        if (!entry.isFile()) {
          return;
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (ext !== ".png") {
          return;
        }
        waveformFiles += 1;
        const fullPath = path.join(waveformsDir, entry.name);
        const trackId = path.basename(entry.name, ext);
        if (!validTrackIds.has(trackId) || !hasUsableWaveformPng(fullPath)) {
          fs.rmSync(fullPath, { force: true });
          waveformRemoved += 1;
        }
      });
    }
  } catch {
    // Best-effort verification.
  }

  let compressedFiles = 0;
  let compressedRemoved = 0;
  try {
    if (fs.existsSync(compressedCacheDir)) {
      fs.readdirSync(compressedCacheDir, { withFileTypes: true }).forEach((entry) => {
        if (!entry.isFile()) {
          return;
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (ext !== ".wav") {
          return;
        }
        compressedFiles += 1;
        const fullPath = path.join(compressedCacheDir, entry.name);
        if (!hasUsableCompressedRender(fullPath)) {
          fs.rmSync(fullPath, { force: true });
          compressedRemoved += 1;
        }
      });
    }
  } catch {
    // Best-effort verification.
  }

  return {
    ok: true,
    waveformFiles,
    waveformRemoved,
    compressedFiles,
    compressedRemoved,
    ...auditCompressionReadiness(
      compressedCacheDir,
      listCompressionEligibleTracks(db),
      DEFAULT_COMPRESSION_RENDER_PROFILE,
    ),
  };
};

export const getDiagnosticsDataReadiness = (db: DbLike, getDataPaths: () => DataPaths) => {
  const rows = db
    .prepare(
      `select t.id, t.title, t.relative_path, t.duration_ms, t.start_offset_ms, t.end_trim_ms, t.loudness_db, t.gain_db,
          t.tag_error, t.analysis_error
       from tracks t
       join library_roots r on r.id = t.root_id
       where r.kind = 'music'`,
    )
    .all() as {
    id: string;
    title?: string | null;
    relative_path?: string | null;
    duration_ms?: number | null;
    start_offset_ms?: number | null;
    end_trim_ms?: number | null;
    loudness_db?: number | null;
    gain_db?: number | null;
    tag_error?: string | null;
    analysis_error?: string | null;
  }[];
  const { waveformsDir } = getDataPaths();
  const waveformTrackIds = new Set<string>();
  try {
    if (fs.existsSync(waveformsDir)) {
      fs.readdirSync(waveformsDir, { withFileTypes: true }).forEach((entry) => {
        if (!entry.isFile()) {
          return;
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (ext !== ".png") {
          return;
        }
        waveformTrackIds.add(path.basename(entry.name, ext));
      });
    }
  } catch {
    // Ignore read errors and report waveform availability as missing.
  }
  let missingDuration = 0;
  let missingLoudness = 0;
  let missingTrimSignals = 0;
  let analysisErrors = 0;
  let missingWaveforms = 0;
  const compressedReadiness = auditCompressionReadiness(
    getDataPaths().compressedCacheDir,
    listCompressionEligibleTracks(db),
    DEFAULT_COMPRESSION_RENDER_PROFILE,
  );
  const shortDurationTracks: SuspiciousTrackLength[] = [];
  const aggressivelyTrimmedTracks: SuspiciousTrackLength[] = [];
  rows.forEach((row) => {
    const durationMs =
      typeof row.duration_ms === "number" && Number.isFinite(row.duration_ms) ? row.duration_ms : 0;
    if (durationMs <= 0) {
      missingDuration += 1;
    }
    const hasLoudness =
      typeof row.loudness_db === "number" && Number.isFinite(row.loudness_db);
    const hasGain = typeof row.gain_db === "number" && Number.isFinite(row.gain_db);
    if (!hasLoudness && !hasGain) {
      missingLoudness += 1;
    }
    const startOffsetMs =
      typeof row.start_offset_ms === "number" && Number.isFinite(row.start_offset_ms)
        ? row.start_offset_ms
        : 0;
    const endTrimMs =
      typeof row.end_trim_ms === "number" && Number.isFinite(row.end_trim_ms)
        ? row.end_trim_ms
        : 0;
    const effectiveDurationMs = Math.max(0, durationMs - startOffsetMs - endTrimMs);
    const removedMs = Math.max(0, durationMs - effectiveDurationMs);
    if (startOffsetMs <= 0 && endTrimMs <= 0) {
      missingTrimSignals += 1;
    }
    if ((row.tag_error ?? "").trim() || (row.analysis_error ?? "").trim()) {
      analysisErrors += 1;
    }
    if (!waveformTrackIds.has(row.id)) {
      missingWaveforms += 1;
    }
    const suspiciousTrack = {
      id: row.id,
      title: row.title?.trim() || "(untitled)",
      relativePath: row.relative_path?.trim() || row.id,
      durationMs,
      effectiveDurationMs,
      removedMs,
    };
    if (durationMs > 0 && durationMs < SHORT_TRACK_DURATION_MS) {
      shortDurationTracks.push(suspiciousTrack);
    }
    if (removedMs >= AGGRESSIVE_TRIM_REMOVED_MS) {
      aggressivelyTrimmedTracks.push(suspiciousTrack);
    }
  });
  return {
    totalTracks: rows.length,
    missingDuration,
    missingLoudness,
    missingTrimSignals,
    analysisErrors,
    missingWaveforms,
    compressedEligible: compressedReadiness.eligible,
    compressedReady: compressedReadiness.ready,
    compressedMissing: compressedReadiness.missing,
    compressedInvalidSource: compressedReadiness.invalidSource,
    missingCompressedTracks: compressedReadiness.tracks
      .filter((track) => track.status !== "ready")
      .map((track) => ({
        id: track.trackId,
        relativePath: track.relativePath,
        rootKind: track.rootKind,
        status: track.status,
      })),
    shortDurationTracks,
    aggressivelyTrimmedTracks,
  };
};
