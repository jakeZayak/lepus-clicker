// Game state and economy, tuned (via a greedy-buyer simulation) to reach ~10^30 in about
// 8 days of continuous play. Buildings cost base * 1.15^owned; each later building costs
// 25x the previous and earns 12x as much. Upgrades double one building or everything.

export const MOTHER_INTERVAL = 3; // seconds between each Mother Lepus auto-click
export const COST_GROWTH = 1.15;
export const OFFLINE_CAP = 8 * 3600;

// Lepus Pen: happiness (0-100) boosts Lepus per second and drains over HAPPY_DRAIN seconds;
// feeding doubles income for FED_TIME seconds.
export const HAPPY_BONUS = 0.25; // at 100% happiness, before Pen upgrades
export const HAPPY_DRAIN = 20 * 60;
export const FED_TIME = 60, FED_MULT = 2, FEED_COOLDOWN = 5 * 60;
export const EGG_COOLDOWN = 20, ROAR_COOLDOWN = 6;
export const ZILLA_TIER = 31; // the yard tier where Lepuszilla shows up (10^31 Lepus)

const nice = (x) => {
  const p = Math.pow(10, Math.floor(Math.log10(x)) - 1);
  return Math.round(x / p) * p;
};

// [id, name, icon sprite, icon hue-rotate degrees]
const LATER_BUILDINGS = [
  ["carrots", "Carrot Plantation", "lepus_bag", 70],
  ["chocfactory", "Chocolate Egg Factory", "choc_egg", 0],
  ["castle", "Bunny Bounce Castle", "lepus", 200],
  ["ranch", "Jackalope Ranch", "small_lepus", 30],
  ["lab", "Lepus Cloning Lab", "big_egg", 120],
  ["island", "Easter Island Warren", "small_egg", 260],
  ["express", "Bunny Express", "lepus_bag", 180],
  ["skywarren", "Sky Island Warren", "lepus", 140],
  ["moonwarren", "Moon Warren", "suspicious_egg", 200],
  ["station", "Lepus Space Station", "lepus_epic", 160],
  ["hutch", "Galactic Hutch", "small_lepus", 250],
  ["wormhole", "Wormhole Burrow", "big_egg", 280],
  ["starforge", "Eggstar Forge", "choc_egg", 300],
  ["bunniverse", "Bunniverse", "solar", 220],
  ["engine", "Infinite Carrot Engine", "lepus_bag", 320],
  ["singularity", "The Lepus Singularity", "solar", 120],
  ["nursery", "Nebula Nursery", "small_egg", 300],
  ["quasar", "Quasar Carrot Farm", "lepus_bag", 260],
  ["nest", "Lepuszilla Nest", "lepuszilla", 0],
  ["hyperhop", "Hyper Hop Drive", "lepus_epic", 40],
  ["meadow", "Multiverse Meadow", "bunny", 90],
  ["eggsistential", "Eggsistential Engine", "big_egg", 200],
  ["omegaburrow", "Omega Burrow", "lepus_bag", 330],
  ["ascension", "Lepus Ascension", "lepus_epic", 180],
];

export const BUILDINGS = [
  { id: "mother", name: "Mother Lepus", cost: 50, mother: true, icon: "small_lepus", desc: `Auto-clicks the big Lepus every ${MOTHER_INTERVAL} s.` },
  { id: "burrow", name: "Lepus Burrow", cost: 500, lps: 8, icon: "lepus_bag" },
  { id: "feast", name: "Easter Feast", cost: 6000, lps: 50, icon: "choc_egg" },
  { id: "hatchery", name: "Diseaster Hatchery", cost: 40000, lps: 260, icon: "small_egg" },
  { id: "shrine", name: "Solar Lepus Shrine", cost: 300000, lps: 1600, icon: "solar" },
];
for (const [id, name, icon, hue] of LATER_BUILDINGS) {
  const prev = BUILDINGS[BUILDINGS.length - 1];
  BUILDINGS.push({ id, name, icon, hue, cost: nice(prev.cost * 25), lps: nice(prev.lps * 12) });
}

