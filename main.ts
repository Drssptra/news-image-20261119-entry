// news-image-20261119-entry — main.ts
// Draws Thursday 19 November 2026's world news as ONE 1024x1024 PNG
// newspaper-style front page. Node 22 stdlib only (node:zlib, node:fs,
// node:path). No network at runtime. Fully deterministic.
//
// SIX STORIES — every one a specific event of 19 November 2026, verified
// against reporting dated that day. Sources are noted per story below.
// Claims are labelled as claims in the image text ("X says ...").
//
// 1. GTA VI global rollout begins — Reuters, 19 Nov 2026 ("Gamers enter
//    Vice City as Grand Theft Auto VI begins global rollout"; rollout
//    starts at midnight local time in New Zealand; Sensor Tower estimate
//    of 17m+ copies / $1.65bn+ pre-release sales via Reuters, 19 Nov).
// 2. Trump, Xi and Putin gather in Shenzhen; trilateral meeting on
//    Thursday — The New York Times, 19 Nov 2026 ("Trump, Xi and Putin
//    Shake Hands as Leaders Gather in China").
// 3. NASA's Voyager 1 reaches one light-day from Earth — NASA press
//    conference on Thursday 19 Nov 2026 (reported 19 Nov 2026; the probe
//    "likely reached this record-breaking milestone" that morning).
// 4. Cyclone Akvan nears India's east coast, set to cross between
//    Machilipatnam and Puri — The Hindu live updates, 19 Nov 2026.
// 5. Crimean Bridge attacked again — BBC News, 19 Nov 2026
//    ("Crimean Bridge attacked again, Russian official says").
// 6. Australia, Canada, Italy and the UK call on Israel to let aid
//    reach flooded Gaza — The Paris Eye, 19 Nov 2026.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
const buf = Buffer.alloc(W * H * 4);

function rgb(r: number, g: number, b: number): [number, number, number] {
  return [r, g, b];
}
const PAPER = rgb(247, 243, 232);
const INK = rgb(17, 17, 17);
const RED = rgb(179, 32, 44);
const NAVY = rgb(29, 58, 110);
const TEAL = rgb(14, 116, 110);
const ORANGE = rgb(232, 120, 40);
const GOLD = rgb(214, 164, 32);
const GREY = rgb(90, 86, 78);
const LIGHT = rgb(233, 227, 214);
const SKY = rgb(255, 214, 140);
const SEA = rgb(24, 90, 120);

function px(x: number, y: number, c: [number, number, number]): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
  buf[i + 3] = 255;
}

function rect(x: number, y: number, w: number, h: number, c: [number, number, number]): void {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) px(i, j, c);
  }
}

function hline(x: number, y: number, w: number, c: [number, number, number], t = 1): void {
  rect(x, y, w, t, c);
}

function vline(x: number, y: number, h: number, c: [number, number, number], t = 1): void {
  rect(x, y, t, h, c);
}

function disc(cx: number, cy: number, r: number, c: [number, number, number]): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) px(x, y, c);
    }
  }
}

function ring(cx: number, cy: number, r: number, t: number, c: [number, number, number]): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++) {
      px(Math.round(cx + (r + k) * Math.cos(rad)), Math.round(cy + (r + k) * Math.sin(rad)), c);
    }
  }
}

// filled triangle (scanline)
function tri(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, c: [number, number, number]): void {
  const minY = Math.min(y1, y2, y3);
  const maxY = Math.max(y1, y2, y3);
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges: Array<[number, number, number, number]> = [
      [x1, y1, x2, y2],
      [x2, y2, x3, y3],
      [x3, y3, x1, y1],
    ];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(Math.round(ax + ((y - ay) * (bx - ax)) / (by - ay)));
      }
    }
    if (xs.length >= 2) {
      const lo = Math.min(...xs);
      const hi = Math.max(...xs);
      for (let x = lo; x <= hi; x++) px(x, y, c);
    }
  }
}

// ------------------------------------------------------------------ font
// 5x7 pixel font. Each glyph is 7 rows of 5 cells ('#' = on).
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['.....', '.....', '.####', '#....', '#....', '#....', '.####'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  f: ['..##.', '.#..#', '.#...', '####.', '.#...', '.#...', '.#...'],
  g: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#', '.###.'].slice(0, 7),
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'],
  j: ['...#.', '.....', '..##.', '...#.', '...#.', '...#.', '.##..'],
  k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
  l: ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: ['.....', '.....', '####.', '#...#', '#...#', '####.', '#....'],
  q: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#...', '..##.'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '.....', '#...#', '#...#', '#...#', '.####', '....#'],
  z: ['.....', '.....', '#####', '....#', '...#.', '..#..', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '...#.', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '%': ['#...#', '#..#.', '...#.', '..#..', '.#...', '#..#.', '#...#'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.#.#.', '.....', '.....', '.....', '.....'],
  '\u2022': ['.....', '.....', '.###.', '.###.', '.###.', '.....', '.....'],
};

// 'g' and 'y' need a descender row; keep them 7 rows but shifted down one
// (row 0 blank) so the tail sits below the baseline. Fix them explicitly:
FONT['g'] = ['.....', '.####', '#...#', '#...#', '.####', '....#', '.###.'];
FONT['y'] = ['.....', '#...#', '#...#', '#...#', '.####', '....#', '.###.'];
FONT['j'] = ['...#.', '.....', '..##.', '...#.', '...#.', '...#.', '.##..'];

function textWidth(s: string, scale: number): number {
  let w = 0;
  for (const ch of s) {
    const g = FONT[ch] ?? FONT['?'];
    void g;
    w += 6 * scale;
  }
  return w - scale; // no trailing gap
}

function drawChar(x: number, y: number, ch: string, scale: number, c: [number, number, number]): void {
  const g = FONT[ch] ?? FONT['?'];
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r][col] === '#') rect(x + col * scale, y + r * scale, scale, scale, c);
    }
  }
}

