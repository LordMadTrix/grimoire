// src/lib/editor/taskPlugin.ts
import { EditorView, WidgetType, MatchDecorator, ViewPlugin, Decoration } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';

class TaskCheckboxWidget extends WidgetType {
  checked: boolean;
  pos: number;

  constructor(checked: boolean, pos: number) {
    super();
    this.checked = checked;
    this.pos = pos;
  }

  eq(other: TaskCheckboxWidget) {
    return other.checked === this.checked && other.pos === this.pos;
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'cm-task-checkbox';
    input.checked = this.checked;
    input.title = this.checked ? 'Cliquer pour décocher' : 'Cliquer pour cocher';

    input.addEventListener('click', (e) => {
      e.stopPropagation();
      const newText = input.checked ? '[x]' : '[ ]';
      // Remplace [ ] ou [x] (longueur 3)
      view.dispatch({
        changes: { from: this.pos, to: this.pos + 3, insert: newText }
      });
    });

    return input;
  }
}

// Détecte les balises de listes de tâches: - [ ] ou - [x]
const taskMatcher = new MatchDecorator({
  regexp: /(?:^|\n)(\s*[-*+]\s+)(\[([ xX])\])/g,
  decoration: (match, view, pos) => {
    // match[0] est la ligne complète avec saut de ligne optionnel
    // match[1] est le préfixe de puce (ex: "  - ")
    // match[2] est le tag de case (ex: "[ ]")
    // match[3] est le caractère d'état (" " ou "x")
    const isChecked = match[3].toLowerCase() === 'x';
    const prefixLen = match[1].length;
    // Si match commence par un \n, ajuster la position
    const startsWithNewline = match[0].startsWith('\n');
    const offset = (startsWithNewline ? 1 : 0) + prefixLen;
    const checkboxPos = pos + offset;

    return Decoration.replace({
      widget: new TaskCheckboxWidget(isChecked, checkboxPos)
    });
  }
});

export const taskPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = taskMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = taskMatcher.updateDeco(update, this.decorations);
    }
  },
  {
    decorations: (v) => v.decorations
  }
);

export const taskTheme = EditorView.theme({
  '.cm-task-checkbox': {
    appearance: 'none',
    width: '15px',
    height: '15px',
    border: '1.5px solid rgba(229, 168, 83, 0.6)',
    borderRadius: '4px',
    background: 'rgba(0, 0, 0, 0.25)',
    cursor: 'pointer',
    verticalAlign: 'middle',
    margin: '0 6px 0 2px',
    position: 'relative',
    transition: 'all 0.15s ease'
  },
  '.cm-task-checkbox:hover': {
    borderColor: '#e5a853',
    background: 'rgba(229, 168, 83, 0.15)',
    boxShadow: '0 0 6px rgba(229, 168, 83, 0.3)'
  },
  '.cm-task-checkbox:checked': {
    background: '#e5a853',
    borderColor: '#e5a853'
  },
  '.cm-task-checkbox:checked::after': {
    content: '""',
    position: 'absolute',
    left: '4px',
    top: '1px',
    width: '4px',
    height: '8px',
    border: 'solid #000',
    borderWidth: '0 2px 2px 0',
    transform: 'rotate(45deg)'
  }
});
