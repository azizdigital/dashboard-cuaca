/* Dashboard Cuaca Aziz 4 - site tiles.
   in: true  = the site allows being shown inside another app (checked 20 Nov 2026: no X-Frame-Options / frame-ancestors)
   in: false = the site refuses (X-Frame-Options / frame-ancestors) or only answers from Malaysia: opens in a new tab */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SITES = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function f(n) { return Number(n).toFixed(3); }
  function windy(overlay, p, zoom) {
    return 'https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=%C2%B0C&metricWind=km%2Fh&zoom=' + (zoom || 7) +
      '&overlay=' + overlay + '&product=ecmwf&level=surface&lat=' + f(p.lat) + '&lon=' + f(p.lon) + '&detailLat=' + f(p.lat) + '&detailLon=' + f(p.lon) + '&detail=true&marker=true&message=true';
  }
  function windySea(overlay, p) { return windy(overlay, { lat: p.seaLat, lon: p.seaLon }, 7); }
  function mbLoc(p) { return Math.abs(p.lat).toFixed(3) + (p.lat >= 0 ? 'N' : 'S') + Math.abs(p.lon).toFixed(3) + (p.lon >= 0 ? 'E' : 'W'); }
  var JPS_W = function (p) { return 'https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/aras-air-data/?state=' + (p.jpsState || 'TRG') + '&district=ALL&station=ALL&lang=en'; };

  var CATS = [
    { id: 'weather', ms: 'Cuaca & radar', en: 'Weather & radar', items: [
      { id: 'w-rain', icon: '🌧️', in: true, ms: 'Windy - hujan & ribut petir', en: 'Windy - rain & thunder', dms: 'Ramalan hujan bergerak, jam demi jam', den: 'Moving rain forecast, hour by hour', url: function (p) { return windy('rain', p, 8); } },
      { id: 'radar', icon: '📡', in: true, ms: 'RainViewer - radar hujan', en: 'RainViewer - rain radar', dms: 'Radar hujan sebenar, 2 jam lepas + ramalan', den: 'Live rain radar, last 2 h + nowcast', url: function (p) { return 'https://www.rainviewer.com/map.html?loc=' + f(p.lat) + ',' + f(p.lon) + ',7&oFa=0&oC=1&oU=0&oCS=1&oF=0&oAP=1&c=3&o=83&lm=1&layer=radar&sm=1&sn=1'; } },
      { id: 'ventusky', icon: '🗺️', in: true, ms: 'Ventusky - peta cuaca', en: 'Ventusky - weather map', dms: 'Hujan, angin, suhu dalam satu peta', den: 'Rain, wind, temperature on one map', url: function (p) { return 'https://www.ventusky.com/?p=' + f(p.lat) + ';' + f(p.lon) + ';7&l=rain-3h'; } },
      { id: 'meteoblue', icon: '📅', in: true, ms: 'Meteoblue - 7 hari', en: 'Meteoblue - 7 days', dms: 'Ramalan harian kedua (model lain)', den: 'Second daily forecast (another model)', url: function (p) { return 'https://www.meteoblue.com/en/weather/widget/daily/' + mbLoc(p) + '?geoloc=fixed&days=7&tempunit=CELSIUS&windunit=KILOMETER_PER_HOUR&precipunit=MILLIMETER&coloured=coloured&pictoicon=1&maxtemperature=1&mintemperature=1&windspeed=1&windgust=1&winddirection=1&uv=0&humidity=0&precipitation=1&precipitationprobability=1&spot=0&pressure=0&layout=dark'; } },
      { id: 'lightning', icon: '⚡', in: true, ms: 'Blitzortung - kilat', en: 'Blitzortung - lightning', dms: 'Panahan kilat masa nyata', den: 'Lightning strikes in real time', url: function (p) { return 'https://map.blitzortung.org/#7/' + f(p.lat) + '/' + f(p.lon); } },
      { id: 'metfc', icon: '🏛️', in: false, ms: 'MET Malaysia - ramalan', en: 'MET Malaysia - forecast', dms: 'Laman rasmi MET', den: 'Official MET site', url: function (p) { return p.metId ? 'https://www.met.gov.my/en/forecast/weather/district/' + p.metId + '/' : 'https://www.met.gov.my/en/forecast/marine/'; } },
      { id: 'metradar', icon: '🛰️', in: false, ms: 'MET Malaysia - radar', en: 'MET Malaysia - radar', dms: 'Radar rasmi Semenanjung', den: 'Official Peninsular radar', url: function () { return 'https://www.met.gov.my/en/pencerapan/radar-semenanjung/'; } },
      { id: 'zoomearth', icon: '🌀', in: false, ms: 'Zoom Earth - satelit & ribut', en: 'Zoom Earth - satellite & storms', dms: 'Satelit langsung, ribut tropika', den: 'Live satellite, tropical storms', url: function () { return 'https://zoom.earth/storms/'; } },
      { id: 'himawari', icon: '🌏', in: false, ms: 'Himawari - satelit', en: 'Himawari - satellite', dms: 'Imej satelit penuh', den: 'Full-disk satellite images', url: function () { return 'https://slider.cira.colostate.edu/?sat=himawari&sec=full_disk'; } }
    ] },
    { id: 'sea', ms: 'Angin & laut', en: 'Wind & sea', items: [
      { id: 'w-wind', icon: '💨', in: true, ms: 'Windy - angin', en: 'Windy - wind', dms: 'Kelajuan & arah angin, 10 hari', den: 'Wind speed & direction, 10 days', url: function (p) { return windy('wind', p, 7); } },
      { id: 'w-gust', icon: '🌬️', in: true, ms: 'Windy - tiupan kencang', en: 'Windy - gusts', dms: 'Tiupan angin maksimum', den: 'Maximum wind gusts', url: function (p) { return windy('gust', p, 7); } },
      { id: 'w-waves', icon: '🌊', in: true, ms: 'Windy - ombak', en: 'Windy - waves', dms: 'Tinggi ombak keseluruhan', den: 'Total wave height', url: function (p) { return windySea('waves', p); } },
      { id: 'w-swell', icon: '〰️', in: true, ms: 'Windy - swell', en: 'Windy - swell', dms: 'Alun dari jauh: tinggi, tempoh, arah', den: 'Swell: height, period, direction', url: function (p) { return windySea('swell1', p); } },
      { id: 'nullwave', icon: '🌐', in: true, ms: 'earth.nullschool - ombak', en: 'earth.nullschool - waves', dms: 'Animasi ombak seluruh laut', den: 'Animated waves across the sea', url: function (p) { return 'https://earth.nullschool.net/#current/ocean/primary/waves/overlay=significant_wave_height/orthographic=' + f(p.seaLon) + ',' + f(p.seaLat) + ',2500'; } },
      { id: 'nullwind', icon: '🌀', in: true, ms: 'earth.nullschool - angin', en: 'earth.nullschool - wind', dms: 'Animasi angin', den: 'Animated wind', url: function (p) { return 'https://earth.nullschool.net/#current/wind/surface/level/orthographic=' + f(p.lon) + ',' + f(p.lat) + ',2500'; } },
      { id: 'windy', icon: '🧭', in: false, ms: 'Windy (laman penuh)', en: 'Windy (full site)', dms: 'Semua lapisan & model', den: 'All layers & models', url: function (p) { return 'https://www.windy.com/' + f(p.lat) + '/' + f(p.lon) + '?wind,' + f(p.lat) + ',' + f(p.lon) + ',8'; } },
      { id: 'windguru', icon: '🏄', in: false, ms: 'Windguru', en: 'Windguru', dms: 'Jadual angin & ombak', den: 'Wind & wave tables', url: function () { return 'https://www.windguru.cz/'; } }
    ] },
    { id: 'tide', ms: 'Pasang surut', en: 'Tides', items: [
      { id: 'tideforecast', icon: '🌙', in: false, ms: 'Tide Forecast - Cukai', en: 'Tide Forecast - Cukai', dms: 'Jadual asal (data juga di-mirror di atas)', den: 'Original table (also mirrored above)', url: function () { return 'https://www.tide-forecast.com/locations/Cukai/tides/latest'; } },
      { id: 'tideschart', icon: '📈', in: false, ms: 'Tides Chart - Cukai', en: 'Tides Chart - Cukai', dms: 'Carta pasang surut', den: 'Tide chart', url: function () { return 'https://www.tideschart.com/Malaysia/Terengganu/Cukai/'; } },
      { id: 'tides4fishing', icon: '🎣', in: false, ms: 'Tides4Fishing - Chukai', en: 'Tides4Fishing - Chukai', dms: 'Pasang surut & solunar', den: 'Tides & solunar', url: function () { return 'https://tides4fishing.com/my/terengganu/chukai'; } }
    ] },
    { id: 'flood', ms: 'Banjir & sungai', en: 'Flood & rivers', items: [
      { id: 'jpsaras', icon: '📊', in: false, ms: 'JPS - paras air', en: 'JPS - water level', dms: 'Jadual asal (di-mirror di atas)', den: 'Original table (mirrored above)', url: JPS_W },
      { id: 'jpshujan', icon: '🌧️', in: false, ms: 'JPS - hujan', en: 'JPS - rainfall', dms: 'Jadual asal (di-mirror di atas)', den: 'Original table (mirrored above)', url: function (p) { return 'https://publicinfobanjir.water.gov.my/wp-content/themes/shapely/agency/searchresultrainfall.php?state=' + (p.jpsState || 'TRG') + '&district=ALL&station=ALL&language=1&loginStatus=0'; } },
      { id: 'jpspeta', icon: '🗾', in: false, ms: 'JPS Infobanjir - peta', en: 'JPS Infobanjir - map', dms: 'Peta stesen seluruh negara', den: 'Map of all stations', url: function () { return 'https://publicinfobanjir.water.gov.my/main/'; } },
      { id: 'ibtrg', icon: '🏞️', in: false, ms: 'infobanjir Terengganu', en: 'infobanjir Terengganu', dms: 'Paras air daerah Kemaman (hanya dari Malaysia)', den: 'Kemaman water level (Malaysia only)', url: function () { return 'https://infobanjir.terengganu.gov.my/WaterLevel/District/4'; } },
      { id: 'ibtrgrain', icon: '☔', in: false, ms: 'infobanjir Terengganu - hujan', en: 'infobanjir Terengganu - rain', dms: 'Hujan daerah Kemaman', den: 'Kemaman rainfall', url: function () { return 'https://infobanjir.terengganu.gov.my/Rainfall/District/4'; } },
      { id: 'floodhub', icon: '🌊', in: false, ms: 'Google Flood Hub', en: 'Google Flood Hub', dms: 'Ramalan banjir sungai', den: 'River flood forecast', url: function (p) { return 'https://sites.research.google/floods/l/' + f(p.lat) + '/' + f(p.lon) + '/11'; } },
      { id: 'nadma', icon: '🆘', in: false, ms: 'NADMA - portal bencana', en: 'NADMA - disaster portal', dms: 'Pusat pemindahan, mangsa', den: 'Relief centres, victims', url: function () { return 'https://portalbencana.nadma.gov.my/ms/'; } }
    ] },
    { id: 'cams', ms: 'Kamera', en: 'Cameras', items: [
      { id: 'cam-teladas', icon: '📷', in: true, ms: 'Webcam Jambatan Lama Teladas', en: 'Webcam Teladas old bridge', dms: 'Kemaman (Windy Webcams)', den: 'Kemaman (Windy Webcams)', url: function () { return 'https://webcams.windy.com/webcams/public/embed/player/1733738208/day'; } },
      { id: 'jalanow', icon: '🚗', in: true, ms: 'JalaNow - kamera trafik', en: 'JalaNow - traffic cameras', dms: 'Kamera lebuh raya', den: 'Highway cameras', url: function () { return 'https://www.jalanow.com/malaysia-highways-live-traffic-cameras.htm'; } },
      { id: 'ibcam', icon: '🎥', in: false, ms: 'Kamera banjir Terengganu', en: 'Terengganu flood cameras', dms: 'CCTV sungai (hanya dari Malaysia)', den: 'River CCTV (Malaysia only)', url: function () { return 'https://infobanjir.terengganu.gov.my/Camera'; } }
    ] },
    { id: 'ships', ms: 'Kapal', en: 'Ships', items: [
      { id: 'vessels', icon: '🚢', in: true, ms: 'VesselFinder - peta kapal', en: 'VesselFinder - ship map', dms: 'Kapal berhampiran (versi embed rasmi)', den: 'Nearby ships (official embed)', url: function (p) { return 'embed/vessels.html?lat=' + f(p.seaLat) + '&lon=' + f(p.seaLon) + '&zoom=8'; } },
      { id: 'vesselfinder', icon: '⚓', in: false, ms: 'VesselFinder (laman penuh)', en: 'VesselFinder (full site)', dms: 'Carian kapal', den: 'Ship search', url: function () { return 'https://www.vesselfinder.com/'; } }
    ] }
  ];
  function all() { var out = []; CATS.forEach(function (c) { c.items.forEach(function (s) { s.cat = c.id; out.push(s); }); }); return out; }
  return { CATS: CATS, all: all };
}));
