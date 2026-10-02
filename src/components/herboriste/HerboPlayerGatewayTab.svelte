<script lang="ts">
  import { herboristeStore } from '$lib/herboriste/store.svelte';
  import { getPlayerConnections, broadcastToPlayers, emitToPlayerView } from '$lib/api';
  import { onMount } from 'svelte';
  import BotanicalIllustration from './BotanicalIllustration.svelte';
  import GemIllustration from './GemIllustration.svelte';

  interface ConnectedPlayer {
    id: string;
    name: string;
    character_name?: string;
  }

  let players = $state<ConnectedPlayer[]>([]);
  let selectedPlayerId = $state<string>('');
  let feedbackMessage = $state<string | null>(null);
  let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  // Selected item to quickly test projection or giveaway
  let quickPlant = $derived(herboristeStore.plants[0] ?? null);
  let quickGem = $derived(herboristeStore.gems[0] ?? null);

  async function refreshPlayers() {
    try {
      const list = await getPlayerConnections();
      players = list || [];
      if (players.length > 0 && !selectedPlayerId) {
        selectedPlayerId = players[0].id;
      }
    } catch {
      // Offline / standalone mode
      players = [];
    }
  }

  function setFeedback(msg: string) {
    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackMessage = msg;
    feedbackTimer = setTimeout(() => {
      feedbackMessage = null;
    }, 4000);
  }

  // Quick action: Project current lunar & astral climate
  function broadcastAstralClimate() {
    const climatePayload = {
      type: 'astral_climate',
      moonPhase: herboristeStore.currentMoonPhase,
      notes: 'Lueurs astrales et influences occultes détectées dans l\'atmosphère.'
    };
    broadcastToPlayers('herbo_item_shared', climatePayload);
    emitToPlayerView('show_herbo_reveal', {
      type: 'plant',
      item: {
        id: 'astral_sky',
        name: 'Climat Astral & Astres de Mystère',
        latinName: 'Astra Occulta',
        biome: 'plaines',
        rarity: 'rare',
        description: `La phase lunaire actuelle (${herboristeStore.currentMoonPhase}) modifie la puissance des concoctions et la floraison des plantes ésotériques.`,
        effects: ['Sensibilité magique accrue +1', 'Cueillette de nuit facilitée'],
        difficultyDC: 12
      },
      isMystery: false,
      gmNotes: 'Diffusé depuis la Passerelle VTT de l\'Herboristerie.'
    });
    setFeedback('🌙 Climat astral projeté sur la Vue Joueur et envoyé aux mobiles !');
  }

  // Quick action: Broadcast a Spore / Miasma Hazard warning
  function broadcastSporeHazard() {
    broadcastToPlayers('herbo_item_shared', {
      type: 'hazard',
      title: 'Nuage de Spores Toxiques !',
      description: 'L\'air se charge de spores vénéneuses microscopiques. Jet de Vigueur (Constitution) DD 14 requis sous peine d\'intoxication !'
    });
    setFeedback('🍄 Alerte Spores Toxiques envoyée à tous les aventuriers connectés !');
  }

  import { listen } from '@tauri-apps/api/event';

  // Quick action: Inflict poison to selected player (Idea 4)
  function inflictPoisonToSelected() {
    broadcastToPlayers('herbo_item_shared', {
      type: 'poison_inflict',
      target_id: selectedPlayerId || undefined,
      title: 'Venin de Crotale Sylvestre',
      description: 'Poison violent : -2 PV à chaque début de tour. Un test de Vigueur DD 14 ou un antidote est requis !'
    });
    setFeedback('💀 Poison infligé à l\'aventurier ciblé !');
  }

  // Quick action: Open merchant stall to players (Idea 5)
  function openMerchantToPlayers() {
    const catalog = [
      { id: 'm1', name: 'Baume de Soin de Rhya', price: 15, category: 'Potion', effect: 'Régénère 1d10+2 PV' },
      { id: 'm2', name: 'Antidote Universel Nain', price: 25, category: 'Remède', effect: 'Neutralise tout poison courant' },
      { id: 'm3', name: 'Poudre de Racine d\'Arnica', price: 8, category: 'Plante Séchée', effect: 'Accélère la convalescence' },
      { id: 'm4', name: 'Quartz Fumé Taillé', price: 40, category: 'Gemme', effect: 'Résistance aux illusions' }
    ];
    broadcastToPlayers('herbo_item_shared', {
      type: 'merchant_open',
      catalog: catalog
    });
    setFeedback('⚖️ Étal du Marchand ouvert sur tous les téléphones des joueurs !');
  }

  // Quick action: Trigger Alchemical Blast & Toxic Fog (Idea 2)
  function triggerAlchemicalFog() {
    broadcastToPlayers('herbo_item_shared', {
      type: 'hazard',
      title: '💥 Explosion d\'Alambic & Brouillard Toxique !',
      description: 'L\'alambic se fissure dans un éclat assourdissant. Une nappe de vapeurs émeraude envahit la pièce (Jet de Réflexes ou Vigueur DD 15).'
    });
    emitToPlayerView('show_herbo_reveal', {
      type: 'surge',
      item: {
        id: 'alembic_fiasco',
        title: 'Explosion d\'Alambic & Vapeurs Acides',
        description: 'Échec critique lors du brassage ! Le liquide bouillonne hors contrôle, vaporisant un brouillard caustique dans un rayon de 6 mètres.',
        gameRule: 'Visibilité réduite à 1,5m. Les créatures dans la zone subissent 1d6 acide chaque round sans protection respiratoire.'
      },
      isMystery: false,
      gmNotes: 'Déclenché par le MJ suite à un fiasco de manipulation alchimique.'
    });
    setFeedback('💥 Explosion d\'alambic & brouillard toxique projetés sur la table !');
  }

  // Quick action: Close Player View reveal
  function clearPlayerViewOverlay() {
    emitToPlayerView('close_herbo_reveal', {});
    setFeedback('👁️ Projection Vue Joueur masquée.');
  }

  onMount(() => {
    refreshPlayers();
    const interval = setInterval(refreshPlayers, 5000);

    const unlistens: (() => void)[] = [];
    listen('player_herbo_identify', (e: any) => {
      const data = e.payload?.data;
      const playerName = e.payload?.name || 'Aventurier';
      if (data?.success) {
        setFeedback(`✨ ${playerName} a réussi son analyse : "${data.clue}" ! Transmis à la Vue Joueur.`);
        // Forward clue to Player View
        emitToPlayerView('herbo_clue_discovered', { clue: `${playerName} : ${data.clue}` });
      } else {
        setFeedback(`❓ ${playerName} n'est pas parvenu à identifier le spécimen (${data?.roll}).`);
      }
    }).then(fn => unlistens.push(fn));

    listen('player_herbo_trade', (e: any) => {
      const item = e.payload?.data?.item;
      const playerName = e.payload?.name || 'Aventurier';
      setFeedback(`💰 ${playerName} a acheté : ${item?.name} pour ${item?.price} PO !`);
    }).then(fn => unlistens.push(fn));

    return () => {
      clearInterval(interval);
      unlistens.forEach(fn => fn());
    };
  });
