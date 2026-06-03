import fs from "fs";
import path from "path";
import type Database from "better-sqlite3";
import type { TandaDetail } from "./library/tandas";
import {
  isValidPlaylistExportManifest,
  parseM3uRecords,
  PLAYLIST_EXPORT_VERSION,
  TANDAS_EXPORT_VERSION,
  type PlaylistExportManifest,
  type M3uRecord,
  type PortableTrackRef,
  type TandasExportManifest,
} from "../shared/library-transfer";
import type { StoredPlaylistState, StoredPlaylistItem } from "../shared/playlist-storage";
import { parseStoredPlaylistState } from "../shared/playlist-storage";

const sanitizePathSegment = (value: string) =>
  value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");

const normalizeSlashes = (value: string) => value.replace(/\\/g, "/");

const isWindowsAbsolutePath = (value: string) => /^[a-z]:[\\/]/i.test(value);

const isUncPath = (value: string) => /^\\\\|^\/\//.test(value);

const normalizePathForMatch = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (isWindowsAbsolutePath(trimmed) || isUncPath(trimmed)) {
    return normalizeSlashes(trimmed).toLowerCase();
  }
  return normalizeSlashes(path.resolve(trimmed)).toLowerCase();
};

const normalizeRelativeForMatch = (value: string) =>
  value.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();

const normalizeTextForMatch = (value: string | null | undefined) =>
  (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const buildTrackMetadataKey = (artist: string | null | undefined, title: string | null | undefined) => {
  const normalizedArtist = normalizeTextForMatch(artist);
  const normalizedTitle = normalizeTextForMatch(title);
  return normalizedArtist && normalizedTitle ? `${normalizedArtist}|||${normalizedTitle}` : "";
};

const buildTimestampSlug = (createdAt: string) =>
  sanitizePathSegment(createdAt.replace(/[:.]/g, "-").toLowerCase()) || "export";

export const buildTandasExportFileName = (createdAt: string) =>
  `tanda-forge-tandas-${buildTimestampSlug(createdAt)}.json`;

export const buildPlaylistExportFileName = (createdAt: string) =>
  `tanda-forge-playlist-${buildTimestampSlug(createdAt)}.json`;

export const buildPortableTrackRef = (track: {
  full_path: string;
  relative_path?: string;
  title?: string;
  artist?: string;
}): PortableTrackRef => ({
  fullPath: track.full_path,
  relativePath: track.relative_path ?? path.basename(track.full_path),
  title: track.title ?? "",
  artist: track.artist ?? "",
});

export const writePlaylistExport = (filePath: string, manifest: PlaylistExportManifest) => {
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), "utf-8");
};

const escapeM3uAttribute = (value: string) => value.replace(/"/g, "'");

const formatTrackDisplayName = (track: PortableTrackRef) => {
  const artist = track.artist.trim();
  const title = track.title.trim();
  if (artist && title) {
    return `${artist} - ${title}`;
  }
  return title || artist || path.basename(track.relativePath || track.fullPath);
};

const buildM3uExtinfLine = (track: PortableTrackRef, groupTitle?: string) => {
  const groupAttribute =
    groupTitle && groupTitle.trim()
      ? ` group-title="${escapeM3uAttribute(groupTitle.trim())}"`
      : "";
  return `#EXTINF:-1${groupAttribute},${formatTrackDisplayName(track)}`;
};

export const serializePlaylistExportAsM3u = (manifest: PlaylistExportManifest) => {
  const lines = ["#EXTM3U"];
  manifest.items.forEach((item, index) => {
    if (!item) {
      return;
    }
    if (item.kind === "track") {
      lines.push(buildM3uExtinfLine(item.track));
      lines.push(item.track.relativePath || item.track.fullPath);
      return;
    }
    const groupTitle =
      item.name.trim() ||
      item.styles.join(" / ").trim() ||
      `Tanda ${index + 1}`;
    lines.push(`#EXTGRP:${groupTitle}`);
    item.trackRefs.forEach((trackRef) => {
      if (!trackRef) {
        return;
      }
      lines.push(buildM3uExtinfLine(trackRef, groupTitle));
      lines.push(trackRef.relativePath || trackRef.fullPath);
    });
    lines.push("");
  });
  return `${lines.join("\n").trimEnd()}\n`;
};

export const writeTandasExport = (filePath: string, manifest: TandasExportManifest) => {
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), "utf-8");
};

export const buildTandasExportManifest = (
  tandas: TandaDetail[],
  createdAt: string,
  appVersion: string,
): TandasExportManifest => ({
  format: "tanda-forge-tandas",
  version: TANDAS_EXPORT_VERSION,
  createdAt,
  appVersion,
  tandas: tandas.map((tanda) => ({
    name: tanda.name,
    styles: [...tanda.styles],
    rating: tanda.rating,
    instrumental: tanda.instrumental,
    totalDurationMs: tanda.total_duration_ms,
    trackRefs: tanda.track_slots.map((trackId, index) => {
      if (!trackId) {
        return null;
      }
      const track = tanda.tracks[index];
      return track ? buildPortableTrackRef(track) : null;
    }),
  })),
});

