// The Lepus Yard: one sprite per wallet digit (base 10), Terraria-style hop physics,
// merges (10 -> 1 of the next tier) on earning and splits (1 -> 10) on spending.
import { TIERS } from "./sprites.js";

export const YARD = { W: 760, H: 300, GROUND: 284, FENCE_L: 22, FENCE_R: 738 };
const { W, GROUND, FENCE_L, FENCE_R } = YARD;
const TOP = TIERS.length - 1; // Lepus Supreme: everything >= 10^30, at most 9 sprites shown
const WINDOW = 5; // only the 5 highest tiers you own are in the yard
const WINDOW_SCALE = [0.62, 0.74, 0.88, 1.02, 1.2]; // smallest visible tier -> biggest
const G = 1100;
const GATHER_TIME = 0.42;
const POOF_TIME = 0.3;

const rand = (a, b) => a + Math.random() * (b - a);
const digit = (n, t) => Math.floor(n / 10 ** t) % 10;
export const topCount = (n) => Math.floor(n / 10 ** TOP);
export const topTier = (n) => (n < 10 ? 0 : Math.min(TOP, Math.floor(Math.log10(n) + 1e-9)));
export const windowLo = (n) => Math.max(0, topTier(n) - (WINDOW - 1));
const want = (n, t) => (t < windowLo(n) ? 0 : t < TOP ? digit(n, t) : Math.min(9, topCount(n)));

export class Yard {
  constructor() {
    this.ents = [];
    this.pending = []; // merge results waiting for their gather animation: { tier, x, timer }
    this.parts = [];
    this.events = []; // "merge" | "split" | "fly", drained by main for sound
    this.shown = null; // wallet value the sprites currently represent
    this.cooldown = 0;
    this.spawnPoint = { x: W / 2, y: -150 }; // spinner centre in yard coords, set by the renderer
    this.lo = 0; // lowest tier currently shown
  }

  // World-units-per-sprite-pixel for a tier, by its place in the visible window.
  scaleOf(t) {
    const i = Math.max(0, Math.min(WINDOW - 1, t - this.lo));
    return TIERS[t].fit * WINDOW_SCALE[i];
  }

  halfWidth(t) {
    return TIERS[t].sprite.fw * this.scaleOf(t) * 0.3;
  }

  count(t) {
    let c = 0;
    for (const e of this.ents) if (e.tier === t && !e.dying) c++;
    for (const p of this.pending) if (p.tier === t) c++;
    return c;
  }

  live(t) {
    return this.ents.filter((e) => e.tier === t && !e.dying);
  }

  // Bring the yard to wallet value n, animating the difference. force skips the throttle (manual clicks).
  sync(n, force = false) {
    if (this.shown === null) return this.reset(n);
    if (n === this.shown || (!force && this.cooldown > 0)) return;
    this.cooldown = 0.12;
    const d = n - this.shown;
    this.lo = windowLo(n);
    if (d > 0) this.earn(d);
    else this.spend(-d);
    this.shown = n;
    for (let t = 0; t <= TOP; t++) {
      const w = want(n, t);
      let c = this.count(t);
      while (c < w) this.spawn(t), c++;
      if (c > w) this.poof(t, c - w);
    }
  }

  reset(n) {
    this.ents = [];
    this.pending = [];
    this.lo = windowLo(n);
    for (let t = 0; t <= TOP; t++) for (let k = 0; k < want(n, t); k++) this.ents.push(this.make(t, rand(FENCE_L + 60, FENCE_R - 60), GROUND));
    this.shown = n;
  }

  make(tier, x, y) {
    return { tier, x, y, vx: 0, vy: 0, ground: y >= GROUND, idle: rand(0.2, 2), face: Math.random() < 0.5 ? -1 : 1, anim: Math.random() * 10, pop: 1, land: 0, alpha: 1, dying: null };
  }

  // Column addition: spawn each digit of d, carrying with a merge whenever a tier reaches 10.
  earn(d) {
    for (let t = this.lo; t < TOP; t++) {
      for (let k = digit(d, t); k > 0; k--) this.spawn(t);
      if (this.count(t) >= 10) this.merge(t);
    }
  }

  // Column subtraction: borrow by splitting a bigger Lepus whenever a tier runs short.
  spend(d) {
    for (let t = this.lo; t < TOP; t++) {
      const need = digit(d, t);
      while (this.count(t) < need) if (!this.split(t + 1)) break;
      this.poof(t, need);
    }
  }

  spawn(t) {
    if (t === this.lo) {
      // The smallest visible tier flies out of the spinner on a ballistic arc into the yard.
      const sp = this.spawnPoint, e = this.make(t, sp.x, sp.y);
      const tx = rand(FENCE_L + 40, FENCE_R - 40), T = rand(0.65, 0.95);
      e.vx = (tx - sp.x) / T;
      e.vy = (GROUND - sp.y - 0.5 * G * T * T) / T;
      e.ground = false;
      e.pop = 0.3;
      this.ents.push(e);
      this.events.push("fly");
    } else {
      const e = this.make(t, rand(FENCE_L + 60, FENCE_R - 60), -40);
      e.ground = false;
      e.pop = 0;
      this.ents.push(e);
      this.sparkle(e.x, 20, 8, "#fff3a0");
    }
  }

  // Turn queued merge results of tier t into real sprites right away.
  flushPending(t) {
    for (const p of this.pending.filter((p) => p.tier === t)) this.finishMerge(p);
  }

