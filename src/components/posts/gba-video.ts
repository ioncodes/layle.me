import { WIDTH, HEIGHT, rgb } from './gba-bitmap';

// A full video capture: DISPCNT, BG registers, palette RAM, OAM and VRAM, and for newer
// captures the window and blending registers after VRAM. Captures of rotating backgrounds
// also store each line's affine registers and DISPCNT.
export type Effects = {
  win0h: number;
  win1h: number;
  win0v: number;
  win1v: number;
  winin: number;
  winout: number;
  bldcnt: number;
  bldalpha: number;
  bldy: number;
  mosaic: number;
};

export type Capture = {
  dispcnt: number;
  bg: { cnt: number; hofs: number; vofs: number }[];
  palette: Uint16Array;
  oam: Uint16Array;
  vram: Uint8Array;
  effects?: Effects;
  lines?: AffineLine[];
};

// The registers BG2 and BG3 used for one line: PA to PD and the internal reference point.
export type AffineLine = {
  dispcnt: number;
  bg: { pa: number; pb: number; pc: number; pd: number; x: number; y: number }[];
};

const VRAM_SIZE = 0x18000;

export type Background = {
  index: number;
  priority: number;
  tileBase: number;
  mapBase: number;
  bpp8: boolean;
  width: number;
  height: number;
  hofs: number;
  vofs: number;
};

export type MapEntry = {
  tile: number;
  hflip: boolean;
  vflip: boolean;
  bank: number;
  raw: number;
  address: number;
};

const TEXT_SIZES: [number, number][] = [
  [256, 256],
  [512, 256],
  [256, 512],
  [512, 512],
];

const SPRITE_SIZES: Record<string, [number, number]> = {
  '0,0': [8, 8],
  '0,1': [16, 16],
  '0,2': [32, 32],
  '0,3': [64, 64],
  '1,0': [16, 8],
  '1,1': [32, 8],
  '1,2': [32, 16],
  '1,3': [64, 32],
  '2,0': [8, 16],
  '2,1': [8, 32],
  '2,2': [16, 32],
  '2,3': [32, 64],
};

