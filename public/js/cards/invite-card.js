/* =====================================================================
 * invite-card.js – EventAgent's invitation CARD (invite_card.py), ported
 * line by line to the browser. Backgrounds are the exact images exported
 * from the Python code; this file draws the text layer on top.
 *
 *   const jpegBlob = await makeCard(host, event, dateText, venue, style)
 *
 * Styles here: classic, festival, party, house, islamic, mandala, royal.
 * (floral, goldcorner, navygold, goldwash, arch, peach, toran → designs.js)
 * ===================================================================== */
import { Draw, Font, loadFont, newCanvas, loadImage, pasteDownscaled, toJpeg, pyRound, pyInt } from './pil.js';

export const W = 1024, H = 1536, SS = 2;
export const DEFAULT_GOLD = [176, 131, 47];
export const TOP = 292, BOTTOM = 1338, MAXW = 520;
const ASSETS = '/cards';

const FONT_FILES = Object.freeze({
  Cinzel: 'Cinzel[wght].ttf',
  CormorantItalic: 'CormorantGaramond-Italic[wght].ttf',
  Cormorant: 'CormorantGaramond[wght].ttf',
  GreatVibes: 'GreatVibes-Regular.ttf'
});

export const THEMES = Object.freeze({
  wedding: { kw: ['wedding', 'marriage', 'engagement', 'reception', 'nikah', 'walima', 'sangeet', 'mehendi', 'mehndi', 'haldi', 'betrothal', 'shaadi', 'vivah', 'bridal'],
    eyebrow: 'TOGETHER WITH THEIR FAMILIES', lead: 'cordially invite you to celebrate\nthis special occasion with us',
    closing: 'We look forward to celebrating\nwith you!', ink: [29, 58, 42], style: 'floral' },
  house: { kw: ['new house', 'house ceremony', 'housewarming', 'house warming', 'gruhapravesam', 'gruhapravesh', 'griha pravesh', 'grihapravesh', 'gruha pravesam', 'new home', 'home ceremony', 'house opening', 'bhoomi pooja', 'bhoomi puja'],
    eyebrow: 'YOU ARE CORDIALLY INVITED TO', lead: 'to bless our new home\nwith your presence',
    closing: 'Your blessings make\nour home complete!', ink: [22, 72, 56], style: 'toran' },
  muslim: { kw: ['eid', 'ramzan', 'ramadan', 'nikah', 'nikkah', 'walima', 'milad', 'iftar', 'aqiqah', 'aqeeqah', 'bakrid', 'bakra eid', 'muharram', 'mehfil', 'dawat', 'shab-e', 'shabe'],
    eyebrow: 'YOU ARE WARMLY INVITED TO', lead: 'to share the joy and blessings\nof this beautiful occasion',
    closing: 'Your presence and duas\nwill honour us', ink: [8, 70, 56], style: 'navygold' },
  hindu: { kw: ['kalyanam', 'pelli', 'upanayanam', 'seemantham', 'satyanarayan', 'vratham', 'vratam', 'namakaranam', 'annaprasana', 'poojalu', 'jagarana', 'bhajan'],
    eyebrow: 'WITH DIVINE BLESSINGS, YOU ARE INVITED TO', lead: 'to join us for this auspicious\noccasion',
    closing: 'Your presence and blessings\nwill make it complete', ink: [122, 24, 28], style: 'toran' },
  festival: { kw: ['bathukamma', 'batukamma', 'bonalu', 'dasara', 'dussehra', 'navaratri', 'navratri', 'diwali', 'deepavali', 'ugadi', 'sankranti', 'pongal', 'ganesh', 'vinayaka', 'holi', 'ramzan', 'ramadan', 'christmas', 'onam', 'festival', 'utsav', 'pooja', 'puja', 'jayanti'],
    eyebrow: 'YOU ARE WARMLY INVITED TO', lead: 'to celebrate the festival with\njoy, music and togetherness',
    closing: "Come, let's celebrate\ntogether!", ink: [98, 30, 40], style: 'toran' },
  party: { kw: ['birthday', 'anniversary', 'party', 'baby shower', 'get-together', 'get together', 'reunion', 'farewell', 'housewarming', 'gruhapravesam', 'naming', 'cradle', 'graduation'],
    eyebrow: "YOU'RE INVITED TO", lead: 'join us for an evening of\nlove, laughter and good times',
    closing: "Can't wait to celebrate\nwith you!", ink: [52, 40, 86], style: 'peach' },
  general: { kw: [], eyebrow: 'YOU ARE INVITED TO', lead: 'cordially invite you to join us\nfor this special occasion',
    closing: 'We look forward to\nseeing you!', ink: [29, 58, 42], style: 'goldcorner' }
});

