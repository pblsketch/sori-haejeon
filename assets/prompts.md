# 그림 에셋 프롬프트 기록

`tools/gen.ps1`(Codex CLI의 image_gen, gpt-image 계열)로 만든다. 프롬프트는 영어(ASCII)로만 쓰고 `tools/prompts/*.txt`에 둔다.

다시 만들기(PowerShell, 저장소 루트에서):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\gen.ps1 -Name style_a -PromptFile tools\prompts\style_a.txt -Out assets\raw\style_a.png
```

- 원본(`assets/raw/`)은 저장소에 올리지 않는다(.gitignore). 선생님께 보여 드린 견본의 축소본은 `design/style-samples/`에 둔다.
- 금지 소재: 글자·숫자·깃발 문양·워터마크, 조선 수군·판옥선 등 조선 소재, 돛·노가 달린 옛 배.

## 1단계: 그림체 견본(같은 장면, 서로 다른 화풍)

공통 장면: 잔잔한 바다 위 현대식 작은 경비함 한 척, 3/4 위에서 내려다본 구도. 색: 쪽빛 바다 `#2E5266`, 밝은 종이 바탕 `#EEF0EA`, 주홍 `#A8342B`, 옥색 `#8FC7B8`.

| 견본 | 공통 화풍 문구(이후 에셋에 붙일 문구) | 크기·품질 | 원본 | 축소본 |
|---|---|---|---|---|
| A | flat vector illustration made of simple clean geometric shapes, solid color fills, crisp edges, minimal detail, modern editorial infographic look | 1536x1024, high | `assets/raw/style_a.png` | `design/style-samples/style_a.png` |
| B | modern nautical chart and map illustration, fine precise ink linework on light paper, light flat color washes, thin contour lines | 1536x1024, high | `assets/raw/style_b.png` | `design/style-samples/style_b.png` |
| C | soft painterly digital illustration, gentle brush textures, smooth soft lighting, slightly simplified shapes, contemporary storybook concept-art look | 1536x1024, high | `assets/raw/style_c.png` | `design/style-samples/style_c.png` |

### 견본 A 전체 프롬프트 (`tools/prompts/style_a.txt`)

```text
A single small modern-style naval patrol ship (contemporary steel hull, simple superstructure, one mast with radar; not historical, no traditional Korean or Joseon ships, no sails, no oars) sailing alone on a calm open sea, seen from a three-quarter top-down angle, centered with generous empty sea around it. Clean bright palette: deep indigo-blue sea #2E5266, pale paper background tone #EEF0EA, vermilion accent #A8342B on small hull details, soft mint #8FC7B8 for highlights and wake foam. Calm, friendly mood suitable for a school learning game. Style: flat vector illustration made of simple clean geometric shapes, solid color fills with no gradients or only very subtle ones, crisp edges, minimal detail, modern editorial infographic look, stylized wave shapes as simple repeated curves. Absolutely no text, no letters, no numbers, no hull numbers, no flags with writing or emblems, no logos, no signatures, no watermarks, no frame or border. Landscape 1536x1024.
```

### 견본 B 전체 프롬프트 (`tools/prompts/style_b.txt`)

```text
A single small modern-style naval patrol ship (contemporary steel hull, simple superstructure, one mast with radar; not historical, no traditional Korean or Joseon ships, no sails, no oars) sailing alone on a calm open sea, seen from a three-quarter top-down angle, centered with generous empty sea around it. Clean bright palette: deep indigo-blue sea #2E5266, pale paper background tone #EEF0EA, vermilion accent #A8342B on small hull details, soft mint #8FC7B8 for highlights and wake foam. Calm, friendly mood suitable for a school learning game. Style: modern nautical chart and map illustration, fine precise ink linework on light paper, ship drawn as a clean technical line drawing with light flat color washes, sea rendered with thin contour lines and subtle depth bands, faint grid lines and compass-style geometric ornaments without any labels, elegant cartographic look. Absolutely no text, no letters, no numbers, no hull numbers, no flags with writing or emblems, no logos, no signatures, no watermarks, no frame or border. Landscape 1536x1024.
```

### 견본 C 전체 프롬프트 (`tools/prompts/style_c.txt`)

```text
A single small modern-style naval patrol ship (contemporary steel hull, simple superstructure, one mast with radar; not historical, no traditional Korean or Joseon ships, no sails, no oars) sailing alone on a calm open sea, seen from a three-quarter top-down angle, centered with generous empty sea around it. Clean bright palette: deep indigo-blue sea #2E5266, pale paper background tone #EEF0EA, vermilion accent #A8342B on small hull details, soft mint #8FC7B8 for highlights and wake foam. Calm, friendly mood suitable for a school learning game. Style: soft painterly digital illustration, gentle brush textures, smooth soft lighting from a clear sky, light reflections and soft shadows on the water, slightly simplified shapes, warm but clean contemporary storybook-concept-art look, not photorealistic. Absolutely no text, no letters, no numbers, no hull numbers, no flags with writing or emblems, no logos, no signatures, no watermarks, no frame or border. Landscape 1536x1024.
```

