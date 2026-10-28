// Lepus Clicker: boot, input, HUD/shop DOM and the requestAnimationFrame loop.
import { loadSprites, sheets, TIERS, iconURL } from "./sprites.js";
import * as G from "./game.js";
import { Yard, topCount, topTier, windowLo, TOP_SHOWN } from "./yard.js";
import { Pen } from "./pen.js";
import { Renderer, Spinner } from "./render.js";
import { Sound } from "./audio.js";
import * as Save from "./save.js";

const $ = (id) => document.getElementById(id);
const cv = $("cv"), spinBtn = $("spin");

let state = Save.load() || G.newState();
const yard = new Yard(), spinner = new Spinner(), renderer = new Renderer(cv), sound = new Sound(), pen = new Pen();
let mode = "yard"; // "yard" (the clicker) or "pen"
sound.musicOn = state.musicOn;
sound.sfxOn = state.sfxOn;

await loadSprites();

// ---------- layout ----------
function layout() {
  const sp = renderer.resize();
  const d = sp.size * 0.95;
  Object.assign(spinBtn.style, { left: `${sp.x - d / 2}px`, top: `${sp.y - d / 2}px`, width: `${d}px`, height: `${d}px` });
  yard.spawnPoint = renderer.toYard(sp.x, sp.y);
}
new ResizeObserver(layout).observe(cv);
new ResizeObserver(() => (pen.bottomPad = $("penBar").offsetHeight + 16)).observe($("penBar"));
layout();

// ---------- toast ----------
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 4200);
}

function duration(sec) {
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  return `${(sec / 3600).toFixed(1)} h`;
}

function grantOffline(sec) {
  state.happy = Math.max(0, (state.happy || 0) - (sec * 100) / G.HAPPY_DRAIN);
  const gain = G.totalLps(state) * Math.min(G.OFFLINE_CAP, sec);
  if (gain < 1) return;
  G.earn(state, gain);
  if (sec >= 60) toast(`While you were away (${duration(sec)}), your Lepuses earned ${G.fmt(gain)} Lepus!`);
}

// ---------- shop ----------
const iconCache = {};
function iconFor(key, frame = 0) {
  const k = key + ":" + frame;
  return (iconCache[k] ||= iconURL(sheets[key], frame));
}

function makeCard(item, onBuy) {
  const el = document.createElement("button");
  el.className = "item";
  el.innerHTML = `<img class="icon" alt=""><span class="info"><span class="name"></span><span class="desc"></span></span><span class="meta"><span class="cost"></span><span class="owned"></span></span>`;
  const icon = el.querySelector(".icon");
  icon.src = iconFor(item.icon, item.iconFrame || 0);
  if (item.hue) icon.style.filter = `hue-rotate(${item.hue}deg)`;
  if (item.grade !== undefined) icon.style.borderColor = G.GRADE_COLORS[item.grade];
  el.addEventListener("click", () => onBuy(item));
  return { el, key: "" };
}

function bought(el) {
  sound.play("buy", { vol: 0.9, pitch: 0.03 });
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
  yard.sync(Math.floor(state.balance), true);
  refreshShop();
  refreshHud();
  Save.save(state);
}

const bCards = {};
for (const b of G.BUILDINGS) {
  bCards[b.id] = makeCard(b, (b) => {
    sound.unlock();
    if (!state.revealed[b.id] || !G.buyBuilding(state, b, state.buyAmount || 1)) return sound.play("denied", { vol: 0.7 });
    bought(bCards[b.id].el);
  });
  $("shopList").append(bCards[b.id].el);
}

const uCards = {};
function upgradeCard(u) {
  return (uCards[u.id] ||= makeCard(u, (u) => {
    sound.unlock();
    if (!G.buyUpgrade(state, u)) return sound.play("denied", { vol: 0.7 });
    bought(uCards[u.id].el);
  }));
}

