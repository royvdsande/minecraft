# Minecraft 2D

A 2D side-view Minecraft remake — singleplayer, survival. TypeScript + Vite +
PixiJS. For personal use.

## Quick start

```bash
npm install
npm run dev      # dev server
npm test         # unit tests
npm run build    # production build -> dist/ (Vercel-ready)
```

## Textures

Drop real 16×16 PNG block textures into `public/textures/blocks/`. Missing ones
get an auto-generated placeholder so the game always runs. See that folder's
`README.md` for the naming convention.

## Project guide

Architecture rules, coordinate system, conventions, and the current milestone
live in [`CLAUDE.md`](./CLAUDE.md). Read it before contributing.
