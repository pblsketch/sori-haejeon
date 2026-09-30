// 대결 모드 화면 G.duel 점검(aside). 점검용 페이지 tests/pages/duel.html(진짜 스크립트 + G.app 흉내)에서 돈다.
//   1) 무작위 배치 한 판을 끝까지: 준비 화면 고르기·기억, 16:9 배치(왼쪽 = 홍팀 바다), 청팀부터 번갈아,
//      턴을 쓰지 않는 결과(없는 칸·이미 쏜 소리)면 차례 유지, 1단계 '따라 해 보기', 선공이 먼저 다 찾으면 후공의
//      마지막 한 발(한 줄 알림), 두 바다 남은 배 공개 → G.app.finishGame(청팀 승), 진행 판 지워짐
//   2) 마지막 한 발로 후공도 다 찾음 → 무승부(모음 바다)
//   3) 숨기기 시간: 가림 화면(청) → 청팀 배치(그 팀 바다만, 소리·줄 이름 보임, 큰 배부터, 놓을 수 있는 묶음만,
//      '다 놓았어요'로 일찍 끝 → 남은 배 채움) → 가림(홍) → 홍팀 배치(짧게 줄인 시간 초과 → 채움) → 가림(다 숨김) → 대결
//   4) 배치 도중 새로고침 → 숨기기 단계를 청팀부터 다시
//   5) 대결 도중 새로고침 → 이어서 하기가 판·기록장·차례를 그대로 되살림
//   6) 휴대폰 세로 390×844 · 눕힌 휴대폰 844×390 틀: 대결 안내 한 줄과 '처음으로'
//   7) 칠판 1920×1080 · 노트북 1366×768 상자에서 대결 화면이 넘치지 않고 조작부 64px 이상 — 캡처(tests/shots/)
//   모든 단계에서 window.__soriErrors가 비어 있어야 한다.
import { step, url, frame } from './aside.mjs';

const PAGE = url('tests/pages/duel.html');
const FAST = PAGE + '?manual=1&rm=1';
let seq = 0;

// 여러 탭을 차례로 열어(새로고침 대신) 함수들을 돌린다. 앞 단계가 돌려준 pass 값을 다음 단계가 받는다.
//   phases: [{ url, fn, shot?: { name, wait } }]   fn은 페이지 안에서 도는 함수 → { fails, errs, pass?, info? }
function flow(label, phases) {
  const v = 'd' + (++seq);
  let code = `{\nlet ${v}pass = null, ${v}bad = [];\n`;
  phases.forEach((ph, i) => {
    const t = `${v}t${i}`, r = `${v}r${i}`;
    code += `
if (!${v}bad.length) {
  const ${t} = await openTab(${JSON.stringify(ph.url)});
  try {
    const ${r} = await ${t}.evaluate(${ph.fn.toString()}, ${v}pass);
    ${v}pass = ${r}.pass == null ? null : ${r}.pass;
    if (${r}.info) console.log('INFO ${i} ' + JSON.stringify(${r}.info));
    (${r}.errs || []).forEach((e) => ${v}bad.push('페이지 오류(${i}): ' + e));
    (${r}.fails || []).forEach((e) => ${v}bad.push('(${i}) ' + e));
    ${ph.shot ? `
    await sleep(${ph.shot.wait || 600});
    await fs.mkdir('./artifacts', { recursive: true });
    await fs.writeFile('./artifacts/${ph.shot.name}.png', await ${t}.screenshot());
    console.log('SHOTFILE:' + path.resolve('./artifacts/${ph.shot.name}.png'));` : ''}
  } catch (${v}x${i}) { ${v}bad.push('예외(${i}): ' + (${v}x${i} && ${v}x${i}.stack || ${v}x${i})); }
  finally { await closeTab(${t}); }
}
`;
  });
  code += `if (${v}bad.length) console.log('FAIL ' + ${v}bad.join('\\nFAIL '));\nelse console.log('PASS');\n}\n`;
  return step(label, code);
}

