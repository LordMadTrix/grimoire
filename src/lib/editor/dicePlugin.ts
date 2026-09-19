// src/lib/editor/dicePlugin.ts
import { EditorView, WidgetType, MatchDecorator, ViewPlugin, Decoration } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { notifStore } from '$lib/stores/notifications.svelte';

export interface DiceRollResult {
  formula: string;
  count: number;
  sides: number;
  modifier: number;
  rolls: number[];
  total: number;
}

// Synthèse sonore légère pour le lancer de dés (Web Audio API)
export function playDiceSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    
    // 3 petits bruits secs simulant le rebond du dé
    [0, 0.06, 0.14].forEach((delay, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320 + idx * 80, now + delay);
      osc.frequency.exponentialRampToValueAtTime(120, now + delay + 0.05);
      
      gain.gain.setValueAtTime(0.25 - idx * 0.05, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.05);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.06);
    });

    setTimeout(() => ctx.close(), 400);
  } catch (e) {
    // Audio non critique
  }
}

export function evaluateDiceFormula(raw: string): DiceRollResult | null {
  const match = raw.trim().match(/^(\d{1,2})?d(\d{1,3})(?:\s*([+-])\s*(\d{1,3}))?$/i);
  if (!match) return null;

  const count = match[1] ? Math.max(1, parseInt(match[1], 10)) : 1;
  const sides = parseInt(match[2], 10);
  if (sides < 2) return null;

  const sign = match[3] || '+';
  const rawMod = match[4] ? parseInt(match[4], 10) : 0;
  const modifier = sign === '-' ? -rawMod : rawMod;

  const rolls: number[] = [];
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const r = Math.floor(Math.random() * sides) + 1;
    rolls.push(r);
    sum += r;
  }

  const total = sum + modifier;

  return {
    formula: raw,
    count,
    sides,
    modifier,
    rolls,
    total
  };
}

class DiceBadgeWidget extends WidgetType {
  formula: string;
  pos: number;

  constructor(formula: string, pos: number) {
    super();
    this.formula = formula;
    this.pos = pos;
  }

