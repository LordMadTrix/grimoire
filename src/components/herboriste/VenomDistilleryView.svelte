<script lang="ts">
  import type { Creature } from '$lib/herboriste/types/herb';
  import { herboristeStore } from '$lib/herboriste/store.svelte';

  interface AntidoteRecipe {
    id: string;
    name: string;
    icon: string;
    creatureSource: string;
    requiredHerb: string;
    dcBrew: number;
    duration: string;
    effect: string;
    bossMatch: string;
  }

  const SERUM_RECIPES: AntidoteRecipe[] = [
    {
      id: 'serum_wyverne',
      name: 'Antitoxine Ciblée de Wyverne',
      icon: '🧪',
      creatureSource: 'Wyverne des Falaises',
      requiredHerb: 'Athelas Royal',
      dcBrew: 14,
      duration: '4 heures',
      effect: 'Immunise totalement contre les dégâts de poison de dard et neutralise l\'état Empoisonné causé par les wyvernes.',
      bossMatch: 'Boss type Dragonnet / Wyverne / Manticore',
    },
    {
      id: 'serum_basilic',
      name: 'Élixir de Fluidité Anti-Pétrification',
      icon: '🦎',
      creatureSource: 'Basilic des Grottes',
      requiredHerb: 'Lotus Doré',
      dcBrew: 16,
      duration: '1 heure',
      effect: 'Octroie l\'avantage absolu aux jets de sauvegarde de Constitution contre le regard pétrifiant et retarde toute pétrification graduelle.',
      bossMatch: 'Boss type Basilic / Gorgone / Méduse',
    },
    {
      id: 'serum_araignee',
      name: 'Sérum Neuro-Protecteur d\'Arachnide',
      icon: '🕷️',
      creatureSource: 'Araignée Géante des Brumes',
      requiredHerb: 'Millefeuille des Bois',
      dcBrew: 12,
      duration: '8 heures',
      effect: 'Réduit de moitié les dégâts de morsure venimeuse et empêche la paralysie musculaire.',
      bossMatch: 'Nids d\'araignées & Drow',
    },
    {
      id: 'serum_salamandre',
      name: 'Teinture Ignifuge de Salamandre',
      icon: '🔥',
      creatureSource: 'Salamandre de Lave',
      requiredHerb: 'Racine de Feu',
      dcBrew: 15,
      duration: '2 heures',
      effect: 'Résistance aux dégâts de feu (dégâts divisés par 2) et immunité aux brûlures de contact thermique.',
      bossMatch: 'Créatures ignées & Élémentaires de feu',
    },
  ];

  let selectedRecipeId = $state<string>('serum_wyverne');
  let extractorBonus = $state<number>(4);
  let brewResult = $state<{
    d20: number;
    total: number;
    success: boolean;
    recipe: AntidoteRecipe;
    message: string;
  } | null>(null);

  const selectedRecipe = $derived(
    SERUM_RECIPES.find(r => r.id === selectedRecipeId) ?? SERUM_RECIPES[0]
  );

  function brewSerum() {
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + extractorBonus;
    const dc = selectedRecipe.dcBrew;
    const success = d20 === 20 || (total >= dc && d20 !== 1);

    let message = '';
    if (d20 === 1) {
      message = 'Échec critique catastrophique ! Une éclaboussure de venin vous brûle les doigts (1d6 dégâts de poison subis).';
    } else if (success) {
      message = `Concoction magistrale réussie ! Le ${selectedRecipe.name} est distillé dans une fiole scellée prête à l'emploi.`;
    } else {
      message = `Distillation ratée. Le mélange a tourné au vinaigre et n'a aucun effet protecteur (DD ${dc} non atteint).`;
    }

    brewResult = {
      d20,
      total,
      success,
      recipe: selectedRecipe,
      message,
    };
  }

  let copyFeedback = $state<string | null>(null);
  function copySerumForVtt() {
    if (!brewResult || !brewResult.success) return;
    const r = brewResult.recipe;
    let md = `**🧪 [POTION : ${r.name}]**\n`;
    md += `• **Source :** Venin distillé de ${r.creatureSource} + ${r.requiredHerb}\n`;
    md += `• **Durée d'action :** ${r.duration}\n`;
    md += `• **Effet préventif :** ${r.effect}\n`;
    md += `• **Recommandé contre :** ${r.bossMatch}\n`;

    navigator.clipboard?.writeText(md).then(() => {
      copyFeedback = 'Copié pour le chat !';
      setTimeout(() => (copyFeedback = null), 2500);
    });
  }
