'use strict';
// 저장 G.save — 설정 · 마지막 선택 · 누적 소리 지도 · 풀이 예시를 본 적 있는지 · 진행 중인 판(spec 6.1·6.3·6.4·6.5·9).
//   불러오는 순서: js/core/util.js → js/data/* → js/core/rules.js → (audio.js) → 이 파일. 점검: tests/check-save.mjs.
//   G.audio·G.rules·SOUNDS·LEVELS는 있으면 쓰고, 없어도 동작한다.
//
// ── 저장소가 막혀도 돌아간다 ────────────────────────────────────────────
//   localStorage에 닿는 모든 곳을 try/catch로 감싼다. localStorage가 없거나(null) 닿기만 해도 예외가 나거나
//   쓰기가 실패해도(용량 초과 등) 값은 이번 세션 동안 메모리(mem)에 남아 게임은 그대로 돈다(저장만 안 됨).
//   오류를 console.error로 찍지 않는다(이 프로젝트에서는 console.error가 페이지 오류로 셈해진다).
//
// ── 저장 이름(모두 'sori-haejeon:' 접두사) · 저장 형식 버전 SCHEMA ──────────
//   값마다 { s: SCHEMA, … } 모양의 JSON. s가 다르거나 JSON이 망가졌으면 기본값으로 시작한다.
//   settings     { s, bgmOn, bgmVolume(0~1), sfxOn, sfxVolume(0~1), reduceMotion }
//   selection    { s, grade: 'm3'|'h1', sea: 'consonant'|'vowel', level, hideTime }   마지막 선택(연습·대결이 함께 씀)
//   soundmap     { s, consonant: { ids: [소리 id], games: 더한 판 수 }, vowel: { … }, added: [더한 판 표시] }
//   seenExample  { s, seen: true }                                                    풀이 예시를 본 적 있음
//   seenHowto    { s, seen: true }                                                    '게임 방법'을 연 적 있음
//   game         { s, savedAt, state: GameState }                                     진행 중인 판(기기당 하나)
//   '기록 지우기'(clearRecords)는 soundmap · seenExample · seenHowto · game만 지운다. 설정과 마지막 선택은 남긴다.
//
// ── 진행 판(spec 6.4 · 6.3) ─────────────────────────────────────────────
//   saveGame(state)을 매 발 부른다. 새 판을 저장하면 옛 진행 판은 덮여 사라진다(기기당 하나).
//   - phase 'playing': 그대로 저장.
//   - phase 'placing'(숨기기 시간 배치 중): 배치는 저장하지 않는다. 두 팀 함대를 비우고 청팀 배치부터 다시 하는
//     판(G.rules.restartPlacing과 같은 모양)으로 저장한다 → 새로고침하면 숨기기 단계를 처음(청팀)부터 다시 한다.
//     (옛 진행 판은 이때 버려진다 — 새 판을 시작했으므로.)
//   - phase 'over': 저장하지 않고, 그 판을 곧바로 누적 지도에 더한 뒤(addRecord, 한 판 한 번) 진행 판을 지운다.
//     그래서 결과 화면으로 넘어가기 전 멈춤 동안 새로고침해도 끝난 판이 사라지지 않는다.
//   loadGame()은 판 형식 버전(state.v === 1, rules.js 머리 주석의 GameState)·모드·바다·단계·단계(phase)·팀 모양을
//   확인하고, 맞지 않거나 JSON이 망가졌으면 저장된 값을 지우고 null을 돌려준다.
//   대결(실시간 — 차례 없음)은 두 팀의 쏜 수가 달라도 된다. 팀마다 쏜 수가 단계의 제한 턴(= 팀마다 발 수)을 넘으면
//   이어 할 수 없는 판으로 본다. 라운드 방식 때 저장한 판에 남은 rounds 값은 저장·복원할 때 버린다.
//
// ── 판 id와 '한 판은 한 번만'(spec 6.5) ──────────────────────────────────
//   GameState·GameRecord(rules.js)에는 판 id가 없다. 그래서:
//   - 판을 새로 만들 때 state.id = G.save.newGameId() 로 붙여 둘 수 있다(덧붙인 필드는 rules의 fire·placeShip·
//     finishPlacing이 상태를 통째로 복사하므로 따라가고, 저장·복원에도 남는다).
//   - addRecord(record, id): id(없으면 record.id)가 있으면 그 id로, 없으면 기록 내용의 해시로 이미 더한 판인지 가린다.
//     같은 판을 두 번 더하려 하면 아무것도 하지 않고 false. (해시 방식은 내용이 한 글자도 다르지 않은 두 판을
//     같은 판으로 본다 — 무작위 함대에서 쏜 순서까지 같을 일은 사실상 없다.)
//   - 대결은 record.hitSoundsAll(두 팀 합침)을 더한다. 누적 지도에는 이 기기에서 맞힌 적 있는 소리가 남는다.
//     G.app.finishGame 권장 순서: G.save.addRecord(G.rules.makeRecord(state), state.id) → G.save.clearGame() → 결과 화면.
G.save = (function () {
  const PREFIX = 'sori-haejeon:';
  const SCHEMA = 1; // 저장 형식 버전(바꾸면 옛 저장 값은 모두 기본값으로)
  const GAME_V = 1; // 판 상태 형식 버전(rules.js GameState.v) — 다르면 옛 진행 판은 버린다
  const SEAS = ['consonant', 'vowel'];
  const GRADES = ['m3', 'h1'];
  const ADDED_MAX = 200; // 이미 더한 판 표시를 몇 개까지 기억할지
  const DEF_SETTINGS = { bgmOn: true, bgmVolume: 0.6, sfxOn: true, sfxVolume: 0.8, reduceMotion: false };
  const DEF_SELECTION = { grade: 'm3', sea: 'consonant', level: 1, hideTime: false };

  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  // ── 저장소(막혀도 메모리로) ─────────────────────────────
  const mem = {}; // 이름 → 문자열 | null. 이번 세션에 읽거나 쓴 값(쓰기가 실패해도 여기에는 남는다)
  function store() {
    try {
      const ls = window.localStorage;
      return ls && typeof ls.getItem === 'function' ? ls : null;
    } catch (e) { return null; }
  }
  function rawGet(k) {
    if (own(mem, k)) return mem[k];
    let v = null;
    const ls = store();
    if (ls) { try { v = ls.getItem(PREFIX + k); } catch (e) { v = null; } }
    mem[k] = typeof v === 'string' ? v : null;
    return mem[k];
  }
  function rawSet(k, v) {
    mem[k] = v;
    const ls = store();
    if (!ls) return false;
    try { ls.setItem(PREFIX + k, v); return true; } catch (e) { return false; }
  }
  function rawDel(k) {
    mem[k] = null;
    const ls = store();
    if (ls) { try { ls.removeItem(PREFIX + k); } catch (e) { /* 막혀도 메모리에서는 지워짐 */ } }
  }
  // JSON 읽기: 없거나 망가졌거나 형식 버전이 다르면 null
  function readJSON(k) {
    const raw = rawGet(k);
    if (raw == null) return null;
    try {
      const o = JSON.parse(raw);
      return isObj(o) && o.s === SCHEMA ? o : null;
    } catch (e) { return null; }
  }
  function writeJSON(k, data) {
    let text;
    try { text = JSON.stringify(Object.assign({ s: SCHEMA }, data)); } catch (e) { return false; }
    rawSet(k, text);
    return true;
  }
  // 이 브라우저에 실제로 저장되는가(저장이 막혔으면 false — 게임은 그래도 돈다)
  function storageOk() {
    const ls = store();
    if (!ls) return false;
    try {
      ls.setItem(PREFIX + 'probe', '1');
      ls.removeItem(PREFIX + 'probe');
      return true;
    } catch (e) { return false; }
  }

  // ── 데이터 확인 도우미 ─────────────────────────────────
  function validLevel(sea, n) {
    if (SEAS.indexOf(sea) < 0 || typeof n !== 'number' || !isFinite(n) || Math.floor(n) !== n) return false;
    const L = window.LEVELS;
    if (L) return !!(L[sea] && own(L[sea], n) && L[sea][n]);
    if (G.rules && typeof G.rules.level === 'function') {
      try { G.rules.level(sea, n); return true; } catch (e) { return false; }
    }
    return n >= 1 && n <= 3;
  }
  // 그 바다의 소리 id 목록(SOUNDS가 없으면 null → 문자열이면 모두 받음)
  function seaSounds(sea) {
    const S = window.SOUNDS;
    if (!S) return null;
    const list = sea === 'consonant' ? S.consonants : sea === 'vowel' ? S.vowels : null;
    return Array.isArray(list) ? list.map((s) => s.id) : [];
  }
  function cleanIds(sea, ids) {
    const ok = seaSounds(sea);
    const out = [];
    if (!Array.isArray(ids)) return out;
    for (const id of ids) {
      if (typeof id !== 'string' || out.indexOf(id) >= 0) continue;
      if (ok && ok.indexOf(id) < 0) continue;
      out.push(id);
    }
    return out;
  }

  // ── 설정(spec 6.1) ───────────────────────────────────
  function cleanSettings(base, o) {
    const r = Object.assign({}, base);
    if (!isObj(o)) return r;
    ['bgmOn', 'sfxOn', 'reduceMotion'].forEach((k) => { if (typeof o[k] === 'boolean') r[k] = o[k]; });
    ['bgmVolume', 'sfxVolume'].forEach((k) => { if (typeof o[k] === 'number' && isFinite(o[k])) r[k] = clamp01(o[k]); });
    return r;
  }
  function getSettings() {
    return cleanSettings(DEF_SETTINGS, readJSON('settings'));
  }
  // 준 값만 바꿔 저장하고 곧바로 적용한다 → 바뀐 전체 설정
  function setSettings(part) {
    const s = cleanSettings(getSettings(), part);
    writeJSON('settings', s);
    applySettings(s);
    return s;
  }
  // 소리 엔진(G.audio.configure)과 움직임 줄이기(<html>의 'reduce-motion' 클래스, G.util.reducedMotion이 읽음)에 적용
  function applySettings(s) {
    s = s ? cleanSettings(DEF_SETTINGS, s) : getSettings();
    try {
      if (G.audio && typeof G.audio.configure === 'function') {
        G.audio.configure({ bgmOn: s.bgmOn, bgmVolume: s.bgmVolume, sfxOn: s.sfxOn, sfxVolume: s.sfxVolume });
      }
    } catch (e) { /* 소리 엔진 문제로 설정 화면이 멈추지 않게 */ }
    try {
      const doc = window.document;
      const cl = doc && doc.documentElement && doc.documentElement.classList;
      if (cl) { if (s.reduceMotion) cl.add('reduce-motion'); else cl.remove('reduce-motion'); }
    } catch (e) { /* 문서가 없는 곳(점검)에서도 조용히 */ }
    return s;
  }

  // ── 마지막 선택(spec 6.1) ──────────────────────────────
  function cleanSelection(base, o) {
    const r = Object.assign({}, base);
    if (isObj(o)) {
      if (GRADES.indexOf(o.grade) >= 0) r.grade = o.grade;
      if (SEAS.indexOf(o.sea) >= 0) r.sea = o.sea;
      if (typeof o.level === 'number' && isFinite(o.level)) r.level = o.level;
      if (typeof o.hideTime === 'boolean') r.hideTime = o.hideTime;
    }
    if (!validLevel(r.sea, r.level)) r.level = 1; // 바다에 없는 단계면 1단계
    return r;
  }
  function getSelection() {
    return cleanSelection(DEF_SELECTION, readJSON('selection'));
  }
  function setSelection(part) {
    const s = cleanSelection(getSelection(), part);
    writeJSON('selection', s);
    return s;
  }

  // ── 누적 소리 지도(spec 6.5) ───────────────────────────
  function readMap() {
    const o = readJSON('soundmap') || {};
    const m = { added: [] };
    SEAS.forEach((sea) => {
      const e = isObj(o[sea]) ? o[sea] : {};
      const g = e.games;
      m[sea] = { ids: cleanIds(sea, e.ids), games: typeof g === 'number' && isFinite(g) && g > 0 ? Math.floor(g) : 0 };
    });
    if (Array.isArray(o.added)) m.added = o.added.filter((x) => typeof x === 'string').slice(-ADDED_MAX);
    return m;
  }
  // 그 바다에서 이 기기가 맞힌 적 있는 소리 id(복사본)
  function soundMap(sea) {
    if (SEAS.indexOf(sea) < 0) return [];
    return readMap()[sea].ids.slice();
  }
  // 그 바다의 누적 지도에 더한 판 수
  function mapGames(sea) {
    if (SEAS.indexOf(sea) < 0) return 0;
    return readMap()[sea].games;
  }
  // 기록 내용의 해시(키 순서와 상관없이 같은 내용이면 같은 값) — id 없는 기록의 '이미 더함' 표시
  function canon(x) {
    if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
    if (isObj(x)) return '{' + Object.keys(x).filter((k) => k !== 'id' && x[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}';
    return x === undefined ? 'null' : JSON.stringify(x);
  }
  function hashOf(record) {
    const text = canon(record);
    let h1 = 0x811c9dc5, h2 = 5381;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = (Math.imul(h2, 33) + c) >>> 0;
    }
    return 'h:' + h1.toString(36) + '.' + h2.toString(36) + '.' + text.length.toString(36);
  }
  // 판 기록을 누적 지도에 더한다. 한 판은 한 번만 → 더했으면 true, 이미 더했거나 쓸 수 없는 기록이면 false
  function addRecord(record, id) {
    if (!isObj(record) || SEAS.indexOf(record.sea) < 0) return false;
    let hash;
    try { hash = hashOf(record); } catch (e) { return false; }
    const gid = id != null && id !== '' ? 'id:' + String(id)
      : record.id != null && record.id !== '' ? 'id:' + String(record.id) : null;
    const m = readMap();
    if (m.added.indexOf(gid || hash) >= 0) return false;
    const e = m[record.sea];
    const ids = cleanIds(record.sea, record.hitSoundsAll);
    ids.forEach((x) => { if (e.ids.indexOf(x) < 0) e.ids.push(x); });
    e.games += 1;
    if (gid) m.added.push(gid);
    if (m.added.indexOf(hash) < 0) m.added.push(hash);
    m.added = m.added.slice(-ADDED_MAX);
    writeJSON('soundmap', m);
    return true;
  }

  // ── 풀이 예시를 본 적 있는지(spec 6.2) ─────────────────
  function seenExample() {
    const o = readJSON('seenExample');
    return !!(o && o.seen === true);
  }
  function setSeenExample(v) {
    if (v === undefined || v) writeJSON('seenExample', { seen: true });
    else rawDel('seenExample');
  }
  // ── '게임 방법'을 연 적 있는지(시작 화면이 처음 온 기기에 '게임 방법' 단추를 눈에 띄게 한다) ──
  function seenHowto() {
    const o = readJSON('seenHowto');
    return !!(o && o.seen === true);
  }
  function setSeenHowto(v) {
    if (v === undefined || v) writeJSON('seenHowto', { seen: true });
    else rawDel('seenHowto');
  }

  // ── 진행 중인 판(spec 6.4) ─────────────────────────────
  function newGameId() {
    let r = '';
    for (let i = 0; i < 10; i++) r += Math.floor(Math.random() * 36).toString(36);
    return Date.now().toString(36) + '-' + r;
  }
  const isTeam = (t) => isObj(t) && Array.isArray(t.fleet) && Array.isArray(t.shots);
  function validGame(st) {
    if (!isObj(st) || st.v !== GAME_V) return false;
    if (st.mode !== 'practice' && st.mode !== 'duel') return false;
    if (!validLevel(st.sea, st.level)) return false;
    if (st.phase !== 'playing' && st.phase !== 'placing') return false; // 'over'는 이어 할 판이 아니다
    if (st.phase === 'placing' && !(st.mode === 'duel' && st.hideTime === true)) return false;
    if (!isObj(st.teams)) return false;
    const names = st.mode === 'practice' ? ['player', 'enemy'] : ['blue', 'red'];
    if (!names.every((n) => isTeam(st.teams[n]))) return false;
    if (st.mode === 'duel') {
      // 실시간: 두 팀의 쏜 수는 달라도 된다. 팀마다 제한 발(단계의 제한 턴)을 넘을 수는 없다.
      const limit = turnLimit(st.sea, st.level);
      if (limit != null && names.some((n) => st.teams[n].shots.length > limit)) return false;
    }
    return true;
  }
  // 단계의 제한 턴(대결은 팀마다 발 수). 단계 데이터가 없으면 null(확인하지 않음)
  function turnLimit(sea, n) {
    const L = window.LEVELS;
    const lv = L && L[sea] && L[sea][n];
    return lv && typeof lv.turns === 'number' ? lv.turns : null;
  }
  // 라운드 방식 때 저장한 대결 판에 남은 rounds 값은 버린다(이제 쓰지 않음)
  function tidy(st) {
    if (st.mode === 'duel') delete st.rounds;
    return st;
  }
  // 배치 중인 판: 배치는 버리고 청팀부터 다시(rules.restartPlacing과 같은 모양)
  function restartPlacing(st) {
    if (G.rules && typeof G.rules.restartPlacing === 'function') {
      try { return G.rules.restartPlacing(st); } catch (e) { /* 아래에서 직접 */ }
    }
    const next = copy(st);
    next.teams = Object.assign({}, next.teams, { blue: { fleet: [], shots: [] }, red: { fleet: [], shots: [] } });
    next.phase = 'placing'; next.placingTeam = 'blue'; next.result = null;
    return next;
  }
  // 매 발 부른다. 저장했으면(이번 세션 메모리 포함) true
  function saveGame(state) {
    if (!isObj(state)) return false;
    if (state.phase === 'over') {
      // 끝난 판은 이 순간 누적 소리 지도에 더한다 — 남은 배 공개·결과 화면 전 멈춤 동안 새로고침·꺼짐이 나도 잃지 않게.
      //   G.app.finishGame이 뒤이어 같은 판을 더하려 해도 같은 id(없으면 같은 내용 해시)라 아무것도 하지 않는다.
      if (G.rules && typeof G.rules.makeRecord === 'function') {
        try { addRecord(G.rules.makeRecord(state), state.id); } catch (e) { /* 기록을 못 만들면 finishGame이 다시 해 본다 */ }
      }
      clearGame(); return false;
    }
    let st;
    try { st = copy(state); } catch (e) { return false; }
    if (st.phase === 'placing') st = restartPlacing(st);
    if (!validGame(st)) return false;
    tidy(st);
    return writeJSON('game', { savedAt: Date.now(), state: st });
  }
  // 이어 할 판(복사본) 또는 null. 망가졌거나 버전이 다르거나 끝난 판이면 지우고 null
  function loadGame() {
    if (rawGet('game') == null) return null;
    const o = readJSON('game');
    if (!o || !validGame(o.state)) { rawDel('game'); return null; }
    return tidy(copy(o.state));
  }
  const hasGame = () => loadGame() !== null;
  function clearGame() { rawDel('game'); }

  // ── 기록 지우기(spec 6.1): 누적 지도 · 풀이 예시 본 기록 · 진행 판. 설정·마지막 선택은 남긴다 ──
  function clearRecords() {
    rawDel('soundmap');
    rawDel('seenExample');
    rawDel('seenHowto');
    rawDel('game');
  }

  return {
    PREFIX, SCHEMA, storageOk,
    getSettings, setSettings, applySettings,
    getSelection, setSelection,
    soundMap, mapGames, addRecord,
    seenExample, setSeenExample, seenHowto, setSeenHowto,
    newGameId, saveGame, loadGame, hasGame, clearGame,
    clearRecords,
  };
})();
