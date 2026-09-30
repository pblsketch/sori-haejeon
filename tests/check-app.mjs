// 앱 뼈대 G.app 점검(aside). 점검용 페이지 tests/pages/app.html: 진짜 스크립트 + 연습·대결 흉내(window.__calls) + app.js + main.js
//   1) 시작 화면이 그려지고, 설정을 바꾸면 곧바로 적용(G.audio.state, reduce-motion)·저장되어 새로고침 뒤에도 남음
//   2) 규칙 엔진으로 만든 진짜 판 → finishGame → 결과 화면(소리 지도·기록·나온 알아 두기만·질문 하나),
//      결과 화면에서 새로고침 → 시작 화면, 누적 지도에 한 번만 더해짐(G.save.mapGames 그대로)
//   3) 알아 두기가 없는 판(칸 숨김)과 대결 결과(두 팀·승패), '한 판 더'
//   4) 이 기기의 소리 지도(마지막 선택 학년의 용어) · 기록 지우기(확인 받기)
//   5) 하던 판이 있으면 '이어서 하기 / 새 판' → G.practice.open({ resume: true }) / 진행 판 지움
//   6) 크기별 틀: 휴대폰 세로 390×844·360×740(시작·결과가 읽힘, 대결 누르면 안내), 가로 휴대폰 844×390('세로로 돌려 주세요')
//   7) 캡처: 1920×1080 상자의 시작·결과 화면(연습·대결), 휴대폰 세로 틀
//   모든 단계에서 window.__soriErrors가 비어 있어야 한다.
import { step, url, frame } from './aside.mjs';

const PAGE = url('tests/pages/app.html');
const J = JSON.stringify;

// 페이지 안에서 쓰는 도우미(각 evaluate 앞에 붙임): 진짜 판 만들기
const HELP = `
  const FLEET1 = [{ size: 2, sounds: ['ㄷ', 'ㄴ'] }, { size: 1, sounds: ['ㅇ'] }, { size: 1, sounds: ['ㄹ'] }];
  const shoot = (st, list) => { for (const s of list) st = G.rules.fire(st, typeof s === 'string' ? G.rules.inputOf(s) : s).state; return st; };
  const newPractice = (shots, grade) => {
    let st = G.rules.newGame({ mode: 'practice', grade: grade || 'm3', sea: 'consonant', level: 1, fleet: FLEET1, rng: G.rules.makeRng(3) });
    st.id = G.save.newGameId();
    return shoot(st, shots || []);
  };
  // 모두 찾음: 알아 두기 = /ㄷ/·/ㄴ/ 짝, /ㅇ/
  const WIN = ['ㅅ', 'ㄴ', 'ㄷ', 'ㅇ', 'ㄹ'];
  // 턴 소진, 알아 두기 없음, 없는 소리 2번
  const MISS = ['ㅂ', 'ㄷ', 'ㄱ', 'ㅈ', 'ㅅ', 'ㄹ', { place: 'bilabial', manner: 'fricative', strength: null }, { place: 'velar', manner: 'fricative', strength: null }];
  const newDuel = () => {
    let st = G.rules.newGame({ mode: 'duel', grade: 'h1', sea: 'consonant', level: 1, fleets: { blue: FLEET1, red: FLEET1 }, rng: G.rules.makeRng(5) });
    st.id = G.save.newGameId();
    // 실시간(차례 없음): 홍 ㅂ ㅈ(못 찾음) · 청 ㄷ ㄴ ㅇ ㄹ(4발에 다 찾음 → 그 순간 청팀 승) — 두 팀의 발 수가 다름
    for (const [t, x] of [['red', 'ㅂ'], ['blue', 'ㄷ'], ['blue', 'ㄴ'], ['red', 'ㅈ'], ['blue', 'ㅇ'], ['blue', 'ㄹ']]) st = G.rules.fireTeam(st, t, G.rules.inputOf(x)).state;
    return st;
  };
  const txt = (sel) => [...document.querySelectorAll(sel)].map((e) => e.textContent.trim());
  const shown = (e) => !!e && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().height > 0;
`;
const tail = (v) => `
  if (${v}.errs.length) ${v}.fails.push('페이지 오류: ' + ${v}.errs.join(' | '));
  if (${v}.fails.length) console.log('FAIL ' + ${v}.fails.join('\\nFAIL '));
  else console.log('PASS');
`;
// aside에는 waitForFunction·reload가 없어서 evaluate로 기다린다
const until = `
async function until(tab, fn, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 10000)) {
    try { if (await tab.evaluate(fn)) return true; } catch (e) { /* 넘어가는 중 */ }
    await sleep(150);
  }
  throw new Error('기다림 초과');
}
`;
const reloadFn = until + `
async function reloadTab(tab) {
  // ?reset=1은 빼고 다시 연다(저장 값이 남아 있어야 하므로)
  await tab.evaluate(() => { window.__old = true; const u = new URL(location.href); u.searchParams.delete('reset'); setTimeout(() => location.replace(u.href), 0); }).catch(() => {});
  await until(tab, () => !window.__old && window.G && G.app && G.app.current && !!G.app.current());
}
`;

