export interface Cell {
  x: number;
  y: number;
}
export interface Dir {
  x: number;
  y: number;
}

export const COLS = 19;
export const ROWS = 19;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  drag: number;
  streak: boolean;
  ring?: { r: number; vr: number };
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  size: number; // fraction of cell size
}

export interface FoodItem {
  x: number;
  y: number;
  kind: "food" | "bonus";
  born: number;
  expiresAt: number;
}

export interface EngineEvents {
  onScore(score: number, len: number): void;
  onEat(streak: number): void;
  onBonus(): void;
  onDie(score: number, len: number, bestStreak: number): void;
}

const rand = (n: number) => Math.floor(Math.random() * n);

export class Engine {
  snake: Cell[] = [];
  prev: Cell[] = [];
  dir: Dir = { x: 1, y: 0 };
  queue: Dir[] = [];
  food: FoodItem | null = null;
  bonus: FoodItem | null = null;

  score = 0;
  foods = 0;
  streak = 0;
  bestStreak = 0;
  lastEatAt = 0;
  stepTime = 150;
  acc = 0;
  time = 0;
  alive = true;
  dying = false;
  dead = false;
  dieAt = 0;
  dieStart = 0;
  ai = false;

  headPulse = 0;
  shakeT = 0;
  shakeDur = 1;
  shakeMag = 0;
  flash = 0;
  flashRGB = "255,255,255";

  particles: Particle[] = [];
  popups: Popup[] = [];

  events: EngineEvents;

  constructor(events: EngineEvents) {
    this.events = events;
    this.reset();
  }

  get len() {
    return this.snake.length;
  }

