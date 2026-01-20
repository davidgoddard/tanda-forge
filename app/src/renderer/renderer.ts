const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const addMusicBtn = document.querySelector<HTMLButtonElement>("#add-music");
const addCortinaBtn = document.querySelector<HTMLButtonElement>("#add-cortina");
const scanBtn = document.querySelector<HTMLButtonElement>("#scan");
const scanSettingsBtn =
  document.querySelector<HTMLButtonElement>("#scan-settings");
const listEl = document.querySelector<HTMLDivElement>("#track-list");
const errorList = document.querySelector<HTMLUListElement>("#error-list");
const progressEl = document.querySelector<HTMLProgressElement>("#scan-progress");
const progressLabel = document.querySelector<HTMLDivElement>("#progress-label");
const settingsBtn = document.querySelector<HTMLButtonElement>("#settings");
const settingsPanel = document.querySelector<HTMLElement>("#settings-panel");
const closeSettingsBtn =
  document.querySelector<HTMLButtonElement>("#close-settings");
const tabButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".settings-tabs button"),
);
const tabPanels = Array.from(
  document.querySelectorAll<HTMLElement>(".settings-tab"),
);
const rootList = document.querySelector<HTMLDivElement>("#root-list");
const rootBanner = document.querySelector<HTMLDivElement>("#root-banner");
const rootBannerText =
  document.querySelector<HTMLDivElement>("#root-banner-text");
const openSettingsBtn =
  document.querySelector<HTMLButtonElement>("#open-settings");
const resetDbBtn = document.querySelector<HTMLButtonElement>("#reset-db");
const jumpIndexEl = document.querySelector<HTMLElement>("#jump-index");
const sortButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".list-header button[data-sort]"),
);
const listBody = document.querySelector<HTMLDivElement>(".list-body");
const themeToggle = document.querySelector<HTMLButtonElement>("#theme-toggle");

let currentOffsetStart = 0;
let currentOffsetEnd = 0;
let loading = false;
let exhaustedDown = false;
let exhaustedUp = false;
let sortBy = "title";
let sortDir: "asc" | "desc" = "asc";
const pageSize = 200;

const setStatus = (message: string) => {
  if (statusEl) {
    statusEl.textContent = message;
  }
};

