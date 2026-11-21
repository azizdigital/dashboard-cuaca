'use strict';
/* Dashboard Cuaca Aziz - data collector (runs in the desktop app, or in server-only.js).
   Every <refreshMin> minutes: fetch the APIs + read the infobanjir tables, build one snapshot (core.assemble),
   check the alert rules, write history, and tell the app (onUpdate / onAlerts).
   Every 30 minutes: check that each of the 16 web sites answers, and whether it may be shown inside a frame. */
const core = require('../www/assets/js/core');
const RISK = require('../www/assets/js/risk');
const OFF = require('../www/assets/js/offshore');
const ADV = require('../www/assets/js/advisor');

const FETCH_TIMEOUT = 25000;
const SITE_EVERY = 30 * 60000;

function frameable(headers) {
  const xfo = String(headers['x-frame-options'] || '').toLowerCase();
  if (/deny|sameorigin/.test(xfo)) return false;
  const csp = String(headers['content-security-policy'] || '').toLowerCase();
  const m = csp.match(/frame-ancestors([^;]*)/);
  if (m && !/\*/.test(m[1])) return false;
  return true;
}

/* opt: { store, fetchJson(url, timeoutMs) -> json, scrape?(url) -> tables, probe?(url) -> { status, headers },
          onUpdate(snap), onAlerts(newOnes, snap), log? } */
