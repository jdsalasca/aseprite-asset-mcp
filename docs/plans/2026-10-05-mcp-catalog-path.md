Estado: completada. MCP 211/211. De ENOENT a 339 assets, 10 categorias y 4 presets desde el
Studio. El test que cubria el default pasaba solo porque el runner arranca en la raiz del repo;
estre cambia de CWD a proposito.

# F29 (MCP) · El catálogo de la biblioteca no debe depender del directorio de trabajo

Ronda 54. Sale de una captura de la ronda 52: en un proyecto recién abierto, BIBLIOTECA pintaba

```
No se pudo leer la biblioteca
ENOENT: no such file or directory, open '…\aseprite-asset-studio\assets\folders\catalog.json'
```

El `ENOENT` apuntaba al directorio **del Studio**, no al del MCP. Eso no era un catálogo ausente: el
catálogo existe, son 290 KB con más de 250 assets, y vive en el repo del MCP.

## El hueco, medido antes de tocar nada

```ts
public constructor(private readonly catalogPath = path.resolve("assets/folders/catalog.json")) {}
```

`path.resolve` con una ruta relativa se resuelve contra **`process.cwd()`**, no contra el paquete. El
MCP lo lanza el gateway del Studio con el CWD en el directorio del Studio, así que el catálogo nunca
aparece donde se busca. Toda la biblioteca —assets, presets, escenas, recomendaciones— depende de este
`load()`.

Peor: el test que aparentemente lo cubre no lo cubre.

```ts
test("generated asset library exposes 100+ navigable folders …", async () => {
  const catalog = await new FileAssetLibraryAdapter().load();   // sin ruta: usa el default
  …
  assert.ok((await fs.stat(path.resolve("assets/folders", item.readmePath))).isFile(), true);
```

Pasa **porque el runner arranca con CWD en la raíz del repo**, no porque el código sea correcto. Con
cualquier otro directorio de trabajo fallaría igual que el Studio. Las dos aserciones de `readmePath` y
`previewPath` repiten la misma dependencia, así que el test no puede servir de red.

El repo ya tiene la respuesta escrita, en `server-version.ts`, précisément por este motivo:

```ts
const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string };
```

`outDir` es `dist` con `rootDir` `src`, así que la profundidad de `import.meta.url` es idéntica en
`src` y en `dist`: el mismo idiom funciona en los dos.

## Criterios verificables

- [x] `load()` encuentra el catálogo con cualquier directorio de trabajo.
- [x] El test que lo demuestra cambia de CWD, de modo que no pueda pasar por casualidad.
- [x] El fallo con el bug puesto (ENOENT) queda en la evidencia.
- [x] Suite, typecheck y build del MCP en verde; y la biblioteca del Studio deja de enseñar ENOENT.

## Fuera de alcance

- Las aserciones `path.resolve("assets/folders", …)` del test existente: son la misma trampa, pero en
  el test, y los scripts de npm siempre arrancan en la raíz del repo. Se anotan, no se tocan.
- Los siete sitios que instancian `FileAssetLibraryAdapter`: el default corregido los arregla a todos.
- Cachear el catálogo: `load()` lee 290 KB en cada llamada y hay siete servicios que lo piden. Es
  trabajo real, pero es otro problema y no lo mezcla con este.