<script lang="ts">
  import { readFileBase64 } from '$lib/api';
  import { getVaultPath, getVaultTree } from '$lib/stores/vault.svelte';

  let visible = $state(false);

  interface SoundSlot {
    name: string;
    src: string | null;
    audio: HTMLAudioElement | null;
    playing: boolean;
    loop: boolean;
    volume: number;
  }

  const SLOTS: SoundSlot[] = $state([
    { name: 'Effet 1', src: null, audio: null, playing: false, loop: false, volume: 0.8 },
    { name: 'Effet 2', src: null, audio: null, playing: false, loop: false, volume: 0.8 },
    { name: 'Effet 3', src: null, audio: null, playing: false, loop: false, volume: 0.8 },
    { name: 'Effet 4', src: null, audio: null, playing: false, loop: false, volume: 0.8 },
    { name: 'Stinger', src: null, audio: null, playing: false, loop: false, volume: 1.0 },
  ]);

  function getAllAudio(entries: any[], parent = ''): { path: string; name: string }[] {
    let list: { path: string; name: string }[] = [];
    for (const e of entries) {
      if (e.is_dir && e.children) list = [...list, ...getAllAudio(e.children, parent + e.name + '/')];
      else {
        const ext = e.extension?.toLowerCase();
        if (ext === 'mp3' || ext === 'wav' || ext === 'ogg' || ext === 'm4a')
          list.push({ path: parent + e.name, name: e.name });
      }
    }
    return list;
  }

  let showPicker = $state<number | null>(null); // slot index being picked

  async function selectFile(slotIdx: number, relativePath: string) {
    showPicker = null;
    const vp = getVaultPath();
    if (!vp) return;
    const slot = SLOTS[slotIdx];
    try {
      const b64 = await readFileBase64(`${vp}/${relativePath}`);
      const ext = relativePath.split('.').pop()?.toLowerCase() ?? 'mp3';
      const mime = ext === 'ogg' ? 'audio/ogg' : ext === 'wav' ? 'audio/wav' : 'audio/mpeg';
      const dataUrl = `data:${mime};base64,${b64}`;
      if (slot.audio) { slot.audio.pause(); }
      slot.src = dataUrl;
      slot.name = relativePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? `Effet ${slotIdx + 1}`;
      slot.audio = new Audio(dataUrl);
      slot.audio.loop = slot.loop;
      slot.audio.volume = slot.volume;
      slot.playing = false;
      slot.audio.onended = () => { if (!slot.loop) slot.playing = false; };
    } catch (err) { console.error('SoundBoard load error:', err); }
  }

  function togglePlay(slotIdx: number) {
    const slot = SLOTS[slotIdx];
    if (!slot.audio) return;
    if (slot.playing) {
      slot.audio.pause();
      slot.audio.currentTime = 0;
      slot.playing = false;
    } else {
      slot.audio.loop = slot.loop;
      slot.audio.volume = slot.volume;
      slot.audio.play();
      slot.playing = true;
    }
  }

  function setVolume(slotIdx: number, v: number) {
    const slot = SLOTS[slotIdx];
    slot.volume = v;
    if (slot.audio) slot.audio.volume = v;
  }

  function toggleLoop(slotIdx: number) {
    const slot = SLOTS[slotIdx];
    slot.loop = !slot.loop;
    if (slot.audio) slot.audio.loop = slot.loop;
  }

  function stopAll() {
    SLOTS.forEach((slot, i) => {
      if (slot.playing) togglePlay(i);
    });
  }

  export function toggle() { visible = !visible; }
</script>

<button class="sb-toggle" onclick={() => visible = !visible} title="Sound Board (effets sonores)">
  🎛️
</button>

{#if visible}
  <div class="sb-panel">
    <div class="sb-header">
      <span>🎛️ Sound Board</span>
      <button class="sb-stop-all" onclick={stopAll} title="Arrêter tout">⏹ Tout</button>
      <button class="sb-close" onclick={() => visible = false}>✕</button>
    </div>

    <div class="sb-slots">
      {#each SLOTS as slot, i}
        <div class="sb-slot" class:playing={slot.playing}>
          <div class="slot-top">
            <span class="slot-name" title={slot.name}>{slot.name}</span>
            <button class="slot-pick" onclick={() => showPicker = showPicker === i ? null : i} title="Choisir un son">📂</button>
            <button class="slot-loop" class:active={slot.loop} onclick={() => toggleLoop(i)} title="Boucle">🔁</button>
          </div>
          <div class="slot-controls">
            <button class="slot-play" onclick={() => togglePlay(i)} disabled={!slot.src}>
              {slot.playing ? '⏸' : '▶'}
            </button>
            <input type="range" min="0" max="1" step="0.05" value={slot.volume}
              oninput={(e) => setVolume(i, Number((e.target as HTMLInputElement).value))} />
          </div>

          {#if showPicker === i}
            {@const audios = getAllAudio(getVaultTree())}
            <div class="slot-picker">
              {#if audios.length === 0}
                <div class="picker-empty">Aucun fichier audio dans le vault</div>
              {:else}
                {#each audios as aud}
                  <button class="picker-item" onclick={() => selectFile(i, aud.path)}>{aud.name}</button>
                {/each}
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .sb-toggle {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .sb-toggle:hover { background: var(--bg-hover); }

  .sb-panel {
    position: fixed;
    bottom: 24px;
    left: 280px;
    z-index: 8000;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 300px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    overflow: hidden;
    animation: slideUp 0.15s ease-out;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .sb-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .sb-stop-all {
    margin-left: auto;
    background: transparent;
    border: 1px solid var(--border);
    color: #ef4444;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
  }
  .sb-stop-all:hover { background: rgba(239,68,68,0.1); }

  .sb-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 14px;
    padding: 2px 4px;
    border-radius: 4px;
  }
  .sb-close:hover { background: var(--bg-hover); }

  .sb-slots {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 8px;
  }

  .sb-slot {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 8px;
    transition: border-color 0.1s;
  }
  .sb-slot.playing {
    border-color: #22c55e;
    background: rgba(34,197,94,0.06);
  }

  .slot-top {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 4px;
  }

  .slot-name {
    font-size: 11px;
    color: var(--text-primary);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .slot-pick, .slot-loop {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 12px;
    padding: 1px 4px;
    border-radius: 3px;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .slot-loop.active { color: #22c55e; }
  .slot-pick:hover, .slot-loop:hover { background: var(--bg-hover); }

  .slot-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .slot-play {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    border-radius: 4px;
    padding: 2px 8px;
    cursor: pointer;
    font-size: 12px;
    flex-shrink: 0;
  }
  .slot-play:disabled { opacity: 0.35; cursor: not-allowed; }
  .slot-play:not(:disabled):hover { background: var(--bg-hover); }

  .slot-controls input[type="range"] {
    flex: 1;
    height: 3px;
    accent-color: #22c55e;
    cursor: pointer;
  }

  .slot-picker {
    margin-top: 6px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    max-height: 140px;
    overflow-y: auto;
    padding: 4px;
  }

  .picker-item {
    display: block;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .picker-item:hover { background: var(--bg-hover); color: var(--text-primary); }

  .picker-empty {
    padding: 12px;
    text-align: center;
    font-size: 11px;
    color: var(--text-muted);
  }
</style>
