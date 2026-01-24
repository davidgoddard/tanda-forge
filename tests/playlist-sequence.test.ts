import { describe, expect, it } from "vitest";
import {
  parseSequence,
  parseStyleMap,
  validateTandaForRule,
} from "../app/src/shared/playlist-sequence";

describe("playlist sequence parsing", () => {
  it("parses sequence tokens", () => {
    expect(parseSequence("3t 4w 3M")).toEqual([
      { count: 3, code: "T" },
      { count: 4, code: "W" },
      { count: 3, code: "M" },
    ]);
  });

  it("ignores invalid tokens", () => {
    expect(parseSequence("x 0t 3")).toEqual([]);
  });

  it("parses style maps", () => {
    expect(parseStyleMap("T=Tango;Tango Nuevo\nW=Vals, Waltz")).toEqual({
      T: ["Tango", "Tango Nuevo"],
      W: ["Vals", "Waltz"],
    });
  });

  it("validates tanda against rule", () => {
    const rule = { count: 3, code: "T" };
    const styleMap = { T: ["Tango"] };
    expect(validateTandaForRule(3, ["Tango"], rule, styleMap).ok).toBe(true);
    expect(validateTandaForRule(4, ["Tango"], rule, styleMap).ok).toBe(false);
    expect(validateTandaForRule(3, ["Milonga"], rule, styleMap).ok).toBe(false);
  });
});
