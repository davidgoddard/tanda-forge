import { describe, expect, it, vi } from "vitest";
import { createPlaylistInteractionsController } from "../app/src/renderer/controllers/playlist-interactions-controller";

class FakeClickable {
  private listeners = new Map<string, (event: any) => void | Promise<void>>();

  addEventListener(type: string, listener: (event: any) => void | Promise<void>) {
    this.listeners.set(type, listener);
  }

  async dispatch(type: string, event: any) {
    await this.listeners.get(type)?.(event);
  }
}

const createBaseDeps = () => {
  const playlistPanel = new FakeClickable() as unknown as HTMLElement;
  const playlistListEl = new FakeClickable() as unknown as HTMLElement;
  const addTandaBtn = new FakeClickable() as unknown as HTMLElement;
  const playlistItems: any[] = [];

  return {
    playlistPanel,
    playlistListEl,
    addTandaBtn,
    playlistItems,
    deps: {
      elements: {
        playlistPanel,
        playlistListEl,
        addTandaBtn,
      },
      readers: {
        getHeadphoneAvailable: () => false,
        getTrackDataFromRow: () => null,
        getTrackFromCache: () => null,
        getTrackById: () => null,
        resolveTandaForSearch: () => null,
        resolvePlaylistRowIndex: () => 0,
        resolveSearchStylesForPlaylistIndex: () => undefined,
        isCortinaIndexEditable: () => true,
        isPlaylistIndexLocked: () => false,
        isPlaylistTandaSlotLocked: () => false,
        getPlaylistTargetIndex: () => null,
        getPlaylistTrackTargetIndex: () => null,
        getPlaylistItems: () => playlistItems,
        getPlaylistOpenTandaIndex: () => null,
        getRuleForSlot: () => null,
        getPlaylistStyleMap: () => ({}),
        getSelectedTandaId: () => null,
        getSelectedClipboardTandaId: () => null,
        getSelectedClipboardTrackId: () => null,
        getClipboardTandas: () => [],
        getClipboardTracks: () => [],
        getActiveCollection: () => null,
        getAppMode: () => "prep",
        isMainPlaying: () => false,
        shouldStartPlaylistFromClick: () => true,
        resolveTandaDraft: () => null,
      },
      actions: {
        handleDropToPlaylist: () => {},
        createEmptyTanda: () => ({ id: "draft-1" }),
        appendTandaDraft: () => {},
        setActiveTanda: () => {},
        openCortinaModal: () => {},
        toggleTandaRow: () => {},
        closeDetailMenus: () => {},
        closeRowMenus: () => {},
        openTrackEditor: () => {},
        playOnChannel: async () => true,
        runSearchForTanda: () => {},
        runSearchForTrack: () => {},
        toggleRowMenu: () => {},
        clearPlaylistTarget: () => {},
        retainPlaylistTargetAtIndex: () => 0,
        retainPlaylistTrackTargetAtIndex: () => 0,
        applyPlaylistTargetStyles: () => {},
        setPlaylistTargetIndex: () => {},
        setCenterPlaylistTargetOnNextRender: () => {},
        renderPlaylist: () => {},
        setStatusPlaylistLocked: () => {},
        setStatusPlaylistSwapInvalid: () => {},
        setStatusClipboardReadonlyRemove: () => {},
        setStatusCortinaLocked: () => {},
        markPlaylistPulse: () => {},
        validateTandaForSlot: () => ({ reason: null }),
        confirmPlaylistCountOverride: () => {},
        confirmPlaylistStyleOverride: () => {},
        setPlaylistItem: (index: number, item: any) => {
          playlistItems[index] = item;
        },
        setPlaylistOpenTandaIndex: () => {},
        ensurePlaylistEditableTanda: () => null,
        createPlaceholderTanda: (tandaId: string) => ({ id: tandaId }),
        openTandaInDesigner: () => {},
        addTandaToActiveCollection: () => true,
        addTrackToActiveCollection: () => true,
        normalizePlaylist: () => {},
        renderClipboard: () => {},
        setSelectedStylesFromRule: () => {},
        createPlaylistTandaForSlot: (index: number) => ({ id: `slot-${index}`, trackSlots: [], styles: [] }),
        ensureTandaDraft: () => {},
        startPlaylistFrom: () => {},
        setSelectedClipboardTandaId: () => {},
        setSelectedClipboardTrackId: () => {},
        saveClipboardCollections: () => {},
        placeTandaInPlaylistSlot: () => true,
        playTrackForMode: async () => {},
        refreshPlaylistTandaStyles: () => {},
        setTrackInCache: () => {},
        updateHeadphoneButtonIndicators: () => {},
        getSequenceLabel: () => "rule",
        getTandaSequenceLabel: () => "tanda",
      },
    },
  };
};