function drawText(x: number, y: number, s: string, scale: number, c: [number, number, number]): number {
  let cx = x;
  for (const ch of s) {
    drawChar(cx, y, ch, scale, c);
    cx += 6 * scale;
  }
  return cx;
}

function drawTextCentered(cx: number, y: number, s: string, scale: number, c: [number, number, number]): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}

// Word-wrap `s` into lines no wider than maxW, drawn at (x, y).
// Returns the y just below the last line.
function drawWrapped(x: number, y: number, maxW: number, s: string, scale: number, c: [number, number, number], leading?: number): number {
  const lh = leading ?? Math.round(7 * scale * 1.45);
  const words = s.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const trial = line ? line + ' ' + word : word;
    if (textWidth(trial, scale) > maxW && line) {
      drawText(x, cy, line, scale, c);
      cy += lh;
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) drawText(x, cy, line, scale, c);
  return cy + lh;
}

// ------------------------------------------------------------- PNG write
function crc32(buf: Buffer): number {
  let table = (crc32 as unknown as { t?: Int32Array }).t;
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    (crc32 as unknown as { t: Int32Array }).t = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function writePNG(path: string): void {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: none
    buf.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}

// =================================================================== page
rect(0, 0, W, H, PAPER);
// outer double border
rect(0, 0, W, 6, INK);
rect(0, H - 6, W, 6, INK);
rect(0, 0, 6, H, INK);
rect(W - 6, 0, 6, H, INK);
rect(14, 14, W - 28, 2, INK);
rect(14, H - 16, W - 28, 2, INK);

// ---- masthead
drawTextCentered(512, 34, 'THE WORLD TODAY', 7, INK);
drawTextCentered(512, 92, 'THURSDAY  19 NOVEMBER 2026', 3, RED);
hline(28, 128, W - 56, INK, 3);
hline(28, 134, W - 56, INK, 1);
drawText(28, 146, 'ONE DAY  -  ONE PAGE  -  SIX STORIES', 2, GREY);
drawText(1024 - 28 - textWidth('PRICE: THE NEWS ITSELF', 2), 146, 'PRICE: THE NEWS ITSELF', 2, GREY);

// ---- lead story: GTA VI (full width band, y 168..428)
const LY = 168;
rect(28, LY, W - 56, 260, NAVY);
// skyline + sun illustration on the right half
disc(830, 250, 46, GOLD);
disc(830, 250, 34, ORANGE);
rect(640, 300, 60, 128, INK);
rect(712, 270, 52, 158, INK);
rect(776, 320, 56, 108, INK);
rect(844, 288, 58, 140, INK);
rect(914, 330, 48, 98, INK);
// lit windows
for (let i = 0; i < 5; i++) {
  rect(652 + i * 6, 312 + (i % 2) * 22, 4, 6, GOLD);
  rect(724 + i * 6, 282 + (i % 3) * 18, 4, 6, GOLD);
  rect(856 + i * 6, 300 + (i % 2) * 20, 4, 6, GOLD);
}
// road
rect(28, 396, W - 56, 32, INK);
for (let x = 44; x < 990; x += 48) rect(x, 410, 26, 4, GOLD);
// palm tree (simple)
rect(610, 340, 6, 88, INK);
tri(613, 340, 560, 330, 600, 352, INK);
tri(613, 340, 668, 326, 628, 350, INK);
tri(613, 336, 596, 306, 620, 330, INK);

drawText(48, LY + 18, 'LEAD  -  CULTURE', 2, GOLD);
drawText(48, LY + 48, 'VICE CITY', 6, rgb(255, 255, 255));
drawText(48, LY + 96, 'OPENS', 6, rgb(255, 255, 255));
drawText(48, LY + 152, 'GTA VI unlocks at midnight', 3, rgb(255, 255, 255));
drawText(48, LY + 182, 'worldwide, starting in', 3, rgb(255, 255, 255));
drawText(48, LY + 212, 'New Zealand.', 3, rgb(255, 255, 255));
// deck inside navy band, left column width ~560

// ---- row A: two stories, y 448..664
const AY = 448;
const ACOL = 470; // column width
// A1: summit (left)
drawText(28, AY, 'DIPLOMACY', 2, RED);
drawText(28, AY + 26, 'THREE LEADERS,', 3, INK);
drawText(28, AY + 52, 'ONE TABLE', 3, INK);
// three flags motif
rect(28, AY + 92, 96, 10, RED);
rect(28, AY + 108, 96, 10, GOLD);
rect(28, AY + 124, 96, 10, NAVY);
drawText(140, AY + 96, 'USA', 2, INK);
drawText(140, AY + 118, 'CHINA - RUSSIA', 2, INK);
const endA1 = drawWrapped(
  28, AY + 148, ACOL,
  'Trump, Xi and Putin meet in Shenzhen for a rare trilateral summit.',
  2, INK,
);
drawText(28, endA1 + 8, 'Source: The New York Times, 19 Nov 2026', 1, GREY);
vline(512, AY, 216, INK, 2);

// A2: Voyager (right)
drawText(536, AY, 'SCIENCE', 2, RED);
drawText(536, AY + 26, 'ONE LIGHT-DAY', 3, INK);
drawText(536, AY + 52, 'FROM HOME', 3, INK);
// starfield + probe motif
rect(536, AY + 88, 220, 56, INK);
for (const [sx, sy] of [[556, 100], [600, 128], [640, 96], [690, 118], [720, 100], [580, 112], [668, 136]] as const) {
  rect(sx, AY + sy - 88 + 88, 3, 3, rgb(255, 255, 255));
}
disc(700, AY + 116, 12, GOLD);
rect(556, AY + 108, 60, 8, rgb(255, 255, 255));
tri(616, AY + 104, 616, AY + 120, 640, AY + 112, rgb(255, 255, 255));
const endA2 = drawWrapped(
  536, AY + 148, ACOL,
  'Voyager 1, launched in 1977, is now a light-day from Earth.',
  2, INK,
);
drawText(536, endA2 + 8, 'Source: NASA, 19 Nov 2026', 1, GREY);
hline(28, AY + 216, W - 56, INK, 2);

// ---- row B: three stories, y 684..916
const BY = 684;
const BCOL = 300;
// B1: Cyclone Akvan
drawText(28, BY, 'WEATHER  -  ASIA', 2, RED);
drawText(28, BY + 26, 'CYCLONE AKVAN', 3, INK);
drawText(28, BY + 52, 'NEARS INDIA', 3, INK);
// spiral motif
ring(88, BY + 118, 34, 5, TEAL);
ring(88, BY + 118, 22, 5, TEAL);
ring(88, BY + 118, 10, 5, TEAL);
disc(88, BY + 118, 5, RED);
const endB1 = drawWrapped(
  28, BY + 164, BCOL,
  'Set to cross the coast between Machilipatnam and Puri.',
  2, INK,
);
drawText(28, endB1 + 8, 'Source: The Hindu, 19 Nov 2026', 1, GREY);
vline(348, BY, 232, INK, 1);

// B2: Crimean Bridge
drawText(368, BY, 'WAR  -  UKRAINE', 2, RED);
drawText(368, BY + 26, 'CRIMEAN BRIDGE', 3, INK);
drawText(368, BY + 52, 'HIT AGAIN', 3, INK);
// bridge arch + burst motif
rect(368, BY + 96, 220, 8, INK);
for (let i = 0; i < 5; i++) rect(384 + i * 44, BY + 104, 6, 34, INK);
disc(478, BY + 92, 14, ORANGE);
disc(478, BY + 92, 7, GOLD);
const endB2 = drawWrapped(
  368, BY + 164, BCOL,
  'A Russian official says the Kerch bridge was hit again.',
  2, INK,
);
drawText(368, endB2 + 8, 'Source: BBC News, 19 Nov 2026', 1, GREY);
vline(688, BY, 232, INK, 1);

// B3: Gaza aid
drawText(708, BY, 'MIDDLE EAST', 2, RED);
drawText(708, BY + 26, 'FOUR NATIONS', 3, INK);
drawText(708, BY + 52, 'URGE GAZA AID', 3, INK);
// waves motif
for (let r = 0; r < 3; r++) {
  for (let x = 708; x < 968; x += 24) {
    rect(x, BY + 96 + r * 14, 14, 6, SEA);
  }
}
rect(708, BY + 140, 260, 4, RED);
const endB3 = drawWrapped(
  708, BY + 164, BCOL,
  'Australia, Canada, Italy and the UK call for immediate aid access.',
  2, INK,
);
drawText(708, endB3 + 8, 'Source: The Paris Eye, 19 Nov 2026', 1, GREY);

// ---- footer
hline(28, 936, W - 56, INK, 2);
drawTextCentered(
  512, 950,
  'SOURCES: REUTERS - NYT - NASA - THE HINDU - BBC - THE PARIS EYE',
  2, INK,
);
drawTextCentered(
  512, 972,
  'ALL STORIES VERIFIED AGAINST REPORTING DATED 19 NOVEMBER 2026',
  2, GREY,
);

// ---- write
const outDir = process.env.MAKEFUN_OUTPUT_DIR || 'out';
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'entry.png');
writePNG(outPath);
console.log('wrote', outPath, W + 'x' + H);
