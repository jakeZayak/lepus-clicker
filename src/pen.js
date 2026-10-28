// The Lepus Pen: a meadow where your Lepuses hang out. Tap one to pet it, drop carrots for them
// to eat, toss an egg for them to race after, and (once you have one) poke Lepuszilla.
// World units: 760 wide; critters walk on a ground band from BACK (far) to FRONT (near).
import { sheets, TIERS, LEPUS_FRAMES } from "./sprites.js";

export const PEN = { W: 760, H: 440, BACK: 250, FRONT: 410, L: 40, R: 720 };
const G = 1100;
const MAX_KINDS = 8; // the 8 biggest kinds of Lepus you've ever had
const MAX_MOTHERS = 3;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const groundY = (z) => PEN.BACK + z * (PEN.FRONT - PEN.BACK);
const depthScale = (z) => 0.7 + 0.45 * z;

export class Pen {
  constructor() {
    this.critters = [];
    this.items = []; // carrots and eggs on (or falling to) the ground
    this.parts = [];
    this.texts = [];
    this.events = []; // { type: "eat" | "egg" | "pet", critter }, drained by main
    this.zilla = null;
    this.rosterKey = "";
    this.shake = 0;
    this.time = 0;
    this.view = { ox: 0, oy: 0, s: 1 };
    this.bottomPad = 0; // screen px covered by the pen bar, set by main
    this.bounds = { L: PEN.L, R: PEN.R }; // the part of the pen that's on screen
  }

  // Rebuild who lives in the pen when the roster changes, keeping critters that stay.
  setRoster(maxTier, mothers, hasZilla) {
    const top = Math.min(maxTier, TIERS.length - 1);
    const kinds = [];
    for (let t = top; t >= 0 && kinds.length < MAX_KINDS; t--) if (!TIERS[t].zilla) kinds.push(`t${t}`);
    for (let i = 0; i < Math.min(MAX_MOTHERS, mothers); i++) kinds.push(`m${i}`);
    const key = kinds.join(",") + "|" + hasZilla;
    if (key === this.rosterKey) return;
    this.rosterKey = key;
    const old = new Map(this.critters.map((c) => [c.kind, c]));
    this.critters = kinds.map((k) => old.get(k) || this.make(k));
    this.zilla = hasZilla ? this.zilla || { x: rand(200, 560), dir: 1, step: 0, walk: 0, roar: 0, bob: 0 } : null;
  }

  make(kind) {
    const mother = kind[0] === "m";
    const tier = mother ? -1 : Number(kind.slice(1));
    const T = mother ? null : TIERS[tier];
    return {
      kind, tier, mother,
      sheet: mother ? sheets.small_lepus : T.sprite,
      fit: mother ? 1.5 : T.fit * 0.95,
      name: mother ? "Mother Lepus" : T.name,
      x: rand(this.bounds.L + 60, this.bounds.R - 60), z: Math.random(), h: 0, vx: 0, vz: 0, vh: 0,
      ground: true, idle: rand(0.3, 2), face: Math.random() < 0.5 ? -1 : 1, anim: Math.random() * 10, land: 0, love: 0, petCd: 0, target: null,
    };
  }

  // Screen <-> world, using the view from the last draw.
  toWorld(sx, sy) {
    const v = this.view;
    return { x: (sx - v.ox) / v.s, y: (sy - v.oy) / v.s };
  }

  size(c) {
    const k = c.fit * depthScale(c.z);
    return { w: c.sheet.fw * k, h: c.sheet.fh * k };
  }

  zillaBox() {
    const z = this.zilla, sh = sheets.lepuszilla, k = 5.2;
    const w = sh.fw * k, h = sh.fh * k;
    return { x: z.x - w / 2, y: PEN.BACK - 6 - h, w, h, k };
  }

  // What's under a tap: the front-most critter, else Lepuszilla.
  pick(wx, wy) {
    const front = [...this.critters].sort((a, b) => b.z - a.z);
    for (const c of front) {
      const { w, h } = this.size(c), gy = groundY(c.z) - c.h;
      if (Math.abs(wx - c.x) < w * 0.42 + 8 && wy > gy - h * 0.95 - 8 && wy < gy + 10) return { critter: c };
    }
    if (this.zilla) {
      const b = this.zillaBox();
      if (wx > b.x + b.w * 0.08 && wx < b.x + b.w * 0.92 && wy > b.y + b.h * 0.1 && wy < b.y + b.h) return { zilla: true };
    }
    return null;
  }

