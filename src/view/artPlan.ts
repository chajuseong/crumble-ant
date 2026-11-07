/**
 * M3 아트 적용 — 무엇을 어떻게 그릴지 정하는 순수 함수 (Phaser 없음 · 테스트 대상).
 * 데이터 = src/data/art_config · ant_parts · ant_mounts · weapons · ant_loadout (design/tables/art.xlsx — docs/art.md §4)
 * 폴백 (docs/art.md §5): 몸 파츠 하나라도 없음 → 개미 전체 도형 · 무기 그림 없음 → 그 슬롯만 맨주먹 · 그림 끔 → 도형 (= M2 화면)
 */
import art_config from '../data/art_config.json';
import ant_parts from '../data/ant_parts.json';
import ant_mounts from '../data/ant_mounts.json';
import weapons from '../data/weapons.json';
import ant_loadout from '../data/ant_loadout.json';

export interface ArtConfig {
  skin_id: string;
  enabled: boolean;
  draw_scale: number;
  draw_scale_max: number;
  weapon_scale: number;
  weapon_scale_max: number;
  hit_face_ms: number;
  /** 머리만 따로 배율 (M3-C A — 표정 가독성, H-22). 없으면 1 */
  head_scale?: number;
  /** M3-D 충격 별 그림 (art/game/fx/) — null이면 도형 별 */
  impact_file?: string | null;
  /** M6 건물 · 배경 · 파괴 그림 기본값 (H-42 — [ART]에서 바꿈) */
  env_enabled?: boolean;
}
export interface ArtPart {
  skin_id: string;
  part_id: string;
  file: string;
  pivot_x: number;
  pivot_y: number;
  socket_x: number | null;
  socket_y: number | null;
  draw_h: number;
}
export interface ArtMount {
  mount_id: string;
  part_id: string;
  anchor_x: number;
  anchor_y: number;
  angle_deg: number;
  layer: number;
  mirror: boolean;
}
export interface ArtWeapon {
  weapon_id: string;
  name: string;
  file: string;
  grip_x: number;
  grip_y: number;
  scale: number;
  angle_deg: number;
}
export interface ArtLoadoutRow {
  slot: number;
  weapon_id: string | null;
}
export interface ArtData {
  config: ArtConfig;
  parts: ArtPart[];
  mounts: ArtMount[];
  weapons: ArtWeapon[];
  loadout: ArtLoadoutRow[];
}

export const ART_DATA: ArtData = { config: art_config, parts: ant_parts, mounts: ant_mounts, weapons, loadout: ant_loadout } as ArtData;

/** 몸 파츠 — 하나라도 없으면 개미 전체를 도형으로 (docs/art.md §5) */
export const BODY_PARTS = ['body', 'head_normal', 'head_hit', 'head_down', 'arm', 'leg'] as const;
export type BodyPartId = (typeof BODY_PARTS)[number];
export type Face = 'normal' | 'hit' | 'down';
export const SLOTS = 4;

/** [ART] 패널에서 바꾸는 값 (테스트 빌드 확인용 — 그 브라우저에만 기억) */
export interface ArtSettings {
  enabled: boolean;
  /** 팔 슬롯 1 ~ 4 → weapon_id (null = 맨주먹) */
  loadout: (string | null)[];
  drawScale: number;
  weaponScale: number;
  showPivots: boolean;
  /** M6 건물 · 배경 · 파괴 그림 (기본 = 시트 env_enabled) */
  env: boolean;
}

export interface ArtPlan {
  mode: 'image' | 'shape';
  /** shape인 까닭: off = 그림 끔 · missing = 몸 파츠 파일 없음 */
  reason: 'off' | 'missing' | null;
  /** 없는 몸 파츠 파일 이름 */
  missing: string[];
  /** 그림 없어서 맨주먹이 된 무기 파일 이름 */
  missingWeapons: string[];
  parts: Partial<Record<BodyPartId, ArtPart>>;
  /** 그리는 순서 — layer 오름차순, 같으면 mount_id (객체 키 순서에 기대지 않음) */
  mounts: ArtMount[];
  /** 슬롯 1 ~ 4의 무기 (null = 맨주먹) */
  slots: (ArtWeapon | null)[];
  drawScale: number;
  weaponScale: number;
  headScale: number;
  showPivots: boolean;
}

/** 그림 파일 이름 규칙 (docs/art.md §3) */
export const partFileName = (skin: string, part: string): string => `ant_${skin}_${part}.png`;

