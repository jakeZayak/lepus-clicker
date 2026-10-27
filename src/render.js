// Canvas rendering: sky, the spinning Lepus with its orbiting Mothers, and the fenced yard.
import { sheets, TIERS, LEPUS_FRAMES } from "./sprites.js";
import { YARD } from "./yard.js";

const MAX_MOTHERS_SHOWN = 12;

export class Spinner {
  constructor() {
    this.angle = 0;
    this.boost = 0;
    this.squash = 0; // 1 right after a click, decays to 0
    this.texts = [];
    this.ripples = [];
    this.motherPunch = new Array(MAX_MOTHERS_SHOWN).fill(0);
    this.nextMother = 0;
  }

  click(text, big = true) {
    this.squash = 1;
    this.boost = Math.min(10, this.boost + 1.6);
    this.ripples.push({ life: 0.45 });
    this.addText(text, big);
  }

  motherClick(shown, text) {
    if (!shown) return;
    const i = this.nextMother++ % shown;
    this.motherPunch[i] = 1;
    this.squash = Math.max(this.squash, 0.45);
    this.addText(text, false, i / shown);
  }

  addText(text, big, at = Math.random()) {
    const a = at * Math.PI * 2;
    this.texts.push({ text, big, ox: Math.cos(a) * (big ? 0.25 : 0.6), oy: -0.2 + Math.sin(a) * 0.3, life: 1.1, rise: 0 });
    if (this.texts.length > 40) this.texts.shift();
  }

  update(dt) {
    this.boost *= Math.exp(-2.2 * dt);
    this.angle += (1.4 + this.boost) * dt;
    this.squash = Math.max(0, this.squash - dt * 7);
    for (const t of this.texts) (t.life -= dt), (t.rise += dt * 70);
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const r of this.ripples) r.life -= dt;
    this.ripples = this.ripples.filter((r) => r.life > 0);
    for (let i = 0; i < this.motherPunch.length; i++) this.motherPunch[i] = Math.max(0, this.motherPunch[i] - dt * 6);
  }
}

export class Renderer {
  constructor(cv) {
    this.cv = cv;
    this.ctx = cv.getContext("2d");
    this.time = 0;
    this.clouds = Array.from({ length: 5 }, (_, i) => ({ x: Math.random(), y: 0.08 + Math.random() * 0.3, s: 0.6 + Math.random() * 0.8, v: 0.004 + Math.random() * 0.006, i }));
  }

