// 문구 데이터(js/data/text.js) 점검 — 브라우저 없이.
//   · 소리 29개 모두 '따라 해 보기'가 있는지
//   · 금지 낱말이 문구와 파일 어디에도 없는지
//   · 문구 안의 소리가 모두 빗금 표기(/ㄱ/)인지
//   · 풀이 예시: 정확히 세 발, 학년마다 세 줄 이내, 함대가 규칙에 맞고 신호가 spec 5.4대로 나오는지
//   · 두 학년의 용어 키가 똑같은지, 디브리핑 질문이 학년 × 바다마다 3개 이상인지
import fs from 'node:fs';
import path from 'node:path';
import { loadScripts, check, done, ROOT } from './lib/load.mjs';

const FILE = 'js/data/text.js';
const ctx = loadScripts(['js/core/util.js', FILE].filter((f) => fs.existsSync(path.join(ROOT, f))));
const T = ctx.TEXT;
const H = ctx.G && ctx.G.text;
check(T && typeof T === 'object', 'window.TEXT가 있다');
check(H && typeof H.term === 'function', 'G.text 도우미가 있다');
if (!T) done('check-text');

// ── 소리 목록(spec 3절) ──
const CONS = ['ㅂ', 'ㅃ', 'ㅍ', 'ㄷ', 'ㄸ', 'ㅌ', 'ㄱ', 'ㄲ', 'ㅋ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅅ', 'ㅆ', 'ㅎ', 'ㅁ', 'ㄴ', 'ㅇ', 'ㄹ'];
const VOWS = ['ㅣ', 'ㅟ', 'ㅡ', 'ㅜ', 'ㅔ', 'ㅚ', 'ㅓ', 'ㅗ', 'ㅐ', 'ㅏ'];
check(CONS.length === 19 && VOWS.length === 10, '소리 목록 29개');

// ── 1. 따라 해 보기 ──
const MAX = 30; // 휴대폰 한 줄에 들어갈 만한 길이(공백 포함 글자 수)
for (const s of [...CONS, ...VOWS]) {
  const line = T.follow[s];
  check(typeof line === 'string' && line.trim().length > 0, `따라 해 보기 있음: /${s}/`);
  if (line) check([...line].length <= MAX, `따라 해 보기 ${MAX}자 이내: /${s}/ (${[...line].length}자)`);
  check(H.follow(s) === line, `G.text.follow(${s})`);
}
check(Object.keys(T.follow).length === 29, '따라 해 보기는 29개 소리만');

// ── 문구 모으기(데이터 칸은 빼고) ──
// 소리 이름표를 값으로 담는 데이터 칸: 빗금 없이 적는 것이 맞으므로 문구 점검에서 뺀다.
const DATA_KEYS = new Set(['sound', 'sounds', 'fleet', 'expect', 'highlight', 'sea', 'level', 'size', 'sunk']);
const strings = []; // [경로, 문구]
(function walk(v, p, parentKey) {
  if (typeof v === 'string') { strings.push([p, v]); return; }
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) {
      if (parentKey === 'example' && DATA_KEYS.has(k)) continue;
      if (DATA_KEYS.has(k) && p.includes('example.shots')) continue;
      walk(v[k], p + '.' + k, k);
    }
  }
})(T, 'TEXT', null);
check(strings.length > 100, `문구 수 ${strings.length}`);

// ── 2. 금지 낱말(문구 + 파일 전체) ──
const FORBIDDEN = ['글자', '훈민정음', '해례', '제자 원리', '제자원리', '상형', '가획', '판옥선', '협선', '척후선', '중세', '조선 수군', '게임오버', '게임 오버'];
const src = fs.readFileSync(path.join(ROOT, FILE), 'utf8');
for (const w of FORBIDDEN) {
  const bad = strings.filter(([, s]) => s.includes(w));
  check(!bad.length, `금지 낱말 '${w}' 없음(문구) ${bad.map((b) => b[0]).join(', ')}`);
  check(!src.includes(w), `금지 낱말 '${w}' 없음(파일)`);
}

// ── 3. 빗금 표기 ──
// 한글 자모(호환 자모 ㄱ-ㆎ, 조합용 자모)가 /x/ 꼴이 아닌 채로 나오면 실패. 완성된 음절(가-힣)은 상관없다.
const JAMO = '\\u3131-\\u318E\\u1100-\\u11FF';
const slashed = new RegExp(`/[${JAMO}]/`, 'g');
const lone = new RegExp(`[${JAMO}]`);
for (const [p, s] of strings) {
  const rest = s.replace(slashed, '');
  check(!lone.test(rest), `빗금 없는 소리 표기: ${p} = ${s}`);
  check(!/\n/.test(s), `문구는 한 줄: ${p}`);
}
check(!lone.test('가/ㄱ/나'.replace(slashed, '')) && lone.test('ㄱ과 /ㅇ/'.replace(slashed, '')), '빗금 점검 자체가 동작');