// Per-building doublers unlock at these owned counts, priced at a multiple of the building's base cost.
const GRADES = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ruby", "Cosmic", "Infinite"];
const GRADE_AT = [1, 10, 25, 50, 100, 150, 200, 250];
const GRADE_COST = [10, 50, 500, 5e4, 5e6, 5e8, 5e10, 5e12];
export const GRADE_COLORS = ["#cd7f32", "#c8ccd6", "#ffd75a", "#9be7ff", "#b9f2ff", "#ff5a7a", "#b07cff", "#ffffff"];

const EGG_NAMES = ["Golden Egg", "Ruby Egg", "Emerald Egg", "Sapphire Egg", "Amethyst Egg", "Diamond Egg", "Lunar Egg", "Nebula Egg", "Cosmic Egg", "Eternal Egg", "Quasar Egg", "Void Egg", "Kaiju Egg", "Omega Egg", "Ascended Egg"];
// Click scaling: Paws multiply the click; Carrots add a share of Lepus per second to every click,
// so tapping keeps pace with the buildings all game long.
const PAWS = [
  ["Fuzzy Paws", 1000, 2], ["Springy Paws", 2e4, 2], ["Golden Paws", 5e5, 3], ["Ruby Paws", 1e7, 2], ["Diamond Paws", 5e8, 3],
  ["Lunar Paws", 5e10, 2], ["Nebula Paws", 5e12, 3], ["Cosmic Paws", 5e14, 2], ["Eternal Paws", 5e16, 3], ["Supreme Paws", 5e18, 5],
  ["Quasar Paws", 5e20, 2], ["Void Paws", 5e22, 3], ["Kaiju Paws", 5e24, 2], ["Omega Paws", 5e26, 3], ["Ascended Paws", 5e28, 5],
];
const CARROTS = [
  ["Crunchy Carrot", 1e6, 0.01], ["Star Carrot", 1e8, 0.01], ["Sky Carrot", 1e10, 0.01], ["Lunar Carrot", 1e12, 0.02], ["Nebula Carrot", 1e14, 0.02],
  ["Vortex Carrot", 1e16, 0.02], ["Cosmic Carrot", 1e18, 0.02], ["Galaxy Carrot", 1e20, 0.02], ["Eternal Carrot", 1e22, 0.02], ["Supreme Carrot", 1e24, 0.02],
  ["Quasar Carrot", 1e26, 0.02], ["Void Carrot", 1e28, 0.02], ["Kaiju Carrot", 1e30, 0.03], ["Omega Carrot", 1e32, 0.03], ["Ascended Carrot", 1e34, 0.05],
];
// Pen upgrades: each raises how much happiness can add to Lepus per second.
const PEN_UPS = [
  ["Soft Brush", 500, "brush"], ["Carrot Treats", 5e4, "treats"], ["Cozy Hay Bed", 5e6, "hay"], ["Lepus Spa", 5e9, "spa"],
  ["Bouncy Castle Pen", 5e13, "castle"], ["Royal Pillows", 5e18, "pillows"], ["Rainbow Meadow", 5e24, "meadow"],
];
const pct = (x) => `${Math.round(x * 100)}%`;

