import { describe, expect, it, vi } from "vitest";
import {
  createClipboardStateStore,
  createFeatureStore,
  createPlaybackStateStore,
  createTandaEditorStateStore,
} from "../app/src/renderer/state/feature-store";

describe("focused renderer feature stores", () => {
  it("applies immutable transitions and notifies subscribers", () => {
    const store = createFeatureStore({ count: 0 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.update((state) => ({ count: state.count + 1 }));
    expect(store.getState()).toEqual({ count: 1 });
    expect(listener).toHaveBeenCalledWith({ count: 1 });
    unsubscribe();
    store.replace({ count: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps tanda, clipboard, and playback transitions isolated", () => {
    const tanda = createTandaEditorStateStore({ drafts: [], selectedTandaId: null, hostPlaylistIndex: null });
    const clipboard = createClipboardStateStore({
      tracks: [], tandas: [], collections: [], activeCollectionId: null,
      selectedTrackId: null, selectedTandaId: null,
    });
    const playback = createPlaybackStateStore({
      mainTrackId: null, headphoneTrackId: null, cortinaPlaying: false,
      requestVersions: { main: 0, headphone: 0 },
    });

    tanda.update((state) => ({ ...state, selectedTandaId: "tanda-1" }));
    clipboard.update((state) => ({ ...state, selectedTrackId: "track-1" }));
    playback.update((state) => ({ ...state, mainTrackId: "track-2" }));

    expect(tanda.getState().selectedTandaId).toBe("tanda-1");
    expect(clipboard.getState().selectedTrackId).toBe("track-1");
    expect(playback.getState().mainTrackId).toBe("track-2");
  });
});
