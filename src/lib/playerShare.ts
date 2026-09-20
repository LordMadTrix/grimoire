import { emitToPlayerView, broadcastToPlayers } from './api';
import { notifStore } from './stores/notifications.svelte';

export interface CleanNoteResult {
  title: string;
  cleanText: string;
  cleanHtml: string;
  secretsCount: number;
  hasReadAloud: boolean;
}

/**
 * Nettoie le contenu d'une note Markdown pour les joueurs :
 * - Retire le frontmatter YAML
 * - Détecte et masque les secrets MJ (> [!SECRET] et %%...%%) si demandé
 * - Génère une version texte clair et une version HTML pour le rendu parchemin
 */
export function cleanNoteForPlayers(
  rawContent: string,
  options: { hideSecrets?: boolean; defaultTitle?: string } = {}
): CleanNoteResult {
  const hideSecrets = options.hideSecrets ?? true;
  let text = rawContent || '';

  // 1. Extraire le titre depuis le frontmatter YAML si présent
  let detectedTitle = options.defaultTitle || 'Document Partagé';
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fmMatch) {
    const titleLine = fmMatch[1].split('\n').find(l => /^title\s*:/i.test(l));
    if (titleLine) {
      detectedTitle = titleLine.replace(/^title\s*:\s*["']?/i, '').replace(/["']?\s*$/, '').trim();
    }
    // Retirer le frontmatter
    text = text.slice(fmMatch[0].length).trim();
  }

  // Si pas de titre dans le frontmatter, chercher le premier titre H1 (# Titre)
  if (detectedTitle === 'Document Partagé') {
    const h1Match = text.match(/^#\s+(.+)$/m);
    if (h1Match) {
      detectedTitle = h1Match[1].trim();
    }
  }

  // 2. Détection et comptage des secrets MJ
  let secretsCount = 0;
  let hasReadAloud = false;

  // Détection des blocs callout > [!SECRET] (lignes consécutives commençant par >)
  const secretCalloutRegex = /(?:^|\n)>\s*\[!SECRET\][^\n]*(?:\n>[^\n]*)*/gi;
  const secretMatches = text.match(secretCalloutRegex);
  if (secretMatches) {
    secretsCount += secretMatches.length;
  }

  // Détection des commentaires inline %% ... %%
  const commentRegex = /%%[\s\S]*?%%/g;
  const commentMatches = text.match(commentRegex);
  if (commentMatches) {
    secretsCount += commentMatches.length;
  }

  // Détection des blocs > [!READALOUD]
  if (/(?:^|\n)>\s*\[!READALOUD\]/i.test(text)) {
    hasReadAloud = true;
  }

  // 3. Masquage des secrets si demandé
  if (hideSecrets) {
    text = text.replace(secretCalloutRegex, '').trim();
    text = text.replace(commentRegex, '').trim();
  }

  // 4. Construction de la version HTML adaptée au parchemin de la Vue Joueur
  const cleanHtml = markdownToParchmentHtml(text);

  // 5. Construction de la version texte épurée pour les smartphones
  const cleanText = text
    // Nettoyer les balises callouts restantes
    .replace(/^>\s*\[![A-Za-z0-9_-]+\][^\n]*/gm, '')
    .replace(/^>\s?/gm, '')
    // Nettoyer la syntaxe Markdown basique
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => label || target)
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();

  return {
    title: detectedTitle,
    cleanText,
    cleanHtml,
    secretsCount,
    hasReadAloud,
  };
}

/**
 * Convertit un texte Markdown en HTML simple et élégant
 * pour l'affichage dans le parchemin cinématique de la Vue Joueur
 */
function markdownToParchmentHtml(md: string): string {
  if (!md) return '';

  function esc(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function inlineFormat(s: string): string {
    return esc(s)
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => `<span style="color:#8b4513;font-weight:600;">${label || target}</span>`)
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/==(.+?)==/g, '<mark style="background:#fef08a;padding:1px 4px;border-radius:2px;">$1</mark>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.06);padding:2px 4px;border-radius:3px;font-family:monospace;">$1</code>');
  }

  const lines = md.split('\n');
  const result: string[] = [];
  let inList = false;
  let inQuote = false;
  let quoteBuffer: string[] = [];

  function flushQuote() {
    if (quoteBuffer.length > 0) {
      result.push(`<blockquote style="border-left:3px solid #8c7343;margin:12px 0;padding:6px 14px;font-style:italic;background:rgba(140,115,67,0.08);">${quoteBuffer.map(l => `<p style="margin:4px 0;">${inlineFormat(l)}</p>`).join('')}</blockquote>`);
      quoteBuffer = [];
      inQuote = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushQuote();
      if (inList) { result.push('</ul>'); inList = false; }
      continue;
    }

    // Blocs de citation >
    if (trimmed.startsWith('>')) {
      inQuote = true;
      // Retirer le > et éventuel callout
      const qText = trimmed.replace(/^>\s?/, '').replace(/^\[![A-Za-z0-9_-]+\]\s*/i, '');
      if (qText) quoteBuffer.push(qText);
      continue;
    } else {
      flushQuote();
    }

    // Titres
    const hm = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      if (inList) { result.push('</ul>'); inList = false; }
      const level = Math.min(hm[1].length + 1, 4); // h2 à h4 dans le parchemin
      result.push(`<h${level} style="font-family:'Cinzel',serif;color:#3b2818;margin:16px 0 8px;border-bottom:1px solid rgba(59,40,24,0.2);padding-bottom:4px;">${inlineFormat(hm[2])}</h${level}>`);
      continue;
    }

    // Séparateur horizontal
    if (/^---+$/.test(trimmed)) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push('<hr style="border:none;border-top:1px solid rgba(59,40,24,0.25);margin:18px 0;">');
      continue;
    }

    // Listes à puces
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) { result.push('<ul style="margin:8px 0 8px 24px;padding:0;">'); inList = true; }
      const itemText = trimmed.replace(/^[-*]\s+(\[[ x]\]\s*)?/, '');
      result.push(`<li style="margin:4px 0;">${inlineFormat(itemText)}</li>`);
      continue;
    } else {
      if (inList) { result.push('</ul>'); inList = false; }
    }

    // Paragraphe classique
    result.push(`<p style="margin:8px 0;line-height:1.6;">${inlineFormat(trimmed)}</p>`);
  }

  flushQuote();
  if (inList) result.push('</ul>');

  return result.join('\n');
}

