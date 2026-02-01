import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { normalizeStyleName, summarizeArtistName } from "../shared/tanda-utils";
import { mapLegacyPathToRelative, normalizeLegacyPath } from "../shared/legacy-path";
import type { LibraryRoot } from "./library/scan";
import type { TandaSavePayload } from "./library/tandas";
import { saveTanda } from "./library/tandas";
import { getDb } from "./db";

export type LegacyDetection = {
  rootPath: string;
  configPath: string;
  tandasPath: string;
  libraryPath: string;
};

export type LegacyTrackOverride = {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  bpm?: number | null;
  notes?: string;
};

export type LegacyImportResult = {
  tandasImported: number;
  tracksUpdated: number;
  missingTracks: number;
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
  };
  classifiers?: {
    bpm?: number;
    notes?: string;
    style?: string;
  };
};

type LegacyTandaEntry = {
  label?: string;
  description?: string;
  style?: string;
  instrumental?: boolean;
  tracks?: string[];
};

const LEGACY_FILES = ["config.js", "tandas.dat", "library.dat"];

const hasLegacyFiles = (rootPath: string) =>
  LEGACY_FILES.every((file) => fs.existsSync(path.join(rootPath, file)));

export const detectLegacyRoot = (candidatePath: string): LegacyDetection | null => {
  const first = path.resolve(candidatePath);
  const parent = path.dirname(first);
  const target = hasLegacyFiles(first) ? first : hasLegacyFiles(parent) ? parent : null;
  if (!target) {
    return null;
  }
  return {
    rootPath: target,
    configPath: path.join(target, "config.js"),
    tandasPath: path.join(target, "tandas.dat"),
    libraryPath: path.join(target, "library.dat"),
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

export const loadLegacyLibrary = (libraryPath: string) => {
  const raw = readLegacyJson<Record<string, LegacyLibraryEntry>>(libraryPath, {});
  const entries = new Map<string, LegacyTrackOverride>();
  Object.entries(raw).forEach(([rawPath, entry]) => {
    const track = entry.track ?? {};
    const classifiers = entry.classifiers ?? {};
    const title = track.title?.trim() ?? "";
    const artist = track.artist?.trim() ?? "";
    const album = track.album?.trim() ?? "";
    const genre = (track.genre || classifiers.style || "").toString().trim();
    const bpm =
      typeof classifiers.bpm === "number" ? classifiers.bpm : null;
    const notes = (classifiers.notes ?? "").toString().trim();
    const year =
      track.date && !Number.isNaN(Date.parse(track.date))
        ? new Date(track.date).getFullYear().toString()
        : "";
    entries.set(normalizeLegacyPath(rawPath), {
      title: title || undefined,
      artist: artist || undefined,
      album: album || undefined,
      genre: genre || undefined,
      year: year || undefined,
      bpm,
      notes: notes || undefined,
    });
  });
  return entries;
};

const buildOverridesForRoots = (
  libraryEntries: Map<string, LegacyTrackOverride>,
  roots: LibraryRoot[],
) => {
  const overridesByRootId = new Map<string, Map<string, LegacyTrackOverride>>();
  const musicRoots = roots.filter((root) => root.kind === "music");
  if (musicRoots.length === 0) {
    return overridesByRootId;
  }
  for (const [legacyPath, override] of libraryEntries.entries()) {
    for (const root of musicRoots) {
      const relativePath = mapLegacyPathToRelative(legacyPath, root.path);
      const fullPath = path.join(root.path, relativePath);
      if (!fs.existsSync(fullPath)) {
        continue;
      }
      if (!overridesByRootId.has(root.id)) {
        overridesByRootId.set(root.id, new Map());
      }
      overridesByRootId.get(root.id)?.set(relativePath, override);
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

const importLegacyTandas = (tandasPath: string, roots: LibraryRoot[]) => {
  const db = getDb();
  const raw = readLegacyJson<LegacyTandaEntry[]>(tandasPath, []);
  const musicRoots = roots.filter((root) => root.kind === "music");
  if (musicRoots.length === 0) {
    return { imported: 0, missingTracks: 0 };
  }
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
    const label =
      entry.label?.trim() ||
      entry.description?.trim() ||
      `Imported Tanda ${index + 1}`;
    const style = entry.style ? normalizeStyleName(entry.style) : "";
    const styles = style ? [style] : [];
    const trackSlots: (string | null)[] = [];
    (entry.tracks ?? []).forEach((legacyTrackPath) => {
      let resolved: string | null = null;
      for (const root of musicRoots) {
        const relativePath = mapLegacyPathToRelative(
          legacyTrackPath,
          root.path,
        );
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

export const importLegacyData = (
  legacyRoot: string,
  roots: LibraryRoot[],
): LegacyImportResult => {
  const detected = detectLegacyRoot(legacyRoot);
  if (!detected) {
    return {
      tandasImported: 0,
      tracksUpdated: 0,
      missingTracks: 0,
      rootPath: legacyRoot,
      overridesByRootId: new Map(),
    };
  }
  const libraryEntries = loadLegacyLibrary(detected.libraryPath);
  const overridesByRootId = buildOverridesForRoots(libraryEntries, roots);
  const tracksUpdated = applyLegacyOverrides(overridesByRootId);
  const tandasResult = importLegacyTandas(detected.tandasPath, roots);
  return {
    tandasImported: tandasResult.imported,
    tracksUpdated,
    missingTracks: tandasResult.missingTracks,
    rootPath: detected.rootPath,
    overridesByRootId,
  };
};
