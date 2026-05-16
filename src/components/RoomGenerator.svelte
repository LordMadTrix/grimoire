<script lang="ts">
  let { onclose }: { onclose: () => void } = $props();

  const SHAPES = ['carrée','rectangulaire','circulaire','en L','octogonale','irrégulière'];
  const SIZES = ['petite (4×4m)','moyenne (8×6m)','grande (12×10m)','immense (20×15m)'];
  const PURPOSES = ['chambre de garde','salle du trésor','laboratoire alchimique','crypte','cuisine abandonnée','bibliothèque secrète','salle de torture','chapelle profanée','arsenal','cellules de prisonnier','salle du trône décrépite','réserve à provisions'];
  const FEATURES = [
    'une fosse centrale couverte de rouille',
    'des graffitis en langue inconnue sur les murs',
    'un puits bouché depuis des décennies',
    'des colonnes brisées qui soutiennent encore le plafond',
    'un brasero froid au centre',
    'des chaînes pendant au plafond',
    'une mare d\'eau stagnante dans un coin',
    'un miroir brisé aux reflets troublants',
    'des symboles de Chaos gravés sur le sol',
    'une tapisserie à moitié brûlée représentant une bataille',
    'un escalier secret derrière une étagère pivotante',
    'des empreintes de pas fraîches dans la poussière',
  ];
  const SMELLS = ['de moisissure','de soufre','de sang séché','de viande pourrie','d\'encens brûlé','de terre humide','de fumée froide','de cuir tanné'];
  const SOUNDS = ['un goutte-à-goutte lointain','le grattement de griffes dans les murs','le souffle du vent','un murmure indistinct','un bourdonnement magique','le silence total','des chaînes qui cliquètent'];
  const EXITS = ['1 porte de fer rouillée','2 portes de bois (l\'une barricadée)','3 issues dont une trappe au sol','une seule porte verrouillée','un couloir dégagé et une porte secrète'];
  const CONTENTS = [
    'un coffre piégé avec une serrure complexe',
    'un cadavre récent avec des objets intéressants',
    'un prisonnier inconscient',
    'des munitions et provisions abandonnées',
    'un livre de sorts partiellement déchiffrable',
    'un autel avec une offrande récente',
    'des pièges au sol (discrétion obligatoire)',
    'une créature blessée et effrayée',
    'rien — salle de transit',
    'des indices menant vers la menace principale',
  ];

  function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

  type Room = { shape: string; size: string; purpose: string; feature: string; smell: string; sound: string; exits: string; content: string };
  let room = $state<Room | null>(null);

  function generate() {
    room = {
      shape: pick(SHAPES), size: pick(SIZES), purpose: pick(PURPOSES),
      feature: pick(FEATURES), smell: pick(SMELLS), sound: pick(SOUNDS),
      exits: pick(EXITS), content: pick(CONTENTS),
    };
  }

  function copyMd() {
    if (!room) return;
    const md = `## Salle — ${room.purpose}\n\n**Forme/taille :** ${room.shape}, ${room.size}\n**Particularité :** ${room.feature}\n**Odeur :** ${room.smell} | **Son :** ${room.sound}\n**Sorties :** ${room.exits}\n**Contenu :** ${room.content}`;
    navigator.clipboard.writeText(md);
  }

  generate();
</script>

<div class="rg-backdrop" onclick={onclose} role="none">
  <div class="rg-modal" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true">
    <div class="rg-header">
      <span>🏚️ Générateur de Salle</span>
      <button class="rg-close" onclick={onclose}>×</button>
    </div>

    {#if room}
      <div class="rg-card">
        <div class="rg-purpose">{room.purpose}</div>
        <div class="rg-row"><span class="rg-k">Forme</span><span>{room.shape}, {room.size}</span></div>
        <div class="rg-row"><span class="rg-k">Particularité</span><span>{room.feature}</span></div>
        <div class="rg-row"><span class="rg-k">Odeur</span><span>{room.smell}</span></div>
        <div class="rg-row"><span class="rg-k">Son</span><span>{room.sound}</span></div>
        <div class="rg-row"><span class="rg-k">Sorties</span><span>{room.exits}</span></div>
        <div class="rg-row rg-content"><span class="rg-k">Contenu</span><span>{room.content}</span></div>
      </div>
    {/if}

    <div class="rg-actions">
      <button class="rg-btn rg-sec" onclick={copyMd}>📋 Copier MD</button>
      <button class="rg-btn rg-pri" onclick={generate}>🎲 Relancer</button>
      <button class="rg-btn rg-sec" onclick={onclose}>✔ Fermer</button>
    </div>
  </div>
</div>

<style>
  .rg-backdrop { position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1500;display:flex;align-items:center;justify-content:center; }
  .rg-modal { background:var(--bg-secondary,#161b22);border:1px solid var(--border,#2d3748);border-radius:12px;padding:20px;width:360px;max-width:95vw;display:flex;flex-direction:column;gap:12px;box-shadow:0 12px 40px rgba(0,0,0,.7); }
  .rg-header { display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:700;color:#e5a853; }
  .rg-close { background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px; }
  .rg-card { background:var(--bg-tertiary,#1c2233);border:1px solid var(--border);border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:7px; }
  .rg-purpose { font-size:17px;font-weight:700;color:var(--accent,#e5a853);text-transform:capitalize; }
  .rg-row { display:flex;gap:10px;font-size:12px;align-items:flex-start; }
  .rg-k { color:var(--text-muted);min-width:80px;flex-shrink:0;font-size:10px;text-transform:uppercase;padding-top:1px; }
  .rg-content { background:rgba(229,168,83,0.06);border-radius:5px;padding:5px 7px;margin-top:2px; }
  .rg-actions { display:flex;gap:6px; }
  .rg-btn { flex:1;padding:8px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;border:none; }
  .rg-pri { background:#e5a853;color:#000; }
  .rg-sec { background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-muted); }
  .rg-sec:hover { border-color:var(--accent);color:var(--accent); }
</style>