  eq(other: DiceBadgeWidget) {
    return other.formula === this.formula && other.pos === this.pos;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'cm-dice-widget';
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('tabindex', '0');
    wrap.title = `🎲 Lancer ${this.formula} (Cliquer pour lancer)`;

    const icon = document.createElement('span');
    icon.className = 'cm-dice-icon';
    icon.textContent = '🎲';

    const text = document.createElement('span');
    text.className = 'cm-dice-text';
    text.textContent = this.formula;

    wrap.appendChild(icon);
    wrap.appendChild(text);

    wrap.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.executeRoll(view, wrap);
    });

    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.executeRoll(view, wrap);
      }
    });

    return wrap;
  }

  private executeRoll(view: EditorView, wrap: HTMLElement) {
    const result = evaluateDiceFormula(this.formula);
    if (!result) return;

    playDiceSound();

    // Notification toast
    const detailStr = result.count > 1 || result.modifier !== 0
      ? ` [${result.rolls.join('+')}]${result.modifier !== 0 ? (result.modifier > 0 ? ' +' + result.modifier : ' ' + result.modifier) : ''}`
      : '';
    notifStore.add('🎲', `Jet : ${result.formula}`, `Résultat = ${result.total}${detailStr}`, 'info', 4000);

    // Émettre pour diffusion VTT / Joueurs
    window.dispatchEvent(new CustomEvent('dice-rolled', { detail: result }));

    // Afficher une bulle tooltip animée au-dessus du badge
    this.showResultTooltip(view, wrap, result);
  }

  private showResultTooltip(view: EditorView, wrap: HTMLElement, result: DiceRollResult) {
    // Retirer les anciens popups
    document.querySelectorAll('.cm-dice-popup').forEach(el => el.remove());

    const popup = document.createElement('div');
    popup.className = 'cm-dice-popup';

    const isCrit = result.sides === 20 && result.rolls.includes(20);
    const isFumble = result.sides === 20 && result.rolls.includes(1);

    let critBadge = '';
    if (isCrit) critBadge = ' <span class="dice-crit">★ CRITIQUE !</span>';
    if (isFumble) critBadge = ' <span class="dice-fumble">💀 ÉCHEC CRITIQUE</span>';

    popup.innerHTML = `
      <div class="dice-popup-header">
        <span class="dice-popup-title">🎲 ${result.formula}</span>
        <span class="dice-popup-total">${result.total}${critBadge}</span>
      </div>
      <div class="dice-popup-details">Détail : [${result.rolls.join(', ')}]${result.modifier !== 0 ? (result.modifier > 0 ? ' +' + result.modifier : ' ' + result.modifier) : ''}</div>
      <div class="dice-popup-actions">
        <button type="button" class="dice-btn-insert" title="Insérer le résultat après la formule dans le texte">✍️ Insérer</button>
        <button type="button" class="dice-btn-close" title="Fermer">✕</button>
      </div>
    `;

    // Bouton insérer
    popup.querySelector('.dice-btn-insert')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const insertText = ` = **${result.total}**`;
      const insertPos = this.pos + this.formula.length;
      view.dispatch({
        changes: { from: insertPos, insert: insertText },
        selection: { anchor: insertPos + insertText.length }
      });
      popup.remove();
    });

    popup.querySelector('.dice-btn-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      popup.remove();
    });

    document.body.appendChild(popup);

    // Positionnement au-dessus du widget
    const rect = wrap.getBoundingClientRect();
    popup.style.top = `${Math.max(10, rect.top - popup.offsetHeight - 8)}px`;
    popup.style.left = `${Math.max(10, rect.left + (rect.width / 2) - (popup.offsetWidth / 2))}px`;

    // Auto-suppression après 4s
    setTimeout(() => {
      if (document.body.contains(popup)) {
        popup.classList.add('fade-out');
        setTimeout(() => popup.remove(), 250);
      }
    }, 4000);
  }
}

// Décorateur recherchant les formules de dés (1d20, 2d6+2, 1d20 + 5, d100, etc.)
const diceMatcher = new MatchDecorator({
  regexp: /\b(\d{1,2}d\d{1,3}(?:\s*[+-]\s*\d{1,3})?|d\d{1,3}(?:\s*[+-]\s*\d{1,3})?)\b/gi,
  decoration: (match, view, pos) => {
    const formula = match[0];
    return Decoration.replace({
      widget: new DiceBadgeWidget(formula, pos)
    });
  }
});

export const dicePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = diceMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = diceMatcher.updateDeco(update, this.decorations);
    }
  },
  {
    decorations: (v) => v.decorations
  }
);

export const diceTheme = EditorView.theme({
  '.cm-dice-widget': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    background: 'linear-gradient(135deg, rgba(229, 168, 83, 0.15), rgba(217, 119, 6, 0.25))',
    border: '1px solid rgba(229, 168, 83, 0.45)',
    borderRadius: '5px',
    padding: '1px 6px',
    margin: '0 2px',
    fontSize: '0.92em',
    fontWeight: '600',
    color: '#fbbf24',
    cursor: 'pointer',
    userSelect: 'none',
    verticalAlign: 'baseline',
    transition: 'all 0.15s ease',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
  },
  '.cm-dice-widget:hover': {
    background: 'linear-gradient(135deg, rgba(229, 168, 83, 0.3), rgba(217, 119, 6, 0.45))',
    borderColor: '#fbbf24',
    transform: 'translateY(-1px)',
    boxShadow: '0 3px 8px rgba(245, 158, 11, 0.35)'
  },
  '.cm-dice-widget:active': {
    transform: 'translateY(0)',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
  },
  '.cm-dice-icon': {
    fontSize: '0.95em',
    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4))'
  },
  '.cm-dice-text': {
    letterSpacing: '0.02em',
    fontFamily: 'inherit'
  }
});
