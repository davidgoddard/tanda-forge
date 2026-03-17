import { describe, expect, it, vi } from "vitest";
import { createPanelInteractionsController } from "../app/src/renderer/controllers/panel-interactions-controller";

class FakeTarget {
  constructor(
    private readonly mapping: Record<string, any>,
    public dataset: Record<string, string> = {},
    public classList = { contains: (_token: string) => false, add: () => {}, remove: () => {} },
  ) {}

  closest(selector: string) {
    return this.mapping[selector] ?? null;
  }
}

class FakeElement {
  private listeners = new Map<string, Array<(event: any) => void | Promise<void>>>();

  addEventListener(type: string, listener: (event: any) => void | Promise<void>) {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  async dispatch(type: string, event: any) {
    for (const listener of this.listeners.get(type) ?? []) {
      await listener(event);
    }
  }
}

describe("panel interactions controller", () => {
  it("plays a tanda track row when clicking non-button row content", async () => {
    const tandaListEl = new FakeElement() as unknown as HTMLElement;
    const trackRow = new FakeTarget({}, { trackId: "t1" });
    const target = new FakeTarget({
      button: null,
      ".tanda-track-row": trackRow,
    });
    const track = { id: "t1", full_path: "/tmp/a.mp3", gain_db: -2 };
    const playTrackForMode = vi.fn(async () => true);

    const controller = createPanelInteractionsController({
      elements: {
        tandaListEl,
        panelTabButtons: [],
        documentBody: new FakeElement() as unknown as Document,
      },
      readers: {
        getTrackFromCache: () => track,
      },
      actions: {
        handleTandaAction: () => {},
        playTrackForMode,
        handleDropToTanda: () => {},
        closeRowMenus: () => {},
        closeDetailMenus: () => {},
        closeStyleVariantMenu: () => {},
        closeCollectionTargetMenu: () => {},
        setActiveSearchTab: () => {},
        updateSearchTabVisibility: () => {},
        setActiveRightTab: () => {},
        renderTandaDesigner: () => {},
      },
    });

    controller.initialize();
    await (tandaListEl as unknown as FakeElement).dispatch("click", { target });

    expect(playTrackForMode).toHaveBeenCalledWith(track, {
      filePath: "/tmp/a.mp3",
      trackId: "t1",
      gainDb: -2,
    });
  });

  it("closes menus on document click outside row and style menus", async () => {
    const documentBody = new FakeElement() as unknown as Document;
    const closeRowMenus = vi.fn();
    const closeDetailMenus = vi.fn();
    const closeStyleVariantMenu = vi.fn();
    const closeCollectionTargetMenu = vi.fn();
    const target = new FakeTarget({
      ".row-actions": null,
      ".tanda-detail-actions-right": null,
      ".style-variant-menu": null,
    });

    const controller = createPanelInteractionsController({
      elements: {
        panelTabButtons: [],
        documentBody,
      },
      readers: {
        getTrackFromCache: () => null,
      },
      actions: {
        handleTandaAction: () => {},
        playTrackForMode: async () => true,
        handleDropToTanda: () => {},
        closeRowMenus,
        closeDetailMenus,
        closeStyleVariantMenu,
        closeCollectionTargetMenu,
        setActiveSearchTab: () => {},
        updateSearchTabVisibility: () => {},
        setActiveRightTab: () => {},
        renderTandaDesigner: () => {},
      },
    });

    controller.initialize();
    await (documentBody as unknown as FakeElement).dispatch("click", { target });

    expect(closeRowMenus).toHaveBeenCalled();
    expect(closeDetailMenus).toHaveBeenCalled();
    expect(closeStyleVariantMenu).toHaveBeenCalled();
    expect(closeCollectionTargetMenu).toHaveBeenCalled();
  });
});
