// Dashboard Cuaca Aziz - browser checks against `node server-only.js --mock` (made-up data, no internet needed).
const { test, expect } = require('@playwright/test');
const fx = require('./fixtures/make');

/* the page itself must never load anything from the internet; web sites inside frames are cut off in tests */
async function guard(page, problems) {
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push('console: ' + m.text()); });
  await page.route(u => !/^http:\/\/127\.0\.0\.1:/.test(u.href), r => r.abort());
}
async function ready(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.MC && MC.state.snap && (MC.state.snap.stations || []).length > 0, null, { timeout: 20000 });
}

test('dashboard shows water levels, weather, MET and alerts', async ({ page }) => {
  const problems = []; await guard(page, problems);
  await ready(page);
  await expect(page.locator('#dashTiles .tile')).toHaveCount(6);
  await expect(page.locator('#waterBody tr.click')).toHaveCount(6);            /* 4 fresh + 2 old (in <details>) */
  await expect(page.locator('#waterBody > table tr.click').first()).toContainText('Sg. Chukai');
  await expect(page.locator('#waterBody > table')).toContainText('Warning');
  await expect(page.locator('#metBody .fc .d')).toHaveCount(7);
  await expect(page.locator('#warnBody')).toContainText('Continuous Rain');
  await expect(page.locator('#chartRain svg')).toBeVisible();
  await expect(page.locator('#seaBody svg')).toBeVisible();
  await expect(page.locator('#bellBadge')).toHaveText('5');
  await expect(page.locator('#dashLinks .link')).toHaveCount(29);
  await expect(page.locator('#cardOffshore')).toBeHidden();
  await expect(page.locator('#profName')).toHaveText('Kemaman');
  await expect(page.locator('#statusText')).toContainText('Updated');
  expect(problems).toEqual([]);
});

