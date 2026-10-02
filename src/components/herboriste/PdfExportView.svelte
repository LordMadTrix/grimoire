<script lang="ts">
  import type { Plant, AlchemicalRecipe, Creature } from '$lib/herboriste/types/herb';
  import { BIOMES_METADATA, RARITY_METADATA, FORAGING_RULES } from '$lib/herboriste/data/herbalistData';
  import BotanicalIllustration from './BotanicalIllustration.svelte';

  interface PlayerProfile {
    name: string;
    role: string;
    survieBonus: number; // Sagesse (Survie) pour cueillette
    natureBonus: number; // Intelligence (Nature) pour identification
    toolBonus: number;   // Dextérité (Herboristerie / Alchimie / Dépeçage)
    tools: string;
  }

  interface ChanceInfo {
    label: string;
    color: string;
    bg: string;
    border: string;
    percent: string;
  }

  let {
    plants,
    recipes,
    creatures = [],
    favoritePlantIds = [],
    favoriteCreatureIds = [],
  }: {
    plants: Plant[];
    recipes: AlchemicalRecipe[];
    creatures?: Creature[];
    favoritePlantIds?: string[];
    favoriteCreatureIds?: string[];
    onToggleFavoritePlant?: (id: string) => void;
  } = $props();

  function loadPlayerProfile(): PlayerProfile {
    try {
      const saved = localStorage.getItem('dnd_herbalist_player_profile');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading player profile', e);
    }
    return {
      name: 'Eldrin Feuille-d\'Argent',
      role: 'Rôdeur Sylvestre (Niv. 4)',
      survieBonus: 5,
      natureBonus: 3,
      toolBonus: 4,
      tools: 'Trousse d\'Herboristerie, Matériel d\'Alchimie',
    };
  }

  // Mode selection: 'pocket_booklet' (Livret de poche personnalisé) or 'full_grimoire' (Grand grimoire complet)
  let exportMode = $state<'pocket_booklet' | 'full_grimoire'>('pocket_booklet');

  // Player skill profile (persisted in localStorage)
  let playerProfile = $state<PlayerProfile>(loadPlayerProfile());

  let showProfileEditor = $state<boolean>(true);

  // Print settings
  let printTheme = $state<'parchment' | 'light'>('parchment');
  let includeCover = $state<boolean>(true);
  let includeRules = $state<boolean>(true);
  let includeHerbarium = $state<boolean>(true);
  let includeRecipes = $state<boolean>(true);
  let includeCreatures = $state<boolean>(true);
  let includeGems = $state<boolean>(false); // off by default in pocket booklet
  let selectedBiomeFilter = $state<string>('all');
  let maxDcFilter = $state<number>(0); // 0 = no filter

  let isGeneratingPdf = $state(false);
  let pdfProgress = $state<string>('');

  let printContainer = $state<HTMLDivElement | null>(null);

  // Save profile to localStorage when changed
  $effect(() => {
    try {
      localStorage.setItem('dnd_herbalist_player_profile', JSON.stringify(playerProfile));
    } catch (e) {
      console.error('Error saving player profile', e);
    }
  });

  // Determine active plants according to export mode and favorites
  const effectiveFavoritePlantIds = $derived(
    favoritePlantIds.length > 0
      ? favoritePlantIds
      : ['athelas', 'lotus_dor', 'fleur_de_lune', 'racine_de_givrecoeur', 'mousse_phosphorescente']
  );

  const targetPlants = $derived(
    exportMode === 'pocket_booklet'
      ? plants.filter((p) => effectiveFavoritePlantIds.includes(p.id))
      : plants
  );

  // Filter by biome and/or player skill DC
  const filteredPlantsForPdf = $derived(
    targetPlants.filter((p) => {
      const matchBiome = selectedBiomeFilter === 'all' || p.biome === selectedBiomeFilter;
      const matchDc = maxDcFilter === 0 || p.dcHarvest <= maxDcFilter;
      return matchBiome && matchDc;
    })
  );

  // Group plants 2 per A4 page for optimal readable layout
  const plantPairs = $derived.by(() => {
    const pairs: Plant[][] = [];
    for (let i = 0; i < filteredPlantsForPdf.length; i += 2) {
      pairs.push(filteredPlantsForPdf.slice(i, i + 2));
    }
    return pairs;
  });

  // Target recipes: in pocket mode, recipes utilizing the player's plants
  const targetRecipes = $derived(
    exportMode === 'pocket_booklet'
      ? recipes.filter((r) =>
          r.ingredients.some((ing) =>
            filteredPlantsForPdf.some((p) =>
              p.name.toLowerCase().includes(ing.plantName.toLowerCase())
            )
          )
        )
      : recipes
  );

  // Target creatures: in pocket mode, favorited creatures
  const targetCreatures = $derived(
    exportMode === 'pocket_booklet'
      ? creatures.filter((c) => favoriteCreatureIds.includes(c.id))
      : creatures
  );

  // Deterministic page numbering (cover page is unnumbered)
  const rulesPageNumber = 1;
  const herbariumStartPage = $derived(rulesPageNumber + (includeRules ? 1 : 0));
  const creaturesPageNumber = $derived(
    herbariumStartPage + (includeHerbarium ? plantPairs.length : 0)
  );
  const recipesPageNumber = $derived(
    creaturesPageNumber + (includeCreatures && targetCreatures.length > 0 ? 1 : 0)
  );

  // Native high-resolution browser print
  function handleNativePrint() {
    window.print();
  }

  // Direct jsPDF generation (dynamic imports to keep the main bundle light)
  async function handleDirectPdfDownload() {
    if (!printContainer) return;
    isGeneratingPdf = true;
    pdfProgress = 'Préparation du livret pour la gravure PDF...';

    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pages = printContainer.querySelectorAll<HTMLElement>('.pdf-page');

      for (let i = 0; i < pages.length; i++) {
        pdfProgress = `Rendu de la page ${i + 1} sur ${pages.length}...`;
        const pageEl = pages[i];

        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: printTheme === 'parchment' ? '#f7f2e7' : '#ffffff',
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }

      pdfProgress = 'Finalisation du fichier PDF...';
      const fileName =
        exportMode === 'pocket_booklet'
          ? `Livret-Poche-${playerProfile.name.replace(/\s+/g, '_')}.pdf`
          : 'Grimoire-Herboriste-Complet.pdf';
      pdf.save(fileName);
    } catch (err) {
      console.error('Erreur de génération PDF:', err);
      window.print();
    } finally {
      isGeneratingPdf = false;
      pdfProgress = '';
    }
  }

  // Quick helper to calculate player chance for a DC
  function calculatePlayerChances(dc: number, bonus: number): ChanceInfo {
    const neededOnD20 = dc - bonus;
    if (neededOnD20 <= 1) {
      return { label: 'Quasi-automatique (dès 2+)', color: '#16a34a', bg: '#f0fdf4', border: '#86efac', percent: '95%' };
    }
    if (neededOnD20 <= 10) {
      return { label: `Accessible (${neededOnD20}+ au d20)`, color: '#047857', bg: '#ecfdf5', border: '#6ee7b7', percent: `${(21 - neededOnD20) * 5}%` };
    }
    if (neededOnD20 <= 15) {
      return { label: `Défi Modéré (${neededOnD20}+ au d20)`, color: '#b45309', bg: '#fffbeb', border: '#fcd34d', percent: `${(21 - neededOnD20) * 5}%` };
    }
    return { label: `Périlleux (${Math.min(20, neededOnD20)}+ au d20)`, color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5', percent: `${Math.max(5, (21 - Math.min(20, neededOnD20)) * 5)}%` };
  }
</script>

<div class="pev-root">
  <!-- ============================================================== -->
  <!-- TOP CONFIGURATION BANNER (Excluded from print)                  -->
  <!-- ============================================================== -->
  <div class="config-banner no-print">
    <!-- Main Header & Mode Switcher -->
    <div class="banner-header">
      <div>
        <div class="banner-kicker-row">
          <span class="banner-kicker">Impression & Export Haute Résolution A4</span>
        </div>
        <h2 class="banner-title">
          <span>📄</span>
          {exportMode === 'pocket_booklet'
            ? `Livret de Poche de ${playerProfile.name}`
            : "Grand Grimoire d'Étude Complet"}
        </h2>
        <p class="banner-subtitle">
          {exportMode === 'pocket_booklet'
            ? 'Export compact calibré uniquement avec vos fiches favorites et vos bonus de dés réels.'
            : "Grimoire encyclopédique de référence avec l'ensemble des planches botaniques et règles complètes."}
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="banner-actions">
        <button class="print-btn" onclick={handleNativePrint}>
          <span>🖨️</span>
          <span>Imprimer mon Livret (A4)</span>
        </button>

        <button class="download-btn" onclick={handleDirectPdfDownload} disabled={isGeneratingPdf}>
          <span>⬇️</span>
          <span>{isGeneratingPdf ? 'Génération...' : 'Télécharger (.PDF)'}</span>
        </button>
      </div>
    </div>

    <!-- Progress indicator -->
    {#if isGeneratingPdf}
      <div class="progress-banner">
        <span>✨</span>
        <span>{pdfProgress}</span>
      </div>
    {/if}

    <!-- Preset Selector: Livret de Poche vs Grand Grimoire -->
    <div class="mode-grid">
      <button
        class="mode-card"
        class:mode-card-active={exportMode === 'pocket_booklet'}
        onclick={() => {
          exportMode = 'pocket_booklet';
          includeGems = false;
          includeRules = false;
        }}
      >
        <span class="mode-icon">{exportMode === 'pocket_booklet' ? '❤️' : '🤍'}</span>
        <div>
          <div class="mode-card-title-row">
            <h4 class="mode-card-title">🎒 Mon Livret de Poche Personnalisé</h4>
            <span class="mode-badge mode-badge-pocket">Favoris & Compétences</span>
          </div>
          <p class="mode-card-text">
            Imprime <strong>uniquement vos fiches marquées en favoris</strong> ({filteredPlantsForPdf.length} plantes), avec les jets de dés annotés directement pour votre personnage.
          </p>
        </div>
      </button>

      <button
        class="mode-card"
        class:mode-card-active={exportMode === 'full_grimoire'}
        onclick={() => {
          exportMode = 'full_grimoire';
          includeGems = true;
          includeRules = true;
        }}
      >
        <span class="mode-icon">{exportMode === 'full_grimoire' ? '📖' : '📕'}</span>
        <div>
          <div class="mode-card-title-row">
            <h4 class="mode-card-title">📜 Grand Grimoire d'Étude Complet</h4>
            <span class="mode-badge mode-badge-full">Toutes les 32+ fiches</span>
          </div>
          <p class="mode-card-text">
            Le tome complet pour le Maître du Jeu ou la bibliothèque : totalité des plantes, gemmes, règles détaillées et tables d20.
          </p>
        </div>
      </button>
    </div>

    <!-- Player Profile & Skills Configuration Box -->
    <div class="profile-box">
      <div class="profile-header">
        <h4 class="profile-title">
          <span>👤</span>
          Profil & Compétences du Joueur (Annotées sur chaque fiche du livret)
        </h4>
        <button class="profile-toggle" onclick={() => (showProfileEditor = !showProfileEditor)}>
          <span>🎚️</span>
          <span>{showProfileEditor ? 'Masquer' : 'Modifier les compétences'}</span>
        </button>
      </div>

      {#if showProfileEditor}
        <div class="profile-grid">
          <div>
            <label class="profile-label" for="pev-name">Nom de l'Aventurier / PJ</label>
            <input id="pev-name" type="text" bind:value={playerProfile.name} />
          </div>

          <div>
            <label class="profile-label" for="pev-role">Classe, Ordre ou Titre</label>
            <input id="pev-role" type="text" bind:value={playerProfile.role} />
          </div>

          <div>
            <label class="profile-label" for="pev-survie">
              Bonus Sagesse (Survie) : <strong class="profile-strong">+{playerProfile.survieBonus}</strong>
            </label>
            <div class="range-row">
              <input id="pev-survie" type="range" min="0" max="15" bind:value={playerProfile.survieBonus} />
              <span class="range-value">+{playerProfile.survieBonus}</span>
            </div>
          </div>

          <div>
            <label class="profile-label" for="pev-tool">
              Bonus Trousse d'Herboristerie : <strong class="profile-strong">+{playerProfile.toolBonus}</strong>
            </label>
            <div class="range-row">
              <input id="pev-tool" type="range" min="0" max="15" bind:value={playerProfile.toolBonus} />
              <span class="range-value">+{playerProfile.toolBonus}</span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Quick Skill-based Filtering Button -->
      <div class="skill-filter-row">
        <div class="skill-filter-left">
          <span class="skill-filter-label">Filtre selon mon niveau :</span>
          <button
            class="skill-filter-btn"
            class:skill-filter-btn-active={maxDcFilter > 0}
            onclick={() => (maxDcFilter = maxDcFilter === 0 ? playerProfile.survieBonus + 10 : 0)}
          >
            {maxDcFilter > 0
              ? `Seulement plantes accessibles (DD ≤ ${playerProfile.survieBonus + 10})`
              : `Filtrer les plantes à ma portée (DD ≤ ${playerProfile.survieBonus + 10})`}
          </button>
        </div>

        <div class="plants-ready-count">
          {filteredPlantsForPdf.length} plante(s) prête(s) pour l'impression
        </div>
      </div>
    </div>

    <!-- Fine-tuning Checkboxes & Options -->
    <div class="options-row">
      <div class="options-group">
        <span class="options-label">Thème Papier :</span>
        <label class="option-item">
          <input type="radio" name="printTheme" checked={printTheme === 'parchment'} onchange={() => (printTheme = 'parchment')} />
          <span>Parchemin Enluminé</span>
        </label>
        <label class="option-item">
          <input type="radio" name="printTheme" checked={printTheme === 'light'} onchange={() => (printTheme = 'light')} />
          <span>Blanc Pur (Économique)</span>
        </label>
      </div>

      <div class="options-group">
        <span class="options-label">Sections du Livret :</span>
        <label class="option-item">
          <input type="checkbox" bind:checked={includeCover} />
          <span>Page de Couverture</span>
        </label>
        <label class="option-item">
          <input type="checkbox" bind:checked={includeHerbarium} />
          <span>Planches Botaniques ({filteredPlantsForPdf.length})</span>
        </label>
        <label class="option-item">
          <input type="checkbox" bind:checked={includeRecipes} />
          <span>Recettes Alchimiques ({targetRecipes.length})</span>
        </label>
        {#if targetCreatures.length > 0}
          <label class="option-item">
            <input type="checkbox" bind:checked={includeCreatures} />
            <span>Bestiaire ({targetCreatures.length})</span>
          </label>
        {/if}
        <label class="option-item">
          <input type="checkbox" bind:checked={includeRules} />
          <span>Règles D&D 5e</span>
        </label>
      </div>
    </div>
  </div>

  <!-- ============================================================== -->
  <!-- THE PRINTABLE A4 PAGES CONTAINER                               -->
  <!-- ============================================================== -->
  <div class="print-container" bind:this={printContainer}>
    <!-- ================= PAGE 1: COVER PAGE ================= -->
    {#if includeCover}
      <div
        class="pdf-page"
        class:pdf-page-light={printTheme === 'light'}
        style:box-sizing="border-box"
      >
        <!-- Ornamental Frame Border -->
        <div class="frame-outer"></div>
        <div class="frame-inner"></div>
        <!-- Corner ornaments -->
        <div class="cover-corner cover-corner-tl"></div>
        <div class="cover-corner cover-corner-tr"></div>
        <div class="cover-corner cover-corner-bl"></div>
        <div class="cover-corner cover-corner-br"></div>

        <!-- Top Header -->
        <div class="cover-top">
          <div class="cover-kicker">
            {exportMode === 'pocket_booklet'
              ? 'Aide de Terrain Personnalisée · Donjons & Dragons 5e'
              : 'Aide de Jeu Officieuse pour Jeux de Rôle Médiévaux-Fantastiques & D&D 5e'}
          </div>
          <h1 class="cover-heading">
            {exportMode === 'pocket_booklet' ? "LIVRET DE POCHE DE L'HERBORISTE" : "GUIDE DE L'HERBORISTE"}
          </h1>
          <div class="cover-rule"></div>
          <p class="cover-tagline">
            {exportMode === 'pocket_booklet'
              ? `Recueil de Terrain Spécifique & Fiches Favorites préparées pour ${playerProfile.name}`
              : 'Traité Botanique des Plantes Médicinales, Vénéneuses & Arcaniques'}
          </p>
        </div>

        <!-- Central Art & Character Sheet Badge -->
        {#if exportMode === 'pocket_booklet'}
          <div class="pocket-center">
            <!-- Character Sheet Banner -->
            <div class="character-banner">
              <div class="character-header">
                <div>
                  <span class="character-kicker">Aventurier Titulaire</span>
                  <h3 class="character-name">{playerProfile.name}</h3>
                  <span class="character-role">{playerProfile.role}</span>
                </div>
                <div class="character-avatar">👤</div>
              </div>

              <!-- Skills Grid -->
              <div class="skills-grid">
                <div class="skill-cell">
                  <span class="skill-label">Survie (Cueillette)</span>
                  <span class="skill-bonus">+{playerProfile.survieBonus}</span>
                  <span class="skill-note">d20 + {playerProfile.survieBonus}</span>
                </div>

                <div class="skill-cell">
                  <span class="skill-label">Nature (Botanique)</span>
                  <span class="skill-bonus">+{playerProfile.natureBonus}</span>
                  <span class="skill-note">d20 + {playerProfile.natureBonus}</span>
                </div>

                <div class="skill-cell">
                  <span class="skill-label">Trousse Herboristerie</span>
                  <span class="skill-bonus">+{playerProfile.toolBonus}</span>
                  <span class="skill-note">Incision / Alchimie</span>
                </div>
              </div>

              <!-- Quick Roll Threshold Table for Player -->
              <div class="threshold-table">
                <div class="threshold-title">
                  Barème de Récolte avec votre Bonus (+{playerProfile.survieBonus}) :
                </div>
                <div class="threshold-row">
                  <span>Dé ≤ {Math.max(1, 9 - playerProfile.survieBonus)} (Total 1-9) :</span>
                  <span class="threshold-fail">Recherche infructueuse</span>
                </div>
                <div class="threshold-row">
                  <span>Dé {Math.max(1, 10 - playerProfile.survieBonus)} à {14 - playerProfile.survieBonus} (Total 10-14) :</span>
                  <span class="threshold-common">Plantes Communes trouvées</span>
                </div>
                <div class="threshold-row">
                  <span>Dé {Math.max(1, 15 - playerProfile.survieBonus)} à {19 - playerProfile.survieBonus} (Total 15-19) :</span>
                  <span class="threshold-rare">Plantes Rares trouvées</span>
                </div>
                <div class="threshold-row">
                  <span>Dé {Math.max(1, 20 - playerProfile.survieBonus)}+ (Total 20+) :</span>
                  <span class="threshold-epic">Plantes Très Rares & Floraison Majeure</span>
                </div>
              </div>
            </div>

            <!-- Favorite Plants Summary in Pocket Booklet -->
            <div class="favorites-summary">
              <div class="favorites-title">
                Fiches Favorites Sélectionnées pour cette Expédition ({filteredPlantsForPdf.length}) :
              </div>
              <div class="favorites-chips">
                {#each filteredPlantsForPdf as p (p.id)}
                  <span class="favorite-chip">
                    🌿 {p.name} (DD {p.dcHarvest})
                  </span>
                {/each}
              </div>
            </div>
          </div>
        {:else}
          <!-- Full Grimoire Central Art -->
          <div class="grimoire-center">
            <div class="grimoire-art">
              {#if plants[0]}
                <BotanicalIllustration
                  plant={plants[0]}
                  size="lg"
                  showPlateDetails={false}
                  class="grimoire-illustration"
                />
              {/if}
            </div>
          </div>
        {/if}

        <!-- Bottom Colophon -->
        <div class="colophon">
          <p class="colophon-title">
            {exportMode === 'pocket_booklet' ? 'Édition Personnalisée de Poche' : 'Volume Complet de Consultation'}
          </p>
          <p class="colophon-note">
            Compilé d'après les manuscrits des druides de Fangh · Règles de cueillette compatibles 5e édition
          </p>
        </div>
      </div>
    {/if}

    <!-- ================= OPTIONAL PAGE: RULES & CONVERSION ================= -->
    {#if includeRules}
      <div
        class="pdf-page"
        class:pdf-page-light={printTheme === 'light'}
        style:box-sizing="border-box"
      >
        <div>
          <div class="page-running-header">
            <span>Le Guide de l'Herboriste</span>
            <span>Règles de Cueillette & Mécaniques</span>
          </div>

          <div class="pdf-section-header">
            <h2 class="pdf-section-title">Règles de Cueillette & Préparation</h2>
            <div class="pdf-section-rule"></div>
          </div>

          <div class="rules-cols">
            <div>
              <h3 class="pdf-subtitle">Mécaniques de Jeu (D&D 5e)</h3>
              <p class="rules-intro">
                Lors d'une halte ou d'un voyage en milieu naturel, le joueur peut déclarer une séance de cueillette :
              </p>
              <ul class="rules-bullets">
                <li><strong>Recherche Rapide (1h) :</strong> 1 seul jet avec malus de -2.</li>
                <li><strong>Recherche Approfondie (4h) :</strong> Jet normal sans pénalité.</li>
                <li><strong>Jet de Compétence :</strong> Test de Sagesse (Survie) ou d'Intelligence (Nature) + Maîtrise d'outils.</li>
              </ul>
            </div>

            <div>
              <h3 class="pdf-subtitle">Table des Degrés de Difficulté (DD)</h3>
              <div class="pdf-dd-table">
                {#each FORAGING_RULES.difficultyTable as d, i (i)}
                  <div class="pdf-dd-row">
                    <strong class="pdf-dd-dc">{d.dc}</strong>
                    <span>{d.result}</span>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>

        <div class="page-footer-row">
          <span>Le Guide de l'Herboriste</span>
          <span>— Page {rulesPageNumber} —</span>
        </div>
      </div>
    {/if}

    <!-- ================= THE HERBARIUM ENTRIES (FAVORITES OR ALL) ================= -->
    {#if includeHerbarium}
      {#each plantPairs as pair, pageIdx (pageIdx)}
        <div
          class="pdf-page"
          class:pdf-page-light={printTheme === 'light'}
          style:box-sizing="border-box"
        >
          <div>
            <div class="page-running-header">
              <span>{exportMode === 'pocket_booklet' ? `Livret de Poche · ${playerProfile.name}` : "Le Guide de l'Herboriste"}</span>
              <span>{exportMode === 'pocket_booklet' ? 'Fiches Favorites de Terrain' : `Chapitre II : L'Herbier Illustré (Planches ${pageIdx * 2 + 1} & ${pageIdx * 2 + 2})`}</span>
            </div>

            <!-- Two Plant Cards Stacked Vertically on this A4 Page -->
            <div class="herbarium-stack">
              {#each pair as plant (plant.id)}
                {@const biomeInfo = BIOMES_METADATA[plant.biome]}
                {@const rarityInfo = RARITY_METADATA[plant.rarity]}
                {@const chanceInfo = calculatePlayerChances(plant.dcHarvest, playerProfile.survieBonus)}
                <div class="plant-sheet page-break-avoid">
                  <!-- Plant Header -->
                  <div class="sheet-header">
                    <div>
                      <div class="sheet-name-row">
                        <h3 class="sheet-name">{plant.name}</h3>
                        <span
                          class="sheet-rarity"
                          style:color={rarityInfo.color}
                          style:border-color={rarityInfo.border}
                          style:background-color={rarityInfo.bg}
                        >
                          {rarityInfo.label}
                        </span>
                      </div>
                      <div class="sheet-latin">{plant.latinName}</div>
                    </div>

                    <div class="sheet-biome">
                      <span class="sheet-biome-label">{biomeInfo?.label || plant.biome}</span>
                      <span class="sheet-season">Saison : {plant.season}</span>
                    </div>
                  </div>

                  <!-- Plant Body Layout: Left Illustration, Right Botanical & Game Data -->
                  <div class="sheet-body">
                    <BotanicalIllustration
                      plant={plant}
                      size="print"
                      class="sheet-illustration"
                    />

                    <div class="sheet-data">
                      <!-- Player Personalized Skill Check Badge -->
                      <div
                        class="chance-badge"
                        style:background-color={chanceInfo.bg}
                        style:border-color={chanceInfo.border}
                      >
                        <div>
                          <span class="chance-roll-label">🎲 Jet pour {playerProfile.name} :</span>
                          <span class="chance-roll-formula">
                            d20 + {playerProfile.survieBonus} (Survie) vs DD {plant.dcHarvest}
                          </span>
                        </div>
                        <div class="chance-right">
                          <span class="chance-label" style:color={chanceInfo.color}>{chanceInfo.label}</span>
                          <span class="chance-percent">
                            Chances de réussite : <strong>{chanceInfo.percent}</strong>
                          </span>
                        </div>
                      </div>

                      <!-- Botanical Details -->
                      <div class="botanical-details">
                        <div>
                          <span class="detail-label">Parties : </span>
                          <span>{plant.partsUsed}</span>
                        </div>
                        <div>
                          <span class="detail-label">Préparation : </span>
                          <span>{plant.preparationMethod} ({plant.preparationTime})</span>
                        </div>
                      </div>

                      <!-- Medicinal & Game Effects -->
                      <div class="sheet-effects">
                        <span class="sheet-effects-title">Effets Thérapeutiques & Magiques :</span>
                        {#each plant.gameEffects as eff, i (i)}
                          <div class="sheet-effect">
                            <strong class="sheet-effect-title">{eff.title} : </strong>
                            <span>{eff.description}</span>
                          </div>
                        {/each}
                      </div>

                      <!-- Toxicity warning if any -->
                      {#if plant.toxicityWarning}
                        <div class="sheet-toxicity">
                          <span class="sheet-toxicity-icon">⚠️</span>
                          <span><strong>Toxicité : </strong>{plant.toxicityWarning}</span>
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Page Footer -->
          <div class="page-footer-row">
            <span>{exportMode === 'pocket_booklet' ? `Livret de Poche · ${playerProfile.name}` : "Le Guide de l'Herboriste"}</span>
            <span>— Page {herbariumStartPage + pageIdx} —</span>
          </div>
        </div>
      {/each}
    {/if}

    <!-- ================= OPTIONAL PAGE: CREATURES / BESTIARY FAVORITES ================= -->
    {#if includeCreatures && targetCreatures.length > 0}
      <div
        class="pdf-page"
        class:pdf-page-light={printTheme === 'light'}
        style:box-sizing="border-box"
      >
        <div>
          <div class="page-running-header">
            <span>{exportMode === 'pocket_booklet' ? `Livret de Poche · ${playerProfile.name}` : "Le Guide de l'Herboriste"}</span>
            <span>Bestiaire & Anatomie de Dépeçage</span>
          </div>

          <div class="pdf-section-header">
            <h2 class="pdf-section-title">Composants de Monstres & Dépeçage</h2>
            <div class="pdf-section-rule"></div>
          </div>

          <div class="creature-stack">
            {#each targetCreatures.slice(0, 2) as creature (creature.id)}
              <div class="creature-card">
                <div class="creature-header">
                  <div>
                    <h3 class="creature-name">🐉 {creature.name}</h3>
                    <span class="creature-meta">
                      {creature.category} · Facteur de Puissance FP {creature.challengeRating}
                    </span>
                  </div>
                  <span class="creature-incision">Incision : d20 + {playerProfile.toolBonus}</span>
                </div>

                <div class="components-grid">
                  {#each creature.components as comp (comp.id)}
                    {@const harvestChance = calculatePlayerChances(comp.harvestDC, playerProfile.toolBonus)}
                    <div class="component-card">
                      <div class="component-header">
                        <strong class="component-name">{comp.name}</strong>
                        <span class="component-value">{comp.marketValue}</span>
                      </div>
                      <div class="component-dc">
                        DD Récolte : <strong>DD {comp.harvestDC} ({comp.harvestSkill})</strong>
                      </div>
                      <div class="component-chance" style:color={harvestChance.color}>
                        Jet PJ : d20 + {playerProfile.toolBonus} ({harvestChance.label})
                      </div>
                      <p class="component-props">{comp.alchemicalProperties}</p>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>

        <div class="page-footer-row">
          <span>Bestiaire & Dépeçage</span>
          <span>— Page {creaturesPageNumber} —</span>
        </div>
      </div>
    {/if}

    <!-- ================= OPTIONAL PAGE: ALCHEMICAL RECIPES ================= -->
    {#if includeRecipes && targetRecipes.length > 0}
      <div
        class="pdf-page"
        class:pdf-page-light={printTheme === 'light'}
        style:box-sizing="border-box"
      >
        <div>
          <div class="page-running-header">
            <span>{exportMode === 'pocket_booklet' ? `Livret de Poche · ${playerProfile.name}` : "Le Guide de l'Herboriste"}</span>
            <span>Recettes & Concoctions Alchimiques</span>
          </div>

          <div class="pdf-section-header">
            <h2 class="pdf-section-title">
              {exportMode === 'pocket_booklet'
                ? 'Recettes Alchimiques Réalisables avec vos Herbes'
                : 'Recettes Alchimiques du Grimoire'}
            </h2>
            <div class="pdf-section-rule"></div>
          </div>

          <div class="pdf-recipes-grid">
            {#each targetRecipes.slice(0, 6) as recipe (recipe.id)}
              {@const alchemyChance = calculatePlayerChances(recipe.difficultyDC, playerProfile.toolBonus)}
              <div class="pdf-recipe-card">
                <div class="pdf-recipe-header">
                  <div>
                    <strong class="pdf-recipe-name">{recipe.name}</strong>
                    <span class="pdf-recipe-category">{recipe.category}</span>
                  </div>
                  <span class="pdf-recipe-dc">DD {recipe.difficultyDC}</span>
                </div>

                <div
                  class="pdf-recipe-chance"
                  style:background-color={alchemyChance.bg}
                  style:border-color={alchemyChance.border}
                >
                  <span class="pdf-recipe-roll">Jet : <strong>d20 + {playerProfile.toolBonus}</strong></span>
                  <span class="pdf-recipe-percent" style:color={alchemyChance.color}>{alchemyChance.percent} succès</span>
                </div>

                <div class="pdf-recipe-ingredients">
                  <strong>Ingrédients : </strong>
                  <span>{recipe.ingredients.map((ing) => `${ing.quantity}x ${ing.plantName}`).join(', ')}</span>
                </div>

                <p class="pdf-recipe-effect">{recipe.effect}</p>
              </div>
            {/each}
          </div>
        </div>

        <div class="page-footer-row">
          <span>Recettes Alchimiques</span>
          <span>— Page {recipesPageNumber} —</span>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .pev-root {
    min-height: 100vh;
    padding: 2rem 1rem;
  }

  /* ===== Configuration banner ===== */
  .config-banner {
    max-width: 64rem;
    margin: 0 auto 2rem;
    background: #241c16;
    border-radius: 0.75rem;
    border: 2px solid rgba(212, 175, 55, 0.6);
    padding: 1.5rem;
    color: #f4ecd8;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }

  .config-banner > * {
    margin-bottom: 1.5rem;
  }

  .config-banner > *:last-child {
    margin-bottom: 0;
  }

  .banner-header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #4d3a2e;
  }

  @media (min-width: 768px) {
    .banner-header {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }

  .banner-kicker-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .banner-kicker {
    font-size: 10px;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: #451a03;
    color: #fcd34d;
    border: 1px solid rgba(217, 119, 6, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-family: ui-monospace, monospace;
  }

  .banner-title {
    font-size: 1.875rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    color: #fde047;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }

  .banner-subtitle {
    font-size: 0.75rem;
    color: #c4b5a5;
    font-style: italic;
    font-family: Georgia, 'Times New Roman', serif;
    margin: 0.25rem 0 0;
  }

  .banner-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }

  .print-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: #b45309;
    color: #ffffff;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    font-size: 0.875rem;
    border-radius: 0.25rem;
    border: none;
    cursor: pointer;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
    transition: background 150ms;
  }

  .print-btn:hover {
    background: #d97706;
  }

  .download-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: #3b271b;
    color: #fef08a;
    border: 1px solid rgba(212, 175, 55, 0.6);
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    font-size: 0.875rem;
    border-radius: 0.25rem;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    transition: background 150ms;
  }

  .download-btn:hover:not(:disabled) {
    background: #4a3424;
  }

  .download-btn:disabled {
    opacity: 0.5;
  }

  .progress-banner {
    padding: 0.75rem;
    background: #451a03;
    border-radius: 0.25rem;
    border: 1px solid #f59e0b;
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
    color: #fef08a;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    animation: pev-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pev-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* ===== Mode selector ===== */
  .mode-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  @media (min-width: 640px) {
    .mode-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .mode-card {
    padding: 1rem;
    border-radius: 0.75rem;
    border: 2px solid #3e2e23;
    background: #181310;
    text-align: left;
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    cursor: pointer;
    transition: border-color 150ms, background 150ms;
    color: inherit;
    font: inherit;
  }

  .mode-card:hover {
    border-color: #854d0e;
  }

  .mode-card-active {
    background: #3d2719;
    border-color: #d4af37;
    box-shadow: 0 0 0 1px #d4af37, 0 10px 15px -3px rgba(0, 0, 0, 0.3);
  }

  .mode-icon {
    font-size: 1.4rem;
    flex-shrink: 0;
    margin-top: 0.25rem;
  }

  .mode-card-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .mode-card-title {
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    font-size: 0.875rem;
    color: #fef08a;
    margin: 0;
  }

  .mode-badge {
    font-size: 10px;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: ui-monospace, monospace;
    font-weight: 700;
  }

  .mode-badge-pocket {
    background: #451a03;
    color: #fcd34d;
  }

  .mode-badge-full {
    background: #1e293b;
    color: #38bdf8;
  }

  .mode-card-text {
    font-size: 0.75rem;
    color: #c4b5a5;
    font-style: italic;
    margin: 0.25rem 0 0;
    line-height: 1.625;
  }

  /* ===== Player profile box ===== */
  .profile-box {
    background: #181310;
    border-radius: 0.75rem;
    border: 1px solid #4a392d;
    padding: 1rem;
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
  }

  .profile-box > * {
    margin-bottom: 1rem;
  }

  .profile-box > *:last-child {
    margin-bottom: 0;
  }

  .profile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #3e2e23;
    padding-bottom: 0.5rem;
  }

  .profile-title {
    font-weight: 700;
    font-size: 0.875rem;
    color: #fde047;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }

  .profile-toggle {
    color: #a89988;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 11px;
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
  }

  .profile-toggle:hover {
    color: #fde047;
  }

  .profile-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
    padding-top: 0.25rem;
  }

  @media (min-width: 640px) {
    .profile-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .profile-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .profile-label {
    display: block;
    color: #a89988;
    margin-bottom: 0.25rem;
  }

  .profile-strong {
    color: #fde047;
  }

  .profile-grid input[type='text'] {
    width: 100%;
    background: #120e0b;
    border: 1px solid #524136;
    border-radius: 0.25rem;
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
    color: #f5ecd7;
    outline: none;
  }

  .profile-grid input[type='text']:focus {
    border-color: #d4af37;
  }

  .range-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .range-row input[type='range'] {
    flex: 1;
    accent-color: #d4af37;
  }

  .range-value {
    font-family: ui-monospace, monospace;
    font-weight: 700;
    color: #fde047;
    width: 1.5rem;
    text-align: right;
  }

  .skill-filter-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid #2e2118;
  }

  .skill-filter-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .skill-filter-label {
    color: #a89988;
  }

  .skill-filter-btn {
    padding: 0.25rem 0.625rem;
    border-radius: 0.25rem;
    font-size: 11px;
    font-family: Georgia, 'Times New Roman', serif;
    border: 1px solid #524136;
    background: #120e0b;
    color: #c4b5a5;
    cursor: pointer;
    transition: border-color 150ms, background 150ms;
  }

  .skill-filter-btn:hover {
    border-color: #854d0e;
  }

  .skill-filter-btn-active {
    background: #854d0e;
    color: #ffffff;
    border-color: #fde047;
    font-weight: 700;
  }

  .plants-ready-count {
    font-size: 11px;
    color: #fcd34d;
  }

  /* ===== Options row ===== */
  .options-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
    color: #c4b5a5;
    padding-top: 0.25rem;
  }

  .options-group {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .options-label {
    color: #fde047;
    font-weight: 700;
  }

  .option-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    cursor: pointer;
  }

  .option-item input {
    accent-color: #d4af37;
  }

  /* ===== Print container & pages ===== */
  .print-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
  }

  .pdf-page {
    position: relative;
    width: 210mm;
    min-height: 297mm;
    padding: 16mm;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: #f7f2e7;
    color: #2c1810;
  }

  .pdf-page-light {
    background: #ffffff;
    color: #000000;
  }

  .frame-outer {
    position: absolute;
    inset: 10mm;
    border: 2px solid #854d0e;
    pointer-events: none;
  }

  .frame-inner {
    position: absolute;
    inset: 12mm;
    border: 1px solid rgba(133, 77, 14, 0.4);
    pointer-events: none;
  }

  .cover-corner {
    position: absolute;
    width: 1.5rem;
    height: 1.5rem;
  }

  .cover-corner-tl { top: 10mm; left: 10mm; border-top: 4px solid #854d0e; border-left: 4px solid #854d0e; }
  .cover-corner-tr { top: 10mm; right: 10mm; border-top: 4px solid #854d0e; border-right: 4px solid #854d0e; }
  .cover-corner-bl { bottom: 10mm; left: 10mm; border-bottom: 4px solid #854d0e; border-left: 4px solid #854d0e; }
  .cover-corner-br { bottom: 10mm; right: 10mm; border-bottom: 4px solid #854d0e; border-right: 4px solid #854d0e; }

  /* ===== Cover page ===== */
  .cover-top {
    text-align: center;
    padding-top: 1.5rem;
  }

  .cover-kicker {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.3em;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    color: #854d0e;
    margin-bottom: 0.5rem;
  }

  .cover-heading {
    font-size: 3rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: #3a1d0f;
    line-height: 1.2;
    margin: 0 0 0.5rem;
  }

  .cover-rule {
    width: 10rem;
    height: 4px;
    background: #854d0e;
    margin: 0.75rem auto;
  }

  .cover-tagline {
    font-size: 1rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    color: #633a1e;
    max-width: 32rem;
    margin: 0 auto;
  }

  .pocket-center {
    margin: 1rem 0;
    max-width: 32rem;
    margin-left: auto;
    margin-right: auto;
    width: 100%;
  }

  .pocket-center > * {
    margin-bottom: 1rem;
  }

  .pocket-center > *:last-child {
    margin-bottom: 0;
  }

  .character-banner {
    background: #ede4d1;
    padding: 1rem;
    border-radius: 0.75rem;
    border: 2px solid #854d0e;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    font-family: Georgia, 'Times New Roman', serif;
  }

  .character-banner > * {
    margin-bottom: 0.75rem;
  }

  .character-banner > *:last-child {
    margin-bottom: 0;
  }

  .character-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #c4a47c;
    padding-bottom: 0.5rem;
  }

  .character-kicker {
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 700;
    color: #854d0e;
    letter-spacing: 0.1em;
    display: block;
  }

  .character-name {
    font-size: 1.25rem;
    font-weight: 700;
    color: #2d180d;
    margin: 0;
  }

  .character-role {
    font-size: 0.75rem;
    font-style: italic;
    color: #78350f;
  }

  .character-avatar {
    width: 3rem;
    height: 3rem;
    border-radius: 9999px;
    border: 2px solid #854d0e;
    background: #f7f2e7;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    color: #854d0e;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    font-size: 1.4rem;
  }

  .skills-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    text-align: center;
  }

  .skill-cell {
    background: #f7f2e7;
    padding: 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid #c4a47c;
  }

  .skill-label {
    font-size: 10px;
    color: #78350f;
    display: block;
    font-weight: 700;
  }

  .skill-bonus {
    font-size: 1.125rem;
    font-family: ui-monospace, monospace;
    font-weight: 800;
    color: #854d0e;
    display: block;
  }

  .skill-note {
    font-size: 9px;
    color: #a89988;
    display: block;
  }

  .threshold-table {
    background: #fdfbf7;
    padding: 0.625rem;
    border-radius: 0.25rem;
    border: 1px solid #c4a47c;
    font-size: 11px;
  }

  .threshold-table > * {
    margin-bottom: 0.25rem;
  }

  .threshold-table > *:last-child {
    margin-bottom: 0;
  }

  .threshold-title {
    font-weight: 700;
    color: #854d0e;
    font-size: 0.75rem;
    border-bottom: 1px solid #ecd9c2;
    padding-bottom: 0.25rem;
  }

  .threshold-row {
    display: flex;
    justify-content: space-between;
    color: #2d180d;
  }

  .threshold-fail {
    font-style: italic;
    color: #78350f;
  }

  .threshold-common {
    font-weight: 500;
    color: #065f46;
  }

  .threshold-rare {
    font-weight: 500;
    color: #92400e;
  }

  .threshold-epic {
    font-weight: 700;
    color: #854d0e;
  }

  .favorites-summary {
    padding: 0.75rem;
    background: rgba(237, 228, 209, 0.7);
    border-radius: 0.5rem;
    border: 1px solid #c4a47c;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 0.75rem;
  }

  .favorites-title {
    font-weight: 700;
    color: #78350f;
    margin-bottom: 0.25rem;
  }

  .favorites-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    padding-top: 0.25rem;
  }

  .favorite-chip {
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: #f7f2e7;
    border: 1px solid #c4a47c;
    font-size: 10px;
    font-weight: 700;
    color: #3a1d0f;
    cursor: pointer;
    font-family: inherit;
  }

  .grimoire-center {
    margin: 1.5rem 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .grimoire-art {
    padding: 1rem;
    background: #ede4d1;
    border-radius: 1rem;
    border: 4px solid #854d0e;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }

  .grimoire-art :global(.grimoire-illustration) {
    width: 12rem;
    height: 12rem;
  }

  @media (min-width: 640px) {
    .grimoire-art :global(.grimoire-illustration) {
      width: 15rem;
      height: 15rem;
    }
  }

  .colophon {
    text-align: center;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 0.75rem;
    color: #78350f;
    border-top: 2px solid rgba(133, 77, 14, 0.4);
    padding-top: 1rem;
    padding-bottom: 0.5rem;
  }

  .colophon-title {
    font-weight: 700;
    margin: 0 0 0.25rem;
  }

  .colophon-note {
    font-size: 10px;
    color: #8c6747;
    margin: 0;
  }

  /* ===== Shared PDF page elements ===== */
  .page-running-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
    font-family: Georgia, 'Times New Roman', serif;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #78350f;
    border-bottom: 1px solid rgba(133, 77, 14, 0.4);
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
  }

  .pdf-section-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .pdf-section-title {
    font-size: 1.5rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    color: #3a1d0f;
    margin: 0;
  }

  .pdf-section-rule {
    width: 6rem;
    height: 2px;
    background: #854d0e;
    margin: 0.25rem auto 0;
  }

  .page-footer-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
    font-family: Georgia, 'Times New Roman', serif;
    color: #78350f;
    border-top: 1px solid rgba(133, 77, 14, 0.4);
    padding-top: 0.5rem;
  }

  /* ===== Rules page ===== */
  .rules-cols {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
    line-height: 1.625;
  }

  .pdf-subtitle {
    font-weight: 700;
    font-size: 0.875rem;
    color: #78350f;
    margin: 0 0 0.25rem;
    border-bottom: 1px solid #c4a47c;
    padding-bottom: 0.25rem;
    font-family: Georgia, 'Times New Roman', serif;
  }

  .rules-intro {
    margin: 0 0 0.5rem;
  }

  .rules-bullets {
    list-style: disc;
    list-style-position: inside;
    margin: 0 0 0.75rem;
    padding: 0;
    font-size: 11px;
  }

  .rules-bullets li {
    margin-bottom: 0.25rem;
  }

  .pdf-dd-table {
    background: #efe8d8;
    padding: 0.625rem;
    border-radius: 0.25rem;
    border: 1px solid #c4a47c;
    margin-bottom: 0.75rem;
    font-size: 11px;
  }

  .pdf-dd-row {
    display: flex;
    justify-content: space-between;
    border-bottom: 1px solid #e2d5c3;
    padding-bottom: 0.25rem;
    margin-bottom: 0.375rem;
  }

  .pdf-dd-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
    margin-bottom: 0;
  }

  .pdf-dd-dc {
    color: #854d0e;
    font-family: ui-monospace, monospace;
  }

  /* ===== Herbarium sheets ===== */
  .herbarium-stack > * {
    margin-bottom: 1.5rem;
  }

  .herbarium-stack > *:last-child {
    margin-bottom: 0;
  }

  .plant-sheet {
    background: #fbf8f0;
    padding: 1rem;
    border-radius: 0.5rem;
    border: 1px solid #c4a47c;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .page-break-avoid {
    break-inside: avoid;
  }

  .sheet-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid #e2d5c3;
    padding-bottom: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .sheet-name-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sheet-name {
    font-size: 1.25rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    color: #3a1d0f;
    margin: 0;
  }

  .sheet-rarity {
    font-size: 9px;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid;
    white-space: nowrap;
  }

  .sheet-latin {
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    color: #78350f;
  }

  .sheet-biome {
    text-align: right;
  }

  .sheet-biome-label {
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    color: #854d0e;
    display: block;
  }

  .sheet-season {
    font-size: 10px;
    font-family: ui-monospace, monospace;
    color: #78350f;
  }

  .sheet-body {
    display: flex;
    gap: 1rem;
  }

  .sheet-body :global(.sheet-illustration) {
    flex-shrink: 0;
    width: 8rem;
    height: 11rem;
  }

  .sheet-data {
    flex: 1;
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
  }

  .sheet-data > * {
    margin-bottom: 0.5rem;
  }

  .sheet-data > *:last-child {
    margin-bottom: 0;
  }

  .chance-badge {
    padding: 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .chance-roll-label {
    font-weight: 700;
    color: #3a1d0f;
    display: block;
  }

  .chance-roll-formula {
    font-family: ui-monospace, monospace;
    font-weight: 700;
    color: #78350f;
  }

  .chance-right {
    text-align: right;
  }

  .chance-label {
    font-weight: 700;
    display: block;
  }

  .chance-percent {
    font-size: 9px;
    color: #78350f;
  }

  .botanical-details {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
    font-size: 11px;
    background: #f4ecd8;
    padding: 0.5rem;
    border-radius: 0.25rem;
  }

  .detail-label {
    font-weight: 700;
    color: #854d0e;
  }

  .sheet-effects-title {
    font-weight: 700;
    color: #3a1d0f;
    display: block;
    font-size: 11px;
  }

  .sheet-effect {
    padding-left: 0.5rem;
    border-left: 2px solid #854d0e;
    font-size: 11px;
    margin-top: 0.25rem;
  }

  .sheet-effect-title {
    color: #854d0e;
  }

  .sheet-toxicity {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 10px;
    color: #991b1b;
    background: #fef2f2;
    padding: 0.375rem;
    border-radius: 0.25rem;
    border: 1px solid #fecaca;
  }

  .sheet-toxicity-icon {
    flex-shrink: 0;
  }

  /* ===== Creatures page ===== */
  .creature-stack > * {
    margin-bottom: 1rem;
  }

  .creature-stack > *:last-child {
    margin-bottom: 0;
  }

  .creature-card {
    background: #fbf8f0;
    padding: 1rem;
    border-radius: 0.5rem;
    border: 1px solid #c4a47c;
  }

  .creature-card > * {
    margin-bottom: 0.75rem;
  }

  .creature-card > *:last-child {
    margin-bottom: 0;
  }

  .creature-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid #e2d5c3;
    padding-bottom: 0.5rem;
  }

  .creature-name {
    font-size: 1.125rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    color: #3a1d0f;
    margin: 0;
  }

  .creature-meta {
    font-size: 0.75rem;
    font-style: italic;
    color: #78350f;
  }

  .creature-incision {
    font-size: 0.75rem;
    font-family: ui-monospace, monospace;
    font-weight: 700;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: #451a03;
    color: #fcd34d;
    white-space: nowrap;
  }

  .components-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    font-size: 0.75rem;
  }

  .component-card {
    padding: 0.625rem;
    border-radius: 0.25rem;
    background: #f4ecd8;
    border: 1px solid #d8c5b0;
  }

  .component-card > * {
    margin-bottom: 0.25rem;
  }

  .component-card > *:last-child {
    margin-bottom: 0;
  }

  .component-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .component-name {
    color: #854d0e;
    font-size: 0.75rem;
  }

  .component-value {
    font-size: 10px;
    font-family: ui-monospace, monospace;
    color: #78350f;
  }

  .component-dc {
    font-size: 11px;
    color: #331c12;
  }

  .component-chance {
    padding: 0.25rem;
    border-radius: 0.25rem;
    font-size: 10px;
    font-weight: 700;
  }

  .component-props {
    font-size: 10px;
    color: #78350f;
    font-style: italic;
    margin: 0;
  }

  /* ===== Recipes page ===== */
  .pdf-recipes-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
  }

  .pdf-recipe-card {
    background: #fbf8f0;
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid #c4a47c;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .pdf-recipe-card > * {
    margin-bottom: 0.5rem;
  }

  .pdf-recipe-card > *:last-child {
    margin-bottom: 0;
  }

  .pdf-recipe-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid #ecd9c2;
    padding-bottom: 0.25rem;
  }

  .pdf-recipe-name {
    font-size: 0.875rem;
    color: #3a1d0f;
    display: block;
  }

  .pdf-recipe-category {
    font-size: 10px;
    text-transform: uppercase;
    color: #854d0e;
    font-weight: 700;
  }

  .pdf-recipe-dc {
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    background: #f4ecd8;
    border: 1px solid #c4a47c;
    white-space: nowrap;
  }

  .pdf-recipe-chance {
    padding: 0.375rem;
    border-radius: 0.25rem;
    border: 1px solid;
    font-size: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .pdf-recipe-roll {
    color: #3a1d0f;
  }

  .pdf-recipe-percent {
    font-weight: 700;
  }

  .pdf-recipe-ingredients {
    font-size: 11px;
    color: #451a03;
  }

  .pdf-recipe-effect {
    font-size: 11px;
    color: #2d180d;
    font-style: italic;
    margin: 0;
  }

  /* ===== Print rules ===== */
  @media print {
    .no-print {
      display: none !important;
    }

    .print-container {
      gap: 0;
      margin: 0;
    }

    .pdf-page {
      box-shadow: none;
      break-after: page;
    }
  }
</style>
