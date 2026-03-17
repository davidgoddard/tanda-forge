import { describe, expect, it, vi } from "vitest";
import { createLibraryListInteractionsController } from "../app/src/renderer/controllers/library-list-interactions-controller";

class FakeClickable {
  private listener: ((event: any) => void | Promise<void>) | null = null;

  addEventListener(_type: string, listener: (event: any) => void | Promise<void>) {
    this.listener = listener;
  }

  async click(target: any) {
    await this.listener?.({ target, clientX: 10, clientY: 20 });
  }
}

describe("library list interactions controller", () => {
  it("routes search-track add-clip actions", async () => {
    const searchTracksEl = new FakeClickable() as unknown as HTMLElement;
    const row = { dataset: {}, closest: () => null } as unknown as HTMLElement;
    const track = { id: "t1" };
    const addTrackToClipboard = vi.fn();
    const activateClipboardTab = vi.fn();
    const closeRowMenus = vi.fn();
    const target = {
      closest: (selector: string) => {
        if (selector === ".list-row") {
          return row;
        }
        if (selector === "button[data-action]") {
          return { dataset: { action: "add-clip" } };
        }
        return null;
      },
      classList: { contains: () => false },
    };

    const controller = createLibraryListInteractionsController({
      elements: { searchTracksEl },
      readers: {
        getClipboardTandas: () => [],
        getClipboardTracks: () => [],
        getActiveCollectionId: () => null,
        getAppMode: () => "prep",
        isHeadphoneAvailable: () => false,
        isTrackEditorOpen: () => false,
        getTrackDataFromRow: () => ({ filePath: "/tmp/a.mp3", trackId: "t1", gainDb: null }),
        getTrackById: () => track,
        getTrackFromCache: () => null,
        resolveTandaForSearch: () => null,
        getClipboardMoveTargets: () => [],
      },
      actions: {
        handleDuplicateJump: () => false,
        toggleTandaRow: () => {},
        closeDetailMenus: () => {},
        closeRowMenus,
        toggleRowMenu: () => {},
        openTrackEditor: () => {},
        runSearchForTrack: () => {},
        runSearchForTanda: () => {},
        playOnChannel: async () => true,
        playTrackForMode: async () => {},
        updateHeadphoneButtonIndicators: () => {},
        addTrackToClipboard,
        addTandaToClipboard: () => {},
        openTandaInDesigner: () => {},
        addTrackToActiveTanda: () => true,
        appendTrackToPlaylist: () => {},
        addTandaToPlaylist: () => {},
        moveTrackBetweenClipboardCollections: () => {},
        moveTandaBetweenClipboardCollections: () => {},
        openTrackMoveTargetMenu: () => {},
        openTandaMoveTargetMenu: () => {},
        removeClipboardTrack: () => {},
        removeClipboardTanda: () => {},
        activateClipboardTab,
        setSelectedClipboardTrackId: () => {},
        setSelectedClipboardTandaId: () => {},
        renderClipboard: () => {},
        setStatusNoTandaSelected: () => {},
      },
    });

    controller.initialize();
    await (searchTracksEl as unknown as FakeClickable).click(target);

    expect(addTrackToClipboard).toHaveBeenCalledWith(track);
    expect(activateClipboardTab).toHaveBeenCalledWith("clip-tracks");
    expect(closeRowMenus).toHaveBeenCalled();
  });

  it("updates clipboard selection on clip-track row click", async () => {
    const clipTracksEl = new FakeClickable() as unknown as HTMLElement;
    const row = { dataset: {}, closest: () => null } as unknown as HTMLElement;
    const track = { id: "t2" };
    const setSelectedClipboardTrackId = vi.fn();
    const setSelectedClipboardTandaId = vi.fn();
    const renderClipboard = vi.fn();
    const playTrackForMode = vi.fn(async () => {});
    const target = {
      closest: (selector: string) => {
        if (selector === ".list-row") {
          return row;
        }
        if (selector === "button[data-action]") {
          return null;
        }
        return null;
      },
      classList: { contains: () => false },
    };

    const controller = createLibraryListInteractionsController({
      elements: { clipTracksEl },
      readers: {
        getClipboardTandas: () => [],
        getClipboardTracks: () => [{ id: "t2" }],
        getActiveCollectionId: () => null,
        getAppMode: () => "prep",
        isHeadphoneAvailable: () => false,
        isTrackEditorOpen: () => false,
        getTrackDataFromRow: () => ({ filePath: "/tmp/b.mp3", trackId: "t2", gainDb: null }),
        getTrackById: () => track,
        getTrackFromCache: () => null,
        resolveTandaForSearch: () => null,
        getClipboardMoveTargets: () => [],
      },
      actions: {
        handleDuplicateJump: () => false,
        toggleTandaRow: () => {},
        closeDetailMenus: () => {},
        closeRowMenus: () => {},
        toggleRowMenu: () => {},
        openTrackEditor: () => {},
        runSearchForTrack: () => {},
        runSearchForTanda: () => {},
        playOnChannel: async () => true,
        playTrackForMode,
        updateHeadphoneButtonIndicators: () => {},
        addTrackToClipboard: () => {},
        addTandaToClipboard: () => {},
        openTandaInDesigner: () => {},
        addTrackToActiveTanda: () => true,
        appendTrackToPlaylist: () => {},
        addTandaToPlaylist: () => {},
        moveTrackBetweenClipboardCollections: () => {},
        moveTandaBetweenClipboardCollections: () => {},
        openTrackMoveTargetMenu: () => {},
        openTandaMoveTargetMenu: () => {},
        removeClipboardTrack: () => {},
        removeClipboardTanda: () => {},
        activateClipboardTab: () => {},
        setSelectedClipboardTrackId,
        setSelectedClipboardTandaId,
        renderClipboard,
        setStatusNoTandaSelected: () => {},
      },
    });

    controller.initialize();
    await (clipTracksEl as unknown as FakeClickable).click(target);

    expect(setSelectedClipboardTrackId).toHaveBeenCalledWith("t2");
    expect(setSelectedClipboardTandaId).toHaveBeenCalledWith(null);
    expect(renderClipboard).toHaveBeenCalled();
    expect(playTrackForMode).toHaveBeenCalledWith(track, {
      filePath: "/tmp/b.mp3",
      trackId: "t2",
      gainDb: null,
    });
  });
});