step('시작 화면 · 설정 바꾸기가 곧바로 적용·저장', `
${reloadFn}
const a1 = await openTab(${J(PAGE + '?reset=1')});
try {
  const f1 = [];
  const r1 = await a1.evaluate(() => {
    ${HELP}
    const fails = []; const F = (m) => fails.push(m);
    if (G.app.current() !== 'title') F('처음 화면이 title이 아님: ' + G.app.current());
    const h1 = document.querySelector('.app-title .app-title-name');
    if (!h1 || h1.textContent !== TEXT.ui.title) F('제목 없음');
    const M = TEXT.ui.menu;
    const want = [M.practice, M.duel, M.soundmap, M.settings, M.credits];
    if (J(txt('.app-menu .app-btn')) !== J(want)) F('메뉴: ' + J(txt('.app-menu .app-btn')));
    if (document.querySelector('.app-dialog')) F('하던 판이 없는데 묻기 창이 뜸');
    if (G.audio.state().track !== 'practice') F('시작 화면 배경 음악: ' + G.audio.state().track);
    const bg = getComputedStyle(document.querySelector('.app-title')).backgroundImage;
    if (!/title\\.webp/.test(bg)) F('시작 화면 그림 없음: ' + bg);
    if (!document.querySelector('.app-rotate')) F('세로로 돌려 주세요 덮개 없음');
    if (shown(document.querySelector('.app-rotate'))) F('넓은 창에서 세로로 돌려 주세요가 보임');
    if (/글자/.test(document.body.textContent)) F("'글자'라는 말이 있음");
    for (const b of document.querySelectorAll('.app-menu .app-btn')) if (b.getBoundingClientRect().height < 63.5) F('메뉴 단추 높이 ' + b.getBoundingClientRect().height);
    return { fails, errs: window.__soriErrors.slice() };
    function J(x) { return JSON.stringify(x); }
  });
  f1.push(...r1.fails, ...r1.errs.map((e) => '페이지 오류: ' + e));
  // 설정 화면: 실제로 누르기
  await a1.locator('[data-go="settings"]').click();
  await a1.locator('[data-key="bgmOn"] [data-v="off"]').click();
  await a1.locator('[data-key="sfxOn"] [data-v="off"]').click();
  await a1.locator('[data-key="reduceMotion"] [data-v="on"]').click();
  const r2 = await a1.evaluate(() => {
    const fails = []; const F = (m) => fails.push(m);
    if (G.app.current() !== 'settings') F('설정 화면이 아님');
    const inp = document.querySelector('input[data-key="bgmVolume"]');
    inp.value = '30'; inp.dispatchEvent(new Event('input', { bubbles: true }));
    const inp2 = document.querySelector('input[data-key="sfxVolume"]');
    inp2.value = '45'; inp2.dispatchEvent(new Event('input', { bubbles: true }));
    const a = G.audio.state();
    if (a.bgmOn !== false || a.sfxOn !== false) F('켜기/끄기가 소리 엔진에 반영 안 됨: ' + JSON.stringify(a));
    if (Math.abs(a.bgmVolume - 0.3) > 1e-6 || Math.abs(a.sfxVolume - 0.45) > 1e-6) F('음량이 반영 안 됨: ' + a.bgmVolume + ' ' + a.sfxVolume);
    if (!document.documentElement.classList.contains('reduce-motion')) F('움직임 줄이기 클래스가 없음');
    const raw = JSON.parse(localStorage.getItem('sori-haejeon:settings') || '{}');
    if (raw.bgmOn !== false || raw.sfxOn !== false || raw.reduceMotion !== true || raw.bgmVolume !== 0.3) F('저장 안 됨: ' + JSON.stringify(raw));
    const p = (sel) => document.querySelector(sel).getAttribute('aria-pressed');
    if (p('[data-key="bgmOn"] [data-v="off"]') !== 'true' || p('[data-key="bgmOn"] [data-v="on"]') !== 'false') F('켜기/끄기 단추 표시');
    if (!document.querySelector('input[data-key="bgmVolume"]').closest('.app-set-row').classList.contains('is-off')) F('끈 줄의 음량이 흐려지지 않음');
    return { fails, errs: window.__soriErrors.slice() };
  });
  f1.push(...r2.fails, ...r2.errs.map((e) => '페이지 오류: ' + e));
  // 새로고침해도 설정이 남고 적용됨
  await reloadTab(a1);
  await a1.locator('[data-go="settings"]').click();
  const r3 = await a1.evaluate(() => {
    const fails = []; const F = (m) => fails.push(m);
    const a = G.audio.state();
    if (a.bgmOn !== false || a.sfxOn !== false || Math.abs(a.bgmVolume - 0.3) > 1e-6) F('새로고침 뒤 소리 설정이 적용 안 됨: ' + JSON.stringify(a));
    if (!document.documentElement.classList.contains('reduce-motion')) F('새로고침 뒤 움직임 줄이기가 적용 안 됨');
    if (document.querySelector('input[data-key="bgmVolume"]').value !== '30') F('음량 막대 값: ' + document.querySelector('input[data-key="bgmVolume"]').value);
    if (document.querySelector('[data-key="reduceMotion"] [data-v="on"]').getAttribute('aria-pressed') !== 'true') F('움직임 줄이기 단추 표시');
    return { fails, errs: window.__soriErrors.slice() };
  });
  f1.push(...r3.fails, ...r3.errs.map((e) => '페이지 오류: ' + e));
  await a1.locator('[data-key="reduceMotion"] [data-v="off"]').click();
  await a1.locator('[data-key="bgmOn"] [data-v="on"]').click();
  const r4 = await a1.evaluate(() => ({ rm: document.documentElement.classList.contains('reduce-motion'), on: G.audio.state().bgmOn, errs: window.__soriErrors.slice() }));
  if (r4.rm || r4.on !== true) f1.push('다시 켜기/끄기가 반영 안 됨 ' + JSON.stringify(r4));
  await a1.locator('.app-back').click();
  const r5 = await a1.evaluate(() => G.app.current());
  if (r5 !== 'title') f1.push('뒤로 → 시작 화면이 아님: ' + r5);
  const res1 = { fails: f1, errs: r4.errs };
  ${tail('res1')}
} finally { await closeTab(a1); }
`);

