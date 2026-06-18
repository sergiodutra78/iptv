const fs = require('fs');

const xml = fs.readFileSync('epg_full.xml', 'utf8');

const matches = xml.matchAll(/<programme [^>]*channel="([^"]+)"/g);
const uniqueChannels = new Set();
for (const match of matches) {
    uniqueChannels.add(match[1]);
}

console.log("Unique channels in EPG XML (" + uniqueChannels.size + "):");
console.log(Array.from(uniqueChannels).slice(0, 100).join("\n"));
if (uniqueChannels.size === 0) {
    console.log("No <programme> channel tags found!");
}
