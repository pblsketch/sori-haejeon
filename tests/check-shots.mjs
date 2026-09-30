// 화면 캡처와 크기별 배치 점검(spec 10-3) — 진짜 index.html을 크기별 틀에 띄워 찍는다(aside). 캡처는 tests/shots/에.
//   가로: 전자칠판 1920×1080 · 태블릿 1280×800 · 노트북 1366×768 — 시작 · 연습 판 · 대결 판 · 결과
//         누르는 것 모두 64px 이상, 가로 스크롤 없음, 판 화면은 세로 스크롤도 없음, 칠판 대결의 판 위 소리 40px 이상
//   휴대폰 세로: 390×844 · 360×740 — 시작(대결 안내 한 줄) · 연습 판(누르기 전 · 한 발 뒤 기록장 펼침) · 결과
//         누르는 것 48px 이상, 발사 56px 이상, 가로 스크롤 없음, 연습은 아무것도 누르기 전에 ① ② ③ 카드 줄과 발사가
//         모두 화면 안에 보이고 스크롤 없이 한 발을 쏠 수 있음(자음 2단계·모음 1단계)
//   눕힌 휴대폰 844×390 — '세로로 돌려 주세요'
//   이 점검의 캡처는 증거 자료라 반드시 찍혀야 한다: ASIDE_STRICT_SHOTS=1(캡처 실패 = 실패)로 돌리고,
//   조각이 끝나면 옮겨진 그림 파일이 1KB보다 큰지 확인한다.
process.env.ASIDE_STRICT_SHOTS = '1';
const { step, frame, SHOTS } = await import('./aside.mjs');
const { DRIVER } = await import('./lib/drive.mjs');
const fs = await import('node:fs');
const path = await import('node:path');

const J = JSON.stringify;

// 틀 안 게임 영역만 잘라 찍는다(창보다 큰 틀은 줄여 보임)
const SNAP = `
async function snap(name) {
  await tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(true))));
  await sleep(350);
  const clip = await tab.evaluate(() => { const q = document.getElementById('game').getBoundingClientRect(); return { x: Math.max(0, q.x), y: Math.max(0, q.y), width: Math.min(q.width, innerWidth), height: Math.min(q.height, innerHeight) }; });
  const png = await tab.screenshot({ clip });
  await fs.mkdir('./artifacts', { recursive: true });
  await fs.writeFile('./artifacts/' + name + '.png', png);
  console.log('SHOTFILE:' + path.resolve('./artifacts/' + name + '.png'));
}
// 시작 화면에서(하던 판을 물으면 '새 판') 연습 준비 → 고르기 → 시작 → 판
async function startPractice(grade, sea, level) {
  await E(async (a) => {
    if (D.cur() !== 'title') { const h = D.$('.pr-home, .duel-home'); if (h) D.tap(h, '처음으로'); await D.until(() => D.cur() === 'title', 3000, '시작 화면'); }
    if (D.$('.app-dialog')) D.tapSel('[data-act="fresh"]', "'새 판'");
    D.G().save.setSeenExample(true); // 풀이 예시는 check-play가 본다(여기서는 시간을 줄임)
    D.goTitleBtn('practice');
    await D.until(() => D.cur() === 'practice' && D.pr().view === 'setup', 4000, '연습 준비');
    D.prChoose(a[0], a[1], a[2]);
    D.tapSel('.pr-start', '시작');
    await D.until(() => D.pr().view === 'play' && !D.pr().busy, 4000, '판 시작');
    await D.wait(400);
    return D.take();
  }, [grade, sea, level]);
}
// 연습 한 판을 끝까지(결과 화면까지)
async function finishPractice() {
  await E(async () => {
    for (const id of D.prFleet()) { if (D.pr().view !== 'play') break; await D.prShoot(id); }
    await D.until(() => D.cur() === 'result', 8000, '결과 화면');
    await D.wait(500);
    return D.take();
  });
}
`;

