import Phaser from 'phaser';
import type { BattleSim } from '../core/battle';
import type { UpgradeRow } from '../core/config';
import { buyCheck, deriveStats, levelPct } from '../core/economy';
import type { InputRouter } from '../core/inputRouter';
import type { Layout } from '../core/layout';
import { COLOR, FONT } from './theme';
import { t } from './text';

/**
 * M4 강화 패널 (I-12 · H-17 ④) — core 값을 읽기만 함 (효과 · 비용 · 가능 여부 = core/economy.ts).
 * 화면 아래쪽 (전투 구역 아래 약 55% + 띠 위) · 전투는 뒤에서 계속 · InputRouter upgrade 모드 (패널 버튼만 · 바깥 탭 = 닫기)
 * 흐름: [강화] → 열림 → 카드 [비용] → ok = 구매 · 카드 튐 / short = 버튼 흔들림 + 안내 / max = 반응 없음 → [✕] · 바깥 탭 → 닫힘
 */
const PANEL_H_RATIO = 0.55; // 전투 구역 높이 대비 (모양 상수 — 계획 ④-1)
const VISIBLE_ROWS = 5; // M7-E 한 번에 보이는 카드 수 — 넘으면 목록 스크롤 (H-69 · 4줄이면 지금 그대로)
const DRAG_SLOP_PX = 12; // 이만큼 움직이면 스크롤 (그 손가락으로는 구매 안 함)

interface Card {
  row: UpgradeRow;
  root: Phaser.GameObjects.Container;
  name: Phaser.GameObjects.Text;
  level: Phaser.GameObjects.Text;
  effect: Phaser.GameObjects.Text;
  btn: Phaser.GameObjects.Rectangle;
  cost: Phaser.GameObjects.Text;
  btnX: number;
}

