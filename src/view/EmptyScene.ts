import Phaser from "phaser";

// 안 바뀌는 그림 상수 (CLAUDE.md 규칙 3 예외 — 모양 상수 · 디버그 라벨)
export const VIEW_WIDTH = 720;
export const VIEW_HEIGHT = 1280;
const SKY = 0x8fd3f4;
const GROUND = 0x6b4a2b;

/** M0 빈 장면 — 하늘 · 땅 두 면 + 디버그 라벨. 게임 로직 없음 */
export class EmptyScene extends Phaser.Scene {
  private frames = 0;

  constructor() {
    super("empty");
  }

  create(): void {
    this.add.rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT * 0.9, SKY).setOrigin(0);
    this.add.rectangle(0, VIEW_HEIGHT * 0.9, VIEW_WIDTH, VIEW_HEIGHT * 0.1, GROUND).setOrigin(0);
    this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, "crumble-ant · M0 빈 장면", { fontFamily: "sans-serif", fontSize: "32px", color: "#1b1a17" })
      .setOrigin(0.5);
  }

  update(): void {
    // scripts/ci_smoke.mjs ③ "장면이 돎" 확인용 — 프레임 수를 DOM에 남긴다 (view 전용)
    this.frames += 1;
    if (this.frames % 10 === 0) this.game.canvas.parentElement?.setAttribute("data-frames", String(this.frames));
  }
}
