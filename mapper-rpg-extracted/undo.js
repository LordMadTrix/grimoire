// ============================================================
// HISTORIQUE — Snapshot-based undo/redo avec API Command
//
// Approche : la stack contient des snapshots du doc. Chaque action AVANT
// mutation appelle pushHistory() qui capture l'état. Undo restaure ce
// snapshot et déplace l'état actuel sur redoStack.
//
// Les commandes typées (commands.js) appellent dispatch(cmd) qui :
//   1. Capture le snapshot AVANT
//   2. Exécute cmd.apply() (mutation immuable du doc)
//   3. Pousse le snapshot AVANT sur undoStack
//
// Avantage Command pattern : intention préservée pour debug/replay (chaque
// command a un label). L'undo utilise les snapshots (simple et fiable).
// ============================================================

const UNDO_LIMIT = 50;
let undoStack = [];
let redoStack = [];

function _cmdContext() {
  return {
    setDoc(docJson) {
      try {
        const parsed = JSON.parse(docJson);
        // appStore.set déclenche subscribeKey('doc') → les renderers
        // (showLayersForCurrentDoc, layers panel) se mettent à jour automatiquement.
        if (window.appStore) appStore.set({ doc: parsed });
      } catch {}
    },
    async persist(docJson) {
      if (!currentMap || !currentMap.id) return;
      try {
        await invoke('update_document', { id: currentMap.id, document: docJson });
      } catch (e) { console.warn('Persist failed', e); }
    },
  };
}

function _snapshotCurrent() {
  return currentDoc ? JSON.stringify(currentDoc) : null;
}

// API legacy : à appeler AVANT toute mutation. Capture l'état pré-mutation.
function pushHistory() {
  const snap = _snapshotCurrent();
  if (snap === null) return;
  if (undoStack.length > 0 && undoStack[undoStack.length - 1] === snap) return;
  undoStack.push(snap);
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  redoStack = [];
  updateUndoButtons();
}

// API Command : exécute une commande typée + snapshot le avant
function dispatch(cmd) {
  pushHistory(); // capture le AVANT
  try {
    cmd.apply(_cmdContext());
  } catch (e) {
    console.error('Command apply failed:', cmd.label ? cmd.label() : cmd, e);
    // Si apply a planté, retire le snapshot poussé (rien à annuler)
    undoStack.pop();
    updateUndoButtons();
    throw e;
  }
}

async function undo() {
  if (undoStack.length === 0) return;
  const current = _snapshotCurrent();
  const previous = undoStack.pop();
  if (current !== null) {
    redoStack.push(current);
    if (redoStack.length > UNDO_LIMIT) redoStack.shift();
  }
  _cmdContext().setDoc(previous);
  _cmdContext().persist(previous);
  updateUndoButtons();
}

async function redo() {
  if (redoStack.length === 0) return;
  const current = _snapshotCurrent();
  const next = redoStack.pop();
  if (current !== null) {
    undoStack.push(current);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  }
  _cmdContext().setDoc(next);
  _cmdContext().persist(next);
  updateUndoButtons();
}

function resetUndoHistory() {
  undoStack = [];
  redoStack = [];
  updateUndoButtons();
}

function updateUndoButtons() {
  const u = document.getElementById('undo-btn');
  const r = document.getElementById('redo-btn');
  if (u) {
    u.disabled = undoStack.length === 0;
    u.className = undoStack.length === 0
      ? 'px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-700 text-gray-500 transition disabled:opacity-40'
      : 'px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 transition';
  }
  if (r) {
    r.disabled = redoStack.length === 0;
    r.className = redoStack.length === 0
      ? 'px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-700 text-gray-500 transition disabled:opacity-40'
      : 'px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 transition';
  }
}

window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  if (e.key === 'z' || e.key === 'Z') {
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
  } else if (e.key === 'y' || e.key === 'Y') {
    e.preventDefault();
    redo();
  }
});

window.addEventListener('DOMContentLoaded', updateUndoButtons);

window.__undo = {
  dispatch, undo, redo, pushHistory,
  get undoStack() { return undoStack; },
  get redoStack() { return redoStack; },
};