</script>

<div class="venom-page">
  <div class="venom-header">
    <div>
      <div class="tag-row">
        <span class="badge">Atelier Toxines · Antidotes Ciblés</span>
        <span class="sub-note">Traite de monstres & sérums préventifs</span>
      </div>
      <h3 class="venom-title">
        <span>🧪</span> Distillerie de Venins & Sérums de Protection
      </h3>
      <p class="venom-desc">
        Prélevez les venins et toxines sur les cadavres de créatures du Bestiaire et distillez des contre-poisons ciblés pour immuniser votre groupe avant les combats de boss mortels.
      </p>
    </div>
  </div>

  <div class="venom-layout">
    <!-- Left: Recipe Selector -->
    <div class="recipe-col">
      <div class="card">
        <h4 class="card-head">📜 Formules de Sérums Ciblés</h4>
        <div class="recipe-list">
          {#each SERUM_RECIPES as r (r.id)}
            <button
              type="button"
              class="recipe-btn"
              class:selected={selectedRecipeId === r.id}
              onclick={() => (selectedRecipeId = r.id)}
            >
              <div class="r-top">
                <span class="r-ico">{r.icon}</span>
                <span class="r-name">{r.name}</span>
                <span class="r-dc">DD {r.dcBrew}</span>
              </div>
              <div class="r-ingr">
                <span>Créature : <strong>{r.creatureSource}</strong></span>
                <span>+ Plante : <strong>{r.requiredHerb}</strong></span>
              </div>
              <div class="r-boss">🎯 Efficace contre : {r.bossMatch}</div>
            </button>
          {/each}
        </div>
      </div>
    </div>

    <!-- Right: Brewing Alembic & Roll -->
    <div class="alembic-col">
      <div class="alembic-card">
        <div class="alembic-head">
          <span class="alembic-tag">Alambic de Distillation</span>
          <h4 class="alembic-name">{selectedRecipe.name}</h4>
          <span class="alembic-dur">Durée d'efficacité : {selectedRecipe.duration}</span>
        </div>

        <div class="alembic-effect">
          <span>🛡️ <strong>Effet préventif :</strong></span>
          <p>{selectedRecipe.effect}</p>
        </div>

        <div class="alembic-ctrl">
          <div class="bonus-box">
            <label for="alembic-bonus-input">Bonus de Concoction / Herboristerie :</label>
            <input
              id="alembic-bonus-input"
              type="number"
              min="0"
              max="15"
              bind:value={extractorBonus}
              class="bonus-input"
            />
          </div>

          <button type="button" class="btn-brew" onclick={brewSerum}>
            <span>⚗️</span> Distiller le Sérum (d20 + {extractorBonus} vs DD {selectedRecipe.dcBrew})
          </button>
        </div>

        {#if brewResult}
          <div class="brew-res-card" class:ok={brewResult.success} class:fail={!brewResult.success}>
            <div class="res-top">
              <span>🎲 d20 ({brewResult.d20}) + {extractorBonus} = <strong>{brewResult.total}</strong></span>
              <span>{brewResult.success ? '✅ SUCCÈS' : '❌ ÉCHEC'}</span>
            </div>
            <p class="res-msg">{brewResult.message}</p>
            {#if brewResult.success}
              <button type="button" class="btn-copy-serum" onclick={copySerumForVtt}>
                <span>📋</span> {copyFeedback ?? 'Copier Fiche Objet (VTT / MJ)'}
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .venom-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    font-family: Georgia, 'Times New Roman', serif;
    color: #e6d8c3;
  }

  .venom-header { border-bottom: 1px solid #4a392d; padding-bottom: 1.25rem; }
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

  .venom-title { font-size: 1.6rem; font-weight: bold; color: #d4af37; margin: 0.25rem 0; }
  .venom-desc { font-size: 0.85rem; color: #c4b5a5; max-width: 48rem; margin: 0; line-height: 1.45; font-style: italic; }

  .venom-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  @media (min-width: 1024px) {
    .venom-layout { grid-template-columns: 1.1fr 0.9fr; }
  }

  .recipe-col, .alembic-col { display: flex; flex-direction: column; gap: 1rem; }

  .card {
    background: #241c16;
    border: 1px solid #4a392d;
    border-radius: 0.65rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .card-head { font-size: 0.95rem; font-weight: bold; color: #fef08a; margin: 0; }

  .recipe-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .recipe-btn {
    text-align: left;
    background: #181310;
    border: 1px solid #4a392d;
    border-radius: 0.4rem;
    padding: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #e6d8c3;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .recipe-btn:hover { background: #2e231b; }
  .recipe-btn.selected {
    background: #3b271b;
    border-color: #d4af37;
    box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.3);
  }

  .r-top { display: flex; align-items: center; gap: 0.35rem; }
  .r-ico { font-size: 1.1rem; }
  .r-name { font-size: 0.85rem; font-weight: bold; color: #fef08a; flex: 1; }
  .r-dc { font-size: 0.7rem; background: #3a2a1d; color: #fde047; padding: 0.1rem 0.35rem; border-radius: 0.2rem; font-weight: bold; }

  .r-ingr { font-size: 0.72rem; color: #a89988; display: flex; gap: 0.75rem; }
  .r-boss { font-size: 0.7rem; color: #38bdf8; font-style: italic; }

  /* Alembic card */
  .alembic-card {
    background: #f7f2e7;
    color: #2c1810;
    border: 4px solid #5c3e29;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .alembic-head { border-bottom: 2px solid rgba(133, 77, 14, 0.3); padding-bottom: 0.5rem; }
  .alembic-tag { font-size: 0.65rem; text-transform: uppercase; color: #854d0e; font-weight: bold; }
  .alembic-name { font-size: 1.3rem; font-weight: bold; color: #3a1d0f; margin: 0.15rem 0; }
  .alembic-dur { font-size: 0.75rem; color: #78350f; font-style: italic; }

  .alembic-effect {
    background: #efe4d0;
    border: 1px solid #cfbca2;
    border-radius: 0.35rem;
    padding: 0.75rem;
    font-size: 0.825rem;
    color: #3b271d;
  }
  .alembic-effect p { margin: 0.25rem 0 0 0; line-height: 1.4; }

  .alembic-ctrl { display: flex; flex-direction: column; gap: 0.75rem; }
  .bonus-box { display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; font-weight: bold; color: #78350f; }
  .bonus-input {
    width: 3.5rem;
    padding: 0.3rem;
    border: 1px solid #cfbca2;
    border-radius: 0.25rem;
    font-size: 0.9rem;
    text-align: center;
    font-weight: bold;
    color: #854d0e;
  }

  .btn-brew {
    background: linear-gradient(135deg, #d4af37, #92400e);
    color: #181310;
    border: none;
    border-radius: 0.4rem;
    padding: 0.75rem;
    font-size: 0.9rem;
    font-weight: 900;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  .btn-brew:hover { filter: brightness(1.15); }

  .brew-res-card {
    border-radius: 0.4rem;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.8rem;
  }
  .brew-res-card.ok { background: #dcfce7; border: 1px solid #86efac; color: #14532d; }
  .brew-res-card.fail { background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; }
  .res-top { display: flex; justify-content: space-between; font-weight: bold; }
  .res-msg { margin: 0; line-height: 1.35; }

  .btn-copy-serum {
    margin-top: 0.35rem;
    background: #14532d;
    color: #fff;
    border: none;
    border-radius: 0.25rem;
    padding: 0.4rem 0.65rem;
    font-size: 0.75rem;
    font-weight: bold;
    cursor: pointer;
    align-self: flex-start;
  }
</style>