test('all 29 sites open as tabs (6 kept, oldest closed), then "Close all"', async ({ page }) => {
  const problems = []; await guard(page, problems);
  await ready(page);
  const ids = await page.evaluate(() => MCCore.SITES.map(s => s.id));
  expect(ids.length).toBe(29);
  /* sites whose stand-in is a card on the dashboard (MET, JPS, tides) */
  const toCard = await page.evaluate(() => MCCore.SITES.filter(s => { const a = MCCore.altFor(s, MC.state.settings); return a && a.kind === 'view'; }).map(s => s.id));
  expect(toCard.length).toBe(10);
  await page.click('.site[data-site="tideforecast"]');
  await expect(page.locator('#view-dashboard')).toHaveClass(/on/);
  /* no stand-in at all (Kamera banjir, NADMA): straight to a new tab, no tab here */
  const direct = await page.evaluate(() => MCCore.SITES.filter(s => s.noFrame && !MCCore.altFor(s, MC.state.settings)).map(s => s.id));
  expect(direct.sort()).toEqual(['camera', 'nadma']);
  /* infobanjir Terengganu & met.gov.my: the real site in a window over the app */
  const myOnly = await page.evaluate(() => MCCore.SITES.filter(s => MCCore.malaysiaOnly(s, MC.state.settings)).map(s => s.id));
  expect(myOnly.sort()).toEqual(['camera', 'infobanjir', 'metmalaysia', 'metradar', 'rainfall', 'waterlevel']);
  const framed = ids.filter(x => !toCard.includes(x) && !direct.includes(x) && !myOnly.includes(x));
  for (const id of framed) {
    await page.click('.site[data-site="' + id + '"]');
    await expect(page.locator('#view-site')).toHaveClass(/on/);
    await expect(page.locator('.stab[aria-current="true"]')).toHaveAttribute('data-tab', id);
    await expect(page.locator('#siteHost .frame.on')).toHaveCount(1);
  }
  await expect(page.locator('.stab')).toHaveCount(6);
  await page.click('.stab[data-tab="' + framed[framed.length - 1] + '"] .x');
  await expect(page.locator('.stab')).toHaveCount(5);
  await expect(page.locator('#closeAllBtn')).toHaveText('Close all (5)');
  await page.click('#closeAllBtn');
  await expect(page.locator('.stab')).toHaveCount(0);
  await expect(page.locator('#view-dashboard')).toHaveClass(/on/);
  /* keyboard: Ctrl+Shift+W closes all too */
  await page.click('.site[data-site="ventusky"]'); await page.click('.site[data-site="storms"]');
  await expect(page.locator('.stab')).toHaveCount(2);
  await page.keyboard.press('Control+Shift+W');
  await expect(page.locator('.stab')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('sites that refuse frames: a new tab straight away, a stand-in inside the app, or a card if pop-ups are blocked', async ({ page, context }) => {
  await guard(page, []);
  await ready(page);
  await page.evaluate(() => fetch('/api/refresh', { method: 'POST', headers: { 'X-MC': '1' } }));
  /* site health check runs 20 s after start in the mock server; wait for it */
  await page.waitForFunction(() => MC.state.snap.sites && MC.state.snap.sites.windy, null, { timeout: 40000 });
  /* refused (by the PC's live check) and no stand-in */
  const bare = await page.evaluate(() => MCCore.SITES.filter(s => MCCore.siteBlocked(s, MC.state.snap.sites[s.id]) && !MCCore.altFor(s, MC.state.settings)).map(s => s.id));
  expect(bare.length).toBeGreaterThan(0);
  await context.route(/^https:\/\/(portalbencana\.nadma\.gov\.my|infobanjir\.terengganu\.gov\.my)\//, r => r.fulfill({ status: 200, contentType: 'text/html', body: 'x' }));
  const [tab] = await Promise.all([context.waitForEvent('page'), page.click('.site[data-site="' + bare[0] + '"]')]);
  await tab.close();
  await expect(page.locator('.stab[data-tab="' + bare[0] + '"]')).toHaveCount(0);
  /* pop-ups blocked: the card with the button */
  await page.evaluate(() => { window.open = () => null; });
  await page.click('.site[data-site="' + bare[0] + '"]');
  await expect(page.locator('#siteHost .frame.on .fmsg')).toContainText('does not allow');
  /* Windy refuses too, but has a stand-in from the same source (Windy embed) */
  await page.click('.site[data-site="windy"]');
  await expect(page.locator('#siteHost .frame.on .altbar')).toContainText('Windy (embed)');
  await page.click('.site[data-site="ventusky"]');
  await expect(page.locator('#siteHost .frame.on iframe')).toHaveCount(1);
});

test('command palette (Ctrl+K) finds a site and opens it', async ({ page }) => {
  await guard(page, []);
  await ready(page);
  await page.keyboard.press('Control+k');
  await page.fill('#palInput', 'tides 4');
  await page.keyboard.press('Enter');
  await expect(page.locator('#topTitle')).toHaveText('Tides 4 Fishing');
});

test('settings are saved on the PC and come back after reload', async ({ page }) => {
  await guard(page, []);
  await ready(page);
  await page.click('[data-view="settings"]');
  await page.fill('#f_rain3hMm', '35');
  await page.selectOption('#f_refreshMin', '15');
  await page.click('#setSave');
  await expect(page.locator('#setMsg')).toContainText('Saved');
  await page.reload();
  await page.waitForFunction(() => window.MC && MC.state.snap);
  await page.click('[data-view="settings"]');
  await expect(page.locator('#f_rain3hMm')).toHaveValue('35');
  await expect(page.locator('#f_refreshMin')).toHaveValue('15');
  /* put it back for the other tests */
  await page.fill('#f_rain3hMm', '20'); await page.selectOption('#f_refreshMin', '10'); await page.click('#setSave');
  await expect(page.locator('#setMsg')).toContainText('Saved');
});

test('acknowledging alerts clears the badge; test alert shows a toast', async ({ page }) => {
  await guard(page, []);
  await ready(page);
  await page.click('[data-view="alerts"]');
  await expect(page.locator('#aActive .aitem')).toHaveCount(5);
  await expect(page.locator('#aActive .aitem', { hasText: 'MET: Strong Winds' })).toContainText('wind 40–50 km/h (22–27 knot)');
  await page.click('#aTest');
  await expect(page.locator('#toasts .toast').first()).toContainText('Test alert');
  await page.click('#aAckAll');
  await expect(page.locator('#bellBadge')).toBeHidden();
  await expect(page.locator('#aActive .aitem.acked')).toHaveCount(5);
  await expect(page.locator('#aLog tr').first()).toBeVisible();
});

test('history chart draws after a few updates, CSV downloads', async ({ page }) => {
  await guard(page, []);
  await ready(page);
  await page.click('#btnRefresh');
  await page.waitForTimeout(500);
  await page.click('#btnRefresh');
  await page.waitForTimeout(500);
  await page.click('[data-view="history"]');
  await expect(page.locator('#hStation option').first()).toContainText('Sg. Chukai');
  await expect(page.locator('#chartLevel svg path.ln')).toHaveCount(1);
  await expect(page.locator('#chartLevel svg .thl')).toHaveCount(3);
  const dl = page.waitForEvent('download');
  await page.click('#hCsv');
  expect((await dl).suggestedFilename()).toMatch(/^dashboard-cuaca-history-.*\.csv$/);
});

test('wall shows 4 panes, then 6', async ({ page }) => {
  await guard(page, []);
  await ready(page);
  await page.click('[data-view="wall"]');
  await expect(page.locator('#wall .pane')).toHaveCount(4);
  await page.selectOption('#wLayout', '2x3');
  await expect(page.locator('#wall .pane')).toHaveCount(6);
  await page.selectOption('#wall .pane:first-child select', 'nadma');
  await expect(page.locator('#wall .pane:first-child select')).toHaveValue('nadma');
});

test('phone layout: bottom bar and slide-in site list', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await guard(page, []);
  await ready(page);
  const rail = await page.locator('.rail').boundingBox();
  expect(rail.y).toBeGreaterThan(700);
  await page.click('#topMenu');
  await expect(page.locator('#app')).toHaveClass(/side-open/);
  await page.click('.site[data-site="nadma"]');
  await expect(page.locator('#app')).not.toHaveClass(/side-open/);
  await expect(page.locator('#topTitle')).toHaveText('NADMA Portal');
  await ctx.close();
});

test('phone without the PC: falls back to fetching the public APIs directly', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push(e.message));
  /* PC unreachable */
  await page.route(/\/api\//, r => r.abort());
  /* public APIs answer (they allow cross-origin requests) */
  await page.route(u => /open-meteo\.com|api\.data\.gov\.my/.test(u.href), async r => {
    const data = await fx.forUrl(r.request().url(), Date.now());
    await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.MC && MC.state.mode === 'direct' && MC.state.snap && MC.state.snap.weather, null, { timeout: 20000 });
  await expect(page.locator('#statusText')).toContainText('direct mode');
  await expect(page.locator('#metBody .fc .d')).toHaveCount(7);
  await expect(page.locator('#waterBody')).toContainText('JPS');
  await expect(page.locator('#bellBadge')).not.toBeHidden();
  expect(problems).toEqual([]);
  await ctx.close();
});

test('service worker keeps the app for the phone', async ({ page }) => {
  await page.goto('/');
  const cached = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 40; i++) {
      const keys = await caches.keys();
      if (keys.length) { const c = await caches.open(keys[0]); const n = (await c.keys()).length; if (n >= 20) return n; }
      await new Promise(r => setTimeout(r, 250));
    }
    return 0;
  });
  expect(cached).toBeGreaterThanOrEqual(20);
});

