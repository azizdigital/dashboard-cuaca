'use strict';
/* Dashboard Cuaca Aziz - unit tests (no internet, no Electron):  node tests/unit.js
   parsers, alert rules, collector (with fake fetch), store, server + API (security too), certificate. */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const core = require('../www/assets/js/core');
const fx = require('./fixtures/make');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const NOW = Date.UTC(2026, 10, 17, 12, 20); /* 17 Nov 2026 20:20 MYT */

/* ---------------------------------------------------------------- core */
test('29 sites, unique ids, all https', () => {
  assert.strictEqual(core.SITES.length, 29);
  assert.strictEqual(core.SITES.filter(s => !s.added).length, 16);
  assert.strictEqual(new Set(core.SITES.map(s => s.id)).size, 29);
  core.SITES.forEach(s => assert.ok(/^https:\/\//.test(s.url), s.id));
  assert.strictEqual(core.CATEGORIES.length, 6);
});
test('sites that follow the profile get its coordinates', () => {
  const off = core.profileSettings({}, core.DEFAULT_PROFILES[1]), land = core.profileSettings({}, core.DEFAULT_PROFILES[0]);
  assert.strictEqual(core.siteUrl(core.siteById('windywave'), off), 'https://www.windy.com/5.550/104.775?waves,5.550,104.775,8');
  assert.ok(core.siteUrl(core.siteById('blitzortung'), land).endsWith('#7/4.232/103.423'));
  assert.strictEqual(core.siteUrl(core.siteById('windy'), off), core.siteById('windy').url);   /* fixed sites never change */
  core.SITES.filter(s => s.profile).forEach(s => assert.ok(!/[{}]/.test(core.siteUrl(s, off)), s.id));
});
test('newest date in a page (old camera detector)', () => {
  const now = Date.UTC(2026, 10, 18, 2, 0);
  assert.strictEqual(core.newestDate('Kemaskini 12/03/2025 10:15 AM · © 2026', now), core.localMs('2025-03-12T10:15'));
  assert.strictEqual(core.newestDate('Last update Nov 17, 2026 14:05 and 2025-01-02', now), core.localMs('2026-11-17T14:05'));
  assert.strictEqual(core.newestDate('Dikemas kini 3 Mac 2025', now), core.localMs('2025-03-03'));
  assert.strictEqual(core.newestDate('copyright 2025, version 2026', now), null);
  assert.strictEqual(core.newestDate('tarikh depan 25/12/2026', now), null);  /* future dates ignored */
});
test('profiles: defaults, cleaning, effective settings', () => {
  assert.deepStrictEqual(core.DEFAULT_PROFILES.map(p => p.id), ['kemaman', 'irong-barat']);
  const ib = core.cleanProfile(core.DEFAULT_PROFILES[1]);
  assert.strictEqual(ib.kind, 'offshore'); assert.strictEqual(ib.lat, 5.5501); assert.strictEqual(ib.lon, 104.7745);
  assert.strictEqual(ib.metLocationId, ''); assert.strictEqual(ib.scrapeInfobanjir, false);
  const s = core.profileSettings({ refreshMin: 15, sound: false }, ib);
  assert.strictEqual(s.refreshMin, 15); assert.strictEqual(s.sound, false); assert.strictEqual(s.locationName, 'Irong Barat (offshore)'); assert.strictEqual(s.kind, 'offshore');
  assert.ok(!('metForecast' in core.urls(s)) && !('flood' in core.urls(s)));
  const p = core.cleanProfile({ name: '  Platform X ', kind: 'offshore', lat: 5.1, lon: 104.9 });
  assert.strictEqual(p.name, 'Platform X'); assert.strictEqual(p.marineLat, 5.1);
  assert.strictEqual(core.cleanProfile({ name: 'Bad', lat: 999 }).lat, core.DEFAULTS.lat);
});
test('offshore snapshot: no river sources, sea & wind alerts in knots', async () => {
  const s = core.profileSettings({}, core.DEFAULT_PROFILES[1]), u = core.urls(s), raw = {};
  for (const k of Object.keys(u)) raw[k] = { ok: true, data: await fx.forUrl(u[k], NOW) };
  raw.ibWater = { ok: true, tables: fx.waterTables(NOW) };   /* even if present, an offshore profile ignores them */
  const snap = core.assemble(raw, s, null, NOW);
  assert.deepStrictEqual(Object.keys(snap.sources).sort(), ['marine', 'metWarning', 'openMeteo', 'outlook']);
  assert.strictEqual(snap.stations.length, 0);
  assert.strictEqual(snap.weather.summary.thunderRisk, 'tinggi'); assert.strictEqual(snap.weather.summary.minVis6h, 1.5);
  assert.ok(snap.marine.current.swell > 0 && snap.marine.maxSwell24h > 0);
  const keys = core.evaluateAlerts(snap, s, [], NOW).map(a => a.key.split(':')[0]).sort();
  assert.deepStrictEqual(keys, ['gust', 'met', 'met', 'thunder', 'vis', 'wave']);
  assert.ok(core.evaluateAlerts(snap, s, [], NOW).find(a => a.key.startsWith('gust')).body.includes('knot'));
});
test('certificate allow-list is exact (no look-alike hosts)', () => {
  assert.ok(core.certAllowed('infobanjir.terengganu.gov.my'));
  assert.ok(core.certAllowed('www.met.gov.my'));
  assert.ok(!core.certAllowed('evil-met.gov.my.attacker.com'));
  assert.ok(!core.certAllowed('notmet.gov.my'));
  assert.ok(!core.certAllowed('www.windy.com'));
});
test('settings are cleaned', () => {
  const s = core.cleanSettings({ refreshMin: 7, lat: 999, metLocationId: 'x', sound: 'false', rain3hMm: '25' });
  assert.strictEqual(s.refreshMin, 10); assert.strictEqual(s.lat, core.DEFAULTS.lat); assert.strictEqual(s.metLocationId, 'Ds065');
  assert.strictEqual(s.sound, false); assert.strictEqual(s.rain3hMm, 25);
});
test('time helpers use Malaysia time', () => {
  assert.strictEqual(core.localMs('2026-11-17T20:20'), NOW);
  assert.strictEqual(core.fmtTime(NOW), '20:20');
  assert.strictEqual(core.flexTime('17/11/2026 8:20 PM', NOW), NOW);
  assert.strictEqual(core.flexTime('2026-11-17 20:20:00', NOW), NOW);
  assert.strictEqual(core.flexTime('20:20', NOW), NOW);
  assert.strictEqual(core.flexTime('17/11/2026 12:05 AM', NOW), core.localMs('2026-11-17T00:05'));
  assert.strictEqual(core.flexTime('bukan masa', NOW), null);
});
test('num() rejects sensor faults', () => {
  assert.strictEqual(core.num(-9999), null); assert.strictEqual(core.num('9.42 ▲'), 9.42); assert.strictEqual(core.num('-'), null); assert.strictEqual(core.num('1,234.5'), 1234.5);
});
test('Open-Meteo parser: current, hourly, sums', () => {
  const w = core.parseOpenMeteo(fx.openMeteo(NOW), NOW);
  assert.strictEqual(w.current.temp, 25.4);
  assert.strictEqual(w.hourly.length, 216);
  assert.strictEqual(w.summary.next3h, 25.5);
  assert.ok(w.summary.next24h > 30);
  assert.strictEqual(w.daily.length, 9);
});
test('Marine parser finds tides', () => {
  const m = core.parseMarine(fx.marine(NOW), NOW);
  assert.ok(m.current && m.current.wave > 0);
  assert.ok(m.tides.length >= 2);
  assert.ok(m.tides.every(t => t.t >= Math.floor(NOW / 3600000) * 3600000));
});
test('MET forecast filters by location and today', () => {
  const f = core.parseMetForecast(fx.metForecast(NOW), 'Ds065', NOW);
  assert.strictEqual(f.length, 7);
  assert.strictEqual(f[0].date, '2026-11-17');
  assert.strictEqual(f[0].summary, 'Hujan menyeluruh');
  assert.deepStrictEqual(core.parseMetForecast({ data: fx.metForecast(NOW) }, 'Ds065', NOW).length, 7);
});
test('MET warnings: active + relevant only; the same warning sent 3 times is shown once', () => {
  const w = core.parseMetWarnings(fx.metWarning(NOW), 'Terengganu, Kemaman', NOW);
  assert.strictEqual(w.relevant.length, 2);          /* continuous rain + sea warning (it names Terengganu) */
  assert.strictEqual(w.otherCount, 1);               /* Tawau thunderstorm */
  const sea = core.parseMetWarnings(fx.metWarning(NOW), 'Condore', NOW).relevant;
  assert.strictEqual(sea.length, 1);
  assert.strictEqual(sea[0].from, NOW - 2 * 3600000); /* widest window of the three copies */
  assert.strictEqual(sea[0].to, NOW + 30 * 3600000);
  assert.ok(sea[0].instruction_en);
});
test('MET text: sections, items, areas, times, wind & waves (English and BM)', () => {
  const W = fx.seaWarning(NOW);
  [['en', W.heading_en, W.text_en], ['ms', W.heading_bm, W.text_bm]].forEach(([lg, h, t]) => {
    const p = core.parseMetText(h, t);
    assert.strictEqual(p.sections.length, 2, lg);
    assert.deepStrictEqual(p.sections.map(s => s.items.length), [1, 2], lg);
    assert.deepStrictEqual(p.sections[1].items.map(i => i.type), ['wind', 'thunder'], lg);
    const wi = p.sections[1].items[0];
    assert.deepStrictEqual(wi.wind, [40, 50]); assert.strictEqual(wi.wave, 3.5);
    assert.strictEqual(wi.areas[0], 'Condore', lg);
    assert.ok(wi.from && wi.to && wi.to.ms > wi.from.ms, lg + ' period');
    assert.strictEqual(core.dateKey(wi.from.ms), core.dateKey(NOW + 86400000), lg);
    const th = p.sections[0].items[0];
    assert.strictEqual(th.areas.length, 7, lg); assert.strictEqual(th.areas[0], 'Perak', lg);
    assert.strictEqual(th.until.ms, (NOW - NOW % 3600000) + 4 * 3600000, lg + ' until');
    const sm = core.metSummary(p, 'Terengganu, Condore, Reef North');
    assert.deepStrictEqual(sm.mine.map(m => m.area), ['Terengganu', 'Condore', 'Reef North'], lg);
    assert.deepStrictEqual(sm.mine[2].hits.map(h => h.item.type), ['wind', 'thunder'], lg);
    assert.ok(/barat|western/.test(sm.mine[2].hits[0].note), lg);
    assert.ok(!sm.others.some(x => /waters|perairan/i.test(x)), lg);
  });
  /* text MET writes some other way: nothing breaks, nothing is lost */
  const odd = core.parseMetText('', 'Sabah: Tawau.');
  assert.strictEqual(odd.sections[0].items[0].body, 'Sabah: Tawau.');
  /* BM times: Petang / Pagi / Malam */
  assert.strictEqual(core.myt(core.metDate('2:00 Petang; Rabu, 18 November 2026').ms).h, 14);
  assert.strictEqual(core.myt(core.metDate('8:30 Malam; Rabu, 18 November 2026').ms).h, 20);
  assert.strictEqual(core.myt(core.metDate('11:00 PM; Wednesday, 18 November 2026').ms).h, 23);
});
test('flood-warning parser: -9999 dropped, status computed', () => {
  const st = core.parseFloodWarning(fx.flood(), 'Kemaman');
  assert.strictEqual(st.length, 2);
  const cherul = st.find(s => /Cherul/.test(s.name));
  assert.strictEqual(cherul.status, 'warning'); /* 10.7 >= warning 10.0 */
  assert.strictEqual(st.find(s => /Air Putih/.test(s.name)).level, null);
});
test('infobanjir table parser (water)', () => {
  const st = core.parseTables(fx.waterTables(NOW), 'water', NOW);
  assert.strictEqual(st.length, 4);  /* Kijal has "-" */
  const ap = st.find(s => /Air Putih/.test(s.name));
  assert.strictEqual(ap.level, 9.42); assert.strictEqual(ap.alert, 9); assert.strictEqual(ap.danger, 12);
  assert.strictEqual(ap.status, 'alert'); assert.strictEqual(ap.trend, 'rising');
  assert.strictEqual(ap.updated, NOW - 600000);
  assert.strictEqual(st.find(s => /Chukai/.test(s.name)).status, 'warning');
  assert.strictEqual(st.find(s => /Tebak/.test(s.name)).trend, 'falling');
});
test('infobanjir table parser (rain)', () => {
  const r = core.parseTables(fx.rainTables(NOW), 'rain', NOW);
  assert.strictEqual(r.length, 3);
  assert.strictEqual(r[0].rain1h, 12.5); assert.strictEqual(r[0].rainToday, 48);
});
test('table parser copes with a single header row and English labels', () => {
  const t = [{ rows: [['No', 'Station Name', 'Last Updated', 'Water Level (m)', 'Normal', 'Alert', 'Warning', 'Danger'], ['1', 'Sg. X', '2026-11-17 20:00:00', '3.3', '1', '2', '3', '4']] }];
  const st = core.parseTables(t, 'water', NOW);
  assert.strictEqual(st.length, 1); assert.strictEqual(st[0].status, 'warning'); assert.strictEqual(st[0].updated, NOW - 20 * 60000);
});
test('assemble + alerts on full fixture', () => {
  const raw = {
    openMeteo: { ok: true, data: fx.openMeteo(NOW) }, marine: { ok: true, data: fx.marine(NOW) },
    metForecast: { ok: true, data: fx.metForecast(NOW) }, metWarning: { ok: true, data: fx.metWarning(NOW) }, flood: { ok: true, data: fx.flood() },
    ibWater: { ok: true, tables: fx.waterTables(NOW) }, ibRain: { ok: true, tables: fx.rainTables(NOW) }
  };
  const snap = core.assemble(raw, {}, null, NOW);
  assert.strictEqual(snap.sources.openMeteo.ok, true);
  assert.ok(snap.stations.length >= 5);
  assert.strictEqual(snap.stations[0].status, 'warning');               /* sorted worst first */
  assert.ok(snap.stations.filter(s => s.source === 'data.gov.my').every(s => s.stale)); /* Feb 2024 data marked stale */
  const alerts = core.evaluateAlerts(snap, {}, [], NOW);
  const keys = alerts.map(a => a.key.split(':')[0]);
  assert.ok(keys.includes('water')); assert.ok(keys.includes('rain3h')); assert.ok(keys.includes('met'));
  assert.ok(!alerts.some(a => /Cherul di Ban Ho Terengganu/.test(a.title)), 'stale station must not alert');
  /* stricter level: only Amaran and above */
  const strict = core.evaluateAlerts(snap, { waterAlertLevel: 'warning' }, [], NOW).filter(a => a.cat === 'water');
  assert.strictEqual(strict.length, 1);
});
test('a failing source keeps the previous data and counts failures', () => {
  const ok = core.assemble({ openMeteo: { ok: true, data: fx.openMeteo(NOW) } }, {}, null, NOW);
  const bad = core.assemble({ openMeteo: { ok: false, error: 'HTTP 500' } }, {}, ok, NOW + 600000);
  assert.strictEqual(bad.sources.openMeteo.ok, false);
  assert.strictEqual(bad.sources.openMeteo.fails, 1);
  assert.ok(bad.weather && bad.weather.current.temp === 25.4);
  const bad2 = core.assemble({ openMeteo: { ok: true, data: { nonsense: 1 } } }, {}, ok, NOW);
  assert.strictEqual(bad2.sources.openMeteo.ok, false);
});
test('fast rise alert from history', () => {
  const snap = core.assemble({ ibWater: { ok: true, tables: fx.waterTables(NOW) } }, {}, null, NOW);
  const id = snap.stations.find(s => /Air Putih/.test(s.name)).id;
  const hist = [{ t: NOW - 3600000, levels: { [id]: 8.7 } }];
  const a = core.evaluateAlerts(snap, {}, hist, NOW).filter(x => x.key.startsWith('rise:'));
  assert.strictEqual(a.length, 1);
});
test('newAlerts: new or escalated only', () => {
  const prev = [{ key: 'a', level: 'info' }, { key: 'b', level: 'warning' }];
  const cur = [{ key: 'a', level: 'warning' }, { key: 'b', level: 'warning' }, { key: 'c', level: 'info' }];
  assert.deepStrictEqual(core.newAlerts(prev, cur).map(x => x.key), ['a', 'c']);
});

/* ------------------------------------------------------------- languages */
const I18N = require('../www/assets/js/i18n');
test('every L(\'...\') text in the code has an English translation', () => {
  const files = ['www/assets/js/app.js', 'www/assets/js/core.js', 'www/assets/js/charts.js', 'www/assets/js/offshore.js', 'main.js', 'lib/collector.js', 'lib/api.js', 'lib/store.js'];
  const missing = [];
  files.forEach(f => {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    const re = /\bL\('((?:[^'\\\n]|\\.)*)'/g;
    let m;
    while ((m = re.exec(src))) { const k = m[1].replace(/\\'/g, "'").replace(/\\n/g, '\n'); if (!I18N.has(k)) missing.push(f + ': ' + k); }
  });
  assert.deepStrictEqual(missing, []);
  /* site and category names */
  core.CATEGORIES.forEach(c => { assert.ok(I18N.has(c.name), c.name); c.items.forEach(x => { if (/[a-z]/.test(x.desc)) assert.ok(I18N.has(x.desc), x.desc); }); });
});
test('English is the default; BM on request; alert texts follow', () => {
  assert.strictEqual(core.DEFAULTS.lang, 'en');
  assert.strictEqual(core.cleanSettings({ lang: 'xx' }).lang, 'en');
  I18N.setLang('en');
  assert.strictEqual(I18N.L('Tetapan'), 'Settings');
  assert.strictEqual(I18N.L('{n} min lalu', { n: 5 }), '5 min ago');
  assert.strictEqual(core.compass(45), 'NE'); assert.strictEqual(core.fmtDate(NOW), 'Tue 17 Nov');
  assert.strictEqual(I18N.met('Ribut petir di beberapa tempat'), 'Thunderstorms in scattered places');
  assert.strictEqual(I18N.met('Hujan di kebanyakan tempat'), 'Rain in most places');
  const s = core.profileSettings({}, core.DEFAULT_PROFILES[1]);
  const mk = () => core.assemble({ openMeteo: { ok: true, data: fx.openMeteo(NOW, true) }, marine: { ok: true, data: fx.marine(NOW, true) }, metWarning: { ok: true, data: fx.metWarning(NOW) } }, s, null, NOW);
  let a = core.evaluateAlerts(mk(), s, [], NOW);
  assert.ok(a.some(x => x.title === 'Strong winds' && /knots/.test(x.body)));
  assert.ok(a.some(x => /^MET: Strong Winds and Rough Seas Warning/.test(x.title)), 'MET warning in English');
  const met = a.find(x => /^MET: Strong Winds/.test(x.title));
  assert.ok(/^Thunderstorms until \d\d:\d\d (today|tomorrow) · wind 40–50 km\/h \(22–27 knot\), waves 3\.5 m .+ · Terengganu, Condore, Reef North$/.test(met.body), met.body);
  I18N.setLang('ms');
  assert.strictEqual(I18N.L('Tetapan'), 'Tetapan');
  assert.strictEqual(core.compass(45), 'TL'); assert.strictEqual(core.fmtDate(NOW), 'Sel 17 Nov');
  a = core.evaluateAlerts(mk(), s, [], NOW);
  assert.ok(a.some(x => x.title === 'Angin kencang' && /knot/.test(x.body)));
  assert.ok(a.some(x => /^MET: Amaran Angin Kencang/.test(x.title)), 'MET warning in BM');
  const metb = a.find(x => /^MET: Amaran Angin Kencang/.test(x.title));
  assert.ok(/^Ribut petir sehingga \d\d:\d\d (hari ini|esok) · angin 40–50 km\/j \(22–27 knot\), ombak 3\.5 m /.test(metb.body), metb.body);
  I18N.setLang('en');
});

/* ------------------------------------------------------------ ad blocker */
test('ad blocker: settings, bundled engine, pop-ups, exceptions', () => {
  assert.strictEqual(core.DEFAULTS.adblock, true);
  assert.strictEqual(core.cleanSettings({ adblockExcept: 'https://www.Tide-Forecast.com/x, vesselfinder.com;  bad host, windy.com, windy.com' }).adblockExcept,
    'tide-forecast.com, vesselfinder.com, windy.com');
  const os = require('os');
  const { AdBlock } = require('../lib/adblock');
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'lib', 'adblock-engine.json'), 'utf8'));
  assert.ok(meta.lists >= 14 && meta.bytes > 1e6, 'engine shipped with the app');
  const ab = new AdBlock({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'mc-ad-')), fetchText: async () => '' }).load();
  assert.strictEqual(ab.info().source, 'bundled');
  ab.setSettings(core.cleanSettings({}));
  const page = u => ({ id: 7, isDestroyed: () => false, getURL: () => u });
  const wc = page('https://www.tide-forecast.com/tides/Kemaman');
  assert.strictEqual(ab.blocksPopup('https://www.googleadservices.com/pagead/aclk?sa=L&ai=x', wc), true);
  assert.strictEqual(ab.blocksPopup('https://www.windy.com/?5.5,104.7', wc), false);
  assert.strictEqual(ab.blocked(7), 1);
  ab.setSettings(core.cleanSettings({ adblockExcept: 'tide-forecast.com' }));
  assert.strictEqual(ab.pageExcepted(wc), true);
  assert.strictEqual(ab.pageExcepted(page('https://www.vesselfinder.com/')), false);
  assert.strictEqual(ab.blocksPopup('https://www.googleadservices.com/pagead/aclk?sa=L', wc), false, 'site left alone');
  ab.setSettings(core.cleanSettings({ adblock: false }));
  assert.strictEqual(ab.blocksPopup('https://www.googleadservices.com/pagead/aclk?sa=L', page('https://www.vesselfinder.com/')), false, 'switched off');
  assert.strictEqual(ab.due(Date.now()), true, 'never updated on this PC: update due');
});

