// '게임 방법' 창과 대결 위 띠 점검(aside) — 진짜 index.html을 크기별 틀에 띄운다.
//   · 시작 화면: 처음 온 기기에는 '게임 방법' 단추에 '처음이라면 먼저 보세요'가 붙고, 한 번 열면 사라진다(다시 열어도)
//   · 창: 번호 카드 6장(목표·소리 만들기·신호·배 모양·턴·대결), 신호 네 가지 이름, 보기 조합 = /ㅂ/(모음 탭 = /ㅣ/),
//         배 그림 세 척, 글은 빗금 표기·금지 낱말 없음, 터치 목표(가로 64px · 휴대폰 48px), 화면 밖으로 넘치지 않음,
//         '알겠어요'·닫기·Esc·바깥 누르기로 닫힘, 닫으면 흔적 없음
//   · 연습 준비 화면·연습 판 윗줄·대결 준비 화면에 단추가 있고, 판 도중 열고 닫아도 판은 그대로
//   · 대결 위 띠: 가운데 칸의 제목·'처음으로'가 양옆 팀 칸과 같은 높이 가운데(위로 쏠리지 않음), 4px 윗줄
const { step, frame } = await import('./aside.mjs');
const { DRIVER } = await import('./lib/drive.mjs');
const J = JSON.stringify;

const run = (w, h, body) => `{
const tab = await openTab(${J(frame(w, h, 'index.html'))});
const bad = [];
try {
  await tab.evaluate(() => frameReady);
  await tab.evaluate(() => { ${DRIVER} });
  const E = async (fn, arg) => { const r = await tab.evaluate(fn, arg); if (Array.isArray(r)) bad.push(...r); return r; };
  await E(async () => { await D.fresh(); return D.take(); });
  ${body}
} catch (e) { bad.push('예외: ' + (e && (e.stack || e.message) || e)); }
finally { await closeTab(tab); }
if (bad.length) console.log('FAIL ' + [...new Set(bad)].slice(0, 30).join('\\nFAIL '));
else console.log('PASS');
}`;

// 창 하나를 살펴본다(D 안에서 부르는 함수 문자열)
const INSPECT = `
D.howtoCheck = (tag, min, sea) => {
  const root = D.$('.howto');
  if (!root || !D.visible(root)) { D.bad(tag + ': 창이 안 열림'); return; }
  const T = D.T().howto;
  const cards = D.$$('.howto-card', root);
  if (cards.length !== 6) D.bad(tag + ': 카드 ' + cards.length + '장');
  const nums = cards.map((c) => D.$('.howto-num', c).textContent).join(',');
  if (nums !== '1,2,3,4,5,6') D.bad(tag + ': 번호 ' + nums);
  const names = D.$$('.howto-sig-name', root).map((e) => e.textContent).join(',');
  if (names !== '명중,같은 줄,빗나감,없는 음운') D.bad(tag + ': 신호 이름 ' + names);
  const eq = (D.$('.howto-eq', root) || {}).textContent || '';
  const want = sea === 'vowel' ? '/ㅣ/' : '/ㅂ/';
  if (!eq.endsWith('= ' + want)) D.bad(tag + ': 보기 조합 ' + eq);
  if (D.$$('.howto-ship-pic img, .howto-ship-pic svg', root).length < 3) D.bad(tag + ': 배 그림 부족');
  const tab = D.$('.howto-tab.is-on', root);
  if (!tab || tab.getAttribute('data-sea') !== sea) D.bad(tag + ': 바다 탭');
  const lines = D.visibleText().filter((s) => root.textContent.indexOf(s) >= 0 || s === T.closeX);
  D.checkLines(tag, lines);
  const panel = D.$('.howto-panel', root);
  D.inView(panel, tag + ' 창');
  D.inView(D.$('.howto-ok', root), tag + " '알겠어요'");
  D.inView(D.$('.howto-x', root), tag + ' 닫기');
  D.$$('button', root).filter(D.visible).forEach((b) => {
    const q = D.box(b); if (Math.min(q.width, q.height) < min - 0.5) D.bad(tag + ': 터치 목표 ' + Math.round(q.width) + '×' + Math.round(q.height) + ' — ' + D.desc(b));
  });
  const de = D.d().documentElement;
  if (de.scrollWidth > de.clientWidth + 1) D.bad(tag + ': 가로 스크롤');
  const body = D.$('.howto-body', root);
  if (body.scrollWidth > body.clientWidth + 1) D.bad(tag + ': 창 안 가로 넘침 ' + body.scrollWidth + ' > ' + body.clientWidth);
};
`;

