// 입안 단면도(G.mouth) 점검(aside). 점검용 페이지 tests/pages/mouth.html에서 단면도만 띄운다.
//  1~3) 자음 5자리 × 5방법 × 쓸 수 있는 세기(+ 목청·마찰·세기 없음), 모음 6자리 × 입술 2가지를 모두 재생:
//       페이지 오류 없음, 1.5초 안에 끝남, 입자가 실제로 그려짐,
//       막음 표시(규칙·그려진 모양)·콧길 문·목청 조임·입자 수가 spec 5.2 표와 같음,
//       파열·파찰은 막는 동안(hold) 모든 입자가 막는 곳보다 목청 쪽(공기 길 위 거리 s < 막는 곳)에 쌓이고, 터진 뒤 지나감,
//       비음은 입 쪽 입자가 막는 곳을 넘지 않음
//  3b) 혀 모양: 자리·방법·모음 칸마다 data-tongue/data-contact와, 실제 혀 윤곽의 가장 높은 곳이 기대한 곳으로 옮겨 갔는지
//      (잇몸=혀끝, 센입천장=혓몸 앞, 여린입천장=혓몸 뒤가 막음 막대에 닿음, 마찰은 틈만큼 떨어짐, 모음은 앞뒤×높이),
//      혀가 짧게 움직여 바뀌는지(움직임 줄이기면 바로), 입술 모양(두 입술 닫힘, 원순 내밂)
//  4) 자리 이름 보이기/숨기기, 학년별 이름, 그림 안 글씨는 이름뿐, 눌러서 고르기, 움직임 줄이기(정지 그림)
//  5) 크기별(frame.html): 휴대폰 세로 360px 너비에서 누르는 곳이 48px 이상이고 서로 겹치지 않음(자음 5곳·모음 6칸),
//     칠판 1920×1080에서 64px 이상
//  6) 캡처: 가로(칠판) 한 장, 휴대폰 세로 한 장 → tests/shots/
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

