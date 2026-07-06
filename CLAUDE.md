# CLAUDE.md — Minecraft 2D

Projectgids voor Claude (en voor mij). Lees dit vóór elke wijziging. Houd dit
bestand up-to-date: werk minimaal **de huidige milestone** bij na elke stap.

2D side-view Minecraft-remake. Singleplayer, survival. Voor eigen gebruik.
Denk _Paper Minecraft_ (Griffpatch), maar robuust en netjes geëngineerd.

---

## Stack (niet afwijken zonder overleg)

- **Taal:** TypeScript, `strict` aan (plus `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes` e.d. — zie `tsconfig.json`).
- **Bundler/dev-server:** Vite.
- **Renderer:** PixiJS v8 (WebGL). Verder **geen** game-framework; het
  wereldmodel is volledig custom.
- **Tests:** Vitest (unit tests voor de pure logica).
- **Kwaliteit:** ESLint (flat config, type-checked) + Prettier.
- **Deploy:** schone statische Vite-productionbuild → `dist/`, 1-op-1 op Vercel
  (`vercel.json` aanwezig). **Geen Node-only dependencies in de browserbundel.**

### Commands

| Doel                | Command              |
| ------------------- | -------------------- |
| Dev-server          | `npm run dev`        |
| Productionbuild     | `npm run build`      |
| Build previewen     | `npm run preview`    |
| Tests (eenmalig)    | `npm test`           |
| Tests (watch)       | `npm run test:watch` |
| Typecheck           | `npm run typecheck`  |
| Lint + format-check | `npm run lint`       |
| Auto-fix + format   | `npm run lint:fix`   |

`npm run build` draait eerst `tsc --noEmit` (typecheck) en faalt de build bij
type-fouten. Na elke milestone moeten `npm run build` én `npm test` groen zijn.

---

## Architectuurregels (dit maakt of breekt "robuust")

1. **Chunk-based wereld.** Elke chunk is `CHUNK_WIDTH (16) × WORLD_HEIGHT (256)`
   blocks en slaat block-ID's op in één **`Uint16Array`** — nooit een array van
   objecten. Chunks laden/unloaden rond de speler → effectief oneindige wereld.
2. **Simulatie losgekoppeld van rendering.** Vaste timestep (60 Hz) voor
   game-logica/physics; rendering apart met interpolatie (`alpha`).
   **Game-snelheid hangt NOOIT van de framerate af.** Zie `src/core/loop.ts`.
3. **Block-types data-driven.** Eén centraal register (`id -> { name, solid,
textureKey, hardness, drops, ... }`). Nieuw block toevoegen = **data**, geen
   nieuw code-pad.
4. **Saves in IndexedDB.** Chunks serialiseren naar IndexedDB. **Geen backend.**

Aanvullende principes:

- **Pure logica is testbaar.** Noise-gen, chunk-manager, inventory en
  block-register bevatten geen Pixi/DOM-afhankelijkheden zodat Vitest ze
  headless kan draaien. Rendering blijft in `src/render/`.
- **Geen magic numbers voor coördinaten.** Alles via `src/core/constants.ts`.
- **Determinisme.** Terreingeneratie is seeded en reproduceerbaar: zelfde seed +
  zelfde chunkcoördinaat ⇒ exact dezelfde blocks.

---

## Coördinatensysteem

Bron van waarheid: `src/core/constants.ts`. Kort:

- De wereld is **oneindig langs X**, **vaste hoogte langs Y** (`WORLD_HEIGHT =
256`).
- **Block-coördinaten `(bx, by)`** zijn gehele getallen.
- **De Y-as wijst OMLAAG.** `by = 0` = bovenkant lucht, `by = 255` = onderkant
  (bedrock). Zwaartekracht versnelt entities richting **+Y**. (Deze keuze houdt
  block-coördinaten gelijk aan array-indices en aan schermruimte — geen
  y-flips.)
- **Entity-posities zijn floats in BLOCK-EENHEDEN** (1 eenheid = 1 block), nooit
  in pixels. Pixels bestaan alleen bij het renderen (`worldToScreen` in
  `src/render/camera.ts`).
- **Entity-anker = VOETEN-MIDDEN.** `(x, y)` van een entity is het horizontale
  midden van het lichaam op voethoogte. Op block-rij `by` staan ⇒ `y === by`.
  AABB: `[x - W/2, y - H] .. [x + W/2, y]`. Zie `src/entity/player.ts`.
- **De render-scenegraph staat in block-units.** Sprites zijn 1×1; de camera
  schaalt de wereld-container naar pixels (`pixelsPerBlock`).
- **Chunk-index:** `chunkX = floor(bx / 16)` (`chunkXOf`). Lokale X binnen een
  chunk: `localXOf(bx)` ∈ `[0,15]`.
- **Opslag-index binnen een chunk:** `index = localY * CHUNK_WIDTH + localX`
  (row-major, `localY = by`).

---

## Mapstructuur