test('ad blocker: daily update builds a new engine in a worker, keeps it, uses it next start; failure keeps the old one', async () => {
  const os = require('os');
  const { AdBlock } = require('../lib/adblock');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-adup-'));
  const pad = '! filler\n'.repeat(12000);
  const fetchText = async url => /easylist\.txt$/.test(url) ? '[Adblock Plus 2.0]\n||zzq-promo-test.net^\n' + pad : /resources/.test(url) ? '' : '! empty\n';
  const ab = new AdBlock({ dir, fetchText }).load();
  ab.setSettings(core.cleanSettings({}));
  const page = { id: 3, isDestroyed: () => false, getURL: () => 'https://site.example.org/' };
  assert.strictEqual(ab.blocksPopup('https://zzq-promo-test.net/x', page), false, 'not in the shipped lists');
  const info = await ab.update(true);
  assert.strictEqual(info.error, '', info.error); assert.strictEqual(info.source, 'updated');
  assert.strictEqual(ab.blocksPopup('https://zzq-promo-test.net/x', page), true, 'new list in use at once');
  assert.ok(fs.existsSync(path.join(dir, 'engine.bin')));
  assert.strictEqual(ab.due(Date.now()), false);
  const again = new AdBlock({ dir, fetchText }).load();
  assert.strictEqual(again.info().source, 'updated', 'next start uses the downloaded copy');
  /* a failed download keeps the old engine and retries in ~3 h */
  const bad = new AdBlock({ dir, fetchText: async () => { throw new Error('offline'); } }).load();
  const r = await bad.update(true);
  assert.ok(/offline/.test(r.error)); assert.strictEqual(bad.info().source, 'updated');
  assert.strictEqual(bad.due(Date.now()), false); assert.strictEqual(bad.due(Date.now() + 3.1 * 3600e3), true);
});

