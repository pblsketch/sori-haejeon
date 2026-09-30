// 연습 모드 화면(js/game/practice.js) 점검(aside). 점검용 페이지 tests/pages/practice.html(index.html과 같은 스크립트 + G.app 흉내).
//  1) 가로: 준비 화면(기본값·'예시 보기'는 자음 1단계만) → 자음 1단계 첫 시작에 풀이 예시 자동(세 줄·세 발·저장 안 함)
//     → 일반 판(무작위 함대, state.id, 저장) → 턴을 안 쓰는 결과(이번 바다에 없는 칸 · 이미 쏜 소리) → 끝까지 → G.app.finishGame
//  2) 가로: 자음 1단계 턴 소진(남은 배 공개 → finishGame 실패 판) · 모음 1단계 끝까지(없는 소리·이미 쏜 소리 포함)
//  3) 가로: 자음 2단계 숨김(칸 안 소리가 DOM 어디에도 없음 — 쏜 칸 도장·기록장만) · '처음으로' · 새로고침 뒤 이어서 하기(판·기록장·턴 그대로)
//  (T19) 고르기는 모두 아래 조작부의 카드로 한다(① 자리 ② 방법 ③ 세기 / 모음 ① 높이 ② 앞뒤 ③ 입술). 단면도는 보여 주기 전용 —
//     누르는 요소가 없고, 카드를 고르면 단면도 모양이 따라 바뀌며(data-place·data-vowel·data-manner), 발사하면 조음 동작을 재생한다.
//  4) 세로 틀 390×844 · 360×740(spec 6.2 선생님 결정): 윗줄(남은 배·턴) → 입안 단면도(위 반) · 적 바다(아래 반, 둘 다 늘 보임, 겹침 없음)
//     → 한 줄 문구 → 하단 고정 조작부([요약 줄 · 기록 N] / ① / ② / ③ + 발사), 조작 단추가 모두 화면 아래 45% 안(한 손),
//     스크롤 없이 한 발, 가로 넘침 없음, 기록장 접힘/펼침, 터치 목표 48px·발사 56px, 방향 바뀜(가로↔세로)에도 판 그대로,
//     낮은 가로 화면은 '세로로 돌려 주세요'. 가로의 기록장은 조작부 안 최근 세 발 띠. 가로: ①②③ 카드가 모두 화면 아래 35% 안
//  5) 캡처: tests/shots/practice-landscape.png, practice-portrait-390.png, practice-portrait-360.png
//  모든 조각에서 페이지 오류(window.__soriErrors) 0.
//  점검 드라이버만 숨은 함대를 G.practice.debug().state에서 읽는다(화면에는 드러나지 않음).
import { step, url, frame } from './aside.mjs';

const PAGE = 'tests/pages/practice.html';
const P = (q) => url(PAGE + q);

