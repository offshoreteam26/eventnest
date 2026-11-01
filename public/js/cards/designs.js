/* =====================================================================
 * designs.js – EventAgent's 7 "elegant" card designs (card_designs.py),
 * ported line by line: floral, goldcorner, navygold, goldwash, arch, peach, toran.
 *
 * The artwork is the exact image exported from the Python code
 * (cards/backgrounds/<style>.jpg); this file draws the same text layout.
 * Coordinates are 1x px like the Python file; T() scales by SS.
 * ===================================================================== */
import { Draw, Font, loadFont, newCanvas, loadImage, pasteDownscaled, pyRound, pyInt } from './pil.js';
import { cleanText, themeFor, splitDateTime, hostLine } from './invite-card.js';

const SS = 2, W = 1024, H = 1536;
const ASSETS = '/cards';

const FONT_FILES = Object.freeze({
  Montserrat: 'Montserrat[wght].ttf', Cinzel: 'Cinzel[wght].ttf', Cormorant: 'CormorantGaramond[wght].ttf',
  CormorantItalic: 'CormorantGaramond-Italic[wght].ttf', GreatVibes: 'GreatVibes-Regular.ttf', Allura: 'Allura-Regular.ttf'
});
async function loadFonts() {
  await Promise.all(Object.entries(FONT_FILES).map(([f, file]) => loadFont(f, `${ASSETS}/fonts/${encodeURIComponent(file)}`)));
}

/* ---------- fonts (size in 1x px, like the Python helpers) ---------- */
const font = (family, size, w = 400) => new Font(family, Math.max(8, pyInt(pyRound(size * SS))), w);
const montserrat = (s, w = 600) => font('Montserrat', s, w);
const cinzel = (s, w = 600) => font('Cinzel', s, w);
const corm = (s, w = 600) => font('Cormorant', s, w);
const cormI = (s, w = 500) => font('CormorantItalic', s, w);
const vibes = s => font('GreatVibes', s);
const allura = s => font('Allura', s);

/* ---------- text helpers (1x px) ---------- */
function tw(text, f, tr = 0) {
  if (!text) return 0;
  const base = !tr ? f.getlength(text) : [...text].reduce((s, c) => s + f.getlength(c), 0);
  return base / SS + tr * (text.length - 1);
}

function T(d, x, y, text, f, fill, tr = 0, al = 'l') {
  const w = tw(text, f, tr);
  const x0 = x - (al === 'c' ? w / 2 : al === 'r' ? w : 0);
  if (!tr) { d.text([x0 * SS, y * SS], text, { font: f, fill }); return; }
  let cx = x0 * SS;
  for (const ch of text) { d.text([cx, y * SS], ch, { font: f, fill }); cx += f.getlength(ch) + tr * SS; }
}

function wrap(text, f, maxw, tr = 0) {
  const lines = [];
  let cur = '';
  text.split(/\s+/).filter(Boolean).forEach(word => {
    const trial = (cur + ' ' + word).trim();
    if (tw(trial, f, tr) <= maxw || !cur) cur = trial; else { lines.push(cur); cur = word; }
  });
  if (cur) lines.push(cur);
  return lines;
}

/** Biggest size (start..minimum) so the text fits maxw in at most maxLines → [lines, size, font] */
function fit(text, fontfn, maxw, maxLines, start, minimum, step = 4, tr = 0) {
  let size = start;
  for (;;) {
    const f = fontfn(size);
    const lines = wrap(text, f, maxw, tr);
    if ((lines.length <= maxLines && lines.every(l => tw(l, f, tr) <= maxw)) || size <= minimum) return [lines.slice(0, maxLines), size, f];
    size -= step;
  }
}

function venueParts(venue) {
  const v = venue || '', i = v.indexOf(',');
  return i < 0 ? [v.trim(), ''] : [v.slice(0, i).trim(), v.slice(i + 1).trim()];
}

