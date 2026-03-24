import fs from "fs";
import path from "path";
import { hasUsableCompressedRender } from "./analysis";
import { buildCompressedCachePath } from "./compression-cache";
import type { CompressionRenderProfile } from "../../shared/audio-compression";

type DbLike = {
  prepare: (sql: string) => {
    all: () => unknown[];
  };
};

export type CompressionEligibleTrack = {
  id: string;
  fullPath: string;
  relativePath: string;
  rootPath: string;
  rootKind: "music" | "cortina";
  loudnessDb: number | null;
};

export type CompressionReadinessTrack = {
  trackId: string;
  relativePath: string;
  rootKind: "music" | "cortina";
  status: "ready" | "missing" | "invalid-source";
  cachePath: string | null;
};

export type CompressionReadinessSummary = {
  eligible: number;
  ready: number;
  missing: number;
  invalidSource: number;
  tracks: CompressionReadinessTrack[];
};

export const listCompressionEligibleTracks = (db: DbLike): CompressionEligibleTrack[] =>
  (db
    .prepare(
      `select t.id, t.full_path, t.relative_path, t.loudness_db, r.path as root_path, r.kind as root_kind
       from tracks t
       join library_roots r on r.id = t.root_id
       where r.kind in ('music', 'cortina')
       order by r.kind, t.relative_path, t.id`,
    )
    .all() as Array<{
    id: string;
    full_path: string;
    relative_path: string;
    loudness_db: number | null;
    root_path: string;
    root_kind: "music" | "cortina";
  }>)
    .map((row) => ({
      id: row.id,
      fullPath: row.full_path,
      relativePath:
        row.relative_path?.trim() ||
        (row.root_path && row.full_path
          ? path.relative(row.root_path, row.full_path) || path.basename(row.full_path)
          : path.basename(row.full_path || row.id)),
      rootPath: row.root_path,
      rootKind: row.root_kind,
      loudnessDb: row.loudness_db,
    }));

export const resolveCompressionCachePath = (
  compressedCacheDir: string,
  track: CompressionEligibleTrack,
  profile: CompressionRenderProfile,
) => {
  if (!track.fullPath || !fs.existsSync(track.fullPath)) {
    return null;
  }
  const stat = fs.statSync(track.fullPath);
  return buildCompressedCachePath(compressedCacheDir, track.fullPath, stat, {
    loudnessDb: track.loudnessDb,
    depthPercent: 100,
    ...profile,
  });
};

export const auditCompressionReadiness = (
  compressedCacheDir: string,
  tracks: CompressionEligibleTrack[],
  profile: CompressionRenderProfile,
): CompressionReadinessSummary => {
  const readinessTracks: CompressionReadinessTrack[] = tracks.map((track) => {
    const cachePath = resolveCompressionCachePath(compressedCacheDir, track, profile);
    if (!cachePath) {
      return {
        trackId: track.id,
        relativePath: track.relativePath,
        rootKind: track.rootKind,
        status: "invalid-source",
        cachePath: null,
      };
    }
    return {
      trackId: track.id,
      relativePath: track.relativePath,
      rootKind: track.rootKind,
      status: hasUsableCompressedRender(cachePath) ? "ready" : "missing",
      cachePath,
    };
  });
  const ready = readinessTracks.filter((track) => track.status === "ready").length;
  const invalidSource = readinessTracks.filter((track) => track.status === "invalid-source").length;
  return {
    eligible: readinessTracks.length,
    ready,
    missing: readinessTracks.length - ready - invalidSource,
    invalidSource,
    tracks: readinessTracks,
  };
};