</script>

<div class="gateway-container">
  <!-- Header banner -->
  <div class="gateway-header">
    <div class="header-icon">📡</div>
    <div class="header-texts">
      <h2>Passerelle VTT, Écran Joueur & Compagnons Mobiles</h2>
      <p>
        Croisez les secrets botaniques et minéralogiques avec la table de jeu. Projetez des parchemins cinématiques
        sur la Vue Joueur (2e écran / rétroprojecteur) et donnez directement herbes & gemmes dans les inventaires mobiles.
      </p>
    </div>
    <button type="button" class="refresh-btn" onclick={refreshPlayers} title="Rafraîchir les joueurs connectés">
      🔄 Rafraîchir ({players.length})
    </button>
  </div>

  {#if feedbackMessage}
    <div class="feedback-toast">
      <span>✨</span>
      <span>{feedbackMessage}</span>
    </div>
  {/if}

  <div class="gateway-grid">
    <!-- Left Column: Connected Players & Satchel Gifting -->
    <div class="panel-box">
      <div class="panel-title">
        <span class="icon">👥</span>
        <h3>Aventuriers Connectés ({players.length})</h3>
      </div>
      <p class="panel-desc">
        Joueurs actuellement connectés via l'application mobile Grimoire Companion (Wifi local).
      </p>

      {#if players.length === 0}
        <div class="empty-state">
          <span class="empty-icon">📵</span>
          <p>Aucun compagnon mobile connecté pour le moment.</p>
          <span class="empty-tip">Activez le serveur joueur dans les paramètres ou scannez le QR code.</span>
        </div>
      {:else}
        <div class="players-list">
          {#each players as player (player.id)}
            <div class="player-card" class:active={selectedPlayerId === player.id}>
              <div class="player-info">
                <span class="player-avatar">🧙</span>
                <div>
                  <strong class="player-char">{player.character_name || player.name}</strong>
                  <span class="player-user">({player.name})</span>
                </div>
              </div>
              <button
                type="button"
                class="gift-btn"
                onclick={() => {
                  if (quickPlant) {
                    herboristeStore.openShareModal('plant', quickPlant);
                  }
                }}
              >
                🎒 Partager / Offrir
              </button>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Direct Satchel Quick Inventory -->
      <div class="satchel-quick-sec">
        <h4>🎒 Votre Sacoche d'Herboriste (Stock actuel)</h4>
        <div class="satchel-pills">
          {#each herboristeStore.satchel.slice(0, 5) as item (item.plantId)}
            <div class="satchel-pill">
              <span>🌿 {item.plantName}</span>
              <span class="qty">x{item.quantity}</span>
              <button
                type="button"
                class="mini-share-btn"
                title="Partager cette herbe"
                onclick={() => {
                  const p = herboristeStore.plants.find(x => x.id === item.plantId);
                  if (p) herboristeStore.openShareModal('plant', p);
                }}
              >
                📡
              </button>
            </div>
          {/each}
          {#if herboristeStore.satchel.length === 0}
            <span class="empty-satchel-text">Votre sacoche est vide. Rendez-vous dans l'onglet Cueillette !</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Right Column: Dual Screen / Player View Controls & Atmospheric Triggers -->
    <div class="panel-box">
      <div class="panel-title">
        <span class="icon">🖥️</span>
        <h3>Contrôles Écran Joueur & Rétroprojecteur</h3>
      </div>
      <p class="panel-desc">
        Déclenchez des révélations immersives en plein écran avec parchemins animés, sceaux de cire et planches botaniques/gemmologiques.
      </p>

      <div class="actions-grid">
        <button type="button" class="ctrl-card" onclick={broadcastAstralClimate}>
          <div class="card-icon">🌙</div>
          <div class="card-text">
            <strong>Projeter Climat Astral</strong>
            <span>Affiche la phase lunaire ({herboristeStore.currentMoonPhase}) et les effets de marée magique.</span>
          </div>
        </button>

        <button type="button" class="ctrl-card hazard" onclick={broadcastSporeHazard}>
          <div class="card-icon">🍄</div>
          <div class="card-text">
            <strong>Alerte Spores & Miasme</strong>
            <span>Notifie tous les joueurs d'un danger végétal ambiant (Jet de sauvegarde Vigueur).</span>
          </div>
        </button>

        <button type="button" class="ctrl-card hazard" onclick={triggerAlchemicalFog}>
          <div class="card-icon">💥</div>
          <div class="card-text">
            <strong>Explosion d'Alambic & Brouillard</strong>
            <span>Déploie une nappe de vapeur toxique et force un test de survie.</span>
          </div>
        </button>

        <button type="button" class="ctrl-card hazard" onclick={inflictPoisonToSelected}>
          <div class="card-icon">💀</div>
          <div class="card-text">
            <strong>Appliquer Poison au Joueur Sélectionné</strong>
            <span>Active l'alerte d'intoxication et le besoin d'antidote d'urgence sur son mobile.</span>
          </div>
        </button>

        <button type="button" class="ctrl-card gemmological" onclick={openMerchantToPlayers}>
          <div class="card-icon">⚖️</div>
          <div class="card-text">
            <strong>Ouvrir l'Étal du Marchand</strong>
            <span>Diffuse le catalogue d'élixirs, gemmes et antidotes pour achat direct sur mobile.</span>
          </div>
        </button>

        {#if quickPlant}
          <button
            type="button"
            class="ctrl-card botanical"
            onclick={() => herboristeStore.openShareModal('plant', quickPlant, true)}
          >
            <div class="card-icon">🌿</div>
            <div class="card-text">
              <strong>Révélation Mystère : {quickPlant.name}</strong>
              <span>Projette une planche sans le vrai nom ni la recette (identification requise).</span>
            </div>
          </button>
        {/if}

        {#if quickGem}
          <button
            type="button"
            class="ctrl-card gemmological"
            onclick={() => herboristeStore.openShareModal('gem', quickGem, false)}
          >
            <div class="card-icon">💎</div>
            <div class="card-text">
              <strong>Planche Gemme : {quickGem.name}</strong>
              <span>Dévoile la pureté, le facettage et la puissance d'enchantement.</span>
            </div>
          </button>
        {/if}
      </div>

      <div class="clear-zone">
        <button type="button" class="clear-view-btn" onclick={clearPlayerViewOverlay}>
          ✕ Masquer l'encart sur la Vue Joueur
        </button>
      </div>
    </div>
  </div>

  <!-- Legend & Protocols -->
  <div class="gateway-footer">
    <div class="footer-item">
      <span class="bullet">🟢</span>
      <span><strong>Projection Écran :</strong> Émet via <code>emit_to_player_view</code> sur la fenêtre secondaire dédiée aux joueurs.</span>
    </div>
    <div class="footer-item">
      <span class="bullet">🔵</span>
      <span><strong>Diffusion Mobile :</strong> Émet via WebSocket aux téléphones et tablettes autour de la table.</span>
    </div>
    <div class="footer-item">
      <span class="bullet">🟣</span>
      <span><strong>Mode Mystère :</strong> Masque automatiquement les propriétés avancées et le nom savant jusqu'au test d'Herboristerie réussi.</span>
    </div>
  </div>
</div>

<style>
  .gateway-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 0.5rem;
    color: #f7eed7;
    font-family: 'Crimson Pro', Georgia, serif;
  }

  .gateway-header {
    background: linear-gradient(135deg, rgba(43, 31, 20, 0.9), rgba(24, 19, 16, 0.95));
    border: 1px solid #73533b;
    border-radius: 0.75rem;
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1.25rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .header-icon {
    font-size: 2.25rem;
    background: #3d2b1f;
    width: 3.5rem;
    height: 3.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1px solid #c9a84c;
    flex-shrink: 0;
  }

  .header-texts h2 {
    margin: 0 0 0.25rem 0;
    font-size: 1.4rem;
    color: #fef08a;
  }

  .header-texts p {
    margin: 0;
    font-size: 0.95rem;
    color: #d1c2aa;
    line-height: 1.4;
  }

  .refresh-btn {
    margin-left: auto;
    background: #4a3424;
    color: #fef08a;
    border: 1px solid #854d0e;
    padding: 0.5rem 0.9rem;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    font-weight: bold;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.2s ease;
  }

  .refresh-btn:hover {
    background: #63432d;
    border-color: #d97706;
  }

  .feedback-toast {
    background: linear-gradient(135deg, #14532d, #166534);
    border: 1px solid #4ade80;
    color: #f0fdf4;
    padding: 0.75rem 1.25rem;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }

  .gateway-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  @media (min-width: 900px) {
    .gateway-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .panel-box {
    background: #1f1813;
    border: 1px solid #4a3525;
    border-radius: 0.75rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .panel-title .icon {
    font-size: 1.4rem;
  }

  .panel-title h3 {
    margin: 0;
    font-size: 1.2rem;
    color: #f5ecd7;
  }

  .panel-desc {
    margin: 0;
    font-size: 0.85rem;
    color: #a89887;
    line-height: 1.4;
  }

  .empty-state {
    padding: 2rem 1rem;
    text-align: center;
    background: #18120e;
    border: 1px dashed #4a3525;
    border-radius: 0.5rem;
  }

  .empty-icon {
    font-size: 2rem;
    display: block;
    margin-bottom: 0.5rem;
    opacity: 0.6;
  }

  .empty-state p {
    margin: 0 0 0.25rem 0;
    color: #c4b5a5;
  }

  .empty-tip {
    font-size: 0.8rem;
    color: #8c7b6c;
  }

  .players-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    max-height: 14rem;
    overflow-y: auto;
  }

  .player-card {
    background: #281e18;
    border: 1px solid #523b2c;
    border-radius: 0.5rem;
    padding: 0.6rem 0.8rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: border-color 0.2s;
  }

  .player-card:hover {
    border-color: #c9a84c;
  }

  .player-info {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .player-avatar {
    font-size: 1.3rem;
  }

  .player-char {
    display: block;
    font-size: 0.95rem;
    color: #fef08a;
  }

  .player-user {
    font-size: 0.75rem;
    color: #a89887;
  }

  .gift-btn {
    background: #3d2b1f;
    border: 1px solid #73533b;
    color: #f5ecd7;
    padding: 0.35rem 0.7rem;
    border-radius: 0.35rem;
    font-size: 0.8rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
  }

  .gift-btn:hover {
    background: #543b2b;
    border-color: #d97706;
    color: #fff;
  }

  .satchel-quick-sec {
    margin-top: 0.5rem;
    border-top: 1px solid #3d2b1f;
    padding-top: 0.75rem;
  }

  .satchel-quick-sec h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.95rem;
    color: #c9a84c;
  }

  .satchel-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .satchel-pill {
    background: #2b1f17;
    border: 1px solid #5c4331;
    border-radius: 0.35rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .satchel-pill .qty {
    background: #4a3424;
    color: #fef08a;
    padding: 0.1rem 0.3rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: bold;
  }

  .mini-share-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 0;
    opacity: 0.7;
    transition: opacity 0.15s;
  }

  .mini-share-btn:hover {
    opacity: 1;
  }

  .empty-satchel-text {
    font-size: 0.8rem;
    font-style: italic;
    color: #8c7b6c;
  }

  .actions-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .ctrl-card {
    background: #281e18;
    border: 1px solid #523b2c;
    border-radius: 0.5rem;
    padding: 0.75rem;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    text-align: left;
    color: inherit;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s ease;
  }

  .ctrl-card:hover {
    background: #382920;
    border-color: #c9a84c;
    transform: translateY(-1px);
  }

  .ctrl-card.hazard:hover {
    border-color: #ef4444;
  }

  .ctrl-card.botanical:hover {
    border-color: #22c55e;
  }

  .ctrl-card.gemmological:hover {
    border-color: #38bdf8;
  }

  .card-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .card-text strong {
    display: block;
    font-size: 0.95rem;
    color: #fef08a;
    margin-bottom: 0.15rem;
  }

  .card-text span {
    font-size: 0.8rem;
    color: #bfaea0;
    line-height: 1.3;
  }

  .clear-zone {
    margin-top: 0.5rem;
  }

  .clear-view-btn {
    width: 100%;
    background: #331d1d;
    border: 1px solid #7f1d1d;
    color: #fca5a5;
    padding: 0.6rem;
    border-radius: 0.4rem;
    font-size: 0.85rem;
    font-family: inherit;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .clear-view-btn:hover {
    background: #451a1a;
    border-color: #ef4444;
    color: #fff;
  }

  .gateway-footer {
    background: #18120e;
    border: 1px solid #3d2b1f;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: #b8a695;
  }

  @media (min-width: 768px) {
    .gateway-footer {
      flex-direction: row;
      justify-content: space-between;
    }
  }

  .footer-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
</style>
