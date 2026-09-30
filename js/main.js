'use strict';
// 게임 시작점 — 가장 마지막에 불러온다(index.html의 scripts 끝).
//   1) 저장된 설정(배경 음악·효과음·움직임 줄이기)을 적용한다.
//   2) 시작 화면을 연다. 결과 화면에서 새로고침해도 여기로 온다(진행 판은 이미 지워져 있음).
//   소리는 첫 터치 뒤에 켜진다(js/core/audio.js가 알아서 기다림).
//   연습·대결 화면은 G.practice·G.duel이 등록되어 있으면 G.app.go가 부른다(따로 목록에 적지 않아도 됨).
(function () {
  function boot() {
    G.save.applySettings();
    G.app.start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
