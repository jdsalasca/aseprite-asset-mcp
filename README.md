# Aseprite Asset MCP

Plan de arquitectura y evolución: [docs/IMPROVEMENT_PLAN.md](docs/IMPROVEMENT_PLAN.md). La integración con la UX independiente está documentada en [docs/ASSET_STUDIO_INTEGRATION.md](docs/ASSET_STUDIO_INTEGRATION.md).

MCP server público para crear pixel art, personajes y escenarios de Aseprite con TypeScript 6.0.3, Node.js 24 y arquitectura hexagonal.

El servidor usa stdio. El adaptador MCP llama a casos de uso de aplicación y el adaptador de infraestructura ejecuta Aseprite de forma controlada. Los workflows generan primero un plan JSON reproducible y un manifiesto compatible con Godot.

## Arquitectura

```text
src/
  domain/          contratos y resultados del dominio
  application/     casos de uso
  infrastructure/  adaptador CLI de Aseprite
  interfaces/      adaptador MCP y entrada stdio
  workflows/       planes TypeScript y cliente MCP
tests-ts/          TDD unitario y handshake MCP
```

## Estado de la migración

La rama `develop` usa únicamente el runtime TypeScript. El núcleo disponible incluye canvas, grupos, capas, frames, tags, paletas, dibujo pixelado, tilemaps, validación, exportación, planes deterministas para personajes y escenarios, y handshake MCP real por stdio.

Este proyecto mantiene su propio desarrollo, roadmap y contrato de herramientas para convertirlo en una fábrica de assets pixel-art eficiente para agentes.

## Showcase visual

Los ejemplos se generan de forma reproducible con `npm run showcase`. El mismo pipeline crea estilo, tileset, mapa, oleaje, transición temporal y manifests.

![Declarative asset pipeline](docs/media/mcp-pipeline.svg)

![Coastal map preview](docs/media/coastal-map.png)

![Animated beach waves](docs/media/beach-waves.gif)

![Day, sunset, night, and sunrise transition](docs/media/coastal-time-of-day.gif)

Ver también:

- [Guía de uso](docs/USAGE_GUIDE.md)
- [Recetas y reglas de calidad](docs/ASSET_RECIPES.md)
- [Ejemplos visuales](docs/media/)
- [Showcase de efectos deterministas](examples/effects/manifest.json)

## Requisitos

- Node.js 24 o posterior.
- npm 11 o posterior.
- Aseprite instalado y accesible.
- `ASEPRITE_PATH` configurado si el ejecutable no está en el PATH.

En Windows:

```powershell
$env:ASEPRITE_PATH = 'C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe'
npm install
npm test
```

## Conectar el MCP

`.mcp.json` usa el servidor TypeScript:

```json
{
  "mcpServers": {
    "aseprite": {
      "type": "stdio",
      "command": "npm",
      "args": ["run", "mcp", "--silent"]
    }
  }
}
```

Ejecuta manualmente con `npm run mcp`. stdout pertenece al protocolo MCP; los logs operativos van a stderr.

## Workflows para juegos

Modo plan:

```bash
npm run asset:character -- --asset=moon-knight
npm run asset:scene -- --asset=forest-ruins
```

Esto crea en `artifacts/aseprite/` el plan de llamadas y el manifiesto `*.godot.json`.

Modo ejecución, después de revisar el plan:

```powershell
$env:ASEPRITE_PATH = 'C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe'
npm run asset:character -- --asset=moon-knight --execute
npm run asset:scene -- --asset=forest-ruins --execute
npm run asset:odiseum-style
npm run asset:odiseum-world
npm run asset:library
npm run showcase
```

Secuencia: canvas; grupos y capas semánticas; paleta; frames y tags; validación; spritesheet, datos y manifiesto para Godot.

`asset:odiseum-style` genera los personajes, el entrenador y la transición de viaje de Odiseum. `asset:odiseum-world` genera el sheet de seis props, el glifo animado de los portales y el cristal animado exclusivo de Starfall Grove con la misma paleta cozy. `asset:library` genera `odiseum-cozy-kit`, una biblioteca reutilizable de ocho assets de entorno de 48 px con sombras de contacto, navegación, naturaleza y arquitectura.

