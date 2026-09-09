// GitHub Pages receives only these public assets, never the repository root.
const fs = require('node:fs');
const path = require('node:path');
const files = ['index.html','config.js','app.js','sync.js','apps-script/Inventory.js'];
const output = path.resolve(__dirname, '..', '.site-output');
// This directory is generated solely by this build; discard stale output.
fs.rmSync(output,{recursive:true,force:true});
for (const file of files) {
  const target=path.join(output,file);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.copyFileSync(path.resolve(__dirname,'..',file),target);
}
fs.writeFileSync(path.join(output,'.nojekyll'),'');
console.log('Built public app assets in .site-output');
