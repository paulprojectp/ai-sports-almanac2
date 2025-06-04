const fs = require('fs');
const path = require('path');

async function copyDir(src, dest) {
  await fs.promises.mkdir(dest, { recursive: true });
  for (const entry of await fs.promises.readdir(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

async function build() {
  const outDir = path.join(__dirname, 'out');
  await fs.promises.rm(outDir, { recursive: true, force: true });
  await fs.promises.mkdir(outDir, { recursive: true });

  await fs.promises.copyFile(path.join(__dirname, 'index.html'), path.join(outDir, 'index.html'));

  const logosSrc = path.join(__dirname, 'team-logos');
  if (fs.existsSync(logosSrc)) {
    await copyDir(logosSrc, path.join(outDir, 'team-logos'));
  }

  const publicSrc = path.join(__dirname, 'public');
  if (fs.existsSync(publicSrc)) {
    await copyDir(publicSrc, path.join(outDir, 'public'));
  }

  console.log('Static site built in', outDir);
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
