const fs = require('fs');
const content = fs.readFileSync('test_m3u_output.txt', 'utf8');
const lines = content.split('\n');
console.log("\n=== ULTIMAS 20 LINEAS DEL LOG ===");
console.log(lines.slice(-20).join('\n'));