  pet(c) {
    c.love = 1;
    c.petCd = 0.25;
    if (c.ground) {
      c.vh = rand(360, 440);
      c.vx = c.vz = 0;
      c.ground = false;
    }
    for (let i = 0; i < 4; i++) this.heart(c.x + rand(-20, 20), groundY(c.z) - c.h - this.size(c).h * 0.7);
  }

  roar() {
    const z = this.zilla;
    if (!z) return;
    z.roar = 1;
    this.shake = 1.4;
    // Everyone else jumps out of their fur.
    for (const c of this.critters) {
      if (!c.ground) continue;
      c.vh = rand(420, 560);
      c.vx = rand(-60, 60);
      c.ground = false;
      c.face = c.x < z.x ? 1 : -1;
    }
    const b = this.zillaBox();
    for (let i = 0; i < 26; i++)
      this.parts.push({ x: b.x + b.w * rand(0.5, 0.95), y: b.y + b.h * rand(0.1, 0.6), vx: rand(-80, 220), vy: rand(-260, -40), life: rand(0.5, 1), max: 1, size: rand(3, 6), color: ["#ffaaf4", "#f050d6", "#b81ea8"][i % 3], g: 400 });
  }

  dropCarrots(n) {
    const { L, R } = this.bounds;
    for (let i = 0; i < n; i++) this.items.push({ type: "carrot", x: rand(L + 50, R - 50), z: rand(0.05, 0.95), h: rand(260, 420), vh: 0, ground: false, spin: rand(-6, 6), rot: 0 });
  }

  tossEgg() {
    const { L, R } = this.bounds;
    this.items.push({ type: "egg", x: rand(L + 80, R - 80), z: rand(0.1, 0.9), h: 380, vh: 0, ground: false, spin: rand(-8, 8), rot: 0 });
  }

  heart(x, y) {
    this.parts.push({ heart: true, x, y, vx: rand(-40, 40), vy: rand(-120, -60), life: 1, max: 1, size: 1, g: -20 });
  }

  addText(text, x, y, color = "#ffe066") {
    this.texts.push({ text, x, y, life: 1.2, color });
    if (this.texts.length > 30) this.texts.shift();
  }

  // Ballistic hop towards (tx, tz), at most `reach` world units.
  hopTo(c, tx, tz, reach = 140) {
    const up = c.target ? 300 : rand(240, 340), T = (2 * up) / G;
    const dx = clamp(tx - c.x, -reach, reach), dz = clamp(tz - c.z, -0.35, 0.35);
    c.vh = up;
    c.vx = dx / T;
    c.vz = dz / T;
    c.ground = false;
    if (Math.abs(dx) > 3) c.face = Math.sign(dx);
  }

