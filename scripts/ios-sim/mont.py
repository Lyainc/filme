import sys
from PIL import Image
out=sys.argv[1]; ims=[Image.open(f) for f in sys.argv[2:]]
w=sum(i.width for i in ims); c=Image.new("RGB",(w,max(i.height for i in ims)),"white"); x=0
for i in ims: c.paste(i,(x,0)); x+=i.width
c.save(out)
