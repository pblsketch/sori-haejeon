// 바다(판) 그리기 G.board 점검(aside). 점검용 페이지 tests/pages/board.html에서 판만 불러 본다.
//   1) 단계별로 숨길 것(칸 안 소리·빈칸 구분·세기 자리·줄 이름)이 화면 문자열·DOM 속성·aria에 드러나지 않는지
//   2) 여러 신호가 쌓인 판: 한 칸에 표시 여러 개(명중이 가장 크게), '같은 줄' 강조가 알맞은 칸·줄로(둘 다 포함),
//      물결은 한 번 퍼지고 사라짐(움직임 줄이기면 물결 없음), 격침 선, 남은 배 목록, 끝날 때 공개
//   3) 숨기기(배치) 화면: 단계와 상관없이 소리·줄 이름이 보이고, 놓을 수 있는 묶음의 칸만 누를 수 있음
//   4) 크기별: 휴대폰 세로 360×740에서 칸 48px 이상·가로 스크롤 없음·소리 표기 글씨 크기 ≥ 칸(자리) 높이 60%,
//      칠판 1920×1080에서 칸 64px 이상. 캡처를 tests/shots/에 남긴다.
//   5) 신호 표시(T17 디자인 개편 — 선생님 결정: 불꽃 없이 황금 채움 + 과녁): 명중 = 황금 표지 + 과녁 배지(불꽃 요소 없음),
//      0.2초 안팎의 강조 한 번, 빗나감 ×, 없는 소리 ∅, 같은 줄 범위에 ↔/↕/겹친 네모 기호, 최근 발만 .is-latest,
//      격침된 배의 불탄 그림(위에서 본 배), 배 그림 크기(세 칸 > 두 칸 > 한 칸), 되살리기·움직임 줄이기에서는 강조 없음
//   6) 크기별 판: 소리 표기 글씨가 한 판 안에서 모두 같은 크기, 모든 소리 표기(맞히지 않은 소리 포함)의 명암비 4.5 이상,
//      휴대폰 1단계 판은 소리 28px·축 이름 16px·배지 20px 이상
//   7) 섬과 암초 바다 지도(T20 — spec 3.3, 선생님 결정 시안 C): 판 밑 바다 지도는 칸 밖의 한 장, 숨긴 단계는 쏘기 전 모든 칸이
//      같고 암초·자물쇠·배 조각이 없음, 가라앉기 전 명중은 어느 배든 같은 조각(top_hit), 격침은 배 종류별 제 모양(불탄 그림),
//      암초는 빈칸 불발 뒤에만, 떨어진 두 칸 배는 점선 끌줄 + 두 조각·남은 배 목록에 같은 번호, 모든 소리 표지 명암비 4.5 이상
//   (T20에서 바꾼 기준: 명중 황금은 칸 바탕이 아니라 '소리 표지'에, 한 칸 안에서 가라앉은 배는 선 대신 세운 한 척,
//    쏘는 바다의 소리 글씨는 자리 높이의 45% 이상 — 자리 아래쪽이 배 조각이 드러나는 물이라서. 판 밑 그림은 코드로 그린
//    바다 지도 한 장만 허용(.webp 질감은 여전히 깔지 않음).)
//   모든 단계에서 window.__soriErrors가 비어 있어야 한다.
import { step, url, frame } from './aside.mjs';

const PAGE = url('tests/pages/board.html');

step('단계별 숨김 정보가 DOM·문자열·aria에 없음', `
const t1 = await openTab(${JSON.stringify(PAGE)});
try {
  const r1 = await t1.evaluate(() => {
    const fails = []; const F = (m) => fails.push(m);
    const JAMO = /[\\u3131-\\u3163]/;
    const S = window.SOUNDS;
    const cases = [['consonant', 1], ['consonant', 2], ['consonant', 3], ['vowel', 1], ['vowel', 2]];
    // 두 학년의 모든 줄·열 이름(짧은 이름·긴 이름)
    const names = new Set();
    for (const g of ['m3', 'h1']) for (const grp of ['place', 'manner', 'height', 'column']) {
      for (const k of Object.keys(TEXT.shortTerms[g][grp])) names.add(TEXT.shortTerms[g][grp][k]);
      for (const k of Object.keys(TEXT.terms[g][grp])) names.add(TEXT.terms[g][grp][k]);
    }
    for (const grade of ['m3', 'h1']) for (const [sea, n] of cases) {
      const tag = sea + n + '/' + grade + ': ';
      const host = document.createElement('div'); host.style.width = '900px'; document.body.appendChild(host);
      const lv = G.rules.level(sea, n);
      const b = G.board.create(host, { sea, level: n, grade, mode: 'play' });
      b.render({ shots: [] });
      const root = b.el, html = root.outerHTML;
      const R = sea === 'vowel' ? 3 : 5, C = sea === 'vowel' ? 4 : 5;
      const rows = sea === 'vowel' ? S.heights : S.manners, cols = sea === 'vowel' ? S.columns : S.places;
      const rg = sea === 'vowel' ? 'height' : 'manner', cg = sea === 'vowel' ? 'column' : 'place';
      const cells = [...root.querySelectorAll('.sb-cell')];
      const cell = (r, c) => root.querySelector('.sb-cell[data-r="' + r + '"][data-c="' + c + '"]');
      if (cells.length !== R * C) F(tag + '칸 수 ' + cells.length);
      const attrs = [root, ...root.querySelectorAll('*')].flatMap((e) => [...e.attributes].map((a) => a.name + '=' + a.value));
      if (!lv.show.cellSounds) {
        if (JAMO.test(root.textContent)) F(tag + '숨김 단계인데 화면 문자열에 소리가 있음');
        if (JAMO.test(html)) F(tag + '숨김 단계인데 DOM에 소리가 있음');
        const norm = (e) => e.outerHTML.replace(/ data-[rc]="\\d+"/g, '');
        const kinds = new Set(cells.map(norm));
        if (kinds.size !== 1) F(tag + '칸 모양이 ' + kinds.size + '가지(빈칸·세기 자리가 드러남)');
        if (root.querySelector('.sb-slot')) F(tag + '세기 자리가 DOM에 있음');
        if (attrs.some((a) => /empty|closed|slot|sound|snd|strength/i.test(a.split('=')[1] || ''))) F(tag + '속성에 칸 정보: ' + attrs.filter((a) => /empty|closed|slot|sound|snd|strength/i.test(a)).slice(0, 3).join(' '));
      } else {
        const list = sea === 'vowel' ? S.vowels : S.consonants;
        for (const s of list) {
          const r = rows.indexOf(sea === 'vowel' ? s.height : s.manner), c = cols.indexOf(sea === 'vowel' ? s.column : s.place);
          const on = lv.open.includes(s.id);
          const has = cell(r, c).textContent.includes('/' + s.id + '/');
          if (on && !has) F(tag + '/' + s.id + '/가 제 칸에 없음');
          if (!on && html.includes('/' + s.id + '/')) F(tag + '열리지 않은 /' + s.id + '/가 보임');
        }
        if (sea === 'consonant') {
          if (cell(0, 2).className === cell(0, 0).className) F(tag + '빈칸이 소리 칸과 같은 모양');
          if (n === 1 && (cell(2, 4).className === cell(0, 2).className || cell(2, 4).className === cell(0, 0).className)) F(tag + '/ㅎ/ 칸(이번 바다에 없는 칸)이 구분되지 않음');
        } else if (cell(2, 1).className === cell(2, 0).className) F(tag + '모음 빈칸이 소리 칸과 같은 모양');
      }
      const ch = [...root.querySelectorAll('.sb-ch')].map((e) => e.textContent.trim());
      const rh = [...root.querySelectorAll('.sb-rh')].map((e) => e.textContent.trim());
      if (ch.length !== C || rh.length !== R) F(tag + '머리글 수 ' + ch.length + '/' + rh.length);
      if (lv.show.lineNames) {
        cols.forEach((k, i) => { if (ch[i] !== G.text.short(grade, cg, k)) F(tag + '열 이름 ' + i + ' ' + ch[i]); });
        rows.forEach((k, i) => { if (rh[i] !== G.text.short(grade, rg, k)) F(tag + '줄 이름 ' + i + ' ' + rh[i]); });
      } else {
        if (ch.concat(rh).some((x) => x)) F(tag + '줄 이름이 보임');
        for (const nm of names) if (html.includes(nm)) F(tag + '숨김 단계인데 이름이 DOM에 있음: ' + nm);
      }
      b.destroy(); host.remove();
      if (host.isConnected || document.querySelector('.sb')) F(tag + 'destroy 뒤에 판이 남음');
    }
    return { fails, errs: window.__soriErrors.slice() };
  });
  if (r1.errs.length) r1.fails.push('페이지 오류: ' + r1.errs.join(' | '));
  if (r1.fails.length) console.log('FAIL ' + r1.fails.join('\\nFAIL '));
  else console.log('PASS');
} finally { await closeTab(t1); }
`);