La biblioteca se exporta en `art/library/odiseum-cozy-kit.png` junto con `asset-library.json`. El manifiesto documenta el índice de cada frame, categoría, paleta, escala y regla de renderizado nearest para reutilizar el kit en otros juegos originales.

## Herramientas compactas para agentes

El agente puede descubrir capacidades por carpetas antes de cargar detalles:

- `get_tools_list`: devuelve carpetas y conteos sin repetir los más de cien nombres.
- `get_tools_by_folder`: carga solo una familia, por ejemplo `asset/animation` o `asset/quality`.
- `run_asset_recipe`: ejecuta o previsualiza recetas `pixel_art`, `animation_pixel_art`, `gif` y `atlas`.
- `batch_asset_job`: agrupa varias recetas en una sola llamada y devuelve un resultado compacto.
- `convert_image_to_pixel_art`: convierte PNG, JPG, WebP y otros formatos soportados por Sharp con resize box/nearest, paleta limitada, transparencia y dithering Bayer opcional.
- `convert_animation_to_pixel_art`: procesa todos los frames con una paleta global y conserva sus delays en GIF.
- `upscale_pixel_art`: aumenta sprites estáticos o animados con nearest-neighbor determinista, conserva transparencia/delays y limita la salida a 4096 px.
- `export_animation_gif`: exporta una imagen animada o un `.aseprite` a GIF.
- `inspect_asset` y `validate_asset_quality`: reportan dimensiones, frames, colores, transparencia, delays y pixeles aislados antes de exportar.
- `build_texture_atlas`: empaqueta imágenes del mismo tamaño en un atlas PNG con columnas y padding.
- `export_asset_pack`: entrega el atlas y un manifiesto JSON con la posición de cada asset.
- `create_style_bible`: fija paleta, luz, escala, detalle y semilla para mantener consistencia.
- `inspect_reference` y `run_asset_quality_gate`: analizan color, contraste, bordes, transparencia, banding y píxeles aislados.
- `build_terrain_tileset`: genera 16 máscaras cardinales por terreno para transiciones reutilizables.
- `generate_world_map`: crea mapas multi-bioma deterministas con landmarks y preview.
- `generate_beach_scene`: crea costa, arena, tierra, preview y oleaje animado.
- `extend_scene`: amplía un mapa JSON existente por sus bordes, conserva capas y desplaza landmarks de forma determinista.
- `generate_seamless_texture`: iguala bordes opuestos para texturas repetibles de agua, tierra, piedra o hierba sin alterar la fuente.
- `generate_water_reflection`: genera un GIF determinista con reflejo bajo una línea de agua, oleaje y destellos temporales para océanos, playas y mapas.
- `generate_water_caustics`: genera una pasada GIF de luz refractada sobre píxeles opacos de agua, piscinas, playas o interiores inundados.
- `generate_day_night_cycle`: genera un GIF determinista con las etapas `day`, `sunset`, `night` y `sunrise`, preservando transparencia y dimensiones.
- `generate_time_of_day_pack`: crea transición día, atardecer, noche y amanecer.
- `generate_environment_pack`: empaqueta playa, bosque, aldea o cueva en una sola llamada.
- `create_asset_recipe`: compone outline, grading, materiales, luz, sombras, partículas, normal map y quality gate en un plan determinista sin ejecutar cambios.
- `get_asset_library`: busca una biblioteca de 339 items preconstruidos en 10 categorías, con resultados compactos para reducir tokens.
- `get_asset_library_item`: resuelve README, manifest, preview y sprite sheet de un asset concreto.
- `get_asset_preset`: devuelve composiciones listas como `living-forest`, `coastal-sunset`, `fantasy-quest` y `rainy-village`.
- `generate_motion_pack`: crea ciclos `idle`, `walk`, `run`, `jump` o `attack` desde un sprite estático o animado.
- `generate_variant_pack`: crea en una sola llamada hasta nueve variantes deterministas (`rain`, `fire`, `earthquake`, `birds`, `night`, `day_night`, `walk`, `water_reflection` y `water_caustics`) y devuelve un manifiesto compacto de artifacts.

