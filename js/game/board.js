'use strict';
// ───────────────────────────────────────────────────────────────
// 바다(판) 그리기 G.board — 판은 교과서의 자음 체계표(5×5)·단모음 체계표(3×4) 그 자체이고,
//   그 밑에 하나로 이어진 '섬과 암초 바다 지도'(등심선·잔물결)가 깔린다(spec 3.3, 선생님 결정 — 시안 C).
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
//                       명중 표지 강조, 격침 배 흔들림). 움직임 줄이기면 강조 없이 그린다. 불꽃 연출은 없다.
//   b.highlight(강조)   G.rules의 targets를 받아 그 범위의 윤곽을 한 번 짧게 강조한다 → Promise(끝나면). 흔적은 shots에서 그린다.
//   b.setSelection(고른것)  지금 고른 자리·방법(자음 { place, manner } / 모음 { backness, height, lips })의 줄·열 머리를
//                       '현재 선택'(청록 + 체크)으로 표시한다. 줄 이름을 숨기는 단계에서는 아무것도 표시하지 않는다.
//   b.revealFleet(배?)  끝날 때 남은 배 공개: 아직 안 맞힌 칸에 소리와 배의 제 모양(온전한 그림)을 드러내고 배마다 가는 선으로 잇는다.
//   b.markSunk(번호)    그 배를 격침으로 표시(불탄 제 모양 + 목록 불탄 그림 + 흔들림). 보통은 shots의 sunkShip으로 저절로 된다.
//   b.setPlaceable(묶음들)  place: 누를 수 있는 묶음(G.rules.placeableGroups). 그 묶음의 칸만 눌린다.
//   b.setPlaced(함대)       place: 이미 놓은 배(팀 색 표지 + 위에서 본 배 그림 + 선 잇기).
//   b.setHits(소리들)       map: 맞힌 소리 도장(황금 표지).
//   b.setActive(bool)       대결: 차례인 팀이 쏘는 바다의 테두리.
//   b.destroy()
//   · 한 칸이 놓을 수 있는 묶음 여러 개에 들면(지금 데이터에서는 생기지 않음) 칸을 누를 때 작은 고르기 창이
//     뜨고, 묶음마다 단추 하나('/ㄱ/ /ㄲ/ /ㅋ/')를 눌러 고른다. 다른 곳을 누르면 닫힌다.
//
// ── 판 옆 조각 ─────────────────────────────────────────────────────────
//   G.board.ships(요소, { sizes: [3,2,1], compact })  → { el, set(격침된 번호들, 방금 격침된 번호, 번호표{배: 숫자}, 함대), destroy }  남은 배 목록
//     가라앉은 배는 불탄 그림 + 이름 자리에 '찾음 · /ㄱ/ /ㄲ/ /ㅋ/'(함대를 주었을 때). 이름을 숨기는 좁은 배치에서는 읽기 도구에만.
//   G.board.legend(요소, { sea })                      → { el, destroy }  배 종류 그림 한 줄씩(G.text.legend)
//   G.board.soundMap(요소, { sea, grade, hitSounds })  → 판 객체(map 모드)  결과 화면·누적 소리 지도(바다 지도 위, 배 조각 없음)
//   G.board.viewOf(판상태, 쏘는팀)                      → { shots, fleet, reveal:false }
//   G.board.setImageBase('assets/img/')                 배 그림 폴더(top_*.webp). 그림이 없으면 코드로 그린 모양.
//   G.board.shipPic(크기, 불탐)                         남은 배 목록의 배 한 척(칸 수만큼의 조각을 이은 위에서 본 배)
//
// ── 바다 지도 · 배 조각(spec 3.3) ─────────────────────────────────────
//   · 격자 전체 밑에 바다 지도 한 장(.sb-sea, 코드로 그린 SVG — 등심선·잔물결). 칸은 얇은 격자선뿐이다.
//   · 소리 표기(.sb-snd/.sb-stamp)는 흰 '바다 표지'(판) 위 잉크 글씨. 쏜 결과에 따라 표지 색만 바뀐다
//     (명중 황금 · 같은 줄 옅은 보라 · 빗나감 옅은 회색 · 공개 흰색+테두리). 모두 명암비 4.5 이상.
//   · 칸(자리)의 위쪽 = 표지, 아래쪽 = 물속에 드러난 것(.sb-obj): 위에서 본 배 조각(img.sb-top) · 물보라 고리(.sb-ripple).
//     자리가 낮으면(.is-row) 드러난 것을 표지 옆 작게 둔다.
//   · 명중(가라앉기 전) = 어느 배든 같은 조각 top_hit(배 크기·종류가 새지 않음).
//     격침 = 제 모양의 불탄 그림: 한 칸 배 top_boat1 · 여러 칸에 걸친 배는 칸마다 뱃머리/가운데/배꼬리
//     (세로로 놓인 배는 위가 뱃머리, 가로로 놓인 배는 오른쪽이 뱃머리) · 한 칸 안의 배(세기만 다른 소리들)는
//     칸 왼쪽에 세운 한 척(.sb-vship)으로.
//   · 떨어진 조각의 격침 배: 점선 끌줄(.sb-tow) + 가운데 작은 배 배지(.sb-towbadge) + 두 조각과 남은 배 목록에 같은 번호(.sb-num, 배 순서+1).
//   · 없는 소리(빈칸) = 그 칸에 암초(.sb-reef) + ∅ 배지(.sb-dudmark). 소리 지도에는 배 조각을 그리지 않는다.
//
// ── 신호 표시(디자인 검수 · spec 5.4·8.1) ─────────────────────────────────
//   명중 = 황금 표지 + 칸 황금 테두리 + 과녁 배지 · 같은 줄 = 보라 윤곽·옅은 바탕(게임이 돌려준 범위에만) + ↔/↕/겹친 네모 기호
//   빗나감 = 물보라 고리 + × · 없는 소리 = 암초 + ∅. 최근 발(.is-latest)은 공통 잉크 테두리, 이전 발은 같은 기호의 배지.
//   맞히지 않은 소리는 언제나 기본 잉크(흐리게 하지 않음). 소리 표기는 한 판 안에서 모두 같은 크기(--sb-fs).
//
// ── 숨김(단계, spec 4) ─────────────────────────────────────────────────
//   칸 안 소리를 숨기는 단계에서는 25칸(12칸)을 모두 같은 모양으로 그린다: 빈칸·세기 자리·소리·암초·자물쇠·배 조각이
//   DOM 속성·글·aria 어디에도 없다(칸의 자리는 data-r/data-c 번호뿐, 바다 지도는 칸 밖의 한 장). 쏜 뒤에야 그 칸에 표시가 생긴다.
//   줄 이름을 숨기는 단계는 머리글이 빈다.
//   배치(place) 화면은 단계와 상관없이 소리와 줄 이름을 보인다(spec 6.3). 소리 지도(map)는 모두 보인다.
// ───────────────────────────────────────────────────────────────
G.board = (function () {
  const U = G.util, S = window.SOUNDS;
  const ORDER = { plain: 0, tense: 1, aspirated: 2, none: 0 };
  const KIND_RANK = { hit: 0, reveal: 1, line: 2, miss: 3, dud: 4 };
  const byId = {};
  S.consonants.concat(S.vowels).forEach((s) => { byId[s.id] = s; });
  const slash = (id) => G.text.sound(id);
  let imgBase = 'assets/img/';

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

  // ── 위에서 본 배 그림 ─────────────────────────────────────────
  // 조각 이름: hit(가라앉기 전 명중, 어느 배든 같음) · bow 뱃머리 · mid 가운데 · stern 배꼬리 · boat1 한 칸 배
  const HULL = { // 그림 파일이 없을 때 대신 그리는 모양(200 × 100, 뱃머리 오른쪽)
    bow: 'M0 12H112C160 12 188 32 196 50C188 68 160 88 112 88H0Z',
    mid: 'M0 12H200V88H0Z', hit: 'M20 12H180V88H20Z',
    stern: 'M200 12H36C18 12 8 24 8 40V60C8 76 18 88 36 88H200Z',
    boat1: 'M28 12H118C162 12 188 32 196 50C188 68 162 88 118 88H28C16 88 8 80 8 68V32C8 20 16 12 28 12Z',
  };
  function hullSvg(part, burnt, cls) {
    const s = U.svg('svg', { viewBox: '-6 -6 212 112', class: 'sb-top sb-top-svg ' + (cls || '') + (burnt ? ' is-burnt' : ''), 'aria-hidden': 'true', focusable: 'false', 'data-piece': part });
    s.innerHTML = '<path class="sb-hull" d="' + (HULL[part] || HULL.mid) + '"/>';
    return s;
  }
  // <img class="sb-top" data-piece="bow" data-burnt>: 그림이 없으면(오류) 코드 모양으로 바꾼다
  function topImg(part, burnt, cls) {
    const im = U.el('img', { class: 'sb-top ' + (cls || ''), src: imgBase + 'top_' + part + (burnt ? '_burnt' : '') + '.webp', alt: '', draggable: 'false', 'data-piece': part, 'data-burnt': burnt ? '1' : null });
    im.addEventListener('error', () => { if (im.parentNode) im.parentNode.replaceChild(hullSvg(part, burnt, cls), im); }, { once: true });
    return im;
  }
  // 남은 배 목록의 배 한 척: 칸 수만큼의 조각(배꼬리 … 뱃머리)을 잇는다. 모든 배가 같은 축척(조각 하나 = 한 칸)
  const SEGS = { 1: ['boat1'], 2: ['stern', 'bow'], 3: ['stern', 'mid', 'bow'] };
  function shipPic(size, burnt) {
    const box = U.el('span', { class: 'sb-pic is-top' + (burnt ? ' is-burnt' : ''), 'data-size': size });
    (SEGS[size] || SEGS[1]).forEach((p) => box.appendChild(topImg(p, burnt, 'sb-seg p-' + p)));
    return box;
  }
  // 한 칸 안의 배(세기만 다른 소리들): 뱃머리를 위로 세운 한 척
  function vship(parts, burnt, ship) {
    const box = U.el('span', { class: 'sb-vship' + (burnt ? ' is-burnt' : ''), 'aria-hidden': 'true', 'data-ship': ship });
    const inner = U.el('span', { class: 'sb-vship-in' });
    parts.slice().reverse().forEach((p) => inner.appendChild(topImg(p, burnt, 'sb-seg p-' + p))); // 가로로 배꼬리→뱃머리, 돌려 세움
    box.appendChild(inner);
    return box;
  }
  // 물보라 고리(빗나감) · 암초(없는 소리)
  function ripple() {
    const s = U.svg('svg', { viewBox: '0 0 200 100', class: 'sb-ripple', 'aria-hidden': 'true', focusable: 'false' });
    s.innerHTML = '<ellipse cx="100" cy="50" rx="70" ry="30" class="r1"/><ellipse cx="100" cy="50" rx="44" ry="18" class="r2"/>' +
      '<ellipse cx="100" cy="50" rx="92" ry="42" class="r3"/><circle cx="100" cy="50" r="7" class="rd"/>' +
      '<circle cx="28" cy="18" r="4.5" class="rd"/><circle cx="172" cy="84" r="4.5" class="rd"/>';
    return s;
  }
  function reef() {
    const s = U.svg('svg', { viewBox: '0 0 200 140', class: 'sb-reef', 'aria-hidden': 'true', focusable: 'false' });
    s.innerHTML =
      '<path class="rf-foam" d="M22 92C30 64 60 50 92 54 120 40 164 52 178 80 188 102 160 122 118 118 84 128 36 122 22 92Z"/>' +
      '<path class="rf-rock" d="M46 96L64 60 84 72 100 40 122 66 142 58 158 96Z"/>' +
      '<path class="rf-crack" d="M64 60L74 82M100 40L104 76M122 66L130 86"/>' +
      '<path class="rf-lit" d="M100 40L112 54 104 60Z M64 60L72 70 66 72Z"/>' +
      '<circle class="rf-rock" cx="34" cy="70" r="8"/><circle class="rf-rock" cx="170" cy="108" r="7"/>';
    return s;
  }

  // ── 바다 지도 한 장(격자 전체 밑): 깊은 곳 몇 군데를 둘러싼 등심선 + 잔물결. 모양은 고정(같은 판이면 같은 그림) ──
  function seaSvg(w, h) {
    let t = 11;
    const rnd = () => { t = (t * 16807) % 2147483647; return (t - 1) / 2147483646; };
    const blob = (cx, cy, rx, ry, k) => {
      const n = 10, pts = [], ph = rnd() * 6.28;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = 1 + 0.13 * Math.sin(a * 3 + ph + k) + 0.07 * Math.sin(a * 5 + ph * 2);
        pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
      }
      let d = '';
      for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
        if (!i) d += 'M' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1);
        d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' +
          (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
      }
      return d + 'Z';
    };
    let deep = '', lines = '';
    [[0.3, 0.62, 0.34, 0.42], [0.74, 0.3, 0.3, 0.36], [0.82, 0.86, 0.2, 0.22]].forEach(([x, y, rx, ry], j) => {
      for (let k = 0; k < 4; k++) {
        const s = 1 - k * 0.24;
        const d = blob(x * w, y * h, rx * w * s, ry * h * s, j + k * 0.4);
        deep += '<path d="' + d + '" fill="#1B5F82" fill-opacity=".045"/>';
        lines += '<path d="' + d + '" fill="none" stroke="#1B5F82" stroke-opacity="' + (0.12 + k * 0.02).toFixed(2) + '" stroke-width="1.4"/>';
      }
    });
    let waves = '';
    const nW = Math.max(12, Math.round(w * h / 9000));
    for (let i = 0; i < nW; i++) {
      const x = rnd() * w, y = rnd() * h, s = 4 + rnd() * 4;
      waves += '<path d="M' + x.toFixed(0) + ' ' + y.toFixed(0) + 'q' + s.toFixed(1) + ' -' + (s * 0.7).toFixed(1) + ' ' + (2 * s).toFixed(1) + ' 0"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CBE8EF"/><stop offset="1" stop-color="#AFD8E5"/></linearGradient></defs>' +
      '<rect width="100%" height="100%" fill="url(#g)"/>' + deep + lines +
      '<g fill="none" stroke="#FFFFFF" stroke-opacity=".75" stroke-width="1.6" stroke-linecap="round">' + waves + '</g></svg>';
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
      // set(격침된 배 번호들, 방금 격침된 번호(연출, 선택), 번호표 { 배 번호: 표시할 숫자 }(선택 — 떨어진 조각을 잇는 번호),
      //     함대(선택 — 주면 가라앉은 배 이름 자리에 '찾음'과 그 배의 소리. 가라앉은 뒤라 숨길 것이 없다))
      set(sunk, fresh, nums, fleet) {
        sunk = sunk || [];
        nums = nums || {};
        items.forEach((it, i) => {
          const on = sunk.indexOf(i) >= 0, was = sunkNow.indexOf(i) >= 0;
          if (on !== was) {
            it.classList.toggle('is-sunk', on);
            it.replaceChild(shipPic(sizes[i], on), it.querySelector('.sb-pic'));
          }
          const ship = fleet && fleet[i];
          const label = on && ship && ship.sounds ? G.text.fill(TEXT.ui.play.shipFound, { sounds: ship.sounds.map(G.text.sound).join(' ') }) : G.text.shipName(sizes[i]);
          const nameEl = it.querySelector('.sb-ship-name');
          if (nameEl.textContent !== label) nameEl.textContent = label;
          it.classList.toggle('has-found', on && !!(ship && ship.sounds));
          const old = it.querySelector('.sb-num');
          const want = on && nums[i] != null ? String(nums[i]) : '';
          if (old && old.textContent !== want) old.remove();
          if (want && (!old || old.textContent !== want)) it.querySelector('.sb-pic').appendChild(U.el('span', { class: 'sb-num', 'aria-hidden': 'true' }, want));
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
    // 바다 지도 한 장(격자 영역 전체, 칸 밖) — 숨긴 단계에서도 모든 칸 밑에 똑같이 깔린다
    const seaEl = U.el('div', { class: 'sb-sea', 'aria-hidden': 'true', style: 'grid-row:2 / span ' + R + ';grid-column:2 / span ' + C });
    let seaKey = '';
    // 쏘는 바다: 같은 줄 범위의 방향 기호가 판 오른쪽·아래 가장자리에 걸쳐 놓이므로 그만큼 여백을 둔다
    let PAD = mode === 'play' ? 12 : 0; // 좁은 판(휴대폰)은 layout()이 줄인다
    if (PAD) for (const e of [root, over]) { e.style.paddingRight = PAD + 'px'; e.style.paddingBottom = PAD + 'px'; }
    root.appendChild(seaEl);
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
        // 이번 단계에서 뺀 칸(자음 1단계의 /ㅎ/ 칸): 옅은 안개 + 잠금 기호(보이는 단계에서만)
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
    let size = { cw: 0, ch: 0, F: 0 };
    let lastBox = '';
    // 소리 표지(판 포함) 한 개의 너비 / 글씨 크기 — 이 판에 나올 가장 넓은 소리로 잰다
    //   (보이는 쏘는 바다는 그 단계에 열린 소리 가운데 가장 넓은 것, 그 밖에는 가장 넓은 소리 /ㅃ/·/ㅚ/)
    function measureK() {
      const ids = mode === 'play' && disp.sounds ? open : [sea === 'vowel' ? 'ㅚ' : 'ㅃ'];
      let k = 0;
      for (const id of ids) {
        const m = U.el('span', { class: 'sb-snd sb-measure' }, slash(id));
        root.appendChild(m);
        k = Math.max(k, m.getBoundingClientRect().width / 100);
        m.remove();
      }
      return k > 0.5 && k < 4 ? k : 2.1;
    }
    // 긴 열 이름은 두 줄로 나눈다(용어는 줄이지 않는다): '여린입천장' → 여린 / 입천장, '앞·둥글게' → 앞· / 둥글게
    function headHTML(name, two) {
      if (!two || name.length < 4) return null;
      let i = name.indexOf('·') + 1;
      if (i <= 0) { const j = name.indexOf('입천장'); i = j > 0 ? j : Math.floor(name.length / 2); }
      return [name.slice(0, i), name.slice(i)];
    }
    // 크기: 한 판 안에서 소리 표기(--sb-fs)는 모두 같은 크기. 줄 높이는 내용에 맞춘다
    //   쏘는 바다(play)의 한 자리 줄 = 2.1 × 글씨(위: 표지, 아래: 물속에 드러나는 배 조각·물보라·암초)
    //   배치·소리 지도의 한 자리 줄 = 1.6 × 글씨, 세기 자리가 셋인 줄 = 자리마다 1.36 × 글씨. 모두 터치 목표 이상.
    //   소리 표지 글씨는 칸 너비 안에 들어가게(표지 여백 포함).
    function layout() {
      if (destroyed) return;
      const cs = getComputedStyle(container);
      const W0 = container.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      if (!(W0 > 0)) return;
      if (mode === 'play') {
        PAD = W0 < 520 ? 10 : 14;
        for (const e of [root, over]) { e.style.paddingRight = PAD + 'px'; e.style.paddingBottom = PAD + 'px'; }
      }
      const W = W0 - PAD;
      const Hc = opts.fitHeight ? container.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0) - PAD : Infinity;
      const touch = parseFloat(getComputedStyle(root).getPropertyValue('--touch')) || 48;
      const k = measureK();
      const narrow = W < 520;
      const rowNames = disp.names ? g.rows.map((x) => G.text.short(grade, g.rg, x)) : [];
      const colNames = disp.names ? g.cols.map((x) => G.text.short(grade, g.cg, x)) : [];
      const rLen = Math.max(0, ...rowNames.map((x) => x.length));
      const cLen = Math.max(2, ...colNames.map((x) => x.length));
      // 축 이름 글씨: 칸 너비에 비례(휴대폰 16~18 · 대결 반쪽 25 안팎 · 칠판 28~30)
      const cw0 = (W * 0.86) / C;
      const axis = U.clamp(cw0 * 0.3, 16, 30); // 대결 반쪽 판(≈500px)에서도 25px 안팎(검수 2b)
      const hw = disp.names ? Math.round(U.clamp(rLen * axis + 12, 34, W * 0.2)) : Math.round(U.clamp(W * 0.03, 8, 16));
      const cw = Math.max(touch, Math.min(170, Math.floor((W - hw) / C)));
      const rf = U.clamp(Math.min(axis, (hw - 10) / Math.max(1, rLen)), 14, 30);
      let hf = U.clamp(Math.min(axis, (cw - 6) / cLen), 14, 30), two = false;
      if (disp.names && hf < axis * 0.95 && cLen >= 4) { // 한 줄이면 너무 작아짐 → 두 줄
        two = true;
        hf = U.clamp(Math.min(axis, (cw - 6) / Math.ceil(cLen / 2 + 0.5)), 14, 30);
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
      // 소리 표기 글씨(한 판 안에서 같은 크기). 표지 너비 = k × 글씨
      const widthCap = (cw - (narrow ? 4 : 10)) / k;
      // 소리 지도(체계표 전체)는 행이 많아 한 화면에 들어오게 조금 작게(검수 시작값: 태블릿 36~40)
      const cap = mode === 'map' ? (W >= 1100 ? 44 : 38) : 56;
      let F = Math.min(widthCap, cap, Math.max(28, cw * 0.36)); // 휴대폰에서도 28px 이상(칸 너비가 허락하는 한)
      const one = mode === 'play' ? 2.1 : 1.6;
      const multi = multiRow.map((m) => m && disp.sounds);
      const rowsFor = (f) => multi.map((m) => (m ? Math.max(touch, Math.round(f * 1.36) * 3) : Math.max(touch, Math.round(f * one))));
      let rowsH = rowsFor(F);
      if (isFinite(Hc) && Hc > 0) {
        const avail = Hc - hh;
        for (let n = 0; n < 4; n++) {
          const sum = rowsH.reduce((a, b) => a + b, 0);
          if (sum <= avail) break;
          F = Math.max(12, F * avail / sum);
          rowsH = rowsFor(F);
        }
      }
      // 터치 목표 때문에 줄이 글씨보다 크게 남으면 글씨를 그만큼 키운다(칸 너비 안에서)
      rowsH.forEach((h, r) => { if (!multi[r]) F = Math.max(F, Math.min(widthCap, h / one)); else F = Math.max(F, Math.min(widthCap, (h / 3) / 1.36)); });
      const ch = Math.min(...rowsH);
      const cols = hw + 'px repeat(' + C + ', ' + cw + 'px)';
      const rows = hh + 'px ' + rowsH.map((h) => h + 'px').join(' ');
      for (const e of [root, over]) { e.style.gridTemplateColumns = cols; e.style.gridTemplateRows = rows; e.style.gap = '0px'; }
      root.style.setProperty('--sb-cw', cw + 'px');
      root.style.setProperty('--sb-k', k.toFixed(3));
      root.style.setProperty('--sb-fs', F.toFixed(1) + 'px');
      root.style.setProperty('--sb-hf', hf.toFixed(1) + 'px');
      root.style.setProperty('--sb-rf', rf.toFixed(1) + 'px');
      root.classList.toggle('sb-two', two);
      root.classList.toggle('sb-narrow', narrow);
      // 바다 지도: 격자 크기가 바뀔 때만 다시 그린다
      const sw = cw * C, sh = rowsH.reduce((a, b) => a + b, 0), key = sw + 'x' + sh;
      if (key !== seaKey) { seaKey = key; seaEl.style.backgroundImage = 'url("data:image/svg+xml,' + encodeURIComponent(seaSvg(sw, sh)) + '")'; }
      size = { cw, ch, F };
      fit();
    }
    // 표시 하나하나의 높이를 재어 소리 표기 크기(--h)를 정하고, 낮은 자리는 드러난 것을 표지 옆으로(.is-row), 선을 다시 긋는다
    function fit() {
      if (destroyed || !size.cw) return;
      for (const e of root.querySelectorAll('.sb-slot, .sb-item')) {
        const h = e.getBoundingClientRect().height / (+e.dataset.u || 1);
        e.style.setProperty('--h', h.toFixed(1) + 'px');
        if (e.querySelector(':scope > .sb-obj')) e.classList.toggle('is-row', h < size.F * 1.8);
      }
      for (const v of root.querySelectorAll('.sb-vship')) {
        const q = v.parentNode.getBoundingClientRect();
        v.style.setProperty('--vh', Math.max(10, q.height - 8).toFixed(1) + 'px');
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
    // 배 그림이 늦게 들어오면 선을 다시 긋는다
    root.addEventListener('load', (ev) => { if (ev.target && ev.target.classList && ev.target.classList.contains('sb-top')) fit(); }, true);

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
    // 배 한 척의 모양: 칸 하나에 다 있으면 세운 한 척(whole), 여러 칸이면 칸마다 조각(세로 = 위가 뱃머리, 가로 = 오른쪽이 뱃머리)
    function shapeOf(ship) {
      const cells = ship.sounds.filter((id) => byId[id]).map((id) => ({ id, p: g.rc(byId[id]) }));
      const n = cells.length;
      if (n === 1) return { whole: false, parts: { [cells[0].id]: 'boat1' }, split: false };
      const same = cells.every((x) => x.p[0] === cells[0].p[0] && x.p[1] === cells[0].p[1]);
      if (same) {
        const ids = cells.map((x) => x.id).sort((a, b) => ORDER[byId[a].strength || 'none'] - ORDER[byId[b].strength || 'none']);
        return { whole: true, cell: cells[0].p, ids, list: n === 2 ? ['bow', 'stern'] : ['bow', 'mid', 'stern'], split: false };
      }
      const row = cells.every((x) => x.p[0] === cells[0].p[0]);
      cells.sort((a, b) => (row ? a.p[1] - b.p[1] : a.p[0] - b.p[0]));
      const names = row ? (n === 2 ? ['stern', 'bow'] : ['stern', 'mid', 'bow']) : (n === 2 ? ['bow', 'stern'] : ['bow', 'mid', 'stern']);
      const parts = {};
      cells.forEach((x, i) => { parts[x.id] = names[i] || 'mid'; });
      return { whole: false, parts, split: true, order: cells.map((x) => x.id), row };
    }
    function paint() {
      closeChooser();
      anchors = new Map();
      const per = cellEls.map((row) => row.map(() => []));
      const hitSet = new Set();
      // 최근 발(판에 표시가 남는 마지막 발): 공통 잉크 테두리. 이전 발은 같은 기호의 배지
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

      // 배 조각: 소리 id → { part, burnt, ship, num }, 한 칸 안의 배 → 칸 [행,열] → { list, burnt, ship }
      const sunk = sunkList();
      const piece = new Map(), whole = new Map();
      const nums = {};
      const addShip = (ship, i, burnt, onlyIds) => {
        const sp = shapeOf(ship);
        if (sp.whole) { whole.set(sp.cell.join(','), { list: sp.list, burnt, ship: i }); return; }
        const num = burnt && sp.split ? i + 1 : null;
        if (num != null) nums[i] = num;
        Object.keys(sp.parts).forEach((id) => { if (!onlyIds || onlyIds.has(id)) piece.set(id, { part: sp.parts[id], burnt, ship: i, num }); });
      };
      if (mode === 'play' && view.fleet) {
        view.fleet.forEach((ship, i) => {
          if (sunk.indexOf(i) >= 0) addShip(ship, i, true);
          else if (view.reveal) addShip(ship, i, false); // 끝난 판의 공개: 남은 배도 제 모양(온전한 그림)
        });
      }
      if (mode === 'place') placed.forEach((ship, i) => addShip(ship, i, false));

      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const cell = cellEls[r][c], ci = cellInfo[r][c];
        const marks = per[r][c].sort((a, b) => a.order - b.order || KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.i - b.i);
        cell.textContent = '';
        cell.classList.remove('has-hit', 'has-vship');
        if ((disp.sounds || disp.empty) && ci.kind === 'closed') cell.appendChild(U.glyph('lock', 'sb-lock'));
        if (mode === 'place') cell.classList.toggle('has-placed', ci.on.some((s) => placedIds.has(s.id)));
        const wv = mode !== 'map' ? whole.get(r + ',' + c) : null;
        if (wv) { cell.appendChild(vship(wv.list, wv.burnt, wv.ship)); cell.classList.add('has-vship'); }
        const stack = U.el('div', { class: 'sb-stack' });
        cell.appendChild(stack);
        const loose = [];
        // 물속에 드러난 것(자리 아래쪽): 배 조각 / 물보라 고리
        const objFor = (kind, id) => {
          if (mode === 'map') return null;
          if (kind === 'miss') return U.el('span', { class: 'sb-obj', 'aria-hidden': 'true' }, ripple());
          const pc = id && piece.get(id);
          let part = null, burnt = false, ship = null, num = null;
          if (pc) ({ part, burnt, ship, num } = pc);
          else if (kind === 'hit' && mode === 'play' && !wv) part = 'hit'; // 가라앉기 전: 어느 배든 같은 조각
          if (!part) return null;
          const o = U.el('span', { class: 'sb-obj', 'aria-hidden': 'true', 'data-ship': ship, 'data-part': part }, topImg(part, burnt, 'sb-piece'));
          if (num != null) o.appendChild(U.el('span', { class: 'sb-num' }, String(num)));
          return o;
        };
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
            let obj = null;
            if (mk) {
              slot.classList.add('sb-mark', 'k-' + mk.kind);
              if (mk.i === latest) slot.classList.add('is-latest');
              const ic = badge(mk.kind, mk.kind === 'line' ? dirOf(mk.i) : null); if (ic) slot.appendChild(ic);
              if (mk.kind !== 'reveal') slot.appendChild(U.el('span', { class: 'sb-sr' }, G.text.signalName(mk.kind === 'dud' ? 'none' : mk.kind)));
              if (mk.kind === 'hit') cell.classList.add('has-hit');
              obj = objFor(mk.kind, s.id);
              mk.el = slot;
            } else if (placedIds.has(s.id)) obj = objFor('placed', s.id);
            if (obj) { slot.appendChild(obj); slot.classList.add('has-obj'); const nb = obj.querySelector('.sb-num'); if (nb) slot.appendChild(nb); }
            if (placedIds.has(s.id)) slot.classList.add('is-placed');
            cell.appendChild(slot);
            anchors.set(s.id, slot);
          });
          marks.forEach((m) => { if (!m.el) loose.push(m); });
        } else marks.forEach((m) => loose.push(m));
        // 칸 안에 차례로 쌓는 표시(숨김 단계, 빈칸의 불발)
        loose.forEach((m) => {
          const kids = [];
          if (m.kind === 'dud') { // 없는 소리: 그 칸에 암초 + ∅ 배지(세기를 고른 불발이면 세기 이름)
            kids.push(reef());
            kids.push(U.glyph('dud', 'sb-badge sb-dudmark'));
          }
          if (m.id) kids.push(U.el('span', { class: 'sb-stamp' }, slash(m.id)));
          else if (m.strength) kids.push(U.el('span', { class: 'sb-lab' }, G.text.short(grade, 'strength', m.strength)));
          if (m.kind !== 'reveal') kids.push(U.el('span', { class: 'sb-sr' }, G.text.signalName(m.kind === 'dud' ? 'none' : m.kind)));
          const ic = m.kind !== 'dud' ? badge(m.kind, m.kind === 'line' ? dirOf(m.i) : null) : null; if (ic) kids.push(ic);
          const obj = m.kind !== 'dud' ? objFor(m.kind, m.id) : null;
          if (obj) kids.push(obj);
          const it = U.el('div', { class: 'sb-mark sb-item k-' + m.kind + (m.i === latest ? ' is-latest' : '') + (obj ? ' has-obj' : '') }, kids);
          const nb = obj && obj.querySelector('.sb-num'); if (nb) it.appendChild(nb); // 번호는 자리 모서리에(표지 위)
          if (m.kind === 'hit') cell.classList.add('has-hit');
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

      // 선: 격침(떨어진 조각만 점선 끌줄) · 공개(가는 선) · 놓은 배
      lineSpecs = [];
      if (view.fleet) view.fleet.forEach((ship, i) => {
        if (sunk.indexOf(i) >= 0) lineSpecs.push({ i, t: 'sunk', ids: ship.sounds, shape: shapeOf(ship) });
        else if (view.reveal) lineSpecs.push({ i, t: 'reveal', ids: ship.sounds });
      });
      if (mode === 'place') placed.forEach((ship, i) => lineSpecs.push({ i, t: 'placed', ids: ship.sounds }));
      lastNums = nums;
      if (shipList) shipList.set(sunk, undefined, nums, view.fleet);
      if (mode === 'place') applyPlaceable();
      fit();
    }
    let lastNums = {};

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
      const sw = Math.max(3, Math.round(size.cw * 0.05));
      const rel = (q) => ({ l: q.left - rq.left, r: q.right - rq.left, t: q.top - rq.top, b: q.bottom - rq.top, cx: q.left + q.width / 2 - rq.left, cy: q.top + q.height / 2 - rq.top });
      lineSpecs.forEach((ln) => {
        if (ln.t === 'sunk') {
          // 한 칸 안의 배·한 칸 배는 선 없음. 떨어진 조각은 점선 끌줄 + (자리가 넉넉하면) 가운데 작은 배 배지
          const sp = ln.shape;
          if (!sp || !sp.split) return;
          const objs = sp.order.map((id) => root.querySelector('.sb-obj[data-ship="' + ln.i + '"][data-part="' + sp.parts[id] + '"]')).filter(Boolean);
          if (objs.length < 2) return;
          let best = null;
          for (let j = 0; j + 1 < objs.length; j++) {
            const a = rel(objs[j].getBoundingClientRect()), b = rel(objs[j + 1].getBoundingClientRect());
            let x1, y1, x2, y2;
            if (sp.row) { x1 = a.r + 2; y1 = a.cy; x2 = b.l - 2; y2 = b.cy; }
            else {
              const mk = objs[j + 1].parentNode, lab = mk && mk.querySelector('.sb-snd, .sb-stamp');
              const top = lab && !mk.classList.contains('is-row') ? rel(lab.getBoundingClientRect()).t : b.t;
              x1 = a.cx; y1 = a.b + 2; x2 = a.cx; y2 = top - 3;
            }
            if (!sp.row && y2 < y1) y2 = y1; // 이웃한 칸이면 아주 짧은 줄(번호로 이어 읽는다)
            lines.appendChild(U.svg('path', { class: 'sb-ln sb-tow t-sunk', 'data-ship': ln.i, 'data-t': 'sunk', d: 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'L' + x2.toFixed(1) + ' ' + y2.toFixed(1), 'stroke-width': Math.max(2.5, sw * 0.7).toFixed(1) }));
            const len = Math.hypot(x2 - x1, y2 - y1);
            if (!best || len > best.len) best = { len, x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
          }
          const bh = U.clamp(size.cw * 0.24, 20, 38), bw = bh * 2.4;
          if (best && best.len > bh * 1.5) {
            const gb = U.svg('g', { class: 'sb-towbadge', 'data-ship': ln.i });
            gb.appendChild(U.svg('rect', { x: (best.x - bw / 2).toFixed(1), y: (best.y - bh / 2).toFixed(1), width: bw.toFixed(1), height: bh.toFixed(1), rx: (bh / 2).toFixed(1) }));
            // 배지 안의 작은 배: 조각 수만큼 이은 윤곽(코드로 그림 — 그림 파일이 없어도 같다)
            const n = (ln.shape.order || []).length, pw = (bw * 0.74) / Math.max(2, n), ph = bh * 0.5;
            ln.shape.order.slice().sort((a, b) => ['stern', 'mid', 'bow'].indexOf(ln.shape.parts[a]) - ['stern', 'mid', 'bow'].indexOf(ln.shape.parts[b])).forEach((id, j) => {
              const x0 = best.x - bw * 0.37 + pw * j, y0 = best.y - ph / 2;
              gb.appendChild(U.svg('path', { class: 'sb-tb-hull', d: HULL[ln.shape.parts[id]] || HULL.mid, transform: 'translate(' + x0.toFixed(1) + ',' + y0.toFixed(1) + ') scale(' + (pw / 204).toFixed(4) + ',' + (ph / 100).toFixed(4) + ')' }));
            });
            lines.appendChild(gb);
          }
          return;
        }
        const pts = ln.ids.map((id) => anchors.get(id)).filter(Boolean).map((e) => {
          const q = e.getBoundingClientRect();
          return [q.left + q.width / 2 - rq.left, q.top + q.height / 2 - rq.top];
        });
        if (!pts.length) return;
        const cls = 'sb-ln t-' + ln.t;
        if (pts.length === 1) {
          lines.appendChild(U.svg('circle', { class: cls, 'data-ship': ln.i, 'data-t': ln.t, cx: pts[0][0].toFixed(1), cy: pts[0][1].toFixed(1), r: (Math.min(size.cw, size.ch) * 0.42).toFixed(1), 'stroke-width': Math.max(2, sw * 0.6) }));
          return;
        }
        lines.appendChild(U.svg('polyline', { class: cls, 'data-ship': ln.i, 'data-t': ln.t, points: pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '), 'stroke-width': Math.max(2, sw * 0.6) }));
        pts.forEach((p) => lines.appendChild(U.svg('circle', { class: 'sb-dot t-' + ln.t, cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: (sw * 1.1).toFixed(1) })));
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
          if (shipList && nowSunk.length) shipList.set(sunkList(), nowSunk[nowSunk.length - 1], lastNums, view.fleet);
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
        if (shipList) shipList.set(sunkList(), i, lastNums, view.fleet);
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

  // 소리 지도: 체계표 전체(모든 칸이 읽힘)에 맞힌 소리를 황금 표지로 찍는다(바다 지도 위, 배 조각 없음)
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
