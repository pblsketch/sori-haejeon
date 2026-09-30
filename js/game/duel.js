'use strict';
// ───────────────────────────────────────────────────────────────
// 대결 모드 화면 G.duel (spec 6.3 · 6.4) — 두 팀이 전자칠판 한 대에서 번갈아 한 발씩 쏜다.
//   불러오는 순서: util → data → core(rules·audio·save) → game(mouth·board·controls) → 이 파일. 모양은 css/duel.css.
//   규칙(채점·신호·차례·승패·배치)은 모두 G.rules가 정한다. 이 파일은 화면과 흐름만 맡는다.
//   점검: tests/check-duel.mjs (점검용 페이지 tests/pages/duel.html)
//
// ── 쓰는 법(화면끼리의 약속) ─────────────────────────────────────────────
//   const h = G.duel.open({ resume, container })
//     container 없으면 #app. 그 안을 비우고 그린다. resume이 참이면 저장된 대결 판(G.save.loadGame)에서 이어서,
//     아니면(또는 저장된 대결 판이 없으면) 준비 화면(학년·바다·단계·숨기기 시간)부터.
//   h.destroy()   타이머·판·단면도·조작부를 모두 치우고 그린 것을 지운다(G.app.go가 부름).
//   판이 끝나면 두 바다의 남은 배를 공개하고 잠시 뒤(또는 화면을 누르면) G.app.finishGame(판 상태).
//   '처음으로'·'뒤로' → G.app.go('title').
//
// ── 흐름 ────────────────────────────────────────────────────────────────
//   준비 → (숨기기 시간 끔) 무작위 함대 → 대결
//        → (숨기기 시간 켬) 가림(청) → 청팀 배치 30초 → 가림(홍) → 홍팀 배치 30초 → 가림(다 숨김) → 대결
//   배치: 그 팀의 바다만(소리·줄 이름 보임), 큰 배부터, 놓을 수 있는 묶음만 누름. 다 놓으면 저절로 다음,
//         '다 놓았어요'나 30초가 지나면 남은 배는 G.rules.finishPlacing이 채운다.
//         배치 도중 새로고침하면 G.save가 배치를 버리고 청팀 배치부터 다시 하는 판으로 저장해 두었으므로 처음부터.
//   대결: 청팀부터 한 발씩(G.rules.whoseTurn). 턴을 쓰지 않는 결과(이번 바다에 없는 칸·이미 쏜 소리)는 차례 유지.
//         선공이 먼저 다 찾으면 후공의 마지막 한 발(G.rules.isLastShot) — 위 띠에 한 줄로 알린다. 매 발 뒤 저장.
//
// ── 세로 화면 ───────────────────────────────────────────────────────────
//   세로 배치(휴대폰·세로 태블릿)나 높이가 너무 낮은 가로 화면에서는 대결을 하지 않는다: 화면 전체를 덮는
//   한 줄 안내(TEXT.duel.phoneNotice)와 '처음으로' 단추만 보인다. 가로로 돌리면 안내가 걷힌다.
//
// ── 점검용(게임 화면에는 드러나지 않음) ──────────────────────────────────
//   G.duel.config   { placeSeconds: 30, endDelay, autoFillShow, fullDelay } — 점검이 시간을 줄일 때 바꾼다.
//   G.duel.current  지금 열린 핸들. h.debug = { state(현재 판), screen(), ctl, mouth, boards, fire(조합) → Promise }
//   뿌리 요소 .duel 의 data-screen: 'setup' | 'gate' | 'placing' | 'play' | 'over'
// ───────────────────────────────────────────────────────────────
window.G = window.G || {};
G.duel = (function () {
  // 세로 배치 기준(base.css·controls.js와 같음) + 높이가 너무 낮은 가로 화면
  const PHONE_MQ = '(max-width: 760px), (orientation: portrait), (max-height: 500px) and (orientation: landscape)';
  const config = {
    placeSeconds: 30,  // 팀마다 배를 숨기는 시간(초)
    endDelay: 4000,    // 판이 끝나고 남은 배를 보여 주는 시간(ms). 화면을 누르면 바로 결과로
    autoFillShow: 1500, // 남은 배를 대신 숨겼다는 한 줄을 보여 주는 시간(ms)
    fullDelay: 700,    // 배를 다 놓은 뒤 다음으로 넘어가기 전 잠깐(ms)
  };
  const TEAMS = ['blue', 'red'];
  const other = (t) => (t === 'blue' ? 'red' : 'blue');
  let current = null;

  function open(params) {
    params = params || {};
    if (current) current.destroy();
    const U = G.util, T = window.TEXT;
    const el = (...a) => U.el(...a);
    const container = params.container || document.getElementById('app');
    container.textContent = '';

    const root = el('div', { class: 'duel', 'data-screen': '' });
    const stage = el('div', { class: 'duel-stage' });
    const homeBtn = () => el('button', { type: 'button', class: 'duel-home', onclick: () => goTitle() }, T.ui.play.home);
    const phone = el('div', { class: 'duel-phone', role: 'alert' }, [
      el('p', { class: 'duel-phone-text' }, T.duel.phoneNotice),
      el('button', { type: 'button', class: 'duel-btn duel-phone-home', onclick: () => goTitle() }, T.ui.play.home),
    ]);
    root.appendChild(stage);
    root.appendChild(phone);
    container.appendChild(root);

    let destroyed = false;
    let screen = '';
    let state = null;
    let parts = [];      // 이 화면에서 만든 것(destroy 할 것)
    let timers = [];     // 이 화면의 타이머
    let ticks = [];      // 이 화면의 setInterval
    let lastFire = Promise.resolve();
    let play = null;     // 대결 화면의 부품 { boards, mouth, ctl, … }

    // ── 세로 화면 안내 ──
    const mq = window.matchMedia ? window.matchMedia(PHONE_MQ) : null;
    const applyPhone = () => root.classList.toggle('is-phone', !!(mq && mq.matches));
    if (mq) (mq.addEventListener ? mq.addEventListener('change', applyPhone) : mq.addListener(applyPhone));
    applyPhone();

    function later(fn, ms) { const id = setTimeout(() => { if (!destroyed) fn(); }, ms); timers.push(id); return id; }
    function goTitle() { if (!destroyed && G.app && typeof G.app.go === 'function') G.app.go('title'); }
    function sfx(name) { try { if (G.audio) G.audio.sfx(name); } catch (e) { /* 소리가 안 나도 게임은 돈다 */ } }
    function save() { try { G.save.saveGame(state); } catch (e) { /* 저장이 막혀도 게임은 돈다 */ } }

    // 지금 화면을 치우고 새 화면 이름을 단다
    function clear(name) {
      timers.forEach(clearTimeout); timers = [];
      ticks.forEach(clearInterval); ticks = [];
      parts.forEach((p) => { try { p.destroy(); } catch (e) { /* 이미 치움 */ } });
      parts = [];
      play = null;
      stage.textContent = '';
      stage.className = 'duel-stage';
      screen = name;
      root.setAttribute('data-screen', name);
      root.removeAttribute('data-turn');
      root.removeAttribute('data-gate');
    }

    try { if (G.audio) G.audio.play('duel'); } catch (e) { /* 소리 없음 */ }

    // ══ 준비 화면 ═══════════════════════════════════════════════
    function showSetup() {
      clear('setup');
      const S = T.ui.setup;
      const sel = Object.assign({ grade: 'm3', sea: 'consonant', level: 1, hideTime: false }, G.save.getSelection());
      const levelsOf = (sea) => Object.keys(window.LEVELS[sea]).map(Number).sort((a, b) => a - b);
      if (levelsOf(sel.sea).indexOf(+sel.level) < 0) sel.level = 1;

      const box = el('div', { class: 'duel-setup' });
      const groupsEl = el('div', { class: 'duel-setup-groups' });
      // 고르기 한 줄: [이름] [단추들]
      function seg(key, label, options) {
        const btns = options.map((o) => el('button', {
          type: 'button', class: 'duel-opt', 'data-group': key, 'data-value': String(o.value),
          onclick: () => { sel[key] = o.value; if (key === 'sea' && levelsOf(sel.sea).indexOf(+sel.level) < 0) sel.level = 1; draw(); },
        }, [el('span', { class: 'duel-opt-name' }, o.label), o.sub ? el('span', { class: 'duel-opt-sub' }, o.sub) : null]));
        return el('div', { class: 'duel-seg', role: 'group', 'aria-label': label }, [
          el('span', { class: 'duel-seg-label' }, label),
          el('div', { class: 'duel-seg-opts' }, btns),
        ]);
      }
      function draw() {
        groupsEl.textContent = '';
        groupsEl.appendChild(seg('grade', S.grade, ['m3', 'h1'].map((g) => ({ value: g, label: T.gradeNames[g] }))));
        groupsEl.appendChild(seg('sea', S.sea, ['consonant', 'vowel'].map((s) => ({ value: s, label: T.seaNames[s] }))));
        groupsEl.appendChild(seg('level', S.level, levelsOf(sel.sea).map((n) => ({
          value: n, label: G.text.fill(S.levelN, { n }), sub: (T.levelNames[sel.sea] || {})[n] || '',
        }))));
        groupsEl.appendChild(seg('hideTime', S.hideTime, [{ value: true, label: S.on }, { value: false, label: S.off }]));
        groupsEl.querySelectorAll('.duel-opt').forEach((b) => {
          const k = b.getAttribute('data-group');
          const on = String(sel[k]) === b.getAttribute('data-value');
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }
      draw();
      box.appendChild(el('h1', { class: 'duel-h' }, [el('span', { class: 'duel-h-game' }, T.ui.title), ' ', el('span', {}, T.ui.menu.duel)]));
      box.appendChild(groupsEl);
      box.appendChild(el('div', { class: 'duel-actions' }, [
        el('button', { type: 'button', class: 'duel-btn duel-back', onclick: () => goTitle() }, S.back),
        el('button', { type: 'button', class: 'duel-btn duel-btn--main duel-start', onclick: () => start(sel) }, S.start),
      ]));
      stage.appendChild(box);
    }

    function start(sel) {
      G.save.setSelection({ grade: sel.grade, sea: sel.sea, level: +sel.level, hideTime: !!sel.hideTime });
      state = G.rules.newGame({ mode: 'duel', grade: sel.grade, sea: sel.sea, level: +sel.level, hideTime: !!sel.hideTime });
      state.id = G.save.newGameId();
      save(); // 새 판이 옛 진행 판을 덮는다(배치 중이면 배치 처음부터 하는 판으로 저장됨)
      if (state.phase === 'placing') showGate('blue', showPlacing);
      else showPlay();
    }

    // ══ 가림 화면 ═══════════════════════════════════════════════
    //   kind: 'blue' | 'red' (그 팀이 배를 숨길 차례, 상대는 뒤돌기) | 'allDone' (다 숨김, 모두 앞을 봄)
    function showGate(kind, next) {
      clear('gate');
      stage.classList.add('is-gate', 'gate-' + kind);
      root.setAttribute('data-gate', kind);
      let gone = false;
      const go = () => { if (gone) return; gone = true; root.removeAttribute('data-gate'); next(); };
      stage.appendChild(el('div', { class: 'duel-gate' }, [
        el('p', { class: 'duel-gate-text' }, T.duel.gate[kind]),
        el('button', { type: 'button', class: 'duel-btn duel-btn--main duel-gate-go', onclick: go }, T.duel.gate.button),
      ]));
      stage.appendChild(el('div', { class: 'duel-corner' }, homeBtn()));
    }

    // ══ 숨기기 시간: 한 팀의 배치 ══════════════════════════════
    function showPlacing() {
      clear('placing');
      const team = state.placingTeam;
      const lv = G.rules.level(state.sea, state.level);
      stage.classList.add('team-' + team);
      root.setAttribute('data-turn', team);
      let ending = false;

      const timerEl = el('div', { class: 'duel-timer', 'aria-live': 'off' });
      const lineEl = el('p', { class: 'duel-line', role: 'status' });
      const seaEl = el('div', { class: 'duel-place-sea' });
      const doneBtn = el('button', { type: 'button', class: 'duel-btn duel-btn--main duel-done', onclick: () => endPlacing() }, T.duel.hide.done);
      stage.appendChild(el('div', { class: 'duel-placing' }, [
        el('header', { class: 'duel-place-head' }, [
          el('h1', { class: 'duel-place-title' }, T.duel.hide.title[team]),
          timerEl,
          homeBtn(),
        ]),
        seaEl,
        el('footer', { class: 'duel-place-foot' }, [lineEl, doneBtn]),
      ]));

      const board = G.board.create(seaEl, {
        sea: state.sea, level: lv, grade: state.grade, mode: 'place', fitHeight: true, team,
        onPick: (group) => pick(group),
      });
      parts.push(board);
      board.setActive(true);

      const fleetNow = () => state.teams[team].fleet;
      function refresh() {
        board.setPlaced(fleetNow());
        board.setPlaceable(ending ? [] : G.rules.placeableGroups(lv, fleetNow()));
        const size = G.rules.nextShipSize(lv, fleetNow());
        lineEl.textContent = size != null && !ending ? G.text.fill(T.duel.hide.place, { ship: G.text.shipName(size) }) : '';
      }
      function pick(group) {
        if (ending || destroyed) return;
        try { state = G.rules.placeShip(state, group); } catch (e) { return; } // 놓을 수 없는 묶음은 무시
        refresh();
        if (G.rules.nextShipSize(lv, fleetNow()) == null) { // 다 놓음 → 잠깐 보여 주고 다음으로
          ending = true;
          refresh();
          doneBtn.disabled = true;
          later(() => endPlacing(true), config.fullDelay);
        }
      }
      // 끝내기('다 놓았어요' · 시간 초과 · 다 놓음): 남은 배는 게임이 채운다
      function endPlacing(force) {
        if (screen !== 'placing' || (ending && !force)) return;
        ending = true;
        ticks.forEach(clearInterval); ticks = [];
        doneBtn.disabled = true;
        const before = fleetNow().length;
        state = G.rules.finishPlacing(state);
        const filled = state.teams[team].fleet;
        board.setPlaced(filled);
        board.setPlaceable([]);
        const next = () => {
          save(); // 홍팀 배치가 남았으면 G.save가 '청팀 배치부터 다시'로 저장, 다 끝났으면 대결 판을 저장
          if (state.phase === 'placing') showGate(state.placingTeam, showPlacing);
          else showGate('allDone', showPlay);
        };
        if (filled.length > before) { // 대신 숨긴 배가 있음 → 한 줄로 알리고 넘어감
          lineEl.textContent = T.duel.hide.autoFilled;
          later(next, config.autoFillShow);
        } else next();
      }
      // 남은 시간
      const deadline = Date.now() + Math.max(0, +config.placeSeconds || 0) * 1000;
      const tick = () => {
        const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        timerEl.textContent = G.text.fill(T.duel.hide.timer, { n: left });
        timerEl.classList.toggle('is-low', left <= 5);
        if (Date.now() >= deadline && !ending) endPlacing();
      };
      ticks.push(setInterval(() => { if (!destroyed) tick(); }, 200));
      refresh();
      tick();
    }

    // ══ 대결 화면 ═══════════════════════════════════════════════
    function showPlay() {
      clear('play');
      const lv = G.rules.level(state.sea, state.level);
      let busy = false;

      // 위 띠: 청팀(왼쪽 바다를 쏨) · 제목 · 홍팀(오른쪽 바다를 쏨)
      const side = {};
      TEAMS.forEach((t) => {
        side[t] = {
          turns: el('span', { class: 'duel-turns' }),
          ships: el('div', { class: 'duel-ships' }),
        };
        side[t].el = el('section', { class: 'duel-side side-' + t, 'data-team': t }, [
          el('div', { class: 'duel-side-head' }, [el('span', { class: 'duel-team' }, T.teams[t]), side[t].turns]),
          side[t].ships,
        ]);
      });
      const turnEl = el('div', { class: 'duel-turn', role: 'status' });
      const top = el('header', { class: 'duel-top' }, [
        side.blue.el,
        el('div', { class: 'duel-center' }, [
          el('div', { class: 'duel-titlerow' }, [el('h1', { class: 'duel-title' }, T.ui.title), homeBtn()]),
          turnEl,
        ]),
        side.red.el,
      ]);
      // 가운데: 왼쪽 = 홍팀 바다(청팀이 쏨) · 단면도 · 오른쪽 = 청팀 바다(홍팀이 쏨)
      const seaCol = (shooter) => {
        const owner = other(shooter);
        const boardEl = el('div', { class: 'duel-board' });
        const col = el('section', { class: 'duel-sea sea-' + (shooter === 'blue' ? 'left' : 'right'), 'data-shooter': shooter }, [boardEl]);
        // 바다 이름은 판 바로 위에 붙인다(판을 만든 뒤 판 뿌리 안에 넣음 — 판이 가운데로 가도 이름이 따라감)
        const nameEl = el('div', { class: 'duel-sea-name name-' + owner }, T.teams[owner] + ' ' + T.seaNames[state.sea]);
        return { col, boardEl, nameEl };
      };
      const left = seaCol('blue'), right = seaCol('red');
      const mouthEl = el('div', { class: 'duel-mouth' });
      const legendEl = el('div', { class: 'duel-legend' });
      const mid = el('main', { class: 'duel-mid' }, [left.col, el('section', { class: 'duel-mouthcol' }, [mouthEl, legendEl]), right.col]);
      const dock = el('footer', { class: 'duel-dock' });
      stage.appendChild(el('div', { class: 'duel-play' }, [top, mid, dock]));

      const boards = {
        blue: G.board.create(left.boardEl, { sea: state.sea, level: lv, grade: state.grade, mode: 'play', fitHeight: true, shipsEl: side.blue.ships, shooter: 'blue', team: 'blue' }),
        red: G.board.create(right.boardEl, { sea: state.sea, level: lv, grade: state.grade, mode: 'play', fitHeight: true, shipsEl: side.red.ships, shooter: 'red', team: 'red' }),
      };
      boards.blue.el.appendChild(left.nameEl);
      boards.red.el.appendChild(right.nameEl);
      parts.push(boards.blue, boards.red);
      parts.push(G.board.legend(legendEl, { sea: state.sea }));

      const vowel = state.sea === 'vowel';
      const mouth = G.mouth.create(mouthEl, {
        sea: state.sea, grade: state.grade, showNames: !!(lv.show && lv.show.placeNames),
        onPick: (id) => {
          if (busy || state.phase !== 'playing') { syncMouth(); return; }
          ctl.setPlace(id);
        },
      });
      parts.push(mouth);
      const ctl = G.controls.create(dock, {
        levelConfig: lv, grade: state.grade, mode: 'duel', layout: 'landscape',
        onFire: (input) => { lastFire = fire(input); },
        onChange: () => syncMouth(),
      });
      parts.push(ctl);
      play = { boards, mouth, ctl };

      // 단면도를 조작부의 고른 것에 맞춘다(자리·방법·세기·입술 미리 보기)
      function syncMouth() {
        const s = ctl.getSelection(), st = ctl.getState();
        if (vowel) {
          mouth.select(s.backness && s.height ? s.backness + '-' + s.height : null);
          mouth.setLips(s.lips || null);
        } else {
          mouth.select(s.place || null);
          mouth.setManner(s.manner || null);
          mouth.setStrength(st.strengthCards && !st.strengthDisabled ? s.strength || null : null);
        }
      }

      // 위 띠·차례 표시
      function drawTop() {
        TEAMS.forEach((t) => {
          const sum = G.rules.sideSummary(state, t);
          side[t].turns.textContent = T.ui.play.turnsLeft + ' ' + G.text.fill(T.ui.play.turnsN, { n: sum.turnsLeft });
        });
        const turn = G.rules.whoseTurn(state);
        TEAMS.forEach((t) => {
          boards[t].setActive(turn === t);
          side[t].el.classList.toggle('is-turn', turn === t);
        });
        if (turn) root.setAttribute('data-turn', turn); else root.removeAttribute('data-turn');
        if (state.phase === 'over' && state.result) {
          const w = state.result.winner;
          turnEl.textContent = T.ui.result.winner[w || 'draw'];
          turnEl.setAttribute('data-team', w || 'draw');
        } else if (turn) {
          turnEl.textContent = G.rules.isLastShot(state) ? T.duel.lastShot : T.duel.turn[turn];
          turnEl.setAttribute('data-team', turn);
          turnEl.classList.toggle('is-last', G.rules.isLastShot(state));
        }
      }

      // 신호 기록장: 두 팀의 쏜 기록을 쏜 순서대로(청 → 홍 번갈아)
      function logEntries() {
        const out = [], b = state.teams.blue.shots, r = state.teams.red.shots;
        for (let i = 0; i < Math.max(b.length, r.length); i++) {
          if (b[i]) out.push(Object.assign({}, b[i], { team: 'blue' }));
          if (r[i]) out.push(Object.assign({}, r[i], { team: 'red' }));
        }
        return out;
      }

      function resetSelection() {
        ctl.reset();
        syncMouth();
      }

      // 한 발: 채점(G.rules.fire) → 공기 흐름 → 판·신호 한 줄·효과음 → 저장 → 다음 차례 또는 끝
      async function fire(input) {
        if (busy || destroyed || state.phase !== 'playing') return;
        busy = true;
        let r;
        try { r = G.rules.fire(state, input); } catch (e) { busy = false; resetSelection(); return; }
        const o = r.outcome;
        if (!o.usesTurn) { // 이번 바다에 없는 칸 · 이미 쏜 소리: 턴을 쓰지 않고 차례도 그대로
          ctl.setMessage(G.text.signal(o.kind));
          resetSelection();
          busy = false;
          return;
        }
        sfx('fire');
        try { await mouth.play(input); } catch (e) { /* 그림이 멈춰도 채점은 이어 간다 */ }
        if (destroyed || !play) return;
        const shooter = o.shooter;
        state = r.state;
        boards[shooter].update(state);
        const shots = state.teams[shooter].shots;
        ctl.log(Object.assign({}, shots[shots.length - 1], { team: shooter }));
        ctl.setMessage(o.sunk ? G.text.sunk(o.sunk) : G.text.signal(o.kind));
        sfx(o.sunk ? 'sunk' : o.kind === 'hit' ? 'hit' : o.kind === 'none' ? 'dud' : 'miss');
        save(); // 끝난 판이면 G.save가 진행 판을 지운다(결과는 finishGame이 남김)
        drawTop();
        if (o.over) { endGame(); return; }
        resetSelection();
        busy = false;
      }

      // 끝: 두 바다의 남은 배 공개 → 잠시 뒤(또는 누르면) 결과
      function endGame() {
        clearToOver();
        ctl.setEnabled(false);
        boards.blue.revealFleet(state.teams.red.fleet);
        boards.red.revealFleet(state.teams.blue.fleet);
        TEAMS.forEach((t) => boards[t].setActive(false));
        drawTop();
        let done = false;
        const finish = (ev) => {
          if (done || destroyed) return;
          if (ev && ev.target && ev.target.closest && ev.target.closest('.duel-home')) return; // '처음으로'는 그 단추의 일
          done = true;
          if (G.app && typeof G.app.finishGame === 'function') G.app.finishGame(state);
        };
        later(finish, config.endDelay);
        later(() => root.addEventListener('pointerup', finish), 600); // 누르면 바로 결과로
      }
      function clearToOver() { screen = 'over'; root.setAttribute('data-screen', 'over'); }

      // 되살리기(이어서 하기): 판·기록장·차례를 저장된 판 그대로
      boards.blue.render(state);
      boards.red.render(state);
      ctl.setLog(logEntries());
      drawTop();
      if (state.phase === 'over') endGame();
    }

    // ══ 시작 ════════════════════════════════════════════════════
    let resumed = false;
    if (params.resume) {
      const saved = G.save.loadGame();
      if (saved && saved.mode === 'duel') {
        state = saved;
        resumed = true;
        if (state.phase === 'placing') showGate('blue', showPlacing); // 배치는 저장하지 않으므로 청팀부터 다시
        else showPlay();
      }
    }
    if (!resumed) showSetup();

    const handle = {
      destroy() {
        if (destroyed) return;
        clear('');
        destroyed = true;
        if (mq) (mq.removeEventListener ? mq.removeEventListener('change', applyPhone) : mq.removeListener(applyPhone));
        root.remove();
        if (current === handle) current = null;
      },
      // 점검용
      debug: {
        state: () => state,
        screen: () => screen,
        get ctl() { return play && play.ctl; },
        get mouth() { return play && play.mouth; },
        get boards() { return play && play.boards; },
        // 조작부로 고르고 발사 단추를 누른 것과 같다 → 그 발이 다 끝나면 풀리는 Promise
        fire(input) {
          if (!play) return Promise.resolve(false);
          play.ctl.setSelection(input);
          lastFire = Promise.resolve();
          play.ctl.fire();
          return lastFire;
        },
      },
    };
    current = handle;
    return handle;
  }

  return {
    open,
    config,
    get current() { return current; },
  };
})();
