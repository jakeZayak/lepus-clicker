// WebAudio: vanilla Terraria SFX plus Lepus's boss theme looping for the whole session.
// Browsers block autoplay, so everything starts on the first click/tap (unlock()).

const SFX = ["click", "hop", "buy", "merge", "denied", "tick", "coin", "unlock", "grab"];
const MUSIC_SRC = "assets/music/lepus.mp3";
const MUSIC_VOL = 0.45;
const SFX_VOL = 0.55;

export class Sound {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.last = {};
    this.musicOn = true;
    this.sfxOn = true;
  }

  unlock() {
    if (this.music) {
      // iOS Safari only honours resume()/play() from touchend/click, so retry on every gesture until it sticks.
      if (this.ctx && this.ctx.state !== "running") this.ctx.resume();
      if (this.musicOn && this.music.paused && !document.hidden) this.music.play().catch(() => {});
      return;
    }
    this.music = new window.Audio(MUSIC_SRC);
    this.music.loop = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      // No WebAudio: the theme still plays as a plain <audio> element; SFX are skipped.
      this.music.volume = MUSIC_VOL;
      if (this.musicOn) this.music.play().catch(() => {});
      return;
    }
    this.ctx = new AC();
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxOn ? SFX_VOL : 0;
    this.sfxGain.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? MUSIC_VOL : 0;
    this.musicGain.connect(this.ctx.destination);
    this.ctx.createMediaElementSource(this.music).connect(this.musicGain);
    if (this.musicOn) this.music.play().catch(() => {});

    for (const name of SFX)
      fetch(`assets/sfx/${name}.wav`)
        .then((r) => r.arrayBuffer())
        .then((b) => this.ctx.decodeAudioData(b))
        .then((buf) => (this.buffers[name] = buf))
        .catch(() => console.warn("Missing sound:", name));
  }

  // Terraria-style random pitch variation; minGap throttles rapid repeats of the same sound.
  play(name, { vol = 1, pitch = 0.08, minGap = 0.035 } = {}) {
    const buf = this.buffers[name];
    if (!this.ctx || !buf || !this.sfxOn) return;
    const now = this.ctx.currentTime;
    if (now - (this.last[name] || -1) < minGap) return;
    this.last[name] = now;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 1 + (Math.random() * 2 - 1) * pitch;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(gain).connect(this.sfxGain);
    src.start();
    if (this.musicOn && vol >= 0.8) {
      // Duck the music slightly under louder effects.
      const m = this.musicGain.gain;
      m.cancelScheduledValues(now);
      m.setTargetAtTime(MUSIC_VOL * 0.7, now, 0.02);
      m.setTargetAtTime(MUSIC_VOL, now + 0.18, 0.25);
    }
  }

  setMusic(on) {
    this.musicOn = on;
    if (!this.music) return;
    if (this.ctx) {
      this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicGain.gain.value = on ? MUSIC_VOL : 0;
    }
    if (on) this.music.play().catch(() => {});
    else this.music.pause();
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.ctx) this.sfxGain.gain.value = on ? SFX_VOL : 0;
  }

  // Pause the theme while the tab is hidden; pick it back up when it returns.
  visibility(hidden) {
    if (!this.music || !this.musicOn) return;
    if (hidden) this.music.pause();
    else this.music.play().catch(() => {});
  }
}