Las operaciones de imagen no necesitan abrir Aseprite; eso reduce latencia y tokens para conversiones masivas. Las operaciones sobre `.aseprite` siguen pasando por el adaptador CLI hexagonal y mantienen la compatibilidad con Godot.

## TDD y calidad

```bash
npm run typecheck
npm run test:ts
npm test
```

Las pruebas de dominio y planes no necesitan abrir Aseprite. La prueba MCP inicia el servidor TypeScript real, hace el handshake stdio y verifica las herramientas expuestas.

## Docker

La imagen usa Node.js 24. El binario de Aseprite debe estar disponible dentro del contenedor y configurarse con `ASEPRITE_PATH`; no se incluyen credenciales ni binarios propietarios.

```bash
docker compose run --rm aseprite-mcp-dev
```

## Licencia y proyecto

Proyecto independiente: [`jdsalasca/aseprite-asset-mcp`](https://github.com/jdsalasca/aseprite-asset-mcp). Conserva la licencia MIT.

## Ejecución de recetas compuestas

create_asset_recipe genera un plan revisable y execute_asset_recipe lo ejecuta paso a paso usando los mismos servicios de efectos, materiales, iluminación y calidad. El pipeline conserva la fuente, detiene la primera operación fallida y devuelve el artifact final.

La UX puede invocar POST /api/v1/recipes/execute cuando MCP_REST_PORT está habilitado.

## Biblioteca de assets y presets

`assets/folders/` contiene una biblioteca determinista y navegable: personajes, flora, fauna, criaturas mitológicas, monturas, armas y accesorios, biomas/mapas, interiores, instrumentos y efectos de escena. Cada carpeta tiene su propio `README.md`, `manifest.json`, `preview.png`, `preview.svg`, `sprite-sheet.png` y `sprite-sheet.svg`.

Para regenerar la biblioteca después de cambiar sus semillas:

```text
npm run asset:library:catalog
```

Ejemplos REST:

```text
GET /api/v1/library?query=rain&limit=12
POST /api/v1/effects/motion
POST /api/v1/effects/upscale
POST /api/v1/effects/seamless
POST /api/v1/effects/water-reflection
POST /api/v1/effects/water-caustics
POST /api/v1/effects/day-night
POST /api/v1/variants/pack
GET /api/v1/library/items/forest-ranger
GET /api/v1/library/presets/living-forest
GET /api/v1/library/items/forest-ranger/preview
GET /api/v1/library/items/forest-ranger/sprite
GET /api/v1/library/presets/living-forest/compose
```

Las dos últimas rutas sirven PNG/GIF de forma binaria desde el adaptador de archivos, validando primero el id del catálogo y bloqueando escapes del directorio `assets/folders`. Asset Studio las consume para mostrar previews reales en `PixelAssetGrid`.

`compose_asset_preset` y `GET /api/v1/library/presets/:id/compose` devuelven en una sola respuesta los assets y las capas ordenadas (`background`, `midground`, `foreground`, `effect`), reduciendo búsquedas repetidas de los agentes.

Las variantes (`rain`, `fire`, `earthquake`, `birds`, `wave-reflection`, `day`, `sunset`, `night`, `walk`, `attack`, etc.) son contratos para los algoritmos existentes: se aplican sobre una copia del asset y conservan la fuente.

`generate_variant_pack` evita nueve llamadas del agente cuando se necesita explorar un asset en distintos contextos. Ejemplo MCP/REST equivalente:

```json
{
  "input_filename": "art/forest-ranger.png",
  "output_prefix": "art/forest-ranger-variants",
  "variants": ["rain", "night", "birds", "day_night"],
  "frames": 8,
  "seed": 17,
  "delay_ms": 90
}
```

La respuesta contiene `artifacts[]` con ruta, operación, cantidad de frames, formato y las garantías `deterministic` y `sourcePreserved`. Las fuentes PNG estáticas también pueden producir GIFs animados; el servidor rechaza explícitamente pedir varios frames con formato PNG.
