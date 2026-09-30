// 입안 단면도(G.mouth) 점검(aside). 점검용 페이지 tests/pages/mouth.html에서 단면도만 띄운다.
// T19: 단면도는 보여 주기 전용(누르는 자리 없음)이고 교과서 도해처럼 다시 그렸다. 발사하면 조음 기관이 실제로 움직인다.
//  1~4) 자음 5자리 × 5방법 × 쓸 수 있는 세기(+ 목청·마찰·세기 없음), 모음 6자리 × 입술 2가지를 모두 재생하며 15ms마다 상태를 적어 본다:
//       페이지 오류 없음, 1.5초 안에 끝남, 입자가 그려짐, 막음 규칙(data-closure·data-kind)이 spec 5.2 표와 같음, 입자 수,
//       조음 동작의 차례: 쉼(떨어져 있음) → 다가감(approach) → 막음·좁힘(hold) → 풀림(release) → 쉼(rest)
//         파열: 닿음(touch) 뒤 풀리면 조음체가 튕겨 떨어짐(거리 커짐), 막는 동안 모든 입자가 막는 곳보다 목청 쪽(s < 막는 곳)에 쌓임, 터진 뒤 지나감
//         파찰: 닿음 → 좁은 틈(near) + 막대 → 틈, 마찰: 좁은 틈만(닿지 않음), 비음: 닿은 채 여린입천장이 내려가(콧길 열림) 코로 나가고
//         입 쪽 입자는 막는 곳을 넘지 않음, 유음: 닿음 + 점선 막대
//       여린입천장은 비음에서만 내려감, 목청 조임은 된소리에서만, 거센 입김은 거센소리에서만
//  5) 미리 보기(카드를 고른 때의 멈춘 그림)의 해부학 위치: 잇몸 = 혀끝이 잇몸에, 센입천장 = 혀 앞이 센입천장에, 여린입천장 = 혀 뒤가
//     여린입천장에(내려가도 따라감) 닿음, 마찰은 틈만큼 떨어짐, 두 입술 = 입술이 붙음(마찰은 틈), 목청 = 성대가 붙음(마찰은 좁아짐),
//     모음 = 혓몸 가장 높은 곳이 앞뒤 × 높이(세 단)로, 입술 둥글게 내밂 / 평평, 혀가 짧게 움직여 바뀜(움직임 줄이기면 바로)
//  6) 보여 주기 전용(누르는 곳·초점 없음), 이름 보이기/숨기기, 학년별 이름, 이름이 움직이는 것(혀·입술·여린입천장·성대)과 서로
//     겹치지 않음, 고른 자리 이름 강조, 움직임 줄이기(막음 자세 정지 그림)
//  7) 크기별(frame.html): 휴대폰 세로 360px·칠판 1920×1080에서 이름 글씨 크기, 가로 넘침 없음
//  8) 캡처: 여린입천장 거센 파열 미리 보기(가로·고1), 잇몸 비음 공기 흐름 도중, 모음 뒤·높은·둥글게 → tests/shots/
// 좌표 바뀜(T19): 그림 좌표계가 360×340 → 440×390으로 바뀌어 예전의 '가장 높은 곳 y' 기준값 대신 조음 목표(data의 at/hump)까지의
// 거리와 혀의 어느 부분이 닿는지(혀끝·혀 앞·혀 뒤)로 본다. 모음 높이 띠는 새 좌표(높은 112 · 중간 138 · 낮은 164 ±8)다.
import { step, url, frame } from './aside.mjs';

const PAGE = url('tests/pages/mouth.html');
const STRENGTHS = { stop: ['plain', 'tense', 'aspirated'], affricate: ['plain', 'tense', 'aspirated'], fricative: ['plain', 'tense', 'aspirated'], nasal: ['none'], liquid: ['none'] };
const consonantCombos = (places) => {
  const list = [];
  for (const place of places) for (const manner of Object.keys(STRENGTHS)) for (const strength of STRENGTHS[manner]) list.push({ place, manner, strength });
  if (places.includes('glottal')) list.push({ place: 'glottal', manner: 'fricative', strength: 'none' }); // /ㅎ/: 세기 없음
  return list;
};
const vowelCombos = [];
for (const b of ['front', 'back']) for (const h of ['high', 'mid', 'low']) for (const lips of ['unrounded', 'rounded']) vowelCombos.push({ tongue: `${b}-${h}`, lips });

