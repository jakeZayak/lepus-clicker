// Sprite loading, recolouring and procedural fallbacks.
// Every sheet becomes { canvas, fw, fh, n } with frames stacked vertically (Terraria layout).

const META = {
  lepus: { src: "assets/sprites/lepus.png", fw: 100, fh: 76, n: 7 },
  lepus_epic: { src: "assets/sprites/lepus_epic.png", fw: 100, fh: 76, n: 7 },
  bunny: { src: "assets/sprites/bunny.png", fw: 48, fh: 40, n: 7 },
  small_lepus: { src: "assets/sprites/small_lepus.png", fw: 48, fh: 40, n: 5 },
  solar: { src: "assets/sprites/solar_lepus.png", fw: 92, fh: 66, n: 1, downsample: 8 },
  choc_egg: { src: "assets/sprites/choc_egg.png", fw: 22, fh: 28, n: 2 },
  big_egg: { src: "assets/sprites/big_egg.png" },
  small_egg: { src: "assets/sprites/small_egg.png" },
  suspicious_egg: { src: "assets/sprites/suspicious_egg.png" },
  lepus_bag: { src: "assets/sprites/lepus_bag.png" },
};

// Lepus frame layout from Consolaria's Lepus.cs: Stand1-4, Jump1 (rising), Jump2 (falling), Spawn.
export const LEPUS_FRAMES = { stand: [0, 1, 2, 3], rise: 4, fall: 5 };

export const sheets = {};

// Yard tiers: each is worth 10x the one below. scale is sprite px -> yard world units.
export const TIERS = [
  { name: "Bunny", value: 1, sheet: "bunny", scale: 1.0 },
  { name: "Lepus", value: 10, sheet: "lepus", scale: 0.62 },
  { name: "Bronze Lepus", value: 100, sheet: "lepus", ramp: "bronze", scale: 0.78 },
  { name: "Silver Lepus", value: 1000, sheet: "lepus", ramp: "silver", scale: 0.94 },
  { name: "Golden Epic Lepus", value: 10000, sheet: "lepus_epic", ramp: "gold", scale: 1.1 },
  { name: "Solar Lepus", value: 100000, sheet: "solar", scale: 1.25, glow: "rgba(255,170,40,0.55)" },
];

const RAMPS = {
  bronze: ["#2e1608", "#6e3a17", "#a8622b", "#d99556", "#f6d0a0"],
  silver: ["#23262e", "#5d6372", "#9aa2b2", "#d3d8e2", "#ffffff"],
  gold: ["#3d2600", "#8a5a00", "#d29a12", "#ffd75a", "#fff6c8"],
};

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

// Sample the centre of each 8x8 block so the upscaled Solar Lepus becomes true pixel art again.
function downsample(img, f) {
  const src = canvas(img.width, img.height);
  const sctx = src.getContext("2d");
  sctx.drawImage(img, 0, 0);
  const s = sctx.getImageData(0, 0, img.width, img.height).data;
  const w = Math.floor(img.width / f), h = Math.floor(img.height / f);
  const out = canvas(w, h);
  const octx = out.getContext("2d");
  const d = octx.createImageData(w, h);
  const half = f >> 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const si = ((y * f + half) * img.width + x * f + half) * 4, di = (y * w + x) * 4;
      for (let k = 0; k < 4; k++) d.data[di + k] = s[si + k];
    }
  octx.putImageData(d, 0, 0);
  return out;
}

// Procedural pixel bunny used when an image is missing, so nothing ever renders blank.
function fallbackSheet(fw, fh, n, color = "#f2a7c3") {
  const c = canvas(fw, fh * n);
  const g = c.getContext("2d");
  for (let i = 0; i < n; i++) {
    const oy = i * fh, bob = i % 2;
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(fw * 0.55, oy + fh * 0.68 - bob, fw * 0.3, fh * 0.24, 0, 0, Math.PI * 2);
    g.ellipse(fw * 0.3, oy + fh * 0.5 - bob, fw * 0.17, fh * 0.17, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(fw * 0.3, oy + fh * 0.1 - bob, fw * 0.08, fh * 0.32);
    g.fillRect(fw * 0.4, oy + fh * 0.08 - bob, fw * 0.08, fh * 0.32);
    g.fillStyle = "#fff";
    g.fillRect(fw * 0.82, oy + fh * 0.6 - bob, fw * 0.1, fh * 0.12);
    g.fillStyle = "#222";
    g.fillRect(fw * 0.22, oy + fh * 0.45 - bob, Math.max(1, fw * 0.05), Math.max(1, fh * 0.06));
  }
  return c;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hex(h) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
}

// Recolour the pink fur (and brown ear tips) through a metal ramp by lightness.
// Whites (eyes, tail), greys and the sunglasses keep their original colours.
function recolour(src, rampName) {
  const ramp = RAMPS[rampName].map(hex);
  const c = canvas(src.width, src.height);
  const g = c.getContext("2d");
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
    if (s < 0.14 || (h > 40 && h < 275)) continue;
    const t = Math.min(0.999, Math.max(0, (l - 0.08) / 0.86)) * (ramp.length - 1);
    const a = ramp[Math.floor(t)], b = ramp[Math.floor(t) + 1], f = t % 1;
    for (let k = 0; k < 3; k++) d[i + k] = a[k] + (b[k] - a[k]) * f;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export async function loadSprites() {
  await Promise.all(
    Object.entries(META).map(async ([key, m]) => {
      const img = await loadImage(m.src);
      let cv;
      if (img && m.downsample) cv = downsample(img, m.downsample);
      else if (img) {
        cv = canvas(img.width, img.height);
        cv.getContext("2d").drawImage(img, 0, 0);
      }
      const fw = m.fw || (img ? img.width : 32), fh = m.fh || (img ? img.height : 32), n = m.n || 1;
      if (!cv) {
        console.warn("Missing sprite, using fallback:", m.src);
        cv = fallbackSheet(fw, fh, n);
      }
      sheets[key] = slice({ canvas: cv, fw, fh, n });
    })
  );
  for (const t of TIERS) {
    const base = sheets[t.sheet];
    t.sprite = t.ramp ? slice({ ...base, canvas: recolour(base.canvas, t.ramp) }) : base;
    t.hw = t.sprite.fw * t.scale * 0.3;
    t.icon = iconURL(t.sprite, 0);
  }
}

// Cut the sheet into one canvas per frame, so rotated/scaled draws can't bleed in the neighbouring frame's edge.
function slice(sheet) {
  sheet.frames = [];
  for (let i = 0; i < sheet.n; i++) {
    const c = canvas(sheet.fw, sheet.fh);
    c.getContext("2d").drawImage(sheet.canvas, 0, i * sheet.fh, sheet.fw, sheet.fh, 0, 0, sheet.fw, sheet.fh);
    sheet.frames.push(c);
  }
  return sheet;
}

// One frame as a data URL for HTML icons (shop, legend).
export function iconURL(sheet, frame = 0) {
  return sheet.frames[frame].toDataURL();
}