```
public/
  textures/blocks/     PNG block-textures (zie hieronder). Vite kopieert public/ 1:1.
src/
  core/                constants, game-loop (fixed timestep), tijd
  world/               chunk (Uint16Array), world, interaction
  blocks/              block-register + block-definities (data-driven)
  render/              Pixi-app, texture-atlas, camera, chunk-view
  entity/              speler + physics
  gen/                 prng/hash, value-noise/fbm, terreingenerator
  input/               keyboard (beweging) + mouse (breken/plaatsen)
  storage/             IndexedDB save/load            (vanaf M7)
  ui/                  hotbar, inventory              (vanaf M6)
  main.ts              entry point / bootstrapping
```

Directories verschijnen wanneer hun milestone begint — niet vooraf leeg
aanmaken.

---

## Textures & texture-pipeline

- Echte **PNG's** (vierkant, onderling gelijke maat; 16×16 aanbevolen, maar
  32/48/… werkt ook) komen in `public/textures/blocks/`. Ik (de gebruiker) vul
  deze map zelf. **Claude verzint of downloadt GEEN textures.**
- Naamgeving volgt de Minecraft-wiki, lower_snake_case, side-view faces (bv.
  `stone.png`, `grass_block_side.png`, `oak_log.png`). Spatie-namen
  (`grass block side.png`) worden ook geaccepteerd; underscores zijn canoniek.
  Volledige lijst + regels: `public/textures/blocks/README.md`.
- Bij startup worden alle PNG's in **één texture-atlas** gebundeld (performance);
  de atlas-celgrootte volgt de native texture-resolutie zodat pixels scherp
  blijven (geen dubbele downscale).
- **Ontbrekende texture ⇒ automatische placeholder** (effen kleur + label) zodat
  de game altijd draait; ontbrekende namen worden naar de console gelogd.
- **Pixel-art blijft scherp:** nearest-neighbour scaling globaal aan
  (`TextureStyle.defaultOptions.scaleMode = 'nearest'` in `src/render/app.ts`),
  `roundPixels`, geen antialias, geen blur.

---

## Naamgevingsconventies

- **Bestanden/mappen:** `kebab-case.ts` (bv. `chunk-manager.ts`).
- **Klassen / types / interfaces:** `PascalCase`.
- **Functies / variabelen:** `camelCase`.
- **Constanten:** `SCREAMING_SNAKE_CASE`.
- **Block string-keys & texture-keys:** `lower_snake_case`, Minecraft-wiki-namen
  (`grass_block`, `oak_log`).
- **Tests:** naast de code als `<naam>.test.ts`.
- **Imports:** absoluut via alias `@/` (= `src/`) waar dat de leesbaarheid helpt.
- **Type-only imports:** `import type { ... }` (ESLint dwingt dit af).

---

## Milestones (survival-basis, elk apart speelbaar)

Werk milestone voor milestone. Na elke milestone: werkende build + kleine,
reviewbare commit met duidelijke message. STOP na M8 en overleg met mij.

- **M0 — Scaffold** ✅ toolchain, fixed-timestep loop, Pixi-canvas, CLAUDE.md.
- **M1** ✅ Render één chunk met tiles + camera. Speler-sprite die stilstaat.
  (Block-register, chunk-opslag, texture-atlas + placeholders, camera.)
- **M2** ✅ Speler-physics: lopen, springen, zwaartekracht, AABB-collision vs
  solids (axis-separated, sub-stepped tegen tunneling), render-interpolatie.
- **M3** ✅ Block breken (links) / plaatsen (rechts) met de muis, reach-limiet,
  target-highlight, live per-cel chunk-view-update. Tijdelijke block-selectie
  (1-9 / muiswiel) tot de echte hotbar in M6.
- **M4** ✅ Procedurele terreingeneratie met seeded value-noise/fbm: oppervlak,
  aarde/zand, steen, grotten, ertsen, biomes (gras/woestijn/strand), water onder
  zeeniveau, bomen (chunk-grens-consistent). Deterministisch per seed+chunkX.
- **M5** ✅ Oneindige wereld: chunks vloeiend laden/unloaden rond de speler.
- **M6** ✅ Inventory + hotbar: opgepakte blocks, selectie, stacking.
- **M7** ✅ Save/load via IndexedDB.
- **M8** ✅ Basis survival-loop: health, honger, fall damage, dag/nacht-cyclus.

**Later (niet nu):** structures, mobs, water-fysica, redstone, enz.

### Huidige milestone

**Post-M8 stap 2 — Minecraft-basisprincipes: KLAAR.** Grote gameplay-stap:
hold-to-mine, item-drops, container-GUI's, crafting table, furnace, chest,
nieuwe ores/items en save-format v2. Stop opnieuw vóór grotere latere features
(structures, mobs, water-fysica, redstone, enz.).

Kern van deze stap:

