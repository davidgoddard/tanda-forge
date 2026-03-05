import { describe, expect, it } from "vitest";
import {
  formatSequenceRule,
  parseSequence,
  parseStyleMap,
  validateSequenceCodes,
  validateSequenceSyntax,
  getSequenceRule,
  validateTandaForRule,
} from "../app/src/shared/playlist-sequence";

describe("playlist sequence parsing", () => {
  it("parses sequence tokens", () => {
    expect(parseSequence("3t 4w 3M")).toEqual([
      { count: 3, code: "T", alternatives: [{ count: 3, code: "T" }] },
      { count: 4, code: "W", alternatives: [{ count: 4, code: "W" }] },
      { count: 3, code: "M", alternatives: [{ count: 3, code: "M" }] },
    ]);
  });

  it("parses grouped alternatives", () => {
    expect(parseSequence("3t (2c 3m)")).toEqual([
      { count: 3, code: "T", alternatives: [{ count: 3, code: "T" }] },
      {
        count: 2,
        code: "C",
        alternatives: [
          { count: 2, code: "C" },
          { count: 3, code: "M" },
        ],
      },
    ]);
  });

  it("ignores invalid tokens", () => {
    expect(parseSequence("x 0t 3")).toEqual([]);
  });

  it("validates sequence syntax including unmatched brackets", () => {
    expect(validateSequenceSyntax("3t (2c 3m)").ok).toBe(true);
    expect(validateSequenceSyntax("3t (2c 3m").ok).toBe(false);
  });

  it("validates sequence codes against known style letters", () => {
    const parsed = parseSequence("3t (2c 3m) 3x");
    const result = validateSequenceCodes(parsed, ["T", "C", "M"]);
    expect(result.ok).toBe(false);
    expect(result.unknownCodes).toEqual(["X"]);
  });

  it("rejects wildcard-like codes when not configured", () => {
    const parsed = parseSequence("3t (2any 3x)");
    const result = validateSequenceCodes(parsed, ["T"]);
    expect(result.ok).toBe(false);
    expect(result.unknownCodes).toEqual(["ANY", "X"]);
  });

  it("parses style maps", () => {
    expect(parseStyleMap("T=Tango;Tango Nuevo\nW=Vals, Waltz")).toEqual({
      T: ["Tango", "Nuevo Tango"],
      W: ["Vals", "Waltz"],
    });
  });

  it("validates tanda against rule", () => {
    const rule = { count: 3, code: "T", alternatives: [{ count: 3, code: "T" }] };
    const styleMap = { T: ["Tango"] };
    expect(validateTandaForRule(3, ["Tango"], rule, styleMap).ok).toBe(true);
    expect(validateTandaForRule(4, ["Tango"], rule, styleMap).ok).toBe(false);
    expect(validateTandaForRule(3, ["Milonga"], rule, styleMap).ok).toBe(false);
  });

  it("treats reordered style words as the same style", () => {
    const rule = { count: 3, code: "T", alternatives: [{ count: 3, code: "T" }] };
    const styleMap = parseStyleMap("T=Tango Nuevo");
    expect(validateTandaForRule(3, ["Nuevo Tango"], rule, styleMap).ok).toBe(true);
  });

  it("accepts any matching alternative in a group", () => {
    const rule = {
      count: 2,
      code: "C",
      alternatives: [
        { count: 2, code: "C" },
        { count: 3, code: "M" },
      ],
    };
    const styleMap = {
      C: ["Candombe"],
      M: ["Milonga"],
    };
    expect(validateTandaForRule(2, ["Candombe"], rule, styleMap).ok).toBe(true);
    expect(validateTandaForRule(3, ["Milonga"], rule, styleMap).ok).toBe(true);
    expect(validateTandaForRule(2, ["Milonga"], rule, styleMap).ok).toBe(false);
  });

  it("matches sub-style labels when style map uses raw family labels", () => {
    const rule = { count: 3, code: "T", alternatives: [{ count: 3, code: "T" }] };
    const styleMap = {
      T: ["Tango", "Tango - Nuevo", "Tango - Traditional"],
    };
    expect(validateTandaForRule(3, ["Tango - Nuevo"], rule, styleMap).ok).toBe(true);
  });

  it("wraps sequence rules", () => {
    const sequence = parseSequence("3t 3w 3m");
    expect(getSequenceRule(sequence, 0)).toEqual({
      count: 3,
      code: "T",
      alternatives: [{ count: 3, code: "T" }],
    });
    expect(getSequenceRule(sequence, 3)).toEqual({
      count: 3,
      code: "T",
      alternatives: [{ count: 3, code: "T" }],
    });
    expect(getSequenceRule(sequence, 4)).toEqual({
      count: 3,
      code: "W",
      alternatives: [{ count: 3, code: "W" }],
    });
  });

  it("formats grouped rules for labels", () => {
    const sequence = parseSequence("3t (2c 3m)");
    expect(formatSequenceRule(sequence[0]!)).toBe("3t");
    expect(formatSequenceRule(sequence[1]!)).toBe("(2c 3m)");
  });
});
