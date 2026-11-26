import { describe, expect, it } from "vitest";
import { buildTrackSecondaryText, visibleTrackMetadata } from "../app/src/renderer/modules/track-metadata-view";

describe("track metadata display", () => {
  it("leaves a metadata-free track blank, including legacy unknown markers", () => {
    expect(buildTrackSecondaryText({year:"?",album:" ? ",genre:null,bpm:null,notes:""})).toBe("");
    expect(buildTrackSecondaryText({genre:"?",bpm:0})).toBe("");
  });
  it("joins only available fields without empty separators", () => {
    expect(buildTrackSecondaryText({year:"1938",album:"?",genre:"Tango",bpm:63.6,notes:"?"}))
      .toBe("1938 · Tango · 64 bpm");
    expect(buildTrackSecondaryText({genre:"?",bpm:NaN,notes:"A real note?"})).toBe("A real note?");
  });
  it("preserves meaningful question marks within metadata", () => {
    expect(visibleTrackMetadata("¿Por qué? ")).toBe("¿Por qué?");
    expect(visibleTrackMetadata(" ? ")).toBe("");
    expect(visibleTrackMetadata(undefined)).toBe("");
  });
});