step('표시 쌓기·강조·물결·격침·공개', `
const t2 = await openTab(${JSON.stringify(PAGE)});
try {
  const r2 = await t2.evaluate(async () => {
    const fails = []; const F = (m) => fails.push(m);
    const J = JSON.stringify;
    const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const JAMO_G = /[\\u3131-\\u3163]/g;
    // 규칙 엔진이 낸 결과가 사례의 뜻대로인지 먼저 확인
    const g = BT.c2();
    const kinds = g.outcomes.map((o) => o.kind).join(',');
    if (kinds !== 'line,hit,line,miss,none,none,none,hit,hit,hit') F('사례 결과가 예상과 다름: ' + kinds);
    if (J(g.outcomes[0].targets) !== J([{ cell: { place: 'velar', manner: 'stop' } }])) F('같은 칸 강조 사례 아님');
    if (J(g.outcomes[2].targets) !== J([{ place: 'bilabial' }, { manner: 'nasal' }])) F('세로+가로 사례 아님');
    if (!g.outcomes[4].emptyCell || g.outcomes[6].emptyCell || g.outcomes[9].sunkShip !== 0) F('불발·격침 사례 아님');
    const shots = g.state.teams.player.shots, fleet = g.state.teams.enemy.fleet;

    const host = document.createElement('div'); host.style.width = '900px'; document.body.appendChild(host);
    const shipsEl = document.createElement('div'); document.body.appendChild(shipsEl);
    const b = G.board.create(host, { sea: 'consonant', level: 2, grade: 'm3', mode: 'play', shipsEl });
    b.render({ shots, fleet });
    const root = b.el;
    const cell = (r, c) => root.querySelector('.sb-cell[data-r="' + r + '"][data-c="' + c + '"]');
    const marks = (r, c, k) => cell(r, c).querySelectorAll('.sb-mark' + (k ? '.k-' + k : ''));
    const area = (e) => { const q = e.getBoundingClientRect(); return q.width * q.height; };
    // 한 칸에 여러 표시: /ㄲ/ 같은 줄 + /ㄱ/ 명중, 명중이 가장 크게
    if (marks(0, 3).length !== 2 || marks(0, 3, 'hit').length !== 1 || marks(0, 3, 'line').length !== 1) F('여린입천장·파열 칸 표시: ' + marks(0, 3).length);
    else {
      const h = marks(0, 3, 'hit')[0], l = marks(0, 3, 'line')[0];
      if (!(area(h) > area(l))) F('명중 표시가 같은 줄 표시보다 크지 않음');
      if (!h.textContent.includes('/ㄱ/')) F('명중 칸에 /ㄱ/ 표기 없음');
      const hs = parseFloat(getComputedStyle(h.querySelector('.sb-stamp')).fontSize);
      if (!(hs >= 0.6 * h.getBoundingClientRect().height - 0.5)) F('명중 표기 글씨가 작음 ' + hs + ' / ' + h.getBoundingClientRect().height);
    }
    if (marks(0, 2, 'dud').length !== 2) F('빈칸 불발 표시 2개가 아님: ' + marks(0, 2, 'dud').length);
    if (marks(2, 1).length !== 0) F('있는 칸의 없는 세기가 판에 찍힘');
    if (marks(1, 2, 'miss').length !== 1) F('빗나감 표시 없음');
    if (marks(3, 0, 'line').length !== 1) F('같은 줄 표시 없음');
    if (marks(0, 0, 'hit').length !== 3) F('/ㅂ/ /ㅃ/ /ㅍ/ 명중 3개가 아님');
    // 신호 기호(벡터): 명중 과녁 · 같은 줄 방향(같은 칸 = 겹친 네모, 세로+가로 = 두 방향) · 빗나감 × · 없는 소리 ∅
    const glyphOf = (m) => { const e = m && m.querySelector('.sb-badge'); return e ? e.getAttribute('data-glyph') : null; };
    if ([...marks(0, 0, 'hit')].some((m) => glyphOf(m) !== 'hit')) F('명중 표시에 과녁 기호가 없음');
    if (glyphOf(marks(0, 3, 'line')[0]) !== 'cell') F('같은 칸 신호의 기호가 겹친 네모가 아님: ' + glyphOf(marks(0, 3, 'line')[0]));
    if (glyphOf(marks(3, 0, 'line')[0]) !== 'hv') F('세로+가로 신호의 기호가 두 방향이 아님: ' + glyphOf(marks(3, 0, 'line')[0]));
    if (glyphOf(marks(1, 2, 'miss')[0]) !== 'miss') F('빗나감 기호(×) 없음');
    if (![...marks(0, 2, 'dud')].every((m) => m.querySelector('.sb-dudmark[data-glyph="dud"]'))) F('없는 소리 기호(∅) 없음');
    if (root.querySelector('.sb-burst, .sb-burst-fire, [class*="flame"]')) F('불꽃 요소가 판에 있음');
    if (root.querySelectorAll('.sb-sea').length !== 1 || root.querySelector('.sb-cell .sb-sea')) F('바다 지도가 칸 밖의 한 장이 아님');
    // 최근 발만 굵게: 마지막 발(/ㅍ/ 명중)만 .is-latest
    const lat = [...root.querySelectorAll('.sb-mark.is-latest')];
    if (lat.length !== 1 || !lat[0].textContent.includes('/ㅍ/')) F('최근 발 표시: ' + lat.map((e) => e.textContent).join(','));
    // 강조 흔적: 칸(0,3) / 세로줄 0 / 가로줄 3
    const tr = [...root.querySelectorAll('.sb-trace')].map((e) => e.dataset.o + ':' + (e.dataset.r || '') + ':' + (e.dataset.c || '')).sort();
    if (J(tr) !== J(['cell:0:3', 'col::0', 'row:3:'])) F('강조 흔적: ' + J(tr));
    const ctr = (e) => { const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; };
    const inside = (p, e) => { const q = e.getBoundingClientRect(); return p[0] >= q.left && p[0] <= q.right && p[1] >= q.top && p[1] <= q.bottom; };
    const colT = root.querySelector('.sb-trace[data-o="col"]'), rowT = root.querySelector('.sb-trace[data-o="row"]'), cellT = root.querySelector('.sb-trace[data-o="cell"]');
    if (colT && !(inside(ctr(cell(0, 0)), colT) && inside(ctr(cell(4, 0)), colT) && !inside(ctr(cell(0, 1)), colT))) F('세로줄 강조 자리가 틀림');
    if (rowT && !(inside(ctr(cell(3, 0)), rowT) && inside(ctr(cell(3, 4)), rowT) && !inside(ctr(cell(2, 0)), rowT))) F('가로줄 강조 자리가 틀림');
    if (cellT && !(inside(ctr(cell(0, 3)), cellT) && !inside(ctr(cell(0, 2)), cellT) && !inside(ctr(cell(1, 3)), cellT))) F('칸 강조 자리가 틀림');
    // 범위마다 방향 기호: 세로줄 ↕ · 가로줄 ↔ · 같은 칸 겹친 네모
    const dirOf = (e) => { const d = e && e.querySelector('.sb-dir'); return d ? d.getAttribute('data-glyph') : null; };
    if (dirOf(colT) !== 'v' || dirOf(rowT) !== 'h' || dirOf(cellT) !== 'cell') F('범위 방향 기호: ' + [dirOf(colT), dirOf(rowT), dirOf(cellT)].join(','));
    // 격침(한 칸 안의 세 칸 배 /ㅂ/ /ㅃ/ /ㅍ/): 선 대신 (0,0) 칸 왼쪽에 세운 한 척(불탄 뱃머리·가운데·배꼬리), 끌줄 없음
    const rootQ = root.getBoundingClientRect();
    const ptsOf = (e) => (e.getAttribute('points') || '').trim().split(/\\s+/).filter(Boolean).map((p) => p.split(',').map(Number)).map(([x, y]) => [x + rootQ.left, y + rootQ.top]);
    const vs0 = cell(0, 0).querySelector('.sb-vship[data-ship="0"]');
    const pcs0 = vs0 ? [...vs0.querySelectorAll('.sb-top')] : [];
    if (!vs0) F('한 칸 안 격침 배(세운 한 척) 없음');
    else if (J(pcs0.map((e) => e.dataset.piece).sort()) !== J(['bow', 'mid', 'stern']) || pcs0.some((e) => e.dataset.burnt !== '1')) F('세운 한 척의 조각: ' + J(pcs0.map((e) => e.dataset.piece + e.dataset.burnt)));
    if (root.querySelector('.sb-lines [data-ship="0"]')) F('한 칸 안 격침 배에 끌줄이 그려짐');
    if (root.querySelector('[data-t="reveal"]')) F('공개 전인데 공개 선이 있음');
    // 남은 배 목록
    const items = [...shipsEl.querySelectorAll('.sb-ship-item')];
    if (items.length !== 3 || !items[0].classList.contains('is-sunk') || items[1].classList.contains('is-sunk') || items[2].classList.contains('is-sunk')) F('남은 배 목록: ' + items.map((e) => e.className).join('|'));
    if (!items.every((e) => e.querySelector('svg, img'))) F('배 그림(그림 또는 대신 그린 모양)이 없음');
    // 가라앉은 배는 '찾음'과 그 배의 소리, 남은 배는 크기 이름 그대로
    const foundTxt = G.text.fill(TEXT.ui.play.shipFound, { sounds: fleet[0].sounds.map(G.text.sound).join(' ') });
    if (items[0] && items[0].querySelector('.sb-ship-name').textContent !== foundTxt) F('가라앉은 배 이름 자리: ' + items[0].querySelector('.sb-ship-name').textContent + ' ≠ ' + foundTxt);
    if (items[1] && items[1].querySelector('.sb-ship-name').textContent !== G.text.shipName(fleet[1].size)) F('남은 배 이름이 바뀜: ' + items[1].querySelector('.sb-ship-name').textContent);
    // 숨은 배 소리가 새지 않음: DOM의 소리는 쏜 소리뿐
    const shotIds = new Set(shots.map((x) => x.sound).filter(Boolean));
    const seen = new Set((root.outerHTML + shipsEl.outerHTML).match(JAMO_G) || []);
    const leak = [...seen].filter((x) => !shotIds.has(x));
    if (leak.length) F('쏘지 않은 소리가 DOM에 있음: ' + leak.join(','));
    // 끝날 때 공개: /ㅇ/(3,3), /ㅎ/(2,4)
    b.revealFleet();
    if (marks(3, 3, 'reveal').length !== 1 || marks(2, 4, 'reveal').length !== 1) F('공개 표시 없음');
    if (!marks(3, 3, 'reveal')[0] || !marks(3, 3, 'reveal')[0].textContent.includes('/ㅇ/')) F('공개 칸에 /ㅇ/ 없음');
    const rv1 = root.querySelector('.sb-lines [data-ship="1"][data-t="reveal"]'), rv2 = root.querySelector('.sb-lines [data-ship="2"][data-t="reveal"]');
    if (!rv1 || ptsOf(rv1).length !== 2 || !inside(ptsOf(rv1)[0], cell(0, 3)) || !inside(ptsOf(rv1)[1], cell(3, 3))) F('공개 선(두 칸 배) 틀림');
    if (!rv2) F('공개 표시(한 칸 배) 없음');
    // 판 상태(GameState)를 그대로 줘도 같게 그림(연습: 쏘는 팀 player)
    const nMarks = root.querySelectorAll('.sb-mark:not(.k-reveal)').length;
    b.render(g.state);
    if (root.querySelectorAll('.sb-mark').length !== nMarks || root.querySelector('.k-reveal')) F('판 상태로 그린 결과가 다름');
    b.setActive(true);
    if (!root.classList.contains('is-active')) F('setActive 안 됨');
    b.markSunk(2);
    if (!shipsEl.querySelectorAll('.sb-ship-item')[2].classList.contains('is-sunk')) F('markSunk가 목록에 반영 안 됨');
    b.destroy(); host.remove(); shipsEl.remove();
    if (shipsEl.querySelector('.sb-ships')) F('destroy 뒤 배 목록이 남음');

    // 물결: 새 '같은 줄'은 한 번 퍼지고 사라진다. 흔적은 남는다.
    const h2 = document.createElement('div'); h2.style.width = '700px'; document.body.appendChild(h2);
    const b2 = G.board.create(h2, { sea: 'consonant', level: 2, grade: 'm3', mode: 'play' });
    b2.render({ shots: shots.slice(0, 2), fleet });
    if (b2.el.querySelector('.sb-wave')) F('render()가 물결을 틀었음(되살리기는 조용해야 함)');
    b2.update({ shots: shots.slice(0, 3), fleet });
    const w0 = b2.el.querySelectorAll('.sb-wave').length;
    if (w0 !== 2) F('새 같은 줄(세로+가로) 물결 수: ' + w0);
    await wait(1900);
    if (b2.el.querySelectorAll('.sb-wave').length) F('물결이 멈추지 않음');
    if (b2.el.querySelectorAll('.sb-trace').length !== 3) F('물결 뒤 흔적 수: ' + b2.el.querySelectorAll('.sb-trace').length);
    // 움직임 줄이기: 물결 없음, 흔적은 남음
    document.documentElement.classList.add('reduce-motion');
    b2.render({ shots: shots.slice(0, 2), fleet });
    b2.update({ shots: shots.slice(0, 3), fleet });
    if (b2.el.querySelectorAll('.sb-wave').length) F('움직임 줄이기인데 물결이 나옴');
    if (b2.el.querySelectorAll('.sb-trace').length !== 3) F('움직임 줄이기에서 흔적 수 틀림');
    const hp = b2.highlight([{ place: 'velar' }]);
    if (!hp || typeof hp.then !== 'function') F('highlight()가 Promise를 돌려주지 않음');
    document.documentElement.classList.remove('reduce-motion');
    b2.destroy(); h2.remove();

    // 모음: 입술 짝 칸, 가로+세로 동시
    const gv = BT.play('vowel', 1, [{ size: 3, sounds: ['ㅣ', 'ㅔ', 'ㅐ'] }, { size: 2, sounds: ['ㅡ', 'ㅜ'] }, { size: 1, sounds: ['ㅗ'] }], ['ㅟ', 'ㅏ']);
    if (J(gv.outcomes[0].targets) !== J([{ pair: { height: 'high', column: 'front-unrounded' } }]) || J(gv.outcomes[1].targets) !== J([{ height: 'low' }, { column: 'back-unrounded' }])) F('모음 사례 아님: ' + J(gv.outcomes.map((o) => o.targets)));
    const h3 = document.createElement('div'); h3.style.width = '700px'; document.body.appendChild(h3);
    const b3 = G.board.create(h3, { sea: 'vowel', level: 1, grade: 'h1', mode: 'play' });
    b3.render({ shots: gv.state.teams.player.shots, fleet: gv.state.teams.enemy.fleet });
    const tv = [...b3.el.querySelectorAll('.sb-trace')].map((e) => e.dataset.o + ':' + (e.dataset.r || '') + ':' + (e.dataset.c || '')).sort();
    if (J(tv) !== J(['cell:0:0', 'col::2', 'row:2:'])) F('모음 강조 흔적: ' + J(tv));
    b3.destroy(); h3.remove();
    // 모음 2단계(강조 없음, 모두 숨김): 흔적 없음, 쏜 소리만 DOM에
    const gv2 = BT.play('vowel', 2, [{ size: 3, sounds: ['ㅣ', 'ㅔ', 'ㅐ'] }, { size: 2, sounds: ['ㅡ', 'ㅜ'] }, { size: 1, sounds: ['ㅗ'] }], ['ㅟ', 'ㅏ', { backness: 'back', height: 'low', lips: 'rounded' }]);
    const h4 = document.createElement('div'); h4.style.width = '700px'; document.body.appendChild(h4);
    const b4 = G.board.create(h4, { sea: 'vowel', level: 2, grade: 'm3', mode: 'play' });
    b4.render({ shots: gv2.state.teams.player.shots, fleet: gv2.state.teams.enemy.fleet });
    if (b4.el.querySelectorAll('.sb-trace').length) F('강조 없는 단계인데 흔적이 있음');
    const seen4 = new Set(b4.el.outerHTML.match(JAMO_G) || []);
    if ([...seen4].some((x) => x !== 'ㅟ' && x !== 'ㅏ')) F('모음 2단계에서 쏘지 않은 소리가 보임: ' + [...seen4].join(','));
    if (b4.el.querySelectorAll('.sb-cell[data-r="2"][data-c="3"] .sb-mark.k-dud').length !== 1) F('모음 빈칸 불발 표시 없음');
    b4.destroy(); h4.remove();
    return { fails, errs: window.__soriErrors.slice() };
  });
  if (r2.errs.length) r2.fails.push('페이지 오류: ' + r2.errs.join(' | '));
  if (r2.fails.length) console.log('FAIL ' + r2.fails.join('\\nFAIL '));
  else console.log('PASS');
} finally { await closeTab(t2); }
`);

