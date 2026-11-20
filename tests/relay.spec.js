// The relay (www/relay-worker.js) in a real browser: a page that refuses framing, shown in an iframe like the iPad app does.
const { test, expect } = require('@playwright/test');
const harness = require('./relay-harness');

let R;
test.beforeAll(async () => { R = await harness.start('k3y-browser'); });
test.afterAll(() => R && R.stop());

const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads';

test('blocked site shows inside an iframe through the relay; pictures, CSS, data and links work; frame-busting is stopped', async ({ page }) => {
  /* direct: the browser refuses it (that is the iPad problem) */
  R.host.st.html = (
    '<!doctype html><body style="margin:0"><iframe id="direct" style="width:400px;height:200px" src="http://127.0.0.1:' + R.origin.port + '/page"></iframe>' +
    '<iframe id="relay" sandbox="' + SANDBOX + '" style="width:600px;height:400px" src="' + R.url('/page') + '"></iframe></body>');
  await page.goto(R.host.url);
  await page.waitForTimeout(1500);
  const direct = page.frames().find(f => f.name() === '' && /\/page$/.test(f.url()) && f.url().indexOf(String(R.relay.port)) < 0);
  const directText = direct ? await direct.evaluate(() => document.body ? document.body.innerText : '').catch(() => '') : '';
  expect(directText).not.toContain('Paras air');                 /* blocked without the relay */

  const fr = page.frameLocator('#relay');
  await expect(fr.locator('#h')).toHaveText('Paras air Sg. Kemaman');
  await expect(fr.locator('#data')).toHaveText('3.21 m');         /* same-site data request through the relay */
  const imgs = await page.frame({ url: /k3y-browser/ }).evaluate(() =>
    ['rel', 'root', 'abs'].map(id => document.getElementById(id).naturalWidth).concat([getComputedStyle(document.getElementById('bg')).backgroundImage]));
  expect(imgs.slice(0, 3)).toEqual([1, 1, 1]);                    /* relative, "/" and absolute pictures */
  expect(imgs[3]).toContain('/img/c.gif');
  await expect.poll(() => R.origin.hits.some(h => h.url === '/img/c.gif')).toBe(true);   /* CSS background loaded */
  expect(page.url()).toBe(R.host.url);                 /* the page's frame-busting did not take over the app */

  await fr.locator('#ln').click();                                /* a link inside the page stays inside the relay */
  await expect(fr.locator('#h')).toHaveText('Second page');
  expect(page.frame({ url: /k3y-browser/ }).url()).toContain('/k3y-browser/http/127.0.0.1:' + R.origin.port + '/next');
  expect(R.origin.hits.every(h => !h.cookie)).toBe(true);         /* no cookies passed to the site */
});

/* the iPad / phone app (browser mode here) with and without a relay */
test('app: blue-dot site opens in the browser sheet without a relay; inside the app through the relay; relay test button', async ({ page, baseURL }) => {
  await page.goto(baseURL);
  await page.waitForFunction(() => window.MC && MC.state.snap && MC.state.snap.at, null, { timeout: 20000 });
  /* make sure the mock snapshot says Zoom Earth refuses framing (as the real site does) */
  await page.evaluate(() => { MC.state.snap.sites = MC.state.snap.sites || {}; MC.state.snap.sites.zoomearth = { ok: true, status: 200, ms: 50, frameable: false, at: Date.now() }; });
  await page.evaluate(() => { window.__opened = []; window.open = function (u) { window.__opened.push(u); return null; }; });
  await page.locator('[data-site="zoomearth"]').first().click();
  expect(await page.evaluate(() => window.__opened)).toEqual(['https://zoom.earth/places/malaysia/chukai/#map=radar']);
  await expect(page.locator('#siteHost .frame.on .fmsg')).toBeVisible();            /* card kept as fallback */

  /* settings: relay test button - wrong address, wrong key, then a working relay */
  await page.click('[data-view="settings"]');
  await page.fill('#f_relayUrl', 'http://127.0.0.1:' + R.origin.port);
  await page.fill('#f_relayKey', 'k3y-browser');
  await page.click('#relayTest');
  await expect(page.locator('#relayMsg')).toContainText('cannot be reached');      /* not a relay (no CORS) */
  await page.fill('#f_relayUrl', 'http://127.0.0.1:' + R.relay.port);
  await page.fill('#f_relayKey', 'wrong-key-123');
  await page.click('#relayTest');
  await expect(page.locator('#relayMsg')).toContainText('key does not match');
  await page.fill('#f_relayKey', 'k3y-browser');
  await page.click('#relayTest');
  await expect(page.locator('#relayMsg')).toContainText('not allowed by the script');   /* this test relay only allows 127.0.0.1 */
  /* the script the app hands out */
  const code = await page.evaluate(() => fetch('relay-worker.js').then(r => r.text()).then(t => MCCore.relayCode(t, 'abcdefgh123')));
  expect(code).toContain('const KEY = "abcdefgh123"');
  expect(code).toContain('"zoom.earth"');
  expect(code).toContain('"publicinfobanjir.water.gov.my"');
  expect(code).not.toContain('__HOSTS__');
  await page.click('#setSave');
  await expect(page.locator('#setMsg')).toContainText('Saved');

  /* with the relay: the open Zoom Earth tab is rebuilt as an iframe through the relay, no window opened */
  await page.evaluate(() => { window.__opened = []; });
  await page.locator('[data-site="zoomearth"]').first().click();
  const ifr = page.locator('#siteHost .frame.on iframe');
  await expect(ifr).toHaveAttribute('src', 'http://127.0.0.1:' + R.relay.port + '/k3y-browser/https/zoom.earth/places/malaysia/chukai/#map=radar');
  await expect(ifr).toHaveAttribute('sandbox', /allow-scripts/);
  expect(await page.evaluate(() => window.__opened)).toEqual([]);
  await expect(page.locator('[data-site="zoomearth"] .dot.relay')).toHaveCount(1);
  /* the external-open button still opens the real site, not the relay */
  expect(await page.evaluate(() => MC.Sites.cur().url)).toBe('https://zoom.earth/places/malaysia/chukai/#map=radar');
  await page.click('[data-view="settings"]');
  await page.fill('#f_relayUrl', ''); await page.fill('#f_relayKey', '');
  await page.click('#setSave');
});

