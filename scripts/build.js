const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT_DIR, 'out');

function copyRecursive(src, dest){
  if(!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if(stats.isDirectory()){
    if(!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for(const file of fs.readdirSync(src)){
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  }else{
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function build(){
  if(fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR);

  copyRecursive(path.join(ROOT_DIR, 'index.html'), path.join(OUT_DIR, 'index.html'));
  copyRecursive(path.join(ROOT_DIR, 'team-logos'), path.join(OUT_DIR, 'team-logos'));
}

build();
console.log('Static site built in', OUT_DIR);
