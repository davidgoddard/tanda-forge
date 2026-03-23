import { describe, expect, it, vi } from "vitest";
import { createSettingsLibraryController } from "../app/src/renderer/controllers/settings-library-controller";

class FakeClassList {
  private readonly values = new Set<string>();

  add(value: string) {
    this.values.add(value);
  }

  remove(value: string) {
    this.values.delete(value);
  }

  toggle(value: string, force?: boolean) {
    if (force === undefined) {
      if (this.values.has(value)) {
        this.values.delete(value);
        return false;
      }
      this.values.add(value);
      return true;
    }
    if (force) {
      this.values.add(value);
      return true;
    }
    this.values.delete(value);
    return false;
  }

  contains(value: string) {
    return this.values.has(value);
  }
}

class FakeElement {
  textContent = "";
  innerHTML = "";
  dataset: Record<string, string> = {};
  classList = new FakeClassList();
  children: FakeElement[] = [];
  disabled = false;
  value = 0;
  max = 0;

  appendChild(child: FakeElement) {
    this.children.push(child);
    return child;
  }

  querySelectorAll(selector: string) {
    return selector === "li" ? this.children : [];
  }
}

const createElements = () => ({
  errorList: new FakeElement(),
  progressEl: new FakeElement(),
  progressLabel: new FakeElement(),
  progressElSettings: new FakeElement(),
  progressLabelSettings: new FakeElement(),
  precomputeProgressElSettings: new FakeElement(),
  precomputeProgressLabelSettings: new FakeElement(),
  startupFlowBtn: new FakeElement(),
  startupFlowResult: new FakeElement(),
  startupFlowPhaseDetail: new FakeElement(),
  startupFlowProgressLabel: new FakeElement(),
  startupFlowEta: new FakeElement(),
  startupFlowProgressEl: new FakeElement(),
  startupFlowPhaseItems: [
    Object.assign(new FakeElement(), { dataset: { phase: "music" } }),
    Object.assign(new FakeElement(), { dataset: { phase: "cortina" } }),
    Object.assign(new FakeElement(), { dataset: { phase: "compression" } }),
    Object.assign(new FakeElement(), { dataset: { phase: "complete" } }),
  ],
  precomputeCompressedResult: new FakeElement(),
  precomputeCompressedBtn: new FakeElement(),
  precomputeCompressedShortcutBtn: new FakeElement(),
  scanMusicBtn: new FakeElement(),
  scanCortinasBtn: new FakeElement(),
  exportSystemBtn: new FakeElement(),
  importSystemBtn: new FakeElement(),
  systemTransferResult: new FakeElement(),
  cacheVerifyResult: new FakeElement(),
});

const createController = (elements = createElements()) =>
  createSettingsLibraryController({
    translate: (key, params) => `${key}:${params ? JSON.stringify(params) : ""}`,
    basenameForDisplay: (filePath) => filePath ?? "",
    api: {
      scanKind: vi.fn(),
      runStartupFlow: vi.fn(),
      precomputeCompressedTracks: vi.fn(async () => ({
        ok: true,
        rendered: 0,
        cached: 0,
        failed: 0,
        errors: [],
      })),
      verifyCachedFiles: vi.fn(),
      clearCachedFiles: vi.fn(),
      exportSystemData: vi.fn(),
      importSystemData: vi.fn(),
    },
    elements,
    setStatus: vi.fn(),
    clearAlert: vi.fn(),
    getCompressionConfig: () => ({
      mode: "upward",
      liftThresholdDb: -24,
      maxLiftDb: 8,
      ratio: 4,
      attackMs: 5,
      releaseMs: 250,
      gateThresholdDb: -50,
      limiterCeilingDb: -1,
      limiterReleaseMs: 150,
    }),
    scheduleCompressionPrefetch: vi.fn(),
    onScanCompleted: vi.fn(async () => {}),
    onCachedFilesCleared: vi.fn(async () => {}),
    onStartupFlowCompleted: vi.fn(async () => {}),
    onSystemImported: vi.fn(async () => {}),
  });

