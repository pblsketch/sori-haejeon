# 규칙(반드시 지킬 것)

어기면 점검이 실패하거나, 화면이 깨지거나, 선생님이 뺀 내용이 되살아나는 규칙만 적는다.

## 내용·표기

- 화면에 나오는 소리는 **모두 빗금 표기** `/ㄱ/`, `/ㅏ/`. 빗금 없는 낱자모를 화면 글에 두지 않는다(완성된 한글 낱말 안은 상관없음). 코드에서는 `G.text.sound(id)`·`G.rules.slash(id)`로 만든다. 위반 판정: `check-text`(데이터)·`check-screen-text`(실제 화면)가 실패한다.
- **'글자'라는 낱말을 화면 어디에도 쓰지 않는다**(소리를 글자라 부르지 않음). 금지 낱말: 글자, 훈민정음, 해례, 제자 원리(제자원리), 상형, 가획, 중세, 조선 수군, 판옥선, 협선, 척후선, 게임오버(게임 오버) — `check-text`는 `js/data/text.js`의 문구와 파일 전체에서, `check-screen-text`는 실제 화면 글에서(여기서는 '조선' 자체도) 찾는다. 그림·음악도 조선 소재·옛글자를 쓰지 않는다. 위반 판정: 같은 두 점검.
- 되살리지 않는 것(선생님이 뺌): 글자 변신 연출·옛 바다·해례 인용 등 문자·중세국어 연결 전부, Three.js·3D, 교사용 기능(리모컨·`?teacher=1`·주소 미리 설정), 따로 된 팀 모드, 실제 음성 재생·마이크, 신호 복기, 낱말 짝 보기, 다음 시간 예고, 휴대폰 대결. 배에 이름을 붙이지 않는다(크기로만). 신호 이름을 네 가지보다 늘리지 않는다.
- 설명 문구는 **한 화면에 한 줄 자리 하나**(대결은 팀 자리마다 하나), 줄바꿈 없이 한 줄로 그려진다(넘치면 글씨를 최소 15px까지 줄이고 그래도 넘치면 말줄임). 문구는 휴대폰 한 줄에 들어가게 대략 30자 이내. 위반 판정: `check-controls`·`check-screen-text`.
- 학년은 용어·안내·질문만 바꾼다. `LEVELS`·`FLEETS`·`G.rules`에 학년 분기를 두지 않는다.

## 모듈 경계

- **규칙은 `G.rules`에만.** 채점·신호 판단·세기 카드 흐림·발사 켜짐·함대 배치·턴·승패·알아 두기 고르기를 화면 코드(`js/game/*`)에서 다시 계산하지 않는다. 화면은 `G.rules.controls`·`fire`·`fireTeam`·`teamInfo`·`placeableGroups`·`makeRecord`의 결과만 쓴다.
- `js/core/rules.js`와 `js/data/*`는 **DOM·`document`·`localStorage`를 쓰지 않는다**(Node의 `vm`에서 그대로 불러 점검한다). 쓰면 `check-rules`·`check-text`가 불러오다 실패한다.
- `G.rules`의 함수는 받은 값을 바꾸지 않는다. 상태를 바꾸는 함수(`fire`·`fireTeam`·`placeShip`·`finishPlacing`·`restartPlacing`)는 새 상태를 돌려주고, 턴을 쓰지 않는 결과면 **받은 상태를 그대로(같은 객체)** 돌려준다.
- 판 상태·판 기록은 JSON으로 옮길 수 있는 평범한 값만 담는다(함수·Date·Map 금지). 모양은 `js/core/rules.js` 머리 주석이 기준이며, 모양을 바꾸면 그 주석과 저장 버전(`js/core/save.js`의 `GAME_V`/`SCHEMA`)을 함께 판단한다.
- 화면 문구는 `js/data/text.js`(`TEXT`)에만 둔다. 화면 코드에 한국어 문장을 박지 않는다(글꼴 도구가 모으는 곳이자 선생님이 고치는 곳).
- 화면 부품(`G.mouth`·`G.board`·`G.controls`)끼리 서로 부르지 않는다. 엮는 것은 화면(`G.practice`·`G.duel`)이다.
- 화면은 `G.app.go(이름, 값)`으로만 바꾼다. 판이 끝나면 화면은 `G.app.finishGame(판 상태)`만 부른다(누적 지도 더하기·진행 판 지우기를 화면에서 직접 하지 않는다).
- 입안 단면도에는 누르는 자리를 만들지 않는다(보여 주기 전용). 판(바다)의 칸도 쏘기 입력이 아니다(대결 숨기기 시간의 배치만 예외).

## 불러오기·등록

- ES 모듈(`import`/`export`)과 빌드 도구를 쓰지 않는다. 새 스크립트는 `index.html`의 `<!-- scripts:start -->` 안에 **층 순서**(util → data → core → game → main)를 지켜 한 줄 더한다. 새 CSS는 `<!-- styles:start -->` 안, `base` → `fonts` 뒤에.
- 데이터 파일은 `window.이름 = …`으로 내보낸다. 최상위 `const`/`let`은 Node 점검에서 보이지 않는다.
- 모든 파일은 `'use strict';`로 시작하고, 새 전역은 `G.<이름>` 하나만 연다.
- 외부 스크립트·글꼴·CSS를 URL로 불러오지 않는다(모두 동봉).

