'use strict';
// ───────────────────────────────────────────────────────────────
// G.mouth — 코드로 그린 입안 단면도와 공기 흐름 애니메이션
// ───────────────────────────────────────────────────────────────
// 필요: js/core/util.js, js/data/text.js, js/data/mouth.js(좌표·흐름 규칙), css/mouth.css
//
// 쓰는 법
//   const m = G.mouth.create(상자, { sea: 'consonant'|'vowel', grade: 'm3'|'h1', showNames: true,
//                                    onPick(id) { … } });   // 단면도에서 자리를 누르면 불림
//   m.select(id)            자리 고르기(자음: 'bilabial'…'glottal', 모음: 'front-high'…'back-low', null=지우기)
//   m.setManner(manner)     방법 미리 보기(막음 표시·콧길 문). null=지우기
//   m.setStrength(strength) 세기 미리 보기(된소리면 목청 조임 표시). null=지우기
//   m.setLips(lips)         입술 모양 미리 보기('unrounded'|'rounded'|null) — 모음
//   m.play({ place, manner, strength }) 또는 m.play({ tongue, lips })  → Promise(1.5초 안에 끝남)
//        없는 조합도 고른 대로 재생한다. '움직임 줄이기'면 정지 그림을 보여 주고 곧바로 끝난다.
//   m.setShowNames(bool) · m.setGrade('m3'|'h1') · m.setSea(sea) · m.state() · m.destroy()
//
// 점검용으로 그림(svg.mouth-svg)에 지금 상태를 data- 값으로 적어 둔다:
//   data-sea, data-place, data-tongue, data-manner, data-strength, data-lips,
//   data-closure(full|full-to-gap|gap|dotted|none|''), data-nasal(open|closed), data-glottis(tight|normal),
//   data-flow, data-particles(마지막 재생의 입자 수), data-playing(1|0), data-static(1=정지 그림), data-names(shown|hidden)
//   막음 표시 g.mouth-closure 에는 data-kind(규칙)와 data-shape(지금 그려진 모양)가 있다.
// 그림 안의 글씨는 자리 이름뿐이다(setShowNames로 숨김). 이름은 G.text에서 학년별로 가져온다.

