<script lang="ts">
  import { vttStore, setWeather } from '$lib/stores/vtt.svelte';

  let { onclose }: { onclose: () => void } = $props();

  type WeatherType = 'none' | 'rain' | 'snow' | 'fog' | 'embers' | 'storm';

  const WEATHERS: { id: WeatherType; icon: string; label: string }[] = [
    { id: 'none',   icon: '☀️', label: 'Dégagé'  },
    { id: 'fog',    icon: '🌫️', label: 'Brouillard' },
    { id: 'rain',   icon: '🌧️', label: 'Pluie'   },
    { id: 'storm',  icon: '⛈️', label: 'Tempête' },
    { id: 'snow',   icon: '❄️', label: 'Neige'   },
    { id: 'embers', icon: '🔥', label: 'Braises' },
  ];

  const NARRATIONS: Record<WeatherType, string[]> = {
    none:   ['Le ciel est d\'un bleu limpide, sans nuage.','Le soleil réchauffe les pavés humides.','Une brise légère agite les bannières.'],
    fog:    ['Un épais brouillard enveloppe les rues, étouffant les sons.','La visibilité ne dépasse pas dix mètres.','Les lanternes luisent comme des spectres dans la brume.'],
    rain:   ['Une pluie froide et persistante s\'abat sur la région.','Les toits grondent sous les trombes d\'eau.','Les ruisseaux débordent sur les chemins défoncés.'],
    storm:  ['La foudre zèbre le ciel noir. Le tonnerre gronde sans relâche.','Des rafales violentes arrachent les enseignes des tavernes.','Personne de sensé ne sort par une telle tempête.'],
    snow:   ['Une neige silencieuse recouvre le paysage d\'un manteau blanc.','Le froid mord les doigts et engourdit les membres.','Les traces dans la neige fraîche trahissent les passages récents.'],
    embers: ['Une chaleur étouffante pèse sur la ville. Des cendres flottent dans l\'air.','L\'horizon est rouge, quelque part un grand feu brûle.','La fumée acre irrite les yeux et la gorge.'],
  };

  type DayPlan = { weather: WeatherType; note: string };
  const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

  let plan = $state<DayPlan[]>(DAYS.map(() => ({ weather: 'none', note: '' })));
  let days = $state(5);

  function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

  function randomize() {
    const types: WeatherType[] = ['none','none','rain','fog','storm','snow','embers','none','rain','fog'];
    plan = plan.map(() => ({ weather: pick(types) as WeatherType, note: '' }));
  }

  function applyDay(i: number) { setWeather(plan[i].weather); }

  function copyMd() {
    const lines = plan.slice(0, days).map((d, i) =>
      `**${DAYS[i]}** ${WEATHERS.find(w=>w.id===d.weather)?.icon} ${WEATHERS.find(w=>w.id===d.weather)?.label}${d.note ? ' — ' + d.note : ''}`
    );
    navigator.clipboard.writeText('## Météo de la semaine\n\n' + lines.join('\n'));
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="wp-backdrop" onclick={onclose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="wp-modal" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    <div class="wp-header">
      <span>🌦️ Planificateur Météo</span>
      <button class="wp-close" onclick={onclose}>×</button>
    </div>

    <div class="wp-top-row">
      <label class="wp-label">Jours
        <input type="number" class="wp-num" bind:value={days} min="1" max="7" />
      </label>
      <button class="wp-btn wp-rand" onclick={randomize}>🎲 Aléatoire</button>
      <button class="wp-btn wp-copy" onclick={copyMd}>📋 Copier MD</button>
    </div>

    <div class="wp-grid">
      {#each plan.slice(0, days) as day, i}
        <div class="wp-day">
          <div class="wp-day-header">
            <span class="wp-day-name">{DAYS[i]}</span>
            <button class="wp-apply" onclick={() => applyDay(i)} title="Appliquer sur la carte">▶ Appliquer</button>
          </div>
          <div class="wp-weather-row">
            {#each WEATHERS as w}
              <button
                class="wp-w-btn"
                class:active={day.weather === w.id}
                onclick={() => plan[i].weather = w.id}
                title={w.label}
              >{w.icon}</button>
            {/each}
          </div>
          <div class="wp-narr">{pick(NARRATIONS[day.weather])}</div>
          <input class="wp-note" bind:value={day.note} placeholder="Note MJ…" />
        </div>
      {/each}
    </div>

    <button class="wp-btn wp-close-btn" onclick={onclose}>✔ Fermer</button>
  </div>
</div>

<style>
  .wp-backdrop { position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1500;display:flex;align-items:center;justify-content:center; }
  .wp-modal { background:var(--bg-secondary,#161b22);border:1px solid var(--border,#2d3748);border-radius:12px;padding:20px;width:500px;max-width:98vw;display:flex;flex-direction:column;gap:12px;box-shadow:0 12px 40px rgba(0,0,0,.7);max-height:90vh;overflow-y:auto; }
  .wp-header { display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:700;color:#e5a853; }
  .wp-close { background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px; }
  .wp-top-row { display:flex;gap:8px;align-items:center; }
  .wp-label { display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted); }
  .wp-num { width:40px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);padding:3px 6px;font-size:12px;text-align:center; }
  .wp-btn { padding:6px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;border:none; }
  .wp-rand { background:#e5a853;color:#000; }
  .wp-copy { background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-muted); }
  .wp-grid { display:flex;flex-direction:column;gap:8px; }
  .wp-day { background:var(--bg-tertiary,#1c2233);border:1px solid var(--border);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px; }
  .wp-day-header { display:flex;justify-content:space-between;align-items:center; }
  .wp-day-name { font-size:13px;font-weight:700;color:var(--accent,#e5a853); }
  .wp-apply { background:rgba(229,168,83,0.15);border:1px solid rgba(229,168,83,0.3);color:#e5a853;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer; }
  .wp-apply:hover { background:rgba(229,168,83,0.3); }
  .wp-weather-row { display:flex;gap:4px; }
  .wp-w-btn { background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:16px;cursor:pointer; }
  .wp-w-btn.active { background:rgba(229,168,83,0.2);border-color:var(--accent); }
  .wp-narr { font-size:11px;color:var(--text-muted);font-style:italic;line-height:1.4; }
  .wp-note { background:var(--bg-secondary);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);padding:4px 7px;font-size:11px;width:100%; }
  .wp-close-btn { background:var(--accent);color:#000;margin-top:4px;width:100%;padding:9px;border-radius:7px;font-size:13px;font-weight:700; }
</style>
