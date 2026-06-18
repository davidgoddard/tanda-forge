import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
import {
  extractSingerName,
  normalizeStyleName,
  summarizeArtistName,
} from "../shared/tanda-utils";
import {
  normalizeLegacyPath,
  resolveLegacyPathMatch,
} from "../shared/legacy-path";
import type { LibraryRoot } from "./library/scan";
import type { TandaSavePayload } from "./library/tandas";
import { saveTanda } from "./library/tandas";
import { getDb } from "./db";

export type LegacyDetection = {
  rootPath: string;
  configPath: string;
  tandasPath: string;
  libraryPath: string;
  cortinasPath: string | null;
};

export type LegacyTrackOverride = {
  title?: string;
  artist?: string;
  singer?: string;
  album?: string;
  year?: string;
  genre?: string;
  bpm?: number | null;
  notes?: string;
  instrumental?: boolean | null;
  durationMs?: number;
  startOffsetMs?: number;
  endTrimMs?: number;
  loudnessDb?: number | null;
  gainDb?: number | null;
};

export type LegacyImportResult = {
  tandasImported: number;
  tracksAdded: number;
  tracksUpdated: number;
  missingTracks: number;
  missingFiles: { filePath: string; message: string }[];
  rootPath: string;
  overridesByRootId: Map<string, Map<string, LegacyTrackOverride>>;
};

type LegacyLibraryEntry = {
  track?: {
    filename?: string;
    artist?: string;
    title?: string;
    album?: string;
    date?: string;
    genre?: string;
    duration?: number;
  };
  analysis?: {
    duration?: number;
    silence?: number;
    start?: number;
    meanGain?: number;
    gain?: number;
    error?: string | null;
  };
  classifiers?: {
    bpm?: number;
    notes?: string;
    style?: string;
    instrumental?: boolean;
    subStyle?: string;
    "sub-style"?: string;
  };
};

type LegacyTandaEntry = {
  label?: string;
  description?: string;
  style?: string;
  instrumental?: boolean;
  tracks?: string[];
};

const LEGACY_AUTO_GENERATED_TANDA_NAMES = new Set([
  "auto generated tanda",
  "saved auto-generated tanda",
  "saved auto generated tanda",
]);

const LEGACY_FILES = ["config.js", "tandas.dat", "library.dat"];

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".m4a",
  ".flac",
  ".wav",
  ".aac",
  ".ogg",
  ".aif",
  ".aiff",
]);

const hasLegacyFiles = (rootPath: string) =>
  LEGACY_FILES.every((file) => fs.existsSync(path.join(rootPath, file)));

export const detectLegacyRoot = (candidatePath: string): LegacyDetection | null => {
  const first = path.resolve(candidatePath);
  const parent = path.dirname(first);
  const target = hasLegacyFiles(first) ? first : hasLegacyFiles(parent) ? parent : null;
  if (!target) {
    return null;
  }
  const cortinasPath = path.join(target, "cortinas.dat");
  return {
    rootPath: target,
    configPath: path.join(target, "config.js"),
    tandasPath: path.join(target, "tandas.dat"),
    libraryPath: path.join(target, "library.dat"),
    cortinasPath: fs.existsSync(cortinasPath) ? cortinasPath : null,
  };
};

export const detectLegacyFromRoots = (roots: LibraryRoot[]) => {
  for (const root of roots) {
    const detected = detectLegacyRoot(root.path);
    if (detected) {
      return detected;
    }
  }
  return null;
};

