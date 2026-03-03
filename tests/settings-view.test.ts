import { describe, expect, it } from "vitest";
import { resolveOutputModeValue } from "../app/src/renderer/modules/settings-view";

describe("settings view helpers", () => {
  it("resolves live and edit modes", () => {
    expect(resolveOutputModeValue("live")).toBe("live");
    expect(resolveOutputModeValue("edit")).toBe("edit");
  });

  it("falls back to prep for unknown values", () => {
    expect(resolveOutputModeValue("weird")).toBe("prep");
  });
});
