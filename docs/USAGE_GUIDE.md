# Aseprite Asset MCP: usage guide

This MCP is designed for compact, reproducible asset jobs. Prefer one recipe or batch job over many pixel-level calls.

## 1. Discover only the tools you need

```json
{"name":"get_tools_list","arguments":{}}
```

Then load one folder:

```json
{"name":"get_tools_by_folder","arguments":{"folder":"asset/world"}}
```

Useful folders are `asset/style`, `asset/quality`, `asset/tilemap`, `asset/world`, `asset/environment`, and `asset/export`.

## 2. Create a style bible

```json
{
  "name":"create_style_bible",
  "arguments":{
    "filename":"art/style/coastal.json",
    "id":"coastal",
    "base_size":16,
    "palette":["#12243A","#3081AD","#E2C277","#57975B","#686870"],
    "outline_color":"#12243A",
    "light_direction":"south_east",
    "detail_level":"high",
    "seed":4217,
    "materials":{
      "water":["#28577A","#3081AD"],
      "sand":["#C49B57","#E2C277"]
    }
  }
}
```

Reuse the same style file for every sprite and map in the scene.

## Deterministic material texture

Use `apply_material_texture` when an existing PNG/GIF needs procedural grain without changing the source. The same `seed`, `material`, and `intensity` always produce the same output, and transparent pixels remain transparent:

```json
{
  "name": "apply_material_texture",
  "arguments": {
    "input_filename": "art/coastal/beach-preview.png",
    "output_filename": "art/coastal/beach-preview-earth.png",
    "material": "earth",
    "seed": 42,
    "intensity": 0.65,
    "format": "png"
  }
}
```

Supported materials are `water`, `earth`, `grass`, `stone`, and `snow`. Keep `input_filename` and `output_filename` different; this is enforced before decoding.

## Depth lighting for sprites

Use `apply_depth_lighting` after material texture when a sprite needs more volume. It calculates deterministic edge exposure from the selected light direction and keeps alpha untouched:

```json
{
  "name": "apply_depth_lighting",
  "arguments": {
    "input_filename": "art/hero/hero-textured.png",
    "output_filename": "art/hero/hero-lit.png",
    "direction": "south_east",
    "strength": 0.7,
    "ambient": 0.35,
    "format": "png"
  }
}
```

## 3. Generate terrain assets

```json
{
  "name":"build_terrain_tileset",
  "arguments":{
    "output_filename":"art/coastal/terrain.png",
    "manifest_filename":"art/coastal/terrain.json",
    "tile_size":16,
    "terrains":["water","sand","grass","rock"],
    "seed":4217
  }
}
```

The manifest is the source for terrain variants, adjacency masks, and engine importers.

For a complete themed pack use one call:

```json
{
  "name":"generate_environment_pack",
  "arguments":{
    "kind":"forest",
    "output_prefix":"art/forest/forest",
    "width":128,
    "height":96,
    "seed":4217,
    "tile_size":16,
    "detail_level":"high"
  }
}
```

The result includes terrain PNG/JSON, map JSON, preview PNG, and time-of-day GIF/JSON. A beach pack also includes a wave GIF.

## 4. Generate a beach with animated waves

```json
{
  "name":"generate_beach_scene",
  "arguments":{
    "map_filename":"art/coastal/beach-map.json",
    "preview_filename":"art/coastal/beach-map.png",
    "wave_filename":"art/coastal/beach-waves.gif",
    "width":128,
    "height":96,
    "seed":4217,
    "detail_level":"high",
    "wave_frames":8,
    "wave_delay_ms":150,
    "landmark_count":16
  }
}
```

The map is deterministic. Reusing the same seed recreates the same layout.

## 5. Generate day/night transitions

```json
{
  "name":"generate_time_of_day_pack",
  "arguments":{
    "input_filename":"art/coastal/beach-map.png",
    "output_filename":"art/coastal/beach-time-of-day.gif",
    "manifest_filename":"art/coastal/beach-time-of-day.json",
    "steps":12,
    "delay_ms":160
  }
}
```

## 6. Run quality checks

```json
{
  "name":"run_asset_quality_gate",
  "arguments":{
    "filename":"art/coastal/beach-waves.gif",
    "max_colors":64,
    "max_isolated_pixels":4,
    "min_contrast":0.08,
    "max_banding_runs":40
  }
}
```

The result contains only `valid`, reports, and actionable violations. It does not return the complete pixel buffer.

## 7. Batch jobs

Use `batch_asset_job` when the outputs are independent:

```json
{
  "name":"batch_asset_job",
  "arguments":{
    "dry_run":false,
    "jobs":[
      {"recipe":"pixel_art","input_filenames":["source.png"],"output_filename":"hero.png","width":32,"height":32,"max_colors":32},
      {"recipe":"atlas","input_filenames":["hero.png","rock.png"],"output_filename":"atlas.png"}
    ]
  }
}
```

Use `dry_run:true` first for large jobs.

## Verification

```powershell
npm run typecheck
npm test
npm run showcase
```