function setTab(t) {
  for (const btn of document.querySelectorAll(".tab")) btn.setAttribute("aria-selected", String(btn.dataset.tab === t));
  $("shopList").hidden = t !== "buildings";
  $("buyAmount").hidden = t !== "buildings";
  $("upgradeList").hidden = t !== "upgrades";
}
for (const btn of document.querySelectorAll(".tab")) btn.addEventListener("click", () => (sound.play("tick"), setTab(btn.dataset.tab)));
for (const btn of document.querySelectorAll("#buyAmount button"))
  btn.addEventListener("click", () => {
    state.buyAmount = Number(btn.dataset.n);
    sound.play("tick");
    refreshShop();
  });

let upgradeListKey = "", knownUpgrades = -1;
function refreshShop() {
  const amt = state.buyAmount || 1;
  for (const btn of document.querySelectorAll("#buyAmount button")) btn.setAttribute("aria-pressed", String(Number(btn.dataset.n) === amt));

  // Buildings: every revealed one, plus a single "???" teaser for the next.
  let affordB = 0, teaser = false;
  for (const b of G.BUILDINGS) {
    const c = bCards[b.id], shown = !!state.revealed[b.id];
    const visible = shown || !teaser;
    if (!shown) teaser = true;
    const cost = G.buildingCost(state, b, amt), afford = shown && state.balance >= cost, n = G.owned(state, b.id);
    if (afford) affordB++;
    const each = shown ? G.eachLps(state, b) : 0;
    const key = `${visible}|${shown}|${n}|${cost}|${afford}|${each}`;
    if (key === c.key) continue;
    c.key = key;
    const el = c.el;
    el.hidden = !visible;
    el.classList.toggle("hidden", !shown);
    el.classList.toggle("afford", afford);
    const desc = b.mother ? `${b.desc} (+${G.fmtRate(each)}/s each)` : `+${G.fmtRate(each)} Lepus/s each`;
    el.querySelector(".name").textContent = shown ? b.name : "???";
    el.querySelector(".desc").textContent = shown ? desc : `Earn ${G.fmt(b.cost / 2)} Lepus to reveal.`;
    el.querySelector(".cost").textContent = shown ? (amt > 1 ? `×${amt} ` : "") + G.fmtShort(cost) : "???";
    el.querySelector(".owned").textContent = n || "";
    el.setAttribute("aria-label", shown ? `${b.name}, ${n} owned, ${amt} cost ${G.fmt(cost)} Lepus. ${desc}` : "Locked building");
  }

  // Upgrades: only the ones you can currently unlock, cheapest first.
  const avail = G.UPGRADES.filter((u) => G.upgradeAvailable(state, u));
  const listKey = avail.map((u) => u.id).join(",");
  if (listKey !== upgradeListKey) {
    upgradeListKey = listKey;
    if (avail.length) $("upgradeList").replaceChildren(...avail.map((u) => upgradeCard(u).el));
    else $("upgradeList").innerHTML = `<p class="empty">No upgrades yet. Keep earning and buying buildings to unlock them.</p>`;
    if (knownUpgrades >= 0 && avail.length > knownUpgrades) sound.play("unlock", { vol: 0.6, minGap: 1 });
    knownUpgrades = avail.length;
  }
  let affordU = 0;
  for (const u of avail) {
    const c = uCards[u.id], afford = state.balance >= u.cost;
    if (afford) affordU++;
    const key = String(afford);
    if (key === c.key) continue;
    c.key = key;
    c.el.classList.toggle("afford", afford);
    c.el.querySelector(".name").textContent = u.name;
    c.el.querySelector(".desc").textContent = u.desc;
    c.el.querySelector(".cost").textContent = G.fmtShort(u.cost);
    c.el.setAttribute("aria-label", `${u.name}, costs ${G.fmt(u.cost)} Lepus. ${u.desc}`);
  }
  $("upBadge").textContent = affordU || "";
  const total = affordB + affordU;
  $("shopBadge").textContent = total ? `${total} ready` : "";
}

