/**
 * src/view — 그리기 · 연출 · UI (Phaser). core 값을 그리기만 한다.
 * 화면 = layout.frame_width × frame_height (G-03 — 720×1560, 9:19.5). Safe Area 안쪽에 맞춰 축소 (index.html #frame)
 */
import Phaser from 'phaser';
import { BattleScene, type BattleSceneData } from './BattleScene';
import { loadGameConfig } from './gameData';
import { NestScene } from './NestScene';
import { COLOR } from './theme';

const { config, errors } = loadGameConfig();
const host = document.getElementById('game')!;
if (errors.length) {
  host.innerHTML = `<div id="config-error">데이터 오류 — 게임을 시작하지 않습니다.\n\n${errors.join('\n')}</div>`;
} else {
  const params = new URLSearchParams(location.search);
  const data: BattleSceneData = {
    config,
    startStage: Math.max(1, Number(params.get('stage')) || 1), // ?stage=N — 검수용 시작 스테이지 (디버그)
    debug: params.has('debug'), // ?debug — 상태 오버레이 (디버그)
  };
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    width: config.layout.frame_width,
    height: config.layout.frame_height,
    backgroundColor: COLOR.frameBg,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 3 },
    render: { antialias: true },
    fps: { smoothStep: false }, // 느린 기기 · 백그라운드 복귀에서도 실제 시간대로 진행 (core는 고정 스텝, 한 프레임 최대 0.25초)
    scene: [],
  });
  game.scene.add('battle', BattleScene, true, data);
  game.scene.add('nest', NestScene, false);
  (window as unknown as { __game?: Phaser.Game }).__game = game; // 검수 · smoke 확인용
}
