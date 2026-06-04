import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildSystemBackupFolderName,
  isPathWithin,
  isValidSystemBackupManifest,
  restoreSystemBackup,
  validateSystemBackupExportRoot,
  writeSystemBackup,
  writeSystemBackupAsync,
} from "../app/src/main/system-transfer";

describe("system transfer helpers", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    tempDirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
  });

  const createTempDir = (label: string) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${label}-`));
    tempDirs.push(dir);
    return dir;
  };

  it("builds a stable backup folder name from an ISO timestamp", () => {
    expect(buildSystemBackupFolderName("2026-03-23T10:11:12.345Z")).toBe(
      "tanda-forge-backup-2026-03-23t10-11-12-345z",
    );
  });

  it("detects nested paths correctly", () => {
    expect(isPathWithin("/tmp/data", "/tmp/data/backups/export")).toBe(true);
    expect(isPathWithin("/tmp/data", "/tmp/other/export")).toBe(false);
  });

  it("rejects backup export roots inside the active data directory", () => {
    expect(
      validateSystemBackupExportRoot("/tmp/data", "/tmp/data/backups/export"),
    ).toBe("Backup folder must be outside the active data directory");
    expect(validateSystemBackupExportRoot("/tmp/data", "/tmp/data")).toBe(
      "Backup folder must be outside the active data directory",
    );
    expect(validateSystemBackupExportRoot("/tmp/data", "/tmp/other/export")).toBeNull();
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

  it("exports only managed app data and skips Electron cache directories", () => {
    const sourceRoot = createTempDir("tanda-system-source");
    const exportRoot = path.join(createTempDir("tanda-system-export-parent"), "backup");
    fs.writeFileSync(path.join(sourceRoot, "tanda-player.db"), "db", "utf-8");
    fs.mkdirSync(path.join(sourceRoot, "waveforms"), { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, "waveforms", "track-a.png"), "png", "utf-8");
    fs.mkdirSync(path.join(sourceRoot, "playable-audio-cache"), { recursive: true });
    fs.writeFileSync(
      path.join(sourceRoot, "playable-audio-cache", "track-a.wav"),
      "wav",
      "utf-8",
    );
    fs.mkdirSync(path.join(sourceRoot, "DawnCache"), { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, "DawnCache", "data_0"), "cache", "utf-8");

    writeSystemBackup(sourceRoot, exportRoot, {
      format: "tanda-forge-system-backup",
      version: 1,
      createdAt: "2026-03-23T10:11:12.345Z",
      appVersion: "0.3.0",
    });

    expect(fs.existsSync(path.join(exportRoot, "tanda-player.db"))).toBe(true);
    expect(fs.existsSync(path.join(exportRoot, "waveforms", "track-a.png"))).toBe(true);
    expect(fs.existsSync(path.join(exportRoot, "playable-audio-cache", "track-a.wav"))).toBe(true);
    expect(fs.existsSync(path.join(exportRoot, "DawnCache"))).toBe(false);
  });

  it("exports managed app data asynchronously with progress updates", async () => {
    const sourceRoot = createTempDir("tanda-system-source-async");
    const exportRoot = path.join(createTempDir("tanda-system-export-parent-async"), "backup");
    fs.writeFileSync(path.join(sourceRoot, "tanda-player.db"), "db", "utf-8");
    fs.mkdirSync(path.join(sourceRoot, "playable-audio-cache"), { recursive: true });
    fs.writeFileSync(
      path.join(sourceRoot, "playable-audio-cache", "track-a.wav"),
      "wav",
      "utf-8",
    );
    const progress: string[] = [];

    await writeSystemBackupAsync(
      sourceRoot,
      exportRoot,
      {
        format: "tanda-forge-system-backup",
        version: 1,
        createdAt: "2026-03-23T10:11:12.345Z",
        appVersion: "0.3.0",
      },
      ({ completed, total, entryName }) => {
        progress.push(`${completed}/${total}:${entryName}`);
      },
    );

    expect(fs.existsSync(path.join(exportRoot, "tanda-player.db"))).toBe(true);
    expect(fs.existsSync(path.join(exportRoot, "playable-audio-cache", "track-a.wav"))).toBe(true);
    expect(progress.length).toBe(2);
    expect(progress.some((entry) => entry.endsWith(":tanda-player.db"))).toBe(true);
    expect(progress.some((entry) => entry.endsWith(":playable-audio-cache"))).toBe(true);
  });

  it("rejects synchronous and async export targets nested inside the source root", async () => {
    const sourceRoot = createTempDir("tanda-system-source-guard");
    const exportRoot = path.join(sourceRoot, "backups", "backup");
    fs.writeFileSync(path.join(sourceRoot, "tanda-player.db"), "db", "utf-8");
    const manifest = {
      format: "tanda-forge-system-backup" as const,
      version: 1,
      createdAt: "2026-03-23T10:11:12.345Z",
      appVersion: "0.3.0",
    };

    expect(() => writeSystemBackup(sourceRoot, exportRoot, manifest)).toThrow(
      "Backup folder must be outside the active data directory",
    );
    await expect(writeSystemBackupAsync(sourceRoot, exportRoot, manifest)).rejects.toThrow(
      "Backup folder must be outside the active data directory",
    );
  });

  it("restores only managed app data and leaves runtime cache directories untouched", () => {
    const backupRoot = createTempDir("tanda-system-backup");
    const targetRoot = createTempDir("tanda-system-target");
    fs.writeFileSync(path.join(backupRoot, "tanda-player.db"), "restored-db", "utf-8");
    fs.mkdirSync(path.join(backupRoot, "compressed-audio-cache"), { recursive: true });
    fs.writeFileSync(
      path.join(backupRoot, "compressed-audio-cache", "track-a.wav"),
      "wav",
      "utf-8",
    );
    fs.writeFileSync(path.join(targetRoot, "tanda-player.db"), "old-db", "utf-8");
    fs.mkdirSync(path.join(targetRoot, "DawnCache"), { recursive: true });
    fs.writeFileSync(path.join(targetRoot, "DawnCache", "data_0"), "live-cache", "utf-8");

    restoreSystemBackup(backupRoot, targetRoot);

    expect(fs.readFileSync(path.join(targetRoot, "tanda-player.db"), "utf-8")).toBe(
      "restored-db",
    );
    expect(
      fs.readFileSync(
        path.join(targetRoot, "compressed-audio-cache", "track-a.wav"),
        "utf-8",
      ),
    ).toBe("wav");
    expect(fs.readFileSync(path.join(targetRoot, "DawnCache", "data_0"), "utf-8")).toBe(
      "live-cache",
    );
  });
});