// 페이지(또는 틀 안 페이지) 안에서 쓰는 도우미. evaluate 함수 안에 그대로 붙여 넣는다.
const HELP = (inFrame) => `
const fw = ${inFrame ? 'frameWin()' : 'window'}, fd = fw.document, G = fw.G, TX = fw.TEXT;
const errs = [];
const bad = (m) => errs.push(m);
const $ = (s) => fd.querySelector(s);
const $$ = (s) => Array.from(fd.querySelectorAll(s));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms, what) => {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 15000)) { try { if (fn()) return true; } catch (e) {} await wait(40); }
  bad('기다려도 안 됨: ' + what); return false;
};
const dbg = () => G.practice.debug();
const st = () => dbg().state;
const shots = () => (st() ? st().teams.player.shots : []);
const msg = () => ($('.ctl-msg-text') || {}).textContent || '';
const box = (n) => n.getBoundingClientRect();
const visible = (n) => !!n && n.getClientRects().length > 0 && fw.getComputedStyle(n).visibility !== 'hidden';
const opt = (k, v) => $('.pr-opt[data-key="' + k + '"][data-val="' + v + '"]');
const pressed = (k) => { const b = $$('.pr-opt[data-key="' + k + '"]').find((x) => x.getAttribute('aria-pressed') === 'true'); return b ? b.getAttribute('data-val') : null; };
const choose = (grade, sea, level) => { opt('grade', grade).click(); opt('sea', sea).click(); opt('level', String(level)).click(); };
// 누르는 곳의 가운데를 실제 좌표로 누른다(가려져 있으면 실패로 적는다)
const tapPoint = (n, what) => {
  const b = box(n); const x = b.left + b.width / 2, y = b.top + b.height / 2;
  const hit = fd.elementFromPoint(x, y);
  if (!hit || !(hit === n || n.contains(hit) || hit.contains(n) || (n.ownerSVGElement && n.ownerSVGElement.contains(hit)))) bad(what + ': 가운데를 누르면 다른 것이 눌림(' + (hit ? hit.className.baseVal || hit.className : 'null') + ')');
  if (x < 0 || y < 0 || x > fw.innerWidth || y > fw.innerHeight) bad(what + ': 화면 밖(' + Math.round(x) + ',' + Math.round(y) + ')');
  return { x, y };
};
const card = (g, id) => $('.ctl-card[data-group="' + g + '"][data-id="' + id + '"]');
const tap = (n, what) => { if (!n) { bad('없음: ' + what); return; } tapPoint(n, what); n.click(); };
const msvg = () => $('.mouth-svg');
// 자리 고르기: 아래 조작부의 ① 카드(자음 자리 / 모음 높이 + 앞뒤) — 단면도가 그 자리를 보여 주는지도 본다
const pickPlace = (id) => {
  if (st().sea === 'vowel') {
    const [b, h] = id.split('-');
    tap(card('height', h), '높이 카드 ' + h); tap(card('backness', b), '앞뒤 카드 ' + b);
    if (msvg() && msvg().dataset.vowel !== id) bad('높이·앞뒤 카드를 골라도 단면도가 안 바뀜 ' + id + ' / ' + (msvg() && msvg().dataset.vowel));
  } else {
    tap(card('place', id), '자리 카드 ' + id);
    if (msvg() && msvg().dataset.place !== id) bad('자리 카드를 골라도 단면도가 안 바뀜 ' + id + ' / ' + (msvg() && msvg().dataset.place));
  }
};
const turnsLeft = () => +(($('.pr-turns-n') || {}).textContent || NaN);
// 한 발: ① ② ③ 카드 → 발사 → 끝날 때까지 기다림
const shoot = async (input, what) => {
  what = what || JSON.stringify(input);
  if (st().sea === 'vowel') { pickPlace(input.backness + '-' + input.height); tap(card('lips', input.lips), '입술 카드 ' + what); }
  else {
    pickPlace(input.place);
    tap(card('manner', input.manner), '방법 카드 ' + what);
    if (msvg() && msvg().dataset.manner !== input.manner) bad('방법 카드를 골라도 단면도가 안 바뀜 ' + what);
    const sc = card('strength', input.strength);
    if (input.strength && sc && !sc.disabled) tap(sc, '세기 카드 ' + what);
  }
  const fb = $('.ctl-fire');
  if (!fb || fb.disabled) { bad('발사 단추가 꺼져 있음: ' + what); return null; }
  tap(fb, '발사 ' + what);
  if (!dbg().busy) bad('발사했는데 잠기지 않음: ' + what);
  if (!fw.document.documentElement.classList.contains('reduce-motion') && msvg() && msvg().dataset.playing !== '1') bad('발사했는데 단면도가 조음 동작을 재생하지 않음: ' + what);
  if ($$('.ctl-card').some((b) => !b.disabled) || !$('.ctl-fire').disabled) bad('공기 흐름 도중 조작부가 잠기지 않음: ' + what);
  await until(() => !dbg().busy, 9000, '발사 끝 ' + what);
  return msg();
};
const inp = (id) => G.rules.inputOf(id);
const jamo = /[\\u3131-\\u318E]/g;
// 숨김 단계: 칸 안 소리가 DOM(글·속성)에 없는지. 쏜 칸 도장(.sb-stamp)·명중 연출(.sb-burst, 1.4초)·기록장(.ctl-log-what)의 쏜 소리만 허용
const leakCheck = (tag) => {
  const allowed = new Set(shots().map((x) => x.sound).filter(Boolean));
  const root = $('#app') || $('#box') || fd.body;
  const walk = fd.createTreeWalker(root, 1 | 4);
  let n;
  while ((n = walk.nextNode())) {
    if (n.nodeType === 3) {
      const m = n.nodeValue.match(jamo); if (!m) continue;
      const host = n.parentElement;
      const ok = host && host.closest('.sb-stamp, .sb-burst, .ctl-log-what') && m.every((c) => allowed.has(c));
      if (!ok) bad(tag + ': 숨긴 소리가 글로 드러남 "' + n.nodeValue + '" (' + (host && host.className) + ')');
    } else {
      for (const a of Array.from(n.attributes)) if (jamo.test(a.value)) { jamo.lastIndex = 0; bad(tag + ': 속성에 소리 ' + a.name + '="' + a.value + '"'); }
      jamo.lastIndex = 0;
    }
  }
};
const noErrors = () => { const e = fw.__soriErrors || ['오류 모음 없음']; if (e.length) bad('페이지 오류: ' + e.join(' | ')); };
`;

const report = `
  if (r.errs.length) console.log('FAIL ' + r.errs.join('\\nFAIL '));
  else console.log('PASS');
`;
// 캡처: aside의 screenshot은 가만히 있는 탭에서 가끔 시간 초과가 난다 → 화면을 살짝 건드리고 몇 번 다시 해 본다
const shot = (tab, name) => `
  try { await fs.mkdir('./artifacts', { recursive: true }); } catch (e) {}
  {
    let png = null, lastErr = null;
    for (let k = 0; k < 4 && !png; k++) {
      await ${tab}.evaluate(() => { document.body.style.outline = document.body.style.outline ? '' : '0px solid transparent'; });
      await sleep(200);
      try { png = await ${tab}.screenshot({ timeout: 10000 }); } catch (e) { lastErr = e; }
    }
    if (!png) throw lastErr;
    await fs.writeFile('./artifacts/${name}.png', png);
  }
  console.log('SHOTFILE:' + path.resolve('./artifacts/${name}.png'));
`;

