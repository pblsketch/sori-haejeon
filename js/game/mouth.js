'use strict';
// ───────────────────────────────────────────────────────────────
// G.mouth — 코드로 그린 입안 단면도(보여 주기 전용)와 조음 동작·공기 흐름 애니메이션
// ───────────────────────────────────────────────────────────────
// 필요: js/core/util.js, js/data/text.js, js/data/mouth.js(좌표·흐름·시간표), css/mouth.css
//
// 단면도에는 누르는 자리가 없다(spec 5.1, 선생님 결정: 고르기는 모두 아래 조작부에서). 조작부에서 고른 것을
// 받아 모양을 바꾸고(미리 보기), 발사하면 조음 기관이 실제로 움직이며 공기 흐름을 보여 준다.
//
// 쓰는 법
//   const m = G.mouth.create(상자, { sea: 'consonant'|'vowel', grade: 'm3'|'h1', showNames: true });
//   m.select(id)            자리(자음: 'bilabial'…'glottal', 모음: 'front-high'…'back-low', null=지우기)
//   m.setManner(manner)     방법(막음 표시·콧길 문 미리 보기). null=지우기
//   m.setStrength(strength) 세기(된소리면 목청 조임 미리 보기). null=지우기
//   m.setLips(lips)         입술 모양('unrounded'|'rounded'|null) — 모음
//   m.play({ place, manner, strength }) 또는 m.play({ tongue, lips }) / ({ backness, height, lips })
//        → Promise(1.5초 안에 끝남). 없는 조합도 고른 대로 재생한다. '움직임 줄이기'면 막음 자세를 멈춘 그림으로 보이고 곧바로 끝난다.
//   m.setShowNames(bool) · m.setGrade('m3'|'h1') · m.setSea(sea) · m.state() · m.destroy()
//
// 미리 보기(카드를 고를 때): 목표 자세를 멈춘 그림으로(TONGUE_MS 동안 부드럽게, 움직임 줄이기면 바로).
//   두 입술 = 입술이 붙음(마찰이면 좁은 틈) · 잇몸 = 혀끝이 잇몸에 · 센입천장 = 혀 앞(혓바닥 앞쪽)이 센입천장에
//   여린입천장 = 혀 뒤가 여린입천장에 · 목청 = 성대가 붙음(마찰이면 좁아짐), 혀는 쉼 자세
//   비음 = 여린입천장이 내려가 콧길이 열림 · 된소리 = 목청 조임 · 모음 = 혓몸 가장 높은 곳이 앞뒤×높이로, 입술 둥글게/평평하게
// 발사(조음 동작 — 선생님 요구): 쉼 자세에서 시작해 다가감 → 막음·좁힘 유지 → 풀림 → 쉼(1.5초 안)
//   파열 = 완전히 닿아 멈추고(공기가 막는 곳 뒤에 쌓임) 한 번에 튕겨 떨어지며 터짐
//   파찰 = 완전히 닿았다가 천천히 좁은 틈으로 풀리며 마찰
//   마찰 = 닿기 직전(좁은 틈)에서 멈춘 채 공기가 떨며 스침
//   비음 = 입 쪽은 막은 채 여린입천장이 눈에 보이게 내려가 코로 나가고, 끝에 다시 올라감
//   유음 = 혀끝이 잇몸에 가볍게 닿고 양옆으로 공기가 돎
//   된소리 = 풀기 전에 성대가 조여지고(조임 표시) 단단하게 풀림 · 거센소리 = 풀린 뒤 넓고 센 입김(입자 두 배 + 입김 자국)
//   모음 = 혓몸이 고른 높이·앞뒤로 미끄러지고 입술이 둥글어지거나 펴진 채 입으로 막힘 없이 흐름
//   없는 조합도 고른 그대로 한다(예: 목청 + 파열 = 성대가 닫혔다가 풀림).
//
// 점검용으로 그림(svg.mouth-svg)에 지금 상태를 data- 값으로 적어 둔다:
//   data-sea, data-place, data-vowel, data-manner, data-strength, data-lips,
//   data-tongue(목표 혀 모양: neutral|alveolar|palatal|velar|front-high…back-low),
//   data-contact(지금 닿음: touch|near|none), data-gap(조음체와 목표 사이 거리, 그림 단위),
//   data-tongue-x, data-tongue-y(혀의 닿는 점·모음은 가장 높은 곳, 그림 단위),
//   data-closure(규칙: full|full-to-gap|gap|dotted|none|''), data-nasal(지금 콧길: open|closed), data-velum(여린입천장 각도),
//   data-glottis(지금 목청: normal|tight|closed|narrow), data-puff(거센 입김이 보이면 1),
//   data-flow, data-particles(마지막 재생의 입자 수), data-playing(1|0), data-static(1=정지 그림), data-names(shown|hidden),
//   data-phase(재생 중: approach|hold|release|rest), data-sc(공기 길 위 막는 곳의 거리), data-lipshape(open|closed|gap|spread|rounded)
//   막음 표시 g.mouth-closure 에는 data-kind(규칙)와 data-shape(지금 그려진 모양: full|gap|dotted|pending|'')가 있다.
//   입자 circle.mouth-particle 에는 data-s(공기 길 위 거리)와 data-route(oral|nose)가 있다.
// 그림 안의 글씨는 자리 이름(몸의 부위 이름, 학년 공통 — 고1의 한자어 이름은 아래 자리 카드가 보인다)과
//   모음의 앞뒤·높이 이름뿐이다(setShowNames로 숨김). 이름은 움직이는 것과 겹치지 않는 곳(위 띠·목 뒤·턱 앞)에 두고
//   가는 연결선으로 가리킨다. 고른 자리의 이름은 청록('현재 선택').

