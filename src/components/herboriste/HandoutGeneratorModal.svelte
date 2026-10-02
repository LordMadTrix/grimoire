<script lang="ts">
  import { herboristeStore } from '$lib/herboriste/store.svelte';
  import BotanicalIllustration from './BotanicalIllustration.svelte';
  import GemIllustration from './GemIllustration.svelte';

  const handout = $derived(herboristeStore.handoutItem);
  let copyFeedback = $state<string | null>(null);

  function close() {
    herboristeStore.handoutItem = null;
  }

  function handlePrint() {
    window.print();
  }

  function copyText() {
    if (!handout) return;
    const item = handout.item;
    let txt = `=== FEUILLE D'INDICE DE TERRAIN / HANDOUT ===\n`;
    txt += `NOM : ${item.name}\n`;
    if (handout.type === 'plant') {
      txt += `NOM SAVANT : ${item.latinName || 'Inconnu'}\n`;
      txt += `BIOME : ${item.biome} · RARETÉ : ${item.rarity}\n`;
      txt += `DESCRIPTION : ${item.description}\n`;
      txt += `EFFET ALCHIMIQUE : ${item.effect}\n`;
    } else {
      txt += `CATÉGORIE : ${item.category} · DURETÉ MOHS : ${item.hardnessMohs}/10\n`;
      txt += `DESCRIPTION : ${item.description}\n`;
      txt += `SERTISSAGE & POUVOIRS : ${item.enchantmentEffect}\n`;
      txt += `ANECDOTE : ${item.naheulbeukLore}\n`;
    }
    navigator.clipboard?.writeText(txt).then(() => {
      copyFeedback = 'Copié dans le presse-papier !';
      setTimeout(() => (copyFeedback = null), 2000);
    });
  }
</script>

