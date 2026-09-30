# -*- coding: utf-8 -*-
"""게임에 쓰인 글자만 남긴 부분 글꼴(woff2)과 css/fonts.css를 만든다.

    python tools/build_fonts.py        (저장소 맨 위 폴더에서)

원본 글꼴(모두 SIL Open Font License 1.1)은 tools/fonts_src/에 받아 둔다(저장소에는 올리지 않음).
  - Hahmlet[wght].ttf          https://github.com/google/fonts/tree/main/ofl/hahmlet
                               (가변 글꼴. 제목·표제 400/700 → SoriTitle, 판 위 소리 표기 가장 굵게 → SoriSound)
  - GowunBatang-Regular.ttf    https://github.com/google/fonts/tree/main/ofl/gowunbatang  (본문·안내 → SoriBody)
  - GowunBatang-Bold.ttf       〃 (본문 굵게 → SoriBody 700)
글자는 index.html의 글, js/ 아래 모든 .js의 문자열(주석 제외), css/ 아래 content 문자열에서 모으고,
ASCII 인쇄 문자·자주 쓰는 문장 부호·현대 한글 호환 자모(ㄱ~ㅎ, ㅏ~ㅣ)를 늘 넣는다.
화면 문구를 고쳐 새 글자가 생겼다면 이 스크립트를 다시 돌리세요(몇 초면 끝나고, 결과는 늘 같다).

OFL은 수정본(부분 글꼴 포함)이 원래 이름(예약 글꼴 이름 포함)을 글꼴 이름으로 쓰지 못하게 하므로
글꼴 이름을 Sori…로 바꾼다. 저작권 표시(name 0)와 라이선스 안내는 그대로 둔다.
"""
import os
import re
import shutil
import sys
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'fonts_src')
OUT = os.path.join(ROOT, 'assets', 'fonts')
CSS_OUT = os.path.join(ROOT, 'css', 'fonts.css')

GF = 'https://github.com/google/fonts/raw/main/ofl/'
GF_RAW = 'https://raw.githubusercontent.com/google/fonts/main/ofl/'
URLS = {
    'Hahmlet[wght].ttf': GF + 'hahmlet/Hahmlet%5Bwght%5D.ttf',
    'GowunBatang-Regular.ttf': GF + 'gowunbatang/GowunBatang-Regular.ttf',
    'GowunBatang-Bold.ttf': GF + 'gowunbatang/GowunBatang-Bold.ttf',
    'OFL-Hahmlet.txt': GF_RAW + 'hahmlet/OFL.txt',
    'OFL-GowunBatang.txt': GF_RAW + 'gowunbatang/OFL.txt',
}

# 원래 글꼴 이름(수정본의 이름 칸에 남으면 안 되는 말)
ORIGINAL_NAMES = ('Hahmlet', 'Gowun Batang', 'GowunBatang')

# 늘 넣는 글자: ASCII 인쇄 문자, 문장 부호·기호, 현대 한글 호환 자모(ㄱ~ㅎ 30자, ㅏ~ㅣ 21자)
ALWAYS = (
    set(chr(c) for c in range(0x20, 0x7F))
    | set('·…—–‘’“”「」『』〈〉《》→←↑↓○●◎△▲▼▶◀×✕✓·ㆍ\u00a0')
    | set(chr(c) for c in range(0x3131, 0x314F))   # ㄱ ~ ㅎ
    | set(chr(c) for c in range(0x314F, 0x3164))   # ㅏ ~ ㅣ
)


def download():
    os.makedirs(SRC, exist_ok=True)
    for name, url in URLS.items():
        p = os.path.join(SRC, name)
        if not os.path.exists(p):
            print('내려받는 중', name)
            urllib.request.urlretrieve(url, p)


# ── 글자 모으기 ────────────────────────────────────────────────

def _unescape_js(s):
    """JS 문자열 속 \\uXXXX, \\u{…}, \\xXX 이스케이프를 실제 글자로 바꾼다(모르는 이스케이프는 그대로)."""
    def rep(m):
        g = m.group(1) or m.group(2) or m.group(3)
        try:
            return chr(int(g, 16))
        except ValueError:
            return m.group(0)
    return re.sub(r'\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})', rep, s)


