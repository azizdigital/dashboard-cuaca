#!/bin/bash
# Save raw samples of every source the new app reads, to build the parsers against real data.
mkdir -p samples; cd samples
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
get() { curl -sS -L -m 40 -A "$UA" -o "$1" -w "$1 %{http_code} %{size_download} %{time_total}\n" "$2" >> ../log.txt 2>&1 || echo "$1 FAIL" >> ../log.txt; }
get jps-water-TRG.html 'https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/aras-air-data/?state=TRG&district=ALL&station=ALL&lang=en'
get jps-rain-TRG.html 'https://publicinfobanjir.water.gov.my/wp-content/themes/shapely/agency/searchresultrainfall.php?state=TRG&district=ALL&station=ALL&language=1&loginStatus=0'
get jps-water-PHG.html 'https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/aras-air-data/?state=PHG&district=ALL&station=ALL&lang=en'
get tide-cukai.html 'https://www.tide-forecast.com/locations/Cukai/tides/latest'
get tide-cukai-7.html 'https://www.tide-forecast.com/locations/Cukai/tides/latest?days=7'
get om-forecast.json 'https://api.open-meteo.com/v1/forecast?latitude=4.23&longitude=103.42&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&timezone=Asia%2FKuala_Lumpur&forecast_days=16'
get om-marine.json 'https://marine-api.open-meteo.com/v1/marine?latitude=4.23&longitude=103.47&hourly=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,wind_wave_height,sea_level_height_msl&daily=wave_height_max,swell_wave_height_max,swell_wave_period_max,swell_wave_direction_dominant,wave_direction_dominant&timezone=Asia%2FKuala_Lumpur&forecast_days=16'
get om-marine-offshore.json 'https://marine-api.open-meteo.com/v1/marine?latitude=5.5&longitude=104.8&hourly=wave_height,swell_wave_height,sea_level_height_msl&forecast_days=8&timezone=Asia%2FKuala_Lumpur'
get om-ensemble.json 'https://ensemble-api.open-meteo.com/v1/ensemble?latitude=4.23&longitude=103.42&daily=precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,temperature_2m_max&models=ecmwf_ifs025&forecast_days=35&timezone=Asia%2FKuala_Lumpur'
get om-ensemble-gfs.json 'https://ensemble-api.open-meteo.com/v1/ensemble?latitude=4.23&longitude=103.42&daily=precipitation_sum,wind_speed_10m_max&models=gfs05&forecast_days=35&timezone=Asia%2FKuala_Lumpur'
get om-seasonal.json 'https://seasonal-api.open-meteo.com/v1/seasonal?latitude=4.23&longitude=103.42&daily=precipitation_sum,wind_speed_10m_max,temperature_2m_max&forecast_days=45&timezone=Asia%2FKuala_Lumpur'
get om-geocode.json 'https://geocoding-api.open-meteo.com/v1/search?name=Kemaman&count=5&language=en&countryCode=MY'
get dg-warning.json 'https://api.data.gov.my/weather/warning?limit=20'
get dg-forecast-kemaman.json 'https://api.data.gov.my/weather/forecast?contains=Kemaman@location__location_name&limit=20'
get dg-forecast-ds.json 'https://api.data.gov.my/weather/forecast?contains=Ds065@location__location_id&limit=20'
get dg-flood.json 'https://api.data.gov.my/flood-warning?contains=Kemaman@district&limit=50'
get dg-earthquake.json 'https://api.data.gov.my/weather/warning/earthquake?limit=5'
get rainviewer.json 'https://api.rainviewer.com/public/weather-maps.json'
cd ..; cat log.txt