step('결과 화면 · 새로고침해도 누적 지도에 한 번만', `
${reloadFn}
const b1 = await openTab(${J(PAGE + '?reset=1')});
try {
  const f2 = [];
  const q1 = await b1.evaluate(() => {
    ${HELP}
    const fails = []; const F = (m) => fails.push(m);
    let st = newPractice(['ㅅ']);
    G.save.saveGame(st);                         // 진행 판이 저장된 상태에서
    if (!G.save.hasGame()) F('진행 판 저장 안 됨');
    st = shoot(st, WIN.slice(1));
    if (st.phase !== 'over' || !st.result.success) F('사례 판이 끝나지 않음');
    const rec = G.rules.makeRecord(st);
    G.app.finishGame(st);
    if (G.app.current() !== 'result') F('결과 화면이 아님');
    if (G.save.mapGames('consonant') !== 1) F('누적 지도 판 수: ' + G.save.mapGames('consonant'));
    if (G.save.hasGame()) F('진행 판이 지워지지 않음');
    if (JSON.stringify(G.save.soundMap('consonant').sort()) !== JSON.stringify(rec.hitSoundsAll.slice().sort())) F('누적 지도 소리: ' + G.save.soundMap('consonant'));
    if (G.audio.state().track !== 'result') F('결과 배경 음악: ' + G.audio.state().track);
    // 소리 지도: 이번 판에 맞힌 소리만 도장
    const maps = document.querySelectorAll('.app-res-map .sb');
    if (maps.length !== 1) F('소리 지도 수: ' + maps.length);
    const stamps = txt('.app-res-map .sb-mark.k-hit :is(.sb-snd, .sb-stamp)').sort();
    const want = rec.hitSoundsAll.map((x) => '/' + x + '/').sort();
    if (JSON.stringify(stamps) !== JSON.stringify(want)) F('소리 지도 도장: ' + JSON.stringify(stamps) + ' / ' + JSON.stringify(want));
    // 기록
    if (txt('[data-k="turns"]')[0] !== '5턴') F('턴: ' + txt('[data-k="turns"]'));
    if (txt('[data-k="none"]')[0] !== '0번') F('없는 소리: ' + txt('[data-k="none"]'));
    if (txt('[data-k="hits"]')[0] !== G.text.fill(TEXT.ui.result.hitsN, { n: 4 })) F('맞힌 소리: ' + txt('[data-k="hits"]'));
    if (!document.querySelector('.app-res-done')) F('모두 찾음 줄 없음');
    // 알아 두기: 나온 것만(짝 /ㄷ/·/ㄴ/, /ㅇ/)
    const notes = txt('.app-res-note');
    const wantN = rec.notes.map((n) => G.text.know(n.id));
    if (JSON.stringify(rec.notes.map((n) => n.id)) !== JSON.stringify(['pair-ㄷㄴ', 'ng'])) F('사례 알아 두기 id: ' + JSON.stringify(rec.notes));
    if (JSON.stringify(notes) !== JSON.stringify(wantN)) F('알아 두기: ' + JSON.stringify(notes));
    if (/\\/ㅂ\\/과 \\/ㅁ\\/|\\/ㄱ\\/과 \\/ㅇ\\//.test(document.querySelector('.app-res-know').textContent)) F('나오지 않은 알아 두기가 보임'); // 질문은 판마다 달라서 알아 두기 칸만 본다
    // 질문 하나
    const qs = txt('.app-res-question');
    if (qs.length !== 1 || G.text.debrief('m3', 'consonant').indexOf(qs[0]) < 0) F('생각해 볼 질문: ' + JSON.stringify(qs));
    const btns = txt('.app-res-btns .app-btn');
    if (JSON.stringify(btns) !== JSON.stringify([TEXT.ui.result.again, TEXT.ui.result.home])) F('결과 단추: ' + JSON.stringify(btns));
    if (/글자/.test(document.body.textContent)) F("'글자'라는 말이 있음");
    // 같은 판을 또 끝내도(두 번 불림) 누적은 그대로
    G.app.finishGame(st);
    if (G.save.mapGames('consonant') !== 1) F('같은 판이 두 번 더해짐');
    // 가로 1440 창: 결과 화면이 한 화면 안(스크롤 없음)
    const d = document.documentElement;
    if (d.scrollHeight > d.clientHeight + 1) F('가로 창에서 결과 화면이 넘침 ' + d.scrollHeight + ' > ' + d.clientHeight);
    if (d.scrollWidth > d.clientWidth + 1) F('가로 스크롤');
    return { fails, errs: window.__soriErrors.slice() };
  });
  f2.push(...q1.fails, ...q1.errs.map((e) => '페이지 오류: ' + e));
  await reloadTab(b1);
  const q2 = await b1.evaluate(() => ({
    cur: G.app.current(), dialog: !!document.querySelector('.app-dialog'), games: G.save.mapGames('consonant'), has: G.save.hasGame(), errs: window.__soriErrors.slice(),
  }));
  if (q2.cur !== 'title') f2.push('결과에서 새로고침 → ' + q2.cur);
  if (q2.dialog || q2.has) f2.push('새로고침 뒤 하던 판이 남아 있음');
  if (q2.games !== 1) f2.push('새로고침 뒤 누적 판 수: ' + q2.games);
  const res2 = { fails: f2, errs: q2.errs };
  ${tail('res2')}
} finally { await closeTab(b1); }
`);