for (const [w, h, min] of [[1920, 1080, 64], [1366, 768, 64], [390, 844, 48]]) {
  step(`시작 화면 → 게임 방법 ${w}×${h}: 처음 표시 · 카드 · 탭 · 닫기`, run(w, h, `
  await E(async () => { ${INSPECT}
    await D.until(() => D.cur() === 'title', 4000, '시작 화면');
    const b = D.$('[data-go="howto"]');
    if (!b) { D.bad('시작 화면에 게임 방법 단추 없음'); return D.take(); }
    if (!D.$('.app-howto-hint', b)) D.bad("처음 온 기기인데 '처음이라면 먼저 보세요' 없음");
    if (D.G().save.seenHowto()) D.bad('처음인데 연 적 있음');
    D.tap(b, '게임 방법');
    await D.wait(150);
    D.howtoCheck('시작 화면 창(자음)', ${min}, 'consonant');
    if (!D.G().save.seenHowto()) D.bad('열었는데 연 적 있음이 저장 안 됨');
    D.tapSel('.howto-tab[data-sea="vowel"]', '모음 탭');
    await D.wait(80);
    D.howtoCheck('시작 화면 창(모음)', ${min}, 'vowel');
    D.tapSel('.howto-ok', '알겠어요');
    await D.wait(80);
    if (D.$('.howto')) D.bad("'알겠어요'로 안 닫힘");
    const b2 = D.$('[data-go="howto"]');
    if (!b2 || D.$('.app-howto-hint', b2)) D.bad("닫은 뒤에도 '처음이라면' 표시가 남음");
    // Esc · 바깥 누르기 · ×로 닫기
    D.tap(b2, '게임 방법(다시)'); await D.wait(80);
    D.d().dispatchEvent(new (D.w().KeyboardEvent)('keydown', { key: 'Escape', bubbles: true }));
    await D.wait(60);
    if (D.$('.howto')) D.bad('Esc로 안 닫힘');
    D.tap(D.$('[data-go="howto"]'), '게임 방법(다시)'); await D.wait(80);
    const root = D.$('.howto');
    root.dispatchEvent(new (D.w().MouseEvent)('click', { bubbles: true }));
    await D.wait(60);
    if (D.$('.howto')) D.bad('바깥을 눌러도 안 닫힘');
    D.tap(D.$('[data-go="howto"]'), '게임 방법(다시)'); await D.wait(80);
    D.tapSel('.howto-x', '닫기'); await D.wait(60);
    if (D.$('.howto')) D.bad('×로 안 닫힘');
    return D.take();
  });
  await E(async () => { await D.reload(); await D.until(() => D.cur() === 'title', 4000, '다시 연 시작 화면');
    const b = D.$('[data-go="howto"]'); if (!b || D.$('.app-howto-hint', b)) D.bad("새로고침 뒤 '처음이라면' 표시가 다시 붙음");
    return D.take(); });
  `));
}

