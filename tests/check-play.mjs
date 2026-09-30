// 학생처럼 끝까지 풀기(spec 10-2) — 진짜 index.html을 크기별 틀에 띄우고 진짜 단추를 눌러 시작 → 준비 → 판 → 결과까지(aside).
//   연습(가로 1920×1080 틀 · 휴대폰 세로 390×844 틀 각각):
//     자음 1단계(처음 쓰는 기기라 풀이 예시가 저절로 → 이어서 일반 판, 이번 바다에 없는 칸 · 이미 쏜 소리 · 없는 소리 · 모두 찾음)
//       → 결과 화면에서 새로고침해도 누적 소리 지도에 두 번 더해지지 않음
//     자음 2단계(없는 소리 · 두 발 뒤 새로고침 → '하던 판 이어서 하기'로 판 그대로 → 끝까지) · 자음 3단계
//     모음 1단계(모두 찾음) · 모음 2단계(턴 소진 → 남은 배 공개 → '찾지 못한 배가 있어요')
//   대결(가로 1920×1080 틀):
//     무작위 배치 — 두 팀이 서로 다른 손가락으로 동시에 발사, 도중 새로고침 → 이어서 하기, 청팀이 먼저 다 찾아 승 →
//       결과 화면 새로고침(누적 지도 한 번만)
//     숨기기 시간 — 가림 → 청팀 직접 배치(다 놓으면 저절로) → 가림 → 홍팀 한 척 놓고 '다 놓았어요'(남은 배는 게임이) →
//       가림 → 두 팀 모두 발을 다 씀 → 맞힌 칸이 많은 팀 승
//   모든 조각에서 게임 창의 페이지 오류(window.__soriErrors) 0.
//   숨은 함대는 점검 도구만 디버그 창구(G.practice.debug · G.duel.current.debug)에서 읽는다. 누르기는 모두 진짜 단추·단면도.
//   aside 한 번은 120초 안 → 판 몇 개씩 조각으로 나눈다. 주소는 BASE 환경 변수로 바꿀 수 있다(run-all.mjs).
import { step, frame } from './aside.mjs';
import { DRIVER } from './lib/drive.mjs';

const J = JSON.stringify;

// 한 조각의 뼈대: 틀을 열고 운전 도구를 심은 뒤 body를 돌린다. body 안에서 bad.push(...)로 실패를 모은다
const wrap = (w, h, body) => `{
const bad = [];
const tab = await openTab(${J(frame(w, h, 'index.html'))});
try {
  await tab.evaluate(() => frameReady);
  await tab.evaluate(() => { ${DRIVER} });
  const E = async (fn, arg) => { const r = await tab.evaluate(fn, arg); if (Array.isArray(r)) bad.push(...r); return r; };
  ${PRGAME}
  ${body}
} catch (e) { bad.push('예외: ' + (e && (e.stack || e.message) || e)); }
finally { await closeTab(tab); }
if (bad.length) console.log('FAIL ' + bad.join('\\nFAIL '));
else console.log('PASS');
}`;

