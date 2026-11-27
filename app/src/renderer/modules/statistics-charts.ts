import { computeScaledPercent } from "../../shared/chart-scale.js";
import { normalizeStyleName } from "../../shared/tanda-utils.js";
import { splitStyleLabel } from "../../shared/style-families.js";
import { aggregateOrchestraDurations } from "../../shared/playlist-diversity.js";
import { toDisplayStyleLabel } from "../../shared/now-playing.js";

export const createStatisticsCharts = (
  t: (key: string, params?: Record<string, string | number>) => string,
  formatTime: (seconds: number) => string,
) => {
  const renderMiniChart = (
    root: HTMLDivElement | null,
    rows: { label: string; value: number }[],
    options?: {
      maxBars?: number;
      includeZero?: boolean;
      className?: string;
    },
  ) => {
    if (!root) {
      return;
    }
    root.innerHTML = "";
    root.style.removeProperty("--mini-chart-columns");
    root.classList.remove("orchestra", "compact");
    if (options?.className) {
      root.classList.add(options.className);
    }
    const includeZero = options?.includeZero ?? false;
    const maxBars = options?.maxBars ?? Number.POSITIVE_INFINITY;
    const data = rows
      .filter((row) =>
        includeZero
          ? Number.isFinite(row.value) && row.value >= 0
          : Number.isFinite(row.value) && row.value > 0,
      )
      .slice(0, maxBars);
    if (data.length === 0) {
      const empty = document.createElement("div");
      empty.className = "mini-chart-empty";
      empty.textContent = t("playlistStatsNoData");
      root.appendChild(empty);
      return;
    }
    const maxValue = Math.max(...data.map((row) => row.value));
    if (options?.className === "compact") {
      root.style.setProperty("--mini-chart-columns", `${Math.max(1, data.length)}`);
    }
    const ORCHESTRA_LABEL_MAX = "Enrique Rodrigues".length;
    data.forEach((row) => {
      const item = document.createElement("div");
      item.className = "mini-chart-item";
      const bar = document.createElement("div");
      bar.className = "mini-chart-bar";
      if (row.value <= 0) {
        bar.classList.add("is-zero");
        bar.style.height = "0";
      } else {
        bar.style.height = `${computeScaledPercent(row.value, maxValue, {
          minPercent: 4,
        })}%`;
      }
      const label = document.createElement("div");
      label.className = "mini-chart-label";
      const labelText =
        options?.className === "orchestra" && row.label.length > ORCHESTRA_LABEL_MAX
          ? `${row.label.slice(0, ORCHESTRA_LABEL_MAX - 1)}...`
          : row.label;
      label.textContent = labelText;
      label.title =
        options?.className === "orchestra"
          ? `${row.label}: ${formatTime(row.value)}`
          : `${row.label}: ${Math.round(row.value)}`;
      item.append(bar, label);
      root.appendChild(item);
    });
  };

  const resolveStyleColorGroup = (styleKey: string) => {
    const key = normalizeStyleName(styleKey).toLowerCase();
    const base = normalizeStyleName(splitStyleLabel(styleKey).base || "").toLowerCase();
    const source = `${base} ${key}`.trim();
    if (
      source.includes("milonga") ||
      base === "m" ||
      key === "m" ||
      key.startsWith("m - ")
    ) {
      return "milonga";
    }
    if (
      source.includes("vals") ||
      source.includes("waltz") ||
      base === "w" ||
      key === "w" ||
      key.startsWith("w - ")
    ) {
      return "waltz";
    }
    if (
      source.includes("tango") ||
      base === "t" ||
      key === "t" ||
      key.startsWith("t - ")
    ) {
      return "tango";
    }
    return "other";
  };

  const colorForStyleKey = (styleKey: string) => {
    const group = resolveStyleColorGroup(styleKey);
    if (group === "milonga") {
      return "#1fbf75";
    }
    if (group === "waltz") {
      return "#3d7dff";
    }
    if (group === "tango") {
      return "#ff7847";
    }
    return "#8f9aad";
  };

  const patternForStyleKey = (styleKey: string) => {
    const group = resolveStyleColorGroup(styleKey);
    if (group === "milonga") {
      // Diagonal hatch
      return "repeating-linear-gradient(45deg, rgba(0,0,0,0.26) 0 2px, rgba(255,255,255,0) 2px 6px)";
    }
    if (group === "waltz") {
      // Opposite diagonal hatch
      return "repeating-linear-gradient(-45deg, rgba(0,0,0,0.26) 0 2px, rgba(255,255,255,0) 2px 6px)";
    }
    if (group === "tango") {
      // Vertical hatch
      return "repeating-linear-gradient(90deg, rgba(0,0,0,0.2) 0 2px, rgba(255,255,255,0) 2px 6px)";
    }
    // Dot-ish checker for unknown
    return "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 2px, rgba(255,255,255,0) 2px 5px), repeating-linear-gradient(90deg, rgba(0,0,0,0.12) 0 2px, rgba(255,255,255,0) 2px 5px)";
  };

  const renderOrchestraChart = (
    root: HTMLDivElement | null,
    rows: ReturnType<typeof aggregateOrchestraDurations>,
    maxBars = Number.POSITIVE_INFINITY,
    onSelectOrchestra?: (orchestra: string) => void,
  ) => {
    if (!root) {
      return;
    }
    root.innerHTML = "";
    root.classList.remove("compact");
    root.classList.add("orchestra");
    const data = rows.filter((row) => row.totalSeconds > 0).slice(0, maxBars);
    if (data.length === 0) {
      const empty = document.createElement("div");
      empty.className = "mini-chart-empty";
      empty.textContent = t("playlistStatsNoData");
      root.appendChild(empty);
      return;
    }
    const maxValue = Math.max(...data.map((row) => row.totalSeconds));
    const ORCHESTRA_LABEL_MAX = "Enrique Rodrigues".length;
    data.forEach((row, index) => {
      const item = document.createElement("div");
      item.className = "mini-chart-item orchestra-item";
      const upper = document.createElement("div");
      upper.className = "mini-chart-upper";
      const count = document.createElement("div");
      count.className = "mini-chart-top";
      count.textContent = `${Math.round(row.tandaCount)}`;
      const barWrap = document.createElement("div");
      barWrap.className = "mini-chart-stack-wrap";
      barWrap.style.height = `${computeScaledPercent(row.totalSeconds, maxValue, {
        minPercent: 4,
      })}%`;
      const stack = document.createElement("div");
      stack.className = "mini-chart-stack";
      const styleRows = Object.entries(row.styleSeconds)
        .map(([style, seconds]) => ({ style, seconds }))
        .filter((entry) => entry.seconds > 0)
        .sort((a, b) => b.seconds - a.seconds);
      styleRows.forEach((styleRow) => {
        const segment = document.createElement("div");
        segment.className = "mini-chart-segment";
        const segmentRatio = styleRow.seconds / row.totalSeconds;
        segment.style.height = `${Math.max(4, Math.round(segmentRatio * 100))}%`;
        segment.style.backgroundColor = colorForStyleKey(styleRow.style);
        segment.style.backgroundImage = patternForStyleKey(styleRow.style);
        stack.appendChild(segment);
      });
      barWrap.appendChild(stack);
      upper.append(count, barWrap);
      const label = document.createElement("div");
      label.className = "mini-chart-label";
      label.textContent =
        row.label.length > ORCHESTRA_LABEL_MAX
          ? `${row.label.slice(0, ORCHESTRA_LABEL_MAX - 1)}...`
          : row.label;
      const styleDetail = styleRows
        .map((styleRow) => `${styleRow.style}: ${formatTime(styleRow.seconds)}`)
        .join(", ");
      item.title = `${row.label}: ${formatTime(row.totalSeconds)} (${row.tandaCount} tanda)\n${styleDetail}`;
      if (onSelectOrchestra) {
        item.classList.add("interactive");
        item.setAttribute("role", "button");
        item.setAttribute("tabindex", "0");
        item.addEventListener("click", () => {
          onSelectOrchestra(row.label);
        });
        item.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectOrchestra(row.label);
          }
        });
      }
      item.append(upper, label);
      root.appendChild(item);
    });
  };

  const renderStyleDistributionChart = (
    root: HTMLDivElement | null,
    rows: Array<{ label: string; value: number; styleValues: Record<string, number> }>,
    options?: {
      maxBars?: number;
      includeZero?: boolean;
      className?: string;
    },
  ) => {
    if (!root) {
      return;
    }
    root.innerHTML = "";
    root.style.removeProperty("--mini-chart-columns");
    root.classList.remove("orchestra", "compact");
    if (options?.className) {
      root.classList.add(options.className);
    }
    const includeZero = options?.includeZero ?? false;
    const maxBars = options?.maxBars ?? Number.POSITIVE_INFINITY;
    const data = rows
      .filter((row) =>
        includeZero
          ? Number.isFinite(row.value) && row.value >= 0
          : Number.isFinite(row.value) && row.value > 0,
      )
      .slice(0, maxBars);
    if (data.length === 0) {
      const empty = document.createElement("div");
      empty.className = "mini-chart-empty";
      empty.textContent = t("playlistStatsNoData");
      root.appendChild(empty);
      return;
    }
    const maxValue = Math.max(...data.map((row) => row.value), 1);
    if (options?.className === "compact") {
      root.style.setProperty("--mini-chart-columns", `${Math.max(1, data.length)}`);
    }
    data.forEach((row) => {
      const item = document.createElement("div");
      item.className = "mini-chart-item";
      const upper = document.createElement("div");
      upper.className = "mini-chart-upper";
      upper.classList.add("single-bar");
      const barWrap = document.createElement("div");
      barWrap.className = "mini-chart-stack-wrap";
      const stack = document.createElement("div");
      stack.className = "mini-chart-stack";
      if (row.value <= 0) {
        barWrap.style.height = "0";
        stack.classList.add("is-zero");
      } else {
        barWrap.style.height = `${computeScaledPercent(row.value, maxValue, {
          minPercent: 4,
        })}%`;
        const styleRows = Object.entries(row.styleValues)
          .filter(([, value]) => value > 0)
          .sort((left, right) => right[1] - left[1]);
        styleRows.forEach(([style, value]) => {
          const segment = document.createElement("div");
          segment.className = "mini-chart-segment";
          segment.style.flex = `${value} 1 0`;
          segment.style.backgroundColor = colorForStyleKey(style);
          segment.style.backgroundImage = patternForStyleKey(style);
          stack.appendChild(segment);
        });
      }
      barWrap.appendChild(stack);
      upper.appendChild(barWrap);
      const label = document.createElement("div");
      label.className = "mini-chart-label";
      label.textContent = row.label;
      const details = Object.entries(row.styleValues)
        .filter(([, value]) => value > 0)
        .sort((left, right) => right[1] - left[1])
        .map(([style, value]) => `${toDisplayStyleLabel(style)}: ${Math.round(value)}`)
        .join(", ");
      item.title = details ? `${row.label}: ${Math.round(row.value)} (${details})` : `${row.label}: ${Math.round(row.value)}`;
      item.append(upper, label);
      root.appendChild(item);
    });
  };

  return { renderMiniChart, renderOrchestraChart, renderStyleDistributionChart };
};
