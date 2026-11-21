#!/bin/bash
mkdir -p s6; cd s6
UA='DashboardCuacaAziz/4.4 (+https://github.com/azizdigital/dashboard-cuaca)'
BB='3.85,102.85,4.55,103.55'
Q1="[out:json][timeout:170];way[\"waterway\"=\"river\"](${BB});out geom;"
Q2="[out:json][timeout:120];(node[\"place\"](${BB});way[\"bridge\"=\"yes\"][\"name\"](${BB}););out center tags;"
Q4="[out:json][timeout:120];way[\"natural\"=\"coastline\"](4.0,103.3,4.5,103.6);out geom;"
get() { # $1 query $2 file
  for w in 20 40 60 90 120; do
    for OV in 'https://overpass-api.de/api/interpreter' 'https://maps.mail.ru/osm/tools/overpass/api/interpreter' 'https://overpass.private.coffee/api/interpreter'; do
      code=$(curl -sS -m 200 -A "$UA" -H 'Accept: application/json' --data-urlencode "data=$1" -o "$2" -w '%{http_code}' "$OV"); echo "== $2 $OV -> $code $(wc -c < $2 2>/dev/null)"
      [ "$code" = "200" ] && return 0
    done
    sleep $w
  done
}
get "$Q1" osm-rivers.json
get "$Q2" osm-places.json
get "$Q4" osm-coast.json
: > nominatim2.txt
for q in 'Kampung Paya Paman' 'Rumah Pam Paya Paman' 'Kampung Geliga' 'Geliga, Chukai' 'Kampung Ban Ho' 'Ban Ho, Terengganu' 'Kampung Sungai Mas, Terengganu' 'Kampung Rantau Panjang, Terengganu' 'Rantau Panjang, Kemaman' 'Jambatan Air Putih' 'Air Putih, Terengganu' 'Kampung Air Putih, Kemaman' 'Kampung Batu 14, Kemaman' 'Kampung Padang Kubu' 'Kampung Teladas' 'Kampung Dadong' 'Kampung Pasir Gajah' 'Kampung Sungai Pinang, Kemaman' 'Kampung Bukit Mentok' 'Kampung Padang Kemunting' 'Kampung Seberang Tayor' 'Kampung Pasir Minal' 'Pengkalan Pandan' 'Kampung Batu 16, Kemaman'; do
  r=$(curl -sS -m 30 -A "$UA" -G 'https://nominatim.openstreetmap.org/search' --data-urlencode "q=$q" --data-urlencode 'format=jsonv2' --data-urlencode 'limit=3' --data-urlencode 'countrycodes=my')
  echo "## $q" >> nominatim2.txt; echo "$r" >> nominatim2.txt; sleep 1.5
done
: > nominatim-rivers.txt
for q in 'Sungai Kemaman' 'Sungai Cerul' 'Sungai Tebak' 'Sungai Mas, Kemaman' 'Sungai Air Putih, Kemaman' 'Sungai Cukai' 'Sungai Tumpat, Kemaman' 'Sungai Kemasik' 'Sungai Limbong, Kemaman' 'Sungai Neram'; do
  r=$(curl -sS -m 30 -A "$UA" -G 'https://nominatim.openstreetmap.org/search' --data-urlencode "q=$q" --data-urlencode 'format=jsonv2' --data-urlencode 'limit=10' --data-urlencode 'countrycodes=my' --data-urlencode 'polygon_geojson=1')
  echo "## $q" >> nominatim-rivers.txt; echo "$r" >> nominatim-rivers.txt; sleep 1.5
done
echo "== nominatim2 $(wc -c < nominatim2.txt) rivers $(wc -c < nominatim-rivers.txt)"
cd ..