step('신호 표시: 명중 황금 + 과녁(불꽃 없음) · 0.2초 강조 · 빗나감 × · 최근 발 · 배 그림 크기', `
const t5 = await openTab(${JSON.stringify(PAGE)});
try {
  const r5 = await t5.evaluate(async () => {
    const fails = []; const F = (m) => fails.push(m);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const fleet = [{ size: 3, sounds: ['ㄱ', 'ㄲ', 'ㅋ'] }, { size: 2, sounds: ['ㅂ', 'ㅁ'] }, { size: 1, sounds: ['ㄹ'] }];
    const g = BT.play('consonant', 2, fleet, ['ㄹ', 'ㅎ', 'ㄱ']);
    if (g.outcomes.map((o) => o.kind).join(',') !== 'hit,miss,hit') F('사례가 아님: ' + g.outcomes.map((o) => o.kind).join(','));
    const shots = g.state.teams.player.shots;
    const host = document.createElement('div'); host.style.width = '800px'; document.body.appendChild(host);
    const shipsEl = document.createElement('div'); document.body.appendChild(shipsEl);
    const b = G.board.create(host, { sea: 'consonant', level: 2, grade: 'm3', mode: 'play', shipsEl });
    b.render({ shots: [], fleet: g.state.teams.enemy.fleet });
    // 판 밑에는 코드로 그린 바다 지도 한 장만(.webp 질감 그림은 깔지 않음)
    if (!/svg/.test(getComputedStyle(b.el.querySelector('.sb-sea')).backgroundImage)) F('바다 지도(코드 그림)가 없음');
    if ([b.el, ...b.el.querySelectorAll('*')].some((e) => /\\.webp/.test(getComputedStyle(e).backgroundImage))) F('판 위에 그림 질감이 깔려 있음');
    // 명중: 황금 바탕 + 과녁 배지 + 소리 표기, 불꽃 요소 없음, 0.2초 안팎 강조 한 번
    b.update({ shots: shots.slice(0, 1), fleet: g.state.teams.enemy.fleet });
    const hit = b.el.querySelector('.sb-mark.k-hit');
    if (!hit) F('명중 표시 없음');
    else {
      const plate = hit.querySelector('.sb-stamp, .sb-snd');
      if (!plate || getComputedStyle(plate).backgroundColor !== 'rgb(246, 190, 72)') F('명중 표지가 황금색이 아님: ' + (plate && getComputedStyle(plate).backgroundColor));
      if (!hit.closest('.sb-cell').classList.contains('has-hit')) F('명중 칸 황금 테두리 없음');
      if (!hit.querySelector('.sb-badge[data-glyph="hit"]')) F('명중 과녁 배지 없음');
      if (!hit.textContent.includes('/ㄹ/')) F('명중 칸에 /ㄹ/ 없음');
      if (!hit.classList.contains('is-latest')) F('방금 명중이 최근 발 표시가 아님');
      if (!hit.classList.contains('sb-fresh')) F('방금 명중에 짧은 강조가 없음');
      const ms = parseFloat(getComputedStyle(hit).animationDuration) * 1000;
      if (!(ms >= 100 && ms <= 220)) F('명중 강조 길이 ' + ms + 'ms(150–200ms 안팎이 아님)');
      if (getComputedStyle(hit).animationIterationCount !== '1') F('명중 강조가 반복됨');
      const snd = hit.querySelector('.sb-stamp, .sb-snd');
      if (snd && getComputedStyle(snd).color !== 'rgb(24, 53, 64)') F('명중 칸 소리 글씨가 기본 잉크가 아님');
    }
    if (document.querySelector('.sb-burst, .sb-burst-fire, [class*="flame"]')) F('불꽃 요소가 있음');
    await wait(400);
    if (b.el.querySelector('.sb-fresh')) F('강조가 0.4초 뒤에도 남음');
    if (!b.el.querySelector('.sb-mark.k-hit')) F('강조 뒤 명중 표시가 없음');
    // 격침 → 목록의 배가 불탄 그림으로
    await wait(300);
    const sunkPic = shipsEl.querySelectorAll('.sb-ship-item')[2].querySelector('.sb-pic');
    if (!sunkPic.classList.contains('is-burnt')) F('격침된 배가 불탄 그림이 아님');
    const im = sunkPic.querySelector('img');
    if (!im || !/top_boat1_burnt\\.webp$/.test(im.getAttribute('src'))) F('불탄 배 그림(위에서 본 한 칸 배) 파일이 아님: ' + (im && im.getAttribute('src')));
    // 배 그림 크기: 세 칸 > 두 칸 > 한 칸
    const ws = [...shipsEl.querySelectorAll('.sb-pic')].map((e) => e.getBoundingClientRect().width);
    if (!(ws[0] > ws[1] && ws[1] > ws[2])) F('배 그림 크기 순서가 아님: ' + ws.map(Math.round).join(','));
    // 빗나감: 회색 바탕 + ×, 최근 발은 이것 하나
    b.update({ shots: shots.slice(0, 2), fleet: g.state.teams.enemy.fleet });
    const miss = b.el.querySelector('.sb-mark.k-miss');
    if (!miss || !miss.querySelector('.sb-badge[data-glyph="miss"]')) F('빗나감 × 없음');
    if (b.el.querySelectorAll('.is-latest').length !== 1 || !miss || !miss.classList.contains('is-latest')) F('최근 발 표시가 하나(빗나감)가 아님');
    if (b.el.querySelector('.sb-mark.k-hit').classList.contains('is-latest')) F('이전 명중이 최근 발로 남음');
    // 최근 1발은 신호와 상관없는 공통 잉크 테두리, 이전 결과는 테두리 없이 같은 기호(2차 검수)
    b.update({ shots: shots.slice(0, 3), fleet: g.state.teams.enemy.fleet });
    await wait(350); // 0.18초 강조가 끝난 뒤
    const hs = [...b.el.querySelectorAll('.sb-mark.k-hit')];
    const oldH = hs.find((m) => !m.classList.contains('is-latest')), newH = hs.find((m) => m.classList.contains('is-latest'));
    const ring = (m) => getComputedStyle(m).boxShadow;
    if (!oldH || !newH) F('최근·이전 명중 표시가 없음');
    else {
      if (!ring(newH).includes('rgb(24, 53, 64)')) F('최근 발 테두리가 기본 잉크가 아님: ' + ring(newH));
      if (ring(oldH) !== 'none') F('이전 결과에 최근 발 테두리가 남음: ' + ring(oldH));
      if (!oldH.querySelector('.sb-badge[data-glyph="hit"]')) F('이전 명중의 과녁 배지가 없음');
    }
    // 되살리기(render)와 움직임 줄이기: 강조 없음
    b.render({ shots, fleet: g.state.teams.enemy.fleet });
    if (b.el.querySelector('.sb-fresh')) F('render()가 강조를 틀었음');
    document.documentElement.classList.add('reduce-motion');
    b.render({ shots: shots.slice(0, 1), fleet: g.state.teams.enemy.fleet });
    b.update({ shots, fleet: g.state.teams.enemy.fleet });
    if (b.el.querySelector('.sb-fresh')) F('움직임 줄이기인데 강조가 나옴');
    document.documentElement.classList.remove('reduce-motion');
    b.destroy(); host.remove(); shipsEl.remove();
    return { fails, errs: window.__soriErrors.slice() };
  });
  if (r5.errs.length) r5.fails.push('페이지 오류: ' + r5.errs.join(' | '));
  if (r5.fails.length) console.log('FAIL ' + r5.fails.join('\\nFAIL '));
  else console.log('PASS');
} finally { await closeTab(t5); }
`);

