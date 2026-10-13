import { test, expect } from "@playwright/test";
import { launchSeededApp } from "./support/electron-app";

test("rating filter uses maximum membership, refreshes collections, and leaves the playlist alone", async () => {
  const launched = await launchSeededApp("full");
  const { page } = launched;
  try {
    await page.evaluate(() => {
      localStorage.setItem("tanda-clipboard-collections", JSON.stringify([
        { id: "general", name: "General", trackIds: ["t1", "t10", "t12"], tandaIds: ["td1", "td4"] },
      ]));
      localStorage.setItem("tanda-clipboard-active", "general");
      localStorage.setItem("tanda-clipboard-include", "[]");
    });
    await page.reload();
    await page.locator("#search-tanda-size").fill("");
    await page.locator("#search-tanda-size").dispatchEvent("change");
    await page.locator('#clipboard-collections-tabs button[data-collection-id="general"]').click();
    await page.locator('button[data-tab="clip-tracks"]').click();
    await expect(page.locator('#clip-tracks .track-row[data-track-id="t1"]')).toBeVisible();
    const row = page.locator('#search-tracks .track-row[data-track-id="t1"]');
    await row.locator('button[data-action="row-menu"]').click();
    await page.locator('.row-menu button[data-action="add-playlist-track"]:visible').click();
    const confirm = page.locator('.confirm-modal:not(.hidden) .confirm-ok');
    if (await confirm.isVisible()) await confirm.click();
    await page.locator('button[data-tab="playlist-tab"]').click();
    await expect(page.locator('#playlist-list .tanda-row').first()).toBeVisible();
    const playlistBefore = await page.locator('#playlist-list').innerText();

    const ratingBounds = await page.locator('#rating-filter-summary').boundingBox();
    const sizeBounds = await page.locator('.search-filter-row .tanda-size-control').boundingBox();
    expect(ratingBounds).not.toBeNull();
    expect(sizeBounds).not.toBeNull();
    expect(Math.abs((ratingBounds!.y + ratingBounds!.height / 2) - (sizeBounds!.y + sizeBounds!.height / 2))).toBeLessThan(8);
    await page.screenshot({ path: test.info().outputPath("rating-filter-collapsed.png") });
    await page.locator('#rating-filter-summary').click();
    const controls = page.locator('.rating-filter-controls');
    const beforeSelection = await controls.boundingBox();
    await page.locator('#rating-filter-mode').selectOption('exactly');
    const activeSummary = await page.locator('#rating-filter-summary').boundingBox();
    const clearButton = await page.locator('#rating-filter-clear').boundingBox();
    await expect(page.locator('#rating-filter-clear')).toHaveText('Clear');
    const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    expect(clearButton!.x - (activeSummary!.x + activeSummary!.width)).toBeCloseTo(rem, 0);
    const afterSelection = await controls.boundingBox();
    expect(afterSelection!.width).toBeCloseTo(beforeSelection!.width, 0);
    expect(afterSelection!.height).toBeCloseTo(beforeSelection!.height, 0);
    const comparison = await page.locator('#rating-filter-mode').boundingBox();
    const stars = await page.locator('#rating-filter-stars').boundingBox();
    expect(Math.abs(comparison!.y - stars!.y)).toBeLessThan(8);
    await page.locator('#rating-filter-mode').selectOption('atMost');
    await page.locator('#rating-filter-stars button').nth(2).click();
    await expect(page.locator('#search-tracks .track-row[data-track-id="t1"]')).toHaveCount(0);
    await expect(page.locator('#search-tracks .track-row[data-track-id="t10"]')).toBeVisible();
    await expect(page.locator('#clip-tracks .track-row[data-track-id="t1"]')).toHaveCount(0);
    await expect(page.locator('#clip-tracks .track-row[data-track-id="t10"]')).toBeVisible();
    expect(await page.locator('#playlist-list').innerText()).toBe(playlistBefore);
    await page.screenshot({ path: test.info().outputPath("rating-filter.png") });

    // Check real SQL, IPC, count, pagination and jump offsets, including the fuzzy path.
    const checks = await page.evaluate(async () => {
      const api = window.tanda!;
      const results = [];
      for (const query of ["", "Tango"]) {
        const params = { query, styles: [], rating: { mode: "atMost" as const, stars: 3 }, sortBy: "title", sortDir: "asc" as const };
        const tracks = await api.searchTracks(params);
        const count = await api.searchTrackCount(params);
        const page = await api.searchTracks({ ...params, limit: 1, offset: 1 });
        const prefixes = await api.searchJumpIndex(params);
        const offset = tracks.length ? (await api.searchJumpToPrefix({ ...params, prefix: tracks[0].title!.slice(0, 1).toUpperCase() })).offset : 0;
        results.push({ ids: tracks.map(t => t.id), count, page: page.map(t => t.id), prefixes, offset });
      }
      return results;
    });
    for (const result of checks) {
      expect(result.ids).not.toContain('t1');
      expect(result.count).toBe(result.ids.length);
      expect(result.page).toEqual(result.ids.slice(1, 2));
      expect(result.offset).toBe(0);
      if (result.count) expect(result.prefixes.length).toBeGreaterThan(0);
    }

    await page.locator('button[data-tab="clip-tandas"]').click();
    await expect(page.locator('#clip-tandas .tanda-row')).toHaveCount(1);
    await page.locator('button[data-tab="search-tandas"]').click();
    await expect(page.locator('#search-tandas .tanda-row[data-tanda-id="td1"]')).toHaveCount(0);
    await expect(page.locator('#search-tandas .tanda-row[data-tanda-id="td4"]')).toBeVisible();

    await page.locator('#rating-filter-mode').selectOption('unrated');
    await expect(page.locator('#clip-tandas .tanda-row')).toHaveCount(0);
    await page.locator('button[data-tab="clip-tracks"]').click();
    await expect(page.locator('#clip-tracks .track-row[data-track-id="t12"]')).toBeVisible();
    await expect(page.locator('#clip-tracks .track-row[data-track-id="t10"]')).toHaveCount(0);

    // A new render must use a changed rating even if that tanda was already cached.
    await page.evaluate(async () => {
      const tanda = (await window.tanda!.getTandasByIds(['td1']))[0];
      await window.tanda!.saveTanda({ ...tanda, rating: 2 });
    });
    await page.locator('#rating-filter-mode').selectOption('atMost');
    await expect(page.locator('#clip-tracks .track-row[data-track-id="t1"]')).toBeVisible();
    await page.locator('#rating-filter-clear').click();
    await expect(page.locator('#clip-tracks .track-row')).toHaveCount(3);
    await expect(page.locator('#rating-filter-clear')).toBeHidden();
    expect(await page.locator('#playlist-list').innerText()).toBe(playlistBefore);
  } finally {
    await launched.close();
  }
});
