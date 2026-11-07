<script lang="ts">
  import { onMount } from 'svelte';
  import { getVaultPath, getVaultTree, getActiveFile, setActiveFile } from '$lib/stores/vault.svelte';
  import { readFile, type VaultEntry } from '$lib/api';
  import { addGmToken, vttStore } from '$lib/stores/vtt.svelte';
  import { slide } from 'svelte/transition';

  let isOpen = $state(false);
  let selectedFilePath = $state<string>('');
  let noteContent = $state<string>('');
  let searchQuery = $state<string>('');
  let isLoading = $state(false);
  let statusNotice = $state<string | null>(null);

  function getAllMarkdownFiles(entries: VaultEntry[], parent = ''): { path: string; name: string }[] {
    let list: { path: string; name: string }[] = [];
    for (const e of entries) {
      if (e.is_dir && e.children) {
        list = [...list, ...getAllMarkdownFiles(e.children, parent + e.name + '/')];
      } else if (e.name.toLowerCase().endsWith('.md')) {
        list.push({ path: parent + e.name, name: e.name.replace(/\.md$/i, '') });
      }
    }
    return list;
  }

  const allNotes = $derived.by(() => {
    return getAllMarkdownFiles(getVaultTree());
  });

  const filteredNotes = $derived.by(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allNotes;
    return allNotes.filter(n => n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q));
  });

  async function loadNote(path: string) {
    selectedFilePath = path;
    const vp = getVaultPath();
    if (!vp || !path) {
      noteContent = '';
      return;
    }
    isLoading = true;
    try {
      const text = await readFile(vp, path);
      noteContent = text;
    } catch (e) {
      noteContent = 'Erreur lors du chargement de la note : ' + e;
    } finally {
      isLoading = false;
    }
  }

  // Initialisation sur le fichier actif
  onMount(() => {
    const cur = getActiveFile();
    if (cur && cur.toLowerCase().endsWith('.md')) {
      loadNote(cur);
    } else if (allNotes.length > 0) {
      loadNote(allNotes[0].path);
    }
  });

  function parseMonsterAndSpawn() {
    if (!noteContent) return;

    // Détection heuristique de PV, CA et Nom
    let name = selectedFilePath.split('/').pop()?.replace(/\.md$/i, '') || 'Créature';
    let hp = 10;
    let maxHp = 10;
    let ac = 10;
    let isEnemy = true;

    // Recherche de patterns statistiques dans le markdown
    const hpMatch = noteContent.match(/(?:pv|points de vie|hp|blessures?)\s*[:=]?\s*(\d+)(?:\/(\d+))?/i);
    if (hpMatch) {
      hp = parseInt(hpMatch[1]) || 10;
      maxHp = hpMatch[2] ? parseInt(hpMatch[2]) : hp;
    }

    const acMatch = noteContent.match(/(?:ca|armure|ac)\s*[:=]?\s*(\d+)/i);
    if (acMatch) {
      ac = parseInt(acMatch[1]) || 10;
    }

    const nameMatch = noteContent.match(/^#\s+(.+)$/m);
    if (nameMatch) {
      name = nameMatch[1].trim();
    }

    const gridSize = vttStore.gridSize || 50;
    addGmToken({
      id: 'tok_' + Math.random().toString(36).slice(2, 9),
      name,
      x: 350 + Math.floor(Math.random() * 100),
      y: 300 + Math.floor(Math.random() * 100),
      size: gridSize,
      visible: true,
      isEnemy,
      hp,
      maxHp,
      notes: `Fiche liée: ${selectedFilePath}\nCA: ${ac}`,
    });

    statusNotice = `✨ Pion « ${name} » posé sur la carte VTT ! (PV: ${hp}/${maxHp})`;
    setTimeout(() => { statusNotice = null; }, 3500);
  }

  export function toggle() {
    isOpen = !isOpen;
    if (isOpen && !noteContent) {
      const cur = getActiveFile();
      if (cur) loadNote(cur);
      else if (allNotes.length > 0) loadNote(allNotes[0].path);
    }
  }
</script>

<svelte:window onkeydown={(e) => {
  const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return;
  if (e.key === 'n' || e.key === 'N') {
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      toggle();
    }
  }
}} />

<!-- Onglet Déclencheur Flottant sur le bord droit -->
<button 
  class="gm-drawer-toggle-btn"
  class:is-active={isOpen}
  onclick={toggle}
  title="Fiches & Notes de Scénario MJ (Raccourci: N)"
>
  <span class="btn-icon">📖</span>
  <span class="btn-text">Notes MJ</span>
</button>

