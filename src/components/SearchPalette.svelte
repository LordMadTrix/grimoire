<script lang="ts">
  import { searchVault, readFile } from '$lib/api';
  import {
    getVaultPath, getSearchOpen, setSearchOpen,
    setActiveFile, setActiveContent, setIsDirty
  } from '$lib/stores/vault.svelte';
  import type { SearchResult } from '$lib/api';

  let query = $state('');
  let results = $state<SearchResult[]>([]);
  let selectedIndex = $state(0);
  let inputEl = $state<HTMLInputElement>();
  let searchTimeout: ReturnType<typeof setTimeout>;

  $effect(() => {
    if (getSearchOpen() && inputEl) {
      setTimeout(() => inputEl?.focus(), 50);
    }
  });

  function handleInput() {
    clearTimeout(searchTimeout);
    selectedIndex = 0;

    if (query.length < 2) {
      results = [];
      return;
    }

    searchTimeout = setTimeout(async () => {
      try {
        results = await searchVault(query + '*', 15);
      } catch {
        results = [];
      }
    }, 150);
  }

  async function selectResult(result: SearchResult) {
    const vaultPath = getVaultPath();
    if (!vaultPath) return;

    if (result.path.toLowerCase().endsWith('.pdf')) {
      setActiveFile(result.path);
      close();
      return;
    }

    try {
      const content = await readFile(vaultPath, result.path);
      setActiveFile(result.path);
      setActiveContent(content);
      setIsDirty(false);
      close();
    } catch (err) {
      console.error('Failed to open:', err);
    }
  }

  function close() {
    setSearchOpen(false);
    query = '';
    results = [];
    selectedIndex = 0;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      selectResult(results[selectedIndex]);
    }
  }

  // N'autoriser que les balises <mark> du snippet FTS5 — bloquer tout autre HTML
  function sanitizeSnippet(html: string): string {
    return html.replace(/<(?!\/?mark\b)[^>]+>/gi, '');
  }

  function getTypeColor(type: string): string {
    switch (type) {
      case 'pnj': return '#e5a853';
      case 'lieu': return '#53b8e5';
      case 'faction': return '#e55353';
      case 'objet': return '#53e5a8';
      default: return '#888';
    }
  }
</script>

{#if getSearchOpen()}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onclick={close}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="palette" onclick={(e) => e.stopPropagation()}>
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input
          bind:this={inputEl}
          bind:value={query}
          oninput={handleInput}
          onkeydown={handleKeydown}
          type="text"
          placeholder="Rechercher dans le Grimoire..."
          class="search-input"
        />
        <kbd class="esc-hint">Esc</kbd>
      </div>

      {#if results.length > 0}
        <ul class="results">
          {#each results as result, i}
            <li>
              <button
                class="result-item"
                class:selected={i === selectedIndex}
                onclick={() => selectResult(result)}
                onmouseenter={() => selectedIndex = i}
              >
                <div class="result-header">
                  <span class="result-type" style="color: {getTypeColor(result.entity_type)}">
                    {result.entity_type}
                  </span>
                  <span class="result-title">{result.title}</span>
                </div>
                <div class="result-path">{result.path}</div>
                {#if result.snippet}
                  <div class="result-snippet">{@html sanitizeSnippet(result.snippet)}</div>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {:else if query.length >= 2}
        <div class="no-results">Aucun résultat pour « {query} »</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: center;
    padding-top: 15vh;
    z-index: 9999;
  }

  .palette {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 560px;
    max-height: 480px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    animation: slideDown 0.15s ease-out;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .search-input-wrapper {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    gap: 10px;
  }

  .search-icon { font-size: 18px; opacity: 0.5; }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 16px;
  }

  .esc-hint {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 10px;
    color: var(--text-muted);
    font-family: inherit;
  }

  .results {
    list-style: none;
    margin: 0;
    padding: 4px;
    overflow-y: auto;
  }

  .result-item {
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.1s;
    display: block;
  }

  .result-item.selected,
  .result-item:hover {
    background: var(--bg-hover);
  }

  .result-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
  }

  .result-type {
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .result-title {
    font-size: 14px;
    color: var(--text-primary);
    font-weight: 600;
  }

  .result-path {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .result-snippet {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .result-snippet :global(mark) {
    background: var(--accent-bg);
    color: var(--accent);
    border-radius: 2px;
    padding: 0 2px;
  }

  .no-results {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
  }
</style>
