/* Read-only audit of the old CMS's narrow off-white image matte.
   Prints metadata, never crops/re-encodes photographs. Review the output before
   updating data/photo-insets.js; new uploads are deliberately not auto-cropped. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

function matteInsets(data, info) {
  const { width, height, channels } = info;
  // This is the verified legacy export size, not a general photo cropper.
  if (width !== 1280 || height !== 784 || channels !== 3) return null;
  const sides = [false, true].map(right => {
    let inset = 0;
    for (let x = 0; x < 20; x++) {
      let nearWhite = 0, sum = 0;
      for (let y = 0; y < height; y++) {
        const at = (y * width + (right ? width - 1 - x : x)) * channels;
        const lo = Math.min(data[at], data[at + 1], data[at + 2]);
        const hi = Math.max(data[at], data[at + 1], data[at + 2]);
        if (lo >= 210 && hi - lo <= 35) nearWhite++;
        sum += (data[at] + data[at + 1] + data[at + 2]) / 3;
      }
      if (nearWhite / height < .99 || sum / height < 239) break;
      inset++;
    }
    return inset;
  });
  // Both edges must independently end at the known 13px boundary. White cars,
  // walls, skies and asymmetric borders must not become crop instructions.
  return sides[0] === 13 && sides[1] === 13 ? [13, 13, width, height] : null;
}

async function audit() {
  const sharp = require('sharp');
  const root = path.resolve(__dirname, '..');
  const inventory = JSON.parse(fs.readFileSync(path.join(root, 'data/inventory.snapshot.json'), 'utf8'));
  const photos = [...new Set(inventory.flatMap(vehicle => vehicle.shots || []))];
  const result = {};
  for (const url of photos) {
    const match = url.match(/\/(\d{4})\/(\d{2})\/([^/]+?)\.(?:jpe?g|png)$/i);
    if (!match) continue;
    const key = match[1] + '-' + match[2] + '_' + match[3];
    const { data, info } = await sharp(path.join(root, 'img/v', key + '-1280.jpg')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const insets = matteInsets(data, info);
    if (insets) result[key] = insets;
  }
  return result;
}

if (require.main === module) audit().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { matteInsets, audit };
