/**
 * M2 타격 연출 설정 — 값은 src/data/fx_config.json (design/tables/fx.xlsx), 켜고 끄기는 [FX] 패널.
 * 끈 연출은 M1 모습 그대로 (H-10 ③ · ④-3).
 */
import fx_config from '../data/fx_config.json';

export type FxConfig = typeof fx_config;
export const FX: FxConfig = fx_config;

export const FX_TOGGLES = [
  { id: 'hitstop', label: 'A 히트스톱' },
  { id: 'flash', label: 'B 건물 번쩍' },
  { id: 'shake', label: 'C 화면 흔들림' },
  { id: 'combo', label: 'D 연타 카운트' },
  { id: 'punch', label: 'E 펀치 과장' },
  { id: 'hitDebris', label: 'F 타격 파편' },
  { id: 'sfx', label: 'G 효과음' },
  { id: 'contrast', label: '"와르르!" 대비' },
  { id: 'motion', label: 'M3-C 모션 (공격 · 점프)' },
] as const;

export type FxToggleId = (typeof FX_TOGGLES)[number]['id'];
export type FxToggles = Record<FxToggleId, boolean>;

const STORE_KEY = 'crumble-ant.fx-toggles';

export function allToggles(on: boolean): FxToggles {
  return Object.fromEntries(FX_TOGGLES.map((t) => [t.id, on])) as FxToggles;
}

/** 브라우저에 기억한 값 (없거나 못 읽으면 기본 = 전부 켬) */
export function loadToggles(): FxToggles {
  const base = allToggles(true);
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<FxToggles>;
    for (const t of FX_TOGGLES) if (typeof saved[t.id] === 'boolean') base[t.id] = saved[t.id]!;
  } catch {
    /* 저장소를 못 쓰는 환경 — 기본값 */
  }
  return base;
}

export function saveToggles(t: FxToggles): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(t));
  } catch {
    /* 무시 — 다음에 기본값 */
  }
}