// ───────────────────────────────────────────────────────────────
step('가로: 준비 화면 · 자음 1단계 풀이 예시 자동 · 턴을 안 쓰는 결과 · 끝까지 → finishGame', `
const ta = await openTab(${JSON.stringify(P('?clear=1'))});
try {
  const r0 = await ta.evaluate(async () => {
    ${HELP(false)}
    const info = {};
    try {
      await until(() => $('.pr-setup'), 8000, '준비 화면');
      if (!G.practice || typeof G.practice.open !== 'function') bad('G.practice.open 없음');
      // 기본값(G.save.getSelection) 눌림
      const sel = G.save.getSelection();
      if (pressed('grade') !== sel.grade || pressed('sea') !== sel.sea || pressed('level') !== String(sel.level)) bad('준비 화면 기본값이 마지막 선택과 다름');
      if (!visible($('.pr-example-btn'))) bad('자음 1단계인데 예시 보기 단추가 없음');
      opt('level', '2').click();
      if (visible($('.pr-example-btn'))) bad('자음 2단계인데 예시 보기가 보임');
      opt('sea', 'vowel').click();
      if ($$('.pr-opt[data-key="level"]').length !== 2) bad('모음 바다 단계 단추가 2개가 아님');
      opt('level', '1').click();
      if (visible($('.pr-example-btn'))) bad('모음 1단계인데 예시 보기가 보임');
      choose('m3', 'consonant', 1);
      if (!visible($('.pr-example-btn'))) bad('자음 1단계로 돌아왔는데 예시 보기가 없음');
      if (G.save.seenExample()) bad('처음인데 예시를 본 것으로 되어 있음');
      $('.pr-start').click();
      // ── 풀이 예시(자동) ──
      await until(() => dbg().view === 'example', 4000, '풀이 예시 시작');
      if (!$('.pr-skip')) bad('건너뛰기 단추 없음');
      const lines = [], kinds = [];
      let maxShots = 0, disabledSeen = true;
      const t0 = Date.now();
      while (dbg().view === 'example' && Date.now() - t0 < 40000) {
        const m = msg();
        if (m && lines[lines.length - 1] !== m) lines.push(m);
        const s = shots();
        if (s.length > maxShots) { maxShots = s.length; kinds.length = 0; s.forEach((x) => kinds.push(x.kind)); }
        if ($('.ctl-fire') && !$('.ctl-fire').disabled) disabledSeen = false;
        if (G.save.hasGame()) bad('풀이 예시가 진행 판으로 저장됨');
        await wait(40);
      }
      info.lines = lines;
      const want = [0, 1, 2].map((i) => G.text.exampleLine('m3', i));
      let at = -1;
      want.forEach((w, i) => { const k = lines.indexOf(w); if (k < 0) bad('예시 ' + (i + 1) + '번째 줄이 안 나옴: ' + w); else if (k < at) bad('예시 줄 순서가 다름'); else at = k; });
      if (maxShots !== 3) bad('예시에서 쏜 발 수 ' + maxShots);
      if (kinds.join() !== TX.example.shots.map((x) => x.expect).join()) bad('예시 신호 ' + kinds.join() + ' ≠ ' + TX.example.shots.map((x) => x.expect).join());
      if (!disabledSeen) bad('예시 도중 발사 단추가 켜짐');
      if (!G.save.seenExample()) bad('예시 뒤에 본 기록이 남지 않음');
      if (fw.__finished) bad('예시가 finishGame을 부름');
    } catch (e) { bad('예외: ' + e.message); }
    noErrors();
    return { errs, info };
  });
  // (CDP 한 번의 evaluate는 30초 안에 끝나야 해서 나눈다)
  const r1 = await ta.evaluate(async () => {
    ${HELP(false)}
    const info = {};
    try {
      // ── 일반 판 ──
      await until(() => dbg().view === 'play' && !dbg().busy, 5000, '일반 판 시작');
      const s0 = st();
      if (!s0 || !s0.id) bad('새 판에 state.id가 없음');
      if (s0.teams.player.shots.length) bad('새 판인데 쏜 기록이 있음');
      if ($$('.ctl-log-item').length) bad('새 판인데 기록장에 예시가 남음');
      if ($$('.pr-ships .sb-ship-item').length !== 3) bad('남은 배 목록 ' + $$('.pr-ships .sb-ship-item').length);
      if (turnsLeft() !== 8) bad('남은 턴 ' + turnsLeft());
      const saved = G.save.loadGame();
      if (!saved || saved.id !== s0.id) bad('새 판이 저장되지 않음');
      if (G.audio.state().track !== 'practice') bad('배경 음악이 practice가 아님: ' + G.audio.state().track);
      const selNow = G.save.getSelection();
      if (selNow.sea !== 'consonant' || selNow.level !== 1 || selNow.grade !== 'm3') bad('시작한 선택이 기억되지 않음');
      if (!$('.mouth-label') || !visible($('.mouth-labels'))) bad('1단계인데 단면도 자리 이름이 안 보임');
      // 단면도는 보여 주기 전용: 누르는 요소가 없다. 고르기는 모두 아래 조작부(가로: 화면 아래 35% 안)
      if ($$('.mouth-svg [tabindex], .mouth-svg [role="button"], .mouth-hit').length || fw.getComputedStyle(msvg()).pointerEvents !== 'none') bad('단면도에 누르는 요소가 있음');
      if (!$('.pr-mouthcard .mouth-svg') || !$('.pr-seacol .sb')) bad('가로 [바다 | 단면도]가 아님');
      if (!(box($('.pr-seacol')).right <= box($('.pr-mouthcard')).left + 1)) bad('가로에서 바다가 단면도 왼쪽이 아님');
      $$('.ctl-card').concat([$('.ctl-fire')]).forEach((b) => { if (box(b).top < fw.innerHeight * 0.65 - 0.5) bad('가로: 조작 단추가 화면 아래 35% 밖 ' + b.textContent + ' ' + Math.round(box(b).top)); });
      ['place', 'manner'].forEach((gp) => { if ($$('.ctl-card[data-group="' + gp + '"]').length !== 5) bad('가로: ' + gp + ' 카드가 5장이 아님'); });
      // 턴을 안 쓰는 결과: /ㅎ/ = 이번 바다에 없는 칸
      await shoot({ place: 'glottal', manner: 'fricative', strength: null }, '/ㅎ/');
      if (msg() !== TX.signal.notInSea) bad('/ㅎ/ 문구: ' + msg());
      if (shots().length !== 0 || turnsLeft() !== 8) bad('이번 바다에 없는 칸이 턴을 씀');
      const fleet = s0.teams.enemy.fleet;
      const fleetIds = [].concat(...fleet.map((x) => x.sounds));
      const lv = G.rules.level('consonant', 1);
      const other = lv.open.find((id) => fleetIds.indexOf(id) < 0);
      await shoot(inp(other), '빈 바다 ' + other);
      if (shots().length !== 1 || turnsLeft() !== 7) bad('한 발 뒤 턴 ' + turnsLeft());
      if ([TX.signal.line, TX.signal.miss].indexOf(msg()) < 0) bad('신호 문구: ' + msg());
      if ($$('.ctl-log-item').length !== 1) bad('기록장 줄 수 ' + $$('.ctl-log-item').length);
      if (G.save.loadGame().teams.player.shots.length !== 1) bad('한 발 뒤 저장 안 됨');
      await shoot(inp(other), '같은 소리 다시 ' + other);
      if (msg() !== TX.signal.already) bad('이미 쏜 소리 문구: ' + msg());
      if (shots().length !== 1 || turnsLeft() !== 7) bad('이미 쏜 소리가 턴을 씀');
      // 첫 명중
      await shoot(inp(fleetIds[0]), '명중 ' + fleetIds[0]);
      if (!(msg() === TX.signal.hit || /찾았어요/.test(msg()))) bad('명중 문구: ' + msg());
      info.id = s0.id; info.fleetIds = fleetIds;
    } catch (e) { bad('예외: ' + e.message); }
    noErrors();
    return { errs, info };
  });
  const r = r1;
  ${shot('ta', 'practice-landscape')}
  const r2 = await ta.evaluate(async (info) => {
    ${HELP(false)}
    try {
      for (const id of info.fleetIds.slice(1)) {
        if (dbg().view !== 'play') break;
        await shoot(inp(id), '명중 ' + id);
      }
      await until(() => dbg().view === 'end', 4000, '끝 화면');
      if (msg() !== TX.ui.play.allFound) bad('끝 문구: ' + msg());
      if ($$('.pr-ships .sb-ship-item.is-sunk').length !== 3) bad('격침된 배 그림 ' + $$('.pr-ships .sb-ship-item.is-sunk').length);
      await until(() => fw.__finished, 8000, 'G.app.finishGame 호출');
      const f = fw.__finished, rec = fw.__finishedRecord;
      if (f) {
        if (f.phase !== 'over' || !f.result || f.result.success !== true) bad('끝난 판 상태가 성공이 아님 ' + JSON.stringify(f.result));
        if (f.id !== info.id) bad('끝난 판 id가 다름');
        if (!rec.finished || rec.teams.player.hitSounds.length !== info.fleetIds.length) bad('판 기록이 이상함');
        if (rec.teams.player.turnsUsed !== 1 + info.fleetIds.length) bad('쓴 턴 ' + rec.teams.player.turnsUsed);
      }
      if (G.save.hasGame()) bad('끝난 판이 진행 판으로 남음');
    } catch (e) { bad('예외: ' + e.message); }
    noErrors();
    return { errs };
  }, r1.info);
  r.errs = r0.errs.concat(r1.errs, r2.errs);
  ${report}
} finally { await closeTab(ta); }
`);

