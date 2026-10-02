<script lang="ts">
  import { herboristeStore } from '$lib/herboriste/store.svelte';
  import { GEMS_LIST } from '$lib/herboriste/data/gemData';

  interface QuestHook {
    id: string;
    type: 'plante' | 'gemme' | 'epidemie' | 'commande';
    typeLabel: string;
    icon: string;
    title: string;
    tavernRumor: string;
    targetName: string;
    locationBiome: string;
    landmark: string;
    guardianMonster: string;
    specialCondition: string;
    rewardPo: number;
    reputationGain: string;
  }

  const QUEST_TYPES = [
    { id: 'all', label: 'Toutes les Quêtes', icon: '📜' },
    { id: 'plante', label: 'Flore Mythique', icon: '🌿' },
    { id: 'gemme', label: 'Filons Perdus', icon: '💎' },
    { id: 'epidemie', label: 'Urgences & Antidotes', icon: '☠️' },
    { id: 'commande', label: 'Commandes d\'Orfèvre', icon: '👑' },
  ];

  let selectedFilter = $state<string>('all');
  let currentQuest = $state<QuestHook | null>(null);
  let copyFeedback = $state<string | null>(null);

  const LANDMARKS = [
    'au creux de la Faille des Lamentations',
    'sur le flanc ouest du Pic du Crâne Fendu',
    'près des ruines englouties du Temple de Dlul',
    'dans les cavernes oubliées sous la Forêt de Schlingue',
    'au bord du Gouffre sans Fond de Boulgourville',
    'dans les marécages pestilentiels de la Fange Noire',
  ];

  const TAVERN_RUMORS = [
    '« Un vieux prospecteur borgne est entré à l\'auberge hier soir, à moitié dévoré par la frousse, en jurant avoir vu briller des feux sous la roche... »',
    '« La servante du duc prétend que son maître paierait une fortune pour cette sève avant la prochaine lune montante, sinon c\'est la disgrâce ! »',
    '« Un nain ivre mort a parié toute sa chope qu\'aucun aventurier n\'aurait les tripes d\'aller cueillir ça sous le nez de la bête... »',
    '« Les érudits de l\'académie de Waldorg offrent une récompense royale à qui leur ramènera un échantillon intact non flétri. »',
  ];

  const SPECIAL_CONDITIONS = [
    'Doit être récolté uniquement entre minuit et le premier chant du coq.',
    'Nécessite de couper la tige avec une lame en argent pur sans toucher la peau.',
    'La gemme doit être extraite sans briser la géode mère sous peine de perdre son aura.',
    'À conserver impérativement dans un bocal scellé à la cire avant 48 heures.',
  ];

  function generateQuest() {
    const plants = herboristeStore.plants;
    const creatures = herboristeStore.creatures;

    const randomPlant = plants[Math.floor(Math.random() * plants.length)];
    const randomGem = GEMS_LIST[Math.floor(Math.random() * GEMS_LIST.length)];
    const randomCreature = creatures[Math.floor(Math.random() * creatures.length)];

    let type: 'plante' | 'gemme' | 'epidemie' | 'commande' = 'plante';
    if (selectedFilter !== 'all') {
      type = selectedFilter as 'plante' | 'gemme' | 'epidemie' | 'commande';
    } else {
      const types: ('plante' | 'gemme' | 'epidemie' | 'commande')[] = ['plante', 'gemme', 'epidemie', 'commande'];
      type = types[Math.floor(Math.random() * types.length)];
    }

    let title = '';
    let targetName = '';
    let typeLabel = '';
    let icon = '';

    if (type === 'plante') {
      typeLabel = 'Flore Mythique';
      icon = '🌿';
      targetName = randomPlant.name;
      title = `L'Élixir Perdu de ${randomPlant.name}`;
    } else if (type === 'gemme') {
      typeLabel = 'Filon Oublié';
      icon = '💎';
      targetName = randomGem.name;
      title = `Le Fil-d'Or et les ${randomGem.name}s de Gurdil`;
    } else if (type === 'epidemie') {
      typeLabel = 'Urgence Sanitaire';
      icon = '☠️';
      targetName = randomPlant.name;
      title = `Le Fléau du Marais : Antidote à base de ${randomPlant.name}`;
    } else {
      typeLabel = 'Commande d\'Orfèvre';
      icon = '👑';
      targetName = randomGem.name;
      title = `La Parure du Roi : Sertissage de ${randomGem.name}`;
    }

    currentQuest = {
      id: Math.random().toString(36).substring(7),
      type,
      typeLabel,
      icon,
      title,
      tavernRumor: TAVERN_RUMORS[Math.floor(Math.random() * TAVERN_RUMORS.length)],
      targetName,
      locationBiome: randomPlant.biome,
      landmark: LANDMARKS[Math.floor(Math.random() * LANDMARKS.length)],
      guardianMonster: randomCreature.name,
      specialCondition: SPECIAL_CONDITIONS[Math.floor(Math.random() * SPECIAL_CONDITIONS.length)],
      rewardPo: (Math.floor(Math.random() * 8) + 3) * 50,
      reputationGain: '+15 Renommée auprès de la Guilde d\'Herboristerie de Fangh',
    };
  }

  function copyQuestForVtt() {
    if (!currentQuest) return;
    let md = `**📜 [QUÊTE : ${currentQuest.title}]**\n`;
    md += `• **Type :** ${currentQuest.typeLabel} · **Cible :** ${currentQuest.targetName}\n`;
    md += `• **Rumeur de taverne :** _${currentQuest.tavernRumor}_\n`;
    md += `• **Localisation :** Biome ${currentQuest.locationBiome} (${currentQuest.landmark})\n`;
    md += `• **Gardien / Péril :** ${currentQuest.guardianMonster}\n`;
    md += `• **Condition spéciale :** ${currentQuest.specialCondition}\n`;
    md += `• **Récompense :** **${currentQuest.rewardPo} Pièces d'Or** (${currentQuest.reputationGain})\n`;

    navigator.clipboard?.writeText(md).then(() => {
      copyFeedback = 'Copié dans le presse-papier !';
      setTimeout(() => (copyFeedback = null), 2500);
    });
  }

  // Initial generation
  generateQuest();
