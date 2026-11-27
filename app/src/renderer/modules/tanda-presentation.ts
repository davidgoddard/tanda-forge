import { buildTandaArtistSortKey, restoreEquivalentArtistSpelling, summarizeTandaTracks, summarizeTrackArtist } from "../../shared/tanda-utils.js";
import type { TrackRow } from "../../shared/types.js";
import type { TandaDraft } from "../domain.js";

type TandaPresentationDeps = {
  getTrack: (id: string) => TrackRow | undefined;
  getEffectiveTrackDurationMs: (track: TrackRow | null) => number;
  formatTime: (seconds: number) => string;
  resolveNowPlayingTrackLabel: (track: TrackRow) => string;
  t: (key: string) => string;
};

export const createTandaPresentation = ({
  getTrack, getEffectiveTrackDurationMs, formatTime, resolveNowPlayingTrackLabel, t,
}: TandaPresentationDeps) => {
  const getTandaYearRange = (years: string[]) => {
    const numericYears = years
      .flatMap((year) => Array.from(year.matchAll(/\d{4}/g)).map((match) => match[0]))
      .map((year) => Number.parseInt(year, 10))
      .filter((year) => Number.isFinite(year));
    if (numericYears.length === 0) {
      return years.length > 0 ? years.join(",") : "";
    }
    const min = Math.min(...numericYears);
    const max = Math.max(...numericYears);
    if (min === max) {
      return `${min}`;
    }
    return `${min}-${max}`;
  };

  const getInstrumentalLabel = (status: string) => {
    if (status === "instrumental") {
      return t("tandaInstrumentalLabel");
    }
    if (status === "mixed") {
      return t("tandaMixedLabel");
    }
    return t("tandaNonInstrumental");
  };

  const buildTandaSummaryText = (tanda: TandaDraft, fallbackName?: string) => {
    const rawName = (tanda.name || fallbackName || "").trim();
    const tracks = tanda.trackSlots.map((trackId) =>
      trackId ? getTrack(trackId) ?? null : null,
    );
    const summary = summarizeTandaTracks(
      tracks.map((track) => {
        if (!track) {
          return null;
        }
        const artist = summarizeTrackArtist(track);
        return {
          artist,
          year: track.year,
          instrumental: track.instrumental ?? null,
        };
      }),
    );
    const artistLabel =
      summary.artists.length > 0
        ? summary.artists
            .map((artist) =>
              artist.count > 1 ? `${artist.name}(${artist.count})` : artist.name,
            )
            .join(" / ")
        : t("tandaUnknownArtist");
    const name = restoreEquivalentArtistSpelling(
      rawName,
      summary.artists.map((artist) => artist.name),
    );
    const yearLabel = summary.years.length > 0 ? summary.years.join(",") : "";
    const instrumentalLabel = getInstrumentalLabel(summary.instrumentalStatus);
    const bpmValues = tracks
      .map((track) => (track?.bpm && track.bpm > 0 ? Math.round(track.bpm) : null))
      .filter((value): value is number => value !== null);
    const bpmLabel =
      bpmValues.length === 0
        ? ""
        : Math.min(...bpmValues) === Math.max(...bpmValues)
          ? `${Math.min(...bpmValues)} bpm`
          : `${Math.min(...bpmValues)}-${Math.max(...bpmValues)} bpm`;
    const durationLabel = formatTime(
      tracks.reduce((sum, track) => sum + getEffectiveTrackDurationMs(track), 0) /
        1000,
    );
    const ratingLabel =
      tanda.rating > 0 ? `${"\u2605".repeat(Math.min(5, tanda.rating))}` : "";
    const details = [
      artistLabel,
      instrumentalLabel,
      yearLabel,
      bpmLabel,
      durationLabel,
      ratingLabel,
    ].filter((part) => part && part.trim().length > 0);
    return name ? `${name} - ${details.join(" - ")}` : details.join(" - ");
  };

  const getTandaSortKey = (tanda: TandaDraft) => {
    const tracks = tanda.trackSlots.map((trackId) =>
      trackId ? getTrack(trackId) ?? null : null,
    );
    const summary = summarizeTandaTracks(
      tracks.map((track) => {
        if (!track) {
          return null;
        }
        const artist = summarizeTrackArtist(track);
        return {
          artist,
          year: track.year,
          instrumental: track.instrumental ?? null,
        };
      }),
    );
    return buildTandaArtistSortKey(summary, t("tandaUnknownArtist"));
  };

  const buildTandaExpandedSummaryText = (
    tanda: TandaDraft,
    fallbackName?: string,
  ) => {
    const rawName = (tanda.name || fallbackName || "").trim();
    const tracks = tanda.trackSlots.map((trackId) =>
      trackId ? getTrack(trackId) ?? null : null,
    );
    const summary = summarizeTandaTracks(
      tracks.map((track) => {
        if (!track) {
          return null;
        }
        return {
          artist: summarizeTrackArtist(track),
          year: track.year,
          instrumental: track.instrumental ?? null,
        };
      }),
    );
    const name = restoreEquivalentArtistSpelling(
      rawName,
      summary.artists.map((artist) => artist.name),
    );
    const yearLabel =
      summary.years.length > 0 ? getTandaYearRange(summary.years) : "";
    const bpmValues = tracks
      .map((track) => (track?.bpm && track.bpm > 0 ? Math.round(track.bpm) : null))
      .filter((value): value is number => value !== null);
    const bpmLabel =
      bpmValues.length === 0
        ? ""
        : Math.min(...bpmValues) === Math.max(...bpmValues)
          ? `${Math.min(...bpmValues)} bpm`
          : `${Math.min(...bpmValues)}-${Math.max(...bpmValues)} bpm`;
    const durationLabel = formatTime(
      tracks.reduce((sum, track) => sum + getEffectiveTrackDurationMs(track), 0) /
        1000,
    );
    const ratingLabel =
      tanda.rating > 0 ? `${"\u2605".repeat(Math.min(5, tanda.rating))}` : "";
    const details = [yearLabel, bpmLabel, durationLabel, ratingLabel].filter(
      (part) => part && part.trim().length > 0,
    );
    return name ? (details.length > 0 ? `${name} - ${details.join(" - ")}` : name) : details.join(" - ");
  };

  type TandaDetailLine = {
    text: string;
    trackId?: string;
    slotIndex?: number;
  };

  const buildTandaDetailLines = (tanda: TandaDraft): TandaDetailLine[] => {
    const slots = tanda.trackSlots;
    const tracks = slots
      .map((trackId) => (trackId ? getTrack(trackId) ?? null : null))
      .filter(Boolean) as TrackRow[];
    if (tracks.length === 0) {
      return [{ text: t("tandaPlaceholder") }];
    }
    return slots.flatMap((trackId, slotIndex) => {
      if (!trackId) {
        return [];
      }
      const track = getTrack(trackId);
      if (!track) {
        return [];
      }
      const year = track.year?.trim() || "";
      const duration = formatTime(getEffectiveTrackDurationMs(track) / 1000);
      const yearLabel = year ? ` (${year})` : "";
      return [
        {
          text: `${resolveNowPlayingTrackLabel(track)}${yearLabel} · ${duration}`,
          trackId: track.id,
          slotIndex,
        },
      ];
    });
  };

  return { getInstrumentalLabel, buildTandaSummaryText, getTandaSortKey, buildTandaExpandedSummaryText, buildTandaDetailLines };
};
