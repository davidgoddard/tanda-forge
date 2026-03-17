import { evaluateDataReadiness } from "../../shared/data-readiness.js";
import type { AppApi } from "../../shared/types.js";

export type DiagnosticsControllerDeps = {
  translate: (key: string, params?: Record<string, string | number>) => string;
  getDiagnosticsLogs: (params: { kind: "playback"; limit: number }) => Promise<{ lines: string[] }>;
  clearDiagnosticsLogs: () => Promise<unknown>;
  getDiagnosticsPaths: () => Promise<{
    userData: string;
    waveformsDir: string;
    compressedCacheDir: string;
    ffmpegPath: string;
    ffprobePath: string;
    playbackLogPath: string;
  }>;
  getDiagnosticsDataReadiness: () => Promise<{
    totalTracks: number;
    missingDuration: number;
    missingLoudness: number;
    missingTrimSignals: number;
    analysisErrors: number;
    missingWaveforms: number;
  }>;
  enumerateDevices: () => Promise<MediaDeviceInfo[]>;
  requestAudioAccess: () => Promise<void>;
  createAudioProbe: () => { setSinkId?: (sinkId: string) => Promise<void>; pause: () => void; src: string };
};

export const createSettingsDiagnosticsController = (deps: DiagnosticsControllerDeps) => {
  const renderDiagnosticsPaths = async (target: HTMLElement) => {
    target.innerHTML = "";
    try {
      const paths = await deps.getDiagnosticsPaths();
      const rows: { label: string; value: string }[] = [
        { label: deps.translate("diagnosticsPathsUserData"), value: paths.userData },
        { label: deps.translate("diagnosticsPathsWaveforms"), value: paths.waveformsDir },
        { label: deps.translate("diagnosticsPathsCompressedCache"), value: paths.compressedCacheDir },
        { label: deps.translate("diagnosticsPathsFfmpeg"), value: paths.ffmpegPath },
        { label: deps.translate("diagnosticsPathsFfprobe"), value: paths.ffprobePath },
        { label: deps.translate("diagnosticsPathsPlaybackLog"), value: paths.playbackLogPath },
      ];
      rows.forEach((row) => {
        const line = document.createElement("div");
        const label = document.createElement("strong");
        label.textContent = `${row.label}:`;
        const value = document.createElement("code");
        value.textContent = row.value;
        line.append(label, document.createTextNode(" "), value);
        target.appendChild(line);
      });
    } catch (error) {
      target.textContent = deps.translate("diagnosticsPlaybackLogFailed", {
        message: error instanceof Error ? error.message : deps.translate("statusUnknownError"),
      });
    }
  };

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

  const renderDiagnosticsDataReadiness = async (target: HTMLElement) => {
    target.textContent = deps.translate("statusWaveformLoading");
    try {
      const summary = await deps.getDiagnosticsDataReadiness();
      const rows: { label: string; value: number }[] = [
        { label: deps.translate("diagnosticsReadinessTotalTracks"), value: summary.totalTracks },
        {
          label: deps.translate("diagnosticsReadinessMissingDuration"),
          value: summary.missingDuration,
        },
        {
          label: deps.translate("diagnosticsReadinessMissingLoudness"),
          value: summary.missingLoudness,
        },
        {
          label: deps.translate("diagnosticsReadinessMissingTrimSignals"),
          value: summary.missingTrimSignals,
        },
        {
          label: deps.translate("diagnosticsReadinessAnalysisErrors"),
          value: summary.analysisErrors,
        },
        {
          label: deps.translate("diagnosticsReadinessMissingWaveforms"),
          value: summary.missingWaveforms,
        },
      ];
      target.innerHTML = "";
      rows.forEach((row) => {
        const line = document.createElement("div");
        const label = document.createElement("strong");
        label.textContent = `${row.label}:`;
        const value = document.createElement("span");
        value.textContent = `${row.value}`;
        line.append(label, document.createTextNode(" "), value);
        target.appendChild(line);
      });
    } catch (error) {
      target.textContent = deps.translate("diagnosticsPlaybackLogFailed", {
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

  const runAudioOutputProbe = async (target: HTMLElement) => {
    target.textContent = deps.translate("statusWaveformLoading");
    try {
      let devices = await deps.enumerateDevices();
      if (devices.every((device) => device.kind !== "audiooutput" || !device.label)) {
        try {
          await deps.requestAudioAccess();
          devices = await deps.enumerateDevices();
        } catch {
          // continue with best-effort labels/devices
        }
      }
      const outputs = devices.filter((device) => device.kind === "audiooutput");
      if (outputs.length === 0) {
        target.textContent = deps.translate("diagnosticsOutputProbeNoDevices");
        return;
      }
      const probe = deps.createAudioProbe();
      const setSink = probe.setSinkId;
      if (!setSink) {
        target.textContent = deps.translate("diagnosticsOutputProbeUnsupported");
        return;
      }
      const lines: string[] = [];
      for (const output of outputs) {
        const label = output.label || "(unlabeled)";
        const group = output.groupId || "-";
        const id = output.deviceId || "-";
        try {
          await setSink.call(probe, output.deviceId);
          lines.push(`PASS  ${label} | group=${group} | id=${id}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          lines.push(`FAIL  ${label} | group=${group} | id=${id} | ${message}`);
        }
      }
      probe.pause();
      probe.src = "";
      target.textContent = lines.join("\n");
    } catch (error) {
      target.textContent = deps.translate("diagnosticsOutputProbeError", {
        message: error instanceof Error ? error.message : deps.translate("statusUnknownError"),
      });
    }
  };

  return {
    renderDiagnosticsPaths,
    renderPlaybackDiagnosticsLog,
    clearPlaybackDiagnosticsLog,
    renderDiagnosticsDataReadiness,
    verifyLegacyReadiness,
    runAudioOutputProbe,
  };
};
