#!/bin/bash
mkdir -p s4; cd s4
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
Q='https://publicinfobanjir.water.gov.my/wp-content/themes/enlighten/query'
curl -sS -L -m 40 -A "$UA" -D h7.txt -o last7.json "$Q/getwaterlevellast7dayslead.php?extra=&station=25318"
echo "== last7 $(wc -c < last7.json)"; head -c 1500 last7.json; echo; grep -i 'access-control\|content-type' h7.txt
curl -sS -L -m 40 -A "$UA" -o range.json "$Q/searchresultwaterleveldtlead.php?station=25318&from=20/11/2026%2000:00&to=21/11/2026%2010:00&datafreq=60"
echo "== range $(wc -c < range.json)"; head -c 1200 range.json; echo
# a Kemaman station id from the main list
curl -sS -L -m 40 -A "$UA" -o main.html 'https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/?state=TRG&district=KEMAMAN&station=ALL&lang=en'
grep -o "stationid=[0-9]*" main.html | sort -u | head -20
cd ..
