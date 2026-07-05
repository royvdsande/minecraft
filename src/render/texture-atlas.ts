import { Rectangle, Texture } from 'pixi.js';
import { TEXTURE_SIZE } from '@/core/constants';

/**
 * Texture pipeline (see CLAUDE.md, "Textures & texture-pipeline"):
 *
 * 1. Try to load `public/textures/blocks/<key>.png` for every requested key.
 * 2. Pack everything into ONE atlas canvas; sprites reference sub-frames of
 *    the same GPU texture, so tile rendering never switches textures.
 * 3. Any missing/broken file becomes a generated placeholder (flat colour
 *    derived from the key + a short label) and is reported, so the game
 *    always runs even with an empty textures folder.
 */

export interface BlockAtlas {
  /** Texture keys that had no usable PNG and got a placeholder. */
  readonly missing: readonly string[];
  /** Sub-texture for a key. Throws on unknown keys (registry bug). */
  texture(key: string): Texture;
}

function texturePath(key: string): string {
  return `${import.meta.env.BASE_URL}textures/blocks/${key}.png`;
}

/** Fetch one texture image; null if missing or not decodable as an image. */
async function loadImage(url: string): Promise<ImageBitmap | null> {
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

/** Deterministic, distinct-ish colour per texture key. */
function keyColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360} 45% 45%)`;
}

/** Recognisable stand-in: flat colour, dark border, first letters as label. */
function drawPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, key: string): void {
  ctx.fillStyle = keyColor(key);
  ctx.fillRect(x, y, TEXTURE_SIZE, TEXTURE_SIZE);
  ctx.strokeStyle = 'rgba(0 0 0 / 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, TEXTURE_SIZE - 1, TEXTURE_SIZE - 1);
  ctx.fillStyle = '#ffffff';
  ctx.font = '6px monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(key.slice(0, 3), x + 2, y + 2, TEXTURE_SIZE - 4);
  ctx.fillText(key.slice(3, 6), x + 2, y + 9, TEXTURE_SIZE - 4);
}

export async function loadBlockAtlas(keys: readonly string[]): Promise<BlockAtlas> {
  const unique = [...new Set(keys)];
  const images = await Promise.all(unique.map((key) => loadImage(texturePath(key))));

  const cols = Math.max(1, Math.ceil(Math.sqrt(unique.length)));
  const rows = Math.max(1, Math.ceil(unique.length / cols));
  const canvas = document.createElement('canvas');
  canvas.width = cols * TEXTURE_SIZE;
  canvas.height = rows * TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create 2D context for the texture atlas');
  ctx.imageSmoothingEnabled = false;

  const missing: string[] = [];
  const frames = new Map<string, Rectangle>();
  unique.forEach((key, i) => {
    const x = (i % cols) * TEXTURE_SIZE;
    const y = Math.floor(i / cols) * TEXTURE_SIZE;
    const image = images[i];
    if (image) {
      ctx.drawImage(image, x, y, TEXTURE_SIZE, TEXTURE_SIZE);
    } else {
      missing.push(key);
      drawPlaceholder(ctx, x, y, key);
    }
    frames.set(key, new Rectangle(x, y, TEXTURE_SIZE, TEXTURE_SIZE));
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
      '\nDrop 16x16 PNGs into public/textures/blocks/ (see its README.md).',
    );
  }

  return {
    missing,
    texture(key: string): Texture {
      const tex = textures.get(key);
      if (!tex) throw new Error(`Unknown texture key: ${key}`);
      return tex;
    },
  };
}
