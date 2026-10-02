<script lang="ts">
  import type { Plant, AlchemicalRecipe } from '$lib/herboriste/types/herb';
  import { BIOMES_METADATA, RARITY_METADATA, FORAGING_RULES } from '$lib/herboriste/data/herbalistData';
  import BotanicalIllustration from './BotanicalIllustration.svelte';

  let {
    plants,
    recipes,
    onSelectPlant,
    onNavigateToPdf,
    onNavigateToAlchimie,
  }: {
    plants: Plant[];
    recipes: AlchemicalRecipe[];
    onSelectPlant: (plant: Plant) => void;
    onNavigateToPdf: () => void;
    onNavigateToAlchimie?: () => void;
  } = $props();

  let currentPage = $state<number>(0);
  let selectedBiomeFilter = $state<string>('all');

  const filteredPlants = $derived(
    selectedBiomeFilter === 'all'
      ? plants
      : plants.filter((p) => p.biome === selectedBiomeFilter)
  );

  // Pages structure:
  // Page 0: Cover / Title & Preface
  // Page 1: Chapter 1 - Rules & Methods (Cueillette & Alchimie)
  // Pages 2 ... N: Herbarium (2 plants per spread or 1 detailed plant per page)
  // Last pages: Recipes & Tables
  const totalPlantPages = $derived(Math.ceil(filteredPlants.length / 2));
  const totalPages = $derived(2 + totalPlantPages + 2); // Cover + Rules + Plants + Recipes + Tables

  const pageTitle = $derived.by(() => {
    if (currentPage === 0) return 'Page de Garde & Prologue';
    if (currentPage === 1) return "Chapitre I : L'Art de l'Herboriste & Cueillette";
    if (currentPage >= 2 && currentPage < 2 + totalPlantPages)
      return `Chapitre II : L'Herbier Illustré (Folio ${currentPage - 1})`;
    if (currentPage === 2 + totalPlantPages) return "Chapitre III : L'Atelier & Concoctions";
    return 'Chapitre IV : Tables de Rencontres Aléatoires';
  });

  const visiblePlants = $derived(
    filteredPlants.slice((currentPage - 2) * 2, (currentPage - 2) * 2 + 2)
  );

  function onBiomeChange(e: Event) {
    selectedBiomeFilter = (e.target as HTMLSelectElement).value;
    currentPage = 2;
  }
</script>

