const http = require('http');

const url = 'http://latinchannel.tv:8080/get.php?username=sergiodutra309&password=143530925&type=m3u_plus&output=m3u8';

console.log("Descargando playlist de prueba...");

http.get(url, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`);

    let data = '';
    let count = 0;

    res.on('data', (chunk) => {
        data += chunk;
        if (data.length > 5000 && count === 0) {
            console.log("\n--- PRIMEROS 1000 CARACTERES ---");
            console.log(data.substring(0, 1000));
            console.log("--------------------------------\n");
            count = 1;
        }
    });

    res.on('end', () => {
        console.log(`Descarga finalizada. Tamaño total: ${(data.length / 1024 / 1024).toFixed(2)} MB`);
        // Probar el parseo básico
        const lines = data.split('\n');
        console.log(`Líneas totales: ${lines.length}`);
        const infs = lines.filter(l => l.startsWith('#EXTINF:'));
        console.log(`Canales (#EXTINF): ${infs.length}`);
        
        // Imprimir los primeros 5 canales
        console.log("\n--- EJEMPLOS DE CANALES ---");
        for (let i = 0; i < Math.min(infs.length, 5); i++) {
            console.log(infs[i]);
            // Encontrar la URL de abajo
            const infIndex = lines.indexOf(infs[i]);
            if (infIndex + 1 < lines.length) {
                console.log("URL: " + lines[infIndex+1]);
            }
        }
    });

}).on('error', (e) => {
    console.error(`Error: ${e.message}`);
});
