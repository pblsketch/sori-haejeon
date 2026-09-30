// 바다(판) 그리기 G.board 점검(aside). 점검용 페이지 tests/pages/board.html에서 판만 불러 본다.
//   1) 단계별로 숨길 것(칸 안 소리·빈칸 구분·세기 자리·줄 이름)이 화면 문자열·DOM 속성·aria에 드러나지 않는지
//   2) 여러 신호가 쌓인 판: 한 칸에 표시 여러 개(명중이 가장 크게), '같은 줄' 강조가 알맞은 칸·줄로(둘 다 포함),
//      물결은 한 번 퍼지고 사라짐(움직임 줄이기면 물결 없음), 격침 선, 남은 배 목록, 끝날 때 공개
//   3) 숨기기(배치) 화면: 단계와 상관없이 소리·줄 이름이 보이고, 놓을 수 있는 묶음의 칸만 누를 수 있음
//   4) 크기별: 휴대폰 세로 360×740에서 칸 48px 이상·가로 스크롤 없음·소리 표기 글씨 크기 ≥ 칸(자리) 높이 60%,
//      칠판 1920×1080에서 칸 64px 이상. 캡처를 tests/shots/에 남긴다.
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
    // 강조 흔적: 칸(0,3) / 세로줄 0 / 가로줄 3
    const tr = [...root.querySelectorAll('.sb-trace')].map((e) => e.dataset.o + ':' + (e.dataset.r || '') + ':' + (e.dataset.c || '')).sort();
    if (J(tr) !== J(['cell:0:3', 'col::0', 'row:3:'])) F('강조 흔적: ' + J(tr));
    const ctr = (e) => { const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; };
    const inside = (p, e) => { const q = e.getBoundingClientRect(); return p[0] >= q.left && p[0] <= q.right && p[1] >= q.top && p[1] <= q.bottom; };
    const colT = root.querySelector('.sb-trace[data-o="col"]'), rowT = root.querySelector('.sb-trace[data-o="row"]'), cellT = root.querySelector('.sb-trace[data-o="cell"]');
    if (colT && !(inside(ctr(cell(0, 0)), colT) && inside(ctr(cell(4, 0)), colT) && !inside(ctr(cell(0, 1)), colT))) F('세로줄 강조 자리가 틀림');
    if (rowT && !(inside(ctr(cell(3, 0)), rowT) && inside(ctr(cell(3, 4)), rowT) && !inside(ctr(cell(2, 0)), rowT))) F('가로줄 강조 자리가 틀림');
    if (cellT && !(inside(ctr(cell(0, 3)), cellT) && !inside(ctr(cell(0, 2)), cellT) && !inside(ctr(cell(1, 3)), cellT))) F('칸 강조 자리가 틀림');
    // 격침 선: 배 0(/ㅂ/ /ㅃ/ /ㅍ/)의 점이 모두 (0,0) 칸 안
    const rootQ = root.getBoundingClientRect();
    const ptsOf = (e) => (e.getAttribute('points') || '').trim().split(/\\s+/).filter(Boolean).map((p) => p.split(',').map(Number)).map(([x, y]) => [x + rootQ.left, y + rootQ.top]);
    const sunkL = root.querySelector('.sb-lines [data-ship="0"][data-t="sunk"]');
    if (!sunkL) F('격침 선 없음');
    else { const p = ptsOf(sunkL); if (p.length !== 3 || !p.every((x) => inside(x, cell(0, 0)))) F('격침 선 점: ' + J(p)); }
    if (root.querySelector('[data-t="reveal"]')) F('공개 전인데 공개 선이 있음');
    // 남은 배 목록
    const items = [...shipsEl.querySelectorAll('.sb-ship-item')];
    if (items.length !== 3 || !items[0].classList.contains('is-sunk') || items[1].classList.contains('is-sunk') || items[2].classList.contains('is-sunk')) F('남은 배 목록: ' + items.map((e) => e.className).join('|'));
    if (!items.every((e) => e.querySelector('svg, img'))) F('배 그림(그림 또는 대신 그린 모양)이 없음');
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
const measure = (w, h, src, shot, minTouch) => `
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
        if (fs < 0.6 * box.height / unit - 0.5) bad.push(e.textContent + ' ' + fs.toFixed(1) + '/' + (box.height / unit).toFixed(1));
        const ff = fw.getComputedStyle(e).fontFamily;
        if (!/Sori|Hahmlet/.test(ff)) bad.push('글꼴 ' + ff);
      }
      if (bad.length) fails.push('소리 표기 작음: ' + bad.slice(0, 4).join(', '));
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

step('휴대폰 세로 360×740: 칸 48px 이상, 가로 스크롤 없음, 소리 표기 크기', `
${measure(360, 740, 'tests/pages/board.html?view=phone&lv=1', 'board-phone-c1', 48)}
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
