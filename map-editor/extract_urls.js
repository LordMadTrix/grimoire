import fs from 'fs';
import path from 'path';
import readline from 'readline';

const logPath = 'C:\\Users\\MadTrix\\.gemini\\antigravity-ide\\brain\\d41468b7-878d-4979-9d98-0685747005fe\\.system_generated\\logs\\transcript.jsonl';
const outputPath = 'd:\\DEV\\grimoire\\map-editor\\inkarnate_urls.json';

async function extract() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const urlSet = new Set();
  const cdnRegex = /https:\/\/cdn2\.inkarnate\.com\/[a-zA-Z0-9_-]+/g;

  for await (const line of rl) {
    // Find all matches in this line
    let match;
    while ((match = cdnRegex.exec(line)) !== null) {
      urlSet.add(match[0]);
    }
  }

  const urls = Array.from(urlSet);
  console.log(`Found ${urls.length} unique Inkarnate URLs in the transcript.`);
  
  if (urls.length > 0) {
    fs.writeFileSync(outputPath, JSON.stringify(urls, null, 2), 'utf-8');
    console.log(`Successfully wrote ${urls.length} URLs to ${outputPath}.`);
  } else {
    console.log("No URLs found.");
  }
}

extract().catch(console.error);
