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
  const K = F.kemaman(now);
  await page.route(/^https:\/\/raw\.githubusercontent\.com\//, r => {
    const u = r.request().url(), k = /\/kemaman\/(.+?\.json)/.exec(u);
    if (k) return k[1] === 'now.json' ? json(r, K.now) : K.files[k[1]] ? json(r, K.files[k[1]]) : json(r, {}, 404);
    return /jps-TRG/.test(u) ? json(r, m.jps) : /tide-cukai/.test(u) ? json(r, m.tide) : json(r, {}, 404);
  });
  await page.route(/tile\.openstreetmap\.org/, r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') }));
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
  for (const [id, card] of [['infobanjir', '#cardWater'], ['metmalaysia', '#cardMet']]) {
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
  await expect(page.locator('#advBody .adv-sum').first()).toContainText('Outside work status');
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

test('risk score card: Flood Risk Score with Weather / River / Coastal, Early Flood Warning from the readings; offshore score, early warnings, windows', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await open(page, baseURL);
  await expect(page.locator('#rkTitle')).toHaveText('📊 Flood risk score');
  await expect(page.locator('#rkBody .rk-part')).toHaveCount(3);
  await expect(page.locator('#rkBody .rk-parts')).toContainText('Weather risk');
  await expect(page.locator('#rkBody .rk-parts')).toContainText('River risk');
  await expect(page.locator('#rkBody .rk-parts')).toContainText('Coastal risk');
  expect(+(await page.locator('#rkBody .rk-score b').textContent())).toBeGreaterThanOrEqual(0);
  /* a river rising 0.3 m/h for 3 hours, still below Waspada -> early flood warning (from the app's own readings) */
  const st = await page.evaluate(() => {
    const x = MC.state.snap.stations.find(s => !s.stale && s.level !== null && s.alert > 4 && s.alert - s.level > 0.5 && s.alert - s.level < 3 && !/muara|yak yah/i.test(s.name));   /* upstream: low-lying rivers wait for 20 h of data (tide) */
    const now = Date.now(), key = 'mc_d_hist_' + MC.state.profiles.active;
    const hist = [3, 2, 1].map(h => ({ t: now - h * 3600000, levels: { [x.id]: x.level - 0.3 * h } }));
    localStorage.setItem(key, JSON.stringify(hist));
    return { name: x.name, id: x.id };
  });
  await page.click('#btnRefresh');
  await expect(page.locator('#rkBody .rk-ew')).toContainText(/(Notice: river rising|Early warning: close to flooding|Early flood warning) \((4|24) hours\): /, { timeout: 20000 });
  await expect(page.locator('#rkBody .rk-ew')).toContainText(st.name);
  await expect(page.locator('#rkBody .rk-ew')).toContainText(/Confidence \d+%: trend \d+\/40 · rain \d+\/25/);
  await expect(page.locator('#rkBody .rk-win')).toContainText('+0.30');
  /* in the bell list; it only rings at 85 % or more */
  const a = await page.evaluate(n => MC.state.snap.alerts.active.find(x => x.title.indexOf(n) > 0 && /^(Notice: river rising|Early warning|Early flood warning)/.test(x.title)), st.name);
  expect(a).toBeTruthy();
  const conf = +a.body.match(/Confidence (\d+)%/)[1];
  expect(a.quiet).toBe(conf < 85);
  if (conf < 85) expect(a.body).toContain('below 85%: no notification');
  await page.addStyleTag({ content: '#toasts { display: none !important; }' });
  await page.locator('#cardRisk').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/shots/risk-land.png' });
  /* AI tab: the score and its three parts in each cell */
  await page.click('.rbtn[data-view="advisor"]');
  await page.locator('#advArea [data-area="station"]').click();
  await page.locator('#advRes [data-res="day"]').click();
  await page.click('#advRun');
  await expect(page.locator('#advBody .adv-c').first()).toContainText('score', { timeout: 30000 });
  await expect(page.locator('#advBody')).toContainText(/Notice: river rising|Early warning|Early flood warning/);
  await page.locator('#advBody .adv-c').first().click();
  await expect(page.locator('#advDetail .rk-part')).toHaveCount(3);
  /* offshore */
  await page.click('#profBtn'); await page.click('#profMenu [data-prof="irong-barat"]');
  await page.waitForFunction(() => MC.state.settings.kind === 'offshore');
  await page.click('.rbtn[data-view="dashboard"]');
  await expect(page.locator('#rkTitle')).toHaveText('📊 Offshore operational risk score');
  await expect(page.locator('#rkBody .rk-part')).toHaveCount(3, { timeout: 30000 });
  await expect(page.locator('#rkBody .rk-parts')).toContainText('Sea risk');
  await expect(page.locator('#rkBody .rk-win tbody tr')).toHaveCount(10);
  await expect(page.locator('#rkBody .rk-win')).toContainText('Crane: on the platform');
  await page.locator('#cardRisk').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/shots/risk-off.png' });
  await page.click('.rbtn[data-view="advisor"]');
  await page.click('#advRun');
  await expect(page.locator('#advBody')).toContainText('Weather windows', { timeout: 30000 });
  await expect(page.locator('#advLimitsBody thead')).toContainText('Swell period s');
  await page.locator('#view-advisor').evaluate(e => { e.scrollTop = document.getElementById('advOut').offsetTop - 10; });
  await page.screenshot({ path: '/tmp/shots/risk-adv-off.png' });
});

test('history: the full JPS record (5-minute, 14 days) through the relay, rain gauge at the same place, offshore past days from Open-Meteo', async ({ page, baseURL }) => {
  const fs = require('fs'), path = require('path');
  await page.setViewportSize({ width: 1180, height: 820 });
  const water = fs.readFileSync(path.join(__dirname, 'web-fixtures/jps-water-TRG.html'), 'utf8'), rain = fs.readFileSync(path.join(__dirname, 'web-fixtures/jps-rain-TRG.html'), 'utf8');
  const asked = [];
  /* a stand-in for the user's Cloudflare relay: what JPS answers, with the relay's own <style> in front like the real one */
  await page.route(/^https:\/\/relay\.example\.workers\.dev\//, r => {
    const u = decodeURIComponent(r.request().url()); asked.push(u);
    const body = /searchresultwaterlevel/.test(u) ? '<style>a{b:1}</style>' + JSON.stringify(F.wlSeries(Date.now())) : /searchresultrainfalldthourlylead/.test(u) ? JSON.stringify(F.rfSeries(Date.now()))
      : /aras-air-data/.test(u) ? water : /searchresultrainfall\.php/.test(u) ? rain : null;
    return body === null ? r.fulfill({ status: 404, body: 'no' }) : r.fulfill({ status: 200, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body });
  });
  await open(page, baseURL);
  await page.addStyleTag({ content: '#toasts { display: none !important; }' });
  await page.click('[data-view="settings"]');
  await page.fill('#f_relayUrl', 'https://relay.example.workers.dev');
  await page.fill('#f_relayKey', 'k3y-history-1');
  await page.click('#setSave');
  await page.waitForFunction(() => MC.state.settings.relayKey === 'k3y-history-1');
  await page.evaluate(() => MC.Data.refresh());
  await page.waitForFunction(() => MC.state.snap.jps && MC.state.snap.jps.live && MC.state.snap.jps.water.some(x => x.gid), null, { timeout: 20000 });
  await page.click('[data-view="history"]');
  await expect(page.locator('#hHours')).toHaveValue('336');
  const id = await page.evaluate(() => MC.state.snap.stations.find(s => /Sg\. Mas/.test(s.name)).id);
  await page.selectOption('#hStation', id);
  await expect(page.locator('#hSub')).toContainText('JPS readings (5 minutes)', { timeout: 20000 });
  const n = +(await page.locator('#hSub').textContent()).match(/^\d+/)[0];
  expect(n).toBeGreaterThan(4000);                                                         /* 14 days x 288 a day */
  await expect(page.locator('#hNote')).toContainText('Full data from JPS Public Infobanjir');
  await expect(page.locator('#hRainTitle')).toContainText('JPS Kg. Sg. Mas (F2)');
  expect(asked.some(u => /searchresultwaterleveldtlead\.php\?station=27197&from=/.test(u))).toBe(true);
  expect(asked.some(u => /searchresultrainfalldthourlylead\.php\?extra=&station=/.test(u))).toBe(true);
  /* the line has no gaps: points every 30 minutes over 14 days */
  const path0 = await page.locator('#chartLevel svg path.ln, #chartLevel svg path').first().getAttribute('d');
  expect((path0.match(/M/g) || []).length).toBeLessThanOrEqual(2);
  await page.screenshot({ path: '/tmp/shots/history-jps.png' });
  await page.selectOption('#hHours', '720');
  await expect(page.locator('#hSub')).toContainText('JPS readings', { timeout: 20000 });
  expect(asked.some(u => /searchresultwaterleveldtlead[^ ]*from=\d\d\/\d\d\/\d{4} \d\d:\d\d/.test(u))).toBe(true);
  /* offshore: the past days from the models */
  await page.click('#profBtn'); await page.click('#profMenu [data-prof="irong-barat"]');
  await page.waitForFunction(() => MC.state.settings.kind === 'offshore');
  await page.click('[data-view="history"]');
  await page.selectOption('#hHours', '336');
  await expect(page.locator('#hSub')).toContainText('h · Open-Meteo model', { timeout: 20000 });
  expect(+(await page.locator('#hSub').textContent()).match(/^\d+/)[0]).toBeGreaterThanOrEqual(330);
  await expect(page.locator('#hTempTitle')).toHaveText('Temperature (Open-Meteo model)');
  await page.screenshot({ path: '/tmp/shots/history-off.png' });
});

