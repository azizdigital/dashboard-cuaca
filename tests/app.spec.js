// Dashboard Cuaca Aziz 4 in a browser (PC, iPad and phone sizes). Every outside source is answered by the test.
const { test, expect } = require('@playwright/test');
const fs = require('fs'), path = require('path');
const F = require('./fixtures/make');
const fx = f => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');

async function sources(page, opts = {}) {
  const now = Date.now(), m = F.mirror(now);
  if (opts.jps) opts.jps(m.jps);
  const calls = [];
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  await page.route('https://api.open-meteo.com/**', r => { calls.push('fc'); return opts.fcDown ? r.abort() : json(r, F.forecast(now, { gust: opts.gust })); });
  await page.route('https://marine-api.open-meteo.com/**', r => { calls.push('marine:' + new URL(r.request().url()).searchParams.get('latitude')); return json(r, F.shiftOpenMeteo('om-marine.json', now)); });
  await page.route('https://ensemble-api.open-meteo.com/**', r => { calls.push('outlook'); return json(r, F.shiftOpenMeteo('om-ensemble-gfs.json', now)); });
  await page.route('https://geocoding-api.open-meteo.com/**', r => json(r, { results: [{ name: 'Kuantan', latitude: 3.8077, longitude: 103.326, admin1: 'Pahang', country: 'Malaysia' }] }));
  await page.route('https://api.data.gov.my/weather/warning**', r => { calls.push('warn'); return json(r, F.warnings(now)); });
  await page.route('https://api.data.gov.my/weather/forecast**', r => { calls.push('met'); return json(r, F.metForecast(now)); });
  await page.route('https://raw.githubusercontent.com/**', r => {
    const u = r.request().url(); calls.push('mirror:' + u.replace(/^.*\/data\//, '').replace(/\?.*$/, ''));
    if (/jps-TRG\.json/.test(u)) return json(r, m.jps);
    if (/tide-cukai\.json/.test(u)) return json(r, m.tide);
    return json(r, {}, 404);
  });
  /* sites shown inside the app: a plain page instead of the real site */
  await page.route(/^https:\/\/(embed\.windy\.com|www\.rainviewer\.com|webcams\.windy\.com|www\.ventusky\.com|www\.meteoblue\.com|map\.blitzortung\.org|earth\.nullschool\.net|www\.jalanow\.com|www\.vesselfinder\.com)\//,
    r => r.fulfill({ status: 200, contentType: /aismap/.test(r.request().url()) ? 'text/javascript' : 'text/html', body: /aismap/.test(r.request().url()) ? 'document.body.insertAdjacentHTML("beforeend","<p id=vf>map</p>")' : '<h1 id="h">' + new URL(r.request().url()).hostname + '</h1>' }));
  return calls;
}
async function ready(page, opts) {
  const calls = await sources(page, opts);
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('./');
  await page.waitForFunction(() => window.DCAPP && DCAPP.state().data.fc && DCAPP.state().data.jps);
  return { calls, errs };
}

test('Kemaman: now, MET warning for my area, tides from the Cukai mirror, forecast, sea, MET 7 days, JPS tables like the original', async ({ page }) => {
  const { calls, errs } = await ready(page);
  await expect(page.locator('#cNow')).toContainText('27°');
  await expect(page.locator('#cNow')).toContainText('km/h');
  await expect(page.locator('#cNow')).toContainText('kt');
  await expect(page.locator('#cWarn .warn.mine')).toHaveCount(1);
  await expect(page.locator('#cWarn .warn.mine')).toContainText('Strong Winds and Rough Seas Warning');
  await expect(page.locator('#cWarn .warn.mine mark').first()).toHaveText(/Terengganu/i);
  await expect(page.locator('#alerts .arow.danger')).toContainText('MET');
  await expect(page.locator('#cTide')).toContainText('Tide Forecast - Cukai');
  await expect(page.locator('#cTide table.tide tr')).toHaveCount(6);
  await expect(page.locator('#cTide svg.chart')).toHaveCount(1);
  await expect(page.locator('#cFc table.days tbody tr')).toHaveCount(7);
  await expect(page.locator('#cFc svg.chart')).toHaveCount(1);
  await expect(page.locator('#cSea table.days tbody tr')).toHaveCount(10);
  await expect(page.locator('#cMet tbody tr')).toHaveCount(7);
  await expect(page.locator('#cMet')).toContainText('Thunderstorms in');
  /* JPS: the same columns as the original page */
  const heads = await page.locator('#cWater table.jps thead th').allTextContents();
  expect(heads).toEqual(['No.', 'Station ID', 'Station Name', 'District', 'Main Basin', 'Sub River Basin', 'Last Updated', 'Water Level (m)', 'Normal', 'Alert', 'Warning', 'Danger']);
  await expect(page.locator('#cWater tbody tr')).toHaveCount(8);
  await expect(page.locator('#cWater')).toContainText('Sg. Mas di Kg. Sg. Mas (F2)');
  await expect(page.locator('#cRain tbody tr')).toHaveCount(17);
  await expect(page.locator('#cRain thead')).toContainText('Rainfall from Midnight');
  await expect(page.locator('#cRain thead')).toContainText('Total 1 Hour (Now)');
  /* whole state */
  await page.locator('#cWater [data-all="1"]').click();
  await expect(page.locator('#cWater tbody tr')).toHaveCount(46);
  await page.locator('#cWater [data-all="0"]').click();
  expect(calls).toEqual(expect.arrayContaining(['fc', 'marine:4.26', 'outlook', 'warn', 'met', 'mirror:jps-TRG.json', 'mirror:tide-cukai.json']));
  expect(errs).toEqual([]);
});

test('7 / 14 / 28 days', async ({ page }) => {
  await ready(page);
  await page.locator('#cFc [data-days="14"]').click();
  await expect(page.locator('#cFc table.days tbody tr')).toHaveCount(14);
  await page.locator('#cFc [data-days="28"]').click();
  await expect(page.locator('#cFc table.days tbody tr')).toHaveCount(28);
  await expect(page.locator('#cFc table.weeks tbody tr')).toHaveCount(4);
  await expect(page.locator('#cFc')).toContainText('GFS');
  await page.reload();
  await page.waitForFunction(() => window.DCAPP && DCAPP.state().data.outlook);
  await expect(page.locator('#cFc [data-days="28"]')).toHaveAttribute('aria-selected', 'true');     /* remembered */
});

test('JPS station at warning level + heavy rain + strong gusts: alert strip, colours, sound only once', async ({ page }) => {
  await ready(page, { gust: 66, jps: j => { const s = j.water.find(x => x.name.startsWith('Sg. Mas')); s.level = 31.7; const r = j.rain.stations.find(x => x.name === 'JPS Kemaman'); r.hour = 28; } });
  await expect(page.locator('#alerts')).toContainText('Sg. Mas di Kg. Sg. Mas (F2)');
  await expect(page.locator('#alerts')).toContainText('WARNING');
  await expect(page.locator('#alerts')).toContainText('JPS Kemaman');
  await expect(page.locator('#alerts')).toContainText('Wind gusts up to');
  await expect(page.locator('#cWater tr.st-warning')).toHaveCount(1);
  await expect(page.locator('#cRain tr.st-warning')).toHaveCount(1);
  const seen = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('dc4_seen'))).length);
  expect(seen).toBeGreaterThanOrEqual(4);
});

