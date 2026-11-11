<script lang="ts">
  import { onMount } from 'svelte';
  import { getCurrentVersion, openUrl } from '$lib/api';
  import { RELEASE_NOTES } from '$lib/releaseNotes';

  // Affichée une seule fois après une mise à jour de Grimoire (pas au tout premier lancement).
  const SEEN_KEY = 'grimoire_last_seen_version';

  let open = $state(false);
  let version = $state('');

  const notes = $derived(RELEASE_NOTES.find(n => n.version === version) ?? null);

  onMount(async () => {
    try {
      version = await getCurrentVersion();
      const seen = localStorage.getItem(SEEN_KEY);
      localStorage.setItem(SEEN_KEY, version);
      if (seen && seen !== version && RELEASE_NOTES.some(n => n.version === version)) {
        open = true;
      }
    } catch {
      // localStorage indisponible : on n'affiche rien
    }
  });

  function close() {
    open = false;
  }
</script>

{#if open && notes}
  <div class="wn-backdrop" role="presentation" onclick={close}>
    <div
      class="wn-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wn-title"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => { if (e.key === 'Escape') close(); }}
    >
      <div class="wn-badge">NOUVEAU — v{version}</div>
      <h2 id="wn-title" class="wn-title">{notes.title}</h2>
      <ul class="wn-list">
        {#each notes.items as item}
          <li>
            <span class="wn-icon">{item.icon}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </div>
          </li>
        {/each}
      </ul>
      {#if notes.warning}
        <p class="wn-warning">⚠️ {notes.warning}</p>
      {/if}
      <div class="wn-actions">
        <button type="button" class="wn-btn-secondary" onclick={() => openUrl('https://lordmadtrix.github.io/grimoire/tutorial.html#mobile')}>📖 Lire le guide</button>
        <button type="button" class="wn-btn-primary" onclick={close}>C'est parti !</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .wn-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9500;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(3px);
  }
  .wn-modal {
    width: 100%;
    max-width: 560px;
    max-height: 85vh;
    overflow-y: auto;
    background: var(--bg-secondary, #111418);
    border: 1px solid var(--accent, #e5a853);
    border-radius: 14px;
    padding: 22px 24px;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
    outline: none;
  }
  .wn-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    background: linear-gradient(90deg, #f59e0b, #facc15);
    color: #000;
    font-size: 11px;
    font-weight: 800;
  }
  .wn-title {
    margin: 10px 0 14px;
    font-size: 1.25rem;
    color: var(--accent, #e5a853);
  }
  .wn-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .wn-list li {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }
  .wn-icon {
    font-size: 1.4rem;
    line-height: 1;
  }
  .wn-list strong {
    color: var(--text-primary, #e2e8f0);
    font-size: 0.9rem;
  }
  .wn-list p {
    margin: 2px 0 0;
    color: var(--text-muted, #94a3b8);
    font-size: 0.8rem;
    line-height: 1.45;
  }
  .wn-warning {
    margin: 16px 0 0;
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fcd34d;
    font-size: 0.78rem;
    line-height: 1.45;
  }
  .wn-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 18px;
  }
  .wn-btn-primary,
  .wn-btn-secondary {
    padding: 8px 14px;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .wn-btn-primary {
    background: var(--accent, #e5a853);
    border: none;
    color: #000;
  }
  .wn-btn-secondary {
    background: transparent;
    border: 1px solid var(--border, #1e293b);
    color: var(--text-primary, #e2e8f0);
  }
</style>
