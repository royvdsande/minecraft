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

**Later (niet nu):** structures, crafting, mobs, water-fysica, redstone, enz.

### Huidige milestone

**M8 — basis survival-loop: KLAAR.** STOP hier en overleg vóór latere features
(structures, crafting, mobs, water-fysica, redstone, enz.).

Seed: random bij opstart, getoond in de HUD (per-wereld-seed komt bij save/load
in M7). Generatie-tuning staat als constanten boven in `src/gen/terrain.ts`
(`SEA_LEVEL`, `BASE_SURFACE`, `AMPLITUDE`, freq's, cave-threshold, tree-chance).

Chunk-views worden rond de speler gestreamd met een radius die meegroeit met de
viewportbreedte plus preload-marge. `World` houdt gegenereerde chunk-data in
geheugen, zodat break/place-edits behouden blijven wanneer een `ChunkView`
unloadt en later opnieuw wordt aangemaakt. Echte persistentie blijft M7.

Inventory is pure logica in `src/ui/inventory.ts`: 9 hotbar-slots, stack-size 64,
selectie via slot-index/wiel, en break/place gebruikt block-register `drops`.
Breken voegt drops direct toe aan de inventory als er stackruimte is; plaatsen
verbruikt één item uit de geselecteerde stack. De oude tijdelijke `PALETTE` in
`src/main.ts` is vervangen.

Save/load gebruikt IndexedDB (`minecraft-2d` / `saves` / `default`) en bewaart
de wereld-seed plus alle cached chunks als `Uint16Array`-blockdata. Bij startup
worden opgeslagen chunks vóór rendering teruggezet in `World`; block-edits en
nieuw gestreamde chunks triggeren een debounced autosave.

Survival-logica is pure code in `src/survival/survival.ts`: health (20), hunger
(20), fall damage na veilige valafstand, starvation damage als hunger op is, en
een vaste dag/nacht-cyclus met render-overlay. HUD toont health/hunger/tijd en
de speler kan niet meer bewegen als health 0 bereikt.

Let op (tijdelijk):

- Chunk-generatie gebeurt nog synchroon op het moment dat een nieuwe randchunk
  nodig is. De preload-marge voorkomt zichtbare gaten; als terrain zwaarder
  wordt, kan generatie later over ticks worden uitgesmeerd.
- Inventory en spelerpositie zijn nog sessie-geheugen; M7 bewaart bewust seed +
  chunkdata/edits. Er zijn nog geen losse item-entities op de grond; drops
  worden direct opgepakt als er ruimte is.
- Survival-state (health, hunger, dagtijd) wordt nog niet opgeslagen; M7 bewaart
  alleen seed + chunks. Eten/cooking/regen-items komen pas met latere
  crafting/food-systemen.
- Water is statisch (non-solid blok onder zeeniveau); stroming/zwemmen komt
  later. Grotten hebben nog geen donkere achtergrondlaag, dus door lucht in
  grotten/oceanen schemert de lucht-kleur (cosmetische polish voor later).
- Full-block-hoogteverschillen blokkeren horizontaal lopen (geen auto-step voor
  hele blokken — net als Minecraft; eroverheen = springen).

---

## Werkwijze

- Kleine, reviewbare commits per milestone; duidelijke messages.
- Unit tests voor pure logica (noise-gen, chunk-manager, inventory,
  block-register).
- Update de sectie **Huidige milestone** hierboven na elke stap.
- Bij twijfel: leg een korte keuze voor i.p.v. groot te gokken.
