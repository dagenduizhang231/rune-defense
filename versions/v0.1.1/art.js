// 符文塔防 · 矢量美术 v0.1
// 每个函数返回一段独立的 <svg>，viewBox 统一为 64×64，id 自动加前缀避免冲突。
// 风格：Q 版符文奇幻，圆润、不血腥，适合大众审核。
(function (root) {
  "use strict";
  let seq = 0;
  const uid = p => `${p}${++seq}`;
  const svg = (inner, defs = "") =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${defs ? `<defs>${defs}</defs>` : ""}${inner}</svg>`;
  const lin = (id, a, b, x2 = 0, y2 = 1) =>
    `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const rad = (id, a, b, cx = .38, cy = .32) =>
    `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r=".75"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
  const glow = (id, sd = 1.6) =>
    `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  const shadow = (rx = 20, cy = 57) => `<ellipse cx="32" cy="${cy}" rx="${rx}" ry="${rx * .28}" fill="#000" opacity=".35"/>`;
  const eyes = (lx, rx, y, r = 4, look = 1) =>
    `<ellipse cx="${lx}" cy="${y}" rx="${r}" ry="${r * 1.15}" fill="#fff"/><ellipse cx="${rx}" cy="${y}" rx="${r}" ry="${r * 1.15}" fill="#fff"/>` +
    `<circle cx="${lx + look}" cy="${y + 1}" r="${r * .55}" fill="#1e1b2e"/><circle cx="${rx + look}" cy="${y + 1}" r="${r * .55}" fill="#1e1b2e"/>` +
    `<circle cx="${lx + look + r * .25}" cy="${y - r * .1}" r="${r * .2}" fill="#fff"/><circle cx="${rx + look + r * .25}" cy="${y - r * .1}" r="${r * .2}" fill="#fff"/>`;
  // 石头塔基（所有塔共用）
  const base = (s, rune, runeColor, g) =>
    `${shadow(21)}<path d="M14 54 L18 34 H46 L50 54 Q32 60 14 54Z" fill="url(#${s})"/>` +
    `<path d="M14 54 Q32 60 50 54" fill="none" stroke="#2a2f45" stroke-width="1.5"/>` +
    `<path d="M17 44 H47 M16 49 H48" stroke="#2a2f45" stroke-width=".8" opacity=".55"/>` +
    `<path d="M24 34 V44 M38 34 V44 M30 44 V49 M42 49 V54 M21 49 V54" stroke="#2a2f45" stroke-width=".8" opacity=".55"/>` +
    `<ellipse cx="32" cy="34" rx="14" ry="4" fill="#8b93ad"/>` +
    `<g filter="url(#${g})" stroke="${runeColor}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">${rune}</g>`;

  const A = {};

  // ---------------- 塔 ----------------
  A.arrow = () => {
    const s = uid("as"), g = uid("ag"), w = uid("aw"), c = uid("ac");
    return svg(
      base(s, `<path d="M32 40 V52 M32 42 L36 45 L32 48"/>`, "#4ade80", g) +
      `<rect x="20" y="24" width="24" height="10" rx="2" fill="url(#${w})"/>` +
      `<path d="M20 24 h4 v-3 h4 v3 h8 v-3 h4 v3 h4" fill="url(#${w})"/>` +
      `<path d="M20 28 H44" stroke="#5c4128" stroke-width=".8"/>` +
      `<path d="M17 20 Q32 4 47 20" fill="none" stroke="#d9b077" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M17 20 L32 15 L47 20" fill="none" stroke="#f1f5f9" stroke-width=".8"/>` +
      `<path d="M32 22 V6" stroke="#e2e8f0" stroke-width="1.6"/>` +
      `<path d="M32 2 L35.5 8 L32 7 L28.5 8Z" fill="url(#${c})" filter="url(#${g})"/>`,
      lin(s, "#7d86a3", "#4a5068") + lin(w, "#a07a52", "#6b4c2e") + lin(c, "#bbf7d0", "#22c55e") + glow(g));
  };

  A.cannon = () => {
    const s = uid("cs"), g = uid("cg"), b = uid("cb"), m = uid("cm");
    return svg(
      base(s, `<path d="M35 40 L29 45 L35 50"/>`, "#fb923c", g) +
      `<g transform="rotate(-32 32 28)">` +
      `<rect x="26.5" y="4" width="11" height="24" rx="4" fill="url(#${b})"/>` +
      `<rect x="25" y="3" width="14" height="5" rx="2.5" fill="#f6c27a"/>` +
      `<rect x="26.5" y="15" width="11" height="2.5" fill="#7c4a1c" opacity=".6"/>` +
      `<ellipse cx="32" cy="4.5" rx="4" ry="1.6" fill="#3b2410"/></g>` +
      `<circle cx="32" cy="29" r="7.5" fill="url(#${m})" stroke="#3b2410" stroke-width="1.2"/>` +
      `<circle cx="32" cy="29" r="2.4" fill="#fb923c" filter="url(#${g})"/>`,
      lin(s, "#7d86a3", "#4a5068") + lin(b, "#e8a85a", "#8a5523", 1, 0) + rad(m, "#7a5534", "#3b2410") + glow(g));
  };

  A.frost = () => {
    const s = uid("fs"), g = uid("fg"), c = uid("fc"), d = uid("fd");
    return svg(
      base(s, `<path d="M32 40 V52 M28 44 L36 48 M36 44 L28 48"/>`, "#7dd3fc", g) +
      `<ellipse cx="32" cy="24" rx="17" ry="4.5" fill="none" stroke="#bae6fd" stroke-width="1" opacity=".7"/>` +
      `<polygon points="21,30 25,16 29,30" fill="url(#${d})" opacity=".9"/>` +
      `<polygon points="35,30 39,14 43,30" fill="url(#${d})" opacity=".9"/>` +
      `<polygon points="32,2 39,18 32,33 25,18" fill="url(#${c})" filter="url(#${g})"/>` +
      `<polygon points="32,2 32,33 25,18" fill="#fff" opacity=".35"/>` +
      `<path d="M32 2 L39 18 L32 33" fill="none" stroke="#e0f2fe" stroke-width=".8"/>` +
      `<circle cx="46" cy="12" r="1.2" fill="#fff"/><circle cx="17" cy="20" r="1" fill="#fff"/><circle cx="44" cy="26" r=".8" fill="#fff"/>`,
      lin(s, "#7d86a3", "#4a5068") + lin(c, "#f0f9ff", "#38bdf8") + lin(d, "#e0f2fe", "#0ea5e9") + glow(g, 1.2));
  };

  A.tesla = () => {
    const s = uid("ts"), g = uid("tg"), o = uid("to"), p = uid("tp");
    return svg(
      base(s, `<path d="M34 39 L29 46 H35 L30 53"/>`, "#d8b4fe", g) +
      `<path d="M26 34 L29.5 14 H34.5 L38 34Z" fill="url(#${p})"/>` +
      `<ellipse cx="32" cy="30" rx="9" ry="2.6" fill="none" stroke="#c084fc" stroke-width="2"/>` +
      `<ellipse cx="32" cy="24" rx="7.5" ry="2.2" fill="none" stroke="#c084fc" stroke-width="2"/>` +
      `<ellipse cx="32" cy="18.5" rx="6" ry="1.8" fill="none" stroke="#c084fc" stroke-width="2"/>` +
      `<circle cx="32" cy="10" r="7.5" fill="url(#${o})" filter="url(#${g})"/>` +
      `<circle cx="29.5" cy="7.5" r="2.2" fill="#fff" opacity=".8"/>` +
      `<path d="M39 6 L44 4 L42 8 L48 6" fill="none" stroke="#f5d0fe" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M25 13 L20 12 L23 16 L17 16" fill="none" stroke="#f5d0fe" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`,
      lin(s, "#7d86a3", "#4a5068") + lin(p, "#64748b", "#334155", 1, 0) + rad(o, "#fdf4ff", "#a855f7") + glow(g, 2));
  };

  // ---------------- 敌人 ----------------
  const blob = (id, hi, lo, extra = "", look = 1, w = 20, h = 18) => {
    const x0 = 32 - w, x1 = 32 + w, y1 = 52, y0 = y1 - h * 2;
    return `${shadow(w * .95, 55)}` +
      `<path d="M${x0} ${y1 - 6} Q${x0} ${y0} 32 ${y0} Q${x1} ${y0} ${x1} ${y1 - 6} Q${x1} ${y1} 32 ${y1} Q${x0} ${y1} ${x0} ${y1 - 6}Z" fill="url(#${id})"/>` +
      `<ellipse cx="${32 - w * .4}" cy="${y0 + h * .45}" rx="${w * .28}" ry="${h * .2}" fill="#fff" opacity=".45" transform="rotate(-25 ${32 - w * .4} ${y0 + h * .45})"/>` +
      extra;
  };

  A.norm = () => {
    const b = uid("nb");
    return svg(blob(b, "#fecaca", "#ef4444", eyes(25, 38, 34) + `<path d="M29 43 Q31.5 45.5 34 43" fill="none" stroke="#7f1d1d" stroke-width="1.6" stroke-linecap="round"/>`),
      rad(b, "#fecaca", "#dc2626"));
  };

  A.fast = () => {
    const b = uid("fb");
    return svg(`${shadow(15, 56)}` +
      `<path d="M6 26 Q18 27 22 30 M4 36 Q16 35 20 38 M8 46 Q18 43 22 44" stroke="#fde68a" stroke-width="2" stroke-linecap="round" fill="none" opacity=".8"/>` +
      `<path d="M50 34 Q50 18 36 17 Q22 17 16 26 Q24 27 25 31 Q19 36 14 42 Q26 48 36 48 Q50 48 50 34Z" fill="url(#${b})"/>` +
      `<path d="M38 18 L42 9 L44 19 M45 21 L52 14 L50 24" fill="#f59e0b"/>` +
      `<ellipse cx="34" cy="24" rx="5" ry="2.5" fill="#fff" opacity=".45"/>` +
      `<ellipse cx="40" cy="32" rx="4" ry="4.6" fill="#fff"/><circle cx="41.5" cy="33" r="2.3" fill="#1e1b2e"/><circle cx="42.4" cy="31.8" r=".8" fill="#fff"/>` +
      `<path d="M41 41 Q44 42.5 46.5 40" fill="none" stroke="#92400e" stroke-width="1.5" stroke-linecap="round"/>`,
      rad(b, "#fef3c7", "#f59e0b"));
  };

  A.tank = () => {
    const b = uid("kb"), p = uid("kp"), g = uid("kg");
    return svg(`${shadow(23, 57)}` +
      `<path d="M10 50 Q8 30 18 22 Q32 12 46 22 Q56 30 54 50 Q32 58 10 50Z" fill="url(#${b})"/>` +
      `<path d="M16 28 Q32 16 48 28 L45 36 Q32 30 19 36Z" fill="url(#${p})" stroke="#334155" stroke-width="1"/>` +
      `<path d="M13 40 Q32 34 51 40 L50 46 Q32 42 14 46Z" fill="url(#${p})" stroke="#334155" stroke-width="1"/>` +
      `<circle cx="22" cy="25" r="2" fill="#86efac" opacity=".8"/><circle cx="44" cy="44" r="2.5" fill="#86efac" opacity=".7"/><circle cx="47" cy="42" r="1.6" fill="#86efac" opacity=".7"/>` +
      `<g filter="url(#${g})"><ellipse cx="26" cy="31" rx="3.2" ry="2" fill="#fbbf24"/><ellipse cx="38" cy="31" rx="3.2" ry="2" fill="#fbbf24"/></g>`,
      rad(b, "#cbd5e1", "#64748b", .4, .25) + lin(p, "#94a3b8", "#475569") + glow(g, 1.2));
  };

  A.split = () => {
    const b = uid("sb");
    return svg(blob(b, "", "",
      `<path d="M32 17 Q30 26 33 33 Q30 41 32 52" fill="none" stroke="#065f46" stroke-width="1.6" stroke-dasharray="3 2.5"/>` +
      eyes(22, 27, 35, 3, .5) + eyes(37, 42, 35, 3, .5) +
      `<path d="M22 44 Q24.5 46 27 44 M37 44 Q39.5 46 42 44" fill="none" stroke="#065f46" stroke-width="1.4" stroke-linecap="round"/>`, 1, 22, 18),
      rad(b, "#a7f3d0", "#10b981"));
  };

  A.mini = () => {
    const b = uid("mb");
    return svg(blob(b, "", "", eyes(27, 37, 38, 3.2) + `<path d="M30 45 Q32 46.8 34 45" fill="none" stroke="#065f46" stroke-width="1.3" stroke-linecap="round"/>`, 1, 14, 12),
      rad(b, "#d1fae5", "#34d399"));
  };

  // ---------------- Boss ----------------
  A.boss1 = () => { // 巢母：戴王冠的大史莱姆，身边有卵
    const b = uid("b1"), c = uid("b1c"), e = uid("b1e");
    return svg(`${shadow(26, 57)}` +
      `<path d="M7 48 Q6 18 32 16 Q58 18 57 48 Q57 55 32 55 Q7 55 7 48Z" fill="url(#${b})"/>` +
      `<ellipse cx="20" cy="27" rx="7" ry="4" fill="#fff" opacity=".35" transform="rotate(-25 20 27)"/>` +
      `<path d="M19 18 L21 7 L27 13 L32 4 L37 13 L43 7 L45 18Z" fill="url(#${c})" stroke="#a16207" stroke-width="1"/>` +
      `<circle cx="32" cy="12" r="2" fill="#f472b6"/>` +
      eyes(22, 32, 33, 4.2, .5) + `<ellipse cx="42" cy="33" rx="4.2" ry="4.8" fill="#fff"/><circle cx="42.5" cy="34" r="2.3" fill="#1e1b2e"/>` +
      `<path d="M25 44 Q32 49 39 44" fill="none" stroke="#4c1d95" stroke-width="2" stroke-linecap="round"/>` +
      `<ellipse cx="9" cy="53" rx="4" ry="5" fill="url(#${e})"/><ellipse cx="56" cy="53" rx="3.5" ry="4.5" fill="url(#${e})"/><ellipse cx="50" cy="57" rx="3" ry="3.8" fill="url(#${e})"/>`,
      rad(b, "#f5d0fe", "#9333ea") + lin(c, "#fde68a", "#eab308") + rad(e, "#fdf4ff", "#d8b4fe"));
  };

  A.boss2 = () => { // 棱镜守卫：彩色晶体傀儡
    const g = uid("b2g"), a = uid("b2a"), b = uid("b2b"), c = uid("b2c");
    return svg(`${shadow(24, 58)}` +
      `<polygon points="8,40 16,26 22,44 14,54" fill="url(#${b})"/><polygon points="56,40 48,26 42,44 50,54" fill="url(#${c})"/>` +
      `<polygon points="32,4 48,18 46,46 32,56 18,46 16,18" fill="url(#${a})" stroke="#e0e7ff" stroke-width="1"/>` +
      `<polygon points="32,4 48,18 32,26 16,18" fill="#fff" opacity=".35"/>` +
      `<polygon points="32,26 46,46 32,56" fill="#1e1b4b" opacity=".2"/>` +
      `<path d="M32 4 V26 M16 18 L32 26 L48 18 M32 26 V56" stroke="#e0e7ff" stroke-width=".8" opacity=".8"/>` +
      `<g filter="url(#${g})"><ellipse cx="32" cy="34" rx="6.5" ry="5" fill="#fff"/><circle cx="32" cy="34.5" r="3.2" fill="#f472b6"/><circle cx="32" cy="34.5" r="1.4" fill="#1e1b2e"/></g>`,
      lin(a, "#a5f3fc", "#818cf8", 1, 1) + lin(b, "#fde68a", "#f472b6") + lin(c, "#f9a8d4", "#22d3ee") + glow(g, 1.5));
  };

  A.boss3 = () => { // 暴君：披甲、长角、披风
    const k = uid("b3k"), a = uid("b3a"), h = uid("b3h"), g = uid("b3g");
    return svg(`${shadow(25, 58)}` +
      `<path d="M10 54 Q12 30 32 28 Q52 30 54 54 Q32 60 10 54Z" fill="url(#${k})"/>` +
      `<path d="M14 52 Q18 36 32 34 Q46 36 50 52" fill="none" stroke="#7f1d1d" stroke-width="1" opacity=".6"/>` +
      `<path d="M17 38 Q16 18 32 15 Q48 18 47 38 Q47 46 32 47 Q17 46 17 38Z" fill="url(#${a})" stroke="#1e1b2e" stroke-width="1.2"/>` +
      `<path d="M18 24 Q8 18 9 6 Q14 15 22 17Z" fill="url(#${h})"/><path d="M46 24 Q56 18 55 6 Q50 15 42 17Z" fill="url(#${h})"/>` +
      `<path d="M21 31 H43 L41 36 H23Z" fill="#1e1b2e"/>` +
      `<g filter="url(#${g})"><path d="M24 33.5 L30 32.5 L29 35Z M40 33.5 L34 32.5 L35 35Z" fill="#f87171"/></g>` +
      `<path d="M32 15 V28" stroke="#cbd5e1" stroke-width="1.2" opacity=".6"/>` +
      `<circle cx="32" cy="41" r="2.4" fill="#fbbf24" stroke="#92400e" stroke-width=".8"/>`,
      lin(k, "#7f1d1d", "#450a0a") + rad(a, "#6b7280", "#1f2937", .4, .3) + lin(h, "#fef3c7", "#d97706") + glow(g, 1.4));
  };

  // ---------------- 地块 ----------------
  A.grass = (alt) => {
    const t = uid("gt");
    return svg(`<rect width="64" height="64" fill="url(#${t})"/>` +
      `<path d="M10 18 l2 -5 l2 5 M40 44 l2 -5 l2 5 M48 14 l1.5 -4 l1.5 4 M18 50 l1.5 -4 l1.5 4" stroke="#4d7c3a" stroke-width="1.2" fill="none" opacity=".6"/>` +
      `<circle cx="30" cy="28" r="1.2" fill="#f9a8d4" opacity=".7"/><circle cx="52" cy="36" r="1" fill="#fde68a" opacity=".7"/>`,
      lin(t, alt ? "#3f6b34" : "#447339", alt ? "#365c2d" : "#3a6431"));
  };
  A.path = () => {
    const t = uid("pt");
    return svg(`<rect width="64" height="64" fill="url(#${t})"/>` +
      `<ellipse cx="16" cy="18" rx="6" ry="4" fill="#9a8468" opacity=".55"/><ellipse cx="44" cy="40" rx="8" ry="5" fill="#9a8468" opacity=".5"/>` +
      `<ellipse cx="46" cy="14" rx="4" ry="3" fill="#7a6650" opacity=".5"/><ellipse cx="18" cy="48" rx="5" ry="3" fill="#7a6650" opacity=".5"/>`,
      lin(t, "#b59c7a", "#a08866"));
  };
  A.highland = () => {
    const t = uid("ht");
    return svg(`<rect width="64" height="64" fill="#3a6431"/>` +
      `<path d="M6 46 L14 16 H50 L58 46 Z" fill="#6b5a45"/><path d="M14 16 H50 L54 30 H10Z" fill="url(#${t})"/>` +
      `<path d="M28 23 l4 -4 l4 4" stroke="#fde68a" stroke-width="2" fill="none" stroke-linecap="round"/>`,
      lin(t, "#6aa84f", "#4d7c3a"));
  };
  A.runewell = () => {
    const t = uid("rt"), g = uid("rg");
    return svg(`<rect width="64" height="64" fill="#3a6431"/>` +
      `<circle cx="32" cy="32" r="22" fill="#5b6478" stroke="#8b93ad" stroke-width="3"/>` +
      `<circle cx="32" cy="32" r="15" fill="url(#${t})" filter="url(#${g})"/>` +
      `<path d="M32 22 V42 M26 27 L38 37 M38 27 L26 37" stroke="#e0f2fe" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>`,
      rad(t, "#a5f3fc", "#6366f1", .5, .5) + glow(g, 2));
  };
  A.swamp = () => {
    const t = uid("wt");
    return svg(`<rect width="64" height="64" fill="url(#${t})"/>` +
      `<circle cx="20" cy="22" r="3" fill="none" stroke="#a3b18a" stroke-width="1.2" opacity=".7"/><circle cx="44" cy="40" r="4" fill="none" stroke="#a3b18a" stroke-width="1.2" opacity=".7"/>` +
      `<circle cx="40" cy="18" r="1.6" fill="#a3b18a" opacity=".7"/><path d="M10 48 Q16 44 22 48 T34 48" stroke="#a3b18a" stroke-width="1.2" fill="none" opacity=".6"/>`,
      lin(t, "#4a5a3a", "#36442a"));
  };

  A.list = {
    towers: [["arrow", "箭塔"], ["cannon", "炮塔"], ["frost", "冰塔"], ["tesla", "电塔"]],
    enemies: [["norm", "史莱姆"], ["fast", "风灵"], ["tank", "石甲兽"], ["split", "双生史莱姆"], ["mini", "小史莱姆"]],
    bosses: [["boss1", "巢母"], ["boss2", "棱镜守卫"], ["boss3", "暴君"]],
    tiles: [["grass", "草地"], ["path", "道路"], ["highland", "高地 · 射程+1"], ["runewell", "符文井 · 相邻伤害+20%"], ["swamp", "沼泽 · 敌人减速"]],
  };
  root.RuneArt = A;
})(typeof window !== "undefined" ? window : globalThis);
