# Spécification de Conception : Éditeur de Tokens Grimoire

**Date :** 21 Octobre 2026  
**Auteur :** Antigravity & Madtrix  
**Statut :** En attente d'approbation  

---

## 1. Intention & Contexte (« Le Pourquoi »)

En pleine session de jeu sur table virtuelle (VTT) ou lors de la préparation d'une campagne, le Maître du Jeu a fréquemment besoin d'ajouter un pion à la volée. Par exemple :
> *« Le MJ en partie veut ajouter un pion : il peut créer un hexagone avec une frise en or avec écrit "Tavernier", choisir un portrait dans la Bibliothèque Céleste, cadrer le visage et le déposer immédiatement sur la carte ou l'enregistrer dans son dossier de tokens. »*

Actuellement, l'importation d'un pion nécessite souvent des outils externes (Token Stamp, Photoshop, etc.), cassant le rythme de la partie. L'Éditeur de Tokens de Grimoire apporte une solution intégrée, ultra-rapide, dynamique et immersive.

---

## 2. Objectifs, Non-Objectifs & Anti-Objectifs

### Objectifs (Goals)
- **Création Express en Jeu (< 15 secondes)** : Générer un pion complet à partir d'un preset éditable ou de zéro en cours de partie sans recharger la page.
- **Frise Ornementale Adaptative** : La bordure travaillée (or royal ciselé, acier martelé, runes violettes, etc.) épouse fidèlement la géométrie choisie (Cercle, Hexagone, Bouclier héraldique) avec perles, reflets et rivets.
- **Connexion Directe à la Bibliothèque Céleste** : Parcourir et insérer en un clic les portraits, PNJ et tampons du catalogue d'assets en ligne de Grimoire, en plus de l'import local (PNG/JPG) et des icônes.
- **Manipulation Libre à la Souris** :
  - **Pan & Zoom de l'illustration** : glisser à la souris pour cadrer précisément le visage et molette/slider pour zoomer.
  - **Déplacement libre du nom** : attraper et positionner le cartouche de nom n'importe où autour ou sur le pion.
- **Interrupteurs On/Off Modulaires** : Activer ou masquer indépendamment chaque élément décoratif ou fonctionnel (Nom, Frise, Jauge de PV en arc, Pastille d'alignement, Aura magique).
- **Enregistrement dans le Dossier MJ** : Sauvegarde dans le coffre actif (`{vaultPath}/tokens/{nom}.png` et `{vaultPath}/tokens/{nom}.json`) pour réutilisation pérenne.
- **Placement Direct sur la Carte VTT** : Bouton immédiat qui instancie le pion sur la grille PixiJS de la scène en cours.

### Non-Objectifs (Non-Goals)
- Remplacer un logiciel de retouche photo bitmap complexe (pas de calques multiples infinis, de masques de fusion ou de filtres Photoshop lourds).
- Gérer les fiches de personnage complètes (ce rôle revient au gestionnaire de fiches de Grimoire).

### Anti-Objectifs (Ce qu'il faut éviter)
- Ne jamais tronquer ou rogner le nom du token : le cartouche doit rester 100% lisible.
- Ne pas figer la frise en cercle quand l'utilisateur sélectionne un hexagone ou un bouclier.
- Ne pas forcer des options dont le MJ ne veut pas : chaque couche doit pouvoir être éteinte d'un simple toggle.

---

## 3. Architecture Technique & Choix de Conception

### 3.1 Stack
- **Frontend** : Svelte 5 (Runes `$state`, `$derived`, `$props`), CSS Vanilla moderne.
- **Rendu Visuel & Export** : HTML5 Canvas + SVG dynamique pour générer l'image PNG détourée haute résolution (512x512 px) avec transparence alpha.
- **Intégration Grimoire** :
  - `src/lib/stores/celestialCache.ts` : pour requêter les portraits et assets de la Bibliothèque Céleste.
  - `src/lib/stores/vault.svelte.ts` : `getVaultPath()` pour écrire dans `{vaultPath}/tokens/`.
  - `src/lib/stores/vtt.svelte.ts` : pour invoquer la création de pion sur le canvas PixiJS (`addTokenToActiveScene`).
  - `src-tauri` / plugin FS : pour la persistance locale sur disque de l'image et du fichier JSON.

### 3.2 Données d'un Token (`TokenData`)
```typescript
export interface TokenData {
  id: string;
  name: string;
  shape: 'circle' | 'hex' | 'shield';
  borderStyle: 'gold' | 'steel' | 'runic' | 'copper' | 'dark-spikes';
  showBorder: boolean;
  
  // Image & Cadrage
  imageUrl: string;
  imageSource: 'celestial' | 'local' | 'emoji';
  imagePan: { x: number; y: number };
  imageScale: number;
  backgroundColor: string;
  
  // Nom
  showName: boolean;
  namePosition: { x: number; y: number; preset?: 'bottom' | 'top' | 'center' | 'inside-bottom' };
  
  // Options Tactiques
  showHpBar: boolean;
  hpPercent: number;
  showStatusBadge: boolean;
  status: 'ally' | 'neutral' | 'hostile' | 'boss';
  statusPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  
  // Effets
  aura: 'none' | 'holy' | 'fire' | 'magic';
  scaleGrid: number; // 0.5 (petit), 1 (moyen), 2 (grand), 3 (immense)
}
```

---

## 4. Parcours Utilisateur & Interface

1. **Ouverture** :
   - Depuis la barre d'outils VTT (`VTTToolbar.svelte`) via le bouton `🪙 Éditeur de Tokens` (ou clic droit sur la grille VTT « Nouveau Pion personnalisé »).
   - Modal flottante avec design sombre élégant aux liserés dorés typique de Grimoire.
2. **Panneau Gauche : Presets** :
   - Tavernier, Garde de la Cité, Chef Gobelin, Archimage, Paladin, Bête féroce.
3. **Centre : Live Canvas Interactif** :
   - Rendu en direct à échelle 1:1.
   - Déplacement libre du portrait au clic-glisser à la souris + zoom à la molette.
   - Déplacement libre du cartouche de nom au clic-glisser.
   - Contrôles de zoom rapide et bouton de recentrage.
4. **Panneau Droit : Paramètres & Bibliothèque Céleste** :
   - Champ texte du nom.
   - Bouton d'ouverture de l'explorateur de la Bibliothèque Céleste avec recherche et filtres de catégories.
   - Interrupteurs On/Off indépendants pour chaque calque.
   - Sélecteurs de forme, de métal et d'aura.
5. **Actions Finales** :
   - `📁 Enregistrer dans le Dossier MJ` : écrit `tokens/<slug>.png` et `tokens/<slug>.json` dans le coffre actif du MJ.
   - `🗺️ Placer sur la Map VTT` : instancie immédiatement le token sur le plateau actif aux coordonnées du centre de la vue ou de la souris.

---

## 5. Ce qui est laissé à l'appréciation du développeur (Builder Freedom)
- Le choix de la formule exacte de conversion Canvas SVG -> PNG Blob haute résolution.
- L'organisation interne des sous-composants (`TokenEditorModal.svelte`, `CelestialArtPickerModal.svelte`).
- L'animation CSS d'ouverture et de fermeture de la modal.
