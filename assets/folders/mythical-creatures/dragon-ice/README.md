# Premium ice dragon

Dragon de hielo de alta fidelidad para combate y escenas de fantasía.

- Fuente visual de alta calidad conservada en source-reference.png.
- Silueta completa: cabeza, mandíbula, ojo, cuernos, alas, cuatro patas, garras, cola, placas y espinas de hielo.
- Paleta limitada y nearest-neighbor para conservar clusters de pixel art.
- Cuatro frames de 256×256: idle, wing-beat, ice-breath y attack.
- La manifest conserva el hash de la fuente, el algoritmo y el resultado del quality gate.

## Uso MCP

Consulta get_asset_library con dragon-ice. Para variantes adicionales usa apply_depth_lighting, apply_sprite_rim_light, apply_sprite_glow, generate_particle_burst, normal_map y validate_asset_quality sobre copias.

## Regeneración

Ejecuta DRAGON_ICE_SOURCE_FILENAME=<ruta> npm run asset:premium-dragon.
La generación de la fuente y la conversión raster son fases separadas: la conversión, atlas, GIF y quality gate son deterministas.
