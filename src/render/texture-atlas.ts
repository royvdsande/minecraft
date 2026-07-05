import { Rectangle, Texture } from 'pixi.js';
import { TEXTURE_SIZE } from '@/core/constants';

/**
 * Texture pipeline (see CLAUDE.md, "Textures & texture-pipeline"):
 *
 * 1. Load `public/textures/blocks/<key>.png` for every requested key. The key
 *    uses underscores (`coal_ore`); a space-named file (`coal ore.png`) is
 *    accepted too, so uploads from the wiki's display names just work.
 * 2. Pack everything into ONE atlas canvas; sprites reference sub-frames of the
 *    same GPU texture, so tile rendering never switches textures.
 * 3. The atlas cell size adapts to the textures' native resolution (16, 32,
 *    48, … all fine) so pixel-art stays crisp instead of being downscaled.
 * 4. Any missing/broken file becomes a generated placeholder (flat colour +
 *    label) and is reported, so the game always runs — even with an empty
 *    folder.
 */

export interface BlockAtlas {
  /** Texture keys that had no usable PNG and got a placeholder. */
  readonly missing: readonly string[];
  /** Edge length in source pixels of one atlas cell. */
  readonly cellSize: number;
  /** Sub-texture for a key. Throws on unknown keys (registry bug). */
  texture(key: string): Texture;
}

/** Candidate file names for a key, in priority order (underscore, then space). */
function candidateFiles(key: string): string[] {
  const files = [`${key}.png`];
  if (key.includes('_')) files.push(`${key.replaceAll('_', ' ')}.png`);
  return files;
}

function texturePath(file: string): string {
  return `${import.meta.env.BASE_URL}textures/blocks/${encodeURIComponent(file)}`;
}

/** Fetch one texture image; null if missing or not decodable as an image. */
async function fetchImage(url: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    // Vite's dev-server SPA fallback can answer 200 with HTML for missing
    // files; the content-type check filters that out.
    const type = res.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

/** Try each candidate file for a key; return the first that loads, or null. */
async function loadTexture(key: string): Promise<ImageBitmap | null> {
  for (const file of candidateFiles(key)) {
    const image = await fetchImage(texturePath(file));
    if (image) return image;
  }
  return null;
}

/** Deterministic, distinct-ish colour per texture key. */
function keyColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360} 45% 45%)`;
}

/** Recognisable stand-in: flat colour, dark border, first letters as label. */
function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  key: string,
): void {
  const pad = Math.max(1, Math.round(cell * 0.125));
  const font = Math.max(4, Math.round(cell * 0.34));
  ctx.fillStyle = keyColor(key);
  ctx.fillRect(x, y, cell, cell);
  ctx.strokeStyle = 'rgba(0 0 0 / 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
  ctx.fillStyle = '#ffffff';
  ctx.font = `${font}px monospace`;
  ctx.textBaseline = 'top';
  ctx.fillText(key.slice(0, 3), x + pad, y + pad, cell - pad * 2);
  ctx.fillText(key.slice(3, 6), x + pad, y + pad + font + 1, cell - pad * 2);
}

export async function loadBlockAtlas(keys: readonly string[]): Promise<BlockAtlas> {
  const unique = [...new Set(keys)];
  const images = await Promise.all(unique.map((key) => loadTexture(key)));

  // Cell size follows the native texture resolution (square, uniform assumed);
  // fall back to TEXTURE_SIZE when nothing loaded.
  let cell = TEXTURE_SIZE;
  for (const image of images) {
    if (image) cell = Math.max(cell, image.width, image.height);
  }

  const cols = Math.max(1, Math.ceil(Math.sqrt(unique.length)));
  const rows = Math.max(1, Math.ceil(unique.length / cols));
  const canvas = document.createElement('canvas');
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create 2D context for the texture atlas');
  ctx.imageSmoothingEnabled = false;

  const missing: string[] = [];
  const frames = new Map<string, Rectangle>();
  unique.forEach((key, i) => {
    const x = (i % cols) * cell;
    const y = Math.floor(i / cols) * cell;
    const image = images[i];
    if (image) {
      ctx.drawImage(image, x, y, cell, cell);
    } else {
      missing.push(key);
      drawPlaceholder(ctx, x, y, cell, key);
    }
    frames.set(key, new Rectangle(x, y, cell, cell));
  });

  const base = Texture.from(canvas);
  const textures = new Map<string, Texture>();
  for (const [key, frame] of frames) {
    textures.set(key, new Texture({ source: base.source, frame }));
  }

  if (missing.length > 0) {
    console.warn(
      `[textures] ${missing.length}/${unique.length} block texture(s) missing — using placeholders:`,
      missing,
      '\nDrop PNGs into public/textures/blocks/ (see its README.md).',
    );
  }

  return {
    missing,
    cellSize: cell,
    texture(key: string): Texture {
      const tex = textures.get(key);
      if (!tex) throw new Error(`Unknown texture key: ${key}`);
      return tex;
    },
  };
}
