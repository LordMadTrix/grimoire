<script lang="ts">
  import { checkForUpdates, getCurrentVersion } from '$lib/api';
  import type { UpdateManifest } from '$lib/api';
  import { openUrl } from '$lib/api';

  // Props
  let { onDismiss }: { onDismiss?: () => void } = $props();

  let update: UpdateManifest | null = $state(null);
  let currentVersion = $state('');
  let checking = $state(false);
  let error = $state('');
  let dismissed = $state(false);

  export async function runCheck() {
    checking = true;
    error = '';
    try {
      currentVersion = await getCurrentVersion();
      update = await checkForUpdates();
    } catch (e: any) {
      error = String(e);
    } finally {
      checking = false;
    }
  }

  function dismiss() {
    dismissed = true;
    onDismiss?.();
  }

  function download() {
    if (update?.download_url) {
      openUrl(update.download_url);
    }
  }
</script>

{#if !dismissed && update && !checking}
  <div class="update-banner" role="alert">
    <div class="update-icon">🆕</div>
    <div class="update-body">
      <div class="update-title">
        Grimoire <span class="update-version">v{update.version}</span> disponible
        <span class="update-current">(actuel : v{currentVersion})</span>
      </div>
      {#if update.changelog}
        <div class="update-changelog">{update.changelog}</div>
      {/if}
    </div>
    <div class="update-actions">
      <button class="update-btn-dl" onclick={download}>
        ⬇ Télécharger
      </button>
      <button class="update-btn-dismiss" onclick={dismiss} title="Ignorer">✕</button>
    </div>
  </div>
{/if}

{#if checking}
  <div class="update-checking">
    <span class="update-spinner"></span> Vérification des mises à jour…
  </div>
{/if}

<style>
  .update-banner {
    position: fixed;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9000;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: linear-gradient(135deg, #1e3a5f, #0f2340);
    border: 1px solid #2563eb;
    border-radius: 10px;
    padding: 12px 16px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.2);
    max-width: 520px;
    animation: slideDown 0.3s ease;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .update-icon { font-size: 22px; flex-shrink: 0; margin-top: 1px; }

  .update-body { flex: 1; min-width: 0; }

  .update-title {
    font-size: 13px;
    font-weight: 600;
    color: #e2e8f0;
    margin-bottom: 4px;
  }
  .update-version { color: #60a5fa; }
  .update-current { font-weight: 400; color: #64748b; font-size: 11px; }

  .update-changelog {
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.5;
    max-height: 60px;
    overflow-y: auto;
    white-space: pre-wrap;
  }

  .update-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .update-btn-dl {
    background: #2563eb;
    border: none;
    border-radius: 6px;
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }
  .update-btn-dl:hover { background: #1d4ed8; }

  .update-btn-dismiss {
    background: transparent;
    border: 1px solid #334155;
    border-radius: 6px;
    color: #64748b;
    font-size: 13px;
    padding: 5px 8px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .update-btn-dismiss:hover { background: #1e293b; color: #e2e8f0; }

  .update-checking {
    position: fixed;
    bottom: 12px;
    right: 12px;
    z-index: 8000;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #64748b;
    background: rgba(15,23,42,0.85);
    border-radius: 6px;
    padding: 5px 10px;
  }

  .update-spinner {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 2px solid #334155;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