/* Test relay checks every blue-dot site; the ones the relay cannot fetch open in the browser, the rest inside the app */
test('app: relay test per site - one works, one fails (530), result saved and used', async ({ page, baseURL }) => {
  await page.goto(baseURL);
  await page.waitForFunction(() => window.MC && MC.state.snap && MC.state.snap.at, null, { timeout: 20000 });
  const op = R.origin.port;
  /* point the blue-dot sites at the local test site: Zoom Earth works, JPS answers like Cloudflare's DNS failure */
  await page.evaluate(op => {
    MC.state.snap.sites = {};
    MCCore.SITES.forEach(s => { if (s.noFrame) { s.url = 'http://127.0.0.1:' + op + (s.id === 'jpsaras' ? '/cf530' : '/page'); delete s.profile; } });
    window.__opened = []; window.open = function (u) { window.__opened.push(u); return null; };
  }, op);
  await page.click('[data-view="settings"]');
  await page.fill('#f_relayUrl', 'http://127.0.0.1:' + R.relay.port);
  await page.fill('#f_relayKey', 'k3y-browser');
  await page.click('#relayTest');
  await expect(page.locator('#relayMsg')).toContainText('6 of 7 blue-dot sites', { timeout: 20000 });
  const jpsLine = page.locator('#relayMsg .rl.n', { hasText: 'JPS Water Level Terengganu' });
  await expect(jpsLine).toContainText('cannot find this site\'s address (DNS) (HTTP 530)');
  /* the JPS rainfall stand-in is checked too (this test relay does not know that real address, so it fails here) */
  await expect(page.locator('#relayMsg .rl.n', { hasText: 'Stand-in for Rainfall Kemaman' })).toHaveCount(1);
  expect(await page.evaluate(() => MC.state.settings.relayAltOff)).toBe('rainfall, jpsdata');
  /* saved by itself, with the failing site remembered */
  await expect.poll(() => page.evaluate(() => MC.state.settings.relayUrl)).toBe('http://127.0.0.1:' + R.relay.port);
  expect(await page.evaluate(() => MC.state.settings.relayBad)).toBe('127.0.0.1');
  /* (all test sites share one host here, so the failing one marks the host - with real sites only that site's host) */
  await expect(page.locator('#relayBadInfo')).toContainText('127.0.0.1');
  await page.evaluate(() => { MC.state.settings.relayBad = ''; });
  /* with no failures remembered: shown through the relay inside the app */
  await page.locator('[data-site="zoomearth"]').first().click();
  await expect(page.locator('#siteHost .frame.on iframe')).toHaveAttribute('src', new RegExp('/k3y-browser/http/127\\.0\\.0\\.1:' + op + '/page'));
  await expect(page.frameLocator('#siteHost .frame.on iframe').locator('#h')).toHaveText('Paras air Sg. Kemaman');
  /* a remembered failure: that site opens in the browser instead */
  await page.evaluate(() => { MC.state.settings.relayBad = '127.0.0.1'; MC.Sites.rebuildBlocked(); window.__opened = []; });
  await page.locator('[data-site="jpsaras"]').first().click();
  expect(await page.evaluate(() => window.__opened.length)).toBe(1);
  await page.click('[data-view="settings"]');
  await page.fill('#f_relayUrl', ''); await page.fill('#f_relayKey', '');
  await page.click('#setSave');
});