/* ------------------------------------------------- site relay (Cloudflare Worker) */
test('relay worker: removes the framing refusal, keeps the page working, refuses other sites and wrong keys', async () => {
  const R = await require('./relay-harness').start('k3y-test');
  try {
    const get = (u, h) => fetch(u, { redirect: 'manual', headers: h || {} });
    let r = await get(R.url('/page'));
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.headers.get('x-frame-options'), null, 'X-Frame-Options removed');
    assert.strictEqual(r.headers.get('content-security-policy'), null, 'CSP removed');
    let html = await r.text();
    const base = 'http://127.0.0.1:' + R.relay.port + '/k3y-test/http/127.0.0.1:' + R.origin.port;
    assert.ok(html.includes('href="' + base + '/next"'), 'absolute link goes through the relay');
    assert.ok(html.includes('src="' + base + '/img/d.gif"'), 'absolute picture goes through the relay');
    assert.ok(html.includes('href="' + base + '/s.css"'), 'protocol-relative stylesheet keeps the page protocol');
    assert.ok(!/name="referrer"/.test(html), 'page no-referrer removed');
    /* redirect stays inside the relay */
    r = await get(R.url('/old'));
    assert.strictEqual(r.status, 302);
    assert.strictEqual(r.headers.get('location'), base + '/page?from=old');
    /* "/img/b.gif" asked by the relayed page -> rebuilt from its Referer */
    r = await get('http://127.0.0.1:' + R.relay.port + '/img/b.gif', { referer: R.url('/page') });
    assert.strictEqual(r.status, 307);
    assert.strictEqual(r.headers.get('location'), base + '/img/b.gif');
    /* data requests: cookies are not passed on */
    r = await get(R.url('/api/data'));
    assert.strictEqual(r.headers.get('set-cookie'), null);
    assert.strictEqual(r.headers.get('access-control-allow-origin'), '*');
    assert.deepStrictEqual(await r.json(), { level: '3.21 m' });
    /* not an open proxy */
    r = await get('http://127.0.0.1:' + R.relay.port + '/k3y-test/https/evil.example.com/');
    assert.strictEqual(r.status, 403);
    r = await get('http://127.0.0.1:' + R.relay.port + '/wrong-key/http/127.0.0.1:' + R.origin.port + '/page');
    assert.strictEqual(r.status, 404);
    r = await get('http://127.0.0.1:' + R.relay.port + '/img/x.gif');
    assert.strictEqual(r.status, 404, 'no referer, no guess');
    r = await get('http://127.0.0.1:' + R.relay.port + '/img/x.gif', { referer: 'https://other.example/k3y-test/http/127.0.0.1:' + R.origin.port + '/page' });
    assert.strictEqual(r.status, 404, 'referer from another site is ignored');
    /* the site cannot be reached by Cloudflare (530): a clear page, marked as coming from the relay */
    r = await get(R.url('/cf530'));
    assert.strictEqual(r.status, 530); assert.strictEqual(r.headers.get('x-relay'), 'dashboard-cuaca-aziz');
    assert.ok(/Cloudflare cannot find this site/.test(await r.text()));
    /* how the app reads relay answers */
    assert.strictEqual(core.relayVerdict(200, true), 'ok'); assert.strictEqual(core.relayVerdict(530, true), 'dns');
    assert.strictEqual(core.relayVerdict(404, false), 'badkey'); assert.strictEqual(core.relayVerdict(403, false), 'notallowed');
    assert.strictEqual(core.relayVerdict(502, false), 'down'); assert.strictEqual(core.relayVerdict(403, true), 'refused');
    const rs = core.cleanSettings({ relayUrl: 'https://r.a.workers.dev', relayKey: 'abcdefgh1', relayBad: 'infobanjir.terengganu.gov.my' });
    assert.strictEqual(core.relayFor(core.siteById('infobanjir'), rs), false, 'failed at the last test: browser');
    assert.strictEqual(core.relayFor(core.siteById('floodhub'), rs), true);
    assert.strictEqual(core.relayFor(core.siteById('zoomearth'), rs), false, 'own stand-in preferred');
    /* only the allowed hosts are rewritten in pages */
    assert.strictEqual(R.mod.rewriteText('<a href="https://evil.example.com/x">', 'https://r.dev'), '<a href="https://evil.example.com/x">');
  } finally { R.stop(); }
});

