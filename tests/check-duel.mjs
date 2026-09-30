// 대결 모드 화면 G.duel 점검(aside). 점검용 페이지 tests/pages/duel.html(진짜 스크립트 + G.app 흉내)에서 돈다.
//   대결은 실시간(spec 6.3): 차례·라운드·'준비' 없이 두 팀이 각자 준비되는 대로 쏘고 또 쏜다(팀마다 발 수는 단계의 제한 턴).
//   1) 무작위 배치 한 판: 준비 화면 고르기·기억, 16:9 배치(왼쪽 절반 = 청팀 자리·홍팀 바다, 오른쪽 = 홍팀 자리), 자리마다 발사 단추,
//      위 띠(남은 배·남은 발), 1단계 '따라 해 보기', 발을 쓰지 않는 결과(이번 바다에 없는 칸·이미 쏜 소리),
//      청팀의 공기 흐름이 도는 동안 홍팀이 두 발(엇갈려 쏘기 — 한 팀의 발이 다른 팀을 막거나 되돌리지 않음),
//      홍팀의 발이 날아가는 중 청팀이 먼저 다 찾음 → 곧바로 두 자리 멈춤·그 발은 버려짐 → 두 바다 공개 → finishGame(청팀 승)
//   2) 발 소진: 먼저 다 쓴 팀은 조작부가 잠기고 '상대를 기다려요', 상대는 계속 → 두 팀 소진 → 맞힌 칸 비교, 공개 중 '처음으로'
//   2b) 두 팀 소진·맞힌 칸 같음 → 무승부(모음 바다)
//   3) 진짜 애니메이션(움직임 줄이기 끔): 두 자리의 공기 흐름이 겹쳐 돌고, 먼저 끝난 자리는 상대를 기다리지 않고 풀림
//   4) 여러 손가락: 두 자리에 서로 다른 pointerId의 pointerdown/pointerup을 엇갈려 보내도(발사 단추 포함) 둘 다 따로 눌림,
//      뒤따르는 click은 한 번만 셈, 단추 밖에서 뗀 포인터는 누르지 않음
//   5) 숨기기 시간: 가림 화면(청) → 청팀 배치(그 팀 바다만, 소리·줄 이름 보임, 큰 배부터, 놓을 수 있는 묶음만,
//      '다 놓았어요'로 일찍 끝 → 남은 배 채움) → 가림(홍) → 홍팀 배치(짧게 줄인 시간 초과 → 채움) → 가림(다 숨김) → 대결
//   6) 배치 도중 새로고침 → 숨기기 단계를 청팀부터 다시
//   7) 대결 도중 새로고침 → 두 팀의 쏜 발(수가 다름)·판·기록장·발 소진 기다림을 그대로 되살림(고르던 것은 풀림)
//   8) 휴대폰 세로 390×844 · 눕힌 휴대폰 844×390 틀: 대결 안내 한 줄과 '처음으로'
//   9) 칠판 1920×1080 · 노트북 1366×768 상자에서 대결 화면이 넘치지 않고 조작 단추 64px 이상, 문구 22px 이상 — 캡처(tests/shots/)
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

