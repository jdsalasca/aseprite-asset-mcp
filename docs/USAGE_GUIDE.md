# Aseprite Asset MCP: usage guide

## REST local para la UX

El mismo runtime TypeScript puede publicar un sidecar HTTP local para una UX. Sus controladores adaptan JSON a los mismos casos de uso que registran las herramientas MCP; no duplican algoritmos.

PowerShell:

    $env:MCP_REST_PORT = "3766"
    npm run mcp

Health: GET http://127.0.0.1:3766/api/v1/health

Controles: POST /api/v1/recipes, /api/v1/material-texture, /api/v1/depth-lighting y /api/v1/effects/outline, /api/v1/effects/color-grade, /api/v1/effects/shadow, /api/v1/effects/particles, /api/v1/effects/normal-map, /api/v1/effects/rain, /api/v1/effects/motion, /api/v1/effects/upscale, /api/v1/effects/seamless, /api/v1/effects/water-reflection, /api/v1/effects/water-caustics, /api/v1/effects/day-night, /api/v1/effects/scene-stack, /api/v1/variants/pack, /api/v1/scenes/extend y /api/v1/scenes/biome-transition.

`/api/v1/effects/upscale` recibe `{ "input_filename": "hero.png", "output_filename": "hero-3x.png", "scale": 3 }`. Usa nearest-neighbor determinista, conserva transparencia y delays cuando la entrada es animada, rechaza sobrescribir la fuente y limita cada dimensión resultante a 4096 px.

`/api/v1/scenes/extend` recibe `{ "input_map_filename": "world-map.json", "output_map_filename": "world-map-expanded.json", "top": 2, "right": 8, "bottom": 1, "left": 4, "seed": 9 }`. Lee el mapa mediante el puerto de manifiestos, preserva el centro y las capas, desplaza landmarks y puede escribir un preview PNG.

`/api/v1/scenes/biome-transition` recibe `{ "input_map_filename": "world-map.json", "output_map_filename": "world-map-transitions.json", "preview_filename": "world-map-transitions.png", "transition_width": 2, "seed": 73 }`. Calcula la banda alrededor de fronteras de biomas y entrega metadatos deterministas para que el motor aplique espuma, hierba, roca u otros tiles de transición sin tocar el mapa original.

`/api/v1/effects/seamless` recibe `{ "input_filename": "water.png", "output_filename": "water-seamless.png", "seam_width": 2 }` y hace coincidir bordes opuestos para repetir el asset en mapas y fondos.

`/api/v1/effects/water-reflection` recibe `{ "input_filename": "ocean.png", "output_filename": "ocean-reflection.gif", "waterline": 32, "frames": 8, "seed": 7, "amplitude": 2, "opacity": 0.6 }`. Conserva el original, refleja los píxeles sobre la línea de agua, aplica desplazamiento de oleaje y añade un destello determinista por frame.

`/api/v1/effects/water-caustics` recibe `{ "input_filename": "pool.png", "output_filename": "pool-caustics.gif", "frames": 8, "seed": 7, "intensity": 0.8, "scale": 4, "color": "#DFF6FF" }`. Modula solo píxeles opacos, conserva la transparencia y crea una animación de luz refractada reproducible.

`/api/v1/effects/day-night` recibe `{ "input_filename": "village.png", "output_filename": "village-day-night.gif", "frames": 8, "seed": 23, "intensity": 0.8 }`. Interpola luz de día, atardecer, noche y amanecer con una semilla reproducible; conserva alpha, dimensiones, delays y la fuente.

`/api/v1/variants/pack` recibe `{ "input_filename": "forest-ranger.png", "output_prefix": "forest-ranger-variants", "variants": ["rain", "night", "birds", "day_night"], "frames": 8, "seed": 17, "delay_ms": 90 }`. Devuelve todos los artifacts generados en una sola respuesta para reducir llamadas y tokens del agente. Las fuentes estáticas se pueden animar; si se solicitan varios frames, el formato efectivo debe ser GIF.

