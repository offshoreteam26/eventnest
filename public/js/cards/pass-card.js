/* =====================================================================
 * pass-card.js – EventAgent's guest PASS image (pass_card.py), ported
 * line by line: same style as the event's card, guest name, ADMIT n,
 * date / time / venue / meal rows, tear-off line, QR code and pass number.
 *
 *   const canvas = await drawPass({ guest, event, dateText, venue, adults, kids, passNo, qrText, meal, style })
 * ===================================================================== */
import { Draw, newCanvas, loadImage, pasteDownscaled, toJpeg, pyInt } from './pil.js';
import {
  W, H, SS, TOP, BOTTOM, MAXW, cleanText, resolveStyle, palette, splitDateTime, loadCardFonts, baseImageUrl,
  cinzel, italic, serif, script, tw, wrap, put, putLeft, divider, icon
} from './invite-card.js';
import { qrMatrix } from './qr.js';

const GREEN = [30, 140, 62], RED = [190, 40, 40], BLACK = [22, 22, 22];
const MEAL_TEXT = Object.freeze({ veg: 'VEG', 'non-veg': 'NON-VEG', both: 'VEG + NON-VEG' });

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 'S'}`;

export function mealKind(meal) {
  const m = String(meal || '').trim().toLowerCase().replace(/ /g, '');
  if (m === 'veg' || m === 'vegetarian') return 'veg';
  if (m === 'non-veg' || m === 'nonveg' || m === 'non_veg') return 'non-veg';
  if (m === 'both') return 'both';
  return '';
}

/** Veg / non-veg food marks (green square-dot, red square-triangle). */
function mealMarks(d, kind, x, cy, s, lw) {
  const q = 24 * SS * s;
  const marks = { veg: [GREEN], 'non-veg': [RED], both: [GREEN, RED] }[kind];
  marks.forEach((col, i) => {
    const x0 = x + i * (q + 6 * SS * s), y0 = cy - q / 2;
    d.rectangle([x0, y0, x0 + q, y0 + q], { outline: col, width: lw });
    const mx = x0 + q / 2, my = y0 + q / 2;
    if (col === GREEN) d.ellipse([mx - q * 0.26, my - q * 0.26, mx + q * 0.26, my + q * 0.26], { fill: col });
    else d.polygon([[mx, my - q * 0.3], [mx + q * 0.3, my + q * 0.24], [mx - q * 0.3, my + q * 0.24]], { fill: col });
  });
}

function blocks(d, s, { guest, event, dateTxt, timeTxt, venue, adults, kids, passNo, grid, meal, ink, gold }) {
  const cx = W * SS / 2;
  const B = [];

  // eyebrow + divider
  const fEye = cinzel(23 * s, 500), trEye = 4.2 * s;
  B.push([0, 30 * SS * s, y => put(d, cx, y + 24 * SS * s, 'ENTRY PASS', fEye, ink, trEye)]);
  B.push([14 * SS * s, 26 * SS * s, y => divider(d, cx, y + 13 * SS * s, s, gold)]);

  // event name (max 2 lines)
  let size = 64 * s, fEv, trEv, lines;
  for (;;) {
    fEv = cinzel(size, 600); trEv = 2.0 * s;
    lines = wrap(event.toUpperCase(), fEv, MAXW, trEv);
    if ((lines.length <= 2 && lines.every(l => tw(l, fEv, trEv) <= MAXW * SS)) || size <= 32 * s) break;
    size -= 3 * s;
  }
  const lh = size * SS * 1.2;
  B.push([24 * SS * s, lh * lines.length, y => lines.forEach((l, i) => put(d, cx, y + size * SS * 0.92 + i * lh, l, fEv, ink, trEv))]);

  // issued to + guest name
  B.push([16 * SS * s, 30 * SS * s, y => put(d, cx, y + 24 * SS * s, 'pass issued to', italic(28 * s, 500), gold, 1.2 * s)]);
  let gs = 60 * s;
  while (tw(guest, script(gs)) > MAXW * SS && gs > 34 * s) gs -= 3 * s;
  const gl = (tw(guest, script(gs)) > MAXW * SS ? wrap(guest, script(gs), MAXW) : [guest]).slice(0, 2);
  const fG = script(gs);
  B.push([0, gs * SS * 1.3 * gl.length, y => gl.forEach((l, i) => put(d, cx, y + gs * SS * 0.95 + i * gs * SS * 1.25, l, fG, ink))]);
  B.push([10 * SS * s, 26 * SS * s, y => divider(d, cx, y + 13 * SS * s, s, gold)]);

  // ADMIT n
  const total = adults + kids;
  const fAd = cinzel(38 * s, 500), fNum = cinzel(112 * s, 600), trAd = 6 * s;
  const w1 = tw('ADMIT', fAd, trAd), w2 = tw(String(total), fNum), gap = 26 * SS * s;
  B.push([14 * SS * s, 104 * SS * s, y => {
    const x = cx - (w1 + gap + w2) / 2, base = y + 92 * SS * s;
    putLeft(d, x, base, 'ADMIT', fAd, gold, trAd);
    putLeft(d, x + w1 + gap, base, String(total), fNum, ink);
  }]);

  const parts = [];
  if (adults) parts.push(plural(adults, 'ADULT'));
  if (kids) parts.push(plural(kids, 'KID'));
  const sub = parts.join('  ·  ') || plural(total, 'GUEST');
  const fSub = cinzel(26 * s, 500);
  B.push([4 * SS * s, 34 * SS * s, y => put(d, cx, y + 26 * SS * s, sub, fSub, ink, 2.4 * s)]);
  B.push([18 * SS * s, 26 * SS * s, y => divider(d, cx, y + 13 * SS * s, s, gold)]);

  // info rows
  const caps = cinzel(27 * s, 500), norm = serif(28 * s, 500);
  let rows = [['date', 'DATE', [[dateTxt.toUpperCase(), caps, 1.2 * s]]]];
  if (timeTxt) rows.push(['time', 'TIME', [[timeTxt, caps, 1.2 * s]]]);
  if (venue) {
    const i = venue.indexOf(',');
    const head = i < 0 ? venue : venue.slice(0, i), rest = i < 0 ? '' : venue.slice(i + 1);
    let vl = wrap(head.trim().toUpperCase(), caps, 420, 1.2 * s).slice(0, 2).map(l => [l, caps, 1.2 * s]);
    if (rest.trim()) vl = vl.concat(wrap(rest.trim(), norm, 420).slice(0, 1).map(l => [l, norm, 0.3 * s]));
    rows.push(['pin', 'VENUE', vl]);
  }
  if (meal) rows.push(['meal', 'MEAL', [[MEAL_TEXT[meal], caps, 1.2 * s]]]);
  rows = rows.map(([kind, label, vl]) => {
    let out = [];
    vl.forEach(([text, f, tr]) => { out = out.concat(tw(text, f, tr) > 420 * SS ? wrap(text, f, 420, tr).map(l => [l, f, tr]) : [[text, f, tr]]); });
    return [kind, label, out.slice(0, 3)];
  });
  const maxw = Math.max(...rows.flatMap(([, , vl]) => vl.map(([t, f, tr]) => tw(t, f, tr))));
  const x0 = cx - (92 * SS * s + maxw) / 2;
  const lineH = 34 * SS * s;
  rows.forEach(([kind, label, vl]) => {
    const h = 26 * SS * s + vl.length * lineH;
    B.push([14 * SS * s, h, y => {
      const lw = Math.max(2, pyInt(2.4 * SS * s));
      if (kind === 'meal') mealMarks(d, meal, x0 + 4 * SS * s, y + h / 2 - 2 * SS * s, s, lw);
      else icon(kind, d, x0 + 26 * SS * s, y + h / 2 - 2 * SS * s, s, gold);
      d.line([x0 + 66 * SS * s, y + 2 * SS * s, x0 + 66 * SS * s, y + h - 2 * SS * s], { fill: gold, width: Math.max(2, pyInt(1.6 * SS * s)) });
      const tx = x0 + 92 * SS * s;
      putLeft(d, tx, y + 19 * SS * s, label, cinzel(17 * s, 500), gold, 3.0 * s);
      vl.forEach(([text, f, tr], i) => putLeft(d, tx, y + 26 * SS * s + (i + 0.78) * lineH, text, f, ink, tr));
    }]);
  });

  // tear-off line
  B.push([20 * SS * s, 12 * SS * s, y => {
    for (let x = cx - 250 * SS * s, end = cx + 250 * SS * s; x < end; x += 22 * SS * s) {
      d.line([x, y + 6 * SS * s, x + 12 * SS * s, y + 6 * SS * s], { fill: gold, width: Math.max(2, pyInt(2 * SS * s)) });
    }
  }]);

  // QR box
  const n = grid.length, qs = 214 * s * SS, cell = qs / n, pad = Math.max(cell * 4, 20 * SS * s);
  B.push([18 * SS * s, qs + 2 * pad, y => {
    const bx0 = cx - qs / 2 - pad, by0 = y;
    d.rounded_rectangle([bx0, by0, bx0 + qs + 2 * pad, by0 + qs + 2 * pad], { radius: 16 * SS * s, fill: [255, 255, 255], outline: gold, width: Math.max(2, pyInt(3 * SS * s)) });
    const qx = bx0 + pad, qy = by0 + pad;
    grid.forEach((row, r) => row.forEach((on, k) => {
      if (on) d.rectangle([qx + k * cell, qy + r * cell, qx + (k + 1) * cell + 0.6, qy + (r + 1) * cell + 0.6], { fill: BLACK });
    }));
  }]);

  const fPn = cinzel(32 * s, 600);
  B.push([12 * SS * s, 40 * SS * s, y => put(d, cx, y + 32 * SS * s, passNo, fPn, ink, 3.2 * s)]);
  const fHint = italic(26 * s, 500);
  B.push([2 * SS * s, 30 * SS * s, y => put(d, cx, y + 24 * SS * s, 'Show this QR at the entry gate', fHint, gold)]);
  return B;
}

/** Returns the pass as a canvas (1024 × 1536). `grid` may be given to reuse an existing QR matrix. */
export async function drawPass({ guest, event, dateText, venue = '', adults = 0, kids = 0, passNo, qrText, meal = '', style = null, grid = null }) {
  await loadCardFonts();
  [event, dateText, venue] = [event, dateText, venue].map(cleanText);
  try { guest = cleanText(guest) || 'Guest'; } catch { guest = 'Guest'; }
  adults = pyInt(Number(adults) || 0); kids = pyInt(Number(kids) || 0);
  style = resolveStyle(event, style);
  grid = grid || qrMatrix(qrText, 'Q');
  const [dateTxt, timeTxt] = splitDateTime(dateText);
  const [spec, gold] = palette(event, style);
  const args = { guest, event, dateTxt, timeTxt, venue, adults, kids, passNo, grid, meal: mealKind(meal), ink: spec.ink, gold };

  const avail = (BOTTOM - TOP + 18) * SS;
  let overlay, B, total, s = 1.0;
  for (;;) {
    overlay = newCanvas(W * SS, H * SS);
    B = blocks(new Draw(overlay), s, args);
    total = B.slice(1).reduce((sum, [g, h]) => sum + g + h, 0) + B[0][1];
    if (total <= avail || s <= 0.5) break;
    s -= 0.03;
  }
  const gaps = B.length - 1;
  const extra = Math.max(0, avail - total);
  const perGap = Math.min(extra / gaps, 26 * SS);
  let y = (TOP - 2) * SS + (extra - perGap * gaps) / 2;
  B.forEach(([gap, h, paint], i) => { if (i) y += gap + perGap; paint(y); y += h; });

  const base = newCanvas(W, H);
  base.getContext('2d').drawImage(await loadImage(baseImageUrl(style)), 0, 0);
  pasteDownscaled(base, overlay);
  return base;
}

export const makePass = async opts => toJpeg(await drawPass(opts));