// ── 4. 학년별 용어 키 ──
const REQ = {
  axis: ['place', 'manner', 'strength', 'height', 'backness', 'lips'],
  place: ['bilabial', 'alveolar', 'palatal', 'velar', 'glottal'],
  manner: ['stop', 'affricate', 'fricative', 'nasal', 'liquid'],
  strength: ['plain', 'tense', 'aspirated', 'none'],
  height: ['high', 'mid', 'low'],
  backness: ['front', 'back'],
  lips: ['unrounded', 'rounded'],
  column: ['front-unrounded', 'front-rounded', 'back-unrounded', 'back-rounded'],
};
for (const table of ['terms', 'shortTerms']) {
  for (const g of ['m3', 'h1']) {
    for (const grp of Object.keys(REQ)) {
      for (const id of REQ[grp]) {
        const v = T[table][g] && T[table][g][grp] && T[table][g][grp][id];
        check(typeof v === 'string' && v.length > 0, `${table}.${g}.${grp}.${id}`);
      }
    }
  }
  const keys = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, Object.keys(o[k]).sort()]));
  check(keys(T[table].m3) === keys(T[table].h1), `${table}: 두 학년의 키가 같다`);
}
// 중3 = 우리말, 고1 = 우리말 + 한자어
const SINO = { bilabial: '양순음', alveolar: '치조음', palatal: '경구개음', velar: '연구개음', glottal: '후음' };
const NATIVE = { bilabial: '입술소리', alveolar: '잇몸소리', palatal: '센입천장소리', velar: '여린입천장소리', glottal: '목청소리' };
for (const id of Object.keys(SINO)) {
  check(H.term('m3', 'place', id) === NATIVE[id], `중3 위치 용어 ${id}`);
  const h = H.term('h1', 'place', id);
  check(h.includes(NATIVE[id]) && h.includes(SINO[id]), `고1 위치 용어 병기 ${id}: ${h}`);
  check(!H.term('m3', 'place', id).includes(SINO[id]), `중3에는 한자어 없음 ${id}`);
}
for (const [id, w] of [['high', '고모음'], ['mid', '중모음'], ['low', '저모음']]) check(H.term('h1', 'height', id).includes(w), `고1 높이 ${id}`);
check(H.term('h1', 'backness', 'front').includes('전설') && H.term('h1', 'backness', 'back').includes('후설'), '고1 전설/후설');
check(H.term('h1', 'lips', 'unrounded').includes('평순') && H.term('h1', 'lips', 'rounded').includes('원순'), '고1 평순/원순');
check(H.term('m3', 'height', 'high').includes('높은') && H.term('m3', 'height', 'mid').includes('중간') && H.term('m3', 'height', 'low').includes('낮은'), '중3 높이 우리말');
for (const g of ['m3', 'h1']) {
  check(H.term(g, 'manner', 'stop') === '파열음' && H.term(g, 'manner', 'liquid') === '유음', `${g} 방법 용어`);
  check(H.term(g, 'strength', 'plain') === '예사소리' && H.term(g, 'strength', 'tense') === '된소리' && H.term(g, 'strength', 'aspirated') === '거센소리', `${g} 세기 용어`);
}

