"""从候选地图中挑出最终图库：模拟胜率在合理区间 + 与已选地图（含镜像/翻转）不重复。"""
import json, glob, random
random.seed(5)
cands = json.load(open('cands.json'))
res = {}
for f in glob.glob('res_*.jsonl') + glob.glob('hm_*.jsonl'):
    for line in open(f):
        line = line.strip()
        if not line.startswith('{'): continue
        r = json.loads(line); r.setdefault('hm', 1)
        # 同一张图测过多个倍率：保留最接近 60% 胜率、且在区间内的那个
        old = res.get(r['ci'])
        if old is None or abs(r['win'] - 0.6) < abs(old['win'] - 0.6):
            res[r['ci']] = r

def cellset(m):
    return set(tuple(map(int, k.split(','))) for k in m['cells'])
def variants(s):
    return [s, {(8 - c, r) for c, r in s}, {(c, 13 - r) for c, r in s}, {(8 - c, 13 - r) for c, r in s}]
def jacc(a, b):
    return len(a & b) / max(1, len(a | b))

PER_TYPE = 10
LO, HI = 0.3, 0.88
out, report = [], {}
for t in ['snake', 'twin', 'triple', 'fork', 'citadel']:
    pool = [(i, m) for i, m in enumerate(cands) if m['type'] == t and i in res and LO <= res[i]['win'] <= HI]
    pool.sort(key=lambda x: abs(res[x[0]]['win'] - 0.6) + random.random() * 0.15)
    chosen = []
    for i, m in pool:
        s = cellset(m)
        if any(jacc(v, cellset(o)) > 0.5 for _, o in chosen + [(None, x) for x in out] for v in variants(s)):
            continue
        chosen.append((i, m))
        if len(chosen) >= PER_TYPE:
            break
    for i, m in chosen:
        w = res[i]['win']
        m2 = {k: m[k] for k in ('type', 'paths', 'tiles', 'gateInside', 'cells')}
        if res[i]['hm'] != 1: m2['hpMul'] = res[i]['hm']
        m2['stars'] = 1 if w >= 0.72 else 2 if w >= 0.48 else 3
        m2['simWin'] = round(w, 2)
        out.append(m2)
    total = sum(1 for m in cands if m['type'] == t)
    tested = sum(1 for i, m in enumerate(cands) if m['type'] == t and i in res)
    report[t] = dict(candidates=total, tested=tested, inBand=len(pool), chosen=len(chosen),
                     wins=sorted(round(res[i]['win'], 2) for i, _ in chosen))

NAMES = ["青苔谷", "风语林", "落日坡", "白石滩", "雾隐沼", "铁杉岭", "月牙湾", "灰烬原", "碧泉村", "赤土关",
         "霜叶林", "鹿鸣谷", "星坠丘", "古井镇", "断桥渡", "苍狼岗", "金穗田", "烛火巷", "银杏道", "晨露坡",
         "黑松岭", "玉带河", "黄沙驿", "松涛峡", "紫藤园", "寒鸦渡", "龙脊梁", "碎岩滩", "回音洞", "野莓林",
         "柳絮堤", "枫红谷", "云杉坡", "石门关", "渔火湾", "雪松林", "芦花荡", "飞瀑崖", "蘑菇林", "萤火原",
         "琥珀湖", "青铜堡", "狐狸窝", "鸢尾坡", "橡木桥", "海雾岬", "熔岩口", "磨坊村", "蜂蜜谷", "晴川渡",
         "苔藓阶", "冰川口", "落樱道", "铃兰坡", "赤枫渡"]
random.shuffle(NAMES)
for k, m in enumerate(out):
    m.pop('cells', None)
    m['id'] = f"{m['type']}-{k:02d}"
    m['place'] = NAMES[k]
open('maps.js', 'w', encoding='utf-8').write(
    '// 自动生成：地图生成器 + 模拟筛选。每张图都和其它图（包括镜像、翻转版本）比较过，路线重合度不超过 50%。\n'
    'window.RUNE_MAPS=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(json.dumps(report, ensure_ascii=False, indent=1))
print('total maps:', len(out))
