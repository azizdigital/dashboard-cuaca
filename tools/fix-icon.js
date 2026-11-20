'use strict';
/* Clears the Windows icon cache, for when the taskbar keeps showing the blue Electron atom instead of the app logo.
   This is a Windows cache (Explorer), not an Electron one.
   Usage: close Dashboard Cuaca Aziz, then   npm run fix-icon
   What it does (the same as doing it by hand):
     1. stops Explorer (the taskbar and desktop disappear for a few seconds - normal)
     2. deletes the icon cache files: %LOCALAPPDATA%\IconCache.db and %LOCALAPPDATA%\Microsoft\Windows\Explorer\iconcache_*.db
        (Windows rebuilds them by itself; no personal files are touched)
     3. starts Explorer again */
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
if (process.platform !== 'win32') { console.log('Windows only - nothing to do here.'); process.exit(0); }

const sh = c => { try { execSync(c, { stdio: 'ignore' }); return true; } catch (e) { return false; } };
const local = process.env.LOCALAPPDATA;
console.log('1/3  Stopping Explorer (taskbar will disappear for a moment) / Menghentikan Explorer (taskbar hilang sekejap)...');
sh('taskkill /f /im explorer.exe');
sh('timeout /t 2 /nobreak');

console.log('2/3  Deleting icon cache / Memadam cache ikon...');
let n = 0;
const del = f => { try { fs.unlinkSync(f); n++; } catch (e) { /* in use or missing */ } };
if (local) {
  del(path.join(local, 'IconCache.db'));
  const dir = path.join(local, 'Microsoft', 'Windows', 'Explorer');
  try { fs.readdirSync(dir).filter(f => /^(iconcache|thumbcache)_.*\.db$/i.test(f)).forEach(f => del(path.join(dir, f))); } catch (e) { /* */ }
}
sh('ie4uinit.exe -show');
sh('ie4uinit.exe -ClearIconCache');

console.log('3/3  Starting Explorer again / Memulakan semula Explorer...');
spawn('explorer.exe', [], { detached: true, stdio: 'ignore' }).unref();
console.log('\nDone: ' + n + ' cache file(s) deleted. / Selesai: ' + n + ' fail cache dipadam.');
console.log('Now run / Sekarang jalankan:  npm start');
console.log('If the Electron icon still shows, restart Windows once. / Jika ikon Electron masih muncul, restart Windows sekali.');
