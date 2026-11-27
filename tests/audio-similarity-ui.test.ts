import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const renderer = fs.readFileSync(path.join(process.cwd(), "app/src/renderer/renderer.ts"), "utf8");
const similarity = fs.readFileSync(path.join(process.cwd(), "app/src/renderer/controllers/audio-similarity-controller.ts"), "utf8");
const styles = fs.readFileSync(path.join(process.cwd(), "app/src/renderer/styles.css"), "utf8");
const html = fs.readFileSync(path.join(process.cwd(), "app/src/renderer/index.html"), "utf8");

describe("audio similarity report UI", () => {
  it("does not load or render the report until its Setup button is clicked", () => {
    expect(renderer).not.toContain(
      "applyTranslations();\n  await loadAudioSimilarityReport();",
    );
    const openHandler = similarity.slice(
      similarity.indexOf('openAudioSimilarityBtn?.addEventListener("click"'),
      similarity.indexOf('closeAudioSimilarityBtn?.addEventListener("click"'),
    );
    expect(openHandler).toContain('audioSimilarityPage?.classList.add("open")');
    expect(openHandler).toContain("await loadAudioSimilarityReport()");
  });

  it("places report access in post-setup maintenance after metadata refresh", () => {
    const metadata = html.indexOf('id="refresh-stored-metadata-result"');
    const similarity = html.indexOf('id="open-audio-similarity"');
    const caches = html.indexOf('id="derived-caches-section"');
    expect(metadata).toBeGreaterThan(-1);
    expect(similarity).toBeGreaterThan(metadata);
    expect(caches).toBeGreaterThan(similarity);
  });

  it("starts incremental regeneration immediately and keeps polling past a stale report snapshot", () => {
    expect(similarity).toContain("let similarityGenerationPending = false");
    expect(similarity).toContain("const running = similarityGenerationPending");
    expect(similarity).toContain("similarityGenerationPending = true");
    expect(similarity).toContain("generateAudioSimilarityReport({ fullRebuild: false })");
    expect(similarity).toContain("similarityGenerationPending = false");
    expect(similarity).toContain('report.hasCompletedReport ? "audioSimilarityRegenerate"');
    expect(similarity).toContain("Boolean(similarityReport?.hasCompletedReport)");
    expect(similarity).toContain('t("audioSimilarityComparing", { total: report.status.totalTracks })');
    expect(similarity).toContain('t("audioSimilarityComparingProgress"');
    expect(similarity).toContain("report.status.comparisonPairsProcessed");
    expect(similarity).toContain('t("audioSimilarityGenerationComplete")');
    expect(similarity).toContain('similarityGenerationCompleted = result.state === "completed"');
  });

  it("uses member match checkboxes and lazy metadata/tanda overlays", () => {
    expect(similarity).toContain('selected.type = "checkbox"');
    expect(similarity).toContain("audioSimilarityIncludeMatch");
    expect(similarity).toContain("metadataButton.addEventListener");
    expect(similarity).toContain("tandasButton.addEventListener");
    expect(similarity).toContain("openAudioSimilarityOverlay");
    expect(renderer).not.toContain('input[data-similarity-usage="true"]');
  });

  it("persists collapsed groups and marks confirmed candidate cards", () => {
    expect(similarity).toContain("AUDIO_SIMILARITY_COLLAPSED_KEY");
    expect(similarity).toContain("saveSimilarityCollapsedGroups");
    expect(similarity).toContain("audioSimilarityConfirmedMatch");
    expect(similarity).toContain("audioSimilarityMatchedCount");
    expect(styles).toContain(".audio-similarity-confirmed-tag");
    expect(styles).toContain(".group-color-5");
    expect(similarity).toContain("audio-similarity-title-summary");
    expect(similarity).toContain('distinctTitles.join(" / ")');
  });

  it("uses collapsible unresolved and newest-first reviewed panels", () => {
    expect(similarity).toContain('const reviewSection = document.createElement("details")');
    expect(similarity).toContain("reviewSection.open = true");
    expect(similarity).toContain('reviewedSection.className = "audio-similarity-reviewed-section"');
    expect(renderer).not.toContain("reviewedSection.open = true");
    expect(similarity).toContain('group.edges.every((edge) => edge.decision !== "pending")');
    expect(similarity).toContain('t("audioSimilarityToReview", { count: reviewCount })');
    expect(similarity).toContain('t("audioSimilarityReviewed", { count: reviewedCount })');
    expect(similarity).toContain("right.processedAt.localeCompare(left.processedAt)");
    expect(similarity).toContain("confirmedGroup.updatedAt");
    expect(similarity).toContain("edge.updatedAt");
    expect(styles).toContain(".audio-similarity-review-section > summary");
    expect(styles).toContain(".audio-similarity-reviewed-section > summary");
  });

  it("uses radio choices for each affected-tanda replacement position", () => {
    expect(similarity).toContain('selection.type = "radio"');
    expect(similarity).toContain("audioSimilarityReplacementPosition");
    expect(similarity).toContain("audio-similarity-replacement-choices");
  });

  it("uses the normal headphone path and an Apply/Cancel radio table for tanda assignment", () => {
    expect(renderer).toContain("audio-similarity-version-table");
    expect(renderer).toContain("appendSimilarityVersionNumber(row, index)");
    expect(renderer).toContain("previewSearchTrackOnHeadphones");
    expect(renderer).toContain('similarityRelationshipByTrackId.get(track.id) !== "same-recording"');
    expect(renderer).toContain("const headphone = buildHeadphoneButton(candidate.id)");
    expect(renderer).toContain('"headphone", candidate.full_path, candidate.id');
    expect(similarity).toContain("selection.type = \"radio\"");
    expect(styles).toContain(".audio-similarity-picker-footer");
  });

  it("renders cached comparison waveforms that control the shared audition position", () => {
    expect(similarity).toContain("createSimilarityWaveform");
    expect(similarity).toContain('canvas.className = "audio-similarity-waveform"');
    expect(similarity).toContain("window.tanda?.getWaveform(member.trackId)");
    expect(similarity).toContain("similaritySharedPosition = Math.max(0, Math.min(1, ratio))");
    expect(similarity).toContain('event.key !== "ArrowLeft" && event.key !== "ArrowRight"');
    expect(styles).toContain(".audio-similarity-waveform");
    expect(similarity).toContain('effectiveDuration.className = "audio-similarity-effective-duration"');
    expect(similarity).toContain("member.durationMs - member.startOffsetMs - member.endTrimMs");
    expect(similarity).toContain('`${t("colDuration")}: ${formatTime(');
    expect(styles).toContain(".audio-similarity-effective-duration");
  });

  it("reopens metadata from the refreshed report after copying values", () => {
    expect(similarity).toContain('metadataButton.dataset.action = "show-similarity-metadata"');
    expect(similarity).toContain('[data-action="show-similarity-metadata"]');
  });

  it("keeps detail actions compact and summarizes relevant metadata differences", () => {
    expect(similarity).toContain("audio-similarity-detail-actions");
    expect(similarity).toContain("audioSimilarityMetadataDiffers");
    expect(similarity).toContain('{ label: t("audioSimilarityMetaSinger"), field: "singer" }');
    expect(styles).toContain(".audio-similarity-detail-actions > button { width: auto");
  });

  it("distinguishes DJ-confirmed identical versions, alternate recordings, orchestra versions, and compositions", () => {
    expect(similarity).toContain('orchestra.addEventListener("click", confirm("same-orchestra"))');
    expect(similarity).toContain('identical.addEventListener("click", confirm("identical"))');
    expect(similarity).toContain("similarityPreferredTrackIds");
    expect(renderer).toContain('similarityRelationshipByTrackId.get(track.id) === "identical"');
    expect(similarity).toContain("chooseAudioSimilarityMaster");
    expect(similarity).toContain("audioSimilarityChooseMasterHelp");
    expect(similarity).toContain("similarityRelationshipByTrackId");
  });

  it("shows album and path read-only while omitting measured fields", () => {
    expect(similarity).toContain('{ label: t("audioSimilarityMetaAlbum"), field: "album" }');
    expect(renderer).not.toContain('field: "album", editable: "album"');
    expect(similarity).toContain('{ label: t("audioSimilarityMetaPath"), field: "fullPath" }');
    expect(renderer).not.toContain('{ label: t("audioSimilarityMetaDuration"), field: "durationMs" }');
    expect(renderer).not.toContain('{ label: t("audioSimilarityMetaGain"), field: "gainDb" }');
  });

  it("keeps confirmation dialogs above the full-page report", () => {
    expect(styles).toMatch(/\.confirm-modal[\s\S]*?z-index:\s*140/);
    expect(styles).toMatch(/\.audio-similarity-page[\s\S]*?z-index:\s*90/);
    expect(similarity).toContain('t("audioSimilarityApply")');
  });

  it("places hidden tracks after candidate groups", () => {
    expect(similarity).toContain("let hiddenTracksCard: HTMLElement | null = null");
    expect(similarity.indexOf("if (hiddenTracksCard) audioSimilarityGroups.appendChild(hiddenTracksCard)"))
      .toBeGreaterThan(similarity.indexOf("for (const [groupIndex, group] of visibleGroups.entries())"));
  });

  it("stops main output before every similarity audition path", () => {
    expect(renderer).toContain("const stopMainForSimilarityAudition = async () =>");
    expect(renderer.match(/await stopMainForSimilarityAudition\(\);/g)).toHaveLength(1);
    expect(similarity.match(/await stopMainForSimilarityAudition\(\);/g)).toHaveLength(1);
  });

  it("normalizes similarity auditions and uses the configured headphone output", () => {
    expect(similarity).toContain(
      "resolvePlaybackNormalization(member.gainDb, member.loudnessDb)",
    );
    expect(similarity).toContain('resolveOutputDeviceIdForChannel("headphone")');
    expect(similarity).toContain("setAudioLevel(audio, gainForTrack(normalization.gainDb))");
    expect(similarity).toContain("audio.currentTime * 1000 >= endMs");
    expect(similarity).toContain("requestVersion !== similarityPreviewRequestVersion");
  });

  it("uses compact localized rejection labels and translated relationships", () => {
    expect(similarity).toContain('t("audioSimilarityRejectNamedPair")');
    expect(similarity).not.toContain('t("audioSimilarityRejectNamedPair",');
    expect(similarity).toContain("translateAudioSimilarityRelationship(confirmedGroup.relationshipType)");
    expect(similarity).toContain('reject.dataset.similarityReject = "selected"');
  });

  it("keeps metadata undo inside the comparison window as a session stack", () => {
    expect(similarity).toContain("similarityMetadataUndoStacks");
    expect(similarity).toContain("undoStack.push(result.changes)");
    expect(similarity).not.toContain("audioSimilarityUndoAvailable");
  });

  it("opens the normal track editor from each metadata comparison column", () => {
    expect(similarity).toContain('editTrack.className = "audio-similarity-edit-track"');
    expect(similarity).toContain("await openTrackEditor(member.trackId)");
    expect(similarity).toContain("metadataOverlay.dataset.similarityMetadataGroupId = group.id");
    expect(renderer).toContain("refreshOpenSimilarityMetadataOverlay()");
    expect(styles).toContain("body:has(.audio-similarity-page.open) #track-editor.open");
  });

  it("preserves a provisional master election while metadata refreshes the report", () => {
    expect(similarity).toContain("let similarityGroupMasterSelections = new Map<string, string>()");
    expect(similarity).toContain("similarityGroupMasterSelections.get(group.id)");
    expect(similarity).toContain("similarityGroupMasterSelections.set(group.id, member.trackId)");
    expect(similarity).toContain("similarityGroupMasterSelections.delete(group.id)");
    expect(similarity).toContain("similarityGroupMasterSelections = new Map()");
  });

  it("uses relaxed spacing in affected-tanda and metadata controls", () => {
    expect(styles).toContain(".audio-similarity-tanda-comparison { display: grid; gap: 0.8rem");
    expect(styles).toContain(".audio-similarity-tanda-tracks { display: grid; gap: 0.55rem");
    expect(styles).toContain(".audio-similarity-lazy-dialog th > span { display: block; }");
    expect(styles).toContain(".audio-similarity-edit-track { width: auto; margin-top: 0.6rem");
  });

  it("keeps large affected-tanda lists inside a bounded scrolling dialog", () => {
    expect(styles).toMatch(/\.audio-similarity-lazy-dialog \{[\s\S]*?max-height:\s*88vh; overflow:\s*hidden/);
    expect(styles).toContain(".audio-similarity-lazy-dialog > div { min-height: 0; overflow: auto;");
  });

  it("renders press-and-hold duplicate focus with the scheduled filter layout", () => {
    expect(renderer).toContain("let playlistDuplicateFocusTrackIds: Set<string> | null = null");
    expect(renderer).toContain("const hasFilteredLayout = hasFilter || hasDuplicateFocus");
    expect(renderer).toContain('firstMatch.scrollIntoView({ block: "center", behavior: "smooth" })');
    expect(renderer).toContain('playlistDuplicateFocusStatus?.classList.remove("hidden")');
    expect(renderer).toContain('playlistDuplicateFocusClear?.addEventListener("click", (event) =>');
    expect(similarity).toContain("event.stopPropagation()");
    expect(renderer).toContain('document.addEventListener("pointerup", cancelPlaylistDuplicateFocusTimer)');
    expect(html).toContain('data-i18n="playlistDuplicateFocusClear"');
    expect(styles).toContain(".playlist-duplicate-focus-status");
    expect(styles).toContain("grid-template-rows: auto minmax(0, 1fr) auto");
    expect(styles).toMatch(/\.playlist-duplicate-focus-status \{[\s\S]*?z-index:\s*5/);
  });

  it("does not draw a progress marker over playlist track titles", () => {
    expect(renderer).not.toContain("playlist-playback-position");
    expect(styles).not.toContain("playlist-playback-position");
    expect(styles).not.toContain("--playlist-playback-position");
  });

  it("keeps playlist stop controls in a readable non-scrolling footer", () => {
    expect(html).toContain('<div class="list-body playlist-panel-body">');
    expect(html).toMatch(
      /<div class="playlist-footer-controls">[\s\S]*?id="playlist-last-tanda"[\s\S]*?id="playlist-performance-stop"/,
    );
    expect(styles).toMatch(/\.playlist-panel-body \{[\s\S]*?overflow:\s*hidden/);
    expect(styles).toMatch(/\.playlist-footer-controls \{[\s\S]*?flex:\s*0 0 auto/);
    expect(styles).toMatch(/\.playlist-last-toggle \{[\s\S]*?color:\s*var\(--text\)/);
  });

  it("floats the opaque tanda editor above the playlist footer", () => {
    expect(styles).toMatch(
      /#playlist-tab\.tab-panel\.active \{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\) auto/,
    );
    expect(styles).toMatch(
      /\.playlist-tanda-editor \{[\s\S]*?grid-column:\s*1[\s\S]*?grid-row:\s*2[\s\S]*?align-self:\s*end[\s\S]*?max-height:\s*100%[\s\S]*?overflow-y:\s*auto[\s\S]*?background:\s*var\(--panel-solid\)/,
    );
    expect(styles).toMatch(
      /\.playlist-footer-controls \{[\s\S]*?grid-row:\s*3[\s\S]*?background:\s*var\(--panel-solid\)/,
    );
  });

  it("resolves confirmed equivalents when a tanda duplicate jumps to the playlist", () => {
    expect(renderer).toContain("const canonicalDuplicateTrackId = (trackId: string) =>");
    expect(renderer).toContain("const wantedKey = buildCanonicalTandaKey(Array.from(wanted))");
    expect(renderer).toContain("wantedCanonicalIds.has(canonicalDuplicateTrackId(trackId))");
    expect(renderer).toContain("return { index, trackIds: matchingTrackIds }");
    expect(renderer).toContain("focusPlaylistIndex(location.index, location.trackIds, true)");
    expect(renderer).toContain('matchedTracks.forEach((track) => track.classList.add("track-jump-highlight"))');
  });

  it("keeps duplicate status dots inside a consistent icon box", () => {
    expect(styles).toMatch(/\.duplicate-icon \.duplicate-dot[\s\S]*?box-sizing:\s*border-box/);
  });

  it("offsets the exact-track highlight from its content", () => {
    expect(styles).toMatch(/\.tanda-detail-line\.track-jump-highlight[\s\S]*?outline-offset:\s*3px/);
    expect(styles).toMatch(/\.tanda-detail-line\.track-jump-highlight[\s\S]*?margin-inline:\s*0\.25rem/);
  });

  it("styles similarity overlays with application theme variables", () => {
    expect(styles).toMatch(/\.audio-similarity-lazy-dialog[\s\S]*?background:\s*var\(--panel-solid\)/);
    expect(styles).toMatch(/\.audio-similarity-lazy-dialog[\s\S]*?var\(--accent\)/);
    expect(styles).toMatch(/\.audio-similarity-lazy-dialog[\s\S]*?color:\s*var\(--text\)/);
  });

  it("offers edit and Search Similar menus for tracks in tanda usage overlays", () => {
    expect(similarity).toContain('context.dataset.trackId = contextTrack.trackId');
    expect(similarity).toContain('"audio-similarity-edit-context-track"');
    expect(similarity).toContain('"audio-similarity-search-context-track"');
    expect(similarity).toContain('if (track) runSearchForTrack(track)');
  });
});