/* ------------------------------------------------------- store + collector */
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'mc-test-')); }
test('collector run: snapshot, history, alert log, ack, failure fallback', async () => {
  const dir = tmp();
  const store = require('../lib/store').create(dir);
  let fail = false;
  const updates = [], rung = [];
  const col = require('../lib/collector').create({
    store,
    fetchJson: url => fail ? Promise.reject(new Error('offline')) : fx.forUrl(url, Date.now()),
    scrape: url => fail ? Promise.reject(new Error('offline')) : fx.tablesFor(url, Date.now()),
    probe: url => fx.probe(url),
    onUpdate: s => updates.push(s), onAlerts: l => rung.push(l)
  });
  const s1 = await col.run('test');
  col.stop();
  assert.ok(s1.stations.length >= 5);
  assert.ok(rung.length === 1 && rung[0].length >= 3);
  assert.ok(fs.existsSync(path.join(dir, 'data', 'snapshot-kemaman.json')));
  assert.strictEqual(store.history(1).length, 1);
  assert.ok(store.alertLog(50).length >= 3);
  /* same alerts again: nothing new rings */
  await col.run('test'); col.stop();
  assert.strictEqual(rung.length, 1);
  col.ack('all');
  const sn = col.snapshot();
  assert.ok(sn.alerts.active.every(a => sn.alerts.acked[a.key]));
  /* everything offline: previous data stays, a "no connection" notice appears */
  fail = true;
  const s3 = await col.run('test'); col.stop();
  assert.ok(s3.weather && s3.weather.current);
  assert.ok(s3.alerts.active.some(a => a.key === 'net'));
  assert.strictEqual(s3.sources.openMeteo.ok, false);
  await col.checkSites();
  const sites = col.snapshot().sites;
  assert.strictEqual(Object.keys(sites).length, 29);
  assert.strictEqual(sites.windy.frameable, false); assert.strictEqual(sites.jalanow.ok, false); assert.strictEqual(sites.ventusky.frameable, true);
});
test('store keeps settings and prunes old history', () => {
  const dir = tmp();
  const store = require('../lib/store').create(dir);
  store.setSettings({ rain3hMm: 33 });
  assert.strictEqual(require('../lib/store').create(dir).settings().rain3hMm, 33);
  const old = NOW - 60 * 86400000;
  store.appendHistory({ t: old, levels: {} });
  store.appendHistory({ t: NOW, levels: { a: 1 } });
  store.pruneHistory(NOW);
  assert.strictEqual(fs.readdirSync(path.join(dir, 'data', 'history', 'kemaman')).length, 1);
});
test('store: profiles, shared vs per-profile settings, 3.0 migration', () => {
  const dir = tmp();
  /* a 3.0 data folder: flat settings, snapshot.json, history/*.jsonl */
  fs.mkdirSync(path.join(dir, 'data', 'history'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ settings: { rain3hMm: 44, refreshMin: 30, lat: 4.3 } }));
  fs.writeFileSync(path.join(dir, 'data', 'snapshot.json'), '{"at":1}');
  fs.writeFileSync(path.join(dir, 'data', 'history', '2026-11-17.jsonl'), '{"t":1}\n');
  const store = require('../lib/store').create(dir);
  assert.deepStrictEqual(store.profiles().map(p => p.id), ['kemaman', 'irong-barat']);
  assert.strictEqual(store.settings().rain3hMm, 44); assert.strictEqual(store.settings().lat, 4.3); assert.strictEqual(store.settings().refreshMin, 30);
  assert.ok(fs.existsSync(path.join(dir, 'data', 'snapshot-kemaman.json')));
  assert.ok(fs.existsSync(path.join(dir, 'data', 'history', 'kemaman', '2026-11-17.jsonl')));
  /* switch: per-profile values change, shared values stay */
  store.setActive('irong-barat');
  assert.strictEqual(store.settings().kind, 'offshore'); assert.strictEqual(store.settings().rain3hMm, 30); assert.strictEqual(store.settings().refreshMin, 30);
  store.setSettings({ waveM: 3.5, refreshMin: 15, profileName: 'Irong Barat A' });
  assert.strictEqual(store.active().waveM, 3.5); assert.strictEqual(store.active().name, 'Irong Barat A');
  store.setActive('kemaman');
  assert.strictEqual(store.settings().waveM, 2.5); assert.strictEqual(store.settings().refreshMin, 15);
  const np = store.saveProfile({ name: 'Platform Tapis', kind: 'offshore', lat: 5.52, lon: 105.0 });
  assert.ok(np.id && store.profiles().length === 3);
  const again = store.saveProfile({ id: np.id, name: 'Tapis B', kind: 'offshore', lat: 5.52, lon: 105.0 });
  assert.strictEqual(again.id, np.id); assert.strictEqual(store.profiles().length, 3);
  store.setActive(np.id); store.deleteProfile(np.id);
  assert.strictEqual(store.activeId(), 'kemaman');
  store.deleteProfile('irong-barat');
  assert.throws(() => store.deleteProfile('kemaman'));
  /* reopen: everything persisted */
  const s2 = require('../lib/store').create(dir);
  assert.deepStrictEqual(s2.profiles().map(p => p.id), ['kemaman']);
});
test('frameable() reads X-Frame-Options and CSP', () => {
  const { frameable } = require('../lib/collector');
  assert.strictEqual(frameable({}), true);
  assert.strictEqual(frameable({ 'x-frame-options': 'DENY' }), false);
  assert.strictEqual(frameable({ 'content-security-policy': "default-src 'self'; frame-ancestors 'self'" }), false);
  assert.strictEqual(frameable({ 'content-security-policy': 'frame-ancestors *' }), true);
});

