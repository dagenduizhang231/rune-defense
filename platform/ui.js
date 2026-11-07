// 符文塔防 · 迷你 DOM：把游戏现有的 HTML 界面（innerHTML 模板 + CSS）在一块 canvas 上排版、绘制和点击。
// 只实现游戏实际用到的子集：块/行内/inline-block 排版、flex、grid、fixed/absolute 定位、纵向滚动、
// 选择器（标签/#id/.class/[attr]/:disabled/:first-child、后代与子代组合符）。微信小游戏没有 DOM，就靠它。
(function (G) {
'use strict';
const CJK = /[⺀-鿿가-힯豈-﫿︰-﹏＀-￯　-〿]/;
const UNIT_RE = /[⺀-鿿가-힯豈-﫿︰-﹏＀-￯　-〿]|\s+|[^\s⺀-鿿가-힯豈-﫿︰-﹏＀-￯　-〿]+/g;
const CLOSE_P = '，。、；：！？）】」』》〉,.!?;:)%·…';
const OPEN_P = '（【「『《〈“‘(';
const VOID = { br: 1, img: 1, meta: 1, rect: 1, input: 1, hr: 1, path: 1, circle: 1 };
const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", times: '×', middot: '·', hellip: '…', mdash: '—' };
const decode = s => s.indexOf('&') < 0 ? s : s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e] != null ? ENT[e] : m));
const camel = s => s.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
const INHERIT = ['color', 'fontSize', 'fontWeight', 'lineHeight', 'textAlign', 'whiteSpace', 'pointerEvents'];
const UA = {
  div: { display: 'block' }, h2: { display: 'block', fontWeight: '700', fontSize: '1.5em' }, p: { display: 'block' },
  b: { fontWeight: '700' }, strong: { fontWeight: '700' }, small: { fontSize: '0.83em' },
  button: { display: 'inline-block', textAlign: 'center', padding: '1px 6px', background: '#334155' },
  img: { display: 'inline-block' }, svg: { display: 'inline-block' }, canvas: { display: 'inline-block' },
  br: { display: 'inline' }, span: {}, i: {}, body: { display: 'block' },
};

let UI = null; // 当前实例

// ---------------- 节点 ----------------
class TextNode { constructor(t) { this.nodeType = 3; this.data = t; this.parent = null; } get textContent() { return this.data; } }
function makeStyle(el) {
  const s = {};
  return new Proxy(s, {
    set(o, k, v) { if (typeof k === 'string') { k = camel(k); if (o[k] !== v) { o[k] = v == null ? '' : String(v); dirty(); } } return true; },
    get(o, k) { if (k === 'setProperty') return (n, v) => { o[camel(n)] = String(v); dirty(); }; if (k === 'removeProperty') return n => { delete o[camel(n)]; dirty(); }; return typeof k === 'string' ? (o[camel(k)] || '') : undefined; },
  });
}
class El {
  constructor(tag) {
    this.nodeType = 1; this.tag = tag.toLowerCase(); this.tagName = this.tag.toUpperCase();
    this.children = []; this.parent = null; this.attrs = {}; this.dataset = {}; this._cls = [];
    this.style = makeStyle(this); this._ls = {}; this.onclick = null; this._dis = false; this.scrollTop = 0; this._b = null;
    const self = this;
    this.classList = {
      add(...c) { for (const x of c) if (!self._cls.includes(x)) self._cls.push(x); dirty(); },
      remove(...c) { self._cls = self._cls.filter(x => !c.includes(x)); dirty(); },
      toggle(c, f) { const on = f == null ? !self._cls.includes(c) : !!f; if (on) this.add(c); else this.remove(c); return on; },
      contains(c) { return self._cls.includes(c); },
    };
    if (this.tag === 'canvas') this._cv = UI.env.createCanvas();
  }
  get id() { return this.attrs.id || ''; } set id(v) { this.attrs.id = v; dirty(); }
  get className() { return this._cls.join(' '); } set className(v) { this._cls = String(v).split(/\s+/).filter(Boolean); dirty(); }
  get disabled() { return this._dis; } set disabled(v) { v = !!v; if (v !== this._dis) { this._dis = v; dirty(); } }
  get title() { return this.attrs.title || ''; } set title(v) { this.attrs.title = v; }
  get parentNode() { return this.parent; } get parentElement() { return this.parent; }
  get firstElementChild() { return this.children.find(c => c.nodeType === 1) || null; }
  get childNodes() { return this.children; }
  getAttribute(k) { return k === 'class' ? this.className : (this.attrs[k] != null ? this.attrs[k] : null); }
  setAttribute(k, v) { v = String(v); if (k === 'class') this.className = v; else if (k === 'style') { parseDecls(v, this.style); } else { this.attrs[k] = v; if (k.startsWith('data-')) this.dataset[camel(k.slice(5))] = v; if (k === 'disabled') this._dis = true; } dirty(); }
  removeAttribute(k) { delete this.attrs[k]; if (k === 'disabled') this._dis = false; dirty(); }
  hasAttribute(k) { return k in this.attrs || (k === 'disabled' && this._dis); }
  set innerHTML(h) { for (const c of this.children) c.parent = null; this.children = []; for (const c of parseHTML(String(h))) { c.parent = this; this.children.push(c); } this.scrollTop = 0; dirty(); }
  get innerHTML() { return this.children.map(serialize).join(''); }
  set textContent(t) { this.children = [new TextNode(String(t))]; this.children[0].parent = this; dirty(); }
  get textContent() { return this.children.map(c => c.textContent).join(''); }
  get innerText() { return this.textContent; } set innerText(t) { this.textContent = t; }
  appendChild(c) { if (c.parent) c.parent.removeChild(c); c.parent = this; this.children.push(c); dirty(); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; dirty(); return c; }
  remove() { if (this.parent) this.parent.removeChild(this); }
  addEventListener(t, f) { (this._ls[t] || (this._ls[t] = [])).push(f); }
  removeEventListener(t, f) { const a = this._ls[t]; if (a) { const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } }
  querySelectorAll(sel) { const S = parseSelList(sel), out = []; walk(this, e => { if (e !== this && S.some(s => matchSel(e, s))) out.push(e); }); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  closest(sel) { const S = parseSelList(sel); for (let e = this; e && e.nodeType === 1; e = e.parent) if (S.some(s => matchSel(e, s))) return e; return null; }
  matches(sel) { return parseSelList(sel).some(s => matchSel(this, s)); }
  getBoundingClientRect() {
    if (UI.dirty) layoutAll();
    const b = this._b || { x: 0, y: 0, w: 0, h: 0 }; let dy = 0;
    for (let p = this.parent; p; p = p.parent) if (p._scroll) dy -= p.scrollTop;
    return { left: b.x, top: b.y + dy, width: b.w, height: b.h, right: b.x + b.w, bottom: b.y + dy + b.h, x: b.x, y: b.y + dy };
  }
  get offsetParent() { if (UI.dirty) layoutAll(); return isVis(this) ? (this.parent || null) : null; }
  get offsetWidth() { return this._b ? this._b.w : 0; } get offsetHeight() { return this._b ? this._b.h : 0; }
  get clientWidth() { return this.offsetWidth; } get clientHeight() { return this.offsetHeight; }
  get scrollHeight() { return this._ch || this.offsetHeight; }
  scrollIntoView() {}
  focus() {} blur() {}
  // canvas 元素：代理到真正的离屏画布
  get width() { return this._cv ? this._cv.width : 0; } set width(v) { if (this._cv) this._cv.width = v; }
  get height() { return this._cv ? this._cv.height : 0; } set height(v) { if (this._cv) this._cv.height = v; }
  getContext(t) { return this._cv ? this._cv.getContext(t) : null; }
}
function walk(e, f) { for (const c of e.children) if (c.nodeType === 1) { f(c); walk(c, f); } }
function serialize(n) {
  if (n.nodeType === 3) return n.data.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let a = ''; for (const k in n.attrs) a += ` ${k}="${String(n.attrs[k]).replace(/"/g, '&quot;')}"`; if (n._cls.length) a += ` class="${n.className}"`;
  return VOID[n.tag] ? `<${n.tag}${a}>` : `<${n.tag}${a}>${n.children.map(serialize).join('')}</${n.tag}>`;
}

// ---------------- HTML 解析 ----------------
function parseHTML(src) {
  const root = new El('div'); let cur = root, i = 0; const n = src.length;
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) { addText(cur, src.slice(i)); break; }
    if (lt > i) addText(cur, src.slice(i, lt));
    if (src.startsWith('<!--', lt)) { const e = src.indexOf('-->', lt); i = e < 0 ? n : e + 3; continue; }
    if (src[lt + 1] === '/') { const e = src.indexOf('>', lt); const tag = src.slice(lt + 2, e).trim().toLowerCase(); for (let p = cur; p && p !== root; p = p.parent) if (p.tag === tag) { cur = p.parent; break; } i = e + 1; continue; }
    // 开始标签
    let j = lt + 1; const m = /^[a-zA-Z][\w-]*/.exec(src.slice(j, j + 40)); if (!m) { addText(cur, '<'); i = lt + 1; continue; }
    const el = new El(m[0]); j += m[0].length; let selfClose = false;
    while (j < n) {
      while (j < n && /\s/.test(src[j])) j++;
      if (src[j] === '>') { j++; break; }
      if (src[j] === '/' && src[j + 1] === '>') { selfClose = true; j += 2; break; }
      const am = /^[^\s=>\/]+/.exec(src.slice(j, j + 80)); if (!am) { j++; continue; }
      const name = am[0].toLowerCase(); j += name.length; let val = '';
      while (j < n && /\s/.test(src[j])) j++;
      if (src[j] === '=') {
        j++; while (j < n && /\s/.test(src[j])) j++;
        const q = src[j];
        if (q === '"' || q === "'") { const e = src.indexOf(q, j + 1); val = src.slice(j + 1, e); j = e + 1; }
        else { const vm = /^[^\s>]+/.exec(src.slice(j)); val = vm ? vm[0] : ''; j += val.length; }
      }
      val = decode(val);
      if (name === 'class') el._cls = val.split(/\s+/).filter(Boolean);
      else if (name === 'style') parseDecls(val, el.style, true);
      else { el.attrs[name] = val; if (name.startsWith('data-')) el.dataset[camel(name.slice(5))] = val; if (name === 'disabled') el._dis = true; }
    }
    el.parent = cur; cur.children.push(el); i = j;
    if (!selfClose && !VOID[el.tag]) cur = el;
  }
  const out = root.children; for (const c of out) c.parent = null; return out;
}
function addText(p, t) { if (!t) return; t = decode(t); const last = p.children[p.children.length - 1]; if (last && last.nodeType === 3) last.data += t; else { const tn = new TextNode(t); tn.parent = p; p.children.push(tn); } }

