import fs from 'fs';

const rawData = fs.readFileSync('d:\\DEV\\grimoire\\map-editor\\extracted_raw_user_1.txt', 'utf-8');

const regex = /https?:\/\/[^\s"'`\(\)>]+inkarnate[^\s"'`\(\)>]*/gi;
const matches = rawData.match(regex) || [];
const uniqueMatches = [...new Set(matches)];

console.log("Total matches:", matches.length);
console.log("Unique matches:", uniqueMatches.length);
console.log("First 20 unique matches:");
console.log(uniqueMatches.slice(0, 20));

fs.writeFileSync('d:\\DEV\\grimoire\\map-editor\\extracted_all_inkarnate_urls.json', JSON.stringify(uniqueMatches, null, 2));
