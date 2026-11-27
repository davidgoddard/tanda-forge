import { localAudioUrl } from "../modules/local-audio-url.js";

export interface DiagnosticsTrackReviewOptions {
  t: (key: string, params?: Record<string, string | number>) => string;
  stopMainForDiagnosticsAudition: () => Promise<void>;
  setStatus: (message: string) => void;
  renderDiagnosticsDataReadiness: () => Promise<void>;
  showDeleteTrackModal: () => Promise<boolean | null>;
}

export const createDiagnosticsTrackReview = (options: DiagnosticsTrackReviewOptions) => {
  const {
    t,
    stopMainForDiagnosticsAudition,
    setStatus,
    renderDiagnosticsDataReadiness,
    showDeleteTrackModal,
  } = options;

  let diagnosticsReviewAudio: HTMLAudioElement | null = null;
  let diagnosticsReviewStopAtSeconds: number | null = null;
  let diagnosticsReviewPlayhead: HTMLElement | null = null;
  let diagnosticsReviewState: HTMLElement | null = null;

  const stopDiagnosticsReviewAudio = () => {
    diagnosticsReviewAudio?.pause();
    if (diagnosticsReviewAudio) diagnosticsReviewAudio.src = "";
    diagnosticsReviewAudio = null;
    diagnosticsReviewStopAtSeconds = null;
    if (diagnosticsReviewState) {
      diagnosticsReviewState.textContent = t("diagnosticsTrackReviewStopped");
      diagnosticsReviewState.dataset.state = "stopped";
    }
  };

  const renderDiagnosticsTrackReview = async (target: HTMLElement) => {
    if (!window.tanda) return;
    stopDiagnosticsReviewAudio();
    const summary = await window.tanda.getDiagnosticsDataReadiness();
    const deduplicatedTracks = new Map(
      [...summary.shortDurationTracks, ...summary.aggressivelyTrimmedTracks]
        .map((track) => [track.id, track] as const),
    );
    const tracks = new Map(
      [...deduplicatedTracks.values()]
        .sort((left, right) => Number(left.acknowledged) - Number(right.acknowledged))
        .map((track) => [track.id, track] as const),
    );
    target.innerHTML = "";
    if (tracks.size === 0) {
      target.textContent = t("diagnosticsTrackLengthNone");
      return;
    }
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    [t("trackEditorTitle"), t("diagnosticsTrackReviewIssue"), t("audioSimilarityMetaDuration"), t("diagnosticsTrackReviewStatus")]
      .forEach((label) => {
        const cell = document.createElement("th");
        cell.textContent = label;
        headerRow.appendChild(cell);
      });
    head.appendChild(headerRow);
    table.appendChild(head);
    const body = document.createElement("tbody");
    const panel = document.createElement("div");
    panel.className = "diagnostics-track-review-panel";
    table.appendChild(body);
    const tableScroller = document.createElement("div");
    tableScroller.className = "diagnostics-track-review-table-scroller";
    tableScroller.appendChild(table);
    target.append(panel, tableScroller);

    const selectTrack = async (track: typeof summary.shortDurationTracks[number], row: HTMLTableRowElement) => {
      body.querySelectorAll("tr").forEach((candidate) => candidate.setAttribute("aria-selected", "false"));
      row.setAttribute("aria-selected", "true");
      stopDiagnosticsReviewAudio();
      panel.innerHTML = "";
      const heading = document.createElement("h4");
      const formatDuration = (durationMs: number) => {
        const seconds = Math.max(0, Math.round(durationMs / 1000));
        return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      };
      const issueLabel = track.issueKinds
        .map((kind) => t(kind === "short" ? "diagnosticsTrackReviewShort" : "diagnosticsTrackReviewTrim"))
        .join(", ");
      heading.textContent = `${track.title} — ${t("diagnosticsTrackReviewTitleDetails", {
        effective: formatDuration(track.effectiveDurationMs),
        original: formatDuration(track.durationMs),
        issue: issueLabel,
      })}`;
      const sourcePath = document.createElement("div");
      sourcePath.className = "diagnostics-track-review-path";
      sourcePath.textContent = track.relativePath;
      const playbackState = document.createElement("span");
      playbackState.className = "diagnostics-track-review-state";
      playbackState.dataset.state = "stopped";
      playbackState.textContent = t("diagnosticsTrackReviewStopped");
      diagnosticsReviewState = playbackState;
      const reviewNotice = document.createElement("div");
      reviewNotice.className = "diagnostics-track-review-notice hidden";
      if (track.acknowledged) {
        reviewNotice.textContent = t("diagnosticsTrackReviewAcknowledged");
        reviewNotice.classList.remove("hidden");
      }
      const waveform = document.createElement("div");
      waveform.className = "diagnostics-trim-waveform";
      const leftShade = document.createElement("div");
      const rightShade = document.createElement("div");
      const playhead = document.createElement("div");
      leftShade.className = rightShade.className = "diagnostics-trim-shade";
      playhead.className = "diagnostics-trim-playhead";
      leftShade.style.left = "0";
      rightShade.style.right = "0";
      playhead.style.left = "0%";
      waveform.append(leftShade, rightShade, playhead);
      diagnosticsReviewPlayhead = playhead;
      const start = document.createElement("input");
      const end = document.createElement("input");
      for (const input of [start, end]) {
        input.type = "range";
        input.min = "0";
        input.max = String(track.durationMs);
        input.step = "10";
        input.className = "diagnostics-trim-handle";
      }
      start.value = String(track.startOffsetMs);
      end.value = String(track.durationMs - track.endTrimMs);
      const startLabel = document.createElement("label");
      const endLabel = document.createElement("label");
      const redraw = () => {
        let startMs = Math.max(0, Number(start.value));
        let endMs = Math.min(track.durationMs, Number(end.value));
        if (startMs >= endMs) {
          if (document.activeElement === start) startMs = Math.max(0, endMs - 10);
          else endMs = Math.min(track.durationMs, startMs + 10);
          start.value = String(startMs);
          end.value = String(endMs);
        }
        leftShade.style.width = `${(startMs / track.durationMs) * 100}%`;
        rightShade.style.width = `${((track.durationMs - endMs) / track.durationMs) * 100}%`;
        startLabel.firstChild!.textContent = `${t("diagnosticsTrackReviewStartTrim")}: ${(startMs / 1000).toFixed(2)}s `;
        endLabel.firstChild!.textContent = `${t("diagnosticsTrackReviewEndTrim")}: ${((track.durationMs - endMs) / 1000).toFixed(2)}s `;
      };
      startLabel.append(document.createTextNode(""), start);
      endLabel.append(document.createTextNode(""), end);
      start.addEventListener("input", redraw);
      end.addEventListener("input", redraw);
      redraw();
      void window.tanda?.getWaveform(track.id).then((url) => {
        if (url && waveform.isConnected) waveform.style.backgroundImage = `url("${url}")`;
      });

      const actions = document.createElement("div");
      actions.className = "diagnostics-track-review-actions";
      const addButton = (label: string, action: () => void | Promise<void>) => {
        const button = document.createElement("button");
        button.textContent = label;
        button.addEventListener("click", () => void action());
        actions.appendChild(button);
        return button;
      };
      const play = async (fromMs: number, stopAtMs: number | null) => {
        if (
          diagnosticsReviewAudio
          && !diagnosticsReviewAudio.paused
          && diagnosticsReviewAudio.dataset.trackId === track.id
        ) {
          diagnosticsReviewStopAtSeconds = stopAtMs === null ? null : stopAtMs / 1000;
          diagnosticsReviewAudio.currentTime = Math.max(0, fromMs / 1000);
          return;
        }
        stopDiagnosticsReviewAudio();
        await stopMainForDiagnosticsAudition();
        const audio = new Audio(localAudioUrl(track.fullPath));
        audio.dataset.trackId = track.id;
        diagnosticsReviewAudio = audio;
        diagnosticsReviewStopAtSeconds = stopAtMs === null ? null : stopAtMs / 1000;
        audio.addEventListener("loadedmetadata", () => {
          audio.currentTime = Math.max(0, fromMs / 1000);
          void audio.play().catch(stopDiagnosticsReviewAudio);
        }, { once: true });
        audio.addEventListener("playing", () => {
          if (diagnosticsReviewState === playbackState) {
            playbackState.textContent = t("diagnosticsTrackReviewPlaying");
            playbackState.dataset.state = "playing";
          }
        });
        audio.addEventListener("pause", () => {
          if (diagnosticsReviewState === playbackState) {
            playbackState.textContent = t("diagnosticsTrackReviewStopped");
            playbackState.dataset.state = "stopped";
          }
        });
        audio.addEventListener("error", stopDiagnosticsReviewAudio, { once: true });
        audio.addEventListener("timeupdate", () => {
          if (diagnosticsReviewPlayhead === playhead) {
            diagnosticsReviewPlayhead.style.left = `${Math.max(0, Math.min(100,
              (audio.currentTime * 1000 / track.durationMs) * 100))}%`;
          }
          if (diagnosticsReviewStopAtSeconds !== null && audio.currentTime >= diagnosticsReviewStopAtSeconds) {
            stopDiagnosticsReviewAudio();
          }
        });
        audio.addEventListener("ended", stopDiagnosticsReviewAudio, { once: true });
      };
      waveform.addEventListener("click", (event) => {
        const bounds = waveform.getBoundingClientRect();
        if (bounds.width > 0) void play(((event.clientX - bounds.left) / bounds.width) * track.durationMs, null);
      });
      addButton(t("diagnosticsTrackReviewOriginal"), () => play(0, null));
      addButton(t("diagnosticsTrackReviewTrimmed"), () => play(Number(start.value), Number(end.value)));
      addButton(t("diagnosticsTrackReviewStart"), () => play(Number(start.value), null));
      addButton(t("diagnosticsTrackReviewEnding"), () => play(Math.max(Number(start.value), Number(end.value) - 10_000), null));
      addButton(t("diagnosticsTrackReviewStop"), stopDiagnosticsReviewAudio);
      addButton(t("diagnosticsTrackReviewSave"), async () => {
        const result = await window.tanda!.saveDiagnosticsTrackTrim({
          id: track.id,
          startOffsetMs: Number(start.value),
          endTrimMs: track.durationMs - Number(end.value),
        });
        if (result.ok) {
          setStatus(t("diagnosticsTrackReviewSaved"));
          await renderDiagnosticsDataReadiness();
        }
      });
      addButton(t("diagnosticsTrackReviewReset"), async () => {
        await window.tanda!.resetDiagnosticsTrackTrim(track.id);
        await renderDiagnosticsDataReadiness();
      });
      const okButton = addButton(t("diagnosticsTrackReviewOk"), async () => {
        const result = await window.tanda!.acknowledgeDiagnosticsTrack({
          id: track.id,
          issueSignature: track.issueSignature,
        });
        if (!result.ok) return;
        const message = t("diagnosticsTrackReviewAcknowledged");
        reviewNotice.textContent = message;
        reviewNotice.classList.remove("hidden");
        okButton.disabled = true;
        track.acknowledged = true;
        const statusCell = row.querySelector<HTMLElement>("[data-review-status]");
        if (statusCell) statusCell.textContent = t("diagnosticsTrackReviewApproved");
        row.dataset.reviewStatus = "acknowledged";
        setStatus(message);
      });
      okButton.disabled = track.acknowledged;
      addButton(t("trackEditorDelete"), async () => {
        const removeFile = await showDeleteTrackModal();
        if (removeFile === null) return;
        const result = await window.tanda!.deleteTrack({ id: track.id, removeFile });
        if (result.ok) await renderDiagnosticsDataReadiness();
      });
      panel.append(heading, sourcePath, reviewNotice, playbackState, waveform, startLabel, endLabel, actions);
    };

    tracks.forEach((track) => {
      const row = document.createElement("tr");
      row.tabIndex = 0;
      const issue = track.issueKinds.map((kind) => t(kind === "short" ? "diagnosticsTrackReviewShort" : "diagnosticsTrackReviewTrim")).join(", ");
      [
        track.title,
        issue,
        `${Math.round(track.durationMs / 1000)}s / ${Math.round(track.effectiveDurationMs / 1000)}s`,
        t(track.acknowledged ? "diagnosticsTrackReviewApproved" : "diagnosticsTrackReviewPending"),
      ].forEach((value, index) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          if (index === 3) cell.dataset.reviewStatus = "true";
          row.appendChild(cell);
        });
      row.dataset.reviewStatus = track.acknowledged ? "acknowledged" : "pending";
      row.addEventListener("click", () => void selectTrack(track, row));
      row.addEventListener("keydown", (event) => { if (event.key === "Enter") void selectTrack(track, row); });
      body.appendChild(row);
    });
    const firstRow = body.querySelector("tr");
    const firstTrack = tracks.values().next().value;
    if (firstRow && firstTrack) await selectTrack(firstTrack, firstRow);
  };

  return {
    renderDiagnosticsTrackReview,
  };
};
