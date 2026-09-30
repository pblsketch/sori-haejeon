'use strict';
// ───────────────────────────────────────────────────────────────
// 앱 뼈대 G.app — 화면 전환 · 시작 · 설정 · 이 기기의 소리 지도 · 만든 사람·출처 · 결과 화면 · '세로로 돌려 주세요'
//   불러오는 순서: util → data → core(rules·audio·save) → game(mouth·board·controls·practice·duel) → 이 파일 → js/main.js
//   모양: css/app.css      점검: tests/check-app.mjs (점검용 페이지 tests/pages/app.html)
//
// ── 화면 전환 ────────────────────────────────────────────────────────────
//   G.app.go(이름, 값) → 새 화면의 핸들
//     이름: 'title' | 'settings' | 'soundmap' | 'credits' | 'practice' | 'duel' | 'result'
//     지금 화면의 핸들에 destroy()가 있으면 부르고 #app을 비운 뒤 새 화면을 연다. 한 번에 한 화면.
//     'practice'·'duel'은 G.practice.open(값) / G.duel.open(값)을 있을 때만 부른다(값에 container: #app을 붙여 줌).
//       모듈이 없으면 시작 화면으로. 값: { resume: true } → 저장된 진행 판에서 이어서, 없으면 준비 화면부터.
//     'result'는 값 { record: GameRecord(rules.js makeRecord) }가 있어야 한다. 없으면 시작 화면.
//   G.app.finishGame(판 상태) — 판이 끝나면 연습·대결 화면이 부른다.
//     makeRecord → G.save.addRecord(기록, state.id)(한 판은 한 번만) → G.save.clearGame() → go('result', { record })
//     결과 화면에서 새로고침하면 시작 화면으로 간다(진행 판이 이미 지워져 누적 지도에 두 번 더해지지 않는다).
//   G.app.start()        처음 한 번: '세로로 돌려 주세요' 덮개를 붙이고 시작 화면을 연다(js/main.js가 부름).
//   G.app.current()      지금 화면 이름
//   G.app.isPortrait()   세로 배치인가 — matchMedia(PORTRAIT_Q). 대결은 세로 배치에서 열지 않는다.
//   G.app.isLowLandscape() 높이가 너무 낮은 가로 화면인가 — '세로로 돌려 주세요'(덮개는 css/app.css의 같은 기준으로 뜸)
//
// ── 지킬 것 ─────────────────────────────────────────────────────────────
//   화면 문구는 js/data/text.js(TEXT)에서 꺼낸다. 소리는 /ㄱ/ 표기. 설명 문구는 한 번에 한 줄.
//   배경 음악: 시작 화면 'practice', 결과 화면 'result'(설정·소리 지도·출처 화면은 지금 곡을 그대로 둔다).
// ───────────────────────────────────────────────────────────────
G.app = (function () {
  const U = G.util, T = window.TEXT, el = U.el;
  // 배치 기준(조정값). base.css·controls.css의 세로 배치와 같은 기준.
  const PORTRAIT_Q = '(max-width: 760px), (orientation: portrait)';
  // 가로로 눕힌 휴대폰처럼 높이가 낮은 화면(css/app.css의 .app-rotate와 같은 기준 — 바꿀 때 둘 다)
  const LOW_Q = '(orientation: landscape) and (max-height: 500px)';

  let cur = null; // { name, handle }
  const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
  const isPortrait = () => mq(PORTRAIT_Q);
  const isLowLandscape = () => mq(LOW_Q);
  const host = () => document.getElementById('app');
  const fill = (tpl, v) => G.text.fill(tpl, v);

  // ── 작은 도구 ─────────────────────────────────────────
  function btn(label, onClick, cls, attrs) {
    return el('button', Object.assign({ type: 'button', class: 'app-btn' + (cls ? ' ' + cls : ''), onclick: onClick }, attrs || {}), label);
  }
  function audio(name) {
    if (G.audio && typeof G.audio.play === 'function') G.audio.play(name);
  }
  // 판 이름표 한 줄: '연습 · 중3 · 자음 바다 · 1단계'
  function gameLabel(o) {
    return [T.ui.menu[o.mode], T.gradeNames[o.grade], T.seaNames[o.sea], fill(T.ui.setup.levelN, { n: o.level })]
      .filter(Boolean).join(' · ');
  }
  function screen(cls, children) {
    return el('section', { class: 'app-screen ' + cls }, children);
  }
  function backBtn(label) {
    return btn(label || T.ui.setup.back, () => go('title'), 'app-back');
  }

  // ── 화면 전환 ─────────────────────────────────────────
  const screens = {};
  function go(name, params) {
    params = params || {};
    const c = host();
    if (!c) return null;
    if (cur && cur.handle && typeof cur.handle.destroy === 'function') {
      try { cur.handle.destroy(); } catch (e) { console.error('화면 닫기 실패: ' + cur.name + ' ' + (e && e.message)); }
    }
    cur = null;
    c.innerHTML = '';
    try { window.scrollTo(0, 0); } catch (e) { /* 무시 */ }
    let handle = null;
    if (name === 'practice' || name === 'duel') {
      const mod = name === 'practice' ? G.practice : G.duel;
      if (!mod || typeof mod.open !== 'function') return go('title');
      handle = mod.open(Object.assign({}, params, { container: c }));
    } else if (name === 'result' && !(params.record && params.record.teams)) {
      return go('title');
    } else if (screens[name]) {
      handle = screens[name](c, params);
    } else {
      return go('title');
    }
    cur = { name, handle: handle || null };
    document.documentElement.setAttribute('data-screen', name);
    return handle;
  }

  function finishGame(state) {
    const rec = G.rules.makeRecord(state);
    G.save.addRecord(rec, state && state.id);
    G.save.clearGame();
    return go('result', { record: rec });
  }

  // ── '세로로 돌려 주세요' 덮개(body에 한 번 붙임, 화면 전환과 무관) ──
  function ensureRotate() {
    if (document.querySelector('.app-rotate')) return;
    const ico = '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect x="20" y="6" width="24" height="44" rx="5" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="32" cy="43" r="2.5" fill="currentColor"/><path d="M10 40a24 24 0 0 0 16 18" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M20 58l7 1-2-7" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    document.body.appendChild(el('div', { class: 'app-rotate', role: 'status' }, [
      el('span', { class: 'app-rotate-ico', html: ico }), el('p', null, T.rotate),
    ]));
  }
  function start() {
    ensureRotate();
    return go('title');
  }

  // ── 시작 화면 ─────────────────────────────────────────
  screens.title = function (c) {
    audio('practice');
    const notice = el('p', { class: 'app-notice', role: 'status', 'aria-live': 'polite' });
    let noticeTimer = 0;
    function say(text) {
      notice.textContent = text;
      notice.classList.add('is-on');
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => notice.classList.remove('is-on'), 6000);
    }
    function openDuel() {
      if (isPortrait()) say(T.duel.phoneNotice);
      else go('duel');
    }
    const M = T.ui.menu;
    const menu = el('nav', { class: 'app-menu', 'aria-label': T.ui.title }, [
      btn(M.practice, () => go('practice'), 'is-primary', { 'data-go': 'practice' }),
      btn(M.duel, openDuel, 'is-primary', { 'data-go': 'duel' }),
      btn(M.soundmap, () => go('soundmap'), '', { 'data-go': 'soundmap' }),
      btn(M.settings, () => go('settings'), '', { 'data-go': 'settings' }),
      btn(M.credits, () => go('credits'), '', { 'data-go': 'credits' }),
    ]);
    const root = screen('app-title', [
      el('header', { class: 'app-title-head' }, el('h1', { class: 'app-title-name' }, T.ui.title)),
      el('div', { class: 'app-title-foot' }, [notice, menu]),
    ]);
    c.appendChild(root);

    // 하던 판이 있으면 먼저 묻는다(spec 6.4)
    const saved = G.save.loadGame();
    if (saved) {
      const R = T.ui.resume;
      const dNote = el('p', { class: 'app-dialog-note', role: 'status', 'aria-live': 'polite' });
      const dialog = el('div', { class: 'app-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'app-resume-ask' }, [
        el('div', { class: 'app-dialog-card' }, [
          el('p', { class: 'app-dialog-ask', id: 'app-resume-ask' }, R.ask),
          el('p', { class: 'app-dialog-what' }, gameLabel(saved)),
          el('div', { class: 'app-dialog-btns' }, [
            btn(R.resume, () => {
              if (saved.mode === 'duel' && isPortrait()) { dNote.textContent = T.duel.phoneNotice; return; }
              go(saved.mode, { resume: true });
            }, 'is-primary', { 'data-act': 'resume' }),
            btn(R.fresh, () => { G.save.clearGame(); dialog.remove(); root.classList.remove('has-dialog'); }, '', { 'data-act': 'fresh' }),
          ]),
          dNote,
        ]),
      ]);
      root.classList.add('has-dialog');
      root.appendChild(dialog);
    }
    return { destroy() { clearTimeout(noticeTimer); } };
  };

  // ── 설정 ─────────────────────────────────────────────
  screens.settings = function (c) {
    const S = T.ui.settings;
    const refs = [];
    // 켜기/끄기 두 단추(누른 쪽이 aria-pressed)
    function toggle(key, label) {
      const on = btn(S.on, () => set(true), 'app-seg-btn', { 'data-v': 'on' });
      const off = btn(S.off, () => set(false), 'app-seg-btn', { 'data-v': 'off' });
      function set(v) { G.save.setSettings({ [key]: v }); refs.forEach((f) => f()); }
      function sync() {
        const v = !!G.save.getSettings()[key];
        on.setAttribute('aria-pressed', String(v));
        off.setAttribute('aria-pressed', String(!v));
      }
      refs.push(sync);
      return el('div', { class: 'app-seg', role: 'group', 'aria-label': label, 'data-key': key }, [on, off]);
    }
    function slider(key, label, onChange) {
      const inp = el('input', {
        type: 'range', min: '0', max: '100', step: '5', class: 'app-range', 'aria-label': label + ' ' + S.volume, 'data-key': key,
      });
      inp.addEventListener('input', () => G.save.setSettings({ [key]: (+inp.value) / 100 }));
      if (onChange) inp.addEventListener('change', onChange);
      function sync() {
        const s = G.save.getSettings();
        inp.value = String(Math.round(s[key] * 100));
        inp.closest && inp.closest('.app-set-row') && inp.closest('.app-set-row').classList.toggle('is-off', !s[key.replace('Volume', 'On')]);
      }
      refs.push(sync);
      return el('label', { class: 'app-vol' }, [el('span', { class: 'app-vol-name' }, S.volume), inp]);
    }
    function row(label, parts) {
      return el('div', { class: 'app-set-row' }, [el('span', { class: 'app-set-name' }, label), el('div', { class: 'app-set-ctl' }, parts)]);
    }
    // 기록 지우기(확인 받기)
    const clearMsg = el('p', { class: 'app-clear-msg', role: 'status', 'aria-live': 'polite' });
    const confirmBox = el('div', { class: 'app-confirm', hidden: true }, [
      el('p', { class: 'app-confirm-ask' }, S.clearConfirm),
      el('div', { class: 'app-dialog-btns' }, [
        btn(S.clearYes, () => { G.save.clearRecords(); confirmBox.hidden = true; clearBtn.hidden = false; clearMsg.textContent = S.cleared; }, 'is-danger', { 'data-act': 'clear-yes' }),
        btn(S.clearNo, () => { confirmBox.hidden = true; clearBtn.hidden = false; }, '', { 'data-act': 'clear-no' }),
      ]),
    ]);
    const clearBtn = btn(S.clear, () => { clearMsg.textContent = ''; confirmBox.hidden = false; clearBtn.hidden = true; }, 'is-danger-line', { 'data-act': 'clear' });

    const root = screen('app-page app-settings', [
      el('div', { class: 'app-page-col' }, [
        el('h1', { class: 'app-h1' }, S.title),
        row(S.bgm, [toggle('bgmOn', S.bgm), slider('bgmVolume', S.bgm)]),
        row(S.sfx, [toggle('sfxOn', S.sfx), slider('sfxVolume', S.sfx, () => { if (G.audio && G.audio.sfx) G.audio.sfx('miss'); })]),
        row(S.reduceMotion, [toggle('reduceMotion', S.reduceMotion)]),
        el('div', { class: 'app-set-clear' }, [clearBtn, confirmBox, clearMsg]),
        el('div', { class: 'app-page-foot' }, backBtn()),
      ]),
    ]);
    c.appendChild(root);
    refs.forEach((f) => f());
    return { destroy() {} };
  };

  // ── 이 기기의 소리 지도(누적) ──────────────────────────
  screens.soundmap = function (c) {
    const M = T.ui.soundmap;
    const grade = G.save.getSelection().grade; // 학년 용어는 마지막 선택을 따른다
    const boards = [];
    const maps = el('div', { class: 'app-maps' });
    const root = screen('app-page app-soundmap', [
      el('div', { class: 'app-page-wide' }, [
        el('h1', { class: 'app-h1' }, M.title),
        maps,
        el('div', { class: 'app-page-foot' }, backBtn(M.back)),
      ]),
    ]);
    c.appendChild(root);
    ['consonant', 'vowel'].forEach((sea) => {
      const ids = G.save.soundMap(sea);
      const box = el('div', { class: 'app-map-box' });
      maps.appendChild(el('section', { class: 'app-map', 'data-sea': sea }, [
        el('h2', { class: 'app-h2' }, T.seaNames[sea]),
        el('p', { class: 'app-map-count' }, ids.length ? fill(T.ui.result.hitsN, { n: ids.length }) : M.empty),
        box,
      ]));
      boards.push(G.board.soundMap(box, { sea, grade, hitSounds: ids }));
    });
    return { destroy() { boards.forEach((b) => b.destroy()); } };
  };

  // ── 만든 사람·출처 ─────────────────────────────────────
  // 음원 표기는 assets/audio/CREDITS.md의 '게임 안 표기' 그대로. text.js의 credits.lines를 채우면 그 줄을 앞에 더 보여 준다.
  const CREDITS = [
    { head: '배경 음악', lines: [
      '"Groove Grove" Kevin MacLeod (incompetech.com)',
      'Licensed under Creative Commons: By Attribution 4.0 License',
      'http://creativecommons.org/licenses/by/4.0/',
      '"Cipher" Kevin MacLeod (incompetech.com)',
      'Licensed under Creative Commons: By Attribution 4.0 License',
      'http://creativecommons.org/licenses/by/4.0/',
      '"Echoes Of Home" by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au',
    ] },
    { head: '효과음', lines: ['Freesound(freesound.org)의 CC0 음원 — DRFX, Kreastricon62, qubodup, Saltbearer, craigsmith'] },
    { head: '글꼴', lines: [
      'Hahmlet · Gowun Batang — SIL Open Font License 1.1',
      '게임에 쓰는 부분만 남기고 이름을 바꾸어 넣었어요',
    ] },
    { head: '그림', lines: ['이 게임을 위해 새로 만든 그림이에요'] },
  ];
  screens.credits = function (c) {
    const C = T.ui.credits;
    const extra = Array.isArray(C.lines) ? C.lines.filter(Boolean) : [];
    const blocks = (extra.length ? [{ head: '', lines: extra }] : []).concat(CREDITS);
    const root = screen('app-page app-credits', [
      el('div', { class: 'app-page-col' }, [
        el('h1', { class: 'app-h1' }, C.title),
        ...blocks.map((b) => el('section', { class: 'app-cred' }, [
          b.head ? el('h2', { class: 'app-h2' }, b.head) : null,
          ...b.lines.map((l) => el('p', { class: 'app-cred-line' }, l)),
        ])),
        el('div', { class: 'app-page-foot' }, backBtn(C.back)),
      ]),
    ]);
    c.appendChild(root);
    return { destroy() {} };
  };

  // ── 결과 화면(spec 6.5: 이번 판의 것만) ─────────────────
  screens.result = function (c, params) {
    audio('result');
    const R = T.ui.result;
    const rec = params.record;
    const duel = rec.mode === 'duel';
    const sides = duel ? ['blue', 'red'] : ['player'];
    const boards = [];

    // 기록
    const recEl = el('section', { class: 'app-res-rec' }, [el('h2', { class: 'app-h2' }, R.record)]);
    if (duel) {
      const w = rec.result && rec.result.winner;
      recEl.appendChild(el('p', { class: 'app-res-winner' + (w ? ' team-' + w : ''), 'data-winner': w || 'draw' }, R.winner[w || 'draw']));
    } else if (rec.result && rec.result.success) {
      recEl.appendChild(el('p', { class: 'app-res-done' }, T.ui.play.allFound));
    }
    sides.forEach((t) => {
      const s = rec.teams[t];
      if (!s) return;
      recEl.appendChild(el('dl', { class: 'app-res-stats' + (duel ? ' team-' + t : ''), 'data-team': t }, [
        duel ? el('div', { class: 'app-res-team' }, T.teams[t]) : null,
        el('div', null, [el('dt', null, R.turns), el('dd', { 'data-k': 'turns' }, fill(R.turnsN, { n: s.turnsUsed }))]),
        el('div', null, [el('dt', null, R.noneShots), el('dd', { 'data-k': 'none' }, fill(R.timesN, { n: s.dudCount }))]),
        el('div', null, [el('dd', { 'data-k': 'hits' }, fill(R.hitsN, { n: s.hitSounds.length }))]),
      ]));
    });

    // 알아 두기: 이번 판에 나온 것만, 없으면 칸을 두지 않는다
    const notes = (rec.notes || []).map((n) => G.text.know(n.id)).filter(Boolean);
    const knowEl = notes.length
      ? el('section', { class: 'app-res-know' }, [el('h2', { class: 'app-h2' }, R.know), ...notes.map((l) => el('p', { class: 'app-res-note' }, l))])
      : null;
    // 생각해 볼 질문 하나
    const q = G.text.pickDebrief(rec.grade, rec.sea);
    const qEl = el('section', { class: 'app-res-q' }, [el('h2', { class: 'app-h2' }, R.question), el('p', { class: 'app-res-question' }, q)]);

    const maps = el('div', { class: 'app-res-maps' + (duel ? ' is-duel' : '') });
    const root = screen('app-result' + (duel ? ' is-duel' : ''), [
      el('header', { class: 'app-res-head' }, [
        el('h1', { class: 'app-h1' }, R.title),
        el('p', { class: 'app-res-meta' }, gameLabel(rec)),
      ]),
      el('div', { class: 'app-res-body' }, [
        el('section', { class: 'app-res-mapsec' }, [el('h2', { class: 'app-h2' }, R.soundmap), maps]),
        el('div', { class: 'app-res-side' }, [
          recEl, knowEl, qEl,
          el('div', { class: 'app-res-btns' }, [
            btn(R.again, () => go(rec.mode, {}), 'is-primary', { 'data-act': 'again' }),
            btn(R.home, () => go('title'), '', { 'data-act': 'home' }),
          ]),
        ]),
      ]),
    ]);
    c.appendChild(root);
    sides.forEach((t) => {
      const s = rec.teams[t];
      if (!s) return;
      const box = el('div', { class: 'app-map-box' });
      maps.appendChild(el('div', { class: 'app-res-map' + (duel ? ' team-' + t : ''), 'data-team': t }, [
        duel ? el('p', { class: 'app-res-maplabel' }, T.teams[t]) : null, box,
      ]));
      // 연습은 이번 판에 맞힌 소리 전체(hitSoundsAll), 대결은 팀마다
      const hits = duel ? s.hitSounds : rec.hitSoundsAll || s.hitSounds;
      boards.push(G.board.soundMap(box, { sea: rec.sea, grade: rec.grade, hitSounds: hits, fitHeight: !isPortrait() }));
    });
    return { destroy() { boards.forEach((b) => b.destroy()); }, question: q };
  };

  return {
    go, finishGame, start,
    current: () => (cur ? cur.name : null),
    isPortrait, isLowLandscape,
    PORTRAIT_Q, LOW_Q,
  };
})();