test('profile switch: Irong Barat offshore dashboard, sites follow the profile, history shows sea readings', async ({ page }) => {
  const problems = []; await guard(page, problems);
  await ready(page);
  await page.click('.site[data-site="windywave"]');
  await expect(page.locator('#sUrl')).toContainText('4.232/103.423');
  await page.click('[data-view="dashboard"]');
  await page.click('#profBtn');
  await expect(page.locator('#profMenu [data-prof]')).toHaveCount(2);
  await page.click('#profMenu [data-prof="irong-barat"]');
  await page.waitForFunction(() => MC.state.snap && MC.state.snap.profile && MC.state.snap.profile.id === 'irong-barat', null, { timeout: 15000 });
  await expect(page.locator('#profName')).toHaveText('Irong Barat (offshore)');
  await expect(page.locator('#cardOffshore')).toBeVisible();
  await expect(page.locator('#cardWater')).toBeHidden();
  await expect(page.locator('#cardMet')).toBeHidden();
  await expect(page.locator('#dashTiles .tile')).toHaveCount(7);
  await expect(page.locator('#dashTiles')).toContainText('knot');
  await expect(page.locator('#dashTiles')).toContainText('HIGH');
  await expect(page.locator('#offTable tbody tr')).toHaveCount(9);
  await expect(page.locator('#chartWave svg .th')).toHaveCount(1);
  await expect(page.locator('#bellBadge')).toHaveText('6');
  await expect(page.locator('#topSub')).toContainText('offshore 5.5501, 104.7745');
  /* the open map moved to the profile's point */
  await page.click('.site[data-site="windywave"]');
  await expect(page.locator('#sUrl')).toContainText('5.550/104.775');
  await page.click('[data-view="history"]');
  await expect(page.locator('#hStation option')).toHaveCount(4);
  await expect(page.locator('#hStation')).toHaveValue('@wave');
  await page.click('[data-view="settings"]');
  await expect(page.locator('#f_profileName')).toHaveValue('Irong Barat (offshore)');
  await expect(page.locator('#f_waterDistrict')).toBeHidden();
  await expect(page.locator('#profList .prow.on')).toContainText('Irong Barat');
  /* back to Kemaman for the other tests */
  await page.click('#profBtn'); await page.click('#profMenu [data-prof="kemaman"]');
  await page.waitForFunction(() => MC.state.snap && MC.state.snap.profile && MC.state.snap.profile.id === 'kemaman', null, { timeout: 15000 });
  await page.click('[data-view="dashboard"]');
  await expect(page.locator('#cardWater')).toBeVisible();
  /* Kemaman's own alerts are back (acknowledgements made earlier are kept); no offshore alerts linger */
  const keys = await page.evaluate(() => MC.state.snap.alerts.active.map(a => a.key.split(':')[0]));
  expect(keys).toContain('water');
  expect(keys).not.toContain('thunder');
  expect(problems).toEqual([]);
});

