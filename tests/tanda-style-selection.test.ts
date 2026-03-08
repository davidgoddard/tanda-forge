import { describe, expect, it } from "vitest";
import {
  selectTandaVariantStyle,
  toggleTandaBaseStyle,
} from "../app/src/shared/tanda-style-selection";

describe("tanda style selection", () => {
  it("toggles a base style on and off for tanda styles", () => {
    const added = toggleTandaBaseStyle([], "Tango");
    expect(added).toEqual(["Tango"]);

    const removed = toggleTandaBaseStyle(added, "Tango");
    expect(removed).toEqual([]);
  });

  it("removes variant styles from same base when toggling base", () => {
    const next = toggleTandaBaseStyle(
      ["Milonga", "Tango - Nuevo", "Tango - Contemporary"],
      "Tango",
    );
    expect(next).toEqual(["Milonga"]);
  });

  it("replaces same-family style with selected variant", () => {
    const next = selectTandaVariantStyle(
      ["Milonga", "Tango", "Tango - Nuevo"],
      "Tango",
      "Tango - Traditional",
    );
    expect(next).toEqual(["Milonga", "Tango - Traditional"]);
  });
});

