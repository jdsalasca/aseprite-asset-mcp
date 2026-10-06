Estado: completada. 215/215 en el MCP, 4 tests nuevos. Sin if nuevo: una expresion con path.resolve.

Comprobado con el comando, no solo con unit tests: antes el proyecto pedido quedaba vacio y los dos
JSON caian en el shell; despues los dos van dentro del proyecto y el shell queda vacio. El --output
absoluto explicito se comprueba aparte porque es el caso que un arreglo bienintencionado rompe.

El defecto de fondo: oot y outputDirectory se calcularon por separado y por eso discreparon. Ahora
CliOptions.outputDirectory lleva la ruta ya resuelta, asi que la discrepancia no puede reaparecer
aunque se llame desde otro sitio.

De paso: el CLI **no tenia ni un test**, y tiene dos puntos de entrada publicados (sset:character,
sset:scene). Cuatro tests no son cobertura, son la licencia minima para poder tocarlo.

Observado y no tocado: la raiz del repo tiene ~125 directorios .artifact-* que los tests dejan al
correr. estan en .gitignore (git status sale limpio) pero ensucian la raiz. Limpiar eso y que los tests
escriban en el temporal es ronda propia.

Bloqueo vivo: publicar 1.1.1 sigue necesitando credenciales (E401). Este arreglo esta en el repo pero no
llega a los usuarios por npm mientras tanto.

# Los artefactos del CLI caen en el directorio equivocado

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Que `--output` se resuelva contra `--root` cuando es relativo, de modo que los artefactos de un workflow caigan dentro del proyecto que el usuario nombró.

**Architecture:** `parseCliOptions` calcula `root` y `outputDirectory` por separado. `root` por defecto es `process.cwd()`, pero `outputDirectory` por defecto es la ruta **relativa** `artifacts/aseprite`, que se resuelve contra el CWD al usarla. Se arregla en el mismo sitio donde ya se calculan las dos: una sola expresión, sin tocar los scripts que llaman.

**Tech Stack:** TypeScript, `node:path`, `node:test` vía `tsx --test` (la suite del MCP usa `tests-ts/**/*.test.ts` con `tsx --test`, no vitest).

**Spec:** el fallo está reproducido en la medicion de este plan; la evidencia del cierre queda en `docs/evidence/round-67-cli-output-root/`.

## Global Constraints

- **Ni un `if` nuevo.** El arreglo es una expresión. Si aparece una rama, es que se está tapando algo.
- **`path.resolve` y no `path.join`.** `join` concatena dos absolutas y produce basura; `resolve` respeta una segunda ruta absoluta tal cual, que es justo lo que se necesita para que un `--output` absoluto explícito siga funcionando.
- **El MCP no usa vitest.** Los tests van con `node:test` y se corren con `npm run test:ts`. Un test escrito con `vitest` no se ejecutaría: pasaría a cuenta de nadie.
- **`npm test` incluye el typecheck.** Para el test rojo basta `npx tsx --test tests-ts/cli.test.ts`, que es más rápido y dice qué falló.

## Review Focus

- **Un `--output` absoluto y explícito**: hay que respetarlo aunque esté fuera de `--root`. Es el usuario diciendo "aquí". Convertirlo a relativo o a "dentro del root" sería un fallo nuevo, y uno peor: quitarle al usuario la capacidad de escribir donde quiere.
- **`--root` ausente**: entonces `root` es `process.cwd()` y `--output` debe caer en el CWD, que es lo de siempre. Es el caso que ya funcionaba y no puede cambiar.
- **`--output` relativo con `--root` ausente**: los dos son el CWD, así que coincide. Nada que hacer, pero el test lo deja escrito.
- **El separador de ruta**: el valor por defecto es `path.join("artifacts", "aseprite")`, que ya produce `artifacts\aseprite` en Windows. El test compara rutas **resueltas**, no cadenas, o fallaría solo por el separador.
- **Windows y mayúsculas**: `path.resolve` no normaliza mayúsculas. La comparación del test debe hacerse con las dos rutas=viniendo del mismo `path.resolve`, no con literales escritos a mano.

---

### Task 1: El test, primero

**Files:**
- Create: `tests-ts/cli.test.ts`

**Interfaces:**
- Consumes: `parseCliOptions` de `src/workflows/cli.ts`, que toma `string[]` y devuelve `CliOptions { execute: boolean; outputDirectory: string; root: string }`.
- Produces: cuatro expectativas sobre dónde acaba `outputDirectory`.

- [x] **Step 1: Escribe el test**

Con `import { deepStrictEqual, strictEqual } from "node:assert"` y `import { test } from "node:test"`, como el resto de la suite del MCP.

Los cuatro casos, con sus valores exactos:

1. `parseCliOptions(["--root", RAIZ])` → `outputDirectory` es exactamente `path.resolve(RAIZ, "artifacts", "aseprite")`. Esta es la línea que hoy falla.
2. `parseCliOptions(["--root", RAIZ, "--output", "salida"])` → `outputDirectory` es `path.resolve(RAIZ, "salida")`.
3. `parseCliOptions(["--root", RAIZ, "--output", ABSOLUTO])`, donde `ABSOLUTO = path.resolve("C:", "tmp", "destino-explicito")` → `outputDirectory` es `ABSOLUTO` **sin cambiar**. Si el arreglo tocara los absolutos, este caso es el que lo coge.
4. `parseCliOptions([])` → `root` es `process.cwd()` y `outputDirectory` es `path.resolve(process.cwd(), "artifacts", "aseprite")`.

`RAIZ` es un temporal real creado con `fs.mkdtempSync(path.join(os.tmpdir(), "cli-root-"))` y borrado al final. **No usar literales de ruta**: en Windows el separador y las mayúsculas hacen fallar comparaciones de cadenas que en Linux pasan.

- [x] **Step 2: Ejecuta y mira cómo falla**

Run: `npx tsx --test tests-ts/cli.test.ts`
Expected: FAIL en el caso 1, y el fallo tiene que decir que esperaba `C:\...\artifacts\aseprite` y recibió `artifacts\aseprite`. **Ese detalle es la prueba de que el test mide el fallo real y no otra cosa.**

- [x] **Step 3: Commitea el rojo**

```bash
git add tests-ts/cli.test.ts
git commit -m "test: cli artifacts must land under --root, not under the working directory"
```

### Task 2: El arreglo

**Files:**
- Modify: `src/workflows/cli.ts:19-28`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: la misma firma `parseCliOptions(args: string[]): CliOptions`.

- [x] **Step 4: Resuelve el output contra la raíz**

En `parseCliOptions`, calcula primero `root` y luego resuelve `outputDirectory` con `path.resolve(root, outputArgument || path.join("artifacts", "aseprite"))`.

`path.resolve` ya hace lo correcto en los dos casos: si el segundo argumento es relativo lo manda contra `root`, y si es absoluto lo respeta. No hace falta ninguna rama.

Un comentario que diga **por qué**, en dos líneas: `--root` y `--output` tienen que significar lo mismo sobre "aquí", o el plan y el manifiesto de un proyecto acaban escritos en el directorio desde el que se lanzó el comando.

- [x] **Step 5: Los tests del plan, en verde**

Run: `npx tsx --test tests-ts/cli.test.ts`
Expected: PASS, 4/4.

- [x] **Step 6: La suite entera del MCP**

Run: `npm test`
Expected: PASS. El typecheck va dentro. Si algo falla, mira si es un script que esperaba `outputDirectory` **relativa**: los dos que lo usan, `character-workflow.ts` y `scene-workflow.ts`, solo hacen `path.join` y lo meten en el plan, así que una ruta absoluta les sirve igual.

- [x] **Step 7: Comprobación con el caso real, no solo con unit tests**

Run, desde un directorio **distinto** del proyecto:

```
cd <shell-vacia>
npx tsx scripts/character-workflow.ts --root <proyecto>
```

Antes: los dos JSON salen en `<shell-vacia>\artifacts\aseprite\hero\` y `<proyecto>` queda vacío. Después: los dos JSON salen dentro de `<proyecto>` y `<shell-vacia>` sigue vacía.

Esta comprobación es la que importa. Un test que solo mira `parseCliOptions` verifica una funcion; esto verifica el comando.

- [x] **Step 8: Commit**

```bash
git add src/workflows/cli.ts
git commit -m "fix: resolve cli output against --root so artifacts land in the project"
```

### Task 3: Evidencia

**Files:**
- Create: `docs/evidence/round-67-cli-output-root/`

**Interfaces:**
- Consumes: la salida real del paso 7 y de `npm test`.

- [x] **Step 9: Guarda la evidencia**

`mcp-tests.txt` con la salida de `npm test`, `antes-despues.txt` con el árbol de ficheros de los dos directorios antes y después, y `verificacion.txt` con el defecto, el arreglo y el por qué.

- [x] **Step 10: Cierra**

Temporales borrados, plan marcado, `git status` limpio, commit de la evidencia.

## Self-Review

- **Cobertura**: las cinco entradas de Review Focus tienen test — el absoluto explícito (caso 3), el `--root` ausente (caso 4), el relativo sin `--root` (caso 4), y el separador/mayúsculas (resuelto por construcción: el test compara contra `path.resolve` y usa `mkdtemp`, no literales).
- **Paso a paso**: el paso 7 es el único que exige criterio —dar por bueno un arreglo porque pasan cuatro tests unitarios sin comprobar el comando real— y por eso está escrito como paso aparte y no como "verificación".
- **Tipos**: `CliOptions.outputDirectory` sigue siendo `string`. Nada del consumidor cambia de tipo, solo de valor.
- **Proporción**: cuatro tests, una expresión, un comentario. El plan es más largo que el diff porque lo que no puede decidir el ejecutor es por qué `resolve` y no `join`, y por qué un absoluto explícito no se toca.