// ───────────────────────────────────────────────────────────────
step('가로: 자음 1단계 턴 소진(남은 배 공개) · 모음 1단계 끝까지', `
const tb = await openTab(${JSON.stringify(P('?clear=1&seen=1'))});
try {
  const r = await tb.evaluate(async () => {
    ${HELP(false)}
    try {
      await until(() => $('.pr-setup'), 8000, '준비 화면');
      choose('h1', 'consonant', 1);
      $('.pr-start').click();
      await until(() => dbg().view === 'play', 4000, '판 시작(예시 없이)');
      if (dbg().view === 'example') bad('예시를 본 기기인데 예시가 또 나옴');
      const fleetIds = [].concat(...st().teams.enemy.fleet.map((x) => x.sounds));
      const lv = G.rules.level('consonant', 1);
      const others = lv.open.filter((id) => fleetIds.indexOf(id) < 0).map(inp);
      const empties = [{ place: 'glottal', manner: 'stop' }, { place: 'palatal', manner: 'stop' }, { place: 'bilabial', manner: 'fricative' }, { place: 'velar', manner: 'fricative' }];
      const plan = others.concat(empties).slice(0, 8);
      for (const x of plan) { if (dbg().view !== 'play') break; await shoot(x); }
      await until(() => dbg().view === 'end', 4000, '턴 소진 끝');
      if (msg() !== TX.ui.play.outOfTurns) bad('턴 소진 문구: ' + msg());
      const rev = $$('.sb .k-reveal').length;
      if (rev !== fleetIds.length) bad('공개된 남은 배 칸 ' + rev + ' ≠ ' + fleetIds.length);
      await until(() => fw.__finished, 8000, 'finishGame(턴 소진)');
      if (fw.__finished && fw.__finished.result.success !== false) bad('턴 소진인데 성공');
      if (fw.__finishedRecord && fw.__finishedRecord.teams.player.dudCount !== plan.length - others.length) bad('없는 소리 횟수 ' + fw.__finishedRecord.teams.player.dudCount);
    } catch (e) { bad('예외: ' + e.message); }
    noErrors();
    return { errs };
  });
  const rv = await tb.evaluate(async () => {
    ${HELP(false)}
    try {
      // ── 모음 1단계 ──
      fw.__finished = null;
      fw.openPractice({});
      await until(() => $('.pr-setup'), 4000, '준비 화면(모음)');
      if (pressed('grade') !== 'h1') bad('마지막 선택(고1)이 기본값이 아님');
      choose('m3', 'vowel', 1);
      $('.pr-start').click();
      await until(() => dbg().view === 'play', 4000, '모음 판 시작');
      if ($$('.ctl-card[data-group="lips"]').length !== 2) bad('입술 카드 수');
      const vf = [].concat(...st().teams.enemy.fleet.map((x) => x.sounds));
      await shoot({ backness: 'front', height: 'low', lips: 'rounded' }, '앞·낮은·둥근(없는 소리)');
      if (msg() !== TX.signal.none || turnsLeft() !== 7) bad('없는 소리: ' + msg() + ' 턴 ' + turnsLeft());
      await shoot({ backness: 'front', height: 'low', lips: 'rounded' }, '같은 없는 조합 다시');
      if (msg() !== TX.signal.already || turnsLeft() !== 7) bad('같은 없는 조합: ' + msg() + ' 턴 ' + turnsLeft());
      for (const id of vf) { if (dbg().view !== 'play') break; await shoot(inp(id), '모음 ' + id); }
      await until(() => fw.__finished, 8000, 'finishGame(모음)');
      const f = fw.__finished;
      if (f && (f.sea !== 'vowel' || !f.result.success || f.teams.player.shots.length !== 1 + vf.length)) bad('모음 끝난 판 ' + JSON.stringify(f.result));
    } catch (e) { bad('예외: ' + e.message); }
    noErrors();
    return { errs };
  });
  r.errs = r.errs.concat(rv.errs);
  ${report}
} finally { await closeTab(tb); }
`);

