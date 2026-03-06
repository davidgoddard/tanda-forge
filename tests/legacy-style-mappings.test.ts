import { describe, expect, it } from "vitest";
import {
  getLegacyStyleMapping,
  parseLegacyStyleMappingState,
  setLegacyStyleMapping,
  type LegacyStyleMappingState,
} from "../app/src/shared/legacy-style-mappings";

describe("legacy style mapping persistence helpers", () => {
  it("stores and resolves mappings per root path", () => {
    let state: LegacyStyleMappingState = {};
    state = setLegacyStyleMapping(state, "/legacy/a", "Tango Modern", "Tango - Modern");
    state = setLegacyStyleMapping(state, "/legacy/b", "Tango Modern", "Waltz");

    expect(getLegacyStyleMapping(state, "/legacy/a", "Tango Modern")).toBe("Tango - Modern");
    expect(getLegacyStyleMapping(state, "/legacy/b", "Tango Modern")).toBe("Waltz");
  });

  it("normalizes lookup keys and supports removal", () => {
    let state: LegacyStyleMappingState = {};
    state = setLegacyStyleMapping(state, "/legacy/a", "  Tango Modern  ", "Tango - Modern");
    expect(getLegacyStyleMapping(state, "/legacy/a", "tango modern")).toBe("Tango - Modern");

    state = setLegacyStyleMapping(state, "/legacy/a", "Tango Modern", "");
    expect(getLegacyStyleMapping(state, "/legacy/a", "tango modern")).toBe("");
  });

  it("parses persisted mapping state defensively", () => {
    expect(parseLegacyStyleMappingState("{bad")).toEqual({});
    expect(
      parseLegacyStyleMappingState(
        JSON.stringify({
          "/legacy/a": {
            "tango modern": "Tango - Modern",
            invalid: 1,
          },
          "/legacy/b": "nope",
        }),
      ),
    ).toEqual({
      "/legacy/a": {
        "tango modern": "Tango - Modern",
      },
    });
  });
});