## 오류 처리

- `console.error`는 **페이지 오류로 센다**(`js/core/util.js`가 `window.__soriErrors`에 모으고, 모든 브라우저 점검이 0개를 요구한다). 예상된 실패(저장소 막힘, 음원 파일 없음)는 조용히 넘기거나 `console.warn` 한 번만 쓴다.
- `G.audio`의 공개 함수와 `G.save`의 모든 함수는 어떤 경우에도 예외를 던지지 않는다.

## 화면 표현(선생님이 채택한 디자인 검수)

- 색은 `css/base.css`의 토큰만 쓰고 역할을 섞지 않는다: 팀 색(`--blue` #245CB3, `--red` #B5323A)은 팀 표시·팀 영역·대결 발사 단추에만, 신호 색(`--hit` 황금, `--line` 보라, `--miss`, `--dud`)은 발사 결과에만, `--accent`(청록)는 일반 발사·현재 선택에만. 명중과 오류에 빨강을 쓰지 않는다.
- 맞히지 않은 소리를 흐리게 하지 않는다(기본 잉크, 칸 바탕 위 명암비 4.5 이상).
- 신호는 색 + 기호(과녁 · ↔/↕/겹친 네모 · × · ∅)로 구분한다. 기호는 `G.util.glyph`의 SVG로 그린다(글꼴 기호에 기대지 않음).
- 다크 모드 없음. 명중 연출은 불꽃 없이 황금 + 과녁. 반복 깜박임·흔들림 반복·계속 움직이는 장식 없음.
- 글꼴: 로고·대제목만 `SoriTitle`(Hahmlet 800), 그 밖의 모든 글과 판 위 소리 표기는 `SoriUI`(Pretendard 500/600/700, 소리 표기는 700 한 가지 — 기울임·외곽선·강한 그림자 없음).
- 터치 목표: 가로 배치 64px 이상, 휴대폰 세로 48px 이상, 휴대폰 발사 단추 56px 이상. 가로 스크롤 없음. 휴대폰 세로 연습은 스크롤 없이 한 발. 위반 판정: `check-shots`·`check-practice`·`check-controls`.
- 세로 배치 기준 `(max-width: 760px), (orientation: portrait)`과 '세로로 돌려 주세요' 기준 `(orientation: landscape) and (max-height: 500px)`은 여러 파일에 같은 값으로 있다. 하나를 바꾸면 모두 바꾼다: 세로 기준은 `js/game/app.js`·`controls.js`·`practice.js`·`duel.js`와 `css/base.css`·`app.css`·`mouth.css`, 낮은 가로 기준은 `js/game/app.js`·`duel.js`와 `css/app.css`·`practice.css`.
- 대결 화면은 두 팀이 동시에 누른다: 포인터마다(`pointerId`) 따로 받고, 문서 전체의 `preventDefault`나 포인터 하나만 받는 잠금을 두지 않는다. 한 팀의 조작·애니메이션이 다른 팀을 막으면 안 된다.

## 점검 관문

- 커밋 전: 고친 곳에 해당하는 점검(`npm test -- <이름>`), 병합·배포 전: `cd tests && npm test` 전체가 **0으로 끝남**(마지막 줄 '모두 통과').
- 새 기능·규칙에는 점검을 더한다: 규칙은 `tests/check-rules.mjs`(브라우저 없이), 화면 동작은 해당 `tests/check-<부품>.mjs`(aside). 새 점검 파일은 `tests/check-<이름>.mjs`로 두면 `run-all.mjs`가 저절로 돈다.
- 브라우저 점검은 **aside로만** 한다(선생님 지정). Playwright·Puppeteer 등 다른 브라우저 자동화 도구를 들이지 않는다. `tests/`에는 외부 npm 의존성이 없다(`package.json`에 dependencies 없음).
- 점검 대본은 끝에 `PASS`를 찍어야 합격으로 친다. 실패는 `throw`하거나 `FAIL …`을 찍는다.
- 점검용 값(`?clear=1`, `?seen=1`, `?layout=portrait`, `G.practice.debug()`, `G.duel.current.debug`, `G.duel.config`)은 점검 페이지·점검 대본에서만 쓰고, 게임 화면에 단추·글로 드러내지 않는다.

## 커밋·저장소

- 작성자는 저장소 설정의 `pblsketch`(noreply 주소). 커밋 메시지는 한국어로 무엇을 왜 바꿨는지.
- 저장소에 올리지 않는 것(.gitignore): 개발 도구의 작업 폴더(`.omc/` 등), `tests/node_modules/`, `tests/shots/`(캡처), `tools/fonts_src/`(원본 글꼴), `assets/raw/`(생성 원본 그림·원본 음원), `__pycache__/`.
- 원격에 올리기(`git push`, 저장소 만들기, Pages 켜기) 전에는 선생님께 확인받는다.
- 외부 파일(음원·글꼴·그림·패키지)은 선생님 승인 없이 내려받지 않는다. 예외: 이미 승인된 Hahmlet·Pretendard 원본 글꼴과 fontTools·brotli.
