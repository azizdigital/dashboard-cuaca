#!/bin/bash
# For each URL: final HTTP status, X-Frame-Options, CSP frame-ancestors, CORS header. Origin header set to the app's.
out=result.tsv; echo -e "id\tstatus\tseconds\txfo\tframe_ancestors\tacao\tfinal_url" > $out
while read -r id url; do
  [ -z "$id" ] && continue
  h=$(curl -sS -L -m 25 -o /dev/null -D - -w '\n__S %{http_code} %{time_total} %{url_effective}\n' -H 'Origin: https://azizdigital.github.io' -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' "$url" 2>&1)
  st=$(echo "$h" | grep '^__S' | tail -1)
  code=$(echo "$st" | awk '{print $2}'); t=$(echo "$st" | awk '{print $3}'); fin=$(echo "$st" | awk '{print $4}')
  [ -z "$code" ] && code="ERR:$(echo "$h" | grep -i 'curl:' | head -1 | cut -c1-60)"
  xfo=$(echo "$h" | grep -i '^x-frame-options:' | tail -1 | cut -d: -f2- | tr -d '\r' | xargs)
  fa=$(echo "$h" | grep -i '^content-security-policy:' | tr -d '\r' | grep -io 'frame-ancestors[^;]*' | tail -1)
  ac=$(echo "$h" | grep -i '^access-control-allow-origin:' | tail -1 | cut -d: -f2- | tr -d '\r' | xargs)
  echo -e "$id\t$code\t$t\t${xfo:--}\t${fa:--}\t${ac:--}\t$fin" >> $out
done < urls.txt
cat $out
