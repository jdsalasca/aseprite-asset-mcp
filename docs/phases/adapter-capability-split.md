# Phase: Capability adapter split

## Objective

Eliminar la god class del adaptador CLI sin cambiar el contrato público del runtime ni el comportamiento de las herramientas MCP.

## Design

- `AsepriteCommandAdapter` concentra únicamente ejecución de procesos, generación de scripts compartidos y validaciones comunes.
- Cada capacidad concreta vive en su propio adaptador de infraestructura.
- `AsepriteCliGateway` conserva el constructor público histórico y compone métodos enlazados detrás de `AssetRuntimePort`.
- Los controladores continúan dependiendo de puertos genéricos; ningún tipo `AsepriteResult` o `AsepriteGateway` cruza dominio, aplicación o interfaces.

## TDD and verification

- La prueba arquitectónica falla si el compositor vuelve a declarar operaciones públicas y verifica la existencia de los ocho adaptadores.
- La prueba de frontera falla si reaparecen nombres concretos en las capas internas.
- Typecheck: passed.
- Contract and gateway validation tests: 34 passed.
- MCP stdio handshake and real drawing workflow: passed.
- Full suite after extraction remains the release gate.
