// 조작부와 신호 기록장(js/game/controls.js) 점검(aside). 점검용 페이지 tests/pages/controls.html을
// 크기별 틀(tests/pages/frame.html)에 넣어 가로 1920×1080 · 휴대폰 세로 390×844로 띄운다.
//  1) 가로: 자음 1~3단계 · 모음 1~2단계의 카드 구성, 모든 조합에서 세기 카드 흐림과 발사 단추가 G.rules.controls와 같은지,
//     비음·유음·목청+마찰에서 세기 카드가 흐려지는지, 없는 조합도 막지 않고 onFire가 불리는지,
//     '따라 해 보기'가 켜진 단계에서만 · 있는 소리에만 뜨는지, 대결 기본 줄, 문구가 언제나 한 줄인지,
//     잠금(setEnabled · 발사 뒤), 신호 기록장, 한 줄 배치(가운데 아래), 터치 목표 64px 이상, 페이지 오류 0
//  2) 세로: 두 줄 배치(방법 / 세기·입술 + 발사), 터치 목표 48px 이상, 가로 넘침 없음,
//     '따라 해 보기' 29줄이 모두 한 줄에 말줄임 없이 들어가는지, 기록장이 접혀 있다가 단추로 펼쳐지는지, 페이지 오류 0
//  캡처: tests/shots/controls-landscape.png, controls-portrait.png, controls-portrait-log.png
import { step, frame } from './aside.mjs';

const PAGE = 'tests/pages/controls.html';
const LAND = frame(1920, 1080, PAGE);
const PORT = frame(390, 844, PAGE);

// 틀 안 페이지에서 쓰는 도우미(evaluate 함수 안에 그대로 붙여 넣는다)
const HELP = `
const fw = frameWin(), fd = fw.document, G = fw.G, TX = fw.TEXT;
const errs = [];
const bad = (m) => errs.push(m);
const $ = (s) => fd.querySelector(s);
const $$ = (s) => Array.from(fd.querySelectorAll(s));
const cards = (g) => $$('.ctl-card[data-group="' + g + '"]');
const card = (g, id) => $('.ctl-card[data-group="' + g + '"][data-id="' + id + '"]');
const fireBtn = () => $('.ctl-fire');
const msgEl = () => $('.ctl-msg');
const msgText = () => $('.ctl-msg-text').textContent;
const msgKind = () => msgEl().getAttribute('data-kind');
// 문구 자리의 줄 수: 글 마디의 줄 상자 윗변을 모아 센다
const msgLines = () => {
  const t = $('.ctl-msg-text');
  if (!t.firstChild) return 0;
  const r = fd.createRange(); r.selectNodeContents(t);
  const tops = [];
  Array.from(r.getClientRects()).filter((x) => x.width > 0).forEach((x) => { if (!tops.some((y) => Math.abs(y - x.top) < 4)) tops.push(x.top); });
  const m = msgEl();
  return tops.length + (m.scrollHeight > m.clientHeight + 2 ? 10 : 0);
};
const overflowing = () => { const m = msgEl(); return m.scrollWidth > m.clientWidth + 1; };
const box = (n) => n.getBoundingClientRect();
// 터치 목표: 크기와, 가운데 점을 눌렀을 때 그 단추가 맞는지
const touchOk = (n, min) => {
  const b = box(n);
  const hit = fd.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
  return b.width >= min - 0.5 && b.height >= min - 0.5 && hit && (hit === n || n.contains(hit));
};
`;

