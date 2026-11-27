import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStatisticsController, type StatisticsControllerOptions } from "../app/src/renderer/controllers/statistics-controller";
import type { TrackRow } from "../app/src/shared/types";

const charts = vi.hoisted(() => ({ renderMiniChart: vi.fn(), renderOrchestraChart: vi.fn(), renderStyleDistributionChart: vi.fn() }));
vi.mock("../app/src/renderer/modules/statistics-charts.js", () => ({ createStatisticsCharts: () => charts }));
beforeEach(() => vi.clearAllMocks());
const setup = () => {
  const options: StatisticsControllerOptions = {
    t: key => key, formatTime: String, searchDiversityModal: null,
    resolveCanonicalArtistName: name => name, orchestraRegistry: [], searchDiversityOrchestraEl: null,
    runSearchQuery: vi.fn(), setSettingsOpen: vi.fn(async () => {}), searchDiversityOpportunitiesEl: null,
    searchDiversityYearEl: null, searchDiversityTempoEl: null, searchDiversityStyleEl: null,
    searchDiversityStyleGapsEl: null, searchDiversitySummaryEl: null, playlistStatsModal: null,
    playlistItems: [], resolveTandaDraft: () => null,
    resolvePlaylistTracks: item => item?.kind === "track" ? [item.track] : [],
    getEffectiveTrackDurationMs: () => 120000, yearValue: () => 1940, playlistStatsPurityEl: null,
    playlistFilterTandaIds: null, playlistFilterOrchestra: null, setPlaylistFilterTextState: vi.fn(),
    playlistFilterInput: null, activateRightTab: vi.fn(), renderPlaylist: vi.fn(),
    playlistStatsOrchestraEl: null, playlistStatsYearEl: null, playlistStatsTempoEl: null,
  };
  return { options, controller: createStatisticsController(options) };
};

describe("statistics controller", () => {
  it("renders the latest replaced playlist instead of a construction-time snapshot", () => {
    const { options, controller } = setup();
    controller.renderPlaylistStats();
    expect(charts.renderOrchestraChart.mock.lastCall?.[1]).toEqual([]);
    options.playlistItems = [{ kind: "track", track: { id: "a", artist: "D'Arienzo", artist_summary: "", genre: "Tango", bpm: 120 } as TrackRow }];
    controller.renderPlaylistStats();
    expect(charts.renderOrchestraChart.mock.lastCall?.[1]).toEqual([{
      label: "D'Arienzo", totalSeconds: 120, styleSeconds: { Tango: 120 }, tandaCount: 0,
    }]);
    options.playlistItems = [];
    controller.renderPlaylistStats();
    expect(charts.renderOrchestraChart.mock.lastCall?.[1]).toEqual([]);
  });

  it("routes orchestra selection back to the current playlist filter and UI", () => {
    const { options, controller } = setup();
    options.playlistFilterTandaIds = new Set(["old"]);
    controller.renderPlaylistStats();
    const select = charts.renderOrchestraChart.mock.lastCall![3] as (artist: string) => void;
    select("Troilo");
    expect(options.playlistFilterOrchestra).toBe("Troilo");
    expect(options.playlistFilterTandaIds).toBeNull();
    expect(options.setPlaylistFilterTextState).toHaveBeenCalledWith("Troilo");
    expect(options.activateRightTab).toHaveBeenCalledWith("playlist-tab");
    expect(options.renderPlaylist).toHaveBeenCalledOnce();
  });
});
