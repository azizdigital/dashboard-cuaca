/* Dashboard Cuaca Aziz - GitHub mirror parsers (JPS, Tide Forecast) against real pages: node tests/mirror.js */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const P = require('../mirror/parse');
const fx = f => fs.readFileSync(path.join(__dirname, 'web-fixtures', f), 'utf8');
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('mirror: JPS water level page (real sample, missing <tr> tags)', () => {
  const w = P.jpsWater(fx('jps-water-TRG.html'));
  assert.strictEqual(w.length, 46);
  const k = w.filter(s => s.district === 'Kemaman');
  assert.strictEqual(k.length, 8);
  assert.deepStrictEqual(k[0], { no: 30, id: '4131453', name: 'Sg. Cherul di Jambatan Ban Ho', district: 'Kemaman', basin: 'Sungai Kemaman', subBasin: 'Sg. Cherul', updated: '2026-11-20T20:55:00+08:00', level: 10.92, normal: 10, alert: 17, warning: 18, danger: 19, gid: '4131001_' });
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
(async () => {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); pass++; console.log('  ✓ ' + t.name); } catch (e) { fail++; console.log('  ✗ ' + t.name + '\n    ' + (e && e.stack || e)); }
  }
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
