# js/core — 규칙 엔진 · 저장 · 소리 재생 · 공용 도구

## 맡는 것
- `util.js`(`G.util`): 가장 먼저 읽힌다. 전역 `G`를 열고, 페이지 오류(`error`·`unhandledrejection`·`console.error`)를 `window.__soriErrors`에 모은다. DOM 도우미 `el`·`svg`, 신호 기호 `glyph(name)`(hit·h·v·hv·cell·eq·miss·dud·lock·check — 글꼴에 기대지 않는 SVG), `lineDir(targets)`, `reducedMotion()`.
- `rules.js`(`G.rules`): 채점·신호·세기 카드 흐림/발사 켜짐·함대 배치(무작위·직접)·턴·연습 끝·대결 승패·판 기록·알아 두기. **순수 함수만.**
- `save.js`(`G.save`): localStorage 읽기/쓰기(설정·마지막 선택·누적 음운 지도·풀이 예시 본 적·진행 판), 판 id, 한 판 한 번만 더하기.
- `audio.js`(`G.audio`): 녹음 mp3 재생(배경 음악 반복·겹쳐 바꾸기, 효과음), 켜기/끄기·음량, 첫 터치 뒤 소리 켜기.

## 맡지 않는 것(건드리지 말 것)
- 화면 그리기·DOM 배치·문구: `js/game/*`, 문구는 `js/data/text.js`. `rules.js`는 한국어 화면 문장을 만들지 않는다(오류 메시지는 개발자용).
- 소리표·배 묶음·단계 값: `js/data/*`에 있다. 여기서 값을 박아 넣지 않는다(`rules.js`는 `SOUNDS`·`FLEETS`·`LEVELS`를 읽기만 한다).
- 설정 화면: `save.js`는 값만 저장하고 `G.audio.configure`·`reduce-motion` 클래스 적용까지만 한다.

## 불변 조건
- `rules.js`는 `document`·`window.localStorage`·타이머를 쓰지 않는다(Node `vm`에서 그대로 불러 점검).
- `rules.js`의 모든 함수는 인자를 바꾸지 않는다. `fire`·`fireTeam`은 턴을 쓰지 않는 결과(`notInSea`·`already`)면 받은 `state`를 **같은 객체로** 돌려주고, 턴을 쓰면 복사본에 발을 더해 돌려준다.
- 한 발의 판정 순서: 쏠 수 없는 조합 → 오류 / 열린 칸 밖 국어 소리 → `notInSea` / 같은 조합 열쇠 이미 있음 → `already` / 국어에 없는 조합 → `none`(빈칸이면 `emptyCell: true`) / 그 밖 → `signal()`.
- `signal()`은 **아직 맞히지 않은 배 칸**만 본다. 자음: 같은 칸(세기만 다름) 우선 → 아니면 같은 위치·같은 방법 둘 다 가능. 모음: 입술만 다른 짝 우선 → 아니면 같은 높이·같은 열(앞뒤+입술) 둘 다 가능. 강조 없는 단계는 `targets: []`.
- 함대는 큰 배부터(`LEVELS[..].fleet` 순서), 열린 칸 안의 허용 묶음만, 소리 겹침 없음. `fillFleet`는 되돌아가며 채워 막다른 상태가 없다.
- 대결: 팀마다 `shots.length ≤ turns`. 발을 다 쓴 팀의 `fireTeam`은 오류. 한 발 뒤 `duelOutcome`: 쏜 팀이 다 찾음 → 즉시 승 / 두 팀 발 소진 → 맞힌 칸 비교, 같으면 무승부.
- `save.js`와 `audio.js`의 공개 함수는 예외를 던지지 않고 `console.error`를 쓰지 않는다(점검이 페이지 오류로 센다). 저장소가 막혀도 이번 세션 동안은 메모리에 값을 들고 돈다.
- `saveGame`: `placing` 판은 배치를 버리고 청팀부터 다시 하는 판으로, `over` 판은 저장하지 않고 그 자리에서 `addRecord(makeRecord(판), 판 id)`로 누적 지도에 더한 뒤 진행 판을 지운다(결과 화면 전 멈춤 동안 새로고침해도 끝난 판을 잃지 않게). 뒤이은 `G.app.finishGame`의 더하기는 같은 판이라 무시된다.
- `addRecord(record, id)`는 같은 판 id(없으면 내용 해시)를 두 번 더하지 않는다. 대결은 `record.hitSoundsAll`(두 팀 합침)을 더한다.

## 구현 방식
- 판 상태·판 기록·발의 모양은 `rules.js` 머리 주석이 기준이다. 모양을 바꾸면 그 주석, `save.js`의 `loadGame` 검사, `GAME_V`를 함께 본다.
- 조합 열쇠: 자음 `'c:' + place + '/' + manner + '/' + strength`(세기 없는 음운은 `none`, 1단계는 `plain`으로 정규화), 모음 `'v:' + height + '/' + column`. '이미 쏜 음운'는 이 열쇠로 가린다.
- 난수는 `makeRng(시드)`(점검·풀이 예시에서 결정적으로). 게임은 `Math.random`.
- 저장 이름은 모두 `sori-haejeon:` 접두사 + `{ s: SCHEMA, … }`. 망가진 값은 기본값으로, 맞지 않는 진행 판은 지운다.
- `audio.js`: 웹 오디오 버퍼 반복이 기본, file://·fetch 실패면 `<audio loop>`. 새 곡이 1.5초 안에 준비되지 않으면 옛 곡을 먼저 줄인다. 효과음은 0.4초 넘게 늦으면 건너뛰고, 동시에 8개까지. 풀어 둔 배경 음악은 2곡까지만 들고 있는다(저사양 칠판 메모리).

## 점검
- `node tests/check-rules.mjs`(브라우저 없이 수 초): 소리표·배 묶음·단계가 규칙과 같음, 모든 자음·모음 조합의 채점, 신호 규칙마다 사례, 무작위 배치 반복·모든 선택 경로의 막다른 상태 없음, 턴을 쓰는/안 쓰는 결과, 대결 실시간 승패·발 소진·무승부, 알아 두기. 규칙을 고치면 여기에 사례를 더한다.
- `node tests/check-save.mjs`(흉내 낸 저장소): 저장→복원 동일, 망가진 값·다른 버전, 막힌 저장소, 기록 지우기 범위, 한 판 한 번.
- `npm test -- audio-engine`(aside): 파일이 없어도 조용함, 켜기/끄기·음량 반영, fetch 실패 시 요소로 대신.
