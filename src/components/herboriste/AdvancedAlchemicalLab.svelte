<script module lang="ts">
  import type { Plant } from '$lib/herboriste/types/herb';
  import type { Mineral } from '$lib/herboriste/types/mineral';

  export interface CustomPotion {
    id: string;
    name: string;
    potionType: 'Potion Buvable' | 'Onguent Dermique' | 'Huile pour Arme' | 'Teinture Corrosive' | 'Poudre à Inhalation';
    rarity: 'Commune' | 'Peu commune' | 'Rare' | 'Très rare' | 'Légendaire';
    baseLiquid: string;
    plantsUsed: Plant[];
    mineralsUsed: Mineral[];
    difficultyDC: number;
    brewingTime: string;
    marketValuePo: number;
    mainEffects: string[];
    sideEffect?: string;
    shelfLife: string;
    flavorText: string;
    createdAt: string;
  }
</script>

<script lang="ts">
  import { MINERALS_LIST } from '$lib/herboriste/data/mineralData';

  interface AdvancedAlchemicalLabProps {
    plants: Plant[];
    onSelectPlant?: (plant: Plant) => void;
  }

  let { plants, onSelectPlant }: AdvancedAlchemicalLabProps = $props();

  const BASE_LIQUIDS = [
    { id: 'eau_source', name: 'Eau de Source Pure Consacrée', role: 'Base neutre et pure, idéale pour soins et restaurations cellulaires (+1 PV par dé de soin).' },
    { id: 'alcool_orge', name: 'Alcool d\'Orge Distillé à 80°', role: 'Macération violente qui extrait tous les principes actifs et prolonge la durée de conservation à 2 ans.' },
    { id: 'huile_amande', name: 'Huile d\'Amande & Cire Végétale', role: 'Support gras parfait pour onguents, baumes corporels et protection cutanée contre le froid ou l\'acide.' },
    { id: 'vinaigre_acide', name: 'Vinaigre Tellurique Acide', role: 'Catalyseur corrosif augmentant la virulence des poisons et la pénétration des alcaloïdes.' },
    { id: 'lait_jument', name: 'Lait Fermenté des Steppes', role: 'Nourrissant et fortifiant, amplifie les bonus de Force, Constitution et endurance physique.' },
  ];

  // Selection states
  let selectedPlantIds = $state<string[]>(['athelas', 'fleur_de_lune']);
  let selectedMineralIds = $state<string[]>(['vif_argent']);
  let selectedLiquidId = $state<string>('eau_source');
  let customPotionName = $state<string>('');

  // Search filters for ingredient picker
  let plantSearch = $state<string>('');
  let mineralSearch = $state<string>('');

  // Brewing simulation states
  let alchemistBonus = $state<number>(5); // Intelligence + Outils d'alchimiste
  let diceMode = $state<'virtual' | 'manual'>('virtual');
  let manualD20 = $state<number>(14);
  let isBrewing = $state<boolean>(false);
  let brewResult = $state<{
    roll: number;
    total: number;
    dc: number;
    success: boolean;
    critSuccess: boolean;
    critFail: boolean;
    message: string;
  } | null>(null);

  // Saved Custom Recipes (Grimoire personnel de l'alchimiste)
  let savedPotions = $state<CustomPotion[]>(loadSavedPotions());
  let saveSuccessMsg = $state<string>('');

  function loadSavedPotions(): CustomPotion[] {
    try {
      const saved = localStorage.getItem('dnd_herbalist_custom_potions');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading saved custom potions', e);
    }
    return [];
  }

  // Persist custom potions in localStorage
  $effect(() => {
    try {
      localStorage.setItem('dnd_herbalist_custom_potions', JSON.stringify(savedPotions));
    } catch (e) {
      console.error('Error saving custom potions', e);
    }
  });

  // Resolve objects
  const activePlants = $derived(plants.filter(p => selectedPlantIds.includes(p.id)));
  const activeMinerals = $derived(MINERALS_LIST.filter(m => selectedMineralIds.includes(m.id)));
  const activeLiquid = $derived(BASE_LIQUIDS.find(l => l.id === selectedLiquidId) || BASE_LIQUIDS[0]);

  const filteredPlantsList = $derived(
    plants.filter(p =>
      p.name.toLowerCase().includes(plantSearch.toLowerCase()) ||
      p.biome.toLowerCase().includes(plantSearch.toLowerCase())
    )
  );
  const filteredMineralsList = $derived(
    MINERALS_LIST.filter(m =>
      m.name.toLowerCase().includes(mineralSearch.toLowerCase()) ||
      m.alchemicalProperties.toLowerCase().includes(mineralSearch.toLowerCase())
    )
  );

  // =========================================================================
  // DYNAMIC ALCHEMICAL COMPOUND GENERATOR ENGINE
  // =========================================================================
  function generateCompoundAnalysis() {
    const mainEffects: string[] = [];
    let dc = 10;
    let valuePo = 25;
    let prepMinutes = 60;
    let potionType: CustomPotion['potionType'] = 'Potion Buvable';
    let shelfMonths = 6;
    const nameKeywords: string[] = [];

    // Analyze Liquid Base
    if (selectedLiquidId === 'eau_source') {
      mainEffects.push('💧 Base Consacrée : Effets de soin et de récupération maximisés (+1 point fixe par dé de soin).');
      shelfMonths = 6;
    } else if (selectedLiquidId === 'alcool_orge') {
      mainEffects.push('🔥 Macération Alcoolique : Durée des effets prolongée de 50% et absorption métabolique immédiate.');
      shelfMonths = 24;
      dc += 1;
      valuePo += 15;
    } else if (selectedLiquidId === 'huile_amande') {
      potionType = 'Onguent Dermique';
      mainEffects.push('🧴 Formule Onctueuse : S\'applique en massage cutané, conférant une pellicule étanche protectrice.');
      shelfMonths = 12;
      valuePo += 10;
    } else if (selectedLiquidId === 'vinaigre_acide') {
      potionType = 'Teinture Corrosive';
      mainEffects.push('🧪 Acidité Tellurique : Peut être projetée ou enduite sur une arme (ajoute 1d6 dégâts d\'acide).');
      shelfMonths = 18;
      dc += 2;
      valuePo += 20;
    } else if (selectedLiquidId === 'lait_jument') {
      mainEffects.push('🥛 Fortifiant Steppique : Confère 1d8 + 2 Points de Vie Temporaires pendant 4 heures.');
      shelfMonths = 2;
      valuePo += 15;
    }

    // Analyze Plants
    activePlants.forEach(plant => {
      nameKeywords.push(plant.name.split(' ')[0]);
      dc += plant.rarity === 'legendaire' ? 4 : plant.rarity === 'tres_rare' ? 3 : plant.rarity === 'rare' ? 2 : 1;
      valuePo += plant.rarity === 'legendaire' ? 120 : plant.rarity === 'tres_rare' ? 70 : plant.rarity === 'rare' ? 40 : 15;
      prepMinutes += 30;

      // Extract game effects from plant
      if (plant.gameEffects && plant.gameEffects.length > 0) {
        const topEffect = plant.gameEffects[0];
        mainEffects.push(`🌿 ${plant.name} : ${topEffect.title} — ${topEffect.description}`);
      } else {
        mainEffects.push(`🌿 ${plant.name} : Propriétés médicinales et bio-actives de ${plant.partsUsed}.`);
      }
    });

    // Analyze Minerals Catalysts
    activeMinerals.forEach(min => {
      nameKeywords.push(min.name.split(' ')[0]);
      dc += min.rarity === 'Légendaire' ? 5 : min.rarity === 'Très rare' ? 3 : min.rarity === 'Rare' ? 2 : 1;
      valuePo += min.basePricePerLingot * 0.8;
      prepMinutes += 45;

      if (min.id === 'vif_argent') {
        mainEffects.push(`⚗️ Vif-Argent Mercuriel : Accélérateur violent — Déclenche les effets en Action Bonus au lieu d'une Action.`);
      } else if (min.id === 'soufre_volcanique') {
        mainEffects.push(`🌋 Soufre Volcanique : Instabilité pyrotechnique — Libère une onde de choc thermique infligeant 2d6 dégâts de feu en cas de projection.`);
      } else if (min.id === 'sel_gemme_purifie') {
        mainEffects.push(`🧂 Sel Gemme Sacré : Stabilisateur absolu — Purifie le sang buveur et immunise contre les maladies communes pendant 24h.`);
        shelfMonths += 12;
      } else if (min.id === 'mithril') {
        mainEffects.push(`✨ Poussière de Mithril : Allègement éthéré — Le consommateur bénéficie des effets du sort Chute de Plume et +3m de vitesse pendant 1h.`);
      } else if (min.id === 'malachite_alchimique') {
        mainEffects.push(`🛡️ Malachite Alchimique : Neutralisateur de toxines — Avantage à tous les jets de sauvegarde contre le Poison.`);
      } else if (min.id === 'pierre_de_foudre') {
        mainEffects.push(`⚡ Pierre de Foudre : Charge électrique statique — Les attaques au corps-à-corps du consommateur infligent +1d6 dégâts de foudre.`);
      } else if (min.id === 'cendre_tellurique') {
        mainEffects.push(`🪨 Cendre Tellurique : Densification cutanée — La peau prend une texture de roche (+1 à la Classe d'Armure pendant 1h).`);
      } else if (min.id === 'obsidienne') {
        mainEffects.push(`🗡️ Obsidienne Vitreuse : Lame de l'esprit — Immunité temporaire contre les frayeurs magiques et charme psychique.`);
      } else {
        mainEffects.push(`⛏️ ${min.name} : Catalyseur minéralogène apportant ${min.alchemicalProperties}.`);
      }
    });

    // Calculate final Rarity
    let calculatedRarity: CustomPotion['rarity'] = 'Commune';
    if (dc >= 20 || valuePo >= 200) calculatedRarity = 'Légendaire';
    else if (dc >= 17 || valuePo >= 120) calculatedRarity = 'Très rare';
    else if (dc >= 14 || valuePo >= 60) calculatedRarity = 'Rare';
    else if (dc >= 12 || valuePo >= 35) calculatedRarity = 'Peu commune';

    // Side Effect detection (Opposite energies / Naheulbeuk style flavor)
    let sideEffect: string | undefined = undefined;
    const hasFire = activePlants.some(p => p.name.toLowerCase().includes('braise') || p.biome === 'desert') || activeMinerals.some(m => m.id === 'soufre_volcanique' || m.id === 'pyrite_ardente');
    const hasCold = activePlants.some(p => p.name.toLowerCase().includes('givre') || p.biome === 'montagne');
    const hasPoison = activePlants.some(p => p.toxicityWarning !== undefined || p.biome === 'marais');

    if (hasFire && hasCold) {
      sideEffect = '⚠️ Choc Thermique : Le buveur a des frissons brûlants et un hoquet fumant pendant 10 minutes (désavantage aux jets de Discrétion sonore).';
    } else if (hasPoison && activeMinerals.length === 0) {
      sideEffect = '⚠️ Amertume Vénéneuse : Sans sel minéral pour lier les alcaloïdes, la fiole laisse un goût de suie qui rend nauséeux pendant 1 tour.';
    } else if (activePlants.length >= 3 && activeMinerals.length >= 2) {
      sideEffect = '✨ Surdose Alchimique : Les yeux du consommateur luisent d\'une lueur phosphorescente vive pendant toute la durée de la potion.';
    }

    // Default auto-generated title
    const autoName = nameKeywords.length > 0
      ? `${potionType === 'Onguent Dermique' ? 'Baume' : potionType === 'Teinture Corrosive' ? 'Élixir Corrosif' : 'Potion'} de ${nameKeywords.slice(0, 3).join(' & ')}`
      : 'Concoction Mystérieuse Inachevée';

    const hours = Math.floor(prepMinutes / 60);
    const mins = prepMinutes % 60;
    const durationText = hours > 0 ? `${hours}h${mins > 0 ? mins : ''}` : `${mins} min`;

    return {
      name: customPotionName.trim() || autoName,
      potionType,
      rarity: calculatedRarity,
      baseLiquid: activeLiquid.name,
      plantsUsed: activePlants,
      mineralsUsed: activeMinerals,
      difficultyDC: Math.min(25, dc),
      brewingTime: durationText,
      marketValuePo: Math.round(valuePo),
      mainEffects,
      sideEffect,
      shelfLife: `${shelfMonths} mois`,
      flavorText: `Savante alliance de ${activePlants.length} herbe(s) et ${activeMinerals.length} minéral(aux) distillés dans ${activeLiquid.name.toLowerCase()}.`,
    };
  }

  const currentAnalysis = $derived(generateCompoundAnalysis());

  // Handle brewing trial roll
  function handleBrewTest(customRoll?: number) {
    isBrewing = true;
    brewResult = null;

    setTimeout(() => {
      const d20 = customRoll !== undefined
        ? Math.min(20, Math.max(1, customRoll))
        : (diceMode === 'manual' ? Math.min(20, Math.max(1, manualD20)) : Math.floor(Math.random() * 20) + 1);

      const total = d20 + alchemistBonus;
      const critSuccess = d20 === 20;
      const critFail = d20 === 1;
      const success = (total >= currentAnalysis.difficultyDC || critSuccess) && !critFail;

      let msg = '';
      if (critSuccess || total >= currentAnalysis.difficultyDC + 5) {
        msg = `Réussite Magistrale (${total} vs DD ${currentAnalysis.difficultyDC}) ! Condensation parfaite dans le serpentin de cuivre : les principes actifs sont cristallisés sans la moindre impureté. Vous obtenez 2 fioles au lieu d'une !`;
      } else if (success) {
        msg = `Réussite (${total} vs DD ${currentAnalysis.difficultyDC}) ! La fiole s'emplit d'un liquide chatoyant au parfum d'herbes et de minéraux nobles. Prête à l'emploi.`;
      } else if (critFail) {
        msg = `1 Naturel ! Explosion dans l'alambic ! Les vapeurs de mercure et de sève acide ont fait sauter le bouchon de verre (1d4 dégâts d'acide et ingrédients perdus).`;
      } else {
        msg = `Échec de décantation (${total} vs DD ${currentAnalysis.difficultyDC}). Le mélange a surchauffé et a formé un résidu pâteux inerte. Vos ingrédients sont consumés.`;
      }

      brewResult = {
        roll: d20,
        total,
        dc: currentAnalysis.difficultyDC,
        success,
        critSuccess,
        critFail,
        message: msg,
      };

      isBrewing = false;
    }, 400);
  }

  // Save potion to Grimoire
  function handleSaveToGrimoire() {
    const newPotion: CustomPotion = {
      id: `custom_potion_${Date.now()}`,
      ...currentAnalysis,
      createdAt: new Date().toLocaleDateString('fr-FR'),
    };

    savedPotions = [newPotion, ...savedPotions];
    saveSuccessMsg = `« ${newPotion.name} » a été consignée dans votre grimoire alchimique !`;
    setTimeout(() => saveSuccessMsg = '', 4000);
  }

  // Remove saved potion
  function handleDeleteSaved(id: string) {
    savedPotions = savedPotions.filter(p => p.id !== id);
  }

  // Load a saved potion into active lab
  function handleLoadSaved(potion: CustomPotion) {
    selectedPlantIds = potion.plantsUsed.map(p => p.id);
    selectedMineralIds = potion.mineralsUsed.map(m => m.id);
    customPotionName = potion.name;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Toggle plant selection (max 3)
  function handleTogglePlant(plantId: string) {
    if (selectedPlantIds.includes(plantId)) {
      selectedPlantIds = selectedPlantIds.filter(id => id !== plantId);
    } else if (selectedPlantIds.length < 3) {
      selectedPlantIds = [...selectedPlantIds, plantId];
    }
  }

  // Toggle mineral selection (max 2)
  function handleToggleMineral(mineralId: string) {
    if (selectedMineralIds.includes(mineralId)) {
      selectedMineralIds = selectedMineralIds.filter(id => id !== mineralId);
    } else if (selectedMineralIds.length < 2) {
      selectedMineralIds = [...selectedMineralIds, mineralId];
    }
  }

  // Expose plant detail callback for ingredient chips
  void onSelectPlant;
</script>

<div class="lab">
  <!-- Banner -->
  <div class="banner">
    <div class="banner-glow"></div>
    <div class="banner-inner">
      <div>
        <div class="banner-tag-wrap">
          <span class="banner-tag">⚗️ Laboratoire de Concoction Hybride Plantes & Minéraux</span>
        </div>
        <h3 class="banner-title">✨ Atelier d'Alchimie Avancé</h3>
        <p class="banner-sub">
          Associez jusqu'à 3 plantes botaniques et 2 minéraux telluriques dans votre alambic. Le moteur calcule en direct les synergies d'effets, le DD de préparation et la valeur de votre concoction.
        </p>
      </div>
      <div class="banner-count">
        <span class="banner-count-label">Recettes consignées :</span>
        <span class="banner-count-value">{savedPotions.length} potion(s)</span>
      </div>
    </div>
  </div>

  <!-- Main Studio Grid -->
  <div class="studio-grid">
    <!-- LEFT COLUMN: INGREDIENTS SELECTOR -->
    <div class="col-left">
      <!-- 1. Base Liquid Solvent -->
      <div class="panel">
        <label class="panel-label" for="liquid-select">💧 1. Base Solvante Liquide</label>
        <select id="liquid-select" bind:value={selectedLiquidId} class="select">
          {#each BASE_LIQUIDS as liq (liq.id)}
            <option value={liq.id}>{liq.name}</option>
          {/each}
        </select>
        <p class="panel-hint">{activeLiquid.role}</p>
      </div>

      <!-- 2. Plant Selection (Max 3) -->
      <div class="panel">
        <div class="panel-head">
          <label class="panel-label">
            <span class="count-badge plants">{selectedPlantIds.length}/3</span>
            2. Plantes & Herbes Sauvages (1 à 3)
          </label>
          <div class="search-wrap">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Filtrer herbe..."
              bind:value={plantSearch}
              class="search-input"
            />
          </div>
        </div>

        <div class="ingredient-grid">
          {#each filteredPlantsList as plant (plant.id)}
            {@const isChecked = selectedPlantIds.includes(plant.id)}
            {@const canSelect = isChecked || selectedPlantIds.length < 3}
            <button
              type="button"
              disabled={!canSelect}
              onclick={() => handleTogglePlant(plant.id)}
              class="ingredient-btn"
              class:checked-plant={isChecked}
              class:disabled={!canSelect}
            >
              <div class="ingredient-row">
                <span class="ingredient-name">{plant.name}</span>
                {#if isChecked}<span class="check-plant">✓</span>{/if}
              </div>
              <span class="ingredient-sub">{plant.partsUsed}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- 3. Mineral Selection (Max 2) -->
      <div class="panel">
        <div class="panel-head">
          <label class="panel-label">
            <span class="count-badge minerals">{selectedMineralIds.length}/2</span>
            3. Minéraux Telluriques & Catalyseurs (1 à 2)
          </label>
          <div class="search-wrap">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Filtrer minéral..."
              bind:value={mineralSearch}
              class="search-input"
            />
          </div>
        </div>

        <div class="ingredient-grid">
          {#each filteredMineralsList as min (min.id)}
            {@const isChecked = selectedMineralIds.includes(min.id)}
            {@const canSelect = isChecked || selectedMineralIds.length < 2}
            <button
              type="button"
              disabled={!canSelect}
              onclick={() => handleToggleMineral(min.id)}
              class="ingredient-btn"
              class:checked-mineral={isChecked}
              class:disabled={!canSelect}
            >
              <div class="ingredient-row">
                <span class="ingredient-name">{min.name}</span>
                {#if isChecked}<span class="check-mineral">✓</span>{/if}
              </div>
              <span class="ingredient-price">{min.basePricePerLingot} PO</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Quick Custom Potion Naming Field -->
      <div class="panel">
        <label class="panel-label-sm" for="potion-name">Nom Personnalisé de votre Création (Optionnel) :</label>
        <input
          id="potion-name"
          type="text"
          placeholder={currentAnalysis.name}
          bind:value={customPotionName}
          class="select"
        />
      </div>
    </div>

    <!-- RIGHT COLUMN: REAL-TIME COMPOUND ANALYSIS & ALEMBIC BREWING -->
    <div class="col-right">
      <!-- Potion Identity Card -->
      <div class="identity-card">
        <div class="identity-head">
          <div>
            <span class="identity-tag">{currentAnalysis.potionType} · {currentAnalysis.rarity}</span>
            <h4 class="identity-name">{currentAnalysis.name}</h4>
            <p class="identity-flavor">{currentAnalysis.flavorText}</p>
          </div>
          <div class="identity-price">
            <span class="identity-value">{currentAnalysis.marketValuePo} PO</span>
            <span class="identity-shelf">Conservation : {currentAnalysis.shelfLife}</span>
          </div>
        </div>

        <!-- Quick Stats Grid -->
        <div class="stats-grid">
          <div class="stat-box">
            <span class="stat-label">DD Alchimique Requis</span>
            <span class="stat-value gold">DD {currentAnalysis.difficultyDC}</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">Temps à l'Alambic</span>
            <span class="stat-value blue">{currentAnalysis.brewingTime}</span>
          </div>
        </div>

        <!-- Synthesized Effects List -->
        <div class="effects-block">
          <span class="panel-label">Propriétés & Effets Cumulés :</span>
          <div class="effects-list">
            {#each currentAnalysis.mainEffects as eff, i (i)}
              <div class="effect-item">{eff}</div>
            {/each}
          </div>
        </div>

        <!-- Unstable Side Effect Alert if any -->
        {#if currentAnalysis.sideEffect}
          <div class="side-effect">
            <span class="side-effect-icon">⚠️</span>
            <div>
              <strong class="side-effect-title">Instabilité / Effet Secondaire :</strong>
              <span>{currentAnalysis.sideEffect}</span>
            </div>
          </div>
        {/if}

        <!-- Save to personal Grimoire button -->
        <button onclick={handleSaveToGrimoire} class="save-btn">
          🔖 <span>Consigner cette Recette dans mon Grimoire Alchimique</span>
        </button>

        {#if saveSuccessMsg}
          <div class="save-success">{saveSuccessMsg}</div>
        {/if}
      </div>

      <!-- Alembic Brewing Simulation Card -->
      <div class="panel brewing-panel">
        <div class="panel-head">
          <h4 class="brewing-title">🔥 Test de Concoction à l'Alambic</h4>
          <div class="dice-toggle">
            <button type="button" onclick={() => diceMode = 'virtual'} class:active={diceMode === 'virtual'}>Dé Virtuel</button>
            <button type="button" onclick={() => diceMode = 'manual'} class:active={diceMode === 'manual'}>Jet Manuel</button>
          </div>
        </div>

        <div class="brewing-body">
          <div>
            <label class="bonus-label" for="bonus-range">
              Bonus Alchimiste (Intelligence + Outils) : <strong>+{alchemistBonus}</strong>
            </label>
            <input
              id="bonus-range"
              type="range"
              min="0"
              max="15"
              bind:value={alchemistBonus}
              class="range"
            />
          </div>

          {#if diceMode === 'manual'}
            <div class="manual-roll">
              <div class="manual-row">
                <label class="bonus-label" for="manual-d20">Résultat sur votre dé physique (1-20) :</label>
                <input
                  id="manual-d20"
                  type="number"
                  min="1"
                  max="20"
                  bind:value={manualD20}
                  class="d20-input"
                />
              </div>
              <button onclick={() => handleBrewTest(manualD20)} disabled={isBrewing} class="brew-btn">
                ✓ <span>Valider mon jet ({manualD20}) vs DD {currentAnalysis.difficultyDC}</span>
              </button>
            </div>
          {:else}
            <button onclick={() => handleBrewTest()} disabled={isBrewing} class="brew-btn">
              <span class:spin={isBrewing}>⚗️</span>
              <span>{isBrewing ? 'Distillation en cours...' : `Chauffer l'Alambic (d20 + ${alchemistBonus})`}</span>
            </button>
          {/if}

          {#if brewResult}
            <div
              class="brew-result"
              class:crit={brewResult.critSuccess}
              class:success={!brewResult.critSuccess && brewResult.success}
              class:critfail={brewResult.critFail}
              class:fail={!brewResult.success && !brewResult.critFail}
            >
              <div class="brew-result-head">
                <span>d20:{brewResult.roll} + {alchemistBonus} = {brewResult.total} (DD {brewResult.dc})</span>
                <span>{brewResult.success ? 'DISTILLATION RÉUSSIE' : 'ÉCHEC'}</span>
              </div>
              <p>{brewResult.message}</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- SAVED CUSTOM RECIPES GRIMOIRE SHELF -->
  {#if savedPotions.length > 0}
    <div class="panel shelf">
      <div class="panel-head">
        <h4 class="shelf-title">📖 Grimoire des Potions Personnalisées Enregistrées ({savedPotions.length})</h4>
      </div>

      <div class="shelf-grid">
        {#each savedPotions as potion (potion.id)}
          <div class="shelf-card">
            <div>
              <div class="shelf-card-head">
                <div>
                  <strong class="shelf-card-name">{potion.name}</strong>
                  <span class="shelf-card-type">{potion.potionType} · {potion.rarity}</span>
                </div>
                <span class="shelf-card-price">{potion.marketValuePo} PO</span>
              </div>
              <div class="shelf-card-body">
                <div>
                  <strong class="shelf-ing-label">Ingrédients : </strong>
                  <span>{potion.plantsUsed.map(p => p.name).join(', ')} + {potion.mineralsUsed.map(m => m.name).join(', ')}</span>
                </div>
                <div class="shelf-liquid">{potion.baseLiquid}</div>
              </div>
            </div>

            <div class="shelf-card-actions">
              <button onclick={() => handleLoadSaved(potion)} class="load-btn">
                🔄 <span>Charger dans l'Alambic</span>
              </button>
              <button onclick={() => handleDeleteSaved(potion.id)} class="delete-btn" title="Supprimer du grimoire">
                🗑️
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .lab {
    display: flex;
    flex-direction: column;
    gap: 24px;
    font-family: serif;
  }

  /* Banner */
  .banner {
    background: var(--bg-secondary);
    border: 2px solid color-mix(in srgb, var(--accent-secondary, #a855f7) 60%, transparent);
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    position: relative;
    overflow: hidden;
  }
  .banner-glow {
    position: absolute;
    right: -40px;
    bottom: -40px;
    width: 240px;
    height: 240px;
    background: var(--accent-bg);
    border-radius: 50%;
    filter: blur(48px);
    pointer-events: none;
  }
  .banner-inner {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .banner-tag-wrap { margin-bottom: 4px; }
  .banner-tag {
    font-size: 10px;
    padding: 2px 10px;
    border-radius: 4px;
    background: #3b0764;
    color: #e9d5ff;
    border: 1px solid rgba(192, 132, 252, 0.5);
    text-transform: uppercase;
    letter-spacing: 2px;
    font-family: monospace;
    font-weight: bold;
  }
  .banner-title {
    font-size: 28px;
    font-weight: 800;
    color: var(--accent);
    margin: 4px 0 0;
  }
  .banner-sub {
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
    margin-top: 4px;
    max-width: 700px;
    line-height: 1.6;
  }
  .banner-count { text-align: right; flex-shrink: 0; }
  .banner-count-label { font-size: 12px; color: var(--text-muted); display: block; }
  .banner-count-value { font-size: 20px; font-family: monospace; font-weight: bold; color: var(--accent); }

  /* Grid */
  .studio-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
  }
  @media (min-width: 1024px) {
    .studio-grid { grid-template-columns: 1fr 1fr; }
  }
  .col-left, .col-right {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Panels */
  .panel {
    background: var(--bg-secondary);
    padding: 18px;
    border-radius: 12px;
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }
  .panel-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: bold;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .panel-label-sm {
    font-size: 12px;
    font-weight: bold;
    color: var(--accent);
  }
  .panel-hint { font-size: 11px; color: var(--text-muted); font-style: italic; margin: 0; }
  .panel-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 8px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .select {
    width: 100%;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
    font-size: 12px;
    color: var(--text-primary);
    outline: none;
  }
  .select:focus { border-color: var(--accent); }

  .count-badge {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    color: white;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-family: monospace;
  }
  .count-badge.plants { background: #15803d; }
  .count-badge.minerals { background: #854d0e; }

  .search-wrap { position: relative; width: 160px; }
  .search-icon {
    position: absolute;
    left: 8px;
    top: 6px;
    font-size: 11px;
    opacity: 0.7;
  }
  .search-input {
    width: 100%;
    padding: 4px 8px 4px 26px;
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    font-size: 10px;
    color: var(--text-primary);
    outline: none;
  }

  /* Ingredient grid */
  .ingredient-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    max-height: 224px;
    overflow-y: auto;
    padding-right: 4px;
  }
  @media (min-width: 640px) {
    .ingredient-grid { grid-template-columns: repeat(3, 1fr); }
  }
  .ingredient-btn {
    padding: 8px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-primary);
    color: var(--text-secondary);
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: var(--transition-fast);
    font-family: serif;
  }
  .ingredient-btn:hover:not(.disabled) { background: var(--bg-hover); }
  .ingredient-btn.checked-plant {
    background: #27381d;
    border-color: #4ade80;
    color: #f0fdf4;
  }
  .ingredient-btn.checked-mineral {
    background: #3d2719;
    border-color: var(--accent);
    color: var(--accent);
  }
  .ingredient-btn.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .ingredient-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
  }
  .ingredient-name {
    font-weight: bold;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .check-plant { color: #4ade80; flex-shrink: 0; font-size: 11px; }
  .check-mineral { color: var(--accent); flex-shrink: 0; font-size: 11px; }
  .ingredient-sub, .ingredient-price {
    font-size: 9px;
    color: var(--text-muted);
    margin-top: 4px;
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ingredient-price { color: #38bdf8; }

  /* Identity card */
  .identity-card {
    background: var(--bg-secondary);
    border-radius: 12px;
    border: 2px solid var(--accent);
    padding: 24px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .identity-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 12px;
    flex-wrap: wrap;
  }
  .identity-tag {
    font-size: 10px;
    font-family: monospace;
    font-weight: bold;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 4px;
    background: #451a03;
    color: #fcd34d;
    border: 1px solid rgba(217, 119, 6, 0.4);
  }
  .identity-name {
    font-size: 24px;
    font-weight: bold;
    color: var(--accent);
    margin: 4px 0 0;
  }
  .identity-flavor { font-size: 11px; color: var(--text-muted); font-style: italic; margin: 2px 0 0; }
  .identity-price { text-align: right; }
  .identity-value {
    font-size: 20px;
    font-family: monospace;
    font-weight: 800;
    color: var(--accent);
    display: block;
  }
  .identity-shelf { font-size: 10px; color: var(--text-muted); }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    text-align: center;
    font-size: 12px;
  }
  .stat-box {
    background: var(--bg-primary);
    padding: 8px;
    border-radius: 6px;
    border: 1px solid var(--border-subtle);
  }
  .stat-label { font-size: 10px; color: var(--text-muted); display: block; }
  .stat-value { font-size: 18px; font-family: monospace; font-weight: bold; }
  .stat-value.gold { color: var(--accent); }
  .stat-value.blue { color: #38bdf8; }

  .effects-block { display: flex; flex-direction: column; gap: 8px; }
  .effects-list { display: flex; flex-direction: column; gap: 6px; }
  .effect-item {
    padding: 10px;
    border-radius: 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .side-effect {
    padding: 12px;
    background: rgba(69, 26, 3, 0.6);
    border-radius: 8px;
    border: 1px solid #f59e0b;
    font-size: 12px;
    color: #fed7aa;
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .side-effect-icon { flex-shrink: 0; margin-top: 2px; }
  .side-effect-title { display: block; font-weight: bold; color: #fcd34d; }

  .save-btn {
    width: 100%;
    padding: 10px;
    background: #3b271a;
    color: var(--accent);
    border: 1px solid var(--accent);
    font-weight: bold;
    font-size: 12px;
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: var(--transition-fast);
    font-family: serif;
  }
  .save-btn:hover { background: #4a3424; }

  .save-success {
    padding: 8px;
    text-align: center;
    font-size: 12px;
    font-weight: bold;
    color: var(--success);
    background: rgba(20, 83, 45, 0.4);
    border-radius: 6px;
    border: 1px solid var(--success);
  }

  /* Brewing */
  .brewing-panel { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35); }
  .brewing-title {
    font-weight: bold;
    font-size: 14px;
    color: var(--accent);
    margin: 0;
  }
  .dice-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--bg-primary);
    padding: 2px;
    border-radius: 6px;
    border: 1px solid var(--border-subtle);
  }
  .dice-toggle button {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: var(--transition-fast);
  }
  .dice-toggle button.active {
    background: #854d0e;
    color: white;
    font-weight: bold;
  }
  .brewing-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-size: 12px;
  }
  .bonus-label { display: block; color: var(--text-muted); margin-bottom: 4px; }
  .bonus-label strong { color: var(--accent); }
  .range { width: 100%; accent-color: var(--accent); }

  .manual-roll { display: flex; flex-direction: column; gap: 8px; }
  .manual-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .d20-input {
    width: 64px;
    padding: 4px 8px;
    background: var(--bg-primary);
    border: 1px solid var(--accent);
    border-radius: 6px;
    text-align: center;
    font-size: 14px;
    font-weight: bold;
    color: var(--accent);
    font-family: monospace;
    outline: none;
  }

  .brew-btn {
    width: 100%;
    padding: 12px;
    background: #b45309;
    color: white;
    font-weight: bold;
    border: none;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: var(--transition-fast);
    font-family: serif;
    font-size: 13px;
  }
  .brew-btn:hover:not(:disabled) { background: #d97706; }
  .brew-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .spin { display: inline-block; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .brew-result {
    padding: 12px;
    border-radius: 8px;
    border: 1px solid;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .brew-result.crit { background: rgba(20, 83, 45, 0.4); border-color: var(--success); color: var(--success); }
  .brew-result.success { background: rgba(30, 58, 95, 0.4); border-color: #38bdf8; color: #bae6fd; }
  .brew-result.critfail { background: rgba(69, 10, 10, 0.5); border-color: var(--danger); color: #fca5a5; }
  .brew-result.fail { background: #291b16; border-color: #78350f; color: var(--accent); }
  .brew-result-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: monospace;
    font-weight: bold;
  }
  .brew-result p { margin: 0; font-family: serif; line-height: 1.6; }

  /* Shelf */
  .shelf { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35); }
  .shelf-title {
    font-weight: bold;
    font-size: 18px;
    color: var(--accent);
    margin: 0;
  }
  .shelf-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }
  @media (min-width: 768px) {
    .shelf-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 1024px) {
    .shelf-grid { grid-template-columns: repeat(3, 1fr); }
  }
  .shelf-card {
    background: var(--bg-primary);
    padding: 16px;
    border-radius: 12px;
    border: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 12px;
    transition: var(--transition-fast);
  }
  .shelf-card:hover { border-color: var(--accent); }
  .shelf-card-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 6px;
    gap: 8px;
  }
  .shelf-card-name { font-size: 14px; color: var(--accent); display: block; }
  .shelf-card-type { font-size: 10px; color: var(--text-muted); }
  .shelf-card-price {
    font-family: monospace;
    font-size: 12px;
    font-weight: bold;
    color: var(--accent);
    flex-shrink: 0;
  }
  .shelf-card-body {
    font-size: 11px;
    color: var(--text-secondary);
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 8px;
  }
  .shelf-ing-label { color: var(--text-muted); }
  .shelf-liquid { font-size: 10px; color: #b45309; font-style: italic; }
  .shelf-card-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 8px;
    border-top: 1px solid var(--border-subtle);
  }
  .load-btn {
    font-size: 12px;
    color: #38bdf8;
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0;
  }
  .load-btn:hover { text-decoration: underline; }
  .delete-btn {
    font-size: 12px;
    background: none;
    border: none;
    color: var(--danger);
    cursor: pointer;
    padding: 4px;
  }
  .delete-btn:hover { opacity: 0.8; }
</style>
