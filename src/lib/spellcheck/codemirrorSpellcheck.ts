// src/lib/spellcheck/codemirrorSpellcheck.ts
import { linter, forceLinting } from '@codemirror/lint';
import type { Diagnostic } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { Compartment } from '@codemirror/state';
import { undo } from '@codemirror/commands';
import {
  getSpellcheckEnabled,
  getSpellcheckLang,
  checkWordsInWorker,
  addCustomWord,
  ignoreSessionWord
} from './spellcheckStore.svelte';

export const spellcheckCompartment = new Compartment();

interface TextSkipRange {
  from: number;
  to: number;
}

function computeSkipRanges(text: string): TextSkipRange[] {
  const ranges: TextSkipRange[] = [];

  // Frontmatter YAML at the beginning
  const fmMatch = text.match(/^---\n[\s\S]*?\n---\n?/);
  if (fmMatch) {
    ranges.push({ from: 0, to: fmMatch[0].length });
  }

  // Fenced code blocks ```...```
  const codeBlockRegex = /```[\s\S]*?```/g;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    ranges.push({ from: match.index, to: match.index + match[0].length });
  }

  // Inline code `...`
  const inlineCodeRegex = /`[^`\n]+`/g;
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    ranges.push({ from: match.index, to: match.index + match[0].length });
  }

  // URLs (http:// or https://)
  const urlRegex = /https?:\/\/[^\s)\]]+/gi;
  while ((match = urlRegex.exec(text)) !== null) {
    ranges.push({ from: match.index, to: match.index + match[0].length });
  }

  // Wiki links [[target|optional display]] -> skip target path, only check display
  const wikiRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  while ((match = wikiRegex.exec(text)) !== null) {
    const fullStart = match.index;
    const target = match[1];
    const display = match[2];
    if (display !== undefined) {
      // Skip [[target|
      const skipTo = fullStart + 2 + target.length + 1;
      ranges.push({ from: fullStart, to: skipTo });
      // Skip trailing ]]
      ranges.push({ from: fullStart + match[0].length - 2, to: fullStart + match[0].length });
    } else {
      // No display name, skip entire [[target]]
      ranges.push({ from: fullStart, to: fullStart + match[0].length });
    }
  }

  // Markdown image/link targets ![alt](url) -> skip (url)
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  while ((match = linkRegex.exec(text)) !== null) {
    const urlStart = match.index + match[1].length + 2; // after [alt](
    ranges.push({ from: urlStart, to: match.index + match[0].length });
  }

  // HTML tags <tag ...> or </tag>
  const htmlRegex = /<\/?[a-z][a-z0-9]*[^>]*>/gi;
  while ((match = htmlRegex.exec(text)) !== null) {
    ranges.push({ from: match.index, to: match.index + match[0].length });
  }

  // Comments %% note %%
  const commentRegex = /%%[\s\S]*?%%/g;
  while ((match = commentRegex.exec(text)) !== null) {
    ranges.push({ from: match.index, to: match.index + match[0].length });
  }

  // Sort and merge overlapping ranges
  ranges.sort((a, b) => a.from - b.from);
  const merged: TextSkipRange[] = [];
  for (const r of ranges) {
    if (merged.length === 0) {
      merged.push(r);
    } else {
      const last = merged[merged.length - 1];
      if (r.from <= last.to) {
        last.to = Math.max(last.to, r.to);
      } else {
        merged.push(r);
      }
    }
  }

  return merged;
}

function isInsideSkipRanges(pos: number, len: number, ranges: TextSkipRange[]): boolean {
  for (const r of ranges) {
    if (pos >= r.from && pos + len <= r.to) return true;
    if (pos < r.to && pos + len > r.from) return true;
  }
  return false;
}

export const spellcheckLinter = linter(
  async (view: EditorView): Promise<Diagnostic[]> => {
    if (!getSpellcheckEnabled()) {
      return [];
    }

    const docText = view.state.doc.toString();
    if (!docText.trim()) return [];

    const skipRanges = computeSkipRanges(docText);

    // Regex to extract words (including accented letters, ligatures like œ/æ, apostrophes and hyphens inside words)
    const wordRegex = /[\p{L}]+(?:['’\-][\p{L}]+)*/gu;

    const wordsToCheck: Array<{ word: string; from: number; to: number }> = [];
    let m;

    while ((m = wordRegex.exec(docText)) !== null) {
      const word = m[0];
      const from = m.index;
      const to = from + word.length;

      // Skip single letters
      if (word.length <= 1) continue;

      // Skip if inside any forbidden markdown zone
      if (isInsideSkipRanges(from, word.length, skipRanges)) continue;

      // Skip if purely dice formula (e.g. 1d20, 2d6, d100)
      if (/^\d*[dD]\d+([+-]\d+)?$/.test(word)) continue;

      wordsToCheck.push({ word, from, to });
    }

    if (wordsToCheck.length === 0) return [];

    // Analyze via worker
    const typos = await checkWordsInWorker(wordsToCheck);

    const diagnostics: Diagnostic[] = [];

    for (const typo of typos) {
      const actions = [];

      // Suggestions
      for (const suggestion of typo.suggestions) {
        actions.push({
          name: `Corriger par « ${suggestion} »`,
          apply(v: EditorView, from: number, to: number) {
            v.dispatch({
              changes: { from, to, insert: suggestion }
            });
            setTimeout(() => forceLinting(v), 50);
          }
        });
      }

      // Add to dictionary
      actions.push({
        name: `➕ Ajouter « ${typo.word} » au dictionnaire`,
        apply(v: EditorView) {
          addCustomWord(typo.word);
          setTimeout(() => forceLinting(v), 50);
        }
      });

      // Ignore for session
      actions.push({
        name: `👁️ Ignorer « ${typo.word} »`,
        apply(v: EditorView) {
          ignoreSessionWord(typo.word);
          setTimeout(() => forceLinting(v), 50);
        }
      });

      // Annuler / Retour en arrière en cas d'erreur
      actions.push({
        name: `↩️ Retour en arrière (Ctrl+Z)`,
        apply(v: EditorView) {
          undo(v);
          setTimeout(() => forceLinting(v), 50);
        }
      });

      diagnostics.push({
        from: typo.from,
        to: typo.to,
        severity: 'warning',
        message: typo.suggestions.length > 0
          ? `Faute d'orthographe (« ${typo.word} ») — Suggestions disponibles`
          : `Mot inconnu (« ${typo.word} »)`,
        actions
      });
    }

    return diagnostics;
  },
  {
    delay: 350
  }
);

