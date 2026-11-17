// 符文塔防 · 矢量美术 v0.4：卡通厚涂风
// - 每个函数返回一段独立的 <svg>，viewBox 统一 64×64，id 自动加前缀避免冲突。
// - 风格：深色描边 + 三层明暗（暗部 / 亮部 / 边缘光）+ 接地阴影；Q 版符文奇幻，圆润、不血腥。
// - 塔分两层：塔基（xxxBase）+ 炮头（xxxTop）。炮头统一朝上（12 点方向）绘制，旋转中心在 (32,32)；
//   游戏里把炮头的 (32,32) 放在塔基的 (32,TOP_Y) 处。xxx() 是两层合成后的完整图标（建塔按钮用）。
(function (root) {
  "use strict";
  let seq = 0;
  const uid = p => `${p}${++seq}`;
  const O = "#1a1528"; // 描边色
  const TOP_Y = 22;    // 炮头中心在塔基图里的纵坐标
  const svg = (inner, defs = "") =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${defs ? `<defs>${defs}</defs>` : ""}${inner}</svg>`;
  const lin = (id, stops, x2 = 0, y2 = 1) =>
    `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}</linearGradient>`;
  const rad = (id, a, b, cx = .36, cy = .3, r = .78) =>
    `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
  const glow = (id, sd = 1.4) =>
    `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${sd}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  const shadow = (rx = 18, cy = 56, ry) => `<ellipse cx="32" cy="${cy}" rx="${rx}" ry="${ry || rx * .26}" fill="#000" opacity=".35"/>`;
  // 卡通眼睛：白眼球带描边、黑瞳、高光
  const eye = (x, y, r = 4.4, look = 1.1, lid = 0) =>
    `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.17}" fill="#fff" stroke="${O}" stroke-width="1.1"/>` +
    `<ellipse cx="${x + look}" cy="${y + .9}" rx="${r * .56}" ry="${r * .66}" fill="${O}"/>` +
    `<circle cx="${x + look + r * .25}" cy="${y - r * .12}" r="${r * .22}" fill="#fff"/>` +
    (lid ? `<path d="M${x - r * 1.1} ${y - r * .55} L${x + r * 1.1} ${y - r * (.55 - lid)}" stroke="${O}" stroke-width="2" stroke-linecap="round"/>` : "");

  const A = {};
  const P = {}; // 片段：返回 [inner, defs]

  // ======================= 塔基 =======================
  // 4 个等级：1 木台（简陋）→ 2 石台 → 3 钢箍加固 → 4 黑曜石金边（最牛）。炮头中心统一在 (32,TOP_Y)。
  // 金属材质按等级：1 铁/木，2 银，3 钢蓝，4 金
  const MET = [null,
    [[0, "#9ca3af"], [1, "#4b5563"]],
    [[0, "#e2e8f0"], [1, "#7c879e"]],
    [[0, "#cfe0f5"], [.5, "#7b93b5"], [1, "#3c4d6b"]],
    [[0, "#fff3b0"], [.35, "#fbbf24"], [.7, "#d97706"], [1, "#92400e"]]];
  P.base = (runeColor, runePath, lvl = 2) => {
    const top = uid("bt"), front = uid("bf"), g = uid("bg"), plate = uid("bp"), mt = uid("bm");
    const rune = `<path d="${runePath}" stroke="${runeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none" filter="url(#${g})"/>`;
    const body = `<path d="M10 34 L12 52 Q32 60 52 52 L54 34 Z" fill="url(#${front})" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>`;
    const topE = `<ellipse cx="32" cy="34" rx="22" ry="8" fill="url(#${top})" stroke="${O}" stroke-width="1.6"/>`;
    const plateP = `<path d="M26 45 h12 l-1 9 h-10 Z" fill="url(#${plate})" stroke="${O}" stroke-width="1.2" stroke-linejoin="round"/>`;
    const sh = `<ellipse cx="32" cy="57" rx="${lvl >= 3 ? 24 : 22}" ry="5" fill="#000" opacity=".35"/>`;
    const moss = `<path d="M11 35 q3 -3 6 -.5 q2 -2 4 .5 q-4 3 -10 0Z" fill="#4d7c3a" stroke="${O}" stroke-width=".8"/>`;
    if (lvl === 1) {
      // 木台：竖木板 + 两道麻绳，顶面是拼木板
      return [sh + body +
        `<path d="M17 36 V54 M24 38 V56.5 M32 38.6 V57.5 M40 38 V56.5 M47 36 V54" stroke="#5b3a1d" stroke-width="1.1" opacity=".75"/>` +
        `<path d="M11 40 Q32 47 53 40" fill="none" stroke="${O}" stroke-width="3"/><path d="M11 40 Q32 47 53 40" fill="none" stroke="#c9a46a" stroke-width="1.6" stroke-dasharray="2 1.4"/>` +
        `<path d="M12 49 Q32 56 52 49" fill="none" stroke="${O}" stroke-width="3"/><path d="M12 49 Q32 56 52 49" fill="none" stroke="#c9a46a" stroke-width="1.6" stroke-dasharray="2 1.4"/>` +
        topE + `<path d="M15 31 L49 37 M13 34.5 L44 40 M20 28.5 L51 33.5" stroke="#6b4423" stroke-width="1" opacity=".6"/>` +
        `<circle cx="22" cy="31" r=".9" fill="#3b2412"/><circle cx="42" cy="36.5" r=".9" fill="#3b2412"/>` +
        `<path d="M27 44 h10 l-.6 7 h-8.8 Z" fill="#a47148" stroke="${O}" stroke-width="1.1" stroke-linejoin="round"/>` +
        `<g transform="translate(0 -1.6) scale(1)">${rune.replace('stroke-width="1.8"', 'stroke-width="1.5"')}</g>`,
        lin(top, [[0, "#d1a26a"], [1, "#94653a"]]) + lin(front, [[0, "#a87545"], [.6, "#7c522d"], [1, "#5a3a1e"]]) + glow(g, 1)];
    }
    if (lvl === 2) {
      return [sh + body +
        `<path d="M11 43 Q32 50 53 43" fill="none" stroke="#2b3047" stroke-width="1" opacity=".7"/>` +
        `<path d="M18 37 V44.5 M27 39 V46.5 M37 39 V46.5 M46 37 V44.5 M22 46.5 V55 M42 46.5 V55" stroke="#2b3047" stroke-width="1" opacity=".55"/>` +
        `<path d="M13 35 Q32 42 51 35" fill="none" stroke="#c4cbe0" stroke-width="1" opacity=".5"/>` + topE +
        `<ellipse cx="32" cy="34" rx="15" ry="5" fill="none" stroke="#5d6680" stroke-width="1" opacity=".7"/>` + moss +
        `<path d="M44 45.5 q3 -2.5 6 -1 q2 -1 3 -4 q1 4 -2 6 q-4 1.5 -7 -1Z" fill="#5b8c43" stroke="${O}" stroke-width=".8"/>` + plateP + rune,
        lin(top, [[0, "#b7bfd6"], [1, "#7f88a6"]]) + lin(front, [[0, "#6e7795"], [.6, "#4b5270"], [1, "#363b55"]]) + lin(plate, [[0, "#3a3f58"], [1, "#24283b"]]) + glow(g)];
    }
    // 3 级与 4 级：更宽的底座、钢/金箍、城垛、扶壁
    const gold = lvl === 4;
    const merl = [-18, -9, 0, 9, 18].map(dx => { const x = 32 + dx, y = 34 + 7.6 * Math.sqrt(1 - (dx / 22) ** 2) - 1; return `<path d="M${x - 3} ${y} v-4.2 h6 v4.2 Z" fill="url(#${gold ? mt : front})" stroke="${O}" stroke-width="1" stroke-linejoin="round"/>`; }).join("");
    const band = y => `<path d="M${10.6 + (y - 34) * .12} ${y} Q32 ${y + 7.4} ${53.4 - (y - 34) * .12} ${y}" fill="none" stroke="${O}" stroke-width="3.8"/><path d="M${10.6 + (y - 34) * .12} ${y} Q32 ${y + 7.4} ${53.4 - (y - 34) * .12} ${y}" fill="none" stroke="url(#${mt})" stroke-width="2.2"/>`;
    const rivets = y => [16, 24, 32, 40, 48].map(x => `<circle cx="${x}" cy="${y + 3.6 * (1 - ((x - 32) / 22) ** 2) + .6}" r="1" fill="${gold ? "#fff3b0" : "#e2e8f0"}" stroke="${O}" stroke-width=".5"/>`).join("");
    const butt = `<path d="M8 36 L11 54 L15 55 L13 37 Z M56 36 L53 54 L49 55 L51 37 Z" fill="url(#${mt})" stroke="${O}" stroke-width="1.2" stroke-linejoin="round"/>`;
    const gem = gold ? `<path d="M32 43.2 l3.6 3.4 l-3.6 3.4 l-3.6 -3.4 Z" fill="${runeColor}" stroke="${O}" stroke-width="1" filter="url(#${g})"/><path d="M32 43.6 l1.6 1.6 l-1.6 1.6 Z" fill="#fff" opacity=".8"/>` : "";
    const runeRing = gold ? `<ellipse cx="32" cy="34" rx="18" ry="5.6" fill="none" stroke="${runeColor}" stroke-width="1.4" stroke-dasharray="3 2.2" opacity=".95" filter="url(#${g})"/>` : `<ellipse cx="32" cy="34" rx="15" ry="5" fill="none" stroke="#5d6680" stroke-width="1" opacity=".7"/>`;
    return [sh + butt + body +
      `<path d="M18 37 V44.5 M27 39 V46.5 M37 39 V46.5 M46 37 V44.5 M22 46.5 V55 M42 46.5 V55" stroke="${gold ? "#0b0a1a" : "#232838"}" stroke-width="1" opacity=".55"/>` +
      band(38) + rivets(38) + band(50) + topE + runeRing + merl +
      `<path d="M26 45 h12 l-1 9 h-10 Z" fill="url(#${plate})" stroke="${O}" stroke-width="1.2" stroke-linejoin="round"/>` +
      (gold ? gem + `<g transform="translate(0 3.2)">${rune}</g>` : rune) +
      (gold ? `<circle cx="9" cy="28" r="1.2" fill="#fff7d6"/><circle cx="55" cy="25" r="1" fill="#fff7d6"/><circle cx="50" cy="44" r=".8" fill="${runeColor}"/>` : ""),
      lin(top, gold ? [[0, "#4b4f7a"], [1, "#262842"]] : [[0, "#a3abc4"], [1, "#68708e"]]) +
      lin(front, gold ? [[0, "#3a3d63"], [.6, "#24263f"], [1, "#16172a"]] : [[0, "#5d6684"], [.6, "#40465f"], [1, "#2c3046"]]) +
      lin(plate, [[0, "#3a3f58"], [1, "#24283b"]]) + lin(mt, MET[lvl]) + glow(g, gold ? 1.8 : 1.4)];
  };
  const RUNES = {
    arrow: ["#4ade80", "M32 47 v5.5 M29.2 49.6 l2.8 -2.6 l2.8 2.6"],
    cannon: ["#fb923c", "M29 47.5 l6 5 M35 47.5 l-6 5"],
    frost: ["#7dd3fc", "M32 46.6 v6.8 M29 48.3 l6 3.4 M35 48.3 l-6 3.4"],
    tesla: ["#d8b4fe", "M33.6 46.4 l-3.4 3.8 h3.6 l-3.4 3.8"],
  };

  // ======================= 炮头 =======================
  // 箭塔：1 木弓 → 2 弩车 → 3 钢弩（双弦、侧挂箭）→ 4 金色翼弩（发光箭头）
  P.arrowTop = (lvl = 2) => {
    const wd = uid("aw"), wd2 = uid("ax"), mt = uid("am"), g = uid("ag"), tip = uid("at");
    const L = lvl, limbW = [0, 4.6, 6.2, 7, 7.4][L], limbC = L >= 3 ? `url(#${mt})` : `url(#${wd})`;
    const bow = L === 1 ? "M14 28 Q32 16 50 28" : L === 4 ? "M8 30 Q14 14 32 17 Q50 14 56 30" : "M11 27 Q32 13 53 27";
    const ends = L === 1 ? [[14, 28], [50, 28]] : L === 4 ? [[8, 30], [56, 30]] : [[11, 27], [53, 27]];
    let o = "";
    o += `<ellipse cx="32" cy="35" rx="${L === 1 ? 9 : 11}" ry="${L === 1 ? 8 : 10}" fill="url(#${wd2})" stroke="${O}" stroke-width="1.6"/>`;
    if (L >= 2) o += `<ellipse cx="32" cy="35" rx="7" ry="6" fill="none" stroke="${L === 4 ? "#fbbf24" : "#5c3d22"}" stroke-width="1"/>`;
    if (L === 4) o += `<path d="M10 30 q-6 -4 -5 -11 q4 5 9 6 Z M54 30 q6 -4 5 -11 q-4 5 -9 6 Z" fill="url(#${mt})" stroke="${O}" stroke-width="1" stroke-linejoin="round"/>`;
    o += `<path d="${bow}" fill="none" stroke="${O}" stroke-width="${limbW}" stroke-linecap="round"/>` + `<path d="${bow}" fill="none" stroke="${limbC}" stroke-width="${limbW - 2.6}" stroke-linecap="round"/>`;
    if (L <= 2) o += `<path d="${bow}" fill="none" stroke="#f3d6a6" stroke-width=".9" stroke-linecap="round" opacity=".7" transform="translate(0 -1)"/>`;
    for (const [x, y] of ends) o += `<circle cx="${x}" cy="${y}" r="${L === 1 ? 1.6 : 2.2}" fill="${L === 1 ? "#5a3a1e" : `url(#${mt})`}" stroke="${O}" stroke-width="1"/>`;
    o += `<path d="M${ends[0][0] + .5} ${ends[0][1] + .5} L32 36 L${ends[1][0] - .5} ${ends[1][1] + .5}" fill="none" stroke="#f1f5f9" stroke-width="1.1"/>`;
    if (L >= 3) o += `<path d="M${ends[0][0] + 1} ${ends[0][1] + 2.5} L32 38.5 L${ends[1][0] - 1} ${ends[1][1] + 2.5}" fill="none" stroke="#f1f5f9" stroke-width=".9" opacity=".85"/>`;
    const sw = L === 1 ? 5.4 : 7;
    o += `<path d="M${32 - sw / 2} 12 h${sw} l1 30 h-${sw + 2} Z" fill="url(#${wd})" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>`;
    if (L >= 2) o += `<rect x="27.6" y="22" width="8.8" height="3" rx="1" fill="url(#${mt})" stroke="${O}" stroke-width="1"/><rect x="27.4" y="33" width="9.2" height="3" rx="1" fill="url(#${mt})" stroke="${O}" stroke-width="1"/>`;
    if (L >= 3) for (const dx of [-8.5, 8.5]) o += `<path d="M${32 + dx} 38 V18" stroke="#e7e2d6" stroke-width="1.3"/><path d="M${32 + dx - 1.8} 19 L${32 + dx} 14.6 L${32 + dx + 1.8} 19 Z" fill="${L === 4 ? `url(#${tip})` : "#cbd5e1"}" stroke="${O}" stroke-width=".8"/>`;
    if (L === 4) o += `<path d="M32 27.6 l2.6 2.6 l-2.6 2.6 l-2.6 -2.6 Z" fill="#4ade80" stroke="${O}" stroke-width=".9" filter="url(#${g})"/>`;
    o += `<path d="M32 36 V9" stroke="#e7e2d6" stroke-width="1.6"/><path d="M29.6 34 l2.4 3 l2.4 -3" fill="#4ade80" stroke="${O}" stroke-width=".8"/>`;
    o += L === 1 ? `<path d="M32 4.5 L35 10 L32 9 L29 10 Z" fill="#9ca3af" stroke="${O}" stroke-width="1" stroke-linejoin="round"/>`
      : `<path d="M32 ${L === 4 ? 1 : 3} L${L === 4 ? 37 : 36} 10 L32 8.6 L${L === 4 ? 27 : 28} 10 Z" fill="url(#${tip})" stroke="${O}" stroke-width="1" stroke-linejoin="round" filter="url(#${g})"/>`;
    return [o,
      lin(wd, L === 1 ? [[0, "#b08155"], [1, "#6e4726"]] : L === 3 ? [[0, "#8a6040"], [.5, "#6b4528"], [1, "#43291a"]] : L === 4 ? [[0, "#5b3b6e"], [.5, "#3f2552"], [1, "#24142f"]] : [[0, "#c8955c"], [.5, "#a0703f"], [1, "#6e4726"]], 1, 0) +
      rad(wd2, L === 4 ? "#4c2f5c" : "#9b6a3a", L === 4 ? "#22132b" : "#5a3a1e") + lin(mt, MET[Math.max(2, L)]) +
      lin(tip, L === 4 ? [[0, "#ffffff"], [.4, "#bbf7d0"], [1, "#16a34a"]] : [[0, "#dcfce7"], [1, "#16a34a"]]) + glow(g, L === 4 ? 1.8 : 1.2)];
  };
  // 炮塔：1 铁皮短炮 → 2 青铜炮 → 3 钢炮（加长、炮口制退器）→ 4 金色巨炮（发光炮膛）
  P.cannonTop = (lvl = 2) => {
    const br = uid("cb"), rg = uid("cr"), g = uid("cg"), dk = uid("cd");
    const L = lvl, top = [0, 17, 11, 7, 5][L], hw = [0, 6, 5.4, 5.6, 6.2][L], bw = hw + 2;
    let o = `<ellipse cx="32" cy="38" rx="${L >= 3 ? 13 : 12}" ry="9" fill="url(#${dk})" stroke="${O}" stroke-width="1.6"/>`;
    o += `<rect x="16.5" y="32" width="6" height="10" rx="2" fill="${L === 4 ? "#3f2552" : "#5a3a1e"}" stroke="${O}" stroke-width="1.3"/><rect x="41.5" y="32" width="6" height="10" rx="2" fill="${L === 4 ? "#3f2552" : "#5a3a1e"}" stroke="${O}" stroke-width="1.3"/>`;
    o += `<circle cx="19.5" cy="37" r="1.4" fill="${L === 4 ? "#fde68a" : "#cbd5e1"}"/><circle cx="44.5" cy="37" r="1.4" fill="${L === 4 ? "#fde68a" : "#cbd5e1"}"/>`;
    o += `<circle cx="32" cy="40" r="${L === 1 ? 9 : 8.5}" fill="url(#${br})" stroke="${O}" stroke-width="1.6"/>`;
    o += `<path d="M${32 - bw} 38 L${32 - hw} ${top + 4} H${32 + hw} L${32 + bw} 38 Z" fill="url(#${br})" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>`;
    o += `<path d="M${32 - hw + 2} ${top + 6} L${32 - bw + 2.6} 36" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity="${L === 1 ? .25 : .5}"/>`;
    const ring = y => { const t = (38 - y) / (38 - top - 4), w = bw - (bw - hw) * t; return `<path d="M${32 - w} ${y} H${32 + w}" stroke="${O}" stroke-width="3.6"/><path d="M${32 - w} ${y} H${32 + w}" stroke="url(#${rg})" stroke-width="2"/>`; };
    if (L === 1) o += ring(28);
    else if (L === 2) o += ring(29) + ring(19);
    else o += ring(31) + ring(23) + ring(15);
    if (L === 4) o += `<path d="M27.5 27 q4.5 -4 9 0 M27.5 20 q4.5 -4 9 0" fill="none" stroke="#fff3b0" stroke-width="1" opacity=".8"/>`;
    // 炮口
    if (L >= 3) o += `<path d="M${32 - hw - 2.6} ${top + 5} L${32 - hw - 1} ${top - 1.5} H${32 + hw + 1} L${32 + hw + 2.6} ${top + 5} Z" fill="url(#${br})" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M${32 - hw - 1.4} ${top + 2} H${32 + hw + 1.4}" stroke="${O}" stroke-width="1"/>`;
    else o += `<rect x="${32 - hw - 1}" y="${top - .5}" width="${(hw + 1) * 2}" height="5" rx="2" fill="url(#${br})" stroke="${O}" stroke-width="1.6"/>`;
    o += `<ellipse cx="32" cy="${top + .6}" rx="${hw - .8}" ry="1.8" fill="${L === 4 ? "#7c2d12" : "#120d10"}"/>`;
    if (L === 4) o += `<ellipse cx="32" cy="${top + .6}" rx="${hw - 2.2}" ry="1" fill="#fb923c" filter="url(#${g})"/>`;
    o += `<circle cx="32" cy="42" r="${L === 4 ? 3 : 2.2}" fill="#fb923c" filter="url(#${g})"/>`;
    const BR = [null,
      [[0, "#3f3f46"], [.35, "#a1a1aa"], [.5, "#d4d4d8"], [.8, "#52525b"], [1, "#27272a"]],
      [[0, "#7a4a1c"], [.3, "#e0a85a"], [.45, "#f6cf86"], [.75, "#a8692c"], [1, "#5e3713"]],
      [[0, "#334155"], [.3, "#94a3b8"], [.45, "#e2e8f0"], [.75, "#64748b"], [1, "#1e293b"]],
      [[0, "#92400e"], [.3, "#fbbf24"], [.45, "#fff3b0"], [.75, "#d97706"], [1, "#78350f"]]];
    return [o, lin(br, BR[L], 1, 0) + lin(rg, L === 4 ? [[0, "#5b21b6"], [.4, "#c4b5fd"], [1, "#3b0764"]] : [[0, "#6b7280"], [.4, "#e5e7eb"], [1, "#4b5563"]], 1, 0) +
      rad(dk, L === 4 ? "#4c2f5c" : "#7a5232", L === 4 ? "#22132b" : "#3f2814") + glow(g, L === 4 ? 1.8 : 1.3)];
  };
  // 冰塔：1 小冰晶木托 → 2 主晶 + 两侧晶 → 3 大晶 + 四侧晶 → 4 冰晶王冠（双光环、闪光）
  P.frostTop = (lvl = 2) => {
    const c = uid("fc"), d = uid("fd"), g = uid("fg"), cup = uid("fu");
    const L = lvl;
    let o = L === 1
      ? `<path d="M24 44 L26 36 h12 L40 44 Z" fill="#8a5a33" stroke="${O}" stroke-width="1.3" stroke-linejoin="round"/><ellipse cx="32" cy="36" rx="6" ry="2" fill="#a47148" stroke="${O}" stroke-width="1.1"/>`
      : `<path d="M20 44 L25 33 L28 40 Z M44 44 L39 33 L36 40 Z" fill="url(#${cup})" stroke="${O}" stroke-width="1.3" stroke-linejoin="round"/><ellipse cx="32" cy="42" rx="9" ry="3.4" fill="url(#${cup})" stroke="${O}" stroke-width="1.3"/>`;
    if (L >= 2) o += `<ellipse cx="32" cy="27" rx="18" ry="5" fill="none" stroke="#bae6fd" stroke-width="1.2" opacity=".75"/>`;
    if (L === 4) o += `<ellipse cx="32" cy="17" rx="13" ry="3.6" fill="none" stroke="#f0f9ff" stroke-width="1.2" opacity=".9" filter="url(#${g})"/>`;
    const side = (x, h, w = 4) => `<path d="M${x - w} 31 L${x} ${31 - h} L${x + w} 31 L${x} 35 Z" fill="url(#${d})" stroke="${O}" stroke-width="1.2" stroke-linejoin="round"/>`;
    if (L >= 3) o += side(13.5, 10, 3) + side(50.5, 11, 3);
    if (L >= 2) o += side(21, L >= 3 ? 16 : 13) + side(43, L >= 3 ? 18 : 15);
    const ty = [0, 12, 3, 0, -2][L], wd = [0, 6, 9, 10, 10.5][L], by = L === 1 ? 37 : 38;
    o += `<path d="M32 ${ty} L${32 + wd} ${ty + 16} L32 ${by} L${32 - wd} ${ty + 16} Z" fill="url(#${c})" stroke="${O}" stroke-width="1.6" stroke-linejoin="round" filter="url(#${g})"/>`;
    o += `<path d="M32 ${ty} L32 ${by} L${32 - wd} ${ty + 16} Z" fill="#fff" opacity=".38"/><path d="M32 ${ty} L${32 + wd} ${ty + 16} L32 ${by}" fill="none" stroke="#e0f2fe" stroke-width=".9"/>`;
    o += `<path d="M${32 - wd * .5} ${ty + 12} L${32 - wd * .22} ${ty + 7}" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`;
    if (L === 4) o += [[32, ty + 18, 2.4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" filter="url(#${g})"/>`).join("") +
      `<path d="M53 8 l1 2.6 l2.6 1 l-2.6 1 l-1 2.6 l-1 -2.6 l-2.6 -1 l2.6 -1 Z M11 14 l.8 2 l2 .8 l-2 .8 l-.8 2 l-.8 -2 l-2 -.8 l2 -.8 Z" fill="#fff"/>`;
    if (L >= 2) o += `<circle cx="49" cy="12" r="1.3" fill="#fff"/><circle cx="14" cy="22" r="1" fill="#fff"/><circle cx="47" cy="34" r=".9" fill="#fff"/>`;
    return [o, lin(c, L === 4 ? [[0, "#ffffff"], [.45, "#a5f3fc"], [1, "#0369a1"]] : [[0, "#f0f9ff"], [.5, "#7dd3fc"], [1, "#0284c7"]], 1, 1) +
      lin(d, [[0, "#e0f2fe"], [1, "#0ea5e9"]], 1, 1) + lin(cup, MET[Math.max(2, L)]) + glow(g, L === 4 ? 2 : 1.4)];
  };
  // 电塔：1 木杆铜线 → 2 三圈铜线圈 → 3 四圈 + 两侧避雷针 → 4 金线圈 + 带环大能量球
  P.teslaTop = (lvl = 2) => {
    const p = uid("tp"), o2 = uid("to"), g = uid("tg"), cu = uid("tc");
    const L = lvl;
    const coil = (y, w = 9) => `<ellipse cx="32" cy="${y}" rx="${w - (38 - y) * .14}" ry="2.6" fill="none" stroke="${O}" stroke-width="3.6"/><ellipse cx="32" cy="${y}" rx="${w - (38 - y) * .14}" ry="2.6" fill="none" stroke="url(#${cu})" stroke-width="2"/>`;
    let o = `<ellipse cx="32" cy="42" rx="${L === 1 ? 8 : 10}" ry="3.6" fill="${L === 1 ? "#7c522d" : L === 4 ? "#2e2b4a" : "#475569"}" stroke="${O}" stroke-width="1.3"/>`;
    if (L >= 3) o += `<path d="M18 42 L20 22 M46 42 L44 22" stroke="${O}" stroke-width="3.6" stroke-linecap="round"/><path d="M18 42 L20 22 M46 42 L44 22" stroke="url(#${p})" stroke-width="2" stroke-linecap="round"/>` +
      `<circle cx="20" cy="21" r="2.6" fill="url(#${o2})" stroke="${O}" stroke-width="1"/><circle cx="44" cy="21" r="2.6" fill="url(#${o2})" stroke="${O}" stroke-width="1"/>`;
    o += L === 1 ? `<path d="M30 42 L30.6 18 H33.4 L34 42 Z" fill="#9b6a3a" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>`
      : `<path d="M27 42 L29.6 16 H34.4 L37 42 Z" fill="url(#${p})" stroke="${O}" stroke-width="1.5" stroke-linejoin="round"/>`;
    if (L === 1) o += coil(30, 6);
    else if (L === 2) o += coil(36) + coil(29) + coil(22);
    else o += coil(37, 9.6) + coil(31, 9.6) + coil(25, 9.6) + coil(19, 9.6);
    const orR = [0, 5.5, 8, 8.6, 9.6][L], oy = [0, 13, 11, 10, 9][L];
    if (L === 4) o += `<ellipse cx="32" cy="${oy}" rx="15" ry="4" fill="none" stroke="#fde68a" stroke-width="1.4" opacity=".9" filter="url(#${g})"/>`;
    o += `<circle cx="32" cy="${oy}" r="${orR}" fill="url(#${o2})" stroke="${O}" stroke-width="1.5" filter="url(#${g})"/><circle cx="${32 - orR * .35}" cy="${oy - orR * .33}" r="${orR * .3}" fill="#fff" opacity=".85"/>`;
    if (L >= 2) o += `<path d="M40 7 L45 4.5 L43.4 8.4 L49 6.4" fill="none" stroke="#f5d0fe" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 14 L19 13 L22 17 L16 17.4" fill="none" stroke="#f5d0fe" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (L === 4) o += `<path d="M22 4 L18 1 L19.4 5 L14 3.4 M43 16 L48 18 L45 19 L51 21" fill="none" stroke="#fdf4ff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`;
    return [o, lin(p, [[0, "#94a3b8"], [.5, "#475569"], [1, "#1e293b"]], 1, 0) +
      rad(o2, "#fdf4ff", L === 4 ? "#7e22ce" : "#9333ea", .4, .35, .7) +
      lin(cu, L === 4 ? [[0, "#fff3b0"], [.5, "#f59e0b"], [1, "#92400e"]] : L === 1 ? [[0, "#fcd9a5"], [1, "#b45309"]] : [[0, "#fcd9a5"], [.5, "#d97706"], [1, "#7c2d12"]], 1, 0) + glow(g, L === 4 ? 2.4 : 2)];
  };

  for (const k of ["arrow", "cannon", "frost", "tesla"]) {
    A[k + "Base"] = (lvl = 2) => { const [i, d] = P.base(...RUNES[k], lvl); return svg(i, d); };
    A[k + "Top"] = (lvl = 2) => { const [i, d] = P[k + "Top"](lvl); return svg(i, d); };
    // 合成图标：炮头中心 (32,32) 对齐到塔基 (32,TOP_Y)
    A[k] = (lvl = 2) => { const [bi, bd] = P.base(...RUNES[k], lvl), [ti, td] = P[k + "Top"](lvl); return svg(`<g transform="translate(5.5 9) scale(.83)">` + bi + `<g transform="translate(0 ${TOP_Y - 32})">${ti}</g></g>`, bd + td); };
  }
  A.TOP_Y = TOP_Y;

  // ======================= 敌人（默认朝右） =======================
  // 史莱姆
  A.norm = () => {
    const b = uid("nb"), sh = uid("ns");
    return svg(
      shadow(17, 55, 4.5) +
      `<path d="M13 50 Q11 30 24 20 Q32 13 40 20 Q53 30 51 50 Q44 55 32 55 Q20 55 13 50Z" fill="url(#${b})" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<path d="M15 47 Q22 53 32 53 Q42 53 49 47 Q48 52 32 54 Q17 53 15 47Z" fill="url(#${sh})" opacity=".8"/>` +
      `<path d="M21 27 Q25 20 31 19" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".75"/>` +
      `<circle cx="20" cy="33" r="1.6" fill="#fff" opacity=".7"/>` +
      `<path d="M48 36 Q50 42 48.5 47" fill="none" stroke="#fecaca" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>` +
      eye(25.5, 36, 4.6) + eye(38.5, 36, 4.6) +
      `<path d="M29 45 Q32 47.6 35 45" fill="none" stroke="${O}" stroke-width="1.5" stroke-linecap="round"/>` +
      `<ellipse cx="20.5" cy="43" rx="2.6" ry="1.4" fill="#fb7185" opacity=".55"/><ellipse cx="43.5" cy="43" rx="2.6" ry="1.4" fill="#fb7185" opacity=".55"/>`,
      rad(b, "#ff8a8a", "#c81e2e", .4, .3, .8) + lin(sh, [[0, "#7f1020"], [1, "#4c0714"]]));
  };
  // 风灵：带速度线的小旋风精灵
  A.fast = () => {
    const b = uid("fb"), w = uid("fw");
    return svg(
      shadow(14, 56, 3.6) +
      `<path d="M3 27 Q14 26 20 30 M1 37 Q12 35 18 39 M5 47 Q14 44 20 45" stroke="#fde68a" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".85"/>` +
      `<path d="M51 34 Q51 17 36 16 Q21 16 15 26 Q23 27 24 31 Q18 36 13 42 Q25 49 36 49 Q51 49 51 34Z" fill="url(#${b})" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<path d="M37 17 L41 7 L45 18 Z M45 20 L53 12 L51 24 Z" fill="url(#${w})" stroke="${O}" stroke-width="1.3" stroke-linejoin="round"/>` +
      `<path d="M28 21 Q34 18 40 19" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".75"/>` +
      `<path d="M22 44 Q30 47 40 46" fill="none" stroke="#b45309" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>` +
      eye(40.5, 32, 4.4, 1.4, .25) +
      `<path d="M40 41.5 Q43.5 43.5 47 40.5" fill="none" stroke="${O}" stroke-width="1.5" stroke-linecap="round"/>` +
      `<ellipse cx="46" cy="38" rx="2.2" ry="1.2" fill="#fb7185" opacity=".5"/>`,
      rad(b, "#fff3c4", "#e8900c", .45, .3, .8) + lin(w, [[0, "#fde68a"], [1, "#d97706"]]));
  };
  // 石甲兽：披石板的厚重怪
  A.tank = () => {
    const b = uid("kb"), p = uid("kp"), g = uid("kg"), m = uid("km");
    return svg(
      shadow(23, 57, 5.5) +
      `<path d="M9 50 Q7 29 18 21 Q32 11 46 21 Q57 29 55 50 Q32 59 9 50Z" fill="url(#${b})" stroke="${O}" stroke-width="1.9" stroke-linejoin="round"/>` +
      // 石板
      `<path d="M15 28 Q32 15 49 28 L46 37 Q32 30 18 37 Z" fill="url(#${p})" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<path d="M12 41 Q32 34 52 41 L51 48 Q32 43 13 48 Z" fill="url(#${p})" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<path d="M20 26 Q32 19 44 26" fill="none" stroke="#e2e8f0" stroke-width="1.2" opacity=".7"/>` +
      `<path d="M26 31 l2 3 M38 30 l-2 4 M22 44 l3 2 M40 43 l2 3" stroke="#334155" stroke-width="1" opacity=".7"/>` +
      // 苔藓
      `<path d="M47 45 q3 -3 5 -1 q-1 4 -5 3Z M17 24 q2 -3 5 -2 q-1 3 -5 2Z" fill="url(#${m})" stroke="${O}" stroke-width=".8"/>` +
      // 发光眼缝
      `<g filter="url(#${g})"><path d="M23 32 l7 -1 l-1 3 Z" fill="#fbbf24"/><path d="M41 32 l-7 -1 l1 3 Z" fill="#fbbf24"/></g>` +
      // 獠牙
      `<path d="M26 51 l1.5 -4 l1.5 4 Z M35 51 l1.5 -4 l1.5 4 Z" fill="#f8fafc" stroke="${O}" stroke-width=".9" stroke-linejoin="round"/>`,
      rad(b, "#9aa6b8", "#475569", .4, .25, .85) + lin(p, [[0, "#cbd5e1"], [1, "#64748b"]]) + lin(m, [[0, "#86efac"], [1, "#3f7a35"]]) + glow(g, 1.2));
  };
  // 双生史莱姆：中间一道缝，两张脸
  A.split = () => {
    const b = uid("sb"), sh = uid("ss");
    return svg(
      shadow(21, 55, 4.8) +
      `<path d="M9 49 Q8 26 22 19 Q32 14 42 19 Q56 26 55 49 Q46 55 32 55 Q18 55 9 49Z" fill="url(#${b})" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<path d="M12 46 Q22 53 32 53 Q42 53 52 46 Q51 52 32 54 Q13 52 12 46Z" fill="url(#${sh})" opacity=".75"/>` +
      `<path d="M32 16 Q29.5 26 33 33 Q29.5 42 32 54" fill="none" stroke="${O}" stroke-width="1.6" stroke-dasharray="3.2 2.4"/>` +
      `<path d="M16 28 Q20 21 26 20" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".7"/>` +
      eye(20.5, 35, 3.4, .6) + eye(27, 35, 3.4, .6) + eye(37.5, 35, 3.4, .6) + eye(44, 35, 3.4, .6) +
      `<path d="M21 44 Q23.8 46.4 26.6 44 M37.6 44 Q40.4 46.4 43.2 44" fill="none" stroke="${O}" stroke-width="1.4" stroke-linecap="round"/>`,
      rad(b, "#bdf7dc", "#0f9f6e", .4, .3, .82) + lin(sh, [[0, "#065f46"], [1, "#033b2c"]]));
  };
  // 小史莱姆
  A.mini = () => {
    const b = uid("mb");
    return svg(
      shadow(13, 54, 3.4) +
      `<path d="M18 50 Q17 34 26 29 Q32 26 38 29 Q47 34 46 50 Q40 54 32 54 Q24 54 18 50Z" fill="url(#${b})" stroke="${O}" stroke-width="1.7" stroke-linejoin="round"/>` +
      `<path d="M22 35 Q25 30 29 30" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".75"/>` +
      eye(27.5, 40, 3.4, .8) + eye(37, 40, 3.4, .8) +
      `<path d="M30 47 Q32.3 48.8 34.6 47" fill="none" stroke="${O}" stroke-width="1.3" stroke-linecap="round"/>`,
      rad(b, "#d9fbe9", "#22b07d", .4, .3, .8));
  };

  // ======================= 新怪（v0.7） =======================
  // 飞行蝠：圆滚滚的紫色蝙蝠，悬在半空（影子在地面）
  A.bat = () => {
    const b = uid("bb"), w = uid("bw");
    return svg(
      `<ellipse cx="32" cy="57" rx="11" ry="2.6" fill="#000" opacity=".28"/>` +
      `<path d="M27 26 Q14 12 3 20 Q8 22 7 27 Q12 25 14 30 Q18 27 21 32 Z" fill="url(#${w})" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M37 26 Q50 12 61 20 Q56 22 57 27 Q52 25 50 30 Q46 27 43 32 Z" fill="url(#${w})" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M10 22 L18 27 M54 22 L46 27" stroke="#3b0764" stroke-width="1" opacity=".6"/>` +
      `<path d="M23 20 L24 11 L29 17 Z M41 20 L40 11 L35 17 Z" fill="url(#${b})" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<ellipse cx="32" cy="29" rx="12" ry="11.5" fill="url(#${b})" stroke="${O}" stroke-width="1.8"/>` +
      `<path d="M25 22 Q28 19 32 19" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".6"/>` +
      eye(28, 28, 3.4, 1, .25) + eye(37, 28, 3.4, 1, .25) +
      `<path d="M30 35 Q32.5 37 35 35" fill="none" stroke="${O}" stroke-width="1.3" stroke-linecap="round"/>` +
      `<path d="M30.6 35.4 l.8 2 l.8 -1.6 M33.4 35.6 l.8 1.8 l.7 -1.8" fill="#fff" stroke="${O}" stroke-width=".6"/>` +
      `<path d="M29 40 l-1 4 M35 40 l1 4" stroke="${O}" stroke-width="1.6" stroke-linecap="round"/>`,
      rad(b, "#d8b4fe", "#6d28d9", .4, .3, .8) + lin(w, [[0, "#a78bfa"], [1, "#4c1d95"]]));
  };
  // 治疗萨满：戴叶子兜帽的小史莱姆，举着发光的木杖
  A.shaman = () => {
    const b = uid("hb"), h = uid("hh"), g = uid("hg");
    return svg(
      shadow(16, 55, 4.2) +
      `<path d="M50 54 L46 14" stroke="${O}" stroke-width="4" stroke-linecap="round"/><path d="M50 54 L46 14" stroke="#a16207" stroke-width="2.2" stroke-linecap="round"/>` +
      `<path d="M15 50 Q13 32 23 25 Q31 21 39 25 Q48 32 47 50 Q40 55 31 55 Q21 55 15 50Z" fill="url(#${b})" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<path d="M14 33 Q16 16 31 14 Q46 16 48 33 Q40 26 31 26 Q22 26 14 33Z" fill="url(#${h})" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M31 14 Q33 8 38 6 Q37 12 31 14Z" fill="url(#${h})" stroke="${O}" stroke-width="1.2" stroke-linejoin="round"/>` +
      `<path d="M20 26 Q31 20 42 26" fill="none" stroke="#bbf7d0" stroke-width="1" opacity=".7"/>` +
      eye(25.5, 37, 3.8, 1) + eye(35.5, 37, 3.8, 1) +
      `<path d="M28 46 Q31 48.2 34 46" fill="none" stroke="${O}" stroke-width="1.4" stroke-linecap="round"/>` +
      `<path d="M23 43 l2 -1 M37 42 l2 1" stroke="#065f46" stroke-width="1.6" stroke-linecap="round"/>` +
      `<g filter="url(#${g})"><circle cx="46" cy="12" r="4.2" fill="#86efac" stroke="${O}" stroke-width="1.2"/><path d="M46 9.5 v5 M43.5 12 h5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></g>` +
      `<path d="M41 15 Q44 17 44 20 M51 15 Q48 17 48 20" fill="none" stroke="#4ade80" stroke-width="1.6" stroke-linecap="round"/>` +
      `<ellipse cx="44" cy="40" rx="3.2" ry="2.8" fill="url(#${b})" stroke="${O}" stroke-width="1.2"/>`,
      rad(b, "#a7f3d0", "#0d9488", .4, .3, .82) + lin(h, [[0, "#4ade80"], [1, "#15803d"]]) + glow(g, 1.5));
  };
  // 盾兵：戴铁盔的橙色史莱姆，右侧（前方）举着一面大圆盾
  A.shieldman = () => {
    const b = uid("db"), s = uid("ds"), m = uid("dm");
    return svg(
      shadow(19, 56, 4.8) +
      `<path d="M10 50 Q8 31 19 24 Q28 19 37 24 Q46 31 45 50 Q38 55 27.5 55 Q16 55 10 50Z" fill="url(#${b})" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<path d="M12 31 Q13 16 27.5 15 Q42 16 43 31 Q36 27 27.5 27 Q19 27 12 31Z" fill="url(#${m})" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M27.5 15 V27" stroke="${O}" stroke-width="1.2"/><path d="M18 22 Q23 18 27 18" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>` +
      eye(22, 36, 3.6, 1.2, .35) + eye(31.5, 36, 3.6, 1.2, .35) +
      `<path d="M23 46 Q27 44.5 31 46" fill="none" stroke="${O}" stroke-width="1.5" stroke-linecap="round"/>` +
      `<ellipse cx="46" cy="38" rx="11" ry="15" fill="url(#${s})" stroke="${O}" stroke-width="2"/>` +
      `<ellipse cx="46" cy="38" rx="8" ry="11.5" fill="none" stroke="#fde68a" stroke-width="1.6" opacity=".9"/>` +
      `<circle cx="46" cy="38" r="3.4" fill="url(#${m})" stroke="${O}" stroke-width="1.2"/>` +
      `<path d="M39 30 Q41 25 45 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".6"/>` +
      `<circle cx="40" cy="45" r=".9" fill="#78350f"/><circle cx="52" cy="31" r=".9" fill="#78350f"/><circle cx="52" cy="45" r=".9" fill="#78350f"/>`,
      rad(b, "#fdba74", "#c2410c", .4, .3, .82) + lin(s, [[0, "#d6a15c"], [.6, "#a16207"], [1, "#713f12"]], 1, 1) + lin(m, [[0, "#e2e8f0"], [1, "#64748b"]]));
  };
  // 自爆甲虫：红色圆壳小甲虫，背上一根滋滋冒火星的引信
  A.beetle = () => {
    const b = uid("eb"), h = uid("eh"), g = uid("eg");
    return svg(
      shadow(17, 55, 4.2) +
      `<path d="M16 49 l-5 4 M22 52 l-3 5 M42 52 l3 5 M48 49 l5 4" stroke="${O}" stroke-width="2" stroke-linecap="round"/>` +
      `<ellipse cx="44" cy="40" rx="9" ry="8" fill="url(#${h})" stroke="${O}" stroke-width="1.7"/>` +
      `<path d="M10 42 Q10 22 29 21 Q46 22 46 42 Q44 52 28 52 Q12 52 10 42Z" fill="url(#${b})" stroke="${O}" stroke-width="1.9" stroke-linejoin="round"/>` +
      `<path d="M28 21.5 Q27 37 28 51.5" fill="none" stroke="${O}" stroke-width="1.4"/>` +
      `<circle cx="19" cy="33" r="3" fill="#450a0a" opacity=".55"/><circle cx="37" cy="31" r="2.6" fill="#450a0a" opacity=".55"/><circle cx="20" cy="44" r="2.2" fill="#450a0a" opacity=".55"/><circle cx="37" cy="44" r="2.8" fill="#450a0a" opacity=".55"/>` +
      `<path d="M15 28 Q20 23 26 23" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".65"/>` +
      `<path d="M28 21 Q27 14 31 10" fill="none" stroke="${O}" stroke-width="2.6" stroke-linecap="round"/><path d="M28 21 Q27 14 31 10" fill="none" stroke="#d6d3d1" stroke-width="1.2" stroke-linecap="round"/>` +
      `<g filter="url(#${g})"><path d="M31 10 l1.5 -4 l1 3.2 l3 -2 l-1.6 3.4 l3.6 .6 l-3.4 1.6 l1.4 3 l-3.2 -1.6 l-1 3 l-.8 -3.4 l-3 1Z" fill="#fde047" stroke="#f97316" stroke-width=".8"/></g>` +
      eye(44, 38, 3.2, 1.1) + eye(50.5, 38.5, 2.6, .9) +
      `<path d="M45 45 Q47.5 46.6 50 45" fill="none" stroke="${O}" stroke-width="1.3" stroke-linecap="round"/>` +
      `<path d="M46 32 Q47 27 51 25 M50 33 Q53 29 57 29" fill="none" stroke="${O}" stroke-width="1.4" stroke-linecap="round"/>`,
      rad(b, "#fca5a5", "#b91c1c", .4, .3, .82) + rad(h, "#57534e", "#1c1917", .4, .3, .8) + glow(g, 1.4));
  };

  // 冲锋犀牛：矮胖的灰褐色小犀牛，犀角朝前（右）
  A.rhino = () => {
    const b = uid("hn1"), h = uid("hn2");
    return svg(
      shadow(20, 56, 4.6) +
      `<path d="M14 50 l-1 5 h6 l1 -5 M24 52 l-1 4 h6 l1 -4 M38 52 l-1 4 h6 l1 -4 M47 50 l-1 5 h6 l1 -5" fill="#57534e" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<path d="M6 40 Q5 26 18 22 Q32 18 44 22 Q58 26 58 40 Q57 52 32 53 Q7 52 6 40Z" fill="url(#${b})" stroke="${O}" stroke-width="1.9" stroke-linejoin="round"/>` +
      `<path d="M4 34 Q1 33 2 30" fill="none" stroke="${O}" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M14 30 Q24 26 34 28 M12 40 Q22 44 30 43" fill="none" stroke="#78716c" stroke-width="1.4" opacity=".7"/>` +
      `<path d="M50 24 Q62 18 63 8 Q57 14 52 18 Z" fill="url(#${h})" stroke="${O}" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="M44 22 Q48 16 52 18 L50 25 Z" fill="url(#${h})" stroke="${O}" stroke-width="1.2" stroke-linejoin="round"/>` +
      `<path d="M30 20 Q30 13 35 14 Q37 18 34 22 Z" fill="url(#${b})" stroke="${O}" stroke-width="1.3"/>` +
      `<path d="M15 26 Q21 22 28 22" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".5"/>` +
      eye(42, 31, 3.4, 1.2, .45) +
      `<ellipse cx="53" cy="38" rx="1.2" ry="1.6" fill="${O}"/><path d="M45 42 Q50 44.5 55 41" fill="none" stroke="${O}" stroke-width="1.4" stroke-linecap="round"/>`,
      rad(b, "#d6d3d1", "#78716c", .4, .3, .85) + lin(h, [[0, "#fffbeb"], [1, "#d6c7a1"]]));
  };
  // 炎灵：一团小火苗精灵（橙红火焰身体、黄芯）
  A.flame = () => {
    const b = uid("fl1"), c = uid("fl2"), g = uid("fl3");
    return svg(
      shadow(14, 56, 3.6) +
      `<g filter="url(#${g})"><path d="M32 54 Q14 54 14 38 Q14 28 22 20 Q22 28 27 30 Q25 18 34 8 Q36 20 42 22 Q42 16 46 14 Q52 26 50 38 Q50 54 32 54Z" fill="url(#${b})" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/></g>` +
      `<path d="M32 51 Q21 51 21 41 Q21 34 27 30 Q28 36 31 37 Q31 28 37 24 Q38 32 42 34 Q44 38 43 42 Q43 51 32 51Z" fill="url(#${c})"/>` +
      eye(30, 40, 3.3, 1.4) + eye(39, 40, 3.3, 1.4) +
      `<path d="M31 47 Q34.5 49.5 38 47" fill="none" stroke="${O}" stroke-width="1.4" stroke-linecap="round"/>` +
      `<ellipse cx="26" cy="45" rx="2" ry="1.1" fill="#fb7185" opacity=".6"/>`,
      lin(b, [[0, "#fde047"], [.5, "#f97316"], [1, "#dc2626"]]) + lin(c, [[0, "#fef9c3"], [1, "#fbbf24"]]) + glow(g, 1.2));
  };
  // 霜灵：冰晶小精灵（淡蓝雪团身体，头顶冰棱）
  A.frostling = () => {
    const b = uid("fs1"), c = uid("fs2"), g = uid("fs3");
    return svg(
      shadow(15, 56, 3.8) +
      `<path d="M22 22 L24 10 L28 20 L32 6 L36 20 L40 10 L42 22 Z" fill="url(#${c})" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<path d="M14 40 Q13 22 32 20 Q51 22 50 40 Q50 54 32 54 Q14 54 14 40Z" fill="url(#${b})" stroke="${O}" stroke-width="1.8"/>` +
      `<g filter="url(#${g})" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".85"><path d="M18 46 l4 0 M20 44 l0 4 M47 30 l3 0 M48.5 28.5 l0 3"/></g>` +
      `<path d="M19 30 Q24 24 31 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".75"/>` +
      eye(30, 38, 3.4, 1.4) + eye(40, 38, 3.4, 1.4) +
      `<path d="M32 46 Q35 48 38 46" fill="none" stroke="${O}" stroke-width="1.4" stroke-linecap="round"/>` +
      `<ellipse cx="26" cy="43" rx="2" ry="1.1" fill="#93c5fd" opacity=".8"/><ellipse cx="44" cy="43" rx="2" ry="1.1" fill="#93c5fd" opacity=".8"/>`,
      rad(b, "#f0f9ff", "#60a5fa", .4, .3, .85) + lin(c, [[0, "#ffffff"], [1, "#7dd3fc"]]) + glow(g, 1));
  };
  // 护盾术士：蓝袍尖帽小史莱姆，手持一颗泛着护盾光的水晶球
  A.caster = () => {
    const b = uid("cs1"), h = uid("cs2"), o = uid("cs3"), g = uid("cs4");
    return svg(
      shadow(16, 56, 4.2) +
      `<path d="M14 52 Q12 34 22 28 Q30 24 38 28 Q48 34 46 52 Q38 56 30 56 Q20 56 14 52Z" fill="url(#${b})" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<path d="M14 32 Q16 28 22 27 L34 4 Q36 2 37 5 L40 27 Q46 28 48 32 Q31 36 14 32Z" fill="url(#${h})" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M20 30 Q31 32 42 30" fill="none" stroke="#fde68a" stroke-width="1.6"/><circle cx="30" cy="18" r="1.4" fill="#fde68a"/><circle cx="35" cy="12" r="1" fill="#fde68a"/>` +
      eye(25, 40, 3.5, 1.3) + eye(35, 40, 3.5, 1.3) +
      `<path d="M27 48 Q30 50 33 48" fill="none" stroke="${O}" stroke-width="1.3" stroke-linecap="round"/>` +
      `<g filter="url(#${g})"><circle cx="50" cy="40" r="7.5" fill="url(#${o})" stroke="${O}" stroke-width="1.3"/><path d="M50 35 L54 37 L54 42 Q54 45 50 46 Q46 45 46 42 L46 37 Z" fill="none" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/></g>` +
      `<ellipse cx="50" cy="40" rx="11" ry="10" fill="none" stroke="#93c5fd" stroke-width="1" stroke-dasharray="2 2.4" opacity=".8"/>`,
      rad(b, "#bfdbfe", "#3b82f6", .4, .3, .85) + lin(h, [[0, "#6366f1"], [1, "#312e81"]]) + rad(o, "#eff6ff", "#60a5fa", .35, .3, .8) + glow(g, 1.6));
  };

  // ======================= Boss =======================
  // 巢母：戴王冠的大史莱姆，身边有卵
  // 掘地巨虫：粉棕色的大蚯蚓，戴矿工头盔，从土堆里探出半身
  A.boss4 = () => {
    const b = uid("w1"), r = uid("w2"), h = uid("w3"), g = uid("w4"), d = uid("w5");
    return svg(
      shadow(27, 57, 5.5) +
      `<path d="M3 56 Q6 44 18 43 Q32 40 46 43 Q58 44 61 56 Z" fill="url(#${d})" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<circle cx="10" cy="52" r="2" fill="#78350f"/><circle cx="52" cy="50" r="2.4" fill="#78350f"/><circle cx="40" cy="54" r="1.6" fill="#78350f"/>` +
      `<path d="M16 47 Q14 20 32 14 Q50 20 48 47 Z" fill="url(#${b})" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M17 38 Q32 42 47 38 M16.5 30 Q32 34 47.5 30 M18 22 Q32 26 46 22" fill="none" stroke="url(#${r})" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M15 21 Q15 9 32 8 Q49 9 49 21 Q40 18 32 18 Q24 18 15 21Z" fill="url(#${h})" stroke="${O}" stroke-width="1.7" stroke-linejoin="round"/>` +
      `<path d="M13 21.5 Q32 15.5 51 21.5" fill="none" stroke="${O}" stroke-width="2.2" stroke-linecap="round"/>` +
      `<g filter="url(#${g})"><circle cx="32" cy="12.5" r="3.6" fill="#fef9c3" stroke="${O}" stroke-width="1.2"/><circle cx="32" cy="12.5" r="1.6" fill="#fff"/></g>` +
      `<path d="M21 13 Q24 10 28 10" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>` +
      eye(25, 28, 4.2, .9, .3) + eye(39, 28, 4.2, .9, .3) +
      `<path d="M24 37 Q32 43 40 37 Q32 40 24 37Z" fill="#7f1d1d" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<path d="M27 38 l1 2 l1 -1.6 M35 38 l1 1.8 l1 -1.8" fill="#fff" stroke="${O}" stroke-width=".6"/>` +
      `<ellipse cx="20" cy="34" rx="2.4" ry="1.3" fill="#fb7185" opacity=".5"/><ellipse cx="44" cy="34" rx="2.4" ry="1.3" fill="#fb7185" opacity=".5"/>`,
      rad(b, "#fecdd3", "#be6a72", .4, .3, .85) + lin(r, [[0, "#9f4a55"], [1, "#9f4a55"]]) + lin(h, [[0, "#fde047"], [1, "#ca8a04"]]) + glow(g, 1.6) + lin(d, [[0, "#a16207"], [1, "#713f12"]]));
  };
  // 蝠群女王：戴王冠的大蝙蝠，翅膀张开，悬在空中
  A.boss5 = () => {
    const b = uid("q1"), w = uid("q2"), c = uid("q3"), g = uid("q4");
    return svg(
      `<ellipse cx="32" cy="59" rx="15" ry="3" fill="#000" opacity=".28"/>` +
      `<path d="M26 28 Q12 6 1 18 Q6 21 4 27 Q10 24 11 31 Q16 27 18 34 Q22 30 25 36 Z" fill="url(#${w})" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<path d="M38 28 Q52 6 63 18 Q58 21 60 27 Q54 24 53 31 Q48 27 46 34 Q42 30 39 36 Z" fill="url(#${w})" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<path d="M7 20 L19 30 M14 15 L22 29 M57 20 L45 30 M50 15 L42 29" stroke="#2e1065" stroke-width="1" opacity=".6"/>` +
      `<path d="M22 22 L23 10 L28 18 Z M42 22 L41 10 L36 18 Z" fill="url(#${b})" stroke="${O}" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<ellipse cx="32" cy="33" rx="14.5" ry="14" fill="url(#${b})" stroke="${O}" stroke-width="2"/>` +
      `<path d="M23 14 L24.5 6 L28.5 11 L32 4 L35.5 11 L39.5 6 L41 14 Z" fill="url(#${c})" stroke="${O}" stroke-width="1.3" stroke-linejoin="round"/>` +
      `<circle cx="32" cy="10.5" r="1.6" fill="#f472b6" filter="url(#${g})"/>` +
      `<path d="M23 24 Q27 20 32 20" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>` +
      eye(26.5, 31, 4, 1, .35) + eye(37.5, 31, 4, 1, .35) +
      `<path d="M27 40 Q32 43.5 37 40" fill="#4c0519" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<path d="M28.6 40.6 l.9 2.3 l.9 -1.9 M33.6 40.8 l.9 2 l.9 -2.1" fill="#fff" stroke="${O}" stroke-width=".6"/>` +
      `<path d="M27 46 l-1.5 5 M37 46 l1.5 5" stroke="${O}" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M18 36 Q18 44 24 47 M46 36 Q46 44 40 47" fill="none" stroke="#c4b5fd" stroke-width="1.2" opacity=".6"/>`,
      rad(b, "#c4b5fd", "#4c1d95", .4, .3, .82) + lin(w, [[0, "#8b5cf6"], [1, "#2e1065"]]) + lin(c, [[0, "#fef08a"], [.5, "#facc15"], [1, "#ca8a04"]]) + glow(g, 1.2));
  };
  // 冰霜巨像：冰块和蓝石堆成的巨人，胸口一颗发光的冰核
  A.boss6 = () => {
    const b = uid("k1"), i = uid("k2"), g = uid("k3"), s = uid("k4");
    return svg(
      shadow(27, 58, 5.5) +
      `<path d="M14 56 L16 44 L25 44 L24 56 Z M40 56 L39 44 L48 44 L50 56 Z" fill="url(#${s})" stroke="${O}" stroke-width="1.7" stroke-linejoin="round"/>` +
      `<path d="M3 38 L7 22 L16 20 L17 34 L11 42 Z M61 38 L57 22 L48 20 L47 34 L53 42 Z" fill="url(#${i})" stroke="${O}" stroke-width="1.7" stroke-linejoin="round"/>` +
      `<path d="M14 46 L12 22 L20 14 L44 14 L52 22 L50 46 L40 50 L24 50 Z" fill="url(#${b})" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M20 14 L23 6 L28 13 L32 3 L36 13 L41 6 L44 14" fill="url(#${i})" stroke="${O}" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="M14 26 L22 30 L18 40 M50 26 L42 30 L46 40 M24 50 L28 44 L36 44 L40 50" fill="none" stroke="#1e3a8a" stroke-width="1.2" opacity=".6"/>` +
      `<path d="M19 17 L30 16" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>` +
      `<g filter="url(#${g})"><path d="M32 30 L37 36 L32 43 L27 36 Z" fill="#e0f2fe" stroke="#0ea5e9" stroke-width="1.4" stroke-linejoin="round"/><path d="M32 33 L34 36 L32 39 L30 36 Z" fill="#fff"/></g>` +
      `<g filter="url(#${g})"><path d="M22 24 l7 1.5 l-1 3 Z" fill="#7dd3fc"/><path d="M42 24 l-7 1.5 l1 3 Z" fill="#7dd3fc"/></g>` +
      `<path d="M8 25 L12 30 M56 25 L52 30" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>`,
      lin(b, [[0, "#bae6fd"], [.5, "#60a5fa"], [1, "#1e40af"]], .4, 1) + lin(i, [[0, "#f0f9ff"], [1, "#7dd3fc"]], 1, 1) + glow(g, 1.6) + lin(s, [[0, "#94a3b8"], [1, "#334155"]]));
  };

  // 盗金鼠王：戴眼罩小王冠的胖老鼠，背着鼓鼓的钱袋
  A.boss7 = () => {
    const b = uid("r1"), s = uid("r2"), c = uid("r3"), e2 = uid("r4");
    return svg(
`<g transform="translate(64 0) scale(-1 1)">` + shadow(25, 57, 5.2) +
      `<path d="M50 50 Q60 46 60 36 Q60 30 56 31" fill="none" stroke="${O}" stroke-width="3.4" stroke-linecap="round"/><path d="M50 50 Q60 46 60 36 Q60 30 56 31" fill="none" stroke="#f9a8d4" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="M38 22 Q36 10 46 9 Q56 10 54 22 Q50 30 44 30 Q38 28 38 22Z" fill="url(#${s})" stroke="${O}" stroke-width="1.7"/>` +
      `<path d="M41 13 Q46 11 50 14" fill="none" stroke="${O}" stroke-width="1.6" stroke-linecap="round"/>` +
      `<path d="M8 50 Q6 30 20 24 Q32 19 42 26 Q52 34 50 50 Q42 56 29 56 Q14 56 8 50Z" fill="url(#${b})" stroke="${O}" stroke-width="1.9" stroke-linejoin="round"/>` +
      `<circle cx="12" cy="22" r="6" fill="url(#${b})" stroke="${O}" stroke-width="1.6"/><circle cx="12" cy="22" r="3.2" fill="#f9a8d4"/>` +
      `<circle cx="34" cy="20" r="5.5" fill="url(#${b})" stroke="${O}" stroke-width="1.6"/><circle cx="34" cy="20" r="2.9" fill="#f9a8d4"/>` +
      `<path d="M15 21 L17 13 L20.5 18 L23 11 L25.5 18 L29 13 L31 21 Z" fill="url(#${c})" stroke="${O}" stroke-width="1.2" stroke-linejoin="round"/>` +
      `<path d="M11 31 L35 29" stroke="${O}" stroke-width="1.6"/><ellipse cx="17" cy="34" rx="5" ry="4.4" fill="#1f2937" stroke="${O}" stroke-width="1.2"/>` +
      eye(29.5, 35, 4, 1.2, .3) +
      `<ellipse cx="22" cy="44" rx="4.6" ry="3.4" fill="#e7e5e4" stroke="${O}" stroke-width="1.2"/><circle cx="22" cy="42" r="1.6" fill="#fb7185" stroke="${O}" stroke-width=".8"/>` +
      `<path d="M19 47 Q22 49.5 26 47" fill="none" stroke="${O}" stroke-width="1.3" stroke-linecap="round"/><path d="M21 48 l1 2.4 l1 -2.3" fill="#fff" stroke="${O}" stroke-width=".6"/>` +
      `<path d="M15 44 L6 42 M15 46 L6 47 M29 44 L37 42" stroke="${O}" stroke-width=".9" stroke-linecap="round"/>` +
      `<circle cx="44" cy="52" r="3" fill="url(#${e2})" stroke="${O}" stroke-width="1"/><circle cx="38" cy="54.5" r="2.6" fill="url(#${e2})" stroke="${O}" stroke-width="1"/>` + `</g>` + `<text x="18.0" y="25" text-anchor="middle" font-size="9" font-weight="900" fill="#ca8a04" font-family="sans-serif">$</text>`,
      rad(b, "#d6d3d1", "#57534e", .4, .3, .85) + lin(s, [[0, "#d6a15c"], [1, "#92400e"]]) + lin(c, [[0, "#fef08a"], [1, "#ca8a04"]]) + rad(e2, "#fef9c3", "#eab308"));
  };
  // 镜影狐：九条尾巴的蓝紫色小狐狸，额头一颗月牙宝石
  A.boss8 = () => {
    const b = uid("x1"), t = uid("x2"), g = uid("x3");
    return svg(
`<g transform="translate(64 0) scale(-1 1)">` + shadow(22, 57, 5) +
      `<path d="M38 46 Q56 46 60 30 Q54 36 48 34 Q58 26 56 14 Q50 26 44 28 Q50 16 44 8 Q42 22 36 30 Z" fill="url(#${t})" stroke="${O}" stroke-width="1.7" stroke-linejoin="round"/>` +
      `<path d="M50 26 Q55 22 56 17 M46 22 Q47 15 45 11 M52 35 Q57 33 59 30" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>` +
      `<path d="M12 50 Q10 34 22 28 Q32 24 40 30 Q48 38 46 50 Q38 56 28 56 Q16 56 12 50Z" fill="url(#${b})" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<path d="M8 26 Q6 12 14 8 L18 20 Z M34 26 Q38 12 32 6 L26 18 Z" fill="url(#${b})" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 22 L13 12 L15.5 20 Z M32 22 L32 11 L28 19 Z" fill="#fbcfe8"/>` +
      `<path d="M6 30 Q6 16 21 14 Q36 16 36 30 Q36 38 21 40 Q6 38 6 30Z" fill="url(#${b})" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<path d="M12 33 Q21 44 30 33 Q21 37 12 33Z" fill="#f5f3ff"/>` +
      `<g filter="url(#${g})"><path d="M18.5 18 Q21 15 23.5 18 Q21 17.4 19.8 19.6 Z" fill="#fde68a" stroke="${O}" stroke-width=".7"/></g>` +
      eye(15.5, 27, 3.6, 1, .4) + eye(26.5, 27, 3.6, 1, .4) +
      `<circle cx="21" cy="33" r="1.6" fill="${O}"/><path d="M19 35.5 Q21 37 23 35.5" fill="none" stroke="${O}" stroke-width="1.2" stroke-linecap="round"/>` +
      `<path d="M14 22 Q17 19 21 19" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>` + `</g>`,
      rad(b, "#c7d2fe", "#6d28d9", .4, .3, .85) + lin(t, [[0, "#e0e7ff"], [.5, "#a5b4fc"], [1, "#7c3aed"]], 1, 1) + glow(g, 1.4));
  };
  // 熔岩巨兽：黑曜石外壳、裂缝里透出岩浆的大块头
  A.boss9 = () => {
    const b = uid("v1"), l = uid("v2"), g = uid("v3");
    return svg(
      shadow(27, 58, 5.5) +
      `<path d="M15 56 L17 45 L26 45 L25 56 Z M39 56 L38 45 L47 45 L49 56 Z" fill="url(#${b})" stroke="${O}" stroke-width="1.7" stroke-linejoin="round"/>` +
      `<path d="M4 40 Q2 26 12 22 L18 34 L13 44 Z M60 40 Q62 26 52 22 L46 34 L51 44 Z" fill="url(#${b})" stroke="${O}" stroke-width="1.7" stroke-linejoin="round"/>` +
      `<path d="M10 46 Q8 22 22 15 Q32 10 42 15 Q56 22 54 46 Q44 52 32 52 Q20 52 10 46Z" fill="url(#${b})" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>` +
      `<g filter="url(#${g})"><path d="M18 24 L24 30 L21 36 L27 42 M44 22 L39 29 L43 35 L37 42 M30 16 L32 22 L29 26" fill="none" stroke="url(#${l})" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M7 30 L12 34 M57 30 L52 34 M20 50 L22 47 M44 50 L42 47" stroke="url(#${l})" stroke-width="1.8" stroke-linecap="round"/></g>` +
      `<path d="M16 22 Q22 15 30 14" fill="none" stroke="#a8a29e" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>` +
      `<g filter="url(#${g})"><path d="M22 31 l8 1 l-2 3 Z" fill="#fde047"/><path d="M42 31 l-8 1 l2 3 Z" fill="#fde047"/></g>` +
      `<path d="M25 42 Q32 47 39 42 Q32 44.5 25 42Z" fill="#f97316" stroke="${O}" stroke-width="1.3" stroke-linejoin="round"/>` +
      `<path d="M27 12 L29 6 L32 11 L35 5 L37 12" fill="url(#${b})" stroke="${O}" stroke-width="1.3" stroke-linejoin="round"/>`,
      lin(b, [[0, "#57534e"], [.6, "#292524"], [1, "#0c0a09"]]) + lin(l, [[0, "#fde047"], [.5, "#f97316"], [1, "#dc2626"]]) + glow(g, 1.4));
  };

  // 噬符魔像（终章最终 Boss）：吞下了风火冰雷四颗符文宝石的黑曜石魔像，胸口一颗紫色核心
  A.boss10 = () => {
    const b = uid("z1"), c = uid("z2"), g = uid("z3"), cr = uid("z4");
    const gem = (x, y, col, hi) => `<g filter="url(#${g})"><path d="M${x} ${y - 4.2} L${x + 3.4} ${y} L${x} ${y + 4.2} L${x - 3.4} ${y} Z" fill="${col}" stroke="${O}" stroke-width="1.1" stroke-linejoin="round"/></g><path d="M${x} ${y - 2.6} L${x + 1.3} ${y - .6} L${x} ${y - .2} Z" fill="${hi}" opacity=".9"/>`;
    return svg(
      shadow(24, 59, 5) +
      `<path d="M3 34 Q1 22 10 18 L16 30 L11 42 Z M61 34 Q63 22 54 18 L48 30 L53 42 Z" fill="url(#${b})" stroke="${O}" stroke-width="1.7" stroke-linejoin="round"/>` +
      `<path d="M9 44 L8 24 L18 12 L46 12 L56 24 L55 44 L44 53 L20 53 Z" fill="url(#${b})" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M18 12 L21 4 L26 10 L29 2 L32 8 L35 2 L38 10 L43 4 L46 12" fill="url(#${cr})" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<g filter="url(#${g})"><path d="M14 22 L20 27 L17 33 M50 22 L44 27 L47 33 M24 47 L28 43 M40 47 L36 43" fill="none" stroke="#e879f9" stroke-width="1.5" stroke-linecap="round" opacity=".85"/></g>` +
      `<path d="M14 18 Q20 13 28 13" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>` +
      `<g filter="url(#${g})"><circle cx="32" cy="33" r="8.2" fill="url(#${c})" stroke="${O}" stroke-width="1.6"/></g>` +
      `<circle cx="32" cy="33" r="3.4" fill="#fdf4ff"/><circle cx="33.2" cy="31.8" r="1.2" fill="#fff"/>` +
      `<g filter="url(#${g})"><path d="M20 23.5 l6.5 1.6 l-1 2.6 Z" fill="#f0abfc"/><path d="M44 23.5 l-6.5 1.6 l1 2.6 Z" fill="#f0abfc"/></g>` +
      gem(17, 39, "#4ade80", "#dcfce7") + gem(47, 39, "#fb923c", "#ffedd5") + gem(23, 48, "#60a5fa", "#dbeafe") + gem(41, 48, "#c084fc", "#f3e8ff"),
      lin(b, [[0, "#64748b"], [.55, "#334155"], [1, "#0f172a"]]) + rad(c, "#f5d0fe", "#7e22ce", .4, .35, .9) + lin(cr, [[0, "#e9d5ff"], [1, "#7c3aed"]]) + glow(g, 1.5));
  };

  A.boss1 = () => {
    const b = uid("b1"), c = uid("b1c"), e = uid("b1e"), sh = uid("b1s"), g = uid("b1g");
    return svg(
      shadow(26, 57, 5.5) +
      `<path d="M6 48 Q5 18 32 16 Q59 18 58 48 Q57 56 32 56 Q7 56 6 48Z" fill="url(#${b})" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M9 46 Q20 54 32 54 Q44 54 55 46 Q54 54 32 55 Q10 54 9 46Z" fill="url(#${sh})" opacity=".75"/>` +
      `<path d="M14 30 Q18 22 26 20" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".6"/>` +
      `<path d="M18 19 L20 6 L26.5 12.5 L32 3 L37.5 12.5 L44 6 L46 19 Z" fill="url(#${c})" stroke="${O}" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="M19 16 H45" stroke="#a16207" stroke-width="1.2"/>` +
      `<circle cx="32" cy="12" r="2.4" fill="#f472b6" stroke="${O}" stroke-width=".9" filter="url(#${g})"/><circle cx="23" cy="14" r="1.3" fill="#60a5fa"/><circle cx="41" cy="14" r="1.3" fill="#60a5fa"/>` +
      eye(22, 33, 4.6, .6, .3) + eye(32, 31.5, 4.8, .6, .3) + eye(42, 33, 4.6, .6, .3) +
      `<path d="M23 44 Q32 50 41 44" fill="#4c1d95" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M27 45.6 l1.2 2.2 l1.2 -1.6 M35 45.6 l1.2 2 l1.2 -2.2" fill="none" stroke="#fff" stroke-width="1"/>` +
      `<ellipse cx="7" cy="53" rx="4" ry="5" fill="url(#${e})" stroke="${O}" stroke-width="1.1"/><ellipse cx="57" cy="53" rx="3.6" ry="4.6" fill="url(#${e})" stroke="${O}" stroke-width="1.1"/><ellipse cx="51" cy="58" rx="3" ry="3.8" fill="url(#${e})" stroke="${O}" stroke-width="1.1"/>`,
      rad(b, "#f0c4ff", "#7e22ce", .4, .3, .82) + lin(c, [[0, "#fef08a"], [.5, "#facc15"], [1, "#ca8a04"]]) +
      rad(e, "#fdf4ff", "#c084fc") + lin(sh, [[0, "#4c1d95"], [1, "#2e1065"]]) + glow(g, 1.2));
  };
  // 棱镜守卫：彩色晶体傀儡
  A.boss2 = () => {
    const g = uid("b2g"), a = uid("b2a"), b = uid("b2b"), c = uid("b2c");
    return svg(
      shadow(24, 58, 5.5) +
      `<path d="M7 40 L15 25 L22 44 L14 55 Z" fill="url(#${b})" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M57 40 L49 25 L42 44 L50 55 Z" fill="url(#${c})" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M32 3 L49 17 L47 46 L32 57 L17 46 L15 17 Z" fill="url(#${a})" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M32 3 L49 17 L32 26 L15 17 Z" fill="#fff" opacity=".35"/>` +
      `<path d="M32 26 L47 46 L32 57 Z" fill="#1e1b4b" opacity=".25"/>` +
      `<path d="M32 3 V26 M15 17 L32 26 L49 17 M32 26 V57 M17 46 L32 26" stroke="#eef2ff" stroke-width="1" opacity=".75"/>` +
      `<path d="M20 15 L26 10" stroke="#fff" stroke-width="2" stroke-linecap="round"/>` +
      `<g filter="url(#${g})"><ellipse cx="32" cy="35" rx="7" ry="5.4" fill="#fff" stroke="${O}" stroke-width="1.2"/><circle cx="32" cy="35.5" r="3.4" fill="#f472b6"/><circle cx="32" cy="35.5" r="1.5" fill="${O}"/><circle cx="33.2" cy="34.2" r=".8" fill="#fff"/></g>`,
      lin(a, [[0, "#a5f3fc"], [.5, "#a5b4fc"], [1, "#6366f1"]], 1, 1) + lin(b, [[0, "#fde68a"], [1, "#f472b6"]], 1, 1) +
      lin(c, [[0, "#f9a8d4"], [1, "#22d3ee"]], 1, 1) + glow(g, 1.5));
  };
  // 暴君：披甲、长角、披风
  A.boss3 = () => {
    const k = uid("b3k"), a = uid("b3a"), h = uid("b3h"), g = uid("b3g"), gd = uid("b3d");
    return svg(
      shadow(25, 58, 5.5) +
      // 披风
      `<path d="M9 55 Q11 29 32 27 Q53 29 55 55 Q32 61 9 55Z" fill="url(#${k})" stroke="${O}" stroke-width="1.9" stroke-linejoin="round"/>` +
      `<path d="M15 53 Q18 37 32 34 M49 53 Q46 37 32 34" fill="none" stroke="#450a0a" stroke-width="1.2" opacity=".7"/>` +
      `<path d="M12 50 Q14 36 24 31" fill="none" stroke="#f87171" stroke-width="1.4" opacity=".45"/>` +
      // 角
      `<path d="M19 24 Q7 19 8 4 Q14 14 23 16Z" fill="url(#${h})" stroke="${O}" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="M45 24 Q57 19 56 4 Q50 14 41 16Z" fill="url(#${h})" stroke="${O}" stroke-width="1.5" stroke-linejoin="round"/>` +
      // 头盔
      `<path d="M16 38 Q15 17 32 14 Q49 17 48 38 Q48 47 32 48 Q16 47 16 38Z" fill="url(#${a})" stroke="${O}" stroke-width="1.9" stroke-linejoin="round"/>` +
      `<path d="M21 22 Q26 17 32 16" fill="none" stroke="#e5e7eb" stroke-width="2" stroke-linecap="round" opacity=".6"/>` +
      `<path d="M32 14 V29" stroke="#9ca3af" stroke-width="1.4" opacity=".7"/>` +
      `<path d="M20 31 H44 L42 37 H22Z" fill="${O}"/>` +
      `<g filter="url(#${g})"><path d="M23.5 33.4 L30 32.2 L29 35.4Z M40.5 33.4 L34 32.2 L35 35.4Z" fill="#f87171"/></g>` +
      `<circle cx="32" cy="42" r="2.8" fill="url(#${gd})" stroke="${O}" stroke-width="1"/>` +
      `<path d="M19 44 l3 3 M45 44 l-3 3" stroke="#9ca3af" stroke-width="1.4" stroke-linecap="round"/>`,
      lin(k, [[0, "#991b1b"], [1, "#3f0808"]]) + rad(a, "#7c8594", "#1f2937", .4, .3, .85) +
      lin(h, [[0, "#fef3c7"], [.6, "#e0a33a"], [1, "#92400e"]]) + rad(gd, "#fde68a", "#d97706") + glow(g, 1.4));
  };

  // ======================= 地块（128 像素平铺） =======================
  A.grass = (alt) => {
    const t = uid("gt");
    const tuft = (x, y, s = 1) => `<path d="M${x} ${y} q${-2 * s} ${-5 * s} ${-3.5 * s} ${-6 * s} M${x} ${y} q0 ${-5 * s} ${1 * s} ${-7 * s} M${x} ${y} q${2 * s} ${-4 * s} ${4 * s} ${-5 * s}" stroke="#2f5a26" stroke-width="1.3" fill="none" stroke-linecap="round"/>` +
      `<path d="M${x} ${y} q0 ${-5 * s} ${1 * s} ${-7 * s}" stroke="#7fbf5a" stroke-width=".8" fill="none" stroke-linecap="round" opacity=".8"/>`;
    return svg(`<rect width="64" height="64" fill="url(#${t})"/>` +
      `<ellipse cx="${alt ? 44 : 18}" cy="${alt ? 20 : 44}" rx="14" ry="9" fill="#5e9a45" opacity=".25"/>` +
      `<ellipse cx="${alt ? 14 : 46}" cy="${alt ? 48 : 16}" rx="10" ry="6" fill="#28461f" opacity=".18"/>` +
      tuft(12, 20) + tuft(44, 46, 1.1) + tuft(50, 16, .8) + tuft(20, 54, .9) +
      (alt ? `<circle cx="30" cy="30" r="1.5" fill="#fbcfe8" stroke="#9d174d" stroke-width=".4"/><circle cx="30" cy="30" r=".5" fill="#fde047"/>`
           : `<circle cx="36" cy="28" r="1.4" fill="#fef9c3" stroke="#a16207" stroke-width=".4"/><circle cx="36" cy="28" r=".5" fill="#f59e0b"/>`) +
      `<circle cx="${alt ? 52 : 8}" cy="36" r="1.6" fill="#8b94a3" stroke="#3b4251" stroke-width=".5"/>`,
      lin(t, alt ? [[0, "#4a8039"], [1, "#3b6a2e"]] : [[0, "#4f8a3d"], [1, "#407432"]]));
  };
  A.path = () => {
    const t = uid("pt");
    const peb = (x, y, rx, ry, c) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" stroke="#6b5640" stroke-width=".6"/><ellipse cx="${x - rx * .3}" cy="${y - ry * .35}" rx="${rx * .45}" ry="${ry * .35}" fill="#e7d7bb" opacity=".6"/>`;
    return svg(`<rect width="64" height="64" fill="url(#${t})"/>` +
      `<ellipse cx="22" cy="40" rx="16" ry="10" fill="#a88b66" opacity=".35"/>` +
      peb(14, 16, 5, 3.4, "#c9b18e") + peb(46, 40, 6.5, 4, "#bfa682") + peb(46, 12, 3.6, 2.6, "#cdb796") + peb(18, 50, 4.2, 2.8, "#c4ab88") + peb(34, 27, 2.6, 1.8, "#b89e7a") +
      `<path d="M4 30 q4 -1 7 1 M52 54 q3 -2 7 0 M28 58 q3 -1 5 0" stroke="#8a7254" stroke-width="1" fill="none" opacity=".6"/>`,
      lin(t, [[0, "#c4a982"], [1, "#ae946d"]]));
  };
  A.highland = (bg = "#407432") => {
    const t = uid("ht"), f = uid("hf");
    return svg(`<rect width="64" height="64" fill="${bg}"/>` +
      `<path d="M5 50 L12 18 H52 L59 50 Q32 56 5 50Z" fill="url(#${f})" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<path d="M10 40 Q32 45 54 40" fill="none" stroke="#4a3a2a" stroke-width="1" opacity=".6"/>` +
      `<path d="M12 18 H52 L55 30 Q32 35 9 30 Z" fill="url(#${t})" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<path d="M14 21 H50" stroke="#a7e08a" stroke-width="1.2" opacity=".7"/>` +
      `<path d="M27 28 l5 -5 l5 5" stroke="#fde68a" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
      lin(t, [[0, "#7cc35c"], [1, "#4d8a3a"]]) + lin(f, [[0, "#8a7155"], [1, "#5a4632"]]));
  };
  A.runewell = (bg = "#407432") => {
    const t = uid("rt"), g = uid("rg"), s = uid("rs");
    return svg(`<rect width="64" height="64" fill="${bg}"/>` +
      `<circle cx="32" cy="33" r="23" fill="url(#${s})" stroke="${O}" stroke-width="1.5"/>` +
      `<path d="M14 26 L22 14 M42 14 L50 26 M50 40 L42 52 M22 52 L14 40" stroke="#4b5266" stroke-width="1.2"/>` +
      `<circle cx="32" cy="33" r="15.5" fill="url(#${t})" stroke="${O}" stroke-width="1.3" filter="url(#${g})"/>` +
      `<path d="M32 23 V43 M26 28 L38 38 M38 28 L26 38" stroke="#f0f9ff" stroke-width="1.7" stroke-linecap="round" opacity=".95"/>` +
      `<ellipse cx="27" cy="27" rx="4" ry="2" fill="#fff" opacity=".35"/>`,
      rad(t, "#c7f9ff", "#4f46e5", .5, .5) + lin(s, [[0, "#9aa3bd"], [1, "#4d556e"]]) + glow(g, 2));
  };
  A.swamp = () => {
    const t = uid("wt");
    return svg(`<rect width="64" height="64" fill="url(#${t})"/>` +
      `<ellipse cx="34" cy="34" rx="24" ry="17" fill="#2f3d24" opacity=".45"/>` +
      `<circle cx="20" cy="22" r="3.2" fill="#7d8f62" stroke="#2a3520" stroke-width=".8" opacity=".85"/><circle cx="19" cy="21" r="1" fill="#d6e2b8" opacity=".7"/>` +
      `<circle cx="44" cy="40" r="4.2" fill="none" stroke="#a3b18a" stroke-width="1.2" opacity=".7"/><circle cx="40" cy="18" r="1.8" fill="#a3b18a" opacity=".7"/>` +
      `<path d="M8 50 Q14 46 20 50 T32 50" stroke="#a3b18a" stroke-width="1.2" fill="none" opacity=".6"/>` +
      `<path d="M50 54 q-1 -7 1 -11 M53 54 q0 -6 3 -9" stroke="#55703a" stroke-width="1.6" fill="none" stroke-linecap="round"/><ellipse cx="51" cy="42" rx="1.4" ry="3" fill="#7c4a1e"/>`,
      lin(t, [[0, "#4c5c3b"], [1, "#36442a"]]));
  };


  // ======================= 地图主题 =======================
  // 雪原地面
  A.snow = (alt) => {
    const t = uid("sn");
    const drift = (x, y, w) => `<path d="M${x - w} ${y} q${w} ${-w * .55} ${w * 2} 0 Z" fill="#ffffff" opacity=".75"/><path d="M${x - w} ${y} q${w} ${-w * .55} ${w * 2} 0" fill="none" stroke="#9fb7d4" stroke-width=".8" opacity=".8"/>`;
    return svg(`<rect width="64" height="64" fill="url(#${t})"/>` +
      `<ellipse cx="${alt ? 44 : 18}" cy="${alt ? 22 : 42}" rx="15" ry="9" fill="#ffffff" opacity=".35"/>` +
      drift(alt ? 16 : 46, alt ? 48 : 20, 6) + drift(alt ? 50 : 14, alt ? 14 : 54, 4) +
      (alt ? `<path d="M30 34 l0 -9 M26.5 30 l7 0 M27.5 27 l5 6 M32.5 27 l-5 6" stroke="#ffffff" stroke-width=".9" opacity=".8"/>`
           : `<path d="M36 30 l-4 -9 l-4 9 Z M35 25 l-3 -6 l-3 6 Z" fill="#3f6f5a" stroke="#1a1528" stroke-width=".7"/><rect x="31.2" y="30" width="1.6" height="2.4" fill="#5a3a1e"/><path d="M29 24.5 q3 -1 6 0" stroke="#fff" stroke-width="1.1" fill="none"/>`) +
      `<circle cx="${alt ? 8 : 54}" cy="36" r=".9" fill="#fff"/><circle cx="${alt ? 54 : 10}" cy="30" r=".7" fill="#fff"/>`,
      lin(t, alt ? [[0, "#dbe7f5"], [1, "#c3d4e8"]] : [[0, "#e4eef8"], [1, "#cbdaec"]]));
  };
  A.snowroad = () => {
    const t = uid("sr");
    return svg(`<rect width="64" height="64" fill="url(#${t})"/>` +
      `<path d="M10 0 V64 M54 0 V64" stroke="#8c9db5" stroke-width="1.2" opacity=".35" stroke-dasharray="5 7"/>` +
      `<ellipse cx="18" cy="20" rx="4.5" ry="3" fill="#a7b4c6" stroke="#6d7d94" stroke-width=".6"/><ellipse cx="44" cy="44" rx="5.5" ry="3.4" fill="#b2bfcf" stroke="#6d7d94" stroke-width=".6"/>` +
      `<ellipse cx="17" cy="19" rx="2" ry="1.2" fill="#fff" opacity=".7"/><ellipse cx="43" cy="43" rx="2.4" ry="1.3" fill="#fff" opacity=".7"/>` +
      `<path d="M28 52 q4 -2 8 0 M40 12 q3 -1.5 6 0" stroke="#fff" stroke-width="1.2" fill="none" opacity=".8"/>`,
      lin(t, [[0, "#b9c6d6"], [1, "#a3b2c5"]]));
  };
  A.ice = () => {
    const t = uid("ic");
    return svg(`<rect width="64" height="64" fill="url(#${t})"/>` +
      `<path d="M6 14 L22 26 L18 44 M22 26 L40 22 L52 34 M40 22 L46 6 M18 44 L36 52" stroke="#e0f2fe" stroke-width="1.1" fill="none" opacity=".8"/>` +
      `<path d="M10 52 L26 36 M38 58 L58 40" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>` +
      `<path d="M14 10 L24 4" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`,
      lin(t, [[0, "#a5d8f3"], [.5, "#7cc0ea"], [1, "#5aa6dc"]], 1, 1));
  };
  // 火山地面（玄武岩，带微光裂缝）
  A.basalt = (alt) => {
    const t = uid("ba"), g = uid("bg2");
    return svg(`<rect width="64" height="64" fill="url(#${t})"/>` +
      `<path d="M0 ${alt ? 22 : 40} L14 ${alt ? 26 : 36} L26 ${alt ? 18 : 44} L40 ${alt ? 24 : 38} M40 ${alt ? 24 : 38} L52 ${alt ? 30 : 46} L64 ${alt ? 26 : 42}" stroke="#141018" stroke-width="2" fill="none"/>` +
      `<path d="M0 ${alt ? 22 : 40} L14 ${alt ? 26 : 36} L26 ${alt ? 18 : 44} L40 ${alt ? 24 : 38}" stroke="#f97316" stroke-width=".8" fill="none" opacity=".55" filter="url(#${g})"/>` +
      `<path d="M${alt ? 40 : 12} 6 l6 4 l-2 7 l-7 1 l-3 -6 Z" fill="#4a4049" stroke="#1a1528" stroke-width=".8"/><path d="M${alt ? 41 : 13} 7 l4 3" stroke="#7a6c76" stroke-width="1"/>` +
      `<circle cx="${alt ? 14 : 50}" cy="52" r="2.4" fill="#3d343e" stroke="#1a1528" stroke-width=".6"/>`,
      lin(t, alt ? [[0, "#4d4149"], [1, "#3a3038"]] : [[0, "#54474f"], [1, "#40353d"]]) + glow(g, 1.2));
  };
  A.ashroad = () => {
    const t = uid("ar");
    return svg(`<rect width="64" height="64" fill="url(#${t})"/>` +
      `<ellipse cx="16" cy="18" rx="5" ry="3.2" fill="#6b5e5a" stroke="#3b302e" stroke-width=".6"/><ellipse cx="46" cy="42" rx="6" ry="3.6" fill="#76685f" stroke="#3b302e" stroke-width=".6"/>` +
      `<ellipse cx="44" cy="12" rx="3" ry="2" fill="#625651"/><ellipse cx="20" cy="50" rx="4" ry="2.5" fill="#625651"/>` +
      `<circle cx="32" cy="30" r="1" fill="#fb923c" opacity=".7"/><circle cx="10" cy="40" r=".8" fill="#fbbf24" opacity=".6"/>`,
      lin(t, [[0, "#8a7a70"], [1, "#74655c"]]));
  };
  A.lava = () => {
    const t = uid("lv"), g = uid("lg");
    return svg(`<rect width="64" height="64" fill="#40353d"/>` +
      `<path d="M5 30 Q4 8 26 6 Q50 3 58 20 Q63 40 52 54 Q36 62 18 56 Q4 48 5 30Z" fill="url(#${t})" stroke="#1a1528" stroke-width="1.6" filter="url(#${g})"/>` +
      `<path d="M14 24 Q22 16 32 18 M30 40 Q38 34 48 38 M18 46 Q24 44 28 48" stroke="#fde68a" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".85"/>` +
      `<path d="M38 14 l5 3 l-2 5 l-6 -1 Z M12 36 l4 2 l-1 4 l-5 -1 Z" fill="#2a2228" stroke="#1a1528" stroke-width=".7"/>` +
      `<circle cx="44" cy="46" r="2" fill="#fef3c7" opacity=".9"/>`,
      rad(t, "#fde047", "#dc2626", .5, .45, .75) + glow(g, 1.6));
  };
  // 敌人主题配色：给整张 svg 套一层颜色矩阵（雪原偏冷白、火山偏暗红）
  const TINT = {
    snow: "0.62 0.14 0.18 0 0.06  0.10 0.72 0.18 0 0.09  0.10 0.16 0.84 0 0.16  0 0 0 1 0",
    volcano: "0.92 0.22 0.06 0 0.05  0.12 0.6 0.05 0 0  0.04 0.06 0.42 0 0  0 0 0 1 0",
  };
  A.tint = (svgStr, kind) => {
    if (!TINT[kind]) return svgStr;
    const id = uid("tn"), i = svgStr.indexOf(">") + 1;
    return svgStr.slice(0, i) + `<defs><filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${TINT[kind]}"/></filter></defs><g filter="url(#${id})">` +
      svgStr.slice(i).replace(/<\/svg>$/, "</g></svg>");
  };

  A.list = {
    towers: [["arrow", "箭塔"], ["cannon", "炮塔"], ["frost", "冰塔"], ["tesla", "电塔"]],
    enemies: [["norm", "史莱姆"], ["fast", "风灵"], ["tank", "石甲兽"], ["split", "双生史莱姆"], ["mini", "小史莱姆"], ["bat", "飞行蝠"], ["shaman", "治疗萨满"], ["shieldman", "盾兵"], ["beetle", "自爆甲虫"], ["rhino", "冲锋犀牛"], ["flame", "炎灵"], ["frostling", "霜灵"], ["caster", "护盾术士"]],
    bosses: [["boss1", "巢母"], ["boss2", "棱镜守卫"], ["boss3", "暴君"], ["boss4", "掘地巨虫"], ["boss5", "蝠群女王"], ["boss6", "冰霜巨像"], ["boss7", "盗金鼠王"], ["boss8", "镜影狐"], ["boss9", "熔岩巨兽"], ["boss10", "噬符魔像"]],
    tiles: [["grass", "草地"], ["path", "道路"], ["highland", "高地 · 射程+1"], ["runewell", "符文井 · 相邻伤害+20%"], ["swamp", "沼泽 · 敌人减速"]],
  };
  root.RuneArt = A;
})(typeof window !== "undefined" ? window : globalThis);
