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

/* made-up offshore model answers (Open-Meteo, one model per request): each model a little different, short models stop early */
const OFF_W = { ecmwf_ifs025: [0, 15], gfs_seamless: [1.5, 16], icon_seamless: [-1, 7], jma_seamless: [0.5, 11], meteofrance_seamless: [-0.5, 4], ukmo_seamless: [1, 7] };
const OFF_V = { ecmwf_wam025: [0, 15, 3], ncep_gfswave025: [0.15, 16, 1], meteofrance_wave: [-0.1, 10, 3], dwd_gwam: [0.05, 7, 1] };
function offshore(url, now) {
  const u = new URL(url), model = u.searchParams.get('models'), days = 14;
  const start = Date.parse(local(now).slice(0, 10) + 'T00:00:00+08:00');
  if (/ensemble-api/.test(url)) {
    const runs = model === 'gfs025' ? 31 : 51, D = { time: [] };
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let d = 0; d < days; d++) D.time.push(local(start + d * 86400000).slice(0, 10));
    for (let m = 0; m < runs; m++) {
      const k = m ? '_member' + String(m).padStart(2, '0') : '';
      D['wind_speed_10m_max' + k] = D.time.map((t, d) => d >= (model === 'gfs025' ? 10 : 15) ? null : Math.round((15 + 4 * Math.sin(d / 2) + (rnd() - 0.5) * (2 + d)) * 10) / 10);
      D['wind_gusts_10m_max' + k] = D['wind_speed_10m_max' + k].map(v => v === null ? null : Math.round(v * 13.5) / 10);
    }
    return { utc_offset_seconds: 28800, daily: D };
  }
  const H = { time: [] };
  for (let i = 0; i < days * 24; i++) H.time.push(local(start + i * 3600000));
  /* advisor (land): rain only, several places in one request -> one answer per place; heavy rain on day 2 afternoon */
  if (u.searchParams.get('hourly') === 'precipitation') {
    const lats = (u.searchParams.get('latitude') || '').split(','), [off] = OFF_W[model] || [0];
    const one = k => ({ utc_offset_seconds: 28800, hourly: { time: H.time, precipitation: H.time.map((t, i) => i >= 24 + 12 && i < 24 + 18 ? Math.max(0, 14 + off * 3 - k) : i % 24 === 15 ? 1.5 : 0) } });
    const list = lats.map((x, k) => one(k));
    return list.length > 1 ? list : list[0];
  }
  if (/marine-api/.test(url)) {
    const [off, len, step] = OFF_V[model] || [0, 7, 1], f = (i, v) => (i >= len * 24 || i % step ? null : Math.round(v * 100) / 100);
    H.wave_height = H.time.map((t, i) => f(i, 1.35 + 0.45 * Math.sin(i / 40) + off));
    H.wave_direction = H.time.map((t, i) => f(i, 45));
    H.wave_period = H.time.map((t, i) => f(i, 6));
    H.wind_wave_height = H.time.map((t, i) => f(i, 0.6 + 0.2 * Math.sin(i / 30)));
    H.wind_wave_direction = H.time.map((t, i) => f(i, 60));
    H.wind_wave_period = H.time.map((t, i) => f(i, 3));
    H.wind_wave_peak_period = H.time.map((t, i) => f(i, 4));
    H.swell_wave_height = H.time.map((t, i) => f(i, 1.1 + 0.3 * Math.sin(i / 50)));
    H.swell_wave_direction = H.time.map((t, i) => f(i, 40));
    H.swell_wave_period = H.time.map((t, i) => f(i, 6.5));
    H.swell_wave_peak_period = H.time.map((t, i) => f(i, 7));
    return { utc_offset_seconds: 28800, hourly: H };
  }
  const [off, len] = OFF_W[model] || [0, 7], f = (i, v) => (i >= len * 24 ? null : Math.round(v * 10) / 10);
  const w = i => 12 + 5 * Math.sin(2 * Math.PI * i / 30) + off;
  H.wind_speed_10m = H.time.map((t, i) => f(i, w(i)));
  H.wind_speed_80m = H.time.map((t, i) => f(i, w(i) * 1.15));
  H.wind_gusts_10m = H.time.map((t, i) => f(i, w(i) * 1.4));
  H.wind_direction_10m = H.time.map((t, i) => f(i, 45 + 15 * Math.sin(i / 12)));
  H.temperature_2m = H.time.map((t, i) => f(i, 27.5 + Math.sin(i / 24 * 2 * Math.PI)));
  H.precipitation = H.time.map((t, i) => f(i, i % 24 >= 14 && i % 24 <= 16 ? 2.5 : 0));
  H.cape = H.time.map((t, i) => f(i, i % 24 >= 12 && i % 24 <= 17 ? 900 : 150));
  H.weather_code = H.time.map((t, i) => f(i, i % 24 === 15 && /ecmwf|gfs/.test(model) ? 95 : i % 24 === 14 ? 61 : 3));
  return { utc_offset_seconds: 28800, hourly: H };
}
function isOffshore(url) { const m = new URL(url).searchParams.get('models') || ''; return m && m !== 'gfs05'; }

module.exports = { offshore, isOffshore, forecast, shiftOpenMeteo, mirror, warnings, metForecast, local };
