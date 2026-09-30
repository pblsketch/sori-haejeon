'use strict';
// ───────────────────────────────────────────────────────────────
// 대결 모드 화면 G.duel (spec 6.3 · 6.4) — 두 팀이 전자칠판 한 대에서 '동시 발사 라운드'로 겨룬다.
//   불러오는 순서: util → data → core(rules·audio·save) → game(mouth·board·controls) → 이 파일. 모양은 css/duel.css.
//   규칙(채점·신호·준비 확인·라운드·승패·배치)은 모두 G.rules가 정한다. 이 파일은 화면과 흐름만 맡는다.
//   점검: tests/check-duel.mjs (점검용 페이지 tests/pages/duel.html)
//
// ── 쓰는 법(화면끼리의 약속) ─────────────────────────────────────────────
//   const h = G.duel.open({ resume, container })
//     container 없으면 #app. 그 안을 비우고 그린다. resume이 참이면 저장된 대결 판(G.save.loadGame)에서 이어서,
//     아니면(또는 저장된 대결 판이 없으면) 준비 화면(학년·바다·단계·숨기기 시간)부터.
//   h.destroy()   타이머·판·단면도·조작부를 모두 치우고 그린 것을 지운다(G.app.go가 부름).
//   판이 끝나면 두 바다의 남은 배를 공개하고 잠시 뒤(또는 화면을 누르면) G.app.finishGame(판 상태).
//   '처음으로'·'뒤로' → G.app.go('title'). 단, 남은 배를 공개하는 동안의 '처음으로'는 판을 잃지 않게
//   곧바로 G.app.finishGame(판 상태)를 부른다(결과 화면으로 감).
//
// ── 흐름 ────────────────────────────────────────────────────────────────
//   준비 → (숨기기 시간 끔) 무작위 함대 → 대결
//        → (숨기기 시간 켬) 가림(청) → 청팀 배치 30초 → 가림(홍) → 홍팀 배치 30초 → 가림(다 숨김) → 대결
//   배치: 그 팀의 바다만(소리·줄 이름 보임), 큰 배부터, 놓을 수 있는 묶음만 누름. 다 놓으면 저절로 다음,
//         '다 놓았어요'나 30초가 지나면 남은 배는 G.rules.finishPlacing이 채운다.
//         배치 도중 새로고침하면 G.save가 배치를 버리고 청팀 배치부터 다시 하는 판으로 저장해 두었으므로 처음부터.
//   대결(동시 발사 라운드, spec 6.3): 화면 왼쪽 절반 = 청팀 자리, 오른쪽 절반 = 홍팀 자리(거울 배치).
//         자리마다 쏘는 바다(상대 팀 바다, 판 위 이름표 TEXT.duel.target) · 단면도 · 조작부 · 한 줄 문구가 따로 있다.
//         두 팀이 동시에 소리를 빚고 '준비'(G.rules.checkShot) — 이번 바다에 없는 칸·이미 쏜 소리면 그 자리에
//         한 줄로 알리고 준비되지 않는다. 준비한 팀은 상대가 준비하기 전까지 다시 눌러 준비를 풀 수 있다.
//         둘 다 준비 → 3·2·1 "소리 내어 외치고 발사!" → 두 단면도의 공기 흐름을 함께 재생 → G.rules.fireRound →
//         두 판·신호 줄·효과음(발사 한 번, 이어서 결과 소리) → 저장 → 다음 라운드(고른 것·준비는 풀림).
//         라운드 도중 고르던 것·준비 상태는 저장하지 않는다(이어서 하기는 끝난 라운드까지).
//   여러 손가락: 팀 자리마다 포인터를 따로 받아(pointerdown/pointerup, pointerId별) 두 팀이 동시에 눌러도
//         서로 막지 않는다. 문서 전체를 막는 preventDefault나 포인터 하나만 받는 잠금은 두지 않는다.
//
// ── 세로 화면 ───────────────────────────────────────────────────────────
//   세로 배치(휴대폰·세로 태블릿)나 높이가 너무 낮은 가로 화면에서는 대결을 하지 않는다: 화면 전체를 덮는
//   한 줄 안내(TEXT.duel.phoneNotice)와 '처음으로' 단추만 보인다. 가로로 돌리면 안내가 걷힌다.
//
// ── 점검용(게임 화면에는 드러나지 않음) ──────────────────────────────────
//   G.duel.config   { placeSeconds: 30, endDelay, autoFillShow, fullDelay, countStep, clickGuard } — 점검이 시간을 줄일 때 바꾼다.
//   G.duel.current  지금 열린 핸들. h.debug = { state(현재 판), screen(), phase(), ctls, mouths, boards, station(팀),
//                   compose(팀, 조합), ready(팀) → 눌렀는지, round(청 조합, 홍 조합) → 그 라운드가 끝나면 풀리는 Promise,
//                   whenRound() → 지금(마지막) 라운드 Promise }
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
    countStep: 700,    // 3·2·1 셈의 한 걸음(ms)
    clickGuard: 700,   // 포인터로 누른 단추에 뒤따라오는 브라우저 click을 삼키는 시간(ms)
  };
  const TEAMS = ['blue', 'red'];
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
    let onHome = null; // 대결 화면이 끝을 보여 주는 동안: '처음으로' → 곧바로 결과(판을 잃지 않게)
    const homeBtn = () => el('button', { type: 'button', class: 'duel-home', onclick: () => { if (onHome && onHome()) return; goTitle(); } }, T.ui.play.home);
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
    let play = null;     // 대결 화면의 부품 { boards, mouths, ctls, st, … }

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
      onHome = null;
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

    // ══ 대결 화면(동시 발사 라운드) ═══════════════════════════
    //   왼쪽 절반 = 청팀 자리(청팀이 쏘는 홍팀 바다 · 청팀 단면도 · 청팀 조작부), 오른쪽 절반 = 홍팀 자리(거울처럼).
    //   자리마다 따로: 소리 빚기 → '준비'(G.rules.checkShot) → 둘 다 준비 → 3·2·1 → 두 단면도 함께 재생 →
    //   G.rules.fireRound → 두 판·신호 줄·효과음 → 저장 → 다음 라운드.
    function showPlay() {
      clear('play');
      const lv = G.rules.level(state.sea, state.level);
      const vowel = state.sea === 'vowel';
      let phase = 'compose'; // 'compose'(두 팀이 빚는 중) | 'count'(3·2·1) | 'fire'(발사·채점) | 'over'
      let roundDone = Promise.resolve();

      // 위 띠: 청팀(찾을 배·남은 라운드) · 제목·라운드 · 홍팀
      const side = {};
      TEAMS.forEach((t) => {
        side[t] = {
          rounds: el('span', { class: 'duel-rounds' }),
          badge: el('span', { class: 'duel-badge', 'aria-hidden': 'true' }, T.duel.readyBadge),
          ships: el('div', { class: 'duel-ships' }),
        };
        side[t].el = el('section', { class: 'duel-side side-' + t, 'data-team': t }, [
          el('div', { class: 'duel-side-head' }, [
            el('span', { class: 'duel-team' }, T.teams[t]),
            el('span', { class: 'duel-side-sub' }, [side[t].rounds, side[t].badge]),
          ]),
          side[t].ships,
        ]);
      });
      const roundEl = el('div', { class: 'duel-round', role: 'status' });
      const top = el('header', { class: 'duel-top' }, [
        side.blue.el,
        el('div', { class: 'duel-center' }, [
          el('div', { class: 'duel-titlerow' }, [el('h1', { class: 'duel-title' }, T.ui.title), homeBtn()]),
          roundEl,
        ]),
        side.red.el,
      ]);

      // 팀 자리 하나 만들기
      const st = {};
      function station(t) {
        const boardEl = el('div', { class: 'duel-board' });
        const nameEl = el('div', { class: 'duel-sea-name name-' + t }, T.duel.target[t]);
        const sea = el('section', { class: 'duel-sea' }, [boardEl]);
        const mouthEl = el('div', { class: 'duel-mouth' });
        const body = el('div', { class: 'duel-st-body' }, t === 'blue' ? [sea, mouthEl] : [mouthEl, sea]);
        const dock = el('div', { class: 'duel-st-dock' });
        const node = el('section', { class: 'duel-station station-' + t, 'data-team': t, 'aria-label': T.teams[t] }, [body, dock]);
        const s = { team: t, el: node, ready: false, input: null };
        s.board = G.board.create(boardEl, { sea: state.sea, level: lv, grade: state.grade, mode: 'play', fitHeight: true, shipsEl: side[t].ships, shooter: t, team: t });
        s.board.el.appendChild(nameEl); // 이름표는 판 바로 위에 붙인다(판이 가운데로 가도 따라감)
        s.mouth = G.mouth.create(mouthEl, {
          sea: state.sea, grade: state.grade, showNames: !!(lv.show && lv.show.placeNames),
          onPick: (id) => {
            if (phase !== 'compose' || s.ready) { syncMouth(s); return; }
            s.ctl.setPlace(id);
          },
        });
        s.ctl = G.controls.create(dock, {
          levelConfig: lv, grade: state.grade, mode: 'duel', layout: 'landscape',
          onFire: (input) => onReady(s, input),
          onChange: () => { syncMouth(s); drawReady(s); },
        });
        // '준비' 단추: 조작부의 발사 단추 자리(조작부의 발사 단추는 대결에서 숨긴다 — css/duel.css)
        s.readyBtn = el('button', { type: 'button', class: 'duel-ready', 'aria-pressed': 'false', onclick: () => toggleReady(s) }, T.duel.ready);
        (s.ctl.el.querySelector('.ctl-bar') || s.ctl.el).appendChild(s.readyBtn);
        parts.push(s.board, s.mouth, s.ctl);
        bindTaps(node);
        return s;
      }
      st.blue = station('blue');
      st.red = station('red');
      const count = el('div', { class: 'duel-count', 'aria-live': 'assertive' });
      const halves = el('main', { class: 'duel-halves' }, [st.blue.el, st.red.el]);
      stage.appendChild(el('div', { class: 'duel-play' }, [top, halves, count]));
      play = { boards: { blue: st.blue.board, red: st.red.board }, mouths: { blue: st.blue.mouth, red: st.red.mouth }, ctls: { blue: st.blue.ctl, red: st.red.ctl }, st };

      // 여러 손가락: 팀 자리마다 포인터를 따로 받는다. 누른 단추에서 뗀 포인터마다 그 단추를 누른 것으로 친다
      //   (한 손가락이 눌린 동안 다른 손가락의 탭이 click으로 오지 않는 브라우저가 있어서). 뒤따라오는 브라우저의
      //   click은 한 번 삼킨다. 문서 전체를 막거나 포인터 하나만 받는 잠금은 두지 않는다.
      function bindTaps(zone) {
        const downs = new Map(); // pointerId → 누른 단추
        const done = new Map();  // 단추 → 우리가 누른 때(뒤따르는 click 삼키기)
        let synth = false;
        const btnOf = (n) => (n && n.closest ? n.closest('button') : null);
        zone.addEventListener('pointerdown', (e) => {
          const b = btnOf(e.target);
          if (b && zone.contains(b)) downs.set(e.pointerId, b);
        });
        zone.addEventListener('pointerup', (e) => {
          const b = downs.get(e.pointerId);
          downs.delete(e.pointerId);
          if (!b || b.disabled || destroyed) return;
          const hit = (e.clientX || e.clientY) && document.elementFromPoint ? document.elementFromPoint(e.clientX, e.clientY) : e.target;
          if (btnOf(hit) !== b) return; // 단추 밖에서 뗌
          done.set(b, Date.now());
          synth = true;
          try { b.click(); } finally { synth = false; }
        });
        zone.addEventListener('pointercancel', (e) => { downs.delete(e.pointerId); });
        zone.addEventListener('click', (e) => {
          if (synth) return;
          const b = btnOf(e.target);
          const at = b && done.get(b);
          if (at && Date.now() - at < config.clickGuard) { done.delete(b); e.stopPropagation(); e.preventDefault(); }
        }, true);
      }

      // 단면도를 그 팀 조작부의 고른 것에 맞춘다
      function syncMouth(s) {
        const sel = s.ctl.getSelection(), cs = s.ctl.getState();
        if (vowel) {
          s.mouth.select(sel.backness && sel.height ? sel.backness + '-' + sel.height : null);
          s.mouth.setLips(sel.lips || null);
        } else {
          s.mouth.select(sel.place || null);
          s.mouth.setManner(sel.manner || null);
          s.mouth.setStrength(cs.strengthCards && !cs.strengthDisabled ? sel.strength || null : null);
        }
      }
      // '준비' 단추 · 팀 자리 모양
      function drawReady(s) {
        const can = phase === 'compose' && (s.ready || s.ctl.getState().fireEnabled);
        s.readyBtn.disabled = !can;
        s.readyBtn.textContent = s.ready ? T.duel.unready : T.duel.ready;
        s.readyBtn.setAttribute('aria-pressed', s.ready ? 'true' : 'false');
        s.readyBtn.classList.toggle('is-ready', s.ready);
        s.el.classList.toggle('is-ready', s.ready);
        side[s.team].el.classList.toggle('is-ready', s.ready);
      }
      function drawTop() {
        const info = G.rules.roundInfo(state);
        TEAMS.forEach((t) => { side[t].rounds.textContent = G.text.fill(T.duel.roundsLeft, { n: info.left }); });
        if (state.phase === 'over' && state.result) {
          const w = state.result.winner;
          roundEl.textContent = T.ui.result.winner[w || 'draw'];
          roundEl.setAttribute('data-team', w || 'draw');
        } else {
          roundEl.textContent = G.text.fill(T.duel.round, { n: info.number });
          roundEl.setAttribute('data-team', '');
        }
      }

      // '준비' 누름: 준비 안 됨 → 조작부의 발사(잠금 + 조합) → onReady / 준비됨 → 풀기(상대가 아직이면)
      function toggleReady(s) {
        if (phase !== 'compose' || destroyed) return;
        if (s.ready) { unready(s); return; }
        s.ctl.fire(); // 쏠 수 있게 골랐으면 조작부가 잠기고 onFire(조합)가 불린다
      }
      function onReady(s, input) {
        if (phase !== 'compose' || destroyed) { s.ctl.setEnabled(phase === 'compose'); return; }
        let c;
        try { c = G.rules.checkShot(state, s.team, input); } catch (e) { s.ctl.setEnabled(true); drawReady(s); return; }
        if (!c.ok) { // 이번 바다에 없는 칸 · 이미 쏜 소리: 한 줄로 알리고 준비되지 않는다(고른 것은 그대로)
          s.ctl.setEnabled(true);
          s.ctl.setMessage(G.text.signal(c.kind));
          drawReady(s);
          return;
        }
        s.ready = true;
        s.input = input;
        s.ctl.setMessage(T.duel.waiting);
        drawReady(s);
        if (st.blue.ready && st.red.ready) startCount();
      }
      function unready(s) {
        s.ready = false;
        s.input = null;
        s.ctl.setEnabled(true);
        s.ctl.setMessage(null);
        drawReady(s);
      }

      // 둘 다 준비 → 3·2·1 "소리 내어 외치고 발사!" → 동시 발사
      function startCount() {
        phase = 'count';
        TEAMS.forEach((t) => drawReady(st[t]));
        let resolveRound;
        roundDone = new Promise((r) => { resolveRound = r; });
        let n = 3;
        const show = () => {
          count.textContent = '';
          count.appendChild(el('span', { class: 'duel-count-n' }, String(n)));
          count.appendChild(el('span', { class: 'duel-count-text' }, T.duel.shout));
          count.classList.add('is-on');
          count.setAttribute('data-n', String(n));
        };
        const step = () => {
          n -= 1;
          if (n > 0) { show(); later(step, config.countStep); return; }
          count.classList.remove('is-on');
          count.textContent = '';
          fireRound().then(resolveRound, resolveRound);
        };
        show();
        later(step, config.countStep);
      }

      async function fireRound() {
        phase = 'fire';
        const inputs = { blue: st.blue.input, red: st.red.input };
        let r;
        try { r = G.rules.fireRound(state, inputs); } catch (e) { // 준비가 어긋남(생기지 않아야 함) → 다시 준비
          phase = 'compose';
          TEAMS.forEach((t) => unready(st[t]));
          return;
        }
        sfx('fire');
        TEAMS.forEach((t) => st[t].ctl.setMessage(T.duel.shout));
        try { await Promise.all(TEAMS.map((t) => st[t].mouth.play(inputs[t]))); } catch (e) { /* 그림이 멈춰도 채점은 이어 간다 */ }
        if (destroyed || !play) return;
        state = r.state;
        const names = [];
        TEAMS.forEach((t) => {
          const o = r.outcomes[t];
          st[t].board.update(state);
          const shots = state.teams[t].shots;
          st[t].ctl.log(shots[shots.length - 1]);
          st[t].ctl.setMessage(o.sunk ? G.text.sunk(o.sunk) : G.text.signal(o.kind));
          const name = o.sunk ? 'sunk' : o.kind === 'hit' ? 'hit' : o.kind === 'none' ? 'dud' : 'miss';
          if (names.indexOf(name) < 0) names.push(name);
        });
        names.forEach(sfx);
        save(); // 끝난 판이면 G.save가 진행 판을 지운다(결과는 finishGame이 남김)
        drawTop();
        if (r.over) { endGame(); return; }
        // 다음 라운드: 고른 것·준비를 풀고(신호 줄은 다음에 고를 때까지 남김) 곧바로 시작
        phase = 'compose';
        TEAMS.forEach((t) => {
          const s = st[t];
          s.ready = false; s.input = null;
          s.ctl.reset();
          s.ctl.setEnabled(true);
          syncMouth(s);
          drawReady(s);
        });
      }

      // 끝: 두 바다의 남은 배 공개 → 잠시 뒤(또는 화면을 누르면, '처음으로'를 누르면) 결과
      let finished = false;
      function finish() {
        if (finished || destroyed) return;
        finished = true;
        if (G.app && typeof G.app.finishGame === 'function') G.app.finishGame(state);
      }
      function endGame() {
        phase = 'over';
        screen = 'over';
        root.setAttribute('data-screen', 'over');
        TEAMS.forEach((t) => {
          const s = st[t];
          s.ready = false;
          s.ctl.setEnabled(false);
          s.board.setActive(false);
          drawReady(s);
        });
        st.blue.board.revealFleet(state.teams.red.fleet);
        st.red.board.revealFleet(state.teams.blue.fleet);
        drawTop();
        later(finish, config.endDelay);
        later(() => root.addEventListener('pointerup', (ev) => {
          if (ev && ev.target && ev.target.closest && ev.target.closest('.duel-home')) return; // '처음으로'는 그 단추가 맡는다
          finish();
        }), 600);
      }
      onHome = () => { if (phase === 'over' && !finished) { finish(); return true; } return false; };

      // 되살리기(이어서 하기): 판·기록장·라운드를 저장된 판 그대로(고르던 것·준비는 되살리지 않음)
      TEAMS.forEach((t) => {
        const s = st[t];
        s.board.render(state);
        s.board.setActive(true);
        s.ctl.setLog(state.teams[t].shots);
        syncMouth(s);
        drawReady(s);
      });
      drawTop();
      if (state.phase === 'over') endGame();

      play.whenRound = () => roundDone;
      play.phase = () => phase;
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
        phase: () => (play && play.phase ? play.phase() : ''),
        get ctls() { return play && play.ctls; },
        get mouths() { return play && play.mouths; },
        get boards() { return play && play.boards; },
        station: (t) => (play && play.st ? play.st[t].el : null),
        // 그 팀 조작부로 고르기(단면도도 따라감)
        compose(t, input) { if (play) play.ctls[t].setSelection(input); },
        // 그 팀의 '준비' 단추 누르기 → 눌렸으면 true
        ready(t) { const b = play && play.st[t].readyBtn; if (!b || b.disabled) return false; b.click(); return true; },
        // 두 팀이 고르고 준비 → 그 라운드가 끝나면(다음 라운드 준비 또는 끝) 풀림
        round(blue, red) {
          if (!play) return Promise.resolve(false);
          this.compose('blue', blue); this.ready('blue');
          this.compose('red', red); this.ready('red');
          return play.whenRound();
        },
        whenRound: () => (play && play.whenRound ? play.whenRound() : Promise.resolve()),
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
