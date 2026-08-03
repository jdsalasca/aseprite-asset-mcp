# Red deer reference sprite

Asset derivado de una referencia de dominio público y convertido mediante el pipeline determinista imagen → pixel art del MCP.

- Referencia: [The Stag, or Red Deer — Wikimedia Commons](https://commons.wikimedia.org/wiki/File:The_Stag,_or_Red_Deer_LCCN2007681452.jpg).
- Calidad: la manifest registra hash, recorte, paleta, cobertura y resultado del gate de silueta.
- Archivos: preview.png, sprite-sheet.png, sprite-sheet.gif y manifest.json.
- Animación: cuatro frames de 96×96 con desplazamiento determinista de 1px para idle/walk.

## Uso MCP

Consulta get_asset_library con deer y aplica los efectos del MCP sobre una copia del PNG.

## Procedencia

La imagen fuente no se distribuye dentro del repositorio: URL, licencia y SHA-256 quedan registrados en manifest.json.
Para reproducir el asset, descarga la referencia y ejecuta DEER_REFERENCE_FILENAME=<ruta> npm run asset:reference-fauna.