window.G = window.G || {};
G.mouth = (function () {
  const U = G.util;
  const NS = 'http://www.w3.org/2000/svg';
  const D = () => window.MOUTH;

  // ── 작은 도구 ──────────────────────────────────────────────
  const rnd = (i) => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
  const bump = (d, w) => (Math.abs(d) >= w ? 0 : 0.5 * (1 + Math.cos(Math.PI * d / w))); // 가운데서 1, 멀어지면 0

  // 점 목록 → 길이로 찾을 수 있는 공기 길
  function makeRoute(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, len: cum[cum.length - 1] };
  }
  function lengthAt(route, idx) { return route.cum[idx]; }
  // 길 위 s 지점의 좌표와 옆 방향(법선)
  function pointAt(route, s) {
    const { pts, cum } = route;
    s = U.clamp(s, 0, route.len);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const a = pts[i - 1], b = pts[i], seg = cum[i] - cum[i - 1] || 1, k = (s - cum[i - 1]) / seg;
    const dx = (b[0] - a[0]) / seg, dy = (b[1] - a[1]) / seg;
    return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, nx: -dy, ny: dx };
  }

  // 혀 모양: 혀끝(tip)과 혓몸 가장 높은 곳(peak)으로 그린다
  function tonguePath(tip, peak) {
    const [tx, ty] = tip, [px, py] = peak;
    const backY = Math.max(py + 24, 176);
    return `M${tx},${ty} C${tx + 12},${ty - 8} ${px - 52},${py} ${px},${py} ` +
      `C${px + 56},${py} 291,${py + 4} 291,${backY + 30} C291,240 290,258 278,266 ` +
      `C230,262 150,248 100,236 C76,230 60,222 ${tx - 4},${ty + 14} Z`;
  }
  // 입천장 아래 선의 높이(대략) — 모음 공기 길 계산용
  function roofY(x) {
    if (x < 90) return 122 + (90 - x) * 0.5;
    if (x < 200) return 122 - (x - 90) * 0.07;
    return 114 + (x - 200) * 0.24;
  }

  // 자음 공기 길: 기본 길에 막는 곳을 끼워 넣는다
  function consonantRoute(placeId) {
    const R = D().route, p = D().places[placeId];
    if (placeId === 'glottal') { const r = makeRoute(R.oral); return { route: r, sC: lengthAt(r, 1) }; }
    const head = R.oral.slice(0, 4);
    const tail = R.oral.slice(4).filter((q) => Math.abs(q[0] - p.x) >= 30 || q[0] < 0);
    tail.push([p.x, p.y]);
    tail.sort((a, b) => b[0] - a[0]);
    const pts = head.concat(tail), r = makeRoute(pts);
    const idx = pts.findIndex((q) => q[0] === p.x && q[1] === p.y);
    return { route: r, sC: lengthAt(r, idx) };
  }
  // 모음 공기 길: 혀 위, 입천장 아래 가운데로
  function vowelRoute(spot) {
    const peakY = spot.y + 8;
    const tongueY = (x) => peakY + Math.pow(Math.abs(x - spot.x) / 100, 2) * 46;
    const mid = (x) => Math.max(roofY(x) + 7, (roofY(x) + tongueY(x)) / 2);
    const R = D().route.oral;
    const pts = R.slice(0, 4).concat([[284, Math.min(168, mid(284))], [250, mid(250)], [spot.x, mid(spot.x)]]);
    if (spot.x > 180) pts.push([150, mid(150)]);
    pts.push([96, mid(96)], [50, 162], [30, 166], [-10, 166]);
    return { route: makeRoute(pts), sC: 0 };
  }

  // ── 단면도 만들기 ──────────────────────────────────────────
  function create(container, opts) {
    opts = opts || {};
    const M = D();
    const st = {
      sea: opts.sea === 'vowel' ? 'vowel' : 'consonant',
      grade: opts.grade === 'h1' ? 'h1' : 'm3',
      showNames: opts.showNames !== false,
      place: null, tongue: null, manner: null, strength: null, lips: null,
      closure: '', nasal: 'closed', glottis: 'normal', flow: '', particles: 0,
      playing: false, isStatic: false,
    };
    const onPick = typeof opts.onPick === 'function' ? opts.onPick : null;
    let raf = 0, tk = 0, timer = 0, pendingResolve = null, destroyed = false;

    container.classList.add('mouth');
    const svg = U.svg('svg', { class: 'mouth-svg', viewBox: `0 0 ${M.VIEW.w} ${M.VIEW.h}`,
      preserveAspectRatio: 'xMidYMid meet', role: 'group', 'aria-label': '입안 단면도' });
    const g = (cls, parent) => { const n = U.svg('g', { class: cls }); (parent || svg).appendChild(n); return n; };
    const path = (d, cls, parent) => { const n = U.svg('path', { d, class: cls }); (parent || svg).appendChild(n); return n; };

    // 바탕(살·공기 길·이·혀·입술)
    path(M.shape.head, 'mouth-tissue');
    path(M.shape.nasal, 'mouth-air-way');
    path(M.shape.oral, 'mouth-air-way');
    const tongueEl = path(tonguePath(M.neutralTongue.tip, M.neutralTongue.peak), 'mouth-tongue');
    path(M.shape.upperTeeth, 'mouth-teeth');
    path(M.shape.lowerTeeth, 'mouth-teeth');
    const lipU = path(M.shape.lips.open.upper, 'mouth-lip');
    const lipL = path(M.shape.lips.open.lower, 'mouth-lip');

    // 콧길 문(여린입천장 뒤끝에 달린 문)
    const dr = M.shape.door;
    const doorG = g('mouth-door');
    doorG.appendChild(U.svg('rect', { x: 0, y: -3.5, width: dr.len, height: 7, rx: 3.5 }));
    doorG.appendChild(U.svg('circle', { cx: 0, cy: 0, r: 4.5, class: 'mouth-door-hinge' }));

    // 목청(성대 두 쪽)과 조임 표시
    const gl = M.shape.glottis;
    const glottisG = g('mouth-glottis');
    const foldL = U.svg('path', { class: 'mouth-fold' }), foldR = U.svg('path', { class: 'mouth-fold' });
    glottisG.appendChild(foldL); glottisG.appendChild(foldR);
    const tightG = g('mouth-tight', glottisG);
    [[gl.left - 16, 1], [gl.right + 16, -1]].forEach(([x, dir]) => {
      tightG.appendChild(U.svg('path', { d: `M${x},${gl.y - 9} L${x + dir * 8},${gl.y} L${x},${gl.y + 9}` }));
    });

    // 앞에서 본 입술(모음 바다)
    const li = M.shape.lipInset;
    const insetG = g('mouth-lipinset');
    const insetOuter = U.svg('ellipse', { cx: li.x, cy: li.y, class: 'mouth-lip' });
    const insetHole = U.svg('ellipse', { cx: li.x, cy: li.y, class: 'mouth-lip-hole' });
    insetG.appendChild(insetOuter); insetG.appendChild(insetHole);

    // 자리 표시(고리)·막음 표시·입자·이름·누르는 곳
    const spotsG = g('mouth-spots');
    const closureG = g('mouth-closure');
    const partG = g('mouth-particles');
    const labelsG = g('mouth-labels');
    const hitsG = g('mouth-hits');

    const nMax = M.PARTICLES * 2;
    const parts = [];
    for (let i = 0; i < nMax; i++) {
      const c = U.svg('circle', { r: 4.2, class: 'mouth-particle' });
      c.style.display = 'none';
      partG.appendChild(c); parts.push(c);
    }
    container.appendChild(svg);

    // ── 자리(자음 5곳 / 모음 6곳) ─────────────────────────────
    let targets = []; // { id, x, y, ring, hit }
    function targetList() {
      if (st.sea === 'vowel') return M.tongueOrder.map((id) => ({ id, x: M.tongueSpots[id].x, y: M.tongueSpots[id].y }));
      return M.placeOrder.map((id) => ({ id, x: M.places[id].x, y: M.places[id].y }));
    }
    function buildTargets() {
      spotsG.textContent = ''; hitsG.textContent = '';
      targets = targetList().map((t, i) => {
        const ring = U.svg('circle', { cx: t.x, cy: t.y, r: st.sea === 'vowel' ? 7 : 10, class: 'mouth-spot', 'data-id': t.id });
        spotsG.appendChild(ring);
        const hit = U.svg('circle', { cx: t.x, cy: t.y, r: 10, class: 'mouth-hit', 'data-id': t.id, tabindex: 0, role: 'button' });
        hit.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(t.id); }
        });
        hitsG.appendChild(hit);
        return Object.assign({ ring, hit, n: i + 1 }, t);
      });
      sizeHits();
    }

    // 실제 화면에서 누르는 곳이 --touch보다 작지 않게 반지름을 맞춘다
    function sizeHits() {
      const r0 = st.sea === 'vowel' ? M.HIT_R_VOWEL : M.HIT_R;
      const rect = svg.getBoundingClientRect();
      const scale = Math.min(rect.width / M.VIEW.w, rect.height / M.VIEW.h);
      const touch = parseFloat(getComputedStyle(container).getPropertyValue('--touch')) || 48;
      const r = scale > 0 ? Math.max(r0, touch / 2 / scale + 0.5) : r0;
      targets.forEach((t) => { t.hit.setAttribute('r', r.toFixed(1)); t.r = r; });
    }
    let ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(sizeHits); ro.observe(svg); }
    else window.addEventListener('resize', sizeHits);

    // 누른 곳에서 가장 가까운 자리를 고른다(누르는 범위가 겹쳐도 헷갈리지 않게)
    function onPointer(e) {
      if (st.playing) return;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const q = pt.matrixTransform(ctm.inverse());
      let best = null, bd = Infinity;
      targets.forEach((t) => { const d = Math.hypot(t.x - q.x, t.y - q.y); if (d <= t.r && d < bd) { bd = d; best = t; } });
      if (best) { e.preventDefault(); pick(best.id); }
    }
    svg.addEventListener('pointerdown', onPointer);

    function pick(id) {
      if (st.playing || destroyed) return;
      api.select(id);
      if (onPick) onPick(id);
    }

    // ── 이름 ──────────────────────────────────────────────────
    function text(x, y, s, cls, anchor) {
      const t = U.svg('text', { x, y, class: cls || 'mouth-label', 'text-anchor': anchor || 'middle' });
      t.textContent = s; labelsG.appendChild(t); return t;
    }
    function buildLabels() {
      labelsG.textContent = '';
      const T = window.TEXT;
      if (st.sea === 'consonant') {
        M.placeOrder.forEach((id) => {
          const L = M.places[id].label;
          text(L.x, L.y, T.mouthParts[id], 'mouth-label', L.anchor);
          if (st.grade === 'h1') text(L.x, L.y + 13, G.text.short('h1', 'place', id), 'mouth-label mouth-label-sub', L.anchor);
        });
      } else {
        const V = M.vowelLabels;
        ['front', 'back'].forEach((b) => text(V.backness[b].x, V.backness[b].y, G.text.short(st.grade, 'backness', b)));
        ['high', 'mid', 'low'].forEach((h) => {
          const y = M.tongueSpots['front-' + h].y + 4;
          text(V.heightX, y, G.text.short(st.grade, 'height', h), 'mouth-label');
        });
      }
      applyNames();
    }
    function applyNames() {
      labelsG.style.display = st.showNames ? '' : 'none';
      svg.setAttribute('data-names', st.showNames ? 'shown' : 'hidden');
      const T = window.TEXT;
      targets.forEach((t) => {
        let name;
        if (!st.showNames) name = '자리 ' + t.n;
        else if (st.sea === 'consonant') name = T.mouthParts[t.id];
        else { const [b, h] = t.id.split('-'); name = G.text.short(st.grade, 'backness', b) + ' ' + G.text.short(st.grade, 'height', h); }
        t.hit.setAttribute('aria-label', name);
      });
    }

    // ── 모양 갱신(막음 표시·혀·입술·문·목청) ───────────────────
    function drawClosure(kind, shape) {
      closureG.textContent = '';
      closureG.setAttribute('data-kind', kind || '');
      closureG.setAttribute('data-shape', shape || '');
      if (!shape || st.sea !== 'consonant' || !st.place) return;
      const p = M.places[st.place], L = p.len, W = 7, h = L / 2;
      closureG.setAttribute('transform', `translate(${p.x},${p.y}) rotate(${p.deg})`);
      const rect = (x, w, cls) => closureG.appendChild(U.svg('rect', { x, y: -W / 2, width: w, height: W, rx: 2, class: cls }));
      if (shape === 'full') rect(-h, L, 'mouth-bar');
      else if (shape === 'pending') rect(-h, L, 'mouth-bar mouth-bar-pending');
      else if (shape === 'gap') { const gp = 4.5; rect(-h, h - gp, 'mouth-bar'); rect(gp, h - gp, 'mouth-bar'); }
      else if (shape === 'dotted') closureG.appendChild(U.svg('line', { x1: -h, y1: 0, x2: h, y2: 0, class: 'mouth-bar-dotted' }));
    }
    function lipShape(key) {
      const s = M.shape.lips[key] || M.shape.lips.open;
      lipU.setAttribute('d', s.upper); lipL.setAttribute('d', s.lower);
      svg.setAttribute('data-lipshape', key);
    }
    function tongueFor(contact) {
      if (st.sea === 'vowel') {
        if (!st.tongue) return M.neutralTongue;
        const sp = M.tongueSpots[st.tongue], py = sp.y + 8;
        return { tip: [66, Math.max(186, py - 22)], peak: [sp.x, py] };
      }
      const p = st.place && M.places[st.place];
      if (!p || !p.tongue) return M.neutralTongue;
      const dy = contact === 'near' ? 7 : 0, t = p.tongue;
      return { tip: [t.tip[0], t.tip[1] + (st.place === 'alveolar' ? dy : 0)], peak: [t.peak[0], t.peak[1] + (st.place === 'alveolar' ? 0 : dy)] };
    }
    function setTongue(contact) { const t = tongueFor(contact); tongueEl.setAttribute('d', tonguePath(t.tip, t.peak)); }
    function setDoor(open) {
      st.nasal = open ? 'open' : 'closed';
      doorG.setAttribute('transform', `translate(${dr.x},${dr.y}) rotate(${open ? dr.openDeg : dr.closedDeg})`);
      doorG.setAttribute('data-state', st.nasal);
    }
    function setGlottis(tight) {
      st.glottis = tight ? 'tight' : 'normal';
      const gapHalf = tight ? 0.8 : 4, mid = (gl.left + gl.right) / 2, y = gl.y;
      foldL.setAttribute('d', `M${gl.left},${y - 7} L${mid - gapHalf},${y} L${gl.left},${y + 5} Z`);
      foldR.setAttribute('d', `M${gl.right},${y - 7} L${mid + gapHalf},${y} L${gl.right},${y + 5} Z`);
      tightG.style.display = tight ? '' : 'none';
      glottisG.setAttribute('data-state', st.glottis);
    }
    function setInset() {
      const show = st.sea === 'vowel';
      insetG.style.display = show ? '' : 'none';
      const rounded = st.lips === 'rounded';
      insetOuter.setAttribute('rx', rounded ? 16 : 27); insetOuter.setAttribute('ry', rounded ? 15 : 12);
      insetHole.setAttribute('rx', rounded ? 6 : 21); insetHole.setAttribute('ry', rounded ? 6 : 3.5);
      insetG.classList.toggle('is-unset', !st.lips);
    }

    // 지금 고른 값으로 멈춘 그림을 맞춘다(재생 전 미리 보기)
    function preview() {
      stopAnim(true);
      st.playing = false;
      clearParticles();
      st.isStatic = false;
      targets.forEach((t) => t.ring.classList.toggle('is-selected', t.id === (st.sea === 'vowel' ? st.tongue : st.place)));
      if (st.sea === 'consonant') {
        const rule = st.manner ? M.manners[st.manner] : null;
        st.closure = rule ? rule.closure : '';
        st.flow = rule ? rule.flow : '';
        const shape = !st.place ? '' : !rule ? 'pending' : rule.closure === 'full-to-gap' ? 'full' : rule.closure;
        drawClosure(st.closure, shape);
        setTongue(shape === 'gap' ? 'near' : 'contact');
        lipShape(st.place === 'bilabial' ? (shape === 'gap' ? 'gap' : 'closed') : 'open');
        setDoor(!!(rule && rule.nasal === 'open'));
        const sr = M.strengths[st.strength] || M.strengths.plain;
        setGlottis(sr.glottis === 'tight');
      } else {
        st.closure = st.tongue ? M.vowel.closure : '';
        st.flow = st.tongue ? M.vowel.flow : '';
        drawClosure(st.closure, '');
        setTongue();
        lipShape(st.lips === 'rounded' ? 'rounded' : 'open');
        setDoor(false);
        setGlottis(false);
      }
      setInset();
      writeData();
    }
    function writeData() {
      const a = { sea: st.sea, place: st.place || '', tongue: st.tongue || '', manner: st.manner || '', strength: st.strength || '',
        lips: st.lips || '', closure: st.closure, nasal: st.nasal, glottis: st.glottis, flow: st.flow,
        particles: st.particles, playing: st.playing ? 1 : 0, static: st.isStatic ? 1 : 0 };
      for (const k in a) svg.setAttribute('data-' + k, a[k]);
    }

    // ── 입자 애니메이션 ───────────────────────────────────────
    function clearParticles() { parts.forEach((c) => { c.style.display = 'none'; }); }
    function stopAnim(resolveNow) {
      if (raf) cancelAnimationFrame(raf); raf = 0;
      if (tk) clearTimeout(tk); tk = 0;
      if (timer) clearTimeout(timer); timer = 0;
      if (resolveNow !== false && pendingResolve) { const r = pendingResolve; pendingResolve = null; r(); }
    }

    // 한 번의 발사 계획: 입자마다 시간 t(초) → 위치를 돌려주는 함수
    function makePlan() {
      const dur = M.DURATION / 1000;
      if (st.sea === 'vowel') {
        const { route } = vowelRoute(M.tongueSpots[st.tongue]);
        const n = M.PARTICLES;
        return { n, dur, key: null, at(i, t) {
          const ts = (i / n) * 0.75, s = t == null ? (i + 0.5) / n * route.len : (t - ts) * 380;
          if (t != null && t < ts) return null;
          if (s > route.len) return null;
          t = t || 0;
          const p = pointAt(route, s), j = Math.sin(t * 20 + i) * 1.5;
          return { x: p.x + p.nx * j, y: p.y + p.ny * j };
        } };
      }
      const rule = M.manners[st.manner], sr = M.strengths[st.strength] || M.strengths.plain;
      const n = M.PARTICLES * sr.mul;
      const t0 = sr.glottis === 'tight' ? 0.28 : 0;              // 된소리: 목청을 먼저 조인다
      const force = sr.force === 'strong' ? 1.7 : sr.force === 'firm' ? 1.4 : 1;
      const spread = sr.force === 'strong' ? 10 : sr.force === 'firm' ? 2.5 : 5;
      const { route, sC } = consonantRoute(st.place);
      const nose = makeRoute(M.route.nose);
      const cap = (i) => Math.max(4, sC - 7 - i * (sr.force === 'firm' ? 2.2 : 3.2));
      const pile = (i, t, ts) => Math.min((t - ts) * 520, cap(i));
      const place = (r, s, off) => { const p = pointAt(r, s); return { x: p.x + p.nx * off, y: p.y + p.ny * off }; };
      const side = (i) => (rnd(i) - 0.5) * spread;
      const flow = rule.flow;
      let tr = t0 + 0.6, key = null; // key: 멈춘 그림에 쓸 시각(null이면 입자를 길 전체에 고르게 늘어놓음)
      const plan = { n, dur, flow, tr: null };
      if (flow === 'burst') {
        key = tr + 0.12; plan.tr = tr;
        plan.at = (i, t) => {
          const ts = t0 + (i / n) * 0.4;
          if (t < ts) return null;
          const s = t < tr ? pile(i, t, ts) : cap(i) + (t - tr) * 520 * force * (1 + rnd(i + 7) * 0.3);
          if (s > route.len) return null;
          const off = t < tr ? ((i % 3) - 1) * 3.5 : side(i) * Math.min(1, (t - tr) * 6);
          return place(route, s, off);
        };
      } else if (flow === 'leak') {
        tr = t0 + 0.5; key = tr + 0.35; plan.tr = tr;
        plan.at = (i, t) => {
          const ts = t0 + (i / n) * 0.35;
          if (t < ts) return null;
          const s = t < tr ? pile(i, t, ts) : cap(i) + Math.max(0, t - tr - i * 0.012) * 200 * force;
          if (s > route.len) return null;
          const shake = t < tr ? ((i % 3) - 1) * 3 : Math.sin(t * 45 + i * 1.3) * (1.5 + 3 * bump(s - sC, 40));
          return place(route, s, shake);
        };
      } else if (flow === 'hiss') {
        plan.at = (i, t) => {
          const ts = t0 + (i / n) * 0.8, s = t == null ? (i + 0.5) / n * route.len : (t - ts) * 320 * Math.sqrt(force);
          if (t != null && t < ts) return null;
          if (s > route.len) return null;
          t = t || i * 0.05;
          const shake = Math.sin(t * 55 + i * 1.7) * (1 + 4 * bump(s - sC, 40)) + side(i) * 0.3;
          return place(route, s, shake);
        };
      } else if (flow === 'nose') {
        plan.at = (i, t) => {
          const ts = t0 + (i / n) * 0.8;
          if (t != null && t < ts) return null;
          if (i % 4 === 3) { // 입 쪽으로 간 공기는 막힌 곳 앞에 머문다
            const k = Math.floor(i / 4), stop = Math.max(4, sC - 7 - k * 4);
            return place(route, t == null ? stop : Math.min((t - ts) * 420, stop), ((k % 3) - 1) * 3);
          }
          const s = t == null ? (i + 0.5) / n * nose.len : (t - ts) * 380 * Math.sqrt(force);
          if (s > nose.len) return null;
          return place(nose, s, side(i) * 0.5);
        };
      } else { // split(유음): 막대 양옆으로 갈라져 돌아 흐름
        plan.at = (i, t) => {
          const ts = t0 + (i / n) * 0.8, s = t == null ? (i + 0.5) / n * route.len : (t - ts) * 320 * Math.sqrt(force);
          if (t != null && t < ts) return null;
          if (s > route.len) return null;
          const lane = i % 2 ? 1 : -1;
          const p = place(route, s, lane * 11 * bump(s - sC, 34));
          p.far = lane < 0 && bump(s - sC, 34) > 0.2;
          return p;
        };
      }
      plan.key = key;
      return plan;
    }

    function drawFrame(plan, t) {
      for (let i = 0; i < parts.length; i++) {
        const c = parts[i];
        const p = i < plan.n ? plan.at(i, t) : null;
        if (!p) { c.style.display = 'none'; continue; }
        c.style.display = '';
        c.setAttribute('cx', p.x.toFixed(1)); c.setAttribute('cy', p.y.toFixed(1));
        c.classList.toggle('is-far', !!p.far);
      }
      // 파찰음: 쌓인 뒤 막대가 틈으로 바뀐다
      if (st.closure === 'full-to-gap') {
        const shape = plan.tr != null && t >= plan.tr ? 'gap' : 'full';
        if (closureG.getAttribute('data-shape') !== shape) drawClosure(st.closure, shape);
        setTongue(shape === 'gap' ? 'near' : 'contact');
        if (st.place === 'bilabial') lipShape(shape === 'gap' ? 'gap' : 'closed');
      }
    }

    // ── 공개 함수 ─────────────────────────────────────────────
    const api = {
      el: svg,
      select(id) {
        if (st.sea === 'vowel') st.tongue = id && M.tongueSpots[id] ? id : null;
        else st.place = id && M.places[id] ? id : null;
        preview();
      },
      setManner(m) { st.manner = m && M.manners[m] ? m : null; if (st.sea === 'consonant') preview(); },
      setStrength(s) { st.strength = s && M.strengths[s] ? s : null; if (st.sea === 'consonant') preview(); },
      setLips(l) { st.lips = l === 'rounded' || l === 'unrounded' ? l : null; if (st.sea === 'vowel') preview(); },
      setShowNames(b) { st.showNames = !!b; applyNames(); },
      setGrade(gr) { st.grade = gr === 'h1' ? 'h1' : 'm3'; buildLabels(); },
      setSea(sea) {
        st.sea = sea === 'vowel' ? 'vowel' : 'consonant';
        st.place = st.tongue = st.manner = st.strength = st.lips = null;
        buildTargets(); buildLabels(); preview();
      },
      state() {
        return { sea: st.sea, place: st.place, tongue: st.tongue, manner: st.manner, strength: st.strength, lips: st.lips,
          closure: st.closure, nasal: st.nasal, glottis: st.glottis, flow: st.flow, particles: st.particles,
          playing: st.playing, static: st.isStatic, showNames: st.showNames, grade: st.grade };
      },
      // 발사: 고른 대로 공기 흐름을 재생한다(없는 조합도 그대로). 끝나면 Promise가 풀린다.
      play(c) {
        c = c || {};
        stopAnim(true);
        if (st.sea === 'vowel') {
          let id = c.tongue || (c.backness && c.height ? c.backness + '-' + c.height : st.tongue);
          if (!M.tongueSpots[id]) id = 'front-high';
          st.tongue = id;
          if (c.lips !== undefined) st.lips = c.lips === 'rounded' || c.lips === 'unrounded' ? c.lips : null;
        } else {
          st.place = M.places[c.place] ? c.place : (st.place || 'bilabial');
          st.manner = M.manners[c.manner] ? c.manner : (st.manner || 'stop');
          st.strength = M.strengths[c.strength] ? c.strength : (c.strength === undefined ? st.strength : null);
        }
        preview();
        const plan = makePlan();
        st.particles = plan.n;
        st.playing = true;
        const reduce = U.reducedMotion();
        st.isStatic = reduce;
        writeData();
        return new Promise((resolve) => {
          pendingResolve = resolve;
          const finish = () => {
            if (raf) cancelAnimationFrame(raf); raf = 0;
            if (tk) clearTimeout(tk); tk = 0; timer = 0;
            if (!reduce) { drawFrame(plan, plan.dur + 5); clearParticles(); }
            st.playing = false;
            writeData();
            const r = pendingResolve; pendingResolve = null;
            if (r) r();
          };
          if (reduce) { // 움직임 줄이기: 한 장면을 멈춘 그림으로
            drawFrame(plan, plan.key);
            if (st.closure === 'full-to-gap') drawClosure(st.closure, 'gap');
            timer = setTimeout(finish, 40);
            return;
          }
          // 그림은 requestAnimationFrame으로 그리되, 화면 갱신이 늦어지면(저사양·가려진 창) 타이머로 대신 그린다
          const start = performance.now();
          const tick = () => {
            raf = 0; tk = 0;
            const t = (performance.now() - start) / 1000;
            drawFrame(plan, Math.min(t, plan.dur));
            if (t < plan.dur) schedule();
          };
          const schedule = () => {
            raf = requestAnimationFrame(() => { clearTimeout(tk); tick(); });
            tk = setTimeout(() => { cancelAnimationFrame(raf); tick(); }, 50);
          };
          schedule();
          timer = setTimeout(finish, M.DURATION); // 탭이 가려져 그림이 멈춰도 제때 끝난다
        });
      },
      destroy() {
        destroyed = true;
        stopAnim(true);
        svg.removeEventListener('pointerdown', onPointer);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', sizeHits);
        svg.remove();
        container.classList.remove('mouth');
      },
    };

    buildTargets();
    buildLabels();
    preview();
    return api;
  }

  return { create };
})();
