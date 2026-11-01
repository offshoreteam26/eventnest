/* =====================================================================
 * qr.js – QR code encoder that gives the SAME matrix as Python's
 * `qrcode` library used by EventAgent:
 *
 *   qrcode.QRCode(error_correction=ERROR_CORRECT_Q, border=0, box_size=1)
 *   qr.add_data(text); qr.make(fit=True); qr.get_matrix()
 *
 * Reproduced on purpose: optimal_data_chunks (runs of ≥ 20 digits /
 * alphanumerics get their own segment), smallest fitting version, and the
 * mask choice (lost-point scored with format/version areas left light,
 * exactly as python-qrcode does).
 *
 *   qrMatrix(text, 'Q') → boolean[][]   (true = dark module)
 * ===================================================================== */

const LEVEL_BITS = { L: 1, M: 0, Q: 3, H: 2 };          // python-qrcode constants
const LEVEL_INDEX = { L: 0, M: 1, Q: 2, H: 3 };

const ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
];
const NUM_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
];

const MODE = { NUM: 1, ALNUM: 2, BYTE: 4 };
const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

/* ---------- size tables ---------- */
const sizeOf = v => v * 4 + 17;
function rawModules(v) {
  let n = (16 * v + 128) * v + 64;
  if (v >= 2) { const a = Math.floor(v / 7) + 2; n -= (25 * a - 10) * a - 55; if (v >= 7) n -= 36; }
  return n;
}
const dataCodewords = (v, lvl) => Math.floor(rawModules(v) / 8) - ECC_PER_BLOCK[lvl][v] * NUM_BLOCKS[lvl][v];
const lengthBits = (mode, v) => {
  const k = v < 10 ? 0 : v < 27 ? 1 : 2;
  return { [MODE.NUM]: [10, 12, 14], [MODE.ALNUM]: [9, 11, 13], [MODE.BYTE]: [8, 16, 16] }[mode][k];
};
function alignmentPositions(v) {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2;
  const step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let pos = sizeOf(v) - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

/* ---------- segments (python-qrcode optimal_data_chunks, minimum = 20) ---------- */
function* optimalSplit(bytes, isMember, minimum) {
  let i = 0;
  const n = bytes.length;
  let chunkStart = 0;
  while (i < n) {
    if (isMember(bytes[i])) {
      let j = i;
      while (j < n && isMember(bytes[j])) j++;
      if (j - i >= minimum) {
        if (i > chunkStart) yield [false, bytes.slice(chunkStart, i)];
        yield [true, bytes.slice(i, j)];
        chunkStart = j;
      }
      i = j;
    } else i++;
  }
  if (chunkStart < n) yield [false, bytes.slice(chunkStart)];
}

function segments(text, minimum = 20) {
  const bytes = [...new TextEncoder().encode(text)];
  const isNum = b => b >= 48 && b <= 57;
  const isAlnum = b => ALNUM.includes(String.fromCharCode(b));
  const whole = (test) => bytes.length > 0 && bytes.every(test);
  if (bytes.length <= minimum) {                          // short data: one mode for the whole string
    if (whole(isNum)) return [{ mode: MODE.NUM, bytes }];
    if (whole(isAlnum)) return [{ mode: MODE.ALNUM, bytes }];
    return [{ mode: MODE.BYTE, bytes }];
  }
  const out = [];
  for (const [num, chunk] of optimalSplit(bytes, isNum, minimum)) {
    if (num) { out.push({ mode: MODE.NUM, bytes: chunk }); continue; }
    for (const [al, sub] of optimalSplit(chunk, isAlnum, minimum)) out.push({ mode: al ? MODE.ALNUM : MODE.BYTE, bytes: sub });
  }
  return out;
}

/* ---------- bits ---------- */
class Bits {
  constructor() { this.bits = []; }
  put(value, len) { for (let i = len - 1; i >= 0; i--) this.bits.push((value >>> i) & 1); }
}
function writeSegment(buf, seg, v) {
  const b = seg.bytes;
  buf.put(seg.mode, 4);
  buf.put(b.length, lengthBits(seg.mode, v));
  if (seg.mode === MODE.NUM) {
    const s = String.fromCharCode(...b);
    for (let i = 0; i < s.length; i += 3) { const g = s.slice(i, i + 3); buf.put(Number(g), [0, 4, 7, 10][g.length]); }
  } else if (seg.mode === MODE.ALNUM) {
    const s = String.fromCharCode(...b);
    for (let i = 0; i < s.length; i += 2) {
      if (i + 1 < s.length) buf.put(ALNUM.indexOf(s[i]) * 45 + ALNUM.indexOf(s[i + 1]), 11);
      else buf.put(ALNUM.indexOf(s[i]), 6);
    }
  } else b.forEach(x => buf.put(x, 8));
}

/* ---------- Reed–Solomon over GF(256), polynomial 0x11D ---------- */
const EXP = new Array(512), LOG = new Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const gmul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function rsGenerator(degree) {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(g.length + 1).fill(0);
    g.forEach((c, j) => { next[j] ^= c; next[j + 1] ^= gmul(c, EXP[i]); });
    g = next;
  }
  return g;
}
function rsRemainder(data, degree) {
  const gen = rsGenerator(degree);
  const rem = new Array(degree).fill(0);
  for (const d of data) {
    const factor = d ^ rem.shift();
    rem.push(0);
    for (let i = 0; i < degree; i++) rem[i] ^= gmul(gen[i + 1], factor);
  }
  return rem;
}