// ── 1) 무작위 배치 한 판: 두 팀이 따로·엇갈려 쏘기, 먼저 다 찾은 팀 즉시 승 ─────
async function randomRealtime() {
  const fails = [], F = (m) => fails.push(m);
  try { localStorage.clear(); } catch (e) { /* 막힘 */ }
  Object.assign(G.duel.config, { endDelay: 500 });
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
  if (st0.grade !== 'h1' || st0.level !== 1 || st0.hideTime || 'rounds' in st0) F('판 설정 ' + JSON.stringify([st0.grade, st0.level, st0.hideTime, st0.rounds]));
  if (!G.save.hasGame() || G.save.loadGame().id !== st0.id) F('시작하자마자 저장되지 않음');
  // 배치: 좌우 절반 = 청팀 자리 | 홍팀 자리, 자리마다 쏘는 바다·단면도·조작부(발사 단추 포함)
  const halves = [...document.querySelectorAll('.duel-halves > .duel-station')].map((e) => e.dataset.team).join();
  if (halves !== 'blue,red') F('좌우 자리 순서 ' + halves);
  if (document.querySelector('.duel-ready, .duel-count, .duel-round')) F('라운드 방식의 준비 단추·셈·라운드 줄이 남아 있음');
  for (const t of ['blue', 'red']) {
    const s = DT.station(t);
    if (s.querySelectorAll('.sb').length !== 1 || s.querySelectorAll('.mouth-svg').length !== 1 || s.querySelectorAll('.ctl').length !== 1) F(t + ' 자리에 바다·단면도·조작부가 하나씩이 아님');
    if (s.querySelector('.duel-sea-name').textContent !== TEXT.duel.target[t]) F(t + ' 바다 이름표: ' + s.querySelector('.duel-sea-name').textContent);
    if (!s.querySelector('.sb').classList.contains('sb-team-' + t)) F(t + ' 자리 바다 테두리 색');
    const b = DT.fireBtn(t);
    if (!DT.visible(b) || b.textContent !== TEXT.ui.play.fire || !b.disabled) F(t + ' 발사 단추(보이고, 처음엔 꺼짐)');
    if (DT.msg(t) !== TEXT.duel.shout) F(t + ' 기본 줄이 "소리 내어 외치고 발사!"가 아님: ' + DT.msg(t));
  }
  if (!TEXT.duel.target.blue.includes(TEXT.teams.red) || !TEXT.duel.target.red.includes(TEXT.teams.blue)) F('이름표가 상대 팀 바다를 가리키지 않음');
  const top = [...document.querySelectorAll('.duel-top > *')].map((e) => e.className);
  if (!/side-blue/.test(top[0]) || !/duel-center/.test(top[1]) || !/side-red/.test(top[2])) F('위 띠 순서 ' + top.join(' | '));
  if (document.querySelector('.duel-title').textContent !== TEXT.ui.title) F('제목');
  const fillN = (k, n) => G.text.fill(TEXT.duel[k], { n });
  if (DT.shipsLeft().join('|') !== [3, 3].map((n) => fillN('shipsLeft', n)).join('|')) F('위 띠 남은 배: ' + DT.shipsLeft());
  if (DT.shotsLeft().join('|') !== [8, 8].map((n) => fillN('shotsLeft', n)).join('|')) F('위 띠 남은 발: ' + DT.shotsLeft());
  if (DT.statusText() !== '') F('판 도중 가운데 줄: ' + DT.statusText());
  // 1단계 '따라 해 보기'(그 팀 자리의 한 줄)
  DT.compose('blue', 'ㅁ');
  if (DT.msgKind('blue') !== 'follow' || DT.msg('blue') !== G.text.follow('ㅁ')) F('청팀 따라 해 보기 줄: ' + DT.msg('blue'));
  if (DT.msg('red') !== TEXT.duel.shout) F('청팀이 고르는데 홍팀 줄이 바뀜: ' + DT.msg('red'));
  if (DT.station('blue').querySelector('.mouth-svg').dataset.place !== 'bilabial') F('청팀 고름이 청팀 단면도에 안 비침');
  if (DT.station('red').querySelector('.mouth-svg').dataset.place) F('청팀 고름이 홍팀 단면도에 비침');
  if (DT.fireBtn('blue').disabled !== false || DT.fireBtn('red').disabled !== true) F('쏠 수 있게 고른 팀의 발사 단추만 켜져야 함');

  const red = DT.fleetIds('red'), blue = DT.fleetIds('blue');
  const openIds = G.rules.level('consonant', 1).open;
  const redMiss = openIds.filter((id) => blue.indexOf(id) < 0);
  // 발을 쓰지 않는 결과: 이번 바다에 없는 칸(/ㅎ/)
  await DT.shot('blue', { place: 'glottal', manner: 'fricative' });
  if (DT.msg('blue') !== TEXT.signal.notInSea) F('없는 칸 줄: ' + DT.msg('blue'));
  if (DT.st().teams.blue.shots.length !== 0 || DT.shotsLeft()[0] !== fillN('shotsLeft', 8)) F('없는 칸이 발을 씀');
  if (DT.station('blue').querySelector('.ctl-card').disabled) F('없는 칸 뒤 청팀 조작부가 잠김');
  // 엇갈려 쏘기: 청팀의 공기 흐름이 도는 동안 홍팀이 두 발
  DT.hold('blue');
  const pb = DT.shot('blue', red[0]);
  if (!DT.busy('blue') || !DT.station('blue').classList.contains('is-busy')) F('청팀 발사 중 표시 없음');
  if (!DT.station('blue').querySelector('.ctl-card').disabled || !DT.fireBtn('blue').disabled) F('청팀 애니메이션 중 청팀 조작부가 안 잠김');
  if (DT.station('red').querySelector('.ctl-card').disabled) F('청팀 애니메이션 중 홍팀 조작부가 잠김');
  if (DT.st().teams.blue.shots.length !== 0) F('애니메이션 전에 채점됨');
  await DT.shot('red', redMiss[0]);
  await DT.shot('red', { place: 'palatal', manner: 'stop' }); // 없는 소리(발을 씀)
  const sm = DT.st();
  if (sm.teams.red.shots.length !== 2 || sm.teams.blue.shots.length !== 0) F('청팀이 쏘는 동안 홍팀 두 발이 안 들어감 ' + [sm.teams.blue.shots.length, sm.teams.red.shots.length]);
  if (sm.teams.red.shots[1].kind !== 'none' || DT.msg('red') !== TEXT.signal.none) F('홍팀 없는 소리: ' + DT.msg('red'));
  if (DT.shotsLeft().join('|') !== [8, 6].map((n) => fillN('shotsLeft', n)).join('|')) F('남은 발(청 쏘는 중): ' + DT.shotsLeft());
  if (!DT.busy('blue')) F('홍팀 발사가 청팀 애니메이션을 끊음');
  if (DT.logCount('red') !== 2 || DT.logCount('blue') !== 0) F('자리별 기록장 ' + [DT.logCount('blue'), DT.logCount('red')]);
  if (G.save.loadGame().teams.red.shots.length !== 2) F('홍팀 발마다 저장 안 됨');
  DT.unhold('blue');
  await pb;
  const s1 = DT.st();
  if (s1.teams.blue.shots.length !== 1 || s1.teams.blue.shots[0].kind !== 'hit') F('청팀 발이 끝난 뒤 채점 ' + JSON.stringify(s1.teams.blue.shots.map((x) => x.kind)));
  if (s1.teams.red.shots.length !== 2) F('청팀 채점이 홍팀 기록을 되돌림');
  if (DT.msg('blue') !== TEXT.signal.hit || DT.msg('red') !== TEXT.signal.none) F('신호 줄: ' + DT.msg('blue') + ' / ' + DT.msg('red'));
  if (DT.busy('blue') || DT.station('blue').classList.contains('is-busy') || DT.station('blue').querySelector('.ctl-card').disabled) F('청팀 발 뒤 잠김이 안 풀림');
  if (h.debug.ctls.blue.getSelection().place) F('발사 뒤 고른 것이 남음');
  if (DT.shotsLeft().join('|') !== [7, 6].map((n) => fillN('shotsLeft', n)).join('|')) F('남은 발: ' + DT.shotsLeft());
  if (DT.station('blue').querySelectorAll('.sb-mark').length < 1) F('청팀 바다에 표시 없음');
  const sv = G.save.loadGame();
  if (!sv || sv.teams.blue.shots.length !== 1 || sv.teams.red.shots.length !== 2) F('발 뒤 저장 안 됨');
  // 이미 쏜 소리: 발을 쓰지 않음
  await DT.shot('blue', red[0]);
  if (DT.msg('blue') !== TEXT.signal.already || DT.st().teams.blue.shots.length !== 1) F('이미 쏜 소리: ' + DT.msg('blue'));
  // 청팀이 연달아 쏘아 남은 배를 찾는다 — 마지막 발 직전 홍팀의 발이 날아가는 중이면 그 발은 버려진다
  for (let i = 1; i < red.length - 1; i++) await DT.shot('blue', red[i]);
  if (DT.st().phase !== 'playing') F('마지막 배 전에 끝남');
  DT.hold('red');
  const pr = DT.shot('red', redMiss[1]);
  if (!DT.busy('red')) F('(준비) 홍팀 발사 중이 아님');
  await DT.shot('blue', red[red.length - 1]);
  const s2 = DT.st();
  if (s2.phase !== 'over' || !s2.result || s2.result.winner !== 'blue' || s2.result.reason !== 'found-all') F('결과: ' + JSON.stringify(s2.result));
  if (DT.screen() !== 'over') F('끝 화면 아님: ' + DT.screen());
  if (!DT.fireBtn('red').disabled || !DT.station('red').querySelector('.ctl-card').disabled || !DT.station('blue').querySelector('.ctl-card').disabled) F('끝났는데 조작부가 안 멈춤');
  DT.unhold('red');
  await pr;
  if (DT.st().teams.red.shots.length !== 2) F('끝난 뒤 도착한 홍팀 발이 기록됨');
  if (!/찾았어요/.test(DT.msg('blue'))) F('마지막 격침 줄: ' + DT.msg('blue'));
  const rev = DT.station('red').querySelectorAll('.k-reveal').length;
  if (rev !== blue.length) F('청팀 바다 남은 배 공개 칸 ' + rev + ' / ' + blue.length);
  if (DT.station('blue').querySelectorAll('.k-reveal').length !== 0) F('다 찾은 바다에 공개 칸이 있음');
  if (DT.statusText() !== TEXT.ui.result.winner.blue) F('끝 줄: ' + DT.statusText());
  if (DT.shipsLeft()[0] !== fillN('shipsLeft', 0)) F('위 띠 청팀 남은 배: ' + DT.shipsLeft());
  if (window.__finished) F('공개를 보여 주기 전에 결과로 감');
  const fin = await DT.until(() => window.__finished, 4000);
  if (!fin) F('finishGame이 불리지 않음');
  else {
    if (!fin.result || fin.result.winner !== 'blue') F('finishGame 승자 ' + JSON.stringify(fin.result));
    if (fin.id !== st0.id) F('finishGame 판 id');
    const rec = G.rules.makeRecord(fin);
    if (rec.teams.blue.hitSounds.length !== red.length || rec.teams.blue.turnsUsed !== red.length || rec.teams.red.turnsUsed !== 2) F('판 기록(팀마다 쓴 발이 다름) ' + [rec.teams.blue.turnsUsed, rec.teams.red.turnsUsed]);
  }
  await DT.wait(200);
  if (window.__finishedCount !== 1) F('finishGame 횟수 ' + window.__finishedCount);
  if (G.save.hasGame()) F('끝난 판이 진행 판으로 남음');
  if (DT.logCount('blue') !== s2.teams.blue.shots.length || DT.logCount('red') !== 2) F('기록장 줄 수 ' + DT.logCount('blue') + '/' + DT.logCount('red'));
  // 결과로 간 뒤의 '처음으로'
  document.querySelector('.duel-home').click();
  if (window.__went.indexOf('title') < 0) F('처음으로가 시작 화면을 부르지 않음');
  h.destroy();
  if (document.querySelector('.duel')) F('destroy 뒤 화면이 남음');
  if (G.duel.current) F('destroy 뒤 current가 남음');
  return { fails, errs: window.__soriErrors.slice() };
}

