# Aseprite MCP TypeScript

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

La rama `develop` elimina el servidor anterior y usa solo el runtime TypeScript. El núcleo disponible incluye canvas, grupos, capas, frames, tags, paletas, dibujo pixelado, tilemaps, validación, exportación, planes deterministas para personajes y escenarios, y handshake MCP real por stdio.

La base pública se sincronizó con `diivi/aseprite-mcp:main` antes de reconstruir. La rama experimental del upstream no se usó como base porque no es `main` y elimina herramientas durante su trabajo en progreso.

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
```

Secuencia: canvas; grupos y capas semánticas; paleta; frames y tags; validación; spritesheet, datos y manifiesto para Godot.

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

## Licencia y fork

Este repositorio es un fork público de [`diivi/aseprite-mcp`](https://github.com/diivi/aseprite-mcp) y conserva su licencia MIT. Fork público: [`jdsalasca/aseprite-mcp`](https://github.com/jdsalasca/aseprite-mcp).