test('add a new profile from Settings, then delete it', async ({ page }) => {
  await guard(page, []);
  await ready(page);
  await page.click('[data-view="settings"]');
  await page.fill('#newProfName', 'Platform Ujian');
  await page.selectOption('#newProfKind', 'offshore');
  await page.fill('#newProfLat', '5.3');
  await page.fill('#newProfLon', '104.9');
  await page.click('#newProfAdd');
  await expect(page.locator('#profName')).toHaveText('Platform Ujian');
  await expect(page.locator('#profList .prow')).toHaveCount(3);
  await expect(page.locator('#f_marineLat')).toHaveValue('5.3');
  page.once('dialog', d => d.accept());
  await page.click('#profList .prow.on [data-prof-del]').catch(async () => {
    const id = await page.evaluate(() => MC.state.profiles.active);
    await page.click('[data-prof-del="' + id + '"]');
  });
  await expect(page.locator('#profList .prow')).toHaveCount(2);
  await expect(page.locator('#profName')).toHaveText('Kemaman');
});

test('splash page (phones) has the logo, name and loading bar', async ({ page }) => {
  await page.goto('/splash.html');
  await expect(page.locator('.app-name')).toHaveText('Dashboard Cuaca Aziz');
  await expect(page.locator('.subtext')).toContainText('Loading');
  expect(await page.locator('img.logo').evaluate(i => i.naturalWidth)).toBe(256);
  await expect(page.locator('.copyright')).toContainText('Aziz Mohamad');
});