function create(opt) {
  const store = opt.store;
  const log = opt.log || (() => {});
  function loadSnap() {
    const sn = store.readJson(store.snapName(), null) || { at: 0, sources: {}, sites: {}, alerts: { active: [], acked: {} } };
    if (!sn.alerts) sn.alerts = { active: [], acked: {} };
    return sn;
  }
  let snap = loadSnap();
  let running = null, timer = null, siteTimer = null, lastSiteCheck = 0, nextRun = 0, stopped = false;

  function timed(fn) {
    const t0 = Date.now();
    return Promise.resolve().then(fn).then(data => ({ ok: true, data, at: Date.now(), ms: Date.now() - t0 }),
      err => ({ ok: false, error: (err && err.message) || String(err), ms: Date.now() - t0 }));
  }

  /* early warnings (risk.js): rivers rising fast from this PC's own readings (every few minutes, day and night),
     wind / waves rising offshore from the model comparison (read again every 30 minutes) */
  let offCache = null, rainCache = null;
  async function addEarly(next, s, hist, now) {
    try {
      if (s.kind === 'offshore') {
        const key = (+s.marineLat).toFixed(3) + ',' + (+s.marineLon).toFixed(3);
        if (!offCache || offCache.key !== key || now - offCache.at > 30 * 60000) {
          const raw = await OFF.collect(s.marineLat, s.marineLon, url => opt.fetchJson(url, FETCH_TIMEOUT));
          offCache = { key, at: now, raw };
        }
        const rep = OFF.build(offCache.raw, { now, windKt: s.offWindKt, waveM: s.offWaveM });
        next.early = RISK.earlyOffshore(rep, now, { windRise: s.ewWindRise, swellTp: s.ewSwellTp, windKt: s.offWindKt, waveM: s.offWaveM, ahead: 24 });
        return;
      }
      /* rivers: this PC's own readings (26 hours); rain of the 5 models at the place (kept 30 minutes) */
      const tr = {}, rivers = RISK.parseRivers(s.ewUpstream);
      const sts = (next.stations || []).filter(st => !st.stale && st.level !== null);
      sts.forEach(st => { const t = RISK.trend(RISK.histPoints(hist, st, now), st, now, { stepMin: s.refreshMin, tidal: RISK.isTidal(rivers, st) }); if (t) { t.src = 'pc'; tr[st.name] = t; } });
      const key = s.lat + ',' + s.lon;
      if (!rainCache || rainCache.key !== key || now - rainCache.at > 30 * 60000) {
        try { rainCache = { key, at: now, raw: await ADV.collectLand([{ lat: s.lat, lon: s.lon }], url => opt.fetchJson(url, FETCH_TIMEOUT)) }; } catch (e) { rainCache = { key, at: now, raw: { models: {} } }; }
      }
      const rn = RISK.rainAhead(rainCache.raw, now);
      const gl = Math.max(ADV.riverRatio(next, core.dateKey(now)) || 0, ADV.riverRatio(next, core.dateKey(now + 86400000)) || 0) || null;
      const prevLoud = {};
      ((snap && snap.early) || []).forEach(e => { if (e.base && !e.quiet) prevLoud[e.base] = true; });
      const rains = (next.jps && next.jps.rain && next.jps.rain.stations) || next.rainStations || [];
      next.trends = tr;
      next.early = RISK.earlyFlood(sts, tr, now, { rivers, rain4: rn.rain4, rain24: rn.rain24, glofas: gl, minConf: s.ewConf, prevLoud, obs: st => RISK.obsRain(rains, st) });
    } catch (e) { log('early', e.message); }
  }

  function run(reason) {
    if (running) return running;
    running = (async () => {
      const s = store.settings();
      const pid = store.activeId(), pname = store.active().name;
      const u = core.urls(s);
      const now = Date.now();
      const jobs = {};
      Object.keys(u).forEach(k => { jobs[k] = () => opt.fetchJson(u[k], FETCH_TIMEOUT); });
      /* Cukai tide table from the GitHub mirror (the PC reads the river tables itself) */
      const mu = core.mirrorUrls(s, core.mirrorBase({}));
      if (mu.tideMirror) jobs.tideMirror = () => opt.fetchJson(mu.tideMirror, FETCH_TIMEOUT);
      const keys = Object.keys(jobs);
      const results = await Promise.all(keys.map(k => timed(jobs[k])));
      const raw = {};
      keys.forEach((k, i) => { raw[k] = results[i]; });
      if (opt.scrape && s.scrapeInfobanjir) {
        for (const sc of core.SCRAPE) {   /* one hidden window at a time */
          const r = await timed(() => opt.scrape(sc.url));
          raw[sc.key] = r.ok ? { ok: true, tables: r.data, at: r.at, ms: r.ms } : r;
        }
      }
      if (store.activeId() !== pid) return snap;   /* profile changed while fetching: drop this result */
      const prevActive = snap.alerts.active || [];
      const acked = snap.alerts.acked || {};
      const next = core.assemble(raw, s, snap, Date.now());
      const hist = store.history(3, Date.now(), pid);
      await addEarly(next, s, hist, Date.now());
      const current = core.evaluateAlerts(next, s, hist, Date.now());
      const fetched = keys.map(k => raw[k]);
      if (fetched.length && fetched.every(r => !r.ok)) {
        current.push({ key: 'net', cat: 'system', level: 'info', title: core.L('Tiada sambungan ke sumber data'), body: core.L('Semua sumber gagal. Data yang dipaparkan ialah data terakhir yang berjaya diambil.') });
      }
      const since = {};
      prevActive.forEach(a => { since[a.key] = a.since; });
      current.forEach(a => { a.since = since[a.key] || now; });
      const fresh = core.newAlerts(prevActive, current);
      const keep = {};
      current.forEach(a => { if (acked[a.key] && !fresh.some(f => f.key === a.key)) keep[a.key] = acked[a.key]; });
      next.alerts = { active: current, acked: keep };
      next.reason = reason || 'auto';
      next.profile = { id: pid, name: pname, kind: s.kind };
      snap = next;

      /* history line: water levels and rainfall by station, plus local weather */
      const levels = {}, rain = {};
      (snap.stations || []).forEach(st => { if (!st.stale && st.level !== null) levels[st.id] = st.level; });
      (snap.rainStations || []).forEach(st => { if (!st.stale && st.rainToday !== null) rain[st.id] = st.rainToday; });
      const w = snap.weather && snap.weather.current;
      try {
        store.appendHistory({ t: now, levels, rain, p: w ? w.precip : null, temp: w ? w.temp : null, gust: w ? w.gust : null, wind: w ? w.wind : null,
          wave: snap.marine && snap.marine.current ? snap.marine.current.wave : null, swell: snap.marine && snap.marine.current ? snap.marine.current.swell : null }, pid);
        store.pruneHistory(now);
        fresh.forEach(a => store.appendAlertLog(Object.assign({ t: now, profile: pname }, a)));
        store.writeJson(store.snapName(pid), snap);
      } catch (e) { log('store', e.message); }
      try { opt.onUpdate && opt.onUpdate(snap); } catch (e) { log('onUpdate', e.message); }
      if (fresh.length) { try { opt.onAlerts && opt.onAlerts(fresh, snap); } catch (e) { log('onAlerts', e.message); } }
      return snap;
    })().finally(() => { running = null; schedule(); });
    return running;
  }

  function schedule() {
    clearTimeout(timer);
    if (stopped) return;
    const ms = store.settings().refreshMin * 60000;
    nextRun = Date.now() + ms;
    snap.nextRun = nextRun;
    timer = setTimeout(() => run('auto'), ms);
  }

  async function checkSites() {
    if (!opt.probe || !store.settings().siteCheck) return;
    lastSiteCheck = Date.now();
    const sites = {};
    await Promise.all(core.SITES.map(async site => {
      const t0 = Date.now();
      try {
        const r = await opt.probe(site.url);
        sites[site.id] = { ok: r.status < 400, status: r.status, ms: Date.now() - t0, frameable: frameable(r.headers || {}), at: Date.now() };
      } catch (e) {
        sites[site.id] = { ok: false, error: (e && e.message) || core.L('Gagal'), ms: Date.now() - t0, at: Date.now() };
      }
    }));
    snap.sites = sites;
    try { store.writeJson(store.snapName(), snap); } catch (e) { /* */ }
    try { opt.onUpdate && opt.onUpdate(snap); } catch (e) { /* */ }
  }

  function start(delayMs) {
    stopped = false;
    setTimeout(() => run('start'), delayMs || 0);
    setTimeout(checkSites, (delayMs || 0) + 20000);
    siteTimer = setInterval(() => { if (Date.now() - lastSiteCheck >= SITE_EVERY - 1000) checkSites(); }, 60000);
  }
  function stop() { stopped = true; clearTimeout(timer); clearInterval(siteTimer); }

  /* the active profile changed (store.setActive was called): show its last data at once, then collect for it */
  async function switchProfile() {
    if (running) { try { await running; } catch (e) { /* */ } }
    const sites = snap.sites;
    snap = loadSnap();
    if (!snap.sites || !Object.keys(snap.sites).length) snap.sites = sites;   /* site health is the same for every profile */
    try { opt.onUpdate && opt.onUpdate(snap); } catch (e) { /* */ }
    return run('profile');
  }

  function ack(key) {
    const acked = snap.alerts.acked || (snap.alerts.acked = {});
    (snap.alerts.active || []).forEach(a => { if (key === 'all' || a.key === key) acked[a.key] = Date.now(); });
    try { store.writeJson(store.snapName(), snap); } catch (e) { /* */ }
    try { opt.onUpdate && opt.onUpdate(snap); } catch (e) { /* */ }
    return snap.alerts;
  }

  return {
    run, start, stop, schedule, checkSites, ack, switchProfile,
    snapshot: () => Object.assign({}, snap, { nextRun, running: !!running }),
    isRunning: () => !!running
  };
}

module.exports = { create, frameable };
