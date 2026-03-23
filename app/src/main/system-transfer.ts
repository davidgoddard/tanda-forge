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
  fs.mkdirSync(exportRoot, { recursive: true });
  const entries = fs.readdirSync(sourceRoot, { withFileTypes: true });
  for (const entry of entries) {
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
    fs.rmSync(path.join(targetRoot, entry.name), { recursive: true, force: true });
  }
  fs.mkdirSync(targetRoot, { recursive: true });
  const backupEntries = fs.readdirSync(backupRoot, { withFileTypes: true });
  for (const entry of backupEntries) {
    const sourcePath = path.join(backupRoot, entry.name);
    const targetPath = path.join(targetRoot, entry.name);
    fs.cpSync(sourcePath, targetPath, { recursive: true, force: true });
  }
};