step('알아 두기 없는 판 · 대결 결과 · 한 판 더', `
const c1 = await openTab(${J(PAGE + '?reset=1')});
try {
  const r6 = await c1.evaluate(() => {
    ${HELP}
    const fails = []; const F = (m) => fails.push(m);
    const st = newPractice(MISS);
    if (st.phase !== 'over' || st.result.success) F('턴 소진 사례가 아님');
    G.app.finishGame(st);
    if (document.querySelector('.app-res-know')) F('알아 두기가 없는데 칸이 보임');
    if (txt('[data-k="none"]')[0] !== '2번') F('없는 소리 횟수: ' + txt('[data-k="none"]'));
    if (txt('[data-k="turns"]')[0] !== '8턴') F('턴: ' + txt('[data-k="turns"]'));
    if (document.querySelector('.app-res-done')) F('못 찾았는데 모두 찾음 줄');
    if (txt('.app-res-question').length !== 1) F('질문 수');
    // 대결
    const du = newDuel();
    if (du.phase !== 'over' || !du.result || du.result.winner !== 'blue') F('대결 사례: ' + JSON.stringify(du.result));
    const rec = G.rules.makeRecord(du);
    G.app.finishGame(du);
    const maps = [...document.querySelectorAll('.app-res-map')];
    if (maps.map((m) => m.dataset.team).join() !== 'blue,red') F('대결 소리 지도: ' + maps.map((m) => m.dataset.team));
    for (const m of maps) {
      const t = m.dataset.team;
      const got = [...m.querySelectorAll('.sb-mark.k-hit :is(.sb-snd, .sb-stamp)')].map((e) => e.textContent.trim()).sort();
      const want = rec.teams[t].hitSounds.map((x) => '/' + x + '/').sort();
      if (JSON.stringify(got) !== JSON.stringify(want)) F(t + ' 소리 지도: ' + JSON.stringify(got));
      if (m.querySelector('.app-res-maplabel').textContent !== TEXT.teams[t]) F(t + ' 이름표');
    }
    const w = document.querySelector('.app-res-winner');
    if (!w || w.textContent !== TEXT.ui.result.winner.blue || w.dataset.winner !== 'blue') F('승패 줄: ' + (w && w.textContent));
    const stats = [...document.querySelectorAll('.app-res-stats')].map((s) => s.dataset.team + ':' + s.querySelector('[data-k="turns"]').textContent + ':' + s.querySelector('[data-k="none"]').textContent);
    if (JSON.stringify(stats) !== JSON.stringify(['blue:4턴:0번', 'red:2턴:0번'])) F('두 팀 기록: ' + JSON.stringify(stats));
    const notes = txt('.app-res-note');
    if (JSON.stringify(notes) !== JSON.stringify(rec.notes.map((n) => G.text.know(n.id)))) F('대결 알아 두기(두 팀 합침): ' + JSON.stringify(notes));
    if (G.text.debrief('h1', 'consonant').indexOf(txt('.app-res-question')[0]) < 0) F('고1 자음 질문이 아님');
    if (G.save.mapGames('consonant') !== 2) F('누적 판 수: ' + G.save.mapGames('consonant'));
    // 무승부 표시
    const draw = JSON.parse(JSON.stringify(rec)); draw.result = { winner: null, reason: 'hits-tie' };
    G.app.go('result', { record: draw });
    if (txt('.app-res-winner')[0] !== TEXT.ui.result.winner.draw) F('무승부 줄: ' + txt('.app-res-winner'));
    G.app.go('result', { record: rec });
    return { fails, errs: window.__soriErrors.slice() };
  });
  await c1.locator('[data-act="again"]').click();
  const r7 = await c1.evaluate(() => ({ cur: G.app.current(), calls: window.__calls.slice(), stub: !!document.getElementById('stub-duel') }));
  const last = r7.calls[r7.calls.length - 1];
  if (r7.cur !== 'duel' || !r7.stub || !last || last.name !== 'duel' || last.params.resume !== false || !last.params.hasContainer) r6.fails.push('한 판 더 → ' + JSON.stringify(r7));
  ${tail('r6')}
} finally { await closeTab(c1); }
`);

