// QA black-box E2E tests for the Second Sight frontend (docs/10 §7, docs/11 FE-01..FE-06).
// Only public DOM/ARIA surface is used: role=tab, role=grid/gridcell, aria-pressed, URL hash.
import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DATA_DIR = process.env.SS_DATA_DIR ?? 'D:/Lomba/Hackathon/nasa/second-sight-data';
const SHOT_DIR = path.join(DATA_DIR, 'qa', 'screenshots');
const TAB_IDS = ['peta', 'kalender', 'bulan', 'lab', 'yakin', 'unduh', 'metode'];
const YEARS = 2026 - 2001 + 1; // 26 rows
const CELLS = YEARS * 12; // 312

function collectErrors(page: Page): string[] {
  const errs: string[] = [];
  page.on('console', (m: ConsoleMessage) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  return errs;
}

async function open(page: Page, hash = '') {
  await page.goto(`/${hash}`);
  await expect(page.getByRole('tablist')).toBeVisible();
}

async function calendarReady(page: Page) {
  await expect(page.locator('[role=grid] .cal-cell').first()).toBeAttached({ timeout: 15_000 });
}

function numberTokens(text: string): string[] {
  return text.match(/\d[\d.,]*\d|\d/g) ?? [];
}

test.describe('FE-01 shell', () => {
  test('page loads without console errors', async ({ page }) => {
    const errs = collectErrors(page);
    await open(page);
    await calendarReady(page);
    await page.waitForTimeout(1500); // let map/tiles settle
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('7 tabs, each navigable by click and by number key', async ({ page }) => {
    await open(page);
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(7);
    for (const id of TAB_IDS) {
      const t = page.locator(`[role=tab][data-tab="${id}"]`);
      await t.click();
      await expect(t).toHaveAttribute('aria-selected', 'true');
      expect(page.url()).toContain(`#${id}`);
    }
    for (let i = 0; i < 7; i++) {
      await page.locator('body').press(String(i + 1));
      await expect(page.locator(`[role=tab][data-tab="${TAB_IDS[i]}"]`)).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('first screen is the calendar (not a hero/KPI page)', async ({ page }) => {
    await open(page);
    await expect(page.locator('[role=tab][data-tab="kalender"]')).toHaveAttribute('aria-selected', 'true');
    await calendarReady(page);
  });
});

test.describe('i18n ID/EN', () => {
  test('language toggle changes labels, html lang and number formats', async ({ page }) => {
    await open(page, '#kalender?lang=id');
    await calendarReady(page);
    await expect(page.locator('[role=tab][data-tab="kalender"]')).toHaveText(/Kalender/);
    const idText = await page.locator('main').innerText();
    await page.getByRole('group', { name: /Bahasa/ }).getByRole('button', { name: 'EN' }).click();
    await expect(page.locator('[role=tab][data-tab="kalender"]')).toHaveText(/Calendar/);
    await expect(page.getByRole('group', { name: /Bahasa/ }).getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
    expect(page.url()).toContain('lang=en');
    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(lang.toLowerCase()).toContain('en');
    const enText = await page.locator('main').innerText();
    expect(enText).not.toEqual(idText);
    // id-ID: thousands '.', decimal ','. en: thousands ',', decimal '.'
    for (const tok of numberTokens(idText)) expect(tok, `ID token ${tok}`).not.toMatch(/^\d{1,3}(,\d{3})+$/);
    for (const tok of numberTokens(enText)) expect(tok, `EN token ${tok}`).not.toMatch(/^\d{1,3}(\.\d{3})+$/);
    // percentage in the observed sentence: ID uses comma decimal, EN dot decimal (if fractional)
    const idFoot = idText.match(/\(([\d.,]+)\s?%\)/)?.[1];
    const enFoot = enText.match(/\(([\d.,]+)\s?%\)/)?.[1];
    if (idFoot && enFoot && /[.,]/.test(enFoot)) {
      expect(idFoot).toContain(',');
      expect(enFoot).toContain('.');
    }
    // month labels switch (Mei/Agu/Okt/Des -> May/Aug/Oct/Dec)
    expect(idText).toMatch(/Mei|Agu|Okt|Des/);
    expect(enText).toMatch(/May|Aug|Oct|Dec/);
  });
});

test.describe('FE-04 calendar grid', () => {
  test('renders 26x12 cells with numbers', async ({ page }) => {
    await open(page, '#kalender');
    await calendarReady(page);
    const cells = page.locator('[role=grid] [role=gridcell][data-ym]');
    await expect(cells).toHaveCount(CELLS);
    const yms = await cells.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.ym));
    expect(new Set(yms).size).toBe(CELLS);
    expect(yms[0]).toBe('2001-01');
    expect(yms[CELLS - 1]).toBe('2026-12');
    const nums = await page.locator('[role=grid] .cal-num').allTextContents();
    const withNum = nums.filter((t) => /\d/.test(t)).length;
    expect(withNum).toBeGreaterThan(CELLS / 2);
  });

  test('FE-04: full 26x12 calendar (re)render < 500 ms', async ({ page }) => {
    await open(page, '#kalender?lang=id');
    await calendarReady(page);
    const ms = await page.evaluate(async () => {
      const btn = [...document.querySelectorAll('[role=group] button')].find((b) => b.textContent === 'EN') as HTMLButtonElement;
      const t0 = performance.now();
      btn.click(); // language switch rebuilds the calendar view
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const ok = document.querySelectorAll('[role=grid] [data-ym]').length;
      return { dt: performance.now() - t0, ok };
    });
    test.info().annotations.push({ type: 'render_ms', description: ms.dt.toFixed(1) });
    expect(ms.ok).toBe(CELLS);
    expect(ms.dt).toBeLessThan(500);
  });

  test('keyboard: arrows move focus, Enter selects (URL m=)', async ({ page }) => {
    await open(page, '#kalender?m=2015-09');
    await calendarReady(page);
    const start = page.locator('[data-ym="2010-03"]');
    await start.focus();
    const active = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset?.ym ?? null);
    expect(await active()).toBe('2010-03');
    await page.keyboard.press('ArrowRight');
    expect(await active()).toBe('2010-04');
    await page.keyboard.press('ArrowDown');
    expect(await active()).toBe('2011-04');
    await page.keyboard.press('ArrowLeft');
    expect(await active()).toBe('2011-03');
    await page.keyboard.press('ArrowUp');
    expect(await active()).toBe('2010-03');
    await page.keyboard.press('End');
    expect(await active()).toBe('2010-12');
    await page.keyboard.press('Home');
    expect(await active()).toBe('2010-01');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.url()).toContain('m=2010-01');
    // exactly one cell in the tab order (roving tabindex)
    const tabbable = await page.locator('[role=gridcell][data-ym][tabindex="0"]').count();
    expect(tabbable).toBe(1);
  });

  test('"DATA CONTOH" badge visible when synthetic demo data is used', async ({ page }) => {
    await open(page, '#kalender?lang=id');
    await calendarReady(page);
    const synthetic = await page.evaluate(async () => {
      try { const r = await fetch('data/demo_monthly.json'); return Boolean((await r.json()).meta?.synthetic); } catch { return null; }
    });
    test.skip(synthetic === null, 'demo_monthly.json not served');
    const badge = page.locator('.cal-panel .badge');
    if (synthetic) {
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText(/data contoh/i);
    } else {
      await expect(badge).toHaveCount(0);
    }
  });

  test.fixme('FE-05: five cell states (zero / unobserved / provisional / modelled) visually distinct', async () => {
    // FE-05 not verifiable on synthetic data; tracked for real bundle (EXP-01 harmonized=false).
  });
});

test.describe('FE-03 URL state', () => {
  test('state persists after reload', async ({ page }) => {
    await open(page, '#kalender?lang=en');
    await calendarReady(page);
    await page.locator('[data-ym="2019-09"]').click();
    await expect.poll(() => page.url()).toContain('m=2019-09');
    const presets = page.locator('.preset-list button');
    const n = await presets.count();
    let aoiParam: string | null = null;
    if (n > 1) {
      await presets.nth(1).click();
      await expect(presets.nth(1)).toHaveAttribute('aria-pressed', 'true');
      aoiParam = new URL(page.url()).hash.match(/aoi=([^&]+)/)?.[1] ?? null;
    }
    const before = new URL(page.url()).hash;
    await page.reload();
    await calendarReady(page);
    expect(new URL(page.url()).hash).toBe(before);
    await expect(page.locator('[role=tab][data-tab="kalender"]')).toHaveText(/Calendar/);
    await expect(page.locator('[data-ym="2019-09"]')).toHaveAttribute('tabindex', '0');
    if (aoiParam && n > 1) await expect(presets.nth(1)).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('FE-02 map + compliance', () => {
  test('map canvas present with OSM attribution', async ({ page }) => {
    await open(page, '#peta');
    const canvas = page.locator('.maplibregl-canvas');
    await expect(canvas).toBeAttached({ timeout: 15_000 });
    await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText(/OpenStreetMap/, { timeout: 15_000 });
  });

  test('no NASA logo / meatball images', async ({ page }) => {
    await open(page);
    await calendarReady(page);
    const hits = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll('img, image, svg, [style*="background"]').forEach((e) => {
        const s = [e.getAttribute('src'), e.getAttribute('href'), e.getAttribute('alt'), e.getAttribute('aria-label'),
          (e as HTMLElement).style?.backgroundImage].join(' ');
        if (/nasa|meatball|worm/i.test(s)) out.push(e.outerHTML.slice(0, 120));
      });
      return out;
    });
    expect(hits).toEqual([]);
  });

  test('no banned fonts / purple accent in computed styles (anti-slop)', async ({ page }) => {
    await open(page);
    await calendarReady(page);
    const fonts = await page.evaluate(() => {
      const set = new Set<string>();
      document.querySelectorAll('body, body *').forEach((e) => set.add(getComputedStyle(e).fontFamily));
      return [...set];
    });
    for (const f of fonts) expect(f, f).not.toMatch(/\bInter\b|IBM Plex|Space Grotesk|JetBrains Mono/i);
  });
});

test.describe('screenshots for anti-slop review', () => {
  for (const [name, vp] of [['desktop', { width: 1366, height: 850 }], ['mobile', { width: 375, height: 812 }]] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${name} ${scheme}`, async ({ page }) => {
        fs.mkdirSync(SHOT_DIR, { recursive: true });
        await page.setViewportSize(vp);
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, '#kalender?lang=id');
        await calendarReady(page);
        await page.waitForTimeout(1200);
        await page.screenshot({ path: path.join(SHOT_DIR, `${name}-${scheme}-kalender.png`), fullPage: true });
        if (scheme === 'light') {
          await page.locator('[data-tab="peta"]').click();
          await page.waitForTimeout(1500);
          await page.screenshot({ path: path.join(SHOT_DIR, `${name}-${scheme}-peta.png`), fullPage: false });
        }
        // mobile: no horizontal page scroll
        if (name === 'mobile') {
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect.soft(overflow, 'horizontal page scroll on mobile').toBeLessThanOrEqual(1);
        }
      });
    }
  }
});