// ── 2) 발 소진: 먼저 다 쓴 팀은 잠기고 기다림 → 상대가 계속 → 두 팀 소진 → 맞힌 칸 비교, 공개 중 '처음으로' ──
async function outOfShots() {
  const fails = [], F = (m) => fails.push(m);
  try { localStorage.clear(); } catch (e) { /* 막힘 */ }
  Object.assign(G.duel.config, { endDelay: 60000, outLineDelay: 60 });
  G.duel.open({});
  DT.setup({ grade: 'm3', sea: 'consonant', level: 1, hideTime: false });
  const red = DT.fleetIds('red'), blue = DT.fleetIds('blue');
  const open = G.rules.level('consonant', 1).open;
  const DUDS = [{ place: 'glottal', manner: 'stop' }, { place: 'palatal', manner: 'stop' }, { place: 'bilabial', manner: 'fricative' },
    { place: 'velar', manner: 'fricative' }, { place: 'palatal', manner: 'nasal' }, { place: 'glottal', manner: 'nasal' }, { place: 'bilabial', manner: 'liquid' }, { place: 'velar', manner: 'liquid' }];
  // 청: 한 칸만 맞힘(8발) / 홍: 하나도 못 맞힘 → 두 팀 소진 뒤 청팀 승(맞힌 칸)
  const bShots = [red[0]].concat(open.filter((id) => red.indexOf(id) < 0), DUDS).slice(0, 8);
  const rShots = open.filter((id) => blue.indexOf(id) < 0).concat(DUDS).slice(0, 8);
  await DT.shot('red', rShots[0]);
  for (let i = 0; i < 8; i++) await DT.shot('blue', bShots[i]);
  const g = DT.st();
  if (g.phase !== 'playing' || g.teams.blue.shots.length !== 8 || g.teams.red.shots.length !== 1) F('청팀만 발 소진 뒤 판 ' + [g.phase, g.teams.blue.shots.length, g.teams.red.shots.length]);
  if (DT.shotsLeft().join('|') !== [0, 7].map((n) => G.text.fill(TEXT.duel.shotsLeft, { n })).join('|')) F('남은 발: ' + DT.shotsLeft());
  if (!DT.isOut('blue') || DT.isOut('red') || !document.querySelector('.side-blue').classList.contains('is-out')) F('발 소진 표시');
  if (!DT.station('blue').querySelector('.ctl-card').disabled || !DT.fireBtn('blue').disabled) F('발을 다 쓴 팀 조작부가 안 잠김');
  if (DT.station('red').querySelector('.ctl-card').disabled) F('상대 조작부까지 잠김');
  await DT.until(() => DT.msg('blue') === TEXT.duel.outOfShots, 2000);
  if (DT.msg('blue') !== TEXT.duel.outOfShots) F('기다림 줄: ' + DT.msg('blue'));
  DT.compose('blue', red[1]);
  if (DT.fire('blue') !== null || DT.st().teams.blue.shots.length !== 8) F('발을 다 쓴 팀이 쏨');
  // 단면도를 눌러도 고르지 않음
  const placeNow = DT.h().debug.ctls.blue.getSelection().place;
  const other = [...DT.station('blue').querySelectorAll('.mouth-hit')].find((e) => e.dataset.id !== placeNow);
  other.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  if (DT.h().debug.ctls.blue.getSelection().place !== placeNow) F('발을 다 쓴 팀이 단면도로 자리를 고름');
  // 홍팀은 계속 쏜다
  for (let i = 1; i < 7; i++) await DT.shot('red', rShots[i]);
  if (DT.st().phase !== 'playing' || DT.shotsLeft()[1] !== G.text.fill(TEXT.duel.shotsLeft, { n: 1 })) F('홍팀 7발 뒤 판: ' + DT.shotsLeft());
  await DT.shot('red', rShots[7]);
  const s = DT.st();
  if (!s.result || s.result.winner !== 'blue' || s.result.reason !== 'more-hits') F('두 팀 소진 결과 ' + JSON.stringify(s.result));
  if (DT.statusText() !== TEXT.ui.result.winner.blue) F('끝 줄: ' + DT.statusText());
  if (DT.isOut('blue')) F('끝난 뒤에도 발 소진 표시');
  if (DT.station('blue').querySelectorAll('.k-reveal').length !== red.length - 1) F('홍팀 바다 남은 배 공개');
  if (DT.station('red').querySelectorAll('.k-reveal').length !== blue.length) F('청팀 바다 남은 배 공개');
  // 공개 중 '처음으로' → 판을 잃지 않게 곧바로 finishGame(결과로)
  await DT.wait(50);
  if (window.__finished) F('공개 시간(60초) 전에 결과로 감');
  document.querySelector('.duel-home').click();
  if (!window.__finished || window.__finishedCount !== 1) F('공개 중 처음으로가 finishGame을 부르지 않음');
  if (window.__went.indexOf('title') >= 0) F('공개 중 처음으로가 결과 없이 시작 화면으로 감');
  await DT.wait(700);
  document.querySelector('.duel').dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  if (window.__finishedCount !== 1) F('finishGame이 두 번 불림');
  return { fails, errs: window.__soriErrors.slice() };
}