// 연습 한 판(대본 쪽 함수). o = { tag, grade, sea, level, kind, example, from: 'title'|'setup' }
const PRGAME = `
async function prGame(o) {
  const n0 = bad.length;
  await E(async (o) => {
    if (D.cur() === 'title') D.goTitleBtn('practice');
    await D.until(() => D.cur() === 'practice' && D.pr().view === 'setup', 5000, '연습 준비 화면');
    D.prChoose(o.grade, o.sea, o.level);
    D.tapSel('.pr-start', '시작');
    return D.take();
  }, o);
  if (o.example) {
    await E(async (o) => {
      const G = D.G(), TX = D.T();
      await D.until(() => D.pr().view === 'example', 4000, '처음 시작한 자음 1단계인데 풀이 예시가 저절로 안 나옴');
      const lines = [];
      const t0 = Date.now();
      while (D.pr().view === 'example' && Date.now() - t0 < 25000) {
        const m = D.msgOf();
        if (m && lines[lines.length - 1] !== m) lines.push(m);
        if (D.$('.ctl-fire') && !D.$('.ctl-fire').disabled) D.bad('풀이 예시 도중 발사 단추가 켜짐');
        await D.wait(40);
      }
      [0, 1, 2].forEach((i) => { const w = G.text.exampleLine(o.grade, i); if (lines.indexOf(w) < 0) D.bad('풀이 예시 ' + (i + 1) + '번째 줄이 안 나옴: ' + w); });
      await D.until(() => D.pr().view === 'play' && !D.pr().busy, 5000, '풀이 예시 뒤 일반 판');
      if (D.msgOf() !== TX.example.end) D.bad('풀이 예시 뒤 첫 줄: ' + D.msgOf());
      if (!G.save.seenExample()) D.bad('풀이 예시를 본 기록이 안 남음');
      return D.take();
    }, o);
  }
  await E(async (o) => {
    const G = D.G();
    await D.until(() => D.pr().view === 'play' && !D.pr().busy, 5000, '판 시작');
    const st = D.prSt(), lv = G.rules.level(o.sea, o.level);
    if (!st || st.grade !== o.grade || st.sea !== o.sea || st.level !== o.level) D.bad('시작한 판이 고른 것과 다름 ' + JSON.stringify(st && [st.grade, st.sea, st.level]));
    if (D.turnsLeft() !== lv.turns) D.bad('처음 남은 턴 ' + D.turnsLeft() + ' ≠ ' + lv.turns);
    if (!G.save.hasGame() || G.save.loadGame().id !== st.id) D.bad('새 판이 곧바로 저장되지 않음');
    if (D.pr().layout !== o.layout) D.bad('배치가 ' + D.pr().layout + ' (기대 ' + o.layout + ')');
    D.plan = D.prPlan(o.kind); D.shotLog = []; D.mapBefore = D.mapCount(o.sea); D.gameId = st.id;
    return D.take();
  }, o);
  for (let i = 0; i < 12; i++) {
    const r = await tab.evaluate(async () => { const s = await D.prRun(18000); if (s === 'end') D.usedTurns = D.prShots().length; return { s, e: D.take() }; });
    bad.push(...r.e);
    if (r.s === 'end') break;
    if (r.s === 'reload') {
      // 판 도중 새로고침 → 시작 화면에서 '하던 판이 있어요' → 이어서 하기 → 판 그대로
      await E(async (o) => {
        const G0 = D.G();
        const before = { id: D.prSt().id, shots: JSON.stringify(D.prShots()), turns: D.turnsLeft(), marks: D.$$('.sb .sb-mark').length };
        await D.reload();
        const TX = D.T();
        if (D.cur() !== 'title') D.bad('새로고침 뒤 시작 화면이 아님: ' + D.cur());
        const dlg = D.$('.app-dialog');
        if (!dlg || D.$('.app-dialog-ask', dlg).textContent !== TX.ui.resume.ask) D.bad('새로고침 뒤 하던 판을 묻지 않음');
        else if (D.$('.app-dialog-what', dlg).textContent.indexOf(TX.seaNames[o.sea]) < 0) D.bad('묻는 창에 어떤 판인지 안 보임');
        D.tapSel('[data-act="resume"]', "'하던 판 이어서 하기'");
        await D.until(() => D.cur() === 'practice' && D.pr().view === 'play' && !D.pr().busy, 6000, '이어서 하기');
        await D.wait(300);
        if (D.prSt().id !== before.id) D.bad('이어 한 판의 id가 다름');
        if (JSON.stringify(D.prShots()) !== before.shots) D.bad('이어 한 판의 쏜 기록이 다름');
        if (D.turnsLeft() !== before.turns) D.bad('이어 한 판의 남은 턴 ' + D.turnsLeft() + ' ≠ ' + before.turns);
        if (D.$$('.sb .sb-mark').length !== before.marks) D.bad('이어 한 판의 판 표시 수 ' + D.$$('.sb .sb-mark').length + ' ≠ ' + before.marks);
        return D.take();
      }, o);
    }
  }
  await E(async (o) => {
    const G = D.G();
    await D.until(() => D.cur() === 'result', 9000, '결과 화면');
    D.checkResult({ success: o.kind !== 'v2', turns: D.usedTurns });
    if (o.kind === 'v2' && D.$$('.app-res-map .sb').length !== 1) D.bad('턴 소진 결과의 소리 지도');
    if (D.mapCount(o.sea) !== D.mapBefore + 1) D.bad('누적 소리 지도에 이번 판이 한 번 더해지지 않음: ' + D.mapBefore + ' → ' + D.mapCount(o.sea));
    if (D.G().audio.state().track !== 'result') D.bad('결과 화면 배경 음악: ' + D.G().audio.state().track);
    return D.take();
  }, o);
  const info = await tab.evaluate(() => ({ shots: D.shotLog, turns: D.usedTurns, screen: D.cur() }));
  console.log('INFO ' + o.tag + ' ' + JSON.stringify(info));
  for (let k = n0; k < bad.length; k++) bad[k] = o.tag + ' ' + bad[k];
}
// 결과 화면에서 새로고침 → 시작 화면, 누적 지도는 그대로(한 판은 한 번만)
async function resultReload(sea) {
  await E(async (sea) => {
    const G = D.G();
    if (D.cur() !== 'result') D.bad('결과 화면이 아닌데 결과 새로고침 점검');
    const c = D.mapCount(sea), ids = JSON.stringify(G.save.soundMap(sea));
    await D.reload();
    if (D.cur() !== 'title') D.bad('결과 화면에서 새로고침 → ' + D.cur());
    if (D.$('.app-dialog')) D.bad('결과 화면에서 새로고침했는데 하던 판을 물음');
    if (D.mapCount(sea) !== c || JSON.stringify(D.G().save.soundMap(sea)) !== ids) D.bad('결과 화면 새로고침으로 누적 지도가 바뀜 ' + c + ' → ' + D.mapCount(sea));
    return D.take();
  }, sea);
}
async function toSetup(how) {
  await E(async (how) => {
    if (how === 'again') D.tapSel('[data-act="again"]', "결과 '한 판 더'");
    else D.tapSel('[data-act="home"]', "결과 '처음으로'");
    await D.until(() => (how === 'again' ? D.cur() === 'practice' : D.cur() === 'title'), 4000, how);
    return D.take();
  }, how);
}
`;

