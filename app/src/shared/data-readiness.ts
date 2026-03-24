export type DataReadinessSummary = {
  totalTracks: number;
  missingDuration: number;
  missingLoudness: number;
  missingTrimSignals: number;
  analysisErrors: number;
  missingWaveforms: number;
  compressedMissing?: number;
};

export type DataReadinessDecision = {
  status: "pass" | "warn" | "fail";
  blockers: number;
  warnings: number;
};

export const evaluateDataReadiness = (
  summary: DataReadinessSummary,
): DataReadinessDecision => {
  const blockers =
    summary.missingDuration +
    summary.missingLoudness +
    summary.missingTrimSignals +
    summary.analysisErrors +
    (summary.compressedMissing ?? 0);
  const warnings = summary.missingWaveforms;
  if (summary.totalTracks <= 0 || blockers > 0) {
    return {
      status: "fail",
      blockers,
      warnings,
    };
  }
  if (warnings > 0) {
    return {
      status: "warn",
      blockers: 0,
      warnings,
    };
  }
  return {
    status: "pass",
    blockers: 0,
    warnings: 0,
  };
};
