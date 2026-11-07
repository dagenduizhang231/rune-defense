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