export const UPGRADES = [
  { id: "egg", name: "Infinite Egg", cost: 10, click: 2, icon: "suspicious_egg", desc: "Doubles Lepus per click." },
  { id: "tripler", name: "Ultra Lepus Tripler", cost: 250, click: 3, icon: "big_egg", desc: "Triples Lepus per click." },
  { id: "moonlit", name: "Moonlit Egg", cost: 25000, clickLps: 0.01, icon: "big_egg", hue: 190, desc: "Clicks also earn 1% of your Lepus per second." },
];
PAWS.forEach(([name, cost, x], k) =>
  UPGRADES.push({ id: `paw${k}`, name, cost, click: x, icon: "bunny", hue: k * 36, desc: x === 2 ? "Doubles Lepus per click." : `Lepus per click ×${x}.` })
);
CARROTS.forEach(([name, cost, share], k) =>
  UPGRADES.push({ id: `carrot${k}`, name, cost, clickLps: share, icon: "lepus_bag", hue: 40 * k, desc: `Clicks also earn ${pct(share)} of your Lepus per second.` })
);
PEN_UPS.forEach(([name, cost, id], k) =>
  UPGRADES.push({ id: `pen_${id}`, name, cost, happy: 0.25, icon: "small_lepus", hue: k * 50, desc: "Happy Pen Lepuses give +25% more Lepus per second." })
);
// Lepuszilla's gifts unlock only once Lepuszilla has stomped into your yard.
UPGRADES.push(
  { id: "zilla_carrot", name: "Radioactive Carrot", cost: 1e32, global: 10, needTier: ZILLA_TIER, icon: "lepuszilla", hue: 90, desc: "Lepuszilla's snack. All Lepus per second ×10." },
  { id: "zilla_spikes", name: "Crystal Spikes", cost: 5e32, click: 10, needTier: ZILLA_TIER, icon: "lepuszilla", desc: "Lepus per click ×10." },
  { id: "zilla_roar", name: "Mega Roar", cost: 2e33, roar: 10, needTier: ZILLA_TIER, icon: "lepuszilla", hue: 200, desc: "Poking Lepuszilla in the Pen pays 10× more." },
  { id: "zilla_heart", name: "Lepuszilla's Heart", cost: 1e35, global: 10, needTier: ZILLA_TIER, icon: "lepuszilla", hue: 300, desc: "Lepuszilla loves you. All Lepus per second ×10." },
);
// The first egg keeps its old id so existing saves carry over.
EGG_NAMES.forEach((name, k) =>
  UPGRADES.push({ id: k ? `egg_g${k}` : "golden", name, cost: 2000 * Math.pow(1000, k), global: 2, icon: "choc_egg", iconFrame: 1, hue: k * 36, desc: "Doubles all Lepus per second." })
);
for (const b of BUILDINGS)
  GRADES.forEach((grade, k) =>
    UPGRADES.push({
      id: `${b.id}_${k}`,
      name: `${grade} ${b.name}`,
      cost: nice(b.cost * GRADE_COST[k]),
      building: b.id,
      need: GRADE_AT[k],
      grade: k,
      icon: b.icon,
      hue: b.hue,
      desc: b.mother ? "Mother Lepuses click twice as hard." : `${b.name}s earn twice as much.`,
    })
  );
UPGRADES.sort((a, b) => a.cost - b.cost);

export function newState() {
  return {
    balance: 0, lifetime: 0, clicks: 0, owned: {}, revealed: {}, motherAcc: 0, buyAmount: 1, musicOn: true, sfxOn: true, savedAt: Date.now(),
    happy: 0, fedUntil: 0, fedAt: 0, eggAt: 0, maxTier: 0, zillaSeen: false,
  };
}

export const owned = (s, id) => s.owned[id] || 0;

// Derived multipliers, recomputed only after a purchase (s._v changes).
let cacheV = -1, cacheS = null, cache = null;
function derived(s) {
  if (cacheS === s && cacheV === s._v && cache) return cache;
  const d = { click: 1, clickLps: 0, global: 1, mult: {}, happy: HAPPY_BONUS, roar: 1 };
  for (const u of UPGRADES) {
    if (!owned(s, u.id)) continue;
    if (u.click) d.click *= u.click;
    if (u.clickLps) d.clickLps += u.clickLps;
    if (u.global) d.global *= u.global;
    if (u.happy) d.happy += u.happy;
    if (u.roar) d.roar *= u.roar;
    if (u.building) d.mult[u.building] = (d.mult[u.building] || 1) * 2;
  }
  d.buildingLps = 0;
  for (const b of BUILDINGS) if (b.lps) d.buildingLps += b.lps * owned(s, b.id) * (d.mult[b.id] || 1);
  d.buildingLps *= d.global;
  cacheS = s;
  cacheV = s._v;
  cache = d;
  return d;
}

