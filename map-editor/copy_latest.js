import fs from 'fs';
import path from 'path';

const downloadsDir = 'C:\\Users\\MadTrix\\Downloads';
const targetPath = 'd:\\DEV\\grimoire\\map-editor\\inkarnate_urls.json';

function getLatestJson() {
  if (!fs.existsSync(downloadsDir)) {
    return null;
  }
  const files = fs.readdirSync(downloadsDir)
    .filter(f => f.startsWith('inkarnate_urls') && f.endsWith('.json'))
    .map(f => {
      const filePath = path.join(downloadsDir, f);
      const stats = fs.statSync(filePath);
      return { name: f, time: stats.mtimeMs, path: filePath };
    });

  if (files.length === 0) {
    return null;
  }

  // Sort by modification time descending
  files.sort((a, b) => b.time - a.time);
  return files[0];
}

const latest = getLatestJson();
if (latest) {
  console.log(`📁 Fichier trouvé : ${latest.name}`);
  console.log(`🕒 Modifié le : ${new Date(latest.time).toLocaleString()}`);
  fs.copyFileSync(latest.path, targetPath);
  console.log(`✅ Copié avec succès vers ${targetPath}`);
} else {
  console.error("❌ Aucun fichier inkarnate_urls*.json trouvé dans les Téléchargements !");
  process.exit(1);
}