// ── 2b) 두 팀 소진 · 맞힌 칸 같음 → 무승부(모음 바다) ───────────────────
async function vowelTie() {
  const fails = [], F = (m) => fails.push(m);
  try { localStorage.clear(); } catch (e) { /* 막힘 */ }
  Object.assign(G.duel.config, { endDelay: 300 });
  G.duel.open({});
  DT.setup({ grade: 'm3', sea: 'vowel', level: 1, hideTime: false });
  if (document.querySelectorAll('.mouth-svg[data-sea="vowel"]').length !== 2) F('모음 단면도 둘이 아님');
  const st = DT.st();
  const DUDS = [{ backness: 'front', height: 'low', lips: 'rounded' }, { backness: 'back', height: 'low', lips: 'rounded' }];
  const plan = (team) => {
    const target = st.teams[team === 'blue' ? 'red' : 'blue'].fleet;
    const ids = target.reduce((a, s) => a.concat(s.sounds), []);
    const big = target[0].sounds; // 세 칸 배의 두 칸만 맞힘(다 찾지 않음)
    const miss = window.SOUNDS.vowels.map((v) => v.id).filter((id) => ids.indexOf(id) < 0);
    return [big[0], big[1]].concat(miss, DUDS).slice(0, 8);
  };
  const B = plan('blue'), R = plan('red');
  const list = [];
  for (let i = 0; i < 8; i++) { list.push(['blue', B[i]]); list.push(['red', R[i]]); }
  await DT.shots(list);
  const s = DT.st();
  if (!s.result || s.result.winner !== null || s.result.reason !== 'hits-tie') F('무승부 아님 ' + JSON.stringify(s.result));
  if (DT.statusText() !== TEXT.ui.result.winner.draw) F('무승부 줄: ' + DT.statusText());
  const fin = await DT.until(() => window.__finished, 3000);
  if (!fin || fin.result.winner !== null) F('finishGame 무승부 아님');
  return { fails, errs: window.__soriErrors.slice() };
}

