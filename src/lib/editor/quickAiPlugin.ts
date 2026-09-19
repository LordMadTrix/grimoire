// src/lib/editor/quickAiPlugin.ts
import { EditorView, ViewPlugin } from '@codemirror/view';
import type { ViewUpdate } from '@codemirror/view';

export const quickAiPlugin = ViewPlugin.fromClass(
  class {
    view: EditorView;
    toolbar: HTMLElement | null = null;
    hideTimeout: any = null;

    constructor(view: EditorView) {
      this.view = view;
    }

    update(update: ViewUpdate) {
      if (update.selectionSet || update.docChanged) {
        this.checkSelection();
      }
    }

    checkSelection() {
      const state = this.view.state;
      const sel = state.selection.main;

      if (sel.empty) {
        this.destroyToolbar();
        return;
      }

      const text = state.doc.sliceString(sel.from, sel.to).trim();
      if (text.length < 3 || text.length > 500) {
        this.destroyToolbar();
        return;
      }

      // Afficher / repositionner la barre d'actions rapide
      this.renderToolbar(text, sel.from, sel.to);
    }

    renderToolbar(selectedText: string, from: number, to: number) {
      if (!this.toolbar) {
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'cm-quick-ai-toolbar';
        document.body.appendChild(this.toolbar);
      }

      this.toolbar.innerHTML = `
        <div class="quick-ai-title">🪄 IA</div>
        <button type="button" class="quick-ai-btn" data-action="menu" style="color: #e5a853; font-weight: 700;" title="Ouvrir le menu complet de l'assistant IA (Ctrl+J)">⚡ Menu IA</button>
        <button type="button" class="quick-ai-btn" data-action="describe" title="Générer une description visuelle et sensorielle">🎭 Décrire</button>
        <button type="button" class="quick-ai-btn" data-action="dialogue" title="Générer 3 répliques pour ce PNJ">🗣️ Dialogues</button>
        <button type="button" class="quick-ai-btn" data-action="sensory" title="Ajouter sons, odeurs et ambiance">📜 Sensations</button>
        <button type="button" class="quick-ai-btn" data-action="stats" title="Générer un bloc de stats pour combat">⚔️ Stats</button>
      `;

      this.toolbar.querySelectorAll('.quick-ai-btn').forEach((btn) => {
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = (btn as HTMLElement).dataset.action;
          this.executeAction(action, selectedText, from, to);
          this.destroyToolbar();
        });
      });

      // Positionnement au-dessus de la sélection
      const coords = this.view.coordsAtPos(from);
      if (coords) {
        const top = Math.max(10, coords.top - 40);
        const left = Math.max(10, coords.left);
        this.toolbar.style.top = `${top}px`;
        this.toolbar.style.left = `${left}px`;
      }
    }

    executeAction(action: string | undefined, text: string, from: number, to: number) {
      if (action === 'menu') {
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
        document.dispatchEvent(new CustomEvent('trigger-ai', { detail: { prompt } }));
      }
    }

    destroyToolbar() {
      if (this.toolbar) {
        this.toolbar.remove();
        this.toolbar = null;
      }
    }

    destroy() {
      this.destroyToolbar();
    }
  }
);

export const quickAiTheme = EditorView.theme({
  '.cm-quick-ai-toolbar': {
    position: 'fixed',
    zIndex: '1500',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: '#161922',
    border: '1px solid rgba(229, 168, 83, 0.4)',
    borderRadius: '8px',
    padding: '4px 8px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 12px rgba(229, 168, 83, 0.15)',
    animation: 'cmQuickAiFadeIn 0.15s ease-out'
  },
  '.quick-ai-title': {
    fontSize: '11px',
    fontWeight: '700',
    color: '#e5a853',
    paddingRight: '6px',
    borderRight: '1px solid rgba(255, 255, 255, 0.12)',
    userSelect: 'none'
  },
  '.quick-ai-btn': {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid transparent',
    borderRadius: '4px',
    color: '#c9d1d9',
    fontSize: '11px',
    fontWeight: '500',
    padding: '3px 7px',
    cursor: 'pointer',
    transition: 'all 0.12s ease'
  },
  '.quick-ai-btn:hover': {
    background: 'rgba(229, 168, 83, 0.2)',
    borderColor: 'rgba(229, 168, 83, 0.4)',
    color: '#fbbf24',
    transform: 'translateY(-1px)'
  }
});
