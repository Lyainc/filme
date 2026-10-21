import json, sys
import numpy as np
from PIL import Image
d = sys.argv[1]
recs = json.load(open(f'{d}/768-ios.json'))
out = {}
for r in recs:
    cid = r['id']; rel = r['editorFinal']['rel']
    im = Image.open(f'{d}/{cid}-saved.jpg').convert('RGB')
    m = 20; tk = np.asarray(im, dtype=np.float32)[m:-m, m:-m]
    H, W = tk.shape[:2]
    reg = tk[int(rel['y'] * H):int((rel['y'] + rel['h']) * H), int(rel['x'] * W):int((rel['x'] + rel['w']) * W)]
    # control: same-size paper patch just left of the stamp slot
    ctl = tk[int(rel['y'] * H):int((rel['y'] + rel['h']) * H), int((rel['x'] - rel['w'] - 0.02) * W):int((rel['x'] - 0.02) * W)]
    out[cid] = {'stampSlotStd': round(float(reg.std()), 1), 'paperStd': round(float(ctl.std()), 1), 'size': [im.width, im.height]}
    print(cid, out[cid])
json.dump(out, open(f'{d}/stamp-presence.json', 'w'), indent=1)
