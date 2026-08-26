<script lang="ts">
  import { soundscape } from '$lib/stores/soundscape.svelte';

  const { onclose } = $props<{ onclose: () => void }>();
</script>

<div class="mixer-card" role="dialog" aria-modal="true">
  <!-- Header -->
  <div class="mixer-header">
    <div class="mixer-title-wrap">
      <span class="mixer-icon">🌧️</span>
      <div>
        <h3 class="mixer-title">Mixeur d'Ambiance Sonore</h3>
        <span class="mixer-sub">Générateur procédural d'immersion VTT</span>
      </div>
    </div>

    <!-- Master Controls -->
    <div class="master-controls">
      <button class="btn-mute" class:is-muted={soundscape.isMuted} onclick={() => soundscape.toggleMute()} title={soundscape.isMuted ? 'Activer le son' : 'Couper le son (Mute)'}>
        {soundscape.isMuted ? '🔇' : '🔊'}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={soundscape.masterVolume}
        oninput={(e) => soundscape.setMasterVolume(parseFloat((e.target as HTMLInputElement).value))}
        class="master-slider"
        title="Volume Général"
      />
      <span class="master-vol-val">{Math.round(soundscape.masterVolume * 100)}%</span>
      <button class="btn-stop-all" onclick={() => soundscape.stopAll()} title="Arrêter toutes les pistes">
        ⏹️ Tout couper
      </button>
      <button class="btn-close" onclick={onclose} title="Fermer le mixeur">✕</button>
    </div>
  </div>

  <div class="mixer-body">
    <!-- Atmospheric Presets -->
    <div class="presets-section">
      <span class="section-label">⚡ Préréglages d'Ambiances :</span>
      <div class="presets-row">
        {#each soundscape.presets as p}
          <button class="btn-preset" onclick={() => soundscape.applyPreset(p.id)}>
            <span class="preset-icon">{p.icon}</span>
            <span class="preset-name">{p.name}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Active Tracks Channels -->
    <div class="channels-section">
      <span class="section-label">🎛️ Pistes d'Ambiance Superposables :</span>
      <div class="tracks-grid">
        {#each soundscape.tracks as track (track.id)}
          <div class="track-card" class:track-active={track.active}>
            <div class="track-header-row">
              <button
                type="button"
                class="track-toggle-btn"
                class:btn-playing={track.active}
                onclick={() => soundscape.toggleTrack(track.id)}
              >
                <span class="track-icon">{track.icon}</span>
                <span class="track-name">{track.name}</span>
                {#if track.active}
                  <span class="sound-wave">
                    <i></i><i></i><i></i>
                  </span>
                {/if}
              </button>
            </div>

            <div class="track-slider-row">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={track.volume}
                disabled={!track.active}
                oninput={(e) => soundscape.setTrackVolume(track.id, parseFloat((e.target as HTMLInputElement).value))}
                class="track-slider"
              />
              <span class="track-vol-text">{Math.round(track.volume * 100)}%</span>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Quick One-Shot SFX Bar -->
    <div class="sfx-section">
      <span class="section-label">💥 Bruitages Ponctuels (One-Shot SFX) :</span>
      <div class="sfx-row">
        <button class="btn-sfx" onclick={() => soundscape.playSFX('dice')}>
          🎲 Lancer de Dés
        </button>
        <button class="btn-sfx" onclick={() => soundscape.playSFX('sword')}>
          ⚔️ Coup d'Épée
        </button>
        <button class="btn-sfx" onclick={() => soundscape.playSFX('magic')}>
          ✨ Sortilège
        </button>
        <button class="btn-sfx" onclick={() => soundscape.playSFX('trap')}>
          💥 Déclenchement Piège
        </button>
        <button class="btn-sfx" onclick={() => soundscape.playSFX('monster')}>
          🧟 Rugissement Monstre
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .mixer-card {
    background: #0c1320;
    border: 1px solid #1e293b;
    border-radius: 12px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(56,189,248,0.2);
    width: 620px;
    max-width: 95vw;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: #e2e8f0;
    font-family: inherit;
    animation: scaleUp 0.15s ease-out;
  }
  @keyframes scaleUp {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }

  .mixer-header {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 0.8rem 1.2rem; background: #111a2c; border-bottom: 1px solid #1e293b;
  }
  .mixer-title-wrap { display: flex; align-items: center; gap: 10px; }
  .mixer-icon { font-size: 1.5rem; }
  .mixer-title { margin: 0; font-size: 0.95rem; color: #38bdf8; font-weight: 700; }
  .mixer-sub { font-size: 0.72rem; color: #64748b; }

  .master-controls { display: flex; align-items: center; gap: 8px; }
  .btn-mute {
    background: #1e293b; border: 1px solid #334155; border-radius: 6px;
    padding: 4px 8px; font-size: 0.9rem; cursor: pointer; color: #fff;
  }
  .btn-mute.is-muted { background: #7f1d1d; border-color: #ef4444; }
  .master-slider { width: 80px; accent-color: #38bdf8; cursor: pointer; }
  .master-vol-val { font-size: 0.75rem; font-family: monospace; color: #38bdf8; min-width: 32px; }
  .btn-stop-all {
    background: #1e293b; color: #f87171; border: 1px solid #475569;
    border-radius: 6px; padding: 4px 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer;
  }
  .btn-stop-all:hover { background: #7f1d1d; color: #fff; border-color: #ef4444; }
  .btn-close {
    background: none; border: none; color: #94a3b8; font-size: 1.1rem;
    cursor: pointer; padding: 2px 6px; border-radius: 4px;
  }
  .btn-close:hover { color: #fff; background: rgba(255,255,255,0.1); }

  .mixer-body { padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 14px; max-height: 75vh; overflow-y: auto; }
  .section-label { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }

  /* Presets */
  .presets-section { display: flex; flex-direction: column; gap: 6px; }
  .presets-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .btn-preset {
    background: #141f32; border: 1px solid #1e293b; border-radius: 6px;
    padding: 5px 10px; display: flex; align-items: center; gap: 6px;
    color: #cbd5e1; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
  }
  .btn-preset:hover { background: #0284c7; color: #fff; border-color: #38bdf8; }

  /* Tracks Grid */
  .channels-section { display: flex; flex-direction: column; gap: 6px; }
  .tracks-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  @media (max-width: 580px) { .tracks-grid { grid-template-columns: repeat(2, 1fr); } }

  .track-card {
    background: #101827; border: 1px solid #1e293b; border-radius: 8px;
    padding: 8px; display: flex; flex-direction: column; gap: 6px; transition: all 0.15s;
  }
  .track-active {
    background: #0f243a; border-color: #0284c7; box-shadow: 0 0 12px rgba(2,132,199,0.3);
  }
  .track-header-row { display: flex; align-items: center; justify-content: space-between; }
  .track-toggle-btn {
    background: none; border: none; padding: 0; color: #cbd5e1;
    font-size: 0.8rem; font-weight: 600; cursor: pointer; text-align: left;
    display: flex; align-items: center; gap: 6px; width: 100%;
  }
  .track-toggle-btn:hover { color: #38bdf8; }
  .track-toggle-btn.btn-playing { color: #38bdf8; font-weight: 700; }
  .track-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }

  /* Sound wave animation */
  .sound-wave { display: flex; align-items: flex-end; gap: 2px; height: 12px; }
  .sound-wave i {
    width: 2px; background: #38bdf8; border-radius: 1px;
    animation: wave 0.8s infinite ease-in-out alternate;
  }
  .sound-wave i:nth-child(1) { height: 4px; animation-delay: 0.1s; }
  .sound-wave i:nth-child(2) { height: 10px; animation-delay: 0.3s; }
  .sound-wave i:nth-child(3) { height: 6px; animation-delay: 0.2s; }
  @keyframes wave {
    0% { height: 3px; }
    100% { height: 12px; }
  }

  .track-slider-row { display: flex; align-items: center; gap: 6px; }
  .track-slider { flex: 1; height: 4px; accent-color: #38bdf8; cursor: pointer; }
  .track-slider:disabled { opacity: 0.3; cursor: not-allowed; }
  .track-vol-text { font-size: 0.68rem; font-family: monospace; color: #64748b; min-width: 28px; text-align: right; }
  .track-active .track-vol-text { color: #38bdf8; font-weight: 600; }

  /* SFX Bar */
  .sfx-section { display: flex; flex-direction: column; gap: 6px; border-top: 1px solid #1e293b; padding-top: 10px; }
  .sfx-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .btn-sfx {
    background: #1e293b; border: 1px solid #334155; border-radius: 6px;
    padding: 5px 9px; font-size: 0.75rem; font-weight: 600; color: #e2e8f0;
    cursor: pointer; transition: all 0.12s;
  }
  .btn-sfx:hover { background: #334155; color: #fff; transform: translateY(-1px); }
  .btn-sfx:active { transform: translateY(1px); }
</style>
