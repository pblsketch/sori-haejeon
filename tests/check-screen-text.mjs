// 실제 화면 문자열 점검(spec 10-4, handoff 관문 1·2·4) — 진짜 index.html의 모든 화면을 두 학년(중3·고1)으로 돌며
// 보이는 글(글 노드 + aria-label·title)을 모아 확인한다(aside).
//   · 소리를 '글자'라고 부르지 않는다('글자'라는 말 자체가 없음)
//   · 훈민정음·해례·제자 원리·상형·가획·중세·판옥선·협선·척후선·조선(+ 게임오버)이 없다
//   · 자모는 모두 빗금 표기 /ㄱ/ (완성된 한글 낱말 안은 상관없음)
//   · 한 화면의 설명 줄(조작부 문구 자리)은 한 번에 하나(대결은 팀 자리마다 하나), 그 줄은 한 줄로 그려진다
//   돌아보는 화면: 시작 · 설정(기록 지우기 확인) · 만든 사람·출처 · 이 기기의 소리 지도 · 연습 준비 · 풀이 예시 ·
//     연습 판(자음 1·3단계, 모음 1단계 — 고르는 중 '따라 해 보기' · 신호 뒤 · 배 찾음 · 끝) · 결과(알아 두기 · 질문) ·
//     하던 판 묻기 · 대결 준비 · 가림 · 숨기기 · 대결 판(고르는 중 · 신호 · 발 소진 기다림) · 대결 결과 ·
//     휴대폰 세로(대결 안내 · 연습 판 · 기록장) · 눕힌 휴대폰('세로로 돌려 주세요')
import { step, frame } from './aside.mjs';
import { DRIVER } from './lib/drive.mjs';

const J = JSON.stringify;

const wrap = (w, h, body) => `{
const bad = [];
const tab = await openTab(${J(frame(w, h, 'index.html'))});
try {
  await tab.evaluate(() => frameReady);
  await tab.evaluate(() => { ${DRIVER} });
  const E = async (fn, arg) => { const r = await tab.evaluate(fn, arg); if (Array.isArray(r)) bad.push(...r); return r; };
  await E(async () => { await D.fresh(); D.texts = []; D.afterCompose = (w) => D.grab('고르는 중 ' + w); return D.take(); });
  ${HELP}
  ${body}
  const n = await tab.evaluate(() => ({ screens: D.texts.length, lines: D.texts.reduce((a, t) => a + t.lines.length, 0) }));
  console.log('INFO 화면 ' + n.screens + '번 · 글 ' + n.lines + '줄 확인');
} catch (e) { bad.push('예외: ' + (e && (e.stack || e.message) || e)); }
finally { await closeTab(tab); }
if (bad.length) console.log('FAIL ' + [...new Set(bad)].slice(0, 40).join('\\nFAIL '));
else console.log('PASS');
}`;