/** card_styles.STYLES (label, gold, ink) – ink null = keep the event theme's ink. */
export const STYLES = Object.freeze({
  classic: { label: 'Classic Floral', gold: [176, 131, 47], ink: null },
  festival: { label: 'Festival', gold: [184, 134, 40], ink: [110, 22, 38] },
  party: { label: 'Party / Birthday', gold: [205, 84, 128], ink: [52, 40, 86] },
  house: { label: 'New Home', gold: [176, 128, 36], ink: [22, 72, 56] },
  islamic: { label: 'Islamic / Eid / Nikah', gold: [170, 126, 36], ink: [8, 70, 56] },
  mandala: { label: 'Hindu / Mandala', gold: [184, 130, 30], ink: [122, 24, 28] },
  royal: { label: 'Royal Navy & Gold', gold: [176, 132, 40], ink: [24, 38, 84] },
  floral: { label: 'Watercolor Floral', gold: [184, 142, 70], ink: [58, 72, 82] },
  goldcorner: { label: 'Gold Corners', gold: [190, 148, 66], ink: [38, 70, 80] },
  navygold: { label: 'Navy & Gold', gold: [216, 176, 92], ink: [244, 238, 224] },
  goldwash: { label: 'Golden Watercolor', gold: [200, 140, 40], ink: [60, 52, 46] },
  arch: { label: 'Floral Arch', gold: [180, 140, 76], ink: [76, 74, 104] },
  peach: { label: 'Peach Bloom', gold: [200, 112, 72], ink: [122, 46, 46] },
  toran: { label: 'Marigold Toran', gold: [206, 150, 40], ink: [80, 60, 44] }
});

const ORG_WORDS = ['association', 'committee', 'club', 'society', 'trust', 'team', 'group', 'foundation',
  'family', '&', ' and ', 'samithi', 'sangham', 'sabha'];

/* ───────────────────────── text rules (same as Python) ───────────────────────── */
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function themeFor(event) {
  const e = event.toLowerCase();
  for (const name of ['house', 'muslim', 'hindu', 'wedding', 'festival', 'party']) {
    const kws = THEMES[name].kw;
    const hit = (name === 'muslim' || name === 'hindu')
      ? new RegExp(`\\b(${kws.map(escapeRe).join('|')})`).test(e)
      : kws.some(k => e.includes(k));
    if (hit) return { ...THEMES[name], name };
  }
  return { ...THEMES.general, name: 'general' };
}

export function cleanText(t) {
  const out = [];
  for (const ch of String(t ?? '').normalize('NFC')) {
    const o = ch.codePointAt(0);
    if (/\s/.test(ch)) out.push(' ');
    else if (o < 32 || o === 127) continue;
    else if (o <= 0x24F || (o >= 0x2010 && o <= 0x2027) || o === 0x20B9) out.push(ch);
    else if (/[\p{L}\p{M}\p{N}]/u.test(ch)) throw new Error('card text has characters this card font cannot draw (e.g. Telugu)');
  }
  return out.join('').split(/\s+/).filter(Boolean).join(' ');
}

const TIME_RE = /(\b\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b)/i;
const stripChars = (s, chars) => {
  let a = 0, b = s.length;
  while (a < b && chars.includes(s[a])) a++;
  while (b > a && chars.includes(s[b - 1])) b--;
  return s.slice(a, b);
};

export function splitDateTime(text) {
  text = text.split(/\s+/).filter(Boolean).join(' ');
  const m = TIME_RE.exec(text);
  if (!m) return [text, ''];
  let t = m[1].toUpperCase().replace(/\./g, '');
  t = t.replace(/(\d)(AM|PM)/g, '$1 $2').replace(/\s+/g, ' ');
  let rest = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length);
  rest = rest.replace(/\b(at|@|from|onwards)\b/gi, ' ');
  rest = stripChars(stripChars(rest.split(/\s+/).filter(Boolean).join(' ').trim(), ' ,-|·@')
    .replace(/[,\-|·@]+\s*$|^\s*[,\-|·@]+/, ''), ' ,-|·@');
  return [rest || text, t];
}