def js_strings(src):
    """JS 소스에서 주석을 건너뛰고 문자열('…', "…", `…`)과 정규식 리터럴 속 글자만 돌려준다.
    완전한 파서는 아니지만 이 프로젝트의 평범한 스크립트에는 충분하다."""
    out = []
    i, n = 0, len(src)
    prev = ''  # 공백이 아닌 바로 앞 글자(정규식/나눗셈 구분용)
    while i < n:
        c = src[i]
        if src.startswith('//', i):
            j = src.find('\n', i)
            i = n if j < 0 else j
            continue
        if src.startswith('/*', i):
            j = src.find('*/', i + 2)
            i = n if j < 0 else j + 2
            continue
        if c in '\'"`':
            j = i + 1
            buf = []
            while j < n and src[j] != c:
                if src[j] == '\\' and j + 1 < n:
                    buf.append(src[j:j + 2])
                    j += 2
                    continue
                if c != '`' and src[j] == '\n':
                    break
                buf.append(src[j])
                j += 1
            out.append(_unescape_js(''.join(buf)))
            i = j + 1
            prev = c
            continue
        if c == '/' and (prev == '' or prev in '(,=:[!&|?{};+-*%<>~^'):
            # 정규식 리터럴: 안의 글자(한글 범위 등)도 모아 둔다
            j = i + 1
            in_cls = False
            while j < n and src[j] != '\n':
                if src[j] == '\\':
                    j += 2
                    continue
                if src[j] == '[':
                    in_cls = True
                elif src[j] == ']':
                    in_cls = False
                elif src[j] == '/' and not in_cls:
                    break
                j += 1
            out.append(_unescape_js(src[i + 1:j]))
            i = j + 1
            prev = '/'
            continue
        if not c.isspace():
            prev = c
        i += 1
    return out


def html_text(src):
    """HTML에서 주석·스크립트·스타일을 빼고, 태그 밖 글과 사람이 읽는 속성 값을 돌려준다."""
    src = re.sub(r'<!--.*?-->', '', src, flags=re.S)
    src = re.sub(r'<(script|style)\b[^>]*>.*?</\1>', '', src, flags=re.S | re.I)
    out = re.findall(r'\b(?:title|content|alt|placeholder|aria-label|value|label)\s*=\s*"([^"]*)"', src)
    out.append(re.sub(r'<[^>]*>', ' ', src))
    return out


def css_content(src):
    """CSS에서 content: "…" 문자열만 돌려준다(주석 제외)."""
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    return [_unescape_css(a or b) for a, b in re.findall(r'content\s*:[^;{}]*?(?:"([^"]*)"|\'([^\']*)\')', src)]


def _unescape_css(s):
    return re.sub(r'\\([0-9a-fA-F]{1,6})\s?', lambda m: chr(int(m.group(1), 16)), s)


def walk(folder, ext):
    base = os.path.join(ROOT, folder)
    for d, _, files in os.walk(base):
        for f in sorted(files):
            if f.endswith(ext):
                yield os.path.join(d, f)


def used_chars():
    texts = []
    with open(os.path.join(ROOT, 'index.html'), encoding='utf-8') as f:
        texts += html_text(f.read())
    for p in walk('js', '.js'):
        with open(p, encoding='utf-8') as f:
            texts += js_strings(f.read())
    for p in walk('css', '.css'):
        if os.path.abspath(p) == os.path.abspath(CSS_OUT):
            continue
        with open(p, encoding='utf-8') as f:
            texts += css_content(f.read())
    found = set(''.join(texts))
    chars = {c for c in found | ALWAYS if ord(c) >= 0x20 and not (0x7F <= ord(c) < 0xA0)}
    return chars, found


# ── 글꼴 만들기 ────────────────────────────────────────────────

