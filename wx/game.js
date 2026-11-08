// 符文塔防 v0.6b · 微信小游戏版（由 tools/build_wx.py 生成，不要手改）
// 符文塔防 · 微信小游戏宿主：屏幕画布、触摸、存储、音频、图片。
// 注意：微信里第一次 wx.createCanvas() 得到的是上屏画布，之后创建的都是离屏画布。
var __HOST = (function () {
  // 新接口 getWindowInfo（基础库 2.20.1+），老版本退回 getSystemInfoSync
  let sys; try { sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(); } catch (e) { sys = wx.getSystemInfoSync(); }
  const screen = wx.createCanvas();
  const W = sys.windowWidth, H = sys.windowHeight, dpr = Math.min(3, sys.pixelRatio || 2);
  screen.width = Math.round(W * dpr); screen.height = Math.round(H * dpr);
  const sctx = screen.getContext('2d');
  let top = (sys.statusBarHeight || 20) + 4;
  try { const m = wx.getMenuButtonBoundingClientRect(); if (m && m.bottom) top = m.bottom + 6; } catch (e) {}
  let bottom = 0;
  try { if (sys.safeArea && sys.screenHeight) bottom = Math.max(0, Math.min(40, sys.screenHeight - sys.safeArea.bottom)); } catch (e) {}
  // 老版本微信画布可能缺 ellipse / setLineDash：补上
  function patch(cv) {
    const g = cv.getContext.bind(cv);
    cv.getContext = function (t) {
      const c = g(t); if (!c || c.__p) return c; c.__p = 1;
      if (typeof c.ellipse !== 'function') c.ellipse = function (x, y, rx, ry, rot, a0, a1, ccw) { this.save(); this.translate(x, y); this.rotate(rot || 0); this.scale(rx || 1e-6, ry || 1e-6); this.arc(0, 0, 1, a0, a1, ccw); this.restore(); };
      if (typeof c.setLineDash !== 'function') c.setLineDash = function () {};
      return c;
    };
    return cv;
  }
  const t0 = Date.now();
  let touchId = null;
  return {
    width: W, height: H, dpr, screenCtx: sctx, insets: { top, bottom },
    fontFamily: 'sans-serif',
    createCanvas: () => patch(wx.createCanvas()),
    Image: function () { return wx.createImage(); },
    loadImage(src, cb) { const im = wx.createImage(); im.onload = cb; im.src = src; return im; },
    pngBase: 'images/', pngKeys: null,
    storage: {
      get(k) { try { const v = wx.getStorageSync(k); return v === '' || v == null ? null : String(v); } catch (e) { return null; } },
      set(k, v) { try { wx.setStorageSync(k, v); } catch (e) {} },
      remove(k) { try { wx.removeStorageSync(k); } catch (e) {} },
      clear() { try { wx.clearStorageSync(); } catch (e) {} },
    },
    rAF: cb => requestAnimationFrame(cb),
    now: () => Date.now() - t0,
    audioCtor: function () { return wx.createWebAudioContext(); },
    bindTouch(ui) {
      const pick = (e, want) => { const l = e.changedTouches || e.touches || []; for (const t of l) if (want == null || t.identifier === want) return t; return null; };
      wx.onTouchStart(e => { if (touchId != null) return; const t = pick(e); if (!t) return; touchId = t.identifier; ui.touchStart(t.clientX, t.clientY); });
      wx.onTouchMove(e => { const t = pick(e, touchId); if (t) ui.touchMove(t.clientX, t.clientY); });
      const end = e => { const t = pick(e, touchId); if (!t) return; touchId = null; ui.touchEnd(t.clientX, t.clientY); };
      wx.onTouchEnd(end); wx.onTouchCancel(() => { touchId = null; ui.touchCancel(); });
    },
  };
})();

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

// 符文塔防 · 运行环境：用迷你 DOM 拼出游戏代码需要的 window / document / localStorage 等全局对象。
// host 由平台提供（微信：wx-host.js；浏览器预览：preview.html），游戏代码本身不用改。
(function (G) {
'use strict';
function RuneEnv(host, css, bodyHTML) {
  const ins = host.insets || { top: 0, bottom: 0 };
  const H = host.height, appH = H - ins.top - ins.bottom;
  // 平台补丁样式：避开顶部胶囊按钮和底部安全区
  const extra = `
body{padding-top:${ins.top}px}
#app{height:${appH}px}
#cv{width:min(100vw,480px,calc((${appH}px - 232px) * 0.6429))}
#panel{padding-top:6px;padding-bottom:6px}
.big{padding:9px}
#panel .tinfo{margin-top:5px}
#panel .row,#panel .row2{margin-top:6px}
#guide{top:${ins.top + 46}px}
#ov,#bp{padding-top:${ins.top + 12}px;padding-bottom:${ins.bottom + 16}px}
`;
  const ui = RuneUI.create({
    css: css + extra, bodyHTML, width: host.width, height: H, dpr: host.dpr,
    createCanvas: host.createCanvas, loadImage: host.loadImage, fontFamily: host.fontFamily || 'sans-serif',
  });
  const store = host.storage;
  const localStorage = {
    getItem: k => store.get(k), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.remove(k),
    clear: () => { if (store.clear) store.clear(); },
  };
  const now = host.now;
  const performance = { now };
  let frameQ = [];
  // 游戏每帧调用一次 requestAnimationFrame；在它的回调之后把界面画到屏幕上
  const requestAnimationFrame = cb => { frameQ.push(cb); if (frameQ.length === 1) host.rAF(tick); return frameQ.length; };
  function tick() {
    const t = now(), q = frameQ; frameQ = [];
    for (const cb of q) { try { cb(t); } catch (e) { console.error(e); } }
    try { ui.paint(host.screenCtx, t); } catch (e) { console.error(e); }
  }
  const window = {
    devicePixelRatio: host.dpr, innerWidth: host.width, innerHeight: H,
    RUNE_PNG: host.pngBase, RUNE_PNG_KEYS: host.pngKeys,
    AudioContext: host.audioCtor || undefined, webkitAudioContext: undefined,
    addEventListener() {}, removeEventListener() {},
    setTimeout: (f, t) => setTimeout(f, t), clearTimeout: id => clearTimeout(id), setInterval: (f, t) => setInterval(f, t), clearInterval: id => clearInterval(id),
    requestAnimationFrame, performance, localStorage, document: ui.document,
    console,
  };
  window.window = window; window.self = window;
  const location = { search: host.search || '', href: '', hostname: 'wx' };
  host.bindTouch(ui);
  return {
    ui, window, document: ui.document, localStorage, Image: host.Image, requestAnimationFrame, performance, location,
    AudioContext: host.audioCtor || undefined, navigator: { userAgent: 'wx-minigame', language: 'zh-CN' },
  };
}
G.RuneEnv = RuneEnv;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : globalThis));

