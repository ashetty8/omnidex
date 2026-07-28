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
  const typeFilterBtn = document.getElementById("type-filter-btn");
  const typeFilterPanel = document.getElementById("type-filter-panel");
  const typeOptions = document.getElementById("type-options");
  const typeClearBtn = document.getElementById("type-clear-btn");
  const genFilterBtn = document.getElementById("gen-filter-btn");
  const genFilterPanel = document.getElementById("gen-filter-panel");
  const genOptions = document.getElementById("gen-options");
  const genClearBtn = document.getElementById("gen-clear-btn");
  const stageFilterBtn = document.getElementById("stage-filter-btn");
  const stageFilterPanel = document.getElementById("stage-filter-panel");
  const stageOptions = document.getElementById("stage-options");
  const stageClearBtn = document.getElementById("stage-clear-btn");
  const eggFilterBtn = document.getElementById("egg-filter-btn");
  const eggFilterPanel = document.getElementById("egg-filter-panel");
  const eggOptions = document.getElementById("egg-options");
  const eggClearBtn = document.getElementById("egg-clear-btn");
  const habitatFilterBtn = document.getElementById("habitat-filter-btn");
  const habitatFilterPanel = document.getElementById("habitat-filter-panel");
  const habitatOptions = document.getElementById("habitat-options");
  const habitatClearBtn = document.getElementById("habitat-clear-btn");
  const colorFilterBtn = document.getElementById("color-filter-btn");
  const colorFilterPanel = document.getElementById("color-filter-panel");
  const colorOptions = document.getElementById("color-options");
  const colorClearBtn = document.getElementById("color-clear-btn");
  const fullyEvolvedToggle = document.getElementById("fully-evolved-toggle");
  const clearAllBtn = document.getElementById("clear-all-btn");
  const sortSelect = document.getElementById("sort-select");
  const resultCount = document.getElementById("result-count");
  const emptyState = document.getElementById("empty-state");
  const modalOverlay = document.getElementById("modal-overlay");
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
  let selectedGens = new Set(); // OR: matches if the Pokémon's (single) generation is selected
  let excludedGens = new Set();
  let selectedStages = new Set(); // OR: matches if the Pokémon's (single) evolution stage is selected
  let excludedStages = new Set();
  let selectedEggGroups = new Set(); // OR: matches if the species has any selected group
  let selectedHabitats = new Set(); // OR: matches if the species has any selected habitat
  let excludedHabitats = new Set();
  let selectedColors = new Set(); // OR: matches if the species has any selected color
  let excludedColors = new Set();
  let fullyEvolvedFilter = "any"; // "any" | "only" (fully evolved) | "exclude" (hide fully evolved)
  let evolvesIntoMap = new Map(); // parent speciesName -> [{ id, name, sprite, methods }]

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
    excludedGens = new Set([entry.generation]);
    selectedGens.clear();
    excludedStages = new Set([entry.evolutionStage]);
    selectedStages.clear();
    fullyEvolvedFilter = entry.fullyEvolved ? "exclude" : "only";
    excludedHabitats = new Set(entry.habitats);
    selectedHabitats.clear();
    excludedColors = new Set(entry.colors);
    selectedColors.clear();
    searchInput.value = "";

    typeFilterPanel.querySelectorAll(".mode-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === typeMode);
    });
    renderTypeOptionStates();
    updateTypeFilterBtn();
    renderGenOptionStates();
    updateGenFilterBtn();
    renderStageOptionStates();
    updateStageFilterBtn();
    updateFullyEvolvedToggle();
    renderHabitatOptionStates();
    updateHabitatFilterBtn();
    renderColorOptionStates();
    updateColorFilterBtn();

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
      selectedGens.size > 0 ||
      excludedGens.size > 0 ||
      selectedStages.size > 0 ||
      excludedStages.size > 0 ||
      selectedEggGroups.size > 0 ||
      selectedHabitats.size > 0 ||
      excludedHabitats.size > 0 ||
      selectedColors.size > 0 ||
      excludedColors.size > 0 ||
      fullyEvolvedFilter !== "any"
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

  function applyFilters() {
    const q = searchInput.value.trim().toLowerCase();
    const active =
      q !== "" ||
      selectedTypes.size > 0 ||
      excludedTypes.size > 0 ||
      selectedGens.size > 0 ||
      excludedGens.size > 0 ||
      selectedStages.size > 0 ||
      excludedStages.size > 0 ||
      selectedEggGroups.size > 0 ||
      selectedHabitats.size > 0 ||
      excludedHabitats.size > 0 ||
      selectedColors.size > 0 ||
      excludedColors.size > 0 ||
      fullyEvolvedFilter !== "any";

    filtered = flatEntries.filter((e) => {
      if (!active) return e.isDefault;
      if (!matchesSelectedTypes(e.types)) return false;
      if (!matchesGen(e.generation)) return false;
      if (!matchesStage(e.evolutionStage)) return false;
      if (selectedEggGroups.size > 0 && !e.eggGroups.some((g) => selectedEggGroups.has(g))) return false;
      if (!matchesHabitat(e.habitats)) return false;
      if (!matchesColor(e.colors)) return false;
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
    flatEntries.forEach((e) => {
      e.types.forEach((t) => types.add(t));
      gens.add(e.generation);
      stages.add(e.evolutionStage);
      e.eggGroups.forEach((g) => eggGroups.add(g));
      e.habitats.forEach((h) => habitats.add(h));
      e.colors.forEach((c) => colors.add(c));
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
  }

  function capitalize(t) {
    return t[0].toUpperCase() + t.slice(1);
  }

  function updateTypeFilterBtn() {
    const hasSelection = selectedTypes.size > 0 || excludedTypes.size > 0;
    typeFilterBtn.classList.toggle("has-selection", hasSelection);
    if (!hasSelection) {
      typeFilterBtn.textContent = "All types";
      return;
    }
    const joiner = typeMode === "all" || typeMode === "mono" ? " + " : ", ";
    let label = selectedTypes.size > 0 ? [...selectedTypes].map(capitalize).join(joiner) : "All types";
    if (excludedTypes.size > 0) {
      label += ` − ${[...excludedTypes].map(capitalize).join(", ")}`;
    }
    typeFilterBtn.textContent = label;
  }

  function renderTypeOptionStates() {
    typeOptions.querySelectorAll(".type-option").forEach((btn) => {
      const type = btn.dataset.type;
      btn.classList.toggle("selected", selectedTypes.has(type));
      btn.classList.toggle("excluded", excludedTypes.has(type));
    });
  }

  function toggleTypePanel(show) {
    const willShow = show ?? typeFilterPanel.classList.contains("hidden");
    typeFilterPanel.classList.toggle("hidden", !willShow);
    typeFilterBtn.setAttribute("aria-expanded", String(willShow));
  }

  function updateGenFilterBtn() {
    const hasSelection = selectedGens.size > 0 || excludedGens.size > 0;
    genFilterBtn.classList.toggle("has-selection", hasSelection);
    if (!hasSelection) {
      genFilterBtn.textContent = "All generations";
      return;
    }
    const labelFor = (g) => GEN_LABELS[g] || g;
    let label = selectedGens.size > 0 ? [...selectedGens].map(labelFor).join(", ") : "All generations";
    if (excludedGens.size > 0) {
      label += ` − ${[...excludedGens].map(labelFor).join(", ")}`;
    }
    genFilterBtn.textContent = label;
  }

  function renderGenOptionStates() {
    genOptions.querySelectorAll(".gen-option").forEach((btn) => {
      btn.classList.toggle("selected", selectedGens.has(btn.dataset.gen));
      btn.classList.toggle("excluded", excludedGens.has(btn.dataset.gen));
    });
  }

  function toggleGenPanel(show) {
    const willShow = show ?? genFilterPanel.classList.contains("hidden");
    genFilterPanel.classList.toggle("hidden", !willShow);
    genFilterBtn.setAttribute("aria-expanded", String(willShow));
  }

  function updateStageFilterBtn() {
    const hasSelection = selectedStages.size > 0 || excludedStages.size > 0;
    stageFilterBtn.classList.toggle("has-selection", hasSelection);
    if (!hasSelection) {
      stageFilterBtn.textContent = "Any stage";
      return;
    }
    const labelFor = (s) => `Stage ${s}`;
    const sortNum = (a, b) => a - b;
    let label = selectedStages.size > 0
      ? [...selectedStages].sort(sortNum).map(labelFor).join(", ")
      : "Any stage";
    if (excludedStages.size > 0) {
      label += ` − ${[...excludedStages].sort(sortNum).map(labelFor).join(", ")}`;
    }
    stageFilterBtn.textContent = label;
  }

  function renderStageOptionStates() {
    stageOptions.querySelectorAll(".gen-option").forEach((btn) => {
      const stage = Number(btn.dataset.stage);
      btn.classList.toggle("selected", selectedStages.has(stage));
      btn.classList.toggle("excluded", excludedStages.has(stage));
    });
  }

  function toggleStagePanel(show) {
    const willShow = show ?? stageFilterPanel.classList.contains("hidden");
    stageFilterPanel.classList.toggle("hidden", !willShow);
    stageFilterBtn.setAttribute("aria-expanded", String(willShow));
  }

  function updateEggFilterBtn() {
    eggFilterBtn.classList.toggle("has-selection", selectedEggGroups.size > 0);
    if (selectedEggGroups.size === 0) {
      eggFilterBtn.textContent = "Any egg group";
      return;
    }
    eggFilterBtn.textContent = [...selectedEggGroups].map(capitalize).join(", ");
  }

  function renderEggOptionStates() {
    eggOptions.querySelectorAll(".gen-option").forEach((btn) => {
      btn.classList.toggle("selected", selectedEggGroups.has(btn.dataset.egg));
    });
  }

  function toggleEggPanel(show) {
    const willShow = show ?? eggFilterPanel.classList.contains("hidden");
    eggFilterPanel.classList.toggle("hidden", !willShow);
    eggFilterBtn.setAttribute("aria-expanded", String(willShow));
  }

  function updateHabitatFilterBtn() {
    const hasSelection = selectedHabitats.size > 0 || excludedHabitats.size > 0;
    habitatFilterBtn.classList.toggle("has-selection", hasSelection);
    if (!hasSelection) {
      habitatFilterBtn.textContent = "Any habitat";
      return;
    }
    const labelFor = (h) => HABITAT_LABELS[h] || capitalize(h);
    let label = selectedHabitats.size > 0 ? [...selectedHabitats].map(labelFor).join(", ") : "Any habitat";
    if (excludedHabitats.size > 0) {
      label += ` − ${[...excludedHabitats].map(labelFor).join(", ")}`;
    }
    habitatFilterBtn.textContent = label;
  }

  function renderHabitatOptionStates() {
    habitatOptions.querySelectorAll(".gen-option").forEach((btn) => {
      btn.classList.toggle("selected", selectedHabitats.has(btn.dataset.habitat));
      btn.classList.toggle("excluded", excludedHabitats.has(btn.dataset.habitat));
    });
  }

  function toggleHabitatPanel(show) {
    const willShow = show ?? habitatFilterPanel.classList.contains("hidden");
    habitatFilterPanel.classList.toggle("hidden", !willShow);
    habitatFilterBtn.setAttribute("aria-expanded", String(willShow));
  }

  function updateColorFilterBtn() {
    const hasSelection = selectedColors.size > 0 || excludedColors.size > 0;
    colorFilterBtn.classList.toggle("has-selection", hasSelection);
    if (!hasSelection) {
      colorFilterBtn.textContent = "Any color";
      return;
    }
    let label = selectedColors.size > 0 ? [...selectedColors].map(capitalize).join(", ") : "Any color";
    if (excludedColors.size > 0) {
      label += ` − ${[...excludedColors].map(capitalize).join(", ")}`;
    }
    colorFilterBtn.textContent = label;
  }

  function renderColorOptionStates() {
    colorOptions.querySelectorAll(".gen-option").forEach((btn) => {
      btn.classList.toggle("selected", selectedColors.has(btn.dataset.color));
      btn.classList.toggle("excluded", excludedColors.has(btn.dataset.color));
    });
  }

  function toggleColorPanel(show) {
    const willShow = show ?? colorFilterPanel.classList.contains("hidden");
    colorFilterPanel.classList.toggle("hidden", !willShow);
    colorFilterBtn.setAttribute("aria-expanded", String(willShow));
  }

  function updateFullyEvolvedToggle() {
    fullyEvolvedToggle.classList.toggle("active", fullyEvolvedFilter === "only");
    fullyEvolvedToggle.classList.toggle("excluded", fullyEvolvedFilter === "exclude");
    fullyEvolvedToggle.setAttribute("aria-pressed", String(fullyEvolvedFilter !== "any"));
    fullyEvolvedToggle.textContent =
      fullyEvolvedFilter === "exclude" ? "Hide fully evolved" : "Fully evolved only";
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
            <span class="ability-badge${a.hidden ? " hidden-ability" : ""}">${a.name.replace(/-/g, " ")}${a.hidden ? " (hidden)" : ""}</span>
            ${a.effect ? `<span class="ability-effect">${a.effect}</span>` : ""}
          </div>`,
          )
          .join("")}
      </div>`;
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
        return `<span class="habitat-chip">${icon}${HABITAT_LABELS[h] || capitalize(h)}</span>`;
      })
      .join("")}</div>`;
  }

  function colorDisplay(colors) {
    if (!colors || !colors.length) return "Unknown";
    return `<div class="habitat-chips">${colors
      .map((c) => `<span class="habitat-chip"><span class="color-swatch" style="background:var(--color-${c})"></span>${capitalize(c)}</span>`)
      .join("")}</div>`;
  }

  function renderBreedingInfo(species, form) {
    return `
      <div class="section-title">Breeding &amp; training</div>
      <div class="info-grid">
        ${infoItem("Egg Groups", species.eggGroups.map(titleCase).join(", "))}
        ${infoItem("Gender Ratio", genderRatioText(species.genderRate))}
        ${infoItem("Hatch Cycles", species.hatchCounter)}
        ${infoItem("Growth Rate", titleCase(species.growthRate))}
        ${infoItem("Capture Rate", species.captureRate)}
        ${infoItem("Base Happiness", species.baseHappiness)}
        ${infoItem("Base XP", form.baseExperience ?? "—")}
        ${infoItem("Shape", species.shape ? titleCase(species.shape) : "Unknown")}
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

  function renderVariantHeader(species, form) {
    const name = formDisplayName(species.speciesDisplayName, form);
    return `
      <img src="${form.sprite}" alt="${name}" />
      <div class="dex-number">${dexNumber(species.id)}</div>
      <div class="name">${name}</div>
      ${species.genus ? `<div class="genus">${species.genus}</div>` : ""}
      <div class="types">${form.types.map(typeBadge).join("")}</div>
      ${form.cry ? `<button class="cry-btn" type="button" data-cry="${form.cry}">&#9654; Cry</button>` : ""}
    `;
  }

  function renderVariantBody(species, form) {
    const heightM = (form.height / 10).toFixed(1);
    const weightKg = (form.weight / 10).toFixed(1);
    return `
      <div class="meta-row">
        <div><div class="label">Height</div><div class="value">${heightM} m</div></div>
        <div><div class="label">Weight</div><div class="value">${weightKg} kg</div></div>
        <div><div class="label">Generation</div><div class="value">${GEN_LABELS[form.generation] || form.generation}</div></div>
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
    `;
  }

  function openModal(speciesId, formSlug) {
    const species = allPokemon.find((x) => x.id === speciesId);
    if (!species) return;

    currentSpecies = species;
    const defaultForm = species.forms.find((f) => f.isDefault) || species.forms[0];
    const form = (formSlug && species.forms.find((f) => f.slug === formSlug)) || defaultForm;
    currentFormSlug = form.slug;

    modalContent.innerHTML = `
      <div class="modal-header" id="variant-header">${renderVariantHeader(species, form)}</div>
      ${renderFormTabs(species, currentFormSlug)}
      ${species.flavorText ? `<p class="flavor-text">${species.flavorText}</p>` : ""}
      <div id="variant-body">${renderVariantBody(species, form)}</div>
    `;

    bindFormTabEvents();
    bindCryButton();
    modalOverlay.classList.remove("hidden");
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
      header.innerHTML = renderVariantHeader(currentSpecies, form);
      body.innerHTML = renderVariantBody(currentSpecies, form);
      bindCryButton();
      modalContent.querySelectorAll(".form-tab").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.slug === slug);
      });
      header.classList.remove("variant-fade-out");
      body.classList.remove("variant-fade-out");
    }, 160);
  }

  function closeModal() {
    modalOverlay.classList.add("hidden");
    currentSpecies = null;
    currentFormSlug = null;
  }

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    openModal(Number(card.dataset.species), card.dataset.form);
  });

  modalClose.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  searchInput.addEventListener("input", debounce(handleSearchInput, 120));
  sortSelect.addEventListener("change", applyFilters);

  typeFilterBtn.addEventListener("click", () => toggleTypePanel());

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
    updateTypeFilterBtn();
    applyFilters();
  });

  typeFilterPanel.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      typeMode = btn.dataset.mode;
      typeFilterPanel.querySelectorAll(".mode-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.mode === typeMode);
      });
      updateTypeFilterBtn();
      applyFilters();
    });
  });

  typeClearBtn.addEventListener("click", () => {
    selectedTypes.clear();
    excludedTypes.clear();
    renderTypeOptionStates();
    updateTypeFilterBtn();
    applyFilters();
  });

  genFilterBtn.addEventListener("click", () => toggleGenPanel());

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
    updateGenFilterBtn();
    applyFilters();
  });

  genClearBtn.addEventListener("click", () => {
    selectedGens.clear();
    excludedGens.clear();
    renderGenOptionStates();
    updateGenFilterBtn();
    applyFilters();
  });

  stageFilterBtn.addEventListener("click", () => toggleStagePanel());

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
    updateStageFilterBtn();
    applyFilters();
  });

  stageClearBtn.addEventListener("click", () => {
    selectedStages.clear();
    excludedStages.clear();
    renderStageOptionStates();
    updateStageFilterBtn();
    applyFilters();
  });

  eggFilterBtn.addEventListener("click", () => toggleEggPanel());

  eggOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".gen-option");
    if (!btn) return;
    const group = btn.dataset.egg;
    if (selectedEggGroups.has(group)) selectedEggGroups.delete(group);
    else selectedEggGroups.add(group);
    renderEggOptionStates();
    updateEggFilterBtn();
    applyFilters();
  });

  eggClearBtn.addEventListener("click", () => {
    selectedEggGroups.clear();
    renderEggOptionStates();
    updateEggFilterBtn();
    applyFilters();
  });

  habitatFilterBtn.addEventListener("click", () => toggleHabitatPanel());

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
    updateHabitatFilterBtn();
    applyFilters();
  });

  habitatClearBtn.addEventListener("click", () => {
    selectedHabitats.clear();
    excludedHabitats.clear();
    renderHabitatOptionStates();
    updateHabitatFilterBtn();
    applyFilters();
  });

  colorFilterBtn.addEventListener("click", () => toggleColorPanel());

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
    updateColorFilterBtn();
    applyFilters();
  });

  colorClearBtn.addEventListener("click", () => {
    selectedColors.clear();
    excludedColors.clear();
    renderColorOptionStates();
    updateColorFilterBtn();
    applyFilters();
  });

  fullyEvolvedToggle.addEventListener("click", () => {
    // Cycle: any -> only fully evolved -> hide fully evolved -> any
    fullyEvolvedFilter =
      fullyEvolvedFilter === "any" ? "only" : fullyEvolvedFilter === "only" ? "exclude" : "any";
    updateFullyEvolvedToggle();
    applyFilters();
  });

  document.addEventListener("click", (e) => {
    if (!typeFilterPanel.contains(e.target) && e.target !== typeFilterBtn) {
      toggleTypePanel(false);
    }
    if (!genFilterPanel.contains(e.target) && e.target !== genFilterBtn) {
      toggleGenPanel(false);
    }
    if (!stageFilterPanel.contains(e.target) && e.target !== stageFilterBtn) {
      toggleStagePanel(false);
    }
    if (!eggFilterPanel.contains(e.target) && e.target !== eggFilterBtn) {
      toggleEggPanel(false);
    }
    if (!habitatFilterPanel.contains(e.target) && e.target !== habitatFilterBtn) {
      toggleHabitatPanel(false);
    }
    if (!colorFilterPanel.contains(e.target) && e.target !== colorFilterBtn) {
      toggleColorPanel(false);
    }
  });

  clearAllBtn.addEventListener("click", () => {
    searchInput.value = "";
    selectedTypes.clear();
    excludedTypes.clear();
    typeMode = "any";
    selectedGens.clear();
    excludedGens.clear();
    selectedStages.clear();
    excludedStages.clear();
    selectedEggGroups.clear();
    selectedHabitats.clear();
    excludedHabitats.clear();
    selectedColors.clear();
    excludedColors.clear();
    fullyEvolvedFilter = "any";

    typeFilterPanel.querySelectorAll(".mode-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === "any");
    });
    renderTypeOptionStates();
    updateTypeFilterBtn();
    renderGenOptionStates();
    updateGenFilterBtn();
    renderStageOptionStates();
    updateStageFilterBtn();
    renderEggOptionStates();
    updateEggFilterBtn();
    renderHabitatOptionStates();
    updateHabitatFilterBtn();
    renderColorOptionStates();
    updateColorFilterBtn();
    updateFullyEvolvedToggle();
    toggleTypePanel(false);
    toggleGenPanel(false);
    toggleStagePanel(false);
    toggleEggPanel(false);
    toggleHabitatPanel(false);
    toggleColorPanel(false);
    applyFilters();
  });

  async function init() {
    const res = await fetch("data/pokemon.json");
    allPokemon = await res.json();
    flatEntries = buildFlatEntries();
    evolvesIntoMap = buildEvolvesIntoMap();
    populateFilterOptions();
    applyFilters();
  }

  init().catch((err) => {
    grid.innerHTML = `<p style="color:red">Failed to load Pokémon data: ${err.message}</p>`;
    console.error(err);
  });
})();
