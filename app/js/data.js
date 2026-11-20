/* Dashboard Cuaca Aziz 4 - data: addresses, readers for every source, alert rules.
   No page code here, so the same file runs in the browser and in the tests (node). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DC = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '4.0.0';
  var TZ = 'Asia/Kuala_Lumpur', MYT = 8 * 3600000;

  /* ------------------------------------------------------------ profiles */
  var DEFAULT_PROFILES = [
    { id: 'kemaman', name: 'Kemaman', kind: 'land', lat: 4.2324, lon: 103.4229, seaLat: 4.26, seaLon: 103.52,
      jpsState: 'TRG', jpsDistrict: 'Kemaman', metId: 'Ds065', metKeywords: 'Terengganu, Kemaman', tide: 'cukai' },
    { id: 'irong-barat', name: 'Irong Barat', kind: 'offshore', lat: 5.5501, lon: 104.7745, seaLat: 5.5501, seaLon: 104.7745,
      jpsState: '', jpsDistrict: '', metId: '', metKeywords: 'Terengganu, Condore, Reef North', tide: 'model' }
  ];
  var DEFAULT_SETTINGS = { lang: 'en', gustKmh: 50, windKmh: 40, waveM: 2.5, rain1hMm: 20, jpsLevel: 'alert', sound: true, days: 7 };
  var JPS_STATES = ['PLS', 'KDH', 'PNG', 'PRK', 'SEL', 'WLH', 'PTJ', 'NSN', 'MLK', 'JHR', 'PHG', 'TRG', 'KEL', 'SRK', 'SAB', 'WLP'];

  function clamp(v, lo, hi, d) { v = +v; return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; }
  function str(v, n) { return String(v === undefined || v === null ? '' : v).trim().slice(0, n || 80); }
  function slug(s) { return str(s, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }

  function cleanProfile(p) {
    p = p || {};
    var kind = p.kind === 'offshore' ? 'offshore' : 'land';
    var lat = clamp(p.lat, -90, 90, 4.2324), lon = clamp(p.lon, -180, 180, 103.4229);
    var out = {
      id: slug(p.id) || slug(p.name) || 'p' + Date.now().toString(36),
      name: str(p.name, 60) || 'Lokasi', kind: kind, lat: lat, lon: lon,
      seaLat: p.seaLat === '' || p.seaLat === undefined || p.seaLat === null ? lat : clamp(p.seaLat, -90, 90, lat),
      seaLon: p.seaLon === '' || p.seaLon === undefined || p.seaLon === null ? lon : clamp(p.seaLon, -180, 180, lon),
      jpsState: JPS_STATES.indexOf(str(p.jpsState, 3).toUpperCase()) >= 0 ? str(p.jpsState, 3).toUpperCase() : '',
      jpsDistrict: str(p.jpsDistrict, 40),
      metId: /^[A-Za-z]{2}\d{3}$/.test(str(p.metId, 5)) ? str(p.metId, 5) : '',
      metKeywords: str(p.metKeywords, 200),
      tide: p.tide === 'cukai' ? 'cukai' : 'model'
    };
    if (!out.jpsState) out.jpsDistrict = '';
    return out;
  }
  function cleanSettings(s) {
    s = Object.assign({}, DEFAULT_SETTINGS, s || {});
    return {
      lang: s.lang === 'ms' ? 'ms' : 'en',
      gustKmh: clamp(s.gustKmh, 10, 200, 50), windKmh: clamp(s.windKmh, 10, 200, 40),
      waveM: clamp(s.waveM, 0.3, 15, 2.5), rain1hMm: clamp(s.rain1hMm, 1, 200, 20),
      jpsLevel: ['alert', 'warning', 'danger'].indexOf(s.jpsLevel) >= 0 ? s.jpsLevel : 'alert',
      sound: s.sound !== false, days: [7, 14, 28].indexOf(+s.days) >= 0 ? +s.days : 7
    };
  }

  /* ------------------------------------------------------------ addresses */
  function q(o) { return Object.keys(o).map(function (k) { return k + '=' + encodeURIComponent(o[k]).replace(/%2C/g, ','); }).join('&'); }
  function forecastUrl(p) {
    return 'https://api.open-meteo.com/v1/forecast?' + q({
      latitude: p.lat, longitude: p.lon, timezone: TZ, forecast_days: 16, wind_speed_unit: 'kmh',
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day',
      hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset'
    });
  }
  function marineUrl(p) {
    return 'https://marine-api.open-meteo.com/v1/marine?' + q({
      latitude: p.seaLat, longitude: p.seaLon, timezone: TZ, forecast_days: 16,
      hourly: 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,wind_wave_height,sea_level_height_msl',
      daily: 'wave_height_max,wave_direction_dominant,wave_period_max,swell_wave_height_max,swell_wave_direction_dominant,swell_wave_period_max'
    });
  }
  /* 28 days: GFS ensemble (31 runs) - the only free model that reaches past 16 days day by day */
  function outlookUrl(p) {
    return 'https://ensemble-api.open-meteo.com/v1/ensemble?' + q({
      latitude: p.lat, longitude: p.lon, timezone: TZ, forecast_days: 35, models: 'gfs05', wind_speed_unit: 'kmh',
      daily: 'precipitation_sum,wind_speed_10m_max,temperature_2m_max,temperature_2m_min'
    });
  }
  var MET_WARN_URL = 'https://api.data.gov.my/weather/warning?limit=30';
  function metForecastUrl(p) { return p.metId ? 'https://api.data.gov.my/weather/forecast?contains=' + p.metId + '@location__location_id&limit=14' : ''; }
  function geocodeUrl(name, lang) { return 'https://geocoding-api.open-meteo.com/v1/search?' + q({ name: name, count: 8, language: lang === 'ms' ? 'ms' : 'en', format: 'json' }); }
  /* the GitHub mirror (branch "data" of this repo) */
  function repoOf(loc) {
    loc = loc || {};
    var m = /^([a-z0-9-]+)\.github\.io$/i.exec(loc.hostname || '');
    var part = String(loc.pathname || '').split('/').filter(Boolean)[0];
    return m && part ? m[1] + '/' + part : 'azizdigital/dashboard-cuaca';
  }
  function mirrorBase(loc) { return 'https://raw.githubusercontent.com/' + repoOf(loc) + '/data/'; }

  /* ------------------------------------------------------------ helpers */
  function at(o, k, i) { var a = o && o[k]; return a ? num(a[i]) : null; }
  function num(v) { return v === null || v === undefined || v === '' || !isFinite(+v) ? null : +v; }
  /* Open-Meteo local time "2026-11-20T21:00" (with its utc offset) -> ms */
  function omTime(t, offSec) { return Date.parse(t.length === 10 ? t + 'T00:00:00Z' : t + ':00Z') - (offSec || 0) * 1000; }
  function kt(kmh) { return kmh === null ? null : Math.round(kmh / 1.852); }
  function round(v, d) { if (v === null || v === undefined) return null; var f = Math.pow(10, d || 0); return Math.round(v * f) / f; }
  function maxOf(a) { var m = null; a.forEach(function (v) { if (v !== null && v !== undefined && (m === null || v > m)) m = v; }); return m; }
  function minOf(a) { var m = null; a.forEach(function (v) { if (v !== null && v !== undefined && (m === null || v < m)) m = v; }); return m; }
  function quantile(a, qn) {
    var s = a.filter(function (v) { return v !== null && v !== undefined; }).sort(function (x, y) { return x - y; });
    if (!s.length) return null;
    var pos = (s.length - 1) * qn, lo = Math.floor(pos), hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
  }
  function mytDate(ms) { return new Date(ms + MYT).toISOString().slice(0, 10); }
  function mytHM(ms) { return new Date(ms + MYT).toISOString().slice(11, 16); }

  /* ------------------------------------------------------------ readers */
  function readForecast(j) {
    if (!j || !j.hourly || !j.daily) throw new Error('Open-Meteo: unexpected answer');
    var off = j.utc_offset_seconds || 28800, H = j.hourly, D = j.daily, C = j.current || {};
    var hourly = H.time.map(function (t, i) {
      return { t: omTime(t, off), temp: at(H, 'temperature_2m', i), p: at(H, 'precipitation', i), pp: at(H, 'precipitation_probability', i),
        code: at(H, 'weather_code', i), wind: at(H, 'wind_speed_10m', i), gust: at(H, 'wind_gusts_10m', i), dir: at(H, 'wind_direction_10m', i) };
    });
    var daily = D.time.map(function (t, i) {
      return { date: t, code: at(D, 'weather_code', i), tmax: at(D, 'temperature_2m_max', i), tmin: at(D, 'temperature_2m_min', i),
        p: at(D, 'precipitation_sum', i), pp: at(D, 'precipitation_probability_max', i), wind: at(D, 'wind_speed_10m_max', i),
        gust: at(D, 'wind_gusts_10m_max', i), dir: at(D, 'wind_direction_10m_dominant', i),
        sunrise: D.sunrise && D.sunrise[i] ? omTime(D.sunrise[i], off) : null, sunset: D.sunset && D.sunset[i] ? omTime(D.sunset[i], off) : null };
    });
    var current = C.time ? { t: omTime(C.time, off), temp: num(C.temperature_2m), feels: num(C.apparent_temperature), rh: num(C.relative_humidity_2m),
      p: num(C.precipitation), code: num(C.weather_code), wind: num(C.wind_speed_10m), gust: num(C.wind_gusts_10m), dir: num(C.wind_direction_10m), day: C.is_day !== 0 } : null;
    return { current: current, hourly: hourly, daily: daily };
  }
  function readMarine(j) {
    if (!j || !j.hourly) throw new Error('Open-Meteo marine: unexpected answer');
    var off = j.utc_offset_seconds || 28800, H = j.hourly, D = j.daily || { time: [] };
    var hourly = H.time.map(function (t, i) {
      return { t: omTime(t, off), wave: at(H, 'wave_height', i), waveDir: at(H, 'wave_direction', i), wavePer: at(H, 'wave_period', i),
        swell: at(H, 'swell_wave_height', i), swellDir: at(H, 'swell_wave_direction', i), swellPer: at(H, 'swell_wave_period', i),
        windWave: at(H, 'wind_wave_height', i), sea: at(H, 'sea_level_height_msl', i) };
    });
    var daily = D.time.map(function (t, i) {
      return { date: t, wave: at(D, 'wave_height_max', i), waveDir: at(D, 'wave_direction_dominant', i), wavePer: at(D, 'wave_period_max', i),
        swell: at(D, 'swell_wave_height_max', i), swellDir: at(D, 'swell_wave_direction_dominant', i), swellPer: at(D, 'swell_wave_period_max', i) };
    }).filter(function (d) { return d.wave !== null || d.swell !== null; });
    while (hourly.length && hourly[hourly.length - 1].wave === null && hourly[hourly.length - 1].sea === null) hourly.pop();
    return { hourly: hourly, daily: daily };
  }
  /* 28-day outlook: median and 10-90 % range of the ensemble runs, day by day */
  function readOutlook(j) {
    if (!j || !j.daily || !j.daily.time) throw new Error('Open-Meteo ensemble: unexpected answer');
    var D = j.daily, keys = Object.keys(D);
    function members(base, i) { return keys.filter(function (k) { return k === base || k.indexOf(base + '_member') === 0; }).map(function (k) { return num(D[k][i]); }); }
    return D.time.map(function (t, i) {
      var p = members('precipitation_sum', i), w = members('wind_speed_10m_max', i), tx = members('temperature_2m_max', i), tn = members('temperature_2m_min', i);
      var wet = p.filter(function (v) { return v !== null; });
      return { date: t, p: round(quantile(p, 0.5), 1), pLo: round(quantile(p, 0.1), 1), pHi: round(quantile(p, 0.9), 1),
        pChance: wet.length ? Math.round(100 * wet.filter(function (v) { return v >= 1; }).length / wet.length) : null,
        wind: round(quantile(w, 0.5), 0), windHi: round(quantile(w, 0.9), 0), tmax: round(quantile(tx, 0.5), 0), tmin: round(quantile(tn, 0.5), 0) };
    }).filter(function (d) { return d.p !== null || d.wind !== null; }).slice(0, 28);
  }
  function weeks(days) {
    var out = [];
    for (var w = 0; w < 4; w++) {
      var part = days.slice(w * 7, w * 7 + 7);
      if (!part.length) break;
      var rain = part.reduce(function (s, d) { return s + (d.p || 0); }, 0);
      var wet = part.filter(function (d) { return d.pChance !== null && d.pChance >= 50; }).length;
      out.push({ from: part[0].date, to: part[part.length - 1].date, rain: round(rain, 0), wetDays: wet, wind: maxOf(part.map(function (d) { return d.wind; })), windHi: maxOf(part.map(function (d) { return d.windHi; })) });
    }
    return out;
  }
  /* high & low water from the hourly sea level (model) - the times are approximate (hourly steps, refined with a parabola) */
  function tideTurns(hourly) {
    var pts = hourly.filter(function (h) { return h.sea !== null; }), out = [];
    for (var i = 1; i < pts.length - 1; i++) {
      var a = pts[i - 1].sea, b = pts[i].sea, c = pts[i + 1].sea;
      var hi = b > a && b >= c, lo = b < a && b <= c;
      if (!hi && !lo) continue;
      var den = a - 2 * b + c, dx = den ? 0.5 * (a - c) / den : 0;
      dx = Math.max(-0.5, Math.min(0.5, dx));
      var e = { type: hi ? 'high' : 'low', t: pts[i].t + dx * 3600000, m: round(b - 0.25 * (a - c) * dx, 2) }, last = out[out.length - 1];
      /* flat tops / small wiggles: keep one turn of each kind in a row, the more extreme one */
      if (last && last.type === e.type) { if (hi ? e.m > last.m : e.m < last.m) out[out.length - 1] = e; continue; }
      out.push(e);
    }
    return out;
  }
  function readTideMirror(j) {
    if (!j || !j.events) return null;
    return { at: j.eventsAt ? Date.parse(j.eventsAt) : null, url: j.url, events: j.events.map(function (e) { return { type: e.type, t: Date.parse(e.time), m: e.m }; }) };
  }

  /* MET warnings (data.gov.my): only those still valid; "mine" when the text names a place of the profile */
  function readWarnings(list, keywords, now) {
    now = now || Date.now();
    var kws = String(keywords || '').split(/[,;]+/).map(function (k) { return k.trim().toLowerCase(); }).filter(Boolean);
    var seen = {};
    return (list || []).map(function (w) {
      var wi = w.warning_issue || {};
      var from = w.valid_from ? Date.parse(w.valid_from + '+08:00') : null, to = w.valid_to ? Date.parse(w.valid_to + '+08:00') : null;
      var text = String(w.text_en || ''), textBm = String(w.text_bm || ''), all = (text + ' ' + textBm + ' ' + (w.heading_en || '')).toLowerCase();
      return { id: (wi.title_en || '') + '|' + (w.valid_from || '') + '|' + (w.valid_to || ''), title: wi.title_en || '', titleBm: wi.title_bm || '', issued: wi.issued ? Date.parse(wi.issued + '+08:00') : null,
        from: from, to: to, heading: w.heading_en || '', headingBm: w.heading_bm || '', text: text, textBm: textBm,
        mine: kws.some(function (k) { return all.indexOf(k) >= 0; }),
        level: /third category|kategori ketiga|danger|bahaya|cyclone|siklon/i.test(all) ? 'danger' : 'warning' };
    }).filter(function (w) {
      if (!w.title || /no advisory|tiada/i.test(w.title) || !w.to || w.to < now) return false;
      /* the same warning issued again with another time window: one card, widest window */
      var key = w.title + '|' + w.text;
      if (seen[key]) {
        var o = seen[key];
        if (w.from !== null && (o.from === null || w.from < o.from)) o.from = w.from;
        if (w.to > o.to) o.to = w.to;
        if (w.issued > o.issued) o.issued = w.issued;
        return false;
      }
      w.id = w.title + '|' + w.text.length + '|' + w.text.slice(0, 40);
      seen[key] = w; return true;
    }).sort(function (a, b) { return (b.mine - a.mine) || (a.to - b.to); });
  }
  function readMetForecast(list) {
    var by = {};
    (list || []).forEach(function (f) { by[f.date] = { date: f.date, morning: f.morning_forecast, afternoon: f.afternoon_forecast, night: f.night_forecast, summary: f.summary_forecast, when: f.summary_when, min: num(f.min_temp), max: num(f.max_temp) }; });
    return Object.keys(by).sort().map(function (k) { return by[k]; });
  }

  /* JPS (mirror) */
  var STATUS_RANK = { na: -1, normal: 0, alert: 1, warning: 2, danger: 3 };
  function stationStatus(s) {
    if (!s || s.level === null || s.level === undefined) return 'na';
    if (s.danger !== null && s.danger !== undefined && s.level >= s.danger) return 'danger';
    if (s.warning !== null && s.warning !== undefined && s.level >= s.warning) return 'warning';
    if (s.alert !== null && s.alert !== undefined && s.level >= s.alert) return 'alert';
    return 'normal';
  }
  function sameDistrict(a, b) { return String(a || '').toLowerCase().replace(/[^a-z]/g, '') === String(b || '').toLowerCase().replace(/[^a-z]/g, ''); }
  function readJps(j, district) {
    if (!j) return null;
    var water = (j.water || []).filter(function (s) { return !district || sameDistrict(s.district, district); }).map(function (s) {
      var o = Object.assign({}, s); o.t = s.updated ? Date.parse(s.updated) : null; o.status = stationStatus(s); return o;
    });
    var r = j.rain || { days: [], stations: [] };
    var rain = (r.stations || []).filter(function (s) { return !district || sameDistrict(s.district, district); }).map(function (s) {
      var o = Object.assign({}, s); o.t = s.updated ? Date.parse(s.updated) : null; return o;
    });
    return { state: j.state, water: water, rain: rain, days: r.days || [], today: r.today, waterAt: j.waterAt ? Date.parse(j.waterAt) : null, rainAt: j.rainAt ? Date.parse(j.rainAt) : null,
      waterUrl: j.waterUrl, rainUrl: j.rainUrl, errors: j.errors || {} };
  }

  /* ------------------------------------------------------------ alerts */
  /* d = { fc, marine, warnings, jps } for one profile, s = settings -> [{id, level, kind, title, detail}] */
  function alerts(d, p, s, now) {
    now = now || Date.now(); s = cleanSettings(s);
    var out = [];
    (d.warnings || []).forEach(function (w) {
      if (!w.mine || (w.from && w.from > now + 6 * 3600000)) return;
      out.push({ id: 'met:' + w.id, level: w.level, kind: 'met', title: w.title, titleBm: w.titleBm, to: w.to });
    });
    if (d.jps) {
      var min = STATUS_RANK[s.jpsLevel];
      d.jps.water.forEach(function (st) {
        if (STATUS_RANK[st.status] >= min && st.t && now - st.t < 6 * 3600000)
          out.push({ id: 'jps:' + st.id + ':' + st.status, level: st.status === 'alert' ? 'watch' : st.status, kind: 'water', station: st.name, status: st.status, value: st.level });
      });
      d.jps.rain.forEach(function (st) {
        if (st.hour !== null && st.hour >= s.rain1hMm && st.t && now - st.t < 3 * 3600000)
          out.push({ id: 'rain:' + st.id + ':' + mytDate(now), level: 'warning', kind: 'rain', station: st.name, value: st.hour });
      });
    }
    if (d.fc) {
      var next = d.fc.hourly.filter(function (h) { return h.t >= now - 3600000 && h.t <= now + 6 * 3600000; });
      var g = maxOf(next.map(function (h) { return h.gust; })), w = maxOf(next.map(function (h) { return h.wind; }));
      if (g !== null && g >= s.gustKmh) out.push({ id: 'gust:' + mytDate(now), level: 'warning', kind: 'gust', value: Math.round(g) });
      else if (w !== null && w >= s.windKmh) out.push({ id: 'wind:' + mytDate(now), level: 'warning', kind: 'wind', value: Math.round(w) });
    }
    if (d.marine) {
      var nx = d.marine.hourly.filter(function (h) { return h.t >= now - 3600000 && h.t <= now + 12 * 3600000; });
      var wv = maxOf(nx.map(function (h) { return h.wave; }));
      if (wv !== null && wv >= s.waveM) out.push({ id: 'wave:' + mytDate(now), level: 'warning', kind: 'wave', value: round(wv, 1) });
    }
    var rank = { danger: 0, warning: 1, watch: 2 };
    return out.sort(function (a, b) { return rank[a.level] - rank[b.level]; });
  }

  /* ------------------------------------------------------------ weather codes, directions */
  var WMO = {
    0: ['Cerah', 'Clear', '☀️'], 1: ['Kebanyakannya cerah', 'Mostly clear', '🌤️'], 2: ['Berawan separa', 'Partly cloudy', '⛅'], 3: ['Mendung', 'Overcast', '☁️'],
    45: ['Berkabus', 'Fog', '🌫️'], 48: ['Kabus fros', 'Rime fog', '🌫️'],
    51: ['Gerimis ringan', 'Light drizzle', '🌦️'], 53: ['Gerimis', 'Drizzle', '🌦️'], 55: ['Gerimis lebat', 'Dense drizzle', '🌧️'],
    61: ['Hujan ringan', 'Light rain', '🌦️'], 63: ['Hujan', 'Rain', '🌧️'], 65: ['Hujan lebat', 'Heavy rain', '🌧️'],
    80: ['Hujan renyai', 'Showers', '🌦️'], 81: ['Hujan', 'Rain showers', '🌧️'], 82: ['Hujan sangat lebat', 'Violent showers', '⛈️'],
    95: ['Ribut petir', 'Thunderstorm', '⛈️'], 96: ['Ribut petir + hujan batu', 'Thunderstorm, hail', '⛈️'], 99: ['Ribut petir kuat', 'Severe thunderstorm', '⛈️']
  };
  function wmo(code, lang) { var w = WMO[code]; return w ? { text: lang === 'ms' ? w[0] : w[1], icon: w[2] } : { text: '-', icon: '🌡️' }; }
  function compass(deg, lang) {
    if (deg === null || deg === undefined) return '-';
    var i = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
    return (lang === 'ms' ? ['U', 'UTL', 'TL', 'TTL', 'T', 'TMg', 'Mg', 'SMg', 'S', 'SBD', 'BD', 'BBD', 'B', 'BBL', 'BL', 'UBL']
      : ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'])[i];
  }
  /* MET forecast phrases (data.gov.my gives them in Malay only) */
  var MET_EN = {
    'tiada hujan': 'No rain', 'hujan': 'Rain', 'hujan di beberapa tempat': 'Rain in a few places', 'hujan di kebanyakan tempat': 'Rain in most places',
    'hujan di satu dua tempat': 'Rain in one or two places', 'hujan menyeluruh': 'Widespread rain',
    'ribut petir': 'Thunderstorms', 'ribut petir di beberapa tempat': 'Thunderstorms in a few places', 'ribut petir di kebanyakan tempat': 'Thunderstorms in most places',
    'ribut petir di satu dua tempat': 'Thunderstorms in one or two places', 'ribut petir menyeluruh': 'Widespread thunderstorms',
    'berjerebu': 'Hazy', 'cerah': 'Fair', 'mendung': 'Cloudy', 'berangin': 'Windy',
    'pagi': 'Morning', 'petang': 'Afternoon', 'malam': 'Night', 'sepanjang hari': 'All day', 'tengah hari': 'Midday', 'tiada': 'None'
  };
  function metText(t, lang) {
    if (lang !== 'en' || !t) return t || '-';
    var k = String(t).trim().toLowerCase();
    if (MET_EN[k]) return MET_EN[k];
    return String(t).replace(/(ribut petir|hujan|di kebanyakan tempat|di beberapa tempat|di satu dua tempat|menyeluruh|pagi|petang|malam|dan)/gi, function (m) {
      var x = m.toLowerCase();
      return { 'ribut petir': 'thunderstorms', 'hujan': 'rain', 'di kebanyakan tempat': 'in most places', 'di beberapa tempat': 'in a few places',
        'di satu dua tempat': 'in one or two places', 'menyeluruh': 'widespread', 'pagi': 'morning', 'petang': 'afternoon', 'malam': 'night', 'dan': 'and' }[x] || m;
    }).replace(/^./, function (c) { return c.toUpperCase(); });
  }

  return {
    VERSION: VERSION, DEFAULT_PROFILES: DEFAULT_PROFILES, DEFAULT_SETTINGS: DEFAULT_SETTINGS, JPS_STATES: JPS_STATES,
    cleanProfile: cleanProfile, cleanSettings: cleanSettings, slug: slug,
    forecastUrl: forecastUrl, marineUrl: marineUrl, outlookUrl: outlookUrl, MET_WARN_URL: MET_WARN_URL, metForecastUrl: metForecastUrl,
    geocodeUrl: geocodeUrl, repoOf: repoOf, mirrorBase: mirrorBase,
    readForecast: readForecast, readMarine: readMarine, readOutlook: readOutlook, weeks: weeks, tideTurns: tideTurns, readTideMirror: readTideMirror,
    readWarnings: readWarnings, readMetForecast: readMetForecast, readJps: readJps, stationStatus: stationStatus, STATUS_RANK: STATUS_RANK,
    alerts: alerts, wmo: wmo, compass: compass, metText: metText, kt: kt, round: round, maxOf: maxOf, minOf: minOf, quantile: quantile,
    mytDate: mytDate, mytHM: mytHM, MYT: MYT
  };
}));
