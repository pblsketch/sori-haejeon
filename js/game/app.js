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
  // 시작 화면(디자인 검수): 연습·대결 = 큰 주 단추, 소리 지도·설정·출처 = 아래 작은 보조 메뉴. 흰 패널(반경 16) 한 장.
  //   세로 배치(휴대폰)에서는 대결 단추를 끄고 그 바로 아래에 한 줄 안내(TEXT.duel.phoneNotice)를 늘 보인다.
  screens.title = function (c) {
    audio('practice');
    const notice = el('p', { class: 'app-notice', role: 'status', 'aria-live': 'polite' });
    let noticeTimer = 0;
    function say(text) {
      notice.textContent = text;
      notice.classList.add('is-on');
      clearTimeout(noticeTimer);
      if (!isPortrait()) noticeTimer = setTimeout(() => notice.classList.remove('is-on'), 6000);
    }
    function openDuel() {
      if (isPortrait()) say(T.duel.phoneNotice);
      else go('duel');
    }
    const M = T.ui.menu;
    // 게임 방법: 연습·대결 바로 아래 넓은 단추. 이 기기에서 아직 열어 보지 않았으면 '처음이라면 먼저 보세요'를 붙여 눈에 띄게.
    const howtoRow = el('div', { class: 'app-howto' });
    function drawHowto() {
      howtoRow.textContent = '';
      const fresh = !(G.save.seenHowto && G.save.seenHowto());
      const sel = G.save.getSelection();
      const b = G.howto ? G.howto.button('app-howto-btn' + (fresh ? ' is-fresh' : ''), () => ({ grade: sel.grade, sea: sel.sea, mode: 'practice', onClose: drawHowto }), M.howto) : null;
      if (b) { b.setAttribute('data-go', 'howto'); if (fresh) b.appendChild(el('span', { class: 'app-howto-hint' }, T.howto.firstHint)); howtoRow.appendChild(b); }
    }
    drawHowto();
    const duelBtn = btn(M.duel, openDuel, 'is-primary is-big', { 'data-go': 'duel' });
    const menu = el('nav', { class: 'app-menu', 'aria-label': T.ui.title }, [
      el('div', { class: 'app-menu-main' }, [
        btn(M.practice, () => go('practice'), 'is-primary is-big', { 'data-go': 'practice' }),
        duelBtn,
      ]),
      notice,
      howtoRow,
      el('div', { class: 'app-menu-sub' }, [
        btn(M.soundmap, () => go('soundmap'), 'is-sub', { 'data-go': 'soundmap' }),
        btn(M.settings, () => go('settings'), 'is-sub', { 'data-go': 'settings' }),
        btn(M.credits, () => go('credits'), 'is-sub', { 'data-go': 'credits' }),
      ]),
    ]);
    // 세로 배치: 대결은 쓸 수 없음(흐린 단추 + 바로 아래 한 줄)
    const pq = window.matchMedia ? window.matchMedia(PORTRAIT_Q) : null;
    function syncPortrait() {
      const p = isPortrait();
      duelBtn.classList.toggle('is-off', p);
      duelBtn.setAttribute('aria-disabled', p ? 'true' : 'false');
      if (p) { notice.textContent = T.duel.phoneNotice; notice.classList.add('is-on'); }
      else if (notice.textContent === T.duel.phoneNotice) notice.classList.remove('is-on');
    }
    syncPortrait();
    if (pq) (pq.addEventListener ? pq.addEventListener('change', syncPortrait) : pq.addListener(syncPortrait));
    const root = screen('app-title', [
      el('header', { class: 'app-title-head' }, el('h1', { class: 'app-title-name' }, T.ui.title)),
      el('div', { class: 'app-title-foot' }, [menu]),
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
    return { destroy() { clearTimeout(noticeTimer); if (pq) (pq.removeEventListener ? pq.removeEventListener('change', syncPortrait) : pq.removeListener(syncPortrait)); } };
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
        // 제목 줄 오른쪽에 '처음으로'(표 아래까지 내려가지 않아도 돌아갈 수 있게, 2차 검수)
        el('div', { class: 'app-page-head' }, [el('h1', { class: 'app-h1' }, M.title), btn(T.ui.play.home, () => go('title'), 'app-home-top')]),
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
      'Hahmlet · Pretendard — SIL Open Font License 1.1',
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
  // 디자인 검수: 결과(제목)와 핵심 수치를 맨 위에 크게 → 아래 [이번 판 소리 지도 | 알아 두기 · 생각해 볼 질문 · 단추].
  //   연습은 '턴', 대결은 '발'로 센다. 소리 지도는 맞힌 소리만 황금 + 과녁, 모든 소리는 기본 잉크로 읽힌다.
  screens.result = function (c, params) {
    audio('result');
    const R = T.ui.result;
    const rec = params.record;
    const duel = rec.mode === 'duel';
    const sides = duel ? ['blue', 'red'] : ['player'];
    const boards = [];

    // 결과 제목(가장 크게)
    let headline;
    if (duel) {
      const w = rec.result && rec.result.winner;
      headline = el('p', { class: 'app-res-winner app-res-headline' + (w ? ' team-' + w : ''), 'data-winner': w || 'draw' }, R.winner[w || 'draw']);
    } else if (rec.result && rec.result.success) {
      headline = el('p', { class: 'app-res-done app-res-headline' }, T.ui.play.allFound);
    } else {
      headline = el('p', { class: 'app-res-lost app-res-headline' }, R.notAll);
    }
    // 핵심 수치(팀마다 한 줄): 턴(대결은 발) · 없는 소리 · 맞힌 소리
    const stat = (k, label, value) => el('div', { class: 'app-res-stat' }, [el('dt', null, label), el('dd', { 'data-k': k }, value)]);
    const statsEl = el('div', { class: 'app-res-statrow' + (duel ? ' is-duel' : '') });
    sides.forEach((t) => {
      const s = rec.teams[t];
      if (!s) return;
      statsEl.appendChild(el('dl', { class: 'app-res-stats' + (duel ? ' team-' + t : ''), 'data-team': t }, [
        duel ? el('div', { class: 'app-res-team' }, T.teams[t]) : null,
        stat('turns', duel ? R.shots : R.turns, fill(duel ? R.shotsN : R.turnsN, { n: s.turnsUsed })),
        stat('none', R.noneShots, fill(R.timesN, { n: s.dudCount })),
        stat('hits', R.hits, fill(R.hitsCount, { n: s.hitSounds.length })),
      ]));
    });

    // 알아 두기: 이번 판에 나온 것만, 없으면 칸을 두지 않는다
    const notes = G.text.knowLines(rec.notes);
    const knowEl = notes.length
      ? el('section', { class: 'app-res-know app-res-card' }, [el('h2', { class: 'app-h2' }, R.know), ...notes.map((l) => el('p', { class: 'app-res-note' }, l))])
      : null;
    // 생각해 볼 질문 하나
    const q = G.text.pickDebrief(rec.grade, rec.sea);
    const qEl = el('section', { class: 'app-res-q app-res-card' }, [el('h2', { class: 'app-h2' }, R.question), el('p', { class: 'app-res-question' }, q)]);

    const maps = el('div', { class: 'app-res-maps' + (duel ? ' is-duel' : '') });
    const root = screen('app-result' + (duel ? ' is-duel' : ''), [
      el('header', { class: 'app-res-head' }, [
        el('div', { class: 'app-res-titles' }, [
          el('h1', { class: 'app-res-eyebrow' }, [el('span', { class: 'app-res-title' }, R.title), el('span', { class: 'app-res-meta' }, gameLabel(rec))]),
          headline,
        ]),
        statsEl,
      ]),
      el('div', { class: 'app-res-body' }, [
        el('section', { class: 'app-res-mapsec' }, [el('h2', { class: 'app-h2' }, R.soundmap), maps]),
        el('div', { class: 'app-res-side' }, [
          knowEl, qEl,
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
