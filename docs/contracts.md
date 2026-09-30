# 바깥과의 약속

이 게임에는 서버 API가 없다. 바깥에서 기대는 면은 셋이다: ① 학생이 여는 주소, ② 교실 기기에 이미 남아 있는 저장 값(새 버전이 올라가도 읽어야 함), ③ 선생님이 직접 고치는 데이터 파일(그리고 시리즈 다음 편이 가져다 쓸 음운 데이터).

## ① 주소

- 진입점은 `index.html` 하나다. 주소 뒤 값(`?…`)을 읽지 않는다 — 주소로 학년·단계를 미리 정하는 기능은 없다. `tests/pages/*`의 `?clear=1` 등은 점검 전용 페이지의 값이고 게임 주소에서는 아무 일도 하지 않는다.
- 두 가지로 열린다: 정적 서버(GitHub Pages·로컬 서버)와 file://(더블클릭). 둘 다에서 콘솔 오류 없이 시작 화면이 떠야 한다. 파일 경로는 모두 상대 경로(`assets/…`, `css/…`, `js/…`)다 — 절대 경로(`/assets/…`)를 쓰면 Pages 하위 경로(`/sori-haejeon/`)와 file://에서 깨진다.

## ② 기기에 남는 저장 값(localStorage)

모든 이름은 `sori-haejeon:` 접두사. 값은 `{ s: 저장형식버전, … }` JSON. 새 버전의 게임이 옛 값을 만나도 **예외 없이** 돌아야 한다.

| 이름 | 모양 | 옛 값·망가진 값을 만나면 |
|---|---|---|
| `settings` | `{ s, bgmOn, bgmVolume(0~1), sfxOn, sfxVolume(0~1), reduceMotion }` | 기본값 `{ bgmOn: true, bgmVolume: 0.6, sfxOn: true, sfxVolume: 0.8, reduceMotion: false }` |
| `selection` | `{ s, grade: 'm3'|'h1', sea: 'consonant'|'vowel', level, hideTime }` | 기본값 `{ m3, consonant, 1, false }`. 없는 단계면 1단계 |
| `soundmap` | `{ s, consonant: { ids: [소리 id], games }, vowel: { … }, added: [이미 더한 판 표시, 최대 200] }` | 빈 지도 |
| `seenExample` | `{ s, seen: true }` | 본 적 없음(자음 1단계 첫 시작에 풀이 예시가 다시 나옴) |
| `game` | `{ s, savedAt, state: 판 상태 }` | 지우고 "이어서 하기" 없이 시작 |

- 저장 형식 버전 `SCHEMA`(지금 1)가 다르거나 JSON이 망가지면 그 값은 기본값으로 시작한다. 판 상태 버전 `state.v`(지금 1)가 다르거나, 모드·바다·단계·단계(phase)·팀 모양이 맞지 않거나, 대결 한 팀의 쏜 수가 단계의 제한 턴을 넘으면 진행 판을 버린다.
- **판 상태(`state`)의 모양**: `{ v: 1, id, mode: 'practice'|'duel', grade, sea, level, hideTime, phase: 'placing'|'playing'|'over', placingTeam: 'blue'|'red'|null, teams: { <팀>: { fleet: [{ size, sounds: [id…] }], shots: [발] } }, result: null | { success } | { winner: 'blue'|'red'|null, reason: 'found-all'|'more-hits'|'hits-tie' } }`. 팀 이름: 연습 `player`(쏘는 쪽, fleet 빈 배열)·`enemy`, 대결 `blue`·`red`.
- **발(shot)의 모양**: `{ key, sound: id|null, input, cell, kind: 'hit'|'line'|'miss'|'none', targets, emptyCell, sunk: 크기|null, sunkShip: 번호|null }`. 턴을 쓴 발만 들어간다(`notInSea`·`already`는 기록되지 않음).
- 판 모양을 바꿀 때: 새 필드를 더하는 것은 옛 판과 섞여도 되게(없으면 기본값) 한다. 뜻이 바뀌는 변경은 `GAME_V`를 올려 옛 진행 판을 버리게 한다 — 수업 도중 올리면 학생들의 진행 판이 사라지므로 선생님께 알린다. `soundmap`의 모양을 바꾸면 누적 기록이 사라질 수 있으니 옮겨 담는 코드를 둔다.

## ③ 데이터 파일(선생님이 고치는 곳, 다음 편이 가져다 쓰는 곳)

모두 일반 스크립트이며 전역 값 하나를 연다. 문법이 깨지면 게임 전체가 뜨지 않으므로 고친 뒤 `cd tests && npm test -- rules text`.

| 파일 · 전역 | 약속 |
|---|---|
| `js/data/sounds.js` · `SOUNDS` | `consonants: [{ id, sea: 'consonant', place, manner, strength }]`(19개), `vowels: [{ id, sea: 'vowel', height, backness, lips, column }]`(10개), 자질 키 목록 `places`·`manners`·`strengths`·`heights`·`columns`·`backs`·`lips`, 알아 두기 조건 `notes: [{ id, sea, all|any: [id…] }]`. 소리 id는 자모 한 개(`'ㄱ'`, 빗금 없음). 소리를 **자질로만** 적는다(다음 편 음운 변동 게임이 비음화 등을 자질로 다룰 수 있게) — 화면 이름은 여기 두지 않는다. |
| `js/data/fleets.js` · `FLEETS` | `{ consonant|vowel: { 3|2|1: [[id…], …] } }`. 묶음 안 소리 순서가 저장·표시 순서(세기 예사→된→거센, 모음 높이 순). |
| `js/data/levels.js` · `LEVELS` | `{ consonant: { 1, 2, 3 }, vowel: { 1, 2 } }`, 단계마다 `{ sea, level, open: [id…], strengthCards, show: { cellSounds, emptyCells, strengthSlots, lineNames, placeNames }, highlight, help: { followAlong, example }, fleet: [크기…](큰 배부터), turns }`. |
| `js/data/text.js` · `TEXT` + `G.text` | 학년 키 `m3`·`h1`은 **같은 키 구조**를 가져야 한다. 자질 이름표 키는 `SOUNDS`와 같다. `{이름}` 자리는 게임이 채운다(`G.text.fill`). 소리 29개 모두에 `follow[id]`('따라 해 보기')가 있어야 한다. 모든 문구는 빗금 표기, 금지 낱말 없음, 한 줄. |
| `js/data/mouth.js` · `MOUTH` | 단면도 좌표계 `viewBox 0 0 440 390`(얼굴이 왼쪽을 봄), 흐름 규칙 `closure`(full·full-to-gap·gap·dotted·none), `nasal`(open·closed), `flow`(burst·leak·hiss·nose·split·free), 시간표 `timing`(초), 조정값 `PARTICLES`·`DURATION`(≤ 1500ms)·`TONGUE_MS`·`NEAR`. |

- 잘못된 데이터를 만났을 때: `G.rules`는 없는 단계·모르는 조합·규칙에 어긋난 함대에 **오류를 던진다**(조용히 넘어가지 않음 — 채점의 진실이 틀린 채 돌면 안 되므로). `check-rules`가 소리표·배 묶음·단계 설정이 규칙과 맞는지 모두 확인한다.