// ── 1) 무작위 배치 한 판(청팀 승, 공평한 마지막 한 발) ─────────────────
async function randomBlueWins() {
  const fails = [], F = (m) => fails.push(m);
  try { localStorage.clear(); } catch (e) { /* 막힘 */ }
  G.duel.config.endDelay = 500;
  const h = G.duel.open({});
  if (DT.screen() !== 'setup') F('처음 화면이 준비 화면이 아님: ' + DT.screen());
  if (!DT.opt('grade', 'm3').classList.contains('is-on') || !DT.opt('hideTime', 'false').classList.contains('is-on')) F('준비 화면 기본값이 아님');
  if (!DT.opt('level', '3') || DT.opt('level', '1').querySelector('.duel-opt-sub').textContent !== TEXT.levelNames.consonant[1]) F('자음 단계 단추');
  DT.opt('sea', 'vowel').click();
  if (DT.opt('level', '3')) F('모음 바다인데 3단계가 있음');
  DT.setup({ grade: 'h1', sea: 'consonant', level: 1, hideTime: false });
  const sel = G.save.getSelection();
  if (sel.grade !== 'h1' || sel.sea !== 'consonant' || sel.level !== 1 || sel.hideTime !== false) F('선택을 기억하지 않음 ' + JSON.stringify(sel));
  if (DT.screen() !== 'play') F('무작위 배치인데 대결 화면이 아님: ' + DT.screen());
  const st0 = DT.st();
  if (!st0.id) F('판 id 없음');
  if (st0.grade !== 'h1' || st0.level !== 1 || st0.hideTime) F('판 설정 ' + JSON.stringify([st0.grade, st0.level, st0.hideTime]));
  if (!G.save.hasGame() || G.save.loadGame().id !== st0.id) F('시작하자마자 저장되지 않음');
  if (document.querySelectorAll('.duel-play .sb').length !== 2) F('바다가 둘이 아님');
  if (document.querySelectorAll('.duel-play .mouth-svg').length !== 1) F('단면도가 하나가 아님');
  if (!document.querySelector('.sea-left .duel-sea-name').textContent.includes(TEXT.teams.red)) F('왼쪽이 홍팀 바다가 아님');
  if (!document.querySelector('.sea-right .duel-sea-name').textContent.includes(TEXT.teams.blue)) F('오른쪽이 청팀 바다가 아님');
  const top = [...document.querySelectorAll('.duel-top > *')].map((e) => e.className);
  if (!/side-blue/.test(top[0]) || !/duel-center/.test(top[1]) || !/side-red/.test(top[2])) F('위 띠 순서 ' + top.join(' | '));
  if (!document.querySelector('.duel-title') || document.querySelector('.duel-title').textContent !== TEXT.ui.title) F('제목');
  if (document.querySelectorAll('.duel-dock .ctl').length !== 1) F('조작부가 아래에 하나가 아님');
  if (DT.active() !== 'blue') F('처음 차례 테두리: ' + DT.active());
  if (DT.turnText() !== TEXT.duel.turn.blue) F('처음 차례 줄: ' + DT.turnText());
  if (DT.msg() !== TEXT.duel.shout) F('기본 줄이 "소리 내어 외치고 발사!"가 아님: ' + DT.msg());
  // 1단계 '따라 해 보기'(소리를 빚는 동안 한 줄)
  h.debug.ctl.setSelection(G.rules.inputOf('ㅁ'));
  if (DT.msgKind() !== 'follow' || DT.msg() !== G.text.follow('ㅁ')) F('1단계 따라 해 보기 줄: ' + DT.msg());
  if (document.querySelector('.mouth-svg').dataset.place !== 'bilabial') F('조작부 고름이 단면도에 안 비침');
  h.debug.ctl.reset();

  const red = DT.fleetIds('red'), blue = DT.fleetIds('blue');
  const miss = G.rules.level('consonant', 1).open.filter((id) => blue.indexOf(id) < 0);
  // 턴을 쓰지 않는 결과: 이번 바다에 없는 칸(/ㅎ/)
  await DT.fire('ㅎ');
  if (G.rules.whoseTurn(DT.st()) !== 'blue' || DT.st().teams.blue.shots.length !== 0) F('없는 칸인데 턴을 씀');
  if (DT.msg() !== TEXT.signal.notInSea) F('없는 칸 줄: ' + DT.msg());
  if (DT.active() !== 'blue' || DT.turnText() !== TEXT.duel.turn.blue) F('없는 칸 뒤 차례가 바뀜');
  // 청 명중 → 홍 차례
  await DT.fire(red[0]);
  if (DT.st().teams.blue.shots[0].kind !== 'hit') F('청 첫 발이 명중이 아님');
  if (DT.active() !== 'red' || DT.turnText() !== TEXT.duel.turn.red) F('한 발 뒤 차례가 홍으로 안 넘어감');
  const sv = G.save.loadGame();
  if (!sv || sv.teams.blue.shots.length !== 1) F('발사 뒤 저장 안 됨');
  // 홍: 국어에 없는 소리(목청 + 파열) → 턴을 씀
  await DT.fire({ place: 'glottal', manner: 'stop', strength: null });
  if (DT.st().teams.red.shots.length !== 1 || DT.st().teams.red.shots[0].kind !== 'none') F('없는 소리가 턴을 쓴 none이 아님');
  if (DT.msg() !== TEXT.signal.none) F('없는 소리 줄: ' + DT.msg());
  // 청: 이미 쏜 소리 → 차례 유지
  await DT.fire(red[0]);
  if (G.rules.whoseTurn(DT.st()) !== 'blue' || DT.st().teams.blue.shots.length !== 1) F('이미 쏜 소리인데 턴을 씀');
  if (DT.msg() !== TEXT.signal.already) F('이미 쏜 소리 줄: ' + DT.msg());
  // 청이 남은 배를 다 찾고, 홍은 못 찾음
  let mi = 0;
  for (let i = 1; i < red.length; i++) {
    await DT.fire(red[i]);
    if (i < red.length - 1) await DT.fire(miss[mi++]);
  }
  const st1 = DT.st();
  if (st1.phase !== 'playing') F('청이 먼저 다 찾았는데 판이 끝남(마지막 한 발 없음)');
  if (!G.rules.isLastShot(st1)) F('마지막 한 발 차례가 아님');
  if (DT.turnText() !== TEXT.duel.lastShot) F('마지막 한 발 줄: ' + DT.turnText());
  if (DT.active() !== 'red') F('마지막 한 발 테두리: ' + DT.active());
  if (document.querySelectorAll('.side-blue .sb-ship-item.is-sunk').length !== st1.teams.red.fleet.length) F('위 띠 청팀 쪽 격침 목록');
  if (!st1.teams.blue.shots.some((s) => s.sunk) || !/찾았어요/.test(DT.msg())) F('마지막 격침 줄: ' + DT.msg());
  await DT.fire(miss[mi++]);
  const st2 = DT.st();
  if (st2.phase !== 'over' || !st2.result || st2.result.winner !== 'blue' || st2.result.reason !== 'blue-first') F('결과: ' + JSON.stringify(st2.result));
  if (DT.screen() !== 'over') F('끝 화면 아님: ' + DT.screen());
  const rev = document.querySelectorAll('.sea-right .k-reveal').length;
  if (rev !== blue.length) F('청팀 바다 남은 배 공개 칸 ' + rev + ' / ' + blue.length);
  if (document.querySelectorAll('.sea-left .k-reveal').length !== 0) F('다 찾은 바다에 공개 칸이 있음');
  if (DT.turnText() !== TEXT.ui.result.winner.blue) F('끝 줄: ' + DT.turnText());
  if (DT.active()) F('끝났는데 테두리가 남음');
  if (!document.querySelector('.ctl-fire').disabled) F('끝났는데 발사 단추가 켜짐');
  if (window.__finished) F('공개를 보여 주기 전에 결과로 감');
  const fin = await DT.until(() => window.__finished, 4000);
  if (!fin) F('finishGame이 불리지 않음');
  else {
    if (!fin.result || fin.result.winner !== 'blue') F('finishGame 승자 ' + JSON.stringify(fin.result));
    if (fin.id !== st0.id) F('finishGame 판 id');
    if (G.rules.makeRecord(fin).teams.blue.hitSounds.length !== red.length) F('판 기록 명중 수');
  }
  await DT.wait(200);
  if (window.__finishedCount !== 1) F('finishGame 횟수 ' + window.__finishedCount);
  if (G.save.hasGame()) F('끝난 판이 진행 판으로 남음');
  if (DT.logCount() !== st2.teams.blue.shots.length + st2.teams.red.shots.length) F('신호 기록장 줄 수 ' + DT.logCount());
  // '처음으로'
  document.querySelector('.duel-home').click();
  if (window.__went.indexOf('title') < 0) F('처음으로가 시작 화면을 부르지 않음');
  h.destroy();
  if (document.querySelector('.duel')) F('destroy 뒤 화면이 남음');
  if (G.duel.current) F('destroy 뒤 current가 남음');
  return { fails, errs: window.__soriErrors.slice() };
}

