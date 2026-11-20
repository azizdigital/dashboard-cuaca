# Dashboard Cuaca Aziz 4

**https://azizdigital.github.io/dashboard-cuaca/** - one web app (PWA) for PC, iPad, iPhone, Android phones & tablets.

Weather now, MET warnings, 7 / 14 / 28-day forecast, waves & swell, tides, JPS water level & rainfall (tables like the original pages), and the weather / sea / camera sites as tiles. Locations: Kemaman, Irong Barat (offshore), and any place you add.

## Where the data comes from

| Data | Source | How |
|---|---|---|
| Weather now, 16-day forecast, wind & gusts | Open-Meteo | live, read by the device |
| Waves, swell, model sea level (tide curve) | Open-Meteo Marine | live |
| 28-day outlook | Open-Meteo Ensemble (GFS, 31 runs) | live |
| MET warnings, MET 7-day district forecast | data.gov.my (MET Malaysia) | live |
| JPS water level & rainfall (Terengganu) | JPS Public Infobanjir | GitHub mirror, ~15 min (`mirror/`) |
| Tide times Cukai | Tide Forecast | GitHub mirror, ~15 min |

JPS and Tide Forecast do not let other web pages read them, so GitHub reads them (`.github/workflows/mirror.yml`) and writes small JSON files to the branch **data**; the app reads those.

infobanjir.terengganu.gov.my and met.gov.my only answer connections from Malaysia, so they are tiles that open in a new tab.

## Sites

▣ = shown inside the app (the site allows it - checked 20 Nov 2026). ↗ = opens in a new tab (the site refuses to be shown inside another app). List: `app/js/sites.js`.

## Folders

```
app/                  the web app (published to GitHub Pages by .github/workflows/pages.yml)
  js/data.js          sources, readers, alert rules (also runs in the tests)
  js/app.js           the page
  js/sites.js         site tiles
  js/charts.js        SVG charts
mirror/               GitHub mirror: parse.js (JPS, Tide Forecast), mirror.js
tests/                unit.js (node), app.spec.js (Playwright: PC, iPad, phone), fixtures/ (real samples)
tools/precache.js     offline file list + version
legacy/               the old 3.x app (Windows Electron + PC server), kept as it was
```

- `node tests/unit.js` - unit tests (no packages)
- `npm install && npx playwright test` - browser tests
- `node tests/serve.js 8080` - try the app locally
- `node mirror/mirror.js out` - run the mirror once (JPS_STATES=TRG,PHG for more states)
