// 符文塔防 · 地图生成器
// 用法：node gen.js <每种类型数量> <种子>  → 输出候选地图 JSON 到 stdout
"use strict";
const COLS = 9, ROWS = 14;
let S = (+process.argv[3] || 7) >>> 0;
const rnd = () => { S |= 0; S = S + 0x6D2B79F5 | 0; let t = Math.imul(S ^ S >>> 15, 1 | S); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function lattice() {
  const xs = [pick([0, 1, 1])];
  while (true) { const g = pick([3, 3, 4]); if (xs.at(-1) + g > 8) break; xs.push(xs.at(-1) + g); }
  const ys = [pick([0, 1, 1, 2])];
  while (true) { const g = pick([3, 3, 3, 4]); if (ys.at(-1) + g > 13) break; ys.push(ys.at(-1) + g); }
  if (xs.length < 3 || ys.length < 4) return null;
  return { xs, ys };
}
const key = (i, j) => i + "," + j;

function makeCtx(L) {
  const I = L.xs.length, J = L.ys.length;
  const nb = (i, j) => [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].filter(([a, b]) => a >= 0 && a < I && b >= 0 && b < J);
  const cellOf = (i, j) => [L.xs[i], L.ys[j]];
  const edgeLen = (a, b) => Math.abs(L.xs[a[0]] - L.xs[b[0]]) + Math.abs(L.ys[a[1]] - L.ys[b[1]]);
  // 边界方向：节点能向哪个地图边延伸
  const dirs = (i, j) => { const d = []; if (i === 0) d.push("L"); if (i === I - 1) d.push("R"); if (j === 0) d.push("T"); if (j === J - 1) d.push("B"); return d; };
  const extend = (i, j, d) => { const [c, r] = cellOf(i, j); return d === "L" ? [-1, r] : d === "R" ? [COLS, r] : d === "T" ? [c, -1] : [c, ROWS]; };
  const extLen = (i, j, d) => { const [c, r] = cellOf(i, j); return d === "L" ? c + 1 : d === "R" ? COLS - c : d === "T" ? r + 1 : ROWS - r; };
  const boundary = []; for (let i = 0; i < I; i++) for (let j = 0; j < J; j++) if (dirs(i, j).length) boundary.push([i, j]);
  return { I, J, nb, cellOf, edgeLen, dirs, extend, extLen, boundary };
}

// 随机 DFS：从 start 走自回避路径，长度（格）在 [lo,hi]，终点满足 endOk
function walk(C, start, used, lo, hi, endOk, budget = 4000) {
  const path = [start], seen = new Set([...used, key(...start)]);
  let best = null, steps = 0;
  function dfs(len) {
    if (++steps > budget || best) return;
    const cur = path.at(-1);
    if (len >= lo && endOk(cur, len) && rnd() < 0.5) { best = path.slice(); return; }
    for (const n of shuffle(C.nb(...cur))) {
      const k = key(...n); if (seen.has(k)) continue;
      const nl = len + C.edgeLen(cur, n); if (nl > hi) continue;
      seen.add(k); path.push(n); dfs(nl); path.pop(); seen.delete(k);
      if (best) return;
    }
    if (!best && len >= lo && endOk(cur, len)) best = path.slice();
  }
  dfs(0);
  return best;
}
const plen = (C, p) => { let s = 0; for (let k = 0; k < p.length - 1; k++) s += C.edgeLen(p[k], p[k + 1]); return s; };

function toWaypoints(C, nodes, entDir, exitDir) {
  const wp = [];
  if (entDir) wp.push(C.extend(...nodes[0], entDir));
  for (const n of nodes) wp.push(C.cellOf(...n));
  if (exitDir) wp.push(C.extend(...nodes.at(-1), exitDir));
  // 去掉共线的中间点
  const out = [wp[0]];
  for (let k = 1; k < wp.length - 1; k++) {
    const a = out.at(-1), b = wp[k], c = wp[k + 1];
    if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) continue;
    out.push(b);
  }
  out.push(wp.at(-1));
  return out;
}

