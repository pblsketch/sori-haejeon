# 알아 둘 함정과 작업 순서

## aside 브라우저 점검

- **aside는 점검이 실패해도 0으로 끝난다.** 증상: 대본 안에서 예외가 나도 `aside repl` 종료 코드는 0. 대응: `tests/aside.mjs`의 `step()`이 출력에서 `[error |` 또는 줄머리 `FAIL`이 있거나 끝의 `PASS` 줄이 없으면 실패로 친다. 새 대본은 반드시 마지막에 `console.log('PASS')`를 찍고, 실패는 `throw` 또는 `console.log('FAIL …')`. 확인: 일부러 틀린 조건을 넣어 `FAIL`로 뜨는지 본다.
- **한 번의 `aside repl`은 약 120초, 그 안의 `tab.evaluate` 한 번은 약 30초 안에 끝나야 한다.** 넘으면 도중에 끊긴다. 대응: 긴 판은 `step`을 나누고(호출마다 새 탭), evaluate 안에서는 `D.prRun(예산 ms)`처럼 조각으로 나눠 여러 번 부른다.
- **`page.goto()`를 about:blank에서 부르면 멈춘다.** 탭은 늘 `openTab(url)`로 열고 `finally`에서 `closeTab(탭)`. 안 닫으면 선생님의 Aside 브라우저에 탭이 쌓인다.
- **`page.on('console')` 이벤트가 오지 않는다.** 콘솔 오류를 못 잡는 것처럼 보인다. 원인: aside가 콘솔 이벤트를 넘기지 않음. 대응: `js/core/util.js`가 `error`·`unhandledrejection`·`console.error`를 `window.__soriErrors`에 모은다 — 대본은 이 배열이 비었는지 본다. 그래서 게임 코드의 `console.error`는 곧 점검 실패다.
- **화면 크기를 바꿀 수 없다**(`setViewportSize` 없음, 창은 대략 1440×900). 대응: `tests/pages/frame.html?w=390&h=844&src=index.html`이 게임을 그 크기의 iframe에 띄운다. 대본에서 게임 창은 `frameWin()`, 운전 도구 `D`는 바깥 창에 있어 게임을 새로고침해도 남는다(`D.w()`로 늘 새로 얻을 것 — 옛 창 참조는 새로고침 뒤 죽는다).
- **`screenshot()`이 가만히 있는 탭에서 가끔 시간 초과**('CDP command timed out while capturing viewport screenshot'). 대응: `tests/aside.mjs` 머리말이 화면을 살짝 건드리고 네 번까지 다시 찍는다. 그래도 안 되면 `WARN 캡처 실패`만 찍고 계속한다(부품 점검의 캡처는 증거 자료일 뿐). 캡처 자체를 확인하려면 `ASIDE_STRICT_SHOTS=1`.
- **aside의 `fs`는 따로 떨어진 폴더에 쓴다.** 대응: `fs.writeFile('./artifacts/이름.png', …)` 뒤 `console.log('SHOTFILE:' + path.resolve(…))`를 찍으면 도우미가 `tests/shots/`로 옮긴다.
- **같은 주소의 탭끼리 localStorage가 이어진다.** 앞 점검의 진행 판·예시 본 기록이 다음 점검에 샌다. 대응: 점검 페이지 주소에 `?clear=1`(저장 값 지우고 시작), `?seen=1`(풀이 예시 본 것으로). 진짜 `index.html` 점검은 `D.fresh()`.
- **한 대본 안에서 `const`/`let` 이름이 겹치면 문법 오류**(여러 조각이 한 함수로 합쳐짐). 탭 변수를 `ta`, `tb`, `tc`처럼 다르게 짓는다. 문법만 빨리 보려면 `ASIDE_DRY=1 node check-<이름>.mjs`.
- **Windows에서 `spawnSync('aside')`가 ENOENT.** PATH의 `aside`가 셸 별칭일 뿐이라 Node가 못 찾는다. 도우미는 `%LOCALAPPDATA%\Aside\CLI\current\aside.exe`를 먼저 찾는다(`ASIDE` 환경 변수로 바꿀 수 있음). aside CLI가 `aside guide`를 모르면 `aside --update`.
- **점검 파일을 혼자 돌릴 때 서버가 없으면 모든 탭이 빈 화면.** `run-all.mjs`만 서버를 띄운다. 혼자 돌릴 때는 `npm test -- <이름>`으로 돌리거나, 다른 창에서 `node tests/server.mjs 8791`을 먼저 켠다. `aside.mjs`는 동기 실행이라 같은 프로세스에서 서버를 띄우면 응답하지 못한다.
- 포트 8791이 이미 쓰이면 `run-all.mjs`가 다음 포트(최대 20개)로 넘어간다.
- 대결의 동시 터치 점검은 서로 다른 `pointerId`의 pointerdown/pointerup을 두 팀 발사 단추에 엇갈려 보낸다(`D`의 대결 도우미). 진짜 칠판의 동시 터치 지원은 자동 점검으로 확인할 수 없다.

