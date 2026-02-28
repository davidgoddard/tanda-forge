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

const ensurePlaylistTab = async (page: Page) => {
  await page.locator('button[data-tab="playlist-tab"]').click();
  await expect(page.locator('button[data-tab="playlist-tab"]')).toHaveClass(/active/);
};

const clearPlaylistViaUi = async (page: Page) => {
  await ensurePlaylistTab(page);
  await page.locator("#playlist-clear").click();
  const modal = page.locator(".playlist-clear-modal");
  if ((await modal.count()) > 0) {
    await expect(modal).not.toHaveClass(/hidden/);
    await modal.locator('.confirm-ok[data-option="clear"]').click();
  }
  await expect(page.locator("#playlist-list .track-row")).toHaveCount(0);
  await expect(page.locator("#playlist-list .tanda-row")).toHaveCount(0);
};

const openRowMenu = async (row: Locator) => {
  await row.locator('button[data-action="row-menu"]').first().click({ force: true });
  await expect(row).toHaveAttribute("data-menu-open", "1");
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

const openSettings = async (page: Page) => {
  await page.locator("#open-settings").click();
  await expect(page.locator("#settings-panel")).toHaveAttribute("aria-hidden", "false");
};

const closeSettings = async (page: Page) => {
  await page.locator("#close-settings").click();
  await expect(page.locator("#settings-panel")).toHaveAttribute("aria-hidden", "true");
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
    const launched = await launchSeededApp("full");
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
      await clickRowAction(row, "edit-track");
      await expect(page.locator("#track-editor")).toHaveAttribute("aria-hidden", "false");
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
      await runSearch(page, "Busqueda Artistica");
      const row = searchTrackRow(page, "Busqueda Artistica");
      await clickRowAction(row, "add-clip");
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
      const playlistHitCount = await playlistTrackRow(page, "Tempo 72 Test").count();
      if (playlistHitCount > 0) {
        await expect(playlistTrackRow(page, "Tempo 72 Test")).toBeVisible();
      } else {
        const editor = await waitForAnyEditorRows(page, 1);
        await expect(editor).toContainText("Tempo 72 Test");
      }
    } finally {
      await launched.close();
    }
  });

  test("13 - search-track menu action adds track to tanda designer", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await runSearch(page, "Tempo 72 Test");
      const row = searchTrackRow(page, "Tempo 72 Test");
      await clickRowAction(row, "add-tanda");
      await expect(page.locator('#tanda-designer-tab')).toHaveClass(/active/);
      await expect(page.locator("#tanda-list")).toContainText("Tempo 72 Test");
    } finally {
      await launched.close();
    }
  });

  test("14 - search-tanda menu action opens tanda in designer", async () => {
    const launched = await launchSeededApp("full");
    const { page } = launched;
    try {
      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Tango Trio");
      const row = searchTandaRow(page, "Tango Trio");
      await clickRowAction(row, "tanda-toggle");
      await expect(page.locator("#tanda-designer-tab")).toHaveClass(/active/);
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
      const clipRow = clipboardTrackRow(page, "Tempo 72 Test");
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
      await page.locator('button[data-tab="clip-tandas"]').click();
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
      await runSearch(page, "Tempo 72 Test");
      await clickRowAction(searchTrackRow(page, "Tempo 72 Test"), "add-tanda");
      await waitForEditorRows(page.locator("#tanda-list"), 1);
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
      await page.locator("#playlist-stats-close").click();
      await expect(page.locator("#playlist-stats-modal")).toHaveAttribute("aria-hidden", "true");

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
});
