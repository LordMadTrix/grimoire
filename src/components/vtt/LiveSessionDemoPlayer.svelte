<script lang="ts">
  import { gameSessionDemo } from '$lib/vtt/gameSessionDemoStore.svelte';
  import { fade, slide, scale } from 'svelte/transition';

  let isCollapsed = $state(false);

  function handleOpenExit() {
    gameSessionDemo.showExitModal = true;
  }

  function handleExit(mode: 'restore' | 'clean' | 'keep') {
    gameSessionDemo.exitDemo(mode);
  }
</script>

{#if gameSessionDemo.isActive}
  <div class="demo-player-container" transition:slide={{ duration: 300 }}>
    <!-- Header du Lecteur -->
    <div class="demo-header">
      <div class="demo-title-group">
        <span class="live-pill">
          <span class="pulse-dot"></span>
          LIVE DÉMO
        </span>
        <div class="demo-titles">
          <h3>Session de Jeu : Le Sanctuaire Oublié</h3>
          <span class="step-indicator">
            {gameSessionDemo.currentStep.act} : {gameSessionDemo.currentStep.title}
          </span>
        </div>
      </div>

      <!-- Contrôles de lecture -->
      <div class="demo-controls">
        <button
          class="ctrl-btn"
          onclick={() => gameSessionDemo.prev()}
          disabled={gameSessionDemo.currentStepIndex === 0}
          title="Étape précédente"
        >
          ⏮ Précédent
        </button>

        <button
          class="ctrl-btn play-btn"
          class:active={gameSessionDemo.isPlaying}
          onclick={() => gameSessionDemo.togglePlay()}
          title={gameSessionDemo.isPlaying ? 'Mettre en pause' : 'Lecture automatique'}
        >
          {#if gameSessionDemo.isPlaying}
            ⏸ Pause ({gameSessionDemo.countdown}s)
          {:else}
            ▶ Lecture Auto
          {/if}
        </button>

        <button
          class="ctrl-btn"
          onclick={() => gameSessionDemo.next()}
          disabled={gameSessionDemo.currentStepIndex === gameSessionDemo.totalSteps - 1}
          title="Étape suivante"
        >
          Suivant ⏭
        </button>

        <button
          class="ctrl-btn icon-only"
          onclick={() => gameSessionDemo.goToStep(0)}
          title="Recommencer depuis l'Acte I"
        >
          ↺
        </button>

        <button
          class="ctrl-btn icon-only"
          onclick={() => isCollapsed = !isCollapsed}
          title={isCollapsed ? 'Déplier les détails' : 'Replier pour voir la carte'}
        >
          {isCollapsed ? '🔽' : '🔼'}
        </button>

        <!-- Bouton Quitter bien visible -->
        <button
          class="ctrl-btn exit-pill-btn"
          onclick={handleOpenExit}
          title="Quitter la Démo et choisir comment gérer les tokens"
        >
          🚪 Quitter Démo
        </button>

        <button
          class="ctrl-btn close-btn icon-only"
          onclick={handleOpenExit}
          title="Fermer la démo"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Timeline des 5 Actes -->
    <div class="acts-timeline">
      {#each gameSessionDemo.steps as step, i}
        <button
          class="act-node"
          class:active={i === gameSessionDemo.currentStepIndex}
          class:passed={i < gameSessionDemo.currentStepIndex}
          onclick={() => gameSessionDemo.goToStep(i)}
        >
          <span class="act-num">{step.act}</span>
          <span class="act-badge">{step.badge}</span>
        </button>
      {/each}
    </div>

    <!-- Contenu narratif et tactique (Repliable) -->
    {#if !isCollapsed}
      <div class="demo-body" transition:slide={{ duration: 250 }}>
        <!-- Bloc Narration du Maître du Jeu -->
        <div class="narrative-card">
          <div class="narrative-header">
            <span class="role-badge gm">📜 Parole du Maître du Jeu</span>
            {#if gameSessionDemo.currentStep.diceRollText}
              <span class="dice-chip">🎲 {gameSessionDemo.currentStep.diceRollText}</span>
            {/if}
          </div>
          <p class="narrative-text">
            {gameSessionDemo.currentStep.gmNarrative}
          </p>
        </div>

        <!-- Bloc Personnage Actif & Action Tactique -->
        <div class="tactical-grid">
          {#if gameSessionDemo.currentStep.speakerName}
            <div class="speaker-card">
              <img
                src={gameSessionDemo.currentStep.speakerAvatar}
                alt={gameSessionDemo.currentStep.speakerName}
                class="speaker-img"
              />
              <div class="speaker-info">
                <span class="speaker-name">{gameSessionDemo.currentStep.speakerName}</span>
                <blockquote class="speaker-quote">
                  {gameSessionDemo.currentStep.speakerQuote}
                </blockquote>
              </div>
            </div>
          {/if}

          <div class="action-card">
            <span class="action-label">⚡ Action sur la Table Virtuelle</span>
            <p class="action-detail">
              {gameSessionDemo.currentStep.actionDetail}
            </p>
          </div>
        </div>
      </div>
    {/if}

    <!-- Modal de Sortie de Démo & Gestion de Session -->
    {#if gameSessionDemo.showExitModal}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="demo-exit-backdrop" transition:fade={{ duration: 180 }} onclick={() => gameSessionDemo.showExitModal = false}>
        <div class="demo-exit-modal" transition:scale={{ start: 0.95, duration: 200 }} onclick={(e) => e.stopPropagation()}>
          <div class="modal-top">
            <div class="modal-icon">🎭</div>
            <div class="modal-titles">
              <h4>Quitter la Démo Live</h4>
              <p>Que souhaitez-vous faire des tokens et de la scène du Sanctuaire ?</p>
            </div>
            <button class="close-x-btn" onclick={() => gameSessionDemo.showExitModal = false} title="Annuler">✕</button>
          </div>

          <div class="exit-options">
            <button class="exit-opt-btn restore-opt" onclick={() => handleExit('restore')}>
              <div class="opt-icon">🔄</div>
              <div class="opt-text">
                <span class="opt-title">Restaurer ma session précédente <span class="badge-rec">Recommandé</span></span>
                <span class="opt-desc">Restaure fidèlement votre carte, vos tokens et vos réglages d'avant la démo.</span>
              </div>
            </button>

            <button class="exit-opt-btn clean-opt" onclick={() => handleExit('clean')}>
              <div class="opt-icon">🧹</div>
              <div class="opt-text">
                <span class="opt-title">Retirer tous les tokens factices de la démo</span>
                <span class="opt-desc">Supprime Sir Gareth, Elanor, Varis, squelettes et le boss de la table.</span>
              </div>
            </button>

            <button class="exit-opt-btn keep-opt" onclick={() => handleExit('keep')}>
              <div class="opt-icon">🎮</div>
              <div class="opt-text">
                <span class="opt-title">Conserver la scène en mode MJ libre</span>
                <span class="opt-desc">Garde le Sanctuaire et tous les pions pour continuer à jouer dessus librement.</span>
              </div>
            </button>
          </div>

          <div class="modal-actions">
            <button class="cancel-btn" onclick={() => gameSessionDemo.showExitModal = false}>
              Annuler et continuer la démo
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .demo-player-container {
    position: absolute;
    top: 52px;
    left: 16px;
    right: 16px;
    z-index: 85;
    background: #0f172ae6;
    border: 1px solid rgba(245, 158, 11, 0.45);
    border-radius: 14px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65), 0 0 30px rgba(245, 158, 11, 0.15);
    padding: 14px 18px;
    color: #f8fafc;
    font-family: inherit;
    max-width: 1200px;
    margin: 0 auto;
  }

  .demo-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .demo-title-group {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .live-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.6);
    color: #fca5a5;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.8px;
    padding: 3px 9px;
    border-radius: 20px;
  }

  .pulse-dot {
    width: 8px;
    height: 8px;
    background: #ef4444;
    border-radius: 50%;
    box-shadow: 0 0 10px #ef4444;
    animation: livePulse 1.4s infinite;
  }

  @keyframes livePulse {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
  }

  .demo-titles h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: #fbbf24;
    letter-spacing: 0.3px;
  }

  .step-indicator {
    font-size: 12px;
    color: #cbd5e1;
    font-weight: 500;
  }

  .demo-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ctrl-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    background: rgba(30, 41, 59, 0.85);
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 8px;
    color: #f1f5f9;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .ctrl-btn:hover:not(:disabled) {
    background: rgba(51, 65, 85, 0.95);
    border-color: #f59e0b;
    color: #fbbf24;
    transform: translateY(-1px);
  }

  .ctrl-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .play-btn {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(217, 119, 6, 0.4) 100%);
    border-color: #f59e0b;
    color: #fef3c7;
  }

  .play-btn.active {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.35) 0%, rgba(5, 150, 105, 0.45) 100%);
    border-color: #10b981;
    color: #a7f3d0;
  }

  .ctrl-btn.icon-only {
    padding: 6px 10px;
    font-size: 13px;
  }

  .close-btn:hover {
    background: rgba(239, 68, 68, 0.3) !important;
    border-color: #ef4444 !important;
    color: #fee2e2 !important;
  }

  /* Timeline */
  .acts-timeline {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    overflow-x: auto;
  }

  .act-node {
    flex: 1;
    min-width: 140px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 6px 10px;
    background: rgba(30, 41, 59, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
  }

  .act-node:hover {
    background: rgba(51, 65, 85, 0.7);
    border-color: rgba(245, 158, 11, 0.5);
  }

  .act-node.active {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(30, 41, 59, 0.8) 100%);
    border-color: #f59e0b;
    box-shadow: 0 0 12px rgba(245, 158, 11, 0.25);
  }

  .act-node.passed {
    border-color: rgba(16, 185, 129, 0.4);
  }

  .act-num {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: #94a3b8;
  }

  .act-node.active .act-num {
    color: #fbbf24;
  }

  .act-badge {
    font-size: 11px;
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  /* Body */
  .demo-body {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .narrative-card {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 10px 14px;
  }

  .narrative-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
    flex-wrap: wrap;
  }

  .role-badge.gm {
    font-size: 11px;
    font-weight: 700;
    color: #fbbf24;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .dice-chip {
    font-size: 11px;
    font-weight: 600;
    background: rgba(99, 102, 241, 0.2);
    border: 1px solid rgba(99, 102, 241, 0.4);
    color: #c7d2fe;
    padding: 2px 8px;
    border-radius: 6px;
  }

  .narrative-text {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: #f1f5f9;
    font-style: italic;
  }

  .tactical-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  @media (max-width: 768px) {
    .tactical-grid {
      grid-template-columns: 1fr;
    }
  }

  .speaker-card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 8px 12px;
  }

  .speaker-img {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid #f59e0b;
    object-fit: cover;
    flex-shrink: 0;
  }

  .speaker-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .speaker-name {
    font-size: 12px;
    font-weight: 700;
    color: #fbbf24;
  }

  .speaker-quote {
    margin: 0;
    font-size: 12px;
    color: #cbd5e1;
    font-style: italic;
    line-height: 1.35;
  }

  .action-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 8px 12px;
  }

  .action-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: #10b981;
    letter-spacing: 0.5px;
  }

  .action-detail {
    margin: 0;
    font-size: 12px;
    color: #e2e8f0;
    line-height: 1.4;
  }

  .exit-pill-btn {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
    color: #fca5a5;
    font-weight: 700;
  }

  .exit-pill-btn:hover {
    background: rgba(239, 68, 68, 0.4) !important;
    border-color: #ef4444 !important;
    color: #fff !important;
    transform: translateY(-1px);
    box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
  }

  /* Modal de Sortie */
  .demo-exit-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .demo-exit-modal {
    background: #0f172a;
    border: 1px solid rgba(245, 158, 11, 0.4);
    border-radius: 16px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(245, 158, 11, 0.2);
    max-width: 540px;
    width: 100%;
    padding: 22px 24px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    color: #f8fafc;
  }

  .modal-top {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .modal-icon {
    font-size: 28px;
    line-height: 1;
  }

  .modal-titles {
    flex: 1;
  }

  .modal-titles h4 {
    margin: 0 0 4px 0;
    font-size: 17px;
    font-weight: 700;
    color: #fbbf24;
  }

  .modal-titles p {
    margin: 0;
    font-size: 13px;
    color: #94a3b8;
    line-height: 1.4;
  }

  .close-x-btn {
    background: none;
    border: none;
    color: #64748b;
    font-size: 16px;
    cursor: pointer;
    padding: 4px;
    line-height: 1;
    border-radius: 6px;
    transition: color 0.15s;
  }

  .close-x-btn:hover {
    color: #f1f5f9;
  }

  .exit-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .exit-opt-btn {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(30, 41, 59, 0.6);
    color: #f8fafc;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
  }

  .exit-opt-btn:hover {
    transform: translateY(-2px);
  }

  .opt-icon {
    font-size: 24px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    flex-shrink: 0;
  }

  .opt-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .opt-title {
    font-size: 13px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .badge-rec {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    background: rgba(59, 130, 246, 0.25);
    border: 1px solid rgba(59, 130, 246, 0.6);
    color: #93c5fd;
    padding: 1px 6px;
    border-radius: 12px;
  }

  .opt-desc {
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.35;
  }

  .restore-opt:hover {
    background: rgba(59, 130, 246, 0.18);
    border-color: #3b82f6;
  }

  .restore-opt:hover .opt-title {
    color: #60a5fa;
  }

  .clean-opt:hover {
    background: rgba(239, 68, 68, 0.18);
    border-color: #ef4444;
  }

  .clean-opt:hover .opt-title {
    color: #f87171;
  }

  .keep-opt:hover {
    background: rgba(16, 185, 129, 0.18);
    border-color: #10b981;
  }

  .keep-opt:hover .opt-title {
    color: #34d399;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
  }

  .cancel-btn {
    background: transparent;
    border: 1px solid rgba(148, 163, 184, 0.25);
    color: #94a3b8;
    padding: 7px 14px;
    font-size: 12px;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .cancel-btn:hover {
    color: #f1f5f9;
    border-color: #64748b;
  }
</style>