export function hostLine(name) {
  const n = name.split(/\s+/).filter(Boolean).join(' ');
  return ORG_WORDS.some(w => n.toLowerCase().includes(w)) ? n : `${n} & Family`;
}

export function resolveStyle(event, style) {
  return style && STYLES[style] ? style : themeFor(event).style;
}
export const DESIGN_KEYS = ['floral', 'goldcorner', 'navygold', 'goldwash', 'arch', 'peach', 'toran'];

/* ───────────────────────── fonts ───────────────────────── */
export async function loadCardFonts() {
  await Promise.all(Object.entries(FONT_FILES).map(([family, file]) =>
    loadFont(family, `${ASSETS}/fonts/${encodeURIComponent(file)}`)));
}
const font = (family, size, weight) => new Font(family, Math.max(8, pyInt(pyRound(size * SS))), weight ?? 400);
export const cinzel = (size, w = 500) => font('Cinzel', size, w);
export const italic = (size, w = 500) => font('CormorantItalic', size, w);
export const serif = (size, w = 500) => font('Cormorant', size, w);
export const script = size => font('GreatVibes', size);

/* ───────────────────────── text helpers ───────────────────────── */
export const tw = (text, f, tr = 0) => [...text].reduce((sum, c) => sum + f.getlength(c), 0) + tr * SS * Math.max(text.length - 1, 0);

export function wrap(text, f, maxW, tr = 0) {
  const lines = [];
  let cur = '';
  text.split(/\s+/).filter(Boolean).forEach(word => {
    const trial = (cur + ' ' + word).trim();
    if (tw(trial, f, tr) <= maxW * SS || !cur) cur = trial; else { lines.push(cur); cur = word; }
  });
  if (cur) lines.push(cur);
  return lines;
}

export function put(d, cx, base, text, f, fill, tr = 0) {
  let x = cx - tw(text, f, tr) / 2;
  for (const ch of text) { d.text([x, base], ch, { font: f, fill }); x += f.getlength(ch) + tr * SS; }
}
export function putLeft(d, x, base, text, f, fill, tr = 0) {
  for (const ch of text) { d.text([x, base], ch, { font: f, fill }); x += f.getlength(ch) + tr * SS; }
}

/* ───────────────────────── ornaments & icons ───────────────────────── */
export function divider(d, cx, y, s, gold) {
  const lw = Math.max(2, pyInt(2 * SS * s));
  const half = 150 * SS * s, gap = 22 * SS * s;
  d.line([cx - half, y, cx - gap, y], { fill: gold, width: lw });
  d.line([cx + gap, y, cx + half, y], { fill: gold, width: lw });
  const r = 8 * SS * s;
  d.polygon([[cx, y - r], [cx + r, y], [cx, y + r], [cx - r, y]], { outline: gold, width: lw });
  for (const dx of [-1, 1]) {
    const rr = 2.6 * SS * s;
    d.ellipse([cx + dx * 14 * SS * s - rr, y - rr, cx + dx * 14 * SS * s + rr, y + rr], { fill: gold });
  }
}

export function icon(kind, d, cx, cy, s, gold) {
  const r = 22 * SS * s, lw = Math.max(2, pyInt(2.6 * SS * s));
  if (kind === 'date') {
    const w = r * 1.75, h = r * 1.6;
    const x0 = cx - w / 2, y0 = cy - h / 2 + r * 0.12;
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], { radius: r * 0.2, outline: gold, width: lw });
    d.line([x0, y0 + h * 0.3, x0 + w, y0 + h * 0.3], { fill: gold, width: lw });
    for (const fx of [0.28, 0.72]) d.line([x0 + w * fx, y0 - r * 0.25, x0 + w * fx, y0 + r * 0.18], { fill: gold, width: lw });
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const px = x0 + w * (0.2 + 0.3 * i), py = y0 + h * (0.5 + 0.25 * j);
      d.ellipse([px - lw * 0.7, py - lw * 0.7, px + lw * 0.7, py + lw * 0.7], { fill: gold });
    }
  } else if (kind === 'time') {
    d.ellipse([cx - r, cy - r, cx + r, cy + r], { outline: gold, width: lw });
    d.line([cx, cy, cx, cy - r * 0.62], { fill: gold, width: lw });
    d.line([cx, cy, cx + r * 0.45, cy + r * 0.3], { fill: gold, width: lw });
  } else {
    const rr = r * 0.66, top = cy - r * 0.28;
    d.arc([cx - rr, top - rr, cx + rr, top + rr], { start: 150, end: 390, fill: gold, width: lw });
    d.line([cx - rr * 0.87, top + rr * 0.5, cx, cy + r * 1.05], { fill: gold, width: lw });
    d.line([cx + rr * 0.87, top + rr * 0.5, cx, cy + r * 1.05], { fill: gold, width: lw });
    d.ellipse([cx - rr * 0.32, top - rr * 0.32, cx + rr * 0.32, top + rr * 0.32], { outline: gold, width: lw });
  }
}

