# Dashboard Cuaca Aziz 4.1

Weather, flood, sea and offshore conditions by **location profile** (Kemaman, Irong Barat, and others).

## Web app (main way to use it)

**https://azizdigital.github.io/dashboard-cuaca/**

Open it in Chrome / Edge on the PC (menu ⋮ › *Install Dashboard Cuaca Aziz*) and in Safari on the iPad (Share › *Add to Home Screen*).
No PC server, no QR, no zip: every push to `main` publishes the folder `www/` again (`.github/workflows/pages.yml`), and the app updates itself.

- Data comes straight from Open-Meteo (now, 16-day forecast, waves & swell, sea level, 28-day GFS ensemble outlook) and data.gov.my (MET warnings & forecast).
- **JPS water level & rainfall** (Terengganu) and the **Cukai tide table** do not let other web pages read them, so GitHub reads them every ~15 minutes (`mirror/`, `.github/workflows/mirror.yml`) and writes JSON to the branch `data`; the app reads that. No relay, no setup.
- **Water Level / Rainfall Kemaman** tabs (web & iPad): `www/kemaman.html` - the JPS 5-minute readings of Kemaman, 30 days (`mirror/kemaman.js`, folder `kemaman/` of `data`), map / river schema (`assets/js/kemaman-geo.js`, rivers © OpenStreetMap), Leaflet (`assets/vendor/leaflet`, BSD-2).
- Sites that refuse to be shown inside another app get a stand-in from the same source (Windy embed, RainViewer, the dashboard's own JPS / MET / tide cards) or open in a new tab.
- Each device keeps its own settings. Settings › *Other devices* › **Copy settings link** moves them to another device (iPad / iPhone: *Paste link from another device*).

Full guide: **PANDUAN.md** (Bahasa Melayu) · **GUIDE.md** (English) · changes: **PERUBAHAN_4.5.4.txt**

## Windows desktop app (optional, kept in this repo)

The Electron app still works (`npm install` → `npm start`). It reads infobanjir Terengganu itself and has its own ad blocker.

- `npm install` → `npm start` (run) → `npm run dist` (both in `dist/`: portable `Dashboard Cuaca Aziz <version>.exe` and installer `Dashboard Cuaca Aziz Setup <version>.exe`)
- `npm run dist:portable` → portable only · `npm run dist:setup` → installer only
- `npm run server` → server only, without Electron (http://127.0.0.1:30040)
- `node server-only.js --mock` → made-up data, no internet needed (for demos / tests)
- `npm run fix-icon` → Windows: clear the icon cache if the taskbar shows the Electron icon (restarts Explorer)
- `npm run adblock:build` → rebuild the ad lists shipped inside the app (lib/adblock-engine.bin)
- `npm test` → all tests. First time only: `npx playwright install chromium`

Older changes: PERUBAHAN_3.5.1.txt … PERUBAHAN_3.0.0.txt, CHANGES_3.3.0.txt, CHANGES_3.2.1.txt, CHANGES_3.2.0.txt

## Structure

```
main.js            Electron shell: splash, window, tray, notifications, webviews, infobanjir table reader, 3.0 data migration
preload.js         Desktop functions the page can reach (window.mcDesktop)
server-only.js     Server + data collector without Electron (--mock for made-up data)
lib/server.js      Local server: app 30040, phone 30041 (certificate) / 30042 (HTTPS)
lib/api.js         /api/* (snapshot, SSE events, history, settings, profiles, alerts)
lib/collector.js   Fetches the active profile's data every N minutes, alerts, history, checks every site
lib/store.js       Shared settings + profiles, snapshot & history per profile, alert log
lib/adblock.js     Ad blocker for the sites in the app (Ghostery engine, EasyList + uBlock lists, daily update)
lib/adblock-*.js   List addresses + worker that builds a new engine; adblock-engine.bin = lists shipped with the app
lib/certs.js       Own CA "Dashboard Cuaca Local CA" for phone HTTPS
www/splash.html          5-second splash (OIM Wazira style)
www/embed/vessels.html   VesselFinder's official embeddable map (iPad / phone stand-in)
www/relay-worker.js      Cloudflare Worker relay: sites that refuse framing, JPS tables for the web app, ad removal (Settings › Site relay)
www/assets/js/i18n.js    English / Bahasa Melayu: dictionary, MET forecast phrases, page translator
www/assets/js/core.js    26 sites, profiles, default settings, parsers for every source, alert rules, date detector (shared by PC + phone)
www/assets/js/app.js     The page: land/offshore dashboard, sites, wall, history, alerts, settings, profiles, Ctrl+K
www/assets/js/charts.js  SVG charts (no library)
www/kemaman.html         Water Level / Rainfall Kemaman page (assets/js/kemaman.js, kemaman-geo.js, css/kemaman.css)
mirror/kemaman.js        GitHub mirror: JPS 5-minute readings of the Kemaman gauges, 30 days
tools/build-precache.js  Offline file list + version from a content hash
tests/                   unit.js (Node), app.spec.js, relay.spec.js, web.spec.js (Playwright), fixtures/make.js (made-up data)
.github/workflows/pages.yml  Publishes www/ to GitHub Pages on every push to main
```

### How the two languages work

Bahasa Melayu is the source text in the code. `i18n.js` holds the English dictionary (about 550 entries). In English mode it:

- translates texts made in code through `L('...')` (alerts, notifications, menus, tray, status),
- translates the fixed text of the page (labels, buttons, tooltips) as it appears,
- translates MET Malaysia forecast phrases (e.g. *Ribut petir di beberapa tempat* → *Thunderstorms in scattered places*), and uses the English text MET publishes for its warnings.

The chosen language is saved on the PC (`config.json`), so the desktop app, the tray, Windows notifications and connected phones all follow it. Place and station names (Sg. Chukai, Kg. Tebak, Info Banjir…) are not translated.

## Bahasa Melayu

Aplikasi ini dalam **English secara lalai**. Tekan butang **BM** di bar atas (atau Tetapan › Bahasa) untuk tukar semua ke Bahasa Melayu. Panduan penuh dalam BM: **PANDUAN.md**.

Data: MET Malaysia through data.gov.my · Open-Meteo (CC BY 4.0) · infobanjir Terengganu (JPS).

© 2026 Aziz Mohamad · Monitoring & Analysis Division