function __BOOT(__HOST){
var __E=RuneEnv(__HOST,"\n*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}\nhtml,body{margin:0;background:#0d1020;color:#e5e7eb;font-family:-apple-system,\"PingFang SC\",\"Noto Sans SC\",\"Microsoft YaHei\",sans-serif;height:100%;overflow:hidden;touch-action:manipulation}\n#app{display:flex;flex-direction:column;align-items:center;height:100vh;height:100dvh}\n#hud{width:100%;max-width:480px;display:flex;gap:5px;justify-content:space-between;align-items:center;padding:8px 8px;font-size:13.5px;font-weight:600}\n.pill{background:#1b2040;padding:5px 8px;border-radius:999px;white-space:nowrap}\n#spd,#runes,#snd{background:#334155;padding:5px 10px;border-radius:999px;font-weight:700;font-size:14px}\n#runes{background:#4c1d95}#snd{padding:5px 8px}\n#cv{display:block;width:min(100vw,480px,calc((100vh - 190px) * 0.6429));width:min(100vw,480px,calc((100dvh - 190px) * 0.6429));aspect-ratio:360/560;border-radius:10px;background:#141a33;touch-action:none}\n#panel{width:100%;max-width:480px;padding:8px 10px;flex:1;min-height:140px;overflow-y:auto}\nbutton{font:inherit;border:0;border-radius:10px;color:#fff;cursor:pointer}\n.big{width:100%;padding:12px;font-size:16px;font-weight:700;background:linear-gradient(#3b82f6,#2563eb)}\n.big.red{background:linear-gradient(#ef4444,#b91c1c)}\n.wv{text-align:center;padding:12px;font-weight:700;color:#fca5a5;background:#1b2040;border-radius:10px}\n.row{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}\n.row2{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}\n.tb{background:#1b2040;padding:8px 2px;font-size:13px;line-height:1.35;border:2px solid #2a3158}\n.tb b{display:block;font-size:20px}\n.tb img{width:36px;height:36px;display:block;margin:0 auto 2px}\n.tb:disabled{opacity:.38}\n.chip{background:#1b2040;border:2px solid #475080;border-radius:999px;padding:6px 12px;font-size:13px;margin:8px 6px 0 0}\n.hint{color:#9aa3c7;font-size:12.5px;margin-top:8px;line-height:1.55}\n.tinfo{margin-top:8px;font-size:13.5px;color:#cbd5e1;line-height:1.5}\n#ov,#bp{position:fixed;inset:0;background:rgba(5,7,15,.88);display:none;flex-direction:column;align-items:center;justify-content:center;padding:16px;z-index:9;text-align:center;overflow-y:auto}\n#bp{z-index:10;justify-content:flex-start}\n#ov{justify-content:flex-start}#ov>:first-child{margin-top:auto}#ov>:last-child{margin-bottom:auto}\n#ov h2,#bp h2{margin:0 0 4px;font-size:20px}\n.sub{color:#9aa3c7;font-size:13px;line-height:1.5}\n.cards{display:flex;flex-direction:column;gap:10px;width:100%;max-width:420px;margin-top:14px}\n.card{background:#1b2040;border:2px solid #475080;border-radius:14px;padding:12px 14px;text-align:left;width:100%}\n.card .n{font-size:17px;font-weight:700}\n.card .d{font-size:14px;color:#c7cbe0;margin-top:4px;line-height:1.5}\n.card .r{float:right;font-size:12px;opacity:.85;margin-top:3px}\n.card.r1{border-color:#8b5cf6}.card.r1 .r{color:#c4b5fd}\n.card.r2{border-color:#f59e0b;box-shadow:0 0 16px rgba(245,158,11,.35)}.card.r2 .r{color:#fcd34d}\n.card.r3{border-color:#22d3ee;box-shadow:0 0 18px rgba(34,211,238,.4)}.card.r3 .r{color:#67e8f9}\n.card.r4{border-color:#f43f5e;box-shadow:0 0 22px rgba(244,63,94,.5)}.card.r4 .r{color:#fda4af}\n.rl.r3{border-color:#22d3ee}.rl.r4{border-color:#f43f5e}\n.sc{display:inline-block;border-radius:6px;padding:0 5px;margin-right:4px;font-size:11.5px;font-weight:700;color:#0d1020;vertical-align:1px}\n.tb.br{text-align:left;padding:8px 10px;font-size:12.5px;line-height:1.45}.tb.br b{font-size:15px;display:inline}\n.card:disabled{opacity:.45}\n.card.node{display:flex;gap:12px;align-items:center}\n.card.node .ic{font-size:30px;width:40px;text-align:center}\n.card.map{display:flex;gap:12px;align-items:center}\n.card.map svg{flex:none;width:54px;height:84px;border-radius:6px}\n.reroll{margin-top:12px;background:#334155;padding:9px 16px;font-size:14px}\n.reroll:disabled{opacity:.4}\n.build{margin-top:10px;font-size:13px;color:#c7cbe0;max-width:420px;line-height:1.6}\n.wrap{width:100%;max-width:420px}\n.sum{background:#1b2040;border-radius:12px;padding:10px 12px;font-size:13.5px;line-height:1.7;margin:8px 0 12px;text-align:left}\n.sum b{color:#86efac}\n.rl{background:#1b2040;border:2px solid #475080;border-radius:12px;padding:10px 12px;margin-bottom:8px;text-align:left}\n.rl.r1{border-color:#8b5cf6}.rl.r2{border-color:#f59e0b}\n.rl .n{font-weight:700;font-size:15px}.rl .d{font-size:13px;color:#c7cbe0;margin-top:2px}\n.rl .lv{font-size:13px;color:#fde68a;margin-top:4px}.rl .off{font-size:12px;color:#94a3b8;margin-top:2px}\n.close{margin:10px auto 0;display:block;background:#2563eb;padding:11px 40px;font-size:15px;font-weight:700}\n.intro img{width:96px;height:96px}\n.tip{background:#1b2040;border-radius:12px;padding:10px 12px;margin-top:12px;font-size:13.5px;line-height:1.6;text-align:left;max-width:380px}\n.einfo{display:flex;gap:10px;align-items:center;margin-top:8px}\n.einfo img{width:52px;height:52px;flex:none}\n.einfo .t{font-size:13px;line-height:1.55;color:#cbd5e1}\n #stage{position:relative}\n#hfloat{position:absolute;display:none;flex-direction:column;pointer-events:none}\n#hfloat button{pointer-events:auto;flex:1;margin:2px;border-radius:12px;background:rgba(15,20,40,.82);border:2px solid #475569;position:relative;padding:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;overflow:hidden}\n#hfloat .ic{font-size:20px}#hfloat .cd{font-size:10.5px;color:#a5f3fc;margin-top:2px;font-weight:700}\n#hfloat button.ready{border-color:#fde047;box-shadow:0 0 10px rgba(253,224,71,.55)}\n#hfloat button:disabled .ic{opacity:.45}\n#hfloat .ha{font-size:11px;font-weight:700;color:#cbd5e1}#hfloat .ha.on{border-color:#22c55e;color:#bbf7d0}\n.hbar{display:flex;gap:6px;align-items:center;margin-bottom:8px}.hbar .hn{font-size:13px;font-weight:700;white-space:nowrap}\n.hs{flex:1;background:#1e293b;border:2px solid #475569;padding:7px 4px;font-size:13px;font-weight:700;line-height:1.2}.hs small{font-weight:400;color:#a5f3fc}.hs:disabled{opacity:.5}\n.hs.ha{flex:none;font-size:12px;padding:7px 8px}.hs.ha.on{border-color:#22c55e;color:#bbf7d0}\n.lsec{text-align:left;font-weight:700;font-size:15px;margin:14px 0 6px}\n.hrow{display:flex;flex-direction:column;gap:8px}.card.hero{padding:10px 12px}.card.hero.on{border-color:#22c55e;box-shadow:0 0 14px rgba(34,197,94,.35)}.card.hero .d{font-size:12.5px}\n.chip.on{border-color:#22c55e;background:#14532d}\n.rl.art{display:flex;align-items:center;gap:10px}.buy{background:#0e7490;padding:8px 12px;font-weight:700;white-space:nowrap}.buy:disabled{opacity:.4}.own{color:#86efac;font-size:13px;white-space:nowrap}\n.card.curse{border-color:#be123c}\n#guide{position:fixed;left:50%;transform:translateX(-50%);top:54px;z-index:40;width:min(92vw,420px);background:#fde68a;color:#1a1528;border-radius:12px;padding:9px 12px;font-weight:700;font-size:14px;line-height:1.45;box-shadow:0 6px 20px rgba(0,0,0,.45);display:none;pointer-events:none}\n#guide button{pointer-events:auto;float:right;margin-left:8px;background:#1a1528;color:#fde68a;border:none;border-radius:8px;padding:3px 8px;font-size:12px}\n.gpulse{animation:gp 1s infinite;outline:3px solid #fde047;outline-offset:1px}@keyframes gp{0%,100%{box-shadow:0 0 0 0 rgba(253,224,71,.9)}50%{box-shadow:0 0 0 8px rgba(253,224,71,0)}}\n.tag{display:inline-block;border-radius:6px;padding:0 6px;margin-right:4px;font-size:12px;font-weight:700;color:#0d1020}\n","\n<div id=\"app\">\n  <div id=\"hud\">\n    <span class=\"pill\" id=\"hW\">第1幕 0/15</span>\n    <span class=\"pill\" id=\"hG\">💰 0</span>\n    <span class=\"pill\" id=\"hL\">❤️ 20</span>\n    <button id=\"runes\">🔮符文</button>\n    <button id=\"spd\">1×</button>\n    <button id=\"snd\">🔊</button>\n  </div>\n  <div id=\"stage\"><canvas id=\"cv\"></canvas><div id=\"hfloat\"></div></div>\n  <div id=\"panel\"></div>\n</div>\n<div id=\"ov\"></div><div id=\"guide\"></div>\n<div id=\"bp\"></div>\n");
(function(window,document,localStorage,Image,requestAnimationFrame,performance,location,AudioContext,webkitAudioContext,navigator,URLSearchParams){
// 自动生成：地图生成器 + 模拟筛选。每张图都和其它图（包括镜像、翻转版本）比较过，路线重合度不超过 50%。
window.RUNE_MAPS=[{"type":"snake","paths":[[[-1,1],[1,1],[1,11],[4,11],[4,1],[7,1],[7,11],[9,11]]],"tiles":{"6,4":"highland","6,2":"highland","3,8":"runewell","4,6":"swamp"},"gateInside":false,"stars":3,"simWin":0.31,"id":"snake-00","place":"晨露坡","hpMul":0.774},{"type":"snake","paths":[[[9,0],[7,0],[7,3],[4,3],[4,0],[1,0],[1,9],[4,9],[4,6],[7,6],[7,12],[1,12],[1,14]]],"tiles":{"3,10":"highland","5,8":"highland","6,5":"runewell","1,9":"swamp","7,9":"swamp"},"gateInside":false,"stars":1,"simWin":0.88,"id":"snake-01","place":"橡木桥","hpMul":0.746},{"type":"snake","paths":[[[0,14],[0,1],[7,1],[7,4],[3,4],[3,14]]],"tiles":{"2,10":"highland","6,3":"highland","4,3":"runewell","6,1":"swamp"},"gateInside":false,"stars":2,"simWin":0.75,"id":"snake-02","place":"云杉坡","hpMul":0.735},{"type":"snake","paths":[[[4,14],[4,11],[1,11],[1,4],[4,4],[4,8],[8,8],[8,0],[1,0],[1,-1]]],"tiles":{"7,1":"highland","7,7":"highland","3,9":"runewell","4,8":"swamp"},"gateInside":false,"stars":3,"simWin":0.44,"id":"snake-03","place":"青铜堡","hpMul":0.737},{"type":"snake","paths":[[[5,-1],[5,1],[1,1],[1,5],[8,5],[8,12],[5,12],[5,9],[-1,9]]],"tiles":{"4,7":"highland","3,11":"highland","3,3":"runewell","8,6":"swamp","5,10":"swamp"},"gateInside":false,"hpMul":0.635,"stars":2,"simWin":0.69,"id":"snake-04","place":"霜叶林"},{"type":"snake","paths":[[[9,6],[7,6],[7,12],[0,12],[0,9],[3,9],[3,6],[0,6],[0,2],[7,2],[7,-1]]],"tiles":{"1,10":"highland","2,5":"highland","6,0":"runewell","1,9":"swamp","1,2":"swamp"},"gateInside":false,"stars":1,"simWin":0.81,"id":"snake-05","place":"烛火巷","hpMul":0.692},{"type":"snake","paths":[[[-1,10],[0,10],[0,7],[4,7],[4,10],[7,10],[7,0],[4,0],[4,4],[0,4],[0,0],[-1,0]]],"tiles":{"3,2":"highland","2,9":"highland","2,5":"runewell","7,5":"swamp","2,4":"swamp"},"gateInside":false,"stars":1,"simWin":0.88,"id":"snake-06","place":"飞瀑崖","hpMul":0.735},{"type":"snake","paths":[[[9,13],[7,13],[7,6],[4,6],[4,13],[0,13],[0,0],[4,0],[4,3],[9,3]]],"tiles":{"5,12":"highland","6,9":"highland","3,12":"runewell","0,11":"swamp"},"gateInside":false,"stars":2,"simWin":0.75,"id":"snake-07","place":"萤火原","hpMul":0.7},{"type":"snake","paths":[[[9,5],[5,5],[5,8],[8,8],[8,11],[1,11],[1,2],[8,2],[8,-1]]],"tiles":{"4,3":"highland","6,4":"highland","4,1":"runewell","3,11":"swamp","2,2":"swamp"},"gateInside":false,"stars":2,"simWin":0.62,"id":"snake-08","place":"龙脊梁","hpMul":0.694},{"type":"snake","paths":[[[9,12],[1,12],[1,6],[8,6],[8,0],[5,0],[5,3],[1,3],[1,-1]]],"tiles":{"3,5":"highland","6,1":"highland","4,7":"runewell","8,5":"swamp","5,2":"swamp"},"gateInside":false,"stars":2,"simWin":0.56,"id":"snake-09","place":"蜂蜜谷","hpMul":0.786},{"type":"twin","paths":[[[3,-1],[3,0],[6,0],[6,6],[0,6],[0,13],[6,13],[6,14]],[[9,10],[3,10],[3,6],[0,6],[0,13],[6,13],[6,14]]],"tiles":{"5,7":"highland","2,11":"highland","5,4":"runewell","0,6":"swamp"},"gateInside":false,"hpMul":0.583,"stars":2,"simWin":0.56,"id":"twin-10","place":"落日坡"},{"type":"twin","paths":[[[4,14],[4,10],[0,10],[0,4],[8,4],[8,1],[0,1],[0,-1]],[[8,14],[8,7],[4,7],[4,4],[8,4],[8,1],[0,1],[0,-1]]],"tiles":{"2,6":"highland","1,2":"highland","6,2":"runewell","3,4":"swamp","7,1":"swamp"},"gateInside":false,"stars":2,"simWin":0.75,"id":"twin-11","place":"晴川渡","hpMul":0.704},{"type":"twin","paths":[[[9,1],[8,1],[8,8],[5,8],[5,1],[1,1],[1,8],[-1,8]],[[-1,11],[5,11],[5,1],[1,1],[1,8],[-1,8]]],"tiles":{"4,7":"highland","3,10":"highland","6,3":"runewell","5,3":"swamp"},"gateInside":false,"hpMul":0.592,"stars":2,"simWin":0.62,"id":"twin-12","place":"青苔谷"},{"type":"twin","paths":[[[9,13],[8,13],[8,10],[4,10],[4,1],[8,1],[8,7],[9,7]],[[-1,13],[1,13],[1,4],[4,4],[4,1],[8,1],[8,7],[9,7]]],"tiles":{"2,3":"highland","2,5":"highland","5,8":"runewell","4,3":"swamp"},"gateInside":false,"hpMul":0.524,"stars":2,"simWin":0.75,"id":"twin-13","place":"狐狸窝"},{"type":"twin","paths":[[[-1,1],[0,1],[0,7],[3,7],[3,10],[6,10],[6,13],[0,13],[0,10],[-1,10]],[[9,4],[3,4],[3,10],[6,10],[6,13],[0,13],[0,10],[-1,10]]],"tiles":{"1,9":"highland","2,3":"highland","5,9":"runewell","6,10":"swamp"},"gateInside":false,"hpMul":0.62,"stars":2,"simWin":0.56,"id":"twin-14","place":"冰川口"},{"type":"twin","paths":[[[4,14],[4,13],[7,13],[7,10],[4,10],[4,6],[7,6],[7,3],[4,3],[4,0],[7,0],[7,-1]],[[-1,13],[1,13],[1,6],[7,6],[7,3],[4,3],[4,0],[7,0],[7,-1]]],"tiles":{"6,12":"highland","5,9":"highland","3,8":"runewell","5,6":"swamp"},"gateInside":false,"hpMul":0.484,"stars":2,"simWin":0.75,"id":"twin-15","place":"回音洞"},{"type":"twin","paths":[[[8,-1],[8,1],[4,1],[4,4],[1,4],[1,11],[9,11]],[[9,8],[8,8],[8,4],[1,4],[1,11],[9,11]]],"tiles":{"3,9":"highland","6,0":"highland","3,2":"runewell","1,5":"swamp","2,11":"swamp"},"gateInside":false,"hpMul":0.456,"stars":2,"simWin":0.62,"id":"twin-16","place":"琥珀湖"},{"type":"twin","paths":[[[3,-1],[3,0],[7,0],[7,6],[3,6],[3,13],[7,13],[7,10],[9,10]],[[-1,10],[0,10],[0,3],[3,3],[3,13],[7,13],[7,10],[9,10]]],"tiles":{"4,8":"highland","6,5":"highland","1,4":"runewell","4,6":"swamp"},"gateInside":false,"hpMul":0.549,"stars":2,"simWin":0.69,"id":"twin-17","place":"铃兰坡"},{"type":"twin","paths":[[[9,3],[7,3],[7,6],[0,6],[0,0],[7,0],[7,-1]],[[-1,13],[0,13],[0,10],[3,10],[3,6],[0,6],[0,0],[7,0],[7,-1]]],"tiles":{"1,4":"highland","1,9":"highland","2,1":"runewell","0,5":"swamp"},"gateInside":false,"hpMul":0.553,"stars":2,"simWin":0.56,"id":"twin-18","place":"落樱道"},{"type":"twin","paths":[[[9,1],[4,1],[4,5],[1,5],[1,13],[9,13]],[[9,9],[7,9],[7,5],[1,5],[1,13],[9,13]]],"tiles":{"8,6":"highland","5,6":"highland","2,7":"runewell","1,7":"swamp","4,13":"swamp"},"gateInside":false,"hpMul":0.426,"stars":2,"simWin":0.62,"id":"twin-19","place":"金穗田"},{"type":"triple","paths":[[[6,14],[6,13],[3,13],[3,7],[6,7],[6,1],[3,1],[3,4],[-1,4]],[[9,10],[3,10],[3,7],[6,7],[6,1],[3,1],[3,4],[-1,4]],[[-1,7],[0,7],[0,10],[3,10],[3,7],[6,7],[6,1],[3,1],[3,4],[-1,4]]],"tiles":{"1,2":"highland","5,8":"highland","2,6":"runewell","6,6":"swamp","3,2":"swamp"},"gateInside":false,"hpMul":0.513,"stars":2,"simWin":0.62,"id":"triple-20","place":"柳絮堤"},{"type":"triple","paths":[[[9,13],[1,13],[1,0],[9,0]],[[9,10],[4,10],[4,3],[1,3],[1,0],[9,0]],[[9,6],[8,6],[8,3],[1,3],[1,0],[9,0]]],"tiles":{"3,8":"highland","3,11":"highland","5,2":"runewell","1,7":"swamp","4,0":"swamp"},"gateInside":false,"hpMul":0.546,"stars":2,"simWin":0.5,"id":"triple-21","place":"蘑菇林"},{"type":"triple","paths":[[[0,14],[0,5],[7,5],[7,8],[3,8],[3,14]],[[0,-1],[0,5],[7,5],[7,8],[3,8],[3,14]],[[3,-1],[3,2],[7,2],[7,8],[3,8],[3,14]]],"tiles":{"2,7":"highland","4,7":"highland","4,4":"runewell","6,5":"swamp"},"gateInside":false,"hpMul":0.521,"stars":2,"simWin":0.75,"id":"triple-22","place":"芦花荡"},{"type":"triple","paths":[[[-1,11],[0,11],[0,8],[8,8],[8,5],[-1,5]],[[4,14],[4,11],[8,11],[8,5],[-1,5]],[[0,-1],[0,1],[8,1],[8,5],[-1,5]]],"tiles":{"4,6":"highland","2,7":"highland","3,3":"runewell","8,7":"swamp"},"gateInside":false,"hpMul":0.456,"stars":2,"simWin":0.62,"id":"triple-23","place":"海雾岬"},{"type":"triple","paths":[[[0,14],[0,7],[6,7],[6,11],[3,11],[3,14]],[[9,1],[6,1],[6,4],[3,4],[3,7],[6,7],[6,11],[3,11],[3,14]],[[3,-1],[3,1],[0,1],[0,4],[3,4],[3,7],[6,7],[6,11],[3,11],[3,14]]],"tiles":{"1,9":"highland","5,8":"highland","1,12":"runewell","5,7":"swamp","5,11":"swamp"},"gateInside":false,"hpMul":0.429,"stars":2,"simWin":0.75,"id":"triple-24","place":"赤枫渡"},{"type":"triple","paths":[[[9,2],[6,2],[6,6],[3,6],[3,9],[6,9],[6,12],[0,12],[0,14]],[[-1,2],[3,2],[3,9],[6,9],[6,12],[0,12],[0,14]],[[-1,9],[0,9],[0,6],[3,6],[3,9],[6,9],[6,12],[0,12],[0,14]]],"tiles":{"4,11":"highland","7,3":"highland","1,9":"runewell","3,9":"swamp"},"gateInside":false,"hpMul":0.488,"stars":3,"simWin":0.44,"id":"triple-25","place":"鹿鸣谷"},{"type":"triple","paths":[[[-1,1],[1,1],[1,5],[5,5],[5,12],[1,12],[1,8],[-1,8]],[[5,-1],[5,12],[1,12],[1,8],[-1,8]],[[8,-1],[8,5],[5,5],[5,12],[1,12],[1,8],[-1,8]]],"tiles":{"4,4":"highland","4,7":"highland","3,1":"runewell","5,8":"swamp"},"gateInside":false,"hpMul":0.404,"stars":2,"simWin":0.69,"id":"triple-26","place":"松涛峡"},{"type":"triple","paths":[[[-1,7],[1,7],[1,4],[7,4],[7,1],[1,1],[1,-1]],[[9,10],[7,10],[7,7],[4,7],[4,4],[7,4],[7,1],[1,1],[1,-1]],[[-1,10],[4,10],[4,4],[7,4],[7,1],[1,1],[1,-1]]],"tiles":{"6,9":"highland","3,3":"highland","5,2":"runewell","7,4":"swamp"},"gateInside":false,"hpMul":0.64,"stars":3,"simWin":0.31,"id":"triple-27","place":"雾隐沼"},{"type":"triple","paths":[[[9,10],[3,10],[3,13],[0,13],[0,4],[-1,4]],[[9,4],[6,4],[6,7],[3,7],[3,13],[0,13],[0,4],[-1,4]],[[-1,0],[3,0],[3,13],[0,13],[0,4],[-1,4]]],"tiles":{"1,7":"highland","2,5":"highland","4,8":"runewell","2,13":"swamp"},"gateInside":false,"hpMul":0.513,"stars":2,"simWin":0.62,"id":"triple-28","place":"野莓林"},{"type":"triple","paths":[[[-1,2],[0,2],[0,5],[3,5],[3,8],[0,8],[0,11],[3,11],[3,14]],[[9,11],[6,11],[6,5],[3,5],[3,8],[0,8],[0,11],[3,11],[3,14]],[[9,2],[3,2],[3,8],[0,8],[0,11],[3,11],[3,14]]],"tiles":{"4,10":"highland","1,9":"highland","0,6":"runewell","3,8":"swamp","2,11":"swamp"},"gateInside":false,"hpMul":0.486,"stars":2,"simWin":0.75,"id":"triple-29","place":"星坠丘"},{"type":"fork","paths":[[[9,13],[4,13],[4,10],[0,10],[0,6],[4,6],[4,3],[8,3],[8,10],[9,10]],[[9,13],[4,13],[4,10],[0,10],[0,3],[8,3],[8,10],[9,10]]],"tiles":{"2,7":"highland","3,12":"highland","2,9":"runewell","3,6":"swamp","7,3":"swamp"},"gateInside":false,"hpMul":0.597,"stars":2,"simWin":0.5,"id":"fork-30","place":"寒鸦渡"},{"type":"fork","paths":[[[-1,9],[0,9],[0,12],[6,12],[6,6],[0,6],[0,3],[6,3],[6,0],[9,0]],[[-1,9],[0,9],[0,12],[6,12],[6,9],[3,9],[3,6],[0,6],[0,3],[6,3],[6,0],[9,0]]],"tiles":{"2,4":"highland","1,8":"highland","6,5":"runewell","2,6":"swamp"},"gateInside":false,"stars":1,"simWin":0.88,"id":"fork-31","place":"雪松林","hpMul":0.608},{"type":"fork","paths":[[[-1,1],[8,1],[8,5],[4,5],[4,12],[1,12],[1,5],[-1,5]],[[-1,1],[8,1],[8,9],[4,9],[4,12],[1,12],[1,5],[-1,5]]],"tiles":{"5,11":"highland","6,2":"highland","3,8":"runewell","4,5":"swamp"},"gateInside":false,"stars":3,"simWin":0.44,"id":"fork-32","place":"玉带河","hpMul":0.729},{"type":"fork","paths":[[[4,-1],[4,1],[7,1],[7,5],[4,5],[4,11],[0,11],[0,1],[-1,1]],[[4,-1],[4,1],[7,1],[7,11],[0,11],[0,1],[-1,1]]],"tiles":{"3,12":"highland","6,3":"highland","6,8":"runewell","4,8":"swamp"},"gateInside":false,"hpMul":0.464,"stars":2,"simWin":0.75,"id":"fork-33","place":"银杏道"},{"type":"fork","paths":[[[9,9],[6,9],[6,5],[3,5],[3,2],[0,2],[0,9],[3,9],[3,12],[9,12]],[[9,9],[6,9],[6,2],[0,2],[0,9],[3,9],[3,12],[9,12]]],"tiles":{"4,4":"highland","4,7":"highland","3,1":"runewell","0,2":"swamp"},"gateInside":false,"hpMul":0.566,"stars":2,"simWin":0.56,"id":"fork-34","place":"苍狼岗"},{"type":"fork","paths":[[[-1,7],[1,7],[1,13],[5,13],[5,7],[8,7],[8,4],[5,4],[5,1],[1,1],[1,-1]],[[-1,7],[1,7],[1,13],[5,13],[5,7],[8,7],[8,1],[1,1],[1,-1]]],"tiles":{"7,9":"highland","3,12":"highland","3,10":"runewell","5,9":"swamp","5,1":"swamp"},"gateInside":false,"hpMul":0.561,"stars":2,"simWin":0.75,"id":"fork-35","place":"黄沙驿"},{"type":"fork","paths":[[[9,0],[0,0],[0,8],[3,8],[3,11],[6,11],[6,4],[9,4]],[[9,0],[0,0],[0,11],[6,11],[6,4],[9,4]]],"tiles":{"4,12":"highland","1,7":"highland","3,1":"runewell","0,8":"swamp","6,7":"swamp"},"gateInside":false,"hpMul":0.597,"stars":2,"simWin":0.69,"id":"fork-36","place":"磨坊村"},{"type":"fork","paths":[[[3,14],[3,10],[0,10],[0,4],[7,4],[7,0],[-1,0]],[[3,14],[3,10],[0,10],[0,7],[3,7],[3,4],[7,4],[7,0],[-1,0]]],"tiles":{"4,2":"highland","5,5":"highland","2,5":"runewell","4,4":"swamp","6,0":"swamp"},"gateInside":false,"hpMul":0.594,"stars":3,"simWin":0.44,"id":"fork-37","place":"碧泉村"},{"type":"fork","paths":[[[9,5],[6,5],[6,9],[3,9],[3,13],[0,13],[0,2],[3,2],[3,-1]],[[9,5],[6,5],[6,13],[0,13],[0,2],[3,2],[3,-1]]],"tiles":{"5,7":"highland","7,8":"highland","5,10":"runewell","2,13":"swamp","0,4":"swamp"},"gateInside":false,"hpMul":0.501,"stars":2,"simWin":0.75,"id":"fork-38","place":"古井镇"},{"type":"fork","paths":[[[6,-1],[6,0],[0,0],[0,3],[6,3],[6,13],[0,13],[0,10],[-1,10]],[[6,-1],[6,0],[0,0],[0,3],[6,3],[6,10],[3,10],[3,13],[0,13],[0,10],[-1,10]]],"tiles":{"4,1":"highland","5,4":"highland","1,11":"runewell","6,4":"swamp"},"gateInside":false,"hpMul":0.535,"stars":1,"simWin":0.81,"id":"fork-39","place":"枫红谷"},{"type":"citadel","paths":[[[-1,0],[8,0],[8,3],[5,3],[5,7],[8,7],[8,13],[5,13],[5,10]]],"tiles":{"7,1":"highland","6,9":"highland","5,2":"runewell","5,6":"swamp"},"gateInside":true,"hpMul":0.62,"stars":2,"simWin":0.62,"id":"citadel-40","place":"铁杉岭"},{"type":"citadel","paths":[[[8,14],[8,13],[5,13],[5,10],[1,10],[1,7],[8,7],[8,1],[5,1],[5,4]]],"tiles":{"3,12":"highland","7,4":"highland","2,8":"runewell","5,7":"swamp","8,2":"swamp"},"gateInside":true,"hpMul":0.684,"stars":2,"simWin":0.69,"id":"citadel-41","place":"灰烬原"},{"type":"citadel","paths":[[[9,5],[8,5],[8,2],[5,2],[5,5],[1,5],[1,13],[8,13],[8,9],[5,9]]],"tiles":{"4,3":"highland","2,11":"highland","4,6":"runewell","1,8":"swamp","8,11":"swamp"},"gateInside":true,"hpMul":0.503,"stars":1,"simWin":0.94,"id":"citadel-42","place":"断桥渡"},{"type":"citadel","paths":[[[4,14],[4,13],[1,13],[1,10],[4,10],[4,7],[8,7],[8,1],[1,1],[1,4],[4,4]]],"tiles":{"7,2":"highland","7,5":"highland","2,11":"runewell","8,7":"swamp","1,2":"swamp"},"gateInside":true,"hpMul":0.598,"stars":2,"simWin":0.56,"id":"citadel-43","place":"鸢尾坡"},{"type":"citadel","paths":[[[3,-1],[3,1],[0,1],[0,4],[3,4],[3,7],[6,7],[6,13],[0,13],[0,10],[3,10]]],"tiles":{"4,11":"highland","1,3":"highland","2,12":"runewell","6,10":"swamp","0,12":"swamp"},"gateInside":true,"hpMul":0.568,"stars":1,"simWin":0.88,"id":"citadel-44","place":"碎岩滩"},{"type":"citadel","paths":[[[9,1],[4,1],[4,4],[7,4],[7,10],[4,10],[4,13],[1,13],[1,7],[4,7]]],"tiles":{"3,5":"highland","6,5":"highland","3,12":"runewell","6,10":"swamp"},"gateInside":true,"stars":2,"simWin":0.62,"id":"citadel-45","place":"赤土关","hpMul":0.573},{"type":"citadel","paths":[[[5,14],[5,13],[8,13],[8,6],[5,6],[5,10],[1,10],[1,3],[5,3]]],"tiles":{"7,11":"highland","4,8":"highland","5,4":"runewell","4,10":"swamp"},"gateInside":true,"hpMul":0.732,"stars":3,"simWin":0.44,"id":"citadel-46","place":"白石滩"},{"type":"citadel","paths":[[[7,-1],[7,5],[1,5],[1,12],[7,12],[7,8],[4,8]]],"tiles":{"2,11":"highland","5,3":"highland","4,6":"runewell","1,10":"swamp"},"gateInside":true,"hpMul":0.684,"stars":2,"simWin":0.5,"id":"citadel-47","place":"紫藤园"},{"type":"citadel","paths":[[[4,14],[4,12],[1,12],[1,9],[8,9],[8,0],[1,0],[1,3],[4,3]]],"tiles":{"5,10":"highland","2,13":"highland","7,6":"runewell","8,7":"swamp","1,0":"swamp"},"gateInside":true,"hpMul":0.563,"stars":1,"simWin":0.81,"id":"citadel-48","place":"熔岩口"},{"type":"citadel","paths":[[[3,-1],[3,1],[7,1],[7,12],[3,12],[3,8],[0,8],[0,5],[3,5]]],"tiles":{"1,10":"highland","8,6":"highland","3,6":"runewell","7,11":"swamp"},"gateInside":true,"hpMul":0.64,"stars":3,"simWin":0.44,"id":"citadel-49","place":"渔火湾"}];

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

var RuneMusic=window.RuneMusic;

"use strict";
const COLS=9,ROWS=14,CS=40,W=COLS*CS,H=ROWS*CS,MAXS=15,VERSION='v0.6b';
const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
const DPR=Math.min(3,window.devicePixelRatio||1);
cv.width=W*DPR;cv.height=H*DPR;ctx.scale(DPR,DPR);
const panel=document.getElementById('panel'),ov=document.getElementById('ov'),bp=document.getElementById('bp');
const $=id=>document.getElementById(id);
const pick=a=>a[Math.floor(Math.random()*a.length)];

// ======================= 地图 =======================
const TILEINFO={
  highland:{name:'高地',desc:'建在这里的塔射程 +1 格。',build:true},
  runewell:{name:'符文井',desc:'周围 8 格里的塔伤害 +20%（多口井可以叠加）。这一格本身不能建塔。',build:false},
  swamp:{name:'沼泽',desc:'铺在路上，经过的敌人移动速度 -30%。',build:false},
  ice:{name:'冰面',desc:'雪原的路面结冰：敌人在冰面上移动速度 +30%。可以在上面铺沼泽抵消。',build:false},
  lava:{name:'岩浆',desc:'火山的岩浆池：不能建塔。',build:false},
};
const TCARDS=['highland','runewell','swamp'];   // 能当地形卡获得的
// 地图主题：每局随机，选地图时就能看到。元素克制作用于对应塔造成的伤害（含燃烧、爆炸）
const BIOMES={
  grass:{name:'草原',icon:'🌿',col:'#86efac',mul:{},hp:1,desc:'标准地形，没有克制。',bg:'#407432'},
  snow:{name:'雪原',icon:'❄️',col:'#bae6fd',mul:{frost:.7,cannon:1.3},slow:.8,hp:1,desc:'敌人抗冰（冰塔伤害 -30%、减速效果打八折），怕火（炮塔与燃烧伤害 +30%）。路面有冰面，敌人走得更快。',bg:'#c9d8ea'},
  volcano:{name:'火山',icon:'🌋',col:'#fdba74',mul:{cannon:.7,frost:1.3},hp:.9,desc:'敌人抗火（炮塔与燃烧伤害 -30%），怕冰（冰塔伤害 +30%）。路边有岩浆池，那些格子不能建塔。',bg:'#40353d'},
};
let BIOME='grass',BIO=BIOMES.grass;
// 用地图 id 做种子的随机数，保证同一张图同一主题的冰面/岩浆位置固定（缩略图和实际一致）
function seededRand(str){let h=2166136261;for(const ch of str){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return((h>>>0)%100000)/100000;};}
function pathCells(m){const out=[];for(const wp of m.paths){const seq=[];for(let k=0;k<wp.length-1;k++){const [c1,r1]=wp[k],[c2,r2]=wp[k+1],dc=Math.sign(c2-c1),dr=Math.sign(r2-r1);let c=c1,r=r1;while(true){if(c>=0&&c<COLS&&r>=0&&r<ROWS&&!(seq.length&&seq[seq.length-1]===c+','+r))seq.push(c+','+r);if(c===c2&&r===r2)break;c+=dc;r+=dr;}}out.push(seq);}return out;}
function biomeTiles(m,biome){
  const t={};if(biome==='grass')return t;
  const rnd=seededRand((m.id||'tut')+biome),seqs=pathCells(m),ps=new Set(seqs.flat());
  if(biome==='snow'){const off=Math.floor(rnd()*6);for(const seq of seqs)seq.forEach((k,i)=>{if(i>1&&i<seq.length-2&&(i+off)%9<3&&!m.tiles[k])t[k]='ice';});}
  if(biome==='volcano'){const cand=[];for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const k=c+','+r;if(ps.has(k)||m.tiles[k])continue;let a=0;for(let dc=-1;dc<=1;dc++)for(let dr=-1;dr<=1;dr++)if(ps.has((c+dc)+','+(r+dr)))a++;if(a)cand.push([k,a+rnd()*3]);}
    cand.sort((x,y)=>y[1]-x[1]);const pool=cand.slice(0,Math.min(cand.length,18));for(let n=0;n<5&&pool.length;n++)t[pool.splice(Math.floor(rnd()*pool.length),1)[0][0]]='lava';}
  return t;
}
function rollBiomes(n){const d=FEAT.meta?(META.diff||0):0,w=d<=2?{grass:.5,snow:.25,volcano:.25}:d<=6?{grass:.34,snow:.33,volcano:.33}:{grass:.2,snow:.4,volcano:.4};
  const out=[];let left={...w};for(let i=0;i<n;i++){const ks=Object.keys(left);if(!ks.length)left={...w};const kk=Object.keys(left);let x=Math.random()*kk.reduce((a,k)=>a+left[k],0),pickK=kk[0];for(const k of kk){x-=left[k];if(x<=0){pickK=k;break;}}out.push(pickK);delete left[pickK];}return out;}
const MAPTYPES={
  tutorial:{name:'新手长廊',desc:'一条很长的弯路，敌人从一个入口进来。最适合第一次玩。'},
  snake  :{name:'蜿蜒小径',desc:'一条长路弯弯绕绕，敌人只有一个入口。'},
  twin   :{name:'双路汇流',desc:'两个入口同时来敌，在半路汇合成一条路。'},
  triple :{name:'三路汇流',desc:'三个入口同时来敌，考验兵力怎么分配。'},
  fork   :{name:'岔路',desc:'路在中途分成两支，每个敌人随机走一边，再在后面汇合。'},
  citadel:{name:'围城',desc:'城门在地图中间，敌人一路绕进来攻城。'},
};
const TUTORIAL={id:'tutorial',type:'tutorial',place:'',stars:1,
  paths:[[[-1,1],[7,1],[7,4],[1,4],[1,7],[7,7],[7,10],[1,10],[1,12],[9,12]]],
  tiles:{'4,2':'highland','4,8':'highland','4,5':'runewell','4,7':'swamp','5,12':'swamp'}};
const POOL=(typeof window!=='undefined'&&window.RUNE_MAPS)||[];
const MAPS=[TUTORIAL,...POOL];
const mapTitle=m=>m.type==='tutorial'?'新手长廊':`${MAPTYPES[m.type].name} · ${m.place}`;
let mapBiomesCur=null,MAP,MAPI=0,PATHS=[],pathSet=new Set(),tiles={};
function setupMap(i,biome){heroSpot=null;
  MAPI=i;MAP=MAPS[i];BIOME=BIOMES[biome]?biome:'grass';BIO=BIOMES[BIOME];pathSet=new Set();tiles={...MAP.tiles,...biomeTiles(MAP,BIOME)};
  PATHS=MAP.paths.map(wp=>{
    for(let k=0;k<wp.length-1;k++){
      const [c1,r1]=wp[k],[c2,r2]=wp[k+1],dc=Math.sign(c2-c1),dr=Math.sign(r2-r1);let c=c1,r=r1;
      while(true){if(c>=0&&c<COLS&&r>=0&&r<ROWS)pathSet.add(c+','+r);if(c===c2&&r===r2)break;c+=dc;r+=dr;}
    }
    const PP=wp.map(([c,r])=>({x:(c+.5)*CS,y:(r+.5)*CS}));const seg=[];let tot=0;
    for(let k=0;k<PP.length-1;k++){const l=Math.hypot(PP[k+1].x-PP[k].x,PP[k+1].y-PP[k].y);seg.push(l);tot+=l;}
    return{PP,seg,tot};
  });
}
function posAt(pi,d){
  const P=PATHS[pi];
  for(let k=0;k<P.seg.length;k++){
    if(d<=P.seg[k]){const t=d/P.seg[k];return{x:P.PP[k].x+(P.PP[k+1].x-P.PP[k].x)*t,y:P.PP[k].y+(P.PP[k+1].y-P.PP[k].y)*t};}
    d-=P.seg[k];
  }
  const e=P.PP[P.PP.length-1];return{x:e.x,y:e.y};
}
const clampPt=p=>({x:Math.max(8,Math.min(W-8,p.x)),y:Math.max(8,Math.min(H-8,p.y))});
function mapSVG(m,biome){
  const bt=biomeTiles(m,biome||'grass'),B=BIOMES[biome||'grass'];
  const s=new Set();
  for(const wp of m.paths)for(let k=0;k<wp.length-1;k++){const [c1,r1]=wp[k],[c2,r2]=wp[k+1],dc=Math.sign(c2-c1),dr=Math.sign(r2-r1);let c=c1,r=r1;while(true){if(c>=0&&c<COLS&&r>=0&&r<ROWS)s.add(c+','+r);if(c===c2&&r===r2)break;c+=dc;r+=dr;}}
  let h='';
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const k=c+','+r,t=m.tiles[k]||bt[k];h+=`<rect x="${c*6}" y="${r*6}" width="6" height="6" fill="${t==='highland'?'#86c46a':t==='runewell'?'#818cf8':t==='swamp'?'#4a5a3a':t==='ice'?'#7cc0ea':t==='lava'?'#f97316':s.has(k)?(biome==='snow'?'#a3b2c5':biome==='volcano'?'#8a7a70':'#b59c7a'):B.bg}"/>`;}
  return `<svg viewBox="0 0 54 84" xmlns="http://www.w3.org/2000/svg">${h}</svg>`;
}

// ======================= 美术 =======================
const SPR={};let BG=null;
const SPRW={};let stopT=0;
const TOPY=(window.RuneArt&&window.RuneArt.TOP_Y)||22;
// 塔的炮头位置：返回旋转中心和沿炮管方向 len（相对塔尺寸）处的点
function towerSize(t){return CS*(1.22+.05*(t.lvl-1));}
function towerPivot(t){const s=towerSize(t);return{x:t.x,y:t.y+CS*.5-s*.95+s*TOPY/64,s};}
function towerTip(t,len){const p=towerPivot(t),a=t.ang||0;return[p.x+Math.sin(a)*p.s*len,p.y-Math.cos(a)*p.s*len];}
const ARTKEYS=['arrow','cannon','frost','tesla','norm','fast','tank','split','mini','boss1','boss2','boss3'];
const TILEKEYS=['highland','runewell','swamp','grass0','grass1','path'];
function raster(svgStr,px){return new Promise(res=>{if(typeof Image==='undefined'){res(null);return;}const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=c.height=px;c.getContext('2d').drawImage(im,0,0,px,px);res(c);};im.onerror=()=>res(null);im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgStr.replace('<svg ','<svg width="'+px+'" height="'+px+'" '));});}
// 所有要预先栅格化的贴图：[键名, 生成 SVG 的函数, 像素尺寸]。微信版用 tools/build_wx.py 把它们提前烤成 PNG
const ENEMYK=['norm','fast','tank','split','mini','boss1','boss2','boss3'];
function artJobs(){
  const A=window.RuneArt,px=Math.max(96,Math.ceil(72*DPR)),J=[];if(!A)return J;
  for(const k of ARTKEYS)J.push([k,()=>A[k](),px]);
  if(A.arrowBase)for(const k of ['arrow','cannon','frost','tesla'])for(const p of ['Base','Top'])J.push([k+p,()=>A[k+p](),px]);
  J.push(['grass0',()=>A.grass(0),128],['grass1',()=>A.grass(1),128],['path',()=>A.path(),128],['highland',()=>A.highland(),128],['runewell',()=>A.runewell(),128],['swamp',()=>A.swamp(),128]);
  if(A.snow){J.push(['snow0',()=>A.snow(0),128],['snow1',()=>A.snow(1),128],['snowroad',()=>A.snowroad(),128],['ice',()=>A.ice(),128],
      ['basalt0',()=>A.basalt(0),128],['basalt1',()=>A.basalt(1),128],['ashroad',()=>A.ashroad(),128],['lava',()=>A.lava(),128]);
    for(const b of ['snow','volcano']){J.push(['highland_'+b,()=>A.highland(BIOMES[b].bg),128],['runewell_'+b,()=>A.runewell(BIOMES[b].bg),128]);
      for(const k of ENEMYK)J.push([k+'_'+b,()=>A.tint(A[k](),b),px]);}}
  return J;
}
function loadPNG(k){return new Promise(res=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>res(null);im.src=window.RUNE_PNG+k+'.png';});}
async function loadArt(){
  if(window.RUNE_PNG){await Promise.all(window.RUNE_PNG_KEYS.map(async k=>{SPR[k]=await loadPNG(k);}));}
  else{if(!window.RuneArt)return;await Promise.all(artJobs().map(async([k,f,px])=>{SPR[k]=await raster(f(),px);}));}
  for(const k of ENEMYK){const sp=SPR[k];if(!sp)continue;const c=document.createElement('canvas');c.width=sp.width;c.height=sp.height;const x=c.getContext('2d');x.drawImage(sp,0,0);x.globalCompositeOperation='source-in';x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);SPRW[k]=c;}
  buildBG();
}
function buildBG(){
  if(typeof document.createElement!=='function'||!MAP)return;
  const b=document.createElement('canvas');if(!b.getContext)return;b.width=W*DPR;b.height=H*DPR;const bx=b.getContext('2d');bx.scale(DPR,DPR);
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const k=c+','+r,onPath=pathSet.has(k),t=tiles[k];
    const G=BIOME==='snow'?['snow0','snow1','snowroad']:BIOME==='volcano'?['basalt0','basalt1','ashroad']:['grass0','grass1','path'];
    const base=onPath?SPR[G[2]]:((c+r)%2?SPR[G[1]]:SPR[G[0]]);
    if(base)bx.drawImage(base,c*CS,r*CS,CS,CS);else{bx.fillStyle=onPath?'#a08866':'#3f6b34';bx.fillRect(c*CS,r*CS,CS,CS);}
    if(t){
      const tk=(t==='highland'||t==='runewell')&&BIOME!=='grass'?t+'_'+BIOME:t;if(SPR[tk])bx.drawImage(SPR[tk],c*CS,r*CS,CS,CS);
      else{bx.fillStyle=t==='highland'?'#86c46a':t==='runewell'?'#818cf8':'#4a5a3a';bx.fillRect(c*CS+3,r*CS+3,CS-6,CS-6);}
    }
  }
  BG=b;
}
const ARTURL={};
function artURL(k){if(window.RUNE_PNG)return window.RUNE_PNG+k+'.png';if(!window.RuneArt)return'';if(ARTURL[k])return ARTURL[k];const A=window.RuneArt,f=A[k];if(!f)return'';return ARTURL[k]='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(f());}

// ======================= 数据 =======================
const TT={
  arrow :{name:'箭塔',ch:'弓',cost:50 ,dmg:9 ,rate:.55,range:2.6,color:'#4ade80',tip:'快速单体'},
  cannon:{name:'炮塔',ch:'炮',cost:80 ,dmg:24,rate:1.5,range:2.4,color:'#fb923c',tip:'范围爆炸'},
  frost :{name:'冰塔',ch:'冰',cost:60 ,dmg:3 ,rate:1.0,range:2.0,color:'#60a5fa',tip:'范围减速、显形'},
  tesla :{name:'电塔',ch:'电',cost:100,dmg:17,rate:1.2,range:2.3,color:'#c084fc',tip:'连锁闪电、破盾'},
};
const ET={
  norm :{hp:32 ,spd:1.15,r:9 ,col:'#f87171',gold:5  ,armor:0,dmg:1},
  fast :{hp:20 ,spd:2.0 ,r:7 ,col:'#fbbf24',gold:4  ,armor:0,dmg:1},
  tank :{hp:110,spd:.72 ,r:12,col:'#94a3b8',gold:10 ,armor:4,dmg:2},
  split:{hp:55 ,spd:1.0 ,r:11,col:'#34d399',gold:6  ,armor:0,dmg:1},
  mini :{hp:16 ,spd:1.5 ,r:6 ,col:'#6ee7b7',gold:2  ,armor:0,dmg:1},
  boss1:{hp:550,spd:.5 ,r:17,col:'#e879f9',gold:100,armor:3,dmg:0},
  boss2:{hp:350,spd:.48,r:17,col:'#a5b4fc',gold:150,armor:5,dmg:0},
  boss3:{hp:700,spd:.45,r:18,col:'#ef4444',gold:200,armor:7,dmg:0},
};
// 数值曲线（v0.2a）：前期更有压力，Boss 降血量、靠机制
// 敌人血量：按幕分段增长（v0.2c：前松后紧）
const HPBASE=3.25,HPG=[1.2,1.33,1.62];
const hpScale=s=>{let v=HPBASE;for(let k=2;k<=s;k++)v*=HPG[Math.min(3,Math.ceil(k/5))-1];return v;};
const EINFO={
  norm :{name:'史莱姆',desc:'最普通的敌人，血量和速度都一般。',tip:'点击场上任何敌人、地块，都能查看它的信息。'},
  fast :{name:'风灵',desc:'速度很快、血量少，容易冲过防线。',tip:'用冰塔减速，或者用攻速快的箭塔拦截。'},
  tank :{name:'石甲兽',desc:'血厚、带护甲：每次受到的伤害先减去护甲值（最少保留 25%）。',tip:'单发伤害越高越好，比如炮塔、升级后的塔。很多次小伤害会被护甲吃掉。'},
  split:{name:'双生史莱姆',desc:'被击败后分裂成两只小史莱姆。',tip:'炮塔的爆炸、电塔的连锁能一次打中分裂出来的小怪。'},
  mini :{name:'小史莱姆',desc:'双生史莱姆或巢母生出来的，血少、跑得快。',tip:'范围伤害最有效。'},
  boss1:{name:'巢母',desc:'第一幕 Boss。每掉 25% 生命，就生出一群小史莱姆。漏过城门时按剩余生命扣命：剩一半血扣 12 条，剩八成以上直接破城。',tip:'炮塔、电塔清小怪，高伤害的塔集中打 Boss。'},
  boss2:{name:'棱镜守卫',desc:'第二幕 Boss。每 7 秒，对上一阶段伤害最高的那种塔完全免疫。头顶显示当前免疫哪种塔。',tip:'只靠一种塔会被克制，至少准备两种主力塔。'},
  boss3:{name:'暴君',desc:'最终 Boss。生命低于一半后狂暴加速，并且每 6 秒让附近一座塔停工 3 秒。',tip:'冰塔减速对付狂暴；塔分散摆放，别全挤在一处。'},
};
const AFX={
  shield :{name:'护盾',col:'#60a5fa',desc:'多一层护盾（40% 最大生命），先挡伤害。',tip:'电塔对护盾造成双倍伤害。'},
  regen  :{name:'再生',col:'#4ade80',desc:'1.5 秒没受伤就快速回血。',tip:'火力别断；炮塔的燃烧会阻止它回血。'},
  stealth:{name:'隐身',col:'#a5b4fc',desc:'塔无法锁定它，除非它在冰塔的范围内（显形）。',tip:'在路边放冰塔；炮塔的爆炸也能炸到隐身的敌人。'},
  armored:{name:'钢甲',col:'#cbd5e1',desc:'护甲大幅提高。',tip:'用单发高伤害的塔：炮塔、高等级的塔、暴击。'},
  undying:{name:'不灭',col:'#fde68a',desc:'被击败后复活一次（40% 生命）。',tip:'在它燃烧时击败它，就不会复活。'},
  leader :{name:'领袖',col:'#f87171',desc:'周围 2 格内的其他敌人移动速度 +25%。',tip:'优先集火它，冰塔能抵消加速。'},
  swift  :{name:'迅捷',col:'#fbbf24',desc:'移动速度 +50%。',tip:'冰塔减速，或在它经过的路上铺沼泽。'},
};
const AFX_ACT1=['shield','armored','swift','regen'],AFX_ALL=Object.keys(AFX);
const NODES={
  normal:{name:'普通战斗',icon:'⚔️',desc:'普通敌人。奖励：过关金币 + 符文三选一。',combat:true},
  elite :{name:'精英战斗',icon:'🔥',desc:'会出现带词缀的精英怪，风险更大。奖励：过关金币 +50%，并在「稀有以上的符文」和「地形卡」之间二选一。',combat:true},
  boss  :{name:'Boss 战',icon:'👑',desc:'',combat:true},
};
const RAR=['普通','稀有','史诗','合体','传说'];
const SC={wind:{name:'风',col:'#4ade80'},fire:{name:'火',col:'#fb923c'},ice:{name:'冰',col:'#60a5fa'},thunder:{name:'雷',col:'#c084fc'},gold:{name:'金',col:'#fbbf24'}};
const TAG2S={arrow:'wind',cannon:'fire',frost:'ice',tesla:'thunder'};
const CARDS=[
 {id:'a1',tag:'arrow',r:0,name:'锋利箭头',desc:'箭塔伤害 +35%',ap:()=>M.arrowDmg+=.35},
 {id:'a2',tag:'arrow',r:0,name:'急速上弦',desc:'箭塔攻速 +30%',ap:()=>M.arrowRate+=.3},
 {id:'a3',tag:'arrow',r:1,max:2,name:'多重射击',desc:'箭塔每次多射 1 支箭打另一个目标，多出来的箭造成 70% 伤害（连弩分支不叠加）',ap:()=>M.arrowMulti++},
 {id:'c1',tag:'cannon',r:0,name:'高爆火药',desc:'炮塔伤害 +40%',ap:()=>M.cannonDmg+=.4},
 {id:'c2',tag:'cannon',r:0,max:3,name:'冲击波',desc:'炮塔爆炸范围 +40%',ap:()=>M.cannonSplash+=.4},
 {id:'c3',tag:'cannon',r:1,max:3,name:'燃烧弹',desc:'炮击点燃敌人，每秒 6×塔等级 真实伤害，持续 2 秒；燃烧中的敌人不能再生、不能复活',ap:()=>M.burn+=6},
 {id:'f1',tag:'frost',r:0,max:2,name:'极寒',desc:'冰塔减速效果 +15%，冰塔伤害 +50%',ap:()=>{M.frostSlow+=.15;M.frostDmg=(M.frostDmg||1)+.5;}},
 {id:'f2',tag:'frost',r:1,max:2,name:'冰封',desc:'冰塔有 20% 几率冻结敌人 1 秒',ap:()=>M.freeze+=.2},
 {id:'f3',tag:'frost',r:1,max:2,name:'碎冰',desc:'被减速/冻结的敌人受到所有伤害 +30%',ap:()=>M.shatter+=.3},
 {id:'t1',tag:'tesla',r:0,max:3,name:'电弧延伸',desc:'电塔连锁目标 +2',ap:()=>M.chain+=2},
 {id:'t2',tag:'tesla',r:0,name:'高压',desc:'电塔伤害 +35%',ap:()=>M.teslaDmg+=.35},
 {id:'t3',tag:'tesla',r:1,max:2,name:'过载',desc:'电塔每次跳跃 18% 几率造成 3 倍伤害',ap:()=>M.overload+=.18},
 {id:'g1',r:0,name:'意外之财',desc:'立即获得 120 金币',ap:()=>{gold+=120}},
 {id:'g2',r:1,max:1,name:'复利',desc:'每场战斗结束获得持有金币 10% 的利息（上限 60）',ap:()=>M.interest+=.1},
 {id:'g3',r:0,max:2,name:'赏金猎人',desc:'每次击杀额外 +1 金币',ap:()=>M.killGold++},
 {id:'g4',r:1,max:2,name:'工程学',desc:'建造和升级费用 -15%',ap:()=>M.costMul-=.15},
 {id:'x1',r:0,max:2,name:'鹰眼',desc:'所有塔射程 +20%',ap:()=>M.rangeMul+=.2},
 {id:'x2',r:1,max:3,name:'致命一击',desc:'所有伤害 12% 几率暴击（×2.5）',ap:()=>M.crit+=.12},
 {id:'x3',r:0,name:'城墙加固',desc:'生命 +6',ap:()=>{lives+=6}},
 {id:'x4',r:2,max:2,name:'狂热',desc:'所有塔攻速 +30%',ap:()=>M.allRate+=.3},
 {id:'s1',r:2,max:1,name:'处决',desc:'非 Boss 敌人生命低于 20% 时直接击杀',ap:()=>{M.execute=.2}},
 {id:'s2',r:2,max:1,name:'元素共鸣',desc:'场上每有一种不同的塔，所有伤害 +8%',ap:()=>{M.resonance=.08}},
 // ---- v0.2b 新增：改规则的符文 ----
 {id:'w1',tag:'arrow',r:1,max:1,name:'穿云',desc:'箭矢命中后，再穿透打中附近 1 个敌人（60% 伤害）',ap:()=>{M.pierce=1}},
 {id:'w3',tag:'arrow',r:0,max:1,name:'疾风',desc:'箭塔攻速 +15%；对快速的敌人（风灵、小史莱姆、迅捷精英等）伤害再 +60%',ap:()=>{M.gale=1;M.arrowRate+=.15}},
 {id:'w4',tag:'arrow',r:0,max:1,name:'猎手',desc:'箭塔对精英和 Boss 伤害 +40%',ap:()=>{M.hunter=1}},
 {id:'c4',tag:'cannon',r:1,max:1,name:'余烬',desc:'炮击会点燃敌人（每秒 3×塔等级）；燃烧中的敌人被击败时爆炸，点燃周围敌人并造成其最大生命 15% 的伤害（Boss 3%）',ap:()=>{M.ember=1;M.burn+=3}},
 {id:'c5',tag:'cannon',r:0,max:1,name:'助燃',desc:'炮击会点燃敌人（每秒 3×塔等级），燃烧多持续 1 秒；炮塔对燃烧中的敌人伤害 +20%',ap:()=>{M.kindle=1;M.burnPlus=1;M.burn+=3}},
 {id:'f4',tag:'frost',r:0,max:1,name:'寒潮',desc:'冰塔攻速 +40%、射程 +1 格；减速多持续 1 秒',ap:()=>{M.coldWave=1}},
 {id:'f5',tag:'frost',r:1,max:1,name:'冰甲碎裂',desc:'被冰塔命中的敌人护甲 -4、受到的所有伤害 +10%，持续 3 秒',ap:()=>{M.shredRune=1}},
 {id:'t4',tag:'tesla',r:1,max:1,name:'导体',desc:'电塔连锁 +1；闪电打到被减速或冻结的敌人时，伤害翻倍',ap:()=>{M.conductor=1;M.chain+=1}},
 {id:'t5',tag:'tesla',r:0,max:1,name:'静电场',desc:'被闪电打中的敌人，4 秒内受到的所有伤害 +15%',ap:()=>{M.staticF=1}},
 {id:'g5',r:1,max:1,name:'战利品',desc:'精英和 Boss 被击败时，掉落的金币翻倍',ap:()=>{M.loot=1}},
 {id:'g6',r:1,max:1,name:'贪婪之眼',desc:'每持有 100 金，所有伤害 +5%（最多 +40%）',ap:()=>{M.greed=1}},
 {id:'g7',r:0,max:1,name:'回收',desc:'立即获得 60 金；出售塔返还 100% 的花费（原来是 70%）',ap:()=>{M.recycle=1;gold+=60}},
 {id:'x5',r:1,max:1,name:'连珠',desc:'每座塔每第 5 次攻击必定暴击',ap:()=>{M.fifth=1}},
 {id:'x6',r:2,max:1,name:'不稳定核心',desc:'所有塔攻速 +50%；但每场战斗结束有 50% 几率让随机一座塔降 1 级',ap:()=>{M.unstable=1}},
 {id:'x7',r:1,max:1,name:'时停沙漏',desc:'每场战斗第一次有敌人漏过城门时，全场敌人冻结 3 秒',ap:()=>{M.hourglass=1}},
 {id:'x8',r:1,max:1,name:'共振石',desc:'周围 8 格里每有一座同种塔，这座塔伤害 +12%',ap:()=>{M.resonStone=1}},
];
CARDS.forEach(c=>{c.school=c.tag?TAG2S[c.tag]:(c.id[0]==='g'?'gold':null);});
// 合体：两个流派各持有 2 个符文后解锁
const COMBOS=[
 {id:'C_firearrow',a:'wind',b:'fire',name:'火矢',desc:'箭矢会点燃敌人（每秒 4×塔等级，持续 2 秒）'},
 {id:'C_icearrow',a:'wind',b:'ice',name:'冰锥箭',desc:'箭矢让敌人减速 25%；射中冻结的敌人必定暴击'},
 {id:'C_thunderarrow',a:'wind',b:'thunder',name:'雷霆箭',desc:'每座箭塔每第 4 次攻击，额外放出一道连锁 3 个目标的闪电'},
 {id:'C_steam',a:'fire',b:'ice',name:'蒸汽爆炸',desc:'同时燃烧又被减速/冻结的敌人立即爆炸，对周围造成其最大生命 12% 的伤害（Boss 3%；同一个敌人 3 秒一次）'},
 {id:'C_plasma',a:'fire',b:'thunder',name:'等离子',desc:'炮弹爆炸时放出闪电，连锁 2 个目标（炮塔伤害的 50%）'},
 {id:'C_supercond',a:'ice',b:'thunder',name:'超导',desc:'电塔的连锁不再衰减；闪电对被减速/冻结的敌人伤害 +50%'},
 {id:'C_moltengold',a:'fire',b:'gold',name:'熔金',desc:'在燃烧中被击败的敌人，掉落双倍金币'},
 {id:'C_harvest',a:'thunder',b:'gold',name:'电磁收割',desc:'每持有 100 金，电塔连锁 +1（最多 +3）'},
];
COMBOS.forEach(c=>{c.r=3;c.max=1;c.ap=()=>{};});
// 传说：只在 Boss 宝箱出现，让满级塔进化
const LEGENDS=[
 {id:'L_arrow',tag:'arrow',name:'风之心',desc:'满级（4 级）箭塔进化为「神射手」：每支箭再波及目标周围 2 个敌人（50% 伤害），暴击率 +20%'},
 {id:'L_cannon',tag:'cannon',name:'火之心',desc:'满级炮塔进化为「火山」：爆炸处留下 2.5 秒熔岩，每秒造成炮塔伤害 40% 的真实伤害'},
 {id:'L_frost',tag:'frost',name:'冰之心',desc:'满级冰塔进化为「永冻」：脉冲必定冻结敌人 0.8 秒（Boss 0.3 秒；同一个敌人每 3 秒最多冻一次），伤害 ×1.6'},
 {id:'L_tesla',tag:'tesla',name:'雷之心',desc:'满级电塔进化为「雷神」：每次攻击多放一道闪电链（60% 伤害），连锁 +2'},
];
LEGENDS.forEach(c=>{c.r=4;c.max=1;c.school=TAG2S[c.tag];c.ap=()=>{};});
const ALLCARDS=[...CARDS,...COMBOS,...LEGENDS];
const findCard=id=>ALLCARDS.find(c=>c.id===id);
const EVO={arrow:'神射手',cannon:'火山',frost:'永冻',tesla:'雷神'};
// 塔分支：3 级时二选一
const BRANCH={
  arrow:[['sniper','狙击','射程 +1.8 格、伤害 ×2.4、无视护甲，优先打血最多的敌人；攻速减半'],['repeater','连弩','每次射 3 支箭（可打 3 个目标），每支 60% 伤害']],
  cannon:[['mortar','迫击炮','射程 +2.5 格、伤害 ×1.5、爆炸范围 +30%；攻速变慢'],['cluster','集束弹','爆炸后再散出 4 颗子炸弹，各造成 35% 伤害']],
  frost:[['glacier','冰川','减速再 +25%（最高 85%）、冻结几率 +15%、射程 +0.4 格'],['nova','寒霜新星','脉冲伤害 ×2，并让敌人护甲 -3（持续 3 秒）']],
  tesla:[['coil','特斯拉线圈','连锁 +3 个目标，每跳伤害几乎不衰减'],['storm','风暴','除了普通攻击，每 3 秒在全图随机劈中 3 个敌人（伤害 ×1.8）']],
};
const BR={};for(const k in BRANCH)for(const [id,name,desc] of BRANCH[k])BR[id]={name,desc,ch:{sniper:'狙',repeater:'弩',mortar:'迫',cluster:'束',glacier:'川',nova:'星',coil:'线',storm:'暴'}[id]};
function schoolCount(sc){let n=0;for(const id in taken){const c=findCard(id);if(c&&c.r!==3&&c.school===sc)n+=taken[id];}return n;}
const comboReady=cb=>!has(cb.id)&&schoolCount(cb.a)>=2&&schoolCount(cb.b)>=2;
const scTag=k=>k?`<span class="sc" style="background:${SC[k].col}">${SC[k].name}</span>`:'';
const pc=v=>Math.round((v-1)*100);
const LIVE={
  a1:()=>`当前箭塔伤害 +${pc(M.arrowDmg)}%`,a2:()=>`当前箭塔攻速 +${pc(M.arrowRate)}%`,a3:()=>`箭塔每次射 ${M.arrowMulti} 个目标`,
  c1:()=>`当前炮塔伤害 +${pc(M.cannonDmg)}%`,c2:()=>`爆炸半径 ${(0.9*M.cannonSplash).toFixed(1)} 格`,c3:()=>`燃烧每秒 ${M.burn}×塔等级 伤害`,
  f1:()=>`当前减速 ${Math.round(Math.min(.8,M.frostSlow)*100)}%`,f2:()=>`冻结几率 ${Math.round(M.freeze*100)}%`,f3:()=>`被控敌人受到伤害 +${Math.round(M.shatter*100)}%`,
  t1:()=>`电塔连锁 ${M.chain} 个目标`,t2:()=>`当前电塔伤害 +${pc(M.teslaDmg)}%`,t3:()=>`${Math.round(M.overload*100)}% 几率造成 3 倍伤害`,
  g1:n=>`已到账 ${120*n} 金`,g2:()=>`按现在的金币，下场战斗结束利息 +${interestNow()} 金`,g3:()=>`本局已多赚 ${stats.bounty} 金`,
  g4:()=>`当前费用 -${Math.round((1-M.costMul)*100)}%`,x1:()=>`当前射程 +${pc(M.rangeMul)}%`,x2:()=>`当前暴击率 ${Math.round(M.crit*100)}%`,
  x3:n=>`已增加 ${6*n} 条命`,x4:()=>`当前攻速 +${pc(M.allRate)}%`,s1:()=>`本局已处决 ${stats.exec} 个敌人`,
  s2:()=>{const k=new Set(towers.map(t=>t.type)).size;return `场上 ${k} 种塔，伤害 +${Math.round(M.resonance*k*100)}%`;},
  g6:()=>`当前伤害 +${Math.min(40,Math.floor(gold/100)*5)}%`,
  x6:()=>'每场战斗结束有一半几率让一座塔降级，注意留钱补升级',
  x8:()=>{const best=Math.max(0,...towers.map(sameNear));return `当前最多的一座塔 +${best*12}%`;},
  C_harvest:()=>`当前电塔连锁 +${Math.min(3,Math.floor(gold/100))}`,
  L_arrow:()=>`场上已进化 ${towers.filter(t=>t.type==='arrow'&&t.lvl>=4).length} 座`,
  L_cannon:()=>`场上已进化 ${towers.filter(t=>t.type==='cannon'&&t.lvl>=4).length} 座`,
  L_frost:()=>`场上已进化 ${towers.filter(t=>t.type==='frost'&&t.lvl>=4).length} 座`,
  L_tesla:()=>`场上已进化 ${towers.filter(t=>t.type==='tesla'&&t.lvl>=4).length} 座`,
};

// ======================= v0.3：大厅 / 英雄 / 诅咒 / 难度 =======================
// 三个模块各有开关：网址加 ?off=meta,hero,curse 可以单独关闭（也方便出问题时直接关掉重发）
const FEAT={meta:true,hero:true,curse:true,fx2:true};
try{const q=new URLSearchParams(location.search).get('off');if(q)q.split(',').forEach(k=>{if(k in FEAT)FEAT[k]=false;});}catch(e){}
// 局外存档
const META_DEF={shards:0,owned:{},hero:'wind',diff:0,unlockedDiff:0,runs:0,wins:0,auto:true};
let META=JSON.parse(JSON.stringify(META_DEF));
try{const m=JSON.parse(localStorage.getItem('td_meta')||'null');if(m&&typeof m==='object'&&!Array.isArray(m))META=Object.assign(META,m);}catch(e){}
function saveMeta(){try{localStorage.setItem('td_meta',JSON.stringify(META));}catch(e){}}
const owns=id=>!FEAT.meta||!!META.owned[id];
// 工匠与可解锁内容（以解锁新玩法为主，属性加成有上限）
const ARTISANS=[
 {id:'smith',name:'符文匠',icon:'🔮',desc:'把新的符文加入奖励池。',items:[
   {id:'pk_gold',name:'金之道',cost:30,desc:'解锁符文：战利品、贪婪之眼、回收',cards:['g5','g6','g7']},
   {id:'pk_art',name:'秘法',cost:40,desc:'解锁符文：处决、元素共鸣',cards:['s1','s2']},
   {id:'pk_odd',name:'奇物',cost:45,desc:'解锁符文：连珠、不稳定核心、时停沙漏、共振石',cards:['x5','x6','x7','x8']},
 ]},
 {id:'arch',name:'建筑师',icon:'🏗️',desc:'开局的小加成。',items:[
   {id:'gold1',name:'储备金 I',cost:25,desc:'开局金币 +15'},
   {id:'gold2',name:'储备金 II',cost:45,desc:'开局金币再 +15',req:'gold1'},
   {id:'gold3',name:'储备金 III',cost:70,desc:'开局金币再 +15',req:'gold2'},
   {id:'land',name:'地形学',cost:40,desc:'开局带一张「高地」地形卡'},
   {id:'salv',name:'回收站',cost:35,desc:'出售塔返还 70% → 80%'},
 ]},
 {id:'hall',name:'英雄殿',icon:'⚔️',desc:'招募新的英雄。',items:[
   {id:'h_fire',name:'熔岩领主',cost:60,desc:'炮塔流英雄：陨石、焦土'},
   {id:'h_ice',name:'霜语者',cost:80,desc:'控制流英雄：冰封、寒冰壁垒'},
 ]},
 {id:'astro',name:'占星师',icon:'🌙',desc:'和命运做交易。',items:[
   {id:'altar',name:'诅咒祭坛',cost:40,desc:'击败第 1、2 个 Boss 后出现祭坛：接受一个诅咒，换取强力奖励'},
   {id:'fate',name:'命运之线',cost:50,desc:'祭坛多给一笔交易可选',req:'altar'},
 ]},
];
const LOCKED_CARDS={};ARTISANS[0].items.forEach(it=>it.cards.forEach(c=>LOCKED_CARDS[c]=it.id));
const cardUnlocked=c=>!LOCKED_CARDS[c.id]||owns(LOCKED_CARDS[c.id]);
// 英雄：1 个被动 + 2 个技能。技能不用瞄准，自动打敌人最密集的地方；可开「自动释放」
const HEROES={
 wind:{name:'风行者',icon:'🏹',col:'#4ade80',unlock:null,passive:'箭塔攻速 +10%',
   sk:[{name:'箭雨',icon:'🏹',cd:30,desc:'敌人最密集处落下 3 秒箭雨（半径 1.5 格）'},{name:'疾风号令',icon:'💨',cd:45,desc:'所有塔攻速 +30%，持续 5 秒'}]},
 fire:{name:'熔岩领主',icon:'🌋',col:'#fb923c',unlock:'h_fire',passive:'炮塔伤害 +10%',
   sk:[{name:'陨石',icon:'☄️',cd:35,desc:'1 秒后砸中敌人最密集处（半径 1.6 格），造成重击并点燃'},{name:'焦土',icon:'🔥',cd:50,desc:'点燃场上所有敌人 4 秒'}]},
 ice:{name:'霜语者',icon:'❄️',col:'#60a5fa',unlock:'h_ice',passive:'冰塔减速 +10%',
   sk:[{name:'冰封',icon:'🧊',cd:40,desc:'冻结场上所有敌人 2.5 秒（Boss 0.8 秒）'},{name:'寒冰壁垒',icon:'🛡️',cd:70,desc:'8 秒内漏过城门的敌人不扣命（Boss 除外）'}]},
};
const heroOK=k=>HEROES[k]&&(!HEROES[k].unlock||owns(HEROES[k].unlock));
// 难度阶：逐级叠加
const DIFFS=['','敌人血量 +10%','精英战多 1 个精英','开局金币 -30','敌人移速 +8%','Boss 血量 +25%','普通战斗也会出现 1 个精英','击败 Boss 只回复 2 条命','敌人血量再 +15%','精英多 1 个词缀','暴君血量 +50%'];
let DIFF=0;const D=n=>DIFF>=n;
// 诅咒交易：诅咒持续到本局结束
const CURSES={
 rush  :{name:'狂潮',desc:'敌人移速 +12%',boon:'传说符文三选一'},
 tax   :{name:'重税',desc:'每站过关金币 -50%',boon:'立刻获得 250 金'},
 armor :{name:'坚甲',desc:'所有敌人护甲 +8',boon:'场上所有未满级的塔升 1 级'},
 blood :{name:'血契',desc:'立刻失去 10 条命',boon:'史诗符文三选一，再来一次稀有以上符文三选一'},
 elites:{name:'精英潮',desc:'之后每场普通战斗多 2 个精英',boon:'稀有以上符文三选一'},
 brittle:{name:'脆城',desc:'之后击败 Boss 不再回复生命，敌人血量 +10%',boon:'所有塔伤害 +15%'},
 pricey:{name:'奢靡',desc:'建塔、升级费用 +15%',boon:'所有塔射程 +15%，并获得 150 金'},
};

// ======================= 状态 =======================
let M={},gold=0,lives=20,step=0,phase='map',curNode=null,towers=[],enemies=[],projs=[],fx=[],texts=[],queue=[],spawnT=0,speed=1,sel=null,taken={},grid={},stats={kills:0,leaked:0,bounty:0,exec:0,eliteWins:0,bossWins:0},rerollCost=25;
let paused=false,introQ=[],bpOpen=false,banner=null,parts=[],shake=0,tcards,placing=null,spawnCount=0,pendingCards=[],pendingNodes=[],afterPick=null,cardTitle=['',''],eliteSub='',lavas=[],hourglassUsed=false,comboSeen=new Set();
let seen=new Set();try{seen=new Set(JSON.parse(localStorage.getItem('td_seen')||'[]'));}catch(e){}
const actOf=s=>Math.min(3,Math.ceil(Math.max(1,s)/5));
function resetRun(mapIdx,biome){
  setupMap(mapIdx,biome);buildBG();
  M={arrowDmg:1,arrowRate:1,arrowMulti:1,cannonDmg:1,cannonSplash:1,burn:0,frostSlow:.4,freeze:0,shatter:0,chain:3,teslaDmg:1,overload:0,interest:0,killGold:0,costMul:1,rangeMul:1,crit:0,allRate:1,execute:0,resonance:0,pierce:0,gale:0,hunter:0,ember:0,kindle:0,burnPlus:0,coldWave:0,shredRune:0,conductor:0,staticF:0,loot:0,greed:0,recycle:0,fifth:0,unstable:0,hourglass:0,resonStone:0,allDmg:1};
  DIFF=FEAT.meta?Math.min(META.diff||0,META.unlockedDiff||0):0;curses={};
  gold=170;lives=20;step=0;phase='node';curNode=null;towers=[];enemies=[];projs=[];fx=[];texts=[];parts=[];decals=[];sched=[];queue=[];spawnT=0;sel=null;taken={};grid={};
  stats={kills:0,leaked:0,bounty:0,exec:0,eliteWins:0,bossWins:0};paused=false;introQ=[];tcards={highland:0,runewell:0,swamp:0};placing=null;spawnCount=0;lavas=[];comboSeen=new Set();
  if(FEAT.meta){for(const k of ['gold1','gold2','gold3'])if(META.owned[k])gold+=15;if(META.owned.land)tcards.highland++;}
  if(D(3))gold-=30;
  heroInit();
  runStage='new';if(!loading){GUIDE=0;if(firstRunPending&&!seen.has('guide'))guideStart();firstRunPending=false;}
  if(BIOME!=='grass')banner={a:BIO.icon+' '+BIO.name,b:BIO.desc.split('。')[0],boss:false,t:3,T:3};
  renderPanel();
  offerCards('选择开局符文','之后每场战斗结束都能三选一，围绕你的塔叠出流派',0,offerNodes);
}

// ======================= 敌人 =======================
function spawn(type,d,pi,elite){
  const b=ET[type],isBoss=type.startsWith('boss');
  let hp=b.hp*hpScale(step)*(MAP.hpMul||1)*diffHpMul()*(BIO.hp||1)*(curseOn('brittle')?1.1:1);if(elite)hp*=2.2;
  if(isBoss&&D(5))hp*=1.25;if(type==='boss3'&&D(10))hp*=1.5;
  let armor=(b.armor?b.armor+step*.5:0)+(curseOn('armor')?8:0);
  if(pi===undefined)pi=PATHS.length>1?(MAP.type==='fork'?(Math.random()<.5?0:1):(spawnCount++%PATHS.length)):0;
  const p=posAt(pi,d||0);
  const e={type,spr:type,boss:isBoss,elite:!!elite,afx:{},dir:1,hp,max:hp,spd:b.spd,r:b.r*(elite?1.25:1),col:b.col,gold:b.gold*(elite?3:1),armor,dmg:b.dmg,d:d||0,pi,x:p.x,y:p.y,
    slowT:0,slowA:0,frzT:0,burnT:0,burnD:0,hitT:9,shield:0,dead:false,lead:false,revealed:true};
  if(elite)for(const a of elite){e.afx[a]=true;}
  if(e.afx.shield)e.shield=e.max*.4;
  if(e.afx.armored)e.armor+=8+step*.6;
  if(e.afx.swift)e.spd*=1.5;
  if(D(4))e.spd*=1.08;if(curseOn('rush'))e.spd*=1.12;
  if(type==='boss1')e.nextSplit=.75;
  if(type==='boss2'){e.cycT=7;e.dmgSrc={};const cnt={};for(const t of towers)cnt[t.type]=(cnt[t.type]||0)+1;e.immune=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0]||'arrow';}
  if(type==='boss3'){e.stunT=6;e.enraged=false;}
  enemies.push(e);
  const keys=[type,...Object.keys(e.afx).map(a=>'afx_'+a)];
  for(const k of keys)if(!seen.has(k)&&!introQ.includes(k))introQ.push(k);
  return e;
}
function buildWave(s,kind){
  const q=[],act=actOf(s);let n=7+Math.floor(s*2);
  if(kind==='boss')n=Math.floor(n*.6);if(kind==='elite')n=Math.floor(n*.7);
  for(let i=0;i<n;i++){
    let t='norm';const r=Math.random();
    if(s>=2&&r<.25)t='fast';else if(s>=4&&r<.42)t='tank';else if(s>=6&&r<.58)t='split';
    q.push({t,gap:t==='fast'?.35:.65});
  }
  if(kind==='normal'&&(s===3||s===8||s===13))for(let i=0;i<10;i++)q.push({t:'fast',gap:.18});
  let ne=kind==='elite'?act+(D(2)?1:0):kind==='normal'?(D(6)?1:0)+(curseOn('elites')?2:0):0;
  for(let k=0;k<ne;k++){
    const base=pick(s>=6?['norm','tank','fast','split']:['norm','tank','fast']);
    const pool=[...(act===1?AFX_ACT1:AFX_ALL)],af=[];
    for(let j=0;j<(act===1?1:2)+(D(9)?1:0)&&pool.length;j++)af.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
    q.splice(Math.floor((k+1)*q.length/(ne+1)),0,{t:base,elite:af,gap:1});
  }
  if(kind==='boss')q.push({t:'boss'+act,gap:1.5});
  return q;
}

