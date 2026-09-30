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

## 선택한 그림체: (선생님 선택 대기)

- 고른 견본:
- 고른 날짜:
- 이후 에셋에 붙일 공통 문구:

## 2단계: 에셋 목록(선택 뒤 채움)

sea_tile, ship3, ship2, ship1, ship3_burnt, ship2_burnt, ship1_burnt, title, result_bg, splash — 선택한 그림체로 만든 뒤 프롬프트를 여기에 적는다.
