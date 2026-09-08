<script lang="ts">
  import { mapStore } from '../lib/stores/mapStore.svelte';

  const SHORTCUT_GROUPS = [
    {
      title: 'Outils de Création',
      shortcuts: [
        { key: 'V', desc: 'Outil Sélection & Déplacement (PAO)' },
        { key: 'B', desc: 'Pinceau Sculpture de Relief (Terre / Mer)' },
        { key: 'P', desc: 'Pinceau Peinture de Biome & Textures' },
        { key: 'S', desc: 'Tampons (Objets, arbres, montagnes, décors)' },
        { key: 'L', desc: 'Tracé libre ou polygonal (Routes, rivières)' },
        { key: 'F', desc: 'Formes géométriques (Rectangles, cercles)' },
        { key: 'T', desc: 'Texte & Noms de Lieux' },
        { key: 'M', desc: 'Règle de Mesure tactique (cases & pieds)' },
        { key: 'G', desc: 'Afficher / Masquer la Grille' },
        { key: 'R', desc: 'Afficher / Masquer les Règles millimétrées' },
      ]
    },
    {
      title: 'Navigation & Vue',
      shortcuts: [
        { key: 'Espace + Glisser', desc: 'Déplacer la vue (Panoramique)' },
        { key: 'Clic Milieu / Droit', desc: 'Déplacer la vue' },
        { key: 'Molette Souris', desc: 'Zoomer / Dézoomer de manière fluide' },
        { key: 'Z', desc: 'Basculer en Mode Zen (Plein écran de dessin)' },
        { key: 'F11', desc: 'Plein écran navigateur' },
      ]
    },
    {
      title: 'Édition & Manipulation',
      shortcuts: [
        { key: 'Ctrl + Z', desc: 'Annuler la dernière action' },
        { key: 'Ctrl + Y', desc: 'Rétablir la dernière action' },
        { key: 'Ctrl + C / V', desc: 'Copier / Coller les éléments sélectionnés' },
        { key: 'Ctrl + D', desc: 'Dupliquer instantanément la sélection' },
        { key: 'Ctrl + A', desc: 'Sélectionner tous les éléments' },
        { key: 'Suppr / Backspace', desc: 'Supprimer les éléments sélectionnés' },
        { key: 'Ctrl + L', desc: 'Verrouiller / Déverrouiller la sélection' },
        { key: 'Flèches Directionnelles', desc: 'Déplacer de 1 pixel (Maj = 1 case de grille)' },
      ]
    },
    {
      title: 'Astuces Pro',
      shortcuts: [
        { key: 'Maj + Clic', desc: 'Ajouter / retirer de la sélection multiple' },
        { key: 'Glisser depuis Règle', desc: 'Créer un guide magnétique vertical ou horizontal' },
        { key: 'Échap / Entrée', desc: 'Valider et finaliser un tracé ou une forme' },
        { key: 'Double Clic Texte', desc: 'Éditer rapidement le texte directement sur la carte' },
      ]
    }
  ];
</script>

{#if mapStore.showShortcutsModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={() => mapStore.showShortcutsModal = false}>
    <div class="modal-card" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="modal-title">
          <span class="icon">⌨️</span>
          <span>Guide des Raccourcis & Commandes</span>
        </div>
        <button class="close-btn" onclick={() => mapStore.showShortcutsModal = false}>✕</button>
      </div>

      <p class="modal-subtitle">
        Maîtrisez l'éditeur de cartes comme un pro pour créer vos mondes et donjons à la vitesse de l'éclair.
      </p>

      <div class="groups-grid">
        {#each SHORTCUT_GROUPS as group}
          <div class="shortcut-group">
            <div class="group-title">{group.title}</div>
            <div class="shortcuts-list">
              {#each group.shortcuts as sc}
                <div class="sc-row">
                  <kbd class="sc-key">{sc.key}</kbd>
                  <span class="sc-desc">{sc.desc}</span>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <div class="modal-footer">
        <button class="btn-primary" onclick={() => mapStore.showShortcutsModal = false}>Compris !</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-card {
    background: #0f141f;
    border: 1px solid rgba(212, 168, 75, 0.4);
    border-radius: 16px;
    width: 720px;
    max-width: 94vw;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(229, 168, 83, 0.2);
    padding: 24px;
    color: #e2e8f0;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .modal-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 800;
    color: #fff;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 16px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
  }
  .close-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }

  .modal-subtitle {
    color: #94a3b8;
    font-size: 13px;
    margin-bottom: 20px;
  }

  .groups-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  @media (max-width: 640px) {
    .groups-grid {
      grid-template-columns: 1fr;
    }
  }

  .shortcut-group {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 14px;
  }

  .group-title {
    font-size: 11px;
    font-weight: 700;
    color: #e5a853;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    padding-bottom: 6px;
  }

  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sc-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .sc-key {
    background: #1e293b;
    border: 1px solid rgba(212, 168, 75, 0.35);
    border-bottom-width: 2px;
    color: #fce7b0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    min-width: 24px;
    text-align: center;
  }

  .sc-desc {
    font-size: 11px;
    color: #cbd5e1;
    line-height: 1.3;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 16px;
  }

  .btn-primary {
    background: linear-gradient(135deg, #e5a853, #b45309);
    border: none;
    color: #000;
    font-weight: 700;
    font-size: 13px;
    padding: 8px 20px;
    border-radius: 8px;
    cursor: pointer;
  }
</style>
