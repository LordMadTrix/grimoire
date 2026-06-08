// ============================================================
// STORE — single source of truth + pub-sub
//
// Centralise l'état partagé entre les modules. Toutes les mutations passent
// par `set` ou `update` qui notifient les subscribers.
//
// API :
//   appStore.state                    accès direct (lecture seule conseillée)
//   appStore.get(key?)                lit tout ou une clé
//   appStore.set({ ... })             merge partiel + notify
//   appStore.update(fn)               mutation impérative + notify
//   appStore.subscribe(fn)            listener global ; retourne unsubscribe
//   appStore.subscribeKey(key, fn)    notifie seulement quand state[key] change (par référence)
// ============================================================

(function () {
  const _state = {
    doc: null,                  // document métier (carte affichée + calques)
    mapMeta: null,              // métadonnées (id, image_path, prompt, style, size, ...)
    selectedSpriteIdx: -1,      // index sélectionné dans placedSprites (-1 = aucun)
    view: { scale: 1, tx: 0, ty: 0 }, // zoom/pan en coords écran
    activeTool: 'select',       // outil actif (géré par ToolManager)
  };

  const _subs = new Set();
  const _keySubs = new Map(); // key -> Set<fn>
  const _lastByKey = new Map();

  function _notifyAll() {
    for (const fn of _subs) {
      try { fn(_state); } catch (e) { console.error('store sub error', e); }
    }
    // Notifie les abonnés par-clé si la référence a changé
    for (const [key, subs] of _keySubs) {
      const cur = _state[key];
      if (_lastByKey.get(key) !== cur) {
        _lastByKey.set(key, cur);
        for (const fn of subs) {
          try { fn(cur, _state); } catch (e) { console.error('store keySub error', e); }
        }
      }
    }
  }

  window.appStore = {
    state: _state,
    get(key) { return key ? _state[key] : _state; },
    set(partial) {
      Object.assign(_state, partial);
      _notifyAll();
    },
    update(fn) {
      fn(_state);
      _notifyAll();
    },
    notify() { _notifyAll(); },
    subscribe(fn) {
      _subs.add(fn);
      return () => _subs.delete(fn);
    },
    subscribeKey(key, fn) {
      if (!_keySubs.has(key)) _keySubs.set(key, new Set());
      _keySubs.get(key).add(fn);
      _lastByKey.set(key, _state[key]);
      return () => _keySubs.get(key).delete(fn);
    },
  };

  // ----------------------------------------------------------------
  // Accesseurs sur window pour `currentDoc` et `currentMap` :
  // - Lecture : `currentDoc` → appStore.state.doc
  // - Écriture : `currentDoc = X` → notifie le store
  // Les modules historiques peuvent continuer à les utiliser comme avant.
  // ----------------------------------------------------------------
  Object.defineProperty(window, 'currentDoc', {
    configurable: true,
    get() { return _state.doc; },
    set(v) { _state.doc = v; _notifyAll(); },
  });
  Object.defineProperty(window, 'currentMap', {
    configurable: true,
    get() { return _state.mapMeta; },
    set(v) { _state.mapMeta = v; _notifyAll(); },
  });
})();
