# 실행·점검·배포 절차

## 준비물

| 무엇 | 언제 필요 | 확인 |
|---|---|---|
| 최신 브라우저 | 게임 실행 | — |
| Node.js 18 이상(개발 기기는 24) | 로컬 서버, 모든 점검 | `node --version` |
| Aside 앱 + `aside` CLI | 브라우저 점검(`check-*` 대부분) | Aside 앱이 켜져 있고 `aside guide`가 뜸. 모르는 명령이면 `aside --update` |
| ffmpeg | `check-audio`(음원 이음새·음량) | `ffmpeg -version`, 없으면 `FFMPEG=경로` |
| Python 3 + `pip install fonttools brotli` | 부분 글꼴 다시 만들기 | `python -c "import fontTools, brotli"` |
| Python 3 + numpy·Pillow·scipy | 그림 후처리 | `python tools/process_assets.py --check` |
| Codex CLI 0.159.2 이상(로그인됨) | 그림 생성, 디자인 검수 | `codex --version` |
| GitHub CLI `gh`(pblsketch 로그인) | 배포 | `gh auth status` |

게임 자체는 설치할 것이 없다(`npm install` 없음, `tests/`에도 외부 패키지 없음).

## 게임 열기

```bash
node tests/server.mjs 8766
```
그 뒤 http://127.0.0.1:8766 을 연다. `python -m http.server 8766`도 된다. `index.html` 더블클릭(file://)으로도 돌지만 브라우저에 따라 글꼴·음원이 막혀 기기 글꼴로 보이거나 소리가 안 날 수 있다(음원은 `<audio>`로 대신 냄).

## 점검

```bash
cd tests
npm test
```
- 전체는 약 30분(대부분 aside 브라우저 점검). 마지막 줄이 `모두 통과`이고 종료 코드 0이어야 한다. 실행 중 Aside 브라우저에 탭이 열렸다 닫히는 것은 정상이다.
- Aside 앱이 꺼져 있거나 응답하지 않으면 브라우저 점검이 모두 실패한다 → 앱을 켜고 다시. 그래도 응답이 없으면 억지로 넘기지 말고 멈춘다.
- 서버는 `run-all.mjs`가 스스로 띄운다(8791부터 빈 포트).

| 명령·환경 값 | 뜻 |
|---|---|
| `npm test -- check-rules check-save check-text` | 이름에 그 낱말이 든 점검만(이 세 개는 브라우저 없이 몇 초). 낱말은 이름의 일부와 맞춰 보므로 `text`만 주면 `check-screen-text`(브라우저 점검)도 돈다 |
| `BASE=https://주소/ npm test` | 로컬 서버 대신 그 주소를 점검(배포 확인). 브라우저 점검만 주소를 쓴다 |
| `STEP=낱말 node check-duel.mjs` | 한 점검 파일 안에서 이름에 그 낱말이 든 조각만(서버를 따로 켜 두어야 함: `node server.mjs 8791`) |
| `ASIDE_DRY=1 node check-<이름>.mjs` | aside를 부르지 않고 대본 문법만 확인 |
| `ASIDE_STRICT_SHOTS=1` | 캡처가 끝내 안 찍히면 경고 대신 실패 |
| `ASIDE=경로` | aside 실행 파일 위치 |
| `PORT=8791` | 점검 서버 시작 포트 |
| `FFMPEG=경로`, `AUDIO_DIR=폴더` | 음원 점검의 ffmpeg 위치, 점검할 음원 폴더 |

- 캡처는 `tests/shots/`에 모인다(저장소에 올리지 않음). 칠판 1920×1080 · 태블릿 1280×800 · 노트북 1366×768 · 휴대폰 390×844 · 360×740 · 눕힌 휴대폰 844×390.
- 학생 관점 검토(합격·불합격 아님): 전체 점검이 통과한 뒤 `aside exec`로 규칙 설명 없이 학생처럼 풀게 하고, 보고서를 `tests/review/학생검토.md`에 남긴다.

## 내용·조정값 고치기

