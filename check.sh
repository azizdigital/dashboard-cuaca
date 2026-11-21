#!/bin/bash
# run the new mirror (with Kemaman 5-minute data) against the real JPS, twice (second = incremental)
rm -rf s8; mkdir -p s8
node --version
s=$(date +%s); GITHUB_REPOSITORY=azizdigital/dashboard-cuaca node mt/mirror/mirror.js s8/run1 > s8/run1.log 2>&1; e=$(date +%s); echo "== run1 $((e-s))s"; tail -c 1500 s8/run1.log
du -sh s8/run1/kemaman; ls s8/run1/kemaman | head -40
cd s8 && python3 - <<'PY'
import json,glob
n=json.load(open('run1/kemaman/now.json'))
print('end', n['end'], 'water', len(n['water']), 'rain', len(n['rain']))
for w in n['water']:
    s=[v for v in w['s'] if v is not None]; print('WL', w['name'], w['gid'], w.get('level'), len(s), s[-3:] if s else None)
for r in n['rain']:
    h=[v for v in r['h'] if v is not None]; print('RF', r['name'], r['gid'], len(h), sum(h), r['m'][-6:])
for k,m in n['files'].items():
    if m.get('err'): print('ERR', k, m)
for f in sorted(glob.glob('run1/kemaman/wl-*.json'))[:3]:
    d=json.load(open(f)); s=d['s']; first=next((i for i,v in enumerate(s) if v is not None),None); print(f, len(s), 'first', first, 'nulls', sum(1 for v in s if v is None))
PY
cd ..
# keep only now.json + two files, small
mkdir -p s8/keep && cp s8/run1/kemaman/now.json s8/keep/ && cp $(ls s8/run1/kemaman/wl-*.json | head -1) $(ls s8/run1/kemaman/rf-*.json | head -1) s8/keep/ && cp s8/run1/status.json s8/keep/
rm -rf s8/run1
