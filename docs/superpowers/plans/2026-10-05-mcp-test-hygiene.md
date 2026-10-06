Estado: completada. 216/216 en el MCP. 123 directorios fuera de la raiz; la suite ya no anade ninguno.

Lo incomoda no era la mugre: es que **git no la veia**. Los 156 ficheros eran .png y .gif, y .gitignore ya
descarta ambos por ser archivos de Aseprite, asi que \git status\ salia limpio y \git ls-files\ daba 0.
Cuatro dias y nada se quejo. En cuanto un test escribiese ahi un .json, apareceria como untracked y se
podria commitear por accidente. Por eso la guardia mira **el disco**: aqui el estado de git no puede ser
el vigilante de si mismo.

El borrado va DESPUES del rojo a proposito: si se borraran primero, el test pasaria sin que nadie hubiera
visto que detecta algo. Y al borrarlos, \git status\ solo mostro mis cambios, lo que confirma la tesis de
que eran invisibles para git — si hubieran estado versionados, habria salido una oleada de \D\.

Siguiente: los otros tests del MCP pueden tener el mismo patron (\process.cwd()\ como temporal). Esta
ronda solo arreglo el que habia medido; comprobar el resto del suite es la ronda siguiente.

# Los tests dejan 117 directorios en la raiz del repo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Que `tests-ts/artifact-resolver.test.ts` escriba en el temporal del sistema y limpie lo que crea, y que exista un test que falle si algo vuelve a escribir en la raiz del repo.

**Architecture:** Un helper de cinco lineas que hace `mkdtemp` en `os.tmpdir()` y registra el borrado con `t.after`. Los tres tests que hoy crean directorios pasan a usarlo. Y un test de guardia al principio del mismo fichero: si aparece un `.artifact-*` en la raiz, rojo.

**Tech Stack:** `node:test` (`tsx --test`), `node:os`, `node:fs/promises`.

**Spec:** la medicion esta en este plan; la evidencia del cierre va a `docs/evidence/round-68-test-hygiene/`.

## Global Constraints

- **Un solo fichero.** El test de guardia vive en `artifact-resolver.test.ts`, no en uno nuevo. Quien edite el fichero que causo el problema tiene que ver la guardia en la misma pantalla; separarla es como esconder el aviso en otro edificio.
- **La guardia mira el disco, no el estado de git.** Y por eso mismo, y no por casualidad: git no ve estos ficheros. Ver "Por que nadie lo vio" abajo.

## Review Focus

- **Por que nadie lo vio en cuatro dias**: los 156 ficheros que hay dentro son 117 `.png` y 39 `.gif`, y `.gitignore` ya descarta ambos por ser archivos de Aseprite. `git status` sale limpio. `git ls-files` da 0. **La mugre era invisible solo por una coincidencia de extension.** En cuanto un test escriba ahi un `.json`, aparecera como untracked y se podra commitear por accidente. Por eso la guardia mira el disco: el estado de git no puede ser el vigilante de si mismo aqui.
- **El segundo test usa `path.join(process.cwd(), ".missing-output.gif")`**: parece del mismo tipo y **no hay que tocarlo**. No escribe nada; solo necesita una ruta que no exista para probar el rechazo de salida ausente. Cambiarla por el temporal no estaria mal, pero seria cambiar algo que ya esta bien.
- **Borrar los 117 directorios**: es lo unico de la ronda que no es codigo. Si se hace antes de tener el test verde, no hay forma de saber que la ronda lo arreglo y no que solo lo borro.

---

### Task 1: La guardia, que es lo que mas importa

**Files:**
- Modify: `tests-ts/artifact-resolver.test.ts` — un test nuevo al principio, imports de `os`, `readdir` y `rm`.

**Interfaces:**
- Consumes: el directorio raiz del repo, via `import.meta.dirname` o `process.cwd()`. La suite se corre desde la raiz (`npm test` → `tsx --test "tests-ts/**/*.test.ts"`), asi que `process.cwd()` es la raiz; se usa `process.cwd()` para no anadir una dependencia mas.
- Produces: un test que enumera los directorios `.artifact-*` de la raiz y falla si hay alguno.

- [x] **Step 1: Escribe la guardia**

Primer test del fichero, antes que los demas. Lee la raiz con `readdir({ withFileTypes: true })`, filtra los nombres que empiezan por `.artifact-`, y afirma que la lista esta vacia. El mensaje de fallo tiene que **listar los nombres**, no decir solo "hay directorios": si esto falla dentro de seis meses, quien lo lea necesita saber cuales son para entender que se ha colado.

Este test **falla hoy**, y tiene que fallar: esa es la prueba de que mide el problema y no otra cosa.

- [x] **Step 2: Ejecuta y mira cómo falla**

Run: `npx tsx --test tests-ts/artifact-resolver.test.ts`
Expected: FAIL en la guardia,lista los 117 nombres. Los otros tres tests pasan.

- [x] **Step 3: Borra los 117 directorios**

