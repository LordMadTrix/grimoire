<script lang="ts">
  import type { Plant, BiomeType, RarityType } from '$lib/herboriste/types/herb';
  import { RARITY_METADATA } from '$lib/herboriste/data/herbalistData';
  import BiomeEncountersAndRarityView from './BiomeEncountersAndRarityView.svelte';

  let {
    plants,
    onSelectPlant,
    onNavigateToSimulator,
  }: {
    plants: Plant[];
    onSelectPlant?: (plant: Plant) => void;
    onNavigateToSimulator?: () => void;
  } = $props();

  // Biome Difficulty Modifiers and Environmental Profiles
  export const BIOME_DC_PROFILES: Record<BiomeType, {
    name: string;
    baseDcMod: number; // Modificateur de terrain
    terrainDifficulty: 'Facile' | 'Moyen' | 'Difficile' | 'Extrême';
    primarySkill: 'Sagesse (Survie)' | 'Intelligence (Nature)' | 'Mixte';
    hazards: string;
    botanicalTraits: string;
    icon: string;
    color: string;
    optimalTime: string;
  }> = {
    foret: {
      name: 'Forêts & Bois Anciens',
      baseDcMod: 0,
      terrainDifficulty: 'Moyen',
      primarySkill: 'Sagesse (Survie)',
      hazards: 'Racines traîtresses, tiques sylvestres, prédateurs camouflés (loups, guenaudes).',
      botanicalTraits: 'Humus riche, sous-bois ombragé, mousses sur les troncs au nord, clairières ensoleillées.',
      icon: 'Trees',
      color: '#15803d',
      optimalTime: 'Matinée après la rosée ou début de printemps.',
    },
    plaine: {
      name: 'Plaines & Prairies Ouvertes',
      baseDcMod: -1,
      terrainDifficulty: 'Facile',
      primarySkill: 'Intelligence (Nature)',
      hazards: 'Soleil de plomb sans abri, terriers d\'animaux cachés dans les hautes herbes, moustiques de ruisseau.',
      botanicalTraits: 'Vaste visibilité, herbacées fleuries annuelles, graminées denses, bordures de chemins.',
      icon: 'Sun',
      color: '#ca8a04',
      optimalTime: 'Plein midi pour les corolles ouvertes sous le soleil.',
    },
    marais: {
      name: 'Marais & Tourbières Fangeuses',
      baseDcMod: +2,
      terrainDifficulty: 'Difficile',
      primarySkill: 'Sagesse (Survie)',
      hazards: 'Sables mouvants, miasmes toxiques, sangsues géantes, eaux croupies nécessitant des bottes étanches.',
      botanicalTraits: 'Mousses spongieuses, sève visqueuse, plantes carnivores, spore de putréfaction.',
      icon: 'Droplets',
      color: '#0f766e',
      optimalTime: 'Crépuscule lorsque les brumes stagnent et les feux-follets s\'éveillent.',
    },
    montagne: {
      name: 'Montagnes & Falaises Rocailleuses',
      baseDcMod: +3,
      terrainDifficulty: 'Extrême',
      primarySkill: 'Sagesse (Survie)',
      hazards: 'Éboulis rocheux, vents violents à 80 km/h, froid mordant, nids de vouivres ou harpies.',
      botanicalTraits: 'Plantes naines tapissantes, racines s\'incrustant dans les failles de granit, fleurs d\'altitude très résistantes.',
      icon: 'Mountain',
      color: '#475569',
      optimalTime: 'Aurore par temps clair avant que les nuages orographiques n\'enveloppent les pics.',
    },
    caverne: {
      name: 'Cavernes & Abysses d\'Outreterre',
      baseDcMod: +3,
      terrainDifficulty: 'Extrême',
      primarySkill: 'Intelligence (Nature)',
      hazards: 'Obscurité aveuglante, champignons hallucinogènes, éboulements, créatures à vision dans le noir (troglodytes).',
      botanicalTraits: 'Fonge bioluminescente, mousses sans chlorophylle, lichens d\'humidité, spores souterraines.',
      icon: 'EyeOff',
      color: '#7e22ce',
      optimalTime: 'Indifférent au jour/nuit ; requiert source lumineuse stable ou vision dans le noir.',
    },
    aquatique: {
      name: 'Côtes, Rives Fluviales & Récifs',
      baseDcMod: +1,
      terrainDifficulty: 'Difficile',
      primarySkill: 'Mixte',
      hazards: 'Courants sous-marins, marées montantes imprévisibles, rochers glissants couverts d\'algues vertes.',
      botanicalTraits: 'Algue laminaire, coraux d\'eau douce, nénuphars géants, tiges flexibles suivant le flot.',
      icon: 'Waves',
      color: '#0284c7',
      optimalTime: 'Marée basse ou matin calme sur les berges fluviales.',
    },
    desert: {
      name: 'Déserts & Terres Arides',
      baseDcMod: +3,
      terrainDifficulty: 'Extrême',
      primarySkill: 'Sagesse (Survie)',
      hazards: 'Déshydratation fulgurante, mirages thermiques, scorpions des sables, tempêtes de poussière.',
      botanicalTraits: 'Succulentes à épines épaisses, tubercules gorgés d\'eau enfouis à 1 mètre sous le sable.',
      icon: 'Flame',
      color: '#ea580c',
      optimalTime: 'Nuit fraîche juste avant l\'aube (floraisons éphémères de 2 heures).',
    },
  };

  // Calculator states
  let selectedBiome = $state<BiomeType>('foret');
  let targetRarity = $state<RarityType>('rare');
  let weatherCondition = $state<number>(0); // 0 = standard, +2 rain, +4 storm, -2 moonlight
  let weatherDescription = $state<string>('Climat clément / Tempéré (Normal)');
  let searchDurationMod = $state<number>(0); // +2 for 1h, 0 for 4h, -2 for 8h
  let searchDurationLabel = $state<string>('Recherche standard de 4 heures');
  let equipmentToolsMod = $state<number>(-1); // -1 kit herboriste, -2 familier, +1 mains nues
  let equipmentLabel = $state<string>('Trousse d\'Herboristerie entretenue (-1 au DD)');

  // Quick test roller in calculator
  let testerBonus = $state<number>(4);
  let testDiceMode = $state<'virtual' | 'manual'>('virtual');
  let manualD20 = $state<number>(14);
  let testResult = $state<{
    roll: number;
    total: number;
    dc: number;
    success: boolean;
    critSuccess: boolean;
    critFail: boolean;
    message: string;
  } | null>(null);

  // Active guide sub-tab
  let activeGuideTab = $state<'calculator' | 'rules' | 'biomes' | 'encounters' | 'toxics'>('calculator');

  // Compute Base DC by Rarity
  const rarityBaseDcs: Record<RarityType, number> = {
    commune: 10,
    peu_commune: 13,
    rare: 16,
    tres_rare: 19,
    legendaire: 23,
  };

  const baseRarityDc = $derived(rarityBaseDcs[targetRarity]);
  const biomeProfile = $derived(BIOME_DC_PROFILES[selectedBiome]);
  const biomeMod = $derived(biomeProfile.baseDcMod);

  // Final calculated DC formula
  const calculatedDC = $derived(
    Math.max(5, baseRarityDc + biomeMod + weatherCondition + searchDurationMod + equipmentToolsMod)
  );

  // Find plants in this biome matching this rarity
  const matchingPlants = $derived(
    plants.filter((p) => p.biome === selectedBiome && p.rarity === targetRarity)
  );

  const weatherLabels: Record<number, string> = {
    0: 'Climat clément / Tempéré (Normal)',
    2: 'Pluie battante / Brouillard épais (+2 au DD)',
    4: 'Tempête de neige / Canicule accablante (+4 au DD)',
    3: 'Nuit noire sans éclairage (+3 au DD)',
    '-2': 'Nuit de pleine lune lumineuse (-2 au DD)',
  };

  const durationOptions = [
    { mod: 2, label: 'Fouille Rapide (1h)', desc: '+2 au DD (hâtive)' },
    { mod: 0, label: 'Recherche Standard (4h)', desc: 'DD normal (recommandé)' },
    { mod: -2, label: 'Journée Complète (8h)', desc: '-2 au DD (prospection à fond)' },
  ];

  const equipmentOptions = [
    { mod: -1, label: 'Trousse d\'Herboristerie', desc: '-1 au DD (couteaux & fioles)' },
    { mod: -2, label: 'Familier / Chien Truffier', desc: '-2 au DD (odorat affûté)' },
    { mod: 1, label: 'Mains Nues / Couteau seul', desc: '+1 au DD (prélèvement hasardeux)' },
  ];

  const toxicLookalikes = [
    {
      searched: 'Athelas (Feuille Royale)',
      lookalike: 'Fausse-Morelle des Marais',
      consequence: 'Au lieu de soigner les blessures, l\'onguent provoque d\'intenses démangeaisons et un désavantage aux tests de Force pendant 8 heures.',
      dangerLevel: 'Modéré',
    },
    {
      searched: 'Lotus d\'Or Solaire',
      lookalike: 'Bouton d\'Or Pyrophore',
      consequence: 'Explose en poussière urticante dès qu\'on le chauffe dans l\'alambic (2d6 dégâts de feu au visage et aveuglement 1 heure).',
      dangerLevel: 'Très Élevé',
    },
    {
      searched: 'Belladone Vénéneuse (pour antalgique)',
      lookalike: 'Jusquiame Noire Concentrée',
      consequence: 'Provoque des délires hallucinatoires incontrôlables : le joueur voit ses compagnons comme des démons hideux.',
      dangerLevel: 'Grave',
    },
    {
      searched: 'Fleur de Lune Nocturne',
      lookalike: 'Blanche-Givrée des Morts',
      consequence: 'Gèle immédiatement l\'eau de la potion en cristal coupant, brisant la fiole en morceaux dans la sacoche.',
      dangerLevel: 'Matériel',
    },
  ];

  // Test roll against calculated DC
  function handleTestRoll(customD20?: number) {
    const d20 = customD20 !== undefined
      ? Math.min(20, Math.max(1, customD20))
      : (testDiceMode === 'manual' ? Math.min(20, Math.max(1, manualD20)) : Math.floor(Math.random() * 20) + 1);

    const total = d20 + testerBonus;
    const critSuccess = d20 === 20;
    const critFail = d20 === 1;
    const success = (total >= calculatedDC || critSuccess) && !critFail;

    let msg = '';
    if (critSuccess) {
      msg = `20 Naturel ! Coup de chance extraordinaire : vous découvrez une colonie de spécimens en floraison parfaite avec graines reproductibles (double dose récoltée).`;
    } else if (success) {
      if (total >= calculatedDC + 5) {
        msg = `Réussite éclatante (${total} vs DD ${calculatedDC}) ! Le spécimen est prélevé intact avec 1 dose supplémentaire bonus.`;
      } else {
        msg = `Réussite (${total} vs DD ${calculatedDC}) ! Vous identifiez et taillez 1 dose prête pour le séchage ou l'alchimie.`;
      }
    } else if (critFail) {
      msg = `1 Naturel : Échec critique ! Piqûre de sève vénéneuse ou confusion avec un sosie toxique (1d6 dégâts de poison et perte de 2 heures).`;
    } else {
      msg = `Échec (${total} vs DD ${calculatedDC}). Les recherches n'ont rien donné dans ce secteur : flore stérile ou saison passée.`;
    }

    testResult = {
      roll: d20,
      total,
      dc: calculatedDC,
      success,
      critSuccess,
      critFail,
      message: msg,
    };
  }
