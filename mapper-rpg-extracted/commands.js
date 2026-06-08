// ============================================================
// COMMANDES TYPÉES
//
// Interface Command : { apply(ctx), label() }
// ctx fourni par undo.js : { setDoc(json), persist(json) }
//
// `apply` exécute la mutation. L'undo se fait via le snapshot pris par
// `dispatch()` AVANT l'apply (voir undo.js). Pas besoin d'une `revert`.
//
// Avantage vs un simple snapshot direct : intention préservée (label pour
// debug/replay), mutations testables, futures commandes inverses possibles.
// ============================================================

(function () {
  function _applyDoc(ctx, newDoc) {
    const json = JSON.stringify(newDoc);
    ctx.setDoc(json);
    ctx.persist(json);
  }

  // ---- PlaceSprite ----
  class PlaceSpriteCommand {
    constructor(spriteData) {
      this.sprite = spriteData; // { sprite_id, x, y, w, angle }
    }
    apply(ctx) {
      const doc = currentDoc || domain.createDoc({
        id: currentMap.id,
        name: currentMap.name,
        base: { kind: 'ai', image_path: currentMap.image_path, prompt: currentMap.prompt, style: currentMap.style, size: currentMap.size, elements: currentMap.elements || [] },
      });
      const layer = domain.findLayerByType(doc, 'sprites');
      const newDoc = layer
        ? domain.updateLayer(doc, layer.id, { sprites: [...layer.sprites, this.sprite] })
        : domain.addLayer(doc, domain.makeSpriteLayer([this.sprite]));
      _applyDoc(ctx, newDoc);
    }
    label() { return `place sprite #${this.sprite.sprite_id}`; }
  }

  // ---- DeleteSpriteAtIndex ----
  class DeleteSpriteCommand {
    constructor(index) {
      this.index = index;
    }
    apply(ctx) {
      const doc = currentDoc;
      if (!doc) return;
      const layer = domain.findLayerByType(doc, 'sprites');
      if (!layer) return;
      const sprites = layer.sprites.slice();
      sprites.splice(this.index, 1);
      const newDoc = sprites.length > 0
        ? domain.updateLayer(doc, layer.id, { sprites })
        : domain.removeLayer(doc, layer.id);
      _applyDoc(ctx, newDoc);
    }
    label() { return `delete sprite [${this.index}]`; }
  }

  // ---- AddInpaintLayer ----
  class AddInpaintLayerCommand {
    constructor(layerData) {
      this.layer = layerData; // { id, image_path, prompt }
    }
    apply(ctx) {
      const doc = currentDoc;
      if (!doc) return;
      const newDoc = domain.addLayer(doc, domain.makeInpaintLayer(this.layer));
      _applyDoc(ctx, newDoc);
    }
    label() { return `inpaint: ${this.layer.prompt || ''}`; }
  }

  window.commands = {
    PlaceSpriteCommand,
    DeleteSpriteCommand,
    AddInpaintLayerCommand,
  };
})();