step('숨기기(배치) 화면: 소리·줄 이름 보임, 놓을 수 있는 묶음만 누름', `
const t3 = await openTab(${JSON.stringify(PAGE)});
try {
  const r3 = await t3.evaluate(() => {
    const fails = []; const F = (m) => fails.push(m);
    const J = JSON.stringify;
    const L = G.rules.level('consonant', 3);
    const picks = [];
    const host = document.createElement('div'); host.style.width = '900px'; document.body.appendChild(host);
    const b = G.board.create(host, { sea: 'consonant', level: 3, grade: 'm3', mode: 'place', onPick: (grp) => picks.push(grp) });
    b.setPlaceable(G.rules.placeableGroups(L, []));
    const root = b.el;
    const cell = (r, c) => root.querySelector('.sb-cell[data-r="' + r + '"][data-c="' + c + '"]');
    const on = () => [...root.querySelectorAll('.sb-cell')].filter((e) => e.tagName === 'BUTTON' && !e.disabled).map((e) => e.dataset.r + e.dataset.c).sort();
    for (const s of SOUNDS.consonants) if (!root.textContent.includes('/' + s.id + '/')) F('배치 화면에 /' + s.id + '/ 없음');
    const rh = [...root.querySelectorAll('.sb-rh')].map((e) => e.textContent.trim());
    if (J(rh) !== J(SOUNDS.manners.map((m) => G.text.short('m3', 'manner', m)))) F('3단계 배치 화면에 줄 이름 없음: ' + J(rh));
    if (J(on()) !== J(['00', '01', '03', '12'])) F('세 칸 배 누를 수 있는 칸: ' + J(on()));
    const offCell = cell(4, 1);
    offCell.click();
    if (picks.length) F('누를 수 없는 칸이 골라짐');
    cell(0, 3).click();
    if (J(picks[0]) !== J(['ㄱ', 'ㄲ', 'ㅋ'])) F('고른 묶음: ' + J(picks[0]));
    const fleet = G.rules.addShip(L, [], picks[0]);
    b.setPlaced(fleet);
    b.setPlaceable(G.rules.placeableGroups(L, fleet));
    if (J(on()) !== J(['00', '01', '21', '30', '31'])) F('두 칸 배 누를 수 있는 칸: ' + J(on()));
    if (root.querySelectorAll('.is-placed').length !== 3) F('놓은 배 칸 표시 수: ' + root.querySelectorAll('.is-placed').length);
    if (!root.querySelector('.sb-lines [data-t="placed"]')) F('놓은 배 선 없음');
    cell(3, 0).click();
    if (J(picks[1]) !== J(['ㅂ', 'ㅁ'])) F('두 칸 배 고른 묶음: ' + J(picks[1]));
    // 한 칸이 여러 묶음에 들면 고르는 작은 창
    b.setPlaced([]);
    b.setPlaceable([['ㄱ', 'ㄲ', 'ㅋ'], ['ㄱ', 'ㅇ']]);
    const n0 = picks.length;
    cell(0, 3).click();
    const ch = root.querySelector('.sb-chooser');
    if (!ch || ch.querySelectorAll('button').length !== 2) F('고르기 창 없음');
    else {
      if (picks.length !== n0) F('고르기 창 전에 골라짐');
      const bs = ch.querySelectorAll('button');
      const bh = bs[1].getBoundingClientRect().height;
      const touch = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--touch'));
      if (bh < touch - 0.5) F('고르기 단추 높이 ' + bh);
      bs[1].click();
      if (J(picks[n0]) !== J(['ㄱ', 'ㅇ'])) F('고르기 창 선택: ' + J(picks[n0]));
      if (root.querySelector('.sb-chooser')) F('고른 뒤에도 창이 남음');
    }
    b.destroy(); host.remove();
    return { fails: fails.filter(Boolean), errs: window.__soriErrors.slice() };
  });
  if (r3.errs.length) r3.fails.push('페이지 오류: ' + r3.errs.join(' | '));
  if (r3.fails.length) console.log('FAIL ' + r3.fails.join('\\nFAIL '));
  else console.log('PASS');
} finally { await closeTab(t3); }
`);

