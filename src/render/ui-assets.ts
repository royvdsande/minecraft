import { Assets, Texture } from 'pixi.js';

export const UI_TEXTURES = {
  playerSkin: 'player_skin.png',
  inventory: 'inventory.png',
  hotbar: 'hotbar.png',
  hotbarSelection: 'hotbar_selection.png',
} as const;

export function uiTexturePath(file: string): string {
  return `${import.meta.env.BASE_URL}textures/ui/${file}`;
}

export async function loadUiTextures(): Promise<void> {
  await Assets.load(Object.values(UI_TEXTURES).map(uiTexturePath));
}

export function uiTexture(file: string): Texture {
  return Texture.from(uiTexturePath(file));
}