// ======================= 塔 =======================
const costOf=type=>Math.round(TT[type].cost*M.costMul);
const upCost=t=>Math.round(TT[t.type].cost*.8*t.lvl*M.costMul);
const sellRate=()=>M.recycle?1:(FEAT.meta&&META.owned.salv)?.8:.7;
function resonanceMul(){if(!M.resonance)return 1;return 1+M.resonance*new Set(towers.map(t=>t.type)).size;}
function wellsNear(c,r){let n=0;for(let dc=-1;dc<=1;dc++)for(let dr=-1;dr<=1;dr++)if((dc||dr)&&tiles[(c+dc)+','+(r+dr)]==='runewell')n++;return n;}
function sameNear(t){let n=0;for(const o of towers)if(o!==t&&o.type===t.type&&Math.abs(o.c-t.c)<=1&&Math.abs(o.r-t.r)<=1)n++;return n;}
const has=id=>(taken[id]||0)>0;
const evolved=t=>t.lvl>=4&&has('L_'+t.type);
function stat(t){
  const b=TT[t.type],L=t.lvl-1,br=t.branch;
  let dmg=b.dmg*Math.pow(1.65,L)*resonanceMul()*(1+.2*wellsNear(t.c,t.r)),rate=b.rate*Math.pow(.9,L)/M.allRate,range=(b.range+.25*L)*M.rangeMul*CS;
  if(M.unstable)rate/=1.5;
  if(M.resonStone)dmg*=1+.12*sameNear(t);
  if(tiles[t.c+','+t.r]==='highland')range+=CS;
  if(t.type==='arrow'){dmg*=M.arrowDmg;rate/=M.arrowRate;}
  if(t.type==='cannon')dmg*=M.cannonDmg;
  if(t.type==='tesla')dmg*=M.teslaDmg;
  if(t.type==='frost'){if(M.coldWave){rate/=1.4;range+=CS;}dmg*=M.frostDmg||1;}
  if(br==='sniper'){range+=1.8*CS;dmg*=2.4;rate*=2;}
  if(br==='repeater'){dmg*=.6;rate*=.9;}
  if(br==='mortar'){range+=2.5*CS;dmg*=1.5;rate*=1.35;}
  if(br==='glacier')range+=.4*CS;
  if(br==='nova')dmg*=2;
  if(t.type==='frost'&&evolved(t))dmg*=1.6;
  dmg*=M.allDmg;if(HERO&&HERO.hasteT>0)rate/=1.3;
  return{dmg,rate,range};
}
function hit(e,dmg,src,o){
  o=o||{};if(e.dead)return;
  let crit=!!o.crit;
  if(!crit&&!o.noCrit){const cc=M.crit+(src==='arrow'&&o.evo?.2:0);if(cc&&Math.random()<cc)crit=true;}
  if(crit)dmg*=2.5;
  if(src&&BIO.mul[src])dmg*=BIO.mul[src];
  const ctrl=e.slowT>0||e.frzT>0;
  if(M.shatter&&ctrl)dmg*=1+M.shatter;
  if(e.markT>0)dmg*=1.15;
  if(M.shredRune&&e.shredT>0)dmg*=1.1;
  if(M.greed)dmg*=1+Math.min(.4,Math.floor(gold/100)*.05);
  if(src==='cannon'&&M.kindle&&e.burnT>0)dmg*=1.2;
  if(src==='arrow'&&M.hunter&&(e.elite||e.boss))dmg*=1.4;
  if(src==='arrow'&&M.gale&&(e.spd>=1.6))dmg*=1.6;
  if(src==='tesla'&&ctrl){if(M.conductor)dmg*=2;if(has('C_supercond'))dmg*=1.5;}
  if(e.type==='boss2'&&src){e.dmgSrc[src]=(e.dmgSrc[src]||0)+dmg;if(src===e.immune){if(Math.random()<.08)txt(e.x+(Math.random()-.5)*20,e.y-30,'免疫','#cbd5e1',.6);return;}}
  const arm=Math.max(0,e.armor-(e.shredT>0?e.shredV:0));
  if(!o.pure&&!o.ap)dmg=Math.max(dmg*.25,dmg-arm);
  if(e.shield>0){const m=src==='tesla'?2:1,ab=Math.min(e.shield,dmg*m);e.shield-=ab;dmg-=ab/m;if(e.shield<=0)burst(e.x,e.y,'#93c5fd',10,90,0,.35,2);}
  e.hp-=dmg;if(!o.pure){e.hitT=0;e.flT=.09;}
  if(crit)txt(e.x,e.y-14,Math.round(dmg)+'!','#fde047');
  if(!o.pure)hitFx(e,src,crit);
  if(M.execute&&!e.boss&&e.hp>0&&e.hp<e.max*M.execute){e.hp=0;stats.exec++;txt(e.x,e.y-14,'处决','#f87171');slashFx(e);}
  if(e.type==='boss1')while(e.hp>0&&e.hp<=e.max*e.nextSplit&&e.nextSplit>0){e.nextSplit-=.25;for(let k=0;k<5;k++)spawn('mini',Math.max(0,e.d-6-k*9),e.pi);txt(e.x,e.y-26,'分裂！','#f5d0fe',1.2);}
  if(e.hp<=0)kill(e);
}
function burnOn(e,dps,dur){e.burnT=Math.max(e.burnT,dur+(M.burnPlus||0));e.burnD=Math.max(e.burnD,dps);}
function kill(e){
  if(e.afx.undying&&!e.revived&&e.burnT<=0){e.revived=true;e.hp=e.max*.4;txt(e.x,e.y-16,'不灭！','#fde68a',1);burst(e.x,e.y,'#fde68a',14,80,-60,.6,2);return;}
  e.dead=true;
  let g=e.gold+M.killGold;
  if(M.loot&&(e.elite||e.boss))g+=e.gold;
  if(e.burnT>0&&has('C_moltengold')){g*=2;txt(e.x,e.y-12,'熔金','#fbbf24',.7);}
  gold+=g;stats.bounty+=M.killGold;stats.kills++;
  if(e.burnT>0&&M.ember){const R=CS*1.1;fx.push({k:'boom',x:e.x,y:e.y,r:R,t:.3,T:.3,c:'#f97316'});
    for(const o of enemies)if(o!==e&&!o.dead&&(o.x-e.x)**2+(o.y-e.y)**2<=R*R){burnOn(o,Math.max(4,e.burnD),2);hit(o,e.max*(e.boss?.03:.15),'cannon',{pure:true,noCrit:true});}}
  if(e.type==='split'){spawn('mini',Math.max(0,e.d-4),e.pi);spawn('mini',Math.max(0,e.d-16),e.pi);}
  fx.push({k:'boom',x:e.x,y:e.y,r:e.r*1.5,t:.22,T:.22,c:'#fffbeb'});fx.push({k:'ring',x:e.x,y:e.y,r:e.r*1.9,t:.22,T:.22,c:'#ffffff'});
  deathFx(e);burst(e.x,e.y,'#ffffff',e.boss?10:4,e.boss?120:70,0,.25,1.6);
  if(e.boss)stopT=Math.max(stopT,.18);else if(e.elite)stopT=Math.max(stopT,.05);
  if(e.boss){shake=Math.max(shake,7);sfx('bossdie');}
}
const targetable=e=>!e.dead&&(!e.afx.stealth||e.revealed);
function inRange(t,R){const R2=R*R;return enemies.filter(e=>targetable(e)&&(e.x-t.x)**2+(e.y-t.y)**2<=R2);}
// 闪电链：从 first 开始，连锁 n 个目标
function chainZap(first,n,dmg,decay,from,o){
  let cur=first,d=dmg;const hs=new Set(),pts=[from||[first.x,first.y-30]],tgs=[];
  for(let i=0;i<n&&cur;i++){
    hs.add(cur);pts.push([cur.x,cur.y]);tgs.push(cur);if(!FEAT.fx2)burst(cur.x,cur.y,'#f5d0fe',4,90,0,.25,1.5);
    let dd=d;if(M.overload&&Math.random()<M.overload){dd*=3;txt(cur.x,cur.y-14,'过载','#e9d5ff');fx.push({k:'boom',x:cur.x,y:cur.y,r:CS*.55,t:.2,T:.2,c:'#e9d5ff'});sparks(cur.x,cur.y,'#f5d0fe',8,200,.25);}
    if(M.staticF)cur.markT=4;
    hit(cur,dd,'tesla',o);d*=decay;
    let best=null,bd=(1.8*CS)**2;
    for(const e of enemies){if(!targetable(e)||hs.has(e))continue;const q=(e.x-cur.x)**2+(e.y-cur.y)**2;if(q<bd){bd=q;best=e;}}
    cur=best;
  }
  if(FEAT.fx2)fx2Zap(pts,from,tgs);else fx.push({k:'zap',pts,t:.15,T:.15});
}
function teslaChainN(t){let n=M.chain;if(t.branch==='coil')n+=3;if(evolved(t))n+=2;if(has('C_harvest'))n+=Math.min(3,Math.floor(gold/100));return n;}
function teslaDecay(t){return has('C_supercond')?1:t.branch==='coil'?.95:.85;}
function updTower(t,dt){
  t.flash=Math.max(0,(t.flash||0)-dt);t.kick=Math.max(0,(t.kick||0)-dt*7);
  if(t.aim!==undefined){let d=t.aim-(t.ang||0);d=Math.atan2(Math.sin(d),Math.cos(d));t.ang=(t.ang||0)+d*Math.min(1,dt*16);}
  if(t.stun>0){t.stun-=dt;return;}
  // 风暴分支：每 3 秒全图落雷
  if(t.branch==='storm'){t.stormCd=(t.stormCd??3)-dt;if(t.stormCd<=0){t.stormCd=3;const s=stat(t),pool=enemies.filter(targetable);
    for(let k=0;k<3&&pool.length;k++){const e=pool.splice(Math.floor(Math.random()*pool.length),1)[0];fx.push({k:'zap',pts:[[e.x+(Math.random()-.5)*20,e.y-90],[e.x,e.y]],t:.2,T:.2});burst(e.x,e.y,'#f5d0fe',8,100,0,.3,1.8);hit(e,s.dmg*1.8,'tesla');}
    if(pool.length||enemies.length)sfx('zap');}}
  t.cd-=dt;if(t.cd>0)return;
  const s=stat(t),list=inRange(t,s.range);
  if(!list.length){t.cd=0;return;}
  list.sort((a,b)=>b.d-a.d);t.cd=s.rate;t.flash=.1;t.kick=1;
  {const e0=t.type==='arrow'&&t.branch==='sniper'?list.slice().sort((a,b)=>b.hp-a.hp)[0]:list[0];t.aim=Math.atan2(e0.x-t.x,-(e0.y-t.y));if(t.ang===undefined)t.ang=t.aim;}
  t.shots=(t.shots||0)+1;
  const fifth=M.fifth&&t.shots%5===0,evo=evolved(t);
  if(t.type==='arrow'){
    let tg;
    if(t.branch==='sniper')tg=[list.slice().sort((a,b)=>b.hp-a.hp)[0]];
    else{const n=t.branch==='repeater'?3:M.arrowMulti;tg=list.slice(0,Math.min(n,list.length));if(t.branch==='repeater')while(tg.length<3)tg.push(tg[0]);}
    const [ax,ay]=towerTip(t,.36);
    if(t.branch==='sniper'&&tg[0])fx.push({k:'tracer',x1:ax,y1:ay,x2:tg[0].x,y2:tg[0].y,t:.14,T:.14});
    tg.forEach((e,ti)=>projs.push({k:'arrow',x:ax,y:ay,tg:e,tx:e.x,ty:e.y,v:t.branch==='sniper'?900:520,dmg:(ti>0&&t.branch!=='repeater')?s.dmg*.7:s.dmg,crit:fifth,ap:t.branch==='sniper',evo,lvl:t.lvl}));
    if(has('C_thunderarrow')&&t.shots%4===0)chainZap(tg[0],3,s.dmg,.9,[ax,ay]);
    sfx('arrow');
  }else if(t.type==='cannon'){
    const e=list[0],[cx,cy]=towerTip(t,.38);burst(cx,cy,'#fde68a',5,90,0,.18,1.8);burst(cx,cy,'#9ca3af',3,40,-30,.4,2.4);projs.push({k:'shell',x:cx,y:cy,sx:cx,sy:cy,tg:e,tx:e.x,ty:e.y,v:t.branch==='mortar'?260:300,dmg:s.dmg,lvl:t.lvl,crit:fifth,cluster:t.branch==='cluster',splash:t.branch==='mortar'?1.3:1,evo});sfx('cannon');
  }else if(t.type==='frost'){
    sfx('frost');if(FEAT.fx2)fx2Frost(t.x,t.y,s.range,t.branch==='nova');else{fx.push({k:'ring',x:t.x,y:t.y,r:s.range,t:.35,T:.35,c:t.branch==='nova'?'#e0f2fe':'#93c5fd'});
    for(let k=0;k<6;k++){const an=k*1.047+Math.random()*.5;P({k:'shard',x:t.x+Math.cos(an)*s.range*.3,y:t.y+Math.sin(an)*s.range*.3,vx:Math.cos(an)*s.range*1.6,vy:Math.sin(an)*s.range*1.6,g:0,t:.3,T:.3,c:'#e0f2fe',r:3,rot:an+1.57,vr:0});}}
    const slow=Math.min(t.branch==='glacier'?.85:.8,M.frostSlow+(t.branch==='glacier'?.25:0))*(BIO.slow||1);
    const fz=M.freeze+(t.branch==='glacier'?.15:0);
    for(const e of list){
      e.slowA=e.slowT>0?Math.max(e.slowA,slow):slow;e.slowT=M.coldWave?2.6:1.6;
      if(evo){if(!(e.frzCd>0)){e.frzT=Math.max(e.frzT,e.boss?.3:.8);e.frzCd=3;}}else if(fz&&Math.random()<fz)e.frzT=e.boss?.35:1;
      if(t.branch==='nova'){e.shredT=3;e.shredV=Math.max(e.shredV||0,3);}
      else if(M.shredRune){e.shredT=3;e.shredV=Math.max(e.shredV||0,4);}
      if(FEAT.fx2)frostBloom(e);else burst(e.x,e.y,'#e0f2fe',3,40,0,.4,1.6);hit(e,s.dmg,'frost',{crit:fifth});
    }
  }else if(t.type==='tesla'){
    sfx('zap');
    chainZap(list[0],teslaChainN(t),s.dmg,teslaDecay(t),[t.x,t.y-CS*.75],{crit:fifth});
    if(evo){const other=list.find(e=>e!==list[0])||list[0];chainZap(other,teslaChainN(t),s.dmg*.6,teslaDecay(t),[t.x,t.y-CS*.75]);}
  }
}
function nearest(x,y,R,skip){let best=null,bd=R*R;for(const e of enemies){if(e.dead||skip.has(e))continue;const q=(e.x-x)**2+(e.y-y)**2;if(q<bd){bd=q;best=e;}}return best;}
function explode(x,y,R,dmg,lvl,o){
  const R2=R*R;
  for(const e of enemies){if(!e.dead&&(e.x-x)**2+(e.y-y)**2<=R2){if(M.burn)burnOn(e,M.burn*lvl,2);hit(e,dmg,'cannon',o);}}
}
function updProj(p,dt){
  if(p.tg&&!p.tg.dead){p.tx=p.tg.x;p.ty=p.tg.y;}
  const dx=p.tx-p.x,dy=p.ty-p.y,dist=Math.hypot(dx,dy),st=p.v*dt;p.vx=dx;p.vy=dy;
  if(dist>st){p.x+=dx/dist*st;p.y+=dy/dist*st;
    if(p.k==='shell'&&Math.random()<.45){const tot=Math.hypot(p.tx-p.sx,p.ty-p.sy)||1,k=1-Math.min(1,Math.hypot(p.tx-p.x,p.ty-p.y)/tot);smoke(p.x,p.y-Math.sin(k*Math.PI)*Math.min(26,tot*.35),1,2.4,'#a8a29e',-6);}
    return;}
  p.done=true;
  if(p.k==='arrow'){
    const e=p.tg;if(!e||e.dead)return;
    const crit=p.crit||(has('C_icearrow')&&e.frzT>0);
    hit(e,p.dmg,'arrow',{crit,ap:p.ap,evo:p.evo});burst(p.tx,p.ty,'#bbf7d0',4,60,0,.25,1.5);
    if(has('C_firearrow'))burnOn(e,4*p.lvl,2);
    if(has('C_icearrow')){e.slowA=e.slowT>0?Math.max(e.slowA,.25):.25;e.slowT=Math.max(e.slowT,1);}
    const skip=new Set([e]);
    if(p.evo){for(let k=0;k<2;k++){const o=nearest(p.tx,p.ty,1.2*CS,skip);if(!o)break;skip.add(o);hit(o,p.dmg*.5,'arrow',{ap:p.ap,evo:true});burst(o.x,o.y,'#bbf7d0',3,60,0,.25,1.5);}}
    else if(M.pierce){const o=nearest(p.tx,p.ty,1.2*CS,skip);if(o)hit(o,p.dmg*.6,'arrow',{ap:p.ap});}
    return;
  }
  // 炮弹 / 子炸弹
  const R=(p.k==='bomblet'?.55:.9*(p.splash||1))*CS*M.cannonSplash;
  if(FEAT.fx2){fx2Boom(p.tx,p.ty,R,p.k!=='shell');if(p.k==='shell'){chunks(p.tx,p.ty,BIOME==='snow'?'#e2e8f0':BIOME==='volcano'?'#3f3f46':'#7c6a4f',5,150,2.6);decal('scorch',p.tx,p.ty+3,R*.7,2.4);shake=Math.max(shake,p.splash>1?4:2.5);sfx('boom');}}
  else{fx.push({k:'boom',x:p.tx,y:p.ty,r:R,t:.3,T:.3,c:'#fb923c'});
  if(p.k==='shell'){fx.push({k:'ring',x:p.tx,y:p.ty,r:R*1.1,t:.3,T:.3,c:'#fed7aa'});fx.push({k:'core',x:p.tx,y:p.ty,r:R*.45,t:.1,T:.1});burst(p.tx,p.ty,'#fdba74',10,110,260,.45,2.2);chunks(p.tx,p.ty,BIOME==='snow'?'#e2e8f0':BIOME==='volcano'?'#3f3f46':'#7c6a4f',6,140,2.6);smoke(p.tx,p.ty-4,2,R*.18,'#78716c');decal('scorch',p.tx,p.ty+3,R*.7,2.4);shake=Math.max(shake,p.splash>1?4:2.5);sfx('boom');}
  else sparks(p.tx,p.ty,'#fdba74',4,110,.2);}
  explode(p.tx,p.ty,R,p.dmg,p.lvl,{crit:p.crit});
  if(p.k==='shell'){
    if(p.cluster)for(let k=0;k<4;k++){const a=Math.random()*6.283,r=CS*(.6+Math.random()*.7);projs.push({k:'bomblet',x:p.tx,y:p.ty,sx:p.tx,sy:p.ty,tx:p.tx+Math.cos(a)*r,ty:p.ty+Math.sin(a)*r,v:160,dmg:p.dmg*.35,lvl:p.lvl});}
    if(has('C_plasma')){const f=nearest(p.tx,p.ty,1.6*CS,new Set());if(f)chainZap(f,2,p.dmg*.5,.9,[p.tx,p.ty]);}
    if(p.evo)lavas.push({x:p.tx,y:p.ty,r:R*.9,t:2.5,T:2.5,dps:p.dmg*.4});
  }
}
function updEnemy(e,dt){
  if(e.dead)return;
  e.hitT+=dt;if(e.flT>0)e.flT-=dt;if(e.frzCd>0)e.frzCd-=dt;if(e.markT>0)e.markT-=dt;if(e.shredT>0)e.shredT-=dt;if(e.steamCd>0)e.steamCd-=dt;
  if(e.burnT>0){e.burnT-=dt;hit(e,e.burnD*dt,'cannon',{noCrit:true,pure:true});if(e.dead)return;}
  if(has('C_steam')&&e.burnT>0&&(e.slowT>0||e.frzT>0)&&!(e.steamCd>0)){
    e.steamCd=3;const R=1.2*CS,dm=e.max*(e.boss?.03:.12);
    fx.push({k:'boom',x:e.x,y:e.y,r:R,t:.35,T:.35,c:'#e2e8f0'});burst(e.x,e.y,'#f1f5f9',14,120,-40,.6,2.4);smoke(e.x,e.y,6,8,'#f1f5f9',-30);txt(e.x,e.y-18,'蒸汽爆炸','#e2e8f0',.8);sfx('boom');
    for(const o of enemies)if(!o.dead&&(o.x-e.x)**2+(o.y-e.y)**2<=R*R)hit(o,dm,'cannon',{pure:true,noCrit:true});
    if(e.dead)return;
  }
  if(e.afx.regen&&e.burnT<=0&&e.hitT>1.5&&e.hp<e.max){e.hp=Math.min(e.max,e.hp+e.max*.04*dt);}
  if(e.type==='boss2'){e.cycT-=dt;if(e.cycT<=0){e.cycT=7;const k=Object.keys(e.dmgSrc).sort((a,b)=>e.dmgSrc[b]-e.dmgSrc[a])[0];if(k)e.immune=k;e.dmgSrc={};txt(e.x,e.y-34,'免疫 '+TT[e.immune].name,TT[e.immune].color,1.4);}}
  if(e.type==='boss3'){
    if(!e.enraged&&e.hp<e.max*.5){e.enraged=true;e.spd*=1.6;txt(e.x,e.y-34,'狂暴！','#f87171',1.4);shake=Math.max(shake,5);sfx('boss');}
    if(e.enraged){e.stunT-=dt;if(e.stunT<=0){e.stunT=6;let best=null,bd=(3.5*CS)**2;for(const t of towers){const q=(t.x-e.x)**2+(t.y-e.y)**2;if(q<bd&&!(t.stun>0)){bd=q;best=t;}}
      if(best){best.stun=3;fx.push({k:'ring',x:best.x,y:best.y,r:CS*.8,t:.5,T:.5,c:'#f87171'});txt(best.x,best.y-30,'震慑','#f87171',1.2);sfx('leak');}}}
  }
  let f=1;
  if(e.frzT>0){e.frzT-=dt;f=0;}
  else if(e.slowT>0){e.slowT-=dt;f=1-e.slowA;}
  {const tk=tiles[Math.floor(e.x/CS)+','+Math.floor(e.y/CS)];if(tk==='swamp')f*=.7;else if(tk==='ice')f*=1.3;}
  if(e.lead)f*=1.25;
  e.d+=e.spd*CS*f*dt;
  if(e.d>=PATHS[e.pi].tot){
    e.dead=true;let lost=e.boss?Math.max(1,Math.ceil(e.hp/e.max*24)):e.dmg;
    if(!e.boss&&HERO&&HERO.wallT>0){const g=clampPt(PATHS[e.pi].PP[PATHS[e.pi].PP.length-1]);txt(g.x,g.y-14,'壁垒','#7dd3fc',.8);burst(g.x,g.y,'#bae6fd',8,80,0,.4,2);return;}
    lives-=lost;stats.leaked++;shake=Math.max(shake,4);sfx('leak');fx.push({k:'flash',t:.3,T:.3});
    const g=clampPt(PATHS[e.pi].PP[PATHS[e.pi].PP.length-1]);txt(g.x,g.y-14,'-'+lost+' ❤',"#fca5a5",1.2);
    if(M.hourglass&&!hourglassUsed){hourglassUsed=true;for(const o of enemies)if(!o.dead)o.frzT=Math.max(o.frzT,o.boss?1:3);txt(W/2,H*.3,'时停沙漏！','#a5f3fc',1.4);sfx('frost');}
    if(lives<=0){lives=0;endGame(false);}
    return;
  }
  const p=posAt(e.pi,e.d);if(Math.abs(p.x-e.x)>.01)e.dir=p.x<e.x?-1:1;e.x=p.x;e.y=p.y;
}
function updLava(dt){
  for(const l of lavas){l.t-=dt;for(const e of enemies)if(!e.dead&&(e.x-l.x)**2+(e.y-l.y)**2<=l.r*l.r)hit(e,l.dps*dt,'cannon',{pure:true,noCrit:true});}
  lavas=lavas.filter(l=>l.t>0);
}