## Node에서 게임 스크립트 읽기

- `tests/lib/load.mjs`의 `loadScripts([...])`가 일반 스크립트를 `vm` 한 컨텍스트에서 차례로 돌린다(`window === ctx`, `document` 없음). 증상: 데이터가 `undefined`. 원인: 최상위 `const X = …`는 컨텍스트의 속성이 되지 않는다. 대응: `window.X = …`로 내보낸다.
- 규칙·데이터 파일에서 `document`·`localStorage`를 건드리면 여기서 곧바로 깨진다. `G.save`는 흉내 낸 저장소 객체로 점검한다(`check-save`).

## 저장·이어서 하기의 동작

- 숨기기 시간 배치 중(`phase: 'placing'`)에 저장하면 배치를 **버리고** 두 팀 함대를 비운 채 청팀부터 다시 하는 판으로 저장한다. 그래서 배치 도중 새로고침 → 배치 처음부터. 이 동작을 '버그'로 고치지 말 것(선생님 결정).
- 끝난 판(`phase: 'over'`)을 `saveGame`에 주면 저장하지 않고 진행 판을 **지운다.** 그래서 화면이 판 끝에서 `saveGame`을 부른 뒤 `finishGame`을 부르지 않고 화면을 떠나면 그 판은 누적 지도에 영영 안 들어간다 — 연습·대결 모두 끝난 뒤의 '처음으로'는 `finishGame`으로 보낸다. 판 끝 흐름을 고칠 때 이 순서를 지킨다.
- 한 판을 한 번만 더하는 열쇠는 `state.id`(`G.save.newGameId()`로 새 판을 만들 때 붙임)다. `G.rules`의 상태 함수가 상태를 통째로 복사하므로 덧붙인 필드가 따라간다. id가 없으면 기록 내용의 해시로 가린다.
- 옛 방식(라운드 대결)으로 저장된 판의 `rounds` 필드는 저장·복원할 때 버린다. 판 모양을 바꾸면 교실 기기에 남은 옛 진행 판을 어떻게 다룰지 먼저 정한다(버전을 올리면 옛 진행 판은 버려진다).

## 세로 배치 기준이 흩어져 있다

같은 값 `(max-width: 760px), (orientation: portrait)`이 `js/game/app.js`(`PORTRAIT_Q`), `js/game/controls.js`(`PORTRAIT_MQ`), `js/game/practice.js`(`PORTRAIT_MQ`), `js/game/duel.js`(`PHONE_MQ`, 낮은 가로까지 포함), `css/base.css`, `css/app.css`, `css/mouth.css`에 있다. '세로로 돌려 주세요' 기준 `(orientation: landscape) and (max-height: 500px)`은 `js/game/app.js`(`LOW_Q`), `css/app.css`, `css/practice.css`, `js/game/duel.js`에 있다. 하나만 바꾸면 JS는 세로 배치를 그리는데 CSS는 가로 모양을 입히는 식으로 어긋난다. 바꾼 뒤 `npm test -- app practice controls duel shots`.

## 판(바다) 그리기

- 숨긴 단계의 칸은 소리·빈칸 여부·세기 자리 수가 **DOM 속성·aria-label·title에도** 없어야 한다(`check-board`가 DOM 전체 문자열을 뒤진다). 칸마다 다른 클래스나 `data-` 값을 붙이면 그것도 답이 샌다.
- 가라앉기 전 명중 조각은 모든 배가 같은 그림(`top_hit`)이다. 크기별 그림을 명중 때 쓰면 배 크기가 샌다.
- 휴대폰 1단계 판은 칸 높이가 약 36px라 과녁 배지(최소 20px)가 소리 표지를 반쯤 가린다. 칸이 `overflow: hidden`이라 배지를 칸 밖으로 뺄 수 없다(`css/board.css`의 `.sb-narrow .sb-badge`).
- 그림(`assets/img/top_*.webp`)이 없으면 코드로 그린 모양으로 대신 그린다. 그림 폴더는 `G.board.setImageBase`로 바꿀 수 있다(점검 페이지가 씀).

