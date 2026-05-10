<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorState } from '@codemirror/state';
  import { EditorView, keymap, highlightActiveLine, lineNumbers, hoverTooltip } from '@codemirror/view';
  import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
  import { markdown } from '@codemirror/lang-markdown';
  import { autocompletion, CompletionContext, startCompletion } from '@codemirror/autocomplete';
  import { oneDark } from '@codemirror/theme-one-dark';
  import { searchVault, askOllama, readFile, writeFile, openVault } from '$lib/api';
  import { getAiModel, getAiSystemPrompt } from '$lib/stores/settings.svelte';
  import { getVaultPath, setActiveFile, setActiveContent, setIsDirty, setVaultTree } from '$lib/stores/vault.svelte';

  let { value = '', onInput = () => {}, onSave = () => {} }: {
    value: string;
    onInput: (val: string) => void;
    onSave: () => void;
  } = $props();

  let isGenerating = $state(false);

  let editorParent: HTMLDivElement;
  let view: EditorView;

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
        const { getVaultTree } = await import('$lib/stores/vault.svelte');
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

  function runAI() {
    if (!view || isGenerating) return;
    
    let selection = view.state.selection.main;
    let promptText = '';
    let insertPos = selection.to;

    if (selection.empty) {
      const line = view.state.doc.lineAt(selection.from);
      promptText = line.text;
      insertPos = line.to;
    } else {
      promptText = view.state.doc.sliceString(selection.from, selection.to);
    }

    if (!promptText.trim()) {
      alert("Veuillez sélectionner du texte ou placer votre curseur sur une ligne avec du texte.");
      return;
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
        const vaultPath = (await import('$lib/stores/vault.svelte')).getVaultPath();
        if (!vaultPath) return null;
        
        try {
          // Essayer de lire le fichier .md correspondant
          let content = '';
          try {
            content = await (await import('$lib/api')).readFile(vaultPath, linkTarget + '.md');
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
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        saveKeymap,
        aiKeymap,
        markdown(),
        oneDark,
        autocompletion({
          override: [wikiLinkCompletions]
        }),
        updateListener,
        wikiLinkHoverTooltip,
        wikiLinkClickHandler,
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