// ── 3) 진짜 애니메이션: 두 자리의 공기 흐름이 겹쳐 돈다(움직임 줄이기 끔) ──
async function overlapAnim() {
  const fails = [], F = (m) => fails.push(m);
  try { localStorage.clear(); } catch (e) { /* 막힘 */ }
  G.duel.open({});
  DT.setup({ grade: 'm3', sea: 'consonant', level: 2, hideTime: false });
  const red = DT.fleetIds('red'), blue = DT.fleetIds('blue');
  const notBlue = window.SOUNDS.consonants.map((s) => s.id).filter((id) => blue.indexOf(id) < 0 && id !== 'ㅎ');
  const playing = (t) => DT.station(t).querySelector('.mouth-svg').dataset.playing === '1';
  const t0 = Date.now();
  const pb = DT.shot('blue', red[0]);
  await DT.wait(150);
  if (!playing('blue')) F('청팀 공기 흐름이 안 돎');
  // 청팀 애니메이션 도중 홍팀이 빚고 쏜다
  DT.compose('red', notBlue[0]);
  const pr = DT.fire('red');
  if (!pr) F('청팀 애니메이션 중 홍팀 발사 단추가 안 눌림');
  await DT.wait(100);
  if (!playing('blue') || !playing('red')) F('두 공기 흐름이 겹쳐 돌지 않음 ' + [playing('blue'), playing('red')]);
  if (!DT.busy('blue') || !DT.busy('red')) F('두 자리 모두 발사 중이 아님');
  await pb;
  const tb = Date.now() - t0;
  if (DT.st().teams.blue.shots.length !== 1 || DT.st().teams.blue.shots[0].kind !== 'hit') F('청팀 채점');
  if (!DT.busy('red') || DT.st().teams.red.shots.length !== 0) F('청팀이 끝났을 때 홍팀은 아직 도는 중이어야 함');
  if (DT.station('blue').querySelector('.ctl-card').disabled) F('청팀 끝난 뒤 청팀 조작부가 안 풀림(홍팀을 기다림)');
  await pr;
  if (DT.st().teams.red.shots.length !== 1) F('홍팀 채점');
  if (tb > 1600) F('청팀 한 발이 1.5초를 넘음: ' + tb + 'ms');
  return { fails, errs: window.__soriErrors.slice(), info: { blueMs: tb } };
}

// ── 4) 여러 손가락: 두 자리를 동시에 ─────────────────────────────────
async function multiTouch() {
  const fails = [], F = (m) => fails.push(m);
  try { localStorage.clear(); } catch (e) { /* 막힘 */ }
  const h = G.duel.open({});
  DT.setup({ grade: 'm3', sea: 'consonant', level: 2, hideTime: false });
  const card = (t, g, id) => DT.station(t).querySelector('.ctl-card[data-group="' + g + '"][data-id="' + id + '"]');
  const P = DT.ptr;
  h.debug.ctls.blue.setPlace('velar');
  h.debug.ctls.red.setPlace('bilabial');
  // 두 손가락이 겹쳐 누름: 청 down(11) → 홍 down(12) → 청 up(11) → 청 down(13) → 홍 up(12) → 청 up(13)
  P('pointerdown', card('blue', 'manner', 'stop'), 11);
  P('pointerdown', card('red', 'manner', 'nasal'), 12);
  P('pointerup', card('blue', 'manner', 'stop'), 11);
  P('pointerdown', card('blue', 'strength', 'tense'), 13);
  P('pointerup', card('red', 'manner', 'nasal'), 12);
  P('pointerup', card('blue', 'strength', 'tense'), 13);
  const sb = h.debug.ctls.blue.getSelection(), sr = h.debug.ctls.red.getSelection();
  if (sb.manner !== 'stop' || sb.strength !== 'tense') F('청팀 겹친 누르기가 안 들어감 ' + JSON.stringify(sb));
  if (sr.manner !== 'nasal') F('홍팀 겹친 누르기가 안 들어감 ' + JSON.stringify(sr));
  // 단추 밖에서 뗀 포인터는 누르지 않음
  P('pointerdown', card('red', 'manner', 'liquid'), 14);
  P('pointerup', DT.station('red').querySelector('.duel-st-body'), 14);
  if (h.debug.ctls.red.getSelection().manner !== 'nasal') F('단추 밖에서 뗐는데 눌림');
  // 발사 단추: 청팀이 발사를 누르는 동안 홍팀은 카드를 누름(포인터 엇갈림), 뒤따르는 click은 한 번 삼킴
  DT.hold('blue'); DT.hold('red');
  P('pointerdown', DT.fireBtn('blue'), 21);
  P('pointerdown', card('red', 'manner', 'liquid'), 22);
  P('pointerup', DT.fireBtn('blue'), 21);
  if (!DT.busy('blue')) F('청팀 발사가 포인터로 안 눌림');
  DT.fireBtn('blue').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  P('pointerup', card('red', 'manner', 'liquid'), 22);
  if (h.debug.ctls.red.getSelection().manner !== 'liquid') F('청팀이 발사하는 동안 홍팀 누르기가 막힘');
  card('red', 'manner', 'liquid').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  // 홍팀도 포인터로 발사(청팀 애니메이션이 도는 중)
  P('pointerdown', DT.fireBtn('red'), 31);
  P('pointerup', DT.fireBtn('red'), 31);
  if (!DT.busy('red') || !DT.busy('blue')) F('두 팀이 함께 발사 중이 아님');
  const wb = DT.whenIdle('blue'), wr = DT.whenIdle('red');
  DT.unhold('red'); await wr;
  DT.unhold('blue'); await wb;
  const s = DT.st();
  if (s.teams.blue.shots.length !== 1 || s.teams.red.shots.length !== 1) F('포인터 발사 수(두 번 세지 않음) ' + [s.teams.blue.shots.length, s.teams.red.shots.length]);
  if (s.teams.blue.shots[0].sound !== 'ㄲ' || s.teams.red.shots[0].input.place !== 'bilabial' || s.teams.red.shots[0].input.manner !== 'liquid') F('포인터 발사 조합 ' + JSON.stringify([s.teams.blue.shots[0].input, s.teams.red.shots[0].input]));
  // 한참 뒤의 진짜 click(키보드 등)은 그대로 들어감
  await DT.wait(G.duel.config.clickGuard + 100);
  card('blue', 'manner', 'nasal').click();
  if (h.debug.ctls.blue.getSelection().manner !== 'nasal') F('보통 click이 안 들어감');
  // 문서 전체 누르기 잠금이 없는지: 두 자리 모두 pointerdown이 막히지 않음(기본 동작을 막지 않음)
  const ev = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch' });
  DT.station('red').querySelector('.ctl-card').dispatchEvent(ev);
  if (ev.defaultPrevented) F('조작부 pointerdown의 기본 동작을 막음');
  const ta = getComputedStyle(DT.station('blue')).touchAction;
  if (ta !== 'manipulation') F('팀 자리 touch-action: ' + ta);
  return { fails, errs: window.__soriErrors.slice() };
}

