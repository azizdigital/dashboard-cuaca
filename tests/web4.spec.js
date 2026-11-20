// 4.1 web app (old look, new data): GitHub mirror for JPS & tides, 7/14/28 days, swell, no relay.
const { test, expect } = require('@playwright/test');
const F = require('./web-fixtures/make');

async function sources(page, opts = {}) {
  const now = Date.now(), m = F.mirror(now);
  if (opts.jps) opts.jps(m.jps);
  const json = (r, b, st = 200) => r.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
  await page.route(/^https:\/\/api\.open-meteo\.com\//, r => json(r, F.forecast(now, { gust: opts.gust })));
  await page.route(/^https:\/\/marine-api\.open-meteo\.com\//, r => json(r, F.shiftOpenMeteo('om-marine.json', now)));
  await page.route(/^https:\/\/ensemble-api\.open-meteo\.com\//, r => json(r, F.shiftOpenMeteo('om-ensemble-gfs.json', now)));
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
  expect(api).toEqual([]);
  await page.screenshot({ path: '/tmp/shots/v41-' + test.info().project.name + '.png', fullPage: true });
});

test('sites that refuse framing: stand-in inside the app or new tab, never the browser error page', async ({ page, baseURL, context }) => {
  await open(page, baseURL);
  await page.locator('.side [data-site="windywave"], [data-site="windywave"]').first().click();
  await expect(page.locator('.frame.on iframe, #siteHost .frame.on iframe').first()).toHaveAttribute('src', /embed\.windy\.com.*overlay=waves/);
  await page.locator('[data-site="tideforecast"]').first().click();
  await expect(page.locator('#view-dashboard')).toHaveClass(/on/);
  await context.route(/^https:\/\/sites\.research\.google\//, r => r.fulfill({ status: 200, contentType: 'text/html', body: 'x' }));
  const [tab] = await Promise.all([context.waitForEvent('page'), page.locator('[data-site="floodhub"]').first().click()]);
  await tab.waitForLoadState();
  expect(tab.url()).toMatch(/sites\.research\.google/);
});
