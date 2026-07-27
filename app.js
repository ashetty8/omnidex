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
  let fullyEvolvedFilter = "any"; // "any" | "only" (fully evolved) | "exclude" (hide fully evolved)

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

  function formDisplayName(speciesName, form) {
    if (form.isDefault) return speciesName;
    // Forms whose slug already reads naturally (e.g. "greninja-ash" -> "Ash")
    // are templated as "Label Species"; this covers Mega/Gmax/regional forms
    // well and is a reasonable default for everything else too.
    return `${form.label} ${speciesName}`;
  }

  function buildFlatEntries() {
    const entries = [];
    for (const species of allPokemon) {
      const speciesName = species.speciesName.replace(/-/g, " ");
      for (const form of species.forms) {
        entries.push({
          speciesId: species.id,
          formSlug: form.slug,
          isDefault: form.isDefault,
          label: form.label,
          name: formDisplayName(speciesName, form),
          types: form.types,
          sprite: form.sprite,
          generation: form.generation,
          evolutionStage: species.evolutionStage,
          fullyEvolved: species.fullyEvolved,
          dexNumber: species.id,
        });
      }
    }
    return entries;
  }

  function renderGrid() {
    grid.innerHTML = filtered
      .map(
        (e) => `
      <div class="card" data-species="${e.speciesId}" data-form="${e.formSlug}">
        <span class="dex-number">${dexNumber(e.dexNumber)}</span>
        ${!e.isDefault ? `<span class="form-badge">${e.label}</span>` : ""}
        <img loading="lazy" src="${e.sprite}" alt="${e.name}" />
        <div class="name">${e.name}</div>
        <div class="types">${e.types.map(typeBadge).join("")}</div>
      </div>`,
      )
      .join("");

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
      fullyEvolvedFilter !== "any";

    filtered = flatEntries.filter((e) => {
      if (!active) return e.isDefault;
      if (!matchesSelectedTypes(e.types)) return false;
      if (selectedGens.size > 0 && !selectedGens.has(e.generation)) return false;
      if (selectedStages.size > 0 && !selectedStages.has(e.evolutionStage)) return false;
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
    flatEntries.forEach((e) => {
      e.types.forEach((t) => types.add(t));
      gens.add(e.generation);
      stages.add(e.evolutionStage);
    });

    typeOptions.innerHTML = [...types]
      .sort()
      .map(
        (t) =>
          `<button class="type-option" data-type="${t}" type="button" style="--type-color:var(--type-${t})">${t}</button>`,
      )
      .join("");

    genOptions.innerHTML = [...gens]
      .sort((a, b) => a.localeCompare(b))
      .map(
        (g) =>
          `<button class="gen-option" data-gen="${g}" type="button">${GEN_LABELS[g] || g}</button>`,
      )
      .join("");

    stageOptions.innerHTML = [...stages]
      .sort((a, b) => a - b)
      .map((s) => `<button class="gen-option" data-stage="${s}" type="button">Stage ${s}</button>`)
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
    const joiner = typeMode === "all" ? " + " : ", ";
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
    const speciesName = species.speciesName.replace(/-/g, " ");
    return `
      <img src="${form.sprite}" alt="${formDisplayName(speciesName, form)}" />
      <div class="dex-number">${dexNumber(species.id)}</div>
      <div class="name">${formDisplayName(speciesName, form)}</div>
      ${species.genus ? `<div class="genus">${species.genus}</div>` : ""}
      <div class="types">${form.types.map(typeBadge).join("")}</div>
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
      <div class="section-title">Abilities</div>
      <div class="abilities">
        ${form.abilities
          .map(
            (a) =>
              `<span class="ability-badge${a.hidden ? " hidden-ability" : ""}">${a.name.replace(/-/g, " ")}${a.hidden ? " (hidden)" : ""}</span>`,
          )
          .join("")}
      </div>
      <div class="section-title">Base stats</div>
      ${statRow("HP", form.stats.hp)}
      ${statRow("Attack", form.stats.attack)}
      ${statRow("Defense", form.stats.defense)}
      ${statRow("Sp. Atk", form.stats.specialAttack)}
      ${statRow("Sp. Def", form.stats.specialDefense)}
      ${statRow("Speed", form.stats.speed)}
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
  });

  clearAllBtn.addEventListener("click", () => {
    searchInput.value = "";
    selectedTypes.clear();
    excludedTypes.clear();
    typeMode = "any";
    selectedGens.clear();
    selectedStages.clear();
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
    updateFullyEvolvedToggle();
    toggleTypePanel(false);
    toggleGenPanel(false);
    toggleStagePanel(false);
    applyFilters();
  });

  async function init() {
    const res = await fetch("data/pokemon.json");
    allPokemon = await res.json();
    flatEntries = buildFlatEntries();
    populateFilterOptions();
    applyFilters();
  }

  init().catch((err) => {
    grid.innerHTML = `<p style="color:red">Failed to load Pokémon data: ${err.message}</p>`;
    console.error(err);
  });
})();
