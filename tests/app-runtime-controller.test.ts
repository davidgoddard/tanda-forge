import { describe, expect, it, vi } from "vitest";
import { createAppRuntimeController } from "../app/src/renderer/controllers/app-runtime-controller";

class FakeTarget {
  private listeners = new Map<string, (event: any) => void | Promise<void>>();

  addEventListener(type: string, listener: (event: any) => void | Promise<void>) {
    this.listeners.set(type, listener);
  }

  async dispatch(type: string, event: any = {}) {
    await this.listeners.get(type)?.(event);
  }
}

describe("app runtime controller", () => {
  it("toggles search sort direction and marks manual sort", async () => {
    const button = new FakeTarget() as unknown as HTMLElement;
    (button as any).dataset = { sort: "title" };
    const patchSearchState = vi.fn();
    const updateSortButtons = vi.fn();
    const refreshSearch = vi.fn();

    const controller = createAppRuntimeController({
      elements: {
        searchSortButtons: [button],
        documentBody: new FakeTarget() as unknown as Document,
        windowObject: new FakeTarget() as unknown as Window,
      },
      readers: {
        getSearchState: () => ({ sortBy: "title", sortDir: "asc" }),
        shouldBlockBeforeUnload: () => false,
      },
      actions: {
        scheduleSearch: () => {},
        refreshSearch,
        patchSearchState,
        updateSortButtons,
        handleSearchScroll: () => {},
        handleDropToClipboard: () => {},
        ensureAudioOutputs: async () => {},
        renderAllLists: () => {},
        markUserInteraction: () => {},
      },
    });

    controller.initialize();
    await (button as unknown as FakeTarget).dispatch("click");

    expect(patchSearchState).toHaveBeenCalledWith({ sortDir: "desc" });
    expect(patchSearchState).toHaveBeenCalledWith({ sortMode: "manual" });
    expect(updateSortButtons).toHaveBeenCalled();
    expect(refreshSearch).toHaveBeenCalled();
  });

  it("prevents unload when runtime says playback is active", async () => {
    const windowObject = new FakeTarget() as unknown as Window;
    const event = { preventDefault: vi.fn() };

    const controller = createAppRuntimeController({
      elements: {
        searchSortButtons: [],
        documentBody: new FakeTarget() as unknown as Document,
        windowObject,
      },
      readers: {
        getSearchState: () => ({ sortBy: "score", sortDir: "desc" }),
        shouldBlockBeforeUnload: () => true,
      },
      actions: {
        scheduleSearch: () => {},
        refreshSearch: () => {},
        patchSearchState: () => {},
        updateSortButtons: () => {},
        handleSearchScroll: () => {},
        handleDropToClipboard: () => {},
        ensureAudioOutputs: async () => {},
        renderAllLists: () => {},
        markUserInteraction: () => {},
      },
    });

    controller.initialize();
    await (windowObject as unknown as FakeTarget).dispatch("beforeunload", event);

    expect(event.preventDefault).toHaveBeenCalled();
  });
});
