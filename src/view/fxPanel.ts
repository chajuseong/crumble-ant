/**
 * [FX] 패널 — 테스트 빌드에서 M2 연출을 하나씩 켜고 끈다 (HTML 오버레이 · 캔버스 밖이라 InputRouter와 안 겹침).
 * 글자는 테스트 빌드 확인용 디버그 라벨 (CLAUDE.md 규칙 3 예외).
 */
import { allToggles, FX_TOGGLES, type FxToggles, saveToggles } from './fx';

const CSS = `
#fx-btn{position:fixed;top:calc(env(safe-area-inset-top,0px) + 6px);left:50%;transform:translateX(-50%);z-index:20;
  font:700 12px/1 system-ui,sans-serif;letter-spacing:.06em;color:#fff8ec;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.35);
  border-radius:999px;padding:7px 12px;cursor:pointer;-webkit-tap-highlight-color:transparent}
#fx-btn[aria-expanded="true"]{background:#ff8a3d;border-color:#fff}
#fx-panel{position:fixed;top:calc(env(safe-area-inset-top,0px) + 40px);left:50%;transform:translateX(-50%);z-index:20;width:min(260px,calc(100vw - 32px));
  background:rgba(27,26,23,.94);color:#fff8ec;border:1px solid rgba(255,255,255,.25);border-radius:12px;padding:10px 12px;
  font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4)}
#fx-panel label{display:flex;align-items:center;gap:10px;padding:7px 2px;cursor:pointer}
#fx-panel input{width:18px;height:18px;accent-color:#ff8a3d}
#fx-panel .row{display:flex;gap:8px;margin-top:8px}
#fx-panel button{flex:1;font:600 13px system-ui,sans-serif;color:#fff8ec;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:8px}
#fx-panel .note{font-size:11px;color:#c9bfae;margin-top:6px}
`;

export interface FxPanel {
  isOpen(): boolean;
}

export function createFxPanel(toggles: FxToggles, onChange: (t: FxToggles) => void, onTouch: () => void): FxPanel {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'fx-btn';
  btn.type = 'button';
  btn.textContent = 'FX';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'fx-panel');

  const panel = document.createElement('div');
  panel.id = 'fx-panel';
  panel.hidden = true;
  const inputs = new Map<string, HTMLInputElement>();
  for (const t of FX_TOGGLES) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `fx-${t.id}`;
    input.checked = toggles[t.id];
    input.addEventListener('change', () => {
      toggles[t.id] = input.checked;
      saveToggles(toggles);
      onChange(toggles);
    });
    inputs.set(t.id, input);
    label.append(input, document.createTextNode(t.label));
    panel.appendChild(label);
  }
  const row = document.createElement('div');
  row.className = 'row';
  for (const [text, on] of [['전부 끔', false], ['전부 켬', true]] as const) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', () => {
      Object.assign(toggles, allToggles(on));
      for (const [id, input] of inputs) input.checked = toggles[id as keyof FxToggles];
      saveToggles(toggles);
      onChange(toggles);
    });
    row.appendChild(b);
  }
  panel.appendChild(row);
  const note = document.createElement('div');
  note.className = 'note';
  note.textContent = '끄면 그 연출은 M1 모습 그대로 · 이 브라우저에만 기억';
  panel.appendChild(note);

  btn.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    btn.setAttribute('aria-expanded', String(!panel.hidden));
  });
  // 패널을 눌러도 소리 unlock (첫 탭 어디서든 — H-10 ⑥-5)
  for (const el of [btn, panel]) el.addEventListener('pointerdown', onTouch);

  document.body.append(btn, panel);
  return { isOpen: () => !panel.hidden };
}