</script>

<div class="quest-page">
  <div class="quest-head">
    <div>
      <div class="tag-row">
        <span class="badge">Inspiration MJ · Scénarios & Aventures</span>
        <span class="sub-note">Tables aléatoires procédurales de Fangh</span>
      </div>
      <h3 class="quest-page-title">
        <span>📜</span> Générateur de Quêtes d'Herboristerie & Rumeurs de Filons
      </h3>
      <p class="quest-desc">
        Générez à la volée des rumeurs de tavernes, des expéditions de cueillette périlleuse et des contrats de recherche pour donner des objectifs concrets à vos joueurs en séance.
      </p>
    </div>

    <button type="button" class="btn-gen" onclick={generateQuest}>
      <span>🎲</span> Générer une Nouvelle Quête
    </button>
  </div>

  <!-- Filter Pills -->
  <div class="filter-pills">
    {#each QUEST_TYPES as t}
      <button
        type="button"
        class="filter-btn"
        class:active={selectedFilter === t.id}
        onclick={() => { selectedFilter = t.id; generateQuest(); }}
      >
        <span>{t.icon}</span> {t.label}
      </button>
    {/each}
  </div>

  {#if currentQuest}
    <div class="quest-parchment">
      <div class="seal">⚜️</div>

      <div class="quest-top">
        <span class="quest-category">{currentQuest.icon} {currentQuest.typeLabel}</span>
        <span class="quest-reward-badge">💰 {currentQuest.rewardPo} PO</span>
      </div>

      <h2 class="quest-main-title">{currentQuest.title}</h2>

      <div class="rumor-quote">
        {currentQuest.tavernRumor}
      </div>

      <div class="quest-details-grid">
        <div class="quest-box">
          <span class="q-lbl">Spécimen Recherché</span>
          <span class="q-val highlight">{currentQuest.targetName}</span>
        </div>
        <div class="quest-box">
          <span class="q-lbl">Localisation & Repère</span>
          <span class="q-val capitalize">Biome {currentQuest.locationBiome} {currentQuest.landmark}</span>
        </div>
        <div class="quest-box">
          <span class="q-lbl">Gardien / Créature Signalée</span>
          <span class="q-val danger">⚠️ {currentQuest.guardianMonster}</span>
        </div>
        <div class="quest-box">
          <span class="q-lbl">Condition de Cueillette / Extraction</span>
          <span class="q-val">{currentQuest.specialCondition}</span>
        </div>
      </div>

      <div class="quest-footer">
        <div class="rep-note">
          <span>🏅</span> {currentQuest.reputationGain}
        </div>
        <button type="button" class="btn-copy-vtt" onclick={copyQuestForVtt}>
          <span>📋</span> {copyFeedback ?? 'Copier pour le Chat VTT / Notes MJ'}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .quest-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    font-family: Georgia, 'Times New Roman', serif;
    color: #e6d8c3;
  }

  .quest-head {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid #4a392d;
  }
  @media (min-width: 768px) {
    .quest-head {
      flex-direction: row;
      align-items: flex-start;
    }
  }

  .tag-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
  .badge {
    background: #451a03;
    color: #fcd34d;
    font-size: 0.7rem;
    font-weight: bold;
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid rgba(217, 119, 6, 0.5);
    font-family: ui-monospace, monospace;
    text-transform: uppercase;
  }
  .sub-note { font-size: 0.75rem; color: #a89988; font-style: italic; }

  .quest-page-title {
    font-size: 1.6rem;
    font-weight: bold;
    color: #d4af37;
    margin: 0.25rem 0;
  }
  .quest-desc {
    font-size: 0.85rem;
    color: #c4b5a5;
    max-width: 46rem;
    margin: 0;
    line-height: 1.45;
    font-style: italic;
  }

  .btn-gen {
    background: linear-gradient(135deg, #d4af37, #92400e);
    color: #181310;
    border: none;
    border-radius: 0.4rem;
    padding: 0.75rem 1.25rem;
    font-size: 0.85rem;
    font-weight: 900;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
    transition: transform 0.1s ease;
  }
  .btn-gen:hover { filter: brightness(1.15); transform: translateY(-1px); }

  .filter-pills { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .filter-btn {
    background: #181310;
    border: 1px solid #4a392d;
    color: #c4b5a5;
    padding: 0.4rem 0.75rem;
    border-radius: 0.35rem;
    font-size: 0.75rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .filter-btn:hover { background: #2a1f18; color: #fef08a; }
  .filter-btn.active {
    background: #d4af37;
    color: #181310;
    border-color: #d4af37;
  }

  /* Parchment Card */
  .quest-parchment {
    position: relative;
    background: #f7f2e7;
    color: #2c1810;
    border: 4px solid #5c3e29;
    border-radius: 0.75rem;
    padding: 2rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    background-image: radial-gradient(#ebdcc4 1px, transparent 1px);
    background-size: 16px 16px;
  }

  .seal {
    position: absolute;
    top: 1rem;
    right: 1.5rem;
    font-size: 2.2rem;
    color: #991b1b;
    opacity: 0.7;
  }

  .quest-top { display: flex; align-items: center; gap: 0.75rem; }
  .quest-category {
    font-size: 0.75rem;
    text-transform: uppercase;
    font-weight: bold;
    color: #854d0e;
    letter-spacing: 0.05em;
  }
  .quest-reward-badge {
    background: #fef08a;
    border: 1px solid #ca8a04;
    color: #854d0e;
    font-weight: 900;
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.8rem;
    font-family: ui-monospace, monospace;
  }

  .quest-main-title {
    font-size: 1.6rem;
    font-weight: bold;
    color: #3a1d0f;
    margin: 0;
  }

  .rumor-quote {
    background: #efe4d0;
    border-left: 4px solid #854d0e;
    padding: 0.75rem 1rem;
    border-radius: 0.25rem;
    font-size: 0.9rem;
    color: #451a03;
    font-style: italic;
    line-height: 1.45;
  }

  .quest-details-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  @media (min-width: 640px) {
    .quest-details-grid { grid-template-columns: repeat(2, 1fr); }
  }

  .quest-box {
    background: #efe8d8;
    border: 1px solid #dfd0bd;
    padding: 0.65rem 0.85rem;
    border-radius: 0.35rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .q-lbl { font-size: 0.68rem; text-transform: uppercase; color: #78350f; font-weight: bold; }
  .q-val { font-size: 0.85rem; font-weight: bold; color: #2c1810; }
  .q-val.highlight { color: #b45309; }
  .q-val.danger { color: #991b1b; }
  .capitalize { text-transform: capitalize; }

  .quest-footer {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border-top: 2px solid rgba(133, 77, 14, 0.2);
    padding-top: 1rem;
  }
  @media (min-width: 640px) {
    .quest-footer {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }
  }

  .rep-note { font-size: 0.75rem; color: #78350f; font-style: italic; }

  .btn-copy-vtt {
    background: #78350f;
    color: #fff;
    border: none;
    border-radius: 0.35rem;
    padding: 0.6rem 1rem;
    font-size: 0.8rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .btn-copy-vtt:hover { background: #92400e; }
</style>
