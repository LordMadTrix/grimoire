// ============================================================
// ASSETS — Cache central des images de sprites
//
// Pourquoi : WebView2 (Tauri Windows) annule parfois des streams HTTP/2 quand
// trop de <img src=...> chargent en parallèle (Status 200 avec 0 byte). On
// contourne avec fetch + Blob URL → image complète garantie.
//
// Cette couche UNIQUE évite la duplication. Tout chargement de sprite doit
// passer par ici (picker, canvas, panneau calques, etc.) — un seul endroit
// à corriger si le mécanisme change.
//
// API :
//   assets.getSpritePreview(id) → Promise<string blobURL>
//   assets.getSpriteFull(id)    → Promise<string blobURL>
//   assets.applyToImg(imgEl, id, variant='preview') → assigne img.src dès dispo
// ============================================================

(function () {
  const SPRITE_HOST = 'https://www.maper-rpg.com';
  const _previewCache = new Map(); // id → blobURL
  const _fullCache = new Map();
  const _pending = new Map();      // url → Promise (déduplication des fetch concurrents)

  async function _fetchAsBlobUrl(url) {
    if (_pending.has(url)) return _pending.get(url);
    const p = (async () => {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const blob = await resp.blob();
      if (blob.size === 0) throw new Error('empty body');
      return URL.createObjectURL(blob);
    })().finally(() => _pending.delete(url));
    _pending.set(url, p);
    return p;
  }

  async function getSpritePreview(id) {
    if (_previewCache.has(id)) return _previewCache.get(id);
    const url = await _fetchAsBlobUrl(`${SPRITE_HOST}/sprites/preview/${id}.png`);
    _previewCache.set(id, url);
    return url;
  }

  async function getSpriteFull(id) {
    if (_fullCache.has(id)) return _fullCache.get(id);
    const url = await _fetchAsBlobUrl(`${SPRITE_HOST}/sprites/${id}.png`);
    _fullCache.set(id, url);
    return url;
  }

  // Helper : assigne l'URL à un <img> dès qu'elle est prête.
  // Optionnel : fallback en cas d'échec via le 2e argument.
  function applyToImg(imgEl, id, variant = 'preview', onError = null) {
    const loader = variant === 'full' ? getSpriteFull : getSpritePreview;
    loader(id)
      .then(url => { imgEl.src = url; })
      .catch(err => {
        if (onError) onError(err);
        else console.warn(`Sprite ${variant} #${id} failed`, err);
      });
  }

  window.assets = {
    getSpritePreview,
    getSpriteFull,
    applyToImg,
  };
})();
