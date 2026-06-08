// ============================================================
// TOOL MANAGER — state machine + dispatch des events viewport
//
// Étape C du refactor : le ToolManager attache les listeners pointer/wheel/key
// sur le viewport (élément <main>) et dispatche au tool actif. Pan/zoom est un
// comportement universel intégré ici (modifier Alt ou bouton middle).
//
// Interface Tool (toutes les méthodes optionnelles) :
//   {
//     onActivate(ctx),
//     onDeactivate(ctx),
//     onPointerDown(e, ctx)  → return true pour consommer (sinon comportement par défaut)
//     onPointerMove(e, ctx),
//     onPointerUp(e, ctx),
//     onWheel(e, ctx)        → return true pour consommer
//     onKeyDown(e, ctx)      → return true pour consommer
//     cursor()               → string CSS cursor (optionnel)
//   }
//
// ctx fourni à toutes les méthodes : { state, store, viewport }
// ============================================================

(function () {
  const DEFAULT_TOOL = 'select';
  const tools = new Map();
  let activeId = DEFAULT_TOOL;
  let viewport = null;

  // État pan
  let panning = false;
  let panStart = null;

  function _ctx() {
    return {
      state: window.appStore ? appStore.state : {},
      store: window.appStore,
      viewport,
    };
  }

  function _activate(id) {
    if (id === activeId) {
      _activate(DEFAULT_TOOL);
      return;
    }
    const current = tools.get(activeId);
    if (current && typeof current.onDeactivate === 'function') {
      try { current.onDeactivate(_ctx()); } catch (e) { console.error('Tool onDeactivate', e); }
    }
    activeId = id;
    const next = tools.get(id);
    if (next && typeof next.onActivate === 'function') {
      try { next.onActivate(_ctx()); } catch (e) { console.error('Tool onActivate', e); }
    }
    if (window.appStore) appStore.set({ activeTool: activeId });
  }

  // ---------- Pan/zoom universels ----------
  function _onWheel(e) {
    const result = document.getElementById('result');
    if (!result || result.style.display === 'none') return;
    e.preventDefault();
    // Demander au tool actif s'il veut consommer
    const tool = tools.get(activeId);
    if (tool && typeof tool.onWheel === 'function' && tool.onWheel(e, _ctx())) return;
    // Comportement par défaut : zoom sur le curseur
    if (!window.appStore) return;
    const img = document.getElementById('result-img');
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;
    const v = appStore.state.view;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newScale = Math.min(8, Math.max(0.25, v.scale * factor));
    const actual = newScale / v.scale;
    appStore.update(s => {
      s.view = {
        scale: newScale,
        tx: v.tx + ox * (1 - actual),
        ty: v.ty + oy * (1 - actual),
      };
    });
  }

  function _onPointerDown(e) {
    const result = document.getElementById('result');
    if (!result || result.style.display === 'none') return;
    // Demander au tool actif (gauche uniquement, et hors-modifier)
    const tool = tools.get(activeId);
    const isPanTrigger = e.button === 1 || (e.button === 0 && e.altKey);
    if (!isPanTrigger && tool && typeof tool.onPointerDown === 'function') {
      if (tool.onPointerDown(e, _ctx())) return;
    }
    // Comportement par défaut : pan
    if (!isPanTrigger) return;
    if (!window.appStore) return;
    const v = appStore.state.view;
    panning = true;
    panStart = { x: e.clientX, y: e.clientY, tx: v.tx, ty: v.ty };
    e.preventDefault();
    document.body.style.cursor = 'grabbing';
    const bc = document.getElementById('brush-cursor');
    if (bc) bc.style.display = 'none';
  }

  function _onPointerMove(e) {
    if (panning && window.appStore) {
      appStore.update(s => {
        s.view = {
          ...s.view,
          tx: panStart.tx + (e.clientX - panStart.x),
          ty: panStart.ty + (e.clientY - panStart.y),
        };
      });
      return;
    }
    const tool = tools.get(activeId);
    if (tool && typeof tool.onPointerMove === 'function') tool.onPointerMove(e, _ctx());
  }

  function _onPointerUp(e) {
    if (panning) {
      panning = false;
      document.body.style.cursor = '';
      return;
    }
    const tool = tools.get(activeId);
    if (tool && typeof tool.onPointerUp === 'function') tool.onPointerUp(e, _ctx());
  }

  function _onDblClick(e) {
    const tool = tools.get(activeId);
    if (tool && typeof tool.onDblClick === 'function' && tool.onDblClick(e, _ctx())) return;
    // Comportement par défaut : reset view
    if (window.appStore) appStore.update(s => { s.view = { scale: 1, tx: 0, ty: 0 }; });
  }

  function _onKeyDown(e) {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    const tool = tools.get(activeId);
    if (tool && typeof tool.onKeyDown === 'function') tool.onKeyDown(e, _ctx());
  }

  function _attachViewport(el) {
    viewport = el;
    el.addEventListener('wheel', _onWheel, { passive: false });
    el.addEventListener('pointerdown', _onPointerDown);
    window.addEventListener('pointermove', _onPointerMove);
    window.addEventListener('pointerup', _onPointerUp);
    el.addEventListener('dblclick', _onDblClick);
    window.addEventListener('keydown', _onKeyDown);
  }

  window.toolManager = {
    get active() { return activeId; },
    isActive(id) { return activeId === id; },
    register(id, handlers) { tools.set(id, handlers || {}); },
    activate(id) { _activate(id); },
    attachViewport(el) { _attachViewport(el); },
  };

  window.toolManager.register('select', {});

  // Bootstrap au DOMContentLoaded
  window.addEventListener('DOMContentLoaded', () => {
    const main = document.querySelector('main');
    if (main) window.toolManager.attachViewport(main);
    if (window.appStore) appStore.set({ activeTool: activeId });

    // Reflet visuel sur la palette d'outils
    if (window.appStore) {
      const baseCls = 'tool-icon w-10 h-10 flex items-center justify-center rounded-lg text-xl hover:bg-gray-700 transition';
      const activeCls = baseCls + ' bg-indigo-600 hover:bg-indigo-500 ring-2 ring-indigo-300';
      appStore.subscribeKey('activeTool', (tool) => {
        document.querySelectorAll('.tool-icon').forEach(btn => {
          btn.className = btn.dataset.tool === tool ? activeCls : baseCls;
        });
      });
      // État initial
      document.querySelectorAll('.tool-icon').forEach(btn => {
        if (btn.dataset.tool === activeId) btn.className = activeCls;
      });
    }

    // Raccourcis clavier
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const map = { v: 'select', s: 'sprite', i: 'inpaint' };
      const tool = map[e.key.toLowerCase()];
      if (tool) {
        e.preventDefault();
        _activate(tool);
      }
    });
  });
})();
