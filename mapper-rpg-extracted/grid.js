// ============================================================
// GRILLE JDR : calque permanent indépendant
// Toggle + paramètres dans un popover ancré sur la nav.
// État persisté via localStorage.
// ============================================================

const GRID_STORAGE_KEY = 'mapper-rpg-grid-v1';

function defaultGridState() {
  return {
    enabled: false,
    type: 'square',
    size: 64,
    thickness: 1,
    color: '#ffffff',
    opacity: 50,
    offsetX: 0,
    offsetY: 0,
  };
}

function loadGridState() {
  try {
    const raw = localStorage.getItem(GRID_STORAGE_KEY);
    if (raw) return { ...defaultGridState(), ...JSON.parse(raw) };
  } catch {}
  return defaultGridState();
}

function saveGridState(s) {
  try { localStorage.setItem(GRID_STORAGE_KEY, JSON.stringify(s)); } catch {}
}

function applyGridStateToUI(s) {
  document.getElementById('grid-enabled').checked = s.enabled;
  document.getElementById('grid-type').value = s.type;
  document.getElementById('grid-size').value = s.size;
  document.getElementById('grid-thickness').value = s.thickness;
  document.getElementById('grid-color').value = s.color;
  document.getElementById('grid-opacity').value = s.opacity;
  document.getElementById('grid-offset-x').value = s.offsetX;
  document.getElementById('grid-offset-y').value = s.offsetY;
  syncGridLabels();
}

function readGridStateFromUI() {
  return {
    enabled: document.getElementById('grid-enabled').checked,
    type: document.getElementById('grid-type').value,
    size: parseInt(document.getElementById('grid-size').value, 10),
    thickness: parseInt(document.getElementById('grid-thickness').value, 10),
    color: document.getElementById('grid-color').value,
    opacity: parseInt(document.getElementById('grid-opacity').value, 10),
    offsetX: parseInt(document.getElementById('grid-offset-x').value, 10),
    offsetY: parseInt(document.getElementById('grid-offset-y').value, 10),
  };
}

function syncGridLabels() {
  document.getElementById('grid-size-val').textContent = document.getElementById('grid-size').value;
  document.getElementById('grid-thickness-val').textContent = document.getElementById('grid-thickness').value;
  document.getElementById('grid-opacity-val').textContent = document.getElementById('grid-opacity').value;
  document.getElementById('grid-offset-x-val').textContent = document.getElementById('grid-offset-x').value;
  document.getElementById('grid-offset-y-val').textContent = document.getElementById('grid-offset-y').value;
}

function toggleGridPopover(e) {
  if (e) e.stopPropagation();
  const pop = document.getElementById('grid-popover');
  pop.style.display = (pop.style.display === 'none' || !pop.style.display) ? 'block' : 'none';
}

function onGridParamChange() {
  syncGridLabels();
  const s = readGridStateFromUI();
  saveGridState(s);
  refreshGridLayer();
  updateGridButtonState(s.enabled);
}

function onGridToggle() {
  onGridParamChange();
}

function updateGridButtonState(on) {
  const btn = document.getElementById('grid-toggle-btn');
  if (!btn) return;
  const base = 'w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-700 transition';
  btn.className = on
    ? base + ' bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-300'
    : base + ' text-gray-200';
}

function positionGridCanvas() {
  const img = document.getElementById('result-img');
  const canvas = document.getElementById('grid-canvas');
  if (!img || !canvas || !img.naturalWidth) return;
  const parent = canvas.parentElement;
  if (!parent) return;
  const imgRect = img.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  canvas.style.left = (imgRect.left - parentRect.left) + 'px';
  canvas.style.top = (imgRect.top - parentRect.top) + 'px';
  canvas.style.width = imgRect.width + 'px';
  canvas.style.height = imgRect.height + 'px';
  if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
  }
}

function refreshGridLayer() {
  const s = readGridStateFromUI();
  const canvas = document.getElementById('grid-canvas');
  if (!canvas) return;
  const resultVisible = document.getElementById('result').style.display === 'flex';
  if (!s.enabled || !resultVisible) {
    canvas.classList.add('hidden');
    return;
  }
  canvas.classList.remove('hidden');
  positionGridCanvas();
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGridOnCtx(ctx, canvas.width, canvas.height, s);
}

function drawGridOnCtx(ctx, w, h, p) {
  ctx.save();
  ctx.globalAlpha = p.opacity / 100;
  ctx.strokeStyle = p.color;
  ctx.lineWidth = p.thickness;
  ctx.lineCap = 'butt';

  if (p.type === 'square') {
    ctx.beginPath();
    for (let x = ((p.offsetX % p.size) + p.size) % p.size; x <= w; x += p.size) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = ((p.offsetY % p.size) + p.size) % p.size; y <= h; y += p.size) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();
  } else if (p.type === 'hex') {
    const r = p.size / Math.sqrt(3);
    const hexW = 2 * r;
    const hexH = Math.sqrt(3) * r;
    const stepX = 1.5 * r;
    const stepY = hexH;

    const startCol = Math.floor((-p.offsetX - hexW) / stepX) - 1;
    const endCol = Math.ceil((w - p.offsetX + hexW) / stepX) + 1;
    const startRow = Math.floor((-p.offsetY - hexH) / stepY) - 1;
    const endRow = Math.ceil((h - p.offsetY + hexH) / stepY) + 1;

    ctx.beginPath();
    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        const cx = p.offsetX + col * stepX;
        const cy = p.offsetY + row * stepY + ((col & 1) ? stepY / 2 : 0);
        const corners = [];
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          corners.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
        }
        for (const [a, b] of [[0,1],[1,2],[2,3]]) {
          ctx.moveTo(corners[a][0], corners[a][1]);
          ctx.lineTo(corners[b][0], corners[b][1]);
        }
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Init au load : restaure l'état, raccroche le rendu aux changements d'image / zoom
window.addEventListener('DOMContentLoaded', () => {
  const s = loadGridState();
  applyGridStateToUI(s);
  updateGridButtonState(s.enabled);

  // Fermer le popover quand on clique ailleurs
  document.addEventListener('click', (e) => {
    const pop = document.getElementById('grid-popover');
    const btn = document.getElementById('grid-toggle-btn');
    if (!pop || pop.style.display === 'none') return;
    if (pop.contains(e.target) || btn.contains(e.target)) return;
    pop.style.display = 'none';
  });

  window.addEventListener('resize', refreshGridLayer);
});

// Abonnements propres au store (remplace les monkey-patches)
window.addEventListener('DOMContentLoaded', () => {
  if (!window.appStore) return;

  // Quand la vue change (zoom/pan), repositionner et redessiner la grille
  appStore.subscribeKey('view', refreshGridLayer);

  // Quand le document change (carte chargée), attendre que l'image soit prête
  // avant de dessiner la grille (pour avoir naturalWidth)
  appStore.subscribeKey('doc', () => {
    const img = document.getElementById('result-img');
    if (!img) return;
    const apply = () => refreshGridLayer();
    if (img.complete && img.naturalWidth) apply();
    else img.addEventListener('load', apply, { once: true });
  });
});
