/**
 * M2 G 임시 합성음 — WebAudio로 만든다 (외부 파일 · 외부 요청 없음). 실제 사운드 리소스가 오면 교체.
 * 브라우저 정책상 첫 탭에서 unlock() 해야 소리가 난다. 그 전에는 AudioContext를 만들지 않는다.
 */
import { FX } from './fx';

export class Sfx {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;

  get created(): boolean {
    return this.ctx !== null;
  }

  /** 첫 사용자 입력에서 호출 */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        // 0.5초 흰 잡음 (난수는 소리 재료일 뿐 — core와 무관)
        const len = Math.floor(this.ctx.sampleRate * 0.5);
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  /** 타격 "퍽" — 연타마다 음이 조금씩 높아짐 */
  hit(combo: number): void {
    const s = FX.sfx;
    const k = 1 + s.combo_pitch_step * Math.min(Math.max(0, combo - 1), s.combo_pitch_max);
    this.thump(s.hit_hz * k, s.hit_ms, 0.9);
    this.burst(s.hit_ms * 0.6, 2400 * k, 0.35);
  }

  /** 마지막 일격 "쾅" */
  final(): void {
    const s = FX.sfx;
    this.thump(s.final_hz, s.final_ms, 1);
    this.burst(s.final_ms * 0.7, 1600, 0.5);
  }

  /** M3-D 4연타 마무리 "쾅" — 일반보다 낮고 길게 (마지막 일격보다는 짧게) */
  finisher(): void {
    const f = FX.finisher;
    this.thump(f.sfx_hz, f.sfx_ms, 1);
    this.burst(f.sfx_ms * 0.7, 2000, 0.45);
  }

  /** 붕괴 "와르르" — 잡음이 내려감 */
  crumble(): void {
    const s = FX.sfx;
    this.burst(s.crumble_ms, 1800, 0.6, 240);
  }

  private out(gain: number, ms: number): GainNode | null {
    const c = this.ctx;
    if (!c || c.state !== 'running') return null;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(FX.sfx.volume * gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    g.connect(c.destination);
    return g;
  }

  private thump(hz: number, ms: number, gain: number): void {
    const c = this.ctx;
    const g = this.out(gain, ms);
    if (!c || !g) return;
    const o = c.createOscillator();
    const t = c.currentTime;
    o.type = 'sine';
    o.frequency.setValueAtTime(hz * 1.8, t);
    o.frequency.exponentialRampToValueAtTime(hz, t + ms / 1000);
    o.connect(g);
    o.start(t);
    o.stop(t + ms / 1000 + 0.02);
  }

  private burst(ms: number, fromHz: number, gain: number, toHz = fromHz): void {
    const c = this.ctx;
    const g = this.out(gain, ms);
    if (!c || !g || !this.noise) return;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    const t = c.currentTime;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(fromHz, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, toHz), t + ms / 1000);
    src.connect(f).connect(g);
    src.start(t);
    src.stop(t + ms / 1000 + 0.02);
  }
}
