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
//   b.update(보기)      render와 같고, 지난번보다 늘어난 발만 연출한다(같은 줄 물결 한 번, 명중 도장 + 큰 불꽃·소리 표기
//                       1.4초(아무 데나 누르면 건너뜀), 빗나감 물보라 한 번, 격침 배 흔들림). 움직임 줄이기면 연출 없이 그린다.
//   b.highlight(강조)   G.rules의 targets를 받아 물결을 한 번 퍼뜨린다 → Promise(끝나면). 흔적은 shots에서 그린다.
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
//   · 바다 질감(sea_tile.webp)·물보라(splash.webp)는 css/board.css가 CSS 파일 기준 주소로 불러온다(그림이 없어도 색으로 보임).
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

  // ── 그림 조각(SVG, 코드로 그림) ─────────────────────────────
  const FLAME = 'M50 6c6 16 22 24 22 44a22 22 0 0 1-44 0c0-9 4-15 9-20 0 8 3 13 8 15-2-14 1-27 5-39z';
  const BURST_MS = 1400; // 명중 연출 길이(2초 이내, css/board.css의 sb-burst와 같이)
  const ICON = {
    // 명중: 불꽃
    hit: '<path d="' + FLAME + '" fill="currentColor"/>',
    // 같은 줄: 번지는 물결 고리
    line: '<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="50" cy="50" r="26" fill="none" stroke="currentColor" stroke-width="5" opacity=".7"/>',
    // 빗나감: 물보라
    miss: '<path d="M50 20c7 12 12 19 12 27a12 12 0 0 1-24 0c0-8 5-15 12-27z" fill="currentColor"/><circle cx="22" cy="44" r="7" fill="currentColor"/><circle cx="78" cy="44" r="7" fill="currentColor"/><circle cx="30" cy="74" r="6" fill="currentColor"/><circle cx="70" cy="74" r="6" fill="currentColor"/><circle cx="50" cy="84" r="5" fill="currentColor"/>',
    // 없는 소리: 불발 연기
    dud: '<g fill="currentColor"><circle cx="34" cy="58" r="18"/><circle cx="54" cy="44" r="22"/><circle cx="70" cy="62" r="16"/><rect x="26" y="58" width="52" height="20" rx="10"/></g>',
    reveal: '',
  };
  function icon(kind) {
    // 빗나감: 물보라 그림(assets/img/splash.webp, 8칸 스프라이트 — css/board.css). 방금 쏜 발만 한 번 튀고 마지막 칸에 멈춘다
    if (kind === 'miss') return U.el('span', { class: 'sb-splash', 'aria-hidden': 'true' });
    if (!ICON[kind]) return null;
    const s = U.svg('svg', { class: 'sb-ico', viewBox: '0 0 100 100', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'xMidYMid meet' });
    s.innerHTML = ICON[kind];
    return s;
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
    // 칸 밑에 까는 바다 질감(assets/img/sea_tile.webp): 판과 같은 격자에서 칸 자리 전체를 덮는다(쏘는 바다만)
    const under = U.el('div', { class: 'sb-under', 'aria-hidden': 'true' }, mode === 'play' ? U.el('div', { class: 'sb-seabed', style: 'grid-row:2 / span ' + R + ';grid-column:2 / span ' + C }) : null);
    const lines = U.svg('svg', { class: 'sb-lines', 'aria-hidden': 'true', focusable: 'false' });
    root.appendChild(under);
    root.appendChild(U.el('div', { class: 'sb-corner' }));
    g.cols.forEach((k) => root.appendChild(U.el('div', { class: 'sb-ch' }, disp.names ? G.text.short(grade, g.cg, k) : '')));
    const cellEls = [];
    for (let r = 0; r < R; r++) {
      root.appendChild(U.el('div', { class: 'sb-rh' }, disp.names ? G.text.short(grade, g.rg, g.rows[r]) : ''));
      cellEls.push([]);
      for (let c = 0; c < C; c++) {
        const ci = cellInfo[r][c];
        let cls = 'sb-cell';
        if (disp.sounds || disp.empty) cls += ' sb-k-' + ci.kind; // 보이는 단계에서만 칸 종류를 드러낸다
        const e = U.el(mode === 'place' ? 'button' : 'div', mode === 'place'
          ? { class: cls, 'data-r': r, 'data-c': c, type: 'button', disabled: true }
          : { class: cls, 'data-r': r, 'data-c': c });
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
    function layout() {
      if (destroyed) return;
      const cs = getComputedStyle(container);
      const W = container.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      if (!(W > 0)) return;
      const Hc = opts.fitHeight ? container.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0) : Infinity;
      const touch = parseFloat(getComputedStyle(root).getPropertyValue('--touch')) || 48;
      const k = measureK();
      const gap = W < 520 ? 3 : 6;
      const rowNames = disp.names ? g.rows.map((x) => G.text.short(grade, g.rg, x)) : [];
      const colNames = disp.names ? g.cols.map((x) => G.text.short(grade, g.cg, x)) : [];
      const rLen = Math.max(2, ...rowNames.map((x) => x.length));
      const cLen = Math.max(2, ...colNames.map((x) => x.length));
      const hw = Math.round(U.clamp(W * 0.1, 34, 96));
      const cw = Math.max(touch, Math.min(160, Math.floor((W - hw - gap * C) / C)));
      // 줄마다 높이: 세기 자리가 셋인 줄(보이는 단계에서만)은 높게, 한 자리 줄은 소리 표기가
      // 칸 높이의 60% 이상이 되도록 너비에 맞춰 낮게. 숨김 단계는 모든 줄이 같다(구조가 드러나지 않게).
      const units = multiRow.map((m) => (m && disp.sounds ? 3 : 1));
      const single = Math.floor((cw - 6) / (k * 0.62));
      const tall = cw * 1.2;
      let rowsH = units.map((u) => (u === 3 ? tall : Math.min(cw * (sea === 'vowel' ? 0.8 : 0.85), single)));
      const hf = U.clamp(Math.min(cw * 0.22, (cw - 4) / cLen), 10, 18);
      const hh = Math.ceil(hf * 1.5) + 8;
      if (isFinite(Hc) && Hc > 0) {
        const avail = Hc - hh - gap * R, sum = rowsH.reduce((a, b) => a + b, 0);
        if (sum > avail) rowsH = rowsH.map((h) => (h * avail) / sum);
      }
      rowsH = rowsH.map((h) => Math.max(touch, Math.floor(h)));
      const ch = Math.min(...rowsH);
      const rf = U.clamp(Math.min(ch * 0.3, (hw - 6) / rLen), 10, 22);
      const cols = hw + 'px repeat(' + C + ', ' + cw + 'px)';
      const rows = hh + 'px ' + rowsH.map((h) => h + 'px').join(' ');
      for (const e of [root, over, under]) {
        e.style.gridTemplateColumns = cols; e.style.gridTemplateRows = rows; e.style.gap = gap + 'px';
      }
      root.style.setProperty('--sb-cw', cw + 'px');
      root.style.setProperty('--sb-k', k.toFixed(3));
      root.style.setProperty('--sb-hf', hf.toFixed(1) + 'px');
      root.style.setProperty('--sb-rf', rf.toFixed(1) + 'px');
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
              const ic = icon(mk.kind); if (ic) slot.insertBefore(ic, slot.firstChild);
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
          const ic = icon(m.kind); if (ic) kids.push(ic);
          if (m.id) kids.push(U.el('span', { class: 'sb-stamp' }, slash(m.id)));
          else if (m.strength) kids.push(U.el('span', { class: 'sb-lab' }, G.text.short(grade, 'strength', m.strength)));
          if (m.kind !== 'reveal') kids.push(U.el('span', { class: 'sb-sr' }, G.text.signalName(m.kind === 'dud' ? 'none' : m.kind)));
          const it = U.el('div', { class: 'sb-mark sb-item k-' + m.kind }, kids);
          stack.appendChild(it);
          m.el = it;
          if (m.id) anchors.set(m.id, it);
        });
      }

      // 강조 흔적(쌓임)
      over.textContent = '';
      if (mode === 'play') view.shots.forEach((sh) => {
        if (sh.kind === 'line' && sh.targets) sh.targets.forEach((t) => over.appendChild(areaEl('sb-trace', t)));
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
    function areaEl(cls, t) {
      const sp = spot(t);
      if (!sp || (sp.r != null && sp.r < 0) || (sp.c != null && sp.c < 0)) return document.createComment('');
      const style = sp.o === 'cell' ? 'grid-row:' + (sp.r + 2) + ';grid-column:' + (sp.c + 2)
        : sp.o === 'col' ? 'grid-row:2 / span ' + R + ';grid-column:' + (sp.c + 2)
          : 'grid-row:' + (sp.r + 2) + ';grid-column:2 / span ' + C;
      return U.el('div', { class: cls + ' o-' + sp.o, 'data-o': sp.o, 'data-r': sp.r, 'data-c': sp.c, style });
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
          timers.push(setTimeout(done, 1500)); // 애니메이션이 꺼져 있어도 남지 않게
        });
      });
    }
    function freshen(e) {
      if (!e || reduced()) return;
      e.classList.add('sb-fresh');
      timers.push(setTimeout(() => e.classList.remove('sb-fresh'), 700));
    }
    // 물보라: 방금 빗나간 칸의 스프라이트를 한 번(0.7초) 튀게 한다. 움직임 줄이기면 마지막 칸 그대로
    function splashNow(e) {
      const sp = e && e.querySelector('.sb-splash');
      if (!sp || reduced()) return;
      sp.classList.remove('is-fresh'); void sp.offsetWidth; sp.classList.add('is-fresh');
    }
    // 명중 연출(spec 8.1): 그 칸 위에 큰 불꽃 + 소리 표기가 떴다가 1.4초 안에 사라진다. 아무 데나 누르면 곧바로 건너뛴다.
    // 누름은 막지 않는다(pointer-events 없음) — 누른 단추·카드는 그대로 눌린다. 움직임 줄이기면 띄우지 않는다(칸의 도장만).
    let burst = null, burstTimer = 0;
    function endBurst() {
      clearTimeout(burstTimer);
      document.removeEventListener('pointerdown', endBurst, true);
      document.removeEventListener('keydown', endBurst, true);
      if (burst) { burst.remove(); burst = null; }
    }
    function burstAt(e, id) {
      endBurst();
      if (!e || destroyed || reduced()) return;
      const rq = root.getBoundingClientRect(), q = e.getBoundingClientRect();
      if (!q.width) return;
      const d = Math.round(Math.max(q.width, q.height, 56) * 1.9);
      const fl = U.svg('svg', { class: 'sb-burst-fire', viewBox: '0 0 100 100', 'aria-hidden': 'true', focusable: 'false' });
      fl.innerHTML = '<path class="f-out" d="' + FLAME + '"/><path class="f-in" d="' + FLAME + '" transform="translate(50 62) scale(.58) translate(-50 -62)"/>';
      burst = U.el('div', {
        class: 'sb-burst', 'aria-hidden': 'true',
        style: 'left:' + (q.left - rq.left + q.width / 2 - d / 2).toFixed(1) + 'px;top:' + (q.top - rq.top + q.height / 2 - d / 2).toFixed(1) + 'px;width:' + d + 'px;height:' + d + 'px;--bd:' + d + 'px',
      }, [fl, U.el('span', { class: 'sb-burst-snd' }, slash(id))]);
      root.appendChild(burst);
      document.addEventListener('pointerdown', endBurst, true);
      document.addEventListener('keydown', endBurst, true);
      burstTimer = setTimeout(endBurst, BURST_MS);
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
            if (sh.sound && (sh.kind === 'hit')) { freshen(anchors.get(sh.sound)); burstAt(anchors.get(sh.sound), sh.sound); }
            if (sh.sound && (sh.kind === 'miss')) splashNow(anchors.get(sh.sound));
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
      destroy() {
        if (destroyed) return;
        destroyed = true;
        if (ro) ro.disconnect(); else window.removeEventListener('resize', layout);
        document.removeEventListener('pointerdown', onDocDown);
        endBurst();
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