test('Water Level / Rainfall Kemaman tabs: the app\'s own page from the mirror (5-minute JPS data), station sheet, dashboard cards unchanged', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.addInitScript(() => localStorage.setItem('mc_lang', 'ms'));
  await open(page, baseURL);
  const cardWater = await page.locator('#cardWater').innerHTML();
  await page.locator('[data-site="waterlevel"]').first().click();
  const fr = page.frameLocator('#siteHost .frame.on iframe');
  await expect(page.locator('#siteHost .frame.on iframe')).toHaveAttribute('src', /kemaman\.html\?tab=water/);
  await expect(fr.locator('.km-st')).toHaveCount(8);
  await expect(fr.locator('.km-cnt.warning b')).toHaveText('1');
  await expect(fr.locator('.km-st.warning')).toContainText('Jambatan Ban Ho');
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/kmshots/app-water.png' });
  await fr.locator('.km-st.warning').click();
  await expect(fr.locator('#kmHyd svg')).toBeVisible();
  await expect(fr.locator('.km-big.main')).toContainText('18.30');
  await expect(fr.locator('#kmProj')).toContainText(/Dalam 4 jam/);
  await page.screenshot({ path: '/tmp/kmshots/app-water-sheet.png' });
  /* PDF: the page hands its content to the app, which prints it (iPad app: its own PDF) */
  await page.evaluate(() => { window.__printed = ''; window.print = () => { window.__printed = document.getElementById('printRoot').innerText; }; });
  await fr.locator('#kmSheet [data-act="pdf"]').click();
  await expect.poll(() => page.evaluate(() => window.__printed)).toContain('Jambatan Ban Ho');
  expect(await page.evaluate(() => window.__printed)).toContain('Hidrograf');
  await fr.locator('[data-act="close"]').click();
  await page.locator('[data-site="rainfall"]').first().click();
  await expect(page.locator('#siteHost .frame.on iframe')).toHaveAttribute('src', /kemaman\.html\?tab=rain/);
  const fr2 = page.frameLocator('#siteHost .frame.on iframe');
  await expect(fr2.locator('.hm-row:not(.hm-head)')).toHaveCount(17);
  await expect(fr2.locator('#kmModelTbl tr')).toHaveCount(7);
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/kmshots/app-rain.png' });
  /* wall mode: the Water Level Kemaman pane shows the same page */
  await page.locator('.rbtn[data-view="wall"]').click();
  await expect(page.locator('#view-wall iframe[src*="kemaman.html?tab=water"]').first()).toBeAttached();
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/kmshots/app-wall.png' });
  await page.locator('.rbtn[data-view="dashboard"]').click();
  expect(await page.locator('#cardWater').innerHTML()).toBe(cardWater);
});
