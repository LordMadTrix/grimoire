// ── Service de Sauvegarde & Partage de Campagne .grimoire ─────────────────────
// Permet d'exporter ou importer en 1 clic un paquet complet de campagne
// contenant toutes les notes, cartes, tokens, fow et configurations.

import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';

export interface ExportResult {
  success: boolean;
  file_path: string;
  total_files: number;
  total_bytes: number;
}

export interface ImportResult {
  success: boolean;
  extracted_files: number;
  target_path: string;
}

/**
 * Boîte de dialogue pour exporter la campagne courante dans un fichier .grimoire
 */
export async function exportCampaignPackage(vaultPath: string, campaignTitle = 'Ma Campagne'): Promise<ExportResult | null> {
  if (!vaultPath) {
    throw new Error('Aucun coffre de campagne n\'est actuellement ouvert.');
  }

  // Demander à l'utilisateur où sauvegarder le paquet
  const defaultName = `${campaignTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.grimoire`;
  const selectedPath = await save({
    title: 'Exporter le Paquet de Campagne Grimoire',
    defaultPath: defaultName,
    filters: [
      { name: 'Paquet de Campagne Grimoire (*.grimoire)', extensions: ['grimoire'] },
      { name: 'Archive Zip (*.zip)', extensions: ['zip'] }
    ]
  });

  if (!selectedPath) return null;

  return await invoke<ExportResult>('campaign_export_package', {
    vaultPath,
    outputPath: selectedPath,
    title: campaignTitle
  });
}

/**
 * Boîte de dialogue pour sélectionner un fichier .grimoire et l'importer dans un dossier
 */
export async function importCampaignPackage(targetVaultPath: string): Promise<ImportResult | null> {
  if (!targetVaultPath) {
    throw new Error('Dossier cible non défini.');
  }

  const selectedFile = await open({
    title: 'Importer un Paquet de Campagne (.grimoire)',
    multiple: false,
    directory: false,
    filters: [
      { name: 'Paquet de Campagne Grimoire (*.grimoire, *.zip)', extensions: ['grimoire', 'zip'] }
    ]
  });

  if (!selectedFile || typeof selectedFile !== 'string') return null;

  return await invoke<ImportResult>('campaign_import_package', {
    grimoireFilePath: selectedFile,
    targetVaultPath
  });
}