type TrackLookupMaps = {
  fullPathToId: Map<string, string>;
  relativePathToIds: Map<string, string[]>;
  trackRows: Array<{
    id: string;
    relativePath: string;
    metadataKey: string;
  }>;
  metadataKeyToIds: Map<string, string[]>;
};

const buildTrackLookupMaps = (db: Database.Database): TrackLookupMaps => {
  const rows = db
    .prepare("select id, full_path, relative_path, title, artist from tracks")
    .all() as Array<{
      id: string;
      full_path: string;
      relative_path: string;
      title?: string | null;
      artist?: string | null;
    }>;
  const fullPathToId = new Map<string, string>();
  const relativePathToIds = new Map<string, string[]>();
  const metadataKeyToIds = new Map<string, string[]>();
  const trackRows: TrackLookupMaps["trackRows"] = [];
  rows.forEach((row) => {
    fullPathToId.set(normalizePathForMatch(row.full_path), row.id);
    const relativeKey = normalizeRelativeForMatch(row.relative_path);
    const existing = relativePathToIds.get(relativeKey) ?? [];
    existing.push(row.id);
    relativePathToIds.set(relativeKey, existing);
    const metadataKey = buildTrackMetadataKey(row.artist, row.title);
    if (metadataKey) {
      const metadataMatches = metadataKeyToIds.get(metadataKey) ?? [];
      metadataMatches.push(row.id);
      metadataKeyToIds.set(metadataKey, metadataMatches);
    }
    trackRows.push({
      id: row.id,
      relativePath: relativeKey,
      metadataKey,
    });
  });
  return { fullPathToId, relativePathToIds, trackRows, metadataKeyToIds };
};

const resolveUniqueSuffixMatch = (
  targetRelativePath: string,
  maps: TrackLookupMaps,
): string | null => {
  const normalizedTarget = normalizeRelativeForMatch(targetRelativePath);
  if (!normalizedTarget) {
    return null;
  }
  const matches = maps.trackRows
    .filter(
      (row) =>
        row.relativePath === normalizedTarget ||
        row.relativePath.endsWith(`/${normalizedTarget}`),
    )
    .map((row) => row.id);
  return matches.length === 1 ? matches[0] : null;
};

const resolvePortableTrackRef = (
  ref: PortableTrackRef,
  maps: TrackLookupMaps,
): { id: string | null; warning?: string } => {
  const fullPathMatch = maps.fullPathToId.get(normalizePathForMatch(ref.fullPath));
  if (fullPathMatch) {
    return { id: fullPathMatch };
  }
  const relativeMatches = maps.relativePathToIds.get(
    normalizeRelativeForMatch(ref.relativePath),
  );
  if (relativeMatches && relativeMatches.length === 1) {
    return { id: relativeMatches[0] };
  }
  if (relativeMatches && relativeMatches.length > 1) {
    return {
      id: null,
      warning: `Ambiguous track: ${ref.artist} - ${ref.title} (${ref.relativePath})`,
    };
  }
  const suffixMatch = resolveUniqueSuffixMatch(ref.relativePath, maps);
  if (suffixMatch) {
    return { id: suffixMatch };
  }
  const metadataKey = buildTrackMetadataKey(ref.artist, ref.title);
  const metadataMatches = metadataKey ? maps.metadataKeyToIds.get(metadataKey) ?? [] : [];
  if (metadataMatches.length === 1) {
    return { id: metadataMatches[0] };
  }
  if (metadataMatches.length > 1) {
    return {
      id: null,
      warning: `Ambiguous track: ${ref.artist} - ${ref.title} (${ref.relativePath || ref.fullPath})`,
    };
  }
  return {
    id: null,
    warning: `Missing track: ${ref.artist} - ${ref.title} (${ref.relativePath || ref.fullPath})`,
  };
};

const resolveM3uEntry = (
  entry: string,
  playlistDir: string,
  maps: TrackLookupMaps,
): { id: string | null; warning?: string } => {
  if (/^[a-z]+:\/\//i.test(entry)) {
    return { id: null, warning: `Unsupported remote entry: ${entry}` };
  }
  const absolutePath = path.isAbsolute(entry)
    ? path.resolve(entry)
    : path.resolve(playlistDir, entry);
  const fullPathMatch = maps.fullPathToId.get(normalizePathForMatch(absolutePath));
  if (fullPathMatch) {
    return { id: fullPathMatch };
  }
  const relativeMatches = maps.relativePathToIds.get(normalizeRelativeForMatch(entry));
  if (!relativeMatches || relativeMatches.length === 0) {
    return { id: null, warning: `Missing track: ${entry}` };
  }
  if (relativeMatches.length > 1) {
    return { id: null, warning: `Ambiguous track: ${entry}` };
  }
  return { id: relativeMatches[0] };
};

