// 규칙 점검(브라우저 없이) — spec 10-1의 모든 항목.
//   node tests/check-rules.mjs
// 음운 표(3절), 채점 결과(5.3), 신호(5.4), 조작부 상태(5.1), 함대 배치(3.3, 6.3), 턴, 격침, 연습 끝, 대결 실시간(차례 없음)·팀별 발 수·승패(6.3), 알아 두기(6.5).
import { loadScripts, check, done } from './lib/load.mjs';

let ctx;
try {
  ctx = loadScripts(['js/core/util.js', 'js/data/sounds.js', 'js/data/fleets.js', 'js/data/levels.js', 'js/core/rules.js']);
} catch (e) {
  check(false, '스크립트 불러오기 실패: ' + e.message);
  done('규칙 점검');
}
const R = ctx.G && ctx.G.rules;
const S = ctx.SOUNDS, F = ctx.FLEETS, L = ctx.LEVELS;
if (!R || !S || !F || !L) { check(false, 'G.rules / SOUNDS / FLEETS / LEVELS 없음'); done('규칙 점검'); }

const J = (x) => JSON.stringify(x);
const eq = (a, b, msg) => check(J(a) === J(b), `${msg}: ${J(a)} ≠ ${J(b)}`);
const sortS = (a) => [...a].sort();
const groupSet = (gs) => gs.map((g) => sortS(g).join('')).sort();
const throws = (fn) => { try { fn(); return false; } catch (e) { return true; } };

// ───────────────────────── 1. 음운 표(spec 3.1·3.2) ─────────────────────────
const C_TABLE = [
  ['ㅂ', 'bilabial', 'stop', 'plain'], ['ㅃ', 'bilabial', 'stop', 'tense'], ['ㅍ', 'bilabial', 'stop', 'aspirated'],
  ['ㄷ', 'alveolar', 'stop', 'plain'], ['ㄸ', 'alveolar', 'stop', 'tense'], ['ㅌ', 'alveolar', 'stop', 'aspirated'],
  ['ㄱ', 'velar', 'stop', 'plain'], ['ㄲ', 'velar', 'stop', 'tense'], ['ㅋ', 'velar', 'stop', 'aspirated'],
  ['ㅈ', 'palatal', 'affricate', 'plain'], ['ㅉ', 'palatal', 'affricate', 'tense'], ['ㅊ', 'palatal', 'affricate', 'aspirated'],
  ['ㅅ', 'alveolar', 'fricative', 'plain'], ['ㅆ', 'alveolar', 'fricative', 'tense'],
  ['ㅎ', 'glottal', 'fricative', 'none'],
  ['ㅁ', 'bilabial', 'nasal', 'none'], ['ㄴ', 'alveolar', 'nasal', 'none'], ['ㅇ', 'velar', 'nasal', 'none'],
  ['ㄹ', 'alveolar', 'liquid', 'none'],
];
const V_TABLE = [
  ['ㅣ', 'high', 'front', 'unrounded'], ['ㅟ', 'high', 'front', 'rounded'], ['ㅡ', 'high', 'back', 'unrounded'], ['ㅜ', 'high', 'back', 'rounded'],
  ['ㅔ', 'mid', 'front', 'unrounded'], ['ㅚ', 'mid', 'front', 'rounded'], ['ㅓ', 'mid', 'back', 'unrounded'], ['ㅗ', 'mid', 'back', 'rounded'],
  ['ㅐ', 'low', 'front', 'unrounded'], ['ㅏ', 'low', 'back', 'unrounded'],
];
const PLACES = ['bilabial', 'alveolar', 'palatal', 'velar', 'glottal'];
const MANNERS = ['stop', 'affricate', 'fricative', 'nasal', 'liquid'];
const STRENGTHS = ['plain', 'tense', 'aspirated'];
const HEIGHTS = ['high', 'mid', 'low'];
const COLUMNS = ['front-unrounded', 'front-rounded', 'back-unrounded', 'back-rounded'];

eq(S.places, PLACES, '위치 순서');
eq(S.manners, MANNERS, '방법 순서');
eq(S.strengths, STRENGTHS, '세기 카드');
eq(S.heights, HEIGHTS, '혀의 높이 순서');
eq(S.columns, COLUMNS, '모음 열 순서');
check(S.consonants.length === 19, '자음 19개');
check(S.vowels.length === 10, '단모음 10개');
eq(S.consonants.map((c) => [c.id, c.place, c.manner, c.strength].join(',')).sort(), C_TABLE.map((r) => r.join(',')).sort(), '자음 표 = spec 3.1');
eq(S.vowels.map((v) => [v.id, v.height, v.backness, v.lips].join(',')).sort(), V_TABLE.map((r) => r.join(',')).sort(), '모음 표 = spec 3.2');
check(S.vowels.every((v) => v.column === v.backness + '-' + v.lips), '모음 열 = 앞뒤-입술');
check(new Set([...S.consonants, ...S.vowels].map((s) => s.id)).size === 29, '소리 id 29개 모두 다름');
check(S.consonants.every((c) => c.sea === 'consonant') && S.vowels.every((v) => v.sea === 'vowel'), '소리마다 바다 표시');
eq(R.slash('ㄲ'), '/ㄲ/', '빗금 표기');

// ───────────────────────── 2. 배 묶음(spec 3.3) ─────────────────────────
eq(groupSet(F.consonant[3]), groupSet([['ㄱ', 'ㄲ', 'ㅋ'], ['ㄷ', 'ㄸ', 'ㅌ'], ['ㅂ', 'ㅃ', 'ㅍ'], ['ㅈ', 'ㅉ', 'ㅊ']]), '자음 세 칸 배 묶음');
eq(groupSet(F.consonant[2]), groupSet([['ㅅ', 'ㅆ'], ['ㅂ', 'ㅁ'], ['ㄷ', 'ㄴ'], ['ㄱ', 'ㅇ']]), '자음 두 칸 배 묶음');
eq(groupSet(F.consonant[1]), groupSet([['ㅁ'], ['ㄴ'], ['ㅇ'], ['ㄹ'], ['ㅎ']]), '자음 한 칸 배 묶음');
eq(groupSet(F.vowel[3]), groupSet([['ㅣ', 'ㅔ', 'ㅐ'], ['ㅡ', 'ㅓ', 'ㅏ']]), '모음 세 칸 배 묶음');
eq(groupSet(F.vowel[2]), groupSet([['ㅣ', 'ㅟ'], ['ㅔ', 'ㅚ'], ['ㅡ', 'ㅜ'], ['ㅓ', 'ㅗ']]), '모음 두 칸 배 묶음');
eq(groupSet(F.vowel[1]), groupSet(V_TABLE.map((r) => [r[0]])), '모음 한 칸 배 = 10개 중 하나');

// ───────────────────────── 3. 단계(spec 4) ─────────────────────────
const c1 = R.level('consonant', 1), c2 = R.level('consonant', 2), c3 = R.level('consonant', 3);
const v1 = R.level('vowel', 1), v2 = R.level('vowel', 2);
const ALL_LEVELS = [c1, c2, c3, v1, v2];
check(ALL_LEVELS.every(Boolean), '단계 5개 모두 있음');
eq(sortS(c1.open), sortS(['ㅂ', 'ㄷ', 'ㄱ', 'ㅈ', 'ㅅ', 'ㅁ', 'ㄴ', 'ㅇ', 'ㄹ']), '자음 1단계 9칸');
check(c2.open.length === 19 && c3.open.length === 19, '자음 2·3단계 19칸');
check(v1.open.length === 10 && v2.open.length === 10, '모음 단계 10칸');
check(c1.strengthCards === false && c2.strengthCards === true && c3.strengthCards === true, '세기 카드: 1단계 없음, 2·3단계 있음');
check(c1.highlight && c2.highlight && !c3.highlight && v1.highlight && !v2.highlight, '신호 강조 여부');
eq(c1.show, { cellSounds: true, emptyCells: true, strengthSlots: true, lineNames: true, placeNames: true }, '자음 1단계 보이는 것');
eq(c2.show, { cellSounds: false, emptyCells: false, strengthSlots: false, lineNames: true, placeNames: true }, '자음 2단계 보이는 것');
eq(c3.show, { cellSounds: false, emptyCells: false, strengthSlots: false, lineNames: false, placeNames: false }, '자음 3단계 보이는 것');
eq(v1.show, { cellSounds: true, emptyCells: true, lineNames: true, placeNames: true }, '모음 1단계 보이는 것');
eq(v2.show, { cellSounds: false, emptyCells: false, lineNames: false, placeNames: false }, '모음 2단계 보이는 것');
eq([c1.help, c2.help, c3.help, v1.help, v2.help], [
  { followAlong: true, example: true }, { followAlong: false, example: false }, { followAlong: false, example: false },
  { followAlong: true, example: false }, { followAlong: false, example: false }], '도움(따라 해 보기·풀이 예시)');
