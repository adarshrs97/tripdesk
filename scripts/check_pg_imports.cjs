const fs = require('fs');
const path = require('path');

function checkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      checkDir(full);
    } else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.match(/from\s+['"]pg['"]/)) {
        console.log('File imports pg:', full);
      }
    }
  }
}

console.log('--- Checking src/components ---');
checkDir('src/components');
console.log('--- Checking src/services (non-server) ---');
for (const f of fs.readdirSync('src/services')) {
  if (!f.startsWith('server')) {
    const full = path.join('src/services', f);
    const content = fs.readFileSync(full, 'utf8');
    if (content.match(/from\s+['"]pg['"]/)) {
      console.log('Client service imports pg:', full);
    }
  }
}
console.log('--- Check complete ---');