// 페이지 안에서 조합들을 차례로 재생하며 15ms마다 상태를 적고 spec 5.2 표·조음 동작과 맞춰 본다. 틀린 점 목록을 돌려준다.
const PLAY_ALL = `async (combos) => {
  const EXPECT = { // spec 5.2 표(점검 쪽에 따로 적은 기대값)
    stop: { closure: 'full', nasal: 'closed' }, affricate: { closure: 'full-to-gap', nasal: 'closed' },
    fricative: { closure: 'gap', nasal: 'closed' }, nasal: { closure: 'full', nasal: 'open' },
    liquid: { closure: 'dotted', nasal: 'closed' }, vowel: { closure: 'none', nasal: 'closed' },
  };
  const P = window.MOUTH.PARTICLES, NEAR = window.MOUTH.NEAR, fails = [];
  const svg = document.querySelector('.mouth-svg');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const snap = () => {
    const cg = svg.querySelector('.mouth-closure');
    const vis = [...svg.querySelectorAll('.mouth-particle')].filter((c) => c.style.display !== 'none');
    return { closure: svg.dataset.closure, nasal: svg.dataset.nasal, glottis: svg.dataset.glottis, particles: +svg.dataset.particles,
      playing: svg.dataset.playing, shape: cg.dataset.shape, kind: cg.dataset.kind, phase: svg.dataset.phase, sc: +svg.dataset.sc,
      gap: svg.dataset.gap === '' ? null : +svg.dataset.gap, contact: svg.dataset.contact, puff: svg.dataset.puff, velum: +svg.dataset.velum,
      door: svg.querySelector('.mouth-door').dataset.state,
      ps: vis.map((c) => ({ s: +c.dataset.s, r: c.dataset.route })) };
  };
  const ORDER = ['approach', 'hold', 'release', 'rest'];
  for (const c of combos) {
    const name = JSON.stringify(c), bad = (m) => fails.push(name + ' ' + m);
    const manner = c.tongue ? 'vowel' : c.manner, ex = EXPECT[manner];
    const t0 = performance.now();
    let pr, done = false;
    try { pr = mouth.play(c); } catch (e) { bad('예외 ' + e.message); continue; }
    pr.then(() => { done = true; });
    const S = [];
    while (!done && performance.now() - t0 < 2500) { S.push(Object.assign(snap(), { t: performance.now() - t0 })); await wait(15); }
    await pr;
    const ms = performance.now() - t0, end = snap();
    if (ms > 1500) bad('재생 ' + Math.round(ms) + 'ms > 1500');
    if (S.length < 20) { bad('상태를 충분히 못 봄 ' + S.length); continue; }
    if (S[0].playing !== '1' || end.playing !== '0') bad('playing 표시 이상');
    if (!S.some((s) => s.ps.length)) bad('재생 중 입자가 안 보임');
    if (end.ps.length) bad('끝난 뒤 입자가 남음');
    for (const s of [S[0], S[S.length >> 1], end]) {
      if (s.closure !== ex.closure) bad('막음 규칙 ' + s.closure + ' ≠ ' + ex.closure);
      if (manner !== 'vowel' && s.kind !== ex.closure) bad('막음 표시 data-kind ' + s.kind);
      if (s.particles !== (c.strength === 'aspirated' ? 2 * P : P)) bad('입자 수 ' + s.particles);
    }
    // 조음 동작의 차례(뒤로 가지 않음)
    const ph = S.map((s) => s.phase).filter(Boolean);
    if (ph[0] !== 'approach') bad('처음이 다가감이 아님: ' + ph[0]);
    for (let i = 1; i < ph.length; i++) if (ORDER.indexOf(ph[i]) < ORDER.indexOf(ph[i - 1])) { bad('단계가 거꾸로 감 ' + ph[i - 1] + '→' + ph[i]); break; }
    if (!ph.includes('hold')) bad('막음·좁힘 단계가 없음');
    // 여린입천장 · 목청 조임 · 거센 입김은 그 소리에서만
    const nasalOpen = S.some((s) => s.nasal === 'open' && s.door === 'open');
    if (manner === 'nasal') {
      if (S[0].nasal !== 'closed') bad('비음인데 처음부터 콧길이 열려 있음(여린입천장이 내려가는 것이 안 보임)');
      if (!nasalOpen) bad('비음인데 여린입천장이 안 내려감');
      if (!S.some((s) => s.ps.some((q) => q.r === 'nose'))) bad('비음인데 콧길로 가는 입자가 없음');
      if (S.some((s) => s.ps.some((q) => q.r === 'oral' && q.s >= s.sc))) bad('비음인데 입 쪽 공기가 막는 곳을 넘음');
    } else if (nasalOpen) bad('비음이 아닌데 여린입천장이 내려감');
    const tight = S.some((s) => s.glottis === 'tight');
    if (tight !== (c.strength === 'tense')) bad('목청 조임 ' + tight + ' (된소리일 때만)');
    if (c.strength === 'tense') {
      const iT = S.findIndex((s) => s.glottis === 'tight'), iR = S.findIndex((s) => s.phase === 'release');
      if (iR >= 0 && !(iT >= 0 && iT < iR)) bad('된소리인데 풀리기 전에 목청이 조여지지 않음');
    }
    const puff = S.some((s) => s.puff === '1');
    if (puff !== (c.strength === 'aspirated')) bad('거센 입김 ' + puff + ' (거센소리일 때만)');
    if (manner === 'vowel') {
      if (S.some((s) => s.shape)) bad('모음인데 막음 표시가 그려짐');
      continue;
    }
    // 조음체 거리: 쉼(떨어짐) → 닿음/좁힘 → 풀림
    const hold = S.filter((s) => s.phase === 'hold');
    const g0 = S[0].gap;
    if (!(g0 > NEAR + 1.5)) bad('처음(쉼 자세)부터 붙어 있거나 좁음: 거리 ' + g0);
    const touch = hold.some((s) => s.contact === 'touch'), near = S.some((s) => s.contact === 'near' && (s.phase === 'hold' || s.phase === 'release'));
    if (manner === 'fricative') {
      if (S.some((s) => s.contact === 'touch')) bad('마찰인데 조음체가 닿음');
      if (!hold.some((s) => s.contact === 'near')) bad('마찰인데 좁은 틈을 유지하지 않음');
    } else if (!touch) bad('막는 동안 조음체가 닿지 않음 ' + JSON.stringify(hold.map((s) => s.gap)));
    if (manner === 'affricate') {
      if (!near) bad('파찰인데 틈으로 풀리지 않음');
      const iF = S.findIndex((s) => s.shape === 'full'), iG = S.findIndex((s) => s.shape === 'gap');
      if (!(iF >= 0 && iG > iF)) bad('파찰인데 막대 → 틈이 아님');
    }
    if (manner === 'stop') {
      const iR = S.findIndex((s) => s.phase === 'release');
      const after = S.slice(iR, iR + 12);
      if (iR < 0 || !after.some((s) => s.gap > NEAR + 1.5)) bad('파열인데 풀린 뒤 조음체가 떨어지지 않음 ' + JSON.stringify(after.map((s) => s.gap)));
      if (!S.some((s) => s.shape === 'full')) bad('파열인데 완전히 막힌 막대가 없음');
    }
    if (manner === 'liquid' && !S.some((s) => s.shape === 'dotted')) bad('유음인데 점선 막대가 없음');
    if (manner === 'fricative' && !S.some((s) => s.shape === 'gap')) bad('마찰인데 틈 막대가 없음');
    // 공기가 막는 곳 뒤에 쌓였다가 터짐(파열·파찰)
    if (manner === 'stop' || manner === 'affricate') {
      const pre = S.filter((s) => s.phase === 'approach' || s.phase === 'hold');
      if (pre.some((s) => s.ps.some((q) => q.s >= s.sc))) bad('터지기 전 입자가 막는 곳 앞(입술 쪽)에 있음');
      const last = pre[pre.length - 1];
      if (!last || !last.ps.length || Math.max(...last.ps.map((q) => q.s)) < last.sc - 30) bad('터지기 전 공기가 막는 곳 바로 뒤에 쌓이지 않음');
      const rel = S.filter((s) => s.phase === 'release');
      if (!rel.some((s) => s.ps.some((q) => q.s > s.sc))) bad('터진 뒤에도 입자가 막는 곳을 지나지 않음');
    }
  }
  return { n: combos.length, fails, errs: (window.__soriErrors || []).slice() };
}`;

