/**
 * Notes de version affichées dans Grimoire (fenêtre « Nouveautés ») une fois
 * après chaque mise à jour. Ajouter une entrée en tête à chaque release.
 */
export interface ReleaseNote {
  version: string;
  title: string;
  items: { icon: string; title: string; text: string }[];
  warning?: string;
}

const COMPANION_NOTES: ReleaseNote['items'] = [
  {
    icon: '🤖',
    title: 'QR Code « Télécharger l’appli Android »',
    text: 'Dans le Hub mobile, à côté du QR de connexion, un second QR mène directement à la dernière appli Grimoire Compagnon. Les joueurs la scannent et l’installent.',
  },
  {
    icon: '🧙',
    title: 'La table trouvée par son nom',
    text: 'Dans l’appli, « 🔍 Trouver » affiche votre table sous la forme « Campagne (PC) » au lieu d’une adresse IP. Si l’IP change, l’appli la retrouve seule.',
  },
  {
    icon: '📂',
    title: 'Fiche gardée dans le téléphone',
    text: 'La fiche est copiée dans Documents › Grimoire : elle survit à une désinstallation et se restaure en un geste. Elle reste aussi sauvegardée chez vous.',
  },
  {
    icon: '⚔️',
    title: 'Sons et actions de combat reçus',
    text: 'Les sons (Cor, Choc, Sort) et les actions de combat envoyés depuis les téléphones s’affichent chez vous, avec notification et log de combat.',
  },
];

const COMPANION_WARNING =
  'Une seule fois, pour passer à la nouvelle appli Android, vos joueurs devront peut-être désinstaller l’ancienne. Leur fiche revient en rejoignant la table avec le même nom et le même mot de passe.';

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '0.8.23',
    title: 'Appli Android : plus rapide et plus fiable',
    items: [
      {
        icon: '⚡',
        title: 'Table trouvée en moins d’une seconde',
        text: 'Quand le Hub mobile est démarré, Grimoire annonce votre table sur le Wi-Fi. L’appli des joueurs la trouve aussitôt, sans balayer le réseau.',
      },
      {
        icon: '📷',
        title: 'Scanner de QR Code fiable',
        text: 'L’appli utilise le scanner de Google, qui marche sur tous les téléphones Android. Plus de caméra bloquée sans message.',
      },
      {
        icon: '🛡️',
        title: 'Vraie icône Grimoire',
        text: 'L’appli affiche maintenant le blason de Grimoire sur l’écran d’accueil du téléphone.',
      },
      {
        icon: '↩️',
        title: 'Bouton Retour d’Android',
        text: 'Il ferme la fenêtre ouverte ou revient au premier onglet au lieu de quitter l’appli ; la connexion à la table reste active.',
      },
    ],
    warning: 'Si un joueur ne voit pas votre table, vérifiez que le pare-feu Windows autorise Grimoire sur les réseaux privés. Le QR Code de connexion reste disponible.',
  },
  {
    version: '0.8.22',
    title: 'Le Compagnon Joueur passe un cap',
    items: COMPANION_NOTES,
    warning: COMPANION_WARNING,
  },
];
