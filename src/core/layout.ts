/**
 * 화면 구역 계산 (Safe Area = 게임 프레임 높이 기준 비율).
 *   HUD ~6% / 전투 ~84% / 땅속 띠 + 하단 메뉴 겹침 10%
 * Unity 이식 시 Screen.safeArea 높이를 frameHeight로 넣으면 같은 결과.
 */
import type { LayoutConfig } from './config';

export interface Band {
  top: number;
  height: number;
  bottom: number;
}

export interface Layout {
  width: number;
  height: number;
  hud: Band;
  battle: Band;
  /** 땅속 띠 (하단 메뉴가 이 위에 겹침) */
  strip: Band;
  /** 지면 = 전투 구역 바닥 = 띠 윗선 */
  groundY: number;
}

export type Zone = 'hud' | 'battle' | 'strip' | 'outside';

function band(top: number, height: number): Band {
  return { top, height, bottom: top + height };
}

export function frameHeightForWidth(cfg: LayoutConfig, width: number): number {
  return Math.round((width * cfg.frame_aspect_h) / cfg.frame_aspect_w);
}

export function computeLayout(cfg: LayoutConfig, width: number, height: number): Layout {
  const hudH = height * cfg.hud_ratio;
  const battleH = height * cfg.battle_ratio;
  const stripH = height - hudH - battleH; // 반올림 오차는 띠가 흡수
  const hud = band(0, hudH);
  const battle = band(hud.bottom, battleH);
  const strip = band(battle.bottom, stripH);
  return { width, height, hud, battle, strip, groundY: battle.bottom };
}

export function zoneAt(layout: Layout, y: number): Zone {
  if (y < 0 || y > layout.height) return 'outside';
  if (y < layout.hud.bottom) return 'hud';
  if (y < layout.battle.bottom) return 'battle';
  return 'strip';
}

/** 전투 좌표 (y: 0 지면 ~ 1 전투 구역 맨 위) → 화면 px */
export function battleToScreenY(layout: Layout, y: number): number {
  return layout.battle.bottom - y * layout.battle.height;
}

/** 개미굴 화면의 [▲ 전투로] 버튼 위치 (그리기 · 입력 판정이 같은 값을 쓴다) */
export function nestBackButtonRect(layout: Layout): { x: number; y: number; w: number; h: number } {
  const w = layout.width * 0.5;
  const h = layout.hud.height * 0.9;
  const cy = layout.hud.height * 0.9;
  return { x: layout.width / 2 - w / 2, y: cy - h / 2, w, h };
}