const readLegacyJson = <T>(filePath: string, fallback: T): T => {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const parseLegacyNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const readClassifierText = (
  classifiers: LegacyLibraryEntry["classifiers"],
  keys: Array<keyof NonNullable<LegacyLibraryEntry["classifiers"]>>,
) => {
  if (!classifiers) {
    return "";
  }
  for (const key of keys) {
    const value = classifiers[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return "";
};

const buildLegacyClassifierStyle = (
  classifiers: LegacyLibraryEntry["classifiers"],
) => {
  const style = normalizeStyleName(readClassifierText(classifiers, ["style"]));
  const subStyle = normalizeStyleName(
    readClassifierText(classifiers, ["subStyle", "sub-style"]),
  );
  if (style && subStyle) {
    return `${style} - ${subStyle}`;
  }
  return style || subStyle || "";
};

const parseYearFromNotes = (notes: string) => {
  const currentYear = new Date().getFullYear();
  const rangeMatch = notes.match(
    /\b(19\d{2}|20\d{2})\s*[-–—/]\s*(19\d{2}|20\d{2})\b/,
  );
  if (rangeMatch) {
    const first = Number.parseInt(rangeMatch[1], 10);
    const second = Number.parseInt(rangeMatch[2], 10);
    if (
      Number.isFinite(first) &&
      Number.isFinite(second) &&
      first >= 1900 &&
      second >= 1900 &&
      first <= currentYear &&
      second <= currentYear
    ) {
      return `${first}-${second}`;
    }
  }
  const singleMatch = notes.match(/\b(19\d{2}|20\d{2})\b/);
  if (singleMatch) {
    const year = Number.parseInt(singleMatch[1], 10);
    if (Number.isFinite(year) && year >= 1900 && year <= currentYear) {
      return year.toString();
    }
  }
  return "";
};

const parseYearFromTitleSuffix = (title: string) => {
  const trimmed = title.trim();
  const normalizedTail = trimmed
    .replace(/\s*\([^()]*\)\s*$/g, "")
    .replace(/[.?!,:;)\]]+\s*$/g, "")
    .trim();
  const match = normalizedTail.match(/\b(19\d{2}|20\d{2})\s*$/);
  if (!match) {
    return "";
  }
  const year = Number.parseInt(match[1], 10);
  const currentYear = new Date().getFullYear();
  if (!Number.isFinite(year) || year < 1900 || year > currentYear) {
    return "";
  }
  return year.toString();
};

const splitLegacyArtistAndSinger = (rawArtist: string) => {
  const trimmed = rawArtist.trim();
  if (!trimmed.includes(";")) {
    return { artist: trimmed, singer: "" };
  }
  const [artistPart, ...singerParts] = trimmed.split(";");
  const artist = artistPart.trim();
  const singer = singerParts.join(";").trim();
  if (!artist || !singer) {
    return { artist: trimmed, singer: "" };
  }
  return { artist, singer };
};

export const loadLegacyLibrary = (libraryPath: string) => {
  const raw = readLegacyJson<Record<string, LegacyLibraryEntry>>(libraryPath, {});
  const entries = new Map<string, LegacyTrackOverride>();
  Object.entries(raw).forEach(([rawPath, entry]) => {
    const track = entry.track ?? {};
    const analysis = entry.analysis ?? {};
    const classifiers = entry.classifiers ?? {};
    const title = track.title?.trim() ?? "";
    const artistParts = splitLegacyArtistAndSinger(track.artist?.trim() ?? "");
    const artist = artistParts.artist;
    const singer = artistParts.singer;
    const album = track.album?.trim() ?? "";
    const genre = buildLegacyClassifierStyle(classifiers) || "?";
    const bpm = typeof classifiers.bpm === "number" ? classifiers.bpm : null;
    const notes = (classifiers.notes ?? "").toString().trim();
    const instrumental = singer
      ? false
      : typeof classifiers.instrumental === "boolean"
        ? classifiers.instrumental
        : null;
    let year =
      track.date && !Number.isNaN(Date.parse(track.date))
        ? new Date(track.date).getFullYear().toString()
        : "";
    if (!year && notes) {
      year = parseYearFromNotes(notes);
    }
    if (!year && title) {
      year = parseYearFromTitleSuffix(title);
    }
    const durationSec =
      typeof analysis.duration === "number"
        ? analysis.duration
        : typeof track.duration === "number"
          ? track.duration
          : 0;
    const startOffsetSec =
      typeof analysis.start === "number" ? analysis.start : 0;
    const silenceSec =
      typeof analysis.silence === "number" ? analysis.silence : null;
    const endTrimSec =
      silenceSec !== null && durationSec > 0
        ? Math.max(0, durationSec - silenceSec)
        : 0;
    const durationMs = Number.isFinite(durationSec)
      ? Math.max(0, Math.round(durationSec * 1000))
      : 0;
    const startOffsetMs = Number.isFinite(startOffsetSec)
      ? Math.max(0, Math.round(startOffsetSec * 1000))
      : 0;
    const endTrimMs = Number.isFinite(endTrimSec)
      ? Math.max(0, Math.round(endTrimSec * 1000))
      : 0;
    const loudnessDb = parseLegacyNumber(analysis.meanGain);
    // Legacy "gain" is the ffmpeg max_volume metric, not an applied playback gain.
    // We intentionally do not map it directly to gainDb.
    const gainDb = loudnessDb !== null ? -16 - loudnessDb : null;
    entries.set(normalizeLegacyPath(rawPath), {
      title: title || undefined,
      artist: artist || undefined,
      singer: singer || undefined,
      album: album || undefined,
      genre: genre || undefined,
      year: year || undefined,
      bpm,
      notes: notes || undefined,
      instrumental,
      durationMs: durationMs || undefined,
      startOffsetMs: startOffsetMs || undefined,
      endTrimMs: endTrimMs || undefined,
      loudnessDb,
      gainDb,
    });
  });
  return entries;
};

type RootAudioIndex = {
  relativePaths: string[];
  fullPathByRelativePath: Map<string, string>;
};

const walkAudioFiles = async (rootPath: string): Promise<string[]> => {
  const entries = await fs.promises.readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name.startsWith("._")) {
      continue;
    }
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkAudioFiles(fullPath)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
};