function codewords(segs, v, lvl) {
  const capacity = dataCodewords(v, lvl) * 8;
  const buf = new Bits();
  segs.forEach(s => writeSegment(buf, s, v));
  for (let i = 0; i < Math.min(capacity - buf.bits.length, 4); i++) buf.bits.push(0);
  while (buf.bits.length % 8) buf.bits.push(0);
  const data = [];
  for (let i = 0; i < buf.bits.length; i += 8) data.push(parseInt(buf.bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xEC; data.length < capacity / 8; pad ^= 0xEC ^ 0x11) data.push(pad);

  const blocks = NUM_BLOCKS[lvl][v], ecLen = ECC_PER_BLOCK[lvl][v];
  const shortLen = Math.floor(data.length / blocks), longCount = data.length % blocks;
  const dataBlocks = [], ecBlocks = [];
  let k = 0;
  for (let i = 0; i < blocks; i++) {
    const len = shortLen + (i >= blocks - longCount ? 1 : 0);
    const block = data.slice(k, k + len);
    k += len;
    dataBlocks.push(block);
    ecBlocks.push(rsRemainder(block, ecLen));
  }
  const out = [];
  for (let i = 0; i <= shortLen; i++) dataBlocks.forEach(b => { if (i < b.length) out.push(b[i]); });
  for (let i = 0; i < ecLen; i++) ecBlocks.forEach(b => out.push(b[i]));
  return out;
}

/* ---------- matrix ---------- */
const MASKS = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => (i * j) % 2 + (i * j) % 3 === 0,
  (i, j) => ((i * j) % 2 + (i * j) % 3) % 2 === 0,
  (i, j) => ((i * j) % 3 + (i + j) % 2) % 2 === 0
];
const bchDigit = d => { let n = 0; while (d) { n++; d >>>= 1; } return n; };
function bch(data, g, shift) {
  let d = data << shift;
  while (bchDigit(d) - bchDigit(g) >= 0) d ^= g << (bchDigit(d) - bchDigit(g));
  return (data << shift) | d;
}
const typeInfoBits = (lvlBits, mask) => bch((lvlBits << 3) | mask, 0b10100110111, 10) ^ 0b101010000010010;
const versionBits = v => bch(v, 0b1111100100101, 12);

