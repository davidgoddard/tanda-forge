import {
  extractSingerName,
  summarizeArtistName,
} from "../../shared/tanda-utils";

export type StoredTrackMetadataRow = {
  title: string | null;
  artist: string | null;
  artist_summary?: string | null;
  singer: string | null;
  tag_json: string | null;
};

const parseStoredTags = (tagJson: string | null | undefined) => {
  if (!tagJson) {
    return {} as Record<string, string>;
  }
  try {
    return JSON.parse(tagJson) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
};

export const refreshStoredTrackMetadata = (row: StoredTrackMetadataRow) => {
  const tags = parseStoredTags(row.tag_json);
  const title = (tags.title || tags.track || row.title || "").trim();
  const artist = (tags.artist || row.artist || "").trim();
  const singerFromTags =
    tags.singer ||
    tags.performer ||
    tags.vocalist ||
    tags["lead_performer"] ||
    tags["lead performer"] ||
    tags.soloist ||
    "";
  const singer = (singerFromTags || extractSingerName(artist, title) || "").trim();
  const artistSummary = artist ? summarizeArtistName(artist) : "";
  return {
    title,
    artist,
    artistSummary,
    singer,
  };
};

export const storedTrackMetadataNeedsRefresh = (
  row: StoredTrackMetadataRow,
  refreshed: ReturnType<typeof refreshStoredTrackMetadata>,
) =>
  (row.title ?? "").trim() !== refreshed.title ||
  (row.artist ?? "").trim() !== refreshed.artist ||
  (row.artist_summary ?? "").trim() !== refreshed.artistSummary ||
  (row.singer ?? "").trim() !== refreshed.singer;
