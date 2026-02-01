import { describe, expect, it } from "vitest";
import { parseLoudnessJson } from "../app/src/main/library/analysis";

describe("parseLoudnessJson", () => {
  it("parses loudnorm JSON output", () => {
    const payload = `
      [Parsed_loudnorm_0 @ 0x7f] {
        "input_i" : "-18.2",
        "input_tp" : "-1.5",
        "input_lra" : "3.5",
        "input_thresh" : "-28.1",
        "target_offset" : "2.2",
        "target_i" : "-16.0"
      }
    `;
    const result = parseLoudnessJson(payload);
    expect(result.loudnessDb).toBeCloseTo(-18.2);
    expect(result.gainDb).toBeCloseTo(2.2);
  });

  it("ignores invalid payloads without throwing errors", () => {
    const result = parseLoudnessJson("no json");
    expect(result.error).toBeUndefined();
    expect(result.loudnessDb).toBeUndefined();
  });

  it("does not report missing JSON as an analysis error", () => {
    const result = parseLoudnessJson("not-json");
    expect(result.error).toBeUndefined();
  });
});
