import { describe, expect, it } from "vitest";
import { getCortinaRowIndices } from "../app/src/shared/cortina-plan.js";

describe("getCortinaRowIndices", () => {
  it("returns indices for each tanda plus the end row", () => {
    const indices = getCortinaRowIndices([
      { kind: "track" },
      { kind: "tanda" },
      null,
      { kind: "tanda" },
    ]);
    expect(indices).toEqual([1, 3, 4]);
  });

  it("returns an empty array when there are no tandas", () => {
    const indices = getCortinaRowIndices([null, { kind: "track" }]);
    expect(indices).toEqual([]);
  });
});
