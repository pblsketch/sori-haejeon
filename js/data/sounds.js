'use strict';
// 음운 데이터(spec 3.1·3.2 — 채점의 진실). 화면 문구(용어 이름 등)는 여기 두지 않는다(js/data/text.js).
//   소리 id는 한글 자모 한 개('ㄱ', 'ㅏ'). 화면에는 언제나 /ㄱ/처럼 빗금으로 적는다(G.rules.slash).
//   다음 편(음운 변동 게임)이 가져다 쓸 수 있게 소리를 자질로만 적는다.
window.SOUNDS = (function () {
  // 자음: 조음 위치(열, 왼→오), 조음 방법(행, 위→아래, 교과서 순서), 세기
  const places = ['bilabial', 'alveolar', 'palatal', 'velar', 'glottal'];
  const manners = ['stop', 'affricate', 'fricative', 'nasal', 'liquid'];
  const strengths = ['plain', 'tense', 'aspirated']; // 세기 카드 3장. 세기 구분이 없는 소리는 'none'

  // [소리, 위치, 방법, 세기]
  const C = [
    ['ㅂ', 'bilabial', 'stop', 'plain'], ['ㅃ', 'bilabial', 'stop', 'tense'], ['ㅍ', 'bilabial', 'stop', 'aspirated'],
    ['ㄷ', 'alveolar', 'stop', 'plain'], ['ㄸ', 'alveolar', 'stop', 'tense'], ['ㅌ', 'alveolar', 'stop', 'aspirated'],
    ['ㄱ', 'velar', 'stop', 'plain'], ['ㄲ', 'velar', 'stop', 'tense'], ['ㅋ', 'velar', 'stop', 'aspirated'],
    ['ㅈ', 'palatal', 'affricate', 'plain'], ['ㅉ', 'palatal', 'affricate', 'tense'], ['ㅊ', 'palatal', 'affricate', 'aspirated'],
    ['ㅅ', 'alveolar', 'fricative', 'plain'], ['ㅆ', 'alveolar', 'fricative', 'tense'],
    ['ㅎ', 'glottal', 'fricative', 'none'], // 교과서마다 세기 자리가 달라서 세기 없음으로 채점
    ['ㅁ', 'bilabial', 'nasal', 'none'], ['ㄴ', 'alveolar', 'nasal', 'none'], ['ㅇ', 'velar', 'nasal', 'none'],
    ['ㄹ', 'alveolar', 'liquid', 'none'],
  ];

  // 모음: 행 = 혀의 높이, 열 = 혀의 앞뒤 × 입술 모양
  const heights = ['high', 'mid', 'low'];
  const columns = ['front-unrounded', 'front-rounded', 'back-unrounded', 'back-rounded'];
  // [소리, 높이, 앞뒤, 입술] — 표준 발음법 원칙대로 단모음 10개(/ㅚ/·/ㅟ/ 포함)
  const V = [
    ['ㅣ', 'high', 'front', 'unrounded'], ['ㅟ', 'high', 'front', 'rounded'], ['ㅡ', 'high', 'back', 'unrounded'], ['ㅜ', 'high', 'back', 'rounded'],
    ['ㅔ', 'mid', 'front', 'unrounded'], ['ㅚ', 'mid', 'front', 'rounded'], ['ㅓ', 'mid', 'back', 'unrounded'], ['ㅗ', 'mid', 'back', 'rounded'],
    ['ㅐ', 'low', 'front', 'unrounded'], ['ㅏ', 'low', 'back', 'unrounded'],
    // 저·앞·원순, 저·뒤·원순은 빈칸(국어에 없는 소리)
  ];

  return {
    places, manners, strengths, heights, columns,
    backs: ['front', 'back'],
    lips: ['unrounded', 'rounded'],
    consonants: C.map(([id, place, manner, strength]) => ({ id, sea: 'consonant', place, manner, strength })),
    vowels: V.map(([id, height, backness, lips]) => ({ id, sea: 'vowel', height, backness, lips, column: backness + '-' + lips })),
    // 결과 화면 '알아 두기'가 나오는 조건(spec 6.5). 문구는 js/data/text.js가 id로 찾는다.
    //   any: 이 가운데 하나라도 쐈으면 / all: 모두 쐈으면. 두 팀 대결은 두 팀이 쏜 소리를 합쳐서 본다.
    notes: [
      { id: 'pair-ㅂㅁ', sea: 'consonant', all: ['ㅂ', 'ㅁ'] }, // 막는 자리가 같고 콧길만 다름
      { id: 'pair-ㄷㄴ', sea: 'consonant', all: ['ㄷ', 'ㄴ'] },
      { id: 'pair-ㄱㅇ', sea: 'consonant', all: ['ㄱ', 'ㅇ'] },
      { id: 'ng', sea: 'consonant', any: ['ㅇ'] },             // /ㅇ/은 음절 끝에서만 나는 소리
      { id: 'oe-wi', sea: 'vowel', any: ['ㅚ', 'ㅟ'] },        // 이중 모음으로 발음해도 표준 발음으로 인정
      { id: 'e-ae', sea: 'vowel', any: ['ㅔ', 'ㅐ'] },         // 실제로는 구별하지 않는 사람이 많음
    ],
  };
})();
