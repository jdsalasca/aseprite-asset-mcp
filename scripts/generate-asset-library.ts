import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

type Kind = "sprite" | "tileset" | "scene" | "effect" | "character" | "prop";
interface Seed { id: string; title: string; category: string; kind: Kind; description: string; tags: string[]; variants: string[]; }

const root = path.resolve("assets/folders");
const palette = ["#10182b", "#263a5a", "#4d7c83", "#79b68a", "#d5c276", "#e89b72", "#d95d75", "#f4f0d0"];
const characterArchetypes = ["knight", "ranger", "mage", "cleric", "rogue", "barbarian", "paladin", "monk", "alchemist", "bard", "farmer", "guard", "merchant", "healer", "blacksmith", "scholar", "nomad", "sailor", "scout", "priest", "queen", "king", "witch", "necromancer", "druid", "engineer", "thief", "pirate", "cartographer", "cook"];
const characterVariants = ["apprentice", "veteran", "forest", "desert", "royal"];
const staticSeeds: Seed[] = [
  ...["oak", "pine", "willow", "baobab", "palm", "cherry", "mangrove", "birch", "cedar", "maple", "acacia", "redwood", "cypress", "sakura", "dead-tree", "fruit-tree", "ancient-tree", "crystal-tree", "autumn-tree", "moon-tree"].map((id) => ({ id, title: id.replaceAll("-", " "), category: "flora", kind: "prop" as const, description: `${id.replaceAll("-", " ")} with reusable weather and wildlife variants.`, tags: ["tree", "nature", "world"], variants: ["rain", "fire", "earthquake", "birds", "wind", "autumn"] })),
  ...["rose-bush", "berry-bush", "fern", "bamboo", "cactus", "lavender", "sunflower", "mushroom", "water-lily", "seaweed", "coral", "reeds", "hedge", "ivy", "moss", "wheat", "sugarcane", "blue-flower"].map((id) => ({ id, title: id.replaceAll("-", " "), category: "flora", kind: "prop" as const, description: `${id.replaceAll("-", " ")} prop for layered scenes.`, tags: ["plant", "nature", "decor"], variants: ["rain", "wind", "snow", "fire"] })),
  ...["wolf", "fox", "deer", "boar", "bear", "rabbit", "eagle", "owl", "raven", "parrot", "seagull", "frog", "turtle", "whale", "dolphin", "shark", "crab", "butterfly", "firefly", "bee", "horse"].map((id) => ({ id, title: id.replaceAll("-", " "), category: "fauna", kind: "sprite" as const, description: `${id.replaceAll("-", " ")} with idle, walk, hit and habitat variants.`, tags: ["fauna", "wildlife", "animation"], variants: ["idle", "walk", "hit", "sleep", "rain"] })),
  ...["dragon-ember", "dragon-ice", "dragon-storm", "dragon-forest", "dragon-void", "griffin", "basilisk", "phoenix", "unicorn", "hydra", "kraken", "minotaur", "golem", "fairy", "sirena", "werewolf", "vampire", "djinn", "thunderbird", "kitsune"].map((id) => ({ id, title: id.replaceAll("-", " "), category: "mythical-creatures", kind: "sprite" as const, description: `${id.replaceAll("-", " ")} creature for living fantasy worlds.`, tags: ["creature", "mythology", "combat"], variants: ["idle", "walk", "attack", "roar", "hurt"] })),
  ...["mount-horse", "warhorse", "camel", "elephant", "dire-wolf", "griffin-mount", "dragon-mount", "giant-turtle", "elk-mount", "sky-whale", "mechanical-mount", "sea-serpent"].map((id) => ({ id, title: id.replaceAll("-", " "), category: "mounts", kind: "sprite" as const, description: `${id.replaceAll("-", " ")} mount with travel poses.`, tags: ["mount", "travel", "animation"], variants: ["idle", "walk", "run", "jump"] })),
  ...["sword", "greatsword", "dagger", "spear", "pike", "halberd", "bow", "crossbow", "staff", "wand", "hammer", "axe", "shield", "helmet", "armor", "torch", "lantern", "book", "potion", "key", "coin", "chest", "banner", "flag", "bell", "church-bell"].map((id) => ({ id, title: id.replaceAll("-", " "), category: "props-and-weapons", kind: "prop" as const, description: `${id.replaceAll("-", " ")} prop with clean silhouette and effect-ready layers.`, tags: ["prop", "equipment", "world"], variants: ["clean", "glow", "rain", "fire"] })),
  ...["forest", "desert", "tundra", "swamp", "volcanic", "coast", "beach", "ocean", "coral-reef", "mountain", "canyon", "river", "village", "castle", "ruins", "cave", "sky-island", "moon-valley", "flower-meadow", "haunted-marsh"].map((id) => ({ id, title: id.replaceAll("-", " "), category: "biomes-and-maps", kind: "scene" as const, description: `${id.replaceAll("-", " ")} map starter with layers, landmarks and atmosphere variants.`, tags: ["map", "scene", "tileset"], variants: ["day", "sunset", "night", "rain", "storm"] })),
  ...["cottage", "forest-cabin", "castle-hall", "throne-room", "library", "alchemy-lab", "blacksmith", "tavern", "church", "spacious-church", "market", "harbor", "lighthouse", "wizard-tower", "dungeon", "crypt", "greenhouse", "workshop", "bedroom", "kitchen", "ballroom", "observatory"].map((id) => ({ id, title: id.replaceAll("-", " "), category: "interiors", kind: "scene" as const, description: `${id.replaceAll("-", " ")} interior with modular floor, wall, light and prop layers.`, tags: ["interior", "architecture", "scene"], variants: ["day", "night", "firelight", "rain"] })),
  ...["rain", "snow", "fog", "dust", "leaves", "embers", "sparks", "magic-ring", "water-splash", "wave-reflection", "light-rays", "fire", "earthquake", "birds-flock", "bells", "wind-lines", "footsteps", "sword-slash", "healing", "portal"].map((id) => ({ id, title: id.replaceAll("-", " "), category: "scene-effects", kind: "effect" as const, description: `${id.replaceAll("-", " ")} deterministic overlay for scenes and sprites.`, tags: ["effect", "particles", "animation"], variants: ["subtle", "strong", "loop"] })),
  ...["lute", "flute", "drum", "harp", "horn", "bell-tower", "ocarina", "panpipes", "maraca", "music-box"].map((id) => ({ id, title: id.replaceAll("-", " "), category: "instruments", kind: "prop" as const, description: `${id.replaceAll("-", " ")} prop for taverns, churches and festivals.`, tags: ["instrument", "culture", "prop"], variants: ["clean", "played", "golden"] })),
];