eq(ALL_LEVELS.map((l) => l.fleet), [[2, 1, 1], [3, 2, 1], [3, 2, 1], [3, 2, 1], [3, 2, 1]], '함대 구성(큰 배부터)');
eq(ALL_LEVELS.map((l) => l.turns), [8, 12, 12, 8, 8], '제한 턴');
eq(ALL_LEVELS.map((l) => l.sea + l.level), ['consonant1', 'consonant2', 'consonant3', 'vowel1', 'vowel2'], '단계에 바다·번호');
eq(groupSet(R.allowedGroups(c1, 2)), groupSet([['ㅂ', 'ㅁ'], ['ㄷ', 'ㄴ'], ['ㄱ', 'ㅇ']]), '자음 1단계 두 칸 배 = /ㅂ/·/ㅁ/, /ㄷ/·/ㄴ/, /ㄱ/·/ㅇ/');
eq(groupSet(R.allowedGroups(c1, 1)), groupSet([['ㅁ'], ['ㄴ'], ['ㅇ'], ['ㄹ']]), '자음 1단계 한 칸 배 = /ㅁ/ /ㄴ/ /ㅇ/ /ㄹ/');
check(R.allowedGroups(c2, 1).length === 5 && R.allowedGroups(v1, 1).length === 10, '2단계 이상은 모든 묶음');

// ───────────────────────── 4. 조합 채점(spec 5.3) — 모든 조합 ─────────────────────────
const emptyBoard = { fleet: [], shots: [] };
const cLookup = (p, m, s) => C_TABLE.find((r) => r[1] === p && r[2] === m && r[3] === s);
const cellHasSound = (p, m) => C_TABLE.some((r) => r[1] === p && r[2] === m);
const strengthless = (p, m) => m === 'nasal' || m === 'liquid' || (p === 'glottal' && m === 'fricative');

// 2·3단계: 위치 × 방법 × 세기(없음 포함)
for (const lv of [c2, c3]) for (const p of PLACES) for (const m of MANNERS) for (const s of [...STRENGTHS, null]) {
  const input = { place: p, manner: m, strength: s };
  const tag = `자음${lv.level} ${p}+${m}+${s}`;
  if (strengthless(p, m)) {
    const row = cLookup(p, m, 'none');
    const o = R.resolveShot(lv, input, emptyBoard);
    if (row) { check(o.kind === 'miss' && o.sound === row[0] && o.usesTurn, `${tag} → /${row[0]}/`); }
    else check(o.kind === 'none' && o.sound === null && o.usesTurn && o.emptyCell === true, `${tag} → 없는 소리(빈칸)`);
  } else if (s === null) {
    check(throws(() => R.resolveShot(lv, input, emptyBoard)), `${tag} → 세기 없이 쏠 수 없음(발사 단추 꺼짐)`);
  } else {
    const row = cLookup(p, m, s);
    const o = R.resolveShot(lv, input, emptyBoard);
    if (row) check(o.kind === 'miss' && o.sound === row[0], `${tag} → /${row[0]}/ (${J(o)})`);
    else check(o.kind === 'none' && o.sound === null && o.usesTurn && o.emptyCell === !cellHasSound(p, m), `${tag} → 없는 소리 (${J(o)})`);
  }
}
// 1단계: 세기 카드 없음 → 파열·파찰·마찰은 예사소리, /ㅎ/은 이번 바다에 없는 칸
for (const p of PLACES) for (const m of MANNERS) for (const s of [...STRENGTHS, null]) {
  const tag = `자음1 ${p}+${m}+${s}`;
  const o = R.resolveShot(c1, { place: p, manner: m, strength: s }, emptyBoard);
  const row = cLookup(p, m, strengthless(p, m) ? 'none' : 'plain');
  if (!row) check(o.kind === 'none' && o.usesTurn, `${tag} → 없는 소리`);
  else if (row[0] === 'ㅎ') check(o.kind === 'notInSea' && !o.usesTurn && o.sound === 'ㅎ', `${tag} → 이번 바다에 없는 칸`);
  else check(o.kind === 'miss' && o.sound === row[0] && c1.open.includes(row[0]), `${tag} → /${row[0]}/`);
}
// 꼭 짚을 사례
{
  const o1 = R.resolveShot(c2, { place: 'glottal', manner: 'fricative', strength: 'aspirated' }, emptyBoard);
  check(o1.sound === 'ㅎ' && o1.key === R.resolveShot(c2, { place: 'glottal', manner: 'fricative', strength: null }, emptyBoard).key, '/ㅎ/은 세기 구분 없음(세기를 무시)');
  const o2 = R.resolveShot(c2, { place: 'alveolar', manner: 'fricative', strength: 'aspirated' }, emptyBoard);
  check(o2.kind === 'none' && o2.emptyCell === false, '잇몸 + 마찰 + 거센 = 없는 소리(소리가 있는 칸 → 판에 찍지 않음)');
  const o3 = R.resolveShot(c1, { place: 'glottal', manner: 'fricative' }, emptyBoard);
  check(o3.kind === 'notInSea' && o3.usesTurn === false, '자음 1단계 /ㅎ/ = 이번 바다에 없는 칸');
  const o4 = R.resolveShot(c2, { place: 'palatal', manner: 'stop', strength: 'plain' }, emptyBoard);
  check(o4.kind === 'none' && o4.emptyCell === true && J(o4.cell) === J({ place: 'palatal', manner: 'stop' }), '센입천장 + 파열 = 없는 소리(빈칸에 표시)');
}
// 모음: 혀 자리 6 × 입술 2
for (const b of ['front', 'back']) for (const h of HEIGHTS) for (const lips of ['unrounded', 'rounded']) {
  const row = V_TABLE.find((r) => r[1] === h && r[2] === b && r[3] === lips);
  for (const lv of [v1, v2]) {
    const o = R.resolveShot(lv, { backness: b, height: h, lips }, emptyBoard);
    const tag = `모음${lv.level} ${b}+${h}+${lips}`;
    if (row) check(o.kind === 'miss' && o.sound === row[0], `${tag} → /${row[0]}/`);
    else check(o.kind === 'none' && o.usesTurn && o.emptyCell === true && h === 'low' && lips === 'rounded', `${tag} → 없는 소리`);
  }
}
check(throws(() => R.resolveShot(v1, { backness: 'front', height: 'high' }, emptyBoard)), '모음: 입술을 안 고르면 쏠 수 없음');
// inputOf: 소리 → 조합(풀이 예시·점검용)
for (const r of C_TABLE) eq(R.resolveShot(c2, R.inputOf(r[0]), emptyBoard).sound, r[0], `inputOf(${r[0]})`);
for (const r of V_TABLE) eq(R.resolveShot(v1, R.inputOf(r[0]), emptyBoard).sound, r[0], `inputOf(${r[0]})`);

