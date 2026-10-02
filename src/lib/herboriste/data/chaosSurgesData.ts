// Types and data for Wild Alchemy & Gem Crafting Surges / Fiascos

export interface ChaosSurge {
  d100Range: [number, number];
  type: 'fiasco' | 'prodige';
  category: 'alchimie' | 'gemme' | 'cueillette' | 'sertissage';
  title: string;
  effect: string;
  gameRule: string;
  humorLore: string;
}

export const CHAOS_FIASCOS: ChaosSurge[] = [
  {
    d100Range: [1, 5],
    type: 'fiasco',
    category: 'alchimie',
    title: 'Vapeur de Pigmentation Permanente',
    effect: 'Le chaudron projette un nuage de vapeur pourpre. La peau du praticien devient violette fluo.',
    gameRule: 'Désavantage aux tests de Discrétion (-3) pendant 1d4 jours dans l\'obscurité.',
    humorLore: '« Regardez, c\'est le cousin noble d\'une aubergine ! » ricane le voleur.'
  },
  {
    d100Range: [6, 10],
    type: 'fiasco',
    category: 'gemme',
    title: 'Déflagration de Confettis Cristallins',
    effect: 'La gemme se pulvérise en millions de micro-éclats brillants et aveuglants.',
    gameRule: 'Perte de la pierre brute. Tout le monde dans l\'atelier doit réussir un jet de Réflexes DD 12 ou être Aveuglé 1 tour.',
    humorLore: 'Au moins, l\'établi est propre et scintille pour la fête des fées.'
  },
  {
    d100Range: [11, 15],
    type: 'fiasco',
    category: 'alchimie',
    title: 'Fiole Clémente & Bavarde',
    effect: 'La potion s\'anime et développe une voix aiguë geignarde qui supplie de ne pas être bue.',
    gameRule: 'Boire la potion requiert un test de Volonté DD 13 pour ignorer ses cris de détresse psychologique.',
    humorLore: '« Ne m\'avalez pas, je suis trop jeune, j\'ai une famille de bulles à nourrir ! »'
  },
  {
    d100Range: [16, 20],
    type: 'fiasco',
    category: 'sertissage',
    title: 'Inversion de Polarité Magnétique',
    effect: 'L\'anneau repousse violemment tout objet métallique dans un rayon de 3 mètres.',
    gameRule: 'Impossible de porter une cotte de mailles ou de tenir une épée en fer tant que l\'anneau est enfilé.',
    humorLore: 'Les couverts du banquet s\'envolent vers les convives comme des projectiles haineux.'
  },
  {
    d100Range: [21, 25],
    type: 'fiasco',
    category: 'cueillette',
    title: 'Graines de Ronce Bondissante',
    effect: 'La plante réagit à la serpe en s\'accrochant férocement aux mollets du cueilleur.',
    gameRule: 'Vitesse réduite de moitié jusqu\'à passer 10 minutes avec une pince à épiler.',
    humorLore: 'Une plante carnivore miniature avec un fort penchant pour les chaussettes en laine.'
  },
  {
    d100Range: [26, 30],
    type: 'fiasco',
    category: 'alchimie',
    title: 'Gelée de Précipitation Explosive',
    effect: 'Le liquide se fige en mastic caoutchouteux avant de rebondir hors du flacon à travers la pièce.',
    gameRule: 'Fiole brisée, 1d6 points de dégâts contondants au visage du malchanceux.',
    humorLore: 'Les nains appellent ça "la balle rebondissante du suicide".'
  },
  {
    d100Range: [31, 35],
    type: 'fiasco',
    category: 'gemme',
    title: 'Chatouillement Sonore Arcanique',
    effect: 'La gemme taillée émet un bourdonnement strident semblable à un moustique géant.',
    gameRule: 'Impossibilité de faire un repos long dans un rayon de 10 pas à moins d\'envelopper la gemme dans 3 bourses de cuir.',
    humorLore: 'BZZZZZZZZ constant qui rendrait fou un gobelin sous sédatif.'
  },
  {
    d100Range: [36, 40],
    type: 'fiasco',
    category: 'alchimie',
    title: 'Odeur d\'Ail Démoniaque Concentré',
    effect: 'Un fumet pestilentiel imprègne l\'atelier et les vêtements pour une semaine.',
    gameRule: 'Repousse les vampires et les goules, mais -4 aux tests de Séduction et de Diplomatie urbaine.',
    humorLore: 'Même le chien du voisin refuse d\'approcher à moins de cinquante toises.'
  },
  {
    d100Range: [41, 45],
    type: 'fiasco',
    category: 'cueillette',
    title: 'Nid de Fourmis Rouges Pyrophiles',
    effect: 'La racine déterrée était l\'habitat d\'une colonie d\'insectes venimeux particulièrement hargneux.',
    gameRule: 'Prend 1d8 dégâts de poison et doit plonger dans la rivière la plus proche sans discuter.',
    humorLore: 'Elles piquent en rythme, c\'est presque une danse de combat rituelle.'
  },
  {
    d100Range: [46, 50],
    type: 'fiasco',
    category: 'sertissage',
    title: 'Soudure Froide Incomplète',
    effect: 'Le chaton de la bague s\'ouvre au pire moment possible lors d\'un geste brusque.',
    gameRule: 'La gemme tombe au sol. 50% de chance qu\'elle roule dans une bouche d\'égout ou sous une botte ennemie.',
    humorLore: '« C\'est la faute aux outils des nains du Sud, ils ne valent rien ! » s\'écrie le bijoutier.'
  }
];

