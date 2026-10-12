export const WIDTH = 240;
export const HEIGHT = 160;

export const hex = (value: number, digits = 8) => `0x${value.toString(16).padStart(digits, '0')}`;
export const thousands = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, "'");

// GBA colors are 15-bit: red in bits 0-4, green in 5-9 and blue in 10-14.
export const channels = (color: number) => [color & 31, (color >> 5) & 31, (color >> 10) & 31];
export const expand = (value: number) => (value << 3) | (value >> 2);
export const rgb = (color: number) => channels(color).map(expand);

export type Frame = { indices: Uint8Array; palette: Uint16Array };

export async function loadFrame(): Promise<Frame> {
  const response = await fetch('/data/gba-bitmap/frame.bin');
  if (!response.ok) throw new Error(`Frame request: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const palette = new Uint16Array(256);
  for (let i = 0; i < 256; i++)
    palette[i] = bytes[WIDTH * HEIGHT + i * 2] | (bytes[WIDTH * HEIGHT + i * 2 + 1] << 8);
  return { indices: bytes.subarray(0, WIDTH * HEIGHT), palette };
}

// A mode 3 frame: one little-endian 15-bit color per pixel.
export async function loadDirectFrame(): Promise<Uint16Array> {
  const response = await fetch('/data/gba-bitmap/gba-video.bin');
  if (!response.ok) throw new Error(`Frame request: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return Uint16Array.from({ length: WIDTH * HEIGHT }, (_, i) => bytes[i * 2] | (bytes[i * 2 + 1] << 8));
}

export function canvasPoint(canvas: HTMLCanvasElement, event: MouseEvent, width = WIDTH, height = HEIGHT) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: Math.max(0, Math.min(width - 1, Math.floor(((event.clientX - rect.left) / rect.width) * width))),
    y: Math.max(0, Math.min(height - 1, Math.floor(((event.clientY - rect.top) / rect.height) * height))),
  };
}

export const arrowMoves: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

// A 16-bit register or map entry drawn as its bits, colored by field, with the decoded fields below.
// Every field gets its own color in the order it's listed. Unused bits, and bits no field covers, are striped.
export type BitField = { from: number; to: number; name: string; value: string; unused?: boolean };
const BIT_COLORS = ['blue', 'red', 'gold', 'green', 'purple', 'teal', 'orange', 'pink', 'olive', 'slate'];

export function bitStrip(label: string, raw: number, fields: BitField[]) {
  let next = 0;

  const colored = fields.map(f => ({
    ...f,
    color: f.unused ? 'unused' : BIT_COLORS[next++ % BIT_COLORS.length],
  }));

  const owner = (bit: number) => colored.find(f => bit >= f.from && bit <= f.to);

  const cells = Array.from({ length: 16 }, (_, i) => {
    const bit = 15 - i;
    const field = owner(bit);
    return `<span class="gx-bit gx-bit-${field ? field.color : 'unused'}">${(raw >> bit) & 1}</span>`;
  }).join('');

  const names = [...colored]
    .filter(f => !f.unused)
    .sort((a, b) => b.from - a.from)
    .map(f => `<li><span class="gx-swatch gx-bit-${f.color}"></span>${f.name} <b>${f.value}</b></li>`)
    .join('');
  return (
    `<div class="gx-bits"><div class="gx-bits-head"><span>${label}</span><code>${hex(raw, 4)}</code></div>` +
    `<div class="gx-bits-cells" aria-hidden="true">${cells}</div><ul class="gx-bits-fields">${names}</ul></div>`
  );
}
