<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorState } from '@codemirror/state';
  import { EditorView, keymap, highlightActiveLine, lineNumbers, hoverTooltip, WidgetType, MatchDecorator, ViewPlugin, Decoration } from '@codemirror/view';
  import type { DecorationSet, ViewUpdate } from '@codemirror/view';
  import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
  import { markdown } from '@codemirror/lang-markdown';
  import { autocompletion, CompletionContext, startCompletion } from '@codemirror/autocomplete';
  import { oneDark } from '@codemirror/theme-one-dark';
  import { searchVault, askOllama, readFile, writeFile, openVault, readFileBase64 } from '$lib/api';
  import { getAiModel, getAiSystemPrompt } from '$lib/stores/settings.svelte';
  import { getVaultPath, getVaultTree, setActiveFile, setActiveContent, setIsDirty, setVaultTree } from '$lib/stores/vault.svelte';

  let { value = '', scrollToLine = null, onInput = () => {}, onSave = () => {} }: {
    value: string;
    scrollToLine?: number | null;
    onInput: (val: string) => void;
    onSave: () => void;
  } = $props();

  let isGenerating = $state(false);

  let editorParent: HTMLDivElement;
  let view: EditorView;

  // ── Inline images ![[path.png]] ──────────────────────────────
  class InlineImageWidget extends WidgetType {
    path: string;
    constructor(path: string) { super(); this.path = path; }
    eq(other: InlineImageWidget) { return other.path === this.path; }
    toDOM() {
      const wrap = document.createElement('span');
      wrap.style.display = 'block';
      const img = document.createElement('img');
      img.alt = this.path;
      img.style.cssText = 'max-width:100%;max-height:280px;border-radius:6px;display:block;margin:4px 0;cursor:default';
      const vp = getVaultPath();
      if (vp) {
        readFileBase64(`${vp}/${this.path}`).then(b64 => {
          const ext = this.path.split('.').pop()?.toLowerCase() ?? 'png';
          const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`;
          img.src = `data:${mime};base64,${b64}`;
        }).catch(() => {
          img.style.display = 'none';
          wrap.appendChild(document.createTextNode(`⚠️ ${this.path}`));
        });
      }
      wrap.appendChild(img);
      return wrap;
    }
    ignoreEvent() { return false; }
  }

  const imgMatcher = new MatchDecorator({
    regexp: /!\[\[([^\]]+\.(png|jpg|jpeg|webp|gif))\]\]/gi,
    decoration: (match) => Decoration.widget({ widget: new InlineImageWidget(match[1]), side: 1 }),
  });

  // ── Checkbox widget [ ] / [x] ────────────────────────────────
  class CheckboxWidget extends WidgetType {
    checked: boolean; from: number;
    constructor(checked: boolean, from: number) { super(); this.checked = checked; this.from = from; }
    eq(other: CheckboxWidget) { return other.checked === this.checked; }
    toDOM(view: EditorView) {
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = this.checked;
      box.style.cssText = 'cursor:pointer;vertical-align:middle;margin-right:4px;accent-color:#e5a853';
      box.addEventListener('mousedown', e => {
        e.preventDefault();
        // this.from est capturé une seule fois à la construction du widget et devient
        // périmé si du texte est édité plus tôt dans le document (MatchDecorator ne
        // remappe que la position d'affichage de la décoration, pas ce champ interne).
        // posAtDOM() lit la position réelle du widget dans le document au moment du clic.
        const from = view.posAtDOM(box);
        const doc = view.state.doc;
        const line = doc.lineAt(from);
        const text = line.text;
        const newText = this.checked
          ? text.replace(/\[x\]/i, '[ ]')
          : text.replace(/\[ \]/, '[x]');
        view.dispatch({ changes: { from: line.from, to: line.to, insert: newText } });
      });
      return box;
    }
    ignoreEvent() { return false; }
  }

  const checkboxMatcher = new MatchDecorator({
    regexp: /^(\s*[-*]\s+)(\[[ x]\])/gim,
    decoration: (match, view, pos) => {
      const checked = match[2].toLowerCase() === '[x]';
      return Decoration.replace({ widget: new CheckboxWidget(checked, pos + match[1].length) });
    },
  });

  const checkboxPlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) { this.decorations = checkboxMatcher.createDeco(view); }
      update(update: ViewUpdate) { this.decorations = checkboxMatcher.updateDeco(update, this.decorations); }
    },
    { decorations: (v) => v.decorations }
  );

  const inlineImagesPlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) { this.decorations = imgMatcher.createDeco(view); }
      update(update: ViewUpdate) { this.decorations = imgMatcher.updateDeco(update, this.decorations); }
    },
    { decorations: (v) => v.decorations }
  );

  // Autocompletion pour les liens wiki [[...]]
  async function wikiLinkCompletions(context: CompletionContext) {
    let word = context.matchBefore(/\[\[([^\]|]*)/);
    if (!word) return null;

    let query = word.text.replace('[[', '').trim();
    let results = [];
    
    try {
      if (query.length > 0) {
        // Recherche FTS5 pour les requêtes avec texte
        results = await searchVault(query + '*', 15);
      } else {
        // Si vide, on propose les fichiers du vault localement
        const tree = getVaultTree();
        
        const flatten = (entries: any[], parent = ''): any[] => {
          let flat: any[] = [];
          for (const e of entries) {
            if (e.is_dir && e.children) {
              flat = [...flat, ...flatten(e.children, parent + e.name + '/')];
            } else if (e.extension === 'md') {
              flat.push({
                path: parent + e.name,
                title: e.name.replace('.md', ''),
                entity_type: 'note',
                snippet: ''
              });
            }
          }
          return flat;
        };
        
        results = flatten(tree).slice(0, 15);
      }
    } catch (e) {
      console.error("Autocomplete search error", e);
    }

    return {
      from: word.from + 2,
      options: results.map(r => {
        // Enlever l'extension .md
        const cleanPath = r.path.replace(/\.md$/, '');
        return {
          label: cleanPath,
          displayLabel: r.title,
          type: "keyword",
          detail: r.entity_type,
          info: r.snippet ? r.snippet.replace(/<\/?mark>/g, '') : '',
          apply: `${cleanPath}|${r.title}]]`
        };
      }),
      validFor: /^[\w\/\-]*$/
    };
  }

  const saveKeymap = keymap.of([
    {
      key: 'Mod-s',
      run: () => {
        onSave();
        return true;
      }
    }
  ]);

  function insertAtCursor(e: Event) {
    const text = (e as CustomEvent).detail?.text;
    if (!view || !text) return;
    const pos = view.state.selection.main.head;
    view.dispatch({ changes: { from: pos, insert: text }, selection: { anchor: pos + text.length } });
  }

  // ── Markdown Formatting Helpers ──────────────────────────────
  function toggleWrap(marker: string, placeholder: string) {
    if (!view) return;
    const { doc, selection } = view.state;
    const { from, to, empty } = selection.main;
    const mLen = marker.length;

    if (empty) {
      // Check if cursor is already directly inside marker pairs: **|**
      if (from >= mLen && to + mLen <= doc.length) {
        const before = doc.sliceString(from - mLen, from);
        const after = doc.sliceString(to, to + mLen);
        if (before === marker && after === marker) {
          view.dispatch({
            changes: { from: from - mLen, to: to + mLen, insert: '' },
            selection: { anchor: from - mLen }
          });
          return;
        }
      }
      const text = marker + placeholder + marker;
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + mLen, head: from + mLen + placeholder.length },
        scrollIntoView: true
      });
      return;
    }

    const selectedText = doc.sliceString(from, to);

    // Case 1: selection already starts and ends with marker
    if (selectedText.startsWith(marker) && selectedText.endsWith(marker) && selectedText.length >= mLen * 2) {
      const unwrapped = selectedText.slice(mLen, -mLen);
      view.dispatch({
        changes: { from, to, insert: unwrapped },
        selection: { anchor: from, head: from + unwrapped.length },
        scrollIntoView: true
      });
      return;
    }

    // Case 2: outer characters are the marker
    if (from >= mLen && to + mLen <= doc.length) {
      const before = doc.sliceString(from - mLen, from);
      const after = doc.sliceString(to, to + mLen);
      if (before === marker && after === marker) {
        view.dispatch({
          changes: { from: from - mLen, to: to + mLen, insert: selectedText },
          selection: { anchor: from - mLen, head: to - mLen },
          scrollIntoView: true
        });
        return;
      }
    }

    // Case 3: Wrap text cleanly (preserving any leading/trailing whitespace outside markers)
    const leadSpace = selectedText.match(/^\s*/)?.[0] ?? '';
    const trailSpace = selectedText.match(/\s*$/)?.[0] ?? '';
    const core = selectedText.slice(leadSpace.length, selectedText.length - trailSpace.length);

    if (!core) {
      const text = marker + placeholder + marker;
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + mLen, head: from + mLen + placeholder.length },
        scrollIntoView: true
      });
      return;
    }

    const wrapped = leadSpace + marker + core + marker + trailSpace;
    view.dispatch({
      changes: { from, to, insert: wrapped },
      selection: {
        anchor: from + leadSpace.length + mLen,
        head: from + leadSpace.length + mLen + core.length
      },
      scrollIntoView: true
    });
  }

  function toggleLinePrefix(prefix: string) {
    if (!view) return;
    const { doc, selection } = view.state;
    const { from, to } = selection.main;
    const startLine = doc.lineAt(from);
    const endLine = doc.lineAt(to);

    const changes = [];
    for (let l = startLine.number; l <= endLine.number; l++) {
      const line = doc.line(l);
      const text = line.text;
      const headingMatch = text.match(/^(#{1,6})\s*/);
      if (headingMatch) {
        const currentPrefix = headingMatch[0];
        if (currentPrefix.trim() === prefix.trim()) {
          // Toggle off
          changes.push({ from: line.from, to: line.from + currentPrefix.length, insert: '' });
        } else {
          // Change heading level
          changes.push({ from: line.from, to: line.from + currentPrefix.length, insert: prefix });
        }
      } else {
        changes.push({ from: line.from, to: line.from, insert: prefix });
      }
    }
    view.dispatch({ changes, scrollIntoView: true });
  }

  function toggleListPrefix(prefix: string) {
    if (!view) return;
    const { doc, selection } = view.state;
    const { from, to } = selection.main;
    const startLine = doc.lineAt(from);
    const endLine = doc.lineAt(to);

    const changes = [];
    for (let l = startLine.number; l <= endLine.number; l++) {
      const line = doc.line(l);
      const text = line.text;
      const listMatch = text.match(/^(\s*)([-*+]\s+(?:\[[ x]\]\s+)?|\d+\.\s+)/);
      if (listMatch) {
        const fullMatch = listMatch[0];
        const indent = listMatch[1];
        const currentMarker = fullMatch.slice(indent.length);
        if (currentMarker.trim() === prefix.trim()) {
          changes.push({ from: line.from + indent.length, to: line.from + fullMatch.length, insert: '' });
        } else {
          changes.push({ from: line.from + indent.length, to: line.from + fullMatch.length, insert: prefix });
        }
      } else {
        const indentMatch = text.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        changes.push({ from: line.from + indent.length, to: line.from + indent.length, insert: prefix });
      }
    }
    view.dispatch({ changes, scrollIntoView: true });
  }

  function toggleNumberedList() {
    if (!view) return;
    const { doc, selection } = view.state;
    const { from, to } = selection.main;
    const startLine = doc.lineAt(from);
    const endLine = doc.lineAt(to);

    let allNumbered = true;
    for (let l = startLine.number; l <= endLine.number; l++) {
      if (!/^\s*\d+\.\s+/.test(doc.line(l).text)) {
        allNumbered = false;
        break;
      }
    }

    const changes = [];
    let count = 1;
    for (let l = startLine.number; l <= endLine.number; l++) {
      const line = doc.line(l);
      const text = line.text;
      const listMatch = text.match(/^(\s*)([-*+]\s+(?:\[[ x]\]\s+)?|\d+\.\s+)/);
      if (allNumbered) {
        if (listMatch) {
          changes.push({ from: line.from + listMatch[1].length, to: line.from + listMatch[0].length, insert: '' });
        }
      } else {
        const prefix = `${count}. `;
        if (listMatch) {
          changes.push({ from: line.from + listMatch[1].length, to: line.from + listMatch[0].length, insert: prefix });
        } else {
          const indentMatch = text.match(/^(\s*)/);
          const indent = indentMatch ? indentMatch[1] : '';
          changes.push({ from: line.from + indent.length, to: line.from + indent.length, insert: prefix });
        }
        count++;
      }
    }
    view.dispatch({ changes, scrollIntoView: true });
  }

  function toggleBlockquote() {
    if (!view) return;
    const { doc, selection } = view.state;
    const { from, to } = selection.main;
    const startLine = doc.lineAt(from);
    const endLine = doc.lineAt(to);

    let allQuoted = true;
    for (let l = startLine.number; l <= endLine.number; l++) {
      if (!/^\s*>\s?/.test(doc.line(l).text)) {
        allQuoted = false;
        break;
      }
    }

    const changes = [];
    for (let l = startLine.number; l <= endLine.number; l++) {
      const line = doc.line(l);
      const match = line.text.match(/^(\s*)>\s?/);
      if (allQuoted) {
        if (match) {
          changes.push({ from: line.from + match[1].length, to: line.from + match[0].length, insert: '' });
        }
      } else {
        changes.push({ from: line.from, to: line.from, insert: '> ' });
      }
    }
    view.dispatch({ changes, scrollIntoView: true });
  }

  export function applyFormat(type: string) {
    if (!view) return;
    const state = view.state;
    const { doc, selection } = state;
    const { from, to, empty } = selection.main;
    const selectedText = doc.sliceString(from, to);

    switch (type) {
      case 'bold':
        toggleWrap('**', 'texte en gras');
        break;
      case 'italic':
        toggleWrap('*', 'texte en italique');
        break;
      case 'strike':
        toggleWrap('~~', 'texte barré');
        break;
      case 'highlight':
        toggleWrap('==', 'texte surligné');
        break;
      case 'inline-code':
        toggleWrap('`', 'code');
        break;
      case 'wikilink':
        if (empty) {
          const insertText = '[[Nouvelle Note]]';
          view.dispatch({
            changes: { from, to, insert: insertText },
            selection: { anchor: from + 2, head: from + 15 },
            scrollIntoView: true
          });
        } else if (selectedText.startsWith('[[') && selectedText.endsWith(']]')) {
          const unwrapped = selectedText.slice(2, -2);
          view.dispatch({
            changes: { from, to, insert: unwrapped },
            selection: { anchor: from, head: from + unwrapped.length },
            scrollIntoView: true
          });
        } else {
          view.dispatch({
            changes: { from, to, insert: `[[${selectedText}]]` },
            selection: { anchor: from + 2, head: to + 2 },
            scrollIntoView: true
          });
        }
        break;
      case 'link':
        if (empty) {
          const insertText = '[texte du lien](https://)';
          view.dispatch({
            changes: { from, to, insert: insertText },
            selection: { anchor: from + 1, head: from + 15 },
            scrollIntoView: true
          });
        } else {
          const insertText = `[${selectedText}](https://)`;
          view.dispatch({
            changes: { from, to, insert: insertText },
            selection: { anchor: from + selectedText.length + 3, head: from + selectedText.length + 11 },
            scrollIntoView: true
          });
        }
        break;
      case 'image':
        if (empty) {
          const insertText = '![Description](assets/image.png)';
          view.dispatch({
            changes: { from, to, insert: insertText },
            selection: { anchor: from + 2, head: from + 13 },
            scrollIntoView: true
          });
        } else {
          const insertText = `![${selectedText}](assets/image.png)`;
          view.dispatch({
            changes: { from, to, insert: insertText },
            selection: { anchor: from + selectedText.length + 4, head: from + selectedText.length + 20 },
            scrollIntoView: true
          });
        }
        break;
      case 'h1':
        toggleLinePrefix('# ');
        break;
      case 'h2':
        toggleLinePrefix('## ');
        break;
      case 'h3':
        toggleLinePrefix('### ');
        break;
      case 'bullet-list':
        toggleListPrefix('- ');
        break;
      case 'number-list':
        toggleNumberedList();
        break;
      case 'task-list':
        toggleListPrefix('- [ ] ');
        break;
      case 'quote':
        toggleBlockquote();
        break;
      case 'codeblock':
        if (empty) {
          const snippet = "\n```\ncode\n```\n";
          view.dispatch({
            changes: { from, to, insert: snippet },
            selection: { anchor: from + 5, head: from + 9 },
            scrollIntoView: true
          });
        } else {
          const snippet = `\n\`\`\`\n${selectedText}\n\`\`\`\n`;
          view.dispatch({
            changes: { from, to, insert: snippet },
            selection: { anchor: from + 5, head: from + 5 + selectedText.length },
            scrollIntoView: true
          });
        }
        break;
      case 'h4':
        toggleLinePrefix('#### ');
        break;
      case 'table': {
        const table = "\n| Colonne 1 | Colonne 2 | Colonne 3 |\n| --------- | --------- | --------- |\n| Élément 1 | Donnée A  | Donnée B  |\n| Élément 2 | Donnée C  | Donnée D  |\n\n";
        view.dispatch({
          changes: { from, to, insert: table },
          selection: { anchor: from + 3, head: from + 12 },
          scrollIntoView: true
        });
        break;
      }
      case 'rolltable': {
        const rTable = "\n| d6 | Rencontre / Tirage aléatoire |\n| :-: | ---------------------------- |\n| 1 | Embuscade ou danger immédiat |\n| 2 | Événement ou rencontre neutre |\n| 3 | Indice ou découverte étrange |\n| 4 | Météo ou obstacle de terrain |\n| 5 | Opportunité ou ressource     |\n| 6 | Lieu ou sanctuaire paisible  |\n\n";
        view.dispatch({
          changes: { from, to, insert: rTable },
          selection: { anchor: from + 8, head: from + 36 },
          scrollIntoView: true
        });
        break;
      }
      case 'callout': {
        const callout = "\n> [!NOTE]\n> Note importante ou indice à retenir.\n\n";
        view.dispatch({
          changes: { from, to, insert: callout },
          selection: { anchor: from + 13, head: from + 49 },
          scrollIntoView: true
        });
        break;
      }
      case 'readaloud': {
        const narration = "\n> 🗣️ **À voix haute pour les joueurs :**\n> *La lumière vacillante des flambeaux dévoile une salle voûtée silencieuse...*\n\n";
        view.dispatch({
          changes: { from, to, insert: narration },
          selection: { anchor: from + 46, head: from + 118 },
          scrollIntoView: true
        });
        break;
      }
      case 'secret': {
        const secretBox = "\n> [!SECRET] Secret MJ\n> Indice secret ou piège non révélé aux aventuriers.\n\n";
        view.dispatch({
          changes: { from, to, insert: secretBox },
          selection: { anchor: from + 25, head: from + 74 },
          scrollIntoView: true
        });
        break;
      }
      case 'statblock': {
        const statSnippet = "\n> ### ⚔️ Nom du Monstre\n> *Créature de taille Moyenne, Non-alignée*\n> - **CA :** 14 | **PV :** 32 (5d8 + 10) | **Vitesse :** 9 m\n> - **FOR** 14 (+2) | **DEX** 12 (+1) | **CON** 14 (+2)\n> - **Actions :** **Frappe** +4 au toucher (1d8+2 dégâts)\n\n";
        view.dispatch({
          changes: { from, to, insert: statSnippet },
          selection: { anchor: from + 9, head: from + 25 },
          scrollIntoView: true
        });
        break;
      }
      case 'comment': {
        if (empty) {
          const insertText = '%% Note cachée du MJ %%';
          view.dispatch({
            changes: { from, to, insert: insertText },
            selection: { anchor: from + 3, head: from + 21 },
            scrollIntoView: true
          });
        } else {
          toggleWrap('%%', 'note cachée');
        }
        break;
      }
      case 'hr': {
        const hr = "\n---\n\n";
        view.dispatch({
          changes: { from, to, insert: hr },
          selection: { anchor: from + hr.length },
          scrollIntoView: true
        });
        break;
      }
    }
    view.focus();
  }

  const formattingKeymap = keymap.of([
    {
      key: 'Mod-b',
      run: () => {
        applyFormat('bold');
        return true;
      }
    },
    {
      key: 'Mod-i',
      run: () => {
        applyFormat('italic');
        return true;
      }
    },
    {
      key: 'Mod-k',
      run: () => {
        applyFormat('wikilink');
        return true;
      }
    }
  ]);

  function onEditorFormat(e: Event) {
    const type = (e as CustomEvent).detail?.type;
    if (type) applyFormat(type);
  }

  function runAI(evt?: Event) {
    if (!view || isGenerating) return;

    // Prompt custom passé via CustomEvent detail
    const customPrompt = (evt as CustomEvent)?.detail?.prompt as string | undefined;

    let promptText = '';
    let insertPos: number;

    if (customPrompt) {
      promptText = customPrompt;
      insertPos = view.state.doc.length;
    } else {
      const selection = view.state.selection.main;
      insertPos = selection.to;

      if (selection.empty) {
        const line = view.state.doc.lineAt(selection.from);
        promptText = line.text;
        insertPos = line.to;
      } else {
        promptText = view.state.doc.sliceString(selection.from, selection.to);
      }

      if (!promptText.trim()) {
        const fullDoc = view.state.doc.toString().trim();
        if (!fullDoc) { alert("Le document est vide."); return; }
        promptText = `Résume ce document de manière structurée et concise (contexte : notes de Maître du Jeu TTRPG) :\n\n${fullDoc}`;
        insertPos = view.state.doc.length;
      }
    }

    isGenerating = true;

    // Calculer la longueur depuis la chaîne réelle pour éviter les erreurs d'offset
    const loadingText = '\n\n*✨ Réflexion de l\'IA...*';
    view.dispatch({
      changes: { from: insertPos, insert: loadingText }
    });

    const loadingEnd = insertPos + loadingText.length;

    const model = getAiModel();
    const sysPrompt = getAiSystemPrompt();

    askOllama(promptText, model, sysPrompt)
      .then(res => {
        view.dispatch({
          changes: {
            from: insertPos,
            to: loadingEnd,
            insert: '\n\n> ' + res.trim().split('\n').join('\n> ') + '\n'
          }
        });
      })
      .catch(err => {
        view.dispatch({
          changes: {
            from: insertPos,
            to: loadingEnd,
            insert: '\n\n*❌ Erreur IA : ' + err + '*'
          }
        });
      })
      .finally(() => {
        isGenerating = false;
      });
  }

  const aiKeymap = keymap.of([
    {
      key: 'Mod-j',
      run: (view) => {
        runAI();
        return true;
      }
    }
  ]);

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      onInput(update.state.doc.toString());

      // Force autocomplete if user just typed the second '[' of '[['
      let typedWikiLink = false;
      update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
        if (inserted.toString() === '[') {
          // Vérifie si le caractère juste avant est aussi un '['
          if (fromB > 0) {
            const prevChar = update.state.doc.sliceString(fromB - 1, fromB);
            if (prevChar === '[') {
              typedWikiLink = true;
            }
          }
        }
      });

      if (typedWikiLink) {
        // startCompletion doit être appelé de manière asynchrone pour ne pas bloquer l'update en cours
        setTimeout(() => startCompletion(update.view), 10);
      }
    }
  });

  // Ctrl+Clic sur [[wikilink]] → ouvre le fichier lié (ou propose de le créer)
  async function openWikiLink(linkTarget: string) {
    const vaultPath = getVaultPath();
    if (!vaultPath) return;
    const filePath = linkTarget + '.md';
    try {
      const content = await readFile(vaultPath, filePath);
      setActiveFile(filePath);
      setActiveContent(content);
      setIsDirty(false);
    } catch {
      // Fichier introuvable → proposer la création
      const title = linkTarget.split('/').pop() ?? linkTarget;
      if (window.confirm(`"${filePath}" n'existe pas.\nCréer ce fichier ?`)) {
        const initialContent = `# ${title}\n\n`;
        try {
          await writeFile(vaultPath, filePath, initialContent);
          const tree = await openVault(vaultPath);
          setVaultTree(tree);
          setActiveFile(filePath);
          setActiveContent(initialContent);
          setIsDirty(false);
        } catch (err) {
          console.error('Failed to create wiki target:', err);
        }
      }
    }
  }

  const wikiLinkClickHandler = EditorView.domEventHandlers({
    mousedown(e, view) {
      if (!e.ctrlKey && !e.metaKey) return false;
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos === null) return false;

      const line = view.state.doc.lineAt(pos);
      const posInLine = pos - line.from;
      const regex = /\[\[([^\]]+)\]\]/g;
      let match;
      while ((match = regex.exec(line.text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (posInLine >= start && posInLine <= end) {
          const linkTarget = match[1].split('|')[0].trim();
          openWikiLink(linkTarget);
          e.preventDefault();
          return true;
        }
      }
      return false;
    }
  });

  // Hover Preview pour les liens wiki
  const wikiLinkHoverTooltip = hoverTooltip(async (view, pos, side) => {
    // Vérifier si la position est dans un lien [[...]]
    const line = view.state.doc.lineAt(pos);
    const lineText = line.text;
    const posInLine = pos - line.from;
    
    // Trouver tous les liens sur cette ligne
    const regex = /\[\[(.*?)\]\]/g;
    let match;
    while ((match = regex.exec(lineText)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      
      // Si la souris est sur ce lien
      if (posInLine >= start && posInLine <= end) {
        const linkTarget = match[1].split('|')[0].trim();
        const vaultPath = getVaultPath();
        if (!vaultPath) return null;
        
        try {
          // Essayer de lire le fichier .md correspondant
          let content = '';
          try {
            content = await readFile(vaultPath, linkTarget + '.md');
          } catch {
            content = "*Fichier introuvable*";
          }
          
          // Nettoyer un peu le markdown (enlever le frontmatter pour l'aperçu)
          content = content.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
          const preview = content.substring(0, 300) + (content.length > 300 ? '...' : '');

          return {
            pos: line.from + start,
            end: line.from + end,
            above: true,
            create(view) {
              let dom = document.createElement("div");
              dom.className = "cm-hover-preview";
              dom.textContent = preview;
              return { dom };
            }
          };
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });

  onMount(() => {
    document.addEventListener('trigger-ai', runAI as any);
    document.addEventListener('editor-insert', insertAtCursor);
    document.addEventListener('editor-format', onEditorFormat);
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        saveKeymap,
        aiKeymap,
        formattingKeymap,
        markdown(),
        oneDark,
        autocompletion({
          override: [wikiLinkCompletions]
        }),
        updateListener,
        wikiLinkHoverTooltip,
        wikiLinkClickHandler,
        inlineImagesPlugin,
        checkboxPlugin,
        // Theme custom overrides
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "14px",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
          },
          ".cm-content": {
            padding: "24px 32px",
            maxWidth: "800px",
            margin: "0 auto"
          },
          ".cm-scroller": {
            overflow: "auto"
          },
          ".cm-activeLine": {
            backgroundColor: "rgba(136, 153, 183, 0.04)"
          },
          "&.cm-focused": {
            outline: "none"
          },
          ".cm-tooltip": {
            backgroundColor: "var(--bg-secondary) !important",
            border: "1px solid var(--border) !important",
            borderRadius: "8px !important",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4) !important",
            color: "var(--text-primary) !important"
          },
          ".cm-hover-preview": {
            padding: "12px",
            maxWidth: "400px",
            maxHeight: "300px",
            overflow: "hidden",
            whiteSpace: "pre-wrap",
            fontFamily: "'Inter', sans-serif",
            fontSize: "13px",
            lineHeight: "1.5"
          }
        })
      ]
    });

    view = new EditorView({
      state,
      parent: editorParent
    });
  });

  onDestroy(() => {
    document.removeEventListener('trigger-ai', runAI as any);
    document.removeEventListener('editor-insert', insertAtCursor);
    document.removeEventListener('editor-format', onEditorFormat);
    if (view) {
      view.destroy();
    }
  });

  // Mettre à jour l'éditeur si la props `value` change depuis l'extérieur
  $effect(() => {
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value }
      });
    }
  });

  // Scroller vers une ligne spécifique (outline TOC)
  $effect(() => {
    const line = scrollToLine;
    if (view && line !== null && line !== undefined) {
      const lineObj = view.state.doc.line(Math.min(line + 1, view.state.doc.lines));
      view.dispatch({ selection: { anchor: lineObj.from }, scrollIntoView: true });
      view.focus();
    }
  });
</script>

<div class="codemirror-wrapper" bind:this={editorParent}></div>

<style>
  .codemirror-wrapper {
    flex: 1;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: var(--bg-primary);
  }
</style>
