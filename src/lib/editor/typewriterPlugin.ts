// src/lib/editor/typewriterPlugin.ts
import { EditorView, scrollPastEnd } from '@codemirror/view';
import { Compartment } from '@codemirror/state';

export const typewriterCompartment = new Compartment();

export function getTypewriterExtension(enabled: boolean) {
  if (!enabled) return [];
  return [
    scrollPastEnd(),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && update.view.hasFocus) {
        const head = update.state.selection.main.head;
        const dom = update.view.dom;
        const coords = update.view.coordsAtPos(head);
        if (coords) {
          const editorRect = dom.getBoundingClientRect();
          const targetY = editorRect.top + (editorRect.height / 2);
          const diff = coords.top - targetY;
          if (Math.abs(diff) > 30) {
            update.view.scrollDOM.scrollTop += diff * 0.4;
          }
        }
      }
    })
  ];
}