const formatMs = (value: number) => {
  const totalSeconds = Math.round(value / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const renderTracks = async (reset = false) => {
  if (!window.tanda || !listEl) {
    return;
  }
  if (loading || exhaustedDown) {
    return;
  }
  loading = true;
  if (reset) {
    currentOffsetStart = 0;
    currentOffsetEnd = 0;
    exhaustedDown = false;
    exhaustedUp = false;
    listEl.innerHTML = "";
  }

  const tracks = await window.tanda.listTrackPage({
    offset: currentOffsetEnd,
    limit: pageSize,
    sortBy,
    sortDir,
  });

  if (tracks.length === 0) {
    exhaustedDown = true;
    loading = false;
    return;
  }

  tracks.forEach((track) => {
    const status = track.analysis_error || track.tag_error ? "Issue" : "OK";
    const statusTitle = [track.tag_error, track.analysis_error]
      .filter(Boolean)
      .join(" | ");
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <span title="${track.title}">${track.title}</span>
      <span title="${track.artist}">${track.artist}</span>
      <span title="${track.album}">${track.album}</span>
      <span>${track.year || ""}</span>
      <span>${formatMs(track.duration_ms || 0)}</span>
      <span>${formatMs(track.start_offset_ms || 0)}</span>
      <span>${formatMs(track.end_trim_ms || 0)}</span>
      <span title="${statusTitle}">${status}</span>
    `;
    listEl.appendChild(row);
  });

  currentOffsetEnd += tracks.length;
  if (tracks.length < pageSize) {
    exhaustedDown = true;
  }
  loading = false;
};

const prependTracks = async (offset: number) => {
  if (!window.tanda || !listEl || !listBody) {
    return;
  }
  if (loading || exhaustedUp) {
    return;
  }
  loading = true;
  const previousHeight = listBody.scrollHeight;
  const tracks = await window.tanda.listTrackPage({
    offset,
    limit: pageSize,
    sortBy,
    sortDir,
  });
  if (tracks.length === 0) {
    exhaustedUp = true;
    loading = false;
    return;
  }
  const fragment = document.createDocumentFragment();
  tracks.forEach((track) => {
    const status = track.analysis_error || track.tag_error ? "Issue" : "OK";
    const statusTitle = [track.tag_error, track.analysis_error]
      .filter(Boolean)
      .join(" | ");
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <span title="${track.title}">${track.title}</span>
      <span title="${track.artist}">${track.artist}</span>
      <span title="${track.album}">${track.album}</span>
      <span>${track.year || ""}</span>
      <span>${formatMs(track.duration_ms || 0)}</span>
      <span>${formatMs(track.start_offset_ms || 0)}</span>
      <span>${formatMs(track.end_trim_ms || 0)}</span>
      <span title="${statusTitle}">${status}</span>
    `;
    fragment.appendChild(row);
  });
  listEl.prepend(fragment);
  currentOffsetStart = offset;
  if (offset === 0) {
    exhaustedUp = true;
  }
  const newHeight = listBody.scrollHeight;
  listBody.scrollTop += newHeight - previousHeight;
  loading = false;
};

const updateSortIndicators = () => {
  sortButtons.forEach((button) => {
    const key = button.dataset.sort;
    if (key === sortBy) {
      button.classList.add("active");
      button.dataset.dir = sortDir === "asc" ? "▲" : "▼";
    } else {
      button.classList.remove("active");
      button.dataset.dir = "";
    }
  });
};

const renderJumpIndex = async () => {
  if (!window.tanda || !jumpIndexEl) {
    return;
  }
  const entries = await window.tanda.getJumpIndex({ sortBy });
  jumpIndexEl.innerHTML = "";
  entries.forEach((entry) => {
    const btn = document.createElement("button");
    btn.textContent = entry;
    btn.addEventListener("click", async () => {
      const result = await window.tanda?.jumpToPrefix({
        prefix: entry,
        sortBy,
        sortDir,
      });
      if (!result) {
        return;
      }
      currentOffsetStart = result.offset;
      currentOffsetEnd = result.offset;
      exhaustedDown = false;
      exhaustedUp = currentOffsetStart === 0;
      if (!listEl) {
        return;
      }
      listEl.innerHTML = "";
      await renderTracks();
      if (listBody) {
        listBody.scrollTop = 0;
      }
    });
    jumpIndexEl.appendChild(btn);
  });
};

const setSettingsOpen = (open: boolean) => {
  if (!settingsPanel) {
    return;
  }
  settingsPanel.classList.toggle("open", open);
  settingsPanel.setAttribute("aria-hidden", open ? "false" : "true");
};

const renderRoots = async () => {
  if (!window.tanda || !rootList || !rootBanner || !rootBannerText) {
    return;
  }
  const roots = await window.tanda.listRoots();
  rootList.innerHTML = "";
  if (roots.length === 0) {
    rootBannerText.textContent =
      "No music folders configured. Add a music folder in Settings to begin scanning.";
    rootBanner.classList.add("visible");
  } else {
    const missing = roots.filter((root) => !root.available);
    if (missing.length > 0) {
      rootBannerText.textContent =
        "Some library folders are unavailable. Connect the drive or update Settings.";
      rootBanner.classList.add("visible");
    } else {
      rootBanner.classList.remove("visible");
    }
  }

  roots.forEach((root) => {
    const row = document.createElement("div");
    row.className = "root-row";
    row.innerHTML = `
      <span>${root.label}</span>
      <span>${root.kind === "music" ? "Music" : "Cortina"}</span>
      <span class="${root.available ? "ok" : "missing"}">${
        root.available ? "Available" : "Missing"
      }</span>
      <span class="path" title="${root.path}">${root.path}</span>
    `;
    rootList.appendChild(row);
  });
};

const init = async () => {
  if (!window.tanda) {
    setStatus("API bridge not available");
    return;
  }

  const message = await window.tanda.ping();
  setStatus(`Main process says: ${message}`);

  if (themeToggle) {
    const savedTheme = localStorage.getItem("tanda-theme");
    if (savedTheme === "dark") {
      document.body.classList.add("theme-dark");
    }
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("theme-dark");
      const next = document.body.classList.contains("theme-dark")
        ? "dark"
        : "light";
      localStorage.setItem("tanda-theme", next);
    });
  }

  window.tanda.onScanProgress((progress) => {
    if (progressEl) {
      progressEl.max = progress.total || 1;
      progressEl.value = progress.current;
    }
    if (progressLabel) {
      progressLabel.textContent = `Scanning ${progress.current}/${progress.total} (${progress.rootLabel})`;
    }
  });

  settingsBtn?.addEventListener("click", () => setSettingsOpen(true));
  closeSettingsBtn?.addEventListener("click", () => setSettingsOpen(false));
  openSettingsBtn?.addEventListener("click", () => setSettingsOpen(true));

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      if (!tab) {
        return;
      }
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabPanels.forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      tabPanels
        .filter((panel) => panel.dataset.tab === tab)
        .forEach((panel) => panel.classList.add("active"));
    });
  });

  addMusicBtn?.addEventListener("click", async () => {
    const selected = await window.tanda?.pickRoot("music");
    if (!selected) {
      return;
    }
    await window.tanda?.addRoot("music", selected);
    setStatus(`Added music folder: ${selected}`);
    await renderRoots();
  });

  addCortinaBtn?.addEventListener("click", async () => {
    const selected = await window.tanda?.pickRoot("cortina");
    if (!selected) {
      return;
    }
    await window.tanda?.addRoot("cortina", selected);
    setStatus(`Added cortina folder: ${selected}`);
    await renderRoots();
  });

  const runScan = async () => {
    setStatus("Scanning...");
    if (progressLabel) {
      progressLabel.textContent = "Preparing scan...";
    }
    if (progressEl) {
      progressEl.value = 0;
      progressEl.max = 1;
    }
    try {
      const summary = await window.tanda?.scanAll();
      if (!summary) {
        setStatus("Scan failed: no response from main process.");
        return;
      }
      setStatus(
        `Scan complete. Scanned ${summary.scanned}, added ${summary.added}, updated ${summary.updated}, removed ${summary.removed}.`,
      );
      if (progressLabel) {
        progressLabel.textContent = `Scan complete. ${summary.errors.length} issues.`;
      }
      if (errorList) {
        errorList.innerHTML = "";
        summary.errors.slice(0, 50).forEach((error) => {
          const li = document.createElement("li");
          li.textContent = `${error.filePath}: ${error.message}`;
          errorList.appendChild(li);
        });
        if (summary.errors.length > 50) {
          const li = document.createElement("li");
          li.textContent = `...and ${summary.errors.length - 50} more`;
          errorList.appendChild(li);
        }
      }
      await renderTracks(true);
      await renderJumpIndex();
    } catch (error) {
      setStatus(
        error instanceof Error ? `Scan failed: ${error.message}` : "Scan failed.",
      );
    }
  };

  scanBtn?.addEventListener("click", runScan);
  scanSettingsBtn?.addEventListener("click", runScan);

  resetDbBtn?.addEventListener("click", async () => {
    const result = await window.tanda?.resetDatabase();
    if (result?.ok) {
      setStatus("Database erased. Add folders to begin scanning.");
      await renderRoots();
      await renderTracks(true);
      await renderJumpIndex();
    }
  });

  sortButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const key = button.dataset.sort ?? "title";
      if (sortBy === key) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortBy = key;
        sortDir = "asc";
      }
      updateSortIndicators();
      await renderTracks(true);
      await renderJumpIndex();
    });
  });

  listBody?.addEventListener("scroll", async () => {
    if (!listBody) {
      return;
    }
    const nearBottom =
      listBody.scrollTop + listBody.clientHeight >= listBody.scrollHeight - 200;
    if (nearBottom) {
      await renderTracks();
    }
    const nearTop = listBody.scrollTop <= 120;
    if (nearTop && currentOffsetStart > 0) {
      const nextOffset = Math.max(0, currentOffsetStart - pageSize);
      await prependTracks(nextOffset);
    }
  });

  listBody?.addEventListener("wheel", async (event) => {
    if (!listBody) {
      return;
    }
    if (event.deltaY < 0 && listBody.scrollTop <= 0 && currentOffsetStart > 0) {
      const nextOffset = Math.max(0, currentOffsetStart - pageSize);
      await prependTracks(nextOffset);
    }
  });

  updateSortIndicators();
  await renderTracks(true);
  await renderJumpIndex();
  await renderRoots();
};

init().catch((error) => {
  setStatus(error instanceof Error ? error.message : "Unknown error");
});