export interface ShareOptions {
  title: string;
  text: string;
  html?: string;
  target: 'all' | 'playerView' | 'mobile';
  mode?: 'parchment' | 'ambient';
}

/**
 * Diffuse un document ou un extrait vers la Vue Joueur (TV) et/ou les Smartphones Joueurs
 */
export async function shareWithPlayers(options: ShareOptions): Promise<boolean> {
  const { title, text, target, mode = 'parchment' } = options;
  const html = options.html || markdownToParchmentHtml(text);
  const targetsSent: string[] = [];

  try {
    // 1. Diffusion vers la Vue Joueur (TV)
    if (target === 'all' || target === 'playerView') {
      if (mode === 'ambient') {
        await emitToPlayerView('ambient_text', { text: text.slice(0, 300) });
        targetsSent.push('Vue Joueur (Ambiance)');
      } else {
        await emitToPlayerView('show_handout', {
          type: 'note',
          title: title || 'Document du MJ',
          content: html,
        });
        targetsSent.push('Vue Joueur (Parchemin)');
      }
    }

    // 2. Diffusion vers les Smartphones Joueurs (WebSockets Mobile)
    if (target === 'all' || target === 'mobile') {
      await broadcastToPlayers('handout', {
        title: title || 'Document du MJ',
        text,
        type: 'text',
      });
      targetsSent.push('Smartphones Joueurs');
    }

    // 3. Notification de succès
    const targetLabel = targetsSent.join(' & ');
    notifStore.add(
      '📤',
      'Diffusé aux Joueurs',
      `Document "${title}" envoyé avec succès vers : ${targetLabel}.`,
      'success',
      4000
    );
    return true;
  } catch (err) {
    console.error('Erreur lors de la diffusion aux joueurs:', err);
    notifStore.add(
      '⚠️',
      'Échec de diffusion',
      `Impossible d'envoyer aux joueurs : ${String(err)}`,
      'danger',
      5000
    );
    return false;
  }
}