step('이 기기의 소리 지도 · 기록 지우기', `
const d1 = await openTab(${J(PAGE + '?reset=1')});
try {
  await d1.evaluate(() => {
    ${HELP}
    G.save.setSelection({ grade: 'h1' });
    G.save.setSettings({ bgmOn: false });
    G.save.addRecord(G.rules.makeRecord(newPractice(WIN)), 'g-1');
    G.app.go('title');
  });
  await d1.locator('[data-go="soundmap"]').click();
  const s1 = await d1.evaluate(() => {
    ${HELP}
    const fails = []; const F = (m) => fails.push(m);
    if (G.app.current() !== 'soundmap') F('소리 지도 화면이 아님');
    const secs = [...document.querySelectorAll('.app-map')];
    if (secs.map((s) => s.dataset.sea).join() !== 'consonant,vowel') F('바다 구역: ' + secs.map((s) => s.dataset.sea));
    const [cs, vs] = secs;
    const got = [...cs.querySelectorAll('.sb-mark.k-hit :is(.sb-snd, .sb-stamp)')].map((e) => e.textContent.trim()).sort();
    const want = G.save.soundMap('consonant').map((x) => '/' + x + '/').sort();
    if (!want.length || JSON.stringify(got) !== JSON.stringify(want)) F('자음 누적 지도: ' + JSON.stringify(got));
    if (cs.querySelector('.app-map-count').textContent !== G.text.fill(TEXT.ui.result.hitsN, { n: want.length })) F('자음 개수 줄');
    if (vs.querySelector('.app-map-count').textContent !== TEXT.ui.soundmap.empty) F('모음 빈 줄: ' + vs.querySelector('.app-map-count').textContent);
    if (vs.querySelectorAll('.sb-mark.k-hit').length) F('모음 지도에 도장');
    const ch = [...cs.querySelectorAll('.sb-ch')].map((e) => e.textContent.trim());
    if (ch[0] !== G.text.short('h1', 'place', 'bilabial')) F('학년 용어(고1)가 아님: ' + ch[0]);
    for (const s of SOUNDS.vowels) if (!vs.textContent.includes('/' + s.id + '/')) F('모음 지도에 /' + s.id + '/ 없음');
    return { fails, errs: window.__soriErrors.slice() };
  });
  await d1.locator('.app-back').click();
  await d1.locator('[data-go="settings"]').click();
  await d1.locator('[data-act="clear"]').click();
  const s2 = await d1.evaluate(() => {
    const cb = document.querySelector('.app-confirm');
    return { confirm: !cb.hidden && cb.getBoundingClientRect().height > 0, ok: cb.querySelector('.app-confirm-ask').textContent === TEXT.ui.settings.clearConfirm, games: G.save.mapGames('consonant') };
  });
  if (!s2.confirm || !s2.ok || s2.games !== 1) s1.fails.push('확인 묻기가 안 뜸(또는 묻기 전에 지워짐): ' + JSON.stringify(s2));
  await d1.locator('[data-act="clear-no"]').click();
  const s3 = await d1.evaluate(() => ({ hidden: document.querySelector('.app-confirm').hidden, games: G.save.mapGames('consonant') }));
  if (!s3.hidden || s3.games !== 1) s1.fails.push('그만두기 뒤: ' + JSON.stringify(s3));
  await d1.locator('[data-act="clear"]').click();
  await d1.locator('[data-act="clear-yes"]').click();
  const s4 = await d1.evaluate(() => ({
    msg: document.querySelector('.app-clear-msg').textContent, want: TEXT.ui.settings.cleared,
    ids: G.save.soundMap('consonant').length, games: G.save.mapGames('consonant'), seen: G.save.seenExample(),
    bgmOn: G.save.getSettings().bgmOn, grade: G.save.getSelection().grade, errs: window.__soriErrors.slice(),
  }));
  if (s4.msg !== s4.want) s1.fails.push('지운 뒤 알림: ' + s4.msg);
  if (s4.ids || s4.games) s1.fails.push('누적 지도가 안 지워짐');
  if (s4.bgmOn !== false || s4.grade !== 'h1') s1.fails.push('설정·마지막 선택까지 지워짐');
  await d1.locator('.app-back').click();
  await d1.locator('[data-go="soundmap"]').click();
  const s5 = await d1.evaluate(() => [...document.querySelectorAll('.app-map-count')].map((e) => e.textContent));
  const s6 = await d1.evaluate(() => [...document.querySelectorAll('.app-map-count')].every((e) => e.textContent === TEXT.ui.soundmap.empty) && !document.querySelector('.sb-mark.k-hit'));
  if (!s6) s1.fails.push('지운 뒤 소리 지도가 비지 않음: ' + JSON.stringify(s5));
  await d1.locator('.app-back').click();
  await d1.locator('[data-go="credits"]').click();
  const s7 = await d1.evaluate(() => ({ cur: G.app.current(), text: document.body.textContent }));
  for (const w of ['Groove Grove', 'Cipher', 'Echoes Of Home', 'Scott Buckley', 'Kevin MacLeod', 'CC0', 'DRFX', 'Kreastricon62', 'qubodup', 'Saltbearer', 'craigsmith', 'Hahmlet', 'Gowun Batang']) {
    if (!s7.text.includes(w)) s1.fails.push('출처에 ' + w + ' 없음');
  }
  if (s7.cur !== 'credits') s1.fails.push('출처 화면이 아님');
  s1.errs.push(...s4.errs);
  ${tail('s1')}
} finally { await closeTab(d1); }
`);