step('가로 1920×1080: 카드 구성·세기 흐림·발사·없는 조합·따라 해 보기·한 줄·기록장·배치', `
const tl = await openTab(${JSON.stringify(LAND)});
try {
  await tl.evaluate(() => window.frameReady);
  await sleep(500);
  const r1 = await tl.evaluate(() => {
    ${HELP}
    const S = fw.SOUNDS;
    const R = G.rules;
    const strengthless = (p, m) => m === 'nasal' || m === 'liquid' || (p === 'glottal' && m === 'fricative'); // spec 5.1 (점검 쪽 기대값)
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const info = { fired: {}, follow: {}, layout: {} };
    try {
      if (G.controls.create && fw.ctl.layout() !== 'landscape') bad('1920×1080에서 자동 배치가 가로가 아님: ' + fw.ctl.layout());
      const API = ['setPlace', 'reset', 'setMessage', 'showFollow', 'setEnabled', 'log', 'setLog', 'clearLog', 'setLayout', 'getSelection', 'getState', 'setSelection', 'fire', 'destroy'];
      const miss = API.filter((k) => typeof fw.ctl[k] !== 'function');
      if (miss.length) bad('없는 함수: ' + miss.join(','));

      // ── 자음 1~3단계 ──
      for (const n of [1, 2, 3]) {
        for (const grade of ['m3', 'h1']) {
          const c = fw.mount({ sea: 'consonant', level: n, grade });
          const lv = R.level('consonant', n);
          const tag = '자음 ' + n + '단계 ' + grade;
          // 카드 구성
          const mc = cards('manner'), sc = cards('strength');
          if (mc.length !== 5) bad(tag + ': 방법 카드 ' + mc.length + '장');
          if (sc.length !== (n === 1 ? 0 : 3)) bad(tag + ': 세기 카드 ' + sc.length + '장');
          if (cards('lips').length) bad(tag + ': 입술 카드가 있음');
          if (!same(mc.map((b) => b.textContent), S.manners.map((m) => G.text.short(grade, 'manner', m)))) bad(tag + ': 방법 카드 이름 ' + mc.map((b) => b.textContent));
          if (!same(sc.map((b) => b.textContent), n === 1 ? [] : S.strengths.map((s) => G.text.short(grade, 'strength', s)))) bad(tag + ': 세기 카드 이름 ' + sc.map((b) => b.textContent));
          if (!fireBtn().disabled) bad(tag + ': 아무것도 안 골랐는데 발사가 켜짐');
          if (grade === 'h1') continue; // 조합 점검은 학년과 상관없으므로 한 번만
          if (msgText() !== TX.prompt.place) bad(tag + ': 처음 문구가 자리 안내가 아님: ' + msgText());
          // 방법만 고르고 자리를 안 고르면 발사 꺼짐
          card('manner', 'stop').click();
          if (!fireBtn().disabled) bad(tag + ': 자리 없이 발사가 켜짐');
          c.reset();
          // 모든 자리 × 방법 × 세기
          let fires = 0;
          for (const p of S.places) for (const m of S.manners) {
            const strs = n === 1 || strengthless(p, m) ? [null] : S.strengths;
            for (const s of strs) {
              c.reset();
              c.setPlace(p);
              if (!fireBtn().disabled) bad(tag + ' ' + p + ': 자리만 골랐는데 발사가 켜짐');
              card('manner', m).click();
              const want = R.controls(lv, { place: p, manner: m });
              const dimNow = sc.length ? sc.every((b) => b.disabled && b.classList.contains('is-dim')) : true;
              if (n > 1) {
                if (want.strengthDisabled !== strengthless(p, m)) bad(tag + ' ' + p + '+' + m + ': 규칙 엔진과 spec의 세기 흐림이 다름');
                if (dimNow !== want.strengthDisabled) bad(tag + ' ' + p + '+' + m + ': 세기 카드 흐림 ' + dimNow + ' ≠ ' + want.strengthDisabled);
                if (!want.strengthDisabled && sc.some((b) => b.disabled)) bad(tag + ' ' + p + '+' + m + ': 세기 카드가 눌리지 않음');
              }
              if (fireBtn().disabled === want.fireEnabled) bad(tag + ' ' + p + '+' + m + ': 발사 단추 ' + !fireBtn().disabled + ' ≠ ' + want.fireEnabled);
              if (s) {
                if (!fireBtn().disabled) bad(tag + ' ' + p + '+' + m + ': 세기를 안 골랐는데 발사가 켜짐');
                card('strength', s).click();
                const w2 = R.controls(lv, { place: p, manner: m, strength: s });
                if (!w2.fireEnabled || fireBtn().disabled) bad(tag + ' ' + p + '+' + m + '+' + s + ': 세기를 골랐는데 발사가 꺼짐');
                if (card('strength', s).getAttribute('aria-pressed') !== 'true') bad(tag + ': 고른 세기 카드 표시 없음');
              }
              if (msgLines() !== 1) bad(tag + ' ' + p + '+' + m + ': 문구가 한 줄이 아님(' + msgLines() + ')');
              // 따라 해 보기
              const snd = R.compose(lv, { place: p, manner: m, strength: s }).sound;
              const followOn = !!(lv.help && lv.help.followAlong);
              if (followOn && snd) {
                if (msgKind() !== 'follow' || msgText() !== G.text.follow(snd)) bad(tag + ' /' + snd + '/: 따라 해 보기가 안 뜸: ' + msgText());
                else info.follow[snd] = true;
              } else {
                if (msgKind() === 'follow') bad(tag + ' ' + p + '+' + m + ': 따라 해 보기가 뜨면 안 되는데 뜸');
                if (msgText() !== TX.prompt.ready) bad(tag + ' ' + p + '+' + m + ': 발사 준비 안내가 아님: ' + msgText());
              }
              // 발사 → onFire
              const before = fw.__fired.length;
              fireBtn().click();
              fireBtn().click(); // 두 번 눌러도 한 발
              if (fw.__fired.length !== before + 1) bad(tag + ' ' + p + '+' + m + '+' + s + ': onFire 횟수 ' + (fw.__fired.length - before));
              const got = fw.__fired[fw.__fired.length - 1];
              const exp = { place: p, manner: m, strength: n === 1 || strengthless(p, m) ? null : s };
              if (!same(got, exp)) bad(tag + ': onFire 값 ' + JSON.stringify(got) + ' ≠ ' + JSON.stringify(exp));
              if (!snd) info.fired[n + ':' + p + '+' + m + '+' + s] = true;
              // 발사 뒤 잠김
              if (!mc.every((b) => b.disabled)) bad(tag + ': 발사 뒤 카드가 잠기지 않음');
              fires++;
            }
          }
          if (n > 1 && fires !== 14 * 3 + 11) bad(tag + ': 조합 수 ' + fires);
          if (n === 1 && fires !== 25) bad(tag + ': 조합 수 ' + fires);
          // 세기를 고른 뒤 비음으로 바꾸면 세기 흐림 → 발사 켜짐, onFire의 세기는 null
          if (n > 1) {
            c.reset(); c.setPlace('bilabial'); card('manner', 'stop').click(); card('strength', 'tense').click(); card('manner', 'nasal').click();
            if (fireBtn().disabled) bad(tag + ': 비음으로 바꿨는데 발사가 꺼짐');
            if (sc.some((b) => b.getAttribute('aria-pressed') === 'true')) bad(tag + ': 흐린 세기 카드가 골라진 채로 보임');
            fireBtn().click();
            if (fw.__fired[fw.__fired.length - 1].strength !== null) bad(tag + ': 비음 발사에 세기가 따라감');
            c.reset(); c.setPlace('glottal'); card('manner', 'fricative').click();
            if (!sc.every((b) => b.disabled) || fireBtn().disabled) bad(tag + ': 목청+마찰에서 세기 흐림/발사 켜짐이 아님');
          }
        }
      }
      // 없는 조합 대표들이 실제로 발사됐는지
      for (const k of ['1:glottal+stop+null', '1:palatal+stop+null', '2:glottal+stop+plain', '2:palatal+stop+tense', '2:alveolar+fricative+aspirated', '3:velar+liquid+null'])
        if (!info.fired[k]) bad('없는 조합이 발사되지 않음: ' + k);
      for (const id of ['ㅂ', 'ㄷ', 'ㄱ', 'ㅈ', 'ㅅ', 'ㅁ', 'ㄴ', 'ㅇ', 'ㄹ']) if (!info.follow[id]) bad('자음 1단계 따라 해 보기 안 봄: /' + id + '/');

      // ── 모음 1~2단계 ──
      for (const n of [1, 2]) {
        for (const grade of ['m3', 'h1']) {
          const c = fw.mount({ sea: 'vowel', level: n, grade });
          const lv = R.level('vowel', n);
          const tag = '모음 ' + n + '단계 ' + grade;
          const lc = cards('lips');
          if (cards('manner').length || cards('strength').length) bad(tag + ': 자음 카드가 있음');
          if (!same(lc.map((b) => b.textContent), S.lips.map((x) => G.text.short(grade, 'lips', x)))) bad(tag + ': 입술 카드 ' + lc.map((b) => b.textContent));
          if (grade === 'h1' && !same(lc.map((b) => b.textContent), ['평순', '원순'])) bad(tag + ': 고1 입술 카드가 평순/원순이 아님');
          if (grade === 'h1') continue;
          if (msgText() !== TX.prompt.tongue) bad(tag + ': 처음 문구가 혀 자리 안내가 아님');
          card('lips', 'rounded').click();
          if (!fireBtn().disabled) bad(tag + ': 혀 자리 없이 발사가 켜짐');
          for (const b of S.backs) for (const h of S.heights) for (const l of S.lips) {
            c.reset();
            c.setPlace(b + '-' + h);
            if (!fireBtn().disabled) bad(tag + ': 입술 없이 발사가 켜짐');
            card('lips', l).click();
            const want = R.controls(lv, { backness: b, height: h, lips: l });
            if (fireBtn().disabled === want.fireEnabled) bad(tag + ': 발사 단추가 규칙과 다름 ' + b + h + l);
            const snd = R.compose(lv, { backness: b, height: h, lips: l }).sound;
            if (lv.help.followAlong && snd) { if (msgKind() !== 'follow' || msgText() !== G.text.follow(snd)) bad(tag + ' /' + snd + '/: 따라 해 보기 안 뜸'); }
            else if (msgKind() === 'follow') bad(tag + ': 따라 해 보기가 뜨면 안 됨 ' + b + h + l);
            if (msgLines() !== 1) bad(tag + ': 문구가 한 줄이 아님');
            const before = fw.__fired.length;
            fireBtn().click();
            if (fw.__fired.length !== before + 1) bad(tag + ': onFire 안 불림 ' + b + h + l);
            if (!same(fw.__fired[fw.__fired.length - 1], { backness: b, height: h, lips: l })) bad(tag + ': onFire 값 이상');
          }
          if (!fw.__fired.some((x) => x.backness === 'front' && x.height === 'low' && x.lips === 'rounded')) bad(tag + ': 앞·낮은·둥근 입술(없는 소리)이 발사되지 않음');
          // 순서가 바뀐 혀 자리 id와 객체도 받는다
          c.reset(); c.setPlace('high-back'); card('lips', 'rounded').click();
          const sv = c.getSelection();
          if (sv.backness !== 'back' || sv.height !== 'high') bad(tag + ': setPlace("high-back")를 못 읽음');
          c.setPlace({ backness: 'front', height: 'mid' });
          if (c.getSelection().backness !== 'front') bad(tag + ': setPlace(객체)를 못 읽음');
        }
      }

      // ── 문구 자리: 신호 줄 · 대결 기본 줄 · 긴 문구 · showFollow ──
      let c = fw.mount({ sea: 'consonant', level: 1 });
      c.setPlace('velar'); card('manner', 'stop').click();
      if (msgText() !== G.text.follow('ㄱ')) bad('자음 1단계 /ㄱ/ 따라 해 보기 안 뜸');
      fireBtn().click();
      c.setMessage(G.text.signal('miss'));
      c.reset();
      if (msgText() !== G.text.signal('miss')) bad('reset() 뒤 신호 줄이 사라짐');
      if (fireBtn().disabled === false) bad('reset() 뒤 발사가 켜져 있음');
      c.setPlace('bilabial');
      if (msgText() === G.text.signal('miss')) bad('다시 고르기 시작했는데 신호 줄이 남음');
      card('manner', 'nasal').click();
      if (msgText() !== G.text.follow('ㅁ')) bad('다시 고른 뒤 따라 해 보기 안 뜸');
      c.setMessage('아주 긴 문구 '.repeat(20));
      if (msgLines() !== 1) bad('긴 문구가 한 줄이 아님');
      c.showFollow('ㅎ');
      if (msgKind() !== 'follow' || msgText() !== G.text.follow('ㅎ')) bad('showFollow가 안 됨');
      c.showFollow(null);
      if (msgKind() === 'follow' && msgText() !== G.text.follow('ㅁ')) bad('showFollow(null) 뒤 기본 줄이 아님');
      // 잠금
      c.reset(); c.setEnabled(false);
      card('manner', 'stop').click();
      if (c.getSelection().manner) bad('setEnabled(false)인데 카드가 눌림');
      if (!$$('.ctl-card, .ctl-fire').every((b) => b.disabled)) bad('setEnabled(false)인데 단추가 켜져 있음');
      c.setEnabled(true); c.setPlace('alveolar'); card('manner', 'liquid').click();
      if (fireBtn().disabled) bad('setEnabled(true) 뒤 발사가 안 켜짐');
      // 대결: 기본 줄 = 외치고 발사, 1단계에서는 따라 해 보기도
      c = fw.mount({ sea: 'consonant', level: 2, mode: 'duel' });
      if (msgText() !== TX.duel.shout) bad('대결 기본 줄이 아님: ' + msgText());
      c.setPlace('velar'); card('manner', 'stop').click();
      if (msgText() !== TX.duel.shout) bad('대결 2단계에서 고르는 중 문구가 바뀜: ' + msgText());
      c = fw.mount({ sea: 'consonant', level: 1, mode: 'duel' });
      c.setPlace('velar'); card('manner', 'nasal').click();
      if (msgText() !== G.text.follow('ㅇ')) bad('대결 1단계에서 따라 해 보기가 안 뜸');
      c.setPlace('glottal'); card('manner', 'stop').click();
      if (msgText() !== TX.duel.shout) bad('대결 1단계 없는 조합에서 중립 줄이 아님: ' + msgText());
      // 없는 조합에서 '없다'는 암시가 없는지(연습)
      c = fw.mount({ sea: 'consonant', level: 1 });
      c.setPlace('palatal'); card('manner', 'stop').click();
      if (/없/.test(msgText())) bad('없는 조합에서 없다는 암시: ' + msgText());

      // ── 신호 기록장 ──
      c = fw.mount({ sea: 'consonant', level: 2 });
      c.log({ sound: 'ㄱ', input: { place: 'velar', manner: 'stop', strength: 'plain' }, kind: 'line' });
      c.log({ sound: null, input: { place: 'glottal', manner: 'stop', strength: 'tense' }, kind: 'none' });
      c.log({ sound: 'ㄲ', input: { place: 'velar', manner: 'stop', strength: 'tense' }, kind: 'hit' });
      const items = $$('.ctl-log-item');
      if (items.length !== 3) bad('기록장 줄 수 ' + items.length);
      else {
        if (!/\\/ㄱ\\//.test(items[0].textContent) || !items[0].textContent.includes('같은 줄')) bad('기록장 1줄: ' + items[0].textContent);
        if (/\\//.test(items[1].textContent) || !items[1].textContent.includes('목청') || !items[1].textContent.includes('없는 소리')) bad('기록장 없는 소리 줄: ' + items[1].textContent);
        if (!items[2].textContent.includes('/ㄲ/') || !items[2].textContent.includes('명중')) bad('기록장 3줄: ' + items[2].textContent);
      }
      const logp = $('.ctl-log');
      if (!logp || logp.getBoundingClientRect().height < 10 || fw.getComputedStyle(logp).display === 'none') bad('가로에서 기록장이 안 보임');
      if (fw.getComputedStyle($('.ctl-logtoggle')).display !== 'none') bad('가로에서 기록장 단추가 보임');
      c.setLog([{ sound: 'ㅎ', kind: 'miss', team: 'blue' }]);
      if ($$('.ctl-log-item').length !== 1 || !$('.ctl-log-item').textContent.includes('청팀')) bad('setLog/팀 표시 이상');
      c.clearLog();
      if ($$('.ctl-log-item').length) bad('clearLog 이상');
      // 기록장을 옆 칸에(logContainer)
      c = fw.mount({ sea: 'consonant', level: 2, logbox: true });
      if (!fd.getElementById('logbox').contains(c.logEl)) bad('logContainer에 기록장이 안 들어감');

      // ── 가로 배치: 한 줄, 아래 가운데, 64px 이상 ──
      for (const cfg of [{ sea: 'consonant', level: 1 }, { sea: 'consonant', level: 2 }, { sea: 'vowel', level: 1 }]) {
        c = fw.mount(cfg);
        const tag = '가로 ' + cfg.sea + cfg.level;
        const btns = $$('.ctl-card').concat([fireBtn()]);
        const tops = btns.map((b) => Math.round(box(b).top));
        if (Math.max(...tops) - Math.min(...tops) > 2) bad(tag + ': 한 줄이 아님 ' + tops);
        const L = Math.min(...btns.map((b) => box(b).left)), Rr = Math.max(...btns.map((b) => box(b).right));
        const mid = (L + Rr) / 2, W = fw.innerWidth, H = fw.innerHeight;
        if (Math.abs(mid - W / 2) > 12) bad(tag + ': 가운데가 아님(' + mid + ' / ' + W / 2 + ')');
        if (H - Math.max(...btns.map((b) => box(b).bottom)) > 40) bad(tag + ': 화면 아래가 아님');
        btns.forEach((b) => { if (!touchOk(b, 64)) bad(tag + ': 64px 미만이거나 가려짐: ' + b.textContent + ' ' + JSON.stringify(box(b))); });
        info.layout[tag] = { tops: tops[0], left: L, right: Rr };
      }
      // 캡처용 상태: 자음 2단계, 기록 몇 줄, 고르는 중
      c = fw.mount({ sea: 'consonant', level: 2 });
      c.log({ sound: 'ㄱ', kind: 'line' }); c.log({ sound: null, input: { place: 'glottal', manner: 'stop', strength: 'plain' }, kind: 'none' }); c.log({ sound: 'ㄲ', kind: 'hit' });
      c.setPlace('bilabial'); card('manner', 'stop').click(); card('strength', 'aspirated').click();
    } catch (e) { bad('예외: ' + (e && e.stack || e)); }
    return { errs, pageErrs: fw.__soriErrors.slice(), info };
  });
  await sleep(400);
  await fs.mkdir('./artifacts', { recursive: true });
  await fs.writeFile('./artifacts/controls-landscape.png', await tl.screenshot());
  console.log('SHOTFILE:' + path.resolve('./artifacts/controls-landscape.png'));
  console.log(JSON.stringify(r1.info.layout));
  if (r1.pageErrs.length) console.log('FAIL 페이지 오류: ' + r1.pageErrs.join(' | '));
  if (r1.errs.length) console.log('FAIL ' + r1.errs.slice(0, 30).join('\\nFAIL '));
  else if (!r1.pageErrs.length) console.log('PASS');
} finally { await closeTab(tl); }
`);