`/api/v1/assets/quality-bundle` recibe `{ "filename": "forest-ranger.png", "max_colors": 64, "max_isolated_pixels": 4 }` y devuelve inspección, violaciones, recomendaciones y las garantías `deterministic`/`sourcePreserved` sin generar archivos. Es el camino recomendado para que la UX valide antes de encadenar mejoras.

`/api/v1/library/presets/generate` recibe `{ "preset_id": "coastal-sunset", "output_prefix": "art/coast", "width": 64, "height": 40, "seed": 9 }`. Resuelve el preset, conserva sus capas en la respuesta y delega en `generate_environment_pack`; así una persona puede pasar de explorar a generar una escena sin encadenar llamadas manuales.

`/api/v1/effects/scene-stack` recibe `{ "input_filename": "forest.png", "output_prefix": "forest-scene", "effects": ["material_texture", "depth_lighting", "rain", "particles", "day_night"], "frames": 8, "seed": 17, "material": "earth", "direction": "south_east", "format": "gif" }`. Ejecuta el conjunto seleccionado mediante los mismos servicios de aplicación del MCP, infiere el tamaño de partículas desde el primer frame, genera un artifact por efecto y no altera el original.

El sidecar solo escucha en 127.0.0.1, acepta CORS de localhost y 127.0.0.1, y rechaza orígenes externos. La UX asset-studio usa normalmente su gateway en 127.0.0.1:3765, que controla el proceso MCP por stdio y centraliza logs, diagnóstico y fallos.

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
npm run showcase:effects
```

`showcase:effects` genera y versiona un sprite de referencia con outline, color grade, sombra, normal map, partículas GIF y `examples/effects/manifest.json`.

## 8. Mejorar sprites de forma determinista

Estas operaciones retornan metadata compacta y escriben un archivo nuevo. Todas preservan el input.

```json
{
  "name":"apply_pixel_outline",
  "arguments":{
    "input_filename":"art/hero.png",
    "output_filename":"art/hero-outline.png",
    "color":"#172033",
    "thickness":1
  }
}
```

```json
{
  "name":"generate_particle_burst",
  "arguments":{
    "output_filename":"art/hit.gif",
    "width":32,
    "height":32,
    "frames":8,
    "seed":4217,
    "color":"#ffd166"
  }
}
```

También están disponibles `apply_color_grade`, `generate_sprite_shadow`, `generate_normal_map` y `generate_rain_overlay`. La lluvia recibe `seed`, `intensity` y `wind`, conserva dimensiones y tiempos de frame, y puede exportar PNG o GIF de forma determinista.

## 10. Crear una receta compuesta

El feature creator genera un contrato revisable y no destructivo para que una UX o un agente decida qué pasos ejecutar:

```json
{
  "name":"create_asset_recipe",
  "arguments":{
    "asset_id":"hero",
    "input_filename":"art/hero.png",
    "output_prefix":"art/hero",
    "format":"png",
    "steps":["outline","material_texture","depth_lighting","shadow","quality_gate"],
    "seed":4217,
    "material":"stone",
    "direction":"south_west"
  }
}
```

El resultado incluye `recipeId`, outputs separados, argumentos de cada tool, `sourcePreserved: true` y `deterministic: true`. La ejecución permanece bajo control explícito del consumidor.

## 9. Descubrimiento, progreso y seguridad

Para agentes, usar primero una búsqueda compacta:

```json
{
  "name":"get_tools_search",
  "arguments":{"query":"lighting","limit":5}
}
```

`start_asset_job` devuelve `progress: { completed, total }`; `get_asset_job_status` permite refrescarlo sin cargar artifacts completos. Se puede configurar `ASSET_ARTIFACT_ROOT` para restringir outputs y `ASSET_JOB_STORE_PATH` para persistir el estado fuera del repositorio.

## Ejecutar una receta compuesta

El tool execute_asset_recipe y el endpoint REST POST /api/v1/recipes/execute ejecutan el plan de create_asset_recipe con una tubería real. Cada paso recibe la salida anterior y la quality gate valida el último archivo; si una operación falla, no se ejecutan pasos posteriores.

La entrada conserva asset_id, input_filename, output_prefix, steps, seed, material y direction del creador de recetas. El servidor limita cuerpos REST a 1 MiB y responde 413 cuando la UX envía un payload mayor.
