/* OIM Wazira - small offline QR code encoder (byte mode, error correction level M, versions 1-10).
   Usage: OIMQR.svg('https://192.168.0.10:34696/', { size: 220, dark: '#000', light: '#fff' }) -> SVG markup string
          OIMQR.matrix(text) -> array of rows of booleans (true = dark module) */
(function (root) {
  'use strict';

  /* [total codewords per block, data codewords per block, number of blocks] groups for level M */
  var BLOCKS = {
    1: [[26, 16, 1]], 2: [[44, 28, 1]], 3: [[70, 44, 1]], 4: [[50, 32, 2]], 5: [[67, 43, 2]],
    6: [[43, 27, 4]], 7: [[49, 31, 4]], 8: [[60, 38, 2], [61, 39, 2]], 9: [[58, 36, 3], [59, 37, 2]],
    10: [[69, 43, 4], [70, 44, 1]]
  };
  var ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };

  /* Galois field GF(256), primitive polynomial 0x11d */
  var EXP = new Array(512), LOG = new Array(256);
  (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  function gmul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }
  function rsGenerator(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var next = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= gmul(g[j], EXP[i]); }
      g = next;
    }
    return g;
  }
  function rsRemainder(data, n) {
    var gen = rsGenerator(n), res = data.concat(new Array(n).fill(0));
    for (var i = 0; i < data.length; i++) {
      var c = res[i];
      if (c !== 0) for (var j = 0; j < gen.length; j++) res[i + j] ^= gmul(gen[j], c);
    }
    return res.slice(data.length);
  }

  function utf8(text) {
    var out = [], s = unescape(encodeURIComponent(String(text)));
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }
  function dataCapacity(v) { return BLOCKS[v].reduce(function (a, g) { return a + g[1] * g[2]; }, 0); }

  function encodeData(bytes, v) {
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4);                                  // byte mode
    put(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    var cap = dataCapacity(v) * 8;
    put(0, Math.min(4, cap - bits.length));     // terminator
    while (bits.length % 8) bits.push(0);
    var words = [];
    for (var i = 0; i < bits.length; i += 8) { var w = 0; for (var k = 0; k < 8; k++) w = (w << 1) | bits[i + k]; words.push(w); }
    for (var pad = 0; words.length < dataCapacity(v); pad++) words.push(pad % 2 ? 0x11 : 0xec);
    /* split into blocks, add error correction, interleave */
    var blocks = [], ecBlocks = [], pos = 0;
    BLOCKS[v].forEach(function (g) {
      for (var b = 0; b < g[2]; b++) {
        var d = words.slice(pos, pos + g[1]); pos += g[1];
        blocks.push(d); ecBlocks.push(rsRemainder(d, g[0] - g[1]));
      }
    });
    var out = [], maxD = Math.max.apply(null, blocks.map(function (b) { return b.length; }));
    for (i = 0; i < maxD; i++) blocks.forEach(function (b) { if (i < b.length) out.push(b[i]); });
    for (i = 0; i < ecBlocks[0].length; i++) ecBlocks.forEach(function (b) { out.push(b[i]); });
    return out;
  }

  function bch(value, poly, polyBits) {
    var v = value << (polyBits - 1);
    for (var i = 31; i >= polyBits - 1; i--) if ((v >>> i) & 1) v ^= poly << (i - polyBits + 1);
    return v;
  }

  function build(codewords, v, mask) {
    var size = 17 + 4 * v, m = [], fn = [];
    for (var r = 0; r < size; r++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function set(r, c, val) { m[r][c] = !!val; fn[r][c] = true; }
    function finder(r0, c0) {
      for (var r = -1; r <= 7; r++) for (var c = -1; c <= 7; c++) {
        var rr = r0 + r, cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        var on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        set(rr, cc, on);
      }
    }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
    for (var i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    var al = ALIGN[v];
    al.forEach(function (ar) {
      al.forEach(function (ac) {
        if ((ar === 6 && ac === 6) || (ar === 6 && ac === al[al.length - 1]) || (ar === al[al.length - 1] && ac === 6)) return;
        for (var r = -2; r <= 2; r++) for (var c = -2; c <= 2; c++) set(ar + r, ac + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
      });
    });
    set(size - 8, 8, true); // dark module
    /* reserve format areas */
    for (i = 0; i < 9; i++) { if (!fn[8][i]) set(8, i, false); if (!fn[i][8]) set(i, 8, false); }
    for (i = 0; i < 8; i++) { set(8, size - 1 - i, false); set(size - 1 - i, 8, false); }
    if (v >= 7) {
      var vi = (v << 12) | bch(v, 0x1f25, 13);
      for (i = 0; i < 18; i++) {
        var bit = (vi >>> i) & 1, a = Math.floor(i / 3), b = size - 11 + (i % 3);
        set(a, b, bit); set(b, a, bit);
      }
    }
    /* data placement */
    var bitIdx = 0, total = codewords.length * 8, up = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col = 5;
      for (var n = 0; n < size; n++) {
        var row = up ? size - 1 - n : n;
        for (var k = 0; k < 2; k++) {
          var cc = col - k;
          if (fn[row][cc]) continue;
          var dark = bitIdx < total ? ((codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) === 1 : false;
          bitIdx++;
          if (maskFn(mask, row, cc)) dark = !dark;
          m[row][cc] = dark;
        }
      }
      up = !up;
    }
    /* format information (level M = 00) */
    var fmt = mask;
    fmt = ((fmt << 10) | bch(fmt, 0x537, 11)) ^ 0x5412;
    placeFormat(m, size, fmt);
    return m;
  }

  /* standard format-bit placement */
  function placeFormat(m, size, fmt) {
    function bit(i) { return ((fmt >>> i) & 1) === 1; }
    for (var i = 0; i <= 5; i++) m[i][8] = bit(i);
    m[7][8] = bit(6); m[8][8] = bit(7); m[8][7] = bit(8);
    for (i = 9; i < 15; i++) m[8][14 - i] = bit(i);
    for (i = 0; i < 8; i++) m[8][size - 1 - i] = bit(i);
    for (i = 8; i < 15; i++) m[size - 15 + i][8] = bit(i);
    m[size - 8][8] = true;
  }

  function maskFn(k, r, c) {
    switch (k) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return (r * c) % 2 + (r * c) % 3 === 0;
      case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
      default: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
    }
  }

  function penalty(m) {
    var size = m.length, p = 0, r, c, run, i;
    for (var pass = 0; pass < 2; pass++) {
      for (r = 0; r < size; r++) {
        run = 1;
        for (c = 1; c < size; c++) {
          var a = pass ? m[c][r] : m[r][c], b = pass ? m[c - 1][r] : m[r][c - 1];
          if (a === b) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
        }
      }
    }
    for (r = 0; r < size - 1; r++) for (c = 0; c < size - 1; c++) {
      var x = m[r][c];
      if (x === m[r][c + 1] && x === m[r + 1][c] && x === m[r + 1][c + 1]) p += 3;
    }
    var pat1 = [true, false, true, true, true, false, true, false, false, false, false];
    var pat2 = pat1.slice().reverse();
    for (r = 0; r < size; r++) for (c = 0; c <= size - 11; c++) {
      var h1 = true, h2 = true, v1 = true, v2 = true;
      for (i = 0; i < 11; i++) {
        if (m[r][c + i] !== pat1[i]) h1 = false;
        if (m[r][c + i] !== pat2[i]) h2 = false;
        if (m[c + i][r] !== pat1[i]) v1 = false;
        if (m[c + i][r] !== pat2[i]) v2 = false;
      }
      p += 40 * ((h1 ? 1 : 0) + (h2 ? 1 : 0) + (v1 ? 1 : 0) + (v2 ? 1 : 0));
    }
    var dark = 0;
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (m[r][c]) dark++;
    p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    return p;
  }

  function matrix(text) {
    var bytes = utf8(text), v = 1;
    while (v <= 10 && dataCapacity(v) < bytes.length + (v < 10 ? 2 : 3)) v++;
    if (v > 10) throw new Error('QR: text too long');
    var cw = encodeData(bytes, v), best = null, bestP = Infinity;
    for (var mk = 0; mk < 8; mk++) {
      var mm = build(cw, v, mk), pp = penalty(mm);
      if (pp < bestP) { bestP = pp; best = mm; }
    }
    return best;
  }

  function svg(text, opt) {
    opt = opt || {};
    var m = matrix(text), n = m.length, q = 4, dim = n + q * 2, d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (m[r][c]) d += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z';
    var size = opt.size || 220;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim + '" width="' + size + '" height="' + size +
      '" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="' + (opt.light || '#fff') +
      '"/><path d="' + d + '" fill="' + (opt.dark || '#000') + '"/></svg>';
  }

  var api = { matrix: matrix, svg: svg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OIMQR = api;
})(typeof self !== 'undefined' ? self : this);
