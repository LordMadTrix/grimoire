<script lang="ts">
  import { writeFile, readFile, getBacklinks, reindex, readFileBase64 } from '$lib/api';
  import type { BacklinkResult } from '$lib/api';
  import {
    getVaultPath, getActiveFile, getActiveContent,
    setActiveFile, setActiveContent, getIsDirty, setIsDirty
  } from '$lib/stores/vault.svelte';
  import CodeMirrorEditor from './CodeMirrorEditor.svelte';
  import PdfReaderModal from './PdfReaderModal.svelte';
  import {
    getSpellcheckEnabled,
    toggleSpellcheck,
    getSpellcheckLang,
    setSpellcheckLang,
    setSpellcheckEnabled
  } from '$lib/spellcheck/spellcheckStore.svelte';
  import { vttStore, updateGmAudio } from '$lib/stores/vtt.svelte';
  import { CALLOUT_TYPES } from '$lib/editor/calloutPlugin';
  import { evaluateDiceFormula, playDiceSound } from '$lib/editor/dicePlugin';
  import { notifStore } from '$lib/stores/notifications.svelte';
  import ShareToPlayersModal from './ShareToPlayersModal.svelte';
  import { cleanNoteForPlayers, shareWithPlayers } from '$lib/playerShare';

  let saveTimeout: ReturnType<typeof setTimeout>;
  let backlinks = $state<BacklinkResult[]>([]);
  let showBacklinks = $state(false);
  let showOutline = $state(false);
  let viewMode = $state<'edit' | 'split' | 'read'>('edit');
  let showPreview = $derived(viewMode === 'split' || viewMode === 'read');
  let showEditor = $derived(viewMode === 'edit' || viewMode === 'split');
  let showToolbar = $state(true);
  let activeToolbarMenu = $state<string | null>(null);
  let showShortcutsModal = $state(false);
  let showShareModal = $state(false);
  let shareModalContent = $state('');
  let shareModalTitle = $state('');

  function toggleToolbarMenu(menu: string) {
    activeToolbarMenu = activeToolbarMenu === menu ? null : menu;
  }

  function handleFormatAction(type: string) {
    applyFormat(type);
    activeToolbarMenu = null;
  }

  let editorCtxMenu = $state<{ x: number; y: number; hasSelection: boolean; selectedText: string } | null>(null);

  function handleEditorContextMenu(e: MouseEvent) {
    e.preventDefault();
    const sel = window.getSelection();
    const selectedText = sel ? sel.toString().trim() : '';
    const hasSelection = selectedText.length > 0;
    
    const menuWidth = 230;
    const menuHeight = 360;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);

    editorCtxMenu = {
      x: Math.max(10, x),
      y: Math.max(10, y),
      hasSelection,
      selectedText
    };
  }

  function handleCtxAction(type: string) {
    applyFormat(type);
    editorCtxMenu = null;
  }

  function handleCtxAI(action: 'menu' | 'describe' | 'dialogue' | 'sensory' | 'stats') {
    if (!editorCtxMenu) return;
    const text = editorCtxMenu.selectedText;
    editorCtxMenu = null;
    if (action === 'menu' || !text) {
      document.dispatchEvent(new CustomEvent('trigger-ai'));
      return;
    }
    let prompt = '';
    switch (action) {
      case 'describe':
        prompt = `Décris de manière évocatrice, vivante et percutante "${text}" pour une partie de jeu de rôle (style scénario TTRPG). Mentionne son apparence distinctive et un détail intrigant :\n\n${text}`;
        break;
      case 'dialogue':
        prompt = `Imagine que tu incarnes le personnage "${text}". Rédige 3 répliques de dialogue authentiques et immersives qui expriment sa personnalité :\n\n${text}`;
        break;
      case 'sensory':
        prompt = `Enrichis la description suivante avec des détails sensoriels immersifs pour le Maître du Jeu (sons, odeurs, luminosité, température, sensation générale) :\n\n${text}`;
        break;
      case 'stats':
        prompt = `À partir de "${text}", génère un profil de caractéristiques et de combat synthétique en français pour jeu de rôle (CA, PV, Attaque, Dégâts, Capacité spéciale) :\n\n${text}`;
        break;
    }
    if (prompt) {
      triggerContextualAI(prompt);
    }
  }

  function openShareModalForNote() {
    editorCtxMenu = null;
    const file = getActiveFile();
    const title = file ? file.split('/').pop()?.replace(/\.md$/i, '') : 'Document';
    shareModalContent = getActiveContent();
    shareModalTitle = title || 'Document';
    showShareModal = true;
  }

  function shareSelectionDirect(target: 'all' | 'playerView' | 'mobile', mode: 'parchment' | 'ambient' = 'parchment') {
    if (!editorCtxMenu) return;
    const selected = editorCtxMenu.selectedText;
    editorCtxMenu = null;
    if (!selected) {
      openShareModalForNote();
      return;
    }
    const file = getActiveFile();
    const noteTitle = file ? file.split('/').pop()?.replace(/\.md$/i, '') : 'Extrait';
    const cleaned = cleanNoteForPlayers(selected, { hideSecrets: true, defaultTitle: `${noteTitle} (Extrait)` });
    shareWithPlayers({
      title: cleaned.title,
      text: cleaned.cleanText,
      html: cleaned.cleanHtml,
      target,
      mode
    });
  }

  let scrollToLine = $state<number | null>(null);
  let previewHtml = $state('');

  let editorWrapperEl = $state<HTMLDivElement | null>(null);
  let previewPanelEl = $state<HTMLDivElement | null>(null);
  let isSyncingScroll = false;

  let spellEnabled = $state(getSpellcheckEnabled());
  let spellLang = $state(getSpellcheckLang());

  function refreshSpellState() {
    spellEnabled = getSpellcheckEnabled();
    spellLang = getSpellcheckLang();
  }

  $effect(() => {
    document.addEventListener('spellcheck-settings-changed', refreshSpellState);
    return () => {
      document.removeEventListener('spellcheck-settings-changed', refreshSpellState);
    };
  });

  function handleToggleSpellcheck() {
    toggleSpellcheck();
    refreshSpellState();
  }

  function cycleSpellcheck() {
    if (!spellEnabled) {
      setSpellcheckEnabled(true);
      setSpellcheckLang('fr');
    } else if (spellLang === 'fr') {
      setSpellcheckLang('en');
    } else {
      setSpellcheckEnabled(false);
    }
    refreshSpellState();
  }

  let isZenMode = $state(false);
  let isTypewriter = $state(false);

  function toggleZenMode() {
    isZenMode = !isZenMode;
    document.dispatchEvent(new CustomEvent('toggle-zen-mode', { detail: { isZenMode } }));
  }

  function toggleTypewriter() {
    isTypewriter = !isTypewriter;
    document.dispatchEvent(new CustomEvent('toggle-typewriter', { detail: { enabled: isTypewriter } }));
  }

  function handleEditorKeydown(e: KeyboardEvent) {
    if (e.key === 'F11') {
      e.preventDefault();
      toggleZenMode();
    } else if (e.key === 'Escape') {
      if (editorCtxMenu !== null) {
        e.preventDefault();
        editorCtxMenu = null;
      } else if (activeToolbarMenu !== null) {
        e.preventDefault();
        activeToolbarMenu = null;
      } else if (showShortcutsModal) {
        e.preventDefault();
        showShortcutsModal = false;
      } else if (isZenMode) {
        e.preventDefault();
        toggleZenMode();
      }
    }
  }

  function applyFormat(type: string) {
    document.dispatchEvent(new CustomEvent('editor-format', { detail: { type } }));
  }

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

  // Piste audio / ambiance liée à la note
  let ambianceTrack = $derived((() => {
    if (!frontmatter) return null;
    const item = frontmatter.find(f => ['ambiance', 'audio', 'soundtrack', 'musique'].includes(f.key.toLowerCase()));
    return item ? item.value.replace(/^["']|["']$/g, '').trim() : null;
  })());

  let isAmbiancePlaying = $derived(!!ambianceTrack && vttStore.audioSrc === ambianceTrack);

  function toggleAmbiance() {
    if (!ambianceTrack) return;
    if (isAmbiancePlaying) {
      updateGmAudio(null);
    } else {
      updateGmAudio(ambianceTrack);
    }
  }

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

  function renderInline(raw: string): string {
    let s = esc(raw);

    // Standard markdown images: ![alt](url)
    s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]+|[^\s)]+\.(?:png|jpg|jpeg|webp|gif|svg))\)/gi, '<img src="$2" alt="$1" style="max-width:100%;border-radius:6px;margin:4px 0" loading="lazy">');

    // Wiki images: ![[path.ext]]
    s = s.replace(/!\[\[([^\]]+\.(?:png|jpg|jpeg|webp|gif|svg))\]\]/gi, '<span class="preview-wiki-img" data-img-path="$1">🖼️ $1</span>');

    // Markdown external links [label](url)
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1 ↗</a>');

    // WikiLinks [[note]] ou [[note|alias]] ou [[map:scene]]
    s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
      const cleanTarget = target.trim();
      const display = label ? label.trim() : cleanTarget;
      if (cleanTarget.toLowerCase().startsWith('map:')) {
        return `<a class="wikilink map-link" data-href="${esc(cleanTarget)}">🗺️ ${esc(display)}</a>`;
      }
      const href = cleanTarget.endsWith('.md') ? cleanTarget : `${cleanTarget}.md`;
      return `<a class="wikilink" data-href="${esc(href)}">${esc(display)}</a>`;
    });

    // Formules de dés cliquables dans l'aperçu
    s = s.replace(/\b(\d{1,2}d\d{1,3}(?:\s*[+-]\s*\d{1,3})?|d\d{1,3}(?:\s*[+-]\s*\d{1,3})?)\b/gi, (match) => {
      return `<button type="button" class="preview-dice-btn" data-formula="${match}" title="🎲 Cliquer pour lancer ${match}">🎲 ${match}</button>`;
    });

    // Notes secrètes du MJ %% secret %%
    s = s.replace(/%%([\s\S]*?)%%/g, '<span class="preview-gm-comment" title="Note confidentielle MJ">👁️‍🗨️ $1</span>');

    // Bold + italic
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
    s = s.replace(/(^|\W)_(.+?)_(\W|$)/g, '$1<em>$2</em>$3');
    // Strikethrough & Highlight
    s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
    s = s.replace(/==(.+?)==/g, '<mark>$1</mark>');
    // Inline code
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');

    return s;
  }

  function renderTable(lines: string[]): string {
    const rows = lines.map(l => l.replace(/^\||\|$/g,'').split('|').map(c => c.trim()));
    if (rows.length < 1) return '';
    const isAlignRow = (r: string[]) => r.every(c => /^:?-+:?$/.test(c));
    const alignments = rows.length > 1 && isAlignRow(rows[1])
      ? rows[1].map(c => {
          if (c.startsWith(':') && c.endsWith(':')) return 'center';
          if (c.endsWith(':')) return 'right';
          return 'left';
        })
      : [];

    let html = '<table><thead><tr>';
    rows[0].forEach((h, idx) => {
      const align = alignments[idx] ? ` style="text-align:${alignments[idx]}"` : '';
      html += `<th${align}>${renderInline(h)}</th>`;
    });
    html += '</tr></thead><tbody>';
    for (let i = 1; i < rows.length; i++) {
      if (isAlignRow(rows[i])) continue;
      html += '<tr>' + rows[i].map((c, idx) => {
        const align = alignments[idx] ? ` style="text-align:${alignments[idx]}"` : '';
        return `<td${align}>${renderInline(c)}</td>`;
      }).join('') + '</tr>';
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

      // Empty line
      if (!line.trim()) { i++; continue; }

      // Table block
      if (line.trim().startsWith('|') && i + 1 < lines.length) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        html += renderTable(tableLines);
        continue;
      }

      // Code block
      if (line.startsWith('```')) {
        const lang = line.slice(3).trim();
        i++;
        let code = '';
        while (i < lines.length && !lines[i].startsWith('```')) {
          code += esc(lines[i]) + '\n';
          i++;
        }
        i++;
        html += `<pre><code${lang ? ` class="language-${lang}"` : ''}>${code}</code></pre>`;
        continue;
      }

      // Headings
      const hm = line.match(/^(#{1,6})\s+(.+)/);
      if (hm) {
        html += `<h${hm[1].length}>${renderInline(hm[2])}</h${hm[1].length}>`;
        i++;
        continue;
      }

      // HR
      if (/^---+$/.test(line.trim())) {
        html += '<hr>';
        i++;
        continue;
      }

      // Callouts & Blockquotes
      if (line.startsWith('> ') || line === '>') {
        const firstQuote = line.replace(/^>\s?/, '');
        const calloutMatch = firstQuote.match(/^\[!([a-zA-Z0-9_-]+)\](?:\s+(.*))?$/i);

        if (calloutMatch) {
          const rawType = calloutMatch[1].toLowerCase();
          const customTitle = calloutMatch[2]?.trim();
          const meta = CALLOUT_TYPES[rawType] || {
            type: rawType,
            icon: '📌',
            label: rawType.charAt(0).toUpperCase() + rawType.slice(1),
            color: '#e5a853',
            bgColor: 'rgba(229, 168, 83, 0.08)'
          };
          const title = customTitle || meta.label;

          i++;
          const bodyLines: string[] = [];
          while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
            bodyLines.push(lines[i].replace(/^>\s?/, ''));
            i++;
          }

          const bodyContent = bodyLines
            .filter(Boolean)
            .map(l => `<p>${renderInline(l)}</p>`)
            .join('');

          const isReadAloud = meta.type === 'readaloud';
          const rawCalloutText = bodyLines.join('\n');
          const quickShareBtn = isReadAloud
            ? `<button type="button" class="callout-share-btn" data-title="${esc(title)}" data-body="${esc(rawCalloutText)}" title="📤 Projeter ce récit aux Joueurs (TV & Smartphones)">📤 Projeter</button>`
            : '';

          html += `<div class="preview-callout callout-${meta.type}" style="border-left-color:${meta.color}; background:${meta.bgColor};">
            <div class="callout-header">
              <span class="callout-icon">${meta.icon}</span>
              <strong style="color:${meta.color};">${esc(title)}</strong>
              ${quickShareBtn}
            </div>
            ${bodyContent ? `<div class="callout-content">${bodyContent}</div>` : ''}
          </div>`;
          continue;
        } else {
          // Standard blockquote
          const quoteLines: string[] = [];
          while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
            quoteLines.push(lines[i].replace(/^>\s?/, ''));
            i++;
          }
          const quoteContent = quoteLines
            .filter(Boolean)
            .map(l => `<p>${renderInline(l)}</p>`)
            .join('');
          html += `<blockquote>${quoteContent}</blockquote>`;
          continue;
        }
      }

      // Checklists & Unordered lists
      if (/^\s*[-*+]\s+/.test(line)) {
        html += '<ul class="preview-list">';
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          const itemMatch = lines[i].match(/^\s*[-*+]\s+(.*)/);
          if (itemMatch) {
            const rawItem = itemMatch[1];
            const checkDone = rawItem.match(/^\[x\]\s*(.*)/i);
            const checkOpen = rawItem.match(/^\[ \]\s*(.*)/);
            if (checkDone) {
              html += `<li class="checklist-item done"><span class="check-box checked">☑</span><span>${renderInline(checkDone[1])}</span></li>`;
            } else if (checkOpen) {
              html += `<li class="checklist-item"><span class="check-box">☐</span><span>${renderInline(checkOpen[1])}</span></li>`;
            } else {
              html += `<li>${renderInline(rawItem)}</li>`;
            }
          }
          i++;
        }
        html += '</ul>';
        continue;
      }

      // Ordered lists
      if (/^\s*\d+\.\s+/.test(line)) {
        html += '<ol class="preview-list">';
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          const itemMatch = lines[i].match(/^\s*\d+\.\s+(.*)/);
          if (itemMatch) {
            html += `<li>${renderInline(itemMatch[1])}</li>`;
          }
          i++;
        }
        html += '</ol>';
        continue;
      }

      // Normal paragraph
      html += `<p>${renderInline(line)}</p>`;
      i++;
    }

    // Resolve ![[path]] image tags to base64 if vaultPath is available
    if (vaultPath) {
      const wikiImgs = [...html.matchAll(/data-img-path="([^"]+)"/g)];
      for (const m of wikiImgs) {
        try {
          const b64 = await readFileBase64(`${vaultPath}/${m[1]}`);
          const ext = m[1].split('.').pop()?.toLowerCase() ?? 'png';
          const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`;
          html = html.replace(
            `<span class="preview-wiki-img" data-img-path="${m[1]}">🖼️ ${m[1]}</span>`,
            `<img src="data:${mime};base64,${b64}" alt="${esc(m[1])}" style="max-width:100%;border-radius:6px;margin:6px 0;display:block;">`
          );
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

  // Synchronisation du défilement entre l'éditeur et l'aperçu en mode Split
  $effect(() => {
    if (viewMode !== 'split' || !editorWrapperEl || !previewPanelEl) return;
    const scroller = editorWrapperEl.querySelector('.cm-scroller') as HTMLElement | null;
    const panel = previewPanelEl;
    if (!scroller || !panel) return;

    const handleEditorScroll = () => {
      if (isSyncingScroll || viewMode !== 'split') return;
      isSyncingScroll = true;
      const maxScroller = scroller.scrollHeight - scroller.clientHeight;
      const maxPreview = panel.scrollHeight - panel.clientHeight;
      if (maxScroller > 0 && maxPreview > 0) {
        const ratio = scroller.scrollTop / maxScroller;
        panel.scrollTop = ratio * maxPreview;
      }
      requestAnimationFrame(() => { isSyncingScroll = false; });
    };

    const handlePreviewScroll = () => {
      if (isSyncingScroll || viewMode !== 'split') return;
      isSyncingScroll = true;
      const maxScroller = scroller.scrollHeight - scroller.clientHeight;
      const maxPreview = panel.scrollHeight - panel.clientHeight;
      if (maxScroller > 0 && maxPreview > 0) {
        const ratio = panel.scrollTop / maxPreview;
        scroller.scrollTop = ratio * maxScroller;
      }
      requestAnimationFrame(() => { isSyncingScroll = false; });
    };

    scroller.addEventListener('scroll', handleEditorScroll, { passive: true });
    panel.addEventListener('scroll', handlePreviewScroll, { passive: true });

    return () => {
      scroller.removeEventListener('scroll', handleEditorScroll);
      panel.removeEventListener('scroll', handlePreviewScroll);
    };
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

  // Auto-sauvegarde différée : fichier et contenu sont capturés au moment de la
  // frappe, pas au tir du timer — sinon changer de note pendant le délai de
  // 1,5 s sauvegarde le mauvais fichier et perd les modifications.
  function scheduleAutoSave(content: string) {
    const vaultPath = getVaultPath();
    const file = getActiveFile();
    if (!vaultPath || !file) return;
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        await writeFile(vaultPath, file, content);
        // Ne retirer l'indicateur ● que si rien n'a changé entre-temps
        if (getActiveFile() === file && getActiveContent() === content) setIsDirty(false);
      } catch (err) {
        console.error('Failed to save:', err);
      }
    }, 1500);
  }

  // Ouvrir un wikilink depuis l'aperçu : charge réellement le contenu de la
  // cible (racine du vault d'abord, comme le Ctrl+Clic de l'éditeur, puis
  // relatif au dossier courant). Sans cela, l'ancien contenu resterait affiché
  // sous le nouveau nom et la prochaine sauvegarde écraserait la cible.
  async function openWikiFromPreview(href: string) {
    const vaultPath = getVaultPath();
    if (!vaultPath) return;
    const currentFile = getActiveFile();
    const dir = currentFile?.includes('/') ? currentFile.slice(0, currentFile.lastIndexOf('/') + 1) : '';
    const candidates = dir ? [href, dir + href] : [href];
    for (const candidate of candidates) {
      try {
        const content = await readFile(vaultPath, candidate);
        setActiveFile(candidate);
        setActiveContent(content);
        setIsDirty(false);
        return;
      } catch {}
    }
  }

  function handlePreviewClick(e: MouseEvent) {
    const target = e.target as HTMLElement;

    // 1. Bouton de dé interactif dans l'aperçu
    const diceBtn = target.closest('.preview-dice-btn') as HTMLElement | null;
    if (diceBtn) {
      const formula = diceBtn.dataset.formula;
      if (formula) {
        const result = evaluateDiceFormula(formula);
        if (result) {
          playDiceSound();
          const detailStr = result.count > 1 || result.modifier !== 0
            ? ` [${result.rolls.join('+')}]${result.modifier !== 0 ? (result.modifier > 0 ? ' +' + result.modifier : ' ' + result.modifier) : ''}`
            : '';
          notifStore.add('🎲', `Jet : ${result.formula}`, `Résultat = ${result.total}${detailStr}`, 'info', 4000);
          window.dispatchEvent(new CustomEvent('dice-rolled', { detail: result }));
        }
      }
      return;
    }

    // 2. Bouton de projection directe d'un récit MJ [!READALOUD]
    const shareBtn = target.closest('.callout-share-btn') as HTMLElement | null;
    if (shareBtn) {
      const shareTitle = shareBtn.dataset.title || 'Récit MJ';
      const shareBody = shareBtn.dataset.body || '';
      if (shareBody) {
        const cleaned = cleanNoteForPlayers(shareBody, { hideSecrets: true, defaultTitle: shareTitle });
        shareWithPlayers({
          title: cleaned.title,
          text: cleaned.cleanText,
          html: cleaned.cleanHtml,
          target: 'all',
          mode: 'parchment'
        });
      }
      return;
    }

    // 3. Lien wiki ou scène VTT
    const link = target.closest('[data-href]') as HTMLElement | null;
    if (!link) return;
    const href = link.dataset.href;
    if (!href) return;
    if (href.toLowerCase().startsWith('map:')) {
      const targetMap = href.slice(4).trim();
      const [mapName, pinTarget] = targetMap.split('#');
      window.dispatchEvent(new CustomEvent('open-vtt-map', { detail: { mapName, pinTarget } }));
      return;
    }
    openWikiFromPreview(href);
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

<svelte:window onkeydown={handleEditorKeydown} onclick={() => { activeToolbarMenu = null; editorCtxMenu = null; }} />

<div class="editor-container" class:zen-mode={isZenMode}>
  {#if isZenMode}
    <button type="button" class="zen-exit-btn" onclick={toggleZenMode} title="Quitter le mode Zen (Échap ou F11)">
      ✕ Quitter Zen
    </button>
  {/if}
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
        <button
          class="save-btn spell-btn"
          class:active={spellEnabled}
          onclick={handleToggleSpellcheck}
          title={spellEnabled ? `Correcteur d'orthographe actif [${spellLang.toUpperCase()}]. Cliquer pour désactiver.` : "Activer le correcteur d'orthographe"}
        >
          🔤
        </button>
        <button
          type="button"
          class="save-btn"
          onclick={() => applyFormat('undo')}
          title="Retour en arrière / Annuler en cas d'erreur (Ctrl+Z)"
        >
          ↩️
        </button>
        <button
          type="button"
          class="save-btn"
          onclick={() => applyFormat('redo')}
          title="Rétablir l'action annulée (Ctrl+Y)"
        >
          ↪️
        </button>
        <button
          type="button"
          class="save-btn"
          class:active={isTypewriter}
          onclick={toggleTypewriter}
          title={isTypewriter ? "Mode Machine à écrire actif (centre la ligne active). Cliquer pour désactiver." : "Activer le mode Machine à écrire (centre la ligne active)"}
        >
          📜
        </button>
        <button
          type="button"
          class="save-btn zen-btn"
          class:active={isZenMode}
          onclick={toggleZenMode}
          title={isZenMode ? "Quitter le mode Zen (Échap ou F11)" : "Mode Zen : Plein écran sans distraction (F11)"}
        >
          🧘
        </button>
        <button
          class="save-btn"
          class:active={showToolbar}
          onclick={() => showToolbar = !showToolbar}
          title={showToolbar ? "Masquer les raccourcis Markdown" : "Afficher les raccourcis Markdown"}
        >
          🖋️
        </button>
        <button
          type="button"
          class="save-btn search-btn"
          onclick={() => document.dispatchEvent(new CustomEvent('editor-search'))}
          title="Rechercher / Remplacer dans la note [Ctrl+F / Ctrl+H]"
        >
          🔍
        </button>
        <div class="view-mode-group" role="group" aria-label="Mode d'affichage">
          <button
            type="button"
            class="save-btn mode-btn"
            class:active={viewMode === 'edit'}
            onclick={() => viewMode = 'edit'}
            title="Mode Éditeur seul"
          >
            ✏️
          </button>
          <button
            type="button"
            class="save-btn mode-btn"
            class:active={viewMode === 'split'}
            onclick={() => viewMode = 'split'}
            title="Mode Double vue (Éditeur + Aperçu en direct)"
          >
            🌓
          </button>
          <button
            type="button"
            class="save-btn mode-btn"
            class:active={viewMode === 'read'}
            onclick={() => viewMode = 'read'}
            title="Mode Lecture (Aperçu plein écran)"
          >
            📖
          </button>
        </div>
        <button onclick={exportPdf} class="save-btn" title="Exporter en PDF (rendu complet)">
          🖨️
        </button>
        <button
          type="button"
          class="save-btn share-broadcast-btn"
          onclick={openShareModalForNote}
          title="📤 Diffuser cette note aux Joueurs (Projeter sur la TV ou envoyer aux mobiles)"
        >
          📤
        </button>
        <button onclick={() => { clearTimeout(saveTimeout); saveFile(true); }} class="save-btn" title="Sauvegarder (Ctrl+S)">
          💾
        </button>
      </div>
    </div>

    {#if frontmatter}
      <div class="frontmatter-bar">
        {#if ambianceTrack}
          <button
            type="button"
            class="ambiance-pill"
            class:playing={isAmbiancePlaying}
            onclick={toggleAmbiance}
            title={isAmbiancePlaying ? "Musique en cours de diffusion. Cliquer pour mettre en pause." : "Lancer cette musique d'ambiance sur la table virtuelle et les écrans joueurs"}
          >
            <span class="ambiance-icon">{isAmbiancePlaying ? '🔊' : '🎵'}</span>
            <span class="ambiance-title">{ambianceTrack.split('/').pop()}</span>
            <span class="ambiance-badge">{isAmbiancePlaying ? 'Pause ⏸' : 'Lire ▶'}</span>
          </button>
        {/if}
        {#each frontmatter as field}
          <span class="fm-pill">
            <span class="fm-key">{field.key}</span>
            <span class="fm-val">{field.value}</span>
          </span>
        {/each}
      </div>
    {/if}

    {#if showToolbar && !getActiveFile()?.toLowerCase().endsWith('.pdf')}
      <div class="markdown-toolbar" role="toolbar" aria-label="Raccourcis de formatage Markdown">
        <!-- Actions directes d'historique -->
        <div class="toolbar-group">
          <button
            type="button"
            class="tool-btn"
            onmousedown={(e) => e.preventDefault()}
            onclick={() => applyFormat('undo')}
            title="Retour en arrière / Annuler [Ctrl+Z]"
          >
            <span class="btn-icon">↩️</span>
          </button>
          <button
            type="button"
            class="tool-btn"
            onmousedown={(e) => e.preventDefault()}
            onclick={() => applyFormat('redo')}
            title="Rétablir l'action annulée [Ctrl+Y]"
          >
            <span class="btn-icon">↪️</span>
          </button>
        </div>

        <div class="toolbar-divider"></div>

        <!-- Actions directes de style réflexe -->
        <div class="toolbar-group">
          <button
            type="button"
            class="tool-btn"
            onmousedown={(e) => e.preventDefault()}
            onclick={() => applyFormat('bold')}
            title="Gras (**texte**) [Ctrl+B]"
          >
            <span class="btn-icon bold-icon">B</span>
          </button>
          <button
            type="button"
            class="tool-btn"
            onmousedown={(e) => e.preventDefault()}
            onclick={() => applyFormat('italic')}
            title="Italique (*texte*) [Ctrl+I]"
          >
            <span class="btn-icon italic-icon">I</span>
          </button>
        </div>

        <div class="toolbar-divider"></div>

        <!-- Menu Déroulant 1 : Titres -->
        <div class="tb-dropdown" class:open={activeToolbarMenu === 'headings'}>
          <button
            type="button"
            class="tb-dropdown-btn"
            onmousedown={(e) => e.preventDefault()}
            onclick={(e) => { e.stopPropagation(); toggleToolbarMenu('headings'); }}
            title="Titres et structure (H1 - H4)"
          >
            <span class="btn-icon">🗛</span>
            <span class="btn-label">Titres</span>
            <span class="dropdown-caret">▾</span>
          </button>
          {#if activeToolbarMenu === 'headings'}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div class="tb-dropdown-menu" onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('h1')}>
                <span class="item-icon h-badge">H1</span>
                <span class="item-label">Titre 1 (Principal)</span>
                <span class="item-badge">#</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('h2')}>
                <span class="item-icon h-badge">H2</span>
                <span class="item-label">Titre 2 (Section)</span>
                <span class="item-badge">##</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('h3')}>
                <span class="item-icon h-badge">H3</span>
                <span class="item-label">Titre 3 (Sous-section)</span>
                <span class="item-badge">###</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('h4')}>
                <span class="item-icon h-badge">H4</span>
                <span class="item-label">Titre 4 (Paragraphe)</span>
                <span class="item-badge">####</span>
              </button>
            </div>
          {/if}
        </div>

        <!-- Menu Déroulant 2 : Format & Style -->
        <div class="tb-dropdown" class:open={activeToolbarMenu === 'format'}>
          <button
            type="button"
            class="tb-dropdown-btn"
            onmousedown={(e) => e.preventDefault()}
            onclick={(e) => { e.stopPropagation(); toggleToolbarMenu('format'); }}
            title="Styles de texte et typographie"
          >
            <span class="btn-icon">✍️</span>
            <span class="btn-label">Format</span>
            <span class="dropdown-caret">▾</span>
          </button>
          {#if activeToolbarMenu === 'format'}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div class="tb-dropdown-menu" onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('bold')}>
                <span class="item-icon bold-icon">B</span>
                <span class="item-label">Gras</span>
                <span class="item-badge">Ctrl+B</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('italic')}>
                <span class="item-icon italic-icon">I</span>
                <span class="item-label">Italique</span>
                <span class="item-badge">Ctrl+I</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('strike')}>
                <span class="item-icon strike-icon">S</span>
                <span class="item-label">Barré</span>
                <span class="item-badge">~~</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('highlight')}>
                <span class="item-icon mark-icon">H</span>
                <span class="item-label">Surligné</span>
                <span class="item-badge">==</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('inline-code')}>
                <span class="item-icon code-icon">&lt;/&gt;</span>
                <span class="item-label">Code en ligne</span>
                <span class="item-badge">`code`</span>
              </button>
              <div class="tb-menu-divider"></div>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('undo')}>
                <span class="item-icon">↩️</span>
                <span class="item-label">Annuler</span>
                <span class="item-badge">Ctrl+Z</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('redo')}>
                <span class="item-icon">↪️</span>
                <span class="item-label">Rétablir</span>
                <span class="item-badge">Ctrl+Y</span>
              </button>
            </div>
          {/if}
        </div>

        <!-- Menu Déroulant 3 : Listes -->
        <div class="tb-dropdown" class:open={activeToolbarMenu === 'lists'}>
          <button
            type="button"
            class="tb-dropdown-btn"
            onmousedown={(e) => e.preventDefault()}
            onclick={(e) => { e.stopPropagation(); toggleToolbarMenu('lists'); }}
            title="Listes à puces, numérotées et tâches"
          >
            <span class="btn-icon">☰</span>
            <span class="btn-label">Listes</span>
            <span class="dropdown-caret">▾</span>
          </button>
          {#if activeToolbarMenu === 'lists'}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div class="tb-dropdown-menu" onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('bullet-list')}>
                <span class="item-icon">☰</span>
                <span class="item-label">Liste à puces</span>
                <span class="item-badge">- texte</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('number-list')}>
                <span class="item-icon">🔢</span>
                <span class="item-label">Liste numérotée</span>
                <span class="item-badge">1. texte</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('task-list')}>
                <span class="item-icon">☑</span>
                <span class="item-label">Liste de tâches (Checklist)</span>
                <span class="item-badge">- [ ]</span>
              </button>
            </div>
          {/if}
        </div>

        <!-- Menu Déroulant 4 : Blocs & JdR -->
        <div class="tb-dropdown" class:open={activeToolbarMenu === 'blocks'}>
          <button
            type="button"
            class="tb-dropdown-btn"
            onmousedown={(e) => e.preventDefault()}
            onclick={(e) => { e.stopPropagation(); toggleToolbarMenu('blocks'); }}
            title="Blocs de texte, Callouts MJ et tables"
          >
            <span class="btn-icon">🎲</span>
            <span class="btn-label">Blocs &amp; JdR</span>
            <span class="dropdown-caret">▾</span>
          </button>
          {#if activeToolbarMenu === 'blocks'}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div class="tb-dropdown-menu" onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
              <div class="tb-menu-header">Boîtes de Jeu &amp; Callouts</div>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('callout')}>
                <span class="item-icon">💡</span>
                <span class="item-label">Boîte Note / Indice</span>
                <span class="item-badge">&gt; [!NOTE]</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('secret')}>
                <span class="item-icon">🔒</span>
                <span class="item-label">Secret &amp; Piège MJ</span>
                <span class="item-badge">&gt; [!SECRET]</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('readaloud')}>
                <span class="item-icon">🗣️</span>
                <span class="item-label">Récit MJ à voix haute</span>
                <span class="item-badge">&gt; 🗣️</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('statblock')}>
                <span class="item-icon">⚔️</span>
                <span class="item-label">Fiche Stats PNJ / Monstre</span>
                <span class="item-badge">Statblock</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('rolltable')}>
                <span class="item-icon">🎲</span>
                <span class="item-label">Table aléatoire d6</span>
                <span class="item-badge">Table d6</span>
              </button>
              <div class="tb-menu-divider"></div>
              <div class="tb-menu-header">Structures Markdown</div>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('quote')}>
                <span class="item-icon">❞</span>
                <span class="item-label">Citation</span>
                <span class="item-badge">&gt; texte</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('codeblock')}>
                <span class="item-icon">💻</span>
                <span class="item-label">Bloc de code</span>
                <span class="item-badge">```</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('hr')}>
                <span class="item-icon">―</span>
                <span class="item-label">Ligne séparatrice</span>
                <span class="item-badge">---</span>
              </button>
            </div>
          {/if}
        </div>

        <!-- Menu Déroulant 5 : Insérer -->
        <div class="tb-dropdown" class:open={activeToolbarMenu === 'insert'}>
          <button
            type="button"
            class="tb-dropdown-btn"
            onmousedown={(e) => e.preventDefault()}
            onclick={(e) => { e.stopPropagation(); toggleToolbarMenu('insert'); }}
            title="Liens, médias, tableaux et raccourcis"
          >
            <span class="btn-icon">🔗</span>
            <span class="btn-label">Insérer</span>
            <span class="dropdown-caret">▾</span>
          </button>
          {#if activeToolbarMenu === 'insert'}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div class="tb-dropdown-menu" onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
              <button type="button" class="tb-menu-item highlight-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('wikilink')}>
                <span class="item-icon">🔗</span>
                <span class="item-label">Rétrolien Grimoire</span>
                <span class="item-badge">[[Note]]</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('link')}>
                <span class="item-icon">🌐</span>
                <span class="item-label">Lien Web hypertexte</span>
                <span class="item-badge">[titre](url)</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('image')}>
                <span class="item-icon">🖼️</span>
                <span class="item-label">Image Markdown</span>
                <span class="item-badge">![alt](src)</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('table')}>
                <span class="item-icon">▦</span>
                <span class="item-label">Tableau Markdown</span>
                <span class="item-badge">| Col |</span>
              </button>
              <button type="button" class="tb-menu-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleFormatAction('comment')}>
                <span class="item-icon">👁️‍🗨️</span>
                <span class="item-label">Note invisible MJ</span>
                <span class="item-badge">%% note %%</span>
              </button>
              <div class="tb-menu-divider"></div>
              <button type="button" class="tb-menu-item help-item" onmousedown={(e) => e.preventDefault()} onclick={() => { showShortcutsModal = true; activeToolbarMenu = null; }}>
                <span class="item-icon">⌨️</span>
                <span class="item-label">Guide des raccourcis clavier</span>
                <span class="item-badge">Aide</span>
              </button>
            </div>
          {/if}
        </div>
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

    {#if getActiveFile()?.toLowerCase().endsWith('.pdf')}
      <PdfReaderModal
        localPath={`${getVaultPath()}/${getActiveFile()}`}
        fileName={getActiveFile()?.split('/').pop() || 'Livre PDF'}
        onclose={() => setActiveFile(null)}
      />
    {:else}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="editor-wrapper"
        class:split-view={viewMode === 'split'}
        class:read-mode={viewMode === 'read'}
        bind:this={editorWrapperEl}
        oncontextmenu={handleEditorContextMenu}
      >
        {#if showEditor}
          <CodeMirrorEditor
            value={getActiveContent()}
            scrollToLine={scrollToLine}
            onInput={(val) => {
              setActiveContent(val);
              setIsDirty(true);
              scheduleAutoSave(val);
              if (showPreview) markdownToHtml(val, false).then(h => { previewHtml = h; });
            }}
            onSave={() => {
              clearTimeout(saveTimeout);
              saveFile(true);
            }}
          />
        {/if}
        {#if showPreview}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="preview-panel"
            bind:this={previewPanelEl}
            onclick={handlePreviewClick}
          >
            {@html previewHtml}
          </div>
        {/if}
      </div>
    {/if}

    <div class="editor-statusbar">
      <span>{wordCount} mots</span>
      <span class="status-sep">·</span>
      <span>{charCount} caractères</span>
      <span class="status-sep">·</span>
      <button
        type="button"
        class="status-spell-btn"
        class:active={spellEnabled}
        onclick={cycleSpellcheck}
        title={spellEnabled ? `Correcteur actif (${spellLang === 'fr' ? 'Français' : 'Anglais'}). Cliquer pour alterner (FR → EN → Désactivé).` : "Correcteur désactivé. Cliquer pour activer."}
      >
        <span class="spell-dot" class:dot-active={spellEnabled}>●</span>
        <span>{spellEnabled ? `Orthographe ${spellLang.toUpperCase()}` : 'Orthographe off'}</span>
      </button>
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
        <div class="shortcut"><kbd>Ctrl</kbd>+<kbd>B</kbd> / <kbd>Ctrl</kbd>+<kbd>I</kbd> Gras / Italique</div>
        <div class="shortcut"><kbd>Ctrl</kbd>+<kbd>K</kbd> Lien wiki [[ ]]</div>
        <div class="shortcut"><kbd>Ctrl</kbd>+<kbd>J</kbd> Générer avec Ollama</div>
        <div class="shortcut"><kbd>Ctrl</kbd>+<kbd>Clic</kbd> Suivre un lien wiki</div>
      </div>
    </div>
  {/if}
</div>

{#if editorCtxMenu}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="editor-ctx-overlay" onclick={() => editorCtxMenu = null}></div>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="editor-ctx-menu"
    style="left: {editorCtxMenu.x}px; top: {editorCtxMenu.y}px;"
    onclick={e => e.stopPropagation()}
    role="menu"
    tabindex="-1"
  >
    <!-- Bandeau de styles rapides (Gras, Italique, Surligné, Barré, Code) -->
    <div class="editor-ctx-quick-row">
      <button type="button" class="ctx-quick-btn" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('bold')} title="Gras (Ctrl+B)">
        <span class="bold-icon">B</span>
      </button>
      <button type="button" class="ctx-quick-btn" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('italic')} title="Italique (Ctrl+I)">
        <span class="italic-icon">I</span>
      </button>
      <button type="button" class="ctx-quick-btn" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('highlight')} title="Surligné (==texte==)">
        <span class="mark-icon">H</span>
      </button>
      <button type="button" class="ctx-quick-btn" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('strike')} title="Barré (~~texte~~)">
        <span class="strike-icon">S</span>
      </button>
      <button type="button" class="ctx-quick-btn" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('inline-code')} title="Code en ligne (`code`)">
        <span class="code-icon">&lt;/&gt;</span>
      </button>
    </div>

    <div class="editor-ctx-sep"></div>

    <!-- Actions directes fréquentes -->
    <button type="button" class="editor-ctx-item highlight-gold" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('wikilink')}>
      <span class="ctx-icon">🔗</span>
      <span class="ctx-label">Rétrolien Grimoire</span>
      <span class="ctx-badge">[[Note]]</span>
    </button>
    <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('secret')}>
      <span class="ctx-icon">🔒</span>
      <span class="ctx-label">Secret &amp; Piège MJ</span>
      <span class="ctx-badge">&gt; [!SECRET]</span>
    </button>
    <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('callout')}>
      <span class="ctx-icon">💡</span>
      <span class="ctx-label">Boîte Note / Indice</span>
      <span class="ctx-badge">&gt; [!NOTE]</span>
    </button>
    <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('task-list')}>
      <span class="ctx-icon">☑</span>
      <span class="ctx-label">Tâche à cocher</span>
      <span class="ctx-badge">- [ ]</span>
    </button>

    <div class="editor-ctx-sep"></div>

    <!-- Sous-menu Titres -->
    <div class="editor-ctx-has-sub">
      <div class="editor-ctx-item">
        <span class="ctx-icon">🗛</span>
        <span class="ctx-label">Titres</span>
        <span class="ctx-arrow">▸</span>
      </div>
      <div class="editor-ctx-sub" class:open-left={editorCtxMenu.x > window.innerWidth - 450}>
        <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('h1')}>
          <span class="ctx-icon h-badge">H1</span>
          <span class="ctx-label">Titre 1 (Principal)</span>
          <span class="ctx-badge">#</span>
        </button>
        <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('h2')}>
          <span class="ctx-icon h-badge">H2</span>
          <span class="ctx-label">Titre 2 (Section)</span>
          <span class="ctx-badge">##</span>
        </button>
        <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('h3')}>
          <span class="ctx-icon h-badge">H3</span>
          <span class="ctx-label">Titre 3 (Sous-section)</span>
          <span class="ctx-badge">###</span>
        </button>
        <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('h4')}>
          <span class="ctx-icon h-badge">H4</span>
          <span class="ctx-label">Titre 4 (Paragraphe)</span>
          <span class="ctx-badge">####</span>
        </button>
      </div>
    </div>

    <!-- Sous-menu Listes -->
    <div class="editor-ctx-has-sub">
      <div class="editor-ctx-item">
        <span class="ctx-icon">☰</span>
        <span class="ctx-label">Listes</span>
        <span class="ctx-arrow">▸</span>
      </div>
      <div class="editor-ctx-sub" class:open-left={editorCtxMenu.x > window.innerWidth - 450}>
        <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('bullet-list')}>
          <span class="ctx-icon">☰</span>
          <span class="ctx-label">Liste à puces</span>
          <span class="ctx-badge">- texte</span>
        </button>
        <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('number-list')}>
          <span class="ctx-icon">🔢</span>
          <span class="ctx-label">Liste numérotée</span>
          <span class="ctx-badge">1. texte</span>
        </button>
        <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('task-list')}>
          <span class="ctx-icon">☑</span>
          <span class="ctx-label">Liste de tâches</span>
          <span class="ctx-badge">- [ ]</span>
        </button>
      </div>
    </div>

    <!-- Sous-menu Blocs & JdR -->
    <div class="editor-ctx-has-sub">
      <div class="editor-ctx-item">
        <span class="ctx-icon">🎲</span>
        <span class="ctx-label">Blocs &amp; JdR</span>
        <span class="ctx-arrow">▸</span>
      </div>
      <div class="editor-ctx-sub" class:open-left={editorCtxMenu.x > window.innerWidth - 450}>
        <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('readaloud')}>
          <span class="ctx-icon">🗣️</span>
          <span class="ctx-label">Récit MJ à voix haute</span>
          <span class="ctx-badge">&gt; 🗣️</span>
        </button>
        <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('statblock')}>
          <span class="ctx-icon">⚔️</span>
          <span class="ctx-label">Fiche Stats PNJ</span>
          <span class="ctx-badge">Statblock</span>
        </button>
        <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('rolltable')}>
          <span class="ctx-icon">🎲</span>
          <span class="ctx-label">Table aléatoire d6</span>
          <span class="ctx-badge">Table d6</span>
        </button>
        <div class="editor-ctx-sep"></div>
        <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('quote')}>
          <span class="ctx-icon">❞</span>
          <span class="ctx-label">Citation</span>
          <span class="ctx-badge">&gt; texte</span>
        </button>
        <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('codeblock')}>
          <span class="ctx-icon">💻</span>
          <span class="ctx-label">Bloc de code</span>
          <span class="ctx-badge">```</span>
        </button>
        <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('hr')}>
          <span class="ctx-icon">―</span>
          <span class="ctx-label">Ligne séparatrice</span>
          <span class="ctx-badge">---</span>
        </button>
      </div>
    </div>

    <!-- Sous-menu Insérer -->
    <div class="editor-ctx-has-sub">
      <div class="editor-ctx-item">
        <span class="ctx-icon">📎</span>
        <span class="ctx-label">Insérer</span>
        <span class="ctx-arrow">▸</span>
      </div>
      <div class="editor-ctx-sub" class:open-left={editorCtxMenu.x > window.innerWidth - 450}>
        <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('link')}>
          <span class="ctx-icon">🌐</span>
          <span class="ctx-label">Lien Web hypertexte</span>
          <span class="ctx-badge">[texte](url)</span>
        </button>
        <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('image')}>
          <span class="ctx-icon">🖼️</span>
          <span class="ctx-label">Image Markdown</span>
          <span class="ctx-badge">![alt](src)</span>
        </button>
        <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('table')}>
          <span class="ctx-icon">▦</span>
          <span class="ctx-label">Tableau Markdown</span>
          <span class="ctx-badge">| Col |</span>
        </button>
        <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('comment')}>
          <span class="ctx-icon">👁️‍🗨️</span>
          <span class="ctx-label">Note invisible MJ</span>
          <span class="ctx-badge">%% note %%</span>
        </button>
      </div>
    </div>

    <div class="editor-ctx-sep"></div>

    <!-- Sous-menu Assistant IA (Ollama) -->
    <div class="editor-ctx-has-sub">
      <div class="editor-ctx-item ai-ctx-item">
        <span class="ctx-icon">🪄</span>
        <span class="ctx-label">Assistant IA</span>
        <span class="ctx-arrow">▸</span>
      </div>
      <div class="editor-ctx-sub" class:open-left={editorCtxMenu.x > window.innerWidth - 450}>
        {#if editorCtxMenu.hasSelection}
          <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAI('describe')}>
            <span class="ctx-icon">🎭</span>
            <span class="ctx-label">Décrire la sélection</span>
          </button>
          <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAI('dialogue')}>
            <span class="ctx-icon">🗣️</span>
            <span class="ctx-label">Générer 3 dialogues</span>
          </button>
          <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAI('sensory')}>
            <span class="ctx-icon">📜</span>
            <span class="ctx-label">Ajouter détails sensoriels</span>
          </button>
          <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAI('stats')}>
            <span class="ctx-icon">⚔️</span>
            <span class="ctx-label">Générer bloc de stats</span>
          </button>
          <div class="editor-ctx-sep"></div>
        {/if}
        <button type="button" class="editor-ctx-item highlight-gold" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAI('menu')}>
          <span class="ctx-icon">⚡</span>
          <span class="ctx-label">Menu IA complet</span>
          <span class="ctx-badge">Ctrl+J</span>
        </button>
      </div>
    </div>

    <div class="editor-ctx-sep"></div>

    <!-- Sous-menu Diffusion Joueurs (TV & Mobiles) -->
    <div class="editor-ctx-has-sub">
      <div class="editor-ctx-item ctx-share-item">
        <span class="ctx-icon">📤</span>
        <span class="ctx-label">Diffuser aux Joueurs</span>
        <span class="ctx-arrow">▸</span>
      </div>
      <div class="editor-ctx-sub" class:open-left={editorCtxMenu.x > window.innerWidth - 450}>
        {#if editorCtxMenu.hasSelection}
          <button type="button" class="editor-ctx-item highlight-gold" onmousedown={(e) => e.preventDefault()} onclick={() => shareSelectionDirect('all', 'parchment')}>
            <span class="ctx-icon">🌐</span>
            <span class="ctx-label">Projeter sélection (TV &amp; Mobiles)</span>
          </button>
          <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => shareSelectionDirect('playerView', 'parchment')}>
            <span class="ctx-icon">📺</span>
            <span class="ctx-label">Vue Joueur (Parchemin TV)</span>
          </button>
          <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => shareSelectionDirect('mobile', 'parchment')}>
            <span class="ctx-icon">📱</span>
            <span class="ctx-label">Smartphones Joueurs</span>
          </button>
          <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => shareSelectionDirect('playerView', 'ambient')}>
            <span class="ctx-icon">✨</span>
            <span class="ctx-label">Texte d'Ambiance Flottant</span>
          </button>
          <div class="editor-ctx-sep"></div>
        {/if}
        <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={openShareModalForNote}>
          <span class="ctx-icon">⚙️</span>
          <span class="ctx-label">Options de diffusion note…</span>
        </button>
      </div>
    </div>

    <div class="editor-ctx-sep"></div>

    <!-- Actions d'édition classiques -->
    <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('undo')}>
      <span class="ctx-icon">↩️</span>
      <span class="ctx-label">Annuler</span>
      <span class="ctx-badge">Ctrl+Z</span>
    </button>
    <button type="button" class="editor-ctx-item" onmousedown={(e) => e.preventDefault()} onclick={() => handleCtxAction('redo')}>
      <span class="ctx-icon">↪️</span>
      <span class="ctx-label">Rétablir</span>
      <span class="ctx-badge">Ctrl+Y</span>
    </button>
  </div>
{/if}

