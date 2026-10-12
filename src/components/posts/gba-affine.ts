import { WIDTH, HEIGHT } from './gba-bitmap';
import { color, type Capture } from './gba-video';

// A rotating background: always 8 bits per pixel, square, with 1-byte map entries.
export type AffineBackground = {
  index: number;
  size: number;
  tileBase: number;
  mapBase: number;
  wrap: boolean;
};

export type Matrix = { pa: number; pb: number; pc: number; pd: number };

export function affineBackground(capture: Capture, index: number): AffineBackground {
  const cnt = capture.bg[index].cnt;

  return {
    index,
    size: 128 << (cnt >> 14),
    tileBase: ((cnt >> 2) & 3) * 0x4000,
    mapBase: ((cnt >> 8) & 31) * 0x800,
    wrap: Boolean(cnt & 0x2000),
  };
}

// Palette index of one texel, or -1 when it's transparent or outside a background without wraparound.
export function affineTexel(capture: Capture, bg: AffineBackground, tx: number, ty: number, wrap = bg.wrap) {
  if (wrap) {
    tx &= bg.size - 1;
    ty &= bg.size - 1;
  } else if (tx < 0 || ty < 0 || tx >= bg.size || ty >= bg.size) {
    return -1;
  }

  const tile = capture.vram[bg.mapBase + (ty >> 3) * (bg.size >> 3) + (tx >> 3)];
  const index = capture.vram[bg.tileBase + tile * 64 + (ty & 7) * 8 + (tx & 7)];
  return index || -1;
}

// The whole background as RGBA, with transparent texels left at alpha 0.
export function affineImage(capture: Capture, bg: AffineBackground) {
  const image = new ImageData(bg.size, bg.size);

  for (let y = 0; y < bg.size; y++)
    for (let x = 0; x < bg.size; x++) {
      const index = affineTexel(capture, bg, x, y, false);
      if (index >= 0) image.data.set([...color(capture, index), 255], (y * bg.size + x) * 4);
    }

  return image;
}

// Draws the screen line by line like the hardware: start at the reference point,
// add PA and PC for every pixel, and PB and PD to the reference point after every line.
export function renderAffine(
  capture: Capture,
  bg: AffineBackground,
  matrix: Matrix,
  origin: { x: number; y: number },
  wrap = bg.wrap,
) {
  const image = new ImageData(WIDTH, HEIGHT);
  const backdrop = [...color(capture, 0), 255];
  let { x: lineX, y: lineY } = origin;

  for (let line = 0; line < HEIGHT; line++) {
    let x = lineX;
    let y = lineY;

    for (let col = 0; col < WIDTH; col++) {
      const index = affineTexel(capture, bg, x >> 8, y >> 8, wrap);
      image.data.set(index < 0 ? backdrop : [...color(capture, index), 255], (line * WIDTH + col) * 4);
      x += matrix.pa;
      y += matrix.pc;
    }

    lineX += matrix.pb;
    lineY += matrix.pd;
  }

  return image;
}

// PA to PD for showing an image rotated clockwise by `degrees` and magnified by `scale`.
// The hardware needs the inverse: how far to move through the background per screen pixel.
export function rotationMatrix(degrees: number, scale: number): Matrix {
  const r = (degrees * Math.PI) / 180;
  const fixed = (v: number) => Math.max(-32768, Math.min(32767, Math.round((v * 256) / scale)));

  return { pa: fixed(Math.cos(r)), pb: fixed(Math.sin(r)), pc: fixed(-Math.sin(r)), pd: fixed(Math.cos(r)) };
}

// Angle and magnification encoded in a rotation matrix, the inverse of rotationMatrix.
export function decompose({ pa, pb }: Matrix) {
  return { degrees: (Math.atan2(pb, pa) * 180) / Math.PI, scale: 256 / Math.hypot(pa, pb) };
}

// The reference point that puts background point (cx, cy) at screen point (sx, sy).
export function centeredOrigin(matrix: Matrix, cx: number, cy: number, sx = WIDTH / 2, sy = HEIGHT / 2) {
  return {
    x: Math.round(cx * 256 - matrix.pa * sx - matrix.pb * sy),
    y: Math.round(cy * 256 - matrix.pc * sx - matrix.pd * sy),
  };
}

// A parameter in 1/256 steps, as the signed decimal value a reader can check.
export const fixed8 = (value: number) => {
  const text = (value / 256).toFixed(3).replace(/\.?0+$/, '');
  return text === '-0' ? '0' : text.replace('-', '−');
};

// The 16-bit register value of a parameter, as written to PA to PD.
export const halfword = (value: number) => `0x${(value & 0xffff).toString(16).padStart(4, '0')}`;

// The 28-bit register value of a reference point.
export const word28 = (value: number) => `0x${(value & 0xfffffff).toString(16).padStart(7, '0')}`;