/* ---------- ornaments ---------- */
function diamond(d, cx, cy, r, { fill, outline, w = 2 }) {
  [cx, cy, r] = [cx * SS, cy * SS, r * SS];
  d.polygon([[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]], { fill, outline, width: pyInt(w * SS) });
}
function divider(d, cx, y, col, half = 120, gap = 16, w = 2) {
  d.line([(cx - half) * SS, y * SS, (cx - gap) * SS, y * SS], { fill: col, width: pyInt(w * SS) });
  d.line([(cx + gap) * SS, y * SS, (cx + half) * SS, y * SS], { fill: col, width: pyInt(w * SS) });
  diamond(d, cx, y, 6, { outline: col, w });
}

function distribute(blocks, top, bottom, maxGap = 60) {
  const total = blocks.reduce((s, [h]) => s + h, 0);
  const n = blocks.length;
  const gap = Math.min((bottom - top - total) / Math.max(n - 1, 1), maxGap);
  let y = top + ((bottom - top) - (total + gap * (n - 1))) / 2;
  for (const [h, paint] of blocks) { paint(y); y += h + gap; }
}

/* ---------- per-design text settings (CFG) ---------- */
const GOLD = [190, 148, 66], GOLD_N = [216, 176, 92];
export const CFG = Object.freeze({
  floral: { ink: [58, 72, 82], acc: [184, 142, 70], maxw: 580, region: [280, 1305, 62],
    eb: [s => corm(s, 600), 27, 6, [110, 120, 128]],
    title: { fn: allura, start: 180, min: 80, color: [52, 66, 78], lh: 0.98, asc: 0.8, pad: 36 },
    host: { fn: s => cormI(s, 600), start: 60, min: 38, color: [58, 72, 82], label: 'hosted by', labCol: [150, 120, 70] },
    det: [s => corm(s, 700), 34, 3, [176, 132, 56]] },
  goldcorner: { ink: [38, 70, 80], acc: GOLD, maxw: 600, region: [250, 1290, 66],
    eb: [s => cinzel(s, 600), 23, 5, GOLD],
    title: { fn: s => corm(s, 600), upper: true, start: 140, min: 60, tr: 6, color: [30, 62, 72], lh: 1.05, asc: 0.8, pad: 14 },
    host: { fn: s => cormI(s, 600), start: 60, min: 38, color: [38, 70, 80], label: 'hosted by', labCol: GOLD },
    det: [s => cinzel(s, 700), 32, 3, GOLD] },
  navygold: { ink: [244, 238, 224], acc: GOLD_N, maxw: 600, region: [260, 1290, 62],
    eb: [s => corm(s, 600), 27, 6, GOLD_N],
    title: { fn: allura, start: 180, min: 80, color: [255, 255, 255], lh: 0.98, asc: 0.8, pad: 36 },
    host: { fn: s => cormI(s, 600), start: 60, min: 38, color: GOLD_N, label: null },
    det: [s => corm(s, 700), 35, 3, GOLD_N] },
  goldwash: { ink: [60, 52, 46], acc: [200, 140, 40], maxw: 600, region: [335, 1262, 62],
    eb: [s => cormI(s, 600), 36, 2, [190, 128, 36]], ebUpper: false,
    title: { fn: vibes, start: 190, min: 80, color: [46, 40, 36], lh: 0.98, asc: 0.8, pad: 36 },
    host: { fn: s => corm(s, 600), start: 46, min: 30, color: [60, 52, 46], tr: 3, label: null },
    det: [s => corm(s, 700), 35, 3, [190, 128, 36]] },
  arch: { ink: [76, 74, 104], acc: [180, 140, 76], maxw: 520, region: [250, 1275, 58],
    eb: [s => montserrat(s, 500), 20, 6, [110, 108, 140]],
    title: { fn: s => cinzel(s, 500), upper: true, start: 100, min: 44, tr: 6, color: [84, 84, 116], lh: 1.12, asc: 0.82, pad: 14, maxw: 540 },
    host: { fn: s => cormI(s, 600), start: 54, min: 34, color: [76, 74, 104], label: 'hosted by', labCol: [180, 140, 76] },
    det: [s => montserrat(s, 600), 23, 4, [150, 112, 52]] },
  peach: { ink: [122, 46, 46], acc: [200, 112, 72], maxw: 600, region: [255, 1285, 62],
    eb: [s => corm(s, 700), 28, 6, [150, 60, 56]],
    title: { fn: allura, start: 180, min: 80, color: [130, 42, 44], lh: 0.98, asc: 0.8, pad: 36 },
    host: { fn: s => corm(s, 700), start: 46, min: 30, color: [122, 46, 46], tr: 3, label: null },
    det: [s => corm(s, 700), 35, 3, [158, 62, 52]] },
  toran: { ink: [80, 60, 44], acc: [206, 150, 40], maxw: 560, region: [280, 1290, 62],
    eb: [s => corm(s, 700), 27, 6, [30, 120, 134]],
    title: { fn: allura, start: 180, min: 80, color: [24, 136, 154], lh: 0.98, asc: 0.8, pad: 36 },
    host: { fn: s => corm(s, 700), start: 46, min: 30, color: [80, 60, 44], tr: 3, label: null },
    det: [s => corm(s, 700), 35, 3, [190, 128, 30]] }
});
export const DESIGNS = Object.keys(CFG);

