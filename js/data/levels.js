'use strict';
// 단계 설정(spec 4). 학년은 말만 바꾸므로 단계는 학년과 상관없다. 이름·설명 문구는 js/data/text.js.
//   open           배가 숨을 수 있고 쏠 수 있는 소리(열린 칸). 국어에 있지만 열리지 않은 소리를 쏘면 '이번 바다에 없는 칸'.
//   strengthCards  (자음) 세기 카드가 있는가. 없으면 파열·파찰·마찰은 예사소리로 정해진다.
//   show           판·단면도에 보이는 것
//                    cellSounds 칸 안 소리 / emptyCells 빈칸(없는 소리)이 비어 보이는가 /
//                    strengthSlots (자음) 칸 안 세기 자리 구분 / lineNames 줄·열 이름 / placeNames 단면도 자리 이름
//   highlight      '같은 줄' 신호에서 어느 줄인지 강조하는가(없으면 "같은 줄에 배가 있어요"만)
//   help           followAlong '따라 해 보기' 한 줄 / example 풀이 예시(연습 모드, 자음 1단계)
//   fleet          함대 구성 — 배 크기 목록, 큰 배부터 놓는 순서
//   turns          제한 턴(팀마다)
// ※ 조정값: turns(제한 턴)와 모음 바다의 fleet(함대 구성)는 교실에서 해 보고 선생님이 알려 주면 고친다.
window.LEVELS = (function () {
  const ALL_C = ['ㅂ', 'ㅃ', 'ㅍ', 'ㄷ', 'ㄸ', 'ㅌ', 'ㄱ', 'ㄲ', 'ㅋ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅅ', 'ㅆ', 'ㅎ', 'ㅁ', 'ㄴ', 'ㅇ', 'ㄹ'];
  const ALL_V = ['ㅣ', 'ㅟ', 'ㅡ', 'ㅜ', 'ㅔ', 'ㅚ', 'ㅓ', 'ㅗ', 'ㅐ', 'ㅏ'];
  const shown = { cellSounds: true, emptyCells: true, strengthSlots: true, lineNames: true, placeNames: true };
  const noHelp = { followAlong: false, example: false };
  return {
    consonant: {
      1: {
        sea: 'consonant', level: 1,
        open: ['ㅂ', 'ㄷ', 'ㄱ', 'ㅈ', 'ㅅ', 'ㅁ', 'ㄴ', 'ㅇ', 'ㄹ'], // 9칸(/ㅎ/ 없음)
        strengthCards: false,
        show: Object.assign({}, shown),
        highlight: true,
        help: { followAlong: true, example: true },
        fleet: [2, 1, 1], // 두 칸 배 1 + 한 칸 배 2
        turns: 8,         // 조정값
      },
      2: {
        sea: 'consonant', level: 2,
        open: ALL_C.slice(),
        strengthCards: true,
        // 칸 안 소리 숨김: 25칸이 모두 같은 모양, 칸 안 세기 자리 구분도 숨김. 줄 이름·자리 이름은 보임
        show: { cellSounds: false, emptyCells: false, strengthSlots: false, lineNames: true, placeNames: true },
        highlight: true,
        help: Object.assign({}, noHelp),
        fleet: [3, 2, 1],
        turns: 12, // 조정값
      },
      3: {
        sea: 'consonant', level: 3,
        open: ALL_C.slice(),
        strengthCards: true,
        show: { cellSounds: false, emptyCells: false, strengthSlots: false, lineNames: false, placeNames: false },
        highlight: false,
        help: Object.assign({}, noHelp),
        fleet: [3, 2, 1],
        turns: 12, // 조정값
      },
    },
    vowel: {
      1: { // '자세한 신호'
        sea: 'vowel', level: 1,
        open: ALL_V.slice(),
        show: { cellSounds: true, emptyCells: true, lineNames: true, placeNames: true },
        highlight: true,
        help: { followAlong: true, example: false },
        fleet: [3, 2, 1], // 조정값(모음 함대)
        turns: 8,         // 조정값
      },
      2: { // '줄어든 신호'
        sea: 'vowel', level: 2,
        open: ALL_V.slice(),
        show: { cellSounds: false, emptyCells: false, lineNames: false, placeNames: false },
        highlight: false,
        help: Object.assign({}, noHelp),
        fleet: [3, 2, 1], // 조정값(모음 함대)
        turns: 8,         // 조정값
      },
    },
  };
})();
