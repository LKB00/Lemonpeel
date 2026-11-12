// Generated artwork for simulated outputs. Deterministic per prompt + seed.

export function hash(s = '') {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const PALETTES = [
  ['#ffd97a', '#ff9a62', '#3b2753'],
  ['#a8e6ff', '#5b8cff', '#16244a'],
  ['#ffd9b0', '#ff9fa6', '#3e2a3e'],
  ['#d3f59a', '#56c28f', '#123b33'],
  ['#fff38a', '#ffc35c', '#4a3828'],
  ['#e6cbff', '#8ec5fc', '#1f2a44'],
];

export function dims(aspect) {
  return { '16:9': [640, 360], '9:16': [360, 640], '1:1': [480, 480], '4:5': [480, 600] }[aspect] || [640, 360];
}

const esc = (s) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = (s) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);

export function scene({ prompt = '', aspect = '16:9', seed = 0, tint = 0 }) {
  const [w, h] = dims(aspect);
  const r = hash(prompt + '|' + seed);
  const p = PALETTES[(r + tint) % PALETTES.length];
  const sunX = (0.15 + ((r >> 3) % 70) / 100) * w;
  const sunY = (0.14 + ((r >> 7) % 22) / 100) * h;
  const lx = (0.25 + ((r >> 11) % 50) / 100) * w;
  const ly = h * 0.7;
  const s = Math.min(w, h);
  let bokeh = '';
  for (let i = 0; i < 8; i++) {
    const v = hash(prompt + i + seed);
    bokeh += `<circle cx="${(v % 1000) / 1000 * w}" cy="${((v >> 10) % 600) / 1000 * h}" r="${4 + (v >> 20) % 18}" fill="#fff" opacity="${0.06 + ((v >> 5) % 10) / 80}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset=".6" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient>
<radialGradient id="l" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff7c2"/><stop offset=".5" stop-color="#fad406"/><stop offset="1" stop-color="#c08f00"/></radialGradient>
<linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5a32"/><stop offset="1" stop-color="#4a2e18"/></linearGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<circle cx="${sunX}" cy="${sunY}" r="${s * 0.12}" fill="#fff" opacity=".55"/>
<circle cx="${sunX}" cy="${sunY}" r="${s * 0.22}" fill="#fff" opacity=".12"/>
${bokeh}
<rect y="${h * 0.66}" width="${w}" height="${h * 0.34}" fill="url(#t)"/>
<g stroke="#2e1c0e" stroke-opacity=".35" stroke-width="2"><line x1="0" y1="${h * 0.76}" x2="${w}" y2="${h * 0.76}"/><line x1="0" y1="${h * 0.87}" x2="${w}" y2="${h * 0.87}"/></g>
<ellipse cx="${lx + s * 0.02}" cy="${ly + s * 0.07}" rx="${s * 0.13}" ry="${s * 0.025}" fill="#000" opacity=".28"/>
<ellipse cx="${lx}" cy="${ly}" rx="${s * 0.12}" ry="${s * 0.085}" fill="url(#l)" transform="rotate(${(r % 40) - 20} ${lx} ${ly})"/>
<path d="M${lx + s * 0.08} ${ly - s * 0.07} q ${s * 0.06} ${-s * 0.05} ${s * 0.1} ${-s * 0.01} q ${-s * 0.05} ${s * 0.04} ${-s * 0.1} ${s * 0.01}z" fill="#4caf50"/>
</svg>`;
  return enc(svg);
}

function tee() {
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#ece7db"/>
<defs><clipPath id="c"><path d="M130 70 L165 55 Q200 85 235 55 L270 70 L330 120 L295 160 L270 140 L270 340 L130 340 L130 140 L105 160 L70 120 Z"/></clipPath></defs>
<g clip-path="url(#c)"><rect width="400" height="400" fill="#f8f6f0"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `<rect y="${70 + i * 28}" width="400" height="12" fill="#1d1c17"/>`).join('')}</g>
<path d="M130 70 L165 55 Q200 85 235 55 L270 70 L330 120 L295 160 L270 140 L270 340 L130 340 L130 140 L105 160 L70 120 Z" fill="none" stroke="#1d1c17" stroke-opacity=".25" stroke-width="2"/></svg>`);
}
function bottle() {
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#fff4c9"/>
<ellipse cx="200" cy="350" rx="80" ry="12" fill="#000" opacity=".12"/>
<path d="M180 60 h40 v50 q40 30 40 80 v150 q0 15 -15 15 h-90 q-15 0 -15 -15 v-150 q0 -50 40 -80z" fill="#f7d02c" stroke="#c08f00" stroke-width="3"/>
<rect x="176" y="44" width="48" height="22" rx="4" fill="#1d1c17"/>
<rect x="150" y="200" width="100" height="70" rx="8" fill="#fff"/><text x="200" y="232" font-family="Inter,Arial" font-size="16" font-weight="700" text-anchor="middle" fill="#1d1c17">LEMON</text><text x="200" y="254" font-family="Inter,Arial" font-size="12" text-anchor="middle" fill="#1d1c17">sparkling</text></svg>`);
}
function face(bg, skin, hair, shirt) {
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${bg}"/>
<path d="M90 400 q20 -110 110 -110 q90 0 110 110z" fill="${shirt}"/>
<rect x="178" y="230" width="44" height="60" fill="${skin}"/>
<ellipse cx="200" cy="175" rx="72" ry="86" fill="${skin}"/>
<path d="M126 170 q0 -100 74 -100 q78 0 76 100 q-20 -50 -76 -52 q-54 2 -74 52z" fill="${hair}"/>
<circle cx="174" cy="180" r="6" fill="#1d1c17"/><circle cx="226" cy="180" r="6" fill="#1d1c17"/>
<path d="M180 222 q20 14 40 0" stroke="#1d1c17" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`);
}

function logoMark(bg, fg, word) {
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${bg}"/>
<circle cx="200" cy="170" r="54" fill="${fg}"/><text x="200" y="290" font-family="Inter,Arial" font-size="40" font-weight="700" text-anchor="middle" fill="${bg === '#111316' ? '#f5f5f5' : '#111316'}" letter-spacing="-1">${esc(word)}</text></svg>`);
}

