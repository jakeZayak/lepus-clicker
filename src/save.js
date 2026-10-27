// LocalStorage persistence. Every access is guarded: private windows and blocked storage just skip saving.
import { newState } from "./game.js";

const KEY = "lepusClicker.v1";

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = Object.assign(newState(), JSON.parse(raw));
    if (!Number.isFinite(s.balance) || !Number.isFinite(s.lifetime)) return null;
    return s;
  } catch {
    return null;
  }
}

export function save(s) {
  s.savedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function wipe() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
