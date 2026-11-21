# Dashboard Cuaca Aziz 3.6 - Guide

*Panduan dalam Bahasa Melayu: PANDUAN.md*

## 0. Web app (main way from 3.6)

**https://azizdigital.github.io/dashboard-cuaca/** - install from Chrome / Edge on the PC (⋮ › Install) and from Safari on the iPad (Share › Add to Home Screen). No PC server, no QR. Every push to `main` republishes it.

Set up the free relay once (Settings › Site relay, section 9a): in the web app it reads the **JPS Public Infobanjir** water level & rainfall for the dashboard, shows the blue-dot sites inside the app, and **removes ads** from the tide and traffic sites. Relays from 3.4/3.5: copy the script again, paste it in Cloudflare and Deploy (relay v2).

Each device keeps its own settings: Settings › Other devices › **Copy settings link** (iPad home-screen app: **Paste link from another device**). Profiles can be added, edited and deleted in the web app.

## 1. Install & run (Windows PC)

1. Install **Node.js 20 or newer** (once).
2. In the project folder: `npm install`
3. Run: `npm start`
4. Build the `.exe` files: `npm run dist` → in `dist\`: `Dashboard Cuaca Aziz 4.4.2.exe` (portable) and `Dashboard Cuaca Aziz Setup 4.4.2.exe` (installer)

The app uses ports **30040–30042**, different from OIM Wazira (30030–30032), so both can be open at the same time.

On start, a 5-second splash is shown first (as in OIM Wazira), then the main window.

**Coming from 3.0 (Monitor Cuaca Kemaman):** settings, history and the alert log are copied automatically to the new folder `%APPDATA%\Dashboard Cuaca Aziz` the first time.

## 2. Language (English / Bahasa Melayu)

The app starts in **English**.

- **Switch:** the **BM** button at the top (it shows **EN** while Bahasa Melayu is on). Also **Settings › Bahasa / Language**, or Ctrl+K → "Bahasa Melayu".
- The page reloads once in the new language.
- **Everything follows the language:** menus, dashboard, alerts, Windows notifications, the tray icon menu, the splash, and the phone pages.
- **MET Malaysia:** warnings use the English text MET publishes. The 7-day forecast phrases are translated (e.g. *Hujan di kebanyakan tempat* → *Rain in most places*).
- Place, river and station names are not translated.
- The choice is saved on the PC. Phones connected to the PC use the same language. A phone without the PC keeps the last language it used.

## 3. Location profiles

The **📍** button at the top shows the active profile. Click it to switch.

| Built-in profile | Type | Coordinates |
|---|---|---|
| Kemaman | land | 4.2324, 103.4229 (Chukai) |
| Irong Barat (offshore) | offshore | 5.5501, 104.7745 |

- **Only the active profile is monitored.** Other profiles do not raise alerts until you switch to them.
- Each profile has its **own location, data sources and alert thresholds**. Shared settings (update interval, sound, notifications, tray, language) apply to all profiles.
- **Add a profile:** Settings › Location profiles → name, type (Land / Offshore), latitude, longitude → **Add profile**. The new profile becomes active.
- **Change the active profile:** the "Location" and "Alert thresholds" cards in Settings → **Save**.
- **Delete:** the Delete button in the profile list. Its history stays in the data folder.
- History is kept separately for each profile.

### Offshore profiles

The dashboard changes. River cards and the district MET forecast are hidden, and replaced with:

- **Summary tiles:** wind (knots), max gust 6 h, waves, swell, minimum visibility, thunderstorm risk (Low / Moderate / High), MET warnings.
- **Offshore conditions:** wave height and wind gust charts (48 h) with threshold lines, and a 24-hour table. Each row = the **worst value** in those 3 hours, so short peaks are not missed.
- **Alerts:** wind gusts, waves, low visibility, thunderstorm expected (6 h), and MET sea warnings (default keywords: Terengganu, Condore, Reef North).

Thunderstorm risk: **High** = the model forecasts thunderstorms. **Moderate** = unstable air (CAPE ≥ 1000) and rain chance ≥ 50%.

All offshore data is an **Open-Meteo model forecast**, not readings from a station on the platform. For operational decisions, check official sources.

## 4. What is in the app

| Part | Contents |
|---|---|
| **Dashboard** | Alert banner, summary tiles, river water levels (land), offshore conditions (offshore), hourly rain, station rainfall, MET 7-day forecast, MET warnings, sea, source status, links to every site |
| **Websites** | 26 sites inside the app. Up to 6 tabs stay open. Back / forward / reload / zoom / open in browser. Auto reload every 1–30 min. **Close all** button |
| **Wall mode** | 2, 3, 4 or 6 sites at once. Panes with old dates are marked ⚠ |
| **History & charts** | Land: water level for each station + thresholds. Offshore: waves, swell, gusts, wind. Rain 7 days. CSV. 45 days |
| **Alerts** | Active alerts, Acknowledge, sound test, mute 1 hour, log |
| **Settings** | Location profiles, location & thresholds of the active profile, update interval, notifications, tray, start with Windows, language, diagnostics |

**Keyboard shortcuts**

| Keys | Action |
|---|---|
| Ctrl+K | Search sites / commands, including switching profile and language |
| Ctrl+H | Dashboard |
| Ctrl+L | Wall mode |
| Ctrl+R / F5 | Reload site |
| F9 | Update data |
| Alt+← / → | Back / forward |
| Ctrl+W | Close tab |
| Ctrl+Shift+W | Close all sites |
| Ctrl+P | Phone QR |

## 5a. Ad blocker (desktop app)

Ads, ad pop-ups and cookie notices are blocked in every site inside the app, and the empty space they leave is removed.

- The **🛡️ number** in the site bar = ads blocked on that page.
- **Click 🛡️** to turn the blocker off for that site only (if the site breaks or asks you to turn off your ad blocker). Click again to turn it back on.
- **Settings › Ad blocker:** on/off, the list of sites left alone, when the lists were last updated, **Update now**.
- The lists come built into the app and are refreshed once a day in the background. Only the sites are filtered, never the data sources.
- Not available on the phone / tablet app: phone browsers do not allow it.

## 5. Sites (26)

| Category | Sites |
|---|---|
| Flood & Water Level | Water Level Kemaman, Rainfall Kemaman, Flood Hub Chukai, Info Banjir Terengganu, JPS Water Level Terengganu, JPS Infobanjir Map |
| Weather & Radar | Zoom Earth Chukai, Windy Kemaman, Ventusky, Rain Radar, Met Malaysia, MET Peninsular Radar, Himawari Satellite |
| Offshore & Sea | Windy Waves\*, Windy Wind\*, Earth Nullschool Waves\*, Blitzortung Lightning Map\*, VesselFinder |
| Tides | Tide Forecast, Tides Chart, Tides 4 Fishing |
| Cameras & Visual | Info Banjir Camera, Webcam Teladas, JalaNow Traffic Cams |
| Warnings & Emergency | NADMA Portal, Tropical Storms (Zoom Earth Storms) |

All are free with no sign-up. \* = follows the active profile's location: when you switch profile, these sites move to that profile's coordinates. Site pages themselves are in the language their owners publish.

The dot beside each site: **green** = the site answers, **red** = cannot be reached (checked every 30 minutes).

## 6. Cameras and old data

Some cameras are no longer updated by their owners and still show pictures from 2025. The app cannot fix those cameras, but it helps you **spot them**:

- After a site opens, the app reads the full dates written on the page (e.g. `12/03/2025 10:15`) and shows the newest one in the site bar.
- **Orange ⚠** = the newest date is more than 2 days old, so the camera/data may be inactive. **Green ✓** = recent.
- Sites in the Cameras category are always reloaded **without cache**.
- Limit: dates **printed inside the picture** cannot be read, only text on the page. Desktop app only.

## 7. Where the data comes from

| Data | Source |
|---|---|
| Weather, rain, wind, visibility, thunderstorms | Open-Meteo (model) at the profile coordinates |
| Waves, swell, sea level | Open-Meteo Marine (model) at the profile's sea point |
| 7-day forecast | MET Malaysia (data.gov.my), district code. Land profiles only |
| Weather & sea warnings | MET Malaysia (data.gov.my), filtered by the profile keywords. Each warning card shows tiles (wind, waves, thunderstorms, valid), a table of your keyword areas, and MET's full text under "Show full text" |
| Water level & station rainfall | infobanjir Terengganu (the desktop app reads the site tables). Land profiles only |
| Water level (second source) | data.gov.my flood-warning. Its Kemaman data is dated Feb 2024, so it is marked "old data" |

If the Water Level card is empty: **Settings › Diagnostics**, then send me that text.

## 8. Alerts

Alerts sound and show a Windows notification when a threshold of the active profile is crossed. The same alert does not ring again and again; it rings again only if the level goes up. An unacknowledged **Danger** alert rings every minute.

**Closing the window quits the app** (from 3.3.1). Alerts only ring while the app is open. If you want it to keep monitoring after you close the window, turn on **Settings › Stay in tray when closed**: the app then stays in the tray (beside the clock); to quit, right-click the tray icon → Quit.

## 9. Phone / tablet (QR)

1. PC: **File › Phone / tablet (QR)** or Ctrl+P.
2. Phone: connect to the same Wi-Fi or to the PC's Mobile Hotspot.
3. Scan QR 1 → trust the certificate **"Dashboard Cuaca Local CA"** (once only).
4. Scan QR 2 → **Add to Home Screen** (iPhone/iPad) / **Install app** (Android).

The phone setup pages follow the PC's language, and have their own **English / Bahasa Melayu** button at the bottom.

**Phones that installed 3.0:** trust the new certificate once more (QR 1), then reinstall the app (QR 2).

The profile chosen on the phone (when connected to the PC) is the PC's profile too. Without the PC, the phone can switch between the profiles it has saved, but adding or deleting profiles needs the PC.

## 9a. Sites with a blue dot on the iPad / phone (site relay)

Some sites refuse to be shown inside another app (they send X-Frame-Options / CSP). The desktop app shows them anyway in its
own browser; Safari on the iPad cannot. Two ways, both without the PC:

- **Nothing set up:** tapping such a site opens it at once in a browser sheet over the app (tap **Done** to come back).
- **Your own relay (free, about 5 minutes, needs a free Cloudflare account):** the sites show inside the app, like on the PC.
  1. Sign up at **dash.cloudflare.com** (email + password; no card needed for the free plan).
  2. **Workers & Pages** → **Create** → **Hello World** → name it (e.g. `cuaca-relay`) → **Deploy**.
  3. In the app: **Settings › Site relay** → **Copy relay script** (it makes a secret key the first time).
     In Cloudflare: **Edit code** → delete everything → paste → **Deploy**.
  4. Copy the worker address (`https://cuaca-relay.<your-name>.workers.dev`) into **Relay address** → **Save** → **Test relay**.
  The relay only fetches the Dashboard Cuaca Aziz sites, needs the key, and passes no cookies or logins.
  Do it once on the PC: the phone/iPad gets the relay settings the next time it connects, and keeps them.
  Simple pages (JPS, infobanjir) work well; very heavy map apps (Zoom Earth, Flood Hub) may not - use the **↗** button for those.
  The free plan allows 100,000 requests a day, plenty for one person.
