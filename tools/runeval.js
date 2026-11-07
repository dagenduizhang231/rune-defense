// 符文价值测算：固定地图、固定站数、固定预算建塔，二分查找"能顶住的敌人血量倍率"。
// 战力 = 能顶住的血量倍率；符文价值 = 拿了符文后的战力 / 不拿时的战力 - 1。
// 用法：node runeval.js [站数=8] [预算=1000] [种子数=4] [只测这些id,逗号分隔]
const fs = require('fs'), vm = require('vm'), path = require('path');
const FILE = '/home/claude/rune-defense/index.html';
const [, , STEP = '8', BUDGET = '1000', SEEDS = '4', ONLY = ''] = process.argv;
let src = fs.readFileSync(FILE, 'utf8').split('<script>\n"use strict";')[1].split('</script>')[0];
const noop = new Proxy(function () { }, { get: () => noop, apply: () => undefined, set: () => true });
function el() { return { style: {}, dataset: {}, classList: { toggle() { } }, addEventListener() { }, querySelectorAll: () => [], getContext: () => noop, set innerHTML(v) { }, get innerHTML() { return '' }, textContent: '' }; }
const els = {};
let seed = 1;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 1e9) / 1e9; };
const M2 = Object.create(Math); M2.random = rnd;
const ctx = { console, Math: M2, Set, Object, JSON, Array, performance: { now: () => 0 }, window: { devicePixelRatio: 2, location: { search: '' } }, location: { search: '' }, URLSearchParams, document: { getElementById: id => els[id] || (els[id] = el()), createElement: () => el(), addEventListener() { } }, requestAnimationFrame: () => { }, localStorage: { getItem: () => null, setItem() { } } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(path.dirname(FILE), 'maps.js'), 'utf8'), ctx);
vm.runInContext(src + `
;FEAT.hero=false;FEAT.meta=false;FEAT.curse=false;
seen=new Set(['tut','run1','norm','fast','tank','split','mini','boss1','boss2','boss3',...Object.keys(AFX).map(a=>'afx_'+a)]);
var __cands=function(){const out=[];for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const k=c+','+r;if(pathSet.has(k)||grid[k]||tiles[k]==='runewell'||tiles[k]==='lava')continue;let n=0;for(let dc=-2;dc<=2;dc++)for(let dr=-2;dr<=2;dr++)if(pathSet.has((c+dc)+','+(r+dr)))n+=(Math.abs(dc)<=1&&Math.abs(dr)<=1)?2:1;if(tiles[k]==='highland')n+=6;out.push({c,r,n});}return out.sort((a,b)=>b.n-a.n||a.r-b.r||a.c-b.c);};
var __trial=function(mapIdx,stepN,budget,types,cards,hm){
  resetRun(mapIdx,'grass');ov.style.display='none';
  for(const id of cards){const c=findCard(id);taken[id]=(taken[id]||0)+1;c.ap();}
  step=stepN;curNode='normal';phase='build';gold+=budget-170;
  // 建塔：先按列表各放一座，再轮流升到 2 级，钱还有就继续按列表加塔
  let i=0,guard=0;
  while(guard++<200){
    const want=types[i%types.length];
    const lv1=towers.filter(t=>t.lvl<2).sort((a,b)=>upCost(a)-upCost(b))[0];
    if(towers.length<types.length){const sp=__cands()[0];if(!sp||gold<costOf(want))break;const t={type:want,lvl:1,c:sp.c,r:sp.r,x:(sp.c+.5)*CS,y:(sp.r+.5)*CS,cd:0,spent:costOf(want)};gold-=t.spent;towers.push(t);grid[sp.c+','+sp.r]=t;i++;continue;}
    if(lv1){if(gold<upCost(lv1))break;const u=upCost(lv1);gold-=u;lv1.spent+=u;lv1.lvl++;continue;}
    const sp=__cands()[0];if(!sp||gold<costOf(want))break;const t={type:want,lvl:1,c:sp.c,r:sp.r,x:(sp.c+.5)*CS,y:(sp.r+.5)*CS,cd:0,spent:costOf(want)};gold-=t.spent;towers.push(t);grid[sp.c+','+sp.r]=t;i++;
  }
  const hm0=MAP.hpMul;MAP.hpMul=(hm0||1)*hm;
  const l0=lives;startWave();let n=0;
  while(phase==='wave'&&n++<30*400)step_(1/30);
  MAP.hpMul=hm0;
  return l0-lives;
};`, ctx);
const MAPS_TEST = [1, 13, 31];
function power(types, cards, step = +STEP, budget = +BUDGET) {
  let lo = .2, hi = 8;
  for (let it = 0; it < 9; it++) {
    const mid = Math.sqrt(lo * hi); let lost = 0, n = 0;
    for (const m of MAPS_TEST) for (let s = 0; s < +SEEDS; s++) { seed = 12345 + s * 7919 + m; lost += ctx.__trial(m, step, budget, types, cards, mid); n++; }
    if (lost / n <= 1.5) lo = mid; else hi = mid;
  }
  return Math.sqrt(lo * hi);
}
const BUILDS = {
  arrow: ['arrow', 'arrow', 'arrow', 'arrow', 'arrow'],
  cannon: ['cannon', 'cannon', 'cannon', 'cannon', 'cannon'],
  frost: ['frost', 'frost', 'arrow', 'cannon', 'arrow'],
  tesla: ['tesla', 'tesla', 'tesla', 'tesla', 'tesla'],
  mix: ['arrow', 'cannon', 'frost', 'tesla', 'arrow'],
};
const cards = vm.runInContext('CARDS.map(c=>({id:c.id,tag:c.tag||"",r:c.r,name:c.name,desc:c.desc}))', ctx);
const base = {}; for (const k in BUILDS) base[k] = power(BUILDS[k], []);
const RN = ['普通', '稀有', '史诗'];
const out = [];
console.log('基准战力', JSON.stringify(Object.fromEntries(Object.entries(base).map(([k, v]) => [k, +v.toFixed(3)]))));
for (const g of [60, 120, 250, 500]) { const p = power(BUILDS.mix, [], +STEP, +BUDGET + g); console.log(`mix 预算 +${g} 金 → +${Math.round((p / base.mix - 1) * 100)}%`); }
for (const c of cards) {
  if (ONLY && !ONLY.split(',').includes(c.id)) continue;
  const b = c.tag || 'mix';
  const p = power(BUILDS[b], [c.id]);
  const v = Math.round((p / base[b] - 1) * 100);
  out.push({ id: c.id, r: RN[c.r], name: c.name, build: b, value: v });
  console.log(`${c.id.padEnd(4)} ${RN[c.r]} ${c.name.padEnd(6, '　')} [${b}] ${v >= 0 ? '+' : ''}${v}%   ${c.desc}`);
}
fs.writeFileSync('/tmp/runeval.json', JSON.stringify(out));
