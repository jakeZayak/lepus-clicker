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
  // Lepzilla from the QuadEyes Terraria mod (the Lepus sprite in charcoal with crystal spikes), stored at 2x.
  lepuszilla: { src: "assets/sprites/lepuszilla.png", fw: 46, fh: 34, n: 1, downsample: 2 },
};

// Lepus frame layout from Consolaria's Lepus.cs: Stand1-4, Jump1 (rising), Jump2 (falling), Spawn.
export const LEPUS_FRAMES = { stand: [0, 1, 2, 3], rise: 4, fall: 5 };

export const sheets = {};

// Yard tiers: tier t is worth 10^t. Each is a real Lepus sprite recoloured through a ramp,
// optionally with a glow, sparkles or transparency. Size comes from the yard's 5-tier window.
const T = (name, sheet, ramp, fx = {}) => ({ name, sheet, ramp, ...fx });
export const TIERS = [
  T("Bunny", "bunny"),
  T("Lepus", "lepus"),
  T("Bronze Lepus", "lepus", "bronze"),
  T("Silver Lepus", "lepus", "silver"),
  T("Golden Epic Lepus", "lepus_epic", "gold"),
  T("Solar Lepus", "solar", null, { glow: "255,170,40" }),
  T("Emerald Lepus", "lepus", "emerald"),
  T("Sapphire Epic Lepus", "lepus_epic", "sapphire"),
  T("Amethyst Lepus", "lepus", "amethyst"),
  T("Ruby Epic Lepus", "lepus_epic", "ruby"),
  T("Diamond Lepus", "lepus", "diamond", { glow: "190,240,255" }),
  T("Obsidian Epic Lepus", "lepus_epic", "obsidian", { glow: "150,60,255" }),
  T("Frost Lepus", "lepus", "frost", { glow: "160,220,255", sparkle: "#e8fbff" }),
  T("Inferno Lepus", "solar", "inferno", { glow: "255,80,20", sparkle: "#ffb040" }),
  T("Hallowed Lepus", "lepus", "hallowed", { glow: "255,240,170", sparkle: "#fff6a0" }),
  T("Chlorophyte Epic Lepus", "lepus_epic", "chlorophyte", { glow: "90,255,90", sparkle: "#b6ff9a" }),
  T("Shroomite Lepus", "lepus", "shroomite", { glow: "60,120,255", sparkle: "#8fb4ff" }),
  T("Spectre Lepus", "lepus", "spectre", { glow: "120,200,255", sparkle: "#d6f0ff", alpha: 0.72 }),
  T("Lunar Epic Lepus", "lepus_epic", "lunar", { glow: "120,255,220", sparkle: "#c6fff0" }),
  T("Nebula Lepus", "solar", "nebula", { glow: "255,60,200", sparkle: "#ff9ae6" }),
  T("Stardust Lepus", "lepus", "stardust", { glow: "90,180,255", sparkle: "#ffffff" }),
  T("Vortex Lepus", "lepus", "vortex", { glow: "40,255,190", sparkle: "#9affe0" }),
  T("Solar Flare Lepus", "solar", "flare", { glow: "255,140,0", sparkle: "#ffe066" }),
  T("Celestial Epic Lepus", "lepus_epic", "celestial", { glow: "255,255,255", sparkle: "#ffffff" }),
  T("Rainbow Lepus", "lepus", "rainbow", { glow: "255,180,255", sparkle: "#ffffff" }),
  T("Shadow Epic Lepus", "lepus_epic", "shadow", { glow: "90,0,140", sparkle: "#b080ff" }),
  T("Cosmic Lepus", "solar", "cosmic", { glow: "140,90,255", sparkle: "#ffffff" }),
  T("Galaxy Lepus", "lepus", "galaxy", { glow: "255,120,255", sparkle: "#fff0a0" }),
  T("Eternal Epic Lepus", "lepus_epic", "eternal", { glow: "255,230,140", sparkle: "#ffffff" }),
  T("Omega Lepus", "solar", "omega", { glow: "255,40,80", sparkle: "#ffffff" }),
  T("Lepus Supreme", "lepus_epic", "supreme", { glow: "255,215,90", sparkle: "#ffffff" }),
  T("Lepuszilla", "lepuszilla", null, { glow: "240,80,214", sparkle: "#ffaaf4", zilla: true }),
];
TIERS.forEach((t, i) => (t.value = Math.pow(10, i)));

