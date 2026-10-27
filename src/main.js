// Lepus Clicker: boot, input, HUD/shop DOM and the requestAnimationFrame loop.
import { loadSprites, sheets, TIERS, iconURL } from "./sprites.js";
import * as G from "./game.js";
import { Yard, topCount } from "./yard.js";
import { Renderer, Spinner } from "./render.js";
import { Sound } from "./audio.js";
import * as Save from "./save.js";

const $ = (id) => document.getElementById(id);
const cv = $("cv"), spinBtn = $("spin");

let state = Save.load() || G.newState();
const yard = new Yard(), spinner = new Spinner(), renderer = new Renderer(cv), sound = new Sound();
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
  const gain = G.totalLps(state) * Math.min(G.OFFLINE_CAP, sec);
  if (gain < 1) return;
  G.earn(state, gain);
  toast(`While you were away (${duration(sec)}), your Lepuses earned ${G.fmt(gain)} Lepus!`);
}

// ---------- shop ----------
const cards = {};
for (const u of G.UPGRADES) {
  const b = document.createElement("button");
  b.className = "item";
  b.innerHTML = `<img class="icon" alt=""><span class="info"><span class="name"></span><span class="desc"></span></span><span class="meta"><span class="cost"></span><span class="owned"></span></span>`;
  const icon = b.querySelector(".icon");
  icon.src = iconURL(sheets[u.icon], u.iconFrame || 0);
  if (u.iconTint) icon.classList.add(u.iconTint);
  b.addEventListener("click", () => tryBuy(u));
  $("shopList").append(b);
  cards[u.id] = { el: b, key: "" };
}

function tryBuy(u) {
  sound.unlock();
  if (!state.revealed[u.id]) return sound.play("denied", { vol: 0.6 });
  if (!G.buy(state, u)) return sound.play("denied", { vol: 0.7 });
  sound.play("buy", { vol: 0.9, pitch: 0.03 });
  const el = cards[u.id].el;
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
  yard.sync(Math.floor(state.balance), true);
  refreshShop();
  refreshHud();
  Save.save(state);
}

function refreshShop() {
  let affordable = 0;
  for (const u of G.UPGRADES) {
    const c = cards[u.id], shown = !!state.revealed[u.id];
    const n = G.owned(state, u.id), done = u.kind === "once" && n > 0;
    const cost = G.costOf(state, u), afford = shown && G.canBuy(state, u);
    if (afford) affordable++;
    const key = `${shown}|${n}|${cost}|${afford}`;
    if (key === c.key) continue;
    c.key = key;
    const el = c.el;
    el.classList.toggle("hidden", !shown);
    el.classList.toggle("afford", afford);
    el.classList.toggle("done", done);
    el.querySelector(".name").textContent = shown ? u.name : "???";
    el.querySelector(".desc").textContent = shown ? u.desc : `Earn ${G.fmt(u.cost / 2)} Lepus to reveal.`;
    el.querySelector(".cost").textContent = done ? "Owned" : shown ? G.fmt(cost) : "???";
    el.querySelector(".owned").textContent = u.kind === "building" && n ? n : "";
    el.setAttribute("aria-label", shown ? `${u.name}, ${done ? "owned" : `costs ${G.fmt(cost)} Lepus`}. ${u.desc}` : "Locked upgrade");
  }
  $("shopBadge").textContent = affordable ? `${affordable} ready` : "";
}

// ---------- HUD ----------
$("hudIcon").src = TIERS[1].icon;
let legendKey = "";
function refreshHud() {
  $("bal").textContent = G.fmt(state.balance);
  $("lps").textContent = G.fmtRate(G.totalLps(state));
  $("clickVal").textContent = G.fmtRate(G.clickValue(state)).replace(/\.0$/, "");
  const top = topCount(Math.floor(state.balance));
  const key = String(top > 9 ? top : 0);
  if (key !== legendKey) {
    legendKey = key;
    $("legend").innerHTML = TIERS.map((t, i) => `<span><img src="${t.icon}" alt="${t.name}">${G.fmt(t.value)}${i === TIERS.length - 1 && top > 9 ? ` <span class="x">×${G.fmt(top)}</span>` : ""}</span>`).join("");
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
  for (const c of Object.values(cards)) c.key = "";
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
  for (const ev of yard.events.splice(0)) sound.play(...SOUND_FOR[ev]);

  renderer.draw(dt, state, yard, spinner, G.owned(state, "mother"));

  if ((uiTimer -= dt) <= 0) {
    uiTimer = 0.1;
    for (const u of G.reveal(state)) {
      toast(`New upgrade: ${u.name}!`);
      sound.play("unlock", { vol: 0.8 });
    }
    refreshHud();
    refreshShop();
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
window.lepus = { get state() { return state; }, yard, sound, give: (n) => G.earn(state, n) };
