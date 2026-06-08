// ============================================================
// DOMAINE PUR — types et helpers sans DOM ni IO
//
// Exposé sur `window.domain`. Toutes les fonctions sont pures :
// elles prennent du data, retournent du data. Aucun side-effect.
// Faciles à tester. Réutilisables.
// ============================================================

(function () {
  // ------- Document -------
  function createDoc({ id, name, base }) {
    const now = new Date().toISOString();
    return {
      version: 1,
      id,
      name,
      created_at: now,
      updated_at: now,
      base,
      layers: [],
    };
  }

  function withUpdatedAt(doc) {
    return { ...doc, updated_at: new Date().toISOString() };
  }

  // ------- Layers (mutations immuables : retournent un NOUVEAU doc) -------
  function addLayer(doc, layer) {
    return withUpdatedAt({ ...doc, layers: [...(doc.layers || []), layer] });
  }

  function removeLayer(doc, layerId) {
    return withUpdatedAt({
      ...doc,
      layers: (doc.layers || []).filter(l => l.id !== layerId),
    });
  }

  function removeLayerAt(doc, index) {
    const layers = (doc.layers || []).slice();
    layers.splice(index, 1);
    return withUpdatedAt({ ...doc, layers });
  }

  function updateLayer(doc, layerId, patch) {
    return withUpdatedAt({
      ...doc,
      layers: (doc.layers || []).map(l => l.id === layerId ? { ...l, ...patch } : l),
    });
  }

  function setLayerVisibility(doc, layerId, visible) {
    return updateLayer(doc, layerId, { visible });
  }

  function moveLayer(doc, index, direction) {
    const layers = (doc.layers || []).slice();
    const j = index + direction;
    if (j < 0 || j >= layers.length) return doc;
    const tmp = layers[index];
    layers[index] = layers[j];
    layers[j] = tmp;
    return withUpdatedAt({ ...doc, layers });
  }

  function findLayer(doc, predicate) {
    return (doc.layers || []).find(predicate);
  }

  function findLayerByType(doc, type) {
    return (doc.layers || []).find(l => l.type === type);
  }

  // ------- Layer factories -------
  function makeSpriteLayer(sprites) {
    return {
      id: 'sprites', // un seul calque sprite par doc pour l'instant
      type: 'sprites',
      visible: true,
      sprites: sprites || [],
    };
  }

  function makeInpaintLayer({ id, image_path, prompt }) {
    return {
      id,
      type: 'inpaint',
      visible: true,
      image_path,
      prompt,
    };
  }

  // ------- Conversions de coordonnées -------
  // Convertit des pixels naturels de l'image vers les pixels CSS de l'overlay
  function imageToOverlay(x, y, natural, overlay) {
    if (!natural.w || !overlay.w) return { x: 0, y: 0 };
    return {
      x: x * (overlay.w / natural.w),
      y: y * (overlay.h / natural.h),
    };
  }

  // Convertit des pixels CSS d'overlay vers pixels naturels d'image
  function overlayToImage(x, y, natural, overlay) {
    if (!overlay.w || !natural.w) return { x: 0, y: 0 };
    return {
      x: x * (natural.w / overlay.w),
      y: y * (natural.h / overlay.h),
    };
  }

  window.domain = {
    // Document
    createDoc,
    withUpdatedAt,
    // Layers
    addLayer,
    removeLayer,
    removeLayerAt,
    updateLayer,
    setLayerVisibility,
    moveLayer,
    findLayer,
    findLayerByType,
    makeSpriteLayer,
    makeInpaintLayer,
    // Coords
    imageToOverlay,
    overlayToImage,
  };
})();
