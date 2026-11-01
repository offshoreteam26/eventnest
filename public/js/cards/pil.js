/* =====================================================================
 * pil.js – the small part of Python's Pillow (PIL) that EventAgent's card
 * code uses, implemented on an HTML canvas, so the Python drawing code can be
 * ported line by line and give the same picture.
 *
 * Pillow details reproduced on purpose:
 *   - outlines of ellipses / rounded rectangles / arcs are drawn INSIDE the box
 *   - lines have flat ends (no round caps)
 *   - angles in degrees, clockwise from 3 o'clock
 *   - Python round() (halves to even) and int() (towards zero)
 * ===================================================================== */

export const pyRound = x => {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;      // 2.5 → 2, 3.5 → 4
};
export const pyInt = Math.trunc;

const rgb = c => (Array.isArray(c) ? (c.length === 4 ? `rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255})` : `rgb(${c[0]},${c[1]},${c[2]})`) : c);

/* ---------- fonts ---------- */
const loaded = new Map();

/** Loads a .ttf once. Variable fonts get the full weight range, like Pillow's set_variation_by_axes. */
export async function loadFont(family, url) {
  if (!loaded.has(family)) {
    const face = new FontFace(family, `url(${url})`, { weight: '100 900' });
    loaded.set(family, face.load().then(f => { document.fonts.add(f); return f; }));
  }
  return loaded.get(family);
}

/** A font like ImageFont.truetype(file, size) + optional weight. `size` is already in pixels. */
export class Font {
  constructor(family, size, weight = 400) {
    this.family = family;
    this.size = Math.max(8, size);
    this.weight = weight;
    this.css = `${weight} ${this.size}px "${family}"`;
  }
  getlength(text) {
    measure.font = this.css;
    return measure.measureText(text).width;
  }
}
const measure = document.createElement('canvas').getContext('2d');

/* ---------- ImageDraw.Draw ---------- */
export class Draw {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
    this.ctx.lineCap = 'butt';
    this.ctx.lineJoin = 'miter';
  }

  text([x, y], value, { font, fill }) {                   // anchor "ls" = left, baseline
    const c = this.ctx;
    c.font = font.css;
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.fillStyle = rgb(fill);
    c.fillText(value, x, y);
  }

  line(points, { fill, width = 1 }) {
    const c = this.ctx;
    const pts = points.length && Array.isArray(points[0]) ? points.flat() : points;
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.strokeStyle = rgb(fill);
    c.lineWidth = width;
    c.stroke();
  }

  polygon(points, { fill, outline, width = 1 }) {
    const c = this.ctx;
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    if (fill) { c.fillStyle = rgb(fill); c.fill(); }
    if (outline) { c.strokeStyle = rgb(outline); c.lineWidth = width; c.stroke(); }
  }

  /** Box [x0, y0, x1, y1]; the outline sits inside the box, as in Pillow. */
  ellipse([x0, y0, x1, y1], { fill, outline, width = 1 }) {
    const c = this.ctx;
    const ellipsePath = inset => {
      c.beginPath();
      c.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.max(0, (x1 - x0) / 2 - inset), Math.max(0, (y1 - y0) / 2 - inset), 0, 0, Math.PI * 2);
    };
    if (fill) { ellipsePath(0); c.fillStyle = rgb(fill); c.fill(); }
    if (outline) { ellipsePath(width / 2); c.strokeStyle = rgb(outline); c.lineWidth = width; c.stroke(); }
  }

  arc([x0, y0, x1, y1], { start, end, fill, width = 1 }) {
    const c = this.ctx;
    c.beginPath();
    c.ellipse((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 - width / 2, (y1 - y0) / 2 - width / 2, 0,
      start * Math.PI / 180, end * Math.PI / 180);
    c.strokeStyle = rgb(fill);
    c.lineWidth = width;
    c.stroke();
  }

  rectangle([x0, y0, x1, y1], { fill, outline, width = 1 }) {
    const c = this.ctx;
    if (fill) { c.fillStyle = rgb(fill); c.fillRect(x0, y0, x1 - x0 + 1, y1 - y0 + 1); }
    if (outline) { c.strokeStyle = rgb(outline); c.lineWidth = width; c.strokeRect(x0 + width / 2, y0 + width / 2, x1 - x0 + 1 - width, y1 - y0 + 1 - width); }
  }

  rounded_rectangle([x0, y0, x1, y1], { radius, fill, outline, width = 1 }) {
    const c = this.ctx;
    const path = inset => {
      c.beginPath();
      c.roundRect(x0 + inset, y0 + inset, x1 - x0 - 2 * inset, y1 - y0 - 2 * inset, Math.max(0, radius - inset));
    };
    if (fill) { path(0); c.fillStyle = rgb(fill); c.fill(); }
    if (outline) { path(width / 2); c.strokeStyle = rgb(outline); c.lineWidth = width; c.stroke(); }
  }
}

/* ---------- images ---------- */
export function newCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load ' + url));
    img.src = url;
  });
}

/** Pastes a supersampled transparent layer onto the base at 1x (Pillow: resize(LANCZOS) + paste with alpha). */
export function pasteDownscaled(baseCanvas, layerCanvas) {
  const c = baseCanvas.getContext('2d');
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.drawImage(layerCanvas, 0, 0, baseCanvas.width, baseCanvas.height);
}

/** canvas → JPEG Blob (Pillow: save("JPEG", quality=92)). */
export const toJpeg = (canvas, quality = 0.92) =>
  new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
