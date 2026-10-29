type ToneOpts = {
  type?: OscillatorType;
  vol?: number;
  slide?: number;
  delay?: number;
};

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  ensure() {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private tone(freq: number, dur: number, opts: ToneOpts = {}) {
    if (this.muted || !this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type ?? "square";
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.slide), t0 + dur);
    const v = opts.vol ?? 0.12;
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  private noise(dur: number, vol = 0.2, delay = 0) {
    if (this.muted || !this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  eat(streak: number) {
    const f = 380 * Math.pow(1.059, Math.min(streak, 14));
    this.tone(f, 0.07, { type: "square", vol: 0.09 });
    this.tone(f * 1.5, 0.09, { type: "square", vol: 0.07, delay: 0.045 });
  }

  bonus() {
    [660, 880, 1320].forEach((f, i) =>
      this.tone(f, 0.1, { type: "triangle", vol: 0.13, delay: i * 0.06 })
    );
  }

  die() {
    this.tone(300, 0.5, { type: "sawtooth", vol: 0.13, slide: 50 });
    this.noise(0.4, 0.22);
  }

  turn() {
    this.tone(240, 0.028, { type: "square", vol: 0.025 });
  }

  pause(on: boolean) {
    this.tone(on ? 190 : 330, 0.08, { type: "triangle", vol: 0.09 });
  }

  start() {
    this.tone(520, 0.08, { type: "square", vol: 0.09 });
    this.tone(780, 0.11, { type: "square", vol: 0.09, delay: 0.08 });
  }

  save() {
    this.tone(660, 0.08, { type: "triangle", vol: 0.1 });
    this.tone(990, 0.12, { type: "triangle", vol: 0.1, delay: 0.07 });
  }

  ui() {
    this.tone(440, 0.05, { type: "square", vol: 0.06 });
  }
}

export const sfx = new Sfx();