// ---------------- CSS 解析 ----------------
function parseDecls(txt, into, silent) {
  for (const part of splitTop(txt, ';')) {
    const k = part.indexOf(':'); if (k < 0) continue;
    const name = part.slice(0, k).trim().toLowerCase(), v = part.slice(k + 1).trim().replace(/\s*!important$/, '');
    if (!name) continue;
    expand(name, v, into);
  }
  if (!silent) dirty();
  return into;
}
function splitTop(s, ch) { const out = []; let d = 0, st = 0; for (let i = 0; i < s.length; i++) { const c = s[i]; if (c === '(') d++; else if (c === ')') d--; else if (c === ch && !d) { out.push(s.slice(st, i)); st = i + 1; } } out.push(s.slice(st)); return out.map(x => x.trim()).filter(Boolean); }
function splitSp(s) { const out = []; let d = 0, st = 0; for (let i = 0; i <= s.length; i++) { const c = s[i]; if (c === '(') d++; else if (c === ')') d--; else if ((c === undefined || /\s/.test(c)) && !d) { if (i > st) out.push(s.slice(st, i)); st = i + 1; } } return out; }
function box4(v) { const p = splitSp(v); return [p[0], p[1] != null ? p[1] : p[0], p[2] != null ? p[2] : p[0], p[3] != null ? p[3] : (p[1] != null ? p[1] : p[0])]; }
function expand(name, v, o) {
  const set = (k, x) => { o[k] = x; };
  switch (name) {
    case 'margin': case 'padding': { const b = box4(v); set(name + 'Top', b[0]); set(name + 'Right', b[1]); set(name + 'Bottom', b[2]); set(name + 'Left', b[3]); return; }
    case 'inset': { const b = box4(v); set('top', b[0]); set('right', b[1]); set('bottom', b[2]); set('left', b[3]); return; }
    case 'border': {
      if (v === '0' || v === 'none') { set('borderWidth', '0'); return; }
      for (const t of splitSp(v)) { if (/^[\d.]+(px)?$/.test(t)) set('borderWidth', t); else if (/^(solid|dashed|dotted|none)$/.test(t)) { if (t === 'none') set('borderWidth', '0'); } else set('borderColor', t); }
      if (!o.borderWidth) set('borderWidth', '1px'); return;
    }
    case 'outline': { if (v === 'none' || v === '0') { set('outlineWidth', '0'); return; } for (const t of splitSp(v)) { if (/^[\d.]+(px)?$/.test(t)) set('outlineWidth', t); else if (!/^(solid|dashed|dotted)$/.test(t)) set('outlineColor', t); } return; }
    case 'background': case 'background-color': set('background', v); return;
    case 'font': if (v === 'inherit') { set('fontSize', 'inherit'); set('fontWeight', 'inherit'); } return;
    case 'flex': { if (v === 'none') { set('flexGrow', '0'); set('flexShrink', '0'); set('flexBasis', 'auto'); } else if (/^[\d.]+$/.test(v)) { set('flexGrow', v); set('flexShrink', '1'); set('flexBasis', '0'); } else { const p = splitSp(v); set('flexGrow', p[0]); set('flexShrink', p[1] || '1'); set('flexBasis', p[2] || '0'); } return; }
    case 'gap': { const p = splitSp(v); set('rowGap', p[0]); set('columnGap', p[1] || p[0]); return; }
    default: set(camel(name), v);
  }
}
function parseCSS(src) {
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = []; let i = 0, order = 0; const n = src.length;
  while (i < n) {
    while (i < n && /\s/.test(src[i])) i++; if (i >= n) break;
    const ob = src.indexOf('{', i); if (ob < 0) break;
    const head = src.slice(i, ob).trim();
    // 找配对的 }
    let d = 1, j = ob + 1; while (j < n && d) { if (src[j] === '{') d++; else if (src[j] === '}') d--; j++; }
    const body = src.slice(ob + 1, j - 1); i = j;
    if (head[0] === '@') continue; // @keyframes 等忽略
    const decl = {}; parseDecls(body, decl, true);
    for (const s of parseSelList(head)) rules.push({ sel: s, spec: s.spec, order: order++, decl });
  }
  return rules;
}
const SELCACHE = new Map();
function parseSelList(txt) {
  let c = SELCACHE.get(txt); if (c) return c;
  c = splitTop(txt, ',').map(parseSel); SELCACHE.set(txt, c); return c;
}
function parseSel(s) {
  // 产出 [{comp, comb}]，comb 是与左边的关系：' ' 或 '>'
  const parts = []; let i = 0, comb = null; s = s.trim(); let spec = 0;
  while (i < s.length) {
    if (/\s/.test(s[i]) || s[i] === '>') { let gt = false; while (i < s.length && (/\s/.test(s[i]) || s[i] === '>')) { if (s[i] === '>') gt = true; i++; } comb = gt ? '>' : ' '; continue; }
    const comp = { tag: null, id: null, cls: [], attrs: [], pseudo: [] };
    const tm = /^([a-zA-Z][\w-]*|\*)/.exec(s.slice(i)); if (tm) { if (tm[0] !== '*') { comp.tag = tm[0].toLowerCase(); spec += 1; } i += tm[0].length; }
    while (i < s.length) {
      const ch = s[i];
      if (ch === '#' || ch === '.') { const m = /^[\w-]+/.exec(s.slice(i + 1)); if (ch === '#') { comp.id = m[0]; spec += 100; } else { comp.cls.push(m[0]); spec += 10; } i += 1 + m[0].length; }
      else if (ch === '[') { const e = s.indexOf(']', i); const body = s.slice(i + 1, e); const k = body.indexOf('='); comp.attrs.push(k < 0 ? [body.trim(), null] : [body.slice(0, k).trim(), body.slice(k + 1).trim().replace(/^["']|["']$/g, '')]); spec += 10; i = e + 1; }
      else if (ch === ':') { const m = /^:?[\w-]+(\([^)]*\))?/.exec(s.slice(i + 1)); comp.pseudo.push(m[0].replace(/^:/, '')); spec += 10; i += 1 + m[0].length; }
      else break;
    }
    parts.push({ comp, comb }); comb = null;
  }
  parts.spec = spec; return parts;
}
function matchComp(e, c) {
  if (e.nodeType !== 1) return false;
  if (c.tag && e.tag !== c.tag) return false;
  if (c.id && e.attrs.id !== c.id) return false;
  for (const k of c.cls) if (!e._cls.includes(k)) return false;
  for (const [k, v] of c.attrs) { const a = k.startsWith('data-') ? e.dataset[camel(k.slice(5))] : (k === 'class' ? e.className : e.attrs[k]); if (a == null) return false; if (v != null && String(a) !== v) return false; }
  for (const p of c.pseudo) {
    if (p === 'disabled') { if (!e._dis) return false; }
    else if (p === 'first-child') { if (!e.parent || e.parent.children.find(x => x.nodeType === 1) !== e) return false; }
    else if (p === 'last-child') { if (!e.parent) return false; const ks = e.parent.children.filter(x => x.nodeType === 1); if (ks[ks.length - 1] !== e) return false; }
    else return false; // :hover 等永不匹配
  }
  return true;
}
function matchSel(e, parts, k) {
  if (k == null) k = parts.length - 1;
  if (!matchComp(e, parts[k].comp)) return false;
  if (k === 0) return true;
  const comb = parts[k].comb;
  if (comb === '>') return !!e.parent && e.parent.nodeType === 1 && matchSel(e.parent, parts, k - 1);
  for (let p = e.parent; p && p.nodeType === 1; p = p.parent) if (matchSel(p, parts, k - 1)) return true;
  return false;
}

// ---------------- 计算样式 ----------------
let GEN = 0;
function dirty() { if (UI) UI.dirty = true; }
function comp(e) {
  if (e._csGen === GEN) return e._cs;
  const ps = e.parent && e.parent.nodeType === 1 ? comp(e.parent) : UI.rootStyle;
  const d = Object.assign({}, UA[e.tag] || {});
  const hits = [];
  for (const r of UI.rules) if (matchSel(e, r.sel)) hits.push(r);
  hits.sort((a, b) => a.spec - b.spec || a.order - b.order);
  for (const r of hits) Object.assign(d, r.decl);
  const st = e.style; for (const k in st) if (st[k] !== '') d[k] = st[k];
  const cs = {};
  for (const k of INHERIT) cs[k] = ps[k];
  for (const k in d) cs[k] = d[k];
  for (const k of INHERIT) if (cs[k] === 'inherit') cs[k] = ps[k];
  // 字号与行高
  let fs = ps.fontSize; const fv = d.fontSize;
  if (fv && fv !== 'inherit') { if (/em$/.test(fv)) fs = parseFloat(fv) * ps.fontSize; else if (/%$/.test(fv)) fs = parseFloat(fv) / 100 * ps.fontSize; else fs = parseFloat(fv) || ps.fontSize; }
  cs.fontSize = fs;
  const fw = cs.fontWeight; cs.fontWeight = fw === 'bold' ? 700 : fw === 'normal' ? 400 : (+fw || 400);
  const lh = d.lineHeight; let lm = ps.lhMode, lv = ps.lhVal;
  if (lh && lh !== 'inherit') { if (/px$/.test(lh)) { lm = 'px'; lv = parseFloat(lh); } else if (lh === 'normal') { lm = 'mul'; lv = 1.25; } else { lm = 'mul'; lv = parseFloat(lh); } }
  cs.lhMode = lm; cs.lhVal = lv; cs.lh = lm === 'px' ? lv : lv * fs;
  cs.display = cs.display || 'inline';
  cs.position = cs.position || 'static';
  cs.font = (cs.fontWeight >= 600 ? 'bold ' : '') + fs + 'px ' + UI.fontFamily;
  e._cs = cs; e._csGen = GEN; return cs;
}

// ---------------- 长度 ----------------
function len(v, ref, fs) {
  if (v == null || v === '' || v === 'auto' || v === 'none') return null;
  if (typeof v === 'number') return v;
  v = v.trim();
  if (/^-?[\d.]+px$/.test(v)) return parseFloat(v);
  if (/^-?[\d.]+$/.test(v)) return parseFloat(v);
  if (/%$/.test(v) && /^-?[\d.]+%$/.test(v)) return ref == null ? null : parseFloat(v) / 100 * ref;
  if (/^-?[\d.]+d?v[wh]$/.test(v)) return parseFloat(v) / 100 * (/w$/.test(v) ? UI.vw : UI.vh);
  if (/^-?[\d.]+em$/.test(v)) return parseFloat(v) * (fs || 16);
  return evalExpr(v, ref, fs);
}
function evalExpr(s, ref, fs) {
  // 支持 min()/max()/calc() 与 + - * /
  let i = 0;
  const ws = () => { while (/\s/.test(s[i])) i++; };
  function prim() {
    ws();
    if (s[i] === '(') { i++; const v = sum(); ws(); i++; return v; }
    const fm = /^(min|max|calc)\(/.exec(s.slice(i));
    if (fm) { i += fm[0].length; const args = [sum()]; ws(); while (s[i] === ',') { i++; args.push(sum()); ws(); } i++; return fm[1] === 'min' ? Math.min(...args) : fm[1] === 'max' ? Math.max(...args) : args[0]; }
    const m = /^-?[\d.]+(px|%|dvh|dvw|vh|vw|em)?/.exec(s.slice(i)); if (!m) { i++; return 0; }
    i += m[0].length; return len(m[0], ref, fs) || 0;
  }
  function prod() { let v = prim(); for (;;) { ws(); if (s[i] === '*') { i++; v *= prim(); } else if (s[i] === '/') { i++; v /= prim(); } else return v; } }
  function sum() { let v = prod(); for (;;) { ws(); if (s[i] === '+' && /\s/.test(s[i + 1] || ' ')) { i++; v += prod(); } else if (s[i] === '-' && /\s/.test(s[i + 1] || ' ')) { i++; v -= prod(); } else return v; } }
  try { return sum(); } catch (e) { return null; }
}
const px = (v, ref, fs) => { const r = len(v, ref, fs); return r == null ? 0 : r; };
function edges(cs, ref) {
  const fs = cs.fontSize;
  const m = k => cs['margin' + k] === 'auto' ? 'auto' : px(cs['margin' + k], ref, fs);
  const bw = cs.borderWidth != null ? px(cs.borderWidth) : 0;
  return { mt: m('Top'), mr: m('Right'), mb: m('Bottom'), ml: m('Left'),
    pt: px(cs.paddingTop, ref, fs), pr: px(cs.paddingRight, ref, fs), pb: px(cs.paddingBottom, ref, fs), pl: px(cs.paddingLeft, ref, fs), bw };
}
const num = v => v === 'auto' ? 0 : v;

// ---------------- 文字测量 ----------------
const MCACHE = new Map();
function measure(font, t) {
  const k = font + '\u0001' + t; let w = MCACHE.get(k);
  if (w == null) { const c = UI.mctx; c.font = font; w = c.measureText(t).width; if (MCACHE.size > 20000) MCACHE.clear(); MCACHE.set(k, w); }
  return w;
}
function units(text, cs) {
  const t = cs.whiteSpace === 'pre' ? text : text.replace(/[ \t\n\r\f]+/g, ' ');
  if (cs.whiteSpace === 'nowrap') return t ? [{ text: t, space: t === ' ' }] : [];
  const raw = t.match(UNIT_RE) || []; const out = [];
  for (const u of raw) {
    const sp = /^\s+$/.test(u) && u !== ' ';
    if (sp) { out.push({ text: ' ', space: true }); continue; }
    const prev = out[out.length - 1];
    if (prev && !prev.space && (CLOSE_P.includes(u[0]) || (prev.open))) { prev.text += u; prev.open = OPEN_P.includes(u[u.length - 1]); continue; }
    out.push({ text: u, space: false, open: OPEN_P.includes(u[u.length - 1]) });
  }
  return out;
}

// ---------------- 排版 ----------------
const isPos = cs => cs.position === 'absolute' || cs.position === 'fixed';
const isBlockLevel = cs => cs.display === 'block' || cs.display === 'flex' || cs.display === 'grid' || cs.display === 'list-item';
const isAtom = (e, cs) => e.tag === 'img' || e.tag === 'svg' || e.tag === 'canvas' || cs.display === 'inline-block' || cs.display === 'inline-flex' || e.tag === 'button';
const visible = e => e.nodeType === 3 || comp(e).display !== 'none';

function intrinsic(e, cs) {
  if (e.tag === 'img') { const im = UI.img(e.attrs.src); return [im && im.width ? im.width : 0, im && im.height ? im.height : 0]; }
  if (e.tag === 'svg') return [300, 150];
  if (e.tag === 'canvas') return [e._cv ? e._cv.width : 300, e._cv ? e._cv.height : 150];
  return [0, 0];
}
function aspect(cs) { const a = cs.aspectRatio; if (!a) return null; const p = a.split('/'); return p.length === 2 ? parseFloat(p[0]) / parseFloat(p[1]) : parseFloat(a); }

// 最大内容宽度（不换行时的宽度），用于收缩适配
function maxContent(e) {
  if (e.nodeType === 3) return 0;
  const cs = comp(e); if (cs.display === 'none' || isPos(cs)) return 0;
  const ed = edges(cs, null), padb = ed.pl + ed.pr + 2 * ed.bw;
  const w = len(cs.width, null, cs.fontSize); let r;
  if (w != null) r = w;
  else if (e.tag === 'img' || e.tag === 'svg' || e.tag === 'canvas') { const [iw, ih] = intrinsic(e, cs); const h = len(cs.height, null); r = h != null && ih ? iw * h / ih : iw; }
  else if (cs.display === 'flex' && (cs.flexDirection || 'row') === 'row') {
    const its = flexItems(e); const gap = px(cs.columnGap); r = 0; its.forEach((it, i) => { r += itemMax(it) + (i ? gap : 0); }); r += padb;
  } else if (cs.display === 'grid') {
    const n = gridCols(cs); let m = 0; for (const c of e.children) if (c.nodeType === 1 && visible(c)) m = Math.max(m, itemMax(c)); r = n * m + (n - 1) * px(cs.columnGap) + padb;
  } else {
    let best = 0, line = 0;
    const flush = () => { best = Math.max(best, line); line = 0; };
    const run = (p, pcs) => {
      for (const c of p.children) {
        if (c.nodeType === 3) { for (const u of units(c.data, pcs)) line += measure(pcs.font, u.text); continue; }
        const ccs = comp(c); if (ccs.display === 'none' || isPos(ccs)) continue;
        if (c.tag === 'br') { flush(); continue; }
        if (isBlockLevel(ccs) && !isAtom(c, ccs) && p === e) { flush(); best = Math.max(best, itemMax(c)); continue; }
        if (ccs.float === 'right' || ccs.float === 'left' || isAtom(c, ccs) || isBlockLevel(ccs)) { line += itemMax(c); continue; }
        run(c, ccs);
      }
    };
    if (cs.display === 'flex') { for (const it of flexItems(e)) best = Math.max(best, itemMax(it)); }
    else run(e, cs);
    flush(); r = best + padb;
  }
  const mx = len(cs.maxWidth, null, cs.fontSize); if (mx != null) r = Math.min(r, mx);
  const mn = len(cs.minWidth, null, cs.fontSize); if (mn != null) r = Math.max(r, mn);
  return r;
}
function itemMax(it) {
  if (it.anon) { const fake = it; let w = 0; for (const c of fake.nodes) { if (c.nodeType === 3) for (const u of units(c.data, fake.cs)) w += measure(fake.cs.font, u.text); else w += maxContent(c); } return w; }
  const cs = comp(it), ed = edges(it._cs, null); return maxContent(it) + num(ed.ml) + num(ed.mr);
}
function gridCols(cs) { const g = cs.gridTemplateColumns || ''; const m = /repeat\((\d+)/.exec(g); return m ? +m[1] : Math.max(1, splitSp(g).length); }
function flexItems(e) {
  const out = []; let anon = null; const cs = comp(e);
  for (const c of e.children) {
    if (c.nodeType === 3) { if (/^\s*$/.test(c.data)) continue; if (!anon) { anon = { anon: true, nodes: [], cs }; out.push(anon); } anon.nodes.push(c); continue; }
    const ccs = comp(c); if (ccs.display === 'none') continue; if (isPos(ccs)) { UI.posQ.push(c); continue; }
    if (c.tag === 'br') continue;
    anon = null; out.push(c);
  }
  return out;
}

// 用宽度 w 排版元素 e（边框盒），左上角 (x,y)。forcedH：父容器强制的高度。返回边框盒高度
function layoutEl(e, x, y, w, forcedH) {
  const cs = comp(e), ed = edges(cs, w), fs = cs.fontSize;
  const cx = x + ed.bw + ed.pl, cy = y + ed.bw + ed.pt, cw = Math.max(0, w - 2 * ed.bw - ed.pl - ed.pr);
  let eh = forcedH != null ? forcedH : len(cs.height, e._cbH, fs);
  const ar = aspect(cs);
  if (eh == null && ar) eh = w / ar;
  e._txt = []; e._b = { x, y, w, h: 0 }; e._posd = isPos(cs);
  let ch = 0;
  if (e.tag === 'img' || e.tag === 'svg' || e.tag === 'canvas') {
    if (eh == null) { const [iw, ih] = intrinsic(e, cs); eh = iw ? w * ih / iw : ih; }
  } else {
    const innerH = eh != null ? Math.max(0, eh - 2 * ed.bw - ed.pt - ed.pb) : null;
    if (cs.display === 'flex') ch = (cs.flexDirection || 'row').startsWith('column') ? layoutCol(e, cs, cx, cy, cw, innerH) : layoutRow(e, cs, cx, cy, cw, innerH);
    else if (cs.display === 'grid') ch = layoutGrid(e, cs, cx, cy, cw);
    else ch = layoutFlow(e, cs, cx, cy, cw);
  }
  let h = eh != null ? eh : ch + 2 * ed.bw + ed.pt + ed.pb;
  const mnh = len(cs.minHeight, null, fs); if (mnh != null && eh == null) h = Math.max(h, mnh);
  e._b.h = h; e._ch = ch + 2 * ed.bw + ed.pt + ed.pb;
  e._scroll = (cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflow === 'auto') && e._ch > h + 2;
  e._clip = e._scroll || cs.overflow === 'hidden' || cs.overflowY === 'auto' || cs.overflow === 'auto';
  if (e._scroll) e.scrollTop = Math.max(0, Math.min(e.scrollTop, e._ch - h)); else e.scrollTop = 0;
  return h;
}
function usedW(e, avail, mode) {
  const cs = comp(e), ed = edges(cs, avail), fs = cs.fontSize;
  let w = len(cs.width, avail, fs);
  if (w == null) {
    const room = avail - num(ed.ml) - num(ed.mr);
    if (mode === 'stretch') w = room; else w = Math.min(room, maxContent(e) - 0);
  }
  const mx = len(cs.maxWidth, avail, fs); if (mx != null) w = Math.min(w, mx);
  const mn = len(cs.minWidth, avail, fs); if (mn != null) w = Math.max(w, mn);
  return Math.max(0, w);
}
function layoutFlow(e, cs, cx, cy, cw) {
  // 把子节点分成：连续行内内容（匿名行盒）与块级元素
  let y = cy, inl = [];
  const flushInl = () => { if (inl.length) { y += layoutIFC(e, cs, inl, cx, y, cw); inl = []; } };
  for (const c of e.children) {
    if (c.nodeType === 3) { inl.push(c); continue; }
    const ccs = comp(c); if (ccs.display === 'none') continue;
    if (isPos(ccs)) { UI.posQ.push(c); continue; }
    if (isBlockLevel(ccs) && ccs.float !== 'right' && ccs.float !== 'left') {
      flushInl();
      const ed = edges(ccs, cw), w = usedW(c, cw, 'stretch');
      let x = cx + num(ed.ml);
      if (ed.ml === 'auto' && ed.mr === 'auto') x = cx + (cw - w) / 2; else if (ed.ml === 'auto') x = cx + cw - w - num(ed.mr);
      y += num(ed.mt); const h = layoutEl(c, x, y, w); y += h + num(ed.mb);
      continue;
    }
    inl.push(c);
  }
  flushInl();
  return y - cy;
}
// 行内格式化：文字、inline-block 原子、<br>、右浮动
function layoutIFC(e, cs, nodes, cx, cy, cw) {
  const items = [];
  const collect = (list, pcs) => {
    for (const c of list) {
      if (c.nodeType === 3) { for (const u of units(c.data, pcs)) items.push({ t: 'text', u, cs: pcs }); continue; }
      const ccs = comp(c); if (ccs.display === 'none') continue;
      if (isPos(ccs)) { UI.posQ.push(c); continue; }
      if (c.tag === 'br') { items.push({ t: 'br', cs: pcs }); continue; }
      if (ccs.float === 'right' || ccs.float === 'left') { items.push({ t: 'float', el: c, side: ccs.float }); continue; }
      if (isAtom(c, ccs) || isBlockLevel(ccs)) { items.push({ t: 'atom', el: c }); continue; }
      collect(c.children, ccs);
    }
  };
  collect(nodes, cs);
  if (!items.some(it => it.t !== 'text' || !it.u.space)) return 0;
  // 浮动：放在右上角，压缩它覆盖范围内各行的可用宽度
  const floats = [];
  for (const it of items) if (it.t === 'float') {
    const c = it.el, ed = edges(comp(c), cw), w = usedW(c, cw, 'shrink');
    const fx = it.side === 'right' ? cx + cw - w - num(ed.mr) : cx + num(ed.ml);
    const h = layoutEl(c, fx, cy + num(ed.mt), w);
    floats.push({ side: it.side, x0: fx - num(ed.ml), x1: fx + w + num(ed.mr), y1: cy + num(ed.mt) + h + num(ed.mb) });
  }
  const lines = []; let line = null, y = cy;
  const room = yy => { let l = cx, r = cx + cw; for (const f of floats) if (yy < f.y1) { if (f.side === 'right') r = Math.min(r, f.x0); else l = Math.max(l, f.x1); } return [l, r]; };
  const newLine = () => { const [l, r] = room(y); line = { items: [], w: 0, h: 0, l, r, y }; lines.push(line); };
  const endLine = () => {
    if (!line) return;
    while (line.items.length && line.items[line.items.length - 1].space) { const s = line.items.pop(); line.w -= s.w; }
    if (!line.h) line.h = line.items.length ? 0 : cs.lh;
    y += line.h; line = null;
  };
  newLine();
  for (const it of items) {
    if (it.t === 'float') continue;
    if (it.t === 'br') { if (!line.h) line.h = it.cs.lh; endLine(); newLine(); continue; }
    if (it.t === 'text') {
      const u = it.u;
      if (u.space) { if (!line.items.length) continue; const w = measure(it.cs.font, ' '); line.items.push({ space: true, text: ' ', w, cs: it.cs }); line.w += w; continue; }
      const w = measure(it.cs.font, u.text);
      if (line.w + w > line.r - line.l + .5 && line.items.some(x => !x.space)) { endLine(); newLine(); }
      line.items.push({ text: u.text, w, cs: it.cs }); line.w += w; line.h = Math.max(line.h, it.cs.lh);
      continue;
    }
    // 原子
    const c = it.el, ccs = comp(c), ed = edges(ccs, cw);
    const avail = line.r - line.l;
    let w = usedW(c, cw, ccs.display === 'block' || ccs.display === 'flex' || ccs.display === 'grid' ? 'stretch' : 'shrink');
    if (isBlockLevel(ccs) && !isAtom(c, ccs)) w = usedW(c, cw, 'stretch');
    const mw = w + num(ed.ml) + num(ed.mr);
    if (line.w + mw > avail + .5 && line.items.some(x => !x.space)) { endLine(); newLine(); }
    const h = layoutEl(c, 0, 0, w);
    line.items.push({ atom: c, w: mw, h: h + num(ed.mt) + num(ed.mb), ml: num(ed.ml), mt: num(ed.mt) });
    line.w += mw; line.h = Math.max(line.h, h + num(ed.mt) + num(ed.mb));
    if (isBlockLevel(ccs)) { endLine(); newLine(); }
  }
  endLine();
  // 放置
  const ta = cs.textAlign || 'left';
  for (const L of lines) {
    const free = (L.r - L.l) - L.w; let x = L.l + (ta === 'center' ? free / 2 : ta === 'right' ? free : 0);
    for (const it of L.items) {
      if (it.atom) { const dy = L.y + (L.h - it.h) / 2 + it.mt; shift(it.atom, x + it.ml - it.atom._b.x, dy - it.atom._b.y); }
      else if (!it.space) e._txt.push({ x, y: L.y + L.h / 2, text: it.text, font: it.cs.font, color: it.cs.color });
      x += it.w;
    }
  }
  let fb = y; for (const f of floats) fb = Math.max(fb, f.y1);
  return fb - cy;
}
function shift(e, dx, dy) {
  if (!dx && !dy) return;
  if (e._b) { e._b.x += dx; e._b.y += dy; }
  if (e._txt) for (const t of e._txt) { t.x += dx; t.y += dy; }
  for (const c of e.children) if (c.nodeType === 1 && c._b && !c._posd) shift(c, dx, dy);
}
function flexOf(it) { if (it.anon) return { g: 0, s: 1, b: 'auto' }; const cs = comp(it); return { g: parseFloat(cs.flexGrow) || 0, s: cs.flexShrink != null ? parseFloat(cs.flexShrink) : 1, b: cs.flexBasis || 'auto' }; }
function layoutAnon(it, x, y, w) {
  // 匿名项：用一个临时容器排版其中的行内内容
  const tmp = it.box || (it.box = new El('span')); tmp._cs = Object.assign({}, it.cs, { display: 'block', paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0, borderWidth: 0, background: null, width: null, height: null }); tmp._csGen = GEN;
  tmp.children = it.nodes; tmp._txt = []; tmp._b = { x, y, w, h: 0 };
  const h = layoutIFC(tmp, tmp._cs, it.nodes, x, y, w); tmp._b.h = h; return h;
}
function layoutRow(e, cs, cx, cy, cw, innerH) {
  const its = flexItems(e), gap = px(cs.columnGap, cw);
  const info = its.map(it => {
    const f = flexOf(it), ed = it.anon ? { ml: 0, mr: 0, mt: 0, mb: 0 } : edges(comp(it), cw);
    let basis;
    if (f.b !== 'auto' && f.b !== 'content') basis = px(f.b, cw);
    else if (!it.anon && len(comp(it).width, cw) != null) basis = usedW(it, cw, 'shrink');
    else basis = it.anon ? itemMax(it) : maxContent(it);
    return { it, f, ed, basis, w: basis };
  });
  const used = info.reduce((a, i) => a + i.basis + num(i.ed.ml) + num(i.ed.mr), 0) + gap * Math.max(0, its.length - 1);
  let free = cw - used;
  if (free > 0) { const tg = info.reduce((a, i) => a + i.f.g, 0); if (tg) for (const i of info) i.w = i.basis + free * i.f.g / tg; }
  else if (free < 0) { const ts = info.reduce((a, i) => a + i.f.s * i.basis, 0); if (ts) for (const i of info) i.w = Math.max(0, i.basis + free * i.f.s * i.basis / ts); }
  for (const i of info) if (!i.it.anon) { const ccs = comp(i.it), mx = len(ccs.maxWidth, cw), mn = len(ccs.minWidth, cw); if (mx != null) i.w = Math.min(i.w, mx); if (mn != null) i.w = Math.max(i.w, mn); }
  // 先在 (0,0) 排版测高
  let lineH = 0;
  for (const i of info) { i.h = i.it.anon ? layoutAnon(i.it, 0, 0, i.w) : layoutEl(i.it, 0, 0, i.w); lineH = Math.max(lineH, i.h + num(i.ed.mt) + num(i.ed.mb)); }
  if (innerH != null) lineH = Math.max(lineH, innerH);
  const totalW = info.reduce((a, i) => a + i.w + num(i.ed.ml) + num(i.ed.mr), 0) + gap * Math.max(0, its.length - 1);
  const jc = cs.justifyContent || 'flex-start', ai = cs.alignItems || 'stretch';
  let left = cw - totalW, x = cx, g = gap;
  if (jc === 'center') x += left / 2; else if (jc === 'flex-end') x += left; else if (jc === 'space-between' && its.length > 1) g += left / (its.length - 1); else if (jc === 'space-around' && its.length) { x += left / its.length / 2; g += left / its.length; }
  for (const i of info) {
    x += num(i.ed.ml);
    const as = i.it.anon ? ai : (comp(i.it).alignSelf || ai);
    let y = cy + num(i.ed.mt);
    const stretchable = !i.it.anon && len(comp(i.it).height, null) == null;
    if (as === 'stretch' && stretchable) {
      const target = lineH - num(i.ed.mt) - num(i.ed.mb);
      if (Math.abs(target - i.h) > .5 && (comp(i.it).display === 'flex')) { layoutEl(i.it, x, y, i.w, target); }
      else { if (i.it.anon) shiftAnon(i.it, x, y); else { shift(i.it, x - i.it._b.x, y - i.it._b.y); i.it._b.h = target; } }
    } else {
      if (as === 'center') y = cy + (lineH - i.h) / 2; else if (as === 'flex-end') y = cy + lineH - i.h - num(i.ed.mb);
      if (i.it.anon) shiftAnon(i.it, x, y); else shift(i.it, x - i.it._b.x, y - i.it._b.y);
    }
    if (i.it.anon) e._txt.push(...i.it.box._txt.map(t => t)), moveAnonAtoms(i.it);
    x += i.w + num(i.ed.mr) + g;
  }
  return lineH;
}
function shiftAnon(it, x, y) { const b = it.box; const dx = x - b._b.x, dy = y - b._b.y; for (const t of b._txt) { t.x += dx; t.y += dy; } for (const n of it.nodes) if (n.nodeType === 1 && n._b) shift(n, dx, dy); b._b.x = x; b._b.y = y; }
function moveAnonAtoms() {}
function layoutCol(e, cs, cx, cy, cw, innerH) {
  const its = flexItems(e), gap = px(cs.rowGap, cw), ai = cs.alignItems || 'stretch';
  const info = its.map(it => {
    if (it.anon) { const h = layoutAnon(it, 0, 0, cw); return { it, f: { g: 0, s: 1 }, ed: { ml: 0, mr: 0, mt: 0, mb: 0 }, w: cw, h }; }
    const ccs = comp(it), ed = edges(ccs, cw), as = ccs.alignSelf || ai;
    const autoX = ed.ml === 'auto' || ed.mr === 'auto';
    const w = usedW(it, cw, as === 'stretch' && !autoX ? 'stretch' : 'shrink');
    const f = flexOf(it);
    const h = layoutEl(it, 0, 0, w);
    return { it, f, ed, w, h, as };
  });
  const basisOf = i => (i.f.g && i.f.b !== 'auto' && i.f.b != null && !i.it.anon) ? Math.max(px(i.f.b), len(comp(i.it).minHeight, null) || 0) : i.h;
  const sumM = i => num(i.ed.mt) + num(i.ed.mb);
  let used = info.reduce((a, i) => a + basisOf(i) + sumM(i), 0) + gap * Math.max(0, its.length - 1);
  const free = innerH != null ? innerH - used : 0;
  const tg = info.reduce((a, i) => a + i.f.g, 0);
  for (const i of info) i.H = basisOf(i);
  if (free > 0 && tg) for (const i of info) if (i.f.g) i.H += free * i.f.g / tg;
  // 自动外边距吃掉剩余空间（#ov 的首尾子元素 margin:auto 让内容在不够高时居中）
  let autoN = 0; if (free > 0 && !tg) for (const i of info) { if (i.ed.mt === 'auto') autoN++; if (i.ed.mb === 'auto') autoN++; }
  const autoEach = autoN ? free / autoN : 0;
  const jc = cs.justifyContent || 'flex-start';
  let y = cy; if (free > 0 && !tg && !autoN) { if (jc === 'center') y += free / 2; else if (jc === 'flex-end') y += free; }
  for (const i of info) {
    y += i.ed.mt === 'auto' ? autoEach : num(i.ed.mt);
    let x = cx + num(i.ed.ml);
    if (i.it.anon) { shiftAnon(i.it, cx, y); e._txt.push(...i.it.box._txt); y += i.h + gap; continue; }
    const as = i.as;
    if (i.ed.ml === 'auto' && i.ed.mr === 'auto') x = cx + (cw - i.w) / 2;
    else if (i.ed.ml === 'auto') x = cx + cw - i.w - num(i.ed.mr);
    else if (as === 'center') x = cx + (cw - i.w) / 2;
    else if (as === 'flex-end') x = cx + cw - i.w - num(i.ed.mr);
    if (Math.abs(i.H - i.h) > .5) layoutEl(i.it, x, y, i.w, i.H); else shift(i.it, x - i.it._b.x, y - i.it._b.y);
    y += i.H + (i.ed.mb === 'auto' ? autoEach : num(i.ed.mb)) + gap;
  }
  if (its.length) y -= gap;
  return Math.max(y - cy, innerH != null ? innerH : 0);
}
function layoutGrid(e, cs, cx, cy, cw) {
  const n = gridCols(cs), cg = px(cs.columnGap, cw), rg = px(cs.rowGap, cw);
  const colW = (cw - cg * (n - 1)) / n;
  const its = []; for (const c of e.children) { if (c.nodeType !== 1) continue; const ccs = comp(c); if (ccs.display === 'none') continue; if (isPos(ccs)) { UI.posQ.push(c); continue; } its.push(c); }
  let y = cy;
  for (let r = 0; r < its.length; r += n) {
    const row = its.slice(r, r + n); let rh = 0;
    row.forEach((c, k) => { const ed = edges(comp(c), colW); const w = usedW(c, colW, 'stretch'); const h = layoutEl(c, cx + k * (colW + cg) + num(ed.ml), y + num(ed.mt), w); rh = Math.max(rh, h + num(ed.mt) + num(ed.mb)); });
    row.forEach(c => { const ed = edges(comp(c), colW); if (len(comp(c).height, null) == null) c._b.h = rh - num(ed.mt) - num(ed.mb); });
    y += rh + rg;
  }
  if (its.length) y -= rg;
  return y - cy;
}
function layoutPositioned(e) {
  const cs = comp(e); e._posd = true;
  let cb;
  if (cs.position === 'fixed') cb = { x: 0, y: 0, w: UI.vw, h: UI.vh };
  else { let p = e.parent; while (p && p.nodeType === 1 && comp(p).position === 'static') p = p.parent; const b = p && p._b ? p._b : { x: 0, y: 0, w: UI.vw, h: UI.vh }; const bw = p && p._cs ? px(p._cs.borderWidth) : 0; cb = { x: b.x + bw, y: b.y + bw, w: b.w - 2 * bw, h: b.h - 2 * bw }; }
  const fs = cs.fontSize, L = len(cs.left, cb.w, fs), R = len(cs.right, cb.w, fs), T = len(cs.top, cb.h, fs), B = len(cs.bottom, cb.h, fs);
  e._cbH = cb.h;
  let w = len(cs.width, cb.w, fs);
  if (w == null) w = (L != null && R != null) ? cb.w - L - R : Math.min(maxContent(e), cb.w - (L || 0) - (R || 0));
  const mx = len(cs.maxWidth, cb.w, fs); if (mx != null) w = Math.min(w, mx);
  let h = len(cs.height, cb.h, fs); if (h == null && T != null && B != null) h = cb.h - T - B;
  let x = cb.x + (L != null ? L : R != null ? cb.w - R - w : 0);
  if (/translateX\(-50%\)/.test(cs.transform || '')) x -= w / 2;
  let y = cb.y + (T != null ? T : 0);
  const hh = layoutEl(e, x, y, w, h);
  if (T == null && B != null) shift(e, 0, cb.y + cb.h - B - hh - y);
}
function layoutAll() {
  GEN++; UI.posQ = []; UI.posList = [];
  const body = UI.body;
  body._cbH = UI.vh;
  layoutEl(body, 0, 0, UI.vw, UI.vh);
  for (let k = 0; k < UI.posQ.length; k++) { const p = UI.posQ[k]; layoutPositioned(p); UI.posList.push(p); }
  // 按 z-index 排序（稳定）
  UI.posList = UI.posList.map((e, i) => [e, i]).sort((a, b) => ((parseInt(a[0]._cs.zIndex) || 0) - (parseInt(b[0]._cs.zIndex) || 0)) || a[1] - b[1]).map(a => a[0]);
  UI.dirty = false;
}

// ---------------- 绘制 ----------------
function hex8(c) { if (typeof c !== 'string') return c; const m = /^#([0-9a-f]{8})$/i.exec(c.trim()); if (!m) { const m4 = /^#([0-9a-f]{4})$/i.exec(c.trim()); if (!m4) return c; const h = m4[1]; return `rgba(${parseInt(h[0] + h[0], 16)},${parseInt(h[1] + h[1], 16)},${parseInt(h[2] + h[2], 16)},${(parseInt(h[3] + h[3], 16) / 255).toFixed(3)})`; } const h = m[1]; return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${(parseInt(h.slice(6, 8), 16) / 255).toFixed(3)})`; }
function rr(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r); c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath(); }
function paintBg(c, b, cs, r) {
  const bg = cs.background;
  if (!bg || bg === 'none' || bg === 'transparent') return false;
  const g = /^linear-gradient\((.*)\)$/.exec(bg.trim());
  if (g) {
    const a = splitTop(g[1], ','); let ang = 180; if (/deg$/.test(a[0])) ang = parseFloat(a.shift());
    const rad = ang * Math.PI / 180, dx = Math.sin(rad), dy = -Math.cos(rad), half = (Math.abs(b.w * dx) + Math.abs(b.h * dy)) / 2, mx = b.x + b.w / 2, my = b.y + b.h / 2;
    const gr = c.createLinearGradient(mx - dx * half, my - dy * half, mx + dx * half, my + dy * half);
    a.forEach((col, i) => { const p = splitSp(col); gr.addColorStop(p[1] ? parseFloat(p[1]) / 100 : i / Math.max(1, a.length - 1), hex8(p[0])); });
    c.fillStyle = gr;
  } else c.fillStyle = hex8(bg);
  rr(c, b.x, b.y, b.w, b.h, r); c.fill(); return true;
}
function radius(cs, b) { const v = cs.borderRadius; if (!v) return 0; if (/%$/.test(v)) return parseFloat(v) / 100 * Math.min(b.w, b.h); return px(v); }
function paintEl(c, e, t) {
  if (e.nodeType !== 1 || !e._b) return;
  const cs = e._cs; if (!cs || cs.display === 'none' || cs.visibility === 'hidden') return;
  const b = e._b; const op = cs.opacity != null && cs.opacity !== '' ? parseFloat(cs.opacity) : 1; if (op <= 0) return;
  c.save(); if (op < 1) c.globalAlpha *= op;
  const r = radius(cs, b), dpr = UI.dpr;
  // 外发光阴影
  const sh = cs.boxShadow;
  if (sh && sh !== 'none' && cs.background) {
    const p = splitSp(sh); const col = p.find(x => /^(#|rgb|hsl)/.test(x)); const nums = p.filter(x => /^-?[\d.]+(px)?$/.test(x)).map(x => parseFloat(x));
    if (col) { c.save(); c.shadowColor = hex8(col); c.shadowOffsetX = (nums[0] || 0) * dpr; c.shadowOffsetY = (nums[1] || 0) * dpr; c.shadowBlur = (nums[2] || 0) * dpr; paintBg(c, b, cs, r); c.restore(); }
  }
  paintBg(c, b, cs, r);
  const bw = cs.borderWidth != null ? px(cs.borderWidth) : 0;
  if (bw > 0 && cs.borderColor) { c.strokeStyle = hex8(cs.borderColor); c.lineWidth = bw; rr(c, b.x + bw / 2, b.y + bw / 2, b.w - bw, b.h - bw, Math.max(0, r - bw / 2)); c.stroke(); }
  // 新手引导的脉冲描边
  if (e._cls.includes('gpulse')) {
    const k = .5 + .5 * Math.sin(t / 160); const ow = 3, off = 1 + 6 * (1 - k);
    c.strokeStyle = `rgba(253,224,71,${.55 + .45 * k})`; c.lineWidth = ow; rr(c, b.x - off - ow / 2, b.y - off - ow / 2, b.w + 2 * off + ow, b.h + 2 * off + ow, r + off); c.stroke();
  }
  // 替换元素
  if (e.tag === 'canvas' && e._cv) { if (r > 0) { c.save(); rr(c, b.x, b.y, b.w, b.h, r); c.clip(); } c.drawImage(e._cv, b.x, b.y, b.w, b.h); if (r > 0) c.restore(); }
  else if (e.tag === 'img') { const im = UI.img(e.attrs.src); if (im && im.width) c.drawImage(im, b.x, b.y, b.w, b.h); }
  else if (e.tag === 'svg') paintSvg(c, e, b, r);
  // 内容
  const clip = e._clip;
  if (clip) { c.save(); rr(c, b.x, b.y, b.w, b.h, r); c.clip(); if (e._scroll) c.translate(0, -e.scrollTop); }
  if (e._txt && e._txt.length) {
    c.textBaseline = 'middle'; c.textAlign = 'left';
    let lf = null, lc = null;
    for (const s of e._txt) { if (s.font !== lf) { c.font = s.font; lf = s.font; } if (s.color !== lc) { c.fillStyle = hex8(s.color) || '#e5e7eb'; lc = s.color; } c.fillText(s.text, s.x, s.y + UI.textNudge * parseFloat(s.font.replace(/^bold /, ''))); }
  }
  for (const ch of e.children) if (ch.nodeType === 1 && !ch._posd) paintEl(c, ch, t);
  if (clip) c.restore();
  // 可滚动时：右侧细滚动条 + 底部渐隐提示"下面还有"
  if (e._scroll) {
    const H = b.h, total = e._ch, st = e.scrollTop, bh = Math.max(24, H * H / total), by = b.y + (H - bh) * st / (total - H);
    c.fillStyle = 'rgba(255,255,255,.35)'; rr(c, b.x + b.w - 4, by + 2, 3, bh - 4, 1.5); c.fill();
    if (st < total - H - 2) {
      const bg = (UI.body._cs && UI.body._cs.background) || '#000', fh = Math.min(28, H / 3);
      const g = c.createLinearGradient(0, b.y + H - fh, 0, b.y + H); g.addColorStop(0, 'rgba(13,16,32,0)'); g.addColorStop(1, 'rgba(13,16,32,.92)');
      c.fillStyle = g; c.fillRect(b.x, b.y + H - fh, b.w - 6, fh);
      c.fillStyle = 'rgba(203,213,225,.85)'; c.font = '11px ' + UI.fontFamily; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText('▼ 上滑查看更多', b.x + b.w / 2, b.y + H - 2);
    }
  }
  c.restore();
}
function paintSvg(c, e, b, r) {
  const vb = (e.attrs.viewbox || e.attrs.viewBox || '').split(/[\s,]+/).map(Number);
  const vw = vb[2] || b.w, vh = vb[3] || b.h, sx = b.w / vw, sy = b.h / vh;
  c.save(); if (r > 0) { rr(c, b.x, b.y, b.w, b.h, r); c.clip(); }
  for (const k of e.children) if (k.nodeType === 1 && k.tag === 'rect') { c.fillStyle = hex8(k.attrs.fill || '#000'); c.fillRect(b.x + (+k.attrs.x || 0) * sx, b.y + (+k.attrs.y || 0) * sy, (+k.attrs.width || 0) * sx + .3, (+k.attrs.height || 0) * sy + .3); }
  c.restore();
}

// ---------------- 命中测试与事件 ----------------
function hitIn(e, x, y) {
  if (e.nodeType !== 1 || !e._b) return null;
  const cs = e._cs; if (!cs || cs.display === 'none' || cs.visibility === 'hidden') return null;
  const b = e._b, inside = x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  if (e._clip && !inside) return null;
  const yy = e._scroll ? y + e.scrollTop : y;
  for (let i = e.children.length - 1; i >= 0; i--) { const ch = e.children[i]; if (ch.nodeType !== 1 || ch._posd) continue; const r = hitIn(ch, x, yy); if (r) return r; }
  if (inside && cs.pointerEvents !== 'none') return e;
  return null;
}
function hitTest(x, y) {
  for (let i = UI.posList.length - 1; i >= 0; i--) { const p = UI.posList[i]; if (!p._cs || p._cs.display === 'none') continue; let off = 0; for (let a = p.parent; a; a = a.parent) if (a._scroll) off += a.scrollTop; const r = hitIn(p, x, y + off); if (r) return r; }
  return hitIn(UI.body, x, y);
}
function fire(target, type, ev) {
  ev.target = target; ev.currentTarget = null; let stop = false; ev.stopPropagation = () => { stop = true; }; ev.preventDefault = () => {}; ev.type = type;
  for (const f of (UI.docLs[type] || [])) f.call(UI.document, ev);
  for (let e = target; e && !stop; e = e.parent) {
    if (e.nodeType !== 1) continue; ev.currentTarget = e;
    if (type === 'click' && typeof e.onclick === 'function') e.onclick.call(e, ev);
    for (const f of (e._ls[type] || []).slice()) f.call(e, ev);
  }
  if (!stop) for (const f of (UI.docBubble[type] || [])) f.call(UI.document, ev);
}
function scroller(e) { for (let p = e; p; p = p.parent) if (p._scroll) return p; return null; }
function disabledUp(e) { for (let p = e; p && p.nodeType === 1; p = p.parent) if (p._dis && (p.tag === 'button' || p.tag === 'input')) return true; return false; }

// ---------------- 对外 ----------------
function create(opt) {
  const ui = UI = {
    env: opt, rules: parseCSS(opt.css || ''), fontFamily: opt.fontFamily || 'sans-serif', dpr: opt.dpr || 1, vw: opt.width, vh: opt.height, dirty: true,
    docLs: {}, docBubble: {}, imgs: {}, posQ: [], posList: [], textNudge: opt.textNudge != null ? opt.textNudge : .06,
    mctx: opt.createCanvas().getContext('2d'),
    rootStyle: { color: '#000', fontSize: 16, fontWeight: 400, lh: 20, lhMode: 'mul', lhVal: 1.25, textAlign: 'left', whiteSpace: 'normal', pointerEvents: 'auto' },
  };
  ui.img = src => {
    if (!src) return null; let im = ui.imgs[src];
    if (!im) { im = ui.imgs[src] = opt.loadImage(src, () => { dirty(); }); }
    return im;
  };
  const html = new El('html'), body = new El('body'); body.parent = html; html.children.push(body);
  ui.html = html; ui.body = body;
  body.innerHTML = opt.bodyHTML || '';
  const byId = id => { let f = null; const go = e => { for (const c of e.children) { if (f) return; if (c.nodeType === 1) { if (c.attrs.id === id) { f = c; return; } go(c); } } }; go(html); return f; };
  const document = ui.document = {
    body, documentElement: html,
    getElementById: byId,
    querySelectorAll: s => html.querySelectorAll(s), querySelector: s => html.querySelector(s),
    createElement: tag => tag.toLowerCase() === 'canvas' ? opt.createCanvas() : new El(tag),
    createTextNode: t => new TextNode(t),
    addEventListener: (t, f, o) => { const cap = o === true || (o && o.capture); ((cap ? ui.docLs : ui.docBubble)[t] || ((cap ? ui.docLs : ui.docBubble)[t] = [])).push(f); },
    removeEventListener: () => {},
    get visibilityState() { return 'visible'; }, hidden: false,
  };
  // 样式表里的 html,body 规则作用在 body 上
  // 触摸
  let tch = null, fling = 0, lastPaint = 0;
  ui.touchStart = (x, y) => {
    if (ui.dirty) layoutAll();
    fling = 0;
    const tg = hitTest(x, y);
    tch = { x0: x, y0: y, x, y, t: tg, sc: tg ? scroller(tg) : null, moved: false, vy: 0, lt: Date.now() };
    if (tch.sc) tch.st0 = tch.sc.scrollTop;
    const ev = { clientX: x, clientY: y, pageX: x, pageY: y, pointerType: 'touch', button: 0 };
    fire(tg || body, 'pointerdown', ev);
  };
  ui.touchMove = (x, y) => {
    if (!tch) return; const dy = y - tch.y, now = Date.now();
    if (!tch.moved && Math.hypot(x - tch.x0, y - tch.y0) > 8) tch.moved = true;
    if (tch.moved && tch.sc) { const sc = tch.sc; sc.scrollTop = Math.max(0, Math.min(sc._ch - sc._b.h, sc.scrollTop - dy)); const dt = Math.max(1, now - tch.lt); tch.vy = .7 * tch.vy + .3 * (-dy / dt); }
    tch.x = x; tch.y = y; tch.lt = now;
  };
  ui.touchEnd = (x, y) => {
    if (!tch) return; const t = tch; tch = null;
    if (x == null) { x = t.x; y = t.y; }
    if (t.moved) { if (t.sc && Math.abs(t.vy) > .2) { fling = t.vy; ui.flingEl = t.sc; } return; }
    if (!t.t) return;
    if (ui.dirty) layoutAll();
    // 抬起时仍在同一元素里才算点击
    const tg = hitTest(x, y);
    if (!tg) return;
    let same = false; for (let p = tg; p; p = p.parent) if (p === t.t) { same = true; break; }
    if (!same) { for (let p = t.t; p; p = p.parent) if (p === tg) { same = true; break; } }
    if (!same) return;
    if (disabledUp(t.t)) return;
    fire(t.t, 'click', { clientX: x, clientY: y, pageX: x, pageY: y });
  };
  ui.touchCancel = () => { tch = null; };
  ui.wheel = (x, y, dy) => { const tg = hitTest(x, y), sc = tg && scroller(tg); if (sc) sc.scrollTop = Math.max(0, Math.min(sc._ch - sc._b.h, sc.scrollTop + dy)); };
  ui.paint = (ctx, now) => {
    if (fling && ui.flingEl) { const dt = Math.min(50, now - (lastPaint || now)); const sc = ui.flingEl; sc.scrollTop = Math.max(0, Math.min(sc._ch - sc._b.h, sc.scrollTop + fling * dt)); fling *= Math.pow(.995, dt); if (Math.abs(fling) < .02) fling = 0; }
    lastPaint = now;
    if (ui.dirty) layoutAll();
    ctx.save(); ctx.setTransform(ui.dpr, 0, 0, ui.dpr, 0, 0);
    ctx.clearRect(0, 0, ui.vw, ui.vh);
    const bs = ui.body._cs; ctx.fillStyle = (bs && bs.background) || '#000'; ctx.fillRect(0, 0, ui.vw, ui.vh);
    paintEl(ctx, ui.body, now);
    for (const p of ui.posList) { let off = 0; for (let a = p.parent; a; a = a.parent) if (a._scroll) off += a.scrollTop; if (off) { ctx.save(); ctx.translate(0, -off); paintEl(ctx, p, now); ctx.restore(); } else paintEl(ctx, p, now); }
    ctx.restore();
  };
  ui.resize = (w, h) => { ui.vw = w; ui.vh = h; dirty(); };
  ui.layout = layoutAll;
  ui.hitTest = hitTest;
  // 测试用：找到元素在屏幕上的中心点
  ui.find = sel => { if (ui.dirty) layoutAll(); const e = typeof sel === 'string' ? html.querySelector(sel) : sel; if (!e || !e._b) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, vis: isVis(e) }; };
  ui.findAll = sel => { if (ui.dirty) layoutAll(); return html.querySelectorAll(sel).map(e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, vis: isVis(e), dis: e._dis, el: e }; }); };
  ui.covers = (e, x, y) => { const h = hitTest(x, y); for (let p = h; p; p = p.parent) if (p === e) return true; return false; };
  ui.scrollTo = (e) => { const sc = scroller(e.parent); if (!sc) return; const r = e._b; sc.scrollTop = Math.max(0, Math.min(sc._ch - sc._b.h, r.y - sc._b.y - sc._b.h / 2 + r.h / 2)); };
  return ui;
}
function isVis(e) { for (let p = e; p && p.nodeType === 1; p = p.parent) { if (!p._cs || p._cs.display === 'none') return false; } return !!e._b && e._b.w > 0 && e._b.h > 0; }

G.RuneUI = { create, parseHTML, parseCSS, El };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : globalThis));
