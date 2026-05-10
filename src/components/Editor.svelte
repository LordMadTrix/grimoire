<script lang="ts">
  import { writeFile, readFile, getBacklinks, reindex } from '$lib/api';
  import type { BacklinkResult } from '$lib/api';
  import {
    getVaultPath, getActiveFile, getActiveContent,
    setActiveFile, setActiveContent, getIsDirty, setIsDirty
  } from '$lib/stores/vault.svelte';
  import CodeMirrorEditor from './CodeMirrorEditor.svelte';

  let saveTimeout: ReturnType<typeof setTimeout>;
  let backlinks = $state<BacklinkResult[]>([]);
  let showBacklinks = $state(false);

  async function saveFile(triggerReindex = false) {
    const vaultPath = getVaultPath();
    const activeFile = getActiveFile();
    const content = getActiveContent();
    if (!vaultPath || !activeFile) return;
    try {
      await writeFile(vaultPath, activeFile, content);
      setIsDirty(false);
      // Reindex seulement sur sauvegarde explicite (Ctrl+S), pas auto-save
      if (triggerReindex) reindex(vaultPath).catch(() => {});
    } catch (err) {
      console.error('Failed to save:', err);
    }
  }

  $effect(() => {
    const file = getActiveFile();
    if (!file) { backlinks = []; return; }
    getBacklinks(file).then(r => { backlinks = r; }).catch(() => { backlinks = []; });
  });

  async function openBacklink(result: BacklinkResult) {
    const vaultPath = getVaultPath();
    if (!vaultPath) return;
    try {
      const content = await readFile(vaultPath, result.source_path);
      setActiveFile(result.source_path);
      setActiveContent(content);
      setIsDirty(false);
    } catch {}
  }
</script>

<div class="editor-container">
  {#if getActiveFile()}
    <div class="editor-header">
      <div class="file-path">
        <span class="file-icon">📝</span>
        <span>{getActiveFile()}</span>
        {#if getIsDirty()}
          <span class="unsaved-dot" title="Non sauvegardé">●</span>
        {/if}
      </div>
      <div class="editor-actions">
        <button
          class="save-btn backlinks-btn"
          class:active={showBacklinks}
          onclick={() => showBacklinks = !showBacklinks}
          title="Rétroliens ({backlinks.length})"
        >
          🔗 {backlinks.length}
        </button>
        <button onclick={() => document.dispatchEvent(new CustomEvent('trigger-ai'))} class="save-btn ai-btn" title="Générer avec l'IA (Ctrl+J)">
          🪄 Ollama
        </button>
        <button onclick={() => { clearTimeout(saveTimeout); saveFile(true); }} class="save-btn" title="Sauvegarder (Ctrl+S)">
          💾
        </button>
      </div>
    </div>

    <div class="editor-wrapper">
      <CodeMirrorEditor
        value={getActiveContent()}
        onInput={(val) => {
          setActiveContent(val);
          setIsDirty(true);
          clearTimeout(saveTimeout);
          saveTimeout = setTimeout(saveFile, 1500);
        }}
        onSave={() => {
          clearTimeout(saveTimeout);
          saveFile(true);
        }}
      />
    </div>

    {#if showBacklinks}
      <div class="backlinks-panel">
        <div class="backlinks-header">
          <span>🔗 Rétroliens</span>
          <span class="backlinks-count">{backlinks.length} fichier{backlinks.length !== 1 ? 's' : ''}</span>
        </div>
        {#if backlinks.length === 0}
          <div class="backlinks-empty">Aucun fichier ne pointe vers celui-ci.</div>
        {:else}
          <ul class="backlinks-list">
            {#each backlinks as bl}
              <li>
                <button class="backlink-item" onclick={() => openBacklink(bl)}>
                  <span class="backlink-title">📝 {bl.source_title || bl.source_path}</span>
                  {#if bl.context}
                    <span class="backlink-context">…{bl.context}…</span>
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  {:else}
    <div class="empty-state">
      <div class="empty-icon">📜</div>
      <h2>Grimoire</h2>
      <p>Sélectionnez un fichier dans la barre latérale</p>
      <p class="hint">Clic droit → Nouveau fichier</p>
      <div class="shortcuts">
        <div class="shortcut"><kbd>Ctrl</kbd>+<kbd>N</kbd> Nouveau fichier</div>
        <div class="shortcut"><kbd>Ctrl</kbd>+<kbd>P</kbd> Rechercher</div>
        <div class="shortcut"><kbd>Ctrl</kbd>+<kbd>S</kbd> Sauvegarder</div>
        <div class="shortcut"><kbd>Ctrl</kbd>+<kbd>J</kbd> Générer avec Ollama</div>
        <div class="shortcut"><kbd>Ctrl</kbd>+<kbd>Clic</kbd> Suivre un lien wiki</div>
      </div>
    </div>
  {/if}
</div>

<style>
  .editor-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
  }

  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    min-height: 40px;
    flex-shrink: 0;
  }

  .file-path {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-secondary);
    overflow: hidden;
  }

  .file-icon { font-size: 16px; flex-shrink: 0; }

  .unsaved-dot {
    color: var(--accent);
    font-size: 18px;
    line-height: 1;
  }

  .editor-actions { display: flex; gap: 6px; flex-shrink: 0; }

  .save-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-secondary);
    transition: all 0.15s;
    white-space: nowrap;
  }
  .save-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

  .backlinks-btn.active {
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);
  }

  .editor-wrapper { flex: 1; min-height: 0; overflow: hidden; }

  /* ── Backlinks panel ───────────────────────────────────────── */

  .backlinks-panel {
    flex-shrink: 0;
    max-height: 220px;
    overflow-y: auto;
    border-top: 1px solid var(--border);
    background: var(--bg-secondary);
  }

  .backlinks-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border-subtle, var(--border));
    position: sticky;
    top: 0;
    background: var(--bg-secondary);
  }

  .backlinks-count {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 400;
  }

  .backlinks-empty {
    padding: 16px;
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
  }

  .backlinks-list {
    list-style: none;
    margin: 0;
    padding: 4px;
  }

  .backlink-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 7px 12px;
    background: transparent;
    border: none;
    border-radius: 5px;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
  }
  .backlink-item:hover { background: var(--bg-hover); }

  .backlink-title {
    font-size: 13px;
    color: var(--text-primary);
    font-weight: 500;
  }

  .backlink-context {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Empty state ───────────────────────────────────────────── */

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    gap: 8px;
  }

  .empty-icon { font-size: 64px; opacity: 0.3; }

  .empty-state h2 {
    font-size: 28px;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 0;
  }

  .empty-state p { margin: 0; font-size: 14px; }
  .hint { font-size: 12px; color: var(--text-muted); opacity: 0.7; }

  .shortcuts {
    margin-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .shortcut { font-size: 12px; color: var(--text-muted); }

  kbd {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 11px;
    font-family: inherit;
  }
</style>
