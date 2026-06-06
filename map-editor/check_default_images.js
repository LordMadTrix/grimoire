import fs from 'fs';
import path from 'path';

const themes = {
  classic: {
    wall: 'imported_gmua4v7ktx5iobfgn3aw0trqpvyw',
    door: 'imported_quvw6fqdrojm83pd20svtniwcbos',
    chest: 'imported_juzy62ujdon0wmo5qiv1ygwkhue2',
    pillar: 'imported_ua0xxx0yco9uhet0n34xien2nw70',
    stairs_up: 'imported_mxum8ja0e97vjiz6avc644unbnjb',
    stairs_down: 'imported_zj9ucorcmdic7wk0wwdpqiyrrrn8',
  },
  prison: {
    wall: 'imported_drno28tawfeedwm42jep9t6w5p58',
    door: 'imported_codly79togkk62b7t2a0de7inw18',
    chest: 'imported_c7va2xt9lw2pqy6mf2lk19v8zgm9',
    pillar: 'imported_ebdhe9whsys0k38dbwxxw0qsxxxa',
    stairs_up: 'imported_sm3birrpdc71rui7yah5ychfnq5j',
    stairs_down: 'imported_33istv8ff1hvps78ut39ifhj6x9i',
  },
  cave: {
    wall: 'imported_wv2bfinnybnnlyf1v5ebatubdrlm',
    door: 'imported_q6o3hj6afiv45th7xxqzoxp0u8gq',
    chest: 'imported_a8jdfemk3xgyg56bkiuzrdpwvm23',
    pillar: 'imported_0syvaindutyoa0rpzzi3e4gs4yiu',
    stairs_up: 'imported_n9lmribboj4o897zfsaf75lc17ok',
    stairs_down: 'imported_yoaljoray1fx6ocragjxz7ylj4cg',
  }
};

const metadataFile = 'd:/DEV/grimoire/map-editor/src/lib/imported_stamps.json';
const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));

for (const [themeName, assets] of Object.entries(themes)) {
  console.log(`\nTheme: ${themeName}`);
  for (const [assetName, id] of Object.entries(assets)) {
    const meta = metadata.find(m => m.id === id);
    if (!meta) {
      console.log(`  ${assetName} (${id}): NOT FOUND IN METADATA`);
      continue;
    }
    const fullPath = path.join('d:/DEV/grimoire/map-editor/public', meta.file);
    const exists = fs.existsSync(fullPath);
    console.log(`  ${assetName} (${id}): file=${meta.file} -> exists=${exists}`);
  }
}
