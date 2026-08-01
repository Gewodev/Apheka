import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
let [major, minor, patch] = pkg.version.split('.').map(Number);
patch++;
const newVer = `${major}.${minor}.${patch}`;

function bumpJson(path, key) {
  const raw = readFileSync(path, 'utf8');
  const obj = JSON.parse(raw);
  obj[key] = newVer;
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n');
}

bumpJson('./package.json', 'version');
bumpJson('./src-tauri/tauri.conf.json', 'version');

const cargo = readFileSync('./src-tauri/Cargo.toml', 'utf8');
writeFileSync('./src-tauri/Cargo.toml', cargo.replace(/^version = ".*"/m, `version = "${newVer}"`));

execSync('git add -A', { stdio: 'inherit' });
execSync(`git commit -m "release v${newVer}"`, { stdio: 'inherit' });
execSync(`git tag v${newVer}`, { stdio: 'inherit' });
execSync('git push', { stdio: 'inherit' });
execSync('git push --tags', { stdio: 'inherit' });

console.log(`\n✓ Released v${newVer} — GitHub Actions empezará el build automáticamente.`);
