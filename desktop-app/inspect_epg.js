const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Sergio\\KinetiQ\\iptv\\desktop-app\\epg_test.xml';
const text = fs.readFileSync(filePath, 'utf-8');
const pieces = text.split('</programme>');

console.log(`Total pieces: ${pieces.length}`);

for (let i = 0; i < Math.min(5, pieces.length); i++) {
    const piece = pieces[i];
    const match = piece.match(/<programme([^>]+)>/);
    const channelMatch = piece.match(/channel="([^"]+)"/);
    if (match) {
        console.log(`Match ${i} Channel: ${channelMatch ? channelMatch[1] : 'N/A'}`);
        console.log(`  Args: ${match[1]}`);
        const titleMatch = piece.match(/<title[^>]*>([\s\S]*?)<\/title>/);
        if (titleMatch) {
            console.log(`  Title: ${titleMatch[1]}`);
        }
    }
}
