import Phaser from 'phaser';
import { loadGameConfig } from './gameConfig';
import { frameHeightForWidth } from './core/layout';
import { BattleScene, type BattleSceneData } from './scenes/BattleScene';
import { NestScene } from './scenes/NestScene';
import { COLOR } from './ui/theme';

async function boot(): Promise<void> {
  const { config, errors } = loadGameConfig();
  const host = document.getElementById('game')!;
  if (errors.length) {
    host.innerHTML = `<div id="config-error">config 오류 — 게임을 시작하지 않습니다.\n\n${errors.join('\n')}</div>`;
    return;
  }

  // 한글 폰트가 준비된 뒤 캔버스 글자를 만든다 (최대 1.5초 대기)
  try {
    await Promise.race([document.fonts.load('900 40px "Noto Sans KR"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* 폰트 실패 시 시스템 폰트 */
  }

  const params = new URLSearchParams(location.search);
  const data: BattleSceneData = {
    config,
    startStage: Math.max(1, Number(params.get('stage')) || 1), // ?stage=N — 검수용 시작 스테이지
    debug: params.has('debug'), // ?debug — 상태 오버레이
  };

  const width = config.layout.render_width_px;
  const height = frameHeightForWidth(config.layout, width); // 9 : 19.5
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    width,
    height,
    backgroundColor: COLOR.frameBg,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 3 },
    render: { antialias: true },
    scene: [],
  });
  game.scene.add('battle', BattleScene, true, data);
  game.scene.add('nest', NestScene, false);
  (window as unknown as { __game?: Phaser.Game }).__game = game;
}

void boot();
