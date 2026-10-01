# js/game — 화면 모듈과 짝 CSS

## 맡는 것
화면 부품 셋과 화면 셋. 파일마다 짝 CSS가 `css/<이름>.css`에 있다(`app.js` ↔ `css/app.css`). 각 파일 머리 주석에 쓰는 법(공개 함수)이 있다.
- `mouth.js`(`G.mouth`): SVG 입안 단면도. **보여 주기 전용**(누르는 자리 없음). `select/setManner/setStrength/setLips`로 미리 보기, `play(조합)` → Promise(1.5초 안)로 조음 동작 + 공기 입자.
- `board.js`(`G.board`): 섬과 암초 바다 지도 위 체계표. `render/update(보기)`, `revealFleet`, `setSelection`(현재 선택 줄 머리), 숨기기 시간의 `mode: 'place'`(`setPlaceable/setPlaced/onPick`), `soundMap`(결과·누적 지도), 남은 배 목록 `ships`, `viewOf(판 상태, 쏘는 팀)`.
- `controls.js`(`G.controls`): 아래 조작부(①②③ 카드 + 발사), 조합 요약 줄, 한 줄 문구 자리, 신호 기록장.
- `howto.js`(`G.howto`): '게임 방법' 창. `open({ grade, sea, mode, onClose })`이 `document.body`에 덮개를 붙인다(화면을 바꾸지 않으므로 판 도중에 열어도 판은 그대로). `button(cls, 옵션함수, 글)`이 여는 단추를 만든다. 열면 `G.save.setSeenHowto(true)`.
- `practice.js`(`G.practice.open`): 연습 — 준비 → (첫 자음 1단계면 풀이 예시) → 판 → 끝 → `G.app.finishGame`.
- `duel.js`(`G.duel.open`): 대결 — 준비 → (숨기기 시간: 가림·청팀 30초·가림·홍팀 30초·가림) → 실시간 두 자리 → 끝 → `G.app.finishGame`.
- `app.js`(`G.app`): `go(이름, 값)` 화면 전환, `finishGame`, 시작·설정·소리 지도·출처·결과 화면, `isPortrait/isLowLandscape`, '세로로 돌려 주세요' 덮개.

## 맡지 않는 것(건드리지 말 것)
- 채점·신호·세기 흐림·발사 켜짐·배치 가능 여부·턴·승패·알아 두기 고르기 계산 → `G.rules`의 결과만 쓴다. 여기서 다시 계산하면 규칙이 두 곳이 된다.
- 문구 → `TEXT`/`G.text`. 화면 코드에 한국어 문장을 박지 않는다(글꼴 도구도 문구를 모으지만, 선생님은 `js/data/text.js`만 고친다).
- 저장 형식 → `G.save`. localStorage를 직접 만지지 않는다.
- 부품끼리 서로 부르지 않는다: `mouth`·`board`·`controls`는 서로를 모른다. 엮는 것은 `practice`·`duel`.
- 누적 지도 더하기·진행 판 지우기 → `G.app.finishGame`만. 연습·대결 화면은 판이 끝나면 그것만 부른다.

## 불변 조건
- 숨긴 단계(`LEVELS.show`가 거짓인 것)에서 칸 안 소리·빈칸 여부·세기 자리 수·배 크기가 **글·DOM 속성·클래스·aria-label·title** 어디에도 드러나지 않는다. 가라앉기 전 명중 조각은 모든 배가 같은 그림(`top_hit`).
- 판 화면의 설명 문구 자리는 연습 하나, 대결은 팀 자리마다 하나이고 늘 한 줄(넘치면 15px까지 줄이고 말줄임). 여러 줄 안내는 학생이 여는 '게임 방법' 창에만 두고, 저절로 띄우지 않는다.
- '따라 해 보기'는 도움 단계에서 **국어에 있는 조합일 때만**. 없는 조합이면 중립 줄("준비됐으면 발사!").
- 조작 카드 이름은 모든 단계에서 보인다. 숨기는 단계가 가리는 것은 판 줄 이름과 단면도 자리 이름뿐.
- 대결: 팀 자리마다 포인터를 `pointerId`별로 따로 받는다. 문서 전체 `preventDefault`나 포인터 하나만 받는 잠금 금지. 한 팀의 애니메이션 동안 그 팀 조작부만 잠근다. 발을 다 쓴 팀(`G.rules.teamInfo(…).outOfShots`)은 조작부를 잠그고 기다림 줄을 띄운다.
- 판이 끝난 뒤 결과를 기다리는 동안(연습 끝 멈춤, 대결 남은 배 공개)의 '처음으로'는 판을 잃지 않게 `G.app.finishGame(판 상태)`로 보낸다(누적 지도에는 `saveGame`이 끝나는 순간 이미 더했지만, 결과 화면까지 잃지 않게). 끝난 판은 반드시 `G.save.saveGame`을 거친다.
- 대결은 세로 배치·낮은 가로 화면에서 열지 않는다(안내 한 줄 + '처음으로'). 연습은 세로 배치에서 단면도·바다 반반 + 하단 고정 조작부, 스크롤 없이 한 발.
- 터치 목표: 가로 64px, 휴대폰 세로 48px, 휴대폰 발사 56px 이상. 가로 스크롤 없음.
- 색은 `css/base.css` 토큰만: 팀 색은 팀 표시에만, 신호 색(황금·보라·miss·dud)은 결과에만, 청록 `--accent`는 일반 발사·현재 선택. 신호는 색 + `G.util.glyph` 기호.
- 연출은 한 번(0.2초 안팎)하고 멈춘다. '움직임 줄이기'(`G.util.reducedMotion()`)면 애니메이션 대신 정지 그림.
- `console.error`를 쓰지 않는다(페이지 오류로 셈). 그림·소리가 없어도 판정·진행은 계속한다(`try { await mouth.play() } catch {}` 꼴).