function playStep(label, pageUrl, combos, v) {
  step(label, `{
const ${v}t = await openTab(${JSON.stringify(pageUrl)});
try {
  // 한 번의 evaluate는 30초 안에 끝나야 해서 8조합씩 나눈다
  const ${v}all = ${JSON.stringify(combos)}, ${v}r = { n: 0, fails: [], errs: [] };
  for (let i = 0; i < ${v}all.length; i += 8) {
    const q = await ${v}t.evaluate(${PLAY_ALL}, ${v}all.slice(i, i + 8));
    ${v}r.n += q.n; ${v}r.fails = ${v}r.fails.concat(q.fails); ${v}r.errs = q.errs;
  }
  console.log('조합 ' + ${v}r.n + '개 재생');
  if (${v}r.n !== ${combos.length}) console.log('FAIL 재생 수가 다름');
  if (${v}r.errs.length) console.log('FAIL 페이지 오류: ' + ${v}r.errs.join(' | '));
  if (${v}r.fails.length) console.log('FAIL ' + ${v}r.fails.slice(0, 20).join('\\nFAIL '));
  else if (!${v}r.errs.length) console.log('PASS');
} finally { await closeTab(${v}t); }
}`);
}

playStep('자음 재생: 두 입술·잇몸 (22조합)', PAGE, consonantCombos(['bilabial', 'alveolar']), 'pa');
playStep('자음 재생: 센입천장·여린입천장 (22조합)', PAGE, consonantCombos(['palatal', 'velar']), 'pb');
playStep('자음 재생: 목청 (12조합)', PAGE, consonantCombos(['glottal']), 'pc');
playStep('모음 재생: 혀 6자리 × 입술 2 (12조합)', PAGE + '?sea=vowel', vowelCombos, 'pd');

