/* =====================================================================
 * poster.js – EventAgent's gate poster (make_poster.py), rebuilt as SVG.
 * Same A4 page (595 × 842 points), same positions, colours, fonts and text,
 * so printing it ("Save as PDF") gives the same poster as the Python version.
 *
 * buildPoster({ title, sub, qrMatrix, steps, footer }) → SVG element
 * The PDF draws from the bottom up; SVG from the top down → every y becomes H - y.
 * ===================================================================== */

const W = 595.2756, H = 841.8898;                      // reportlab A4 in points
const COLORS = Object.freeze({
  maroon: '#7A1F2B', gold: '#D9A441', cream: '#FFF8EC', ink: '#2B2B2B',
  light: '#F3DFA9', grey: '#555555', white: '#FFFFFF', black: '#000000'
});
const FONT = 'Helvetica, Arial, "Liberation Sans", "Nimbus Sans", sans-serif';

export const DEFAULT_STEPS = Object.freeze([
  ['1', 'Open your phone camera', '(or Google Lens) and point it at the QR code'],
  ['2', 'Tap the link', 'WhatsApp opens with ARRIVED already typed'],
  ['3', 'Tap Send', "You're checked in - and entered in the Lucky Draw!"]
]);
export const DEFAULT_FOOTER = Object.freeze([
  'Not registered yet? Please confirm your invitation on WhatsApp first, then scan.',
  'Need help? Ask any volunteer at the gate.'
]);

/* ---------- small SVG helpers ---------- */
const NS = 'http://www.w3.org/2000/svg';
function node(tag, attrs, text) {
  const n = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  if (text !== undefined) n.textContent = text;
  return n;
}
const rect = (x, y, w, h, fill) => node('rect', { x, y: H - y - h, width: w, height: h, fill });
const text = (x, y, value, { size, bold = false, fill, anchor = 'middle' }) =>
  node('text', { x, y: H - y, fill, 'font-family': FONT, 'font-size': size, 'font-weight': bold ? 700 : 400, 'text-anchor': anchor }, value);

/* ---------- text measuring + wrapping (like reportlab simpleSplit) ---------- */
const measureCtx = document.createElement('canvas').getContext('2d');
function width(value, size, bold) {
  measureCtx.font = `${bold ? 700 : 400} ${size}px ${FONT}`;
  return measureCtx.measureText(value).width;
}
function split(value, size, bold, maxWidth) {
  const lines = [];
  let line = '';
  String(value).split(/\s+/).filter(Boolean).forEach(word => {
    const next = line ? `${line} ${word}` : word;
    if (line && width(next, size, bold) > maxWidth) { lines.push(line); line = word; } else line = next;
  });
  if (line) lines.push(line);
  return lines;
}

/* ---------- the poster ---------- */
export function buildPoster({ title, sub = '', qrMatrix, steps = DEFAULT_STEPS, footer = DEFAULT_FOOTER }) {
  const svg = node('svg', { xmlns: NS, viewBox: `0 0 ${W} ${H}`, width: '210mm', height: '297mm', class: 'poster' });
  const add = (...children) => children.forEach(c => svg.append(c));
  const maxWidth = W - 100;

  // background + header
  add(rect(0, 0, W, H, COLORS.cream), rect(0, H - 225, W, 225, COLORS.maroon), rect(0, H - 233, W, 8, COLORS.gold));
  add(text(W / 2, H - 52, 'W E L C O M E', { size: 20, bold: true, fill: COLORS.gold }));

  // title: shrink until every line fits, at most 3 lines
  let size = 36;
  while (size > 20 && Math.max(...split(title, size, true, maxWidth).map(l => width(l, size, true))) > maxWidth) size -= 2;
  let y = H - 100;
  split(title, size, true, maxWidth).slice(0, 3).forEach(line => {
    add(text(W / 2, y, line, { size, bold: true, fill: COLORS.white }));
    y -= size * 1.15;
  });
  split(sub, 15, false, maxWidth).slice(0, 2).forEach(line => {
    add(text(W / 2, y - 6, line, { size: 15, fill: COLORS.light }));
    y -= 20;
  });

  // headline
  add(text(W / 2, H - 275, 'SCAN TO CHECK IN', { size: 32, bold: true, fill: COLORS.maroon }));
  add(text(W / 2, H - 298, 'No queue. No typing. Just scan with your phone camera.', { size: 14, fill: COLORS.ink }));

  // QR in a white, gold-bordered rounded box
  const QS = 230, pad = 22, qx = (W - QS) / 2, qy = H - 342 - QS;
  add(node('rect', { x: qx - pad, y: H - (qy - pad) - (QS + 2 * pad), width: QS + 2 * pad, height: QS + 2 * pad,
    rx: 18, fill: COLORS.white, stroke: COLORS.gold, 'stroke-width': 5 }));
  if (qrMatrix && qrMatrix.length) {
    const n = qrMatrix.length, cell = QS / n;
    const modules = [];
    qrMatrix.forEach((row, r) => row.forEach((on, k) => {
      if (on) modules.push(`M${qx + k * cell} ${H - (qy + QS - (r + 1) * cell) - (cell + 0.4)}h${cell + 0.4}v${cell + 0.4}h-${cell + 0.4}z`);
    }));
    add(node('path', { d: modules.join(''), fill: COLORS.black }));
  }

  // numbered steps
  let sy = qy - pad - 44;
  steps.forEach(([num, head, tail]) => {
    add(node('circle', { cx: 95, cy: H - (sy + 6), r: 19, fill: COLORS.maroon }));
    add(text(95, sy - 1, num, { size: 20, bold: true, fill: COLORS.white }));
    add(text(130, sy + 8, head, { size: 17, bold: true, fill: COLORS.ink, anchor: 'start' }));
    add(text(130, sy - 10, tail, { size: 13, fill: COLORS.grey, anchor: 'start' }));
    sy -= 52;
  });

  // footer
  add(rect(0, 0, W, 62, COLORS.maroon));
  add(text(W / 2, 38, footer[0], { size: 12, fill: COLORS.white }));
  add(text(W / 2, 20, footer[1], { size: 10, fill: COLORS.light }));
  return svg;
}
