import { afterEach, describe, expect, it, vi } from "vitest";
import { createAudioSimilarityController, type AudioSimilarityControllerOptions } from "../app/src/renderer/controllers/audio-similarity-controller";
import type { AudioSimilarityReport } from "../app/src/shared/audio-similarity";

const report = (state: AudioSimilarityReport["status"]["state"] = "idle"): AudioSimilarityReport => ({
  hasCompletedReport: false,
  status: { state, runId: null, totalTracks: 0, processedTracks: 0, failedTracks: 0, candidatePairs: 0, matchingPairs: 0, comparisonPairsProcessed: 0, comparisonPairsTotal: 0, staleTracks: 0, startedAt: null, completedAt: null, error: null },
  integrity: { algorithmVersion: 1, activeTracks: 0, readyTracks: 0, staleTracks: 0, orphanedFeatures: 0, orphanedConfirmedMembers: 0, healthy: true },
  candidateGroups: [], confirmedGroups: [], failures: [], hiddenTrackIds: [], hiddenTracks: [],
});
const setup = () => {
  const getAudioSimilarityReport = vi.fn(async () => report());
  const setTimeout = vi.fn((_callback: () => void, _delay: number) => 42);
  const clearTimeout = vi.fn();
  vi.stubGlobal("window", { tanda: { getAudioSimilarityReport }, setTimeout, clearTimeout });
  vi.stubGlobal("localStorage", { getItem: () => null });
  const closeHandlers = new Map<string, () => void>();
  const options: AudioSimilarityControllerOptions = {
    t: key => key, releaseAudioDspRuntime: vi.fn(async () => {}),
    audioSimilarityGroups: null, audioSimilaritySummary: null, audioSimilaritySearch: null,
    audioSimilarityStatus: null, generateAudioSimilarityBtn: null, cancelAudioSimilarityBtn: null,
    showConfirmModal: vi.fn(async () => true), renderAllLists: vi.fn(), formatTime: String,
    trackCache: new Map(), updateTrackCaches: vi.fn(), openTrackEditor: vi.fn(async () => {}),
    tandaCache: new Map(), loadTandaDrafts: vi.fn(async () => {}), setStatus: vi.fn(),
    buildDetailMenuButton: () => { throw new Error("Unexpected render"); }, closeDetailMenus: vi.fn(),
    buildActionButton: () => { throw new Error("Unexpected render"); }, runSearchForTrack: vi.fn(),
    stopMainForSimilarityAudition: vi.fn(async () => {}), resolveOutputDeviceIdForChannel: () => null,
    shouldUseAudioDspForOutput: () => false, ensureAudioDspRuntime: vi.fn(), setAudioLevel: vi.fn(),
    gainForTrack: () => 1, applyOutputDevice: vi.fn(async () => ({ appliedDeviceId: null })),
    invalidateTrackTandaUsage: vi.fn(), openAudioSimilarityBtn: null, audioSimilarityPage: null,
    closeAudioSimilarityBtn: { addEventListener: (event: string, callback: () => void) => closeHandlers.set(event, callback) } as unknown as HTMLButtonElement,
  };
  const controller = createAudioSimilarityController(options);
  return { controller, options, getAudioSimilarityReport, setTimeout, clearTimeout, closeHandlers };
};
afterEach(() => vi.unstubAllGlobals());

describe("audio similarity controller lifecycle", () => {
  it("does not fetch a report merely by constructing or registering the feature", () => {
    const { controller, getAudioSimilarityReport } = setup();
    controller.initAudioSimilarityInteractions();
    expect(getAudioSimilarityReport).not.toHaveBeenCalled();
  });

  it("publishes refreshed indexes to callers instead of retaining an old map snapshot", async () => {
    const { controller, options, getAudioSimilarityReport } = setup();
    getAudioSimilarityReport.mockResolvedValueOnce({ ...report(), hiddenTrackIds: ["old"] });
    await controller.loadAudioSimilarityReport();
    expect(controller.similarityHiddenTrackIds.has("old")).toBe(true);
    await controller.loadAudioSimilarityReport();
    expect(controller.similarityHiddenTrackIds.size).toBe(0);
    expect(options.invalidateTrackTandaUsage).toHaveBeenCalledTimes(2);
  });

  it("replaces polling while analysis runs, then stops polling once it completes", async () => {
    const { controller, getAudioSimilarityReport, setTimeout, clearTimeout } = setup();
    getAudioSimilarityReport.mockResolvedValueOnce(report("running")).mockResolvedValueOnce(report("cancelling"));
    await controller.loadAudioSimilarityReport();
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 750);
    await controller.loadAudioSimilarityReport();
    expect(clearTimeout).toHaveBeenCalledWith(42);
    expect(setTimeout).toHaveBeenCalledTimes(2);
    await controller.loadAudioSimilarityReport();
    expect(setTimeout).toHaveBeenCalledTimes(2);
    expect(clearTimeout).toHaveBeenCalledTimes(2);
  });

  it("cancels the report poll when the report closes", async () => {
    const { controller, getAudioSimilarityReport, closeHandlers, clearTimeout } = setup();
    controller.initAudioSimilarityInteractions();
    getAudioSimilarityReport.mockResolvedValueOnce(report("running"));
    await controller.loadAudioSimilarityReport();
    closeHandlers.get("click")!();
    expect(clearTimeout).toHaveBeenCalledWith(42);
  });
});