Run: borra en la raiz del repo todo directorio cuyo nombre empiece por `.artifact-`. **Despues del rojo, no antes**: si se borraran antes, el test pasaria sin que nadie hubiera visto que detectaba algo.

Comprueba que `git status` sigue limpio despues. Si no lo estuviera, habria versionado algo sin querer y hay que avisar antes de seguir.

- [x] **Step 4: La guardia, en verde**

Run: `npx tsx --test tests-ts/artifact-resolver.test.ts`
Expected: FAIL todavia, porque **los tests siguientes vuelven a crear directorios** en la raiz mientras se ejecutan. Si la guardia esta antes que ellos, se ejecuta antes de que creen nada, asi que deberia pasar. Este paso comprueba exactamente eso: si falla aqui, es porque algun test de este fichero crea su directorio **antes** de que corra la guardia, lo cual seria una pista.

- [x] **Step 5: Commitea el rojo con los 117 borrados**

```bash
git add tests-ts/artifact-resolver.test.ts
git commit -m "test: fail if any test leaves an .artifact- directory in the repo root"
```

El borrado de los 117 **no entra en el commit**: no estan versionados, asi que no hay nada que commitear. Se documenta en la evidencia.

### Task 2: Que no vuelvan a aparecer

**Files:**
- Modify: `tests-ts/artifact-resolver.test.ts` — imports y los tres tests que crean directorios.

**Interfaces:**
- Consumes: `TestContext` de `node:test`, para `t.after`.
- Produces: un helper local `temporal(t, prefix): Promise<string>` que devuelve una ruta nueva en `os.tmpdir()` y se limpia sola al acabar el test.

- [x] **Step 6: El helper**

Cinco lineas, en el mismo fichero, debajo de los imports:

```ts
async function temporal(t: TestContext, prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
```

Dos cosas que hace y que hay que entender antes de escribirlo:

- **`os.tmpdir()` y no `process.cwd()`**: la razon de que esto exista. El temporal del sistema es lo unico que se limpia solo cuando el proceso muere; la raiz del repo no.
- **`t.after` y no un `try/finally` en cada test**: con `t.after` no se puede olvidar el borrado al añadir un caso nuevo. Un `try/finally` se copia tres veces y el cuarto test se olvida.

- [x] **Step 7: Los tres tests, con el helper**

Sustituye cada `await mkdtemp(path.join(process.cwd(), ".artifact-X-"))` por `await temporal(t, ".artifact-X-")`, y cambia la firma de esos tres tests a `async (t)`. El **cuarto test no se toca**: su ruta no crea nada.

Los prefijos se conservan (`.artifact-test-`, `.artifact-distinct-`, `.artifact-allowed-`). Ahora viven en el temporal y no se ven, pero la guardia los seguiria viendo si alguien moviera el helper de vuelta, y es mejor que la guardia siga siendo sensible a ellos.

- [x] **Step 8: Ejecuta el fichero**

Run: `npx tsx --test tests-ts/artifact-resolver.test.ts`
Expected: PASS, 5/5, y **cero directorios `.artifact-*` nuevos en la raiz**. Las dos cosas se comprueban.

- [x] **Step 9: La suite entera del MCP**

Run: `npm test`
Expected: PASS, 215 + 1 = 216. El typecheck va dentro.

- [x] **Step 10: La prueba que de verdad importa**

Run: `npm test` y despues, en la misma consola: **contar los directorios `.artifact-*` en la raiz**.

Expected: **0**. Antes eran 117 y cada ejecucion de la suite anadia 3 mas. Este numero es el entregable de la ronda: una suite que se puede correr N veces sin ensuciar nada.

- [x] **Step 11: Commit**

```bash
git add tests-ts/artifact-resolver.test.ts
git commit -m "test: write artifact fixtures to the temp dir and clean them up"
```

### Task 3: Evidencia

**Files:**
- Create: `docs/evidence/round-68-test-hygiene/`

- [x] **Step 12: Guarda la evidencia**

`mcp-tests.txt` con la salida de `npm test`, `conteo.txt` con el antes y el despues de directorios y ficheros, y `verificacion.txt`.

- [x] **Step 13: Cierra**

Temporales borrados, plan marcado, `git status` limpio, commit de la evidencia.

## Self-Review

- **Cobertura**: las tres entradas de Review Focus tienen salida — la invisibilidad por la regla de `.gitignore` es la razon de ser de la guardia, el cuarto test que no hay que tocar se dice explicitamente en el paso 7, y el borrado se pone despues del rojo en el paso 3.
- **Paso a paso**: el paso 10 es el que exige criterio — dar el trabajo por bueno porque los tests pasan, cuando el sintoma es que **no** pasa nada visible— y por eso comprueba el numero, no el color del test.
- **Tipos**: `temporal(t: TestContext, prefix: string): Promise<string>`. Los tres tests pasan a `async (t)`. Nada mas cambia de firma.
- **Proporcion**: cinco tests, un helper de cinco lineas, tres lineas sustituidas, 117 directorios borrados. El plan es mas largo que el diff porque lo que no puede decidir el ejecutor es por que la guardia mira el disco y no git, y por que el borrado va despues del rojo.