// ── 연습(가로 · 휴대폰 세로) ────────────────────────────────────────────
const practice = (w, h, layout, name) => {
  const g = (tag, grade, sea, level, kind, extra) => J(Object.assign({ tag, grade, sea, level, kind, layout }, extra || {}));
  step(`${name}: 자음 1단계(처음이라 풀이 예시) → 결과 → 결과 화면 새로고침`, wrap(w, h, `
    await E(async () => { await D.fresh(); if (D.cur() !== 'title') D.bad('처음 화면이 시작 화면이 아님'); return D.take(); });
    await prGame(${g('[자음1]', 'm3', 'consonant', 1, 'c1', { example: true })});
    await resultReload('consonant');
  `));
  step(`${name}: 자음 2단계(도중 새로고침 → 이어서 하기) · 자음 3단계`, wrap(w, h, `
    await E(async () => { await D.fresh(); return D.take(); });
    await prGame(${g('[자음2]', 'h1', 'consonant', 2, 'c2')});
    await toSetup('again');
    await prGame(${g('[자음3]', 'h1', 'consonant', 3, 'c3')});
  `));
  step(`${name}: 모음 1단계(모두 찾음) · 모음 2단계(턴 소진)`, wrap(w, h, `
    await E(async () => { await D.fresh(); return D.take(); });
    await prGame(${g('[모음1]', 'm3', 'vowel', 1, 'v1')});
    await toSetup('home');
    await prGame(${g('[모음2]', 'h1', 'vowel', 2, 'v2')});
  `));
};
practice(1920, 1080, 'landscape', '연습 가로 1920×1080');
practice(390, 844, 'portrait', '연습 휴대폰 세로 390×844');

