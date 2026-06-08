import fs from 'fs';
const file = 'd:/DEV/grimoire/map-editor/inkarnate_urls.json';
if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, 'utf8');
  console.log("Length of content:", content.length);
  // Search for the ID
  const id = 'gmua4v7ktx5iobfgn3aw0trqpvyw';
  const index = content.indexOf(id);
  console.log("Index of ID:", index);
  if (index !== -1) {
    console.log("Snippet:", content.substring(index - 100, index + 200));
  } else {
    console.log("Not found in inkarnate_urls.json");
  }
} else {
  console.log("File does not exist");
}