window.G = window.G || {};
G.mouth = (function () {
  const U = G.util;
  const D = () => window.MOUTH;
  let uid = 0;

  // ── 작은 도구 ──────────────────────────────────────────────
  const rnd = (i) => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
  const bump = (d, w) => (Math.abs(d) >= w ? 0 : 0.5 * (1 + Math.cos(Math.PI * d / w)));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));        // 부드럽게
  const easeOut = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.pow(1 - k, 3)); // 튕기듯
  const f1 = (v) => (Math.round(v * 10) / 10).toString();
  const rot = (deg, x, y) => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [x * c - y * s, x * s + y * c]; };

  // 점 목록 → 길이로 찾을 수 있는 공기 길
  function makeRoute(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, len: cum[cum.length - 1] };
  }
  function pointAt(route, s) {
    const { pts, cum } = route;
    s = U.clamp(s, 0, route.len);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const a = pts[i - 1], b = pts[i], seg = cum[i] - cum[i - 1] || 1, k = (s - cum[i - 1]) / seg;
    const dx = (b[0] - a[0]) / seg, dy = (b[1] - a[1]) / seg;
    return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, nx: -dy, ny: dx };
  }
  // 점들을 지나는 매끄러운 곡선(Catmull-Rom → 3차 베지어). 첫 점의 M은 붙이지 않는다.
  function smooth(p) {
    let d = '';
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
      d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)},${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)},${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])},${f1(p2[1])}`;
    }
    return d;
  }

  // ── 자세(pose): 혀 윗면 점 8개 · 입술(u,l,p) · 여린입천장 각도(v) · 목청 반틈(g) · 조임(sq) ──
  function velumPoint(deg, local) {
    const V = D().shape.velum, r = rot(deg, local[0], local[1]);
    return [V.hinge[0] + r[0], V.hinge[1] + r[1]];
  }
  // 닿는 곳(목표). 여린입천장은 그 각도에 따라 움직인다
  function targetOf(placeId, vdeg) {
    const M = D(), P = M.places[placeId];
    if (placeId === 'velar') return velumPoint(vdeg, M.shape.velum.velarAt);
    return P.at;
  }
  function awayOf(placeId, vdeg) {
    if (placeId === 'velar') { const r = rot(vdeg, 0, 1); return [r[0], r[1]]; }
    return D().places[placeId].away;
  }
  // 혀 점들을 ci 점이 목표에 오도록 부드럽게 옮긴다(가까운 점일수록 많이)
  function fitTongue(pose, ci, target) {
    const dx = target[0] - pose[ci][0], dy = target[1] - pose[ci][1];
    return pose.map((q, i) => { const w = Math.exp(-((i - ci) * (i - ci)) / 2.4); return [q[0] + dx * w, q[1] + dy * w]; });
  }
  function restPose() {
    const M = D(), L = M.shape.lips.open;
    return { t: M.restTongue.map((q) => q.slice()), u: L.u, l: L.l, p: L.p, v: M.shape.velum.raisedDeg, g: M.shape.glottis.half.rest, sq: 0, vib: 0, lipKey: 'open' };
  }
  function mixPose(a, b, k) {
    return { t: a.t.map((q, i) => [lerp(q[0], b.t[i][0], k), lerp(q[1], b.t[i][1], k)]),
      u: lerp(a.u, b.u, k), l: lerp(a.l, b.l, k), p: lerp(a.p, b.p, k), v: lerp(a.v, b.v, k), g: lerp(a.g, b.g, k), sq: lerp(a.sq, b.sq, k), vib: lerp(a.vib || 0, b.vib || 0, k),
      lipKey: k < 0.5 ? a.lipKey : b.lipKey };
  }
  // 자음 한 자리의 자세: how = 'rest' | 'touch' | 'near' | 'open'(튕겨 떨어짐). vdeg = 여린입천장 각도
  function consPose(placeId, how, vdeg) {
    const M = D(), S = M.shape, base = restPose();
    base.v = vdeg;
    if (!placeId || how === 'rest') return base;
    const P = M.places[placeId];
    if (P.tongue) {
      const tgt = targetOf(placeId, vdeg), aw = awayOf(placeId, vdeg);
      const off = how === 'near' ? M.NEAR : 0;
      const fitted = fitTongue(P.tongue.pose, P.tongue.ci, [tgt[0] + aw[0] * off, tgt[1] + aw[1] * off]);
      base.t = how === 'open' ? mixPose({ t: fitted, u: 0, l: 0, p: 0, v: 0, g: 0, sq: 0, vib: 0 }, { t: base.t, u: 0, l: 0, p: 0, v: 0, g: 0, sq: 0, vib: 0 }, 0.45).t : fitted;
    } else if (placeId === 'bilabial') {
      const key = how === 'touch' ? 'closed' : how === 'near' ? 'gap' : 'open';
      const L = S.lips[key];
      base.u = L.u; base.l = L.l; base.p = L.p; base.lipKey = key;
      if (how === 'open') { base.u = S.lips.open.u - 1.5; base.l = S.lips.open.l + 3; }
    } else if (placeId === 'glottal') {
      const H = S.glottis.half;
      base.g = how === 'touch' ? H.closed : how === 'near' ? H.narrow : H.rest * 1.6;
    }
    return base;
  }
  function vowelPose(id, lips) {
    const M = D(), S = M.shape, base = restPose();
    const V = M.vowels[id];
    if (V) base.t = fitTongue(V.pose, V.ci, V.hump);
    const key = lips === 'rounded' ? 'rounded' : lips === 'unrounded' ? 'spread' : 'open';
    const L = S.lips[key];
    base.u = L.u; base.l = L.l; base.p = L.p; base.lipKey = key;
    if (id && id.endsWith('-low')) base.l += S.lowJaw;
    return base;
  }

  // 울림(유성음): 비음·유음·모음은 성대가 가까이 모여 떤다(k = 0~1). 목청 자리는 성대가 조음체라 건드리지 않는다
  const VOICED = { nasal: 1, liquid: 1 };
  function voice(ps, k, placeId) {
    if (placeId === 'glottal' || !(k > 0)) return ps;
    ps.g = lerp(ps.g, 1.1, k); ps.vib = k;
    return ps;
  }

  // 공기 길: 자음은 기본 길에 막는 곳을 끼워 넣는다
  function consonantRoute(placeId, vdeg) {
    const R = D().route;
    if (placeId === 'glottal') { const r = makeRoute(R.oral); return { route: r, sC: r.cum[1] }; }
    const at = targetOf(placeId, vdeg);
    const head = R.oral.slice(0, 5);
    const tail = R.oral.slice(5).filter((q) => Math.abs(q[0] - at[0]) >= 22 || q[0] < 0);
    tail.push([at[0], at[1] + (placeId === 'bilabial' ? 0 : 7)]);
    tail.sort((a, b) => b[0] - a[0]);
    const pts = head.concat(tail), r = makeRoute(pts);
    const idx = pts.findIndex((q) => q[0] === at[0]);
    return { route: r, sC: r.cum[idx] };
  }
  // 모음 공기 길: 혓몸 위, 입천장 아래 가운데로
  function vowelRoute(id) {
    const M = D(), V = M.vowels[id], hump = V.hump;
    const roof = (x) => (x < 140 ? 128 - (x - 120) * 0.2 : x < 290 ? 100 : 100 + (x - 290) * 0.4);
    const tongueY = (x) => hump[1] + Math.pow(Math.abs(x - hump[0]) / 90, 2) * 40;
    const mid = (x) => Math.max(roof(x) + 6, (roof(x) + tongueY(x)) / 2);
    const R = M.route.oral;
    const pts = R.slice(0, 5).concat([[330, Math.min(150, mid(330) + 10)], [290, mid(290)], [240, mid(240)], [190, mid(190)], [150, mid(150)],
      [128, Math.max(150, mid(128))], [112, 164], [96, 170], [60, 170], [-10, 170]]);
    return { route: makeRoute(pts), sC: 0 };
  }

  // ── 단면도 만들기 ──────────────────────────────────────────
  function create(container, opts) {
    opts = opts || {};
    const M = D(), S = M.shape;
    const id = 'mouth' + (++uid);
    const st = {
      sea: opts.sea === 'vowel' ? 'vowel' : 'consonant',
      grade: opts.grade === 'h1' ? 'h1' : 'm3',
      showNames: opts.showNames !== false,
      place: null, tongue: null, manner: null, strength: null, lips: null,
      closure: '', flow: '', particles: 0, playing: false, isStatic: false,
      phase: '', puff: 0,
    };
    let raf = 0, tk = 0, timer = 0, pendingResolve = null, destroyed = false;
    const tw = { raf: 0, tk: 0 };
    let cur = restPose();             // 지금 그려진 자세
    let info = { key: 'neutral', ci: -1, target: null, place: null }; // 지금 목표(점검용 값 계산)

    container.classList.add('mouth');
    const svg = U.svg('svg', { class: 'mouth-svg', viewBox: `0 0 ${M.VIEW.w} ${M.VIEW.h}`,
      preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': '입안 단면도' });
    let layer = svg; // 그림을 넣을 곳(해부 그림은 잘린 가장자리가 흐려지는 층, 이름은 그 위)
    const g = (cls, parent) => { const n = U.svg('g', { class: cls }); (parent || layer).appendChild(n); return n; };
    const path = (d, cls, parent, extra) => { const n = U.svg('path', Object.assign({ d, class: cls }, extra || {})); (parent || layer).appendChild(n); return n; };

    const defs = U.svg('defs');
    const clip = U.svg('clipPath', { id: id + '-oral' });
    clip.appendChild(U.svg('path', { d: S.oralClip }));
    defs.appendChild(clip);
    // 머리·목을 자른 가장자리(위·오른쪽·아래)는 선 없이 부드럽게 흐려진다(상자처럼 보이지 않게)
    const VW = M.VIEW.w, VH = M.VIEW.h;
    const fade = (gid, horiz, stops) => {
      const lg = U.svg('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: horiz ? VW : 0, y2: horiz ? 0 : VH });
      stops.forEach(([o, c]) => lg.appendChild(U.svg('stop', { offset: o, 'stop-color': c })));
      defs.appendChild(lg);
      const mk = U.svg('mask', { id: gid + 'm', maskUnits: 'userSpaceOnUse', x: -60, y: -60, width: VW + 120, height: VH + 120 });
      mk.appendChild(U.svg('rect', { x: -60, y: -60, width: VW + 120, height: VH + 120, fill: `url(#${gid})` }));
      defs.appendChild(mk);
    };
    fade(id + '-fx', true, [[0, '#fff'], [(VW - 44) / VW, '#fff'], [1, '#000']]);
    fade(id + '-fy', false, [[0, '#000'], [14 / VH, '#fff'], [(VH - 40) / VH, '#fff'], [1, '#000']]);
    svg.appendChild(defs);
    const artX = U.svg('g', { class: 'mouth-art', mask: `url(#${id}-fxm)` });
    const artY = U.svg('g', { mask: `url(#${id}-fym)` });
    artX.appendChild(artY); svg.appendChild(artX);
    layer = artY;

    // 바탕: 살 · 공기 길 · 센입천장 뼈
    path(S.head, 'mouth-tissue');
    path(S.head.slice(S.head.indexOf('L278,390')).replace('L', 'M').replace(' Z', ''), 'mouth-tissue-line'); // 얼굴·목 윤곽(잘린 가장자리는 선 없음)
    path(S.airway, 'mouth-air-way');
    path(S.airway.slice(0, S.airway.indexOf(' L104,184')), 'mouth-air-line'); // 윤곽(입 밖으로 나가는 곳은 선 없음)
    path(S.palateBone, 'mouth-bone');
    // 모음 안내(혀 밑에 깔림): 높이마다 옅은 선 + 여섯 자리 점
    const guideG = g('mouth-guides');
    // 혀(입안으로 자름)
    const tongueG = g('mouth-tongue-g');
    tongueG.setAttribute('clip-path', `url(#${id}-oral)`);
    const tongueEl = path('', 'mouth-tongue', tongueG);
    path(S.epiglottis, 'mouth-epiglottis');
    // 입술(이 뒤에 깔고 이를 위에 그린다 — 입술 안쪽이 이에 붙어 보이게)
    const lipU = path('', 'mouth-lip');
    const lipL = path('', 'mouth-lip');
    const lipUL = path('', 'mouth-lip-line'); // 입술 윤곽(얼굴에 이어지는 윗면·안쪽 면은 선 없음)
    const lipLL = path('', 'mouth-lip-line');
    path(S.lowerTooth, 'mouth-teeth');
    path(S.upperTooth, 'mouth-teeth');
    // 여린입천장(목젖) — 경첩을 축으로 돈다
    const Vd = S.velum;
    const doorG = g('mouth-door');
    const velumEl = path(Vd.d, 'mouth-velum', doorG);
    path(Vd.d.slice(Vd.d.indexOf(' C')).replace(/ Z$/, '').replace(/^ C/, 'M' + Vd.d.slice(1, Vd.d.indexOf(' C')) + ' C'), 'mouth-velum-line', doorG);
    // 목청: 정중 단면에서는 후두 안 성대 높이만 옅게(성대는 옆벽에 붙어 있다) — 여닫힘은 '위에서 본 성대' 작은 그림에서
    const gl = S.glottis;
    path(`M${gl.front},${gl.y} C${gl.front + 8},${gl.y - 4} ${gl.back - 8},${gl.y - 4} ${gl.back},${gl.y} C${gl.back - 8},${gl.y + 4} ${gl.front + 8},${gl.y + 4} ${gl.front},${gl.y} Z`, 'mouth-fold-side');
    // 막음 표시 · 거센 입김 · 입자 · 이름
    const closureG = g('mouth-closure');
    // 거센 입김: 입술 앞에서 바깥(왼쪽)으로 퍼지는 동심 호
    const puffG = g('mouth-puff');
    [9, 17, 25].forEach((r) => { const x = -(r * 0.77).toFixed(1), y = (r * 0.64).toFixed(1); puffG.appendChild(U.svg('path', { d: `M${x},${-y} A${r},${r} 0 0 0 ${x},${y}` })); });
    // 콧길로 나가는 길(비음): 옅은 점선 + 콧구멍 쪽 화살촉
    const routeG = g('mouth-route');
    const nr = M.route.nose.slice(2);
    routeG.appendChild(U.svg('path', { d: 'M' + nr[0].join(',') + smooth(nr) }));
    const ne = nr[nr.length - 1], np = nr[nr.length - 2], na = Math.atan2(ne[1] - np[1], ne[0] - np[0]);
    const ah = (a) => [ne[0] - 7 * Math.cos(na + a), ne[1] - 7 * Math.sin(na + a)];
    routeG.appendChild(U.svg('path', { class: 'mouth-route-head', d: `M${ah(0.5).map(f1).join(',')} L${ne.join(',')} L${ah(-0.5).map(f1).join(',')}` }));
    const partG = g('mouth-particles');
    layer = svg;
    // 작은 그림 두 개(턱 아래 빈 곳): 휴대폰처럼 작은 화면에서도 읽히게 단면도와 따로 키운다(sizeLabels)
    // 앞에서 본 입술(모음 바다) + 이름
    const li = S.lipInset;
    const insetG = g('mouth-lipinset');
    const lipBody = g('mouth-inset-body', insetG);
    const insetOuter = U.svg('ellipse', { cx: li.x, cy: li.y, class: 'mouth-lip' });
    const insetHole = U.svg('ellipse', { cx: li.x, cy: li.y, class: 'mouth-lip-hole' });
    lipBody.appendChild(insetOuter); lipBody.appendChild(insetHole);
    const insetCap = U.svg('text', { class: 'mouth-caption', x: 2, y: li.y - 20, 'text-anchor': 'start' });
    insetCap.textContent = window.TEXT.mouthParts.lipsFront;
    insetG.appendChild(insetCap);
    // 위에서 본 성대: 앞(왼쪽) 끝이 붙은 두 성대, 그 사이 성문(짙은 면)이 열리고 닫힌다. 된소리는 조임 표시, 울림은 떨림 물결.
    // 단면도의 후두(성대 높이)와 가는 선으로 잇는다.
    const gi = gl.inset;
    const glottisG = g('mouth-glottis');
    const gCall = U.svg('line', { class: 'mouth-lead' });
    glottisG.appendChild(gCall);
    const gBody = g('mouth-inset-body', glottisG);
    gBody.appendChild(U.svg('ellipse', { class: 'mouth-larynx', cx: gi.x, cy: gi.y, rx: gi.w / 2, ry: gi.h / 2 }));
    const gHole = U.svg('path', { class: 'mouth-glottis-hole' });
    const foldF = U.svg('path', { class: 'mouth-fold' }), foldB = U.svg('path', { class: 'mouth-fold' });
    const gSeam = U.svg('path', { class: 'mouth-glottis-seam' }); // 닫혀도 두 성대의 경계가 보이게
    gBody.appendChild(gHole); gBody.appendChild(foldF); gBody.appendChild(foldB); gBody.appendChild(gSeam);
    const vibG = g('mouth-vib', gBody);
    [-1, 1].forEach((dir) => { const x = gi.x + dir * (gi.w / 2 + 5); vibG.appendChild(U.svg('path', { d: `M${x},${gi.y - 9} q${dir * 4},3 0,6 q${-dir * 4},3 0,6 q${dir * 4},3 0,6` })); });
    const tightG = g('mouth-tight', gBody);
    [[gi.y - gi.h / 2 - 1, 1], [gi.y + gi.h / 2 + 1, -1]].forEach(([y, dir]) => {
      tightG.appendChild(U.svg('path', { d: `M${gi.x - 8},${y - dir * 6} L${gi.x},${y} L${gi.x + 8},${y - dir * 6}` }));
    });
    const gCap = U.svg('text', { class: 'mouth-caption', x: gi.x, y: gi.y + gi.h / 2 + 12, 'text-anchor': 'middle' });
    gCap.textContent = window.TEXT.mouthParts.glottisTop;
    glottisG.appendChild(gCap);
    const targetRing = U.svg('circle', { class: 'mouth-target', r: 7 }); // 모음: 고른 자리(혓몸 가장 높은 곳)
    svg.appendChild(targetRing);
    const labelsG = g('mouth-labels');

    const nMax = M.PARTICLES * 2;
    const parts = [];
    for (let i = 0; i < nMax; i++) {
      const c = U.svg('circle', { r: 3.2, class: 'mouth-particle' });
      c.style.display = 'none';
      partG.appendChild(c); parts.push(c);
    }
    container.appendChild(svg);

    // ── 그리기 ──────────────────────────────────────────────
    function lipPaths(u, l, p) {
      const up = `M90,119 C87,128 82,138 ${f1(79 - p * 0.8)},${f1(u - 16)} C${f1(75 - p)},${f1(u - 10)} ${f1(75 - p)},${f1(u - 2)} ${f1(81 - p)},${f1(u)} ` +
        `C${f1(90 - p * 0.5)},${f1(u + 1.5)} 100,${f1(u + 0.5)} 108,${f1(u - 3)} C111,${f1(u - 12)} 112,140 112,130 C106,123 97,120 90,119 Z`;
      const lo = `M110,${f1(l + 3)} C100,${f1(l - 0.5)} ${f1(90 - p * 0.5)},${f1(l - 1)} ${f1(82 - p)},${f1(l)} C${f1(76 - p)},${f1(l + 2)} ${f1(74 - p)},${f1(l + 10)} ${f1(77 - p * 0.8)},${f1(l + 17)} ` +
        `C82,${f1(l + 26)} 92,203 101,205 L112,206 C111,196 111,186 110,${f1(l + 3)} Z`;
      const upL = `M90,119 C87,128 82,138 ${f1(79 - p * 0.8)},${f1(u - 16)} C${f1(75 - p)},${f1(u - 10)} ${f1(75 - p)},${f1(u - 2)} ${f1(81 - p)},${f1(u)} ` +
        `C${f1(90 - p * 0.5)},${f1(u + 1.5)} 100,${f1(u + 0.5)} 108,${f1(u - 3)}`;
      const loL = `M110,${f1(l + 3)} C100,${f1(l - 0.5)} ${f1(90 - p * 0.5)},${f1(l - 1)} ${f1(82 - p)},${f1(l)} C${f1(76 - p)},${f1(l + 2)} ${f1(74 - p)},${f1(l + 10)} ${f1(77 - p * 0.8)},${f1(l + 17)} ` +
        `C82,${f1(l + 26)} 92,203 101,205`;
      return [up, lo, upL, loL];
    }
    function tongueD(t) {
      const F = S.tongueFloor, T0 = t[0], T1 = t[1];
      const len = Math.hypot(T1[0] - T0[0], T1[1] - T0[1]) || 1, dx = (T1[0] - T0[0]) / len, dy = (T1[1] - T0[1]) / len;
      const u0 = F.to; // 혀끝 밑(아랫니 뒤 바닥)
      // 혀끝 밑면: 바닥에서 뒤로 조금 들어갔다가 혀끝으로 올라가 둥글게 이어진다(혀끝은 윗면과 매끄럽게)
      const lift = U.clamp((u0[1] - T0[1] - 26) / 50, 0, 1); // 혀끝이 들릴수록 밑면이 뒤로 휜다
      return `M${f1(T0[0])},${f1(T0[1])}` + smooth(t) + ` L${F.from[0]},${F.from[1]} ${F.d} ` +
        `C${f1(u0[0] + 4 + lift * 16)},${f1(u0[1] - 8 - lift * 16)} ${f1(T0[0] - dx * 7 + lift * 10)},${f1(T0[1] - dy * 7 + 12 + lift * 14)} ${f1(T0[0] - dx * 3)},${f1(T0[1] - dy * 3 + 3)} ` +
        `C${f1(T0[0] - dx * 3.5)},${f1(T0[1] - dy * 3.5)} ${f1(T0[0] - dx * 1.5)},${f1(T0[1] - dy * 1.5 - 0.5)} ${f1(T0[0])},${f1(T0[1])} Z`;
    }
    function drawPose(ps) {
      cur = ps;
      tongueEl.setAttribute('d', tongueD(ps.t));
      const [a, b, al, bl] = lipPaths(ps.u, ps.l, ps.p);
      lipU.setAttribute('d', a); lipL.setAttribute('d', b); lipUL.setAttribute('d', al); lipLL.setAttribute('d', bl);
      doorG.setAttribute('transform', `translate(${Vd.hinge[0]},${Vd.hinge[1]}) rotate(${f1(ps.v)})`);
      const nasal = ps.v > (Vd.raisedDeg + Vd.loweredDeg) / 2 ? 'open' : 'closed';
      doorG.setAttribute('data-state', nasal);
      svg.setAttribute('data-nasal', nasal);
      svg.setAttribute('data-velum', f1(ps.v));
      // 목청(위에서 본 성대): 조이면(sq) 성대가 두꺼워지며 붙는다
      // 된소리 조임은 성문을 좁히되(가는 틈) 닫지는 않는다 — 완전히 닫힘은 목청 자리의 막음뿐
      let gh = ps.g * (1 - 0.75 * ps.sq);
      if (ps.sq > 0.3 && ps.g > 0.5) gh = Math.max(gh, 2.2);
      const gi2 = gl.inset, ax = gi2.x - gi2.w * 0.36, px = gi2.x + gi2.w * 0.32, o = gh * 1.9, y0 = gi2.y, th = 6 + ps.sq * 2.5;
      // 성대는 성문 바깥쪽에 놓인 쐐기(성문을 덮지 않음), 성문은 그 사이의 짙은 면
      foldF.setAttribute('d', `M${f1(ax)},${y0} L${f1(px)},${f1(y0 - o)} L${f1(px)},${f1(y0 - o - th)} L${f1(ax + 5)},${f1(y0 - 2.4)} Z`);
      foldB.setAttribute('d', `M${f1(ax)},${y0} L${f1(px)},${f1(y0 + o)} L${f1(px)},${f1(y0 + o + th)} L${f1(ax + 5)},${f1(y0 + 2.4)} Z`);
      gHole.setAttribute('d', o > 0.3 ? `M${f1(ax)},${y0} L${f1(px)},${f1(y0 - o)} L${f1(px)},${f1(y0 + o)} Z` : '');
      gSeam.setAttribute('d', o < 0.6 ? `M${f1(ax)},${y0} L${f1(px)},${y0}` : '');
      vibG.style.display = (ps.vib || 0) > 0.3 ? '' : 'none';
      tightG.style.opacity = ps.sq > 0.02 ? String(Math.min(1, ps.sq * 1.4)) : '0';
      tightG.style.display = ps.sq > 0.02 ? '' : 'none';
      const glottis = ps.sq > 0.5 ? 'tight' : info.place === 'glottal' && ps.g < 0.4 ? 'closed' : info.place === 'glottal' && ps.g <= gl.half.narrow + 0.6 ? 'narrow' : (ps.vib || 0) > 0.5 ? 'voiced' : 'normal';
      svg.setAttribute('data-glottis', glottis);
      glottisG.setAttribute('data-state', glottis);
      svg.setAttribute('data-lipshape', ps.lipKey);
      // 조음체와 목표 사이 거리
      let gap = '';
      if (info.place === 'bilabial') gap = Math.max(0, ps.l - ps.u);
      else if (info.place === 'glottal') gap = ps.g * 2; // 목청 자리: 성대 사이(된소리 조임은 따로 sq로 보인다)
      else if (info.ci >= 0 && info.place) { const tg = targetOf(info.place, ps.v), q = ps.t[info.ci]; gap = Math.hypot(q[0] - tg[0], q[1] - tg[1]); }
      const contact = gap === '' ? 'none' : gap < 0.8 ? 'touch' : gap <= M.NEAR + 1.5 ? 'near' : 'none';
      svg.setAttribute('data-gap', gap === '' ? '' : f1(gap));
      svg.setAttribute('data-contact', contact);
      if (info.ci >= 0) { const q = ps.t[info.ci]; svg.setAttribute('data-tongue-x', f1(q[0])); svg.setAttribute('data-tongue-y', f1(q[1])); }
      else { svg.setAttribute('data-tongue-x', ''); svg.setAttribute('data-tongue-y', ''); }
      // 움직이는 여린입천장을 가리키는 연결선
      labelRecs.forEach((L) => { if (L.follow) placeLead(L); });
    }

    // ── 막음 표시 ──────────────────────────────────────────
    function drawClosure(kind, shape) {
      closureG.textContent = '';
      closureG.setAttribute('data-kind', kind || '');
      closureG.setAttribute('data-shape', shape || '');
      if (!shape || st.sea !== 'consonant' || !st.place) return;
      const P = M.places[st.place], L = P.len, W = 5, h = L / 2;
      const at = targetOf(st.place, cur.v), aw = awayOf(st.place, cur.v);
      const off = shape === 'gap' ? M.NEAR / 2 : 0;
      const deg = st.place === 'velar' ? P.deg + (cur.v - Vd.raisedDeg) : P.deg;
      closureG.setAttribute('transform', `translate(${f1(at[0] + aw[0] * off)},${f1(at[1] + aw[1] * off)}) rotate(${f1(deg)})`);
      const rect = (x, w, cls) => closureG.appendChild(U.svg('rect', { x, y: -W / 2, width: w, height: W, rx: 2, class: cls }));
      if (shape === 'full') rect(-h, L, 'mouth-bar');
      else if (shape === 'pending') rect(-h, L, 'mouth-bar mouth-bar-pending');
      else if (shape === 'gap') { const gp = 3; rect(-h, h - gp, 'mouth-bar'); rect(gp, h - gp, 'mouth-bar'); }
      else if (shape === 'dotted') closureG.appendChild(U.svg('line', { x1: -h, y1: 0, x2: h, y2: 0, class: 'mouth-bar-dotted' }));
    }
    function setPuff(k) {
      st.puff = k;
      puffG.style.display = k > 0.03 ? '' : 'none';
      const pf = S.puff;
      puffG.setAttribute('transform', `translate(${f1(pf.x - (st.puffT || 0) * 12)},${pf.y}) scale(${f1(0.7 + 0.5 * Math.min(1, st.puffT || 0))})`);
      puffG.style.opacity = f1(Math.min(1, k));
      svg.setAttribute('data-puff', k > 0.05 ? 1 : 0);
    }

    // ── 이름 ──────────────────────────────────────────────────
    let labelRecs = [];
    function mkText(s, cls) {
      const t = U.svg('text', { class: cls || 'mouth-label', 'text-anchor': 'middle' });
      t.textContent = s; labelsG.appendChild(t); return t;
    }
    function splitName(nm) { // '센입천장' → 센 / 입천장 (용어는 줄이지 않는다)
      const j = nm.indexOf('입천장');
      return j > 0 ? [nm.slice(0, j), nm.slice(j)] : [nm];
    }
    function buildLabels() {
      labelsG.textContent = '';
      guideG.textContent = '';
      labelRecs = [];
      const T = window.TEXT;
      const lead = () => { const ln = U.svg('line', { class: 'mouth-lead' }); labelsG.insertBefore(ln, labelsG.firstChild); return ln; };
      const dot = () => { const c = U.svg('circle', { class: 'mouth-lead-dot', r: 2.2 }); labelsG.appendChild(c); return c; };
      if (st.sea === 'consonant') {
        M.placeOrder.forEach((pid) => {
          const P = M.places[pid];
          const main = mkText('', 'mouth-label');
          main.setAttribute('data-place', pid);
          const lines = (P.label.side === 'top' ? splitName(T.mouthParts[pid]) : [T.mouthParts[pid]]).map((ln) => {
            const ts = U.svg('tspan', {}); ts.textContent = ln; main.appendChild(ts); return ts;
          });
          labelRecs.push({ id: pid, main, lines, lead: lead(), dot: dot(), follow: pid === 'velar',
            lead2: P.lead2 ? lead() : null, dot2: P.lead2 ? dot() : null });
        });
      } else {
        const V = M.vowelLabels;
        ['front', 'back'].forEach((b) => {
          // 중3 = '혀 앞'·'혀 뒤'(혀의 자리임을 분명히), 고1 = 전설·후설
          const t = mkText(st.grade === 'h1' ? G.text.short('h1', 'backness', b) : T.mouthParts[b === 'front' ? 'tongueFront' : 'tongueBack'], 'mouth-label');
          labelRecs.push({ vb: b, main: t, lines: null, lead: lead(), dot: dot() });
        });
        ['high', 'mid', 'low'].forEach((h) => {
          const t = mkText(G.text.short(st.grade, 'height', h), 'mouth-label');
          t.setAttribute('text-anchor', 'start');
          labelRecs.push({ vh: h, main: t });
          guideG.appendChild(U.svg('line', { class: 'mouth-guide', x1: V.guideFrom, x2: 366, y1: V.heights[h], y2: V.heights[h] }));
        });
        M.tongueOrder.forEach((vid) => {
          const hp = M.vowels[vid].hump;
          guideG.appendChild(U.svg('circle', { class: 'mouth-guide-dot', cx: hp[0], cy: hp[1], r: 3, 'data-id': vid }));
        });
      }
      applyNames();
      sizeLabels();
    }
    let labelFs = 18, lastScale = 0;
    function sizeLabels() {
      const rect = svg.getBoundingClientRect();
      const scale = Math.min(rect.width / M.VIEW.w, rect.height / M.VIEW.h);
      lastScale = scale > 0 ? scale : lastScale;
      const px = parseFloat(getComputedStyle(container).getPropertyValue('--mouth-label')) || 16;
      const band = M.labelBand[1] - M.labelBand[0];
      labelFs = U.clamp(scale > 0 ? px / scale : 18, 11, band / 2.3);
      layoutLabels();
    }
    function placeLead(L) {
      if (!L.leadFrom) return;
      let to;
      if (L.id === 'velar') to = velumPoint(cur.v, Vd.leadAt);
      else if (L.id) to = M.places[L.id].lead || M.places[L.id].at;
      else to = L.to;
      L.lead.setAttribute('x1', f1(L.leadFrom[0])); L.lead.setAttribute('y1', f1(L.leadFrom[1]));
      L.lead.setAttribute('x2', f1(to[0])); L.lead.setAttribute('y2', f1(to[1]));
      L.dot.setAttribute('cx', f1(to[0])); L.dot.setAttribute('cy', f1(to[1]));
      if (L.lead2) {
        const t2 = M.places[L.id].lead2;
        L.lead2.setAttribute('x1', f1(L.leadFrom[0])); L.lead2.setAttribute('y1', f1(L.leadFrom[1]));
        L.lead2.setAttribute('x2', f1(t2[0])); L.lead2.setAttribute('y2', f1(t2[1]));
        L.dot2.setAttribute('cx', f1(t2[0])); L.dot2.setAttribute('cy', f1(t2[1]));
      }
    }
    function layoutLabels() {
      const lf = labelFs, lh = lf * 1.12, B = M.labelBand;
      // 작은 그림: 화면에서 너비 약 52px 이상이 되게 따로 키우고(최대 1.35배), 이름은 화면 12px 이상
      const gi3 = gl.inset, li3 = S.lipInset;
      const kG = U.clamp(52 / (gi3.w * (lastScale || 1)), 1, 1.35), kL = U.clamp(48 / (56 * (lastScale || 1)), 1, 1.35);
      const around = (x, y, k) => `translate(${x},${y}) scale(${f1(k)}) translate(${-x},${-y})`;
      gBody.setAttribute('transform', around(gi3.x, gi3.y, kG));
      lipBody.setAttribute('transform', around(li3.x, li3.y, kL));
      const cu = U.clamp(12 / (lastScale || 1), 7, 24);
      gCap.style.fontSize = insetCap.style.fontSize = f1(cu) + 'px';
      gCap.setAttribute('y', f1(Math.min(M.VIEW.h - 2, gi3.y + (gi3.h / 2) * kG + 11 + cu * 0.9)));
      insetCap.setAttribute('y', f1(li3.y + 17 * kL + 4 + cu * 0.9));
      gCall.setAttribute('x1', f1(gi3.x + (gi3.w / 2) * kG)); gCall.setAttribute('y1', f1(gi3.y));
      gCall.setAttribute('x2', gl.front); gCall.setAttribute('y2', gl.y);
      labelRecs.forEach((L) => {
        L.main.style.fontSize = f1(lf) + 'px';
        if (L.vh) { // 모음 높이: 오른쪽 목 뒤 살, 그 높이의 안내선 끝
          L.main.setAttribute('x', M.vowelLabels.heightX); L.main.setAttribute('y', f1(M.vowelLabels.heights[L.vh] + lf * 0.36));
          return;
        }
        if (L.vb) { // 모음 앞뒤: 위 띠 + 입천장으로 연결선
          const x = M.vowelLabels.backness[L.vb];
          L.main.setAttribute('x', x); L.main.setAttribute('y', f1(B[1] - lf * 0.25));
          L.leadFrom = [M.vowels[L.vb + '-high'].hump[0], B[1] + 2];
          const hp = M.vowels[L.vb + '-high'].hump;
          L.to = [hp[0], hp[1] - 4]; // 그 열의 혀 자리 점(높은 줄) 바로 위까지 — 입천장의 구획처럼 보이지 않게
          L.dot.style.display = 'none';
          placeLead(L);
          return;
        }
        const P = M.places[L.id], lab = P.label, n = L.lines.length;
        let x, y0;
        if (lab.side === 'top') {
          x = lab.x; y0 = B[1] - lf * 0.25 - (n - 1) * lh;
          L.leadFrom = [x, B[1] + 2];
        } else {
          x = lab.x; y0 = lab.y;
        }
        L.main.setAttribute('text-anchor', lab.anchor);
        L.lines.forEach((ts, i) => { ts.setAttribute('x', f1(x)); ts.setAttribute('y', f1(y0 + i * lh)); });
        if (lab.side === 'left') {
          let w = lf * 3.2;
          try { w = L.main.getComputedTextLength() || w; } catch (e) { /* 보이지 않을 때 */ }
          L.leadFrom = [x + w + 3, y0 - lf * 0.45];
        } else if (lab.side === 'right') L.leadFrom = [x - 3, y0 - lf * 0.35];
        placeLead(L);
      });
    }
    function applyNames() {
      labelsG.style.display = st.showNames ? '' : 'none';
      guideG.style.display = st.sea === 'vowel' ? '' : 'none';
      svg.setAttribute('data-names', st.showNames ? 'shown' : 'hidden');
    }
    function markSelected() {
      labelRecs.forEach((L) => {
        const on = L.id ? L.id === st.place : L.vb ? !!st.tongue && st.tongue.startsWith(L.vb + '-') : L.vh ? !!st.tongue && st.tongue.endsWith('-' + L.vh) : false;
        L.main.classList.toggle('is-selected', on);
      });
      guideG.querySelectorAll('.mouth-guide-dot').forEach((c) => c.classList.toggle('is-selected', c.getAttribute('data-id') === st.tongue));
    }
    let ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(() => requestAnimationFrame(() => { if (!destroyed) sizeLabels(); })); ro.observe(svg); }
    else window.addEventListener('resize', sizeLabels);

    // ── 목표 자세(미리 보기의 멈춘 그림 = 발사의 막음·좁힘 자세) ─────────
    function setInfo() {
      if (st.sea === 'vowel') {
        const V = st.tongue && M.vowels[st.tongue];
        info = { key: st.tongue || 'neutral', ci: V ? V.ci : -1, place: null };
      } else {
        const P = st.place && M.places[st.place];
        info = { key: P && P.tongue ? st.place : 'neutral', ci: P && P.tongue ? P.tongue.ci : -1, place: st.place };
      }
    }
    function holdHow() { return st.manner === 'fricative' ? 'near' : 'touch'; }
    function staticPose() {
      if (st.sea === 'vowel') return st.tongue ? voice(vowelPose(st.tongue, st.lips), 1) : Object.assign(restPose(), vowelLipsOnly());
      const rule = st.manner ? M.manners[st.manner] : null;
      const vdeg = rule && rule.nasal === 'open' ? Vd.loweredDeg : Vd.raisedDeg;
      const ps = consPose(st.place, st.place ? holdHow() : 'rest', vdeg);
      if (st.strength === 'tense') ps.sq = 1;
      return voice(ps, VOICED[st.manner] ? 1 : 0, st.place);
    }
    function vowelLipsOnly() {
      const key = st.lips === 'rounded' ? 'rounded' : st.lips === 'unrounded' ? 'spread' : 'open';
      const L = S.lips[key];
      return { u: L.u, l: L.l, p: L.p, lipKey: key };
    }
    function stopTween() {
      if (tw.raf) cancelAnimationFrame(tw.raf);
      if (tw.tk) clearTimeout(tw.tk);
      tw.raf = tw.tk = 0;
    }
    function tweenTo(to) {
      stopTween();
      const from = cur;
      if (U.reducedMotion() || !(M.TONGUE_MS > 0)) { drawPose(to); return; }
      const start = performance.now();
      const stepT = () => {
        tw.raf = tw.tk = 0;
        const k = Math.min(1, (performance.now() - start) / M.TONGUE_MS);
        drawPose(k >= 1 ? to : mixPose(from, to, 1 - Math.pow(1 - k, 3)));
        if (st.sea === 'consonant' && st.place) drawClosure(closureG.getAttribute('data-kind'), closureG.getAttribute('data-shape'));
        if (k < 1) sched();
      };
      const sched = () => {
        tw.raf = requestAnimationFrame(() => { clearTimeout(tw.tk); stepT(); });
        tw.tk = setTimeout(() => { cancelAnimationFrame(tw.raf); stepT(); }, 40);
      };
      sched();
    }
    function setInset() {
      const show = st.sea === 'vowel';
      insetG.style.display = show ? '' : 'none';
      const rounded = st.lips === 'rounded';
      insetOuter.setAttribute('rx', rounded ? 17 : 28); insetOuter.setAttribute('ry', rounded ? 16 : 12);
      insetHole.setAttribute('rx', rounded ? 6.5 : 22); insetHole.setAttribute('ry', rounded ? 6.5 : 3.5);
      insetG.classList.toggle('is-unset', !st.lips);
    }
    function setTargetRing() {
      const V = st.sea === 'vowel' && st.tongue && M.vowels[st.tongue];
      targetRing.style.display = V ? '' : 'none';
      if (V) { targetRing.setAttribute('cx', V.hump[0]); targetRing.setAttribute('cy', V.hump[1]); }
    }

    // 지금 고른 값으로 멈춘 그림을 맞춘다(재생 전 미리 보기)
    function preview(instant) {
      stopAnim(true);
      st.playing = false;
      clearParticles();
      setPuff(0);
      st.isStatic = false;
      st.phase = '';
      svg.setAttribute('data-phase', '');
      setInfo();
      markSelected();
      if (st.sea === 'consonant') {
        const rule = st.manner ? M.manners[st.manner] : null;
        st.closure = rule ? rule.closure : '';
        st.flow = rule ? rule.flow : '';
      } else {
        st.closure = st.tongue ? M.vowel.closure : '';
        st.flow = st.tongue ? M.vowel.flow : '';
      }
      const to = staticPose();
      if (instant) drawPose(to); else tweenTo(to);
      const shape = st.sea !== 'consonant' || !st.place ? '' : !st.manner ? 'pending' : st.closure === 'full-to-gap' ? 'full' : st.closure;
      drawClosure(st.closure, shape);
      setInset();
      setTargetRing();
      routeG.style.display = st.sea === 'consonant' && st.manner === 'nasal' ? '' : 'none';
      writeData();
    }
    function writeData() {
      const a = { sea: st.sea, place: st.place || '', vowel: st.tongue || '', tongue: info.key,
        manner: st.manner || '', strength: st.strength || '', lips: st.lips || '', closure: st.closure, flow: st.flow,
        particles: st.particles, playing: st.playing ? 1 : 0, static: st.isStatic ? 1 : 0 };
      for (const k in a) svg.setAttribute('data-' + k, a[k]);
    }

    // ── 한 발의 시간표 ─────────────────────────────────────
    function clearParticles() { parts.forEach((c) => { c.style.display = 'none'; }); }
    function stopAnim(resolveNow) {
      if (raf) cancelAnimationFrame(raf); raf = 0;
      if (tk) clearTimeout(tk); tk = 0;
      if (timer) clearTimeout(timer); timer = 0;
      if (resolveNow !== false && pendingResolve) { const r = pendingResolve; pendingResolve = null; r(); }
    }
    // 여러 시점의 값 사이를 부드럽게: keys = [[t, v], …]
    function track(keys, t, fn) {
      if (t <= keys[0][0]) return keys[0][1];
      for (let i = 1; i < keys.length; i++) {
        if (t <= keys[i][0]) { const a = keys[i - 1], b = keys[i], k = (t - a[0]) / ((b[0] - a[0]) || 1); return [a[1], b[1], (fn || ease)(k)]; }
      }
      return keys[keys.length - 1][1];
    }
    // 한 번의 발사 계획: 시각 t(초) → { pose, phase, shape, puff } 와 입자 위치
    function makePlan() {
      const TM = M.timing, dur = M.DURATION / 1000, A = TM.approach;
      const plan = { dur, key: A + 0.12, tr: null, sC: null };
      if (st.sea === 'vowel') {
        const R0 = restPose(), V = vowelPose(st.tongue, st.lips);
        const { route } = vowelRoute(st.tongue);
        const n = M.PARTICLES;
        plan.n = n; plan.key = 0.8;
        plan.frame = (t) => {
          const k = ease(t / 0.3), pose = voice(mixPose(R0, V, k), k);
          if (t > 0.25) pose.g = 1.1 + 0.9 * Math.sin(t * 2 * Math.PI * 11); // 떨림
          return { pose, phase: t < 0.3 ? 'approach' : 'hold', shape: '', puff: 0 };
        };
        plan.at = (i, t) => {
          const ts = 0.22 + (i / n) * 0.7;
          if (t < ts) return null;
          const s = 40 + (t - ts) * 560;
          if (s > route.len) return null;
          const p = pointAt(route, s), j = Math.sin(t * 20 + i) * 1.5;
          return { x: p.x + p.nx * j, y: p.y + p.ny * j, s, nose: false };
        };
        return plan;
      }
      const rule = M.manners[st.manner], sr = M.strengths[st.strength] || M.strengths.plain;
      const place = st.place, flow = rule.flow, tense = sr.glottis === 'tight', strong = sr.force === 'strong';
      const n = M.PARTICLES * sr.mul;
      const force = strong ? 1.7 : sr.force === 'firm' ? 1.4 : 1;
      const spread = strong ? 12 : sr.force === 'firm' ? 2.5 : 5;
      const Vr = Vd.raisedDeg, Vl = Vd.loweredDeg;
      // 여린입천장 각도
      const vAt = (t) => {
        if (flow !== 'nose') return Vr;
        const v = track([[0, Vr], [TM.velumDown[0], Vr], [TM.velumDown[1], Vl], [TM.velumUp[0], Vl], [TM.velumUp[1], Vr]], t);
        return Array.isArray(v) ? lerp(v[0], v[1], v[2]) : v;
      };
      // 조음체 자세의 차례(시각, 자세 이름)
      const tr = flow === 'burst' ? TM.stopRelease : flow === 'leak' ? TM.affRelease : null;
      let seq, hold2 = null;
      if (flow === 'burst') seq = [[0, 'rest'], [A, 'touch'], [tr, 'touch'], [tr + TM.springMs, 'open'], [TM.rest, 'rest']];
      else if (flow === 'leak') seq = [[0, 'rest'], [A, 'touch'], [tr, 'touch'], [tr + TM.affGap, 'near'], [TM.holdEnd, 'near'], [TM.rest, 'rest']];
      else if (flow === 'hiss') seq = [[0, 'rest'], [A, 'near'], [TM.holdEnd, 'near'], [TM.rest, 'rest']];
      else if (flow === 'nose') seq = [[0, 'rest'], [A, 'touch'], [TM.holdEnd + 0.06, 'touch'], [TM.rest, 'rest']];
      else seq = [[0, 'rest'], [A, 'touch'], [TM.holdEnd, 'touch'], [TM.rest, 'rest']];
      const relAt = tr != null ? tr : TM.holdEnd;          // 풀리는 때
      const puffAt = tr != null ? tr : A;                   // 거센 입김이 나오는 때
      plan.tr = tr;
      plan.frame = (t) => {
        const v = vAt(t);
        let i = 1;
        while (i < seq.length - 1 && t > seq[i][0]) i++;
        const a = seq[i - 1], b = seq[i];
        const k = U.clamp((t - a[0]) / ((b[0] - a[0]) || 1), 0, 1);
        const fn = b[1] === 'open' ? easeOut : ease;
        let pose = mixPose(consPose(place, a[1], v), consPose(place, b[1], v), fn(k));
        if (t >= seq[seq.length - 1][0]) pose = consPose(place, 'rest', v);
        // 된소리: 풀기 전에 목청이 조여졌다가 풀린 뒤 풀어짐
        if (tense) {
          const sq = track([[0, 0], [TM.tight[0], 0], [TM.tight[1], 1], [relAt + 0.12, 1], [relAt + 0.3, 0]], t);
          pose.sq = Array.isArray(sq) ? lerp(sq[0], sq[1], sq[2]) : sq;
        }
        pose.v = v;
        // 비음·유음: 막는 동안 성대가 모여 떤다
        if (VOICED[st.manner] && place !== 'glottal') {
          const vk = t < A ? ease(t / A) : t < TM.rest ? 1 : 0;
          voice(pose, vk, place);
          if (t >= A && t < TM.holdEnd) pose.g = 1.1 + 0.9 * Math.sin(t * 2 * Math.PI * 11);
        }
        const phase = t < A ? 'approach' : t < relAt ? 'hold' : t < TM.rest ? 'release' : 'rest';
        let shape = '';
        if (rule.closure === 'full') shape = t >= A - 0.02 && t < relAt + (flow === 'nose' ? 0.06 : 0) ? 'full' : '';
        else if (rule.closure === 'full-to-gap') shape = t < A - 0.02 ? '' : t < tr ? 'full' : t < TM.holdEnd ? 'gap' : '';
        else if (rule.closure === 'gap') shape = t >= A - 0.04 && t < TM.holdEnd ? 'gap' : '';
        else if (rule.closure === 'dotted') shape = t >= A - 0.02 && t < TM.holdEnd ? 'dotted' : '';
        let puff = 0;
        if (strong) { const pk = t - puffAt; puff = pk < 0 ? 0 : pk < 0.1 ? pk / 0.1 : Math.max(0, 1 - (pk - 0.1) / 0.5); st.puffT = Math.max(0, Math.min(1, pk / 0.6)); }
        return { pose, phase, shape, puff };
      };
      // 입자
      const cr = consonantRoute(place, Vr), route = cr.route, sC = cr.sC;
      plan.sC = sC;
      const nose = makeRoute(M.route.nose);
      const cap = (i) => Math.max(4, sC - 8 - i * (sr.force === 'firm' ? 2.2 : 3.2));
      const t0 = 0.06;
      const holdS = (i, t, until) => { // 막는 동안: 목청 쪽에서 막는 곳 바로 뒤로 모여 쌓인다
        const s0 = Math.max(0, cap(i) - 90 - i * 8);
        const k = U.clamp((t - t0) / Math.max(0.1, until - 0.08 - t0), 0, 1), e = 1 - Math.pow(1 - k, 2);
        return s0 + (cap(i) - s0) * e;
      };
      const put = (r, s, off) => { const p = pointAt(r, s); return { x: p.x + p.nx * off, y: p.y + p.ny * off, s, nose: r !== route }; };
      const side = (i) => (rnd(i) - 0.5) * spread;
      if (flow === 'burst') {
        plan.key = tr - 0.04;
        plan.at = (i, t) => {
          if (t < t0) return null;
          const s = t < tr ? holdS(i, t, tr) : cap(i) + (t - tr) * 620 * force * (1 + rnd(i + 7) * 0.3);
          if (s > route.len) return null;
          const off = t < tr ? ((i % 3) - 1) * 3.5 : side(i) * Math.min(1, (t - tr) * 6);
          return put(route, s, off);
        };
      } else if (flow === 'leak') {
        plan.key = tr + TM.affGap + 0.1;
        plan.at = (i, t) => {
          if (t < t0) return null;
          const s = t < tr ? holdS(i, t, tr) : cap(i) + Math.max(0, t - tr - i * 0.014) * 260 * force;
          if (s > route.len) return null;
          const past = s - sC, rough = t >= tr && past > 0 ? (rnd(i * 13 + Math.floor(t * 24)) - 0.5) * Math.min(8, past * 0.12) : 0;
          const shake = t < tr ? ((i % 3) - 1) * 3 : Math.sin(t * 45 + i * 1.3) * (1.5 + 3 * bump(s - sC, 40)) + rough;
          return put(route, s, shake);
        };
      } else if (flow === 'hiss') {
        plan.key = 0.7;
        const s0 = Math.max(0, sC - 190);
        plan.at = (i, t) => {
          const ts = 0.1 + (i / n) * 0.85;
          if (t < ts) return null;
          const s = s0 + (t - ts) * 330 * Math.sqrt(force);
          if (s > route.len) return null;
          // 좁은 틈을 지난 공기는 짧고 불규칙하게 흩어진다(마찰 — 파열의 한 번 분출과 구별)
          const past = s - sC, rough = past > 0 ? (rnd(i * 13 + Math.floor(t * 24)) - 0.5) * Math.min(9, past * 0.12) : 0;
          const shake = Math.sin(t * 55 + i * 1.7) * (1 + 4 * bump(s - sC, 40)) + side(i) * 0.3 + rough;
          return put(route, s, shake);
        };
      } else if (flow === 'nose') {
        plan.key = 0.75;
        plan.at = (i, t) => {
          if (i % 4 === 3) { // 입 쪽으로 간 공기는 막힌 곳 앞에 머문다
            const ts = 0.08 + (i / n) * 0.3;
            if (t < ts) return null;
            const k = Math.floor(i / 4), stop = Math.max(4, sC - 8 - k * 5);
            return put(route, Math.min(Math.max(0, stop - 120) + (t - ts) * 420, stop), ((k % 3) - 1) * 3);
          }
          const ts = TM.velumDown[1] - 0.12 + (i / n) * 0.62;
          if (t < ts) return null;
          const s = 60 + (t - ts) * 520 * Math.sqrt(force);
          if (s > nose.len) return null;
          return put(nose, s, side(i) * 0.5);
        };
      } else { // split(유음): 막대 양옆으로 갈라져 돌아 흐름
        plan.key = 0.7;
        const s0 = Math.max(0, sC - 190);
        plan.at = (i, t) => {
          const ts = 0.12 + (i / n) * 0.8;
          if (t < ts) return null;
          const s = s0 + (t - ts) * 330 * Math.sqrt(force);
          if (s > route.len) return null;
          const lane = i % 2 ? 1 : -1;
          const p = put(route, s, lane * 11 * bump(s - sC, 34));
          p.far = lane < 0 && bump(s - sC, 34) > 0.2;
          return p;
        };
      }
      plan.n = n;
      return plan;
    }

    function drawFrame(plan, t) {
      const fr = plan.frame(t);
      drawPose(fr.pose);
      if (fr.phase !== st.phase) { st.phase = fr.phase; svg.setAttribute('data-phase', fr.phase); }
      if (st.sea === 'consonant') {
        if (closureG.getAttribute('data-shape') !== fr.shape || st.place === 'velar') drawClosure(st.closure, fr.shape);
      }
      setPuff(fr.puff);
      for (let i = 0; i < parts.length; i++) {
        const c = parts[i];
        const p = i < plan.n ? plan.at(i, t) : null;
        if (!p) { c.style.display = 'none'; continue; }
        c.style.display = '';
        c.setAttribute('cx', f1(p.x)); c.setAttribute('cy', f1(p.y));
        c.setAttribute('data-s', f1(p.s));
        c.setAttribute('data-route', p.nose ? 'nose' : 'oral');
        c.classList.toggle('is-far', !!p.far);
      }
      svg.setAttribute('data-sc', plan.sC != null ? f1(plan.sC) : '');
    }

    // ── 공개 함수 ─────────────────────────────────────────────
    const api = {
      el: svg,
      select(v) {
        if (st.sea === 'vowel') st.tongue = v && M.vowels[v] ? v : null;
        else st.place = v && M.places[v] ? v : null;
        preview();
      },
      setManner(m) { st.manner = m && M.manners[m] ? m : null; if (st.sea === 'consonant') preview(); },
      setStrength(s) { st.strength = s && M.strengths[s] ? s : null; if (st.sea === 'consonant') preview(); },
      setLips(l) { st.lips = l === 'rounded' || l === 'unrounded' ? l : null; if (st.sea === 'vowel') preview(); },
      setShowNames(b) { st.showNames = !!b; applyNames(); },
      setGrade(gr) { st.grade = gr === 'h1' ? 'h1' : 'm3'; buildLabels(); markSelected(); },
      setSea(sea) {
        st.sea = sea === 'vowel' ? 'vowel' : 'consonant';
        st.place = st.tongue = st.manner = st.strength = st.lips = null;
        buildLabels(); preview(true);
      },
      state() {
        return { sea: st.sea, place: st.place, tongue: st.tongue, manner: st.manner, strength: st.strength, lips: st.lips,
          closure: st.closure, nasal: svg.getAttribute('data-nasal'), glottis: svg.getAttribute('data-glottis'), flow: st.flow, particles: st.particles,
          playing: st.playing, static: st.isStatic, showNames: st.showNames, grade: st.grade, phase: st.phase };
      },
      // 발사: 쉼 자세에서 고른 대로 조음 동작 + 공기 흐름을 재생한다(없는 조합도 그대로). 끝나면 Promise가 풀린다.
      play(c) {
        c = c || {};
        stopAnim(true);
        stopTween();
        if (st.sea === 'vowel') {
          let v = c.tongue || (c.backness && c.height ? c.backness + '-' + c.height : st.tongue);
          if (!M.vowels[v]) v = 'front-high';
          st.tongue = v;
          if (c.lips !== undefined) st.lips = c.lips === 'rounded' || c.lips === 'unrounded' ? c.lips : null;
        } else {
          st.place = M.places[c.place] ? c.place : (st.place || 'bilabial');
          st.manner = M.manners[c.manner] ? c.manner : (st.manner || 'stop');
          st.strength = M.strengths[c.strength] ? c.strength : (c.strength === undefined ? st.strength : null);
        }
        preview(true);
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
            if (!reduce) { drawFrame(plan, plan.dur + 0.01); clearParticles(); setPuff(0); }
            st.playing = false;
            writeData();
            const r = pendingResolve; pendingResolve = null;
            if (r) r();
          };
          if (reduce) { // 움직임 줄이기: 막음·좁힘 자세(과 그때의 공기)를 멈춘 그림으로
            drawFrame(plan, plan.key);
            timer = setTimeout(finish, 40);
            return;
          }
          // 처음 한 장은 쉼 자세(움직임이 보이게), 이어서 requestAnimationFrame. 화면 갱신이 늦으면 타이머로 대신 그린다
          drawFrame(plan, 0);
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
      // (점검·캡처용) 발사 계획의 t초 장면을 멈춘 그림으로 그린다. 게임은 쓰지 않는다.
      frameAt(c, t) {
        api.play(c); stopAnim(true);
        const plan = makePlan();
        drawFrame(plan, t);
        st.playing = false; writeData();
        return { phase: st.phase, gap: svg.getAttribute('data-gap') };
      },
      destroy() {
        destroyed = true;
        stopAnim(true);
        stopTween();
        if (ro) ro.disconnect(); else window.removeEventListener('resize', sizeLabels);
        svg.remove();
        container.classList.remove('mouth');
      },
    };

    buildLabels();
    preview(true);
    return api;
  }

  return { create };
})();