// 크기별 점검 조각: 틀 안의 판을 재고 캡처한다
const measure = (w, h, src, shot, minTouch, phoneMin) => `
{
  const tf = await openTab(${JSON.stringify(frame(w, h, src))});
  try {
    await tf.evaluate(() => frameReady);
    await sleep(700);
    const m = await tf.evaluate(() => {
      const fw = frameWin(), d = fw.document, fails = [];
      const cells = [...d.querySelectorAll('.sb-cell')];
      if (!cells.length) fails.push('칸이 없음');
      const small = cells.map((e) => e.getBoundingClientRect()).filter((q) => q.width < ${minTouch} - 0.5 || q.height < ${minTouch} - 0.5);
      if (small.length) fails.push('작은 칸 ' + small.length + '개(예: ' + Math.round(small[0].width) + '×' + Math.round(small[0].height) + ')');
      if (d.documentElement.scrollWidth > d.documentElement.clientWidth + 1) fails.push('가로 스크롤 ' + d.documentElement.scrollWidth + ' > ' + d.documentElement.clientWidth);
      // 판 위 소리 표기: 글씨 크기 ≥ 그 칸(자리) 높이의 60%
      const bad = [];
      for (const e of d.querySelectorAll('.sb-snd, .sb-stamp')) {
        const box = e.closest('.sb-slot, .sb-mark, .sb-cell').getBoundingClientRect();
        const fs = parseFloat(fw.getComputedStyle(e).fontSize);
        const unit = +((e.closest('[data-u]') || {}).dataset || {}).u || 1;
        // 쏘는 바다(play)의 자리는 위쪽 표지 + 아래쪽 물(배 조각이 드러나는 곳)이라 45%, 배치·소리 지도는 55%
        // (T20: 소리가 흰 표지 판 위에 놓여 판의 안쪽 여백만큼 글씨가 줄었다 — 휴대폰 소리 지도 48px 자리에 28px)
        const ratio = e.closest('.sb-m-play') ? 0.45 : 0.55;
        if (fs < ratio * box.height / unit - 0.5) bad.push(e.textContent + ' ' + fs.toFixed(1) + '/' + (box.height / unit).toFixed(1));
        const ff = fw.getComputedStyle(e).fontFamily;
        if (!/SoriUI/.test(ff)) bad.push('글꼴 ' + ff);
      }
      if (bad.length) fails.push('소리 표기 작음: ' + bad.slice(0, 4).join(', '));
      // 소리 표기(.sb-snd)는 한 판 안에서 모두 같은 크기(비음·유음만 커지지 않음)
      for (const bd of d.querySelectorAll('.sb')) {
        const sizes = new Set([...bd.querySelectorAll('.sb-snd')].map((e) => fw.getComputedStyle(e).fontSize));
        if (sizes.size > 1) fails.push('소리 표기 크기가 제각각: ' + [...sizes].join(','));
      }
      // 명암비: 모든 소리 표기 글씨 ≥ 4.5 : 1(맞히지 않은 소리도 흐리게 하지 않음)
      const rgb = (c) => (c.match(/[\\d.]+/g) || []).map(Number);
      const lum = (c) => { const v = rgb(c).slice(0, 3).map((x) => x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4))); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const bgOf = (e) => { for (let n = e; n; n = n.parentElement) { const c = fw.getComputedStyle(n).backgroundColor; const a = rgb(c); if (a.length && (a.length < 4 || a[3] > 0.5)) return c; } return 'rgb(255, 255, 255)'; };
      const low = [];
      for (const e of d.querySelectorAll('.sb-snd, .sb-stamp')) {
        const f = lum(fw.getComputedStyle(e).color), bgl = lum(bgOf(e));
        const cr = (Math.max(f, bgl) + 0.05) / (Math.min(f, bgl) + 0.05);
        if (cr < 4.5) low.push(e.textContent + ' ' + cr.toFixed(2));
      }
      if (low.length) fails.push('소리 표기 명암비 4.5 미만: ' + low.slice(0, 5).join(', '));
      // 휴대폰 1단계(보이는 단계) 판: 소리 28px · 축 이름 16px · 배지 20px 이상(선생님 검수 기준)
      if (${phoneMin ? 'true' : 'false'}) {
        const px = (e) => parseFloat(fw.getComputedStyle(e).fontSize);
        const sm = [...d.querySelectorAll('.sb-snd')].filter((e) => px(e) < 28 - 0.2);
        if (sm.length) fails.push('휴대폰 소리 글씨 28px 미만: ' + px(sm[0]).toFixed(1));
        const ax = [...d.querySelectorAll('.sb-ch, .sb-rh')].filter((e) => e.textContent.trim() && px(e) < 16 - 0.2);
        if (ax.length) fails.push('휴대폰 축 이름 16px 미만: ' + px(ax[0]).toFixed(1));
        const bg = [...d.querySelectorAll('.sb-badge, .sb-dir')].filter((e) => e.getBoundingClientRect().width < 20 - 0.5);
        if (bg.length) fails.push('휴대폰 배지 20px 미만: ' + bg[0].getBoundingClientRect().width.toFixed(1));
      }
      // 판이 담긴 상자를 넘지 않음
      for (const bd of d.querySelectorAll('.sb')) {
        const q = bd.getBoundingClientRect(), p = bd.parentElement.getBoundingClientRect();
        if (q.right > p.right + 1 || q.bottom > p.bottom + 1 || q.left < p.left - 1) fails.push('판이 상자를 넘음 ' + JSON.stringify([q.right, p.right, q.bottom, p.bottom]));
        for (const e of bd.querySelectorAll('.sb-cell, .sb-ch, .sb-rh')) { const r = e.getBoundingClientRect(); if (r.right > p.right + 1) { fails.push('칸이 상자 밖'); break; } }
      }
      return { fails, errs: (fw.__soriErrors || ['오류 모음 없음']).slice() };
    });
    if (m.errs.length) m.fails.push('페이지 오류: ' + m.errs.join(' | '));
    if (m.fails.length) console.log('FAIL ${shot}: ' + m.fails.join('\\nFAIL ${shot}: '));
    try { await fs.mkdir('./artifacts', { recursive: true }); } catch (e) {}
    await fs.writeFile('./artifacts/${shot}.png', await tf.screenshot());
    console.log('SHOTFILE:' + path.resolve('./artifacts/${shot}.png'));
  } finally { await closeTab(tf); }
}
`;

