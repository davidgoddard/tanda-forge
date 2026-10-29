import { describe, expect, it } from "vitest";
import { tandaContentsMatch } from "../app/src/shared/playlist-tanda-variant";

describe("tandaContentsMatch", () => {
  const master = {
    name: "Final tango tanda",
    styles: ["Tango"],
    rating: 4,
    trackSlots: ["one", "two", "three"],
  };

  it("treats a removed extra slot as restored to the saved master", () => {
    expect(
      tandaContentsMatch(
        { ...master, trackSlots: ["one", "two", "three", null] },
        master,
      ),
    ).toBe(true);
  });

  it("retains the variant when populated tracks or metadata differ", () => {
    expect(
      tandaContentsMatch(
        { ...master, trackSlots: ["one", "two", "three", "cumparsita"] },
        master,
      ),
    ).toBe(false);
    expect(tandaContentsMatch({ ...master, rating: 5 }, master)).toBe(false);
    expect(tandaContentsMatch({ ...master, styles: ["Milonga"] }, master)).toBe(false);
  });
});
