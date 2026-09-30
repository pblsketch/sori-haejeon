'use strict';
// ───────────────────────────────────────────────────────────────
// 입안 단면도 데이터 — 좌표와 공기 흐름 규칙 (js/game/mouth.js가 그린다)
// ───────────────────────────────────────────────────────────────
// · 그림 좌표계: viewBox 0 0 360 340. 얼굴은 왼쪽을 본다(입술 왼쪽, 콧길 위, 목청 아래).
// · 자리 키는 음운 데이터와 같다: bilabial, alveolar, palatal, velar, glottal
//   혀 자리 키(모음): '<앞뒤>-<높이>' — front-high, front-mid, front-low, back-high, back-mid, back-low
// · 흐름 규칙(manners/strengths/vowel)은 spec 5.2 표를 그대로 옮긴 것이다. 표가 바뀌면 여기만 고친다.
//     closure(막음 표시): full 완전히 막힌 막대 · full-to-gap 막대 → 틈 · gap 가운데가 벌어진 막대
//                         dotted 점선 막대 · none 없음
//     nasal(콧길 문): open 열림 · closed 닫힘
//     flow(입자 움직임): burst 쌓였다가 한 번에 · leak 쌓였다가 틈으로 천천히 새며 떨림
//                        hiss 좁은 틈을 스치며 떨리며 계속 · nose 코로 나감 · split 양옆으로 갈라져 돎
//                        free 막힘 없이 입으로
// · 조정값: PARTICLES(입자 수, 저사양 칠판이면 줄인다), DURATION(재생 시간, spec상 1500ms 이내)