// ───────────────────────────────────────────────────────────────
step('가로: 자음 2단계 숨김 · 처음으로 · 새로고침 뒤 이어서 하기', `
const tc = await openTab(${JSON.stringify(P('?clear=1&seen=1'))});
let before = null;
try {
  const r = await tc.evaluate(async () => {
    ${HELP(false)}
    const out = {};
    try {
      await until(() => $('.pr-setup'), 8000, '준비 화면');
      choose('m3', 'consonant', 2);
      $('.pr-start').click();
      await until(() => dbg().view === 'play', 4000, '2단계 시작');
      leakCheck('2단계 시작');
      if ($$('.ctl-card[data-group="strength"]').length !== 3) bad('2단계 세기 카드 수');
      const fleetIds = [].concat(...st().teams.enemy.fleet.map((x) => x.sounds));
      const other = G.rules.level('consonant', 2).open.find((id) => fleetIds.indexOf(id) < 0);
      await shoot(inp(fleetIds[0]), '명중');
      await shoot(inp(other), '다른 소리');
      await shoot({ place: 'alveolar', manner: 'fricative', strength: 'aspirated' }, '잇몸+마찰+거센');
      if (msg() !== TX.signal.none) bad('잇몸+마찰+거센 문구: ' + msg());
      await shoot({ place: 'glottal', manner: 'stop', strength: 'plain' }, '목청+파열');
      leakCheck('2단계 네 발 뒤');
      if (shots().length !== 4 || turnsLeft() !== 8) bad('2단계 네 발 뒤 턴 ' + turnsLeft());
      out.id = st().id; out.shots = JSON.stringify(shots()); out.turns = turnsLeft();
      out.marks = $$('.sb .sb-mark').length; out.log = $$('.ctl-log-item').map((x) => x.textContent).join('|');
      out.fleetIds = fleetIds;
      // 처음으로 → 시작 화면, 판은 남음
      $('.pr-home').click();
      if (fw.__went.indexOf('title') < 0) bad('처음으로가 G.app.go(title)을 부르지 않음');
      if (!G.save.hasGame()) bad('처음으로 뒤에 진행 판이 없음');
    } catch (e) { bad('예외: ' + e.message); }
    noErrors();
    return { errs, out };
  });
  before = r.out;
  ${report}
} finally { await closeTab(tc); }
const td = await openTab(${JSON.stringify(P('?resume=1'))});
try {
  const r = await td.evaluate(async (b) => {
    ${HELP(false)}
    try {
      await until(() => dbg().view === 'play', 6000, '이어서 하기');
      if (!st() || st().id !== b.id) bad('이어 한 판 id가 다름');
      if (JSON.stringify(shots()) !== b.shots) bad('이어 한 판의 쏜 기록이 다름');
      if (turnsLeft() !== b.turns) bad('이어 한 판 남은 턴 ' + turnsLeft() + ' ≠ ' + b.turns);
      await wait(300);
      if ($$('.sb .sb-mark').length !== b.marks) bad('판 표시 수 ' + $$('.sb .sb-mark').length + ' ≠ ' + b.marks);
      if ($$('.ctl-log-item').map((x) => x.textContent).join('|') !== b.log) bad('기록장이 다름');
      leakCheck('이어서 하기');
      for (const id of b.fleetIds.slice(1)) { if (dbg().view !== 'play') break; await shoot(inp(id), '이어서 명중 ' + id); }
      await until(() => fw.__finished, 8000, 'finishGame(이어 한 판)');
      if (fw.__finished && (fw.__finished.id !== b.id || !fw.__finished.result.success)) bad('이어 한 판의 끝이 이상함');
    } catch (e) { bad('예외: ' + e.message); }
    noErrors();
    return { errs };
  }, before || {});
  ${report}
} finally { await closeTab(td); }
`);

