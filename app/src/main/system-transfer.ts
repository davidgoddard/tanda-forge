import fs from "fs";
import path from "path";

export const SYSTEM_BACKUP_MANIFEST = "tanda-forge-system-backup.json";
export const SYSTEM_BACKUP_VERSION = 1;

export type SystemBackupManifest = {
  format: "tanda-forge-system-backup";
  version: number;
  createdAt: string;
  appVersion: string;
};

const sanitizePathSegment = (value: string) =>
  value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");

const MANAGED_ROOT_ENTRIES = new Set([
  "tanda-player.db",
  "tanda-player.db-shm",
  "tanda-player.db-wal",
  "waveforms",
  "compressed-audio-cache",
  "playable-audio-cache",
  "renderer-errors.log",
  "playback-diagnostics.log",
]);

const shouldTransferManagedEntry = (entryName: string) =>
  MANAGED_ROOT_ENTRIES.has(entryName);

export const buildSystemBackupFolderName = (createdAt: string) => {
  const safe = sanitizePathSegment(createdAt.replace(/[:.]/g, "-").toLowerCase());
  return `tanda-forge-backup-${safe || "export"}`;
};

export const isPathWithin = (parentPath: string, childPath: string) => {
  const parent = path.resolve(parentPath);
  const child = path.resolve(childPath);
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
};

export const validateSystemBackupExportRoot = (sourceRoot: string, exportRoot: string) => {
  const source = path.resolve(sourceRoot);
  const target = path.resolve(exportRoot);
  if (target === source || isPathWithin(source, target)) {
    return "Backup folder must be outside the active data directory";
  }
  return null;
};

export const isValidSystemBackupManifest = (
  value: unknown,
): value is SystemBackupManifest => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const manifest = value as Partial<SystemBackupManifest>;
  return (
    manifest.format === "tanda-forge-system-backup" &&
    manifest.version === SYSTEM_BACKUP_VERSION &&
    typeof manifest.createdAt === "string" &&
    manifest.createdAt.length > 0 &&
    typeof manifest.appVersion === "string" &&
    manifest.appVersion.length > 0
  );
};

export const writeSystemBackup = (
  sourceRoot: string,
  exportRoot: string,
  manifest: SystemBackupManifest,
) => {
  const validationError = validateSystemBackupExportRoot(sourceRoot, exportRoot);
  if (validationError) {
    throw new Error(validationError);
  }
  fs.mkdirSync(exportRoot, { recursive: true });
  const entries = fs.readdirSync(sourceRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!shouldTransferManagedEntry(entry.name)) {
      continue;
    }
    const sourcePath = path.join(sourceRoot, entry.name);
    const targetPath = path.join(exportRoot, entry.name);
    fs.cpSync(sourcePath, targetPath, { recursive: true, force: true });
  }
  fs.writeFileSync(
    path.join(exportRoot, SYSTEM_BACKUP_MANIFEST),
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );
};

export const writeSystemBackupAsync = async (
  sourceRoot: string,
  exportRoot: string,
  manifest: SystemBackupManifest,
  onProgress?: (progress: { completed: number; total: number; entryName: string }) => void,
) => {
  const validationError = validateSystemBackupExportRoot(sourceRoot, exportRoot);
  if (validationError) {
    throw new Error(validationError);
  }
  await fs.promises.mkdir(exportRoot, { recursive: true });
  const entries = await fs.promises.readdir(sourceRoot, { withFileTypes: true });
  const managedEntries = entries.filter((entry) => shouldTransferManagedEntry(entry.name));
  let completed = 0;
  for (const entry of managedEntries) {
    const sourcePath = path.join(sourceRoot, entry.name);
    const targetPath = path.join(exportRoot, entry.name);
    await fs.promises.cp(sourcePath, targetPath, { recursive: true, force: true });
    completed += 1;
    onProgress?.({
      completed,
      total: managedEntries.length,
      entryName: entry.name,
    });
  }
  await fs.promises.writeFile(
    path.join(exportRoot, SYSTEM_BACKUP_MANIFEST),
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );
};

export const readSystemBackupManifest = (backupRoot: string) => {
  const manifestPath = path.join(backupRoot, SYSTEM_BACKUP_MANIFEST);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as unknown;
    return isValidSystemBackupManifest(raw) ? raw : null;
  } catch {
    return null;
  }
};

export const restoreSystemBackup = (backupRoot: string, targetRoot: string) => {
  const entries = fs.existsSync(targetRoot)
    ? fs.readdirSync(targetRoot, { withFileTypes: true })
    : [];
  for (const entry of entries) {
    if (!shouldTransferManagedEntry(entry.name)) {
      continue;
    }
    fs.rmSync(path.join(targetRoot, entry.name), { recursive: true, force: true });
  }
  fs.mkdirSync(targetRoot, { recursive: true });
  const backupEntries = fs.readdirSync(backupRoot, { withFileTypes: true });
  for (const entry of backupEntries) {
    if (!shouldTransferManagedEntry(entry.name)) {
      continue;
    }
    const sourcePath = path.join(backupRoot, entry.name);
    const targetPath = path.join(targetRoot, entry.name);
    fs.cpSync(sourcePath, targetPath, { recursive: true, force: true });
  }
};