</script>

<div class="view-root">
  <!-- Page Header -->
  <div class="header-panel">
    <div class="header-row">
      <div>
        <div class="header-badges">
          <span class="badge">
            Manuel Officiel des Maîtres de Jeu & Herboristes
          </span>
          <span class="badge-note">Système D&D 5e / JDR Médiéval-Fantastique</span>
        </div>
        <h2 class="header-title">
          <span>🔖</span>
          Le Guide du Récolteur & Calculateur de Difficulté (DD)
        </h2>
        <p class="header-desc">
          Comprendre les mécaniques de Degrés de Difficulté (DD / DC), les phases d'investigation botanique, les risques de faux-amis toxiques et calculer le DD exact selon le biome et la météo.
        </p>
      </div>

      {#if onNavigateToSimulator}
        <button class="btn-simulator" onclick={onNavigateToSimulator}>
          <span>🧭</span>
          <span>Aller au Simulateur de Cueillette</span>
        </button>
      {/if}
    </div>

    <!-- Sub-Tabs Selector -->
    <div class="tabs">
      <button
        onclick={() => (activeGuideTab = 'calculator')}
        class="tab-btn"
        class:tab-active={activeGuideTab === 'calculator'}
      >
        <span>🧮</span>
        <span>Outil de Calcul de DD par Biome</span>
      </button>

      <button
        onclick={() => (activeGuideTab = 'rules')}
        class="tab-btn"
        class:tab-active={activeGuideTab === 'rules'}
      >
        <span>❓</span>
        <span>Les 4 Phases de la Cueillette</span>
      </button>

      <button
        onclick={() => (activeGuideTab = 'biomes')}
        class="tab-btn"
        class:tab-active={activeGuideTab === 'biomes'}
      >
        <span>🌲</span>
        <span>Profils des 8 Biomes</span>
      </button>

      <button
        onclick={() => (activeGuideTab = 'encounters')}
        class="tab-btn"
        class:tab-active={activeGuideTab === 'encounters'}
      >
        <span>🎲</span>
        <span>Rencontres & Table de Rareté</span>
      </button>

      <button
        onclick={() => (activeGuideTab = 'toxics')}
        class="tab-btn"
        class:tab-active={activeGuideTab === 'toxics'}
      >
        <span>⚠️</span>
        <span>Sosies Toxiques & Échecs Critiques</span>
      </button>
    </div>
  </div>

  <!-- SECTION 1: INTERACTIVE DC CALCULATOR BY BIOME -->
  {#if activeGuideTab === 'calculator'}
    <div class="calc-grid">
      <!-- Left Column: Form Controls -->
      <div class="panel panel-form">
        <div class="panel-header">
          <h3 class="panel-title">
            <span>🧮</span>
            Calculateur de Degré de Difficulté (DD / DC)
          </h3>
          <p class="panel-subtitle">
            Ajustez les paramètres de terrain, la rareté recherchée et les conditions pour générer le seuil exact du test.
          </p>
        </div>

        <!-- 1. Biome Selector -->
        <div class="field">
          <span class="field-label">1. Type de Biome & Environnement Géographique</span>
          <div class="grid-biomes">
            {#each Object.entries(BIOME_DC_PROFILES) as [key, bio] (key)}
              <button
                type="button"
                onclick={() => (selectedBiome = key as BiomeType)}
                class="card-biome"
                class:selected={selectedBiome === key}
              >
                <span class="card-biome-name">{bio.name.split(' ')[0]}</span>
                <div class="card-biome-meta">
                  <span>{bio.terrainDifficulty}</span>
                  <strong class:mod-pos={bio.baseDcMod > 0} class:mod-neg={bio.baseDcMod < 0} class:mod-zero={bio.baseDcMod === 0}>
                    {bio.baseDcMod > 0 ? `+${bio.baseDcMod}` : bio.baseDcMod}
                  </strong>
                </div>
              </button>
            {/each}
          </div>
        </div>

        <!-- 2. Target Rarity -->
        <div class="field">
          <span class="field-label">2. Rareté de la Plante Ciblée</span>
          <div class="grid-rarity">
            {#each Object.entries(RARITY_METADATA) as [key, meta] (key)}
              {@const baseDc = rarityBaseDcs[key as RarityType]}
              <button
                type="button"
                onclick={() => (targetRarity = key as RarityType)}
                class="card-rarity"
                class:selected={targetRarity === key}
              >
                <span class="card-rarity-name" style="color: {meta.color}">
                  {meta.label}
                </span>
                <span class="card-rarity-dc">
                  Base DD {baseDc}
                </span>
              </button>
            {/each}
          </div>
        </div>

        <!-- 3. Weather Conditions -->
        <div class="field">
          <span class="field-label">3. Conditions Météorologiques & Éléments</span>
          <select
            value={weatherCondition}
            onchange={(e) => {
              const val = parseInt(e.currentTarget.value);
              weatherCondition = val;
              weatherDescription = weatherLabels[val] || 'Météo particulière';
            }}
            class="select-weather"
          >
            <option value="0">☀️ Climat clément / Tempéré (Modificateur 0)</option>
            <option value="2">🌧️ Pluie battante ou Brouillard épais (+2 au DD)</option>
            <option value="4">❄️ Tempête de neige ou Canicule accablante (+4 au DD)</option>
            <option value="3">🌑 Nuit noire sans torche (+3 au DD)</option>
            <option value="-2">🌕 Nuit de pleine lune lumineuse (-2 au DD pour herbes nocturnes)</option>
          </select>
        </div>

        <!-- 4. Search Duration -->
        <div class="field">
          <span class="field-label">4. Temps Consacré à la Recherche</span>
          <div class="grid-three">
            {#each durationOptions as item, idx (idx)}
              <button
                type="button"
                onclick={() => {
                  searchDurationMod = item.mod;
                  searchDurationLabel = item.label;
                }}
                class="card-option"
                class:selected={searchDurationMod === item.mod}
              >
                <span class="card-option-label">{item.label}</span>
                <span class="card-option-desc">{item.desc}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- 5. Tools & Preparation -->
        <div class="field">
          <span class="field-label">5. Équipement & Outils d'Herboriste</span>
          <div class="grid-three">
            {#each equipmentOptions as item, idx (idx)}
              <button
                type="button"
                onclick={() => {
                  equipmentToolsMod = item.mod;
                  equipmentLabel = item.label;
                }}
                class="card-option"
                class:selected={equipmentToolsMod === item.mod}
              >
                <span class="card-option-label">{item.label}</span>
                <span class="card-option-desc">{item.desc}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Right Column: Calculated Results & Live Test Simulator -->
      <div class="results-col">
        <!-- The Big DC Result Plaque -->
        <div class="dc-plaque">
          <span class="dc-overline">
            Degré de Difficulté Recommandé (DD)
          </span>

          <div class="dc-circle">
            <span class="dc-value">
              DD {calculatedDC}
            </span>
          </div>

          <!-- Mathematical breakdown -->
          <div class="dc-breakdown">
            <div class="dc-line">
              <span>Base Rareté ({RARITY_METADATA[targetRarity].label}) :</span>
              <span class="dc-num gold">{baseRarityDc}</span>
            </div>
            <div class="dc-line">
              <span>Terrain ({biomeProfile.name.split(' ')[0]}) :</span>
              <span class:dc-num-red={biomeMod > 0} class:dc-num-green={biomeMod <= 0} class="dc-num">
                {biomeMod >= 0 ? `+${biomeMod}` : biomeMod}
              </span>
            </div>
            <div class="dc-line">
              <span>Météo :</span>
              <span class:dc-num-red={weatherCondition > 0} class:dc-num-green={weatherCondition < 0} class:dc-num-muted={weatherCondition === 0} class="dc-num">
                {weatherCondition >= 0 ? `+${weatherCondition}` : weatherCondition}
              </span>
            </div>
            <div class="dc-line">
              <span>Durée :</span>
              <span class:dc-num-red={searchDurationMod > 0} class:dc-num-green={searchDurationMod < 0} class:dc-num-muted={searchDurationMod === 0} class="dc-num">
                {searchDurationMod >= 0 ? `+${searchDurationMod}` : searchDurationMod}
              </span>
            </div>
            <div class="dc-line no-border">
              <span>Équipement :</span>
              <span class:dc-num-green={equipmentToolsMod < 0} class:dc-num-red={equipmentToolsMod >= 0} class="dc-num">
                {equipmentToolsMod >= 0 ? `+${equipmentToolsMod}` : equipmentToolsMod}
              </span>
            </div>
            <div class="dc-total">
              <span>TOTAL :</span>
              <span>DD {calculatedDC}</span>
            </div>
          </div>

          <!-- Recommended Skill -->
          <div class="dc-skill">
            Compétence conseillée : <strong class="dc-skill-value">{biomeProfile.primarySkill}</strong>
          </div>
        </div>

        <!-- Matching Plants in Database for this Biome & Rarity -->
        <div class="panel">
          <div class="panel-header">
            <h4 class="panel-subtitle-heading">
              <span>🌲</span>
              Plantes correspondantes dans le Grimoire ({matchingPlants.length})
            </h4>
          </div>

          {#if matchingPlants.length === 0}
            <p class="empty-note">
              Aucune plante enregistrée avec cette rareté exacte dans ce biome. Vous pouvez utiliser ce DD pour introduire une herbe sauvage homebrew !
            </p>
          {:else}
            <div class="plants-list">
              {#each matchingPlants as plant (plant.id)}
                <button
                  type="button"
                  onclick={() => onSelectPlant && onSelectPlant(plant)}
                  class="plant-row"
                >
                  <div>
                    <div class="plant-name">{plant.name}</div>
                    <div class="plant-latin">{plant.latinName}</div>
                  </div>
                  <span class="plant-dc">
                    Fiche : DD {plant.dcHarvest}
                  </span>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Banc d'essai : Test Roll Simulator -->
        <div class="panel">
          <div class="tester-header">
            <h4 class="panel-subtitle-heading">
              <span>🎲</span>
              Banc d'Essai : Lancer le Test vs DD {calculatedDC}
            </h4>

            <!-- Mode switch -->
            <div class="mode-switch">
              <button
                type="button"
                onclick={() => (testDiceMode = 'virtual')}
                class="mode-btn"
                class:mode-active={testDiceMode === 'virtual'}
              >
                Dé Virtuel
              </button>
              <button
                type="button"
                onclick={() => (testDiceMode = 'manual')}
                class="mode-btn"
                class:mode-active={testDiceMode === 'manual'}
              >
                Jet Manuel
              </button>
            </div>
          </div>

          <div class="tester-body">
            <div>
              <label class="tester-label" for="tester-bonus">
                Bonus du Joueur (Survie ou Nature) : <strong class="gold-text">+{testerBonus}</strong>
              </label>
              <input
                id="tester-bonus"
                type="range"
                min="0"
                max="15"
                value={testerBonus}
                onchange={(e) => (testerBonus = parseInt(e.currentTarget.value) || 0)}
                class="range-input"
              />
            </div>

            {#if testDiceMode === 'manual'}
              <div class="manual-block">
                <div class="manual-row">
                  <label class="manual-label" for="guide-manual-d20">Résultat sur votre dé physique (1-20) :</label>
                  <input
                    id="guide-manual-d20"
                    type="number"
                    min="1"
                    max="20"
                    value={manualD20}
                    onchange={(e) => (manualD20 = parseInt(e.currentTarget.value) || 1)}
                    class="input-number"
                  />
                </div>
                <button
                  class="btn-roll"
                  onclick={() => handleTestRoll(manualD20)}
                >
                  <span>✓</span>
                  <span>Valider mon jet ({manualD20}) vs DD {calculatedDC}</span>
                </button>
              </div>
            {:else}
              <button
                class="btn-roll"
                onclick={() => handleTestRoll()}
              >
                <span>🎲</span>
                <span>Lancer le d20 contre le DD {calculatedDC}</span>
              </button>
            {/if}

            {#if testResult}
              <div
                class="test-result"
                class:result-crit={testResult.critSuccess}
                class:result-success={!testResult.critSuccess && testResult.success}
                class:result-critfail={testResult.critFail}
                class:result-fail={!testResult.success && !testResult.critFail}
              >
                <div class="test-result-row">
                  <span>
                    d20:{testResult.roll} + {testerBonus} = {testResult.total} (DD {testResult.dc})
                  </span>
                  <span>{testResult.success ? 'RÉUSSI' : 'ÉCHEC'}</span>
                </div>
                <p class="test-result-msg">{testResult.message}</p>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- SECTION 2: THE 4 HARVEST PHASES RULES -->
  {#if activeGuideTab === 'rules'}
    <div class="panel rules-panel">
      <div class="panel-header">
        <h3 class="rules-title">
          <span>❓</span>
          Les 4 Phases de la Cueillette Botanique en Jeu de Rôle
        </h3>
        <p class="rules-desc">
          Pour éviter qu'une expédition d'herboristerie ne se résume à un simple jet de dé anonyme, découpez l'action en quatre phases tactiques.
        </p>
      </div>

      <div class="grid-phases">
        <!-- Phase 1 -->
        <div class="phase-card">
          <div class="phase-header">
            <span class="phase-num">1</span>
            <div>
              <h4 class="phase-title">Phase 1 : Recherche & Localisation</h4>
              <span class="phase-skill skill-blue">Compétence : Sagesse (Survie) ou Perception</span>
            </div>
          </div>
          <p class="phase-desc">
            Le personnage scrute le sous-bois, repère l'humidité du sol, suit les sentiers de bêtes brouteuses et analyse les microclimats (versant sud ensoleillé, faille calcaire, pied de chêne centenaire).
          </p>
          <div class="phase-tip">
            <strong>Conseil MJ :</strong> Donnez un indice narratif avant le jet : « En approchant de la berge brumeuse, une odeur d'anis douceâtre flotte dans l'air froid... »
          </div>
        </div>

        <!-- Phase 2 -->
        <div class="phase-card">
          <div class="phase-header">
            <span class="phase-num">2</span>
            <div>
              <h4 class="phase-title">Phase 2 : Identification Botanique</h4>
              <span class="phase-skill skill-purple">Compétence : Intelligence (Nature)</span>
            </div>
          </div>
          <p class="phase-desc">
            Reconnaître le spécimen exact et s'assurer qu'il ne s'agit pas d'un sosie mortel. Le personnage compte les pétales, observe la pilosité de la tige et frotte une feuille pour sentir son suc.
          </p>
          <div class="phase-tip">
            <strong>Règle du Sosie :</strong> En cas d'échec de 5 points sous le DD, le joueur confond la plante avec un faux ami vénéneux (ex: Belladone prise pour une myrtille sauvage).
          </div>
        </div>

        <!-- Phase 3 -->
        <div class="phase-card">
          <div class="phase-header">
            <span class="phase-num">3</span>
            <div>
              <h4 class="phase-title">Phase 3 : Prélèvement & Coupe Précise</h4>
              <span class="phase-skill skill-green">Compétence : Dextérité (Trousse d'Herboristerie)</span>
            </div>
          </div>
          <p class="phase-desc">
            Une incision brutale peut faire suinter et évaporer les alcaloïdes magiques. Il faut inciser à l'ongle ou avec une lame en bronze au niveau de l'insertion foliaire, sans arracher la motte racinaire stérile.
          </p>
          <div class="phase-tip">
            <strong>Outils Nécessaires :</strong> Gants de cuir souple, ciseaux de chirurgien, petite pelle d'argent contre la corruption tellurique.
          </div>
        </div>

        <!-- Phase 4 -->
        <div class="phase-card">
          <div class="phase-header">
            <span class="phase-num">4</span>
            <div>
              <h4 class="phase-title">Phase 4 : Conditionnement & Préservation</h4>
              <span class="phase-skill skill-amber">Procédé : Séchage, Macération ou Alambic</span>
            </div>
          </div>
          <p class="phase-desc">
            Une plante fraîche flétrit en 3 jours dans une besace. Pour la conserver, elle doit être mise sous presse entre deux buvards de lin, plongée dans l'alcool neutre, ou distillée le soir même au bivouac.
          </p>
          <div class="phase-tip">
            <strong>Durées de Conservation :</strong> Fleur fraîche (3 jours) · Séchée sous presse (6 mois) · Macération huileuse (2 ans).
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- SECTION 3: THE 7 BIOMES COMPARATIVE PROFILES -->
  {#if activeGuideTab === 'biomes'}
    <div class="biomes-section">
      <div class="panel">
        <h3 class="biomes-title">
          <span>🌲</span>
          Profils des 7 Biomes de la Terre de Fangh
        </h3>
        <p class="biomes-desc">
          Chaque écosystème impose des défis physiques et magiques propres influant directement sur le DD final de recherche.
        </p>
      </div>

      <div class="grid-biome-cards">
        {#each Object.entries(BIOME_DC_PROFILES) as [key, bio] (key)}
          <div class="biome-card">
            <div class="biome-card-header">
              <div>
                <h4 class="biome-card-name">{bio.name}</h4>
                <span class="biome-card-skill">Compétence : {bio.primarySkill}</span>
              </div>
              <span
                class="biome-card-mod"
                class:mod-badge-red={bio.baseDcMod > 0}
                class:mod-badge-green={bio.baseDcMod <= 0}
              >
                Mod. DD : {bio.baseDcMod >= 0 ? `+${bio.baseDcMod}` : bio.baseDcMod}
              </span>
            </div>

            <div class="biome-card-body">
              <div>
                <strong class="biome-traits-label">Caractéristiques Végétales :</strong>
                <p class="biome-text">{bio.botanicalTraits}</p>
              </div>

              <div>
                <strong class="biome-hazards-label">Dangers & Faune :</strong>
                <p class="biome-text">{bio.hazards}</p>
              </div>

              <div class="biome-time">
                <span>Créneau idéal :</span>
                <span class="biome-time-value">{bio.optimalTime}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- SECTION 4: HARVESTING ENCOUNTERS & RARITY TABLES -->
  {#if activeGuideTab === 'encounters'}
    <BiomeEncountersAndRarityView
      plants={plants}
      onSelectPlant={onSelectPlant}
    />
  {/if}

  <!-- SECTION 5: TOXIC LOOKALIKES & CRITICAL FAILS -->
  {#if activeGuideTab === 'toxics'}
    <div class="panel rules-panel">
      <div class="panel-header">
        <h3 class="toxics-title">
          <span>⚠️</span>
          Table des Sosies Toxiques & Confusions Mortelles
        </h3>
        <p class="rules-desc">
          En cas d'échec critique (1 naturel) ou si le joueur rate son test d'identification de 5 points ou plus, appliquez l'une des confusions ci-dessous pour pimenter la partie !
        </p>
      </div>

      <div class="grid-toxics">
        {#each toxicLookalikes as item, idx (idx)}
          <div class="toxic-card">
            <div class="toxic-header">
              <div>
                <span class="toxic-searched-label">Plante Recherchée :</span>
                <strong class="toxic-searched">{item.searched}</strong>
              </div>
              <span class="toxic-danger">
                {item.dangerLevel}
              </span>
            </div>

            <div>
              <span class="toxic-lookalike-label">Sosie Toxique Récolté par Erreur :</span>
              <strong class="toxic-lookalike">{item.lookalike}</strong>
            </div>

            <p class="toxic-consequence">
              {item.consequence}
            </p>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .view-root {
    max-width: 80rem;
    margin: 0 auto;
    padding: 2rem 1rem;
    font-family: var(--font-serif, 'EB Garamond', Georgia, serif);
    display: flex;
    flex-direction: column;
    gap: 2rem;
    animation: fade-in 0.3s ease;
  }

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .header-panel {
    background: var(--bg-secondary, #1f1915);
    border-radius: 0.75rem;
    border: 1px solid var(--border, #4a3b32);
    padding: 1.5rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  }

  .header-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid #3e2e23;
    padding-bottom: 1rem;
    margin-bottom: 1rem;
  }

  .header-badges {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }
  .badge {
    font-size: 0.625rem;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: #451a03;
    color: #fcd34d;
    border: 1px solid rgba(217, 119, 6, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.2em;
    font-family: monospace;
  }
  .badge-note { font-size: 0.75rem; color: var(--text-muted, #a89988); }

  .header-title {
    font-size: 1.875rem;
    font-weight: 700;
    color: var(--accent, #d4af37);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
  }

  .header-desc {
    font-size: 0.8125rem;
    color: var(--text-secondary, #c4b5a5);
    font-style: italic;
    margin: 0.25rem 0 0;
    max-width: 48rem;
    line-height: 1.625;
  }

  .btn-simulator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #b45309;
    color: white;
    font-size: 0.75rem;
    font-weight: 700;
    border-radius: 0.5rem;
    border: none;
    cursor: pointer;
    transition: var(--transition-fast, all 0.15s ease);
    font-family: inherit;
  }
  .btn-simulator:hover { background: #d97706; }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding-top: 0.25rem;
    font-size: 0.75rem;
  }
  .tab-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-weight: 700;
    transition: var(--transition-fast, all 0.15s ease);
    background: #140f0c;
    color: #d7c9b8;
    border: 1px solid #3e2e23;
    cursor: pointer;
    font-family: inherit;
  }
  .tab-btn:hover { background: #261d17; }
  .tab-btn.tab-active {
    background: #b45309;
    color: white;
    box-shadow: 0 0 0 2px #fde047;
  }

  /* Calculator */
  .calc-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  @media (min-width: 1024px) {
    .calc-grid { grid-template-columns: 7fr 5fr; }
  }

  .panel {
    background: var(--bg-secondary, #1c1612);
    padding: 1.25rem;
    border-radius: 0.75rem;
    border: 1px solid var(--border, #4a3b32);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  }
  .panel-form { gap: 1.5rem; padding: 1.5rem; }

  .panel-header {
    border-bottom: 1px solid #3e2e23;
    padding-bottom: 0.75rem;
  }
  .panel-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #fde047;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }
  .panel-subtitle {
    font-size: 0.75rem;
    color: var(--text-muted, #a89988);
    font-style: italic;
    margin: 0.125rem 0 0;
  }
  .panel-subtitle-heading {
    font-weight: 700;
    font-size: 0.875rem;
    color: #fde047;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }

  .field { display: flex; flex-direction: column; gap: 0.5rem; }
  .field-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 700;
    color: #fef08a;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .grid-biomes {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }
  @media (min-width: 640px) {
    .grid-biomes { grid-template-columns: repeat(4, 1fr); }
  }

  .card-biome {
    padding: 0.625rem;
    border-radius: 0.5rem;
    border: 1px solid #3e2e23;
    background: #140f0c;
    color: var(--text-secondary, #c4b5a5);
    text-align: left;
    transition: var(--transition-fast, all 0.15s ease);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    cursor: pointer;
    font-family: inherit;
  }
  .card-biome:hover { background: #261d17; }
  .card-biome.selected {
    background: #3b271a;
    border-color: var(--accent, #d4af37);
    box-shadow: 0 0 0 1px var(--accent, #d4af37);
    color: #fef08a;
  }
  .card-biome-name {
    font-weight: 700;
    font-size: 0.75rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .card-biome-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.625rem;
    color: var(--text-muted, #a89988);
    margin-top: 0.25rem;
    font-family: monospace;
  }
  .mod-pos { color: #f87171; }
  .mod-neg { color: #4ade80; }
  .mod-zero { color: #cbd5e1; }

  .grid-rarity {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }
  @media (min-width: 640px) {
    .grid-rarity { grid-template-columns: repeat(5, 1fr); }
  }

  .card-rarity {
    padding: 0.625rem;
    border-radius: 0.5rem;
    border: 1px solid #3e2e23;
    background: #140f0c;
    color: var(--text-secondary, #c4b5a5);
    text-align: center;
    transition: var(--transition-fast, all 0.15s ease);
    cursor: pointer;
    font-family: inherit;
  }
  .card-rarity:hover { background: #261d17; }
  .card-rarity.selected {
    background: #3b271a;
    border-color: var(--accent, #d4af37);
    box-shadow: 0 0 0 1px var(--accent, #d4af37);
  }
  .card-rarity-name {
    font-size: 0.625rem;
    font-weight: 700;
    display: block;
  }
  .card-rarity-dc {
    font-size: 0.75rem;
    font-family: monospace;
    font-weight: 700;
    color: #fde047;
    display: block;
    margin-top: 0.125rem;
  }

  .select-weather {
    width: 100%;
    background: #120e0b;
    border: 1px solid #524136;
    border-radius: 0.5rem;
    padding: 0.625rem;
    font-size: 0.75rem;
    color: #f5ecd7;
    outline: none;
    font-family: inherit;
  }
  .select-weather:focus { border-color: var(--accent, #d4af37); }

  .grid-three {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  @media (min-width: 640px) {
    .grid-three { grid-template-columns: repeat(3, 1fr); }
  }

  .card-option {
    padding: 0.625rem;
    border-radius: 0.5rem;
    border: 1px solid #3e2e23;
    background: #140f0c;
    color: var(--text-secondary, #c4b5a5);
    text-align: left;
    transition: var(--transition-fast, all 0.15s ease);
    cursor: pointer;
    font-family: inherit;
  }
  .card-option:hover { background: #261d17; }
  .card-option.selected {
    background: #3b271a;
    border-color: var(--accent, #d4af37);
    box-shadow: 0 0 0 1px var(--accent, #d4af37);
    color: #fef08a;
  }
  .card-option-label { font-weight: 700; font-size: 0.75rem; display: block; }
  .card-option-desc { font-size: 0.625rem; color: var(--text-muted, #a89988); }

  .results-col {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .dc-plaque {
    background: #241a12;
    border-radius: 0.75rem;
    border: 2px solid var(--accent, #d4af37);
    padding: 1.5rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .dc-overline {
    font-size: 0.625rem;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: #fcd34d;
    display: block;
  }
  .dc-circle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 7rem;
    height: 7rem;
    border-radius: 9999px;
    background: #181310;
    border: 4px solid #fde047;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
    margin: 0 auto;
  }
  .dc-value {
    font-size: 2rem;
    font-family: monospace;
    font-weight: 800;
    color: #fde047;
  }

  .dc-breakdown {
    background: #181310;
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid #3e2e23;
    font-size: 0.75rem;
    font-family: monospace;
    color: #cbd5e1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    text-align: left;
  }
  .dc-line {
    display: flex;
    justify-content: space-between;
    border-bottom: 1px solid #2e2118;
    padding-bottom: 0.25rem;
  }
  .dc-line.no-border { border-bottom: none; padding-top: 0.25rem; }
  .dc-num { font-weight: 700; }
  .dc-num.gold { color: #fde047; }
  .dc-num-red { color: #f87171; }
  .dc-num-green { color: #4ade80; }
  .dc-num-muted { color: var(--text-muted, #a89988); }
  .dc-total {
    border-top: 2px solid var(--accent, #d4af37);
    padding-top: 0.25rem;
    display: flex;
    justify-content: space-between;
    font-weight: 700;
    font-size: 0.875rem;
    color: #fef08a;
  }

  .dc-skill {
    font-size: 0.75rem;
    color: #d7c9b8;
    padding-top: 0.25rem;
  }
  .dc-skill-value { color: #fde047; }

  .empty-note {
    font-size: 0.75rem;
    color: var(--text-muted, #a89988);
    font-style: italic;
    margin: 0;
  }

  .plants-list { display: flex; flex-direction: column; gap: 0.5rem; }

  .plant-row {
    padding: 0.625rem;
    border-radius: 0.5rem;
    background: #140f0c;
    border: 1px solid #3e2e23;
    cursor: pointer;
    transition: var(--transition-fast, all 0.15s ease);
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-align: left;
    width: 100%;
    font-family: inherit;
  }
  .plant-row:hover { border-color: var(--accent, #d4af37); }
  .plant-name { font-weight: 700; font-size: 0.75rem; color: #fef08a; }
  .plant-latin { font-size: 0.625rem; color: var(--text-muted, #a89988); font-style: italic; }
  .plant-dc {
    font-size: 0.625rem;
    font-family: monospace;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: #2b1f17;
    color: #cbd5e1;
    border: 1px solid #524136;
  }

  .tester-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #3e2e23;
    padding-bottom: 0.5rem;
  }

  .mode-switch {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: #140f0c;
    padding: 0.125rem;
    border-radius: 0.25rem;
    border: 1px solid #3e2e23;
  }
  .mode-btn {
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.625rem;
    transition: var(--transition-fast, all 0.15s ease);
    color: var(--text-muted, #a89988);
    background: transparent;
    border: none;
    cursor: pointer;
    font-family: inherit;
  }
  .mode-btn.mode-active {
    background: #854d0e;
    color: white;
    font-weight: 700;
  }

  .tester-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    font-size: 0.75rem;
  }
  .tester-label {
    display: block;
    color: var(--text-muted, #a89988);
    margin-bottom: 0.25rem;
  }
  .gold-text { color: #fde047; }
  .range-input {
    width: 100%;
    accent-color: var(--accent, #d4af37);
  }

  .manual-block { display: flex; flex-direction: column; gap: 0.5rem; }
  .manual-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .manual-label { color: var(--text-muted, #a89988); }

  .input-number {
    width: 4rem;
    padding: 0.25rem 0.5rem;
    background: #120e0b;
    border: 1px solid var(--accent, #d4af37);
    border-radius: 0.25rem;
    text-align: center;
    font-size: 0.875rem;
    font-weight: 700;
    color: #fde047;
    font-family: monospace;
    outline: none;
  }

  .btn-roll {
    width: 100%;
    padding: 0.625rem;
    background: #b45309;
    color: white;
    font-weight: 700;
    border-radius: 0.5rem;
    border: none;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: var(--transition-fast, all 0.15s ease);
    font-family: inherit;
  }
  .btn-roll:hover { background: #d97706; }

  .test-result {
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid #78350f;
    font-size: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    background: #291b16;
    color: #fde047;
  }
  .test-result.result-crit {
    background: rgba(20, 83, 45, 0.4);
    border-color: #22c55e;
    color: #86efac;
  }
  .test-result.result-success {
    background: rgba(30, 58, 95, 0.4);
    border-color: #38bdf8;
    color: #bae6fd;
  }
  .test-result.result-critfail {
    background: rgba(69, 10, 10, 0.5);
    border-color: #ef4444;
    color: #fca5a5;
  }
  .test-result-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: monospace;
    font-weight: 700;
  }
  .test-result-msg {
    line-height: 1.625;
    margin: 0;
  }

  /* Rules / phases */
  .rules-panel { padding: 2rem; gap: 2rem; }
  .rules-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #fde047;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin: 0;
  }
  .rules-desc {
    font-size: 0.8125rem;
    color: var(--text-secondary, #c4b5a5);
    font-style: italic;
    margin: 0.25rem 0 0;
    line-height: 1.625;
  }

  .grid-phases {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  @media (min-width: 768px) {
    .grid-phases { grid-template-columns: 1fr 1fr; }
  }

  .phase-card {
    background: #241c16;
    padding: 1.25rem;
    border-radius: 0.75rem;
    border: 1px solid #4d3a2e;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .phase-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border-bottom: 1px solid #3e2e23;
    padding-bottom: 0.5rem;
  }
  .phase-num {
    width: 2rem;
    height: 2rem;
    border-radius: 9999px;
    background: #854d0e;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.875rem;
    font-family: monospace;
    flex-shrink: 0;
  }
  .phase-title {
    font-weight: 700;
    font-size: 1rem;
    color: #fef08a;
    margin: 0;
  }
  .phase-skill {
    font-size: 0.6875rem;
    font-family: monospace;
  }
  .skill-blue { color: #38bdf8; }
  .skill-purple { color: #a855f7; }
  .skill-green { color: #10b981; }
  .skill-amber { color: #f59e0b; }

  .phase-desc {
    font-size: 0.75rem;
    color: #d7c9b8;
    line-height: 1.625;
    margin: 0;
  }
  .phase-tip {
    background: #181310;
    padding: 0.625rem;
    border-radius: 0.25rem;
    border: 1px solid #2e2118;
    font-size: 0.6875rem;
    color: #cbd5e1;
  }

  /* Biomes section */
  .biomes-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .biomes-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--accent, #d4af37);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }
  .biomes-desc {
    font-size: 0.75rem;
    color: var(--text-secondary, #c4b5a5);
    font-style: italic;
    margin: 0.25rem 0 0;
  }

  .grid-biome-cards {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  @media (min-width: 768px) {
    .grid-biome-cards { grid-template-columns: 1fr 1fr; }
  }
  @media (min-width: 1024px) {
    .grid-biome-cards { grid-template-columns: 1fr 1fr 1fr; }
  }

  .biome-card {
    background: var(--bg-secondary, #1c1612);
    border-radius: 0.75rem;
    border: 1px solid #3e2e23;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
    transition: var(--transition-fast, all 0.15s ease);
  }
  .biome-card:hover { border-color: var(--accent, #d4af37); }

  .biome-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid #3e2e23;
    padding-bottom: 0.5rem;
  }
  .biome-card-name {
    font-weight: 700;
    font-size: 1rem;
    color: #fef08a;
    margin: 0;
  }
  .biome-card-skill {
    font-size: 0.6875rem;
    color: var(--text-muted, #a89988);
    font-style: italic;
  }
  .biome-card-mod {
    font-family: monospace;
    font-weight: 700;
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid;
  }
  .mod-badge-red {
    background: #451a03;
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.4);
  }
  .mod-badge-green {
    background: #14532d;
    color: #86efac;
    border-color: rgba(34, 197, 94, 0.4);
  }

  .biome-card-body {
    font-size: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    color: #d7c9b8;
  }
  .biome-traits-label {
    color: #fde047;
    display: block;
    font-size: 0.6875rem;
  }
  .biome-hazards-label {
    color: #f87171;
    display: block;
    font-size: 0.6875rem;
  }
  .biome-text { font-size: 0.6875rem; margin: 0; }

  .biome-time {
    padding-top: 0.5rem;
    border-top: 1px solid #2e2118;
    font-size: 0.625rem;
    color: #38bdf8;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .biome-time-value { font-weight: 500; text-align: right; }

  /* Toxics */
  .toxics-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--danger, #f87171);
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin: 0;
  }

  .grid-toxics {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  @media (min-width: 768px) {
    .grid-toxics { grid-template-columns: 1fr 1fr; }
  }

  .toxic-card {
    padding: 1rem;
    border-radius: 0.75rem;
    background: #241714;
    border: 1px solid #78350f;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .toxic-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid #451a03;
    padding-bottom: 0.375rem;
  }
  .toxic-searched-label {
    font-size: 0.625rem;
    color: #4ade80;
    font-weight: 700;
    display: block;
  }
  .toxic-searched { font-size: 0.875rem; color: #fef08a; }
  .toxic-danger {
    font-size: 0.625rem;
    font-family: monospace;
    font-weight: 700;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: #450a0a;
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }
  .toxic-lookalike-label {
    font-size: 0.625rem;
    color: #f87171;
    font-weight: 700;
    display: block;
  }
  .toxic-lookalike { font-size: 0.75rem; color: #fca5a5; }
  .toxic-consequence {
    font-size: 0.75rem;
    color: #d7c9b8;
    line-height: 1.625;
    padding-top: 0.25rem;
    border-top: 1px solid #3e231b;
    margin: 0;
  }
</style>
