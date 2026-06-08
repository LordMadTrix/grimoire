import fs from 'fs';

const path = 'C:\\Users\\MadTrix\\Downloads\\inkarnate_urls (5).json';
if (fs.existsSync(path)) {
  const urls = JSON.parse(fs.readFileSync(path, 'utf-8'));
  const categories = new Set();
  const subcategories = new Set();

  urls.forEach(item => {
    if (typeof item === 'object' && item !== null) {
      if (item.category) categories.add(item.category);
      if (item.subcategory) subcategories.add(item.subcategory);
    }
  });

  console.log("File exists! Items:", urls.length);
  console.log("Unique categories found in Downloads (5):", Array.from(categories));
  console.log("Number of unique subcategories:", subcategories.size);
  console.log("Sample subcategories:", Array.from(subcategories).slice(0, 10));
} else {
  console.log("Downloads/inkarnate_urls (5).json does not exist.");
}