// 페이지 안에서 조합들을 차례로 재생하며 spec 5.2 표와 맞춰 본다. 틀린 점 목록을 돌려준다.
const PLAY_ALL = `async (combos) => {
  // spec 5.2 표(점검 쪽에 따로 적은 기대값)
  const EXPECT = {
    stop: { closure: 'full', nasal: 'closed' }, affricate: { closure: 'full-to-gap', nasal: 'closed' },
    fricative: { closure: 'gap', nasal: 'closed' }, nasal: { closure: 'full', nasal: 'open' },
    liquid: { closure: 'dotted', nasal: 'closed' }, vowel: { closure: 'none', nasal: 'closed' },
  };
  const P = window.MOUTH.PARTICLES, fails = [];
  const svg = document.querySelector('.mouth-svg');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const snap = () => {
    const cg = svg.querySelector('.mouth-closure'), door = svg.querySelector('.mouth-door');
    return { closure: svg.dataset.closure, nasal: svg.dataset.nasal, glottis: svg.dataset.glottis, particles: +svg.dataset.particles,
      playing: svg.dataset.playing, shape: cg.dataset.shape, kind: cg.dataset.kind, children: cg.children.length,
      bars: cg.querySelectorAll('rect.mouth-bar:not(.mouth-bar-pending)').length, dotted: cg.querySelectorAll('line.mouth-bar-dotted').length,
      door: door.dataset.state, doorT: door.getAttribute('transform') || '',
      tight: getComputedStyle(svg.querySelector('.mouth-tight')).display !== 'none',
      vis: [...svg.querySelectorAll('.mouth-particle')].filter((c) => c.style.display !== 'none').length,
      phase: svg.dataset.phase, sc: +svg.dataset.sc,
      ps: [...svg.querySelectorAll('.mouth-particle')].filter((c) => c.style.display !== 'none').map((c) => ({ s: +c.dataset.s, r: c.dataset.route })) };
  };
  const shapeOk = (s, shape) => shape === 'full' ? s.shape === 'full' && s.bars === 1 && s.dotted === 0
    : shape === 'gap' ? s.shape === 'gap' && s.bars === 2 && s.dotted === 0
    : shape === 'dotted' ? s.shape === 'dotted' && s.dotted === 1 && s.bars === 0
    : shape === 'none' ? s.children === 0 : false;
  for (const c of combos) {
    const name = JSON.stringify(c), bad = (m) => fails.push(name + ' ' + m);
    const manner = c.tongue ? 'vowel' : c.manner, ex = EXPECT[manner];
    const t0 = performance.now();
    let pr;
    try { pr = mouth.play(c); } catch (e) { bad('예외 ' + e.message); continue; }
    await wait(80); const early = snap();
    // 파열·파찰: 터지기 직전(막고 쌓인 상태)까지 지켜보고, 터지고 조금 뒤에 다시 본다
    let mid, late, pre = null;
    if (manner === 'stop' || manner === 'affricate') {
      while (svg.dataset.phase !== 'release' && performance.now() - t0 < 1100) { pre = snap(); await wait(15); }
      if (!pre || pre.phase !== 'hold') bad('터지기 전 쌓인 상태를 못 봄');
      else if (!pre.ps.length || Math.max(...pre.ps.map((q) => q.s)) < pre.sc - 25) bad('터지기 전 공기가 막는 곳 바로 뒤에 쌓이지 않음 ' + JSON.stringify(pre.ps.map((q) => q.s)) + ' sc=' + pre.sc);
      else if (pre.ps.some((q) => q.s >= pre.sc)) bad('터지기 전 입자가 막는 곳 앞(입술 쪽)에 있음 sc=' + pre.sc);
      await wait(150); // 터지고 조금 지난 뒤
      late = snap();
      mid = pre || late;
    } else {
      await wait(420); mid = snap(); late = mid;
    }
    await pr; const ms = performance.now() - t0; const end = snap();
    // 공기가 막는 곳의 어느 쪽에 있는가(s: 목청 아래에서 잰 거리, sc: 막는 곳)
    if (manner === 'stop' || manner === 'affricate') {
      if (early.phase !== 'hold') bad('처음이 막고 쌓이는 단계가 아님: ' + early.phase);
      for (const [k, s] of [['early', early], ['mid', mid], ['late', late]]) {
        if (s.phase === 'hold' && s.ps.some((q) => q.s >= s.sc)) bad(k + ' 막는 동안 입자가 막는 곳 앞(입술 쪽)에 있음 ' + JSON.stringify(s.ps.map((q) => q.s)) + ' sc=' + s.sc);
      }
      if (late.phase !== 'release') bad('끝 무렵에도 터지지 않음: ' + late.phase);
      else if (!late.ps.some((q) => q.s > late.sc) && !(late.ps.length < mid.ps.length)) bad('터진 뒤에도 입자가 막는 곳을 지나지 않음 ' + JSON.stringify(late.ps.map((q) => q.s)) + ' sc=' + late.sc);
    }
    if (manner === 'nasal') {
      for (const [k, s] of [['early', early], ['mid', mid], ['late', late]]) {
        if (s.ps.some((q) => q.r === 'oral' && q.s >= s.sc)) bad(k + ' 비음인데 입 쪽 공기가 막는 곳을 넘음');
      }
      if (!mid.ps.some((q) => q.r === 'nose')) bad('비음인데 콧길로 가는 입자가 없음');
    }
    if (ms > 1500) bad('재생 ' + Math.round(ms) + 'ms > 1500');
    if (early.playing !== '1' || end.playing !== '0') bad('playing 표시 이상');
    if (!(mid.vis > 0)) bad('재생 중 입자가 안 보임');
    if (end.vis !== 0) bad('끝난 뒤 입자가 남음');
    for (const [k, s] of [['early', early], ['mid', mid], ['end', end]]) {
      if (s.closure !== ex.closure) bad(k + ' 막음 규칙 ' + s.closure + ' ≠ ' + ex.closure);
      if (s.nasal !== ex.nasal || s.door !== ex.nasal) bad(k + ' 콧길 문 ' + s.nasal + '/' + s.door + ' ≠ ' + ex.nasal);
      if (!s.doorT.includes(ex.nasal === 'open' ? 'rotate(68)' : 'rotate(0)')) bad(k + ' 콧길 문 그림 ' + s.doorT);
      if (manner !== 'vowel' && s.kind !== ex.closure) bad(k + ' 막음 표시 data-kind ' + s.kind);
      const tense = c.strength === 'tense';
      if (s.tight !== tense || s.glottis !== (tense ? 'tight' : 'normal')) bad(k + ' 목청 조임 ' + s.glottis + '/' + s.tight);
      if (s.particles !== (c.strength === 'aspirated' ? 2 * P : P)) bad(k + ' 입자 수 ' + s.particles);
    }
    if (ex.closure === 'full-to-gap') {
      if (!shapeOk(early, 'full')) bad('파찰음 처음이 완전히 막힌 막대가 아님 ' + JSON.stringify(early));
      if (!shapeOk(end, 'gap')) bad('파찰음 끝이 틈 막대가 아님 ' + JSON.stringify(end));
    } else {
      for (const [k, s] of [['early', early], ['end', end]]) if (!shapeOk(s, ex.closure)) bad(k + ' 막음 모양 ' + JSON.stringify(s));
    }
  }
  return { n: combos.length, fails, errs: (window.__soriErrors || []).slice() };
}`;

