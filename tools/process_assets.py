# -*- coding: utf-8 -*-
"""assets/raw/v2/*.png(Codex 생성 원본, v2 디자인 개편)를 게임용 webp로 만든다.

    python tools/process_assets.py            # 모두 만들기
    python tools/process_assets.py --check    # 만든 파일의 크기·투명도·이음매 점검만

- ship3 / ship2 / ship1 (+ _burnt) → 자홍(#FF00FF) 단색 배경을 지워 투명하게(불탄 배는 연기의 보랏빛도 지움), 여백을 잘라 가로 1024 이하
- splash → 4열×2행 견본을 칸별로 잘라 배경을 지우고, 256×256 칸 8개를 가로 한 줄(2048×256)로 잇는다
- sea_tile → 이음매 없이 반복되도록 가장자리를 섞은 뒤 1024×1024
- title / result_bg → 16:9로 자른 뒤 1920×1080
- title_phone → 양옆을 조금만 자르고 빈 하늘을 세로로 늘려 9:16(1080×1920)으로(배가 잘리지 않게)
원본은 assets/raw/v2(저장소에 올리지 않음), 결과는 assets/img/<이름>.webp.
"""
import os
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', 'raw', 'v2')  # v1 원본은 assets/raw 바로 아래(프롬프트 기록: assets/prompts.md)
OUT = os.path.join(ROOT, 'assets', 'img')

SHIPS = ['ship3', 'ship2', 'ship1', 'ship3_burnt', 'ship2_burnt', 'ship1_burnt']
KEY = np.array([255, 0, 255], dtype=np.float32)
SPLASH_FRAME = 256
SPLASH_FRAMES = 8


def raw(name):
    return Image.open(os.path.join(RAW, name + '.png')).convert('RGB')


def save_webp(im, name, q=82):
    path = os.path.join(OUT, name + '.webp')
    if im.mode == 'RGBA':
        im.save(path, 'WEBP', quality=q, method=6, exact=False)
    else:
        im.convert('RGB').save(path, 'WEBP', quality=q, method=6)
    print(f'  {name}.webp {im.size[0]}x{im.size[1]} {im.mode} {os.path.getsize(path) // 1024}KB')


# ---------- 배경 지우기(자홍 단색 크로마키) ----------

