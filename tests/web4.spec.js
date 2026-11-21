// 4.1 web app (old look, new data): GitHub mirror for JPS & tides, 7/14/28 days, swell, no relay.
const { test, expect } = require('@playwright/test');
const F = require('./web-fixtures/make');

const flood = [];
async function sources(page, opts = {}) {
  const now = Date.now(), m = F.mirror(now);
  if (opts.jps) opts.jps(m.jps);
  const json = (r, b, st = 200) => r.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
  /* offshore comparison: one model per request; opts.offFail = models that answer HTTP 400 */
  const off = (r, other) => {
    const u = r.request().url();
    if (!F.isOffshore(u)) return other();
    if ((opts.offFail || []).some(m => u.includes('models=' + m))) return json(r, { error: true, reason: 'bad model' }, 400);
    return json(r, F.offshore(u, now));
  };
  await page.route(/^https:\/\/api\.open-meteo\.com\//, r => off(r, () => json(r, F.forecast(now, { gust: opts.gust }))));
  await page.route(/^https:\/\/marine-api\.open-meteo\.com\//, r => off(r, () => json(r, F.shiftOpenMeteo('om-marine.json', now))));
  await page.route(/^https:\/\/ensemble-api\.open-meteo\.com\//, r => off(r, () => json(r, F.shiftOpenMeteo('om-ensemble-gfs.json', now))));
  await page.route(/^https:\/\/flood-api\.open-meteo\.com\//, r => { flood.push(r.request().url()); return json(r, F.shiftOpenMeteo('om-flood.json', now - 7 * 86400000)); });
  await page.route(/^https:\/\/api\.data\.gov\.my\/weather\/warning/, r => json(r, F.warnings(now)));
  await page.route(/^https:\/\/api\.data\.gov\.my\/weather\/forecast/, r => json(r, F.metForecast(now).map(x => Object.assign(x, { location: { location_id: 'Ds065', location_name: 'Kemaman' } }))));
  await page.route(/^https:\/\/api\.data\.gov\.my\/flood-warning/, r => json(r, []));
  await page.route(/^https:\/\/raw\.githubusercontent\.com\//, r => /jps-TRG/.test(r.request().url()) ? json(r, m.jps) : /tide-cukai/.test(r.request().url()) ? json(r, m.tide) : json(r, {}, 404));
  await page.route(/^https:\/\/(embed\.windy\.com|www\.rainviewer\.com|webcams\.windy\.com)\//, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1 id=h>' + new URL(r.request().url()).hostname + '</h1>' }));
}
async function open(page, baseURL, opts) {
  await sources(page, opts);
  const api = []; page.on('request', r => { if (/\/api\//.test(r.url()) && r.url().startsWith(baseURL)) api.push(r.url()); });
  await page.goto(baseURL + '?web');
  await page.waitForFunction(() => window.MC && MC.state.snap && MC.state.snap.jps && MC.state.snap.outlook, null, { timeout: 30000 });
  return api;
}

test('old look with the new data: mirror JPS stations, full JPS table, 7/14/28 days, swell table, Cukai tides', async ({ page, baseURL }) => {
  const api = await open(page, baseURL);
  await expect(page.locator('#dashTiles .tile')).toHaveCount(6);
  await expect(page.locator('#waterBody tbody tr')).toHaveCount(8);
  await expect(page.locator('#waterBody')).toContainText('Sg. Mas di Kg. Sg. Mas (F2)');
  await expect(page.locator('#rainStBody > table tbody tr').first()).toBeVisible();
  await page.locator('#waterFull summary').click();
  expect(await page.locator('#waterFull table.jps thead th').allTextContents()).toEqual(['No.', 'Station ID', 'Station Name', 'District', 'Main Basin', 'Sub River Basin', 'Last Updated', 'Water Level (m)', 'Normal', 'Alert', 'Warning', 'Danger']);
  await expect(page.locator('#waterFull table.jps tbody tr')).toHaveCount(8);
  await page.locator('#waterFull [data-jall="1"]').click();
  await expect(page.locator('#waterFull table.jps tbody tr')).toHaveCount(46);
  await page.locator('#waterFull [data-jall="0"]').click();
  await expect(page.locator('#fcBody tbody tr')).toHaveCount(7);
  await page.locator('#fcSeg [data-days="14"]').click();
  await expect(page.locator('#fcBody tbody tr')).toHaveCount(14);
  await page.locator('#fcSeg [data-days="28"]').click();
  await expect(page.locator('#fcBody tbody tr')).toHaveCount(32);          /* 4 weeks + 28 days */
  await page.locator('#fcSeg [data-days="7"]').click();
  await expect(page.locator('#seaBody tbody tr')).toHaveCount(10);
  await expect(page.locator('#tideSub')).toContainText('Tide Forecast');
  await expect(page.locator('#tideBody tbody tr')).toHaveCount(8);
  /* river flow forecast (stand-in for Flood Hub) at the river point */
  await expect(page.locator('#floodBody')).toContainText('m³/s');
  await expect(page.locator('#floodBody svg.chart')).toHaveCount(1);
  expect(flood.some(u => /latitude=4\.25&longitude=103\.4/.test(u))).toBe(true);
  expect(api).toEqual([]);
  await page.screenshot({ path: '/tmp/shots/v41-' + test.info().project.name + '.png', fullPage: true });
});

test('sites that refuse framing: stand-in inside the app or new tab, never the browser error page', async ({ page, baseURL, context }) => {
  await open(page, baseURL);
  await page.locator('.side [data-site="windywave"], [data-site="windywave"]').first().click();
  await expect(page.locator('.frame.on iframe, #siteHost .frame.on iframe').first()).toHaveAttribute('src', /embed\.windy\.com.*overlay=waves/);
  await page.locator('[data-site="tideforecast"]').first().click();
  await expect(page.locator('#view-dashboard')).toHaveClass(/on/);
  /* the Malaysia-only sites show their data on the dashboard, not a new tab */
  for (const [id, card] of [['waterlevel', '#cardWater'], ['rainfall', '#cardRainSt'], ['infobanjir', '#cardWater'], ['metmalaysia', '#cardMet']]) {
    await page.locator('[data-site="' + id + '"]').first().click();
    await expect(page.locator('#view-dashboard')).toHaveClass(/on/);
    await expect(page.locator(card)).toBeInViewport();
  }
  expect(context.pages().length).toBe(1);
  await page.locator('[data-site="floodhub"]').first().click();
  await expect(page.locator('#view-dashboard')).toHaveClass(/on/);
  /* no stand-in: straight to the site in a new tab, no card in between */
  await context.route(/^https:\/\/portalbencana\.nadma\.gov\.my\//, r => r.fulfill({ status: 200, contentType: 'text/html', body: 'x' }));
  const [tab] = await Promise.all([context.waitForEvent('page'), page.locator('[data-site="nadma"]').first().click()]);
  await tab.waitForLoadState();
  expect(tab.url()).toMatch(/nadma\.gov\.my/);
  await expect(page.locator('.stab[data-tab="nadma"]')).toHaveCount(0);
});

test('relay again: a refused site (Flood Hub) shows inside the app through the relay; relay test lists it', async ({ page, baseURL }) => {
  const harness = require('./relay-harness');
  const core = require('../www/assets/js/core');
  const R = await harness.start('k3y-web-411', { hosts: core.relayHosts(), tweaks: baseURL + 'relay-tweaks.js', route: (u, port) => /sites\.research\.google/.test(u) ? 'http://127.0.0.1:' + port + '/page'
    : /aras-air\/data-paras-air\/\?/.test(u) ? 'http://127.0.0.1:' + port + '/jps-page' : /aras-air/.test(u) ? 'http://127.0.0.1:' + port + '/jps-water' : /rainfall/.test(u) ? 'http://127.0.0.1:' + port + '/jps-rain' : /tide-forecast/.test(u) ? 'http://127.0.0.1:' + port + '/tides' : null });
  try {
    await open(page, baseURL);
    await page.click('[data-view="settings"]');
    await expect(page.locator('#relayCard')).toBeVisible();
    await page.fill('#f_relayUrl', 'http://127.0.0.1:' + R.relay.port);
    await page.fill('#f_relayKey', 'k3y-web-411');
    await page.click('#setSave');
    await page.waitForFunction(() => MC.state.settings.relayKey === 'k3y-web-411');
    await page.locator('[data-site="floodhub"]').first().click();
    await expect(page.locator('#siteHost .frame.on iframe')).toHaveAttribute('src', /\/k3y-web-411\/https\/sites\.research\.google\//);
    await page.reload();
    await page.waitForFunction(() => window.MC && MC.state.snap);
    expect(await page.evaluate(() => MC.state.settings.relayKey)).toBe('k3y-web-411');     /* kept */
    /* JPS read live through the relay (no waiting for GitHub); tides fall back to the GitHub copy when the page has no table */
    await page.evaluate(() => MC.Data.refresh());
    await page.waitForFunction(() => MC.state.snap.jps && MC.state.snap.jps.live, null, { timeout: 20000 });
    expect(await page.evaluate(() => MC.state.snap.stations.find(x => /Sg\. Mas/.test(x.name)).level)).toBe(31.7);
    await page.click('[data-view="dashboard"]');
    await expect(page.locator('#waterSub')).toContainText('live through the relay');
    await expect(page.locator('#tideSub')).toContainText('GitHub mirror');
    /* JPS water level site: the full page, with the profile's district picked by the relay's site fix */
    await page.locator('[data-site="jpsaras"]').first().click();
    await expect(page.locator('#siteHost .frame.on iframe')).toHaveAttribute('src', /aras-air\/data-paras-air\/\?state=TRG&type=NEGERI&lang=en#dcdistrict=Kemaman/);
    await expect(page.frameLocator('#siteHost .frame.on iframe').locator('#result')).toHaveText('district:Kemaman');
  } finally { R.stop(); }
});

test('offshore model comparison card: 3/7/14 days, chance & confidence, every model, sources, A4 report', async ({ page, baseURL }) => {
  await open(page, baseURL, { offFail: ['meteofrance_seamless'] });
  await expect(page.locator('#cardOffCmp')).toBeHidden();                    /* land profile: not shown */
  await page.click('#profBtn'); await page.click('#profMenu [data-prof="irong-barat"]');
  await expect(page.locator('#cardOffCmp')).toBeVisible();
  await expect(page.locator('#ocBody table.oc-days tbody tr')).toHaveCount(3, { timeout: 30000 });
  await expect(page.locator('#ocSub')).toContainText('5 wind models · 4 wave models');
  await expect(page.locator('#ocBody .oc-warnbox')).toContainText('Risk of squalls');
  await expect(page.locator('#ocBody .oc-warnbox')).toContainText('Chance of lightning');
  await expect(page.locator('#ocBody')).toContainText('north-east');
  await expect(page.locator('#ocBody svg.chart')).toHaveCount(2);
  expect(await page.locator('#ocBody .oc-arrows span').count()).toBeGreaterThan(6);
  expect(await page.locator('#ocBody .oc-days .oc-conf').first().textContent()).toMatch(/High|Medium|Low/);
  expect(await page.locator('#ocBody .oc-days tbody tr').first().locator('td').nth(3).textContent()).toMatch(/^\d+%$/);
  await page.locator('#ocSeg [data-days="7"]').click();
  await expect(page.locator('#ocBody table.oc-days tbody tr')).toHaveCount(7);
  await page.locator('#ocSeg [data-days="14"]').click();
  await expect(page.locator('#ocBody table.oc-days tbody tr')).toHaveCount(14);
  /* every model: 6 wind rows + 2 ensemble rows; 4 wave rows + confidence */
  await page.locator('details.oc-det[data-k="models"] summary').click();
  await expect(page.locator('#ocBody .oc-mat').first().locator('tbody tr')).toHaveCount(8);
  await expect(page.locator('#ocBody .oc-mat').nth(1).locator('tbody tr')).toHaveCount(5);
  await page.locator('details.oc-det[data-k="table"] summary').click();
  expect(await page.locator('#ocBody .oc-rows tbody tr').count()).toBeGreaterThan(40);
  await page.locator('details.oc-det[data-k="src"] summary').click();
  await expect(page.locator('#ocBody .oc-src li.bad')).toHaveCount(1);
  await expect(page.locator('#ocBody .oc-src li.ok')).toHaveCount(11);
  await expect(page.locator('#ocBody .oc-src')).toContainText('NOAA WAVEWATCH III');
  await page.locator('#cardOffCmp').screenshot({ path: '/tmp/shots/offcmp-' + test.info().project.name + '.png' });
  /* PDF: the report layout, then the browser's print (Save as PDF) */
  await page.locator('#ocSeg [data-days="7"]').click();
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await page.click('#ocPdf');
  expect(await page.evaluate(() => window.__printed)).toBe(1);
  await expect(page.locator('html')).toHaveClass(/printing/);
  expect(await page.title()).toMatch(/^Irong-Barat-\d{4}-\d\d-\d\d_\d{4}_LT$/);
  await expect(page.locator('#printRoot h1')).toContainText('Irong Barat');
  await expect(page.locator('#printRoot .oc-days tbody tr')).toHaveCount(7);
  await expect(page.locator('#printRoot svg.chart')).toHaveCount(2);
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: '/tmp/shots/Irong-Barat-report.pdf', format: 'A4', preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('html')).not.toHaveClass(/printing/);
  /* limits from Settings change the chance and the red line */
  const before = await page.evaluate(() => MC.state.settings.offWindKt);
  expect(before).toBe(15);
});

test('AI suggestion tab: offshore jobs Go / Caution / No-Go, limits, prompt; land flood risk by district & own places', async ({ page, baseURL, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1180, height: 820 });
  await open(page, baseURL);
  await page.addStyleTag({ content: '#toasts { display: none !important; }' });   /* clean screenshots */
  await page.click('#profBtn'); await page.click('#profMenu [data-prof="irong-barat"]');
  await page.waitForFunction(() => MC.state.settings.kind === 'offshore');
  await page.click('.rbtn[data-view="advisor"]');
  await expect(page.locator('#view-advisor')).toHaveClass(/on/);
  await expect(page.locator('#topTitle')).toHaveText('AI suggestion');
  await page.locator('#advQuick [data-q="3"]').click();
  await page.locator('#advRes [data-res="shift"]').click();
  await page.click('#advRun');
  await expect(page.locator('#advBody .adv-mat tbody tr').first()).toBeVisible({ timeout: 30000 });
  const rows = await page.locator('#advBody .adv-mat tbody tr').count();
  expect(rows).toBeGreaterThanOrEqual(5); expect(rows).toBeLessThanOrEqual(6);           /* 3 days x 2 shifts, minus a shift already over */
  await expect(page.locator('#advBody .adv-mat thead th')).toHaveCount(12);                 /* time + status + 10 jobs */
  await expect(page.locator('#advBody .adv-mat')).toContainText('Inter-rig boat');
  await expect(page.locator('#advBody .adv-sum')).toContainText('Outside work status');
  await page.locator('#view-advisor').evaluate(e => { e.scrollTop = document.getElementById('advOut').offsetTop - 10; });
  await page.screenshot({ path: '/tmp/shots/adv-off-0.png' });
  await page.locator('#advBody .adv-c').nth(3).click();
  await expect(page.locator('#advDetail')).toBeVisible();
  await expect(page.locator('#advDetail')).toContainText('Confidence');
  await page.screenshot({ path: '/tmp/shots/adv-off-1.png' });
  /* limits: change the boat Hs limit, the result follows */
  await expect(page.locator('#advLimitsBody tbody tr')).toHaveCount(11);
  await page.locator('#advLimitsBody tr[data-id="swing"] [data-k="h0"]').fill('3');
  await page.locator('#advLimitsBody tr[data-id="swing"] [data-k="h1"]').fill('4');
  await page.click('#advLimSave');
  await expect(page.locator('#advLimMsg')).toHaveText('Saved ✓');
  expect(JSON.parse(await page.evaluate(() => MC.state.settings.advLimits))).toEqual({ swing: { h: [3, 4] } });
  /* prompt */
  await page.click('#advPromptBtn');
  await expect(page.locator('#advPromptCard')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#advPrompt')).toHaveValue(/carian web \(Search\) ChatGPT/);
  await page.locator('#advTarget [data-t="claude"]').click();
  const text = await page.locator('#advPrompt').inputValue();
  expect(text).toMatch(/^# Penilaian cuaca & keadaan laut untuk kerja offshore — Irong Barat/);
  expect(text).toContain('web search) Claude'); expect(text).toContain('Swing rope: berhati-hati/henti pada');
  await expect(page.locator('#advOpenAI')).toHaveText('Open Claude ↗');
  await page.click('#advCopy');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  await page.locator('#advPromptCard').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/shots/adv-off-prompt.png' });
  await page.locator('#advLimitsBody').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/shots/adv-off-limits.png' });
  /* land: districts */
  await page.click('#profBtn'); await page.click('#profMenu [data-prof="kemaman"]');
  await page.waitForFunction(() => MC.state.settings.kind === 'land');
  await page.click('.rbtn[data-view="advisor"]');
  await page.locator('#advArea [data-area="district"]').click();
  await page.locator('#advRes [data-res="day"]').click();
  await page.click('#advRun');
  await expect(page.locator('#advBody .adv-mat thead th')).toHaveCount(9, { timeout: 30000 });   /* time + 8 districts */
  await expect(page.locator('#advBody .adv-mat')).toContainText('Hulu Terengganu');
  await expect(page.locator('#advOutTitle')).toHaveText('Flood risk');
  await page.locator('#view-advisor').evaluate(e => { e.scrollTop = document.getElementById('advOut').offsetTop - 10; });
  await page.screenshot({ path: '/tmp/shots/adv-land-1.png' });
  await page.locator('#view-advisor').evaluate(e => { e.scrollTop = document.querySelector('#advBody .adv-mat').offsetTop + document.getElementById('advOut').offsetTop - 60; });
  await page.screenshot({ path: '/tmp/shots/adv-land-2.png' });
  /* own places */
  await page.locator('#advPlaces').fill('Chukai; 4.23; 103.42; Chukai; pantai\nKg. Air Putih; 4.17; 103.30; Air Putih');
  await page.click('#advPlacesSave');
  await expect(page.locator('#advPlacesMsg')).toHaveText('Saved: 2 valid places.');
  await page.locator('#advArea [data-area="custom"]').click();
  await page.click('#advRun');
  await expect(page.locator('#advBody .adv-mat thead th')).toHaveCount(3, { timeout: 30000 });
  await page.locator('#advArea [data-area="station"]').click();
  await page.click('#advPromptBtn');
  await expect(page.locator('#advPrompt')).toHaveValue(/Penilaian risiko banjir — Kemaman/, { timeout: 30000 });
});
