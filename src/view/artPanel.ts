/**
 * [ART] 패널 (M3 — H-12) — 테스트 빌드에서 그림 · 무기 · 크기를 바꿔 본다 (HTML 오버레이 · [FX] 바로 아래).
 * 글자는 테스트 빌드 확인용 디버그 라벨 (CLAUDE.md 규칙 3 예외). 무기 이름은 weapons 시트.
 */
import { type ArtData, type ArtPlan, type ArtSettings, clearArtSettings, defaultSettings, saveArtSettings, scaleRange, SLOTS } from './artPlan';

const CSS = `
#art-btn{position:fixed;top:calc(env(safe-area-inset-top,0px) + 38px);left:50%;transform:translateX(-50%);z-index:20;
  font:700 12px/1 system-ui,sans-serif;letter-spacing:.06em;color:#fff8ec;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.35);
  border-radius:999px;padding:7px 10px;cursor:pointer;-webkit-tap-highlight-color:transparent}
#art-btn[aria-expanded="true"]{background:#ff8a3d;border-color:#fff}
#art-panel{position:fixed;top:calc(env(safe-area-inset-top,0px) + 72px);left:50%;transform:translateX(-50%);z-index:20;width:min(280px,calc(100vw - 32px));
  max-height:calc(100vh - 96px);overflow:auto;background:rgba(27,26,23,.94);color:#fff8ec;border:1px solid rgba(255,255,255,.25);border-radius:12px;padding:10px 12px;
  font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4)}
#art-panel label{display:flex;align-items:center;gap:10px;padding:6px 2px;cursor:pointer}
#art-panel input[type=checkbox]{width:18px;height:18px;accent-color:#ff8a3d}
#art-panel select{flex:1;font:14px system-ui,sans-serif;padding:4px;border-radius:6px}
#art-panel input[type=range]{flex:1;accent-color:#ff8a3d}
#art-panel .k{min-width:44px}
#art-panel .v{min-width:36px;text-align:right;font-variant-numeric:tabular-nums}
#art-panel .status{font-size:12px;color:#ffe08a;padding:2px 2px 6px;border-bottom:1px solid rgba(255,255,255,.15);margin-bottom:4px}
#art-panel .row{display:flex;gap:8px;margin-top:8px}
#art-panel button{flex:1;font:600 13px system-ui,sans-serif;color:#fff8ec;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:8px}
#art-panel .note{font-size:11px;color:#c9bfae;margin-top:6px}
`;

export interface ArtPanel {
  isOpen(): boolean;
  /** 그린 결과가 바뀌면 상태 줄 갱신 */
  showPlan(plan: ArtPlan): void;
}

export function statusText(plan: ArtPlan): string {
  if (plan.mode === 'shape') return plan.reason === 'off' ? '도형 (그림 끔)' : `도형 폴백 — 그림 파일 ${plan.missing.length}개 없음 (art/game 납품 전)`;
  const bare = plan.missingWeapons.length ? ` · 무기 그림 없음 ${plan.missingWeapons.length} → 맨주먹` : '';
  return `그림 켬${bare}`;
}

export function createArtPanel(data: ArtData, settings: ArtSettings, onChange: (s: ArtSettings) => void, onTouch: () => void): ArtPanel {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'art-btn';
  btn.type = 'button';
  btn.textContent = 'ART';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'art-panel');

  const panel = document.createElement('div');
  panel.id = 'art-panel';
  panel.hidden = true;
  const status = document.createElement('div');
  status.className = 'status';
  status.id = 'art-status';
  panel.appendChild(status);

  const changed = () => {
    saveArtSettings(settings);
    onChange(settings);
  };
  const check = (id: string, text: string, get: () => boolean, set: (v: boolean) => void) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.addEventListener('change', () => {
      set(input.checked);
      changed();
    });
    label.append(input, document.createTextNode(text));
    panel.appendChild(label);
    return () => (input.checked = get());
  };
  const refreshers: (() => unknown)[] = [];
  refreshers.push(check('art-enabled', '그림 켜기 (끄면 도형 = M2 화면)', () => settings.enabled, (v) => (settings.enabled = v)));

  for (let i = 0; i < SLOTS; i++) {
    const label = document.createElement('label');
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = `팔 ${i + 1}`;
    const sel = document.createElement('select');
    sel.id = `art-slot-${i + 1}`;
    const none = document.createElement('option');
    none.value = '';
    none.textContent = '맨주먹';
    sel.appendChild(none);
    for (const w of data.weapons) {
      const o = document.createElement('option');
      o.value = w.weapon_id;
      o.textContent = w.name;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      settings.loadout[i] = sel.value || null;
      changed();
    });
    label.append(k, sel);
    panel.appendChild(label);
    refreshers.push(() => (sel.value = settings.loadout[i] ?? ''));
  }

  refreshers.push(check('art-pivots', '기준점 보기 (분홍 = pivot · 하늘 = 손 소켓)', () => settings.showPivots, (v) => (settings.showPivots = v)));

  const range = scaleRange(data.config);
  const slider = (id: string, text: string, [lo, hi]: [number, number], get: () => number, set: (v: number) => void) => {
    const label = document.createElement('label');
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = text;
    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = String(lo);
    input.max = String(hi);
    input.step = '0.05';
    const v = document.createElement('span');
    v.className = 'v';
    const show = () => (v.textContent = `×${get().toFixed(2)}`);
    input.addEventListener('input', () => {
      set(Number(input.value));
      show();
    });
    input.addEventListener('change', changed);
    label.append(k, input, v);
    panel.appendChild(label);
    refreshers.push(() => {
      input.value = String(get());
      show();
    });
  };
  slider('art-draw-scale', '그림', range.draw, () => settings.drawScale, (x) => (settings.drawScale = x));
  slider('art-weapon-scale', '무기', range.weapon, () => settings.weaponScale, (x) => (settings.weaponScale = x));

  const row = document.createElement('div');
  row.className = 'row';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = '시트 기본값';
  reset.addEventListener('click', () => {
    Object.assign(settings, defaultSettings(data));
    clearArtSettings();
    refreshers.forEach((r) => r());
    onChange(settings);
  });
  row.appendChild(reset);
  panel.appendChild(row);
  const note = document.createElement('div');
  note.className = 'note';
  note.textContent = '판정 크기는 그대로 · 그림 크기만 바뀜 (H-12 Q1) · 이 브라우저에만 기억';
  panel.appendChild(note);
  refreshers.forEach((r) => r());

  btn.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    btn.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) closeOther('fx');
  });
  for (const el of [btn, panel]) el.addEventListener('pointerdown', onTouch);

  document.body.append(btn, panel);
  return {
    isOpen: () => !panel.hidden,
    showPlan: (plan) => (status.textContent = statusText(plan)),
  };
}

/** 패널은 하나만 열림 — [FX] · [ART] */
export function closeOther(which: 'fx' | 'art'): void {
  const p = document.getElementById(`${which}-panel`);
  const b = document.getElementById(`${which}-btn`);
  if (p) p.hidden = true;
  b?.setAttribute('aria-expanded', 'false');
}
