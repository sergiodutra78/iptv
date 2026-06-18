const fs = require('fs');

function test() {
    let log = "";
    try {
        log += "Iniciando prueba...\n";
        const text = fs.readFileSync('epg_test.xml', 'utf-8');
        log += `Tamaño del archivo: ${text.length} caracteres\n`;
        
        const idToNames = {};
        const channelPieces = text.split('</channel>');
        log += `Piezas de canal: ${channelPieces.length}\n`;
        
        for (const piece of channelPieces) {
            const match = piece.match(/<channel([^>]+)>/);
            if (!match) continue;
            const attrText = match[1];
            const content = piece.substring(match.index + match[0].length);
            const id = attrText.match(/id="([^"]*)"/)?.[1] || "";
            const names = [...content.matchAll(/<display-name[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/display-name>/gi)];
            idToNames[id] = names.map(n => n[1].trim());
        }

        log += `Canales mapeados: ${Object.keys(idToNames).length}\n`;

        const pieces = text.split('</programme>');
        log += `Piezas de programa: ${pieces.length}\n`;
        
        let count = 0;
        const channelIdsWithProgs = new Set();

        for (const piece of pieces) {
            const match = piece.match(/<programme([^>]+)>/);
            if (!match) continue;
            const attrText = match[1];
            const channelId = attrText.match(/channel="([^"]+)"/)?.[1];
            if (channelId) {
                channelIdsWithProgs.add(channelId);
                count++;
            }
        }

        log += `Programas totales: ${count}\n`;
        log += `Canales con programas: ${channelIdsWithProgs.size}\n`;
        
        const examples = [...channelIdsWithProgs].slice(0, 10);
        log += `Ejemplos: ${examples.join(', ')}\n`;
        
        log += "\n--- Búsqueda de Adult Swim ---\n";
        const containsAdult = Object.keys(idToNames).filter(id => id.toLowerCase().includes('adult') || idToNames[id].some(n => n.toLowerCase().includes('adult')));
        
        log += `Canales con 'Adult': ${containsAdult.map(id => `${id} (${idToNames[id].join(', ')})`).join(' | ')}\n`;
        
        for (const id of containsAdult) {
            log += `¿Tiene programas ${id}?: ${channelIdsWithProgs.has(id)}\n`;
        }

    } catch (e) {
        log += `Error: ${e.message}\n${e.stack}\n`;
    } finally {
        fs.writeFileSync('epg_debug.txt', log, 'utf-8');
    }
}

test();
