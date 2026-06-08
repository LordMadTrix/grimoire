// ============================================================
// ONBOARDING — tour guidé interactif (3 étapes)
//
// Étape 1 : halo sur le textarea #prompt (visible au boot)
// Étape 2 : bulle centrée — inpainting (l'outil n'est visible qu'après gen)
// Étape 3 : bulle centrée — décoration (sprites/grille, idem)
//
// Posé en localStorage après "Terminer" ou "Passer". Ne réapparaît plus.
// Pour le ré-afficher : localStorage.removeItem('mapper-rpg-onboarded')
// ============================================================

const ONBOARDING_KEY = 'mapper-rpg-onboarded';

const TOUR_STEPS = [
  {
    target: '#prompt',
    title: 'Générer une base',
    body: "Décris ta carte ici (taverne sombre, forêt enchantée, donjon ruiné…) puis clique Générer. L'IA produit ton fond en ~70 secondes.",
  },
  {
    target: '[data-tool="inpaint"]',
    title: 'Inpainting',
    body: "<strong class=\"text-red-400\">Régénérer un morceau de map.</strong> Peins une zone sur ta carte et donne un nouveau prompt — l'IA régénère uniquement cette partie. Idéal pour ajouter une porte, changer un mur, corriger un détail.",
  },
  {
    target: '[data-tool="sprite"]',
    title: 'Décoration',
    body: "Place des sprites (personnages, objets, monstres) depuis la bibliothèque ou crée-en avec l'IA. Active aussi la grille (icône à côté) pour gérer le combat tactique.",
  },
];

let _tourIdx = 0;

function startTour() {
  _tourIdx = 0;
  document.getElementById('tour-overlay').style.display = 'block';
  renderTourStep();
}

function renderTourStep() {
  const step = TOUR_STEPS[_tourIdx];
  const total = TOUR_STEPS.length;

  document.getElementById('tour-step-num').textContent = String(_tourIdx + 1);
  document.getElementById('tour-step-total').textContent = `${_tourIdx + 1}/${total}`;
  document.getElementById('tour-title').textContent = step.title;
  document.getElementById('tour-body').innerHTML = step.body;

  document.getElementById('tour-prev-btn').style.visibility = _tourIdx === 0 ? 'hidden' : 'visible';
  const isLast = _tourIdx === total - 1;
  document.getElementById('tour-next-btn').textContent = isLast ? 'Terminer' : 'Suivant';
  // Checkbox "ne plus afficher" uniquement sur la dernière étape
  const wrap = document.getElementById('tour-dontshow-wrap');
  if (isLast) { wrap.classList.remove('hidden'); wrap.classList.add('flex'); }
  else { wrap.classList.add('hidden'); wrap.classList.remove('flex'); }

  const halo = document.getElementById('tour-halo');
  const bubble = document.getElementById('tour-bubble');
  const targetEl = step.target ? document.querySelector(step.target) : null;

  if (targetEl) {
    const r = targetEl.getBoundingClientRect();
    const pad = 8;
    halo.style.display = 'block';
    halo.style.left = (r.left - pad) + 'px';
    halo.style.top = (r.top - pad) + 'px';
    halo.style.width = (r.width + pad * 2) + 'px';
    halo.style.height = (r.height + pad * 2) + 'px';

    // Place la bulle à droite de l'élément si possible, sinon en dessous
    const bw = 380; // largeur approx
    const margin = 16;
    let left, top;
    if (r.right + margin + bw < window.innerWidth) {
      left = r.right + margin;
      top = r.top;
    } else if (r.bottom + margin + 200 < window.innerHeight) {
      left = Math.max(margin, Math.min(r.left, window.innerWidth - bw - margin));
      top = r.bottom + margin;
    } else {
      // fallback centre bas
      left = (window.innerWidth - bw) / 2;
      top = window.innerHeight - 240;
    }
    bubble.style.left = left + 'px';
    bubble.style.top = top + 'px';
    bubble.style.transform = 'none';
  } else {
    // Pas de cible — masque le halo, bulle centrée
    halo.style.display = 'none';
    bubble.style.left = '50%';
    bubble.style.top = '50%';
    bubble.style.transform = 'translate(-50%, -50%)';
  }
}

function tourNext() {
  if (_tourIdx >= TOUR_STEPS.length - 1) {
    endTour();
    return;
  }
  _tourIdx++;
  renderTourStep();
}

function tourPrev() {
  if (_tourIdx === 0) return;
  _tourIdx--;
  renderTourStep();
}

function endTour() {
  // Flag posé uniquement si la case "ne plus afficher" a été cochée
  // (et visible seulement sur la dernière étape — sinon "Passer" ne mémorise rien).
  const cb = document.getElementById('tour-dontshow');
  if (cb && cb.checked) localStorage.setItem(ONBOARDING_KEY, '1');
  document.getElementById('tour-overlay').style.display = 'none';
}

function maybeShowOnboarding() {
  if (localStorage.getItem(ONBOARDING_KEY)) return; // user a coché "ne plus afficher"
  const upd = document.getElementById('update-modal');
  if (upd && upd.style.display === 'flex') {
    setTimeout(maybeShowOnboarding, 1000);
    return;
  }
  // Reset la checkbox à chaque show (sinon état persistant entre sessions)
  const cb = document.getElementById('tour-dontshow');
  if (cb) cb.checked = false;
  startTour();
}

window.addEventListener('DOMContentLoaded', () => {
  // Migration one-shot : avant cette version, le flag était posé automatiquement
  // au "Terminer". Désormais il n'est posé que si l'user coche explicitement.
  // On nettoie l'ancien flag une seule fois pour que l'auto-show reprenne.
  if (!localStorage.getItem('mapper-rpg-tour-migrated-v1')) {
    localStorage.removeItem(ONBOARDING_KEY);
    localStorage.setItem('mapper-rpg-tour-migrated-v1', '1');
  }
  setTimeout(maybeShowOnboarding, 800);
});

// Re-positionne le halo si la fenêtre est redimensionnée pendant le tour
window.addEventListener('resize', () => {
  if (document.getElementById('tour-overlay').style.display === 'block') renderTourStep();
});