step('하던 판 이어서 하기 / 새 판', `
${reloadFn}
const e1 = await openTab(${J(PAGE + '?reset=1')});
try {
  await e1.evaluate(() => {
    ${HELP}
    G.save.saveGame(newPractice(['ㅅ', 'ㄴ']));
  });
  await reloadTab(e1);
  const u1 = await e1.evaluate(() => {
    const fails = []; const F = (m) => fails.push(m);
    const d = document.querySelector('.app-dialog');
    if (!d) F('묻기 창이 없음');
    else {
      if (d.querySelector('.app-dialog-ask').textContent !== TEXT.ui.resume.ask) F('묻는 줄');
      const b = [...d.querySelectorAll('.app-btn')].map((e) => e.textContent);
      if (JSON.stringify(b) !== JSON.stringify([TEXT.ui.resume.resume, TEXT.ui.resume.fresh])) F('묻기 단추: ' + JSON.stringify(b));
      if (!d.querySelector('.app-dialog-what').textContent.includes(TEXT.seaNames.consonant)) F('어떤 판인지 안 보임');
    }
    return { fails, errs: window.__soriErrors.slice() };
  });
  await e1.locator('[data-act="resume"]').click();
  const u2 = await e1.evaluate(() => ({ cur: G.app.current(), calls: window.__calls.slice() }));
  const c0 = u2.calls[0];
  if (u2.cur !== 'practice' || !c0 || c0.name !== 'practice' || c0.params.resume !== true) u1.fails.push('이어서 하기 → ' + JSON.stringify(u2));
  // 연습 화면 흉내에서 처음으로 → 닫기(destroy) 불림, 판은 아직 있으니 다시 묻기
  await e1.evaluate(() => G.app.go('title'));
  const u3 = await e1.evaluate(() => ({ destroyed: window.__calls.some((c) => c.destroyed), dialog: !!document.querySelector('.app-dialog') }));
  if (!u3.destroyed) u1.fails.push('화면을 바꿀 때 연습 화면 destroy가 불리지 않음');
  if (!u3.dialog) u1.fails.push('시작 화면으로 돌아왔는데 묻기 창이 없음');
  await e1.locator('[data-act="fresh"]').click();
  const u4 = await e1.evaluate(() => ({ has: G.save.hasGame(), dialog: !!document.querySelector('.app-dialog'), menu: getComputedStyle(document.querySelector('.app-menu')).visibility, errs: window.__soriErrors.slice() }));
  if (u4.has || u4.dialog || u4.menu !== 'visible') u1.fails.push('새 판 → ' + JSON.stringify(u4));
  // 대결 진행 판 → 이어서 하기는 G.duel.open({ resume: true })
  await e1.evaluate(() => {
    let st = G.rules.newGame({ mode: 'duel', grade: 'm3', sea: 'vowel', level: 1, rng: G.rules.makeRng(9) });
    st.id = G.save.newGameId();
    G.save.saveGame(st);
    G.app.go('title');
  });
  await e1.locator('[data-act="resume"]').click();
  const u5 = await e1.evaluate(() => ({ cur: G.app.current(), last: window.__calls[window.__calls.length - 1], errs: window.__soriErrors.slice() }));
  if (u5.cur !== 'duel' || u5.last.name !== 'duel' || u5.last.params.resume !== true) u1.fails.push('대결 이어서 하기 → ' + JSON.stringify(u5));
  u1.errs.push(...u4.errs, ...u5.errs);
  ${tail('u1')}
} finally { await closeTab(e1); }
`);