/* ------------------------------------------------------------ server + API */
function req(port, method, p, body, headers) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}) }, res => {
      let buf = ''; res.on('data', c => { buf += c; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: buf }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
test('server + API: files, traversal blocked, CSRF header, settings, history, SSE', async () => {
  const dir = tmp();
  const store = require('../lib/store').create(dir);
  const col = require('../lib/collector').create({ store, fetchJson: url => fx.forUrl(url, Date.now()), scrape: url => fx.tablesFor(url, Date.now()) });
  const api = require('../lib/api').create({ store, collector: col, info: () => ({ name: 't' }) });
  const port = 31940 + Math.floor(Math.random() * 50);
  const srv = require('../lib/server').create({ www: path.join(__dirname, '..', 'www'), dataDir: dir, ports: { app: port, setup: port + 1, https: port + 2 }, api: api.handle });
  await srv.start();
  try {
    await col.run('test'); col.stop();
    assert.strictEqual((await req(port, 'GET', '/')).status, 200);
    assert.ok((await req(port, 'GET', '/assets/js/core.js')).body.includes('MCCore'));
    assert.strictEqual((await req(port, 'GET', '/..%2fpackage.json')).status, 403);
    assert.ok([403, 404].includes((await req(port, 'GET', '/%2e%2e/%2e%2e/etc/passwd')).status));
    assert.ok([403, 404].includes((await req(port, 'GET', '/.hidden')).status));
    const snap = JSON.parse((await req(port, 'GET', '/api/snapshot')).body);
    assert.ok(snap.stations.length >= 5 && snap.settings.refreshMin === 10);
    assert.strictEqual((await req(port, 'POST', '/api/settings', { rain3hMm: 5 })).status, 403);   /* no X-MC header */
    const saved = JSON.parse((await req(port, 'POST', '/api/settings', { rain3hMm: 5, refreshMin: 15 }, { 'X-MC': '1' })).body);
    assert.strictEqual(saved.rain3hMm, 5); assert.strictEqual(store.settings().refreshMin, 15);
    col.stop();
    const h = JSON.parse((await req(port, 'GET', '/api/history?hours=24')).body);
    assert.ok(h.entries.length >= 1);
    const ack = JSON.parse((await req(port, 'POST', '/api/alerts/ack', { key: 'all' }, { 'X-MC': '1' })).body);
    assert.ok(Object.keys(ack.acked).length >= 1);
    /* SSE sends the snapshot at once */
    const first = await new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path: '/api/events' }, res => {
        let buf = '';
        res.on('data', c => { buf += c; if (buf.includes('event: snapshot')) { res.destroy(); resolve(buf); } });
      }).on('error', reject);
    });
    assert.ok(first.includes('"stations"'));
    assert.strictEqual((await req(port, 'GET', '/api/nope')).status, 404);
    /* profiles: switch to offshore, data for that profile is collected */
    const pr = JSON.parse((await req(port, 'GET', '/api/profiles')).body);
    assert.strictEqual(pr.active, 'kemaman'); assert.strictEqual(pr.profiles.length, 2);
    assert.strictEqual((await req(port, 'POST', '/api/profiles', { action: 'activate', id: 'irong-barat' })).status, 403);
    const sw = JSON.parse((await req(port, 'POST', '/api/profiles', { action: 'activate', id: 'irong-barat' }, { 'X-MC': '1' })).body);
    assert.strictEqual(sw.active, 'irong-barat');
    for (let i = 0; i < 50 && !(col.snapshot().profile && col.snapshot().profile.id === 'irong-barat'); i++) await new Promise(r => setTimeout(r, 50));
    col.stop();
    const os = JSON.parse((await req(port, 'GET', '/api/snapshot')).body);
    assert.strictEqual(os.settings.kind, 'offshore'); assert.strictEqual(os.stations.length, 0); assert.ok(os.alerts.active.some(a => a.key.startsWith('thunder')));
    assert.strictEqual(os.profiles.active, 'irong-barat');
    const bad = await req(port, 'POST', '/api/profiles', { action: 'activate', id: 'tiada' }, { 'X-MC': '1' });
    assert.strictEqual(bad.status, 400);
  } finally { await srv.stop(); col.stop(); }
});
test('phone sharing: setup port only serves the guide, HTTPS serves the app', async () => {
  const dir = tmp();
  const port = 32040 + Math.floor(Math.random() * 50);
  const srv = require('../lib/server').create({ www: path.join(__dirname, '..', 'www'), dataDir: dir, ports: { app: port, setup: port + 1, https: port + 2 }, api: () => false });
  await srv.start();
  try {
    await srv.setShare(true);
    const g = await req(port + 1, 'GET', '/');
    assert.ok(g.body.includes('dashboard-cuaca-ca.crt'));
    assert.ok(g.body.includes('Dashboard Cuaca Local CA'));
    assert.strictEqual((await req(port + 1, 'GET', '/assets/js/app.js')).status, 302);
    assert.ok((await req(port + 1, 'GET', '/dashboard-cuaca-ca.crt')).body.includes('BEGIN CERTIFICATE'));
    const https = require('https');
    const ca = fs.readFileSync(path.join(dir, 'cert', 'ca.pem'));
    const body = await new Promise((resolve, reject) => https.get({ host: '127.0.0.1', port: port + 2, path: '/', ca }, res => { let b = ''; res.on('data', c => { b += c; }); res.on('end', () => resolve(b)); }).on('error', reject));
    assert.ok(body.includes('Dashboard Cuaca Aziz'));
    await srv.setShare(false);
  } finally { await srv.stop(); }
});

