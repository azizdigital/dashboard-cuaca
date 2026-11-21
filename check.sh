#!/bin/bash
mkdir -p s10; cd s10
UA='Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
for t in 10/805/499 11/1611/999; do
  code=$(curl -sS -m 30 -A "$UA" -e 'https://azizdigital.github.io/' -o tile-${t//\//-}.png -w '%{http_code} %{content_type}' "https://tile.openstreetmap.org/$t.png"); echo "== osm $t -> $code $(wc -c < tile-${t//\//-}.png)"
done
code=$(curl -sS -m 30 -A "$UA" -e 'https://azizdigital.github.io/' -o carto.png -w '%{http_code} %{content_type}' "https://a.basemaps.cartocdn.com/dark_all/10/817/507.png"); echo "== carto -> $code $(wc -c < carto.png)"
cd ..