step('휴대폰 세로 360×740: 칸 48px 이상, 가로 스크롤 없음, 소리 표기 크기(1단계 28px·축 16px·배지 20px)', `
${measure(360, 740, 'tests/pages/board.html?view=phone&lv=1', 'board-phone-c1', 48, true)}
${measure(360, 740, 'tests/pages/board.html?view=phone&lv=2&grade=h1', 'board-phone-c2', 48)}
${measure(360, 740, 'tests/pages/board.html?view=phone&sea=vowel&lv=1', 'board-phone-v1', 48)}
console.log('PASS');
`);

step('소리 지도(휴대폰 세로)·칠판 1920×1080·숨기기 화면', `
${measure(360, 740, 'tests/pages/board.html?view=map-phone', 'board-map-phone', 48)}
${measure(1920, 1080, 'tests/pages/board.html?view=wide', 'board-wide', 64)}
${measure(1920, 1080, 'tests/pages/board.html?view=place&lv=3', 'board-place', 64)}
${measure(1280, 800, 'tests/pages/board.html?view=map-wide&grade=h1', 'board-map-tablet', 64)}
console.log('PASS');
`);

step('섬과 암초 바다 지도: 숨김 누설 없음 · 같은 명중 조각 · 배 종류별 격침 모양 · 암초 · 끌줄과 번호 · 표지 명암비', `
const t7 = await openTab(${JSON.stringify(PAGE)});
try {
  const r7 = await t7.evaluate(async () => {
    const fails = []; const F = (m) => fails.push(m);
    const J = JSON.stringify;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const mk = (sea, level, extra) => {
      const host = document.createElement('div'); host.style.width = '900px'; document.body.appendChild(host);
      const shipsEl = document.createElement('div'); document.body.appendChild(shipsEl);
      const b = G.board.create(host, Object.assign({ sea, level, grade: 'm3', mode: 'play', shipsEl }, extra || {}));
      return { b, host, shipsEl, done() { b.destroy(); host.remove(); shipsEl.remove(); } };
    };
    const cellOf = (b, r, c) => b.el.querySelector('.sb-cell[data-r="' + r + '"][data-c="' + c + '"]');
    const pieceIn = (e) => [...e.querySelectorAll('.sb-obj .sb-top')].map((x) => x.dataset.piece + (x.dataset.burnt ? '*' : ''));

    // 1) 숨긴 단계: 쏘기 전 모든 칸이 같은 모양, 칸 안에 암초·자물쇠·배 조각·물보라가 없음. 바다 지도는 칸 밖 한 장
    for (const [sea, n] of [['consonant', 2], ['consonant', 3], ['vowel', 2]]) {
      const m = mk(sea, n);
      m.b.render({ shots: [] });
      const cells = [...m.b.el.querySelectorAll('.sb-cell')];
      if (new Set(cells.map((e) => e.outerHTML.replace(/ data-[rc]="[0-9]+"/g, ''))).size !== 1) F(sea + n + ': 쏘기 전 칸 모양이 여러 가지');
      if (cells.some((e) => e.querySelector('.sb-reef, .sb-lock, .sb-top, .sb-vship, .sb-obj, .sb-ripple'))) F(sea + n + ': 쏘기 전 칸에 암초·자물쇠·배 조각이 있음');
      if (m.b.el.querySelectorAll('.sb-sea').length !== 1 || m.b.el.querySelector('.sb-cell .sb-sea')) F(sea + n + ': 바다 지도가 칸 밖 한 장이 아님');
      m.done();
    }

    // 2) 가라앉기 전 명중: 어느 배든 같은 조각(top_hit) — 크기·종류가 새지 않음
    const fleetC = [{ size: 3, sounds: ['ㄱ', 'ㄲ', 'ㅋ'] }, { size: 2, sounds: ['ㅂ', 'ㅁ'] }, { size: 1, sounds: ['ㄹ'] }];
    {
      const g = BT.play('consonant', 2, fleetC, ['ㄱ', 'ㅂ']);
      if (g.outcomes.map((o) => o.kind).join() !== 'hit,hit') F('사례 아님(2단계 명중 둘)');
      const m = mk('consonant', 2);
      m.b.render({ shots: g.state.teams.player.shots, fleet: g.state.teams.enemy.fleet });
      const imgs = [...m.b.el.querySelectorAll('.sb-obj .sb-top')];
      if (imgs.length !== 2 || imgs.some((e) => e.dataset.piece !== 'hit' || e.dataset.burnt) || new Set(imgs.map((e) => e.getAttribute('src'))).size !== 1) F('가라앉기 전 명중 조각이 배마다 같지 않음: ' + J(imgs.map((e) => e.getAttribute('src'))));
      if (m.shipsEl.querySelector('.sb-ship-item.is-sunk, .sb-num')) F('가라앉기 전인데 목록이 바뀜');
      m.done();
    }
    {
      const g = BT.play('vowel', 1, [{ size: 3, sounds: ['ㅣ', 'ㅔ', 'ㅐ'] }, { size: 2, sounds: ['ㅓ', 'ㅗ'] }, { size: 1, sounds: ['ㅏ'] }], ['ㅣ', 'ㅓ']);
      const m = mk('vowel', 1);
      m.b.render({ shots: g.state.teams.player.shots, fleet: g.state.teams.enemy.fleet });
      const ps = [...m.b.el.querySelectorAll('.sb-obj .sb-top')].map((e) => e.dataset.piece);
      if (J(ps) !== J(['hit', 'hit'])) F('모음 1단계 가라앉기 전 조각: ' + J(ps));
      m.done();
    }

    // 3) 격침 모양(배 종류별, 불탄 그림): 한 칸 배 = 온 배, 떨어진 두 칸 배 = 위 뱃머리·아래 배꼬리 + 끌줄 + 같은 번호,
    //    한 칸 안의 세 칸 배 = 세운 한 척. 모음: 세로 세 칸 = 뱃머리·가운데·배꼬리, 가로 두 칸 = 왼쪽 배꼬리·오른쪽 뱃머리
    {
      const g = BT.play('consonant', 2, fleetC, ['ㄹ', 'ㅂ', 'ㅁ', 'ㄱ', 'ㄲ', 'ㅋ']);
      if (g.outcomes.map((o) => o.sunk || '-').join() !== '1,-,2,-,-,3') F('격침 사례 아님: ' + g.outcomes.map((o) => o.sunk).join());
      const m = mk('consonant', 2);
      m.b.render({ shots: g.state.teams.player.shots, fleet: g.state.teams.enemy.fleet });
      await wait(200);
      if (J(pieceIn(cellOf(m.b, 4, 1))) !== J(['boat1*'])) F('한 칸 배 격침 모양: ' + J(pieceIn(cellOf(m.b, 4, 1))));
      if (J(pieceIn(cellOf(m.b, 0, 0))) !== J(['bow*'])) F('두 칸 배 위 조각(뱃머리): ' + J(pieceIn(cellOf(m.b, 0, 0))));
      if (J(pieceIn(cellOf(m.b, 3, 0))) !== J(['stern*'])) F('두 칸 배 아래 조각(배꼬리): ' + J(pieceIn(cellOf(m.b, 3, 0))));
      const vs = cellOf(m.b, 0, 3).querySelector('.sb-vship');
      if (!vs || vs.querySelectorAll('.sb-top[data-burnt="1"]').length !== 3) F('한 칸 안 세 칸 배가 세운 한 척(불탄 조각 셋)이 아님');
      if (pieceIn(cellOf(m.b, 0, 3)).length) F('한 칸 안 세 칸 배 칸에 따로 조각이 있음');
      // 끌줄: 떨어진 두 칸 배(1번 배)에만. 두 조각·목록에 같은 번호(배 순서 + 1 = 2)
      if (!m.b.el.querySelector('.sb-lines .sb-tow[data-ship="1"]')) F('떨어진 두 칸 배의 점선 끌줄 없음');
      if (m.b.el.querySelector('.sb-lines .sb-tow[data-ship="0"], .sb-lines .sb-tow[data-ship="2"]')) F('떨어지지 않은 배에 끌줄이 있음');
      if (!m.b.el.querySelector('.sb-lines .sb-towbadge[data-ship="1"]')) F('끌줄 가운데 배 배지 없음');
      const nums = [...m.b.el.querySelectorAll('.sb-num')].map((e) => e.textContent);
      if (J(nums) !== J(['2', '2'])) F('두 조각의 번호: ' + J(nums));
      if (!cellOf(m.b, 0, 0).querySelector('.sb-num') || !cellOf(m.b, 3, 0).querySelector('.sb-num')) F('번호가 두 조각에 붙지 않음');
      const items = [...m.shipsEl.querySelectorAll('.sb-ship-item')];
      const itemNums = items.map((e) => (e.querySelector('.sb-num') || {}).textContent || '');
      if (J(itemNums) !== J(['', '2', ''])) F('남은 배 목록의 번호: ' + J(itemNums));
      if (!items.every((e) => e.classList.contains('is-sunk'))) F('모두 격침인데 목록이 다름');
      m.done();
    }
    {
      const g = BT.play('vowel', 1, [{ size: 3, sounds: ['ㅣ', 'ㅔ', 'ㅐ'] }, { size: 2, sounds: ['ㅓ', 'ㅗ'] }, { size: 1, sounds: ['ㅏ'] }], ['ㅣ', 'ㅔ', 'ㅐ', 'ㅓ', 'ㅗ']);
      const m = mk('vowel', 1);
      m.b.render({ shots: g.state.teams.player.shots, fleet: g.state.teams.enemy.fleet });
      await wait(200);
      const at = (r, c) => J(pieceIn(cellOf(m.b, r, c)));
      if (at(0, 0) !== J(['bow*']) || at(1, 0) !== J(['mid*']) || at(2, 0) !== J(['stern*'])) F('모음 세로 세 칸 배 모양: ' + [at(0, 0), at(1, 0), at(2, 0)].join(' '));
      if (at(1, 2) !== J(['stern*']) || at(1, 3) !== J(['bow*'])) F('모음 가로 두 칸 배 모양: ' + at(1, 2) + ' ' + at(1, 3));
      if (!m.b.el.querySelector('.sb-lines .sb-tow[data-ship="0"]') || !m.b.el.querySelector('.sb-lines .sb-tow[data-ship="1"]')) F('모음 떨어진 배의 끌줄 없음');
      m.done();
    }

    // 4) 암초: 빈칸 불발 뒤에만(그 칸에 하나). 소리가 있는 칸의 없는 세기는 판에 찍지 않음
    {
      const m = mk('consonant', 2);
      m.b.render({ shots: [] });
      if (m.b.el.querySelector('.sb-reef')) F('쏘기 전 암초가 있음');
      const g1 = BT.play('consonant', 2, fleetC, [{ place: 'palatal', manner: 'stop', strength: 'tense' }]);
      m.b.render({ shots: g1.state.teams.player.shots, fleet: g1.state.teams.enemy.fleet });
      if (m.b.el.querySelectorAll('.sb-reef').length !== 1 || cellOf(m.b, 0, 2).querySelectorAll('.sb-reef').length !== 1) F('빈칸 불발 뒤 그 칸의 암초 하나가 아님');
      if (!cellOf(m.b, 0, 2).querySelector('.sb-dudmark[data-glyph="dud"]')) F('암초 칸에 없는 소리 배지 없음');
      const g2 = BT.play('consonant', 2, fleetC, [{ place: 'palatal', manner: 'stop', strength: 'tense' }, { place: 'alveolar', manner: 'fricative', strength: 'aspirated' }]);
      m.b.render({ shots: g2.state.teams.player.shots, fleet: g2.state.teams.enemy.fleet });
      if (m.b.el.querySelectorAll('.sb-reef').length !== 1) F('소리가 있는 칸의 없는 세기에도 암초가 생김');
      m.done();
      const m1 = mk('consonant', 1);
      m1.b.render({ shots: [] });
      if (m1.b.el.querySelector('.sb-reef')) F('1단계 쏘기 전 암초가 있음(빈칸은 그냥 바다)');
      m1.done();
    }

    // 5) 표지 명암비: 모든 소리 표지(쏜 것·안 쏜 것·공개·배치 팀 색·소리 지도 황금)의 글씨 대 표지 바탕 4.5 이상, 표지는 불투명
    {
      const rgb = (c) => (c.match(/[0-9.]+/g) || []).map(Number);
      const lum = (c) => { const v = rgb(c).slice(0, 3).map((x) => x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4))); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const check = (root, tag) => {
        for (const e of root.querySelectorAll('.sb-snd, .sb-stamp')) {
          const cs = getComputedStyle(e), bg = rgb(cs.backgroundColor);
          if (bg.length === 4 && bg[3] < 0.99) { F(tag + ': 표지가 투명 ' + e.textContent); continue; }
          const a = lum(cs.color), b = lum(cs.backgroundColor);
          const cr = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          if (cr < 4.5) F(tag + ': 명암비 ' + cr.toFixed(2) + ' ' + e.textContent);
        }
      };
      const g = BT.play('consonant', 1, [{ size: 2, sounds: ['ㄷ', 'ㄴ'] }, { size: 1, sounds: ['ㅇ'] }, { size: 1, sounds: ['ㄹ'] }], ['ㅅ', 'ㄴ', 'ㄷ', 'ㅂ', 'ㄱ']);
      const m = mk('consonant', 1);
      m.b.render({ shots: g.state.teams.player.shots, fleet: g.state.teams.enemy.fleet });
      check(m.b.el, '1단계');
      m.b.revealFleet();
      check(m.b.el, '1단계 공개');
      m.done();
      const g2 = BT.play('consonant', 2, fleetC, ['ㄱ', 'ㅂ', 'ㅈ', 'ㅎ']);
      const m2 = mk('consonant', 2);
      m2.b.render({ shots: g2.state.teams.player.shots, fleet: g2.state.teams.enemy.fleet });
      check(m2.b.el, '2단계');
      m2.done();
      for (const team of ['blue', 'red']) {
        const h = document.createElement('div'); h.style.width = '900px'; document.body.appendChild(h);
        const bp = G.board.create(h, { sea: 'consonant', level: 3, grade: 'm3', mode: 'place', team });
        bp.setPlaced(fleetC);
        check(bp.el, '배치 ' + team);
        if (!bp.el.querySelector('.sb-vship') || !bp.el.querySelector('.sb-obj .sb-top[data-piece="bow"]')) F('배치 화면에 위에서 본 배 그림 없음');
        bp.destroy(); h.remove();
      }
      const hm = document.createElement('div'); hm.style.width = '900px'; document.body.appendChild(hm);
      const sm = G.board.soundMap(hm, { sea: 'consonant', grade: 'm3', hitSounds: ['ㄱ', 'ㅃ', 'ㅎ'] });
      check(sm.el, '소리 지도');
      if (sm.el.querySelector('.sb-top, .sb-vship')) F('소리 지도에 배 조각이 있음');
      if (sm.el.querySelectorAll('.sb-sea').length !== 1) F('소리 지도에 바다 지도가 없음');
      sm.destroy(); hm.remove();
    }
    return { fails, errs: window.__soriErrors.slice() };
  });
  if (r7.errs.length) r7.fails.push('페이지 오류: ' + r7.errs.join(' | '));
  if (r7.fails.length) console.log('FAIL ' + r7.fails.join(' / FAIL '));
  else console.log('PASS');
} finally { await closeTab(t7); }
`);
