// Actions PAO (publication assistée par ordinateur) sur la multi-sélection :
// alignement, distribution, ordre d'empilement, duplication, déplacement précis.
import { mapStore, pushHistory, type SelectedRef, type SelectableType } from './stores/mapStore.svelte';

export interface ElementBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
}

// Le canevas (qui connaît les dimensions réelles des images) enregistre ici
// sa fonction de mesure ; les actions retombent sur un point si absent.
let measurer: ((type: SelectableType, id: string) => ElementBBox | null) | null = null;

export function setElementMeasurer(fn: (type: SelectableType, id: string) => ElementBBox | null) {
  measurer = fn;
}

export function getBBox(ref: SelectedRef): ElementBBox | null {
  if (measurer) {
    const box = measurer(ref.type, ref.id);
    if (box) return box;
  }
  // Repli : centre seul (bbox de taille nulle)
  const center = getCenter(ref);
  if (!center) return null;
  return { minX: center.x, minY: center.y, maxX: center.x, maxY: center.y, cx: center.x, cy: center.y };
}

function getCenter(ref: SelectedRef): { x: number; y: number } | null {
  if (ref.type === 'stamp') {
    const s = mapStore.stamps.find((s) => s.id === ref.id);
    return s ? { x: s.x, y: s.y } : null;
  }
  if (ref.type === 'text') {
    const t = mapStore.texts.find((t) => t.id === ref.id);
    return t ? { x: t.x, y: t.y } : null;
  }
  const sh = mapStore.shapes.find((s) => s.id === ref.id);
  if (!sh || sh.points.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of sh.points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

// Sélection : maintient selectedElement (hérité) et selectedIds (multi) cohérents.
export function setSelection(items: SelectedRef[]) {
  mapStore.selectedIds = items;
  mapStore.selectedElement = items.length > 0 ? { ...items[0] } : null;
}

export function toggleInSelection(item: SelectedRef) {
  const idx = mapStore.selectedIds.findIndex((s) => s.id === item.id && s.type === item.type);
  if (idx >= 0) {
    setSelection(mapStore.selectedIds.filter((_, i) => i !== idx));
  } else {
    setSelection([...mapStore.selectedIds, item]);
  }
}

export function isInSelection(type: SelectableType, id: string): boolean {
  return mapStore.selectedIds.some((s) => s.type === type && s.id === id);
}

export function selectAll() {
  setSelection([
    ...mapStore.stamps.filter((s) => !s.locked).map((s) => ({ type: 'stamp' as const, id: s.id })),
    ...mapStore.texts.filter((t) => !t.locked).map((t) => ({ type: 'text' as const, id: t.id })),
    ...mapStore.shapes.filter((s) => !s.locked).map((s) => ({ type: 'shape' as const, id: s.id })),
  ]);
}

export function clearSelection() {
  setSelection([]);
}

// Déplacer un élément d'un delta
function moveElementBy(ref: SelectedRef, dx: number, dy: number) {
  if (ref.type === 'stamp') {
    mapStore.stamps = mapStore.stamps.map((s) => (s.id === ref.id ? { ...s, x: s.x + dx, y: s.y + dy } : s));
  } else if (ref.type === 'text') {
    mapStore.texts = mapStore.texts.map((t) => (t.id === ref.id ? { ...t, x: t.x + dx, y: t.y + dy } : t));
  } else {
    mapStore.shapes = mapStore.shapes.map((s) =>
      s.id === ref.id ? { ...s, points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) } : s
    );
  }
}

export function moveSelectionBy(dx: number, dy: number, withHistory = false) {
  if (mapStore.selectedIds.length === 0) return;
  if (withHistory) pushHistory();
  for (const ref of mapStore.selectedIds) moveElementBy(ref, dx, dy);
}

export type AlignMode = 'left' | 'centerH' | 'right' | 'top' | 'middle' | 'bottom';

export function alignSelection(mode: AlignMode) {
  const refs = mapStore.selectedIds;
  if (refs.length < 2) return;
  const boxes = refs.map((r) => ({ ref: r, box: getBBox(r) })).filter((b) => b.box) as { ref: SelectedRef; box: ElementBBox }[];
  if (boxes.length < 2) return;

  const minX = Math.min(...boxes.map((b) => b.box.minX));
  const maxX = Math.max(...boxes.map((b) => b.box.maxX));
  const minY = Math.min(...boxes.map((b) => b.box.minY));
  const maxY = Math.max(...boxes.map((b) => b.box.maxY));
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  pushHistory();
  for (const { ref, box } of boxes) {
    let dx = 0, dy = 0;
    if (mode === 'left') dx = minX - box.minX;
    else if (mode === 'centerH') dx = midX - box.cx;
    else if (mode === 'right') dx = maxX - box.maxX;
    else if (mode === 'top') dy = minY - box.minY;
    else if (mode === 'middle') dy = midY - box.cy;
    else if (mode === 'bottom') dy = maxY - box.maxY;
    if (dx !== 0 || dy !== 0) moveElementBy(ref, dx, dy);
  }
}

export function distributeSelection(axis: 'h' | 'v') {
  const refs = mapStore.selectedIds;
  if (refs.length < 3) return;
  const boxes = refs.map((r) => ({ ref: r, box: getBBox(r) })).filter((b) => b.box) as { ref: SelectedRef; box: ElementBBox }[];
  if (boxes.length < 3) return;

  boxes.sort((a, b) => (axis === 'h' ? a.box.cx - b.box.cx : a.box.cy - b.box.cy));
  const first = axis === 'h' ? boxes[0].box.cx : boxes[0].box.cy;
  const last = axis === 'h' ? boxes[boxes.length - 1].box.cx : boxes[boxes.length - 1].box.cy;
  const step = (last - first) / (boxes.length - 1);

  pushHistory();
  boxes.forEach(({ ref, box }, i) => {
    const target = first + step * i;
    if (axis === 'h') moveElementBy(ref, target - box.cx, 0);
    else moveElementBy(ref, 0, target - box.cy);
  });
}

export type ZOrderDir = 'front' | 'back' | 'forward' | 'backward';

export function zOrderSelection(dir: ZOrderDir) {
  if (mapStore.selectedIds.length === 0) return;
  pushHistory();

  // Tampons : via zIndex (le rendu trie par zIndex puis Y)
  const stampIds = new Set(mapStore.selectedIds.filter((r) => r.type === 'stamp').map((r) => r.id));
  if (stampIds.size > 0) {
    const zs = mapStore.stamps.map((s) => s.zIndex ?? 0);
    const maxZ = zs.length ? Math.max(...zs) : 0;
    const minZ = zs.length ? Math.min(...zs) : 0;
    mapStore.stamps = mapStore.stamps.map((s) => {
      if (!stampIds.has(s.id)) return s;
      const z = s.zIndex ?? 0;
      const next = dir === 'front' ? maxZ + 1 : dir === 'back' ? minZ - 1 : dir === 'forward' ? z + 1 : z - 1;
      return { ...s, zIndex: next };
    });
  }

  // Textes et formes : via la position dans le tableau (ordre de dessin)
  const reorder = <T extends { id: string }>(arr: T[], ids: Set<string>): T[] => {
    if (ids.size === 0) return arr;
    const result = [...arr];
    const indices = result.map((el, i) => (ids.has(el.id) ? i : -1)).filter((i) => i >= 0);
    if (dir === 'front') {
      const picked = indices.map((i) => result[i]);
      const rest = result.filter((el) => !ids.has(el.id));
      return [...rest, ...picked];
    }
    if (dir === 'back') {
      const picked = indices.map((i) => result[i]);
      const rest = result.filter((el) => !ids.has(el.id));
      return [...picked, ...rest];
    }
    if (dir === 'forward') {
      for (let k = indices.length - 1; k >= 0; k--) {
        const i = indices[k];
        if (i < result.length - 1 && !ids.has(result[i + 1].id)) {
          [result[i], result[i + 1]] = [result[i + 1], result[i]];
        }
      }
    } else {
      for (let k = 0; k < indices.length; k++) {
        const i = indices[k];
        if (i > 0 && !ids.has(result[i - 1].id)) {
          [result[i], result[i - 1]] = [result[i - 1], result[i]];
        }
      }
    }
    return result;
  };

  const textIds = new Set(mapStore.selectedIds.filter((r) => r.type === 'text').map((r) => r.id));
  const shapeIds = new Set(mapStore.selectedIds.filter((r) => r.type === 'shape').map((r) => r.id));
  mapStore.texts = reorder(mapStore.texts, textIds);
  mapStore.shapes = reorder(mapStore.shapes, shapeIds);
}

export function duplicateSelection() {
  if (mapStore.selectedIds.length === 0) return;
  pushHistory();
  const OFFSET = 24;
  const newRefs: SelectedRef[] = [];
  const newId = () => Math.random().toString(36).slice(2);

  for (const ref of mapStore.selectedIds) {
    if (ref.type === 'stamp') {
      const src = mapStore.stamps.find((s) => s.id === ref.id);
      if (src) {
        const clone = { ...src, id: newId(), x: src.x + OFFSET, y: src.y + OFFSET };
        mapStore.stamps = [...mapStore.stamps, clone];
        newRefs.push({ type: 'stamp', id: clone.id });
      }
    } else if (ref.type === 'text') {
      const src = mapStore.texts.find((t) => t.id === ref.id);
      if (src) {
        const clone = { ...src, id: newId(), x: src.x + OFFSET, y: src.y + OFFSET };
        mapStore.texts = [...mapStore.texts, clone];
        newRefs.push({ type: 'text', id: clone.id });
      }
    } else {
      const src = mapStore.shapes.find((s) => s.id === ref.id);
      if (src) {
        const clone = {
          ...src,
          id: newId(),
          points: src.points.map((p) => ({ x: p.x + OFFSET, y: p.y + OFFSET })),
        };
        mapStore.shapes = [...mapStore.shapes, clone];
        newRefs.push({ type: 'shape', id: clone.id });
      }
    }
  }
  setSelection(newRefs);
}

// ── Transformations libres (rotation, échelle, miroir) ──

// Un rectangle défini par 2 coins ne peut pas pivoter : on le convertit en polygone à 4 points.
export function rectangleToPolygonPoints(p0: { x: number; y: number }, p1: { x: number; y: number }) {
  const minX = Math.min(p0.x, p1.x);
  const maxX = Math.max(p0.x, p1.x);
  const minY = Math.min(p0.y, p1.y);
  const maxY = Math.max(p0.y, p1.y);
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

export function rotatePointsAround(points: { x: number; y: number }[], center: { x: number; y: number }, rad: number) {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return points.map((p) => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
  });
}

function shapeCenter(points: { x: number; y: number }[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

// Pivoter toute la sélection de `deltaDeg` degrés.
// Un seul élément : il pivote sur lui-même. Plusieurs : le groupe pivote
// autour de son centre commun (les positions tournent aussi), façon PAO.
export function rotateSelection(deltaDeg: number) {
  const refs = mapStore.selectedIds;
  if (refs.length === 0) return;
  pushHistory();
  const rad = (deltaDeg * Math.PI) / 180;

  let groupCenter: { x: number; y: number } | null = null;
  if (refs.length > 1) {
    const boxes = refs.map((r) => getBBox(r)).filter(Boolean) as ElementBBox[];
    if (boxes.length > 0) {
      groupCenter = {
        x: (Math.min(...boxes.map((b) => b.minX)) + Math.max(...boxes.map((b) => b.maxX))) / 2,
        y: (Math.min(...boxes.map((b) => b.minY)) + Math.max(...boxes.map((b) => b.maxY))) / 2,
      };
    }
  }
  const rotatePos = (x: number, y: number) => {
    if (!groupCenter) return { x, y };
    const [p] = rotatePointsAround([{ x, y }], groupCenter, rad);
    return p;
  };

  for (const ref of refs) {
    if (ref.type === 'stamp') {
      mapStore.stamps = mapStore.stamps.map((s) => {
        if (s.id !== ref.id) return s;
        let rot = Math.round(s.rotation + deltaDeg);
        rot = ((rot + 180) % 360 + 360) % 360 - 180;
        const pos = rotatePos(s.x, s.y);
        return { ...s, rotation: rot, x: pos.x, y: pos.y };
      });
    } else if (ref.type === 'text') {
      mapStore.texts = mapStore.texts.map((t) => {
        if (t.id !== ref.id) return t;
        let rot = Math.round(t.rotation + deltaDeg);
        rot = ((rot + 180) % 360 + 360) % 360 - 180;
        const pos = rotatePos(t.x, t.y);
        return { ...t, rotation: rot, x: pos.x, y: pos.y };
      });
    } else {
      mapStore.shapes = mapStore.shapes.map((s) => {
        if (s.id !== ref.id) return s;
        if (s.type === 'circle') {
          // Un cercle est invariant par rotation sur lui-même, mais son centre tourne dans un groupe
          if (!groupCenter) return s;
          return { ...s, points: rotatePointsAround(s.points, groupCenter, rad) };
        }
        const pts = s.type === 'rectangle' && s.points.length > 1
          ? rectangleToPolygonPoints(s.points[0], s.points[1])
          : s.points;
        const center = groupCenter ?? shapeCenter(pts);
        return { ...s, type: 'polygon' as const, points: rotatePointsAround(pts, center, rad) };
      });
    }
  }
}

// ── Presse-papiers interne (copier / couper / coller) ──
interface ClipboardData {
  stamps: typeof mapStore.stamps;
  texts: typeof mapStore.texts;
  shapes: typeof mapStore.shapes;
}
let clipboard: ClipboardData | null = null;

// Clonage JSON : les éléments de carte sont de purs objets sérialisables,
// et structuredClone échoue sur les proxies réactifs de Svelte 5.
const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function copySelection(): number {
  const refs = mapStore.selectedIds;
  if (refs.length === 0) return 0;
  const ids = (type: SelectableType) => new Set(refs.filter((r) => r.type === type).map((r) => r.id));
  clipboard = {
    stamps: deepClone(mapStore.stamps.filter((s) => ids('stamp').has(s.id))),
    texts: deepClone(mapStore.texts.filter((t) => ids('text').has(t.id))),
    shapes: deepClone(mapStore.shapes.filter((s) => ids('shape').has(s.id))),
  };
  return refs.length;
}

export function cutSelection(): number {
  const n = copySelection();
  if (n > 0) deleteSelection();
  return n;
}

export function hasClipboard(): boolean {
  return clipboard !== null;
}

// Coller : centré sur `at` (position du curseur) si fournie, sinon décalé de 24 px
export function pasteClipboard(at?: { x: number; y: number }) {
  if (!clipboard) return;
  pushHistory();
  const newId = () => Math.random().toString(36).slice(2);

  // Centre du contenu du presse-papiers pour le recentrer sur la cible
  const xs: number[] = [];
  const ys: number[] = [];
  clipboard.stamps.forEach((s) => { xs.push(s.x); ys.push(s.y); });
  clipboard.texts.forEach((t) => { xs.push(t.x); ys.push(t.y); });
  clipboard.shapes.forEach((s) => s.points.forEach((p) => { xs.push(p.x); ys.push(p.y); }));
  if (xs.length === 0) return;
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const dx = at ? at.x - cx : 24;
  const dy = at ? at.y - cy : 24;

  const newRefs: SelectedRef[] = [];
  for (const src of clipboard.stamps) {
    const clone = { ...deepClone(src), id: newId(), x: src.x + dx, y: src.y + dy, locked: false };
    mapStore.stamps = [...mapStore.stamps, clone];
    newRefs.push({ type: 'stamp', id: clone.id });
  }
  for (const src of clipboard.texts) {
    const clone = { ...deepClone(src), id: newId(), x: src.x + dx, y: src.y + dy, locked: false };
    mapStore.texts = [...mapStore.texts, clone];
    newRefs.push({ type: 'text', id: clone.id });
  }
  for (const src of clipboard.shapes) {
    const clone = {
      ...deepClone(src),
      id: newId(),
      locked: false,
      points: src.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    };
    mapStore.shapes = [...mapStore.shapes, clone];
    newRefs.push({ type: 'shape', id: clone.id });
  }
  setSelection(newRefs);
}

// ── Verrouillage ──
export function lockSelection() {
  const refs = mapStore.selectedIds;
  if (refs.length === 0) return;
  pushHistory();
  const ids = (type: SelectableType) => new Set(refs.filter((r) => r.type === type).map((r) => r.id));
  const stampIds = ids('stamp');
  const textIds = ids('text');
  const shapeIds = ids('shape');
  if (stampIds.size) mapStore.stamps = mapStore.stamps.map((s) => (stampIds.has(s.id) ? { ...s, locked: true } : s));
  if (textIds.size) mapStore.texts = mapStore.texts.map((t) => (textIds.has(t.id) ? { ...t, locked: true } : t));
  if (shapeIds.size) mapStore.shapes = mapStore.shapes.map((s) => (shapeIds.has(s.id) ? { ...s, locked: true } : s));
  clearSelection(); // un élément verrouillé n'est plus sélectionnable
}

export function unlockAll() {
  pushHistory();
  mapStore.stamps = mapStore.stamps.map((s) => (s.locked ? { ...s, locked: false } : s));
  mapStore.texts = mapStore.texts.map((t) => (t.locked ? { ...t, locked: false } : t));
  mapStore.shapes = mapStore.shapes.map((s) => (s.locked ? { ...s, locked: false } : s));
}

export function countLocked(): number {
  return (
    mapStore.stamps.filter((s) => s.locked).length +
    mapStore.texts.filter((t) => t.locked).length +
    mapStore.shapes.filter((s) => s.locked).length
  );
}

// ── Opacité de la sélection ──
export function setSelectionOpacity(value: number) {
  const refs = mapStore.selectedIds;
  if (refs.length === 0) return;
  const v = Math.max(0.05, Math.min(1, value));
  for (const ref of refs) {
    if (ref.type === 'stamp') {
      mapStore.stamps = mapStore.stamps.map((s) => (s.id === ref.id ? { ...s, opacity: v } : s));
    } else if (ref.type === 'text') {
      mapStore.texts = mapStore.texts.map((t) => (t.id === ref.id ? { ...t, opacity: v } : t));
    } else {
      mapStore.shapes = mapStore.shapes.map((s) => (s.id === ref.id ? { ...s, fillOpacity: v } : s));
    }
  }
}

export function getSelectionOpacity(): number {
  const ref = mapStore.selectedIds[0];
  if (!ref) return 1;
  if (ref.type === 'stamp') return mapStore.stamps.find((s) => s.id === ref.id)?.opacity ?? 1;
  if (ref.type === 'text') return mapStore.texts.find((t) => t.id === ref.id)?.opacity ?? 1;
  return mapStore.shapes.find((s) => s.id === ref.id)?.fillOpacity ?? 1;
}

// Agrandir / réduire toute la sélection d'un facteur (1.1 = +10 %)
export function scaleSelection(factor: number) {
  if (mapStore.selectedIds.length === 0) return;
  pushHistory();
  for (const ref of mapStore.selectedIds) {
    if (ref.type === 'stamp') {
      mapStore.stamps = mapStore.stamps.map((s) =>
        s.id === ref.id ? { ...s, scale: Math.max(0.05, Math.min(10, Number((s.scale * factor).toFixed(3)))) } : s
      );
    } else if (ref.type === 'text') {
      mapStore.texts = mapStore.texts.map((t) =>
        t.id === ref.id ? { ...t, size: Math.max(8, Math.min(300, Math.round(t.size * factor))) } : t
      );
    } else {
      mapStore.shapes = mapStore.shapes.map((s) => {
        if (s.id !== ref.id) return s;
        const c = shapeCenter(s.points);
        return { ...s, points: s.points.map((p) => ({ x: c.x + (p.x - c.x) * factor, y: c.y + (p.y - c.y) * factor })) };
      });
    }
  }
}

// Miroir horizontal ou vertical. À plusieurs : les positions sont aussi
// réfléchies autour du centre du groupe (comportement PAO standard).
export function flipSelection(axis: 'h' | 'v') {
  const refs = mapStore.selectedIds;
  if (refs.length === 0) return;
  pushHistory();

  let groupCenter: { x: number; y: number } | null = null;
  if (refs.length > 1) {
    const boxes = refs.map((r) => getBBox(r)).filter(Boolean) as ElementBBox[];
    if (boxes.length > 0) {
      groupCenter = {
        x: (Math.min(...boxes.map((b) => b.minX)) + Math.max(...boxes.map((b) => b.maxX))) / 2,
        y: (Math.min(...boxes.map((b) => b.minY)) + Math.max(...boxes.map((b) => b.maxY))) / 2,
      };
    }
  }
  const mirror = (v: number, c: number) => 2 * c - v;

  for (const ref of refs) {
    if (ref.type === 'stamp') {
      mapStore.stamps = mapStore.stamps.map((s) => {
        if (s.id !== ref.id) return s;
        const next = { ...s };
        if (axis === 'h') {
          next.flipH = !s.flipH;
          next.rotation = -s.rotation;
          if (groupCenter) next.x = mirror(s.x, groupCenter.x);
        } else {
          next.flipV = !s.flipV;
          next.rotation = -s.rotation;
          if (groupCenter) next.y = mirror(s.y, groupCenter.y);
        }
        return next;
      });
    } else if (ref.type === 'text') {
      // Le texte n'est pas mis en miroir glyphe par glyphe (illisible) : seule sa position l'est.
      mapStore.texts = mapStore.texts.map((t) => {
        if (t.id !== ref.id) return t;
        const next = { ...t, rotation: -t.rotation };
        if (groupCenter) {
          if (axis === 'h') next.x = mirror(t.x, groupCenter.x);
          else next.y = mirror(t.y, groupCenter.y);
        }
        return next;
      });
    } else {
      mapStore.shapes = mapStore.shapes.map((s) => {
        if (s.id !== ref.id) return s;
        const c = groupCenter ?? shapeCenter(s.points);
        return {
          ...s,
          points: s.points.map((p) =>
            axis === 'h' ? { x: mirror(p.x, c.x), y: p.y } : { x: p.x, y: mirror(p.y, c.y) }
          ),
        };
      });
    }
  }
}

// Réinitialiser les transformations (rotation 0, échelle 1, miroirs désactivés)
export function resetTransformSelection() {
  if (mapStore.selectedIds.length === 0) return;
  pushHistory();
  for (const ref of mapStore.selectedIds) {
    if (ref.type === 'stamp') {
      mapStore.stamps = mapStore.stamps.map((s) =>
        s.id === ref.id ? { ...s, rotation: 0, scale: 1, flipH: false, flipV: false } : s
      );
    } else if (ref.type === 'text') {
      mapStore.texts = mapStore.texts.map((t) => (t.id === ref.id ? { ...t, rotation: 0 } : t));
    }
    // Formes : pas de transformation mémorisée à réinitialiser (les points sont absolus)
  }
}

export function deleteSelection() {
  if (mapStore.selectedIds.length === 0) return;
  pushHistory();
  const ids = (type: SelectableType) =>
    new Set(mapStore.selectedIds.filter((r) => r.type === type).map((r) => r.id));
  const stampIds = ids('stamp');
  const textIds = ids('text');
  const shapeIds = ids('shape');
  if (stampIds.size) mapStore.stamps = mapStore.stamps.filter((s) => !stampIds.has(s.id));
  if (textIds.size) mapStore.texts = mapStore.texts.filter((t) => !textIds.has(t.id));
  if (shapeIds.size) mapStore.shapes = mapStore.shapes.filter((s) => !shapeIds.has(s.id));
  clearSelection();
}
