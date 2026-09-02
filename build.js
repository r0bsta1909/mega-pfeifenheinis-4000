// Bündelt engine + bot in die Client-HTML → dist/index.html
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
let html = read('client/index.html');
const wrap = src => '(function(){\n' + src + '\n})();';
html = html.replace('/*__ENGINE__*/', () => wrap(read('engine/engine.js'))).replace('/*__BOT__*/', () => wrap(read('engine/bot.js')));
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/index.html'), html);
console.log('dist/index.html geschrieben (' + (html.length / 1024).toFixed(0) + ' KB)');