const buildRootAudioIndexes = async (roots: LibraryRoot[]) => {
  const indexes = new Map<string, RootAudioIndex>();
  for (const root of roots) {
    if (!fs.existsSync(root.path)) {
      indexes.set(root.id, {
        relativePaths: [],
        fullPathByRelativePath: new Map(),
      });
      continue;
    }
    const files = await walkAudioFiles(root.path);
    const relativePaths = files.map((filePath) => path.relative(root.path, filePath));
    indexes.set(root.id, {
      relativePaths,
      fullPathByRelativePath: new Map(
        relativePaths.map((relativePath, index) => [relativePath, files[index]]),
      ),
    });
  }
  return indexes;
};

const resolveLegacyTrackForRoot = (
  legacyPath: string,
  root: LibraryRoot,
  rootAudioIndex: RootAudioIndex | undefined,
) => {
  const relativePath = resolveLegacyPathMatch(
    legacyPath,
    root.path,
    rootAudioIndex?.relativePaths ?? [],
  );
  if (!relativePath) {
    return null;
  }
  return {
    relativePath,
    fullPath:
      rootAudioIndex?.fullPathByRelativePath.get(relativePath) ??
      path.join(root.path, relativePath),
  };
};

const buildLegacyFileHash = (stat: fs.Stats) => {
  const hash = createHash("sha1");
  hash.update(`${stat.size}:${Math.floor(stat.mtimeMs)}`);
  return hash.digest("hex");
};

const normalizeLegacyGenre = (rawGenre: string, styleMap: Map<string, string>) => {
  const normalized = normalizeStyleName(rawGenre);
  if (!normalized) {
    return "";
  }
  return styleMap.get(normalized.toLowerCase()) ?? "";
};

