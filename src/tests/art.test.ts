import { describe, expect, it } from 'vitest';
import { ART_DATA, BODY_PARTS, defaultSettings, neededFiles, resolveArtPlan, sanitizeSettings, scaleRange, type ArtData } from '../view/artPlan';

/** M3 B — 폴백 · 장착 · 설정 정리 (docs/art.md §5 · docs/dev.md §7 M3 ④) */
const ALL = new Set(neededFiles());
const without = (...files: string[]) => new Set([...ALL].filter((f) => !files.includes(f)));

describe('M3 아트 계획 (폴백)', () => {
  it('파일이 다 있으면 그림 · 기본 장착 = 시트 (망치 · 드릴 · 철퇴 · 렌치)', () => {
    const plan = resolveArtPlan(ART_DATA, defaultSettings(), ALL);
    expect(plan.mode).toBe('image');
    expect(plan.reason).toBeNull();
    expect(plan.slots.map((w) => w?.weapon_id ?? null)).toEqual(['hammer', 'drill', 'mace', 'wrench']);
    expect(Object.keys(plan.parts).sort()).toEqual([...BODY_PARTS].sort());
  });

  it('art/game이 없으면 (지금) 도형 폴백 · 몸 파츠 6개 전부 없음', () => {
    const plan = resolveArtPlan(ART_DATA, defaultSettings(), new Set());
    expect(plan.mode).toBe('shape');
    expect(plan.reason).toBe('missing');
    expect(plan.missing).toHaveLength(BODY_PARTS.length);
  });

  it.each(BODY_PARTS)('몸 파츠 %s 하나만 빠져도 개미 전체가 도형', (part) => {
    const file = `ant_black_${part}.png`;
    const plan = resolveArtPlan(ART_DATA, defaultSettings(), without(file));
    expect(plan.mode).toBe('shape');
    expect(plan.missing).toEqual([file]);
  });

  it('무기 그림이 빠지면 그 슬롯만 맨주먹 · 나머지는 그림', () => {
    const plan = resolveArtPlan(ART_DATA, defaultSettings(), without('weapon_drill.png'));
    expect(plan.mode).toBe('image');
    expect(plan.slots.map((w) => w?.weapon_id ?? null)).toEqual(['hammer', null, 'mace', 'wrench']);
    expect(plan.missingWeapons).toEqual(['weapon_drill.png']);
  });

  it('그림 끔 → 도형 (= M2 화면) · 파일이 다 있어도', () => {
    const plan = resolveArtPlan(ART_DATA, { ...defaultSettings(), enabled: false }, ALL);
    expect(plan.mode).toBe('shape');
    expect(plan.reason).toBe('off');
  });

  it('시트 enabled FALSE면 기본이 도형', () => {
    const data: ArtData = { ...ART_DATA, config: { ...ART_DATA.config, enabled: false } };
    expect(resolveArtPlan(data, defaultSettings(data), ALL).mode).toBe('shape');
  });

  it('loadout 빈칸 = 맨주먹', () => {
    const data: ArtData = { ...ART_DATA, loadout: [{ slot: 1, weapon_id: null }, { slot: 2, weapon_id: 'club' }, { slot: 3, weapon_id: null }, { slot: 4, weapon_id: 'flail' }] };
    const plan = resolveArtPlan(data, defaultSettings(data), ALL);
    expect(plan.slots.map((w) => w?.weapon_id ?? null)).toEqual([null, 'club', null, 'flail']);
    expect(plan.missingWeapons).toEqual([]);
  });

  it('그리는 순서 = layer 오름차순 (다리 → 팔 3 · 4 → 팔 1 · 2 → 몸통 → 머리), 같으면 mount_id', () => {
    const plan = resolveArtPlan(ART_DATA, defaultSettings(), ALL);
    expect(plan.mounts.map((m) => m.mount_id)).toEqual(['leg_l', 'leg_r', 'arm_3', 'arm_4', 'arm_1', 'arm_2', 'body', 'head']);
  });
});

describe('M3 [ART] 설정 정리', () => {
  it('모르는 무기 · 범위 밖 배율 · 틀린 형식 → 시트 기본값 / 범위 끝', () => {
    const r = scaleRange(ART_DATA.config);
    const s = sanitizeSettings({ enabled: false, loadout: ['nope', null, 'club', 3], drawScale: 99, weaponScale: -1, showPivots: true });
    expect(s.enabled).toBe(false);
    expect(s.loadout).toEqual(['hammer', null, 'club', 'wrench']);
    expect(s.drawScale).toBe(r.draw[1]);
    expect(s.weaponScale).toBe(r.weapon[0]);
    expect(s.showPivots).toBe(true);
    expect(sanitizeSettings('garbage')).toEqual(defaultSettings());
    expect(sanitizeSettings({ loadout: ['club'] }).loadout).toEqual(defaultSettings().loadout);
  });

  it('배율 슬라이더 = 1 ~ 시트 상한 (그림만 키움 — H-12 Q1)', () => {
    expect(scaleRange(ART_DATA.config)).toEqual({ draw: [1, ART_DATA.config.draw_scale_max], weapon: [1, ART_DATA.config.weapon_scale_max] });
  });
});
