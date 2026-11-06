<script lang="ts">
  import { onMount } from 'svelte';
  import {
    listMonitors,
    openPlayerView,
    closePlayerView,
    movePlayerViewToMonitor,
    togglePlayerViewFullscreen,
    getPlayerViewStatus,
    type MonitorInfo,
    type PlayerViewStatus
  } from '$lib/api';

  let { onclose, onLaunched }: { onclose: () => void; onLaunched?: (msg: string) => void } = $props();

  let monitors = $state<MonitorInfo[]>([]);
  let viewStatus = $state<PlayerViewStatus>({ is_open: false, is_fullscreen: false, current_monitor_index: null });
  let loading = $state(true);
  let actionLoading = $state(false);
  let errorMessage = $state('');
  let launchFullscreen = $state(true);

  async function refresh() {
    loading = true;
    errorMessage = '';
    try {
      const [mons, status] = await Promise.all([
        listMonitors(),
        getPlayerViewStatus()
      ]);
      monitors = mons;
      viewStatus = status;
    } catch (err: any) {
      console.error('Erreur chargement écrans:', err);
      errorMessage = String(err?.message || err);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    refresh();
  });

  async function handleLaunch(index: number) {
    actionLoading = true;
    errorMessage = '';
    try {
      await openPlayerView(index, launchFullscreen);
      const targetName = monitors[index]?.name || `Écran ${index + 1}`;
      onLaunched?.(`Vue Joueurs déployée sur ${targetName}`);
      await refresh();
      setTimeout(() => {
        onclose();
      }, 400);
    } catch (err: any) {
      console.error('Erreur lancement vue joueur:', err);
      errorMessage = `Impossible de lancer sur l'écran ${index + 1} : ${err}`;
    } finally {
      actionLoading = false;
    }
  }

  async function handleMove(index: number) {
    actionLoading = true;
    try {
      await movePlayerViewToMonitor(index);
      await refresh();
      onLaunched?.(`Vue Joueurs déplacée sur ${monitors[index]?.name || `Écran ${index + 1}`}`);
    } catch (err: any) {
      errorMessage = `Erreur déplacement : ${err}`;
    } finally {
      actionLoading = false;
    }
  }

  async function handleToggleFullscreen() {
    actionLoading = true;
    try {
      const isFs = await togglePlayerViewFullscreen();
      viewStatus.is_fullscreen = isFs;
      onLaunched?.(isFs ? 'Plein écran activé' : 'Mode fenêtré activé');
    } catch (err: any) {
      errorMessage = `Erreur bascule plein écran : ${err}`;
    } finally {
      actionLoading = false;
    }
  }

  async function handleClosePlayer() {
    actionLoading = true;
    try {
      await closePlayerView();
      await refresh();
      onLaunched?.('Vue Joueurs fermée');
    } catch (err: any) {
      errorMessage = `Erreur fermeture : ${err}`;
    } finally {
      actionLoading = false;
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="modal-backdrop" onclick={onclose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-card" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    
    <div class="modal-header">
      <div class="title-wrap">
        <span class="icon">🖥️</span>
        <div>
          <h3>Gestion Multi-Écran & Vue Joueurs</h3>
          <p class="subtitle">Sélectionnez l'écran où projeter la table de jeu pour vos joueurs (TV, moniteur secondaire, vidéoprojecteur).</p>
        </div>
      </div>
      <button class="btn-close" onclick={onclose} title="Fermer (Échap)">✕</button>
    </div>

    {#if errorMessage}
      <div class="error-banner">
        ⚠️ {errorMessage}
      </div>
    {/if}

    <!-- Statut actif si la fenêtre est déjà ouverte -->
    {#if viewStatus.is_open}
      <div class="active-status-bar">
        <div class="status-left">
          <span class="live-dot pulse"></span>
          <div>
            <strong>Vue Joueur actuellement active</strong>
            <span class="status-detail">
              {#if viewStatus.current_monitor_index !== null && monitors[viewStatus.current_monitor_index]}
                Sur : <em>{monitors[viewStatus.current_monitor_index].name || `Écran ${viewStatus.current_monitor_index + 1}`}</em>
              {:else}
                Fenêtre ouverte
              {/if}
              · {viewStatus.is_fullscreen ? 'Plein écran' : 'Fenêtré'}
            </span>
          </div>
        </div>
        <div class="status-actions">
          <button class="btn-small" onclick={handleToggleFullscreen} disabled={actionLoading} title="Basculer Plein écran / Fenêtré (F11)">
            {viewStatus.is_fullscreen ? '🗗 Fenêtré' : '🔲 Plein écran'}
          </button>
          <button class="btn-small danger" onclick={handleClosePlayer} disabled={actionLoading} title="Fermer la fenêtre joueur">
            ✕ Fermer
          </button>
        </div>
      </div>
    {/if}

    <div class="modal-body">
      {#if loading}
        <div class="loading-state">
          <span class="spinner">⏳</span>
          <p>Détection des écrans connectés…</p>
        </div>
      {:else}
        <!-- Option Plein écran -->
        <div class="options-bar">
          <label class="checkbox-label" title="Désactiver pour ouvrir dans une fenêtre standard déplaçable avec la souris">
            <input type="checkbox" bind:checked={launchFullscreen} />
            <span>Lancer en plein écran immersif (sans bordures de fenêtre)</span>
          </label>
          <button class="btn-refresh" onclick={refresh} disabled={actionLoading} title="Rafraîchir si vous venez de brancher un écran">
            🔄 Rafraîchir
          </button>
        </div>

        <!-- Grille des écrans -->
        <div class="monitors-grid">
          {#each monitors as monitor, i}
            {@const isCurrentMonitor = viewStatus.is_open && viewStatus.current_monitor_index === i}
            {@const isSecondScreen = !monitor.is_primary && i === 1}
            <div 
              class="monitor-card" 
              class:is-primary={monitor.is_primary} 
              class:is-second-best={isSecondScreen && !viewStatus.is_open}
              class:is-active-target={isCurrentMonitor}
            >
              <div class="monitor-card-header">
                <div class="screen-preview">
                  <div class="screen-glass">
                    <span class="screen-num">{i + 1}</span>
                    <span class="screen-sub">{monitor.size[0]}×{monitor.size[1]}</span>
                  </div>
                  <div class="screen-stand"></div>
                </div>

                <div class="monitor-meta">
                  <div class="monitor-title-row">
                    <span class="badge-idx">Écran {i + 1}</span>
                    {#if monitor.is_primary}
                      <span class="badge primary">Principal (MJ)</span>
                    {:else if i === 1}
                      <span class="badge recommended">⭐ Recommandé TV / Joueurs</span>
                    {:else}
                      <span class="badge">Secondaire</span>
                    {/if}
                    {#if isCurrentMonitor}
                      <span class="badge active-badge">🟢 Actif</span>
                    {/if}
                  </div>
                  <strong class="screen-name">{monitor.name || `Moniteur ${i + 1}`}</strong>
                  <span class="screen-specs">
                    Résolution : {monitor.size[0]} × {monitor.size[1]} px
                    {#if monitor.scale_factor && monitor.scale_factor !== 1}
                      · Échelle : {Math.round(monitor.scale_factor * 100)}%
                    {/if}
                  </span>
                </div>
              </div>

              <div class="monitor-actions">
                {#if isCurrentMonitor}
                  <button class="btn-action active-now" disabled>
                    ✓ Vue Joueurs affichée ici
                  </button>
                {:else if viewStatus.is_open}
                  <button class="btn-action primary" onclick={() => handleMove(i)} disabled={actionLoading}>
                    ➡️ Déplacer la vue ici (Écran {i + 1})
                  </button>
                {:else}
                  <button 
                    class="btn-action" 
                    class:highlight={isSecondScreen || (!monitor.is_primary && monitors.length > 1)} 
                    class:primary={monitor.is_primary && monitors.length === 1}
                    onclick={() => handleLaunch(i)} 
                    disabled={actionLoading}
                  >
                    {#if isSecondScreen}
                      🚀 Projeter sur l'Écran 2 (Joueurs)
                    {:else if monitor.is_primary && monitors.length > 1}
                      🖥️ Projeter sur l'Écran 1 (Principal)
                    {:else}
                      🖥️ Ouvrir la Vue Joueurs
                    {/if}
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        {#if monitors.length === 1}
          <div class="single-monitor-hint">
            <span class="hint-icon">💡</span>
            <div>
              <strong>Un seul écran détecté</strong>
              <p>Pour jouer autour d'une table avec vos joueurs, branchez un câble HDMI vers votre TV ou votre vidéoprojecteur. Une fois branché, cliquez sur <em>« 🔄 Rafraîchir »</em> pour le voir apparaître instantanément !</p>
            </div>
          </div>
        {/if}

        <!-- Encart d'aide & raccourcis clavier -->
        <div class="help-box">
          <div class="help-title">🎯 Raccourcis utiles & astuces Windows</div>
          <div class="shortcuts-list">
            <div class="shortcut-item">
              <kbd>F11</kbd>
              <span>Basculer entre le Plein Écran et le mode Fenêtré sur la vue joueur.</span>
            </div>
            <div class="shortcut-item">
              <kbd>Échap</kbd>
              <span>Quitter le plein écran joueur en cas de besoin.</span>
            </div>
            <div class="shortcut-item">
              <kbd>Win + Maj + ➔</kbd>
              <span>Raccourci magique de Windows pour déplacer n'importe quelle fenêtre vers l'écran suivant sans la fermer !</span>
            </div>
          </div>
        </div>

      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" onclick={onclose}>Fermer</button>
    </div>

  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 16px;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-card {
    background: #18191e;
    border: 1px solid rgba(229, 168, 83, 0.3);
    border-radius: 12px;
    width: 100%;
    max-width: 680px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), 0 0 24px rgba(229, 168, 83, 0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: zoomIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes zoomIn {
    from { transform: scale(0.96); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 20px 24px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .title-wrap {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .title-wrap .icon {
    font-size: 28px;
    line-height: 1;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
  }

  .title-wrap h3 {
    margin: 0 0 4px 0;
    font-size: 18px;
    font-weight: 700;
    color: #f3f4f6;
    letter-spacing: -0.2px;
  }

  .subtitle {
    margin: 0;
    font-size: 13px;
    color: #9ca3af;
    line-height: 1.4;
  }

  .btn-close {
    background: transparent;
    border: none;
    color: #9ca3af;
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .btn-close:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
  }

  .error-banner {
    background: rgba(239, 68, 68, 0.15);
    border-left: 4px solid #ef4444;
    padding: 10px 18px;
    color: #fca5a5;
    font-size: 13px;
    margin: 12px 24px 0;
    border-radius: 4px;
  }

  /* Active Bar */
  .active-status-bar {
    background: rgba(34, 197, 94, 0.12);
    border: 1px solid rgba(34, 197, 94, 0.35);
    margin: 16px 24px 0;
    padding: 12px 16px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .status-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .live-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 10px #22c55e;
  }

  .live-dot.pulse {
    animation: pulse 1.8s infinite;
  }

  @keyframes pulse {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
    70% { transform: scale(1.15); box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
  }

  .active-status-bar strong {
    display: block;
    font-size: 13px;
    color: #86efac;
  }

  .status-detail {
    font-size: 12px;
    color: #d1d5db;
  }

  .status-actions {
    display: flex;
    gap: 8px;
  }

  .btn-small {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #e5e7eb;
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
  }

  .btn-small:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .btn-small.danger {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: #fca5a5;
  }

  .btn-small.danger:hover:not(:disabled) {
    background: #ef4444;
    color: white;
  }

  /* Body */
  .modal-body {
    padding: 20px 24px;
    overflow-y: auto;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 36px 0;
    color: #9ca3af;
    gap: 8px;
  }

  .options-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #d1d5db;
    cursor: pointer;
  }

  .checkbox-label input {
    accent-color: #e5a853;
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .btn-refresh {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #9ca3af;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-refresh:hover:not(:disabled) {
    color: white;
    background: rgba(255, 255, 255, 0.08);
  }

  /* Monitors Grid */
  .monitors-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .monitor-card {
    background: #20222a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: all 0.2s;
  }

  .monitor-card.is-second-best {
    border-color: rgba(229, 168, 83, 0.5);
    background: linear-gradient(135deg, #24242e 0%, #1f2029 100%);
    box-shadow: 0 4px 14px rgba(229, 168, 83, 0.12);
  }

  .monitor-card.is-active-target {
    border-color: rgba(34, 197, 94, 0.5);
    background: rgba(34, 197, 94, 0.05);
  }

  .monitor-card-header {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .screen-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }

  .screen-glass {
    width: 68px;
    height: 44px;
    background: #111217;
    border: 2px solid #4b5563;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.8);
  }

  .monitor-card.is-second-best .screen-glass {
    border-color: #e5a853;
    box-shadow: 0 0 10px rgba(229, 168, 83, 0.3), inset 0 0 8px rgba(0, 0, 0, 0.8);
  }

  .screen-num {
    font-size: 14px;
    font-weight: 800;
    color: #f3f4f6;
  }

  .screen-sub {
    font-size: 8px;
    color: #9ca3af;
  }

  .screen-stand {
    width: 20px;
    height: 5px;
    background: #4b5563;
    border-radius: 0 0 2px 2px;
  }

  .monitor-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .monitor-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .badge-idx {
    font-size: 12px;
    font-weight: 700;
    color: #f3f4f6;
  }

  .badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: #9ca3af;
  }

  .badge.primary {
    background: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .badge.recommended {
    background: rgba(229, 168, 83, 0.2);
    color: #e5a853;
    border: 1px solid rgba(229, 168, 83, 0.4);
  }

  .badge.active-badge {
    background: rgba(34, 197, 94, 0.2);
    color: #86efac;
    border: 1px solid rgba(34, 197, 94, 0.4);
  }

  .screen-name {
    font-size: 14px;
    color: #e5e7eb;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .screen-specs {
    font-size: 12px;
    color: #9ca3af;
  }

  .monitor-actions {
    display: flex;
    justify-content: flex-end;
  }

  .btn-action {
    padding: 8px 18px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #e5e7eb;
    transition: all 0.2s;
  }

  .btn-action:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .btn-action.highlight {
    background: linear-gradient(135deg, #e5a853 0%, #c98e3b 100%);
    border-color: #e5a853;
    color: #121318;
    box-shadow: 0 4px 12px rgba(229, 168, 83, 0.3);
  }

  .btn-action.highlight:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(229, 168, 83, 0.45);
  }

  .btn-action.primary {
    background: #3b82f6;
    border-color: #3b82f6;
    color: white;
  }

  .btn-action.active-now {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.4);
    color: #86efac;
    cursor: default;
  }

  /* Hint */
  .single-monitor-hint {
    background: rgba(59, 130, 246, 0.08);
    border: 1px solid rgba(59, 130, 246, 0.25);
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: #bfdbfe;
    line-height: 1.5;
  }

  .single-monitor-hint strong {
    display: block;
    font-size: 13px;
    margin-bottom: 2px;
    color: #93c5fd;
  }

  .single-monitor-hint p {
    margin: 0;
    color: #dbeafe;
  }

  /* Help box */
  .help-box {
    background: rgba(0, 0, 0, 0.25);
    border: 1px dashed rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    padding: 12px 16px;
  }

  .help-title {
    font-size: 12px;
    font-weight: 700;
    color: #e5a853;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: #9ca3af;
  }

  kbd {
    background: #2a2d37;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-bottom-width: 2px;
    border-radius: 4px;
    padding: 2px 6px;
    font-family: monospace;
    font-size: 11px;
    font-weight: 700;
    color: #f3f4f6;
    flex-shrink: 0;
  }

  /* Footer */
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    padding: 14px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #d1d5db;
    padding: 7px 16px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }
</style>