<!-- Panneau Tiroir Flottant -->
{#if isOpen}
  <div class="gm-notes-drawer" transition:slide={{ axis: 'x', duration: 180 }}>
    <!-- Header -->
    <div class="drawer-header">
      <div class="header-title">
        <span class="icon">📜</span>
        <div>
          <h3>Notes de Scénario & Fiches MJ</h3>
          <span class="sub">Accès direct sans quitter la carte VTT</span>
        </div>
      </div>
      <button class="btn-close-sm" onclick={() => isOpen = false} title="Fermer">✕</button>
    </div>

    <!-- Sélecteur de Note & Recherche -->
    <div class="drawer-controls">
      <input 
        type="text" 
        bind:value={searchQuery}
        placeholder="🔍 Filtrer les fiches (.md)..." 
        class="search-inp"
      />
      <select 
        value={selectedFilePath} 
        onchange={(e) => loadNote((e.target as HTMLSelectElement).value)}
        class="notes-select"
      >
        {#if filteredNotes.length === 0}
          <option value="">-- Aucune fiche trouvée --</option>
        {:else}
          {#each filteredNotes as note}
            <option value={note.path}>{note.name} ({note.path})</option>
          {/each}
        {/if}
      </select>
    </div>

    <!-- Actions Rapides -->
    <div class="drawer-quick-actions">
      <button 
        class="btn-action btn-spawn"
        onclick={parseMonsterAndSpawn}
        disabled={!noteContent}
        title="Extrait automatiquement les PV, CA et Nom pour créer un Token sur la carte"
      >
        🪙 Poser en Pion VTT
      </button>
      <button 
        class="btn-action btn-open"
        onclick={() => {
          if (selectedFilePath) setActiveFile(selectedFilePath);
          vttStore.currentMap = null; // Revenir à l'éditeur
        }}
        title="Ouvrir dans l'éditeur Markdown principal"
      >
        ✏️ Éditer Plein Écran
      </button>
    </div>

    {#if statusNotice}
      <div class="status-notice">
        {statusNotice}
      </div>
    {/if}

    <!-- Contenu de la Note -->
    <div class="drawer-body">
      {#if isLoading}
        <div class="status-msg">Chargement du document...</div>
      {:else if !noteContent}
        <div class="status-msg empty">Sélectionnez une note Markdown dans la liste ci-dessus pour l'afficher ici.</div>
      {:else}
        <pre class="note-markdown-view">{noteContent}</pre>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* ── Bouton Déclencheur ────────────────────────────────────────── */
  .gm-drawer-toggle-btn {
    position: absolute;
    top: 70px;
    right: 0;
    z-index: 9200;
    background: rgba(15, 23, 42, 0.92);
    border: 1px solid rgba(229, 168, 83, 0.45);
    border-right: none;
    border-radius: 8px 0 0 8px;
    padding: 8px 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--accent, #e5a853);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: -4px 4px 15px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    transition: all 0.15s ease;
  }
  .gm-drawer-toggle-btn:hover,
  .gm-drawer-toggle-btn.is-active {
    background: rgba(30, 41, 59, 0.98);
    border-color: var(--accent, #e5a853);
    padding-left: 14px;
    box-shadow: -4px 4px 20px rgba(229, 168, 83, 0.3);
  }
  .btn-icon { font-size: 14px; }
  .btn-text { letter-spacing: 0.3px; }

  /* ── Panneau Tiroir ────────────────────────────────────────────── */
  .gm-notes-drawer {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 380px;
    max-width: 90vw;
    background: rgba(15, 23, 42, 0.96);
    border-left: 1px solid rgba(229, 168, 83, 0.4);
    box-shadow: -10px 0 35px rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(12px);
    z-index: 9300;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: rgba(0, 0, 0, 0.35);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .header-title .icon { font-size: 18px; }
  .header-title h3 {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
    color: var(--accent, #e5a853);
  }
  .header-title .sub {
    font-size: 10px;
    color: #94a3b8;
  }
  .btn-close-sm {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 14px;
    padding: 4px 6px;
    border-radius: 4px;
    transition: all 0.15s;
  }
  .btn-close-sm:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .drawer-controls {
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .search-inp, .notes-select {
    background: #020617;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 11px;
    color: #f1f5f9;
    outline: none;
    transition: border-color 0.15s;
  }
  .search-inp:focus, .notes-select:focus {
    border-color: var(--accent, #e5a853);
  }

  .drawer-quick-actions {
    display: flex;
    gap: 8px;
    padding: 8px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .btn-action {
    flex: 1;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
  }
  .btn-spawn {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
  }
  .btn-spawn:hover:not(:disabled) {
    background: linear-gradient(135deg, #34d399, #10b981);
    transform: translateY(-1px);
  }
  .btn-spawn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn-open {
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }
  .btn-open:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .status-notice {
    padding: 6px 14px;
    background: rgba(16, 185, 129, 0.15);
    border-bottom: 1px solid #10b981;
    color: #6ee7b7;
    font-size: 11px;
    font-weight: 600;
    text-align: center;
  }

  .drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 14px;
  }
  .status-msg {
    text-align: center;
    color: #94a3b8;
    font-size: 12px;
    padding: 30px 10px;
  }
  .note-markdown-view {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: inherit;
    font-size: 12px;
    line-height: 1.6;
    color: #e2e8f0;
  }
</style>
