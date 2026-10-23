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

  it("uses one elected version and lazy metadata/tanda overlays", () => {
    expect(renderer).toContain('selected.type = "radio"');
    expect(renderer).toContain("audioSimilarityElectedVersion");
    expect(renderer).toContain("metadataButton.addEventListener");
    expect(renderer).toContain("tandasButton.addEventListener");
    expect(renderer).toContain("openAudioSimilarityOverlay");
    expect(renderer).not.toContain('input[data-similarity-usage="true"]');
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
});
