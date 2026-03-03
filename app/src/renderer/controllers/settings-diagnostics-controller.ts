import { evaluateDataReadiness } from "../../shared/data-readiness.js";

export type DiagnosticsControllerDeps = {
  translate: (key: string, params?: Record<string, string | number>) => string;
  getDiagnosticsLogs: (params: { kind: "playback"; limit: number }) => Promise<{ lines: string[] }>;
  clearDiagnosticsLogs: () => Promise<unknown>;
  getDiagnosticsDataReadiness: () => Promise<{
    totalTracks: number;
    missingDuration: number;
    missingLoudness: number;
    missingTrimSignals: number;
    analysisErrors: number;
    missingWaveforms: number;
  }>;
};

export const createSettingsDiagnosticsController = (deps: DiagnosticsControllerDeps) => {
  const renderPlaybackDiagnosticsLog = async (target: HTMLElement) => {
    target.textContent = deps.translate("statusWaveformLoading");
    try {
      const payload = await deps.getDiagnosticsLogs({ kind: "playback", limit: 160 });
      target.textContent =
        payload.lines.length > 0
          ? payload.lines.join("\n")
          : deps.translate("diagnosticsPlaybackLogEmpty");
    } catch (error) {
      target.textContent = deps.translate("diagnosticsPlaybackLogFailed", {
        message: error instanceof Error ? error.message : deps.translate("statusUnknownError"),
      });
    }
  };

  const clearPlaybackDiagnosticsLog = async (target: HTMLElement) => {
    target.textContent = deps.translate("statusWaveformLoading");
    try {
      await deps.clearDiagnosticsLogs();
      target.textContent = deps.translate("diagnosticsLogsCleared");
    } catch (error) {
      target.textContent = deps.translate("diagnosticsLogsClearFailed", {
        message: error instanceof Error ? error.message : deps.translate("statusUnknownError"),
      });
    }
  };

  const verifyLegacyReadiness = async (target: HTMLElement) => {
    target.textContent = deps.translate("legacyReadinessRunning");
    try {
      const summary = await deps.getDiagnosticsDataReadiness();
      const decision = evaluateDataReadiness(summary);
      const statusText =
        decision.status === "pass"
          ? deps.translate("legacyReadinessPass")
          : decision.status === "warn"
            ? deps.translate("legacyReadinessWarn")
            : deps.translate("legacyReadinessFail");
      target.textContent = deps.translate("legacyReadinessSummary", {
        status: statusText,
        total: summary.totalTracks,
        missingDuration: summary.missingDuration,
        missingLoudness: summary.missingLoudness,
        missingTrimSignals: summary.missingTrimSignals,
        analysisErrors: summary.analysisErrors,
        missingWaveforms: summary.missingWaveforms,
      });
      return statusText;
    } catch (error) {
      target.textContent = deps.translate("diagnosticsPlaybackLogFailed", {
        message: error instanceof Error ? error.message : deps.translate("statusUnknownError"),
      });
      return null;
    }
  };

  return {
    renderPlaybackDiagnosticsLog,
    clearPlaybackDiagnosticsLog,
    verifyLegacyReadiness,
  };
};