def rename(font, family, style):
    """이름 칸을 새 이름으로 바꾼다. 1·2는 family/style, 4·6은 전체 이름, 16·17·21·22·25는 지운다."""
    ps = family.replace(' ', '') + '-' + style.replace(' ', '')
    full = family + ('' if style == 'Regular' else ' ' + style)
    name = font['name']
    name.names = [r for r in name.names if r.nameID not in (16, 17, 21, 22, 25)]
    for r in name.names:
        if r.nameID == 1:
            r.string = family
        elif r.nameID == 2:
            r.string = style
        elif r.nameID == 3:
            r.string = ps + ';subset'
        elif r.nameID == 4:
            r.string = full
        elif r.nameID == 6:
            r.string = ps
    # 남은 이름 칸(저작권 0, 상표 7, 제작 8·9, 설명 10, 주소 11·12, 라이선스 13·14 제외)에 원래 이름이 남았는지 확인
    for r in name.names:
        if r.nameID in (0, 7, 8, 9, 10, 11, 12, 13, 14):
            continue
        s = r.toUnicode()
        if any(o in s for o in ORIGINAL_NAMES):
            r.string = s.replace('Gowun Batang', family).replace('GowunBatang', family.replace(' ', '')).replace('Hahmlet', family)
    if 'CFF ' in font:
        font['CFF '].cff.fontNames = [ps]


def build(src, out_name, unicodes, family, style, weight=None):
    font = TTFont(src)
    if 'fvar' in font:
        axis = next(a for a in font['fvar'].axes if a.axisTag == 'wght')
        w = max(axis.minValue, min(axis.maxValue, weight))
        font = instancer.instantiateVariableFont(font, {'wght': w}, updateFontNames=False)
        font['OS/2'].usWeightClass = int(w)
    cmap = font.getBestCmap()
    missing = sorted(c for c in unicodes if c not in cmap and chr(c) not in ' \u00a0')
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.name_languages = ['*']
    opts.notdef_outline = True
    opts.hinting = False
    opts.drop_tables += ['STAT']
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=sorted(unicodes))
    sub.subset(font)
    rename(font, family, style)
    font.flavor = 'woff2'
    font.recalcTimestamp = False  # 수정 시각을 원본 그대로 둬서 다시 돌려도 같은 파일이 나오게
    out = os.path.join(OUT, out_name)
    font.save(out)
    kept = len(font.getBestCmap())
    print(f'  {out_name:22s} {family} {style:8s} 글자 {kept:4d}개  {os.path.getsize(out) / 1024:6.1f} KB')
    return missing


def hahmlet_max_weight():
    font = TTFont(os.path.join(SRC, 'Hahmlet[wght].ttf'), lazy=True)
    axis = next(a for a in font['fvar'].axes if a.axisTag == 'wght')
    return int(axis.maxValue)


# (파일, 원본, 새 family, style, 굵기, @font-face의 font-weight 설명자)
def plan(max_w):
    return [
        ('title-400.woff2', 'Hahmlet[wght].ttf', 'SoriTitle', 'Regular', 400, '400'),
        ('title-700.woff2', 'Hahmlet[wght].ttf', 'SoriTitle', 'Bold', 700, '700'),
        (f'sound-{max_w}.woff2', 'Hahmlet[wght].ttf', 'SoriSound', 'Black', max_w, '100 900'),
        ('body-400.woff2', 'GowunBatang-Regular.ttf', 'SoriBody', 'Regular', None, '400'),
        ('body-700.woff2', 'GowunBatang-Bold.ttf', 'SoriBody', 'Bold', None, '700'),
    ]


def write_licenses():
    notes = {
        'OFL-Hahmlet.txt': ('Hahmlet', 'title-*.woff2(SoriTitle), sound-*.woff2(SoriSound)'),
        'OFL-GowunBatang.txt': ('Gowun Batang', 'body-*.woff2(SoriBody)'),
    }
    for name, (orig, files) in notes.items():
        with open(os.path.join(SRC, name), encoding='utf-8') as lic:
            text = lic.read().replace('\r\n', '\n').rstrip() + '\n'
        with open(os.path.join(OUT, name), 'w', encoding='utf-8', newline='\n') as f:
            f.write(f'assets/fonts의 {files}는 {orig}(SIL Open Font License 1.1)에서\n'
                    f'이 게임에 쓰인 글자만 남긴 수정본이다. OFL 규칙에 따라 글꼴 이름을 바꾸었다.\n'
                    f'아래는 원 글꼴의 저작권 표시와 라이선스 전문(원문 그대로)이다.\n'
                    + '=' * 72 + '\n' + text)
        print('  ' + name)