// ───────────────────────── 5. 조작부 상태(spec 5.1) ─────────────────────────
eq(R.controls(c1, { place: 'velar', manner: 'stop' }), { strengthCards: false, strengthDisabled: true, fireEnabled: true }, '자음1: 위치+방법이면 발사');
eq(R.controls(c1, { place: 'velar' }).fireEnabled, false, '자음1: 방법 없으면 발사 꺼짐');
eq(R.controls(c1, {}).fireEnabled, false, '자음1: 아무것도 없으면 발사 꺼짐');
eq(R.controls(c1, { place: 'glottal', manner: 'stop' }).fireEnabled, true, '자음1: 없는 조합도 막지 않음');
eq(R.controls(c2, { place: 'velar', manner: 'stop' }), { strengthCards: true, strengthDisabled: false, fireEnabled: false }, '자음2: 파열은 세기를 골라야 발사');
eq(R.controls(c2, { place: 'velar', manner: 'stop', strength: 'tense' }).fireEnabled, true, '자음2: 세기 고르면 발사');
eq(R.controls(c2, { manner: 'nasal' }), { strengthCards: true, strengthDisabled: true, fireEnabled: false }, '자음2: 비음이면 세기 흐림(위치 전)');
eq(R.controls(c2, { place: 'glottal', manner: 'fricative' }), { strengthCards: true, strengthDisabled: true, fireEnabled: true }, '자음2: 목청+마찰이면 세기 흐림');
eq(R.controls(c2, { place: 'glottal', manner: 'fricative', strength: 'plain' }).strengthDisabled, true, '자음2: 목청+마찰은 세기를 골라 두었어도 흐림');
eq(R.controls(c2, { place: 'glottal' }).strengthDisabled, false, '자음2: 목청만 고른 상태는 흐리지 않음');
for (const lv of [c2, c3]) for (const p of [...PLACES, null]) for (const m of [...MANNERS, null]) for (const s of [...STRENGTHS, null]) {
  const st = R.controls(lv, { place: p, manner: m, strength: s });
  const dis = m === 'nasal' || m === 'liquid' || (p === 'glottal' && m === 'fricative');
  const fire = !!(p && m && (dis || s));
  check(st.strengthDisabled === dis && st.fireEnabled === fire, `조작부 자음${lv.level} ${p}+${m}+${s} → ${J(st)}`);
}
for (const b of ['front', 'back', null]) for (const h of [...HEIGHTS, null]) for (const lips of ['unrounded', 'rounded', null]) {
  const st = R.controls(v1, { backness: b, height: h, lips });
  check(st.strengthCards === false && st.strengthDisabled === true && st.fireEnabled === !!(b && h && lips), `조작부 모음 ${b}+${h}+${lips}`);
}

// ───────────────────────── 6. 판 만들기 · 쏘기 도우미 ─────────────────────────
const ship = (...ids) => ({ size: ids.length, sounds: ids });
const practice = (lv, fleet) => R.newGame({ mode: 'practice', grade: 'm3', sea: lv.sea, level: lv.level, fleet });
const shoot = (st, id) => R.fire(st, R.inputOf(id));

// 같은 없는 조합 반복 / 세기만 바꿈 (spec 5.3-2)
{
  let g = practice(c2, [ship('ㄱ', 'ㄲ', 'ㅋ'), ship('ㅅ', 'ㅆ'), ship('ㄹ')]);
  let r = R.fire(g, { place: 'glottal', manner: 'stop', strength: 'plain' }); g = r.state;
  check(r.outcome.kind === 'none' && R.sideSummary(g, 'player').turnsUsed === 1, '없는 조합 → 없는 소리, 턴 씀');
  r = R.fire(g, { place: 'glottal', manner: 'stop', strength: 'plain' });
  check(r.outcome.kind === 'already' && !r.outcome.usesTurn && r.state === g, '똑같은 없는 조합 다시 → 이미 쏜 소리, 턴 안 씀, 상태 그대로');
  r = R.fire(g, { place: 'glottal', manner: 'stop', strength: 'tense' }); g = r.state;
  check(r.outcome.kind === 'none' && R.sideSummary(g, 'player').turnsUsed === 2, '같은 빈칸 + 다른 세기 → 다시 없는 소리, 턴 씀');
  r = R.fire(g, { place: 'alveolar', manner: 'fricative', strength: 'aspirated' }); g = r.state;
  r = R.fire(g, { place: 'alveolar', manner: 'fricative', strength: 'aspirated' });
  check(r.outcome.kind === 'already', '잇몸+마찰+거센 반복 → 이미 쏜 소리');
  r = shoot(g, 'ㅎ'); g = r.state;
  r = R.fire(g, { place: 'glottal', manner: 'fricative', strength: 'tense' });
  check(r.outcome.kind === 'already', '/ㅎ/을 세기만 바꿔 다시 → 이미 쏜 소리(세기 없음)');
  r = shoot(g, 'ㄱ'); g = r.state;
  check(r.outcome.kind === 'hit', '명중');
  r = shoot(g, 'ㄱ');
  check(r.outcome.kind === 'already' && r.state === g, '이미 쏜 소리 → 막음');
  const s = R.sideSummary(g, 'player');
  check(s.turnsUsed === 5 && s.dudCount === 3, `턴 5, 없는 소리 3 (${J(s)})`);
}
// 1단계: 세기를 넘겨도 예사소리로 → 같은 소리
{
  let g = practice(c1, [ship('ㄱ', 'ㅇ'), ship('ㄹ'), ship('ㄴ')]);
  let r = R.fire(g, { place: 'velar', manner: 'stop' }); g = r.state;
  r = R.fire(g, { place: 'velar', manner: 'stop', strength: 'tense' });
  check(r.outcome.kind === 'already', '자음1: 세기를 넘겨도 예사소리로 채점 → 이미 쏜 소리');
  r = R.fire(g, { place: 'glottal', manner: 'fricative' });
  check(r.outcome.kind === 'notInSea' && r.state === g && R.sideSummary(g, 'player').turnsUsed === 1, '이번 바다에 없는 칸 → 턴 안 씀');
}
// 모음 없는 소리 반복
{
  let g = practice(v1, [ship('ㅣ', 'ㅔ', 'ㅐ'), ship('ㅡ', 'ㅜ'), ship('ㅗ')]);
  let r = R.fire(g, { backness: 'front', height: 'low', lips: 'rounded' }); g = r.state;
  check(r.outcome.kind === 'none' && r.outcome.emptyCell && J(r.outcome.cell) === J({ height: 'low', column: 'front-rounded' }), '모음 앞·원순·저 = 없는 소리(빈칸)');
  r = R.fire(g, { backness: 'front', height: 'low', lips: 'rounded' });
  check(r.outcome.kind === 'already', '모음 없는 조합 반복 → 이미 쏜 소리');
}