  nearestItem(c) {
    let best = null, bd = Infinity;
    for (const it of this.items) {
      if (!it.ground || it.gone) continue;
      const d = Math.hypot(it.x - c.x, (it.z - c.z) * 300);
      if (d < bd) (bd = d), (best = it);
    }
    return best;
  }

  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 2.5);

    for (const it of this.items) {
      it.rot += it.spin * dt * (it.ground ? 0 : 1);
      if (it.ground) continue;
      it.vh -= G * dt;
      it.h += it.vh * dt;
      if (it.h <= 0) {
        it.h = 0;
        it.ground = true;
        it.rot = 0;
        this.dust(it.x, groundY(it.z));
      }
    }

    for (const c of this.critters) {
      c.anim += dt;
      c.love = Math.max(0, c.love - dt * 0.8);
      c.petCd -= dt;
      c.land = Math.max(0, c.land - dt * 5);
      if (c.target && (c.target.gone || !this.items.includes(c.target))) c.target = null;
      if (!c.target) c.target = this.nearestItem(c);

      if (!c.ground) {
        c.vh -= G * dt;
        c.h += c.vh * dt;
        c.x += c.vx * dt;
        c.z = clamp(c.z + c.vz * dt, 0, 1);
        if (c.h <= 0) {
          c.h = 0;
          c.ground = true;
          c.land = 1;
          c.idle = c.target ? 0.08 : rand(0.6, 2.6);
          const it = c.target;
          if (it && Math.abs(it.x - c.x) < 34 && Math.abs(it.z - c.z) < 0.12) {
            it.gone = true;
            this.events.push({ type: it.type === "egg" ? "egg" : "eat", critter: c });
            c.love = 1;
            this.heart(c.x, groundY(c.z) - this.size(c).h * 0.7);
            c.target = null;
          }
        }
      } else {
        c.x += c.vx * dt;
        c.vx *= Math.max(0, 1 - 9 * dt);
        if ((c.idle -= dt) <= 0) {
          if (c.target) this.hopTo(c, c.target.x, c.target.z, 170);
          else this.hopTo(c, c.x + rand(-160, 160), c.z + rand(-0.3, 0.3));
        }
      }
      const hw = this.size(c).w * 0.35;
      const { L, R } = this.bounds;
      if (c.x < L + hw) (c.x = L + hw), (c.vx = Math.abs(c.vx) * 0.5);
      if (c.x > R - hw) (c.x = R - hw), (c.vx = -Math.abs(c.vx) * 0.5);
    }
    this.items = this.items.filter((it) => !it.gone);

    const z = this.zilla;
    if (z) {
      // Lepuszilla plods back and forth behind the fence; each footfall shakes things a little.
      z.roar = Math.max(0, z.roar - dt * 0.9);
      z.walk += dt;
      if (z.roar <= 0) {
        z.x += z.dir * 26 * dt;
        if (z.x < Math.max(150, this.bounds.L + 125)) z.dir = 1;
        if (z.x > Math.min(610, this.bounds.R - 125)) z.dir = -1;
      }
      const prev = z.step;
      z.step = Math.floor(z.walk / 0.9);
      if (z.step !== prev && z.roar <= 0) this.shake = Math.max(this.shake, 0.35);
      z.bob = Math.abs(Math.sin((z.walk / 0.9) * Math.PI));
    }

    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) (t.life -= dt), (t.y -= dt * 60);
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  dust(x, y) {
    for (let i = 0; i < 6; i++) this.parts.push({ x: x + rand(-10, 10), y, vx: rand(-50, 50), vy: rand(-60, -20), life: rand(0.3, 0.5), max: 0.5, size: rand(4, 7), color: "rgba(230,220,190,0.8)", g: -30 });
  }

  // ---------- drawing ----------
  draw(g, w, h, drawSheet) {
    // Narrow (portrait) screens crop the pen's sides rather than shrinking everything,
    // and the critters stay inside whatever part is visible.
    const usable = h - this.bottomPad;
    const s = Math.min(w / 560, usable / PEN.H), ox = (w - PEN.W * s) / 2, oy = usable - PEN.H * s;
    this.view = { ox, oy, s };
    this.bounds = { L: Math.max(PEN.L, -ox / s + 10), R: Math.min(PEN.R, (w - ox) / s - 10) };
    const X = (wx) => ox + wx * s, Y = (wy) => oy + wy * s;

    // Sky (golden-hour pink) and sun.
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#6a7fe0");
    sky.addColorStop(0.55, "#f2a7c3");
    sky.addColorStop(1, "#ffd9a0");
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff2b0";
    const sunR = 34 * s;
    g.beginPath();
    g.arc(X(620), Y(120), sunR, 0, Math.PI * 2);
    g.fill();

    g.save();
    if (this.shake > 0) g.translate(rand(-1, 1) * this.shake * 6, rand(-1, 1) * this.shake * 4);

    // Far hills.
    g.fillStyle = "#8fbf6a";
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, Y(PEN.BACK - 40) - Math.sin(x * 0.007 / s + 1) * 22 * s - Math.sin(x * 0.019 / s) * 8 * s);
    g.lineTo(w, h);
    g.fill();

    // Lepuszilla stands behind the back fence.
    if (this.zilla) this.drawZilla(g, X, Y, s, drawSheet);

    // Meadow.
    const gy0 = Y(PEN.BACK - 14);
    const grass = g.createLinearGradient(0, gy0, 0, h);
    grass.addColorStop(0, "#5aa84a");
    grass.addColorStop(1, "#3f8f3a");
    g.fillStyle = grass;
    g.fillRect(0, gy0, w, h - gy0);
    g.fillStyle = "#6fc25a";
    for (let i = 0; i < 60; i++) {
      const tx = (i * 137) % PEN.W, tz = ((i * 59) % 100) / 100;
      g.fillRect(X(tx), Y(groundY(tz)) - 6 * s, 2 * s + 1, 6 * s);
      g.fillRect(X(tx) + 4 * s, Y(groundY(tz)) - 4 * s, 2 * s + 1, 4 * s);
    }

    this.drawHutch(g, X, Y, s);
    this.drawBackFence(g, X, Y, s, w);

    // Items + critters, back to front.
    const things = [...this.items.map((it) => ({ z: it.z, it })), ...this.critters.map((c) => ({ z: c.z, c }))].sort((a, b) => a.z - b.z);
    for (const t of things) {
      if (t.it) this.drawItem(g, t.it, X, Y, s, drawSheet);
      else this.drawCritter(g, t.c, X, Y, s, drawSheet);
    }

    // Particles.
    for (const p of this.parts) {
      g.globalAlpha = Math.max(0, p.life / p.max);
      if (p.heart) this.drawHeart(g, X(p.x), Y(p.y), Math.max(2, 2.4 * s));
      else {
        g.fillStyle = p.color;
        const z = p.size * Math.max(1, s * 1.3);
        g.fillRect(X(p.x) - z / 2, Y(p.y) - z / 2, z, z);
      }
    }
    g.globalAlpha = 1;
    g.restore();

    // Floating "+X" texts.
    g.textAlign = "center";
    g.textBaseline = "middle";
    const fs = Math.max(14, 20 * s);
    g.font = `700 ${fs}px "Pixelify Sans", monospace`;
    for (const t of this.texts) {
      g.globalAlpha = Math.min(1, t.life / 0.4);
      g.lineWidth = Math.max(3, fs * 0.22);
      g.strokeStyle = "#2a0f1e";
      g.strokeText(t.text, X(t.x), Y(t.y));
      g.fillStyle = t.color;
      g.fillText(t.text, X(t.x), Y(t.y));
    }
    g.globalAlpha = 1;
  }

  drawCritter(g, c, X, Y, s, drawSheet) {
    const { w, h } = this.size(c);
    const gy = Y(groundY(c.z));
    // Shadow.
    g.fillStyle = `rgba(0,0,0,${0.2 * Math.max(0, 1 - c.h / 200)})`;
    g.beginPath();
    g.ellipse(X(c.x), gy + 1, w * s * 0.3, 4 * s + 2, 0, 0, Math.PI * 2);
    g.fill();

    const sh = c.sheet;
    let frame = 0, sx = 1, sy = 1;
    if (c.mother) frame = Math.floor(c.anim * 8) % sh.n;
    else if (sh.n === 7 && c.tier !== 0) frame = c.ground ? LEPUS_FRAMES.stand[Math.floor(c.anim * 6) % 4] : c.vh > 0 ? LEPUS_FRAMES.rise : LEPUS_FRAMES.fall;
    else if (c.tier === 0) frame = c.ground ? 0 : 1;
    else if (!c.ground) (sx = 0.92), (sy = 1.1);
    sx *= 1 + 0.2 * c.land;
    sy *= 1 - 0.2 * c.land;
    const T = c.mother ? null : TIERS[c.tier];
    const cy = gy - c.h * s - (h * s * sy) / 2;
    if (T && T.glow) {
      const gl = g.createRadialGradient(X(c.x), cy, 2, X(c.x), cy, h * s * 0.9);
      gl.addColorStop(0, `rgba(${T.glow},0.45)`);
      gl.addColorStop(1, `rgba(${T.glow},0)`);
      g.fillStyle = gl;
      g.fillRect(X(c.x) - h * s, cy - h * s, h * s * 2, h * s * 2);
    }
    g.globalAlpha = (T && T.alpha) || 1;
    drawSheet(g, sh, frame, X(c.x), cy, (w / sh.fw) * s, c.face > 0, sx, sy);
    g.globalAlpha = 1;
    if (c.love > 0.5) this.drawHeart(g, X(c.x), cy - h * s * 0.6 - (1 - c.love) * 20 * s, Math.max(2, 3 * s));
  }

  drawZilla(g, X, Y, s, drawSheet) {
    const z = this.zilla, b = this.zillaBox(), sh = sheets.lepuszilla;
    const roar = z.roar, shakeX = roar > 0 ? rand(-3, 3) * roar : 0;
    const lift = roar > 0 ? 0 : z.bob * 4;
    const cx = X(z.x) + shakeX * s, cy = Y(b.y + b.h / 2 - lift);
    const gl = g.createRadialGradient(cx, cy, 4, cx, cy, b.h * s);
    gl.addColorStop(0, `rgba(240,80,214,${0.25 + 0.35 * roar})`);
    gl.addColorStop(1, "rgba(240,80,214,0)");
    g.fillStyle = gl;
    g.fillRect(cx - b.h * s, cy - b.h * s, b.h * s * 2, b.h * s * 2);
    const k = 1 + 0.08 * roar;
    drawSheet(g, sh, 0, cx, cy, b.k * s * k, z.dir > 0, 1, 1);
    if (roar > 0.3) {
      g.textAlign = "center";
      g.textBaseline = "middle";
      const fs = Math.max(18, 34 * s);
      g.font = `700 ${fs}px "Pixelify Sans", monospace`;
      g.lineWidth = fs * 0.2;
      g.strokeStyle = "#2a0028";
      g.fillStyle = "#ffaaf4";
      const half = g.measureText("ROAAAR!").width / 2 + 6, sw = g.canvas.clientWidth;
      const tx = Math.max(half, Math.min(sw - half, cx + (z.dir > 0 ? 1 : -1) * b.w * s * 0.55)), ty = Y(b.y) + b.h * s * 0.3;
      g.strokeText("ROAAAR!", tx, ty);
      g.fillText("ROAAAR!", tx, ty);
    }
  }

  drawHutch(g, X, Y, s) {
    // A little wooden hutch at the back left.
    const x0 = X(Math.max(56, this.bounds.L + 6)), y1 = Y(PEN.BACK + 6), bw = 110 * s, bh = 66 * s;
    g.fillStyle = "#9b6a35";
    g.fillRect(x0, y1 - bh, bw, bh);
    g.fillStyle = "#c08a4e";
    for (let i = 0; i < 5; i++) g.fillRect(x0, y1 - bh + i * 14 * s, bw, 3 * s);
    g.fillStyle = "#3a2210";
    g.fillRect(x0 + bw * 0.36, y1 - bh * 0.62, bw * 0.3, bh * 0.62);
    g.fillStyle = "#b8463a";
    g.beginPath();
    g.moveTo(x0 - 12 * s, y1 - bh);
    g.lineTo(x0 + bw / 2, y1 - bh - 44 * s);
    g.lineTo(x0 + bw + 12 * s, y1 - bh);
    g.fill();
    g.fillStyle = "#8a2e26";
    g.fillRect(x0 - 12 * s, y1 - bh - 3 * s, bw + 24 * s, 5 * s);
  }

  drawBackFence(g, X, Y, s, w) {
    const top = Y(PEN.BACK - 46), bot = Y(PEN.BACK - 6);
    g.fillStyle = "#8a5a2b";
    g.fillRect(0, top + 8 * s, w, 6 * s);
    g.fillRect(0, top + 24 * s, w, 6 * s);
    const pw = Math.max(5, 9 * s);
    for (let x = 0; x < w; x += 70 * s) {
      g.fillStyle = "#9b6a35";
      g.fillRect(x, top, pw, bot - top);
      g.fillStyle = "#5a3818";
      g.fillRect(x, top, pw, Math.max(2, 3 * s));
    }
  }

  drawItem(g, it, X, Y, s, drawSheet) {
    const k = depthScale(it.z), gy = Y(groundY(it.z)), y = gy - it.h * s;
    g.fillStyle = "rgba(0,0,0,0.18)";
    g.beginPath();
    g.ellipse(X(it.x), gy + 1, 10 * k * s, 3 * s + 1, 0, 0, Math.PI * 2);
    g.fill();
    if (it.type === "egg") {
      const eg = sheets.choc_egg;
      drawSheet(g, eg, 0, X(it.x), y - eg.fh * 1.2 * k * s * 0.5, 1.2 * k * s, false, 1, 1, it.rot);
      return;
    }
    // Pixel carrot, lying on the ground once it lands.
    const p = Math.max(1, 2.6 * k * s);
    g.save();
    g.translate(X(it.x), y - p * 2);
    g.rotate(it.ground ? Math.PI / 2 : it.rot);
    const body = [[-2, -3, 4, 2], [-2, -1, 4, 2], [-1, 1, 3, 2], [-1, 3, 2, 2], [0, 5, 1, 1]];
    g.fillStyle = "#f08a24";
    for (const [bx, by, bw, bh] of body) g.fillRect(bx * p, by * p, bw * p, bh * p);
    g.fillStyle = "#c05a10";
    g.fillRect(-2 * p, -1 * p, p, p);
    g.fillRect(0, 2 * p, p, p);
    g.fillStyle = "#4fc23a";
    g.fillRect(-2 * p, -6 * p, p, 3 * p);
    g.fillRect(0, -7 * p, p, 4 * p);
    g.fillRect(1 * p, -5 * p, p, 2 * p);
    g.restore();
  }

  drawHeart(g, x, y, p) {
    g.fillStyle = "#ff4f8b";
    const rows = [[1, 0, 2], [4, 0, 2], [0, 1, 7], [0, 2, 7], [1, 3, 5], [2, 4, 3], [3, 5, 1]];
    for (const [rx, ry, rw] of rows) g.fillRect(x + (rx - 3.5) * p, y + (ry - 3) * p, rw * p, p);
    g.fillStyle = "#ffd0e0";
    g.fillRect(x - 2.5 * p, y - 2 * p, p, p);
  }
}