- **Stand-ins (3.5):** some government sites refuse Cloudflare too (Test relay shows them with ✗). For those the iPad shows
  a stand-in from the same source inside the app, with a bar "Stand-in: …" and an **Original site ↗** link:
  Water Level / Rainfall Kemaman → the app's own Kemaman page (4.5); Info Banjir Terengganu → JPS Infobanjir
  Map; MET Peninsular Radar → Windy rain radar (MET Malaysia radar data); Met Malaysia → the MET card on the Dashboard;
  VesselFinder → VesselFinder's official embeddable map. Windy and VesselFinder stand-ins work even without a relay.

- **Water Level Kemaman & Rainfall Kemaman tabs (4.5, web & iPad):** the app's own page instead of the dashboard cards: JPS 5-minute
  readings of the 8 water level and 17 rain gauges of Kemaman, 30 days, read by the GitHub mirror every ~15 minutes (folder `kemaman/`
  of the branch `data`). Map (OpenStreetMap) or the real river schema with a 24-hour replay, all gauges against their thresholds,
  % to Danger, rain bubbles, gauge × hour heatmap, measured rain vs the 5 models; tap a gauge for big numbers, a 1–30 day hydrograph
  (drag to zoom), nearby rain, the 5-model forecast and the 4 / 24-hour level outlook. **PDF** (A4) and **Image** (PNG). The PC app
  keeps the real infobanjir site.

## 10. Data files

`%APPDATA%\Dashboard Cuaca Aziz` (File › Open data folder):

- `config.json` – shared settings (including language) + profiles
- `data\snapshot-<profile>.json` – latest data for each profile
- `data\history\<profile>\YYYY-MM-DD.jsonl` – history (45 days)
- `data\alerts.jsonl` – alert log for all profiles
- `cert\` – phone certificate. Back up this folder.

## 11. Tests

```
npx playwright install chromium   (once only)
npm test
```

- `tests/unit.js` – 33 tests (including: every translatable text has an English version; alerts and MET warnings in both languages)
- `tests/app.spec.js` – 21 browser tests (including: no Malay words left anywhere in English mode; switching to BM and back; phone pages)
