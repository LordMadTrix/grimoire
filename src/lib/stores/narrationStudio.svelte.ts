// ── Narration Studio Global Store (Svelte 5 Runes) ───────────────────────────
// Permet d'ouvrir le Studio de Narration & Voix IA depuis n'importe quel écran
// (Éditeur Markdown, VTT, Assistant Narratif, Hub MJ, etc.) avec du texte pré-rempli.

let isOpen = $state<boolean>(false);
let initialText = $state<string>('');

export const narrationStudioStore = {
  get isOpen() {
    return isOpen;
  },
  get initialText() {
    return initialText;
  },
  open(text = '') {
    if (text && text.trim().length > 0) {
      initialText = text;
    }
    isOpen = true;
  },
  close() {
    isOpen = false;
  },
  toggle(text = '') {
    if (isOpen) {
      this.close();
    } else {
      this.open(text);
    }
  }
};