export const CHAOS_PRODIGES: ChaosSurge[] = [
  {
    d100Range: [51, 55],
    type: 'prodige',
    category: 'alchimie',
    title: 'Élixir de Pureté Angélique Décuplé',
    effect: 'Le breuvage se clarifie en une eau de roche étincelante sans aucun résidu de boue.',
    gameRule: 'Génère 2 fioles de qualité Supérieure au lieu d\'une seule !',
    humorLore: 'Un miracle digne d\'un saint patron des pharmaciens distraits.'
  },
  {
    d100Range: [56, 60],
    type: 'prodige',
    category: 'gemme',
    title: 'Facettage Parfait "Cœur d\'Étoile"',
    effect: 'L\'alignement des angles réfracte la lumière naturelle en un prisme d\'arc-en-ciel perpétuel.',
    gameRule: 'Valeur marchande multipliée par 3. +2 à la Difficulté de dispersion magique de son enchantement.',
    humorLore: 'Même le roi des nains en verserait une larme sur sa barbe tressée.'
  },
  {
    d100Range: [61, 65],
    type: 'prodige',
    category: 'alchimie',
    title: 'Arôme d\'Inspiration Rôliste',
    effect: 'Une délicieuse effluve de miel sauvage et de cannelle emplit la pièce.',
    gameRule: 'Tous les alliés présents gagnent 1 Dé d\'Inspiration Rôliste (1d6) à dépenser dans les 24h.',
    humorLore: 'Le barbare verse une larme de nostalgie en repensant aux tartes de sa maman.'
  },
  {
    d100Range: [66, 70],
    type: 'prodige',
    category: 'sertissage',
    title: 'Harmonie Tellurique Instinctive',
    effect: 'Le métal de la bague semble fondre et épouser les aspérités de la gemme sans aucun jeu.',
    gameRule: 'L\'objet ne nécessite pas d\'harmonisation magique (effet passif permanent immédiat).',
    humorLore: 'On dirait que la gemme attendait cette bague depuis trois mille ans.'
  },
  {
    d100Range: [71, 75],
    type: 'prodige',
    category: 'cueillette',
    title: 'Mère des Racines d\'Orphée',
    effect: 'En tirant sur une simple feuille, le cueilleur découvre une grappe entière de spécimens royaux.',
    gameRule: 'Récolte quadruple sans endommager le plant sauvage mère.',
    humorLore: 'Le sol était si tendre qu\'on aurait cru du beurre de ferme tiédi au soleil.'
  },
  {
    d100Range: [76, 80],
    type: 'prodige',
    category: 'alchimie',
    title: 'Catalyse Auto-Nettoyante',
    effect: 'Le fond du chaudron brille d\'un éclat neuf et sans une seule tache de suie.',
    gameRule: 'Le prochain brassage bénéficie d\'un bonus de +3 au test de difficulté.',
    humorLore: 'Les apprentis alchimistes détestent cette astuce qui leur vole leur corvée de récurage.'
  },
  {
    d100Range: [81, 85],
    type: 'prodige',
    category: 'gemme',
    title: 'Inclusion d\'Esprit Follet Bienveillant',
    effect: 'Une minuscule lueur dansante habite le cœur de la pierre et réagit aux émotions du porteur.',
    gameRule: 'Alerte télépathique si une créature invisible ou hostile s\'approche à moins de 10 mètres pendant le sommeil.',
    humorLore: 'Le follet adore les reflets de bougies et fait des clins d\'œil au porteur.'
  },
  {
    d100Range: [86, 90],
    type: 'prodige',
    category: 'sertissage',
    title: 'Focalisateur de Mana Inépuisable',
    effect: 'Les runes gravées canalisent le flux ambiant comme un siphon perpétuel.',
    gameRule: 'Une fois par jour, le porteur peut relancer un dé de dégâts magiques ou de soins raté.',
    humorLore: 'C\'est presque de la triche, mais personne n\'ira s\'en plaindre.'
  },
  {
    d100Range: [91, 95],
    type: 'prodige',
    category: 'cueillette',
    title: 'Bénédiction de la Rosée Sylvestre',
    effect: 'Une goutte de rosée liquide cristallisée sur la plante guérit instantanément 1 niveau d\'épuisement.',
    gameRule: 'Peut être bue immédiatement ou scellée dans une fiole pour une valeur de 50 PO.',
    humorLore: 'Ça a le goût de l\'eau fraîche avec une pointe de menthe poivrée divine.'
  },
  {
    d100Range: [96, 100],
    type: 'prodige',
    category: 'alchimie',
    title: 'Grand Œuvre Spontané de Fangh',
    effect: 'La potion transcende sa recette originale et développe des propriétés miraculeuses.',
    gameRule: 'L\'effet de la potion dure 24 heures au lieu de sa durée habituelle et soigne toute maladie courante.',
    humorLore: 'L\'alchimiste hurle "EUREKA" et réveille tout le quartier des tanneurs.'
  }
];
