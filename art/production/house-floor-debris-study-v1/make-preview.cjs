const sharp = require('sharp');
const path = require('path');
const here = __dirname;
async function main() {
  const source = path.join(here, 'house_wall_source.png');
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 4) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
  }
  if (right < 0) throw Error('empty alpha');
  const fragment = await sharp(source).extract({ left, top, width: right - left + 1, height: bottom - top + 1 }).resize({ width: 250 }).png().toBuffer({ resolveWithObject: true });
  const candidate = path.join(here, 'house_wall_candidate.png');
  await sharp({ create: { width: 256, height: fragment.info.height + 6, channels: 4, background: '#00000000' } }).composite([{ input: fragment.data, left: 3, top: 3 }]).withIccProfile('srgb').png().toFile(candidate);
  const assets = [candidate, path.join(here, '../../game/fx/debris.png'), path.join(here, '../../game/fx/building_debris/debris_house.png')];
  const icons = await Promise.all(assets.map(a => sharp(a).resize(128, 128, { fit: 'contain', background: '#00000000' }).png().toBuffer()));
  await sharp(path.join(here, '../../game/env/sky.png')).resize(600, 220, { fit: 'cover' }).composite(icons.map((input, i) => ({ input, left: 36 + i * 200, top: 46 }))).withIccProfile('srgb').png().toFile(path.join(here, 'comparison.png'));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
