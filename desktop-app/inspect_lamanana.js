const fs = require('fs');
const readline = require('readline');

const filePath = 'c:\\Sergio\\KinetiQ\\iptv\\desktop-app\\epg_test.xml';

const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity
});

rl.on('line', (line) => {
    if (line.includes('La mañana en casa')) {
        console.log("Found: " + line);
        // Extract start and stop
        const match = line.match(/<ctrl94>programme([^>]+)>/);
        if (match) {
            console.log("Args: " + match[1]);
        }
        process.exit(0);
    }
});

rl.on('close', () => {
    console.log("Finished streaming.");
});