function gen(type) {
  const L = lattice(); if (!L) return null;
  const C = makeCtx(L);
  const bnd = C.boundary;
  const isB = n => C.dirs(...n).length > 0;
  if (type === "snake" || type === "citadel" || type === "fork") {
    const s = pick(bnd), ed = pick(C.dirs(...s)), elen = C.extLen(...s, ed);
    let route, xd = null;
    if (type === "citadel") {
      const interior = n => n[0] > 0 && n[0] < C.I - 1 && n[1] > 0 && n[1] < C.J - 1;
      route = walk(C, s, [], 32 - elen, 44 - elen, interior);
      if (!route) return null;
    } else {
      const lo = type === "fork" ? 30 + Math.floor(rnd() * 6) : 34 + Math.floor(rnd() * 10), hi = type === "fork" ? 46 : 52;
      route = walk(C, s, [], lo - elen, hi - elen - 1, (n) => isB(n) && !(n[0] === s[0] && n[1] === s[1]));
      if (!route) return null;
      const cand = C.dirs(...route.at(-1)).filter(d => d !== ed || route.length > 3);
      if (!cand.length) return null;
      xd = pick(cand);
    }
    const paths = [toWaypoints(C, route, ed, xd)];
    if (type === "fork") {
      // 在路线中段找一段可以绕开的分叉
      const used = new Set(route.map(n => key(...n)));
      const opts = [];
      for (let a = 1; a < route.length - 2; a++) for (let b = a + 2; b < route.length - 1; b++) {
        // BFS 从 route[a] 到 route[b]，只走空闲节点
        const goal = key(...route[b]); const q = [[route[a]]]; const vis = new Set([key(...route[a])]);
        let found = null;
        while (q.length && !found) {
          const p = q.shift();
          for (const n of C.nb(...p.at(-1))) {
            const k = key(...n);
            if (k === goal && p.length >= 2) { found = [...p, n]; break; }
            if (vis.has(k) || used.has(k)) continue;
            vis.add(k); q.push([...p, n]);
          }
        }
        if (found && found.length >= 3) {
          const altLen = plen(C, found), origLen = plen(C, route.slice(a, b + 1));
          if (Math.abs(altLen - origLen) <= 4) opts.push([a, b, found]);
        }
      }
      if (!opts.length) return null;
      const [a, b, alt] = pick(opts);
      const r2 = [...route.slice(0, a), ...alt, ...route.slice(b + 1)];
      paths.push(toWaypoints(C, r2, ed, xd));
    }
    return { type, paths, gateInside: type === "citadel" };
  }
  if (type === "twin" || type === "triple") {
    const arms = type === "twin" ? 2 : 3;
    // 主干：从汇合点走到出口
    const m = [Math.floor(rnd() * C.I), Math.floor(rnd() * C.J)];
    const trunk = walk(C, m, [], arms === 3 ? 10 : 16, arms === 3 ? 22 : 28, n => isB(n) && !(n[0] === m[0] && n[1] === m[1]));
    if (!trunk) return null;
    const xds = C.dirs(...trunk.at(-1)); if (!xds.length) return null;
    const xd = pick(xds);
    const used = new Set(trunk.map(n => key(...n)));
    const attachable = (arms === 3 ? trunk.slice(0, -1) : trunk.slice(0, Math.max(2, Math.ceil(trunk.length / 2)))).map(n => key(...n));
    const paths = [];
    const starts = shuffle(bnd.filter(n => !used.has(key(...n))));
    for (const s of starts) {
      if (paths.length >= arms) break;
      const ed = pick(C.dirs(...s)), elen = C.extLen(...s, ed);
      // 手臂：从入口走到主干前半段的某个节点
      const usedNoAttach = new Set([...used].filter(k => !attachable.includes(k)));
      const arm = walk(C, s, usedNoAttach, Math.max(3, (arms === 3 ? 6 : 9) - elen), 20 - elen, n => attachable.includes(key(...n)), 3000);
      if (!arm) continue;
      const at = key(...arm.at(-1)), ti = trunk.findIndex(n => key(...n) === at);
      // 手臂中间节点不能踩到主干
      if (arm.slice(0, -1).some(n => used.has(key(...n)))) continue;
      const full = [...arm.slice(0, -1), ...trunk.slice(ti)];
      const tot = plen(C, full) + elen + C.extLen(...trunk.at(-1), xd);
      if (tot < (arms === 3 ? 22 : 26) || tot > 46) continue;
      paths.push(toWaypoints(C, full, ed, xd));
      arm.slice(0, -1).forEach(n => used.add(key(...n)));
    }
    if (paths.length < arms) return null;
    return { type, paths, gateInside: false };
  }
}