// 대본 쪽 도우미: 연습 한 판(고른 소리 목록을 앞에 쏘고, 나머지는 숨은 배) → 결과
const HELP = `
async function practiceGame(g, sea, level, first, opts) {
  opts = opts || {};
  await E(async (a) => {
    const [g, sea, level] = a;
    if (D.cur() !== 'title') { const h = D.$('.pr-home, .duel-home, [data-act="home"]'); if (h) D.tap(h, '처음으로'); await D.until(() => D.cur() === 'title', 3000, '시작 화면'); }
    if (D.$('.app-dialog')) { D.grab('하던 판 묻기'); D.tapSel('[data-act="fresh"]', "'새 판'"); }
    D.grab('시작 화면');
    D.goTitleBtn('practice');
    await D.until(() => D.cur() === 'practice' && D.pr().view === 'setup', 4000, '연습 준비');
    D.prChoose(g, sea, level);
    D.grab('연습 준비 ' + sea + level);
    D.tapSel('.pr-start', '시작');
    await D.wait(300);
    if (D.pr().view === 'example') {
      const t0 = Date.now();
      while (D.pr().view === 'example' && Date.now() - t0 < 25000) { D.grab('풀이 예시'); await D.wait(500); }
    }
    await D.until(() => D.pr().view === 'play' && !D.pr().busy, 5000, '판 시작');
    D.grab('연습 판 시작 ' + sea + level);
    return D.take();
  }, [g, sea, level]);
  await E(async (a) => {
    const [first, stopAfter] = a;
    const fleet = D.prFleet(), seen = new Set(), plan = [];
    first.concat(fleet).forEach((x) => { const k = JSON.stringify(x); if (!seen.has(k)) { seen.add(k); plan.push(x); } });
    const t0 = Date.now();
    for (const x of plan.slice(0, stopAfter || 99)) {
      if (D.pr().view !== 'play' || Date.now() - t0 > 22000) break;
      await D.prShoot(x);
      D.grab('신호 뒤 ' + D.label(x));
    }
    return D.take();
  }, [first, opts.stopAfter || 0]);
  if (opts.stopAfter) return;
  await E(async () => {
    const t0 = Date.now();
    while (D.cur() === 'practice' && Date.now() - t0 < 6000) { D.grab('판 끝'); await D.wait(500); }
    await D.until(() => D.cur() === 'result', 4000, '결과 화면');
    await D.wait(300);
    D.grab('결과 화면');
    return D.take();
  });
}
`;