// ───────────────────────── 7. 신호(spec 5.4) ─────────────────────────
const tg = (o) => J(o.targets);
{
  let o = R.signal(c2, 'ㄱ', ['ㄱ', 'ㄷ']);
  check(o.kind === 'hit' && o.targets.length === 0, '명중은 줄 정보를 더하지 않음');
  o = R.signal(c2, 'ㄱ', ['ㄲ', 'ㅇ', 'ㄷ']);
  check(o.kind === 'line' && tg(o) === J([{ cell: { place: 'velar', manner: 'stop' } }]), `같은 칸 우선(세로·가로도 참이지만 칸만) ${tg(o)}`);
  o = R.signal(c2, 'ㄱ', ['ㅇ', 'ㄷ']);
  check(o.kind === 'line' && tg(o) === J([{ place: 'velar' }, { manner: 'stop' }]), `세로+가로 동시 강조 ${tg(o)}`);
  o = R.signal(c2, 'ㄱ', ['ㅇ']);
  check(o.kind === 'line' && tg(o) === J([{ place: 'velar' }]), '세로줄만');
  o = R.signal(c2, 'ㄱ', ['ㄷ']);
  check(o.kind === 'line' && tg(o) === J([{ manner: 'stop' }]), '가로줄만');
  o = R.signal(c2, 'ㄱ', ['ㅁ', 'ㄹ']);
  check(o.kind === 'miss' && o.targets.length === 0, '빗나감');
  o = R.signal(c2, 'ㄱ', []);
  check(o.kind === 'miss', '배가 다 맞았으면 빗나감');
  o = R.signal(c3, 'ㄱ', ['ㄲ']);
  check(o.kind === 'line' && o.targets.length === 0, '자음 3단계: 같은 줄이지만 강조 없음');
  o = R.signal(c3, 'ㄱ', ['ㅇ', 'ㄷ']);
  check(o.kind === 'line' && o.targets.length === 0, '자음 3단계: 세로·가로도 강조 없음');
  o = R.signal(c1, 'ㄱ', ['ㅇ']);
  check(o.kind === 'line' && tg(o) === J([{ place: 'velar' }]), '자음 1단계 강조 있음');
}
{ // 모음
  let o = R.signal(v1, 'ㅣ', ['ㅟ', 'ㅡ', 'ㅔ']);
  check(o.kind === 'line' && tg(o) === J([{ pair: { height: 'high', column: 'front-rounded' } }]), `모음 입술 짝 우선 → 짝 칸만 ${tg(o)}`);
  o = R.signal(v1, 'ㅓ', ['ㅗ']);
  check(o.kind === 'line' && tg(o) === J([{ pair: { height: 'mid', column: 'back-rounded' } }]), '모음 /ㅓ/ → 짝 /ㅗ/ 칸');
  o = R.signal(v1, 'ㅟ', ['ㅣ']);
  check(o.kind === 'line' && tg(o) === J([{ pair: { height: 'high', column: 'front-unrounded' } }]), '모음 /ㅟ/ → 짝 /ㅣ/ 칸');
  o = R.signal(v1, 'ㅣ', ['ㅡ', 'ㅔ']);
  check(o.kind === 'line' && tg(o) === J([{ height: 'high' }, { column: 'front-unrounded' }]), `모음 가로+세로 동시 ${tg(o)}`);
  o = R.signal(v1, 'ㅣ', ['ㅜ']);
  check(o.kind === 'line' && tg(o) === J([{ height: 'high' }]), '모음 같은 높이 → 가로줄');
  o = R.signal(v1, 'ㅣ', ['ㅐ']);
  check(o.kind === 'line' && tg(o) === J([{ column: 'front-unrounded' }]), '모음 같은 열 → 세로열');
  o = R.signal(v1, 'ㅣ', ['ㅚ']);
  check(o.kind === 'miss', '모음: 앞뒤만 같고 입술·높이가 다르면 빗나감(/ㅣ/ vs /ㅚ/)');
  o = R.signal(v1, 'ㅏ', ['ㅗ', 'ㅜ']);
  check(o.kind === 'miss', '모음: /ㅏ/ vs /ㅗ/·/ㅜ/ 앞뒤만 같음 → 빗나감');
  o = R.signal(v2, 'ㅣ', ['ㅟ']);
  check(o.kind === 'line' && o.targets.length === 0, '모음 2단계: 같은 줄이지만 강조 없음');
}
{ // 맞힌 칸은 셈에서 뺀다(판 흐름으로)
  let g = practice(c2, [ship('ㅂ', 'ㅃ', 'ㅍ'), ship('ㄱ', 'ㅇ'), ship('ㄹ')]);
  let r = shoot(g, 'ㄱ'); g = r.state; check(r.outcome.kind === 'hit', '/ㄱ/ 명중');
  r = shoot(g, 'ㄲ'); g = r.state;
  check(r.outcome.kind === 'line' && tg(r.outcome) === J([{ place: 'velar' }, { manner: 'stop' }]), `맞힌 /ㄱ/은 같은 칸으로 치지 않음 ${tg(r.outcome)}`);
  r = shoot(g, 'ㅇ'); g = r.state; check(r.outcome.kind === 'hit' && r.outcome.sunkShip === 1 && r.outcome.sunk === 2, '/ㅇ/ 명중 → 두 칸 배 격침(sunk = 크기, sunkShip = 배 번호)');
  r = shoot(g, 'ㅋ'); g = r.state;
  check(r.outcome.kind === 'line' && tg(r.outcome) === J([{ manner: 'stop' }]), '맞힌 /ㅇ/도 세로줄에서 빠짐 → 가로줄만');
  const sh = g.teams.player.shots;
  check(sh.length === 4 && sh[1].kind === 'line' && J(sh[1].targets) === J([{ place: 'velar' }, { manner: 'stop' }]), '신호 흔적이 기록에 쌓임');
}

{ // 자음 1단계 풀이 예시(js/data/text.js의 정해진 판과 같은 값)
  let g = practice(c1, [ship('ㄷ', 'ㄴ'), ship('ㅇ'), ship('ㄹ')]);
  let r = shoot(g, 'ㅅ'); g = r.state;
  check(r.outcome.kind === 'line' && tg(r.outcome) === J([{ place: 'alveolar' }]), `풀이 예시 1발 /ㅅ/ → 잇몸 세로줄만 ${tg(r.outcome)}`);
  r = shoot(g, 'ㄴ'); g = r.state; check(r.outcome.kind === 'hit' && r.outcome.sunk === null, '풀이 예시 2발 /ㄴ/ 명중');
  r = shoot(g, 'ㄷ'); check(r.outcome.kind === 'hit' && r.outcome.sunk === 2, '풀이 예시 3발 /ㄷ/ 명중 + 두 칸 배 격침');
}

// ───────────────────────── 8. 함대 배치(spec 3.3, 6.3) ─────────────────────────
function validFleet(lv, fleet) {
  if (fleet.length !== lv.fleet.length) return 'ships ' + fleet.length;
  const used = new Set();
  for (let i = 0; i < fleet.length; i++) {
    const s = fleet[i];
    if (s.size !== lv.fleet[i] || s.sounds.length !== s.size) return 'size order';
    const key = sortS(s.sounds).join('');
    if (!F[lv.sea][s.size].some((g) => sortS(g).join('') === key)) return 'group ' + key;
    for (const id of s.sounds) { if (!lv.open.includes(id)) return 'not open ' + id; if (used.has(id)) return 'overlap ' + id; used.add(id); }
  }
  return '';
}
// 모든 선택 경로(직접 배치): 막다른 상태 없음 + 어느 중간에서 시간이 지나도 채우기 성공
for (const lv of ALL_LEVELS) {
  let paths = 0, nodes = 0, bad = [];
  const walk = (fleet) => {
    nodes++;
    for (const seed of [1, 7, 42]) {
      const full = R.fillFleet(lv, fleet, R.makeRng(seed + nodes));
      const why = validFleet(lv, full);
      if (why || J(full.slice(0, fleet.length)) !== J(fleet)) bad.push('fill ' + J(fleet) + ' ' + why);
    }
    if (fleet.length === lv.fleet.length) {
      paths++; const why = validFleet(lv, fleet); if (why) bad.push('path ' + why);
      check(R.nextShipSize(lv, fleet) === null && R.placeableGroups(lv, fleet).length === 0, 'complete fleet has no next');
      return;
    }
    check(R.nextShipSize(lv, fleet) === lv.fleet[fleet.length], 'next ship size = 큰 배부터');
    const opts = R.placeableGroups(lv, fleet);
    if (!opts.length) { bad.push('dead end ' + J(fleet)); return; }
    for (const g of opts) {
      check(R.validatePlacement(lv, fleet, g).ok, 'placeable group validates');
      walk(R.addShip(lv, fleet, g));
    }
  };
  walk([]);
  check(!bad.length, `${lv.sea}${lv.level}: 막다른 상태·채우기 실패 없음 ${bad.slice(0, 3).join(' | ')}`);
  check(paths > 0, `${lv.sea}${lv.level}: 경로 ${paths}개, 상태 ${nodes}개`);
}
{ // 직접 배치 거절
  const vp = (lv, fl, g) => R.validatePlacement(lv, fl, g).ok;
  check(!vp(c2, [], ['ㅁ']), '큰 배부터: 첫 배로 한 칸 배 불가');
  check(!vp(c2, [], ['ㄱ', 'ㄷ', 'ㅂ']), '허용 묶음 밖 불가');
  check(vp(c2, [], ['ㅋ', 'ㄱ', 'ㄲ']), '묶음 안 순서는 상관없음');
  check(!vp(c2, [ship('ㄱ', 'ㄲ', 'ㅋ')], ['ㄱ', 'ㅇ']), '겹침 불가');
  check(!vp(c1, [], ['ㅅ', 'ㅆ']), '자음1: 열리지 않은 칸 불가');
  check(!vp(c1, [ship('ㄱ', 'ㅇ')], ['ㅎ']), '자음1: /ㅎ/ 불가');
  check(!vp(v1, [ship('ㅣ', 'ㅔ', 'ㅐ')], ['ㅣ', 'ㅟ']), '모음: 겹침 불가');
  check(!vp(v1, [ship('ㅣ', 'ㅔ', 'ㅐ'), ship('ㅡ', 'ㅜ'), ship('ㅏ')], ['ㅓ']), '함대가 다 차면 더 못 놓음');
  check(throws(() => R.addShip(c2, [], ['ㅁ'])), 'addShip은 잘못된 배치를 거절');
  eq(R.addShip(c2, [], ['ㅋ', 'ㄱ', 'ㄲ'])[0].sounds, ['ㄱ', 'ㄲ', 'ㅋ'], '묶음은 정해진 순서로 저장');
}
// 무작위 배치 많이
for (const lv of ALL_LEVELS) {
  let badCount = 0; const seen3 = new Set(), seen1 = new Set();
  const rng = R.makeRng(1000 + lv.level);
  for (let i = 0; i < 3000; i++) {
    const fl = R.randomFleet(lv, rng);
    if (validFleet(lv, fl)) badCount++;
    seen3.add(fl[0].sounds.join('')); seen1.add(fl[fl.length - 1].sounds.join(''));
  }
  check(badCount === 0, `${lv.sea}${lv.level}: 무작위 배치 3000번 모두 규칙대로 (틀림 ${badCount})`);
  check(seen3.size === R.allowedGroups(lv, lv.fleet[0]).length, `${lv.sea}${lv.level}: 첫 배가 허용 묶음을 고루 씀 (${seen3.size})`);
  check(seen1.size >= 3, `${lv.sea}${lv.level}: 마지막 배도 여러 가지 (${seen1.size})`);
}
check(validFleet(c2, R.randomFleet(c2)) === '', '기본 난수로도 배치');

