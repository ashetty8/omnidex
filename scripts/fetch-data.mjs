// One-off snapshot fetch from PokeAPI -> data/pokemon.json
// Run with: node scripts/fetch-data.mjs

const BASE = "https://pokeapi.co/api/v2";
const CONCURRENCY = 8;

async function fetchJson(url, attempt = 1) {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status >= 500 && attempt <= 5) {
      await new Promise((r) => setTimeout(r, attempt * 500));
      return fetchJson(url, attempt + 1);
    }
    throw new Error(`${res.status} ${url}`);
  }
  return res.json();
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

function englishFlavorText(species) {
  const entry = species.flavor_text_entries.find((e) => e.language.name === "en");
  return entry ? entry.flavor_text.replace(/[\n\f­]/g, " ").replace(/\s+/g, " ").trim() : "";
}

function englishGenus(species) {
  const g = species.genera.find((e) => e.language.name === "en");
  return g ? g.genus : "";
}

const FORM_LABELS = {
  mega: "Mega",
  "mega-x": "Mega X",
  "mega-y": "Mega Y",
  "mega-z": "Mega Z",
  gmax: "Gigantamax",
  alola: "Alolan",
  galar: "Galarian",
  hisui: "Hisuian",
  paldea: "Paldean",
};

function buildFormLabel(varietyName, speciesName, isDefault) {
  if (isDefault) return "Base";
  const prefix = `${speciesName}-`;
  const suffix = varietyName.startsWith(prefix)
    ? varietyName.slice(prefix.length)
    : varietyName;
  if (FORM_LABELS[suffix]) return FORM_LABELS[suffix];
  return suffix
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Regional forms, Megas, Gmax etc. were often introduced in a later game than
// their base species (e.g. Hisuian Voltorb is Gen VIII though Voltorb is Gen I,
// Ash-Greninja resolves to Sun/Moon despite Greninja being Gen VI) so the
// species-level generation is not reliable per form. Resolve the real one via
// pokemon-form -> version_group -> generation, caching version_group lookups
// since most forms share a handful of them.
const versionGroupGenCache = new Map();

function getGenerationForVersionGroup(vgUrl) {
  if (!versionGroupGenCache.has(vgUrl)) {
    versionGroupGenCache.set(
      vgUrl,
      fetchJson(vgUrl).then((vg) => vg.generation.name),
    );
  }
  return versionGroupGenCache.get(vgUrl);
}

async function resolveFormGeneration(pokemon, speciesGeneration) {
  const formRef = pokemon.forms && pokemon.forms[0];
  if (!formRef) return speciesGeneration;
  const form = await fetchJson(formRef.url);
  if (!form.version_group) return speciesGeneration;
  return getGenerationForVersionGroup(form.version_group.url);
}

async function buildForm(variety, species) {
  const pokemon = await fetchJson(variety.pokemon.url);
  const generation = await resolveFormGeneration(pokemon, species.generation.name);

  const stats = {};
  for (const s of pokemon.stats) {
    stats[s.stat.name] = s.base_stat;
  }

  return {
    slug: pokemon.name,
    label: buildFormLabel(pokemon.name, species.name, variety.is_default),
    isDefault: variety.is_default,
    generation,
    height: pokemon.height, // decimetres
    weight: pokemon.weight, // hectograms
    types: pokemon.types.map((t) => t.type.name),
    abilities: pokemon.abilities.map((a) => ({
      name: a.ability.name,
      hidden: a.is_hidden,
    })),
    stats: {
      hp: stats.hp ?? 0,
      attack: stats.attack ?? 0,
      defense: stats.defense ?? 0,
      specialAttack: stats["special-attack"] ?? 0,
      specialDefense: stats["special-defense"] ?? 0,
      speed: stats.speed ?? 0,
    },
    sprite:
      pokemon.sprites.other?.["official-artwork"]?.front_default ||
      pokemon.sprites.front_default ||
      "",
    spriteShiny:
      pokemon.sprites.other?.["official-artwork"]?.front_shiny ||
      pokemon.sprites.front_shiny ||
      "",
  };
}

// Evolution stage (1 = doesn't evolve from anything, 2 = first evolution, ...)
// and "fully evolved" (no further evolutions) are derived from the species'
// evolution chain. Many species share the same chain (541 chains for 1025
// species) so cache by chain URL instead of re-walking it per species.
const evolutionChainCache = new Map();

function walkEvolutionChain(node, depth, map) {
  map.set(node.species.name, { stage: depth, fullyEvolved: node.evolves_to.length === 0 });
  node.evolves_to.forEach((child) => walkEvolutionChain(child, depth + 1, map));
}

function resolveEvolutionChain(url) {
  if (!evolutionChainCache.has(url)) {
    evolutionChainCache.set(
      url,
      fetchJson(url).then((data) => {
        const map = new Map();
        walkEvolutionChain(data.chain, 1, map);
        return map;
      }),
    );
  }
  return evolutionChainCache.get(url);
}

async function buildEntry(listItem) {
  const id = Number(listItem.url.split("/").filter(Boolean).pop());
  const species = await fetchJson(`${BASE}/pokemon-species/${id}`);
  const forms = await Promise.all(
    species.varieties.map((v) => buildForm(v, species)),
  );
  const defaultForm = forms.find((f) => f.isDefault) || forms[0];

  const chainMap = await resolveEvolutionChain(species.evolution_chain.url);
  const evoInfo = chainMap.get(species.name) || { stage: 1, fullyEvolved: true };

  return {
    id,
    name: defaultForm.slug,
    height: defaultForm.height,
    weight: defaultForm.weight,
    types: defaultForm.types,
    abilities: defaultForm.abilities,
    stats: defaultForm.stats,
    sprite: defaultForm.sprite,
    spriteShiny: defaultForm.spriteShiny,
    generation: species.generation.name,
    color: species.color?.name || "",
    genus: englishGenus(species),
    flavorText: englishFlavorText(species),
    legendary: species.is_legendary,
    mythical: species.is_mythical,
    evolutionStage: evoInfo.stage,
    fullyEvolved: evoInfo.fullyEvolved,
    forms,
  };
}

async function main() {
  console.log("Fetching pokemon species list...");
  const list = await fetchJson(`${BASE}/pokemon-species?limit=2000`);
  console.log(`Found ${list.results.length} pokemon. Fetching details...`);

  let done = 0;
  const entries = await mapLimit(list.results, CONCURRENCY, async (item) => {
    const entry = await buildEntry(item);
    done++;
    if (done % 100 === 0) console.log(`  ${done}/${list.results.length}`);
    return entry;
  });

  entries.sort((a, b) => a.id - b.id);

  const fs = await import("node:fs/promises");
  await fs.mkdir(new URL("../data", import.meta.url), { recursive: true });
  await fs.writeFile(
    new URL("../data/pokemon.json", import.meta.url),
    JSON.stringify(entries),
  );
  console.log(`Wrote ${entries.length} entries to data/pokemon.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
