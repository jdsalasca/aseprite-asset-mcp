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
];

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
function svgFor(seed: Seed, frames = 1): string {
  const width = 32 * frames;
  const blocks: string[] = [];
  for (let frame = 0; frame < frames; frame += 1) {
    const x = frame * 32;
    const accent = color(seed.id, frame + 2);
    blocks.push(`<rect x="${x + 5}" y="25" width="22" height="4" fill="${color(seed.id, 1)}"/>`);
    blocks.push(`<rect x="${x + 9}" y="9" width="14" height="18" fill="${color(seed.id, 0)}"/>`);
    blocks.push(`<rect x="${x + 12 + (frame % 2)}" y="4" width="8" height="8" fill="${accent}"/>`);
    blocks.push(`<rect x="${x + 6 + (frame % 3)}" y="15" width="4" height="4" fill="${color(seed.id, 4)}"/>`);
    blocks.push(`<rect x="${x + 22 - (frame % 3)}" y="15" width="4" height="4" fill="${color(seed.id, 5)}"/>`);
    blocks.push(`<rect x="${x + 13}" y="21" width="3" height="3" fill="${color(seed.id, 7)}"/>`);
    if (seed.category === "scene-effects") blocks.push(`<rect x="${x + 3 + frame * 2}" y="${6 + (frame % 4) * 4}" width="2" height="12" fill="${accent}"/><rect x="${x + 26 - frame}" y="${8 + (frame % 3) * 3}" width="2" height="10" fill="${color(seed.id, 6)}"/>`);
    if (seed.category === "flora") blocks.push(`<rect x="${x + 15}" y="28" width="3" height="4" fill="${color(seed.id, 3)}"/>`);
    if (seed.category === "biomes-and-maps") blocks.push(`<rect x="${x + 3}" y="3" width="26" height="26" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="2 2"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="32" viewBox="0 0 ${width} 32" shape-rendering="crispEdges"><rect width="${width}" height="32" fill="${palette[0]}"/>${blocks.join("")}</svg>`;
}

function readme(seed: Seed, folder: string): string {
  const inline = (value: string) => "`" + value + "`";
  const variants = seed.variants.map((variant) => `- ${inline(variant)}: variante determinista sugerida para el pipeline.`).join("\n");
  return [`# ${seed.title}`, "", seed.description, "", `- **ID:** ${inline(seed.id)}`, `- **Categoría:** ${inline(seed.category)}`, "- **Formatos base:** PNG, SVG y JSON", "- **Archivos:** [preview.png](./preview.png), [sprite-sheet.png](./sprite-sheet.png), [manifest.json](./manifest.json)", "- **Reproducible:** sí; el catálogo y los previews se generan con la semilla derivada del ID.", "", "## Variantes", "", variants, "", "## Ejemplo MCP", "", `Busca este asset con ${inline("get_asset_library")} y después compón una receta con ${inline("create_asset_recipe")}. Para una salida animada, usa ${inline("run_asset_recipe")} con ${inline("animation_pixel_art")} o aplica el efecto indicado por la variante.`, "", "## Carpeta", "", inline(folder), ""].join("\n");
}

async function writeItem(seed: Seed): Promise<{ id: string; title: string; category: string; folder: string; kind: Kind; description: string; tags: string[]; variants: string[]; formats: ["png", "gif", "svg", "json"]; readmePath: string; previewPath: string; spritePath: string; deterministic: true }> {
  const folder = `${seed.category}/${seed.id}`;
  const directory = path.join(root, seed.category, seed.id);
  await fs.mkdir(directory, { recursive: true });
  const previewSvg = svgFor(seed);
  const spriteSvg = svgFor(seed, 4);
  await Promise.all([
    fs.writeFile(path.join(directory, "preview.svg"), previewSvg, "utf8"),
    fs.writeFile(path.join(directory, "sprite-sheet.svg"), spriteSvg, "utf8"),
    sharp(Buffer.from(previewSvg)).png().toFile(path.join(directory, "preview.png")),
    sharp(Buffer.from(spriteSvg)).png().toFile(path.join(directory, "sprite-sheet.png")),
  ]);
  const manifest = { schemaVersion: 1, id: seed.id, title: seed.title, category: seed.category, kind: seed.kind, source: "deterministic-library-generator-v1", seed: hash(seed.id), variants: seed.variants, assets: ["preview.png", "sprite-sheet.png", "preview.svg", "sprite-sheet.svg"], tags: seed.tags, sourcePreserved: true, deterministic: true };
  await fs.writeFile(path.join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(directory, "README.md"), readme(seed, folder), "utf8");
  return { id: seed.id, title: seed.title, category: seed.category, folder, kind: seed.kind, description: seed.description, tags: seed.tags, variants: seed.variants, formats: ["png", "gif", "svg", "json"], readmePath: `${folder}/README.md`, previewPath: `${folder}/preview.png`, spritePath: `${folder}/sprite-sheet.png`, deterministic: true };
}

async function main(): Promise<void> {
  await fs.mkdir(root, { recursive: true });
  type GeneratedItem = Awaited<ReturnType<typeof writeItem>>;
  const items: GeneratedItem[] = [];
  for (const seed of seeds) items.push(await writeItem(seed));
  const categoryIds = [...new Set(items.map((item) => item.category))];
  const categories = categoryIds.map((id) => ({ id, title: id.replaceAll("-", " "), description: categoryDescriptions[id] ?? "Reusable deterministic pixel-art assets.", itemCount: items.filter((item) => item.category === id).length }));
  const presets = [
    { id: "living-forest", title: "Living forest", description: "Trees, wildlife, rain and fire-ready effects for a layered forest scene.", category: "flora", itemIds: ["oak", "pine", "wolf", "owl", "rain", "fire"], recommendedTools: ["generate_world_map", "generate_environment_pack", "generate_time_of_day_pack"], deterministic: true as const },
    { id: "coastal-sunset", title: "Coastal sunset", description: "Beach, ocean, reflections, birds and a time-of-day transition.", category: "biomes-and-maps", itemIds: ["beach", "ocean", "coral-reef", "seagull", "wave-reflection", "coast"], recommendedTools: ["generate_beach_scene", "generate_time_of_day_pack", "apply_depth_lighting"], deterministic: true as const },
    { id: "fantasy-quest", title: "Fantasy quest", description: "A character, mount, dragon, weapons and a dungeon-ready scene.", category: "characters", itemIds: ["veteran-knight", "forest-ranger", "dragon-ember", "warhorse", "sword", "dungeon"], recommendedTools: ["create_character_plan", "create_scene_plan", "run_asset_recipe"], deterministic: true as const },
    { id: "rainy-village", title: "Rainy village", description: "Village interiors, church bell, rain and inhabitants.", category: "interiors", itemIds: ["village", "church", "church-bell", "rain", "veteran-merchant", "apprentice-farmer"], recommendedTools: ["generate_environment_pack", "generate_time_of_day_pack", "generate_particle_burst"], deterministic: true as const },
  ];
  const catalog = { schemaVersion: 1 as const, libraryVersion: "asset-library-v1", categories, items, presets };
  await fs.writeFile(path.join(root, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  const inline = (value: string) => "`" + value + "`";
  const categoryLines = categories.map((category) => `- [${category.title}](./${category.id}/): ${category.itemCount} items`).join("\n");
  await fs.writeFile(path.join(root, "README.md"), [`# Asset folders`, "", `Esta biblioteca contiene ${items.length} carpetas deterministas. Cada carpeta incluye README, manifest, preview PNG/SVG y sprite sheet PNG/SVG.`, "", "## Navegación rápida", "", `- Consulta ${inline("catalog.json")} o usa el MCP ${inline("get_asset_library")}.`, `- Resuelve un item con ${inline("get_asset_library_item")}.`, `- Usa presets con ${inline("get_asset_preset")}.`, "- Las variantes de lluvia, fuego, terremoto, pájaros, luz y movimiento se aplican con los algoritmos del MCP.", "", "## Categorías", "", categoryLines, ""].join("\n"), "utf8");
  console.log(JSON.stringify({ root, itemCount: items.length, categoryCount: categories.length, presetCount: presets.length }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