/* Malay words that must not appear anywhere when English is on (place names like "Sg." / "Kg." are allowed). */
const MALAY = /\b(daftar|percuma|tekan|emel|ke|aktif|baharu|ralat|sambung|pasang|kosong|purata|arah|suhu|kelembapan|penglihatan|alun|tiupan|paparan|cari|padam|naik|turun|terbuka|maks|kemas|muat|aktifkan|titik|lihat|dan|atau|tiada|amaran|waspada|bahaya|tetapan|simpan|tutup|buka|sejarah|kemas kini|ramalan|hujan|angin|ombak|laman|paras|lalu|sekarang|telefon|semua|profil baharu|jarak|ribut|petir|sumber|gagal|minit|jam|hari ini|esok|tinggi|rendah|sederhana|untuk|dengan|tidak|belum|sila|pilih|tukar|bunyi|notifikasi|ambang|kategori|cuaca|banjir|kecemasan|kamera|lokasi|negeri|daerah|stesen)\b/i;
const ALLOWED = /Dashboard Cuaca Aziz|cuaca-relay|Info Banjir|Monitor Cuaca|Sg\.|Kg\.|Jambatan|Air Putih|Ban Ho|Bahasa Melayu|Cuaca Local CA|dashboard-cuaca|Pejabat|Tebak|Cherul/g;

async function malayLeft(page) {
  return page.evaluate(([src, allow]) => {
    const re = new RegExp(src, 'i'), al = new RegExp(allow, 'g'), out = [];
    const skip = el => el.closest('script,style,webview,iframe,textarea,[data-noi18n],[hidden],.frame');
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const p = n.parentElement; if (!p || skip(p)) continue;
      const t = n.nodeValue.replace(al, ' ');
      if (re.test(t) && p.getClientRects().length) out.push(t.trim().slice(0, 90));
    }
    document.querySelectorAll('[title],[placeholder],[aria-label]').forEach(e => {
      if (skip(e)) return;
      ['title', 'placeholder', 'aria-label'].forEach(a => { const v = (e.getAttribute(a) || '').replace(al, ' '); if (re.test(v)) out.push('@' + a + ': ' + v.slice(0, 90)); });
    });
    return [...new Set(out)];
  }, [MALAY.source, ALLOWED.source]);
}

async function snapReady(page) {
  await page.waitForFunction(() => window.MC && MC.state.snap && MC.state.snap.profile, null, { timeout: 20000 });
}

