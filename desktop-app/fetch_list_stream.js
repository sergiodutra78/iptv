import fetch from 'node-fetch';
import fs from 'fs';

async function run() {
    const url = "http://latinchannel.tv:8080/get.php?username=sergiodutra309&password=143530925&type=m3u_plus&output=m3u8";
    try {
        console.log("Fetching playlist...");
        const res = await fetch(url);
        const text = await res.text();
        const lines = text.split('\n');
        const first20 = lines.slice(0, 30).join('\n');
        fs.writeFileSync('C:\\Sergio\\KinetiQ\\iptv\\desktop-app\\playlist_sample.txt', first20);
        console.log("Saved sample to playlist_sample.txt");
    } catch (e) {
        console.error(e);
    }
}
run();
