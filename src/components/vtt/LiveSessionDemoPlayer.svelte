<script lang="ts">
  import { gameSessionDemo } from '$lib/vtt/gameSessionDemoStore.svelte';
  import { fade, slide } from 'svelte/transition';

  let isCollapsed = $state(false);

  function handleClose() {
    gameSessionDemo.stop();
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

        <button
          class="ctrl-btn close-btn icon-only"
          onclick={handleClose}
          title="Quitter la Démo (Passer en mode MJ libre)"
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
  </div>
{/if}

<style>
  .demo-player-container {
    position: absolute;
    top: 52px;
    left: 16px;
    right: 16px;
    z-index: 85;
    background: rgba(15, 23, 42, 0.94);
    backdrop-filter: blur(16px);
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
    0% { transform: scale(0.9); opacity: 0.7; }
    50% { transform: scale(1.3); opacity: 1; }
    100% { transform: scale(0.9); opacity: 0.7; }
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
</style>
