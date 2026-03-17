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
  precomputeCompressedResult: new FakeElement(),
  precomputeCompressedBtn: new FakeElement(),
  precomputeCompressedShortcutBtn: new FakeElement(),
  scanMusicBtn: new FakeElement(),
  scanCortinasBtn: new FakeElement(),
  cacheVerifyResult: new FakeElement(),
});

const createController = (elements = createElements()) =>
  createSettingsLibraryController({
    translate: (key, params) => `${key}:${params ? JSON.stringify(params) : ""}`,
    basenameForDisplay: (filePath) => filePath ?? "",
    api: {
      scanKind: vi.fn(),
      precomputeCompressedTracks: vi.fn(async () => ({
        ok: true,
        rendered: 0,
        cached: 0,
        failed: 0,
        errors: [],
      })),
      verifyCachedFiles: vi.fn(),
      clearCachedFiles: vi.fn(),
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
});
