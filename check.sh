#!/bin/bash
mkdir -p samples2; cd samples2
for p in "4.2367,103.4180" "4.25,103.40" "4.30,103.35"; do
  la=${p%,*}; lo=${p#*,}
  curl -sS -m 40 -o "flood-$la-$lo.json" -w "flood $p %{http_code} %{size_download}\n" "https://flood-api.open-meteo.com/v1/flood?latitude=$la&longitude=$lo&daily=river_discharge,river_discharge_mean,river_discharge_median,river_discharge_max,river_discharge_min,river_discharge_p25,river_discharge_p75&past_days=7&forecast_days=30" >> ../log2.txt 2>&1
done
curl -sS -I -m 30 -H 'Origin: https://azizdigital.github.io' "https://flood-api.open-meteo.com/v1/flood?latitude=4.24&longitude=103.42&daily=river_discharge" | grep -i "access-control\|^HTTP" >> ../log2.txt
cd ..; cat log2.txt