// ── 2) 마지막 한 발로 무승부(모음 바다 1단계) ─────────────────────────
async function vowelLastShotDraw() {
  const fails = [], F = (m) => fails.push(m);
  try { localStorage.clear(); } catch (e) { /* 막힘 */ }
  G.duel.config.endDelay = 300;
  G.duel.open({});
  DT.setup({ grade: 'm3', sea: 'vowel', level: 1, hideTime: false });
  if (document.querySelector('.mouth-svg').dataset.sea !== 'vowel') F('모음 단면도가 아님');
  const red = DT.fleetIds('red'), blue = DT.fleetIds('blue');
  for (let i = 0; i < red.length; i++) {
    await DT.fire(red[i]);
    if (i < red.length - 1) await DT.fire(blue[i]);
  }
  const st1 = DT.st();
  if (!G.rules.isLastShot(st1) || DT.turnText() !== TEXT.duel.lastShot) F('마지막 한 발 아님: ' + DT.turnText());
  await DT.fire(blue[blue.length - 1]);
  const st2 = DT.st();
  if (!st2.result || st2.result.winner !== null || st2.result.reason !== 'last-shot-draw') F('무승부 아님 ' + JSON.stringify(st2.result));
  if (DT.turnText() !== TEXT.ui.result.winner.draw) F('무승부 줄: ' + DT.turnText());
  const fin = await DT.until(() => window.__finished, 3000);
  if (!fin || fin.result.winner !== null) F('finishGame 무승부 아님');
  return { fails, errs: window.__soriErrors.slice() };
}