// ======================= 流程 =======================
function startWave(){
  if(phase!=='build')return;
  queue=buildWave(step,curNode);spawnT=.9;phase='wave';paused=false;bpOpen=false;bp.style.display='none';hourglassUsed=false;if(sel&&sel.enemy)sel=null;placing=null;renderPanel();
  const isB=curNode==='boss';
  banner={a:isB?'Boss 来袭':`第 ${step} 站 · ${NODES[curNode].name}`,b:isB?EINFO['boss'+actOf(step)].name:`第 ${actOf(step)} 幕`,boss:isB||curNode==='elite',t:2,T:2};sfx(isB?'boss':'wave');
}
function step_(dt){
  if(queue.length){spawnT-=dt;if(spawnT<=0){const q=queue.shift();spawn(q.t,0,undefined,q.elite);spawnT=q.gap;}}
  // 显形、领袖
  const frosts=towers.filter(t=>t.type==='frost'&&!(t.stun>0)).map(t=>[t,stat(t).range]);
  for(const e of enemies){
    if(e.afx.stealth)e.revealed=frosts.some(([t,R])=>(t.x-e.x)**2+(t.y-e.y)**2<=R*R);
    e.lead=false;
  }
  for(const l of enemies)if(l.afx.leader&&!l.dead)for(const e of enemies)if(e!==l&&(e.x-l.x)**2+(e.y-l.y)**2<=(2*CS)**2)e.lead=true;
  for(const e of enemies)updEnemy(e,dt);
  if(phase!=='wave')return;
  for(const t of towers)updTower(t,dt);
  updHero(dt);statusFx(dt);
  updLava(dt);
  for(const p of projs)updProj(p,dt);
  projs=projs.filter(p=>!p.done);
  enemies=enemies.filter(e=>!e.dead);
  updFx(dt);
  if(introQ.length){showIntro();return;}
  if(!queue.length&&!enemies.length)waveDone();
}
function interestNow(){return M.interest?Math.min(60,Math.floor(gold*M.interest)):0;}
function waveDone(){
  projs=[];
  const elite=curNode==='elite',boss=curNode==='boss';
  let bonus=stepBonus();if(elite){bonus=Math.round(bonus*1.5);stats.eliteWins++;}if(boss)stats.bossWins++;
  zones=[];meteors=[];if(HERO){HERO.hasteT=0;HERO.wallT=0;}
  const it=interestNow();gold+=bonus+it;
  if(step>=MAXS){endGame(true);return;}
  projs=[];lavas=[];
  if(M.unstable&&Math.random()<.5){const c=towers.filter(t=>t.lvl>1);if(c.length){const t=pick(c);t.lvl--;if(t.lvl<3)t.branch=null;txt(t.x,t.y-30,'不稳定：降级','#fca5a5',1.6);}}
  phase='reward';renderPanel();
  let sub=`奖励 +${bonus} 金${it?`，利息 +${it}`:''}`;
  if(boss){const heal=curseOn('brittle')?0:D(7)?2:BOSS_HEAL;lives+=heal;if(heal)sub+=`，城墙修复 +${heal} ❤️`;offerCards(`击败 ${EINFO['boss'+actOf(step)].name}！`,sub+' · Boss 宝箱：必出史诗或传说符文',2,altarAvailable()?offerAltar:offerNodes,true);}
  else if(elite)offerEliteReward(sub);
  else offerCards(`第 ${step} 站完成！`,sub+' · 选择一个符文',0,offerNodes);
}
const BOSS_HEAL=5;
function stepBonus(){let b=20+Math.max(step,1)*4;if(curseOn('tax'))b=Math.round(b*.5);return b;}
// 精英战胜利：符文（稀有以上）或地形卡，二选一
function offerEliteReward(sub){
  phase='elitepick';eliteSub=sub;snapRun('elitepick',{sub});
  ov.innerHTML=`<h2>精英战胜利！</h2><div class="sub">${sub} · 选择一种奖励</div><div class="cards">
    <button class="card r1" id="erRune"><div class="n">🔮 符文</div><div class="d">三选一，必有一个稀有或以上的符文</div></button>
    <button class="card" id="erTile"><div class="n">🗺️ 地形卡</div><div class="d">从高地、符文井、沼泽里选一张，自己放到地图上</div></button></div>
    <button class="reroll" id="seeRunes">🔮 我的符文</button>`;
  ov.style.display='flex';
  $('erRune').onclick=eliteRune;$('erTile').onclick=eliteTile;$('seeRunes').onclick=openRunes;
}
function eliteRune(){ov.style.display='none';phase='reward';offerCards('精英战胜利！',eliteSub+' · 必有稀有或以上的符文',1,offerNodes);}
function eliteTile(){
  phase='reward';snapRun('tilepick');
  let h=`<h2>选择一张地形卡</h2><div class="sub">拿到后在下方面板点它，再点地图放置</div><div class="cards">`;
  for(const k of TCARDS)h+=`<button class="card" data-k="${k}"><div class="n">${TILEINFO[k].name}</div><div class="d">${TILEINFO[k].desc}</div></button>`;
  ov.innerHTML=h+'</div>';ov.style.display='flex';
  ov.querySelectorAll('.card').forEach(b=>b.onclick=()=>takeTile(b.dataset.k));
}
function takeTile(k){tcards[k]++;sfx('card');ov.style.display='none';offerNodes();}
function genNodes(next){
  if(next%5===0)return['boss'];
  if(next===1)return['normal'];
  return['normal','elite'];
}
function offerNodes(){
  phase='node';sel=null;renderPanel();
  const next=step+1;pendingNodes=genNodes(next);
  const newAct=(next-1)%5===0;
  let h=`<h2>${newAct?`第 ${actOf(next)} 幕 · `:''}选择第 ${next} 站</h2><div class="sub">${next%5===0?'这一站是 Boss，做好准备':'打普通战斗稳一点，打精英战斗奖励更好'}</div><div class="cards">`;
  pendingNodes.forEach((k,i)=>{
    const n=NODES[k];let d=n.desc;
    if(k==='boss'){const b='boss'+actOf(next);d=`<b>${EINFO[b].name}</b>：${EINFO[b].desc}`;}
    h+=`<button class="card node" data-i="${i}"><div class="ic">${n.icon}</div><div><div class="n">${n.name}</div><div class="d">${d}</div></div></button>`;
  });
  h+=`</div><button class="reroll" id="seeRunes">🔮 我的符文</button>`;
  ov.innerHTML=h;ov.style.display='flex';
  ov.querySelectorAll('.card').forEach(b=>b.onclick=()=>{ov.style.display='none';chooseNode(pendingNodes[+b.dataset.i]);});
  $('seeRunes').onclick=openRunes;
  snapRun('nodes');if(GUIDE===1)guideSet(2);
}
function chooseNode(k){step++;curNode=k;phase='build';renderPanel();snapRun('build');}

// ======================= 特效 =======================
function updFx(dt){
  fxClock+=dt;
  for(const f of fx)f.t-=dt;fx=fx.filter(f=>f.t>0);
  for(const q of parts){if(q.k==='orbit'){q.t-=dt;q.a+=q.w*dt;q.r+=q.vr*dt;q.vr*=Math.exp(-1.2*dt);q.w*=Math.exp(-.8*dt);q.x=q.cx+Math.cos(q.a)*q.r;q.y=q.cy+Math.sin(q.a)*q.r*q.sq+(q.drop?q.drop*(1-q.t/q.T):0);continue;}q.t-=dt;if(q.drag){const d=Math.exp(-q.drag*dt);q.vx*=d;q.vy*=d;}q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=q.g*dt;}
  if(sched.length){for(const s of sched)s.t-=dt;const due=sched.filter(s=>s.t<=0);sched=sched.filter(s=>s.t>0);for(const s of due)s.f();}parts=parts.filter(q=>q.t>0);if(parts.length>420)parts.splice(0,parts.length-420);
  for(const d of decals)d.t-=dt;decals=decals.filter(d=>d.t>0);
  shake=Math.max(0,shake-dt*18);
  for(const t of texts){t.t-=dt;t.y-=22*dt;}texts=texts.filter(t=>t.t>0);
}
function burst(x,y,c,n,sp,g,life,r){for(let i=0;i<n;i++){const a=Math.random()*6.283,v=sp*(.4+Math.random()*.6);parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-(g?sp*.3:0),g:g||0,t:life*(.6+Math.random()*.4),T:life,c,r:r||2});}}
function txt(x,y,s,c,T){texts.push({x,y,s,c,t:T||.8,T:T||.8});}

// ======================= v0.5c：特效 =======================
// 地面印记（焦痕、弹坑、黏液、冰霜）画在地面之上、塔和敌人之下；粒子分多种形状。
let decals=[];
function decal(k,x,y,r,T,c){decals.push({k,x,y,r,t:T,T,c,rot:Math.random()*6.28});if(decals.length>45)decals.shift();}
function P(o){parts.push(o);}
function sparks(x,y,c,n,sp=140,life=.22){for(let i=0;i<n;i++){const a=Math.random()*6.283,v=sp*(.5+Math.random()*.5);P({k:'spark',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,g:0,t:life,T:life,c,r:1.4});}}
function smoke(x,y,n,s=5,c='#6b6460',rise=-28){for(let i=0;i<n;i++)P({k:'smoke',x:x+(Math.random()-.5)*s*2,y:y+(Math.random()-.5)*s,vx:(Math.random()-.5)*20,vy:rise*(.6+Math.random()*.6),g:0,t:.7+Math.random()*.4,T:1.1,c,r:s*(.7+Math.random()*.6)});}
function chunks(x,y,c,n,sp=150,sz=3){for(let i=0;i<n;i++){const a=-Math.PI*Math.random(),v=sp*(.4+Math.random()*.6);P({k:'chunk',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,g:520,t:.55+Math.random()*.3,T:.85,c,r:sz*(.6+Math.random()*.7),rot:Math.random()*6,vr:(Math.random()-.5)*14});}}
function shards(x,y,n,c='#e0f2fe',sp=120){for(let i=0;i<n;i++){const a=Math.random()*6.283,v=sp*(.5+Math.random()*.5);P({k:'shard',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-30,g:260,t:.45+Math.random()*.25,T:.7,c,r:3+Math.random()*2,rot:a,vr:(Math.random()-.5)*10});}}
// 史莱姆消失：一团白色烟雾 + 往上飘的泡泡 + 闪烁的小星星（卡通"噗"的一下，不像液体或血）
function poof(x,y,big=1){
  smoke(x,y-4,Math.round(5*big),5*big,'#ffffff',-18);
  for(let i=0;i<Math.round(5*big);i++)P({k:'bubble',x:x+(Math.random()-.5)*12*big,y:y-4,vx:(Math.random()-.5)*30,vy:-50-Math.random()*50,g:0,t:.55+Math.random()*.3,T:.85,c:'#e0f2fe',r:2.2+Math.random()*2.2*big});
  for(let i=0;i<Math.round(4*big);i++){const a=Math.random()*6.283,v=50+Math.random()*60;P({k:'twinkle',x,y:y-6,vx:Math.cos(a)*v,vy:Math.sin(a)*v-20,g:0,t:.5,T:.5,c:'#fef9c3',r:2.6});}
}
function coins(x,y,n){for(let i=0;i<n;i++){const a=-Math.PI*(.25+.5*Math.random()),v=100+Math.random()*70;P({k:'coin',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,g:380,t:.8,T:.8,c:'#fbbf24',r:3.2,rot:Math.random()*6});}}
function flame(x,y,s=1){P({k:'flame',x:x+(Math.random()-.5)*8*s,y,vx:(Math.random()-.5)*10,vy:-40-Math.random()*30,g:0,t:.35+Math.random()*.2,T:.55,c:'#fb923c',r:2.6*s});}
// 每种敌人的死亡方式
function deathFx(e){
  const big=e.boss?2.2:e.elite?1.4:1;
  if(FEAT.fx2&&e.boss){fx2BossDeath(e);if(e.type==='boss2')for(const c of ['#a5f3fc','#f9a8d4','#fde68a','#a5b4fc','#86efac'])shards(e.x,e.y,4,c,190);coins(e.x,e.y,14);sfx('coin');return;}
  if(e.type==='tank'){chunks(e.x,e.y,'#94a3b8',10,170,4);chunks(e.x,e.y,'#475569',5,130,3);smoke(e.x,e.y,4,7,'#9ca3af');decal('crack',e.x,e.y+4,e.r*1.3,2.5,'#334155');sfx('crumble');}
  else if(e.type==='fast'){for(let i=0;i<8;i++){const a=Math.random()*6.283;P({k:'spark',x:e.x,y:e.y,vx:Math.cos(a)*200,vy:Math.sin(a)*120,g:0,t:.35,T:.35,c:i%2?'#fde68a':'#ffffff',r:1.6});}smoke(e.x,e.y,3,5,'#fef3c7',-10);sfx('pop');}
  else if(e.type==='boss2'){for(const c of ['#a5f3fc','#f9a8d4','#fde68a','#a5b4fc','#86efac'])shards(e.x,e.y,6,c,190);fx.push({k:'ring',x:e.x,y:e.y,r:e.r*4,t:.5,T:.5,c:'#e0e7ff'});}
  else if(e.type==='boss3'){fx.push({k:'boom',x:e.x,y:e.y,r:e.r*3.2,t:.5,T:.5,c:'#f97316'});chunks(e.x,e.y,'#374151',14,220,5);for(let i=0;i<16;i++)flame(e.x,e.y,2);smoke(e.x,e.y,5,8,'#78716c');decal('crater',e.x,e.y+6,e.r*2,4,'#1c1917');}
  else{poof(e.x,e.y,big);sfx('squish');}
  if(e.elite||e.boss){coins(e.x,e.y,e.boss?14:5);sfx('coin');}
}
// 命中火花：按伤害来源区分颜色
function hitFx(e,src,crit){
  if(crit){sparks(e.x,e.y-6,'#fde047',8,180,.3);fx.push({k:'star',x:e.x,y:e.y-8,r:14,t:.22,T:.22});sfx('crit');return;}
  if(src==='arrow')sparks(e.x,e.y-4,'#f1f5f9',3,120,.16);
  else if(src==='frost'){if(!FEAT.fx2)shards(e.x,e.y-4,2,'#e0f2fe',70);}
  else if(src==='tesla'){e.zapT=.25;}
}
// 每帧给带状态的敌人冒粒子（燃烧火苗、减速雪花）
let stFxT=0;
function statusFx(dt){
  stFxT-=dt;if(stFxT>0)return;stFxT=.06;
  for(const e of enemies){if(e.dead)continue;
    if(e.burnT>0)flame(e.x,e.y-e.r*.4,e.boss?1.6:1);
    if(e.slowT>0&&!(e.frzT>0)&&Math.random()<.35)P({k:'snow',x:e.x+(Math.random()-.5)*e.r*2,y:e.y-e.r,vx:0,vy:22,g:0,t:.6,T:.6,c:'#e0f2fe',r:1.5});
    if(e.zapT>0)e.zapT-=.06;
  }
  if(HERO&&HERO.hasteT>0)for(const t of towers)if(Math.random()<.3){const a=Math.random()*6.283;P({k:'spark',x:t.x+Math.cos(a)*CS*.5,y:t.y+Math.sin(a)*CS*.3,vx:-Math.sin(a)*70,vy:Math.cos(a)*40-20,g:0,t:.35,T:.35,c:'#86efac',r:1.4});}
}
function drawDecals(){
  for(const d of decals){const a=Math.min(1,d.t/d.T*1.6);ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.globalAlpha=a*.55;
    if(d.k==='scorch'||d.k==='crater'){ctx.globalAlpha=a*.32;ctx.fillStyle=d.c||'#1c1917';ctx.beginPath();ctx.ellipse(0,0,d.r,d.r*.55,0,0,7);ctx.fill();ctx.globalAlpha=a*.35;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(0,0,d.r*.55,d.r*.3,0,0,7);ctx.fill();
      if(d.k==='crater'){ctx.globalAlpha=a*.5*(.5+.5*Math.sin(performance.now()/150));ctx.fillStyle='#f97316';ctx.beginPath();ctx.ellipse(0,0,d.r*.25,d.r*.14,0,0,7);ctx.fill();}}
    else if(d.k==='goo'){ctx.fillStyle=d.c;ctx.beginPath();ctx.ellipse(0,0,d.r,d.r*.45,0,0,7);ctx.fill();ctx.beginPath();ctx.arc(d.r*.8,d.r*.2,d.r*.22,0,7);ctx.arc(-d.r*.9,-d.r*.1,d.r*.16,0,7);ctx.fill();ctx.globalAlpha=a*.35;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(-d.r*.3,-d.r*.12,d.r*.25,d.r*.08,0,0,7);ctx.fill();}
    else if(d.k==='crack'){ctx.strokeStyle=d.c;ctx.lineWidth=1.6;ctx.beginPath();for(let i=0;i<5;i++){const an=i*1.26;ctx.moveTo(0,0);ctx.lineTo(Math.cos(an)*d.r,Math.sin(an)*d.r*.5);}ctx.stroke();}
    else if(d.k==='frost'){ctx.fillStyle='#e0f2fe';ctx.beginPath();ctx.ellipse(0,0,d.r,d.r*.5,0,0,7);ctx.fill();}
    ctx.restore();}
  ctx.globalAlpha=1;
}

// 闪电形状：两点之间做三层中点位移，种子按 1/15 秒变化 → 闪烁抖动
function jag(x0,y0,x1,y1,seed,amp){let pts=[[x0,y0],[x1,y1]],r=seed;const R=()=>{r=(r*9301+49297)%233280;return r/233280-.5;};
  for(let lv=0;lv<3;lv++){const n=[pts[0]];for(let i=1;i<pts.length;i++){const [ax,ay]=pts[i-1],[bx,by]=pts[i],L=Math.hypot(bx-ax,by-ay)||1;n.push([(ax+bx)/2+(-(by-ay)/L)*R()*amp*L,(ay+by)/2+((bx-ax)/L)*R()*amp*L],[bx,by]);}pts=n;amp*=.55;}return pts;}
function drawBolt(f){
  const el=f.T-f.t,a=Math.min(1,f.t/f.T*3),fr=Math.floor(el*15),segs=[];
  for(let i=1;i<f.pts.length;i++){const t0=(i-1)*f.hop;if(el<t0)break;const u=Math.min(1,(el-t0)/f.hop),[x0,y0]=f.pts[i-1],[x1,y1]=f.pts[i];
    const p=jag(x0,y0,x0+(x1-x0)*u,y0+(y1-y0)*u,Math.floor(f.seed+i*977+fr*131),.32);segs.push(p);
    if(ZAPLV){const p2=jag(x0,y0,x0+(x1-x0)*u,y0+(y1-y0)*u,Math.floor(f.seed+i*577+fr*71+9),.22);p2.br=1;segs.push(p2);}
    if(u>=1){const m=p[Math.floor(p.length*(.3+.4*((fr*7+i)%5)/5))],an=Math.atan2(y1-y0,x1-x0)+((fr+i)%2?.7:-.7),L=Math.hypot(x1-x0,y1-y0)*.3;const b=jag(m[0],m[1],m[0]+Math.cos(an)*L,m[1]+Math.sin(an)*L,Math.floor(f.seed+i*31+fr*17),.4);b.br=1;segs.push(b);}}
  const path=p=>{ctx.beginPath();p.forEach(([x,y],j)=>j?ctx.lineTo(x,y):ctx.moveTo(x,y));};
  ctx.lineJoin='round';ctx.lineCap='round';
  for(const [w,c,al,add] of [[9,'#7c3aed',.32,0],[5,'#a855f7',.75,0],[2.6,'#e9d5ff',1,1],[1.2,'#ffffff',1,1]]){ctx.globalCompositeOperation=add?'lighter':'source-over';ctx.strokeStyle=c;ctx.globalAlpha=a*al;segs.forEach(p=>{ctx.lineWidth=p.br?w*.55:w;path(p);ctx.stroke();});}
  ctx.globalCompositeOperation='source-over';ctx.lineCap='butt';ctx.lineJoin='miter';
}
// 电球：跟着被打中的怪走，几道短电弧从身上往外乱窜（每 1/20 秒换一次形状），加两张电花贴图交替闪
function drawArcBall(f){
  if(f.e&&!f.e.dead){f.x=f.e.x;f.y=f.e.y;}
  const el=f.T-f.t,a=Math.min(1,f.t/f.T*2.5),fr=Math.floor(el*20),x=f.x,y=f.y-4;
  const im=tinted(fr%2?'crackle':'crackle2','#e9d5ff');
  if(im){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=a*(f.lite?.55:1);const s=f.r*2.2;ctx.save();ctx.translate(x,y);ctx.rotate(fr*1.7+f.seed);ctx.drawImage(im,-s/2,-s/2,s,s);ctx.restore();}
  ctx.lineCap='round';ctx.lineJoin='round';
  const arcs=[];for(let i=0;i<(f.lite?3:5);i++){const an=(f.seed+fr*2.3+i*1.256)%6.283,L=f.r*(.7+((fr*7+i*13)%10)/14);arcs.push(jag(x,y,x+Math.cos(an)*L,y+Math.sin(an)*L*.8,Math.floor(f.seed+i*97+fr*53),.45));}
  for(const [w,c,al,add] of [[5,'#a855f7',.6,0],[2.2,'#e9d5ff',1,1],[1,'#ffffff',1,1]]){ctx.globalCompositeOperation=add?'lighter':'source-over';ctx.strokeStyle=c;ctx.lineWidth=w;ctx.globalAlpha=a*al;
    for(const p of arcs){ctx.beginPath();p.forEach(([px,py],j)=>j?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.stroke();}}
  ctx.globalCompositeOperation='source-over';ctx.lineCap='butt';ctx.lineJoin='miter';
}
function drawFrostWave(f){
  const k=1-f.t/f.T,e=1-(1-k)*(1-k)*(1-k),rr=f.r*(.2+.85*e),a=Math.min(1,f.t/f.T*2.2);
  ctx.globalAlpha=a*.2;ctx.fillStyle='#bae6fd';ctx.beginPath();ctx.arc(f.x,f.y,rr,0,7);ctx.fill();
  ctx.globalAlpha=a*.9;ctx.strokeStyle='#e0f2fe';ctx.lineWidth=3;ctx.stroke();ctx.globalAlpha=a*.5;ctx.strokeStyle='#60a5fa';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(f.x,f.y,rr+2.2,0,7);ctx.stroke();
  // 冰晶：先冒出来稍微超出再回弹，最后缩回去
  const pop=k<.25?k/.25*1.2:k<.4?1.2-(k-.25)/.15*.2:1,sz=CS*(f.nova?.26:.22)*pop*Math.min(1,(1-k)*2.5);if(sz<=.5)return;
  for(let i=0;i<f.n;i++){const an=f.rot+i*6.283/f.n,cx=f.x+Math.cos(an)*rr,cy=f.y+Math.sin(an)*rr;ctx.save();ctx.translate(cx,cy);ctx.rotate(an+Math.PI/2);ctx.globalAlpha=a;
    ctx.fillStyle='#f0f9ff';ctx.strokeStyle='#2563eb';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(0,-sz);ctx.lineTo(sz*.42,sz*.15);ctx.lineTo(0,sz*.5);ctx.lineTo(-sz*.42,sz*.15);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#7dd3fc';ctx.beginPath();ctx.moveTo(0,-sz);ctx.lineTo(sz*.42,sz*.15);ctx.lineTo(0,sz*.5);ctx.closePath();ctx.fill();ctx.restore();}
  ctx.globalAlpha=1;
}
function drawFlake(x,y,r,rot,a){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.globalAlpha=a;ctx.strokeStyle='#ffffff';ctx.lineCap='round';ctx.lineWidth=Math.max(1,r*.38);
  ctx.beginPath();for(let i=0;i<3;i++){const an=i*Math.PI/3;ctx.moveTo(-Math.cos(an)*r,-Math.sin(an)*r);ctx.lineTo(Math.cos(an)*r,Math.sin(an)*r);}ctx.stroke();
  ctx.fillStyle='#bae6fd';ctx.beginPath();ctx.arc(0,0,r*.32,0,7);ctx.fill();ctx.lineCap='butt';ctx.restore();}
function drawPart(q){
  const a=Math.max(0,Math.min(1,q.t/q.T*1.4));ctx.globalAlpha=a;
  switch(q.k){
    case 'spark':{const L=Math.hypot(q.vx,q.vy)||1;ctx.strokeStyle=q.c;ctx.lineWidth=q.r;ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x-q.vx/L*7,q.y-q.vy/L*7);ctx.stroke();break;}
    case 'smoke':{const k=1-q.t/q.T;ctx.globalAlpha=a*.28;ctx.fillStyle=q.c;ctx.beginPath();ctx.arc(q.x,q.y,q.r*(1+k*.9),0,7);ctx.fill();break;}
    case 'chunk':{q.rot+=q.vr*.016;ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.rot);ctx.fillStyle=q.c;ctx.fillRect(-q.r/2,-q.r/2,q.r,q.r);ctx.strokeStyle='rgba(0,0,0,.4)';ctx.lineWidth=.8;ctx.strokeRect(-q.r/2,-q.r/2,q.r,q.r);ctx.restore();break;}
    case 'shard':{q.rot+=q.vr*.016;ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.rot);ctx.fillStyle=q.c;ctx.beginPath();ctx.moveTo(0,-q.r);ctx.lineTo(q.r*.45,q.r*.6);ctx.lineTo(-q.r*.45,q.r*.6);ctx.closePath();ctx.fill();ctx.restore();break;}
    case 'goo':{ctx.fillStyle=q.c;ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,7);ctx.fill();ctx.globalAlpha=a*.6;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(q.x-q.r*.3,q.y-q.r*.3,q.r*.3,0,7);ctx.fill();break;}
    case 'bubble':{ctx.strokeStyle='#ffffff';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,7);ctx.stroke();ctx.fillStyle='rgba(224,242,254,.35)';ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(q.x-q.r*.35,q.y-q.r*.35,q.r*.25,0,7);ctx.fill();break;}
    case 'twinkle':{const r=q.r*(q.t/q.T);ctx.fillStyle=q.c;ctx.beginPath();ctx.moveTo(q.x,q.y-r*1.6);ctx.lineTo(q.x+r*.4,q.y-r*.4);ctx.lineTo(q.x+r*1.6,q.y);ctx.lineTo(q.x+r*.4,q.y+r*.4);ctx.lineTo(q.x,q.y+r*1.6);ctx.lineTo(q.x-r*.4,q.y+r*.4);ctx.lineTo(q.x-r*1.6,q.y);ctx.lineTo(q.x-r*.4,q.y-r*.4);ctx.closePath();ctx.fill();break;}
    case 'coin':{q.rot+=.3;const w=Math.abs(Math.cos(q.rot))*q.r+.6;ctx.fillStyle='#f59e0b';ctx.beginPath();ctx.ellipse(q.x,q.y,w,q.r,0,0,7);ctx.fill();ctx.fillStyle='#fde68a';ctx.beginPath();ctx.ellipse(q.x-w*.2,q.y-q.r*.2,w*.45,q.r*.45,0,0,7);ctx.fill();break;}
    case 'tex':{const im=tinted(q.tex,q.c);if(!im)break;const k=1-q.t/q.T,e=1-(1-k)*(1-k),s=q.s0+(q.s1-q.s0)*e;q.rot+=q.vr*.016;
      ctx.globalAlpha=q.a0*Math.min(1,(1-k)*1.6)*Math.min(1,k*12+.3);if(q.add)ctx.globalCompositeOperation='lighter';
      ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.rot);ctx.drawImage(im,-s/2,-s/2,s,s);ctx.restore();if(q.add)ctx.globalCompositeOperation='source-over';break;}
    case 'puff':{const st=puffState(q);ctx.globalAlpha=st.a*(1-st.smokeK*.6);ctx.fillStyle=st.fill;ctx.beginPath();ctx.arc(q.x,q.y,st.r,0,7);ctx.fill();
      if(st.smokeK<.5){ctx.globalAlpha*=.35*(1-st.smokeK*2);ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(q.x-st.r*.3,q.y-st.r*.36,st.r*.28,0,7);ctx.fill();}break;}
    case 'orbit':{const k=1-q.t/q.T,fa=Math.min(1,(1-k)*2.2)*Math.min(1,k*8+.2);
      if(q.flake){q.rot+=q.spin*.016;drawFlake(q.x,q.y,q.s0*(1-k*.3),q.rot,fa);break;}
      const im=tinted(q.tex,q.c);if(!im)break;const s=q.s0+(q.s1-q.s0)*(1-(1-k)*(1-k));
      ctx.globalAlpha=q.a0*fa;ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.a+(q.w>0?Math.PI:0));ctx.scale(1,q.sq);ctx.drawImage(im,-s/2,-s/2,s,s);ctx.restore();break;}
    case 'snowflake':{q.rot+=q.spin*.016;const k=q.t/q.T;drawFlake(q.x,q.y,q.r,q.rot,Math.min(1,k*2));break;}
    case 'ember':{const k=q.t/q.T;ctx.globalAlpha=Math.min(1,k*2);ctx.fillStyle=k>.5?'#fde047':'#fb923c';ctx.beginPath();ctx.arc(q.x,q.y,q.r*(.6+k*.5),0,7);ctx.fill();break;}
    case 'flame':{const k=q.t/q.T;ctx.fillStyle=k>.6?'#fde047':k>.3?'#fb923c':'#dc2626';ctx.beginPath();ctx.arc(q.x,q.y,q.r*(.5+k*.7),0,7);ctx.fill();break;}
    case 'snow':{ctx.fillStyle=q.c;ctx.fillRect(q.x-q.r,q.y-q.r*.25,q.r*2,q.r*.5);ctx.fillRect(q.x-q.r*.25,q.y-q.r,q.r*.5,q.r*2);break;}
    case 'arrowfall':{ctx.strokeStyle='#e7e2d6';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x+5,q.y-14);ctx.stroke();ctx.fillStyle='#4ade80';ctx.beginPath();ctx.arc(q.x,q.y,1.6,0,7);ctx.fill();break;}
    default:{ctx.fillStyle=q.c;ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,7);ctx.fill();}
  }
}
// 敌人身上的状态外观：冰块、电弧、破甲
function drawStatus(e,s,top){
  if(e.frzT>0){const w=e.r*2.3,h=e.r*2.1;ctx.fillStyle='rgba(186,230,253,.5)';ctx.strokeStyle='rgba(224,242,254,.95)';ctx.lineWidth=1.5;rrect(e.x-w/2,e.y-h*.75,w,h,4);ctx.fill();ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.8)';ctx.beginPath();ctx.moveTo(e.x-w*.32,e.y-h*.6);ctx.lineTo(e.x-w*.12,e.y-h*.6);ctx.moveTo(e.x-w*.36,e.y-h*.45);ctx.lineTo(e.x-w*.3,e.y-h*.2);ctx.stroke();}
  if(e.zapT>0){ctx.strokeStyle='#e9d5ff';ctx.lineWidth=1.3;ctx.beginPath();for(let i=0;i<3;i++){const a=Math.random()*6.283,r=e.r*1.1;ctx.moveTo(e.x+Math.cos(a)*r*.3,e.y-4+Math.sin(a)*r*.3);ctx.lineTo(e.x+Math.cos(a+.4)*r*.8+(Math.random()-.5)*4,e.y-4+Math.sin(a+.4)*r*.8);ctx.lineTo(e.x+Math.cos(a)*r*1.2,e.y-4+Math.sin(a)*r*1.2);}ctx.stroke();}
  if(e.markT>0){const a=performance.now()/200;ctx.fillStyle='#d8b4fe';for(let i=0;i<3;i++){const an=a+i*2.09;ctx.beginPath();ctx.arc(e.x+Math.cos(an)*e.r*1.1,e.y-4+Math.sin(an)*e.r*.5,1.6,0,7);ctx.fill();}}
  if(e.shredT>0&&e.armor>0){const x=e.x+e.r*.9,y=top-2;ctx.fillStyle='#94a3b8';ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+4,y-3);ctx.lineTo(x+3,y+2);ctx.lineTo(x,y+4);ctx.lineTo(x-3,y+2);ctx.lineTo(x-4,y-3);ctx.closePath();ctx.fill();ctx.strokeStyle='#ef4444';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x-1,y-4);ctx.lineTo(x+1,y);ctx.lineTo(x-1,y+3);ctx.stroke();}
}
// 处决：一道红色斩击
function slashFx(e){fx.push({k:'slash',x:e.x,y:e.y-4,r:e.r*2,t:.25,T:.25});sparks(e.x,e.y,'#fca5a5',6,160,.25);sfx('slash');}


// ======================= v0.6b：特效 2.0 =======================
// 编排（每一拍什么时候出现、怎么动）借鉴开源项目 pixelfx（MIT，见 THIRD_PARTY.md），画法改成我们的卡通平滑风格；
// 烟雾、光晕、星光贴图来自 Kenney 粒子包（CC0）。网址加 ?off=fx2 可以切回旧特效做对比。
let sched=[],fxClock=0;
function later(d,f){sched.push({t:d,f});}
const FXT={},TINT={};
function fxTexInit(){
  if(typeof Image==='undefined')return;
  for(const k of ['puff','puff2','ring','glow','star','star2','crackle','crackle2','flash','swirl','swirl2']){
    try{const im=new Image();im.onload=()=>{FXT[k]=im;};im.src=(window.RUNE_PNG?window.RUNE_PNG+'fx_':'fx/')+k+'.png';}catch(e){}
  }
}
// 白色贴图染成指定颜色，按颜色缓存
function tinted(k,c){
  const im=FXT[k];if(!im||!im.width)return null;const key=k+c;let t=TINT[key];if(t)return t;
  t=document.createElement('canvas');t.width=im.width;t.height=im.height;const x=t.getContext('2d');
  x.drawImage(im,0,0);x.globalCompositeOperation='source-in';x.fillStyle=c;x.fillRect(0,0,t.width,t.height);TINT[key]=t;return t;
}
const rnd=(a,b)=>a+Math.random()*(b-a);
// 贴图粒子：s0→s1 变大，a0 起始透明度，add=叠加发光
function texP(tex,c,x,y,o){P(Object.assign({k:'tex',tex,c,x,y,vx:0,vy:0,g:0,t:.4,T:.4,s0:10,s1:20,a0:1,rot:Math.random()*6.28,vr:0,add:false},o));}
// 卡通火团：白热→黄→橙→红→烟，外面一圈深色描边（所有火团先统一画描边，再画填充，连成一朵云）
function puff(x,y,o){P(Object.assign({k:'puff',x,y,vx:0,vy:0,g:0,drag:5,t:.7,T:.7,r0:6,r1:14,h0:1},o));}
const HEAT=[[.86,'#fffbe6','#c2410c'],[.6,'#fde047','#b45309'],[.38,'#fb923c','#9a3412'],[.26,'#f05a3a','#7f1d1d'],[0,'#a8a29e','#57534e']];
function puffState(q){const k=1-q.t/q.T,h=q.h0*(1-k*1.15),r=q.r0+(q.r1-q.r0)*(1-(1-k)*(1-k));let i=0;while(i<HEAT.length-1&&h<HEAT[i][0])i++;
  const smokeK=h<.26?Math.min(1,(.26-h)/.2):0;const a=Math.min(1,(1-k)*2.2);return {k,r,fill:HEAT[i][1],line:HEAT[i][2],a,smokeK};}
