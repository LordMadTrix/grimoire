import fs from 'fs';

const urls = JSON.parse(fs.readFileSync('./inkarnate_urls.json', 'utf-8'));
const entry = urls.find(u => JSON.stringify(u).includes('gmua4v7ktx5iobfgn3aw0trqpvyw'));
console.log("Entry in inkarnate_urls.json:", entry);