// 미리 보기의 해부학 위치: 혀 윤곽(path)을 촘촘히 따라가며 목표에 가장 가까운 점, 가장 높은 점을 찾는다.
step('미리 보기의 해부학 위치: 자리·방법·모음 칸에 맞게 혀·입술·목청·여린입천장', `{
const tg = await openTab(${JSON.stringify(PAGE)});
try {
  const tr = await tg.evaluate(async () => {
    const svg = document.querySelector('.mouth-svg'), tongue = svg.querySelector('.mouth-tongue'), M = window.MOUTH;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const pts = () => { const L = tongue.getTotalLength(), a = []; for (let i = 0; i <= 900; i++) { const q = tongue.getPointAtLength((L * i) / 900); a.push({ x: q.x, y: q.y, l: (L * i) / 900 }); } return a; };
    const top = () => pts().reduce((b, q) => (q.y < b.y ? q : b), { y: 1e9 });
    const nearest = (x, y) => pts().reduce((b, q) => { const d = Math.hypot(q.x - x, q.y - y); return d < b.d ? { d, x: q.x, y: q.y, l: q.l } : b; }, { d: 1e9 });
    const bar = () => {
      const tf0 = svg.querySelector('.mouth-closure').getAttribute('transform') || '';
      if (!tf0.startsWith('translate(')) return null;
      const xy = tf0.slice(10).split(')')[0].split(',');
      return { x: +xy[0], y: +xy[1] };
    };
    const read = () => ({ key: svg.dataset.tongue, contact: svg.dataset.contact, gap: +svg.dataset.gap, tx: +svg.dataset.tongueX, ty: +svg.dataset.tongueY,
      lip: svg.dataset.lipshape, glottis: svg.dataset.glottis, nasal: svg.dataset.nasal, velum: +svg.dataset.velum, top: top(), bar: bar(), d: tongue.getAttribute('d') });
    const out = { cons: {}, vow: {}, M: { NEAR: M.NEAR, alveolar: M.places.alveolar.at, palatal: M.places.palatal.at, hinge: M.shape.velum.hinge } };
    for (const place of ['bilabial', 'alveolar', 'palatal', 'velar', 'glottal']) {
      for (const manner of ['stop', 'fricative', 'liquid', 'nasal']) {
        mouth.select(null); mouth.setManner(null); await wait(260);
        const before = tongue.getAttribute('d');
        mouth.select(place); mouth.setManner(manner);
        const right = tongue.getAttribute('d');           // 고른 바로 뒤(아직 움직이는 중)
        await wait(90); const midD = tongue.getAttribute('d');
        await wait(260);
        const r = Object.assign(read(), { before, right, midD });
        r.near = isFinite(r.tx) ? nearest(r.tx, r.ty) : null;   // 혀 윤곽에서 닿는 점
        out.cons[place + '/' + manner] = r;
      }
    }
    mouth.select(null); mouth.setManner(null);
    mouth.setSea('vowel');
    for (const id of ['front-high', 'front-mid', 'front-low', 'back-high', 'back-mid', 'back-low']) {
      for (const lips of ['unrounded', 'rounded']) {
        mouth.select(id); mouth.setLips(lips); await wait(280);
        out.vow[id + '/' + lips] = read();
      }
    }
    document.documentElement.classList.add('reduce-motion');
    const d0 = tongue.getAttribute('d'); mouth.select('back-low'); mouth.select('front-high');
    out.instant = { changed: tongue.getAttribute('d') !== d0, top: top() };
    document.documentElement.classList.remove('reduce-motion');
    mouth.setSea('consonant');
    out.errs = window.__soriErrors.slice();
    return out;
  });
  const tf = [];
  const within = (v, a, b) => v >= a && v <= b;
  const NEAR = tr.M.NEAR;
  for (const [k, r] of Object.entries(tr.cons)) {
    const [place, manner] = k.split('/');
    const tonguePlace = ['alveolar', 'palatal', 'velar'].includes(place);
    const expContact = manner === 'fricative' ? 'near' : 'touch';
    if (r.key !== (tonguePlace ? place : 'neutral')) tf.push(k + ' data-tongue ' + r.key);
    if (r.contact !== expContact) tf.push(k + ' data-contact ' + r.contact + ' ≠ ' + expContact + ' (거리 ' + r.gap + ')');
    // 틈: 혀는 NEAR만큼(±1.5), 입술·성대는 붙지 않은 좁은 틈(0.8 < 거리 ≤ NEAR + 1.5)
    const nearOk = tonguePlace ? within(r.gap, NEAR - 1.5, NEAR + 1.5) : r.gap > 0.8 && r.gap <= NEAR + 1.5;
    if (manner === 'fricative' ? !nearOk : !(r.gap < 0.8)) tf.push(k + ' 조음체와 목표 사이 거리 ' + r.gap);
    if (r.nasal !== (manner === 'nasal' ? 'open' : 'closed')) tf.push(k + ' 콧길 ' + r.nasal);
    if (tonguePlace) {
      if (!r.near || r.near.d > 1.2) tf.push(k + ' data-tongue-x/y가 혀 윤곽 위가 아님 ' + JSON.stringify(r.near));
      // 혀의 어느 부분이 닿는가: 잇몸 = 혀끝(윤곽 시작), 센입천장 = 혀 앞(단단한 입천장 아래), 여린입천장 = 혀 뒤(센입천장 끝보다 뒤)
      if (place === 'alveolar') {
        if (!(r.near.l < 16)) tf.push(k + ' 잇몸에 닿는 것이 혀끝이 아님(윤곽 ' + r.near.l.toFixed(0) + ')');
        if (Math.hypot(r.tx - tr.M.alveolar[0], r.ty - tr.M.alveolar[1]) > NEAR + 1.5) tf.push(k + ' 혀끝이 잇몸 쪽에 있지 않음');
      }
      if (place === 'palatal') {
        if (!(r.near.l > 40) || !within(r.tx, 170, 215) || !(r.ty < 112)) tf.push(k + ' 센입천장에 닿는 것이 혀 앞이 아님 ' + r.tx + ',' + r.ty);
      }
      if (place === 'velar') {
        if (!(r.tx > tr.M.hinge[0] + 2)) tf.push(k + ' 여린입천장(센입천장 끝보다 뒤)에 닿지 않음 x ' + r.tx);
        if (!(r.near.l > 150)) tf.push(k + ' 여린입천장에 닿는 것이 혀 뒤가 아님');
      }
      if (manner !== 'fricative' && (!r.bar || Math.hypot(r.bar.x - r.tx, r.bar.y - r.ty) > 3)) tf.push(k + ' 막음 막대가 닿는 곳에 있지 않음 ' + JSON.stringify(r.bar) + ' / ' + r.tx + ',' + r.ty);
      if (r.right !== r.before) tf.push(k + ' 혀가 움직임 없이 한 번에 바뀜');
      if (r.midD === r.d && r.midD === r.right) tf.push(k + ' 혀가 움직이지 않음');
    } else {
      if (!(r.top.y >= 128)) tf.push(k + ' 혀가 쉬어야 하는데 올라감 y ' + r.top.y.toFixed(1));
      if (place === 'bilabial' && r.lip !== (manner === 'fricative' ? 'gap' : 'closed')) tf.push(k + ' 입술 모양 ' + r.lip);
      if (place === 'glottal' && r.lip !== 'open') tf.push(k + ' 입술 모양 ' + r.lip);
      if (place === 'glottal' && r.glottis !== (manner === 'fricative' ? 'narrow' : 'closed')) tf.push(k + ' 목청 ' + r.glottis);
    }
  }
  // 여린입천장 + 비음: 여린입천장이 내려가도 혀 뒤가 따라 붙어 있음
  const vn = tr.cons['velar/nasal'];
  if (!(vn.velum > 20)) tf.push('여린입천장 비음인데 여린입천장이 내려가지 않음 ' + vn.velum);
  const HT = { high: [104, 120], mid: [130, 146], low: [156, 172] };
  const ys = {};
  for (const [k, r] of Object.entries(tr.vow)) {
    const [id, lips] = k.split('/'), [b, h] = id.split('-');
    if (r.key !== id) tf.push(k + ' data-tongue ' + r.key);
    const xr = b === 'front' ? [165, 205] : [270, 310];
    if (!within(r.top.x, xr[0], xr[1])) tf.push(k + ' 혓몸 가장 높은 곳 x ' + r.top.x.toFixed(1) + ' (기대 ' + xr + ')');
    if (!within(r.top.y, HT[h][0], HT[h][1])) tf.push(k + ' 혓몸 가장 높은 곳 y ' + r.top.y.toFixed(1) + ' (기대 ' + HT[h] + ')');
    if (r.lip !== (lips === 'rounded' ? 'rounded' : 'spread')) tf.push(k + ' 입술 모양 ' + r.lip);
    if (r.nasal !== 'closed') tf.push(k + ' 모음인데 콧길이 열림');
    ys[id] = r.top.y;
  }
  for (const b of ['front', 'back']) {
    if (!(ys[b + '-mid'] - ys[b + '-high'] >= 18 && ys[b + '-low'] - ys[b + '-mid'] >= 18)) tf.push(b + ' 높이 차이가 작음 ' + JSON.stringify(ys));
  }
  if (!tr.instant.changed || !(tr.instant.top.y <= 120)) tf.push('움직임 줄이기에서 혀가 바로 바뀌지 않음 ' + JSON.stringify(tr.instant));
  if (tr.errs.length) tf.push('페이지 오류: ' + tr.errs.join(' | '));
  console.log('자음 ' + Object.keys(tr.cons).length + '·모음 ' + Object.keys(tr.vow).length + '가지 모양 확인');
  if (tf.length) console.log('FAIL ' + tf.slice(0, 25).join('\\nFAIL ')); else console.log('PASS');
} finally { await closeTab(tg); }
}`);