def key_out(im):
    """자홍 배경을 투명하게.
    그림의 한 점 = (1-f)·본래 색 + f·자홍 으로 보고, 본래 색이 무채색에 가깝다고 두면 f = (min(R,B) - G) / 255.
    배(회색·흰색·주홍·옥색·쪽빛)와 불꽃(주황)은 모두 min(R,B) <= G라 f = 0이 되어 지워지지 않고,
    난간 사이에 갇힌 자홍, 자홍이 섞인 연기·물보라 가장자리는 본래 색(회색·흰색)으로 되돌리며 반투명이 된다."""
    a = np.asarray(im, dtype=np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    f = np.clip((np.minimum(r, b) - g) / 255.0, 0, 1)
    f = np.where(f < 0.04, 0.0, f)          # 압축 잡티는 무시
    f = np.where(f > 0.85, 1.0, f)          # 거의 순수한 자홍은 완전히 투명
    alpha = 1 - f
    al = np.clip(alpha, 1e-3, 1)[..., None]
    rgb = np.clip((a - f[..., None] * KEY) / al, 0, 255)
    rgb = np.where(alpha[..., None] > 0, rgb, 0)
    # 외톨이 잡티(몇 픽셀짜리 불투명 점) 지우기
    solid = alpha > 0.1
    lab, n = ndimage.label(solid)
    if n:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        tiny = np.isin(lab, np.nonzero(sizes < 12)[0] + 1)
        alpha = np.where(tiny, 0.0, alpha)
    out = np.dstack([rgb, alpha[..., None] * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def trim(im, pad=16):
    bbox = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def fit_width(im, w):
    if im.width <= w:
        return im
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def smoke_tint(im):
    """불탄 배의 연기에 남은 보랏빛(자홍 번짐, R·B가 모두 G보다 큼)을 푸른 회색으로 되돌린다.
    배의 색(회색·흰색·쪽빛·청록·주황 불씨)은 R·B가 함께 G를 넘지 않아 건드리지 않는다."""
    a = np.array(im).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    purple = (r > g) & (b > g)
    a[..., 0] = np.where(purple, g, r)
    a[..., 2] = np.where(purple, g + 0.35 * (b - g), b)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def ships():
    for n in SHIPS:
        if not os.path.exists(os.path.join(RAW, n + '.png')):
            print('  (없음)', n)
            continue
        im = key_out(raw(n))
        if n.endswith('_burnt'):
            im = smoke_tint(im)
        save_webp(fit_width(trim(im), 1024), n, 84)


def water_tint(im):
    """물 색(흰색·옥색·쪽빛)은 R이 G보다 크지 않다. 남은 보랏빛(자홍 번짐)을 R <= G로 눌러 없앤다."""
    a = np.array(im)
    a[..., 0] = np.minimum(a[..., 0], a[..., 1])
    return Image.fromarray(a, 'RGBA')


def splash():
    im = raw('splash')
    cols, rows = 4, 2
    cw, ch = im.width / cols, im.height / rows
    sheet = Image.new('RGBA', (SPLASH_FRAME * SPLASH_FRAMES, SPLASH_FRAME), (0, 0, 0, 0))
    cells = [water_tint(key_out(im.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))))
             for r in range(rows) for c in range(cols)]
    # 모든 칸을 같은 배율·같은 바닥선으로(애니메이션이 흔들리지 않게)
    boxes = [c.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox() for c in cells]
    wmax = max(b[2] - b[0] for b in boxes if b)
    hmax = max(b[3] - b[1] for b in boxes if b)
    scale = (SPLASH_FRAME - 16) / max(wmax, hmax)
    base = max(b[3] for b in boxes if b)  # 공통 바닥선(원본 칸 좌표)
    for i, (c, b) in enumerate(zip(cells, boxes)):
        if not b:
            continue
        part = c.crop(b)
        part = part.resize((max(1, round(part.width * scale)), max(1, round(part.height * scale))), Image.LANCZOS)
        x = i * SPLASH_FRAME + round(SPLASH_FRAME / 2 - part.width / 2)
        y = round(SPLASH_FRAME - 8 - (base - b[1]) * scale)
        sheet.alpha_composite(part, (x, max(0, y)))
    save_webp(sheet, 'splash', 86)


# ---------- 바다 질감: 이음매 없애기 ----------

def seam_rank(a):
    """이어 붙인 경계(오른쪽 끝↔왼쪽 끝, 아래↔위)의 차이가 안쪽 이웃 줄 차이들 가운데 몇 번째인지(0~1).
    1이면 경계가 어느 안쪽 줄보다도 튄다(이음매가 보인다). 가로·세로 중 큰 값을 돌려준다."""
    a = a.astype(np.float32)
    cols = np.abs(np.diff(a, axis=1)).mean(axis=(0, 2))
    rows = np.abs(np.diff(a, axis=0)).mean(axis=(1, 2))
    ec = np.abs(a[:, 0] - a[:, -1]).mean()
    er = np.abs(a[0] - a[-1]).mean()
    return max((cols < ec).mean(), (rows < er).mean())


def _min_cut(cost, step=4):
    """위에서 아래로 내려가는 비용이 가장 작은 세로 경로(줄마다 x 하나). 한 줄에 step칸까지 옆으로 움직인다."""
    h, w = cost.shape
    acc = cost.copy()
    back = np.zeros((h, w), dtype=np.int32)
    for y in range(1, h):
        prev = acc[y - 1]
        best = np.full(w, np.inf, dtype=np.float32)
        arg = np.zeros(w, dtype=np.int32)
        for d in range(-step, step + 1):
            sh = np.full(w, np.inf, dtype=np.float32)
            if d >= 0:
                sh[:w - d] = prev[d:]
            else:
                sh[-d:] = prev[:w + d]
            better = sh < best
            best[better] = sh[better]
            arg[better] = d
        acc[y] += best
        back[y] = np.arange(w) + arg
    path = np.zeros(h, dtype=np.int32)
    path[-1] = int(np.argmin(acc[-1]))
    for y in range(h - 1, 0, -1):
        path[y - 1] = back[y, path[y]]
    return path


def _wrap_x(a):
    """가로 이음매 없애기: 가장자리는 반 칸 민 그림(B), 가운데는 원본(A)을 쓰고,
    둘이 바뀌는 곳을 두 그림이 거의 같은(무늬가 없는) 곳을 지나는 경로로 정한다(겹침 흐림 없음)."""
    h, w = a.shape[:2]
    b = np.roll(a, w // 2, axis=1)
    cost = np.abs(a - b).sum(axis=2)
    l0, l1 = int(w * 0.10), int(w * 0.40)
    r0, r1 = int(w * 0.60), int(w * 0.90)
    left = _min_cut(cost[:, l0:l1]) + l0
    right = _min_cut(cost[:, r0:r1]) + r0
    x = np.arange(w)[None, :]
    use_a = (x >= left[:, None]) & (x < right[:, None])
    return np.where(use_a[..., None], a, b)


def make_seamless(im):
    a = np.asarray(im, dtype=np.float32)
    a = _wrap_x(a)
    a = _wrap_x(a.transpose(1, 0, 2)).transpose(1, 0, 2)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGB')


def sea_tile():
    im = raw('sea_tile')
    s = min(im.size)
    im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width - s) // 2 + s, (im.height - s) // 2 + s))
    im = im.resize((1024, 1024), Image.LANCZOS)
    before = seam_rank(np.asarray(im))
    fixed = make_seamless(im)
    after = seam_rank(np.asarray(fixed))
    print(f'  sea_tile 이음매 순위: 전 {before:.2f} → 후 {after:.2f} (1이면 경계가 튄다)')
    # 손실 압축은 가장자리를 따로 뭉개 이음매를 되살리므로 무손실로 저장한다
    path = os.path.join(OUT, 'sea_tile.webp')
    fixed.save(path, 'WEBP', lossless=True, quality=100, method=6)
    print(f'  sea_tile.webp {fixed.size[0]}x{fixed.size[1]} RGB {os.path.getsize(path) // 1024}KB (무손실)')


# ---------- 16:9 배경 / 9:16 세로 시작 그림 ----------

def wide(name, aw=16, ah=9, size=(1920, 1080)):
    """가운데를 aw:ah 비율로 잘라 size로 맞춘다(기본 16:9 → 1920×1080)."""
    im = raw(name)
    tw = im.width
    th = round(tw * ah / aw)
    if th > im.height:
        th = im.height
        tw = round(th * aw / ah)
    l = (im.width - tw) // 2
    t = (im.height - th) // 2
    im = im.crop((l, t, l + tw, t + th)).resize(size, Image.LANCZOS)
    save_webp(im, name, 82)


def tall(name, size=(1080, 1920), side=24):
    """세로 시작 그림: 원본(2:3)을 9:16으로 만들 때 양옆을 크게 자르면 배가 잘리므로,
    양옆은 side 픽셀만 자르고 모자란 높이는 위쪽 빈 하늘(무늬 없는 단색 번짐)만 세로로 늘려 채운다."""
    im = raw(name)
    a = np.asarray(im, dtype=np.float32)
    lum = a.mean(axis=2)
    horizon = int(np.argmax(lum.mean(axis=1) < 170))           # 밝은 하늘 → 어두운 바다로 바뀌는 줄
    dev = np.abs(lum[:horizon] - np.median(lum[:horizon], axis=1, keepdims=True))
    busy = np.nonzero((dev > 25).sum(axis=1) > 2)[0]           # 하늘에 무엇(돛대 등)이 처음 나오는 줄
    sky_end = max(8, (int(busy[0]) if len(busy) else horizon) - 20)
    cw = im.width - 2 * side
    ch = round(cw * size[1] / size[0])
    extra = ch - im.height
    if extra > 0:
        sky = im.crop((0, 0, im.width, sky_end)).resize((im.width, sky_end + extra), Image.LANCZOS)
        grown = Image.new('RGB', (im.width, ch))
        grown.paste(sky, (0, 0))
        grown.paste(im.crop((0, sky_end, im.width, im.height)), (0, sky_end + extra))
        im = grown
    t = (im.height - ch) // 2
    print(f'  {name}: 수평선 {horizon}, 하늘 {sky_end}줄 → {sky_end + max(0, extra)}줄로 늘림, 양옆 {side}px 자름')
    save_webp(im.crop((side, t, side + cw, t + ch)).resize(size, Image.LANCZOS), name, 82)


# ---------- 점검 ----------

EXPECT = {n: 'RGBA' for n in SHIPS + ['splash']}
EXPECT.update({'sea_tile': 'RGB', 'title': 'RGB', 'title_phone': 'RGB', 'result_bg': 'RGB'})
SIZE = {'title': (1920, 1080), 'result_bg': (1920, 1080), 'title_phone': (1080, 1920)}


def check():
    ok = True
    for n, mode in EXPECT.items():
        p = os.path.join(OUT, n + '.webp')
        if not os.path.exists(p):
            print('FAIL 없음', n); ok = False; continue
        im = Image.open(p)
        has_alpha = im.mode == 'RGBA'
        msg = f'{n}: {im.size[0]}x{im.size[1]} {im.mode} {os.path.getsize(p) // 1024}KB'
        good = True
        if mode == 'RGBA':
            al = np.asarray(im.getchannel('A')) if has_alpha else None
            corners_clear = has_alpha and all(al[y, x] == 0 for y in (0, -1) for x in (0, -1))
            opaque = has_alpha and (al > 250).mean()
            msg += f' 불투명 {opaque:.0%}' if has_alpha else ''
            good = has_alpha and corners_clear and 0.03 < opaque < 0.95
            if n.startswith('ship'):
                good = good and im.width <= 1024
            # 자홍이 남은 곳(보이는 픽셀 중 R·B가 G보다 크게 높은 곳)이 거의 없어야 한다
            if has_alpha:
                a = np.asarray(im.convert('RGBA')).astype(np.int16)
                vis = a[..., 3] > 128
                mag = vis & (a[..., 0] - a[..., 1] > 60) & (a[..., 2] - a[..., 1] > 60)
                left = mag.sum() / max(1, vis.sum())
                msg += f' 자홍 남음 {left:.2%}'
                good = good and left < 0.005
            if n == 'splash':
                good = good and im.size == (SPLASH_FRAME * SPLASH_FRAMES, SPLASH_FRAME)
        elif n == 'sea_tile':
            sc = seam_rank(np.asarray(im.convert('RGB')))
            msg += f' 이음매 순위 {sc:.2f}'
            good = im.size == (1024, 1024) and sc < 0.99
        else:
            good = im.size == SIZE[n]
        print(('PASS ' if good else 'FAIL ') + msg)
        ok = ok and good
    return ok


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    if '--check' not in sys.argv:
        print('배'); ships()
        print('물보라'); splash()
        print('바다 질감'); sea_tile()
        print('배경'); wide('title'); wide('result_bg'); tall('title_phone')
    print('점검')
    sys.exit(0 if check() else 1)
