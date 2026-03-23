export const PLAYLIST_EXPORT_VERSION = 1;
export const TANDAS_EXPORT_VERSION = 1;

export type PortableTrackRef = {
  fullPath: string;
  relativePath: string;
  title: string;
  artist: string;
};

export type M3uRecord = {
  location: string;
  groupTitle?: string;
  displayTitle?: string;
};

export type PortablePlaylistItem =
  | {
      kind: "track";
      track: PortableTrackRef;
    }
  | {
      kind: "tanda";
      name: string;
      styles: string[];
      rating: number;
      instrumental: boolean;
      mismatch?: "style" | "count";
      totalDurationMs?: number;
      trackRefs: (PortableTrackRef | null)[];
    }
  | null;

export type PortableCortinaAssignment = {
  index: number;
  track: PortableTrackRef;
};

export type PlaylistExportManifest = {
  format: "tanda-forge-playlist";
  version: number;
  createdAt: string;
  appVersion: string;
  items: PortablePlaylistItem[];
  cortinaSet?: string;
  cortinaAssignments?: PortableCortinaAssignment[];
};

export type TandasExportManifest = {
  format: "tanda-forge-tandas";
  version: number;
  createdAt: string;
  appVersion: string;
  tandas: Array<{
    name: string;
    styles: string[];
    rating: number;
    instrumental: boolean;
    totalDurationMs?: number;
    trackRefs: (PortableTrackRef | null)[];
  }>;
};

export const isPortableTrackRef = (value: unknown): value is PortableTrackRef => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const track = value as Partial<PortableTrackRef>;
  return (
    typeof track.fullPath === "string" &&
    typeof track.relativePath === "string" &&
    typeof track.title === "string" &&
    typeof track.artist === "string"
  );
};

export const isValidPlaylistExportManifest = (
  value: unknown,
): value is PlaylistExportManifest => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const manifest = value as Partial<PlaylistExportManifest>;
  if (
    manifest.format !== "tanda-forge-playlist" ||
    manifest.version !== PLAYLIST_EXPORT_VERSION ||
    typeof manifest.createdAt !== "string" ||
    typeof manifest.appVersion !== "string" ||
    !Array.isArray(manifest.items)
  ) {
    return false;
  }
  return manifest.items.every((item) => {
    if (item === null) {
      return true;
    }
    if (!item || typeof item !== "object" || typeof item.kind !== "string") {
      return false;
    }
    if (item.kind === "track") {
      return isPortableTrackRef((item as { track?: unknown }).track);
    }
    if (item.kind === "tanda") {
      const tanda = item as {
        name?: unknown;
        styles?: unknown;
        rating?: unknown;
        instrumental?: unknown;
        trackRefs?: unknown;
      };
      return (
        typeof tanda.name === "string" &&
        Array.isArray(tanda.styles) &&
        tanda.styles.every((style) => typeof style === "string") &&
        typeof tanda.rating === "number" &&
        typeof tanda.instrumental === "boolean" &&
        Array.isArray(tanda.trackRefs) &&
        tanda.trackRefs.every((track) => track === null || isPortableTrackRef(track))
      );
    }
    return false;
  });
};

export const isValidTandasExportManifest = (
  value: unknown,
): value is TandasExportManifest => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const manifest = value as Partial<TandasExportManifest>;
  return (
    manifest.format === "tanda-forge-tandas" &&
    manifest.version === TANDAS_EXPORT_VERSION &&
    typeof manifest.createdAt === "string" &&
    typeof manifest.appVersion === "string" &&
    Array.isArray(manifest.tandas) &&
    manifest.tandas.every(
      (tanda) =>
        Boolean(tanda) &&
        typeof tanda === "object" &&
        typeof tanda.name === "string" &&
        Array.isArray(tanda.styles) &&
        tanda.styles.every((style) => typeof style === "string") &&
        typeof tanda.rating === "number" &&
        typeof tanda.instrumental === "boolean" &&
        Array.isArray(tanda.trackRefs) &&
        tanda.trackRefs.every((track) => track === null || isPortableTrackRef(track)),
    )
  );
};

export const parseM3uRecords = (raw: string): M3uRecord[] => {
  const records: M3uRecord[] = [];
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/);
  let stickyGroupTitle: string | undefined;
  let pendingGroupTitle: string | undefined;
  let pendingDisplayTitle: string | undefined;

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }
    if (line.startsWith("#EXTGRP:")) {
      const group = line.slice("#EXTGRP:".length).trim();
      stickyGroupTitle = group || undefined;
      pendingGroupTitle = stickyGroupTitle;
      return;
    }
    if (line.startsWith("#EXTINF:")) {
      const groupMatch = line.match(/group-title="([^"]*)"/i);
      const displayMatch = line.match(/^#EXTINF:[^,]*,(.*)$/i);
      pendingGroupTitle = groupMatch?.[1]?.trim() || stickyGroupTitle;
      pendingDisplayTitle = displayMatch?.[1]?.trim() || undefined;
      return;
    }
    if (line.startsWith("#")) {
      return;
    }
    records.push({
      location: line,
      groupTitle: pendingGroupTitle,
      displayTitle: pendingDisplayTitle,
    });
    pendingGroupTitle = stickyGroupTitle;
    pendingDisplayTitle = undefined;
  });

  return records;
};

export const parseM3uEntries = (raw: string) => parseM3uRecords(raw).map((record) => record.location);
