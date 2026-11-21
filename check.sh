#!/bin/bash
mkdir -p s11; cd s11
UA='DashboardCuacaAziz/4.5 (+https://github.com/azizdigital/dashboard-cuaca)'
F='https://flood-api.open-meteo.com/v1/flood'
P='latitude=4.2229&longitude=103.4396'
get() { code=$(curl -sS -m 120 -A "$UA" -o "$2" -w '%{http_code}' "$1"); echo "== $2 $code $(wc -c < $2)"; head -c 400 "$2"; echo; }
get "$F?$P&daily=river_discharge,river_discharge_mean,river_discharge_median,river_discharge_max,river_discharge_min,river_discharge_p25,river_discharge_p75&past_days=92&forecast_days=30" stats-v4.json
get "$F?$P&daily=river_discharge&past_days=7&forecast_days=30&ensemble=true" ens.json
get "$F?$P&daily=river_discharge&start_date=1984-01-01&end_date=2025-12-31&models=consolidated_v4" hist-v4.json
get "$F?$P&daily=river_discharge&past_days=92&forecast_days=30&models=seamless_v3" seamless-v3.json
get "$F?$P&daily=river_discharge&past_days=92&forecast_days=30&models=seamless_v4,forecast_v4,consolidated_v4,seamless_v3,forecast_v3,consolidated_v3" models.json
# upstream points on the real rivers: Air Putih bridge, Ban Ho (Cherul), Rantau Panjang
for pt in '4.2715,103.2146' '4.1389,103.1708' '4.2776,103.2657' '4.2183,103.3726'; do
  get "$F?latitude=${pt%,*}&longitude=${pt#*,}&daily=river_discharge,river_discharge_max,river_discharge_min&past_days=31&forecast_days=30" "pt-${pt//[.,]/_}.json"
done
cd ..
