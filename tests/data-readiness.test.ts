import { describe, expect, it } from "vitest";
import { evaluateDataReadiness } from "../app/src/shared/data-readiness";

describe("evaluateDataReadiness", () => {
  it("fails when blockers exist", () => {
    const result = evaluateDataReadiness({
      totalTracks: 10,
      missingDuration: 1,
      missingLoudness: 0,
      missingTrimSignals: 0,
      analysisErrors: 0,
      missingWaveforms: 0,
    });
    expect(result).toEqual({
      status: "fail",
      blockers: 1,
      warnings: 0,
    });
  });

  it("warns when only waveforms are missing", () => {
    const result = evaluateDataReadiness({
      totalTracks: 10,
      missingDuration: 0,
      missingLoudness: 0,
      missingTrimSignals: 0,
      analysisErrors: 0,
      missingWaveforms: 3,
    });
    expect(result).toEqual({
      status: "warn",
      blockers: 0,
      warnings: 3,
    });
  });

  it("does not treat valid zero trim offsets as a blocker", () => {
    const result = evaluateDataReadiness({
      totalTracks: 10,
      missingDuration: 0,
      missingLoudness: 0,
      missingTrimSignals: 10,
      analysisErrors: 0,
      missingWaveforms: 0,
    });
    expect(result).toEqual({
      status: "pass",
      blockers: 0,
      warnings: 0,
    });
  });

  it("fails when compressed audio is missing", () => {
    const result = evaluateDataReadiness({
      totalTracks: 10,
      missingDuration: 0,
      missingLoudness: 0,
      missingTrimSignals: 0,
      analysisErrors: 0,
      missingWaveforms: 0,
      compressedMissing: 1,
    });
    expect(result.status).toBe("fail");
    expect(result.blockers).toBe(1);
  });

  it("passes when no blockers or warnings exist", () => {
    const result = evaluateDataReadiness({
      totalTracks: 10,
      missingDuration: 0,
      missingLoudness: 0,
      missingTrimSignals: 0,
      analysisErrors: 0,
      missingWaveforms: 0,
    });
    expect(result).toEqual({
      status: "pass",
      blockers: 0,
      warnings: 0,
    });
  });
});
