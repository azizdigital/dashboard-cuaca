#!/bin/bash
mkdir -p s6; cd s6
UA='DashboardCuacaAziz/4.4 (+https://github.com/azizdigital/dashboard-cuaca)'
BB='3.85,102.95,4.55,103.55'
Q1="[out:json][timeout:150];(way[\"waterway\"=\"river\"](${BB});way[\"waterway\"~\"stream|canal\"][\"name\"~\"Kemaman|Cherul|Tebak|Mas|Cukai|Chukai|Tumpat|Kemasik|Putih|Jabor|Neram|Kijal|Limbong|Paya|Geliga|Pinang\",i](${BB}););out geom;"
Q2="[out:json][timeout:90];(node[\"place\"](${BB});node[\"bridge\"](${BB});way[\"bridge\"=\"yes\"][\"name\"](${BB}););out center tags;"
Q4="[out:json][timeout:120];(way[\"natural\"=\"coastline\"](4.0,103.25,4.55,103.6););out geom;"
for OV in 'https://overpass-api.de/api/interpreter' 'https://maps.mail.ru/osm/tools/overpass/api/interpreter' 'https://overpass.osm.jp/api/interpreter'; do
  code=$(curl -sS -m 200 -A "$UA" -H 'Accept: application/json' --data-urlencode "data=$Q1" -o osm-rivers.json -w '%{http_code}' "$OV"); echo "== $OV rivers -> $code $(wc -c < osm-rivers.json 2>/dev/null)"
  if [ "$code" = "200" ]; then
    sleep 5; c2=$(curl -sS -m 200 -A "$UA" -H 'Accept: application/json' --data-urlencode "data=$Q2" -o osm-places.json -w '%{http_code}' "$OV"); echo "== places $c2 $(wc -c < osm-places.json)"
    sleep 5; c4=$(curl -sS -m 200 -A "$UA" -H 'Accept: application/json' --data-urlencode "data=$Q4" -o osm-coast.json -w '%{http_code}' "$OV"); echo "== coast $c4 $(wc -c < osm-coast.json)"
    break
  fi
  head -c 300 osm-rivers.json; echo
done
# Nominatim: the villages / bridges in the gauge names
: > nominatim.txt
for q in 'Kampung Rantau Panjang, Kemaman' 'Paya Paman, Kemaman' 'Kampung Baru Kemasik' 'Kemasik, Terengganu' 'Kampung Yak Yah, Kemaman' 'Kampung Sungai Mas, Kemaman' 'Ban Ho, Kemaman' 'Air Putih, Kemaman' 'Kampung Geliga, Kemaman' 'Tebak, Kemaman' 'Seri Bandi, Kemaman' 'Neram, Kemaman' 'Kijal, Kemaman' 'Dusun Nyior, Kemaman' 'Jabor, Kemaman' 'Chukai, Kemaman' 'Sungai Cherul' 'Sungai Tebak' 'Sungai Mas, Terengganu' 'Sungai Tumpat, Kemaman' 'Sungai Cukai' 'Sungai Kemaman'; do
  r=$(curl -sS -m 30 -A "$UA" -G 'https://nominatim.openstreetmap.org/search' --data-urlencode "q=$q" --data-urlencode 'format=jsonv2' --data-urlencode 'limit=3' --data-urlencode 'countrycodes=my')
  echo "## $q" >> nominatim.txt; echo "$r" >> nominatim.txt; sleep 1.5
done
echo "== nominatim $(wc -c < nominatim.txt)"; head -c 800 nominatim.txt
cd ..