{#if showShortcutsModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="shortcuts-modal-backdrop" onclick={() => showShortcutsModal = false} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="shortcuts-modal-content" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <div class="shortcuts-modal-header">
        <div class="modal-title-wrap">
          <span class="modal-header-icon">⌨️</span>
          <h3>Guide des Raccourcis de Grimoire</h3>
        </div>
        <button type="button" class="shortcuts-modal-close" onclick={() => showShortcutsModal = false} title="Fermer (Échap)">✕</button>
      </div>
      <div class="shortcuts-modal-body">
        <div class="shortcuts-grid">
          <div class="shortcuts-section">
            <h4>✍️ Édition & Formatage Markdown</h4>
            <table class="shortcuts-table">
              <tbody>
                <tr><td><kbd>Ctrl</kbd> + <kbd>B</kbd></td><td>Gras (<strong>texte</strong>)</td></tr>
                <tr><td><kbd>Ctrl</kbd> + <kbd>I</kbd></td><td>Italique (<em>texte</em>)</td></tr>
                <tr><td><kbd>Ctrl</kbd> + <kbd>K</kbd></td><td>Rétrolien Grimoire [[Note]]</td></tr>
                <tr><td><kbd>Ctrl</kbd> + <kbd>Z</kbd></td><td>Annuler la dernière action</td></tr>
                <tr><td><kbd>Ctrl</kbd> + <kbd>Y</kbd></td><td>Rétablir l'action annulée</td></tr>
                <tr><td><kbd>Ctrl</kbd> + <kbd>S</kbd></td><td>Sauvegarder immédiatement</td></tr>
                <tr><td><kbd>Tab</kbd></td><td>Indenter (paragraphe, puce, liste)</td></tr>
                <tr><td><kbd>Shift</kbd> + <kbd>Tab</kbd></td><td>Désindenter le paragraphe</td></tr>
              </tbody>
            </table>
          </div>
          <div class="shortcuts-section">
            <h4>🗺️ Navigation, IA & Mode Jeu</h4>
            <table class="shortcuts-table">
              <tbody>
                <tr><td><kbd>Ctrl</kbd> + <kbd>P</kbd></td><td>Palette de commande & recherche</td></tr>
                <tr><td><kbd>Ctrl</kbd> + <kbd>F</kbd></td><td>Rechercher dans la note active</td></tr>
                <tr><td><kbd>Ctrl</kbd> + <kbd>H</kbd></td><td>Rechercher & Remplacer</td></tr>
                <tr><td><kbd>Ctrl</kbd> + <kbd>J</kbd></td><td>Génération IA locale (Ollama)</td></tr>
                <tr><td><kbd>F11</kbd> / <kbd>Échap</kbd></td><td>Activer / Quitter le mode Zen</td></tr>
                <tr><td><kbd>Ctrl</kbd> + Clic</td><td>Suivre un [[lien]] ou carte VTT</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="shortcuts-footer-tip">
          💡 <strong>Astuce :</strong> Vous pouvez également afficher ou masquer la barre de raccourcis à tout moment avec le bouton plume <span class="tip-icon">🖋️</span> dans l'en-tête de l'éditeur.
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showShareModal}
  <ShareToPlayersModal
    rawContent={shareModalContent}
    defaultTitle={shareModalTitle}
    onclose={() => showShareModal = false}
  />
{/if}

