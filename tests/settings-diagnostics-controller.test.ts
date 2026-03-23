import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSettingsDiagnosticsController } from "../app/src/renderer/controllers/settings-diagnostics-controller";

type FakeNode = {
  textContent: string;
};

type FakeElement = FakeNode & {
  innerHTML: string;
  children: FakeNode[];
  appendChild: (child: FakeNode) => void;
  append: (...children: FakeNode[]) => void;
};

const createFakeTextNode = (text: string): FakeNode => ({
  textContent: text,
});

const createFakeElement = (): FakeElement => ({
  textContent: "",
  innerHTML: "",
  children: [],
  appendChild(child) {
    this.children.push(child);
    this.textContent += child.textContent;
  },
  append(...children) {
    children.forEach((child) => this.appendChild(child));
  },
});

const createDeps = () => ({
  translate: (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
  pickFfmpegToolsDir: async () => "/custom/tools",
  getFfmpegToolsDir: async () => ({ path: "/custom/tools" }),
  setFfmpegToolsDir: async (path: string | null) => ({ path: path ?? "" }),
  getDiagnosticsPaths: async () => ({
    userData: "/data",
    waveformsDir: "/data/waveforms",
    compressedCacheDir: "/data/compressed",
    ffmpegPath: "/tools/ffmpeg",
    ffmpegSource: "bundled" as const,
    ffprobePath: "/tools/ffprobe",
    ffprobeSource: "path" as const,
    ffmpegToolsDir: "/custom/tools",
    playbackLogPath: "/data/playback.log",
  }),
  getDiagnosticsLogs: async () => ({ lines: ["a", "b"] }),
  clearDiagnosticsLogs: async () => {},
  getDiagnosticsDataReadiness: async () => ({
    totalTracks: 1,
    missingDuration: 0,
    missingLoudness: 0,
    missingTrimSignals: 0,
    analysisErrors: 0,
    missingWaveforms: 0,
    shortDurationTracks: [],
    aggressivelyTrimmedTracks: [],
  }),
  enumerateDevices: async () => [],
  requestAudioAccess: async () => {},
  createAudioProbe: () => ({
    setSinkId: async () => {},
    pause: () => {},
    src: "",
  }),
});

const createController = () => createSettingsDiagnosticsController(createDeps());

describe("settings diagnostics controller", () => {
  beforeEach(() => {
    (globalThis as { document?: unknown }).document = {
      createElement: () => createFakeElement(),
      createTextNode: (text: string) => createFakeTextNode(text),
    };
  });

  it("renders playback diagnostics lines", async () => {
    const target = createFakeElement() as unknown as HTMLElement;
    const controller = createController();

    await controller.renderPlaybackDiagnosticsLog(target);

    expect(target.textContent).toContain("a");
    expect(target.textContent).toContain("b");
  });

  it("renders diagnostics paths", async () => {
    const target = createFakeElement() as unknown as HTMLElement;
    const controller = createController();

    await controller.renderDiagnosticsPaths(target);

    expect(target.textContent).toContain("diagnosticsPathsUserData");
    expect(target.textContent).toContain("/data/waveforms");
    expect(target.textContent).toContain("/data/playback.log");
    expect(target.textContent).toContain("diagnosticsBinarySourceBundled");
    expect(target.textContent).toContain("diagnosticsBinarySourcePath");
  });

  it("renders and updates ffmpeg tools folder state", async () => {
    const target = createFakeElement() as unknown as HTMLElement;
    const controller = createController();

    await controller.renderFfmpegToolsDir(target);
    expect(target.textContent).toContain("/custom/tools");

    await controller.clearFfmpegToolsDir(target);
    expect(target.textContent).toContain("diagnosticsFfmpegToolsDirUnset");
  });

  it("renders diagnostics readiness summary rows", async () => {
    const target = createFakeElement() as unknown as HTMLElement;
    const controller = createController();

    await controller.renderDiagnosticsDataReadiness(target);

    expect(target.textContent).toContain("diagnosticsReadinessTotalTracks");
    expect(target.textContent).toContain("diagnosticsReadinessMissingWaveforms");
  });

  it("renders suspicious track length issues", async () => {
    const target = createFakeElement() as unknown as HTMLElement;
    const controller = createSettingsDiagnosticsController({
      ...createDeps(),
      getDiagnosticsDataReadiness: async () => ({
        totalTracks: 2,
        missingDuration: 0,
        missingLoudness: 0,
        missingTrimSignals: 0,
        analysisErrors: 0,
        missingWaveforms: 0,
        shortDurationTracks: [
          {
            id: "track-1",
            title: "Short Song",
            relativePath: "Tango/short.mp3",
            durationMs: 42000,
            effectiveDurationMs: 42000,
            removedMs: 0,
          },
        ],
        aggressivelyTrimmedTracks: [
          {
            id: "track-2",
            title: "Trimmed Song",
            relativePath: "Tango/trimmed.mp3",
            durationMs: 180000,
            effectiveDurationMs: 145000,
            removedMs: 35000,
          },
        ],
      }),
    });

    await controller.renderDiagnosticsTrackLengthIssues(target);

    expect(target.textContent).toContain("diagnosticsTrackLengthShortHeading");
    expect(target.textContent).toContain("Short Song");
    expect(target.textContent).toContain("Trimmed Song");
    expect(target.textContent).toContain("diagnosticsTrackLengthTrimHeading");
  });

  it("runs an audio output probe", async () => {
    const target = createFakeElement() as unknown as HTMLElement;
    const setSinkId = vi.fn(async () => {});
    const controller = createSettingsDiagnosticsController({
      translate: (key, params) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
      pickFfmpegToolsDir: async () => null,
      getFfmpegToolsDir: async () => ({ path: "" }),
      setFfmpegToolsDir: async (path) => ({ path: path ?? "" }),
      getDiagnosticsPaths: async () => ({
        userData: "/data",
        waveformsDir: "/data/waveforms",
        compressedCacheDir: "/data/compressed",
        ffmpegPath: "/tools/ffmpeg",
        ffmpegSource: "bundled",
        ffprobePath: "/tools/ffprobe",
        ffprobeSource: "bundled",
        ffmpegToolsDir: "",
        playbackLogPath: "/data/playback.log",
      }),
      getDiagnosticsLogs: async () => ({ lines: [] }),
      clearDiagnosticsLogs: async () => {},
      getDiagnosticsDataReadiness: async () => ({
        totalTracks: 1,
        missingDuration: 0,
        missingLoudness: 0,
        missingTrimSignals: 0,
        analysisErrors: 0,
        missingWaveforms: 0,
        shortDurationTracks: [],
        aggressivelyTrimmedTracks: [],
      }),
      enumerateDevices: async () =>
        [
          {
            kind: "audiooutput",
            label: "Main Out",
            groupId: "group-1",
            deviceId: "device-1",
          },
        ] as MediaDeviceInfo[],
      requestAudioAccess: async () => {},
      createAudioProbe: () => ({
        setSinkId,
        pause: () => {},
        src: "",
      }),
    });

    await controller.runAudioOutputProbe(target);

    expect(setSinkId).toHaveBeenCalledWith("device-1");
    expect(target.textContent).toContain("PASS  Main Out");
  });
});
