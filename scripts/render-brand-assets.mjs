import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { Resvg } = require(path.join(root, '.test-data/brand-tools/node_modules/@resvg/resvg-js'));
const directory = path.join(root, 'client/public/brand');
for (const [source, target, width] of [
  ['app-icon.svg','apple-touch-icon.png',180],
  ['app-icon.svg','icon-192.png',192],
  ['app-icon.svg','icon-512.png',512],
  ['og-image.svg','og-image.png',1200]
]) {
  const renderer = new Resvg(fs.readFileSync(path.join(directory, source)), { fitTo: {mode:'width', value:width} });
  fs.writeFileSync(path.join(directory,target),renderer.render().asPng());
}
// Pillow writes a multi-resolution ICO from the same icon artwork.
execFileSync('python', ['-c',
  'from pathlib import Path; from PIL import Image; import sys; p=Path(sys.argv[1]); Image.open(p/"icon-512.png").save(p/"favicon.ico",sizes=[(16,16),(32,32),(48,48)])',
  directory
]);
console.log('Generated Aethra PNG assets and favicon.ico.');
