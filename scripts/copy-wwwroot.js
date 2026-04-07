const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const wwwroot = path.join(root, 'build', 'api', 'wwwroot');
const adminDir = path.join(wwwroot, 'admin');
const posSrc = path.join(root, 'client', 'dist', 'pos', 'browser');
const adminSrc = path.join(root, 'client', 'dist', 'admin', 'browser');

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Copying POS -> wwwroot/');
copyRecursive(posSrc, wwwroot);

console.log('Copying Admin -> wwwroot/admin/');
copyRecursive(adminSrc, adminDir);

console.log('Done.');
