#!/bin/bash
mkdir -p s5; cd s5
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
B='https://publicinfobanjir.water.gov.my'; Q="$B/wp-content/themes/enlighten/query"
F14=$(TZ=Asia/Kuala_Lumpur date -d '-14 days' '+%d/%m/%Y%%20%H:00'); F30=$(TZ=Asia/Kuala_Lumpur date -d '-30 days' '+%d/%m/%Y%%20%H:00'); T=$(TZ=Asia/Kuala_Lumpur date '+%d/%m/%Y%%20%H:%M')
for f in 60 15; do
  curl -sS -L -m 60 -A "$UA" -o wl14-$f.json "$Q/searchresultwaterleveldtlead.php?station=27197&from=$F14&to=$T&datafreq=$f"
  echo "== wl14 datafreq=$f $(wc -c < wl14-$f.json) bytes"; python3 -c "import json,sys;j=json.loads(open('wl14-$f.json').read().strip());v=j['values'];print(len(v),v[0]['dt'],v[-1]['dt'],v[1]['dt'] if len(v)>1 else '')"
done
curl -sS -L -m 60 -A "$UA" -o wl30.json "$Q/searchresultwaterleveldtlead.php?station=27197&from=$F30&to=$T&datafreq=60"
echo "== wl30 $(wc -c < wl30.json)"; python3 -c "import json;j=json.loads(open('wl30.json').read().strip());v=j['values'];print(len(v),v[0]['dt'],v[-1]['dt'])"
curl -sS -L -m 60 -A "$UA" -o rfgraph.html "$B/index.php/rf-graph/?stationid=_TSET0074"
echo "== rf urls"; grep -o "query/[a-zA-Z0-9_]*\.php[^\"']*" rfgraph.html | sort -u
python3 - <<'P'
import re
s=open('rfgraph.html',encoding='utf-8',errors='ignore').read()
i=s.find('$.getJSON(url'); print(s[i-2500:i+1800])
P
cd ..
