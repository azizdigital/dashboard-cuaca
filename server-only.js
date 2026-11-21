'use strict';
/* Dashboard Cuaca Aziz - run the servers and the collector without Electron (Node 18+).
     node server-only.js            http://127.0.0.1:30040  (APIs only, no infobanjir tables - those need the desktop app)
     node server-only.js --share    also the phone ports 30041 / 30042
     node server-only.js --mock     no internet: made-up data from tests/fixtures (used by the automated tests)
   Env: MC_APP / MC_SETUP / MC_HTTPS ports, MC_USERDATA data folder. */
const path = require('path');
const os = require('os');
const { create: createServer } = require('./lib/server');
const storeLib = require('./lib/store');
const collectorLib = require('./lib/collector');
const apiLib = require('./lib/api');

const args = process.argv.slice(2);
const mock = args.includes('--mock');
const ports = { app: +process.env.MC_APP || 30040, setup: +process.env.MC_SETUP || 30041, https: +process.env.MC_HTTPS || 30042 };
const dataDir = process.env.MC_USERDATA || path.join(os.homedir(), '.dashboard-cuaca-server');
const version = require('./package.json').version;

async function fetchJson(url, ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms || 25000);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

let fx = null;
if (mock) fx = require('./tests/fixtures/make');
const store = storeLib.create(dataDir);
let api = null, srv = null;
require('./www/assets/js/i18n').setLang(store.settings().lang);
const collector = collectorLib.create({
  store,
  fetchJson: mock ? (url => fx.forUrl(url, Date.now())) : fetchJson,
  scrape: mock ? (url => fx.tablesFor(url, Date.now())) : null,
  probe: mock ? (url => fx.probe(url)) : null,
  onUpdate: () => api && api.broadcast('snapshot', Object.assign({}, collector.snapshot(), { settings: store.settings() })),
  onAlerts: list => { api && api.broadcast('alert', list); console.log('ALERT', list.map(a => a.title).join(' | ')); },
  log: (...a) => console.error(...a)
});
api = apiLib.create({
  store, collector,
  offshoreFetch: mock ? (url => { const W = require('./tests/web-fixtures/make'); return Promise.resolve(/raw\.githubusercontent/.test(url) ? W.mirror(Date.now()).jps : W.offshore(url, Date.now())); }) : (url => fetchJson(url, 30000)),
  info: role => ({ name: 'Dashboard Cuaca Aziz', lang: store.settings().lang, version, desktop: false, sharing: srv.isSharing(), ports: srv.ports, ips: srv.lanIPs(), ca: srv.caName() })
});
srv = createServer({ www: path.join(__dirname, 'www'), dataDir, ports, api: api.handle, onError: e => console.error('server', e && e.message) });

(async () => {
  await srv.start();
  if (args.includes('--share')) await srv.setShare(true);
  console.log('Dashboard Cuaca Aziz ' + version + ' : http://127.0.0.1:' + ports.app + '/' + (mock ? '  (MOCK DATA)' : ''));
  if (srv.isSharing()) srv.lanIPs().forEach(ip => console.log('  phone: http://' + ip + ':' + ports.setup + '/  then https://' + ip + ':' + ports.https + '/'));
  collector.start(mock ? 0 : 500);
})().catch(e => { console.error(e.message); process.exit(1); });
process.on('SIGINT', () => { collector.stop(); srv.stop().then(() => process.exit(0)); });
process.on('SIGTERM', () => { collector.stop(); srv.stop().then(() => process.exit(0)); });
