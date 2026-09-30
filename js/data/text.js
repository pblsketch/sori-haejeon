'use strict';
// ───────────────────────────────────────────────────────────────
// 소리 해전 — 화면에 나오는 학습 문구 모음 (선생님이 고치는 곳)
// ───────────────────────────────────────────────────────────────
// · 화면의 학습 문구는 모두 여기에 둔다. 문장을 바꾸고 싶으면 이 파일의 따옴표 안만 고치면 된다.
// · 지킬 것
//   - 소리는 언제나 빗금으로 적는다: /ㄱ/, /ㅏ/ (빗금 없이 자모만 쓰면 점검이 실패한다)
//   - 소리를 부르는 말은 '소리'다. 문자 쪽 말을 섞지 않는다.
//   - 문구는 한 줄. 휴대폰 세로 화면에서도 한 줄에 들어가게 짧게(대략 30자 이내).
// · 학년 값: 'm3' = 중3(우리말 용어), 'h1' = 고1(우리말 + 한자어 병기)
// · 바다 값: 'consonant' = 자음 바다, 'vowel' = 모음 바다
// · 자질 이름표(키)는 음운 데이터(js/data/sounds.js)와 같다.
//     위치 place: bilabial, alveolar, palatal, velar, glottal
//     방법 manner: stop, affricate, fricative, nasal, liquid
//     세기 strength: plain, tense, aspirated, none
//     혀의 높이 height: high, mid, low
//     혀의 앞뒤 backness: front, back
//     입술 모양 lips: unrounded, rounded
//     모음 열 column: front-unrounded, front-rounded, back-unrounded, back-rounded
// · 문구 안의 {이름} 자리는 게임이 값으로 채운다(예: '{n}턴' → '8턴').
// · 맨 아래에 다른 코드가 쓰는 도우미 함수(G.text.…)가 있다. 문구만 고칠 때는 건드리지 않아도 된다.

window.TEXT = {

  // ── 이름표 ─────────────────────────────────────────────────
  gradeNames: { m3: '중3', h1: '고1' },
  seaNames: { consonant: '자음 바다', vowel: '모음 바다' },
  // 단계 이름(준비 화면의 단계 단추 아래 작은 설명). 모음 단계 이름은 spec 4.2의 이름.
  levelNames: {
    consonant: { 1: '아홉 소리', 2: '모든 소리', 3: '줄 이름 없이' },
    vowel: { 1: '자세한 신호', 2: '줄어든 신호' },
  },

  // ── 학년별 용어(긴 이름) ─────────────────────────────────────
  // 판의 줄 이름, 단면도 자리 이름 풀이, 결과 화면 등에 쓰는 온전한 이름.
  // 중3 = 우리말, 고1 = 우리말·한자어 병기. 두 학년은 키가 똑같아야 한다.
  terms: {
    m3: {
      axis: { // 자질 묶음의 이름
        place: '소리 내는 자리', manner: '소리 내는 방법', strength: '소리의 세기',
        height: '혀의 높이', backness: '혀의 앞뒤', lips: '입술 모양',
      },
      place: {
        bilabial: '입술소리', alveolar: '잇몸소리', palatal: '센입천장소리',
        velar: '여린입천장소리', glottal: '목청소리',
      },
      manner: { stop: '파열음', affricate: '파찰음', fricative: '마찰음', nasal: '비음', liquid: '유음' },
      strength: { plain: '예사소리', tense: '된소리', aspirated: '거센소리', none: '세기 구분 없음' },
      height: { high: '혀가 높은 모음', mid: '혀가 중간인 모음', low: '혀가 낮은 모음' },
      backness: { front: '혀의 앞쪽', back: '혀의 뒤쪽' },
      lips: { unrounded: '입술 평평하게', rounded: '입술 둥글게' },
      column: {
        'front-unrounded': '혀 앞·입술 평평', 'front-rounded': '혀 앞·입술 둥글게',
        'back-unrounded': '혀 뒤·입술 평평', 'back-rounded': '혀 뒤·입술 둥글게',
      },
    },
    h1: {
      axis: {
        place: '조음 위치', manner: '조음 방법', strength: '소리의 세기',
        height: '혀의 높이', backness: '혀의 앞뒤', lips: '입술 모양',
      },
      place: {
        bilabial: '입술소리·양순음', alveolar: '잇몸소리·치조음', palatal: '센입천장소리·경구개음',
        velar: '여린입천장소리·연구개음', glottal: '목청소리·후음',
      },
      manner: { stop: '파열음', affricate: '파찰음', fricative: '마찰음', nasal: '비음', liquid: '유음' },
      strength: { plain: '예사소리', tense: '된소리', aspirated: '거센소리', none: '세기 구분 없음' },
      height: { high: '높은 모음·고모음', mid: '중간 모음·중모음', low: '낮은 모음·저모음' },
      backness: { front: '앞쪽 모음·전설 모음', back: '뒤쪽 모음·후설 모음' },
      lips: { unrounded: '평평한 입술·평순 모음', rounded: '둥근 입술·원순 모음' },
      column: {
        'front-unrounded': '전설 평순 모음', 'front-rounded': '전설 원순 모음',
        'back-unrounded': '후설 평순 모음', 'back-rounded': '후설 원순 모음',
      },
    },
  },

  // ── 학년별 용어(짧은 이름) ───────────────────────────────────
  // 조작 카드, 판의 머리글처럼 좁은 곳에 쓰는 이름. 키는 terms와 같다.
  shortTerms: {
    m3: {
      axis: { place: '자리', manner: '방법', strength: '세기', height: '높이', backness: '앞뒤', lips: '입술' },
      place: { bilabial: '입술', alveolar: '잇몸', palatal: '센입천장', velar: '여린입천장', glottal: '목청' },
      manner: { stop: '파열', affricate: '파찰', fricative: '마찰', nasal: '비음', liquid: '유음' },
      strength: { plain: '예사', tense: '된', aspirated: '거센', none: '세기 없음' },
      height: { high: '높은', mid: '중간', low: '낮은' },
      backness: { front: '앞', back: '뒤' },
      lips: { unrounded: '평평하게', rounded: '둥글게' },
      column: {
        'front-unrounded': '앞·평평', 'front-rounded': '앞·둥글게',
        'back-unrounded': '뒤·평평', 'back-rounded': '뒤·둥글게',
      },
    },
    h1: {
      axis: { place: '위치', manner: '방법', strength: '세기', height: '높이', backness: '앞뒤', lips: '입술' },
      place: { bilabial: '양순음', alveolar: '치조음', palatal: '경구개음', velar: '연구개음', glottal: '후음' },
      manner: { stop: '파열', affricate: '파찰', fricative: '마찰', nasal: '비음', liquid: '유음' },
      strength: { plain: '예사', tense: '된', aspirated: '거센', none: '세기 없음' },
      height: { high: '고모음', mid: '중모음', low: '저모음' },
      backness: { front: '전설', back: '후설' },
      lips: { unrounded: '평순', rounded: '원순' },
      column: {
        'front-unrounded': '전설·평순', 'front-rounded': '전설·원순',
        'back-unrounded': '후설·평순', 'back-rounded': '후설·원순',
      },
    },
  },

  // 방법 카드 아래에 붙일 수 있는 짧은 우리말 풀이(원하면 씀, 학년 공통).
  mannerGloss: {
    stop: '막았다가 터뜨리는 소리',
    affricate: '막았다가 틈으로 새는 소리',
    fricative: '좁은 틈으로 스치는 소리',
    nasal: '코로 나가는 소리',
    liquid: '혀 옆으로 흐르는 소리',
  },

  // 입안 단면도의 자리 이름(학년 공통, 몸의 부위 이름).
  mouthParts: {
    bilabial: '두 입술', alveolar: '잇몸', palatal: '센입천장', velar: '여린입천장', glottal: '목청',
    nose: '콧길', tongue: '혀', lips: '입술',
    tongueFront: '혀 앞', tongueBack: '혀 뒤', // 모음 단면도의 앞뒤 이름(중3)
    lipsFront: '앞에서 본 입술',               // 모음 단면도의 입술 작은 그림 이름
  },

  // ── 소리를 빚는 동안 한 줄 안내(아직 고르지 않았을 때). 고르기는 모두 아래 카드에서 한다(단면도는 보여 주기) ─────
  prompt: {
    place: '막을 자리 카드를 골라 보세요',
    manner: '소리 내는 방법 카드를 골라 보세요',
    strength: '세기 카드를 골라 보세요',
    height: '혀의 높이 카드를 골라 보세요',
    backness: '혀의 앞뒤 카드를 골라 보세요',
    lips: '입술 모양 카드를 골라 보세요',
    ready: '준비됐으면 발사!',
  },

  // ── 따라 해 보기(1단계) ─────────────────────────────────────
  // 소리를 빚는 동안 조작부 위에 한 줄로 뜬다. 입 모양을 직접 따라 하게 하는 말.
  followLabel: '따라 해 보기',
  follow: {
    // 자음 — 파열음
    'ㅂ': '두 입술을 붙였다가 가볍게 떼 보세요',
    'ㅃ': '목에 힘주고 두 입술을 붙였다 떼 보세요',
    'ㅍ': '숨을 세게 뿜으며 붙인 두 입술을 떼 보세요',
    'ㄷ': '혀끝을 윗잇몸에 붙였다가 가볍게 떼 보세요',
    'ㄸ': '목에 힘주고 혀끝을 윗잇몸에 붙였다 떼 보세요',
    'ㅌ': '숨을 세게 뿜으며 혀끝을 윗잇몸에서 떼 보세요',
    'ㄱ': '혀 뒤를 입천장 뒤에 붙였다가 떼 보세요',
    'ㄲ': '목에 힘주고 혀 뒤를 입천장 뒤에 붙였다 떼 보세요',
    'ㅋ': '숨을 세게 뿜으며 혀 뒤를 입천장 뒤에서 떼 보세요',
    // 자음 — 파찰음
    'ㅈ': '혓바닥을 센입천장에 붙였다가 천천히 떼 보세요',
    'ㅉ': '목에 힘주고 혓바닥을 센입천장에 붙였다 떼 보세요',
    'ㅊ': '숨을 세게 뿜으며 혓바닥을 센입천장에서 떼 보세요',
    // 자음 — 마찰음
    'ㅅ': '혀끝을 윗잇몸 가까이 대고 틈으로 숨을 흘려 보세요',
    'ㅆ': '목에 힘주고 혀끝과 윗잇몸 틈으로 숨을 흘려 보세요',
    'ㅎ': '입을 벌린 채 목청 사이로 숨을 내쉬어 보세요',
    // 자음 — 비음
    'ㅁ': '두 입술을 붙인 채 코로 소리를 내 보세요',
    'ㄴ': '혀끝을 윗잇몸에 붙인 채 코로 소리를 내 보세요',
    'ㅇ': '혀 뒤를 입천장 뒤에 붙인 채 코로 소리를 내 보세요',
    // 자음 — 유음
    'ㄹ': '혀끝을 윗잇몸에 대고 양옆으로 소리를 흘려 보세요',
    // 모음 — 혀와 입술을 움직이지 않고 그대로 둔 채 소리 낸다(단모음)
    'ㅣ': '혀를 앞으로 높이 올리고 입술은 평평하게 해 보세요',
    'ㅔ': '혀를 앞쪽 중간 높이에, 입술은 평평하게 해 보세요',
    'ㅐ': '혀를 앞쪽 아래로 낮추고 입술은 평평하게 해 보세요',
    'ㅟ': '/ㅣ/의 혀 자리 그대로 입술만 둥글게 모아 보세요',
    'ㅚ': '/ㅔ/의 혀 자리 그대로 입술만 둥글게 모아 보세요',
    'ㅡ': '혀 뒤쪽을 높이 올리고 입술은 평평하게 해 보세요',
    'ㅓ': '혀를 뒤쪽 중간 높이에, 입술은 평평하게 해 보세요',
    'ㅏ': '입을 크게 벌리고 혀를 낮게 내려 보세요',
    'ㅜ': '혀 뒤쪽을 높이 올리고 입술을 둥글게 내밀어 보세요',
    'ㅗ': '혀를 뒤쪽 중간 높이에, 입술은 둥글게 모아 보세요',
  },

  // ── 신호와 안내 한 줄(spec 5.3·5.4) ─────────────────────────
  // 신호 이름(신호 기록장·판 표시에 쓰는 짧은 이름). 신호는 이 네 가지뿐.
  signalName: { hit: '명중', line: '같은 줄', miss: '빗나감', none: '없는 소리' },
  // 발사 뒤 조작부 위에 뜨는 한 줄.
  signal: {
    hit: '명중!',
    line: '같은 줄에 배가 있어요',
    miss: '빗나감',
    none: '국어에 없는 소리예요',
    // 턴을 쓰지 않는 두 경우
    notInSea: '이번 바다에는 없는 칸이에요',
    already: '이미 쏜 소리예요',
  },
  // 배 한 척의 칸을 모두 맞혔을 때 한 줄(키 = 배 크기).
  sunk: { 3: '세 칸 배를 찾았어요', 2: '두 칸 배를 찾았어요', 1: '한 칸 배를 찾았어요' },

  // ── 배 ─────────────────────────────────────────────────────
  ships: {
    name: { 3: '세 칸 배', 2: '두 칸 배', 1: '한 칸 배' },
    // 판 옆에 그림과 함께 한 줄씩 보여 주는 배 종류 설명.
    legend: {
      consonant: {
        3: '세 칸 배 = 세기만 다른 세 소리',
        2: '두 칸 배 = 세기만 다르거나, 막는 자리가 같고 콧길만 다른 짝',
        1: '한 칸 배 = 홀로 선 소리',
      },
      vowel: {
        3: '세 칸 배 = 혀의 높이만 다른 세 소리',
        2: '두 칸 배 = 입술 모양만 다른 짝',
        1: '한 칸 배 = 홀로 선 소리',
      },
    },
  },

  // ── 자음 1단계 풀이 예시 ─────────────────────────────────────
  // 정해진 함대에서 세 발을 자동으로 쏘며, 발마다 한 줄로 생각하는 법을 보여 준다(전체 세 줄).
  // fleet·sound 값은 소리 이름표(빗금 없이). expect는 그 발에서 나와야 할 신호(점검이 확인함).
  //   1발 /ㅅ/: 배 칸 중 /ㄴ/·/ㄷ/·/ㄹ/이 잇몸 세로줄에 있음, 마찰음 가로줄에는 없음 → 같은 줄(잇몸 세로줄만 빛남)
  //   2발 /ㄴ/: 배 칸 → 명중
  //   3발 /ㄷ/: 배 칸 → 명중, /ㄷ/·/ㄴ/ 두 칸 배를 모두 맞힘 → 두 칸 배를 찾았어요
  example: {
    sea: 'consonant',
    level: 1,
    fleet: [
      { size: 2, sounds: ['ㄷ', 'ㄴ'] },
      { size: 1, sounds: ['ㅇ'] },
      { size: 1, sounds: ['ㄹ'] },
    ],
    shots: [
      {
        sound: 'ㅅ', expect: 'line', highlight: { place: 'alveolar' },
        line: {
          m3: '잇몸 줄이 빛났으니 자리는 두고 방법만 바꿔 봐요',
          h1: '치조음 줄이 빛났으니 위치는 두고 방법만 바꿔 봐요',
        },
      },
      {
        sound: 'ㄴ', expect: 'hit',
        line: {
          m3: '명중! /ㄷ/과 짝인 두 칸 배인지 /ㄷ/을 쏴 봐요',
          h1: '명중! /ㄷ/과 짝인 두 칸 배인지 /ㄷ/을 쏴 봐요',
        },
      },
      {
        sound: 'ㄷ', expect: 'hit', sunk: 2,
        line: {
          m3: '짝까지 맞혀 두 칸 배를 찾았어요',
          h1: '짝까지 맞혀 두 칸 배를 찾았어요',
        },
      },
    ],
    title: '풀이 예시',
    skip: '건너뛰기',
    end: '이제 직접 쏴 봐요',
  },

  // ── 알아 두기(결과 화면, 이번 판에 나온 것만) ──────────────────
  // 키는 결과 화면이 고른 항목 이름. 짝 소리는 'pair-' 뒤에 두 소리 이름표.
  know: {
    'pair-ㅂㅁ': '/ㅂ/과 /ㅁ/은 막는 자리가 같고 콧길만 달라요',
    'pair-ㄷㄴ': '/ㄷ/과 /ㄴ/은 막는 자리가 같고 콧길만 달라요',
    'pair-ㄱㅇ': '/ㄱ/과 /ㅇ/은 막는 자리가 같고 콧길만 달라요',
    'ng': '/ㅇ/은 음절 끝에서만 나는 소리예요',
    'oe-wi': '/ㅚ/·/ㅟ/는 이중 모음으로 발음해도 표준 발음으로 인정돼요',
    'e-ae': '/ㅔ/와 /ㅐ/를 실제로는 구별하지 않고 발음하는 사람이 많아요(표준 발음은 구별해요)',
  },

  // ── 생각해 볼 질문(결과 화면, 판마다 하나를 골라 보여 줌) ──────
  debrief: {
    m3: {
      consonant: [
        '적의 신호 가운데 가장 도움이 된 것은 무엇이었나요? 그 신호로 왜 범위가 확 줄었을까요?',
        '\'없는 소리\'가 나온 조합이 있었나요? 국어에는 왜 그 소리가 없을까요?',
        '/ㅂ/과 /ㅁ/은 무엇이 같고 무엇이 다를까요? 직접 소리 내며 설명해 봐요.',
        '/ㄱ/, /ㄲ/, /ㅋ/을 차례로 소리 내 보세요. 입 모양은 같은데 무엇이 달라지나요?',
      ],
      vowel: [
        '적의 신호 가운데 가장 도움이 된 것은 무엇이었나요? 그 신호로 무엇을 알게 되었나요?',
        '모음 바다의 빈칸을 쏜 적이 있나요? 혀가 낮으면서 입술이 둥근 모음이 국어에 없는 까닭을 생각해 봐요.',
        '/ㅣ/와 /ㅟ/는 무엇이 같고 무엇이 다를까요? 거울을 보며 직접 소리 내 봐요.',
        '/ㅡ/와 /ㅜ/를 번갈아 소리 내 보세요. 혀는 그대로인데 무엇이 바뀌나요?',
      ],
    },
    h1: {
      consonant: [
        '가장 도움이 된 신호는 무엇이었나? 그 신호가 조음 위치와 조음 방법 중 무엇을 좁혀 주었는지 설명해 보자.',
        '\'없는 소리\'가 나온 조합이 있었나? 국어 자음 체계에 그 칸이 비어 있는 까닭을 생각해 보자.',
        '/ㅂ/과 /ㅁ/의 공통점과 차이점을 조음 위치와 조음 방법으로 설명하고, 직접 발음하며 확인해 보자.',
        '/ㄷ/, /ㄸ/, /ㅌ/은 조음 위치와 조음 방법이 같다. 그렇다면 세 소리를 가르는 것은 무엇일까?',
      ],
      vowel: [
        '가장 도움이 된 신호는 무엇이었나? 그 신호가 혀의 높이, 혀의 앞뒤, 입술 모양 중 무엇을 좁혀 주었는지 설명해 보자.',
        '단모음 체계표에서 저모음 원순 자리가 비어 있다. 이 빈칸을 쏘았다면, 왜 국어에 그 모음이 없는지 생각해 보자.',
        '/ㅔ/와 /ㅚ/의 공통점과 차이점을 혀의 높이, 혀의 앞뒤, 입술 모양으로 설명해 보자.',
        '/ㅓ/와 /ㅗ/를 번갈아 발음하며, 전설·후설과 평순·원순 가운데 무엇이 바뀌는지 확인해 보자.',
      ],
    },
  },

  // ── 대결 ────────────────────────────────────────────────────
  teams: { blue: '청팀', red: '홍팀' },
  duel: {
    shout: '소리 내어 외치고 발사!',
    // 실시간(spec 6.3): 차례 없이 두 팀이 각자 준비되는 대로 쏜다. 팀마다 발 수가 정해져 있다
    shipsLeft: '남은 배 {n}',
    shotsLeft: '남은 발 {n}',
    // 발을 다 쓴 팀 자리의 한 줄(그 팀 조작부는 잠김)
    outOfShots: '발을 다 썼어요. 상대를 기다려요',
    // 팀 자리마다 판 위에 붙는 이름표: 그 팀이 쏘는 바다
    target: { blue: '청팀이 쏘는 홍팀 바다', red: '홍팀이 쏘는 청팀 바다' },
    // 휴대폰 세로 화면에서 대결을 누르면 뜨는 한 줄
    phoneNotice: '대결은 칠판이나 태블릿·노트북의 가로 화면에서 해 주세요',
    // 숨기기 시간(직접 배치)
    hide: {
      title: { blue: '청팀 배 숨기기', red: '홍팀 배 숨기기' },
      place: '{ship}를 숨길 소리 묶음을 눌러 주세요',
      timer: '남은 시간 {n}초',
      done: '다 놓았어요',
      autoFilled: '남은 배는 게임이 대신 숨겼어요',
    },
    // 가림 화면: 팀이 바뀔 때, 배치가 다 끝났을 때
    gate: {
      blue: '청팀 차례예요. 홍팀은 뒤돌아 주세요',
      red: '홍팀 차례예요. 청팀은 뒤돌아 주세요',
      allDone: '배를 다 숨겼어요. 이제 모두 앞을 봐 주세요',
      button: '준비되면 누르기',
    },
  },

  // 가로로 눕힌 휴대폰처럼 높이가 낮은 화면
  rotate: '세로로 돌려 주세요',

  // ── 화면 이름표(버튼·머리글) ─────────────────────────────────
  ui: {
    title: '소리 해전',
    // 시작 화면
    menu: { practice: '연습', duel: '대결', soundmap: '이 기기의 소리 지도', settings: '설정', credits: '만든 사람·출처' },
    // 이어서 하기
    resume: { ask: '하던 판이 있어요', resume: '하던 판 이어서 하기', fresh: '새 판' },
    // 판 준비
    setup: {
      grade: '학년', sea: '바다', level: '단계', hideTime: '숨기기 시간',
      on: '켜기', off: '끄기', start: '시작', back: '뒤로', example: '예시 보기',
      levelN: '{n}단계',
    },
    // 설정
    settings: {
      title: '설정', bgm: '배경 음악', sfx: '효과음', volume: '음량', reduceMotion: '움직임 줄이기',
      on: '켜기', off: '끄기',
      clear: '기록 지우기',
      clearConfirm: '이 기기의 소리 지도와 예시 본 기록, 하던 판을 모두 지울까요?',
      clearYes: '지우기', clearNo: '그만두기', cleared: '기록을 지웠어요',
    },
    // 판 도중
    play: {
      fire: '발사', log: '신호 기록장', logOpen: '신호 기록장 펼치기', logClose: '접기',
      logShort: '기록',          // 휴대폰 기록장 단추('기록 2')
      // 조작 순서(① 자리 → ② 방법 → ③ 세기 → 발사)의 묶음 이름은 shortTerms.axis를 쓴다. 지금 고른 조합 요약 한 줄:
      choose: '{what} 선택',      // 요약 줄에서 아직 안 고른 칸('세기 선택')
      shipsLeft: '남은 배', turnsLeft: '남은 턴', turnsN: '{n}턴',
      allFound: '배를 모두 찾았어요',
      outOfTurns: '턴을 다 썼어요. 남은 배를 보여 줄게요',
      home: '처음으로',
    },
    // 결과 화면
    result: {
      title: '결과',
      soundmap: '이번 판 소리 지도', record: '기록', turns: '턴', noneShots: '없는 소리',
      turnsN: '{n}턴', timesN: '{n}번', hitsN: '맞힌 소리 {n}개',
      shots: '쏜 발', shotsN: '{n}발',   // 대결은 턴 대신 '발'로 센다
      hits: '맞힌 소리', hitsCount: '{n}개',
      notAll: '찾지 못한 배가 있어요',    // 연습에서 턴을 다 쓴 판의 결과 제목(모두 찾으면 play.allFound)
      know: '알아 두기', question: '생각해 볼 질문',
      win: '승', lose: '패', draw: '무승부',
      winner: { blue: '청팀 승', red: '홍팀 승', draw: '무승부' },
      again: '한 판 더', home: '처음으로',
    },
    // 이 기기의 소리 지도(누적)
    soundmap: { title: '이 기기의 소리 지도', empty: '아직 맞힌 소리가 없어요', back: '뒤로' },
    // 만든 사람·출처(음원·글꼴 출처 줄은 에셋을 넣을 때 채운다)
    credits: { title: '만든 사람·출처', back: '뒤로', lines: [] },
  },
};

