import fs from 'fs';
const file = './src/lib/imported_stamps.json';
const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));

const themeIds = [
  'imported_gmua4v7ktx5iobfgn3aw0trqpvyw', // wall classic
  'imported_quvw6fqdrojm83pd20svtniwcbos', // door classic
  'imported_juzy62ujdon0wmo5qiv1ygwkhue2', // chest classic
  'imported_ua0xxx0yco9uhet0n34xien2nw70', // pillar classic
  'imported_mxum8ja0e97vjiz6avc644unbnjb', // stairs_up classic
  'imported_zj9ucorcmdic7wk0wwdpqiyrrrn8'  // stairs_down classic
];

themeIds.forEach(id => {
  const found = metadata.find(m => m.id === id);
  console.log(`ID: ${id}`);
  console.log(found ? JSON.stringify(found, null, 2) : "NOT FOUND");
});
