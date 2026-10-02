<script module lang="ts">
  export interface PotionTableEntry {
    roll: string; // e.g. "01-02", "03-04" or "1", "2"...
    d20Value: number;
    type: 'catastrophe' | 'bizarre' | 'mineur' | 'majeur' | 'surpuissant' | 'miracle';
    title: string;
    description: string;
    duration: string;
    synergyOrigin: string;
  }
</script>

<script lang="ts">
  import type { Plant } from '$lib/herboriste/types/herb';
  import { GEMS_LIST } from '$lib/herboriste/data/gemData';

  interface RandomPotionTableGeneratorProps {
    plants: Plant[];
  }

  let { plants }: RandomPotionTableGeneratorProps = $props();

  // Pre-filter rare/epic ingredients
  const rarePlants = $derived(
    plants.filter(p => ['rare', 'tres_rare', 'legendaire'].includes(p.rarity))
  );

  // Selected ingredients IDs (defaults to 3 iconic rare herbs)
  let selectedPlantIds = $state<string[]>([
    'fleur_de_lune',
    'sang_de_dragon',
    'mandragore_criarde',
  ]);

  let includeGems = $state<boolean>(true);
  let selectedGemId = $state<string>('rubis');

  // Interactive dice testing
  let d20Roll = $state<number | null>(null);
  let isRolling = $state<boolean>(false);
  let copied = $state<boolean>(false);

  // Selected plant objects
  const selectedPlants = $derived(plants.filter(p => selectedPlantIds.includes(p.id)));
  const selectedGem = $derived(
    includeGems ? GEMS_LIST.find(g => g.id === selectedGemId) || null : null
  );

  // Toggle plant selection
  function handleTogglePlant(id: string) {
    if (selectedPlantIds.includes(id)) {
      if (selectedPlantIds.length > 1) {
        selectedPlantIds = selectedPlantIds.filter(pid => pid !== id);
      }
    } else if (selectedPlantIds.length < 5) {
      selectedPlantIds = [...selectedPlantIds, id];
    }
  }

  // Preset cocktails
  function handleApplyPreset(presetName: string) {
    switch (presetName) {
      case 'lunaire':
        selectedPlantIds = ['fleur_de_lune', 'champignon_cephale', 'atigax'];
        includeGems = true;
        selectedGemId = 'pierre_de_lune';
        break;
      case 'titanesque':
        selectedPlantIds = ['kathkusa', 'sang_de_dragon', 'aconit_tue_loup'];
        includeGems = true;
        selectedGemId = 'rubis';
        break;
      case 'elementaire':
        selectedPlantIds = ['fleur_de_givre', 'epine_de_braise', 'cactus_fleche_de_fer'];
        includeGems = true;
        selectedGemId = 'saphir';
        break;
      case 'miraculeux':
        selectedPlantIds = ['lotus_dor', 'mandragore_criarde', 'fleur_olvar'];
        includeGems = true;
        selectedGemId = 'diamant';
        break;
      case 'tenebreux':
        selectedPlantIds = ['racine_dombre', 'belladone_noire', 'gallowgrass'];
        includeGems = true;
        selectedGemId = 'obsidienne';
        break;
      default:
        break;
    }
    d20Roll = null;
  }

  // Generate the 20 entries tailored dynamically to the selected ingredients
  const generatedTable: PotionTableEntry[] = $derived.by(() => {
    const pNames = selectedPlants.map(p => p.name);
    const gemName = selectedGem ? selectedGem.name : '';
    const mainIngredient = selectedPlants[0] || plants[0];
    const secondaryIngredient = selectedPlants[1] || mainIngredient;
    const thirdIngredient = selectedPlants[2] || secondaryIngredient;

    return [
      {
        roll: '1',
        d20Value: 1,
        type: 'catastrophe',
        title: 'Éruption Gastrique & Fumée Caustique',
        description: `Le mélange entre ${mainIngredient.name} et ${secondaryIngredient.name} se révèle trop instable. Le buveur vomit d'épaisses volutes de fumée sulfureuse, subissant 2d6 dégâts d'acide et étant incapable de parler ou lancer des sorts avec composante verbale pendant 10 minutes.`,
        duration: '10 minutes',
        synergyOrigin: 'Incompatibilité d\'essence végétale',
      },
      {
        roll: '2',
        d20Value: 2,
        type: 'catastrophe',
        title: 'Pétrification Cutanée Partielle',
        description: `La potion cristallise brutalement dans les veines. La peau prend la texture rugueuse de l'écorce ou du basalte. La vitesse de déplacement est divisée par deux et le buveur a un désavantage à tous ses jets de Dextérité pendant 1 heure.`,
        duration: '1 heure',
        synergyOrigin: 'Précipitation minérale instable',
      },
      {
        roll: '3',
        d20Value: 3,
        type: 'bizarre',
        title: 'Bioluminescence Chaotique & Voix Spectrale',
        description: `Tout le corps du buveur se met à luire d'une intense phosphorescence ${mainIngredient.accentColor} visible à 30 mètres (impossible de se cacher). Sa voix résonne comme un écho caverneux doublé en langue sylvestre.`,
        duration: '1 heure',
        synergyOrigin: `Résurgence luminescente de ${mainIngredient.name}`,
      },
      {
        roll: '4',
        d20Value: 4,
        type: 'bizarre',
        title: 'Lévitation Spontanée Involontaire',
        description: `Le corps du buveur devient plus léger que l'air et flotte à 30 centimètres au-dessus du sol. Il flotte sans toucher terre, ce qui l'immunise contre les pièges au sol mais réduit sa vitesse au sol à 4,5 mètres en flottant gauchement.`,
        duration: '30 minutes',
        synergyOrigin: `Volatilité des principes actifs de ${secondaryIngredient.name}`,
      },
      {
        roll: '5',
        d20Value: 5,
        type: 'bizarre',
        title: 'Oreilles de Faune & Ouïe Hyperesthésique',
        description: `Des oreilles animales pointues ou couvertes de feuilles poussent temporairement. Le buveur entend le battement de cœur des créatures à 15 mètres (+3 en Perception auditive), mais devient vulnérable aux dégâts de tonnerre.`,
        duration: '2 heures',
        synergyOrigin: 'Mutation mimétique sylvestre',
      },
      {
        roll: '6',
        d20Value: 6,
        type: 'mineur',
        title: 'Tonique Réparateur Instable',
        description: `Restaure immédiatement 2d4 + 2 points de vie, mais le buveur est pris d'une sensation de froid intense ou de chaleur étouffante qui lui inflige un malus de -1 à son premier jet d'attaque.`,
        duration: 'Instantané (effet secondaire 10 min)',
        synergyOrigin: `Fraction restauratrice de ${mainIngredient.name}`,
      },
      {
        roll: '7',
        d20Value: 7,
        type: 'mineur',
        title: 'Regard des Brumes & Dilatation Pupillaire',
        description: `Les yeux du buveur s'illuminent d'un voile argenté. Il obtient la Vision dans le Noir jusqu'à 18 mètres, mais la lumière vive du plein jour lui inflige un désavantage aux tests de Perception.`,
        duration: '4 heures',
        synergyOrigin: `Affinité oculaire de ${secondaryIngredient.name}`,
      },
      {
        roll: '8',
        d20Value: 8,
        type: 'mineur',
        title: 'Afflux de Vitalité Sanguine',
        description: `Accorde 1d8 + 3 points de vie temporaires. Pendant toute la durée, le sang du personnage coagule instantanément : il est immunisé contre les saignements d'armes tranchantes.`,
        duration: '1 heure',
        synergyOrigin: `Propriétés coagulantes de la décoction`,
      },
      {
        roll: '9',
        d20Value: 9,
        type: 'mineur',
        title: 'Élasticité Musculaire & Bond de Grenouille',
        description: `Les muscles des jambes se gorgent d'une sève tonique. La hauteur et la distance des sauts du personnage sont triplées, et les dégâts de chute sont réduits de 10 points.`,
        duration: '1 heure',
        synergyOrigin: `Sève tonique de ${thirdIngredient.name}`,
      },
      {
        roll: '10',
        d20Value: 10,
        type: 'majeur',
        title: `Élixir Harmonisant de ${mainIngredient.name}`,
        description: `Restaure 3d8 + 4 points de vie et élimine un niveau d'épuisement. Confère en outre la résistance aux dégâts de poison pendant 2 heures.`,
        duration: '2 heures',
        synergyOrigin: `Effet plein de ${mainIngredient.name}`,
      },
      {
        roll: '11',
        d20Value: 11,
        type: 'majeur',
        title: 'Blindage Épidermique Écorce-de-Fer',
        description: `La peau du personnage se durcit en une cuirasse végétale satinée : sa Classe d'Armure ne peut pas être inférieure à 16, et il gagne un bonus de +1 aux jets de sauvegarde de Force.`,
        duration: '1 heure',
        synergyOrigin: `Résine durcie de ${secondaryIngredient.name}`,
      },
      {
        roll: '12',
        d20Value: 12,
        type: 'majeur',
        title: 'Souffle Élémentaire & Résonance Arcanique',
        description: `Le buveur peut souffler, une fois durant la durée du breuvage, un cône de 4,5 mètres d'énergie élémentaire infligeant 3d6 dégâts (Feu, Froid ou Foudre selon les ingrédients) avec JdS Dextérité DD 14 pour demi-dégâts.`,
        duration: '1 heure (ou jusqu\'à utilisation du souffle)',
        synergyOrigin: selectedGem ? `Catalyse cristalline de ${gemName}` : `Énergie élémentaire de ${mainIngredient.name}`,
      },
      {
        roll: '13',
        d20Value: 13,
        type: 'majeur',
        title: 'Vélocité Sylvestre & Réflexes d\'Éclair',
        description: `La vitesse de déplacement augmente de 3 mètres. Le buveur peut effectuer l'action Se Dérober ou Foncer par une action bonus à chaque tour.`,
        duration: '10 minutes',
        synergyOrigin: `Dynamisme végétal de ${thirdIngredient.name}`,
      },
      {
        roll: '14',
        d20Value: 14,
        type: 'majeur',
        title: 'Clarté Psychique & Barrière Mentale',
        description: `Le buveur devient immunisé contre les états Charmé, Effrayé et les tentatives de lecture de pensée. Ses sorts arcaniques ou divins de niveau 1 voient leur portée doublée.`,
        duration: '4 heures',
        synergyOrigin: `Émanations astrales de ${mainIngredient.name}`,
      },
      {
        roll: '15',
        d20Value: 15,
        type: 'majeur',
        title: 'Décharge Alchimique sur les Armes',
        description: `La sueur du buveur exsude un suc magique qui imprègne ses armes de corps à corps : toutes les attaques réussies infligent 1d6 dégâts magiques supplémentaires du type lié aux plantes choisies.`,
        duration: '1 heure',
        synergyOrigin: `Sève combative de ${secondaryIngredient.name}`,
      },
      {
        roll: '16',
        d20Value: 16,
        type: 'surpuissant',
        title: 'Fusion Régénératrice Suprême',
        description: `Au début de chacun de ses tours pendant 1 minute, le personnage regagne automatiquement 3 points de vie tant qu'il a au moins 1 PV. Tout membre tranché ou œil crevé se reconstitue en 1 heure.`,
        duration: 'Régénération active 1 min, guérison permanente',
        synergyOrigin: `Synergie rare entre ${pNames.slice(0, 2).join(' & ')}`,
      },
      {
        roll: '17',
        d20Value: 17,
        type: 'surpuissant',
        title: 'Avatar Élémentaire & Résistance Totale',
        description: `Le corps du buveur s'enveloppe d'une aura flamboyante ou glacée. Il gagne la Résistance à TOUS les dégâts non magiques (contondants, perforants, tranchants) ainsi qu'à l'élément primaire de la potion.`,
        duration: '10 minutes',
        synergyOrigin: selectedGem ? `Alliance magistrale de ${pNames[0]} et du ${gemName}` : `Triple macération rare`,
      },
      {
        roll: '18',
        d20Value: 18,
        type: 'surpuissant',
        title: 'Instinct de Prédateur Primordial & Force 21',
        description: `La valeur de Force ou de Dextérité (au choix du joueur) passe à 21 (+5). Ses attaques au corps à corps portent un coup critique sur un résultat naturel de 19 ou 20 au d20.`,
        duration: '1 heure',
        synergyOrigin: `Concentré de vigueur de ${mainIngredient.name}`,
      },
      {
        roll: '19',
        d20Value: 19,
        type: 'surpuissant',
        title: 'Élixir de Fontaine Astrale',
        description: `Le buveur récupère immédiatement jusqu'à 3 niveaux d'emplacements de sorts dépensés (par ex. un emplacement de niveau 3 ou un de niveau 1 et un de niveau 2) et guérit 4d8 + 8 points de vie.`,
        duration: 'Instantané',
        synergyOrigin: `Résonance arcanique transcendante`,
      },
      {
        roll: '20',
        d20Value: 20,
        type: 'miracle',
        title: 'Chef-d\'Œuvre de l\'Art Alchimique (Miracle Végétal)',
        description: `Perfection absolue du chaudron. Le buveur est intégralement guéri de tous ses PV perdus, toutes maladies, poisons, malédictions et cécités sont dissipés. Il rajeunit biologiquement de 1 an et bénéficie d'une bénédiction : la prochaine fois qu'il devrait tomber à 0 PV dans les 30 prochains jours, il reste à 1 PV avec un bouclier d'énergie divine de 20 PV.`,
        duration: 'Permanent / Déclenchement sous 30 jours',
        synergyOrigin: `Apothéose de tous les ingrédients rares combinés (${pNames.join(', ')}${selectedGem ? ` + ${gemName}` : ''})`,
      },
    ];
  });

  // Execute roll test
  function handleRollDice() {
    isRolling = true;
    let counter = 0;
    const interval = setInterval(() => {
      d20Roll = Math.floor(Math.random() * 20) + 1;
      counter++;
      if (counter > 10) {
        clearInterval(interval);
        const finalVal = Math.floor(Math.random() * 20) + 1;
        d20Roll = finalVal;
        isRolling = false;
      }
    }, 50);
  }

  // Copy table to clipboard in markdown
  function handleCopyMarkdown() {
    const pNames = selectedPlants.map(p => p.name).join(', ');
    const gemStr = selectedGem ? ` + Gemme : ${selectedGem.name}` : '';
    let md = `# Table d'Effets Aléatoires de Potions (d20)\n`;
    md += `**Ingrédients Rares Infusés :** ${pNames}${gemStr}\n\n`;
    md += `| d20 | Type | Effet Alchimique | Durée | Synergie |\n`;
    md += `|-----|------|-------------------|-------|----------|\n`;
    generatedTable.forEach(row => {
      md += `| ${row.roll} | ${row.type.toUpperCase()} | **${row.title}** : ${row.description} | ${row.duration} | ${row.synergyOrigin} |\n`;
    });

    navigator.clipboard.writeText(md);
    copied = true;
    setTimeout(() => copied = false, 2500);
  }

  const currentResultEntry = $derived(
    d20Roll !== null ? generatedTable.find(e => e.d20Value === d20Roll) : null
  );
