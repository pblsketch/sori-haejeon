// 입안 단면도(G.mouth) 점검(aside). 점검용 페이지 tests/pages/mouth.html에서 단면도만 띄운다.
//  1~3) 자음 5자리 × 5방법 × 쓸 수 있는 세기(+ 목청·마찰·세기 없음), 모음 6자리 × 입술 2가지를 모두 재생:
//       페이지 오류 없음, 1.5초 안에 끝남, 입자가 실제로 그려짐,
//       막음 표시(규칙·그려진 모양)·콧길 문·목청 조임·입자 수가 spec 5.2 표와 같음
//  4) 자리 이름 보이기/숨기기, 학년별 이름, 그림 안 글씨는 이름뿐, 눌러서 고르기, 움직임 줄이기(정지 그림)
//  5) 크기별(frame.html): 휴대폰 세로 360px 너비에서 누르는 곳이 48px 이상, 칠판 1920×1080에서 64px 이상
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
      vis: [...svg.querySelectorAll('.mouth-particle')].filter((c) => c.style.display !== 'none').length };
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
    await wait(420); const mid = snap();
    await pr; const ms = performance.now() - t0; const end = snap();
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

step('크기별: 휴대폰 세로 360px(48px 이상)·칠판 1920×1080(64px 이상)', `{
const sizes = [[360, 640, 'tests/pages/mouth.html', 48], [360, 640, 'tests/pages/mouth.html?sea=vowel', 48],
  [360, 780, 'tests/pages/mouth.html?grade=h1', 48], [1920, 1080, 'tests/pages/mouth.html', 64], [1280, 720, 'tests/pages/mouth.html?sea=vowel', 64]];
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
      return { hits: [...d.querySelectorAll('.mouth-hit')].map((c) => { const b = c.getBoundingClientRect(); return Math.min(b.width, b.height); }),
        svgW: sr.width, svgH: sr.height, scrollW: d.documentElement.scrollWidth, innerW: W.innerWidth,
        touch: W.getComputedStyle(d.documentElement).getPropertyValue('--touch').trim(), errs: W.__soriErrors.slice() };
    });
    const tag = w + 'x' + h + ' ' + src;
    console.log(tag + ' 누르는 곳 ' + fr.hits.map((x) => Math.round(x)).join(',') + 'px, 그림 ' + Math.round(fr.svgW) + 'x' + Math.round(fr.svgH) + ', --touch ' + fr.touch);
    if (fr.hits.length < 5 || fr.hits.some((x) => x < min)) sf.push(tag + ' 누르는 곳이 ' + min + 'px보다 작음');
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