export async function loadCapture(name: string): Promise<Capture> {
  const response = await fetch(`/data/gba-bitmap/${name}.bin`);
  if (!response.ok) throw new Error(`Capture request: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const half = (offset: number, count: number) =>
    Uint16Array.from({ length: count }, (_, i) => bytes[offset + i * 2] | (bytes[offset + i * 2 + 1] << 8));
  const regs = half(2, 12);
  const vramStart = 32 + 2048;
  const extra = vramStart + VRAM_SIZE;
  let effects: Effects | undefined;

  if (bytes.length >= extra + 18) {
    const [win0h, win1h, win0v, win1v, winin, winout, bldcnt, bldalpha, bldy] = half(extra, 9);

    // Captures made after mosaic support also store MOSAIC.
    const mosaic = bytes.length >= extra + 20 ? half(extra + 18, 1)[0] : 0;
    effects = { win0h, win1h, win0v, win1v, winin, winout, bldcnt, bldalpha, bldy, mosaic };
  }

  let lines: AffineLine[] | undefined;
  const linesStart = extra + 20;

  if (bytes.length >= linesStart + HEIGHT * 50) {
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    const int = (line: number, n: number) => view.getInt32(linesStart + (line * 12 + n) * 4, true);
    lines = Array.from({ length: HEIGHT }, (_, line) => ({
      dispcnt: view.getUint16(linesStart + HEIGHT * 48 + line * 2, true),
      bg: [0, 6].map(o => ({
        pa: int(line, o),
        pb: int(line, o + 1),
        pc: int(line, o + 2),
        pd: int(line, o + 3),
        x: int(line, o + 4),
        y: int(line, o + 5),
      })),
    }));
  }

  return {
    dispcnt: bytes[0] | (bytes[1] << 8),
    bg: [0, 1, 2, 3].map(i => ({
      cnt: regs[i * 3],
      hofs: regs[i * 3 + 1] & 511,
      vofs: regs[i * 3 + 2] & 511,
    })),
    palette: half(32, 512),
    oam: half(32 + 1024, 512),
    vram: bytes.subarray(vramStart, extra),
    effects,
    lines,
  };
}

export const color = (capture: Capture, index: number) => rgb(capture.palette[index]);

export function background(capture: Capture, index: number): Background {
  const { cnt, hofs, vofs } = capture.bg[index];
  const [width, height] = TEXT_SIZES[cnt >> 14];

  return {
    index,
    priority: cnt & 3,
    tileBase: ((cnt >> 2) & 3) * 0x4000,
    mapBase: ((cnt >> 8) & 31) * 0x800,
    bpp8: Boolean(cnt & 0x80),
    width,
    height,
    hofs,
    vofs,
  };
}

// Text backgrounds that are switched on. Only mode 0 has 4 of them.
export const enabledBackgrounds = (capture: Capture) =>
  [0, 1, 2, 3]
    .filter(i => (capture.dispcnt & 7) === 0 && capture.dispcnt & (0x100 << i))
    .map(i => background(capture, i));

// Maps are stored in 32 × 32 blocks of 2 KiB, so a 512-pixel-wide map has 2 blocks side by side.
export function mapEntry(capture: Capture, bg: Background, tileX: number, tileY: number): MapEntry {
  const block = Math.floor(tileY / 32) * (bg.width / 256) + Math.floor(tileX / 32);
  const address = bg.mapBase + block * 0x800 + ((tileY % 32) * 32 + (tileX % 32)) * 2;
  const raw = capture.vram[address] | (capture.vram[address + 1] << 8);

  return {
    tile: raw & 1023,
    hflip: Boolean(raw & 0x400),
    vflip: Boolean(raw & 0x800),
    bank: raw >> 12,
    raw,
    address,
  };
}

// Palette index (0 = transparent) of one pixel of a tile, before any bank is applied.
export function tilePixel(capture: Capture, bg: Background, tile: number, x: number, y: number) {
  const size = bg.bpp8 ? 64 : 32;
  const address = bg.tileBase + tile * size;
  if (address + size > capture.vram.length) return 0;
  if (bg.bpp8) return capture.vram[address + y * 8 + x];

  return (capture.vram[address + y * 4 + (x >> 1)] >> ((x & 1) * 4)) & 15;
}

// Palette index of one pixel of a background map, or -1 when it's transparent.
export function mapPixel(capture: Capture, bg: Background, mapX: number, mapY: number) {
  const entry = mapEntry(capture, bg, mapX >> 3, mapY >> 3);
  const x = entry.hflip ? 7 - (mapX & 7) : mapX & 7;
  const y = entry.vflip ? 7 - (mapY & 7) : mapY & 7;
  const index = tilePixel(capture, bg, entry.tile, x, y);
  return index ? (bg.bpp8 ? 0 : entry.bank * 16) + index : -1;
}

// Screen pixels of one background after scrolling, as palette indexes (-1 = transparent).
export function layer(capture: Capture, bg: Background, hofs = bg.hofs, vofs = bg.vofs) {
  const out = new Int16Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      out[y * WIDTH + x] = mapPixel(capture, bg, (x + hofs) & (bg.width - 1), (y + vofs) & (bg.height - 1));
    }
  return out;
}

// Sprite pixels as OBJ palette indexes plus their priority, lower OAM entries on top.
// Sprites with the mosaic bit use blocks of the given size, lined up with the screen.
export function spriteLayer(capture: Capture, mosaic = { width: 1, height: 1 }) {
  const index = new Int16Array(WIDTH * HEIGHT).fill(-1);
  const priority = new Int8Array(WIDTH * HEIGHT);
  const oneDimensional = Boolean(capture.dispcnt & 0x40);

  for (let n = 127; n >= 0; n--) {
    const [a0, a1, a2] = capture.oam.subarray(n * 4, n * 4 + 3);
    if (a0 & 0x300) continue;
    const size = SPRITE_SIZES[`${a0 >> 14},${a1 >> 14}`];
    if (!size) continue;
    const [w, h] = size;
    const bpp8 = Boolean(a0 & 0x2000);
    const tileBytes = bpp8 ? 64 : 32;
    const block = a0 & 0x1000 ? mosaic : { width: 1, height: 1 };
    const rowTiles = oneDimensional ? w / 8 : 1024 / tileBytes;
    const bank = bpp8 ? 0 : (a2 >> 12) * 16;

    for (let line = 0; line < HEIGHT; line++) {
      let row = (line - (a0 & 255)) & 255;
      if (row >= h) continue;
      row -= Math.min(row, line % block.height);
      if (a1 & 0x2000) row = h - 1 - row;

      for (let i = 0; i < w; i++) {
        const x = ((a1 & 511) + i) & 511;
        if (x >= WIDTH) continue;
        const j = i - Math.min(i, x % block.width);
        const col = a1 & 0x1000 ? w - 1 - j : j;
        const address =
          0x10000 + (a2 & 1023) * 32 + (Math.floor(row / 8) * rowTiles + Math.floor(col / 8)) * tileBytes;
        if (address + tileBytes > capture.vram.length) continue;
        const c = bpp8
          ? capture.vram[address + (row % 8) * 8 + (col % 8)]
          : (capture.vram[address + (row % 8) * 4 + (col % 8 >> 1)] >> ((col & 1) * 4)) & 15;
        if (!c) continue;
        index[line * WIDTH + x] = 256 + bank + c;
        priority[line * WIDTH + x] = (a2 >> 10) & 3;
      }
    }
  }

  return { index, priority };
}

// Paint palette indexes into an image, leaving transparent pixels alone.
export function paint(
  capture: Capture,
  image: ImageData,
  indexes: Int16Array,
  mask?: (i: number) => boolean,
) {
  for (let i = 0; i < indexes.length; i++) {
    if (indexes[i] < 0 || (mask && !mask(i))) continue;
    image.data.set([...color(capture, indexes[i]), 255], i * 4);
  }
}

export function fill(capture: Capture, image: ImageData, index = 0) {
  const [r, g, b] = color(capture, index);
  for (let i = 0; i < image.data.length; i += 4) image.data.set([r, g, b, 255], i);
}

export function checker(image: ImageData, light = [62, 62, 66], dark = [44, 44, 48]) {
  const width = image.width;

  for (let i = 0; i < image.data.length / 4; i++) {
    const x = i % width;
    const y = Math.floor(i / width);
    image.data.set([...(((x >> 2) + (y >> 2)) % 2 ? light : dark), 255], i * 4);
  }
}