{#if handout}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="handout-overlay" onclick={(e) => { if (e.target === e.currentTarget) close(); }}>
    <div class="handout-toolbar no-print">
      <div class="toolbar-title">
        <span>📜</span> Planche d'Indice & Handout Joueur
      </div>
      <div class="toolbar-actions">
        <button type="button" class="btn-tool" onclick={copyText}>
          <span>📋</span> {copyFeedback ?? 'Copier le Texte'}
        </button>
        <button type="button" class="btn-tool print" onclick={handlePrint}>
          <span>🖨️</span> Imprimer / PDF
        </button>
        <button type="button" class="btn-close" onclick={close}>✕</button>
      </div>
    </div>

    <div class="parchment-sheet printable">
      <!-- Vintage Corner Ornaments -->
      <div class="corner-ornament tl"></div>
      <div class="corner-ornament tr"></div>
      <div class="corner-ornament bl"></div>
      <div class="corner-ornament br"></div>

      <!-- Wax Seal -->
      <div class="wax-seal">
        <div class="wax-inner">GUILDE DES HERBORISTES DE FANGH</div>
      </div>

      <!-- Header -->
      <div class="sheet-header">
        <div class="sheet-series">ARCHIVES BOTANIQUES & MINÉRALES · EXTRAIT DU GRIMOIRE</div>
        <h1 class="sheet-title">{handout.item.name}</h1>
        {#if handout.type === 'plant' && handout.item.latinName}
          <div class="sheet-latin">« {handout.item.latinName} »</div>
        {/if}
      </div>

      <!-- Main Layout -->
      <div class="sheet-body">
        <div class="sheet-illustration-box">
          {#if handout.type === 'plant'}
            <BotanicalIllustration plant={handout.item} size="lg" />
          {:else}
            <GemIllustration gem={handout.item} size="lg" />
          {/if}
          <div class="illustration-caption">
            Planche n° {Math.floor(Math.random() * 800) + 100} · Dessiné d'après nature
          </div>
        </div>

        <div class="sheet-notes">
          <div class="notes-section">
            <h3 class="notes-heading">Observation de Terrain</h3>
            <p class="notes-text">{handout.item.description}</p>
          </div>

          {#if handout.type === 'plant'}
            <div class="notes-section">
              <h3 class="notes-heading">Propriétés & Concoctions Médicinales</h3>
              <p class="notes-text highlight">{handout.item.effect}</p>
              <div class="sub-notes">
                <span><strong>Biotopes observés :</strong> {handout.item.biome}</span>
                <span>· <strong>Difficulté de récolte :</strong> DD {handout.item.dcHarvest}</span>
              </div>
            </div>
          {:else}
            <div class="notes-section">
              <h3 class="notes-heading">Vertus Magiques & Sertissage</h3>
              <p class="notes-text highlight">{handout.item.enchantmentEffect}</p>
              <div class="sub-notes">
                <span><strong>Affinité :</strong> {handout.item.magicalAffinity}</span>
                <span>· <strong>Échelle de Mohs :</strong> {handout.item.hardnessMohs}/10</span>
              </div>
            </div>

            <div class="notes-section italic-lore">
              <h3 class="notes-heading">Rumeurs & Propos d'Aventurier</h3>
              <p class="notes-text">{handout.item.naheulbeukLore}</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Footer Stamp -->
      <div class="sheet-footer">
        <div class="stamp-box">
          <span>CERTIFIÉ AUTHENTIQUE</span>
          <span class="stamp-sub">Corporation des Apothicaires & Joailliers de Fangh</span>
        </div>
        <div class="sheet-folio">Folio #{Math.floor(Math.random() * 200) + 12}</div>
      </div>
    </div>
  </div>
{/if}

<style>
  .handout-overlay {
    position: fixed;
    inset: 0;
    background: rgba(10, 8, 6, 0.85);
    backdrop-filter: blur(4px);
    z-index: 1200;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-y: auto;
    padding: 1.5rem;
    font-family: Georgia, 'Times New Roman', serif;
  }

  .handout-toolbar {
    width: 100%;
    max-width: 48rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #1e1712;
    border: 1px solid #4a392d;
    border-radius: 0.5rem;
    padding: 0.65rem 1rem;
    margin-bottom: 1rem;
    color: #fef08a;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
  }
  .toolbar-title { font-weight: bold; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem; }
  .toolbar-actions { display: flex; align-items: center; gap: 0.5rem; }
  .btn-tool {
    background: #2b1f16;
    border: 1px solid #59473b;
    color: #e6d8c3;
    padding: 0.35rem 0.65rem;
    border-radius: 0.3rem;
    font-size: 0.75rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .btn-tool:hover { background: #3d2a1d; border-color: #d4af37; }
  .btn-tool.print { background: #78350f; color: #fff; border-color: #92400e; }
  .btn-tool.print:hover { background: #92400e; }
  .btn-close {
    background: none;
    border: none;
    color: #a89988;
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0.2rem 0.5rem;
  }
  .btn-close:hover { color: #f87171; }

  /* Parchment Sheet */
  .parchment-sheet {
    position: relative;
    width: 100%;
    max-width: 48rem;
    background-color: #f6efe1;
    background-image: radial-gradient(#ebd6b7 1.5px, transparent 1.5px);
    background-size: 20px 20px;
    border: 3px solid #6b4d32;
    border-radius: 0.4rem;
    padding: 2.5rem;
    color: #2c1a0e;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    box-sizing: border-box;
  }

  .corner-ornament {
    position: absolute;
    width: 1.5rem;
    height: 1.5rem;
    border-color: #854d0e;
    border-style: solid;
  }
  .corner-ornament.tl { top: 0.5rem; left: 0.5rem; border-width: 2px 0 0 2px; }
  .corner-ornament.tr { top: 0.5rem; right: 0.5rem; border-width: 2px 2px 0 0; }
  .corner-ornament.bl { bottom: 0.5rem; left: 0.5rem; border-width: 0 0 2px 2px; }
  .corner-ornament.br { bottom: 0.5rem; right: 0.5rem; border-width: 0 2px 2px 0; }

  .wax-seal {
    position: absolute;
    top: 1.5rem;
    right: 2rem;
    width: 4.5rem;
    height: 4.5rem;
    background: radial-gradient(circle, #b91c1c, #7f1d1d);
    border-radius: 9999px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #991b1b;
  }
  .wax-inner {
    font-size: 0.45rem;
    text-align: center;
    color: #fecaca;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.35rem;
    line-height: 1.2;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  }

  .sheet-header {
    text-align: center;
    border-bottom: 2px double #854d0e;
    padding-bottom: 1rem;
    margin-bottom: 1.5rem;
  }
  .sheet-series {
    font-size: 0.7rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #854d0e;
    font-weight: bold;
    margin-bottom: 0.25rem;
  }
  .sheet-title {
    font-size: 2.2rem;
    font-weight: bold;
    color: #3b1d0c;
    margin: 0;
    font-family: Georgia, 'Times New Roman', serif;
  }
  .sheet-latin {
    font-size: 1rem;
    font-style: italic;
    color: #78350f;
    margin-top: 0.25rem;
  }

  .sheet-body {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.75rem;
    align-items: flex-start;
  }
  @media (min-width: 640px) {
    .sheet-body {
      grid-template-columns: 14rem 1fr;
    }
  }

  .sheet-illustration-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  .illustration-caption {
    font-size: 0.68rem;
    color: #78350f;
    font-style: italic;
    text-align: center;
  }

  .sheet-notes {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .notes-section {
    background: rgba(239, 228, 208, 0.6);
    border-left: 3px solid #854d0e;
    padding: 0.75rem 1rem;
    border-radius: 0.25rem;
  }
  .notes-heading {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #854d0e;
    font-weight: bold;
    margin: 0 0 0.35rem 0;
  }
  .notes-text {
    font-size: 0.9rem;
    line-height: 1.55;
    color: #2c1a0e;
    margin: 0;
  }
  .notes-text.highlight {
    font-weight: 600;
    color: #451a03;
  }
  .sub-notes {
    margin-top: 0.4rem;
    font-size: 0.75rem;
    color: #78350f;
  }
  .italic-lore {
    font-style: italic;
  }

  .sheet-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 2rem;
    border-top: 1px solid #cbb698;
    padding-top: 1rem;
  }
  .stamp-box {
    border: 2px dashed #991b1b;
    padding: 0.35rem 0.75rem;
    color: #991b1b;
    font-size: 0.75rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    display: flex;
    flex-direction: column;
    transform: rotate(-3deg);
  }
  .stamp-sub { font-size: 0.55rem; font-weight: normal; }
  .sheet-folio { font-size: 0.75rem; color: #854d0e; font-style: italic; }

  @media print {
    .no-print { display: none !important; }
    .handout-overlay {
      position: static;
      background: none;
      padding: 0;
      backdrop-filter: none;
    }
    .parchment-sheet {
      box-shadow: none;
      border: 1px solid #000;
      max-width: 100%;
    }
  }
</style>