// ── 5. 신호·안내 문구(spec 5.3·5.4, 2절, 6.3) ──
const eq = (a, b, m) => check(a === b, `${m}: '${a}'`);
eq(T.signal.line, '같은 줄에 배가 있어요', '같은 줄');
eq(T.signal.none, '국어에 없는 음운이에요', '없는 소리');
eq(T.signal.notInSea, '이번 바다에는 없는 칸이에요', '이번 바다에 없는 칸');
eq(T.signal.already, '이미 쏜 음운이에요', '이미 쏜 소리');
check(T.signal.hit.includes('명중') && T.signal.miss.includes('빗나감'), '명중·빗나감');
check(JSON.stringify(Object.keys(T.signalName).sort()) === JSON.stringify(['hit', 'line', 'miss', 'none']), '신호 이름은 네 가지');
eq(T.sunk[3], '세 칸 배를 찾았어요', '격침 3'); eq(T.sunk[2], '두 칸 배를 찾았어요', '격침 2'); eq(T.sunk[1], '한 칸 배를 찾았어요', '격침 1');
eq(T.duel.shout, '소리 내어 외치고 발사!', '대결 한 줄');
eq(T.duel.phoneNotice, '대결은 칠판이나 태블릿·노트북의 가로 화면에서 해 주세요', '휴대폰 대결 안내');
eq(T.rotate, '세로로 돌려 주세요', '세로로 돌려');
eq(T.duel.hide.done, '다 놓았어요', '다 놓았어요');
check(T.duel.gate.red.startsWith('홍팀 차례예요') && T.duel.gate.red.includes('청팀은 뒤돌아'), '가림 화면(홍팀)');
check(T.duel.gate.blue.startsWith('청팀 차례예요') && T.duel.gate.blue.includes('홍팀은 뒤돌아'), '가림 화면(청팀)');
eq(T.ui.resume.resume, '하던 판 이어서 하기', '이어서 하기'); eq(T.ui.resume.fresh, '새 판', '새 판');
for (const k of ['practice', 'duel', 'soundmap', 'settings']) check(!!T.ui.menu[k], `시작 메뉴 ${k}`);
for (const k of ['grade', 'sea', 'level', 'hideTime', 'example']) check(!!T.ui.setup[k], `준비 ${k}`);
for (const k of ['bgm', 'sfx', 'volume', 'reduceMotion', 'clear', 'clearConfirm']) check(!!T.ui.settings[k], `설정 ${k}`);
for (const k of ['soundmap', 'record', 'turns', 'noneShots', 'know', 'question', 'win', 'lose', 'draw']) check(!!T.ui.result[k], `결과 ${k}`);
for (const k of ['log', 'shipsLeft', 'turnsLeft']) check(!!T.ui.play[k], `판 ${k}`);
check(!!T.ui.menu.credits, '만든 사람·출처');

// 배 종류 한 줄
for (const sea of ['consonant', 'vowel']) {
  const L = H.legend(sea);
  check(L.length === 3 && L.every((s) => typeof s === 'string' && s.length), `배 종류 설명 ${sea}`);
}
check(T.ships.legend.consonant[3].includes('세기만 다른') && T.ships.legend.vowel[2].includes('입술 모양만'), '배 종류 설명 내용');

// ── 6. 알아 두기(spec 6.5) ──
eq(T.know['pair-ㄱㅇ'], '/ㄱ/과 /ㅇ/은 막는 자리가 같고 콧길만 달라요', '알아 두기 ㄱ·ㅇ');
check(!!T.know['pair-ㅂㅁ'] && !!T.know['pair-ㄷㄴ'], '알아 두기 짝 셋');
eq(T.know.ng, '/ㅇ/은 음절 끝에서만 나는 음운이에요', '알아 두기 ㅇ');
eq(T.know['oe-wi'], '/ㅚ/·/ㅟ/는 이중 모음으로 발음해도 표준 발음으로 인정돼요', '알아 두기 ㅚ·ㅟ');
eq(T.know['e-ae'], '/ㅔ/·/ㅐ/를 섞어 발음하는 사람이 많지만 표준 발음은 구별해요', '알아 두기 ㅔ·ㅐ');
const J = JSON.stringify;
// 짝 소리: 하나면 그 짝의 줄, 둘 이상이면 한 줄로 묶음(다른 항목은 그대로, 순서 유지)
eq(J(H.knowLines([{ id: 'pair-ㄱㅇ', sounds: ['ㄱ', 'ㅇ'] }, { id: 'ng', sounds: ['ㅇ'] }])), J([T.know['pair-ㄱㅇ'], T.know.ng]), '짝 하나는 그 줄 그대로');
eq(J(H.knowLines([{ id: 'pair-ㅂㅁ', sounds: ['ㅂ', 'ㅁ'] }, { id: 'pair-ㄱㅇ', sounds: ['ㄱ', 'ㅇ'] }, { id: 'ng', sounds: ['ㅇ'] }])),
  J(['/ㅂ/·/ㅁ/, /ㄱ/·/ㅇ/은 막는 자리가 같고 콧길만 달라요', T.know.ng]), '짝 둘 이상은 한 줄');
eq(J(H.knowLines([])), '[]', '알아 두기 없음');

// ── 7. 디브리핑 질문 ──
for (const g of ['m3', 'h1']) for (const sea of ['consonant', 'vowel']) {
  const q = H.debrief(g, sea);
  check(Array.isArray(q) && q.length >= 3, `디브리핑 ${g}×${sea} 3개 이상 (${q && q.length})`);
  check(new Set(q).size === q.length, `디브리핑 ${g}×${sea} 겹침 없음`);
  check(q.includes(H.pickDebrief(g, sea, 7)), `pickDebrief ${g}×${sea}`);
}

