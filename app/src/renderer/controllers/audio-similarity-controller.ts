import { buildAudioSimilarityIndex } from "../state/audio-similarity-index.js";
import type { AudioSimilarityReport, AudioSimilarityRelationshipType, AudioSimilarityMetadataChange, AudioSimilarityMember, AudioSimilarityAuditionTrack } from "../../shared/audio-similarity.js";
import { resolvePlaybackNormalization } from "../../shared/audio-normalization.js";
import { localAudioUrl } from "../modules/local-audio-url.js";
import type { TrackRow } from "../../shared/types.js";
import type { TandaDraft } from "../domain.js";
type OutputChannel = "main" | "headphone";

export interface AudioSimilarityControllerOptions {
  t: (key: string, params?: Record<string, string | number>) => string;
  releaseAudioDspRuntime: (audio: HTMLAudioElement) => Promise<void>;
  audioSimilarityGroups: HTMLElement | null;
  audioSimilaritySummary: HTMLElement | null;
  audioSimilaritySearch: HTMLInputElement | null;
  audioSimilarityStatus: HTMLElement | null;
  generateAudioSimilarityBtn: HTMLButtonElement | null;
  cancelAudioSimilarityBtn: HTMLButtonElement | null;
  showConfirmModal: (message: string, confirmLabel?: string, options?: { title?: string; cancelLabel?: string; }) => Promise<boolean>;
  renderAllLists: () => void;
  formatTime: (seconds: number) => string;
  trackCache: Map<string, TrackRow>;
  updateTrackCaches: (track: TrackRow) => void;
  openTrackEditor: (trackId: string) => Promise<void>;
  tandaCache: Map<string, TandaDraft>;
  loadTandaDrafts: () => Promise<void>;
  setStatus: (message: string) => void;
  buildDetailMenuButton: () => HTMLButtonElement;
  closeDetailMenus: () => void;
  buildActionButton: (labelKey: string, shortKey: string, action: string) => HTMLButtonElement;
  runSearchForTrack: (track: TrackRow, preferredStyles?: string[]) => void;
  stopMainForSimilarityAudition: () => Promise<void>;
  resolveOutputDeviceIdForChannel: (channel: OutputChannel) => string | null;
  shouldUseAudioDspForOutput: (channel: OutputChannel, requestedOutputDeviceId: string | null) => boolean;
  ensureAudioDspRuntime: (audio: HTMLAudioElement) => unknown;
  setAudioLevel: (audio: HTMLAudioElement, level: number) => void;
  gainForTrack: (gainDb: number | null | undefined) => number;
  applyOutputDevice: (audio: HTMLAudioElement, deviceId: string | null) => Promise<{ appliedDeviceId: string | null }>;
  invalidateTrackTandaUsage: () => void;
  openAudioSimilarityBtn: HTMLButtonElement | null;
  audioSimilarityPage: HTMLElement | null;
  closeAudioSimilarityBtn: HTMLButtonElement | null;
}

