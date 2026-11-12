import { describe, expect, it } from 'vitest';
import { defaultSettings, sanitizeSettings } from '../view/artPlan';
import { ENV_DATA, type EnvData, hexTint, neededEnvFiles, resolveEnvPlan } from '../view/envPlan';

/** M6 건물 · 배경 · 파괴 그림 계획 (H-42) — 순수 함수 · 폴백 (docs/art.md §7) */
const data: EnvData = {
  config: {
    env_enabled: false,
    sky_file: 'sky.png',
    strip_file: 'ground_strip.png',
    strip_ground_ratio: 0.24,
    strip_burrow_x: 0.887,
    ring_file: 'shock_ring.png',
    dust_file: 'dust.png',
    debris_file: 'debris.png',
  },
  art: [
    { art_id: 'house', file: 'building_house.png', pivot_y: 0.996, draw_w: 1, tint: null, debris_file: 'debris_house.png' },
    { art_id: 'house_b', file: 'building_house.png', pivot_y: 0.996, draw_w: 1, tint: '#ffc8a8', debris_file: null },
    { art_id: 'office', file: 'building_office.png', pivot_y: 0.995, draw_w: 1, tint: null, debris_file: 'debris_office.png' },
  ],
  buildings: [
    { building_id: 'b1', art_id: 'house' },
    { building_id: 'b2', art_id: 'house_b' },
    { building_id: 'b3', art_id: 'office' },
    { building_id: 'b4', art_id: null },
  ],
};
const all = new Set(neededEnvFiles(data));