<div class="gbv-root">
  <!-- Top Reading Toolbar -->
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="icon-bookmark">🔖</span>
      <span class="toolbar-title">{pageTitle}</span>
    </div>

    <!-- Quick jump biomes if in Herbier -->
    {#if currentPage >= 2 && currentPage < 2 + totalPlantPages}
      <div class="biome-filter">
        <span class="biome-label">Biome :</span>
        <select value={selectedBiomeFilter} onchange={onBiomeChange}>
          <option value="all">Tous les biotopes ({plants.length})</option>
          <option value="foret">Forêts</option>
          <option value="caverne">Cavernes & Souterrains</option>
          <option value="montagne">Montagnes</option>
          <option value="marais">Marais</option>
          <option value="plaine">Plaines</option>
          <option value="desert">Déserts</option>
          <option value="aquatique">Côtes & Eaux</option>
        </select>
      </div>
    {/if}

    <div class="toolbar-nav">
      <button
        class="nav-btn"
        onclick={() => (currentPage = Math.max(0, currentPage - 1))}
        disabled={currentPage === 0}
      >
        <span>◀</span>
        <span>Précédent</span>
      </button>
      <span class="page-counter">{currentPage + 1} / {totalPages}</span>
      <button
        class="nav-btn"
        onclick={() => (currentPage = Math.min(totalPages - 1, currentPage + 1))}
        disabled={currentPage === totalPages - 1}
      >
        <span>Suivant</span>
        <span>▶</span>
      </button>
      <button class="pdf-btn" onclick={onNavigateToPdf}>
        Voir Version PDF A4
      </button>
    </div>
  </div>

  <!-- Main Tome / Grimoire Paper Book Container -->
  <div class="book">
    <!-- Subtle aged parchment background texture -->
    <div class="paper-texture"></div>

    <!-- Ornate corner borders -->
    <div class="corner corner-tl"></div>
    <div class="corner corner-tr"></div>
    <div class="corner corner-bl"></div>
    <div class="corner corner-br"></div>

    <!-- ================= PAGE 0: COVER / PREFACE ================= -->
    {#if currentPage === 0}
      <div class="page cover-page">
        <div class="cover-icon">
          <span class="cover-book-icon">📖</span>
        </div>

        <div class="cover-subtitle-top">
          Traité Universel d'Herboristerie Médiévale-Fantastique
        </div>

        <h1 class="cover-title">LE GUIDE DE L'HERBORISTE</h1>

        <div class="cover-divider"></div>

        <h2 class="cover-subtitle">
          Compendium de Flore Médicinale, Vénéneuse & Arcanique pour Donjons & Dragons 5e et Maîtres du Jeu
        </h2>

        <!-- Central Frontispice Plate -->
        <div class="frontispice">
          {#if plants[0]}
            <BotanicalIllustration
              plant={plants[0]}
              size="md"
              showPlateDetails={false}
              class="frontispice-illustration"
            />
          {/if}
          <p class="frontispice-quote">
            « Dans chaque racine réside un mystère, dans chaque feuille sommeille une vertu. »
          </p>
        </div>

        <div class="preface">
          <p class="preface-heading">
            À l'attention de l'apothicaire, du rôdeur, du druide et du Maître de Donjon :
          </p>
          <p class="preface-text">
            Ce guide a été rédigé pour offrir aux aventuriers un système clair, visuel et prêt à l'emploi. Chaque plante comporte sa planche botanique illustrative, ses conditions de biotope, ses tests de cueillette (DD), ses méthodes de préparation (infusion, décoction, onguent, poudre) et ses effets mécaniques rigoureusement calibrés pour les règles du jeu de rôle fantastique.
          </p>
        </div>

        <div class="cover-actions">
          <button class="cover-open-btn" onclick={() => (currentPage = 1)}>
            Ouvrir le Grimoire →
          </button>
          <button class="cover-pdf-btn" onclick={onNavigateToPdf}>
            Générer le PDF à Imprimer
          </button>
        </div>
      </div>
    {/if}

    <!-- ================= PAGE 1: CHAPTER I - RULES ================= -->
    {#if currentPage === 1}
      <div class="page">
        <div class="chapter-header">
          <span class="chapter-kicker">Chapitre Premier</span>
          <h2 class="chapter-title">
            L'Art de l'Herboriste & Principes de Cueillette
          </h2>
        </div>

        <div class="rules-grid">
          <div>
            <h3 class="section-title">
              <span class="section-icon">🔖</span>
              Le Serment et l'Éthique Végétale
            </h3>
            <p class="serment-text">
              <span class="drop-cap">L</span>
              'herboriste avisé ne pille jamais la nature : il préserve la souche mère et ne récolte que le tiers des pousses d'un même bosquet. Les instruments de fer brut sont déconseillés pour les herbes magiques, car le métal froid en altère les effluves arcaniques ; on leur préférera la corne, le bois durci ou l'argent purifié.
            </p>
            <p class="serment-text">
              Les cycles de récolte jouent un rôle prépondérant : la rosée matinale préserve les huiles volatiles, tandis que les plantes vénéneuses concentrent leur suc le plus mortel aux heures arides du zénith ou sous la froide clarté de la pleine lune.
            </p>

            <h3 class="section-title">
              <span class="section-icon">🕐</span>
              Déroulement d'une Séance de Cueillette
            </h3>
            <p class="serment-text small-gap">
              Lorsqu'un personnage recherche des plantes au cours d'un voyage ou d'une halte :
            </p>
            <ul class="rules-list">
              <li><strong>Recherche Rapide (1 heure) :</strong> 1 seul jet de recherche possible, applique un malus de -2 au résultat.</li>
              <li><strong>Fouille Approfondie (4 heures) :</strong> Jet normal. Permet de trouver 1d4 doses supplémentaires en cas de succès critique.</li>
              <li><strong>Test de Compétence :</strong> Test de Sagesse (Survie) ou d'Intelligence (Nature). Le bonus de maîtrise s'applique si le personnage maîtrise le Kit d'Herboristerie.</li>
            </ul>
          </div>

          <div>
            <h3 class="section-title">
              <span class="section-icon">🛡️</span>
              Échelle des Difficultés (DD)
            </h3>
            <div class="dd-table">
              {#each FORAGING_RULES.difficultyTable as d, i (i)}
                <div class="dd-row">
                  <span class="dd-dc">{d.dc}</span>
                  <span class="dd-result">{d.result}</span>
                </div>
              {/each}
            </div>

            <h3 class="section-title">
              <span class="section-icon">✨</span>
              Modificateurs Météorologiques
            </h3>
            <div class="weather-list">
              {#each FORAGING_RULES.weatherModifiers as w, i (i)}
                <div class="weather-row">
                  <span class="weather-cond">{w.condition}</span>
                  <span class="weather-mod">{w.modifier}</span>
                </div>
              {/each}
            </div>

            <h3 class="section-title">
              <span class="section-icon">🪙</span>
              Conservation des Spécimens
            </h3>
            <p class="conservation-text">
              Les feuilles fraîches flétrissent en 3 jours si elles ne sont pas traitées. Le séchage au pressoir prolonge leur efficacité jusqu'à 6 mois, tandis que la macération dans l'huile de lin ou l'alcool de grain conserve les principes actifs pendant 1 à 2 années pleines.
            </p>

            <h3 class="section-title">
              <span class="section-icon">📡</span>
              Passerelle VTT, Écran Joueur & Compagnon Mobile
            </h3>
            <div class="dd-table">
              <div class="dd-row">
                <span class="dd-dc">Vue Joueur</span>
                <span class="dd-result">Projection cinématique en plein écran façon parchemin d'apothicaire avec cachet de cire.</span>
              </div>
              <div class="dd-row">
                <span class="dd-dc">Mode Mystère</span>
                <span class="dd-result">Masque les propriétés de la plante jusqu'à ce que les PJ réussissent un test d'Identification.</span>
              </div>
              <div class="dd-row">
                <span class="dd-dc">Mobile</span>
                <span class="dd-result">Sacoche d'apothicaire synchronisée en direct avec la table : consommation, enduits d'armes, troc et radar minier.</span>
              </div>
            </div>
          </div>
        </div>

        <div class="page-footer">
          <span>— Page 2 —</span>
          <button class="footer-link" onclick={() => (currentPage = 2)}>
            Poursuivre vers l'Herbier Illustré →
          </button>
        </div>
      </div>
    {/if}

    <!-- ================= PAGES 2 ... N: HERBARIUM PLANTS ================= -->
    {#if currentPage >= 2 && currentPage < 2 + totalPlantPages}
      <div class="page">
        <!-- Header of Herbarium section -->
        <div class="herbarium-header">
          <div>
            <span class="chapter-kicker">Chapitre II : L'Herbier Illustré</span>
            <h2 class="herbarium-title">Catalogue Botanique & Fiches d'Herbes</h2>
          </div>
          <span class="herbarium-count">
            Spécimens {((currentPage - 2) * 2) + 1} à {Math.min(filteredPlants.length, (currentPage - 2) * 2 + 2)} sur {filteredPlants.length}
          </span>
        </div>

        <!-- Two plant profiles side by side (Book Spread layout) -->
        <div class="plant-spread">
          {#each visiblePlants as plant (plant.id)}
            {@const biomeInfo = BIOMES_METADATA[plant.biome]}
            {@const rarityInfo = RARITY_METADATA[plant.rarity]}
            <div class="plant-card">
              <div>
                <!-- Title & Latin Binomial -->
                <div class="plant-header">
                  <div>
                    <h3 class="plant-name">{plant.name}</h3>
                    <div class="plant-latin">{plant.latinName}</div>
                  </div>
                  <span
                    class="rarity-badge"
                    style:color={rarityInfo.color}
                    style:border-color={rarityInfo.border}
                    style:background-color={rarityInfo.bg}
                  >
                    {rarityInfo.label}
                  </span>
                </div>

                <!-- Plant Illustration & Quick Meta -->
                <div class="plant-body">
                  <BotanicalIllustration
                    plant={plant}
                    size="md"
                    showPlateDetails={true}
                    class="plant-illustration"
                  />
                  <div class="plant-meta">
                    <div class="meta-row">
                      <span class="meta-label">Habitat :</span>
                      <span class="meta-value meta-habitat">{biomeInfo.label}</span>
                    </div>
                    <div class="meta-row">
                      <span class="meta-label">DD Récolte :</span>
                      <span class="meta-value meta-dc">DD {plant.dcHarvest}</span>
                    </div>
                    <div class="meta-row">
                      <span class="meta-label">Saison :</span>
                      <span>{plant.season}</span>
                    </div>
                    <div class="meta-row">
                      <span class="meta-label">Partie :</span>
                      <span class="meta-parts">{plant.partsUsed}</span>
                    </div>
                    <div class="meta-row">
                      <span class="meta-label">Méthode :</span>
                      <span>{plant.preparationMethod}</span>
                    </div>
                    <div class="meta-row meta-row-last">
                      <span class="meta-label">Valeur :</span>
                      <span class="meta-value-value">{plant.value}</span>
                    </div>
                  </div>
                </div>

                <!-- Description & Botanical Appearance -->
                <p class="plant-description">{plant.description}</p>

                <!-- D&D Game Effects Box -->
                <div class="effects-box">
                  <div class="effects-title">
                    <span>✨</span>
                    Effets en Jeu (D&D 5e / JDR)
                  </div>
                  {#each plant.gameEffects as eff, idx (idx)}
                    <div class="effect-entry">
                      <span class="effect-name">{eff.title} : </span>
                      <span class="effect-desc">{eff.description}</span>
                      {#if eff.duration}
                        <span class="effect-duration">Durée : {eff.duration}</span>
                      {/if}
                    </div>
                  {/each}
                </div>

                <!-- Toxicity warning if any -->
                {#if plant.toxicityWarning}
                  <div class="toxicity-warning">
                    <span class="toxicity-icon">⚠️</span>
                    <span><strong>Avertissement :</strong> {plant.toxicityWarning}</span>
                  </div>
                {/if}

                <!-- Druidic Lore -->
                <blockquote class="druidic-lore">{plant.druidicLore}</blockquote>
              </div>

              <!-- Detail button -->
              <button class="detail-btn" onclick={() => onSelectPlant(plant)}>
                Consulter la fiche détaillée & Recettes associées
              </button>
            </div>
          {/each}
        </div>

        <div class="page-footer">
          <span>— Folio {currentPage + 1} —</span>
          <span>Guide de l'Herboriste</span>
        </div>
      </div>
    {/if}

    <!-- ================= CHAPTER III: ALCHEMY RECIPES ================= -->
    {#if currentPage === 2 + totalPlantPages}
      <div class="page">
        <div class="chapter-header">
          <span class="chapter-kicker">Chapitre III</span>
          <h2 class="chapter-title">Traité des Concoctions & Potions Alchimiques</h2>
        </div>

        <p class="alchemy-intro">
          « Toute herbe cueillie n'est que promesse. C'est dans le creuset de l'alchimiste, sous l'action mesurée de la flamme et de l'alambic, que la sève révèle sa souveraine puissance. »
        </p>

        <div class="recipes-grid">
          {#each recipes as rec (rec.id)}
            <div class="recipe-card">
              <div class="recipe-header">
                <div>
                  <h4 class="recipe-name">{rec.name}</h4>
                  <span class="recipe-meta">{rec.category} · DD d'Alchimie {rec.difficultyDC}</span>
                </div>
                <span class="recipe-price">{rec.marketPrice}</span>
              </div>

              <div class="recipe-body">
                <div>
                  <span class="recipe-label">Ingrédients requis :</span>
                  <ul class="recipe-ingredients">
                    {#each rec.ingredients as ing, i (i)}
                      <li><strong>{ing.quantity}x {ing.plantName}</strong> ({ing.part})</li>
                    {/each}
                    {#each rec.additionalComponents as comp, i (i)}
                      <li class="recipe-component">{comp}</li>
                    {/each}
                  </ul>
                </div>

                <div class="recipe-effect">
                  <span class="recipe-effect-label">Effet : </span>
                  <span>{rec.effect}</span>
                </div>

                <div class="recipe-footer">
                  <span>Temps de brassage : {rec.brewingTime}</span>
                  <span>Conservation : {rec.shelfLife}</span>
                </div>
              </div>
            </div>
          {/each}
        </div>

        <!-- Random Potion Generator Highlight Callout -->
        {#if onNavigateToAlchimie}
          <div class="alchemy-callout">
            <span class="callout-kicker">Nouveauté de l'Atelier</span>
            <h4 class="callout-title">Expérimentations Alchimiques & Breuvages Chaotiques</h4>
            <p class="callout-text">
              Vous combinez des ingrédients rares sans suivre de recette établie ? Générez instantanément une table d'effets aléatoires (d20) personnalisée selon les composants choisis !
            </p>
            <button class="callout-btn" onclick={onNavigateToAlchimie}>
              <span>✨</span>
              <span>Ouvrir le Générateur de Table d'Effets Aléatoires</span>
            </button>
          </div>
        {/if}

        <div class="page-footer">
          <span>— Page {currentPage + 1} —</span>
          <button class="footer-link" onclick={() => (currentPage = currentPage + 1)}>
            Passer aux Tables Aléatoires →
          </button>
        </div>
      </div>
    {/if}

    <!-- ================= CHAPTER IV: RANDOM FORAGING TABLES ================= -->
    {#if currentPage === 2 + totalPlantPages + 1}
      <div class="page">
        <div class="chapter-header">
          <span class="chapter-kicker">Chapitre IV : Outil pour le Maître du Jeu</span>
          <h2 class="chapter-title">Tables de Cueillette Aléatoire (d20)</h2>
        </div>

        <p class="tables-intro">
          Lancez 1d20 lorsque les aventuriers cherchent des herbes. Ajoutez le modificateur de Sagesse (Survie) ou d'Intelligence (Nature) du joueur.
        </p>

        <div class="tables-grid">
          <!-- Forest & Woods Table -->
          <div class="forage-table">
            <h4 class="forage-title forage-forest">
              <span>🔥</span>
              Table de Forêt & Bois Anciens
            </h4>
            <div class="forage-rows">
              <div class="forage-row">
                <span class="forage-roll">1 - 7</span>
                <span>Herbe aux Fées (1d4 doses)</span>
              </div>
              <div class="forage-row">
                <span class="forage-roll">8 - 12</span>
                <span>Belladone Noire (1 dose)</span>
              </div>
              <div class="forage-row">
                <span class="forage-roll">13 - 17</span>
                <span>Athelas / Feuille Royale (1d2 doses)</span>
              </div>
              <div class="forage-row">
                <span class="forage-roll">18 - 19</span>
                <span>Écorce de Chêne-Vermeil (1 morceau)</span>
              </div>
              <div class="forage-row forage-row-last">
                <span class="forage-roll">20+</span>
                <span>Fleur de Lune sacrée (1 corolle étincelante)</span>
              </div>
            </div>
          </div>

          <!-- Caves & Underdark Table -->
          <div class="forage-table">
            <h4 class="forage-title forage-caves">
              <span>🔥</span>
              Table de Cavernes & Outreterre
            </h4>
            <div class="forage-rows">
              <div class="forage-row">
                <span class="forage-roll">1 - 8</span>
                <span>Mousse Luminescente (2d4 poignées)</span>
              </div>
              <div class="forage-row">
                <span class="forage-roll">9 - 14</span>
                <span>Champignon Céphale (1d2 sporophores)</span>
              </div>
              <div class="forage-row">
                <span class="forage-roll">15 - 18</span>
                <span>Mandragore Criarde (1 racine intacte)</span>
              </div>
              <div class="forage-row forage-row-last">
                <span class="forage-roll">19+</span>
                <span>Racine d'Ombre des profondeurs (1 fiole)</span>
              </div>
            </div>
          </div>
        </div>

        <div class="pdf-cta">
          <h5 class="pdf-cta-title">Souhaitez-vous générer ou imprimer le guide complet ?</h5>
          <p class="pdf-cta-text">
            La mise en page d'exportation A4 regroupe l'intégralité des 16 planches botaniques illustrées, les tables et recettes dans un format prêt pour reliure ou classeur.
          </p>
          <button class="pdf-cta-btn" onclick={onNavigateToPdf}>
            Accéder à l'Exportation PDF A4 →
          </button>
        </div>

        <div class="page-footer">
          <span>— Page {currentPage + 1} — Fin du Grimoire</span>
          <span>© Le Guide de l'Herboriste</span>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .gbv-root {
    min-height: 100vh;
    padding: 2rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  /* ===== Toolbar ===== */
  .toolbar {
    width: 100%;
    max-width: 64rem;
    margin-bottom: 1.5rem;
    background: #251e18;
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid #524136;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    font-size: 0.875rem;
    color: #e6d8c3;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .icon-bookmark {
    font-size: 1.1rem;
  }

  .toolbar-title {
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    color: #fef08a;
  }

  .biome-filter {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
  }

  .biome-label {
    color: #a89988;
  }

  .biome-filter select {
    background: #181310;
    border: 1px solid #59473b;
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    color: #f5ecd7;
    font-size: 0.75rem;
    outline: none;
  }

  .toolbar-nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .nav-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.75rem;
    border-radius: 0.25rem;
    background: #382b22;
    color: #e2d5c3;
    border: none;
    cursor: pointer;
    transition: background 150ms;
  }

  .nav-btn:hover:not(:disabled) {
    background: #4a392e;
  }

  .nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .page-counter {
    padding: 0 0.5rem;
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
    color: #d4af37;
  }

  .pdf-btn {
    margin-left: 0.5rem;
    padding: 0.375rem 0.75rem;
    border-radius: 0.25rem;
    background: #92400e;
    color: #ffffff;
    border: none;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    transition: background 150ms;
  }

  .pdf-btn:hover {
    background: #b45309;
  }

  /* ===== Book container ===== */
  .book {
    width: 100%;
    max-width: 64rem;
    background: #f7f2e7;
    color: #2c1810;
    border-radius: 0.75rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    border: 4px solid #3e2b20;
    padding: 3rem;
    position: relative;
    overflow: hidden;
    transition: all 300ms;
    min-height: 750px;
  }

  .paper-texture {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.25;
    background-image: radial-gradient(#b45309 0.75px, transparent 0.75px),
      radial-gradient(#78350f 0.75px, #f7f2e7 0.75px);
    background-size: 24px 24px;
    background-position: 0 0, 12px 12px;
  }

  .corner {
    position: absolute;
    width: 2rem;
    height: 2rem;
  }

  .corner-tl { top: 0.75rem; left: 0.75rem; border-top: 2px solid #854d0e; border-left: 2px solid #854d0e; }
  .corner-tr { top: 0.75rem; right: 0.75rem; border-top: 2px solid #854d0e; border-right: 2px solid #854d0e; }
  .corner-bl { bottom: 0.75rem; left: 0.75rem; border-bottom: 2px solid #854d0e; border-left: 2px solid #854d0e; }
  .corner-br { bottom: 0.75rem; right: 0.75rem; border-bottom: 2px solid #854d0e; border-right: 2px solid #854d0e; }

  .page {
    position: relative;
    z-index: 10;
  }

  /* ===== Cover page ===== */
  .cover-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2rem 0;
  }

  .cover-icon {
    width: 5rem;
    height: 5rem;
    border-radius: 9999px;
    border: 2px solid #854d0e;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
    background: #f0e6d2;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    color: #854d0e;
  }

  .cover-book-icon {
    font-size: 2.25rem;
  }

  .cover-subtitle-top {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #854d0e;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .cover-title {
    font-size: 3rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 800;
    color: #3a1d0f;
    letter-spacing: 0.025em;
    margin: 0 0 1rem;
    line-height: 1.2;
  }

  .cover-divider {
    width: 12rem;
    height: 2px;
    background: rgba(133, 77, 14, 0.6);
    margin: 0.5rem 0;
  }

  .cover-subtitle {
    font-size: 1.25rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    color: #633a1e;
    max-width: 42rem;
    margin: 0 0 2rem;
    font-weight: 400;
  }

  .frontispice {
    margin: 1rem 0;
    padding: 1rem;
    border-radius: 0.5rem;
    background: #efe7d5;
    border: 1px solid #c4a47c;
    max-width: 28rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .frontispice :global(.frontispice-illustration) {
    margin-left: auto;
    margin-right: auto;
  }

  .frontispice-quote {
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    color: #78350f;
    margin: 0.75rem 0 0;
  }

  .preface {
    margin-top: 2rem;
    max-width: 42rem;
    text-align: left;
    background: rgba(244, 236, 216, 0.9);
    padding: 1.25rem;
    border-radius: 0.25rem;
    border: 1px solid #d8c2a3;
    font-size: 0.875rem;
    line-height: 1.625;
    font-family: Georgia, 'Times New Roman', serif;
  }

  .preface-heading {
    margin: 0 0 0.75rem;
    font-weight: 600;
    color: #451a03;
  }

  .preface-text {
    margin: 0;
    color: #3b271d;
  }

  .cover-actions {
    margin-top: 2rem;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: center;
  }

  .cover-open-btn {
    padding: 0.625rem 1.5rem;
    background: #78350f;
    color: #fef08a;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    border-radius: 0.25rem;
    border: none;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    transition: background 150ms;
  }

  .cover-open-btn:hover {
    background: #8e3f13;
  }

  .cover-pdf-btn {
    padding: 0.625rem 1.5rem;
    background: #3d281a;
    color: #f5ebd7;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    border-radius: 0.25rem;
    border: 1px solid #854d0e;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    transition: background 150ms;
  }

  .cover-pdf-btn:hover {
    background: #523724;
  }

  /* ===== Chapter headers ===== */
  .chapter-header {
    text-align: center;
    margin-bottom: 2rem;
    border-bottom: 2px solid rgba(133, 77, 14, 0.4);
    padding-bottom: 1rem;
  }

  .chapter-kicker {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #854d0e;
    font-weight: 700;
    font-family: Georgia, 'Times New Roman', serif;
  }

  .chapter-title {
    font-size: 1.875rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    color: #3a1d0f;
    margin: 0.25rem 0 0;
  }

  /* ===== Rules chapter ===== */
  .rules-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
    font-size: 0.875rem;
    font-family: Georgia, 'Times New Roman', serif;
    line-height: 1.625;
    color: #331c12;
  }

  @media (min-width: 768px) {
    .rules-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #78350f;
    margin: 0 0 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid #c4a47c;
    padding-bottom: 0.25rem;
    font-family: Georgia, 'Times New Roman', serif;
  }

  .section-title:not(:first-child) {
    margin-top: 1.25rem;
  }

  .section-icon {
    font-size: 1rem;
  }

  .serment-text {
    margin: 0 0 0.75rem;
  }

  .serment-text.small-gap {
    margin-bottom: 0.5rem;
  }

  .drop-cap {
    float: left;
    font-size: 2.25rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    color: #78350f;
    padding-right: 0.5rem;
    line-height: 1;
  }

  .rules-list {
    list-style: disc;
    list-style-position: inside;
    margin: 0 0 1rem;
    padding: 0;
    font-size: 0.75rem;
  }

  .rules-list li {
    margin-bottom: 0.25rem;
  }

  .dd-table {
    background: #efe8d8;
    border-radius: 0.25rem;
    border: 1px solid #c4a47c;
    padding: 0.75rem;
    margin-bottom: 1rem;
    font-size: 0.75rem;
  }

  .dd-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #dfd0bd;
    padding-bottom: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .dd-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
    margin-bottom: 0;
  }

  .dd-dc {
    font-weight: 700;
    color: #78350f;
    font-family: ui-monospace, monospace;
  }

  .dd-result {
    color: #3a2519;
  }

  .weather-list {
    margin-bottom: 1rem;
    font-size: 0.75rem;
  }

  .weather-row {
    display: flex;
    justify-content: space-between;
    padding: 0.375rem;
    border-radius: 0.25rem;
    background: #f4ebd7;
    margin-bottom: 0.375rem;
  }

  .weather-row:last-child {
    margin-bottom: 0;
  }

  .weather-cond {
    font-style: italic;
  }

  .weather-mod {
    font-weight: 700;
    color: #854d0e;
  }

  .conservation-text {
    font-size: 0.75rem;
    margin: 0;
  }

  /* ===== Page footer ===== */
  .page-footer {
    margin-top: 2rem;
    display: flex;
    justify-content: space-between;
    border-top: 1px solid #c4a47c;
    padding-top: 1rem;
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
    color: #78350f;
  }

  .footer-link {
    font-weight: 700;
    background: none;
    border: none;
    color: #78350f;
    font-family: inherit;
    font-size: inherit;
    cursor: pointer;
    padding: 0;
  }

  .footer-link:hover {
    text-decoration: underline;
  }

  /* ===== Herbarium pages ===== */
  .herbarium-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid rgba(133, 77, 14, 0.4);
    padding-bottom: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .herbarium-title {
    font-size: 1.5rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    color: #3a1d0f;
    margin: 0;
  }

  .herbarium-count {
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    color: #78350f;
  }

  .plant-spread {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  @media (min-width: 768px) {
    .plant-spread {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .plant-card {
    background: #faf6ee;
    border-radius: 0.5rem;
    border: 1px solid #c4a47c;
    padding: 1rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: box-shadow 150ms;
  }

  .plant-card:hover {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .plant-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
    border-bottom: 1px solid #e2d5c3;
    padding-bottom: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .plant-name {
    font-size: 1.25rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    color: #3a1b0e;
    margin: 0;
  }

  .plant-latin {
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    color: #78350f;
  }

  .rarity-badge {
    font-size: 10px;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid;
    white-space: nowrap;
  }

  .plant-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
    margin-bottom: 1rem;
  }

  @media (min-width: 640px) {
    .plant-body {
      flex-direction: row;
      align-items: flex-start;
    }
  }

  .plant-body :global(.plant-illustration) {
    flex-shrink: 0;
    cursor: pointer;
  }

  .plant-meta {
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
    width: 100%;
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    border-bottom: 1px solid #ecd9c2;
    padding-bottom: 0.25rem;
    margin-bottom: 0.375rem;
  }

  .meta-row-last {
    border-bottom: none;
    padding-top: 0.25rem;
  }

  .meta-label {
    color: #78350f;
    font-weight: 600;
  }

  .meta-habitat {
    font-weight: 500;
    color: #2d4a22;
  }

  .meta-dc {
    font-family: ui-monospace, monospace;
    font-weight: 700;
    color: #b45309;
  }

  .meta-parts {
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta-value-value {
    font-weight: 700;
    color: #854d0e;
  }

  .plant-description {
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
    color: #3a261c;
    margin: 0 0 0.75rem;
    line-height: 1.625;
  }

  .effects-box {
    background: #f0e7d3;
    padding: 0.75rem;
    border-radius: 0.25rem;
    border: 1px solid #cfbca2;
    margin-bottom: 0.75rem;
  }

  .effects-title {
    font-size: 11px;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #78350f;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 0.5rem;
  }

  .effect-entry {
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
    margin-bottom: 0.5rem;
  }

  .effect-entry:last-child {
    margin-bottom: 0;
  }

  .effect-name {
    font-weight: 700;
    color: #451a03;
  }

  .effect-desc {
    color: #2b1810;
  }

  .effect-duration {
    display: block;
    font-size: 10px;
    color: #78350f;
    font-style: italic;
    margin-top: 0.125rem;
  }

  .toxicity-warning {
    background: rgba(254, 226, 226, 0.6);
    border: 1px solid #fca5a5;
    padding: 0.5rem;
    border-radius: 0.25rem;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: flex-start;
    gap: 0.375rem;
    font-size: 11px;
    color: #991b1b;
    font-family: Georgia, 'Times New Roman', serif;
  }

  .toxicity-icon {
    flex-shrink: 0;
    margin-top: 0.125rem;
    font-size: 0.8rem;
  }

  .druidic-lore {
    font-size: 11px;
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    color: #633a1e;
    border-left: 2px solid #854d0e;
    padding-left: 0.5rem;
    padding-top: 0.125rem;
    padding-bottom: 0.125rem;
    margin: 0.5rem 0 0;
  }

  .detail-btn {
    margin-top: 1rem;
    width: 100%;
    padding: 0.375rem 0;
    background: #ebdcc4;
    color: #451a03;
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    border-radius: 0.25rem;
    border: 1px solid #c4a47c;
    cursor: pointer;
    transition: background 150ms;
  }

  .detail-btn:hover {
    background: #dfcdb1;
  }

  /* ===== Recipes chapter ===== */
  .alchemy-intro {
    font-size: 0.875rem;
    font-family: Georgia, 'Times New Roman', serif;
    color: #331c12;
    margin: 0 auto 1.5rem;
    max-width: 42rem;
    text-align: center;
    font-style: italic;
  }

  .recipes-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  @media (min-width: 768px) {
    .recipes-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .recipe-card {
    background: #faf6ee;
    border-radius: 0.5rem;
    border: 1px solid #c4a47c;
    padding: 1rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .recipe-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid #ecd9c2;
    padding-bottom: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .recipe-name {
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    font-size: 1rem;
    color: #3a1a0d;
    margin: 0;
  }

  .recipe-meta {
    font-size: 11px;
    font-family: Georgia, 'Times New Roman', serif;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #78350f;
  }

  .recipe-price {
    font-weight: 700;
    font-size: 0.75rem;
    font-family: ui-monospace, monospace;
    color: #b45309;
    white-space: nowrap;
  }

  .recipe-body {
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
    color: #331c12;
  }

  .recipe-body > div {
    margin-bottom: 0.5rem;
  }

  .recipe-body > div:last-child {
    margin-bottom: 0;
  }

  .recipe-label {
    font-weight: 600;
    color: #78350f;
  }

  .recipe-ingredients {
    list-style: disc;
    list-style-position: inside;
    margin: 0.125rem 0 0;
    padding: 0;
    font-size: 11px;
    color: #451a03;
  }

  .recipe-component {
    font-style: italic;
    color: #6b4c35;
  }

  .recipe-effect {
    background: #f0e7d3;
    padding: 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid #d8c2a3;
  }

  .recipe-effect-label {
    font-weight: 700;
    color: #451a03;
  }

  .recipe-footer {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #78350f;
    padding-top: 0.25rem;
  }

  .alchemy-callout {
    margin-top: 1.5rem;
    padding: 1rem;
    border-radius: 0.75rem;
    background: #ede3cf;
    border: 2px solid #b45309;
    text-align: center;
    font-family: Georgia, 'Times New Roman', serif;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .callout-kicker {
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #b45309;
    display: block;
    margin-bottom: 0.25rem;
  }

  .callout-title {
    font-size: 1rem;
    font-weight: 700;
    color: #3a1d0f;
    margin: 0 0 0.25rem;
  }

  .callout-text {
    font-size: 0.75rem;
    color: #523724;
    max-width: 36rem;
    margin: 0 auto 0.75rem;
  }

  .callout-btn {
    padding: 0.5rem 1.25rem;
    border-radius: 0.25rem;
    background: #78350f;
    color: #fef08a;
    font-weight: 700;
    font-size: 0.75rem;
    font-family: inherit;
    border: none;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    transition: background 150ms;
  }

  .callout-btn:hover {
    background: #8e3f13;
  }

  /* ===== Foraging tables chapter ===== */
  .tables-intro {
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
    color: #331c12;
    margin: 0 auto 1.5rem;
    text-align: center;
    max-width: 42rem;
  }

  .tables-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    font-size: 0.75rem;
    font-family: Georgia, 'Times New Roman', serif;
  }

  @media (min-width: 768px) {
    .tables-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .forage-table {
    background: #faf6ee;
    padding: 1rem;
    border-radius: 0.5rem;
    border: 1px solid #c4a47c;
  }

  .forage-title {
    font-weight: 700;
    font-size: 0.875rem;
    margin: 0 0 0.5rem;
    border-bottom: 1px solid #c4a47c;
    padding-bottom: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-family: Georgia, 'Times New Roman', serif;
  }

  .forage-forest {
    color: #2d6a4f;
  }

  .forage-caves {
    color: #6b21a8;
  }

  .forage-row {
    display: flex;
    justify-content: space-between;
    padding: 0.125rem 0;
    border-bottom: 1px solid #ecd9c2;
    margin-bottom: 0.375rem;
  }

  .forage-row-last {
    border-bottom: none;
    font-weight: 700;
    color: #b45309;
  }

  .forage-roll {
    font-family: ui-monospace, monospace;
    font-weight: 700;
    color: #854d0e;
  }

  .pdf-cta {
    margin-top: 2rem;
    padding: 1rem;
    background: #f0e7d3;
    border-radius: 0.25rem;
    border: 1px solid #cfbca2;
    text-align: center;
    font-family: Georgia, 'Times New Roman', serif;
  }

  .pdf-cta-title {
    font-weight: 700;
    font-size: 0.875rem;
    color: #451a03;
    margin: 0 0 0.25rem;
  }

  .pdf-cta-text {
    font-size: 0.75rem;
    color: #523724;
    margin: 0 0 0.75rem;
  }

  .pdf-cta-btn {
    padding: 0.5rem 1.5rem;
    background: #92400e;
    color: #fef08a;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    border-radius: 0.25rem;
    border: none;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    font-size: 0.75rem;
    transition: background 150ms;
  }

  .pdf-cta-btn:hover {
    background: #b45309;
  }
</style>
