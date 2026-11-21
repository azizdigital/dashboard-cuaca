#!/bin/bash
mkdir -p s4; cd s4
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
B='https://publicinfobanjir.water.gov.my'
curl -sS -L -m 40 -A "$UA" -o wlgraph.html "$B/index.php/wl-graph/?stationid=25318"
echo "== scripts"; grep -io '<script[^>]*src=[^>]*>' wlgraph.html | head -40
echo "== forms"; grep -io '<form[^>]*>\|<input[^>]*>\|<select[^>]*>\|<button[^>]*>' wlgraph.html | head -40
echo "== ajax-ish"; grep -io ".\{0,160\}\(ajax\|\$\.post\|\$\.get\|fetch(\|admin-ajax\|\.php?\|getJSON\|url *:\).\{0,200\}" wlgraph.html | head -40
# fetch every same-site js and grep it too
for s in $(grep -io 'src="[^"]*\.js[^"]*"' wlgraph.html | sed 's/src="//;s/"$//' | grep -i 'publicinfobanjir\|^/' | grep -iv 'jquery\.min\|bootstrap' | head -15); do
  u="$s"; [[ "$u" == /* ]] && u="$B$u"
  f=$(echo "$u" | md5sum | cut -c1-8).js
  curl -sS -L -m 30 -A "$UA" -o "$f" "$u"
  echo "== JS $u"; grep -io ".\{0,160\}\(ajax\|\$\.post\|admin-ajax\|\.php\|getJSON\|wl-graph\|stationid\).\{0,200\}" "$f" | head -15
done
# common guesses
for q in "wl-graph/?stationid=25318&datefrom=2026-11-20&dateto=2026-11-21&interval=60" ; do curl -sS -L -m 30 -A "$UA" -o guess.html "$B/index.php/$q"; echo "== guess $q $(wc -c < guess.html)"; done
cd ..
