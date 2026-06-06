<script lang="ts">
  import { sendHandout } from '$lib/stores/vtt.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let mode = $state<'image' | 'note'>('image');
  let title = $state('');
  let noteText = $state('');
  let imgPreview = $state<string | null>(null);
  let sending = $state(false);
  let sent = $state(false);
  let fileInput = $state<HTMLInputElement | undefined>(undefined);

  async function pickFile() {
    fileInput?.click();
  }

  async function onFileChange() {
    const file = fileInput?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      imgPreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function send() {
    if (mode === 'image' && !imgPreview) return;
    if (mode === 'note' && !noteText.trim()) return;
    sending = true;
    sendHandout(mode, mode === 'image' ? imgPreview! : noteText.trim(), title.trim() || undefined);
    sending = false;
    sent = true;
    setTimeout(() => { sent = false; onclose(); }, 1200);
  }
</script>

<div class="ho-backdrop" onclick={onclose} role="none">
  <div class="ho-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
    <div class="ho-header">
      <span>📤 Handout Joueur</span>
      <button class="ho-close" onclick={onclose}>×</button>
    </div>

    <div class="ho-tabs">
      <button class="ho-tab" class:active={mode === 'image'} onclick={() => mode = 'image'}>🖼️ Image</button>
      <button class="ho-tab" class:active={mode === 'note'} onclick={() => mode = 'note'}>📝 Note</button>
    </div>

    <input class="ho-input" type="text" placeholder="Titre (optionnel)" bind:value={title} />

    {#if mode === 'image'}
      <input bind:this={fileInput} type="file" accept="image/*" style="display:none" onchange={onFileChange} />
      <div class="ho-img-zone" onclick={pickFile} role="button" tabindex="0">
        {#if imgPreview}
          <img src={imgPreview} alt="preview" class="ho-preview" />
        {:else}
          <span class="ho-img-hint">Cliquer pour choisir une image</span>
        {/if}
      </div>
    {:else}
      <textarea class="ho-textarea" placeholder="Texte à afficher…" bind:value={noteText} rows="5"></textarea>
    {/if}

    {#if sent}
      <div class="ho-sent">✅ Envoyé aux joueurs !</div>
    {/if}

    <div class="ho-actions">
      <button class="ho-btn ho-sec" onclick={onclose}>Annuler</button>
      <button class="ho-btn ho-pri" onclick={send} disabled={sending || (mode === 'image' ? !imgPreview : !noteText.trim())}>
        {sending ? '…' : '📤 Envoyer'}
      </button>
    </div>
  </div>
</div>

<style>
  .ho-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 1500;
    display: flex; align-items: center; justify-content: center;
  }
  .ho-modal {
    background: var(--bg-secondary, #161b22);
    border: 1px solid var(--border, #2d3748);
    border-radius: 12px; padding: 20px; width: 340px; max-width: 95vw;
    display: flex; flex-direction: column; gap: 12px;
    box-shadow: 0 12px 40px rgba(0,0,0,.7);
  }
  .ho-header {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 14px; font-weight: 700; color: var(--accent, #e5a853);
  }
  .ho-close { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 20px; }
  .ho-tabs { display: flex; gap: 6px; }
  .ho-tab {
    flex: 1; padding: 7px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;
    background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-muted);
  }
  .ho-tab.active { background: var(--accent); color: #000; border-color: var(--accent); }
  .ho-input {
    background: var(--bg-tertiary); border: 1px solid var(--border);
    border-radius: 6px; color: var(--text-primary); padding: 7px 10px; font-size: 12px;
  }
  .ho-img-zone {
    border: 2px dashed var(--border); border-radius: 8px;
    min-height: 120px; display: flex; align-items: center; justify-content: center;
    cursor: pointer; overflow: hidden;
  }
  .ho-img-zone:hover { border-color: var(--accent); }
  .ho-img-hint { color: var(--text-muted); font-size: 12px; }
  .ho-preview { max-width: 100%; max-height: 180px; border-radius: 6px; }
  .ho-textarea {
    background: var(--bg-tertiary); border: 1px solid var(--border);
    border-radius: 6px; color: var(--text-primary); padding: 8px;
    font-size: 12px; resize: vertical; font-family: inherit;
  }
  .ho-sent { font-size: 12px; color: #22c55e; text-align: center; }
  .ho-actions { display: flex; gap: 8px; }
  .ho-btn { flex: 1; padding: 9px; border-radius: 7px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; }
  .ho-pri { background: var(--accent, #e5a853); color: #000; }
  .ho-pri:disabled { opacity: 0.4; cursor: not-allowed; }
  .ho-sec { background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-muted); }
  .ho-sec:hover { border-color: var(--accent); color: var(--accent); }
</style>