const seeds: Seed[] = [
  ...characterArchetypes.flatMap((archetype) => characterVariants.map((variant) => ({ id: `${variant}-${archetype}`, title: `${variant} ${archetype}`, category: "characters", kind: "character" as const, description: `${variant} ${archetype} with idle, walk, run and action-ready sprite frames.`, tags: ["character", "walk", "animation", archetype], variants: ["idle", "walk", "run", "attack", "hurt", "celebrate"] }))),
  ...staticSeeds,
].map((seed) => seed.id === "dragon-ice" ? {
  ...seed,
  description: "Premium reference-derived ice dragon with articulated anatomy, crystal spines, wing silhouette and ice-breath animation-ready frames.",
  tags: [...seed.tags, "premium", "reference-derived", "high-detail"],
} : seed);

const categoryDescriptions: Record<string, string> = {
  characters: "120 character archetype variants with reusable movement states.",
  flora: "Trees, bushes, crops and plants with weather and wildlife variants.",
  fauna: "Living animals and ambient wildlife for inhabited scenes.",
  "mythical-creatures": "Mythological creatures with combat-ready states.",
  mounts: "Mounts with travel and movement states.",
  "props-and-weapons": "Weapons, accessories, bells, flags and world props.",
  "biomes-and-maps": "Map starters for beaches, oceans, villages and hostile biomes.",
  interiors: "Modular interior scene starters with lighting variants.",
  "scene-effects": "Rain, reflections, fire, earthquakes, birds and atmosphere overlays.",
  instruments: "Cultural props and instruments for lively interiors.",
};