// ── 대결: 무작위 배치 ───────────────────────────────────────────────────
step('대결 무작위 배치: 두 팀 동시 발사 · 도중 새로고침 → 이어서 하기 · 청팀 승 → 결과 새로고침', wrap(1920, 1080, `
  await E(async () => {
    await D.fresh();
    D.goTitleBtn('duel');
    await D.until(() => D.cur() === 'duel' && D.du().screen() === 'setup', 5000, '대결 준비 화면');
    D.duChoose({ grade: 'm3', sea: 'consonant', level: 1, hideTime: false });
    D.tapSel('.duel-start', '대결 시작');
    await D.until(() => D.du().screen() === 'play', 4000, '무작위 배치 → 곧바로 대결');
    const TX = D.T();
    for (const t of ['blue', 'red']) {
      const s = D.station(t);
      if (!s || !D.visible(s)) { D.bad(t + ' 자리가 없음'); continue; }
      if (D.duMsg(t) !== TX.duel.shout) D.bad(t + ' 기본 줄: ' + D.duMsg(t));
    }
    D.mapBefore = D.mapCount('consonant');
    const G = D.G(), open = G.rules.level('consonant', 1).open;
    D.blueList = D.duFleet('red');                                          // 청팀은 홍팀 배를 모두 찾는다
    D.redList = open.filter((id) => D.duFleet('blue').indexOf(id) < 0);     // 홍팀은 빗나가기만
    return D.take();
  });
  // 두 발씩 동시에
  await E(async () => {
    for (let i = 0; i < 2; i++) await D.fireBoth(D.blueList[i], D.redList[i]);
    if (D.duShots('blue') !== 2 || D.duShots('red') !== 2) D.bad('동시 발사 두 번 뒤 쏜 수 ' + D.duShots('blue') + '/' + D.duShots('red'));
    return D.take();
  });
  // 도중 새로고침 → 이어서 하기
  await E(async () => {
    const before = JSON.stringify(D.duSt().teams.blue.shots) + JSON.stringify(D.duSt().teams.red.shots);
    const id = D.duSt().id;
    await D.reload();
    const TX = D.T();
    const dlg = D.$('.app-dialog');
    if (!dlg || D.$('.app-dialog-what', dlg).textContent.indexOf(TX.ui.menu.duel) < 0) D.bad('새로고침 뒤 하던 대결을 묻지 않음');
    D.tapSel('[data-act="resume"]', "'하던 판 이어서 하기'(대결)");
    await D.until(() => D.cur() === 'duel' && D.du().screen() === 'play', 5000, '대결 이어서 하기');
    await D.wait(300);
    if (D.duSt().id !== id) D.bad('이어 한 대결의 id가 다름');
    if (JSON.stringify(D.duSt().teams.blue.shots) + JSON.stringify(D.duSt().teams.red.shots) !== before) D.bad('이어 한 대결의 쏜 기록이 다름');
    const left = D.$$('.duel-shots').map((e) => e.textContent).join('|');
    const want = [6, 6].map((n) => D.G().text.fill(TX.duel.shotsLeft, { n })).join('|');
    if (left !== want) D.bad('이어 한 대결의 남은 발: ' + left);
    return D.take();
  });
  await E(async () => {
    for (let i = 2; i < D.blueList.length && D.du().phase() === 'play'; i++) await D.fireBoth(D.blueList[i], D.redList[i]);
    await D.until(() => D.du().phase() === 'over', 3000, '청팀이 다 찾음 → 판 끝');
    await D.until(() => D.cur() === 'result', 9000, '대결 결과 화면');
    D.checkResult({ duel: true, winner: 'blue' });
    if (D.mapCount('consonant') !== D.mapBefore + 1) D.bad('대결이 누적 지도에 한 번 더해지지 않음');
    return D.take();
  });
  console.log('INFO [대결 무작위] ' + JSON.stringify(await tab.evaluate(() => ({ head: (D.$('.app-res-headline') || {}).textContent, stats: D.$$('.app-res-stats').map((e) => e.textContent) }))));
  await resultReload('consonant');
`));

