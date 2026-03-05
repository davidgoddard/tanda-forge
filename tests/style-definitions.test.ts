import { describe, expect, it } from "vitest";
import { parseStyleDefinition } from "../app/src/shared/style-definitions";

describe("parseStyleDefinition", () => {
  it("parses canonical style and aliases from separators", () => {
    expect(parseStyleDefinition("Waltz;Vals/Valse")).toEqual({
      canonical: "Waltz",
      aliases: ["Vals", "Valse"],
    });
  });

  it("deduplicates aliases and ignores canonical repeats", () => {
    expect(parseStyleDefinition("Milonga;milonga;Milonga/ Candombe ; Candombe")).toEqual({
      canonical: "Milonga",
      aliases: ["Candombe"],
    });
  });

  it("returns empty when input has no usable style token", () => {
    expect(parseStyleDefinition(" / ; ")).toEqual({
      canonical: "",
      aliases: [],
    });
  });
});

