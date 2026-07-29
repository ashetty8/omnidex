// One-off snapshot fetch from PokeAPI -> data/pokemon.json
// Run with: node scripts/fetch-data.mjs

const BASE = "https://pokeapi.co/api/v2";
const CONCURRENCY = 8;

// PokeAPI's own species.habitat only covers the original 386 species (the
// in-game Pokédex habitat category was dropped after Gen III and never
// reused), leaving every Gen IV+ Pokemon with no habitat data at all. This
// vendored snapshot - species slug -> array of habitat tags, since a species
// can have more than one - comes from pokedle.com's API, which has its own
// hand-curated, full-coverage habitat taxonomy (23 categories, all 1025
// species) built well beyond what any official Pokédex field provides.
const HABITATS = JSON.parse(
  await (
    await import("node:fs/promises")
  ).readFile(new URL("./habitats.json", import.meta.url), "utf8"),
);

// PokeAPI's species.color is a single value, but pokedle.com's guess-comparison
// API (queried per-species via their Infinite mode, since color isn't in their
// bulk list endpoint) shows many species have two - and includes "orange",
// which isn't one of PokeAPI's 10 official color categories at all.
const COLORS = JSON.parse(
  await (
    await import("node:fs/promises")
  ).readFile(new URL("./colors.json", import.meta.url), "utf8"),
);

// COLORS and HABITATS above are keyed by species and applied to every form
// alike, but non-default forms often look and live nothing like their base
// species - Galarian Darumaka is white/blue and found on ice mountains while
// base Darumaka is red/orange and found in deserts; Mega Charizard X is
// black/blue while base Charizard is orange. This form-slug-keyed override
// (also from pokedle.com, using each form's own pseudo dex number - covers
// every regional, Mega, Gigantamax, and other alt-form variant they track)
// replaces the species-level fallback for exactly those forms.
const FORM_OVERRIDES = JSON.parse(
  await (
    await import("node:fs/promises")
  ).readFile(new URL("./form-overrides.json", import.meta.url), "utf8"),
);

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

