/* Dashboard Cuaca Aziz - mirror run by GitHub every ~15 minutes (.github/workflows/mirror.yml).
   Reads the pages that do not let other web pages read them (JPS Public Infobanjir, Tide Forecast)
   and writes small JSON files that the app reads.
   usage: node mirror/mirror.js <outDir>        (Node 20+, no packages) */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./parse');

const OUT = path.resolve(process.argv[2] || 'out');
const REPO = process.env.GITHUB_REPOSITORY || 'azizdigital/dashboard-cuaca';
const PREV = 'https://raw.githubusercontent.com/' + REPO + '/data/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

/* JPS states mirrored (state codes of JPS Public Infobanjir). Add e.g. 'PHG' for Pahang. */
const STATES = (process.env.JPS_STATES || 'TRG').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
/* Tide Forecast places: id -> page */
const TIDES = { cukai: 'https://www.tide-forecast.com/locations/Cukai/tides/latest' };

const jpsWaterUrl = st => 'https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/aras-air-data/?state=' + st + '&district=ALL&station=ALL&lang=en';
const jpsRainUrl = st => 'https://publicinfobanjir.water.gov.my/wp-content/themes/shapely/agency/searchresultrainfall.php?state=' + st + '&district=ALL&station=ALL&language=1&loginStatus=0';

async function get(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(45000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) { last = e; await new Promise(res => setTimeout(res, 4000 * (i + 1))); }
  }
  throw last;
}
async function previous(file) {
  try { const r = await fetch(PREV + file + '?t=' + Date.now(), { signal: AbortSignal.timeout(20000) }); return r.ok ? await r.json() : null; } catch (e) { return null; }
}
function write(file, data) { fs.writeFileSync(path.join(OUT, file), JSON.stringify(data)); }

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const now = new Date().toISOString(), status = { at: now, sources: {} };

  for (const st of STATES) {
    const file = 'jps-' + st + '.json', prev = await previous(file);
    const out = { state: st, at: now, water: null, rain: null, waterAt: null, rainAt: null, waterUrl: jpsWaterUrl(st), rainUrl: jpsRainUrl(st), errors: {} };
    try {
      const w = P.jpsWater(await get(out.waterUrl));
      if (!w.length) throw new Error('no stations in the table');
      out.water = w; out.waterAt = now;
    } catch (e) { out.errors.water = String(e.message || e); if (prev) { out.water = prev.water; out.waterAt = prev.waterAt; } }
    try {
      const r = P.jpsRain(await get(out.rainUrl));
      if (!r.stations.length) throw new Error('no stations in the table');
      out.rain = r; out.rainAt = now;
    } catch (e) { out.errors.rain = String(e.message || e); if (prev) { out.rain = prev.rain; out.rainAt = prev.rainAt; } }
    write(file, out);
    status.sources['jps-' + st] = { water: !out.errors.water, rain: !out.errors.rain, errors: out.errors, stations: (out.water || []).length };
  }

  for (const [id, url] of Object.entries(TIDES)) {
    const file = 'tide-' + id + '.json', prev = await previous(file);
    const out = { place: id, at: now, url, events: null, eventsAt: null, error: null };
    try {
      const ev = P.tides(await get(url));
      if (ev.length < 4) throw new Error('no tide times on the page');
      out.events = ev; out.eventsAt = now;
    } catch (e) { out.error = String(e.message || e); if (prev) { out.events = prev.events; out.eventsAt = prev.eventsAt; } }
    write(file, out);
    status.sources['tide-' + id] = { ok: !out.error, error: out.error, events: (out.events || []).length };
  }

  write('status.json', status);
  console.log(JSON.stringify(status, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });
