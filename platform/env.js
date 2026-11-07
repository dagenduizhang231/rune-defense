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
#cv{width:min(100vw,480px,calc((${appH}px - 190px) * 0.6429))}
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
