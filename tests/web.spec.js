// The web app (GitHub Pages): no PC, data straight from the sources, JPS water level & rainfall through the relay,
// ad-heavy sites through the relay without ads, profiles kept on the device, settings moved with a link.
const { test, expect } = require('@playwright/test');
const harness = require('./relay-harness');
const core = require('../www/assets/js/core');

let R;
test.beforeAll(async () => {
  R = await harness.start('k3y-web-123', {
    hosts: core.relayHosts(),
    route: (u, port) => /publicinfobanjir\.water\.gov\.my\/aras-air/.test(u) ? 'http://127.0.0.1:' + port + '/jps-water'
      : /publicinfobanjir\.water\.gov\.my\/.*rainfall/.test(u) ? 'http://127.0.0.1:' + port + '/jps-rain'
        : /tide-forecast\.com/.test(u) ? 'http://127.0.0.1:' + port + '/tides' : null
  });
});
test.afterAll(() => R && R.stop());

async function webApp(page, baseURL) {
  const api = [];
  page.on('request', r => { if (/\/api\//.test(r.url())) api.push(r.url()); });
  /* no internet in the test: public APIs answer with an error */
  await page.route(/open-meteo\.com|api\.data\.gov\.my/, r => r.fulfill({ status: 503, body: 'x' }));
  await page.goto(baseURL + '?web');
  await page.waitForFunction(() => window.MC && MC.state.mode === 'direct', null, { timeout: 20000 });
  return api;
}

test('web app: never looks for a PC; JPS water level & rainfall through the relay; relay test lists JPS data', async ({ page, baseURL }) => {
  const api = await webApp(page, baseURL);
  await expect(page.locator('#waterBody')).toContainText('Site relay');            /* no relay yet: points to the setting */
  await page.click('[data-view="settings"]');
  await expect(page.locator('#moveCard')).toBeVisible();
  await expect(page.locator('#relayCard .web-only').first()).toBeVisible();
  await expect(page.locator('#btnSetup')).toBeHidden();
  await expect(page.locator('#aboutMode')).toContainText('Web app');
  await page.fill('#f_relayUrl', 'http://127.0.0.1:' + R.relay.port);
  await page.fill('#f_relayKey', 'k3y-web-123');
  await page.click('#relayTest');
  await expect(page.locator('#relayMsg')).toContainText('JPS water level & rainfall for the dashboard');
  await expect(page.locator('#relayMsg .rl', { hasText: 'for the dashboard' })).toContainText('✓');
  await page.click('#setSave');
  await page.evaluate(() => MC.Data.refresh());
  await page.waitForFunction(() => MC.state.snap && (MC.state.snap.stations || []).length === 1, null, { timeout: 20000 });
  const snap = await page.evaluate(() => MC.state.snap);
  expect(snap.stations[0]).toMatchObject({ name: 'Sg. Mas di Kg. Sg. Mas (F2)', level: 31.7, status: 'warning', source: 'JPS', stale: false });
  expect(snap.rainStations[0]).toMatchObject({ name: 'JPS Kemaman', rainToday: 14.5, rain1h: 3.5 });
  expect(snap.sources.jpsWater.ok).toBe(true);
  await page.click('[data-view="dashboard"]');
  await expect(page.locator('#waterBody')).toContainText('Sg. Mas di Kg. Sg. Mas (F2)');
  await expect(page.locator('#waterBody')).toContainText('JPS');
  expect(await page.evaluate(() => MC.state.snap.alerts.active.some(a => a.cat === 'water'))).toBe(true);
  expect(api).toEqual([]);                                                          /* never asked for a PC */
});

test('web app: tide site through the relay with the ads taken out; off switch shows it directly', async ({ page, baseURL }) => {
  await webApp(page, baseURL);
  await page.evaluate(port => MC.Data.saveSettings(Object.assign({}, MC.state.settings, { relayUrl: 'http://127.0.0.1:' + port, relayKey: 'k3y-web-123' })), R.relay.port);
  await page.evaluate(() => { window.__opened = []; window.open = function (u) { window.__opened.push(u); return null; }; });
  await page.locator('[data-site="tideforecast"]').first().click();
  const ifr = page.locator('#siteHost .frame.on iframe');
  await expect(ifr).toHaveAttribute('src', new RegExp('/k3y-web-123/https/www\\.tide-forecast\\.com/locations/Cukai/tides/latest'));
  const fr = page.frameLocator('#siteHost .frame.on iframe');
  await expect(fr.locator('#h')).toHaveText('Cukai tides');
  await expect(fr.locator('ins.adsbygoogle')).toHaveCount(0);
  await expect(fr.locator('#div-gpt-ad-1')).toBeHidden();
  const inner = page.frame({ url: /k3y-web-123/ });
  expect(await inner.evaluate(() => [document.title, [].some.call(document.scripts, s => /googlesyndication|doubleclick/.test(s.src)), window.__pop])).toEqual(['guarded', false, null]);
  await expect(page.locator('[data-site="tideforecast"] .dot.relay')).toHaveCount(1);
  /* switch off: the site loads directly again */
  await page.evaluate(() => MC.Data.saveSettings(Object.assign({}, MC.state.settings, { relayAds: false })));
  await page.locator('[data-site="tideforecast"]').first().click();
  await expect(page.locator('#siteHost .frame.on iframe')).toHaveAttribute('src', 'https://www.tide-forecast.com/locations/Cukai/tides/latest');
});

test('web app: profiles added / edited / deleted on the device; settings moved to another device with a link', async ({ page, baseURL, browser }) => {
  await webApp(page, baseURL);
  await page.evaluate(() => MC.Data.profile('save', { profile: { name: 'Kuantan', kind: 'land', lat: 3.8, lon: 103.33, waterDistrict: 'Kuantan', jpsState: 'PHG' }, activate: true }));
  await page.waitForFunction(() => MC.state.profiles.active === 'kuantan' && MC.state.settings.locationName === 'Kuantan');
  expect(await page.evaluate(() => [MC.state.profiles.profiles.length, MC.state.settings.jpsState, MC.state.settings.lat])).toEqual([3, 'PHG', 3.8]);
  /* saving settings updates this device's copy of the active profile */
  await page.evaluate(() => MC.Data.saveSettings(Object.assign({}, MC.state.settings, { gustKmh: 77, relayUrl: 'https://cuaca-relay.aziz.workers.dev', relayKey: 'moveKey12345', relayBad: 'zoom.earth' })));
  expect(await page.evaluate(() => MC.state.profiles.profiles.find(p => p.id === 'kuantan').gustKmh)).toBe(77);
  /* the link */
  await page.click('[data-view="settings"]');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.click('#moveCopy');
  await expect(page.locator('#moveMsg')).toContainText('Link copied');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\?web#setup=[A-Za-z0-9_-]+$/);
  /* delete the profile again */
  await page.evaluate(() => MC.Data.profile('delete', { id: 'kuantan' }));
  await page.waitForFunction(() => MC.state.profiles.active === 'kemaman' && MC.state.profiles.profiles.length === 2);

  /* another device (fresh storage) opens the link */
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.route(/open-meteo\.com|api\.data\.gov\.my|workers\.dev/, r => r.fulfill({ status: 503, body: 'x' }));
  p2.on('dialog', d => d.accept());
  await p2.goto(link);
  await p2.waitForFunction(() => window.MC && MC.state.settings.relayKey === 'moveKey12345', null, { timeout: 20000 });
  expect(await p2.evaluate(() => [MC.state.settings.relayUrl, MC.state.settings.relayBad, MC.state.profiles.active, MC.state.profiles.profiles.length, location.hash]))
    .toEqual(['https://cuaca-relay.aziz.workers.dev', '', 'kuantan', 3, '']);
  /* the iPad home-screen app: paste the link */
  const ctx3 = await browser.newContext();
  const p3 = await ctx3.newPage();
  await p3.route(/open-meteo\.com|api\.data\.gov\.my|workers\.dev/, r => r.fulfill({ status: 503, body: 'x' }));
  await p3.goto(baseURL + '?web');
  await p3.waitForFunction(() => window.MC && MC.state.mode === 'direct');
  await p3.click('[data-view="settings"]');
  p3.on('dialog', d => d.type() === 'prompt' ? d.accept(link) : d.accept());
  await p3.click('#movePaste');
  await p3.waitForFunction(() => MC.state.settings.relayKey === 'moveKey12345');
  await expect(p3.locator('#f_relayKey')).toHaveValue('moveKey12345');
  await ctx2.close(); await ctx3.close();
});