function puffOutline(q){const st=puffState(q);ctx.globalAlpha=st.a*(1-st.smokeK*.8);ctx.fillStyle=st.line;ctx.beginPath();ctx.arc(q.x,q.y,st.r+1.8,0,7);ctx.fill();}
// 炮弹爆炸：白闪 → 冲击环 → 火团翻滚冷却成烟 → 火星/碎石/余烬 → 烟柱
function fx2Boom(x,y,R,small){
  const n=small?3:9;
  fx.push({k:'dome',x,y,r:R*(small?.55:.85),t:small?.1:.15,T:small?.1:.15});
  texP('glow','#fff7d6',x,y,{s0:R*1.1,s1:R*(small?1.6:2.6),t:.2,T:.2,a0:.9,add:true});
  texP('ring','#fed7aa',x,y,{s0:R*.5,s1:R*(small?1.4:2.5),t:.38,T:.38,a0:.8});
  for(let i=0;i<n;i++){const a=i/n*6.283+rnd(-.3,.3),v=R*rnd(1.8,3),z=small?.65:1,big=i%3===0;
    puff(x+Math.cos(a)*R*.1,y+Math.sin(a)*R*.08,{vx:Math.cos(a)*v,vy:Math.sin(a)*v*.55-R*rnd(.4,1),g:-R*1.6,r0:R*(big?.34:.22)*z,r1:R*(big?.58:rnd(.32,.44))*z,t:rnd(.6,.85),T:.85,h0:rnd(1,1.12)-(big?0:.1),drag:6.5});}
  if(small)return;
  for(let i=0;i<10;i++){const a=-Math.PI*rnd(.1,.9),v=rnd(120,260);P({k:'spark',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,g:520,t:rnd(.3,.5),T:.5,c:i%3?'#fde047':'#fff7d6',r:1.6});}
  for(let i=0;i<4;i++){const a=-Math.PI*rnd(.2,.8),v=rnd(60,130);P({k:'ember',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,g:380,t:rnd(.6,.9),T:.9,c:'#fb923c',r:1.7});}
  later(.12,()=>{for(let i=0;i<3;i++)texP('puff','#a8a29e',x+rnd(-R*.3,R*.3),y-R*.2,{vx:rnd(-10,10),vy:-R*rnd(.6,1),s0:R*.5,s1:R*rnd(1.3,1.8),t:rnd(.8,1.1),T:1.1,a0:.55,vr:rnd(-1,1)});});
}
// 电塔闪电：按跳数依次窜出去，主干 + 一股缠绕的副电弧，每 1/15 秒重新抖动；
// 打到怪身上：一团"电球"跟着怪走 —— 四五道短电弧向外乱窜、电花贴图闪烁、紫色电环扩散、火花四溅；最后一个目标炸得更大
let ZAPLV=0;  // 闪电命中特效：0=收敛版（默认，画面清楚）1=完整版
function fx2Zap(pts,from,tgs){const lite=!ZAPLV;
  const T=.2+pts.length*.03;fx.push({k:'bolt',pts,t:T,T,seed:Math.random()*1e4,hop:.03});
  if(from){texP('glow','#c084fc',from[0],from[1],{s0:16,s1:28,t:.25,T:.25,a0:.9,add:true});texP('crackle','#f5d0fe',from[0],from[1],{s0:20,s1:26,t:.16,T:.16,a0:1,add:true});}
  const n=pts.length-1;
  for(let i=1;i<pts.length;i++){const [x,y]=pts[i],[px,py]=pts[i-1],dir=Math.atan2(y-py,x-px),d=(i-1)*.03,e=tgs&&tgs[i-1],last=i===n,big=last?1.35:1;
    later(d,()=>{
      if(e){if(e.zapFx>fxClock-.18){const ab=fx.find(f=>f.k==='arcball'&&f.e===e);if(ab)ab.t=Math.max(ab.t,ab.T*.7);e.zapT=.35;return;}e.zapFx=fxClock;}
      if(fx.filter(f=>f.k==='arcball').length>=6)return;
      fx.push({k:'arcball',e,x,y,t:(lite?.22:.32)*big,T:(lite?.22:.32)*big,seed:Math.random()*1e4,r:(e?e.r:10)*(lite?1.3:1.9)*big,lite});
      texP('glow','#e9d5ff',x,y,{s0:(lite?22:34)*big,s1:10,t:.22,T:.22,a0:lite?.8:1,add:true});
      if(!lite||last)texP('ring','#c084fc',x,y,{s0:10,s1:46*big,t:.3,T:.3,a0:.9,add:true});
      if(!lite||last)texP('star2','#ffffff',x,y-2,{s0:28*big,s1:8,t:.22,T:.22,a0:1,add:true});
      for(let j=0;j<(lite?(last?8:3):(last?12:8));j++){const a=Math.random()<.6?dir+rnd(-1.1,1.1):Math.random()*6.28,v=rnd(90,240);P({k:'spark',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-30,g:320,t:rnd(.18,.35),T:.35,c:j%3?'#f5d0fe':'#ffffff',r:1.4});}
      if(e)e.zapT=.35;});
    later(T-.02+d*.3,()=>{texP('puff','#c4b5fd',x,y-3,{vy:-14,s0:8,s1:20,t:.5,T:.5,a0:.35});for(let j=0;j<4;j++){const a=Math.random()*6.28;P({k:'spark',x,y,vx:Math.cos(a)*100,vy:Math.sin(a)*100-20,g:200,t:.2,T:.2,c:'#e9d5ff',r:1.1});}});}
}
// 冰塔：一阵旋转的风雪从塔身卷出去 —— 弯弯的风痕绕着塔转圈往外扫，雪花打着旋飘散，冷雾跟着卷开，
// 地上留一层淡淡的霜，中心闪一下星光；被打中的怪身上再炸开一小团霜花
function orbit(cx,cy,o){P(Object.assign({k:'orbit',cx,cy,x:cx,y:cy,vx:0,vy:0,g:0,a:Math.random()*6.28,r:4,w:5,vr:60,sq:.78},o));}
function fx2Frost(x,y,R,nova){
  const dirn=Math.random()<.5?1:-1,base=Math.random()*6.28,m=nova?1.4:1;
  fx.push({k:'frostfloor',x,y,r:R,t:.7,T:.7});
  texP('star','#e0f2fe',x,y-CS*.55,{s0:30,s1:8,t:.28,T:.28,a0:1,add:true,rot:0});
  // 风痕：弯月形贴图沿切线方向，边转边往外扫
  for(let i=0;i<3;i++)orbit(x,y,{tex:i%2?'swirl':'swirl2',c:'#f0f9ff',a:base+i*2.09,r:R*.25,w:dirn*rnd(5,7),vr:R*1.25,t:.55,T:.55,s0:R*.45,s1:R*.95,a0:.85});
  // 雪花：螺旋飘出去，自转，大小不一
  for(let i=0;i<Math.round(18*m);i++)orbit(x,y,{flake:1,a:base+Math.random()*6.28,r:R*rnd(.1,.35),w:dirn*rnd(3,6),vr:R*rnd(.8,1.5),t:rnd(.45,.7),T:.7,s0:rnd(2,3.6),spin:rnd(-6,6),rot:Math.random()*6.28,drop:rnd(6,18)});
  // 冷雾：跟着风卷开
  for(let i=0;i<Math.round(4*m);i++)orbit(x,y,{tex:'puff2',c:'#e0f2fe',a:base+i*1.57,r:R*.2,w:dirn*rnd(2.5,4),vr:R*rnd(.6,.9),t:.65,T:.65,s0:R*.35,s1:R*.85,a0:.46});
}
// 怪被冰塔打中：身上炸开一小团霜花
function frostBloom(e){
  texP('star','#f0f9ff',e.x,e.y-4,{s0:16,s1:6,t:.2,T:.2,a0:1,add:true});
  texP('puff2','#dbeafe',e.x,e.y-2,{s0:e.r*1.2,s1:e.r*2.4,t:.45,T:.45,a0:.45});
  for(let i=0;i<4;i++){const a=Math.random()*6.28;P({k:'snowflake',x:e.x,y:e.y-4,vx:Math.cos(a)*rnd(30,70),vy:Math.sin(a)*rnd(20,50)-15,g:40,drag:2,t:rnd(.4,.6),T:.6,r:rnd(1.8,2.8),rot:Math.random()*6,spin:rnd(-6,6)});}
}
// Boss 倒下：白色光罩 + 全屏白闪 → 大火球翻滚上升成蘑菇云 → 两道冲击环 → 重碎石/火星 → 地上留几处小火慢慢熄灭
function fx2BossDeath(e){
  const x=e.x,y=e.y,R=e.r*2.4;
  fx.push({k:'dome',x,y,r:R*1.3,t:.28,T:.28});fx.push({k:'flash',c:'#fff7ed',t:.22,T:.22});shake=Math.max(shake,9);
  texP('glow','#fff7d6',x,y,{s0:R*1.5,s1:R*4,t:.35,T:.35,a0:1,add:true});
  texP('ring','#fed7aa',x,y,{s0:R*.6,s1:R*3.2,t:.55,T:.55,a0:.85});
  later(.14,()=>texP('ring','#fde68a',x,y,{s0:R*.4,s1:R*2.4,t:.45,T:.45,a0:.7}));
  for(let i=0;i<12;i++){const a=Math.random()*6.283,v=R*rnd(1.4,3);puff(x+Math.cos(a)*R*.2,y+Math.sin(a)*R*.15,{vx:Math.cos(a)*v,vy:Math.sin(a)*v*.5-R*rnd(1.6,3),r0:R*rnd(.22,.34),r1:R*rnd(.45,.65),t:rnd(.8,1.1),T:1.1,h0:rnd(.95,1.08),drag:4});}
  // 蘑菇云：先长出一根火柱，再在顶上铺开一顶"帽子"
  later(.12,()=>{for(let i=0;i<4;i++)puff(x+rnd(-R*.15,R*.15),y-R*(.5+i*.45),{vx:rnd(-8,8),vy:-R*rnd(.8,1.2),g:-R*.6,r0:R*.24,r1:R*rnd(.38,.48),t:rnd(.9,1.1),T:1.1,h0:.72-i*.04,drag:3});});
  later(.25,()=>{for(let i=0;i<8;i++){const a=(i/7-.5)*2;puff(x+a*R*.7,y-R*rnd(2,2.4),{vx:a*R*1.6,vy:-R*rnd(.5,.8),g:-R*.4,r0:R*rnd(.25,.33),r1:R*rnd(.5,.68),t:rnd(.85,1.05),T:1.05,h0:rnd(.5,.6),drag:3});}});
  later(.35,()=>{for(let i=0;i<5;i++)texP('puff','#a8a29e',x+rnd(-R*.4,R*.4),y-R*rnd(.5,1.5),{vx:rnd(-12,12),vy:-R*rnd(.5,.9),s0:R*.8,s1:R*rnd(1.8,2.6),t:rnd(1.3,1.7),T:1.7,a0:.5,vr:rnd(-.8,.8)});});
  for(let i=0;i<22;i++){const a=-Math.PI*rnd(.05,.95),v=rnd(150,330);P({k:'spark',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,g:520,t:rnd(.4,.7),T:.7,c:i%3?'#fde047':'#fff7d6',r:1.8});}
  chunks(x,y,BIOME==='snow'?'#cbd5e1':BIOME==='volcano'?'#3f3f46':'#7c6a4f',12,240,5);
  for(let i=0;i<5;i++){const fx_=x+rnd(-R*1.2,R*1.2),fy=y+rnd(-R*.3,R*.5);for(let k=0;k<9;k++)later(.2+k*.11,()=>flame(fx_,fy,1.1));}
  decal('crater',x,y+6,R*1.2,4,'#1c1917');sfx('boom');later(.18,()=>sfx('boom'));
}

// ======================= 音效 =======================
let AC=null,MG=null,muted=false,lastS={},sndMode='0';
// 声音三档：0 全开 · m 只有音效（关音乐）· 1 全部静音
try{sndMode=localStorage.getItem('td_mute')||'0';}catch(e){}
muted=sndMode==='1';
function audioInit(){if(AC||(typeof AudioContext==='undefined'&&typeof webkitAudioContext==='undefined'))return;try{AC=new (window.AudioContext||window.webkitAudioContext)();MG=AC.createGain();MG.gain.value=muted?0:.55;MG.connect(AC.destination);if(window.RuneMusic){RuneMusic.init(AC);RuneMusic.setEnabled(sndMode==='0');}}catch(e){AC=null;}}
function tone(type,f1,f2,dur,vol,delay){const t0=AC.currentTime+(delay||0),o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f1,t0);o.frequency.exponentialRampToValueAtTime(Math.max(20,f2),t0+dur);g.gain.setValueAtTime(vol,t0);g.gain.exponentialRampToValueAtTime(.0005,t0+dur);o.connect(g);g.connect(MG);o.start(t0);o.stop(t0+dur+.02);}
function noise(dur,vol,ftype,freq,delay){const t0=AC.currentTime+(delay||0),n=Math.floor(AC.sampleRate*dur),b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;const s=AC.createBufferSource();s.buffer=b;const f=AC.createBiquadFilter();f.type=ftype;f.frequency.value=freq;const g=AC.createGain();g.gain.setValueAtTime(vol,t0);g.gain.exponentialRampToValueAtTime(.0005,t0+dur);s.connect(f);f.connect(g);g.connect(MG);s.start(t0);}
const SFX={
  arrow:[.07,()=>{tone('triangle',1100,520,.07,.05);noise(.04,.03,'highpass',3000);}],
  cannon:[.1,()=>{tone('sine',140,45,.18,.18);noise(.08,.06,'lowpass',900);}],
  boom:[.08,()=>{noise(.32,.16,'lowpass',700);tone('sine',90,35,.3,.14);}],
  frost:[.12,()=>{tone('sine',1500,1300,.22,.035);tone('sine',2100,1900,.18,.025,.03);}],
  zap:[.09,()=>{tone('sawtooth',180+Math.random()*120,900,.09,.04);noise(.1,.05,'highpass',2500);}],
  pop:[.05,()=>tone('sine',700,180,.08,.05)],
  leak:[.3,()=>{tone('square',120,80,.32,.07);}],
  wave:[.5,()=>{tone('triangle',392,392,.18,.09);tone('triangle',523,523,.32,.09,.16);}],
  boss:[.5,()=>{tone('sawtooth',196,190,.35,.06);tone('sawtooth',147,140,.6,.07,.3);noise(.5,.05,'lowpass',300,.3);}],
  bossdie:[.5,()=>{noise(.8,.2,'lowpass',500);tone('sine',110,30,.8,.18);}],
  card:[.3,()=>{tone('sine',523,523,.15,.06);tone('sine',659,659,.15,.06,.08);tone('sine',784,784,.25,.06,.16);}],
  build:[.1,()=>{tone('sine',220,110,.12,.12);noise(.06,.05,'lowpass',1200);}],
  up:[.1,()=>{tone('triangle',440,880,.18,.07);tone('triangle',660,1320,.18,.05,.08);}],
  crit:[.09,()=>{tone('square',1320,1760,.06,.035);tone('sine',2640,2640,.08,.03,.03);}],
  slash:[.12,()=>{noise(.14,.09,'bandpass',3200);tone('sawtooth',900,200,.12,.04);}],
  coin:[.12,()=>{tone('square',988,988,.06,.035);tone('square',1319,1319,.12,.035,.06);}],
  squish:[.06,()=>{tone('sine',520,980,.09,.05);tone('sine',1200,1600,.06,.025,.05);}],
  crumble:[.1,()=>{noise(.3,.12,'lowpass',500);tone('sine',120,50,.2,.08);}],
  rain:[.5,()=>{for(let i=0;i<6;i++)noise(.05,.05,'highpass',4000,i*.07);tone('triangle',800,500,.3,.03);}],
  gust:[.5,()=>{noise(.6,.08,'bandpass',900);tone('sine',300,700,.4,.04);}],
  meteor:[.5,()=>{tone('sine',1400,300,.95,.05);noise(.9,.04,'bandpass',1200);}],
  roar:[.5,()=>{noise(.7,.14,'lowpass',700);tone('sawtooth',90,60,.6,.06);}],
  crack:[.5,()=>{noise(.08,.14,'highpass',3000);tone('sine',2400,1800,.3,.05,.02);tone('sine',1800,1200,.4,.04,.08);}],
  chime:[.5,()=>{tone('sine',1047,1047,.6,.05);tone('sine',1568,1568,.6,.04,.1);tone('sine',2093,2093,.7,.03,.2);}],
};
function sfx(n){if(!AC||muted)return;const now=AC.currentTime,s=SFX[n];if(!s)return;if(lastS[n]&&now-lastS[n]<s[0])return;lastS[n]=now;try{s[1]();}catch(e){}}
document.addEventListener('pointerdown',()=>{audioInit();if(AC&&AC.state==='suspended')AC.resume();},{capture:true});
const sndBtn=$('snd');const SNDICON={'0':'🔊','m':'🔉','1':'🔇'};sndBtn.textContent=SNDICON[sndMode]||'🔊';
sndBtn.onclick=()=>{sndMode=sndMode==='0'?'m':sndMode==='m'?'1':'0';muted=sndMode==='1';sndBtn.textContent=SNDICON[sndMode];if(MG)MG.gain.value=muted?0:.55;
  if(window.RuneMusic)RuneMusic.setEnabled(sndMode==='0');txt(W/2,H*.45,{'0':'音乐和音效：开','m':'只有音效（音乐关）','1':'全部静音'}[sndMode],'#e5e7eb',1.2);
  try{localStorage.setItem('td_mute',sndMode);}catch(e){}};
// 背景音乐跟着画面切换：大厅/选图/结算 → 大厅曲；局内 → 当前主题的战斗曲（建造时只有氛围层，开战后鼓和旋律进来）；Boss 战 → Boss 曲
let musT=0;
function musicTick(dt){
  if(!window.RuneMusic||!AC)return;musT-=dt;if(musT>0)return;musT=.25;
  const inRun=MAP&&!['map','win','over'].includes(phase);
  if(!inRun){RuneMusic.want('lobby',0);return;}
  if(curNode==='boss'&&phase==='wave'){RuneMusic.want('boss',1);return;}
  RuneMusic.want(BIOME,phase==='wave'?1:0);
}

// ======================= 介绍卡 / 符文面板 =======================
function infoOf(k){
  if(k.startsWith('afx_')){const a=AFX[k.slice(4)];return{name:'词缀 · '+a.name,desc:a.desc,tip:a.tip,img:''};}
  const i=EINFO[k];return{name:i.name,desc:i.desc,tip:i.tip,img:artURL(k)};
}
function showIntro(){
  const k=introQ.shift();if(!k)return;
  seen.add(k);try{localStorage.setItem('td_seen',JSON.stringify([...seen]));}catch(e){}
  paused=true;const i=infoOf(k);
  const head=k.startsWith('boss')?'Boss 登场':k.startsWith('afx_')?'精英词缀':'新敌人出现';
  ov.innerHTML=`<div class="intro"><div class="sub">${head}</div>${i.img?`<img src="${i.img}" alt="">`:''}<h2>${i.name}</h2><div class="tip">${i.desc}<br><b style="color:#86efac">应对：</b>${i.tip}</div><button class="big" style="max-width:260px;margin-top:16px" id="okIntro">知道了</button></div>`;
  ov.style.display='flex';
  $('okIntro').onclick=()=>{ov.style.display='none';if(introQ.length)showIntro();else paused=false;};
}
function openRunes(){if(phase==='over'||phase==='win'||phase==='map')return;bpOpen=true;paused=true;renderRunes();bp.style.display='flex';}
function closeRunes(){bpOpen=false;bp.style.display='none';paused=!!(ov.style.display==='flex'&&$('okIntro'));}
function renderRunes(){
  const ids=Object.keys(taken);
  let h=`<div class="wrap"><h2>🔮 我的符文（${ids.length}）</h2>`;
  h+=`<div class="sum">下场战斗结束预计收入：过关奖励 <b>+${stepBonus()}</b> 金${M.interest?`，利息 <b>+${interestNow()}</b> 金`:''}<br>暴击率 ${Math.round(M.crit*100)}% · 射程 +${pc(M.rangeMul)}% · 攻速 +${pc(M.allRate)}% · 费用 ${M.costMul<=1?'-':'+'}${Math.abs(Math.round((1-M.costMul)*100))}%${M.allDmg>1?` · 全塔伤害 +${pc(M.allDmg)}%`:''}</div>`;
  const cl=Object.keys(curses);h+=`<div class="sum">地图主题：<b style="color:${BIO.col}">${BIO.icon} ${BIO.name}</b> · ${BIO.desc}</div>`;if(cl.length||DIFF||HERO)h+=`<div class="sum">${HERO?`英雄：${HEROES[HERO.id].icon}${HEROES[HERO.id].name}（被动：${HEROES[HERO.id].passive}）<br>`:''}${DIFF?`难度 ${DIFF}<br>`:''}${cl.length?'诅咒：'+cl.map(k=>`<b style="color:#fca5a5">${CURSES[k].name}</b>（${CURSES[k].desc}）`).join('、'):''}</div>`;
  h+=`<div class="sum">${schoolLine()}<br><span style="color:#9aa3c7">两个流派各有 2 个符文（传说符文也算），就会解锁它们的合体：</span><br>${comboLines()}</div>`;
  if(!ids.length)h+=`<div class="sum" style="text-align:center;color:#9aa3c7">还没有符文。开局和每场战斗结束都能三选一获得。</div>`;
  for(const id of ids){
    const c=findCard(id),n=taken[id];
    const off=c.tag&&!towers.some(t=>t.type===c.tag)?`<div class="off">还没有建造${TT[c.tag].name}，暂未生效</div>`:'';
    const sct=c.r===3?scTag(c.a)+scTag(c.b):scTag(c.school);
    h+=`<div class="rl r${c.r}"><div class="n">${sct}${c.name}${n>1?' ×'+n:''}${c.r>=3?` <span style="font-size:12px;color:${c.r===3?'#67e8f9':'#fda4af'}">${RAR[c.r]}</span>`:''}</div><div class="d">${c.desc}</div><div class="lv">${LIVE[id]?LIVE[id](n):''}</div>${off}</div>`;
  }
  h+=`<button class="close" id="closeRunes">返回</button></div>`;
  bp.innerHTML=h;$('closeRunes').onclick=closeRunes;
}
$('runes').onclick=openRunes;
function schoolLine(){return '<b>流派</b> '+Object.keys(SC).map(k=>`${scTag(k)}${schoolCount(k)}`).join(' ');}
function comboLines(){return COMBOS.map(cb=>{const a=schoolCount(cb.a),b=schoolCount(cb.b);
  const st=has(cb.id)?'<b style="color:#86efac">✓ 已获得</b>':comboReady(cb)?'<b style="color:#67e8f9">已解锁，下次奖励出现</b>':`${SC[cb.a].name} ${Math.min(a,2)}/2 · ${SC[cb.b].name} ${Math.min(b,2)}/2`;
  return `${scTag(cb.a)}${scTag(cb.b)}<b>${cb.name}</b>　${st}`;}).join('<br>');}
function ehpText(e){return e.dead?'已被击败':`生命 ${Math.ceil(Math.max(0,e.hp))}/${Math.ceil(e.max)}${e.shield>0?` · 护盾 ${Math.ceil(e.shield)}`:''}${e.armor?` · 护甲 ${e.armor.toFixed(1)}`:''}`;}

// ======================= 符文卡 =======================
const RAR_W=[80,17,3];
function rollCards(minR){
  const owned=new Set(towers.map(t=>t.type));
  const pool=CARDS.filter(c=>cardUnlocked(c)&&!(c.max&&(taken[c.id]||0)>=c.max));
  const out=[];
  while(out.length<3&&pool.length){
    const avail=[0,1,2].filter(r=>pool.some(c=>c.r===r));let rar;
    const need=minR===3?2:(out.length===0?minR:0);
    const ok=avail.filter(r=>r>=need);
    if(minR===3&&ok.length)rar=2;
    else if(need&&ok.length){let tot=ok.reduce((a,r)=>a+RAR_W[r],0),x=Math.random()*tot;rar=ok.at(-1);for(const r of ok){if(x<RAR_W[r]){rar=r;break;}x-=RAR_W[r];}}
    else{let tot=avail.reduce((a,r)=>a+RAR_W[r],0),x=Math.random()*tot;rar=avail.at(-1);for(const r of avail){if(x<RAR_W[r]){rar=r;break;}x-=RAR_W[r];}}
    const sub=pool.filter(c=>c.r===rar);let tot=0;
    const ws=sub.map(c=>{let w=1;if(c.tag)w*=owned.has(c.tag)?2.2:(towers.length?.45:1);tot+=w;return w;});
    let x=Math.random()*tot,i=0;while(i<ws.length-1&&x>ws[i]){x-=ws[i];i++;}
    const p=sub[i];out.push(p);pool.splice(pool.indexOf(p),1);
  }
  return minR===3?out:out.sort(()=>Math.random()-.5);
}
function rollOffer(minR,chest){
  const out=rollCards(minR);
  if(chest){
    const lg=LEGENDS.filter(l=>!has(l.id)&&towers.some(t=>t.type===l.tag));
    if(lg.length){lg.sort((a,b)=>Math.max(0,...towers.filter(t=>t.type===b.tag).map(t=>t.lvl))-Math.max(0,...towers.filter(t=>t.type===a.tag).map(t=>t.lvl)));const L=Math.random()<.7?lg[0]:pick(lg);const k=out.findIndex(c=>c.r===2);out[k>=0?k:0]=L;}
  }
  const ready=COMBOS.filter(comboReady);
  if(ready.length){const cb=pick(ready);const k=out.findIndex(c=>c.r<2);out[k>=0?k:out.length-1]=cb;}
  return out;
}
function takeCard(c){c.ap();taken[c.id]=(taken[c.id]||0)+1;
  for(const cb of COMBOS)if(comboReady(cb)&&!comboSeen.has(cb.id)){comboSeen.add(cb.id);banner={a:'解锁合体：'+cb.name,b:SC[cb.a].name+' + '+SC[cb.b].name+' · 下次奖励必定出现',boss:false,t:2.4,T:2.4};}}
let offerChest=false;
function offerCards(title,sub,minR,then,chest){
  cardTitle=[title,sub];rerollCost=25;afterPick=then;offerChest=!!chest;pendingCards=rollOffer(minR,chest);showCards(pendingCards,minR);sfx('card');
}
let lastMinR=0;
function snapCards(){snapRun('cards',{ids:pendingCards.map(c=>c.id),title:cardTitle,minR:lastMinR,chest:offerChest,reroll:rerollCost,next:afterPick===offerAltar?'altar':afterPick===offerNodes?'nodes':'cards2'});}
function showCards(cs,minR){
  lastMinR=minR;
  const owned=towers.map(t=>t.type);
  let h=`<h2>${cardTitle[0]}</h2><div class="sub">${cardTitle[1]}</div><div class="cards">`;
  cs.forEach((c,i)=>{
    const lv=taken[c.id]?` (已有 ${taken[c.id]})`:'';
    const tagNote=c.tag&&!owned.includes(c.tag)?`<div class="d" style="color:#94a3b8;font-size:12px">需要建造${TT[c.tag].name}才生效</div>`:'';
    const sct=c.r===3?scTag(c.a)+scTag(c.b):scTag(c.school);
    h+=`<button class="card r${c.r}" data-i="${i}"><span class="r">${RAR[c.r]}</span><div class="n">${sct}${c.name}${lv}</div><div class="d">${c.desc}</div>${tagNote}</button>`;
  });
  h+=`</div><div><button class="reroll" id="rr" ${gold<rerollCost?'disabled':''}>🔄 刷新（${rerollCost} 金）</button> <button class="reroll" id="seeRunes">🔮 我的符文</button></div>`;
  const b=buildSummary();if(b)h+=`<div class="build">${schoolLine()}<br>已有：${b}</div>`;
  ov.innerHTML=h;ov.style.display='flex';
  ov.querySelectorAll('.card').forEach(btn=>btn.onclick=()=>pickCard(+btn.dataset.i));
  $('seeRunes').onclick=openRunes;
  $('rr').onclick=()=>{if(gold<rerollCost)return;gold-=rerollCost;rerollCost+=15;pendingCards=rollOffer(minR,offerChest);showCards(pendingCards,minR);};
  snapCards();
}
function pickCard(i){const c=pendingCards[i];if(!c)return;takeCard(c);ov.style.display='none';pendingCards=[];renderPanel();const f=afterPick;afterPick=null;if(f)f();}
function buildSummary(){return Object.keys(taken).map(id=>{const c=findCard(id);return c.name+(taken[id]>1?'×'+taken[id]:'');}).join('、');}

// ======================= v0.3：英雄 =======================
let HERO=null,zones=[],meteors=[],curses={};
function unitHP(){return ET.norm.hp*hpScale(Math.max(1,step))*(MAP.hpMul||1)*diffHpMul();}
function diffHpMul(){return (D(1)?1.1:1)*(D(8)?1.15:1);}
function heroInit(){
  zones=[];meteors=[];HERO=null;
  if(!FEAT.hero)return;
  const id=heroOK(META.hero)?META.hero:'wind';
  HERO={id,cd:[0,0],hasteT:0,wallT:0,auto:META.auto!==false};
  if(id==='wind')M.arrowRate+=.1;
  if(id==='fire')M.cannonDmg+=.1;
  if(id==='ice')M.frostSlow+=.1;
}
function cluster(R){let best=null,bn=0;const R2=R*R,pt=e=>e.d/PATHS[e.pi].tot;
  for(const e of enemies){if(e.dead)continue;let n=0;for(const o of enemies)if(!o.dead&&(o.x-e.x)**2+(o.y-e.y)**2<=R2)n+=o.boss?3:1;
    if(n>bn||(n===bn&&best&&pt(e)>pt(best))){bn=n;best=e;}}
  return best?{x:best.x,y:best.y,n:bn}:null;}
