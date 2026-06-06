import fs from 'fs';
import path from 'path';

const logFile = 'C:/Users/MadTrix/.gemini/antigravity-ide/brain/bdc48ba1-27f4-4789-9bac-66deb8c5d12e/.system_generated/logs/transcript.jsonl';
if (fs.existsSync(logFile)) {
  const content = fs.readFileSync(logFile, 'utf8');
  console.log("Length of transcript:", content.length);
  const id = 'gmua4v7ktx5iobfgn3aw0trqpvyw';
  const lines = content.split('\n');
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(id)) {
      console.log(`Line ${i} contains ${id}:`);
      console.log(lines[i].substring(0, 1000));
      count++;
      if (count > 5) break;
    }
  }
} else {
  console.log("Transcript file does not exist");
}
