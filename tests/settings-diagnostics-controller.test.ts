import { describe, expect, it } from "vitest";
import { createSettingsDiagnosticsController } from "../app/src/renderer/controllers/settings-diagnostics-controller";

describe("settings diagnostics controller", () => {
  it("renders playback diagnostics lines", async () => {
    const target = { textContent: "" } as HTMLElement;
    const controller = createSettingsDiagnosticsController({
      translate: (key) => key,
      getDiagnosticsLogs: async () => ({ lines: ["a", "b"] }),
      clearDiagnosticsLogs: async () => {},
      getDiagnosticsDataReadiness: async () => ({
        totalTracks: 1,
        missingDuration: 0,
        missingLoudness: 0,
        missingTrimSignals: 0,
        analysisErrors: 0,
        missingWaveforms: 0,
      }),
    });

    await controller.renderPlaybackDiagnosticsLog(target);
    expect(target.textContent).toContain("a");
  });
});