export const createAudioSimilarityController = (options: AudioSimilarityControllerOptions) => {
  const {
    t,
    releaseAudioDspRuntime,
    audioSimilarityGroups,
    audioSimilaritySummary,
    audioSimilaritySearch,
    audioSimilarityStatus,
    generateAudioSimilarityBtn,
    cancelAudioSimilarityBtn,
    showConfirmModal,
    renderAllLists,
    formatTime,
    trackCache,
    updateTrackCaches,
    openTrackEditor,
    tandaCache,
    loadTandaDrafts,
    setStatus,
    buildDetailMenuButton,
    closeDetailMenus,
    buildActionButton,
    runSearchForTrack,
    stopMainForSimilarityAudition,
    resolveOutputDeviceIdForChannel,
    shouldUseAudioDspForOutput,
    ensureAudioDspRuntime,
    setAudioLevel,
    gainForTrack,
    applyOutputDevice,
    invalidateTrackTandaUsage,
    openAudioSimilarityBtn,
    audioSimilarityPage,
    closeAudioSimilarityBtn,
  } = options;

  let similarityReport: AudioSimilarityReport | null = null;
  let similarityGenerationPending = false;
  let similarityGenerationCompleted = false;
  let similarityEquivalentTrackIds = new Map<string, ReadonlySet<string>>();
  let similarityRelationshipByTrackId = new Map<string, AudioSimilarityRelationshipType>();
  let similarityPreferredTrackIds = new Map<string, string>();
  let similarityHiddenTrackIds = new Set<string>();
  let similarityPreview: HTMLAudioElement | null = null;
  let similarityPreviewButton: HTMLButtonElement | null = null;
  let similarityPreviewBounds: { startMs: number; effectiveMs: number } | null = null;
  let similarityPreviewRequestVersion = 0;
  let similarityActiveGroupId: string | null = null;
  let similaritySharedPosition = 0;
  let similarityPollTimer: number | null = null;
  let similarityMetadataUndoStacks = new Map<string, AudioSimilarityMetadataChange[][]>();

  const createSimilarityWaveform = (
    groupId: string,
    member: AudioSimilarityMember,
    position: HTMLElement,
  ) => {
    const canvas = document.createElement("canvas");
    canvas.className = "audio-similarity-waveform";
    canvas.width = 600;
    canvas.height = 64;
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "slider");
    canvas.setAttribute("aria-label", t("audioSimilarityWaveformSeek", { track: member.title }));
    canvas.setAttribute("aria-valuemin", "0");
    canvas.setAttribute("aria-valuemax", "100");
    const image = new Image();
    let available = false;
    const draw = () => {
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#111827";
      context.fillRect(0, 0, canvas.width, canvas.height);
      if (available) context.drawImage(image, 0, 0, canvas.width, canvas.height);
      else {
        context.fillStyle = "#9ca3af";
        context.font = "14px sans-serif";
        context.fillText(t("waveformLoading"), 10, 38);
      }
      const ratio = similarityActiveGroupId === groupId ? similaritySharedPosition : 0;
      const x = Math.round(ratio * canvas.width);
      context.fillStyle = "rgba(56, 189, 248, 0.2)";
      context.fillRect(0, 0, x, canvas.height);
      context.strokeStyle = "#38bdf8";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
      canvas.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
    };
    const setRatio = (ratio: number) => {
      similarityActiveGroupId = groupId;
      similaritySharedPosition = Math.max(0, Math.min(1, ratio));
      position.textContent = t("audioSimilaritySharedPosition", {
        percent: Math.round(similaritySharedPosition * 100),
      });
      if (similarityPreview && similarityPreviewBounds) {
        similarityPreview.currentTime = (
          similarityPreviewBounds.startMs
          + similarityPreviewBounds.effectiveMs * similaritySharedPosition
        ) / 1000;
      }
      canvas.closest(".audio-similarity-group")
        ?.querySelectorAll<HTMLCanvasElement>(".audio-similarity-waveform")
        .forEach((candidate) => candidate.dispatchEvent(new Event("similarity-position-change")));
    };
    canvas.addEventListener("click", (event) => {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width > 0) setRatio((event.clientX - bounds.left) / bounds.width);
    });
    canvas.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const current = similarityActiveGroupId === groupId ? similaritySharedPosition : 0;
      setRatio(current + (event.key === "ArrowRight" ? 0.05 : -0.05));
    });
    canvas.addEventListener("similarity-position-change", draw);
    draw();
    void window.tanda?.getWaveform(member.trackId).then((dataUrl) => {
      if (!dataUrl || !canvas.isConnected) {
        const context = canvas.getContext("2d");
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.fillStyle = "#9ca3af";
          context.font = "14px sans-serif";
          context.fillText(t("waveformUnavailable"), 10, 38);
        }
        return;
      }
      image.addEventListener("load", () => { available = true; draw(); }, { once: true });
      image.src = dataUrl;
    }).catch(() => {
      // A missing waveform leaves the labelled canvas unavailable without blocking the report.
    });
    return canvas;
  };
  const AUDIO_SIMILARITY_COLLAPSED_KEY = "audio-similarity-collapsed-groups";
  let similarityGroupSelections = new Map<string, Set<string>>();
  let similarityGroupMasterSelections = new Map<string, string>();
  let similarityCollapsedGroupIds = new Set<string>();
  try {
    const stored = JSON.parse(localStorage.getItem(AUDIO_SIMILARITY_COLLAPSED_KEY) ?? "[]");
    if (Array.isArray(stored)) {
      similarityCollapsedGroupIds = new Set(stored.filter((id): id is string => typeof id === "string"));
    }
  } catch {
    similarityCollapsedGroupIds = new Set();
  }

  const saveSimilarityCollapsedGroups = () => {
    localStorage.setItem(
      AUDIO_SIMILARITY_COLLAPSED_KEY,
      JSON.stringify([...similarityCollapsedGroupIds]),
    );
  };

  const stopSimilarityPreview = () => {
    similarityPreviewRequestVersion += 1;
    if (similarityPreview) {
      similarityPreview.pause();
      void releaseAudioDspRuntime(similarityPreview);
    }
    similarityPreview = null;
    similarityPreviewBounds = null;
    if (similarityPreviewButton) {
      similarityPreviewButton.textContent = t("audioSimilarityPlay");
      similarityPreviewButton.setAttribute("aria-pressed", "false");
    }
    similarityPreviewButton = null;
  };

  const refreshOpenSimilarityMetadataOverlay = () => {
    const overlay = document.querySelector<HTMLElement>(
      ".audio-similarity-lazy-modal[data-similarity-metadata-group-id]",
    );
    const groupId = overlay?.dataset.similarityMetadataGroupId;
    if (!overlay || !groupId) return;
    overlay.remove();
    audioSimilarityGroups
      ?.querySelector<HTMLElement>(
        `[data-similarity-group-id="${CSS.escape(groupId)}"] [data-action="show-similarity-metadata"]`,
      )
      ?.click();
  };

  const translateAudioSimilarityRelationship = (
    relationshipType: AudioSimilarityRelationshipType,
  ) => t(
    relationshipType === "identical"
      ? "audioSimilarityIdentical"
      : relationshipType === "same-recording"
        ? "audioSimilaritySameRecording"
        : relationshipType === "same-orchestra"
          ? "audioSimilaritySameOrchestra"
          : "audioSimilaritySameComposition",
  );

  const openAudioSimilarityOverlay = (titleText: string) => {
    const overlay = document.createElement("div");
    overlay.className = "audio-similarity-lazy-modal";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    const dialog = document.createElement("section");
    dialog.className = "audio-similarity-lazy-dialog";
    const header = document.createElement("header");
    const title = document.createElement("h3");
    title.textContent = titleText;
    const close = document.createElement("button");
    close.textContent = t("close");
    const dismiss = () => {
      stopSimilarityPreview();
      overlay.dispatchEvent(new Event("similarity-overlay-dismiss"));
      overlay.remove();
    };
    close.addEventListener("click", dismiss);
    header.append(title, close);
    const body = document.createElement("div");
    dialog.append(header, body);
    overlay.appendChild(dialog);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) dismiss();
    });
    document.body.appendChild(overlay);
    close.focus();
    return body;
  };

  const chooseAudioSimilarityMaster = (
    members: AudioSimilarityMember[],
    selectedIds: ReadonlySet<string>,
    currentTrackId: string | null,
  ) => new Promise<string | null>((resolve) => {
    const body = openAudioSimilarityOverlay(t("audioSimilarityChooseMasterTitle"));
    const overlay = body.closest<HTMLElement>(".audio-similarity-lazy-modal");
    let settled = false;
    let chosenTrackId = currentTrackId && selectedIds.has(currentTrackId)
      ? currentTrackId : null;
    const finish = (trackId: string | null) => {
      if (settled) return;
      settled = true;
      overlay?.remove();
      resolve(trackId);
    };
    const help = document.createElement("p");
    help.textContent = t("audioSimilarityChooseMasterHelp");
    body.appendChild(help);
    const choices = document.createElement("div");
    choices.className = "audio-similarity-master-dialog-choices";
    for (const member of members.filter((candidate) => selectedIds.has(candidate.trackId))) {
      const label = document.createElement("label");
      label.className = "audio-similarity-compact-track";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "audio-similarity-master-dialog";
      input.value = member.trackId;
      input.checked = chosenTrackId === member.trackId;
      const identity = document.createElement("span");
      identity.textContent = [member.title, member.artist, member.album, member.fullPath]
        .filter(Boolean).join(" · ");
      input.addEventListener("change", () => {
        if (input.checked) chosenTrackId = member.trackId;
        apply.disabled = !chosenTrackId;
      });
      label.append(input, identity);
      choices.appendChild(label);
    }
    const actions = document.createElement("div");
    actions.className = "audio-similarity-actions";
    const cancel = document.createElement("button");
    cancel.textContent = t("cancel");
    cancel.addEventListener("click", () => finish(null));
    const apply = document.createElement("button");
    apply.textContent = t("audioSimilarityApply");
    apply.disabled = !chosenTrackId;
    apply.addEventListener("click", () => finish(chosenTrackId));
    actions.append(cancel, apply);
    body.append(choices, actions);
    overlay?.querySelector("header button")?.addEventListener("click", () => finish(null), { once: true });
    overlay?.addEventListener("click", (event) => {
      if (event.target === overlay) finish(null);
    });
  });

  const renderAudioSimilarityReport = () => {
    if (!audioSimilarityGroups || !audioSimilaritySummary || !similarityReport) return;
    const report = similarityReport;
    const query = audioSimilaritySearch?.value.trim().toLocaleLowerCase() ?? "";
    const running = similarityGenerationPending
      || report.status.state === "running"
      || report.status.state === "cancelling";
    if (audioSimilarityStatus) {
      audioSimilarityStatus.textContent = running
        ? report.status.totalTracks > 0
          && report.status.processedTracks >= report.status.totalTracks
          ? report.status.comparisonPairsTotal > 0
            ? t("audioSimilarityComparingProgress", {
                total: report.status.totalTracks,
                percent: Math.min(100, Math.floor(
                  report.status.comparisonPairsProcessed
                    / report.status.comparisonPairsTotal * 100,
                )),
              })
            : t("audioSimilarityComparing", { total: report.status.totalTracks })
          : t("audioSimilarityRunning", {
              processed: report.status.processedTracks,
              total: report.status.totalTracks,
            })
        : report.status.state === "failed"
          ? t("audioSimilarityFailed", { message: report.status.error ?? "" })
          : similarityGenerationCompleted
            ? t("audioSimilarityGenerationComplete")
            : "";
    }
    if (generateAudioSimilarityBtn) {
      generateAudioSimilarityBtn.disabled = running;
      generateAudioSimilarityBtn.textContent = t(
        report.hasCompletedReport ? "audioSimilarityRegenerate" : "audioSimilarityGenerate",
      );
    }
    if (cancelAudioSimilarityBtn) cancelAudioSimilarityBtn.disabled = !running;
    audioSimilaritySummary.textContent = report.hasCompletedReport
      ? t("audioSimilarityComplete", {
          groups: report.candidateGroups.length,
          matches: report.status.matchingPairs,
          failed: report.status.failedTracks,
        })
      : t("audioSimilarityEmpty");
    if (report.status.staleTracks > 0) {
      audioSimilaritySummary.textContent += ` · ${t("audioSimilarityStale", {
        count: report.status.staleTracks,
      })}`;
    }
    audioSimilaritySummary.textContent += ` · ${t("audioSimilarityIntegrity", {
      version: report.integrity.algorithmVersion,
      ready: report.integrity.readyTracks,
      total: report.integrity.activeTracks,
      orphaned: report.integrity.orphanedFeatures + report.integrity.orphanedConfirmedMembers,
    })}`;
    audioSimilarityGroups.innerHTML = "";
    let hiddenTracksCard: HTMLElement | null = null;
    const reviewSection = document.createElement("details");
    reviewSection.className = "audio-similarity-review-section";
    reviewSection.open = true;
    const reviewHeading = document.createElement("summary");
    const reviewContent = document.createElement("div");
    reviewContent.className = "audio-similarity-review-content";
    reviewSection.append(reviewHeading, reviewContent);
    let reviewCount = 0;
    const reviewedSection = document.createElement("details");
    reviewedSection.className = "audio-similarity-reviewed-section";
    const reviewedSummary = document.createElement("summary");
    const reviewedContent = document.createElement("div");
    reviewedContent.className = "audio-similarity-reviewed-content";
    reviewedSection.append(reviewedSummary, reviewedContent);
    let reviewedCount = 0;
    const reviewedCards: Array<{ card: HTMLElement; processedAt: string }> = [];
    for (const confirmedGroup of report.confirmedGroups) {
      const representedByCandidate = report.candidateGroups.some((candidate) => {
        const candidateIds = new Set(candidate.members.map((member) => member.trackId));
        return confirmedGroup.trackIds.filter((trackId) => candidateIds.has(trackId)).length >= 2;
      });
      if (representedByCandidate) continue;
      const confirmedCard = document.createElement("article");
      confirmedCard.className = "audio-similarity-card";
      const label = document.createElement("strong");
      label.textContent = t("audioSimilarityConfirmedGroup", {
        type: translateAudioSimilarityRelationship(confirmedGroup.relationshipType),
        count: confirmedGroup.trackIds.length,
      });
      const ids = document.createElement("small");
      ids.textContent = confirmedGroup.trackIds.join(" · ");
      const withdraw = document.createElement("button");
      withdraw.textContent = t("audioSimilarityWithdraw");
      withdraw.addEventListener("click", async () => {
        if (!(await showConfirmModal(
          t("audioSimilarityWithdrawConfirm"), t("audioSimilarityWithdraw"),
        ))) return;
        await window.tanda?.withdrawConfirmedAudioSimilarityGroup(confirmedGroup.id);
        await loadAudioSimilarityReport();
        renderAllLists();
      });
      confirmedCard.append(label, ids, withdraw);
      reviewedCards.push({ card: confirmedCard, processedAt: confirmedGroup.updatedAt });
      reviewedCount += 1;
    }
    for (const failure of report.failures) {
      const failureRow = document.createElement("div");
      failureRow.className = "audio-similarity-card";
      failureRow.textContent = t("audioSimilarityFailureItem", {
        track: failure.title, message: failure.message,
      });
      audioSimilarityGroups.appendChild(failureRow);
    }
    if (report.hiddenTracks.length > 0) {
      const hiddenCard = document.createElement("article");
      hiddenCard.className = "audio-similarity-card audio-similarity-hidden-tracks";
      const hiddenHeading = document.createElement("h3");
      hiddenHeading.textContent = t("audioSimilarityHiddenTracks");
      hiddenCard.appendChild(hiddenHeading);
      for (const hiddenTrack of report.hiddenTracks) {
        const row = document.createElement("div");
        row.className = "audio-similarity-actions";
        const label = document.createElement("span");
        label.textContent = t("audioSimilarityHiddenTrack", {
          title: hiddenTrack.title, artist: hiddenTrack.artist, path: hiddenTrack.fullPath,
        });
        const restore = document.createElement("button");
        restore.textContent = t("audioSimilarityRestore");
        restore.addEventListener("click", async () => {
          await window.tanda?.setTrackHidden(hiddenTrack.trackId, false);
          await loadAudioSimilarityReport();
        });
        row.append(label, restore);
        hiddenCard.appendChild(row);
      }
      hiddenTracksCard = hiddenCard;
    }
    const visibleGroups = report.candidateGroups.filter((group) =>
      !query || group.members.some((member) =>
        `${member.title} ${member.artist} ${member.album} ${member.fullPath}`
          .toLocaleLowerCase().includes(query)),
    );
    for (const [groupIndex, group] of visibleGroups.entries()) {
      const memberIds = new Set(group.members.map((member) => member.trackId));
      const matchingConfirmedGroups = report.confirmedGroups
        .map((confirmed) => ({
          confirmed,
          matchedIds: confirmed.trackIds.filter((trackId) => memberIds.has(trackId)),
        }))
        .filter((entry) => entry.matchedIds.length >= 2)
        .sort((left, right) => right.matchedIds.length - left.matchedIds.length);
      const confirmedGroup = matchingConfirmedGroups[0] ?? null;
      let selectedIds = similarityGroupSelections.get(group.id);
      if (!selectedIds) {
        selectedIds = new Set(
          confirmedGroup?.matchedIds ?? group.members.map((member) => member.trackId),
        );
        similarityGroupSelections.set(group.id, selectedIds);
      }
      const rememberedMasterTrackId = similarityGroupMasterSelections.get(group.id) ?? null;
      let masterTrackId = confirmedGroup?.confirmed.relationshipType === "identical"
        ? confirmedGroup.confirmed.preferredTrackId
        : rememberedMasterTrackId
            && memberIds.has(rememberedMasterTrackId)
            && selectedIds.has(rememberedMasterTrackId)
          ? rememberedMasterTrackId
          : null;
      if (masterTrackId) similarityGroupMasterSelections.set(group.id, masterTrackId);
      else similarityGroupMasterSelections.delete(group.id);
      const card = document.createElement("article");
      card.className = `audio-similarity-card audio-similarity-group group-color-${groupIndex % 6}`;
      card.dataset.similarityGroupId = group.id;
      const header = document.createElement("header");
      header.className = "audio-similarity-group-header";
      const collapse = document.createElement("button");
      collapse.className = "audio-similarity-collapse";
      const collapsed = similarityCollapsedGroupIds.has(group.id);
      collapse.textContent = collapsed ? "▸" : "▾";
      collapse.title = t(collapsed ? "audioSimilarityExpandGroup" : "audioSimilarityCollapseGroup");
      collapse.setAttribute("aria-label", collapse.title);
      collapse.setAttribute("aria-expanded", collapsed ? "false" : "true");
      const heading = document.createElement("h3");
      const updateHeading = () => {
        const count = selectedIds!.size;
        heading.textContent = confirmedGroup
          ? t("audioSimilarityMatchedCount", { matched: count, total: group.members.length })
          : count === group.members.length
            ? t("audioSimilarityTracks", { count: group.members.length })
            : t("audioSimilaritySelectedCount", { selected: count, total: group.members.length });
      };
      updateHeading();
      const distinctTitles = [...new Map(group.members.map((member) => {
        const title = member.title.trim() || member.fullPath.split(/[\\/]/).pop() || member.trackId;
        return [title.toLocaleLowerCase(), title] as const;
      })).values()];
      const titleSummary = document.createElement("span");
      titleSummary.className = "audio-similarity-title-summary";
      titleSummary.textContent = `${t("audioSimilarityMetaTitle")}: ${distinctTitles.join(" / ")}`;
      const confirmedTag = document.createElement("span");
      confirmedTag.className = "audio-similarity-confirmed-tag";
      confirmedTag.textContent = t("audioSimilarityConfirmedMatch");
      confirmedTag.classList.toggle("hidden", !confirmedGroup);
      const confidence = document.createElement("strong");
      const exactFile = group.members.some((member, index) =>
        group.members.slice(index + 1).some((other) => other.fileHash === member.fileHash));
      confidence.textContent = `${exactFile
        ? t("audioSimilarityExactFiles")
        : t("audioSimilarityCandidateEvidence")} · ${group.confidence.toFixed(6)}`;
      header.append(collapse, heading, titleSummary, confirmedTag, confidence);
      card.appendChild(header);
      if (matchingConfirmedGroups.length > 0) {
        const relationships = document.createElement("div");
        relationships.className = "audio-similarity-confirmed-relationships";
        for (const match of matchingConfirmedGroups) {
          const relationship = document.createElement("span");
          relationship.textContent = `${translateAudioSimilarityRelationship(
            match.confirmed.relationshipType,
          )}: ${match.matchedIds.length}`;
          relationships.appendChild(relationship);
        }
        card.appendChild(relationships);
      }
      const position = document.createElement("div");
      position.dataset.similarityPosition = group.id;
      position.textContent = t("audioSimilaritySharedPosition", {
        percent: similarityActiveGroupId === group.id ? Math.round(similaritySharedPosition * 100) : 0,
      });
      card.appendChild(position);
      const members = document.createElement("div");
      members.className = "audio-similarity-members";
      for (const member of group.members) {
        const row = document.createElement("div");
        row.className = "audio-similarity-member";
        const selected = document.createElement("input");
        selected.type = "checkbox";
        selected.checked = selectedIds.has(member.trackId);
        selected.value = member.trackId;
        selected.setAttribute("aria-label", t("audioSimilarityIncludeMatch", {
          title: member.title, artist: member.artist,
        }));
        selected.addEventListener("change", () => {
          if (selected.checked) selectedIds!.add(member.trackId);
          else {
            selectedIds!.delete(member.trackId);
            if (masterTrackId === member.trackId) {
              masterTrackId = null;
              similarityGroupMasterSelections.delete(group.id);
            }
          }
          updateHeading();
          card.querySelectorAll<HTMLButtonElement>("[data-similarity-confirm]")
            .forEach((button) => { button.disabled = selectedIds!.size < 2; });
          card.querySelector<HTMLButtonElement>("[data-similarity-reject]")?.dispatchEvent(
            new Event("similarity-selection-change"),
          );
        });
        const election = document.createElement("label");
        election.className = "audio-similarity-election";
        const electionText = document.createElement("span");
        electionText.textContent = t("audioSimilarityInclude");
        election.append(selected, electionText);
        const master = document.createElement("label");
        master.className = "audio-similarity-master";
        const masterChoice = document.createElement("input");
        masterChoice.type = "radio";
        masterChoice.name = `similarity-master-${group.id}`;
        masterChoice.dataset.masterTrackId = member.trackId;
        masterChoice.checked = masterTrackId === member.trackId;
        masterChoice.setAttribute("aria-label", t("audioSimilarityElectMaster", {
          title: member.title, artist: member.artist,
        }));
        masterChoice.addEventListener("change", () => {
          if (!masterChoice.checked) return;
          masterTrackId = member.trackId;
          similarityGroupMasterSelections.set(group.id, member.trackId);
          if (!selected.checked) {
            selected.checked = true;
            selected.dispatchEvent(new Event("change"));
          }
        });
        const masterText = document.createElement("span");
        masterText.textContent = t("audioSimilarityMaster");
        master.append(masterChoice, masterText);
        const text = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = member.title || member.fullPath.split(/[\\/]/).pop() || member.trackId;
        const detail = document.createElement("small");
        detail.textContent = [member.artist, member.album, member.fullPath].filter(Boolean).join(" · ");
        const waveform = createSimilarityWaveform(group.id, member, position);
        const effectiveDuration = document.createElement("small");
        effectiveDuration.className = "audio-similarity-effective-duration";
        effectiveDuration.textContent = `${t("colDuration")}: ${formatTime(
          Math.max(0, member.durationMs - member.startOffsetMs - member.endTrimMs) / 1000,
        )}`;
        text.append(title, detail, waveform, effectiveDuration);
        const format = document.createElement("span");
        format.className = "audio-similarity-format";
        format.textContent = member.fullPath.split(".").pop() || "audio";
        const play = document.createElement("button");
        play.textContent = t("audioSimilarityPlay");
        play.addEventListener("click", () => {
          void playSimilarityMember(group.id, member, position, play);
        });
        const hide = document.createElement("button");
        hide.textContent = t(member.hidden ? "audioSimilarityRestore" : "audioSimilarityHide");
        hide.addEventListener("click", async () => {
          await window.tanda?.setTrackHidden(member.trackId, !member.hidden);
          await loadAudioSimilarityReport();
        });
        const memberActions = document.createElement("div");
        memberActions.className = "audio-similarity-member-actions";
        memberActions.append(format, play, hide);
        const memberChoices = document.createElement("div");
        memberChoices.className = "audio-similarity-member-choices";
        memberChoices.append(election, master);
        row.append(memberChoices, text, memberActions);
        members.appendChild(row);
      }
      card.appendChild(members);
      const metadataButton = document.createElement("button");
      metadataButton.dataset.action = "show-similarity-metadata";
      metadataButton.textContent = t("audioSimilarityShowMetadata");
      metadataButton.addEventListener("click", () => {
      const tableWrap = openAudioSimilarityOverlay(t("audioSimilarityMetadataTitle"));
      const metadataOverlay = tableWrap.closest<HTMLElement>(".audio-similarity-lazy-modal");
      if (metadataOverlay) {
        metadataOverlay.dataset.similarityMetadataGroupId = group.id;
        metadataOverlay.addEventListener("similarity-overlay-dismiss", () => {
          similarityMetadataUndoStacks.delete(group.id);
        }, { once: true });
      }
      const undoStack = similarityMetadataUndoStacks.get(group.id) ?? [];
      similarityMetadataUndoStacks.set(group.id, undoStack);
      const metadataActions = document.createElement("div");
      metadataActions.className = "audio-similarity-actions";
      const undo = document.createElement("button");
      undo.textContent = t("audioSimilarityUndo");
      undo.disabled = undoStack.length === 0;
      undo.addEventListener("click", async () => {
        const changes = undoStack.pop();
        if (!changes) return;
        const result = await window.tanda?.undoAudioSimilarityMetadata(changes);
        if (result?.conflicts.length) {
          const conflicts = new Set(result.conflicts);
          undoStack.push(changes.filter((change) => conflicts.has(change.trackId)));
        }
        await loadAudioSimilarityReport();
        metadataOverlay?.remove();
        audioSimilarityGroups
          ?.querySelector<HTMLElement>(
            `[data-similarity-group-id="${CSS.escape(group.id)}"] [data-action="show-similarity-metadata"]`,
          )
          ?.click();
      });
      metadataActions.appendChild(undo);
      tableWrap.appendChild(metadataActions);
      tableWrap.style.overflowX = "auto";
      const table = document.createElement("table");
      const metadataFields: Array<{
        label: string;
        field: keyof AudioSimilarityMember;
        editable?: "title" | "artist" | "artist_summary" | "singer" | "year" | "genre" | "bpm" | "notes" | "instrumental";
      }> = [
        { label: t("audioSimilarityMetaTitle"), field: "title", editable: "title" },
        { label: t("audioSimilarityMetaArtist"), field: "artist", editable: "artist" },
        { label: t("audioSimilarityMetaArtistSummary"), field: "artistSummary", editable: "artist_summary" },
        { label: t("audioSimilarityMetaSinger"), field: "singer", editable: "singer" },
        { label: t("audioSimilarityMetaAlbum"), field: "album" },
        { label: t("audioSimilarityMetaYear"), field: "year", editable: "year" },
        { label: t("audioSimilarityMetaStyle"), field: "genre", editable: "genre" },
        { label: t("audioSimilarityMetaBpm"), field: "bpm", editable: "bpm" },
        { label: t("audioSimilarityMetaNotes"), field: "notes", editable: "notes" },
        { label: t("audioSimilarityMetaInstrumental"), field: "instrumental", editable: "instrumental" },
        { label: t("audioSimilarityMetaPath"), field: "fullPath" },
      ];
      const head = document.createElement("tr");
      const attributeHeading = document.createElement("th");
      attributeHeading.textContent = t("audioSimilarityAttribute");
      head.appendChild(attributeHeading);
      group.members.forEach((member) => {
        const th = document.createElement("th");
        const trackHeading = document.createElement("span");
        trackHeading.textContent = `${member.title} · ${member.artist}`;
        const editTrack = document.createElement("button");
        editTrack.className = "audio-similarity-edit-track";
        editTrack.textContent = t("audioSimilarityEditTrack");
        editTrack.setAttribute("aria-label", t("audioSimilarityEditNamedTrack", {
          title: member.title,
        }));
        editTrack.addEventListener("click", async () => {
          if (!trackCache.has(member.trackId)) {
            const track = (await window.tanda?.listTracks())
              ?.find((candidate) => candidate.id === member.trackId);
            if (track) updateTrackCaches(track);
          }
          await openTrackEditor(member.trackId);
        });
        th.title = `${member.album}\n${member.fullPath}`;
        th.append(trackHeading, editTrack);
        head.appendChild(th);
      });
      table.appendChild(head);
      for (const metadata of metadataFields) {
        const row = document.createElement("tr");
        const label = document.createElement("th");
        label.textContent = metadata.label;
        row.appendChild(label);
        const comparisonValues = group.members.map((member) => String(member[metadata.field] ?? ""));
        const differs = new Set(comparisonValues).size > 1;
        for (const member of group.members) {
          const cell = document.createElement("td");
          const value = member[metadata.field];
          cell.textContent = value === null || value === "" ? "—" : String(value);
          cell.classList.add(differs ? "metadata-different" : "metadata-equal");
          if (metadata.editable) {
            cell.tabIndex = 0;
            cell.role = "button";
            const replicate = async () => {
              const targets = group.members.filter((candidate) => candidate.trackId !== member.trackId);
              const result = await window.tanda?.replicateAudioSimilarityMetadata(
                member.trackId, targets.map((target) => target.trackId), metadata.editable!,
              );
              if (result?.changes.length) undoStack.push(result.changes);
              await loadAudioSimilarityReport();
              tableWrap.closest(".audio-similarity-lazy-modal")?.remove();
              audioSimilarityGroups
                ?.querySelector<HTMLElement>(
                  `[data-similarity-group-id="${CSS.escape(group.id)}"] [data-action="show-similarity-metadata"]`,
                )
                ?.click();
            };
            cell.addEventListener("click", replicate);
            cell.addEventListener("keydown", (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void replicate();
              }
            });
          }
          row.appendChild(cell);
        }
        table.appendChild(row);
      }
      tableWrap.appendChild(table);
      });
      const detailActions = document.createElement("div");
      detailActions.className = "audio-similarity-detail-actions";
      detailActions.appendChild(metadataButton);
      const comparedMetadata: Array<{ label: string; field: keyof AudioSimilarityMember }> = [
        { label: t("audioSimilarityMetaArtist"), field: "artist" },
        { label: t("audioSimilarityMetaTitle"), field: "title" },
        { label: t("audioSimilarityMetaSinger"), field: "singer" },
        { label: t("audioSimilarityMetaBpm"), field: "bpm" },
        { label: t("audioSimilarityMetaNotes"), field: "notes" },
        { label: t("audioSimilarityMetaYear"), field: "year" },
      ];
      const differingMetadata = comparedMetadata.filter(({ field }) => new Set(group.members.map((member) =>
        String(member[field] ?? "").trim().toLocaleLowerCase(),
      )).size > 1);
      const metadataDifferenceLabel = document.createElement("span");
      metadataDifferenceLabel.className = "audio-similarity-metadata-differences";
      metadataDifferenceLabel.textContent = differingMetadata.length
        ? t("audioSimilarityMetadataDiffers", {
            fields: differingMetadata.map(({ label }) => label).join(", "),
          })
        : t("audioSimilarityMetadataMatches");
      detailActions.appendChild(metadataDifferenceLabel);
      const groupedUsages = new Map<string, {
        tandaName: string;
        playlistNames: string[];
        contextTracks: AudioSimilarityAuditionTrack[];
        matches: Array<{ member: AudioSimilarityMember; position: number }>;
      }>();
      for (const member of group.members) {
        for (const usage of member.usages) {
          const existing = groupedUsages.get(usage.tandaId) ?? {
            tandaName: usage.tandaName,
            playlistNames: usage.playlistNames,
            contextTracks: usage.contextTracks,
            matches: [],
          };
          existing.matches.push({ member, position: usage.position });
          groupedUsages.set(usage.tandaId, existing);
        }
      }
      const usageCount = groupedUsages.size;
      const tandasButton = document.createElement("button");
      tandasButton.dataset.action = "show-similarity-tandas";
      tandasButton.textContent = t("audioSimilarityShowTandas", { count: usageCount });
      tandasButton.disabled = usageCount === 0;
      tandasButton.addEventListener("click", () => {
      const usageBody = openAudioSimilarityOverlay(t("audioSimilarityTandasTitle", { count: usageCount }));
      for (const [tandaId, usage] of groupedUsages) {
          const usageRow = document.createElement("div");
          usageRow.className = "audio-similarity-card";
          const usageText = document.createElement("span");
          usageText.textContent = t("audioSimilarityTandaUsage", {
            tanda: usage.tandaName, count: usage.matches.length,
            playlists: usage.playlistNames.length ? ` · ${usage.playlistNames.join(", ")}` : "",
          });
          usageRow.appendChild(usageText);
          const matchedIds = new Set(usage.matches.map((match) => match.member.trackId));
          const comparison = document.createElement("div");
          comparison.className = "audio-similarity-tanda-comparison";
          for (const match of usage.matches) {
            const choices = document.createElement("fieldset");
            choices.className = "audio-similarity-replacement-choices";
            const legend = document.createElement("legend");
            legend.textContent = t("audioSimilarityReplacementPosition", {
              position: match.position + 1,
            });
            choices.appendChild(legend);
            for (const member of group.members) {
              const compact = document.createElement("label");
              compact.className = "audio-similarity-compact-track";
              const isCurrent = match.member.trackId === member.trackId;
              if (isCurrent) compact.classList.add("current");
              const selection = document.createElement("input");
              selection.type = "radio";
              selection.name = `similarity-replacement-${tandaId}-${match.position}`;
              selection.value = member.trackId;
              selection.checked = isCurrent;
              selection.disabled = member.hidden;
              selection.setAttribute("aria-label", t("audioSimilarityUseVersion", {
                track: member.title,
              }));
              const identity = document.createElement("span");
              identity.textContent = [member.artist, member.title, member.album]
                .filter(Boolean).join(" · ");
              const preview = document.createElement("button");
              preview.type = "button";
              preview.textContent = t("audioSimilarityPlay");
              preview.addEventListener("click", (event) => {
                event.preventDefault();
                void playSimilarityMember(`${group.id}:${tandaId}`, member, position, preview);
              });
              compact.append(selection, identity, preview);
              selection.addEventListener("change", async () => {
                if (!selection.checked || isCurrent || member.hidden) return;
                if (!(await showConfirmModal(t("audioSimilarityReplaceConfirm", {
                  tanda: usage.tandaName, oldTrack: match.member.title, newTrack: member.title,
                }), t("audioSimilarityApply")))) {
                  choices.querySelector<HTMLInputElement>(`input[value="${CSS.escape(match.member.trackId)}"]`)!.checked = true;
                  return;
                }
                try {
                  await window.tanda?.replaceAudioSimilarityTandaTrack(
                    tandaId, match.position, member.trackId,
                  );
                  tandaCache.clear();
                  await loadTandaDrafts();
                  await loadAudioSimilarityReport();
                  renderAllLists();
                  usageBody.closest(".audio-similarity-lazy-modal")?.remove();
                  audioSimilarityGroups
                    ?.querySelector<HTMLElement>(
                      `[data-similarity-group-id="${CSS.escape(group.id)}"] [data-action="show-similarity-tandas"]`,
                    )
                    ?.click();
                } catch (error) {
                  choices.querySelector<HTMLInputElement>(`input[value="${CSS.escape(match.member.trackId)}"]`)!.checked = true;
                  setStatus(error instanceof Error ? error.message : String(error));
                }
              });
              choices.appendChild(compact);
            }
            comparison.appendChild(choices);
          }
          usageRow.appendChild(comparison);
          const contextActions = document.createElement("div");
          contextActions.className = "audio-similarity-tanda-tracks";
          for (const contextTrack of usage.contextTracks) {
            const context = document.createElement("div");
            context.className = "tanda-detail-line audio-similarity-tanda-track";
            context.dataset.trackId = contextTrack.trackId;
            if (matchedIds.has(contextTrack.trackId)) context.classList.add("audio-similarity-context-match");
            const identity = document.createElement("span");
            identity.textContent = [contextTrack.artist, contextTrack.title, contextTrack.album]
              .filter(Boolean).join(" · ");
            const actions = document.createElement("div");
            actions.className = "tanda-detail-actions-right";
            const preview = document.createElement("button");
            preview.textContent = t("audioSimilarityPlay");
            preview.title = t("audioSimilarityPreviewContextTrack", { track: contextTrack.title });
            preview.addEventListener("click", () => {
              void playSimilarityMember(
                `${group.id}:${tandaId}`,
                contextTrack,
                position,
                preview,
              );
            });
            const menuButton = buildDetailMenuButton();
            menuButton.addEventListener("click", (event) => {
              event.stopPropagation();
              const wasOpen = context.classList.contains("detail-menu-open");
              closeDetailMenus();
              context.classList.toggle("detail-menu-open", !wasOpen);
            });
            const menu = document.createElement("div");
            menu.className = "tanda-detail-menu";
            const loadContextTrack = async () => {
              const cached = trackCache.get(contextTrack.trackId);
              if (cached) return cached;
              const [loaded] = await window.tanda!.getTracksByIds([contextTrack.trackId]);
              if (loaded) updateTrackCaches(loaded);
              return loaded ?? null;
            };
            const edit = buildActionButton(
              "actionEditTrack",
              "actionEditTrackShort",
              "audio-similarity-edit-context-track",
            );
            edit.addEventListener("click", async (event) => {
              event.stopPropagation();
              await loadContextTrack();
              closeDetailMenus();
              await openTrackEditor(contextTrack.trackId);
            });
            menu.appendChild(edit);
            const search = buildActionButton(
              "actionSearch",
              "actionSearchShort",
              "audio-similarity-search-context-track",
            );
            search.addEventListener("click", async (event) => {
              event.stopPropagation();
              const track = await loadContextTrack();
              closeDetailMenus();
              if (track) runSearchForTrack(track);
            });
            menu.appendChild(search);
            actions.append(preview, menuButton, menu);
            context.append(identity, actions);
            contextActions.appendChild(context);
          }
          usageRow.appendChild(contextActions);
          usageBody.appendChild(usageRow);
      }
      });
      detailActions.appendChild(tandasButton);
      card.appendChild(detailActions);
      const actions = document.createElement("div");
      actions.className = "audio-similarity-actions";
      const reviewHelp = document.createElement("p");
      reviewHelp.textContent = t("audioSimilarityReviewHelp");
      card.appendChild(reviewHelp);
      const confirm = (relationshipType: AudioSimilarityRelationshipType) => async () => {
        const accepted = group.members
          .map((member) => member.trackId)
          .filter((trackId) => selectedIds!.has(trackId));
        if (accepted.length < 2) return;
        if (relationshipType === "identical" && (!masterTrackId || !accepted.includes(masterTrackId))) {
          masterTrackId = await chooseAudioSimilarityMaster(group.members, selectedIds!, masterTrackId);
          if (!masterTrackId) return;
          card.querySelector<HTMLInputElement>(
            `input[data-master-track-id="${CSS.escape(masterTrackId)}"]`,
          )?.click();
        }
        if (!(await showConfirmModal(
          t("audioSimilarityLinkSelectedConfirm", {
            count: accepted.length,
            type: relationshipType === "identical"
              ? t("audioSimilarityIdentical")
              : relationshipType === "same-recording"
                ? t("audioSimilaritySameRecording")
              : relationshipType === "same-orchestra"
                ? t("audioSimilaritySameOrchestra") : t("audioSimilaritySameComposition"),
          }),
          t("audioSimilarityApply"),
        ))) return;
        await window.tanda?.confirmAudioSimilarityGroup(
          group.members.map((member) => member.trackId), accepted, relationshipType,
          relationshipType === "identical" ? masterTrackId : null,
        );
        if (relationshipType !== "identical") {
          similarityGroupMasterSelections.delete(group.id);
        }
        await loadAudioSimilarityReport();
        renderAllLists();
      };
      const recording = document.createElement("button");
      recording.dataset.similarityConfirm = "recording";
      recording.textContent = t("audioSimilarityConfirmRecording");
      recording.disabled = selectedIds.size < 2;
      recording.addEventListener("click", confirm("same-recording"));
      const identical = document.createElement("button");
      identical.dataset.similarityConfirm = "identical";
      identical.textContent = t("audioSimilarityConfirmIdentical");
      identical.disabled = selectedIds.size < 2;
      identical.addEventListener("click", confirm("identical"));
      const orchestra = document.createElement("button");
      orchestra.dataset.similarityConfirm = "orchestra";
      orchestra.textContent = t("audioSimilarityConfirmOrchestra");
      orchestra.disabled = selectedIds.size < 2;
      orchestra.addEventListener("click", confirm("same-orchestra"));
      const composition = document.createElement("button");
      composition.dataset.similarityConfirm = "composition";
      composition.textContent = t("audioSimilarityConfirmComposition");
      composition.disabled = selectedIds.size < 2;
      composition.addEventListener("click", confirm("same-composition"));
      actions.append(identical, recording, orchestra, composition);
      if (confirmedGroup) {
        const withdraw = document.createElement("button");
        withdraw.textContent = t("audioSimilarityWithdraw");
        withdraw.addEventListener("click", async () => {
          if (!(await showConfirmModal(
            t("audioSimilarityWithdrawConfirm"), t("audioSimilarityApply"),
          ))) return;
          await window.tanda?.withdrawConfirmedAudioSimilarityGroup(
            confirmedGroup.confirmed.id,
          );
          similarityGroupSelections.delete(group.id);
          similarityGroupMasterSelections.delete(group.id);
          await loadAudioSimilarityReport();
          renderAllLists();
        });
        actions.appendChild(withdraw);
      }
      const reject = document.createElement("button");
      reject.dataset.similarityReject = "selected";
      const updateReject = () => {
        const selected = [...selectedIds!];
        const edge = selected.length === 2
          ? group.edges.find((candidate) => selected.includes(candidate.leftTrackId)
            && selected.includes(candidate.rightTrackId)) : undefined;
        const left = edge && group.members.find((member) => member.trackId === edge.leftTrackId);
        const right = edge && group.members.find((member) => member.trackId === edge.rightTrackId);
        reject.disabled = !edge;
        reject.textContent = edge?.decision === "rejected"
          ? t("audioSimilarityRestorePair", { left: left?.title ?? "", right: right?.title ?? "" })
          : t("audioSimilarityRejectNamedPair");
      };
      reject.addEventListener("click", async () => {
        const selected = [...selectedIds!];
        const edge = group.edges.find((candidate) => selected.includes(candidate.leftTrackId)
          && selected.includes(candidate.rightTrackId));
        if (!edge) return;
        const left = group.members.find((member) => member.trackId === edge.leftTrackId);
        const right = group.members.find((member) => member.trackId === edge.rightTrackId);
        if (edge.decision === "rejected") {
          await window.tanda?.reconsiderAudioSimilarityPair(edge.leftTrackId, edge.rightTrackId);
        } else {
          if (!(await showConfirmModal(t("audioSimilarityRejectConfirm", {
            left: left?.title ?? "", right: right?.title ?? "",
          }), t("audioSimilarityApply")))) return;
          await window.tanda?.rejectAudioSimilarityPair(edge.leftTrackId, edge.rightTrackId);
        }
        await loadAudioSimilarityReport();
        renderAllLists();
      });
      reject.addEventListener("similarity-selection-change", updateReject);
      actions.appendChild(reject);
      updateReject();
      card.appendChild(actions);
      const body = document.createElement("div");
      body.className = "audio-similarity-group-body";
      Array.from(card.children).slice(1).forEach((child) => body.appendChild(child));
      body.hidden = collapsed;
      card.appendChild(body);
      collapse.addEventListener("click", () => {
        const nextCollapsed = !body.hidden;
        body.hidden = nextCollapsed;
        collapse.textContent = nextCollapsed ? "▸" : "▾";
        collapse.title = t(nextCollapsed
          ? "audioSimilarityExpandGroup" : "audioSimilarityCollapseGroup");
        collapse.setAttribute("aria-label", collapse.title);
        collapse.setAttribute("aria-expanded", nextCollapsed ? "false" : "true");
        if (nextCollapsed) similarityCollapsedGroupIds.add(group.id);
        else similarityCollapsedGroupIds.delete(group.id);
        saveSimilarityCollapsedGroups();
      });
      const dealtWith = confirmedGroup?.matchedIds.length === group.members.length
        || (group.edges.length > 0 && group.edges.every((edge) => edge.decision !== "pending"));
      if (dealtWith) {
        const decisionTimes = [
          ...matchingConfirmedGroups.map((entry) => entry.confirmed.updatedAt),
          ...group.edges
            .filter((edge) => edge.decision !== "pending")
            .map((edge) => edge.updatedAt),
        ].filter((value): value is string => Boolean(value));
        reviewedCards.push({
          card,
          processedAt: decisionTimes.sort((left, right) => right.localeCompare(left))[0] ?? "",
        });
        reviewedCount += 1;
      } else {
        reviewContent.appendChild(card);
        reviewCount += 1;
      }
    }
    reviewHeading.textContent = t("audioSimilarityToReview", { count: reviewCount });
    audioSimilarityGroups.appendChild(reviewSection);
    if (reviewedCount > 0) {
      reviewedCards
        .sort((left, right) => right.processedAt.localeCompare(left.processedAt))
        .forEach(({ card }) => reviewedContent.appendChild(card));
      reviewedSummary.textContent = t("audioSimilarityReviewed", { count: reviewedCount });
      audioSimilarityGroups.appendChild(reviewedSection);
    }
    if (hiddenTracksCard) audioSimilarityGroups.appendChild(hiddenTracksCard);
  };

  const playSimilarityMember = async (
    groupId: string,
    member: AudioSimilarityMember | AudioSimilarityAuditionTrack,
    position: HTMLElement,
    button: HTMLButtonElement,
  ) => {
    if (similarityPreview && !similarityPreview.paused && similarityActiveGroupId === groupId
        && similarityPreview.dataset.trackId === member.trackId) {
      stopSimilarityPreview();
      button.textContent = t("audioSimilarityPlay");
      return;
    }
    stopSimilarityPreview();
    const requestVersion = similarityPreviewRequestVersion;
    await stopMainForSimilarityAudition();
    if (requestVersion !== similarityPreviewRequestVersion) return;
    if (similarityActiveGroupId !== groupId) similaritySharedPosition = 0;
    similarityActiveGroupId = groupId;
    const audio = new Audio();
    audio.dataset.trackId = member.trackId;
    const requestedOutputDeviceId = resolveOutputDeviceIdForChannel("headphone");
    if (shouldUseAudioDspForOutput("headphone", requestedOutputDeviceId)) {
      ensureAudioDspRuntime(audio);
    }
    const normalization = resolvePlaybackNormalization(member.gainDb, member.loudnessDb);
    setAudioLevel(audio, gainForTrack(normalization.gainDb));
    const outputRouting = await applyOutputDevice(audio, requestedOutputDeviceId);
    if (requestVersion !== similarityPreviewRequestVersion) {
      await releaseAudioDspRuntime(audio);
      return;
    }
    if (requestedOutputDeviceId && !outputRouting.appliedDeviceId) {
      await releaseAudioDspRuntime(audio);
      return;
    }
    audio.src = localAudioUrl(member.fullPath);
    similarityPreview = audio;
    similarityPreviewButton = button;
    similarityPreviewBounds = {
      startMs: member.startOffsetMs,
      effectiveMs: Math.max(0, member.durationMs - member.startOffsetMs - member.endTrimMs),
    };
    audio.addEventListener("loadedmetadata", () => {
      const effectiveMs = Math.max(0, member.durationMs - member.startOffsetMs - member.endTrimMs);
      audio.currentTime = (member.startOffsetMs + effectiveMs * similaritySharedPosition) / 1000;
      void audio.play().catch(() => stopSimilarityPreview());
    }, { once: true });
    audio.addEventListener("seeked", () => {
      const effectiveMs = Math.max(1, member.durationMs - member.startOffsetMs - member.endTrimMs);
      similaritySharedPosition = Math.max(0, Math.min(1,
        (audio.currentTime * 1000 - member.startOffsetMs) / effectiveMs));
      position.textContent = t("audioSimilaritySharedPosition", {
        percent: Math.round(similaritySharedPosition * 100),
      });
      position.closest(".audio-similarity-group")
        ?.querySelectorAll<HTMLCanvasElement>(".audio-similarity-waveform")
        .forEach((candidate) => candidate.dispatchEvent(new Event("similarity-position-change")));
    });
    audio.addEventListener("timeupdate", () => {
      const endMs = Math.max(member.startOffsetMs, member.durationMs - member.endTrimMs);
      if (audio.currentTime * 1000 >= endMs) stopSimilarityPreview();
    });
    audio.addEventListener("ended", stopSimilarityPreview, { once: true });
    audio.addEventListener("error", stopSimilarityPreview, { once: true });
    button.textContent = t("audioSimilarityStop");
    button.setAttribute("aria-pressed", "true");
  };

  const loadAudioSimilarityReport = async () => {
    if (!window.tanda) return;
    similarityReport = await window.tanda.getAudioSimilarityReport();
    ({
      similarityHiddenTrackIds,
      similarityEquivalentTrackIds,
      similarityRelationshipByTrackId,
      similarityPreferredTrackIds,
    } = buildAudioSimilarityIndex(similarityReport));
    invalidateTrackTandaUsage();
    renderAudioSimilarityReport();
    const running = similarityGenerationPending
      || similarityReport.status.state === "running"
      || similarityReport.status.state === "cancelling";
    if (similarityPollTimer !== null) window.clearTimeout(similarityPollTimer);
    similarityPollTimer = running
      ? window.setTimeout(() => { void loadAudioSimilarityReport(); }, 750)
      : null;
  };

  const initAudioSimilarityInteractions = () => {
    openAudioSimilarityBtn?.addEventListener("click", async () => {
      audioSimilarityPage?.classList.add("open");
      audioSimilarityPage?.setAttribute("aria-hidden", "false");
      similarityActiveGroupId = null;
      similaritySharedPosition = 0;
      similarityGroupSelections = new Map();
      similarityGroupMasterSelections = new Map();
      await loadAudioSimilarityReport();
    });
    closeAudioSimilarityBtn?.addEventListener("click", () => {
      stopSimilarityPreview();
      similarityMetadataUndoStacks.clear();
      audioSimilarityPage?.classList.remove("open");
      audioSimilarityPage?.setAttribute("aria-hidden", "true");
      if (similarityPollTimer !== null) window.clearTimeout(similarityPollTimer);
      similarityPollTimer = null;
    });
    audioSimilaritySearch?.addEventListener("input", renderAudioSimilarityReport);
    generateAudioSimilarityBtn?.addEventListener("click", async () => {
      const regenerating = Boolean(similarityReport?.hasCompletedReport);
      if (regenerating && !(await showConfirmModal(
        t("audioSimilarityRegenerateConfirm"), t("audioSimilarityTitle"),
      ))) return;
      similarityGenerationCompleted = false;
      similarityGenerationPending = true;
      renderAudioSimilarityReport();
      const generation = window.tanda!.generateAudioSimilarityReport({ fullRebuild: false });
      await loadAudioSimilarityReport();
      try {
        const result = await generation;
        similarityGenerationCompleted = result.state === "completed";
      } catch (error) {
        if (audioSimilarityStatus) {
          audioSimilarityStatus.textContent = t("audioSimilarityFailed", {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        similarityGenerationPending = false;
        await loadAudioSimilarityReport();
      }
    });
    cancelAudioSimilarityBtn?.addEventListener("click", async () => {
      similarityGenerationCompleted = false;
      await window.tanda!.cancelAudioSimilarityAnalysis();
      await loadAudioSimilarityReport();
    });
  };

  return {
    get similarityEquivalentTrackIds() { return similarityEquivalentTrackIds; },
    get similarityHiddenTrackIds() { return similarityHiddenTrackIds; },
    get similarityRelationshipByTrackId() { return similarityRelationshipByTrackId; },
    openAudioSimilarityOverlay,
    get similarityPreferredTrackIds() { return similarityPreferredTrackIds; },
    initAudioSimilarityInteractions,
    loadAudioSimilarityReport,
    refreshOpenSimilarityMetadataOverlay,
  };
};
