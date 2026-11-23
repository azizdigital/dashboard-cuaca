/* probe: open the live OceanWATCH page with the redesigned Weather / Vessels files (mockup only, nothing is saved to the app) */
(async () => {
  const base = 'https://raw.githubusercontent.com/azizdigital/dashboard-cuaca/' + window.__OWREV + '/preview/ow2/';
  const get = f => fetch(base + f, { cache: 'no-store' }).then(r => r.text());
  const [css, coast, marine, page] = await Promise.all([get('edition.css'), get('coast-east.js'), get('marine.js'), fetch(location.href, { cache: 'no-store' }).then(r => r.text())]);
  const esc = t => t.replace(/<\/script/gi, '<\\/script');
  let h = page.replace(/<link[^>]+edition\.css[^>]*>/, '<style>' + css + '</style>')
    .replace(/<script src="assets\/js\/marine\.js"><\/script>/, '<script>' + esc(coast) + '<\/script><script>' + esc(marine) + '<\/script>');
  document.open(); document.write(h); document.close();
})();
