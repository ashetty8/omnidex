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
  let selectedGens = new Set(); // always OR: a Pokémon belongs to exactly one generation
  let selectedStages = new Set(); // always OR: a Pokémon belongs to exactly one evolution stage
  let selectedEggGroups = new Set(); // OR: matches if the species has any selected group
  let selectedHabitats = new Set(); // always OR: a species has at most one habitat
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
          habitat: species.habitat,
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

  function renderGrid() {
    // Generation separators only make sense when the grid is actually grouped
    // by generation, which is only guaranteed when sorted by dex number -
    // name/BST sorts interleave generations, where a separator per row would
    // just be noise.
    const showGenSeparators = sortSelect.value.startsWith("id-");
    let lastGen = null;
    const parts = [];
    for (const e of filtered) {
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

  function hasActiveFilters() {
    return (
      searchInput.value.trim() !== "" ||
      selectedTypes.size > 0 ||
      excludedTypes.size > 0 ||
      selectedGens.size > 0 ||
      selectedStages.size > 0 ||
      selectedEggGroups.size > 0 ||
      selectedHabitats.size > 0 ||
      fullyEvolvedFilter !== "any"
    );
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
      selectedStages.size > 0 ||
      selectedEggGroups.size > 0 ||
      selectedHabitats.size > 0 ||
      fullyEvolvedFilter !== "any";

    filtered = flatEntries.filter((e) => {
      if (!active) return e.isDefault;
      if (!matchesSelectedTypes(e.types)) return false;
      if (selectedGens.size > 0 && !selectedGens.has(e.generation)) return false;
      if (selectedStages.size > 0 && !selectedStages.has(e.evolutionStage)) return false;
      if (selectedEggGroups.size > 0 && !e.eggGroups.some((g) => selectedEggGroups.has(g))) return false;
      if (selectedHabitats.size > 0 && !selectedHabitats.has(e.habitat)) return false;
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
    flatEntries.forEach((e) => {
      e.types.forEach((t) => types.add(t));
      gens.add(e.generation);
      stages.add(e.evolutionStage);
      e.eggGroups.forEach((g) => eggGroups.add(g));
      if (e.habitat) habitats.add(e.habitat);
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
      .sort()
      .map(
        (h) =>
          `<button class="gen-option" data-habitat="${h}" type="button">${capitalize(h)}</button>`,
      )
      .join("");
  }

  function capitalize(t) {
    return t[0].toUpperCase() + t.slice(1);
  }

  function updateTypeFilterBtn() {
    if (selectedTypes.size === 0 && excludedTypes.size === 0) {
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
    if (selectedGens.size === 0) {
      genFilterBtn.textContent = "All generations";
      return;
    }
    const names = [...selectedGens].map((g) => GEN_LABELS[g] || g);
    genFilterBtn.textContent = names.join(", ");
  }

  function renderGenOptionStates() {
    genOptions.querySelectorAll(".gen-option").forEach((btn) => {
      btn.classList.toggle("selected", selectedGens.has(btn.dataset.gen));
    });
  }

  function toggleGenPanel(show) {
    const willShow = show ?? genFilterPanel.classList.contains("hidden");
    genFilterPanel.classList.toggle("hidden", !willShow);
    genFilterBtn.setAttribute("aria-expanded", String(willShow));
  }

  function updateStageFilterBtn() {
    if (selectedStages.size === 0) {
      stageFilterBtn.textContent = "Any stage";
      return;
    }
    const names = [...selectedStages].sort((a, b) => a - b).map((s) => `Stage ${s}`);
    stageFilterBtn.textContent = names.join(", ");
  }

  function renderStageOptionStates() {
    stageOptions.querySelectorAll(".gen-option").forEach((btn) => {
      btn.classList.toggle("selected", selectedStages.has(Number(btn.dataset.stage)));
    });
  }

  function toggleStagePanel(show) {
    const willShow = show ?? stageFilterPanel.classList.contains("hidden");
    stageFilterPanel.classList.toggle("hidden", !willShow);
    stageFilterBtn.setAttribute("aria-expanded", String(willShow));
  }

  function updateEggFilterBtn() {
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
    if (selectedHabitats.size === 0) {
      habitatFilterBtn.textContent = "Any habitat";
      return;
    }
    habitatFilterBtn.textContent = [...selectedHabitats].map(capitalize).join(", ");
  }

  function renderHabitatOptionStates() {
    habitatOptions.querySelectorAll(".gen-option").forEach((btn) => {
      btn.classList.toggle("selected", selectedHabitats.has(btn.dataset.habitat));
    });
  }

  function toggleHabitatPanel(show) {
    const willShow = show ?? habitatFilterPanel.classList.contains("hidden");
    habitatFilterPanel.classList.toggle("hidden", !willShow);
    habitatFilterBtn.setAttribute("aria-expanded", String(willShow));
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

  function infoItem(label, value) {
    return `<div class="info-item"><div class="label">${label}</div><div class="value">${value}</div></div>`;
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
        ${infoItem("Habitat", species.habitat ? titleCase(species.habitat) : "Unknown")}
        ${infoItem("Shape", species.shape ? titleCase(species.shape) : "Unknown")}
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

  searchInput.addEventListener("input", debounce(applyFilters, 120));
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
    if (selectedGens.has(gen)) selectedGens.delete(gen);
    else selectedGens.add(gen);
    renderGenOptionStates();
    updateGenFilterBtn();
    applyFilters();
  });

  genClearBtn.addEventListener("click", () => {
    selectedGens.clear();
    renderGenOptionStates();
    updateGenFilterBtn();
    applyFilters();
  });

  stageFilterBtn.addEventListener("click", () => toggleStagePanel());

  stageOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".gen-option");
    if (!btn) return;
    const stage = Number(btn.dataset.stage);
    if (selectedStages.has(stage)) selectedStages.delete(stage);
    else selectedStages.add(stage);
    renderStageOptionStates();
    updateStageFilterBtn();
    applyFilters();
  });

  stageClearBtn.addEventListener("click", () => {
    selectedStages.clear();
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
    if (selectedHabitats.has(habitat)) selectedHabitats.delete(habitat);
    else selectedHabitats.add(habitat);
    renderHabitatOptionStates();
    updateHabitatFilterBtn();
    applyFilters();
  });

  habitatClearBtn.addEventListener("click", () => {
    selectedHabitats.clear();
    renderHabitatOptionStates();
    updateHabitatFilterBtn();
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
  });

  clearAllBtn.addEventListener("click", () => {
    searchInput.value = "";
    selectedTypes.clear();
    excludedTypes.clear();
    typeMode = "any";
    selectedGens.clear();
    selectedStages.clear();
    selectedEggGroups.clear();
    selectedHabitats.clear();
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
    updateFullyEvolvedToggle();
    toggleTypePanel(false);
    toggleGenPanel(false);
    toggleStagePanel(false);
    toggleEggPanel(false);
    toggleHabitatPanel(false);
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