describe("playlist interactions controller", () => {
  it("creates and activates a new tanda from the add button", async () => {
    const appendTandaDraft = vi.fn();
    const setActiveTanda = vi.fn();
    const { addTandaBtn, deps } = createBaseDeps();
    deps.actions.appendTandaDraft = appendTandaDraft;
    deps.actions.setActiveTanda = setActiveTanda;

    const controller = createPlaylistInteractionsController(deps as any);
    controller.initialize();
    await (addTandaBtn as unknown as FakeClickable).dispatch("click", {});

    expect(appendTandaDraft).toHaveBeenCalledWith({ id: "draft-1" });
    expect(setActiveTanda).toHaveBeenCalledWith("draft-1");
  });

  it("starts playlist playback immediately from a prep-mode tanda detail click", async () => {
    const startPlaylistFrom = vi.fn();
    const { playlistListEl, deps } = createBaseDeps();
    deps.actions.startPlaylistFrom = startPlaylistFrom;
    deps.readers.getPlaylistItems = () => [{ kind: "tanda", tandaId: "tg1" }];
    const row = {
      dataset: { index: "0", tandaId: "tg1" },
      classList: { contains: () => false },
      closest: () => null,
    } as unknown as HTMLElement;
    const detailLine = {
      dataset: { trackId: "track-2", slotIndex: "1" },
      classList: { contains: () => false, add: () => {}, remove: () => {} },
    } as unknown as HTMLElement;
    const target = {
      closest: (selector: string) => {
        if (selector === ".list-row") {
          return row;
        }
        if (selector === "#playlist-tanda-editor") {
          return null;
        }
        if (selector === ".tanda-detail-line") {
          return detailLine;
        }
        if (selector === "button[data-action]") {
          return null;
        }
        if (selector === ".tanda-summary") {
          return null;
        }
        return null;
      },
      classList: { contains: () => false },
    };

    const controller = createPlaylistInteractionsController(deps as any);
    controller.initialize();
    await (playlistListEl as unknown as FakeClickable).dispatch("click", { target });

    expect(startPlaylistFrom).toHaveBeenCalledWith(0, "track-2");
  });

  it("marks a playlist target and requests rerender", async () => {
    const applyPlaylistTargetStyles = vi.fn();
    const setCenterPlaylistTargetOnNextRender = vi.fn();
    const renderPlaylist = vi.fn();
    const closeRowMenus = vi.fn();
    const { playlistListEl, deps } = createBaseDeps();
    deps.actions.applyPlaylistTargetStyles = applyPlaylistTargetStyles;
    deps.actions.setCenterPlaylistTargetOnNextRender = setCenterPlaylistTargetOnNextRender;
    deps.actions.renderPlaylist = renderPlaylist;
    deps.actions.closeRowMenus = closeRowMenus;
    const row = {
      dataset: { index: "3" },
      classList: { contains: () => false },
      closest: () => null,
    } as unknown as HTMLElement;
    const actionButton = { dataset: { action: "mark-playlist-target" } };
    const target = {
      closest: (selector: string) => {
        if (selector === ".list-row") {
          return row;
        }
        if (selector === "#playlist-tanda-editor") {
          return null;
        }
        if (selector === "button[data-action]") {
          return actionButton;
        }
        if (selector === ".tanda-summary") {
          return null;
        }
        return null;
      },
      classList: { contains: () => false },
    };

    const controller = createPlaylistInteractionsController(deps as any);
    controller.initialize();
    await (playlistListEl as unknown as FakeClickable).dispatch("click", { target });

    expect(applyPlaylistTargetStyles).toHaveBeenCalledWith(0);
    expect(setCenterPlaylistTargetOnNextRender).toHaveBeenCalledWith(true);
    expect(renderPlaylist).toHaveBeenCalled();
    expect(closeRowMenus).toHaveBeenCalled();
  });
});
