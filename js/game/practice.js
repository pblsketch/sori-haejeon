'use strict';
// ───────────────────────────────────────────────────────────────
// 연습 모드 화면 G.practice (spec 6.2 · 6.4 · 4 · 5)
// ───────────────────────────────────────────────────────────────
// 불러오는 순서: util → data(sounds·fleets·levels·text·mouth) → core(rules·audio·save) → game(mouth·board·controls) → 이 파일.
// 모양은 css/practice.css. 규칙은 모두 G.rules가 정한다(여기서 채점·신호·배치를 다시 만들지 않는다).
//
// ── 쓰는 법 ─────────────────────────────────────────────────────────────
//   const h = G.practice.open({ resume, container, layout });
//     resume     참이면 G.save.loadGame()의 연습 판에서 이어서(판·기록장·남은 턴 그대로). 없거나 대결 판이면 준비 화면
//     container  그릴 곳(없으면 #app). 안을 비우고 그린다
//     layout     (점검 전용) 'portrait' | 'landscape' — 배치를 강제로. 게임에서는 쓰지 않는다(기본은 화면 크기에 따라 자동)
//   h.destroy()  화면을 치운다(G.app.go가 부른다). 진행 판은 저장된 채 남는다.
//   G.practice.debug()  (점검용) { view: 'setup'|'example'|'play'|'end'|null, busy, layout, example, state(복사본) }
//   G.practice.config   (조정값) 풀이 예시·끝 화면의 멈춤 시간(ms)
//
// ── 흐름 ─────────────────────────────────────────────────────────────────
//   준비(학년·바다·단계, 기본값 = G.save.getSelection, 시작하면 setSelection으로 기억)
//     → 자음 1단계를 이 기기에서 처음 시작하면(G.save.seenExample() 거짓) 풀이 예시를 한 번 자동으로 보여 준 뒤 일반 판
//       ('예시 보기' 단추는 언제든 다시 보여 주고 준비 화면으로 돌아온다). 예시는 저장하지 않고 기록에도 더하지 않는다.
//     → 새 판: G.rules.newGame(무작위 적 함대) + state.id = G.save.newGameId(), 곧바로 저장(옛 진행 판은 덮여 사라짐)
//     → 한 발: 단면도(자리) + 조작부(카드) → 발사 → 조작부 잠금 → 공기 흐름(mouth.play) → G.rules.fire
//              → 판 표시(board.update) · 효과음 · 한 줄 문구 · 신호 기록장 · 저장(G.save.saveGame)
//              턴을 쓰지 않는 결과(이번 바다에 없는 칸 · 이미 쏜 소리)는 그 한 줄만 보이고 턴을 쓰지 않는다
//     → 끝: 배를 모두 찾음(성공) / 턴 소진(남은 배 공개) → 잠깐 뒤 G.app.finishGame(판 상태)
//   '처음으로' → G.app.go('title') (진행 판은 저장된 채 남는다).
//
// ── 배치 ─────────────────────────────────────────────────────────────────
//   가로: 윗줄(처음으로 · 바다와 단계 · 남은 턴) / 가운데 [적 바다 + 남은 배 | 입안 단면도(가장 크게) | 신호 기록장] / 아래 가운데 조작부
//   세로(휴대폰): 윗줄(처음으로 · 남은 배 · 남은 턴) → 입안 단면도 → 적 바다 → 한 줄 문구 → 조작부 두 줄. 기록장은 접어 두고 단추로 편다.
//   기준은 조작부와 같은 (max-width: 760px), (orientation: portrait). 방향이 바뀌면 판만 다시 그린다(상태는 그대로).
//   높이가 너무 낮은 가로 화면은 '세로로 돌려 주세요'를 덮어 보인다(css/practice.css).
window.G = window.G || {};
G.practice = (function () {
  const U = G.util;
  const T = () => window.TEXT;
  const PORTRAIT_MQ = '(max-width: 760px), (orientation: portrait)';
  // 조정값(ms)
  const config = {
    exampleLead: 700,    // 풀이 예시: 고른 조합을 보여 준 뒤 쏘기까지
    examplePause: 2600,  // 풀이 예시: 한 줄을 읽을 시간
    endPause: 2200,      // 판이 끝난 뒤 결과 화면으로 가기까지
  };
  let current = null;    // 지금 열린 화면(점검용 debug가 읽음)

  const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sfx = (name) => { try { if (G.audio) G.audio.sfx(name); } catch (e) { /* 소리는 없어도 된다 */ } };

  function open(opts) {
    opts = opts || {};
    if (current) current.destroy();
    const container = opts.container || document.getElementById('app');
    container.textContent = '';
    const el = U.el;
    const TX = T();
    const forced = opts.layout === 'portrait' || opts.layout === 'landscape' ? opts.layout : null;
    const mq = window.matchMedia ? window.matchMedia(PORTRAIT_MQ) : null;
    const layoutNow = () => forced || (mq && mq.matches ? 'portrait' : 'landscape');

    let layout = layoutNow();
    let view = null;          // 'setup' | 'example' | 'play' | 'end'
    let busy = false;         // 발사 한 번이 끝나기 전(공기 흐름·판정)
    let token = 0;            // 화면이 바뀌면 늘어난다 → 늦게 끝난 비동기 흐름은 스스로 멈춘다
    let destroyed = false;
    let game = null;          // 판 화면 { state, lv, mouth, board, ctl, ... }
    const timers = [];
    const sel = G.save.getSelection(); // { grade, sea, level, hideTime }

    const root = el('div', { class: 'pr' });
    const body = el('div', { class: 'pr-body' });
    const rotate = el('div', { class: 'pr-rotate', role: 'alert' }, el('p', null, TX.rotate));
    root.appendChild(body);
    root.appendChild(rotate);
    container.appendChild(root);
    const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
    const alive = (my) => !destroyed && my === token;

    function applyLayoutClass() {
      root.classList.toggle('pr--portrait', layout === 'portrait');
      root.classList.toggle('pr--landscape', layout === 'landscape');
    }
    applyLayoutClass();

    function goHome() {
      if (G.app && typeof G.app.go === 'function') G.app.go('title');
    }
    const homeBtn = () => el('button', { type: 'button', class: 'pr-home', onclick: goHome }, TX.ui.play.home);

    // 판 화면 치우기
    function teardownGame() {
      if (!game) return;
      ['mouth', 'board', 'ctl'].forEach((k) => { try { if (game[k]) game[k].destroy(); } catch (e) { /* 이미 치움 */ } });
      game = null;
    }
    function clearBody() {
      token++;
      busy = false;
      teardownGame();
      body.textContent = '';
    }

    // ── 준비 화면 ──────────────────────────────────────────
    function showSetup() {
      clearBody();
      view = 'setup';
      const S = TX.ui.setup;
      const levelsOf = (sea) => Object.keys(window.LEVELS[sea]).map(Number).sort((a, b) => a - b);
      if (levelsOf(sel.sea).indexOf(sel.level) < 0) sel.level = 1;

      const optBtn = (key, val, label, sub) => el('button', {
        type: 'button', class: 'pr-opt', 'data-key': key, 'data-val': String(val), 'aria-pressed': 'false',
        onclick: () => { choose(key, val); },
      }, [el('span', { class: 'pr-opt-name' }, label), sub ? el('span', { class: 'pr-opt-sub' }, sub) : null]);
      const field = (label, opts2) => el('div', { class: 'pr-field', role: 'group', 'aria-label': label }, [
        el('div', { class: 'pr-field-label' }, label),
        el('div', { class: 'pr-opts' }, opts2),
      ]);
      const gradeF = field(S.grade, ['m3', 'h1'].map((g) => optBtn('grade', g, TX.gradeNames[g])));
      const seaF = field(S.sea, ['consonant', 'vowel'].map((s) => optBtn('sea', s, TX.seaNames[s])));
      const levelOpts = el('div', { class: 'pr-opts' });
      const levelF = el('div', { class: 'pr-field', role: 'group', 'aria-label': S.level }, [el('div', { class: 'pr-field-label' }, S.level), levelOpts]);
      const exampleBtn = el('button', { type: 'button', class: 'pr-example-btn', onclick: () => runExample(false) }, S.example);
      const startBtn = el('button', { type: 'button', class: 'pr-start', onclick: start }, S.start);

      function drawLevels() {
        levelOpts.textContent = '';
        levelsOf(sel.sea).forEach((n) => levelOpts.appendChild(optBtn('level', n, G.text.fill(S.levelN, { n }), TX.levelNames[sel.sea][n])));
      }
      function paint() {
        body.querySelectorAll('.pr-opt').forEach((b) => {
          const k = b.getAttribute('data-key'), v = b.getAttribute('data-val');
          const on = String(sel[k]) === v;
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.classList.toggle('is-on', on);
        });
        const lv = G.rules.level(sel.sea, sel.level);
        exampleBtn.hidden = !(lv.help && lv.help.example);
      }
      function choose(key, val) {
        if (key === 'level') sel.level = Number(val);
        else sel[key] = val;
        if (key === 'sea') {
          if (levelsOf(sel.sea).indexOf(sel.level) < 0) sel.level = 1;
          drawLevels();
        }
        paint();
      }
      drawLevels();
      const panel = el('section', { class: 'pr-setup', 'aria-label': TX.ui.menu.practice }, [
        el('div', { class: 'pr-setup-head' }, [homeBtn(), el('h1', { class: 'pr-setup-title' }, TX.ui.menu.practice)]),
        gradeF, seaF, levelF,
        el('div', { class: 'pr-actions' }, [exampleBtn, startBtn]),
      ]);
      body.appendChild(panel);
      paint();
    }

    function start() {
      G.save.setSelection({ grade: sel.grade, sea: sel.sea, level: sel.level });
      const lv = G.rules.level(sel.sea, sel.level);
      if (lv.help && lv.help.example && !G.save.seenExample()) runExample(true);
      else newGame();
    }

    // 새 판(무작위 적 함대). 곧바로 저장한다 → 옛 진행 판은 덮여 사라진다
    function newGame(message) {
      const st = G.rules.newGame({ mode: 'practice', grade: sel.grade, sea: sel.sea, level: sel.level });
      st.id = G.save.newGameId();
      G.save.saveGame(st);
      startPlay(st, { message });
    }

    // ── 판 화면 만들기(연습 판과 풀이 예시가 함께 씀) ─────────
    function buildPlay(state, o) {
      clearBody();
      o = o || {};
      const lv = G.rules.level(state.sea, state.level);
      const grade = state.grade;
      const turnsN = el('span', { class: 'pr-turns-n' }, String(lv.turns));
      const top = el('div', { class: 'pr-top' }, [
        homeBtn(),
        el('div', { class: 'pr-title' }, TX.seaNames[state.sea] + ' · ' + G.text.fill(TX.ui.setup.levelN, { n: state.level })),
        el('div', { class: 'pr-ships pr-ships--top' }),
        el('div', { class: 'pr-turns', 'aria-live': 'polite' }, [el('span', { class: 'pr-turns-label' }, TX.ui.play.turnsLeft), turnsN]),
      ]);
      const shipsTop = top.querySelector('.pr-ships--top');
      const exBar = o.example ? el('div', { class: 'pr-example-bar' }, [
        el('span', { class: 'pr-example-title' }, TX.example.title),
        el('button', { type: 'button', class: 'pr-skip', onclick: () => o.onSkip && o.onSkip() }, TX.example.skip),
      ]) : null;
      const seaBox = el('div', { class: 'pr-sea' });
      const shipsSide = el('div', { class: 'pr-ships pr-ships--side' });
      const seaCol = el('div', { class: 'pr-seacol' }, [seaBox, shipsSide]);
      const mouthBox = el('div', { class: 'pr-mouth' });
      const logBox = el('div', { class: 'pr-logbox' });
      const side = el('div', { class: 'pr-side' }, logBox);
      const main = el('div', { class: 'pr-main' }, [seaCol, mouthBox, side]);
      const dock = el('div', { class: 'pr-dock' });
      const dockWrap = el('div', { class: 'pr-dockwrap' }, dock);
      body.appendChild(el('div', { class: 'pr-play' + (o.example ? ' is-example' : '') }, [top, exBar, main, dockWrap]));

      const g = { state, lv, top, shipsTop, shipsSide, seaBox, mouthBox, logBox, side, dockWrap, turnsN, example: !!o.example, reveal: false };
      game = g;
      // 조작부 → 판 → 단면도 순서로 만든다: 단면도는 남은 자리의 크기로 누르는 곳(터치 목표)을 처음부터 맞춘다
      g.ctl = G.controls.create(dock, {
        levelConfig: lv, sea: state.sea, grade, mode: 'practice',
        onFire: (input) => { onFire(input); },
        onChange: () => syncMouth(),
        logContainer: logBox,
        layout: forced || 'auto',
      });
      placeLog();
      makeBoard();
      g.mouth = G.mouth.create(mouthBox, {
        sea: state.sea, grade, showNames: !!(lv.show && lv.show.placeNames),
        onPick: (id) => onPick(id),
      });
      g.ctl.setLog(state.teams.player.shots);
      updateStatus();
      return g;
    }

    // 판(바다)을 지금 배치에 맞게 만든다. 방향이 바뀌면 다시 만든다(쏜 기록은 판 상태에서 조용히 다시 그림)
    function makeBoard() {
      const g = game;
      if (g.board) g.board.destroy();
      g.shipsTop.textContent = '';
      g.shipsSide.textContent = '';
      const portrait = layout === 'portrait';
      g.board = G.board.create(g.seaBox, {
        sea: g.state.sea, levelConfig: g.lv, grade: g.state.grade, mode: 'play',
        fitHeight: !portrait, shipsEl: portrait ? g.shipsTop : g.shipsSide, compactShips: portrait, shooter: 'player',
      });
      g.board.render(G.board.viewOf(g.state, 'player'));
      if (g.reveal) g.board.revealFleet(g.state.teams.enemy.fleet);
    }
    // 신호 기록장 자리: 가로 = 옆 칸, 세로 = 조작부 위에 떠오르는 칸(접어 둠)
    function placeLog() {
      const g = game;
      if (layout === 'portrait') { if (g.logBox.parentNode !== g.dockWrap) g.dockWrap.insertBefore(g.logBox, g.dockWrap.firstChild); }
      else if (g.logBox.parentNode !== g.side) g.side.appendChild(g.logBox);
    }

    function updateStatus() {
      if (!game) return;
      const s = G.rules.sideSummary(game.state, 'player');
      game.turnsN.textContent = String(s.turnsLeft);
    }

    // 단면도 미리 보기를 조작부의 고른 것에 맞춘다
    function syncMouth() {
      const g = game;
      if (!g || !g.mouth || !g.ctl) return;
      const s = g.ctl.getSelection();
      if (g.state.sea === 'vowel') {
        g.mouth.select(s.backness && s.height ? s.backness + '-' + s.height : null);
        g.mouth.setLips(s.lips || null);
      } else {
        const cs = g.ctl.getState();
        g.mouth.select(s.place || null);
        g.mouth.setManner(s.manner || null);
        g.mouth.setStrength(cs.strengthCards && !cs.strengthDisabled ? s.strength || null : null);
      }
    }
    // 단면도에서 자리를 누름 → 조작부에 넘긴다(쏘는 중·예시 중에는 받지 않고 되돌린다)
    function onPick(id) {
      if (!game) return;
      if (view !== 'play' || busy) { syncMouth(); return; }
      game.ctl.setPlace(id);
    }

    function startPlay(state, o) {
      o = o || {};
      buildPlay(state, {});
      view = 'play';
      if (o.message) game.ctl.setMessage(o.message);
    }

    // ── 한 발 ─────────────────────────────────────────────
    async function onFire(input) {
      const g = game;
      if (!g || view !== 'play' || busy) return;
      busy = true;
      const my = token;
      g.ctl.setEnabled(false);
      sfx('fire');
      try { await g.mouth.play(input); } catch (e) { /* 그림이 없어도 판정은 한다 */ }
      if (!alive(my) || game !== g) return;
      const r = G.rules.fire(g.state, input);
      const o = r.outcome;
      g.ctl.reset();
      syncMouth();
      if (!o.usesTurn) { // 이번 바다에 없는 칸 · 이미 쏜 소리: 턴을 쓰지 않는다
        g.ctl.setEnabled(true);
        g.ctl.setMessage(G.text.signal(o.kind));
        busy = false;
        return;
      }
      g.state = r.state;
      const shots = g.state.teams.player.shots;
      g.board.update(G.board.viewOf(g.state, 'player'));
      sfx(o.kind === 'hit' ? (o.sunk ? 'sunk' : 'hit') : o.kind === 'none' ? 'dud' : 'miss');
      g.ctl.log(shots[shots.length - 1]);
      G.save.saveGame(g.state); // 끝난 판이면 진행 판을 지운다(결과는 finishGame이 기록)
      updateStatus();
      if (o.over) { endGame(); busy = false; return; }
      g.ctl.setEnabled(true);
      g.ctl.setMessage(o.sunk ? G.text.sunk(o.sunk) : G.text.signal(o.kind));
      busy = false;
    }

    // ── 끝 ────────────────────────────────────────────────
    function endGame() {
      const g = game;
      view = 'end';
      const success = !!(g.state.result && g.state.result.success);
      if (!success) { g.reveal = true; g.board.revealFleet(g.state.teams.enemy.fleet); }
      g.ctl.setEnabled(false);
      g.ctl.setMessage(success ? TX.ui.play.allFound : TX.ui.play.outOfTurns);
      const my = token;
      const finalState = clone(g.state);
      later(() => {
        if (!alive(my)) return;
        if (G.app && typeof G.app.finishGame === 'function') G.app.finishGame(finalState);
      }, config.endPause);
    }

    // ── 풀이 예시(자음 1단계) ─────────────────────────────
    // 정해진 함대(TEXT.example)에서 세 발을 자동으로 쏘며 발마다 한 줄. 저장·기록하지 않는다.
    async function runExample(auto) {
      const ex = TX.example;
      const grade = sel.grade;
      let st = G.rules.newGame({ mode: 'practice', grade, sea: ex.sea, level: ex.level, fleet: ex.fleet });
      let finished = false;
      const finish = () => {
        if (finished || destroyed) return;
        finished = true;
        G.save.setSeenExample(true);
        if (auto) { // 처음 시작: 곧바로 일반 판
          sel.sea = ex.sea; sel.level = ex.level;
          newGame(ex.end);
        } else showSetup(); // '예시 보기': 준비 화면으로
      };
      const g = buildPlay(st, { example: true, onSkip: finish });
      view = 'example';
      const my = token;
      g.ctl.setEnabled(false);
      g.ctl.setMessage(ex.title);
      let line = ex.title;
      for (let i = 0; i < ex.shots.length; i++) {
        const input = G.rules.inputOf(ex.shots[i].sound);
        g.ctl.setSelection(input);   // 고른 조합을 조작부·단면도에 보여 준다
        g.ctl.setMessage(line);      // 설명은 예시 줄만(따라 해 보기 줄은 띄우지 않는다)
        await sleep(config.exampleLead);
        if (!alive(my)) return;
        sfx('fire');
        try { await g.mouth.play(input); } catch (e) { /* 그림이 없어도 이어 간다 */ }
        if (!alive(my)) return;
        const r = G.rules.fire(st, input);
        st = r.state; g.state = st;
        const o = r.outcome;
        g.board.update(G.board.viewOf(st, 'player'));
        sfx(o.kind === 'hit' ? (o.sunk ? 'sunk' : 'hit') : o.kind === 'none' ? 'dud' : 'miss');
        g.ctl.log(st.teams.player.shots[st.teams.player.shots.length - 1]);
        g.ctl.reset();
        syncMouth();
        line = G.text.exampleLine(grade, i);
        g.ctl.setMessage(line);
        updateStatus();
        await sleep(config.examplePause);
        if (!alive(my)) return;
      }
      finish();
    }

    // ── 방향 바뀜 ─────────────────────────────────────────
    function relayout() {
      const next = layoutNow();
      if (next === layout || destroyed) return;
      layout = next;
      applyLayoutClass();
      if (game) { placeLog(); makeBoard(); }
    }
    const onMq = () => relayout();
    if (mq && !forced) (mq.addEventListener ? mq.addEventListener('change', onMq) : mq.addListener(onMq));

    function destroy() {
      if (destroyed) return;
      token++;
      destroyed = true;
      timers.forEach(clearTimeout);
      if (mq && !forced) (mq.removeEventListener ? mq.removeEventListener('change', onMq) : mq.removeListener(onMq));
      teardownGame();
      root.remove();
      if (current === handle) current = null;
    }
    const handle = {
      destroy,
      debug: () => ({
        view, busy, layout, example: view === 'example',
        state: game ? clone(game.state) : null,
      }),
    };
    current = handle;

    // ── 시작 ──────────────────────────────────────────────
    if (G.audio) { try { G.audio.play('practice'); } catch (e) { /* 소리는 없어도 된다 */ } }
    let resumed = null;
    if (opts.resume) {
      const s = G.save.loadGame();
      if (s && s.mode === 'practice' && s.phase === 'playing') resumed = s;
    }
    if (resumed) {
      sel.grade = resumed.grade; sel.sea = resumed.sea; sel.level = resumed.level;
      startPlay(resumed);
    } else showSetup();
    return { destroy };
  }

  function debug() {
    return current ? current.debug() : { view: null, busy: false, layout: null, example: false, state: null };
  }

  return { open, debug, config };
})();
