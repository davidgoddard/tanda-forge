import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";

export type RelocatableRootKind = "music" | "cortina" | "background";
type LibraryRootRecord = { id: string; kind: RelocatableRootKind; path: string; label: string };
type MusicRoot = Omit<LibraryRootRecord, "kind">;

export type RootRelocationResult = {
  ok: boolean;
  destination: string;
  rootsMoved: number;
  tracksMoved: number;
  warnings: string[];
  error?: string;
};

export type RootRelocationProgress = {
  stage: "preparing" | "copying" | "switching" | "cleanup";
  completed: number;
  total: number;
  currentPath: string;
};

type CopyEntry = { source: string; target: string; relativePath: string };
type PlannedRoot = ReturnType<typeof planSelectedRootRelocation>[number];

const collisionSafeRelativePath = (relativePath: string, used: Set<string>) => {
  const parsed = path.parse(relativePath);
  let candidate = relativePath;
  let suffix = 1;
  while (used.has(candidate.toLowerCase())) {
    candidate = path.join(parsed.dir, `${parsed.name}-${suffix}${parsed.ext}`);
    suffix += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
};

const collectSourceFiles = async (
  sourceRoot: string,
  relativeDirectory = "",
  excludedSourcePaths: string[] = [],
): Promise<Array<{ source: string; relativePath: string }>> => {
  const sourceDirectory = path.join(sourceRoot, relativeDirectory);
  const entries = await fs.promises.readdir(sourceDirectory, { withFileTypes: true });
  const files: Array<{ source: string; relativePath: string }> = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    const source = path.join(sourceRoot, relativePath);
    if (excludedSourcePaths.some((excluded) => normalizedPath(source) === normalizedPath(excluded))) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(sourceRoot, relativePath, excludedSourcePaths));
    } else {
      files.push({ source, relativePath });
    }
  }
  return files;
};

export const copyMergedRootFiles = async (
  plan: PlannedRoot[],
  onProgress?: (progress: RootRelocationProgress) => void,
) => {
  onProgress?.({ stage: "preparing", completed: 0, total: 0, currentPath: "" });
  const usedByKind = new Map<RelocatableRootKind, Set<string>>();
  const entries: Array<{
    rootId: string;
    kind: RelocatableRootKind;
    source: string;
    sourceRelativePath: string;
    destinationRelativePath: string;
    target: string;
  }> = [];
  for (const item of plan) {
    const excludedSourcePaths = item.kind === "background"
      ? plan
          .filter((other) => other.id !== item.id && isSameOrInside(other.path, item.path))
          .map((other) => other.path)
      : [];
    const files = await collectSourceFiles(item.path, "", excludedSourcePaths);
    const used = usedByKind.get(item.kind) ?? new Set<string>();
    usedByKind.set(item.kind, used);
    for (const file of files) {
      const destinationRelativePath = collisionSafeRelativePath(file.relativePath, used);
      entries.push({
        rootId: item.id,
        kind: item.kind,
        source: file.source,
        sourceRelativePath: file.relativePath,
        destinationRelativePath,
        target: path.join(item.categoryPath, destinationRelativePath),
      });
    }
  }
  let completed = 0;
  for (const entry of entries) {
    onProgress?.({
      stage: "copying",
      completed,
      total: entries.length,
      currentPath: entry.destinationRelativePath,
    });
    await fs.promises.mkdir(path.dirname(entry.target), { recursive: true });
    await fs.promises.cp(entry.source, entry.target, {
      force: false,
      errorOnExist: true,
      preserveTimestamps: true,
    });
    completed += 1;
    onProgress?.({
      stage: "copying",
      completed,
      total: entries.length,
      currentPath: entry.destinationRelativePath,
    });
  }
  return { entries, usedByKind };
};

const collectCopyEntries = async (
  sourceRoot: string,
  targetRoot: string,
  relativeDirectory = "",
  excludedSourcePaths: string[] = [],
): Promise<CopyEntry[]> => {
  const sourceDirectory = path.join(sourceRoot, relativeDirectory);
  const targetDirectory = path.join(targetRoot, relativeDirectory);
  await fs.promises.mkdir(targetDirectory, { recursive: true });
  const entries = await fs.promises.readdir(sourceDirectory, { withFileTypes: true });
  const files: CopyEntry[] = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    const sourcePath = path.join(sourceRoot, relativePath);
    if (excludedSourcePaths.some((excluded) => normalizedPath(sourcePath) === normalizedPath(excluded))) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...await collectCopyEntries(
        sourceRoot,
        targetRoot,
        relativePath,
        excludedSourcePaths,
      ));
    } else {
      files.push({
        source: path.join(sourceRoot, relativePath),
        target: path.join(targetRoot, relativePath),
        relativePath,
      });
    }
  }
  return files;
};