function heroHit(e,d){hit(e,e.boss?d*.35:d,undefined,{noCrit:true,ap:true});}
function heroCast(i){
  if(!HERO||phase!=='wave'||HERO.cd[i]>0)return false;
  const H=HEROES[HERO.id],u=unitHP();let ok=true;
  if(HERO.id==='wind'&&i===0){const c=cluster(1.5*CS);if(!c)return false;zones.push({k:'rain',x:c.x,y:c.y,r:1.5*CS,t:3,T:3,dps:u*.25});sfx('rain');}
  else if(HERO.id==='wind'&&i===1){HERO.hasteT=5;for(const t of towers){burst(t.x,t.y,'#86efac',6,70,-40,.5,1.8);fx.push({k:'ring',x:t.x,y:t.y,r:CS*.8,t:.4,T:.4,c:'#86efac'});}sfx('gust');}
  else if(HERO.id==='fire'&&i===0){const c=cluster(1.6*CS);if(!c)return false;meteors.push({x:c.x,y:c.y,t:1,T:1,r:1.6*CS,dmg:u*.7});sfx('meteor');}
  else if(HERO.id==='fire'&&i===1){if(!enemies.some(e=>!e.dead))return false;for(const e of enemies)if(!e.dead){burnOn(e,u*(e.boss?.03:.07),4);for(let k=0;k<6;k++)flame(e.x,e.y,1.5);decal('scorch',e.x,e.y+4,e.r*1.2,2);}fx.push({k:'flash',t:.3,T:.3,c:'#fb923c'});sfx('roar');}
  else if(HERO.id==='ice'&&i===0){if(!enemies.some(e=>!e.dead))return false;for(const e of enemies)if(!e.dead){e.frzT=Math.max(e.frzT,e.boss?.8:2.5);shards(e.x,e.y,5,'#e0f2fe',110);decal('frost',e.x,e.y+4,e.r*1.4,2.5);}fx.push({k:'flash',t:.35,T:.35,c:'#bae6fd'});sfx('crack');}
  else if(HERO.id==='ice'&&i===1){HERO.wallT=8;sfx('chime');}
  else ok=false;
  if(ok){HERO.cd[i]=H.sk[i].cd;txt(W/2,H_TXT_Y-i*22,H.sk[i].name+'！',H.col,1);}
  return ok;
}
const H_TXT_Y=H*.42;
function heroAutoWant(i){
  const live=enemies.filter(e=>!e.dead);if(!live.length)return false;
  const boss=live.some(e=>e.boss),near=f=>live.some(e=>e.d/PATHS[e.pi].tot>f);
  const id=HERO.id;
  if(i===0&&id!=='ice'){const c=cluster((id==='wind'?1.5:1.6)*CS);return !!c&&(c.n>=4||boss||near(.7));}
  if(id==='wind')return live.length>=8||boss||near(.75);
  if(id==='fire')return live.length>=6||boss;
  if(i===0)return near(.75)||(boss&&near(.5))||live.length>=12;
  return near(.85)&&live.length>=3;
}
function updHero(dt){
  if(!HERO)return;
  for(let i=0;i<2;i++)if(HERO.cd[i]>0)HERO.cd[i]=Math.max(0,HERO.cd[i]-dt);
  if(HERO.hasteT>0)HERO.hasteT-=dt;if(HERO.wallT>0)HERO.wallT-=dt;
  if(HERO.auto)for(let i=0;i<2;i++)if(HERO.cd[i]<=0&&heroAutoWant(i))heroCast(i);
  for(const z of zones){z.t-=dt;for(const e of enemies)if(!e.dead&&(e.x-z.x)**2+(e.y-z.y)**2<=z.r*z.r)heroHit(e,z.dps*dt);
    if(Math.random()<dt*45){const tx=z.x+(Math.random()-.5)*z.r*1.6,ty=z.y+(Math.random()-.5)*z.r;P({k:'arrowfall',x:tx+24,y:ty-70,vx:-120,vy:340,g:0,t:.2,T:.2,c:'#e7e2d6',r:1});if(Math.random()<.4)smoke(tx,ty,1,2.5,'#d6d3d1',-10);}}
  zones=zones.filter(z=>z.t>0);
  for(const m of meteors){m.t-=dt;if(m.t>0){const k=1-m.t/m.T;flame(m.x+40*(1-k)+6,m.y-160*(1-k)-8,1.6);}if(m.t<=0){fx.push({k:'core',x:m.x,y:m.y,r:m.r*.6,t:.12,T:.12});chunks(m.x,m.y,BIOME==='snow'?'#cbd5e1':'#44403c',12,200,3.6);smoke(m.x,m.y,4,6,'#78716c');decal('crater',m.x,m.y+4,m.r*.55,3);fx.push({k:'boom',x:m.x,y:m.y,r:m.r,t:.45,T:.45,c:'#f97316'});fx.push({k:'ring',x:m.x,y:m.y,r:m.r*1.2,t:.4,T:.4,c:'#fde68a'});burst(m.x,m.y,'#fb923c',26,170,220,.6,2.6);shake=Math.max(shake,6);sfx('boom');
    for(const e of enemies)if(!e.dead&&(e.x-m.x)**2+(e.y-m.y)**2<=m.r*m.r){heroHit(e,m.dmg);if(!e.dead)burnOn(e,m.dmg*.06,3);}}}
  meteors=meteors.filter(m=>m.t>0);
}
function drawHero(){
  for(const z of zones){const a=Math.min(1,z.t/.4);ctx.globalAlpha=.18*a;ctx.fillStyle='#e2e8f0';ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,7);ctx.fill();ctx.globalAlpha=.5*a;ctx.strokeStyle='#f1f5f9';ctx.lineWidth=1.5;ctx.setLineDash([4,5]);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;}
  for(const m of meteors){const k=1-m.t/m.T;ctx.globalAlpha=.25+.35*k;ctx.strokeStyle='#f97316';ctx.lineWidth=2;ctx.beginPath();ctx.arc(m.x,m.y,m.r*(1.2-.2*k),0,7);ctx.stroke();ctx.globalAlpha=1;
    const y=m.y-160*(1-k);ctx.fillStyle='#fdba74';ctx.beginPath();ctx.arc(m.x+40*(1-k),y,7+5*k,0,7);ctx.fill();ctx.fillStyle='rgba(251,146,60,.5)';ctx.beginPath();ctx.arc(m.x+40*(1-k)+8,y-12,5,0,7);ctx.fill();}
  if(HERO&&HERO.wallT>0){const g=clampPt(PATHS[0].PP[PATHS[0].PP.length-1]),tt=performance.now()/1000;ctx.save();ctx.translate(g.x,g.y);ctx.rotate(tt*.4);ctx.globalAlpha=.25+.12*Math.sin(tt*6);ctx.fillStyle='#bae6fd';ctx.strokeStyle='#e0f2fe';ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<6;i++){const a=i*1.047;ctx.lineTo(Math.cos(a)*30,Math.sin(a)*30);}ctx.closePath();ctx.fill();ctx.globalAlpha=.8;ctx.stroke();ctx.restore();ctx.globalAlpha=1;}
}
// 英雄按钮放在地图角落：自动挑一个挡住可建塔格子最少、又不挡入口和城门的角落（1 列 × 3 行）
let heroSpot=null;
function pickHeroSpot(){
  const ends=new Set();for(const P of PATHS){for(const pt of [P.PP[0],P.PP[P.PP.length-1]]){const g=clampPt(pt);ends.add(Math.floor(g.x/CS)+','+Math.floor(g.y/CS));}}
  let best=null,bs=1e9;
  for(const c of [COLS-1,0])for(const r0 of [ROWS-3,0]){let sc=0;
    for(let r=r0;r<r0+3;r++){const k=c+','+r;if(ends.has(k))sc+=100;else if(pathSet.has(k))sc+=1;else if(tiles[k]==='highland')sc+=6;else if(!tiles[k])sc+=4;}
    if(c===COLS-1&&r0===ROWS-3)sc-=.5;
    if(sc<bs){bs=sc;best={c,r:r0};}}
  heroSpot=best;
}
function renderHeroFloat(){
  const el=$('hfloat');if(!el)return;
  const show=HERO&&(phase==='build'||phase==='wave');
  if(!show){el.style.display='none';return;}
  if(!heroSpot)pickHeroSpot();
  Object.assign(el.style,{display:'flex',left:(heroSpot.c/COLS*100)+'%',top:(heroSpot.r/ROWS*100)+'%',width:(100/COLS)+'%',height:(300/ROWS)+'%'});
  const HH=HEROES[HERO.id];
  el.innerHTML=HH.sk.map((s,i)=>`<button id="hs${i}" data-hs="${i}" title="${s.name}：${s.desc}"><span class="ic">${s.icon}</span><span class="cd" id="hsc${i}"></span></button>`).join('')+`<button id="hauto" class="ha${HERO.auto?' on':''}">${HERO.auto?'自动':'手动'}</button>`;
}
$('hfloat').addEventListener('click',ev=>{
  const b=ev.target.closest('button');if(!b||b.disabled||!HERO)return;
  if(b.dataset.hs){heroCast(+b.dataset.hs);syncHero();return;}
  if(b.id==='hauto'){HERO.auto=!HERO.auto;META.auto=HERO.auto;saveMeta();txt(W/2,H*.42,HERO.auto?'英雄技能：自动释放':'英雄技能：手动释放','#e5e7eb',1.2);renderHeroFloat();syncHero();}
});
function heroBar(){
  if(!HERO||!(phase==='build'||phase==='wave'))return'';
  const H=HEROES[HERO.id];
  return `<div class="hbar"><span class="hn" style="color:${H.col}">${H.icon}${H.name}</span>`+H.sk.map((s,i)=>`<button class="hs" id="hs${i}" data-hs="${i}">${s.icon} ${s.name}<small id="hsc${i}"></small></button>`).join('')+`<button class="hs ha${HERO.auto?' on':''}" id="hauto">自动 ${HERO.auto?'开':'关'}</button></div>`;
}
function syncHero(){
  if(!HERO)return;
  for(let i=0;i<2;i++){const b=$('hs'+i);if(!b)continue;const cd=HERO.cd[i];b.disabled=phase!=='wave'||cd>0;if(b.classList)b.classList.toggle('ready',phase==='wave'&&cd<=0);const s=$('hsc'+i);if(s)s.textContent=cd>0?Math.ceil(cd)+'s':phase==='wave'?'就绪':'';}
}

// ======================= v0.3：诅咒祭坛 =======================
const curseOn=k=>!!curses[k];
function altarAvailable(){return FEAT.curse&&owns('altar')&&step<MAXS;}
function offerAltar(saved){
  phase='altar';
  const pool=shuffleA(Object.keys(CURSES).filter(k=>!curses[k]));const n=owns('fate')||!FEAT.meta?3:2;const offers=(Array.isArray(saved)&&saved.length)?saved:pool.slice(0,n);snapRun('altar',{offers});
  let h=`<h2>🌙 诅咒祭坛</h2><div class="sub">接受一个诅咒（持续到本局结束），换取强力奖励。也可以拒绝。</div><div class="cards">`;
  offers.forEach(k=>{const c=CURSES[k];h+=`<button class="card curse" data-k="${k}"><div class="n">${c.name}</div><div class="d"><span style="color:#fca5a5">诅咒：${c.desc}</span><br><span style="color:#86efac">获得：${c.boon}</span></div></button>`;});
  h+=`</div><div><button class="reroll" id="altarNo">拒绝，离开祭坛</button> <button class="reroll" id="seeRunes">🔮 我的符文</button></div>`;
  ov.innerHTML=h;ov.style.display='flex';
  ov.querySelectorAll('.card').forEach(b=>b.onclick=()=>takeCurse(b.dataset.k));
  $('altarNo').onclick=()=>{ov.style.display='none';offerNodes();};$('seeRunes').onclick=openRunes;
}
function takeCurse(k){
  curses[k]=true;ov.style.display='none';sfx('boss');
  banner={a:'诅咒：'+CURSES[k].name,b:CURSES[k].desc,boss:true,t:2.2,T:2.2};
  const done=offerNodes;
  if(k==='rush'){const lg=LEGENDS.filter(l=>!has(l.id));if(lg.length){cardTitle=['诅咒的馈赠','传说符文三选一'];rerollCost=25;afterPick=done;offerChest=false;pendingCards=shuffleA(lg).slice(0,3);showCards(pendingCards,2);}else offerCards('诅咒的馈赠','史诗符文三选一',2,done);return;}
  if(k==='tax'){gold+=250;}
  if(k==='armor'){for(const t of towers)if(t.lvl<4){t.lvl++;if(t.lvl===3&&!t.branch)t.branch=BRANCH[t.type][Math.random()<.5?0:1][0];burst(t.x,t.y,'#fde047',10,90,-40,.6,2);}}
  if(k==='blood'){lives=Math.max(1,lives-10);offerCards('诅咒的馈赠','史诗符文三选一（第 1 次，共 2 次）',2,()=>offerCards('诅咒的馈赠','稀有以上符文三选一（第 2 次，共 2 次）',1,done));return;}
  if(k==='elites'){offerCards('诅咒的馈赠','稀有以上符文三选一',1,done);return;}
  if(k==='brittle'){M.allDmg*=1.15;}
  if(k==='pricey'){M.costMul*=1.15;M.rangeMul+=.15;gold+=150;}
  renderPanel();done();
}

// ======================= v0.3：大厅 / 工匠 =======================
function runShards(win){
  const cleared=win?MAXS:Math.max(0,step-1);
  const base=2*cleared+3*stats.eliteWins+8*stats.bossWins+(win?15:0);
  return Math.round(base*(1+.15*DIFF));
}
function showLobby(){
  if(!FEAT.meta){showMapSelect();return;}
  phase='map';sel=null;renderPanel();
  let best=0;try{best=+localStorage.getItem('td_best2')||0;}catch(e){}
  let h=`<h2>符文塔防 ${VERSION}</h2><div class="sub">💎 符文碎片 <b style="color:#a5f3fc">${META.shards}</b>${best?` · 最佳纪录 第 ${best} 站`:''}${META.wins?` · 通关 ${META.wins} 次`:''}</div><div class="wrap">`;
  if(FEAT.hero){
    h+=`<div class="lsec">英雄</div><div class="hrow">`;
    for(const k in HEROES){const H=HEROES[k],ok=heroOK(k);
      h+=`<button class="card hero${META.hero===k&&ok?' on':''}" data-h="${k}" ${ok?'':'disabled'}><div class="n">${H.icon} ${H.name}</div><div class="d">${ok?`被动：${H.passive}<br>${H.sk.map(s=>`${s.icon}${s.name}：${s.desc}`).join('<br>')}`:'在「英雄殿」解锁'}</div></button>`;}
    h+=`</div>`;
  }
  if(META.unlockedDiff>0){
    h+=`<div class="lsec">难度</div><div>`;for(let d=0;d<=META.unlockedDiff;d++)h+=`<button class="chip dchip${META.diff===d?' on':''}" data-d="${d}">${d}</button>`;h+=`</div>`;
    h+=`<div class="hint" style="text-align:left">${META.diff?DIFFS.slice(1,META.diff+1).map((s,i)=>`${i+1}. ${s}`).join('<br>')+`<br><b style="color:#a5f3fc">符文碎片 +${META.diff*15}%</b>`:'难度 0：标准难度。打通当前最高难度会解锁下一级。'}</div>`;
  }else h+=`<div class="hint" style="text-align:left">打通一次后解锁「难度 1」，每升一级敌人更强，符文碎片也更多。</div>`;
  h+=`</div>${continueBlock()}<button class="big" style="max-width:420px;margin-top:14px" id="lgo">⚔️ ${savedRun()?'开始新的一局（会放弃上一局）':'开始冒险'}</button>
  <div><button class="reroll" id="lart" style="margin-top:10px">🔨 工匠铺（用碎片解锁内容）</button> <button class="reroll" id="lhelp" style="margin-top:10px">📖 玩法说明</button></div>`;
  ov.innerHTML=h;ov.style.display='flex';
  ov.querySelectorAll('.card.hero').forEach(b=>b.onclick=()=>{if(b.disabled)return;META.hero=b.dataset.h;saveMeta();showLobby();});
  ov.querySelectorAll('.dchip').forEach(b=>b.onclick=()=>{META.diff=+b.dataset.d;saveMeta();showLobby();});
  $('lgo').onclick=()=>{ov.style.display='none';showMapSelect();};
  $('lart').onclick=showArtisans;$('lhelp').onclick=()=>showTutorial(showLobby);if($('lcont'))$('lcont').onclick=()=>{ov.style.display='none';resumeRun();};
}
function showArtisans(){
  let h=`<h2>🔨 工匠铺</h2><div class="sub">💎 符文碎片 <b style="color:#a5f3fc">${META.shards}</b> · 每局结束按打到的站数、精英和 Boss 获得碎片</div><div class="wrap">`;
  for(const a of ARTISANS){
    h+=`<div class="lsec">${a.icon} ${a.name} <span style="font-weight:400;color:#9aa3c7;font-size:12.5px">${a.desc}</span></div>`;
    for(const it of a.items){const have=!!META.owned[it.id],reqOk=!it.req||META.owned[it.req];
      h+=`<div class="rl art"><div style="flex:1"><div class="n">${it.name}</div><div class="d">${it.desc}${!reqOk?'（需要先解锁前一级）':''}</div></div>${have?'<span class="own">已拥有</span>':`<button class="buy" data-it="${it.id}" ${META.shards>=it.cost&&reqOk?'':'disabled'}>💎 ${it.cost}</button>`}</div>`;}
  }
  h+=`</div><button class="close" id="artBack">返回大厅</button>`;
  ov.innerHTML=h;ov.style.display='flex';
  ov.querySelectorAll('.buy').forEach(b=>b.onclick=()=>{const it=ARTISANS.flatMap(a=>a.items).find(x=>x.id===b.dataset.it);if(!it||META.owned[it.id]||META.shards<it.cost)return;META.shards-=it.cost;META.owned[it.id]=true;saveMeta();sfx('up');showArtisans();});
  $('artBack').onclick=showLobby;
}

// ======================= v0.5a：中途存档 =======================
// 在这些时刻存档：建造阶段（每次操作后）、战斗结束的奖励界面（连同给出的三张符文）、精英奖励、诅咒祭坛、选下一站。
// 战斗进行中不存：中途退出会回到这一站开打之前。一局结束自动清除。
let runStage=null,loading=false;
function snapRun(stage,extra){
  if(loading||!MAP||phase==='map'||phase==='win'||phase==='over')return;
  const s={v:1,stage,extra:extra||{},MAPI,BIOME,step,curNode,gold,lives,DIFF,
    towers:towers.map(t=>({type:t.type,lvl:t.lvl,c:t.c,r:t.r,branch:t.branch||null,spent:t.spent,shots:t.shots||0,ang:t.ang||0})),
    taken,M,tiles,tcards,curses,stats,comboSeen:[...comboSeen],hero:HERO?{id:HERO.id,auto:HERO.auto}:null,guide:GUIDE};
  runStage=stage;
  try{localStorage.setItem('td_run',JSON.stringify(s));}catch(e){}
}
function clearRun(){runStage=null;try{localStorage.removeItem('td_run');}catch(e){}}
function savedRun(){try{const s=JSON.parse(localStorage.getItem('td_run')||'null');return s&&s.v===1&&MAPS[s.MAPI]?s:null;}catch(e){return null;}}
function resumeRun(){
  const s=savedRun();if(!s){showLobby();return;}
  loading=true;
  resetRun(s.MAPI,s.BIOME);ov.style.display='none';banner=null;
  step=s.step;curNode=s.curNode;gold=s.gold;lives=s.lives;DIFF=s.DIFF||0;
  taken=s.taken||{};M=s.M;tiles=s.tiles||tiles;tcards=s.tcards||tcards;curses=s.curses||{};stats=Object.assign(stats,s.stats||{});comboSeen=new Set(s.comboSeen||[]);
  towers=[];grid={};for(const o of s.towers){const t={...o,x:(o.c+.5)*CS,y:(o.r+.5)*CS,cd:0};towers.push(t);grid[o.c+','+o.r]=t;}
  if(s.hero&&FEAT.hero&&HEROES[s.hero.id])HERO={id:s.hero.id,cd:[0,0],hasteT:0,wallT:0,auto:s.hero.auto!==false};
  GUIDE=s.guide||0;
  buildBG();loading=false;
  const x=s.extra||{};
  if(s.stage==='build'){phase='build';renderPanel();txt(W/2,H*.4,'已从存档继续','#a5f3fc',1.6);}
  else if(s.stage==='cards'){phase='reward';cardTitle=x.title||['继续',''];rerollCost=x.reroll||25;offerChest=!!x.chest;
    afterPick=x.next==='altar'?offerAltar:x.next==='cards2'?(()=>offerCards('诅咒的馈赠','稀有以上符文三选一（第 2 次，共 2 次）',1,offerNodes)):offerNodes;
    pendingCards=(x.ids||[]).map(findCard).filter(Boolean);if(!pendingCards.length)pendingCards=rollOffer(x.minR||0,offerChest);
    renderPanel();showCards(pendingCards,x.minR||0);}
  else if(s.stage==='elitepick'){renderPanel();offerEliteReward(x.sub||'');}
  else if(s.stage==='tilepick'){renderPanel();eliteTile();}
  else if(s.stage==='altar'){renderPanel();offerAltar(x.offers);}
  else {renderPanel();offerNodes();}
}
function continueBlock(){
  const s=savedRun();if(!s)return'';
  const m=MAPS[s.MAPI],B=BIOMES[s.BIOME]||BIOMES.grass;
  return `<button class="big" id="lcont" style="max-width:420px;margin-top:10px;background:linear-gradient(90deg,#0e7490,#0891b2)">▶ 继续上一局<br><span style="font-size:13px;font-weight:400">${mapTitle(m)} · ${B.icon}${B.name} · 第 ${Math.max(1,s.step)} 站 · ❤️ ${s.lives}</span></button>`;
}

// ======================= v0.5a：手把手新手引导 =======================
// 只在第一次玩的第一局出现。步骤：选符文 → 选站 → 点空地 → 建箭塔 → 开始 → 战斗说明 → 三选一 → 升级塔 → 完成
let GUIDE=0,guideCell=null,firstRunPending=false;
const GTXT={
  1:'👋 欢迎！先选一个符文——它会让某种塔变强。',
  2:'选择下一站。第一站是普通战斗。',
  3:'👇 点地图上闪烁的那块空地，准备在那里建塔。',
  4:'👇 点下面的「箭塔」把它建起来（50 金）。',
  5:()=>`很好！你还有 ${Math.floor(gold)} 金，再建一两座塔会更稳（点别的空地）。准备好了就点「开始」。`,
  6:'敌人沿着路走向城门，漏过去一个扣 1 条命 ❤️。塔会自动攻击，地图角落是英雄技能（默认自动释放）。',
  7:'每打完一站，从三个符文里选一个，围绕你的塔叠出流派。',
  8:'👇 点你已经建好的塔，可以升级或出售。',
  9:'升级让塔更强；升到 3 级时还能选分支。引导结束，祝你守住城门！',
};
function guideOn(){return GUIDE>0&&GUIDE<10;}
function guideStart(){GUIDE=1;guideCell=null;setTimeout(guideRender,0);}
function guideSet(n){if(GUIDE>=n||!guideOn())return;GUIDE=n;guideRender();}
function guideEnd(){GUIDE=10;seen.add('guide');try{localStorage.setItem('td_seen',JSON.stringify([...seen]));}catch(e){}guideRender();}
function guideCellPick(){
  let best=null,bs=-1;
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const k=c+','+r;if(pathSet.has(k)||tiles[k]||grid[k])continue;
    let n=0;for(let dc=-1;dc<=1;dc++)for(let dr=-1;dr<=1;dr++)if(pathSet.has((c+dc)+','+(r+dr)))n++;
    const sc=n*10-r*.3;if(sc>bs){bs=sc;best={c,r};}}
  return best;
}
function guideRender(){
  const g=$('guide');if(!g)return;
  document.querySelectorAll('.gpulse').forEach(e=>e.classList.remove('gpulse'));
  if(!guideOn()){g.style.display='none';return;}
  const gt=GTXT[GUIDE];g.innerHTML=`${typeof gt==='function'?gt():gt||''} <button id="gskip">跳过引导</button>`;g.style.display='block';
  $('gskip').onclick=guideEnd;
  const tgt=GUIDE===4?document.querySelector('button[data-b="arrow"]'):GUIDE===5?$('go'):null;
  if(tgt)tgt.classList.add('gpulse');
  if(GUIDE===5){const ab=document.querySelector('button[data-b="arrow"]');if(ab)ab.classList.add('gpulse');}
}
// 每次面板刷新时推进引导
function guideTick(){
  if(!guideOn())return;
  if(GUIDE<=2&&phase==='build')guideSet(3);
  if(GUIDE===3&&phase==='build'){if(!guideCell||grid[guideCell.c+','+guideCell.r])guideCell=guideCellPick();
    if(sel&&!sel.enemy&&!grid[sel.c+','+sel.r]&&!pathSet.has(sel.c+','+sel.r)&&!tiles[sel.c+','+sel.r])guideSet(4);}
  if(GUIDE===4&&towers.length)guideSet(5);
  if(GUIDE===4&&(!sel||sel.enemy))GUIDE=3;
  if(GUIDE<=5&&phase==='wave')guideSet(6);
  if(GUIDE===6&&phase==='reward')guideSet(7);
  if(GUIDE===7&&phase==='build'&&step>=2)guideSet(8);
  if(GUIDE===8&&sel&&!sel.enemy&&grid[sel.c+','+sel.r])guideSet(9);
  if((GUIDE===8||GUIDE===9)&&phase==='wave')guideEnd();
  guideRender();
}
function drawGuide(){
  if(!guideOn())return;
  const k=performance.now()/1000,a=.5+.5*Math.sin(k*6);
  const cells=GUIDE===3&&guideCell?[guideCell]:GUIDE===8?towers.map(t=>({c:t.c,r:t.r})):[];
  for(const c of cells){ctx.strokeStyle=`rgba(253,224,71,${.5+.5*a})`;ctx.lineWidth=3;ctx.strokeRect(c.c*CS+2,c.r*CS+2,CS-4,CS-4);
    ctx.fillStyle=`rgba(253,224,71,${.15+.15*a})`;ctx.fillRect(c.c*CS+2,c.r*CS+2,CS-4,CS-4);
    ctx.fillStyle='#fde047';ctx.font='bold 20px sans-serif';ctx.fillText('👇',(c.c+.5)*CS,c.r*CS-8-6*a);}
}

