'use strict';
// T20 2a — 시안 C 다시 그리기(선생님 선택: 섬과 암초 바다 지도). 보기 전용(tests/pages/board-concepts.html?c=c2).
//   · 판 전체 밑에 하나로 이어진 바다 지도(등심선·잔물결)를 깔고, 그 위에 얇은 체계표 격자와 소리 표지(흰 판)를 놓는다.
//   · 칸 위쪽 = 소리 표지, 아래쪽 = 물속에 드러난 것(배 조각·물보라 고리·암초). 표지는 쏜 결과에 따라 색만 바뀐다.
//   · 명중 = 표지가 황금 + 칸 황금 테두리 + 과녁 배지 + 위에서 본 배 조각(가라앉기 전엔 모든 배가 같은 가운데 조각).
//   · 격침 = 제 모양(한 칸 배 한 척 / 떨어진 두 칸 배는 뱃머리·배꼬리 / 한 칸 안 세 칸 배는 세운 한 척) + 불탄 그림.
//     떨어진 두 칸 배 잇기: tow=dotted(점선 끌줄 + 배 배지) / tow=badges(선 없이 두 조각과 남은 배 목록에 같은 번호).
//   · 없는 소리(빈칸) = 암초 + ∅ 배지. 숨긴 단계는 쏘기 전 25칸이 모두 같은 바다(격자만).
window.makeBC2 = function (ctx) {
  const { S, U, short, slash, el, glyphSvg, badge, SVGNS } = ctx;
  const IMG = '../../assets/img/';
  const ORD = { plain: 0, tense: 1, aspirated: 2, none: 0 };
  const sndOf = (id) => S.consonants.find((x) => x.id === id);
  const SIZES = {
    wide: { hw: 120, cw: 170, hh: 56, ch: 130, fs: 52, hf: 28, rf: 28, badge: 30 },
    phone: { hw: 52, cw: 60, hh: 46, ch: 58, fs: 28, hf: 16, rf: 16, badge: 20 },
    mini: { hw: 70, cw: 76, hh: 34, ch: 50, fs: 20, hf: 16, rf: 16, badge: 16 },
  };

  // ── 하나로 이어진 바다 지도(격자 전체 밑) ───────────────────────
  // 깊은 곳 몇 군데를 중심으로 매끈한 닫힌 곡선(등심선)을 겹겹이. 난수는 고정(같은 모양).
  function seaMap(w, h, seed) {
    let t = seed || 7;
    const rnd = () => { t = (t * 16807) % 2147483647; return (t - 1) / 2147483646; };
    const blob = (cx, cy, rx, ry, k) => {
      const n = 10, pts = [];
      const ph = rnd() * 6.28;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = 1 + 0.13 * Math.sin(a * 3 + ph + k) + 0.07 * Math.sin(a * 5 + ph * 2);
        pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
      }
      let d = '';
      for (let i = 0; i < n; i++) { // 캣멀롬 → 베지어(닫힌 곡선)
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
        lines += '<path d="' + d + '" fill="none" stroke="#1B5F82" stroke-opacity="' + (0.16 + k * 0.03).toFixed(2) + '" stroke-width="1.4"/>';
      }
    });
    let waves = '';
    for (let i = 0; i < Math.round(w * h / 9000); i++) {
      const x = rnd() * w, y = rnd() * h, s = 5 + rnd() * 4;
      waves += '<path d="M' + x.toFixed(0) + ' ' + y.toFixed(0) + 'q' + s + ' -' + (s * 0.7).toFixed(1) + ' ' + (2 * s) + ' 0" />';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CBE8EF"/><stop offset="1" stop-color="#AFD8E5"/></linearGradient></defs>' +
      '<rect width="100%" height="100%" fill="url(#g)"/>' + deep + lines +
      '<g fill="none" stroke="#FFFFFF" stroke-opacity=".75" stroke-width="1.6" stroke-linecap="round">' + waves + '</g></svg>';
  }

  function img(name, cls) { const i = el('img', cls); i.src = IMG + name + '.webp'; i.alt = ''; i.draggable = false; return i; }
  // 물보라 고리(빗나감)·암초(없는 소리)
  function splash() {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 200 100'); s.setAttribute('class', 'c2-splash');
    s.innerHTML = '<ellipse cx="100" cy="50" rx="70" ry="30" fill="none" stroke="#FFFFFF" stroke-width="4"/>' +
      '<ellipse cx="100" cy="50" rx="46" ry="19" fill="none" stroke="#FFFFFF" stroke-width="3" opacity=".8"/>' +
      '<ellipse cx="100" cy="50" rx="92" ry="42" fill="none" stroke="#5E8EA3" stroke-width="2" opacity=".5"/>' +
      '<circle cx="100" cy="50" r="7" fill="#FFFFFF"/><circle cx="30" cy="20" r="4" fill="#FFFFFF"/><circle cx="170" cy="82" r="4" fill="#FFFFFF"/>';
    return s;
  }
  function reef() {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 200 140'); s.setAttribute('class', 'c2-reef');
    s.innerHTML =
      '<path d="M22 92C30 64 60 50 92 54 120 40 164 52 178 80 188 102 160 122 118 118 84 128 36 122 22 92Z" fill="none" stroke="#FFFFFF" stroke-width="6" opacity=".9"/>' +
      '<path d="M46 96L64 60 84 72 100 40 122 66 142 58 158 96Z" fill="#7D8A8F" stroke="#183540" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M64 60L74 82M100 40L104 76M122 66L130 86" stroke="#183540" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>' +
      '<path d="M100 40L112 54 104 60Z M64 60L72 70 66 72Z" fill="#A9B4B8"/>' +
      '<circle cx="34" cy="70" r="8" fill="#7D8A8F" stroke="#183540" stroke-width="3"/><circle cx="170" cy="108" r="7" fill="#7D8A8F" stroke="#183540" stroke-width="3"/>';
    return s;
  }
  function numBadge(n) { return el('span', 'c2-num', String(n)); }

  function board(host, scene, sz, opt) {
    opt = opt || {};
    const tow = opt.tow || 'dotted';
    const Z = SIZES[sz], lv = scene.lv, show = lv.show.cellSounds;
    const shots = opt.noShots ? [] : scene.shots, fleet = scene.fleet;
    const root = el('div', 'bc-board c2-board c2-' + sz);
    for (const [k, v] of Object.entries({ fs: Z.fs, hf: Z.hf, rf: Z.rf, badge: Z.badge, bsz: Z.badge })) root.style.setProperty('--' + k, v + 'px');
    const cols = Z.hw + 'px repeat(5, ' + Z.cw + 'px)', rows = Z.hh + 'px repeat(5, ' + Z.ch + 'px)';
    root.style.gridTemplateColumns = cols; root.style.gridTemplateRows = rows;
    // 바다 지도 한 장(격자 영역 전체)
    const sea = el('div', 'c2-sea');
    sea.style.gridColumn = '2 / 7'; sea.style.gridRow = '2 / 7';
    sea.style.backgroundImage = 'url("data:image/svg+xml,' + encodeURIComponent(seaMap(Z.cw * 5, Z.ch * 5, 11)) + '")';
    root.appendChild(sea);
    root.appendChild(el('div'));
    S.places.forEach((p, c) => { const h = el('div', 'bc-ch', colName(p, sz)); h.style.gridColumn = c + 2; h.style.gridRow = 1; root.appendChild(h); });
    const sunkOrder = shots.filter((s) => s.sunkShip != null).map((s) => s.sunkShip);
    const sunkSet = new Set(sunkOrder);
    const numOf = (i) => sunkOrder.indexOf(i) + 1;
    const shipOf = (id) => fleet.findIndex((f) => f.sounds.indexOf(id) >= 0);
    const latest = shots[shots.length - 1];
    S.manners.forEach((m, r) => {
      const rh = el('div', 'bc-rh', short('manner', m)); rh.style.gridRow = r + 2; rh.style.gridColumn = 1; root.appendChild(rh);
      S.places.forEach((p, c) => {
        const cell = el('div', 'c2-cell');
        cell.style.gridRow = r + 2; cell.style.gridColumn = c + 2;
        if (c === 4) cell.classList.add('cr'); if (r === 4) cell.classList.add('rb');
        const all = S.consonants.filter((x) => x.place === p && x.manner === m);
        const open = all.filter((x) => lv.open.indexOf(x.id) >= 0);
        const here = shots.filter((s) => s.cell && s.cell.place === p && s.cell.manner === m && (s.kind !== 'none' || s.emptyCell));
        if (show && all.length && !open.length) {
          cell.classList.add('is-closed'); const lk = el('span', 'bc-lock'); lk.appendChild(glyphSvg('lock')); cell.appendChild(lk);
        } else if (show) {
          if (open.length) { const snd = open[0].id; cell.appendChild(item(snd, here.find((x) => x.sound === snd), 1)); }
          else if (here.length) cell.appendChild(dudItem(here[0]));
        } else {
          const hits = here.filter((s) => s.kind === 'hit');
          const i0 = hits.length > 1 ? shipOf(hits[0].sound) : -1;
          const whole = i0 >= 0 && sunkSet.has(i0) && fleet[i0].sounds.every((id) => { const x = sndOf(id); return x.place === p && x.manner === m; });
          if (whole) {
            cell.appendChild(wholeItem(fleet[i0], hits.indexOf(latest) >= 0));
            here.filter((s) => s.kind !== 'hit').forEach((s) => cell.appendChild(s.kind === 'none' ? dudItem(s) : item(s.sound, s, here.length)));
          } else here.forEach((s) => cell.appendChild(s.kind === 'none' ? dudItem(s) : item(s.sound, s, here.length)));
        }
        if (cell.querySelector('.k-hit')) cell.classList.add('has-hit');
        root.appendChild(cell);
      });
    });
    function item(snd, s, n) {
      const it = el('div', 'c2-item' + (s ? ' k-' + s.kind : '') + (n > 1 ? ' is-multi' : ''));
      const lab = el('span', 'c2-mark', slash(snd));
      if (n > 1) lab.style.setProperty('--cfs', Math.min(Z.fs, Math.floor(Z.ch / n * 0.5)) + 'px');
      it.appendChild(lab);
      const low = el('span', 'c2-low');
      if (s && s.kind === 'hit') {
        const i = shipOf(snd), sunk = sunkSet.has(i);
        let part = 'mid';
        if (sunk) {
          const ids = fleet[i].sounds;
          if (ids.length === 1) part = 'boat1';
          else { const top = ids.slice().sort((a, b) => S.manners.indexOf(sndOf(a).manner) - S.manners.indexOf(sndOf(b).manner))[0]; part = top === snd ? 'bow' : 'stern'; }
        }
        low.appendChild(img('top_' + part + (sunk ? '_burnt' : ''), 'c2-ship p-' + part));
        if (sunk) { it.dataset.ship = i; if (tow === 'badges' && fleet[i].size === 2) low.appendChild(numBadge(numOf(i))); }
      } else if (s && s.kind === 'miss') low.appendChild(splash());
      if (low.childNodes.length) it.appendChild(low); else it.classList.add('is-plain');
      if (s) {
        it.appendChild(badge(s.kind, s.kind === 'hit' ? 'hit' : s.kind === 'miss' ? 'miss' : U.lineDir(s.targets)));
        if (s === latest) it.classList.add('is-latest');
      }
      return it;
    }
    // 한 칸 안에서 가라앉은 세 칸 배: 세운 한 척(왼쪽) + 세기 자리 소리 셋(오른쪽)
    function wholeItem(ship, isLatest) {
      const it = el('div', 'c2-item k-hit c2-whole');
      const wrap = el('span', 'c2-tall');
      wrap.appendChild(img('top_ship3_burnt', 'c2-ship-tall'));
      it.appendChild(wrap);
      const stack = el('span', 'c2-stack');
      const ids = ship.sounds.slice().sort((a, b) => ORD[sndOf(a).strength] - ORD[sndOf(b).strength]);
      ids.forEach((id) => { const m = el('span', 'c2-mark', slash(id)); m.style.setProperty('--cfs', Math.min(Z.fs, Math.floor((Z.ch - 12) / ids.length * 0.62)) + 'px'); stack.appendChild(m); });
      it.appendChild(stack);
      it.appendChild(badge('hit', 'hit'));
      if (isLatest) it.classList.add('is-latest');
      return it;
    }
    function dudItem(s) {
      const it = el('div', 'c2-item k-none');
      it.appendChild(reef());
      it.appendChild(badge('dud', 'dud'));
      const st = s.input && s.input.strength;
      if (st && scene.level > 1) it.appendChild(el('span', 'c2-dudlab', short('strength', st)));
      if (s === latest) it.classList.add('is-latest');
      return it;
    }
    // 같은 줄 범위
    const over = el('div', 'bc-over');
    over.style.gridTemplateColumns = cols; over.style.gridTemplateRows = rows;
    shots.forEach((s) => {
      if (s.kind !== 'line') return;
      (s.targets || []).forEach((t) => {
        const tr = el('div', 'bc-trace c2-trace' + (s === latest ? ' is-latest' : ''));
        let dir;
        if (t.place) { tr.style.gridColumn = S.places.indexOf(t.place) + 2; tr.style.gridRow = '2 / 7'; tr.classList.add('o-col'); dir = 'v'; }
        else if (t.manner) { tr.style.gridRow = S.manners.indexOf(t.manner) + 2; tr.style.gridColumn = '2 / 7'; tr.classList.add('o-row'); dir = 'h'; }
        else { tr.style.gridColumn = S.places.indexOf(t.cell.place) + 2; tr.style.gridRow = S.manners.indexOf(t.cell.manner) + 2; dir = 'cell'; }
        const d = el('span', 'bc-dir'); d.appendChild(glyphSvg(dir)); tr.appendChild(d);
        over.appendChild(tr);
      });
    });
    root.appendChild(over);
    host.appendChild(root);
    // 끌줄(점선) — tow=dotted일 때만
    requestAnimationFrame(() => {
      const rb = root.getBoundingClientRect();
      window.__towRects = window.__towRects || [];
      const svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('class', 'bc-lines'); svg.setAttribute('width', rb.width); svg.setAttribute('height', rb.height);
      let html = '';
      sunkSet.forEach((i) => {
        const pieces = Array.from(root.querySelectorAll('.c2-item[data-ship="' + i + '"]'));
        if (pieces.length < 2) return;
        const cells = pieces.map((p) => p.parentNode.getBoundingClientRect()).sort((a, b) => a.top - b.top);
        window.__towRects.push({ x: cells[0].left - 40, y: cells[0].top - 20, w: cells[0].width + 80, h: cells[cells.length - 1].bottom - cells[0].top + 40 });
        if (tow !== 'dotted') return;
        const hb = pieces.map((p) => p.querySelector('.c2-ship').getBoundingClientRect()).sort((a, b) => a.top - b.top);
        // 위 조각의 배 밑에서 아래 칸 소리 표지 위까지(표지를 가로지르지 않게)
        const lowMark = pieces.map((p) => p.querySelector('.c2-mark').getBoundingClientRect()).sort((a, b) => b.top - a.top)[0];
        const x = hb[0].left + hb[0].width / 2 - rb.left, y1 = hb[0].bottom - rb.top + 2, y2 = lowMark.top - rb.top - 4;
        html += '<path class="bc-tow c2-tow" d="M' + x + ' ' + y1 + 'V' + y2 + '"/>';
        const bw = sz === 'phone' ? 46 : 92, bh = sz === 'phone' ? 22 : 38, my = (y1 + y2) / 2;
        html += '<g class="c2-towbadge"><rect x="' + (x - bw / 2) + '" y="' + (my - bh / 2) + '" width="' + bw + '" height="' + bh + '" rx="' + (bh / 2) + '"/>' +
          '<image href="' + IMG + 'top_stern_burnt.webp" x="' + (x - bw * 0.4) + '" y="' + (my - bh * 0.32) + '" width="' + (bw * 0.4) + '" height="' + (bh * 0.64) + '" preserveAspectRatio="xMaxYMid meet"/>' +
          '<image href="' + IMG + 'top_bow_burnt.webp" x="' + x + '" y="' + (my - bh * 0.32) + '" width="' + (bw * 0.4) + '" height="' + (bh * 0.64) + '" preserveAspectRatio="xMinYMid meet"/></g>';
      });
      svg.innerHTML = html;
      root.appendChild(svg);
    });
    return root;
  }
  function colName(p, sz) {
    const n = short('place', p);
    if (sz === 'phone' && n.length >= 4) { const j = n.indexOf('입천장'); return n.slice(0, j) + '<br>' + n.slice(j); }
    return n;
  }

  // ── 남은 배: 흰 카드, 칸 수만큼의 조각(배꼬리·가운데·뱃머리)을 이어 놓은 위에서 본 배 ──
  function fleetPanel(host, scene, compact, opt) {
    opt = opt || {};
    const sunkOrder = scene.shots.filter((s) => s.sunkShip != null).map((s) => s.sunkShip);
    const sunkSet = new Set(sunkOrder);
    const box = el('div', 'bc-fleet c2-fleet' + (compact ? ' is-compact' : ''));
    const left = scene.fleet.length - sunkSet.size;
    if (!compact) box.appendChild(el('div', 'bc-fleet-title', '<span>남은 배</span><span><b>' + left + '</b>척 / ' + scene.fleet.length + '척</span>'));
    const row = el('div', 'bc-fleet-row');
    if (compact) row.appendChild(el('span', 'bc-plabel', '남은 배 ' + left));
    scene.fleet.forEach((f, i) => {
      const sunk = sunkSet.has(i), n = f.size, suf = sunk ? '_burnt' : '';
      const sh = el('div', 'c2-fship' + (sunk ? ' is-sunk' : ''));
      const segs = el('div', 'c2-segs');
      const parts = n === 1 ? ['boat1'] : n === 2 ? ['stern', 'bow'] : ['stern', 'mid', 'bow'];
      parts.forEach((p) => segs.appendChild(img('top_' + p + suf, 'c2-seg p-' + p)));
      if (sunk && opt.tow === 'badges' && n === 2) segs.appendChild(numBadge(sunkOrder.indexOf(i) + 1));
      sh.appendChild(segs);
      if (!compact) {
        sh.appendChild(el('div', 'bc-ship-name', G.text.shipName(n)));
        sh.appendChild(el('div', 'bc-ship-sub', sunk ? f.sounds.map(slash).join('·') + ' <span class="ok">찾음</span>' : '&nbsp;'));
      }
      row.appendChild(sh);
    });
    box.appendChild(row);
    host.appendChild(box);
    return box;
  }
  return { board, fleetPanel };
};