// ───────────────────────────────────────────────────────────────
// 세로 틀: 배치 · 스크롤 없이 한 발 · 두 줄 조작부 · 기록장 · 방향 바뀜
const portrait = (w, h) => `
const tf = await openTab(${JSON.stringify(frame(w, h, PAGE + '?clear=1&seen=1'))});
try {
  await tf.evaluate(() => frameReady);
  const r = await tf.evaluate(async () => {
    ${HELP(true)}
    const W = ${w}, H = ${h};
    const noScroll = (tag) => {
      const de = fd.documentElement;
      if (de.scrollWidth > de.clientWidth + 1) bad(tag + ': 가로 넘침 ' + de.scrollWidth + ' > ' + de.clientWidth);
      if (de.scrollHeight > de.clientHeight + 1) bad(tag + ': 세로 스크롤 ' + de.scrollHeight + ' > ' + de.clientHeight);
      const pr = $('.pr'); if (pr && pr.scrollHeight > pr.clientHeight + 1) bad(tag + ': 화면 안 스크롤 ' + pr.scrollHeight + ' > ' + pr.clientHeight);
    };
    const inView = (n, tag) => { const b = box(n); if (b.top < -0.5 || b.left < -0.5 || b.bottom > H + 0.5 || b.right > W + 0.5) bad(tag + ' 화면 밖 ' + JSON.stringify([b.left, b.top, b.right, b.bottom].map(Math.round))); };
    const big = (n, tag) => { const b = box(n); if (b.width < 47.5 || b.height < 47.5) bad(tag + ' 터치 목표 ' + Math.round(b.width) + '×' + Math.round(b.height)); };
    const checkLayout = (tag, second) => {
      if (!$('.pr.pr--portrait')) bad(tag + ': 세로 배치가 아님');
      const top = $('.pr-top'), mc = $('.pr-mouthcard'), sv = $('.pr-mouth .mouth-svg'), sea = $('.pr-sea .sb'), m = $('.ctl-msg'), fb = $('.ctl-fire');
      const first = $('.ctl-group .ctl-card'), dock = $('.pr-dockwrap'), combo = $('.ctl-combo');
      if (!top || !mc || !sv || !sea || !m || !first || !fb || !dock || !combo) { bad(tag + ': 요소가 모자람'); return; }
      if (!top.querySelector('.sb-ships') || !top.querySelector('.pr-turns')) bad(tag + ': 윗줄에 남은 배·남은 턴이 없음');
      const shipIt = $$('.pr-top .sb-ship-item');
      if (shipIt.some((x) => Math.abs(box(x).top - box(shipIt[0]).top) > 2)) bad(tag + ': 윗줄의 남은 배가 두 줄로 넘어감');
      // spec 6.2: 윗줄 → 단면도(위 반) → 바다(아래 반) → 한 줄 문구 → 요약 줄 → 카드
      const order = [top, mc, sea, m, combo, first].map((n) => box(n));
      for (let i = 1; i < order.length; i++) if (order[i].top < order[i - 1].bottom - 1) bad(tag + ': 위에서 아래 순서가 아님(' + i + ')');
      // 단면도와 바다: 둘 다 보이고 크기가 비슷(반반), 겹치지 않음, 화면 안
      const hm = box(mc).height, hs = box($('.pr-seacol')).height;
      if (!(hm > 150 && hs > 150)) bad(tag + ': 단면도·바다가 너무 작음 ' + Math.round(hm) + '/' + Math.round(hs));
      if (!(hm / hs > 0.7 && hm / hs < 1.45)) bad(tag + ': 단면도와 바다가 반반이 아님 ' + Math.round(hm) + '/' + Math.round(hs));
      const svb = box(sv);
      if (svb.bottom > box(sea).top + 1) bad(tag + ': 단면도가 바다를 덮음');
      if (svb.top < box(top).bottom - 1) bad(tag + ': 단면도가 윗줄을 덮음');
      inView(sv, tag + ' 단면도'); inView(sea, tag + ' 바다');
      const cells = $$('.pr-sea .sb-cell');
      if (Math.max(...cells.map((c) => box(c).bottom)) > box(dock).top + 1) bad(tag + ': 조작부가 바다의 마지막 줄을 가림');
      if (Math.min(...cells.map((c) => box(c).top)) < box(mc).bottom - 1) bad(tag + ': 바다 칸이 단면도와 겹침');
      // 단면도는 보여 주기 전용(누르는 요소 없음), 고르기는 모두 아래(한 손): 자리·방법·세기·발사·기록 단추가 모두 화면 아래 45% 안
      if ($$('.mouth-svg [tabindex], .mouth-svg [role="button"], .mouth-hit').length || fw.getComputedStyle(sv).pointerEvents !== 'none') bad(tag + ': 단면도에 누르는 요소가 있음');
      const ctlBtns = [fb, $('.ctl-logtoggle')].concat($$('.ctl-card'));
      ctlBtns.forEach((n, i) => { if (box(n).top < H * 0.55 - 0.5) bad(tag + ': 조작 단추가 아래 45% 밖 ' + i + ' ' + n.textContent + ' top ' + Math.round(box(n).top)); });
      // ① 카드 줄 / ② 줄 / ③ + 발사(모음은 ① 높이 / ② 앞뒤 + ③ 입술 / 발사)
      const g1 = $$('.ctl-group')[0].querySelectorAll('.ctl-card');
      if (g1.length !== (st().sea === 'vowel' ? 3 : 5)) bad(tag + ': ① 카드 수 ' + g1.length);
      if (second) { const s2 = $('.ctl-card[data-group="' + second + '"]'); if (!s2 || Math.abs(box(s2).top - box(fb).top) > 8) bad(tag + ': ' + second + ' 카드와 발사가 같은 줄이 아님'); }
      if (box(fb).height < 55.5) bad(tag + ': 발사 단추 높이 ' + Math.round(box(fb).height) + ' < 56');
      [fb, $('.ctl-logtoggle'), $('.pr-home')].concat($$('.ctl-card')).forEach((n, i) => { if (n) { inView(n, tag + ' 단추' + i); big(n, tag + ' 단추' + i); } });
      // 조합 요약 줄: 카드 위, 화면 안
      if (box(combo).bottom > box(first).top + 1) bad(tag + ': 요약 줄이 카드 위가 아님');
      inView(combo, tag + ' 요약 줄');
      inView(m, tag + ' 문구');
      if (visible($('.ctl-log'))) bad(tag + ': 기록장이 펼쳐져 있음');
      if ($('.pr-sheet') || $('.ctl-placebtn')) bad(tag + ': 없앤 위치 패널·단추가 남아 있음');
      noScroll(tag);
    };
    const start = async (grade, sea, level) => {
      fw.openPractice({});
      await until(() => $('.pr-setup'), 4000, '준비 화면');
      noScroll('준비 화면');
      $$('.pr-setup button').filter(visible).forEach((n, i) => { inView(n, '준비 단추' + i); big(n, '준비 단추' + i); });
      choose(grade, sea, level);
      tap($('.pr-start'), '시작');
      await until(() => dbg().view === 'play', 4000, '판 시작');
      await wait(400);
    };
    try {
      if (dbg().layout !== 'portrait') bad('${w}×${h}인데 세로 배치가 아님: ' + dbg().layout);
      // 자음 1단계
      await start('m3', 'consonant', 1);
      checkLayout('자음 1단계', null);
      const fleetIds = [].concat(...st().teams.enemy.fleet.map((x) => x.sounds));
      // 카드를 고르면 단면도가 따라 바뀐다 · 요약 줄이 고른 조합을 한 줄로 보인다
      pickPlace('bilabial');
      tap(card('manner', 'stop'), '방법 카드(요약 줄 점검)');
      if ($('.mouth-svg').dataset.lipshape !== 'closed') await until(() => $('.mouth-svg').dataset.lipshape === 'closed', 1000, '두 입술 + 파열을 고르면 단면도의 입술이 붙음');
      const cmb = $('.ctl-combo').textContent;
      if (cmb !== TX.mouthParts.bilabial + ' · ' + G.text.short('m3', 'manner', 'stop')) bad('요약 줄: ' + cmb);
      await shoot(inp(fleetIds[0]), '세로 한 발');
      if (shots().length !== 1 || turnsLeft() !== 7) bad('세로 한 발 뒤 턴 ' + turnsLeft());
      if (msg() === '') bad('세로 한 발 뒤 문구 없음');
      noScroll('한 발 뒤');
      // 기록장: 접혀 있다가 단추로 펼침
      tap($('.ctl-logtoggle'), '기록장 단추');
      if (!visible($('.ctl-log')) || $$('.ctl-log-item').length !== 1) bad('기록장이 펼쳐지지 않음');
      noScroll('기록장 펼침');
      $('.ctl-logtoggle').click();
      // 방향 바뀜: 가로 → 세로, 판 그대로
      const marks0 = $$('.sb .sb-mark').length, shots0 = JSON.stringify(shots());
      const ifr = document.getElementById('game');
      ifr.style.width = '1180px'; ifr.style.height = '760px';
      await until(() => dbg().layout === 'landscape' && $('.pr.pr--landscape'), 3000, '가로로 바뀜');
      await wait(300);
      if (JSON.stringify(shots()) !== shots0) bad('가로로 바꾸니 쏜 기록이 바뀜');
      if ($$('.sb .sb-mark').length !== marks0) bad('가로로 바꾸니 판 표시 수가 다름');
      if (!$('.ctl-log.ctl-log--strip') || !visible($('.ctl-log'))) bad('가로인데 기록 띠가 안 보임');
      if (!$('.pr-mouthcard .mouth-svg')) bad('가로인데 단면도가 [바다 | 단면도]에 없음');
      ifr.style.width = W + 'px'; ifr.style.height = H + 'px';
      await until(() => dbg().layout === 'portrait' && $('.pr.pr--portrait'), 3000, '세로로 돌아옴');
      await wait(300);
      if ($$('.sb .sb-mark').length !== marks0 || turnsLeft() !== 7) bad('세로로 돌아오니 판이 다름');
      checkLayout('방향 바뀐 뒤', null);
      // 낮은 가로 화면: '세로로 돌려 주세요'
      ifr.style.width = H + 'px'; ifr.style.height = W + 'px';
      await wait(400);
      const rot = $('.pr-rotate');
      if (!rot || !visible(rot) || rot.textContent.indexOf(TX.rotate) < 0) bad('낮은 가로 화면에서 세로로 돌려 주세요가 안 뜸');
      ifr.style.width = W + 'px'; ifr.style.height = H + 'px';
      await wait(300);
      if (rot && visible(rot)) bad('세로인데 세로로 돌려 주세요가 뜸');
      // 자음 2단계: 방법 / 세기 + 발사
      await start('h1', 'consonant', 2);
      checkLayout('자음 2단계', 'strength');
      await shoot({ place: 'velar', manner: 'stop', strength: 'tense' }, '세로 2단계 한 발');
      if (shots().length !== 1) bad('세로 2단계 한 발이 안 나감');
      // 모음 1단계: 입술 + 발사
      await start('m3', 'vowel', 1);
      checkLayout('모음 1단계', null);
      // 모음: ① 높이 줄 / ② 앞뒤 + ③ 입술 한 줄 / 발사 한 줄
      if (Math.abs(box(card('backness', 'front')).top - box(card('lips', 'rounded')).top) > 2) bad('모음: 앞뒤·입술 카드가 한 줄이 아님');
      if (!(box($('.ctl-fire')).top >= box(card('lips', 'rounded')).bottom - 1)) bad('모음: 발사가 입술 줄 아래가 아님');
      await shoot({ backness: 'back', height: 'high', lips: 'rounded' }, '세로 모음 한 발');
      if (shots().length !== 1) bad('세로 모음 한 발이 안 나감');
      noScroll('모음 한 발 뒤');
    } catch (e) { bad('예외: ' + e.message); }
    noErrors();
    return { errs };
  });
  ${report}
} finally { await closeTab(tf); }
`;
step('세로 틀 390×844: 단면도·바다 반반 · 스크롤 없이 한 발 · ①②③ 아래 조작부 · 기록장 · 방향 바뀜', portrait(390, 844));
step('세로 틀 360×740: 단면도·바다 반반 · 스크롤 없이 한 발 · ①②③ 아래 조작부 · 기록장 · 방향 바뀜', portrait(360, 740));

