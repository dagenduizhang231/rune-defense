# 把 pixelfx 渲染出的序列图裁边、抽帧、压色，烘成游戏用的 fx/pf_*.png
# 用法: python3 tools/bake_pfx.py <sheet.json> <out.png> <from> <to> <stride> [cols] [colors]
import sys,json
from PIL import Image
j,out,a,b,st=sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4]),int(sys.argv[5])
cols=int(sys.argv[6]) if len(sys.argv)>6 else 8; ncol=int(sys.argv[7]) if len(sys.argv)>7 else 128
d=json.load(open(j))['meta']['pixelfx'];im=Image.open(j.replace('.json','.png')).convert('RGBA')
fw,fh=d['frameSize'];px,py=d['pivot'];C=d['columns']
fr=[im.crop(((i%C)*fw,(i//C)*fh,(i%C+1)*fw,(i//C+1)*fh)) for i in range(a,min(b,d['frames']),st)]
bb=None
for f in fr:
  q=f.getchannel('A').point(lambda v:255 if v>8 else 0).getbbox()
  if q:bb=q if not bb else (min(bb[0],q[0]),min(bb[1],q[1]),max(bb[2],q[2]),max(bb[3],q[3]))
fr=[f.crop(bb) for f in fr];w,h=bb[2]-bb[0],bb[3]-bb[1];n=len(fr);cols=min(cols,n);rows=(n+cols-1)//cols
S=Image.new('RGBA',(w*cols,h*rows))
for i,f in enumerate(fr):S.paste(f,((i%cols)*w,(i//cols)*h))
S=S.quantize(ncol,method=Image.FASTOCTREE).convert('RGBA');S.save(out,optimize=True)
print(json.dumps({'w':w,'h':h,'n':n,'cols':cols,'ox':px-bb[0],'oy':py-bb[1]}))