export const copyMusicRootFiles = async (
  roots: Array<{ source: string; target: string; excludedSourcePaths?: string[] }>,
  onProgress?: (progress: RootRelocationProgress) => void,
) => {
  onProgress?.({ stage: "preparing", completed: 0, total: 0, currentPath: "" });
  const copyEntries: CopyEntry[] = [];
  for (const root of roots) {
    copyEntries.push(...await collectCopyEntries(
      root.source,
      root.target,
      "",
      root.excludedSourcePaths,
    ));
  }
  let completed = 0;
  for (const entry of copyEntries) {
    onProgress?.({
      stage: "copying",
      completed,
      total: copyEntries.length,
      currentPath: entry.relativePath,
    });
    await fs.promises.cp(entry.source, entry.target, {
      force: false,
      errorOnExist: true,
      preserveTimestamps: true,
    });
    completed += 1;
    onProgress?.({
      stage: "copying",
      completed,
      total: copyEntries.length,
      currentPath: entry.relativePath,
    });
  }
  return copyEntries.length;
};

const normalizedPath = (value: string) => path.resolve(value);
const isSameOrInside = (candidate: string, parent: string) => {
  const relative = path.relative(normalizedPath(parent), normalizedPath(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

export const planMusicRootRelocation = (
  roots: MusicRoot[],
  destination: string,
): Array<MusicRoot & { folderName: string; targetPath: string }> => {
  if (roots.length === 0) throw new Error("No music folders are configured.");
  const resolvedDestination = normalizedPath(destination);
  const names = new Set<string>();
  const plan = roots.map((root) => {
    const source = normalizedPath(root.path);
    if (isSameOrInside(resolvedDestination, source) || isSameOrInside(source, resolvedDestination)) {
      throw new Error("The new location must be outside every current music folder.");
    }
    const baseFolderName = path.basename(source);
    if (!baseFolderName) throw new Error(`Music folder cannot be moved: ${source}`);
    let folderName = baseFolderName;
    let suffix = 2;
    while (names.has(folderName.toLowerCase())) {
      folderName = `${baseFolderName}-${suffix}`;
      suffix += 1;
    }
    names.add(folderName.toLowerCase());
    return { ...root, path: source, folderName, targetPath: path.join(resolvedDestination, folderName) };
  });
  return plan;
};

const categoryFolder: Record<RelocatableRootKind, string> = {
  music: "Music",
  cortina: "Cortinas",
  background: "Images",
};

export const planSelectedRootRelocation = (
  roots: LibraryRootRecord[],
  destination: string,
) => {
  if (roots.length === 0) throw new Error("No folders of the selected types are configured.");
  const resolvedDestination = normalizedPath(destination);
  const namesByKind = new Map<RelocatableRootKind, Set<string>>();
  const plan = roots.map((root) => {
    const source = normalizedPath(root.path);
    if (isSameOrInside(resolvedDestination, source) || isSameOrInside(source, resolvedDestination)) {
      throw new Error("The new location must be outside every selected source folder.");
    }
    const baseFolderName = path.basename(source);
    if (!baseFolderName) throw new Error(`Source folder cannot be relocated: ${source}`);
    const names = namesByKind.get(root.kind) ?? new Set<string>();
    namesByKind.set(root.kind, names);
    let folderName = baseFolderName;
    let suffix = 2;
    while (names.has(folderName.toLowerCase())) {
      folderName = `${baseFolderName}-${suffix}`;
      suffix += 1;
    }
    names.add(folderName.toLowerCase());
    const categoryPath = path.join(resolvedDestination, categoryFolder[root.kind]);
    return {
      ...root,
      path: source,
      categoryPath,
      folderName,
      targetPath: path.join(categoryPath, folderName),
    };
  });
  return plan;
};

export const relocateLibraryRoots = async (
  db: Database.Database,
  destination: string,
  mode: "copy" | "move" = "move",
  selectedKinds: RelocatableRootKind[] = ["music"],
  onProgress?: (progress: RootRelocationProgress) => void,
): Promise<RootRelocationResult> => {
  const resolvedDestination = normalizedPath(destination);
  const uniqueKinds = [...new Set(selectedKinds)];
  const placeholders = uniqueKinds.map(() => "?").join(", ");
  const allRoots = db.prepare(
    "select id, kind, path, label from library_roots order by kind, created_at, id",
  ).all() as LibraryRootRecord[];
  const roots = uniqueKinds.length > 0
    ? allRoots.filter((root) => uniqueKinds.includes(root.kind))
    : [];

  try {
    const plan = planSelectedRootRelocation(roots, resolvedDestination);
    const selectedIds = new Set(plan.map((item) => item.id));
    const overlappingUnselected = allRoots.find((root) =>
      !selectedIds.has(root.id) && plan.some((selected) =>
        isSameOrInside(root.path, selected.path) || isSameOrInside(selected.path, root.path)),
    );
    if (overlappingUnselected) {
      throw new Error(
        `The unselected configured folder must also be selected because it overlaps a selected source: ${overlappingUnselected.path}`,
      );
    }
    await fs.promises.mkdir(resolvedDestination, { recursive: true });
    const destinationEntries = await fs.promises.readdir(resolvedDestination);
    if (destinationEntries.length > 0) {
      throw new Error("The new music location must be empty.");
    }
    for (const item of plan) {
      const stat = await fs.promises.stat(item.path).catch(() => null);
      if (!stat?.isDirectory()) throw new Error(`Source folder is unavailable: ${item.path}`);
    }

    const copiedTargets: string[] = [];
    try {
      for (const categoryPath of new Set(plan.map((item) => item.categoryPath))) {
        copiedTargets.push(categoryPath);
      }
      const mergedCopy = await copyMergedRootFiles(plan, onProgress);
      const copiedFileCount = mergedCopy.entries.length;

      onProgress?.({
        stage: "switching",
        completed: copiedFileCount,
        total: copiedFileCount,
        currentPath: "",
      });
      const rootIds = plan.map((item) => item.id);
      const rootPlaceholders = rootIds.map(() => "?").join(", ");
      const trackRows = rootIds.length > 0
        ? db.prepare(
            `select id, root_id, relative_path from tracks
             where root_id in (${rootPlaceholders})`,
          ).all(...rootIds) as Array<{ id: string; root_id: string; relative_path: string }>
        : [];
      const planById = new Map(plan.map((item) => [item.id, item]));
      const copiedBySource = new Map(
        mergedCopy.entries.map((entry) => [normalizedPath(entry.source), entry]),
      );
      const now = new Date().toISOString();
      const updateTrack = db.prepare(
        "update tracks set root_id = ?, relative_path = ?, full_path = ?, updated_at = ? where id = ?",
      );
      const updateDatabase = db.transaction(() => {
        for (const kind of uniqueKinds) {
          const kindPlan = plan.filter((item) => item.kind === kind);
          if (kindPlan.length === 0) continue;
          const retainedRoot = kindPlan[0];
          const used = mergedCopy.usedByKind.get(kind) ?? new Set<string>();
          for (const track of trackRows.filter((row) => planById.get(row.root_id)?.kind === kind)) {
            const item = planById.get(track.root_id);
            if (!item) throw new Error(`Source root not found for track ${track.id}.`);
            const copied = copiedBySource.get(normalizedPath(path.join(item.path, track.relative_path)));
            const relativePath = copied?.destinationRelativePath
              ?? collisionSafeRelativePath(track.relative_path, used);
            updateTrack.run(
              retainedRoot.id,
              relativePath,
              path.join(retainedRoot.categoryPath, relativePath),
              now,
              track.id,
            );
          }
          db.prepare(
            "update library_roots set path = ?, label = ? where id = ?",
          ).run(retainedRoot.categoryPath, categoryFolder[kind], retainedRoot.id);
          const obsoleteIds = kindPlan.slice(1).map((item) => item.id);
          if (obsoleteIds.length > 0) {
            db.prepare(
              `delete from library_roots where id in (${obsoleteIds.map(() => "?").join(", ")})`,
            ).run(...obsoleteIds);
          }
        }
      });
      updateDatabase();

      const warnings: string[] = [];
      if (mode === "move") {
        onProgress?.({
          stage: "cleanup",
          completed: copiedFileCount,
          total: copiedFileCount,
          currentPath: "",
        });
        const cleanupPlan = [...plan].sort(
          (left, right) => right.path.split(path.sep).length - left.path.split(path.sep).length,
        );
        for (const item of cleanupPlan) {
          try {
            await fs.promises.rm(item.path, { recursive: true, force: false });
          } catch (error) {
            warnings.push(
              `The library now uses ${item.targetPath}, but the old folder could not be removed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }
      }
      return {
        ok: true,
        destination: resolvedDestination,
        rootsMoved: plan.length,
        tracksMoved: trackRows.length,
        warnings,
      };
    } catch (error) {
      for (const target of copiedTargets.reverse()) {
        await fs.promises.rm(target, { recursive: true, force: true }).catch(() => undefined);
      }
      for (const categoryPath of [...new Set(plan.map((item) => item.categoryPath))]) {
        await fs.promises.rmdir(categoryPath).catch(() => undefined);
      }
      throw error;
    }
  } catch (error) {
    return {
      ok: false,
      destination: resolvedDestination,
      rootsMoved: 0,
      tracksMoved: 0,
      warnings: [],
      error: error instanceof Error ? error.message : "Music relocation failed.",
    };
  }
};

export const relocateMusicRoots = (
  db: Database.Database,
  destination: string,
  mode: "copy" | "move" = "move",
  onProgress?: (progress: RootRelocationProgress) => void,
) => relocateLibraryRoots(db, destination, mode, ["music"], onProgress);
