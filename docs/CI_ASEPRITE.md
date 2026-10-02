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
  - Aseprite instalado (Steam o standalone).
  - Al menos una fuente del sistema de Windows: `C:\Windows\Fonts\arial.ttf` o
    `C:\Windows\Fonts\segoeui.ttf` (sin ninguna, el test de texto se salta).
  - Registrado con los labels `self-hosted`, `windows` y `aseprite`.

Node.js 24 **no** hace falta preinstalarlo en la máquina: el workflow lo instala
con `actions/setup-node`. El step de pre-check exige el binario de Aseprite y al
menos una de esas fuentes, y falla con `exit 1` si falta cualquiera de los dos.

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

`workflow_dispatch` y `schedule` solo funcionan cuando el workflow ya existe en
la rama por defecto (`develop`). **Mientras el PR esté abierto, `gh workflow run`
fallará**: los workflows de una rama de feature no son desplegables. Antes del
merge, la verificación disponible es el check de PR (`typecheck`) y que el
archivo exista en la rama.

Orden correcto: **merge a `develop` → registrar el runner → `gh workflow run`**.

Después del merge:

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

Para no acumular runs en cola, comenta solo el bloque `schedule:` del workflow
mientras no haya runner (no comentes `on:`, dejarías `workflow_dispatch` huérfano):

```yaml
  # schedule:
  #   - cron: '0 8 * * *' # nightly, 08:00 UTC
```

Al registrar el runner, descomenta el bloque. Un run manual ya encolado puede
cancelarse con `gh run cancel <run-id>`.

## Evidencia esperada

Con el runner registrado y Aseprite accesible, el step
**Run real Aseprite integration tests** (que ejecuta `npm run test:integration`)
debe reportar **8/8 tests OK, 0 skipped**. El step **Verify Aseprite binary and
system font** falla con `exit 1` y un mensaje explícito si falta el binario o si
no existe ninguna fuente (`arial.ttf`/`segoeui.ttf`), en vez de dejar el job en
verde con 7/8.