// ---------- HUD ----------
$("hudIcon").src = TIERS[1].icon;
let legendKey = "";
function refreshHud() {
  $("bal").textContent = G.fmt(state.balance);
  $("lps").textContent = G.fmtRate(G.totalLps(state));
  $("clickVal").textContent = G.fmtRate(G.clickValue(state)).replace(/\.0$/, "");
  // Legend: the 5 tiers currently in the yard, smallest to biggest.
  const n = Math.floor(state.balance), lo = windowLo(n), hi = Math.min(TIERS.length - 1, lo + 4), top = topCount(n);
  const key = `${lo}|${top > TOP_SHOWN ? top : 0}`;
  if (key !== legendKey) {
    legendKey = key;
    $("legend").innerHTML = TIERS.slice(lo, hi + 1)
      .map((t, i) => `<span title="${t.name}"><img src="${t.icon}" alt="${t.name}">${G.fmtShort(t.value)}${lo + i === TIERS.length - 1 && top > TOP_SHOWN ? ` <span class="x">×${G.fmtShort(top)}</span>` : ""}</span>`)
      .join("");
  }
}

function setToggle(btn, on) {
  btn.setAttribute("aria-pressed", String(on));
}
setToggle($("musicBtn"), state.musicOn);
setToggle($("sfxBtn"), state.sfxOn);
$("musicBtn").addEventListener("click", () => {
  state.musicOn = !state.musicOn;
  sound.unlock();
  sound.setMusic(state.musicOn);
  setToggle($("musicBtn"), state.musicOn);
  Save.save(state);
});
$("sfxBtn").addEventListener("click", () => {
  state.sfxOn = !state.sfxOn;
  sound.unlock();
  sound.setSfx(state.sfxOn);
  setToggle($("sfxBtn"), state.sfxOn);
  sound.play("tick");
  Save.save(state);
});

// ---------- menu ----------
const menu = $("menu");
$("menuBtn").addEventListener("click", () => {
  $("stats").textContent = `Lifetime Lepus: ${G.fmt(state.lifetime)} · Clicks: ${G.fmt(state.clicks)}`;
  menu.showModal();
});
$("closeBtn").addEventListener("click", () => menu.close());
$("saveBtn").addEventListener("click", () => {
  toast(Save.save(state) ? "Game saved." : "Couldn't save (browser storage is blocked).");
  menu.close();
});
$("resetBtn").addEventListener("click", () => {
  if (!confirm("Reset all progress? Your Lepuses will be gone for good.")) return;
  Save.wipe();
  const { musicOn, sfxOn } = state;
  state = Object.assign(G.newState(), { musicOn, sfxOn });
  G.reveal(state);
  yard.reset(0);
  for (const c of [...Object.values(bCards), ...Object.values(uCards)]) c.key = "";
  upgradeListKey = "";
  $("hint").classList.remove("gone");
  menu.close();
});

$("shopToggle").addEventListener("click", () => document.body.classList.toggle("shop-open"));

// ---------- clicking ----------
function doClick() {
  sound.unlock();
  const v = G.clickValue(state);
  G.earn(state, v);
  state.clicks++;
  spinner.click("+" + G.fmt(v));
  sound.play("click", { vol: 0.9, pitch: 0.12 });
  yard.sync(Math.floor(state.balance), true);
  if (state.clicks >= 3) $("hint").classList.add("gone");
}
spinBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  doClick();
});
spinBtn.addEventListener("click", (e) => {
  if (e.detail === 0) doClick(); // keyboard (Enter / Space)
});
// iPad/iPhone: audio may only start from these events, not pointerdown.
for (const ev of ["pointerup", "touchend", "click"]) document.addEventListener(ev, () => sound.unlock(), { passive: true });

// ---------- Lepus Pen ----------
function setMode(m) {
  mode = m;
  document.body.classList.toggle("pen", m === "pen");
  $("penBar").hidden = m !== "pen";
  for (const btn of document.querySelectorAll("#modeTabs button")) btn.setAttribute("aria-pressed", String(btn.dataset.mode === m));
  if (m === "pen") {
    pen.bottomPad = $("penBar").offsetHeight + 16;
    updateRoster();
    if (!state.penVisited) {
      state.penVisited = true;
      toast("Welcome to the Lepus Pen! Tap a Lepus to pet it. Happy Lepuses earn more Lepus.");
    }
    refreshPen();
  }
}
for (const btn of document.querySelectorAll("#modeTabs button"))
  btn.addEventListener("click", () => {
    sound.unlock();
    sound.play("tick");
    setMode(btn.dataset.mode);
  });