step('휴대폰 세로 390×844: 두 줄 배치·48px·따라 해 보기 한 줄·기록장 접기', `
const tp = await openTab(${JSON.stringify(PORT)});
try {
  await tp.evaluate(() => window.frameReady);
  await sleep(500);
  const r2 = await tp.evaluate(() => {
    ${HELP}
    const info = { rows: {}, shrink: {} };
    try {
      if (fw.ctl.layout() !== 'portrait') bad('390×844에서 자동 배치가 세로가 아님: ' + fw.ctl.layout());
      const W = fw.innerWidth;
      for (const cfg of [{ sea: 'consonant', level: 1 }, { sea: 'consonant', level: 2 }, { sea: 'consonant', level: 3, grade: 'h1' }, { sea: 'vowel', level: 1 }, { sea: 'vowel', level: 2, grade: 'h1' }]) {
        const c = fw.mount(cfg);
        const tag = '세로 ' + cfg.sea + cfg.level;
        if (!c.el.classList.contains('ctl--portrait')) bad(tag + ': 세로 배치 표시가 없음');
        const man = $$('.ctl-card[data-group="manner"]');
        const second = $$('.ctl-card[data-group="strength"], .ctl-card[data-group="lips"]').concat([fireBtn(), $('.ctl-logtoggle')]);
        const t1 = man.map((b) => Math.round(box(b).top)), t2 = second.map((b) => Math.round(box(b).top));
        if (t1.length && Math.max(...t1) - Math.min(...t1) > 2) bad(tag + ': 방법 카드가 한 줄이 아님 ' + t1);
        if (Math.max(...t2) - Math.min(...t2) > 2) bad(tag + ': 세기·입술 + 발사 줄이 한 줄이 아님 ' + t2);
        if (t1.length && !(Math.min(...t2) >= Math.max(...man.map((b) => box(b).bottom)) - 1)) bad(tag + ': 둘째 줄이 첫 줄 아래가 아님');
        man.concat(second).forEach((b) => {
          if (!touchOk(b, 48)) bad(tag + ': 48px 미만이거나 가려짐: ' + b.textContent + ' ' + JSON.stringify(box(b)));
          if (box(b).right > W + 0.5 || box(b).left < -0.5) bad(tag + ': 화면 밖: ' + b.textContent);
        });
        if (fd.documentElement.scrollWidth > W) bad(tag + ': 가로 넘침 ' + fd.documentElement.scrollWidth);
        // 카드 이름은 늘 보인다(잘리지 않음)
        $$('.ctl-card').forEach((b) => { if (b.scrollWidth > b.clientWidth + 1) bad(tag + ': 카드 이름이 잘림: ' + b.textContent); });
        info.rows[tag] = { row1: t1[0], row2: t2[0] };
      }
      // '따라 해 보기' 29줄: 세로에서도 한 줄, 말줄임 없이
      const ids = ['ㅂ','ㅃ','ㅍ','ㄷ','ㄸ','ㅌ','ㄱ','ㄲ','ㅋ','ㅈ','ㅉ','ㅊ','ㅅ','ㅆ','ㅎ','ㅁ','ㄴ','ㅇ','ㄹ','ㅣ','ㅟ','ㅡ','ㅜ','ㅔ','ㅚ','ㅓ','ㅗ','ㅐ','ㅏ'];
      let c = fw.mount({ sea: 'consonant', level: 1 });
      for (const id of ids) {
        c.showFollow(id);
        if (msgKind() !== 'follow') bad('세로 따라 해 보기 안 뜸 /' + id + '/');
        if (msgLines() !== 1) bad('세로 따라 해 보기가 한 줄이 아님 /' + id + '/');
        if (overflowing()) bad('세로 따라 해 보기가 잘림 /' + id + '/ (' + fw.getComputedStyle(msgEl()).fontSize + ')');
        info.shrink[id] = fw.getComputedStyle(msgEl()).fontSize;
      }
      c.showFollow(null);
      // 기록장: 접혀 있다가 단추로 펼치고 접기
      c = fw.mount({ sea: 'consonant', level: 2 });
      c.log({ sound: 'ㄱ', kind: 'line' });
      c.log({ sound: null, input: { place: 'palatal', manner: 'stop', strength: 'plain' }, kind: 'none' });
      c.log({ sound: 'ㅋ', kind: 'hit' });
      const lp = c.logEl, tg = $('.ctl-logtoggle');
      if (fw.getComputedStyle(lp).display !== 'none') bad('세로에서 기록장이 처음부터 펼쳐져 있음');
      if (!tg.textContent.includes('3')) bad('기록장 단추에 기록 수가 없음: ' + tg.textContent);
      tg.click();
      if (fw.getComputedStyle(lp).display === 'none' || $$('.ctl-log-item').length !== 3) bad('단추를 눌러도 기록장이 안 펼쳐짐');
      const lb = box(lp);
      if (lb.top < 0 || lb.bottom > fw.innerHeight + 1) bad('펼친 기록장이 화면 밖: ' + JSON.stringify(lb));
      if (!touchOk($('.ctl-log-close'), 48)) bad('접기 단추 48px 미만');
      info.logOpen = true;
    } catch (e) { bad('예외: ' + (e && e.stack || e)); }
    return { errs, pageErrs: fw.__soriErrors.slice(), info };
  });
  await sleep(400);
  await fs.mkdir('./artifacts', { recursive: true });
  await fs.writeFile('./artifacts/controls-portrait-log.png', await tp.screenshot());
  console.log('SHOTFILE:' + path.resolve('./artifacts/controls-portrait-log.png'));
  await tp.evaluate(() => {
    const fw = frameWin(), c = fw.mount({ sea: 'consonant', level: 1 });
    c.log({ sound: 'ㅅ', kind: 'line' });
    c.setPlace('velar'); fw.document.querySelector('.ctl-card[data-id="stop"]').click();
  });
  await sleep(400);
  await fs.writeFile('./artifacts/controls-portrait.png', await tp.screenshot());
  console.log('SHOTFILE:' + path.resolve('./artifacts/controls-portrait.png'));
  console.log(JSON.stringify(r2.info));
  if (r2.pageErrs.length) console.log('FAIL 페이지 오류: ' + r2.pageErrs.join(' | '));
  if (r2.errs.length) console.log('FAIL ' + r2.errs.slice(0, 30).join('\\nFAIL '));
  else if (!r2.pageErrs.length) console.log('PASS');
} finally { await closeTab(tp); }
`);
