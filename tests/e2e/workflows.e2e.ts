import fs from "fs";
import { execFileSync } from "child_process";
import path from "path";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { launchSeededApp, relaunchSeededApp } from "./support/electron-app";

const runSearch = async (page: Page, query: string) => {
  const searchTracks = page.locator("#search-tracks");
  const beforeReadyToken = await searchTracks.getAttribute("data-ready-token");
  await page.locator("#search-input").fill(query);
  await page.locator("#search-button").click();
  await expect(searchTracks).toHaveAttribute("data-state", "idle");
  const afterReadyToken = await searchTracks.getAttribute("data-ready-token");
  if (beforeReadyToken !== null && afterReadyToken !== null) {
    expect(Number.parseInt(afterReadyToken, 10)).toBeGreaterThanOrEqual(
      Number.parseInt(beforeReadyToken, 10),
    );
  }
};

const addTrackToTandaDesigner = async (page: Page, trackText: string) => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.locator('button[data-tab="tanda-designer-tab"]').click();
      const hasEditorTracks = (await page.locator("#tanda-list .tanda-track-row").count()) > 0;
      if (!hasEditorTracks) {
        await page.locator("#add-tanda").click();
      }
      await runSearch(page, trackText);
      const row = searchTrackRow(page, trackText);
      await expect(row).toBeVisible();
      await clickRowAction(row, "add-tanda");
      await confirmIfPrompted(page);
      await expect
        .poll(
          async () =>
            page
              .locator("#tanda-list .tanda-track-row", { hasText: trackText })
              .count(),
          { timeout: 3_000 },
        )
        .toBeGreaterThan(0);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) {
    throw lastError;
  }
};

const confirmIfPrompted = async (page: Page) => {
  const okButton = page.locator(".confirm-modal:not(.hidden) .confirm-ok").first();
  try {
    await okButton.waitFor({ state: "visible", timeout: 750 });
    await okButton.click();
  } catch {
    // No confirmation shown for this path.
  }
};

const searchTrackRow = (page: Page, text: string) =>
  page.locator("#search-tracks .track-row", { hasText: text }).first();

const searchTandaRow = (page: Page, text: string) =>
  page.locator("#search-tandas .tanda-row", { hasText: text }).first();

const clipboardTrackRow = (page: Page, text: string) =>
  page.locator("#clip-tracks .track-row", { hasText: text }).first();

const clipboardTandaRow = (page: Page, text: string) =>
  page.locator("#clip-tandas .tanda-row", { hasText: text }).first();

const playlistTrackRow = (page: Page, text: string) =>
  page.locator("#playlist-list .track-row", { hasText: text }).first();

const playlistTandaRow = (page: Page, text: string) =>
  page.locator("#playlist-list .tanda-row", { hasText: text }).first();

const waitForEditorRows = async (editor: Locator, minRows: number, timeout = 10_000) => {
  await expect
    .poll(
      async () => {
        return editor.locator(".tanda-track-row").count();
      },
      { timeout },
    )
    .toBeGreaterThanOrEqual(minRows);
};

const waitForAnyEditorRows = async (page: Page, minRows: number, timeout = 10_000) => {
  const playlistEditor = page.locator("#playlist-tanda-editor");
  const designerEditor = page.locator("#tanda-list");
  await expect
    .poll(
      async () => {
        const playlistVisible = await playlistEditor
          .locator(".tanda-track-row")
          .nth(minRows - 1)
          .isVisible()
          .catch(() => false);
        if (playlistVisible) {
          return minRows;
        }
        const designerVisible = await designerEditor
          .locator(".tanda-track-row")
          .nth(minRows - 1)
          .isVisible()
          .catch(() => false);
        return designerVisible ? minRows : 0;
      },
      { timeout },
    )
    .toBeGreaterThanOrEqual(minRows);
  const playlistVisible = await playlistEditor
    .locator(".tanda-track-row")
    .nth(minRows - 1)
    .isVisible()
    .catch(() => false);
  return playlistVisible ? playlistEditor : designerEditor;
};

const waitForPlaylistEditorRows = async (page: Page, minRows: number, timeout = 10_000) => {
  const editor = page.locator('#playlist-tanda-editor[data-state="visible"]');
  await expect(editor).toBeVisible({ timeout });
  await waitForEditorRows(editor, minRows, timeout);
  return editor;
};

const clickEditorTrackAction = async (
  editor: Locator,
  rowIndex: number,
  action: "tanda-up" | "tanda-down" | "tanda-remove",
) => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await waitForEditorRows(editor, rowIndex + 1, 5_000);
      const row = editor.locator(".tanda-track-row").nth(rowIndex);
      await expect(row).toBeVisible({ timeout: 5_000 });
      await row.locator(`button[data-action="${action}"]`).click({ timeout: 5_000, force: true });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) {
    throw lastError;
  }
};

const selectClipboardCollection = async (page: Page, collectionId: string) => {
  await page
    .locator(`#clipboard-collections-tabs button[data-collection-id="${collectionId}"]`)
    .click();
};

const createClipboardCollection = async (page: Page, name: string) => {
  await page.locator("#clipboard-collection-name").fill(name);
  await page.locator("#clipboard-collection-add").click();
  const created = page
    .locator("#clipboard-collections-tabs button")
    .filter({ hasText: name })
    .last();
  await expect(created).toBeVisible();
  const collectionId = await created.getAttribute("data-collection-id");
  expect(collectionId).toBeTruthy();
  return collectionId!;
};

const clipboardCollectionTandaIds = async (page: Page, collectionId: string) => {
  return await page.evaluate((targetId) => {
    const raw = localStorage.getItem("tanda-clipboard-collections");
    if (!raw) {
      return [] as string[];
    }
    try {
      const parsed = JSON.parse(raw) as Array<{
        id?: string;
        tandaIds?: string[];
      }>;
      const collection = parsed.find((item) => item.id === targetId);
      return Array.isArray(collection?.tandaIds) ? collection!.tandaIds : [];
    } catch {
      return [] as string[];
    }
  }, collectionId);
};

const ensurePlaylistTab = async (page: Page) => {
  await closeTrackEditorIfOpen(page);
  await page.locator('button[data-tab="playlist-tab"]').click();
  await expect(page.locator('button[data-tab="playlist-tab"]')).toHaveClass(/active/);
};

const getNormalizedStoredPlaylistState = async (page: Page) => {
  return await page.evaluate(() => {
    const raw = localStorage.getItem("tanda-playlist-items");
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as {
      items?: Array<
        | { kind: "track"; id: string }
        | {
            kind: "tanda";
            mismatch?: "style" | "count";
            snapshot?: {
              name: string;
              styles: string[];
              rating: number;
              trackSlots: (string | null)[];
              totalDurationMs?: number;
            };
          }
        | null
      >;
      cortinaSet?: string;
      cortinaAssignments?: Array<{ index: number; trackId: string }>;
    };
    return {
      cortinaSet: parsed.cortinaSet ?? null,
      cortinaAssignments: Array.isArray(parsed.cortinaAssignments)
        ? parsed.cortinaAssignments.map((entry) => ({ index: entry.index, trackId: entry.trackId }))
        : [],
      items: Array.isArray(parsed.items)
        ? parsed.items
            .filter((item) => item !== null)
            .map((item) => {
              if (!item) {
                return null;
              }
              if (item.kind === "track") {
                return { kind: "track", id: item.id };
              }
              return {
                kind: "tanda",
                mismatch: item.mismatch ?? null,
                snapshot: item.snapshot
                  ? {
                      name: item.snapshot.name,
                      styles: [...item.snapshot.styles],
                      rating: item.snapshot.rating,
                      trackSlots: [...item.snapshot.trackSlots],
                      totalDurationMs: item.snapshot.totalDurationMs ?? 0,
                    }
                  : null,
              };
            })
        : [],
    };
  });
};

const configureE2eDialogResponses = async (
  page: Page,
  payload: { saveFilePaths?: string[]; openFilePaths?: string[] },
) => {
  await page.evaluate(async (dialogPayload) => {
    await window.tanda?.setE2eDialogResponses(dialogPayload);
  }, payload);
};

const clearPlaylistViaUi = async (page: Page) => {
  await ensurePlaylistTab(page);
  const clearButton = page.locator("#playlist-clear");
  if (!(await clearButton.isEnabled())) {
    await expect(page.locator("#playlist-list .track-row")).toHaveCount(0);
    await expect(page.locator("#playlist-list .tanda-row")).toHaveCount(0);
    return;
  }
  await clearButton.click();
  const modal = page.locator(".playlist-clear-modal");
  if ((await modal.count()) > 0) {
    await expect(modal).not.toHaveClass(/hidden/);
    await modal.locator('.confirm-ok[data-option="clear"]').click();
  }
  await expect(page.locator("#playlist-list .track-row")).toHaveCount(0);
  await expect(page.locator("#playlist-list .tanda-row")).toHaveCount(0);
};

const configureFastLivePlayback = async (page: Page) => {
  await page.locator("#mode-select").selectOption("live");
  await openSettings(page);
  await page.locator('button[data-tab="playlist"]').click();
  await page.locator("#gap-between-tracks").fill("0");
  await page.locator("#gap-before-tanda").fill("0");
  await page.locator("#gap-before-cortina").fill("0");
  await page.locator("#playlist-cortina-set").selectOption("");
  await closeSettings(page);
};

const waitForFirstNamedCortinaSetValue = async (page: Page, timeout = 10_000) => {
  const resolveValue = async () =>
    await page.evaluate(() => {
      const select = document.querySelector<HTMLSelectElement>("#playlist-cortina-set");
      if (!select) {
        return "";
      }
      const option = Array.from(select.options).find(
        (opt) => (opt.value ?? "").trim().length > 0,
      );
      return option?.value ?? "";
    });
  await expect.poll(resolveValue, { timeout }).not.toBe("");
  return await resolveValue();
};

const openRowMenu = async (row: Locator) => {
  await row.locator('button[data-action="row-menu"]').first().click({ force: true });
};

const clickRowAction = async (row: Locator, action: string) => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const currentRow = row.first();
    await expect(currentRow).toBeVisible();
    try {
      await currentRow.scrollIntoViewIfNeeded();
      await openRowMenu(currentRow);
      const rowMenuAction = currentRow.locator(`.row-menu button[data-action="${action}"]`).first();
      if ((await rowMenuAction.count()) > 0) {
        await rowMenuAction.click({ timeout: 5000, force: true });
        return;
      }
      const globalRowMenuAction = currentRow
        .page()
        .locator(`.row-menu button[data-action="${action}"]:visible`)
        .first();
      if ((await globalRowMenuAction.count()) > 0) {
        await globalRowMenuAction.click({ timeout: 5000, force: true });
        return;
      }
      const directAction = currentRow.locator(`button[data-action="${action}"]`).first();
      if ((await directAction.count()) > 0) {
        await directAction.click({ timeout: 5000, force: true });
        return;
      }
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) {
    throw lastError;
  }
  await row.locator(`button[data-action="${action}"]`).first().click({ force: true });
};

const openTrackEditorFromRow = async (page: Page, row: Locator) => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await expect(row.first()).toBeVisible();
      await page.waitForTimeout(50);
      await clickRowAction(row.first(), "edit-track");
      await expect(page.locator("#track-editor")).toHaveAttribute("aria-hidden", "false");
      return;
    } catch (error) {
      lastError = error;
      await closeTrackEditorIfOpen(page);
      await page.waitForTimeout(100);
    }
  }
  if (lastError) {
    throw lastError;
  }
};

const openSettings = async (page: Page) => {
  const panel = page.locator("#settings-panel");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.locator("#open-settings").click();
    try {
      await expect(panel).toHaveAttribute("aria-hidden", "false", { timeout: 3000 });
      return;
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
      await page.waitForTimeout(150);
    }
  }
};

const closeSettings = async (page: Page) => {
  await page.locator("#close-settings").click();
  await expect(page.locator("#settings-panel")).toHaveAttribute("aria-hidden", "true");
};

const closeTrackEditorIfOpen = async (page: Page) => {
  const editor = page.locator("#track-editor");
  const isOpen = (await editor.getAttribute("aria-hidden")) !== "true";
  if (!isOpen) {
    return;
  }
  const closeButton = page.locator("#track-editor-close");
  if (await closeButton.isVisible()) {
    await closeButton.click();
    await confirmIfPrompted(page);
  }
  await expect(editor).toHaveAttribute("aria-hidden", "true");
};

