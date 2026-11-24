// Az oldal összerakása: a közös forrásfájlokat (katalógus, értelmező, modell) beágyazza az index.html-be.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const tpl = fs.readFileSync(path.join(ROOT, 'src', 'template.html'), 'utf8');
const src = ['catalog.js', 'parse.js', 'model.js'].map(f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n');
fs.writeFileSync(path.join(ROOT, 'site', 'index.html'), tpl.replace('/*__INLINE_SRC__*/', () => src));
console.log('site/index.html kész');
