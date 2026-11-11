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
    version: '0.8.22',
    title: 'Le Compagnon Joueur passe un cap',
    items: COMPANION_NOTES,
    warning: COMPANION_WARNING,
  },
];