| 고칠 것 | 파일 | 뒤따를 일 |
|---|---|---|
| 화면 문구·용어·따라 해 보기·알아 두기·질문 | `js/data/text.js` | 새 음절이면 글꼴 다시 만들기 → `npm test -- text screen-text` |
| 제한 턴·함대 구성·보이는 것 | `js/data/levels.js` | `npm test -- rules practice duel play` |
| 입자 수(`PARTICLES`)·재생 시간(`DURATION` ≤ 1500) | `js/data/mouth.js` | `npm test -- mouth` |
| 배경 음악·효과음 음량 기본값 | `js/core/save.js`의 `DEF_SETTINGS` | `npm test -- save app` |
| 숨기기 시간(30초) | `js/game/duel.js`의 `config.placeSeconds` | `npm test -- duel` |
| 풀이 예시 속도 | `js/game/practice.js`의 `config.exampleLead`·`examplePause` | `npm test -- practice` |

## 부분 글꼴 다시 만들기

```bash
python tools/build_fonts.py
```
저장소 맨 위 폴더에서 돌린다. 원본(`tools/fonts_src/`, 저장소에 없음)이 없으면 공식 저장소에서 받는다. 결과 `assets/fonts/title-800.woff2`, `ui-500/600/700.woff2`, `OFL-*.txt`, `css/fonts.css`를 커밋한다. 결과는 늘 같다(같은 문구 → 같은 파일).

## 그림 다시 만들기

1. 프롬프트(영어)를 `tools/prompts/`(v2는 `tools/prompts/v2/`, 위에서 본 배는 `tools/prompts/top/`)에 둔다.
2. 생성(Bash에서, 표준 입력을 닫는다):
   ```bash
   powershell -File tools/gen.ps1 -Name title -PromptFile tools/prompts/v2/title.txt -Out assets/raw/v2/title.png </dev/null
   ```
3. 후처리: `python tools/process_assets.py`(시작·휴대폰 시작·결과 그림. `--all`을 붙이면 지금은 쓰지 않아 지운 옆모습 배·물보라·바다 질감도), `python tools/process_top.py`(판 위 배 조각). 확인: `python tools/process_assets.py --check`.
4. 결과 `assets/img/*.webp`만 커밋한다(원본 `assets/raw/`는 올리지 않음). 프롬프트와 쓴 화풍을 `assets/prompts.md`에 적는다.
- 그림체는 선생님이 견본을 보고 고른 'A v2'다. 화풍을 바꾸려면 견본 2~3장을 먼저 보여 드리고 고르신 것으로만 만든다.

## 음원 바꾸기

후보(곡명·출처 주소·라이선스·용량·들어 볼 주소)를 선생님께 보여 드리고 고른 것만 받는다. 고주파 거르기 → 음량 맞추기(배경 음악 약 -18 LUFS, 효과음 약 -16 LUFS) → mp3로 `assets/audio/`의 같은 이름(`bgm-practice|duel|result.mp3`, `sfx-fire|hit|miss|dud|sunk.mp3`)에 둔다. `assets/audio/CREDITS.md`, 게임 안 '만든 사람·출처'(`js/game/app.js`), README 출처를 함께 고친다. 확인: `npm test -- audio`.

## 배포(GitHub Pages)

배포됨: 저장소 https://github.com/pblsketch/sori-haejeon (공개), 주소 https://pblsketch.github.io/sori-haejeon/ (기본 가지 `master`, 맨 위 폴더를 그대로 내보냄, `.nojekyll`로 Jekyll 처리 끔 — 끄지 않으면 Pages 빌드가 실패한다). 원격에 올리기 전에는 선생님께 확인받는다.

처음 배포할 때 쓴 명령(다시 만들 일이 있을 때):

```bash
gh repo create pblsketch/sori-haejeon --public --source . --remote origin --push
```
```bash
gh api -X POST repos/pblsketch/sori-haejeon/pages -f "source[branch]=master" -f "source[path]=/"
```
- 기본 가지는 `master`다. Pages는 저장소 맨 위(`/`)를 그대로 내보낸다(빌드 없음). 주소는 `https://pblsketch.github.io/sori-haejeon/`.
- Pages가 뜨기까지 1~2분 걸린다(`gh api repos/pblsketch/sori-haejeon/pages/builds/latest --jq .status`가 `built`). 뜬 뒤 `cd tests && BASE=https://pblsketch.github.io/sori-haejeon/ npm test`로 확인한다(점검 전용 페이지 `tests/pages/`도 함께 올라가 있어 모든 점검이 배포 주소에서 돈다).
- 이후 고칠 때: 점검 통과 → 커밋 → `git push`(선생님 확인 뒤) → Pages가 몇 분 안에 새로 뜸 → 배포 주소로 `npm test -- smoke play`.
