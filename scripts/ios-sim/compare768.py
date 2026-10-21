"""Align saved JPEG onto the editor preview screenshot (ghost off) by ticket boundary; report residual + side-by-side.

usage: compare768.py <dir> S01 [S02 ...]   (expects <id>-editor.png and <id>-saved.jpg)
"""
import json, sys
import numpy as np
from PIL import Image

d = sys.argv[1]
out = {}
for cid in sys.argv[2:]:
    shot = Image.open(f'{d}/{cid}-editor.png').convert('RGB')
    saved = Image.open(f'{d}/{cid}-saved.jpg').convert('RGB')
    # crop the 10px export margin (x2) so we compare the ticket itself
    m = 20
    tk = saved.crop((m, m, saved.width - m, saved.height - m))
    S = np.asarray(shot.convert('L'), dtype=np.float32)
    best = None
    for w in range(900, 1060, 4):
        h = round(tk.height * w / tk.width)
        t = np.asarray(tk.convert('L').resize((w, h), Image.BILINEAR), dtype=np.float32)[::6, ::6]
        for oy in range(150, 700, 6):
            for ox in range(40, 200, 6):
                if oy + h > S.shape[0] or ox + w > S.shape[1]:
                    continue
                e = float(np.mean(np.abs(S[oy:oy + h:6, ox:ox + w:6][:t.shape[0], :t.shape[1]] - t)))
                if best is None or e < best[0]:
                    best = (e, w, h, ox, oy)
    e, w, h, ox, oy = best
    for ww in range(w - 4, w + 5):
        hh = round(tk.height * ww / tk.width)
        t = np.asarray(tk.convert('L').resize((ww, hh), Image.BILINEAR), dtype=np.float32)[::2, ::2]
        for oy2 in range(oy - 6, oy + 7):
            for ox2 in range(ox - 6, ox + 7):
                if oy2 < 0 or ox2 < 0 or oy2 + hh > S.shape[0] or ox2 + ww > S.shape[1]:
                    continue
                e2 = float(np.mean(np.abs(S[oy2:oy2 + hh:2, ox2:ox2 + ww:2][:t.shape[0], :t.shape[1]] - t)))
                if e2 < best[0]:
                    best = (e2, ww, hh, ox2, oy2)
    e, w, h, ox, oy = best
    a = np.asarray(shot.crop((ox, oy, ox + w, oy + h)), dtype=np.float32)
    b = np.asarray(tk.resize((w, h), Image.BILINEAR), dtype=np.float32)
    diff = np.abs(a - b).max(axis=2)
    # coarse grid of residuals to localize disagreements (8x12 cells)
    gy, gx = 12, 8
    cells = [[round(float(diff[i * h // gy:(i + 1) * h // gy, j * w // gx:(j + 1) * w // gx].mean()), 1) for j in range(gx)] for i in range(gy)]
    out[cid] = {'meanAbs': round(e, 2), 'fit': {'w': w, 'h': h, 'x': ox, 'y': oy}, 'p99': round(float(np.percentile(diff, 99)), 1),
                'worstCell': max((v, i, j) for i, row in enumerate(cells) for j, v in enumerate(row))}
    sb = Image.new('RGB', (w * 3 + 20, h), 'white')
    sb.paste(Image.fromarray(a.astype('uint8')), (0, 0))
    sb.paste(Image.fromarray(b.astype('uint8')), (w + 10, 0))
    sb.paste(Image.fromarray(np.clip(diff * 3, 0, 255).astype('uint8')).convert('RGB'), (2 * w + 20, 0))
    sb.thumbnail((1200, 700))
    sb.save(f'{d}/{cid}-compare.png')
    print(cid, json.dumps(out[cid]))
json.dump(out, open(f'{d}/compare-{"-".join(sys.argv[2:])}.json', 'w'), indent=1)