// Sprite px -> yard world units at window scale 1, per base sheet.
export const SHEET_FIT = { bunny: 1.55, lepus: 1, lepus_epic: 1, solar: 1.05, lepuszilla: 5.5 };

const RAMPS = {
  bronze: ["#2e1608", "#6e3a17", "#a8622b", "#d99556", "#f6d0a0"],
  silver: ["#23262e", "#5d6372", "#9aa2b2", "#d3d8e2", "#ffffff"],
  gold: ["#3d2600", "#8a5a00", "#d29a12", "#ffd75a", "#fff6c8"],
  emerald: ["#032a14", "#0b6b34", "#1fae5a", "#6fe39a", "#d8ffe6"],
  sapphire: ["#06123d", "#123a9c", "#2f6fe0", "#7fb2ff", "#e2eeff"],
  amethyst: ["#22083a", "#5a1f8f", "#9150d6", "#c79bf5", "#f3e6ff"],
  ruby: ["#3a0410", "#8f0f2b", "#d82a4c", "#ff7f95", "#ffe0e6"],
  diamond: ["#1d3a4a", "#4f9bb8", "#9fe3f5", "#dcfaff", "#ffffff"],
  obsidian: ["#07040c", "#1d1230", "#3b2463", "#6a46a8", "#b9a2e8"],
  frost: ["#0d2a4a", "#3d7fc0", "#8fd0ff", "#d8f3ff", "#ffffff"],
  inferno: ["#2a0500", "#8a1a00", "#e04a00", "#ffa030", "#fff0b0"],
  hallowed: ["#4a3a10", "#b0902a", "#f0d860", "#fff4b0", "#ffffff"],
  chlorophyte: ["#0a2a08", "#2a7a1a", "#5ad13a", "#b6ff9a", "#f0ffe8"],
  shroomite: ["#050c3a", "#1430a0", "#3a6cff", "#8fb4ff", "#e8f0ff"],
  spectre: ["#0e2236", "#3a6e9a", "#7fbde8", "#cdeaff", "#ffffff"],
  lunar: ["#08302a", "#16806e", "#3ae0c0", "#a6fff0", "#f0fffc"],
  nebula: ["#2a0430", "#8a1488", "#e03ac8", "#ff9ae6", "#fff0fb"],
  stardust: ["#0a1a40", "#2a5ab0", "#5aa8ff", "#c0e4ff", "#ffffff"],
  vortex: ["#022a22", "#0a7a60", "#1ae0a8", "#9affe0", "#f0fff9"],
  flare: ["#3a1000", "#c04000", "#ff8a00", "#ffd040", "#fffbe0"],
  celestial: ["#3a3a5a", "#8a8ac0", "#d0d0ff", "#f4f4ff", "#ffffff"],
  rainbow: ["#e0203a", "#ff9a20", "#f0e040", "#40d070", "#4a90ff"],
  shadow: ["#000000", "#140022", "#3a0a5a", "#6a2a9a", "#a070d0"],
  cosmic: ["#0a0420", "#2a1470", "#6a3ae0", "#c0a0ff", "#ffffff"],
  galaxy: ["#14002a", "#6a0a8a", "#e03ab0", "#ffb0e0", "#fff6c0"],
  eternal: ["#3a2a0a", "#a07a20", "#f0d070", "#fff6d0", "#ffffff"],
  omega: ["#2a0008", "#900020", "#ff2050", "#ffa0b0", "#ffffff"],
  supreme: ["#3a2400", "#c08000", "#ffd040", "#ffffff", "#ffe6ff"],
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
function recolour(src, rampName, hueMax = 40) {
  const ramp = RAMPS[rampName].map(hex);
  const c = canvas(src.width, src.height);
  const g = c.getContext("2d");
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
    if (s < 0.14 || (h > hueMax && h < 275)) continue;
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
    t.sprite = t.ramp ? slice({ ...base, canvas: recolour(base.canvas, t.ramp, t.sheet === "solar" ? 65 : 40) }) : base;
    t.fit = SHEET_FIT[t.sheet];
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