const wrap = (w, h, body) => `{
const bad = [];
const tab = await openTab(${J(frame(w, h, 'index.html'))});
try {
  await tab.evaluate(() => frameReady);
  await tab.evaluate(() => { ${DRIVER} });
  const E = async (fn, arg) => { const r = await tab.evaluate(fn, arg); if (Array.isArray(r)) bad.push(...r); return r; };
  ${SNAP}
  await E(async () => { await D.fresh(); return D.take(); });
  ${body}
} catch (e) { bad.push('예외: ' + (e && (e.stack || e.message) || e)); }
finally { await closeTab(tab); }
if (bad.length) console.log('FAIL ' + bad.join('\\nFAIL '));
else console.log('PASS');
}`;

// 조각을 돌리고, 옮겨진 캡처가 진짜 그림(1KB 넘음)인지 확인
function shotStep(label, code) {
  const r = step(label, code);
  if (!r || !r.out || r.out === 'DRY') return;
  const names = [...r.out.matchAll(/SHOTFILE:(.+\.png)/g)].map((m) => path.basename(m[1].trim()));
  if (!names.length && r.out !== '') { console.log('FAIL 캡처가 하나도 없음: ' + label); process.exitCode = 1; }
  for (const n of names) {
    const f = path.join(SHOTS, n);
    const size = fs.existsSync(f) ? fs.statSync(f).size : 0;
    if (size <= 1024) { console.log(`FAIL 캡처 파일이 비었거나 작음: ${n} (${size} B)`); process.exitCode = 1; }
    else console.log(`     shot ${n} (${Math.round(size / 1024)} KB)`);
  }
}

// ── 가로(칠판·태블릿·노트북) ────────────────────────────────────────────
for (const [w, h, name] of [[1920, 1080, 'board'], [1280, 800, 'tablet'], [1366, 768, 'laptop']]) {
  const tag = `${w}x${h}`;
  shotStep(`가로 ${w}×${h}(${name}): 시작 · 연습 판 — 64px · 스크롤 없음`, wrap(w, h, `
    await E(async (tag) => {
      if (D.cur() !== 'title') D.bad('시작 화면이 아님');
      D.targets(64, tag + ' 시작'); D.noScroll(tag + ' 시작', true);
      if (D.G().app.isPortrait() || D.G().app.isLowLandscape()) D.bad(tag + ' 가로 넓은 화면으로 보지 않음');
      return D.take();
    }, ${J(tag)});
    await snap(${J(`${tag}-1-title`)});
    await startPractice('m3', 'consonant', 2);
    await E(async (tag) => {
      const f = D.prFleet(), G = D.G();
      const other = G.rules.level('consonant', 2).open.find((id) => f.indexOf(id) < 0);
      await D.prShoot(f[0]); await D.prShoot(other);
      D.tap(D.card('place', 'velar'), '자리 카드'); D.tap(D.card('manner', 'stop'), '방법 카드');
      await D.wait(300);
      D.targets(64, tag + ' 연습 판'); D.noScroll(tag + ' 연습 판', true);
      D.$$('.ctl-card, .ctl-fire, .pr-home').forEach((n) => D.inView(n, tag + ' 연습 ' + D.desc(n)));
      return D.take();
    }, ${J(tag)});
    await snap(${J(`${tag}-2-practice`)});
  `));
  shotStep(`가로 ${w}×${h}(${name}): 대결 판 · 결과 — 64px · 스크롤 없음${w === 1920 ? ' · 판 위 소리 40px' : ''}`, wrap(w, h, `
    await E(async (tag) => {
      if (D.$('.app-dialog')) D.tapSel('[data-act="fresh"]', "'새 판'");
      D.goTitleBtn('duel');
      await D.until(() => D.cur() === 'duel' && D.du().screen() === 'setup', 4000, '대결 준비');
      D.targets(64, tag + ' 대결 준비'); D.noScroll(tag + ' 대결 준비', true);
      D.duChoose({ grade: 'm3', sea: 'consonant', level: 1, hideTime: false });
      D.tapSel('.duel-start', '대결 시작');
      await D.until(() => D.du().screen() === 'play', 4000, '대결 판');
      const open = D.G().rules.level('consonant', 1).open;
      const miss = (t) => open.filter((id) => D.duFleet(t).indexOf(id) < 0);
      await D.fireBoth(D.duFleet('red')[0], miss('blue')[0]);
      await D.fireBoth(miss('red')[0], D.duFleet('blue')[0]);
      D.tap(D.card('place', 'bilabial', D.station('blue')), '청팀 자리 카드');
      D.tap(D.card('manner', 'nasal', D.station('blue')), '청팀 방법 카드');
      await D.wait(300);
      D.targets(64, tag + ' 대결 판'); D.noScroll(tag + ' 대결 판', true);
      D.$$('.duel-station .ctl-card, .duel-station .ctl-fire, .duel-home').forEach((n) => D.inView(n, tag + ' 대결 ' + D.desc(n)));
      if (tag === '1920x1080') { // 칠판: 뒷자리에서 읽히게 판 위 소리 40px 이상
        const px = Math.min(...D.$$('.duel-station .sb-snd:not(.sb-measure)').map((e) => parseFloat(D.w().getComputedStyle(e).fontSize)));
        if (!(px >= 39.5)) D.bad('칠판 대결 판 위 소리 글씨 ' + px + 'px < 40');
      }
      return D.take();
    }, ${J(tag)});
    await snap(${J(`${tag}-3-duel`)});
    await startPractice('m3', 'consonant', 1);
    await finishPractice();
    await E(async (tag) => {
      D.targets(64, tag + ' 결과'); D.noScroll(tag + ' 결과', false);
      return D.take();
    }, ${J(tag)});
    await snap(${J(`${tag}-4-result`)});
  `));
}