step('보여 주기 전용 · 이름 보이기·숨기기 · 학년별 이름 · 이름과 움직이는 것이 겹치지 않음 · 움직임 줄이기', `{
const na = await openTab(${JSON.stringify(PAGE + '?names=0')});
try {
  const nr = await na.evaluate(async () => {
    const out = {}, svg = document.querySelector('.mouth-svg');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const visText = () => [...svg.querySelectorAll('text')].filter((t) => t.getBoundingClientRect().width > 0 && getComputedStyle(t).visibility !== 'hidden').map((t) => t.textContent);
    // 작은 그림 이름('앞에서 본 입술')은 모음 바다에서만, 자리 이름이 아니므로 숨김 단계에서도 보인다
    // 보여 주기 전용: 누르는 곳·초점·단추 역할이 없고 포인터를 받지 않는다
    out.interactive = svg.querySelectorAll('[tabindex], [role="button"], .mouth-hit, .mouth-spot, a, button').length;
    out.pe = getComputedStyle(svg).pointerEvents;
    out.role = svg.getAttribute('role');
    out.hidden = visText();
    out.hiddenAttr = svg.dataset.names;
    mouth.setShowNames(true);
    out.m3 = visText();
    out.outside = [...svg.querySelectorAll('text')].filter((t) => !t.closest('.mouth-labels') && !t.classList.contains('mouth-caption')).length;
    mouth.setGrade('h1');
    out.h1 = visText();
    // 고른 자리 이름 강조
    mouth.select('velar'); out.sel = [...svg.querySelectorAll('.mouth-label.is-selected')].map((t) => t.dataset.place);
    // 이름과 움직이는 것이 겹치지 않음: 여러 자세에서 이름 상자 × (혀·입술·여린입천장·성대) 상자
    const hitAny = () => {
      const labs = [...svg.querySelectorAll('.mouth-label')].filter((t) => getComputedStyle(t).display !== 'none').map((t) => ({ t: t.textContent, b: t.getBoundingClientRect() }));
      const moving = [...svg.querySelectorAll('.mouth-tongue, .mouth-lip-line, .mouth-velum, .mouth-fold, .mouth-puff, .mouth-tight')].map((e) => e.getBoundingClientRect()).filter((b) => b.width > 0);
      const over = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
      const bad = [];
      labs.forEach((L) => moving.forEach((m) => { if (over(L.b, m)) bad.push(L.t); }));
      for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) if (over(labs[i].b, labs[j].b)) bad.push(labs[i].t + '×' + labs[j].t);
      return bad;
    };
    out.overlap = [];
    document.documentElement.classList.add('reduce-motion');
    for (const c of [{ place: 'velar', manner: 'nasal', strength: 'none' }, { place: 'alveolar', manner: 'stop', strength: 'aspirated' }, { place: 'bilabial', manner: 'stop', strength: 'tense' }, { place: 'glottal', manner: 'stop', strength: 'plain' }]) {
      mouth.select(c.place); mouth.setManner(c.manner); mouth.setStrength(c.strength === 'none' ? null : c.strength);
      out.overlap = out.overlap.concat(hitAny().map((x) => JSON.stringify(c) + ' ' + x));
      await mouth.play(c);
      out.overlap = out.overlap.concat(hitAny().map((x) => '재생 ' + JSON.stringify(c) + ' ' + x));
    }
    document.documentElement.classList.remove('reduce-motion');
    mouth.setShowNames(false);
    out.h1hidden = visText();
    mouth.setSea('vowel'); mouth.setShowNames(true); mouth.setGrade('m3');
    out.vm3 = visText();
    mouth.setGrade('h1'); out.vh1 = visText();
    for (const id of ['front-high', 'back-low', 'back-high']) { mouth.select(id); mouth.setLips('rounded'); await wait(260); out.overlap = out.overlap.concat(hitAny().map((x) => id + ' ' + x)); }
    mouth.setShowNames(false); out.vhidden = visText();
    mouth.setSea('consonant');
    return out;
  });
  const nf = [];
  if (nr.interactive) nf.push('보여 주기 전용인데 누르는 요소가 ' + nr.interactive + '개');
  if (nr.pe !== 'none') nf.push('단면도가 포인터를 받음: ' + nr.pe);
  if (nr.role !== 'img') nf.push('단면도 역할이 그림(img)이 아님: ' + nr.role);
  if (nr.hidden.length || nr.hiddenAttr !== 'hidden') nf.push('이름 숨김인데 글씨가 보임: ' + nr.hidden.join(','));
  for (const w of ['두 입술', '잇몸', '센입천장', '여린입천장', '목청']) if (!nr.m3.includes(w)) nf.push('중3 이름 없음: ' + w + ' / ' + nr.m3.join(','));
  if (nr.m3.some((w) => /음$/.test(w))) nf.push('중3에 한자어 이름: ' + nr.m3.join(','));
  // 단면도의 이름은 몸의 부위 이름(학년 공통). 고1의 한자어(양순음 …)는 아래 자리 카드가 보인다(check-controls).
  if (nr.h1.join() !== nr.m3.join()) nf.push('고1 단면도 이름이 몸의 부위 이름이 아님: ' + nr.h1.join(','));
  if (nr.outside) nf.push('이름·작은 그림 이름 밖의 글씨가 그림에 있음');
  if (nr.sel.join() !== 'velar') nf.push('고른 자리 이름 강조: ' + nr.sel.join());
  if (nr.overlap.length) nf.push('이름이 움직이는 것·다른 이름과 겹침: ' + nr.overlap.slice(0, 6).join(' | '));
  if (nr.h1hidden.length) nf.push('고1 이름 숨김 실패');
  for (const w of ['혀 앞', '혀 뒤', '높은', '중간', '낮은', '앞에서 본 입술']) if (!nr.vm3.includes(w)) nf.push('모음 중3 이름 없음: ' + w);
  for (const w of ['전설', '후설', '고모음', '중모음', '저모음']) if (!nr.vh1.includes(w)) nf.push('모음 고1 이름 없음: ' + w);
  if (nr.vhidden.join() !== '앞에서 본 입술') nf.push('모음 이름 숨김 실패(작은 그림 이름만 남아야 함): ' + nr.vhidden.join());
  // 미리 보기(막음 표시·콧길 문·목청)
  const pv = await na.evaluate(() => {
    const svg = document.querySelector('.mouth-svg'), r = {};
    mouth.select('velar'); r.pending = svg.querySelector('.mouth-closure').dataset.shape;
    mouth.setManner('nasal'); r.nasal = [svg.dataset.closure, svg.querySelector('.mouth-closure').dataset.shape];
    mouth.setManner(null); mouth.setStrength(null); mouth.select(null); r.clear = [svg.dataset.closure, svg.querySelector('.mouth-closure').children.length];
    return r;
  });
  const pvT = await na.evaluate(() => { const svg = document.querySelector('.mouth-svg'); mouth.select('velar'); mouth.setManner('stop'); mouth.setStrength('tense'); return new Promise((r) => setTimeout(() => r([svg.dataset.closure, svg.dataset.glottis]), 300)); });
  pv.tense = pvT;
  await na.evaluate(() => new Promise((r) => setTimeout(r, 300)));
  const pv2 = await na.evaluate(() => { const svg = document.querySelector('.mouth-svg'); mouth.setStrength(null); mouth.select('velar'); mouth.setManner('nasal'); return new Promise((r) => setTimeout(() => r([svg.dataset.nasal, svg.dataset.glottis]), 300)); });
  if (pv.pending !== 'pending') nf.push('자리만 고른 막음 표시 이상: ' + pv.pending);
  if (pv.nasal.join() !== 'full,full') nf.push('비음 미리 보기 막음 이상: ' + pv.nasal.join());
  if (pv2.join() !== 'open,normal') nf.push('비음 미리 보기(여린입천장 내려감) 이상: ' + pv2.join());
  if (pv.tense[1] !== 'tight') nf.push('된소리 미리 보기 이상: ' + pv.tense.join());
  if (pv.clear.join() !== ',0') nf.push('지우기 이상: ' + pv.clear.join());
  // 움직임 줄이기: 막음 자세의 정지 그림, 곧바로 끝남
  const rm = await na.evaluate(async () => {
    document.documentElement.classList.add('reduce-motion');
    const svg = document.querySelector('.mouth-svg'), t0 = performance.now();
    await mouth.play({ place: 'palatal', manner: 'affricate', strength: 'aspirated' });
    const r = { ms: performance.now() - t0, st: svg.dataset.static, shape: svg.querySelector('.mouth-closure').dataset.shape, contact: svg.dataset.contact,
      vis: [...svg.querySelectorAll('.mouth-particle')].filter((c) => c.style.display !== 'none').length };
    document.documentElement.classList.remove('reduce-motion');
    r.errs = window.__soriErrors.slice();
    return r;
  });
  if (!(rm.ms < 300) || rm.st !== '1' || !(rm.vis > 0) || rm.shape !== 'gap' || rm.contact !== 'near') nf.push('움직임 줄이기 이상: ' + JSON.stringify(rm));
  if (rm.errs.length) nf.push('페이지 오류: ' + rm.errs.join(' | '));
  if (nf.length) console.log('FAIL ' + nf.join('\\nFAIL ')); else console.log('PASS');
} finally { await closeTab(na); }
}`);