- **Hold-to-mine.** Linkermuisknop vasthouden mined het target-block met een
  duur op basis van `hardness` (`src/world/mining.ts`) en crack-overlay
  (`src/render/breaking-overlay.ts`). Geen instant-break meer.
- **Item-drops.** Gebroken blokken en Q-drops worden fysieke item-entities
  (`src/entity/item-drop.ts` + `src/render/item-drop-view.ts`): zwaartekracht,
  landen op solids, pickup binnen straal na korte delay, despawn na 5 min.
  Drops zijn bewust nog sessie-geheugen (niet in de save).
- **Achtergrondlaag-gevoel.** Bomen (oak_log/oak_leaves) en functionele blokken
  (crafting_table/furnace/chest) zijn `solid: false`: de speler loopt er vóór
  langs i.p.v. ertegenaan te botsen; breken/plaatsen werkt gewoon.
- **Container-GUI.** `src/ui/inventory-view.ts` is één generiek slot/cursor-
  systeem voor vier schermen: inventory (2x2 craft), crafting table (3x3),
  chest (27 slots) en furnace (input/fuel/output + vlam- en pijl-gauges).
  Linksklik pakt/plaatst/merged/swapt, rechtsklik pakt de helft of plaatst één
  item, shift-klik quick-movet (result-slot: craft alles), hover geeft
  highlight + naam-tooltip. Sluiten (E/Esc) stort craft-grid + cursor terug in
  de inventory; overloop wordt als drop gespawnd.
- **Crafting.** Shapeless recipes, grid-size-agnostisch (`src/ui/crafting.ts`,
  `createDefaultRecipes`): log→4 planks, 2 planks→4 sticks, 4 planks→crafting
  table, 8 cobblestone→furnace, 8 planks→chest (8 ingrediënten passen alleen op
  de 3x3-table). Rechtsklik op een geplaatste crafting table opent de 3x3.
- **Block-entities.** Chest/furnace-state per positie in
  `src/world/block-entities.ts` (`BlockEntityStore`). Plaatsen maakt de entity
  aan; breken laat de inhoud als drops vallen. Furnace-smeltlogica is puur in
  `src/world/furnace.ts` (10 s per item, fuel via `fuelSeconds` in het
  block-register): iron_ore→iron_ingot, gold_ore→gold_ingot, sand→glass,
  cobblestone→stone, oak_log→charcoal. Furnaces ticken door in de game-loop,
  ook met dichte GUI.
- **Nieuwe blocks/items** (append-only in `src/blocks/registry.ts`):
  crafting_table, furnace, chest, gold_ore, diamond_ore, glass + de
  inventory-only items (`item: true`, niet plaatsbaar) stick, coal, charcoal,
  iron_ingot, gold_ingot, diamond. Coal ore dropt nu `coal`; diamond ore dropt
  `diamond`. Terrain genereert gold (diep) en diamond (diepste ~40 lagen).
- **Save v2** (`src/storage/save-data.ts`): naast seed+chunks nu ook
  inventory, block-entities en speler (positie, health, hunger, dagtijd).
  v1-saves laden nog met defaults. Autosave bij edits; brandende furnaces
  triggeren elke ~5 s een save.
- **Overig:** Q dropt één item uit het geselecteerde slot richting de muis;
  R respawnt op de wereld-spawn na dood; HUD toont een controls-regel.

Seed: random bij opstart (of uit de save), getoond in de HUD. Generatie-tuning
staat als constanten boven in `src/gen/terrain.ts`.

GUI- en block/item-textures worden NIET door Claude gedownload of gegenereerd
(Mojang-assets zijn auteursrechtelijk beschermd; deze repo is publiek). De GUI
is eigen pixel-art in Minecraft-indeling; ontbrekende block/item-PNG's krijgen
automatisch placeholders. De benodigde nieuwe bestandsnamen staan in
`public/textures/blocks/README.md` — de gebruiker vult die map zelf.

Let op (tijdelijk):

- Chunk-generatie gebeurt nog synchroon op het moment dat een nieuwe randchunk
  nodig is. De preload-marge voorkomt zichtbare gaten.
- Item-drops op de grond en de open/dicht-status van GUI's zitten niet in de
  save. Eten/food-regen bestaat nog niet (hunger heelt nog niets).
- Water is statisch (non-solid blok onder zeeniveau); stroming/zwemmen komt
  later. Grotten hebben nog geen donkere achtergrondlaag.
- Full-block-hoogteverschillen blokkeren horizontaal lopen (geen auto-step voor
  hele blokken — net als Minecraft; eroverheen = springen).
- Er zijn nog geen tools/durability; alles is met de hand te minen op
  hardness-tijd.

---

## Werkwijze

- Kleine, reviewbare commits per milestone; duidelijke messages.
- Unit tests voor pure logica (noise-gen, chunk-manager, inventory,
  block-register).
- Update de sectie **Huidige milestone** hierboven na elke stap.
- Bij twijfel: leg een korte keuze voor i.p.v. groot te gokken.