// 크기별 틀: 틀 안 게임 창(frameWin)을 잰다
const portrait = (w, h, shot) => `
{
  const pf = await openTab(${J(frame(w, h, 'tests/pages/app.html?reset=1'))});
  try {
    await pf.evaluate(() => frameReady);
    await until(pf, () => frameWin().G && frameWin().G.app && frameWin().G.app.current() === 'title');
    await sleep(400);
    const m = await pf.evaluate(() => {
      const fw = frameWin(), d = fw.document, fails = [], F = (x) => fails.push('${w}×${h} ' + x);
      const de = d.documentElement;
      const noHScroll = () => { if (de.scrollWidth > de.clientWidth + 1) F('가로 스크롤 ' + de.scrollWidth + ' > ' + de.clientWidth + ' (' + fw.G.app.current() + ')'); };
      if (!fw.G.app.isPortrait()) F('세로 배치로 보지 않음');
      const h1 = d.querySelector('.app-title-name'), q = h1.getBoundingClientRect();
      if (q.left < 0 || q.right > ${w} || q.top < 0 || q.bottom > ${h}) F('제목이 화면 밖');
      if (parseFloat(fw.getComputedStyle(h1).fontSize) < 40) F('제목 글씨가 작음');
      const btns = [...d.querySelectorAll('.app-menu .app-btn')];
      for (const b of btns) {
        const r = b.getBoundingClientRect();
        if (r.height < 47.5) F('메뉴 단추 높이 ' + r.height);
        if (r.left < 0 || r.right > ${w} || r.bottom > ${h}) F('메뉴 단추가 화면 밖: ' + b.textContent);
        if (parseFloat(fw.getComputedStyle(b).fontSize) < 16) F('메뉴 글씨 작음');
      }
      if (fw.getComputedStyle(d.querySelector('.app-rotate')).display !== 'none') F('세로 화면에 세로로 돌려 주세요가 뜸');
      noHScroll();
      // 대결 → 안내 한 줄, 대결은 열지 않음
      d.querySelector('[data-go="duel"]').click();
      const n = d.querySelector('.app-notice');
      if (fw.G.app.current() !== 'title' || fw.__calls.some((c) => c.name === 'duel')) F('세로에서 대결이 열림');
      if (!n.classList.contains('is-on') || fw.getComputedStyle(n).visibility !== 'visible' || n.textContent !== fw.TEXT.duel.phoneNotice) F('대결 안내가 안 뜸: ' + n.textContent);
      const nr = n.getBoundingClientRect();
      if (nr.left < 0 || nr.right > ${w} || nr.bottom > ${h} || nr.top < 0) F('대결 안내가 화면 밖');
      return { fails, errs: (fw.__soriErrors || ['오류 모음 없음']).slice() };
    });
    ${shot ? `try { await fs.mkdir('./artifacts', { recursive: true }); } catch (e) {}
    await fs.writeFile('./artifacts/${shot}-title.png', await pf.screenshot());
    console.log('SHOTFILE:' + path.resolve('./artifacts/${shot}-title.png'));` : ''}
    const m2 = await pf.evaluate(() => {
      const fw = frameWin(), d = fw.document, fails = [], F = (x) => fails.push('${w}×${h} ' + x);
      const de = d.documentElement;
      const noHScroll = () => { if (de.scrollWidth > de.clientWidth + 1) F('가로 스크롤 ' + de.scrollWidth + ' > ' + de.clientWidth + ' (' + fw.G.app.current() + ')'); };
      // 결과 화면(연습·대결)
      const G2 = fw.G;
      const FLEET1 = [{ size: 2, sounds: ['ㄷ', 'ㄴ'] }, { size: 1, sounds: ['ㅇ'] }, { size: 1, sounds: ['ㄹ'] }];
      let st = G2.rules.newGame({ mode: 'duel', grade: 'm3', sea: 'consonant', level: 1, fleets: { blue: FLEET1, red: FLEET1 }, rng: G2.rules.makeRng(5) });
      // 실시간(차례 없음): 청팀이 먼저 다 찾음
      for (const [t, x] of [['blue', 'ㄷ'], ['red', 'ㅂ'], ['blue', 'ㄴ'], ['red', 'ㅈ'], ['red', 'ㅅ'], ['blue', 'ㅇ'], ['blue', 'ㄹ']]) st = G2.rules.fireTeam(st, t, G2.rules.inputOf(x)).state;
      G2.app.finishGame(st);
      noHScroll();
      if (d.querySelectorAll('.app-res-map .sb').length !== 2) F('세로 대결 결과 지도 수');
      st = G2.rules.newGame({ mode: 'practice', grade: 'h1', sea: 'consonant', level: 1, fleet: FLEET1, rng: G2.rules.makeRng(3) });
      for (const s of ['ㅅ', 'ㄴ', 'ㄷ', 'ㅇ', 'ㄹ']) st = G2.rules.fire(st, G2.rules.inputOf(s)).state;
      G2.app.finishGame(st);
      noHScroll();
      for (const e of d.querySelectorAll('.app-result .sb-cell, .app-result .app-btn, .app-res-question, .app-res-note, .app-res-stats')) {
        const r = e.getBoundingClientRect();
        if (r.left < -0.5 || r.right > ${w} + 0.5) { F('결과 요소가 화면 밖: ' + e.className); break; }
      }
      for (const e of d.querySelectorAll('.app-res-question, .app-res-note, .app-res-stats dd')) if (parseFloat(fw.getComputedStyle(e).fontSize) < 15.5) F('결과 글씨 작음: ' + e.className);
      for (const b of d.querySelectorAll('.app-res-btns .app-btn')) if (b.getBoundingClientRect().height < 47.5) F('결과 단추 높이');
      if (d.querySelectorAll('.app-res-question').length !== 1) F('질문 수');
      return { fails, errs: (fw.__soriErrors || ['오류 모음 없음']).slice() };
    });
    m.fails.push(...m2.fails); m.errs = m2.errs;
    if (m.errs.length) m.fails.push('페이지 오류: ' + m.errs.join(' | '));
    if (m.fails.length) console.log('FAIL ' + m.fails.join('\\nFAIL '));
    ${shot ? `await pf.evaluate(() => frameWin().scrollTo(0, 0));
    await fs.writeFile('./artifacts/${shot}-result.png', await pf.screenshot());
    console.log('SHOTFILE:' + path.resolve('./artifacts/${shot}-result.png'));` : ''}
  } finally { await closeTab(pf); }
}
`;

