<script lang="ts">
  import { writeFile, readFile, getBacklinks, reindex, readFileBase64 } from '$lib/api';
  import type { BacklinkResult } from '$lib/api';
  import {
    getVaultPath, getActiveFile, getActiveContent,
    setActiveFile, setActiveContent, getIsDirty, setIsDirty
  } from '$lib/stores/vault.svelte';
  import CodeMirrorEditor from './CodeMirrorEditor.svelte';

  let saveTimeout: ReturnType<typeof setTimeout>;
  let backlinks = $state<BacklinkResult[]>([]);
  let showBacklinks = $state(false);
  let showOutline = $state(false);
  let showPreview = $state(false);
  let scrollToLine = $state<number | null>(null);
  let previewHtml = $state('');

  // Frontmatter parsé (clés simples uniquement)
  let frontmatter = $derived((() => {
    const content = getActiveContent();
    if (!content.startsWith('---\n')) return null;
    const end = content.indexOf('\n---', 4);
    if (end === -1) return null;
    const fields: { key: string; value: string }[] = [];
    for (const line of content.slice(4, end).split('\n')) {
      const colon = line.indexOf(':');
      if (colon > 0) {
        fields.push({ key: line.slice(0, colon).trim(), value: line.slice(colon + 1).trim() });
      }
    }
    return fields.length ? fields : null;
  })());

  let frontmatterType = $derived(frontmatter?.find(f => f.key === 'type')?.value ?? '');

  function triggerContextualAI(prompt: string) {
    document.dispatchEvent(new CustomEvent('trigger-ai', { detail: { prompt } }));
  }

  function generateSessionSummary() {
    const content = getActiveContent().replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
    triggerContextualAI(`Tu es assistant Maître du Jeu TTRPG. Génère un résumé narratif épique et vivant de cette session de jeu, en style récit de campagne :\n\n${content}`);
  }

  function generateNpcDialogue() {
    const name = frontmatter?.find(f => f.key === 'name' || f.key === 'title')?.value
      ?? getActiveFile()?.split('/').pop()?.replace(/\.md$/, '') ?? 'Ce PNJ';
    const content = getActiveContent();
    triggerContextualAI(`Tu joues le rôle de "${name}". En t'appuyant sur cette fiche de personnage, génère 5 répliques de dialogue uniques et authentiques, chacune révélant un aspect de sa personnalité :\n\n${content}`);
  }

  function generateCreatureStats() {
    const content = getActiveContent();
    triggerContextualAI(`À partir de cette description de créature, génère un bloc de statistiques complet pour système D&D 5e ou OSR, en français, avec CA, PV, vitesse, caractéristiques et capacités spéciales :\n\n${content}`);
  }

  function generateLocationDetails() {
    const name = getActiveFile()?.split('/').pop()?.replace(/\.md$/, '') ?? 'Ce lieu';
    const content = getActiveContent();
    triggerContextualAI(`Tu es un auteur TTRPG. Enrichis cette fiche de lieu "${name}" avec : une description sensorielle (sons, odeurs, lumière), 3 secrets cachés, 2 PNJ typiques, et 1 accroche d'aventure :\n\n${content}`);
  }

  function generateFactionPlot() {
    const content = getActiveContent();
    triggerContextualAI(`À partir de cette faction, génère : leur plan à court terme, leur plan à long terme, leurs relations avec 2 autres factions imaginaires, et 3 hooks d'aventure les impliquant :\n\n${content}`);
  }

  let wordCount = $derived((() => {
    const text = getActiveContent().replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  })());

  let charCount = $derived(getActiveContent().length);

  let outline = $derived((() => {
    const lines = getActiveContent().split('\n');
    const headings: { level: number; text: string; line: number }[] = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(#{1,4})\s+(.+)/);
      if (m) headings.push({ level: m[1].length, text: m[2], line: i });
    }
    return headings;
  })());

  function esc(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function renderTable(lines: string[]): string {
    const rows = lines.map(l => l.replace(/^\||\|$/g,'').split('|').map(c => c.trim()));
    const isAlignRow = (r: string[]) => r.every(c => /^:?-+:?$/.test(c));
    let html = '<table><thead><tr>';
    if (rows.length < 1) return '';
    rows[0].forEach(h => { html += `<th>${esc(h)}</th>`; });
    html += '</tr></thead><tbody>';
    for (let i = 1; i < rows.length; i++) {
      if (isAlignRow(rows[i])) continue;
      html += '<tr>' + rows[i].map(c => `<td>${esc(c)}</td>`).join('') + '</tr>';
    }
    return html + '</tbody></table>';
  }

  async function markdownToHtml(md: string, resolveImages = false): Promise<string> {
    const vaultPath = getVaultPath();
    // Strip frontmatter
    const stripped = md.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
    const lines = stripped.split('\n');
    let html = '';
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      // Table block
      if (line.trim().startsWith('|') && i + 1 < lines.length) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) { tableLines.push(lines[i]); i++; }
        html += renderTable(tableLines);
        continue;
      }
      // Code block
      if (line.startsWith('```')) {
        const lang = line.slice(3).trim();
        i++;
        let code = '';
        while (i < lines.length && !lines[i].startsWith('```')) { code += esc(lines[i]) + '\n'; i++; }
        i++;
        html += `<pre><code${lang ? ` class="language-${lang}"` : ''}>${code}</code></pre>`;
        continue;
      }
      // Headings
      const hm = line.match(/^(#{1,6})\s+(.+)/);
      if (hm) { html += `<h${hm[1].length}>${esc(hm[2])}</h${hm[1].length}>`; i++; continue; }
      // HR
      if (/^---+$/.test(line.trim())) { html += '<hr>'; i++; continue; }
      // Blockquote
      if (line.startsWith('> ')) { html += `<blockquote>${esc(line.slice(2))}</blockquote>`; i++; continue; }
      // Unordered list / checklist
      const ulm = line.match(/^(\s*)[-*]\s+(.*)/);
      if (ulm) {
        const checkDone = ulm[2].match(/^\[x\]\s*(.*)/i);
        const checkOpen = ulm[2].match(/^\[ \]\s*(.*)/);
        if (checkDone) {
          html += `<div class="checklist-item done"><span class="check">☑</span><span>${esc(checkDone[1])}</span></div>`;
        } else if (checkOpen) {
          html += `<div class="checklist-item"><span class="check">☐</span><span>${esc(checkOpen[1])}</span></div>`;
        } else {
          html += `<li>${esc(ulm[2])}</li>`;
        }
        i++; continue;
      }
      // Ordered list
      const olm = line.match(/^\d+\.\s+(.*)/);
      if (olm) { html += `<li>${esc(olm[1])}</li>`; i++; continue; }
      // Empty line
      if (!line.trim()) { i++; continue; }
      // Normal paragraph — inline formatting
      let para = esc(line);
      // Bold + italic
      para = para.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
      para = para.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      para = para.replace(/\*(.+?)\*/g, '<em>$1</em>');
      para = para.replace(/_(.+?)_/g, '<em>$1</em>');
      // Inline code
      para = para.replace(/`(.+?)`/g, '<code>$1</code>');
      // WikiLinks [[note]] → clickable link
      para = para.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
        const display = label || target;
        const href = target.endsWith('.md') ? target : `${target}.md`;
        return `<a class="wikilink" data-href="${esc(href)}">${esc(display)}</a>`;
      });
      html += `<p>${para}</p>`;
      i++;
    }
    // Resolve ![[path]] image tags to base64 if requested
    if (resolveImages && vaultPath) {
      const imgMatches = [...html.matchAll(/!\[\[([^\]]+\.(png|jpg|jpeg|webp|gif))\]\]/gi)];
      for (const m of imgMatches) {
        try {
          const b64 = await readFileBase64(`${vaultPath}/${m[1]}`);
          const ext = m[1].split('.').pop()?.toLowerCase() ?? 'png';
          const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`;
          html = html.replace(m[0], `<img src="data:${mime};base64,${b64}" alt="${esc(m[1])}" style="max-width:100%;border-radius:6px">`);
        } catch {}
      }
    }
    return html;
  }

  $effect(() => {
    if (!showPreview) return;
    const content = getActiveContent();
    markdownToHtml(content, false).then(h => { previewHtml = h; });
  });

  async function exportPdf() {
    const content = getActiveContent();
    const title = getActiveFile()?.split('/').pop()?.replace(/\.md$/, '') ?? 'Note';
    const body = await markdownToHtml(content, true);
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:0;width:0;height:0;border:0';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        body{font-family:Georgia,serif;line-height:1.7;max-width:800px;margin:40px auto;padding:0 20px;color:#111}
        h1{font-size:2em;margin-bottom:.5em;border-bottom:1px solid #ddd;padding-bottom:.3em}
        h2{font-size:1.5em;margin-top:1.5em}h3{font-size:1.2em}
        pre,code{font-family:monospace;background:#f5f5f5;border-radius:3px}
        code{padding:1px 4px}pre{padding:12px;white-space:pre-wrap;overflow-x:auto}
        blockquote{border-left:4px solid #ccc;margin:0;padding:0 16px;color:#555;font-style:italic}
        table{border-collapse:collapse;width:100%;margin:1em 0}
        th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}
        th{background:#f0f0f0;font-weight:bold}tr:nth-child(even){background:#fafafa}
        img{max-width:100%;border-radius:6px;margin:8px 0}
        hr{border:none;border-top:1px solid #ddd;margin:2em 0}
      </style>
      </head><body>${body}</body></html>`);
    doc.close();
    setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => document.body.removeChild(iframe), 2000); }, 200);
  }

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
        {#if outline.length > 0}
          <button
            class="save-btn"
            class:active={showOutline}
            onclick={() => showOutline = !showOutline}
            title="Sommaire ({outline.length} titres)"
          >
            📑 {outline.length}
          </button>
        {/if}
        <button
          class="save-btn backlinks-btn"
          class:active={showBacklinks}
          onclick={() => showBacklinks = !showBacklinks}
          title="Rétroliens ({backlinks.length})"
        >
          🔗 {backlinks.length}
        </button>
        <button onclick={() => document.dispatchEvent(new CustomEvent('trigger-ai'))} class="save-btn ai-btn" title="Générer avec l'IA (Ctrl+J). Sur ligne vide : résume tout le document.">
          🪄 Ollama
        </button>
        {#if frontmatterType === 'session'}
          <button onclick={generateSessionSummary} class="save-btn ctx-btn session-btn" title="Résumé narratif de session">📋 Résumé</button>
        {/if}
        {#if frontmatterType === 'pnj' || frontmatterType === 'npc'}
          <button onclick={generateNpcDialogue} class="save-btn ctx-btn" title="Générer des dialogues pour ce PNJ">🗣️ Dialogue</button>
        {/if}
        {#if frontmatterType === 'creature'}
          <button onclick={generateCreatureStats} class="save-btn ctx-btn" title="Générer un bloc de stats">⚔️ Stats</button>
        {/if}
        {#if frontmatterType === 'lieu'}
          <button onclick={generateLocationDetails} class="save-btn ctx-btn" title="Enrichir la description du lieu">🌍 Enrichir</button>
        {/if}
        {#if frontmatterType === 'faction'}
          <button onclick={generateFactionPlot} class="save-btn ctx-btn" title="Générer le plan de la faction">⚜️ Complot</button>
        {/if}
        <button class="save-btn" class:active={showPreview} onclick={() => showPreview = !showPreview} title="Aperçu rendu (images + tableaux)">
          👁️
        </button>
        <button onclick={exportPdf} class="save-btn" title="Exporter en PDF (rendu complet)">
          🖨️
        </button>
        <button onclick={() => { clearTimeout(saveTimeout); saveFile(true); }} class="save-btn" title="Sauvegarder (Ctrl+S)">
          💾
        </button>
      </div>
    </div>

    {#if frontmatter}
      <div class="frontmatter-bar">
        {#each frontmatter as field}
          <span class="fm-pill">
            <span class="fm-key">{field.key}</span>
            <span class="fm-val">{field.value}</span>
          </span>
        {/each}
      </div>
    {/if}

    {#if showOutline && outline.length > 0}
      <div class="outline-panel">
        {#each outline as h}
          <button
            class="outline-item"
            style="padding-left: {(h.level - 1) * 12 + 8}px"
            onclick={() => { scrollToLine = h.line; setTimeout(() => { scrollToLine = null; }, 50); }}
          >
            <span class="outline-marker" style="font-size: {16 - h.level * 2}px">{'#'.repeat(h.level)}</span>
            <span class="outline-text">{h.text}</span>
          </button>
        {/each}
      </div>
    {/if}

    <div class="editor-wrapper" class:split-view={showPreview}>
      <CodeMirrorEditor
        value={getActiveContent()}
        scrollToLine={scrollToLine}
        onInput={(val) => {
          setActiveContent(val);
          setIsDirty(true);
          clearTimeout(saveTimeout);
          saveTimeout = setTimeout(saveFile, 1500);
          if (showPreview) markdownToHtml(val, false).then(h => { previewHtml = h; });
        }}
        onSave={() => {
          clearTimeout(saveTimeout);
          saveFile(true);
        }}
      />
      {#if showPreview}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="preview-panel" onclick={(e) => {
          const target = e.target as HTMLElement;
          const link = target.closest('[data-href]') as HTMLElement | null;
          if (!link) return;
          const href = link.dataset.href;
          if (!href) return;
          // Trouver le chemin complet dans le vault
          const currentFile = getActiveFile();
          if (currentFile) {
            const dir = currentFile.includes('/') ? currentFile.slice(0, currentFile.lastIndexOf('/') + 1) : '';
            setActiveFile(dir + href);
          } else {
            setActiveFile(href);
          }
        }}>
          {@html previewHtml}
        </div>
      {/if}
    </div>

    <div class="editor-statusbar">
      <span>{wordCount} mots</span>
      <span class="status-sep">·</span>
      <span>{charCount} caractères</span>
      {#if getActiveFile()}
        <span class="status-sep">·</span>
        <span class="status-path">{getActiveFile()?.split('/').pop()}</span>
      {/if}
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

  .ctx-btn {
    border-color: rgba(124, 106, 245, 0.5);
    color: #9d8df5;
  }
  .ctx-btn:hover { background: rgba(124, 106, 245, 0.1); color: #b8abff; }

  .session-btn {
    border-color: rgba(34, 197, 94, 0.5);
    color: #22c55e;
  }
  .session-btn:hover { background: rgba(34, 197, 94, 0.1); }

  .backlinks-btn.active {
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);
  }

  .editor-wrapper { flex: 1; min-height: 0; overflow: hidden; display: flex; }
  .editor-wrapper.split-view :global(.cm-editor) { flex: 1; min-width: 0; }

  .preview-panel {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: 24px 32px;
    max-width: 800px;
    font-family: Georgia, serif;
    font-size: 15px;
    line-height: 1.8;
    color: var(--text-primary);
    border-left: 1px solid var(--border);
  }
  .preview-panel :global(h1) { font-size: 1.9em; border-bottom: 1px solid var(--border); padding-bottom: .3em; margin-top: .5em; }
  .preview-panel :global(h2) { font-size: 1.4em; margin-top: 1.4em; }
  .preview-panel :global(h3) { font-size: 1.2em; margin-top: 1.2em; }
  .preview-panel :global(table) { border-collapse: collapse; width: 100%; margin: 1em 0; }
  .preview-panel :global(th), .preview-panel :global(td) { border: 1px solid var(--border); padding: 7px 12px; text-align: left; }
  .preview-panel :global(th) { background: var(--bg-secondary); font-weight: 700; }
  .preview-panel :global(tr:nth-child(even)) { background: rgba(255,255,255,.02); }
  .preview-panel :global(blockquote) { border-left: 4px solid var(--accent); margin: 0; padding: 0 16px; color: var(--text-muted); font-style: italic; }
  .preview-panel :global(pre) { background: var(--bg-secondary); border-radius: 6px; padding: 12px; overflow-x: auto; }
  .preview-panel :global(code) { font-family: monospace; background: rgba(255,255,255,.06); padding: 1px 4px; border-radius: 3px; font-size: 13px; }
  .preview-panel :global(img) { max-width: 100%; border-radius: 8px; margin: 8px 0; }
  .preview-panel :global(hr) { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
  .preview-panel :global(.checklist-item) { display: flex; gap: 8px; align-items: baseline; padding: 2px 0; font-size: 14px; }
  .preview-panel :global(.checklist-item .check) { font-size: 16px; flex-shrink: 0; color: var(--text-muted); }
  .preview-panel :global(.checklist-item.done) { color: var(--text-muted); text-decoration: line-through; }
  .preview-panel :global(.checklist-item.done .check) { color: #22c55e; }
  .preview-panel :global(li) { margin: 3px 0; padding-left: 4px; }
  .preview-panel :global(.wikilink) { color: var(--accent); text-decoration: none; border-bottom: 1px dashed var(--accent); cursor: pointer; }
  .preview-panel :global(.wikilink:hover) { background: rgba(229,168,83,0.12); border-radius: 2px; }

  /* ── Frontmatter bar ────────────────────────────────────────── */

  .frontmatter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px 16px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-subtle, var(--border));
    flex-shrink: 0;
  }

  .fm-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 2px 10px;
    font-size: 11px;
  }

  .fm-key {
    color: var(--accent);
    font-weight: 600;
    font-family: monospace;
  }

  .fm-val { color: var(--text-secondary); }

  /* ── Outline panel ─────────────────────────────────────────── */

  .outline-panel {
    flex-shrink: 0;
    max-height: 200px;
    overflow-y: auto;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
    padding: 4px;
  }

  .outline-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    background: transparent;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }
  .outline-item:hover { background: var(--bg-hover); }

  .outline-marker {
    color: var(--accent);
    font-family: monospace;
    font-weight: 700;
    flex-shrink: 0;
  }

  .outline-text {
    font-size: 12px;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Status bar ────────────────────────────────────────────── */

  .editor-statusbar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 16px;
    background: var(--bg-tertiary);
    border-top: 1px solid var(--border-subtle, var(--border));
    font-size: 10px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .status-sep { opacity: 0.4; }
  .status-path { color: var(--text-secondary); font-style: italic; }

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
    background-clip: text;
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
