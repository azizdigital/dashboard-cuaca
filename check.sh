#!/bin/bash
mkdir -p s3; cd s3
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
curl -sS -L -m 40 -A "$UA" -o jps-main.html 'https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/?state=TRG&type=NEGERI&lang=en'
curl -sS -L -m 40 -A "$UA" -o jps-rain-main.html 'https://publicinfobanjir.water.gov.my/hujan/data-hujan/?state=TRG&lang=en'
curl -sS -L -m 40 -A "$UA" -o cira.html 'https://slider.cira.colostate.edu/?sat=himawari&sec=full_disk'
echo -e "id\tstatus\txfo\tframe_ancestors\tfinal" > ../frames.tsv
while read -r id url; do
  [ -z "$id" ] && continue
  h=$(curl -sS -L -m 25 -o /dev/null -D - -w '\n__S %{http_code} %{url_effective}\n' -A "$UA" "$url" 2>&1)
  st=$(echo "$h" | grep '^__S' | tail -1)
  xfo=$(echo "$h" | grep -i '^x-frame-options:' | tail -1 | cut -d: -f2- | tr -d '\r' | xargs)
  fa=$(echo "$h" | grep -i '^content-security-policy:' | tr -d '\r' | grep -io 'frame-ancestors[^;]*' | tail -1)
  echo -e "$id\t$(echo $st | awk '{print $2}')\t${xfo:--}\t${fa:--}\t$(echo $st | awk '{print $3}')" >> ../frames.tsv
done <<'L'
ventusky-sat https://www.ventusky.com/?p=4.2;103.4;5&l=satellite
jma-himawari https://www.data.jma.go.jp/mscweb/data/himawari/sat_img.php?area=se2
jma-bosai https://www.jma.go.jp/bosai/map.html#5/4.2/103.4/&elem=ir&contents=himawari
nict-himawari https://himawari.asia/
nict-h8 https://himawari8.nict.go.jp/
rammb-slider https://rammb-slider.cira.colostate.edu/?sat=himawari&sec=full_disk
zoom-sat https://zoom.earth/maps/satellite/
eumetview https://view.eumetsat.int/productviewer
myshiptracking https://www.myshiptracking.com/?zoom=8&lat=4.23&lng=103.42
myshiptracking-embed https://www.myshiptracking.com/embed?zoom=8&lat=4.23&lng=103.42
marinetraffic https://www.marinetraffic.com/en/ais/home/centerx:103.4/centery:4.2/zoom:8
marinetraffic-embed https://www.marinetraffic.com/en/ais/embed/zoom:8/centery:4.2/centerx:103.4/maptype:4/shownames:false/mmsi:0/shipid:0/fleet:/fleet_id:/vtypes:/showmenu:/remember:false
shipxplorer https://www.shipxplorer.com/?lat=4.2&lon=103.4&zoom=8
vesseltracker https://www.vesseltracker.com/en/Map.html
gfw https://globalfishingwatch.org/map
shipfinder https://www.shipfinder.org/
balticshipping https://www.balticshipping.com/vessels
aishub https://www.aishub.net/coverage
L
cd ..; cat frames.tsv
grep -io '<select[^>]*>' s3/jps-main.html | head; grep -io '<option[^>]*>[^<]*' s3/jps-main.html | head -40; grep -io 'iframe[^>]*' s3/jps-main.html | head; grep -io "aras-air-data[^\"' ]*" s3/jps-main.html | head
grep -io '<option[^>]*>[^<]*' s3/jps-rain-main.html | head -20; grep -io "searchresultrainfall[^\"' ]*\|hujan-data[^\"' ]*" s3/jps-rain-main.html | head