// ───────────────────────── 9. 격침 · 연습 끝 ─────────────────────────
{
  let g = practice(c1, [ship('ㄱ', 'ㅇ'), ship('ㄹ'), ship('ㄴ')]);
  let r = shoot(g, 'ㄱ'); g = r.state; check(r.outcome.sunk === null && r.outcome.sunkShip === null, '한 칸만 맞으면 격침 아님');
  r = shoot(g, 'ㅇ'); g = r.state; check(r.outcome.sunkShip === 0 && r.outcome.sunk === 2, '두 칸 배 격침');
  r = shoot(g, 'ㄹ'); g = r.state; check(r.outcome.sunkShip === 1 && r.outcome.sunk === 1 && !r.outcome.over, '한 칸 배 격침, 아직 안 끝남');
  eq(R.sideSummary(g, 'player').sunkShips, [0, 1], '격침 목록');
  eq(sortS(R.sideSummary(g, 'player').hitSounds), sortS(['ㄱ', 'ㅇ', 'ㄹ']), '맞힌 소리');
  r = shoot(g, 'ㄴ'); g = r.state;
  check(r.outcome.over && g.phase === 'over' && g.result.success === true, '모든 배를 찾으면 성공');
  check(throws(() => shoot(g, 'ㅁ')), '끝난 판은 더 쏠 수 없음');
  const rec = R.makeRecord(g);
  check(rec.teams.player.turnsUsed === 4 && rec.result.success === true && rec.turnLimit === 8, '기록: 4턴 성공');
}
{
  let g = practice(c1, [ship('ㄱ', 'ㅇ'), ship('ㄹ'), ship('ㄴ')]);
  const misses = ['ㅂ', 'ㄷ', 'ㅈ', 'ㅅ', 'ㅁ'];
  for (const id of misses) g = shoot(g, id).state;
  g = R.fire(g, { place: 'palatal', manner: 'stop' }).state; // 없는 소리
  g = R.fire(g, { place: 'glottal', manner: 'fricative' }).state; // 이번 바다에 없는 칸(턴 안 씀)
  g = shoot(g, 'ㄱ').state;
  check(g.phase === 'playing' && R.sideSummary(g, 'player').turnsLeft === 1, '7턴 뒤 1턴 남음');
  const r = shoot(g, 'ㄹ'); g = r.state;
  check(r.outcome.over && g.phase === 'over' && g.result.success === false, '제한 턴 소진 → 끝(실패)');
}
{ // 마지막 턴에 다 찾으면 성공
  let g = practice(c1, [ship('ㄱ', 'ㅇ'), ship('ㄹ'), ship('ㄴ')]);
  for (const id of ['ㅂ', 'ㄷ', 'ㅈ', 'ㅅ', 'ㄱ', 'ㅇ', 'ㄹ']) g = shoot(g, id).state;
  g = shoot(g, 'ㄴ').state;
  check(g.phase === 'over' && g.result.success === true, '8번째 발로 다 찾으면 성공');
}

// ───────────────────────── 10. 대결: 실시간 — 차례 없음(spec 6.3) ─────────────────────────
// 순수 판정: 한 발 뒤 두 팀의 현황만으로. last = 방금 쏜 팀
const DO = (o) => R.duelOutcome(Object.assign({ turnLimit: 8, blueUsed: 0, redUsed: 0, blueDone: false, redDone: false, blueHits: 0, redHits: 0 }, o));
check(DO({ blueUsed: 3, redUsed: 5, blueHits: 2 }) === null, '아무도 다 찾지 못했고 발이 남음 → 안 끝남');
eq(DO({ blueUsed: 4, redUsed: 1, blueDone: true, last: 'blue' }), { winner: 'blue', reason: 'found-all' }, '청팀이 먼저 다 찾음 → 그 순간 청팀 승');
eq(DO({ blueUsed: 6, redUsed: 2, redDone: true, last: 'red' }), { winner: 'red', reason: 'found-all' }, '홍팀이 먼저 다 찾음 → 홍팀 승(청팀이 발을 더 썼어도)');
check(DO({ blueUsed: 8, redUsed: 3, blueHits: 5 }) === null, '한 팀만 발을 다 씀 → 다른 팀은 계속(안 끝남)');
check(DO({ blueUsed: 2, redUsed: 8, redHits: 4 }) === null, '홍팀만 발을 다 씀 → 청팀은 계속');
eq(DO({ blueUsed: 8, redUsed: 8, blueHits: 3, redHits: 2 }), { winner: 'blue', reason: 'more-hits' }, '두 팀 발 소진 → 맞힌 칸 많은 청팀 승');
eq(DO({ blueUsed: 8, redUsed: 8, blueHits: 1, redHits: 2 }), { winner: 'red', reason: 'more-hits' }, '두 팀 발 소진 → 맞힌 칸 많은 홍팀 승');
eq(DO({ blueUsed: 8, redUsed: 8, blueHits: 2, redHits: 2 }), { winner: null, reason: 'hits-tie' }, '두 팀 발 소진 → 동점 무승부');
eq(DO({ blueUsed: 8, redUsed: 8, redDone: true, blueHits: 3, redHits: 3, last: 'red' }), { winner: 'red', reason: 'found-all' }, '마지막 발로 다 찾음이 맞힌 칸 비교보다 먼저');
eq(DO({ blueUsed: 5, redUsed: 5, blueDone: true, redDone: true, last: 'red' }), { winner: 'red', reason: 'found-all' }, '(생기지 않는 경우) 둘 다 찾음이면 방금 쏜 팀');

