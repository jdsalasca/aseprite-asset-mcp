# Plan de mejoras cohesionadas

## Objetivo arquitectónico

Los tres repositorios colaboran mediante contratos estables, pero cada uno conserva una responsabilidad clara:

```text
pixel-art-ui       UX presentacional y accesible
        ↓
asset-studio       casos de uso, persistencia de configuración y gateway humano
        ↓
aseprite-mcp       dominio de assets, generación determinista y adaptadores externos
```

Las abstracciones no contienen nombres de SDK, Aseprite, Node, HTTP ni filesystem. Los nombres concretos viven en adaptadores.

## Fases

### Fase 1 · Foundation hexagonal — implementada en la rama de integración

- separar puertos genéricos de sesión de herramientas, persistencia, procesos y capacidades de asset;
- extraer composición del servidor HTTP a controladores y servicios;
- persistir configuración del Asset Studio en JSON local, sin secretos;
- dividir componentes UI en módulos pequeños;
- añadir pruebas de contratos y validación de errores.
- mantener el contrato de runtime genérico y dividir el adaptador concreto por capacidad;
- proteger la frontera con una prueba arquitectónica que rechaza nombres concretos fuera de infraestructura.

### Fase 2 · Asset enhancement application — implementada

- `InspectAsset`, `SuggestEnhancementPlan` y `ApplyEnhancementPlan` como casos de uso;
- recetas de materiales, iluminación y partículas como estrategias independientes;
- caché por hash de input, receta, estilo y versión;
- jobs cancelables para operaciones largas;
- manifiestos compactos y recursos MCP.

Ya están disponibles el planificador determinista `suggest_enhancement_plan`, la ejecución segura `apply_enhancement_plan` y los jobs asíncronos `start_asset_job`, `get_asset_job_status` y `cancel_asset_job`. La ejecución rechaza sobrescribir la fuente, escribe un PNG/GIF separado, ejecuta automáticamente el quality gate y aplica pasadas reproducibles de limpieza, granularidad, flujo de agua, iluminación, partículas y transición temporal. El registro MCP está separado en controladores por capacidad y estos consumen puertos genéricos, dejando `AsepriteCliGateway` como adaptador concreto.

El adaptador CLI concreto ahora es un compositor delgado: `AsepriteLayerAdapter`, `AsepriteDrawingAdapter`, `AsepriteExportAdapter`, `AsepritePaletteAdapter`, `AsepriteTextAdapter`, `AsepriteAnimationAdapter`, `AsepriteEffectsAdapter` y `AsepriteSceneAdapter` implementan las capacidades aisladas sobre `AsepriteCommandAdapter`.

### Fase 3 · Persistencia y observabilidad — jobs y artifacts implementados

- `JsonAssetJobStore` implementa el puerto genérico de jobs y recupera estados tras reinicios;
- transiciones condicionales evitan que workers o cancelaciones sobrescriban estados más nuevos;
- `AssetArtifactResolverPort` mantiene la abstracción genérica y `FileAssetArtifactResolver` calcula formato, tamaño y SHA-256 en infraestructura;
- los jobs completados conservan metadata de artifacts y el store JSON la recupera después de reiniciar;
- el archivo runtime vive fuera de Git mediante `ASSET_JOB_STORE_PATH` o `.asset-studio/jobs.json`;
- repositorio de artifacts y jobs;
- logs estructurados con correlación;
- límites de rutas y tamaño;
- health checks y métricas de duración, caché y errores.

### Fase 4 · UX de producción — comparación y navegación base implementadas

- editor de recetas;
- preview antes/después y frames; `PixelCompare` y `PixelFrameStrip` ya están publicados en la rama de integración y `AssetPreviewPanel` usa la comparación accesible;
- informes de calidad accionables;
- accesibilidad, teclado, alto contraste y reduced motion;
- pruebas visuales y E2E contra el gateway real; la integración HTTP y el preview SSR ya tienen pruebas TDD.

### Fase 5 · Releases

- build reproducible;
- `npm pack --dry-run` e instalación desde tarball;
- publicación versionada de `@jdsalas/pixel-ui`;
- CI para los tres repositorios;
- releases y documentación cruzada.

La publicación npm queda protegida por autenticación: el workflow no contiene tokens y requiere configurar el secreto de publicación en GitHub o iniciar sesión localmente.

## Criterios de diseño

- dominio puro y pequeño;
- casos de uso que dependan de puertos, no de adaptadores;
- adaptadores concretos para MCP SDK, Node, Aseprite CLI, filesystem y browser;
- controladores delgados: traducen entrada/salida y delegan;
- componentes UX sin lógica de negocio;
- ningún singleton global salvo la composición raíz;
- pruebas unitarias antes de cada extracción y pruebas de integración después.
