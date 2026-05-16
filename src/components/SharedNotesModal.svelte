<script lang="ts">
  import { vttStore, addSharedNote, removeSharedNote } from '$lib/stores/vtt.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let title = $state('');
  let body = $state('');
  let sent = $state(false);

  function send() {
    if (!body.trim()) return;
    addSharedNote(title.trim() || 'Note MJ', body.trim());
    title = ''; body = '';
    sent = true;
    setTimeout(() => sent = false, 1500);
  }

  function fmt(ts: number) {
    return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="sn-backdrop" onclick={onclose} role="none">
  <div class="sn-modal" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true">
    <div class="sn-header">
      <span>📋 Notes Partagées</span>
      <button class="sn-close" onclick={onclose}>×</button>
    </div>

    <div class="sn-compose">
      <input class="sn-input" bind:value={title} placeholder="Titre (optionnel)" />
      <textarea class="sn-textarea" bind:value={body} placeholder="Note à envoyer à tous les joueurs…" rows="3"></textarea>
      {#if sent}<div class="sn-sent">✅ Envoyé !</div>{/if}
      <button class="sn-send" onclick={send} disabled={!body.trim()}>📤 Envoyer à tous</button>
    </div>

    {#if vttStore.sharedNotes.length > 0}
      <div class="sn-history-title">Historique</div>
      <div class="sn-history">
        {#each vttStore.sharedNotes as note (note.id)}
          <div class="sn-note">
            <div class="sn-note-header">
              <span class="sn-note-title">{note.title}</span>
              <span class="sn-note-time">{fmt(note.ts)}</span>
              <button class="sn-del" onclick={() => removeSharedNote(note.id)}>✕</button>
            </div>
            <div class="sn-note-body">{note.body}</div>
          </div>
        {/each}
      </div>
    {/if}

    <button class="sn-close-btn" onclick={onclose}>Fermer</button>
  </div>
</div>

<style>
  .sn-backdrop { position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1500;display:flex;align-items:center;justify-content:center; }
  .sn-modal { background:var(--bg-secondary,#161b22);border:1px solid var(--border,#2d3748);border-radius:12px;padding:20px;width:380px;max-width:95vw;display:flex;flex-direction:column;gap:10px;box-shadow:0 12px 40px rgba(0,0,0,.7);max-height:90vh;overflow-y:auto; }
  .sn-header { display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:700;color:#e5a853; }
  .sn-close { background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px; }
  .sn-compose { display:flex;flex-direction:column;gap:7px; }
  .sn-input,.sn-textarea { background:var(--bg-tertiary,#1c2233);border:1px solid var(--border);border-radius:6px;color:var(--text-primary,#c9d1d9);padding:7px 10px;font-size:12px;font-family:inherit; }
  .sn-textarea { resize:vertical; }
  .sn-sent { color:#22c55e;font-size:12px;text-align:center; }
  .sn-send { background:#3b82f6;color:#fff;border:none;border-radius:7px;padding:9px;font-size:13px;font-weight:700;cursor:pointer; }
  .sn-send:disabled { opacity:.4;cursor:not-allowed; }
  .sn-history-title { font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.07em; }
  .sn-history { display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto; }
  .sn-note { background:var(--bg-tertiary);border:1px solid var(--border);border-radius:7px;padding:8px 10px; }
  .sn-note-header { display:flex;align-items:center;gap:6px;margin-bottom:3px; }
  .sn-note-title { font-weight:700;font-size:12px;color:var(--accent,#e5a853);flex:1; }
  .sn-note-time { font-size:10px;color:var(--text-muted); }
  .sn-del { background:none;border:none;color:#4a5568;cursor:pointer;font-size:11px; }
  .sn-del:hover { color:#ef4444; }
  .sn-note-body { font-size:12px;color:var(--text-primary);line-height:1.5; }
  .sn-close-btn { background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-muted);border-radius:7px;padding:8px;font-size:13px;font-weight:700;cursor:pointer; }
</style>
