// '게임 방법' 창과 대결 위 띠를 크기별로 찍어 눈으로 보는 캡처 도구(합격·불합격 점검 아님). tests/shots/howto-*.png
//   node server.mjs 8791 을 켜 둔 뒤: node shot-howto.mjs
const { step, frame } = await import('./aside.mjs');
const { DRIVER } = await import('./lib/drive.mjs');
const J = JSON.stringify;

const shotJs = (w, h, name, body) => `{
const tab = await openTab(${J(frame(w, h, 'index.html'))});
try {
  await tab.evaluate(() => frameReady);
  await tab.evaluate(() => { ${DRIVER} });
  async function snap(n) {
    await sleep(400);
    const clip = await tab.evaluate(() => { const q = document.getElementById('game').getBoundingClientRect(); return { x: Math.max(0, q.x), y: Math.max(0, q.y), width: Math.min(q.width, innerWidth), height: Math.min(q.height, innerHeight) }; });
    const png = await tab.screenshot({ clip });
    await fs.mkdir('./artifacts', { recursive: true });
    await fs.writeFile('./artifacts/' + n + '.png', png);
    console.log('SHOTFILE:' + path.resolve('./artifacts/' + n + '.png'));
  }
  const errs = await tab.evaluate(async () => { await D.fresh(); return D.take(); });
  ${body}
  const e2 = await tab.evaluate(() => D.take());
  if (errs.length || e2.length) console.log('FAIL ' + errs.concat(e2).join(' | '));
  console.log('PASS');
} finally { await closeTab(tab); }
}`;

for (const [w, h] of [[1920, 1080], [1366, 768], [390, 844]]) {
  step(`게임 방법 ${w}×${h}`, shotJs(w, h, 'howto', `
  await snap('howto-${w}-title');
  await tab.evaluate(() => { D.tapSel('[data-go="howto"]', '게임 방법'); });
  await snap('howto-${w}-open');
  await tab.evaluate(() => { const b = D.$('.howto-body'); if (b) b.scrollTop = b.scrollHeight; });
  await snap('howto-${w}-open-end');
  await tab.evaluate(() => { D.tapSel('.howto-tab[data-sea="vowel"]', '모음 탭'); D.$('.howto-body').scrollTop = 0; });
  await snap('howto-${w}-vowel');
  await tab.evaluate(() => { D.tapSel('.howto-ok', '알겠어요'); });
  await snap('howto-${w}-title-after');
  `));
}
for (const [w, h] of [[1920, 1080], [1366, 768]]) {
  step(`대결 위 띠 ${w}×${h}`, shotJs(w, h, 'duel', `
  await tab.evaluate(async () => {
    D.goTitleBtn('duel');
    await D.until(() => D.cur() === 'duel', 4000, '대결 준비');
    await D.wait(300);
  });
  await snap('howto-${w}-duel-setup');
  await tab.evaluate(async () => { D.tapSel('.duel-start', '시작'); await D.until(() => D.du() && D.du().screen() === 'play', 6000, '대결 판'); await D.wait(500); });
  await snap('howto-${w}-duel-play');
  `));
}
step('연습 판 윗줄 390×844', shotJs(390, 844, 'pr', `
  await tab.evaluate(async () => {
    D.G().save.setSeenExample(true);
    D.goTitleBtn('practice');
    await D.until(() => D.cur() === 'practice' && D.pr().view === 'setup', 4000, '연습 준비');
  });
  await snap('howto-390-practice-setup');
  await tab.evaluate(async () => { D.tapSel('.pr-start', '시작'); await D.until(() => D.pr().view === 'play', 4000, '판'); await D.wait(400); });
  await snap('howto-390-practice-play');
  await tab.evaluate(() => { D.tapSel('.pr-howto.is-top', '게임 방법(판)'); });
  await snap('howto-390-practice-open');
`));
