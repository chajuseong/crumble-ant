/**
 * M6 건물 · 배경 · 파괴 이펙트 그림 — 무엇을 그릴지 정하는 순수 함수 (Phaser 없음 · 테스트 대상 · H-42).
 * 데이터 = buildings.art_id → building_art · art_config env_* (docs/art.md §7)
 * 폴백: 끔 → 전부 지금 도형 · 건물 그림 없음 / art_id 빈칸 → 그 건물만 도형 · 하늘 · 띠 없음 → 각각 도형
 *       링 · 먼지 없음 → 그 연출 없음 · 파편 = 건물별 → 공용 → 도형 조각
 * core는 건물 밑면 y만 씀 → 그림 크기 · 모양은 결과에 영향 없음 (view만)
 */
import art_config from '../data/art_config.json';
import building_art from '../data/building_art.json';
import buildings from '../data/buildings.json';

export interface EnvConfig {
  env_enabled: boolean;
  sky_file: string | null;
  strip_file: string | null;
  strip_ground_ratio: number;
  strip_burrow_x: number;
  /** H-49 그림 켬일 때 "+N" 높이 = 굴 입구 가운데 ÷ 띠 그림 높이 (없으면 일개미 줄 높이 — 지금 자리) */
  strip_popup_y?: number | null;
  ring_file: string | null;
  dust_file: string | null;
  debris_file: string | null;
}
export interface BuildingArtRow {
  art_id: string;
  file: string;
  pivot_y: number;
  draw_w: number;
  tint: string | null;
  debris_file: string | null;
  /** M8 자르기 지붕 칸 비율 · 쌓기 조각 (3칸 다 있을 때만) */
  cut_roof_ratio?: number;
  floor_base_file?: string | null;
  floor_mid_file?: string | null;
  floor_roof_file?: string | null;
}
export interface EnvData {
  config: EnvConfig;
  art: BuildingArtRow[];
  buildings: { building_id: string; art_id: string | null }[];
}

export const ENV_DATA: EnvData = { config: art_config as unknown as EnvConfig, art: building_art as BuildingArtRow[], buildings };

/** 건물 한 종류의 그림 (없으면 null = 도형) */
export interface BuildingArtPlan {
  artId: string;
  file: string;
  pivotY: number;
  drawW: number;
  /** 곱하기 색 (0xrrggbb) · null = 그대로 */
  tint: number | null;
  /** 파편 그림 (건물별 → 공용) · null = 도형 조각 */
  debris: string | null;
  /** M8 자르기 지붕 칸 비율 (층 2개 이상일 때) */
  cutRoof: number;
  /** M8 쌓기 조각 (3장 다 읽었을 때만 — 아니면 null = 자르기) */
  floors: { base: string; mid: string; roof: string } | null;
}

export interface EnvPlan {
  on: boolean;
  /** building_id → 그림 (null = 도형) */
  buildings: Record<string, BuildingArtPlan | null>;
  sky: string | null;
  strip: { file: string; groundRatio: number; burrowX: number; popupY: number | null } | null;
  ring: string | null;
  dust: string | null;
  /** 시트에는 있는데 못 읽은 파일 (켬일 때만) */
  missing: string[];
}

export const hexTint = (s: string | null): number | null => (s && /^#[0-9a-fA-F]{6}$/.test(s) ? parseInt(s.slice(1), 16) : null);

/** 이 데이터가 가리키는 그림 파일 전부 (켤 때 읽음 — 중복 없이 · 시트 순서) */
export function neededEnvFiles(data: EnvData = ENV_DATA): string[] {
  const c = data.config;
  const used = new Set(data.buildings.map((b) => b.art_id).filter((x): x is string => !!x));
  const files = [c.sky_file, c.strip_file, c.ring_file, c.dust_file, c.debris_file];
  for (const r of data.art) if (used.has(r.art_id)) files.push(r.file, r.debris_file, r.floor_base_file ?? null, r.floor_mid_file ?? null, r.floor_roof_file ?? null);
  const out: string[] = [];
  for (const f of files) if (f && !out.includes(f)) out.push(f);
  return out;
}

/** on = [ART] "건물 · 배경 그림" (기본 = 시트 env_enabled) · available = 실제로 텍스처가 올라간 파일 */
export function resolveEnvPlan(data: EnvData, on: boolean, available: ReadonlySet<string>): EnvPlan {
  const c = data.config;
  const off: EnvPlan = { on: false, buildings: {}, sky: null, strip: null, ring: null, dust: null, missing: [] };
  for (const b of data.buildings) off.buildings[b.building_id] = null;
  if (!on) return off;
  const missing: string[] = [];
  const pick = (f: string | null): string | null => {
    if (!f) return null;
    if (available.has(f)) return f;
    if (!missing.includes(f)) missing.push(f);
    return null;
  };
  const common = pick(c.debris_file);
  const plan: EnvPlan = { ...off, on: true, buildings: {}, missing };
  for (const b of data.buildings) {
    const row = b.art_id ? data.art.find((r) => r.art_id === b.art_id) : undefined;
    const file = row ? pick(row.file) : null;
    // M8 쌓기 = 조각 3장 다 있을 때만 (하나라도 없으면 자르기)
    const fb = row ? pick(row.floor_base_file ?? null) : null;
    const fm = row ? pick(row.floor_mid_file ?? null) : null;
    const fr = row ? pick(row.floor_roof_file ?? null) : null;
    plan.buildings[b.building_id] =
      row && file
        ? { artId: row.art_id, file, pivotY: row.pivot_y, drawW: row.draw_w, tint: hexTint(row.tint), debris: pick(row.debris_file) ?? common, cutRoof: row.cut_roof_ratio ?? 0.35, floors: fb && fm && fr ? { base: fb, mid: fm, roof: fr } : null }
        : null;
  }
  plan.sky = pick(c.sky_file);
  const strip = pick(c.strip_file);
  plan.strip = strip ? { file: strip, groundRatio: c.strip_ground_ratio, burrowX: c.strip_burrow_x, popupY: c.strip_popup_y ?? null } : null;
  plan.ring = pick(c.ring_file);
  plan.dust = pick(c.dust_file);
  return plan;
}

export function envStatusText(p: EnvPlan): string {
  if (!p.on) return '건물 · 배경: 도형 (끔)';
  const n = Object.values(p.buildings).filter(Boolean).length;
  const all = Object.keys(p.buildings).length;
  return `건물 · 배경: 그림 (건물 ${n}/${all}${p.sky ? ' · 하늘' : ''}${p.strip ? ' · 띠' : ''})${p.missing.length ? ` · 없음 ${p.missing.length}` : ''}`;
}
