# -*- coding: utf-8 -*-
"""링크 미리 보기 그림(카카오톡·문자·SNS에 주소를 붙였을 때 뜨는 썸네일)을 만든다.

    python tools/make_og.py        (저장소 맨 위 폴더에서)

입력: assets/img/title.webp(시작 화면 그림, 1920×1080), tools/fonts_src/의 원본 글꼴(Hahmlet·Pretendard,
      없으면 먼저 python tools/build_fonts.py를 한 번 돌리면 받아진다)
결과: assets/img/og-image.jpg  1200×630(카카오톡·페이스북 권장 비율 1.91:1), JPEG — 미리 보기 서비스가 webp를 못 읽는 경우가 있어서.
      제목 '음운 해전'(Hahmlet 800) + 한 줄 소개(Pretendard). 게임 이름이나 소개를 바꾸면 이 파일의 TITLE·SUB를 고치고 다시 돌린다.
index.html의 og:image·twitter:image가 이 그림의 **절대 주소**(https://pblsketch.github.io/sori-haejeon/assets/img/og-image.jpg)를 가리킨다.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'fonts_src')
OUT = os.path.join(ROOT, 'assets', 'img', 'og-image.jpg')
W, H = 1200, 630
TITLE = '음운 해전'
SUB = '조음 위치·방법·세기를 골라 음운을 만들어 쏘고, 신호로 숨은 배를 찾는 게임'
INK = (24, 53, 64)        # base.css --ink
SEA = (27, 95, 130)       # base.css --sea


def main():
    im = Image.open(os.path.join(ROOT, 'assets', 'img', 'title.webp')).convert('RGB')
    # 1920×1080 → 1200 너비로 줄인 뒤 위아래를 잘라 1200×630(배가 보이는 아래쪽을 조금 더 남긴다)
    k = W / im.width
    im = im.resize((W, round(im.height * k)), Image.LANCZOS)
    top = round((im.height - H) * 0.55)
    im = im.crop((0, top, W, top + H))

    d = ImageDraw.Draw(im, 'RGBA')
    title = ImageFont.truetype(os.path.join(SRC, 'Hahmlet[wght].ttf'), 132)
    try:
        title.set_variation_by_axes([800])
    except Exception:
        pass
    sub = ImageFont.truetype(os.path.join(SRC, 'Pretendard-SemiBold.otf'), 30)

    # 제목: 하늘 쪽 가운데
    tb = d.textbbox((0, 0), TITLE, font=title)
    tx = (W - (tb[2] - tb[0])) // 2 - tb[0]
    d.text((tx, 52 - tb[1]), TITLE, font=title, fill=INK)

    # 소개 한 줄: 아래쪽 흰 띠 위
    sb = d.textbbox((0, 0), SUB, font=sub)
    sw, sh = sb[2] - sb[0], sb[3] - sb[1]
    pad_x, pad_y = 28, 16
    bx0 = (W - sw) // 2 - pad_x
    by0 = H - 40 - sh - pad_y * 2
    d.rounded_rectangle((bx0, by0, bx0 + sw + pad_x * 2, by0 + sh + pad_y * 2), radius=16, fill=(255, 255, 255, 235))
    d.text((bx0 + pad_x - sb[0], by0 + pad_y - sb[1]), SUB, font=sub, fill=SEA)

    im.save(OUT, 'JPEG', quality=86, optimize=True, progressive=True)
    print(OUT, im.size, os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
    main()
