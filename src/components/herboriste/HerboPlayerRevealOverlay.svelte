<script lang="ts">
  import BotanicalIllustration from './BotanicalIllustration.svelte';
  import GemIllustration from './GemIllustration.svelte';

  let {
    reveal = null,
    onClose
  }: {
    reveal?: {
      type: 'plant' | 'gem' | 'potion' | 'poison' | 'jewelry' | 'surge';
      item: any;
      isMystery?: boolean;
      gmNotes?: string;
    } | null;
    onClose: () => void;
  } = $props();

  import { onMount } from 'svelte';
  import { listen } from '@tauri-apps/api/event';

  let isVisible = $state(false);
  let idClues = $state<string[]>([]);
  let fullyIdentified = $state(false);

  $effect(() => {
    if (reveal) {
      setTimeout(() => (isVisible = true), 60);
      idClues = reveal.clues || [];
      fullyIdentified = !reveal.isMystery;
    } else {
      isVisible = false;
      idClues = [];
      fullyIdentified = false;
    }
  });

  onMount(() => {
    const unlistens: (() => void)[] = [];
    listen('herbo_clue_discovered', (e: any) => {
      if (e.payload?.clue) {
        idClues = [...idClues, e.payload.clue];
      }
    }).then(fn => unlistens.push(fn));

    listen('herbo_fully_identified', () => {
      fullyIdentified = true;
    }).then(fn => unlistens.push(fn));

    return () => {
      unlistens.forEach(fn => fn());
    };
  });

  function close() {
    isVisible = false;
    setTimeout(onClose, 400);
  }
</script>

