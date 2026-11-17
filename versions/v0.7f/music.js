// 符文塔防 · 背景音乐（WebAudio 实时合成，没有音频文件，也没有版权问题）
// 曲目：lobby（大厅）、grass / snow / volcano（三种主题的战斗曲）、boss。
// 每首分层：氛围层（铺底和弦、贝斯）一直在；战斗层（鼓、琶音、主旋律）只在战斗中淡入。
(function (root) {
  "use strict";
  const NOTE = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
  const midi = s => { const m = /^([A-G][#b]?)(-?\d)$/.exec(s); return m ? NOTE[m[1]] + (+m[2] + 1) * 12 : null; };
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  // 和弦：根音（如 "A2"）+ 类型
  const CH = { m: [0, 3, 7], M: [0, 4, 7], s4: [0, 5, 7], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], d7: [0, 4, 7, 10], dim: [0, 3, 6] };
  const chord = s => { const [r, t] = s.split(":"); const b = midi(r); return (CH[t || "m"]).map(i => b + i); };
  // 旋律：每小节 16 格（16 分音符），用空格分隔；"-" 延音，"." 休止
  const mel = str => str.trim().split(/\s*\|\s*/).map(bar => bar.trim().split(/\s+/));

  const TRACKS = {
    lobby: {
      bpm: 84, swing: 0, lead: "bell", bass: "soft", drums: null, arp: "up8",
      chords: ["A2:m", "F2:M", "C3:M", "G2:M", "A2:m", "F2:M", "G2:M", "E2:M"],
      melody: mel(`E5 - - - C5 - - - A4 - - - B4 - C5 - | A4 - - - - - - - . . . . C5 - D5 - | E5 - - - G5 - - - E5 - D5 - C5 - - - | D5 - - - - - - - . . . . B4 - - - |
                   C5 - - - E5 - - - A5 - - - G5 - E5 - | F5 - - - E5 - - - D5 - - - C5 - - - | B4 - - - D5 - - - G5 - - - F5 - E5 - | E5 - - - - - - - G#4 - - - B4 - - -`),
    },
    grass: {
      bpm: 112, lead: "square", bass: "pluck", drums: "battle", arp: "bounce",
      chords: ["D3:m", "Bb2:M", "C3:M", "A2:M", "D3:m", "Bb2:M", "F2:M", "C3:M", "G2:m", "Bb2:M", "C3:M", "A2:M"],
      melody: mel(`D5 - - A4 - - D5 - E5 - F5 - E5 - D5 - | F5 - - - D5 - - - Bb4 - - - D5 - F5 - | G5 - - - E5 - C5 - E5 - G5 - F5 - E5 - | E5 - - - - - - - C#5 - - - E5 - - - |
                   A5 - - - F5 - D5 - F5 - A5 - G5 - F5 - | F5 - - - D5 - - - F5 - G5 - A5 - - - | C6 - - - A5 - F5 - A5 - C6 - Bb5 - A5 - | G5 - - - - - - - E5 - - - C5 - - - |
                   Bb4 - - - D5 - - - G5 - - - F5 - D5 - | F5 - - - D5 - - - Bb4 - - - F5 - - - | E5 - - - G5 - - - C6 - - - Bb5 - G5 - | A5 - - - - - - - C#5 - - - E5 - - -`),
    },
    snow: {
      bpm: 104, lead: "bell", bass: "soft", drums: "light", arp: "up16",
      chords: ["E3:m", "C3:M", "G2:M", "D3:M", "E3:m", "C3:M", "A2:m", "B2:M"],
      melody: mel(`B5 - - - G5 - - - E5 - - - F#5 - G5 - | E5 - - - - - - - C5 - - - E5 - G5 - | D5 - - - G5 - - - B5 - - - A5 - G5 - | F#5 - - - - - - - D5 - - - F#5 - A5 - |
                   G5 - - - B5 - - - E6 - - - D6 - B5 - | C6 - - - B5 - - - G5 - - - E5 - - - | A5 - - - C6 - - - E6 - - - C6 - A5 - | B5 - - - - - - - D#5 - - - F#5 - - -`),
    },
    volcano: {
      bpm: 124, lead: "saw", bass: "dist", drums: "heavy", arp: null,
      chords: ["E2:m", "F2:M", "E2:m", "D2:M", "E2:m", "F2:M", "G2:M", "F2:M"],
      melody: mel(`E5 - . E5 F5 - E5 - D5 - . . B4 - . . | C5 - - - A4 - F4 - A4 - - - . . . . | E5 - . E5 F5 - E5 - G5 - F5 - E5 - D5 - | D5 - - - - - - - . . . . F#4 - A4 - |
                   B4 - . B4 C5 - B4 - A4 - . . G4 - . . | A4 - - - C5 - - - F5 - - - E5 - - - | G5 - - - F5 - E5 - D5 - E5 - F5 - G5 - | F5 - - - - - - - E5 - - - D5 - - -`),
    },
    boss: {
      bpm: 138, lead: "saw", bass: "drive", drums: "boss", arp: "up16",
      chords: ["A2:m", "A2:m", "F2:M", "G2:M", "A2:m", "A2:m", "E2:M", "E2:M"],
      melody: mel(`A4 . A4 . C5 . A4 . E5 - - - D5 - C5 - | A4 . A4 . C5 . A4 . G5 - - - E5 - - - | F5 - - - E5 - - - D5 - - - C5 - D5 - | B4 - - - - - - - G4 - B4 - D5 - - - |
                   A5 . A5 . G5 . E5 . A5 - - - G5 - E5 - | C6 - - - B5 - - - A5 - G5 - E5 - - - | G#5 - - - E5 - - - B4 - - - E5 - - - | G#5 - - - B5 - - - E6 - - - - - - -`),
    },
  };
  const DRUMS = {
    battle: { k: "x.......x.x.....", s: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
    light: { k: "x...........x...", s: "........x.......", h: "..x...x...x...x." },
    heavy: { k: "x..x..x.x..x..x.", s: "....x.......x..x", h: "x.x.x.x.x.x.x.x.", t: "..............xx" },
    boss: { k: "x..x....x.xx....", s: "....x.......x...", h: "xxxxxxxxxxxxxxxx" },
  };

  let AC = null, OUT = null, BUS = {}, noiseBuf = null, timer = null;
  let cur = null, curName = null, nextT = 0, stepI = 0, intensity = 0, enabled = true, vol = .2;

  function init(ac) {
    if (AC || !ac) return;
    AC = ac;
    OUT = AC.createGain(); OUT.gain.value = enabled ? vol : 0;
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    OUT.connect(comp); comp.connect(AC.destination);
    // 空间感：简单回声
    const dl = AC.createDelay(1), fb = AC.createGain(), lp = AC.createBiquadFilter(), wet = AC.createGain();
    dl.delayTime.value = .32; fb.gain.value = .32; lp.type = "lowpass"; lp.frequency.value = 2600; wet.gain.value = .35;
    dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(OUT);
    const mk = (g, toDelay) => { const n = AC.createGain(); n.gain.value = g; n.connect(OUT); if (toDelay) n.connect(dl); return n; };
    BUS = { pad: mk(.5, true), bass: mk(.9), arp: mk(0, true), lead: mk(0, true), drum: mk(0) };
    const n = AC.sampleRate; noiseBuf = AC.createBuffer(1, n, n); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    timer = setInterval(tick, 25);
  }
  function env(g, t, a, peak, dec, sus, rel, len) {
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.linearRampToValueAtTime(peak * sus, t + a + dec);
    g.gain.setValueAtTime(peak * sus, t + Math.max(a + dec, len)); g.gain.linearRampToValueAtTime(0, t + Math.max(a + dec, len) + rel);
    return t + Math.max(a + dec, len) + rel + .05;
  }
  function osc(type, f, t, end, dest, detune = 0) { const o = AC.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.connect(dest); o.start(t); o.stop(end); return o; }
  function filt(type, f, q = .7) { const b = AC.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  // ---------------- 乐器 ----------------
  function pad(notes, t, len) {
    for (const n of notes) {
      const g = AC.createGain(), lp = filt("lowpass", 1100); g.connect(lp); lp.connect(BUS.pad);
      const end = env(g, t, .35, .05, .2, .8, .5, len);
      osc("sawtooth", hz(n + 12), t, end, g, -7); osc("sawtooth", hz(n + 12), t, end, g, 7);
    }
  }
  function bass(kind, n, t, len) {
    const g = AC.createGain();
    if (kind === "dist") { const ws = AC.createWaveShaper(), c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 4); } ws.curve = c; const lp = filt("lowpass", 900), post = AC.createGain(); post.gain.value = .13; g.connect(ws); ws.connect(lp); lp.connect(post); post.connect(BUS.bass); }
    else { const lp = filt("lowpass", kind === "soft" ? 500 : 800); g.connect(lp); lp.connect(BUS.bass); }
    const pk = kind === "soft" ? .22 : kind === "drive" ? .3 : .24;
    const end = env(g, t, .01, pk, kind === "soft" ? .3 : .12, kind === "soft" ? .6 : .4, .08, len);
    osc(kind === "soft" ? "triangle" : "sawtooth", hz(n), t, end, g); osc("sine", hz(n), t, end, g);
  }
  function lead(kind, n, t, len) {
    const g = AC.createGain(), f = hz(n);
    if (kind === "bell") {
      g.connect(BUS.lead); const end = env(g, t, .005, .16, .9, .0, .1, .05);
      osc("sine", f, t, end + .6, g); const g2 = AC.createGain(); g2.gain.value = .35; g2.connect(g); osc("sine", f * 2.76, t, end, g2); return;
    }
    const lp = filt("lowpass", kind === "saw" ? 2400 : 3200); g.connect(lp); lp.connect(BUS.lead);
    const end = env(g, t, .01, kind === "saw" ? .09 : .08, .1, .7, .08, len);
    const o = osc(kind === "saw" ? "sawtooth" : "square", f, t, end, g);
    // 颤音
    const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 5.5; lg.gain.value = f * .006; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t + .15); lfo.stop(end);
  }
  function pluck(n, t) { const g = AC.createGain(); g.connect(BUS.arp); const end = env(g, t, .004, .07, .18, 0, .05, .02); osc("triangle", hz(n), t, end, g); }
  function noiseHit(t, dur, vol, type, f, bus) { const s = AC.createBufferSource(); s.buffer = noiseBuf; const b = filt(type, f), g = AC.createGain(); s.connect(b); b.connect(g); g.connect(bus); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.start(t, Math.random() * .5); s.stop(t + dur + .02); }
  function kick(t) { const o = AC.createOscillator(), g = AC.createGain(); o.connect(g); g.connect(BUS.drum); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + .14); g.gain.setValueAtTime(.55, t); g.gain.exponentialRampToValueAtTime(.001, t + .22); o.start(t); o.stop(t + .25); }
  function snare(t) { noiseHit(t, .14, .22, "bandpass", 1800, BUS.drum); const o = AC.createOscillator(), g = AC.createGain(); o.connect(g); g.connect(BUS.drum); o.frequency.value = 190; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .08); o.start(t); o.stop(t + .1); }
  function hat(t, open) { noiseHit(t, open ? .12 : .035, .07, "highpass", 7000, BUS.drum); }
  function tom(t) { const o = AC.createOscillator(), g = AC.createGain(); o.connect(g); g.connect(BUS.drum); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(70, t + .2); g.gain.setValueAtTime(.3, t); g.gain.exponentialRampToValueAtTime(.001, t + .25); o.start(t); o.stop(t + .28); }

  // ---------------- 编排 ----------------
  function scheduleStep(T, i, t) {
    const sd = 60 / T.bpm / 4, bars = T.chords.length, bar = Math.floor(i / 16) % bars, s = i % 16, ch = chord(T.chords[bar]);
    if (s === 0) pad(ch, t, sd * 15);
    // 贝斯
    if (T.bass === "soft") { if (s === 0 || s === 8) bass("soft", ch[0], t, sd * 6); }
    else if (T.bass === "drive") { if (s % 2 === 0) bass("drive", ch[0] + (s === 14 ? 12 : 0), t, sd * 1.2); }
    else if (T.bass === "dist") { if ("x..x..x.x.x.x..x"[s] === "x") bass("dist", ch[0], t, sd * 1.5); }
    else if ([0, 3, 6, 8, 11, 14].includes(s)) bass("pluck", ch[0] + (s === 6 || s === 14 ? 7 : 0), t, sd * 1.6);
    // 琶音
    if (T.arp) {
      const tones = [...ch, ch[0] + 12, ch[1] + 12];
      if (T.arp === "up8" && s % 2 === 0) pluck(tones[(s / 2) % tones.length] + 12, t);
      if (T.arp === "up16") pluck(tones[s % tones.length] + 24, t);
      if (T.arp === "bounce" && s % 2 === 0) pluck([0, 2, 1, 3, 2, 4, 1, 2][s / 2] < tones.length ? tones[[0, 2, 1, 3, 2, 4, 1, 2][s / 2]] + 12 : tones[0] + 12, t);
    }
    // 主旋律
    const m = T.melody[bar % T.melody.length], tok = m && m[s];
    if (tok && tok !== "-" && tok !== ".") {
      let len = 1; while (s + len < 16 && m[s + len] === "-") len++;
      const n = midi(tok); if (n != null) lead(T.lead, n, t, sd * len * .95);
    }
    // 鼓
    const D = DRUMS[T.drums];
    if (D) { if (D.k[s] === "x") kick(t); if (D.s[s] === "x") snare(t); if (D.h[s] === "x") hat(t, s % 8 === 6); if (D.t && D.t[s] === "x") tom(t); }
  }
  function tick() {
    if (!AC || !cur || AC.state !== "running") return;
    const sd = 60 / cur.bpm / 4;
    if (nextT < AC.currentTime) nextT = AC.currentTime + .05;
    while (nextT < AC.currentTime + .15) { if (enabled) scheduleStep(cur, stepI, nextT); stepI++; nextT += sd; }
  }
  function ramp(node, v, d = .8) { const t = AC.currentTime; node.gain.cancelScheduledValues(t); node.gain.setValueAtTime(node.gain.value, t); node.gain.linearRampToValueAtTime(v, t + d); }
  function applyIntensity() {
    if (!AC) return;
    const on = intensity ? 1 : 0, lobby = curName === "lobby";
    ramp(BUS.drum, on ? .9 : 0); ramp(BUS.lead, on || lobby ? .9 : 0); ramp(BUS.arp, on || lobby ? .8 : .35);
  }
  // 切歌：淡出→换曲→淡入
  function want(name, inten) {
    if (!AC) return;
    if (name !== curName) {
      curName = name;
      ramp(OUT, 0, .5);
      setTimeout(() => { cur = TRACKS[name] || null; stepI = 0; nextT = AC.currentTime + .1; if (enabled) ramp(OUT, vol, .8); applyIntensity(); }, 520);
    }
    if ((inten ? 1 : 0) !== intensity) { intensity = inten ? 1 : 0; applyIntensity(); }
  }
  function setEnabled(on) { enabled = !!on; if (AC) ramp(OUT, enabled ? vol : 0, .4); }
  // 离线渲染（试听样本、检查音量用）：在 OfflineAudioContext 上把一首曲子从头排到尾
  function render(octx, name, secs, inten) {
    const saveAC = AC, saveT = timer; AC = null; timer = null;
    const realSetInterval = root.setInterval; root.setInterval = () => 0;
    init(octx); root.setInterval = realSetInterval;
    const T = TRACKS[name], sd = 60 / T.bpm / 4; curName = name;
    BUS.drum.gain.value = inten ? .9 : 0; BUS.lead.gain.value = inten || name === "lobby" ? .9 : 0; BUS.arp.gain.value = inten || name === "lobby" ? .8 : .35;
    for (let i = 0, t = .05; t < secs - .5; i++, t += sd) scheduleStep(T, i, t);
    const res = AC; AC = saveAC; timer = saveT; return res;
  }
  root.RuneMusic = { init, want, setEnabled, render, tracks: Object.keys(TRACKS), state: () => ({ cur: curName, intensity, enabled, running: !!AC && AC.state }) };
})(typeof window !== "undefined" ? window : globalThis);
