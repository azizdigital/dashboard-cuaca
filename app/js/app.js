/* Dashboard Cuaca Aziz 4 - the page. Everything is fetched by this device: Open-Meteo and data.gov.my live,
   JPS water level & rainfall and the Cukai tide table from the GitHub mirror (branch "data"). */
(function () {
  'use strict';
  var D = window.DC, SITES = window.SITES, Charts = window.Charts;
  var $ = function (id) { return document.getElementById(id); };

  /* ------------------------------------------------------------ storage */
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full or blocked */ } }
  var S = D.cleanSettings(load('dc4_settings', null));
  var PROFILES = (load('dc4_profiles', null) || D.DEFAULT_PROFILES).map(D.cleanProfile);
  var ACTIVE = load('dc4_active', PROFILES[0].id);
  if (!PROFILES.some(function (p) { return p.id === ACTIVE; })) ACTIVE = PROFILES[0].id;
  var params = new URLSearchParams(location.search);
  var MIRROR = params.get('mirror') || D.mirrorBase(location);
  var data = {}, errors = {}, loading = false, lastLoad = 0;

  function lang() { return S.lang; }
  function tr(ms, en) { return S.lang === 'ms' ? ms : en; }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function profile() { return PROFILES.filter(function (p) { return p.id === ACTIVE; })[0] || PROFILES[0]; }
  var DAYS = { ms: ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
  var MON = { ms: ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
  function dayLabel(dateStr, short) {
    var d = new Date(dateStr + 'T00:00:00Z'), today = D.mytDate(Date.now()), tom = D.mytDate(Date.now() + 86400000);
    if (dateStr === today) return tr('Hari ini', 'Today');
    if (dateStr === tom && !short) return tr('Esok', 'Tomorrow');
    return DAYS[S.lang][d.getUTCDay()] + ' ' + d.getUTCDate() + (short ? '' : ' ' + MON[S.lang][d.getUTCMonth()]);
  }
  function hm(ms) { return ms ? D.mytHM(ms) : '-'; }
  function when(ms) {
    if (!ms) return '-';
    var d = D.mytDate(ms);
    return (d === D.mytDate(Date.now()) ? '' : dayLabel(d, true) + ', ') + hm(ms);
  }
  function ago(ms) {
    if (!ms) return '-';
    var m = Math.round((Date.now() - ms) / 60000);
    if (m < 1) return tr('baru tadi', 'just now');
    if (m < 60) return m + tr(' min lalu', ' min ago');
    var h = Math.floor(m / 60);
    return h < 48 ? h + tr(' jam lalu', ' h ago') : Math.floor(h / 24) + tr(' hari lalu', ' days ago');
  }
  function v(x, d) { return x === null || x === undefined ? '-' : (d === undefined ? Math.round(x) : D.round(x, d)); }
  function arrow(deg) { return deg === null || deg === undefined ? '' : '<span class="arr" style="transform:rotate(' + Math.round(deg + 180) + 'deg)" aria-hidden="true">↑</span>'; }
  function windTxt(kmh) { return kmh === null || kmh === undefined ? '-' : Math.round(kmh) + ' <small>' + tr('km/j', 'km/h') + ' · ' + D.kt(kmh) + ' kt</small>'; }

  /* ------------------------------------------------------------ fetching */
  function getJSON(url, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 25000);
    return fetch(url, { signal: ctl ? ctl.signal : undefined, cache: 'no-store' }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }, function (e) { clearTimeout(timer); throw new Error(e && e.name === 'AbortError' ? tr('tamat masa', 'timed out') : tr('tiada sambungan', 'no connection')); });
  }
  function refresh(force) {
    if (loading) return Promise.resolve();
    var p = profile(), id = p.id, cache = load('dc4_cache_' + id, {}) || {};
    loading = true; document.body.classList.add('loading');
    var mins = Math.floor(Date.now() / 60000);
    var jobs = {
      fc: D.forecastUrl(p), marine: D.marineUrl(p), outlook: D.outlookUrl(p), warn: D.MET_WARN_URL,
      met: D.metForecastUrl(p),
      jps: p.jpsState ? MIRROR + 'jps-' + p.jpsState + '.json?m=' + mins : '',
      tide: p.tide === 'cukai' ? MIRROR + 'tide-cukai.json?m=' + mins : ''
    };
    var errs = {};
    return Promise.all(Object.keys(jobs).map(function (k) {
      if (!jobs[k]) { delete cache[k]; return null; }
      if (!force && k === 'outlook' && cache.outlook && Date.now() - cache.outlook.at < 3 * 3600000) return null;   /* changes 4x a day */
      return getJSON(jobs[k]).then(function (j) { cache[k] = { at: Date.now(), raw: j }; }, function (e) { errs[k] = e.message; });
    })).then(function () {
      if (ACTIVE !== id) return;
      save('dc4_cache_' + id, cache);
      errors = errs; lastLoad = Date.now();
      build(cache, p);
      render();
    }).catch(function (e) { console.error(e); }).then(function () { loading = false; document.body.classList.remove('loading'); });
  }
  /* raw answers -> what the page shows */
  function build(cache, p) {
    var out = { at: {} }, now = Date.now();
    function take(k, fn) {
      var c = cache[k]; if (!c) return null;
      out.at[k] = c.at;
      try { return fn(c.raw); } catch (e) { errors[k] = e.message; return null; }
    }
    out.fc = take('fc', D.readForecast);
    out.marine = take('marine', D.readMarine);
    out.outlook = take('outlook', D.readOutlook);
    out.warnings = take('warn', function (j) { return D.readWarnings(j, p.metKeywords, now); }) || [];
    out.met = take('met', D.readMetForecast);
    out.jps = take('jps', function (j) { return { mine: D.readJps(j, p.jpsDistrict), all: D.readJps(j, '') }; });
    out.tide = take('tide', D.readTideMirror);
    out.turns = out.marine ? D.tideTurns(out.marine.hourly) : [];
    out.alerts = D.alerts({ fc: out.fc, marine: out.marine, warnings: out.warnings, jps: out.jps && out.jps.mine }, p, S, now);
    data = out;
  }

  /* ------------------------------------------------------------ alerts + sound */
  var audio = null, seen = load('dc4_seen', {});
  document.addEventListener('pointerdown', function () {
    if (!audio && (window.AudioContext || window.webkitAudioContext)) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* */ } }
    if (audio && audio.state === 'suspended') audio.resume();
  }, { passive: true });
  function beep() {
    if (!S.sound || !audio) return;
    [0, 0.35, 0.7].forEach(function (d) {
      var o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + d;
      o.frequency.value = 880; o.type = 'sine'; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + 0.3);
    });
  }
  function alertText(a) {
    var st = { alert: tr('WASPADA', 'ALERT'), warning: tr('AMARAN', 'WARNING'), danger: tr('BAHAYA', 'DANGER') };
    if (a.kind === 'met') return '<b>MET:</b> ' + esc(S.lang === 'ms' ? a.titleBm || a.title : a.title) + ' <small>' + tr('hingga ', 'until ') + esc(when(a.to)) + '</small>';
    if (a.kind === 'water') return '<b>' + esc(a.station) + '</b> ' + st[a.status] + ' · ' + v(a.value, 2) + ' m';
    if (a.kind === 'rain') return '<b>' + esc(a.station) + '</b> ' + tr('hujan ', 'rain ') + v(a.value, 1) + tr(' mm sejam', ' mm in 1 h');
    if (a.kind === 'gust') return tr('Tiupan angin hingga ', 'Wind gusts up to ') + '<b>' + a.value + ' ' + tr('km/j', 'km/h') + '</b> ' + tr('dalam 6 jam', 'in the next 6 h');
    if (a.kind === 'wind') return tr('Angin hingga ', 'Wind up to ') + '<b>' + a.value + ' ' + tr('km/j', 'km/h') + '</b> ' + tr('dalam 6 jam', 'in the next 6 h');
    if (a.kind === 'wave') return tr('Ombak hingga ', 'Waves up to ') + '<b>' + a.value + ' m</b> ' + tr('dalam 12 jam', 'in the next 12 h');
    return '';
  }
  function renderAlerts() {
    var list = data.alerts || [], box = $('alerts');
    if (!list.length) { box.innerHTML = '<div class="ok-strip">✓ ' + tr('Tiada amaran untuk ', 'No alerts for ') + esc(profile().name) + '</div>'; return; }
    box.innerHTML = '<div class="alert-strip ' + list[0].level + '"><div class="alist">' + list.map(function (a) {
      return '<div class="arow ' + a.level + '"><span class="pill ' + a.level + '">' + { danger: tr('BAHAYA', 'DANGER'), warning: tr('AMARAN', 'WARNING'), watch: tr('WASPADA', 'ALERT') }[a.level] + '</span>' + alertText(a) + '</div>';
    }).join('') + '</div><button class="mute" id="muteBtn" title="' + tr('Bunyi', 'Sound') + '">' + (S.sound ? '🔔' : '🔕') + '</button></div>';
    $('muteBtn').onclick = function () { S.sound = !S.sound; save('dc4_settings', S); renderAlerts(); };
    var fresh = list.filter(function (a) { return !seen[a.id]; });
    if (fresh.length) {
      fresh.forEach(function (a) { seen[a.id] = Date.now(); });
      Object.keys(seen).forEach(function (k) { if (Date.now() - seen[k] > 3 * 86400000) delete seen[k]; });
      save('dc4_seen', seen);
      beep();
    }
  }

  /* ------------------------------------------------------------ cards */
  function card(id, title, sub, body, extra) {
    $(id).innerHTML = '<div class="card-h"><h2>' + title + '</h2>' + (sub ? '<small>' + sub + '</small>' : '') + (extra || '') + '</div><div class="card-b">' + body + '</div>';
  }
  function src(name, at, url) {
    return '<div class="src">' + tr('Sumber: ', 'Source: ') + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(name) + ' ↗</a>' : esc(name)) + (at ? ' · ' + ago(at) : '') + '</div>';
  }
  function failed(k) { return errors[k] ? '<div class="err">⚠ ' + esc(errors[k]) + (data.at[k] ? tr(' - data lama ditunjuk', ' - showing older data') : '') + '</div>' : ''; }

  function renderNow() {
    var p = profile(), fc = data.fc, c = fc && fc.current, m = data.marine;
    if (!c) { card('cNow', tr('Sekarang', 'Now'), esc(p.name), failed('fc') || '<div class="nodata">' + tr('Memuat…', 'Loading…') + '</div>'); return; }
    var w = D.wmo(c.code, lang()), h0 = m ? m.hourly.filter(function (x) { return x.t <= Date.now(); }).pop() : null;
    var today = fc.daily[0] || {};
    var html = '<div class="now"><div class="big"><span class="ico">' + w.icon + '</span><span class="temp">' + v(c.temp) + '°</span>' +
      '<div><div class="cond">' + esc(w.text) + '</div><div class="muted">' + tr('Terasa ', 'Feels ') + v(c.feels) + '° · ' + tr('Lembap ', 'Humidity ') + v(c.rh) + '%</div>' +
      '<div class="muted">' + tr('Hari ini ', 'Today ') + v(today.tmin) + '–' + v(today.tmax) + '° · ' + tr('hujan ', 'rain ') + v(today.p, 1) + ' mm (' + v(today.pp) + '%)</div></div></div>' +
      '<div class="tiles">' +
      '<div class="tile"><span>' + tr('Angin', 'Wind') + '</span><b>' + arrow(c.dir) + windTxt(c.wind) + '</b><small>' + D.compass(c.dir, lang()) + '</small></div>' +
      '<div class="tile"><span>' + tr('Tiupan', 'Gusts') + '</span><b>' + windTxt(c.gust) + '</b></div>' +
      (h0 ? '<div class="tile"><span>' + tr('Ombak', 'Waves') + '</span><b>' + v(h0.wave, 1) + ' m</b><small>' + arrow(h0.waveDir) + D.compass(h0.waveDir, lang()) + '</small></div>' +
        '<div class="tile"><span>Swell</span><b>' + v(h0.swell, 1) + ' m · ' + v(h0.swellPer, 0) + ' s</b><small>' + arrow(h0.swellDir) + D.compass(h0.swellDir, lang()) + '</small></div>' : '') +
      '</div></div>' +
      (today.sunrise ? '<div class="muted sun">🌅 ' + hm(today.sunrise) + ' · 🌇 ' + hm(today.sunset) + '</div>' : '') +
      failed('fc') + src('Open-Meteo', data.at.fc, 'https://open-meteo.com/');
    card('cNow', tr('Sekarang', 'Now'), esc(p.name) + ' · ' + hm(c.t), html);
  }

  function highlight(text, kws) {
    var t = esc(text);
    kws.forEach(function (k) { if (k) t = t.replace(new RegExp('(' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>'); });
    return t;
  }
  var openWarn = {};
  function renderWarnings() {
    var p = profile(), list = data.warnings || [];
    var kws = p.metKeywords.split(/[,;]+/).map(function (k) { return k.trim(); }).filter(Boolean);
    var mine = list.filter(function (w) { return w.mine; }), other = list.filter(function (w) { return !w.mine; });
    function one(w) {
      var text = S.lang === 'ms' && w.textBm ? w.textBm : w.text;
      var sentences = text.split(/[.;]\s+|\s(?=\d\)\s)/).filter(function (x) { return kws.some(function (k) { return x.toLowerCase().indexOf(k.toLowerCase()) >= 0; }); });
      return '<div class="warn ' + w.level + (w.mine ? ' mine' : '') + '"><div class="wh"><span class="pill ' + w.level + '">' + (w.level === 'danger' ? tr('BAHAYA', 'DANGER') : tr('AMARAN', 'WARNING')) + '</span><b>' +
        esc(S.lang === 'ms' ? w.titleBm || w.title : w.title) + '</b></div><div class="muted">' + tr('Sah ', 'Valid ') + esc(when(w.from)) + ' → ' + esc(when(w.to)) + '</div>' +
        (sentences.length ? '<ul class="hits">' + sentences.slice(0, 4).map(function (s) { return '<li>' + highlight(s, kws) + '</li>'; }).join('') + '</ul>' : '') +
        '<details data-w="' + esc(w.id) + '"' + (openWarn[w.id] ? ' open' : '') + '><summary>' + tr('Teks penuh MET', 'Full MET text') + '</summary><p>' + highlight(text, kws) + '</p></details></div>';
    }
    var html = (mine.length ? mine.map(one).join('') : '<div class="ok">✓ ' + tr('Tiada amaran MET untuk ', 'No MET warnings for ') + esc(kws.join(', ') || p.name) + '</div>') +
      (other.length ? '<details class="others"><summary>' + tr('Amaran MET lain di Malaysia (', 'Other MET warnings in Malaysia (') + other.length + ')</summary>' + other.map(one).join('') + '</details>' : '') +
      failed('warn') + src('MET Malaysia (data.gov.my)', data.at.warn, 'https://www.met.gov.my/en/warning/');
    card('cWarn', tr('Amaran MET', 'MET warnings'), esc(kws.join(', ')), html);
    [].forEach.call($('cWarn').querySelectorAll('details[data-w]'), function (d) { d.addEventListener('toggle', function () { openWarn[d.getAttribute('data-w')] = d.open; }); });
  }

  function renderTide() {
    var p = profile(), now = Date.now(), tm = data.tide;
    var evs = tm && tm.events ? tm.events : data.turns;
    var next = (evs || []).filter(function (e) { return e.t > now - 3 * 3600000; }).slice(0, 6);
    var html = next.length ? '<table class="tide"><tbody>' + next.map(function (e) {
      return '<tr class="' + (e.t < now ? 'past' : '') + '"><td>' + (e.type === 'high' ? '⬆ ' + tr('Pasang', 'High') : '⬇ ' + tr('Surut', 'Low')) + '</td><td>' + esc(when(e.t)) + '</td><td>' + v(e.m, 2) + ' m</td></tr>';
    }).join('') + '</tbody></table>' : '<div class="nodata">-</div>';
    html += '<div class="chartbox" id="tideChart"></div>';
    html += tm ? failed('tide') + src('Tide Forecast - Cukai (mirror GitHub)', tm.at, tm.url) + '<div class="note">' + tr('Graf: paras laut model Open-Meteo (anggaran).', 'Chart: Open-Meteo model sea level (approximate).') + '</div>'
      : src(tr('Open-Meteo - paras laut model (anggaran masa ±1 jam)', 'Open-Meteo - model sea level (times ±1 h)'), data.at.marine, 'https://open-meteo.com/en/docs/marine-weather-api');
    card('cTide', tr('Pasang surut', 'Tides'), esc(p.tide === 'cukai' ? 'Cukai' : p.name), html);
    if (data.marine) {
      var pts = data.marine.hourly.filter(function (h) { return h.t >= now - 6 * 3600000 && h.t <= now + 48 * 3600000 && h.sea !== null; });
      Charts.chart($('tideChart'), { height: 130, now: now, yLabel: 'm', series: [{ name: tr('Paras laut', 'Sea level'), color: '#3987e5', unit: 'm', digits: 2, points: pts.map(function (h) { return [h.t, h.sea]; }) }],
        yMin: Math.min.apply(null, pts.map(function (h) { return h.sea; }).concat([0])), ticks: dayTicks(pts), xFormat: tickLabel, tipTime: function (t) { return when(t); } });
    }
  }
  function dayTicks(pts) {
    var out = []; if (!pts.length) return out;
    var t = Date.parse(D.mytDate(pts[0].t) + 'T00:00:00+08:00');
    for (; t <= pts[pts.length - 1].t; t += 86400000) out.push(t);
    return out;
  }
  function tickLabel(t) { return dayLabel(D.mytDate(t + 3600000), true); }

  function renderForecast() {
    var p = profile(), days = S.days, fc = data.fc, now = Date.now();
    var tabs = '<div class="seg" role="tablist">' + [7, 14, 28].map(function (n) { return '<button role="tab" data-days="' + n + '" aria-selected="' + (n === days) + '">' + n + tr(' hari', ' days') + '</button>'; }).join('') + '</div>';
    var html = '';
    if (days === 28) {
      var o = data.outlook;
      if (!o) { card('cFc', tr('Ramalan', 'Forecast'), esc(p.name), failed('outlook') || '<div class="nodata">' + tr('Memuat…', 'Loading…') + '</div>', tabs); bindTabs(); return; }
      html = '<div class="note">' + tr('28 hari: purata 31 larian model GFS. Minggu 3–4 hanya trend (lebih / kurang hujan, angin) - bukan ramalan hari tepat.', '28 days: middle of 31 GFS model runs. Weeks 3–4 show the trend only (wetter / drier, windier) - not exact days.') + '</div>' +
        '<div class="chartbox" id="fcChart"></div><table class="weeks"><thead><tr><th>' + tr('Minggu', 'Week') + '</th><th>' + tr('Hujan (jumlah)', 'Rain (total)') + '</th><th>' + tr('Hari basah', 'Wet days') + '</th><th>' + tr('Angin maks', 'Max wind') + '</th></tr></thead><tbody>' +
        D.weeks(o).map(function (w, i) { return '<tr><td>' + (i + 1) + ' <small>' + esc(dayLabel(w.from, true)) + ' – ' + esc(dayLabel(w.to, true)) + '</small></td><td>' + v(w.rain) + ' mm</td><td>' + w.wetDays + '/7</td><td>' + v(w.wind) + '–' + v(w.windHi) + ' ' + tr('km/j', 'km/h') + '</td></tr>'; }).join('') +
        '</tbody></table><div class="scroll"><table class="days"><thead><tr><th>' + tr('Hari', 'Day') + '</th><th>' + tr('Hujan', 'Rain') + '</th><th>' + tr('Peluang', 'Chance') + '</th><th>' + tr('Angin', 'Wind') + '</th></tr></thead><tbody>' +
        o.map(function (d) { return '<tr><td>' + esc(dayLabel(d.date)) + '</td><td>' + v(d.p, 1) + ' <small>(' + v(d.pLo, 0) + '–' + v(d.pHi, 0) + ')</small> mm</td><td>' + v(d.pChance) + '%</td><td>' + v(d.wind) + ' <small>(' + tr('hingga ', 'to ') + v(d.windHi) + ')</small></td></tr>'; }).join('') +
        '</tbody></table></div>' + failed('outlook') + src('Open-Meteo Ensemble (GFS)', data.at.outlook, 'https://open-meteo.com/en/docs/ensemble-api');
      card('cFc', tr('Ramalan', 'Forecast'), esc(p.name), html, tabs);
      var ts = function (d) { return Date.parse(d + 'T12:00:00+08:00'); };
      Charts.chart($('fcChart'), { height: 200, yLabel: 'mm · ' + tr('km/j', 'km/h'), ticks: o.filter(function (d, i) { return i % 7 === 0; }).map(function (d) { return ts(d.date) - 12 * 3600000; }), xFormat: tickLabel,
        tipTime: function (t) { return dayLabel(D.mytDate(t)); }, series: [
          { name: tr('Hujan (julat 10–90%)', 'Rain (10–90% range)'), kind: 'band', color: '#3987e5', unit: 'mm', digits: 0, points: o.map(function (d) { return [ts(d.date), d.pLo, d.pHi]; }) },
          { name: tr('Hujan', 'Rain'), kind: 'bar', color: '#3987e5', unit: 'mm', digits: 1, points: o.map(function (d) { return [ts(d.date), d.p]; }) },
          { name: tr('Angin maks', 'Max wind'), color: '#d95926', unit: tr('km/j', 'km/h'), points: o.map(function (d) { return [ts(d.date), d.wind]; }) }] });
      bindTabs(); return;
    }
    if (!fc) { card('cFc', tr('Ramalan', 'Forecast'), esc(p.name), failed('fc') || '<div class="nodata">' + tr('Memuat…', 'Loading…') + '</div>', tabs); bindTabs(); return; }
    var dd = fc.daily.slice(0, days);
    html = '<div class="chartbox" id="fcChart"></div><div class="scroll"><table class="days"><thead><tr><th>' + tr('Hari', 'Day') + '</th><th></th><th>°C</th><th>' + tr('Hujan', 'Rain') + '</th><th>' + tr('Angin / tiupan', 'Wind / gusts') + ' <small>' + tr('km/j', 'km/h') + '</small></th><th>' + tr('Arah', 'Dir') + '</th></tr></thead><tbody>' +
      dd.map(function (d) {
        var w = D.wmo(d.code, lang()), hiG = d.gust !== null && d.gust >= S.gustKmh;
        return '<tr><td>' + esc(dayLabel(d.date)) + '</td><td title="' + esc(w.text) + '">' + w.icon + '</td><td>' + v(d.tmin) + '–' + v(d.tmax) + '</td><td>' + v(d.p, 1) + ' mm <small>' + v(d.pp) + '%</small></td>' +
          '<td>' + v(d.wind) + ' / <span class="' + (hiG ? 'hot' : '') + '">' + v(d.gust) + '</span> <small>' + D.kt(d.wind) + '/' + D.kt(d.gust) + ' kt</small></td><td>' + arrow(d.dir) + D.compass(d.dir, lang()) + '</td></tr>';
      }).join('') + '</tbody></table></div>' + failed('fc') + src('Open-Meteo (ECMWF, GFS, ICON…)', data.at.fc, 'https://open-meteo.com/');
    card('cFc', tr('Ramalan', 'Forecast'), esc(p.name), html, tabs);
    if (days === 7) {
      var hh = fc.hourly.filter(function (h) { return h.t >= now - 2 * 3600000 && h.t <= now + 72 * 3600000; });
      Charts.chart($('fcChart'), { height: 190, now: now, yLabel: tr('km/j · mm', 'km/h · mm'), ticks: dayTicks(hh), xFormat: tickLabel, tipTime: function (t) { return when(t); }, series: [
        { name: tr('Hujan / jam', 'Rain / h'), kind: 'bar', color: '#3987e5', unit: 'mm', digits: 1, points: hh.map(function (h) { return [h.t, h.p]; }) },
        { name: tr('Angin', 'Wind'), color: '#199e70', unit: tr('km/j', 'km/h'), points: hh.map(function (h) { return [h.t, h.wind]; }) },
        { name: tr('Tiupan', 'Gusts'), color: '#d95926', unit: tr('km/j', 'km/h'), points: hh.map(function (h) { return [h.t, h.gust]; }) }] });
    } else {
      var t12 = function (d) { return Date.parse(d + 'T12:00:00+08:00'); };
      Charts.chart($('fcChart'), { height: 190, yLabel: tr('km/j · mm', 'km/h · mm'), ticks: dd.filter(function (d, i) { return i % 2 === 0; }).map(function (d) { return t12(d.date) - 12 * 3600000; }), xFormat: tickLabel, tipTime: function (t) { return dayLabel(D.mytDate(t)); }, series: [
        { name: tr('Hujan', 'Rain'), kind: 'bar', color: '#3987e5', unit: 'mm', digits: 1, points: dd.map(function (d) { return [t12(d.date), d.p]; }) },
        { name: tr('Angin maks', 'Max wind'), color: '#199e70', unit: tr('km/j', 'km/h'), points: dd.map(function (d) { return [t12(d.date), d.wind]; }) },
        { name: tr('Tiupan maks', 'Max gusts'), color: '#d95926', unit: tr('km/j', 'km/h'), points: dd.map(function (d) { return [t12(d.date), d.gust]; }) }] });
    }
    bindTabs();
  }
  function bindTabs() {
    [].forEach.call($('cFc').querySelectorAll('[data-days]'), function (b) {
      b.onclick = function () { S.days = +b.getAttribute('data-days'); save('dc4_settings', S); renderForecast(); };
    });
  }

  function renderSea() {
    var p = profile(), m = data.marine, now = Date.now();
    if (!m) { card('cSea', tr('Laut: ombak & swell', 'Sea: waves & swell'), '', failed('marine') || '<div class="nodata">' + tr('Memuat…', 'Loading…') + '</div>'); return; }
    var html = '<div class="chartbox" id="seaChart"></div><div class="scroll"><table class="days"><thead><tr><th>' + tr('Hari', 'Day') + '</th><th>' + tr('Ombak maks', 'Max waves') + '</th><th>' + tr('Arah ombak', 'Wave dir') + '</th><th>Swell</th><th>' + tr('Tempoh swell', 'Swell period') + '</th><th>' + tr('Arah swell', 'Swell dir') + '</th></tr></thead><tbody>' +
      m.daily.map(function (d) {
        return '<tr><td>' + esc(dayLabel(d.date)) + '</td><td class="' + (d.wave !== null && d.wave >= S.waveM ? 'hot' : '') + '">' + v(d.wave, 1) + ' m</td><td>' + arrow(d.waveDir) + D.compass(d.waveDir, lang()) + '</td><td>' + v(d.swell, 1) + ' m</td><td>' + v(d.swellPer, 0) + ' s</td><td>' + arrow(d.swellDir) + D.compass(d.swellDir, lang()) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="note">' + tr('Titik laut: ', 'Sea point: ') + p.seaLat.toFixed(2) + ', ' + p.seaLon.toFixed(2) + tr('. Ombak & swell sehingga ~10 hari (had model). Garisan putus = had amaran ', '. Waves & swell up to ~10 days (model limit). Dashed line = alert limit ') + S.waveM + ' m.</div>' +
      failed('marine') + src('Open-Meteo Marine (ECMWF WAM, MFWAM)', data.at.marine, 'https://open-meteo.com/en/docs/marine-weather-api');
    card('cSea', tr('Laut: ombak & swell', 'Sea: waves & swell'), esc(p.name), html);
    var hh = m.hourly.filter(function (h) { return h.t >= now - 2 * 3600000 && h.t <= now + 96 * 3600000; });
    Charts.chart($('seaChart'), { height: 190, now: now, yLabel: 'm', ticks: dayTicks(hh), xFormat: tickLabel, tipTime: function (t) { return when(t); }, series: [
      { name: tr('Ombak', 'Waves'), color: '#199e70', unit: 'm', digits: 1, points: hh.map(function (h) { return [h.t, h.wave]; }) },
      { name: 'Swell', color: '#9085e9', unit: 'm', digits: 1, points: hh.map(function (h) { return [h.t, h.swell]; }) },
      { name: tr('Had amaran', 'Alert limit'), color: '#c98500', dash: '4 4', unit: 'm', digits: 1, points: hh.length ? [[hh[0].t, S.waveM], [hh[hh.length - 1].t, S.waveM]] : [] }] });
  }

  function renderMet() {
    var p = profile(), list = data.met;
    if (!p.metId) { $('cMet').hidden = true; return; }
    $('cMet').hidden = false;
    if (!list) { card('cMet', tr('Ramalan MET 7 hari', 'MET 7-day forecast'), '', failed('met') || '<div class="nodata">' + tr('Memuat…', 'Loading…') + '</div>'); return; }
    var html = '<div class="scroll"><table class="days met"><thead><tr><th>' + tr('Hari', 'Day') + '</th><th>' + tr('Pagi', 'Morning') + '</th><th>' + tr('Petang', 'Afternoon') + '</th><th>' + tr('Malam', 'Night') + '</th><th>°C</th></tr></thead><tbody>' +
      list.map(function (f) {
        function c(t) { return '<td class="' + (/ribut petir/i.test(t || '') ? 'thunder' : /hujan/i.test(t || '') ? 'rainy' : '') + '">' + esc(D.metText(t, lang())) + '</td>'; }
        return '<tr><td>' + esc(dayLabel(f.date)) + '</td>' + c(f.morning) + c(f.afternoon) + c(f.night) + '<td>' + v(f.min) + '–' + v(f.max) + '</td></tr>';
      }).join('') + '</tbody></table></div>' + failed('met') + src('MET Malaysia (data.gov.my)', data.at.met, 'https://www.met.gov.my/en/forecast/weather/district/' + p.metId + '/');
    card('cMet', tr('Ramalan MET 7 hari', 'MET 7-day forecast'), esc(p.name) + ' (' + esc(p.metId) + ')', html);
  }

  /* JPS tables: same columns as the original pages */
  var showAll = load('dc4_jps_all', false);
  function renderJps() {
    var p = profile(), J = data.jps;
    if (!p.jpsState) { $('cWater').hidden = true; $('cRain').hidden = true; return; }
    $('cWater').hidden = false; $('cRain').hidden = false;
    if (!J) { var wait = failed('jps') || '<div class="nodata">' + tr('Memuat…', 'Loading…') + '</div>'; card('cWater', tr('Paras air JPS', 'JPS water level'), '', wait); card('cRain', tr('Hujan JPS', 'JPS rainfall'), '', wait); return; }
    var j = showAll || !p.jpsDistrict ? J.all : J.mine;
    var toggle = p.jpsDistrict ? '<div class="seg small"><button data-all="0" aria-selected="' + !showAll + '">' + esc(p.jpsDistrict) + '</button><button data-all="1" aria-selected="' + showAll + '">' + tr('Semua negeri', 'Whole state') + '</button></div>' : '';
    var stName = { normal: tr('Normal', 'Normal'), alert: tr('Waspada', 'Alert'), warning: tr('Amaran', 'Warning'), danger: tr('Bahaya', 'Danger'), na: '-' };
    var stale = function (t, h) { return t && Date.now() - t > (h || 3) * 3600000; };
    var w = '<div class="scroll"><table class="jps"><thead><tr><th>No.</th><th>Station ID</th><th>Station Name</th><th>District</th><th>Main Basin</th><th>Sub River Basin</th><th>Last Updated</th><th>Water Level (m)</th><th class="th-n">Normal</th><th class="th-a">Alert</th><th class="th-w">Warning</th><th class="th-d">Danger</th></tr></thead><tbody>' +
      j.water.map(function (s) {
        return '<tr class="st-' + s.status + (stale(s.t, 6) ? ' stale' : '') + '"><td>' + s.no + '</td><td>' + esc(s.id) + '</td><td>' + esc(s.name) + '</td><td>' + esc(s.district) + '</td><td>' + esc(s.basin) + '</td><td>' + esc(s.subBasin) + '</td><td>' + esc(s.updated ? s.updated.slice(8, 10) + '/' + s.updated.slice(5, 7) + '/' + s.updated.slice(0, 4) + ' ' + s.updated.slice(11, 16) : '-') + '</td>' +
          '<td class="lvl" title="' + esc(stName[s.status]) + '">' + v(s.level, 2) + '</td><td>' + v(s.normal, 2) + '</td><td>' + v(s.alert, 2) + '</td><td>' + v(s.warning, 2) + '</td><td>' + v(s.danger, 2) + '</td></tr>';
      }).join('') + '</tbody></table></div><div class="keys"><span class="k st-normal">Normal</span><span class="k st-alert">' + stName.alert + '</span><span class="k st-warning">' + stName.warning + '</span><span class="k st-danger">' + stName.danger + '</span><span class="k stale">' + tr('Lebih 6 jam', 'Over 6 h old') + '</span></div>' +
      (J.mine.errors.water ? '<div class="err">⚠ ' + tr('Bacaan terakhir JPS gagal: ', 'Last JPS read failed: ') + esc(J.mine.errors.water) + '</div>' : '') + failed('jps') +
      src(tr('JPS Public Infobanjir (mirror GitHub ~15 min)', 'JPS Public Infobanjir (GitHub mirror ~15 min)'), J.mine.waterAt, J.mine.waterUrl);
    card('cWater', tr('Paras air JPS', 'JPS water level'), esc(showAll ? p.jpsState : p.jpsDistrict) + ' · ' + j.water.length + tr(' stesen', ' stations'), w, toggle);
    var dd = j.days.map(function (d) { return d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4); });
    var r = '<div class="scroll"><table class="jps rain"><thead><tr><th rowspan="2">No.</th><th rowspan="2">Station ID</th><th rowspan="2">Station</th><th rowspan="2">District</th><th rowspan="2">Last Updated</th><th colspan="' + (dd.length || 6) + '">Daily Rainfall (mm)</th><th rowspan="2">Rainfall from Midnight' + (j.today ? ' (' + esc(j.today.slice(8, 10) + '/' + j.today.slice(5, 7) + '/' + j.today.slice(0, 4)) + ')' : '') + '</th><th rowspan="2">Total 1 Hour (Now)</th></tr><tr>' +
      dd.map(function (d) { return '<th>' + esc(d) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      j.rain.map(function (s) {
        var heavy = s.hour !== null && s.hour >= S.rain1hMm;
        return '<tr class="' + (heavy ? 'st-warning' : '') + (stale(s.t, 3) ? ' stale' : '') + '"><td>' + s.no + '</td><td>' + esc(s.id) + '</td><td>' + esc(s.name) + '</td><td>' + esc(s.district) + '</td><td>' + esc(s.updated ? s.updated.slice(8, 10) + '/' + s.updated.slice(5, 7) + '/' + s.updated.slice(0, 4) + ' ' + s.updated.slice(11, 19) : '-') + '</td>' +
          s.daily.map(function (x) { return '<td>' + (x === null ? '-' : x.toFixed(1)) + '</td>'; }).join('') + '<td class="lvl">' + (s.today === null ? '-' : s.today.toFixed(1)) + '</td><td class="lvl">' + (s.hour === null ? '-' : s.hour.toFixed(1)) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (J.mine.errors.rain ? '<div class="err">⚠ ' + tr('Bacaan terakhir JPS gagal: ', 'Last JPS read failed: ') + esc(J.mine.errors.rain) + '</div>' : '') +
      src(tr('JPS Public Infobanjir (mirror GitHub ~15 min)', 'JPS Public Infobanjir (GitHub mirror ~15 min)'), J.mine.rainAt, J.mine.rainUrl);
    card('cRain', tr('Hujan JPS', 'JPS rainfall'), esc(showAll ? p.jpsState : p.jpsDistrict) + ' · ' + j.rain.length + tr(' stesen', ' stations'), r, toggle);
    [].forEach.call(document.querySelectorAll('#cWater [data-all], #cRain [data-all]'), function (b) {
      b.onclick = function () { showAll = b.getAttribute('data-all') === '1'; save('dc4_jps_all', showAll); renderJps(); };
    });
  }

  /* ------------------------------------------------------------ sites */
  function renderSites() {
    var p = profile();
    $('sites').innerHTML = '<h2 class="sec">' + tr('Laman', 'Sites') + ' <small>▣ ' + tr('dalam app', 'inside the app') + ' · ↗ ' + tr('tab baru (laman itu tidak benarkan dipaparkan dalam app lain)', 'new tab (the site does not allow being shown in another app)') + '</small></h2>' +
      SITES.CATS.map(function (c) {
        return '<div class="cat"><h3>' + esc(c[S.lang]) + '</h3><div class="tiles-grid">' + c.items.map(function (s) {
          return '<button class="site ' + (s.in ? 'in' : 'out') + '" data-site="' + s.id + '"><span class="si">' + s.icon + '</span><span class="st"><b>' + esc(s[S.lang]) + '</b><small>' + esc(s['d' + S.lang]) + '</small></span><span class="badge">' + (s.in ? '▣' : '↗') + '</span></button>';
        }).join('') + '</div></div>';
      }).join('');
    [].forEach.call($('sites').querySelectorAll('[data-site]'), function (b) {
      b.onclick = function () { openSite(b.getAttribute('data-site')); };
    });
    void p;
  }
  function openSite(id) {
    var s = SITES.all().filter(function (x) { return x.id === id; })[0], p = profile();
    if (!s) return;
    var url = s.url(p);
    if (!s.in) { window.open(url, '_blank', 'noopener'); return; }
    $('vTitle').textContent = s.icon + ' ' + s[S.lang];
    $('vOpen').href = /^https?:/.test(url) ? url : new URL(url, location.href).href;
    frame(url);
    $('viewer').hidden = false; document.body.classList.add('viewing');
    try { history.pushState({ v: id }, ''); } catch (e) { /* */ }
  }
  /* a new frame each time: changing the src of a frame adds history entries, and the phone's Back button would walk through them */
  function frame(url) {
    var old = $('vFrame'), f = document.createElement('iframe');
    f.id = 'vFrame'; f.title = old.title; f.setAttribute('allow', 'fullscreen; geolocation'); f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    f.src = url; old.parentNode.replaceChild(f, old);
  }
  function closeSite(fromHistory) {
    if ($('viewer').hidden) return;
    $('viewer').hidden = true; document.body.classList.remove('viewing'); frame('about:blank');
    if (!fromHistory) { try { history.back(); } catch (e) { /* */ } }
  }
  window.addEventListener('popstate', function () { closeSite(true); });

  /* ------------------------------------------------------------ top bar */
  function renderTop() {
    $('profiles').innerHTML = PROFILES.map(function (p) {
      return '<button class="chip' + (p.id === ACTIVE ? ' on' : '') + '" data-p="' + esc(p.id) + '">' + (p.kind === 'offshore' ? '🛢️ ' : '📍 ') + esc(p.name) + '</button>';
    }).join('') + '<button class="chip add" id="addLoc" title="' + tr('Tambah lokasi', 'Add location') + '">＋</button>';
    [].forEach.call($('profiles').querySelectorAll('[data-p]'), function (b) { b.onclick = function () { switchTo(b.getAttribute('data-p')); }; });
    $('addLoc').onclick = function () { openSettings('add'); };
    $('lang').textContent = S.lang === 'ms' ? 'EN' : 'BM';
    $('lang').title = S.lang === 'ms' ? 'English' : 'Bahasa Melayu';
    $('updated').textContent = lastLoad ? tr('Dikemas kini ', 'Updated ') + hm(lastLoad) : '';
    document.documentElement.lang = S.lang;
  }
  function switchTo(id) {
    if (id === ACTIVE) return;
    ACTIVE = id; save('dc4_active', id);
    var cache = load('dc4_cache_' + id, {}) || {};
    errors = {}; build(cache, profile()); render(); refresh();
  }
  function render() {
    renderTop(); renderAlerts(); renderNow(); renderWarnings(); renderTide(); renderForecast(); renderSea(); renderMet(); renderJps(); renderSites();
    var off = profile().kind === 'offshore';
    document.body.classList.toggle('offshore', off);
    $('foot').innerHTML = 'Dashboard Cuaca Aziz ' + D.VERSION + ' · ' + tr('Data: Open-Meteo, MET Malaysia (data.gov.my), JPS Public Infobanjir & Tide Forecast (mirror GitHub). Ramalan hanyalah panduan - ikut arahan rasmi MET, JPS & NADMA.', 'Data: Open-Meteo, MET Malaysia (data.gov.my), JPS Public Infobanjir & Tide Forecast (GitHub mirror). Forecasts are guidance only - follow official MET, JPS & NADMA instructions.');
  }

  /* ------------------------------------------------------------ settings */
  function openSettings(mode) {
    var dlg = $('settings');
    renderSettings(mode);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function closeSettings() { var dlg = $('settings'); if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
  function field(id, label, value, attrs) { return '<label class="fld"><span>' + label + '</span><input id="' + id + '" value="' + esc(value) + '" ' + (attrs || '') + '></label>'; }
  var editing = null;
  function renderSettings(mode) {
    var b = $('setBody');
    if (mode === 'add' || mode === 'edit') {
      var p = mode === 'edit' && editing ? editing : D.cleanProfile({ name: '', kind: 'land', lat: 4.2324, lon: 103.4229, jpsState: '', metKeywords: '' });
      b.innerHTML = '<h3>' + (mode === 'add' ? tr('Tambah lokasi', 'Add location') : tr('Ubah lokasi', 'Edit location')) + '</h3>' +
        (mode === 'add' ? '<div class="search"><input id="geoQ" placeholder="' + tr('Cari nama tempat… (cth. Kuantan, Dungun)', 'Search a place… (e.g. Kuantan, Dungun)') + '"><button class="btn" id="geoGo">' + tr('Cari', 'Search') + '</button></div><div id="geoRes"></div>' : '') +
        '<div class="form">' + field('pName', tr('Nama', 'Name'), p.name) +
        '<label class="fld"><span>' + tr('Jenis', 'Type') + '</span><select id="pKind"><option value="land"' + (p.kind === 'land' ? ' selected' : '') + '>' + tr('Darat / pantai', 'Land / coast') + '</option><option value="offshore"' + (p.kind === 'offshore' ? ' selected' : '') + '>' + tr('Luar pesisir (offshore)', 'Offshore') + '</option></select></label>' +
        field('pLat', 'Latitude', p.lat, 'inputmode="decimal"') + field('pLon', 'Longitude', p.lon, 'inputmode="decimal"') +
        field('pSeaLat', tr('Titik laut - latitude', 'Sea point - latitude'), p.seaLat, 'inputmode="decimal"') + field('pSeaLon', tr('Titik laut - longitude', 'Sea point - longitude'), p.seaLon, 'inputmode="decimal"') +
        '<label class="fld"><span>' + tr('Negeri JPS', 'JPS state') + '</span><select id="pJpsState"><option value="">' + tr('(tiada)', '(none)') + '</option>' + D.JPS_STATES.map(function (s) { return '<option' + (s === p.jpsState ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
        field('pJpsDistrict', tr('Daerah JPS (cth. Kemaman)', 'JPS district (e.g. Kemaman)'), p.jpsDistrict) +
        field('pMetId', tr('Kod daerah MET (cth. Ds065)', 'MET district code (e.g. Ds065)'), p.metId, 'placeholder="Ds065"') +
        field('pKw', tr('Kata kunci amaran MET (koma)', 'MET warning keywords (commas)'), p.metKeywords) +
        '<label class="fld"><span>' + tr('Pasang surut', 'Tides') + '</span><select id="pTide"><option value="cukai"' + (p.tide === 'cukai' ? ' selected' : '') + '>' + tr('Jadual Cukai (Tide Forecast, mirror)', 'Cukai table (Tide Forecast, mirror)') + '</option><option value="model"' + (p.tide === 'model' ? ' selected' : '') + '>' + tr('Model Open-Meteo di titik laut', 'Open-Meteo model at the sea point') + '</option></select></label>' +
        '<p class="note">' + tr('Data JPS di-mirror untuk negeri Terengganu. Negeri lain boleh ditambah - beritahu Claude.', 'JPS data is mirrored for Terengganu. Other states can be added - ask Claude.') + '</p>' +
        '</div><div class="btns"><button class="btn" id="pCancel">' + tr('Batal', 'Cancel') + '</button><button class="btn pri" id="pSave">' + tr('Simpan', 'Save') + '</button></div>';
      if ($('geoGo')) {
        var go = function () {
          var qv = $('geoQ').value.trim(); if (!qv) return;
          $('geoRes').innerHTML = '<div class="muted">…</div>';
          getJSON(D.geocodeUrl(qv, S.lang)).then(function (j) {
            var res = j.results || [];
            $('geoRes').innerHTML = res.length ? res.map(function (r, i) { return '<button class="geo" data-i="' + i + '">' + esc(r.name) + ' <small>' + esc([r.admin1, r.country].filter(Boolean).join(', ')) + ' · ' + r.latitude.toFixed(3) + ', ' + r.longitude.toFixed(3) + '</small></button>'; }).join('') : '<div class="muted">' + tr('Tiada hasil', 'No results') + '</div>';
            [].forEach.call($('geoRes').querySelectorAll('[data-i]'), function (bt) {
              bt.onclick = function () {
                var r = res[+bt.getAttribute('data-i')];
                $('pName').value = r.name; $('pLat').value = r.latitude.toFixed(4); $('pLon').value = r.longitude.toFixed(4);
                $('pSeaLat').value = r.latitude.toFixed(4); $('pSeaLon').value = r.longitude.toFixed(4);
                var st = { Terengganu: 'TRG', Pahang: 'PHG', Kelantan: 'KEL', Johor: 'JHR', Selangor: 'SEL', Perak: 'PRK', Kedah: 'KDH', Perlis: 'PLS', Penang: 'PNG', 'Pulau Pinang': 'PNG', Melaka: 'MLK', Malacca: 'MLK', 'Negeri Sembilan': 'NSN', Sabah: 'SAB', Sarawak: 'SRK' }[r.admin1] || '';
                $('pJpsState').value = st; $('pKw').value = [r.admin1, r.name].filter(Boolean).join(', ');
                $('pTide').value = Math.abs(r.latitude - 4.23) < 0.2 && Math.abs(r.longitude - 103.42) < 0.25 ? 'cukai' : 'model';
                $('geoRes').innerHTML = '<div class="ok">✓ ' + esc(r.name) + tr(' dipilih. Semak titik laut (perlu di laut untuk ombak).', ' picked. Check the sea point (must be at sea for waves).') + '</div>';
              };
            });
          }, function (e) { $('geoRes').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
        };
        $('geoGo').onclick = go; $('geoQ').onkeydown = function (e) { if (e.key === 'Enter') go(); };
      }
      $('pCancel').onclick = function () { renderSettings(); };
      $('pSave').onclick = function () {
        var np = D.cleanProfile({ id: mode === 'edit' ? p.id : '', name: $('pName').value, kind: $('pKind').value, lat: $('pLat').value, lon: $('pLon').value, seaLat: $('pSeaLat').value, seaLon: $('pSeaLon').value,
          jpsState: $('pJpsState').value, jpsDistrict: $('pJpsDistrict').value, metId: $('pMetId').value, metKeywords: $('pKw').value, tide: $('pTide').value });
        if (!$('pName').value.trim()) { $('pName').focus(); return; }
        if (mode === 'edit') PROFILES = PROFILES.map(function (x) { return x.id === p.id ? np : x; });
        else {
          var base = np.id, n = 2; while (PROFILES.some(function (x) { return x.id === np.id; })) np.id = base + '-' + (n++);
          PROFILES.push(np);
        }
        save('dc4_profiles', PROFILES);
        try { localStorage.removeItem('dc4_cache_' + np.id); } catch (e) { /* */ }
        closeSettings(); ACTIVE = '__'; switchTo(np.id);
      };
      return;
    }
    b.innerHTML = '<h3>' + tr('Tetapan', 'Settings') + '</h3>' +
      '<div class="form">' +
      '<label class="fld"><span>' + tr('Bahasa', 'Language') + '</span><select id="sLang"><option value="en"' + (S.lang === 'en' ? ' selected' : '') + '>English</option><option value="ms"' + (S.lang === 'ms' ? ' selected' : '') + '>Bahasa Melayu</option></select></label>' +
      '<label class="fld chk"><input type="checkbox" id="sSound"' + (S.sound ? ' checked' : '') + '><span>' + tr('Bunyi bila amaran baru', 'Sound for new alerts') + '</span></label>' +
      '<h4>' + tr('Had amaran', 'Alert limits') + '</h4>' +
      field('sGust', tr('Tiupan angin (km/j)', 'Wind gusts (km/h)'), S.gustKmh, 'type="number" inputmode="decimal"') +
      field('sWind', tr('Angin (km/j)', 'Wind (km/h)'), S.windKmh, 'type="number" inputmode="decimal"') +
      field('sWave', tr('Ombak (m)', 'Waves (m)'), S.waveM, 'type="number" step="0.1" inputmode="decimal"') +
      field('sRain', tr('Hujan JPS sejam (mm)', 'JPS rain in 1 h (mm)'), S.rain1hMm, 'type="number" inputmode="decimal"') +
      '<label class="fld"><span>' + tr('Paras air JPS - amaran bila', 'JPS water level - alert from') + '</span><select id="sJps"><option value="alert"' + (S.jpsLevel === 'alert' ? ' selected' : '') + '>' + tr('Waspada', 'Alert') + '</option><option value="warning"' + (S.jpsLevel === 'warning' ? ' selected' : '') + '>' + tr('Amaran', 'Warning') + '</option><option value="danger"' + (S.jpsLevel === 'danger' ? ' selected' : '') + '>' + tr('Bahaya', 'Danger') + '</option></select></label>' +
      '</div>' +
      '<h4>' + tr('Lokasi', 'Locations') + '</h4><div class="plist">' + PROFILES.map(function (p) {
        return '<div class="prow"><span>' + (p.kind === 'offshore' ? '🛢️ ' : '📍 ') + esc(p.name) + ' <small>' + p.lat.toFixed(3) + ', ' + p.lon.toFixed(3) + '</small></span><button class="btn sm" data-edit="' + esc(p.id) + '">' + tr('Ubah', 'Edit') + '</button>' +
          (PROFILES.length > 1 ? '<button class="btn sm danger" data-del="' + esc(p.id) + '">' + tr('Padam', 'Delete') + '</button>' : '') + '</div>';
      }).join('') + '<button class="btn" id="sAdd">＋ ' + tr('Tambah lokasi', 'Add location') + '</button></div>' +
      '<h4>' + tr('Peranti lain', 'Other devices') + '</h4><p class="note">' + tr('Setiap peranti simpan tetapan sendiri. Salin pautan ini dan buka di peranti lain (iPhone / iPad: buka app, kemudian Tampal pautan).', 'Each device keeps its own settings. Copy this link and open it on the other device (iPhone / iPad: open the app, then Paste link).') + '</p>' +
      '<div class="btns left"><button class="btn" id="sCopy">' + tr('Salin pautan tetapan', 'Copy settings link') + '</button><button class="btn" id="sPaste">' + tr('Tampal pautan', 'Paste link') + '</button></div><div id="sMsg" class="muted"></div>' +
      '<div class="btns"><button class="btn pri" id="sDone">' + tr('Simpan & tutup', 'Save & close') + '</button></div>' +
      '<p class="note">Dashboard Cuaca Aziz ' + D.VERSION + '</p>';
    [].forEach.call(b.querySelectorAll('[data-edit]'), function (bt) { bt.onclick = function () { editing = PROFILES.filter(function (x) { return x.id === bt.getAttribute('data-edit'); })[0]; renderSettings('edit'); }; });
    [].forEach.call(b.querySelectorAll('[data-del]'), function (bt) {
      bt.onclick = function () {
        var id = bt.getAttribute('data-del'), pp = PROFILES.filter(function (x) { return x.id === id; })[0];
        if (!confirm(tr('Padam lokasi ', 'Delete location ') + pp.name + '?')) return;
        PROFILES = PROFILES.filter(function (x) { return x.id !== id; }); save('dc4_profiles', PROFILES);
        try { localStorage.removeItem('dc4_cache_' + id); } catch (e) { /* */ }
        if (ACTIVE === id) { ACTIVE = '__'; switchTo(PROFILES[0].id); } else render();
        renderSettings();
      };
    });
    $('sAdd').onclick = function () { renderSettings('add'); };
    $('sCopy').onclick = function () {
      var link = location.origin + location.pathname + '#setup=' + b64e(JSON.stringify({ v: 4, s: readSettings(), p: PROFILES, a: ACTIVE }));
      var ok = function () { $('sMsg').textContent = tr('Pautan disalin. Hantar kepada diri sendiri (WhatsApp / emel).', 'Link copied. Send it to yourself (WhatsApp / email).'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(ok, function () { prompt(tr('Salin pautan ini:', 'Copy this link:'), link); });
      else prompt(tr('Salin pautan ini:', 'Copy this link:'), link);
    };
    $('sPaste').onclick = function () { var t = prompt(tr('Tampal pautan tetapan:', 'Paste the settings link:'), ''); if (t) takeSetup(t); };
    $('sDone').onclick = function () {
      var before = S.lang; S = D.cleanSettings(readSettings()); save('dc4_settings', S); closeSettings();
      build(load('dc4_cache_' + ACTIVE, {}) || {}, profile()); render(); void before;
    };
  }
  function readSettings() {
    if (!$('sGust')) return S;
    return { lang: $('sLang').value, sound: $('sSound').checked, gustKmh: $('sGust').value, windKmh: $('sWind').value, waveM: $('sWave').value, rain1hMm: $('sRain').value, jpsLevel: $('sJps').value, days: S.days };
  }
  function b64e(t) { return btoa(unescape(encodeURIComponent(t))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64d(t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; return decodeURIComponent(escape(atob(t))); }
  function takeSetup(text) {
    var m = /#setup=([A-Za-z0-9_-]+)/.exec(text || '');
    if (!m) { if (text) alert(tr('Itu bukan pautan tetapan Dashboard Cuaca.', 'That is not a Dashboard Cuaca settings link.')); return false; }
    var j; try { j = JSON.parse(b64d(m[1])); } catch (e) { alert(tr('Pautan rosak.', 'The link is broken.')); return false; }
    if (!j || j.v !== 4) return false;
    if (!confirm(tr('Guna tetapan & lokasi dari peranti lain? Tetapan di sini akan diganti.', 'Use the settings & locations from the other device? The ones here will be replaced.'))) return false;
    S = D.cleanSettings(j.s); save('dc4_settings', S);
    if (j.p && j.p.length) { PROFILES = j.p.slice(0, 30).map(D.cleanProfile); save('dc4_profiles', PROFILES); }
    ACTIVE = PROFILES.some(function (p) { return p.id === j.a; }) ? j.a : PROFILES[0].id; save('dc4_active', ACTIVE);
    closeSettings(); errors = {}; build(load('dc4_cache_' + ACTIVE, {}) || {}, profile()); render(); refresh(true);
    return true;
  }

  /* ------------------------------------------------------------ start */
  $('refresh').onclick = function () { refresh(true); };
  $('lang').onclick = function () { S.lang = S.lang === 'ms' ? 'en' : 'ms'; save('dc4_settings', S); build(load('dc4_cache_' + ACTIVE, {}) || {}, profile()); render(); };
  $('gear').onclick = function () { openSettings(); };
  $('setClose').onclick = closeSettings;
  $('vBack').onclick = function () { closeSite(false); };
  $('vReload').onclick = function () { frame($('vFrame').src); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSite(false); });
  if (/#setup=/.test(location.hash)) {
    var h = location.hash;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* */ }
    setTimeout(function () { takeSetup(h); }, 50);
  }
  build(load('dc4_cache_' + ACTIVE, {}) || {}, profile());
  render();
  refresh();
  setInterval(function () { if (document.visibilityState === 'visible') refresh(); }, 10 * 60000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && Date.now() - lastLoad > 5 * 60000) refresh(); });
  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { renderTide(); renderForecast(); renderSea(); }, 250); });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () { /* */ });
  window.DCAPP = { refresh: refresh, state: function () { return { data: data, errors: errors, S: S, PROFILES: PROFILES, ACTIVE: ACTIVE, MIRROR: MIRROR }; }, openSite: openSite, switchTo: switchTo };
}());