test('Irong Barat (offshore): sea point, no JPS / MET district, tides from the model', async ({ page }) => {
  const { calls } = await ready(page);
  await page.locator('.chip[data-p="irong-barat"]').click();
  await page.waitForFunction(() => DCAPP.state().ACTIVE === 'irong-barat' && DCAPP.state().data.marine);
  await expect(page.locator('#cWater')).toBeHidden();
  await expect(page.locator('#cMet')).toBeHidden();
  await expect(page.locator('#cTide')).toContainText('model sea level');
  await expect(page.locator('#cWarn .warn.mine')).toHaveCount(1);              /* Terengganu waters */
  expect(calls).toContain('marine:5.5501');
});

test('sites: in-app tiles open inside, the rest open a new tab; Back closes the viewer', async ({ page, context }) => {
  await ready(page);
  await page.locator('[data-site="w-waves"]').click();
  await expect(page.locator('#viewer')).toBeVisible();
  await expect(page.locator('#vFrame')).toHaveAttribute('src', /embed\.windy\.com.*overlay=waves.*lat=4\.260&lon=103\.520/);
  await expect(page.frameLocator('#vFrame').locator('#h')).toHaveText('embed.windy.com');
  await page.locator('#vBack').click();
  await expect(page.locator('#viewer')).toBeHidden();
  await page.locator('[data-site="vessels"]').click();
  await expect(page.frameLocator('#vFrame').locator('#vf')).toHaveText('map');
  await page.evaluate(() => history.back());                                    /* Android back button */
  await expect(page.locator('#viewer')).toBeHidden();
  await context.route('https://publicinfobanjir.water.gov.my/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: 'JPS' }));
  const [tab] = await Promise.all([context.waitForEvent('page'), page.locator('[data-site="jpsaras"]').click()]);
  await tab.waitForLoadState();
  expect(tab.url()).toMatch(/publicinfobanjir\.water\.gov\.my/);
  await tab.close();
  await expect(page.locator('.site.in')).toHaveCount(await page.locator('.site .badge', { hasText: '▣' }).count());
});

test('add a location by search, edit it, delete it; BM / EN', async ({ page }) => {
  await ready(page);
  await page.locator('#addLoc').click();
  await page.fill('#geoQ', 'Kuantan');
  await page.locator('#geoGo').click();
  await page.locator('.geo').first().click();
  await expect(page.locator('#pJpsState')).toHaveValue('PHG');
  await page.fill('#pSeaLon', '103.45');
  await page.locator('#pSave').click();
  await page.waitForFunction(() => DCAPP.state().ACTIVE === 'kuantan' && DCAPP.state().data.marine);
  await expect(page.locator('.chip.on')).toContainText('Kuantan');
  expect(await page.evaluate(() => DCAPP.state().PROFILES.find(p => p.id === 'kuantan'))).toMatchObject({ lat: 3.8077, seaLon: 103.45, jpsState: 'PHG', tide: 'model' });
  await page.locator('#lang').click();
  await expect(page.locator('#cNow .card-h h2')).toHaveText('Sekarang');
  await expect(page.locator('#sites h2')).toContainText('Laman');
  await page.locator('#gear').click();
  page.once('dialog', d => d.accept());
  await page.locator('[data-del="kuantan"]').click();
  await page.waitForFunction(() => DCAPP.state().ACTIVE === 'kemaman' && DCAPP.state().PROFILES.length === 2);
});

test('settings link moves locations & limits to another device', async ({ page, browser }) => {
  await ready(page);
  await page.locator('#gear').click();
  await page.fill('#sGust', '70');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('#sCopy').click();
  await expect(page.locator('#sMsg')).toContainText('Link copied');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const ctx = await browser.newContext(); const p2 = await ctx.newPage();
  await sources(p2);
  p2.on('dialog', d => d.accept());
  await p2.goto(link);
  await p2.waitForFunction(() => window.DCAPP && DCAPP.state().S.gustKmh === 70);
  expect(await p2.evaluate(() => location.hash)).toBe('');
  await ctx.close();
});

test('offline / source down: last data stays, the card says why', async ({ page }) => {
  await ready(page);
  await page.unroute('https://api.open-meteo.com/**');
  await page.route('https://api.open-meteo.com/**', r => r.abort());
  await page.locator('#refresh').click();
  await expect(page.locator('#cNow .err')).toContainText('showing older data');
  await expect(page.locator('#cNow')).toContainText('27°');
});

test('layout: nothing wider than the screen', async ({ page }) => {
  await ready(page);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over).toBeLessThanOrEqual(0);
});
