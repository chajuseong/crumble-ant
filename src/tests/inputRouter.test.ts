import { describe, expect, it } from 'vitest';
import { InputRouter } from '../core/inputRouter';
import { computeLayout, nestBackButtonRect } from '../core/layout';
import { makeConfig } from './helpers';

const c = makeConfig();
const L = computeLayout(c.layout, 1080, 2340);
const stripY = L.strip.top + L.strip.height / 2;
const menu = { x: 30, y: L.strip.top + 40, w: 180, h: 150 };
const challenge = { x: 700, y: L.battle.top + 100, w: 340, h: 160 };

function make(challengeOn = false) {
  const r = new InputRouter(L, c.input);
  r.addButton({ id: 'menu:강화', rect: menu, mode: 'battle', action: { type: 'menu', id: '강화' }, priority: 10 });
  r.addButton({ id: 'challenge', rect: challenge, mode: 'battle', action: { type: 'challenge' }, enabled: () => challengeOn, priority: 20 });
  r.addButton({ id: 'nestBack', rect: nestBackButtonRect(L), mode: 'nest', action: { type: 'closeNest', via: 'button' } });
  return r;
}
const tap = (r: InputRouter, x: number, y: number, id = 1) => [...r.down({ id, x, y, t: 0 }), ...r.up({ id, x, y, t: 100 })];

describe('InputRouter — battle 모드', () => {
  it('전투 구역 탭 → 강점프 (손가락이 닿는 순간)', () => {
    const r = make();
    expect(r.down({ id: 1, x: 540, y: 1200, t: 0 })).toEqual([{ type: 'strongJump' }]);
    expect(r.up({ id: 1, x: 540, y: 1200, t: 80 })).toEqual([]);
  });

  it('HUD 탭 → 아무것도 안 함', () => {
    expect(tap(make(), 540, 20)).toEqual([]);
  });

  it('띠 빈 영역 탭 → 개미굴', () => {
    expect(tap(make(), 800, stripY)).toEqual([{ type: 'openNest', via: 'tap' }]);
  });

  it('띠에서 아래로 스와이프 → 개미굴', () => {
    const r = make();
    r.down({ id: 1, x: 800, y: L.strip.top + 10, t: 0 });
    expect(r.up({ id: 1, x: 805, y: L.strip.top + 150, t: 200 })).toEqual([{ type: 'openNest', via: 'swipe_down' }]);
  });

  it('메뉴 버튼이 띠 빈 영역보다 우선', () => {
    expect(tap(make(), menu.x + 10, menu.y + 10)).toEqual([{ type: 'menu', id: '강화' }]);
  });

  it('[굴] 메뉴 버튼 → 개미굴 (H-01 #9 · 기획서 v0.4 §6)', () => {
    const r = make();
    const nestBtn = { x: 420, y: L.strip.top + 40, w: 180, h: 150 };
    r.addButton({ id: 'menu:굴', rect: nestBtn, mode: 'battle', action: { type: 'openNest', via: 'button' }, priority: 10 });
    expect(tap(r, nestBtn.x + 20, nestBtn.y + 20)).toEqual([{ type: 'openNest', via: 'button' }]);
  });

  it('버튼에서 누르고 밖에서 떼면 취소', () => {
    const r = make();
    r.down({ id: 1, x: menu.x + 10, y: menu.y + 10, t: 0 });
    expect(r.up({ id: 1, x: 900, y: stripY, t: 100 })).toEqual([]);
  });

  it('[도전] 버튼이 보일 때: 전투 구역 위에 있어도 강점프가 아니라 도전', () => {
    const r = make(true);
    expect(r.down({ id: 1, x: challenge.x + 20, y: challenge.y + 20, t: 0 })).toEqual([]);
    expect(r.up({ id: 1, x: challenge.x + 20, y: challenge.y + 20, t: 50 })).toEqual([{ type: 'challenge' }]);
  });

  it('[도전] 버튼이 숨겨져 있으면 그 자리 탭 = 강점프', () => {
    expect(make(false).down({ id: 1, x: challenge.x + 20, y: challenge.y + 20, t: 0 })).toEqual([{ type: 'strongJump' }]);
  });

  it('전투 구역에서 시작한 아래 스와이프는 개미굴로 가지 않는다', () => {
    const r = make();
    r.down({ id: 1, x: 540, y: L.battle.bottom - 50, t: 0 });
    expect(r.up({ id: 1, x: 540, y: L.battle.bottom + 150, t: 200 })).toEqual([]);
  });

  it('멀티터치: 포인터마다 따로 판정', () => {
    const r = make();
    expect(r.down({ id: 1, x: 540, y: 1200, t: 0 })).toEqual([{ type: 'strongJump' }]);
    r.down({ id: 2, x: 800, y: stripY, t: 10 });
    expect(r.up({ id: 2, x: 800, y: stripY, t: 90 })).toEqual([{ type: 'openNest', via: 'tap' }]);
  });
});

describe('InputRouter — nest 모드', () => {
  it('개미굴에서는 전투 탭 · 메뉴를 받지 않는다', () => {
    const r = make();
    r.setMode('nest');
    expect(tap(r, 540, 1200)).toEqual([]);
    expect(tap(r, menu.x + 10, menu.y + 10)).toEqual([]);
  });

  it('[▲ 전투로] 버튼 → 복귀', () => {
    const r = make();
    r.setMode('nest');
    const b = nestBackButtonRect(L);
    expect(tap(r, b.x + b.w / 2, b.y + b.h / 2)).toEqual([{ type: 'closeNest', via: 'button' }]);
  });

  it('위로 스와이프 → 복귀', () => {
    const r = make();
    r.setMode('nest');
    r.down({ id: 1, x: 540, y: 1600, t: 0 });
    expect(r.up({ id: 1, x: 545, y: 1300, t: 200 })).toEqual([{ type: 'closeNest', via: 'swipe_up' }]);
  });
});

describe('M4 upgrade 모드 (강화 패널)', () => {
  it('패널 버튼만 받고 · 바깥 탭 = 닫기 · 전투 구역을 눌러도 강점프 안 됨', () => {
    const cfg = makeConfig();
    const L = computeLayout(cfg.layout, cfg.layout.frame_width, cfg.layout.frame_height);
    const r = new InputRouter(L, cfg.input);
    r.addButton({ id: 'buy:attack_power', rect: { x: 100, y: 1000, w: 200, h: 80 }, mode: 'upgrade', action: { type: 'buyUpgrade', id: 'attack_power' } });
    r.setMode('upgrade');
    const y = L.battle.top + L.battle.height * 0.3;
    expect(r.down({ id: 1, x: 360, y, t: 0 })).toEqual([]);
    expect(r.up({ id: 1, x: 360, y, t: 50 })).toEqual([{ type: 'closeUpgrade', via: 'outside' }]);
    expect(r.down({ id: 2, x: 150, y: 1030, t: 100 })).toEqual([]);
    expect(r.up({ id: 2, x: 150, y: 1030, t: 150 })).toEqual([{ type: 'buyUpgrade', id: 'attack_power' }]);
  });
});