export const listLegacyStyles = (libraryPath: string) => {
  const raw = readLegacyJson<Record<string, LegacyLibraryEntry>>(libraryPath, {});
  const counts = new Map<string, { normalized: string; count: number }>();
  Object.values(raw).forEach((entry) => {
    const fromClassifiers = buildLegacyClassifierStyle(entry.classifiers);
    const key = fromClassifiers || "?";
    const normalized = key === "?" ? "?" : normalizeStyleName(key);
    const current = counts.get(key);
    counts.set(key, {
      normalized,
      count: (current?.count ?? 0) + 1,
    });
  });
  return Array.from(counts.entries())
    .map(([value, payload]) => ({
      value,
      normalized: payload.normalized,
      count: payload.count,
    }))
    .sort((left, right) => {
      const byCount = right.count - left.count;
      if (byCount !== 0) {
        return byCount;
      }
      return left.value.localeCompare(right.value);
    });
};

export const normalizeLegacyTandaName = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }
  const canonical = trimmed
    .normalize("NFKC")
    .replace(/^["'\u201c\u201d\u2018\u2019]+|["'\u201c\u201d\u2018\u2019]+$/g, "")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (LEGACY_AUTO_GENERATED_TANDA_NAMES.has(canonical)) {
    return "";
  }
  return trimmed;
};