const buildStoredStateFromPlaylistManifest = (
  manifest: PlaylistExportManifest,
  maps: TrackLookupMaps,
) => {
  const warnings: string[] = [];
  const items: StoredPlaylistItem[] = manifest.items.map((item) => {
    if (!item) {
      return null;
    }
    if (item.kind === "track") {
      const resolved = resolvePortableTrackRef(item.track, maps);
      if (!resolved.id) {
        if (resolved.warning) {
          warnings.push(resolved.warning);
        }
        return null;
      }
      return { kind: "track", id: resolved.id };
    }
    const trackSlots = item.trackRefs.map((trackRef) => {
      if (!trackRef) {
        return null;
      }
      const resolved = resolvePortableTrackRef(trackRef, maps);
      if (!resolved.id && resolved.warning) {
        warnings.push(resolved.warning);
      }
      return resolved.id ?? null;
    });
    if (!trackSlots.some((trackId) => Boolean(trackId))) {
      warnings.push(`Skipped tanda with no matching tracks: ${item.name}`);
      return null;
    }
    return {
      kind: "tanda",
      id: `imported-${item.name}`,
      mismatch: item.mismatch,
      snapshot: {
        id: `imported-${item.name}`,
        name: item.name,
        styles: [...item.styles],
        rating: item.rating,
        trackSlots,
        totalDurationMs: item.totalDurationMs ?? 0,
      },
    };
  });
  const cortinaAssignments =
    manifest.cortinaAssignments?.flatMap((assignment) => {
      const resolved = resolvePortableTrackRef(assignment.track, maps);
      if (!resolved.id) {
        if (resolved.warning) {
          warnings.push(`Cortina ${resolved.warning}`);
        }
        return [];
      }
      return [{ index: assignment.index, trackId: resolved.id }];
    }) ?? [];
  return {
    state: {
      version: 2,
      items,
      cortinaSet: manifest.cortinaSet,
      cortinaAssignments,
    } satisfies StoredPlaylistState,
    warnings,
  };
};

const buildStoredStateFromM3u = (filePath: string, maps: TrackLookupMaps) => {
  const raw = fs.readFileSync(filePath, "utf-8");
  const entries = parseM3uRecords(raw);
  const warnings: string[] = [];
  const items: StoredPlaylistItem[] = [];
  let currentGroupTitle: string | undefined;
  let currentGroupRecords: M3uRecord[] = [];

  const flushCurrentGroup = () => {
    if (!currentGroupTitle || currentGroupRecords.length === 0) {
      currentGroupRecords = [];
      currentGroupTitle = undefined;
      return;
    }
    const trackSlots = currentGroupRecords.map((record) => {
      const resolved = resolveM3uEntry(record.location, path.dirname(filePath), maps);
      if (!resolved.id && resolved.warning) {
        warnings.push(resolved.warning);
      }
      return resolved.id ?? null;
    });
    if (!trackSlots.some((trackId) => Boolean(trackId))) {
      warnings.push(`Skipped tanda with no matching tracks: ${currentGroupTitle}`);
    } else {
      items.push({
        kind: "tanda",
        id: `m3u-${items.length + 1}-${currentGroupTitle}`,
        snapshot: {
          id: `m3u-${items.length + 1}-${currentGroupTitle}`,
          name: currentGroupTitle,
          styles: [],
          rating: 0,
          trackSlots,
        },
      });
    }
    currentGroupRecords = [];
    currentGroupTitle = undefined;
  };

  entries.forEach((entry) => {
    if (entry.groupTitle) {
      if (currentGroupTitle && currentGroupTitle !== entry.groupTitle) {
        flushCurrentGroup();
      }
      currentGroupTitle = entry.groupTitle;
      currentGroupRecords.push(entry);
      return;
    }
    flushCurrentGroup();
    const resolved = resolveM3uEntry(entry.location, path.dirname(filePath), maps);
    if (!resolved.id) {
      if (resolved.warning) {
        warnings.push(resolved.warning);
      }
      items.push(null);
      return;
    }
    items.push({ kind: "track", id: resolved.id });
  });
  flushCurrentGroup();

  return {
    state: {
      version: 2,
      items,
      cortinaAssignments: [],
    } satisfies StoredPlaylistState,
    warnings,
  };
};

export const importPlaylistFile = (db: Database.Database, filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  const maps = buildTrackLookupMaps(db);
  if (ext === ".m3u" || ext === ".m3u8") {
    return {
      format: "m3u" as const,
      ...buildStoredStateFromM3u(filePath, maps),
    };
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
  if (isValidPlaylistExportManifest(raw)) {
    return {
      format: "tanda-forge-playlist" as const,
      ...buildStoredStateFromPlaylistManifest(raw, maps),
    };
  }
  const parsedState = parseStoredPlaylistState(JSON.stringify(raw));
  if (parsedState) {
    return {
      format: "tanda-forge-playlist" as const,
      state: parsedState,
      warnings: [] as string[],
    };
  }
  throw new Error("Selected file is not a valid Tanda Forge playlist or M3U playlist");
};

export {
  isValidPlaylistExportManifest,
  parseM3uRecords,
  PLAYLIST_EXPORT_VERSION,
  TANDAS_EXPORT_VERSION,
};