  // Lays out the yard (bottom) and spinner (above it) for the current canvas size.
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.cv.clientWidth, h = this.cv.clientHeight;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.dpr = dpr;
    this.w = w;
    this.h = h;
    const pad = w < 600 ? 8 : 16;
    let yw = w - pad * 2, yh = (yw * YARD.H) / YARD.W;
    const maxH = h * (w < 900 ? 0.42 : 0.46);
    if (yh > maxH) (yh = maxH), (yw = (yh * YARD.W) / YARD.H);
    this.yard = { x: (w - yw) / 2, y: h - yh - pad - 34, w: yw, h: yh, s: yw / YARD.W };
    const above = this.yard.y;
    this.spin = { x: w / 2, y: above * 0.52, size: Math.max(90, Math.min(above * 0.62, w * 0.42, 280)) };
    return this.spin;
  }

  toYard(sx, sy) {
    const y = this.yard;
    return { x: (sx - y.x) / y.s, y: (sy - y.y) / y.s };
  }

  draw(dt, state, yard, spinner, mothers) {
    this.time += dt;
    const g = this.ctx;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    this.drawSky(g);
    this.drawSpinner(g, spinner, mothers);
    this.drawYard(g, yard);
    this.drawTexts(g, spinner);
  }

  drawSky(g) {
    const { w, h } = this;
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#4f8fe0");
    sky.addColorStop(0.6, "#8cc3f2");
    sky.addColorStop(1, "#c9e6fa");
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.85)";
    for (const c of this.clouds) {
      c.x = (c.x + c.v * 0.016) % 1.2;
      const cx = (c.x - 0.1) * w, cy = c.y * h, s = c.s * Math.max(40, w * 0.05);
      const px = Math.max(3, Math.round(s / 8));
      for (const [dx, dy, bw, bh] of [[0, 0, 4, 2], [1, -1, 2, 1], [-1, 1, 6, 1]]) g.fillRect(Math.round(cx + dx * px), Math.round(cy + dy * px), bw * px, bh * px);
    }
    // Distant hills behind the yard.
    const y0 = this.yard.y + this.yard.h * 0.35;
    g.fillStyle = "#6fae6a";
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, y0 - 30 - Math.sin(x * 0.006) * 26 - Math.sin(x * 0.017 + 1) * 10);
    g.lineTo(w, h);
    g.fill();
    g.fillStyle = "#4f8f4d";
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, y0 + 4 - Math.sin(x * 0.009 + 2) * 18);
    g.lineTo(w, h);
    g.fill();
  }

  drawSheet(g, sheet, frame, x, y, scale, flip = false, sx = 1, sy = 1, rot = 0) {
    const w = sheet.fw * scale, h = sheet.fh * scale;
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.scale((flip ? -1 : 1) * sx, sy);
    g.drawImage(sheet.frames[frame], -w / 2, -h / 2, w, h);
    g.restore();
  }

  drawSpinner(g, sp, mothers) {
    const { x, y, size } = this.spin;
    const lepus = sheets.lepus, scale = size / lepus.fw;
    const halo = g.createRadialGradient(x, y, size * 0.1, x, y, size * 0.8);
    halo.addColorStop(0, "rgba(255,190,225,0.75)");
    halo.addColorStop(1, "rgba(255,190,225,0)");
    g.fillStyle = halo;
    g.fillRect(x - size, y - size, size * 2, size * 2);
    for (const r of sp.ripples) {
      const k = 1 - r.life / 0.45;
      g.strokeStyle = `rgba(255,255,255,${0.8 * (1 - k)})`;
      g.lineWidth = 4 * (1 - k) + 1;
      g.beginPath();
      g.arc(x, y, size * (0.45 + k * 0.5), 0, Math.PI * 2);
      g.stroke();
    }
    // Mother Lepuses orbit the spinner and lunge inward when they auto-click.
    const shown = Math.min(MAX_MOTHERS_SHOWN, mothers);
    const ml = sheets.small_lepus, ms = Math.max(1, (size / 150) * 1.1);
    for (let i = 0; i < shown; i++) {
      const a = this.time * 0.5 + (i / shown) * Math.PI * 2;
      const r = size * (0.78 - 0.18 * sp.motherPunch[i]);
      const mx = x + Math.cos(a) * r, my = y + Math.sin(a) * r * 0.8;
      this.drawSheet(g, ml, Math.floor(this.time * 8 + i) % ml.n, mx, my, ms, Math.cos(a) > 0);
    }
    const k = sp.squash;
    const frame = LEPUS_FRAMES.stand[Math.floor(this.time * 7) % 4];
    this.drawSheet(g, lepus, frame, x, y, scale, false, 1 + 0.16 * k, 1 - 0.16 * k, sp.angle);
  }

  drawYard(g, yard) {
    const Y = this.yard, s = Y.s;
    const sx = (wx) => Y.x + wx * s, sy = (wy) => Y.y + wy * s;
    // Ground: grass strip over dirt.
    const gy = sy(YARD.GROUND);
    g.fillStyle = "#7a4a26";
    g.fillRect(Y.x, gy, Y.w, Y.h - (gy - Y.y) + 34);
    g.fillStyle = "#5c3518";
    for (let i = 0; i < 40; i++) g.fillRect(Y.x + ((i * 97) % Y.w), gy + 10 + ((i * 53) % 24), 4, 4);
    g.fillStyle = "#3f9c3a";
    g.fillRect(Y.x, gy - 2, Y.w, 8);
    g.fillStyle = "#5fc24f";
    g.fillRect(Y.x, gy - 2, Y.w, 3);

    // Back fence rail.
    this.drawFence(g, Y, sx, sy, false);

    // Entities, big tiers behind small ones, with ground shadows.
    const ents = [...yard.ents].sort((a, b) => b.tier - a.tier);
    for (const e of ents) {
      const T = TIERS[e.tier], sh = T.sprite;
      const sc = T.scale * s;
      if (e.alpha > 0.3) {
        const air = Math.max(0, YARD.GROUND - e.y);
        g.fillStyle = `rgba(0,0,0,${0.22 * Math.max(0, 1 - air / 220) * e.alpha})`;
        g.beginPath();
        g.ellipse(sx(e.x), gy + 1, sh.fw * sc * 0.32, 4 * s + 2, 0, 0, Math.PI * 2);
        g.fill();
      }
      let frame = 0, ssx = 1, ssy = 1;
      if (sh.n === 7 && T.sheet !== "bunny") {
        frame = e.ground ? LEPUS_FRAMES.stand[Math.floor(e.anim * 6) % 4] : e.vy < 0 ? LEPUS_FRAMES.rise : LEPUS_FRAMES.fall;
      } else if (T.sheet === "bunny") {
        frame = e.ground ? (Math.abs(e.vx) > 20 ? 1 + (Math.floor(e.anim * 12) % 6) : 0) : 1;
      } else if (!e.ground) {
        ssx = 0.92;
        ssy = 1.1;
      }
      ssx *= 1 + 0.2 * e.land;
      ssy *= 1 - 0.2 * e.land;
      const pop = e.pop < 1 ? Math.sin(e.pop * Math.PI * 0.5) * (1 + 0.25 * Math.sin(e.pop * Math.PI)) : e.pop;
      const h = sh.fh * sc;
      g.globalAlpha = e.alpha;
      if (T.glow) {
        const cx = sx(e.x), cy = sy(e.y) - h * 0.45;
        const gl = g.createRadialGradient(cx, cy, 2, cx, cy, h * 0.9);
        gl.addColorStop(0, T.glow);
        gl.addColorStop(1, "rgba(255,170,40,0)");
        g.fillStyle = gl;
        g.fillRect(cx - h, cy - h, h * 2, h * 2);
      }
      // Sprites face left; flip when hopping right. Anchor at the feet.
      this.drawSheet(g, sh, frame, sx(e.x), sy(e.y) - (h / 2) * ssy * pop, sc * pop, e.face > 0, ssx, ssy);
      g.globalAlpha = 1;
    }

    // Particles.
    for (const p of yard.parts) {
      const a = Math.max(0, p.life / p.max);
      if (p.ring) {
        g.strokeStyle = `rgba(255,236,120,${a})`;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(sx(p.x), sy(p.y), (1 - a) * 90 * s + 4, 0, Math.PI * 2);
        g.stroke();
        continue;
      }
      g.globalAlpha = a;
      g.fillStyle = p.color;
      const z = p.size * Math.max(1, s * 1.4);
      g.fillRect(sx(p.x) - z / 2, sy(p.y) - z / 2, z, z);
    }
    g.globalAlpha = 1;

    this.drawFence(g, Y, sx, sy, true);
  }

  // Wooden fence: back rails behind the Lepuses, posts + front rail in front.
  drawFence(g, Y, sx, sy, front) {
    const s = Y.s, top = sy(YARD.GROUND - 46), gy = sy(YARD.GROUND);
    const pw = Math.max(6, 12 * s);
    if (!front) {
      g.fillStyle = "#8a5a2b";
      g.fillRect(sx(YARD.FENCE_L), top + 6 * s, Y.w - 2 * YARD.FENCE_L * s, 6 * s);
      return;
    }
    g.fillStyle = "#a8743c";
    g.fillRect(sx(YARD.FENCE_L) - pw / 2, sy(YARD.GROUND - 20), Y.w - 2 * YARD.FENCE_L * s + pw, 6 * s);
    g.fillStyle = "#6b4220";
    g.fillRect(sx(YARD.FENCE_L) - pw / 2, sy(YARD.GROUND - 20) + 6 * s - 2, Y.w - 2 * YARD.FENCE_L * s + pw, 2);
    const posts = Math.max(6, Math.round(Y.w / 90));
    for (let i = 0; i <= posts; i++) {
      const wx = YARD.FENCE_L + ((YARD.FENCE_R - YARD.FENCE_L) * i) / posts;
      const x = sx(wx) - pw / 2;
      const tall = i === 0 || i === posts;
      const pt = tall ? sy(YARD.GROUND - 120) : top;
      g.fillStyle = "#9b6a35";
      g.fillRect(x, pt, pw, gy - pt + 4);
      g.fillStyle = "#c08a4e";
      g.fillRect(x, pt, Math.max(2, pw * 0.3), gy - pt + 4);
      g.fillStyle = "#5a3818";
      g.fillRect(x, pt, pw, Math.max(2, 3 * s));
    }
  }

  drawTexts(g, sp) {
    const { x, y, size } = this.spin;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const t of sp.texts) {
      const a = Math.min(1, t.life / 0.4);
      const fs = t.big ? Math.max(18, size * 0.14) : Math.max(13, size * 0.085);
      g.font = `700 ${fs}px "Pixelify Sans", monospace`;
      g.globalAlpha = a;
      g.lineWidth = Math.max(3, fs * 0.22);
      g.strokeStyle = "#2a0f1e";
      const tx = x + t.ox * size, ty = y + t.oy * size - t.rise;
      g.strokeText(t.text, tx, ty);
      g.fillStyle = t.big ? "#ffe066" : "#ffd0e6";
      g.fillText(t.text, tx, ty);
    }
    g.globalAlpha = 1;
  }
}