// Content attribute extension for native webview spellcheck integration
export function getSpellcheckContentAttributes() {
  const enabled = getSpellcheckEnabled();
  const lang = getSpellcheckLang();
  return EditorView.contentAttributes.of({
    spellcheck: enabled ? 'true' : 'false',
    autocorrect: enabled ? 'on' : 'off',
    autocapitalize: enabled ? 'sentences' : 'off',
    lang: lang === 'fr' ? 'fr-FR' : 'en-US'
  });
}

export const spellcheckTheme = EditorView.theme({
  '.cm-lintRange-warning': {
    backgroundImage: 'none',
    borderBottom: '2px wavy #f87171',
    paddingBottom: '1px'
  },
  '.cm-diagnostic-warning': {
    borderLeft: '4px solid #f87171 !important',
    background: 'rgba(239, 68, 68, 0.08) !important',
    padding: '8px 12px !important',
    borderRadius: '4px !important'
  },
  '.cm-diagnosticAction': {
    background: 'rgba(229, 168, 83, 0.12) !important',
    border: '1px solid rgba(229, 168, 83, 0.3) !important',
    color: '#e5a853 !important',
    padding: '4px 10px !important',
    borderRadius: '4px !important',
    cursor: 'pointer !important',
    fontSize: '12px !important',
    fontWeight: '500 !important',
    marginRight: '6px !important',
    marginTop: '6px !important',
    display: 'inline-block !important',
    transition: 'all 0.15s ease !important'
  },
  '.cm-diagnosticAction:hover': {
    background: 'rgba(229, 168, 83, 0.25) !important',
    borderColor: '#e5a853 !important'
  },
  '.cm-tooltip-lint': {
    backgroundColor: '#181a1f !important',
    border: '1px solid rgba(229, 168, 83, 0.25) !important',
    borderRadius: '8px !important',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6) !important',
    padding: '6px !important'
  }
});