## 구현 방식
- 화면 `open({ resume, container })`은 `container`(없으면 `#app`)를 비우고 그린 뒤 `{ destroy() }`를 돌려준다. `destroy`는 타이머·부품·이벤트를 모두 치운다. 늦게 끝난 비동기 작업은 토큰(`alive(my)`)으로 버린다.
- 새 판: `G.rules.newGame(…)` + `state.id = G.save.newGameId()` → 곧바로 `G.save.saveGame`. 매 발 뒤에도 `saveGame`.
- 한 발: 발사 → 조작부 잠금 → `G.audio.sfx('fire')` → `await mouth.play(조합)` → `G.rules.fire`/`fireTeam` → `board.update(G.board.viewOf(state, 팀))` → 효과음(`hit`/`sunk`/`dud`/`miss`) → 기록장 → 저장 → 한 줄 문구 → 잠금 풀기.
- 배치는 `(max-width: 760px), (orientation: portrait)`(세로)·`(orientation: landscape) and (max-height: 500px)`(낮은 가로)로 가른다. 이 값은 `app.js`·`controls.js`·`practice.js`·`duel.js`와 CSS 여러 곳에 같은 값으로 있으니 함께 바꾼다. 방향이 바뀌면 부품만 다시 그리고 판 상태는 그대로.
- 판 위 배 그림은 `assets/img/top_*.webp`(없으면 코드로 그린 모양). 남은 배 목록은 `ships().set(격침 번호, 방금 격침, 번호표, 함대)` — 함대를 넘겨야 가라앉은 배 이름 자리에 '찾음 · 소리'가 붙는다. 떨어진 칸의 격침 배는 점선 끌줄 + 두 조각과 남은 배 목록에 같은 번호.
- 점검용 통로(게임 화면에 드러내지 않음): `G.practice.debug()`, `G.practice.config`(멈춤 시간), `G.duel.current.debug`, `G.duel.config`(숨기기 시간 등), 단면도 SVG의 `data-*` 상태 값, 뿌리 요소의 `data-screen`. 점검이 이것에 기대므로 이름을 바꾸면 `tests/`를 함께 고친다.

## 점검(aside, `cd tests && npm test -- <이름>`)
- `mouth`: 자음 56조합·모음 12조합 재생, 막음 표시·콧길 문·목청·혀 모양이 규칙대로, 이름 숨김, 크기별.
- `board`: 단계별 숨김 정보가 DOM·문자열·aria에 없음, 표시 쌓기·강조·격침·공개, 배치 모드, 휴대폰 칸 크기.
- `controls`: 세기 흐림·발사 켜짐·없는 조합 허용·한 줄 문구·요약 줄·기록장, 가로/휴대폰.
- `practice`·`duel`·`app`: G.app(또는 화면 모듈)을 흉내 낸 점검 페이지에서 흐름 끝까지, 새로고침 뒤 이어서, 여러 손가락, 세로 안내.
- `play`·`shots`·`screen-text`: 진짜 `index.html`을 크기별 틀에 띄워 학생처럼 끝까지, 캡처·터치 크기·스크롤, 화면 글 전체.
- 판이 끝나는 흐름·'처음으로'를 고치면 결과가 누적 지도에 한 번만 들어가는지(`app`, `play`)를 꼭 본다.
