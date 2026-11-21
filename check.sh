#!/bin/bash
mkdir -p s6; cd s6
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
for u in 'https://api.data.gov.my/flood-warning?limit=3000' 'https://api.data.gov.my/flood-warning/?contains=Kemaman@district' 'https://api.data.gov.my/flood-warning'; do
  n=$(echo "$u" | md5sum | cut -c1-6)
  code=$(curl -sS -L -m 90 -A "$UA" -o dg-$n.json -w '%{http_code}' "$u"); echo "== $u -> $code $(wc -c < dg-$n.json)"; head -c 400 dg-$n.json; echo
done
BB='3.80,102.90,4.60,103.60'
Q1="[out:json][timeout:120];(way[\"waterway\"~\"river|stream|canal\"][\"name\"](${BB}););out geom;"
Q2="[out:json][timeout:90];(node[\"place\"~\"town|village|hamlet|suburb|neighbourhood|locality\"](${BB}););out;"
Q3="[out:json][timeout:90];(way[\"bridge\"][\"name\"](${BB}););out center tags;"
Q4="[out:json][timeout:120];(way[\"natural\"=\"coastline\"](4.0,103.2,4.6,103.6););out geom;"
for OV in 'https://overpass.kumi.systems/api/interpreter' 'https://overpass.private.coffee/api/interpreter' 'https://maps.mail.ru/osm/tools/overpass/api/interpreter' 'https://overpass-api.de/api/interpreter'; do
  code=$(curl -sS -m 180 -A "$UA" --data-urlencode "data=$Q1" -o osm-rivers.json -w '%{http_code}' "$OV"); echo "== $OV rivers -> $code $(wc -c < osm-rivers.json 2>/dev/null)"
  if [ "$code" = "200" ] && [ $(wc -c < osm-rivers.json) -gt 1000 ]; then
    curl -sS -m 180 -A "$UA" --data-urlencode "data=$Q2" -o osm-places.json "$OV"; echo "== places $(wc -c < osm-places.json)"
    curl -sS -m 180 -A "$UA" --data-urlencode "data=$Q3" -o osm-bridges.json "$OV"; echo "== bridges $(wc -c < osm-bridges.json)"
    curl -sS -m 180 -A "$UA" --data-urlencode "data=$Q4" -o osm-coast.json "$OV"; echo "== coast $(wc -c < osm-coast.json)"
    break
  fi
done
cd ..