test('English everywhere: no Malay left in any view, then BM switch and back', async ({ page }) => {
  await guard(page, []);
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const found = [];
  for (const v of ['dashboard', 'history', 'wall', 'settings', 'alerts']) {
    const b = page.locator('[data-view="' + v + '"]').first();
    if (await b.count()) { await b.click(); await page.waitForTimeout(300); found.push(...(await malayLeft(page)).map(x => v + ': ' + x)); }
  }
  await page.click('#btnBell').catch(() => {}); await page.waitForTimeout(200);
  found.push(...(await malayLeft(page)).map(x => 'bell: ' + x));
  await page.keyboard.press('Escape');
  await page.click('#profBtn'); await page.waitForTimeout(150);
  found.push(...(await malayLeft(page)).map(x => 'profile menu: ' + x));
  await page.click('#profBtn');
  await page.keyboard.press('Control+k'); await page.keyboard.type('a'); await page.waitForTimeout(200);
  found.push(...(await malayLeft(page)).map(x => 'palette: ' + x));
  await page.keyboard.press('Escape');
  /* offshore profile too */
  await page.click('#profBtn'); await page.click('#profMenu [data-prof="irong-barat"]');
  await expect(page.locator('#profName')).toHaveText('Irong Barat (offshore)');
  await page.waitForFunction(() => MC.state.snap && MC.state.snap.profile && MC.state.snap.profile.id === 'irong-barat', null, { timeout: 15000 });
  await page.click('[data-view="dashboard"]'); await page.waitForTimeout(500);
  found.push(...(await malayLeft(page)).map(x => 'offshore: ' + x));
  expect(found).toEqual([]);

  /* switch to BM */
  await expect(page.locator('#langBtn')).toHaveText('BM');
  await Promise.all([page.waitForEvent('load'), page.click('#langBtn')]);
  await snapReady(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ms');
  await expect(page.locator('#langBtn')).toHaveText('EN');
  await expect(page.locator('#statusText')).toContainText('Kemas kini');
  await expect(page.locator('#dashTiles')).toContainText('TINGGI');
  await page.click('[data-view="settings"]');
  await expect(page.locator('#f_lang')).toHaveValue('ms');
  /* back to English through Settings */
  await page.selectOption('#f_lang', 'en');
  await Promise.all([page.waitForEvent('load'), page.click('#setSave')]);
  await snapReady(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#statusText')).toContainText('Updated');
  await page.click('#profBtn'); await page.click('#profMenu [data-prof="kemaman"]');
  await expect(page.locator('#profName')).toHaveText('Kemaman');
});

test('phone setup pages follow the language', async ({ page }) => {
  await page.goto('/phone.html');
  await expect(page.locator('h1')).toHaveText('Set up this phone / tablet', { useInnerText: true });
  await page.click('#langSw');
  await expect(page.locator('h1')).toHaveText('Sediakan telefon / tablet ini', { useInnerText: true });
  await page.goto('/splash.html');
  await expect(page.locator('.subtext')).toContainText('Loading');
});

test('MET warning card: tiles, your areas, full text folded; same in BM', async ({ page }) => {
  await guard(page, []);
  await page.goto('/');
  await snapReady(page);
  await page.click('#profBtn'); await page.click('#profMenu [data-prof="irong-barat"]');
  await page.waitForFunction(() => MC.state.snap && MC.state.snap.profile && MC.state.snap.profile.id === 'irong-barat', null, { timeout: 15000 });
  const card = page.locator('#warnBody .mcard', { hasText: 'Strong winds and rough seas' });
  await expect(card).toHaveCount(1);                                   /* three copies from MET, one card */
  await expect(card.locator('.mtile')).toHaveCount(4);
  await expect(card.locator('.mtile').first()).toContainText('40–50');
  await expect(card.locator('.mtile').first()).toContainText('22–27 knot');
  await expect(card.locator('.mrow:not(.other) > b')).toHaveText(['Terengganu', 'Condore', 'Reef North']);
  await expect(card.locator('.mrow', { hasText: 'Reef North' })).toContainText('western part');
  const full = card.locator('details.mfull');
  await expect(full).not.toHaveAttribute('open', '');
  await expect(card.locator('.mtext')).toBeHidden();
  await full.locator('summary').click();
  await expect(card.locator('.mtext .msec').first()).toHaveText('Section A · For Malaysian waters (within 24 nautical miles)');
  await expect(card.locator('.mtext .me').first()).toHaveText('Terengganu');
  await expect(card.locator('.mtext .minstr')).toContainText('These strong winds and rough seas conditions are dangerous.');
  /* every word MET wrote is still there */
  const words = await card.locator('.mtext').innerText();
  for (const w of ['Lahad Datu', 'small crafts, recreational sea activities and water sports', 'Eastern part of Phuket', 'Layang-Layang']) expect(words).toContain(w);
  /* stays open across a data refresh */
  await page.evaluate(() => MC.renderAll());
  await expect(card.locator('details.mfull')).toHaveAttribute('open', '');
  /* BM uses MET's own BM text */
  await Promise.all([page.waitForEvent('load'), page.click('#langBtn')]);
  await snapReady(page);
  const kad = page.locator('#warnBody .mcard', { hasText: 'Amaran angin kencang' });
  await expect(kad.locator('.mtile').first()).toContainText('km/j');
  await kad.locator('details.mfull summary').click();
  await expect(kad.locator('.mtext .msec').first()).toHaveText('Seksyen A · Untuk perairan Malaysia (dalam lingkungan 24 batu nautika)');
  await expect(kad.locator('.mtext')).toContainText('sehingga 50 kmsj');
  await Promise.all([page.waitForEvent('load'), page.click('#langBtn')]);
  await snapReady(page);
  await page.click('#profBtn'); await page.click('#profMenu [data-prof="kemaman"]');
  await expect(page.locator('#profName')).toHaveText('Kemaman');
});
