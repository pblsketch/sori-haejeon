'use strict';
// ───────────────────────────────────────────────────────────────
// 바다(판) 그리기 G.board — 판은 교과서의 자음 체계표(5×5)·단모음 체계표(3×4) 그 자체다.
//   불러오는 순서: util → data(sounds·fleets·levels·text) → core(rules) → 이 파일. 모양은 css/board.css.
//   점검: tests/check-board.mjs (점검용 페이지 tests/pages/board.html)
//
// ── 판 하나 만들기 ──────────────────────────────────────────────────────
//   const b = G.board.create(담을요소, {
//     sea: 'consonant'|'vowel', level: 단계 번호 또는 G.rules.level(sea, n)의 값(levelConfig로 줘도 됨),
//     grade: 'm3'|'h1',                      // 줄·열 이름(학년별 짧은 이름, G.text.short)
//     mode: 'play'(쏘는 바다) | 'place'(대결 숨기기 시간) | 'map'(소리 지도),
//     fitHeight: false,                      // true면 담을요소의 높이 안에도 맞춘다(담을요소 높이가 정해져 있어야 함)
//     shipsEl: 요소(선택),                   // 주면 그 안에 '남은 배' 목록을 그리고 판과 함께 갱신한다(play)
//     compactShips: false,                   // 남은 배 목록을 그림만 작게(휴대폰 세로 윗줄)
//     shooter: 'player'|'blue'|'red',        // render/update에 판 상태(GameState)를 그대로 줄 때 쏘는 팀
//     team: 'blue'|'red'(선택),              // setActive(true)일 때 테두리 색
//     onPick(묶음),                          // place 모드: 고른 소리 묶음(['ㄱ','ㄲ','ㅋ']). play 모드의 칸은 누르지 않는다
//   })
//   b.el                                     판의 뿌리 요소(.sb)
//   b.render(보기)      조용히 다시 그린다(되살리기·새로고침). 보기 = { shots: Shot[], fleet: 쏘는 바다의 배(선택), reveal: bool }
//                       또는 Shot[] 또는 판 상태(GameState, opts.shooter 기준). Shot은 G.rules의 기록 그대로.
//   b.update(보기)      render와 같고, 지난번보다 늘어난 발만 짧게(0.2초 안팎) 강조한다(같은 줄 범위 윤곽 한 번,
//                       명중 칸 황금 채움 강조, 격침 배 흔들림). 움직임 줄이기면 강조 없이 그린다. 불꽃·물보라 연출은 없다.
//   b.highlight(강조)   G.rules의 targets를 받아 그 범위의 윤곽을 한 번 짧게 강조한다 → Promise(끝나면). 흔적은 shots에서 그린다.
//   b.setSelection(고른것)  지금 고른 자리·방법(자음 { place, manner } / 모음 { backness, height, lips })의 줄·열 머리를
//                       '현재 선택'(청록 + 체크)으로 표시한다. 줄 이름을 숨기는 단계에서는 아무것도 표시하지 않는다.
//   b.revealFleet(배?)  끝날 때 남은 배 공개: 아직 안 맞힌 칸에 소리를 찍고 배마다 점선으로 잇는다.
//   b.markSunk(번호)    그 배를 격침으로 표시(선 잇기 + 목록 불탄 그림 + 흔들림). 보통은 shots의 sunkShip으로 저절로 된다.
//   b.setPlaceable(묶음들)  place: 누를 수 있는 묶음(G.rules.placeableGroups). 그 묶음의 칸만 눌린다.
//   b.setPlaced(함대)       place: 이미 놓은 배(칸 칠하기 + 선 잇기).
//   b.setHits(소리들)       map: 맞힌 소리 도장.
//   b.setActive(bool)       대결: 차례인 팀이 쏘는 바다의 테두리.
//   b.destroy()
//   · 한 칸이 놓을 수 있는 묶음 여러 개에 들면(지금 데이터에서는 생기지 않음) 칸을 누를 때 작은 고르기 창이
//     뜨고, 묶음마다 단추 하나('/ㄱ/ /ㄲ/ /ㅋ/')를 눌러 고른다. 다른 곳을 누르면 닫힌다.
//
// ── 판 옆 조각 ─────────────────────────────────────────────────────────
//   G.board.ships(요소, { sizes: [3,2,1], compact })  → { el, set(격침된 번호들, 방금 격침된 번호), destroy }  남은 배 목록
//   G.board.legend(요소, { sea })                      → { el, destroy }  배 종류 그림 한 줄씩(G.text.legend)
//   G.board.soundMap(요소, { sea, grade, hitSounds })  → 판 객체(map 모드)  결과 화면·누적 소리 지도
//   G.board.viewOf(판상태, 쏘는팀)                      → { shots, fleet, reveal:false }
//   G.board.setImageBase('assets/img/')                 배 그림 폴더(ship3.webp, ship3_burnt.webp …). 그림이 없으면 코드로 그린 모양.
//   · 판 위에는 그림을 깔지 않는다(바다 질감은 시작 화면 그림으로만). 신호는 색 + 벡터 기호(G.util.glyph) + 글씨.
//
// ── 신호 표시(디자인 검수 · spec 8.1) ─────────────────────────────────
//   명중 = 황금 채움 + 과녁 배지 · 같은 줄 = 보라 윤곽·옅은 바탕(게임이 돌려준 범위에만) + ↔/↕/겹친 네모 기호
//   빗나감 = 회색 × · 없는 소리 = ∅. 최근 발(.is-latest)은 굵은 테두리와 큰 배지, 이전 발은 같은 기호의 작은 배지.
//   맞히지 않은 소리는 언제나 기본 잉크(흐리게 하지 않음). 소리 표기는 한 판 안에서 모두 같은 크기(--sb-fs).
//
// ── 숨김(단계, spec 4) ─────────────────────────────────────────────────
//   칸 안 소리를 숨기는 단계에서는 25칸(12칸)을 모두 같은 모양으로 그린다: 빈칸·세기 자리·소리가 DOM 속성·글·aria
//   어디에도 없다(칸의 자리는 data-r/data-c 번호뿐). 쏜 뒤에야 그 칸에 표시가 생긴다. 줄 이름을 숨기는 단계는 머리글이 빈다.
//   배치(place) 화면은 단계와 상관없이 소리와 줄 이름을 보인다(spec 6.3). 소리 지도(map)는 모두 보인다.
//   판 위에는 배 그림을 올리지 않는다(선과 칠하기만). 배 그림은 판 옆 목록에만.
// ───────────────────────────────────────────────────────────────
G.board = (function () {
  const U = G.util, S = window.SOUNDS;
  const ORDER = { plain: 0, tense: 1, aspirated: 2, none: 0 };
  const KIND_RANK = { hit: 0, reveal: 1, line: 2, miss: 3, dud: 4 };
  const byId = {};
  S.consonants.concat(S.vowels).forEach((s) => { byId[s.id] = s; });
  const slash = (id) => G.text.sound(id);
  let imgBase = 'assets/img/';
  const probes = {};

  // 바다의 모양: 줄(행)·열, 소리·칸 → [행, 열]
  function geo(sea) {
    if (sea === 'vowel') return { sea, rows: S.heights, cols: S.columns, rg: 'height', cg: 'column', list: S.vowels,
      rc: (x) => [S.heights.indexOf(x.height), S.columns.indexOf(x.column)] };
    return { sea: 'consonant', rows: S.manners, cols: S.places, rg: 'manner', cg: 'place', list: S.consonants,
      rc: (x) => [S.manners.indexOf(x.manner), S.places.indexOf(x.place)] };
  }
  const reduced = () => U.reducedMotion();

  // ── 신호 기호 ─────────────────────────────────────────────
  // 칸 모서리 배지(벡터). kind: hit | line | miss | dud, dir: 같은 줄의 방향(G.util.lineDir)
  function badge(kind, dir) {
    const name = kind === 'line' ? dir || 'eq' : kind === 'hit' ? 'hit' : kind === 'miss' ? 'miss' : kind === 'dud' ? 'dud' : null;
    return name ? U.glyph(name, 'sb-badge') : null;
  }
  // 배 모양(그림 파일이 없을 때 대신)
  function shipSvg(size, burnt) {
    const w = 44 + size * 26;
    const s = U.svg('svg', { viewBox: '0 0 ' + w + ' 40', class: 'sb-ship-svg' + (burnt ? ' is-burnt' : ''), 'aria-hidden': 'true', focusable: 'false' });
    let body = '<path d="M3 24 H' + (w - 3) + ' L' + (w - 13) + ' 36 H13 Z" class="sb-hull"/>';
    for (let i = 0; i < size; i++) body += '<rect x="' + (18 + i * 26) + '" y="12" width="18" height="12" rx="2" class="sb-deck"/>';
    body += '<rect x="' + (w / 2 - 1.5) + '" y="3" width="3" height="10" class="sb-deck"/>';
    if (burnt) body += '<circle cx="' + (w * 0.35) + '" cy="9" r="6" class="sb-smoke"/><circle cx="' + (w * 0.55) + '" cy="6" r="5" class="sb-smoke"/><path d="M' + (w * 0.45) + ' 24c-4-5 0-8 2-12 2 4 6 7 2 12z" class="sb-fire"/>';
    s.innerHTML = body;
    return s;
  }
  function probe(url) {
    if (!(url in probes)) probes[url] = new Promise((res) => {
      const im = new Image();
      im.onload = () => res(true);
      im.onerror = () => res(false);
      im.src = url;
    });
    return probes[url];
  }
  // 배 그림: 먼저 코드로 그린 모양을 두고, 그림 파일이 있으면 바꿔 끼운다(없어도 오류 없음).
  function shipPic(size, burnt) {
    const box = U.el('span', { class: 'sb-pic' + (burnt ? ' is-burnt' : ''), 'data-size': size });
    box.appendChild(shipSvg(size, burnt));
    const url = imgBase + 'ship' + size + (burnt ? '_burnt' : '') + '.webp';
    probe(url).then((ok) => {
      if (!ok || !box.isConnected && !box.parentNode) return;
      box.textContent = '';
      box.appendChild(U.el('img', { src: url, alt: '', draggable: 'false' }));
    });
    return box;
  }

  // ── 남은 배 목록 ─────────────────────────────────────────────
  function ships(container, o) {
    o = o || {};
    const sizes = (o.sizes || [3, 2, 1]).slice();
    const el = U.el('div', { class: 'sb-ships' + (o.compact ? ' is-compact' : ''), role: 'list', 'aria-label': TEXT.ui.play.shipsLeft });
    if (!o.compact) el.appendChild(U.el('div', { class: 'sb-ships-title', 'aria-hidden': 'true' }, TEXT.ui.play.shipsLeft));
    const items = sizes.map((size) => {
      const it = U.el('div', { class: 'sb-ship-item', role: 'listitem', 'data-size': size }, [
        shipPic(size, false),
        U.el('span', { class: o.compact ? 'sb-ship-name sb-sr' : 'sb-ship-name' }, G.text.shipName(size)),
      ]);
      el.appendChild(it);
      return it;
    });
    container.appendChild(el);
    let sunkNow = [];
    return {
      el,
      // set(격침된 배 번호들, 방금 격침된 번호(연출, 선택))
      set(sunk, fresh) {
        sunk = sunk || [];
        items.forEach((it, i) => {
          const on = sunk.indexOf(i) >= 0, was = sunkNow.indexOf(i) >= 0;
          if (on !== was) {
            it.classList.toggle('is-sunk', on);
            it.replaceChild(shipPic(sizes[i], on), it.querySelector('.sb-pic'));
          }
          if (on && fresh === i && !reduced()) {
            it.classList.remove('sb-sinking'); void it.offsetWidth; it.classList.add('sb-sinking');
            setTimeout(() => it.classList.remove('sb-sinking'), 1300);
          }
        });
        sunkNow = sunk.slice();
      },
      destroy() { el.remove(); },
    };
  }

  // ── 배 종류 한 줄(판 옆) ─────────────────────────────────────
  function legend(container, o) {
    const sea = (o && o.sea) === 'vowel' ? 'vowel' : 'consonant';
    const lines = G.text.legend(sea);
    const el = U.el('div', { class: 'sb-legend' });
    [3, 2, 1].forEach((size, i) => {
      el.appendChild(shipPic(size, false));
      el.appendChild(U.el('span', { class: 'sb-legend-text' }, lines[i]));
    });
    container.appendChild(el);
    return { el, destroy() { el.remove(); } };
  }

  // ── 판 ───────────────────────────────────────────────────────
  function create(container, opts) {
    opts = opts || {};
    const sea = opts.sea === 'vowel' ? 'vowel' : 'consonant';
    const mode = opts.mode === 'place' || opts.mode === 'map' ? opts.mode : 'play';
    const grade = opts.grade === 'h1' ? 'h1' : 'm3';
    const g = geo(sea);
    const allIds = g.list.map((s) => s.id);
    let lv = opts.levelConfig || opts.level;
    if (mode === 'map') lv = { sea, open: allIds, fleet: [], show: {}, highlight: true };
    else if (typeof lv !== 'object' || !lv) lv = G.rules.level(sea, +lv || 1);
    const show = lv.show || {};
    const disp = mode === 'play'
      ? { sounds: !!show.cellSounds, empty: !!show.emptyCells, names: !!show.lineNames }
      : { sounds: true, empty: true, names: true };
    const open = lv.open.slice();
    const R = g.rows.length, C = g.cols.length;

    // 칸마다 열린 소리(세기 순서), 모든 소리
    const cellInfo = [];
    for (let r = 0; r < R; r++) {
      cellInfo.push([]);
      for (let c = 0; c < C; c++) {
        const all = g.list.filter((s) => { const p = g.rc(s); return p[0] === r && p[1] === c; });
        const on = all.filter((s) => open.indexOf(s.id) >= 0).sort((a, b) => ORDER[a.strength || 'none'] - ORDER[b.strength || 'none']);
        cellInfo[r].push({ all, on, kind: !all.length ? 'empty' : (!on.length ? 'closed' : 'sound') });
      }
    }
    // 세기 자리가 여럿인 줄: 칸을 세 자리(예사·된·거센)로 나눈다
    const multiRow = cellInfo.map((row) => row.some((ci) => ci.on.length > 1));

    // 뿌리
    const root = U.el('div', {
      class: 'sb sb-' + sea + ' sb-m-' + mode + (opts.fitHeight ? ' sb-fit' : '') + (opts.team ? ' sb-team-' + opts.team : ''),
      role: 'group', 'aria-label': TEXT.seaNames[sea],
    });
    const over = U.el('div', { class: 'sb-over', 'aria-hidden': 'true' });
    const lines = U.svg('svg', { class: 'sb-lines', 'aria-hidden': 'true', focusable: 'false' });
    // 쏘는 바다: 같은 줄 범위의 방향 기호가 판 오른쪽·아래 가장자리에 걸쳐 놓이므로 그만큼 여백을 둔다
    let PAD = mode === 'play' ? 12 : 0; // 좁은 판(휴대폰)은 layout()이 8로 줄인다
    if (PAD) for (const e of [root, over]) { e.style.paddingRight = PAD + 'px'; e.style.paddingBottom = PAD + 'px'; }
    root.appendChild(U.el('div', { class: 'sb-corner' }));
    const colHeads = g.cols.map((k) => {
      const e = U.el('div', { class: 'sb-ch' }, disp.names ? G.text.short(grade, g.cg, k) : '');
      root.appendChild(e);
      return e;
    });
    const rowHeads = [];
    const cellEls = [];
    for (let r = 0; r < R; r++) {
      const rh = U.el('div', { class: 'sb-rh' }, disp.names ? G.text.short(grade, g.rg, g.rows[r]) : '');
      root.appendChild(rh);
      rowHeads.push(rh);
      cellEls.push([]);
      for (let c = 0; c < C; c++) {
        const ci = cellInfo[r][c];
        let cls = 'sb-cell';
        if (disp.sounds || disp.empty) cls += ' sb-k-' + ci.kind; // 보이는 단계에서만 칸 종류를 드러낸다
        const e = U.el(mode === 'place' ? 'button' : 'div', mode === 'place'
          ? { class: cls, 'data-r': r, 'data-c': c, type: 'button', disabled: true }
          : { class: cls, 'data-r': r, 'data-c': c });
        // 이번 단계에서 뺀 칸(자음 1단계의 /ㅎ/ 칸): 옅은 바탕 + 잠금 기호(보이는 단계에서만)
        if ((disp.sounds || disp.empty) && ci.kind === 'closed') e.appendChild(U.glyph('lock', 'sb-lock'));
        root.appendChild(e);
        cellEls[r].push(e);
      }
    }
    root.appendChild(over);
    root.appendChild(lines);
    container.appendChild(root);

    // 상태
    let view = { shots: [], fleet: opts.fleet || null, reveal: false };
    let shownCount = 0;
    const extraSunk = [];
    let placeable = [], placed = [], hits = [];
    let anchors = new Map(); // 소리 id → 그 소리를 잇는 선의 점이 될 요소
    let lineSpecs = [];
    let chooser = null;
    let active = false;
    let destroyed = false;
    const timers = [];
    const shipList = opts.shipsEl && mode === 'play' ? ships(opts.shipsEl, { sizes: lv.fleet, compact: !!opts.compactShips }) : null;

    // ── 크기 맞추기 ──
    let size = { cw: 0, ch: 0 };
    let lastBox = '';
    function measureK() {
      const m = U.el('span', { class: 'sb-snd sb-measure' }, sea === 'vowel' ? '/ㅚ/' : '/ㅃ/');
      root.appendChild(m);
      const k = m.getBoundingClientRect().width / 100;
      m.remove();
      return k > 0.5 && k < 4 ? k : 1.8;
    }
    // 긴 열 이름은 두 줄로 나눈다(용어는 줄이지 않는다): '여린입천장' → 여린 / 입천장, '앞·둥글게' → 앞· / 둥글게
    function headHTML(name, two) {
      if (!two || name.length < 4) return null;
      let i = name.indexOf('·') + 1;
      if (i <= 0) { const j = name.indexOf('입천장'); i = j > 0 ? j : Math.floor(name.length / 2); }
      return [name.slice(0, i), name.slice(i)];
    }
    // 크기: 한 판 안에서 소리 표기(--sb-fs)는 모두 같은 크기. 줄 높이는 내용에 맞춘다
    //   세기 자리가 셋인 줄(보이는 단계) = 자리마다 1.4 × 글씨, 한 자리 줄·숨김 단계의 줄 = 1.6 × 글씨(터치 목표 이상)
    //   소리 표기 글씨는 자리 높이의 60% 이상(점검 기준), 칸 너비 안에 들어가게.
    function layout() {
      if (destroyed) return;
      const cs = getComputedStyle(container);
      const W0 = container.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      if (!(W0 > 0)) return;
      if (mode === 'play') {
        PAD = W0 < 520 ? 8 : 12;
        for (const e of [root, over]) { e.style.paddingRight = PAD + 'px'; e.style.paddingBottom = PAD + 'px'; }
      }
      const W = W0 - PAD;
      const Hc = opts.fitHeight ? container.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0) - PAD : Infinity;
      const touch = parseFloat(getComputedStyle(root).getPropertyValue('--touch')) || 48;
      const k = measureK();
      const gap = W < 520 ? 3 : 6;
      const rowNames = disp.names ? g.rows.map((x) => G.text.short(grade, g.rg, x)) : [];
      const colNames = disp.names ? g.cols.map((x) => G.text.short(grade, g.cg, x)) : [];
      const rLen = Math.max(0, ...rowNames.map((x) => x.length));
      const cLen = Math.max(2, ...colNames.map((x) => x.length));
      // 축 이름 글씨: 칸 너비에 비례(휴대폰 15~16 · 태블릿 20 안팎 · 칠판 28~30)
      const cw0 = (W * 0.86 - gap * C) / C;
      const axis = U.clamp(cw0 * 0.22, 15, 30);
      const hw = disp.names ? Math.round(U.clamp(rLen * axis + 10, 34, W * 0.2)) : Math.round(U.clamp(W * 0.03, 8, 16));
      const cw = Math.max(touch, Math.min(170, Math.floor((W - hw - gap * C) / C)));
      const rf = U.clamp(Math.min(axis, (hw - 10) / Math.max(1, rLen)), 12, 30);
      let hf = U.clamp(Math.min(axis, (cw - 8) / cLen), 11, 30), two = false;
      if (disp.names && hf < axis * 0.95 && cLen >= 4) { // 한 줄이면 너무 작아짐 → 두 줄
        two = true;
        hf = U.clamp(Math.min(axis, (cw - 8) / Math.ceil(cLen / 2 + 0.5)), 11, 30);
      }
      const hh = disp.names ? Math.ceil(hf * 1.2 * (two ? 2 : 1)) + 10 : 12;
      colHeads.forEach((e, i) => {
        if (!disp.names) return;
        const parts = headHTML(colNames[i], two);
        e.textContent = '';
        const t = U.el('span', { class: 'sb-hn' });
        if (parts) { t.appendChild(document.createTextNode(parts[0])); t.appendChild(U.el('br')); t.appendChild(document.createTextNode(parts[1])); }
        else t.textContent = colNames[i];
        if (e.classList.contains('is-picked')) e.appendChild(U.glyph('check', 'sb-pick'));
        e.appendChild(t);
      });
      // 소리 표기 글씨(한 판 안에서 같은 크기)
      const widthCap = (cw - 8) / k;
      // 소리 지도(체계표 전체)는 행이 많아 한 화면에 들어오게 조금 작게(검수 시작값: 태블릿 36~40)
      const cap = mode === 'map' ? (W >= 1100 ? 44 : 38) : 56;
      let F = Math.min(widthCap, cap, Math.max(26, cw * 0.38));
      const multi = multiRow.map((m) => m && disp.sounds);
      const rowsFor = (f) => multi.map((m) => (m ? Math.max(touch, Math.round(f * 1.3) * 3) : Math.max(touch, Math.round(f * 1.6))));
      let rowsH = rowsFor(F);
      if (isFinite(Hc) && Hc > 0) {
        const avail = Hc - hh - gap * R;
        for (let n = 0; n < 4; n++) {
          const sum = rowsH.reduce((a, b) => a + b, 0);
          if (sum <= avail) break;
          F = Math.max(12, F * avail / sum);
          rowsH = rowsFor(F);
        }
      }
      // 터치 목표 때문에 줄이 글씨보다 크게 남으면 글씨를 그만큼 키운다(자리 높이의 61%까지, 칸 너비 안에서)
      rowsH.forEach((h, r) => { if (!multi[r]) F = Math.max(F, Math.min(widthCap, h * 0.61)); else F = Math.max(F, Math.min(widthCap, (h / 3) * 0.61)); });
      const ch = Math.min(...rowsH);
      const cols = hw + 'px repeat(' + C + ', ' + cw + 'px)';
      const rows = hh + 'px ' + rowsH.map((h) => h + 'px').join(' ');
      for (const e of [root, over]) {
        e.style.gridTemplateColumns = cols; e.style.gridTemplateRows = rows; e.style.gap = gap + 'px';
      }
      root.style.setProperty('--sb-cw', cw + 'px');
      root.style.setProperty('--sb-k', k.toFixed(3));
      root.style.setProperty('--sb-fs', F.toFixed(1) + 'px');
      root.style.setProperty('--sb-hf', hf.toFixed(1) + 'px');
      root.style.setProperty('--sb-rf', rf.toFixed(1) + 'px');
      root.classList.toggle('sb-two', two);
      size = { cw, ch, gap };
      fit();
    }
    // 표시 하나하나의 높이를 재어 소리 표기 크기(--h)를 정하고 선을 다시 긋는다
    function fit() {
      if (destroyed || !size.cw) return;
      for (const e of root.querySelectorAll('.sb-slot, .sb-item')) {
        const h = e.getBoundingClientRect().height / (+e.dataset.u || 1);
        e.style.setProperty('--h', h.toFixed(1) + 'px');
      }
      drawLines();
    }
    const ro = window.ResizeObserver ? new ResizeObserver(() => {
      // 같은 틀 안에서 크기를 다시 바꾸지 않게 다음 그림 차례로 미룬다
      requestAnimationFrame(() => {
        const box = container.clientWidth + 'x' + (opts.fitHeight ? container.clientHeight : '');
        if (box === lastBox) return fit();
        lastBox = box; layout();
      });
    }) : null;
    if (ro) ro.observe(container);
    else window.addEventListener('resize', layout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => layout());

    // ── 칸 안 그리기 ──
    function norm(x) {
      if (!x) return { shots: [], fleet: view.fleet, reveal: false };
      if (Array.isArray(x)) return { shots: x, fleet: view.fleet, reveal: false };
      if (x.teams) return viewOf(x, opts.shooter || 'player');
      return { shots: x.shots || [], fleet: x.fleet || view.fleet || null, reveal: !!x.reveal };
    }
    function sunkList() {
      const s = [];
      view.shots.forEach((sh) => { if (sh.sunkShip != null && s.indexOf(sh.sunkShip) < 0) s.push(sh.sunkShip); });
      extraSunk.forEach((i) => { if (s.indexOf(i) < 0) s.push(i); });
      return s.sort((a, b) => a - b);
    }
    function paint() {
      closeChooser();
      anchors = new Map();
      const per = cellEls.map((row) => row.map(() => []));
      const hitSet = new Set();
      // 최근 발(판에 표시가 남는 마지막 발): 굵은 테두리·큰 배지. 이전 발은 같은 기호의 작은 배지
      const latest = mode === 'play' ? view.shots.length - 1 : -1;
      const dirOf = (i) => U.lineDir(view.shots[i] && view.shots[i].targets);
      view.shots.forEach((sh, i) => {
        if (sh.kind === 'hit' && sh.sound) hitSet.add(sh.sound);
        if (sh.kind === 'none') {
          if (!sh.emptyCell || !sh.cell) return; // 소리가 있는 칸의 없는 세기: 판에는 찍지 않는다(신호 기록장에만)
          const p = g.rc(sh.cell);
          const st = sh.input && sh.input.strength;
          per[p[0]][p[1]].push({ kind: 'dud', id: null, strength: lv.strengthCards ? st : null, order: ORDER[st || 'none'], i });
          return;
        }
        if (!sh.sound || !byId[sh.sound] || ['hit', 'line', 'miss'].indexOf(sh.kind) < 0) return;
        const s = byId[sh.sound], p = g.rc(s);
        per[p[0]][p[1]].push({ kind: sh.kind, id: s.id, order: ORDER[s.strength || 'none'], i });
      });
      if (mode === 'map') hits.forEach((id, i) => {
        const s = byId[id]; if (!s || s.sea !== sea) return;
        const p = g.rc(s);
        per[p[0]][p[1]].push({ kind: 'hit', id, order: ORDER[s.strength || 'none'], i });
      });
      if (view.reveal && view.fleet) view.fleet.forEach((ship) => ship.sounds.forEach((id) => {
        if (hitSet.has(id) || !byId[id]) return;
        const s = byId[id], p = g.rc(s);
        per[p[0]][p[1]].push({ kind: 'reveal', id, order: ORDER[s.strength || 'none'], i: 1e6 });
      }));
      const placedIds = new Set();
      placed.forEach((sh) => sh.sounds.forEach((id) => placedIds.add(id)));

      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const cell = cellEls[r][c], ci = cellInfo[r][c];
        const marks = per[r][c].sort((a, b) => a.order - b.order || KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.i - b.i);
        cell.textContent = '';
        if ((disp.sounds || disp.empty) && ci.kind === 'closed') cell.appendChild(U.glyph('lock', 'sb-lock'));
        if (mode === 'place') cell.classList.toggle('has-placed', ci.on.some((s) => placedIds.has(s.id)));
        const stack = U.el('div', { class: 'sb-stack' });
        cell.appendChild(stack);
        const loose = [];
        if (disp.sounds) {
          const units = multiRow[r] ? 3 : 1;
          ci.on.forEach((s) => {
            const st = s.strength || 'none';
            const full = units === 1 || st === 'none';
            const idx = full ? 0 : ORDER[st];
            const slot = U.el('div', {
              class: 'sb-slot' + (units > 1 && !full && idx > 0 ? ' sb-sub' : ''),
              style: 'top:' + (full ? 0 : (idx * 100) / 3).toFixed(3) + '%;height:' + (full ? 100 : 100 / 3).toFixed(3) + '%',
              'data-u': full && units > 1 ? 3 : null,
            }, U.el('span', { class: 'sb-snd' }, slash(s.id)));
            const mk = marks.find((m) => m.id === s.id);
            if (mk) {
              slot.classList.add('sb-mark', 'k-' + mk.kind);
              if (mk.i === latest) slot.classList.add('is-latest');
              const ic = badge(mk.kind, mk.kind === 'line' ? dirOf(mk.i) : null); if (ic) slot.appendChild(ic);
              if (mk.kind !== 'reveal') slot.appendChild(U.el('span', { class: 'sb-sr' }, G.text.signalName(mk.kind === 'dud' ? 'none' : mk.kind)));
              mk.el = slot;
            }
            if (placedIds.has(s.id)) slot.classList.add('is-placed');
            cell.appendChild(slot);
            anchors.set(s.id, slot);
          });
          marks.forEach((m) => { if (!m.el) loose.push(m); });
        } else marks.forEach((m) => loose.push(m));
        // 칸 안에 차례로 쌓는 표시(숨김 단계, 빈칸의 불발)
        loose.forEach((m) => {
          const kids = [];
          if (m.kind === 'dud') kids.push(U.glyph('dud', 'sb-dudmark')); // 없는 소리: 칸 가운데 ∅
          if (m.id) kids.push(U.el('span', { class: 'sb-stamp' }, slash(m.id)));
          else if (m.strength) kids.push(U.el('span', { class: 'sb-lab' }, G.text.short(grade, 'strength', m.strength)));
          if (m.kind !== 'reveal') kids.push(U.el('span', { class: 'sb-sr' }, G.text.signalName(m.kind === 'dud' ? 'none' : m.kind)));
          const ic = m.kind !== 'dud' ? badge(m.kind, m.kind === 'line' ? dirOf(m.i) : null) : null; if (ic) kids.push(ic);
          const it = U.el('div', { class: 'sb-mark sb-item k-' + m.kind + (m.i === latest ? ' is-latest' : '') }, kids);
          stack.appendChild(it);
          m.el = it;
          if (m.id) anchors.set(m.id, it);
        });
      }

      // 강조 흔적(쌓임)
      over.textContent = '';
      if (mode === 'play') view.shots.forEach((sh, i) => {
        if (sh.kind === 'line' && sh.targets) sh.targets.forEach((t) => over.appendChild(areaEl('sb-trace' + (i === latest ? ' is-latest' : ''), t, true)));
      });

      // 선: 격침(실선) · 공개(점선) · 놓은 배
      lineSpecs = [];
      const sunk = sunkList();
      if (view.fleet) view.fleet.forEach((ship, i) => {
        if (sunk.indexOf(i) >= 0) lineSpecs.push({ i, t: 'sunk', ids: ship.sounds });
        else if (view.reveal) lineSpecs.push({ i, t: 'reveal', ids: ship.sounds });
      });
      if (mode === 'place') placed.forEach((ship, i) => lineSpecs.push({ i, t: 'placed', ids: ship.sounds }));
      if (shipList) shipList.set(sunk);
      if (mode === 'place') applyPlaceable();
      fit();
    }

    // 강조 대상(targets 한 개) → 칸/줄 자리
    function spot(t) {
      if (t.cell) { const p = g.rc(t.cell); return { o: 'cell', r: p[0], c: p[1] }; }
      if (t.pair) { const p = g.rc(t.pair); return { o: 'cell', r: p[0], c: p[1] }; }
      if (t.place) return { o: 'col', c: S.places.indexOf(t.place) };
      if (t.column) return { o: 'col', c: S.columns.indexOf(t.column) };
      if (t.manner) return { o: 'row', r: S.manners.indexOf(t.manner) };
      if (t.height) return { o: 'row', r: S.heights.indexOf(t.height) };
      return null;
    }
    // mark: 참이면 범위의 방향 기호(가로줄 ↔ · 세로줄 ↕ · 같은 칸 겹친 네모)를 범위 끝 가장자리에 붙인다
    function areaEl(cls, t, mark) {
      const sp = spot(t);
      if (!sp || (sp.r != null && sp.r < 0) || (sp.c != null && sp.c < 0)) return document.createComment('');
      const style = sp.o === 'cell' ? 'grid-row:' + (sp.r + 2) + ';grid-column:' + (sp.c + 2)
        : sp.o === 'col' ? 'grid-row:2 / span ' + R + ';grid-column:' + (sp.c + 2)
          : 'grid-row:' + (sp.r + 2) + ';grid-column:2 / span ' + C;
      const e = U.el('div', { class: cls + ' o-' + sp.o, 'data-o': sp.o, 'data-r': sp.r, 'data-c': sp.c, style });
      if (mark) e.appendChild(U.glyph(sp.o === 'cell' ? 'cell' : sp.o === 'col' ? 'v' : 'h', 'sb-dir'));
      return e;
    }

    function drawLines() {
      lines.textContent = '';
      const rq = root.getBoundingClientRect();
      lines.setAttribute('width', Math.ceil(rq.width));
      lines.setAttribute('height', Math.ceil(rq.height));
      const sw = Math.max(3, Math.round(size.cw * 0.06));
      lineSpecs.forEach((ln) => {
        const pts = ln.ids.map((id) => anchors.get(id)).filter(Boolean).map((e) => {
          const q = e.getBoundingClientRect();
          return [q.left + q.width / 2 - rq.left, q.top + q.height / 2 - rq.top];
        });
        if (!pts.length) return;
        const cls = 'sb-ln t-' + ln.t;
        if (pts.length === 1) {
          lines.appendChild(U.svg('circle', { class: cls, 'data-ship': ln.i, 'data-t': ln.t, cx: pts[0][0].toFixed(1), cy: pts[0][1].toFixed(1), r: (Math.min(size.cw, size.ch) * 0.42).toFixed(1), 'stroke-width': sw }));
          return;
        }
        lines.appendChild(U.svg('polyline', { class: cls, 'data-ship': ln.i, 'data-t': ln.t, points: pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '), 'stroke-width': sw }));
        pts.forEach((p) => lines.appendChild(U.svg('circle', { class: 'sb-dot t-' + ln.t, cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: (sw * 1.3).toFixed(1) })));
      });
    }

    // ── 연출 ──
    function highlight(targets) {
      if (destroyed || !targets || !targets.length || reduced()) return Promise.resolve();
      return new Promise((res) => {
        const els = targets.map((t) => areaEl('sb-wave', t)).filter((e) => e.nodeType === 1);
        els.forEach((e) => over.appendChild(e));
        let left = els.length;
        if (!left) return res();
        els.forEach((e) => {
          const done = () => { if (!e.parentNode) return; e.remove(); if (--left === 0) res(); };
          e.addEventListener('animationend', done, { once: true });
          timers.push(setTimeout(done, 700)); // 애니메이션이 꺼져 있어도 남지 않게
        });
      });
    }
    // 결과 강조(0.2초 안팎, 한 번): 방금 생긴 표시에 테두리가 한 번 조였다 풀린다. 움직임 줄이기면 없음
    function freshen(e) {
      if (!e || reduced()) return;
      e.classList.remove('sb-fresh'); void e.offsetWidth; e.classList.add('sb-fresh');
      timers.push(setTimeout(() => e.classList.remove('sb-fresh'), 260));
    }

    // ── 배치(place) ──
    function groupsFor(r, c) {
      const ids = cellInfo[r][c].on.map((s) => s.id);
      return placeable.filter((grp) => grp.some((id) => ids.indexOf(id) >= 0));
    }
    function applyPlaceable() {
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const e = cellEls[r][c];
        const can = groupsFor(r, c).length > 0;
        e.disabled = !can;
        e.classList.toggle('is-can', can);
      }
    }
    function closeChooser() { if (chooser) { chooser.remove(); chooser = null; } }
    function pick(grp) { closeChooser(); if (typeof opts.onPick === 'function') opts.onPick(grp.slice()); }
    function openChooser(cell, groups) {
      closeChooser();
      chooser = U.el('div', { class: 'sb-chooser', role: 'menu' }, groups.map((grp) =>
        U.el('button', { type: 'button', role: 'menuitem', class: 'sb-choice', onclick: (ev) => { ev.stopPropagation(); pick(grp); } }, grp.map(slash).join(' '))));
      root.appendChild(chooser);
      const rq = root.getBoundingClientRect(), q = cell.getBoundingClientRect();
      const w = chooser.offsetWidth;
      chooser.style.left = Math.max(0, Math.min(q.left - rq.left, rq.width - w)) + 'px';
      chooser.style.top = (q.bottom - rq.top + 4) + 'px';
    }
    root.addEventListener('click', (ev) => {
      if (mode !== 'place') return;
      if (ev.target.closest && ev.target.closest('.sb-chooser')) return;
      const cell = ev.target.closest && ev.target.closest('button.sb-cell');
      if (!cell || cell.disabled) return closeChooser();
      const grs = groupsFor(+cell.dataset.r, +cell.dataset.c);
      if (grs.length === 1) pick(grs[0]);
      else if (grs.length > 1) openChooser(cell, grs);
    });
    const onDocDown = (ev) => { if (chooser && !root.contains(ev.target)) closeChooser(); };
    document.addEventListener('pointerdown', onDocDown);

    const board = {
      el: root,
      sea, mode, level: lv,
      render(x) {
        view = norm(x);
        shownCount = view.shots.length;
        paint();
        return board;
      },
      update(x) {
        const before = shownCount;
        const prevSunk = sunkList();
        view = norm(x);
        paint();
        shownCount = view.shots.length;
        if (view.shots.length > before) {
          view.shots.slice(before).forEach((sh) => {
            if (sh.kind === 'line') highlight(sh.targets);
            if (sh.sound && (sh.kind === 'hit' || sh.kind === 'miss' || sh.kind === 'line')) freshen(anchors.get(sh.sound));
          });
          const nowSunk = sunkList().filter((i) => prevSunk.indexOf(i) < 0);
          if (shipList && nowSunk.length) shipList.set(sunkList(), nowSunk[nowSunk.length - 1]);
        }
        return board;
      },
      highlight,
      revealFleet(fleet) {
        if (fleet) view.fleet = fleet;
        view.reveal = true;
        paint();
        root.querySelectorAll('.k-reveal').forEach(freshen);
        return board;
      },
      markSunk(i) {
        if (typeof i === 'object' && i && view.fleet) i = view.fleet.indexOf(i);
        if (i == null || i < 0) return board;
        if (extraSunk.indexOf(i) < 0) extraSunk.push(i);
        paint();
        if (shipList) shipList.set(sunkList(), i);
        return board;
      },
      setPlaceable(groups) { placeable = (groups || []).map((x) => x.slice()); closeChooser(); if (mode === 'place') applyPlaceable(); return board; },
      setPlaced(fleet) { placed = (fleet || []).map((x) => ({ size: x.size, sounds: x.sounds.slice() })); paint(); return board; },
      setHits(ids) { hits = (ids || []).slice(); paint(); return board; },
      setActive(on) { active = !!on; root.classList.toggle('is-active', active); return board; },
      // 지금 고른 자리·방법의 줄·열 머리 표시(줄 이름을 보이는 단계에서만 — 숨긴 단계에서는 어느 열인지 드러내지 않는다)
      setSelection(x) {
        x = x || {};
        const on = (e, v) => {
          e.classList.toggle('is-picked', !!v);
          const had = e.querySelector('.sb-pick');
          if (v && !had) e.insertBefore(U.glyph('check', 'sb-pick'), e.firstChild);
          if (!v && had) had.remove();
        };
        const colOn = (c) => {
          if (!disp.names) return false;
          if (sea === 'vowel') {
            const col = g.cols[c]; // 'front-unrounded' …
            if (!x.backness) return false;
            return col.indexOf(x.backness + '-') === 0 && (!x.lips || col === x.backness + '-' + x.lips);
          }
          return !!x.place && g.cols[c] === x.place;
        };
        const rowOn = (r) => disp.names && (sea === 'vowel' ? !!x.height && g.rows[r] === x.height : !!x.manner && g.rows[r] === x.manner);
        colHeads.forEach((e, c) => on(e, colOn(c)));
        rowHeads.forEach((e, r) => on(e, rowOn(r)));
        return board;
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        if (ro) ro.disconnect(); else window.removeEventListener('resize', layout);
        document.removeEventListener('pointerdown', onDocDown);
        timers.forEach(clearTimeout);
        if (shipList) shipList.destroy();
        root.remove();
      },
    };
    paint();
    lastBox = container.clientWidth + 'x' + (opts.fitHeight ? container.clientHeight : '');
    layout();
    return board;
  }

  function viewOf(state, shooter) {
    shooter = shooter || 'player';
    const opp = state.mode === 'practice' ? (shooter === 'player' ? 'enemy' : 'player') : (shooter === 'blue' ? 'red' : 'blue');
    return { shots: state.teams[shooter].shots, fleet: state.teams[opp].fleet, reveal: false };
  }

  // 소리 지도: 체계표 전체(모든 칸이 읽힘)에 맞힌 소리를 도장으로 찍는다
  function soundMap(container, o) {
    o = o || {};
    const b = create(container, { sea: o.sea, grade: o.grade, mode: 'map', fitHeight: !!o.fitHeight });
    b.setHits(o.hitSounds || []);
    return b;
  }

  return {
    create, soundMap, ships, legend, viewOf, shipPic,
    setImageBase(p) { imgBase = String(p || ''); if (imgBase && !/\/$/.test(imgBase)) imgBase += '/'; },
  };
})();
