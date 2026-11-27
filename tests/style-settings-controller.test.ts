import { afterEach, describe, expect, it, vi } from "vitest";
import { createStyleSettingsController, type StyleSettingsControllerOptions } from "../app/src/renderer/controllers/style-settings-controller";

const setup = () => {
  const options: StyleSettingsControllerOptions = {
    styleFamilies: [], availableStyles: [], getPlaylistStyleMap: () => ({}),
    STYLE_FAMILIES_KEY: "tanda-style-families", loadStyles: vi.fn(async () => {}),
    renderTandaDesigner: vi.fn(), refreshSearch: vi.fn(async () => {}), styleFamilyList: null,
    t: key => key, styleFamilyCodeInput: null, styleFamilyBaseInput: null, styleFamilyVariantsInput: null,
    LEGACY_STYLE_MAPPINGS_KEY: "tanda-legacy-style-mappings-v1", legacyStyleMappings: {},
    legacyImportRootPath: null, legacyStyleRows: [], legacyStylesResult: null,
    legacyStyleMappingEl: null, legacyStyleMappingBody: null,
  };
  return { options, controller: createStyleSettingsController(options) };
};
afterEach(() => vi.unstubAllGlobals());

describe("style settings controller", () => {
  it("reads the latest families and falls back to the latest available styles", () => {
    const { options, controller } = setup();
    expect(controller.getBaseStyles()).toEqual([]);
    options.availableStyles = ["Tango", "Milonga"];
    expect(controller.getBaseStyles()).toEqual(["Tango", "Milonga"]);
    options.styleFamilies = [{ code: "W", base: "Waltz", variants: [] }];
    expect(controller.getBaseStyles()).toEqual(["Waltz"]);
  });

  it("normalizes family updates, persists them, and refreshes dependent views", async () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem });
    vi.stubGlobal("window", {});
    const { options, controller } = setup();
    await controller.setStyleFamilies([{ code: " t ", base: "Tango", variants: ["Traditional", ""] }]);
    expect(options.styleFamilies).toEqual([{ code: "T", base: "Tango", variants: ["Traditional"] }]);
    expect(setItem).toHaveBeenCalledWith("tanda-style-families", expect.stringContaining("Tango"));
    expect(options.loadStyles).toHaveBeenCalledOnce();
    expect(options.renderTandaDesigner).toHaveBeenCalledOnce();
    expect(options.refreshSearch).toHaveBeenCalledOnce();
  });
});
