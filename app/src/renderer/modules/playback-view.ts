export type PlaybackChannel = "main" | "headphone";

export type PlaybackTrack = {
  title?: string | null;
  artist?: string | null;
};

export type PlaybackNowState<TTrack extends PlaybackTrack> = {
  active?: { paused: boolean };
  track?: TTrack;
};

export const buildTrackLabel = <TTrack extends PlaybackTrack>(
  track: TTrack | undefined,
  unknownLabel: string,
) => {
  if (!track) {
    return unknownLabel;
  }
  const artist = track.artist?.trim();
  const title = track.title?.trim();
  if (artist && title) {
    return `${artist} — ${title}`;
  }
  return title || artist || unknownLabel;
};

export const getNowPlayingState = <
  TTrack extends PlaybackTrack,
  TState extends PlaybackNowState<TTrack>,
>(params: {
  headphone: TState;
  main: TState;
}) => {
  if (params.headphone.active && !params.headphone.active.paused) {
    return { channel: "headphone" as const, state: params.headphone };
  }
  if (params.main.active && !params.main.active.paused) {
    return { channel: "main" as const, state: params.main };
  }
  return null;
};

export const getDisplayBoardPlayingState = <
  TTrack extends PlaybackTrack,
  TState extends PlaybackNowState<TTrack>,
>(params: {
  headphone: TState;
  main: TState;
}) => {
  if (params.main.active && !params.main.active.paused) {
    return { channel: "main" as const, state: params.main };
  }
  if (params.headphone.active && !params.headphone.active.paused) {
    return { channel: "headphone" as const, state: params.headphone };
  }
  return null;
};
