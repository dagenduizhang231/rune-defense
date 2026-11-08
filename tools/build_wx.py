#!/usr/bin/env python3
"""把网页版打包成微信小游戏工程。

用法：python3 tools/build_wx.py [--appid wx...] [--no-bake]

输出：
  wx/                 微信开发者工具直接导入的小游戏工程（game.js、game.json、project.config.json、images/）
  wx-preview/         浏览器预览：用模拟的 wx 环境跑同一份代码（本地测试、截图用）

做的事：
  1. 从 index.html 取出 CSS、页面骨架和游戏脚本
  2. 用无头 Chrome 把 art.js 的 SVG 贴图全部烤成 PNG（微信不能直接画 SVG）
  3. 拼接：迷你 DOM（platform/ui.js）+ 运行环境（platform/env.js）+ 宿主 + 地图 + 音乐 + 游戏脚本
"""
import os, re, sys, json, base64, shutil, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda *p: os.path.join(ROOT, *p)

def read(p): return open(J(p), encoding='utf-8').read()

def extract():
    h = read('index.html')
    css = re.search(r'<style>(.*?)</style>', h, re.S).group(1)
    body = re.search(r'<body>(.*?)<script', h, re.S).group(1)
    scripts = re.findall(r'<script>(.*?)</script>', h, re.S)
    game = scripts[-1]
    ver = re.search(r"VERSION='([^']+)'", game).group(1)
    return css, body, game, ver

def bake(outdir):
    from playwright.sync_api import sync_playwright
    os.makedirs(outdir, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=3)
        pg.goto('file://' + J('index.html'))
        pg.wait_for_timeout(500)
        res = pg.evaluate("""async()=>{const out={};for(const [k,f,px] of artJobs()){const c=await raster(f(),px);out[k]=c?c.toDataURL('image/png'):null;}return out;}""")
        b.close()
    keys = []
    for k, url in res.items():
        if not url: print('  !! 贴图失败', k); continue
        open(os.path.join(outdir, k + '.png'), 'wb').write(base64.b64decode(url.split(',', 1)[1]))
        keys.append(k)
    return sorted(keys)

def compress(outdir):
    # 有 pngquant 就压一下（体积能小一半以上）
    if shutil.which('pngquant'):
        for f in os.listdir(outdir):
            if f.endswith('.png'):
                subprocess.run(['pngquant', '--force', '--skip-if-larger', '--quality=70-95', '--ext', '.png', os.path.join(outdir, f)], capture_output=True)

def core(css, body, game, debug):
    maps, music = read('maps.js'), read('music.js')
    ui, env = read('platform/ui.js'), read('platform/env.js')
    hook = "window.__rune_eval=function(s){return eval(s);};" if debug else ""
    return f"""{ui}
{env}
function __BOOT(__HOST){{
var __E=RuneEnv(__HOST,{json.dumps(css, ensure_ascii=False)},{json.dumps(body, ensure_ascii=False)});
(function(window,document,localStorage,Image,requestAnimationFrame,performance,location,AudioContext,webkitAudioContext,navigator,URLSearchParams){{
{maps}
{music}
var RuneMusic=window.RuneMusic;
{game}
{hook}
}})(__E.window,__E.document,__E.localStorage,__E.Image,__E.requestAnimationFrame,__E.performance,__E.location,__E.AudioContext,undefined,__E.navigator,undefined);
return __E;
}}
"""

PREVIEW = r"""<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>符文塔防 · 微信版预览</title><link rel="icon" href="data:,">
<style>html,body{margin:0;background:#222;height:100%;overflow:hidden}#scr{display:block;touch-action:none}
#cap{position:fixed;right:7px;width:87px;height:32px;border-radius:16px;background:rgba(255,255,255,.85);border:1px solid #ddd;pointer-events:none;font:12px sans-serif;color:#333;display:flex;align-items:center;justify-content:center;letter-spacing:6px}</style>
</head><body><canvas id="scr"></canvas><div id="cap">•••◉</div>
<script src="core.js"></script>
<script>
(function(){
const W=innerWidth,H=innerHeight,dpr=Math.min(3,devicePixelRatio||1),cv=document.getElementById('scr');
cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';
// 模拟微信顶部胶囊按钮（状态栏 47 + 胶囊 32）
const capTop=Math.round(H>=800?51:28),top=capTop+32+6;document.getElementById('cap').style.top=capTop+'px';
const t0=performance.now();
const host={width:W,height:H,dpr,screenCtx:cv.getContext('2d'),insets:{top,bottom:H>=800?34:0},fontFamily:'-apple-system,"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif',
 createCanvas:()=>document.createElement('canvas'),Image:window.Image,
 loadImage(src,cb){const im=new Image();im.onload=cb;im.src=src;return im;},
 pngBase:'images/',pngKeys:PNG_KEYS,search:location.search,
 storage:{get:k=>localStorage.getItem('wxp_'+k),set:(k,v)=>localStorage.setItem('wxp_'+k,v),remove:k=>localStorage.removeItem('wxp_'+k),clear(){for(const k of Object.keys(localStorage))if(k.startsWith('wxp_'))localStorage.removeItem(k);}},
 rAF:cb=>requestAnimationFrame(cb),now:()=>performance.now()-t0,
 audioCtor:window.AudioContext||window.webkitAudioContext,
 bindTouch(ui){let down=false;const p=e=>[e.clientX,e.clientY];
  cv.addEventListener('pointerdown',e=>{down=true;cv.setPointerCapture(e.pointerId);ui.touchStart(...p(e));});
  cv.addEventListener('pointermove',e=>{if(down)ui.touchMove(...p(e));});
  cv.addEventListener('pointerup',e=>{if(!down)return;down=false;ui.touchEnd(...p(e));});
  cv.addEventListener('pointercancel',()=>{down=false;ui.touchCancel();});
  cv.addEventListener('wheel',e=>{ui.wheel(e.clientX,e.clientY,e.deltaY);e.preventDefault();},{passive:false});}};
window.__ENV=__BOOT(host);
})();
</script></body></html>
"""

def main():
    args = sys.argv[1:]
    appid = 'touristappid'
    if '--appid' in args: appid = args[args.index('--appid') + 1]
    css, body, game, ver = extract()
    out, prev = J('wx'), J('wx-preview')
    for d in (out, prev): os.makedirs(d, exist_ok=True)
    img = os.path.join(out, 'images')
    if '--no-bake' in args and os.path.isdir(img):
        keys = sorted(f[:-4] for f in os.listdir(img) if f.endswith('.png') and not f.startswith('fx_'))
    else:
        if os.path.isdir(img): shutil.rmtree(img)
        print('烤贴图…'); keys = bake(img); compress(img)
    # 特效贴图（Kenney 粒子包，CC0）：复制成 images/fx_*.png，不算进角色贴图列表
    for f in os.listdir(J('fx')):
        if f.endswith('.png'): shutil.copy(J('fx', f), os.path.join(img, 'fx_' + f))
    keys = [k for k in keys if not k.startswith('fx_')]
    shutil.copy(J('THIRD_PARTY.md'), os.path.join(out, 'THIRD_PARTY.md'))
    # 微信工程
    open(os.path.join(out, 'game.js'), 'w', encoding='utf-8').write(
        f"// 符文塔防 {ver} · 微信小游戏版（由 tools/build_wx.py 生成，不要手改）\n" + read('platform/wx-host.js') + '\n' + core(css, body, game, False) +
        f"\n__HOST.pngKeys={json.dumps(keys)};\n__BOOT(__HOST);\n")
    open(os.path.join(out, 'game.json'), 'w', encoding='utf-8').write(json.dumps({'deviceOrientation': 'portrait', 'showStatusBar': False}, indent=2))
    pc = os.path.join(out, 'project.config.json')
    cfg = {'appid': appid, 'projectname': 'rune-defense', 'compileType': 'game', 'description': '符文塔防',
           'setting': {'es6': True, 'enhance': True, 'minified': True, 'postcss': False, 'urlCheck': False},
           'libVersion': '3.6.0', 'packOptions': {'ignore': [], 'include': []}, 'condition': {}}
    if os.path.exists(pc) and '--appid' not in args:
        try: cfg['appid'] = json.load(open(pc)).get('appid', appid)
        except Exception: pass
    json.dump(cfg, open(pc, 'w'), indent=2, ensure_ascii=False)
    # 浏览器预览
    open(os.path.join(prev, 'core.js'), 'w', encoding='utf-8').write(core(css, body, game, True))
    open(os.path.join(prev, 'index.html'), 'w', encoding='utf-8').write(PREVIEW.replace('PNG_KEYS', json.dumps(keys)))
    pimg = os.path.join(prev, 'images')
    if os.path.isdir(pimg): shutil.rmtree(pimg)
    shutil.copytree(img, pimg)
    size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(out) for f in fs)
    print(f'完成 {ver}：{len(keys)} 张贴图，微信包 {size/1024:.0f} KB（主包上限 4096 KB）')

if __name__ == '__main__':
    main()