// ───────────────────────────────────────────────────────────────
// 도우미 함수(다른 코드가 문구를 꺼낼 때 씀). 문구만 고칠 때는 건드리지 않는다.
// ───────────────────────────────────────────────────────────────
window.G = window.G || {};
G.text = (function () {
  const T = window.TEXT;
  const gr = (g) => (g === 'h1' ? 'h1' : 'm3'); // 모르는 값이면 중3
  return {
    // 학년별 긴 이름: term('h1', 'place', 'velar') → '여린입천장소리·연구개음'
    term(grade, group, id) {
      const g = T.terms[gr(grade)][group];
      return g && g[id] != null ? g[id] : '';
    },
    // 학년별 짧은 이름(카드·머리글): short('m3', 'manner', 'stop') → '파열'
    short(grade, group, id) {
      const g = T.shortTerms[gr(grade)][group];
      return g && g[id] != null ? g[id] : '';
    },
    // 소리 표기: sound('ㄱ') → '/ㄱ/'
    sound(id) { return '/' + id + '/'; },
    // 따라 해 보기 한 줄
    follow(id) { return T.follow[id] || ''; },
    // 신호·안내 한 줄: signal('line') → '같은 줄에 배가 있어요'
    signal(kind) { return T.signal[kind] || ''; },
    signalName(kind) { return T.signalName[kind] || ''; },
    // 배를 찾았을 때 한 줄: sunk(3) → '세 칸 배를 찾았어요'
    sunk(size) { return T.sunk[size] || ''; },
    shipName(size) { return T.ships.name[size] || ''; },
    legend(sea) { return [3, 2, 1].map((n) => T.ships.legend[sea === 'vowel' ? 'vowel' : 'consonant'][n]); },
    // 알아 두기 한 줄: know('pair-ㄱㅇ')
    know(id) { return T.know[id] || ''; },
    // 생각해 볼 질문 목록 / 하나 고르기(seed가 같으면 같은 질문)
    debrief(grade, sea) { return T.debrief[gr(grade)][sea === 'vowel' ? 'vowel' : 'consonant']; },
    pickDebrief(grade, sea, seed) {
      const list = this.debrief(grade, sea);
      const i = seed == null ? Math.floor(Math.random() * list.length) : Math.abs(Math.floor(seed)) % list.length;
      return list[i];
    },
    // 풀이 예시의 발마다 한 줄(학년별)
    exampleLine(grade, i) { const s = T.example.shots[i]; return s ? s.line[gr(grade)] : ''; },
    // {이름} 자리 채우기: fill('{n}턴', { n: 8 }) → '8턴'
    fill(tpl, vars) {
      return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));
    },
  };
})();