describe('M6 건물 · 배경 그림 계획', () => {
  it('끔 = 전부 도형 (지금 화면) — 파일이 다 있어도', () => {
    const p = resolveEnvPlan(data, false, all);
    expect(p.on).toBe(false);
    expect(Object.values(p.buildings).every((b) => b === null)).toBe(true);
    expect([p.sky, p.strip, p.ring, p.dust]).toEqual([null, null, null, null]);
    expect(p.missing).toEqual([]);
  });

  it('켬 + 파일 다 있음 = building_id마다 그림 · 하늘 · 띠 · 링 · 먼지', () => {
    const p = resolveEnvPlan(data, true, all);
    expect(p.buildings.b1).toEqual({ artId: 'house', file: 'building_house.png', pivotY: 0.996, drawW: 1, tint: null, debris: 'debris_house.png', cutRoof: 0.35, floors: null, floorDebris: 'debris_house.png' }); // M8-D 층 파편 빈칸 = 건물 파편
    expect(p.buildings.b2).toMatchObject({ file: 'building_house.png', tint: 0xffc8a8, debris: 'debris.png' }); // 건물별 파편 빈칸 = 공용
    expect(p.buildings.b4).toBeNull(); // art_id 빈칸 = 도형
    expect(p.sky).toBe('sky.png');
    expect(p.strip).toEqual({ file: 'ground_strip.png', groundRatio: 0.24, burrowX: 0.887, popupY: null }); // 키 없음 = 일개미 줄 높이 (지금 자리)
    expect([p.ring, p.dust]).toEqual(['shock_ring.png', 'dust.png']);
    expect(p.missing).toEqual([]);
  });

  it('M8 쌓기 조각 3장 다 있으면 floors · 하나라도 없으면 null (자르기) · 자르기 비율', () => {
    const d: EnvData = { ...data, art: data.art.map((r) => (r.art_id === 'house' ? { ...r, cut_roof_ratio: 0.4, floor_base_file: 'house_floor_base.png', floor_mid_file: 'house_floor_mid.png', floor_roof_file: 'house_floor_roof.png' } : r)) };
    const files = new Set(neededEnvFiles(d));
    expect([...files]).toEqual(expect.arrayContaining(['house_floor_base.png', 'house_floor_mid.png', 'house_floor_roof.png']));
    expect(resolveEnvPlan(d, true, files).buildings.b1).toMatchObject({ cutRoof: 0.4, floors: { base: 'house_floor_base.png', mid: 'house_floor_mid.png', roof: 'house_floor_roof.png' } });
    const lack = new Set([...files].filter((f) => f !== 'house_floor_mid.png'));
    expect(resolveEnvPlan(d, true, lack).buildings.b1!.floors).toBeNull();
  });

  it('H-49 strip_popup_y 있으면 "+N" 높이 = 그 값 (그림 켬일 때만) · 끔이면 띠 계획 자체가 없음', () => {
    const d = { ...data, config: { ...data.config, strip_popup_y: 0.31 } };
    expect(resolveEnvPlan(d, true, all).strip?.popupY).toBe(0.31);
    expect(resolveEnvPlan(d, false, all).strip).toBeNull();
  });

  it('건물 그림 하나 없음 → 그 건물만 도형 · 나머지 그대로 · 없는 파일 이름 기록', () => {
    const files = new Set([...all].filter((f) => f !== 'building_office.png'));
    const p = resolveEnvPlan(data, true, files);
    expect(p.buildings.b3).toBeNull();
    expect(p.buildings.b1).not.toBeNull();
    expect(p.missing).toEqual(['building_office.png']);
  });

  it('하늘 · 띠 · 링 · 먼지 없음 → 각각 null (도형 하늘 · 도형 띠 · 연출 없음)', () => {
    const files = new Set([...all].filter((f) => !['sky.png', 'ground_strip.png', 'shock_ring.png', 'dust.png'].includes(f)));
    const p = resolveEnvPlan(data, true, files);
    expect([p.sky, p.strip, p.ring, p.dust]).toEqual([null, null, null, null]);
    expect(p.buildings.b1).not.toBeNull();
  });

  it('파편 = 건물별 → 공용 → 도형 (null)', () => {
    const noOwn = new Set([...all].filter((f) => f !== 'debris_house.png'));
    expect(resolveEnvPlan(data, true, noOwn).buildings.b1?.debris).toBe('debris.png');
    const none = new Set([...noOwn].filter((f) => f !== 'debris.png'));
    expect(resolveEnvPlan(data, true, none).buildings.b1?.debris).toBeNull();
  });

  it('M8-D 층 깨짐 파편 = floor_debris_file → 건물 파편 → 공용 → 도형 (null) · 읽을 파일에 들어감', () => {
    const d: EnvData = { ...data, art: data.art.map((r) => (r.art_id === 'house' ? { ...r, floor_debris_file: 'debris_house_wall.png' } : r)) };
    const files = new Set(neededEnvFiles(d));
    expect(files.has('debris_house_wall.png')).toBe(true);
    expect(resolveEnvPlan(d, true, files).buildings.b1).toMatchObject({ debris: 'debris_house.png', floorDebris: 'debris_house_wall.png' }); // 지붕 깨짐 = 건물 파편 그대로
    expect(resolveEnvPlan(d, true, files).buildings.b2).toMatchObject({ debris: 'debris.png', floorDebris: 'debris.png' }); // 빈칸 → 공용
    const noWall = new Set([...files].filter((f) => f !== 'debris_house_wall.png'));
    expect(resolveEnvPlan(d, true, noWall).buildings.b1).toMatchObject({ floorDebris: 'debris_house.png' }); // 파일 없음 → 건물 파편
    const none = new Set([...files].filter((f) => !f.startsWith('debris')));
    expect(resolveEnvPlan(d, true, none).buildings.b1).toMatchObject({ debris: null, floorDebris: null }); // 다 없음 → 도형
  });

  it('읽을 파일 = 쓰는 art_id만 · 중복 없음 · 빈칸 빼고', () => {
    const d = { ...data, buildings: data.buildings.filter((b) => b.building_id !== 'b3') };
    expect(neededEnvFiles(d)).toEqual(['sky.png', 'ground_strip.png', 'shock_ring.png', 'dust.png', 'debris.png', 'building_house.png', 'debris_house.png']);
  });

  it('tint = #rrggbb → 숫자 · 형식 틀림 · 빈칸 = null', () => {
    expect(hexTint('#b8c4ff')).toBe(0xb8c4ff);
    expect(hexTint('blue')).toBeNull();
    expect(hexTint(null)).toBeNull();
  });

  it('[ART] 기본값 = 시트 env_enabled · 저장값 bool이면 그것 · 틀린 형식은 기본값', () => {
    expect(defaultSettings().env).toBe(ENV_DATA.config.env_enabled);
    expect(sanitizeSettings({ env: !ENV_DATA.config.env_enabled }).env).toBe(!ENV_DATA.config.env_enabled);
    expect(sanitizeSettings({ env: 'yes' }).env).toBe(ENV_DATA.config.env_enabled);
  });

  it('지금 데이터: 건물 8행이 모두 그림을 가리키고 · 그림 파일이 빌드 목록에 있음', () => {
    const p = resolveEnvPlan(ENV_DATA, true, new Set(neededEnvFiles()));
    expect(Object.values(p.buildings).filter(Boolean)).toHaveLength(ENV_DATA.buildings.length);
    expect(p.buildings.bld_hospital?.tint).not.toBeNull(); // 7 · 8 = 색 바꿈
  });
});