window.MOUTH = {
  VIEW: { w: 360, h: 340 },
  PARTICLES: 14,     // 한 번 쏠 때 입자 수(거센소리는 이것의 두 배)
  DURATION: 1300,    // 재생 시간(ms). 1500 이하로 둘 것
  HIT_R: 30,         // 자음 자리 누르는 범위(그림 단위). 실제 크기가 --touch보다 작아지면 저절로 키운다
  HIT_R_VOWEL: 22,   // 모음 혀 자리 누르는 범위(그림 단위)

  // ── 그림 모양(고정) ────────────────────────────────────────
  shape: {
    // 머리 단면 바탕(살)
    head: 'M50,0 L360,0 L360,340 L272,340 L268,298 C236,278 168,264 120,258 C84,254 58,242 46,226 ' +
      'C40,218 36,212 30,208 C22,202 20,190 24,182 L30,174 L30,158 C20,152 18,140 24,132 ' +
      'C30,124 36,116 38,108 C30,106 22,102 16,96 C10,90 10,84 16,78 C30,58 42,30 46,0 Z',
    // 콧길(공기 길)
    nasal: 'M18,94 C22,82 28,70 38,62 C46,54 56,52 70,52 L300,50 C312,50 318,56 318,66 L318,104 ' +
      'L292,104 C272,92 252,88 230,88 L64,88 C48,88 34,92 22,98 Z',
    // 입안 + 목구멍 + 기관(공기 길). 혀가 이 위를 덮는다.
    oral: 'M20,160 C38,156 50,150 60,138 C68,130 78,124 90,122 C120,116 160,114 200,114 ' +
      'C222,114 236,118 248,124 C264,132 274,142 278,152 C282,160 290,158 292,150 L292,104 L318,104 ' +
      'L318,340 L294,340 L294,272 C240,264 150,248 100,238 C72,232 58,220 52,206 C48,192 42,180 20,174 Z',
    // 윗니·아랫니
    upperTeeth: 'M52,142 L60,138 L64,160 L58,166 Z',
    lowerTeeth: 'M56,196 L63,194 L62,174 L57,172 Z',
    // 입술(벌린 모양·다문 모양·둥근 모양). 윗입술/아랫입술 따로.
    lips: {
      open: { upper: 'M20,160 C14,154 14,142 22,134 L34,130 C42,140 48,150 50,154 C40,158 30,160 20,160 Z',
        lower: 'M20,174 C30,174 42,176 50,182 C48,194 42,204 32,208 L24,204 C16,196 14,182 20,174 Z' },
      closed: { upper: 'M20,166 C14,158 14,142 22,134 L34,130 C42,140 48,152 50,160 C40,164 30,166 20,166 Z',
        lower: 'M20,167 C30,167 42,166 50,166 C48,190 42,204 32,208 L24,204 C16,196 14,180 20,167 Z' },
      gap: { upper: 'M20,164 C14,156 14,142 22,134 L34,130 C42,140 48,150 50,158 C40,162 30,164 20,164 Z',
        lower: 'M20,169 C30,169 42,168 50,168 C48,192 42,204 32,208 L24,204 C16,196 14,182 20,169 Z' },
      rounded: { upper: 'M12,162 C4,154 6,142 16,134 L34,130 C42,140 48,150 50,156 C36,160 24,163 12,162 Z',
        lower: 'M12,171 C24,170 38,172 50,178 C48,194 42,204 30,208 L20,204 C8,196 6,182 12,171 Z' },
    },
    // 여린입천장 뒤끝(콧길 문 경첩)과 콧길 문
    door: { x: 292, y: 104, len: 26, closedDeg: 0, openDeg: 68 },
    // 목청(성대 두 쪽)
    glottis: { y: 312, left: 294, right: 318 },
    // 앞에서 본 입술 모양(모음 바다 전용 작은 그림)
    lipInset: { x: 44, y: 300 },
  },

  // ── 자음 다섯 자리 ─────────────────────────────────────────
  // x,y: 막는 곳(누르는 곳의 가운데) · deg: 막음 막대 방향(0=가로) · len: 막대 길이
  // label: 이름 자리(anchor: start|middle|end) · tongue: 막을 때 혀 모양(tip 혀끝, peak 혓몸 가장 높은 곳)
  places: {
    bilabial: { x: 32, y: 166, deg: 90, len: 26, label: { x: 4, y: 232, anchor: 'start' }, tongue: null },
    alveolar: { x: 86, y: 132, deg: 72, len: 26, label: { x: 94, y: 103, anchor: 'middle' },
      tongue: { tip: [84, 126], peak: [150, 152] } },
    palatal: { x: 166, y: 130, deg: 90, len: 26, label: { x: 160, y: 103, anchor: 'middle' },
      tongue: { tip: [70, 180], peak: [166, 121] } },
    velar: { x: 250, y: 134, deg: 62, len: 26, label: { x: 240, y: 103, anchor: 'middle' },
      tongue: { tip: [66, 186], peak: [246, 128] } },
    glottal: { x: 306, y: 312, deg: 0, len: 28, label: { x: 288, y: 318, anchor: 'end' }, tongue: null },
  },
  placeOrder: ['bilabial', 'alveolar', 'palatal', 'velar', 'glottal'],
  neutralTongue: { tip: [66, 186], peak: [176, 150] },

  // ── 모음 혀 자리 6곳 ───────────────────────────────────────
  tongueSpots: {
    'front-high': { x: 132, y: 130 }, 'front-mid': { x: 132, y: 172 }, 'front-low': { x: 132, y: 214 },
    'back-high': { x: 232, y: 136 }, 'back-mid': { x: 232, y: 176 }, 'back-low': { x: 232, y: 216 },
  },
  tongueOrder: ['front-high', 'front-mid', 'front-low', 'back-high', 'back-mid', 'back-low'],
  // 모음 이름 자리: 앞뒤 이름은 입천장 띠 안, 높이 이름은 두 줄 사이 가운데
  vowelLabels: { backness: { front: { x: 132, y: 107 }, back: { x: 232, y: 107 } }, heightX: 182 },

  // ── 공기 길(점 목록, 목청 아래 → 밖) ───────────────────────
  // oral의 null 자리는 고른 자리(막는 곳)나 혀 자리로 채운다.
  route: {
    source: [306, 340],
    oral: [[306, 340], [306, 312], [306, 240], [300, 184], [284, 168], [250, 142], [200, 132], [140, 134],
      [90, 146], [50, 162], [30, 166], [-10, 166]],
    nose: [[306, 340], [306, 312], [306, 200], [306, 130], [305, 100], [290, 72], [240, 68], [120, 68],
      [60, 74], [30, 92], [2, 104]],
  },

  // ── 흐름 규칙(spec 5.2 표) ─────────────────────────────────
  manners: {
    stop: { closure: 'full', nasal: 'closed', flow: 'burst' },
    affricate: { closure: 'full-to-gap', nasal: 'closed', flow: 'leak' },
    fricative: { closure: 'gap', nasal: 'closed', flow: 'hiss' },
    nasal: { closure: 'full', nasal: 'open', flow: 'nose' },
    liquid: { closure: 'dotted', nasal: 'closed', flow: 'split' },
  },
  vowel: { closure: 'none', nasal: 'closed', flow: 'free' },
  // 세기: 거센소리 = 입자 두 배·세게, 된소리 = 목청 조임 표시 뒤 단단하게
  strengths: {
    plain: { mul: 1, glottis: 'normal', force: 'plain' },
    none: { mul: 1, glottis: 'normal', force: 'plain' },
    aspirated: { mul: 2, glottis: 'normal', force: 'strong' },
    tense: { mul: 1, glottis: 'tight', force: 'firm' },
  },
};