function updateRoster() {
  pen.setRoster(state.maxTier || 0, G.owned(state, "mother"), (state.maxTier || 0) >= G.ZILLA_TIER);
}

const addHappy = (n) => (state.happy = Math.min(100, (state.happy || 0) + n));
let roarReadyAt = 0;

cv.addEventListener("pointerdown", (e) => {
  if (mode !== "pen") return;
  e.preventDefault();
  sound.unlock();
  const w = pen.toWorld(e.offsetX, e.offsetY), hit = pen.pick(w.x, w.y);
  if (!hit) return;
  if (hit.zilla) {
    if (performance.now() < roarReadyAt) return sound.play("hop", { vol: 0.5, rate: 0.5, minGap: 0.3 });
    roarReadyAt = performance.now() + G.ROAR_COOLDOWN * 1000;
    const v = Math.max(10 * G.clickValue(state), 10 * G.totalLps(state)) * G.roarMult(state);
    G.earn(state, v);
    addHappy(5);
    pen.roar();
    pen.addText("+" + G.fmt(v), w.x, w.y - 40, "#ffaaf4");
    sound.play("roar", { vol: 0.9, pitch: 0.05 });
    return;
  }
  const c = hit.critter;
  if (c.petCd > 0) return;
  const v = G.clickValue(state);
  G.earn(state, v);
  state.clicks++;
  addHappy(3);
  pen.pet(c);
  pen.addText("+" + G.fmt(v), c.x, w.y - 30);
  sound.play("grab", { vol: 0.7, pitch: 0.2 });
});

$("feedBtn").addEventListener("click", () => {
  sound.unlock();
  const now = Date.now();
  if (now - (state.fedAt || 0) < G.FEED_COOLDOWN * 1000) return sound.play("denied", { vol: 0.7 });
  state.fedAt = now;
  state.fedUntil = now + G.FED_TIME * 1000;
  addHappy(30);
  pen.dropCarrots(pen.critters.length + 3);
  sound.play("coin", { vol: 0.6 });
  toast(`Carrots! Well-fed Lepuses earn ×${G.FED_MULT} for ${G.FED_TIME} seconds.`);
  refreshPen();
  Save.save(state);
});

$("eggBtn").addEventListener("click", () => {
  sound.unlock();
  const now = Date.now();
  if (now - (state.eggAt || 0) < G.EGG_COOLDOWN * 1000) return sound.play("denied", { vol: 0.7 });
  state.eggAt = now;
  pen.tossEgg();
  sound.play("hop", { vol: 0.6 });
  refreshPen();
});

function handlePenEvents() {
  for (const ev of pen.events.splice(0)) {
    const c = ev.critter;
    if (ev.type === "eat") {
      addHappy(2);
      sound.play("eat", { vol: 0.6, minGap: 0.12, pitch: 0.15 });
    } else if (ev.type === "egg") {
      const v = Math.max(20 * G.clickValue(state), 15 * G.totalLps(state));
      G.earn(state, v);
      addHappy(10);
      pen.addText(`${c.name} caught it! +${G.fmt(v)}`, Math.min(560, Math.max(200, c.x)), 200);
      sound.play("unlock", { vol: 0.8 });
    }
  }
}

const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
function refreshPen() {
  const now = Date.now(), feedLeft = G.FEED_COOLDOWN - (now - (state.fedAt || 0)) / 1000, eggLeft = G.EGG_COOLDOWN - (now - (state.eggAt || 0)) / 1000;
  $("penDot").textContent = feedLeft <= 0 && (state.happy || 0) < 50 ? "!" : "";
  if (mode !== "pen") return;
  const happy = state.happy || 0;
  $("happyFill").style.width = `${happy}%`;
  let txt = `${Math.round(happy)}% · +${Math.round(G.happyBonus(state) * 100)}% Lepus/s`;
  if (G.isFed(state)) txt += ` · 🥕 ×${G.FED_MULT} ${mmss((state.fedUntil - now) / 1000)}`;
  $("happyText").textContent = txt;
  $("feedBtn").disabled = feedLeft > 0;
  $("feedBtn").textContent = feedLeft > 0 ? `🥕 ${mmss(feedLeft)}` : "🥕 Feed";
  $("eggBtn").disabled = eggLeft > 0;
  $("eggBtn").textContent = eggLeft > 0 ? `🥚 ${Math.ceil(eggLeft)}s` : "🥚 Toss egg";
}

