# CI — Integración real con Aseprite

Workflow: [`.github/workflows/aseprite-integration.yml`](../.github/workflows/aseprite-integration.yml)

## Por qué

La suite unitaria (`npm test`) corre en cada PR contra `ubuntu-latest` y no abre
Aseprite. Los 8 tests de integración reales viven en
`tests-ts/integration/real-aseprite.test.ts` y usan un gate
`skip: !existsSync(ASEPRITE_PATH ?? default Steam Windows)`. En los runners
hosted de GitHub ese binario no existe, así que los 8 tests se **saltan** y la
integración real nunca se verifica.

Este workflow los ejecuta en un runner **self-hosted** con Aseprite instalado,
por lo que el gate se cumple y los 8 tests corren de verdad (8/8, sin skips).

## Requisitos

- Un runner self-hosted **Windows** con:
  - Node.js 24 y npm.
  - Aseprite instalado (Steam o standalone).
  - Registrado con los labels `self-hosted`, `windows` y `aseprite`.

## Registro del runner

1. En GitHub, entra al repo **Settings → Actions → Runners → New self-hosted
   runner** y copia el token de registro.
2. En la máquina Windows, descarga y descomprime `actions/runner`:

   ```powershell
   Invoke-WebRequest -Uri https://github.com/actions/runner/releases/latest/download/actions-runner-win-x64.zip -OutFile actions-runner.zip
   Expand-Archive actions-runner.zip -DestinationPath actions-runner
   ```

3. Configura el runner con los labels requeridos (el label `self-hosted` y
   `windows` se añaden automáticamente si faltan; `aseprite` es obligatorio):

   ```powershell
   .\config.cmd --url https://github.com/jdsalasca/aseprite-asset-mcp --token <TOKEN> --labels aseprite,windows
   ```

4. Ejecútalo en primer plano con `run.cmd`, o instálalo como servicio para que
   arranque con Windows:

   ```powershell
   .\run.cmd
   # o
   .\svc.cmd install
   .\svc.cmd start
   ```

## Variable `ASEPRITE_PATH`

El workflow resuelve la ruta en este orden:

1. Input `aseprite_path` de `workflow_dispatch`.
2. Variable de repositorio `vars.ASEPRITE_PATH`.
3. Default: `C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe`.

Para fijar la variable del repositorio:

```bash
gh variable set ASEPRITE_PATH --body "C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe" --repo jdsalasca/aseprite-asset-mcp
```

## Disparo manual

```bash
gh workflow run "Aseprite integration"
# con override de ruta
gh workflow run "Aseprite integration" -f aseprite_path="D:\Aseprite\Aseprite.exe"
```

Además corre en `schedule` cada noche a las 08:00 UTC.

## Nota: runs en cola hasta registrar el runner

Mientras el runner `[self-hosted, windows, aseprite]` no exista, cualquier run
(nightly o manual) queda en **`queued`** indefinidamente porque ningún runner
satisface los labels.

Para no acumular runs en cola, comenta el bloque `schedule:` del workflow
mientras no haya runner:

```yaml
# on:
#   schedule:
#     - cron: '0 8 * * *' # nightly, 08:00 UTC
```

Al registrar el runner, descomenta el bloque. Un run manual ya encolado puede
cancelarse con `gh run cancel <run-id>`.

## Evidencia esperada

Con el runner registrado y Aseprite accesible, el step
**Run real Aseprite integration tests** debe reportar **8/8 tests OK, 0
skipped**. El step **Verify Aseprite binary** falla con `exit 1` (y un mensaje
explícito) si el binario no existe, en vez de saltar silenciosamente.