/* ───────────────────────── layout (blocks of gap, height, painter) ───────────────────────── */
function layout(d, s, host, event, dateTxt, timeTxt, venue, spec, withLead, gold) {
  const ink = spec.ink;
  const B = [];
  const cx = W * SS / 2;

  // eyebrow
  let f = cinzel(23 * s, 500), tr = 4.2 * s;
  while (tw(spec.eyebrow, f, tr) > MAXW * SS && tr > 0.8) tr -= 0.4;
  { const ef = f, etr = tr; B.push([0, 30 * SS * s, y => put(d, cx, y + 24 * SS * s, spec.eyebrow, ef, ink, etr)]); }
  B.push([16 * SS * s, 26 * SS * s, y => divider(d, cx, y + 13 * SS * s, s, gold)]);

  // event name (auto-fit, max 3 lines)
  let size = 82 * s, lines;
  for (;;) {
    f = cinzel(size, 600); tr = 2.0 * s;
    lines = wrap(event.toUpperCase(), f, MAXW, tr);
    if ((lines.length <= 3 && lines.every(l => tw(l, f, tr) <= MAXW * SS)) || size <= 36 * s) break;
    size -= 3 * s;
  }
  {
    const nf = f, ntr = tr, nsize = size, nlines = lines, lh = size * SS * 1.2;
    B.push([30 * SS * s, lh * nlines.length, y => nlines.forEach((l, i) => put(d, cx, y + nsize * SS * 0.92 + i * lh, l, nf, ink, ntr))]);
  }

  // hosted by + host (script)
  B.push([22 * SS * s, 34 * SS * s, y => put(d, cx, y + 26 * SS * s, 'hosted by', italic(30 * s, 500), gold, 1.2 * s)]);
  let hs = 66 * s;
  const htxt = hostLine(host);
  while (tw(htxt, script(hs)) > MAXW * SS && hs > 40 * s) hs -= 3 * s;
  const hl = tw(htxt, script(hs)) > MAXW * SS ? wrap(htxt, script(hs), MAXW) : [htxt];
  const hf = script(hs);
  B.push([2 * SS * s, hs * SS * 1.3 * hl.length, y => hl.forEach((l, i) => put(d, cx, y + hs * SS * 0.95 + i * hs * SS * 1.25, l, hf, ink))]);
  if (withLead) {
    const lf = italic(31 * s, 500), ll = spec.lead.split('\n');
    B.push([6 * SS * s, ll.length * 40 * SS * s, y => ll.forEach((l, i) => put(d, cx, y + 30 * SS * s + i * 40 * SS * s, l, lf, ink))]);
  }
  B.push([24 * SS * s, 26 * SS * s, y => divider(d, cx, y + 13 * SS * s, s, gold)]);

  // info rows: date / time / venue
  let rows = [];
  const vfCaps = cinzel(31 * s, 500), vfNorm = serif(32 * s, 500);
  rows.push(['date', 'DATE', [[dateTxt.toUpperCase(), vfCaps, 1.4 * s]]]);
  if (timeTxt) rows.push(['time', 'TIME', [[timeTxt, vfCaps, 1.4 * s]]]);
  if (venue) {
    const comma = venue.indexOf(',');
    const head = comma < 0 ? venue : venue.slice(0, comma);
    const rest = comma < 0 ? '' : venue.slice(comma + 1);
    let vl = wrap(head.trim().toUpperCase(), vfCaps, 420, 1.4 * s).slice(0, 2).map(l => [l, vfCaps, 1.4 * s]);
    if (rest.trim()) vl = vl.concat(wrap(rest.trim(), vfNorm, 420).slice(0, 2).map(l => [l, vfNorm, 0.3 * s]));
    rows.push(['pin', 'VENUE', vl]);
  }
  rows = rows.map(([kind, label, vl]) => {
    let out = [];
    vl.forEach(([text, vf, vtr]) => {
      out = out.concat(tw(text, vf, vtr) > 420 * SS ? wrap(text, vf, 420, vtr).map(l => [l, vf, vtr]) : [[text, vf, vtr]]);
    });
    return [kind, label, out.slice(0, 4)];
  });
  const maxw = Math.max(...rows.flatMap(([, , vl]) => vl.map(([t, vf, vtr]) => tw(t, vf, vtr))));
  const group = 92 * SS * s + maxw;
  const x0 = cx - group / 2;
  rows.forEach(([kind, label, vl]) => {
    const lineH = 38 * SS * s;
    const h = 28 * SS * s + vl.length * lineH;
    B.push([20 * SS * s, h, y => {
      icon(kind, d, x0 + 26 * SS * s, y + h / 2 - 2 * SS * s, s, gold);
      d.line([x0 + 66 * SS * s, y + 2 * SS * s, x0 + 66 * SS * s, y + h - 2 * SS * s], { fill: gold, width: Math.max(2, pyInt(1.6 * SS * s)) });
      const tx = x0 + 92 * SS * s;
      putLeft(d, tx, y + 20 * SS * s, label, cinzel(19 * s, 500), gold, 3.0 * s);
      vl.forEach(([text, vf, vtr], i) => putLeft(d, tx, y + 28 * SS * s + (i + 0.78) * lineH, text, vf, ink, vtr));
    }]);
  });

  B.push([24 * SS * s, 26 * SS * s, y => divider(d, cx, y + 13 * SS * s, s, gold)]);
  const cf = italic(35 * s, 500), cl = spec.closing.split('\n');
  B.push([26 * SS * s, cl.length * 44 * SS * s, y => cl.forEach((l, i) => put(d, cx, y + 32 * SS * s + i * 44 * SS * s, l, cf, ink))]);
  return B;
}

