import { createStatisticsCharts } from "../modules/statistics-charts.js";
import { normalizeStyleName } from "../../shared/tanda-utils.js";
import { aggregateOrchestraDurations, buildAdaptiveNumericDistribution, buildAdaptiveStyleNumericDistribution, findTandaPurityIssues } from "../../shared/playlist-diversity.js";
import { toDisplayStyleLabel } from "../../shared/now-playing.js";
import type { TandaPurityIssue } from "../../shared/playlist-diversity.js";
import type { PlaylistItem, TandaDraft } from "../domain.js";
import type { TrackRow } from "../../shared/types.js";
import type { SearchTab, RightPanelTab } from "../../shared/state/renderer-ui-store.js";
import type { OrchestraRegistryEntry } from "../../shared/orchestra-registry.js";



export interface StatisticsControllerOptions {
  t: (key: string, params?: Record<string, string | number>) => string;
  formatTime: (seconds: number) => string;
  searchDiversityModal: HTMLElement | null;
  resolveCanonicalArtistName: (rawArtist: string) => string;
  orchestraRegistry: OrchestraRegistryEntry[];
  searchDiversityOrchestraEl: HTMLDivElement | null;
  runSearchQuery: (query: string, allowEmpty?: boolean, preferredTab?: SearchTab) => void;
  setSettingsOpen: (open: boolean) => Promise<void>;
  searchDiversityOpportunitiesEl: HTMLDivElement | null;
  searchDiversityYearEl: HTMLDivElement | null;
  searchDiversityTempoEl: HTMLDivElement | null;
  searchDiversityStyleEl: HTMLDivElement | null;
  searchDiversityStyleGapsEl: HTMLDivElement | null;
  searchDiversitySummaryEl: HTMLDivElement | null;
  playlistStatsModal: HTMLElement | null;
  playlistItems: (PlaylistItem | null)[];
  resolveTandaDraft: (tandaId: string) => TandaDraft | null;
  resolvePlaylistTracks: (item: PlaylistItem | null) => TrackRow[];
  getEffectiveTrackDurationMs: (track: TrackRow | null) => number;
  yearValue: (track: TrackRow) => number | null;
  playlistStatsPurityEl: HTMLDivElement | null;
  playlistFilterTandaIds: Set<string> | null;
  playlistFilterOrchestra: string | null;
  setPlaylistFilterTextState: (value: string) => void;
  playlistFilterInput: HTMLInputElement | null;
  activateRightTab: (tabId: RightPanelTab) => void;
  renderPlaylist: () => void;
  playlistStatsOrchestraEl: HTMLDivElement | null;
  playlistStatsYearEl: HTMLDivElement | null;
  playlistStatsTempoEl: HTMLDivElement | null;
}