const importLegacyTracks = async (
  entries: Map<string, LegacyTrackOverride>,
  roots: LibraryRoot[],
  kind: "music" | "cortina",
  waveformsDir?: string,
) => {
  const db = getDb();
  const now = new Date().toISOString();
  const rootsByKind = roots.filter((root) => root.kind === kind);
  const rootAudioIndexes = await buildRootAudioIndexes(rootsByKind);
  if (rootsByKind.length === 0 || entries.size === 0) {
    return { added: 0, updated: 0, missingFiles: [] as { filePath: string; message: string }[] };
  }
  if (waveformsDir) {
    try {
      await fs.promises.mkdir(waveformsDir, { recursive: true });
    } catch {
      // ignore
    }
  }
  const styleRows = db
    .prepare("select name, normalized from styles")
    .all() as { name: string; normalized: string }[];
  const canonicalStyleMap = new Map(
    styleRows.map((row) => [row.normalized.toLowerCase(), row.name]),
  );
  const aliasRows = db
    .prepare("select style_name, alias_normalized from style_aliases")
    .all() as { style_name: string; alias_normalized: string }[];
  const styleMap = new Map(canonicalStyleMap);
  aliasRows.forEach((row) => {
    styleMap.set(row.alias_normalized.toLowerCase(), row.style_name);
  });
  const selectStmt = db.prepare(
    `select id, title, artist, album, year, genre, bpm, notes, singer, instrumental, created_at,
        duration_ms, start_offset_ms, end_trim_ms, loudness_db, gain_db
     from tracks where root_id = ? and relative_path = ?`,
  );
  const insertStmt = db.prepare(
    `insert into tracks (
      id, root_id, relative_path, full_path, file_hash, file_size, file_mtime_ms,
      title, artist, artist_summary, singer, album, year, genre, bpm, notes,
      instrumental, duration_ms, start_offset_ms, end_trim_ms, loudness_db, gain_db,
      tag_error, analysis_error, tag_json, analysis_json,
      created_at, updated_at, last_scanned_at
    ) values (
      @id, @root_id, @relative_path, @full_path, @file_hash, @file_size, @file_mtime_ms,
      @title, @artist, @artist_summary, @singer, @album, @year, @genre, @bpm, @notes,
      @instrumental, @duration_ms, @start_offset_ms, @end_trim_ms, @loudness_db, @gain_db,
      @tag_error, @analysis_error, @tag_json, @analysis_json,
      @created_at, @updated_at, @last_scanned_at
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
    `,
  );
  let added = 0;
  let updated = 0;
  const missingFiles: { filePath: string; message: string }[] = [];
  for (const [legacyPath, override] of entries.entries()) {
    let handled = false;
    for (const root of rootsByKind) {
      const matched = resolveLegacyTrackForRoot(
        legacyPath,
        root,
        rootAudioIndexes.get(root.id),
      );
      if (!matched) {
        continue;
      }
      const { relativePath, fullPath } = matched;
      handled = true;
      const stat = fs.statSync(fullPath);
      const existing = selectStmt.get(root.id, relativePath) as
        | {
            id: string;
            title?: string;
            artist?: string;
            album?: string;
            year?: string;
            genre?: string;
            bpm?: number | null;
            notes?: string;
            singer?: string;
            instrumental?: number | null;
            created_at?: string;
            duration_ms?: number;
            start_offset_ms?: number;
            end_trim_ms?: number;
            loudness_db?: number | null;
            gain_db?: number | null;
          }
        | undefined;
      const title =
        override.title?.trim() ||
        existing?.title ||
        path.basename(fullPath, path.extname(fullPath));
      const artist = override.artist?.trim() || existing?.artist || "";
      const album = override.album?.trim() || existing?.album || "";
      const year = override.year?.trim() || existing?.year || "";
      const genre = normalizeLegacyGenre(
        override.genre?.trim() || existing?.genre || "",
        styleMap,
      );
      const bpm =
        typeof override.bpm === "number" ? override.bpm : existing?.bpm ?? null;
      const notes = override.notes?.trim() || existing?.notes || "";
      const singer =
        override.singer?.trim() || existing?.singer || extractSingerName(artist, title);
      const instrumental =
        typeof override.instrumental === "boolean"
          ? override.instrumental
          : existing?.instrumental === null || existing?.instrumental === undefined
            ? null
            : Boolean(existing.instrumental);
      const durationMs =
        typeof override.durationMs === "number"
          ? override.durationMs
          : existing?.duration_ms ?? 0;
      const startOffsetMs =
        typeof override.startOffsetMs === "number"
          ? override.startOffsetMs
          : existing?.start_offset_ms ?? 0;
      const endTrimMs =
        typeof override.endTrimMs === "number"
          ? override.endTrimMs
          : existing?.end_trim_ms ?? 0;
      const loudnessDb =
        typeof override.loudnessDb === "number"
          ? override.loudnessDb
          : existing?.loudness_db ?? null;
      const gainDb =
        typeof override.gainDb === "number"
          ? override.gainDb
          : existing?.gain_db ?? null;
      const maxDuration = Math.max(0, durationMs);
      const safeStartOffset = Math.min(Math.max(0, startOffsetMs), maxDuration);
      const safeEndTrim = Math.min(Math.max(0, endTrimMs), maxDuration);
      const nowRow = {
        id: existing?.id ?? randomUUID(),
        root_id: root.id,
        relative_path: relativePath,
        full_path: fullPath,
        file_hash: buildLegacyFileHash(stat),
        file_size: stat.size,
        file_mtime_ms: Math.floor(stat.mtimeMs),
        title,
        artist,
        artist_summary: summarizeArtistName(artist),
        singer,
        album,
        year,
        genre,
        bpm,
        notes,
        instrumental:
          instrumental === null ? null : instrumental ? 1 : 0,
        duration_ms: maxDuration,
        start_offset_ms: safeStartOffset,
        end_trim_ms: safeEndTrim,
        loudness_db: loudnessDb,
        gain_db: gainDb,
        tag_error: "",
        analysis_error: "legacy_import_pending_scan",
        tag_json: "{}",
        analysis_json: JSON.stringify({
          durationMs: maxDuration,
          startOffsetMs: safeStartOffset,
          endTrimMs: safeEndTrim,
          loudnessDb,
          gainDb,
          source: "legacy-import",
          error: "",
        }),
        created_at: existing?.created_at ?? now,
        updated_at: now,
        last_scanned_at: now,
      };
      insertStmt.run(nowRow);
      if (existing) {
        updated += 1;
      } else {
        added += 1;
      }
      if (waveformsDir) {
        const ext = path.extname(fullPath);
        const base = fullPath.slice(0, Math.max(0, fullPath.length - ext.length));
        const candidates = [`${fullPath}.png`, `${base}.png`];
        const source = candidates.find((candidate) => fs.existsSync(candidate));
        if (source) {
          const target = path.join(waveformsDir, `${nowRow.id}.png`);
          try {
            await fs.promises.copyFile(source, target);
          } catch {
            // ignore waveform copy errors
          }
        }
      }
      break;
    }
    if (!handled) {
      missingFiles.push({ filePath: legacyPath, message: "File not found" });
    }
  }
  return { added, updated, missingFiles };
};