// ── 대결: 숨기기 시간 ───────────────────────────────────────────────────
step('대결 숨기기 시간: 가림 → 청팀 배치 → 홍팀 일부 배치(나머지는 게임이) → 두 팀 발 소진 → 결과', wrap(1920, 1080, `
  await E(async () => {
    await D.fresh();
    D.goTitleBtn('duel');
    await D.until(() => D.cur() === 'duel' && D.du().screen() === 'setup', 5000, '대결 준비 화면');
    D.duChoose({ grade: 'h1', sea: 'vowel', level: 1, hideTime: true });
    D.tapSel('.duel-start', '대결 시작');
    const TX = D.T();
    await D.until(() => D.du().screen() === 'gate', 3000, '가림 화면(청)');
    if (D.$('.duel-gate-text').textContent !== TX.duel.gate.blue) D.bad('청팀 가림 문구: ' + D.$('.duel-gate-text').textContent);
    D.tapSel('.duel-gate-go', '가림 화면 단추(청)');
    await D.until(() => D.du().screen() === 'placing', 3000, '청팀 배치');
    // 청팀: 놓을 수 있는 묶음을 차례로 눌러 세 척 다 → 저절로 다음
    for (let k = 0; k < 6 && D.du().screen() === 'placing'; k++) {
      const c = D.$('.duel-place-sea button.sb-cell.is-can:not([disabled])');
      if (!c) break;
      D.tap(c, '배치 칸');
      const ch = D.$('.sb-chooser .sb-choice');
      if (ch) D.tap(ch, '배치 묶음 고르기');
      await D.wait(120);
    }
    if (D.duSt().teams.blue.fleet.length !== 3) D.bad('청팀이 배 세 척을 다 놓지 못함: ' + D.duSt().teams.blue.fleet.length);
    await D.until(() => D.du().screen() === 'gate', 4000, '청팀 다 놓음 → 가림 화면(홍)');
    if (D.$('.duel-gate-text').textContent !== TX.duel.gate.red) D.bad('홍팀 가림 문구');
    D.tapSel('.duel-gate-go', '가림 화면 단추(홍)');
    await D.until(() => D.du().screen() === 'placing', 3000, '홍팀 배치');
    D.tap(D.$('.duel-place-sea button.sb-cell.is-can:not([disabled])'), '홍팀 첫 배 칸');
    await D.wait(120);
    D.tapSel('.duel-done', "'다 놓았어요'");
    await D.until(() => D.$('.duel-line') && D.$('.duel-line').textContent === TX.duel.hide.autoFilled, 2000, "'남은 배는 게임이 대신 숨겼어요'");
    await D.until(() => D.du().screen() === 'gate', 4000, '가림 화면(다 숨김)');
    if (D.duSt().teams.red.fleet.length !== 3) D.bad('홍팀 남은 배가 채워지지 않음');
    if (D.$('.duel-gate-text').textContent !== TX.duel.gate.allDone) D.bad('다 숨김 가림 문구');
    D.tapSel('.duel-gate-go', '가림 화면 단추(다 숨김)');
    await D.until(() => D.du().screen() === 'play', 3000, '대결 시작');
    // 청팀: 홍팀 배 세 칸 + 배 아닌 소리 넷 + 없는 소리 하나 / 홍팀: 청팀 배 두 칸 + 배 아닌 소리 넷 + 없는 소리 둘 → 두 팀 8발 소진, 청팀 승
    const all = D.G().rules.level('vowel', 1).open;
    const rf = D.duFleet('red'), bf = D.duFleet('blue');
    const noneA = { backness: 'front', height: 'low', lips: 'rounded' }, noneB = { backness: 'back', height: 'low', lips: 'rounded' };
    D.blueList = rf.slice(0, 3).concat(all.filter((x) => rf.indexOf(x) < 0).slice(0, 4), [noneA]);
    D.redList = bf.slice(0, 2).concat(all.filter((x) => bf.indexOf(x) < 0).slice(0, 4), [noneA, noneB]);
    D.mapBefore = D.mapCount('vowel');
    return D.take();
  });
  await E(async () => {
    for (let i = 0; i < 4; i++) await D.fireBoth(D.blueList[i], D.redList[i]);
    return D.take();
  });
  await E(async () => {
    const TX = D.T();
    for (let i = 4; i < 8; i++) await D.fireBoth(D.blueList[i], D.redList[i]);
    if (D.duShots('blue') + D.duShots('red') !== 16 && D.du().phase() === 'play') D.bad('두 팀이 8발씩 쏘지 못함 ' + D.duShots('blue') + '/' + D.duShots('red'));
    await D.until(() => D.du().phase() === 'over', 3000, '두 팀 발 소진 → 판 끝');
    await D.until(() => D.cur() === 'result', 9000, '대결 결과 화면');
    D.checkResult({ duel: true, winner: 'blue' });
    const shots = D.$$('.app-res-stats dd[data-k="turns"]').map((e) => e.textContent).join('|');
    const want = [8, 8].map((n) => D.G().text.fill(TX.ui.result.shotsN, { n })).join('|');
    if (shots !== want) D.bad('대결 결과의 쏜 발: ' + shots);
    if (D.mapCount('vowel') !== D.mapBefore + 1) D.bad('대결이 누적 지도에 한 번 더해지지 않음');
    return D.take();
  });
  console.log('INFO [대결 숨기기] ' + JSON.stringify(await tab.evaluate(() => ({ head: (D.$('.app-res-headline') || {}).textContent, stats: D.$$('.app-res-stats').map((e) => e.textContent) }))));
`));
