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

function englishSpeciesName(species) {
  const n = species.names.find((e) => e.language.name === "en");
  return n ? n.name : species.name;
}

// Short tab/badge labels are generated word-by-word from the variety slug
// (not from PokeAPI's own form_names, which are inconsistently either a
// short qualifier like "Noice Face" or, for unofficial/datamined forms, a
// full duplicate of the display name like "Mega Meganium" - unsuitable for
// a compact tab). Known tokens get a proper adjective form; everything else
// is title-cased, with numeric segments read as percentages (Zygarde's
// "10"/"50" forms) since that's the only place PokeAPI uses bare numbers.
const WORD_LABELS = {
  mega: "Mega",
  gmax: "Gigantamax",
  alola: "Alolan",
  galar: "Galarian",
  hisui: "Hisuian",
  paldea: "Paldean",
  phd: "PhD",
};
const LOWERCASE_WORDS = new Set(["of"]);

function buildFormLabel(varietyName, speciesName) {
  const prefix = `${speciesName}-`;
  const suffix = varietyName.startsWith(prefix)
    ? varietyName.slice(prefix.length)
    : varietyName;
  return suffix
    .split("-")
    .map((w, i) => {
      if (WORD_LABELS[w]) return WORD_LABELS[w];
      if (/^\d+$/.test(w)) return `${w}%`;
      if (i > 0 && LOWERCASE_WORDS.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

// Regional forms, Megas, Gmax etc. were often introduced in a later game than
// their base species (e.g. Hisuian Voltorb is Gen VIII though Voltorb is Gen I,
// Ash-Greninja resolves to Sun/Moon despite Greninja being Gen VI) so the
// species-level generation is not reliable per form. Resolve the real one via
// pokemon-form -> version_group -> generation, caching version_group lookups
// since most forms share a handful of them. The same pokemon-form resource
// also carries PokeAPI's own curated English display name (e.g. "10% Zygarde",
// "Noice Eiscue", "Totem Alolan Raticate") which is far more reliable than
// reconstructing one from the slug, so grab that here too.
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

async function resolveFormMeta(pokemon, speciesGeneration) {
  const formRef = pokemon.forms && pokemon.forms[0];
  if (!formRef) return { generation: speciesGeneration, fullName: null };
  const form = await fetchJson(formRef.url);
  const generation = form.version_group
    ? await getGenerationForVersionGroup(form.version_group.url)
    : speciesGeneration;
  const fullName = form.names.find((n) => n.language.name === "en")?.name || null;
  return { generation, fullName };
}

async function buildForm(variety, species) {
  const pokemon = await fetchJson(variety.pokemon.url);
  const meta = await resolveFormMeta(pokemon, species.generation.name);
  const label = variety.is_default ? "Base" : buildFormLabel(pokemon.name, species.name);

  const stats = {};
  for (const s of pokemon.stats) {
    stats[s.stat.name] = s.base_stat;
  }

  return {
    slug: pokemon.name,
    label,
    // Full display name for non-default forms (e.g. "Noice Eiscue",
    // "10% Zygarde"), straight from PokeAPI's own English translation with
    // a template fallback if one isn't available. Unused for default forms,
    // which always display as the bare species name instead.
    fullName: variety.is_default ? null : meta.fullName || `${label} ${species.name}`,
    isDefault: variety.is_default,
    generation: meta.generation,
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
    // The bare species slug (e.g. "wormadam"), distinct from `name` above
    // which is the *default form's* slug (e.g. "wormadam-plant") for
    // species where the default variety isn't unqualified. Form display
    // names must be built from this, not from `name`, or every other
    // form's label ends up with the default form's own qualifier stuck
    // to it (e.g. "Sandy Wormadam Plant" instead of "Sandy Wormadam").
    speciesName: species.name,
    speciesDisplayName: englishSpeciesName(species),
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
