#!/bin/bash
mkdir -p s5; cd s5
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
Q='https://publicinfobanjir.water.gov.my/wp-content/themes/enlighten/query'
F14=$(TZ=Asia/Kuala_Lumpur date -d '-14 days' '+%d/%m/%Y%%20%H:00'); T=$(TZ=Asia/Kuala_Lumpur date '+%d/%m/%Y%%20%H:%M')
for f in 60 15; do
curl -sS -L -m 60 -A "$UA" -o rf14-$f.json "$Q/searchresultrainfalldthourlylead.php?extra=&station=_TSET0074&from=$F14&to=$T&datafreq=$f"
echo "== rf14 $f $(wc -c < rf14-$f.json)"; head -c 900 rf14-$f.json; echo; tail -c 300 rf14-$f.json; echo
done
cd ..