// 판 흐름으로
const BLUE = [ship('ㄱ', 'ㅇ'), ship('ㄹ'), ship('ㄴ')]; // 청팀이 숨긴 배(홍팀이 쏨)
const RED = [ship('ㅂ', 'ㅁ'), ship('ㄹ'), ship('ㄴ')];  // 홍팀이 숨긴 배(청팀이 쏨)
const duel = () => R.newGame({ mode: 'duel', grade: 'h1', sea: 'consonant', level: 1, hideTime: false, fleets: { blue: BLUE, red: RED } });
const inp = (x) => (typeof x === 'string' ? R.inputOf(x) : x);
const shootT = (g, t, x) => R.fireTeam(g, t, inp(x));
// 쏘기 목록 [[팀, 소리], …]을 차례로(끝나면 멈춤)
const shots = (g, list) => { for (const [t, x] of list) { if (g.phase !== 'playing') break; g = shootT(g, t, x).state; } return g; };
const DUD = { place: 'palatal', manner: 'stop' }; // 없는 소리(발을 씀)
const DUDS = [DUD, { place: 'glottal', manner: 'stop' }, { place: 'bilabial', manner: 'fricative' }, { place: 'velar', manner: 'fricative' },
  { place: 'palatal', manner: 'nasal' }, { place: 'glottal', manner: 'nasal' }, { place: 'bilabial', manner: 'liquid' }, { place: 'velar', manner: 'liquid' }];
