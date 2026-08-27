<script module lang="ts">
  import type { VaultEntry } from '$lib/api';
  let ctxMenu = $state<{ entry: VaultEntry; x: number; y: number } | null>(null);
  let hoverPreview = $state<{ entry: VaultEntry; imgUrl: string; isMap: boolean; x: number; y: number } | null>(null);
  let templateMenu = $state<{ dir: string; x: number; y: number } | null>(null);
  let previewHideTimer: ReturnType<typeof setTimeout> | null = null;
  let filterText = $state('');
  let showRecents = $state(true);
  let activeTag = $state('');
</script>

<script lang="ts">
  import Sidebar from './Sidebar.svelte';
  import { readFile, writeFile, createDirectory, deleteFile, renameEntry, openVault, readFileBase64, askOllama } from '$lib/api';
  import {
    getVaultPath, getActiveFile, setActiveFile,
    setActiveContent, setIsDirty,
    getExpandedDirs, toggleDir, setVaultTree, collapseAllDirs,
    getRecentFiles, clearRecentFiles,
    getStarredFiles, isStarred, toggleStarred,
    getVaultStats, getAllTags, getFilesByTag
  } from '$lib/stores/vault.svelte';
  import { getAiModel, getAiSystemPrompt } from '$lib/stores/settings.svelte';
  import { setGmCurrentMap } from '$lib/stores/vtt.svelte';
  import PdfReaderModal from './PdfReaderModal.svelte';
  import CampaignBackupModal from './CampaignBackupModal.svelte';
  let { entries = [], depth = 0 }: { entries: VaultEntry[]; depth?: number } = $props();

  const ASSET_DIRS = new Set(['assets', 'maps', 'tokens', 'audio', 'books', 'pdf', 'livres']);
  const HIDDEN_DIRS = new Set(['.grimoire', '.git', 'node_modules']);
  const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);

  let activePdfModal = $state<{ localPath: string; name: string } | null>(null);
  let showBackupModal = $state(false);

  // Flat search résultats (depth 0 uniquement)
  let filteredFiles = $derived((() => {
    if (depth !== 0) return null;
    if (!filterText.trim() && !activeTag) return null;

    const q = filterText.toLowerCase();
    const taggedPaths = activeTag ? new Set(getFilesByTag(activeTag)) : null;

    const result: (VaultEntry & { fullPath: string })[] = [];
    function walk(es: VaultEntry[], parent = '') {
      for (const e of es) {
        if (HIDDEN_DIRS.has(e.name)) continue;
        const fp = parent ? `${parent}/${e.name}` : e.name;
        if (!e.is_dir) {
          const nameMatch = !q || e.name.toLowerCase().includes(q);
          const tagMatch = !taggedPaths || taggedPaths.has(fp);
          if (nameMatch && tagMatch) result.push({ ...e, path: fp, fullPath: fp });
        }
        if (e.is_dir && e.children) walk(e.children, fp);
      }
    }
    walk(entries);
    return result.slice(0, 40);
  })());

  let availableTags = $derived(depth === 0 ? getAllTags() : []);

  let vaultStats = $derived(depth === 0 ? getVaultStats() : null);

  const TEMPLATES = [
    { label: '👤 PNJ',      content: (n: string) => `---\ntype: pnj\n---\n# ${n}\n\n## Description\n\n## Personnalité\n\n## Objectifs\n\n## Secrets\n` },
    { label: '🏰 Lieu',     content: (n: string) => `---\ntype: lieu\n---\n# ${n}\n\n## Ambiance\n\n## Description\n\n## PNJ présents\n\n## Secrets\n` },
    { label: '⚔️ Scène',    content: (n: string) => `---\ntype: scene\n---\n# ${n}\n\n## Résumé\n\n## Déclencheur\n\n## Déroulement\n\n## Conséquences\n` },
    { label: '⚜️ Faction',  content: (n: string) => `---\ntype: faction\n---\n# ${n}\n\n## Description\n\n## Objectifs\n\n## Membres clés\n` },
    { label: '🐉 Créature', content: (n: string) => `---\ntype: creature\n---\n# ${n}\n\n**CA :** — | **PV :** — | **Init :** —\n\n## Capacités\n\n## Description\n` },
    { label: '📅 Session',  content: (n: string) => `---\ntype: session\ndate: ${new Date().toISOString().split('T')[0]}\n---\n# ${n}\n\n## Résumé\n\n## Événements\n\n## PNJ rencontrés\n\n## À faire\n` },
  ];

  function sortEntries(list: VaultEntry[]) {
    return [...list].sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }

  // Exclure les dossiers cachés à tous les niveaux
  let visibleEntries = $derived(entries.filter(e => !HIDDEN_DIRS.has(e.name)));

  let pinnedEntries = $derived(
    depth === 0
      ? sortEntries(visibleEntries.filter(e => e.is_dir && ASSET_DIRS.has(e.name.toLowerCase())))
      : []
  );
  let restEntries = $derived(
    depth === 0
      ? sortEntries(visibleEntries.filter(e => !(e.is_dir && ASSET_DIRS.has(e.name.toLowerCase()))))
      : sortEntries(visibleEntries)
  );

  function isImage(entry: VaultEntry): boolean {
    return !entry.is_dir && IMAGE_EXTS.has(entry.extension?.toLowerCase() ?? '');
  }

  async function handleImageMouseEnter(e: MouseEvent, entry: VaultEntry) {
    if (!isImage(entry)) return;
    const vp = getVaultPath();
    if (!vp) return;
    if (previewHideTimer) { clearTimeout(previewHideTimer); previewHideTimer = null; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    hoverPreview = { entry, imgUrl: '', isMap: entry.path.startsWith('assets/maps/'), x: rect.right + 10, y: rect.top };
    try {
      const b64 = await readFileBase64(`${vp}/${entry.path}`);
      const ext = entry.extension?.toLowerCase() ?? 'png';
      const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`;
      if (hoverPreview?.entry.path === entry.path)
        hoverPreview = { ...hoverPreview, imgUrl: `data:${mime};base64,${b64}` };
    } catch { /* silently ignore */ }
  }

  function scheduleHidePreview() {
    previewHideTimer = setTimeout(() => { hoverPreview = null; }, 200);
  }

  function cancelHidePreview() {
    if (previewHideTimer) { clearTimeout(previewHideTimer); previewHideTimer = null; }
  }

  async function loadAsMap(entry: VaultEntry) {
    const vp = getVaultPath();
    if (!vp) return;
    try {
      const b64 = await readFileBase64(`${vp}/${entry.path}`);
      const ext = entry.extension?.toLowerCase() ?? 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      setGmCurrentMap(`data:${mime};base64,${b64}`);
      hoverPreview = null;
    } catch (err) {
      console.error('Failed to load map:', err);
    }
  }

  async function handleFileClick(entry: VaultEntry) {
    if (entry.is_dir) { toggleDir(entry.path); return; }
    if (isImage(entry) && entry.path.startsWith('assets/maps/')) {
      await loadAsMap(entry);
      return;
    }
    if (entry.extension?.toLowerCase() === 'pdf') {
      const vp = getVaultPath();
      if (!vp) return;
      activePdfModal = {
        localPath: `${vp}/${entry.path}`,
        name: entry.name
      };
      return;
    }
    if (entry.extension !== 'md') return;
    const vaultPath = getVaultPath();
    if (!vaultPath) return;
    try {
      const content = await readFile(vaultPath, entry.path);
      setActiveFile(entry.path);
      setActiveContent(content);
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  }

  function getIcon(entry: VaultEntry): string {
    if (entry.is_dir) {
      if (entry.name === '_templates') return '📋';
      if (entry.name.toLowerCase() === 'books' || entry.name.toLowerCase() === 'pdf' || entry.name.toLowerCase() === 'livres') return '📚';
      return getExpandedDirs().has(entry.path) ? '📂' : '📁';
    }
    const ext = entry.extension?.toLowerCase();
    switch (ext) {
      case 'md': return '📝';
      case 'pdf': return '📚';
      case 'json': return '⚙️';
      case 'png': case 'jpg': case 'jpeg': case 'webp': case 'avif': return '🖼️';
      case 'mp3': case 'ogg': case 'wav': return '🔊';
      default: return '📄';
    }
  }

  function handleContextMenu(e: MouseEvent, entry: VaultEntry) {
    e.preventDefault();
    e.stopPropagation();
    ctxMenu = { entry, x: e.clientX, y: e.clientY };
  }

  function getParentDir(path: string): string {
    const parts = path.split('/');
    return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
  }

  async function refreshTree() {
    const vp = getVaultPath();
    if (!vp) return;
    const tree = await openVault(vp);
    setVaultTree(tree);
  }

  async function ctxNewFile() {
    if (!ctxMenu) return;
    const dir = ctxMenu.entry.is_dir ? ctxMenu.entry.path : getParentDir(ctxMenu.entry.path);
    const name = window.prompt('Nom du fichier (sans extension) :');
    ctxMenu = null;
    if (!name?.trim()) return;
    const relPath = dir ? `${dir}/${name.trim()}.md` : `${name.trim()}.md`;
    const vp = getVaultPath();
    if (!vp) return;
    const initialContent = `# ${name.trim()}\n\n`;
    try {
      await writeFile(vp, relPath, initialContent);
      await refreshTree();
      setActiveFile(relPath);
      setActiveContent(initialContent);
      setIsDirty(false);
    } catch (err) { console.error('Failed to create file:', err); }
  }

  function ctxFromTemplate() {
    if (!ctxMenu) return;
    const dir = ctxMenu.entry.is_dir ? ctxMenu.entry.path : getParentDir(ctxMenu.entry.path);
    const { x, y } = ctxMenu;
    ctxMenu = null;
    templateMenu = { dir, x: x + 190, y };
  }

  async function createFromTemplate(tpl: typeof TEMPLATES[0], withAI = false) {
    if (!templateMenu) return;
    const dir = templateMenu.dir;
    templateMenu = null;
    const name = window.prompt(`Nom (${tpl.label}) :`);
    if (!name?.trim()) return;
    const relPath = dir ? `${dir}/${name.trim()}.md` : `${name.trim()}.md`;
    const vp = getVaultPath();
    if (!vp) return;
    const baseContent = tpl.content(name.trim());
    try {
      await writeFile(vp, relPath, baseContent);
      await refreshTree();
      setActiveFile(relPath);
      setActiveContent(baseContent);
      setIsDirty(false);

      if (withAI) {
        const aiPrompt = `Tu es assistant Maître du Jeu TTRPG. Complète ce document de façon créative et détaillée en remplissant chaque section :\n\n${baseContent}`;
        try {
          const generated = await askOllama(aiPrompt, getAiModel(), getAiSystemPrompt());
          const enriched = baseContent + '\n\n---\n*Généré par IA :*\n\n' + generated.trim();
          await writeFile(vp, relPath, enriched);
          setActiveContent(enriched);
          setIsDirty(false);
        } catch (err) {
          console.error('AI generation failed:', err);
        }
      }
    } catch (err) { console.error('Failed to create from template:', err); }
  }

  async function ctxNewFolder() {
    if (!ctxMenu) return;
    const dir = ctxMenu.entry.is_dir ? ctxMenu.entry.path : getParentDir(ctxMenu.entry.path);
    const name = window.prompt('Nom du dossier :');
    ctxMenu = null;
    if (!name?.trim()) return;
    const relPath = dir ? `${dir}/${name.trim()}` : name.trim();
    const vp = getVaultPath();
    if (!vp) return;
    try {
      await createDirectory(vp, relPath);
      await refreshTree();
    } catch (err) { console.error('Failed to create folder:', err); }
  }

  async function ctxRename() {
    if (!ctxMenu) return;
    const entry = ctxMenu.entry;
    const parts = entry.path.split('/');
    const oldName = parts[parts.length - 1];
    const newName = window.prompt('Nouveau nom :', oldName);
    ctxMenu = null;
    if (!newName?.trim() || newName.trim() === oldName) return;
    const dir = getParentDir(entry.path);
    const newPath = dir ? `${dir}/${newName.trim()}` : newName.trim();
    const vp = getVaultPath();
    if (!vp) return;
    try {
      await renameEntry(vp, entry.path, newPath);
      const active = getActiveFile();
      if (active === entry.path) {
        setActiveFile(newPath);
      } else if (active && active.startsWith(entry.path + '/')) {
        // La note active est dans le dossier renommé : re-pointer son chemin,
        // sinon la prochaine sauvegarde recréerait l'ancien dossier
        setActiveFile(newPath + active.slice(entry.path.length));
      }
      await refreshTree();
    } catch (err) { console.error('Failed to rename:', err); }
  }

  function ctxToggleStar() {
    if (!ctxMenu) return;
    const path = ctxMenu.entry.path;
    ctxMenu = null;
    toggleStarred(path);
  }

  async function ctxDelete() {
    if (!ctxMenu) return;
    const entry = ctxMenu.entry;
    ctxMenu = null;
    if (!window.confirm(`Supprimer "${entry.name}" ? Cette action est irréversible.`)) return;
    const vp = getVaultPath();
    if (!vp) return;
    try {
      await deleteFile(vp, entry.path);
      const active = getActiveFile();
      // Couvre aussi la suppression d'un dossier contenant la note active,
      // sinon la prochaine sauvegarde ressusciterait le fichier supprimé
      if (active === entry.path || (active && active.startsWith(entry.path + '/'))) {
        setActiveFile(null);
        setActiveContent('');
        setIsDirty(false);
      }
      await refreshTree();
    } catch (err) { console.error('Failed to delete:', err); }
  }
</script>

{#if depth === 0}
  <!-- Barre de filtre rapide -->
  <div class="filter-bar">
    <span class="filter-icon">🔍</span>
    <input
      type="text"
      class="filter-input"
      placeholder="Filtrer les fichiers…"
      bind:value={filterText}
    />
    {#if filterText || activeTag}
      <button class="filter-clear" onclick={() => { filterText = ''; activeTag = ''; }}>✕</button>
    {:else}
      <button class="filter-collapse" onclick={collapseAllDirs} title="Tout replier">⊟</button>
      <button class="filter-backup" onclick={() => showBackupModal = true} title="Sauvegarder / Exporter la campagne (.grimoire)">📦</button>
    {/if}
  </div>
  {#if availableTags.length > 0}
    <div class="tag-bar">
      {#each availableTags as tag}
        <button
          class="tag-chip"
          class:active={activeTag === tag}
          onclick={() => activeTag = activeTag === tag ? '' : tag}
        >
          #{tag}
        </button>
      {/each}
    </div>
  {/if}
{/if}

{#if depth === 0 && filteredFiles !== null}
  <!-- Mode filtrage : liste plate des résultats -->
  <ul class="vault-tree" style="--depth: 0">
    {#if filteredFiles.length === 0}
      <li class="section-empty">Aucun fichier trouvé</li>
    {:else}
      {#each filteredFiles as entry}
        <li>
          <button
            class="tree-item"
            class:active={getActiveFile() === entry.path}
            onclick={() => handleFileClick(entry)}
            oncontextmenu={(e) => handleContextMenu(e, entry)}
            onmouseenter={(e) => handleImageMouseEnter(e, entry)}
            onmouseleave={scheduleHidePreview}
            title={entry.path}
          >
            <span class="icon">{getIcon(entry)}</span>
            <span class="name">{entry.name}</span>
            <span class="filter-path">{entry.path.split('/').slice(0, -1).join('/')}</span>
          </button>
        </li>
      {/each}
    {/if}
  </ul>
{:else}
  <ul class="vault-tree" style="--depth: {depth}">
    {#if depth === 0}
      <!-- ── Favoris ── -->
      {@const starred = getStarredFiles().filter(p => {
        function find(es: typeof entries): boolean {
          return es.some(e => e.path === p || (e.is_dir && e.children ? find(e.children) : false));
        }
        return find(entries);
      })}
      {#if starred.length > 0}
        <li class="section-label">⭐ FAVORIS</li>
        {#each starred as path}
          {@const name = path.split('/').pop() ?? path}
          <li>
            <button
              class="tree-item"
              class:active={getActiveFile() === path}
              onclick={async () => {
                const vp = getVaultPath(); if (!vp) return;
                try { const c = await readFile(vp, path); setActiveFile(path); setActiveContent(c); setIsDirty(false); } catch {}
              }}
              oncontextmenu={(e) => { e.preventDefault(); ctxMenu = { entry: { name, path, is_dir: false, extension: path.split('.').pop() }, x: e.clientX, y: e.clientY }; }}
              title={path}
            >
              <span class="icon">⭐</span>
              <span class="name">{name.replace(/\.md$/, '')}</span>
            </button>
          </li>
        {/each}
        <li class="section-sep"></li>
      {/if}

      <!-- ── Récents ── -->
      {@const recents = getRecentFiles().filter(p => p !== getActiveFile()).slice(0, 5)}
      {#if recents.length > 0}
        <li class="section-label-btn">
          <span>🕐 RÉCENTS</span>
          <button class="section-action" onclick={() => showRecents = !showRecents}>{showRecents ? '▾' : '▸'}</button>
          <button class="section-action" onclick={clearRecentFiles} title="Effacer">✕</button>
        </li>
        {#if showRecents}
          {#each recents as path}
            {@const name = path.split('/').pop() ?? path}
            <li>
              <button
                class="tree-item recent-item"
                class:active={getActiveFile() === path}
                onclick={async () => {
                  const vp = getVaultPath(); if (!vp) return;
                  try { const c = await readFile(vp, path); setActiveFile(path); setActiveContent(c); setIsDirty(false); } catch {}
                }}
                title={path}
              >
                <span class="icon">📄</span>
                <span class="name">{name.replace(/\.md$/, '')}</span>
                <span class="recent-path">{path.split('/').slice(0, -1).join('/') || '/'}</span>
              </button>
            </li>
          {/each}
          <li class="section-sep"></li>
        {/if}
      {/if}

      <!-- ── Assets ── -->
      {#if pinnedEntries.length > 0}
        <li class="section-label">ASSETS</li>
        {#each pinnedEntries as entry}
          {@const isExpanded = getExpandedDirs().has(entry.path)}
          <li>
            <button
              class="tree-item directory asset-pinned"
              onclick={() => handleFileClick(entry)}
              oncontextmenu={(e) => handleContextMenu(e, entry)}
              title={entry.path}
            >
              <span class="icon">{getIcon(entry)}</span>
              <span class="name">{entry.name}</span>
              {#if entry.children}
                <span class="badge">{entry.children.length}</span>
              {/if}
            </button>
            {#if isExpanded && entry.children}
              <Sidebar entries={entry.children} depth={depth + 1} />
            {/if}
          </li>
        {/each}
        {#if restEntries.length > 0}
          <li class="section-sep"></li>
          <li class="section-label">NOTES</li>
        {/if}
      {/if}
    {/if}

    {#each restEntries as entry}
      {@const isActive = getActiveFile() === entry.path}
      {@const isExpanded = entry.is_dir && getExpandedDirs().has(entry.path)}
      {@const starred = !entry.is_dir && isStarred(entry.path)}
      <li>
        <button
          class="tree-item"
          class:active={isActive}
          class:directory={entry.is_dir}
          class:book-pdf={entry.extension?.toLowerCase() === 'pdf'}
          class:non-editable={!entry.is_dir && entry.extension !== 'md' && entry.extension?.toLowerCase() !== 'pdf' && !isImage(entry)}
          class:map-image={isImage(entry) && entry.path.startsWith('assets/maps/')}
          class:draggable-token={isImage(entry)}
          draggable={isImage(entry)}
          ondragstart={(e) => { if (isImage(entry) && e.dataTransfer) { e.dataTransfer.setData('vtt/token-image', entry.path); e.dataTransfer.effectAllowed = 'copy'; } }}
          onclick={() => handleFileClick(entry)}
          oncontextmenu={(e) => handleContextMenu(e, entry)}
          onmouseenter={(e) => handleImageMouseEnter(e, entry)}
          onmouseleave={scheduleHidePreview}
          title={entry.path}
        >
          <span class="icon">{getIcon(entry)}</span>
          <span class="name">{entry.name}</span>
          {#if starred}<span class="star-badge">⭐</span>{/if}
          {#if entry.is_dir && entry.children}
            <span class="badge">{entry.children.length}</span>
          {/if}
        </button>

        {#if isExpanded && entry.children}
          <Sidebar entries={entry.children} depth={depth + 1} />
        {/if}
      </li>
    {/each}

    {#if depth === 0 && vaultStats}
      <li class="vault-stats">
        <span>📝 {vaultStats.noteCount} notes</span>
        <span>·</span>
        <span>🖼️ {vaultStats.assetCount} assets</span>
      </li>
    {/if}
  </ul>
{/if}

<!-- Rendu unique à la racine (depth === 0) -->
{#if depth === 0}
  <!-- Image preview tooltip -->
  {#if hoverPreview}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="img-preview"
      style="left: {Math.min(hoverPreview.x, window.innerWidth - 220)}px; top: {Math.min(hoverPreview.y, window.innerHeight - 180)}px;"
      onmouseenter={cancelHidePreview}
      onmouseleave={scheduleHidePreview}
    >
      <img src={hoverPreview.imgUrl} alt={hoverPreview.entry.name} />
      <div class="img-preview-name">{hoverPreview.entry.name}</div>
      {#if hoverPreview.isMap}
        <button class="img-preview-load" onclick={() => hoverPreview && loadAsMap(hoverPreview.entry)}>
          🗺️ Charger comme carte
        </button>
      {/if}
    </div>
  {/if}

  <!-- Context menu -->
  {#if ctxMenu}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="ctx-overlay" onclick={() => ctxMenu = null}></div>
    <div
      class="ctx-menu"
      style="left: {Math.min(ctxMenu.x, window.innerWidth - 190)}px;
             top: {Math.min(ctxMenu.y, window.innerHeight - 200)}px;"
    >
      <button class="ctx-item" onclick={ctxNewFile}>📄 Nouveau fichier</button>
      <button class="ctx-item" onclick={ctxFromTemplate}>📋 Depuis un template</button>
      <button class="ctx-item" onclick={ctxNewFolder}>📁 Nouveau dossier</button>
      <div class="ctx-sep"></div>
      {#if !ctxMenu.entry.is_dir}
        <button class="ctx-item" onclick={ctxToggleStar}>
          {isStarred(ctxMenu.entry.path) ? '⭐ Retirer des favoris' : '⭐ Ajouter aux favoris'}
        </button>
      {/if}
      <button class="ctx-item" onclick={ctxRename}>✏️ Renommer</button>
      {#if !ctxMenu.entry.is_dir}
        <div class="ctx-sep"></div>
        <button class="ctx-item danger" onclick={ctxDelete}>🗑️ Supprimer</button>
      {/if}
    </div>
  {/if}

  <!-- Template submenu -->
  {#if templateMenu}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="ctx-overlay" onclick={() => templateMenu = null}></div>
    <div
      class="ctx-menu"
      style="left: {Math.min(templateMenu.x, window.innerWidth - 190)}px;
             top: {Math.min(templateMenu.y, window.innerHeight - 240)}px;"
    >
      <div class="ctx-title">Choisir un template</div>
      {#each TEMPLATES as tpl}
        <div class="tpl-row">
          <button class="ctx-item tpl-btn" onclick={() => createFromTemplate(tpl)}>{tpl.label}</button>
          <button class="ctx-item tpl-ai" onclick={() => createFromTemplate(tpl, true)} title="Créer + générer avec l'IA">✨</button>
        </div>
      {/each}
    </div>
  {/if}

  {#if activePdfModal}
    <PdfReaderModal
      localPath={activePdfModal.localPath}
      fileName={activePdfModal.name}
      onclose={() => activePdfModal = null}
    />
  {/if}

  {#if showBackupModal}
    <CampaignBackupModal onclose={() => showBackupModal = false} />
  {/if}
{/if}

<style>
  /* ── Filtre rapide ──────────────────────────────────────────── */

  .filter-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border-subtle, var(--border));
  }

  .filter-icon { font-size: 12px; flex-shrink: 0; }

  .filter-input {
    flex: 1;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 12px;
    padding: 3px 6px;
    outline: none;
    min-width: 0;
  }
  .filter-input:focus { border-color: var(--accent); }

  .filter-clear,
  .filter-collapse,
  .filter-backup {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 4px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .filter-clear:hover,
  .filter-collapse:hover,
  .filter-backup:hover { background: var(--bg-hover); color: var(--text-primary); }

  /* ── Tags ─────────────────────────────────────────────────────── */

  .tag-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 8px 6px;
    border-bottom: 1px solid var(--border-subtle, var(--border));
  }

  .tag-chip {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 12px;
    color: var(--text-muted);
    font-size: 10px;
    padding: 2px 7px;
    cursor: pointer;
    transition: all 0.1s;
    font-weight: 500;
  }
  .tag-chip:hover { background: var(--bg-hover); color: var(--text-primary); }
  .tag-chip.active {
    background: rgba(229, 168, 83, 0.15);
    border-color: var(--accent);
    color: var(--accent);
  }

  .filter-path {
    font-size: 10px;
    color: var(--text-muted);
    margin-left: auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100px;
  }

  .section-empty {
    list-style: none;
    padding: 16px;
    text-align: center;
    font-size: 12px;
    color: var(--text-muted);
  }

  /* ── Section labels améliorés ───────────────────────────────── */

  .section-label-btn {
    list-style: none;
    display: flex;
    align-items: center;
    padding: 8px 8px 3px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    user-select: none;
    gap: 4px;
  }

  .section-label-btn span:first-child { flex: 1; }

  .section-action {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 10px;
    padding: 1px 4px;
    border-radius: 3px;
    line-height: 1;
  }
  .section-action:hover { background: var(--bg-hover); color: var(--text-primary); }

  /* ── Récents ────────────────────────────────────────────────── */

  .recent-item { opacity: 0.8; }
  .recent-item:hover { opacity: 1; }

  .recent-path {
    font-size: 10px;
    color: var(--text-muted);
    margin-left: auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 80px;
  }

  /* ── Favoris ────────────────────────────────────────────────── */

  .star-badge {
    font-size: 10px;
    margin-left: 2px;
    flex-shrink: 0;
  }

  /* ── Statistiques vault ──────────────────────────────────────── */

  .vault-stats {
    list-style: none;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    margin-top: 4px;
    border-top: 1px solid var(--border-subtle, var(--border));
    font-size: 10px;
    color: var(--text-muted);
  }

  /* ── Tree (existant) ─────────────────────────────────────────── */

  .vault-tree {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  li { margin: 0; }

  .tree-item {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 8px 4px calc(var(--depth) * 16px + 8px);
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s ease;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
  }

  .tree-item:hover { background: var(--bg-hover); color: var(--text-primary); }

  .tree-item.active {
    background: var(--accent-bg);
    color: var(--accent);
    font-weight: 600;
  }

  .tree-item.directory { color: var(--text-primary); font-weight: 500; }
  .tree-item.non-editable { opacity: 0.65; cursor: default; }

  .tree-item.map-image { cursor: pointer; }
  .tree-item.map-image:hover { color: var(--accent); }
  .tree-item.draggable-token { cursor: grab; }
  .tree-item.draggable-token:active { cursor: grabbing; }

  .tree-item.asset-pinned { color: var(--accent); }
  .tree-item.asset-pinned:hover { background: var(--accent-bg); }

  .section-label {
    list-style: none;
    padding: 10px 8px 3px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    user-select: none;
  }

  .section-sep {
    list-style: none;
    height: 1px;
    background: var(--border);
    margin: 6px 8px;
  }

  .icon { flex-shrink: 0; font-size: 14px; }
  .name { overflow: hidden; text-overflow: ellipsis; }

  .badge {
    margin-left: auto;
    font-size: 10px;
    color: var(--text-muted);
    background: var(--bg-tertiary);
    padding: 0 5px;
    border-radius: 8px;
  }

  /* ── Image preview ─────────────────────────────────────────── */

  .img-preview {
    position: fixed;
    z-index: 9500;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px;
    width: 200px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    gap: 6px;
    animation: fadeIn 0.12s ease;
  }

  .img-preview img {
    width: 100%;
    max-height: 140px;
    object-fit: cover;
    border-radius: 4px;
    display: block;
  }

  .img-preview-name {
    font-size: 11px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .img-preview-load {
    background: var(--accent);
    border: none;
    color: #000;
    font-size: 12px;
    font-weight: 600;
    padding: 5px 8px;
    border-radius: 4px;
    cursor: pointer;
    width: 100%;
    transition: opacity 0.1s;
  }

  .img-preview-load:hover { opacity: 0.85; }

  /* ── Context menu ──────────────────────────────────────────── */

  .ctx-overlay {
    position: fixed;
    inset: 0;
    z-index: 9000;
  }

  .ctx-menu {
    position: fixed;
    z-index: 9001;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 4px;
    min-width: 180px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    animation: fadeIn 0.1s ease;
  }

  .ctx-title {
    padding: 5px 12px 4px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.07em;
    color: var(--text-muted);
    user-select: none;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to   { opacity: 1; transform: scale(1); }
  }

  .ctx-item {
    display: block;
    width: 100%;
    padding: 7px 12px;
    background: transparent;
    border: none;
    border-radius: 5px;
    color: var(--text-primary);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
  }

  .ctx-item:hover { background: var(--bg-hover); }

  .ctx-item.danger { color: var(--error, #f85149); }
  .ctx-item.danger:hover { background: rgba(248, 81, 73, 0.1); }

  .tpl-row { display: flex; align-items: center; }
  .tpl-btn { flex: 1; }
  .tpl-ai {
    flex-shrink: 0;
    width: 32px;
    padding: 7px 4px;
    color: var(--accent);
    opacity: 0.7;
  }
  .tpl-ai:hover { opacity: 1; background: var(--accent-bg); }

  .ctx-sep {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }
</style>
