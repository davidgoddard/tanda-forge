import { describe, expect, it } from "vitest";
import {
  buildClipboardTandaFilterText,
  normalizeClipboardFilter,
} from "../app/src/renderer/modules/clipboard-view";

describe("clipboard view helpers", () => {
  it("normalizes filter text", () => {
    expect(normalizeClipboardFilter("  Biagi  ")).toBe("biagi");
  });

  it("builds tanda filter text from name/styles/tracks", () => {
    const text = buildClipboardTandaFilterText({
      tandaName: "Tango Trio",
      styles: ["Tango"],
      trackIds: ["a", null, "b"],
      resolveTrackText: (id) => (id === "a" ? "Biagi Lucienne" : "Pugliese"),
    });
    expect(text).toContain("tango trio");
    expect(text).toContain("biagi lucienne");
    expect(text).toContain("pugliese");
  });
});