/* Asset library. type decides which inputs an asset can feed; cat groups it inside its type.
   source: 'library' (stock), 'upload' (yours) or 'generated' (saved from the canvas). */
export const ASSET_TYPES = {
  image: { label: 'Images', cats: ['Products', 'Characters', 'Scenes', 'Logos'] },
  video: { label: 'Video', cats: ['Product clips', 'B-roll'] },
  audio: { label: 'Audio', cats: ['Voice-overs', 'Music', 'Sound effects'] },
};
export const ASSETS = [
  { id: 'tee', type: 'image', cat: 'Products', name: 'Striped tee', aspect: '1:1', source: 'library', url: tee() },
  { id: 'soda', type: 'image', cat: 'Products', name: 'Lemon soda', aspect: '1:1', source: 'library', url: bottle() },
  { id: 'aiko', type: 'image', cat: 'Characters', name: 'Aiko Tanaka', aspect: '1:1', source: 'library', url: face('#2c3e57', '#f1c9a5', '#1b1b1b', '#f7d02c') },
  { id: 'aarav', type: 'image', cat: 'Characters', name: 'Aarav Malhotra', aspect: '1:1', source: 'library', url: face('#4a2f2a', '#c68d63', '#2a1a12', '#e9e4d8') },
  { id: 'kitchen', type: 'image', cat: 'Scenes', name: 'Morning kitchen', aspect: '16:9', source: 'library', url: scene({ prompt: 'morning kitchen counter', aspect: '16:9', seed: 11 }) },
  { id: 'beach', type: 'image', cat: 'Scenes', name: 'Beach at noon', aspect: '9:16', source: 'library', url: scene({ prompt: 'beach at noon summer', aspect: '9:16', seed: 23 }) },
  { id: 'logo-lp', type: 'image', cat: 'Logos', name: 'Lemonpeel logo', aspect: '1:1', source: 'library', url: logoMark('#111316', '#fad406', 'Lemonpeel') },
  { id: 'v-pour', type: 'video', cat: 'Product clips', name: 'Soda pour', aspect: '9:16', secs: 6, source: 'library', url: scene({ prompt: 'soda pour close up', aspect: '9:16', seed: 41 }) },
  { id: 'v-unbox', type: 'video', cat: 'Product clips', name: 'Tee unboxing', aspect: '1:1', secs: 8, source: 'library', url: scene({ prompt: 'unboxing tee table', aspect: '1:1', seed: 52 }) },
  { id: 'v-beach', type: 'video', cat: 'B-roll', name: 'Beach b-roll', aspect: '16:9', secs: 10, source: 'library', url: scene({ prompt: 'beach waves b-roll', aspect: '16:9', seed: 63 }) },
  { id: 'a-vo-aiko', type: 'audio', cat: 'Voice-overs', name: 'Aiko, warm narrator', secs: 12, seed: 7, source: 'library' },
  { id: 'a-vo-calm', type: 'audio', cat: 'Voice-overs', name: 'Calm male narrator', secs: 9, seed: 13, source: 'library' },
  { id: 'a-pop', type: 'audio', cat: 'Music', name: 'Summer pop loop', secs: 30, seed: 21, source: 'library' },
  { id: 'a-lofi', type: 'audio', cat: 'Music', name: 'Lo-fi bed', secs: 45, seed: 34, source: 'library' },
  { id: 'a-fizz', type: 'audio', cat: 'Sound effects', name: 'Can opening fizz', secs: 2, seed: 55, source: 'library' },
  { id: 'a-whoosh', type: 'audio', cat: 'Sound effects', name: 'Whoosh', secs: 1, seed: 89, source: 'library' },
  { id: 'a-ice', type: 'audio', cat: 'Sound effects', name: 'Ice clink', secs: 1, seed: 144, source: 'library' },
];
export const assetById = (id) => ASSETS.find((a) => a.id === id) || ASSETS[0];

export function waveBars(seed, n = 48) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const v = hash(String(seed) + i);
    out.push(0.18 + ((v % 100) / 100) * 0.82 * (0.55 + 0.45 * Math.sin(i / 4)));
  }
  return out;
}
