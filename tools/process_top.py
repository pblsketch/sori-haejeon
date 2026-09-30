# -*- coding: utf-8 -*-
"""위에서 내려다본 배 그림(판 위 '섬과 암초 바다 지도'용, T20)을 게임용 투명 webp로 만든다.

    python tools/process_top.py

원본(Codex 생성, 저장소에 올리지 않음): assets/raw/top/{ship3,ship3_burnt,boat1,boat1_burnt}.png
  (프롬프트: tools/prompts/top/*.txt, 기록: assets/prompts.md 'v3: 위에서 본 배')
결과 assets/img/:
  top_ship3(_burnt)   세 칸 배 한 척(세 토막 이음매가 있는 구축함, 뱃머리 오른쪽)
  top_boat1(_burnt)   한 칸 배(경비정)
  top_stern / top_mid / top_bow (+_burnt)   top_ship3를 이음매 두 줄에서 잘라 만든 배꼬리·가운데·뱃머리 조각
    · 떨어진 두 칸 배 = 뱃머리 + 배꼬리, 가라앉기 전 명중 = 어느 배든 가운데 조각
  배경 지우기는 tools/process_assets.py의 자홍 크로마키(key_out)를 그대로 쓴다.
  온전한 배와 불탄 배는 같은 자르기 상자를 써서 크기·위치가 같다(바꿔 끼워도 흔들리지 않음).
"""
import os
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_assets import key_out, smoke_tint  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', 'raw', 'top')
OUT = os.path.join(ROOT, 'assets', 'img')
MAXW = 768


def load(name):
    im = key_out(Image.open(os.path.join(RAW, name + '.png')).convert('RGB'))
    return smoke_tint(im) if name.endswith('_burnt') else im


def bbox(im, th=40):
    return im.getchannel('A').point(lambda v: 255 if v > th else 0).getbbox()


def save(im, name, maxw=MAXW):
    if im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    p = os.path.join(OUT, name + '.webp')
    im.save(p, 'WEBP', quality=86, method=6, exact=False)
    print(f'  {name}.webp {im.size[0]}x{im.size[1]} {os.path.getsize(p) // 1024}KB')


def pad_box(b, pad, w, h):
    return (max(0, b[0] - pad), max(0, b[1] - pad), min(w, b[2] + pad), min(h, b[3] + pad))


def pair(base):
    """온전한 배·불탄 배를 같은 상자로 잘라 저장(연기까지 들어가게 두 그림 상자의 합)."""
    a, b = load(base), load(base + '_burnt')
    ba, bb = bbox(a), bbox(b)
    box = pad_box((min(ba[0], bb[0]), min(ba[1], bb[1]), max(ba[2], bb[2]), max(ba[3], bb[3])), 12, a.width, a.height)
    save(a.crop(box), 'top_' + base)
    save(b.crop(box), 'top_' + base + '_burnt')
    return a, b, ba


def seams(im, hb):
    """세 칸 배의 이음매(갑판을 가로지르는 짙은 세로 선) 두 줄의 x. 선체 가운데 줄들에서 짙은 점이 가장 많은 열."""
    a = np.asarray(im).astype(np.float32)
    x0, y0, x1, y1 = hb
    h = y1 - y0
    band = a[y0 + int(h * .12): y1 - int(h * .12), x0:x1]
    lum = band[..., :3].mean(axis=2)
    dark = ((lum < 90) & (band[..., 3] > 200)).sum(axis=0)
    L = x1 - x0
    out = []
    for lo, hi in ((.22, .45), (.55, .78)):
        i0, i1 = int(L * lo), int(L * hi)
        out.append(x0 + i0 + int(np.argmax(dark[i0:i1])))
    return out


def pieces(a, b, hb):
    s1, s2 = seams(a, hb)
    print(f'  이음매 x = {s1}, {s2} (선체 {hb[0]}~{hb[2]}, 비율 {(s1 - hb[0]) / (hb[2] - hb[0]):.2f} · {(s2 - hb[0]) / (hb[2] - hb[0]):.2f})')
    y0, y1 = max(0, hb[1] - 12), min(a.height, hb[3] + 12)
    parts = {'stern': (hb[0] - 12, s1), 'mid': (s1, s2), 'bow': (s2, hb[2] + 12)}
    for n, (l, r) in parts.items():
        for im, suf in ((a, ''), (b, '_burnt')):
            save(im.crop((max(0, l), y0, min(im.width, r), y1)), 'top_' + n + suf, 1024)


def preview(path):
    """견본 한 장: 밝은 바탕 / 바다 바탕 위에 한 칸 너비 120px·60px로 줄여 늘어놓는다(작게 봐도 배로 읽히는지)."""
    names = ['top_boat1', 'top_ship3', 'top_stern', 'top_mid', 'top_bow']
    bgs = [('#F2F6F6', 'light'), ('#A9D3E2', 'sea')]
    cw, rh = 300, 120
    sheet = Image.new('RGB', (cw * len(names), rh * 4 * len(bgs) + 10), 'white')
    y = 0
    for col, _ in bgs:
        for burnt in ('', '_burnt'):
            for size in (120, 60):
                row = Image.new('RGB', (cw * len(names), rh // 2 if size == 60 else rh), col)
                for i, n in enumerate(names):
                    im = Image.open(os.path.join(OUT, n + burnt + '.webp')).convert('RGBA')
                    k = (size * 2 if n == 'top_ship3' else size) / im.width  # 한 칸(조각·경비정) = size, 세 칸 배 = 두 배 길이
                    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
                    row.paste(im, (i * cw + (cw - im.width) // 2, (row.height - im.height) // 2), im)
                sheet.paste(row, (0, y)); y += row.height
        y += 5
    sheet = sheet.crop((0, 0, sheet.width, y))
    sheet.save(path, optimize=True)
    print('  견본', path, sheet.size)


def crop_tow():
    """tests/shots/bc-c2-tow-*.png(가로 1920 전체 캡처)에서 떨어진 두 칸 배 부분만 잘라 design/board-concepts/c2-tow-*.png로.
    자르는 상자는 판 쪽(board-concepts-c2.js)이 window.__towRects로 알려 준 값(1920 기준 CSS px)을 그림 배율로 옮긴 것."""
    box = (641 - 150, 96, 250 + 300, 610)  # 여린입천장 열 + 왼쪽 두 칸(같은 줄·암초 비교), 파열~비음
    for v in ('dotted', 'badges'):
        im = Image.open(os.path.join(ROOT, 'tests', 'shots', f'bc-c2-tow-{v}.png')).convert('RGB')
        k = im.width / 1920
        x, y, w, h = box
        im.crop((round(x * k), round(y * k), round((x + w) * k), round((y + h) * k))).save(
            os.path.join(ROOT, 'design', 'board-concepts', f'c2-tow-{v}.png'), optimize=True)
        print('  c2-tow-' + v)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    if '--crop-tow' in sys.argv:
        crop_tow(); sys.exit(0)
    if '--preview' in sys.argv:
        preview(os.path.join(ROOT, 'design', 'board-concepts', 'top-sprites.png'))
        sys.exit(0)
    print('세 칸 배'); a, b, hb = pair('ship3')
    print('조각'); pieces(a, b, hb)
    print('한 칸 배'); pair('boat1')
