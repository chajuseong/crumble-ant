/**
 * src/view — 그리기 · 연출 · UI (Phaser). core 값을 그리기만 한다.
 * M0: 세로 720×1280 빈 장면 하나 (CLAUDE.md [가정] — 기획서 9:19.5와 다름, docs/decisions.md 확인 대기).
 */
import Phaser from "phaser";
import { EmptyScene, VIEW_HEIGHT, VIEW_WIDTH } from "./EmptyScene";

const host = document.getElementById("game")!;
new Phaser.Game({
  type: Phaser.AUTO,
  parent: host,
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  backgroundColor: "#1b1a17",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [EmptyScene],
});
