# tools — 부분 글꼴과 그림 에셋을 만드는 도구

## 맡는 것
- `build_fonts.py`: 게임에 쓰인 글자만 남긴 부분 글꼴(woff2)과 `css/fonts.css`를 만든다. 원본은 `tools/fonts_src/`(없으면 공식 저장소에서 받음, 저장소에 올리지 않음).
- `gen.ps1`: Codex CLI 그림 생성으로 이미지 한 장을 `assets/raw/…png`에 만든다. 프롬프트는 `tools/prompts/`(처음 판), `tools/prompts/v2/`(지금 쓰는 A v2 화풍), `tools/prompts/top/`(위에서 본 배).
- `process_assets.py`: `assets/raw/v2/*.png` → `assets/img/*.webp`(시작·결과 그림 16:9, 휴대폰 시작 그림 9:16). `--all`이면 지금 게임이 쓰지 않는 옆모습 배·물보라·바다 질감도 만든다. `--check`는 게임이 읽는 그림만(위에서 본 배 조각 포함) 크기·투명도를 점검한다.
- `process_top.py`: `assets/raw/top/*.png` → `assets/img/top_*.webp`(세 칸 배를 이음매에서 잘라 뱃머리·가운데·배꼬리, 한 칸 배, 가라앉기 전 공통 조각 `top_hit`, 각 불탄 그림) 세 칸 배 한 척 `top_ship3`는 중간 결과라 `assets/raw/top/`에 둔다.
- `make_og.py`: 링크 미리 보기 그림 `assets/img/og-image.jpg`(1200×630 JPEG) = 시작 화면 그림 + 제목 '음운 해전'(Hahmlet) + 한 줄 소개(Pretendard). 원본 글꼴은 `tools/fonts_src/`. 게임 이름·소개를 바꾸면 파일 안의 `TITLE`·`SUB`를 고치고 다시 돌린다.
- `preview_samples_v2.py`: 화풍 견본 축소본(선생님께 보여 드리는 용도).

## 맡지 않는 것
- 게임 실행 코드(`js/`, `css/` 중 `fonts.css` 말고는 손대지 않는다). 도구는 게임이 읽는 결과 파일만 만든다.
- 음원 손질(음량 맞추기·이음새)은 여기 도구가 없다 — ffmpeg로 직접 하고 `assets/audio/CREDITS.md`에 손본 내용을 적는다.

## 불변 조건
- 글꼴: 결과 이름은 `SoriTitle`(Hahmlet 800, 로고·대제목)·`SoriUI`(Pretendard 500/600/700). OFL은 수정본이 원래 이름을 쓰지 못하게 하므로 이름을 바꾸고 저작권 표시(name 0)와 `assets/fonts/OFL-*.txt`는 그대로 둔다. Gowun Batang은 쓰지 않는다.
- 글꼴 글자 모으기: `index.html`의 글, `js/` 아래 모든 .js의 **문자열**(주석 제외), `css/`의 `content` 문자열 + ASCII·문장 부호·현대 한글 호환 자모. 결과는 결정적이다(같은 입력 → 같은 파일).
- 그림: 이미지 안에 글자·조선 소재가 없어야 한다. 투명이 필요한 그림은 자홍(#FF00FF) 단색 배경으로 만들어 크로마키로 지운다. 온전한 배와 불탄 배는 같은 자르기 상자를 써서 바꿔 끼워도 흔들리지 않게 한다.
- 결과만 커밋한다: `assets/img/*.webp`, `assets/fonts/*`, `css/fonts.css`, 프롬프트. `assets/raw/`·`tools/fonts_src/`는 올리지 않는다.
- 새 화풍은 견본 2~3장을 선생님께 보여 드리고 고른 것으로만 만든다. 쓴 프롬프트와 고른 결과는 `assets/prompts.md`에 적는다.

## 구현 방식
- `gen.ps1`: 데스크톱 앱에 딸린 최신 `codex.exe`를 먼저 쓰고, 최소 설정만 둔 임시 `CODEX_HOME`으로 돈다(전역 설정의 플러그인·MCP 때문에 몇 분씩 멈추는 것을 피함). 프롬프트는 영어(ASCII)만 — 명령문에 그대로 넣어 넘긴다. Bash에서 부를 때는 표준 입력을 닫는다(`</dev/null`), 안 닫으면 멈춘다. `-Image 참조.png -RefMode same|style|scene`으로 참조 그림을 준다.
- `process_top.py`는 `process_assets.py`의 `key_out`(크로마키)·`smoke_tint`를 가져다 쓴다. 두 파일의 이 함수 모양을 바꾸면 둘 다 확인한다.

## 점검
- 글꼴: 스크립트가 원본에 없는 글자를 보고한다(없어야 함). 뒤이어 `cd tests && npm test -- shots screen-text`로 화면에서 기기 글꼴로 새는 글자가 없는지 캡처를 본다.
- 그림: `python tools/process_assets.py --check`(크기·투명도·이음매), 이어서 `npm test -- board shots`.