const TI = (g, t) => R.teamInfo(g, t);
{
  let g = duel();
  check(g.phase === 'playing' && !('rounds' in g), '대결: 라운드 없이 시작');
  check(R.fireRound === undefined && R.checkShot === undefined && R.roundInfo === undefined, '라운드(fireRound·checkShot·roundInfo)는 없음');
  check(R.whoseTurn === undefined && R.isLastShot === undefined, '번갈아 쏘기(차례·마지막 한 발)는 없음');
  eq(TI(g, 'blue'), { shotsUsed: 0, shotsLeft: 8, limit: 8, hits: 0, hitSounds: [], sunkShips: [], remainingShips: [0, 1, 2], allFound: false, outOfShots: false }, '팀 정보(처음)');
  check(throws(() => R.fire(g, R.inputOf('ㅂ'))), '대결은 연습의 fire를 쓰지 않음(fireTeam)');
  check(throws(() => R.fireTeam(g, 'green', R.inputOf('ㅂ'))) && throws(() => R.fireTeam(g, 'player', R.inputOf('ㅂ'))), '모르는 팀');
  check(throws(() => R.teamInfo(g, 'green')), '팀 정보: 모르는 팀');
  // 청팀이 연달아 두 발(홍팀은 아직 빚는 중)
  const before = J(g);
  const r1 = shootT(g, 'blue', 'ㅂ');
  check(J(g) === before, 'fireTeam은 입력 상태를 바꾸지 않음');
  check(r1.outcome.kind === 'hit' && r1.outcome.shooter === 'blue' && r1.outcome.usesTurn && !r1.outcome.over && r1.over === false, '청팀 첫 발 명중(결과에 쏜 팀·over)');
  const r2 = shootT(r1.state, 'blue', 'ㄷ');
  g = r2.state;
  check(g.teams.blue.shots.length === 2 && g.teams.red.shots.length === 0, '청팀만 두 발 — 차례 없음');
  check(TI(g, 'blue').shotsLeft === 6 && TI(g, 'red').shotsLeft === 8 && TI(g, 'blue').shotsUsed === 2, '팀마다 발 수를 따로 셈');
  check(TI(g, 'blue').hits === 1 && TI(g, 'red').hits === 0, '팀마다 맞힌 칸');
  // 홍팀도 쏜다: 청팀 기록과 따로
  const rr = shootT(g, 'red', 'ㅂ');
  check(rr.outcome.kind !== 'already' && rr.outcome.shooter === 'red', '팀마다 쏜 기록은 따로(홍팀의 /ㅂ/은 처음)');
  g = rr.state;
  // 발을 쓰지 않는 결과: 상태 그대로(같은 객체), 발 수 그대로
  const ns = shootT(g, 'blue', { place: 'glottal', manner: 'fricative' });
  check(ns.state === g && ns.outcome.kind === 'notInSea' && !ns.outcome.usesTurn && ns.over === false, '자음 1단계 /ㅎ/ → 이번 바다에 없는 칸(발 안 씀, 상태 그대로)');
  const al = shootT(g, 'blue', 'ㅂ');
  check(al.state === g && al.outcome.kind === 'already' && !al.outcome.usesTurn, '청팀이 쏜 /ㅂ/ 다시 → 이미 쏜 소리(발 안 씀)');
  check(TI(g, 'blue').shotsUsed === 2, '거부된 발은 셈하지 않음');
  // 없는 소리는 발을 씀, 똑같은 없는 조합 다시 → 이미 쏜 소리
  const d1 = shootT(g, 'blue', DUD);
  check(d1.outcome.kind === 'none' && d1.outcome.usesTurn && d1.state.teams.blue.shots.length === 3, '없는 소리 → 발 씀');
  check(shootT(d1.state, 'blue', DUD).outcome.kind === 'already', '똑같은 없는 조합 다시 → 이미 쏜 소리');
  check(shootT(d1.state, 'blue', { place: 'palatal', manner: 'stop', strength: 'tense' }).outcome.kind === 'already', '자음 1단계: 세기는 예사소리로 정해짐 → 같은 조합');
  check(shootT(d1.state, 'red', DUD).outcome.kind === 'none', '홍팀은 같은 없는 조합을 처음 쏨 → 없는 소리');
  // 그 순간의 상대 함대로 채점: 격침
  const sk = shootT(g, 'blue', 'ㅁ');
  check(sk.outcome.kind === 'hit' && sk.outcome.sunk === 2 && sk.outcome.sunkShip === 0, '청팀 /ㅂ/ 뒤 /ㅁ/ → 두 칸 배 격침');
  eq(TI(sk.state, 'blue').sunkShips, [0], '팀 정보: 격침한 배');
  eq(TI(sk.state, 'blue').remainingShips, [1, 2], '팀 정보: 남은 배');
}
{ // 엇갈려 쏘기: 다른 팀의 발끼리는 순서가 바뀌어도 같은 판(각 팀은 자기 바다만 쏜다)
  const A = shots(duel(), [['blue', 'ㅂ'], ['red', 'ㄱ'], ['blue', 'ㄷ'], ['red', 'ㅈ'], ['red', 'ㅇ']]);
  const B = shots(duel(), [['red', 'ㄱ'], ['red', 'ㅈ'], ['blue', 'ㅂ'], ['red', 'ㅇ'], ['blue', 'ㄷ']]);
  eq(A, B, '엇갈린 순서와 상관없이 같은 판');
}
{ // 먼저 다 찾은 팀이 그 순간 이김(상대는 발이 남았어도)
  let g = shots(duel(), [['red', 'ㄷ'], ['blue', 'ㅂ'], ['blue', 'ㅁ'], ['red', 'ㅈ'], ['blue', 'ㄹ']]);
  check(g.phase === 'playing', '(준비) 아직 안 끝남');
  const last = shootT(g, 'blue', 'ㄴ');
  g = last.state;
  check(last.over === true && last.outcome.over === true && g.phase === 'over', '마지막 배 → 그 발로 판이 끝남');
  eq(g.result, { winner: 'blue', reason: 'found-all' }, '청팀이 먼저 다 찾음 → 청팀 승');
  check(TI(g, 'red').shotsLeft === 6 && TI(g, 'blue').allFound, '홍팀은 발이 남았는데 끝남');
  check(throws(() => shootT(g, 'red', 'ㄱ')) && throws(() => shootT(g, 'blue', 'ㄷ')), '끝난 판은 더 쏠 수 없음');
  const rec = R.makeRecord(g);
  check(rec.result.winner === 'blue' && rec.teams.blue.turnsUsed === 4 && rec.teams.red.turnsUsed === 2, '대결 기록: 팀마다 쓴 발 수가 다름');
  eq(sortS(rec.teams.blue.hitSounds), sortS(['ㅂ', 'ㅁ', 'ㄹ', 'ㄴ']), '청팀 맞힌 소리');
  const h = shots(duel(), [['blue', 'ㅂ'], ['red', 'ㄱ'], ['red', 'ㅇ'], ['red', 'ㄹ'], ['blue', 'ㅁ'], ['red', 'ㄴ']]);
  check(h.phase === 'over' && h.result.winner === 'red' && h.result.reason === 'found-all' && h.teams.blue.shots.length === 2, '홍팀이 먼저 다 찾음 → 홍팀 승 ' + J(h.result));
}
{ // 발을 다 쓴 팀은 기다리고, 다른 팀은 계속 — 그 사이 다 찾으면 이김
  const B8 = ['ㅂ', 'ㅁ', 'ㄷ', 'ㅈ', 'ㅅ', 'ㄱ', 'ㅇ', 'ㄹ']; // 청팀 8발, 3칸 맞힘
  let g = shots(duel(), B8.map((x) => ['blue', x]));
  check(g.phase === 'playing' && TI(g, 'blue').shotsLeft === 0 && TI(g, 'blue').outOfShots && !TI(g, 'red').outOfShots, '청팀만 발을 다 씀 → 판은 계속');
  check(throws(() => shootT(g, 'blue', 'ㄴ')), '발을 다 쓴 팀은 쏠 수 없음(오류)');
  const nsOut = (() => { try { return shootT(g, 'blue', { place: 'glottal', manner: 'fricative' }); } catch (e) { return 'threw'; } })();
  check(nsOut === 'threw', '발을 다 쓴 팀은 발을 안 쓰는 조합도 쏠 수 없음');
  const g2 = shots(g, [['red', 'ㄷ'], ['red', 'ㄱ'], ['red', 'ㅇ'], ['red', 'ㄹ']]);
  check(g2.phase === 'playing', '홍팀은 계속 쏨');
  const f = shootT(g2, 'red', 'ㄴ');
  check(f.over && f.state.result.winner === 'red' && f.state.result.reason === 'found-all', '청팀이 기다리는 동안 홍팀이 다 찾음 → 홍팀 승 ' + J(f.state.result));
}
{ // 두 팀 모두 발 소진 → 맞힌 칸 비교
  const B3 = ['ㅂ', 'ㅁ', 'ㄷ', 'ㅈ', 'ㅅ', 'ㄱ', 'ㅇ', 'ㄹ']; // 청팀 3칸 맞힘
  const R2 = ['ㄷ', 'ㅈ', 'ㅅ', 'ㅂ', 'ㄱ', 'ㅁ', 'ㄹ', DUD]; // 홍팀 2칸 맞힘, 없는 소리 1
  const mix = (bs, rs) => { const out = []; for (let i = 0; i < 8; i++) { out.push(['red', rs[i]]); out.push(['blue', bs[i]]); } return out; };
  const g15 = shots(duel(), mix(B3, R2).slice(0, 15));
  check(g15.phase === 'playing' && TI(g15, 'blue').shotsLeft === 1 && TI(g15, 'red').shotsLeft === 0, '홍팀 소진·청팀 한 발 남음 → 계속');
  const lastB = shootT(g15, 'blue', B3[7]);
  const g = lastB.state;
  check(lastB.over && g.phase === 'over' && g.result.winner === 'blue' && g.result.reason === 'more-hits', '두 팀 발 소진 → 맞힌 칸 많은 팀 승 ' + J(g.result));
  eq(TI(g, 'blue'), { shotsUsed: 8, shotsLeft: 0, limit: 8, hits: 3, hitSounds: ['ㅂ', 'ㅁ', 'ㄹ'], sunkShips: [0, 1], remainingShips: [2], allFound: false, outOfShots: true }, '끝난 판 팀 정보');
  const k = shots(duel(), mix(['ㅂ', 'ㅁ', 'ㄷ', 'ㅈ', 'ㅅ', 'ㄱ', 'ㅇ', DUD], R2));
  check(k.phase === 'over' && k.result.winner === null && k.result.reason === 'hits-tie', '두 팀 발 소진 동점 → 무승부 ' + J(k.result));
  const rk = R.makeRecord(k);
  check(rk.teams.blue.dudCount === 1 && rk.teams.red.dudCount === 1 && rk.teams.blue.turnsUsed === 8 && rk.teams.red.turnsUsed === 8, '대결 기록: 팀별 발·없는 소리');
  const m = shots(duel(), mix(['ㄷ', 'ㅈ', 'ㅅ', 'ㄱ', 'ㅇ', DUD, { place: 'glottal', manner: 'stop' }, 'ㅂ'], R2));
  check(m.result.winner === 'red' && m.result.reason === 'more-hits', '두 팀 발 소진 → 홍팀이 더 많이 맞힘 ' + J(m.result));
  // 모음 바다(8발)
  const VB = [ship('ㅣ', 'ㅔ', 'ㅐ'), ship('ㅡ', 'ㅜ'), ship('ㅗ')], VR = [ship('ㅡ', 'ㅓ', 'ㅏ'), ship('ㅣ', 'ㅟ'), ship('ㅚ')];
  let v = R.newGame({ mode: 'duel', grade: 'm3', sea: 'vowel', level: 1, fleets: { blue: VB, red: VR } });
  v = shots(v, [['blue', 'ㅡ'], ['blue', 'ㅓ'], ['red', 'ㅣ'], ['blue', 'ㅏ'], ['blue', 'ㅣ'], ['red', 'ㅔ'], ['blue', 'ㅟ']]);
  check(v.phase === 'playing' && TI(v, 'blue').remainingShips.length === 1, '(준비) 모음: 청팀 배 하나 남음');
  const vw = shootT(v, 'blue', 'ㅚ');
  check(vw.over && vw.state.result.winner === 'blue' && vw.state.result.reason === 'found-all', '모음 바다: 청팀이 먼저 다 찾음');
}
{ // 숨기기 시간: 청팀 → 홍팀 직접 배치, 시간 지나면 남은 배 무작위
  let g = R.newGame({ mode: 'duel', grade: 'm3', sea: 'vowel', level: 1, hideTime: true, rng: R.makeRng(5) });
  check(g.phase === 'placing' && g.placingTeam === 'blue', '숨기기 시간: 청팀부터 배치');
  eq(R.placeableGroups(v1, g.teams.blue.fleet).map((x) => x.join('')).sort(), ['ㅡㅓㅏ', 'ㅣㅔㅐ'], '놓을 수 있는 묶음 = 세 칸 배 묶음');
  g = R.placeShip(g, ['ㅣ', 'ㅔ', 'ㅐ']);
  check(throws(() => R.placeShip(g, ['ㅣ', 'ㅟ'])), '겹치는 배치는 거절');
  g = R.finishPlacing(g, R.makeRng(9));
  check(validFleet(v1, g.teams.blue.fleet) === '' && g.teams.blue.fleet[0].sounds.join('') === 'ㅣㅔㅐ', '시간 지남 → 청팀 남은 배 채움(놓은 배 유지)');
  check(g.phase === 'placing' && g.placingTeam === 'red', '다음은 홍팀');
  g = R.finishPlacing(g, R.makeRng(10));
  check(validFleet(v1, g.teams.red.fleet) === '' && g.phase === 'playing' && g.placingTeam === null && !('rounds' in g) && TI(g, 'blue').shotsLeft === 8, '홍팀 배치 끝 → 대결 시작');
  let p = R.newGame({ mode: 'duel', grade: 'm3', sea: 'consonant', level: 2, hideTime: true });
  p = R.placeShip(p, ['ㅈ', 'ㅉ', 'ㅊ']); p = R.placeShip(p, ['ㅅ', 'ㅆ']); p = R.placeShip(p, ['ㅎ']);
  check(p.placingTeam === 'blue' && R.nextShipSize(c2, p.teams.blue.fleet) === null, '다 놓아도 "다 놓았어요" 전까진 그 팀 차례');
  p = R.finishPlacing(p);
  check(p.placingTeam === 'red' && J(p.teams.blue.fleet.map((s) => s.sounds.join(''))) === J(['ㅈㅉㅊ', 'ㅅㅆ', 'ㅎ']), '"다 놓았어요" → 놓은 그대로');
  p = R.placeShip(p, ['ㄱ', 'ㄲ', 'ㅋ']);
  const q = R.restartPlacing(p);
  check(q.placingTeam === 'blue' && q.teams.blue.fleet.length === 0 && q.teams.red.fleet.length === 0 && !('rounds' in q), '배치 도중 새로고침 → 청팀부터 다시');
  check(throws(() => R.fireTeam(p, 'blue', R.inputOf('ㄱ'))) && throws(() => R.fireTeam(p, 'red', R.inputOf('ㄴ'))), '배치 중에는 쏠 수 없음');
  const rnd = R.newGame({ mode: 'duel', grade: 'm3', sea: 'vowel', level: 2, hideTime: false, rng: R.makeRng(3) });
  check(rnd.phase === 'playing' && !validFleet(v2, rnd.teams.blue.fleet) && !validFleet(v2, rnd.teams.red.fleet), '숨기기 시간 끔 → 두 팀 무작위 배치');
  const c2d = R.newGame({ mode: 'duel', grade: 'm3', sea: 'consonant', level: 2, rng: R.makeRng(4) });
  check(TI(c2d, 'red').limit === 12 && TI(c2d, 'red').shotsLeft === 12, '팀마다 발 수 = 단계의 제한 턴(자음 2단계 12발)');
}