test('web app: JPS Public Infobanjir water level & rainfall tables (district filter, -9999, thresholds)', () => {
  const water = '<table><thead><tr><th>No.</th><th>Station ID</th><th>Station Name</th><th>District</th><th>Main Basin</th><th>Sub River Basin</th><th>Last Updated</th><th>Water Level (m)<br>(Graph)</th><th colspan=4>Threshold</th></tr>' +
    '<tr><th>Normal</th><th>Alert</th><th>Warning</th><th>Danger</th></tr></thead><tbody>' +
    '<tr><td>1</td><td>0670491WL</td><td>Sg. Berang di Kg. Menerong (F1)</td><td>Hulu Terengganu</td><td>Sungai Terengganu</td><td>Sg. Berang</td><td>20/11/2026 15:30</td><td><a href="x">20.44</a></td><td>20.00</td><td>23.50</td><td>24.00</td><td>24.50</td></tr>' +
    '<tr><td>45</td><td>0600261WL</td><td>Sg. Mas di Kg. Sg. Mas (F2)</td><td>Kemaman</td><td>Sungai Kemaman</td><td>Sg. Kemaman</td><td>20/11/2026 15:30</td><td><a href="x">31.20</a></td><td>27.00</td><td>31.00</td><td>31.50</td><td>32.00</td></tr>' +
    '<tr><td>46</td><td>0600241WL</td><td>Muara Sg. Kemaman di Kg. Geliga (F2)</td><td>KEMAMAN</td><td>Sungai Kemaman</td><td>Sg. Kemaman</td><td>20/11/2026 15:30</td><td>-9999</td><td>1.00</td><td>3.00</td><td>4.00</td><td>5.00</td></tr></tbody></table>';
  const rain = '<table><tr><th>No.</th><th>Station ID</th><th>Station</th><th>District</th><th>Last Updated</th><th colspan=6>Daily Rainfall</th><th>Rainfall from Midnight</th><th>Total 1 Hour</th></tr>' +
    '<tr><td>47</td><td>3933001</td><td>Hulu Jabor</td><td>Kemaman</td><td>20/11/2026 14:00:00</td><td>-9999.0</td><td>-9999.0</td><td>3.0</td><td>0.0</td><td>-9999.0</td><td>1.0</td><td><a href=x>12.5</a></td><td>4.0</td></tr>' +
    '<tr><td>2</td><td>1</td><td>Besut X</td><td>Besut</td><td>20/11/2026 15:00:00</td><td>9</td><td>3</td><td>8</td><td>2</td><td>1</td><td>3</td><td>1.5</td><td>0.5</td></tr></table>';
  const now = Date.UTC(2026, 10, 20, 8, 0);
  const w = core.parseJps(water, 'water', 'Kemaman', now);
  assert.strictEqual(w.length, 1);
  assert.strictEqual(w[0].name, 'Sg. Mas di Kg. Sg. Mas (F2)');
  assert.strictEqual(w[0].level, 31.2);
  assert.strictEqual(w[0].status, 'alert');
  assert.strictEqual(w[0].updated, Date.UTC(2026, 10, 20, 7, 30));
  const r = core.parseJps(rain, 'rain', 'Kemaman', now);
  assert.strictEqual(r.length, 1);
  assert.deepStrictEqual([r[0].rainToday, r[0].rain1h], [12.5, 4]);
  assert.deepStrictEqual(r[0].days, [null, null, 3, 0, null, 1]);
  const s = Object.assign({}, core.DEFAULTS, { useDataGovFlood: false });
  const snap = core.assemble({ jpsWater: { ok: true, html: water }, jpsRain: { ok: true, html: rain } }, s, {}, now);
  assert.strictEqual(snap.stations.length, 1);
  assert.strictEqual(snap.rainStations.length, 1);
  assert.strictEqual(snap.sources.jpsWater.ok, true);
  const al = core.evaluateAlerts(snap, s, [], now);
  assert.ok(al.some(a => a.cat === 'water'), 'water alert from JPS station');
  /* a failed JPS fetch keeps the last stations */
  const snap2 = core.assemble({ jpsWater: { ok: false, error: 'HTTP 522' } }, s, snap, now + 60000);
  assert.strictEqual(snap2.stations.length, 1);
  assert.strictEqual(snap2.sources.jpsWater.ok, false);
  assert.strictEqual(core.jpsUrls(s).jpsWater.indexOf('state=TRG&district=ALL') > 0, true);
  assert.deepStrictEqual(core.jpsUrls(Object.assign({}, s, { scrapeInfobanjir: false })), {});
  assert.strictEqual(core.cleanSettings({ jpsState: 'xx' }).jpsState, 'TRG');
  assert.strictEqual(core.cleanSettings({ jpsState: 'phg' }).jpsState, 'PHG');
  assert.deepStrictEqual(core.htmlRows('<tr><td>a &amp; b</td><td>c<br>d</td></tr>'), [['a & b', 'c d']]);
});

