// ── Edge Neural TTS Service (IA Haute Définition) ────────────────────────────
// Fournit des voix de synthèse vocale neuronales ultra-réalistes et naturelles
// (Microsoft Azure Neural HD) en streaming direct MP3, 100% gratuit et sans clé API.

export interface NeuralVoice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  personality: string;
  lang: string;
  isAi: true;
}

export const NEURAL_VOICES: NeuralVoice[] = [
  { id: 'fr-FR-HenriNeural', name: '🧙‍♂️ Henri (Narrateur Fantastique)', gender: 'male', personality: 'Voix grave et posée, idéale pour les donjons & le lore', lang: 'fr-FR', isAi: true },
  { id: 'fr-FR-DeniseNeural', name: '🧝‍♀️ Denise (Conteuse Épique)', gender: 'female', personality: 'Voix douce, expressive et captivante', lang: 'fr-FR', isAi: true },
  { id: 'fr-FR-EloiseNeural', name: '🔮 Éloïse (Mystique & Vive)', gender: 'female', personality: 'Voix jeune, dynamique et cristalline', lang: 'fr-FR', isAi: true },
  { id: 'fr-FR-AlainNeural', name: '⚔️ Alain (Héros & Guerrier)', gender: 'male', personality: 'Voix héroïque, claire et martiale', lang: 'fr-FR', isAi: true },
  { id: 'fr-FR-MauriceNeural', name: '📜 Maurice (Vieux Sage & Érudit)', gender: 'male', personality: 'Voix d\'ancien érudit, calme et posée', lang: 'fr-FR', isAi: true },
  { id: 'fr-FR-ClaudeNeural', name: '👑 Claude (Noble & Solennel)', gender: 'male', personality: 'Voix impériale, solennelle et profonde', lang: 'fr-FR', isAi: true },
  { id: 'fr-FR-JeromeNeural', name: '🎭 Jérôme (Barde & Voyageur)', gender: 'male', personality: 'Voix narrative, enjouée et vivante', lang: 'fr-FR', isAi: true },
  { id: 'fr-FR-CoralieNeural', name: '🌿 Coralie (Prêtresse & Nature)', gender: 'female', personality: 'Voix sereine, harmonieuse et douce', lang: 'fr-FR', isAi: true },
  { id: 'fr-CA-JeanNeural', name: '🛡️ Jean (Garde & Ranger)', gender: 'male', personality: 'Voix robuste et chaleureuse', lang: 'fr-CA', isAi: true },
  { id: 'fr-CA-SylvieNeural', name: '✨ Sylvie (Fée & Enchanteresse)', gender: 'female', personality: 'Voix féerique et aérienne', lang: 'fr-CA', isAi: true }
];

const EDGE_WS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EA6511D69E5500005521E77D';

function generateSecWebSocketKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function getRateStr(rate: number): string {
  const pct = Math.round((rate - 1.0) * 100);
  return (pct >= 0 ? `+${pct}%` : `${pct}%`);
}

function getPitchStr(pitch: number): string {
  const pct = Math.round((pitch - 1.0) * 100);
  return (pct >= 0 ? `+${pct}Hz` : `${pct}Hz`);
}

/**
 * Synthétise un texte en voix neuronale IA ultra-réaliste et retourne une URL Blob audio MP3
 */
export async function synthesizeNeuralSpeech(
  text: string,
  voiceId = 'fr-FR-HenriNeural',
  rate = 1.0,
  pitch = 1.0
): Promise<string> {
  const cleanText = text.trim();
  if (!cleanText) throw new Error('Texte vide');

  return new Promise((resolve, reject) => {
    const connectionId = crypto.randomUUID().replace(/-/g, '');
    const wsUrl = `${EDGE_WS_URL}&ConnectionId=${connectionId}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    const audioChunks: Uint8Array[] = [];
    let isFinished = false;

    const timeout = setTimeout(() => {
      if (!isFinished) {
        ws.close();
        reject(new Error('Délai d\'attente dépassé pour la synthèse vocale neuronale'));
      }
    }, 15000);

    ws.onopen = () => {
      const now = new Date().toISOString();

      // 1. Envoyer la configuration audio MP3
      const configMsg = `X-Timestamp:${now}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' },
                outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
              }
            }
          }
        });
      ws.send(configMsg);

      // 2. Envoyer le texte SSML
      const reqId = crypto.randomUUID().replace(/-/g, '');
      const rateStr = getRateStr(rate);
      const pitchStr = getPitchStr(pitch);
      const escaped = escapeXml(cleanText);

      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='fr-FR'>` +
        `<voice name='${voiceId}'><prosody pitch='${pitchStr}' rate='${rateStr}'>${escaped}</prosody></voice></speak>`;

      const ssmlMsg = `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${now}\r\nPath:ssml\r\n\r\n${ssml}`;
      ws.send(ssmlMsg);
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        if (event.data.includes('Path:turn.end')) {
          isFinished = true;
          clearTimeout(timeout);
          ws.close();

          if (audioChunks.length === 0) {
            reject(new Error('Aucune donnée audio reçue'));
            return;
          }

          const blob = new Blob(audioChunks as any, { type: 'audio/mp3' });
          const audioUrl = URL.createObjectURL(blob);
          resolve(audioUrl);
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Trame binaire : les 2 premiers octets indiquent la taille du header textuel
        const dataView = new DataView(event.data);
        if (dataView.byteLength > 2) {
          const headerLength = dataView.getUint16(0, false);
          if (dataView.byteLength > 2 + headerLength) {
            const audioData = new Uint8Array(event.data, 2 + headerLength);
            audioChunks.push(audioData);
          }
        }
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      reject(err);
    };

    ws.onclose = () => {
      if (!isFinished && audioChunks.length > 0) {
        clearTimeout(timeout);
        const blob = new Blob(audioChunks as any, { type: 'audio/mp3' });
        resolve(URL.createObjectURL(blob));
      }
    };
  });
}