function titleCase(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const STAT_KEYS = {
  hp: "hp",
  attack: "attack",
  defense: "defense",
  "special-attack": "specialAttack",
  "special-defense": "specialDefense",
  speed: "speed",
};

// Attacking-type -> defending-type damage multiplier, built once from all 18
// battle types (PokeAPI also lists "unknown"/"shadow", which never appear on
// an actual Pokemon's type list and have no complete damage_relations, so
// they're skipped). Each form's matchups are the product across its 1-2
// types, so this table is computed once and reused for all 1025 species
// rather than refetched per Pokemon.
const NON_BATTLE_TYPES = new Set(["unknown", "shadow"]);

async function loadTypeChart() {
  const list = await fetchJson(`${BASE}/type?limit=30`);
  const types = list.results.filter((t) => !NON_BATTLE_TYPES.has(t.name));
  // Keys are pre-inserted in list order before the parallel fetches start,
  // since assigning chart[t.name] inside each async callback would order
  // keys by network resolution instead - nondeterministic run to run, which
  // made every entry's typeEffectiveness reserialize with shuffled keys on
  // every regen even when no values actually changed.
  const chart = {};
  types.forEach((t) => (chart[t.name] = {}));
  await Promise.all(
    types.map(async (t) => {
      const data = await fetchJson(t.url);
      data.damage_relations.double_damage_to.forEach((d) => (chart[t.name][d.name] = 2));
      data.damage_relations.half_damage_to.forEach((d) => (chart[t.name][d.name] = 0.5));
      data.damage_relations.no_damage_to.forEach((d) => (chart[t.name][d.name] = 0));
    }),
  );
  return chart;
}

function computeTypeEffectiveness(types, chart) {
  const result = {};
  for (const attackType of Object.keys(chart)) {
    result[attackType] = types.reduce((mult, defType) => {
      const m = chart[attackType][defType];
      return mult * (m === undefined ? 1 : m);
    }, 1);
  }
  return result;
}

// Ability flavor/effect text lives on the ability resource, not the per-
// Pokemon ability list, and is shared across every Pokemon with that
// ability (367 abilities total vs. ~2.7 per form), so cache by URL.
const abilityEffectCache = new Map();

function getAbilityEffect(url) {
  if (!abilityEffectCache.has(url)) {
    abilityEffectCache.set(
      url,
      fetchJson(url).then((a) => {
        const entry = a.effect_entries.find((e) => e.language.name === "en");
        return entry ? entry.short_effect : "";
      }),
    );
  }
  return abilityEffectCache.get(url);
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

async function buildForm(variety, species, typeChart) {
  const pokemon = await fetchJson(variety.pokemon.url);
  const meta = await resolveFormMeta(pokemon, species.generation.name);
  const label = variety.is_default ? "Base" : buildFormLabel(pokemon.name, species.name);

  const stats = {};
  const evYield = [];
  for (const s of pokemon.stats) {
    stats[s.stat.name] = s.base_stat;
    if (s.effort > 0) {
      evYield.push({ stat: STAT_KEYS[s.stat.name] || s.stat.name, value: s.effort });
    }
  }
  const bst = Object.values(stats).reduce((a, b) => a + b, 0);
  const types = pokemon.types.map((t) => t.type.name);

  const abilities = await Promise.all(
    pokemon.abilities.map(async (a) => ({
      name: a.ability.name,
      hidden: a.is_hidden,
      effect: await getAbilityEffect(a.ability.url),
    })),
  );

  // Minior's 14 forms (7 meteor-shelled, 7 core) aren't in pokedle's tracked
  // taxonomy, but each one's whole gimmick is its color and that color is
  // spelled right out in the slug (minior-red, minior-blue-meteor, ...), so
  // it's cheaper and more reliable to parse it than to leave it inheriting
  // the species-level fallback (which only ever describes the brown shell).
  const MINIOR_COLOR = /^minior-(red|orange|yellow|green|blue|indigo|violet)(-meteor)?$/;
  const miniorMatch = MINIOR_COLOR.exec(pokemon.name);

  const override = FORM_OVERRIDES[pokemon.name];
  const colors = override
    ? override.colors
    : miniorMatch
      ? [miniorMatch[1]]
      : COLORS[species.name] || (species.color?.name ? [species.color.name] : []);
  const habitats = override ? override.habitats : HABITATS[species.name] || [];

  return {
    slug: pokemon.name,
    label,
    // Full display name for non-default forms (e.g. "Noice Eiscue",
    // "10% Zygarde"), straight from PokeAPI's own English translation with
    // a template fallback if one isn't available. Unused for default forms,
    // which always display as the bare species name instead.
    fullName: variety.is_default ? null : meta.fullName || `${label} ${englishSpeciesName(species)}`,
    isDefault: variety.is_default,
    generation: meta.generation,
    height: pokemon.height, // decimetres
    weight: pokemon.weight, // hectograms
    types,
    abilities,
    stats: {
      hp: stats.hp ?? 0,
      attack: stats.attack ?? 0,
      defense: stats.defense ?? 0,
      specialAttack: stats["special-attack"] ?? 0,
      specialDefense: stats["special-defense"] ?? 0,
      speed: stats.speed ?? 0,
    },
    bst,
    evYield,
    baseExperience: pokemon.base_experience ?? null,
    typeEffectiveness: computeTypeEffectiveness(types, typeChart),
    colors,
    habitats,
    cry: pokemon.cries?.latest || pokemon.cries?.legacy || null,
    sprite:
      pokemon.sprites.other?.["official-artwork"]?.front_default ||
      pokemon.sprites.front_default ||
      "",
    spriteShiny:
      pokemon.sprites.other?.["official-artwork"]?.front_shiny ||
      pokemon.sprites.front_shiny ||
      "",
    spriteDreamWorld: pokemon.sprites.other?.dream_world?.front_default || null,
  };
}

// Evolution stage (1 = doesn't evolve from anything, 2 = first evolution, ...)
// and "fully evolved" (no further evolutions) are derived from the species'
// evolution chain. Many species share the same chain (541 chains for 1025
// species) so cache by chain URL instead of re-walking it per species.
const evolutionChainCache = new Map();

// evolution_details describes how to reach a *child* node from its parent,
// as a list of alternative (OR'd) conditions - e.g. Eevee's evolutions each
// have one, but some Pokemon (e.g. Tyrogue) have several ways to reach the
// same evolution. Rendered as short human-readable strings rather than kept
// as raw PokeAPI fields since those are ~15 sparse, inconsistently-shaped
// keys per condition.
function describeEvolutionDetail(d) {
  const parts = [];
  if (d.min_level) parts.push(`Level ${d.min_level}`);
  if (d.item) parts.push(`use ${titleCase(d.item.name)}`);
  if (d.held_item) parts.push(`holding ${titleCase(d.held_item.name)}`);
  if (d.known_move) parts.push(`knowing ${titleCase(d.known_move.name)}`);
  if (d.known_move_type) parts.push(`knowing a ${titleCase(d.known_move_type.name)}-type move`);
  if (d.min_happiness) parts.push(`happiness ${d.min_happiness}+`);
  if (d.min_affection) parts.push(`affection ${d.min_affection}+`);
  if (d.min_beauty) parts.push(`beauty ${d.min_beauty}+`);
  if (d.relative_physical_stats === 1) parts.push("Attack > Defense");
  if (d.relative_physical_stats === -1) parts.push("Defense > Attack");
  if (d.relative_physical_stats === 0) parts.push("Attack = Defense");
  if (d.time_of_day) parts.push(`during ${d.time_of_day}`);
  if (d.location) parts.push(`at ${titleCase(d.location.name)}`);
  if (d.needs_overworld_rain) parts.push("while raining");
  if (d.turn_upside_down) parts.push("console upside down");
  if (d.party_species) parts.push(`with ${titleCase(d.party_species.name)} in party`);
  if (d.party_type) parts.push(`with a ${titleCase(d.party_type.name)}-type in party`);
  if (d.trade_species) parts.push(`traded for ${titleCase(d.trade_species.name)}`);
  if (d.gender === 1) parts.push("(female)");
  if (d.gender === 2) parts.push("(male)");

  if (parts.length === 0 && d.trigger) {
    parts.push(titleCase(d.trigger.name.replace(/-/g, " ")));
  }
  const trigger = d.trigger?.name;
  if (trigger === "trade" && !parts.some((p) => p.toLowerCase().includes("trad"))) {
    parts.unshift("Trade");
  } else if (trigger === "level-up" && !d.min_level && parts.length && !parts[0].startsWith("Level")) {
    parts.unshift("Level up");
  }
  return parts.join(", ");
}

function walkEvolutionChain(node, depth, map, parentName) {
  map.set(node.species.name, {
    stage: depth,
    fullyEvolved: node.evolves_to.length === 0,
    evolvesFrom: parentName,
    evolutionMethods: [],
  });
  node.evolves_to.forEach((child) => {
    walkEvolutionChain(child, depth + 1, map, node.species.name);
    map.get(child.species.name).evolutionMethods = child.evolution_details.map(describeEvolutionDetail);
  });
}

function resolveEvolutionChain(url) {
  if (!evolutionChainCache.has(url)) {
    evolutionChainCache.set(
      url,
      fetchJson(url).then((data) => {
        const map = new Map();
        walkEvolutionChain(data.chain, 1, map, null);
        return map;
      }),
    );
  }
  return evolutionChainCache.get(url);
}

async function buildEntry(listItem, typeChart) {
  const id = Number(listItem.url.split("/").filter(Boolean).pop());
  const species = await fetchJson(`${BASE}/pokemon-species/${id}`);
  const forms = await Promise.all(
    species.varieties.map((v) => buildForm(v, species, typeChart)),
  );
  const defaultForm = forms.find((f) => f.isDefault) || forms[0];

  // A handful of forms (Koraidon/Miraidon's battle "build"/"mode" variants)
  // have no sprite of their own anywhere in PokeAPI - official-artwork,
  // front_default, and home are all null, unlike Totem forms which at least
  // alias to their base form's sprite ID. Falling back to the species'
  // default-form sprite avoids a broken image rather than leaving "".
  for (const form of forms) {
    if (!form.sprite) form.sprite = defaultForm.sprite;
    if (!form.spriteShiny) form.spriteShiny = defaultForm.spriteShiny;
  }

  const chainMap = await resolveEvolutionChain(species.evolution_chain.url);
  const evoInfo = chainMap.get(species.name) || {
    stage: 1,
    fullyEvolved: true,
    evolvesFrom: null,
    evolutionMethods: [],
  };

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
    bst: defaultForm.bst,
    evYield: defaultForm.evYield,
    baseExperience: defaultForm.baseExperience,
    typeEffectiveness: defaultForm.typeEffectiveness,
    cry: defaultForm.cry,
    sprite: defaultForm.sprite,
    spriteShiny: defaultForm.spriteShiny,
    spriteDreamWorld: defaultForm.spriteDreamWorld,
    generation: species.generation.name,
    colors: defaultForm.colors,
    genus: englishGenus(species),
    flavorText: englishFlavorText(species),
    legendary: species.is_legendary,
    mythical: species.is_mythical,
    evolutionStage: evoInfo.stage,
    fullyEvolved: evoInfo.fullyEvolved,
    evolvesFrom: evoInfo.evolvesFrom,
    evolutionMethods: evoInfo.evolutionMethods,
    // Breeding & training facets, all straight off pokemon-species.
    captureRate: species.capture_rate,
    baseHappiness: species.base_happiness,
    growthRate: species.growth_rate?.name || "",
    eggGroups: species.egg_groups.map((g) => g.name),
    // Eighths female (0-8); -1 means genderless.
    genderRate: species.gender_rate,
    hatchCounter: species.hatch_counter,
    habitats: defaultForm.habitats,
    shape: species.shape?.name || null,
    forms,
  };
}

async function main() {
  console.log("Fetching type chart...");
  const typeChart = await loadTypeChart();

  console.log("Fetching pokemon species list...");
  const list = await fetchJson(`${BASE}/pokemon-species?limit=2000`);
  console.log(`Found ${list.results.length} pokemon. Fetching details...`);

  let done = 0;
  const entries = await mapLimit(list.results, CONCURRENCY, async (item) => {
    const entry = await buildEntry(item, typeChart);
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
