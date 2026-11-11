// 개발용 이미지 의존성 sharp로 원본의 알파 영역을 중앙에 맞춰 내보낸다.
const sharp = require('sharp');
const path = require('path');
const here = __dirname;
const items = [
  ['source/button.png', 'target_defend.png', 410],
  ['source/ring.png', 'target_defend_ring.png', 496],
  ['source/hit.png', 'target_defend_hit.png', 480],
];

async function centered(source, target, maxSize) {
  const file = path.join(here, source);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 4) {
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) throw new Error(`No visible pixels: ${source}`);
  const crop = { left, top, width: right - left + 1, height: bottom - top + 1 };
  const asset = await sharp(file).extract(crop).resize(maxSize, maxSize, { fit: 'inside' }).png().toBuffer({ resolveWithObject: true });
  await sharp({ create: { width: 512, height: 512, channels: 4, background: '#00000000' } })
    .composite([{ input: asset.data, left: Math.round((512 - asset.info.width) / 2), top: Math.round((512 - asset.info.height) / 2) }])
    .toColourspace('srgb').withIccProfile('srgb').png().toFile(path.join(here, target));
}

async function main() {
  for (const item of items) await centered(...item);
  const mini = await Promise.all(items.map(([, file]) => sharp(path.join(here, file)).resize(180, 180).png().toBuffer()));
  const sky = path.join(here, '../../game/env/sky.png');
  const placements = [{ input: mini[0], left: 18, top: 40 }, { input: mini[1], left: 234, top: 40 }, { input: mini[2], left: 450, top: 40 }, { input: mini[0], left: 666, top: 40 }, { input: mini[1], left: 666, top: 40 }];
  await sharp(sky).resize(864, 260, { fit: 'cover' }).composite(placements).toColourspace('srgb').withIccProfile('srgb').png().toFile(path.join(here, 'target_defend_preview.png'));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
