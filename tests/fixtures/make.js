/* made-up Open-Meteo forecast around "now" + mirror files built from the real JPS / tide pages in this folder */
'use strict';
const fs = require('fs'), path = require('path');
const P = require('../../mirror/parse');
const dir = __dirname;
function pad(n) { return String(n).padStart(2, '0'); }
function local(ms) { const d = new Date(ms + 8 * 3600000); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + ':00'; }
function forecast(now, opts) {
  opts = opts || {};
  const start = Date.parse(local(now).slice(0, 10) + 'T00:00:00+08:00');
  const H = { time: [], temperature_2m: [], precipitation_probability: [], precipitation: [], weather_code: [], wind_speed_10m: [], wind_gusts_10m: [], wind_direction_10m: [] };
  for (let i = 0; i < 16 * 24; i++) {
    const t = start + i * 3600000;
    H.time.push(local(t)); H.temperature_2m.push(26 + 4 * Math.sin(i / 24 * 2 * Math.PI - 1.5)); H.precipitation_probability.push(i % 24 > 14 ? 70 : 20);
    H.precipitation.push(i % 24 === 16 ? 6.5 : i % 24 === 17 ? 2 : 0); H.weather_code.push(i % 24 === 16 ? 95 : 3);
    H.wind_speed_10m.push(18 + (i % 24) / 2); H.wind_gusts_10m.push((opts.gust || 35) + (i % 24) / 2); H.wind_direction_10m.push(45);
  }
  const D = { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_sum: [], precipitation_probability_max: [], wind_speed_10m_max: [], wind_gusts_10m_max: [], wind_direction_10m_dominant: [], sunrise: [], sunset: [] };
  for (let d = 0; d < 16; d++) {
    const day = local(start + d * 86400000).slice(0, 10);
    D.time.push(day); D.weather_code.push(d % 3 ? 61 : 95); D.temperature_2m_max.push(31); D.temperature_2m_min.push(23); D.precipitation_sum.push(8.5 + d);
    D.precipitation_probability_max.push(70); D.wind_speed_10m_max.push(30); D.wind_gusts_10m_max.push(opts.gust ? opts.gust + 12 : 47); D.wind_direction_10m_dominant.push(40);
    D.sunrise.push(day + 'T06:55'); D.sunset.push(day + 'T18:50');
  }
  return { utc_offset_seconds: 28800, timezone: 'Asia/Kuala_Lumpur', current: { time: local(now), temperature_2m: 27.4, apparent_temperature: 31, relative_humidity_2m: 84, precipitation: 0.2, weather_code: 80, wind_speed_10m: 22, wind_direction_10m: 45, wind_gusts_10m: opts.gust || 38, is_day: 1 }, hourly: H, daily: D };
}
/* the real marine / ensemble samples shifted so that they start today */
function shiftOpenMeteo(file, now) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const first = (j.hourly || j.daily).time[0];
  const delta = Date.parse(local(now).slice(0, 10) + 'T00:00:00Z') - Date.parse(first.slice(0, 10) + 'T00:00:00Z');
  const sh = t => { const ms = Date.parse((t.length === 10 ? t + 'T00:00' : t) + ':00Z') + delta; const s = new Date(ms).toISOString(); return t.length === 10 ? s.slice(0, 10) : s.slice(0, 16); };
  if (j.hourly) j.hourly.time = j.hourly.time.map(sh);
  if (j.daily) j.daily.time = j.daily.time.map(sh);
  return j;
}
function mirror(now) {
  const iso = new Date(now).toISOString();
  const water = P.jpsWater(fs.readFileSync(path.join(dir, 'jps-water-TRG.html'), 'utf8'));
  const rain = P.jpsRain(fs.readFileSync(path.join(dir, 'jps-rain-TRG.html'), 'utf8'));
  /* make the readings recent */
  const stamp = local(now - 20 * 60000).replace('T', 'T') + ':00+08:00';
  water.forEach(s => { s.updated = stamp; });
  rain.stations.forEach(s => { s.updated = stamp; });
  const tides = P.tides(fs.readFileSync(path.join(dir, 'tide-cukai.html'), 'utf8'), Date.parse('2026-11-20T13:00:00Z'));
  const shift = Date.parse(local(now).slice(0, 10) + 'T00:00:00Z') - Date.parse('2026-11-20T00:00:00Z');
  tides.forEach(e => { e.time = new Date(Date.parse(e.time) + shift).toISOString(); });
  return {
    jps: { state: 'TRG', at: iso, water, rain, waterAt: iso, rainAt: iso, waterUrl: 'https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/aras-air-data/?state=TRG&district=ALL&station=ALL&lang=en', rainUrl: 'https://publicinfobanjir.water.gov.my/x', errors: {} },
    tide: { place: 'cukai', at: iso, url: 'https://www.tide-forecast.com/locations/Cukai/tides/latest', events: tides, eventsAt: iso, error: null }
  };
}
function warnings(now) {
  const w = JSON.parse(fs.readFileSync(path.join(dir, 'dg-warning.json'), 'utf8'));
  const f = ms => new Date(ms + 8 * 3600000).toISOString().slice(0, 19);
  w.forEach((x, i) => { if (x.valid_to) { x.valid_from = f(now - 3600000); x.valid_to = f(now + (i + 1) * 6 * 3600000); } });
  return w;
}
function metForecast(now) {
  const f = JSON.parse(fs.readFileSync(path.join(dir, 'dg-forecast-ds.json'), 'utf8'));
  const start = Date.parse(local(now).slice(0, 10) + 'T00:00:00Z');
  f.sort((a, b) => a.date < b.date ? -1 : 1).forEach((x, i) => { x.date = new Date(start + i * 86400000).toISOString().slice(0, 10); });
  return f;
}
module.exports = { forecast, shiftOpenMeteo, mirror, warnings, metForecast, local };
