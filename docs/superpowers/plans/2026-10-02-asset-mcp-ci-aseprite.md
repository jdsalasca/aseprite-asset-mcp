# asset-mcp CI with real Aseprite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los tests de integración reales (hoy 8, se saltan en GitHub por falta de Aseprite) corran de verdad en CI sobre un runner self-hosted con Aseprite instalado, y que la suite unitaria (189 tests) corra también en cada PR.

**Architecture:** Dos cambios de CI independientes: (a) `typescript-ci.yml` pasa de `npm run typecheck` a `npm test` (typecheck + 189 tests) en PR/push; (b) nuevo `aseprite-integration.yml` que corre en un runner self-hosted (labels `self-hosted, windows, aseprite`) por `schedule` nocturno + `workflow_dispatch`, falla rápido si falta el binario, y ejecuta `tests-ts/integration/real-aseprite.test.ts`. Documentación de registro del runner y de la variable `ASEPRITE_PATH` en `docs/CI_ASEPRITE.md`.

**Tech Stack:** GitHub Actions (hosted ubuntu + self-hosted Windows), Node 24, `tsx` node:test, Aseprite (binario del dueño en el runner).

**Spec:** goal del bloque 3, item (3): "montar integración CI con Aseprite real (runner self-hosted o job nightly opcional) para que los tests de integración reales no se salten en GitHub".

## Global Constraints

- Trabajar en rama `ci/aseprite-integration` desde `develop`; no tocar `develop` directo; PR antes del merge.
- El job self-hosted NO debe dispararse en `pull_request` ni `push` (evita bloquear PRs y dejar runs colgados).
- Sin secretos en los workflows. El runner self-hosted ya tiene Aseprite; la ruta se toma de la variable de repo `ASEPRITE_PATH` o del default Steam de Windows.
- El job de integración debe **fallar** (no saltar) si el binario no existe en el runner: pre-check explícito.
- Commits en inglés. No romper `release.yml` ni `docker-build.yml`.

## Review Focus

1. El job self-hosted nunca se engancha a PR/push (si lo hiciera, los PRs quedarían bloqueados/colgados hasta registrar el runner).
2. Si falta el runner, los runs `schedule` quedan en cola: documentado, con cómo desactivar el schedule.
3. El pre-check de Aseprite convierte "skip silencioso" en fallo ruidoso (el problema original de este workstream).
4. `npm test` en PR CI añade ~30 s; aceptable y cacheado con `actions/setup-node` + `cache: npm`.
5. `workflow_dispatch` debe permitir pasar la ruta del binario sin depender de configuración previa del repo.

---

### Task 1: CI — suite unitaria en PRs + workflow de integración real + docs

**Files:**
- Modify: `.github/workflows/typescript-ci.yml`
- Create: `.github/workflows/aseprite-integration.yml`
- Create: `docs/CI_ASEPRITE.md`
- Modify: `README.md` (link corto a la doc de CI dentro de la sección de tests/CI)

**Interfaces:**
- Consumes: `tests-ts/integration/real-aseprite.test.ts` (8 tests, gate `existsSync(ASEPRITE_PATH ?? default Steam)`); `package.json` scripts `test` (typecheck + suite) y dependencia `tsx`.
- Produces: check de PR llamado `typecheck` que ahora corre `npm test`; workflow `Aseprite integration` (schedule + dispatch) con job en `[self-hosted, windows, aseprite]`; doc de registro de runner.

- [ ] **Step 1: `typescript-ci.yml` corre la suite completa**

Sustituir el step final `- run: npm run typecheck` por `- run: npm test` (el script `test` ya encadena typecheck + `test:ts`). Mantener el nombre del job (`typecheck`) para no romper el check requerido, y mantener el cache de npm. No agregar triggers nuevos.

- [ ] **Step 2: Crear `aseprite-integration.yml`**

Contenido exacto:

```yaml
name: Aseprite integration

# Runs the real-Aseprite integration suite on a self-hosted runner that has
# Aseprite installed. Never triggered by pull_request/push: it would block PRs
# until the runner is registered. See docs/CI_ASEPRITE.md.
on:
  schedule:
    - cron: '0 8 * * *' # nightly, 08:00 UTC
  workflow_dispatch:
    inputs:
      aseprite_path:
        description: Path to the Aseprite executable on the runner
        required: false
        type: string

permissions:
  contents: read

concurrency:
  group: aseprite-integration
  cancel-in-progress: false

jobs:
  integration:
    runs-on: [self-hosted, windows, aseprite]
    timeout-minutes: 20
    env:
      ASEPRITE_PATH: ${{ inputs.aseprite_path || vars.ASEPRITE_PATH || 'C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe' }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Verify Aseprite binary
        shell: pwsh
        run: |
          if (-not (Test-Path -LiteralPath $env:ASEPRITE_PATH)) {
            Write-Error "Aseprite not found at '$env:ASEPRITE_PATH'. Install it or set the ASEPRITE_PATH repository variable."
            exit 1
          }
          & $env:ASEPRITE_PATH --version

      - name: Run real Aseprite integration tests
        run: npx tsx --test tests-ts/integration/real-aseprite.test.ts
```

- [ ] **Step 3: Documentar en `docs/CI_ASEPRITE.md`**

Secciones: por qué (los 8 tests se saltaban), requisitos (runner Windows con Aseprite), registro del runner (descargar `actions/runner`, `config.cmd --url https://github.com/jdsalasca/aseprite-asset-mcp --token <TOKEN> --labels aseprite,windows`, `run.cmd` o servicio), variable `ASEPRITE_PATH` (`gh variable set ASEPRITE_PATH --body "C:\...\Aseprite.exe" --repo jdsalasca/aseprite-asset-mcp`), disparo manual (`gh workflow run "Aseprite integration"`), nota de que hasta registrar el runner los runs quedan en cola y cómo desactivar el `schedule` (comentar el bloque), y evidencia esperada (8/8). Incluir el link al workflow.

- [ ] **Step 4: Link en `README.md`**

En la sección de tests/CI, una línea: "Los tests de integración reales corren en un runner self-hosted — ver [docs/CI_ASEPRITE.md](docs/CI_ASEPRITE.md)."

- [ ] **Step 5: Verificación local**

`npm test` → 189/189. `npm run typecheck` → limpio. YAML parseable: `npx tsx -e "import('node:fs').then(fs => console.log('ok'))"` no valida YAML; en su lugar, `npx --yes js-yaml .github/workflows/aseprite-integration.yml .github/workflows/typescript-ci.yml > $null` (si js-yaml no está disponible, revisar indentación a mano y dejar la validación real al push del Step 6).

- [ ] **Step 6: Push de rama y verificación real en GitHub**

Push `ci/aseprite-integration`; abrir PR a `develop`. Verificar: (a) el check de PR `typecheck` corre `npm test` y queda verde (evidencia: `gh pr checks`); (b) `gh workflow list` incluye "Aseprite integration"; (c) `gh workflow run "Aseprite integration"` encola el run en el label self-hosted (evidencia: `gh run list` con status `queued`); cancelarlo (`gh run cancel`) y documentar que quedará así hasta registrar el runner. Commit final.

**Nota de entrega:** el run real 8/8 requiere que el dueño registre el runner (acción externa documentada en `docs/CI_ASEPRITE.md`); al registrarlo, `gh workflow run "Aseprite integration"` debe dar 8/8 sin skips.

---

## Self-Review (hecho)

- **Cobertura del goal (3):** workflow con Aseprite real (Task 1, Steps 2–3), job nightly/dispatch (Step 2), que no se salten (pre-check + doc, Steps 2–3), verificación real (Step 6). ✅
- **Tipos/valores consistentes:** labels `self-hosted, windows, aseprite`; variable `ASEPRITE_PATH`; script `npm test`; ruta default Steam. ✅
- **Review Focus** con checks en los steps (no-PR triggers, pre-check, cache, dispatch input). ✅
- **Proporción:** 1 tarea, 4 archivos, sin transcripciones. ✅

## Fuera de alcance

- Compilar Aseprite desde fuente en runners hosted (no soportado/licencia); el goal permite self-hosted/nightly.
- Cambiar los tests de integración (siguen con su gate `skip` para uso local sin Aseprite).
