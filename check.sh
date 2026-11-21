#!/bin/bash
mkdir -p s9; cd s9
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
Q='https://publicinfobanjir.water.gov.my/wp-content/themes/enlighten/query'
for g in 27192 4234109_ 25822 TKMN0007; do
  curl -sS -L -m 90 -A "$UA" -o rf-$g.json "$Q/searchresultrainfalldthourlylead.php?extra=&station=$g&from=19/11/2026%2000:00&to=20/11/2026%2000:00&datafreq=60"
  echo "== $g $(wc -c < rf-$g.json)"
done
python3 - <<'PY'
import json
for g in ['27192','4234109_','25822','TKMN0007']:
    s=open('rf-'+g+'.json').read(); a=s.find('{"info"') if '{"info"' in s else s.find('{')
    try: d=json.loads(s[a:s.rfind('}')+1])
    except Exception as e: print(g,'bad',e); continue
    v=d['values']; print('##',g,d['info'],len(v))
    nz=[x for x in v if any((x.get(k) or 0)!=0 for k in ('raw','clean','chourly','c15min'))]
    for x in nz[:40]: print('  ',x)
    print('   sum clean',sum(float(x.get('clean') or 0) for x in v),'max cdaily',max(float(x.get('cdaily') or 0) for x in v), 'last', v[-1])
PY
cd ..
