// ── OCR Service (Reconnaissance Optique de Caractères pour PDF Numérisés) ────
// Permet de lire et d'extraire automatiquement le texte de n'importe quel vieux livre,
// module ou scan de JDR (ex: AD&D, Warhammer, etc.) sans couche texte native.

import { createWorker, type Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker(['fra', 'eng'], undefined, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            // Progression optionnelle
          }
        }
      });
      return worker;
    })();
  }
  return workerPromise;
}

/**
 * Extrait le texte d'un élément canvas (page PDF actuellement rendue)
 */
export async function extractTextFromCanvas(canvas: HTMLCanvasElement): Promise<string> {
  try {
    const worker = await getWorker();
    const result = await worker.recognize(canvas);
    
    const rawText = result.data.text || '';
    // Nettoyer les césures et sauts de ligne incohérents
    return rawText
      .replace(/-\n/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (err) {
    console.error('Erreur lors de l\'analyse OCR de la page:', err);
    return '';
  }
}