describe("settings library controller", () => {
  it("renders scan issues into the diagnostics list", () => {
    (globalThis as { document?: { createElement: () => FakeElement } }).document = {
      createElement: () => new FakeElement(),
    };
    const elements = createElements();
    const controller = createController(elements);

    controller.updateScanIssues([{ filePath: "/music/song.mp3", message: "bad file" }]);

    expect(elements.errorList.querySelectorAll("li")).toHaveLength(1);
    expect(elements.errorList.children[0]?.textContent).toContain("/music/song.mp3: bad file");
  });

  it("deduplicates streamed precompute errors while updating the progress label", async () => {
    (globalThis as { document?: { createElement: () => FakeElement } }).document = {
      createElement: () => new FakeElement(),
    };
    const elements = createElements();
    let resolvePrecompute: (() => void) | null = null;
    const controller = createSettingsLibraryController({
      translate: (key, params) => `${key}:${params ? JSON.stringify(params) : ""}`,
      basenameForDisplay: (filePath) => filePath ?? "",
      api: {
        scanKind: vi.fn(),
        runStartupFlow: vi.fn(),
        precomputeCompressedTracks: vi.fn(
          () =>
            new Promise((resolve) => {
              resolvePrecompute = () =>
                resolve({
                  ok: true,
                  rendered: 0,
                  cached: 0,
                  failed: 0,
                  errors: [],
                });
            }),
        ),
        verifyCachedFiles: vi.fn(),
        clearCachedFiles: vi.fn(),
        exportSystemData: vi.fn(),
        importSystemData: vi.fn(),
      },
      elements,
      setStatus: vi.fn(),
      clearAlert: vi.fn(),
      getCompressionConfig: () => ({
        mode: "upward",
        liftThresholdDb: -24,
        maxLiftDb: 8,
        ratio: 4,
        attackMs: 5,
        releaseMs: 250,
        gateThresholdDb: -50,
        limiterCeilingDb: -1,
        limiterReleaseMs: 150,
      }),
      scheduleCompressionPrefetch: vi.fn(),
      onScanCompleted: vi.fn(async () => {}),
      onCachedFilesCleared: vi.fn(async () => {}),
      onStartupFlowCompleted: vi.fn(async () => {}),
      onSystemImported: vi.fn(async () => {}),
    });

    const runPromise = controller.runPrecomputeCompressedTracks();
    controller.handlePrecomputeProgress({
      current: 2,
      total: 10,
      rendered: 0,
      cached: 1,
      failed: 1,
      currentFile: "music/Tango Dos.mp3",
      latestError: { filePath: "/music/Tango Dos.mp3", message: "ffmpeg failed" },
      done: false,
    });
    controller.handlePrecomputeProgress({
      current: 3,
      total: 10,
      rendered: 0,
      cached: 1,
      failed: 2,
      currentFile: "music/Tango Dos.mp3",
      latestError: { filePath: "/music/Tango Dos.mp3", message: "ffmpeg failed" },
      done: false,
    });
    resolvePrecompute?.();
    await runPromise;

    expect(elements.precomputeProgressLabelSettings.textContent).toContain(
      "statusPrecomputeCompressionProgressWithFile",
    );
    expect(elements.precomputeCompressedResult.textContent).toContain("ffmpeg failed");
    expect(elements.errorList.querySelectorAll("li")).toHaveLength(1);
  });

  it("reports checked and reused counts when a scan completes", async () => {
    (globalThis as { document?: { createElement: () => FakeElement } }).document = {
      createElement: () => new FakeElement(),
    };
    const elements = createElements();
    const setStatus = vi.fn();
    const onScanCompleted = vi.fn(async () => {});
    const controller = createSettingsLibraryController({
      translate: (key, params) => `${key}:${params ? JSON.stringify(params) : ""}`,
      basenameForDisplay: (filePath) => filePath ?? "",
      api: {
        scanKind: vi.fn(async () => ({
          scanned: 12,
          added: 2,
          updated: 1,
          removed: 3,
          errors: [],
        })),
        runStartupFlow: vi.fn(),
        precomputeCompressedTracks: vi.fn(async () => ({
          ok: true,
          rendered: 0,
          cached: 0,
          failed: 0,
          errors: [],
        })),
        verifyCachedFiles: vi.fn(),
        clearCachedFiles: vi.fn(),
        exportSystemData: vi.fn(),
        importSystemData: vi.fn(),
      },
      elements,
      setStatus,
      clearAlert: vi.fn(),
      getCompressionConfig: () => ({
        mode: "upward",
        liftThresholdDb: -24,
        maxLiftDb: 8,
        ratio: 4,
        attackMs: 5,
        releaseMs: 250,
        gateThresholdDb: -50,
        limiterCeilingDb: -1,
        limiterReleaseMs: 150,
      }),
      scheduleCompressionPrefetch: vi.fn(),
      onScanCompleted,
      onCachedFilesCleared: vi.fn(async () => {}),
      onStartupFlowCompleted: vi.fn(async () => {}),
      onSystemImported: vi.fn(async () => {}),
    });

    await controller.runScan("music");

    expect(setStatus).toHaveBeenCalledWith(
      'statusScanComplete:{"checked":12,"reused":9,"added":2,"updated":1,"removed":3}',
    );
    expect(onScanCompleted).toHaveBeenCalled();
  });

  it("runs the guided startup flow and reports the combined result", async () => {
    (globalThis as { document?: { createElement: () => FakeElement } }).document = {
      createElement: () => new FakeElement(),
    };
    const elements = createElements();
    const setStatus = vi.fn();
    const onStartupFlowCompleted = vi.fn(async () => {});
    const controller = createSettingsLibraryController({
      translate: (key, params) => `${key}:${params ? JSON.stringify(params) : ""}`,
      basenameForDisplay: (filePath) => filePath ?? "",
      api: {
        scanKind: vi.fn(),
        runStartupFlow: vi.fn(async () => ({
          ok: true,
          musicScan: {
            scanned: 10,
            added: 2,
            updated: 3,
            removed: 0,
            errors: [],
          },
          cortinaScan: {
            scanned: 5,
            added: 1,
            updated: 0,
            removed: 0,
            errors: [],
          },
          precompute: {
            rendered: 7,
            cached: 8,
            failed: 0,
            errors: [],
          },
        })),
        precomputeCompressedTracks: vi.fn(async () => ({
          ok: true,
          rendered: 0,
          cached: 0,
          failed: 0,
          errors: [],
        })),
        verifyCachedFiles: vi.fn(),
        clearCachedFiles: vi.fn(),
        exportSystemData: vi.fn(),
        importSystemData: vi.fn(),
      },
      elements,
      setStatus,
      clearAlert: vi.fn(),
      getCompressionConfig: () => ({
        mode: "upward",
        liftThresholdDb: -24,
        maxLiftDb: 8,
        ratio: 4,
        attackMs: 5,
        releaseMs: 250,
        gateThresholdDb: -50,
        limiterCeilingDb: -1,
        limiterReleaseMs: 150,
      }),
      scheduleCompressionPrefetch: vi.fn(),
      onScanCompleted: vi.fn(async () => {}),
      onCachedFilesCleared: vi.fn(async () => {}),
      onStartupFlowCompleted,
      onSystemImported: vi.fn(async () => {}),
    });

    await controller.runStartupFlow();

    expect(elements.startupFlowResult.textContent).toContain("startupFlowDone");
    expect(elements.errorList.querySelectorAll("li")).toHaveLength(0);
    expect(setStatus).toHaveBeenCalledWith(
      'startupFlowStatusDone:{"music":10,"cortinas":5,"rendered":7,"cached":8,"failed":0}',
    );
    expect(onStartupFlowCompleted).toHaveBeenCalled();
  });

  it("shows compressed-cache progress while the guided startup flow is running", async () => {
    (globalThis as { document?: { createElement: () => FakeElement } }).document = {
      createElement: () => new FakeElement(),
    };
    const elements = createElements();
    let resolveStartup: (() => void) | null = null;
    const controller = createSettingsLibraryController({
      translate: (key, params) => `${key}:${params ? JSON.stringify(params) : ""}`,
      basenameForDisplay: (filePath) => filePath ?? "",
      api: {
        scanKind: vi.fn(),
        runStartupFlow: vi.fn(
          () =>
            new Promise((resolve) => {
              resolveStartup = () =>
                resolve({
                  ok: true,
                  musicScan: {
                    scanned: 1,
                    added: 1,
                    updated: 0,
                    removed: 0,
                    errors: [],
                  },
                  cortinaScan: {
                    scanned: 0,
                    added: 0,
                    updated: 0,
                    removed: 0,
                    errors: [],
                  },
                  precompute: {
                    rendered: 1,
                    cached: 0,
                    failed: 0,
                    errors: [],
                  },
                });
            }),
        ),
        precomputeCompressedTracks: vi.fn(async () => ({
          ok: true,
          rendered: 0,
          cached: 0,
          failed: 0,
          errors: [],
        })),
        verifyCachedFiles: vi.fn(),
        clearCachedFiles: vi.fn(),
        exportSystemData: vi.fn(),
        importSystemData: vi.fn(),
      },
      elements,
      setStatus: vi.fn(),
      clearAlert: vi.fn(),
      getCompressionConfig: () => ({
        mode: "upward",
        liftThresholdDb: -24,
        maxLiftDb: 8,
        ratio: 4,
        attackMs: 5,
        releaseMs: 250,
        gateThresholdDb: -50,
        limiterCeilingDb: -1,
        limiterReleaseMs: 150,
      }),
      scheduleCompressionPrefetch: vi.fn(),
      onScanCompleted: vi.fn(async () => {}),
      onCachedFilesCleared: vi.fn(async () => {}),
      onStartupFlowCompleted: vi.fn(async () => {}),
      onSystemImported: vi.fn(async () => {}),
    });

    const startupPromise = controller.runStartupFlow();
    controller.handleStartupFlowProgress({ phase: "compression" });
    controller.handlePrecomputeProgress({
      current: 1,
      total: 2,
      rendered: 1,
      cached: 0,
      failed: 0,
      currentFile: "music/Legacy Alpha.wav",
      latestError: null,
      done: false,
    });
    resolveStartup?.();
    await startupPromise;

    expect(elements.precomputeProgressLabelSettings.textContent).toContain(
      "statusPrecomputeCompressionProgressWithFile",
    );
    expect(elements.startupFlowProgressLabel.textContent).toContain(
      "statusPrecomputeCompressionProgressWithFile",
    );
  });

  it("marks startup phases as skipped, current, and completed", () => {
    const elements = createElements();
    const controller = createController(elements);

    controller.handleStartupFlowProgress({ phase: "music" });
    expect(elements.startupFlowPhaseItems[0].classList.contains("current")).toBe(true);
    expect(elements.startupFlowPhaseDetail.textContent).toBe("startupFlowPhaseDetailMusic:");

    controller.handleStartupFlowProgress({ phase: "compression" });
    expect(elements.startupFlowPhaseItems[0].classList.contains("completed")).toBe(true);
    expect(elements.startupFlowPhaseItems[1].classList.contains("completed")).toBe(true);
    expect(elements.startupFlowPhaseItems[2].classList.contains("current")).toBe(true);
    expect(elements.startupFlowPhaseDetail.textContent).toBe(
      "startupFlowPhaseDetailCompression:",
    );

    controller.handleStartupFlowProgress({ phase: "complete" });
    expect(elements.startupFlowPhaseItems[2].classList.contains("completed")).toBe(true);
    expect(elements.startupFlowPhaseItems[3].classList.contains("completed")).toBe(true);
    expect(elements.startupFlowPhaseItems[3].classList.contains("current")).toBe(false);
    expect(elements.startupFlowPhaseDetail.textContent).toBe(
      "startupFlowPhaseDetailComplete:",
    );
  });

  it("waits for enough startup progress before showing a step eta", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T12:00:00Z"));
    const elements = createElements();
    let resolveStartup: (() => void) | null = null;
    const controller = createSettingsLibraryController({
      translate: (key, params) => `${key}:${params ? JSON.stringify(params) : ""}`,
      basenameForDisplay: (filePath) => filePath ?? "",
      api: {
        scanKind: vi.fn(),
        runStartupFlow: vi.fn(
          () =>
            new Promise((resolve) => {
              resolveStartup = () =>
                resolve({
                  ok: true,
                  musicScan: { scanned: 4, added: 4, updated: 0, removed: 0, errors: [] },
                  cortinaScan: { scanned: 1, added: 1, updated: 0, removed: 0, errors: [] },
                  precompute: { rendered: 5, cached: 0, failed: 0, errors: [] },
                });
            }),
        ),
        precomputeCompressedTracks: vi.fn(),
        verifyCachedFiles: vi.fn(),
        clearCachedFiles: vi.fn(),
        exportSystemData: vi.fn(),
        importSystemData: vi.fn(),
      },
      elements,
      setStatus: vi.fn(),
      clearAlert: vi.fn(),
      getCompressionConfig: () => ({
        mode: "upward",
        liftThresholdDb: -24,
        maxLiftDb: 8,
        ratio: 4,
        attackMs: 5,
        releaseMs: 250,
        gateThresholdDb: -50,
        limiterCeilingDb: -1,
        limiterReleaseMs: 150,
      }),
      scheduleCompressionPrefetch: vi.fn(),
      onScanCompleted: vi.fn(async () => {}),
      onCachedFilesCleared: vi.fn(async () => {}),
      onStartupFlowCompleted: vi.fn(async () => {}),
      onSystemImported: vi.fn(async () => {}),
    });

    const startupPromise = controller.runStartupFlow();
    controller.handleStartupFlowProgress({ phase: "music" });
    vi.advanceTimersByTime(30000);
    controller.handleScanProgress({
      current: 26,
      total: 2256,
      filePath: "music/Di Sarli - Bahia Blanca.mp3",
      rootLabel: "Music",
      errors: 0,
    });

    expect(elements.startupFlowEta.textContent).toBe("startupFlowEtaCollecting:");

    vi.advanceTimersByTime(90000);
    controller.handleScanProgress({
      current: 120,
      total: 2256,
      filePath: "music/Di Sarli - Bahia Blanca.mp3",
      rootLabel: "Music",
      errors: 0,
    });
    resolveStartup?.();
    await startupPromise;

    expect(elements.startupFlowProgressLabel.textContent).toContain("statusScanProgressWithFile");
    expect(elements.startupFlowEta.textContent).toContain("startupFlowEtaStepRough:");
    vi.useRealTimers();
  });
});
