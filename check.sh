#!/bin/bash
# probe: station coordinates (data.gov.my flood-warning = JPS stations) + real rivers & places of Kemaman (OpenStreetMap / Overpass)
mkdir -p s6; cd s6
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
curl -sS -m 90 -A "$UA" -o dg-kemaman.json 'https://api.data.gov.my/flood-warning?contains=Kemaman@district&limit=500'
echo "== dg-kemaman $(wc -c < dg-kemaman.json)"; head -c 600 dg-kemaman.json; echo
curl -sS -m 90 -A "$UA" -o dg-trg.json 'https://api.data.gov.my/flood-warning?contains=TERENGGANU@state&limit=1000'
echo "== dg-trg $(wc -c < dg-trg.json)"; head -c 300 dg-trg.json; echo
OV='https://overpass-api.de/api/interpreter'
BB='3.80,102.90,4.60,103.60'
Q1="[out:json][timeout:120];(way[\"waterway\"~\"river|stream|canal\"][\"name\"](${BB}););out geom;"
curl -sS -m 180 -A "$UA" --data-urlencode "data=$Q1" -o osm-rivers.json "$OV"
echo "== osm-rivers $(wc -c < osm-rivers.json)"; head -c 300 osm-rivers.json; echo
Q2="[out:json][timeout:90];(node[\"place\"~\"town|village|hamlet|suburb|neighbourhood|locality\"](${BB}););out;"
curl -sS -m 180 -A "$UA" --data-urlencode "data=$Q2" -o osm-places.json "$OV"
echo "== osm-places $(wc -c < osm-places.json)"; head -c 300 osm-places.json; echo
Q3="[out:json][timeout:90];(way[\"bridge\"][\"name\"](${BB});way[\"highway\"][\"bridge\"=\"yes\"][\"name\"~\"Jambatan\",i](${BB}););out center tags;"
curl -sS -m 180 -A "$UA" --data-urlencode "data=$Q3" -o osm-bridges.json "$OV"
echo "== osm-bridges $(wc -c < osm-bridges.json)"; head -c 300 osm-bridges.json; echo
Q4="[out:json][timeout:120];(way[\"natural\"=\"coastline\"](4.0,103.2,4.6,103.6););out geom;"
curl -sS -m 180 -A "$UA" --data-urlencode "data=$Q4" -o osm-coast.json "$OV"
echo "== osm-coast $(wc -c < osm-coast.json)"
cd ..
