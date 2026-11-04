/**
 * InputRouter — 입력 판정을 한 곳에 모은다 (요청서 #1 §3). Phaser 의존 없음.
 *
 * 장면은 포인터 down / up만 넘기고, 여기서 나온 InputAction만 처리한다.
 * 새 입력(필살기 · 반격 등)은 이 파일에 규칙을 하나 추가하면 된다 — 장면 코드는 action 처리만 늘어남.
 *
 * 우선순위 (기획서 §6 땅속 띠 7):
 *   1. 버튼 (등록된 순서와 무관하게 priority 높은 것 먼저) — 버튼 위에서 시작한 입력은 버튼 것 ([굴] 버튼 = openNest)
 *   2. 구역 규칙
 *      - battle 모드: 전투 구역 down = 강점프 (즉시) / 띠에서 시작한 탭 · 아래 스와이프 = 개미굴 / HUD = 없음
 *      - nest 모드: 위로 스와이프 = 전투로 복귀 (전투 구역 탭은 받지 않음)
 */
import type { InputConfig } from './config';
import { classifyStripGesture, isSwipeUp } from './input';
import { type Layout, zoneAt } from './layout';

export type RouterMode = 'battle' | 'nest';

export type InputAction =
  | { type: 'strongJump' }
  | { type: 'challenge' }
  | { type: 'menu'; id: string }
  | { type: 'openNest'; via: 'tap' | 'swipe_down' | 'button' }
  | { type: 'closeNest'; via: 'button' | 'swipe_up' };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ButtonDef {
  id: string;
  rect: Rect;
  mode: RouterMode;
  action: InputAction;
  /** 숨김 · 비활성일 때 false → 아래 구역 규칙으로 넘어감 */
  enabled?: () => boolean;
  priority?: number;
}

export interface PointerSample {
  id: number;
  x: number;
  y: number;
  /** ms */
  t: number;
}

interface DownRecord {
  x: number;
  y: number;
  t: number;
  button: ButtonDef | null;
  /** 이 포인터가 어떤 제스처 후보인가 */
  gesture: 'strip' | 'nest' | null;
}

export const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export class InputRouter {
  mode: RouterMode = 'battle';
  private readonly buttons: ButtonDef[] = [];
  private readonly downs = new Map<number, DownRecord>();

  constructor(
    private readonly layout: Layout,
    private readonly cfg: InputConfig,
  ) {}

  addButton(def: ButtonDef): void {
    this.buttons.push(def);
    this.buttons.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  setMode(mode: RouterMode): void {
    this.mode = mode;
    this.downs.clear(); // 모드가 바뀌면 진행 중이던 제스처는 버린다
  }

  /** 지금 눌려 있는 버튼 id (눌림 표시용) */
  pressedButtonIds(): string[] {
    return [...this.downs.values()].flatMap((d) => (d.button ? [d.button.id] : []));
  }

  down(p: PointerSample): InputAction[] {
    const button = this.hitButton(p.x, p.y);
    const rec: DownRecord = { x: p.x, y: p.y, t: p.t, button, gesture: null };
    this.downs.set(p.id, rec);
    if (button) return [];

    if (this.mode === 'nest') {
      rec.gesture = 'nest';
      return [];
    }
    switch (zoneAt(this.layout, p.y)) {
      case 'battle':
        return [{ type: 'strongJump' }]; // 반응성을 위해 손가락이 닿는 순간 발동
      case 'strip':
        rec.gesture = 'strip';
        return [];
      default:
        return [];
    }
  }

  up(p: PointerSample): InputAction[] {
    const rec = this.downs.get(p.id);
    this.downs.delete(p.id);
    if (!rec) return [];

    if (rec.button) {
      // 버튼 위에서 떼야 실행, 그 사이 숨겨졌으면 무시
      const b = rec.button;
      if (b.mode === this.mode && (b.enabled?.() ?? true) && inRect(b.rect, p.x, p.y)) return [b.action];
      return [];
    }
    const trace = { startX: rec.x, startY: rec.y, endX: p.x, endY: p.y, durationMs: p.t - rec.t };
    if (rec.gesture === 'strip' && this.mode === 'battle') {
      const g = classifyStripGesture(this.layout, this.cfg, trace);
      if (g !== 'none') return [{ type: 'openNest', via: g }];
    }
    if (rec.gesture === 'nest' && this.mode === 'nest' && isSwipeUp(this.layout, this.cfg, trace)) {
      return [{ type: 'closeNest', via: 'swipe_up' }];
    }
    return [];
  }

  private hitButton(x: number, y: number): ButtonDef | null {
    for (const b of this.buttons) {
      if (b.mode !== this.mode) continue;
      if (!(b.enabled?.() ?? true)) continue;
      if (inRect(b.rect, x, y)) return b;
    }
    return null;
  }
}
