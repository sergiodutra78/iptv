const fs = require('fs');
const path = require('path');

console.log("--- TEST START ---");
console.log("Dirname:", __dirname);
console.log("Cwd:", process.cwd());

const xmlPath = path.join(__dirname, 'epg_test.xml');
console.log("Busco archivo en:", xmlPath);

if (fs.existsSync(xmlPath)) {
    console.log("¡Archivo encontrado!");
    const stats = fs.statSync(xmlPath);
    console.log(`Tamaño: ${stats.size} bytes`);
} else {
    console.log("Archivo NO encontrado.");
}

console.log("--- TEST END ---");