// ---------- 结构检查与地形格 ----------
function cellsOf(wp) {
  const cells = [];
  for (let k = 0; k < wp.length - 1; k++) {
    const [c1, r1] = wp[k], [c2, r2] = wp[k + 1], dc = Math.sign(c2 - c1), dr = Math.sign(r2 - r1); let c = c1, r = r1;
    while (true) { if (c >= 0 && c < COLS && r >= 0 && r < ROWS) { if (!cells.length || cells.at(-1)[0] !== c || cells.at(-1)[1] !== r) cells.push([c, r]); } if (c === c2 && r === r2) break; c += dc; r += dr; }
  }
  return cells;
}
function analyze(m) {
  const set = new Set(), adj = new Set();
  const routes = m.paths.map(cellsOf);
  for (const cs of routes) { cs.forEach(([c, r]) => set.add(c + "," + r)); for (let k = 0; k < cs.length - 1; k++) { const a = cs[k].join(","), b = cs[k + 1].join(","); adj.add(a + "|" + b); adj.add(b + "|" + a); } }
  // 路不能"糊在一起"：任意两个相邻的路格必须是同一条路线上的前后格
  for (const k of set) {
    const [c, r] = k.split(",").map(Number);
    for (const [dc, dr] of [[1, 0], [0, 1]]) { const k2 = (c + dc) + "," + (r + dr); if (set.has(k2) && !adj.has(k + "|" + k2)) return null; }
  }
  const lens = routes.map(cs => cs.length);
  const grass = []; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!set.has(c + "," + r)) grass.push([c, r]);
  const cov = ([c, r]) => { let n = 0; for (const k of set) { const [pc, pr] = k.split(",").map(Number); if ((pc - c) ** 2 + (pr - r) ** 2 <= 6.5) n++; } return n; };
  const scored = grass.map(g => ({ g, n: cov(g) })).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  if (scored.length < 38) return null;
  return { set, routes, lens, scored };
}
function placeTiles(m, A) {
  const tiles = {}, K = ([c, r]) => c + "," + r;
  const good = A.scored.slice(3, Math.max(8, Math.floor(A.scored.length * .4)));
  const hl = shuffle(good.slice());
  const near = (a, b) => Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1;
  const placed = [];
  for (const x of hl) { if (placed.length >= 2) break; if (placed.some(p => near(p, x.g))) continue; tiles[K(x.g)] = "highland"; placed.push(x.g); }
  const wellC = shuffle(A.scored.slice(0, Math.floor(A.scored.length * .5))).find(x => !tiles[K(x.g)] && !placed.some(p => near(p, x.g)) &&
    A.scored.filter(y => near(y.g, x.g) && y.g !== x.g && !tiles[K(y.g)]).length >= 3);
  if (wellC) tiles[K(wellC.g)] = "runewell";
  // 沼泽：放在第一条路线（主干）的中后段
  const r0 = A.routes[0], nsw = pick([1, 2]);
  for (let s = 0; s < nsw; s++) { const idx = Math.floor(r0.length * (0.45 + 0.3 * s + rnd() * 0.1)); const c = r0[Math.min(idx, r0.length - 2)]; if (c) tiles[K(c)] = "swamp"; }
  return tiles;
}

const N = +process.argv[2] || 60;
const TYPES = (process.env.TYPES || "snake,twin,triple,fork,citadel").split(",");
const out = [];
for (const type of TYPES) {
  let got = 0, tries = 0;
  while (got < N && tries < N * 400) {
    tries++;
    const m = gen(type); if (!m) continue;
    const A = analyze(m); if (!A) continue;
    m.tiles = placeTiles(m, A);
    m.lens = A.lens; m.cells = [...A.set];
    out.push(m); got++;
  }
  process.stderr.write(`${type}: ${got} 张（尝试 ${tries} 次）\n`);
}
console.log(JSON.stringify(out));
