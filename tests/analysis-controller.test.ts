import { afterEach, expect, it, vi } from "vitest";
import { createBpmController } from "../app/src/renderer/controllers/bpm-controller";
import type { AppApi } from "../app/src/shared/types";

 afterEach(() => vi.unstubAllGlobals());

it("keeps the style selector aligned with analysis without replacing a manual edit", async () => {
  const elements = new Map<string, any>();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, {
      value: "", options: [{ value: "" }], textContent: "",
      addEventListener: vi.fn(),
      appendChild(option: unknown) { this.options.push(option); },
    });
    return elements.get(id);
  };
  vi.stubGlobal("document", { querySelector: element, createElement: () => ({ value: "", textContent: "" }) });
  let poll: () => void = () => {};
  vi.stubGlobal("window", { setInterval: (callback: () => void) => { poll = callback; } });
  let revision = 1;
  let genre: string | null = null;
  const status = () => Promise.resolve({ enabled: true, preference: "default-only", revision });
  const api = {
    getBpmStatus: status, getStyleStatus: status, permitBpm: vi.fn().mockResolvedValue(undefined),
    getTrackBpm: async () => ({ bpm: null }),
    getTrackStyle: async () => ({ genre, imported_style: genre, derived_style: genre, user_style: null }),
  } as unknown as AppApi;
  const baselineChanged = vi.fn();
  const controller = createBpmController({
    api, t: (key, params) => JSON.stringify({ key, ...params }),
    confirm: async () => true, permitted: () => true, refresh: async () => {},
    error: (message) => { throw Error(message); }, styleBaselineChanged: baselineChanged,
  });
  await controller.load("track");
  controller.fill();
  await controller.start();
  expect(element("#track-editor-genre").value).toBe("");
  genre = "Tango";
  revision++;
  poll();
  await vi.waitFor(() => expect(element("#track-editor-genre").value).toBe("Tango"));
  expect(element("#track-editor-genre").options).toContainEqual({ value: "Tango", textContent: "Tango" });
  expect(baselineChanged).toHaveBeenCalledWith("Tango");
  expect(controller.editedValues()).toEqual({});
  expect(element("#track-editor-style-details").textContent).toContain('"effective":"Tango"');
  element("#track-editor-genre").value = "Milonga";
  genre = "Vals";
  revision++;
  poll();
  await vi.waitFor(() => expect(element("#track-editor-style-details").textContent).toContain('"derived":"Vals"'));
  expect(element("#track-editor-genre").value).toBe("Milonga");
  expect(controller.editedValues()).toEqual({ genre: "Milonga" });
});
