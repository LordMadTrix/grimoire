<script lang="ts">
  import { onMount } from 'svelte';
  import { soundscape, SFX_LIST } from '$lib/stores/soundscape.svelte';

  let { onClose }: { onClose?: () => void } = $props();

  let activeSfx = $state<string | null>(null);

  function triggerSfx(id: string) {
    activeSfx = id;
    soundscape.playSfx(id, true);
    setTimeout(() => {
      if (activeSfx === id) activeSfx = null;
    }, 400);
  }

  function handleKeyDown(e: KeyboardEvent) {
    // Ne pas intercepter si l'utilisateur saisit dans un champ texte
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
      return;
    }
    const item = SFX_LIST.find(s => s.shortcut === e.key || `Numpad${s.shortcut}` === e.code);
    if (item) {
      e.preventDefault();
      triggerSfx(item.id);
    } else if (e.key === 'Escape' && onClose) {
      onClose();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });
</script>

<div class="sfx-soundboard" role="region" aria-label="Soundboard SFX">
  <div class="sfx-header">
    <div class="sfx-title">
      <span class="sfx-icon">🔊</span>
      <strong>Soundboard SFX</strong>
      <span class="sfx-badge">Web Audio + Mobile</span>
    </div>
    {#if onClose}
      <button type="button" class="sfx-close" onclick={onClose} title="Fermer">✕</button>
    {/if}
  </div>

  <div class="sfx-grid">
    {#each SFX_LIST as sfx}
      <button
        type="button"
        class="sfx-btn"
        class:active={activeSfx === sfx.id}
        onclick={() => triggerSfx(sfx.id)}
        title={`${sfx.name} (Raccourci: ${sfx.shortcut})`}
      >
        <span class="sfx-emoji">{sfx.icon}</span>
        <span class="sfx-name">{sfx.name}</span>
        <span class="sfx-key">{sfx.shortcut}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .sfx-soundboard {
    background: rgba(18, 22, 32, 0.95);
    border: 1px solid rgba(229, 168, 83, 0.35);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.55), 0 0 15px rgba(229, 168, 83, 0.15);
    backdrop-filter: blur(10px);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    user-select: none;
    z-index: 1000;
  }

  .sfx-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .sfx-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #e5a853;
  }

  .sfx-badge {
    font-size: 9px;
    background: rgba(229, 168, 83, 0.15);
    border: 1px solid rgba(229, 168, 83, 0.3);
    color: #e5a853;
    padding: 1px 6px;
    border-radius: 8px;
  }

  .sfx-close {
    background: none;
    border: none;
    color: #8899b7;
    cursor: pointer;
    font-size: 13px;
    padding: 2px 4px;
    border-radius: 4px;
    transition: color 0.15s;
  }

  .sfx-close:hover {
    color: #ff6b6b;
  }

  .sfx-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .sfx-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 8px 6px;
    background: rgba(26, 32, 48, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #c9d1d9;
    cursor: pointer;
    position: relative;
    transition: all 0.15s ease;
  }

  .sfx-btn:hover {
    border-color: rgba(229, 168, 83, 0.6);
    background: rgba(36, 44, 66, 0.95);
    transform: translateY(-1px);
  }

  .sfx-btn:active,
  .sfx-btn.active {
    border-color: #e5a853;
    background: rgba(229, 168, 83, 0.25);
    box-shadow: 0 0 12px rgba(229, 168, 83, 0.5);
    transform: scale(0.96);
  }

  .sfx-emoji {
    font-size: 20px;
    line-height: 1;
  }

  .sfx-name {
    font-size: 10px;
    font-weight: 600;
  }

  .sfx-key {
    position: absolute;
    top: 3px;
    right: 4px;
    font-size: 8px;
    font-family: monospace;
    color: #8899b7;
    background: rgba(0, 0, 0, 0.35);
    padding: 0 4px;
    border-radius: 3px;
  }
</style>