function hash(text: string): number { let value = 2166136261; for (const character of text) value = Math.imul(value ^ character.charCodeAt(0), 16777619); return value >>> 0; }
function color(seed: string, offset: number): string { return palette[(hash(seed) + offset) % palette.length] ?? palette[0]!; }
async function withFileRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try { return await operation(); } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 60 * (attempt + 1)));
    }
  }
  throw lastError;
}
function svgFor(seed: Seed, frames = 1): string {
  const cell = 64;
  const width = cell * frames;
  const blocks: string[] = [];
  const background = seed.kind === "scene" ? `<rect width="${width}" height="64" fill="${color(seed.id, 0)}"/>` : "";
  const fauna = (x: number, frame: number): string => {
    const fur = color(seed.id, 3);
    const shadow = color(seed.id, 1);
    const light = color(seed.id, 6);
    const legs = frame % 2 === 0 ? [22, 31, 40, 48] : [24, 29, 42, 46];
    const headX = seed.id.includes("bird") || ["eagle", "owl", "raven", "parrot", "seagull"].includes(seed.id) ? 43 : 45;
    const wing = ["eagle", "owl", "raven", "parrot", "seagull", "butterfly"].includes(seed.id);
    const aquatic = ["whale", "dolphin", "shark", "turtle", "crab"].includes(seed.id);
    const antlers = ["deer", "elk-mount"].includes(seed.id);
    const ears = ["rabbit", "fox", "wolf", "deer", "horse"].some((name) => seed.id.includes(name));
    return [
      `<ellipse cx="${x + 33}" cy="54" rx="22" ry="3" fill="#10182b" opacity=".45"/>`,
      aquatic ? `<path d="M${x + 12} 34 L${x + 4} 28 L${x + 12} 26 L${x + 18} 31 Z" fill="${shadow}"/>` : "",
      `<path d="M${x + 11} 31 L${x + 18} 23 L${x + 39} 22 L${x + 49} 29 L${x + 44} 42 L${x + 17} 43 Z" fill="#10182b"/>`,
      `<path d="M${x + 14} 31 L${x + 20} 26 L${x + 37} 25 L${x + 45} 30 L${x + 41} 39 L${x + 19} 40 Z" fill="${fur}"/>`,
      wing ? `<path d="M${x + 24} 28 L${x + 35} 15 L${x + 40} 29 L${x + 32} 35 Z" fill="${light}"/>` : `<rect x="${x + 24}" y="27" width="7" height="11" fill="${light}" opacity=".72"/>`,
      ...legs.map((leg, index) => `<path d="M${x + leg} 39 L${x + leg + 4} 39 L${x + leg + (index % 2)} 53 L${x + leg - 2 + (index % 2)} 53 Z" fill="#10182b"/><rect x="${x + leg}" y="41" width="2" height="10" fill="${shadow}"/>`),
      `<path d="M${x + 41} 28 L${x + headX} 18 L${x + 55} 20 L${x + 56} 28 L${x + 47} 33 Z" fill="#10182b"/>`,
      `<path d="M${x + 44} 27 L${x + headX + 2} 20 L${x + 53} 22 L${x + 53} 26 L${x + 47} 30 Z" fill="${fur}"/>`,
      ears ? `<path d="M${x + 47} 21 L${x + 45} 12 L${x + 50} 18 L${x + 53} 12 L${x + 54} 22 Z" fill="${shadow}"/>` : "",
      antlers ? `<path d="M${x + 48} 18 L${x + 46} 9 M${x + 47} 12 L${x + 43} 8 M${x + 49} 14 L${x + 53} 9 M${x + 53} 18 L${x + 57} 11" stroke="${light}" stroke-width="2" fill="none"/>` : "",
      `<rect x="${x + 50}" y="23" width="2" height="2" fill="#f4f0d0"/><rect x="${x + 54}" y="27" width="3" height="2" fill="#10182b"/>`,
      aquatic ? `<path d="M${x + 27} 40 L${x + 36} 46 L${x + 27} 45 Z" fill="${light}"/>` : `<path d="M${x + 13} 31 L${x + 7} 27 L${x + 9} 36 Z" fill="${shadow}"/>`,
    ].join("");
  };
  const plant = (x: number, frame: number): string => `<rect x="${x + 29}" y="34" width="6" height="25" fill="#10182b"/><rect x="${x + 31}" y="35" width="3" height="22" fill="${color(seed.id, 2)}"/><path d="M${x + 32} 8 L${x + 14} 27 L${x + 22} 24 L${x + 11} 38 L${x + 27} 31 L${x + 17} 45 L${x + 32} 36 L${x + 48} 45 L${x + 38} 31 L${x + 54} 38 L${x + 43} 24 L${x + 51} 27 Z" fill="#10182b"/><path d="M${x + 32} ${11 + frame} L${x + 19} 27 L${x + 29} 24 L${x + 19} 37 L${x + 31} 30 L${x + 23} 41 L${x + 32} 34 L${x + 43} 41 L${x + 36} 30 L${x + 47} 37 L${x + 36} 24 L${x + 46} 27 Z" fill="${color(seed.id, 4)}"/>`;
  const character = (x: number, frame: number): string => `<ellipse cx="${x + 32}" cy="57" rx="17" ry="3" fill="#10182b" opacity=".5"/><path d="M${x + 21} 29 L${x + 43} 29 L${x + 48} 49 L${x + 16} 49 Z" fill="#10182b"/><path d="M${x + 24} 31 L${x + 40} 31 L${x + 44} 46 L${x + 20} 46 Z" fill="${color(seed.id, 2)}"/><rect x="${x + 26}" y="13" width="12" height="14" fill="#10182b"/><rect x="${x + 28}" y="15" width="8" height="9" fill="${color(seed.id, 5)}"/><rect x="${x + 18 + frame % 2 * 2}" y="32" width="6" height="14" fill="${color(seed.id, 1)}"/><rect x="${x + 40 - frame % 2 * 2}" y="32" width="6" height="14" fill="${color(seed.id, 1)}"/><rect x="${x + 24 + frame % 2}" y="47" width="6" height="11" fill="#10182b"/><rect x="${x + 35 - frame % 2}" y="47" width="6" height="11" fill="#10182b"/><rect x="${x + 31}" y="19" width="2" height="2" fill="#f4f0d0"/>`;
  for (let frame = 0; frame < frames; frame += 1) {
    const x = frame * cell;
    const accent = color(seed.id, frame + 2);
    if (seed.category === "fauna" || seed.category === "mounts") blocks.push(fauna(x, frame));
    else if (seed.category === "mythical-creatures") blocks.push(`${fauna(x, frame)}<path d="M${x + 15} 27 L${x + 5} 14 L${x + 19} 20 Z M${x + 40} 26 L${x + 54} 13 L${x + 48} 29 Z" fill="${accent}" opacity=".9"/>`);
    else if (seed.category === "characters") blocks.push(character(x, frame));
    else if (seed.category === "flora") blocks.push(plant(x, frame));
    else if (seed.category === "scene-effects") blocks.push(`<circle cx="${x + 32}" cy="32" r="10" fill="none" stroke="${accent}" stroke-width="3"/><path d="M${x + 8 + frame * 3} 11 L${x + 13 + frame * 2} 25 M${x + 51 - frame * 2} 37 L${x + 56 - frame} 53 M${x + 17} 50 L${x + 25} 42 M${x + 42} 16 L${x + 49} 10" stroke="${color(seed.id, 6)}" stroke-width="3"/>`);
    else if (seed.category === "biomes-and-maps" || seed.category === "interiors") blocks.push(`<rect x="${x + 5}" y="${seed.category === "interiors" ? 35 : 40}" width="54" height="19" fill="${color(seed.id, 1)}"/><path d="M${x + 5} 40 L${x + 18} 28 L${x + 31} 36 L${x + 43} 20 L${x + 59} 33 V54 H${x + 5}Z" fill="${color(seed.id, 4)}"/><rect x="${x + 12}" y="${seed.category === "interiors" ? 22 : 30}" width="12" height="20" fill="${accent}"/><rect x="${x + 39}" y="${seed.category === "interiors" ? 18 : 27}" width="11" height="25" fill="${color(seed.id, 6)}"/><path d="M${x + 28} 12 V54 M${x + 20} 20 H${x + 36}" stroke="#f4f0d0" stroke-width="2" opacity=".6"/>`);
    else blocks.push(`<path d="M${x + 12} 48 L${x + 23} 13 L${x + 49} 13 L${x + 53} 19 L${x + 43} 50 Z" fill="#10182b"/><path d="M${x + 18} 45 L${x + 27} 17 L${x + 44} 17 L${x + 47} 21 L${x + 39} 45 Z" fill="${color(seed.id, 3)}"/><rect x="${x + 26}" y="${20 + frame % 3 * 3}" width="4" height="15" fill="${accent}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="64" viewBox="0 0 ${width} 64" shape-rendering="crispEdges">${background}${blocks.join("")}</svg>`;
}

function readme(seed: Seed, folder: string): string {
  const inline = (value: string) => "`" + value + "`";
  const variants = seed.variants.map((variant) => `- ${inline(variant)}: variante determinista sugerida para el pipeline.`).join("\n");
  return [`# ${seed.title}`, "", seed.description, "", `- **ID:** ${inline(seed.id)}`, `- **Categoría:** ${inline(seed.category)}`, "- **Formatos base:** PNG, GIF animado, SVG y JSON", "- **Archivos:** [preview.png](./preview.png), [sprite-sheet.png](./sprite-sheet.png), [sprite-sheet.gif](./sprite-sheet.gif), [manifest.json](./manifest.json)", "- **Reproducible:** sí; el catálogo y los previews se generan con la semilla derivada del ID.", "", "## Variantes", "", variants, "", "## Ejemplo MCP", "", `Busca este asset con ${inline("get_asset_library")} y después compón una receta con ${inline("create_asset_recipe")}. Para una salida animada, usa ${inline("run_asset_recipe")} con ${inline("animation_pixel_art")} o aplica el efecto indicado por la variante.`, "", "## Carpeta", "", inline(folder), ""].join("\n");
}

async function writeItem(seed: Seed): Promise<{ id: string; title: string; category: string; folder: string; kind: Kind; description: string; tags: string[]; variants: string[]; formats: ["png", "gif", "svg", "json"]; readmePath: string; previewPath: string; spritePath: string; animationPath: string; deterministic: true }> {
  const folder = `${seed.category}/${seed.id}`;
  const directory = path.join(root, seed.category, seed.id);
  if (seed.id === "dragon-ice") {
    try {
      const existingManifest = JSON.parse(await fs.readFile(path.join(directory, "manifest.json"), "utf8")) as { source?: string };
      if (existingManifest.source === "imagegen-reference-derived-v1") {
        return { id: seed.id, title: seed.title, category: seed.category, folder, kind: seed.kind, description: seed.description, tags: seed.tags, variants: seed.variants, formats: ["png", "gif", "svg", "json"], readmePath: `${folder}/README.md`, previewPath: `${folder}/preview.png`, spritePath: `${folder}/sprite-sheet.png`, animationPath: `${folder}/sprite-sheet.gif`, deterministic: true };
      }
    } catch { /* the premium asset is created later when no manifest exists */ }
  }
  await fs.mkdir(directory, { recursive: true });
  const previewSvg = svgFor(seed);
  const spriteSvg = svgFor(seed, 4);
  const spritePng = await sharp(Buffer.from(spriteSvg)).png().toBuffer();
  const rawFrames = await Promise.all(Array.from({ length: 4 }, (_, frame) => sharp(spritePng).extract({ left: frame * 64, top: 0, width: 64, height: 64 }).raw().toBuffer()));
  await withFileRetry(() => fs.writeFile(path.join(directory, "preview.svg"), previewSvg, "utf8"));
  await withFileRetry(() => fs.writeFile(path.join(directory, "sprite-sheet.svg"), spriteSvg, "utf8"));
  await withFileRetry(() => sharp(Buffer.from(previewSvg)).png().toFile(path.join(directory, "preview.png")));
  await withFileRetry(() => fs.writeFile(path.join(directory, "sprite-sheet.png"), spritePng));
  await withFileRetry(() => sharp(Buffer.concat(rawFrames), { raw: { width: 64, height: 64 * 4, channels: 4, pageHeight: 64 }, animated: true }).gif({ delay: [180, 180, 180, 180], loop: 0 }).toFile(path.join(directory, "sprite-sheet.gif")));
  const manifest = { schemaVersion: 2, id: seed.id, title: seed.title, category: seed.category, kind: seed.kind, source: "deterministic-library-generator-v2", seed: hash(seed.id), render: { cellSize: 64, shapeRendering: "crispEdges", transparentSpriteBackground: seed.kind !== "scene" }, variants: seed.variants, assets: ["preview.png", "sprite-sheet.png", "sprite-sheet.gif", "preview.svg", "sprite-sheet.svg"], tags: seed.tags, sourcePreserved: true, deterministic: true };
  await withFileRetry(() => fs.writeFile(path.join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
  await withFileRetry(() => fs.writeFile(path.join(directory, "README.md"), readme(seed, folder), "utf8"));
  return { id: seed.id, title: seed.title, category: seed.category, folder, kind: seed.kind, description: seed.description, tags: seed.tags, variants: seed.variants, formats: ["png", "gif", "svg", "json"], readmePath: `${folder}/README.md`, previewPath: `${folder}/preview.png`, spritePath: `${folder}/sprite-sheet.png`, animationPath: `${folder}/sprite-sheet.gif`, deterministic: true };
}

async function main(): Promise<void> {
  await fs.mkdir(root, { recursive: true });
  if (!process.argv.includes("--force")) {
    try {
      const current = JSON.parse(await fs.readFile(path.join(root, "catalog.json"), "utf8")) as { libraryVersion?: string; items?: unknown[] };
      if (current.libraryVersion === "asset-library-v2" && Array.isArray(current.items) && current.items.length >= 100) {
        console.log(JSON.stringify({ root, itemCount: current.items.length, skipped: true, reason: "asset-library-v2-already-generated", force: "npm run asset:library:catalog -- --force" }, null, 2));
        return;
      }
    } catch { /* first generation or an incomplete catalog continues normally */ }
  }
  type GeneratedItem = Awaited<ReturnType<typeof writeItem>>;
  const items: GeneratedItem[] = [];
  for (const seed of seeds) items.push(await writeItem(seed));
  const categoryIds = [...new Set(items.map((item) => item.category))];
  const categories = categoryIds.map((id) => ({ id, title: id.replaceAll("-", " "), description: categoryDescriptions[id] ?? "Reusable deterministic pixel-art assets.", itemCount: items.filter((item) => item.category === id).length }));
  for (const category of categories) {
    const categoryItems = items.filter((item) => item.category === category.id);
    const examples = categoryItems.slice(0, 12).map((item) => `- [${item.title}](./${item.id}/README.md): ${item.description}`).join("\n");
    await fs.writeFile(path.join(root, category.id, "README.md"), [`# ${category.title}`, "", category.description, "", `Esta carpeta contiene ${category.itemCount} assets deterministas. Cada subcarpeta documenta sus previews, sprite sheets PNG/SVG, GIF animado, manifest y variantes.`, "", "## Ejemplos", "", examples, "", "## Uso", "", "Busca por categoría con `get_asset_library`, resuelve un item con `get_asset_library_item` y aplica las variantes con los algoritmos del MCP sobre una copia del asset.", ""].join("\n"), "utf8");
  }
  const presets = [
    { id: "living-forest", title: "Living forest", description: "Trees, wildlife, rain and fire-ready effects for a layered forest scene.", category: "flora", itemIds: ["oak", "pine", "wolf", "owl", "rain", "fire"], recommendedTools: ["generate_world_map", "generate_environment_pack", "generate_time_of_day_pack"], deterministic: true as const },
    { id: "coastal-sunset", title: "Coastal sunset", description: "Beach, ocean, reflections, birds and a time-of-day transition.", category: "biomes-and-maps", itemIds: ["beach", "ocean", "coral-reef", "seagull", "wave-reflection", "coast"], recommendedTools: ["generate_beach_scene", "generate_time_of_day_pack", "apply_depth_lighting"], deterministic: true as const },
    { id: "fantasy-quest", title: "Fantasy quest", description: "A character, mount, dragon, weapons and a dungeon-ready scene.", category: "characters", itemIds: ["veteran-knight", "forest-ranger", "dragon-ember", "warhorse", "sword", "dungeon"], recommendedTools: ["create_character_plan", "create_scene_plan", "run_asset_recipe"], deterministic: true as const },
    { id: "rainy-village", title: "Rainy village", description: "Village interiors, church bell, rain and inhabitants.", category: "interiors", itemIds: ["village", "church", "church-bell", "rain", "veteran-merchant", "apprentice-farmer"], recommendedTools: ["generate_environment_pack", "generate_time_of_day_pack", "generate_particle_burst"], deterministic: true as const },
  ];
  const catalog = { schemaVersion: 1 as const, libraryVersion: "asset-library-v2", categories, items, presets };
  await fs.writeFile(path.join(root, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  const inline = (value: string) => "`" + value + "`";
  const categoryLines = categories.map((category) => `- [${category.title}](./${category.id}/): ${category.itemCount} items`).join("\n");
  await fs.writeFile(path.join(root, "README.md"), [`# Asset folders`, "", `Esta biblioteca contiene ${items.length} carpetas deterministas. Cada carpeta incluye README, manifest, preview PNG/SVG y sprite sheet PNG/SVG/GIF animado.`, "", "## Calidad y procedencia", "", "- El renderer v2 usa celdas de 64×64, formas por dominio y renderizado crispEdges; los sprites no usan el bloque universal anterior.", "- La suite de calidad comprueba dimensiones, transparencia, cobertura, complejidad de silueta y componentes conectados para fauna, monturas y personajes.", "- El ciervo es un caso reference-derived: su manifest conserva URL, licencia, hash y parámetros de conversión desde una referencia pública.", "- Regenera el ciervo con `npm run asset:reference-fauna` y una variable `DEER_REFERENCE_FILENAME` apuntando a la referencia descargada.", "", "## Navegación rápida", "", `- Consulta ${inline("catalog.json")} o usa el MCP ${inline("get_asset_library")}.`, `- Resuelve un item con ${inline("get_asset_library_item")}.`, `- Usa presets con ${inline("get_asset_preset")}.`, "- Las variantes de lluvia, fuego, terremoto, pájaros, luz y movimiento se aplican con los algoritmos del MCP.", "", "## Categorías", "", categoryLines, ""].join("\n"), "utf8");
  console.log(JSON.stringify({ root, itemCount: items.length, categoryCount: categories.length, presetCount: presets.length }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
