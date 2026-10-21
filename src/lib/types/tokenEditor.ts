export type TokenShape = 'circle' | 'hex' | 'shield';

export type TokenMetal = 'gold' | 'steel' | 'runic' | 'copper' | 'dark-spikes';

export type TokenStatus = 'ally' | 'neutral' | 'hostile' | 'boss';

export type TokenAura = 'none' | 'holy' | 'fire' | 'magic';

export type NamePositionPreset = 'bottom' | 'top' | 'center' | 'inside-bottom' | 'custom';

export type StatusPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export interface TokenDesignData {
  id: string;
  name: string;
  shape: TokenShape;
  metal: TokenMetal;
  
  // Couches activées (Toggles On/Off)
  showBorder: boolean;
  showName: boolean;
  showHpBar: boolean;
  showStatusBadge: boolean;
  
  // Image & Cadrage
  imageUrl?: string;
  emojiIcon?: string;
  backgroundColor: string;
  imagePan: { x: number; y: number };
  imageScale: number;
  
  // Position du nom
  namePreset: NamePositionPreset;
  namePosition: { x: number; y: number }; // Décalage libre en px
  
  // Combat & Statut
  hpPercent: number;
  status: TokenStatus;
  statusPosition: StatusPosition;
  
  // Effets & Échelle
  aura: TokenAura;
  scaleGrid: number; // 0.5, 1, 2, 3
}

export interface SavedTokenDescriptor {
  id: string;
  name: string;
  createdAt: number;
  imageFile: string; // Chemin relatif, ex: "tokens/tavernier-madtrix.png"
  design: TokenDesignData;
}