/* ---------- the shared text layout (_blocks) ---------- */
function blocks(d, c, cfg, tscale, withLead) {
  const cx = W / 2;
  const maxw = cfg.maxw ?? 640;
  const { ink, acc } = cfg;
  const B = [];

  // eyebrow + ornament
  let [fn, sz, tr, col] = cfg.eb;
  const eb = cfg.ebUpper === false ? c.eyebrow : c.eyebrow.toUpperCase();
  let f = fn(sz);
  while (tw(eb, f, tr) > maxw + 80 && tr > 0.5) tr -= 0.5;
  while (tw(eb, f, tr) > maxw + 80 && sz > 12) { sz -= 1; f = fn(sz); }
  { const ef = f, etr = tr, esz = sz; B.push([esz + 8, y => T(d, cx, y + esz, eb, ef, col, etr, 'c')]); }
  B.push([22, y => divider(d, cx, y + 11, acc)]);

  // title (never drops words: gets smaller / uses up to 5 lines instead)
  const t = cfg.title;
  const ttxt = t.upper ? c.event.toUpperCase() : c.event;
  const [tl, ts, tf] = fit(ttxt, t.fn, t.maxw ?? maxw, 5, pyInt(t.start * tscale), Math.max(30, pyInt(t.min * tscale * 0.7)), 4, t.tr ?? 0);
  const tlh = ts * (t.lh ?? 1.0);
  B.push([tlh * tl.length + (t.pad ?? 8) * Math.min(1.0, tscale + 0.3),
    y => tl.forEach((l, i) => T(d, cx, y + ts * (t.asc ?? 0.85) + i * tlh, l, tf, t.color, t.tr ?? 0, 'c'))]);

  // host
  const h = cfg.host;
  const [hl, hs, hf] = fit(c.host, h.fn, maxw, 2, pyInt(h.start * Math.min(1.0, tscale + 0.2)), h.min - 6, 3);
  const lab = h.label;
  const hh = (lab ? 30 : 0) + hs * 1.18 * hl.length;
  B.push([hh, y => {
    let yy = y;
    if (lab) { T(d, cx, y + 20, lab, cormI(26, 500), h.labCol ?? acc, 1, 'c'); yy += 30; }
    hl.forEach((l, i) => T(d, cx, yy + hs * 0.85 + i * hs * 1.18, l, hf, h.color, h.tr ?? 0, 'c'));
  }]);

  // lead text
  if (withLead && cfg.lead !== false && c.lead && c.lead.length) {
    const lf = cormI(35, 500);
    const ll = c.lead.filter(x => x.trim());
    B.push([ll.length * 42 + 6, y => ll.forEach((l, i) => T(d, cx, y + 31 + i * 42, l, lf, ink, 0, 'c'))]);
  }
  B.push([22, y => divider(d, cx, y + 11, acc)]);

  // details: DATE | TIME, then venue
  const [dfn, dsz0, dtr, dcol] = cfg.det;
  const dsz = pyInt(dsz0 * Math.min(1.0, tscale + 0.25));
  const df = dfn(dsz);
  let lines = [];
  const dateU = c.date.toUpperCase();
  if (c.time) {
    const one = `${dateU}   |   ${c.time}`;
    if (tw(one, df, dtr) <= maxw) lines.push([one, df, dtr, dcol]);
    else lines = lines.concat(wrap(dateU, df, maxw, dtr).slice(0, 2).map(l => [l, df, dtr, dcol]), [[c.time, df, dtr, dcol]]);
  } else {
    lines = lines.concat(wrap(dateU, df, maxw, dtr).slice(0, 2).map(l => [l, df, dtr, dcol]));
  }
  if (c.venue) {
    const [head, rest] = venueParts(c.venue);
    const vf = dfn(dsz - 2), rf = cfg.restSerif === false ? dfn(dsz - 4) : corm(dsz + 3, 600);
    lines = lines.concat(wrap(head.toUpperCase(), vf, maxw, dtr).slice(0, 4).map(l => [l, vf, dtr, ink]));
    if (rest) lines = lines.concat(wrap(rest, rf, maxw).slice(0, 3).map(l => [l, rf, 0.6, ink]));
  }
  const lhD = dsz + 24;
  B.push([lines.length * lhD + 6, y => lines.forEach(([l, f_, tr_, col_], i) => T(d, cx, y + lhD - 6 + i * lhD, l, f_, col_, tr_, 'c'))]);

  // closing
  const cl = c.closing.join(' ');
  let cf = cormI(38, 500);
  while (tw(cl, cf) > maxw + 60 && cf.size > 18 * SS) cf = cormI(cf.size / SS - 2, 500);
  B.push([48, y => T(d, cx, y + 36, cl, cf, ink, 0, 'c')]);
  return B;
}

