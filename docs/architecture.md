# 시스템 구성

## 전체 모양

브라우저 하나 안에서 모든 것이 도는 정적 웹 게임이다. 서버 쪽 코드가 없고, 배포는 파일을 그대로 올리는 GitHub Pages다. 로컬에서는 `index.html` 더블클릭(file://)이나 정적 파일 서버로 연다.

- `index.html`은 `#app` 한 칸과 `<link>`·`<script>` 목록뿐이다. 일반 스크립트를 이 순서로 읽는다:
  `js/core/util.js` → `js/data/`(sounds → fleets → levels → text → mouth) → `js/core/`(rules → audio → save) → `js/game/`(mouth → board → controls → howto → practice → duel → app) → `js/main.js`.
  CSS는 `base` → `fonts` → `mouth` → `board` → `controls` → `howto` → `practice` → `duel` → `app`.
- 모든 모듈은 전역 `window.G` 아래 이름 하나씩을 연다: `G.util`, `G.rules`, `G.text`, `G.audio`, `G.save`, `G.mouth`, `G.board`, `G.controls`, `G.howto`, `G.practice`, `G.duel`, `G.app`. 데이터는 전역 상수 `window.SOUNDS`, `FLEETS`, `LEVELS`, `TEXT`, `MOUTH`다.
- ES 모듈(`import`/`export`)이 없으므로 의존 방향은 **불러오는 순서**로만 지켜진다. 뒤에 오는 파일은 앞의 이름을 쓸 수 있고, 앞의 파일은 뒤의 이름을 **불러오는 순간**에 쓰면 안 된다(실행 중 호출은 가능 — 예: `G.practice`가 판이 끝날 때 `G.app.finishGame`을 부름).

## 모듈 지도(역할 · 의존 방향)

| 층 | 모듈 | 역할 | 기대는 것 |
|---|---|---|---|
| 데이터 | `SOUNDS` | 자음 19·단모음 10의 자질, '알아 두기' 조건 — 채점의 진실 | 없음 |
| 데이터 | `FLEETS` | 배 크기별로 숨을 수 있는 소리 묶음 | 없음 |
| 데이터 | `LEVELS` | 단계별 열린 칸·보이는 것·강조·도움·함대 구성·제한 턴 | 없음 |
| 데이터 | `TEXT` + `G.text` | 화면의 모든 학습 문구, 학년별 용어, 문구를 찾는 도우미 | 없음 |
| 데이터 | `MOUTH` | 단면도 좌표, 방법·세기별 공기 흐름 규칙, 조음 동작 시간표 | 없음 |
| 핵심 | `G.util` | DOM 도우미, 신호 기호(SVG), 움직임 줄이기 판정, 페이지 오류 모음 | 없음 |
| 핵심 | `G.rules` | 채점·신호·함대 배치·턴·승패·판 기록 — DOM을 쓰지 않는 순수 함수 | SOUNDS·FLEETS·LEVELS |
| 핵심 | `G.audio` | 녹음 음원 재생(배경 음악 반복·겹쳐 바꾸기, 효과음) | 없음 |
| 핵심 | `G.save` | localStorage 저장(설정·마지막 선택·누적 소리 지도·풀이 예시 본 적·진행 판) | `G.rules`·`G.audio`(있으면) |
| 화면 부품 | `G.mouth` | SVG 입안 단면도(보여 주기 전용) + 조음 동작·공기 입자 애니메이션 | MOUTH·TEXT |
| 화면 부품 | `G.board` | SVG/DOM 바다 지도(체계표 격자·소리 표지·신호·배 조각), 남은 배 목록, 소리 지도 | `G.rules`·TEXT |
| 화면 부품 | `G.controls` | 아래 조작부(①②③ 카드·발사), 조합 요약 줄, 한 줄 문구, 신호 기록장 | `G.rules.controls`·TEXT |
| 화면 부품 | `G.howto` | '게임 방법' 창(화면 위에 뜨는 덮개, 자음/모음 탭) — 여는 단추도 만든다 | TEXT·`G.board.shipPic`·`G.save`(연 적 있음) |
| 화면 | `G.practice` | 연습 화면(준비·풀이 예시·판·끝) | rules·save·audio·mouth·board·controls·howto |
| 화면 | `G.duel` | 대결 화면(준비·가림·숨기기·실시간 대결·끝) | rules·save·audio·mouth·board·controls |
| 화면 | `G.app` | 화면 전환, 시작·설정·소리 지도·출처·결과 화면, 세로/가로 판정 | 위 전부 |
| 시작 | `js/main.js` | 저장된 설정 적용 → 시작 화면 | `G.save`·`G.app` |

화면 부품(`G.mouth`·`G.board`·`G.controls`)은 서로를 모른다. 셋을 엮는 것은 화면(`G.practice`·`G.duel`)이다: 조작부의 `onChange`를 받아 단면도 미리 보기에 넘기고, `onFire`를 받아 단면도 재생 → 규칙 채점 → 판 갱신을 차례로 부른다.

## 대표 흐름: 연습에서 한 발

1. 학생이 조작부 카드를 누른다 → `G.controls`가 고른 것을 모으고 `G.rules.controls(단계, 고른 것)`으로 세기 카드 흐림·발사 단추 켜짐을 정한다 → `onChange`로 연습 화면에 알림 → 연습 화면이 `G.mouth.select/setManner/setStrength/setLips`로 단면도 모양을 바꾼다(미리 보기).
2. 발사 → `onFire(조합)` → 연습 화면이 조작부를 잠그고 `G.audio.sfx('fire')`, `await G.mouth.play(조합)`(1.5초 안, 없는 조합도 고른 대로 재생).
3. `G.rules.fire(판 상태, 조합)` → `{ state, outcome }`. 턴을 쓰지 않는 결과(`notInSea`·`already`)면 상태는 그대로이고 한 줄 문구만 바뀐다.
4. 턴을 쓴 발이면 `G.board.update(G.board.viewOf(state, 'player'))`가 늘어난 발만 짧게 강조해 그린다 → 효과음(명중/격침/불발/물보라) → `G.controls.log(발)` → `G.save.saveGame(state)`(끝난 판이면 이 순간 누적 지도에 더하고 진행 판을 지움) → 한 줄 문구(`G.text.signal(kind)` 또는 격침 줄).
5. `outcome.over`면 끝: 실패 판은 `G.board.revealFleet`로 남은 배 공개 → 잠깐 뒤 `G.app.finishGame(state)`.
6. `G.app.finishGame`: `G.rules.makeRecord(state)` → `G.save.addRecord(기록, state.id)`(5단계에서 이미 더했으면 같은 판이라 무시) → `G.save.clearGame()` → 결과 화면(`go('result', { record })`).

대결의 한 발은 3단계가 `G.rules.fireTeam(state, 팀, 조합)`으로 바뀌고, 그 팀 자리의 단면도·조작부만 잠긴다. 두 팀의 발은 서로 기다리지 않으며 각 발은 **그 순간의** 판 상태로 채점된다.

## 화면 전환

`G.app.go(이름, 값)` 하나로 바꾼다. 지금 화면 핸들의 `destroy()`를 부르고 `#app`을 비운 뒤 새 화면을 연다(한 번에 한 화면). 이름: `title` · `settings` · `soundmap` · `credits` · `practice` · `duel` · `result`.
- `practice`/`duel`은 `G.practice.open({ resume, container })` / `G.duel.open(…)`을 부른다. `resume`이 참이면 저장된 진행 판에서 이어서.
- `result`는 `{ record }`가 없으면 시작 화면으로 간다 → 결과 화면에서 새로고침하면 시작 화면이다(진행 판은 이미 지워져 있어 두 번 더해지지 않는다).
- 배경 음악: 시작·연습 `practice`, 대결 `duel`, 결과 `result`. 설정·소리 지도·출처는 곡을 바꾸지 않는다.

## 배치(가로 / 세로)

한 기준으로 가른다: 세로 배치 = `(max-width: 760px), (orientation: portrait)`. 높이가 너무 낮은 가로 = `(orientation: landscape) and (max-height: 500px)` → '세로로 돌려 주세요' 덮개.
- 연습 가로: 윗줄(처음으로·단계·남은 배·남은 턴) / 가운데 [적 바다 | 단면도] / 아래 가운데 조작부.
- 연습 세로: 단면도와 적 바다 위아래 반반 → 한 줄 문구 → 하단 고정 조작부(요약 줄·기록 단추, ①, ②, ③ + 발사). 스크롤 없이 한 발.
- 대결: 가로에서만. 좌 청팀·우 홍팀 절반, 자리마다 [쏘는 바다 | 단면도] + 조작부 + 한 줄 문구. 세로에서는 안내 한 줄과 '처음으로'만.
- 방향이 바뀌면 판·조작부만 다시 그리고 판 상태는 그대로 둔다.

## 바깥에 기대는 것

- 런타임: 없음(인터넷 연결 없이 동작). 글꼴은 `assets/fonts/*.woff2`, 그림은 `assets/img/*.webp`, 음원은 `assets/audio/*.mp3`.
- 소리: 웹 오디오로 풀어 이음새 없이 반복(기본). file://이거나 fetch가 안 되면 `<audio loop>`로 대신 낸다. 파일이 없어도 조용히 넘어간다.
- 개발 때만: Node(점검), Aside 앱·CLI(브라우저 점검), ffmpeg(음원 점검), Python + fontTools·brotli(부분 글꼴), Python + numpy·Pillow·scipy와 Codex CLI(그림 생성·후처리), GitHub(`pblsketch` 계정, Pages).

## 점검 구성

`tests/run-all.mjs`가 `tests/check-*.mjs`를 이름 순서로 모두 돌린다. 브라우저 점검은 같은 프로세스에서 작은 정적 서버(`tests/server.mjs`, 8791부터 빈 포트)를 띄우고 그 주소를 `BASE`로 넘긴다(`BASE`를 주면 그 주소를 점검).
- 브라우저 없이: `check-rules`(규칙), `check-save`(저장, 흉내 낸 저장소), `check-text`(문구), `check-audio`(음원 파일, ffmpeg).
- aside로: 부품 점검(`check-mouth`·`board`·`controls`·`audio-engine`)은 `tests/pages/*.html` 점검 전용 페이지, 화면 점검(`check-practice`·`duel`·`app`)은 G.app을 흉내 낸 점검 페이지, 전체 흐름(`check-play`·`shots`·`screen-text`·`howto`·`00-smoke`)은 진짜 `index.html`을 `tests/pages/frame.html`의 정해진 크기 iframe에 띄워 `tests/lib/drive.mjs`로 학생처럼 누른다.