test('relay v2 removes ads; ad-heavy sites go through the relay when wanted', async () => {
  const { pathToFileURL } = require('url');
  const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'relay-worker.js'), 'utf8').replace("'__KEY__'", '"k1234567"').replace('__HOSTS__', '["example.com"]');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-w-')), 'w.mjs');
  fs.writeFileSync(file, src);
  const w = await import(pathToFileURL(file).href);
  assert.ok(w.VERSION >= 2);
  const out = w.stripAds('<html><head><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script><script>var keep=1</script></head>' +
    '<body><ins class="adsbygoogle" data-ad-slot="1"></ins><script>(adsbygoogle = window.adsbygoogle || []).push({});</script><iframe src="//tpc.googlesyndication.com/x"></iframe><p>Tides</p><script src="/app.js"></script></body></html>');
  assert.ok(!/pagead2|tpc\.googlesyndication|<ins/.test(out.replace(/<script>\(function\(\)\{var H=[\s\S]*?<\/script>/, '')));
  assert.ok(out.includes('var keep=1') && out.includes('/app.js') && out.includes('<p>Tides</p>'));
  assert.ok(/<head><style>/.test(out), 'guard goes first in <head>');
  const root = await w.handle(new Request('https://relay.test/'));
  assert.ok(/relay v3/.test(await root.text()));
  const s = core.cleanSettings({ relayUrl: 'https://r.workers.dev', relayKey: 'abcdefgh123' });
  assert.strictEqual(core.relayAdsFor(core.siteById('tideforecast'), s), true);
  assert.strictEqual(core.relayAdsFor(core.siteById('windy'), s), false);
  assert.strictEqual(core.relayAdsFor(core.siteById('tideforecast'), Object.assign({}, s, { relayAds: false })), false);
  assert.strictEqual(core.relayAdsFor(core.siteById('tideforecast'), core.cleanSettings({})), false);
});