const ensureDir = (dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const resolveBundledFfmpegPath = () => {
  const platformDir =
    process.platform === "darwin"
      ? "darwin"
      : process.platform === "win32"
        ? "win32"
        : "linux";
  const binaryName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  return path.join(process.cwd(), "app", "resources", "ffmpeg", platformDir, binaryName);
};

const writeTaggedMp3 = (
  filePath: string,
  metadata: {
    title: string;
    artist: string;
    album: string;
    year: string;
    genre: string;
    singer?: string;
    notes?: string;
    seconds?: number;
    frequency?: number;
  },
) => {
  ensureDir(path.dirname(filePath));
  const ffmpegPath = resolveBundledFfmpegPath();
  execFileSync(
    ffmpegPath,
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${Math.max(120, metadata.frequency ?? 440)}:duration=${Math.max(0.4, metadata.seconds ?? 0.8)}`,
      "-c:a",
      "libmp3lame",
      "-q:a",
      "4",
      "-id3v2_version",
      "3",
      "-metadata",
      `title=${metadata.title}`,
      "-metadata",
      `artist=${metadata.artist}`,
      "-metadata",
      `album=${metadata.album}`,
      "-metadata",
      `date=${metadata.year}`,
      "-metadata",
      `genre=${metadata.genre}`,
      "-metadata",
      `comment=${metadata.notes ?? ""}`,
      "-metadata",
      `composer=${metadata.singer ?? ""}`,
      filePath,
    ],
    { stdio: "ignore" },
  );
};

type RescanFixtureTrack = {
  fileName: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  bpmEdited: number;
  singerEdited: string;
  notesEdited: string;
  editedTitle: string;
  editedArtist: string;
  editedAlbum: string;
  editedYear: string;
  editedGenre: string;
  editedVocal: "sung" | "instrumental";
};

const createRescanFixtureTracks = (): RescanFixtureTrack[] =>
  Array.from({ length: 10 }, (_value, index) => {
    const number = index + 1;
    return {
      fileName: `rescan-track-${String(number).padStart(2, "0")}.mp3`,
      title: `Imported Title ${number}`,
      artist: `Imported Artist ${number}`,
      album: `Imported Album ${number}`,
      year: String(1930 + number),
      genre: number % 2 === 0 ? "Tango" : "Milonga",
      bpmEdited: 80 + number,
      singerEdited: `Edited Singer ${number}`,
      notesEdited: `Edited notes ${number}`,
      editedTitle: `Edited Title ${number}`,
      editedArtist: `Edited Artist ${number}`,
      editedAlbum: `Edited Album ${number}`,
      editedYear: String(1950 + number),
      editedGenre: number % 2 === 0 ? "Waltz" : "Other",
      editedVocal: number % 2 === 0 ? "instrumental" : "sung",
    };
  });

const getTracksViaApi = async (page: Page) =>
  await page.evaluate(async () => {
    return (await window.tanda?.listTracks()) ?? [];
  });

const getRootsViaApi = async (page: Page) =>
  await page.evaluate(async () => {
    return (await window.tanda?.listRoots()) ?? [];
  });

const getCapturedScanSummaries = async (page: Page) =>
  await page.evaluate(() => {
    return window.tanda?.getE2eScanSummaries() ?? [];
  });

const waitForTrackCount = async (page: Page, expected: number) => {
  await expect
    .poll(async () => {
      const tracks = await getTracksViaApi(page);
      return tracks.length;
    })
    .toBe(expected);
};

const setOpenDialogResponses = async (page: Page, paths: string[]) => {
  await page.evaluate(async (openFilePaths) => {
    await window.tanda?.setE2eDialogResponses({ openFilePaths });
  }, paths);
};

const addMusicRootViaSettings = async (page: Page, musicRoot: string) => {
  await openSettings(page);
  await page.locator('button[data-tab="library"]').click();
  await setOpenDialogResponses(page, [musicRoot]);
  await page.locator("#add-music").click();
  await expect
    .poll(async () => {
      const roots = await getRootsViaApi(page);
      return roots.some((root) => root.kind === "music" && root.path === musicRoot);
    })
    .toBe(true);
};

const runMusicScan = async (page: Page) => {
  const before = await getCapturedScanSummaries(page);
  const scanButton = page.locator("#scan-music");
  await scanButton.click();
  await expect(scanButton).toBeDisabled();
  await expect(scanButton).toBeEnabled();
  await expect
    .poll(async () => {
      const summaries = await getCapturedScanSummaries(page);
      return summaries.length;
    })
    .toBe(before.length + 1);
  const after = await getCapturedScanSummaries(page);
  const entry = after.at(-1);
  expect(entry?.kind).toBe("music");
  return entry?.summary ?? null;
};

const applyEditedTrackValues = async (page: Page, track: RescanFixtureTrack) => {
  await runSearch(page, track.title);
  const row = searchTrackRow(page, track.title);
  await expect(row).toBeVisible();
  await openTrackEditorFromRow(page, row);
  await page.locator("#track-editor-title").fill(track.editedTitle);
  await page.locator("#track-editor-artist").fill(track.editedArtist);
  await page.locator("#track-editor-singer").fill(track.singerEdited);
  await page.locator("#track-editor-vocal").selectOption(track.editedVocal);
  await page.locator("#track-editor-album").fill(track.editedAlbum);
  await page.locator("#track-editor-year").fill(track.editedYear);
  await page.locator("#track-editor-genre").selectOption({ label: track.editedGenre });
  await page.locator("#track-editor-notes").fill(track.notesEdited);
  await page.locator("#track-editor-bpm").fill(String(track.bpmEdited));
  await page.locator("#track-editor-save").click();
  await expect
    .poll(async () => {
      const rows = await getTracksViaApi(page);
      const row = rows.find((candidate) => candidate.relative_path?.endsWith(track.fileName));
      return row
        ? {
            title: row.title,
            artist: row.artist,
            singer: row.singer,
            album: row.album,
            year: row.year,
            genre: row.genre,
            notes: row.notes,
            bpm: Math.round(Number(row.bpm ?? 0)),
            instrumental: Boolean(row.instrumental),
          }
        : null;
    })
    .toEqual({
      title: track.editedTitle,
      artist: track.editedArtist,
      singer: track.singerEdited,
      album: track.editedAlbum,
      year: track.editedYear,
      genre: track.editedGenre,
      notes: track.notesEdited,
      bpm: track.bpmEdited,
      instrumental: track.editedVocal === "instrumental",
    });
  await closeTrackEditorIfOpen(page);
};

const expectEditedTracksPersisted = async (
  page: Page,
  tracks: RescanFixtureTrack[],
  options?: { expectedTotal?: number },
) => {
  const rows = await getTracksViaApi(page);
  if (options?.expectedTotal !== undefined) {
    expect(rows).toHaveLength(options.expectedTotal);
  } else {
    expect(rows.length).toBeGreaterThanOrEqual(tracks.length);
  }
  for (const track of tracks) {
    const row = rows.find((candidate) => candidate.relative_path?.endsWith(track.fileName));
    expect(row, track.fileName).toBeTruthy();
    expect(row?.title).toBe(track.editedTitle);
    expect(row?.artist).toBe(track.editedArtist);
    expect(row?.singer).toBe(track.singerEdited);
    expect(row?.album).toBe(track.editedAlbum);
    expect(row?.year).toBe(track.editedYear);
    expect(row?.genre).toBe(track.editedGenre);
    expect(row?.notes).toBe(track.notesEdited);
    expect(Math.round(Number(row?.bpm ?? 0))).toBe(track.bpmEdited);
    expect(Boolean(row?.instrumental)).toBe(track.editedVocal === "instrumental");
  }
};

const snapshotTracksByFileName = async (page: Page, tracks: RescanFixtureTrack[]) => {
  const rows = await getTracksViaApi(page);
  return Object.fromEntries(
    tracks.map((track) => {
      const row = rows.find((candidate) => candidate.relative_path?.endsWith(track.fileName));
      expect(row, track.fileName).toBeTruthy();
      return [
        track.fileName,
        {
          id: row!.id,
          full_path: row!.full_path,
          relative_path: row!.relative_path,
          title: row!.title,
          artist: row!.artist,
          artist_summary: row!.artist_summary,
          singer: row!.singer,
          album: row!.album,
          year: row!.year,
          genre: row!.genre,
          bpm: row!.bpm,
          notes: row!.notes,
          instrumental: row!.instrumental,
          duration_ms: row!.duration_ms,
          start_offset_ms: row!.start_offset_ms,
          end_trim_ms: row!.end_trim_ms,
          analysis_json: row!.analysis_json,
          loudness_db: row!.loudness_db,
          gain_db: row!.gain_db,
          tag_error: row!.tag_error,
          analysis_error: row!.analysis_error,
        },
      ];
    }),
  );
};

const expectTrackSnapshotsMatch = async (
  page: Page,
  expectedSnapshots: Record<string, Record<string, unknown>>,
) => {
  const rows = await getTracksViaApi(page);
  for (const [fileName, expectedSnapshot] of Object.entries(expectedSnapshots)) {
    const row = rows.find((candidate) => candidate.relative_path?.endsWith(fileName));
    expect(row, fileName).toBeTruthy();
    expect({
      id: row!.id,
      full_path: row!.full_path,
      relative_path: row!.relative_path,
      title: row!.title,
      artist: row!.artist,
      artist_summary: row!.artist_summary,
      singer: row!.singer,
      album: row!.album,
      year: row!.year,
      genre: row!.genre,
      bpm: row!.bpm,
      notes: row!.notes,
      instrumental: row!.instrumental,
      duration_ms: row!.duration_ms,
      start_offset_ms: row!.start_offset_ms,
      end_trim_ms: row!.end_trim_ms,
      analysis_json: row!.analysis_json,
      loudness_db: row!.loudness_db,
      gain_db: row!.gain_db,
      tag_error: row!.tag_error,
      analysis_error: row!.analysis_error,
    }).toEqual(expectedSnapshot);
  }
};

const writeTestWav = (filePath: string, options?: { seconds?: number; frequency?: number }) => {
  const seconds = Math.max(0.25, options?.seconds ?? 0.6);
  const sampleRate = 44_100;
  const channelCount = 1;
  const bitsPerSample = 16;
  const blockAlign = (channelCount * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const sampleCount = Math.max(1, Math.floor(sampleRate * seconds));
  const dataSize = sampleCount * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;
  buffer.write("RIFF", offset); offset += 4;
  buffer.writeUInt32LE(36 + dataSize, offset); offset += 4;
  buffer.write("WAVE", offset); offset += 4;
  buffer.write("fmt ", offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(channelCount, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
  buffer.write("data", offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;
  const frequency = options?.frequency ?? 220;
  for (let index = 0; index < sampleCount; index += 1) {
    const amplitude = Math.round(
      Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 8_000,
    );
    buffer.writeInt16LE(amplitude, offset);
    offset += 2;
  }
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, buffer);
};

const writeLegacyStartupFixture = (tempRoot: string) => {
  const musicRoot = path.join(tempRoot, "music");
  const cortinaRoot = path.join(tempRoot, "cortinas");
  ensureDir(musicRoot);
  ensureDir(cortinaRoot);

  writeTestWav(path.join(musicRoot, "legacy-alpha.wav"), { seconds: 3.2, frequency: 220 });
  writeTestWav(path.join(musicRoot, "legacy-beta.wav"), { seconds: 3.1, frequency: 330 });
  writeTestWav(path.join(cortinaRoot, "cortina-a.wav"), { seconds: 1.2, frequency: 440 });

  fs.writeFileSync(path.join(musicRoot, "config.js"), "module.exports = {};\n", "utf-8");
  fs.writeFileSync(
    path.join(musicRoot, "library.dat"),
    JSON.stringify(
      {
        "music/legacy-alpha.wav": {
          track: {
            title: "Legacy Alpha",
            artist: "Legacy Orchestra",
            album: "Legacy Album",
            date: "1941-01-01",
          },
          analysis: {
            duration: 3.2,
            start: 0.02,
            silence: 3.05,
            meanGain: -18,
          },
          classifiers: {
            style: "Tango",
            notes: "legacy note alpha",
            bpm: 64,
            instrumental: false,
          },
        },
        "music/legacy-beta.wav": {
          track: {
            title: "Legacy Beta",
            artist: "Legacy Orchestra",
            album: "Legacy Album",
            date: "1942-01-01",
          },
          analysis: {
            duration: 3.1,
            start: 0.02,
            silence: 2.96,
            meanGain: -17.5,
          },
          classifiers: {
            style: "Tango",
            notes: "legacy note beta",
            bpm: 65,
            instrumental: false,
          },
        },
      },
      null,
      2,
    ),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(musicRoot, "cortinas.dat"),
    JSON.stringify(
      {
        "cortinas/cortina-a.wav": {
          track: {
            title: "Legacy Cortina",
            artist: "DJ Test",
            album: "Legacy Cortinas",
            date: "1940-01-01",
          },
          analysis: {
            duration: 1.2,
            meanGain: -19,
          },
          classifiers: {
            style: "Other",
            bpm: 120,
            instrumental: true,
          },
        },
      },
      null,
      2,
    ),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(musicRoot, "tandas.dat"),
    JSON.stringify(
      [
        {
          label: "Legacy Tango Pair",
          style: "Tango",
          instrumental: false,
          tracks: ["music/legacy-alpha.wav", "music/legacy-beta.wav"],
        },
      ],
      null,
      2,
    ),
    "utf-8",
  );

  return { musicRoot, cortinaRoot };
};

const installDeterministicMediaStub = async (page: Page) => {
  await page.evaluate(() => {
    const scope = window as unknown as { __e2eMediaPatched?: boolean };
    if (scope.__e2eMediaPatched) {
      return;
    }
    const proto = HTMLMediaElement.prototype as HTMLMediaElement & {
      play: () => Promise<void>;
      pause: () => void;
      __e2eOriginalPlay?: () => Promise<void>;
      __e2eOriginalPause?: () => void;
    };
    proto.__e2eOriginalPlay = proto.play.bind(proto);
    proto.__e2eOriginalPause = proto.pause.bind(proto);
    proto.play = function playStub() {
      try {
        Object.defineProperty(this, "paused", {
          configurable: true,
          get: () => false,
        });
      } catch {
        // Ignore if the runtime blocks descriptor overrides.
      }
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    };
    proto.pause = function pauseStub() {
      try {
        Object.defineProperty(this, "paused", {
          configurable: true,
          get: () => true,
        });
      } catch {
        // Ignore if the runtime blocks descriptor overrides.
      }
      this.dispatchEvent(new Event("pause"));
    };
    scope.__e2eMediaPatched = true;
  });
};

const installAutoEndingMediaStub = async (page: Page, endedDelayMs = 250) => {
  await page.evaluate((delayMs) => {
    const scope = window as unknown as { __e2eAutoEndingMediaPatched?: boolean };
    if (scope.__e2eAutoEndingMediaPatched) {
      return;
    }
    const proto = HTMLMediaElement.prototype as HTMLMediaElement & {
      play: () => Promise<void>;
      pause: () => void;
      __e2eOriginalPlay?: () => Promise<void>;
      __e2eOriginalPause?: () => void;
      __e2eEndTimer?: number;
      __e2ePlaybackEnded?: boolean;
    };
    proto.__e2eOriginalPlay = proto.play.bind(proto);
    proto.__e2eOriginalPause = proto.pause.bind(proto);
    proto.play = function playStub() {
      const media = this as HTMLMediaElement & {
        __e2eEndTimer?: number;
        __e2ePlaybackEnded?: boolean;
      };
      if (media.__e2eEndTimer) {
        window.clearTimeout(media.__e2eEndTimer);
      }
      media.__e2ePlaybackEnded = false;
      try {
        Object.defineProperty(media, "paused", {
          configurable: true,
          get: () => false,
        });
        Object.defineProperty(media, "ended", {
          configurable: true,
          get: () => Boolean(media.__e2ePlaybackEnded),
        });
      } catch {
        // Ignore if runtime blocks descriptor overrides.
      }
      media.dispatchEvent(new Event("play"));
      media.__e2eEndTimer = window.setTimeout(() => {
        media.__e2ePlaybackEnded = true;
        try {
          Object.defineProperty(media, "paused", {
            configurable: true,
            get: () => true,
          });
        } catch {
          // Ignore if runtime blocks descriptor overrides.
        }
        media.dispatchEvent(new Event("pause"));
        media.dispatchEvent(new Event("ended"));
      }, Math.max(50, delayMs));
      return Promise.resolve();
    };
    proto.pause = function pauseStub() {
      const media = this as HTMLMediaElement & {
        __e2eEndTimer?: number;
        __e2ePlaybackEnded?: boolean;
      };
      if (media.__e2eEndTimer) {
        window.clearTimeout(media.__e2eEndTimer);
        media.__e2eEndTimer = undefined;
      }
      media.__e2ePlaybackEnded = true;
      try {
        Object.defineProperty(media, "paused", {
          configurable: true,
          get: () => true,
        });
        Object.defineProperty(media, "ended", {
          configurable: true,
          get: () => Boolean(media.__e2ePlaybackEnded),
        });
      } catch {
        // Ignore if runtime blocks descriptor overrides.
      }
      media.dispatchEvent(new Event("pause"));
    };
    scope.__e2eAutoEndingMediaPatched = true;
  }, endedDelayMs);
};

const installVariableEndingMediaStub = async (
  page: Page,
  musicDelayMs = 600,
  cortinaDelayMs = 4_000,
) => {
  await page.evaluate(
    ({ musicDelay, cortinaDelay }) => {
      const scope = window as unknown as { __e2eVariableEndingMediaPatched?: boolean };
      if (scope.__e2eVariableEndingMediaPatched) {
        return;
      }
      const proto = HTMLMediaElement.prototype as HTMLMediaElement & {
        play: () => Promise<void>;
        pause: () => void;
        __e2eOriginalPlay?: () => Promise<void>;
        __e2eOriginalPause?: () => void;
        __e2eEndTimer?: number;
        __e2ePlaybackEnded?: boolean;
      };
      proto.__e2eOriginalPlay = proto.play.bind(proto);
      proto.__e2eOriginalPause = proto.pause.bind(proto);
      proto.play = function playStub() {
        const media = this as HTMLMediaElement & {
          __e2eEndTimer?: number;
          __e2ePlaybackEnded?: boolean;
          currentSrc?: string;
          src?: string;
        };
        if (media.__e2eEndTimer) {
          window.clearTimeout(media.__e2eEndTimer);
        }
        media.__e2ePlaybackEnded = false;
        const source = `${media.currentSrc ?? media.src ?? ""}`.toLowerCase();
        const delay = source.includes("cortina")
          ? Math.max(100, cortinaDelay)
          : Math.max(100, musicDelay);
        try {
          Object.defineProperty(media, "paused", {
            configurable: true,
            get: () => false,
          });
          Object.defineProperty(media, "ended", {
            configurable: true,
            get: () => Boolean(media.__e2ePlaybackEnded),
          });
        } catch {
          // Ignore if runtime blocks descriptor overrides.
        }
        media.dispatchEvent(new Event("play"));
        media.__e2eEndTimer = window.setTimeout(() => {
          media.__e2ePlaybackEnded = true;
          try {
            Object.defineProperty(media, "paused", {
              configurable: true,
              get: () => true,
            });
          } catch {
            // Ignore if runtime blocks descriptor overrides.
          }
          media.dispatchEvent(new Event("pause"));
          media.dispatchEvent(new Event("ended"));
        }, delay);
        return Promise.resolve();
      };
      proto.pause = function pauseStub() {
        const media = this as HTMLMediaElement & {
          __e2eEndTimer?: number;
          __e2ePlaybackEnded?: boolean;
        };
        if (media.__e2eEndTimer) {
          window.clearTimeout(media.__e2eEndTimer);
          media.__e2eEndTimer = undefined;
        }
        media.__e2ePlaybackEnded = true;
        try {
          Object.defineProperty(media, "paused", {
            configurable: true,
            get: () => true,
          });
          Object.defineProperty(media, "ended", {
            configurable: true,
            get: () => Boolean(media.__e2ePlaybackEnded),
          });
        } catch {
          // Ignore if runtime blocks descriptor overrides.
        }
        media.dispatchEvent(new Event("pause"));
      };
      scope.__e2eVariableEndingMediaPatched = true;
    },
    { musicDelay: musicDelayMs, cortinaDelay: cortinaDelayMs },
  );
};

const installAdvancingMediaStub = async (
  page: Page,
  musicDurationMs = 6_000,
  cortinaDurationMs = 4_000,
  tickMs = 100,
) => {
  await page.evaluate(
    ({ musicDuration, cortinaDuration, tick }) => {
      const scope = window as unknown as {
        __e2eAdvancingMediaPatched?: boolean;
        __e2eAdvancingMediaState?: {
          activeSource: string;
          paused: boolean;
          ended: boolean;
          currentTime: number;
          duration: number;
          volume: number;
        };
      };
      if (scope.__e2eAdvancingMediaPatched) {
        return;
      }
      const proto = HTMLMediaElement.prototype as HTMLMediaElement & {
        play: () => Promise<void>;
        pause: () => void;
        __e2eOriginalPlay?: () => Promise<void>;
        __e2eOriginalPause?: () => void;
        __e2eOriginalCurrentTimeDescriptor?: PropertyDescriptor;
        __e2eOriginalDurationDescriptor?: PropertyDescriptor;
        __e2eOriginalPausedDescriptor?: PropertyDescriptor;
        __e2eOriginalEndedDescriptor?: PropertyDescriptor;
      };
      const currentTimes = new WeakMap<HTMLMediaElement, number>();
      const durations = new WeakMap<HTMLMediaElement, number>();
      const pausedStates = new WeakMap<HTMLMediaElement, boolean>();
      const endedStates = new WeakMap<HTMLMediaElement, boolean>();
      type StubMedia = HTMLMediaElement & {
        __e2eCurrentTime?: number;
        __e2eDuration?: number;
        __e2ePaused?: boolean;
        __e2eEnded?: boolean;
        __e2eTickTimer?: number;
        __e2eLastTickAt?: number;
      };
      proto.__e2eOriginalCurrentTimeDescriptor = Object.getOwnPropertyDescriptor(proto, "currentTime");
      proto.__e2eOriginalDurationDescriptor = Object.getOwnPropertyDescriptor(proto, "duration");
      proto.__e2eOriginalPausedDescriptor = Object.getOwnPropertyDescriptor(proto, "paused");
      proto.__e2eOriginalEndedDescriptor = Object.getOwnPropertyDescriptor(proto, "ended");
      Object.defineProperty(proto, "currentTime", {
        configurable: true,
        get() {
          return currentTimes.get(this as HTMLMediaElement) ?? 0;
        },
        set(value) {
          currentTimes.set(this as HTMLMediaElement, Number.isFinite(value) ? Number(value) : 0);
          (this as HTMLMediaElement).dispatchEvent(new Event("timeupdate"));
        },
      });
      Object.defineProperty(proto, "duration", {
        configurable: true,
        get() {
          return durations.get(this as HTMLMediaElement) ?? 0;
        },
      });
      Object.defineProperty(proto, "paused", {
        configurable: true,
        get() {
          return pausedStates.get(this as HTMLMediaElement) ?? true;
        },
      });
      Object.defineProperty(proto, "ended", {
        configurable: true,
        get() {
          return endedStates.get(this as HTMLMediaElement) ?? false;
        },
      });
      const finishPlayback = (media: StubMedia) => {
        if (media.__e2eTickTimer) {
          window.clearInterval(media.__e2eTickTimer);
          media.__e2eTickTimer = undefined;
        }
        media.__e2ePaused = true;
        media.__e2eEnded = true;
        media.__e2eCurrentTime = media.__e2eDuration ?? media.__e2eCurrentTime ?? 0;
        currentTimes.set(media, media.__e2eCurrentTime);
        durations.set(media, media.__e2eDuration ?? 0);
        pausedStates.set(media, true);
        endedStates.set(media, true);
        scope.__e2eAdvancingMediaState = {
          activeSource: `${media.currentSrc ?? media.src ?? ""}`,
          paused: true,
          ended: true,
          currentTime: media.__e2eCurrentTime,
          duration: media.__e2eDuration ?? 0,
          volume: media.volume,
        };
        media.dispatchEvent(new Event("timeupdate"));
        media.dispatchEvent(new Event("pause"));
        media.dispatchEvent(new Event("ended"));
      };
      const stopPlayback = (media: StubMedia, ended: boolean) => {
        if (media.__e2eTickTimer) {
          window.clearInterval(media.__e2eTickTimer);
          media.__e2eTickTimer = undefined;
        }
        media.__e2ePaused = true;
        media.__e2eEnded = ended;
        currentTimes.set(media, media.__e2eCurrentTime ?? 0);
        durations.set(media, media.__e2eDuration ?? 0);
        pausedStates.set(media, true);
        endedStates.set(media, ended);
        scope.__e2eAdvancingMediaState = {
          activeSource: `${(media as StubMedia & { currentSrc?: string; src?: string }).currentSrc ?? (media as StubMedia & { src?: string }).src ?? ""}`,
          paused: true,
          ended,
          currentTime: media.__e2eCurrentTime ?? 0,
          duration: media.__e2eDuration ?? 0,
          volume: media.volume,
        };
        media.dispatchEvent(new Event("pause"));
        if (ended) {
          media.dispatchEvent(new Event("ended"));
        }
      };
      proto.__e2eOriginalPlay = proto.play.bind(proto);
      proto.__e2eOriginalPause = proto.pause.bind(proto);
      proto.play = function playStub() {
        const media = this as StubMedia & {
          currentSrc?: string;
          src?: string;
        };
        stopPlayback(media, false);
        const source = `${media.currentSrc ?? media.src ?? ""}`.toLowerCase();
        const durationSeconds = (source.includes("cortina")
          ? Math.max(100, cortinaDuration)
          : Math.max(100, musicDuration)) / 1000;
        media.__e2eDuration = durationSeconds;
        media.__e2eCurrentTime = media.__e2eCurrentTime ?? 0;
        media.__e2ePaused = false;
        media.__e2eEnded = false;
        media.__e2eLastTickAt = performance.now();
        currentTimes.set(media, media.__e2eCurrentTime);
        durations.set(media, media.__e2eDuration);
        pausedStates.set(media, false);
        endedStates.set(media, false);
        media.dispatchEvent(new Event("loadedmetadata"));
        media.dispatchEvent(new Event("durationchange"));
        media.dispatchEvent(new Event("play"));
        media.dispatchEvent(new Event("timeupdate"));
        scope.__e2eAdvancingMediaState = {
          activeSource: `${media.currentSrc ?? media.src ?? ""}`,
          paused: false,
          ended: false,
          currentTime: media.__e2eCurrentTime ?? 0,
          duration: media.__e2eDuration ?? 0,
          volume: media.volume,
        };
        media.__e2eTickTimer = window.setInterval(() => {
          if (media.__e2ePaused) {
            return;
          }
          const now = performance.now();
          const elapsedSeconds = Math.max(
            0.02,
            ((now - (media.__e2eLastTickAt ?? now)) || 0) / 1000,
          );
          media.__e2eLastTickAt = now;
          media.__e2eCurrentTime = Math.min(
            media.__e2eDuration ?? 0,
            (media.__e2eCurrentTime ?? 0) + elapsedSeconds,
          );
          currentTimes.set(media, media.__e2eCurrentTime);
          durations.set(media, media.__e2eDuration ?? 0);
          pausedStates.set(media, false);
          endedStates.set(media, false);
          scope.__e2eAdvancingMediaState = {
            activeSource: `${media.currentSrc ?? media.src ?? ""}`,
            paused: false,
            ended: false,
            currentTime: media.__e2eCurrentTime ?? 0,
            duration: media.__e2eDuration ?? 0,
            volume: media.volume,
          };
          media.dispatchEvent(new Event("timeupdate"));
          if ((media.__e2eCurrentTime ?? 0) >= (media.__e2eDuration ?? 0)) {
            finishPlayback(media);
          }
        }, Math.max(20, tick));
        return Promise.resolve();
      };
      proto.pause = function pauseStub() {
        const media = this as StubMedia;
        stopPlayback(media, false);
      };
      scope.__e2eAdvancingMediaPatched = true;
    },
    { musicDuration: musicDurationMs, cortinaDuration: cortinaDurationMs, tick: tickMs },
  );
};

const installSlowCompressionRenderStub = async (page: Page, delayMs = 2_000) => {
  await page.evaluate((delay) => {
    const api = window.tanda as
      | (typeof window.tanda & {
          __e2eSlowCompressionPatched?: boolean;
          __e2eOriginalRenderCompressedTrack?: typeof window.tanda.renderCompressedTrack;
        })
      | undefined;
    if (!api || api.__e2eSlowCompressionPatched) {
      return;
    }
    api.__e2eOriginalRenderCompressedTrack = api.renderCompressedTrack;
    api.renderCompressedTrack = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, Math.max(50, delay)));
      return { ok: false, error: "e2e slow compression stub" };
    };
    api.__e2eSlowCompressionPatched = true;
  }, delayMs);
};

const configureImmediateClickPlaybackHarness = async (page: Page) => {
  await installDeterministicMediaStub(page);
  await installSlowCompressionRenderStub(page, 2_000);
  await page.evaluate(() => {
    localStorage.setItem("tanda-main-output", "default");
    localStorage.setItem("tanda-main-output-label", "Default");
    localStorage.removeItem("tanda-main-output-group");
    localStorage.removeItem("tanda-headphone-output");
    localStorage.removeItem("tanda-headphone-output-label");
    localStorage.removeItem("tanda-headphone-output-group");
    localStorage.setItem("tanda-audio-dynamics-enabled", "1");
    localStorage.setItem("tanda-audio-dynamics-depth", "60");
  });
};

const expectNowPlayingContainsSoon = async (
  page: Page,
  expectedToken: string,
  timeout = 500,
) => {
  await expect
    .poll(
      async () => ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
      { timeout },
    )
    .toContain(expectedToken.toLowerCase());
};

const startPlaylistAndExpectTrackSoon = async (
  page: Page,
  expectedToken: string,
  timeout = 15_000,
) => {
  await page.locator("#playlist-start").click({ force: true });
  await expect(page.locator("#playlist-stop")).toBeEnabled({ timeout: 5_000 });
  await expect(page.locator("#playlist-start")).toBeDisabled({ timeout: 5_000 });
  await expect
    .poll(
      async () =>
        await page.evaluate(() => {
          return (
            (window as Window & {
              __e2eRuntimeSnapshot?: {
                playlistStatus?: "idle" | "paused" | "playing";
                nowPlayingTrack?: string;
              };
            }).__e2eRuntimeSnapshot ?? null
          );
        }),
      { timeout },
    )
    .toMatchObject({
      playlistStatus: "playing",
    });
  await expectNowPlayingContainsSoon(page, expectedToken, timeout);
};

const dispatchExactClick = async (target: Locator) => {
  await target.evaluate((element) => {
    const node = element as HTMLElement;
    const view = node.ownerDocument.defaultView;
    if (!view) {
      node.click();
      return;
    }
    const eventInit: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view,
    };
    node.dispatchEvent(new view.MouseEvent("mousedown", eventInit));
    node.dispatchEvent(new view.MouseEvent("mouseup", eventInit));
    node.dispatchEvent(new view.MouseEvent("click", eventInit));
  });
};

const expectClickStartsTrackSoon = async (
  page: Page,
  clickTarget: Locator,
  expectedToken: string,
  timeout = 500,
) => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await expect(clickTarget).toBeAttached();
      await page.waitForTimeout(50);
      await clickTarget.scrollIntoViewIfNeeded();
      await dispatchExactClick(clickTarget);
      await expectNowPlayingContainsSoon(page, expectedToken, timeout);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) {
    throw lastError;
  }
};

const expectClickIgnoredWhileLiveActive = async (
  page: Page,
  clickTarget: Locator,
  expectedToken: string,
  timeout = 500,
) => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await expect(clickTarget).toBeAttached();
      await page.waitForTimeout(50);
      await clickTarget.scrollIntoViewIfNeeded();
      await dispatchExactClick(clickTarget);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) {
    throw lastError;
  }
  await page.waitForTimeout(timeout);
  await expectNowPlayingContainsSoon(page, expectedToken, 50);
};

const expectLiveStandaloneTrackPromptAndPlaySoon = async (
  page: Page,
  clickTarget: Locator,
  expectedToken: string,
  timeout = 500,
) => {
  let lastError: unknown = null;
  const confirmOk = page.locator(".confirm-modal:not(.hidden) .confirm-ok");
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await expect(clickTarget).toBeAttached();
      await page.waitForTimeout(50);
      await clickTarget.scrollIntoViewIfNeeded();
      await dispatchExactClick(clickTarget);
      try {
        await expect(confirmOk).toBeVisible({ timeout: 750 });
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        await page.waitForTimeout(200);
      }
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(100);
    }
  }
  if (lastError) {
    throw lastError;
  }
  await expect(confirmOk).toBeVisible();
  await confirmIfPrompted(page);
  await expectNowPlayingContainsSoon(page, expectedToken, timeout);
};

const ensureTandaRowExpanded = async (row: Locator) => {
  await expect(row).toBeVisible();
  await expect
    .poll(async () => {
      const expanded = await row.getAttribute("aria-expanded");
      if (expanded === "true") {
        return true;
      }
      const summary = row.locator(".tanda-summary").first();
      await expect(summary).toBeVisible();
      await dispatchExactClick(summary);
      return (await row.getAttribute("aria-expanded")) === "true";
    })
    .toBe(true);
};

const getExpandedTandaDetailLine = async (
  row: Locator,
  text: string,
) => {
  await ensureTandaRowExpanded(row);
  const detailLine = row.locator(".tanda-detail-line", { hasText: text }).first();
  await expect(detailLine).toBeAttached();
  return detailLine;
};

const clickDetailMenuUntilOpen = async (detailLine: Locator) => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await expect(detailLine).toBeAttached();
      const detailMenuButton = detailLine.locator('button[data-action="detail-menu"]').first();
      await expect(detailMenuButton).toBeAttached();
      await dispatchExactClick(detailMenuButton);
      await expect(detailLine).toHaveClass(/detail-menu-open/);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) {
    throw lastError;
  }
};

const prepareClickPlaybackFixtures = async (page: Page) => {
  await clearPlaylistViaUi(page);

  await page.locator('button[data-tab="clip-tracks"]').click();
  await selectClipboardCollection(page, "general");
  await page.locator('button[data-tab="search-tracks"]').click();
  await runSearch(page, "Alberto Gomez");
  await expect(searchTrackRow(page, "Alberto Gomez Tango Uno")).toBeVisible();
  await clickRowAction(searchTrackRow(page, "Alberto Gomez Tango Uno"), "add-playlist-track");
  await clickRowAction(searchTrackRow(page, "Alberto Gomez Tango Uno"), "add-clip");

  const customCollectionId = await createClipboardCollection(page, "Speed Test");
  await selectClipboardCollection(page, customCollectionId);
  await page.locator('button[data-tab="search-tracks"]').click();
  await runSearch(page, "Alberto Gomez");
  await expect(searchTrackRow(page, "Alberto Gomez Tango Dos")).toBeVisible();
  await clickRowAction(searchTrackRow(page, "Alberto Gomez Tango Dos"), "add-clip");

  await page.locator('button[data-tab="search-tandas"]').click();
  await runSearch(page, "Tango Trio");
  await expect(searchTandaRow(page, "Tango Trio")).toBeVisible();
  await selectClipboardCollection(page, "general");
  await clickRowAction(searchTandaRow(page, "Tango Trio"), "add-clip-tanda");
  await selectClipboardCollection(page, "general");
  await page.locator('button[data-tab="search-tandas"]').click();
  await clickRowAction(searchTandaRow(page, "Tango Trio"), "add-playlist-tanda");
  await confirmIfPrompted(page);

  await ensurePlaylistTab(page);
  const playlistSingleTrackRow = page.locator("#playlist-list .tanda-row").first();
  await expect(playlistSingleTrackRow).toBeVisible();
  await playlistSingleTrackRow.locator(".tanda-summary").first().click();
  const playlistSingleTrackDetail = playlistSingleTrackRow
    .locator(".tanda-detail-line", { hasText: "Alberto Gomez Tango Uno" })
    .first();
  await expect(playlistSingleTrackDetail).toBeVisible();
  const playlistTanda = playlistTandaRow(page, "Tango Trio");
  await expect(playlistTanda).toBeVisible();
  await playlistTanda.locator(".tanda-summary").first().click();
  const playlistTandaDetail = playlistTanda
    .locator(".tanda-detail-line", { hasText: "Alberto Gomez Tango Dos" })
    .first();
  await expect(playlistTandaDetail).toBeVisible();

  await selectClipboardCollection(page, "general");
  await page.locator('button[data-tab="clip-tandas"]').click();
  const clipboardTanda = clipboardTandaRow(page, "Tango Trio");
  await expect(clipboardTanda).toBeVisible();

  return {
    customCollectionId,
    locators: {
      clipboardGeneralTrack: clipboardTrackRow(page, "Alberto Gomez Tango Uno"),
      playlistTrack: playlistSingleTrackDetail,
    },
  };
};

const clickPlaylistTrackUntilNowPlaying = async (page: Page, track: Locator, expectedToken: string) => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await expect(track).toBeVisible();
      await track.scrollIntoViewIfNeeded();
      await track.click({ timeout: 5_000 });
      await expect
        .poll(
          async () => ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
          { timeout: 8_000 },
        )
        .toContain(expectedToken.toLowerCase());
      return;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) {
    throw lastError;
  }
};

test.describe("Electron app end-to-end workflows", () => {
  test("01 - shows empty-library banner on first run setup", async () => {
    const launched = await launchSeededApp("empty");
    const { page } = launched;
    try {
      await openSettings(page);
      await expect(page.locator("#root-list .root-row")).toHaveCount(0);
      await closeSettings(page);
    } finally {
      await launched.close();
    }
  });

  test("02 - shows seeded library roots in settings", async () => {
    const launched = await launchSeededApp("empty");
    const { page } = launched;
    try {
      await openSettings(page);
      await expect(page.locator("#root-list .root-row")).toHaveCount(3);
      await expect(page.locator("#root-list")).toContainText("music");
      await expect(page.locator("#root-list")).toContainText("cortinas");
      await closeSettings(page);
    } finally {
      await launched.close();
    }
  });

  test("03 - track search excludes cortina-root tracks", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await runSearch(page, "CORTINA ONLY TRACK");
      await expect(searchTrackRow(page, "CORTINA ONLY TRACK")).toHaveCount(0);
    } finally {
      await launched.close();
    }
  });

  test("04 - text search finds artist matches", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await runSearch(page, "Alberto Gomez");
      await expect(searchTrackRow(page, "Alberto Gomez Tango Uno")).toBeVisible();
    } finally {
      await launched.close();
    }
  });

  test("05 - year search finds matching tracks", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await runSearch(page, "1943");
      await expect(searchTrackRow(page, "Year 1943 Test")).toBeVisible();
    } finally {
      await launched.close();
    }
  });

  test("06 - bpm search range setting affects results", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await openSettings(page);
      await page.locator('button[data-tab="system"]').click();
      await page.locator("#search-bpm-range").fill("1");
      await closeSettings(page);
      await runSearch(page, "72");
      await expect(searchTrackRow(page, "Tempo 72 Test")).toBeVisible();
      await expect(page.locator("#search-tracks .track-row", { hasText: "Alberto Gomez Tango Uno" })).toHaveCount(0);
    } finally {
      await launched.close();
    }
  });

  test("07 - style pill filters track search", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await runSearch(page, "");
      await page.locator("#style-options button", { hasText: "Milonga" }).click();
      await expect(searchTrackRow(page, "Milonga de Prueba")).toBeVisible();
      await expect(page.locator("#search-tracks .track-row", { hasText: "Alberto Gomez Tango Uno" })).toHaveCount(0);
    } finally {
      await launched.close();
    }
  });

  test("08 - tanda search tab returns tanda rows", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Trio");
      await expect(searchTandaRow(page, "Tango Trio")).toBeVisible();
      await expect(searchTandaRow(page, "Milonga Trio")).toBeVisible();
    } finally {
      await launched.close();
    }
  });

  test("09 - search-track menu action opens track editor", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await runSearch(page, "Alberto Gomez Tango Uno");
      const row = searchTrackRow(page, "Alberto Gomez Tango Uno");
      await openTrackEditorFromRow(page, row);
      await page.locator("#track-editor-close").click();
      await confirmIfPrompted(page);
      await expect(page.locator("#track-editor")).toHaveAttribute("aria-hidden", "true");
    } finally {
      await launched.close();
    }
  });

  test("10 - search-track menu action builds similarity query", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await runSearch(page, "Busqueda Artistica");
      const row = searchTrackRow(page, "Busqueda Artistica");
      await clickRowAction(row, "search-track");
      const searchValue = (await page.locator("#search-input").inputValue()).toLowerCase();
      expect(
        searchValue.includes("arienzo") ||
          searchValue.includes("1941") ||
          searchValue.includes("64") ||
          searchValue.includes("busqueda artistica") ||
          searchValue.includes("search similar"),
      ).toBe(true);
    } finally {
      await launched.close();
    }
  });

  test("11 - search-track menu action adds track to clipboard", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await page.locator('button[data-tab="clip-tracks"]').click();
      await selectClipboardCollection(page, "general");
      await page.locator('button[data-tab="search-tracks"]').click();
      await runSearch(page, "Busqueda Artistica");
      const row = searchTrackRow(page, "Busqueda Artistica");
      await selectClipboardCollection(page, "general");
      await clickRowAction(row, "add-clip");
      await page.locator('button[data-tab="clip-tracks"]').click();
      await selectClipboardCollection(page, "general");
      await expect(clipboardTrackRow(page, "Busqueda Artistica")).toBeVisible();
    } finally {
      await launched.close();
    }
  });

  test("12 - search-track menu action adds track to playlist", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await runSearch(page, "Tempo 72 Test");
      const row = searchTrackRow(page, "Tempo 72 Test");
      await clickRowAction(row, "add-playlist-track");
      await confirmIfPrompted(page);
      await ensurePlaylistTab(page);
      const playlistRow = page.locator("#playlist-list .tanda-row").first();
      await expect(playlistRow).toBeVisible();
      await playlistRow.locator(".tanda-summary").first().click();
      await expect(
        playlistRow.locator(".tanda-detail-line", { hasText: "Tempo 72 Test" }).first(),
      ).toBeVisible();
    } finally {
      await launched.close();
    }
  });

  test("13 - search-track menu action adds track to tanda designer", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await addTrackToTandaDesigner(page, "Tempo 72 Test");
      await expect(page.locator('#tanda-designer-tab')).toHaveClass(/active/);
      await expect(page.locator("#tanda-list")).toContainText("Tempo 72 Test");
    } finally {
      await launched.close();
    }
  });

  test("14 - search-tanda edit action opens tanda in designer", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Tango Trio");
      const row = searchTandaRow(page, "Tango Trio");
      await expect(row).toBeVisible();
      await clickRowAction(row, "tanda-edit");
      await expect.poll(async () => await page.locator("#tanda-designer-tab").getAttribute("class")).toMatch(
        /active/,
      );
      await expect(page.locator("#tanda-list")).toContainText("Alberto Gomez Tango Uno");
    } finally {
      await launched.close();
    }
  });

  test("15 - search-tanda menu action adds tanda to clipboard", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Milonga Trio");
      const row = searchTandaRow(page, "Milonga Trio");
      await clickRowAction(row, "add-clip-tanda");
      await selectClipboardCollection(page, "general");
      await page.locator('button[data-tab="clip-tandas"]').click();
      await expect(clipboardTandaRow(page, "Milonga Trio")).toBeVisible();
    } finally {
      await launched.close();
    }
  });

  test("16 - search-tanda menu action adds tanda to playlist", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Waltz Trio");
      let row = searchTandaRow(page, "Waltz Trio");
      if ((await row.count()) === 0) {
        await runSearch(page, "Waltz");
        row = searchTandaRow(page, "Waltz Trio");
      }
      await expect(row).toBeVisible();
      await clickRowAction(row, "add-playlist-tanda");
      await confirmIfPrompted(page);
      await expect(playlistTandaRow(page, "Waltz Trio")).toBeVisible();
    } finally {
      await launched.close();
    }
  });

  test("17 - clipboard-track menu remove action removes track", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await runSearch(page, "Tempo 72 Test");
      await clickRowAction(searchTrackRow(page, "Tempo 72 Test"), "add-clip");
      await page.locator('button[data-tab="clip-tracks"]').click();
      await selectClipboardCollection(page, "general");
      const clipRow = clipboardTrackRow(page, "Tempo 72 Test");
      await expect(clipRow).toBeVisible();
      await clickRowAction(clipRow, "remove-clip");
      await expect(clipboardTrackRow(page, "Tempo 72 Test")).toHaveCount(0);
    } finally {
      await launched.close();
    }
  });

  test("18 - clipboard-tanda menu edit action opens tanda designer", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Tango Trio");
      await clickRowAction(searchTandaRow(page, "Tango Trio"), "add-clip-tanda");
      await selectClipboardCollection(page, "general");
      await page.locator('button[data-tab="clip-tandas"]').click();
      await page.locator("#clipboard-filter").fill("");
      const clipTanda = clipboardTandaRow(page, "Tango Trio");
      await clickRowAction(clipTanda, "tanda-edit");
      const editor = await waitForAnyEditorRows(page, 3);
      await expect(editor).toContainText("Alberto Gomez Tango Uno");
    } finally {
      await launched.close();
    }
  });

  test("19 - playlist clear shows modal in playlist tab", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await runSearch(page, "Tempo 72 Test");
      await clickRowAction(searchTrackRow(page, "Tempo 72 Test"), "add-playlist-track");
      await page.locator('button[data-tab="playlist-tab"]').click();
      await page.locator("#playlist-clear").click();
      await expect(page.locator(".playlist-clear-modal")).not.toHaveClass(/hidden/);
      await page.locator('.playlist-clear-modal .confirm-ok[data-option="clear"]').click();
      await expect(playlistTrackRow(page, "Tempo 72 Test")).toHaveCount(0);
    } finally {
      await launched.close();
    }
  });

  test("20 - playlist clear in designer tab resets drafts without modal", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await page.locator('button[data-tab="tanda-designer-tab"]').click();
      await expect(page.locator("#tanda-designer-tab")).toHaveClass(/active/);
      await addTrackToTandaDesigner(page, "Tempo 72 Test");
      await expect(page.locator("#tanda-list")).toContainText("Tempo 72 Test");
      await page.locator("#playlist-clear").click();
      await expect(page.locator(".playlist-clear-modal")).toHaveCount(0);
      await expect(page.locator("#tanda-list")).not.toContainText("Tempo 72 Test");
    } finally {
      await launched.close();
    }
  });

  test("21 - playlist-hosted tanda editor move buttons reorder without closing editor", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await clearPlaylistViaUi(page);
      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Tango Trio");
      await clickRowAction(searchTandaRow(page, "Tango Trio"), "add-playlist-tanda");
      await confirmIfPrompted(page);
      // Neutralize any active clipboard track selection, otherwise detail-line clicks
      // can be interpreted as "replace tanda slot" instead of playback.
      await page.locator('button[data-tab="clip-tandas"]').click();
      const anyClipTanda = page.locator("#clip-tandas .tanda-row").first();
      if ((await anyClipTanda.count()) > 0) {
        await anyClipTanda.click({ force: true });
      }
      await ensurePlaylistTab(page);
      const playlistRow = playlistTandaRow(page, "Tango Trio");
      await clickRowAction(playlistRow, "tanda-edit");
      const editor = await waitForPlaylistEditorRows(page, 3);

      await clickEditorTrackAction(editor, 1, "tanda-up");
      await waitForPlaylistEditorRows(page, 3);

      await clickEditorTrackAction(editor, 0, "tanda-down");
      await waitForPlaylistEditorRows(page, 3);
    } finally {
      await launched.close();
    }
  });

  test("22 - playlist header keeps clear button inside bounds", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      const header = page.locator(".playlist-header");
      const clear = page.locator("#playlist-clear");
      await expect(header).toBeVisible();
      await expect(clear).toBeVisible();

      const headerBox = await header.boundingBox();
      const clearBox = await clear.boundingBox();
      expect(headerBox).not.toBeNull();
      expect(clearBox).not.toBeNull();
      if (!headerBox || !clearBox) {
        return;
      }

      const clearRight = clearBox.x + clearBox.width;
      const headerRight = headerBox.x + headerBox.width;
      expect(clearRight).toBeLessThanOrEqual(headerRight + 1);
    } finally {
      await launched.close();
    }
  });

  test("23 - edited first playlist tanda persists after app restart", async () => {
    const launched = await launchSeededApp("full");
    const tempRoot = launched.tempRoot;
    let relaunched: Awaited<ReturnType<typeof relaunchSeededApp>> | null = null;
    try {
      const { page } = launched;
      await clearPlaylistViaUi(page);

      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Tango Trio");
      await clickRowAction(searchTandaRow(page, "Tango Trio"), "add-playlist-tanda");
      await ensurePlaylistTab(page);
      await expect(playlistTandaRow(page, "Tango Trio")).toBeVisible();

      await page.locator('button[data-tab="search-tracks"]').click();
      await runSearch(page, "Tempo 72 Test");
      await clickRowAction(searchTrackRow(page, "Tempo 72 Test"), "add-clip");

      const firstTanda = playlistTandaRow(page, "Tango Trio");
      await clickRowAction(firstTanda, "tanda-edit");
      const editor = await waitForAnyEditorRows(page, 2);

      await clickEditorTrackAction(editor, 1, "tanda-remove");
      const clipRow = clipboardTrackRow(page, "Tempo 72 Test");
      await expect(clipRow).toBeVisible();
      await clickRowAction(clipRow, "add-tanda");
      const updatedEditor = await waitForAnyEditorRows(page, 3);
      const activeTandaId = await updatedEditor
        .locator(".tanda-track-row")
        .first()
        .getAttribute("data-tanda-id");
      const doneButton =
        activeTandaId && activeTandaId.length > 0
          ? updatedEditor.locator(
              `button[data-action="tanda-done"][data-tanda-id="${activeTandaId}"]`,
            )
          : updatedEditor.locator('button[data-action="tanda-done"]');
      await doneButton.first().click();

      const editedFirstTanda = page.locator("#playlist-list .tanda-row").first();
      if (!(await editedFirstTanda.locator(".tanda-details").isVisible())) {
        await editedFirstTanda.locator(".tanda-summary").click();
      }
      await expect(editedFirstTanda).toContainText("Tempo 72 Test");

      await launched.close({ cleanup: false });
      relaunched = await relaunchSeededApp(tempRoot);
      const firstAfterRestart = relaunched.page.locator("#playlist-list .tanda-row").first();
      if (!(await firstAfterRestart.locator(".tanda-details").isVisible())) {
        await firstAfterRestart.locator(".tanda-summary").click();
      }
      await expect(firstAfterRestart).toContainText("Tempo 72 Test");
    } finally {
      if (relaunched) {
        await relaunched.close();
      } else {
        await launched.close();
      }
    }
  });

  test("24 - playlist export/import round-trip preserves a 4-hour tanda playlist", async () => {
    const launched = await launchSeededApp("full");
    const { page, tempRoot } = launched;
    try {
      const customSeed = (() => {
        const dataRoot = path.join(tempRoot, "data");
        const musicRoot = path.join(dataRoot, "music");
        const cortinaRoot = path.join(dataRoot, "cortinas");
        const backgroundRoot = path.join(dataRoot, "backgrounds");
        fs.mkdirSync(musicRoot, { recursive: true });
        fs.mkdirSync(cortinaRoot, { recursive: true });
        fs.mkdirSync(backgroundRoot, { recursive: true });
        const tracks = Array.from({ length: 50 }, (_, index) => {
          const trackId = `rt-${index + 1}`;
          const relativePath = `roundtrip/set-${String(index + 1).padStart(2, "0")}.mp3`;
          const fullPath = path.join(musicRoot, relativePath);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, "");
          const stat = fs.statSync(fullPath);
          return {
            id: trackId,
            root_id: "root-music",
            relative_path: relativePath,
            full_path: fullPath,
            file_hash: `hash-${trackId}`,
            file_size: stat.size,
            file_mtime_ms: stat.mtimeMs,
            title: `Roundtrip Track ${index + 1}`,
            artist: `Artist ${index + 1}`,
            artist_summary: `Artist ${index + 1}`,
            album: `Album ${Math.floor(index / 5) + 1}`,
            album_artist: `Artist ${index + 1}`,
            singer: "",
            year: `${1940 + (index % 10)}`,
            genre: index % 2 === 0 ? "Tango" : "Milonga",
            bpm: 60 + (index % 20),
            notes: `note ${index + 1}`,
            instrumental: index % 3 === 0 ? 1 : 0,
            duration_ms: 5 * 60 * 1000,
          } as const;
        });
        const tandas = tracks.map((track, index) => ({
          id: `td-rt-${index + 1}`,
          name: `Roundtrip Tanda ${String(index + 1).padStart(3, "0")}`,
          rating: (index % 5) + 1,
          instrumental: track.instrumental,
          tracks: [track.id],
          style: track.genre,
        }));
        return {
          roots: { musicRoot, cortinaRoot, backgroundRoot },
          styles: ["Tango", "Milonga"],
          tracks,
          tandas,
        };
      })();
      await page.evaluate(async (payload) => {
        await window.tanda?.seedE2eData(payload);
      }, customSeed);
      await page.reload();
      await page.waitForSelector("#search-input");
      const seededPlaylistState = {
        version: 2,
        items: customSeed.tandas.map((tanda) => ({
          kind: "tanda" as const,
          id: tanda.id,
          mismatch: "count",
          snapshot: {
            id: tanda.id,
            name: tanda.name,
            styles: [tanda.style],
            rating: tanda.rating,
            trackSlots: [...tanda.tracks],
            totalDurationMs: 5 * 60 * 1000,
          },
        })),
        cortinaAssignments: [],
      };
      await page.evaluate((state) => {
        localStorage.setItem("tanda-playlist-items", JSON.stringify(state));
      }, seededPlaylistState);
      await page.reload();
      await page.waitForSelector("#search-input");
      await ensurePlaylistTab(page);

      const beforeState = await getNormalizedStoredPlaylistState(page);
      expect(beforeState).not.toBeNull();
      const populatedItemCount = beforeState?.items.filter((item) => item !== null).length ?? 0;
      expect(populatedItemCount).toBe(50);
      const totalDurationMs =
        beforeState?.items.reduce((sum, item) => {
          if (!item || item.kind !== "tanda" || !item.snapshot) {
            return sum;
          }
          return sum + (item.snapshot.totalDurationMs ?? 0);
        }, 0) ?? 0;
      expect(totalDurationMs).toBeGreaterThanOrEqual(4 * 60 * 60 * 1000);

      const exportPath = path.join(tempRoot, "playlist-roundtrip.json");
      await configureE2eDialogResponses(page, { saveFilePaths: [exportPath] });
      await openSettings(page);
      await page.locator('button[data-tab="playlist"]').click();
      await page.locator("#playlist-save-button").click();
      await expect(page.locator("#playlist-transfer-result")).toContainText("playlist-roundtrip.json");
      await closeSettings(page);
      expect(fs.existsSync(exportPath)).toBe(true);
      const exported = JSON.parse(fs.readFileSync(exportPath, "utf-8")) as {
        items?: Array<
          | { kind: "track"; track?: { fullPath?: string; relativePath?: string } }
          | { kind: "tanda"; trackRefs?: Array<{ fullPath?: string; relativePath?: string } | null> }
          | null
        >;
      };
      expect(Array.isArray(exported.items)).toBe(true);
      expect(exported.items?.filter((item) => item !== null).length ?? 0).toBe(50);
      exported.items?.forEach((item) => {
        if (!item || item.kind !== "tanda") {
          return;
        }
        expect(item.trackRefs?.every((trackRef) => trackRef === null || (Boolean(trackRef.fullPath) && Boolean(trackRef.relativePath)))).toBe(true);
      });

      await clearPlaylistViaUi(page);
      await expect(page.locator("#playlist-list .tanda-row")).toHaveCount(0);

      await configureE2eDialogResponses(page, { openFilePaths: [exportPath] });
      await openSettings(page);
      await page.locator('button[data-tab="playlist"]').click();
      await page.locator("#playlist-import-button").click();
      const importResult = page.locator("#playlist-transfer-result");
      await expect(importResult).toContainText("Imported");
      await expect(importResult).not.toContainText("Imported 0 items");
      await closeSettings(page);

      await expect
        .poll(async () => await getNormalizedStoredPlaylistState(page))
        .toEqual(beforeState);
    } finally {
      await launched.close();
    }
  });

  test("24 - available collection updates by artist+style and restores after playlist removal, with graph data", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await ensurePlaylistTab(page);
      await page.locator("#playlist-clear").click();
      await page.locator('.playlist-clear-modal .confirm-ok[data-option="clear"]').click();
      await expect(page.locator("#playlist-list .tanda-row")).toHaveCount(0);

      await selectClipboardCollection(page, "available");
      await page.locator('button[data-tab="clip-tandas"]').click();

      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Canaro");
      const canaroMilonga = searchTandaRow(page, "Canaro Milonga Pack A");
      const canaroMilongaVariant = searchTandaRow(page, "Canaro Milonga Pack B");
      const canaroTango = searchTandaRow(page, "Canaro Tango Pack");
      await expect(canaroMilonga).toBeVisible();
      await expect(canaroMilongaVariant).toBeVisible();
      await expect(canaroTango).toBeVisible();

      await clickRowAction(canaroMilonga, "add-playlist-tanda");
      await confirmIfPrompted(page);
      await ensurePlaylistTab(page);
      await expect(playlistTandaRow(page, "Canaro Milonga Pack A")).toBeVisible();

      await selectClipboardCollection(page, "available");
      await page.locator('button[data-tab="clip-tandas"]').click();
      await expect(clipboardTandaRow(page, "Canaro Milonga Pack B")).toHaveCount(0);
      await expect(clipboardTandaRow(page, "Canaro Tango Pack")).toBeVisible();

      await clickRowAction(searchTandaRow(page, "Canaro Tango Pack"), "add-playlist-tanda");
      await confirmIfPrompted(page);
      await ensurePlaylistTab(page);
      await expect(playlistTandaRow(page, "Canaro Tango Pack")).toBeVisible();

      await page.locator("#playlist-stats").click();
      await expect(page.locator("#playlist-stats-modal")).toHaveAttribute("aria-hidden", "false");
      await expect(page.locator("#playlist-stats-orchestra")).toContainText("Canaro");
      await expect(page.locator("#playlist-stats-year .mini-chart-item")).not.toHaveCount(0);
      await expect(page.locator("#playlist-stats-year")).toContainText("1937");
      await expect(page.locator("#playlist-stats-tempo .mini-chart-item")).not.toHaveCount(0);
      await expect(page.locator("#playlist-stats-tempo")).toContainText("72");
      await page
        .locator("#playlist-stats-orchestra .mini-chart-item.orchestra-item", { hasText: "Canaro" })
        .first()
        .click();
      await expect(page.locator("#playlist-stats-modal")).toHaveAttribute("aria-hidden", "true");
      await expect(page.locator('button[data-tab="playlist-tab"]')).toHaveClass(/active/);
      await expect(page.locator("#playlist-filter")).toHaveValue(/Canaro/i);

      const milongaRow = playlistTandaRow(page, "Canaro Milonga Pack A");
      await clickRowAction(milongaRow, "send-playlist-tanda");
      await expect(playlistTandaRow(page, "Canaro Milonga Pack A")).toHaveCount(0);

      await selectClipboardCollection(page, "available");
      await page.locator('button[data-tab="clip-tandas"]').click();
      await expect(clipboardTandaRow(page, "Canaro Milonga Pack B")).toBeVisible();
    } finally {
      await launched.close();
    }
  });

  test("25 - prep mode playlist track click plays selected track directly", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await installDeterministicMediaStub(page);
      await page.evaluate(() => {
        localStorage.setItem("tanda-main-output", "default");
        localStorage.setItem("tanda-main-output-label", "Default");
        localStorage.removeItem("tanda-main-output-group");
        localStorage.removeItem("tanda-headphone-output");
        localStorage.removeItem("tanda-headphone-output-label");
        localStorage.removeItem("tanda-headphone-output-group");
      });
      await page.locator("#mode-select").selectOption("prep");
      await clearPlaylistViaUi(page);

      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Tango Trio");
      await clickRowAction(searchTandaRow(page, "Tango Trio"), "add-playlist-tanda");
      await runSearch(page, "Canaro Milonga Pack A");
      await clickRowAction(searchTandaRow(page, "Canaro Milonga Pack A"), "add-playlist-tanda");
      await confirmIfPrompted(page);
      await ensurePlaylistTab(page);
      const playlistRow = playlistTandaRow(page, "Tango Trio");
      await expect(playlistRow).toBeVisible();
      await playlistRow.locator(".tanda-summary").first().click();

      const detailLine = playlistRow
        .locator(".tanda-detail-line", { hasText: "Alberto Gomez Tango Dos" })
        .first();
      await expect
        .poll(async () => await detailLine.count(), { timeout: 10_000 })
        .toBeGreaterThan(0);
      await clickPlaylistTrackUntilNowPlaying(page, detailLine, "Tango Dos");

      const secondTandaRow = playlistTandaRow(page, "Canaro Milonga Pack A");
      await expect(secondTandaRow).toBeVisible();
      await secondTandaRow.locator(".tanda-summary").first().click();
      const secondTandaFirstTrack = secondTandaRow
        .locator(".tanda-detail-line")
        .filter({ hasText: "Canaro Milonga Uno" })
        .first();
      await expect
        .poll(async () => await secondTandaFirstTrack.count(), { timeout: 10_000 })
        .toBeGreaterThan(0);
      await clickPlaylistTrackUntilNowPlaying(page, secondTandaFirstTrack, "Milonga Uno");
    } finally {
      await launched.close();
    }
  });

  test("26 - smart collections new/top/least/available and top reflects tanda play counts", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      for (const collectionId of ["new", "top", "least", "available"]) {
        const tab = page.locator(
          `#clipboard-collections-tabs button[data-collection-id="${collectionId}"]`,
        );
        await expect(tab).toBeVisible();
        await tab.click();
        await expect(tab).toHaveClass(/active/);
      }

      await selectClipboardCollection(page, "available");
      await page.locator('button[data-tab="clip-tandas"]').click();
      await expect(page.locator("#clip-tandas .tanda-row")).not.toHaveCount(0);

      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Tango Trio");
      await clickRowAction(searchTandaRow(page, "Tango Trio"), "add-playlist-tanda");
      await ensurePlaylistTab(page);
      await expect(playlistTandaRow(page, "Tango Trio")).toBeVisible();

      await selectClipboardCollection(page, "top");
      await page.locator('button[data-tab="clip-tandas"]').click();
      await expect(page.locator("#clip-tandas .tanda-row")).not.toHaveCount(0);

      const playedTanda = await page.evaluate(async () => {
        const tandas = (await window.tanda?.listTandas?.()) ?? [];
        const target = tandas.find((row) => row.name === "Tango Trio") ?? tandas[0] ?? null;
        if (!target) {
          return null;
        }
        const key = "tanda-play-counts";
        const next = {
          tracks: {},
          tandas: { [target.id]: 999 },
        };
        localStorage.setItem(key, JSON.stringify(next));
        return { id: target.id, name: target.name };
      });
      expect(playedTanda).not.toBeNull();
      await page.reload();
      await page.waitForSelector("#search-input");
      await selectClipboardCollection(page, "top");
      await page.locator('button[data-tab="clip-tandas"]').click();
      await expect(clipboardTandaRow(page, playedTanda?.name ?? "Tango Trio")).toBeVisible();
    } finally {
      await launched.close();
    }
  });

  test("27 - search diversity modal opens and uses graph icon styling", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      const playlistIconPath = page.locator("#playlist-stats svg rect").first();
      const searchIconPath = page.locator("#search-diversity svg rect").first();
      await expect(playlistIconPath).toBeVisible();
      await expect(searchIconPath).toBeVisible();

      await page.locator("#search-diversity").click();
      await expect(page.locator("#search-diversity-modal")).toHaveAttribute("aria-hidden", "false");
      await expect(page.locator("#search-diversity-orchestra table")).toBeVisible();
      await page.locator("#search-diversity-close").click();
      await expect(page.locator("#search-diversity-modal")).toHaveAttribute("aria-hidden", "true");
    } finally {
      await launched.close();
    }
  });

  test("28 - style variants rename pill, apply exact filtering, and tanda multi-style badge", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await openSettings(page);
      await page.locator('button[data-tab="library"]').click();
      await page.locator("#style-family-code-input").fill("T");
      await page.locator("#style-family-base-input").fill("Tango");
      await page.locator("#style-family-variants-input").fill("Modern,Nuevo");
      await page.locator("#style-family-add").click();
      await page.locator("#style-family-code-input").fill("M");
      await page.locator("#style-family-base-input").fill("Milonga");
      await page.locator("#style-family-variants-input").fill("");
      await page.locator("#style-family-add").click();
      await page.locator("#style-family-code-input").fill("O");
      await page.locator("#style-family-base-input").fill("Other");
      await page.locator("#style-family-variants-input").fill("");
      await page.locator("#style-family-add").click();
      await closeSettings(page);

      await runSearch(page, "Tempo 72 Test");
      await clickRowAction(searchTrackRow(page, "Tempo 72 Test"), "edit-track");
      await expect(page.locator("#track-editor")).toHaveAttribute("aria-hidden", "false");
      await page.locator("#track-editor-genre").selectOption({ label: "Tango - Nuevo" });
      await page.locator("#track-editor-save").click();
      await closeTrackEditorIfOpen(page);

      await runSearch(page, "");
      const tangoPill = page.locator("#style-options button", { hasText: "Tango" }).first();
      await tangoPill.dispatchEvent("mousedown", { button: 0 });
      await page.waitForTimeout(1100);
      await tangoPill.dispatchEvent("mouseup", { button: 0 });
      await expect(page.locator(".style-variant-menu")).toBeVisible();
      await page.locator(".style-variant-menu-item", { hasText: "Nuevo" }).click();

      const variantPill = page.locator("#style-options button", { hasText: "T - Nuevo" }).first();
      await expect(variantPill).toBeVisible();
      await expect(variantPill).toHaveClass(/active/);
      await expect.poll(async () => await searchTrackRow(page, "Tempo 72 Test").count()).toBeGreaterThan(0);
      await expect.poll(async () => await searchTrackRow(page, "Alberto Gomez Tango Uno").count()).toBe(0);

      await clickRowAction(searchTrackRow(page, "Tempo 72 Test"), "edit-track");
      await expect(page.locator("#track-editor-genre option", { hasText: "Tango - Nuevo" })).toHaveCount(1);
      await closeTrackEditorIfOpen(page);

      await variantPill.click();
      await expect(
        page.locator("#style-options button.active", { hasText: "T - Nuevo" }),
      ).toHaveCount(0);
      await expect.poll(async () => await searchTrackRow(page, "Alberto Gomez Tango Uno").count()).toBeGreaterThan(0);

      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Tango Trio");
      await clickRowAction(searchTandaRow(page, "Tango Trio"), "tanda-edit");
      const selectedCard = page.locator("#tanda-list .tanda-card.selected").first();
      await expect(selectedCard).toBeVisible();
      let appliedSecondaryStyle = false;
      for (const label of ["Milonga", "Waltz", "Other"]) {
        const styleButton = selectedCard
          .locator(".tanda-style-options button", { hasText: label })
          .first();
        if ((await styleButton.count()) === 0) {
          continue;
        }
        await styleButton.click();
        appliedSecondaryStyle = true;
        break;
      }
      expect(appliedSecondaryStyle).toBe(true);
      await selectedCard.locator('button[data-action="tanda-clip"]').first().click();

      await page.locator('button[data-tab="clip-tandas"]').click();
      const clipboardRow = clipboardTandaRow(page, "Tango Trio");
      await expect(clipboardRow).toBeVisible();
      await expect(clipboardRow.locator(".tanda-style-badge")).toContainText("+");
    } finally {
      await launched.close();
    }
  });

  test("29 - track editor style search uses exact style pills and filters results", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await openSettings(page);
      await page.locator('button[data-tab="library"]').click();
      await page.locator("#style-family-code-input").fill("T");
      await page.locator("#style-family-base-input").fill("Tango");
      await page.locator("#style-family-variants-input").fill("Traditional,Alternative,Nuevo");
      await page.locator("#style-family-add").click();
      await closeSettings(page);

      await runSearch(page, "Tempo 72 Test");
      await clickRowAction(searchTrackRow(page, "Tempo 72 Test"), "edit-track");
      await expect(page.locator("#track-editor")).toHaveAttribute("aria-hidden", "false");
      await page.locator("#track-editor-genre").selectOption({ label: "Tango - Traditional" });
      await page.locator("#track-editor-save").click();
      await closeTrackEditorIfOpen(page);
      await clickRowAction(searchTrackRow(page, "Tempo 72 Test"), "edit-track");
      await expect(page.locator("#track-editor")).toHaveAttribute("aria-hidden", "false");
      await page.locator(
        'button.track-editor-search-field[data-track-editor-search-field="genre"]',
      ).click();

      await expect(page.locator("#search-input")).toHaveValue("Tempo 72 Test");
      const traditionalPill = page.locator("#style-options button", { hasText: "T - Traditional" }).first();
      await expect(traditionalPill).toBeVisible();
      await expect(traditionalPill).toHaveClass(/active/);
      await expect.poll(async () => await searchTrackRow(page, "Tempo 72 Test").count()).toBeGreaterThan(0);
      await expect.poll(async () => await searchTrackRow(page, "Alberto Gomez Tango Uno").count()).toBe(0);
    } finally {
      await launched.close();
    }
  });

  test("30 - search-tanda T action opens designer without changing current search", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await runSearch(page, "Tango Trio");
      await page.locator('button[data-tab="search-tandas"]').click();
      await expect(searchTandaRow(page, "Tango Trio")).toBeVisible();
      await clickRowAction(searchTandaRow(page, "Tango Trio"), "tanda-edit");
      await expect(page.locator('button[data-tab="tanda-designer-tab"]')).toHaveClass(/active/);
      await expect(page.locator("#search-input")).toHaveValue("Tango Trio");
      await expect(searchTandaRow(page, "Tango Trio")).toBeVisible();
    } finally {
      await launched.close();
    }
  });

  test("31 - style search tanda routes correctly to designer, clipboard collections, and playlist", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      const customCollectionId = await createClipboardCollection(page, "User Picks");

      await page.locator("#style-options button", { hasText: "Milonga" }).first().click();
      await expect(searchTrackRow(page, "Milonga de Prueba")).toBeVisible();

      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Milonga Trio");
      const tandaRow = searchTandaRow(page, "Milonga Trio");
      await expect(tandaRow).toBeVisible();

      await clickRowAction(tandaRow, "tanda-edit");
      await expect.poll(async () => await page.locator("#tanda-designer-tab").getAttribute("class")).toMatch(
        /active/,
      );
      await expect(page.locator("#tanda-list .tanda-card.selected").first()).toBeVisible();

      await selectClipboardCollection(page, "general");
      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Milonga Trio");
      await clickRowAction(searchTandaRow(page, "Milonga Trio"), "add-clip-tanda");
      await expect.poll(async () => await clipboardCollectionTandaIds(page, "general")).toContain("td2");
      await page.locator('button[data-tab="clip-tandas"]').click();
      await expect(clipboardTandaRow(page, "Milonga Trio")).toBeVisible();

      await selectClipboardCollection(page, customCollectionId);
      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Canaro Milonga Pack A");
      await clickRowAction(searchTandaRow(page, "Canaro Milonga Pack A"), "add-clip-tanda");
      await expect.poll(async () => await clipboardCollectionTandaIds(page, customCollectionId)).toContain("td5");
      await page.locator('button[data-tab="clip-tandas"]').click();
      await expect(clipboardTandaRow(page, "Canaro Milonga Pack A")).toBeVisible();

      await selectClipboardCollection(page, "top");
      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Canaro Milonga Pack B");
      await clickRowAction(searchTandaRow(page, "Canaro Milonga Pack B"), "add-clip-tanda");
      await expect.poll(async () => await clipboardCollectionTandaIds(page, "top")).not.toContain("td6");
      await expect.poll(async () => await clipboardCollectionTandaIds(page, "general")).toContain("td6");
      await selectClipboardCollection(page, "general");
      await page.locator('button[data-tab="clip-tandas"]').click();
      await expect(clipboardTandaRow(page, "Canaro Milonga Pack B")).toBeVisible();

      await openSettings(page);
      await page.locator('button[data-tab="playlist"]').click();
      await page.locator("#playlist-sequence").fill("3m 3t 3w 3t 3t 3m");
      await page.locator("#playlist-sequence").blur();
      await closeSettings(page);

      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Milonga Trio");
      await clickRowAction(searchTandaRow(page, "Milonga Trio"), "add-playlist-tanda");
      await page.locator('button[data-tab="playlist-tab"]').click();
      await expect(playlistTandaRow(page, "Milonga Trio")).toBeVisible();
    } finally {
      await launched.close();
    }
  });

  test("32 - clipboard move action moves tracks and tandas via direct and picker targets", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      const collectionName = `Favourites ${Date.now()}`;
      await selectClipboardCollection(page, "general");
      await page.locator("#clipboard-filter").fill("");
      await runSearch(page, "Busqueda Artistica");
      await clickRowAction(searchTrackRow(page, "Busqueda Artistica"), "add-clip");
      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Tango Trio");
      await clickRowAction(searchTandaRow(page, "Tango Trio"), "add-clip-tanda");

      await selectClipboardCollection(page, "general");
      await page.locator('button[data-tab="clip-tracks"]').click();
      await page.locator("#clipboard-filter").fill("");
      await expect(clipboardTrackRow(page, "Busqueda Artistica")).toBeVisible();
      await clickRowAction(clipboardTrackRow(page, "Busqueda Artistica"), "move-clip-track-collection");
      await expect(page.locator(".style-variant-menu")).toHaveCount(0);
      await expect(clipboardTrackRow(page, "Busqueda Artistica")).toBeVisible();

      await page.locator('button[data-tab="clip-tandas"]').click();
      await page.locator("#clipboard-filter").fill("");
      await expect(clipboardTandaRow(page, "Tango Trio")).toBeVisible();
      await clickRowAction(clipboardTandaRow(page, "Tango Trio"), "move-clip-tanda-collection");
      await expect(page.locator(".style-variant-menu")).toHaveCount(0);
      await expect(clipboardTandaRow(page, "Tango Trio")).toBeVisible();

      await page.locator("#clipboard-collection-name").fill(collectionName);
      await page.locator("#clipboard-collection-add").click();
      const createdCollectionTab = page
        .locator("#clipboard-collections-tabs button", { hasText: collectionName })
        .first();
      await expect(createdCollectionTab).toBeVisible();
      const createdCollectionId = await createdCollectionTab.getAttribute("data-collection-id");
      expect(createdCollectionId).toBeTruthy();
      const targetCollectionId = createdCollectionId ?? "";

      await selectClipboardCollection(page, "general");
      await page.locator('button[data-tab="clip-tracks"]').click();
      await page.locator("#clipboard-filter").fill("");
      await clickRowAction(clipboardTrackRow(page, "Busqueda Artistica"), "move-clip-track-collection");
      const moveMenu = page.locator(".style-variant-menu");
      if ((await moveMenu.count()) > 0) {
        await expect(moveMenu).toBeVisible();
        await page.locator(".style-variant-menu-item", { hasText: collectionName }).click();
      }
      await selectClipboardCollection(page, targetCollectionId);
      await page.locator('button[data-tab="clip-tracks"]').click();
      await page.locator("#clipboard-filter").fill("");
      await expect(clipboardTrackRow(page, "Busqueda Artistica")).toBeVisible();
      await selectClipboardCollection(page, "general");
      await page.locator('button[data-tab="clip-tracks"]').click();
      await page.locator("#clipboard-filter").fill("");
      await expect(clipboardTrackRow(page, "Busqueda Artistica")).toHaveCount(0);

      await page.locator('button[data-tab="clip-tandas"]').click();
      await page.locator("#clipboard-filter").fill("");
      await clickRowAction(clipboardTandaRow(page, "Tango Trio"), "move-clip-tanda-collection");
      const tandaMoveMenu = page.locator(".style-variant-menu");
      if ((await tandaMoveMenu.count()) > 0) {
        await expect(tandaMoveMenu).toBeVisible();
        await page.locator(".style-variant-menu-item", { hasText: collectionName }).click();
      }
      await selectClipboardCollection(page, targetCollectionId);
      await page.locator('button[data-tab="clip-tandas"]').click();
      await page.locator("#clipboard-filter").fill("");
      await expect(clipboardTandaRow(page, "Tango Trio")).toBeVisible();
      await selectClipboardCollection(page, "general");
      await page.locator('button[data-tab="clip-tandas"]').click();
      await page.locator("#clipboard-filter").fill("");
      await expect(clipboardTandaRow(page, "Tango Trio")).toHaveCount(0);
    } finally {
      await launched.close();
    }
  });

  test("33 - playlist continues across prep/live mode switch mid-playback", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await installAutoEndingMediaStub(page, 1200);
      await page.locator("#mode-select").selectOption("prep");
      await clearPlaylistViaUi(page);

      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Tango Trio");
      await clickRowAction(searchTandaRow(page, "Tango Trio"), "add-playlist-tanda");
      await confirmIfPrompted(page);
      await ensurePlaylistTab(page);
      const playlistRow = playlistTandaRow(page, "Tango Trio");
      await expect(playlistRow).toBeVisible();
      await playlistRow.locator(".tanda-summary").first().click();
      const firstDetailLine = playlistRow
        .locator(".tanda-detail-line", { hasText: "Alberto Gomez Tango Uno" })
        .first();
      await expect
        .poll(async () => await firstDetailLine.count(), { timeout: 10_000 })
        .toBeGreaterThan(0);
      await clickPlaylistTrackUntilNowPlaying(page, firstDetailLine, "tango uno");

      await page.locator("#mode-select").selectOption("live");
      await expect
        .poll(
          async () => ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
          { timeout: 15_000 },
        )
        .toContain("tango dos");
    } finally {
      await launched.close();
    }
  });

  test("34 - display keeps farewell headline after final cortina completes", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await installAutoEndingMediaStub(page, 250);

      await page.locator("#mode-select").selectOption("live");
      await openSettings(page);
      await page.locator('button[data-tab="playlist"]').click();
      await page.locator("#gap-between-tracks").fill("0");
      await page.locator("#gap-before-tanda").fill("0");
      await page.locator("#gap-before-cortina").fill("0");
      await page.locator("#stop-fade-duration").fill("0");
      await page.locator("#playlist-cortina-duration").fill("1");
      const setValue = await waitForFirstNamedCortinaSetValue(page);
      await page.locator("#playlist-cortina-set").selectOption(setValue);
      await closeSettings(page);

      await clearPlaylistViaUi(page);
      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Tango Trio");
      await clickRowAction(searchTandaRow(page, "Tango Trio"), "add-playlist-tanda");
      await ensurePlaylistTab(page);
      await expect(playlistTandaRow(page, "Tango Trio")).toBeVisible();
      await page.locator("#playlist-last-tanda").check();
      await page.locator("#playlist-last-tanda-count").fill("0");
      await page.evaluate(() => {
        localStorage.setItem("tanda-playlist-current-last", "1");
        localStorage.setItem("tanda-playlist-current-last-count", "0");
      });
      await expect(page.locator("#playlist-last-tanda")).toBeChecked();
      await page.locator("#open-display").click();
      await expect
        .poll(
          async () =>
            await page.evaluate(async () => {
              if (!window.tanda?.getDisplayStatus) {
                return false;
              }
              const status = await window.tanda.getDisplayStatus();
              return status.open;
            }),
          { timeout: 10_000 },
        )
        .toBe(true);

      await page.locator("#playlist-start").click();
      await expect(page.locator("#playlist-stop")).toBeEnabled({ timeout: 10_000 });
      await expect(page.locator("#playlist-start")).toBeEnabled({ timeout: 20_000 });

      const farewellState = await page.evaluate(() => {
        const expected =
          (
            (window as unknown as {
              tanda?: { t?: (key: string, fallback?: string) => string };
            }).tanda?.t?.("displayNoMoreTandas", "That's all folks")
          ) ?? "That's all folks";
        const normalize = (value: string) =>
          value
            .toLowerCase()
            .replace(/[\u2018\u2019']/g, "")
            .replace(/\s+/g, " ")
            .trim();
        const snapshot = (
          window as Window & {
            __e2eDisplaySnapshot?: { title?: string };
          }
        ).__e2eDisplaySnapshot;
        const titleNorm = normalize(snapshot?.title ?? "");
        const expectedNorm = normalize(expected);
        const matched =
          titleNorm === expectedNorm ||
          titleNorm.includes("all folks") ||
          titleNorm.includes("todo, amigos") ||
          titleNorm.includes("tout, les amis");
        return { matched, title: snapshot?.title ?? "" };
      });
      expect(farewellState.matched).toBe(true);
      await expect
        .poll(
          async () =>
            await page.evaluate(async () => {
              const normalize = (value: string) =>
                value
                  .toLowerCase()
                  .replace(/[\u2018\u2019']/g, "")
                  .replace(/\s+/g, " ")
                  .trim();
              const expected =
                (
                  (window as unknown as {
                    tanda?: { t?: (key: string, fallback?: string) => string };
                  }).tanda?.t?.("displayNoMoreTandas", "That's all folks")
                ) ?? "That's all folks";
              if (!window.tanda?.getDisplayStatus) {
                return false;
              }
              const status = await window.tanda.getDisplayStatus();
              if (!status.open) {
                return false;
              }
              const titleNorm = normalize(status.lastPayload?.title ?? "");
              const expectedNorm = normalize(expected);
              return (
                titleNorm === expectedNorm ||
                titleNorm.includes("all folks") ||
                titleNorm.includes("todo, amigos") ||
                titleNorm.includes("tout, les amis")
              );
            }),
          { timeout: 10_000 },
        )
        .toBe(true);
    } finally {
      await launched.close();
    }
  });

  test("37 - lead-in cortina display shows the clicked tanda style, not the following tanda", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await installAutoEndingMediaStub(page, 1200);

      await page.locator("#mode-select").selectOption("live");
      await openSettings(page);
      await page.locator('button[data-tab="playlist"]').click();
      await page.locator("#gap-between-tracks").fill("0");
      await page.locator("#gap-before-tanda").fill("0");
      await page.locator("#gap-before-cortina").fill("0");
      await page.locator("#playlist-cortina-duration").fill("2");
      const setValue = await waitForFirstNamedCortinaSetValue(page);
      await page.locator("#playlist-cortina-set").selectOption(setValue);
      await closeSettings(page);

      await clearPlaylistViaUi(page);
      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Tango Trio");
      await clickRowAction(searchTandaRow(page, "Tango Trio"), "add-playlist-tanda");
      await confirmIfPrompted(page);
      await runSearch(page, "Milonga Trio");
      await clickRowAction(searchTandaRow(page, "Milonga Trio"), "add-playlist-tanda");
      await confirmIfPrompted(page);
      await runSearch(page, "Waltz Trio");
      await clickRowAction(searchTandaRow(page, "Waltz Trio"), "add-playlist-tanda");
      await confirmIfPrompted(page);

      await ensurePlaylistTab(page);
      const milongaRow = playlistTandaRow(page, "Milonga Trio");
      await expect(milongaRow).toBeVisible();
      await milongaRow.locator(".tanda-summary").first().click();

      await page.locator("#open-display").click();
      await expect
        .poll(
          async () =>
            await page.evaluate(async () => {
              if (!window.tanda?.getDisplayStatus) {
                return false;
              }
              const status = await window.tanda.getDisplayStatus();
              return status.open;
            }),
          { timeout: 10_000 },
        )
        .toBe(true);

      await expectClickStartsTrackSoon(
        page,
        await getExpandedTandaDetailLine(milongaRow, "Milonga de Prueba"),
        "milonga de prueba",
        5_000,
      );
      await expect
        .poll(
          async () =>
            await page.evaluate(async () => {
              if (!window.tanda?.getDisplayStatus) {
                return "";
              }
              const status = await window.tanda.getDisplayStatus();
              const title = (status.lastPayload?.title ?? "").toLowerCase();
              const artist = (status.lastPayload?.artist ?? "").toLowerCase();
              return `${title} | ${artist}`;
            }),
          { timeout: 10_000 },
        )
        .toContain("milonga");
      await expect
        .poll(
          async () =>
            await page.evaluate(async () => {
              if (!window.tanda?.getDisplayStatus) {
                return "";
              }
              const status = await window.tanda.getDisplayStatus();
              return (status.lastPayload?.artist ?? "").toLowerCase();
            }),
          { timeout: 10_000 },
        )
        .not.toContain("waltz");
    } finally {
      await launched.close();
    }
  });

  test("38 - track clicks start within half a second in prep across search, clipboard, and playlist surfaces", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await configureImmediateClickPlaybackHarness(page);
      await page.locator("#mode-select").selectOption("prep");
      const { customCollectionId, locators } = await prepareClickPlaybackFixtures(page);

      await page.locator('button[data-tab="search-tracks"]').click();
      await runSearch(page, "Alberto Gomez");
      await expectClickStartsTrackSoon(
        page,
        searchTrackRow(page, "Alberto Gomez Tango Uno"),
        "tango uno",
      );

      await page.locator('button[data-tab="search-tandas"]').click();
      await expectClickStartsTrackSoon(
        page,
        await getExpandedTandaDetailLine(searchTandaRow(page, "Tango Trio"), "Alberto Gomez Tango Dos"),
        "tango dos",
      );

      await selectClipboardCollection(page, "general");
      await page.locator('button[data-tab="clip-tracks"]').click();
      await expectClickStartsTrackSoon(
        page,
        clipboardTrackRow(page, "Alberto Gomez Tango Uno"),
        "tango uno",
      );

      await selectClipboardCollection(page, customCollectionId);
      await page.locator('button[data-tab="clip-tracks"]').click();
      await expectClickStartsTrackSoon(
        page,
        clipboardTrackRow(page, "Alberto Gomez Tango Dos"),
        "tango dos",
      );

      await selectClipboardCollection(page, "general");
      await page.locator('button[data-tab="clip-tandas"]').click();
      await expectClickStartsTrackSoon(
        page,
        await getExpandedTandaDetailLine(clipboardTandaRow(page, "Tango Trio"), "Alberto Gomez Tango Uno"),
        "tango uno",
      );

      await ensurePlaylistTab(page);
      await expectClickStartsTrackSoon(page, locators.playlistTrack, "tango uno");
      await expectClickStartsTrackSoon(
        page,
        await getExpandedTandaDetailLine(playlistTandaRow(page, "Tango Trio"), "Alberto Gomez Tango Dos"),
        "tango dos",
      );
    } finally {
      await launched.close();
    }
  });

  test("39 - track clicks start within half a second in edit across search, clipboard, and playlist surfaces", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await configureImmediateClickPlaybackHarness(page);
      await page.locator("#mode-select").selectOption("edit");
      const { customCollectionId, locators } = await prepareClickPlaybackFixtures(page);

      await page.locator('button[data-tab="search-tracks"]').click();
      await runSearch(page, "Alberto Gomez");
      await expectClickStartsTrackSoon(
        page,
        searchTrackRow(page, "Alberto Gomez Tango Uno"),
        "tango uno",
      );
      await closeTrackEditorIfOpen(page);

      await page.locator('button[data-tab="search-tandas"]').click();
      await expectClickStartsTrackSoon(
        page,
        await getExpandedTandaDetailLine(searchTandaRow(page, "Tango Trio"), "Alberto Gomez Tango Dos"),
        "tango dos",
      );
      await closeTrackEditorIfOpen(page);

      await selectClipboardCollection(page, "general");
      await page.locator('button[data-tab="clip-tracks"]').click();
      await expectClickStartsTrackSoon(
        page,
        clipboardTrackRow(page, "Alberto Gomez Tango Uno"),
        "tango uno",
      );
      await closeTrackEditorIfOpen(page);

      await selectClipboardCollection(page, customCollectionId);
      await page.locator('button[data-tab="clip-tracks"]').click();
      await expectClickStartsTrackSoon(
        page,
        clipboardTrackRow(page, "Alberto Gomez Tango Dos"),
        "tango dos",
      );
      await closeTrackEditorIfOpen(page);

      await selectClipboardCollection(page, "general");
      await page.locator('button[data-tab="clip-tandas"]').click();
      await expectClickStartsTrackSoon(
        page,
        await getExpandedTandaDetailLine(clipboardTandaRow(page, "Tango Trio"), "Alberto Gomez Tango Uno"),
        "tango uno",
      );
      await closeTrackEditorIfOpen(page);

      await ensurePlaylistTab(page);
      await expectClickStartsTrackSoon(
        page,
        await getExpandedTandaDetailLine(playlistTandaRow(page, "Tango Trio"), "Alberto Gomez Tango Dos"),
        "tango dos",
      );
      await closeTrackEditorIfOpen(page);
      await expectClickStartsTrackSoon(page, locators.playlistTrack, "tango uno");
      await closeTrackEditorIfOpen(page);
    } finally {
      await launched.close();
    }
  });

  test("40 - live mode ignores clicks while active and allows restart once stopped", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await configureImmediateClickPlaybackHarness(page);
      await page.locator("#mode-select").selectOption("live");
      const { locators } = await prepareClickPlaybackFixtures(page);

      await ensurePlaylistTab(page);
      await expectClickStartsTrackSoon(
        page,
        await getExpandedTandaDetailLine(playlistTandaRow(page, "Tango Trio"), "Alberto Gomez Tango Uno"),
        "tango uno",
        5_000,
      );
      await expectNowPlayingContainsSoon(page, "tango uno", 5_000);
      await expect(page.locator("#playlist-stop")).toBeEnabled({ timeout: 2_000 });

      await page.locator('button[data-tab="search-tracks"]').click();
      await runSearch(page, "Alberto Gomez");
      await expectClickIgnoredWhileLiveActive(
        page,
        searchTrackRow(page, "Alberto Gomez Tango Uno"),
        "tango uno",
      );

      await selectClipboardCollection(page, "general");
      await page.locator('button[data-tab="clip-tracks"]').click();
      await expectClickIgnoredWhileLiveActive(page, locators.clipboardGeneralTrack, "tango uno");

      await ensurePlaylistTab(page);
      await expectClickIgnoredWhileLiveActive(
        page,
        await getExpandedTandaDetailLine(playlistTandaRow(page, "Tango Trio"), "Alberto Gomez Tango Dos"),
        "tango uno",
      );

      await page.locator("#playlist-stop").click();
      await expect
        .poll(
          async () => ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
          { timeout: 5_000 },
        )
        .toContain("idle");

      await expectClickStartsTrackSoon(
        page,
        await getExpandedTandaDetailLine(playlistTandaRow(page, "Tango Trio"), "Alberto Gomez Tango Dos"),
        "tango dos",
      );
    } finally {
      await launched.close();
    }
  });

  test("41 - cortina now-playing controls stop to continue and play to override duration", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await installVariableEndingMediaStub(page, 6_000, 4_000);

      await page.locator("#mode-select").selectOption("live");
      await openSettings(page);
      await page.locator('button[data-tab="playlist"]').click();
      await page.locator("#gap-between-tracks").fill("0");
      await page.locator("#gap-before-tanda").fill("0");
      await page.locator("#gap-before-cortina").fill("0");
      await page.locator("#stop-fade-duration").fill("0.6");
      await page.locator("#playlist-cortina-duration").fill("1");
      const setValue = await waitForFirstNamedCortinaSetValue(page);
      await page.locator("#playlist-cortina-set").selectOption(setValue);
      await closeSettings(page);
      await clearPlaylistViaUi(page);

      await page.locator('button[data-tab="search-tandas"]').click();
      for (const tandaName of ["Tango Trio", "Milonga Trio"]) {
        await runSearch(page, tandaName);
        await clickRowAction(searchTandaRow(page, tandaName), "add-playlist-tanda");
        await confirmIfPrompted(page);
      }

      await ensurePlaylistTab(page);
      await dispatchExactClick(
        await getExpandedTandaDetailLine(playlistTandaRow(page, "Tango Trio"), "Alberto Gomez Tango Uno"),
      );
      await expect(page.locator("#cortina-controls")).toHaveClass(/visible/);

      await page.locator("#cortina-stop").click();
      await expect(page.locator("#cortina-controls")).not.toHaveClass(/visible/);
      await expect
        .poll(
          async () => ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
          { timeout: 2_000 },
        )
        .toContain("tango uno");

      await expect(page.locator("#cortina-controls")).toHaveClass(/visible/, { timeout: 20_000 });
      await page.waitForTimeout(700);
      await page.locator("#cortina-play").click();
      await expect(page.locator("#cortina-play")).toBeDisabled();
      await page.waitForTimeout(800);
      await expect(page.locator("#cortina-controls")).toHaveClass(/visible/);
      await expect(
        ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
      ).not.toContain("milonga de prueba");

      await page.locator("#cortina-stop").click();
      await expect(page.locator("#cortina-controls")).not.toHaveClass(/visible/);
      await expect
        .poll(
          async () => ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
          { timeout: 2_000 },
        )
        .toContain("milonga de prueba");
    } finally {
      await launched.close();
    }
  });

  test("46 - cortina scenarios cover timer expiry, manual stop, and play-to-end override", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await installVariableEndingMediaStub(page, 4_000, 4_000);

      await page.locator("#mode-select").selectOption("live");
      await openSettings(page);
      await page.locator('button[data-tab="playlist"]').click();
      await page.locator("#gap-between-tracks").fill("0");
      await page.locator("#gap-before-tanda").fill("0");
      await page.locator("#gap-before-cortina").fill("0");
      await page.locator("#stop-fade-duration").fill("0.6");
      await page.locator("#playlist-cortina-duration").fill("1");
      const setValue = await waitForFirstNamedCortinaSetValue(page);
      await page.locator("#playlist-cortina-set").selectOption(setValue);
      await closeSettings(page);
      await clearPlaylistViaUi(page);

      await page.locator('button[data-tab="search-tandas"]').click();
      for (const tandaName of ["Tango Trio", "Milonga Trio"]) {
        await runSearch(page, tandaName);
        await clickRowAction(searchTandaRow(page, tandaName), "add-playlist-tanda");
        await confirmIfPrompted(page);
      }

      await ensurePlaylistTab(page);
      await dispatchExactClick(
        await getExpandedTandaDetailLine(playlistTandaRow(page, "Tango Trio"), "Alberto Gomez Tango Uno"),
      );

      await expect(page.locator("#cortina-controls")).toHaveClass(/visible/);
      await expect
        .poll(
          async () => page.locator("#cortina-controls").getAttribute("class"),
          { timeout: 8_000 },
        )
        .not.toMatch(/visible/);
      await expectNowPlayingContainsSoon(page, "tango uno", 8_000);

      await expect(page.locator("#cortina-controls")).toHaveClass(/visible/, { timeout: 20_000 });
      await page.waitForTimeout(700);
      await page.locator("#cortina-play").click();
      await expect(page.locator("#cortina-play")).toBeDisabled();
      await page.waitForTimeout(800);
      await expect(
        ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
      ).not.toContain("milonga de prueba");
      await expectNowPlayingContainsSoon(page, "milonga de prueba", 6_000);
      await expect(page.locator("#cortina-controls")).not.toHaveClass(/visible/);
    } finally {
      await launched.close();
    }
  });

  test("47 - cortina play override keeps the cortina playing past the default fade cutoff", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await installAdvancingMediaStub(page, 60_000, 60_000, 100);

      await page.locator("#mode-select").selectOption("live");
      await openSettings(page);
      await page.locator('button[data-tab="playlist"]').click();
      await page.evaluate(() => {
        localStorage.setItem("tanda-gap-between-tracks", "0");
        localStorage.setItem("tanda-gap-before-tanda", "0");
        localStorage.setItem("tanda-gap-before-cortina", "0");
        localStorage.setItem("tanda-stop-fade", "20");
        localStorage.setItem("tanda-cortina-duration", "40");
      });
      const setValue = await waitForFirstNamedCortinaSetValue(page);
      await page.locator("#playlist-cortina-set").selectOption(setValue);
      await closeSettings(page);
      await clearPlaylistViaUi(page);

      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Milonga Trio");
      await clickRowAction(searchTandaRow(page, "Milonga Trio"), "add-playlist-tanda");
      await confirmIfPrompted(page);

      await ensurePlaylistTab(page);
      await dispatchExactClick(
        await getExpandedTandaDetailLine(playlistTandaRow(page, "Milonga Trio"), "Milonga de Prueba"),
      );

      await expect(page.locator("#cortina-controls")).toHaveClass(/visible/, { timeout: 5_000 });
      await expectNowPlayingContainsSoon(page, "cortina only track", 2_000);

      await page.waitForTimeout(25_000);
      const prePlayState = await page.evaluate(() =>
        (
          window as Window & {
            __e2eRuntimeSnapshot?: {
              mainSourcePath: string;
              mainCurrentTime: number;
              mainPaused: boolean;
              mainEnded: boolean;
              mainIsCortinaPlayback: boolean;
              mainVolume: number;
              nowPlayingTrack: string;
            };
          }
        ).__e2eRuntimeSnapshot ?? null,
      );
      expect(prePlayState?.mainIsCortinaPlayback).toBe(true);
      expect((prePlayState?.mainSourcePath ?? "").toLowerCase()).toContain("cortina");
      expect((prePlayState?.nowPlayingTrack ?? "").toLowerCase()).toContain("cortina only track");
      expect(prePlayState?.mainPaused).toBe(false);
      expect(prePlayState?.mainEnded).toBe(false);
      expect(prePlayState?.configuredCortinaDuration).toBe(40);
      expect(prePlayState?.configuredStopFade).toBe(20);
      await page.locator("#cortina-play").click();
      await expect(page.locator("#cortina-play")).toBeDisabled();
      await page.waitForTimeout(21_000);

      const runtimeState = await page.evaluate(() =>
        (
          window as Window & {
            __e2eRuntimeSnapshot?: {
              mainSourcePath: string;
              mainPaused: boolean;
              mainEnded: boolean;
              mainCurrentTime: number;
              mainVolume: number;
              mainIsCortinaPlayback: boolean;
              cortinaAllowFull: boolean;
              cortinaPlaying: boolean;
              configuredCortinaDuration: number;
              configuredStopFade: number;
            };
          }
        ).__e2eRuntimeSnapshot ?? null,
      );
      const nowPlayingLabel = ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase();
      if (!nowPlayingLabel.includes("cortina only track") || nowPlayingLabel.includes("milonga de prueba")) {
        throw new Error(`late-state ${JSON.stringify({ nowPlayingLabel, runtimeState })}`);
      }
      await expect(page.locator("#cortina-controls")).toHaveClass(/visible/);
      expect(runtimeState).not.toBeNull();
      expect(runtimeState?.mainIsCortinaPlayback).toBe(true);
      expect((runtimeState?.mainSourcePath ?? "").toLowerCase()).toContain("cortina");
      expect(runtimeState?.mainPaused).toBe(false);
      expect(runtimeState?.mainEnded).toBe(false);
      expect(runtimeState?.mainVolume ?? 0).toBeGreaterThan(0.1);
    } finally {
      await launched.close();
    }
  });

  test("42 - live idle track clicks confirm one-off playback and stop without playlist continuation", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await installAutoEndingMediaStub(page, 2_000);
      await page.locator("#mode-select").selectOption("live");
      await clearPlaylistViaUi(page);
      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Tango Trio");
      await clickRowAction(searchTandaRow(page, "Tango Trio"), "add-playlist-tanda");
      await confirmIfPrompted(page);
      await runSearch(page, "Milonga Trio");
      await clickRowAction(searchTandaRow(page, "Milonga Trio"), "add-playlist-tanda");
      await confirmIfPrompted(page);

      await page.locator('button[data-tab="search-tracks"]').click();
      await runSearch(page, "Alberto Gomez Tango Uno");
      await expectLiveStandaloneTrackPromptAndPlaySoon(
        page,
        searchTrackRow(page, "Alberto Gomez Tango Uno"),
        "tango uno",
      );
      await expect(page.locator("#playlist-stop")).toBeEnabled({ timeout: 2_000 });
      await page.locator("#playlist-stop").click();
      await expect
        .poll(
          async () => ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
          { timeout: 5_000 },
        )
        .toContain("idle");
      await expect(
        ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
      ).not.toContain("milonga");
    } finally {
      await launched.close();
    }
  });

  test("45 - live one-off show collection playback disables play and keeps stop available", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await installAutoEndingMediaStub(page, 2_000);
      await page.locator("#mode-select").selectOption("live");
      await clearPlaylistViaUi(page);

      await page.locator('button[data-tab="clip-tracks"]').click();
      const showCollectionId = await createClipboardCollection(page, "Show");
      await selectClipboardCollection(page, showCollectionId);

      await page.locator('button[data-tab="search-tracks"]').click();
      await runSearch(page, "Busqueda Artistica");
      await clickRowAction(searchTrackRow(page, "Busqueda Artistica"), "add-clip");

      await page.locator('button[data-tab="clip-tracks"]').click();
      await selectClipboardCollection(page, showCollectionId);
      const showTrack = clipboardTrackRow(page, "Busqueda Artistica");
      await expect(showTrack).toBeVisible();

      await expect(page.locator("#playlist-start")).toBeDisabled();
      await expect(page.locator("#playlist-stop")).toBeDisabled();

      await expectLiveStandaloneTrackPromptAndPlaySoon(page, showTrack, "busqueda artistica", 2_000);
      await expect(page.locator("#playlist-start")).toBeDisabled({ timeout: 2_000 });
      await expect(page.locator("#playlist-stop")).toBeEnabled({ timeout: 2_000 });

      await page.locator("#playlist-stop").click();
      await expect
        .poll(
          async () => ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
          { timeout: 5_000 },
        )
        .toContain("idle");
      await expect(page.locator("#playlist-stop")).toBeDisabled({ timeout: 2_000 });

      await expectLiveStandaloneTrackPromptAndPlaySoon(page, showTrack, "busqueda artistica", 2_000);
      await expect(page.locator("#playlist-start")).toBeDisabled({ timeout: 2_000 });
      await expect(page.locator("#playlist-stop")).toBeEnabled({ timeout: 2_000 });

      await page.locator("#playlist-start").click({ force: true });
      await expect(
        ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
      ).toContain("busqueda artistica");
      await expect(page.locator("#playlist-start")).toBeDisabled();
      await expect(page.locator("#playlist-stop")).toBeEnabled();
    } finally {
      await launched.close();
    }
  });

  test("43 - performance stop pauses after tanda, blanks display text, and resumes via the same cortina", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await installVariableEndingMediaStub(page, 6000, 1200);
      await page.locator("#mode-select").selectOption("live");
      await openSettings(page);
      await page.locator('button[data-tab="playlist"]').click();
      await page.locator("#gap-between-tracks").fill("0");
      await page.locator("#gap-before-tanda").fill("0");
      await page.locator("#gap-before-cortina").fill("0");
      await page.locator("#playlist-cortina-duration").fill("1");
      const setValue = await waitForFirstNamedCortinaSetValue(page);
      await page.locator("#playlist-cortina-set").selectOption(setValue);
      await closeSettings(page);
      await clearPlaylistViaUi(page);

      await page.locator('button[data-tab="search-tandas"]').click();
      for (const tandaName of ["Tango Trio", "Milonga Trio", "Waltz Trio"]) {
        await runSearch(page, tandaName);
        await clickRowAction(searchTandaRow(page, tandaName), "add-playlist-tanda");
        await confirmIfPrompted(page);
      }

      await ensurePlaylistTab(page);
      await page.locator("#playlist-performance-stop").check();
      await page.locator("#open-display").click();
      await startPlaylistAndExpectTrackSoon(page, "tango uno");

      await expect
        .poll(
          async () =>
            await page.evaluate(() => {
              const payload = (
                window as Window & {
                  __e2eDisplaySnapshot?: { nextTandaText?: string };
                }
              ).__e2eDisplaySnapshot;
              return payload?.nextTandaText ?? "";
            }),
          { timeout: 5_000 },
        )
        .toBe("");

      let finalCortinaLabel = "";
      await expect
        .poll(
          async () => {
            const payload = await page.evaluate(() => {
              return (
                window as Window & {
                  __e2eRuntimeSnapshot?: {
                    pausedForPerformanceStop?: boolean;
                    performanceStopCortinaLabel?: string;
                    playlistStartDisabled?: boolean;
                    playlistStopDisabled?: boolean;
                  };
                }
              ).__e2eRuntimeSnapshot ?? null;
            });
            if (
              payload?.pausedForPerformanceStop &&
              payload.performanceStopCortinaLabel &&
              payload.playlistStartDisabled === false &&
              payload.playlistStopDisabled === true
            ) {
              finalCortinaLabel = payload.performanceStopCortinaLabel;
            }
            return finalCortinaLabel;
          },
          { timeout: 30_000 },
        )
        .not.toBe("");

      await expect(
        ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
      ).not.toContain("milonga de prueba");

      await page.locator('button[data-tab="search-tracks"]').click();
      await runSearch(page, "Busqueda Artistica");
      await expectLiveStandaloneTrackPromptAndPlaySoon(
        page,
        searchTrackRow(page, "Busqueda Artistica"),
        "busqueda artistica",
        15_000,
      );
      await expect(page.locator("#playlist-start")).toBeDisabled({ timeout: 2_000 });
      await expect(page.locator("#playlist-stop")).toBeEnabled({ timeout: 2_000 });
      await expect
        .poll(
          async () =>
            await page.evaluate(() => {
              const payload = (
                window as Window & {
                  __e2eDisplaySnapshot?: { title?: string; artist?: string; mode?: string };
                }
              ).__e2eDisplaySnapshot;
              return {
                title: payload?.title ?? "",
                artist: payload?.artist ?? "",
                mode: payload?.mode ?? "",
              };
            }),
          { timeout: 5_000 },
        )
        .toMatchObject({
          title: "Busqueda Artistica",
          artist: "Juan D'Arienzo",
          mode: "normal",
        });
      await page.locator("#playlist-stop").click();
      await expect(page.locator("#playlist-start")).toBeEnabled({ timeout: 15_000 });
      await expect(page.locator("#playlist-stop")).toBeDisabled({ timeout: 15_000 });
      await expect
        .poll(
          async () => ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
          { timeout: 5_000 },
        )
        .toContain("idle");

      await page.locator("#playlist-start").click();
      await expect
        .poll(
          async () => ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
          { timeout: 5_000 },
        )
        .toContain(finalCortinaLabel.toLowerCase());
      await expect
        .poll(
          async () => ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
          { timeout: 8_000 },
        )
        .toContain("milonga de prueba");
    } finally {
      await launched.close();
    }
  });

  test("44 - enabling performance stop during a live tanda still pauses after its following cortina", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await installVariableEndingMediaStub(page, 1200, 1200);
      await page.locator("#mode-select").selectOption("live");
      await openSettings(page);
      await page.locator('button[data-tab="playlist"]').click();
      await page.locator("#gap-between-tracks").fill("0");
      await page.locator("#gap-before-tanda").fill("0");
      await page.locator("#gap-before-cortina").fill("0");
      await page.locator("#playlist-cortina-duration").fill("1");
      const setValue = await waitForFirstNamedCortinaSetValue(page);
      await page.locator("#playlist-cortina-set").selectOption(setValue);
      await closeSettings(page);
      await clearPlaylistViaUi(page);

      await page.locator('button[data-tab="search-tandas"]').click();
      for (const tandaName of ["Tango Trio", "Milonga Trio", "Waltz Trio"]) {
        await runSearch(page, tandaName);
        await clickRowAction(searchTandaRow(page, tandaName), "add-playlist-tanda");
        await confirmIfPrompted(page);
      }

      await ensurePlaylistTab(page);
      await page.locator("#open-display").click();
      await page.locator("#playlist-start").click();
      await expectNowPlayingContainsSoon(page, "tango uno", 8_000);

      await page.locator("#playlist-performance-stop").check();
      await expect
        .poll(
          async () =>
            await page.evaluate(() => {
              const payload = (
                window as Window & {
                  __e2eDisplaySnapshot?: { nextTandaText?: string };
                }
              ).__e2eDisplaySnapshot;
              return payload?.nextTandaText ?? "";
            }),
          { timeout: 5_000 },
        )
        .toBe("");

      let finalCortinaLabel = "";
      await expect
        .poll(
          async () => {
            const activeMeta = page.locator("#playlist-list .cortina-row.active .cortina-meta").first();
            const text = ((await activeMeta.textContent().catch(() => "")) ?? "").trim();
            if (text) {
              finalCortinaLabel = text;
            }
            return text;
          },
          { timeout: 8_000 },
        )
        .not.toBe("");

      await expect(page.locator("#playlist-start")).toBeEnabled({ timeout: 8_000 });
      await expect(page.locator("#playlist-stop")).toBeDisabled({ timeout: 4_000 });
      await expect(
        ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
      ).not.toContain("milonga de prueba");

      await page.locator("#playlist-start").click();
      await expect
        .poll(
          async () => ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
          { timeout: 5_000 },
        )
        .toContain(finalCortinaLabel.toLowerCase());
      await expect
        .poll(
          async () => ((await page.locator("#now-playing-track").innerText()) ?? "").toLowerCase(),
          { timeout: 8_000 },
        )
        .toContain("milonga de prueba");
    } finally {
      await launched.close();
    }
  });

  test("35 - tanda search detail track menu can send track to clipboard", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Tango Trio");
      await selectClipboardCollection(page, "general");
      const row = searchTandaRow(page, "Tango Trio");
      await expect(row).toBeVisible();
      const detailLine = await getExpandedTandaDetailLine(row, "Alberto Gomez Tango Uno");
      await clickDetailMenuUntilOpen(detailLine);
      const addClipButton = row
        .locator('.tanda-detail-line', { hasText: "Alberto Gomez Tango Uno" })
        .locator('.tanda-detail-menu button[data-action="add-clip-track-from-tanda"]')
        .first();
      await dispatchExactClick(addClipButton);
      await selectClipboardCollection(page, "general");
      await page.locator('button[data-tab="clip-tracks"]').click();
      await expect(clipboardTrackRow(page, "Alberto Gomez Tango Uno")).toBeVisible();
    } finally {
      await launched.close();
    }
  });

  test("36 - clipboard track add keeps playlist-hosted tanda editor in playlist tab", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await clearPlaylistViaUi(page);
      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Tango Trio");
      const searchRow = searchTandaRow(page, "Tango Trio");
      await expect(searchRow).toBeVisible();
      await clickRowAction(searchRow, "add-playlist-tanda");
      await confirmIfPrompted(page);
      await ensurePlaylistTab(page);

      const playlistRow = playlistTandaRow(page, "Tango Trio");
      await expect(playlistRow).toBeVisible();
      await clickRowAction(playlistRow, "tanda-edit");
      await expect(page.locator('#playlist-tanda-editor[data-state="visible"]')).toBeVisible();

      await playlistRow.locator(".tanda-summary").click();
      const detailLine = playlistRow.locator('.tanda-detail-line[data-track-id="t1"]').first();
      await expect(detailLine).toBeVisible();
      await detailLine.locator('button[data-action="detail-menu"]').click();
      await detailLine
        .locator('.tanda-detail-menu button[data-action="send-playlist-tanda-track"]')
        .click();

      await page.locator('button[data-tab="clip-tracks"]').click();
      const clipRow = clipboardTrackRow(page, "Alberto Gomez Tango Uno");
      await expect(clipRow).toBeVisible();
      await clickRowAction(clipRow, "add-tanda");

      await expect(page.locator('button[data-tab="playlist-tab"]')).toHaveClass(/active/);
      await expect(page.locator('button[data-tab="tanda-designer-tab"]')).not.toHaveClass(/active/);
      await expect(page.locator('#playlist-tanda-editor[data-state="visible"]')).toBeVisible();
      await expect(page.locator("#playlist-tanda-editor .tanda-track-row")).toHaveCount(3);
    } finally {
      await launched.close();
    }
  });

  test("37 - reset plus startup flow rebuilds legacy metadata, waveforms, and compressed cache", async () => {
    const launched = await launchSeededApp("empty");
    const { page, tempRoot } = launched;
    const { musicRoot, cortinaRoot } = writeLegacyStartupFixture(tempRoot);
    const dataRoot = path.join(tempRoot, "data");
    const waveformsDir = path.join(dataRoot, "waveforms");
    const compressedDir = path.join(dataRoot, "compressed-audio-cache");
    try {
      await page.evaluate(
        async ({ musicRoot: nextMusicRoot, cortinaRoot: nextCortinaRoot }) => {
          localStorage.setItem("tanda-audio-dynamics-enabled", "1");
          await window.tanda?.addRoot("music", nextMusicRoot);
          await window.tanda?.addRoot("cortina", nextCortinaRoot);
        },
        { musicRoot, cortinaRoot },
      );

      await openSettings(page);
      await page.locator('button[data-tab="library"]').click();
      await expect(page.locator("#legacy-import")).toBeVisible();
      await page.locator("#legacy-import-button").click();
      await confirmIfPrompted(page);
      await expect
        .poll(async () => {
          const tandas = await page.evaluate(async () => await window.tanda?.listTandas());
          return tandas?.some((tanda) => tanda.name === "Legacy Tango Pair") ?? false;
        })
        .toBe(true);
      await page.locator("#startup-flow-button").click();
      await expect(page.locator("#startup-flow-result")).toContainText("Setup complete", {
        timeout: 30_000,
      });

      await closeSettings(page);
      await page.locator('button[data-tab="search-tracks"]').click();
      await runSearch(page, "Legacy Alpha");
      await expect(searchTrackRow(page, "Legacy Alpha")).toBeVisible();
      await expect
        .poll(async () => {
          const compressedPaths = await page.evaluate(async () => {
            const lookup = async (track: any) => {
              if (!track) {
                return null;
              }
              const result = await window.tanda?.getCompressedTrackPath({
                trackId: track.id,
                filePath: track.full_path,
                loudnessDb: track.loudness_db,
                depthPercent: 100,
                mode: "track-leveler",
                liftThresholdDb: -60,
                maxLiftDb: 15,
                ratio: 5,
                attackMs: 35,
                releaseMs: 3000,
                gateThresholdDb: -65,
                limiterCeilingDb: -1,
                limiterReleaseMs: 260,
              });
              return result?.ok ? result.filePath ?? null : null;
            };
            const listTrack = (await window.tanda?.listTracks())?.find(
              (entry: any) => entry.title === "Legacy Alpha",
            );
            const tandaTrack = (await window.tanda?.listTandas())
              ?.find((tanda: any) => tanda.name === "Legacy Tango Pair")
              ?.tracks.find((entry: any) => entry.title === "Legacy Alpha");
            return {
              listTrackPath: await lookup(listTrack),
              tandaTrackPath: await lookup(tandaTrack),
            };
          });
          return (
            Boolean(compressedPaths?.listTrackPath && fs.existsSync(compressedPaths.listTrackPath)) &&
            Boolean(compressedPaths?.tandaTrackPath && fs.existsSync(compressedPaths.tandaTrackPath))
          );
        })
        .toBe(true);
      await expect
        .poll(async () => {
          const tandas = await page.evaluate(async () => await window.tanda?.listTandas());
          return tandas?.some((tanda) => tanda.name === "Legacy Tango Pair") ?? false;
        })
        .toBe(true);

      await expect
        .poll(() =>
          fs.existsSync(waveformsDir)
            ? fs.readdirSync(waveformsDir).filter((entry) => entry.endsWith(".png")).length
            : 0,
        )
        .toBeGreaterThan(0);
      await expect
        .poll(() =>
          fs.existsSync(compressedDir)
            ? fs.readdirSync(compressedDir).filter((entry) => entry.endsWith(".wav")).length
            : 0,
        )
        .toBeGreaterThan(0);

      await openSettings(page);
      await page.locator('button[data-tab="library"]').click();
      await page.locator("#clear-cached-files").click();
      await confirmIfPrompted(page);
      await expect
        .poll(() =>
          fs.existsSync(waveformsDir)
            ? fs.readdirSync(waveformsDir).filter((entry) => entry.endsWith(".png")).length
            : 0,
        )
        .toBe(0);
      await expect
        .poll(() =>
          fs.existsSync(compressedDir)
            ? fs.readdirSync(compressedDir).filter((entry) => entry.endsWith(".wav")).length
            : 0,
        )
        .toBe(0);

      await page.locator("#reset-db").click();
      await confirmIfPrompted(page);
      await closeSettings(page);

      await page.locator('button[data-tab="search-tracks"]').click();
      await runSearch(page, "Legacy Alpha");
      await expect(page.locator("#search-tracks .track-row")).toHaveCount(0);
      await expect
        .poll(async () => {
          const tandas = await page.evaluate(async () => await window.tanda?.listTandas());
          return tandas?.length ?? 0;
        })
        .toBe(0);

      await page.evaluate(
        async ({ musicRoot: nextMusicRoot, cortinaRoot: nextCortinaRoot }) => {
          localStorage.setItem("tanda-audio-dynamics-enabled", "1");
          await window.tanda?.addRoot("music", nextMusicRoot);
          await window.tanda?.addRoot("cortina", nextCortinaRoot);
        },
        { musicRoot, cortinaRoot },
      );

      await openSettings(page);
      await page.locator('button[data-tab="library"]').click();
      await expect(page.locator("#legacy-import")).toBeVisible();
      await page.locator("#legacy-import-button").click();
      await confirmIfPrompted(page);
      await expect
        .poll(async () => {
          const tandas = await page.evaluate(async () => await window.tanda?.listTandas());
          return tandas?.some((tanda) => tanda.name === "Legacy Tango Pair") ?? false;
        })
        .toBe(true);
      await page.locator("#startup-flow-button").click();
      await expect(page.locator("#startup-flow-result")).toContainText("Setup complete", {
        timeout: 30_000,
      });
      await closeSettings(page);

      await page.locator('button[data-tab="search-tracks"]').click();
      await runSearch(page, "Legacy Alpha");
      await expect(searchTrackRow(page, "Legacy Alpha")).toBeVisible();
      await expect
        .poll(async () => {
          const compressedPaths = await page.evaluate(async () => {
            const lookup = async (track: any) => {
              if (!track) {
                return null;
              }
              const result = await window.tanda?.getCompressedTrackPath({
                trackId: track.id,
                filePath: track.full_path,
                loudnessDb: track.loudness_db,
                depthPercent: 100,
                mode: "track-leveler",
                liftThresholdDb: -60,
                maxLiftDb: 15,
                ratio: 5,
                attackMs: 35,
                releaseMs: 3000,
                gateThresholdDb: -65,
                limiterCeilingDb: -1,
                limiterReleaseMs: 260,
              });
              return result?.ok ? result.filePath ?? null : null;
            };
            const listTrack = (await window.tanda?.listTracks())?.find(
              (entry: any) => entry.title === "Legacy Alpha",
            );
            const tandaTrack = (await window.tanda?.listTandas())
              ?.find((tanda: any) => tanda.name === "Legacy Tango Pair")
              ?.tracks.find((entry: any) => entry.title === "Legacy Alpha");
            return {
              listTrackPath: await lookup(listTrack),
              tandaTrackPath: await lookup(tandaTrack),
            };
          });
          return (
            Boolean(compressedPaths?.listTrackPath && fs.existsSync(compressedPaths.listTrackPath)) &&
            Boolean(compressedPaths?.tandaTrackPath && fs.existsSync(compressedPaths.tandaTrackPath))
          );
        })
        .toBe(true);
      await expect
        .poll(async () => {
          const tandas = await page.evaluate(async () => await window.tanda?.listTandas());
          return tandas?.some((tanda) => tanda.name === "Legacy Tango Pair") ?? false;
        })
        .toBe(true);
      await expect
        .poll(() =>
          fs.existsSync(waveformsDir)
            ? fs.readdirSync(waveformsDir).filter((entry) => entry.endsWith(".png")).length
            : 0,
        )
        .toBeGreaterThan(0);
      await expect
        .poll(() =>
          fs.existsSync(compressedDir)
            ? fs.readdirSync(compressedDir).filter((entry) => entry.endsWith(".wav")).length
            : 0,
        )
        .toBeGreaterThan(0);
    } finally {
      await launched.close();
    }
  });

  test("39 - rescanning preserves edited metadata and only imports newly added files", async () => {
    const launched = await launchSeededApp("empty");
    const { page, tempRoot } = launched;
    const musicRoot = path.join(tempRoot, "rescan-music");
    const initialTracks = createRescanFixtureTracks();
    try {
      initialTracks.forEach((track, index) => {
        writeTaggedMp3(path.join(musicRoot, track.fileName), {
          title: track.title,
          artist: track.artist,
          album: track.album,
          year: track.year,
          genre: track.genre,
          notes: `Imported notes ${index + 1}`,
          seconds: 0.65 + index * 0.01,
          frequency: 330 + index * 17,
        });
      });

      await addMusicRootViaSettings(page, musicRoot);
      const firstSummary = await runMusicScan(page);
      expect(firstSummary).toMatchObject({
        scanned: 10,
        added: 10,
        updated: 0,
        removed: 0,
      });
      await waitForTrackCount(page, 10);
      await closeSettings(page);

      for (const track of initialTracks) {
        await applyEditedTrackValues(page, track);
      }
      await expectEditedTracksPersisted(page, initialTracks, { expectedTotal: 10 });
      const editedSnapshots = await snapshotTracksByFileName(page, initialTracks);

      await openSettings(page);
      await page.locator('button[data-tab="library"]').click();
      const secondSummary = await runMusicScan(page);
      expect(secondSummary).toMatchObject({
        scanned: 10,
        added: 0,
        updated: 0,
        removed: 0,
      });
      await closeSettings(page);
      await expectEditedTracksPersisted(page, initialTracks, { expectedTotal: 10 });
      await expectTrackSnapshotsMatch(page, editedSnapshots);

      const newTrack = {
        fileName: "rescan-track-11.mp3",
        title: "Imported Title 11",
        artist: "Imported Artist 11",
        album: "Imported Album 11",
        year: "1947",
        genre: "Tango",
      };
      writeTaggedMp3(path.join(musicRoot, newTrack.fileName), {
        title: newTrack.title,
        artist: newTrack.artist,
        album: newTrack.album,
        year: newTrack.year,
        genre: newTrack.genre,
        notes: "Imported notes 11",
        seconds: 0.92,
        frequency: 612,
      });

      await openSettings(page);
      await page.locator('button[data-tab="library"]').click();
      const thirdSummary = await runMusicScan(page);
      expect(thirdSummary).toMatchObject({
        scanned: 11,
        added: 1,
        updated: 0,
        removed: 0,
      });
      await waitForTrackCount(page, 11);
      await closeSettings(page);

      await expectEditedTracksPersisted(page, initialTracks, { expectedTotal: 11 });
      await expectTrackSnapshotsMatch(page, editedSnapshots);
      const tracksAfterNewImport = await getTracksViaApi(page);
      const importedRow = tracksAfterNewImport.find((track) =>
        track.relative_path?.endsWith(newTrack.fileName),
      );
      expect(importedRow).toBeTruthy();
      expect(importedRow?.title).toBe(newTrack.title);
      expect(importedRow?.artist).toBe(newTrack.artist);
      expect(importedRow?.album).toBe(newTrack.album);
      expect(importedRow?.year).toBe(newTrack.year);
      expect(importedRow?.genre).toBe(newTrack.genre);
    } finally {
      await launched.close();
    }
  });
});
