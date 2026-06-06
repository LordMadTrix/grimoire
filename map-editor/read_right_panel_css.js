import fs from 'fs';

const content = fs.readFileSync('src/components/RightPanel.svelte', 'utf8');
const lines = content.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('dungeon-slots-grid')) {
    console.log(`Line ${idx + 1}: ${l}`);
  }
});