</script>

{#snippet typeBadge(type: PotionTableEntry['type'])}
  {#if type === 'catastrophe'}
    <span class="badge badge-catastrophe">Catastrophe (Rejet)</span>
  {:else if type === 'bizarre'}
    <span class="badge badge-bizarre">Chaos / Effet Bizarre</span>
  {:else if type === 'mineur'}
    <span class="badge badge-mineur">Effet Mineur</span>
  {:else if type === 'majeur'}
    <span class="badge badge-majeur">Effet Majeur</span>
  {:else if type === 'surpuissant'}
    <span class="badge badge-surpuissant">Surpuissant</span>
  {:else if type === 'miracle'}
    <span class="badge badge-miracle">Miracle Alchimique</span>
  {/if}
{/snippet}

<div class="generator">
  <!-- Header -->
  <div class="gen-header">
    <div>
      <div class="gen-tags">
        <span class="gen-tag">Laboratoire Magique</span>
        <span class="gen-tag-sub">Générateur d'Effets Instables & Inattendus</span>
      </div>
      <h3 class="gen-title">🪄 Table d'Effets Aléatoires de Potions (Ingrédients Rares)</h3>
      <p class="gen-sub">
        Sélectionnez les végétaux précieux et gemmes du grimoire pour forger une table d20 sur mesure avec effets bénéfiques, mutations magiques et rejets alchimiques.
      </p>
    </div>

    <!-- Action buttons -->
    <div class="gen-actions">
      <button onclick={handleCopyMarkdown} class="btn-copy">
        <span>{copied ? '✓' : '📋'}</span>
        <span>{copied ? 'Copié !' : 'Copier (Markdown)'}</span>
      </button>
      <button onclick={() => window.print()} class="btn-print">
        <span>🖨️</span>
        <span>Imprimer</span>
      </button>
    </div>
  </div>

  <!-- Preset Cocktails Bar -->
  <div class="presets">
    <span class="presets-label">Mélanges Thématiques Recommandés :</span>
    <div class="presets-row">
      <button onclick={() => handleApplyPreset('lunaire')} class="preset p-lunaire">🌙 Breuvage Astral & Divinatoire</button>
      <button onclick={() => handleApplyPreset('titanesque')} class="preset p-titanesque">🔥 Fureur Bestiale des Géants</button>
      <button onclick={() => handleApplyPreset('elementaire')} class="preset p-elementaire">❄️ Concoction Cryo-Flamboyante</button>
      <button onclick={() => handleApplyPreset('miraculeux')} class="preset p-miraculeux">✨ Panacée Solaire & Résurrection</button>
      <button onclick={() => handleApplyPreset('tenebreux')} class="preset p-tenebreux">🌑 Filtre d'Ombre & Paralysie</button>
    </div>
  </div>

  <!-- Ingredient Selector Box -->
  <div class="selector-box">
    <div>
      <div class="selector-head">
        <span class="selector-title">
          1. Choisissez 1 à 4 Ingrédients Rares du Manuel ({selectedPlantIds.length}/4 sélectionnés) :
        </span>
        <span class="selector-count">{rarePlants.length} plantes rares répertoriées</span>
      </div>

      <div class="plant-grid">
        {#each rarePlants as plant (plant.id)}
          {@const isSelected = selectedPlantIds.includes(plant.id)}
          <button
            onclick={() => handleTogglePlant(plant.id)}
            class="plant-btn"
            class:selected={isSelected}
          >
            <div class="plant-name">{plant.name}</div>
            <div class="plant-sub">{plant.biome} · {plant.rarity}</div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Optional Gem additive from Naheulbeuk -->
    <div class="gem-row">
      <label class="gem-check">
        <input type="checkbox" bind:checked={includeGems} />
        <span>Ajouter une poudre de <strong>Gemme de Naheulbeuk</strong> comme catalyseur</span>
      </label>

      {#if includeGems}
        <div class="gem-select-wrap">
          <span class="gem-label">Gemme :</span>
          <select bind:value={selectedGemId} class="gem-select">
            {#each GEMS_LIST as gem (gem.id)}
              <option value={gem.id}>{gem.name} ({gem.category})</option>
            {/each}
          </select>
        </div>
      {/if}
    </div>
  </div>

  <!-- Selected Ingredients Banner -->
  <div class="cauldron">
    <div class="cauldron-text">
      <span class="cauldron-label">Composition du Chaudron :</span>
      <span class="cauldron-compo">
        {selectedPlants.map(p => p.name).join(' + ')}
        {selectedGem ? ` + Poudre de ${selectedGem.name}` : ''}
      </span>
    </div>

    <button onclick={handleRollDice} disabled={isRolling} class="roll-btn">
      <span class:spin={isRolling}>🎲</span>
      <span>{isRolling ? 'Le chaudron bouillonne...' : 'Lancer le d20 & Goûter'}</span>
    </button>
  </div>

  <!-- Highlight of current D20 Roll -->
  {#if currentResultEntry}
    <div class="roll-result">
      <div class="roll-result-head">
        <div class="roll-result-title">
          <span class="roll-badge">{currentResultEntry.d20Value}</span>
          <h4>Résultat d20 ({currentResultEntry.roll}) : {currentResultEntry.title}</h4>
        </div>
        {@render typeBadge(currentResultEntry.type)}
      </div>

      <p class="roll-result-desc">{currentResultEntry.description}</p>

      <div class="roll-result-meta">
        <span><strong>Durée :</strong> {currentResultEntry.duration}</span>
        <span><strong>Origine :</strong> {currentResultEntry.synergyOrigin}</span>
      </div>
    </div>
  {/if}

  <!-- The Full D20 Table -->
  <div class="table-block">
    <div class="table-head">
      <h4 class="table-title">⚗️ Table Complète des 20 Résultats Possibles au d20</h4>
      <span class="table-hint">Chaque résultat s'adapte automatiquement à votre sélection d'ingrédients</span>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="col-roll">d20</th>
            <th class="col-cat">Catégorie</th>
            <th>Effet Concocté & Conséquences de Jeu</th>
            <th class="col-dur">Durée</th>
            <th class="col-syn">Synergie Végétale</th>
          </tr>
        </thead>
        <tbody>
          {#each generatedTable as row (row.d20Value)}
            <tr
              class:row-selected={d20Roll === row.d20Value}
              class:row-even={row.d20Value % 2 === 0 && d20Roll !== row.d20Value}
            >
              <td class="cell-roll">{row.roll}</td>
              <td>{@render typeBadge(row.type)}</td>
              <td>
                <strong class="cell-title">{row.title}</strong>
                <span class="cell-desc">{row.description}</span>
              </td>
              <td class="cell-dur">{row.duration}</td>
              <td class="cell-syn">{row.synergyOrigin}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

<style>
  .generator {
    background: var(--bg-secondary);
    border-radius: 12px;
    border: 2px solid var(--border);
    padding: 24px;
    color: var(--text-primary);
    font-family: serif;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Header */
  .gen-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 16px;
  }
  .gen-tags { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .gen-tag {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 4px;
    background: #451a03;
    color: #fcd34d;
    border: 1px solid rgba(217, 119, 6, 0.5);
    text-transform: uppercase;
    letter-spacing: 2px;
    font-family: monospace;
  }
  .gen-tag-sub { font-size: 12px; color: var(--text-muted); }
  .gen-title { font-size: 24px; font-weight: bold; color: var(--accent); margin: 0; }
  .gen-sub { font-size: 12px; color: var(--text-muted); font-style: italic; margin: 2px 0 0; }
  .gen-actions { display: flex; gap: 8px; }
  .btn-copy, .btn-print {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-family: serif;
    cursor: pointer;
    transition: var(--transition-fast);
  }
  .btn-copy {
    background: var(--bg-tertiary);
    color: #fcd34d;
    border: 1px solid #78350f;
  }
  .btn-copy:hover { background: var(--bg-hover); }
  .btn-print {
    background: #3b271b;
    color: var(--text-primary);
    border: 1px solid color-mix(in srgb, var(--accent) 60%, transparent);
  }
  .btn-print:hover { background: #523724; }

  /* Presets */
  .presets { display: flex; flex-direction: column; gap: 6px; }
  .presets-label {
    font-size: 12px;
    font-weight: bold;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .presets-row { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; }
  .preset {
    padding: 4px 10px;
    border-radius: 6px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    cursor: pointer;
    transition: var(--transition-fast);
    font-family: serif;
  }
  .preset:hover { background: var(--bg-hover); }
  .p-lunaire { color: #93c5fd; }
  .p-lunaire:hover { border-color: #93c5fd; }
  .p-titanesque { color: #f87171; }
  .p-titanesque:hover { border-color: #f87171; }
  .p-elementaire { color: #67e8f9; }
  .p-elementaire:hover { border-color: #67e8f9; }
  .p-miraculeux { color: var(--accent); }
  .p-miraculeux:hover { border-color: var(--accent); }
  .p-tenebreux { color: #cbd5e1; }
  .p-tenebreux:hover { border-color: #cbd5e1; }

  /* Selector */
  .selector-box {
    background: var(--bg-tertiary);
    padding: 16px;
    border-radius: 12px;
    border: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .selector-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .selector-title {
    font-size: 12px;
    font-weight: bold;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .selector-count { font-size: 11px; color: var(--text-muted); }

  .plant-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    max-height: 192px;
    overflow-y: auto;
    padding-right: 4px;
  }
  @media (min-width: 640px) { .plant-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (min-width: 768px) { .plant-grid { grid-template-columns: repeat(4, 1fr); } }
  @media (min-width: 1024px) { .plant-grid { grid-template-columns: repeat(5, 1fr); } }

  .plant-btn {
    padding: 8px;
    border-radius: 8px;
    text-align: left;
    font-size: 12px;
    transition: var(--transition-fast);
    border: 1px solid var(--border-subtle);
    background: var(--bg-primary);
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-family: serif;
  }
  .plant-btn:hover { background: var(--bg-hover); }
  .plant-btn.selected {
    background: #451a03;
    border-color: var(--accent);
    color: var(--accent);
  }
  .plant-name {
    font-weight: bold;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .plant-sub {
    font-size: 10px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-style: italic;
  }

  .gem-row {
    padding-top: 8px;
    border-top: 1px solid var(--border-subtle);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
  }
  .gem-check {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: var(--text-secondary);
  }
  .gem-check input { accent-color: var(--accent); }
  .gem-select-wrap { display: flex; align-items: center; gap: 8px; }
  .gem-label { color: var(--text-muted); }
  .gem-select {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    color: var(--accent);
    outline: none;
  }

  /* Cauldron banner */
  .cauldron {
    background: #2a1d15;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid #78350f;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .cauldron-text { font-size: 12px; }
  .cauldron-label { color: var(--text-muted); margin-right: 8px; }
  .cauldron-compo { color: var(--accent); font-weight: bold; }
  .roll-btn {
    padding: 8px 16px;
    border-radius: 6px;
    background: #b45309;
    color: white;
    font-weight: bold;
    font-size: 12px;
    border: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: var(--transition-fast);
    font-family: serif;
  }
  .roll-btn:hover:not(:disabled) { background: #d97706; }
  .roll-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .spin { display: inline-block; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Roll result */
  .roll-result {
    padding: 16px;
    border-radius: 12px;
    border: 2px solid var(--accent);
    background: #3a2012;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    gap: 8px;
    animation: fadeIn 0.3s ease;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .roll-result-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .roll-result-title { display: flex; align-items: center; gap: 8px; }
  .roll-result-title h4 {
    font-size: 16px;
    font-weight: bold;
    color: var(--accent);
    margin: 0;
  }
  .roll-badge {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--bg-primary);
    font-family: monospace;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    flex-shrink: 0;
  }
  .roll-result-desc {
    font-size: 14px;
    color: var(--text-primary);
    line-height: 1.7;
    padding-left: 40px;
    margin: 0;
  }
  .roll-result-meta {
    font-size: 11px;
    color: var(--text-secondary);
    padding-left: 40px;
    display: flex;
    gap: 16px;
    padding-top: 4px;
    flex-wrap: wrap;
  }

  /* Badges */
  .badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: bold;
    border: 1px solid;
    white-space: nowrap;
  }
  .badge-catastrophe { background: #450a0a; color: #fca5a5; border-color: var(--danger); }
  .badge-bizarre { background: #451a03; color: #fcd34d; border-color: #b45309; }
  .badge-mineur { background: #052e16; color: #86efac; border-color: #15803d; }
  .badge-majeur { background: #0c1f3d; color: #93c5fd; border-color: #1d4ed8; }
  .badge-surpuissant { background: #2e1065; color: #d8b4fe; border-color: #9333ea; }
  .badge-miracle {
    background: #713f12;
    color: #fef08a;
    border-color: var(--accent);
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.65; } }

  /* Table */
  .table-block { display: flex; flex-direction: column; gap: 8px; }
  .table-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .table-title {
    font-size: 14px;
    font-weight: bold;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 0;
  }
  .table-hint { font-size: 11px; color: var(--text-muted); }
  .table-wrap {
    overflow-x: auto;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
  }
  table {
    width: 100%;
    text-align: left;
    font-size: 12px;
    border-collapse: collapse;
    font-family: serif;
  }
  thead tr {
    background: var(--bg-tertiary);
    color: var(--accent);
    border-bottom: 1px solid var(--border-subtle);
  }
  th { padding: 10px; }
  td { padding: 10px; }
  .col-roll { text-align: center; width: 48px; font-family: monospace; }
  .col-cat { width: 144px; }
  .col-dur { width: 112px; }
  .col-syn { width: 176px; }
  tbody tr { transition: var(--transition-fast); }
  tbody tr.row-even { background: color-mix(in srgb, var(--bg-primary) 70%, transparent); }
  tbody tr:not(.row-selected):hover { background: var(--bg-hover); }
  tbody tr.row-selected {
    background: #572f17;
    color: white;
    font-weight: 500;
    box-shadow: inset 0 0 0 2px var(--accent);
  }
  .cell-roll {
    text-align: center;
    font-family: monospace;
    font-weight: bold;
    color: var(--accent);
  }
  .cell-title { color: var(--accent); display: block; margin-bottom: 2px; }
  .cell-desc { color: var(--text-secondary); line-height: 1.6; font-size: 11px; }
  .cell-dur { font-size: 11px; color: var(--text-secondary); white-space: nowrap; }
  .cell-syn { font-size: 11px; color: var(--text-muted); font-style: italic; }
</style>
