import { describe, expect, it } from "vitest";
import {
  buildSystemBackupFolderName,
  isPathWithin,
  isValidSystemBackupManifest,
} from "../app/src/main/system-transfer";

describe("system transfer helpers", () => {
  it("builds a stable backup folder name from an ISO timestamp", () => {
    expect(buildSystemBackupFolderName("2026-03-23T10:11:12.345Z")).toBe(
      "tanda-forge-backup-2026-03-23t10-11-12-345z",
    );
  });

  it("detects nested paths correctly", () => {
    expect(isPathWithin("/tmp/data", "/tmp/data/backups/export")).toBe(true);
    expect(isPathWithin("/tmp/data", "/tmp/other/export")).toBe(false);
  });

  it("validates backup manifests", () => {
    expect(
      isValidSystemBackupManifest({
        format: "tanda-forge-system-backup",
        version: 1,
        createdAt: "2026-03-23T10:11:12.345Z",
        appVersion: "0.3.0",
      }),
    ).toBe(true);
    expect(
      isValidSystemBackupManifest({
        format: "wrong",
        version: 1,
        createdAt: "2026-03-23T10:11:12.345Z",
        appVersion: "0.3.0",
      }),
    ).toBe(false);
  });
});
