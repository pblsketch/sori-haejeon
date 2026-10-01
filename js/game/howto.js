'use strict';
// ───────────────────────────────────────────────────────────────
// 게임 방법 G.howto — 시작 화면·연습/대결 준비 화면·연습 판 위의 '게임 방법' 단추로 여는 안내 창
// ───────────────────────────────────────────────────────────────
// 불러오는 순서: util → data(text) → core(rules·save) → game(board) → 이 파일. 모양은 css/howto.css.
// 판 도중의 설명은 여전히 한 줄이다. 이 창은 학생이 스스로 열어 보는 안내라서 여러 줄을 담는다.
// 문구는 모두 TEXT.howto(js/data/text.js). 카드 이름은 학년별 짧은 이름(G.text.short), 소리는 /ㄱ/ 표기.
//
// 쓰는 법
//   const h = G.howto.open({ grade: 'm3'|'h1', sea: 'consonant'|'vowel', mode: 'practice'|'duel', onClose });
//     document.body에 덮개(.howto)를 붙인다. 닫기 단추·'알겠어요'·바깥 누르기·Esc로 닫힌다.
//     열면 G.save.setSeenHowto(true)(시작 화면의 '처음이라면 먼저 보세요' 표시가 사라짐).
//     mode가 'duel'이면 대결 칸을 둘째로 올린다. 바다 탭(자음/모음)으로 보기 소리·신호·배 설명이 바뀐다.
//   h.close() · G.howto.current()(열린 창 또는 null) · G.howto.button(cls, opts)(여는 단추 하나 만들기)
//   한 번에 창 하나: 이미 열려 있으면 그 창을 닫고 새로 연다.
(function () {
  const U = G.util, el = U.el;
  let cur = null;

  function card(n, title, body, cls) {
    return el('section', { class: 'howto-card' + (cls ? ' ' + cls : '') }, [
      el('h3', { class: 'howto-card-h' }, [el('span', { class: 'howto-num', 'aria-hidden': 'true' }, String(n)), title]),
      ...body,
    ]);
  }
  const lines = (arr, cls) => (arr || []).filter(Boolean).map((t) => el('p', { class: cls || 'howto-p' }, t));

  // 보기: [① 두 입술] [② 파열] [③ 예사] → [발사]  두 입술 · 파열 · 예사 = /ㅂ/
  function makeDemo(grade, sea, H) {
    const id = H.make.example.sound[sea];
    const s = G.rules.sound(id);
    const cards = sea === 'vowel'
      ? [['height', s.height], ['backness', s.backness], ['lips', s.lips]]
      : [['place', s.place], ['manner', s.manner], ['strength', s.strength]];
    const marks = ['①', '②', '③'];
    const row = el('div', { class: 'howto-demo', 'aria-hidden': 'true' });
    const names = [];
    cards.forEach(([grp, v], i) => {
      const nm = G.text.short(grade, grp, v);
      names.push(nm);
      row.appendChild(el('span', { class: 'howto-chip' }, [
        el('span', { class: 'howto-chip-k' }, marks[i] + ' ' + G.text.short(grade, 'axis', grp)),
        el('span', { class: 'howto-chip-v' }, nm),
      ]));
    });
    row.appendChild(el('span', { class: 'howto-arrow' }, '→'));
    row.appendChild(el('span', { class: 'howto-fire' }, H.make.fire));
    const eq = el('p', { class: 'howto-eq' }, G.text.fill(H.make.equals, { combo: names.join(' · '), sound: G.text.sound(id) }));
    return [row, eq];
  }

  function signalRows(sea, H) {
    const R = H.signals.rows;
    const rows = ['hit', 'line', 'miss', 'none'].map((k) => el('div', { class: 'howto-sig k-' + k }, [
      el('span', { class: 'howto-sig-ico' }, U.glyph(k === 'line' ? 'hv' : k === 'none' ? 'dud' : k, 'howto-glyph')),
      el('span', { class: 'howto-sig-name' }, G.text.signalName(k)),
      el('span', { class: 'howto-sig-text' }, R[k]),
    ]));
    const L = H.signals.lineKinds[sea];
    const kinds = el('div', { class: 'howto-kinds' }, ['cell', 'v', 'h'].map((g) => el('div', { class: 'howto-kind' }, [
      U.glyph(g, 'howto-glyph is-small'), el('span', null, L[g]),
    ])));
    return [el('div', { class: 'howto-sigs' }, rows), kinds, el('p', { class: 'howto-note' }, H.signals.note)];
  }

  function shipRows(sea, H) {
    const lg = G.text.legend(sea);
    const ex = H.ships.examples[sea];
    const rows = [3, 2, 1].map((size, i) => el('div', { class: 'howto-ship' }, [
      el('span', { class: 'howto-ship-pic' }, G.board && G.board.shipPic ? G.board.shipPic(size, false) : null),
      el('span', { class: 'howto-ship-text' }, [
        el('span', { class: 'howto-ship-legend' }, lg[i]),
        el('span', { class: 'howto-ship-ex' }, H.ships.exampleLabel + ' ' + ex[size]),
      ]),
    ]));
    return [el('div', { class: 'howto-ships' }, rows)].concat(lines([H.ships.note[sea]], 'howto-note'));
  }

  function open(o) {
    o = o || {};
    if (cur) cur.close();
    const H = window.TEXT.howto;
    const grade = o.grade === 'h1' ? 'h1' : 'm3';
    let sea = o.sea === 'vowel' ? 'vowel' : 'consonant';
    const prevFocus = document.activeElement;

    const body = el('div', { class: 'howto-body' });
    const tabs = el('div', { class: 'howto-tabs', role: 'group', 'aria-label': H.title });
    const tabBtns = ['consonant', 'vowel'].map((s) => {
      const b = el('button', { type: 'button', class: 'howto-tab', 'data-sea': s, onclick: () => { sea = s; draw(); } }, H.seaTab[s]);
      tabs.appendChild(b);
      return b;
    });
    function draw() {
      tabBtns.forEach((b) => { const on = b.getAttribute('data-sea') === sea; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      body.textContent = '';
      const duel = card(0, H.duel.title, lines(H.duel.lines), 'is-duel');
      const list = [
        [H.goal.title, lines(H.goal.lines)],
        [H.make.title, [el('p', { class: 'howto-p is-lead' }, H.make.lines[sea])].concat(makeDemo(grade, sea, H), lines(H.make.tips, 'howto-tip'))],
        [H.signals.title, signalRows(sea, H)],
        [H.ships.title, shipRows(sea, H)],
        [H.turns.title, lines(H.turns.lines)],
      ];
      const cards = list.map(([t, b], i) => card(i + 1, t, b));
      if (o.mode === 'duel') cards.splice(1, 0, duel); else cards.push(duel);
      cards.forEach((c, i) => { c.querySelector('.howto-num').textContent = String(i + 1); body.appendChild(c); });
    }
    draw();

    const closeX = el('button', { type: 'button', class: 'howto-x', 'aria-label': H.closeX, onclick: () => close() }, '×');
    const okBtn = el('button', { type: 'button', class: 'howto-ok', onclick: () => close() }, H.close);
    const panel = el('div', { class: 'howto-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': H.title }, [
      el('header', { class: 'howto-head' }, [el('h2', { class: 'howto-title' }, H.title), tabs, closeX]),
      body,
      el('footer', { class: 'howto-foot' }, [okBtn]),
    ]);
    const root = el('div', { class: 'howto', onclick: (e) => { if (e.target === root) close(); } }, [panel]);
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(root);
    try { G.save && G.save.setSeenHowto && G.save.setSeenHowto(true); } catch (e) { /* 저장이 막혀도 창은 열린다 */ }
    try { okBtn.focus({ preventScroll: true }); } catch (e) { /* 무시 */ }

    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      root.remove();
      if (cur === handle) cur = null;
      try { if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true }); } catch (e) { /* 무시 */ }
      if (typeof o.onClose === 'function') o.onClose();
    }
    const handle = { el: root, close, sea: () => sea };
    cur = handle;
    return handle;
  }

  // 여는 단추: G.howto.button('pr-howto', () => ({ grade, sea, mode }))
  function button(cls, optsFn, label) {
    return el('button', {
      type: 'button', class: 'howto-open' + (cls ? ' ' + cls : ''), 'aria-label': label || window.TEXT.howto.open,
      onclick: () => open(typeof optsFn === 'function' ? optsFn() : optsFn),
    }, [el('span', { class: 'howto-open-ico', 'aria-hidden': 'true' }, '?'), el('span', { class: 'howto-open-label' }, label || window.TEXT.howto.open)]);
  }

  G.howto = { open, button, current: () => cur };
})();
