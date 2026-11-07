#!/usr/bin/env python3
"""上线前自动测试（QA）。

用法：python3 tools/qa.py [局数=8] [并行=4] [倍速=10]

机器人在真实浏览器（手机尺寸）里从选地图开始打完整局，界面全部用真实点击：
选地图、教程、敌人介绍、符文三选一、选下一站、精英奖励、开始战斗、再来一局。
建塔/升级大部分用游戏内函数（太慢的部分），但每回合也会用真实点击建 1 座塔、点升级、点分支。
每个弹窗界面有 40% 概率先打开「我的符文」再关掉；战斗中也会随机开关符文面板。

一直检查：
- 页面报错 / console.error
- 战斗中卡住（时间不走、怪不出、超过时限）
- 暂停卡死（没有任何弹窗却处于暂停）
- 流程死路（没有弹窗、也不是建造/战斗阶段；弹窗里没有可点按钮）
- 数值异常（金币、生命、敌人血量、塔伤害出现 NaN/无穷大）
- 合体解锁条件与流派计数是否一致
- 每局必须在时限内结束，并能「再来一局」回到选地图
"""
import sys, time, random, json, multiprocessing as mp
from playwright.sync_api import sync_playwright

import os
ROOT = os.environ.get('QA_URL', 'file:///home/claude/rune-defense/index.html')

BOT_JS = r"""
window.__qa={
 cands(){const out=[];for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const k=c+','+r;if(pathSet.has(k)||grid[k]||tiles[k]==='runewell')continue;let n=0;for(let dc=-2;dc<=2;dc++)for(let dr=-2;dr<=2;dr++)if(pathSet.has((c+dc)+','+(r+dr)))n+=(Math.abs(dc)<=1&&Math.abs(dr)<=1)?2:1;if(tiles[k]==='highland')n+=6;n+=wellsNear(c,r)*3;out.push({c,r,n});}return out.sort((a,b)=>b.n-a.n);},
 types:null,ti:0,
 spend(){if(!this.types)this.types=[['arrow','cannon','frost','tesla','arrow','cannon'],['arrow','cannon'],['frost','tesla','cannon']][Math.floor(Math.random()*3)];
  let g=0;while(g++<60){const type=this.types[this.ti%this.types.length];const spot=this.cands()[0];const up=towers.filter(t=>t.lvl<4).sort((a,b)=>upCost(a)-upCost(b))[0];
   const want=towers.length<5+step/2;
   const mk=()=>{const t={type,lvl:1,c:spot.c,r:spot.r,x:(spot.c+.5)*CS,y:(spot.r+.5)*CS,cd:0,spent:costOf(type)};gold-=t.spent;towers.push(t);grid[spot.c+','+spot.r]=t;this.ti++;};
   if(want&&spot&&gold>=costOf(type)){mk();continue;}
   if(up&&gold>=upCost(up)){const u=upCost(up);gold-=u;up.spent+=u;up.lvl++;if(up.lvl===3&&!up.branch)up.branch=BRANCH[up.type][Math.random()<.5?0:1][0];continue;}
   if(spot&&gold>=costOf(type)){mk();continue;}
   break;}renderPanel();},
 placeCards(){for(const k of Object.keys(tcards))while(tcards[k]>0){let cell=null;if(k==='swamp'){const ps=[...pathSet].filter(p=>!tiles[p]);cell=ps[Math.floor(ps.length/2)];}else{const c=this.cands()[0];if(c)cell=c.c+','+c.r;}if(!cell)break;tiles[cell]=k;tcards[k]--;}renderPanel();},
 spot(){const c=this.cands();return c.length?c[Math.floor(Math.random()*Math.min(6,c.length))]:null;},
 check(){const bad=[];const fin=v=>typeof v==='number'&&isFinite(v);
  if(!fin(gold))bad.push('金币异常 '+gold);if(!fin(lives)||lives>60)bad.push('生命异常 '+lives);
  for(const e of enemies)if(!e.dead&&(!fin(e.hp)||!fin(e.x)||!fin(e.y)))bad.push('敌人数值异常 '+e.type);
  for(const t of towers){try{const s=stat(t);if(!fin(s.dmg)||!fin(s.range))bad.push('塔数值异常 '+t.type+' lv'+t.lvl);}catch(err){bad.push('stat() 报错 '+err);}}
  for(const cb of COMBOS){const ok=schoolCount(cb.a)>=2&&schoolCount(cb.b)>=2;if(ok!==(comboReady(cb)||has(cb.id)))bad.push('合体条件不一致 '+cb.id);}
  return bad;},
 state(){const vis=el=>el&&el.style.display==='flex';
  const btns=vis(ov)?[...ov.querySelectorAll('button')].filter(b=>b.offsetParent!==null&&!b.disabled).length:0;
  return {phase,step,lives,gold:Math.floor(gold),paused,ov:vis(ov),bp:vis(bp),btns,intro:!!document.getElementById('okIntro')&&vis(ov),
   q:queue.length,en:enemies.length,kills:stats.kills,node:curNode,towers:towers.length,legs:Object.keys(taken).filter(k=>k.startsWith('L_')).length,
   combos:Object.keys(taken).filter(k=>k.startsWith('C_')).length,runes:Object.keys(taken).length};}
};
"""