// ── 5) 숨기기 시간 ────────────────────────────────────────────────────
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
  const idsIn = (cell) => [...cell.querySelectorAll('.sb-snd')].map((e) => e.textContent.replace(/\//g, ''));
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
  document.querySelector('.duel-done').click();
  if (document.querySelector('.duel-line').textContent !== TEXT.duel.hide.autoFilled) F('대신 숨김 줄: ' + document.querySelector('.duel-line').textContent);
  if (!(await DT.until(() => DT.screen() === 'gate', 3000))) F('홍팀 가림 화면으로 안 감');
  if (gateText() !== TEXT.duel.gate.red) F('홍팀 가림 글: ' + gateText());
  if (document.querySelector('.sb')) F('가림 화면에 바다가 보임(홍)');
  const bf = DT.st().teams.blue.fleet;
  if (bf.length !== 3 || bf[0].sounds.join('') !== 'ㄱㄲㅋ' || bf.map((s) => s.size).join('') !== '321') F('청팀 함대 채움 ' + JSON.stringify(bf));
  if (DT.st().placingTeam !== 'red') F('홍팀 배치 차례 아님');
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
  if (DT.st().phase !== 'playing' || DT.st().teams.blue.shots.length || DT.st().teams.red.shots.length) F('배치가 끝났는데 대결 판이 아님');
  sv = G.save.loadGame();
  if (!sv || sv.phase !== 'playing' || JSON.stringify(sv.teams) !== JSON.stringify(DT.st().teams)) F('배치 끝 판이 저장되지 않음');
  document.querySelector('.duel-gate-go').click();
  if (DT.screen() !== 'play' || DT.phase() !== 'play') F('대결 시작 아님: ' + DT.screen());
  const red = DT.fleetIds('red'), blue = DT.fleetIds('blue');
  const notBlue = window.SOUNDS.consonants.map((s) => s.id).filter((id) => blue.indexOf(id) < 0);
  await DT.shot('blue', red[0]);
  await DT.shot('red', notBlue[0]);
  if (DT.st().teams.blue.shots[0].kind !== 'hit' || DT.st().teams.red.shots.length !== 1) F('숨긴 배를 쏴서 명중이 아님');
  // 2단계: 따라 해 보기 없음(외치고 발사 줄)
  DT.compose('blue', { place: 'bilabial', manner: 'nasal' });
  if (DT.msgKind('blue') === 'follow') F('2단계인데 따라 해 보기가 뜸');
  return { fails, errs: window.__soriErrors.slice() };
}

// ── 6) 배치 도중 새로고침 ─────────────────────────────────────────────
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

// ── 7) 대결 도중 새로고침 → 이어서 하기(두 팀의 발 수가 다르고, 한 팀은 발을 다 씀) ──
async function playBeforeReload() {
  const fails = [], F = (m) => fails.push(m);
  try { localStorage.clear(); } catch (e) { /* 막힘 */ }
  const h = G.duel.open({});
  DT.setup({ grade: 'm3', sea: 'consonant', level: 1, hideTime: false });
  const red = DT.fleetIds('red'), blue = DT.fleetIds('blue');
  const open = G.rules.level('consonant', 1).open;
  const DUDS = [{ place: 'glottal', manner: 'stop' }, { place: 'palatal', manner: 'stop' }, { place: 'bilabial', manner: 'fricative' }, { place: 'velar', manner: 'fricative' }];
  const bShots = [red[0]].concat(open.filter((id) => red.indexOf(id) < 0), DUDS).slice(0, 8); // 청: 8발(다 씀)
  const notBlue = open.filter((id) => blue.indexOf(id) < 0);
  await DT.shot('red', blue[0]);                   // 홍: 명중
  for (const x of bShots) await DT.shot('blue', x);
  await DT.shot('red', notBlue[0]);                // 홍: 빗나감 또는 같은 줄
  const st = DT.st();
  if (st.teams.blue.shots.length !== 8 || st.teams.red.shots.length !== 2 || st.phase !== 'playing') F('준비한 판이 아님 ' + [st.teams.blue.shots.length, st.teams.red.shots.length, st.phase]);
  // 홍팀이 고르는 중에 새로고침(고르던 것은 저장하지 않음)
  DT.compose('red', notBlue[1]);
  const marks = { blue: h.debug.boards.blue.el.querySelectorAll('.sb-mark').length, red: h.debug.boards.red.el.querySelectorAll('.sb-mark').length };
  return { fails, errs: window.__soriErrors.slice(), pass: { json: JSON.stringify(st), marks, log: [DT.logCount('blue'), DT.logCount('red')], sunk: document.querySelectorAll('.sb-ship-item.is-sunk').length, nb1: notBlue[1] } };
}
async function playAfterReload(prev) {
  const fails = [], F = (m) => fails.push(m);
  await DT.until(() => G.duel.current, 3000);
  if (DT.screen() !== 'play') F('이어서 하기가 대결 화면이 아님: ' + DT.screen());
  if (JSON.stringify(DT.st()) !== prev.json) F('되살린 판이 저장 전과 다름');
  const fillN = (k, n) => G.text.fill(TEXT.duel[k], { n });
  if (DT.shotsLeft().join('|') !== [0, 6].map((n) => fillN('shotsLeft', n)).join('|')) F('되살린 남은 발: ' + DT.shotsLeft());
  if (!DT.isOut('blue') || DT.msg('blue') !== TEXT.duel.outOfShots || !DT.fireBtn('blue').disabled || !DT.station('blue').querySelector('.ctl-card').disabled) F('되살린 뒤 청팀(발 소진)이 기다림 상태가 아님: ' + DT.msg('blue'));
  if (DT.isOut('red') || DT.station('red').querySelector('.ctl-card').disabled) F('되살린 뒤 홍팀이 잠김');
  if (DT.h().debug.ctls.red.getSelection().place) F('고르던 것이 되살아남');
  if (DT.logCount('blue') !== prev.log[0] || DT.logCount('red') !== prev.log[1]) F('기록장 ' + [DT.logCount('blue'), DT.logCount('red')] + ' / ' + prev.log);
  const m = { blue: DT.h().debug.boards.blue.el.querySelectorAll('.sb-mark').length, red: DT.h().debug.boards.red.el.querySelectorAll('.sb-mark').length };
  if (m.blue !== prev.marks.blue || m.red !== prev.marks.red) F('판 표시 ' + JSON.stringify(m) + ' / ' + JSON.stringify(prev.marks));
  if (document.querySelectorAll('.sb-ship-item.is-sunk').length !== prev.sunk) F('남은 배 목록');
  await DT.shot('red', prev.nb1);
  if (DT.st().teams.red.shots.length !== 3 || G.save.loadGame().teams.red.shots.length !== 3 || G.save.loadGame().teams.blue.shots.length !== 8) F('되살린 뒤 이어서 쏘기·저장 안 됨');
  return { fails, errs: window.__soriErrors.slice() };
}

// ── 8) 휴대폰(세로·눕힘) 틀 ───────────────────────────────────────────
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

// ── 9) 칠판·노트북 상자: 넘침 없음·크기 · 캡처 ─────────────────────────
async function playShot() {
  const fails = [], F = (m) => fails.push(m);
  try { localStorage.clear(); } catch (e) { /* 막힘 */ }
  G.duel.open({});
  DT.setup({ grade: 'm3', sea: 'consonant', level: 2, hideTime: false });
  const red = DT.fleetIds('red'), blue = DT.fleetIds('blue');
  const notBlue = window.SOUNDS.consonants.map((s) => s.id).filter((id) => blue.indexOf(id) < 0);
  const notRed = window.SOUNDS.consonants.map((s) => s.id).filter((id) => red.indexOf(id) < 0 && id !== 'ㅎ');
  await DT.shots([['blue', red[0]], ['red', notBlue[0]], ['blue', notRed[notRed.length - 1]], ['red', blue[0]], ['blue', red[1]]]);
  // 청팀은 발사 중(공기 흐름), 홍팀은 고르는 중(두 모습을 한 화면에)
  DT.hold('blue');
  DT.shot('blue', ['ㄲ', 'ㅃ', 'ㄸ'].find((id) => !DT.st().teams.blue.shots.some((x) => x.sound === id)));
  DT.compose('red', { place: 'alveolar', manner: 'fricative', strength: 'plain' });
  await DT.wait(1200);
  const root = document.querySelector('.duel');
  const R = root.getBoundingClientRect();
  if (root.scrollWidth > root.clientWidth + 1 || root.scrollHeight > root.clientHeight + 1) F('화면이 넘침 ' + root.scrollWidth + '×' + root.scrollHeight);
  const within = (e, box, tag) => {
    const q = e.getBoundingClientRect();
    if (q.left < box.left - 1 || q.right > box.right + 1 || q.top < box.top - 1 || q.bottom > box.bottom + 1) F(tag + '이(가) 밖으로 나감 ' + JSON.stringify([Math.round(q.left), Math.round(q.right), Math.round(q.top), Math.round(q.bottom)]));
  };
  const info = {};
  for (const t of ['blue', 'red']) {
    const s = DT.station(t);
    const S = s.getBoundingClientRect();
    within(s, R, t + ' 자리');
    const sb = s.querySelector('.sb'), boardBox = s.querySelector('.duel-board').getBoundingClientRect();
    within(sb, boardBox, t + ' 바다(칸 안)');
    within(sb, S, t + ' 바다');
    within(s.querySelector('.duel-sea-name'), S, t + ' 바다 이름표');
    within(s.querySelector('.ctl'), S, t + ' 조작부');
    within(s.querySelector('.ctl-fire'), S, t + ' 발사 단추');
    if (!DT.visible(s.querySelector('.ctl-fire'))) F(t + ' 발사 단추가 안 보임');
    // 단면도(목 뒤 살까지)가 자기 자리 안에 있고 자기 바다와 겹치지 않음
    const head = s.querySelector('.mouth-svg .mouth-tissue').getBoundingClientRect(), sbr = sb.getBoundingClientRect();
    if (head.left < S.left - 1 || head.right > S.right + 1) F(t + ' 단면도가 자리 밖으로 나감');
    if (head.right > sbr.left && head.left < sbr.right) F(t + ' 단면도가 바다와 겹침');
    const nm = s.querySelector('.duel-sea-name').getBoundingClientRect();
    if (nm.bottom > sbr.top + 1) F(t + ' 바다 이름표가 판을 가림');
    const small = [...s.querySelectorAll('.ctl-card, .ctl-fire')].filter((b) => b.offsetHeight < 64 || b.offsetWidth < 64);
    if (small.length) F(t + ' 64px 보다 작은 조작 단추 ' + small.length + '개');
    const msgFont = parseFloat(getComputedStyle(s.querySelector('.ctl-msg')).fontSize);
    if (msgFont < 22) F(t + ' 한 줄 문구 글씨 ' + msgFont);
    const cell = s.querySelector('.sb-cell'), mouth = s.querySelector('.mouth-svg');
    info[t] = { station: [Math.round(S.width), Math.round(S.height)], cell: [cell.offsetWidth, cell.offsetHeight], mouth: [mouth.clientWidth, mouth.clientHeight], msgFont };
  }
  // 위 띠 글이 잘리지 않음
  document.querySelectorAll('.duel-side .duel-stat').forEach((e) => { if (e.scrollWidth > e.clientWidth + 1) F('위 띠 글 잘림: ' + e.textContent); });
  // 두 단면도가 서로 겹치지 않음
  const hb = DT.station('blue').querySelector('.mouth-svg .mouth-tissue').getBoundingClientRect();
  const hr = DT.station('red').querySelector('.mouth-svg .mouth-tissue').getBoundingClientRect();
  if (hb.right > hr.left) F('두 단면도가 겹침');
  if (!DT.busy('blue') || DT.busy('red')) F('캡처용 상태(청 발사 중, 홍 고르는 중)가 아님');
  info.box = [root.clientWidth, root.clientHeight];
  info.teamFont = getComputedStyle(document.querySelector('.duel-team')).fontSize;
  info.top = [DT.shipsLeft(), DT.shotsLeft()];
  return { fails, errs: window.__soriErrors.slice(), info };
}
// 한 팀이 발을 다 써서 기다리는 모습 캡처
async function outShot() {
  const fails = [], F = (m) => fails.push(m);
  try { localStorage.clear(); } catch (e) { /* 막힘 */ }
  Object.assign(G.duel.config, { outLineDelay: 0 });
  G.duel.open({});
  DT.setup({ grade: 'm3', sea: 'vowel', level: 1, hideTime: false });
  const red = DT.fleetIds('red');
  const miss = window.SOUNDS.vowels.map((v) => v.id).filter((id) => red.indexOf(id) < 0);
  const B = [red[0]].concat(miss, [{ backness: 'front', height: 'low', lips: 'rounded' }, { backness: 'back', height: 'low', lips: 'rounded' }], red.slice(1)).slice(0, 8);
  await DT.shots(B.map((x) => ['blue', x]));
  await DT.shot('red', DT.fleetIds('blue')[0]);
  DT.compose('red', 'ㅏ');
  await DT.wait(300);
  if (DT.st().phase !== 'playing' || !DT.isOut('blue') || DT.msg('blue') !== TEXT.duel.outOfShots) F('캡처용 기다림 상태가 아님: ' + DT.msg('blue'));
  const root = document.querySelector('.duel');
  if (root.scrollHeight > root.clientHeight + 1) F('화면이 넘침');
  return { fails, errs: window.__soriErrors.slice() };
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

flow('무작위 배치 한 판: 두 팀이 따로·엇갈려 쏘기·발 안 쓰는 결과·먼저 다 찾은 팀 즉시 승·공개·finishGame', [{ url: FAST, fn: randomRealtime }]);
flow('발 소진: 다 쓴 팀은 잠기고 기다림 → 상대 계속 → 두 팀 소진 맞힌 칸 비교, 공개 중 처음으로', [{ url: FAST, fn: outOfShots }]);
flow('두 팀 소진·맞힌 칸 같음 → 무승부(모음 바다)', [{ url: FAST, fn: vowelTie }]);
flow('진짜 애니메이션: 두 자리의 공기 흐름이 겹쳐 돎', [{ url: PAGE + '?manual=1', fn: overlapAnim }]);
flow('여러 손가락: 두 자리 동시 누르기·발사', [{ url: FAST, fn: multiTouch }]);
flow('숨기기 시간: 가림 화면·그 팀 바다만·큰 배부터·일찍 끝·시간 초과 채움 → 대결', [{ url: FAST, fn: hidePlacement }]);
flow('배치 도중 새로고침 → 청팀 배치부터 다시', [{ url: FAST, fn: placingBeforeReload }, { url: PAGE + '?resume=1&rm=1', fn: placingAfterReload }]);
flow('대결 도중 새로고침 → 두 팀의 발·판·기록장·기다림 그대로 이어서', [{ url: FAST, fn: playBeforeReload }, { url: PAGE + '?resume=1&rm=1', fn: playAfterReload }]);
flow('휴대폰 세로 390×844: 대결 안내 한 줄', [{ url: frame(390, 844, 'tests/pages/duel.html'), fn: phoneNotice }]);
flow('눕힌 휴대폰 844×390: 대결 안내 한 줄', [{ url: frame(844, 390, 'tests/pages/duel.html'), fn: phoneNotice }]);
flow('칠판 1920×1080 대결 화면 캡처', [{ url: PAGE + '?manual=1&rm=1&box=1920x1080', fn: playShot, shot: { name: 'duel-1920x1080-play', wait: 300 } }]);
flow('칠판 1920×1080 발 소진·기다림 캡처', [{ url: PAGE + '?manual=1&rm=1&box=1920x1080', fn: outShot, shot: { name: 'duel-1920x1080-out', wait: 300 } }]);
flow('칠판 1920×1080 배치 화면 캡처', [{ url: PAGE + '?manual=1&rm=1&box=1920x1080', fn: placeShot, shot: { name: 'duel-1920x1080-place', wait: 300 } }]);
flow('노트북 1366×768 대결 화면 캡처', [{ url: PAGE + '?manual=1&rm=1&box=1366x768', fn: playShot, shot: { name: 'duel-1366x768-play', wait: 300 } }]);
flow('노트북 1366×768 발 소진·기다림 캡처', [{ url: PAGE + '?manual=1&rm=1&box=1366x768', fn: outShot, shot: { name: 'duel-1366x768-out', wait: 300 } }]);
