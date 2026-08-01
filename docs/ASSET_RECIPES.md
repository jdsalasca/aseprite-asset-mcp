# Asset recipes and quality rules

## Recommended pass order

```text
style bible
  -> composition
  -> terrain masks
  -> silhouettes
  -> materials
  -> shadows and highlights
  -> props and landmarks
  -> animation
  -> quality gate
  -> engine pack
```

Do not ask an agent to describe every pixel. Send the seed, dimensions, palette, materials, and pass settings.

## Material grammar

Each material should define:

- base color;
- shadow color;
- highlight color;
- texture pattern;
- edge rule;
- animation rule;
- density budget.

Example materials are `water`, `wet_sand`, `dry_sand`, `grass`, `rock`, `wood`, `metal`, and `snow`.

## Scene quality gate

Every generated scene should check:

- fixed dimensions and tile size;
- bounded palette;
- transparent pixels are intentional;
- no isolated pixels above the budget;
- no accidental anti-aliasing;
- contrast is readable at 1x;
- shoreline and terrain transitions have variants;
- animated frames have equal dimensions and delays;
- collision and navigation metadata exist when required;
- all artifacts are listed in one manifest.

## Determinism

The same `seed`, style bible, and specification must produce the same map rows, landmarks, tileset metadata, and previews. Change the seed to create variants; change the style bible to create a new art direction.

## Engine handoff

Keep source `.aseprite` files editable. Export PNG/GIF for previews and a JSON manifest for the game importer. For Godot, map the manifest to `TileMapLayer`, terrain sets, collision layers, navigation layers, and custom tile data.