/* sites the relay cannot fetch get a stand-in from the same source, inside the app */
test('app: stand-ins for sites the relay cannot fetch (JPS, Windy radar, MET card, VesselFinder embed)', async ({ page, baseURL }) => {
  await page.goto(baseURL);
  await page.waitForFunction(() => window.MC && MC.state.snap && MC.state.snap.at, null, { timeout: 20000 });
  await page.evaluate(() => {
    MC.state.snap.sites = {};
    ['waterlevel', 'rainfall', 'infobanjir', 'metmalaysia', 'metradar', 'vesselfinder'].forEach(id => { MC.state.snap.sites[id] = { ok: true, frameable: false, at: Date.now() }; });
    window.__opened = []; window.open = function (u) { window.__opened.push(u); return null; };
  });
  await page.route(/embed\.windy\.com|vesselfinder\.com|workers\.dev/, r => r.fulfill({ contentType: 'text/html', body: '<p>stub</p>' }));
  const post = b => page.evaluate(b => MC.Data.saveSettings(Object.assign({}, MC.state.settings, b)), b);
  /* the relay could not fetch the infobanjir Terengganu, MET and VesselFinder sites (like the real test) */
  await post({ relayUrl: 'https://cuaca-relay.test.workers.dev', relayKey: 'abcdefgh123', relayBad: 'infobanjir.terengganu.gov.my, met.gov.my, vesselfinder.com', relayAltOff: '' });
  const open = async id => { await page.locator('[data-site="' + id + '"]').first().click(); await page.waitForTimeout(150); };
  const ifr = () => page.locator('#siteHost .frame.on iframe');

  await open('waterlevel');
  await expect(ifr()).toHaveAttribute('src', 'https://cuaca-relay.test.workers.dev/abcdefgh123/https/publicinfobanjir.water.gov.my/aras-air/data-paras-air/aras-air-data/?state=TRG&district=ALL&station=ALL&lang=en');
  await expect(page.locator('#siteHost .frame.on .altbar')).toContainText('Terengganu water levels (incl. Kemaman)');
  await expect(page.locator('#siteHost .frame.on .altbar a')).toHaveAttribute('href', 'https://infobanjir.terengganu.gov.my/WaterLevel/District/4');
  await open('rainfall');
  await expect(ifr()).toHaveAttribute('src', /\/https\/publicinfobanjir\.water\.gov\.my\/wp-content\/themes\/shapely\/agency\/searchresultrainfall\.php\?state=TRG&district=ALL&station=ALL&language=1&loginStatus=0$/);
  await open('infobanjir');
  await expect(ifr()).toHaveAttribute('src', /\/https\/publicinfobanjir\.water\.gov\.my\/main\/$/);
  await open('metradar');
  await expect(ifr()).toHaveAttribute('src', /^https:\/\/embed\.windy\.com\/embed\.html\?.*overlay=radar.*lat=4\.2324&lon=103\.4229$/);
  await open('vesselfinder');
  await expect(ifr()).toHaveAttribute('src', 'embed/vessels.html?lat=4.2324&lon=103.4229&zoom=8');
  await open('metmalaysia');
  await expect(page.locator('#view-dashboard')).toBeVisible();
  await expect(page.locator('#toasts')).toContainText('MET forecast & warnings on the Dashboard');
  expect(await page.evaluate(() => window.__opened)).toEqual([]);           /* nothing had to open in the browser */
  await expect(page.locator('[data-site="waterlevel"] .dot.alt')).toHaveCount(1);

  /* no relay at all: JPS stand-ins need it, so Water Level opens in the browser; Windy radar & VesselFinder embed still work */
  await post({ relayUrl: '', relayKey: '', relayBad: '', relayAltOff: '' });
  await open('waterlevel');
  expect(await page.evaluate(() => window.__opened)).toEqual(['https://infobanjir.terengganu.gov.my/WaterLevel/District/4']);
  await open('metradar');
  await expect(ifr()).toHaveAttribute('src', /embed\.windy\.com/);
  /* the VesselFinder embed page reads the profile position */
  const vf = await page.evaluate(() => fetch('embed/vessels.html').then(r => r.text()));
  expect(vf).toContain('https://www.vesselfinder.com/aismap.js');
});
