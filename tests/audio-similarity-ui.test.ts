import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const renderer = fs.readFileSync(path.join(process.cwd(), "app/src/renderer/renderer.ts"), "utf8");
const styles = fs.readFileSync(path.join(process.cwd(), "app/src/renderer/styles.css"), "utf8");
const html = fs.readFileSync(path.join(process.cwd(), "app/src/renderer/index.html"), "utf8");

describe("audio similarity report UI", () => {
  it("places report access in post-setup maintenance after metadata refresh", () => {
    const metadata = html.indexOf('id="refresh-stored-metadata-result"');
    const similarity = html.indexOf('id="open-audio-similarity"');
    const caches = html.indexOf('id="derived-caches-section"');
    expect(metadata).toBeGreaterThan(-1);
    expect(similarity).toBeGreaterThan(metadata);
    expect(caches).toBeGreaterThan(similarity);
  });

  it("uses member match checkboxes and lazy metadata/tanda overlays", () => {
    expect(renderer).toContain('selected.type = "checkbox"');
    expect(renderer).toContain("audioSimilarityIncludeMatch");
    expect(renderer).toContain("metadataButton.addEventListener");
    expect(renderer).toContain("tandasButton.addEventListener");
    expect(renderer).toContain("openAudioSimilarityOverlay");
    expect(renderer).not.toContain('input[data-similarity-usage="true"]');
  });

  it("persists collapsed groups and marks confirmed candidate cards", () => {
    expect(renderer).toContain("AUDIO_SIMILARITY_COLLAPSED_KEY");
    expect(renderer).toContain("saveSimilarityCollapsedGroups");
    expect(renderer).toContain("audioSimilarityConfirmedMatch");
    expect(renderer).toContain("audioSimilarityMatchedCount");
    expect(styles).toContain(".audio-similarity-confirmed-tag");
    expect(styles).toContain(".group-color-5");
    expect(renderer).toContain("audio-similarity-title-summary");
    expect(renderer).toContain('distinctTitles.join(" / ")');
  });

  it("separates unresolved groups from a closed reviewed panel", () => {
    expect(renderer).toContain('reviewedSection.className = "audio-similarity-reviewed-section"');
    expect(renderer).not.toContain("reviewedSection.open = true");
    expect(renderer).toContain('group.edges.every((edge) => edge.decision !== "pending")');
    expect(renderer).toContain('t("audioSimilarityToReview", { count: reviewCount })');
    expect(renderer).toContain('t("audioSimilarityReviewed", { count: reviewedCount })');
    expect(styles).toContain(".audio-similarity-reviewed-section > summary");
  });

  it("uses radio choices for each affected-tanda replacement position", () => {
    expect(renderer).toContain('selection.type = "radio"');
    expect(renderer).toContain("audioSimilarityReplacementPosition");
    expect(renderer).toContain("audio-similarity-replacement-choices");
  });

  it("uses the normal headphone path and an Apply/Cancel radio table for tanda assignment", () => {
    expect(renderer).toContain("audio-similarity-version-table");
    expect(renderer).toContain("const headphone = buildHeadphoneButton(candidate.id)");
    expect(renderer).toContain('"headphone", candidate.full_path, candidate.id');
    expect(renderer).toContain("selection.type = \"radio\"");
    expect(styles).toContain(".audio-similarity-picker-footer");
  });

  it("renders cached comparison waveforms that control the shared audition position", () => {
    expect(renderer).toContain("createSimilarityWaveform");
    expect(renderer).toContain('canvas.className = "audio-similarity-waveform"');
    expect(renderer).toContain("window.tanda?.getWaveform(member.trackId)");
    expect(renderer).toContain("similaritySharedPosition = Math.max(0, Math.min(1, ratio))");
    expect(renderer).toContain('event.key !== "ArrowLeft" && event.key !== "ArrowRight"');
    expect(styles).toContain(".audio-similarity-waveform");
  });

  it("reopens metadata from the refreshed report after copying values", () => {
    expect(renderer).toContain('metadataButton.dataset.action = "show-similarity-metadata"');
    expect(renderer).toContain('[data-action="show-similarity-metadata"]');
  });

  it("keeps detail actions compact and summarizes relevant metadata differences", () => {
    expect(renderer).toContain("audio-similarity-detail-actions");
    expect(renderer).toContain("audioSimilarityMetadataDiffers");
    expect(renderer).toContain('{ label: t("audioSimilarityMetaSinger"), field: "singer" }');
    expect(styles).toContain(".audio-similarity-detail-actions > button { width: auto");
  });

  it("distinguishes DJ-confirmed identical versions, alternate recordings, orchestra versions, and compositions", () => {
    expect(renderer).toContain('orchestra.addEventListener("click", confirm("same-orchestra"))');
    expect(renderer).toContain('identical.addEventListener("click", confirm("identical"))');
    expect(renderer).toContain("similarityPreferredTrackIds");
    expect(renderer).toContain('similarityRelationshipByTrackId.get(track.id) === "identical"');
    expect(renderer).toContain("chooseAudioSimilarityMaster");
    expect(renderer).toContain("audioSimilarityChooseMasterHelp");
    expect(renderer).toContain("similarityRelationshipByTrackId");
  });

  it("shows album and path read-only while omitting measured fields", () => {
    expect(renderer).toContain('{ label: t("audioSimilarityMetaAlbum"), field: "album" }');
    expect(renderer).toContain('{ label: t("audioSimilarityMetaPath"), field: "fullPath" }');
    expect(renderer).not.toContain('{ label: t("audioSimilarityMetaDuration"), field: "durationMs" }');
    expect(renderer).not.toContain('{ label: t("audioSimilarityMetaGain"), field: "gainDb" }');
  });

  it("keeps confirmation dialogs above the full-page report", () => {
    expect(styles).toMatch(/\.confirm-modal[\s\S]*?z-index:\s*140/);
    expect(styles).toMatch(/\.audio-similarity-page[\s\S]*?z-index:\s*90/);
    expect(renderer).toContain('t("audioSimilarityApply")');
  });

  it("places hidden tracks after candidate groups", () => {
    expect(renderer).toContain("let hiddenTracksCard: HTMLElement | null = null");
    expect(renderer.indexOf("if (hiddenTracksCard) audioSimilarityGroups.appendChild(hiddenTracksCard)"))
      .toBeGreaterThan(renderer.indexOf("for (const [groupIndex, group] of visibleGroups.entries())"));
  });

  it("stops main output before every similarity audition path", () => {
    expect(renderer).toContain("const stopMainForSimilarityAudition = async () =>");
    expect(renderer.match(/await stopMainForSimilarityAudition\(\);/g)).toHaveLength(2);
  });

  it("uses compact localized rejection labels and translated relationships", () => {
    expect(renderer).toContain('t("audioSimilarityRejectNamedPair")');
    expect(renderer).not.toContain('t("audioSimilarityRejectNamedPair",');
    expect(renderer).toContain("translateAudioSimilarityRelationship(confirmedGroup.relationshipType)");
  });

  it("opens the normal track editor from each metadata comparison column", () => {
    expect(renderer).toContain('editTrack.className = "audio-similarity-edit-track"');
    expect(renderer).toContain("await openTrackEditor(member.trackId)");
    expect(renderer).toContain("metadataOverlay.dataset.similarityMetadataGroupId = group.id");
    expect(renderer).toContain("refreshOpenSimilarityMetadataOverlay()");
    expect(styles).toContain("body:has(.audio-similarity-page.open) #track-editor.open");
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

  it("keeps press-and-hold duplicate focus active and offers an explicit clear action", () => {
    expect(renderer).toContain("const matchingRows: Array<{ row: HTMLElement; trackId: string | null }> = []");
    expect(renderer).toContain('target.scrollIntoView({ block: "center", behavior: "smooth" })');
    expect(renderer).toContain('if (trackId && !row.classList.contains("expanded")) toggleTandaRow(row)');
    expect(renderer).toContain('playlistDuplicateFocusStatus?.classList.remove("hidden")');
    expect(renderer).toContain('playlistDuplicateFocusClear?.addEventListener("click", (event) =>');
    expect(renderer).toContain("event.stopPropagation()");
    expect(renderer).toContain('document.addEventListener("pointerup", cancelPlaylistDuplicateFocusTimer)');
    expect(html).toContain('data-i18n="playlistDuplicateFocusClear"');
    expect(styles).toContain(".playlist-duplicate-focus-status");
    expect(styles).toContain("grid-template-rows: auto minmax(0, 1fr) auto auto auto");
    expect(styles).toMatch(/\.playlist-duplicate-focus-status \{[\s\S]*?z-index:\s*5/);
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
});
