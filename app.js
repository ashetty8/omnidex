(() => {
  const GEN_LABELS = {
    "generation-i": "Gen I",
    "generation-ii": "Gen II",
    "generation-iii": "Gen III",
    "generation-iv": "Gen IV",
    "generation-v": "Gen V",
    "generation-vi": "Gen VI",
    "generation-vii": "Gen VII",
    "generation-viii": "Gen VIII",
    "generation-ix": "Gen IX",
  };
  const GEN_ORDER = Object.keys(GEN_LABELS);

  // Habitat diorama icons matching pokedle.com's 22-category habitat
  // taxonomy (see scripts/habitats.json), extracted from their Pokédex
  // filter dropdown and bundled locally in assets/habitat-icons/.
  const HABITAT_ICON_URLS = {
    areazero: "assets/habitat-icons/areazero.png",
    beach: "assets/habitat-icons/beach.png",
    cave: "assets/habitat-icons/cave.png",
    city: "assets/habitat-icons/city.png",
    desertbadlands: "assets/habitat-icons/desertbadlands.png",
    forest: "assets/habitat-icons/forest.png",
    freshwater: "assets/habitat-icons/freshwater.png",
    grassland: "assets/habitat-icons/grassland.png",
    ice: "assets/habitat-icons/ice.png",
    industrial: "assets/habitat-icons/industrial.png",
    island: "assets/habitat-icons/island.png",
    jungle: "assets/habitat-icons/jungle.png",
    mountain: "assets/habitat-icons/mountain.png",
    ocean: "assets/habitat-icons/ocean.png",
    polarsea: "assets/habitat-icons/polarsea.png",
    ruin: "assets/habitat-icons/ruin.png",
    sky: "assets/habitat-icons/sky.png",
    swamp: "assets/habitat-icons/swamp.png",
    tropicalSea: "assets/habitat-icons/tropicalsea.png",
    ultraspace: "assets/habitat-icons/ultraspace.png",
    unknown: "assets/habitat-icons/unknown.png",
    volcano: "assets/habitat-icons/volcano.png",
  };

  const HABITAT_LABELS = {
    areazero: "Area Zero",
    beach: "Beach",
    cave: "Cave",
    city: "City",
    desertbadlands: "Desert/Badlands",
    forest: "Forest",
    freshwater: "Freshwater",
    grassland: "Grassland",
    ice: "Ice",
    industrial: "Industrial",
    island: "Island",
    jungle: "Jungle",
    mountain: "Mountain",
    ocean: "Ocean",
    polarsea: "Polar Sea",
    ruin: "Ruins",
    sky: "Sky",
    swamp: "Swamp",
    tropicalSea: "Tropical Sea",
    ultraspace: "Ultra Space",
    unknown: "Unknown",
    volcano: "Volcano",
  };

  const grid = document.getElementById("grid");
  const searchInput = document.getElementById("search");
  const filtersBtn = document.getElementById("filters-btn");
  const filtersOverlay = document.getElementById("filters-overlay");
  const filtersClose = document.getElementById("filters-close");
  const activeChips = document.getElementById("active-chips");
  const typeOptions = document.getElementById("type-options");
  const typeClearBtn = document.getElementById("type-clear-btn");
  const typeCountToggle = document.getElementById("type-count-toggle");
  const genOptions = document.getElementById("gen-options");
  const genClearBtn = document.getElementById("gen-clear-btn");
  const stageOptions = document.getElementById("stage-options");
  const stageClearBtn = document.getElementById("stage-clear-btn");
  const eggOptions = document.getElementById("egg-options");
  const eggClearBtn = document.getElementById("egg-clear-btn");
  const habitatOptions = document.getElementById("habitat-options");
  const habitatClearBtn = document.getElementById("habitat-clear-btn");
  const colorOptions = document.getElementById("color-options");
  const colorClearBtn = document.getElementById("color-clear-btn");
  const abilityOptions = document.getElementById("ability-options");
  const abilitySearch = document.getElementById("ability-search");
  const abilityClearBtn = document.getElementById("ability-clear-btn");
  const moveOptions = document.getElementById("move-options");
  const moveSearch = document.getElementById("move-search");
  const moveClearBtn = document.getElementById("move-clear-btn");
  const shapeOptions = document.getElementById("shape-options");
  const shapeClearBtn = document.getElementById("shape-clear-btn");
  const growthOptions = document.getElementById("growth-options");
  const growthClearBtn = document.getElementById("growth-clear-btn");
  const bstMinInput = document.getElementById("bst-min");
  const bstMaxInput = document.getElementById("bst-max");
  const genderlessToggle = document.getElementById("genderless-toggle");
  const fullyEvolvedToggle = document.getElementById("fully-evolved-toggle");
  const legendaryToggle = document.getElementById("legendary-toggle");
  const clearAllBtn = document.getElementById("clear-all-btn");
  const sortSelect = document.getElementById("sort-select");
  const resultCount = document.getElementById("result-count");
  const emptyState = document.getElementById("empty-state");
  const modalOverlay = document.getElementById("modal-overlay");
  const modalEl = document.querySelector(".modal");
  const modalContent = document.getElementById("modal-content");
  const modalClose = document.getElementById("modal-close");

  let allPokemon = [];
  let flatEntries = [];
  let filtered = [];
  let currentSpecies = null;
  let currentFormSlug = null;
  let selectedTypes = new Set();
  let excludedTypes = new Set();
  let typeMode = "any"; // "any" (OR) or "all" (AND), applies to selectedTypes only
  let typeCountFilter = "any"; // "any" | "single" (monotype only) | "multi" (dual-type only) - independent of selectedTypes
  let selectedGens = new Set(); // OR: matches if the Pokémon's (single) generation is selected
  let excludedGens = new Set();
  let selectedStages = new Set(); // OR: matches if the Pokémon's (single) evolution stage is selected
  let excludedStages = new Set();
  let selectedEggGroups = new Set(); // OR: matches if the species has any selected group
  let selectedHabitats = new Set(); // OR: matches if the species has any selected habitat
  let excludedHabitats = new Set();
  let selectedColors = new Set(); // OR: matches if the species has any selected color
  let excludedColors = new Set();
  let colorMode = "any"; // "any" (OR) or "only" (exact-set match), applies to selectedColors only
  let selectedAbilities = new Set(); // OR: matches if the form has any selected ability
  let selectedMoves = new Set(); // OR: matches if the form learns any selected move
  let selectedShapes = new Set(); // OR: matches if the species has this body shape
  let selectedGrowthRates = new Set(); // OR: matches if the species has this growth rate
  let bstMin = null; // number | null
  let bstMax = null; // number | null
  let genderlessFilter = "any"; // "any" | "only" (genderless) | "exclude" (hide genderless)
  let fullyEvolvedFilter = "any"; // "any" | "only" (fully evolved) | "exclude" (hide fully evolved)
  let legendaryFilter = "any"; // "any" | "only" (legendary or mythical) | "exclude"
  let evolvesIntoMap = new Map(); // parent speciesName -> [{ id, name, sprite, methods }]
  let formIndex = new Map(); // form slug -> speciesId, so a URL hash can address any individual form directly

  function dexNumber(id) {
    return `#${String(id).padStart(3, "0")}`;
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function typeBadge(type) {
    return `<span class="type-badge" style="background:var(--type-${type})">${type}</span>`;
  }

  function clickableTypeBadge(type) {
    return `<button type="button" class="type-badge attr-click" data-filter-type="type" data-filter-value="${type}" style="background:var(--type-${type})">${type}</button>`;
  }

  // Tints the whole modal (header glow, sprite shadow, active tab, stat
  // bars, section-title accents, move-row hover) to the currently shown
  // form's primary type, so it reads as "this Pokemon's page" rather than a
  // generic panel with a fixed accent color.
  function setModalAccent(form) {
    modalEl.style.setProperty("--modal-accent", `var(--type-${form.types[0]})`);
  }

  function formDisplayName(speciesDisplayName, form) {
    // Default forms always show as the bare species name (e.g. "Eiscue", not
    // "Ice Eiscue") so the unfiltered grid stays clean; non-default forms use
    // PokeAPI's own curated full name (e.g. "Noice Eiscue", "10% Zygarde").
    return form.isDefault ? speciesDisplayName : form.fullName;
  }

  function buildFlatEntries() {
    const entries = [];
    for (const species of allPokemon) {
      const speciesDisplayName = species.speciesDisplayName;
      for (const form of species.forms) {
        entries.push({
          speciesId: species.id,
          formSlug: form.slug,
          isDefault: form.isDefault,
          label: form.label,
          name: formDisplayName(speciesDisplayName, form),
          types: form.types,
          sprite: form.sprite,
          generation: form.generation,
          evolutionStage: species.evolutionStage,
          fullyEvolved: species.fullyEvolved,
          dexNumber: species.id,
          bst: form.bst,
          eggGroups: species.eggGroups,
          habitats: form.habitats,
          colors: form.colors,
          abilities: form.abilities.map((a) => a.name),
          moves: [...new Set((form.moves || []).map((m) => m.name))],
          shape: species.shape,
          growthRate: species.growthRate,
          legendary: species.legendary,
          mythical: species.mythical,
          genderRate: species.genderRate,
        });
      }
    }
    return entries;
  }

  function buildEvolvesIntoMap() {
    const map = new Map();
    for (const species of allPokemon) {
      if (!species.evolvesFrom) continue;
      if (!map.has(species.evolvesFrom)) map.set(species.evolvesFrom, []);
      map.get(species.evolvesFrom).push({
        id: species.id,
        name: species.speciesDisplayName,
        sprite: species.sprite,
        methods: species.evolutionMethods,
      });
    }
    return map;
  }

  function buildFormIndex() {
    const map = new Map();
    for (const species of allPokemon) {
      for (const form of species.forms) map.set(form.slug, species.id);
    }
    return map;
  }

  function cardHtml(e) {
    return `
      <div class="card" data-species="${e.speciesId}" data-form="${e.formSlug}">
        <span class="dex-number">${dexNumber(e.dexNumber)}</span>
        ${!e.isDefault ? `<span class="form-badge">${e.label}</span>` : ""}
        <img loading="lazy" src="${e.sprite}" alt="${e.name}" />
        <div class="name">${e.name}</div>
        <div class="types">${e.types.map(typeBadge).join("")}</div>
      </div>`;
  }

  // Non-default forms (Mega, Gigantamax, regional variants, ...) often carry
  // a later generation than their species (Mega Venusaur is Gen VI though
  // Venusaur is Gen I). Sorting straight by dex number would interleave them
  // right after their base species, fragmenting a form's true generation
  // into a one-off block of its own. Instead each generation's block holds
  // its base/default entries in dex order, with any variant forms actually
  // belonging to that generation appended at the end of the same block -
  // dex order is preserved within both parts since Array#sort is stable.
  function groupByGeneration(entries, desc) {
    const gens = desc ? [...GEN_ORDER].reverse() : GEN_ORDER;
    const buckets = new Map(gens.map((g) => [g, { base: [], forms: [] }]));
    for (const e of entries) {
      const bucket = buckets.get(e.generation);
      if (!bucket) continue;
      (e.isDefault ? bucket.base : bucket.forms).push(e);
    }
    const ordered = [];
    for (const g of gens) {
      const bucket = buckets.get(g);
      ordered.push(...bucket.base, ...bucket.forms);
    }
    return ordered;
  }

  function renderGrid() {
    // Generation separators only make sense when the grid is actually grouped
    // by generation, which is only guaranteed when sorted by dex number -
    // name/BST sorts interleave generations, where a separator per row would
    // just be noise.
    const showGenSeparators = sortSelect.value.startsWith("id-");
    const ordered = showGenSeparators
      ? groupByGeneration(filtered, sortSelect.value.endsWith("desc"))
      : filtered;

    let lastGen = null;
    const parts = [];
    for (const e of ordered) {
      if (showGenSeparators && e.generation !== lastGen) {
        lastGen = e.generation;
        parts.push(
          `<div class="gen-separator"><span>${GEN_LABELS[e.generation] || e.generation}</span></div>`,
        );
      }
      parts.push(cardHtml(e));
    }
    grid.innerHTML = parts.join("");

    const totalSpecies = allPokemon.length;
    resultCount.textContent = hasActiveFilters()
      ? `${filtered.length} result${filtered.length === 1 ? "" : "s"}`
      : `${filtered.length} of ${totalSpecies} Pokémon`;
    emptyState.classList.toggle("hidden", filtered.length !== 0);
  }

  // Typing a Pokémon's exact name into search resolves it to the negation of
  // its own attributes (types, generation, fully-evolved state, habitat)
  // instead of leaving it as a plain text query - e.g. "scolipede" excludes
  // Bug, Poison, Gen V, fully-evolved, and Forest, surfacing Pokémon unlike it.
  function findExactPokemonMatch(query) {
    const q = query.toLowerCase();
    const nameMatches = flatEntries.filter((e) => e.name.toLowerCase() === q);
    if (nameMatches.length) return nameMatches.find((e) => e.isDefault) || nameMatches[0];

    const idQuery = q.replace(/^#/, "");
    if (idQuery && String(Number(idQuery)) === idQuery) {
      const idMatches = flatEntries.filter((e) => String(e.dexNumber) === idQuery);
      if (idMatches.length) return idMatches.find((e) => e.isDefault) || idMatches[0];
    }
    return null;
  }

  function applyPokemonSearchFilters(entry) {
    excludedTypes = new Set(entry.types);
    selectedTypes.clear();
    typeMode = "any";
    typeCountFilter = "any";
    excludedGens = new Set([entry.generation]);
    selectedGens.clear();
    excludedStages = new Set([entry.evolutionStage]);
    selectedStages.clear();
    fullyEvolvedFilter = entry.fullyEvolved ? "exclude" : "only";
    excludedHabitats = new Set(entry.habitats);
    selectedHabitats.clear();
    excludedColors = new Set(entry.colors);
    selectedColors.clear();
    colorMode = "any";
    searchInput.value = "";

    document.querySelectorAll(".mode-btn[data-mode]").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === typeMode);
    });
    document.querySelectorAll(".mode-btn[data-color-mode]").forEach((b) => {
      b.classList.toggle("active", b.dataset.colorMode === colorMode);
    });
    renderTypeOptionStates();
    updateTypeCountToggle();
    renderGenOptionStates();
    renderStageOptionStates();
    updateFullyEvolvedToggle();
    renderHabitatOptionStates();
    renderColorOptionStates();
    renderActiveChips();

    applyFilters();
  }

  function handleSearchInput() {
    const q = searchInput.value.trim();
    if (q) {
      const match = findExactPokemonMatch(q);
      if (match) {
        applyPokemonSearchFilters(match);
        return;
      }
    }
    applyFilters();
  }

  function hasActiveFilters() {
    return (
      searchInput.value.trim() !== "" ||
      selectedTypes.size > 0 ||
      excludedTypes.size > 0 ||
      typeCountFilter !== "any" ||
      selectedGens.size > 0 ||
      excludedGens.size > 0 ||
      selectedStages.size > 0 ||
      excludedStages.size > 0 ||
      selectedEggGroups.size > 0 ||
      selectedHabitats.size > 0 ||
      excludedHabitats.size > 0 ||
      selectedColors.size > 0 ||
      excludedColors.size > 0 ||
      selectedAbilities.size > 0 ||
      selectedMoves.size > 0 ||
      selectedShapes.size > 0 ||
      selectedGrowthRates.size > 0 ||
      bstMin !== null ||
      bstMax !== null ||
      genderlessFilter !== "any" ||
      fullyEvolvedFilter !== "any" ||
      legendaryFilter !== "any"
    );
  }

  function matchesGen(generation) {
    if (excludedGens.has(generation)) return false;
    if (selectedGens.size === 0) return true;
    return selectedGens.has(generation);
  }

  function matchesStage(stage) {
    if (excludedStages.has(stage)) return false;
    if (selectedStages.size === 0) return true;
    return selectedStages.has(stage);
  }

  function matchesHabitat(habitats) {
    if (excludedHabitats.size > 0 && habitats.some((h) => excludedHabitats.has(h))) return false;
    if (selectedHabitats.size === 0) return true;
    return habitats.some((h) => selectedHabitats.has(h));
  }

  function matchesColor(colors) {
    if (excludedColors.size > 0 && colors.some((c) => excludedColors.has(c))) return false;
    if (selectedColors.size === 0) return true;
    if (colorMode === "only") {
      // Exact match: the Pokémon's whole color list must be the selected set,
      // no extra colors - mirrors typeMode "mono".
      return (
        colors.length === selectedColors.size &&
        [...selectedColors].every((c) => colors.includes(c))
      );
    }
    return colors.some((c) => selectedColors.has(c));
  }

  function matchesSelectedTypes(entryTypes) {
    if (excludedTypes.size > 0 && [...excludedTypes].some((t) => entryTypes.includes(t))) {
      return false;
    }
    if (selectedTypes.size === 0) return true;
    if (typeMode === "all") {
      return [...selectedTypes].every((t) => entryTypes.includes(t));
    }
    if (typeMode === "mono") {
      // Exact match: the Pokémon's whole type list must be the selected set,
      // no extra types - e.g. selecting just Fire only matches pure-Fire
      // Pokémon, not Fire/Flying ones too.
      return (
        entryTypes.length === selectedTypes.size &&
        [...selectedTypes].every((t) => entryTypes.includes(t))
      );
    }
    return [...selectedTypes].some((t) => entryTypes.includes(t));
  }

  function matchesTypeCount(entryTypes) {
    if (typeCountFilter === "single") return entryTypes.length === 1;
    if (typeCountFilter === "multi") return entryTypes.length > 1;
    return true;
  }

  function matchesAbility(abilities) {
    if (selectedAbilities.size === 0) return true;
    return abilities.some((a) => selectedAbilities.has(a));
  }

  function matchesMoves(moves) {
    if (selectedMoves.size === 0) return true;
    return moves.some((m) => selectedMoves.has(m));
  }

  function matchesShape(shape) {
    if (selectedShapes.size === 0) return true;
    return !!shape && selectedShapes.has(shape);
  }

  function matchesGrowthRate(growthRate) {
    if (selectedGrowthRates.size === 0) return true;
    return !!growthRate && selectedGrowthRates.has(growthRate);
  }

  function matchesBst(bst) {
    if (bstMin !== null && bst < bstMin) return false;
    if (bstMax !== null && bst > bstMax) return false;
    return true;
  }

  function matchesGenderless(genderRate) {
    if (genderlessFilter === "only") return genderRate === -1;
    if (genderlessFilter === "exclude") return genderRate !== -1;
    return true;
  }

  function matchesLegendary(legendary, mythical) {
    const isSpecial = legendary || mythical;
    if (legendaryFilter === "only") return isSpecial;
    if (legendaryFilter === "exclude") return !isSpecial;
    return true;
  }

  function applyFilters() {
    const q = searchInput.value.trim().toLowerCase();
    const active = hasActiveFilters();

    filtered = flatEntries.filter((e) => {
      if (!active) return e.isDefault;
      if (!matchesSelectedTypes(e.types)) return false;
      if (!matchesTypeCount(e.types)) return false;
      if (!matchesGen(e.generation)) return false;
      if (!matchesStage(e.evolutionStage)) return false;
      if (selectedEggGroups.size > 0 && !e.eggGroups.some((g) => selectedEggGroups.has(g))) return false;
      if (!matchesHabitat(e.habitats)) return false;
      if (!matchesColor(e.colors)) return false;
      if (!matchesAbility(e.abilities)) return false;
      if (!matchesMoves(e.moves)) return false;
      if (!matchesShape(e.shape)) return false;
      if (!matchesGrowthRate(e.growthRate)) return false;
      if (!matchesBst(e.bst)) return false;
      if (!matchesGenderless(e.genderRate)) return false;
      if (!matchesLegendary(e.legendary, e.mythical)) return false;
      if (fullyEvolvedFilter === "only" && !e.fullyEvolved) return false;
      if (fullyEvolvedFilter === "exclude" && e.fullyEvolved) return false;
      if (q) {
        const matchesName = e.name.toLowerCase().includes(q);
        const matchesId = String(e.dexNumber) === q.replace(/^#/, "");
        if (!matchesName && !matchesId) return false;
      }
      return true;
    });

    const [key, dir] = sortSelect.value.split("-");
    filtered.sort((a, b) => {
      let cmp;
      if (key === "id") {
        cmp = a.dexNumber - b.dexNumber;
        if (cmp === 0) cmp = a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1;
      } else if (key === "bst") {
        cmp = a.bst - b.bst;
      } else {
        cmp = a.name.localeCompare(b.name);
      }
      return dir === "desc" ? -cmp : cmp;
    });

    renderGrid();
  }

  function populateFilterOptions() {
    const types = new Set();
    const gens = new Set();
    const stages = new Set();
    const eggGroups = new Set();
    const habitats = new Set();
    const colors = new Set();
    const abilities = new Set();
    const moves = new Set();
    const shapes = new Set();
    const growthRates = new Set();
    flatEntries.forEach((e) => {
      e.types.forEach((t) => types.add(t));
      gens.add(e.generation);
      stages.add(e.evolutionStage);
      e.eggGroups.forEach((g) => eggGroups.add(g));
      e.habitats.forEach((h) => habitats.add(h));
      e.colors.forEach((c) => colors.add(c));
      e.abilities.forEach((a) => abilities.add(a));
      e.moves.forEach((m) => moves.add(m));
      if (e.shape) shapes.add(e.shape);
      if (e.growthRate) growthRates.add(e.growthRate);
    });

    typeOptions.innerHTML = [...types]
      .sort()
      .map(
        (t) =>
          `<button class="type-option" data-type="${t}" type="button" style="--type-color:var(--type-${t})">${t}</button>`,
      )
      .join("");

    genOptions.innerHTML = [...gens]
      .sort((a, b) => GEN_ORDER.indexOf(a) - GEN_ORDER.indexOf(b))
      .map(
        (g) =>
          `<button class="gen-option" data-gen="${g}" type="button">${GEN_LABELS[g] || g}</button>`,
      )
      .join("");

    stageOptions.innerHTML = [...stages]
      .sort((a, b) => a - b)
      .map((s) => `<button class="gen-option" data-stage="${s}" type="button">Stage ${s}</button>`)
      .join("");

    eggOptions.innerHTML = [...eggGroups]
      .sort()
      .map(
        (g) =>
          `<button class="gen-option" data-egg="${g}" type="button">${capitalize(g)}</button>`,
      )
      .join("");

    habitatOptions.innerHTML = [...habitats]
      .sort((a, b) => (HABITAT_LABELS[a] || a).localeCompare(HABITAT_LABELS[b] || b))
      .map((h) => {
        const icon = HABITAT_ICON_URLS[h]
          ? `<img class="habitat-icon" src="${HABITAT_ICON_URLS[h]}" alt="" />`
          : "";
        return `<button class="gen-option" data-habitat="${h}" type="button">${icon}${HABITAT_LABELS[h] || capitalize(h)}</button>`;
      })
      .join("");

    colorOptions.innerHTML = [...colors]
      .sort()
      .map(
        (c) =>
          `<button class="gen-option" data-color="${c}" type="button"><span class="color-swatch" style="background:var(--color-${c})"></span>${capitalize(c)}</button>`,
      )
      .join("");

    abilityOptions.innerHTML = [...abilities]
      .sort()
      .map((a) => `<button class="gen-option" data-ability="${a}" type="button">${titleCase(a)}</button>`)
      .join("");

    moveOptions.innerHTML = [...moves]
      .sort()
      .map((m) => `<button class="gen-option" data-move="${m}" type="button">${titleCase(m)}</button>`)
      .join("");

    shapeOptions.innerHTML = [...shapes]
      .sort()
      .map((s) => `<button class="gen-option" data-shape="${s}" type="button">${titleCase(s)}</button>`)
      .join("");

    growthOptions.innerHTML = [...growthRates]
      .sort()
      .map((g) => `<button class="gen-option" data-growth="${g}" type="button">${titleCase(g)}</button>`)
      .join("");
  }

  function capitalize(t) {
    return t[0].toUpperCase() + t.slice(1);
  }

  function renderTypeOptionStates() {
    typeOptions.querySelectorAll(".type-option").forEach((btn) => {
      const type = btn.dataset.type;
      btn.classList.toggle("selected", selectedTypes.has(type));
      btn.classList.toggle("excluded", excludedTypes.has(type));
    });
  }

  function updateTypeCountToggle() {
    typeCountToggle.classList.toggle("active", typeCountFilter === "single");
    typeCountToggle.classList.toggle("excluded", typeCountFilter === "multi");
    typeCountToggle.setAttribute("aria-pressed", String(typeCountFilter !== "any"));
    typeCountToggle.textContent =
      typeCountFilter === "single" ? "Monotype only" : typeCountFilter === "multi" ? "Dual-type only" : "Any type count";
  }

  function renderGenOptionStates() {
    genOptions.querySelectorAll(".gen-option").forEach((btn) => {
      btn.classList.toggle("selected", selectedGens.has(btn.dataset.gen));
      btn.classList.toggle("excluded", excludedGens.has(btn.dataset.gen));
    });
  }

  function renderStageOptionStates() {
    stageOptions.querySelectorAll(".gen-option").forEach((btn) => {
      const stage = Number(btn.dataset.stage);
      btn.classList.toggle("selected", selectedStages.has(stage));
      btn.classList.toggle("excluded", excludedStages.has(stage));
    });
  }

  function renderEggOptionStates() {
    eggOptions.querySelectorAll(".gen-option").forEach((btn) => {
      btn.classList.toggle("selected", selectedEggGroups.has(btn.dataset.egg));
    });
  }

  function renderHabitatOptionStates() {
    habitatOptions.querySelectorAll(".gen-option").forEach((btn) => {
      btn.classList.toggle("selected", selectedHabitats.has(btn.dataset.habitat));
      btn.classList.toggle("excluded", excludedHabitats.has(btn.dataset.habitat));
    });
  }

  function renderColorOptionStates() {
    colorOptions.querySelectorAll(".gen-option").forEach((btn) => {
      btn.classList.toggle("selected", selectedColors.has(btn.dataset.color));
      btn.classList.toggle("excluded", excludedColors.has(btn.dataset.color));
    });
  }

  function renderAbilityOptionStates() {
    abilityOptions.querySelectorAll(".gen-option").forEach((btn) => {
      btn.classList.toggle("selected", selectedAbilities.has(btn.dataset.ability));
    });
  }

  function renderMoveOptionStates() {
    moveOptions.querySelectorAll(".gen-option").forEach((btn) => {
      btn.classList.toggle("selected", selectedMoves.has(btn.dataset.move));
    });
  }

  function renderShapeOptionStates() {
    shapeOptions.querySelectorAll(".gen-option").forEach((btn) => {
      btn.classList.toggle("selected", selectedShapes.has(btn.dataset.shape));
    });
  }

  function renderGrowthOptionStates() {
    growthOptions.querySelectorAll(".gen-option").forEach((btn) => {
      btn.classList.toggle("selected", selectedGrowthRates.has(btn.dataset.growth));
    });
  }

  function updateFullyEvolvedToggle() {
    fullyEvolvedToggle.classList.toggle("active", fullyEvolvedFilter === "only");
    fullyEvolvedToggle.classList.toggle("excluded", fullyEvolvedFilter === "exclude");
    fullyEvolvedToggle.setAttribute("aria-pressed", String(fullyEvolvedFilter !== "any"));
    fullyEvolvedToggle.textContent =
      fullyEvolvedFilter === "exclude" ? "Hide fully evolved" : "Fully evolved only";
  }

  function updateGenderlessToggle() {
    genderlessToggle.classList.toggle("active", genderlessFilter === "only");
    genderlessToggle.classList.toggle("excluded", genderlessFilter === "exclude");
    genderlessToggle.setAttribute("aria-pressed", String(genderlessFilter !== "any"));
    genderlessToggle.textContent =
      genderlessFilter === "only" ? "Genderless only" : genderlessFilter === "exclude" ? "Exclude genderless" : "Any gender";
  }

  function updateLegendaryToggle() {
    legendaryToggle.classList.toggle("active", legendaryFilter === "only");
    legendaryToggle.classList.toggle("excluded", legendaryFilter === "exclude");
    legendaryToggle.setAttribute("aria-pressed", String(legendaryFilter !== "any"));
    legendaryToggle.textContent =
      legendaryFilter === "only" ? "Legendary/Mythical only" : legendaryFilter === "exclude" ? "Hide Legendary/Mythical" : "Any rarity";
  }

  // Builds the removable-chip list shown under the toolbar from every active
  // filter dimension at once. Each chip owns its own undo: clicking it clears
  // just that one value, re-renders that category's option highlighting, and
  // re-applies - so chips double as the "what's currently filtered" summary
  // and the fastest way to walk a filter back without reopening the panel.
  function collectChips() {
    const chips = [];

    const addSetChips = (set, render, labelFn, excluded) => {
      set.forEach((v) => {
        chips.push({
          label: (excluded ? "Not " : "") + labelFn(v),
          onRemove: () => {
            set.delete(v);
            render();
            applyFiltersAndChips();
          },
        });
      });
    };

    addSetChips(selectedTypes, renderTypeOptionStates, capitalize);
    addSetChips(excludedTypes, renderTypeOptionStates, capitalize, true);
    if (typeCountFilter !== "any") {
      chips.push({
        label: typeCountFilter === "single" ? "Monotype only" : "Dual-type only",
        onRemove: () => {
          typeCountFilter = "any";
          updateTypeCountToggle();
          applyFiltersAndChips();
        },
      });
    }
    addSetChips(selectedGens, renderGenOptionStates, (g) => GEN_LABELS[g] || g);
    addSetChips(excludedGens, renderGenOptionStates, (g) => GEN_LABELS[g] || g, true);
    addSetChips(selectedStages, renderStageOptionStates, (s) => `Stage ${s}`);
    addSetChips(excludedStages, renderStageOptionStates, (s) => `Stage ${s}`, true);
    addSetChips(selectedEggGroups, renderEggOptionStates, capitalize);
    addSetChips(selectedHabitats, renderHabitatOptionStates, (h) => HABITAT_LABELS[h] || capitalize(h));
    addSetChips(excludedHabitats, renderHabitatOptionStates, (h) => HABITAT_LABELS[h] || capitalize(h), true);
    addSetChips(selectedColors, renderColorOptionStates, capitalize);
    addSetChips(excludedColors, renderColorOptionStates, capitalize, true);
    addSetChips(selectedAbilities, renderAbilityOptionStates, titleCase);
    addSetChips(selectedMoves, renderMoveOptionStates, titleCase);
    addSetChips(selectedShapes, renderShapeOptionStates, titleCase);
    addSetChips(selectedGrowthRates, renderGrowthOptionStates, titleCase);

    if (bstMin !== null || bstMax !== null) {
      chips.push({
        label: `BST ${bstMin ?? 0}–${bstMax ?? 800}`,
        onRemove: () => {
          bstMin = null;
          bstMax = null;
          bstMinInput.value = "";
          bstMaxInput.value = "";
          applyFiltersAndChips();
        },
      });
    }
    if (genderlessFilter !== "any") {
      chips.push({
        label: genderlessFilter === "only" ? "Genderless only" : "Exclude genderless",
        onRemove: () => {
          genderlessFilter = "any";
          updateGenderlessToggle();
          applyFiltersAndChips();
        },
      });
    }
    if (legendaryFilter !== "any") {
      chips.push({
        label: legendaryFilter === "only" ? "Legendary/Mythical only" : "Hide Legendary/Mythical",
        onRemove: () => {
          legendaryFilter = "any";
          updateLegendaryToggle();
          applyFiltersAndChips();
        },
      });
    }
    if (fullyEvolvedFilter !== "any") {
      chips.push({
        label: fullyEvolvedFilter === "only" ? "Fully evolved only" : "Hide fully evolved",
        onRemove: () => {
          fullyEvolvedFilter = "any";
          updateFullyEvolvedToggle();
          applyFiltersAndChips();
        },
      });
    }

    return chips;
  }

  function renderActiveChips() {
    const chips = collectChips();
    activeChips.innerHTML = chips
      .map(
        (c, i) =>
          `<button type="button" class="chip" data-chip-index="${i}">${c.label}<span class="chip-x">&times;</span></button>`,
      )
      .join("");
    activeChips.querySelectorAll(".chip").forEach((btn, i) => {
      btn.addEventListener("click", () => chips[i].onRemove());
    });
    const hasSelection = chips.length > 0;
    filtersBtn.classList.toggle("has-selection", hasSelection);
    filtersBtn.textContent = hasSelection ? `Filters (${chips.length})` : "Filters";
  }

  function applyFiltersAndChips() {
    applyFilters();
    renderActiveChips();
  }

  function updateScrollLock() {
    const anyOpen = !modalOverlay.classList.contains("hidden") || !filtersOverlay.classList.contains("hidden");
    document.documentElement.classList.toggle("modal-open", anyOpen);
  }

  function openFiltersPanel() {
    filtersOverlay.classList.remove("hidden");
    updateScrollLock();
  }

  function closeFiltersPanel() {
    filtersOverlay.classList.add("hidden");
    updateScrollLock();
  }

  function statRow(label, value, max = 255) {
    const pct = Math.min(100, Math.round((value / max) * 100));
    return `
      <div class="stat-row">
        <span class="stat-name">${label}</span>
        <span class="stat-value">${value}</span>
        <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
      </div>`;
  }

  function totalStatRow(bst) {
    return `
      <div class="stat-row stat-total">
        <span class="stat-name">Total</span>
        <span class="stat-value">${bst}</span>
        <div></div>
      </div>`;
  }

  const EV_STAT_LABELS = {
    hp: "HP",
    attack: "Attack",
    defense: "Defense",
    specialAttack: "Sp. Atk",
    specialDefense: "Sp. Def",
    speed: "Speed",
  };

  function evYieldText(evYield) {
    if (!evYield || !evYield.length) return "";
    const parts = evYield.map((e) => `+${e.value} ${EV_STAT_LABELS[e.stat] || e.stat}`);
    return `<p class="ev-yield">EV yield: ${parts.join(", ")}</p>`;
  }

  function titleCase(slug) {
    return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function renderAbilities(form) {
    return `
      <div class="section-title">Abilities</div>
      <div class="abilities">
        ${form.abilities
          .map(
            (a) => `
          <div class="ability-item">
            <button type="button" class="ability-badge attr-click${a.hidden ? " hidden-ability" : ""}" data-filter-type="ability" data-filter-value="${a.name}">${a.name.replace(/-/g, " ")}${a.hidden ? " (hidden)" : ""}</button>
            ${a.effect ? `<span class="ability-effect">${a.effect}</span>` : ""}
          </div>`,
          )
          .join("")}
      </div>`;
  }

  const MOVE_METHOD_LABELS = {
    "level-up": "Level up",
    machine: "Machine (TM/TR)",
    egg: "Egg move",
    tutor: "Move tutor",
    "form-change": "Form change",
  };

  function moveMethodLabel(method) {
    return MOVE_METHOD_LABELS[method] || titleCase(method);
  }

  function moveRow(m) {
    const stats = m.category === "status"
      ? "Status"
      : `${m.power ?? "—"} pow · ${m.accuracy ?? "—"}% acc · ${m.pp} PP`;
    return `
      <div class="move-row">
        <div class="move-row-head">
          ${m.method === "level-up" ? `<span class="move-level">${m.level > 0 ? `Lv ${m.level}` : "Evo"}</span>` : ""}
          <button type="button" class="move-name attr-click-text" data-filter-type="move" data-filter-value="${m.name}">${titleCase(m.name)}</button>
          ${typeBadge(m.type)}
          <span class="move-stats">${stats}</span>
        </div>
        ${m.effect ? `<p class="move-effect">${m.effect}</p>` : ""}
      </div>`;
  }

  // Grouped by learn method (level-up first, in level order - moves already
  // arrive pre-sorted this way from fetch-data.mjs) so the modal reads the
  // same way a game's own move-pool screen does, rather than one flat
  // alphabetical dump.
  function renderMovePool(form) {
    if (!form.moves || !form.moves.length) return "";
    const groups = new Map();
    for (const m of form.moves) {
      if (!groups.has(m.method)) groups.set(m.method, []);
      groups.get(m.method).push(m);
    }
    const order = ["level-up", "machine", "egg", "tutor", "form-change"];
    const methods = [...groups.keys()].sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    const groupsHtml = methods
      .map(
        (method) => `
        <div class="move-method-group">
          <div class="move-method-label">${moveMethodLabel(method)} (${groups.get(method).length})</div>
          <div class="move-list">${groups.get(method).map(moveRow).join("")}</div>
        </div>`,
      )
      .join("");
    return `<div class="section-title">Move pool</div>${groupsHtml}`;
  }

  // Groups a form's 18-entry attacking-type multiplier map into the three
  // buckets worth surfacing; 1x (neutral) entries are the majority and are
  // dropped since they carry no information.
  function typeMatchups(effectiveness) {
    const entries = Object.entries(effectiveness).filter(([, m]) => m !== 1);
    return {
      weak: entries.filter(([, m]) => m > 1).sort((a, b) => b[1] - a[1]),
      resist: entries.filter(([, m]) => m > 0 && m < 1).sort((a, b) => a[1] - b[1]),
      immune: entries.filter(([, m]) => m === 0),
    };
  }

  function matchupBadge([type, mult]) {
    return `<span class="type-badge matchup-badge" style="background:var(--type-${type})">${type} ${mult}×</span>`;
  }

  function renderTypeMatchups(form) {
    const { weak, resist, immune } = typeMatchups(form.typeEffectiveness);
    if (!weak.length && !resist.length && !immune.length) return "";
    const row = (label, cls, items) =>
      items.length
        ? `<div class="matchup-row"><span class="matchup-label ${cls}">${label}</span><div class="matchup-badges">${items.map(matchupBadge).join("")}</div></div>`
        : "";
    return `
      <div class="section-title">Type matchups</div>
      <div class="matchup-groups">
        ${row("Weak to", "weak", weak)}
        ${row("Resists", "resist", resist)}
        ${row("Immune to", "immune", immune)}
      </div>`;
  }

  function genderRatioText(rate) {
    if (rate === -1) return "Genderless";
    const female = (rate / 8) * 100;
    return `${100 - female}% ♂ / ${female}% ♀`;
  }

  function infoItem(label, value, fullWidth) {
    return `<div class="info-item${fullWidth ? " info-item-full" : ""}"><div class="label">${label}</div><div class="value">${value}</div></div>`;
  }

  function habitatDisplay(habitats) {
    if (!habitats || !habitats.length) return "Unknown";
    return `<div class="habitat-chips">${habitats
      .map((h) => {
        const icon = HABITAT_ICON_URLS[h]
          ? `<img class="habitat-icon" src="${HABITAT_ICON_URLS[h]}" alt="" />`
          : "";
        return `<button type="button" class="habitat-chip attr-click" data-filter-type="habitat" data-filter-value="${h}">${icon}${HABITAT_LABELS[h] || capitalize(h)}</button>`;
      })
      .join("")}</div>`;
  }

  function colorDisplay(colors) {
    if (!colors || !colors.length) return "Unknown";
    return `<div class="habitat-chips">${colors
      .map((c) => `<button type="button" class="habitat-chip attr-click" data-filter-type="color" data-filter-value="${c}"><span class="color-swatch" style="background:var(--color-${c})"></span>${capitalize(c)}</button>`)
      .join("")}</div>`;
  }

  function eggGroupChips(eggGroups) {
    if (!eggGroups || !eggGroups.length) return "Unknown";
    return `<div class="habitat-chips">${eggGroups
      .map((g) => `<button type="button" class="habitat-chip attr-click" data-filter-type="eggGroup" data-filter-value="${g}">${titleCase(g)}</button>`)
      .join("")}</div>`;
  }

  function renderBreedingInfo(species, form) {
    return `
      <div class="section-title">Breeding &amp; training</div>
      <div class="info-grid">
        ${infoItem("Egg Groups", eggGroupChips(species.eggGroups))}
        ${infoItem("Gender Ratio", genderRatioText(species.genderRate))}
        ${infoItem("Hatch Cycles", species.hatchCounter)}
        ${infoItem(
          "Growth Rate",
          species.growthRate
            ? `<button type="button" class="attr-click-text" data-filter-type="growthRate" data-filter-value="${species.growthRate}">${titleCase(species.growthRate)}</button>`
            : "Unknown",
        )}
        ${infoItem("Capture Rate", species.captureRate)}
        ${infoItem("Base Happiness", species.baseHappiness)}
        ${infoItem("Base XP", form.baseExperience ?? "—")}
        ${infoItem(
          "Shape",
          species.shape
            ? `<button type="button" class="attr-click-text" data-filter-type="shape" data-filter-value="${species.shape}">${titleCase(species.shape)}</button>`
            : "Unknown",
        )}
        ${infoItem("Colors", colorDisplay(form.colors), true)}
        ${infoItem("Habitats", habitatDisplay(form.habitats), true)}
      </div>`;
  }

  function renderEvolutionInfo(species) {
    const into = evolvesIntoMap.get(species.speciesName) || [];
    if (!species.evolvesFrom && into.length === 0) return "";

    const parent = species.evolvesFrom
      ? allPokemon.find((s) => s.speciesName === species.evolvesFrom)
      : null;

    const evoRow = (fromName, toName, methods) => `
      <div class="evo-row">
        <span class="evo-name">${fromName}</span>
        <span class="evo-arrow">&rarr;</span>
        <span class="evo-name">${toName}</span>
        ${methods && methods.length ? `<span class="evo-method">${methods.join(" or ")}</span>` : ""}
      </div>`;

    const fromHtml = parent
      ? evoRow(parent.speciesDisplayName, species.speciesDisplayName, species.evolutionMethods)
      : "";
    const intoHtml = into
      .map((child) => evoRow(species.speciesDisplayName, child.name, child.methods))
      .join("");

    return `<div class="section-title">Evolution</div><div class="evo-info">${fromHtml}${intoHtml}</div>`;
  }

  // National-dex-number neighbors, not filtered-list neighbors - stays fixed
  // across form tab switches since it's rendered once outside variant-header
  // /variant-body (which only cover the currently selected form).
  function renderDexNav(species) {
    const prev = allPokemon.find((s) => s.id === species.id - 1);
    const next = allPokemon.find((s) => s.id === species.id + 1);
    if (!prev && !next) return "";

    const card = (neighbor, dir) => {
      if (!neighbor) return `<div class="dex-nav-card dex-nav-${dir} dex-nav-empty"></div>`;
      const defaultForm = neighbor.forms.find((f) => f.isDefault) || neighbor.forms[0];
      const sprite = `<img class="dex-nav-sprite" src="${neighbor.sprite}" alt="" />`;
      const info = `
        <span class="dex-nav-info">
          <span class="dex-nav-number">${dexNumber(neighbor.id)}</span>
          <span class="dex-nav-name">${neighbor.speciesDisplayName}</span>
        </span>`;
      return `
        <button class="dex-nav-card dex-nav-${dir}" type="button" data-slug="${defaultForm.slug}">
          ${dir === "prev" ? sprite + info : info + sprite}
        </button>`;
    };

    return `<div class="dex-nav">${card(prev, "prev")}${card(next, "next")}</div>`;
  }

  function bindDexNavEvents() {
    modalContent.querySelectorAll(".dex-nav-card[data-slug]").forEach((card) => {
      card.addEventListener("click", () => {
        location.hash = card.dataset.slug;
      });
    });
  }

  function bindCryButton() {
    modalContent.querySelectorAll(".cry-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        new Audio(btn.dataset.cry).play().catch(() => {});
      });
    });
  }

  function renderFormTabs(species, activeSlug) {
    if (species.forms.length <= 1) return "";
    return `
      <div class="form-tabs">
        ${species.forms
          .map(
            (f) =>
              `<button class="form-tab${f.slug === activeSlug ? " active" : ""}" data-slug="${f.slug}">${f.label}</button>`,
          )
          .join("")}
      </div>`;
  }

  function rarityBadge(species) {
    if (!species.legendary && !species.mythical) return "";
    return `<button type="button" class="rarity-badge attr-click-text" data-filter-type="rarity" data-filter-value="only">${species.mythical ? "Mythical" : "Legendary"}</button>`;
  }

  function renderVariantHeader(species, form) {
    const name = formDisplayName(species.speciesDisplayName, form);
    return `
      <img src="${form.sprite}" alt="${name}" />
      <div class="modal-header-info">
        <div class="dex-number">${dexNumber(species.id)}</div>
        <div class="name">${name}</div>
        ${species.genus ? `<div class="genus">${species.genus}</div>` : ""}
        <div class="types">${form.types.map(clickableTypeBadge).join("")}</div>
        ${rarityBadge(species)}
        ${form.cry ? `<button class="cry-btn" type="button" data-cry="${form.cry}">&#9654; Cry</button>` : ""}
      </div>
    `;
  }

  function renderVariantBody(species, form) {
    const heightM = (form.height / 10).toFixed(1);
    const weightKg = (form.weight / 10).toFixed(1);
    return `
      <div class="meta-row">
        <div><div class="label">Height</div><div class="value">${heightM} m</div></div>
        <div><div class="label">Weight</div><div class="value">${weightKg} kg</div></div>
        <div><div class="label">Generation</div><button type="button" class="value attr-click-text" data-filter-type="generation" data-filter-value="${form.generation}">${GEN_LABELS[form.generation] || form.generation}</button></div>
      </div>
      ${renderAbilities(form)}
      <div class="section-title">Base stats</div>
      ${statRow("HP", form.stats.hp)}
      ${statRow("Attack", form.stats.attack)}
      ${statRow("Defense", form.stats.defense)}
      ${statRow("Sp. Atk", form.stats.specialAttack)}
      ${statRow("Sp. Def", form.stats.specialDefense)}
      ${statRow("Speed", form.stats.speed)}
      ${totalStatRow(form.bst)}
      ${evYieldText(form.evYield)}
      ${renderTypeMatchups(form)}
      ${renderBreedingInfo(species, form)}
      ${renderEvolutionInfo(species)}
      ${renderMovePool(form)}
    `;
  }

  function openModal(speciesId, formSlug) {
    const species = allPokemon.find((x) => x.id === speciesId);
    if (!species) return;

    currentSpecies = species;
    const defaultForm = species.forms.find((f) => f.isDefault) || species.forms[0];
    const form = (formSlug && species.forms.find((f) => f.slug === formSlug)) || defaultForm;
    currentFormSlug = form.slug;
    setModalAccent(form);

    modalContent.innerHTML = `
      <div class="modal-header" id="variant-header">${renderVariantHeader(species, form)}</div>
      ${renderFormTabs(species, currentFormSlug)}
      ${species.flavorText ? `<p class="flavor-text">${species.flavorText}</p>` : ""}
      ${renderDexNav(species)}
      <div id="variant-body">${renderVariantBody(species, form)}</div>
    `;

    bindFormTabEvents();
    bindCryButton();
    bindDexNavEvents();
    modalOverlay.classList.remove("hidden");
    updateScrollLock();
    document.title = `${formDisplayName(species.speciesDisplayName, form)} - Omnidex`;
  }

  function bindFormTabEvents() {
    modalContent.querySelectorAll(".form-tab").forEach((btn) => {
      btn.addEventListener("click", () => switchForm(btn.dataset.slug));
    });
  }

  function switchForm(slug) {
    if (!currentSpecies || slug === currentFormSlug) return;
    const form = currentSpecies.forms.find((f) => f.slug === slug);
    if (!form) return;

    const header = document.getElementById("variant-header");
    const body = document.getElementById("variant-body");
    header.classList.add("variant-fade-out");
    body.classList.add("variant-fade-out");

    setTimeout(() => {
      currentFormSlug = slug;
      setModalAccent(form);
      header.innerHTML = renderVariantHeader(currentSpecies, form);
      body.innerHTML = renderVariantBody(currentSpecies, form);
      bindCryButton();
      modalContent.querySelectorAll(".form-tab").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.slug === slug);
      });
      header.classList.remove("variant-fade-out");
      body.classList.remove("variant-fade-out");
      document.title = `${formDisplayName(currentSpecies.speciesDisplayName, form)} - Omnidex`;
      // Switching tabs within an already-open Pokemon replaces the hash in
      // place rather than pushing a new history entry, so tab-hopping
      // (Base -> Mega X -> Mega Y) doesn't require multiple presses of the
      // back button to leave the Pokemon entirely.
      history.replaceState(null, "", "#" + slug);
    }, 160);
  }

  // Hides the modal without touching the URL - used when a hash change
  // (browser back/forward, or a hash that no longer resolves) is what
  // triggered the close, since the URL has already been updated by then.
  function closeModalUI() {
    modalOverlay.classList.add("hidden");
    updateScrollLock();
    currentSpecies = null;
    currentFormSlug = null;
    document.title = "Omnidex";
  }

  // User-initiated close (X button, overlay click, Escape). Clears the hash
  // in place via replaceState rather than history.back(), since a modal
  // reached by a deep link (someone else's shared #slug URL) has nothing
  // in this tab's history to go back to - back() would leave the site
  // entirely instead of just closing the modal.
  function closeModal() {
    closeModalUI();
    if (location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  // Every open/close/tab-switch funnels through the hash, and this listener
  // is the single place that reacts to it - so a card click just sets the
  // hash and lets this render, rather than opening the modal directly.
  function applyHashState() {
    const slug = decodeURIComponent(location.hash.slice(1));
    if (!slug) {
      if (currentSpecies) closeModalUI();
      return;
    }
    const speciesId = formIndex.get(slug);
    if (speciesId === undefined) {
      if (currentSpecies) closeModalUI();
      return;
    }
    openModal(speciesId, slug);
  }

  window.addEventListener("hashchange", applyHashState);

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    location.hash = card.dataset.form;
  });

  modalClose.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  filtersBtn.addEventListener("click", () => {
    if (filtersOverlay.classList.contains("hidden")) openFiltersPanel();
    else closeFiltersPanel();
  });
  filtersClose.addEventListener("click", closeFiltersPanel);
  filtersOverlay.addEventListener("click", (e) => {
    if (e.target === filtersOverlay) closeFiltersPanel();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!filtersOverlay.classList.contains("hidden")) closeFiltersPanel();
    else closeModal();
  });

  searchInput.addEventListener("input", debounce(handleSearchInput, 120));
  sortSelect.addEventListener("change", applyFilters);

  typeOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".type-option");
    if (!btn) return;
    const type = btn.dataset.type;
    // Cycle: neutral -> include -> exclude -> neutral
    if (selectedTypes.has(type)) {
      selectedTypes.delete(type);
      excludedTypes.add(type);
    } else if (excludedTypes.has(type)) {
      excludedTypes.delete(type);
    } else {
      selectedTypes.add(type);
    }
    renderTypeOptionStates();
    renderActiveChips();
    applyFilters();
  });

  document.querySelectorAll(".mode-btn[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      typeMode = btn.dataset.mode;
      document.querySelectorAll(".mode-btn[data-mode]").forEach((b) => {
        b.classList.toggle("active", b.dataset.mode === typeMode);
      });
      applyFiltersAndChips();
    });
  });

  typeCountToggle.addEventListener("click", () => {
    // Cycle: any -> monotype only -> dual-type only -> any
    typeCountFilter =
      typeCountFilter === "any" ? "single" : typeCountFilter === "single" ? "multi" : "any";
    updateTypeCountToggle();
    applyFiltersAndChips();
  });

  typeClearBtn.addEventListener("click", () => {
    selectedTypes.clear();
    excludedTypes.clear();
    typeCountFilter = "any";
    renderTypeOptionStates();
    updateTypeCountToggle();
    applyFiltersAndChips();
  });

  genOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".gen-option");
    if (!btn) return;
    const gen = btn.dataset.gen;
    // Cycle: neutral -> include -> exclude -> neutral
    if (selectedGens.has(gen)) {
      selectedGens.delete(gen);
      excludedGens.add(gen);
    } else if (excludedGens.has(gen)) {
      excludedGens.delete(gen);
    } else {
      selectedGens.add(gen);
    }
    renderGenOptionStates();
    renderActiveChips();
    applyFilters();
  });

  genClearBtn.addEventListener("click", () => {
    selectedGens.clear();
    excludedGens.clear();
    renderGenOptionStates();
    applyFiltersAndChips();
  });

  stageOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".gen-option");
    if (!btn) return;
    const stage = Number(btn.dataset.stage);
    // Cycle: neutral -> include -> exclude -> neutral
    if (selectedStages.has(stage)) {
      selectedStages.delete(stage);
      excludedStages.add(stage);
    } else if (excludedStages.has(stage)) {
      excludedStages.delete(stage);
    } else {
      selectedStages.add(stage);
    }
    renderStageOptionStates();
    renderActiveChips();
    applyFilters();
  });

  stageClearBtn.addEventListener("click", () => {
    selectedStages.clear();
    excludedStages.clear();
    renderStageOptionStates();
    applyFiltersAndChips();
  });

  eggOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".gen-option");
    if (!btn) return;
    const group = btn.dataset.egg;
    if (selectedEggGroups.has(group)) selectedEggGroups.delete(group);
    else selectedEggGroups.add(group);
    renderEggOptionStates();
    renderActiveChips();
    applyFilters();
  });

  eggClearBtn.addEventListener("click", () => {
    selectedEggGroups.clear();
    renderEggOptionStates();
    applyFiltersAndChips();
  });

  habitatOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".gen-option");
    if (!btn) return;
    const habitat = btn.dataset.habitat;
    // Cycle: neutral -> include -> exclude -> neutral
    if (selectedHabitats.has(habitat)) {
      selectedHabitats.delete(habitat);
      excludedHabitats.add(habitat);
    } else if (excludedHabitats.has(habitat)) {
      excludedHabitats.delete(habitat);
    } else {
      selectedHabitats.add(habitat);
    }
    renderHabitatOptionStates();
    renderActiveChips();
    applyFilters();
  });

  habitatClearBtn.addEventListener("click", () => {
    selectedHabitats.clear();
    excludedHabitats.clear();
    renderHabitatOptionStates();
    applyFiltersAndChips();
  });

  document.querySelectorAll(".mode-btn[data-color-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      colorMode = btn.dataset.colorMode;
      document.querySelectorAll(".mode-btn[data-color-mode]").forEach((b) => {
        b.classList.toggle("active", b.dataset.colorMode === colorMode);
      });
      applyFiltersAndChips();
    });
  });

  colorOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".gen-option");
    if (!btn) return;
    const color = btn.dataset.color;
    // Cycle: neutral -> include -> exclude -> neutral
    if (selectedColors.has(color)) {
      selectedColors.delete(color);
      excludedColors.add(color);
    } else if (excludedColors.has(color)) {
      excludedColors.delete(color);
    } else {
      selectedColors.add(color);
    }
    renderColorOptionStates();
    renderActiveChips();
    applyFilters();
  });

  colorClearBtn.addEventListener("click", () => {
    selectedColors.clear();
    excludedColors.clear();
    colorMode = "any";
    document.querySelectorAll(".mode-btn[data-color-mode]").forEach((b) => {
      b.classList.toggle("active", b.dataset.colorMode === "any");
    });
    renderColorOptionStates();
    applyFiltersAndChips();
  });

  abilityOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".gen-option");
    if (!btn) return;
    const ability = btn.dataset.ability;
    if (selectedAbilities.has(ability)) selectedAbilities.delete(ability);
    else selectedAbilities.add(ability);
    renderAbilityOptionStates();
    renderActiveChips();
    applyFilters();
  });

  abilitySearch.addEventListener("input", () => {
    const q = abilitySearch.value.trim().toLowerCase();
    abilityOptions.querySelectorAll(".gen-option").forEach((btn) => {
      btn.classList.toggle("hidden", !btn.textContent.toLowerCase().includes(q));
    });
  });

  abilityClearBtn.addEventListener("click", () => {
    selectedAbilities.clear();
    abilitySearch.value = "";
    abilityOptions.querySelectorAll(".gen-option").forEach((btn) => btn.classList.remove("hidden"));
    renderAbilityOptionStates();
    applyFiltersAndChips();
  });

  moveOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".gen-option");
    if (!btn) return;
    const move = btn.dataset.move;
    if (selectedMoves.has(move)) selectedMoves.delete(move);
    else selectedMoves.add(move);
    renderMoveOptionStates();
    renderActiveChips();
    applyFilters();
  });

  moveSearch.addEventListener("input", () => {
    const q = moveSearch.value.trim().toLowerCase();
    moveOptions.querySelectorAll(".gen-option").forEach((btn) => {
      btn.classList.toggle("hidden", !btn.textContent.toLowerCase().includes(q));
    });
  });

  moveClearBtn.addEventListener("click", () => {
    selectedMoves.clear();
    moveSearch.value = "";
    moveOptions.querySelectorAll(".gen-option").forEach((btn) => btn.classList.remove("hidden"));
    renderMoveOptionStates();
    applyFiltersAndChips();
  });

  shapeOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".gen-option");
    if (!btn) return;
    const shape = btn.dataset.shape;
    if (selectedShapes.has(shape)) selectedShapes.delete(shape);
    else selectedShapes.add(shape);
    renderShapeOptionStates();
    renderActiveChips();
    applyFilters();
  });

  shapeClearBtn.addEventListener("click", () => {
    selectedShapes.clear();
    renderShapeOptionStates();
    applyFiltersAndChips();
  });

  growthOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".gen-option");
    if (!btn) return;
    const growth = btn.dataset.growth;
    if (selectedGrowthRates.has(growth)) selectedGrowthRates.delete(growth);
    else selectedGrowthRates.add(growth);
    renderGrowthOptionStates();
    renderActiveChips();
    applyFilters();
  });

  growthClearBtn.addEventListener("click", () => {
    selectedGrowthRates.clear();
    renderGrowthOptionStates();
    applyFiltersAndChips();
  });

  function handleBstInput() {
    const minVal = bstMinInput.value.trim();
    const maxVal = bstMaxInput.value.trim();
    bstMin = minVal === "" ? null : Number(minVal);
    bstMax = maxVal === "" ? null : Number(maxVal);
    applyFiltersAndChips();
  }
  bstMinInput.addEventListener("input", debounce(handleBstInput, 250));
  bstMaxInput.addEventListener("input", debounce(handleBstInput, 250));

  genderlessToggle.addEventListener("click", () => {
    genderlessFilter =
      genderlessFilter === "any" ? "only" : genderlessFilter === "only" ? "exclude" : "any";
    updateGenderlessToggle();
    applyFiltersAndChips();
  });

  fullyEvolvedToggle.addEventListener("click", () => {
    // Cycle: any -> only fully evolved -> hide fully evolved -> any
    fullyEvolvedFilter =
      fullyEvolvedFilter === "any" ? "only" : fullyEvolvedFilter === "only" ? "exclude" : "any";
    updateFullyEvolvedToggle();
    applyFiltersAndChips();
  });

  legendaryToggle.addEventListener("click", () => {
    legendaryFilter =
      legendaryFilter === "any" ? "only" : legendaryFilter === "only" ? "exclude" : "any";
    updateLegendaryToggle();
    applyFiltersAndChips();
  });

  // Clears every filter dimension and refreshes all filter-bar UI to match
  // - shared by the "Clear filters" button and by filterByAttribute below,
  // since clicking an attribute in the modal starts a fresh single-filter
  // query rather than combining with whatever was already selected.
  function resetAllFilterState() {
    searchInput.value = "";
    selectedTypes.clear();
    excludedTypes.clear();
    typeMode = "any";
    typeCountFilter = "any";
    selectedGens.clear();
    excludedGens.clear();
    selectedStages.clear();
    excludedStages.clear();
    selectedEggGroups.clear();
    selectedHabitats.clear();
    excludedHabitats.clear();
    selectedColors.clear();
    excludedColors.clear();
    colorMode = "any";
    selectedAbilities.clear();
    selectedMoves.clear();
    selectedShapes.clear();
    selectedGrowthRates.clear();
    bstMin = null;
    bstMax = null;
    bstMinInput.value = "";
    bstMaxInput.value = "";
    genderlessFilter = "any";
    fullyEvolvedFilter = "any";
    legendaryFilter = "any";
    abilitySearch.value = "";
    moveSearch.value = "";
    abilityOptions.querySelectorAll(".gen-option").forEach((btn) => btn.classList.remove("hidden"));
    moveOptions.querySelectorAll(".gen-option").forEach((btn) => btn.classList.remove("hidden"));

    document.querySelectorAll(".mode-btn[data-mode]").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === "any");
    });
    document.querySelectorAll(".mode-btn[data-color-mode]").forEach((b) => {
      b.classList.toggle("active", b.dataset.colorMode === "any");
    });
    renderTypeOptionStates();
    updateTypeCountToggle();
    renderGenOptionStates();
    renderStageOptionStates();
    renderEggOptionStates();
    renderHabitatOptionStates();
    renderColorOptionStates();
    renderAbilityOptionStates();
    renderMoveOptionStates();
    renderShapeOptionStates();
    renderGrowthOptionStates();
    updateGenderlessToggle();
    updateFullyEvolvedToggle();
    updateLegendaryToggle();
    renderActiveChips();
  }

  // Clicking a type badge, ability, habitat, color, egg group, generation,
  // move, shape, growth rate, or rarity badge inside the modal jumps
  // straight to "show me every Pokemon that shares this" - replacing
  // whatever was filtered before rather than combining with it, since
  // combining silently (e.g. an existing Water filter plus a clicked Fire
  // badge) would OR them into a confusing Fire-or-Water result instead of
  // the single-trait query the click implies.
  function filterByAttribute(kind, value) {
    resetAllFilterState();
    switch (kind) {
      case "type":
        selectedTypes.add(value);
        renderTypeOptionStates();
        break;
      case "ability":
        selectedAbilities.add(value);
        renderAbilityOptionStates();
        break;
      case "habitat":
        selectedHabitats.add(value);
        renderHabitatOptionStates();
        break;
      case "color":
        selectedColors.add(value);
        renderColorOptionStates();
        break;
      case "eggGroup":
        selectedEggGroups.add(value);
        renderEggOptionStates();
        break;
      case "move":
        selectedMoves.add(value);
        renderMoveOptionStates();
        break;
      case "generation":
        selectedGens.add(value);
        renderGenOptionStates();
        break;
      case "shape":
        selectedShapes.add(value);
        renderShapeOptionStates();
        break;
      case "growthRate":
        selectedGrowthRates.add(value);
        renderGrowthOptionStates();
        break;
      case "rarity":
        legendaryFilter = value;
        updateLegendaryToggle();
        break;
      default:
        return;
    }
    renderActiveChips();
    closeModal();
    applyFilters();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  modalContent.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter-type]");
    if (!btn) return;
    filterByAttribute(btn.dataset.filterType, btn.dataset.filterValue);
  });

  clearAllBtn.addEventListener("click", () => {
    resetAllFilterState();
    applyFilters();
  });

  async function init() {
    const res = await fetch("data/pokemon.json");
    allPokemon = await res.json();
    flatEntries = buildFlatEntries();
    evolvesIntoMap = buildEvolvesIntoMap();
    formIndex = buildFormIndex();
    populateFilterOptions();
    applyFilters();
    renderActiveChips();
    applyHashState();
  }

  init().catch((err) => {
    grid.innerHTML = `<p style="color:red">Failed to load Pokémon data: ${err.message}</p>`;
    console.error(err);
  });
})();
