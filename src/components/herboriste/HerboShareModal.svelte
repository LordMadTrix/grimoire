<script lang="ts">
  import { onMount } from 'svelte';
  import { herboristeStore, type HerboSharePayload } from '$lib/herboriste/store.svelte';
  import { emitToPlayerView, broadcastToPlayers, getPlayerConnections, type PlayerInfo } from '$lib/api';
  import BotanicalIllustration from './BotanicalIllustration.svelte';
  import GemIllustration from './GemIllustration.svelte';

  const shareData = $derived<HerboSharePayload | null>(herboristeStore.shareModalItem);

  let isMystery = $state<boolean>(false);
  let gmNotes = $state<string>('');
  let connectedPlayers = $state<PlayerInfo[]>([]);
  let selectedPlayerId = $state<string>('');
  let giftQuantity = $state<number>(1);

  let statusMessage = $state<string | null>(null);
  let isSending = $state<boolean>(false);

  $effect(() => {
    if (shareData) {
      isMystery = !!shareData.isMystery;
      gmNotes = shareData.gmNotes || '';
      refreshPlayers();
    }
  });

  async function refreshPlayers() {
    try {
      connectedPlayers = await getPlayerConnections();
      if (connectedPlayers.length > 0 && !selectedPlayerId) {
        selectedPlayerId = connectedPlayers[0].id;
      }
    } catch (e) {
      connectedPlayers = [];
    }
  }

  function close() {
    herboristeStore.shareModalItem = null;
    statusMessage = null;
  }

  async function handleProjectToPlayerView() {
    if (!shareData) return;
    isSending = true;
    try {
      const payload = {
        type: shareData.type,
        item: shareData.item,
        isMystery,
        gmNotes: gmNotes.trim() || undefined,
        timestamp: Date.now()
      };
      await emitToPlayerView('show_herbo_reveal', payload);
      statusMessage = '✅ Projeté avec succès sur la Vue Joueurs (2ème écran) !';
      setTimeout(() => (statusMessage = null), 3000);
    } catch (e) {
      statusMessage = '⚠️ Erreur lors de la projection : ' + String(e);
    } finally {
      isSending = false;
    }
  }

  async function handleClosePlayerViewReveal() {
    try {
      await emitToPlayerView('close_herbo_reveal', {});
      statusMessage = '✅ Projection fermée sur la Vue Joueurs.';
      setTimeout(() => (statusMessage = null), 2500);
    } catch (e) {
      statusMessage = '⚠️ Erreur : ' + String(e);
    }
  }

  async function handleBroadcastToMobile() {
    if (!shareData) return;
    isSending = true;
    try {
      const payload = {
        type: shareData.type,
        item: shareData.item,
        isMystery,
        gmNotes: gmNotes.trim() || undefined,
        fromGM: true,
        timestamp: Date.now()
      };
      await broadcastToPlayers('herbo_item_shared', payload);
      statusMessage = '📱 Fiche diffusée à tous les smartphones connectés !';
      setTimeout(() => (statusMessage = null), 3000);
    } catch (e) {
      statusMessage = '⚠️ Erreur diffusion mobile : ' + String(e);
    } finally {
      isSending = false;
    }
  }

  async function handleGiveToPlayer() {
    if (!shareData || !selectedPlayerId) return;
    const targetPlayer = connectedPlayers.find((p) => p.id === selectedPlayerId);
    isSending = true;
    try {
      const payload = {
        targetPlayerId: selectedPlayerId,
        playerName: targetPlayer?.name ?? 'Joueur',
        item: shareData.item,
        itemType: shareData.type,
        quantity: giftQuantity,
        isMystery,
        timestamp: Date.now()
      };
      await broadcastToPlayers('herbo_give_item', payload);
      statusMessage = `🎁 ${giftQuantity}x [${shareData.item.name || 'Objet'}] ajouté à la sacoche de ${targetPlayer?.name ?? 'Joueur'} !`;
      setTimeout(() => (statusMessage = null), 3500);
    } catch (e) {
      statusMessage = '⚠️ Erreur attribution : ' + String(e);
    } finally {
      isSending = false;
    }
  }
</script>