## 소리 재생

- file://로 열면 `fetch`가 막혀 웹 오디오 대신 `<audio loop>`로 낸다(이음새가 조금 튈 수 있음). 수업에서는 웹 주소나 로컬 서버를 쓴다.
- 첫 pointerdown/keydown/touchend 전의 `G.audio.play()`는 기억만 해 둔다(브라우저 자동 재생 정책). 점검에서 소리 상태를 볼 때는 먼저 화면을 한 번 누른다.
- 효과음 파일을 불러오는 데 0.4초가 넘으면 그 번은 건너뛴다(늦게 울리면 신호와 헷갈림).

## 글꼴

- 화면 문구를 고쳐 **새 음절이 생기면** 그 글자는 기기 기본 글꼴로 보인다(부분 글꼴에 없음). 대응: `python tools/build_fonts.py`를 다시 돌리고 `assets/fonts/*.woff2`를 함께 커밋. 스크립트는 `index.html`의 글, `js/` 아래 모든 .js의 문자열(주석 제외), `css/`의 `content` 문자열에서 글자를 모은다 — 코드 주석에만 있는 글자는 들어가지 않는다.
- 원본 글꼴이 `tools/fonts_src/`에 없으면 스크립트가 공식 저장소에서 내려받는다(이미 승인된 Hahmlet·Pretendard).

## 그림 생성(Codex CLI)

- `tools/gen.ps1`을 Bash에서 부를 때 **표준 입력을 닫아야 한다**(`… </dev/null`). 닫지 않으면 codex가 입력을 기다리며 멈춘다.
- 프롬프트는 영어(ASCII)만. 명령문에 그대로 넣어 넘기므로 한글이 섞이면 깨진다. codex에게 프롬프트 파일을 읽게 하면 샌드박스가 막아 생성이 안 된다.
- 전역 `~/.codex` 설정(플러그인·MCP)을 쓰면 시작이 몇 분씩 멈추므로 `gen.ps1`은 최소 설정만 둔 임시 `CODEX_HOME`을 쓴다.
- 투명 배경은 생성이 못 하므로 자홍(#FF00FF) 단색 배경으로 만든 뒤 `tools/process_assets.py`의 크로마키로 지운다. 불탄 배는 연기의 보랏빛도 함께 빠지므로 결과를 눈으로 확인한다(`--check`).

## 디자인 검수(Codex CLI)

- 선생님이 지정한 검수 모델은 `gpt-6.1-sol`이다. codex-cli 0.159.2 미만은 이 모델을 모른다고 거절하므로 먼저 codex를 올린다. 검수는 캡처 이미지와 함께 `codex exec -m gpt-6.1-sol`로 받고, 결과는 `design/review-*.md`에 남긴다.

## 코드 주석의 옛 표시

- 코드 주석의 `spec 5.4`, `T11b` 같은 표시는 저장소에 없는 옛 설계 문서의 절·작업 번호다. 그 문서는 저장소에 없으니 찾지 말 것 — 지금 동작의 기준은 코드와 `tests/`의 점검이다. 주석을 고칠 일이 생기면 번호 대신 규칙 이름을 쓴다.
- `css/base.css` 머리 주석이 가리키는 디자인 검수 문서도 저장소에 없다. 색 토큰 값과 역할은 `css/base.css` 자체가 기준이다.

## 반복 작업 순서

- **문구 고치기**: `js/data/text.js` 따옴표 안 수정 → 새 음절이면 `python tools/build_fonts.py` → `cd tests && npm test -- text screen-text` → 커밋(글꼴 파일 포함).
- **제한 턴·입자 수 같은 조정값**: `js/data/levels.js`의 `turns` / `js/data/mouth.js`의 `PARTICLES`(거센소리는 두 배) → `npm test -- rules mouth practice duel play`.
- **규칙 고치기**: `js/core/rules.js` + 머리 주석 → `node tests/check-rules.mjs`(브라우저 없이 수 초) → 화면이 쓰는 모양이 바뀌었으면 `npm test -- practice duel play`.
- **배포 주소 점검**: `BASE=https://…/ npm test -- smoke play shots screen-text`.
