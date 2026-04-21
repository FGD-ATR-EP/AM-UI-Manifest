export type TextPointCloudOptions = {
  text: string;
  count: number;
  width?: number;
  height?: number;
  fontFamily?: string;
};

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 320;

export function buildTextPointCloud({
  text,
  count,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  fontFamily = 'Inter, "Noto Sans Thai", sans-serif'
}: TextPointCloudOptions): Float32Array {
  const output = new Float32Array(count * 3);
  const safeText = text.trim() || 'HELLO';

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return output;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const maxChars = Math.max(4, Math.min(22, safeText.length));
  const fontSize = Math.max(52, Math.min(160, (width / maxChars) * 1.5));
  ctx.font = `700 ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(safeText.slice(0, 28), width * 0.5, height * 0.52);

  const image = ctx.getImageData(0, 0, width, height).data;
  const sampled: Array<[number, number]> = [];

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const alpha = image[(y * width + x) * 4 + 3];
      if (alpha > 64) sampled.push([x, y]);
    }
  }

  const fallbackRadius = Math.min(width, height) * 0.2;
  const scale = 0.58;

  for (let i = 0; i < count; i += 1) {
    let px = 0;
    let py = 0;

    if (sampled.length > 0) {
      const [sx, sy] = sampled[(Math.random() * sampled.length) | 0] ?? [width * 0.5, height * 0.5];
      px = (sx - width * 0.5) * scale;
      py = (height * 0.5 - sy) * scale;
    } else {
      const angle = Math.random() * Math.PI * 2;
      const radius = fallbackRadius * Math.sqrt(Math.random());
      px = Math.cos(angle) * radius;
      py = Math.sin(angle) * radius;
    }

    output[i * 3] = px + (Math.random() - 0.5) * 1.8;
    output[i * 3 + 1] = py + (Math.random() - 0.5) * 1.8;
    output[i * 3 + 2] = (Math.random() - 0.5) * 8;
  }

  return output;
}
