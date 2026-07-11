import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(projectRoot, 'src', 'ui', 'public');
const targetDir = join(projectRoot, 'dist', 'ui', 'public');

if (!existsSync(sourceDir)) {
  console.error(`copy-ui-assets: source not found: ${sourceDir}`);
  process.exit(1);
}

mkdirSync(dirname(targetDir), { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true });
console.log(`copy-ui-assets: copied ${sourceDir} → ${targetDir}`);