// ── 8. 풀이 예시: 세 발, 세 줄 이내, 규칙대로 ──
const ex = T.example;
check(ex.sea === 'consonant' && ex.level === 1, '예시는 자음 1단계');
check(ex.shots.length === 3, '예시는 정확히 세 발');
for (const g of ['m3', 'h1']) {
  const lines = ex.shots.map((s) => s.line && s.line[g]).filter(Boolean);
  check(lines.length === 3 && lines.length <= 3, `예시 줄 수 ${g}: ${lines.length}`);
  check(lines.every((l) => [...l].length <= MAX), `예시 줄 ${MAX}자 이내 ${g}`);
  check(H.exampleLine(g, 0) === ex.shots[0].line[g], `exampleLine ${g}`);
}
// 자음 1단계 판(spec 3.1, 4.1)을 여기서 따로 적어 신호를 손으로 계산한다(규칙 엔진과 독립).
const C = { // 소리: [위치, 방법]
  'ㅂ': ['bilabial', 'stop'], 'ㄷ': ['alveolar', 'stop'], 'ㄱ': ['velar', 'stop'], 'ㅈ': ['palatal', 'affricate'],
  'ㅅ': ['alveolar', 'fricative'], 'ㅁ': ['bilabial', 'nasal'], 'ㄴ': ['alveolar', 'nasal'], 'ㅇ': ['velar', 'nasal'], 'ㄹ': ['alveolar', 'liquid'],
};
const OPEN1 = Object.keys(C);
const SHIPS = { 2: [['ㅂ', 'ㅁ'], ['ㄷ', 'ㄴ'], ['ㄱ', 'ㅇ']], 1: [['ㅁ'], ['ㄴ'], ['ㅇ'], ['ㄹ']] }; // 1단계에 허용된 묶음
const key = (a) => [...a].sort().join('');
// 함대: 두 칸 1 + 한 칸 2, 허용 묶음, 열린 칸 안, 겹침 없음, 큰 배부터
const sizes = ex.fleet.map((f) => f.size);
check(JSON.stringify(sizes) === '[2,1,1]', `예시 함대 구성·순서 ${sizes}`);
for (const f of ex.fleet) {
  check(f.sounds.length === f.size, `배 크기 ${f.sounds}`);
  check((SHIPS[f.size] || []).some((b) => key(b) === key(f.sounds)), `허용 묶음 ${f.sounds}`);
  check(f.sounds.every((s) => OPEN1.includes(s)), `열린 칸 안 ${f.sounds}`);
}
const all = ex.fleet.flatMap((f) => f.sounds);
check(new Set(all).size === all.length, '배끼리 겹치지 않음');
// spec 5.4 신호(자음 1단계: 세기 차이 소리는 판에 없으므로 '같은 칸'은 생기지 않음)
const hitSet = new Set();
for (const [i, shot] of ex.shots.entries()) {
  const s = shot.sound;
  check(OPEN1.includes(s), `예시 ${i + 1}발 /${s}/는 열린 칸`);
  const U = all.filter((x) => !hitSet.has(x));
  let sig, hl = null, sunk = null;
  if (U.includes(s)) {
    sig = 'hit'; hitSet.add(s);
    const ship = ex.fleet.find((f) => f.sounds.includes(s));
    if (ship.sounds.every((x) => hitSet.has(x))) sunk = ship.size;
  } else {
    const col = U.some((u) => C[u][0] === C[s][0]);
    const row = U.some((u) => C[u][1] === C[s][1]);
    if (col || row) { sig = 'line'; hl = {}; if (col) hl.place = C[s][0]; if (row) hl.manner = C[s][1]; } else sig = 'miss';
  }
  check(sig === shot.expect, `예시 ${i + 1}발 /${s}/ 신호 ${sig} = 적어 둔 ${shot.expect}`);
  if (sig === 'line') check(JSON.stringify(hl) === JSON.stringify(shot.highlight), `예시 ${i + 1}발 강조 ${JSON.stringify(hl)}`);
  check((sunk || null) === (shot.sunk || null), `예시 ${i + 1}발 격침 ${sunk} = 적어 둔 ${shot.sunk}`);
}
check(new Set(ex.shots.map((s) => s.sound)).size === 3, '예시의 세 발은 서로 다른 소리');

// ── 9. 도우미 ──
check(H.sound('ㄱ') === '/ㄱ/', 'G.text.sound');
check(H.term('h1', 'place', 'velar') === '여린입천장소리·연구개음', 'G.text.term');
check(H.short('m3', 'manner', 'stop') === '파열', 'G.text.short');
check(H.term('x', 'place', 'velar') === '여린입천장소리', '모르는 학년은 중3');
check(H.fill('{n}턴', { n: 8 }) === '8턴', 'G.text.fill');
check(H.sunk(2) === T.sunk[2] && H.signal('already') === T.signal.already && H.know('ng') === T.know.ng, '도우미 꺼내기');

done('check-text');