// ───────────────────────────────────────────────────────────────
const capture = (w, h, level, name) => `
{
  const tg = await openTab(${JSON.stringify(P(`?clear=1&seen=1&reduce=1&layout=portrait&w=${w}&h=${h}`))});
  try {
    const r = await tg.evaluate(async () => {
      ${HELP(false)}
      try {
        await until(() => $('.pr-setup'), 8000, '준비 화면');
        choose('m3', 'consonant', ${level});
        $('.pr-start').click();
        await until(() => dbg().view === 'play', 4000, '판 시작');
        const fleetIds = [].concat(...st().teams.enemy.fleet.map((x) => x.sounds));
        await shoot(inp(fleetIds[0]));
        await shoot(${level === 1 ? "{ place: 'alveolar', manner: 'fricative' }" : "{ place: 'velar', manner: 'stop', strength: 'aspirated' }"});
        card('place', 'bilabial').click();
        if (${level} === 1) card('manner', 'stop').click();
        await wait(400);
        const pr = $('.pr');
        if (pr.scrollHeight > pr.clientHeight + 1) bad('캡처 상자 안 스크롤 ' + pr.scrollHeight + ' > ' + pr.clientHeight);
      } catch (e) { bad('예외: ' + e.message); }
      noErrors();
      return { errs };
    });
    ${shot('tg', name)}
    if (r.errs.length) console.log('FAIL ' + r.errs.join('\\nFAIL '));
  } finally { await closeTab(tg); }
}
`;
step('캡처: 휴대폰 세로 390×844(자음 1단계)', `
${capture(390, 844, 1, 'practice-portrait-390')}
console.log('PASS');
`);
step('캡처: 휴대폰 세로 360×740(자음 2단계)', `
${capture(360, 740, 2, 'practice-portrait-360')}
console.log('PASS');
`);