  reset() {
    const cx = COLS >> 1;
    const cy = ROWS >> 1;
    this.snake = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];
    this.prev = this.snake.map((c) => ({ ...c }));
    this.dir = { x: 1, y: 0 };
    this.queue = [];
    this.score = 0;
    this.foods = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.lastEatAt = 0;
    this.stepTime = 150;
    this.acc = 0;
    this.alive = true;
    this.dying = false;
    this.dead = false;
    this.dieAt = 0;
    this.headPulse = 0;
    this.shakeT = 0;
    this.flash = 0;
    this.particles.length = 0;
    this.popups.length = 0;
    this.bonus = null;
    // first orb placed straight ahead so the first eat lands in ~1s
    this.food = {
      x: Math.min(cx + 6, COLS - 2),
      y: cy,
      kind: "food",
      born: this.time,
      expiresAt: Infinity,
    };
  }

  enqueue(d: Dir): boolean {
    if (!this.alive || this.dying || this.ai) return false;
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if (d.x === -last.x && d.y === -last.y) return false;
    if (d.x === last.x && d.y === last.y) return false;
    if (this.queue.length >= 3) return false;
    this.queue.push(d);
    return true;
  }

  update(dt: number) {
    this.time += dt;

    if (this.alive && this.streak > 0 && this.time - this.lastEatAt > 2600) {
      this.streak = 0;
    }

    if (this.bonus && this.time > this.bonus.expiresAt) {
      this.burst(this.bonus.x, this.bonus.y, 7, "#ffcf3f", 0.45);
      this.bonus = null;
    }

    if (this.alive) {
      if (this.ai) this.aiThink();
      this.acc += dt;
      let guard = 0;
      while (this.acc >= this.stepTime && this.alive && guard++ < 4) {
        this.acc -= this.stepTime;
        this.step();
      }
      if (!this.alive) this.acc = 0;
    }

    if (this.dying && !this.dead && this.time >= this.dieAt) {
      this.dead = true;
    }

    // particles
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
        continue;
      }
      if (p.ring) {
        p.ring.r += p.ring.vr * dt;
      } else {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    // popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt;
      p.y -= dt * 0.0021;
      if (p.life <= 0) {
        this.popups[i] = this.popups[this.popups.length - 1];
        this.popups.pop();
      }
    }

    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / 420);
    this.headPulse = Math.max(0, this.headPulse - dt / 260);
  }

  private step() {
    if (this.queue.length) {
      const d = this.queue.shift()!;
      if (!(d.x === -this.dir.x && d.y === -this.dir.y)) this.dir = d;
    }
    const head = this.snake[0];
    const nx = head.x + this.dir.x;
    const ny = head.y + this.dir.y;

    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
      if (this.ai) {
        this.reset();
        return;
      }
      this.die();
      return;
    }

    const eatFood = !!this.food && this.food.x === nx && this.food.y === ny;
    const eatBonus = !!this.bonus && this.bonus.x === nx && this.bonus.y === ny;

    if (this.occupied(nx, ny, eatFood || eatBonus)) {
      if (this.ai) {
        this.reset();
        return;
      }
      this.die();
      return;
    }

    this.prev = this.snake.map((c) => ({ ...c }));
    this.snake.unshift({ x: nx, y: ny });
    if (eatFood || eatBonus) {
      const tail = this.prev[this.prev.length - 1];
      this.prev.push({ ...tail });
    } else {
      this.snake.pop();
    }

    if (eatFood && this.food) {
      const f = this.food;
      this.food = null;
      const pts = 10 + (this.streak >= 2 ? this.streak * 2 : 0);
      this.eat(f.x, f.y, pts);
      this.spawnFood();
    }
    if (eatBonus && this.bonus) {
      const b = this.bonus;
      this.bonus = null;
      this.eatBonus(b.x, b.y);
    }
  }

  private occupied(x: number, y: number, includeTail: boolean): boolean {
    const n = this.snake.length;
    const lim = includeTail ? n : n - 1;
    for (let i = 0; i < lim; i++) {
      if (this.snake[i].x === x && this.snake[i].y === y) return true;
    }
    return false;
  }

  private freeCells(): Cell[] {
    const occ = new Set<number>();
    for (const c of this.snake) occ.add(c.x * ROWS + c.y);
    if (this.food) occ.add(this.food.x * ROWS + this.food.y);
    if (this.bonus) occ.add(this.bonus.x * ROWS + this.bonus.y);
    const out: Cell[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!occ.has(x * ROWS + y)) out.push({ x, y });
      }
    }
    return out;
  }

  private spawnFood() {
    const free = this.freeCells();
    if (!free.length) return;
    const c = free[rand(free.length)];
    this.food = { x: c.x, y: c.y, kind: "food", born: this.time, expiresAt: Infinity };
  }

  private spawnBonus() {
    const free = this.freeCells();
    if (!free.length) return;
    const c = free[rand(free.length)];
    this.bonus = { x: c.x, y: c.y, kind: "bonus", born: this.time, expiresAt: this.time + 6500 };
    this.popup(c.x, c.y - 0.4, "BONUS!", "#ffcf3f", 0.5);
  }

  private eat(x: number, y: number, pts: number) {
    this.foods++;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.lastEatAt = this.time;
    this.score += pts;
    if (this.ai) {
      this.stepTime = 175;
    } else {
      this.stepTime = Math.max(72, 150 - (this.foods - 1) * 2.3);
    }
    this.headPulse = 1;
    this.shake(2.6, 90);
    this.burst(x, y, 13, "#ff6b8a", 1);
    this.ring(x, y, "#ff6b8a");
    this.popup(x, y, "+" + pts, "#eaffdc", 0.52);
    if (this.streak === 3 || this.streak === 5 || this.streak === 8 || this.streak === 12) {
      const h = this.snake[0];
      this.popup(h.x, h.y - 0.6, "COMBO x" + this.streak, "#35e6ff", 0.42);
    }
    if (this.foods % 5 === 0 && !this.bonus) this.spawnBonus();
    if (!this.ai) {
      this.events.onScore(this.score, this.len);
      this.events.onEat(this.streak);
    }
  }

  private eatBonus(x: number, y: number) {
    this.score += 50;
    this.streak = Math.min(this.streak + 1, 99);
    this.lastEatAt = this.time;
    this.headPulse = 1;
    this.shake(6, 170);
    this.flash = 0.3;
    this.flashRGB = "255,207,63";
    this.burst(x, y, 26, "#ffcf3f", 1.5);
    this.ring(x, y, "#ffcf3f");
    this.popup(x, y, "+50", "#ffcf3f", 0.62);
    if (!this.ai) {
      this.events.onScore(this.score, this.len);
      this.events.onBonus();
    }
  }

  private die() {
    this.dying = true;
    this.alive = false;
    this.dieStart = this.time;
    this.dieAt = this.time + 1000;
    this.shake(10, 420);
    this.flash = 0.75;
    this.flashRGB = "255,77,109";
    this.ring(this.snake[0].x, this.snake[0].y, "#ff4d6d");
    for (let i = 0; i < this.snake.length; i++) {
      const c = this.snake[i];
      for (let j = 0; j < 2; j++) {
        if (this.particles.length > 150) break;
        const a = Math.random() * Math.PI * 2;
        const sp = 0.003 + Math.random() * 0.01;
        const life = 420 + Math.random() * 480;
        this.particles.push({
          x: c.x + 0.5,
          y: c.y + 0.5,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life,
          max: life,
          size: 2 + Math.random() * 3.5,
          color: i % 2 ? "#46ff8a" : "#d9ff4f",
          drag: 0.004,
          streak: Math.random() < 0.4,
        });
      }
    }
    if (!this.ai) this.events.onDie(this.score, this.len, this.bestStreak);
  }

  shake(mag: number, dur: number) {
    this.shakeMag = mag;
    this.shakeDur = dur;
    this.shakeT = dur;
  }

  burst(x: number, y: number, n: number, color: string, power: number) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 170) break;
      const a = Math.random() * Math.PI * 2;
      const sp = (0.004 + Math.random() * 0.011) * power;
      const life = 360 + Math.random() * 440;
      this.particles.push({
        x: x + 0.5,
        y: y + 0.5,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        max: life,
        size: 2 + Math.random() * 3.5,
        color,
        drag: 0.005 + Math.random() * 0.006,
        streak: Math.random() < 0.35,
      });
    }
  }

  ring(x: number, y: number, color: string) {
    if (this.particles.length > 170) return;
    this.particles.push({
      x: x + 0.5,
      y: y + 0.5,
      vx: 0,
      vy: 0,
      life: 380,
      max: 380,
      size: 0,
      color,
      drag: 0,
      streak: false,
      ring: { r: 0.15, vr: 0.0042 },
    });
  }

  popup(x: number, y: number, text: string, color: string, size: number) {
    const cx = Math.min(Math.max(x + 0.5, 1.1), COLS - 1.1);
    const cy = Math.min(Math.max(y, 0.5), ROWS - 0.5);
    this.popups.push({ x: cx, y: cy, text, color, life: 950, max: 950, size });
  }

  private aiThink() {
    const head = this.snake[0];
    const target = this.food;
    if (!target) return;
    const cands: Dir[] = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    let best: Dir | null = null;
    let bestScore = -Infinity;
    for (const d of cands) {
      if (d.x === -this.dir.x && d.y === -this.dir.y) continue;
      const nx = head.x + d.x;
      const ny = head.y + d.y;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const willEat = nx === target.x && ny === target.y;
      if (this.occupied(nx, ny, willEat)) continue;
      let s = -Math.abs(nx - target.x) - Math.abs(ny - target.y);
      if (d.x === this.dir.x && d.y === this.dir.y) s += 0.4;
      s += Math.random() * 0.2;
      if (s > bestScore) {
        bestScore = s;
        best = d;
      }
    }
    this.dir = best ?? this.dir;
  }
}