export const createStatisticsController = (options: StatisticsControllerOptions) => {
  const {
    t,
    formatTime,
    searchDiversityModal,
    resolveCanonicalArtistName,
    searchDiversityOrchestraEl,
    runSearchQuery,
    setSettingsOpen,
    searchDiversityOpportunitiesEl,
    searchDiversityYearEl,
    searchDiversityTempoEl,
    searchDiversityStyleEl,
    searchDiversityStyleGapsEl,
    searchDiversitySummaryEl,
    playlistStatsModal,
    resolveTandaDraft,
    resolvePlaylistTracks,
    getEffectiveTrackDurationMs,
    yearValue,
    playlistStatsPurityEl,
    setPlaylistFilterTextState,
    playlistFilterInput,
    activateRightTab,
    renderPlaylist,
    playlistStatsOrchestraEl,
    playlistStatsYearEl,
    playlistStatsTempoEl,
  } = options;

  const { renderMiniChart, renderOrchestraChart, renderStyleDistributionChart } =
    createStatisticsCharts(t, formatTime);

  const renderSearchDiversityOrchestraTable = (
    root: HTMLDivElement | null,
    rows: Array<{
      artist: string;
      tandaTotal: number;
      tandaStyles: Record<string, number>;
      availableTracks: number;
      availableStyles: Record<string, number>;
      availableYearCount: number;
      availableTempoCount: number;
    }>,
    onSearchArtist: (artist: string) => void,
  ) => {
    if (!root) {
      return;
    }
    root.innerHTML = "";
    if (rows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "mini-chart-empty";
      empty.textContent = t("playlistStatsNoData");
      root.appendChild(empty);
      return;
    }
    const table = document.createElement("table");
    table.className = "diversity-table";
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    const artistTh = document.createElement("th");
    artistTh.textContent = t("searchDiversityColOrchestra");
    const tandaTh = document.createElement("th");
    tandaTh.textContent = t("searchDiversityColTandas");
    const availableTh = document.createElement("th");
    availableTh.textContent = t("searchDiversityColAvailableTracks");
    const stylesTh = document.createElement("th");
    stylesTh.textContent = t("searchDiversityColStyles");
    const opportunityTh = document.createElement("th");
    opportunityTh.textContent = t("searchDiversityColOpportunity");
    const actionTh = document.createElement("th");
    actionTh.textContent = t("colActions");
    headRow.append(artistTh, tandaTh, availableTh, stylesTh, opportunityTh, actionTh);
    head.appendChild(headRow);
    const body = document.createElement("tbody");
    rows.slice(0, 120).forEach((row) => {
      const tr = document.createElement("tr");
      const artistTd = document.createElement("td");
      artistTd.textContent = row.artist;
      const totalTd = document.createElement("td");
      totalTd.textContent = `${row.tandaTotal}`;
      const availableTd = document.createElement("td");
      availableTd.textContent = `${row.availableTracks}`;
      const stylesTd = document.createElement("td");
      stylesTd.textContent = Object.entries(row.tandaStyles)
        .sort((left, right) => right[1] - left[1])
        .map(([style, count]) => `${style}: ${count}`)
        .join(", ");
      const opportunityTd = document.createElement("td");
      const missingStyles = Object.entries(row.availableStyles)
        .filter(([style]) => (row.tandaStyles[style] ?? 0) === 0)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 2)
        .map(([style]) => toDisplayStyleLabel(style));
      if (row.tandaTotal === 0 && row.availableTracks > 0) {
        opportunityTd.textContent = t("searchDiversityOpportunityNoTandas");
      } else if (missingStyles.length > 0) {
        opportunityTd.textContent = t("searchDiversityOpportunityStyles", {
          styles: missingStyles.join(", "),
        });
      } else if (row.availableYearCount > 4 || row.availableTempoCount > 6) {
        opportunityTd.textContent = t("searchDiversityOpportunityVariety");
      } else {
        opportunityTd.textContent = t("searchDiversityOpportunityLow");
      }
      const actionTd = document.createElement("td");
      const searchBtn = document.createElement("button");
      searchBtn.type = "button";
      searchBtn.className = "action-button";
      searchBtn.textContent = t("actionSearchShort");
      searchBtn.title = t("searchDiversityActionSearchArtist");
      searchBtn.setAttribute("aria-label", t("searchDiversityActionSearchArtist"));
      searchBtn.addEventListener("click", () => {
        onSearchArtist(row.artist);
      });
      actionTd.appendChild(searchBtn);
      tr.append(artistTd, totalTd, availableTd, stylesTd, opportunityTd, actionTd);
      body.appendChild(tr);
    });
    table.append(head, body);
    const wrap = document.createElement("div");
    wrap.className = "diversity-table-wrap";
    wrap.appendChild(table);
    root.appendChild(wrap);
  };

  const renderSearchDiversityOpportunityTable = (
    root: HTMLDivElement | null,
    rows: Array<{
      artist: string;
      tandaTotal: number;
      availableTracks: number;
      missingStyles: string[];
    }>,
    onSearchArtist: (artist: string) => void,
  ) => {
    if (!root) {
      return;
    }
    root.innerHTML = "";
    if (rows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "mini-chart-empty";
      empty.textContent = t("searchDiversityNoOpportunities");
      root.appendChild(empty);
      return;
    }
    const table = document.createElement("table");
    table.className = "diversity-table";
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    const orchestraTh = document.createElement("th");
    orchestraTh.textContent = t("searchDiversityColOrchestra");
    const tracksTh = document.createElement("th");
    tracksTh.textContent = t("searchDiversityColAvailableTracks");
    const tandasTh = document.createElement("th");
    tandasTh.textContent = t("searchDiversityColTandas");
    const suggestionTh = document.createElement("th");
    suggestionTh.textContent = t("searchDiversityColSuggestion");
    const actionTh = document.createElement("th");
    actionTh.textContent = t("colActions");
    headRow.append(orchestraTh, tracksTh, tandasTh, suggestionTh, actionTh);
    head.appendChild(headRow);
    const body = document.createElement("tbody");
    rows.slice(0, 40).forEach((row) => {
      const tr = document.createElement("tr");
      const orchestraTd = document.createElement("td");
      orchestraTd.textContent = row.artist;
      const tracksTd = document.createElement("td");
      tracksTd.textContent = `${row.availableTracks}`;
      const tandasTd = document.createElement("td");
      tandasTd.textContent = `${row.tandaTotal}`;
      const suggestionTd = document.createElement("td");
      if (row.tandaTotal === 0) {
        suggestionTd.textContent = t("searchDiversitySuggestionCreateFirst");
      } else if (row.missingStyles.length > 0) {
        suggestionTd.textContent = t("searchDiversitySuggestionStyle", {
          styles: row.missingStyles.slice(0, 2).join(", "),
        });
      } else {
        suggestionTd.textContent = t("searchDiversitySuggestionExpand");
      }
      const actionTd = document.createElement("td");
      const searchBtn = document.createElement("button");
      searchBtn.type = "button";
      searchBtn.className = "action-button";
      searchBtn.textContent = t("actionSearchShort");
      searchBtn.title = t("searchDiversityActionSearchArtist");
      searchBtn.setAttribute("aria-label", t("searchDiversityActionSearchArtist"));
      searchBtn.addEventListener("click", () => {
        onSearchArtist(row.artist);
      });
      actionTd.appendChild(searchBtn);
      tr.append(orchestraTd, tracksTd, tandasTd, suggestionTd, actionTd);
      body.appendChild(tr);
    });
    table.append(head, body);
    const wrap = document.createElement("div");
    wrap.className = "diversity-table-wrap";
    wrap.appendChild(table);
    root.appendChild(wrap);
  };

  const renderSearchDiversityStyleGapList = (
    root: HTMLDivElement | null,
    rows: Array<{ style: string; tandaCount: number; availableCount: number }>,
  ) => {
    if (!root) {
      return;
    }
    root.innerHTML = "";
    if (rows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "mini-chart-empty";
      empty.textContent = t("searchDiversityNoStyleGaps");
      root.appendChild(empty);
      return;
    }
    const table = document.createElement("table");
    table.className = "diversity-table";
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    const styleTh = document.createElement("th");
    styleTh.textContent = t("styleLabel");
    const availableTh = document.createElement("th");
    availableTh.textContent = t("searchDiversityColAvailableTracks");
    const tandasTh = document.createElement("th");
    tandasTh.textContent = t("searchDiversityColTandas");
    headRow.append(styleTh, availableTh, tandasTh);
    head.appendChild(headRow);
    const body = document.createElement("tbody");
    rows.slice(0, 20).forEach((row) => {
      const tr = document.createElement("tr");
      const styleTd = document.createElement("td");
      styleTd.textContent = toDisplayStyleLabel(row.style);
      const availableTd = document.createElement("td");
      availableTd.textContent = `${row.availableCount}`;
      const tandasTd = document.createElement("td");
      tandasTd.textContent = `${row.tandaCount}`;
      tr.append(styleTd, availableTd, tandasTd);
      body.appendChild(tr);
    });
    table.append(head, body);
    const wrap = document.createElement("div");
    wrap.className = "diversity-table-wrap";
    wrap.appendChild(table);
    root.appendChild(wrap);
  };

  const setSearchDiversityModalVisible = (visible: boolean) => {
    if (!searchDiversityModal) {
      return;
    }
    searchDiversityModal.classList.toggle("open", visible);
    searchDiversityModal.setAttribute("aria-hidden", visible ? "false" : "true");
  };

  const renderSearchDiversityStats = async () => {
    const stats = await window.tanda?.getSearchDiversityStats?.();
    if (!stats) {
      return;
    }
    const tandaByOrchestra = new Map<
      string,
      { tandaTotal: number; tandaStyles: Record<string, number> }
    >();
    stats.orchestraRows.forEach((row) => {
      const canonical =
        resolveCanonicalArtistName(row.artist || "") || row.artist || t("nowPlayingUnknown");
      const existing = tandaByOrchestra.get(canonical) ?? { tandaTotal: 0, tandaStyles: {} };
      Object.entries(row.styles).forEach(([style, count]) => {
        existing.tandaStyles[style] = (existing.tandaStyles[style] ?? 0) + count;
        existing.tandaTotal += count;
      });
      tandaByOrchestra.set(canonical, existing);
    });
    const availableByOrchestra = new Map<
      string,
      { trackCount: number; styles: Record<string, number>; yearCount: number; tempoCount: number }
    >();
    stats.availableOrchestraRows.forEach((row) => {
      const canonical =
        resolveCanonicalArtistName(row.artist || "") || row.artist || t("nowPlayingUnknown");
      availableByOrchestra.set(canonical, {
        trackCount: row.trackCount,
        styles: row.styles,
        yearCount: row.yearCount,
        tempoCount: row.tempoCount,
      });
    });
    options.orchestraRegistry.forEach((entry) => {
      const canonical = entry.canonical.trim();
      if (!canonical) {
        return;
      }
      if (!tandaByOrchestra.has(canonical)) {
        tandaByOrchestra.set(canonical, { tandaTotal: 0, tandaStyles: {} });
      }
      if (!availableByOrchestra.has(canonical)) {
        availableByOrchestra.set(canonical, {
          trackCount: 0,
          styles: {},
          yearCount: 0,
          tempoCount: 0,
        });
      }
    });
    const orchestraRows = Array.from(
      new Set([...tandaByOrchestra.keys(), ...availableByOrchestra.keys()]),
    )
      .map((artist) => {
        const tanda = tandaByOrchestra.get(artist) ?? { tandaTotal: 0, tandaStyles: {} };
        const available = availableByOrchestra.get(artist) ?? {
          trackCount: 0,
          styles: {},
          yearCount: 0,
          tempoCount: 0,
        };
        return {
          artist,
          tandaTotal: tanda.tandaTotal,
          tandaStyles: tanda.tandaStyles,
          availableTracks: available.trackCount,
          availableStyles: available.styles,
          availableYearCount: available.yearCount,
          availableTempoCount: available.tempoCount,
        };
      })
      .sort((left, right) => {
        if (right.tandaTotal !== left.tandaTotal) {
          return right.tandaTotal - left.tandaTotal;
        }
        return left.artist.localeCompare(right.artist);
      });
    const populatedOrchestraRows = orchestraRows.filter(
      (row) => row.tandaTotal > 0 || row.availableTracks > 0,
    );
    renderSearchDiversityOrchestraTable(
      searchDiversityOrchestraEl,
      populatedOrchestraRows,
      (artist) => {
        const escapedArtist = artist.replace(/"/g, '\\"');
        runSearchQuery(`artist: "${escapedArtist}"`, true);
        setSearchDiversityModalVisible(false);
        void setSettingsOpen(false);
      },
    );

    const opportunityRows = orchestraRows
      .filter((row) => row.availableTracks > 0)
      .map((row) => ({
        artist: row.artist,
        tandaTotal: row.tandaTotal,
        availableTracks: row.availableTracks,
        missingStyles: Object.entries(row.availableStyles)
          .filter(([style]) => (row.tandaStyles[style] ?? 0) === 0)
          .sort((left, right) => right[1] - left[1])
          .map(([style]) => toDisplayStyleLabel(style)),
        score:
          (row.tandaTotal === 0 ? 1_000 : 0) +
          row.availableTracks * 10 +
          Object.keys(row.availableStyles).length * 5 -
          row.tandaTotal * 4,
      }))
      .sort((left, right) => right.score - left.score);
    renderSearchDiversityOpportunityTable(searchDiversityOpportunitiesEl, opportunityRows, (artist) => {
      const escapedArtist = artist.replace(/"/g, '\\"');
      runSearchQuery(`artist: "${escapedArtist}"`, true);
      setSearchDiversityModalVisible(false);
      void setSettingsOpen(false);
    });

    const yearBuckets = new Map<number, number>(stats.yearBuckets);
    const yearStyleBuckets = new Map<number, Record<string, number>>(
      (stats.yearStyleBuckets ?? []).map(([year, stylePairs]) => [
        year,
        Object.fromEntries(stylePairs),
      ]),
    );
    const tempoBuckets = new Map<number, number>(stats.tempoBuckets);
    const tempoStyleBuckets = new Map<number, Record<string, number>>(
      (stats.tempoStyleBuckets ?? []).map(([tempo, stylePairs]) => [
        tempo,
        Object.fromEntries(stylePairs),
      ]),
    );
    const styleCounts = new Map<string, number>(stats.styleBuckets);
    const availableStyleCounts = new Map<string, number>(stats.availableStyleBuckets);
    const availableYearBuckets = new Map<number, number>(stats.availableYearBuckets);
    const availableTempoBuckets = new Map<number, number>(stats.availableTempoBuckets);
    const yearRows = buildAdaptiveNumericDistribution(yearBuckets, 40, 30);
    const yearStyleRows = buildAdaptiveStyleNumericDistribution(yearStyleBuckets, 40, 30);
    const tempoRows = buildAdaptiveNumericDistribution(tempoBuckets, 40, 30);
    const tempoStyleRows = buildAdaptiveStyleNumericDistribution(tempoStyleBuckets, 40, 30);
    const styleRows = Array.from(styleCounts.entries())
      .map(([label, value]) => ({ label: toDisplayStyleLabel(label), value }))
      .sort((left, right) => right.value - left.value);
    renderStyleDistributionChart(
      searchDiversityYearEl,
      yearStyleRows.length > 0
        ? yearStyleRows
        : yearRows.map((row) => ({ label: row.label, value: row.value, styleValues: {} })),
      {
        includeZero: true,
        className: "compact",
      },
    );
    renderStyleDistributionChart(
      searchDiversityTempoEl,
      tempoStyleRows.length > 0
        ? tempoStyleRows
        : tempoRows.map((row) => ({ label: row.label, value: row.value, styleValues: {} })),
      {
        includeZero: true,
        className: "compact",
      },
    );
    renderMiniChart(searchDiversityStyleEl, styleRows, {
      includeZero: true,
    });
    const styleGapRows = Array.from(availableStyleCounts.entries())
      .map(([style, availableCount]) => ({
        style,
        availableCount,
        tandaCount: styleCounts.get(style) ?? 0,
        gap: availableCount - (styleCounts.get(style) ?? 0),
      }))
      .filter((row) => row.availableCount > 0 && (row.tandaCount === 0 || row.gap >= 5))
      .sort((left, right) => right.gap - left.gap);
    renderSearchDiversityStyleGapList(searchDiversityStyleGapsEl, styleGapRows);

    if (searchDiversitySummaryEl) {
      const missingOrchestras = orchestraRows.filter(
        (row) => row.tandaTotal === 0 && row.availableTracks > 0,
      ).length;
      const missingStyles = styleGapRows.filter((row) => row.tandaCount === 0).length;
      searchDiversitySummaryEl.textContent = t("searchDiversitySummaryText", {
        missingOrchestras,
        missingStyles,
        yearRange: `${availableYearBuckets.size}/${yearBuckets.size}`,
        tempoRange: `${availableTempoBuckets.size}/${tempoBuckets.size}`,
      });
    }
  };

  const setPlaylistStatsModalVisible = (visible: boolean) => {
    if (!playlistStatsModal) {
      return;
    }
    playlistStatsModal.classList.toggle("open", visible);
    playlistStatsModal.setAttribute("aria-hidden", visible ? "false" : "true");
  };

  const renderPlaylistStats = () => {
    const orchestraEntries: {
      artist: string;
      seconds: number;
      style: string;
      tandaId: string | null;
    }[] = [];
    const yearBuckets = new Map<number, number>();
    const yearStyleBuckets = new Map<number, Record<string, number>>();
    const tempoBuckets = new Map<number, number>();
    const tempoStyleBuckets = new Map<number, Record<string, number>>();
    const purityTandaIds = new Map<TandaPurityIssue, Set<string>>([
      ["mixedVocal", new Set()],
      ["multipleArtists", new Set()],
      ["multipleSingers", new Set()],
      ["multipleStyles", new Set()],
    ]);
    options.playlistItems.forEach((item) => {
      if (!item) {
        return;
      }
      const tandaStyleFallback =
        item.kind === "tanda"
          ? (() => {
              const tanda = resolveTandaDraft(item.tandaId);
              if (!tanda || tanda.styles.length === 0) {
                return "";
              }
              const normalized = tanda.styles
                .map((style) => normalizeStyleName(style))
                .filter(Boolean);
              if (normalized.length === 0) {
                return "";
              }
              return normalized[0] ?? "";
            })()
          : "";
      const tracks = resolvePlaylistTracks(item);
      if (item.kind === "tanda") {
        findTandaPurityIssues(tracks.map((track) => ({
          artist: resolveCanonicalArtistName(track.artist_summary || track.artist || ""),
          singer: track.singer,
          instrumental: track.instrumental,
          style: normalizeStyleName(track.genre ?? ""),
        }))).forEach((issue) => purityTandaIds.get(issue)?.add(item.tandaId));
      }
      tracks.forEach((track) => {
        const seconds = Math.max(1, Math.round(getEffectiveTrackDurationMs(track) / 1000));
        const orchestra =
          resolveCanonicalArtistName(track.artist_summary || track.artist || "") ||
          t("nowPlayingUnknown");
        const style =
          normalizeStyleName(track.genre ?? "") || tandaStyleFallback || "unknown";
        orchestraEntries.push({
          artist: orchestra,
          seconds,
          style,
          tandaId: item.kind === "tanda" ? item.tandaId : null,
        });
        const year = yearValue(track);
        if (year !== null) {
          yearBuckets.set(year, (yearBuckets.get(year) ?? 0) + 1);
          const yearStyles = yearStyleBuckets.get(year) ?? {};
          yearStyles[style] = (yearStyles[style] ?? 0) + 1;
          yearStyleBuckets.set(year, yearStyles);
        }
        if (track.bpm !== null && track.bpm !== undefined && Number.isFinite(track.bpm)) {
          const bpm = Math.round(track.bpm);
          tempoBuckets.set(bpm, (tempoBuckets.get(bpm) ?? 0) + 1);
          const tempoStyles = tempoStyleBuckets.get(bpm) ?? {};
          tempoStyles[style] = (tempoStyles[style] ?? 0) + 1;
          tempoStyleBuckets.set(bpm, tempoStyles);
        }
      });
    });
    const orchestraRows = aggregateOrchestraDurations(orchestraEntries);
    const yearRows = buildAdaptiveNumericDistribution(yearBuckets, 30, 30);
    const yearStyleRows = buildAdaptiveStyleNumericDistribution(yearStyleBuckets, 30, 30);
    const tempoRows = buildAdaptiveNumericDistribution(tempoBuckets, 30, 30);
    const tempoStyleRows = buildAdaptiveStyleNumericDistribution(tempoStyleBuckets, 30, 30);
    if (playlistStatsPurityEl) {
      playlistStatsPurityEl.replaceChildren();
      const allIssueIds = new Set(
        Array.from(purityTandaIds.values()).flatMap((ids) => Array.from(ids)),
      );
      const categories: Array<{ key: string; ids: Set<string> }> = [
        { key: "playlistStatsPurityAny", ids: allIssueIds },
        { key: "playlistStatsPurityMixedVocal", ids: purityTandaIds.get("mixedVocal")! },
        { key: "playlistStatsPurityMultiArtist", ids: purityTandaIds.get("multipleArtists")! },
        { key: "playlistStatsPurityMultiSinger", ids: purityTandaIds.get("multipleSingers")! },
        { key: "playlistStatsPurityMultiStyle", ids: purityTandaIds.get("multipleStyles")! },
      ];
      categories.forEach(({ key, ids }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "purity-chart-item";
        button.disabled = ids.size === 0;
        button.title = t("playlistStatsPurityFilterHint");
        const count = document.createElement("strong");
        count.textContent = ids.size.toString();
        const label = document.createElement("span");
        label.textContent = t(key);
        button.append(count, label);
        button.addEventListener("click", () => {
          options.playlistFilterTandaIds = new Set(ids);
          options.playlistFilterOrchestra = null;
          setPlaylistFilterTextState(t(key));
          if (playlistFilterInput) playlistFilterInput.value = t(key);
          activateRightTab("playlist-tab");
          renderPlaylist();
          setPlaylistStatsModalVisible(false);
        });
        playlistStatsPurityEl.appendChild(button);
      });
    }
    renderOrchestraChart(playlistStatsOrchestraEl, orchestraRows, Number.POSITIVE_INFINITY, (orchestra) => {
      setPlaylistFilterTextState(orchestra);
      options.playlistFilterOrchestra = orchestra;
      options.playlistFilterTandaIds = null;
      if (playlistFilterInput) {
        playlistFilterInput.value = orchestra;
      }
      activateRightTab("playlist-tab");
      renderPlaylist();
      setPlaylistStatsModalVisible(false);
    });
    renderStyleDistributionChart(
      playlistStatsYearEl,
      yearStyleRows.length > 0
        ? yearStyleRows
        : yearRows.map((row) => ({ label: row.label, value: row.value, styleValues: {} })),
      {
        includeZero: true,
        className: "compact",
      },
    );
    renderStyleDistributionChart(
      playlistStatsTempoEl,
      tempoStyleRows.length > 0
        ? tempoStyleRows
        : tempoRows.map((row) => ({ label: row.label, value: row.value, styleValues: {} })),
      {
        includeZero: true,
        className: "compact",
      },
    );
  };

  return {
    renderPlaylistStats,
    setPlaylistStatsModalVisible,
    setSearchDiversityModalVisible,
    renderSearchDiversityStats,
  };
};
