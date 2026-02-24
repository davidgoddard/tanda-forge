import { test, expect, type Locator, type Page } from "@playwright/test";
import { launchSeededApp } from "./support/electron-app";

const runSearch = async (page: Page, query: string) => {
  await page.locator("#search-input").fill(query);
  await page.locator("#search-button").click();
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

const openRowMenu = async (row: Locator) => {
  await row.locator('button[data-action="row-menu"]').click();
};

const clickRowAction = async (row: Locator, action: string) => {
  await openRowMenu(row);
  await row.locator(`.row-menu button[data-action="${action}"]`).click();
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
      await expect(page.locator("#search-tracks .track-row")).toHaveCount(0);
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
      await expect(page.locator("#search-input")).toHaveValue(/D'Arienzo/);
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
      await expect(playlistTrackRow(page, "Tempo 72 Test")).toBeVisible();
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
      await expect(page.locator("#tanda-list")).toContainText("Tango Trio");
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
      const row = searchTandaRow(page, "Waltz Trio");
      await clickRowAction(row, "add-playlist-tanda");
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
      await expect(page.locator("#tanda-designer-tab")).toHaveClass(/active/);
      await expect(page.locator("#tanda-list")).toContainText("Tango Trio");
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
      await runSearch(page, "Tempo 72 Test");
      await clickRowAction(searchTrackRow(page, "Tempo 72 Test"), "add-tanda");
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
      await page.locator('button[data-tab="search-tandas"]').click();
      await runSearch(page, "Tango Trio");
      await clickRowAction(searchTandaRow(page, "Tango Trio"), "add-playlist-tanda");

      const playlistRow = playlistTandaRow(page, "Tango Trio");
      await clickRowAction(playlistRow, "tanda-edit");
      const editor = page.locator("#playlist-tanda-editor");
      await expect(editor).not.toHaveClass(/hidden/);

      const beforeFirst = (
        (await editor.locator(".tanda-track-row").nth(0).innerText()).split("\n")[0] ?? ""
      ).trim();
      const beforeSecond = (
        (await editor.locator(".tanda-track-row").nth(1).innerText()).split("\n")[0] ?? ""
      ).trim();

      await editor
        .locator('.tanda-track-row:nth-child(2) button[data-action="tanda-up"]')
        .click();
      await expect(editor).not.toHaveClass(/hidden/);
      await expect(editor.locator(".tanda-track-row").nth(0)).toContainText(beforeSecond);

      await editor
        .locator('.tanda-track-row:nth-child(1) button[data-action="tanda-down"]')
        .click();
      await expect(editor).not.toHaveClass(/hidden/);
      await expect(editor.locator(".tanda-track-row").nth(0)).toContainText(beforeFirst);

      const removedLabel = (
        (await editor.locator(".tanda-track-row").nth(2).innerText()).split("\n")[0] ?? ""
      ).trim();
      await editor
        .locator('.tanda-track-row:nth-child(3) button[data-action="tanda-remove"]')
        .click();
      await expect(editor).not.toHaveClass(/hidden/);

      const clipRow = clipboardTrackRow(page, removedLabel);
      await clickRowAction(clipRow, "add-tanda");
      await expect(editor).toContainText(removedLabel);

      await editor.locator('button[data-action="tanda-done"]').click();
      await expect(editor).toHaveClass(/hidden/);
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
});