// ---------- persistence ----------
document.addEventListener("visibilitychange", () => {
  if (document.hidden) Save.save(state);
  sound.visibility(document.hidden);
});
window.addEventListener("pagehide", () => Save.save(state));

// ---------- boot ----------
if (state.lifetime > 0) grantOffline((Date.now() - state.savedAt) / 1000);
if (state.clicks >= 3) $("hint").classList.add("gone");
G.reveal(state);
yard.sync(Math.floor(state.balance));
refreshShop();
refreshHud();

const SOUND_FOR = {
  merge: ["merge", { vol: 0.85, minGap: 0.08 }],
  fly: ["hop", { vol: 0.22, minGap: 0.09, pitch: 0.15 }],
  split: ["coin", { vol: 0.5, minGap: 0.1 }],
  roar: ["roar", { vol: 0.9, minGap: 1, pitch: 0.05 }],
  stomp: ["hop", { vol: 0.7, minGap: 0.2, pitch: 0.05, rate: 0.45 }],
};

let last = performance.now(), uiTimer = 0, saveTimer = 0, motherGain = 0, motherTimer = 0;
function frame(now) {
  let dt = Math.max(0, (now - last) / 1000); // the first rAF timestamp can predate `last`
  last = now;
  if (dt > 2) {
    // The tab was in the background (rAF paused): pay out the gap like offline time.
    grantOffline(dt);
    dt = 0;
  }
  dt = Math.min(dt, 0.05);

  // Mother clicks are batched into one lunge + "+X" at most every 0.3 s so big flocks don't flood the screen.
  motherGain += G.tick(state, dt) * G.motherClickValue(state);
  if (motherGain && (motherTimer -= dt) <= 0) {
    motherTimer = 0.3;
    spinner.motherClick(Math.min(12, G.owned(state, "mother")), "+" + G.fmt(motherGain));
    sound.play("click", { vol: 0.3, minGap: 0.12, pitch: 0.2 });
    motherGain = 0;
  }
  yard.sync(Math.floor(state.balance));
  yard.update(dt);
  spinner.update(dt);
  pen.update(dt);
  handlePenEvents();
  for (const ev of yard.events.splice(0)) {
    if (ev === "roar") renderer.shake = 1.2;
    if (ev === "stomp") renderer.shake = Math.max(renderer.shake, 0.5);
    if (mode === "yard" || ev === "roar") sound.play(...SOUND_FOR[ev]);
  }

  if (mode === "pen") renderer.drawPen(dt, pen);
  else renderer.draw(dt, state, yard, spinner, G.owned(state, "mother"));

  if ((uiTimer -= dt) <= 0) {
    uiTimer = 0.1;
    for (const b of G.reveal(state)) {
      toast(`New building: ${b.name}!`);
      sound.play("unlock", { vol: 0.8 });
    }
    state.maxTier = Math.max(state.maxTier || 0, topTier(Math.floor(state.balance)));
    if (state.maxTier >= G.ZILLA_TIER && !state.zillaSeen) {
      state.zillaSeen = true;
      toast("LEPUSZILLA HAS AWOKEN! Visit it in the Pen.");
    }
    updateRoster();
    refreshHud();
    refreshShop();
    refreshPen();
  }
  if ((saveTimer += dt) > 10) {
    saveTimer = 0;
    Save.save(state);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Offline + installable app support.
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

// Console helpers for testing: lepus.give(1e6)
window.lepus = { get state() { return state; }, yard, pen, sound, G, setMode, give: (n) => G.earn(state, n), dirty: () => (state._v = (state._v || 0) + 1) };