// ── 휴대폰 세로 ────────────────────────────────────────────────────────
for (const [w, h] of [[390, 844], [360, 740]]) {
  const tag = `${w}x${h}`;
  // 아무것도 누르기 전: ① ② ③ 카드 줄과 발사가 모두 화면 안에, 가려지지 않고, 스크롤 없음
  const rows = (sea) => `
    await E(async (a) => {
      const [tag, sea] = a;
      const groups = sea === 'vowel' ? ['height', 'backness', 'lips'] : ['place', 'manner', 'strength'];
      if (D.pr().layout !== 'portrait') D.bad(tag + ' 세로 배치가 아님');
      groups.forEach((g) => {
        const cards = D.$$('.ctl-card[data-group="' + g + '"]');
        if (!cards.length) D.bad(tag + ' ' + g + ' 카드가 없음');
        cards.forEach((c) => { if (!D.visible(c)) D.bad(tag + ' 안 보이는 카드 ' + D.desc(c)); else if (D.inView(c, tag + ' ' + D.desc(c))) D.tapPoint(c, tag + ' ' + D.desc(c)); });
      });
      const fb = D.$('.ctl-fire');
      if (D.inView(fb, tag + ' 발사')) D.tapPoint(fb, tag + ' 발사(가려짐 확인)');
      const b = D.box(fb);
      if (b.height < 55.5 || b.width < 55.5) D.bad(tag + ' 발사 단추 ' + Math.round(b.width) + '×' + Math.round(b.height) + ' < 56');
      if (!D.visible(D.$('.pr-mouth .mouth-svg, .pr-mouth svg'))) D.bad(tag + ' 입안 단면도가 안 보임');
      if (!D.visible(D.$('.pr-sea .sb'))) D.bad(tag + ' 바다가 안 보임');
      D.targets(48, tag + ' 연습 판'); D.noScroll(tag + ' 연습 판(누르기 전)', true);
      return D.take();
    }, [${J(tag)}, ${J(sea)}]);`;
  shotStep(`휴대폰 세로 ${w}×${h}: 시작(대결 안내) · 자음 연습(누르기 전 · 스크롤 없이 한 발 · 기록장) — 48px · 발사 56px`, wrap(w, h, `
    await E(async (tag) => {
      if (!D.G().app.isPortrait()) D.bad(tag + ' 세로 배치로 보지 않음');
      D.targets(48, tag + ' 시작'); D.noScroll(tag + ' 시작', false);
      return D.take();
    }, ${J(tag)});
    await snap(${J(`${tag}-1-title`)});
    await E(async (tag) => {
      const TX = D.T();
      D.tapPoint(D.$('[data-go="duel"]'), tag + ' 대결 단추'); D.$('[data-go="duel"]').click();
      await D.wait(300);
      if (D.cur() !== 'title') D.bad(tag + ' 휴대폰 세로에서 대결이 열림');
      const n = D.$('.app-notice');
      if (!n || !D.visible(n) || n.textContent !== TX.duel.phoneNotice) D.bad(tag + ' 대결 안내 한 줄이 안 뜸: ' + (n && n.textContent));
      else D.inView(n, tag + ' 대결 안내');
      return D.take();
    }, ${J(tag)});
    await snap(${J(`${tag}-2-duel-notice`)});
    await startPractice('m3', 'consonant', 2);
    ${rows('consonant')}
    await snap(${J(`${tag}-3-practice`)});
    await E(async (tag) => {
      const f = D.prFleet();
      const r = await D.prShoot(f[0]);   // 스크롤 없이 한 발
      if (!r || D.prShots().length !== 1) D.bad(tag + ' 스크롤 없이 한 발을 못 쏨');
      D.noScroll(tag + ' 한 발 뒤', true);
      D.tapSel('.ctl-logtoggle', '기록 단추');
      await D.wait(250);
      if (!D.visible(D.$('.ctl-log'))) D.bad(tag + ' 기록장이 펼쳐지지 않음');
      D.targets(48, tag + ' 기록장 펼침'); D.noScroll(tag + ' 기록장 펼침', true);
      return D.take();
    }, ${J(tag)});
    await snap(${J(`${tag}-4-practice-log`)});
    await E(async () => { const c = D.$('.ctl-log-close'); if (c && D.visible(c)) D.tap(c, '기록장 접기'); else D.tapSel('.ctl-logtoggle', '기록 단추'); if (D.visible(D.$('.ctl-log'))) D.bad('기록장이 접히지 않음'); return D.take(); });
  `));
  shotStep(`휴대폰 세로 ${w}×${h}: 모음 연습(누르기 전) · 결과 — 48px · 발사 56px`, wrap(w, h, `
    await startPractice('m3', 'vowel', 1);
    ${rows('vowel')}
    await snap(${J(`${tag}-5-practice-vowel`)});
    await startPractice('h1', 'consonant', 1);
    await finishPractice();
    await E(async (tag) => {
      D.targets(48, tag + ' 결과'); D.noScroll(tag + ' 결과', false);
      return D.take();
    }, ${J(tag)});
    await snap(${J(`${tag}-6-result`)});
  `));
}

// ── 눕힌 휴대폰 ────────────────────────────────────────────────────────
shotStep("눕힌 휴대폰 844×390: '세로로 돌려 주세요'", wrap(844, 390, `
  await E(async () => {
    const o = D.$('.app-rotate'), TX = D.T();
    if (!o || !D.visible(o) || o.textContent.trim() !== TX.rotate) D.bad("'세로로 돌려 주세요'가 안 뜸");
    else {
      const b = D.box(o);
      if (b.width < 843 || b.height < 389) D.bad('덮개가 화면을 다 덮지 않음');
      const top = D.d().elementFromPoint(422, 195);
      if (!top || !o.contains(top)) D.bad('덮개가 맨 위가 아님');
    }
    if (!D.G().app.isLowLandscape()) D.bad('낮은 가로 화면으로 보지 않음');
    return D.take();
  });
  await snap('844x390-rotate');
`));