  merge(t) {
    if (this.live(t).length < 10) this.flushPending(t);
    const group = this.live(t);
    if (group.length < 10) return;
    const pivot = group[Math.floor(Math.random() * group.length)];
    const ax = Math.min(FENCE_R - 80, Math.max(FENCE_L + 80, pivot.x));
    group.sort((a, b) => Math.abs(a.x - ax) - Math.abs(b.x - ax));
    for (const e of group.slice(0, 10)) e.dying = { type: "gather", t: 0, sx: e.x, sy: e.y, ax };
    this.pending.push({ tier: t + 1, x: ax, timer: GATHER_TIME });
  }

  finishMerge(p) {
    this.pending.splice(this.pending.indexOf(p), 1);
    const e = this.make(p.tier, p.x, GROUND);
    e.pop = 0;
    e.vy = -360;
    e.ground = false;
    this.ents.push(e);
    this.sparkle(p.x, GROUND - 30, 22, "#ffe66b");
    this.ring(p.x, GROUND - 30);
    this.events.push("merge");
  }

  split(t) {
    if (t > TOP) return false;
    if (this.count(t) === 0 && !this.split(t + 1)) return false;
    if (!this.live(t).length) this.flushPending(t);
    const big = this.live(t)[0];
    if (!big) return false;
    big.dying = { type: "poof", t: 0 };
    for (let k = 0; k < 10; k++) {
      const e = this.make(t - 1, big.x, GROUND - 20);
      e.vx = rand(-220, 220);
      e.vy = rand(-380, -220);
      e.ground = false;
      e.pop = 0.4;
      this.ents.push(e);
    }
    this.sparkle(big.x, GROUND - 30, 16, "#ffffff");
    this.events.push("split");
    return true;
  }

  poof(t, k) {
    const victims = this.live(t).sort((a, b) => b.ground - a.ground);
    for (const e of victims.slice(0, k)) {
      e.dying = { type: "poof", t: 0 };
      this.smoke(e.x, e.y - 15);
      k--;
    }
    while (k-- > 0) {
      const i = this.pending.findIndex((p) => p.tier === t);
      if (i < 0) break;
      this.pending.splice(i, 1);
    }
  }

  sparkle(x, y, n, color) {
    for (let i = 0; i < n; i++)
      this.parts.push({ x, y, vx: rand(-160, 160), vy: rand(-260, -40), life: rand(0.4, 0.8), max: 0.8, size: rand(2, 4), color, g: 500 });
  }

  smoke(x, y) {
    for (let i = 0; i < 7; i++)
      this.parts.push({ x: x + rand(-10, 10), y, vx: rand(-40, 40), vy: rand(-70, -20), life: rand(0.3, 0.5), max: 0.5, size: rand(5, 9), color: "rgba(220,220,230,0.8)", g: -40 });
  }

  ring(x, y) {
    this.parts.push({ x, y, ring: true, life: 0.45, max: 0.45 });
  }

  hop(e) {
    const t = e.tier;
    let dir = Math.random() < 0.5 ? -1 : 1;
    if (e.x < FENCE_L + 120) dir = 1;
    else if (e.x > FENCE_R - 120) dir = -1;
    e.vx = dir * rand(60, 150) * (1 - t * 0.07);
    e.vy = -rand(220, 340) - 10 * t;
    e.ground = false;
  }

  update(dt) {
    this.cooldown -= dt;
    for (const p of [...this.pending]) if ((p.timer -= dt) <= 0) this.finishMerge(p);

    for (const e of this.ents) {
      e.anim += dt;
      const d = e.dying;
      if (d) {
        d.t += dt;
        if (d.type === "gather") {
          const k = Math.min(1, d.t / GATHER_TIME), ease = k * k * (3 - 2 * k);
          e.x = d.sx + (d.ax - d.sx) * ease;
          e.y = d.sy + (GROUND - 20 - d.sy) * ease - Math.sin(k * Math.PI) * 50;
          e.alpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
          d.done = k >= 1;
        } else {
          e.alpha = Math.max(0, 1 - d.t / POOF_TIME);
          e.pop = 1 + d.t * 1.6;
          d.done = d.t >= POOF_TIME;
        }
        continue;
      }
      e.pop = Math.min(1, e.pop + dt * 4);
      e.land = Math.max(0, e.land - dt * 5);
      if (!e.ground) {
        e.vy += G * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.y >= GROUND) {
          e.y = GROUND;
          e.vy = 0;
          e.ground = true;
          e.land = 1;
          e.idle = rand(0.4, 2.4) + e.tier * 0.35;
        }
      } else {
        e.vx *= Math.max(0, 1 - 9 * dt);
        e.x += e.vx * dt;
        if ((e.idle -= dt) <= 0) this.hop(e);
      }
      const hw = this.halfWidth(e.tier);
      if (e.x < FENCE_L + hw) (e.x = FENCE_L + hw), (e.vx = Math.abs(e.vx) * 0.5);
      if (e.x > FENCE_R - hw) (e.x = FENCE_R - hw), (e.vx = -Math.abs(e.vx) * 0.5);
      if (Math.abs(e.vx) > 8) e.face = Math.sign(e.vx);
    }
    this.ents = this.ents.filter((e) => !(e.dying && e.dying.done));

    for (const p of this.parts) {
      p.life -= dt;
      if (p.ring) continue;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
  }
}