const buildOverridesForRoots = (
  libraryEntries: Map<string, LegacyTrackOverride>,
  roots: LibraryRoot[],
) => {
  return buildOverridesForRootsAsync(libraryEntries, roots);
};

const buildOverridesForRootsAsync = async (
  libraryEntries: Map<string, LegacyTrackOverride>,
  roots: LibraryRoot[],
) => {
  const overridesByRootId = new Map<string, Map<string, LegacyTrackOverride>>();
  const musicRoots = roots.filter((root) => root.kind === "music");
  if (musicRoots.length === 0) {
    return overridesByRootId;
  }
  const rootAudioIndexes = await buildRootAudioIndexes(musicRoots);
  for (const [legacyPath, override] of libraryEntries.entries()) {
    for (const root of musicRoots) {
      const matched = resolveLegacyTrackForRoot(
        legacyPath,
        root,
        rootAudioIndexes.get(root.id),
      );
      if (!matched) {
        continue;
      }
      if (!overridesByRootId.has(root.id)) {
        overridesByRootId.set(root.id, new Map());
      }
      overridesByRootId.get(root.id)?.set(matched.relativePath, override);
    }
  }
  return overridesByRootId;
};

const applyLegacyOverrides = (
  overridesByRootId: Map<string, Map<string, LegacyTrackOverride>>,
) => {
  const db = getDb();
  const selectStmt = db.prepare(
    `select title, artist, album, year, genre, bpm, notes
     from tracks where root_id = ? and relative_path = ?`,
  );
  const updateStmt = db.prepare(
    `update tracks set title = ?, artist = ?, album = ?, year = ?, genre = ?,
        bpm = ?, notes = ?, artist_summary = ?, updated_at = ?
     where root_id = ? and relative_path = ?`,
  );
  const now = new Date().toISOString();
  let updated = 0;
  overridesByRootId.forEach((entries, rootId) => {
    entries.forEach((override, relativePath) => {
      const existing = selectStmt.get(rootId, relativePath) as
        | {
            title: string;
            artist: string;
            album: string;
            year: string;
            genre: string;
            bpm: number | null;
            notes: string;
          }
        | undefined;
      if (!existing) {
        return;
      }
      const title = override.title?.trim() || existing.title || "";
      const artist = override.artist?.trim() || existing.artist || "";
      const album = override.album?.trim() || existing.album || "";
      const year = override.year?.trim() || existing.year || "";
      const genre = override.genre?.trim() || existing.genre || "";
      const bpm =
        typeof override.bpm === "number" ? override.bpm : existing.bpm ?? null;
      const notes = override.notes?.trim() || existing.notes || "";
      updateStmt.run(
        title,
        artist,
        album,
        year,
        genre,
        bpm,
        notes,
        summarizeArtistName(artist),
        now,
        rootId,
        relativePath,
      );
      updated += 1;
    });
  });
  return updated;
};