{#if shareData}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="share-overlay" onclick={(e) => { if (e.target === e.currentTarget) close(); }}>
    <div class="share-modal">
      <!-- Header -->
      <div class="modal-head">
        <div class="head-title">
          <span class="head-ico">📡</span>
          <div>
            <h3>Passerelle Herboriste : Joueurs & VTT</h3>
            <p class="head-sub">Partagez vos découvertes en temps réel sur la table ou les smartphones</p>
          </div>
        </div>
        <button type="button" class="btn-close" onclick={close}>✕</button>
      </div>

      <!-- Item Preview Card -->
      <div class="item-summary-card">
        <div class="preview-thumb">
          {#if shareData.type === 'plant'}
            <BotanicalIllustration plant={shareData.item} size="sm" />
          {:else if shareData.type === 'gem'}
            <GemIllustration gem={shareData.item} size="sm" showPlateDetails={false} />
          {:else if shareData.type === 'jewelry'}
            <span class="preview-icon">💍</span>
          {:else if shareData.type === 'poison'}
            <span class="preview-icon">💀</span>
          {:else if shareData.type === 'surge'}
            <span class="preview-icon">🎲</span>
          {:else}
            <span class="preview-icon">⚗️</span>
          {/if}
        </div>

        <div class="preview-info">
          <div class="item-type-badge">{shareData.type.toUpperCase()}</div>
          <h4 class="item-title">{shareData.item.name || shareData.item.title || 'Spécimen Botanique'}</h4>
          <p class="item-desc">{shareData.item.description || shareData.item.effect || ''}</p>
        </div>
      </div>

      <!-- Options : Mode Mystère & Notes MJ -->
      <div class="mystery-toggle-row">
        <label class="switch-label">
          <input type="checkbox" bind:checked={isMystery} class="switch-chk" />
          <span class="switch-text">
            <strong>🕵️ Mode Mystère (Non Identifié) :</strong>
            Masque le nom réel et les vertus secrètes jusqu'à ce qu'un test d'Herboristerie soit réussi par les PJ.
          </span>
        </label>

        <div class="notes-input-row">
          <label class="notes-lbl">Notes ou Indice du MJ pour les Joueurs :</label>
          <input
            type="text"
            placeholder="Ex : « Cueilli au clair de lune près de la cascade aux fées... »"
            bind:value={gmNotes}
            class="notes-input"
          />
        </div>
      </div>

      <!-- Actions Grid -->
      <div class="actions-grid">
        <!-- Action 1: Table & 2ème Écran -->
        <div class="action-card">
          <div class="act-head">
            <span class="act-ico">👁️</span>
            <div>
              <h4 class="act-title">Vue Joueurs (2ème Écran / Table)</h4>
              <span class="act-sub">Projection cinématique plein écran pour la tablée</span>
            </div>
          </div>
          <p class="act-desc">Affiche la planche parcheminée illustrée directement sur le moniteur de vos joueurs.</p>
          <div class="act-btn-row">
            <button
              type="button"
              class="btn-action primary"
              onclick={handleProjectToPlayerView}
              disabled={isSending}
            >
              <span>🖼️ Projeter sur l'Écran</span>
            </button>
            <button
              type="button"
              class="btn-action cancel"
              onclick={handleClosePlayerViewReveal}
              title="Fermer la projection en cours"
            >
              <span>✕ Masquer</span>
            </button>
          </div>
        </div>

        <!-- Action 2: Mobile Broadcast -->
        <div class="action-card">
          <div class="act-head">
            <span class="act-ico">📱</span>
            <div>
              <h4 class="act-title">Hub Mobile des Joueurs</h4>
              <span class="act-sub">Diffusion instantanée sur tous les smartphones</span>
            </div>
          </div>
          <p class="act-desc">Fait vibrer les téléphones des joueurs connectés avec la fiche d'observation complète.</p>
          <button
            type="button"
            class="btn-action broadcast"
            onclick={handleBroadcastToMobile}
            disabled={isSending}
          >
            <span>📢 Diffuser à Tous ({connectedPlayers.length} connectés)</span>
          </button>
        </div>

        <!-- Action 3: Give to Player Satchel -->
        <div class="action-card">
          <div class="act-head">
            <span class="act-ico">🎁</span>
            <div>
              <h4 class="act-title">Donner à la Sacoche d'un Joueur</h4>
              <span class="act-sub">Ajout d'inventaire direct pour un PJ spécifique</span>
            </div>
          </div>

          <div class="give-controls">
            {#if connectedPlayers.length > 0}
              <select bind:value={selectedPlayerId} class="player-select">
                {#each connectedPlayers as p (p.id)}
                  <option value={p.id}>👤 {p.name}</option>
                {/each}
              </select>
              <div class="qty-wrap">
                <span>Qté :</span>
                <input type="number" min="1" max="20" bind:value={giftQuantity} class="qty-input" />
              </div>
            {:else}
              <div class="no-players-alert">Aucun joueur mobile connecté actuellement.</div>
            {/if}
          </div>

          <button
            type="button"
            class="btn-action gift"
            onclick={handleGiveToPlayer}
            disabled={isSending || connectedPlayers.length === 0}
          >
            <span>🎒 Transférer dans l'Inventaire</span>
          </button>
        </div>
      </div>

      <!-- Feedback Status Banner -->
      {#if statusMessage}
        <div class="feedback-banner">{statusMessage}</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .share-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.78);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    font-family: Georgia, 'Times New Roman', serif;
  }

  .share-modal {
    background: #1c1511;
    border: 2px solid #854d0e;
    border-radius: 0.75rem;
    width: 100%;
    max-width: 680px;
    padding: 1.5rem;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7);
    color: #f7eed7;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    animation: pop-in 0.2s ease-out;
  }
  @keyframes pop-in {
    from { transform: scale(0.96); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .modal-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid #4a3628;
    padding-bottom: 0.75rem;
  }
  .head-title { display: flex; align-items: center; gap: 0.75rem; }
  .head-ico { font-size: 1.8rem; }
  .head-title h3 { margin: 0; font-size: 1.25rem; color: #fef08a; }
  .head-sub { margin: 0.2rem 0 0 0; font-size: 0.78rem; color: #d1bfa8; }
  .btn-close {
    background: transparent;
    border: none;
    color: #a8947f;
    font-size: 1.2rem;
    cursor: pointer;
  }
  .btn-close:hover { color: #fef08a; }

  /* Item Summary */
  .item-summary-card {
    background: #140f0c;
    border: 1px solid #423023;
    border-radius: 0.5rem;
    padding: 0.8rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .preview-thumb {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #241c16;
    border-radius: 0.4rem;
    flex-shrink: 0;
  }
  .preview-icon { font-size: 2rem; }
  .preview-info { flex: 1; }
  .item-type-badge {
    font-size: 0.65rem;
    font-weight: bold;
    color: #d4af37;
    letter-spacing: 0.05em;
  }
  .item-title { margin: 0.15rem 0; font-size: 1.1rem; color: #fef08a; }
  .item-desc {
    margin: 0;
    font-size: 0.78rem;
    color: #cbd5e1;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Mystery Toggle */
  .mystery-toggle-row {
    background: #241c16;
    border: 1px solid #4a382c;
    border-radius: 0.5rem;
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  .switch-label {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    cursor: pointer;
  }
  .switch-chk {
    margin-top: 0.2rem;
    accent-color: #d4af37;
    width: 16px;
    height: 16px;
  }
  .switch-text { font-size: 0.78rem; color: #ded0bc; line-height: 1.35; }
  .notes-input-row { display: flex; flex-direction: column; gap: 0.25rem; }
  .notes-lbl { font-size: 0.72rem; color: #d4af37; font-weight: bold; text-transform: uppercase; }
  .notes-input {
    background: #140f0c;
    border: 1px solid #523e30;
    border-radius: 0.35rem;
    padding: 0.45rem 0.65rem;
    color: #f7eed7;
    font-size: 0.82rem;
    font-family: inherit;
  }

  /* Actions Grid */
  .actions-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.85rem;
  }
  @media (min-width: 600px) {
    .actions-grid { grid-template-columns: 1fr 1fr; }
  }

  .action-card {
    background: #140f0c;
    border: 1px solid #423023;
    border-radius: 0.5rem;
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }
  .act-head { display: flex; align-items: center; gap: 0.5rem; }
  .act-ico { font-size: 1.4rem; }
  .act-title { margin: 0; font-size: 0.88rem; color: #fef08a; }
  .act-sub { font-size: 0.7rem; color: #ba9e84; }
  .act-desc { margin: 0; font-size: 0.75rem; color: #cbd5e1; line-height: 1.35; }

  .act-btn-row { display: flex; gap: 0.4rem; }
  .btn-action {
    width: 100%;
    padding: 0.55rem 0.75rem;
    border-radius: 0.35rem;
    border: none;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
  }
  .btn-action.primary { background: linear-gradient(135deg, #d4af37, #92400e); color: #181310; }
  .btn-action.cancel { width: auto; background: #322218; color: #fca5a5; border: 1px solid #7f1d1d; }
  .btn-action.broadcast { background: linear-gradient(135deg, #0284c7, #0369a1); color: #f0f9ff; }
  .btn-action.gift { background: linear-gradient(135deg, #16a34a, #15803d); color: #f0fdf4; }
  .btn-action:hover:not(:disabled) { filter: brightness(1.15); }
  .btn-action:disabled { opacity: 0.5; cursor: not-allowed; }

  .give-controls {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .player-select {
    flex: 1;
    background: #241c16;
    border: 1px solid #523e30;
    border-radius: 0.35rem;
    color: #fef08a;
    padding: 0.35rem 0.5rem;
    font-size: 0.78rem;
    font-family: inherit;
  }
  .qty-wrap {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: #cbd5e1;
  }
  .qty-input {
    width: 44px;
    background: #241c16;
    border: 1px solid #523e30;
    border-radius: 0.35rem;
    color: #fef08a;
    padding: 0.3rem;
    text-align: center;
    font-size: 0.8rem;
  }
  .no-players-alert {
    font-size: 0.72rem;
    color: #fca5a5;
    font-style: italic;
  }

  .feedback-banner {
    background: #14532d;
    border: 1px solid #22c55e;
    border-radius: 0.4rem;
    padding: 0.6rem 0.8rem;
    font-size: 0.8rem;
    color: #dcfce7;
    text-align: center;
  }
</style>