step('연습 준비·판 윗줄에서 열고 닫아도 판은 그대로(가로 1366 · 세로 390)', run(1366, 768, `
  for (const [w, h, min] of [[1366, 768, 64], [390, 844, 48]]) {
    await E(async (a) => { ${INSPECT}
      await D.resize(a[0], a[1]);
      await D.fresh();
      D.G().save.setSeenExample(true);
      D.goTitleBtn('practice');
      await D.until(() => D.cur() === 'practice' && D.pr().view === 'setup', 4000, '연습 준비');
      const sb = D.$('.pr-setup .pr-howto');
      if (!sb || !D.visible(sb)) { D.bad('연습 준비 화면에 게임 방법 단추 없음'); return D.take(); }
      D.prChoose('h1', 'vowel', 1);
      D.tap(sb, '게임 방법(준비)'); await D.wait(120);
      D.howtoCheck('연습 준비 창 ' + a[0], a[2], 'vowel');
      if (!/고모음|전설|평순/.test(D.$('.howto-demo').textContent)) D.bad('고1인데 보기 카드가 고1 이름이 아님: ' + D.$('.howto-demo').textContent);
      D.tapSel('.howto-ok', '알겠어요'); await D.wait(60);
      D.prChoose('m3', 'consonant', 2);
      D.tapSel('.pr-start', '시작');
      await D.until(() => D.pr().view === 'play' && !D.pr().busy, 4000, '판');
      await D.prShoot('ㄱ');
      const before = JSON.stringify(D.prShots()), turns = D.turnsLeft();
      const tb = D.$('.pr-top .pr-howto');
      if (!tb || !D.visible(tb)) { D.bad('연습 판 윗줄에 게임 방법 단추 없음'); return D.take(); }
      D.tap(tb, '게임 방법(판)'); await D.wait(120);
      D.howtoCheck('연습 판 창 ' + a[0], a[2], 'consonant');
      D.tapSel('.howto-ok', '알겠어요'); await D.wait(80);
      if (JSON.stringify(D.prShots()) !== before || D.turnsLeft() !== turns || D.pr().view !== 'play') D.bad('창을 열고 닫았더니 판이 바뀜');
      D.noScroll('창을 닫은 연습 판 ' + a[0], true);
      return D.take();
    }, [w, h, min]);
  }
`));

for (const [w, h] of [[1920, 1080], [1366, 768]]) {
  step(`대결 ${w}×${h}: 준비 화면 단추 · 위 띠 제목이 가운데`, run(w, h, `
  await E(async () => { ${INSPECT}
    D.goTitleBtn('duel');
    await D.until(() => D.cur() === 'duel', 4000, '대결 준비');
    await D.wait(200);
    const hb = D.$('.duel-howto');
    if (!hb || !D.visible(hb)) { D.bad('대결 준비 화면에 게임 방법 단추 없음'); return D.take(); }
    D.tap(hb, '게임 방법(대결)'); await D.wait(120);
    D.howtoCheck('대결 준비 창', 64, 'consonant');
    const second = D.$$('.howto-card')[1];
    if (!second || !second.classList.contains('is-duel')) D.bad('대결에서 연 창의 둘째 카드가 대결 안내가 아님');
    D.tapSel('.howto-ok', '알겠어요'); await D.wait(60);
    D.tapSel('.duel-start', '시작');
    await D.until(() => D.du() && D.du().screen() === 'play', 6000, '대결 판');
    await D.wait(300);
    const side = D.box(D.$('.duel-side.side-blue')), center = D.box(D.$('.duel-center'));
    const head = D.box(D.$('.duel-side-head')), row = D.box(D.$('.duel-titlerow'));
    if (Math.abs(center.top - side.top) > 1 || Math.abs(center.bottom - side.bottom) > 1) D.bad('가운데 칸 높이가 팀 칸과 다름');
    const cw = D.w().getComputedStyle(D.$('.duel-center'));
    if (parseFloat(cw.borderTopWidth) < 3.5) D.bad('가운데 칸 4px 윗줄 없음');
    const cHead = (head.top + head.bottom) / 2, cRow = (row.top + row.bottom) / 2;
    const cCell = (center.top + 4 + center.bottom) / 2;
    if (Math.abs(cRow - cCell) > 4) D.bad('제목 줄이 가운데 칸의 가운데가 아님: ' + Math.round(cRow) + ' vs ' + Math.round(cCell));
    if (Math.abs(cRow - cHead) > 8) D.bad('제목 줄이 팀 이름 줄과 높이가 다름: ' + Math.round(cRow) + ' vs ' + Math.round(cHead));
    const st = D.$('.duel-status'); if (st && !st.textContent && D.visible(st)) D.bad('빈 승패 줄이 자리를 차지함');
    if (D.$('.duel-play .howto-open')) D.bad('대결 판 화면에 게임 방법 단추가 있음(준비 화면에만)');
    return D.take();
  });
  `));
}