/** 팔 마운트 id → 슬롯 번호 (arm_1 → 1). 팔이 아니면 null */
export function armSlotOf(mountId: string): number | null {
  const m = /^arm_(\d+)$/.exec(mountId);
  return m ? Number(m[1]) : null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 배율 슬라이더 범위 — 1(원래 크기) ~ 시트 상한. 시트 기본값이 1보다 작으면 그 값부터 (H-12 Q1 "그림만 키움") */
export function scaleRange(cfg: ArtConfig): { draw: [number, number]; weapon: [number, number] } {
  return {
    draw: [Math.min(1, cfg.draw_scale), cfg.draw_scale_max],
    weapon: [Math.min(1, cfg.weapon_scale), cfg.weapon_scale_max],
  };
}

export function defaultSettings(data: ArtData = ART_DATA): ArtSettings {
  const loadout: (string | null)[] = Array.from({ length: SLOTS }, () => null);
  for (const r of data.loadout) if (r.slot >= 1 && r.slot <= SLOTS) loadout[r.slot - 1] = r.weapon_id ?? null;
  return { enabled: data.config.enabled, loadout, drawScale: data.config.draw_scale, weaponScale: data.config.weapon_scale, showPivots: false, env: data.config.env_enabled ?? false };
}

/** 저장해 둔 값 정리 — 모르는 무기 · 범위 밖 배율 · 틀린 형식은 시트 기본값으로 */
export function sanitizeSettings(raw: unknown, data: ArtData = ART_DATA): ArtSettings {
  const base = defaultSettings(data);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const range = scaleRange(data.config);
  const ids = new Set(data.weapons.map((w) => w.weapon_id));
  if (typeof r.enabled === 'boolean') base.enabled = r.enabled;
  if (typeof r.showPivots === 'boolean') base.showPivots = r.showPivots;
  if (typeof r.env === 'boolean') base.env = r.env;
  if (typeof r.drawScale === 'number' && Number.isFinite(r.drawScale)) base.drawScale = clamp(r.drawScale, ...range.draw);
  if (typeof r.weaponScale === 'number' && Number.isFinite(r.weaponScale)) base.weaponScale = clamp(r.weaponScale, ...range.weapon);
  if (Array.isArray(r.loadout) && r.loadout.length === SLOTS) {
    r.loadout.forEach((w, i) => {
      if (w === null) base.loadout[i] = null;
      else if (typeof w === 'string' && ids.has(w)) base.loadout[i] = w;
    });
  }
  return base;
}

/**
 * 그릴 계획. available = 실제로 읽힌 그림 파일 이름 (art/game에 있고 텍스처로 올라간 것)
 */
export function resolveArtPlan(data: ArtData, settings: ArtSettings, available: ReadonlySet<string>): ArtPlan {
  const skin = data.config.skin_id;
  const parts: Partial<Record<BodyPartId, ArtPart>> = {};
  const missing: string[] = [];
  for (const id of BODY_PARTS) {
    const row = data.parts.find((p) => p.skin_id === skin && p.part_id === id);
    const file = row?.file ?? partFileName(skin, id);
    if (row && available.has(row.file)) parts[id] = row;
    else missing.push(file);
  }
  const missingWeapons: string[] = [];
  const slots = settings.loadout.slice(0, SLOTS).map((id) => {
    if (id === null) return null;
    const w = data.weapons.find((x) => x.weapon_id === id);
    if (!w) return null;
    if (!available.has(w.file)) {
      missingWeapons.push(w.file);
      return null;
    }
    return w;
  });
  while (slots.length < SLOTS) slots.push(null);
  const mounts = [...data.mounts].sort((a, b) => a.layer - b.layer || (a.mount_id < b.mount_id ? -1 : a.mount_id > b.mount_id ? 1 : 0));
  const mode = settings.enabled && missing.length === 0 ? 'image' : 'shape';
  return {
    mode,
    reason: mode === 'image' ? null : settings.enabled ? 'missing' : 'off',
    missing,
    missingWeapons,
    parts,
    mounts,
    slots,
    drawScale: settings.drawScale,
    weaponScale: settings.weaponScale,
    headScale: data.config.head_scale ?? 1,
    showPivots: settings.showPivots,
  };
}

/** 이 스킨 · 무기 목록에서 불러올 그림 파일 이름 전부 */
export function neededFiles(data: ArtData = ART_DATA): string[] {
  const skin = data.config.skin_id;
  return [...data.parts.filter((p) => p.skin_id === skin).map((p) => p.file), ...data.weapons.map((w) => w.file)];
}

const STORE_KEY = 'crumble-ant.art-settings';

export function loadArtSettings(data: ArtData = ART_DATA): ArtSettings {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return sanitizeSettings(raw ? JSON.parse(raw) : null, data);
  } catch {
    return defaultSettings(data); // 저장소를 못 쓰는 환경 — 시트 기본값
  }
}

export function saveArtSettings(s: ArtSettings): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* 무시 — 다음에 기본값 */
  }
}

export function clearArtSettings(): void {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* 무시 */
  }
}