def write_css(rows):
    faces = []
    for out_name, _, family, _, _, weight_desc in rows:
        faces.append(f"@font-face {{ font-family: '{family}'; src: url('../assets/fonts/{out_name}') format('woff2'); "
                     f"font-weight: {weight_desc}; font-style: normal; font-display: swap; }}")
    css = (
        '/* 이 파일은 tools/build_fonts.py가 만든다. 손으로 고치지 말고 스크립트를 다시 돌리세요.\n'
        ' * 글꼴: Hahmlet → SoriTitle(제목·표제 400/700)·SoriSound(판 위 소리 표기, 가장 굵게),\n'
        ' *       Gowun Batang → SoriBody(본문·안내 400/700). 모두 OFL 1.1, 이름은 OFL 규칙대로 바꿈.\n'
        ' * 쓰는 법: index.html에서 css/base.css 다음에 이 파일을 불러온다.\n'
        ' *   base.css의 :root가 --font-title/--font-body/--font-sound를 원래 글꼴 이름으로 먼저 정하고,\n'
        ' *   아래 :root가 같은 변수를 덮어써 부분 글꼴로 바꾼다(뒤에 불러온 쪽이 이김).\n'
        ' *   변수의 주인은 base.css다. 여기서는 부분 글꼴 이름을 맨 앞에 더할 뿐이다.\n'
        ' * SoriSound는 가장 굵은 굵기 하나뿐이라 font-weight 100~900 어느 값이든 이 글꼴을 쓴다(가짜 굵게 없음). */\n'
        + '\n'.join(faces) + '\n'
        ':root {\n'
        "  --font-title: 'SoriTitle', 'Hahmlet', 'Noto Serif KR', serif;\n"
        "  --font-body: 'SoriBody', 'Gowun Batang', 'Noto Serif KR', serif;\n"
        "  --font-sound: 'SoriSound', 'Hahmlet', 'Noto Serif KR', serif; /* 판 위 소리 표기 */\n"
        '}\n'
    )
    with open(CSS_OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(css)
    print('  css/fonts.css')


def main():
    download()
    os.makedirs(OUT, exist_ok=True)
    chars, found = used_chars()
    cps = {ord(c) for c in chars}
    hangul = sum(1 for c in cps if 0xAC00 <= c <= 0xD7A3)
    print(f'글자 {len(cps)}개(소스에서 모은 글자 {len(found)}개 + 늘 넣는 글자, 한글 음절 {hangul}개)')

    # 예전 결과물 지우기(이름이 바뀐 파일이 남지 않게)
    for f in os.listdir(OUT):
        if f.endswith('.woff2'):
            os.remove(os.path.join(OUT, f))

    rows = plan(hahmlet_max_weight())
    missing_all = {}
    for out_name, src, family, style, weight, _ in rows:
        miss = build(os.path.join(SRC, src), out_name, cps, family, style, weight)
        if miss:
            missing_all[f'{family} {style}'] = miss
    write_licenses()
    write_css(rows)

    # 게임 소스에서 모은 글자가 빠지면 문제(대체 글꼴로 보임). 늘 넣는 기호가 빠진 것은 참고로만 알린다.
    src_cps = {ord(c) for c in found}
    bad = {k: [c for c in v if c in src_cps] for k, v in missing_all.items()}
    bad = {k: v for k, v in bad.items() if v}
    info = {k: [c for c in v if c not in src_cps] for k, v in missing_all.items()}
    info = {k: v for k, v in info.items() if v}
    fmt = lambda miss: ' '.join(f'{chr(c)}(U+{c:04X})' for c in miss)
    if bad:
        print('게임 글자 중 원본 글꼴에 없는 글자(대체 글꼴로 보임):')
        for k, miss in bad.items():
            print(f'  {k}: {len(miss)}개  {fmt(miss)}')
    else:
        print('게임 글자 중 원본 글꼴에 없는 글자: 없음')
    if info:
        print('참고 — 늘 넣는 기호 중 원본에 없어 빠진 것(화면에 쓰면 대체 글꼴로 보임):')
        for k, miss in info.items():
            print(f'  {k}: {fmt(miss)}')

if __name__ == '__main__':
    main()
