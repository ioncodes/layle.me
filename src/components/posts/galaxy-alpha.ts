/** Byte-space TEV stage 2 for FileSelectDataMario / EyeMat_v. */
export const eyeWideAlpha = (textureAlpha: number) => 255 + 128 + ((textureAlpha * 64 + 128) >> 8);
export const lowByte = (value: number) => value & 255;
export const eyePasses = (alpha: number) => alpha >= 128 && alpha <= 255;
export type OutputMode = 'wrap' | 'clamp' | 'unchanged';
export const convertAlpha = (value: number, mode: OutputMode) => mode === 'wrap' ? lowByte(value) : mode === 'clamp' ? Math.min(255, Math.max(0, value)) : value;