// ───────────────────────── 11. 알아 두기(spec 6.5) ─────────────────────────
const ids = (ns) => ns.map((n) => n.id);
eq(ids(R.notesFor('consonant', ['ㄱ', 'ㅇ', 'ㅁ'])), ['pair-ㄱㅇ', 'ng'], '/ㄱ/·/ㅇ/ 짝 + /ㅇ/ (/ㅂ/ 없이 /ㅁ/만은 짝 아님)');
eq(R.notesFor('consonant', ['ㄱ', 'ㅇ'])[0].sounds, ['ㄱ', 'ㅇ'], '짝 항목에 소리 두 개');
eq(ids(R.notesFor('consonant', ['ㅂ', 'ㅁ', 'ㄷ', 'ㄴ', 'ㄱ', 'ㅇ'])), ['pair-ㅂㅁ', 'pair-ㄷㄴ', 'pair-ㄱㅇ', 'ng'], '짝마다 한 줄');
eq(ids(R.notesFor('consonant', ['ㄱ', 'ㅋ', 'ㄹ'])), [], '나온 것이 없으면 빈 목록');
eq(ids(R.notesFor('vowel', ['ㅚ', 'ㅟ', 'ㅔ', 'ㅐ'])), ['oe-wi', 'e-ae'], '모음: /ㅚ/·/ㅟ/, /ㅔ/·/ㅐ/ 한 번씩');
eq(ids(R.notesFor('vowel', ['ㅐ'])), ['e-ae'], '/ㅐ/만 쏴도 /ㅔ/·/ㅐ/ 항목');
eq(ids(R.notesFor('vowel', ['ㅣ', 'ㅏ'])), [], '모음: 해당 없음');
{ // 판 기록: 연습(쏜 소리 전부 — 명중·빗나감 모두, 없는 소리 제외)
  let g = practice(c2, [ship('ㅈ', 'ㅉ', 'ㅊ'), ship('ㅅ', 'ㅆ'), ship('ㄹ')]);
  for (const id of ['ㅂ', 'ㅁ', 'ㄷ']) g = shoot(g, id).state;
  g = R.fire(g, { place: 'glottal', manner: 'nasal' }).state;
  const rec = R.makeRecord(g);
  eq(ids(rec.notes), ['pair-ㅂㅁ'], '연습 기록: 이번 판에 나온 것만');
  check(rec.teams.player.dudCount === 1 && rec.teams.player.turnsUsed === 4 && rec.teams.player.hitSounds.length === 0, '연습 기록: 턴·없는 소리 횟수');
}
{ // 대결: 두 팀 합침
  let g = shots(duel(), [['blue', 'ㄱ'], ['red', 'ㅇ']]);
  const rec = R.makeRecord(g);
  eq(ids(rec.notes), ['pair-ㄱㅇ', 'ng'], '대결: 청팀 /ㄱ/ + 홍팀 /ㅇ/ → 두 팀을 합쳐 짝');
  eq(sortS(rec.hitSoundsAll), ['ㅇ'], '대결: 맞힌 소리는 두 팀 합침(홍팀 /ㅇ/ 명중)');
  const h = shots(duel(), [['blue', 'ㄹ'], ['red', 'ㄹ'], ['blue', 'ㅂ'], ['red', 'ㄷ']]);
  eq(sortS(R.makeRecord(h).hitSoundsAll), sortS(['ㄹ', 'ㅂ']), '대결: 두 팀 맞힌 소리 합집합(중복 없음)');
}

// ───────────────────────── 12. 판 상태·기록은 JSON으로 옮길 수 있고, 입력을 바꾸지 않는다 ─────────────────────────
{
  let g = practice(v1, [ship('ㅡ', 'ㅓ', 'ㅏ'), ship('ㅣ', 'ㅟ'), ship('ㅚ')]);
  const before = J(g);
  const r = shoot(g, 'ㅡ');
  check(J(g) === before, 'fire는 입력 상태를 바꾸지 않음');
  const copy = JSON.parse(J(r.state));
  eq(shoot(copy, 'ㅓ'), shoot(r.state, 'ㅓ'), '저장→복원한 상태로 쏜 결과가 같음');
  const rec = R.makeRecord(r.state);
  const plain = (x) => x === null || ['string', 'boolean'].includes(typeof x) || (typeof x === 'number' && isFinite(x)) ||
    (Array.isArray(x) && x.every(plain)) || (typeof x === 'object' && !Array.isArray(x) && Object.values(x).every((v) => v !== undefined && plain(v)));
  check(plain(rec), '판 기록은 JSON으로 옮길 수 있는 평범한 값');
  check(plain(r.state), '판 상태는 JSON으로 옮길 수 있는 평범한 값');
  const dr = shootT(shootT(duel(), 'blue', 'ㅂ').state, 'red', DUD);
  check(plain(dr.state) && plain(R.makeRecord(dr.state)), '대결 판 상태·기록도 평범한 값');
  eq(shootT(JSON.parse(J(dr.state)), 'red', 'ㄱ'), shootT(dr.state, 'red', 'ㄱ'), '대결: 저장→복원한 상태로 쏜 결과가 같음');
  check(dr.state.v === 1 && !('rounds' in dr.state), '대결 판 상태 머리값(v 1, 라운드 없음)');
  check(g.v === 1 && g.mode === 'practice' && g.grade === 'm3' && g.sea === 'vowel' && g.level === 1, '판 상태 머리값');
  check(['mode', 'grade', 'sea', 'level', 'teams', 'result', 'notes', 'hitSoundsAll', 'turnLimit'].every((k) => k in rec), '판 기록 필드');
  check(throws(() => R.newGame({ mode: 'practice', grade: 'm3', sea: 'consonant', level: 1, fleet: [ship('ㅅ', 'ㅆ'), ship('ㄹ'), ship('ㄴ')] })), '규칙에 어긋난 함대는 거절');
  const rp = R.newGame({ mode: 'practice', grade: 'm3', sea: 'consonant', level: 3, rng: R.makeRng(2) });
  check(!validFleet(c3, rp.teams.enemy.fleet) && rp.phase === 'playing', '연습: 적 함대 무작위');
}

done('규칙 점검');
