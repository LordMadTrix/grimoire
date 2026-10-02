<script lang="ts">
  import { soundscapeEngine, type SoundscapeType } from '$lib/herboriste/audio/soundscapes';

  let currentTrack = $state<SoundscapeType>('none');
  let volume = $state<number>(0.35);
  let isOpen = $state<boolean>(false);

  const TRACKS: { id: SoundscapeType; label: string; icon: string }[] = [
    { id: 'foret', label: 'Forêt & Feuillages', icon: '🌲' },
    { id: 'ruisseau', label: 'Torrent & Bâtée', icon: '🌊' },
    { id: 'mine', label: 'Mine & Écho Cristallin', icon: '⛏️' },
    { id: 'alchimie', label: 'Laboratoire Alchimique', icon: '⚗️' },
  ];

  function togglePlay(type: SoundscapeType) {
    if (currentTrack === type) {
      soundscapeEngine.stop();
      currentTrack = 'none';
    } else {
      soundscapeEngine.play(type);
      currentTrack = type;
    }
  }

  function handleVolumeChange(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    volume = val;
    soundscapeEngine.setVolume(val);
  }

  function stopAll() {
    soundscapeEngine.stop();
    currentTrack = 'none';
  }
</script>

<div class="sound-wrap">
  <button
    type="button"
    class="sound-btn"
    class:active={currentTrack !== 'none'}
    onclick={() => (isOpen = !isOpen)}
    title="Ambiances Sonores Immersives"
  >
    <span class="icon">{currentTrack === 'none' ? '🎧' : '🔊'}</span>
    <span class="label">
      {#if currentTrack === 'none'}
        Ambiance
      {:else}
        {TRACKS.find(t => t.id === currentTrack)?.icon} Actif
      {/if}
    </span>
  </button>

  {#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="sound-popover" onclick={(e) => e.stopPropagation()}>
      <div class="pop-header">
        <span>🎧 Ambiances Procédurales Web Audio</span>
        {#if currentTrack !== 'none'}
          <button type="button" class="btn-stop" onclick={stopAll}>Arrêter</button>
        {/if}
      </div>

      <div class="tracks-list">
        {#each TRACKS as t (t.id)}
          <button
            type="button"
            class="track-btn"
            class:playing={currentTrack === t.id}
            onclick={() => togglePlay(t.id)}
          >
            <span class="t-ico">{t.icon}</span>
            <span class="t-name">{t.label}</span>
            <span class="t-state">{currentTrack === t.id ? '▶ En cours' : 'Lancer'}</span>
          </button>
        {/each}
      </div>

      <div class="vol-row">
        <span class="vol-ico">🔈</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          oninput={handleVolumeChange}
          class="vol-slider"
        />
        <span class="vol-ico">🔊</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .sound-wrap {
    position: relative;
    display: inline-block;
  }

  .sound-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: #241c16;
    border: 1px solid #59473b;
    color: #e6d8c3;
    padding: 0.35rem 0.65rem;
    border-radius: 0.35rem;
    font-size: 0.75rem;
    font-weight: bold;
    cursor: pointer;
    font-family: Georgia, 'Times New Roman', serif;
    transition: all 0.15s ease;
  }
  .sound-btn:hover {
    background: #3b271b;
    border-color: #d4af37;
  }
  .sound-btn.active {
    background: #14532d;
    border-color: #22c55e;
    color: #86efac;
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.3);
  }

  .sound-popover {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    width: 17rem;
    background: #1e1712;
    border: 2px solid #5c3e29;
    border-radius: 0.5rem;
    padding: 0.75rem;
    box-shadow: 0 15px 25px -5px rgba(0, 0, 0, 0.6);
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    color: #e6d8c3;
    font-family: Georgia, 'Times New Roman', serif;
  }

  .pop-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.72rem;
    font-weight: bold;
    color: #fde047;
    border-bottom: 1px solid #3e2e23;
    padding-bottom: 0.35rem;
  }

  .btn-stop {
    background: #991b1b;
    border: none;
    color: #fff;
    font-size: 0.65rem;
    font-weight: bold;
    padding: 0.15rem 0.4rem;
    border-radius: 0.2rem;
    cursor: pointer;
  }

  .tracks-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .track-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #120e0b;
    border: 1px solid #3d2d23;
    border-radius: 0.3rem;
    padding: 0.4rem 0.6rem;
    color: #c4b5a5;
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.15s ease;
    text-align: left;
  }
  .track-btn:hover {
    background: #2b1d15;
    border-color: #854d0e;
    color: #fef08a;
  }
  .track-btn.playing {
    background: #1f3322;
    border-color: #16a34a;
    color: #86efac;
    font-weight: bold;
  }
  .t-ico { font-size: 1rem; }
  .t-name { flex: 1; }
  .t-state { font-size: 0.68rem; opacity: 0.8; }

  .vol-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-top: 0.35rem;
    border-top: 1px solid #3e2e23;
  }
  .vol-ico { font-size: 0.8rem; }
  .vol-slider {
    flex: 1;
    accent-color: #d4af37;
    cursor: pointer;
  }
</style>
