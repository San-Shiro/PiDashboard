const fs = require('fs');

let html = fs.readFileSync('widgets/crypto-desk/fragment/crypto.html', 'utf8');

// Replace the buggy IIFE start with a robust instance capture
html = html.replace(/\(function\(\) \{\s+const container = document\.querySelector\('\.crypto-container'\);\s+const list = document\.querySelector\('\.crypto-list'\);/, 
`(function() {
  const myInstanceId = window.instanceId;
  const root = document.getElementById(myInstanceId) || document;
  const container = root.querySelector('.crypto-container');
  const list = root.querySelector('.crypto-list');`);

// Replace safeData[window.instanceId] with safeData[myInstanceId]
html = html.replace(/safeData\[window\.instanceId\]/g, 'safeData[myInstanceId]');

fs.writeFileSync('widgets/crypto-desk/fragment/crypto.html', html);
console.log('Fixed crypto.html instance scopes.');