function playStep(label, pageUrl, combos, v) {
  step(label, `{
const ${v}t = await openTab(${JSON.stringify(pageUrl)});
try {
  const ${v}r = await ${v}t.evaluate(${PLAY_ALL}, ${JSON.stringify(combos)});
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

// 혀 모양 점검: 혀 윤곽(path)을 촘촘히 따라가며 가장 높은(y가 가장 작은) 점을 찾는다.
step('혀 모양: 자리·방법·모음 칸을 따라 바뀜', `{
const tg = await openTab(${JSON.stringify(PAGE)});
try {
  const tr = await tg.evaluate(async () => {
    const svg = document.querySelector('.mouth-svg'), tongue = svg.querySelector('.mouth-tongue');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const top = () => {
      const L = tongue.getTotalLength(); let b = { x: 0, y: 1e9 };
      for (let i = 0; i <= 800; i++) { const q = tongue.getPointAtLength((L * i) / 800); if (q.y < b.y) b = { x: q.x, y: q.y }; }
      return b;
    };
    const bar = () => {
      const tf0 = svg.querySelector('.mouth-closure').getAttribute('transform') || '';
      if (!tf0.startsWith('translate(')) return null;
      const xy = tf0.slice(10).split(')')[0].split(',');
      return { x: +xy[0], y: +xy[1] };
    };
    const read = () => ({ key: svg.dataset.tongue, contact: svg.dataset.contact, tx: +svg.dataset.tongueX, ty: +svg.dataset.tongueY,
      lip: svg.dataset.lipshape, top: top(), bar: bar(), d: tongue.getAttribute('d') });
    const out = { cons: {}, vow: {} };
    // 자음: 자리마다 파열(닿음)·마찰(틈)·유음(닿음)
    for (const place of ['bilabial', 'alveolar', 'palatal', 'velar', 'glottal']) {
      for (const manner of ['stop', 'fricative', 'liquid']) {
        mouth.select(null); mouth.setManner(null); await wait(260);
        const before = tongue.getAttribute('d');
        mouth.select(place); mouth.setManner(manner);
        const right = tongue.getAttribute('d');           // 고른 바로 뒤(아직 움직이는 중)
        await wait(90); const midD = tongue.getAttribute('d');
        await wait(260);
        out.cons[place + '/' + manner] = Object.assign(read(), { before, right, midD });
      }
    }
    // 모음
    mouth.setSea('vowel');
    for (const id of ['front-high', 'front-mid', 'front-low', 'back-high', 'back-mid', 'back-low']) {
      for (const lips of ['unrounded', 'rounded']) {
        mouth.select(id); mouth.setLips(lips); await wait(280);
        out.vow[id + '/' + lips] = read();
      }
    }
    // 움직임 줄이기: 바로 바뀐다
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
  // 기대하는 가장 높은 곳(그림 단위)
  const REGION = { alveolar: { x: [78, 96], y: 129 }, palatal: { x: [150, 170], y: 121 }, velar: { x: [238, 262], y: 131 } };
  for (const [k, r] of Object.entries(tr.cons)) {
    const [place, manner] = k.split('/');
    const lift = REGION[place];
    const expContact = !lift ? 'none' : manner === 'fricative' ? 'near' : 'touch';
    if (r.key !== (lift ? place : 'neutral')) tf.push(k + ' data-tongue ' + r.key);
    if (r.contact !== expContact) tf.push(k + ' data-contact ' + r.contact + ' ≠ ' + expContact);
    if (Math.hypot(r.top.x - r.tx, r.top.y - r.ty) > 3) tf.push(k + ' 혀의 가장 높은 곳 ' + JSON.stringify(r.top) + '이 data-tongue-x/y(' + r.tx + ',' + r.ty + ')와 다름');
    if (lift) {
      const ref = tr.cons[place + '/stop'].top;
      if (!within(r.top.x, lift.x[0], lift.x[1])) tf.push(k + ' 혀가 닿는 곳의 x ' + r.top.x.toFixed(1) + ' (기대 ' + lift.x + ')');
      if (manner === 'fricative') {
        if (!(r.top.y >= ref.y + 4)) tf.push(k + ' 마찰인데 혀가 틈만큼 떨어지지 않음 ' + r.top.y.toFixed(1) + ' vs ' + ref.y.toFixed(1));
      } else {
        if (!(r.top.y <= lift.y)) tf.push(k + ' 혀가 입천장까지 안 올라감 y ' + r.top.y.toFixed(1));
        if (!r.bar || Math.hypot(r.bar.x - r.top.x, r.bar.y - r.top.y) > 6) tf.push(k + ' 막음 막대가 닿는 곳에 있지 않음 ' + JSON.stringify(r.bar) + ' / ' + JSON.stringify(r.top));
      }
      if (r.right !== r.before) tf.push(k + ' 혀가 움직임 없이 한 번에 바뀜');
      if (r.midD === r.d && r.midD === r.right) tf.push(k + ' 혀가 움직이지 않음');
    } else {
      if (!(r.top.y >= 145)) tf.push(k + ' 혀가 가만히 있어야 하는데 올라감 y ' + r.top.y.toFixed(1));
      if (place === 'bilabial' && r.lip !== (manner === 'fricative' ? 'gap' : 'closed')) tf.push(k + ' 입술 모양 ' + r.lip);
      if (place === 'glottal' && r.lip !== 'open') tf.push(k + ' 입술 모양 ' + r.lip);
    }
  }
  const HT = { high: [110, 134], mid: [164, 180], low: [206, 222] };
  const ys = {};
  for (const [k, r] of Object.entries(tr.vow)) {
    const [id, lips] = k.split('/'), [b, h] = id.split('-');
    if (r.key !== id) tf.push(k + ' data-tongue ' + r.key);
    const xr = b === 'front' ? [120, 152] : [218, 250];
    if (!within(r.top.x, xr[0], xr[1])) tf.push(k + ' 혓몸 가장 높은 곳 x ' + r.top.x.toFixed(1) + ' (기대 ' + xr + ')');
    if (!within(r.top.y, HT[h][0], HT[h][1])) tf.push(k + ' 혓몸 가장 높은 곳 y ' + r.top.y.toFixed(1) + ' (기대 ' + HT[h] + ')');
    if (r.lip !== (lips === 'rounded' ? 'rounded' : 'open')) tf.push(k + ' 입술 모양 ' + r.lip);
    ys[id] = r.top.y;
  }
  for (const b of ['front', 'back']) {
    if (!(ys[b + '-mid'] - ys[b + '-high'] >= 25 && ys[b + '-low'] - ys[b + '-mid'] >= 25)) tf.push(b + ' 높이 차이가 작음 ' + JSON.stringify(ys));
  }
  if (!tr.instant.changed || !(tr.instant.top.y <= 134)) tf.push('움직임 줄이기에서 혀가 바로 바뀌지 않음 ' + JSON.stringify(tr.instant));
  if (tr.errs.length) tf.push('페이지 오류: ' + tr.errs.join(' | '));
  console.log('자음 ' + Object.keys(tr.cons).length + '·모음 ' + Object.keys(tr.vow).length + '가지 혀 모양 확인');
  if (tf.length) console.log('FAIL ' + tf.slice(0, 25).join('\\nFAIL ')); else console.log('PASS');
} finally { await closeTab(tg); }
}`);

step('이름 보이기·숨기기, 학년별 이름, 누르기, 움직임 줄이기', `{
const na = await openTab(${JSON.stringify(PAGE + '?names=0')});
try {
  const nr = await na.evaluate(async () => {
    const out = {}, svg = document.querySelector('.mouth-svg');
    const visText = () => [...svg.querySelectorAll('text')].filter((t) => t.getBoundingClientRect().width > 0 && getComputedStyle(t).visibility !== 'hidden').map((t) => t.textContent);
    out.hidden = visText();
    out.hiddenAttr = svg.dataset.names;
    out.hiddenAria = [...svg.querySelectorAll('.mouth-hit')].map((h) => h.getAttribute('aria-label')).join(',');
    mouth.setShowNames(true);
    out.m3 = visText();
    out.outside = [...svg.querySelectorAll('text')].filter((t) => !t.closest('.mouth-labels')).length;
    mouth.setGrade('h1');
    out.h1 = visText();
    mouth.setShowNames(false);
    out.h1hidden = visText();
    mouth.setSea('vowel'); mouth.setShowNames(true); mouth.setGrade('m3');
    out.vm3 = visText();
    mouth.setGrade('h1'); out.vh1 = visText();
    mouth.setShowNames(false); out.vhidden = visText();
    mouth.setSea('consonant');
    return out;
  });
  const nf = [];
  if (nr.hidden.length || nr.hiddenAttr !== 'hidden') nf.push('이름 숨김인데 글씨가 보임: ' + nr.hidden.join(','));
  if (/입술|잇몸|천장|목청/.test(nr.hiddenAria)) nf.push('이름 숨김인데 aria-label에 이름: ' + nr.hiddenAria);
  for (const w of ['두 입술', '잇몸', '센입천장', '여린입천장', '목청']) if (!nr.m3.includes(w)) nf.push('중3 이름 없음: ' + w);
  if (nr.m3.some((w) => /음$/.test(w))) nf.push('중3에 한자어 이름: ' + nr.m3.join(','));
  for (const w of ['양순음', '치조음', '경구개음', '연구개음', '후음', '두 입술']) if (!nr.h1.includes(w)) nf.push('고1 이름 없음: ' + w);
  if (nr.outside) nf.push('이름 밖의 글씨가 그림에 있음');
  if (nr.h1hidden.length) nf.push('고1 이름 숨김 실패');
  for (const w of ['앞', '뒤', '높은', '중간', '낮은']) if (!nr.vm3.includes(w)) nf.push('모음 중3 이름 없음: ' + w);
  for (const w of ['전설', '후설', '고모음', '중모음', '저모음']) if (!nr.vh1.includes(w)) nf.push('모음 고1 이름 없음: ' + w);
  if (nr.vhidden.length) nf.push('모음 이름 숨김 실패');
  // 눌러서 고르기(실제 클릭)
  for (const id of ['bilabial', 'alveolar', 'palatal', 'velar', 'glottal']) await na.locator('.mouth-hit[data-id="' + id + '"]').click();
  const pk = await na.evaluate(() => ({ picks: window.picks.slice(), place: document.querySelector('.mouth-svg').dataset.place,
    sel: [...document.querySelectorAll('.mouth-spot.is-selected')].map((s) => s.dataset.id) }));
  if (pk.picks.join() !== 'bilabial,alveolar,palatal,velar,glottal') nf.push('누른 자리 기록 이상: ' + pk.picks.join());
  if (pk.place !== 'glottal' || pk.sel.join() !== 'glottal') nf.push('고른 자리 표시 이상: ' + JSON.stringify(pk));
  // 미리 보기(막음 표시·콧길 문)
  const pv = await na.evaluate(() => {
    const svg = document.querySelector('.mouth-svg'), r = {};
    mouth.select('velar'); r.pending = svg.querySelector('.mouth-closure').dataset.shape;
    mouth.setManner('nasal'); r.nasal = [svg.dataset.closure, svg.dataset.nasal, svg.querySelector('.mouth-closure').dataset.shape];
    mouth.setManner('stop'); mouth.setStrength('tense'); r.tense = [svg.dataset.nasal, svg.dataset.glottis];
    mouth.setManner(null); mouth.setStrength(null); mouth.select(null); r.clear = [svg.dataset.closure, svg.querySelector('.mouth-closure').children.length];
    return r;
  });
  if (pv.pending !== 'pending') nf.push('자리만 고른 막음 표시 이상: ' + pv.pending);
  if (pv.nasal.join() !== 'full,open,full') nf.push('비음 미리 보기 이상: ' + pv.nasal.join());
  if (pv.tense.join() !== 'closed,tight') nf.push('된소리 미리 보기 이상: ' + pv.tense.join());
  if (pv.clear.join() !== ',0') nf.push('지우기 이상: ' + pv.clear.join());
  // 움직임 줄이기: 정지 그림, 곧바로 끝남
  const rm = await na.evaluate(async () => {
    document.documentElement.classList.add('reduce-motion');
    const svg = document.querySelector('.mouth-svg'), t0 = performance.now();
    await mouth.play({ place: 'palatal', manner: 'affricate', strength: 'aspirated' });
    const r = { ms: performance.now() - t0, st: svg.dataset.static, shape: svg.querySelector('.mouth-closure').dataset.shape,
      vis: [...svg.querySelectorAll('.mouth-particle')].filter((c) => c.style.display !== 'none').length };
    document.documentElement.classList.remove('reduce-motion');
    r.errs = window.__soriErrors.slice();
    return r;
  });
  if (!(rm.ms < 300) || rm.st !== '1' || !(rm.vis > 0) || rm.shape !== 'gap') nf.push('움직임 줄이기 이상: ' + JSON.stringify(rm));
  if (rm.errs.length) nf.push('페이지 오류: ' + rm.errs.join(' | '));
  if (nf.length) console.log('FAIL ' + nf.join('\\nFAIL ')); else console.log('PASS');
} finally { await closeTab(na); }
}`);

step('크기별: 휴대폰 세로 360px(48px 이상·겹침 없음)·칠판 1920×1080(64px 이상)', `{
const sizes = [[360, 640, 'tests/pages/mouth.html', 48], [360, 640, 'tests/pages/mouth.html?sea=vowel', 48],
  [360, 780, 'tests/pages/mouth.html?grade=h1&sea=vowel', 48], [360, 780, 'tests/pages/mouth.html?grade=h1', 48],
  [1920, 1080, 'tests/pages/mouth.html', 64], [1280, 720, 'tests/pages/mouth.html?sea=vowel', 64]];
const sf = [];
for (const [w, h, src, min] of sizes) {
  const fu = ${JSON.stringify(url('tests/pages/frame.html'))} + '?w=' + w + '&h=' + h + '&src=' + encodeURIComponent(src);
  const ft = await openTab(fu);
  try {
    const fr = await ft.evaluate(async () => {
      await window.frameReady;
      await new Promise((r) => setTimeout(r, 300));
      const W = window.frameWin(), d = W.document;
      const svg = d.querySelector('.mouth-svg'), sr = svg.getBoundingClientRect();
      const rs = [...d.querySelectorAll('.mouth-hit')].map((c) => { const b = c.getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height, round: c.tagName === 'circle' }; });
      // 겹침: 동그라미는 가운데 거리 < 반지름 합, 네모는 겹친 넓이가 있음(0.5px 여유)
      let overlaps = 0;
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i], b = rs[j];
        if (a.round && b.round) { if (Math.hypot(a.l + a.w / 2 - b.l - b.w / 2, a.t + a.h / 2 - b.t - b.h / 2) < a.w / 2 + b.w / 2 - 0.5) overlaps++; }
        else {
          const ox = Math.min(a.l + a.w, b.l + b.w) - Math.max(a.l, b.l), oy = Math.min(a.t + a.h, b.t + b.h) - Math.max(a.t, b.t);
          if (ox > 0.5 && oy > 0.5) overlaps++;
        }
      }
      return { hits: rs.map((b) => Math.min(b.w, b.h)), overlaps,
        svgW: sr.width, svgH: sr.height, scrollW: d.documentElement.scrollWidth, innerW: W.innerWidth,
        touch: W.getComputedStyle(d.documentElement).getPropertyValue('--touch').trim(), errs: W.__soriErrors.slice() };
    });
    const tag = w + 'x' + h + ' ' + src;
    console.log(tag + ' 누르는 곳 ' + fr.hits.map((x) => Math.round(x)).join(',') + 'px, 그림 ' + Math.round(fr.svgW) + 'x' + Math.round(fr.svgH) + ', --touch ' + fr.touch);
    if (fr.hits.length < (src.includes('vowel') ? 6 : 5) || fr.hits.some((x) => x < min)) sf.push(tag + ' 누르는 곳이 ' + min + 'px보다 작음');
    if (min === 48 && fr.overlaps) sf.push(tag + ' 누르는 곳이 ' + fr.overlaps + '쌍 겹침');
    if (fr.scrollW > fr.innerW) sf.push(tag + ' 가로로 넘침');
    if (fr.svgW < 100) sf.push(tag + ' 그림이 너무 작음');
    if (fr.errs.length) sf.push(tag + ' 페이지 오류: ' + fr.errs.join(' | '));
  } finally { await closeTab(ft); }
}
if (sf.length) console.log('FAIL ' + sf.join('\\nFAIL ')); else console.log('PASS');
}`);

// 캡처. aside의 성질: frame.html(iframe) 안은 캡처하지 못하고, 한 번의 호출에서 두 번째로 연 탭도 캡처가 멈춘다.
// 그래서 세로 캡처는 점검 페이지의 고정 크기 상자(&w=360&h=640)로, 한 호출에 한 장씩 찍는다.
function shotStep(label, name, pageUrl, combo, clip) {
  step(label, `{
await fs.mkdir('./artifacts', { recursive: true });
const ct = await openTab(${JSON.stringify(pageUrl)});
try {
  const cr = await ct.evaluate(async (c) => {
    document.documentElement.classList.add('reduce-motion'); // 정지 그림으로 캡처
    await mouth.play(c);
    return window.__soriErrors.slice();
  }, ${JSON.stringify(combo)});
  await fs.writeFile('./artifacts/${name}.png', await ct.screenshot(${clip ? JSON.stringify({ clip }) : ''}));
  console.log('SHOTFILE:' + path.resolve('./artifacts/${name}.png'));
  if (cr.length) console.log('FAIL 페이지 오류: ' + cr.join(' | ')); else console.log('PASS');
} finally { await closeTab(ct); }
}`);
}
shotStep('캡처: 가로(칠판, 고1, 여린입천장 거센 파열)', 'mouth-landscape', PAGE + '?grade=h1', { place: 'velar', manner: 'stop', strength: 'aspirated' });
shotStep('캡처: 휴대폰 세로(잇몸 비음)', 'mouth-portrait', PAGE + '?w=360&h=640', { place: 'alveolar', manner: 'nasal', strength: 'none' }, { x: 0, y: 0, width: 360, height: 640 });
shotStep('캡처: 휴대폰 세로 모음(뒤·높은·둥글게)', 'mouth-portrait-vowel', PAGE + '?w=360&h=640&sea=vowel', { tongue: 'back-high', lips: 'rounded' }, { x: 0, y: 0, width: 360, height: 640 });