// Pen bonuses change over time, so they sit outside the purchase cache.
export const happyCap = (s) => derived(s).happy;
export const happyBonus = (s) => (derived(s).happy * (s.happy || 0)) / 100;
export const isFed = (s) => Date.now() < (s.fedUntil || 0);
export const penBoost = (s) => (1 + happyBonus(s)) * (isFed(s) ? FED_MULT : 1);
export const roarMult = (s) => derived(s).roar;

export const buildingLps = (s) => derived(s).buildingLps * penBoost(s);
export const clickValue = (s) => derived(s).click + buildingLps(s) * derived(s).clickLps;
export const motherClickValue = (s) => clickValue(s) * derived(s).global * (derived(s).mult.mother || 1);
export const totalLps = (s) => buildingLps(s) + (owned(s, "mother") * motherClickValue(s)) / MOTHER_INTERVAL;

// What one building of this type adds per second right now (for the shop text).
export function eachLps(s, b) {
  const d = derived(s);
  return b.mother ? motherClickValue(s) / MOTHER_INTERVAL : b.lps * (d.mult[b.id] || 1) * d.global * penBoost(s);
}

// Cost of the next n buildings: geometric series of base * 1.15^owned.
export function buildingCost(s, b, n = 1) {
  const g = COST_GROWTH, o = owned(s, b.id);
  return Math.ceil((b.cost * Math.pow(g, o) * (Math.pow(g, n) - 1)) / (g - 1));
}

export function earn(s, n) {
  s.balance += n;
  s.lifetime += n;
}

export function upgradeAvailable(s, u) {
  if (owned(s, u.id)) return false;
  if (u.needTier && (s.maxTier || 0) < u.needTier) return false;
  return u.building ? owned(s, u.building) >= u.need : s.lifetime >= u.cost * 0.5;
}

export function buyBuilding(s, b, n = 1) {
  const c = buildingCost(s, b, n);
  if (s.balance < c) return false;
  s.balance -= c;
  s.owned[b.id] = owned(s, b.id) + n;
  s._v = (s._v || 0) + 1;
  return true;
}

export function buyUpgrade(s, u) {
  if (!upgradeAvailable(s, u) || s.balance < u.cost) return false;
  s.balance -= u.cost;
  s.owned[u.id] = 1;
  s._v = (s._v || 0) + 1;
  return true;
}

// Advances income by dt seconds. Returns how many Mother auto-clicks fired (for visuals).
export function tick(s, dt) {
  s.happy = Math.max(0, (s.happy || 0) - (dt * 100) / HAPPY_DRAIN);
  earn(s, buildingLps(s) * dt);
  const mothers = owned(s, "mother");
  if (!mothers) return 0;
  s.motherAcc += (dt * mothers) / MOTHER_INTERVAL;
  const fired = Math.floor(s.motherAcc);
  if (fired) {
    s.motherAcc -= fired;
    earn(s, fired * motherClickValue(s));
  }
  return fired;
}

// Buildings appear once you've earned half their base cost; returns newly revealed ones.
export function reveal(s) {
  const fresh = [];
  for (const b of BUILDINGS)
    if (!s.revealed[b.id] && (s.lifetime >= b.cost * 0.5 || owned(s, b.id))) {
      s.revealed[b.id] = true;
      fresh.push(b);
    }
  return fresh;
}

// Scientific notation from a million up: 1.234e6, 5.000e21...
function sci(n, digits) {
  const [m, e] = n.toExponential(digits).split("e");
  return `${m}e${Number(e)}`;
}

export function fmt(n) {
  n = Math.floor(n);
  if (n < 1e6) return n.toLocaleString("en-US");
  return sci(n, 3);
}

// Compact form for small labels: 999, 1.5K, 250K, 1.5e6...
export function fmtShort(n) {
  if (n < 1000) return String(Math.floor(n));
  if (n < 1e6) {
    const v = n / 1000;
    return (v < 10 ? +v.toFixed(1) : Math.floor(v)) + "K";
  }
  return sci(n, 1);
}

export function fmtRate(n) {
  return n < 100 ? (Math.round(n * 10) / 10).toLocaleString("en-US", { minimumFractionDigits: 1 }) : fmt(n);
}