/* ------------------------------------------------ offshore model comparison (4.2.0) */
test('offshore comparison: models side by side, chance over the limits, confidence, warning, words, rows', async () => {
  const OFF = require('../www/assets/js/offshore');
  const FX = require('./web-fixtures/make');
  const now = Date.parse('2026-11-21T12:30:00+08:00');
  const u = OFF.urls(5.5501, 104.7745);
  assert.strictEqual(u.length, OFF.WIND.length + OFF.WAVE.length + OFF.ENS.length);
  assert.ok(u.every(x => /forecast_days=14/.test(x.url) && /timezone=Asia%2FKuala_Lumpur/.test(x.url) && /models=/.test(x.url)));
  assert.ok(u.filter(x => x.group !== 'wave').every(x => /wind_speed_unit=kn/.test(x.url)));
  const raw = await OFF.collect(5.5501, 104.7745, async url => { if (/meteofrance_seamless/.test(url)) throw new Error('HTTP 400'); return FX.offshore(url, now); });
  assert.strictEqual(raw.wind.meteofrance_seamless.ok, false);
  assert.strictEqual(raw.wind.ecmwf_ifs025.ok, true);
  I18N.setLang('ms');
  const r = OFF.build(raw, { now, windKt: 15, waveM: 1.5 });
  assert.deepStrictEqual(r.ok.wind, ['ecmwf_ifs025', 'gfs_seamless', 'icon_seamless', 'jma_seamless', 'ukmo_seamless']);
  assert.strictEqual(r.ok.wave.length, 4); assert.strictEqual(r.ok.ens.length, 2);
  assert.strictEqual(r.days.length, 14); assert.strictEqual(r.days[0].date, '2026-11-21');
  const d1 = r.days[1];
  /* middle value + spread of the models' daily max; the fixture's models differ by -1 .. +1.5 kt */
  assert.ok(d1.wind.lo < d1.wind.m && d1.wind.m < d1.wind.hi && d1.wind.n === 5);
  assert.strictEqual(d1.probWind.src, 'ens'); assert.strictEqual(d1.probWind.n, 82);
  assert.ok(d1.probWind.p >= 0 && d1.probWind.p <= 1);
  assert.strictEqual(d1.probWave.n, 4);
  assert.ok(Math.abs(d1.hmax - d1.hs.m * 1.7) < 1e-9);
  /* day 11+: GEFS has stopped, only ECMWF ENS; confidence never "high" */
  assert.strictEqual(r.days[11].ens.n, 51);
  assert.ok(r.days.slice(10).every(x => x.conf.level <= 2));
  assert.ok(['Tinggi', 'Sederhana', 'Rendah'].includes(d1.conf.label));
  /* short models drop out: ICON (7 days) is in day 3 but not in day 9 */
  assert.ok('icon_seamless' in r.days[3].windBy && !('icon_seamless' in r.days[9].windBy));
  /* next 24 h: CAPE 900 + thunder in 2 of 5 models -> squall risk, lightning medium */
  assert.strictEqual(r.warn.lightning, 'medium');
  assert.ok(/^Risiko squall \d+–\d+ knot/.test(r.warn.lines[0]), r.warn.lines[0]);
  assert.ok(/^Angin timur laut/.test(r.summary.wind), r.summary.wind);
  assert.ok(/Monsun Timur Laut/.test(r.summary.season));
  assert.ok(/ribut petir/.test(r.summary.weather));
  const ol = OFF.outlook(r, 7);
  assert.ok(ol.some(x => /^Angin paling kuat/.test(x)) && ol.some(x => /peluang ≥50%/.test(x)));
  /* rows: 3-hourly (02, 05 .. 23) for 2 days, 6-hourly (02, 08, 14, 20) to day 7, then 08 & 20 */
  const hr = t => new Date(t + 8 * 3600000).getUTCHours();
  const r3 = OFF.rows(r, 3), r14 = OFF.rows(r, 14);
  assert.ok(r3.filter(x => OFF.dateKey(x.t) === '2026-11-22').every(x => hr(x.t) % 3 === 2));
  assert.deepStrictEqual(r3.filter(x => OFF.dateKey(x.t) === '2026-11-23').map(x => hr(x.t)), [2, 8, 14, 20]);
  assert.deepStrictEqual(r14.filter(x => OFF.dateKey(x.t) === '2026-12-01').map(x => hr(x.t)), [8, 20]);
  assert.ok(r3[0].t >= now - 90 * 60000);
  assert.strictEqual(OFF.fileName('Irong Barat (offshore)', now), 'Irong-Barat-2026-11-21_1230_LT');
  assert.strictEqual(r.sources.filter(x => !x.ok).map(x => x.id).join(), 'meteofrance_seamless');
  /* the same in English */
  I18N.setLang('en');
  const e = OFF.build(raw, { now, windKt: 15, waveM: 1.5 });
  assert.ok(/^Risk of squalls of \d+–\d+ knots/.test(e.warn.lines[0]), e.warn.lines[0]);
  assert.ok(/north-east winds/.test(e.summary.wind) && /^[A-Z]/.test(e.summary.wind), e.summary.wind);
  assert.ok(/seas, Hs/.test(e.summary.sea), e.summary.sea);
  /* limits: a higher limit lowers the chance */
  const hi = OFF.build(raw, { now, windKt: 25, waveM: 3 });
  assert.ok(hi.days[1].probWind.p <= d1.probWind.p && hi.days[1].probWave.p === 0);
  /* nothing answered: empty but no crash */
  const none = OFF.build({ wind: {}, wave: {}, ens: {} }, { now });
  assert.strictEqual(none.days.length, 0); assert.ok(none.warn.lines.length === 1);
  /* settings: limits are per profile, kept in range */
  assert.ok(core.PROFILE_KEYS.includes('offWindKt') && core.PROFILE_KEYS.includes('offWaveM'));
  assert.strictEqual(core.cleanSettings({ offWindKt: 0 }).offWindKt, 15);
  assert.strictEqual(core.cleanSettings({ offWaveM: '2.2' }).offWaveM, 2.2);
});

(async () => {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); pass++; console.log('  ✓ ' + t.name); } catch (e) { fail++; console.log('  ✗ ' + t.name + '\n    ' + (e.stack || e).toString().split('\n').slice(0, 4).join('\n    ')); }
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
