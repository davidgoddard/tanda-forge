import { describe, expect, it } from "vitest";
import {
  getCortinaRowIndices,
  getUnassignedCortinaRowIndices,
} from "../app/src/shared/cortina-plan.js";

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

describe("getUnassignedCortinaRowIndices", () => {
  it("returns only cortina rows that are not yet assigned", () => {
    const indices = getUnassignedCortinaRowIndices(
      [{ kind: "tanda" }, { kind: "track" }, { kind: "tanda" }],
      [0, 3],
    );
    expect(indices).toEqual([2]);
  });

  it("returns all cortina rows when none are assigned", () => {
    const indices = getUnassignedCortinaRowIndices(
      [{ kind: "track" }, { kind: "tanda" }, null],
      [],
    );
    expect(indices).toEqual([1, 3]);
  });
});
