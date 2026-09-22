export const exampleFloats = [0.1, 0.2, 0.3, 1, 2, 3, -1, -2];
export function floatBytes(values: number[]) {
  const buffer = new ArrayBuffer(values.length * 4), view = new DataView(buffer);
  values.forEach((n, i) => view.setFloat32(i * 4, n, false));
  return Array.from(new Uint8Array(buffer));
}
export const hex = (byte: number) => byte.toString(16).padStart(2, '0').toUpperCase();
export function decodeFloat(bytes: number[]) {
  const view = new DataView(new Uint8Array(bytes.slice(0, 4)).buffer);
  return view.getFloat32(0, false);
}
export function formatFloat(value: number) {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return Object.is(value, -0) ? '−0' : '0';
  return Math.abs(value) < 0.0001 || Math.abs(value) >= 1000000
    ? value.toExponential(6).replace('-', '−')
    : Number(value.toPrecision(8)).toLocaleString('en-US', { maximumSignificantDigits: 8 }).replaceAll(',', "'");
}
