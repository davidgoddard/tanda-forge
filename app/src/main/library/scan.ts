import { createHash, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { analyzeTrack, readTags } from "./analysis";
import {
  normalizeStyleName,
  summarizeArtistName,
} from "../../shared/tanda-utils";
import { getDb } from "../db";

export type LibraryRoot = {
  id: string;
  path: string;
  kind: "music" | "cortina";
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

const audioExtensions = new Set([
  ".mp3",
  ".m4a",
  ".flac",
  ".wav",
  ".aac",
  ".ogg",
  ".aiff",
]);

const walkFiles = async (rootPath: string): Promise<string[]> => {
  const entries = await fs.promises.readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
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
): Promise<ScanSummary> => {
  const db = getDb();
  const now = new Date().toISOString();
  const styleRows = db
    .prepare("select name, normalized from styles")
    .all() as { name: string; normalized: string }[];
  const styleMap = new Map(
    styleRows.map((row) => [row.normalized.toLowerCase(), row.name]),
  );
  let scanned = 0;
  let added = 0;
  let updated = 0;
  let removed = 0;
  const errors: { filePath: string; message: string }[] = [];

  const insertStmt = db.prepare(`
    insert into tracks (
      id, root_id, relative_path, full_path, file_hash, file_size, file_mtime_ms,
      title, artist, artist_summary, album, album_artist, year, genre, duration_ms,
      start_offset_ms, end_trim_ms, loudness_db, gain_db, tag_error, analysis_error, tag_json,
      analysis_json, created_at, updated_at, last_scanned_at
    ) values (
      @id, @root_id, @relative_path, @full_path, @file_hash, @file_size,
      @file_mtime_ms, @title, @artist, @artist_summary, @album, @album_artist, @year, @genre,
      @duration_ms, @start_offset_ms, @end_trim_ms, @loudness_db, @gain_db,
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
      album=excluded.album,
      album_artist=excluded.album_artist,
      year=excluded.year,
      genre=excluded.genre,
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
    `select id, file_hash, file_size, file_mtime_ms, title, artist, artist_summary,
      album, album_artist, year, genre, duration_ms, start_offset_ms, end_trim_ms,
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
              album?: string;
              album_artist?: string;
              year?: string;
              genre?: string;
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

        const unchanged =
          existing &&
          existing.file_size === stat.size &&
          existing.file_mtime_ms === Math.floor(stat.mtimeMs) &&
          !existing.tag_error &&
          !existing.analysis_error &&
          existing.tag_json &&
          existing.analysis_json;

        if (!unchanged) {
          const tagResult = await readTags(filePath);
          tags = tagResult.tags;
          if (tagResult.error) {
            tagError = tagResult.error;
          }
        } else if (existing?.tag_json) {
          try {
            tags = JSON.parse(existing.tag_json) as Record<string, string>;
          } catch {
            tags = {};
          }
        }

        const analysis = unchanged
          ? ({
              durationMs: existing?.duration_ms ?? 0,
              startOffsetMs: existing?.start_offset_ms ?? 0,
              endTrimMs: existing?.end_trim_ms ?? 0,
              loudnessDb: existing?.loudness_db ?? null,
              gainDb: existing?.gain_db ?? null,
              error: existing?.analysis_error ?? "",
            } as const)
          : await analyzeTrack(filePath);
        const analysisError = analysis.error ?? "";

        const title =
          tags.title ||
          existing?.title ||
          path.basename(filePath, path.extname(filePath));
        const artist =
          tags.artist || tags.album_artist || existing?.artist || "";
        const album = tags.album || existing?.album || "";
        const albumArtist = tags.album_artist || existing?.album_artist || "";
        const year =
          tags.year ||
          (tags.date ? new Date(tags.date).getFullYear().toString() : "") ||
          existing?.year ||
          "";
        const rawGenre = tags.genre || existing?.genre || "";
        const genreNormalized = normalizeStyleName(rawGenre);
        const genre = genreNormalized
          ? styleMap.get(genreNormalized.toLowerCase()) ?? ""
          : "";
        const artistSummary = summarizeArtistName(artist);

        const needsMetadataUpdate =
          !existing ||
          existing.title !== title ||
          existing.artist !== artist ||
          existing.album !== album ||
          existing.album_artist !== albumArtist ||
          existing.year !== year ||
          existing.genre !== genre ||
          existing.artist_summary !== artistSummary;

        if (unchanged && !needsMetadataUpdate) {
          touchStmt.run(now, root.id, relativePath);
          updated += 1;
        } else {
          const fileHash = unchanged
            ? existing?.file_hash ?? (await hashFile(filePath))
            : await hashFile(filePath);
          const row = {
            id: randomUUID(),
            root_id: root.id,
            relative_path: relativePath,
            full_path: filePath,
            file_hash: fileHash,
            file_size: stat.size,
            file_mtime_ms: Math.floor(stat.mtimeMs),
            title,
            artist,
            album,
            album_artist: albumArtist,
            year,
            genre,
            artist_summary: artistSummary,
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
