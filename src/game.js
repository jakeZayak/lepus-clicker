// Game state and economy. Buildings cost base * 1.15^owned; one-shot upgrades are bought once.

export const MOTHER_INTERVAL = 3; // seconds between each Mother Lepus auto-click
export const COST_GROWTH = 1.15;
export const OFFLINE_CAP = 8 * 3600;

export const UPGRADES = [
  { id: "egg", name: "Infinite Egg", kind: "once", cost: 10, icon: "suspicious_egg", desc: "Doubles Lepus per click." },
  { id: "mother", name: "Mother Lepus", kind: "building", cost: 50, icon: "small_lepus", desc: `Auto-clicks the big Lepus every ${MOTHER_INTERVAL} s.` },
  { id: "tripler", name: "Ultra Lepus Tripler", kind: "once", cost: 250, icon: "big_egg", desc: "Triples Lepus per click." },
  { id: "burrow", name: "Lepus Burrow", kind: "building", cost: 500, lps: 8, icon: "lepus_bag", desc: "+8 Lepus per second." },
  { id: "golden", name: "Golden Egg", kind: "once", cost: 2000, icon: "choc_egg", iconFrame: 1, desc: "Doubles all Lepus per second." },
  { id: "feast", name: "Easter Feast", kind: "building", cost: 6000, lps: 50, icon: "choc_egg", desc: "+50 Lepus per second." },
  { id: "hatchery", name: "Diseaster Hatchery", kind: "building", cost: 40000, lps: 260, icon: "small_egg", desc: "+260 Lepus per second." },
  { id: "shrine", name: "Solar Lepus Shrine", kind: "building", cost: 300000, lps: 1600, icon: "solar", desc: "+1,600 Lepus per second." },
  { id: "moonlit", name: "Moonlit Egg", kind: "once", cost: 1000000, icon: "big_egg", iconTint: "moon", desc: "Clicks also earn 1% of your Lepus per second." },
];

export function newState() {
  return { balance: 0, lifetime: 0, clicks: 0, owned: {}, revealed: {}, motherAcc: 0, musicOn: true, sfxOn: true, savedAt: Date.now() };
}

export const owned = (s, id) => s.owned[id] || 0;

export function costOf(s, u) {
  return u.kind === "once" ? u.cost : Math.ceil(u.cost * Math.pow(COST_GROWTH, owned(s, u.id)));
}

const lpsMult = (s) => (owned(s, "golden") ? 2 : 1);

export function buildingLps(s) {
  let l = 0;
  for (const u of UPGRADES) if (u.lps) l += u.lps * owned(s, u.id);
  return l * lpsMult(s);
}

export function clickValue(s) {
  let v = 1;
  if (owned(s, "egg")) v *= 2;
  if (owned(s, "tripler")) v *= 3;
  if (owned(s, "moonlit")) v += buildingLps(s) * 0.01;
  return v;
}

export const motherClickValue = (s) => clickValue(s) * lpsMult(s);

export function totalLps(s) {
  return buildingLps(s) + (owned(s, "mother") * motherClickValue(s)) / MOTHER_INTERVAL;
}

export function earn(s, n) {
  s.balance += n;
  s.lifetime += n;
}

export function canBuy(s, u) {
  return !(u.kind === "once" && owned(s, u.id)) && s.balance >= costOf(s, u);
}

export function buy(s, u) {
  if (!canBuy(s, u)) return false;
  s.balance -= costOf(s, u);
  s.owned[u.id] = owned(s, u.id) + 1;
  return true;
}

// Advances income by dt seconds. Returns how many Mother auto-clicks fired (for visuals).
export function tick(s, dt) {
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

// Upgrades appear once you've earned half their base cost; returns newly revealed ones.
export function reveal(s) {
  const fresh = [];
  for (const u of UPGRADES)
    if (!s.revealed[u.id] && (s.lifetime >= u.cost * 0.5 || owned(s, u.id))) {
      s.revealed[u.id] = true;
      fresh.push(u);
    }
  return fresh;
}

const BIG = ["million", "billion", "trillion", "quadrillion", "quintillion", "sextillion", "septillion"];

export function fmt(n) {
  n = Math.floor(n);
  if (n < 1e6) return n.toLocaleString("en-US");
  const e = Math.min(BIG.length - 1, Math.floor(Math.log10(n) / 3) - 2);
  return (n / Math.pow(1000, e + 2)).toFixed(3) + " " + BIG[e];
}

export function fmtRate(n) {
  return n < 100 ? (Math.round(n * 10) / 10).toLocaleString("en-US", { minimumFractionDigits: 1 }) : fmt(n);
}