function build(v, lvlBits, words, mask, test) {
  const n = sizeOf(v);
  const m = Array.from({ length: n }, () => new Array(n).fill(null));

  const probe = (row, col) => {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || n <= row + r) continue;
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || n <= col + c) continue;
        m[row + r][col + c] = (0 <= r && r <= 6 && (c === 0 || c === 6)) || (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
          (2 <= r && r <= 4 && 2 <= c && c <= 4);
      }
    }
  };
  probe(0, 0); probe(n - 7, 0); probe(0, n - 7);

  const pos = alignmentPositions(v);
  for (const row of pos) for (const col of pos) {
    if (m[row][col] !== null) continue;
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) {
      m[row + r][col + c] = r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
    }
  }
  for (let r = 8; r < n - 8; r++) { if (m[r][6] === null) m[r][6] = r % 2 === 0; }
  for (let c = 8; c < n - 8; c++) { if (m[6][c] === null) m[6][c] = c % 2 === 0; }

  const bits = typeInfoBits(lvlBits, mask);
  for (let i = 0; i < 15; i++) {
    const mod = !test && ((bits >> i) & 1) === 1;
    if (i < 6) m[i][8] = mod; else if (i < 8) m[i + 1][8] = mod; else m[n - 15 + i][8] = mod;
  }
  for (let i = 0; i < 15; i++) {
    const mod = !test && ((bits >> i) & 1) === 1;
    if (i < 8) m[8][n - i - 1] = mod; else if (i < 9) m[8][15 - i - 1 + 1] = mod; else m[8][15 - i - 1] = mod;
  }
  m[n - 8][8] = !test;

  if (v >= 7) {
    const vb = versionBits(v);
    for (let i = 0; i < 18; i++) {
      const mod = !test && ((vb >> i) & 1) === 1;
      m[Math.floor(i / 3)][i % 3 + n - 8 - 3] = mod;
      m[i % 3 + n - 8 - 3][Math.floor(i / 3)] = mod;
    }
  }

  // data, zig-zag from the bottom right
  const fn = MASKS[mask];
  let inc = -1, row = n - 1, bitIndex = 7, byteIndex = 0;
  for (let right = n - 1; right > 0; right -= 2) {
    const col = right <= 6 ? right - 1 : right;           // skip the vertical timing column
    for (;;) {
      for (const c of [0, 1]) {
        if (m[row][col - c] === null) {
          let dark = false;
          if (byteIndex < words.length) dark = ((words[byteIndex] >>> bitIndex) & 1) === 1;
          if (fn(row, col - c)) dark = !dark;
          m[row][col - c] = dark;
          bitIndex--;
          if (bitIndex === -1) { byteIndex++; bitIndex = 7; }
        }
      }
      row += inc;
      if (row < 0 || n <= row) { row -= inc; inc = -inc; break; }
    }
  }
  return m;
}

/* ---------- mask scoring (python-qrcode lost_point) ---------- */
function lostPoint(m) {
  const n = m.length;
  let lost = 0;
  const runs = (get) => {
    for (let a = 0; a < n; a++) {
      let prev = get(a, 0), len = 0;
      for (let b = 0; b < n; b++) {
        if (get(a, b) === prev) len++;
        else { if (len >= 5) lost += len - 2; len = 1; prev = get(a, b); }
      }
      if (len >= 5) lost += len - 2;
    }
  };
  runs((r, c) => m[r][c]);
  runs((c, r) => m[r][c]);

  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const x = m[r][c];
    if (x === m[r][c + 1] && x === m[r + 1][c] && x === m[r + 1][c + 1]) lost += 3;
  }

  const finder = (g) => !g(1) && g(4) && !g(5) && g(6) && !g(9) && (
    (g(0) && g(2) && g(3) && !g(7) && !g(8) && !g(10)) ||
    (!g(0) && !g(2) && !g(3) && g(7) && g(8) && g(10)));
  for (let r = 0; r < n; r++) for (let c = 0; c < n - 10; c++) if (finder(k => m[r][c + k])) lost += 40;
  for (let c = 0; c < n; c++) for (let r = 0; r < n - 10; r++) if (finder(k => m[r + k][c])) lost += 40;

  const dark = m.reduce((s, row) => s + row.filter(Boolean).length, 0);
  lost += Math.floor(Math.abs((dark / (n * n)) * 100 - 50) / 5) * 10;
  return lost;
}

/* ---------- public ---------- */
export function qrMatrix(text, level = 'Q') {
  const lvl = LEVEL_INDEX[level], lvlBits = LEVEL_BITS[level];
  const segs = segments(String(text));
  let v = 1;
  for (;; v++) {
    if (v > 40) throw new Error('QR data too long');
    const buf = new Bits();
    segs.forEach(s => writeSegment(buf, s, v));
    if (buf.bits.length <= dataCodewords(v, lvl) * 8) break;
  }
  const words = codewords(segs, v, lvl);
  let best = 0, bestLost = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const lost = lostPoint(build(v, lvlBits, words, mask, true));
    if (lost < bestLost) { bestLost = lost; best = mask; }
  }
  return build(v, lvlBits, words, best, false);
}
