import { COLS, ROWS, type Engine, type FoodItem } from "./engine";

function makeGlow(r: number, g: number, b: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.85)`);
  grad.addColorStop(0.35, `rgba(${r},${g},${b},0.32)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 96, 96);
  return c;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private size = 0;
  private cell = 0;
  private dpr = 1;
  private bg: HTMLCanvasElement | null = null;
  private vignette: HTMLCanvasElement | null = null;
  private glowRed = makeGlow(255, 77, 109);
  private glowGold = makeGlow(255, 207, 63);

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
  }

  resize(cssSize: number, dpr: number) {
    this.size = cssSize;
    this.dpr = dpr;
    this.cell = cssSize / COLS;
    this.canvas.width = Math.round(cssSize * dpr);
    this.canvas.height = Math.round(cssSize * dpr);
    this.canvas.style.width = cssSize + "px";
    this.canvas.style.height = cssSize + "px";
    this.buildBg();
    this.buildVignette();
  }

  private buildBg() {
    const s = this.size;
    const c = document.createElement("canvas");
    c.width = c.height = Math.round(s * this.dpr);
    const g = c.getContext("2d")!;
    g.scale(this.dpr, this.dpr);

    const grad = g.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, "#08190f");
    grad.addColorStop(1, "#04100a");
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);

    const cell = this.cell;
    g.fillStyle = "rgba(120,255,190,0.024)";
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if ((x + y) % 2 === 0) g.fillRect(x * cell, y * cell, cell, cell);
      }
    }

    g.strokeStyle = "rgba(90,255,170,0.055)";
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 1; i < COLS; i++) {
      g.moveTo(i * cell + 0.5, 0);
      g.lineTo(i * cell + 0.5, s);
    }
    for (let i = 1; i < ROWS; i++) {
      g.moveTo(0, i * cell + 0.5);
      g.lineTo(s, i * cell + 0.5);
    }
    g.stroke();

    // walls
    g.strokeStyle = "rgba(70,255,138,0.55)";
    g.lineWidth = 2;
    g.strokeRect(1, 1, s - 2, s - 2);
    g.strokeStyle = "rgba(70,255,138,0.12)";
    g.lineWidth = 5;
    g.strokeRect(4, 4, s - 8, s - 8);

    this.bg = c;
  }

  private buildVignette() {
    const s = this.size;
    const c = document.createElement("canvas");
    c.width = c.height = Math.round(s * this.dpr);
    const g = c.getContext("2d")!;
    g.scale(this.dpr, this.dpr);
    const rad = g.createRadialGradient(s / 2, s / 2, s * 0.34, s / 2, s / 2, s * 0.74);
    rad.addColorStop(0, "rgba(0,0,0,0)");
    rad.addColorStop(1, "rgba(0,0,0,0.52)");
    g.fillStyle = rad;
    g.fillRect(0, 0, s, s);
    this.vignette = c;
  }

  draw(e: Engine) {
    const { ctx, size, dpr } = this;
    if (!this.size || !this.bg) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    let sx = 0;
    let sy = 0;
    if (e.shakeT > 0) {
      const k = (e.shakeT / e.shakeDur) * e.shakeMag;
      sx = (Math.random() * 2 - 1) * k;
      sy = (Math.random() * 2 - 1) * k;
    }
    ctx.save();
    ctx.translate(sx, sy);

    ctx.drawImage(this.bg, 0, 0, size, size);

    if (e.food) this.drawFood(e.food, e.time);
    if (e.bonus) this.drawBonus(e.bonus, e.time);

    if (e.dying) {
      const k = 1 - Math.min(1, (e.time - e.dieStart) / 480);
      if (k > 0) this.drawSnake(e, 0.6 * k, 1);
    } else if (e.snake.length > 1) {
      const t = e.alive ? Math.min(1, e.acc / e.stepTime) : 1;
      this.drawSnake(e, 1, t);
    }

    this.drawParticles(e);
    this.drawPopups(e);

    ctx.restore();

    if (this.vignette) ctx.drawImage(this.vignette, 0, 0, size, size);
    if (e.flash > 0) {
      ctx.fillStyle = `rgba(${e.flashRGB},${(e.flash * 0.5).toFixed(3)})`;
      ctx.fillRect(-20, -20, size + 40, size + 40);
    }
  }

  private drawFood(f: FoodItem, time: number) {
    const { ctx, cell } = this;
    const cx = (f.x + 0.5) * cell;
    const cy = (f.y + 0.5) * cell;
    const pulse = 1 + Math.sin(time * 0.007 + f.x * 1.7) * 0.12;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.55;
    const gr = cell * 2.1 * pulse;
    ctx.drawImage(this.glowRed, cx - gr, cy - gr, gr * 2, gr * 2);
    ctx.restore();

    const r = cell * 0.27 * (1 + Math.sin(time * 0.011) * 0.06);
    ctx.fillStyle = "#ff4d6d";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(cx - r * 0.32, cy - r * 0.34, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBonus(f: FoodItem, time: number) {
    const { ctx, cell } = this;
    const cx = (f.x + 0.5) * cell;
    const cy = (f.y + 0.5) * cell;
    const frac = Math.max(0, (f.expiresAt - time) / 6500);
    const pulse = 1 + Math.sin(time * 0.016) * 0.16;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.6 + Math.sin(time * 0.02) * 0.15;
    const gr = cell * 2.4 * pulse;
    ctx.drawImage(this.glowGold, cx - gr, cy - gr, gr * 2, gr * 2);
    ctx.restore();

    const r = cell * 0.3 * pulse;
    ctx.fillStyle = "#ffcf3f";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.32, r * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // countdown ring
    ctx.strokeStyle = "rgba(255,207,63,0.9)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.55, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.stroke();
  }

  private drawSnake(e: Engine, alpha: number, t: number) {
    const { ctx, cell } = this;
    const n = e.snake.length;
    const pts = new Array<number>(n * 2);
    for (let i = 0; i < n; i++) {
      const p = e.prev[i] ?? e.snake[i];
      const c = e.snake[i];
      pts[i * 2] = (p.x + (c.x - p.x) * t + 0.5) * cell;
      pts[i * 2 + 1] = (p.y + (c.y - p.y) * t + 0.5) * cell;
    }

    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 1; i < n; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
    };

    // outer glow pass
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.3 * alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#2fff9e";
    ctx.lineWidth = cell * 1.18;
    trace();
    ctx.stroke();
    ctx.restore();

    // body with head-to-tail gradient
    const hx = pts[0];
    const hy = pts[1];
    const tx = pts[(n - 1) * 2];
    const ty = pts[(n - 1) * 2 + 1];
    const g = ctx.createLinearGradient(hx, hy, tx, ty);
    g.addColorStop(0, "#e2ff5c");
    g.addColorStop(0.45, "#46ff9d");
    g.addColorStop(1, "#0fbf8a");
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = g;
    ctx.lineWidth = cell * 0.6;
    trace();
    ctx.stroke();

    // spine highlight
    ctx.globalAlpha = alpha * 0.4;
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = cell * 0.13;
    trace();
    ctx.stroke();

    // head
    const hp = 1 + e.headPulse * 0.32;
    const d = e.dir;
    const px = -d.y;
    const py = d.x;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#eaff6b";
    ctx.beginPath();
    ctx.arc(hx, hy, cell * 0.41 * hp, 0, Math.PI * 2);
    ctx.fill();

    // eyes
    const eo = cell * 0.17;
    const fwd = cell * 0.1;
    const er = cell * 0.115;
    for (const s of [-1, 1]) {
      const ex = hx + d.x * fwd + px * eo * s;
      const ey = hy + d.y * fwd + py * eo * s;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#06231a";
      ctx.beginPath();
      ctx.arc(ex + d.x * er * 0.35, ey + d.y * er * 0.35, er * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawParticles(e: Engine) {
    const { ctx, cell } = this;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of e.particles) {
      const a = Math.max(0, p.life / p.max);
      const px = p.x * cell;
      const py = p.y * cell;
      ctx.globalAlpha = a;
      if (p.ring) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5 * a + 0.5;
        ctx.beginPath();
        ctx.arc(px, py, p.ring.r * cell, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.streak) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * 0.55 * a);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(px - p.vx * cell * 26, py - p.vy * cell * 26);
        ctx.lineTo(px, py);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.5, p.size * a), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawPopups(e: Engine) {
    const { ctx, cell } = this;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const p of e.popups) {
      const a = Math.min(1, p.life / 320);
      const popIn = p.life > p.max - 130 ? 1 + ((p.life - (p.max - 130)) / 130) * 0.5 : 1;
      const px = p.x * cell;
      const py = p.y * cell;
      const fs = Math.max(8, Math.round(p.size * cell * popIn));
      ctx.font = `${fs}px 'Press Start 2P', monospace`;
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = "rgba(3,12,7,0.9)";
      ctx.fillText(p.text, px + 2, py + 2);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, px, py);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
