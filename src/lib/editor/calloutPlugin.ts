// src/lib/editor/calloutPlugin.ts
import { EditorView, WidgetType, MatchDecorator, ViewPlugin, Decoration } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';

export interface CalloutMeta {
  type: string;
  icon: string;
  label: string;
  color: string;
  bgColor: string;
}

export const CALLOUT_TYPES: Record<string, CalloutMeta> = {
  note: { type: 'note', icon: 'ℹ️', label: 'Note', color: '#60a5fa', bgColor: 'rgba(96, 165, 250, 0.08)' },
  info: { type: 'info', icon: 'ℹ️', label: 'Information', color: '#60a5fa', bgColor: 'rgba(96, 165, 250, 0.08)' },
  secret: { type: 'secret', icon: '🔒', label: 'Secret MJ', color: '#c084fc', bgColor: 'rgba(192, 132, 252, 0.09)' },
  warning: { type: 'warning', icon: '⚠️', label: 'Attention / Piège', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.08)' },
  piege: { type: 'piege', icon: '⚠️', label: 'Piège', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.08)' },
  caution: { type: 'caution', icon: '⚠️', label: 'Danger', color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.08)' },
  loot: { type: 'loot', icon: '💎', label: 'Butin & Trésor', color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.09)' },
  tresor: { type: 'tresor', icon: '💎', label: 'Trésor', color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.09)' },
  tip: { type: 'tip', icon: '💡', label: 'Astuce MJ', color: '#34d399', bgColor: 'rgba(52, 211, 153, 0.08)' },
  danger: { type: 'danger', icon: '💀', label: 'Danger Mortel', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.09)' },
  question: { type: 'question', icon: '❓', label: 'Question', color: '#38bdf8', bgColor: 'rgba(56, 189, 248, 0.08)' },
  success: { type: 'success', icon: '✅', label: 'Succès / Réussite', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.08)' }
};

class CalloutHeaderWidget extends WidgetType {
  rawType: string;
  customTitle: string;
  meta: CalloutMeta;

  constructor(rawType: string, customTitle: string) {
    super();
    this.rawType = rawType;
    this.customTitle = customTitle.trim();
    const key = rawType.toLowerCase();
    this.meta = CALLOUT_TYPES[key] || {
      type: key,
      icon: '📌',
      label: key.charAt(0).toUpperCase() + key.slice(1),
      color: '#e5a853',
      bgColor: 'rgba(229, 168, 83, 0.08)'
    };
  }

  eq(other: CalloutHeaderWidget) {
    return other.rawType === this.rawType && other.customTitle === this.customTitle;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = `cm-callout-header cm-callout-${this.meta.type}`;
    wrap.style.borderColor = this.meta.color;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'cm-callout-icon';
    iconSpan.textContent = this.meta.icon;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'cm-callout-title';
    titleSpan.style.color = this.meta.color;
    titleSpan.textContent = this.customTitle || this.meta.label;

    wrap.appendChild(iconSpan);
    wrap.appendChild(titleSpan);

    return wrap;
  }
}

// Détecte les en-têtes de callouts Obsidian: > [!TYPE] Titre
const calloutMatcher = new MatchDecorator({
  regexp: />\s*\[!([a-zA-Z0-9_-]+)\](?:\s+([^\n\r]+))?/g,
  decoration: (match) => {
    const rawType = match[1];
    const customTitle = match[2] || '';
    return Decoration.replace({
      widget: new CalloutHeaderWidget(rawType, customTitle)
    });
  }
});

export const calloutPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = calloutMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = calloutMatcher.updateDeco(update, this.decorations);
    }
  },
  {
    decorations: (v) => v.decorations
  }
);

export const calloutTheme = EditorView.theme({
  '.cm-callout-header': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '2px 10px',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.04)',
    borderLeft: '3px solid',
    fontWeight: '700',
    fontSize: '0.92em',
    userSelect: 'none',
    margin: '2px 0'
  },
  '.cm-callout-icon': {
    fontSize: '1em',
    lineHeight: 1
  },
  '.cm-callout-title': {
    letterSpacing: '0.04em',
    textTransform: 'uppercase'
  }
});