<style>
  /* ── Markdown Formatting Toolbar ───────────────────────────── */

  .markdown-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    user-select: none;
    position: relative;
    z-index: 100;
  }

  .toolbar-group {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .toolbar-divider {
    width: 1px;
    height: 18px;
    background: var(--border);
    margin: 0 4px;
    flex-shrink: 0;
  }

  .tool-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    padding: 3px 6px;
    min-height: 26px;
    min-width: 26px;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .tool-btn:hover {
    background: var(--bg-hover);
    color: var(--accent);
    border-color: rgba(229, 168, 83, 0.3);
  }

  .tool-btn:active {
    background: var(--accent-bg);
    transform: translateY(1px);
  }

  .btn-icon {
    font-size: 12px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .btn-label {
    font-size: 12px;
    font-weight: 500;
  }

  .bold-icon {
    font-weight: 800;
    font-family: serif;
    font-size: 13px;
  }

  .italic-icon {
    font-style: italic;
    font-family: serif;
    font-size: 13px;
    padding-right: 1px;
  }

  .strike-icon {
    text-decoration: line-through;
    font-size: 12px;
    font-weight: 600;
  }

  .mark-icon {
    background: rgba(229, 168, 83, 0.35);
    color: var(--accent);
    border-radius: 2px;
    padding: 0 3px;
    font-size: 11px;
    font-weight: 700;
  }

  .code-icon {
    font-family: monospace;
    font-size: 11px;
    color: #38bdf8;
  }

  /* ── Dropdowns de la barre de raccourcis ──────────────────────── */

  .tb-dropdown {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .tb-dropdown-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    padding: 3px 8px;
    min-height: 26px;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .tb-dropdown-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: rgba(229, 168, 83, 0.3);
  }

  .tb-dropdown.open .tb-dropdown-btn {
    background: rgba(229, 168, 83, 0.14);
    color: var(--accent);
    border-color: rgba(229, 168, 83, 0.45);
    box-shadow: 0 0 6px rgba(229, 168, 83, 0.2);
  }

  .dropdown-caret {
    font-size: 9px;
    opacity: 0.7;
    margin-left: 2px;
    transition: transform 0.15s ease;
  }

  .tb-dropdown.open .dropdown-caret {
    transform: rotate(180deg);
  }

  .tb-dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 230px;
    background: #161b22;
    border: 1px solid rgba(229, 168, 83, 0.35);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65);
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    z-index: 1050;
    animation: slideDown 0.12s ease-out;
  }

  .tb-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    border-radius: 4px;
    padding: 5px 8px;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .tb-menu-item:hover {
    background: rgba(229, 168, 83, 0.12);
    color: var(--accent);
  }

  .tb-menu-item:active {
    transform: translateX(1px);
  }

  .item-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    font-size: 13px;
    flex-shrink: 0;
  }

  .item-label {
    flex: 1;
    white-space: nowrap;
  }

  .item-badge {
    font-size: 10px;
    font-family: monospace;
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.05);
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .h-badge {
    font-family: monospace;
    font-weight: 700;
    font-size: 11px;
    color: var(--accent);
  }

  .tb-menu-divider {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }

  .tb-menu-header {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    padding: 4px 8px 2px 8px;
    font-weight: 600;
  }

  .highlight-item:hover {
    color: #fbbf24;
    background: rgba(245, 158, 11, 0.16);
  }

  .help-item {
    color: #38bdf8;
  }

  .help-item:hover {
    background: rgba(56, 189, 248, 0.15);
    color: #7dd3fc;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Modal Guide des Raccourcis Clavier ─────────────────────── */

  .shortcuts-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    animation: fadeIn 0.15s ease-out;
  }

  .shortcuts-modal-content {
    background: var(--bg-secondary);
    border: 1px solid rgba(229, 168, 83, 0.4);
    border-radius: 10px;
    width: min(720px, 94vw);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(229, 168, 83, 0.15);
    overflow: hidden;
  }

  .shortcuts-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
  }

  .modal-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .modal-header-icon {
    font-size: 18px;
  }

  .shortcuts-modal-header h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--accent);
  }

  .shortcuts-modal-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 16px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .shortcuts-modal-close:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .shortcuts-modal-body {
    padding: 18px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .shortcuts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
  }

  .shortcuts-section {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
  }

  .shortcuts-section h4 {
    margin: 0 0 10px 0;
    font-size: 13px;
    color: var(--accent);
    font-weight: 600;
    border-bottom: 1px solid rgba(229, 168, 83, 0.2);
    padding-bottom: 6px;
  }

  .shortcuts-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .shortcuts-table tr {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .shortcuts-table tr:last-child {
    border-bottom: none;
  }

  .shortcuts-table td {
    padding: 6px 4px;
    color: var(--text-secondary);
  }

  .shortcuts-table td:first-child {
    white-space: nowrap;
    width: 45%;
  }

  .shortcuts-table kbd {
    background: #0d1117;
    border: 1px solid rgba(229, 168, 83, 0.35);
    border-radius: 3px;
    padding: 1px 5px;
    font-family: monospace;
    font-size: 11px;
    color: #fbbf24;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .shortcuts-footer-tip {
    font-size: 12px;
    color: var(--text-muted);
    background: rgba(229, 168, 83, 0.08);
    border: 1px dashed rgba(229, 168, 83, 0.3);
    border-radius: 6px;
    padding: 8px 12px;
  }

  .shortcuts-footer-tip .tip-icon {
    font-size: 13px;
    vertical-align: middle;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* ── Preview Callouts & Styling ────────────────────────────── */

  .preview-panel :global(.preview-callout) {
    background: rgba(229, 168, 83, 0.08);
    border-left: 4px solid var(--accent);
    border-radius: 4px;
    padding: 10px 14px;
    margin: 1em 0;
  }

  .preview-panel :global(.preview-callout.callout-warning) {
    background: rgba(239, 68, 68, 0.1);
    border-left-color: var(--danger);
  }

  .preview-panel :global(.preview-callout.callout-tip) {
    background: rgba(34, 197, 94, 0.1);
    border-left-color: var(--success);
  }

  .preview-panel :global(.callout-header) {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-primary);
  }

  .preview-panel :global(.callout-share-btn) {
    margin-left: auto;
    background: rgba(229, 168, 83, 0.15);
    border: 1px solid rgba(229, 168, 83, 0.4);
    color: #e5a853;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preview-panel :global(.callout-share-btn:hover) {
    background: rgba(229, 168, 83, 0.35);
    border-color: #e5a853;
    color: #fff;
    box-shadow: 0 0 8px rgba(229, 168, 83, 0.4);
  }

  .preview-panel :global(mark) {
    background: rgba(229, 168, 83, 0.35);
    color: inherit;
    padding: 1px 4px;
    border-radius: 3px;
  }

  .preview-panel :global(del) {
    color: var(--text-muted);
    text-decoration: line-through;
  }

  .preview-panel :global(a:not(.wikilink)) {
    color: #38bdf8;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
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

  .save-btn.share-broadcast-btn {
    border-color: rgba(229, 168, 83, 0.4);
    color: #e5a853;
  }
  .save-btn.share-broadcast-btn:hover {
    background: rgba(229, 168, 83, 0.15);
    border-color: #e5a853;
    color: #f59e0b;
    box-shadow: 0 0 8px rgba(229, 168, 83, 0.3);
  }

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
  .editor-wrapper.read-mode {
    justify-content: center;
    background: var(--bg-primary);
  }
  .editor-wrapper.read-mode .preview-panel {
    border-left: none;
    max-width: 860px;
    padding: 32px 48px;
    background: var(--bg-primary);
  }

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
  .preview-panel :global(.preview-list) { padding-left: 24px; margin: 0.8em 0; }
  .preview-panel :global(.checklist-item) { display: flex; gap: 8px; align-items: baseline; padding: 2px 0; font-size: 14px; }
  .preview-panel :global(.checklist-item .check-box) { font-size: 16px; flex-shrink: 0; color: var(--text-muted); }
  .preview-panel :global(.checklist-item.done) { color: var(--text-muted); text-decoration: line-through; }
  .preview-panel :global(.checklist-item.done .check-box) { color: #22c55e; }
  .preview-panel :global(li) { margin: 3px 0; padding-left: 4px; }
  .preview-panel :global(.wikilink) { color: var(--accent); text-decoration: none; border-bottom: 1px dashed var(--accent); cursor: pointer; }
  .preview-panel :global(.wikilink:hover) { background: rgba(229,168,83,0.12); border-radius: 2px; }
  .preview-panel :global(.preview-callout) {
    border-left: 4px solid var(--accent);
    border-radius: 6px;
    padding: 10px 14px;
    margin: 1.2em 0;
    background: rgba(229, 168, 83, 0.08);
  }
  .preview-panel :global(.callout-header) {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .preview-panel :global(.callout-content) {
    font-size: 13.5px;
    line-height: 1.65;
  }
  .preview-panel :global(.callout-content p) {
    margin: 4px 0;
  }
  .preview-panel :global(.preview-dice-btn) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: linear-gradient(135deg, rgba(229, 168, 83, 0.15), rgba(217, 119, 6, 0.25));
    border: 1px solid rgba(229, 168, 83, 0.45);
    border-radius: 5px;
    padding: 1px 7px;
    margin: 0 2px;
    font-size: 0.9em;
    font-weight: 600;
    color: #fbbf24;
    cursor: pointer;
    vertical-align: baseline;
    transition: all 0.15s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
  .preview-panel :global(.preview-dice-btn:hover) {
    background: linear-gradient(135deg, rgba(229, 168, 83, 0.3), rgba(217, 119, 6, 0.45));
    border-color: #fbbf24;
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(245, 158, 11, 0.3);
  }
  .preview-panel :global(.preview-gm-comment) {
    background: rgba(147, 51, 234, 0.15);
    border: 1px dashed rgba(147, 51, 234, 0.4);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 0.88em;
    color: #c084fc;
  }

  .view-mode-group {
    display: inline-flex;
    align-items: center;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 1px;
    gap: 1px;
  }

  .mode-btn {
    border: none !important;
    border-radius: 3px !important;
    padding: 2px 6px !important;
    font-size: 11px !important;
    min-height: 22px !important;
    min-width: 24px !important;
  }

  .mode-btn.active {
    background: var(--accent-bg) !important;
    color: var(--accent) !important;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

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

  .status-spell-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    padding: 1px 6px;
    color: var(--text-muted);
    font-size: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .status-spell-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .status-spell-btn.active {
    color: var(--accent);
    border-color: rgba(229, 168, 83, 0.3);
    background: rgba(229, 168, 83, 0.08);
  }

  .spell-dot {
    font-size: 8px;
    color: var(--text-muted);
    transition: color 0.15s;
  }
  .spell-dot.dot-active {
    color: #22c55e;
  }

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

  /* ── Zen Mode ──────────────────────────────────────────────── */
  .editor-container.zen-mode {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1200;
    background: var(--bg-primary, #0f1117);
  }

  .editor-container.zen-mode .editor-header {
    padding: 10px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(15, 17, 23, 0.95);
  }

  .zen-exit-btn {
    position: fixed;
    top: 12px;
    right: 18px;
    z-index: 1300;
    background: rgba(229, 168, 83, 0.15);
    border: 1px solid rgba(229, 168, 83, 0.4);
    color: var(--accent, #e5a853);
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all 0.15s ease;
  }

  .zen-exit-btn:hover {
    background: rgba(229, 168, 83, 0.3);
    border-color: var(--accent, #e5a853);
    transform: translateY(-1px);
  }

  /* ── Ambiance Pill ─────────────────────────────────────────── */
  .ambiance-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.35);
    border-radius: 12px;
    padding: 2px 10px;
    font-size: 11px;
    font-weight: 600;
    color: #38bdf8;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
  }

  .ambiance-pill:hover {
    background: rgba(56, 189, 248, 0.2);
    border-color: #38bdf8;
    transform: translateY(-1px);
  }

  .ambiance-pill.playing {
    background: rgba(34, 197, 94, 0.15);
    border-color: #22c55e;
    color: #4ade80;
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.2);
  }

  .ambiance-badge {
    background: rgba(0, 0, 0, 0.25);
    padding: 1px 6px;
    border-radius: 8px;
    font-size: 10px;
  }

  /* ── Global Dice Popup Tooltip ─────────────────────────────── */
  :global(.cm-dice-popup) {
    position: fixed;
    z-index: 2500;
    background: #141720;
    border: 1px solid rgba(229, 168, 83, 0.5);
    border-radius: 8px;
    padding: 8px 14px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(229, 168, 83, 0.2);
    min-width: 170px;
    animation: cmDicePop 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    font-family: inherit;
    pointer-events: auto;
  }

  :global(.dice-popup-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }

  :global(.dice-popup-title) {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted, #8899b7);
    text-transform: uppercase;
  }

  :global(.dice-popup-total) {
    font-size: 18px;
    font-weight: 800;
    color: #fbbf24;
  }

  :global(.dice-popup-details) {
    font-size: 11px;
    color: var(--text-secondary, #94a3b8);
    margin-bottom: 8px;
  }

  :global(.dice-popup-actions) {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  :global(.dice-btn-insert) {
    background: rgba(229, 168, 83, 0.15);
    border: 1px solid rgba(229, 168, 83, 0.35);
    color: #fbbf24;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  :global(.dice-btn-insert:hover) {
    background: rgba(229, 168, 83, 0.3);
    border-color: #fbbf24;
  }

  :global(.dice-btn-close) {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 13px;
    cursor: pointer;
    padding: 2px 4px;
  }

  :global(.dice-crit) {
    color: #4ade80 !important;
    font-size: 11px;
    font-weight: 800;
  }

  :global(.dice-fumble) {
    color: #f87171 !important;
    font-size: 11px;
    font-weight: 800;
  }

  @keyframes cmDicePop {
    from { opacity: 0; transform: scale(0.92) translateY(6px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  /* ── Menu Contextuel Clic Droit dans l'Éditeur ─────────────── */

  .editor-ctx-overlay {
    position: fixed;
    inset: 0;
    z-index: 1200;
  }

  .editor-ctx-menu {
    position: fixed;
    z-index: 1201;
    background: #161b22;
    border: 1px solid rgba(229, 168, 83, 0.4);
    border-radius: 8px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.8), 0 0 14px rgba(229, 168, 83, 0.15);
    padding: 6px;
    min-width: 225px;
    user-select: none;
    animation: slideDown 0.1s ease-out;
  }

  .editor-ctx-quick-row {
    display: flex;
    gap: 4px;
    padding: 2px 2px 4px 2px;
  }

  .ctx-quick-btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .ctx-quick-btn:hover {
    background: rgba(229, 168, 83, 0.15);
    border-color: var(--accent);
    color: var(--accent);
  }

  .ctx-quick-btn:active {
    background: var(--accent-bg);
    transform: translateY(1px);
  }

  .editor-ctx-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    border-radius: 4px;
    padding: 5px 8px;
    color: var(--text-secondary);
    font-size: 12.5px;
    cursor: pointer;
    transition: all 0.12s ease;
    box-sizing: border-box;
    text-decoration: none;
  }

  .editor-ctx-item:hover {
    background: rgba(229, 168, 83, 0.12);
    color: var(--accent);
  }

  .editor-ctx-item:active {
    transform: translateX(1px);
  }

  .editor-ctx-has-sub {
    position: relative;
  }

  .editor-ctx-has-sub:hover > .editor-ctx-sub {
    display: flex;
  }

  .editor-ctx-sub {
    display: none;
    position: absolute;
    top: -4px;
    left: calc(100% + 2px);
    min-width: 200px;
    background: #161b22;
    border: 1px solid rgba(229, 168, 83, 0.35);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.75);
    padding: 4px;
    flex-direction: column;
    gap: 2px;
    z-index: 1202;
    animation: slideDown 0.1s ease-out;
  }

  .editor-ctx-sub.open-left {
    left: auto;
    right: calc(100% + 2px);
  }

  .ctx-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    font-size: 13px;
    flex-shrink: 0;
  }

  .ctx-label {
    flex: 1;
    white-space: nowrap;
  }

  .ctx-arrow {
    margin-left: auto;
    font-size: 9px;
    color: var(--text-muted);
    opacity: 0.8;
  }

  .ctx-badge {
    margin-left: auto;
    font-size: 10px;
    font-family: monospace;
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.05);
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .editor-ctx-sep {
    height: 1px;
    background: var(--border);
    margin: 4px 2px;
  }

  .ai-ctx-item {
    color: #38bdf8;
  }

  .ai-ctx-item:hover {
    background: rgba(56, 189, 248, 0.15) !important;
    color: #7dd3fc !important;
  }
</style>
