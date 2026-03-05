import { describe, expect, test } from "vitest";
import {
  buildFamilyStyleIndex,
  composeStyleLabel,
  deriveFamiliesFromStyles,
  expandStyleFilters,
  formatStylePillLabel,
  parseStyleFamilies,
  sortBaseStyles,
  serializeStyleFamilies,
  splitStyleLabel,
  styleFamilyMapFromFamilies,
} from "../app/src/shared/style-families";

describe("style families", () => {
  test("parses style family lines with variants", () => {
    expect(parseStyleFamilies("T=Tango:Alternative, Nuevo\nW=Waltz\nM=Milonga")).toEqual([
      { code: "T", base: "Tango", variants: ["Alternative", "Nuevo"] },
      { code: "W", base: "Waltz", variants: [] },
      { code: "M", base: "Milonga", variants: [] },
    ]);
  });

  test("serializes families deterministically", () => {
    expect(
      serializeStyleFamilies([
        { code: "t", base: " tango ", variants: ["Nuevo", "Alternative"] },
        { code: "w", base: "Waltz", variants: [] },
      ]),
    ).toBe("T=Tango:Nuevo, Alternative\nW=Waltz");
  });

  test("creates concrete style map from families", () => {
    const map = styleFamilyMapFromFamilies([
      { code: "T", base: "Tango", variants: ["Nuevo", "Traditional"] },
    ]);
    expect(map).toEqual({
      T: ["Tango", "Tango - Nuevo", "Tango - Traditional"],
    });
  });

  test("splits and composes style labels", () => {
    expect(splitStyleLabel("Tango - Nuevo")).toEqual({ base: "Tango", variant: "Nuevo" });
    expect(composeStyleLabel("Tango", "Nuevo")).toBe("Tango - Nuevo");
    expect(composeStyleLabel("Milonga")).toBe("Milonga");
  });

  test("derives families from concrete styles", () => {
    const families = deriveFamiliesFromStyles([
      "Tango",
      "Tango - Nuevo",
      "Tango - Traditional",
      "Waltz",
    ]);
    expect(families).toEqual([
      { code: "T", base: "Tango", variants: ["Nuevo", "Traditional"] },
      { code: "W", base: "Waltz", variants: [] },
    ]);
  });

  test("expands base filter to all family variants", () => {
    const index = buildFamilyStyleIndex([
      "Tango",
      "Tango - Nuevo",
      "Tango - Alternative",
      "Waltz",
    ]);
    expect(expandStyleFilters(["Tango"], index)).toEqual([
      "Tango",
      "Tango - Nuevo",
      "Tango - Alternative",
    ]);
    expect(expandStyleFilters(["Tango - Nuevo"], index)).toEqual([
      "Tango",
      "Tango - Nuevo",
      "Tango - Alternative",
    ]);
  });

  test("formats compound style pill labels using style code", () => {
    const families = parseStyleFamilies("T=Tango:Nuevo, Traditional\nW=Waltz");
    expect(formatStylePillLabel("Tango - Nuevo", families)).toBe("T - Nuevo");
    expect(formatStylePillLabel("Waltz", families)).toBe("Waltz");
    expect(formatStylePillLabel("Other - Alt", families)).toBe("Other - Alt");
  });

  test("sorts base styles with tango/waltz-milonga priority then alpha", () => {
    expect(
      sortBaseStyles(["Other", "Milonga", "Vals", "Tango", "Candombe", "Waltz"]),
    ).toEqual(["Tango", "Vals", "Waltz", "Milonga", "Candombe", "Other"]);
  });
});
