// Persistencia local usada por los servicios mientras no se conecten a SQL Server.
// Usa localStorage y, si el navegador lo bloquea (modo privado), cae a memoria.
const _mem = {};
const store = {
  get(k, fallback) {
    const key = 'iluminados:' + k;
    try { const v = localStorage.getItem(key); if (v !== null) return JSON.parse(v); } catch (e) {}
    return key in _mem ? JSON.parse(_mem[key]) : fallback;
  },
  set(k, v) {
    const key = 'iluminados:' + k, json = JSON.stringify(v);
    _mem[key] = json;
    try { localStorage.setItem(key, json); } catch (e) {}
  },
  del(k) {
    const key = 'iluminados:' + k;
    delete _mem[key];
    try { localStorage.removeItem(key); } catch (e) {}
  }
};

const uid = prefix => prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const round2 = n => Math.round(n * 100) / 100;
const isPositiveInt = n => Number.isInteger(n) && n > 0;
const publicUser = ({ id, nombre, email, rol }) => ({ id, nombre, email, rol });

// SHA-256 con implementación propia de respaldo para contextos donde crypto.subtle no existe.
function sha256js(str) {
  const primes = [];
  for (let n = 2; primes.length < 64; n++) if (primes.every(p => n % p)) primes.push(n);
  const frac = x => Math.floor((x - Math.floor(x)) * 4294967296);
  const K = primes.map(p => frac(Math.cbrt(p)));
  const H = primes.slice(0, 8).map(p => frac(Math.sqrt(p)));
  const bytes = Array.from(unescape(encodeURIComponent(str)), c => c.charCodeAt(0));
  const bits = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bits >>> (i * 8)) & 255);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < bytes.length; o += 64) {
    const w = new Array(64);
    for (let i = 0; i < 16; i++) w[i] = (bytes[o + 4 * i] << 24 | bytes[o + 4 * i + 1] << 16 | bytes[o + 4 * i + 2] << 8 | bytes[o + 4 * i + 3]) >>> 0;
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) >>> 0; });
  }
  return H.map(v => v.toString(16).padStart(8, '0')).join('');
}

async function sha256(text) {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {}
  return sha256js(text);
}
