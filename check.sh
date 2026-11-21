#!/bin/bash
mkdir -p s12; cd s12
UA='DashboardCuacaAziz/4.5 (+https://github.com/azizdigital/dashboard-cuaca)'
F='https://flood-api.open-meteo.com/v1/flood'
get() { code=$(curl -sS -m 150 -A "$UA" -o "$2" -w '%{http_code}' "$1"); echo "== $2 $code $(wc -c < $2)"; }
LATS=""; LONS=""
for la in 4.175 4.2 4.225 4.25 4.275 4.3; do for lo in 103.325 103.35 103.375 103.4 103.425 103.45; do LATS="$LATS,$la"; LONS="$LONS,$lo"; done; done
get "$F?latitude=${LATS#,}&longitude=${LONS#,}&daily=river_discharge&past_days=61&forecast_days=7" grid.json
P='latitude=4.225&longitude=103.375'
get "$F?$P&daily=river_discharge,river_discharge_mean,river_discharge_median,river_discharge_max,river_discharge_min,river_discharge_p25,river_discharge_p75&past_days=92&forecast_days=30" stats.json
get "$F?$P&daily=river_discharge&past_days=7&forecast_days=30&ensemble=true" ens.json
get "$F?$P&daily=river_discharge&start_date=1984-01-01&end_date=2025-12-31&models=consolidated_v4" hist.json
get "$F?$P&daily=river_discharge&past_days=92&forecast_days=30&models=seamless_v4,forecast_v4,seamless_v3,forecast_v3" models.json
get "$F?$P&daily=river_discharge&past_days=92&forecast_days=210&models=seamless_v4" long.json
cd ..