// ======================= 开局 / 结局 =======================
let mapOffersCur=[];
function shuffleA(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function rollMapOffers(){
  const first=!seen.has('run1');let last='';try{last=localStorage.getItem('td_lastmap')||'';}catch(e){}
  const types=shuffleA(Object.keys(MAPTYPES).filter(t=>t!=='tutorial'&&POOL.some(m=>m.type===t))).slice(0,first?2:3);
  const offers=types.map(t=>{let ids=MAPS.map((m,i)=>i).filter(i=>MAPS[i].type===t&&MAPS[i].id!==last);return pick(ids);});
  if(first||!offers.length)offers.unshift(0);
  return offers;
}
function showMapSelect(reroll){
  phase='map';sel=null;renderPanel();
  if(!reroll||!mapOffersCur.length){mapOffersCur=rollMapOffers();mapBiomesCur=null;}
  if(!mapBiomesCur||mapBiomesCur.length!==mapOffersCur.length)mapBiomesCur=mapOffersCur.map((i,n)=>MAPS[i].type==='tutorial'?'grass':null);
  {const need=mapBiomesCur.filter(b=>!b).length,rb=rollBiomes(need);let q=0;mapBiomesCur=mapBiomesCur.map(b=>b||rb[q++]);}
  let best=0;try{best=+localStorage.getItem('td_best2')||0;}catch(e){}
  let h=`<h2>符文塔防 ${VERSION}</h2><div class="sub">选择这一局的地图${best?` · 最佳纪录：第 ${best} 站`:''}</div><div class="cards">`;
  mapOffersCur.forEach((i,n)=>{const m=MAPS[i],T=MAPTYPES[m.type],bi=mapBiomesCur[n],B=BIOMES[bi];h+=`<button class="card map" data-i="${i}" data-bi="${bi}">${mapSVG(m,bi)}<div><div class="n">${mapTitle(m)} <span style="font-size:13px;color:#fbbf24">${'★'.repeat(m.stars||1)}${'☆'.repeat(3-(m.stars||1))}</span></div><div class="d"><b style="color:${B.col}">${B.icon} ${B.name}</b>${bi!=='grass'?'：'+B.desc:''}<br>${T.desc}${m.type==='tutorial'&&!seen.has('run1')?'<br><b style="color:#86efac">第一次玩推荐</b>':''}</div></div></button>`;});
  h+=`</div>${FEAT.meta?'':continueBlock()}<div><button class="reroll" id="mapReroll">🎲 换一批地图</button>${FEAT.meta?' <button class="reroll" id="mapBack">返回大厅</button>':''}</div><div class="tip"><b>地形</b>　<span class="tag" style="background:#86c46a">高地</span>塔射程 +1 格　<span class="tag" style="background:#818cf8">符文井</span>周围的塔伤害 +20%　<span class="tag" style="background:#a3b18a">沼泽</span>敌人减速 30%　<span class="tag" style="background:#7cc0ea">冰面</span>敌人加速 30%　<span class="tag" style="background:#f97316">岩浆</span>不能建塔<br><span style="color:#9aa3c7">图库共 ${POOL.length} 张地图，每局随机抽取；星级越多越难。</span></div>`;
  ov.innerHTML=h;ov.style.display='flex';
  ov.querySelectorAll('.card').forEach(b=>b.onclick=()=>{ov.style.display='none';const i=+b.dataset.i;
    seen.add('run1');try{localStorage.setItem('td_seen',JSON.stringify([...seen]));localStorage.setItem('td_lastmap',MAPS[i].id);}catch(e){}
    const bi=b.dataset.bi;firstRunPending=!seen.has('tut');seen.add('tut');try{localStorage.setItem('td_seen',JSON.stringify([...seen]));}catch(e){}clearRun();resetRun(i,bi);});
  $('mapReroll').onclick=()=>{mapOffersCur=rollMapOffers();mapBiomesCur=null;showMapSelect(true);};
  if($('mapBack'))$('mapBack').onclick=showLobby;
  if($('lcont'))$('lcont').onclick=()=>{ov.style.display='none';resumeRun();};
}
function showTutorial(then){
  seen.add('tut');try{localStorage.setItem('td_seen',JSON.stringify([...seen]));}catch(e){}
  ov.innerHTML=`<h2>怎么玩</h2><div class="tip" style="max-width:400px">
  1. 点空地建塔，点塔可以升级或出售。战斗中也能建。<br>
  2. 一局 15 站、分 3 幕，每幕第 5 站是 Boss。<br>
  3. 每站都是一场战斗。打完选下一站：普通战斗稳一点；精英战斗风险大，奖励更好（稀有符文或地形卡）。打败 Boss 会回复 5 条命。<br>
  4. 每场战斗打完三选一<b>符文</b>，围绕一两种塔叠出流派。右上角 🔮 随时查看。<br>
  5. 符文分风、火、冰、雷、金五个流派，两个流派各凑 2 个会解锁「合体」；塔升到 3 级时选分支，满级再拿到传说符文就能进化。<br>
  6. 英雄的两个技能在面板最上面，默认「自动」释放；关掉自动可以自己掌握时机。<br>
  7. 每局结束得到「符文碎片」，回大厅在工匠铺解锁新符文、英雄和诅咒祭坛。<br>
  8. 地图有草原、雪原、火山三种主题：雪原的敌人怕火、火山的敌人怕冰，选地图时就能看到。<br>
  9. 看不懂的东西就点它：敌人、地块都有说明。</div>
  <button class="big" style="max-width:260px;margin-top:16px" id="tutok">知道了</button>`;
  ov.style.display='flex';$('tutok').onclick=()=>{ov.style.display='none';then();};
}
function endGame(win){
  clearRun();if(guideOn())guideEnd();
  phase=win?'win':'over';sel=null;bpOpen=false;bp.style.display='none';paused=false;
  let best=0;try{best=+localStorage.getItem('td_best2')||0;if(step>best)localStorage.setItem('td_best2',step);}catch(e){}
  let shardLine='';
  if(FEAT.meta){const sh=runShards(win);META.shards+=sh;META.runs++;let un='';if(win){META.wins++;if(DIFF>=META.unlockedDiff&&META.unlockedDiff<10){META.unlockedDiff=DIFF+1;META.diff=DIFF+1;un=`<br><b style="color:#fde68a">解锁难度 ${DIFF+1}！</b>`;}}saveMeta();
    shardLine=`<div class="sum" style="text-align:center">💎 获得符文碎片 <b style="color:#a5f3fc">+${sh}</b>（共 ${META.shards}）${DIFF?` · 难度 ${DIFF} 加成 +${DIFF*15}%`:''}${un}</div>`;}
  ov.innerHTML=`<h2>${win?'🏆 守住了！':'💥 城门失守'}</h2>
  <div class="sub">地图：${mapTitle(MAP)} · ${win?'15 站全部通过':'倒在第 '+step+' 站'} · 击杀 ${stats.kills} · 最佳 第 ${Math.max(best,step)} 站</div>
  <div class="build" style="margin-top:14px">本局流派：${buildSummary()||'无'}</div>${shardLine}
  <button class="big" style="max-width:300px;margin-top:18px" id="again">${FEAT.meta?'回到大厅':'再来一局'}</button>`;
  ov.style.display='flex';
  $('again').onclick=()=>{ov.style.display='none';showLobby();};
  renderPanel();
}

// ======================= 交互 =======================
cv.addEventListener('pointerdown',ev=>{
  if(!(phase==='build'||phase==='wave'))return;
  const r=cv.getBoundingClientRect();
  const x=(ev.clientX-r.left)*W/r.width,y=(ev.clientY-r.top)*H/r.height;
  const c=Math.floor(x/CS),rr=Math.floor(y/CS);
  if(placing){
    if(c<0||c>=COLS||rr<0||rr>=ROWS)return;
    const k=c+','+rr,onPath=pathSet.has(k);
    const okCell=placing==='swamp'?(onPath&&(!tiles[k]||tiles[k]==='ice')):(!onPath&&!tiles[k]&&!grid[k]);
    if(!okCell){txt((c+.5)*CS,(rr+.5)*CS,placing==='swamp'?'沼泽只能铺在路上':'这里放不了','#fca5a5',1);return;}
    tiles[k]=placing;tcards[placing]--;placing=null;buildBG();sfx('build');burst((c+.5)*CS,(rr+.5)*CS,'#fde68a',12,80,0,.5,2);sel={c,r:rr};renderPanel();return;
  }
  let hitE=null,bd=1e9;
  for(const e of enemies){if(e.dead)continue;const d=(e.x-x)**2+(e.y-y)**2;if(d<(e.r+10)**2&&d<bd){bd=d;hitE=e;}}
  if(hitE){sel={enemy:hitE};renderPanel();return;}
  if(c<0||c>=COLS||rr<0||rr>=ROWS)return;
  if(sel&&!sel.enemy&&sel.c===c&&sel.r===rr)sel=null;else sel={c,r:rr};
  renderPanel();
});
$('spd').onclick=()=>{speed=speed===1?2:speed===2?3:1;$('spd').textContent=speed+'×';};
panel.addEventListener('click',ev=>{
  const b=ev.target.closest('button');if(!b||b.disabled)return;
  if(b.id==='go'){startWave();return;}
  if(b.dataset.hs){heroCast(+b.dataset.hs);syncHero();return;}
  if(b.id==='hauto'){HERO.auto=!HERO.auto;META.auto=HERO.auto;saveMeta();renderPanel();return;}
  if(b.dataset.tc){placing=b.dataset.tc;sel=null;renderPanel();return;}
  if(b.id==='cancelPlace'){placing=null;renderPanel();return;}
  if(!sel||sel.enemy)return;const key=sel.c+','+sel.r;
  if(b.dataset.b){
    const type=b.dataset.b,cst=costOf(type);if(gold<cst||grid[key])return;
    gold-=cst;const t={type,lvl:1,c:sel.c,r:sel.r,x:(sel.c+.5)*CS,y:(sel.r+.5)*CS,cd:0,spent:cst};
    towers.push(t);grid[key]=t;renderPanel();sfx('build');burst(t.x,t.y+10,'#d6d3d1',8,60,120,.4,2);
  }else if(b.dataset.br){
    const t=grid[key];if(!t||t.lvl!==2)return;const uc=upCost(t);if(gold<uc)return;
    gold-=uc;t.spent+=uc;t.lvl++;t.branch=b.dataset.br;renderPanel();sfx('up');burst(t.x,t.y,'#fde047',16,100,-40,.7,2.2);txt(t.x,t.y-32,BR[t.branch].name,'#fde68a',1.2);
  }else if('up' in b.dataset){
    const t=grid[key];if(!t||t.lvl>=4||(t.lvl===2&&!t.branch))return;const uc=upCost(t);if(gold<uc)return;
    gold-=uc;t.spent+=uc;t.lvl++;renderPanel();sfx('up');burst(t.x,t.y,'#fde047',12,90,-40,.6,2);
    if(t.lvl>=4&&has('L_'+t.type)){txt(t.x,t.y-34,'进化：'+EVO[t.type],'#fbbf24',1.6);burst(t.x,t.y,'#fbbf24',24,120,-60,.9,2.4);}
  }else if('sell' in b.dataset){
    const t=grid[key];if(!t)return;gold+=Math.floor(t.spent*sellRate());
    towers=towers.filter(x=>x!==t);delete grid[key];sel=null;renderPanel();
  }
});
function tileLine(k){const t=tiles[k];return t?`<div class="tinfo"><span class="tag" style="background:${t==='highland'?'#86c46a':t==='runewell'?'#818cf8':t==='ice'?'#7cc0ea':t==='lava'?'#f97316':'#a3b18a'}">${TILEINFO[t].name}</span>${TILEINFO[t].desc}</div>`:'';}
function renderPanel(){
  let h='';
  if(phase==='build')h+=`<button class="big${curNode==='boss'?' red':''}" id="go">▶ 开始：第 ${step} 站 · ${NODES[curNode].name}${curNode==='boss'?' '+EINFO['boss'+actOf(step)].name:''}</button>`;
  else if(phase==='wave')h+=`<div class="wv">第 ${step} 站 · ${NODES[curNode].name}进行中</div>`;
  const live=phase==='build'||phase==='wave';
  if(live&&placing){
    h+=`<div class="tinfo">放置「${TILEINFO[placing].name}」：${placing==='swamp'?'点一格没有地形的道路':'点一格没有塔的空地'}。${TILEINFO[placing].desc}</div><button class="chip" id="cancelPlace">取消</button>`;
  }else if(live&&sel&&sel.enemy){
    const e=sel.enemy,i=EINFO[e.type];
    const tags=Object.keys(e.afx).map(a=>`<span class="tag" style="background:${AFX[a].col}">${AFX[a].name}</span>`).join('');
    const afxDesc=Object.keys(e.afx).map(a=>`${AFX[a].name}：${AFX[a].desc}`).join('<br>');
    h+=`<div class="einfo"><img src="${artURL(e.spr)}" alt=""><div class="t"><b>${e.elite?'精英 ':''}${i.name}</b> ${tags} · <span id="ehp">${ehpText(e)}</span><br>${i.desc}${afxDesc?'<br>'+afxDesc:''}${e.type==='boss2'?`<br>当前免疫：<b style="color:${TT[e.immune].color}">${TT[e.immune].name}</b>`:''}<br>${BIOME!=='grass'?`<span style="color:${BIO.col}">${BIO.icon}${BIO.name}：${BIOME==='snow'?'抗冰、怕火':'抗火、怕冰'}</span><br>`:''}<span style="color:#86efac">应对：${i.tip}${Object.keys(e.afx).map(a=>' '+AFX[a].tip).join('')}</span></div></div>`;
  }else if(live&&sel){
    const k=sel.c+','+sel.r,t=grid[k],tl=tiles[k];
    if(pathSet.has(k)){h+=tl?tileLine(k):`<div class="tinfo">道路：敌人沿着这条路走向城门，不能建塔。</div>`;}
    else if(tl==='runewell'||tl==='lava'){h+=tileLine(k);}
    else if(!t){
      h+=tileLine(k);
      h+='<div class="row">'+Object.keys(TT).map(k2=>{const d=TT[k2];return `<button class="tb" data-b="${k2}" data-cost="${costOf(k2)}" style="border-color:${d.color}66">${artURL(k2)?`<img src="${artURL(k2)}" alt="">`:`<b style="color:${d.color}">${d.ch}</b>`}${d.name}<br>${costOf(k2)}金</button>`;}).join('')+'</div>';
      h+=`<div class="hint">${Object.values(TT).map(d=>`<span style="color:${d.color}">${d.name}</span> ${d.tip}`).join(' · ')}</div>`;
    }else{
      const s=stat(t),uc=upCost(t),d=TT[t.type],wn=wellsNear(t.c,t.r),bn=t.branch?BR[t.branch]:null;
      const evo=t.lvl>=4&&has('L_'+t.type);
      h+=`<div class="tinfo"><b style="color:${d.color}">${bn?bn.name:d.name} Lv.${t.lvl}</b>${evo?` <b style="color:#fbbf24">★ ${EVO[t.type]}</b>`:''} · 伤害 ${s.dmg.toFixed(0)} · 每 ${s.rate.toFixed(2)} 秒 · 射程 ${(s.range/CS).toFixed(1)}${tl==='highland'?'（高地 +1）':''}${wn?` · 符文井 +${wn*20}%`:''}${t.stun>0?' · <b style="color:#f87171">被震慑</b>':''}${bn?`<br><span style="color:#9aa3c7">${bn.desc}</span>`:''}${t.lvl>=4&&!evo?`<br><span style="color:#fda4af">得到传说符文「${LEGENDS.find(l=>l.tag===t.type).name}」后进化为「${EVO[t.type]}」</span>`:''}</div>`;
      if(t.lvl===2&&!t.branch){
        h+=`<div class="tinfo" style="color:#fde68a"><button class="chip" data-sell style="float:right;margin:0;padding:1px 10px;line-height:1.3">出售 +${Math.floor(t.spent*sellRate())} 金</button>升到 3 级时选择分支（选了不能改）：</div><div class="row2">${BRANCH[t.type].map(([id,nm,ds])=>`<button class="tb br" data-br="${id}" data-cost="${uc}"><b>${nm}</b> · ${uc} 金<br>${ds}</button>`).join('')}</div>`;
      }else h+=`<div class="row2"><button class="tb" data-up data-cost="${t.lvl>=4?99999:uc}">${t.lvl>=4?'已满级':'⬆ 升级 '+uc+' 金'}</button><button class="tb" data-sell>出售 +${Math.floor(t.spent*sellRate())} 金</button></div>`;
    }
  }else if(live){
    h+=`<div class="hint">点空地建塔，点塔升级/出售，点敌人或地块看说明。右上角 🔮 查看已有符文。${HERO?`<br>地图角落是英雄技能：${HEROES[HERO.id].sk.map(s=>s.icon+s.name+'：'+s.desc).join('；')}。`:''}</div>`;
  }
  if(live&&!placing){const tc=Object.keys(tcards).filter(k=>tcards[k]>0);if(tc.length)h+=`<div>${tc.map(k=>`<button class="chip" data-tc="${k}">🗺️ ${TILEINFO[k].name} ×${tcards[k]}</button>`).join('')}</div>`;}
  panel.innerHTML=h;syncButtons();renderHeroFloat();syncHero();
  if(phase==='build'&&runStage!==null)snapRun('build');
  guideTick();
}
function syncButtons(){panel.querySelectorAll('[data-cost]').forEach(b=>{b.disabled=gold<+b.dataset.cost;});}

// ======================= 绘制 =======================
function rrect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function drawGate(p){
  const g=clampPt(p);ctx.save();ctx.translate(g.x,g.y);
  ctx.fillStyle='#57534e';rrect(-13,-15,26,26,4);ctx.fill();ctx.fillStyle='#78716c';ctx.fillRect(-13,-15,26,6);
  ctx.fillStyle='#1c1917';ctx.beginPath();ctx.moveTo(-7,11);ctx.lineTo(-7,-1);ctx.arc(0,-1,7,Math.PI,0);ctx.lineTo(7,11);ctx.fill();
  ctx.fillStyle='#ef4444';ctx.fillRect(-2,-24,2,10);ctx.beginPath();ctx.moveTo(0,-24);ctx.lineTo(9,-21);ctx.lineTo(0,-18);ctx.fill();
  ctx.restore();
}
function draw(){
  ctx.clearRect(0,0,W,H);
  if(!MAP)return;
  ctx.save();if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
  if(BG)ctx.drawImage(BG,0,0,W,H);
  else for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){ctx.fillStyle=pathSet.has(c+','+r)?'#a08866':'#3f6b34';ctx.fillRect(c*CS,r*CS,CS,CS);}
  drawDecals();
  // 入口
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 13px sans-serif';
  const ents=new Set();for(const P of PATHS){const s=clampPt(P.PP[0]),ek=Math.round(s.x)+','+Math.round(s.y);if(ents.has(ek))continue;ents.add(ek);ctx.fillStyle='rgba(13,16,32,.55)';ctx.beginPath();ctx.arc(s.x,s.y,10,0,7);ctx.fill();ctx.fillStyle='#bbf7d0';ctx.fillText('▶',s.x+(P.PP[0].x<0?2:P.PP[0].x>W?-2:0),s.y+1);}
  if(BIOME==='volcano'){const a=.12+.1*Math.sin(performance.now()/400);ctx.fillStyle=`rgba(253,186,116,${a})`;for(const k in tiles)if(tiles[k]==='lava'){const [c,r]=k.split(',').map(Number);ctx.beginPath();ctx.arc((c+.5)*CS,(r+.5)*CS,CS*.4,0,7);ctx.fill();}}
  drawGate(PATHS[0].PP[PATHS[0].PP.length-1]);
  // 选中
  if(sel&&sel.enemy&&!sel.enemy.dead){const e=sel.enemy;ctx.strokeStyle='#fde047';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y+e.r*.8,e.r*1.4,e.r*.55,0,0,7);ctx.stroke();}
  if(sel&&!sel.enemy){
    const t=grid[sel.c+','+sel.r];
    ctx.strokeStyle='#fde047';ctx.lineWidth=2;ctx.strokeRect(sel.c*CS+1,sel.r*CS+1,CS-2,CS-2);
    if(t){const s=stat(t);ctx.fillStyle='rgba(253,224,71,.08)';ctx.strokeStyle='rgba(253,224,71,.5)';ctx.beginPath();ctx.arc(t.x,t.y,s.range,0,7);ctx.fill();ctx.stroke();}
  }
  if(placing){const pa=.18+.12*Math.sin(performance.now()/250);ctx.fillStyle=`rgba(253,224,71,${pa})`;ctx.strokeStyle='rgba(253,224,71,.7)';ctx.lineWidth=1.5;for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const k=c+','+r,onP=pathSet.has(k);if(placing==='swamp'?(onP&&(!tiles[k]||tiles[k]==='ice')):(!onP&&!tiles[k]&&!grid[k])){ctx.fillRect(c*CS+3,r*CS+3,CS-6,CS-6);ctx.strokeRect(c*CS+3,r*CS+3,CS-6,CS-6);}}}
  // 塔
  for(const t of [...towers].sort((a,b)=>a.r-b.r)){
    const d=TT[t.type],sp=SPR[t.type],s=towerSize(t),sb=SPR[t.type+'Base'],st=SPR[t.type+'Top'];
    if(sb&&st){
      if(t.stun>0)ctx.globalAlpha=.45;
      const y0=t.y+CS*.5-s*.95,pv=towerPivot(t),k=t.kick||0,now=performance.now()/1000;
      ctx.drawImage(sb,t.x-s/2,y0,s,s);
      ctx.save();ctx.translate(pv.x,pv.y);
      if(t.type==='arrow'||t.type==='cannon'){
        ctx.rotate(t.ang||0);const back=(t.type==='cannon'?.1:.06)*k*k;ctx.translate(0,back*s);
        if(t.type==='cannon')ctx.scale(1+.06*k,1-.06*k);
        ctx.drawImage(st,-s/2,-s/2,s,s);
        if(t.type==='cannon'&&k>.55){ctx.globalAlpha=(k-.55)*2;ctx.fillStyle='#fde68a';ctx.beginPath();ctx.arc(0,-s*.4,s*.09,0,7);ctx.fill();ctx.fillStyle='#fb923c';ctx.beginPath();ctx.arc(0,-s*.45,s*.06,0,7);ctx.fill();}
      }else{
        const bob=t.type==='frost'?Math.sin(now*2.2+t.c)*s*.03:0,sc=1+(t.type==='frost'?.12:.07)*k;
        ctx.translate(0,bob);ctx.scale(sc,sc);ctx.drawImage(st,-s/2,-s/2,s,s);
        if(t.type==='tesla'&&k>0){ctx.globalAlpha=k*.7;ctx.fillStyle='#f5d0fe';ctx.beginPath();ctx.arc(0,-s*.33,s*.16*k+s*.04,0,7);ctx.fill();}
        if(t.type==='frost'&&k>0){ctx.globalAlpha=k*.5;ctx.fillStyle='#e0f2fe';ctx.beginPath();ctx.arc(0,-s*.12,s*.22*k,0,7);ctx.fill();}
      }
      ctx.restore();ctx.globalAlpha=1;
    }else if(sp){
      if(t.stun>0)ctx.globalAlpha=.45;
      ctx.drawImage(sp,t.x-s/2,t.y+CS*.5-s*.95,s,s);ctx.globalAlpha=1;
      if(t.flash>0){ctx.globalAlpha=.7;ctx.fillStyle=d.color;ctx.beginPath();ctx.arc(t.x,t.y+CS*.5-s*.9,4,0,7);ctx.fill();ctx.globalAlpha=1;}
    }else{
      ctx.fillStyle=t.flash>0?'#fff':'#0f1428';rrect(t.c*CS+4,t.r*CS+4,CS-8,CS-8,7);ctx.fill();ctx.strokeStyle=d.color;ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle=d.color;ctx.font='bold 17px sans-serif';ctx.fillText(d.ch,t.x,t.y-1);
    }
    for(let i=0;i<t.lvl;i++){ctx.fillStyle='#0f1428';ctx.fillRect(t.c*CS+7+i*7,t.r*CS+CS-6,6,4);ctx.fillStyle='#fde047';ctx.fillRect(t.c*CS+7.5+i*7,t.r*CS+CS-5.5,5,3);}
    if(t.branch){const bx=t.c*CS+CS-8,by=t.r*CS+7;ctx.fillStyle='#0f1428';ctx.beginPath();ctx.arc(bx,by,7,0,7);ctx.fill();ctx.strokeStyle=d.color;ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle=d.color;ctx.font='bold 9px sans-serif';ctx.fillText(BR[t.branch].ch,bx,by+.5);}
    if(t.lvl>=4&&has('L_'+t.type)){const a=.5+.3*Math.sin(performance.now()/300);ctx.strokeStyle=`rgba(251,191,36,${a})`;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(t.x,t.y+CS*.38,CS*.48,CS*.16,0,0,7);ctx.stroke();ctx.fillStyle='#fbbf24';ctx.font='bold 11px sans-serif';ctx.fillText('★',t.c*CS+7,t.r*CS+7);}
    if(t.stun>0){ctx.fillStyle='#fca5a5';ctx.font='bold 12px sans-serif';const a=performance.now()/200;ctx.fillText('✦',t.x+Math.cos(a)*9,t.y-CS*.6+Math.sin(a)*3);ctx.fillText('✦',t.x-Math.cos(a)*9,t.y-CS*.6-Math.sin(a)*3);}
  }
  // 敌人
  for(const e of [...enemies].sort((a,b)=>a.y-b.y)){
    const sp=SPR[e.spr+'_'+BIOME]||SPR[e.spr],hidden=e.afx.stealth&&!e.revealed;
    if(e.elite){ctx.strokeStyle='rgba(251,191,36,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y+e.r*.8,e.r*1.25,e.r*.48,0,0,7);ctx.stroke();}
    if(e.lead){ctx.fillStyle='rgba(248,113,113,.25)';ctx.beginPath();ctx.ellipse(e.x,e.y+e.r*.8,e.r*1.1,e.r*.4,0,0,7);ctx.fill();}
    if(e.afx.leader){ctx.strokeStyle='rgba(248,113,113,.35)';ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(e.x,e.y,2*CS,0,7);ctx.stroke();ctx.setLineDash([]);}
    if(e.frzT>0||e.slowT>0){ctx.fillStyle=e.frzT>0?'rgba(186,230,253,.6)':'rgba(96,165,250,.4)';ctx.beginPath();ctx.ellipse(e.x,e.y+e.r*.8,e.r*1.3,e.r*.5,0,0,7);ctx.fill();}
    if(e.type==='boss2'){const c=TT[e.immune].color;ctx.strokeStyle=c;ctx.globalAlpha=.6;ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y-4,e.r*1.5,0,7);ctx.stroke();ctx.globalAlpha=1;}
    if(e.type==='boss3'&&e.enraged){ctx.fillStyle='rgba(239,68,68,.22)';ctx.beginPath();ctx.arc(e.x,e.y-4,e.r*1.6,0,7);ctx.fill();}
    let top=e.y-e.r-4;
    if(hidden)ctx.globalAlpha=.3;
    if(sp){
      const s=e.r*2.9;top=e.y-s*.62;
      const hop=e.frzT>0?0:Math.abs(Math.sin(e.d*(e.boss?.06:.16))),fk=Math.max(0,(e.flT||0)/.09);
      const sx=(1+.06*hop*(e.boss?.5:1))*(1+.12*fk),sy=(1-.07*hop*(e.boss?.5:1))*(1-.1*fk);
      ctx.save();ctx.translate(e.x,e.y-hop*s*(e.boss?.02:.05));if(e.dir<0)ctx.scale(-1,1);ctx.scale(sx,sy);ctx.drawImage(sp,-s/2,-s*.62,s,s);
      if(fk>0&&SPRW[e.spr]){ctx.globalAlpha*=.8*fk;ctx.drawImage(SPRW[e.spr],-s/2,-s*.62,s,s);}
      ctx.restore();
    }else{ctx.fillStyle=e.col;ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,7);ctx.fill();}
    ctx.globalAlpha=1;
    if(e.shield>0){ctx.fillStyle='rgba(96,165,250,.22)';ctx.strokeStyle='rgba(147,197,253,.8)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(e.x,e.y-e.r*.3,e.r*1.35,0,7);ctx.fill();ctx.stroke();}
    drawStatus(e,0,top);
    const w=Math.max(e.r*2+4,18),p=Math.max(0,e.hp/e.max);
    ctx.fillStyle='#000a';ctx.fillRect(e.x-w/2,top-5,w,3);
    ctx.fillStyle=p>.5?'#4ade80':p>.25?'#facc15':'#ef4444';ctx.fillRect(e.x-w/2,top-5,w*p,3);
    if(e.shield>0){ctx.fillStyle='#93c5fd';ctx.fillRect(e.x-w/2,top-8,w*Math.min(1,e.shield/(e.max*.4)),2);}
    const ks=Object.keys(e.afx);ks.forEach((a,i)=>{ctx.fillStyle=AFX[a].col;ctx.beginPath();ctx.arc(e.x-(ks.length-1)*3.5+i*7,top-12,2.6,0,7);ctx.fill();});
    if(e.type==='boss2'){ctx.font='bold 11px sans-serif';ctx.fillStyle=TT[e.immune].color;ctx.fillText('免疫 '+TT[e.immune].name,e.x,top-15);}
  }
  drawHero();drawGuide();
  for(const l of lavas){const a=Math.min(1,l.t/l.T*2);ctx.globalAlpha=a*(.35+.1*Math.sin(performance.now()/120));ctx.fillStyle='#f97316';ctx.beginPath();ctx.arc(l.x,l.y,l.r,0,7);ctx.fill();ctx.globalAlpha=a*.5;ctx.fillStyle='#fde047';ctx.beginPath();ctx.arc(l.x,l.y,l.r*.45,0,7);ctx.fill();ctx.globalAlpha=1;}
  // 子弹
  for(const p of projs){
    if(p.k==='arrow'){
      const L=Math.hypot(p.vx||1,p.vy||0)||1,ux=(p.vx||1)/L,uy=(p.vy||0)/L;
      ctx.strokeStyle='#f1f5f9';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(p.x-ux*9,p.y-uy*9);ctx.lineTo(p.x,p.y);ctx.stroke();
      ctx.fillStyle='#4ade80';ctx.beginPath();ctx.arc(p.x,p.y,1.8,0,7);ctx.fill();
    }else{
      const tot=Math.hypot(p.tx-p.sx,p.ty-p.sy)||1,rem=Math.hypot(p.tx-p.x,p.ty-p.y),k=1-Math.min(1,rem/tot),hgt=Math.sin(k*Math.PI)*Math.min(26,tot*.35);
      ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(p.x,p.y+3,3.5,1.6,0,0,7);ctx.fill();
      ctx.fillStyle='#292524';ctx.beginPath();ctx.arc(p.x,p.y-hgt,p.k==='bomblet'?2.6:4.2,0,7);ctx.fill();
      ctx.fillStyle='#fb923c';ctx.beginPath();ctx.arc(p.x-1.2,p.y-hgt-1.2,1.4,0,7);ctx.fill();
    }
  }
  // 特效
  for(const f of fx){
    const a=f.t/f.T;
    if(f.k==='boom'){ctx.globalAlpha=a*.6;ctx.fillStyle=f.c;ctx.beginPath();ctx.arc(f.x,f.y,f.r*(1.2-a*.4),0,7);ctx.fill();}
    else if(f.k==='ring'){ctx.globalAlpha=a*.5;ctx.strokeStyle=f.c;ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,f.r*(1-a*.6),0,7);ctx.stroke();}
    else if(f.k==='zap'){
      if(!f.j)f.j=f.pts.map(()=>[(Math.random()-.5)*12,(Math.random()-.5)*12]);
      const path=()=>{ctx.beginPath();f.pts.forEach(([x,y],i)=>{if(!i){ctx.moveTo(x,y);return;}const [px,py]=f.pts[i-1];ctx.lineTo((px+x)/2+f.j[i][0],(py+y)/2+f.j[i][1]);ctx.lineTo(x,y);});};
      ctx.globalAlpha=a*.35;ctx.strokeStyle='#c084fc';ctx.lineWidth=7;path();ctx.stroke();
      ctx.globalAlpha=a;ctx.strokeStyle='#faf5ff';ctx.lineWidth=2;path();ctx.stroke();}
    else if(f.k==='dome'){const k=1-a;ctx.globalAlpha=a*.95;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(f.x,f.y,f.r*(.55+.45*k),0,7);ctx.fill();ctx.globalAlpha=a;ctx.strokeStyle='#fde68a';ctx.lineWidth=2.5;ctx.stroke();}
    else if(f.k==='bolt')drawBolt(f);
    else if(f.k==='frostwave')drawFrostWave(f);
    else if(f.k==='frostfloor'){const k=1-a,rr=f.r*(.3+.75*(1-(1-k)*(1-k)));ctx.globalAlpha=a*.32;const im=tinted('ring','#e0f2fe');if(im){ctx.save();ctx.translate(f.x,f.y);ctx.scale(1,.78);ctx.drawImage(im,-rr,-rr,rr*2,rr*2);ctx.restore();}
      ctx.globalAlpha=a*.14;ctx.fillStyle='#e0f2fe';ctx.beginPath();ctx.ellipse(f.x,f.y,rr*.85,rr*.66,0,0,7);ctx.fill();}
    else if(f.k==='arcball')drawArcBall(f);
    else if(f.k==='flash'){ctx.globalAlpha=a*.25;ctx.fillStyle=f.c||'#ef4444';ctx.fillRect(0,0,W,H);}
    else if(f.k==='core'){ctx.globalAlpha=a;ctx.fillStyle='#fffbeb';ctx.beginPath();ctx.arc(f.x,f.y,f.r*(.5+.5*(1-a)),0,7);ctx.fill();}
    else if(f.k==='star'){ctx.globalAlpha=a;ctx.strokeStyle='#fde047';ctx.lineWidth=2;const r=f.r*(1.3-a*.3);ctx.beginPath();for(let i=0;i<4;i++){const an=i*Math.PI/2+.4;ctx.moveTo(f.x,f.y);ctx.lineTo(f.x+Math.cos(an)*r,f.y+Math.sin(an)*r);}ctx.stroke();}
    else if(f.k==='slash'){ctx.globalAlpha=a;ctx.strokeStyle='#ef4444';ctx.lineWidth=5*a+1;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(f.x-f.r,f.y-f.r*.6);ctx.lineTo(f.x+f.r,f.y+f.r*.6);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();ctx.lineCap='butt';}
    else if(f.k==='tracer'){ctx.globalAlpha=a;ctx.strokeStyle='#bbf7d0';ctx.lineWidth=2.2*a+.5;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();}
    ctx.globalAlpha=1;
  }
  for(const q of parts)if(q.k==='puff')puffOutline(q);
  for(const q of parts)drawPart(q);
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.font='bold 13px sans-serif';
  for(const t of texts){ctx.globalAlpha=Math.min(1,t.t/t.T*1.5);ctx.fillStyle=t.c;ctx.fillText(t.s,t.x,t.y);}
  ctx.globalAlpha=1;ctx.restore();
  if(banner){
    const k=banner.t/banner.T,a=Math.min(1,(1-k)*6,k*4),y=H*.4;
    ctx.globalAlpha=a*.8;ctx.fillStyle=banner.boss?'#450a0a':'#0d1020';ctx.fillRect(0,y-34,W,68);
    ctx.globalAlpha=a;ctx.fillStyle=banner.boss?'#ef4444':'#fde68a';ctx.fillRect(0,y-34,W,2);ctx.fillRect(0,y+32,W,2);
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='bold 24px sans-serif';ctx.fillStyle=banner.boss?'#fecaca':'#fde68a';ctx.fillText(banner.a,W/2+(1-Math.min(1,(1-k)*5))*-40,y-6);
    ctx.font='14px sans-serif';ctx.fillStyle='#e5e7eb';ctx.fillText(banner.b,W/2,y+20);
    ctx.globalAlpha=1;
  }
}
const hW=$('hW'),hG=$('hG'),hL=$('hL');
let last=performance.now(),uiT=0;
function loop(now){
  if(window.__hold){last=now;requestAnimationFrame(loop);return;}  // 截图/录特效对比时手动推进
  const dt=Math.min(.05,(now-last)/1000);last=now;
  try{
  if(stopT>0){stopT-=dt;updFx(dt*.15);}
  else if(phase==='wave'&&!paused){for(let s=0;s<speed&&phase==='wave'&&!paused;s++)step_(dt);}
  else updFx(dt);
  }catch(err){console.error(err);}
  if(banner){banner.t-=dt;if(banner.t<=0)banner=null;}
  try{musicTick(dt);}catch(e){}
  try{draw();}catch(err){console.error(err);}
  uiT-=dt;
  if(uiT<=0){uiT=.15;hW.textContent=`第${actOf(step)}幕 ${step}/${MAXS}`;hG.textContent=`💰 ${Math.floor(gold||0)}`;hL.textContent=`❤️ ${lives??20}`;syncButtons();syncHero();
    if(sel&&sel.enemy){const el=$('ehp');if(el)el.textContent=ehpText(sel.enemy);}}
  requestAnimationFrame(loop);
}
loadArt();fxTexInit();
showLobby();
requestAnimationFrame(loop);


})(__E.window,__E.document,__E.localStorage,__E.Image,__E.requestAnimationFrame,__E.performance,__E.location,__E.AudioContext,undefined,__E.navigator,undefined);
return __E;
}

__HOST.pngKeys=["arrow", "arrowBase", "arrowTop", "ashroad", "basalt0", "basalt1", "boss1", "boss1_snow", "boss1_volcano", "boss2", "boss2_snow", "boss2_volcano", "boss3", "boss3_snow", "boss3_volcano", "cannon", "cannonBase", "cannonTop", "fast", "fast_snow", "fast_volcano", "frost", "frostBase", "frostTop", "grass0", "grass1", "highland", "highland_snow", "highland_volcano", "ice", "lava", "mini", "mini_snow", "mini_volcano", "norm", "norm_snow", "norm_volcano", "path", "runewell", "runewell_snow", "runewell_volcano", "snow0", "snow1", "snowroad", "split", "split_snow", "split_volcano", "swamp", "tank", "tank_snow", "tank_volcano", "tesla", "teslaBase", "teslaTop"];
__BOOT(__HOST);
