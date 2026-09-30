'use strict';
// 규칙 엔진 G.rules — 채점·신호·함대 배치·턴·승패·알아 두기. 화면(DOM)을 쓰지 않는 순수 함수만 둔다.
//   불러오는 순서: js/core/util.js → js/data/sounds.js · fleets.js · levels.js → 이 파일.
//   Node 점검: tests/check-rules.mjs (spec 10-1).
//   모든 함수는 받은 값을 바꾸지 않는다. 상태를 바꾸는 함수(fire, fireRound, placeShip, finishPlacing, restartPlacing)는 새 상태를 돌려준다.
//   단계 설정(G.rules.level이 돌려주는 LEVELS의 값)은 읽기만 한다.
//
// ── 이름(다른 작업과의 약속) ────────────────────────────────────────────
//   바다 sea: 'consonant' | 'vowel'      학년 grade: 'm3' | 'h1'(규칙은 학년을 보지 않는다)      모드 mode: 'practice' | 'duel'
//   팀(쏘는 쪽): 연습 'player'(적 함대는 'enemy'가 가짐), 대결 'blue'(청팀) · 'red'(홍팀) — 대결은 두 팀이 동시에 쏜다
//   한 발의 결과 kind:  턴을 쓰는 것   'hit' 명중 · 'line' 같은 줄 · 'miss' 빗나감 · 'none' 없는 소리   ← 신호는 이 네 가지뿐
//                       턴을 안 쓰는 것 'notInSea' 이번 바다에 없는 칸 · 'already' 이미 쏜 소리
//   '같은 줄' 강조 targets(배열, 강조 없는 단계에서는 늘 빈 배열):
//     자음 [{ cell: { place, manner } }]  또는  [{ place }] / [{ manner }] / [{ place }, { manner }]   (같은 칸 우선, 그다음 세로·가로)
//     모음 [{ pair: { height, column } }] 또는  [{ height }] / [{ column }] / [{ height }, { column }] (입술 짝 칸 우선, 그다음 가로·세로)
//   알아 두기 id: 'pair-ㅂㅁ' 'pair-ㄷㄴ' 'pair-ㄱㅇ' 'ng' 'oe-wi' 'e-ae' (조건은 SOUNDS.notes, 문구는 js/data/text.js)
//
// ── 조합(조작부가 넘기는 값) ─────────────────────────────────────────────
//   자음 { place, manner, strength }  strength: 'plain'|'tense'|'aspirated'|null(비음·유음·목청+마찰, 1단계는 무시됨)
//   모음 { backness: 'front'|'back', height: 'high'|'mid'|'low', lips: 'unrounded'|'rounded' }
//
// ── 배 · 함대 ────────────────────────────────────────────────────────────
//   배 Ship = { size: 3|2|1, sounds: ['ㄱ','ㄲ','ㅋ'] }   함대 = Ship[] (큰 배부터, 단계의 fleet 순서 그대로)
//
// ── 판 상태 GameState (JSON으로 저장·복원 가능) ─────────────────────────
//   {
//     v: 1,                                   // 형식 버전(바뀌면 옛 진행 판은 버린다)
//     mode, grade, sea, level,                // level = 단계 번호
//     hideTime: bool,                         // 대결의 숨기기 시간(연습은 늘 false)
//     phase: 'placing' | 'playing' | 'over',
//     rounds: 0,                              // (대결만) 끝난 라운드 수 = 두 팀 각자의 shots 수(늘 같다)
//     placingTeam: 'blue' | 'red' | null,     // 숨기기 시간에 배를 놓고 있는 팀
//     teams: {                                // 연습: player·enemy / 대결: blue·red
//       <팀>: { fleet: Ship[],                // 그 팀이 숨긴 자기 배(연습의 player는 빈 배열)
//               shots: Shot[] }               // 그 팀이 상대 바다에 쏜 기록(턴을 쓴 발만, 쏜 순서)
//     },
//     result: null | 연습 { success: bool } | 대결 { winner: 'blue'|'red'|null(무승부),
//               reason: 'found-all'(한 팀만 다 찾음) | 'both-found'(같은 라운드에 둘 다, 무승부)
//                     | 'more-hits'(라운드 소진, 맞힌 칸이 많은 팀) | 'hits-tie'(라운드 소진, 동점 무승부) }
//   }
//   Shot = { key, sound: 'ㄱ'|null(없는 소리), input, cell, kind: 'hit'|'line'|'miss'|'none',
//            targets, emptyCell: bool(없는 소리가 빈칸이면 true → 판의 그 칸에 불발 표시, false면 신호 기록장에만),
//            sunk: 격침된 배 크기|null, sunkShip: 격침된 배 번호(상대 fleet의 순서)|null }
//     cell: 자음 { place, manner } / 모음 { height, column }
//   대결(spec 6.3, 동시 발사 라운드): 두 팀이 각자 소리를 빚어 '준비' → checkShot(state, 팀, 조합)이
//     'notInSea'·'already'면 준비 거부(상태 그대로). 둘 다 준비되면 fireRound(state, { blue, red })가 두 발을
//     라운드 전 상태로 함께 채점하고 두 팀 모두 한 턴을 쓴다. 라운드가 끝날 때 승패를 본다(duelOutcome).
//     한 판의 라운드 수 = 단계의 제한 턴(roundInfo). 연습은 fire(state, 조합)로 한 발씩.
//
// ── 판 기록 GameRecord (결과 화면·누적 소리 지도가 받는 값, makeRecord) ─
//   {
//     v: 1, mode, grade, sea, level, turnLimit, finished: bool,
//     result,                                  // 판 상태의 result와 같음
//     teams: { <쏜 팀 player | blue·red>: {
//       shots: Shot[], hitSounds: [id], turnsUsed, dudCount(없는 소리 횟수),
//       sunkShips: [번호], targetFleet: Ship[]  // 이 팀이 쏜 바다의 배 전체(공개·소리 지도용)
//     } },
//     hitSoundsAll: [id],                      // 이번 판에 맞힌 소리(대결은 두 팀 합침, 중복 없음) → 누적 지도에 한 번 더함
//     notes: [{ id, sounds: [id] }]            // 알아 두기(이번 판에 쏜 소리로만, 대결은 두 팀 합침)
//   }
G.rules = (function () {
  const S = window.SOUNDS, F = window.FLEETS, L = window.LEVELS;
  const byId = {};
  S.consonants.concat(S.vowels).forEach((s) => { byId[s.id] = s; });
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const has = (arr, x) => arr.indexOf(x) >= 0;
  const gkey = (g) => g.slice().sort().join('');

  // ── 기본 ──────────────────────────────────────────────
  function level(sea, n) {
    const l = L[sea] && L[sea][n];
    if (!l) throw new Error('없는 단계: ' + sea + ' ' + n);
    return l;
  }
  const levelOf = (state) => level(state.sea, state.level);
  const slash = (id) => '/' + id + '/';
  const sound = (id) => byId[id] || null;

  // 결정적인 난수(점검·풀이 예시용). makeRng(시드) → () => 0 이상 1 미만
  function makeRng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ── 조작부 상태(spec 5.1) ─────────────────────────────
  // 세기 구분이 없는 조합: 비음·유음, 목청 + 마찰(= /ㅎ/)
  const strengthless = (place, manner) => manner === 'nasal' || manner === 'liquid' || (place === 'glottal' && manner === 'fricative');

  // controls(단계, 고른 것) → { strengthCards: 세기 카드가 있는가, strengthDisabled: 세기 카드 흐림, fireEnabled: 발사 단추 켜짐 }
  //   없는 조합은 막지 않는다(발사하면 없는 소리).
  function controls(lv, sel) {
    sel = sel || {};
    if (lv.sea === 'vowel') return { strengthCards: false, strengthDisabled: true, fireEnabled: !!(sel.backness && sel.height && sel.lips) };
    if (!lv.strengthCards) return { strengthCards: false, strengthDisabled: true, fireEnabled: !!(sel.place && sel.manner) };
    const dis = strengthless(sel.place, sel.manner);
    return { strengthCards: true, strengthDisabled: dis, fireEnabled: !!(sel.place && sel.manner && (dis || sel.strength)) };
  }

  // 조합 → 정규화한 조합과 그 소리. 쏠 수 없는(발사 단추가 꺼진) 조합이면 오류.
  //   → { key, sound: id|null, cell, emptyCell, input }
  function compose(lv, input) {
    input = input || {};
    if (!controls(lv, input).fireEnabled) throw new Error('아직 쏠 수 없는 조합: ' + JSON.stringify(input));
    if (lv.sea === 'vowel') {
      const { backness, height, lips } = input;
      if (!has(S.backs, backness) || !has(S.heights, height) || !has(S.lips, lips)) throw new Error('모르는 모음 조합: ' + JSON.stringify(input));
      const column = backness + '-' + lips;
      const s = S.vowels.find((v) => v.height === height && v.column === column);
      return { key: 'v:' + height + '/' + column, sound: s ? s.id : null, cell: { height, column }, emptyCell: !s, input: { backness, height, lips } };
    }
    const { place, manner } = input;
    if (!has(S.places, place) || !has(S.manners, manner)) throw new Error('모르는 자음 조합: ' + JSON.stringify(input));
    let strength;
    if (strengthless(place, manner)) strength = 'none';          // 세기 카드 흐림 → 세기 없음
    else if (!lv.strengthCards) strength = 'plain';              // 자음 1단계: 예사소리로 정해짐
    else if (has(S.strengths, input.strength)) strength = input.strength;
    else throw new Error('모르는 세기: ' + input.strength);
    const s = S.consonants.find((c) => c.place === place && c.manner === manner && c.strength === strength);
    const cellHas = S.consonants.some((c) => c.place === place && c.manner === manner);
    return {
      key: 'c:' + place + '/' + manner + '/' + strength, sound: s ? s.id : null,
      cell: { place, manner }, emptyCell: !cellHas, input: { place, manner, strength: strength === 'none' ? null : strength },
    };
  }

  // 소리 → 그 소리를 내는 조합(풀이 예시·점검용)
  function inputOf(id) {
    const s = byId[id];
    if (!s) throw new Error('없는 소리: ' + id);
    if (s.sea === 'vowel') return { backness: s.backness, height: s.height, lips: s.lips };
    return { place: s.place, manner: s.manner, strength: s.strength === 'none' ? null : s.strength };
  }

  // ── 신호(spec 5.4) ───────────────────────────────────
  // signal(단계, 쏜 소리 id, 아직 맞히지 않은 배 칸 id 목록) → { kind: 'hit'|'line'|'miss', targets }
  function signal(lv, id, unhit) {
    const s = byId[id];
    if (has(unhit, id)) return { kind: 'hit', targets: [] };
    const U = unhit.map((x) => byId[x]).filter(Boolean);
    let targets = [];
    if (s.sea === 'consonant') {
      if (U.some((u) => u.place === s.place && u.manner === s.manner)) targets = [{ cell: { place: s.place, manner: s.manner } }];
      else {
        if (U.some((u) => u.place === s.place)) targets.push({ place: s.place });     // 세로줄(위치)
        if (U.some((u) => u.manner === s.manner)) targets.push({ manner: s.manner }); // 가로줄(방법)
      }
    } else {
      const pair = U.find((u) => u.height === s.height && u.backness === s.backness && u.lips !== s.lips);
      if (pair) targets = [{ pair: { height: pair.height, column: pair.column } }];
      else {
        if (U.some((u) => u.height === s.height)) targets.push({ height: s.height });  // 가로줄(높이)
        if (U.some((u) => u.column === s.column)) targets.push({ column: s.column });  // 세로열(앞뒤·입술 모두 같음)
      }
    }
    if (!targets.length) return { kind: 'miss', targets: [] };
    return { kind: 'line', targets: lv.highlight ? targets : [] }; // 강조 없는 단계: 어느 줄인지 알리지 않음
  }

  // ── 한 발 채점(spec 5.3) ─────────────────────────────
  const hitSetOf = (shots) => new Set(shots.filter((x) => x.kind === 'hit').map((x) => x.sound));
  const sunkIndexes = (fleet, hitSet) => fleet.map((sh, i) => (sh.sounds.every((id) => hitSet.has(id)) ? i : -1)).filter((i) => i >= 0);

  // resolveShot(단계, 조합, { fleet: 쏘는 바다의 배, shots: 쏘는 팀의 기록 }) → 결과
  //   { kind, usesTurn, key, sound, cell, input, emptyCell, targets, sunk, sunkShip }
  function resolveShot(lv, input, board) {
    const c = compose(lv, input);
    const out = { kind: null, usesTurn: true, key: c.key, sound: c.sound, cell: c.cell, input: c.input, emptyCell: false, targets: [], sunk: null, sunkShip: null };
    if (c.sound && !has(lv.open, c.sound)) return Object.assign(out, { kind: 'notInSea', usesTurn: false });
    if (board.shots.some((x) => x.key === c.key)) return Object.assign(out, { kind: 'already', usesTurn: false });
    if (!c.sound) return Object.assign(out, { kind: 'none', emptyCell: c.emptyCell });
    const hitSet = hitSetOf(board.shots);
    const unhit = [];
    board.fleet.forEach((sh) => sh.sounds.forEach((id) => { if (!hitSet.has(id)) unhit.push(id); }));
    const sig = signal(lv, c.sound, unhit);
    out.kind = sig.kind; out.targets = sig.targets;
    if (sig.kind === 'hit') {
      hitSet.add(c.sound);
      const i = board.fleet.findIndex((sh) => has(sh.sounds, c.sound));
      if (board.fleet[i].sounds.every((id) => hitSet.has(id))) { out.sunkShip = i; out.sunk = board.fleet[i].size; }
    }
    return out;
  }

  // ── 함대 배치(spec 3.3, 6.3) ─────────────────────────
  // 이 단계에서 그 크기의 배가 숨을 수 있는 묶음(열린 칸 안의 묶음만)
  function allowedGroups(lv, size) {
    return ((F[lv.sea] && F[lv.sea][size]) || []).filter((g) => g.every((id) => has(lv.open, id))).map((g) => g.slice());
  }
  // 다음에 놓을 배 크기(큰 배부터). 다 찼으면 null
  const nextShipSize = (lv, fleet) => (fleet.length < lv.fleet.length ? lv.fleet[fleet.length] : null);
  const usedOf = (fleet) => new Set([].concat.apply([], fleet.map((sh) => sh.sounds)));
  // 지금 놓을 수 있는 묶음(대결 직접 배치에서 누를 수 있는 것)
  function placeableGroups(lv, fleet) {
    const size = nextShipSize(lv, fleet);
    if (size == null) return [];
    const used = usedOf(fleet);
    return allowedGroups(lv, size).filter((g) => g.every((id) => !used.has(id)));
  }
  // validatePlacement → { ok, reason: null|'full'|'size'|'group'|'overlap' }
  function validatePlacement(lv, fleet, group) {
    const size = nextShipSize(lv, fleet);
    if (size == null) return { ok: false, reason: 'full' };
    if (!Array.isArray(group) || group.length !== size) return { ok: false, reason: 'size' };
    if (!allowedGroups(lv, size).some((g) => gkey(g) === gkey(group))) return { ok: false, reason: 'group' };
    const used = usedOf(fleet);
    if (group.some((id) => used.has(id))) return { ok: false, reason: 'overlap' };
    return { ok: true, reason: null };
  }
  // 배 하나를 더한 새 함대(묶음은 정해진 순서로 저장). 잘못된 배치면 오류.
  function addShip(lv, fleet, group) {
    const v = validatePlacement(lv, fleet, group);
    if (!v.ok) throw new Error('놓을 수 없는 배(' + v.reason + '): ' + JSON.stringify(group));
    const size = nextShipSize(lv, fleet);
    const canon = allowedGroups(lv, size).find((g) => gkey(g) === gkey(group));
    return clone(fleet).concat([{ size, sounds: canon }]);
  }
  // 함대(또는 앞부분)가 규칙대로인지: '' = 맞음, 아니면 까닭
  function fleetError(lv, fleet, complete) {
    if (!Array.isArray(fleet)) return 'not-array';
    let acc = [];
    for (const sh of fleet) {
      if (!sh || !Array.isArray(sh.sounds) || sh.size !== sh.sounds.length) return 'ship-shape';
      const v = validatePlacement(lv, acc, sh.sounds);
      if (!v.ok) return v.reason;
      acc = addShip(lv, acc, sh.sounds);
    }
    if (complete && acc.length !== lv.fleet.length) return 'incomplete';
    return '';
  }
  // 놓은 배는 그대로 두고 남은 배를 무작위로 채운다(숨기기 시간이 지났을 때, 무작위 배치).
  //   큰 배부터 허용 묶음 가운데 고르게 고른다. 막히면 되돌아가 다른 묶음을 고른다(실제로는 막히지 않음 — 점검이 확인).
  function fillFleet(lv, fleet, rng) {
    rng = rng || Math.random;
    const err = fleetError(lv, fleet, false);
    if (err) throw new Error('규칙에 어긋난 함대(' + err + ')');
    const go = (fl) => {
      if (nextShipSize(lv, fl) == null) return fl;
      for (const g of shuffle(placeableGroups(lv, fl), rng)) {
        const r = go(addShip(lv, fl, g));
        if (r) return r;
      }
      return null;
    };
    const r = go(clone(fleet));
    if (!r) throw new Error('함대를 끝까지 놓을 수 없음');
    return r;
  }
  const randomFleet = (lv, rng) => fillFleet(lv, [], rng);

  // ── 턴 · 격침 · 승패 ─────────────────────────────────
  const opponent = (state, team) => (state.mode === 'practice' ? (team === 'player' ? 'enemy' : 'player') : (team === 'blue' ? 'red' : 'blue'));
  const shooters = (state) => (state.mode === 'practice' ? ['player'] : ['blue', 'red']);

  // sideSummary(상태, 쏘는 팀) → 그 팀이 쏜 바다의 현황
  function sideSummary(state, team) {
    const lv = levelOf(state);
    const shots = state.teams[team].shots;
    const fleet = state.teams[opponent(state, team)].fleet;
    const hitSet = hitSetOf(shots);
    const sunkShips = sunkIndexes(fleet, hitSet);
    return {
      hitSounds: shots.filter((x) => x.kind === 'hit').map((x) => x.sound),
      sunkShips,
      remainingShips: fleet.map((_, i) => i).filter((i) => !has(sunkShips, i)),
      allSunk: fleet.length > 0 && sunkShips.length === fleet.length,
      turnsUsed: shots.length,
      turnsLeft: Math.max(0, lv.turns - shots.length),
      dudCount: shots.filter((x) => x.kind === 'none').length,
    };
  }

  // 대결 승패(spec 6.3). 라운드가 끝났을 때 두 팀의 현황만으로 정한다. 아직 안 끝났으면 null.
  //   { turnLimit, rounds(끝난 라운드 수), blueDone, redDone, blueHits, redHits } → { winner, reason } | null
  function duelOutcome(o) {
    if (o.blueDone && o.redDone) return { winner: null, reason: 'both-found' };   // 같은 라운드에 둘 다 → 무승부
    if (o.blueDone) return { winner: 'blue', reason: 'found-all' };
    if (o.redDone) return { winner: 'red', reason: 'found-all' };
    if (o.rounds >= o.turnLimit) {                                                 // 라운드 소진 → 맞힌 칸 비교
      if (o.blueHits === o.redHits) return { winner: null, reason: 'hits-tie' };
      return { winner: o.blueHits > o.redHits ? 'blue' : 'red', reason: 'more-hits' };
    }
    return null;
  }

  // 판이 끝났는지 판정 → result | null
  function judge(state) {
    const lv = levelOf(state);
    if (state.mode === 'practice') {
      const s = sideSummary(state, 'player');
      if (s.allSunk) return { success: true };
      if (s.turnsUsed >= lv.turns) return { success: false };
      return null;
    }
    const b = sideSummary(state, 'blue'), r = sideSummary(state, 'red');
    return duelOutcome({
      turnLimit: lv.turns, rounds: state.rounds || 0, blueDone: b.allSunk, redDone: r.allSunk,
      blueHits: b.hitSounds.length, redHits: r.hitSounds.length,
    });
  }

  // 대결 라운드 정보 → { played: 끝난 라운드 수, limit: 제한 라운드(= 단계의 제한 턴), left: 남은 라운드,
  //                      number: 지금 라운드 번호(끝난 판이면 마지막 라운드 번호) }
  function roundInfo(state) {
    const limit = levelOf(state).turns;
    const played = state.rounds || 0;
    return { played, limit, left: Math.max(0, limit - played), number: state.phase === 'over' ? played : Math.min(limit, played + 1) };
  }

  // ── 판 상태 ──────────────────────────────────────────
  // newGame({ mode, grade, sea, level, hideTime, rng, fleet(연습 적 함대, 선택), fleets: { blue, red }(대결, 선택) }) → 판 상태
  function newGame(opts) {
    const lv = level(opts.sea, opts.level);
    const rng = opts.rng || Math.random;
    if (opts.mode !== 'practice' && opts.mode !== 'duel') throw new Error('모르는 모드: ' + opts.mode);
    // 정해 준 함대(풀이 예시·점검): 규칙대로인지 확인하고 정해진 순서로 다시 놓는다
    const given = (fl) => {
      const err = fleetError(lv, fl, true);
      if (err) throw new Error('규칙에 어긋난 함대(' + err + ')');
      return fl.reduce((acc, sh) => addShip(lv, acc, sh.sounds), []);
    };
    const st = {
      v: 1, mode: opts.mode, grade: opts.grade || 'm3', sea: lv.sea, level: lv.level,
      hideTime: opts.mode === 'duel' && !!opts.hideTime,
      phase: 'playing', placingTeam: null, teams: {}, result: null,
    };
    if (opts.mode === 'duel') st.rounds = 0;
    if (opts.mode === 'practice') {
      st.teams.player = { fleet: [], shots: [] };
      st.teams.enemy = { fleet: opts.fleet ? given(opts.fleet) : randomFleet(lv, rng), shots: [] };
    } else if (opts.fleets) {
      st.teams.blue = { fleet: given(opts.fleets.blue), shots: [] };
      st.teams.red = { fleet: given(opts.fleets.red), shots: [] };
    } else if (st.hideTime) {
      st.teams.blue = { fleet: [], shots: [] };
      st.teams.red = { fleet: [], shots: [] };
      st.phase = 'placing'; st.placingTeam = 'blue';
    } else {
      st.teams.blue = { fleet: randomFleet(lv, rng), shots: [] };
      st.teams.red = { fleet: randomFleet(lv, rng), shots: [] };
    }
    return st;
  }

  // 숨기기 시간: 지금 배치하는 팀이 배 하나를 놓는다 → 새 상태(잘못된 배치면 오류)
  function placeShip(state, group) {
    if (state.phase !== 'placing') throw new Error('배치 중이 아님');
    const next = clone(state);
    const t = next.placingTeam;
    next.teams[t].fleet = addShip(levelOf(state), next.teams[t].fleet, group);
    return next;
  }
  // '다 놓았어요' 또는 30초가 지남: 남은 배를 무작위로 채우고 다음 팀(청 → 홍) 또는 대결 시작
  function finishPlacing(state, rng) {
    if (state.phase !== 'placing') throw new Error('배치 중이 아님');
    const next = clone(state);
    const t = next.placingTeam;
    next.teams[t].fleet = fillFleet(levelOf(state), next.teams[t].fleet, rng);
    if (t === 'blue') next.placingTeam = 'red';
    else { next.placingTeam = null; next.phase = 'playing'; }
    return next;
  }
  // 배치 도중 새로고침: 배치는 저장하지 않으므로 청팀부터 다시
  function restartPlacing(state) {
    const next = clone(state);
    next.teams.blue = { fleet: [], shots: [] };
    next.teams.red = { fleet: [], shots: [] };
    next.phase = 'placing'; next.placingTeam = 'blue'; next.result = null;
    if (next.mode === 'duel') next.rounds = 0;
    return next;
  }

  const shotRecord = (o) => ({
    key: o.key, sound: o.sound, input: clone(o.input), cell: clone(o.cell), kind: o.kind,
    targets: clone(o.targets), emptyCell: o.emptyCell, sunk: o.sunk, sunkShip: o.sunkShip,
  });

  // 연습: 한 발 쏘기 fire(상태, 조합) → { state: 새 상태, outcome }
  //   outcome = resolveShot의 결과 + { shooter, over }. 턴을 안 쓰는 결과면 state는 받은 그대로(같은 객체).
  //   대결은 이 함수를 쓰지 않는다(checkShot + fireRound).
  function fire(state, input) {
    if (state.mode !== 'practice') throw new Error('대결은 fireRound로 쏜다');
    if (state.phase !== 'playing') throw new Error('쏠 수 있는 때가 아님: ' + state.phase);
    const shooter = 'player';
    const lv = levelOf(state);
    const outcome = resolveShot(lv, input, { fleet: state.teams.enemy.fleet, shots: state.teams.player.shots });
    outcome.shooter = shooter;
    outcome.over = false;
    if (!outcome.usesTurn) return { state, outcome };
    const next = clone(state);
    next.teams.player.shots.push(shotRecord(outcome));
    const res = judge(next);
    if (res) { next.phase = 'over'; next.result = res; outcome.over = true; }
    return { state: next, outcome };
  }

  // 대결 라운드를 쏠 수 있는 판인지
  function assertDuelPlaying(state, team) {
    if (!state || state.mode !== 'duel') throw new Error('대결 판이 아님');
    if (state.phase !== 'playing') throw new Error('쏠 수 있는 때가 아님: ' + state.phase);
    if (team !== undefined && team !== 'blue' && team !== 'red') throw new Error('모르는 팀: ' + team);
  }
  // 그 팀의 한 발을 이번 라운드 전 상태로 채점(상태는 바꾸지 않음)
  function judgeDuelShot(state, team, input) {
    return resolveShot(levelOf(state), input, { fleet: state.teams[opponent(state, team)].fleet, shots: state.teams[team].shots });
  }

  // 대결 '준비' 확인: checkShot(상태, 팀, 조합) → { ok: true, kind: null } | { ok: false, kind: 'notInSea'|'already' }
  //   거부면 그 팀은 준비되지 않는다(라운드를 헛되이 쓰지 않게). 상태는 바꾸지 않는다. 쏠 수 없는 조합이면 오류.
  function checkShot(state, team, input) {
    assertDuelPlaying(state, team);
    const o = judgeDuelShot(state, team, input);
    return o.usesTurn ? { ok: true, kind: null } : { ok: false, kind: o.kind };
  }

  // 대결 한 라운드: fireRound(상태, { blue: 조합, red: 조합 }) → { state: 새 상태, outcomes: { blue, red }, over }
  //   두 발을 모두 라운드 전 상태로 채점하고(동시 발사) 두 팀이 각 한 턴을 쓴다. 명중해도 추가 발사는 없다.
  //   두 입력이 모두 있고 둘 다 checkShot을 통과해야 한다(아니면 오류, 상태는 그대로).
  //   outcome = resolveShot의 결과 + { shooter, over }.
  function fireRound(state, inputs) {
    assertDuelPlaying(state);
    if (!inputs || !inputs.blue || !inputs.red) throw new Error('두 팀의 조합이 모두 있어야 라운드를 쏜다');
    const outcomes = {};
    for (const t of ['blue', 'red']) {
      const o = judgeDuelShot(state, t, inputs[t]);
      if (!o.usesTurn) throw new Error('준비할 수 없는 조합: ' + t + ' ' + o.kind);
      o.shooter = t;
      o.over = false;
      outcomes[t] = o;
    }
    const next = clone(state);
    for (const t of ['blue', 'red']) next.teams[t].shots.push(shotRecord(outcomes[t]));
    next.rounds = (state.rounds || 0) + 1;
    const res = judge(next);
    if (res) { next.phase = 'over'; next.result = res; outcomes.blue.over = true; outcomes.red.over = true; }
    return { state: next, outcomes, over: !!res };
  }

  // ── 결과 화면 ────────────────────────────────────────
  // 알아 두기(spec 6.5): 이번 판에 쏜 소리(대결은 두 팀 합침)에 해당하는 항목만, 항목마다 한 번
  function notesFor(sea, shotSounds) {
    const shot = new Set(shotSounds);
    return S.notes
      .filter((n) => n.sea === sea && (n.all ? n.all.every((id) => shot.has(id)) : n.any.some((id) => shot.has(id))))
      .map((n) => ({ id: n.id, sounds: n.all ? n.all.slice() : n.any.filter((id) => shot.has(id)) }));
  }

  // 판 상태 → 판 기록(결과 화면이 받는 값). 머리 주석의 GameRecord.
  function makeRecord(state) {
    const teams = {};
    const hitAll = [], shotAll = [];
    const addTo = (arr, id) => { if (id && !has(arr, id)) arr.push(id); };
    for (const t of shooters(state)) {
      const s = sideSummary(state, t);
      const shots = state.teams[t].shots;
      teams[t] = {
        shots: clone(shots), hitSounds: s.hitSounds, turnsUsed: s.turnsUsed, dudCount: s.dudCount,
        sunkShips: s.sunkShips, targetFleet: clone(state.teams[opponent(state, t)].fleet),
      };
      s.hitSounds.forEach((id) => addTo(hitAll, id));
      shots.forEach((x) => addTo(shotAll, x.sound));
    }
    return {
      v: 1, mode: state.mode, grade: state.grade, sea: state.sea, level: state.level,
      turnLimit: levelOf(state).turns, finished: state.phase === 'over', result: clone(state.result),
      teams, hitSoundsAll: hitAll, notes: notesFor(state.sea, shotAll),
    };
  }

  return {
    // 데이터 찾기
    level, sound, slash, inputOf, makeRng,
    // 조작·채점·신호
    controls, compose, resolveShot, signal,
    // 함대
    allowedGroups, nextShipSize, placeableGroups, validatePlacement, addShip, fillFleet, randomFleet,
    // 판 흐름
    newGame, placeShip, finishPlacing, restartPlacing, fire, sideSummary,
    // 대결(동시 발사 라운드)
    checkShot, fireRound, roundInfo, duelOutcome,
    // 결과
    notesFor, makeRecord,
  };
})();
