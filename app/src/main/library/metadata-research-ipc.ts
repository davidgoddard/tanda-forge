import { clipboard, dialog, shell } from "electron";
import { randomUUID } from "node:crypto";
import { open, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "../db";
import type { createDomainIpcRegistrar } from "../ipc/domain-registrar";
import type { ResearchEdit, ResearchScope } from "../../shared/metadata-research";
import { encodeResearchCsv, researchBaseColumns } from "./metadata-research-csv";
import { metadataResearchPrompt } from "./metadata-research-prompt";
import {
  applyResearch, listResearchRows, listResearchTracks, missingResearchValue, needsResearch,
  recordResearchExport, reviewResearchRows, stageResearchCsv, undoResearch,
} from "./metadata-research-store";

export function registerMetadataResearch(
  ipc: ReturnType<typeof createDomainIpcRegistrar>,
  changed: () => void,
  assertWritable: () => void,
  pickTestPath: () => Electron.OpenDialogReturnValue | null,
) {
  ipc.handle("library:researchState", () => {
    const db = getDb();
    const tracks = listResearchTracks(db);
    return { rows: listResearchRows(db), needed: tracks.filter(needsResearch).length,
      exported: tracks.filter((track) => track.exported).length,
      completed: tracks.filter((track) => track.completed).length };
  });
  ipc.handle("library:researchExport", async (_event, scope: ResearchScope, ids: string[], size: number, repeat: boolean) => {
    if (!["selected", "filtered", "genre", "year", "new", "needed"].includes(scope) ||
      !Array.isArray(ids) || ![0, 10, 20, 30, 50, 100].includes(size)) throw Error("Invalid research export selection");
    const selected = new Set(ids);
    const picker = pickTestPath() ?? await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    if (picker.canceled || !picker.filePaths[0]) return 0;
    const db = getDb();
    const tracks = listResearchTracks(db).filter((track) => {
      if (!needsResearch(track)) return false;
      if (track.exported && repeat !== true) return false;
      switch (scope) {
        case "selected": case "filtered": return selected.has(track.id);
        case "genre": return missingResearchValue(track.genre);
        case "year": return missingResearchValue(track.year);
        case "new": return !track.completed;
        case "needed": return true;
      }
    });
    if (!tracks.length) return 0;
    const day = new Date().toISOString().slice(0, 10);
    const batch = `${day}-${randomUUID()}`;
    const directory = path.join(picker.filePaths[0], `metadata_research_${batch}`);
    await mkdir(directory);
    const batchSize = size || tracks.length;
    for (let i = 0; i < tracks.length; i += batchSize) {
      const number = String(i / batchSize + 1).padStart(3, "0");
      const subset = tracks.slice(i, i + batchSize);
      await writeFile(path.join(directory, `metadata_research_${day}_batch_${number}.csv`),
        encodeResearchCsv(researchBaseColumns, subset), { encoding: "utf8", flag: "wx" });
      if (db !== getDb()) throw Error("Data location changed during export");
      recordResearchExport(db, `${batch}/${number}`, subset.map((track) => track.id));
    }
    return tracks.length;
  });
  ipc.handle("library:researchImport", async () => {
    const picker = pickTestPath() ?? await dialog.showOpenDialog({ properties: ["openFile"],
      filters: [{ name: "CSV", extensions: ["csv"] }] });
    if (picker.canceled || !picker.filePaths[0]) return null;
    const file = await open(picker.filePaths[0], "r");
    try {
      const limit = 16 * 1024 * 1024;
      const buffer = Buffer.alloc(limit + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > limit) throw Error("Research CSV exceeds 16 MB");
      return stageResearchCsv(getDb(), new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer.subarray(0, length)));
    } finally {
      await file.close();
    }
  });
  ipc.handle("library:researchReview", (_event, edits: ResearchEdit[]) => {
    if (!Array.isArray(edits)) throw Error("Invalid research review");
    reviewResearchRows(getDb(), edits);
  });
  ipc.handle("library:researchApply", () => {
    assertWritable();
    const outcome = applyResearch(getDb());
    if (outcome.tracks) changed();
    return outcome;
  });
  ipc.handle("library:researchUndo", (_event, batch: string, line?: number) => {
    assertWritable();
    if (typeof batch !== "string" || (line !== undefined && !Number.isSafeInteger(line))) throw Error("Invalid research batch");
    const count = undoResearch(getDb(), batch, line);
    if (count) changed();
    return count;
  });
  ipc.handle("library:researchPrompt", () => clipboard.writeText(metadataResearchPrompt));
  ipc.handle("library:researchEvidence", async (_event, source: string) => {
    if (typeof source !== "string") throw Error("Invalid evidence URL");
    const url = new URL(source);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw Error("Invalid evidence URL");
    await shell.openExternal(url.href);
  });
}