def run_worker(args):
    wid, runs, spd, seed = args
    rnd = random.Random(seed)
    problems, results = [], []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = b.new_context(viewport={'width': 390, 'height': 844})
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append('页面报错: ' + str(e)))
        pg.on('console', lambda m: m.type == 'error' and errs.append('console.error: ' + m.text))
        pg.goto(ROOT); pg.wait_for_timeout(1200)
        pg.evaluate(BOT_JS)
        ev = pg.evaluate

        def prob(run, msg):
            s = ev('__qa.state()')
            problems.append(f'[进程{wid} 第{run}局 第{s["step"]}站 {s["phase"]}] {msg}')

        def click(sel):
            try:
                pg.click(sel, timeout=1500); return True
            except Exception:
                return False

        def runes_roundtrip(run, where):
            """打开再关掉符文面板，确认不会卡住暂停"""
            for sel in ['#seeRunes', '#runes']:
                if pg.is_visible(sel):
                    before = ev('paused')
                    if not click(sel): continue
                    pg.wait_for_timeout(80)
                    if not ev('__qa.state()')['bp']:
                        prob(run, f'{where}：点了符文按钮但面板没打开')
                    click('#closeRunes'); pg.wait_for_timeout(80)
                    s = ev('__qa.state()')
                    if s['bp']: prob(run, f'{where}：符文面板关不掉')
                    if s['paused'] and not s['intro'] and not before:
                        prob(run, f'{where}：关掉符文面板后仍处于暂停')
                    return

        cv = None
        def tap_cell(c, r):
            nonlocal cv
            cv = pg.query_selector('#cv').bounding_box()
            cols, rows = ev('[COLS,ROWS]')
            pg.mouse.click(cv['x'] + (c + .5) * cv['width'] / cols, cv['y'] + (r + .5) * cv['height'] / rows)
            pg.wait_for_timeout(60)

        for run in range(1, runs + 1):
            if run > 1 and rnd.random() < .5:
                ev("localStorage.removeItem('td_seen')")   # 一半的局重新看到敌人介绍
            t0 = time.time(); errs.clear()
            last_sig, last_change = None, time.time()
            done = False; route = rnd.choice(['safe', 'mixed', 'greedy'])
            ev('__qa.types=null')
            while time.time() - t0 < 420:
                for e in errs: prob(run, e)
                errs.clear()
                for m in ev('__qa.check()'): prob(run, m)
                s = ev('__qa.state()')
                sig = (s['phase'], s['step'], s['q'], s['en'], s['kills'], s['ov'], s['bp'], s['btns'], s['towers'], s['gold'])
                if sig != last_sig: last_sig, last_change = sig, time.time()
                elif time.time() - last_change > 12:
                    prob(run, f'卡住 12 秒没有任何变化：{json.dumps(s, ensure_ascii=False)}'); break
                if s['paused'] and not s['ov'] and not s['bp']:
                    pg.wait_for_timeout(300)
                    s2 = ev('__qa.state()')
                    if s2['paused'] and not s2['ov'] and not s2['bp']:
                        prob(run, '暂停卡死：没有任何弹窗却处于暂停'); ev('paused=false')
                if s['ov']:
                    if s['btns'] == 0:
                        prob(run, '弹窗里没有可点的按钮（死路）'); break
                    if s['phase'] in ('win', 'over'):
                        results.append({'run': run, 'result': '胜利' if s['phase'] == 'win' else '失败', 'step': s['step'], 'lives': s['lives'],
                                        'legs': s['legs'], 'combos': s['combos'], 'runes': s['runes'], 'route': route, 'sec': round(time.time() - t0)})
                        if not click('#again'): prob(run, '结束界面点不了「再来一局」')
                        pg.wait_for_timeout(200)
                        if ev('phase') != 'map': prob(run, '「再来一局」之后没有回到选地图')
                        done = True; break
                    if rnd.random() < .4 and s['phase'] != 'map': runes_roundtrip(run, f'弹窗({s["phase"]})')
                    if s['intro']: click('#okIntro')
                    elif pg.is_visible('#tutok'): click('#tutok')
                    elif pg.is_visible('#ov .card.node'):
                        nodes = ev('pendingNodes')
                        want = 'elite' if route == 'greedy' else ('elite' if route == 'mixed' and rnd.random() < .35 else 'normal')
                        i = nodes.index(want) if want in nodes else 0
                        click(f'#ov .card.node[data-i="{i}"]')
                    elif pg.is_visible('#erRune'):
                        click('#erTile' if rnd.random() < .35 else '#erRune')
                    else:
                        cards = pg.query_selector_all('#ov .card')
                        vis = [c for c in cards if c.is_visible()]
                        if vis: rnd.choice(vis).click()
                        else:
                            bs = [x for x in pg.query_selector_all('#ov button') if x.is_visible()]
                            rnd.choice(bs).click()
                    pg.wait_for_timeout(60)
                    continue
                if s['phase'] == 'build':
                    ev('__qa.placeCards()')
                    # 真实点击：建 1 座塔、点它升级、遇到分支点分支
                    sp = ev('__qa.spot()')
                    if sp and s['gold'] >= 60:
                        tap_cell(sp['c'], sp['r'])
                        t = rnd.choice(['arrow', 'cannon', 'frost', 'tesla'])
                        if pg.is_visible(f'button[data-b="{t}"]'):
                            click(f'button[data-b="{t}"]')
                    tw = ev('towers.length')
                    if tw:
                        k = rnd.randrange(tw); c, r = ev(f'[towers[{k}].c,towers[{k}].r]')
                        tap_cell(c, r)
                        if pg.is_visible('button[data-br]'): click(f'button[data-br] >> nth={rnd.randrange(2)}')
                        elif pg.is_visible('button[data-up]'): click('button[data-up]')
                    ev('__qa.spend()')
                    if rnd.random() < .3: runes_roundtrip(run, '建造阶段')
                    if not click('#go'): prob(run, '建造阶段找不到「开始」按钮'); break
                    pg.wait_for_timeout(100)
                    ev(f'speed={spd}')
                    if ev('phase') != 'wave': prob(run, '点了开始但没有进入战斗')
                    continue
                if s['phase'] == 'wave':
                    if rnd.random() < .04: runes_roundtrip(run, '战斗中')
                    # 战斗卡住检测：有怪在排队但 3 秒内一个都没刷出
                    if s['q'] > 0 and s['en'] == 0 and not s['paused']:
                        pg.wait_for_timeout(3000)
                        s2 = ev('__qa.state()')
                        if s2['phase'] == 'wave' and s2['q'] == s['q'] and not s2['paused'] and not s2['ov']:
                            prob(run, f'战斗开始后怪不出来（排队 {s["q"]} 只）'); break
                    pg.wait_for_timeout(250)
                    continue
                if s['phase'] not in ('wave', 'build'):
                    pg.wait_for_timeout(300)
                    s2 = ev('__qa.state()')
                    if not s2['ov'] and s2['phase'] == s['phase']:
                        prob(run, f'流程死路：阶段 {s["phase"]} 但没有弹窗'); break
            if not done:
                if time.time() - t0 >= 420: prob(run, '一局超过 7 分钟没打完')
                # 恢复：重新加载
                pg.goto(ROOT); pg.wait_for_timeout(1000); pg.evaluate(BOT_JS)
        b.close()
    return problems, results

if __name__ == '__main__':
    runs = int(sys.argv[1]) if len(sys.argv) > 1 else 8
    par = int(sys.argv[2]) if len(sys.argv) > 2 else 4
    spd = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    per = [runs // par + (1 if i < runs % par else 0) for i in range(par)]
    t0 = time.time()
    with mp.Pool(par) as pool:
        outs = pool.map(run_worker, [(i, n, spd, 1000 + i * 7 + int(t0)) for i, n in enumerate(per) if n])
    probs = [x for o in outs for x in o[0]]; res = [x for o in outs for x in o[1]]
    print(f'完成 {len(res)}/{runs} 局，用时 {round(time.time()-t0)} 秒')
    for r in res: print('  ', json.dumps(r, ensure_ascii=False))
    print(f'发现问题 {len(probs)} 个')
    seen = {}
    for p in probs:
        key = p.split('] ', 1)[-1][:60]
        seen.setdefault(key, []).append(p)
    for k, v in seen.items(): print(f'  ×{len(v)}  {v[0]}')
    sys.exit(1 if probs or len(res) < runs else 0)