for (const g of ['m3', 'h1']) {
  step(`[${g}] 시작 · 설정 · 출처 · 연습 자음 1단계(풀이 예시 포함) · 결과 · 소리 지도`, wrap(1920, 1080, `
    await E(async () => {
      D.grab('시작 화면(처음)');
      D.goTitleBtn('settings'); await D.until(() => D.cur() === 'settings', 3000, '설정'); D.grab('설정');
      D.tapSel('[data-act="clear"]', '기록 지우기'); D.grab('기록 지우기 확인');
      D.tapSel('[data-act="clear-no"]', '그만두기');
      D.tapSel('.app-back', '뒤로'); await D.until(() => D.cur() === 'title', 3000, '시작 화면');
      D.goTitleBtn('credits'); await D.until(() => D.cur() === 'credits', 3000, '출처'); D.grab('만든 사람·출처');
      D.tapSel('.app-back', '뒤로'); await D.until(() => D.cur() === 'title', 3000, '시작 화면');
      return D.take();
    });
    await practiceGame(${J(g)}, 'consonant', 1, ['ㅂ', 'ㅁ', 'ㄱ', 'ㅇ']);
    await E(async () => {
      D.tapSel('[data-act="home"]', '처음으로'); await D.until(() => D.cur() === 'title', 3000, '시작 화면');
      D.goTitleBtn('soundmap'); await D.until(() => D.cur() === 'soundmap', 3000, '소리 지도'); D.grab('이 기기의 소리 지도');
      return D.take();
    });
  `));
  step(`[${g}] 연습 모음 1단계 · 자음 3단계(도중 처음으로 → 하던 판 묻기) · 결과`, wrap(1920, 1080, `
    await practiceGame(${J(g)}, 'vowel', 1, ['ㅚ', 'ㅔ', { backness: 'back', height: 'low', lips: 'rounded' }]);
    await practiceGame(${J(g)}, 'consonant', 3, [{ place: 'alveolar', manner: 'fricative', strength: 'aspirated' }, 'ㅅ'], { stopAfter: 3 });
    await E(async () => { D.tapSel('.pr-home', '처음으로'); await D.until(() => D.cur() === 'title', 3000, '시작 화면'); D.grab('하던 판 묻기'); return D.take(); });
  `));
  step(`[${g}] 대결 준비 · 가림 · 숨기기 · 대결 판 · 발 소진 · 대결 결과`, wrap(1920, 1080, `
    await E(async (g) => {
      D.goTitleBtn('duel');
      await D.until(() => D.cur() === 'duel' && D.du().screen() === 'setup', 4000, '대결 준비');
      D.duChoose({ grade: g, sea: 'consonant', level: 1, hideTime: true });
      D.grab('대결 준비');
      D.tapSel('.duel-start', '대결 시작');
      for (let k = 0; k < 2; k++) {
        await D.until(() => D.du().screen() === 'gate', 4000, '가림 화면'); D.grab('가림 화면 ' + k);
        D.tapSel('.duel-gate-go', '가림 단추');
        await D.until(() => D.du().screen() === 'placing', 3000, '숨기기'); D.grab('숨기기 ' + k);
        D.tap(D.$('.duel-place-sea button.sb-cell.is-can:not([disabled])'), '배치 칸'); await D.wait(150); D.grab('숨기기 한 척 뒤 ' + k);
        D.tapSel('.duel-done', '다 놓았어요');
        await D.wait(300); D.grab('남은 배 대신 숨김 ' + k);
      }
      await D.until(() => D.du().screen() === 'gate', 4000, '가림(다 숨김)'); D.grab('가림 화면(다 숨김)');
      D.tapSel('.duel-gate-go', '가림 단추');
      await D.until(() => D.du().screen() === 'play', 3000, '대결 판'); D.grab('대결 판 시작');
      return D.take();
    }, ${J(g)});
    await E(async () => {
      // 청팀은 빗나가기만 8발(발 소진 → 기다림 줄), 홍팀은 청팀 배를 찾아 이김
      const open = D.G().rules.level('consonant', 1).open;
      const bMiss = open.filter((id) => D.duFleet('red').indexOf(id) < 0).concat([{ place: 'palatal', manner: 'stop' }, { place: 'glottal', manner: 'stop' }, { place: 'bilabial', manner: 'fricative' }, { place: 'velar', manner: 'fricative' }]);
      const rHit = D.duFleet('blue');
      D.plan2 = { b: bMiss.slice(0, 8), r: rHit };
      for (let i = 0; i < 4; i++) { await D.fireBoth(D.plan2.b[i], null); D.grab('대결 신호 뒤 청 ' + i); }
      return D.take();
    });
    await E(async () => {
      for (let i = 4; i < 8; i++) { await D.fireBoth(D.plan2.b[i], null); D.grab('대결 신호 뒤 청 ' + i); }
      await D.wait(1700); D.grab('청팀 발 소진 기다림');
      for (let i = 0; i < D.plan2.r.length && D.du().phase() === 'play'; i++) { await D.fireBoth(null, D.plan2.r[i]); D.grab('대결 신호 뒤 홍 ' + i); }
      await D.until(() => D.du().phase() === 'over', 3000, '판 끝'); D.grab('대결 끝(남은 배 공개)');
      await D.until(() => D.cur() === 'result', 8000, '대결 결과'); await D.wait(300); D.grab('대결 결과');
      return D.take();
    });
  `));
  step(`[${g}] 휴대폰 세로 390×844: 대결 안내 · 연습 판 · 기록장 · 결과 / 눕힌 휴대폰`, wrap(390, 844, `
    await E(async () => {
      D.$('[data-go="duel"]').click(); await D.wait(200); D.grab('휴대폰 시작(대결 안내)');
      return D.take();
    });
    await practiceGame(${J(g)}, 'consonant', 2, [{ place: 'glottal', manner: 'fricative' }, 'ㄲ']);
    await E(async () => {
      if (D.cur() === 'result') { D.tapSel('[data-act="again"]', '한 판 더'); await D.until(() => D.cur() === 'practice', 3000, '연습'); }
      return D.take();
    });
    await practiceGame(${J(g)}, 'vowel', 2, ['ㅐ', 'ㅟ'], { stopAfter: 2 });
    await E(async () => {
      D.tapSel('.ctl-logtoggle', '기록 단추'); await D.wait(200); D.grab('휴대폰 기록장 펼침');
      await D.resize(844, 390); D.grab('눕힌 휴대폰');
      if (!D.visible(D.$('.app-rotate, .pr-rotate'))) D.bad("눕힌 휴대폰에 '세로로 돌려 주세요'가 안 보임");
      return D.take();
    });
  `));
}
