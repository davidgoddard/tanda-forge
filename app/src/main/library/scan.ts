import { createHash, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import {
  ANALYSIS_PIPELINE_VERSION,
  analyzeTrack,
  hasUsableWaveformPng,
  readTrackMetadata,
  renderWaveformPng,
  type TagResult,
  type TrackAnalysis,
} from "./analysis";
import {
  extractSingerName,
  normalizeStyleName,
  summarizeArtistName,
} from "../../shared/tanda-utils";
import { getDb } from "../db";
import type { LegacyTrackOverride } from "../legacy-import";

export type LibraryRoot = {
  id: string;
  path: string;
  kind: "music" | "cortina" | "background";
  label: string;
};

export type ScanSummary = {
  scanned: number;
  added: number;
  updated: number;
  removed: number;
  errors: { filePath: string; message: string }[];
};

export type ScanProgress = {
  current: number;
  total: number;
  filePath: string;
  rootLabel: string;
  errors: number;
};

type ExistingTrackAnalysisState = {
  file_size?: number;
  file_mtime_ms?: number;
  duration_ms?: number;
  start_offset_ms?: number;
  end_trim_ms?: number;
  tag_error?: string;
  analysis_error?: string;
  tag_json?: string;
  analysis_json?: string;
};

const isLegacyImportAnalysis = (analysisJson: string) => {
  try {
    const parsed = JSON.parse(analysisJson) as { source?: string };
    return parsed.source === "legacy-import";
  } catch {
    return false;
  }
};

const hasCurrentAnalysisPipeline = (analysisJson: string) => {
  try {
    const parsed = JSON.parse(analysisJson) as { pipelineVersion?: unknown };
    return parsed.pipelineVersion === ANALYSIS_PIPELINE_VERSION;
  } catch {
    return false;
  }
};

export const shouldReuseUnchangedAnalysis = (
  existing: ExistingTrackAnalysisState | undefined,
  stat: { size: number; mtimeMs: number },
) => {
  if (!existing) {
    return false;
  }
  if (existing.file_size !== stat.size) {
    return false;
  }
  if (existing.file_mtime_ms !== Math.floor(stat.mtimeMs)) {
    return false;
  }
  if (existing.tag_error || existing.analysis_error) {
    return false;
  }
  if (!existing.tag_json || !existing.analysis_json) {
    return false;
  }
  if (isLegacyImportAnalysis(existing.analysis_json)) {
    return false;
  }
  if (!hasCurrentAnalysisPipeline(existing.analysis_json)) {
    return false;
  }
  const durationMs = existing.duration_ms ?? 0;
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return false;
  }
  const startOffsetMs = existing.start_offset_ms ?? 0;
  const endTrimMs = existing.end_trim_ms ?? 0;
  if (
    !Number.isFinite(startOffsetMs) ||
    startOffsetMs < 0 ||
    !Number.isFinite(endTrimMs) ||
    endTrimMs < 0
  ) {
    return false;
  }
  return true;
};

const audioExtensions = new Set([
  ".mp3",
  ".m4a",
  ".flac",
  ".wav",
  ".aac",
  ".ogg",
  ".aif",
  ".aiff",
]);

