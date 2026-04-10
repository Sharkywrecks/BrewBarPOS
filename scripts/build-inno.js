const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const version = require('../package.json').version;

// Find ISCC.exe — check PATH first, then common install locations
const candidates = [
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Inno Setup 6', 'ISCC.exe'),
  path.join(process.env.ProgramFiles || '', 'Inno Setup 6', 'ISCC.exe'),
];

let iscc;
try {
  execSync('where iscc', { stdio: 'ignore' });
  iscc = 'iscc';
} catch {
  iscc = candidates.find(c => fs.existsSync(c));
}

if (!iscc) {
  console.error('ISCC.exe not found. Install Inno Setup 6 from https://jrsoftware.org/isdl.php');
  process.exit(1);
}

console.log(`Building Inno Setup installer v${version}...`);
execSync(`"${iscc}" /DMyAppVersion=${version} installer/setup.iss`, { stdio: 'inherit' });
