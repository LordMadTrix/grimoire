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
    ...mapStore.stamps.map((s) => ({ type: 'stamp' as const, id: s.id })),
    ...mapStore.texts.map((t) => ({ type: 'text' as const, id: t.id })),
    ...mapStore.shapes.map((s) => ({ type: 'shape' as const, id: s.id })),
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
