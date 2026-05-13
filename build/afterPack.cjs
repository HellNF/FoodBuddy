const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

module.exports = async ({ appOutDir, packager }) => {
  if (packager.platform.name !== 'windows') return;

  const rcedit = path.join(
    __dirname, '..', 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe'
  );
  if (!fs.existsSync(rcedit)) {
    console.warn('[afterPack] rcedit.exe non trovato, icona non iniettata');
    return;
  }

  const productName = packager.appInfo.productName;
  const exe = path.join(appOutDir, `${productName}.exe`);
  if (!fs.existsSync(exe)) {
    console.warn(`[afterPack] EXE non trovato: ${exe}`);
    return;
  }

  const icon = path.join(__dirname, 'icon.ico');
  execFileSync(rcedit, [exe, '--set-icon', icon]);
  console.log(`[afterPack] Icona iniettata in ${exe}`);
};