step('크기별: 휴대폰 세로 360px·칠판 1920×1080 — 이름 글씨 크기·가로 넘침 없음', `{
const sizes = [[360, 300, 'tests/pages/mouth.html', 11.5], [360, 300, 'tests/pages/mouth.html?sea=vowel', 11.5], [360, 300, 'tests/pages/mouth.html?grade=h1', 11.5],
  [1920, 1080, 'tests/pages/mouth.html', 17], [1280, 720, 'tests/pages/mouth.html?sea=vowel', 15]];
const sf = [];
for (const [w, h, src, minPx] of sizes) {
  const fu = ${JSON.stringify(url('tests/pages/frame.html'))} + '?w=' + w + '&h=' + h + '&src=' + encodeURIComponent(src);
  const ft = await openTab(fu);
  try {
    const fr = await ft.evaluate(async () => {
      await window.frameReady;
      await new Promise((r) => setTimeout(r, 400));
      const W = window.frameWin(), d = W.document;
      const svg = d.querySelector('.mouth-svg'), sr = svg.getBoundingClientRect();
      const labs = [...d.querySelectorAll('.mouth-label')].map((t) => ({ h: t.getBoundingClientRect().height, fs: parseFloat(W.getComputedStyle(t).fontSize), b: t.getBoundingClientRect() }));
      const ctm = svg.getScreenCTM();
      return { fsPx: labs.map((l) => l.fs * (ctm ? ctm.a : 1)), inside: labs.every((l) => l.b.left >= sr.left - 1 && l.b.right <= sr.right + 1 && l.b.top >= sr.top - 1 && l.b.bottom <= sr.bottom + 1),
        svgW: sr.width, svgH: sr.height, scrollW: d.documentElement.scrollWidth, innerW: W.innerWidth, errs: W.__soriErrors.slice() };
    });
    const tag = w + 'x' + h + ' ' + src;
    console.log(tag + ' 이름 글씨 ' + fr.fsPx.map((x) => x.toFixed(1)).join(',') + 'px, 그림 ' + Math.round(fr.svgW) + 'x' + Math.round(fr.svgH));
    if (fr.fsPx.some((x) => x < minPx - 0.3)) sf.push(tag + ' 이름 글씨가 ' + minPx + 'px보다 작음');
    if (!fr.inside) sf.push(tag + ' 이름이 그림 밖으로 나감');
    if (fr.scrollW > fr.innerW) sf.push(tag + ' 가로로 넘침');
    if (fr.svgW < 100) sf.push(tag + ' 그림이 너무 작음');
    if (fr.errs.length) sf.push(tag + ' 페이지 오류: ' + fr.errs.join(' | '));
  } finally { await closeTab(ft); }
}
if (sf.length) console.log('FAIL ' + sf.join('\\nFAIL ')); else console.log('PASS');
}`);

