const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'unretweet-delete-quote.js');
const distDir = path.join(root, 'dist');
const source = fs.readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, '');

fs.mkdirSync(distDir, { recursive: true });

const bookmarklet = `javascript:${encodeURIComponent(`(() => { ${source}\n })();`)}`;
fs.writeFileSync(path.join(distDir, 'purgex-bookmarklet.txt'), bookmarklet, 'utf8');

const userscript = `// ==UserScript==
// @name         PurgeX Timeline Cleaner
// @namespace    https://local.purgex
// @version      0.1.0
// @description  Open the PurgeX cleanup panel on X/Twitter timelines.
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        none
// ==/UserScript==

${source}
`;
fs.writeFileSync(path.join(distDir, 'purgex.user.js'), userscript, 'utf8');

console.log('Generated dist/purgex-bookmarklet.txt');
console.log('Generated dist/purgex.user.js');
