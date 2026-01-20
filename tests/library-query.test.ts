import { describe, expect, it } from "vitest";
import {
  buildJumpIndex,
  getSortKeySql,
  getSortSql,
  normalizeSortColumn,
  normalizeSortDirection,
} from "../app/src/main/library/query";

describe("library query helpers", () => {
  it("normalizes sort columns safely", () => {
    expect(normalizeSortColumn("title")).toBe("title");
    expect(normalizeSortColumn("artist")).toBe("artist");
    expect(normalizeSortColumn("bad")).toBe("title");
    expect(normalizeSortColumn(undefined)).toBe("title");
  });

  it("normalizes sort direction safely", () => {
    expect(normalizeSortDirection("desc")).toBe("desc");
    expect(normalizeSortDirection("asc")).toBe("asc");
    expect(normalizeSortDirection("nope")).toBe("asc");
  });

  it("maps sort sql correctly", () => {
    expect(getSortSql("duration")).toBe("duration_ms");
    expect(getSortKeySql("album")).toContain("album");
  });

  it("builds jump index with digit and symbol buckets", () => {
    const index = buildJumpIndex(["A", "B", "1", "#", "z", " "]);
    expect(index[0]).toBe("0-9");
    expect(index).toContain("A");
    expect(index).toContain("B");
    expect(index).toContain("#");
  });
});