step('휴대폰 세로 390×844 · 360×740: 시작·결과가 읽히고 대결은 안내', `
${until}
${portrait(390, 844, 'app-phone')}
${portrait(360, 740, '')}
console.log('PASS');
`);

step("가로 휴대폰 844×390: '세로로 돌려 주세요' / 태블릿 1280×800: 안 뜸", `
${until}
const lf = await openTab(${J(frame(844, 390, 'tests/pages/app.html?reset=1'))});
try {
  await lf.evaluate(() => frameReady);
  await until(lf, () => frameWin().G && frameWin().G.app && frameWin().G.app.current() === 'title');
  const l1 = await lf.evaluate(() => {
    const fw = frameWin(), d = fw.document, fails = [];
    const o = d.querySelector('.app-rotate');
    if (!o) fails.push('덮개 없음');
    else {
      const r = o.getBoundingClientRect();
      if (fw.getComputedStyle(o).display === 'none') fails.push('세로로 돌려 주세요가 안 뜸');
      if (r.width < 843 || r.height < 389) fails.push('덮개가 화면을 다 덮지 않음 ' + r.width + '×' + r.height);
      if (o.textContent.trim() !== fw.TEXT.rotate) fails.push('덮개 문구: ' + o.textContent);
      const top = d.elementFromPoint(422, 195);
      if (!top || !o.contains(top)) fails.push('덮개가 맨 위가 아님');
    }
    if (!fw.G.app.isLowLandscape()) fails.push('isLowLandscape가 거짓');
    return { fails, errs: (fw.__soriErrors || ['오류 모음 없음']).slice() };
  });
  ${tail('l1')}
} finally { await closeTab(lf); }
const tf2 = await openTab(${J(frame(1280, 800, 'tests/pages/app.html?reset=1'))});
try {
  await tf2.evaluate(() => frameReady);
  await until(tf2, () => frameWin().G && frameWin().G.app && frameWin().G.app.current() === 'title');
  const l2 = await tf2.evaluate(() => {
    const fw = frameWin(), d = fw.document, fails = [];
    if (fw.getComputedStyle(d.querySelector('.app-rotate')).display !== 'none') fails.push('태블릿 가로에 세로로 돌려 주세요가 뜸');
    if (fw.G.app.isPortrait()) fails.push('태블릿 가로를 세로로 봄');
    d.querySelector('[data-go="duel"]').click();
    if (fw.G.app.current() !== 'duel') fails.push('가로에서 대결이 안 열림');
    return { fails, errs: (fw.__soriErrors || ['오류 모음 없음']).slice() };
  });
  if (l2.errs.length) l2.fails.push('페이지 오류: ' + l2.errs.join(' | '));
  if (l2.fails.length) console.log('FAIL ' + l2.fails.join('\\nFAIL '));
} finally { await closeTab(tf2); }
`);

// 캡처: 1920×1080 상자(점검 페이지 ?box=)
const boxShot = (name, setup) => `
{
  const bx = await openTab(${J(PAGE + '?reset=1&box=1920x1080')});
  try {
    await until(bx, () => window.G && G.app && G.app.current() === 'title');
    const z = await bx.evaluate(() => {
      ${HELP}
      const fails = [];
      ${setup}
      const a = document.getElementById('app');
      // 상자(1920×1080) 안에 다 들어가는지: 화면 요소가 상자 밖으로 넘치지 않음
      const sc = a.querySelector('.app-screen');
      if (sc.scrollHeight > 1080 + 1) fails.push('${name}: 1920×1080 상자를 넘침 ' + sc.scrollHeight);
      for (const b of a.querySelectorAll('.app-btn')) if (b.getBoundingClientRect().height / (a.getBoundingClientRect().height / 1080) < 63.5) { fails.push('${name}: 단추가 64px보다 작음'); break; }
      return { fails, errs: window.__soriErrors.slice() };
    });
    await sleep(600);
    if (z.errs.length) z.fails.push('페이지 오류: ' + z.errs.join(' | '));
    if (z.fails.length) console.log('FAIL ' + z.fails.join('\\nFAIL '));
    try { await fs.mkdir('./artifacts', { recursive: true }); } catch (e) {}
    await fs.writeFile('./artifacts/${name}.png', await bx.screenshot());
    console.log('SHOTFILE:' + path.resolve('./artifacts/${name}.png'));
  } finally { await closeTab(bx); }
}
`;

step('캡처: 1920×1080 시작·결과(연습·대결)', `
${until}
${boxShot('app-title-1920', '')}
${boxShot('app-result-1920', 'G.app.finishGame(newPractice(WIN));')}
${boxShot('app-result-duel-1920', 'G.app.finishGame(newDuel());')}
console.log('PASS');
`);
