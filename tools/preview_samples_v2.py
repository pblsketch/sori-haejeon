# -*- coding: utf-8 -*-
"""v2 그림체 견본 축소본(선생님께 보여 드릴 것)을 만든다.

    python tools/preview_samples_v2.py [a b c]

- assets/raw/v2/{s}-title.png -> design/style-samples-v2/{s}-title.png (가로 900)
- assets/raw/v2/{s}-ship.png  -> 자홍 배경을 빼서 바탕색 #F2F6F6 위에 큰 그림 + 작은 크기(200/120/72px) 시험을 나란히
"""
import os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from process_assets import key_out  # noqa: E402

RAW = os.path.join(ROOT, 'assets', 'raw', 'v2')
OUT = os.path.join(ROOT, 'design', 'style-samples-v2')
os.makedirs(OUT, exist_ok=True)
BG = (0xF2, 0xF6, 0xF6)
WHITE = (255, 255, 255)

for s in sys.argv[1:] or ['a', 'b', 'c']:
    t = os.path.join(RAW, f'{s}-title.png')
    if os.path.exists(t):
        im = Image.open(t).convert('RGB')
        h = round(im.height * 900 / im.width)
        im.resize((900, h), Image.LANCZOS).save(os.path.join(OUT, f'{s}-title.png'), optimize=True)
        print(s, 'title', im.size)
    p = os.path.join(RAW, f'{s}-ship.png')
    if os.path.exists(p):
        src = Image.open(p).convert('RGB')
        ship = key_out(src)
        bbox = ship.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
        ship = ship.crop(bbox)
        a = np.asarray(ship)[..., 3]
        print(s, 'ship', src.size, 'bbox', bbox, 'opaque%', round((a > 128).mean() * 100, 1))
        big_w = 560
        big = ship.resize((big_w, round(ship.height * big_w / ship.width)), Image.LANCZOS)
        smalls = [ship.resize((w, max(1, round(ship.height * w / ship.width))), Image.LANCZOS) for w in (200, 120, 72)]
        H = max(big.height, sum(x.height for x in smalls) + 60) + 40
        canvas = Image.new('RGB', (900, H), BG)
        canvas.paste(big, (20, (H - big.height) // 2), big)
        # right column: small sizes on white panel and on sea colour
        y = 20
        for sm in smalls:
            canvas.paste(Image.new('RGB', (sm.width + 16, sm.height + 16), WHITE), (620, y - 8))
            canvas.paste(sm, (628, y), sm)
            y += sm.height + 24
        canvas.save(os.path.join(OUT, f'{s}-ship.png'), optimize=True)
