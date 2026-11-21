#!/bin/bash
mkdir -p s7; cd s7
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
Q='https://publicinfobanjir.water.gov.my/wp-content/themes/enlighten/query'
F1=$(TZ=Asia/Kuala_Lumpur date -d '-1 days' '+%d/%m/%Y%%20%H:00'); F30=$(TZ=Asia/Kuala_Lumpur date -d '-30 days' '+%d/%m/%Y%%20%H:00'); T=$(TZ=Asia/Kuala_Lumpur date '+%d/%m/%Y%%20%H:%M')
for g in 27192 4131001_ 4233453_ 27197; do
  for f in 1 5 15; do
    s=$(date +%s.%N); curl -sS -L -m 90 -A "$UA" -o wl-$g-$f.json "$Q/searchresultwaterleveldtlead.php?station=$g&from=$F1&to=$T&datafreq=$f"; e=$(date +%s.%N)
    echo "== wl $g f$f 1d $(wc -c < wl-$g-$f.json) bytes $(echo "$e-$s"|bc)s"; grep -o '"dt":"[^"]*"' wl-$g-$f.json | head -4 | tr '\n' ' '; echo
  done
done
s=$(date +%s.%N); curl -sS -L -m 120 -A "$UA" -o wl30.json "$Q/searchresultwaterleveldtlead.php?station=27192&from=$F30&to=$T&datafreq=5"; e=$(date +%s.%N)
echo "== wl30 $(wc -c < wl30.json) $(echo "$e-$s"|bc)s count $(grep -o '"dt"' wl30.json | wc -l)"
s=$(date +%s.%N); curl -sS -L -m 120 -A "$UA" -o rf30.json "$Q/searchresultrainfalldthourlylead.php?extra=&station=27192&from=$F30&to=$T&datafreq=60"; e=$(date +%s.%N)
echo "== rf30 $(wc -c < rf30.json) $(echo "$e-$s"|bc)s count $(grep -o '"dt"' rf30.json | wc -l)"; grep -o '"dt":"[^"]*"' rf30.json | head -3 | tr '\n' ' '; echo
for g in 4131001_ TKMN0007 26665; do curl -sS -L -m 90 -A "$UA" -o rf-$g.json "$Q/searchresultrainfalldthourlylead.php?extra=&station=$g&from=$F1&to=$T&datafreq=60"; echo "== rf $g $(wc -c < rf-$g.json) $(grep -o '"dt"' rf-$g.json | wc -l)"; grep -o '"dt":"[^"]*"' rf-$g.json | head -2 | tr '\n' ' '; echo; done
rm -f wl30.json rf30.json
cd ..
