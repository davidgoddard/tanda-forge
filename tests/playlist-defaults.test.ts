import { describe, expect, it } from "vitest";
import { getDefaultSlotSize, getDefaultStylesForRule } from "../app/src/shared/playlist-defaults";

const rule = (count: number, code = "T") => ({ count, code });

describe("playlist defaults", () => {
  it("uses rule count when provided", () => {
    expect(getDefaultSlotSize(rule(3), 5)).toBe(3);
  });

  it("falls back to default size when no rule", () => {
    expect(getDefaultSlotSize(null, 4)).toBe(4);
  });

  it("returns mapped styles for rule codes", () => {
    const styles = getDefaultStylesForRule(rule(3, "T"), { T: ["tango"] });
    expect(styles).toEqual(["tango"]);
  });

  it("returns empty styles for ANY rule", () => {
    const styles = getDefaultStylesForRule(rule(3, "ANY"), { T: ["tango"] });
    expect(styles).toEqual([]);
  });
});
