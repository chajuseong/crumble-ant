/**
 * M7-E 치트 패널 (`?cheat` · [프로토만] — I-28 · docs/dev.md §6). 주소에 ?cheat가 있을 때만 보임.
 * core 입력 setCheat · addDebrisCheat만 부름 (시트 값을 덮기만 · 세이브 안 함). 글자 = 디버그 라벨 (CLAUDE.md 규칙 3 예외)
 * 자리 = 왼쪽 위 HUD 아래 (HTML 오버레이 · 캔버스 밖이라 InputRouter와 안 겹침) · 머리 줄을 누르면 접기 / 펴기
 */
import type { BattleSim } from '../core/battle';

const CSS = `
#cheat{position:fixed;top:calc(env(safe-area-inset-top,0px) + 7.5vh);left:calc(env(safe-area-inset-left,0px) + 6px);z-index:21;max-width:calc(100vw - 24px);
  background:rgba(27,26,23,.92);color:#fff8ec;border:1px solid rgba(255,138,61,.7);border-radius:10px;
  font:12px/1.3 system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.35)}
#cheat .head{font-weight:800;letter-spacing:.06em;padding:7px 10px;cursor:pointer;color:#ffb27a}
#cheat .body{padding:0 10px 9px;width:min(190px,calc(100vw - 44px))}
#cheat .row{display:flex;align-items:center;gap:5px;margin-top:6px}
#cheat .row span{flex:1;white-space:nowrap}
#cheat button{font:700 12px system-ui,sans-serif;color:#fff8ec;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:6px;padding:4px 7px;min-width:28px}
#cheat button.on{background:#ff8a3d;border-color:#fff}
#cheat input[type=number]{width:44px;font:700 12px system-ui;background:#fff8ec;color:#1b1a17;border:0;border-radius:4px;padding:3px}
#cheat input[type=checkbox]{width:16px;height:16px;accent-color:#ff8a3d}
`;

const MULTS = [0.5, 1, 2] as const;
const AUTO_STEP = 5;
const DEBRIS_ADD = 1000;

export function createCheatPanel(sim: BattleSim, onDebris: () => void): void {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.id = 'cheat';
  const head = document.createElement('div');
  head.className = 'head';
  head.textContent = '▶ CHEAT';
  const body = document.createElement('div');
  body.className = 'body';
  body.hidden = true; // 처음엔 접힘 (전투 화면을 가리지 않게)
  root.append(head, body);
  head.addEventListener('click', () => {
    body.hidden = !body.hidden;
    head.textContent = `${body.hidden ? '▶' : '▼'} CHEAT`;
  });

  const row = (label: string, ...els: HTMLElement[]) => {
    const r = document.createElement('div');
    r.className = 'row';
    const s = document.createElement('span');
    s.textContent = label;
    r.append(s, ...els);
    body.append(r);
  };
  const button = (text: string, onClick: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  };

  // 자동 받치기 % (입력 · ±5) — 비우면 시트 + 강화 값
  const auto = document.createElement('input');
  auto.type = 'number';
  auto.min = '0';
  auto.max = '100';
  const showAuto = () => (auto.value = String(sim.autoDefendPct));
  const setAuto = (v: number) => {
    sim.setCheat({ autoDefendPct: Math.max(0, Math.min(100, Math.round(v))) });
    showAuto();
  };
  auto.addEventListener('change', () => (auto.value === '' ? (sim.setCheat({ autoDefendPct: null }), showAuto()) : setAuto(Number(auto.value))));
  row('자동 %', button('−', () => setAuto(sim.autoDefendPct - AUTO_STEP)), auto, button('+', () => setAuto(sim.autoDefendPct + AUTO_STEP)));
  showAuto();

  // 받치는 힘 × · 무게 × (0.5 · 1 · 2)
  const multRow = (label: string, key: 'pushMult' | 'weightMult') => {
    const btns = MULTS.map((m) =>
      button(`×${m}`, () => {
        sim.setCheat({ [key]: m });
        btns.forEach((b, i) => b.classList.toggle('on', MULTS[i] === m));
      }),
    );
    btns.forEach((b, i) => b.classList.toggle('on', MULTS[i] === sim.cheat[key]));
    row(label, ...btns);
  };
  multRow('받치는 힘', 'pushMult');
  multRow('무게', 'weightMult');

  const hp = document.createElement('input');
  hp.type = 'checkbox';
  hp.checked = sim.cheat.infiniteHp;
  hp.addEventListener('change', () => sim.setCheat({ infiniteHp: hp.checked }));
  row('체력 무한', hp);

  row(
    '잔해',
    button(`+${DEBRIS_ADD}`, () => {
      sim.addDebrisCheat(DEBRIS_ADD);
      onDebris();
    }),
  );
  document.body.append(root);
}
