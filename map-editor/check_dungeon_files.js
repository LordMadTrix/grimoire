import fs from 'fs';
import path from 'path';

const dir = 'd:/DEV/grimoire/map-editor/public/assets/stamps/Fantasy_Battlemaps/Dungeons/';
if (fs.existsSync(dir)) {
  const files = fs.readdirSync(dir);
  console.log(`Total files in Dungeons: ${files.length}`);
  
  const metadataFile = 'd:/DEV/grimoire/map-editor/src/lib/imported_stamps.json';
  const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));

  files.slice(0, 40).forEach(file => {
    const id = 'imported_' + path.basename(file, '.png');
    const meta = metadata.find(m => m.id === id);
    console.log(`File: ${file} | ID: ${id} | Name: ${meta ? meta.name : 'Unknown'} | Category: ${meta ? meta.category : ''} | Subcategory: ${meta ? meta.subcategory : ''}`);
  });
} else {
  console.log("Directory does not exist");
}