const walkFiles = async (rootPath: string): Promise<string[]> => {
  const entries = await fs.promises.readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name.startsWith("._")) {
      continue;
    }
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (audioExtensions.has(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
};

const hashFile = async (filePath: string) => {
  const hash = createHash("sha1");
  const stream = fs.createReadStream(filePath);
  return new Promise<string>((resolve, reject) => {
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
};

export const scanLibraryRoots = async (
  roots: LibraryRoot[],
  onProgress?: (progress: ScanProgress) => void,
  options?: {
    waveformsDir?: string;
    getLegacyMetadata?: (
      root: LibraryRoot,
      relativePath: string,
    ) => LegacyTrackOverride | null;
  },
): Promise<ScanSummary> => {
  const db = getDb();
  const now = new Date().toISOString();
  const waveformsDir = options?.waveformsDir;
  if (waveformsDir) {
    try {
      await fs.promises.mkdir(waveformsDir, { recursive: true });
    } catch {
      // Ignore; waveform generation will fail per-file if we can't create the dir.
    }
  }
  const styleRows = db
    .prepare("select name, normalized from styles")
    .all() as { name: string; normalized: string }[];
  const styleMap = new Map(
    styleRows.map((row) => [row.normalized.toLowerCase(), row.name]),
  );
  const styleAliasRows = db
    .prepare("select style_name, alias_normalized from style_aliases")
    .all() as { style_name: string; alias_normalized: string }[];
  styleAliasRows.forEach((row) => {
    styleMap.set(row.alias_normalized.toLowerCase(), row.style_name);
  });
  let scanned = 0;
  let added = 0;
  let updated = 0;
  let removed = 0;
  const errors: { filePath: string; message: string }[] = [];

  const insertStmt = db.prepare(`
    insert into tracks (
      id, root_id, relative_path, full_path, file_hash, file_size, file_mtime_ms,
      title, artist, artist_summary, singer, album, year, genre, bpm, notes, instrumental, duration_ms,
      start_offset_ms, end_trim_ms, loudness_db, gain_db, tag_error, analysis_error, tag_json,
      analysis_json, created_at, updated_at, last_scanned_at
    ) values (
      @id, @root_id, @relative_path, @full_path, @file_hash, @file_size,
      @file_mtime_ms, @title, @artist, @artist_summary, @singer, @album, @year, @genre,
      @bpm, @notes, @instrumental, @duration_ms, @start_offset_ms, @end_trim_ms, @loudness_db, @gain_db,
      @tag_error, @analysis_error, @tag_json, @analysis_json, @created_at,
      @updated_at, @last_scanned_at
    )
    on conflict(root_id, relative_path) do update set
      file_hash=excluded.file_hash,
      file_size=excluded.file_size,
      file_mtime_ms=excluded.file_mtime_ms,
      title=excluded.title,
      artist=excluded.artist,
      artist_summary=excluded.artist_summary,
      singer=excluded.singer,
      album=excluded.album,
      year=excluded.year,
      genre=excluded.genre,
      bpm=excluded.bpm,
      notes=excluded.notes,
      instrumental=excluded.instrumental,
      duration_ms=excluded.duration_ms,
      start_offset_ms=excluded.start_offset_ms,
      end_trim_ms=excluded.end_trim_ms,
      loudness_db=excluded.loudness_db,
      gain_db=excluded.gain_db,
      tag_error=excluded.tag_error,
      analysis_error=excluded.analysis_error,
      tag_json=excluded.tag_json,
      analysis_json=excluded.analysis_json,
      updated_at=excluded.updated_at,
      last_scanned_at=excluded.last_scanned_at
  `);

  const existsStmt = db.prepare(
    `select id, file_hash, file_size, file_mtime_ms, title, artist, artist_summary, singer,
      album, year, genre, bpm, notes, instrumental, duration_ms, start_offset_ms, end_trim_ms,
      loudness_db, gain_db, tag_error, analysis_error, tag_json, analysis_json
     from tracks where root_id = ? and relative_path = ?`,
  );

  const touchStmt = db.prepare(
    "update tracks set last_scanned_at = ? where root_id = ? and relative_path = ?",
  );

  let total = 0;
  const rootFiles: { root: LibraryRoot; files: string[] }[] = [];
  for (const root of roots) {
    if (!fs.existsSync(root.path)) {
      errors.push({
        filePath: root.path,
        message: "Library root not available",
      });
      rootFiles.push({ root, files: [] });
      continue;
    }
    const files = await walkFiles(root.path);
    total += files.length;
    rootFiles.push({ root, files });
  }

  for (const { root, files } of rootFiles) {
    const seen = new Set<string>();
    for (const filePath of files) {
      scanned += 1;
      const relativePath = path.relative(root.path, filePath);
      seen.add(relativePath);
      try {
        const stat = await fs.promises.stat(filePath);
        let tags: Record<string, string> = {};
        let tagError = "";
        const common = {
          title: "",
          artist: "",
          album: "",
          albumartist: "",
          year: undefined as number | undefined,
          date: undefined as string | undefined,
          genre: undefined as string[] | string | undefined,
        };

        const existing = existsStmt.get(root.id, relativePath) as
          | {
              id: string;
              file_hash?: string;
              file_size?: number;
              file_mtime_ms?: number;
              title?: string;
              artist?: string;
              artist_summary?: string;
              singer?: string;
              album?: string;
              year?: string;
              genre?: string;
              bpm?: number | null;
              notes?: string;
              instrumental?: number | null;
              duration_ms?: number;
              start_offset_ms?: number;
              end_trim_ms?: number;
              loudness_db?: number | null;
              gain_db?: number | null;
              tag_error?: string;
              analysis_error?: string;
              tag_json?: string;
              analysis_json?: string;
            }
          | undefined;

        const trackId = existing?.id ?? randomUUID();
        const unchanged = shouldReuseUnchangedAnalysis(existing, stat);

        const existingAnalysis: TrackAnalysis = {
          durationMs: existing?.duration_ms ?? 0,
          startOffsetMs: existing?.start_offset_ms ?? 0,
          endTrimMs: existing?.end_trim_ms ?? 0,
          loudnessDb: existing?.loudness_db ?? undefined,
          gainDb: existing?.gain_db ?? undefined,
          error: existing?.analysis_error ?? "",
        };
        const parseExistingTags = () => {
          if (!existing?.tag_json) {
            return {};
          }
          try {
            return JSON.parse(existing.tag_json) as Record<string, string>;
          } catch {
            return {};
          }
        };
        const tagPromise: Promise<TagResult & { durationMs?: number }> = unchanged
          ? Promise.resolve({
              tags: parseExistingTags(),
              durationMs: existingAnalysis.durationMs,
              error: existing?.tag_error ?? undefined,
            })
          : readTrackMetadata(filePath);
        const analysisPromise: Promise<TrackAnalysis> = unchanged
          ? Promise.resolve(existingAnalysis)
          : tagPromise.then((metadata) => analyzeTrack(filePath, metadata.durationMs));
        const waveformPath = waveformsDir ? path.join(waveformsDir, `${trackId}.png`) : "";
        if (waveformsDir && waveformPath && !hasUsableWaveformPng(waveformPath)) {
          fs.rmSync(waveformPath, { force: true });
        }
        const waveformPromise: Promise<void> =
          waveformsDir && waveformPath && !hasUsableWaveformPng(waveformPath)
            ? renderWaveformPng(filePath, waveformPath)
            : Promise.resolve();
        const [tagSettled, analysisSettled, waveformSettled] =
          await Promise.allSettled([tagPromise, analysisPromise, waveformPromise]);

        if (tagSettled.status === "fulfilled") {
          tags = tagSettled.value.tags ?? {};
          if (tagSettled.value.error) {
            tagError = tagSettled.value.error;
          }
        } else {
          tags = {};
          tagError =
            tagSettled.reason instanceof Error
              ? tagSettled.reason.message
              : "Tag read failed";
        }

        let analysis: TrackAnalysis = existingAnalysis;
        if (analysisSettled.status === "fulfilled") {
          analysis = analysisSettled.value;
        } else {
          const analysisFailure =
            analysisSettled.reason instanceof Error
              ? analysisSettled.reason.message
              : "Analysis failed";
          analysis = { ...existingAnalysis, error: analysisFailure };
        }
        const analysisError = analysis.error ?? "";

        if (waveformSettled.status === "rejected") {
          errors.push({
            filePath,
            message: `Waveform: ${
              waveformSettled.reason instanceof Error
                ? waveformSettled.reason.message
                : "Waveform failed"
            }`,
          });
        }

        const legacy =
          options?.getLegacyMetadata?.(root, relativePath) ?? null;
        const title =
          legacy?.title?.trim() ||
          tags.title ||
          existing?.title ||
          path.basename(filePath, path.extname(filePath));
        const artist = legacy?.artist?.trim() || tags.artist || existing?.artist || "";
        const album = legacy?.album?.trim() || tags.album || existing?.album || "";
        const year =
          legacy?.year?.trim() ||
          tags.year ||
          (tags.date ? new Date(tags.date).getFullYear().toString() : "") ||
          existing?.year ||
          "";
        const rawGenre =
          legacy?.genre?.trim() || tags.genre || existing?.genre || "";
        const genreNormalized = normalizeStyleName(rawGenre);
        const genre = genreNormalized
          ? styleMap.get(genreNormalized.toLowerCase()) ?? ""
          : "";
        const bpm =
          typeof legacy?.bpm === "number"
            ? legacy.bpm
            : existing?.bpm ?? null;
        const notes = legacy?.notes?.trim() || existing?.notes || "";
        const instrumental =
          typeof legacy?.instrumental === "boolean"
            ? legacy.instrumental
            : existing?.instrumental === null || existing?.instrumental === undefined
              ? null
              : Boolean(existing.instrumental);
        const artistSummary = summarizeArtistName(artist);
        const singerFromTags =
          tags.singer ||
          tags.performer ||
          tags.vocalist ||
          tags["lead_performer"] ||
          tags["lead performer"] ||
          tags.soloist ||
          "";
        const singer =
          existing?.singer || singerFromTags || extractSingerName(artist, title);

        const needsMetadataUpdate =
          !existing ||
          existing.title !== title ||
          existing.artist !== artist ||
          existing.album !== album ||
          existing.year !== year ||
          existing.genre !== genre ||
          existing.bpm !== bpm ||
          existing.notes !== notes ||
          (existing?.instrumental === null || existing?.instrumental === undefined
            ? null
            : Boolean(existing.instrumental)) !== instrumental ||
          existing.artist_summary !== artistSummary ||
          existing.singer !== singer;

        if (unchanged && !needsMetadataUpdate) {
          touchStmt.run(now, root.id, relativePath);
          updated += 1;
        } else {
          const fileHash = unchanged
            ? existing?.file_hash ?? (await hashFile(filePath))
            : await hashFile(filePath);
          const row = {
            id: trackId,
            root_id: root.id,
            relative_path: relativePath,
            full_path: filePath,
            file_hash: fileHash,
            file_size: stat.size,
            file_mtime_ms: Math.floor(stat.mtimeMs),
            title,
            artist,
            album,
            year,
            genre,
            bpm,
            artist_summary: artistSummary,
            singer,
            notes,
            instrumental:
              instrumental === null ? null : instrumental ? 1 : 0,
            duration_ms: analysis.durationMs,
            start_offset_ms: analysis.startOffsetMs,
            end_trim_ms: analysis.endTrimMs,
            loudness_db: analysis.loudnessDb ?? null,
            gain_db: analysis.gainDb ?? null,
            tag_error: unchanged ? existing?.tag_error ?? "" : tagError,
            analysis_error: analysisError,
            tag_json: unchanged
              ? existing?.tag_json ?? JSON.stringify(tags ?? {})
              : JSON.stringify(tags ?? {}),
            analysis_json: unchanged
              ? existing?.analysis_json ?? JSON.stringify(analysis)
              : JSON.stringify(analysis),
            created_at: now,
            updated_at: now,
            last_scanned_at: now,
          };

          insertStmt.run(row);
          if (existing) {
            updated += 1;
          } else {
            added += 1;
          }
        }

        if (tagError) {
          errors.push({ filePath, message: `Tags: ${tagError}` });
        }
        if (analysisError) {
          errors.push({ filePath, message: `Analysis: ${analysisError}` });
        }
      } catch (error) {
        errors.push({
          filePath,
          message: error instanceof Error ? error.message : "Scan failed",
        });
      }

      if (onProgress) {
        onProgress({
          current: scanned,
          total,
          filePath,
          rootLabel: root.label,
          errors: errors.length,
        });
      }
    }

    if (files.length > 0) {
      const existingRows = db
        .prepare(
          "select id, relative_path from tracks where root_id = ?",
        )
        .all(root.id) as { id: string; relative_path: string }[];
      for (const row of existingRows) {
        if (!seen.has(row.relative_path)) {
          db.prepare("delete from tracks where id = ?").run(row.id);
          removed += 1;
        }
      }
    }
  }

  const invalidTandas = db
    .prepare(
      `select distinct tanda_id as id
       from tanda_tracks
       where track_id not in (select id from tracks)`,
    )
    .all() as { id: string }[];
  invalidTandas.forEach((row) => {
    db.prepare("update tandas set invalid = 1 where id = ?").run(row.id);
  });
  db.prepare(
    `update playlists set invalid = 1
     where id in (
       select playlist_id from playlist_items
       join tandas on tandas.id = playlist_items.tanda_id
       where tandas.invalid = 1
     )`,
  ).run();

  return { scanned, added, updated, removed, errors };
};
