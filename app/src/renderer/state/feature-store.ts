import type {
  ClipboardCollection,
  PlaylistItem,
  PlaylistPlaybackState,
  RendererTrack,
  TandaDraft,
} from "../domain.js";

export type FeatureStore<T> = {
  getState: () => Readonly<T>;
  replace: (next: T) => void;
  update: (recipe: (current: Readonly<T>) => T) => void;
  subscribe: (listener: (state: Readonly<T>) => void) => () => void;
};

export const createFeatureStore = <T>(initial: T): FeatureStore<T> => {
  let state = initial;
  const listeners = new Set<(state: Readonly<T>) => void>();
  const replace = (next: T) => {
    if (Object.is(next, state)) return;
    state = next;
    listeners.forEach((listener) => listener(state));
  };
  return {
    getState: () => state,
    replace,
    update: (recipe) => replace(recipe(state)),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

export type PlaylistState = {
  items: Array<PlaylistItem | null>;
  targetIndex: number | null;
  trackTargetIndex: number | null;
  openTandaIndex: number | null;
  playback: PlaylistPlaybackState;
};

export type TandaEditorState = {
  drafts: TandaDraft[];
  selectedTandaId: string | null;
  hostPlaylistIndex: number | null;
};

export type ClipboardState = {
  tracks: RendererTrack[];
  tandas: TandaDraft[];
  collections: ClipboardCollection[];
  activeCollectionId: string | null;
  selectedTrackId: string | null;
  selectedTandaId: string | null;
};

export type PlaybackFeatureState = {
  mainTrackId: string | null;
  headphoneTrackId: string | null;
  cortinaPlaying: boolean;
  requestVersions: { main: number; headphone: number };
};

export const createPlaylistStateStore = (initial: PlaylistState) => createFeatureStore(initial);
export const createTandaEditorStateStore = (initial: TandaEditorState) => createFeatureStore(initial);
export const createClipboardStateStore = (initial: ClipboardState) => createFeatureStore(initial);
export const createPlaybackStateStore = (initial: PlaybackFeatureState) => createFeatureStore(initial);
