<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorState, RangeSetBuilder } from '@codemirror/state';
  import { EditorView, keymap, highlightActiveLine, lineNumbers, hoverTooltip, WidgetType, MatchDecorator, ViewPlugin, Decoration } from '@codemirror/view';
  import type { DecorationSet, ViewUpdate } from '@codemirror/view';
  import { defaultKeymap, history, historyKeymap, undo, redo, indentWithTab } from '@codemirror/commands';
  import { markdown, markdownKeymap } from '@codemirror/lang-markdown';
  import { GFM, Subscript, Superscript, Emoji } from '@lezer/markdown';
  import { search, searchKeymap, openSearchPanel, highlightSelectionMatches } from '@codemirror/search';
  import { autocompletion, CompletionContext, startCompletion } from '@codemirror/autocomplete';
  import { oneDark } from '@codemirror/theme-one-dark';
  import { searchVault, askOllama, readFile, writeFile, openVault, readFileBase64 } from '$lib/api';
  import { getAiModel, getAiSystemPrompt } from '$lib/stores/settings.svelte';
  import { getVaultPath, getVaultTree, setActiveFile, setActiveContent, setIsDirty, setVaultTree } from '$lib/stores/vault.svelte';
  import { spellcheckLinter, spellcheckTheme, getSpellcheckContentAttributes, spellcheckCompartment } from '$lib/spellcheck/codemirrorSpellcheck';
  import { dicePlugin, diceTheme } from '$lib/editor/dicePlugin';
  import { calloutPlugin, calloutTheme } from '$lib/editor/calloutPlugin';
  import { quickAiPlugin, quickAiTheme } from '$lib/editor/quickAiPlugin';
  import { typewriterCompartment, getTypewriterExtension } from '$lib/editor/typewriterPlugin';
  import { forceLinting } from '@codemirror/lint';
  import AiMenuModal from './AiMenuModal.svelte';

  let { value = '', scrollToLine = null, onInput = () => {}, onSave = () => {} }: {
    value: string;
    scrollToLine?: number | null;
    onInput: (val: string) => void;
    onSave: () => void;
  } = $props();

  let isGenerating = $state(false);
  let showAiMenu = $state(false);
  let aiTargetText = $state('');
  let aiFullDocText = $state('');
  let aiSelectionRange = $state({ from: 0, to: 0, empty: true });

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

  // ── Line styling for Headings & Completed tasks ─────────────
  const markdownLineStylingPlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = this.buildDeco(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDeco(update.view);
        }
      }
      buildDeco(view: EditorView) {
        const builder = new RangeSetBuilder<Decoration>();
        for (const { from, to } of view.visibleRanges) {
          let pos = from;
          while (pos <= to) {
            const line = view.state.doc.lineAt(pos);
            const text = line.text;
            if (/^\s*[-*]\s+\[x\]/i.test(text)) {
              builder.add(line.from, line.from, Decoration.line({ class: 'cm-task-done-line' }));
            } else if (/^#\s+/.test(text)) {
              builder.add(line.from, line.from, Decoration.line({ class: 'cm-heading-line cm-heading-1' }));
            } else if (/^##\s+/.test(text)) {
              builder.add(line.from, line.from, Decoration.line({ class: 'cm-heading-line cm-heading-2' }));
            } else if (/^###\s+/.test(text)) {
              builder.add(line.from, line.from, Decoration.line({ class: 'cm-heading-line cm-heading-3' }));
            } else if (/^####\s+/.test(text)) {
              builder.add(line.from, line.from, Decoration.line({ class: 'cm-heading-line cm-heading-4' }));
            }
            pos = line.to + 1;
          }
        }
        return builder.finish();
      }
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
      case 'undo':
        undo(view);
        view.focus();
        return;
      case 'redo':
        redo(view);
        view.focus();
        return;
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

  function openAiPalette() {
    if (!view) return;
    const selection = view.state.selection.main;
    let targetText = '';
    if (selection.empty) {
      const line = view.state.doc.lineAt(selection.from);
      targetText = line.text;
      aiSelectionRange = { from: line.from, to: line.to, empty: true };
    } else {
      targetText = view.state.doc.sliceString(selection.from, selection.to);
      aiSelectionRange = { from: selection.from, to: selection.to, empty: false };
    }
    aiTargetText = targetText;
    aiFullDocText = view.state.doc.toString();
    showAiMenu = true;
  }

  function handleAiApply(text: string, mode: 'replace' | 'insert_below') {
    if (!view) return;
    if (mode === 'replace') {
      view.dispatch({
        changes: {
          from: aiSelectionRange.from,
          to: aiSelectionRange.to,
          insert: text
        },
        selection: { anchor: aiSelectionRange.from + text.length },
        scrollIntoView: true
      });
    } else {
      const insertPos = aiSelectionRange.to;
      const insertion = '\n\n' + text + '\n';
      view.dispatch({
        changes: {
          from: insertPos,
          insert: insertion
        },
        selection: { anchor: insertPos + insertion.length },
        scrollIntoView: true
      });
    }
    view.focus();
  }

  function runAI(evt?: Event) {
    if (!view || isGenerating) return;

    // Prompt custom passé via CustomEvent detail
    const customPrompt = (evt as CustomEvent)?.detail?.prompt as string | undefined;

    if (!customPrompt) {
      openAiPalette();
      return;
    }

    let promptText = customPrompt;
    let insertPos = view.state.doc.length;

    isGenerating = true;

    const model = getAiModel();
    const sysPrompt = getAiSystemPrompt();

    // Calculer la longueur depuis la chaîne réelle pour éviter les erreurs d'offset
    const loadingText = `\n\n*✨ Réflexion de l'IA (${model || 'locale'})...*`;
    view.dispatch({
      changes: { from: insertPos, insert: loadingText }
    });

    const loadingEnd = insertPos + loadingText.length;

    askOllama(promptText, model, sysPrompt)
      .then(res => {
        view.dispatch({
          changes: {
            from: insertPos,
            to: loadingEnd,
            insert: '\n\n' + res.trim() + '\n'
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

  // Ctrl+Clic sur [[wikilink]] → ouvre le fichier lié (ou la carte VTT)
  async function openWikiLink(linkTarget: string) {
    if (linkTarget.toLowerCase().startsWith('map:')) {
      const target = linkTarget.slice(4).trim();
      const [mapName, pinTarget] = target.split('#');
      window.dispatchEvent(new CustomEvent('open-vtt-map', { detail: { mapName, pinTarget } }));
      return;
    }
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
        if (linkTarget.toLowerCase().startsWith('map:')) {
          const mapInfo = linkTarget.slice(4).trim();
          return {
            pos: line.from + start,
            end: line.from + end,
            above: true,
            create() {
              const dom = document.createElement('div');
              dom.className = 'cm-hover-preview';
              dom.innerHTML = `<strong style="color:var(--accent);">🗺️ Scène VTT : ${mapInfo}</strong><br><span style="font-size:11px;color:var(--text-muted);">(Ctrl+Clic pour ouvrir dans la table virtuelle)</span>`;
              return { dom };
            }
          };
        }
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

  function onSpellcheckChanged() {
    if (view) {
      view.dispatch({
        effects: spellcheckCompartment.reconfigure([
          spellcheckLinter,
          spellcheckTheme,
          getSpellcheckContentAttributes()
        ])
      });
      forceLinting(view);
    }
  }

  let isTypewriter = $state(false);
  function onToggleTypewriter(e: any) {
    isTypewriter = e.detail?.enabled ?? !isTypewriter;
    if (view) {
      view.dispatch({
        effects: typewriterCompartment.reconfigure(getTypewriterExtension(isTypewriter))
      });
    }
  }

  function onEditorSearch() {
    if (view) {
      openSearchPanel(view);
    }
  }

  onMount(() => {
    document.addEventListener('trigger-ai', runAI as any);
    document.addEventListener('editor-insert', insertAtCursor);
    document.addEventListener('editor-format', onEditorFormat);
    document.addEventListener('editor-search', onEditorSearch);
    document.addEventListener('spellcheck-settings-changed', onSpellcheckChanged);
    document.addEventListener('toggle-typewriter', onToggleTypewriter);
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...markdownKeymap,
          ...searchKeymap,
          {
            key: 'Mod-h',
            run: openSearchPanel,
            scope: 'editor search-panel'
          },
          indentWithTab
        ]),
        saveKeymap,
        aiKeymap,
        formattingKeymap,
        search({ top: true }),
        highlightSelectionMatches(),
        markdown({
          extensions: [GFM, Subscript, Superscript, Emoji],
          addKeymap: true
        }),
        oneDark,
        EditorView.lineWrapping,
        autocompletion({
          override: [wikiLinkCompletions]
        }),
        updateListener,
        wikiLinkHoverTooltip,
        wikiLinkClickHandler,
        inlineImagesPlugin,
        checkboxPlugin,
        markdownLineStylingPlugin,
        dicePlugin,
        diceTheme,
        calloutPlugin,
        calloutTheme,
        quickAiPlugin,
        quickAiTheme,
        typewriterCompartment.of(getTypewriterExtension(false)),
        spellcheckCompartment.of([
          spellcheckLinter,
          spellcheckTheme,
          getSpellcheckContentAttributes()
        ]),
        // Theme custom overrides
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "14px",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
          },
          ".cm-content": {
            padding: "24px 32px",
            maxWidth: "860px",
            margin: "0 auto",
            boxSizing: "border-box"
          },
          ".cm-line": {
            lineHeight: "1.65",
            wordBreak: "break-word",
            overflowWrap: "break-word"
          },
          // Heading lines in editor
          ".cm-heading-line": {
            fontWeight: "700 !important",
            fontFamily: "'Inter', sans-serif !important",
            letterSpacing: "-0.01em !important"
          },
          ".cm-heading-1": {
            fontSize: "1.45em !important",
            color: "#fbbf24 !important",
            paddingTop: "6px !important",
            paddingBottom: "2px !important"
          },
          ".cm-heading-2": {
            fontSize: "1.25em !important",
            color: "#e5a853 !important",
            paddingTop: "4px !important"
          },
          ".cm-heading-3": {
            fontSize: "1.12em !important",
            color: "#d4af37 !important"
          },
          ".cm-heading-4": {
            fontSize: "1.04em !important",
            color: "#f6ad55 !important"
          },
          // Completed task lines
          ".cm-task-done-line": {
            opacity: "0.55 !important",
            textDecoration: "line-through !important",
            textDecorationColor: "rgba(229, 168, 83, 0.6) !important"
          },
          // Search panel styling
          ".cm-panel.cm-search": {
            backgroundColor: "var(--bg-secondary) !important",
            color: "var(--text-primary) !important",
            borderBottom: "1px solid var(--border) !important",
            padding: "6px 14px !important",
            display: "flex !important",
            alignItems: "center !important",
            flexWrap: "wrap !important",
            gap: "8px !important",
            fontFamily: "'Inter', sans-serif !important",
            fontSize: "12px !important",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3) !important"
          },
          ".cm-search input.cm-textfield": {
            backgroundColor: "var(--bg-tertiary) !important",
            color: "var(--text-primary) !important",
            border: "1px solid var(--border) !important",
            borderRadius: "4px !important",
            padding: "3px 8px !important",
            outline: "none !important",
            fontSize: "12px !important"
          },
          ".cm-search input.cm-textfield:focus": {
            borderColor: "var(--accent) !important",
            boxShadow: "0 0 0 1px var(--accent) !important"
          },
          ".cm-search button.cm-button": {
            backgroundColor: "rgba(255, 255, 255, 0.05) !important",
            color: "var(--text-secondary) !important",
            border: "1px solid var(--border) !important",
            borderRadius: "4px !important",
            padding: "2px 8px !important",
            cursor: "pointer !important",
            fontSize: "11px !important",
            fontWeight: "500 !important",
            transition: "all 0.15s ease !important"
          },
          ".cm-search button.cm-button:hover": {
            backgroundColor: "var(--bg-hover) !important",
            color: "var(--accent) !important",
            borderColor: "rgba(229, 168, 83, 0.4) !important"
          },
          ".cm-search label": {
            color: "var(--text-muted) !important",
            fontSize: "11px !important",
            display: "inline-flex !important",
            alignItems: "center !important",
            gap: "4px !important",
            cursor: "pointer !important"
          },
          ".cm-searchMatch": {
            backgroundColor: "rgba(229, 168, 83, 0.35) !important",
            border: "1px solid rgba(229, 168, 83, 0.6) !important",
            borderRadius: "2px !important"
          },
          ".cm-searchMatch-selected": {
            backgroundColor: "rgba(245, 158, 11, 0.6) !important",
            border: "1px solid #fbbf24 !important"
          },
          ".cm-selectionMatch": {
            backgroundColor: "rgba(229, 168, 83, 0.18) !important",
            borderRadius: "2px !important"
          },
          ".cm-scroller": {
            overflowX: "hidden",
            overflowY: "auto"
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
    document.removeEventListener('editor-search', onEditorSearch);
    document.removeEventListener('spellcheck-settings-changed', onSpellcheckChanged);
    document.removeEventListener('toggle-typewriter', onToggleTypewriter);
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

{#if showAiMenu}
  <AiMenuModal
    targetText={aiTargetText}
    fullDocText={aiFullDocText}
    onApply={handleAiApply}
    onClose={() => { showAiMenu = false; view?.focus(); }}
  />
{/if}

<style>
  .codemirror-wrapper {
    flex: 1;
    height: 100%;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    background: var(--bg-primary);
    position: relative;
  }
  .codemirror-wrapper :global(.cm-editor) {
    height: 100%;
    width: 100%;
    outline: none;
  }
</style>