// 캡처. aside의 성질: frame.html(iframe) 안은 캡처하지 못하고, 한 번의 호출에서 두 번째로 연 탭도 캡처가 멈춘다.
// 그래서 세로 캡처는 점검 페이지의 고정 크기 상자(&w=360&h=640)로, 한 호출에 한 장씩 찍는다.
// at: 발사 계획의 그 시각(초) 장면(frameAt — 점검·캡처용), 없으면 미리 보기(카드를 고른 때의 멈춘 그림)
function shotStep(label, name, pageUrl, combo, at, clip) {
  step(label, `{
await fs.mkdir('./artifacts', { recursive: true });
const ct = await openTab(${JSON.stringify(pageUrl)});
try {
  const cr = await ct.evaluate(async (a) => {
    const c = a[0], at = a[1];
    if (at != null) mouth.frameAt(c, at);
    else if (c.tongue) { mouth.select(c.tongue); mouth.setLips(c.lips); }
    else { mouth.select(c.place); mouth.setManner(c.manner); mouth.setStrength(c.strength === 'none' ? null : c.strength); }
    await new Promise((r) => setTimeout(r, 400));
    return window.__soriErrors.slice();
  }, [${JSON.stringify(combo)}, ${at == null ? 'null' : at}]);
  await fs.writeFile('./artifacts/${name}.png', await ct.screenshot(${clip ? JSON.stringify({ clip }) : ''}));
  console.log('SHOTFILE:' + path.resolve('./artifacts/${name}.png'));
  if (cr.length) console.log('FAIL 페이지 오류: ' + cr.join(' | ')); else console.log('PASS');
} finally { await closeTab(ct); }
}`);
}
shotStep('캡처: 가로(칠판, 고1, 여린입천장 거센 파열 미리 보기)', 'mouth-landscape', PAGE + '?grade=h1', { place: 'velar', manner: 'stop', strength: 'aspirated' });
shotStep('캡처: 휴대폰 세로(잇몸 비음 — 공기가 코로 흐르는 도중)', 'mouth-portrait', PAGE + '?w=360&h=640', { place: 'alveolar', manner: 'nasal', strength: 'none' }, 1.0, { x: 0, y: 0, width: 360, height: 640 });
shotStep('캡처: 휴대폰 세로 모음(뒤·높은·둥글게)', 'mouth-portrait-vowel', PAGE + '?w=360&h=640&sea=vowel', { tongue: 'back-high', lips: 'rounded' }, null, { x: 0, y: 0, width: 360, height: 640 });
