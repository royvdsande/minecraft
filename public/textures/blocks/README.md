# Block textures

Drop **real PNG** block textures here. The game builds a texture atlas from this
folder at startup. Anything missing is replaced by an auto-generated placeholder
(flat colour + label), and the missing names are logged to the console — so the
game always runs, even with an empty folder.

## Rules

- **Format:** PNG, **square** and all the **same size**. 16×16 is the classic
  Minecraft resolution and the recommended default, but any uniform square size
  (32×32, 48×48, …) works — the atlas adapts to keep pixels crisp.
- **Naming:** lower_snake_case, following the Minecraft wiki texture names.
  A space-named file (`grass block side.png`) is also accepted, but underscores
  are the canonical convention.
- **Location:** this exact folder — `public/textures/blocks/`.
- Files here are served as static assets (Vite copies `public/` verbatim), so
  the runtime path is `/textures/blocks/<name>.png`.

## Naming: side-view faces

This is a 2D side-view game, so each block is drawn with **one** face — its
side. For blocks whose faces differ (like grass), use the `_side` texture.

| Texture key        | File                   | Notes                                 |
| ------------------ | ---------------------- | ------------------------------------- |
| `stone`            | `stone.png`            |                                       |
| `dirt`             | `dirt.png`             |                                       |
| `grass_block_side` | `grass_block_side.png` | grass shown from the side             |
| `cobblestone`      | `cobblestone.png`      |                                       |
| `sand`             | `sand.png`             |                                       |
| `gravel`           | `gravel.png`           |                                       |
| `oak_log`          | `oak_log.png`          | log side                              |
| `oak_planks`       | `oak_planks.png`       |                                       |
| `oak_leaves`       | `oak_leaves.png`       |                                       |
| `bedrock`          | `bedrock.png`          |                                       |
| `coal_ore`         | `coal_ore.png`         |                                       |
| `iron_ore`         | `iron_ore.png`         |                                       |
| `water_still`      | `water_still.png`      | oceans/lakes; may be semi-transparent |

> The authoritative list of texture keys lives in the block register
> (`src/blocks/`). Add a block there (data only) and give it a `textureKey`;
> then drop the matching PNG here. Until you do, you'll see a labelled
> placeholder in-game.
