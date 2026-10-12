import { WIDTH, HEIGHT, rgb } from './gba-bitmap';

const SIZES: Record<string, [number, number]> = {
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

export type Sprite = {
  index: number;
  attr: [number, number, number];
  x: number;
  y: number;
  width: number;
  height: number;
  tile: number;
  palette: number;
  priority: number;
  bpp8: boolean;
  hflip: boolean;
  vflip: boolean;
};

export type SpriteFrame = {
  dispcnt: number;
  oam: Uint16Array;
  palette: Uint16Array;
  vram: Uint8Array;
  background: ImageData;
};

// The capture holds DISPCNT, OAM, the sprite palette and VRAM from 0x06010000.
export async function loadSpriteFrame(name: string): Promise<SpriteFrame> {
  const [data, image] = await Promise.all([
    fetch(`/data/gba-bitmap/${name}.bin`).then(r => {
      if (!r.ok) throw new Error();
      return r.arrayBuffer();
    }),
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `/images/gba-bitmap/${name}-bg.png`;
    }),
  ]);

  const bytes = new Uint8Array(data);
  const half = (offset: number, count: number) =>
    Uint16Array.from({ length: count }, (_, i) => bytes[offset + i * 2] | (bytes[offset + i * 2 + 1] << 8));
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);

  return {
    dispcnt: bytes[0] | (bytes[1] << 8),
    oam: half(4, 512),
    palette: half(4 + 1024, 256),
    vram: bytes.subarray(4 + 1024 + 512),
    background: context.getImageData(0, 0, WIDTH, HEIGHT),
  };
}

// Regular (non-affine) sprites that are enabled, in OAM order.
export function sprites(frame: SpriteFrame): Sprite[] {
  const result: Sprite[] = [];

  for (let index = 0; index < 128; index++) {
    const a0 = frame.oam[index * 4];
    const a1 = frame.oam[index * 4 + 1];
    const a2 = frame.oam[index * 4 + 2];
    if (a0 & 0x100 || a0 & 0x200) continue;
    const size = SIZES[`${a0 >> 14},${a1 >> 14}`];
    if (!size) continue;

    result.push({
      index,
      attr: [a0, a1, a2],
      x: a1 & 511,
      y: a0 & 255,
      width: size[0],
      height: size[1],
      tile: a2 & 1023,
      palette: a2 >> 12,
      priority: (a2 >> 10) & 3,
      bpp8: Boolean(a0 & 0x2000),
      hflip: Boolean(a1 & 0x1000),
      vflip: Boolean(a1 & 0x2000),
    });
  }

  return result;
}

// Palette index of one sprite pixel, or 0 when it's transparent.
export function spritePixel(
  frame: SpriteFrame,
  sprite: Sprite,
  x: number,
  y: number,
  oneDimensional: boolean,
) {
  const tileBytes = sprite.bpp8 ? 64 : 32;
  const rowTiles = oneDimensional ? sprite.width / 8 : 1024 / tileBytes;
  const row = sprite.vflip ? sprite.height - 1 - y : y;
  const col = sprite.hflip ? sprite.width - 1 - x : x;
  const address = sprite.tile * 32 + (Math.floor(row / 8) * rowTiles + Math.floor(col / 8)) * tileBytes;
  if (address + tileBytes > frame.vram.length) return 0;
  if (sprite.bpp8) return frame.vram[address + (row % 8) * 8 + (col % 8)];

  return (frame.vram[address + (row % 8) * 4 + (col % 8 >> 1)] >> ((col % 2) * 4)) & 15;
}

export function spriteColor(frame: SpriteFrame, sprite: Sprite, index: number) {
  return rgb(frame.palette[(sprite.bpp8 ? 0 : sprite.palette * 16) + index]);
}

// Tile number of the 8 × 8 tile at a tile position inside the sprite.
export function tileAt(sprite: Sprite, tx: number, ty: number, oneDimensional: boolean) {
  const tileBytes = sprite.bpp8 ? 64 : 32;
  const rowTiles = oneDimensional ? sprite.width / 8 : 1024 / tileBytes;
  return sprite.tile + (ty * rowTiles + tx) * (tileBytes / 32);
}

// Rows wrap at 256, so a sprite at y = 247 continues at the top of the screen.
export const spriteRow = (sprite: Sprite, line: number) => (line - sprite.y) & 255;

export function render(frame: SpriteFrame, image: ImageData, list: Sprite[], oneDimensional: boolean) {
  image.data.set(frame.background.data);

  for (const sprite of [...list].reverse()) {
    for (let line = 0; line < HEIGHT; line++) {
      const row = spriteRow(sprite, line);
      if (row >= sprite.height) continue;

      for (let col = 0; col < sprite.width; col++) {
        const x = (sprite.x + col) & 511;
        if (x >= WIDTH) continue;
        const index = spritePixel(frame, sprite, col, row, oneDimensional);
        if (!index) continue;
        image.data.set([...spriteColor(frame, sprite, index), 255], (line * WIDTH + x) * 4);
      }
    }
  }
}

export function contains(sprite: Sprite, x: number, y: number) {
  return ((x - sprite.x) & 511) < sprite.width && spriteRow(sprite, y) < sprite.height;
}

export function onScreen(sprite: Sprite) {
  let rows = false;
  let cols = false;
  for (let line = 0; line < HEIGHT && !rows; line++) rows = spriteRow(sprite, line) < sprite.height;
  for (let col = 0; col < sprite.width && !cols; col++) cols = ((sprite.x + col) & 511) < WIDTH;
  return rows && cols;
}
