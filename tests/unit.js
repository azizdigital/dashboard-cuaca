/* Dashboard Cuaca Aziz 4 - unit tests (node, no packages): node tests/unit.js */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const P = require('../mirror/parse');
const D = require('../app/js/data.js');
const SITES = require('../app/js/sites.js');
const F = require('./fixtures/make');
const fx = f => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('mirror: JPS water level page (real sample, missing <tr> tags)', () => {
  const w = P.jpsWater(fx('jps-water-TRG.html'));
  assert.strictEqual(w.length, 46);
  const k = w.filter(s => s.district === 'Kemaman');
  assert.strictEqual(k.length, 8);
  assert.deepStrictEqual(k[0], { no: 30, id: '4131453', name: 'Sg. Cherul di Jambatan Ban Ho', district: 'Kemaman', basin: 'Sungai Kemaman', subBasin: 'Sg. Cherul', updated: '2026-11-20T20:55:00+08:00', level: 10.92, normal: 10, alert: 17, warning: 18, danger: 19 });
});
test('mirror: JPS rainfall page (rows without <tr>, -9999 = no reading, dates from the header)', () => {
  const r = P.jpsRain(fx('jps-rain-TRG.html'));
  assert.strictEqual(r.stations.length, 93);
  assert.deepStrictEqual(r.days, ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19']);
  assert.strictEqual(r.today, '2026-11-20');
  const hj = r.stations.find(s => s.name === 'Hulu Jabor');
  assert.deepStrictEqual([hj.daily, hj.today, hj.hour, hj.updated], [[null, null, 3, 0, null, 1], 0, 0, '2026-11-20T17:00:00+08:00']);
  assert.strictEqual(r.stations.filter(s => s.district === 'Kemaman').length, 17);
});
test('mirror: Tide Forecast Cukai - high / low times and heights in metres, year across December', () => {
  const t = P.tides(fx('tide-cukai.html'), Date.parse('2026-11-20T13:00:00Z'));
  assert.ok(t.length > 100);
  assert.deepStrictEqual(t[0], { type: 'high', time: '2026-11-20T05:00:00+08:00', m: 2.09 });
  assert.deepStrictEqual(t[1], { type: 'low', time: '2026-11-20T12:38:00+08:00', m: 0.81 });
  assert.ok(t.every((e, i) => !i || Date.parse(e.time) > Date.parse(t[i - 1].time)));
  const dec = P.tides('<tr><td>High Tide</td><td><b> 1:00 AM</b><span>(Fri 1 January)</span></td><td>x (1.50 m)</td></tr>', Date.parse('2026-12-30T00:00:00Z'));
  assert.strictEqual(dec[0].time, '2027-01-01T01:00:00+08:00');
});
test('data: forecast, marine (to ~10 days), tide turns from the sea level', () => {
  const now = Date.parse('2026-11-20T05:00:00Z');
  const fc = D.readForecast(F.forecast(now));
  assert.strictEqual(fc.daily.length, 16); assert.strictEqual(fc.hourly.length, 384);
  assert.strictEqual(fc.current.t, Date.parse('2026-11-20T13:00:00+08:00'));
  const m = D.readMarine(JSON.parse(fx('om-marine.json')));
  assert.strictEqual(m.daily.length, 10);
  assert.ok(m.hourly.length >= 240 && m.hourly.every(h => h.t));
  const turns = D.tideTurns(m.hourly);
  assert.ok(turns.length > 30);
  assert.ok(turns.every((e, i) => !i || e.type !== turns[i - 1].type), 'high and low alternate');
});
test('data: 28-day outlook from the GFS ensemble - median, range, weeks', () => {
  const o = D.readOutlook(JSON.parse(fx('om-ensemble-gfs.json')));
  assert.strictEqual(o.length, 28);
  assert.ok(o.every(d => d.pLo <= d.p && d.p <= d.pHi));
  const w = D.weeks(o);
  assert.strictEqual(w.length, 4);
  assert.strictEqual(w[0].from, o[0].date);
});
test('data: MET warnings - expired and "No Advisory" dropped, repeats merged, area match, 3rd category = danger', () => {
  const w = D.readWarnings(JSON.parse(fx('dg-warning.json')), 'Terengganu, Kemaman', Date.parse('2026-11-20T13:30:00Z'));
  assert.strictEqual(w.length, 2);
  assert.deepStrictEqual(w.map(x => [x.title, x.mine, x.level]), [['Strong Winds and Rough Seas Warning', true, 'danger'], ['Thunderstorms Warning', false, 'warning']]);
  assert.strictEqual(w[0].to, Date.parse('2026-11-24T23:59:59+08:00'));
  assert.strictEqual(D.readWarnings(JSON.parse(fx('dg-warning.json')), 'Terengganu', Date.parse('2026-11-25T00:00:00Z')).length, 0);
});
test('data: MET 7-day forecast and English phrases', () => {
  const f = D.readMetForecast(JSON.parse(fx('dg-forecast-ds.json')));
  assert.strictEqual(f.length, 7);
  assert.strictEqual(D.metText('Ribut petir di kebanyakan tempat', 'en'), 'Thunderstorms in most places');
  assert.strictEqual(D.metText('Ribut petir di kebanyakan tempat', 'ms'), 'Ribut petir di kebanyakan tempat');
});
test('data: JPS from the mirror - district filter, status against thresholds', () => {
  const now = Date.now(), m = F.mirror(now);
  const k = D.readJps(m.jps, 'Kemaman');
  assert.strictEqual(k.water.length, 8); assert.strictEqual(k.rain.length, 17);
  const mas = k.water.find(s => s.name.startsWith('Sg. Mas'));
  assert.strictEqual(mas.status, 'normal');           /* 29.14 m, alert from 31 m */
  assert.strictEqual(D.stationStatus({ level: 31.6, alert: 31, warning: 31.5, danger: 32 }), 'warning');
  assert.strictEqual(D.stationStatus({ level: 32, alert: 31, warning: 31.5, danger: 32 }), 'danger');
  assert.strictEqual(D.stationStatus({ level: null }), 'na');
  assert.strictEqual(D.readJps(m.jps, '').water.length, 46);
});
test('data: alerts - MET for my area, JPS levels, JPS rain, gusts, waves; limits from settings', () => {
  const now = Date.now(), m = F.mirror(now);
  const jps = D.readJps(m.jps, 'Kemaman');
  jps.water[0].level = 18.5; jps.water[0].status = D.stationStatus(jps.water[0]);
  jps.rain[0].hour = 25;
  const fc = D.readForecast(F.forecast(now, { gust: 62 }));
  const warnings = D.readWarnings(F.warnings(now), 'Terengganu', now);
  const marine = { hourly: [{ t: now, wave: 3.1 }] };
  const a = D.alerts({ fc, marine, warnings, jps }, D.DEFAULT_PROFILES[0], {}, now);
  const kinds = a.map(x => x.kind + ':' + x.level);
  assert.ok(kinds.includes('met:danger')); assert.ok(kinds.includes('water:warning')); assert.ok(kinds.includes('rain:warning'));
  assert.ok(kinds.includes('gust:warning')); assert.ok(kinds.includes('wave:warning'));
  assert.strictEqual(a[0].level, 'danger');
  const calm = D.alerts({ fc: D.readForecast(F.forecast(now)), marine: { hourly: [{ t: now, wave: 1 }] }, warnings: [], jps: D.readJps(m.jps, 'Kemaman') }, D.DEFAULT_PROFILES[0], { jpsLevel: 'warning' }, now);
  assert.deepStrictEqual(calm, []);
});
test('data: profiles and settings are cleaned', () => {
  const p = D.cleanProfile({ name: 'Kuala Dungun', lat: '4.78', lon: '103.42', jpsState: 'trg', jpsDistrict: 'Dungun', metId: 'bad', kind: 'x' });
  assert.deepStrictEqual([p.id, p.kind, p.lat, p.seaLat, p.jpsState, p.metId, p.tide], ['kuala-dungun', 'land', 4.78, 4.78, 'TRG', '', 'model']);
  assert.strictEqual(D.cleanProfile({ jpsState: 'XXX', jpsDistrict: 'Kemaman' }).jpsDistrict, '');
  const s = D.cleanSettings({ lang: 'fr', gustKmh: 'abc', waveM: 99, days: 9, jpsLevel: 'x' });
  assert.deepStrictEqual([s.lang, s.gustKmh, s.waveM, s.days, s.jpsLevel], ['en', 50, 15, 7, 'alert']);
});
test('data: addresses - mirror repo from the Pages address', () => {
  assert.strictEqual(D.mirrorBase({ hostname: 'azizdigital.github.io', pathname: '/dashboard-cuaca/' }), 'https://raw.githubusercontent.com/azizdigital/dashboard-cuaca/data/');
  assert.strictEqual(D.repoOf({ hostname: 'localhost', pathname: '/' }), 'azizdigital/dashboard-cuaca');
  const p = D.DEFAULT_PROFILES[0];
  assert.ok(/marine-api.*latitude=4.26&longitude=103.52/.test(D.marineUrl(p)));
  assert.ok(/forecast_days=35.*models=gfs05|models=gfs05.*forecast_days=35/.test(D.outlookUrl(p)));
  assert.strictEqual(D.metForecastUrl(D.DEFAULT_PROFILES[1]), '');
});
test('sites: every tile has an address for both profiles; in-app tiles are the ones checked to allow framing', () => {
  const all = SITES.all();
  assert.ok(all.length >= 30);
  const ids = new Set();
  all.forEach(s => {
    assert.ok(!ids.has(s.id), 'unique ' + s.id); ids.add(s.id);
    D.DEFAULT_PROFILES.forEach(p => { const u = s.url(p); assert.ok(/^(https:\/\/|embed\/)/.test(u), s.id + ' ' + u); });
    assert.ok(s.ms && s.en && s.dms && s.den);
  });
  const inApp = all.filter(s => s.in).map(s => s.url(D.DEFAULT_PROFILES[0]).replace(/^https:\/\/([^/]+).*$/, '$1'));
  const allowed = ['embed.windy.com', 'www.rainviewer.com', 'www.ventusky.com', 'www.meteoblue.com', 'map.blitzortung.org', 'earth.nullschool.net', 'webcams.windy.com', 'www.jalanow.com'];
  inApp.forEach(h => assert.ok(allowed.includes(h) || /^embed\//.test(h), 'in-app host checked: ' + h));
});

(async () => {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); pass++; console.log('  ✓ ' + t.name); } catch (e) { fail++; console.log('  ✗ ' + t.name + '\n    ' + (e && e.stack || e)); }
  }
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