## 선택한 그림체: A — 평면 그림(선생님 선택)

- 고른 견본: A(`design/style-samples/style_a.png`), 2026-09-30
- 배 모습: 포가 달린 현대 함정 유지(해전 느낌). 조선 소재·옛 배 없음.
- 이후 에셋에 붙인 공통 문구: `Style: flat vector illustration made of simple clean geometric shapes, solid color fills with no gradients or only very subtle ones, crisp edges, minimal detail, modern editorial infographic look.`
- 공통 색 문구: `Palette: deep indigo-blue sea #2E5266, pale paper tone #EEF0EA, vermilion accent #A8342B, soft mint #8FC7B8, light grey and white for ships.`
- 함대 공통 도색(배 세 척 모두): 밝은 회색 선체 + 흘수선의 가는 주홍 띠, 흰 각진 상부 구조물, 짙은 회색 갑판 장비, 흰 레이더 돛대.

## 2단계: 에셋

만들기(PowerShell, 저장소 루트에서). 참조 그림이 있는 것은 `-Image`/`-RefMode`를 붙인다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\gen.ps1 -Name ship3 -PromptFile tools\prompts\ship3.txt -Out assets\raw\ship3.png -Image assets\raw\style_a.png -RefMode style
powershell -NoProfile -ExecutionPolicy Bypass -File tools\gen.ps1 -Name ship3_burnt -PromptFile tools\prompts\ship3_burnt.txt -Out assets\raw\ship3_burnt.png -Image assets\raw\ship3.png -RefMode same
python tools\process_assets.py        # webp 만들기 + 점검(PASS/FAIL)
```

- 다른 프로그램(bash 등)에서 백그라운드로 부를 때는 표준 입력을 닫아야 한다(`</dev/null`). 열려 있으면 codex가 입력을 기다리며 멈춘다.
- 배·물보라는 순수 자홍(#FF00FF) 단색 배경으로 만들고, `tools/process_assets.py`가 자홍 몫을 빼서 투명하게 만든다(난간 사이·연기 가장자리까지). 배에는 자홍을 쓰지 않게 프롬프트로 막았다.
- 바다 질감은 생성 원본에 세로 이음매가 있어, 반 칸 민 그림과 원본을 무늬가 없는 곳을 지나는 경로로 이어 붙여(겹쳐 흐리게 하지 않음) 이음매를 없앴다. 손실 압축은 가장자리를 다시 어긋나게 하므로 무손실 webp로 둔다.
- 16:9 그림(title, result_bg)은 원본이 1672×941(이미 16:9)로 나와 1920×1080으로 조금 키웠다.

| 이름 | 생성 크기 | 참조 그림 | 결과 |
|---|---|---|---|
| sea_tile | 1024x1024 | 견본 A(화풍 참조) | `assets/img/sea_tile.webp` 1024×1024, 이음매 제거, 무손실 |
| ship3 | 1536x1024 | 견본 A(화풍 참조) | `assets/img/ship3.webp` 투명, 가로 1024 |
| ship2 | 1536x1024 | 없음(2회차) | `assets/img/ship2.webp` 투명, 가로 1024 |
| ship1 | 1536x1024 | 없음(2회차) | `assets/img/ship1.webp` 투명, 가로 1024 |
| ship3_burnt | 1536x1024 | `ship3.png`(같은 배) | `assets/img/ship3_burnt.webp` 투명 |
| ship2_burnt | 1536x1024 | `ship2.png`(같은 배) | `assets/img/ship2_burnt.webp` 투명 |
| ship1_burnt | 1536x1024 | `ship1.png`(같은 배) | `assets/img/ship1_burnt.webp` 투명 |
| title | 1536x1024 | 견본 A(화풍 참조) | `assets/img/title.webp` 16:9로 잘라 1920×1080 |
| result_bg | 1536x1024 | 없음 | `assets/img/result_bg.webp` 16:9로 잘라 1920×1080 |
| splash | 1536x1024 | 없음 | `assets/img/splash.webp` 256×256 칸 8개 가로 한 줄(2048×256), 투명 |

### 다시 만든 기록

- ship2, ship1: 1회차에 견본 A를 화풍 참조로 붙였더니 견본의 배를 그대로 베껴 세 척이 거의 같아졌다. 참조 없이 크기·비율 문구(ship2: 선체 길이 폭의 5배, 포 1문 / ship1: 길이 폭의 3.5배, 작은 선실)를 더해 다시 만들었다(2회차에서 통과).

### sea_tile (`tools/prompts/sea_tile.txt`)

```text
A seamless tileable texture of open sea seen straight from directly above (top-down, orthographic): a flat deep indigo-blue #2E5266 water surface covered evenly with many small stylized white and soft mint #8FC7B8 wave crest marks, each a simple short curved stroke, scattered at an even density across the whole square with the same size everywhere, no larger shapes, no focal point, no ship, no island, no horizon, no sky, no vignette, no lighting change from one side to the other. Designed to repeat edge to edge as a background pattern. Style: flat vector illustration made of simple clean geometric shapes, solid color fills with no gradients or only very subtle ones, crisp edges, minimal detail, modern editorial infographic look. Absolutely no text, no letters, no numbers, no hull numbers, no flags, no emblems, no logos, no signatures, no watermarks, no frame or border. Modern ships only: not historical, no traditional Korean or Joseon ships, no sails, no oars. Square 1024x1024.
```

### ship3 (`tools/prompts/ship3.txt`)

```text
A large modern naval destroyer: long sleek hull, two deck guns (one on the bow, one behind the bridge), vertical missile launcher blocks, a tall radar mast and a helicopter deck at the stern. Livery shared by the whole fleet: light grey steel hull with a thin vermilion #A8342B stripe along the waterline, white angular superstructure, dark grey deck fittings, a white radar mast. Shown in three-quarter view from slightly above, bow pointing to the right, the whole ship fully visible and centered with a wide empty margin on every side. Style: flat vector illustration made of simple clean geometric shapes, solid color fills with no gradients or only very subtle ones, crisp edges, minimal detail, modern editorial infographic look. Palette: deep indigo-blue sea #2E5266, pale paper tone #EEF0EA, vermilion accent #A8342B, soft mint #8FC7B8, light grey and white for ships. The ship is isolated on a perfectly flat, uniform, solid pure magenta #FF00FF background: no water, no sea, no waves, no wake, no shadow on the ground, no gradient, nothing else in the picture. Do not use magenta or pink anywhere on the ship. Absolutely no text, no letters, no numbers, no hull numbers, no flags, no emblems, no logos, no signatures, no watermarks, no frame or border. Modern ships only: not historical, no traditional Korean or Joseon ships, no sails, no oars. Landscape 1536x1024.
```

### ship2 (`tools/prompts/ship2.txt`)

```text
A medium-size modern naval frigate or corvette: medium length hull, one deck gun on the bow, a compact superstructure and a single radar mast. Clearly smaller and simpler than a destroyer. Proportions: hull length about five times its width, one compact block superstructure in the middle, no helicopter deck, no missile launchers, only one gun. Livery shared by the whole fleet: light grey steel hull with a thin vermilion #A8342B stripe along the waterline, white angular superstructure, dark grey deck fittings, a white radar mast. Shown in three-quarter view from slightly above, bow pointing to the right, the whole ship fully visible and centered with a wide empty margin on every side. Style: flat vector illustration made of simple clean geometric shapes, solid color fills with no gradients or only very subtle ones, crisp edges, minimal detail, modern editorial infographic look. Palette: deep indigo-blue sea #2E5266, pale paper tone #EEF0EA, vermilion accent #A8342B, soft mint #8FC7B8, light grey and white for ships. The ship is isolated on a perfectly flat, uniform, solid pure magenta #FF00FF background: no water, no sea, no waves, no wake, no shadow on the ground, no gradient, nothing else in the picture. Do not use magenta or pink anywhere on the ship. Absolutely no text, no letters, no numbers, no hull numbers, no flags, no emblems, no logos, no signatures, no watermarks, no frame or border. Modern ships only: not historical, no traditional Korean or Joseon ships, no sails, no oars. Landscape 1536x1024.
```

### ship1 (`tools/prompts/ship1.txt`)

```text
A small modern fast patrol boat: short hull, a small deck gun on the bow, a small wheelhouse with a radar mast. Clearly the smallest and simplest ship of the fleet. Proportions: a tiny boat, hull length only about three and a half times its width, one small low cabin, one short mast, one small gun on the bow, no helicopter deck, no missile launchers, no large superstructure. It must look like a small fast patrol boat, not a frigate. Livery shared by the whole fleet: light grey steel hull with a thin vermilion #A8342B stripe along the waterline, white angular superstructure, dark grey deck fittings, a white radar mast. Shown in three-quarter view from slightly above, bow pointing to the right, the whole ship fully visible and centered with a wide empty margin on every side. Style: flat vector illustration made of simple clean geometric shapes, solid color fills with no gradients or only very subtle ones, crisp edges, minimal detail, modern editorial infographic look. Palette: deep indigo-blue sea #2E5266, pale paper tone #EEF0EA, vermilion accent #A8342B, soft mint #8FC7B8, light grey and white for ships. The ship is isolated on a perfectly flat, uniform, solid pure magenta #FF00FF background: no water, no sea, no waves, no wake, no shadow on the ground, no gradient, nothing else in the picture. Do not use magenta or pink anywhere on the ship. Absolutely no text, no letters, no numbers, no hull numbers, no flags, no emblems, no logos, no signatures, no watermarks, no frame or border. Modern ships only: not historical, no traditional Korean or Joseon ships, no sails, no oars. Landscape 1536x1024.
```

### ship3_burnt (`tools/prompts/ship3_burnt.txt`)

```text
Draw exactly the same ship as in the reference image, same hull shape, same proportions, same angle, same size and same position in the frame, but badly damaged after being hit: blackened scorched patches on the hull and superstructure, a broken mast, a few small flat-vector flames in vermilion and orange on the deck, and a short column of dark grey flat smoke shapes rising above the ship that stays inside the picture. The ship is still afloat and recognizable. Livery shared by the whole fleet: light grey steel hull with a thin vermilion #A8342B stripe along the waterline, white angular superstructure, dark grey deck fittings, a white radar mast. Shown in three-quarter view from slightly above, bow pointing to the right, the whole ship fully visible and centered with a wide empty margin on every side. Style: flat vector illustration made of simple clean geometric shapes, solid color fills with no gradients or only very subtle ones, crisp edges, minimal detail, modern editorial infographic look. The ship is isolated on a perfectly flat, uniform, solid pure magenta #FF00FF background: no water, no sea, no waves, no wake, no shadow on the ground, no gradient, nothing else in the picture. Do not use magenta or pink anywhere on the ship. Absolutely no text, no letters, no numbers, no hull numbers, no flags, no emblems, no logos, no signatures, no watermarks, no frame or border. Modern ships only: not historical, no traditional Korean or Joseon ships, no sails, no oars. Landscape 1536x1024.
```

### ship2_burnt (`tools/prompts/ship2_burnt.txt`)

```text
Draw exactly the same ship as in the reference image, same hull shape, same proportions, same angle, same size and same position in the frame, but badly damaged after being hit: blackened scorched patches on the hull and superstructure, a broken mast, a few small flat-vector flames in vermilion and orange on the deck, and a short column of dark grey flat smoke shapes rising above the ship that stays inside the picture. The ship is still afloat and recognizable. Livery shared by the whole fleet: light grey steel hull with a thin vermilion #A8342B stripe along the waterline, white angular superstructure, dark grey deck fittings, a white radar mast. Shown in three-quarter view from slightly above, bow pointing to the right, the whole ship fully visible and centered with a wide empty margin on every side. Style: flat vector illustration made of simple clean geometric shapes, solid color fills with no gradients or only very subtle ones, crisp edges, minimal detail, modern editorial infographic look. The ship is isolated on a perfectly flat, uniform, solid pure magenta #FF00FF background: no water, no sea, no waves, no wake, no shadow on the ground, no gradient, nothing else in the picture. Do not use magenta or pink anywhere on the ship. Absolutely no text, no letters, no numbers, no hull numbers, no flags, no emblems, no logos, no signatures, no watermarks, no frame or border. Modern ships only: not historical, no traditional Korean or Joseon ships, no sails, no oars. Landscape 1536x1024.
```

### ship1_burnt (`tools/prompts/ship1_burnt.txt`)

```text
Draw exactly the same ship as in the reference image, same hull shape, same proportions, same angle, same size and same position in the frame, but badly damaged after being hit: blackened scorched patches on the hull and superstructure, a broken mast, a few small flat-vector flames in vermilion and orange on the deck, and a short column of dark grey flat smoke shapes rising above the ship that stays inside the picture. The ship is still afloat and recognizable. Livery shared by the whole fleet: light grey steel hull with a thin vermilion #A8342B stripe along the waterline, white angular superstructure, dark grey deck fittings, a white radar mast. Shown in three-quarter view from slightly above, bow pointing to the right, the whole ship fully visible and centered with a wide empty margin on every side. Style: flat vector illustration made of simple clean geometric shapes, solid color fills with no gradients or only very subtle ones, crisp edges, minimal detail, modern editorial infographic look. The ship is isolated on a perfectly flat, uniform, solid pure magenta #FF00FF background: no water, no sea, no waves, no wake, no shadow on the ground, no gradient, nothing else in the picture. Do not use magenta or pink anywhere on the ship. Absolutely no text, no letters, no numbers, no hull numbers, no flags, no emblems, no logos, no signatures, no watermarks, no frame or border. Modern ships only: not historical, no traditional Korean or Joseon ships, no sails, no oars. Landscape 1536x1024.
```

### title (`tools/prompts/title.txt`)

```text
Wide cinematic start-screen illustration: a calm open sea with a small fleet of three modern naval warships of different sizes (a large destroyer, a medium frigate and a small patrol boat) sailing together in the lower part of the picture toward the right, with small white wakes behind them. Livery shared by the whole fleet: light grey steel hull with a thin vermilion #A8342B stripe along the waterline, white angular superstructure, dark grey deck fittings, a white radar mast. The sea is deep indigo-blue #2E5266 with stylized white and mint wave crests as simple repeated curves. The whole upper half of the picture is a clean, calm, uncluttered area of pale sky or plain sea with very little detail, left empty so that a title can be placed over it later. Seen from a three-quarter angle from above. Style: flat vector illustration made of simple clean geometric shapes, solid color fills with no gradients or only very subtle ones, crisp edges, minimal detail, modern editorial infographic look. Palette: deep indigo-blue sea #2E5266, pale paper tone #EEF0EA, vermilion accent #A8342B, soft mint #8FC7B8, light grey and white for ships. Absolutely no text, no letters, no numbers, no hull numbers, no flags, no emblems, no logos, no signatures, no watermarks, no frame or border. Modern ships only: not historical, no traditional Korean or Joseon ships, no sails, no oars. Wide landscape composition that still works when cropped to 16:9.
```

### result_bg (`tools/prompts/result_bg.txt`)

```text
A calm, very light, low-contrast background illustration for a results screen: a pale paper-toned #EEF0EA surface with very faint, soft, light mint and pale blue stylized wave lines drifting across it, and a barely visible calm horizon of gentle water in the lower part. Everything is light and quiet with low contrast so that dark text and charts placed on top stay easy to read. No ships, no objects, no focal point, no dark areas. Style: flat vector illustration made of simple clean geometric shapes, solid color fills with no gradients or only very subtle ones, crisp edges, minimal detail, modern editorial infographic look. Absolutely no text, no letters, no numbers, no hull numbers, no flags, no emblems, no logos, no signatures, no watermarks, no frame or border. Modern ships only: not historical, no traditional Korean or Joseon ships, no sails, no oars. Wide landscape composition that still works when cropped to 16:9.
```

### splash (`tools/prompts/splash.txt`)

```text
A sprite sheet of an animated water splash in 8 frames, arranged in a grid of 4 columns and 2 rows, read left to right, top row first. Each frame sits centered in its own equal cell with wide empty space between frames, and no frame touches another. The animation: frame 1 a small droplet impact, frames 2 to 4 a white and soft mint #8FC7B8 water splash column growing upward with flying droplets, frames 5 to 7 the splash collapsing and spreading into a ring of foam, frame 8 a few fading foam dots. All frames share the same scale and the same baseline. Water shapes are white, pale mint and light indigo-blue #2E5266 flat shapes with crisp edges. Style: flat vector illustration made of simple clean geometric shapes, solid color fills with no gradients or only very subtle ones, crisp edges, minimal detail, modern editorial infographic look. Plain background: perfectly flat, uniform, solid pure magenta #FF00FF everywhere, no grid lines, no cell borders, no shadows. Absolutely no text, no letters, no numbers, no hull numbers, no flags, no emblems, no logos, no signatures, no watermarks, no frame or border. Modern ships only: not historical, no traditional Korean or Joseon ships, no sails, no oars. Landscape 1536x1024.
```

## v2: 디자인 개편(T18) — 그림체 견본

디자인 검수(`.dryforge/design-review-1.md`, 선생님 채택)의 방향 "낮의 쪽빛 바다 위에 단정한 흰 조작 패널이 놓인 현대 함정 학습 게임"과 새 색 토큰에 맞춰 그림을 다시 만든다. 1단계는 견본만: 같은 구도의 시작 화면 그림 + 같은 화풍의 작은 배(ship2) 시험 그림을 화풍 세 가지로 만들었다.

- 공통 색: 하늘·바탕 `#F2F6F6`, 흰색 `#FFFFFF`, 바다 `#1B5F82`, 그늘·잉크 `#183540`, 흰 물결 `#D8F2F5`, 청록 강조 `#096C6A`(아주 조금), 햇빛 반짝임만 황금 `#F6BE48`. 빨강은 쓰지 않는다(홍팀 색·명중과 겹치지 않게, 불꽃 없음).
- 함대 공통 도색(v1의 주홍 띠를 바꿈): 밝은 회색 선체, 흰 각진 상부 구조물, 흘수선의 짙은 남색(`#183540`) 띠, 짙은 회색 갑판 장비, 흰 레이더 돛대, 청록 점 하나.
- 시작 화면 구도: 위 40%는 제목을 올릴 빈 하늘, 배 세 척(구축함·호위함·경비정, 크기 뚜렷이 다름)은 높이 42~75% 띠 안, 아래 25%는 흰 메뉴 패널이 놓일 조용한 바다.
- 배 시험 그림: ship2(호위함)를 자홍 `#FF00FF` 단색 배경에 그려 배경을 뺀 뒤, 바탕색 위에 크게 + 200·120·72px로 줄여 작은 크기에서 어떻게 읽히는지 본다.
- 만들기(저장소 루트, PowerShell): `powershell -NoProfile -ExecutionPolicy Bypass -File tools\gen.ps1 -Name v2-a-title -PromptFile tools\prompts\v2\a-title.txt -Out assets\raw\v2\a-title.png` (b·c, -ship도 같은 꼴. bash에서 부를 때는 `</dev/null`). 축소본: `python tools/preview_samples_v2.py`.
aw2-title.png` (bash에서 부를 때는 `</dev/null`). 축소본: `python tools/preview_samples_v2.py`.

| 견본 | 화풍 | 원본(올리지 않음) | 축소본 |
|---|---|---|---|
| A | 정돈된 평면 벡터 그림(깔끔한 도형 + 면마다 그림자 한 단, 물결은 곡선 무늬) | `assets/raw/v2/a-title.png`, `a-ship.png` (1536×1024) | `design/style-samples-v2/a-title.png`, `a-ship.png` |
| B | 2.5D 게임 그림(장난감처럼 단순한 입체 배, 각진 로우폴리 바다, 부드러운 빛) | `assets/raw/v2/b-title.png`, `b-ship.png` (1536×1024) | `design/style-samples-v2/b-title.png`, `b-ship.png` |
| C | 기하학 포스터 그림(색 면 몇 개와 띠 모양 물결, 종이 질감, 여백 많음) | `assets/raw/v2/c-title.png`, `c-ship.png` (1536×1024) | `design/style-samples-v2/c-title.png`, `c-ship.png` |

### 다시 만든 기록

- 1회차: A·B·C 모두 사진처럼 사실적인 3D 그림에 가깝게 나와 세 화풍이 구별되지 않았다(A·B는 실사풍 렌더, C 시작 화면은 반쯤 사실적인 채색화). 원본은 `assets/raw/v2/try1/`.
- 2회차: B는 "장난감 같은 로우폴리 입체, 각진 바다", C는 "스크린 인쇄 포스터, 색 여덟 개, 그림자 없음"으로 문구를 세게 바꿔 통과. A는 여전히 실사풍이었다(`assets/raw/v2/try2/`).
- 3회차(A만): "그라데이션·key art" 같은 말을 빼고, 선생님이 앞서 고른 v1 견본 A의 평면 그림 문구를 바탕으로 "면마다 그림자 한 단 + 윗모서리 밝은 선"만 더해 통과.

### 견본 A — 시작 화면 (`tools/prompts/v2/a-title.txt`)

```text
Wide start-screen illustration for a school learning game set on a bright clear day at sea. A small fleet of three modern naval warships of clearly different sizes sailing together toward the right on a calm deep blue sea: a large destroyer (the longest, two deck guns, vertical missile launcher blocks, a tall radar mast, a helicopter deck at the stern), a medium frigate (about two thirds of the destroyer length, one bow gun, compact superstructure, one radar mast) and a small fast patrol boat (about one third of the destroyer length, a small wheelhouse, a tiny bow gun). The destroyer is right of center and slightly nearer, the frigate behind it to the left, the patrol boat further left; all three ships sit in the middle horizontal band of the picture, between about 42 and 75 percent of the image height, each with a thin white wake. Fleet livery shared by every ship: light cool grey steel hull, white angular superstructure, a dark ink-navy #183540 boot stripe along the waterline, dark grey deck fittings, white radar mast, one tiny teal #096C6A accent. Composition: the top 40 percent is a clean open pale sky #F2F6F6 fading to very light blue at a low straight horizon, almost empty, no birds, no big clouds, calm enough for a large dark title to be placed over it later; the bottom 25 percent is quiet open sea with only sparse small wave marks so that a white menu panel can sit there. Palette: sea #1B5F82 with deeper #183540 in shadows, white wave foam #D8F2F5, sky #F2F6F6 and white #FFFFFF, ink #183540, teal accent #096C6A, and only a few tiny warm gold #F6BE48 sun glints on the water. No red anywhere, no flames, no smoke, no explosions, no gunfire. Style: flat vector illustration made of simple clean geometric shapes, solid color fills, crisp edges, minimal detail, modern editorial infographic look, refined with exactly one flat darker shade tone on the side of each surface facing away from a sun at the upper left and one thin flat highlight line along top edges, careful even spacing and tidy consistent detail, like a high-end airline or government infographic poster. Completely flat and drawn by hand in vector: no 3D rendering, no realistic lighting, no photographic water, no sparkles. The sea is flat deep blue with stylized white and pale #D8F2F5 wave crests drawn as simple repeated curves, and the wakes are simple flat white vector foam shapes. Absolutely no text, no letters, no numbers, no hull numbers, no flags, no emblems, no insignia, no logos, no signatures, no watermarks, no frame or border. Modern ships only: not historical, no traditional Korean or Joseon ships, no sails, no oars. Landscape 1536x1024.
```

### 견본 A — 배 시험(ship2) (`tools/prompts/v2/a-ship.txt`)

```text
A medium-size modern naval frigate: medium length hull, one deck gun on the bow, one compact angular superstructure block in the middle, a single radar mast, no helicopter deck, no missile launchers. Hull length about five times its width. Fleet livery shared by every ship: light cool grey steel hull, white angular superstructure, a dark ink-navy #183540 boot stripe along the waterline, dark grey deck fittings, white radar mast, one tiny teal #096C6A accent. Shown in three-quarter view from slightly above, bow pointing to the right, the whole ship fully visible and centered with a wide empty margin on every side. The ship must read as a strong, clean, instantly recognizable silhouette even when shrunk to 96 pixels wide: high contrast between hull, deck and superstructure, no fussy tiny details. Style: flat vector illustration made of simple clean geometric shapes, solid color fills, crisp edges, minimal detail, modern editorial infographic look, refined with exactly one flat darker shade tone on the side of each surface facing away from a sun at the upper left and one thin flat highlight line along top edges, careful even spacing and tidy consistent detail, like a high-end airline or government infographic poster. Completely flat and drawn by hand in vector: no 3D rendering, no realistic lighting, no photographic water, no sparkles. The ship is isolated on a perfectly flat, uniform, solid pure magenta #FF00FF background: no water, no sea, no waves, no wake, no shadow on the ground, no gradient, nothing else in the picture. Do not use magenta or pink anywhere on the ship. Absolutely no text, no letters, no numbers, no hull numbers, no flags, no emblems, no insignia, no logos, no signatures, no watermarks, no frame or border. Modern ships only: not historical, no traditional Korean or Joseon ships, no sails, no oars. Landscape 1536x1024.
```

### 견본 B — 시작 화면 (`tools/prompts/v2/b-title.txt`)

```text
Wide start-screen illustration for a school learning game set on a bright clear day at sea. A small fleet of three modern naval warships of clearly different sizes sailing together toward the right on a calm deep blue sea: a large destroyer (the longest, two deck guns, vertical missile launcher blocks, a tall radar mast, a helicopter deck at the stern), a medium frigate (about two thirds of the destroyer length, one bow gun, compact superstructure, one radar mast) and a small fast patrol boat (about one third of the destroyer length, a small wheelhouse, a tiny bow gun). The destroyer is right of center and slightly nearer, the frigate behind it to the left, the patrol boat further left; all three ships sit in the middle horizontal band of the picture, between about 42 and 75 percent of the image height, each with a thin white wake. Fleet livery shared by every ship: light cool grey steel hull, white angular superstructure, a dark ink-navy #183540 boot stripe along the waterline, dark grey deck fittings, white radar mast, one tiny teal #096C6A accent. Composition: the top 40 percent is a clean open pale sky #F2F6F6 fading to very light blue at a low straight horizon, almost empty, no birds, no big clouds, calm enough for a large dark title to be placed over it later; the bottom 25 percent is quiet open sea with only sparse small wave marks so that a white menu panel can sit there. Palette: sea #1B5F82 with deeper #183540 in shadows, white wave foam #D8F2F5, sky #F2F6F6 and white #FFFFFF, ink #183540, teal accent #096C6A, and only a few tiny warm gold #F6BE48 sun glints on the water. No red anywhere, no flames, no smoke, no explosions, no gunfire. Style: stylized low-poly 3D game diorama, like a polished premium mobile strategy game: chunky simplified toy-like ships with slightly exaggerated proportions, smooth matte clay-like materials, softly bevelled edges, very few details, soft even daylight with gentle ambient occlusion. Clearly stylized and toy-like: NOT photorealistic, no realistic metal, no photographic ocean, no lens flare, no sparkles. Seen from a high three-quarter angle; the sea is a faceted low-poly water surface in flat stylized tones with simple geometric foam shapes for the wakes. Absolutely no text, no letters, no numbers, no hull numbers, no flags, no emblems, no insignia, no logos, no signatures, no watermarks, no frame or border. Modern ships only: not historical, no traditional Korean or Joseon ships, no sails, no oars. Landscape 1536x1024.
```

### 견본 B — 배 시험(ship2) (`tools/prompts/v2/b-ship.txt`)

```text
A medium-size modern naval frigate: medium length hull, one deck gun on the bow, one compact angular superstructure block in the middle, a single radar mast, no helicopter deck, no missile launchers. Hull length about five times its width. Fleet livery shared by every ship: light cool grey steel hull, white angular superstructure, a dark ink-navy #183540 boot stripe along the waterline, dark grey deck fittings, white radar mast, one tiny teal #096C6A accent. Shown in three-quarter view from slightly above, bow pointing to the right, the whole ship fully visible and centered with a wide empty margin on every side. The ship must read as a strong, clean, instantly recognizable silhouette even when shrunk to 96 pixels wide: high contrast between hull, deck and superstructure, no fussy tiny details. Style: stylized low-poly 3D game diorama, like a polished premium mobile strategy game: chunky simplified toy-like ships with slightly exaggerated proportions, smooth matte clay-like materials, softly bevelled edges, very few details, soft even daylight with gentle ambient occlusion. Clearly stylized and toy-like: NOT photorealistic, no realistic metal, no photographic ocean, no lens flare, no sparkles. The ship is isolated on a perfectly flat, uniform, solid pure magenta #FF00FF background: no water, no sea, no waves, no wake, no shadow on the ground, no gradient, nothing else in the picture. Do not use magenta or pink anywhere on the ship. Absolutely no text, no letters, no numbers, no hull numbers, no flags, no emblems, no insignia, no logos, no signatures, no watermarks, no frame or border. Modern ships only: not historical, no traditional Korean or Joseon ships, no sails, no oars. Landscape 1536x1024.
```

### 견본 C — 시작 화면 (`tools/prompts/v2/c-title.txt`)

```text
Wide start-screen illustration for a school learning game set on a bright clear day at sea. A small fleet of three modern naval warships of clearly different sizes sailing together toward the right on a calm deep blue sea: a large destroyer (the longest, two deck guns, vertical missile launcher blocks, a tall radar mast, a helicopter deck at the stern), a medium frigate (about two thirds of the destroyer length, one bow gun, compact superstructure, one radar mast) and a small fast patrol boat (about one third of the destroyer length, a small wheelhouse, a tiny bow gun). The destroyer is right of center and slightly nearer, the frigate behind it to the left, the patrol boat further left; all three ships sit in the middle horizontal band of the picture, between about 42 and 75 percent of the image height, each with a thin white wake. Fleet livery shared by every ship: light cool grey steel hull, white angular superstructure, a dark ink-navy #183540 boot stripe along the waterline, dark grey deck fittings, white radar mast, one tiny teal #096C6A accent. Composition: the top 40 percent is a clean open pale sky #F2F6F6 fading to very light blue at a low straight horizon, almost empty, no birds, no big clouds, calm enough for a large dark title to be placed over it later; the bottom 25 percent is quiet open sea with only sparse small wave marks so that a white menu panel can sit there. Palette: sea #1B5F82 with deeper #183540 in shadows, white wave foam #D8F2F5, sky #F2F6F6 and white #FFFFFF, ink #183540, teal accent #096C6A, and only a few tiny warm gold #F6BE48 sun glints on the water. No red anywhere, no flames, no smoke, no explosions, no gunfire. Style: minimal geometric modern graphic poster, like a screen-printed Swiss-inspired travel poster: only about eight flat colors from the palette, large flat color planes, no gradients, no soft shading, no outlines, each ship reduced to a bold clean silhouette made of precise geometric shapes with at most three flat tones (light side, shade side, dark deck), very few details, generous clear negative space. It must look like graphic design, not a painting: NOT a 3D render, NOT photographic, no realistic water, no sparkles. The sea is drawn as a few precise repeated geometric wave bands and flat horizontal stripes of color, and the wakes are simple flat white geometric shapes; a very fine subtle paper grain over the whole poster. Absolutely no text, no letters, no numbers, no hull numbers, no flags, no emblems, no insignia, no logos, no signatures, no watermarks, no frame or border. Modern ships only: not historical, no traditional Korean or Joseon ships, no sails, no oars. Landscape 1536x1024.
```

### 견본 C — 배 시험(ship2) (`tools/prompts/v2/c-ship.txt`)

```text
A medium-size modern naval frigate: medium length hull, one deck gun on the bow, one compact angular superstructure block in the middle, a single radar mast, no helicopter deck, no missile launchers. Hull length about five times its width. Fleet livery shared by every ship: light cool grey steel hull, white angular superstructure, a dark ink-navy #183540 boot stripe along the waterline, dark grey deck fittings, white radar mast, one tiny teal #096C6A accent. Shown in three-quarter view from slightly above, bow pointing to the right, the whole ship fully visible and centered with a wide empty margin on every side. The ship must read as a strong, clean, instantly recognizable silhouette even when shrunk to 96 pixels wide: high contrast between hull, deck and superstructure, no fussy tiny details. Style: minimal geometric modern graphic poster, like a screen-printed Swiss-inspired travel poster: only about eight flat colors from the palette, large flat color planes, no gradients, no soft shading, no outlines, each ship reduced to a bold clean silhouette made of precise geometric shapes with at most three flat tones (light side, shade side, dark deck), very few details, generous clear negative space. It must look like graphic design, not a painting: NOT a 3D render, NOT photographic, no realistic water, no sparkles. No texture or grain on the ship or background. The ship is isolated on a perfectly flat, uniform, solid pure magenta #FF00FF background: no water, no sea, no waves, no wake, no shadow on the ground, no gradient, nothing else in the picture. Do not use magenta or pink anywhere on the ship. Absolutely no text, no letters, no numbers, no hull numbers, no flags, no emblems, no insignia, no logos, no signatures, no watermarks, no frame or border. Modern ships only: not historical, no traditional Korean or Joseon ships, no sails, no oars. Landscape 1536x1024.
```

### 선택

- 선택: (선생님 선택 대기)
- 고른 뒤(2단계) 할 일: 고른 화풍 문구로 배 3척 + 불탄 배 3척(불꽃 없이 그을림·부러진 돛대 정도, 끔찍하지 않게), 바다 질감, 시작 화면(가로) + 휴대폰 세로 시작 화면(주 함정이 폭의 70~85%, 제목·메뉴와 겹치지 않게), 결과 배경, 물보라를 다시 만든다.