// ── 3) 숨기기 시간 ────────────────────────────────────────────────────
async function hidePlacement() {
  const fails = [], F = (m) => fails.push(m);
  try { localStorage.clear(); } catch (e) { /* 막힘 */ }
  Object.assign(G.duel.config, { placeSeconds: 30, autoFillShow: 300, fullDelay: 200 });
  G.duel.open({});
  DT.setup({ grade: 'm3', sea: 'consonant', level: 2, hideTime: true });
  const lv = G.rules.level('consonant', 2);
  const gateText = () => document.querySelector('.duel-gate-text').textContent;
  if (DT.screen() !== 'gate' || gateText() !== TEXT.duel.gate.blue) F('첫 가림 화면: ' + DT.screen());
  if (document.querySelector('.duel-gate-go').textContent !== TEXT.duel.gate.button) F('가림 단추 글');
  if (document.querySelector('.sb')) F('가림 화면에 바다가 보임');
  let sv = G.save.loadGame();
  if (!sv || sv.phase !== 'placing' || sv.placingTeam !== 'blue') F('배치 시작 판이 저장되지 않음');
  // 판의 한 칸에 든 소리들
  const idsIn = (cell) => [...cell.querySelectorAll('.sb-snd')].map((e) => e.textContent.replace(/\//g, ''));
  // 놓을 수 있는 묶음의 칸만 눌림
  const checkCan = (tag) => {
    const groups = G.rules.placeableGroups(lv, DT.st().teams[DT.st().placingTeam].fleet);
    const want = new Set([].concat.apply([], groups));
    document.querySelectorAll('.sb-cell').forEach((c) => {
      const exp = idsIn(c).some((id) => want.has(id));
      if (exp !== c.classList.contains('is-can') || exp === c.disabled) F(tag + ' 칸 [' + idsIn(c).join('') + '] 누를 수 있음=' + !c.disabled);
    });
  };
  const cellOf = (id) => [...document.querySelectorAll('.sb-cell')].find((c) => idsIn(c).indexOf(id) >= 0);

  document.querySelector('.duel-gate-go').click();
  if (DT.screen() !== 'placing') F('청팀 배치 화면 아님: ' + DT.screen());
  if (document.querySelector('.duel-place-title').textContent !== TEXT.duel.hide.title.blue) F('청팀 배치 제목');
  const seas = document.querySelectorAll('.sb');
  if (seas.length !== 1 || !seas[0].classList.contains('sb-m-place') || !seas[0].classList.contains('sb-team-blue')) F('배치 화면에 그 팀 바다 하나만이 아님');
  if (document.querySelector('.mouth-svg') || document.querySelector('.ctl')) F('배치 화면에 단면도·조작부가 보임');
  // 2단계(판에서 소리 숨김)여도 배치 화면은 소리와 줄 이름을 보여 줌
  const shown = [...document.querySelectorAll('.sb .sb-snd')].map((e) => e.textContent);
  for (const s of window.SOUNDS.consonants) if (shown.indexOf('/' + s.id + '/') < 0) F('배치 화면에 /' + s.id + '/가 안 보임');
  if ([...document.querySelectorAll('.sb-rh')].some((e) => !e.textContent.trim())) F('배치 화면에 줄 이름이 없음');
  if (document.querySelector('.duel-line').textContent !== G.text.fill(TEXT.duel.hide.place, { ship: G.text.shipName(3) })) F('세 칸 배 안내 줄: ' + document.querySelector('.duel-line').textContent);
  const tt = document.querySelector('.duel-timer').textContent;
  if (tt !== G.text.fill(TEXT.duel.hide.timer, { n: 30 }) && tt !== G.text.fill(TEXT.duel.hide.timer, { n: 29 })) F('남은 시간 ' + tt);
  checkCan('세 칸 배');
  cellOf('ㄱ').click();
  if (DT.st().teams.blue.fleet.length !== 1 || DT.st().teams.blue.fleet[0].sounds.join('') !== 'ㄱㄲㅋ') F('고른 세 칸 배가 놓이지 않음');
  if (document.querySelector('.duel-line').textContent !== G.text.fill(TEXT.duel.hide.place, { ship: G.text.shipName(2) })) F('두 칸 배 안내 줄');
  checkCan('두 칸 배');
  if (!cellOf('ㅇ').disabled) F('/ㄱ/과 겹치는 {/ㄱ/ /ㅇ/} 칸이 눌림');
  if (!cellOf('ㄱ').classList.contains('has-placed')) F('놓은 배 칸 표시 없음');
  // 일찍 끝내기 → 남은 배는 게임이 채움
  document.querySelector('.duel-done').click();
  if (document.querySelector('.duel-line').textContent !== TEXT.duel.hide.autoFilled) F('대신 숨김 줄: ' + document.querySelector('.duel-line').textContent);
  if (!(await DT.until(() => DT.screen() === 'gate', 3000))) F('홍팀 가림 화면으로 안 감');
  if (gateText() !== TEXT.duel.gate.red) F('홍팀 가림 글: ' + gateText());
  if (document.querySelector('.sb')) F('가림 화면에 바다가 보임(홍)');
  const bf = DT.st().teams.blue.fleet;
  if (bf.length !== 3 || bf[0].sounds.join('') !== 'ㄱㄲㅋ' || bf.map((s) => s.size).join('') !== '321') F('청팀 함대 채움 ' + JSON.stringify(bf));
  if (DT.st().placingTeam !== 'red') F('홍팀 배치 차례 아님');
  // 홍팀: 시간 초과(점검용으로 2초)
  G.duel.config.placeSeconds = 2;
  document.querySelector('.duel-gate-go').click();
  if (DT.screen() !== 'placing' || document.querySelector('.duel-place-title').textContent !== TEXT.duel.hide.title.red) F('홍팀 배치 화면 아님');
  if (!document.querySelector('.sb').classList.contains('sb-team-red')) F('홍팀 바다 아님');
  if (document.querySelectorAll('.has-placed, .is-placed').length) F('홍팀 배치 화면에 청팀 배가 보임');
  if (document.querySelector('.duel-timer').textContent !== G.text.fill(TEXT.duel.hide.timer, { n: 2 })) F('줄인 시간 표시');
  if (!(await DT.until(() => DT.screen() === 'gate', 6000))) F('시간이 지나도 끝나지 않음');
  if (gateText() !== TEXT.duel.gate.allDone) F('다 숨김 가림 글: ' + gateText());
  const rf = DT.st().teams.red.fleet;
  const used = [].concat.apply([], rf.map((s) => s.sounds));
  if (rf.map((s) => s.size).join('') !== '321' || new Set(used).size !== used.length) F('홍팀 함대 채움 ' + JSON.stringify(rf));
  if (DT.st().phase !== 'playing') F('배치가 끝났는데 대결 판이 아님');
  sv = G.save.loadGame();
  if (!sv || sv.phase !== 'playing' || JSON.stringify(sv.teams) !== JSON.stringify(DT.st().teams)) F('배치 끝 판이 저장되지 않음');
  document.querySelector('.duel-gate-go').click();
  if (DT.screen() !== 'play' || DT.active() !== 'blue') F('대결 시작 아님: ' + DT.screen() + ' ' + DT.active());
  const red = DT.fleetIds('red');
  await DT.fire(red[0]);
  if (DT.st().teams.blue.shots[0].kind !== 'hit' || DT.active() !== 'red') F('숨긴 배를 쏴서 명중 → 홍 차례가 아님');
  // 2단계: 따라 해 보기 없음(외치고 발사 줄)
  DT.h().debug.ctl.setSelection({ place: 'bilabial', manner: 'nasal' });
  if (DT.msgKind() === 'follow') F('2단계인데 따라 해 보기가 뜸');
  return { fails, errs: window.__soriErrors.slice() };
}

// ── 4) 배치 도중 새로고침 ─────────────────────────────────────────────
async function placingBeforeReload() {
  const fails = [], F = (m) => fails.push(m);
  try { localStorage.clear(); } catch (e) { /* 막힘 */ }
  Object.assign(G.duel.config, { placeSeconds: 30, autoFillShow: 200, fullDelay: 150 });
  G.duel.open({});
  DT.setup({ grade: 'm3', sea: 'consonant', level: 1, hideTime: true });
  document.querySelector('.duel-gate-go').click();
  document.querySelector('.sb-cell.is-can').click();
  document.querySelector('.duel-done').click();
  if (!(await DT.until(() => DT.screen() === 'gate', 3000))) F('홍팀 가림으로 안 감');
  document.querySelector('.duel-gate-go').click();
  document.querySelector('.sb-cell.is-can').click();
  if (DT.screen() !== 'placing' || DT.st().placingTeam !== 'red' || DT.st().teams.red.fleet.length !== 1) F('홍팀 배치 도중 상태가 아님');
  return { fails, errs: window.__soriErrors.slice(), pass: { id: DT.st().id } };
}
async function placingAfterReload(prev) {
  const fails = [], F = (m) => fails.push(m);
  await DT.until(() => G.duel.current, 3000);
  if (DT.screen() !== 'gate') F('새로고침 뒤 가림 화면이 아님: ' + DT.screen());
  else if (document.querySelector('.duel-gate-text').textContent !== TEXT.duel.gate.blue) F('청팀 가림이 아님');
  const st = DT.st();
  if (!st || st.phase !== 'placing' || st.placingTeam !== 'blue' || st.teams.blue.fleet.length || st.teams.red.fleet.length) F('배치가 처음(청팀)부터가 아님 ' + JSON.stringify(st && st.teams));
  if (prev && st && st.id !== prev.id) F('같은 판이 아님');
  document.querySelector('.duel-gate-go').click();
  if (DT.screen() !== 'placing' || document.querySelector('.duel-place-title').textContent !== TEXT.duel.hide.title.blue) F('청팀 배치로 안 감');
  if (document.querySelector('.duel-line').textContent !== G.text.fill(TEXT.duel.hide.place, { ship: G.text.shipName(2) })) F('1단계 첫 배(두 칸 배) 안내가 아님');
  return { fails, errs: window.__soriErrors.slice() };
}

// ── 5) 대결 도중 새로고침 → 이어서 하기 ───────────────────────────────
async function playBeforeReload() {
  const fails = [], F = (m) => fails.push(m);
  try { localStorage.clear(); } catch (e) { /* 막힘 */ }
  G.duel.open({});
  DT.setup({ grade: 'm3', sea: 'consonant', level: 2, hideTime: false });
  const red = DT.fleetIds('red'), blue = DT.fleetIds('blue');
  await DT.fire(red[0]);                                                            // 청: 명중
  await DT.fire(window.SOUNDS.consonants.map((s) => s.id).find((id) => blue.indexOf(id) < 0)); // 홍: 명중 아님
  await DT.fire({ place: 'alveolar', manner: 'fricative', strength: 'aspirated' });   // 청: 없는 소리(있는 칸의 없는 세기)
  const st = DT.st();
  if (st.teams.blue.shots.length !== 2 || st.teams.red.shots.length !== 1) F('세 발 기록이 아님');
  const marks = { blue: DT.h().debug.boards.blue.el.querySelectorAll('.sb-mark').length, red: DT.h().debug.boards.red.el.querySelectorAll('.sb-mark').length };
  return { fails, errs: window.__soriErrors.slice(), pass: { json: JSON.stringify(st), marks, log: DT.logCount(), sunk: document.querySelectorAll('.sb-ship-item.is-sunk').length } };
}
async function playAfterReload(prev) {
  const fails = [], F = (m) => fails.push(m);
  await DT.until(() => G.duel.current, 3000);
  if (DT.screen() !== 'play') F('이어서 하기가 대결 화면이 아님: ' + DT.screen());
  if (JSON.stringify(DT.st()) !== prev.json) F('되살린 판이 저장 전과 다름');
  if (G.rules.whoseTurn(DT.st()) !== 'red' || DT.active() !== 'red' || DT.turnText() !== TEXT.duel.turn.red) F('되살린 차례가 홍이 아님');
  if (DT.logCount() !== prev.log) F('신호 기록장 ' + DT.logCount() + ' / ' + prev.log);
  const items = [...document.querySelectorAll('.duel-dock .ctl-log-item')].map((e) => (e.classList.contains('t-blue') ? 'b' : 'r')).join('');
  if (items !== 'brb') F('기록장 순서 ' + items);
  const m = { blue: DT.h().debug.boards.blue.el.querySelectorAll('.sb-mark').length, red: DT.h().debug.boards.red.el.querySelectorAll('.sb-mark').length };
  if (m.blue !== prev.marks.blue || m.red !== prev.marks.red) F('판 표시 ' + JSON.stringify(m) + ' / ' + JSON.stringify(prev.marks));
  if (document.querySelectorAll('.sb-ship-item.is-sunk').length !== prev.sunk) F('남은 배 목록');
  const turns = [...document.querySelectorAll('.duel-turns')].map((e) => e.textContent);
  const lv = G.rules.level('consonant', 2);
  if (turns[0].indexOf(String(lv.turns - 2)) < 0 || turns[1].indexOf(String(lv.turns - 1)) < 0) F('남은 턴 ' + turns.join(' / '));
  const blue = DT.fleetIds('blue');
  await DT.fire(blue[0]);
  if (DT.st().teams.red.shots.length !== 2 || G.save.loadGame().teams.red.shots.length !== 2) F('되살린 뒤 이어서 쏘기·저장 안 됨');
  return { fails, errs: window.__soriErrors.slice() };
}

// ── 6) 휴대폰(세로·눕힘) 틀 ───────────────────────────────────────────
async function phoneNotice() {
  const fails = [], F = (m) => fails.push(m);
  await window.frameReady;
  let fw = null;
  for (let i = 0; i < 100 && !fw; i++) {
    const w = window.frameWin();
    if (w && w.G && w.G.duel && w.G.duel.current) fw = w;
    else await new Promise((r) => setTimeout(r, 50));
  }
  if (!fw) return { fails: ['틀 안 대결 화면이 열리지 않음'], errs: [] };
  const d = fw.document;
  const ph = d.querySelector('.duel-phone');
  if (!fw.DT.visible(ph)) F('대결 안내가 안 보임');
  if (d.querySelector('.duel-phone-text').textContent !== fw.TEXT.duel.phoneNotice) F('안내 글: ' + d.querySelector('.duel-phone-text').textContent);
  if (fw.getComputedStyle(d.querySelector('.duel-stage')).visibility !== 'hidden') F('안내 뒤의 대결 준비 화면이 보임');
  const r = ph.getBoundingClientRect();
  if (r.width < fw.innerWidth - 1 || r.height < fw.innerHeight - 1) F('안내가 화면을 다 덮지 않음');
  const b = d.querySelector('.duel-phone-home');
  if (b.getBoundingClientRect().height < 48) F('단추가 48px 보다 작음');
  if (d.documentElement.scrollWidth > fw.innerWidth + 1) F('가로 스크롤');
  b.click();
  if (fw.__went.indexOf('title') < 0) F('처음으로가 시작 화면을 부르지 않음');
  return { fails, errs: fw.__soriErrors.slice(), info: { w: fw.innerWidth, h: fw.innerHeight } };
}

// ── 7) 칠판·노트북 상자: 넘침 없음·크기 · 캡처 ─────────────────────────
async function playShot() {
  const fails = [], F = (m) => fails.push(m);
  try { localStorage.clear(); } catch (e) { /* 막힘 */ }
  G.duel.open({});
  DT.setup({ grade: 'm3', sea: 'consonant', level: 2, hideTime: false });
  const red = DT.fleetIds('red'), blue = DT.fleetIds('blue');
  const notBlue = window.SOUNDS.consonants.map((s) => s.id).filter((id) => blue.indexOf(id) < 0);
  const notRed = window.SOUNDS.consonants.map((s) => s.id).filter((id) => red.indexOf(id) < 0 && id !== 'ㅎ');
  await DT.fire(red[0]);
  await DT.fire(notBlue[0]);
  await DT.fire(notRed[notRed.length - 1]);
  await DT.fire(blue[0]);
  DT.h().debug.ctl.setSelection({ place: 'velar', manner: 'stop', strength: 'tense' });
  await DT.wait(1200);
  const root = document.querySelector('.duel');
  const R = root.getBoundingClientRect();
  if (root.scrollWidth > root.clientWidth + 1 || root.scrollHeight > root.clientHeight + 1) F('화면이 넘침 ' + root.scrollWidth + '×' + root.scrollHeight);
  const inside = (e, tag) => {
    const q = e.getBoundingClientRect();
    if (q.left < R.left - 1 || q.right > R.right + 1 || q.top < R.top - 1 || q.bottom > R.bottom + 1) F(tag + '이(가) 화면 밖으로 나감');
  };
  document.querySelectorAll('.duel-board').forEach((c, i) => {
    const sb = c.querySelector('.sb');
    const q = c.getBoundingClientRect(), s = sb.getBoundingClientRect();
    if (s.bottom > q.bottom + 1 || s.right > q.right + 1 || s.left < q.left - 1) F('바다 ' + i + '가 칸 밖으로 넘침');
    inside(sb, '바다 ' + i);
  });
  inside(document.querySelector('.duel-dock .ctl'), '조작부');
  // 단면도 그림(목 뒤 살까지)이 양옆 바다와 겹치지 않음
  const head = document.querySelector('.mouth-svg .mouth-tissue').getBoundingClientRect();
  if (head.right > document.querySelector('.sea-right .sb').getBoundingClientRect().left - 1) F('단면도가 오른쪽 바다와 겹침');
  if (head.left < document.querySelector('.sea-left .sb').getBoundingClientRect().right + 1) F('단면도가 왼쪽 바다와 겹침');
  // 바다 이름은 판 바로 위, 화면 안
  document.querySelectorAll('.duel-sea').forEach((c, i) => {
    const nm = c.querySelector('.duel-sea-name').getBoundingClientRect(), sb = c.querySelector('.sb').getBoundingClientRect();
    if (nm.bottom > sb.top + 1 || nm.bottom < sb.top - 40) F('바다 ' + i + ' 이름이 판 바로 위가 아님');
    inside(c.querySelector('.duel-sea-name'), '바다 ' + i + ' 이름');
  });
  // 차례인 팀이 쏘는 바다만 테두리
  if (DT.active() !== 'blue') F('테두리 ' + DT.active());
  inside(document.querySelector('.mouth-svg'), '단면도');
  const small = [...document.querySelectorAll('.duel-dock .ctl-card, .duel-dock .ctl-fire')].filter((b) => b.offsetHeight < 64 || b.offsetWidth < 64);
  if (small.length) F('64px 보다 작은 조작 단추 ' + small.length + '개');
  const msgFont = parseFloat(getComputedStyle(document.querySelector('.duel-dock .ctl-msg')).fontSize);
  if (msgFont < 22) F('한 줄 문구 글씨 ' + msgFont);
  const cell = document.querySelector('.duel-board .sb-cell');
  const mouth = document.querySelector('.mouth-svg');
  return {
    fails, errs: window.__soriErrors.slice(),
    info: { box: [root.clientWidth, root.clientHeight], cell: [cell.offsetWidth, cell.offsetHeight], mouth: [mouth.clientWidth, mouth.clientHeight], msgFont,
      turnFont: getComputedStyle(document.querySelector('.duel-turn')).fontSize, teamFont: getComputedStyle(document.querySelector('.duel-team')).fontSize },
  };
}
async function placeShot() {
  const fails = [], F = (m) => fails.push(m);
  try { localStorage.clear(); } catch (e) { /* 막힘 */ }
  G.duel.open({});
  DT.setup({ grade: 'h1', sea: 'consonant', level: 2, hideTime: true });
  document.querySelector('.duel-gate-go').click();
  [...document.querySelectorAll('.sb-cell.is-can')][1].click();
  await DT.wait(300);
  const root = document.querySelector('.duel');
  if (root.scrollHeight > root.clientHeight + 1) F('배치 화면이 넘침');
  const sb = document.querySelector('.duel-place-sea .sb').getBoundingClientRect(), box = document.querySelector('.duel-place-sea').getBoundingClientRect();
  if (sb.bottom > box.bottom + 1) F('배치 바다가 넘침');
  const small = [...document.querySelectorAll('.sb-cell.is-can, .duel-done')].filter((b) => b.offsetHeight < 64);
  if (small.length) F('64px 보다 작은 누르는 칸 ' + small.length + '개');
  return { fails, errs: window.__soriErrors.slice() };
}

flow('무작위 배치 한 판: 번갈아·차례 유지·마지막 한 발·공개·finishGame(청팀 승)', [{ url: FAST, fn: randomBlueWins }]);
flow('마지막 한 발로 후공도 다 찾음 → 무승부(모음 바다)', [{ url: FAST, fn: vowelLastShotDraw }]);
flow('숨기기 시간: 가림 화면·그 팀 바다만·큰 배부터·일찍 끝·시간 초과 채움 → 대결', [{ url: FAST, fn: hidePlacement }]);
flow('배치 도중 새로고침 → 청팀 배치부터 다시', [{ url: FAST, fn: placingBeforeReload }, { url: PAGE + '?resume=1&rm=1', fn: placingAfterReload }]);
flow('대결 도중 새로고침 → 판·기록장·차례 그대로 이어서', [{ url: FAST, fn: playBeforeReload }, { url: PAGE + '?resume=1&rm=1', fn: playAfterReload }]);
flow('휴대폰 세로 390×844: 대결 안내 한 줄', [{ url: frame(390, 844, 'tests/pages/duel.html'), fn: phoneNotice }]);
flow('눕힌 휴대폰 844×390: 대결 안내 한 줄', [{ url: frame(844, 390, 'tests/pages/duel.html'), fn: phoneNotice }]);
flow('칠판 1920×1080 대결 화면 캡처', [{ url: PAGE + '?manual=1&rm=1&box=1920x1080', fn: playShot, shot: { name: 'duel-1920x1080-play', wait: 300 } }]);
flow('칠판 1920×1080 배치 화면 캡처', [{ url: PAGE + '?manual=1&rm=1&box=1920x1080', fn: placeShot, shot: { name: 'duel-1920x1080-place', wait: 300 } }]);
flow('노트북 1366×768 대결 화면 캡처', [{ url: PAGE + '?manual=1&rm=1&box=1366x768', fn: playShot, shot: { name: 'duel-1366x768-play', wait: 300 } }]);