/* ───────────────────────── make_card ───────────────────────── */
export function palette(event, style) {
  const spec = themeFor(event);
  let gold = DEFAULT_GOLD;
  if (style !== 'classic') { spec.ink = STYLES[style].ink; gold = STYLES[style].gold; }
  return [spec, gold];
}

/** Draws the card for the 7 classic-family styles and returns a canvas (1024 × 1536). */
export async function drawClassicFamily(host, event, dateText, venue, style) {
  await loadCardFonts();
  [host, event, dateText, venue] = [host, event, dateText, venue].map(cleanText);
  const [spec, gold] = palette(event, style);
  const [dateTxt, timeTxt] = splitDateTime(dateText);
  const avail = (BOTTOM - TOP) * SS;

  let overlay, d, B, total;
  for (const withLead of [true, false]) {
    let s = 1.0;
    for (;;) {
      overlay = newCanvas(W * SS, H * SS);
      d = new Draw(overlay);
      B = layout(d, s, host, event, dateTxt, timeTxt, venue, spec, withLead, gold);
      total = B.slice(1).reduce((sum, [g, h]) => sum + g + h, 0) + B[0][1];
      if (total <= avail || s <= 0.62) break;
      s -= 0.04;
    }
    if (total <= avail || !withLead) break;
  }

  const gaps = B.length - 1;
  const extra = Math.max(0, avail - total);
  const perGap = Math.min(extra / gaps, 44 * SS);
  let y = TOP * SS + (extra - perGap * gaps) / 2;
  B.forEach(([gap, h, paint], i) => {
    if (i) y += gap + perGap;
    paint(y);
    y += h;
  });

  const base = newCanvas(W, H);
  base.getContext('2d').drawImage(await loadImage(`${ASSETS}/backgrounds/${style}.jpg`), 0, 0);
  pasteDownscaled(base, overlay);
  return base;
}

/** invite_card.base_image: designs use their pass artwork (empty centre panel), the others their background. */
export const baseImageUrl = style => `${ASSETS}/${DESIGN_KEYS.includes(style) ? 'pass' : 'backgrounds'}/${style}.jpg`;

export async function makeCard(host, event, dateText, venue = '', style = null) {
  const resolved = resolveStyle(cleanText(event), style);
  if (DESIGN_KEYS.includes(resolved)) {
    const { drawDesign } = await import('./designs.js');
    return toJpeg(await drawDesign(resolved, host, event, dateText, venue));
  }
  return toJpeg(await drawClassicFamily(host, event, dateText, venue, resolved));
}