{#if reveal && isVisible}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="reveal-backdrop" onclick={close} role="presentation">
    <div
      class="reveal-parchment"
      class:is-gem={reveal.type === 'gem' || reveal.type === 'jewelry'}
      class:is-poison={reveal.type === 'poison'}
      class:is-surge={reveal.type === 'surge'}
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Corner Vintage Ornaments -->
      <div class="corner-ornament tl"></div>
      <div class="corner-ornament tr"></div>
      <div class="corner-ornament bl"></div>
      <div class="corner-ornament br"></div>

      <!-- Wax Seal -->
      <div class="wax-seal">
        <div class="wax-inner">GUILDE DES HERBORISTES</div>
      </div>

      <!-- Header -->
      <div class="reveal-header">
        <div class="series-title">
          {#if reveal.isMystery}
            ÉCHANTILLON NON-IDENTIFIÉ · OBSERVATION DE TERRAIN
          {:else if reveal.type === 'plant'}
            ARCHIVES BOTANIQUES DE FANGH · PLANCHE D'HISTOIRE NATURELLE
          {:else if reveal.type === 'gem'}
            TRAITÉ DE GEMMOLOGIE & LAPIDAIRE DE FANGH
          {:else if reveal.type === 'poison'}
            COMPENDIUM DES VENINS & TOXINES
          {:else if reveal.type === 'jewelry'}
            CHEF-D'ŒUVRE DE JOAILLERIE RUNIQUE
          {:else}
            MANIFESTATION DU CHAOS ALCHIMIQUE
          {/if}
        </div>

        <h1 class="item-title" class:ink-reveal={fullyIdentified && reveal.isMystery}>
          {#if reveal.isMystery && !fullyIdentified}
            🌿 Spécimen Mystérieux (Non-identifié)
          {:else}
            {reveal.item.name || reveal.item.title || 'Découverte Épique'}
          {/if}
        </h1>

        {#if (!reveal.isMystery || fullyIdentified) && reveal.item.latinName}
          <div class="latin-name">« {reveal.item.latinName} »</div>
        {/if}
      </div>

      <!-- Main Body -->
      <div class="reveal-body">
        <!-- Left: Illustration Plate -->
        <div class="illustration-box">
          {#if reveal.type === 'plant'}
            <BotanicalIllustration plant={reveal.item} size="lg" />
          {:else if reveal.type === 'gem'}
            <GemIllustration gem={reveal.item} size="lg" />
          {:else if reveal.type === 'jewelry'}
            <div class="custom-icon-box jewelry">💍</div>
          {:else if reveal.type === 'poison'}
            <div class="custom-icon-box poison">💀</div>
          {:else if reveal.type === 'surge'}
            <div class="custom-icon-box surge">🎲</div>
          {:else}
            <div class="custom-icon-box potion">⚗️</div>
          {/if}
          <div class="plate-number">
            Planche n° {Math.floor(Math.random() * 800) + 120} · Relevé officiel
          </div>
        </div>

        <!-- Right: Observations & Lore -->
        <div class="notes-column">
          <!-- GM Notes if provided -->
          {#if reveal.gmNotes}
            <div class="gm-note-banner">
              <strong>Indice du Maître du Jeu :</strong> {reveal.gmNotes}
            </div>
          {/if}

          <div class="section-box">
            <h3 class="sec-heading">Description Visuelle</h3>
            <p class="sec-text">
              {reveal.item.description || reveal.item.symptoms || reveal.item.effect || 'Spécimen récolté dans les étendues sauvages.'}
            </p>
          </div>

          <!-- Secret / Identified Properties -->
          <div class="section-box properties">
            <h3 class="sec-heading">Propriétés & Vertus Observées</h3>
            {#if reveal.isMystery && !fullyIdentified}
              <p class="mystery-hint">
                ❓ Les principes actifs et effets secondaires restent inconnus de la troupe. Un test d'<strong>Herboristerie / Intelligence (DD 13)</strong> sur votre mobile permettra d'en percer les vertus.
              </p>
              {#if idClues.length > 0}
                <div class="clues-stack">
                  <h4 class="clues-title">🔬 Indices Découverts par le groupe :</h4>
                  {#each idClues as clue}
                    <div class="clue-item">✨ {clue}</div>
                  {/each}
                </div>
              {/if}
            {:else}
              <p class="sec-text highlight">
                {reveal.item.effect || reveal.item.enchantmentEffect || reveal.item.gameRule || 'Usage médicinal ou arcanique standard.'}
              </p>
              <div class="sub-meta-tags">
                {#if reveal.item.biome}
                  <span><strong>Biotope :</strong> {reveal.item.biome}</span>
                {/if}
                {#if reveal.item.rarity}
                  <span>· <strong>Rareté :</strong> {reveal.item.rarity}</span>
                {/if}
                {#if reveal.item.hardnessMohs}
                  <span>· <strong>Dureté :</strong> {reveal.item.hardnessMohs}/10 Mohs</span>
                {/if}
                {#if reveal.item.basePriceCut}
                  <span>· <strong>Valeur :</strong> {reveal.item.basePriceCut} PO</span>
                {/if}
              </div>
            {/if}
          </div>

          {#if !reveal.isMystery && reveal.item.naheulbeukLore}
            <div class="section-box italic">
              <h3 class="sec-heading">Rumeurs d'Aventurier</h3>
              <p class="sec-text">{reveal.item.naheulbeukLore}</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Footer -->
      <div class="reveal-footer">
        <div class="seal-text">
          <span>CERTIFIÉ AUTHENTIQUE</span>
          <span class="sub">Corporation des Apothicaires & Lapidaires de Fangh</span>
        </div>
        <button type="button" class="btn-dismiss" onclick={close}>
          Fermer l'Examen ✕
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .reveal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 600;
    background: rgba(8, 6, 5, 0.88);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    animation: fade-in 0.3s ease-out;
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .reveal-parchment {
    position: relative;
    width: 100%;
    max-width: 820px;
    max-height: 90vh;
    overflow-y: auto;
    background: #f4ecdc;
    background-image:
      radial-gradient(circle at 50% 30%, rgba(255, 255, 255, 0.4) 0%, transparent 70%),
      url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E");
    border: 3px solid #854d0e;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.9), inset 0 0 50px rgba(100, 60, 20, 0.25);
    border-radius: 6px;
    padding: 2.5rem 2rem 1.75rem 2rem;
    color: #2b1d0c;
    font-family: Georgia, 'Times New Roman', serif;
    animation: unroll-card 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes unroll-card {
    from { transform: scale(0.92) translateY(20px); opacity: 0; }
    to { transform: scale(1) translateY(0); opacity: 1; }
  }

  /* Corner Ornaments */
  .corner-ornament {
    position: absolute;
    width: 28px;
    height: 28px;
    border: 2px solid #854d0e;
  }
  .corner-ornament.tl { top: 8px; left: 8px; border-right: none; border-bottom: none; }
  .corner-ornament.tr { top: 8px; right: 8px; border-left: none; border-bottom: none; }
  .corner-ornament.bl { bottom: 8px; left: 8px; border-right: none; border-top: none; }
  .corner-ornament.br { bottom: 8px; right: 8px; border-left: none; border-top: none; }

  /* Wax Seal */
  .wax-seal {
    position: absolute;
    top: 14px;
    right: 20px;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: radial-gradient(circle, #b91c1c 20%, #7f1d1d 90%);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed rgba(255, 255, 255, 0.2);
  }
  .wax-inner {
    font-size: 7px;
    font-weight: bold;
    color: #fef2f2;
    text-align: center;
    line-height: 1.1;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  /* Header */
  .reveal-header {
    text-align: center;
    border-bottom: 2px solid #a16207;
    padding-bottom: 1rem;
    margin-bottom: 1.5rem;
    padding-right: 4rem;
  }
  .series-title {
    font-size: 0.72rem;
    font-weight: bold;
    letter-spacing: 0.12em;
    color: #854d0e;
    text-transform: uppercase;
  }
  .item-title {
    margin: 0.3rem 0;
    font-size: 2rem;
    color: #451a03;
    font-weight: bold;
    letter-spacing: 0.02em;
  }
  .latin-name {
    font-size: 0.95rem;
    color: #78350f;
    font-style: italic;
  }

  /* Body */
  .reveal-body {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  @media (min-width: 640px) {
    .reveal-body { grid-template-columns: 240px 1fr; }
  }

  .illustration-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #ebe0cb;
    border: 1px solid #c2a882;
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.1);
  }
  .custom-icon-box {
    font-size: 5rem;
    margin: 1rem 0;
    filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.3));
  }
  .plate-number {
    font-size: 0.7rem;
    color: #78350f;
    margin-top: 0.75rem;
    font-style: italic;
  }

  .notes-column {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .gm-note-banner {
    background: #e7d8be;
    border-left: 4px solid #b45309;
    padding: 0.6rem 0.8rem;
    font-size: 0.82rem;
    color: #5c3b17;
    font-style: italic;
  }

  .section-box {
    background: #fbf7ef;
    border: 1px solid #d5c3aa;
    border-radius: 0.4rem;
    padding: 0.75rem 0.9rem;
  }
  .sec-heading {
    margin: 0 0 0.3rem 0;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #854d0e;
    font-weight: bold;
  }
  .sec-text {
    margin: 0;
    font-size: 0.88rem;
    line-height: 1.4;
    color: #261b11;
  }
  .sec-text.highlight {
    font-weight: 600;
    color: #14532d;
  }

  .mystery-hint {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.4;
    color: #7f1d1d;
    font-style: italic;
  }

  .clues-stack {
    margin-top: 0.6rem;
    background: #edf8f1;
    border: 1px solid #86efac;
    border-radius: 0.35rem;
    padding: 0.5rem 0.75rem;
  }
  .clues-title {
    margin: 0 0 0.3rem 0;
    font-size: 0.78rem;
    color: #166534;
    font-weight: bold;
    text-transform: uppercase;
  }
  .clue-item {
    font-size: 0.82rem;
    color: #14532d;
    line-height: 1.4;
    font-weight: 500;
  }

  .sub-meta-tags {
    margin-top: 0.5rem;
    font-size: 0.78rem;
    color: #713f12;
  }

  .section-box.italic {
    background: #f4ecdc;
    border-style: dashed;
  }

  /* Footer */
  .reveal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #d5c3aa;
    padding-top: 1rem;
    margin-top: 1.5rem;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .seal-text {
    font-size: 0.72rem;
    font-weight: bold;
    color: #78350f;
    display: flex;
    flex-direction: column;
  }
  .seal-text .sub {
    font-size: 0.65rem;
    font-weight: normal;
    color: #a16207;
  }

  .btn-dismiss {
    background: #3c2918;
    color: #fef08a;
    border: 1px solid #78350f;
    border-radius: 0.35rem;
    padding: 0.45rem 0.9rem;
    font-size: 0.8rem;
    font-family: inherit;
    cursor: pointer;
    font-weight: bold;
    transition: background 0.15s ease;
  }
  .btn-dismiss:hover { background: #543b23; }
</style>
