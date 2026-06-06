import fs from 'fs';
import path from 'path';
import readline from 'readline';

const logPath = 'C:\\Users\\MadTrix\\.gemini\\antigravity-ide\\brain\\d41468b7-878d-4979-9d98-0685747005fe\\.system_generated\\logs\\transcript.jsonl';

async function inspect() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  for await (const line of rl) {
    if (line.includes('"source":"USER_EXPLICIT"') && line.includes('WorldEditorPage-module__body')) {
      count++;
      console.log(`Found USER_EXPLICIT line #${count} with WorldEditorPage-module__body!`);
      console.log("Line length:", line.length);
      fs.writeFileSync(`d:\\DEV\\grimoire\\map-editor\\extracted_raw_user_${count}.txt`, line, 'utf-8');
      console.log(`Wrote to extracted_raw_user_${count}.txt`);
    }
  }
}

inspect().catch(console.error);