const importLegacyTandas = async (tandasPath: string, roots: LibraryRoot[]) => {
  const db = getDb();
  const raw = readLegacyJson<LegacyTandaEntry[]>(tandasPath, []);
  const musicRoots = roots.filter((root) => root.kind === "music");
  if (musicRoots.length === 0) {
    return { imported: 0, missingTracks: 0 };
  }
  const rootAudioIndexes = await buildRootAudioIndexes(musicRoots);
  const trackIdStmt = db.prepare(
    "select id from tracks where root_id = ? and relative_path = ?",
  );
  const deleteTxn = db.transaction(() => {
    db.prepare("delete from tanda_tracks").run();
    db.prepare("delete from tanda_styles").run();
    db.prepare("delete from tandas").run();
  });
  deleteTxn();
  let imported = 0;
  let missingTracks = 0;
  raw.forEach((entry, index) => {
    const rawLabel = entry.label?.trim() ?? "";
    const rawDescription = entry.description?.trim() ?? "";
    const normalizedLabel = normalizeLegacyTandaName(rawLabel);
    const normalizedDescription = normalizeLegacyTandaName(rawDescription);
    const hasLegacyNameField = rawLabel.length > 0 || rawDescription.length > 0;
    const label =
      normalizedLabel ||
      normalizedDescription ||
      (hasLegacyNameField ? "" : `Imported Tanda ${index + 1}`);
    const style = entry.style ? normalizeStyleName(entry.style) : "";
    const styles = style ? [style] : [];
    const trackSlots: (string | null)[] = [];
    (entry.tracks ?? []).forEach((legacyTrackPath) => {
      let resolved: string | null = null;
      for (const root of musicRoots) {
        const relativePath = resolveLegacyPathMatch(
          legacyTrackPath,
          root.path,
          rootAudioIndexes.get(root.id)?.relativePaths ?? [],
        );
        if (!relativePath) {
          continue;
        }
        const row = trackIdStmt.get(root.id, relativePath) as
          | { id: string }
          | undefined;
        if (row?.id) {
          resolved = row.id;
          break;
        }
      }
      if (!resolved) {
        missingTracks += 1;
      }
      trackSlots.push(resolved);
    });
    const hasAnyTrack = trackSlots.some((trackId) => Boolean(trackId));
    if (!hasAnyTrack) {
      return;
    }
    const payload: TandaSavePayload = {
      id: randomUUID(),
      name: label,
      styles,
      rating: 0,
      instrumental: Boolean(entry.instrumental),
      total_duration_ms: 0,
      track_slots: trackSlots,
    };
    saveTanda(db, payload);
    imported += 1;
  });
  return { imported, missingTracks };
};

export const importLegacyData = async (
  legacyRoot: string,
  roots: LibraryRoot[],
  options?: { waveformsDir?: string },
): Promise<LegacyImportResult> => {
  const detected = detectLegacyRoot(legacyRoot);
  if (!detected) {
    return {
      tandasImported: 0,
      tracksAdded: 0,
      tracksUpdated: 0,
      missingTracks: 0,
      missingFiles: [],
      rootPath: legacyRoot,
      overridesByRootId: new Map(),
    };
  }
  const libraryEntries = loadLegacyLibrary(detected.libraryPath);
  const overridesByRootId = await buildOverridesForRoots(libraryEntries, roots);
  const waveformsDir = options?.waveformsDir;
  const musicImport = await importLegacyTracks(
    libraryEntries,
    roots,
    "music",
    waveformsDir,
  );
  const cortinaEntries = detected.cortinasPath
    ? loadLegacyLibrary(detected.cortinasPath)
    : new Map<string, LegacyTrackOverride>();
  const cortinaImport = await importLegacyTracks(
    cortinaEntries,
    roots,
    "cortina",
    waveformsDir,
  );
  const tracksUpdated = musicImport.updated + cortinaImport.updated;
  const tracksAdded = musicImport.added + cortinaImport.added;
  const tandasResult = await importLegacyTandas(detected.tandasPath, roots);
  const missingFiles = [...musicImport.missingFiles, ...cortinaImport.missingFiles];
  return {
    tandasImported: tandasResult.imported,
    tracksAdded,
    tracksUpdated,
    missingTracks: tandasResult.missingTracks + missingFiles.length,
    missingFiles,
    rootPath: detected.rootPath,
    overridesByRootId,
  };
};
