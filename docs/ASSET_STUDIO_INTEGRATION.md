# Asset Studio + Aseprite MCP

El proyecto `asset-studio` es un repositorio independiente que consume este MCP mediante el cliente MCP oficial sobre stdio.

## Repositorios locales

```text
C:\Users\jdsal\Documents\Programming-personal\aseprite-mcp
C:\Users\jdsal\Documents\Programming-personal\pixel-art-ui
C:\Users\jdsal\Documents\Programming-personal\asset-studio
```

La dependencia entre ellos es intencional:

```text
asset-studio ──file:../pixel-art-ui──> @jdsalas/pixel-ui
asset-studio ──StdioClientTransport──> aseprite-mcp / npm run mcp
```

## Arranque

En `pixel-art-ui`:

```text
npm install
npm run build
```

En `asset-studio`, con el MCP detenido:

```text
npm install
npm run gateway
npm run dev
```

Después abre `http://localhost:4173`, introduce la ruta de este repositorio en **ASEPRITE-MCP REPOSITORY**, configura opcionalmente `ASEPRITE_PATH` y pulsa **START MCP**.

## Contrato del gateway

```text
GET  /api/health
GET  /api/config
GET  /api/mcp/status
GET  /api/mcp/tools
POST /api/mcp/start
POST /api/mcp/stop
POST /api/mcp/call
```

El gateway es local y escucha solo en `127.0.0.1`. El navegador no puede ejecutar Aseprite ni acceder directamente al sistema de archivos. Antes de lanzar el proceso, el gateway valida que la carpeta contenga `package.json` con el script `mcp` y, si se indicó una ruta de Aseprite, que exista. Las llamadas de herramientas pasan por el protocolo MCP tipado.

## TDD y verificación

```text
aseprite-mcp: npm test
pixel-art-ui: npm test && npm run build
asset-studio: npm test && npm run build
```

El primer flujo E2E del gateway comprueba que se listan herramientas y que `server_capabilities` responde desde el proceso MCP real.
