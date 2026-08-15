<script lang="ts">
  import { getPlayerConnections, type PlayerInfo, broadcastToPlayers } from '$lib/api';
  import { notifStore } from '$lib/stores/notifications.svelte';

  let { onclose }: { onclose: () => void } = $props();

  type Tab = 'atmosphere' | 'quest' | 'npc_dialog';
  let activeTab = $state<Tab>('atmosphere');

  // Lieux & Ambiance
  let placeCategory = $state<'tavern' | 'street' | 'crypt' | 'swamp' | 'forest' | 'noble' | 'sewers'>('tavern');
  let tone = $state<'grim' | 'mystery' | 'chaos' | 'festive' | 'decay'>('grim');
  let customDetails = $state('');
  let generatedAtmosphere = $state('');

  // Intrigues
  let players = $state<PlayerInfo[]>([]);
  let selectedPlayerId = $state('');
  let generatedQuest = $state('');

  // PNJ
  let npcArchetype = $state<'innkeeper' | 'guard' | 'merchant' | 'noble' | 'priest' | 'heretic'>('innkeeper');
  let npcHood = $state<'suspicious' | 'friendly' | 'terrified' | 'greedy' | 'arrogant'>('suspicious');
  let playerQuestion = $state('');
  let generatedNpcReply = $state('');

  // Templates procéduraux d'ambiance
  const ATMOSPHERE_TEMPLATES = {
    tavern: {
      grim: "L'air est saturé d'odeurs de suif rance, de bière aigre et de sueur froide. Près de l'âtre mourant, des ouvriers aux visages cendreux marmonnent à voix basse, leurs regards fuyants surveillant chaque nouveau venu avec une méfiance viscérale. Au sol, la paille maculée étouffe à peine les bruits de pas furtifs.",
      mystery: "Un voile de fumée de pipe âcre flotte sous les poutres vermoulues de l'auberge. Dans un coin obscur, une silhouette emmitouflée dans une cape élimée trace d'étranges symboles dans les gouttes de bière renversées sur sa table.",
      chaos: "Les rires rauques qui résonnent ici ont quelque chose de malsain. Les verres s'entrechoquent avec violence et les reflets des flammes dans les yeux des buveurs semblent danser d'une lueur trouble et frénétique.",
      festive: "La salle déborde d'une animation bruyante et chaleureuse. Les chopes d'étain s'entrechoquent, un ménestrel borgne gratte un luth désaccordé tandis que des rires gras couvrent les chants paillards de l'Empire.",
      decay: "L'établissement n'est plus que l'ombre de lui-même. Des toiles d'araignées poisseuses ornent les coins, les tonneaux suintent un breuvage frelaté et l'aubergiste édenté semble lui-même rongé par un mal insidieux."
    },
    street: {
      grim: "La ruelle étroite et pavée de pierres glissantes serpente entre des bâtisses à colombages penchées les unes vers les autres. Un caniveau nauséabond charrie des détritus innommables sous une pluie fine et glaciale.",
      mystery: "Le brouillard nocturne avale la lueur des rares lanternes à huile. Seul le claquement lointain de bottes sur le pavé brise le silence pesant de ce coupe-gorge.",
      chaos: "Des graffitis blasphématoires griffonnés au charbon et au sang souillent les murs. Dans les renfoncements, des ombres agitées semblent se mouvoir contre le cours normal de la lumière.",
      festive: "Des lampions de papier oscillent au vent entre les façades. Des marchands à la criée vantent des saucisses fumées et des bretzels chauds au milieu d'une foule bigarrée venue assister au carnaval municipal.",
      decay: "Les façades noircies par la suie menacent de s'effondrer. Des rats de bonne taille trottent effrontément le long des boiseries vermoulues sans se soucier des quelques mendiants affalés."
    },
    crypt: {
      grim: "Le froid de la pierre ancestrale vous mord instantanément les os. L'odeur poussiéreuse de la terre retournée et de la cendre vous prend à la gorge, tandis que des crânes sculptés semblent veiller sur un repos éternel profané.",
      mystery: "Des inscriptions en runes pré-impériales luisent d'une phosphorescence blafarde le long des sarcophages de basalte. Un souffle glacial et régulier, semblable à une respiration endormie, s'élève du fond des ténèbres.",
      chaos: "Les tombes ont été fracturées de l'intérieur. L'air est lourd d'une puanteur de soufre et de chairs corrompues, et des murmures impies se répercutent en écho contre les dalles funéraires.",
      festive: "Des cierges bénis par les prêtres de Morr brûlent encore tranquillement dans des niches votives, apportant une étrange et solennelle sérénité à ce sanctuaire des ancêtres.",
      decay: "L'humidité ruisselle le long des parois rongées par le salpêtre. Les dalles effondrées laissent entrevoir des ossements brisés et des restes d'armures oxydées réduites en lambeaux."
    },
    swamp: {
      grim: "Une brume opaque et stagnante s'accroche aux joncs pourrissants. Chaque pas fait remonter des bulles de gaz fétides de la tourbe noire, et l'eau boueuse dissimule traîtreusement des fondrières sans fond.",
      mystery: "Des feux follets dansent au loin entre les saules torturés. Le coassement monotone des crapauds s'interrompt brusquement, laissant place au clapotis distinct d'une masse lourde qui se déplace dans l'eau.",
      chaos: "L'eau du marais a pris une teinte violacée et huileuse. Des racines aux formes presque humaines se tordent grotesquement à la surface, suintant une sève fétide.",
      festive: "Des cabanes de pêcheurs sur pilotis s'illuminent de torches chaleureuses, et les effluves d'un ragoût d'anguille épicé flottent au-dessus des eaux calmes.",
      decay: "Le paysage n'est qu'un désert d'arbres morts aux branches décharnées. L'odeur d'engrais et de putréfaction végétale est si violente qu'elle pique les yeux et étouffe la gorge."
    },
    forest: {
      grim: "Les ramures serrées des chênes centenaires du Reikwald bloquent impitoyablement la lumière du jour. Le silence de ces bois est anormal : aucun chant d'oiseau, seulement le craquement sinistre des branchages sous un poids invisible.",
      mystery: "Un cercle de monolithes recouverts de mousse ancienne se dresse au cœur d'une clairière immaculée. Des offrandes d'herbes séchées et de plumes tressées pendent aux branches basses.",
      chaos: "L'écorce des arbres est sillonnée de pustules luisantes et des yeux jaunes vous épient depuis les creux des troncs noueux. Le Chaos a marqué cette contrée d'une empreinte indélébile.",
      festive: "Le soleil perce le feuillage doré en rayons chatoyants. L'odeur fraîche de la mousse et du pin embaume l'air alors qu'un ruisseau cristallin serpente entre les fougères.",
      decay: "Des arbres pourris s'effondrent sur eux-mêmes dans un bouillonnement de champignons vénéneux et d'asticots géants. L'humus spongieux engloutit chaque pas jusqu'aux chevilles."
    },
    noble: {
      grim: "Sous les dorures fanées et les velours cramoisis, l'atmosphère de ce salon est suffocante de faux-semblants et d'arrogance glaciale. Des gardes en livrée serrent la garde de leurs hallebardes, le regard hautain.",
      mystery: "Les conversations s'éteignent d'un coup derrière les masques de porcelaine et les éventails de soie. Des regards comploteurs s'échangent dans la pénombre des alcôves tapissées.",
      chaos: "Derrière les miroirs biseautés et les chandeliers d'argent, des symboles pervers sont gravés au revers des portraits de famille. La décadence de la noblesse impériale suinte par chaque pore de ce palais.",
      festive: "Une musique de clavecin et de violes enchante l'assemblée tandis que des serviteurs en perruque poudrée font circuler des coupes de vin de Bretonnie et des faisans rôtis.",
      decay: "Les tapisseries sont mitées, les miroirs ternis et une couche de poussière recouvre les lustres de cristal. La lignée régnante est manifestement ruinée mais s'accroche désespérément à son faste d'antan."
    },
    sewers: {
      grim: "Le grondement sourd des eaux usées résonne sous les voûtes de brique suintantes. L'odeur est abominable, mélange d'immondices, de métaux corrodés et de charognes en décomposition.",
      mystery: "Des marques gravées récemment sur les briques indiquent une piste clandestine. Des échelles de fer rouillées s'enfoncent dans des conduits secondaires non cartographiés.",
      chaos: "Des runes triangulaires peintes avec des déjections et du sang frais ornent les grilles d'évacuation. Dans les ténèbres humides, des couinements stridents et des bruits de griffes sur la pierre s'approchent...",
      festive: "Un repaire de contrebandiers aménagé sous une arche voûtée offre un refuge étonnamment sec, avec un brasero de charbon et quelques tonnelets d'eau-de-vie volée.",
      decay: "Les briques s'effritent par pans entiers, menaçant d'ensevelir quiconque s'aventure sous ces voûtes noircies par des siècles d'immondices stagnantes."
    }
  };

  async function loadPlayers() {
    try {
      players = await getPlayerConnections();
    } catch {
      players = [];
    }
  }

  $effect(() => {
    loadPlayers();
  });

  function generateAtmosphere() {
    const base = ATMOSPHERE_TEMPLATES[placeCategory]?.[tone] ?? "Une atmosphère lourde de suspense pèse sur les lieux.";
    if (customDetails.trim()) {
      generatedAtmosphere = `${base} Notamment, ${customDetails.trim()}`;
    } else {
      generatedAtmosphere = base;
    }
  }

  function generateQuestForPlayer() {
    const p = players.find(x => x.id === selectedPlayerId) || players[0];
    const charName = p?.character?.nom || p?.name || "L'aventurier";
    const career = p?.character?.voc || p?.character?.race || "Aventurier";

    const QUEST_HOOKS = [
      `Une missive scellée de cire noire a été glissée sous la paillasse de ${charName}. L'expéditeur connaît son passé de ${career} et exige un service sous peine de révéler un secret compromettant à la garde locale.`,
      `Un vieil homme aux yeux voilés de cataracte aborde ${charName} en le désignant du doigt : "Toi ! Le sang des ${career}s coule dans tes veines... Celui qui a dérobé la relique de Sainte-Élisabeth porte la même marque que toi !"`,
      `Une prime exceptionnelle a été placardée à l'auberge : un criminel en cavale recherche spécifiquement les compétences d'un ${career} comme ${charName} pour ouvrir un sanctuaire scellé avant la prochaine lune noire.`,
      `Un messager agonisant s'effondre dans les bras de ${charName} en lui tendant une clé en laiton gravée d'une hache de guerre : "Prenez-garde... Ils savent ce que vous avez trouvé dans les égouts..."`
    ];

    generatedQuest = QUEST_HOOKS[Math.floor(Math.random() * QUEST_HOOKS.length)];
  }

  function generateNpcReply() {
    const NPC_REPLIES = {
      innkeeper: {
        suspicious: "« Écoutez l'ami, je ne cherche pas d'ennuis avec la garde ni avec personne. Posez vos sous sur le comptoir, buvez votre godet et ne posez pas de questions sur les bruits venant de la cave. »",
        friendly: "« Ah, de braves voyageurs ! Approchez près du feu ! Pour trois sous, je vous sers un ragoût de lièvre et le meilleur cidre du Reikland ! »",
        terrified: "« Par Sigmar, parlez moins fort ! Ils ont des yeux et des oreilles partout... Prenez ce que vous voulez mais partez avant le couvre-feu ! »",
        greedy: "« Tout se sait ici... mais les informations de qualité ont un prix. Dix couronnes d'or, et je vous dis exactement qui est entré par la porte dérobée hier soir. »",
        arrogant: "« Vous avez l'air d'avoir dormi dans une écurie. Si vous n'avez pas de quoi payer d'avance, la porte est grande ouverte. »"
      },
      guard: {
        suspicious: "« Circulez ! Rien à voir ici. Et si vous continuez à traîner près de l'entrepôt, c'est au cachot que vous passerez la nuit. »",
        friendly: "« Si vous cherchez un gîte tranquille, évitez le quartier des tanneurs. Les patrouilles n'y vont plus depuis la semaine dernière... »",
        terrified: "« Les patrouilles de nuit ne reviennent plus au complet... Quelque chose rôde sous les ponts et le capitaine refuse d'envoyer des renforts ! »",
        greedy: "« Une infraction pareille au règlement, ça vaut une amende immédiate de cinq sous... ou alors on oublie tout si vous êtes généreux. »",
        arrogant: "« Vous osez m'adresser la parole sans y être invité ? Baissez les yeux manant, avant que je ne teste le tranchant de ma hallebarde. »"
      },
      merchant: {
        suspicious: "« Montrez-moi d'abord votre bourse. Trop de vauriens rôdent prétendant être de nobles mercenaires pour ensuite détrousser les honnêtes marchands. »",
        friendly: "« Venez, venez contempler ces merveilles venues tout droit des monts d'Airain ! Qualité garantie par la guilde des marchands ! »",
        terrified: "« Mon convoi a été attaqué par des bêtes cornues à deux lieues d'ici... J'ai tout abandonné pour sauver ma peau ! »",
        greedy: "« Cet objet est unique dans tout le Vieux Monde. Cent cinquante couronnes, et pas un sou de moins ! C'est à prendre ou à laisser. »",
        arrogant: "« Mes marchandises sont réservées à la haute société d'Altdorf. Vos vêtements poussiéreux n'ont pas leur place dans mon échoppe. »"
      },
      noble: {
        suspicious: "« Qui vous envoie ? Le baron von Hardenberg ? Sachez que mes avocats et mes spadassins sont tout aussi redoutables les uns que les autres. »",
        friendly: "« Vous avez l'air d'individus capables de résoudre certains... désagréments sans éveiller les soupçons du prévôt. Asseyez-vous donc. »",
        terrified: "« Ils me réclament une dette impie... La nuit dernière, une silhouette ailée a toqué au carreau de ma chambre au troisième étage ! »",
        greedy: "« Votre loyauté s'achète, comme tout dans cet Empire. Accomplissez cette besogne pour ma maison, et vos bourses déborderont d'or. »",
        arrogant: "« Comment osez-vous respirer le même air que moi sans vous prosterner ? Gardes ! Évacuez cette racaille de mes appartements ! »"
      },
      priest: {
        suspicious: "« Sigmar scrute vos âmes, voyageurs. Pourquoi vos regards fuient-ils la sainte comète à deux queues ? Auriez-vous des péchés inavouables à confesser ? »",
        friendly: "« Que le Marteau de Sigmar guide vos pas dans ces ténèbres. Buvez cette eau bénite, elle purifiera votre esprit des miasmes du doute. »",
        terrified: "« Les signes annoncés dans le Livre des Prophéties se réalisent un à un ! Même les cloches du temple ont sonné d'elles-mêmes à minuit ! »",
        greedy: "« Les bénédictions du clergé nécessitent des offrandes substantielles pour réparer la toiture du temple et nourrir les pauvres pécheurs... »",
        arrogant: "« Votre ignorance des saints préceptes est une insulte au Créateur de l'Empire. Repentez-vous avant que le feu purificateur ne s'abatte sur vous ! »"
      },
      heretic: {
        suspicious: "« Vous n'avez pas prononcé le mot de passe de l'Ordre du Serpent Pourpre... Qui vous a guidé jusqu'à notre cave secrète ? »",
        friendly: "« Enfin des esprits éclairés qui refusent le joug imbécile des prêtres de Sigmar ! Les Vrais Dieux ont tant de dons à vous offrir... »",
        terrified: "« Le rituel a échoué ! La chose que nous avons invoquée refuse de regagner son plan et dévore quiconque s'approche de l'autel ! »",
        greedy: "« Apportez-moi le grimoire conservé dans la bibliothèque du collège des mages, et je vous révélerai le secret de l'immortalité. »",
        arrogant: "« Pauvres pantins aveuglés par vos fausses croyances... Quand le Grand Œil s'ouvrira, vous ne serez que des cendres sous nos pieds ! »"
      }
    };

    const reply = NPC_REPLIES[npcArchetype]?.[npcHood] ?? "Le PNJ vous fixe avec insistance sans prononcer un mot.";
    generatedNpcReply = playerQuestion.trim()
      ? `En réponse à « ${playerQuestion.trim()} » :\n\n${reply}`
      : reply;
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    notifStore.add('success', 'Copié !', 'Texte copié dans le presse-papier.');
  }

  function sendAsHandout(text: string, title = 'Narration MJ') {
    broadcastToPlayers('handout_push', {
      type: 'note',
      title,
      text
    });
    notifStore.add('success', 'Handout envoyé', 'Texte diffusé instantanément sur les écrans joueurs.');
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="na-backdrop" onclick={onclose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="na-modal" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    <div class="na-header">
      <span class="na-title">🤖 Assistant Narratif & IA du MJ</span>
      <button class="na-close" onclick={onclose}>✕</button>
    </div>

    <!-- Onglets -->
    <div class="na-tabs">
      <button class="na-tab" class:active={activeTab === 'atmosphere'} onclick={() => activeTab = 'atmosphere'}>
        🏰 Atmosphère de Scène
      </button>
      <button class="na-tab" class:active={activeTab === 'quest'} onclick={() => activeTab = 'quest'}>
        📜 Intrigues & Accroches
      </button>
      <button class="na-tab" class:active={activeTab === 'npc_dialog'} onclick={() => activeTab = 'npc_dialog'}>
        🎭 Dialogue PNJ
      </button>
    </div>

    <div class="na-body">
      <!-- 1. ATMOSPHÈRE -->
      {#if activeTab === 'atmosphere'}
        <div class="na-controls">
          <div class="na-row">
            <label class="na-label">Lieu
              <select bind:value={placeCategory} class="na-select">
                <option value="tavern">🍺 Taverne / Auberge</option>
                <option value="street">🌧️ Ruelle / Coupe-gorge</option>
                <option value="crypt">⚰️ Crypte / Tombeau</option>
                <option value="swamp">🌫️ Marais putrides</option>
                <option value="forest">🌲 Forêt du Reikwald</option>
                <option value="noble">👑 Palais / Salon noble</option>
                <option value="sewers">🐀 Égouts souterrains</option>
              </select>
            </label>
            <label class="na-label">Tonalité
              <select bind:value={tone} class="na-select">
                <option value="grim">💀 Sombre & Pesant</option>
                <option value="mystery">🕵️ Mystère & Secret</option>
                <option value="chaos">🌑 Menace du Chaos</option>
                <option value="festive">🎉 Animé / Chaleureux</option>
                <option value="decay">🍂 Ruine & Décomposition</option>
              </select>
            </label>
          </div>
          <input
            type="text"
            class="na-input"
            placeholder="Détails spécifiques (ex: feu de cheminée éteint, garde endormi)..."
            bind:value={customDetails}
          />
          <button class="na-btn na-btn-pri" onclick={generateAtmosphere}>✨ Générer l'Atmosphère</button>
        </div>

        {#if generatedAtmosphere}
          <div class="na-result-box">
            <div class="na-result-text">{generatedAtmosphere}</div>
            <div class="na-result-actions">
              <button class="na-action-btn" onclick={() => copyText(generatedAtmosphere)}>📋 Copier</button>
              <button class="na-action-btn na-action-send" onclick={() => sendAsHandout(generatedAtmosphere, 'Atmosphère')}>📤 Diffuser aux Joueurs</button>
            </div>
          </div>
        {/if}

      <!-- 2. INTRIGUES -->
      {:else if activeTab === 'quest'}
        <div class="na-controls">
          <div class="na-row">
            <label class="na-label">Joueur ciblé
              <select bind:value={selectedPlayerId} class="na-select">
                <option value="">-- Aléatoire / Groupe --</option>
                {#each players as p}
                  <option value={p.id}>{p.character?.nom || p.name} ({p.character?.voc || 'Aventurier'})</option>
                {/each}
              </select>
            </label>
          </div>
          <button class="na-btn na-btn-pri" onclick={generateQuestForPlayer}>🎲 Générer une Accroche Personnalisée</button>
        </div>

        {#if generatedQuest}
          <div class="na-result-box">
            <div class="na-result-text">{generatedQuest}</div>
            <div class="na-result-actions">
              <button class="na-action-btn" onclick={() => copyText(generatedQuest)}>📋 Copier</button>
              <button class="na-action-btn na-action-send" onclick={() => sendAsHandout(generatedQuest, 'Rumeur / Accroche')}>📤 Révéler aux Joueurs</button>
            </div>
          </div>
        {/if}

      <!-- 3. DIALOGUE PNJ -->
      {:else if activeTab === 'npc_dialog'}
        <div class="na-controls">
          <div class="na-row">
            <label class="na-label">Archétype PNJ
              <select bind:value={npcArchetype} class="na-select">
                <option value="innkeeper">🍺 Aubergiste</option>
                <option value="guard">🛡️ Garde de la Ville</option>
                <option value="merchant">💰 Marchand</option>
                <option value="noble">👑 Noble / Bourgmestre</option>
                <option value="priest">🔨 Prêtre de Sigmar</option>
                <option value="heretic">🌑 Cultiste clandestin</option>
              </select>
            </label>
            <label class="na-label">Disposition / Humeur
              <select bind:value={npcHood} class="na-select">
                <option value="suspicious">🤨 Méfiant / Fermé</option>
                <option value="friendly">🤝 Accueillant / Bavard</option>
                <option value="terrified">😨 Terrifié / Paniqué</option>
                <option value="greedy">🤑 Vénal / Intéressé</option>
                <option value="arrogant">🧐 Arrogant / Méprisant</option>
              </select>
            </label>
          </div>
          <input
            type="text"
            class="na-input"
            placeholder="Question ou provocation du joueur (optionnel)..."
            bind:value={playerQuestion}
          />
          <button class="na-btn na-btn-pri" onclick={generateNpcReply}>🗣️ Générer Réplique du PNJ</button>
        </div>

        {#if generatedNpcReply}
          <div class="na-result-box">
            <div class="na-result-text">{generatedNpcReply}</div>
            <div class="na-result-actions">
              <button class="na-action-btn" onclick={() => copyText(generatedNpcReply)}>📋 Copier</button>
              <button class="na-action-btn na-action-send" onclick={() => sendAsHandout(generatedNpcReply, 'Parole du PNJ')}>📤 Envoyer aux Joueurs</button>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .na-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2500;
  }

  .na-modal {
    background: var(--bg-secondary, #161b22);
    border: 1px solid var(--border, #30363d);
    border-radius: 12px;
    width: 600px;
    max-width: 95vw;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 48px rgba(0,0,0,0.8);
    overflow: hidden;
  }

  .na-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-tertiary, #0d1117);
    border-bottom: 1px solid var(--border, #30363d);
  }

  .na-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--accent, #e5a853);
  }

  .na-close {
    background: none;
    border: none;
    color: var(--text-muted, #8b949e);
    font-size: 16px;
    cursor: pointer;
  }
  .na-close:hover { color: white; }

  .na-tabs {
    display: flex;
    border-bottom: 1px solid var(--border, #30363d);
    background: var(--bg-tertiary, #0d1117);
  }

  .na-tab {
    flex: 1;
    padding: 10px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted, #8b949e);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .na-tab:hover { color: var(--text-primary, #c9d1d9); }
  .na-tab.active {
    color: var(--accent, #e5a853);
    border-bottom-color: var(--accent, #e5a853);
    background: rgba(229, 168, 83, 0.06);
  }

  .na-body {
    padding: 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .na-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .na-row {
    display: flex;
    gap: 12px;
  }

  .na-label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    color: var(--text-muted, #8b949e);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .na-select, .na-input {
    background: var(--bg-tertiary, #0d1117);
    border: 1px solid var(--border, #30363d);
    border-radius: 6px;
    padding: 8px 10px;
    color: white;
    font-size: 13px;
    outline: none;
  }
  .na-select:focus, .na-input:focus { border-color: var(--accent, #e5a853); }

  .na-btn {
    padding: 10px 14px;
    border-radius: 8px;
    border: none;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
  }

  .na-btn-pri {
    background: var(--accent, #e5a853);
    color: #000;
  }
  .na-btn-pri:hover { background: #d49542; }

  .na-result-box {
    background: var(--bg-tertiary, #0d1117);
    border: 1px solid var(--border, #30363d);
    border-left: 4px solid var(--accent, #e5a853);
    border-radius: 8px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: fadeIn 0.2s ease-out;
  }

  .na-result-text {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-primary, #e6edf3);
    font-style: italic;
    white-space: pre-wrap;
  }

  .na-result-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .na-action-btn {
    background: rgba(255,255,255,0.06);
    border: 1px solid var(--border, #30363d);
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12px;
    color: var(--text-muted, #8b949e);
    cursor: pointer;
  }
  .na-action-btn:hover { color: white; border-color: var(--accent); }

  .na-action-send {
    background: rgba(229,168,83,0.15);
    color: var(--accent, #e5a853);
    border-color: rgba(229,168,83,0.3);
  }
  .na-action-send:hover { background: var(--accent, #e5a853); color: #000; }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