export class UpgradePanel {
  readonly root: Phaser.GameObjects.Container;
  private readonly cards: Card[] = [];
  private readonly debris: Phaser.GameObjects.Text;
  private readonly resetText: Phaser.GameObjects.Text;
  private resetArmedUntil = 0;
  private openFlag = false;
  private readonly top: number;
  // ── M7-E 목록 스크롤 (카드가 VISIBLE_ROWS보다 많을 때만) ──
  private readonly list: Phaser.GameObjects.Container;
  private readonly rects: { y0: number; rect: { y: number } }[] = [];
  private scroll = 0;
  private maxScroll = 0;
  private drag: { y: number; scroll: number } | null = null;
  private dragged = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sim: BattleSim,
    L: Layout,
    px: (n: number) => number,
    router: InputRouter,
    depth: number,
  ) {
    const x = px(30);
    const w = L.width - px(60);
    const bottom = L.strip.top - px(16);
    const h = L.battle.height * PANEL_H_RATIO;
    this.top = bottom - h;
    this.root = scene.add.container(0, 0).setDepth(depth).setVisible(false);
    const bg = scene.add.rectangle(x, this.top, w, h, COLOR.hudBg, 0.96).setOrigin(0).setStrokeStyle(px(4), 0xffffff, 0.35);
    this.root.add(bg);
    router.addBlocker('upgrade', { x, y: this.top, w, h }); // CA-003: 패널 안 빈 곳 탭 = 무시 (바깥만 닫기)
    const headH = h * 0.13;
    const footH = h * 0.1;
    const font = (size: number, color: string = COLOR.hudText) => ({ fontFamily: FONT, fontSize: `${Math.round(size)}px`, color, fontStyle: '900' as const });
    this.root.add(scene.add.text(x + px(28), this.top + headH / 2, t('upgrade.title'), font(headH * 0.48)).setOrigin(0, 0.5));
    this.debris = scene.add.text(x + w * 0.42, this.top + headH / 2, '', font(headH * 0.38, COLOR.popup)).setOrigin(0, 0.5);
    this.root.add(this.debris);
    const closeW = headH * 1.1;
    const closeX = x + w - closeW / 2 - px(14);
    this.root.add(scene.add.text(closeX, this.top + headH / 2, t('upgrade.close'), font(headH * 0.5)).setOrigin(0.5));
    router.addButton({ id: 'upgrade:close', rect: { x: closeX - closeW / 2, y: this.top, w: closeW, h: headH }, mode: 'upgrade', action: { type: 'closeUpgrade', via: 'button' }, enabled: () => this.openFlag, priority: 30 });

    const rows = sim.cfg.upgrades.rows;
    const gap = px(14);
    const cardsH = h - headH - footH;
    const shown = Math.max(1, Math.min(rows.length, VISIBLE_ROWS));
    const cardH = (cardsH - gap * (shown + 1)) / shown;
    const listTop = this.top + headH;
    this.list = scene.add.container(0, 0);
    this.root.add(this.list);
    this.maxScroll = Math.max(0, rows.length * (cardH + gap) + gap - cardsH);
    if (this.maxScroll > 0) {
      // 목록 = 머리 · 발 사이만 보이게 (마스크) · 끌기 · 휠로 스크롤
      const maskG = scene.make.graphics({}, false).fillRect(x, listTop, w, cardsH);
      this.list.setMask(maskG.createGeometryMask());
      const inList = (p: Phaser.Input.Pointer) => this.openFlag && p.x >= x && p.x <= x + w && p.y >= listTop && p.y <= listTop + cardsH;
      scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        this.dragged = false;
        this.drag = inList(p) ? { y: p.y, scroll: this.scroll } : null;
      });
      scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!this.drag || !p.isDown) return;
        if (Math.abs(p.y - this.drag.y) > px(DRAG_SLOP_PX)) this.dragged = true;
        if (this.dragged) this.setScroll(this.drag.scroll - (p.y - this.drag.y));
      });
      scene.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        if (inList(p)) this.setScroll(this.scroll + dy);
      });
    }
    rows.forEach((row, i) => {
      const cy = this.top + headH + gap + i * (cardH + gap);
      const root = scene.add.container(0, 0);
      root.add(scene.add.rectangle(x + gap, cy, w - gap * 2, cardH, 0xffffff, 0.06).setOrigin(0).setStrokeStyle(px(2), 0xffffff, 0.15));
      const name = scene.add.text(x + gap * 2.2, cy + cardH * 0.3, row.name, font(cardH * 0.3)).setOrigin(0, 0.5);
      const level = scene.add.text(x + gap * 2.2 + w * 0.3, cy + cardH * 0.3, '', font(cardH * 0.22, COLOR.autoOn)).setOrigin(0, 0.5);
      const effect = scene.add.text(x + gap * 2.2, cy + cardH * 0.72, '', font(cardH * 0.22, '#d9d2c5')).setOrigin(0, 0.5);
      const bw = w * 0.28;
      const bh = cardH * 0.62;
      const btnX = x + w - gap * 2 - bw / 2;
      const btn = scene.add.rectangle(btnX, cy + cardH / 2, bw, bh, COLOR.challenge).setStrokeStyle(px(3), 0xffffff, 0.6);
      const cost = scene.add.text(btnX, cy + cardH / 2, '', font(bh * 0.42, COLOR.challengeText)).setOrigin(0.5);
      root.add([name, level, effect, btn, cost]);
      this.list.add(root);
      this.cards.push({ row, root, name, level, effect, btn, cost, btnX });
      const rect = { x: btnX - bw / 2, y: cy + (cardH - bh) / 2, w: bw, h: bh };
      this.rects.push({ y0: rect.y, rect });
      // 스크롤로 가려진 버튼 · 끌던 손가락 = 구매 안 함
      const visible = () => rect.y >= listTop - 1 && rect.y + bh <= listTop + cardsH + 1;
      router.addButton({ id: `upgrade:${row.upgrade_id}`, rect, mode: 'upgrade', action: { type: 'buyUpgrade', id: row.upgrade_id }, enabled: () => this.openFlag && !this.dragged && visible(), priority: 30 });
    });
    const footY = this.top + h - footH / 2;
    this.resetText = scene.add.text(x + w / 2, footY, '', font(footH * 0.34, '#9a8f80')).setOrigin(0.5);
    this.root.add(this.resetText);
    router.addButton({ id: 'upgrade:reset', rect: { x: x + w * 0.3, y: footY - footH / 2, w: w * 0.4, h: footH }, mode: 'upgrade', action: { type: 'resetSave' }, enabled: () => this.openFlag, priority: 30 });
  }

  /** M7-E 목록 스크롤 — 카드 · 버튼 자리를 같이 옮김 */
  private setScroll(v: number): void {
    this.scroll = Phaser.Math.Clamp(v, 0, this.maxScroll);
    this.list.y = -this.scroll;
    for (const r of this.rects) r.rect.y = r.y0 - this.scroll;
  }

  get isOpen(): boolean {
    return this.openFlag;
  }

  open(): void {
    this.openFlag = true;
    this.root.setVisible(true).setY(this.scene.scale.height - this.top);
    this.scene.tweens.add({ targets: this.root, y: 0, duration: 220, ease: 'Quad.easeOut' }); // dev.md §5 "0.22초 올라옴"
    this.refresh();
  }

  close(): void {
    this.openFlag = false;
    this.resetArmedUntil = 0;
    this.root.setVisible(false);
  }

  /** 카드 다시 그림 — 재화 · Lv가 바뀔 때마다 (열려 있을 때 매 프레임) */
  refresh(): void {
    if (!this.openFlag) return;
    const { sim } = this;
    this.debris.setText(t('hud.debris', { n: sim.wallet }));
    for (const c of this.cards) {
      const lv = sim.levels[c.row.upgrade_id] ?? 0;
      const check = buyCheck(sim.cfg, sim.levels, sim.wallet, c.row.upgrade_id);
      c.level.setText(t('upgrade.level', { n: lv, max: c.row.max_level }));
      const now = this.effectValue(c.row, lv);
      if (check.result === 'max') {
        c.effect.setText(t(`upgrade.now.${c.row.stat}`, { a: now }));
        c.cost.setText(t('upgrade.max')).setColor('#cfc7b8');
        c.btn.setFillStyle(COLOR.pipOff);
      } else {
        c.effect.setText(t(`upgrade.fx.${c.row.stat}`, { a: now, b: this.effectValue(c.row, lv + 1) }));
        const ok = check.result === 'ok';
        c.cost.setText(String(check.cost)).setColor(ok ? COLOR.challengeText : COLOR.hurt);
        c.btn.setFillStyle(ok ? COLOR.challenge : COLOR.pipOff);
      }
    }
    this.resetText.setText(t(this.scene.time.now < this.resetArmedUntil ? 'upgrade.reset_confirm' : 'upgrade.reset'));
  }

  /** 구매 결과 연출 — ok = 카드 튐 · short = 버튼 흔들림 */
  feedback(id: string, result: string): void {
    const c = this.cards.find((x) => x.row.upgrade_id === id);
    if (!c) return;
    if (result === 'ok') {
      this.scene.tweens.killTweensOf(c.root);
      c.root.setScale(1);
      this.scene.tweens.add({ targets: c.root, scaleX: 1.02, scaleY: 1.02, yoyo: true, duration: 75 }); // dev.md §5 "0.15초 튐"
    } else if (result === 'short') {
      this.scene.tweens.killTweensOf([c.btn, c.cost]);
      for (const o of [c.btn, c.cost]) o.x = c.btnX;
      this.scene.tweens.add({ targets: [c.btn, c.cost], x: { from: c.btnX - 8, to: c.btnX }, duration: 150, ease: 'Bounce.easeOut' });
    }
    this.refresh();
  }

  /** [기록 지우기] — 두 번 눌러 확정 (H-17 질문 7). 반환 = 지울 차례인가 */
  armReset(): boolean {
    if (this.scene.time.now < this.resetArmedUntil) return true;
    this.resetArmedUntil = this.scene.time.now + 2000;
    this.refresh();
    return false;
  }

  /** 카드에 보일 효과 값 (공격력 = 데미지 · 공격속도 = 초당 타수 · 점프 · 하강 · 받치는 힘 = +% · 체력 = 최대 HP · 자동 받치기 = %) */
  private effectValue(row: UpgradeRow, lv: number): string {
    const levels = { ...this.sim.levels, [row.upgrade_id]: lv };
    const st = deriveStats(this.sim.cfg, levels);
    switch (row.stat) {
      case 'attack_power':
        return String(st.armDamage[0] ?? 0);
      case 'attack_speed':
        return (1 / st.strikeIntervalS).toFixed(1);
      case 'max_hp':
        return String(this.sim.cfg.battle.ant.max_hp + st.hpAdd);
      case 'auto_defend':
        return String((this.sim.cfg.battle.defend?.auto_pct ?? 0) + st.autoDefendAdd);
      default:
        return String(levelPct(row, lv) - 100);
    }
  }
}
