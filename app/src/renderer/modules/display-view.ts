import { toDisplayStyleLabel } from "../../shared/now-playing.js";
import { splitStyleLabel } from "../../shared/style-families.js";

export type PlaylistPlaybackStatus = "idle" | "playing" | "paused";

export const resolveTandaDisplayStyle = (params: {
  trackStyles: Array<string | null | undefined>;
  tandaStyles?: Array<string | null | undefined>;
}) => {
  const trackStyles = params.trackStyles
    .map((style) => splitStyleLabel(style ?? ""))
    .filter(({ base }) => Boolean(base));
  const sourceStyles = trackStyles.length > 0
    ? trackStyles
    : (params.tandaStyles ?? [])
        .map((style) => splitStyleLabel(style ?? ""))
        .filter(({ base }) => Boolean(base));
  if (sourceStyles.length === 0) {
    return null;
  }
  const fullStyles = Array.from(
    new Set(sourceStyles.map(({ base, variant }) => variant ? `${base} - ${variant}` : base)),
  );
  if (fullStyles.length === 1) {
    return fullStyles[0] ?? null;
  }
  const baseStyles = Array.from(new Set(sourceStyles.map(({ base }) => base)));
  return baseStyles.join(", ");
};

export const resolveCurrentProgressText = (params: {
  playbackStatus: PlaylistPlaybackStatus;
  currentIndex: number;
  currentTrackIndex: number;
  playlistItems: Array<{ kind: "track" } | { kind: "tanda"; tandaId: string } | null>;
  resolveTandaTrackCount: (tandaId: string) => number;
  translatePlayingTrack: (index: number, count: number) => string;
}) => {
  if (params.playbackStatus !== "playing") {
    return "";
  }
  const currentItem = params.playlistItems[params.currentIndex];
  if (!currentItem) {
    return "";
  }
  if (currentItem.kind === "track") {
    return params.translatePlayingTrack(1, 1);
  }
  const count = params.resolveTandaTrackCount(currentItem.tandaId);
  if (count <= 0) {
    return "";
  }
  const index = Math.min(count, Math.max(1, params.currentTrackIndex + 1));
  return params.translatePlayingTrack(index, count);
};

export const resolveNextTandaStyle = (params: {
  isMarkedLast: boolean;
  isFinalCortinaPhase?: boolean;
  useCurrentIndexAsNext?: boolean;
  playbackStatus: PlaylistPlaybackStatus;
  resumeItemIndex: number | null;
  currentIndex: number;
  playlistItems: Array<{ kind: "track" } | { kind: "tanda"; tandaId: string } | null>;
  resolveTandaStyle: (tandaId: string) => string | null;
  shouldShowDisplayNextTanda: (status: PlaylistPlaybackStatus) => boolean;
}) => {
  if (params.isMarkedLast && params.isFinalCortinaPhase) {
    return "";
  }
  if (!params.shouldShowDisplayNextTanda(params.playbackStatus)) {
    return "";
  }
  let startIndex = 0;
  if (params.playbackStatus === "playing") {
    startIndex = params.useCurrentIndexAsNext ? params.currentIndex : params.currentIndex + 1;
  } else if (params.playbackStatus === "paused" && params.resumeItemIndex !== null) {
    startIndex = params.resumeItemIndex;
  }
  for (let i = Math.max(0, startIndex); i < params.playlistItems.length; i += 1) {
    const item = params.playlistItems[i];
    if (!item || item.kind === "track") {
      continue;
    }
    const style = toDisplayStyleLabel(params.resolveTandaStyle(item.tandaId));
    if (!style) {
      continue;
    }
    return style;
  }
  return "";
};

export const resolveNextTandaLabel = (params: {
  isMarkedLast: boolean;
  nextStyle: string;
  nextArtist?: string;
  forceLastLabel?: boolean;
  useCurrentLabel?: boolean;
  translateLast: () => string;
  translateCurrent?: (style: string) => string;
  translateNext: (style: string, artist: string) => string;
}) => {
  if (params.forceLastLabel) {
    return params.translateLast();
  }
  if (params.isMarkedLast && !params.nextStyle) {
    return params.translateLast();
  }
  if (params.nextStyle) {
    if (params.useCurrentLabel && params.translateCurrent) {
      return params.translateCurrent(params.nextStyle);
    }
    return params.translateNext(params.nextStyle, params.nextArtist ?? "");
  }
  return "";
};

export const resolveLastTandaCountdownText = (params: {
  remainingTandas: number | null;
  translateCount: (count: number) => string;
}) => {
  if (params.remainingTandas === null || params.remainingTandas <= 1) {
    return "";
  }
  const clampedCount = Math.min(5, Math.max(1, Math.trunc(params.remainingTandas)));
  return params.translateCount(clampedCount);
};