function layout(overlay, c, cfg) {
  const [top, bottom, gap] = cfg.region ?? [260, 1290, 46];
  let tscale, withLead;
  outer:
  for (withLead of [true, false]) {
    for (tscale of [1.0, 0.9, 0.8, 0.7, 0.6, 0.5]) {
      const B = blocks(new Draw(newCanvas(1, 1)), c, cfg, tscale, withLead);      // dry run: only measures
      if (B.reduce((s, [h]) => s + h, 0) + 12 * (B.length - 1) <= bottom - top) break outer;
    }
  }
  distribute(blocks(new Draw(overlay), c, cfg, tscale, withLead), top, bottom, gap);
}

/** Draws one of the 7 designs → canvas 1024 × 1536 (same input as invite_card.make_card). */
export async function drawDesign(style, host, event, dateText, venue = '') {
  await loadFonts();
  [host, event, dateText, venue] = [host, event, dateText, venue].map(cleanText);
  const spec = themeFor(event);
  const [date, time] = splitDateTime(dateText);
  const content = { eyebrow: spec.eyebrow, event, host: hostLine(host), date, time, venue,
    lead: spec.lead.split('\n'), closing: spec.closing.split('\n') };

  const overlay = newCanvas(W * SS, H * SS);
  layout(overlay, content, CFG[style]);
  const base = newCanvas(W, H);
  base.getContext('2d').drawImage(await loadImage(`${ASSETS}/backgrounds/${style}.jpg`), 0, 0);
  pasteDownscaled(base, overlay);
  return base;
}
