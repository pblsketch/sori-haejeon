// T20 제품 화면 캡처(점검 아님 — run-all에 들지 않는다). 서버를 먼저 켠다: node server.mjs 8820
//   BASE=http://127.0.0.1:8820/ node shot-board-prod.mjs      → tests/shots/prod-*.png
// 연습 가로·연습 휴대폰·숨긴 2단계·대결 칠판·소리 지도(결과 화면)를 진짜 화면(연습·대결·앱)으로 띄워,
// 정해진 판을 규칙 엔진으로 쏘아 저장한 뒤 '이어서 하기'로 연다.
import { runAside, BASE } from './aside.mjs';

const frame = (w, h, src) => `${BASE}tests/pages/frame.html?w=${w}&h=${h}&src=${encodeURIComponent(src)}`;
// 판 만드는 조각(프레임 안 창 fw에서 돈다)
const L1 = `{ mode: 'practice', grade: 'm3', sea: 'consonant', level: 1, fleet: [{ size: 2, sounds: ['ㄱ', 'ㅇ'] }, { size: 1, sounds: ['ㅁ'] }, { size: 1, sounds: ['ㄹ'] }] }`;
const L1_SHOTS = `['ㅅ', 'ㄱ', { place: 'palatal', manner: 'stop', strength: null }, 'ㅈ', 'ㅇ', 'ㄹ']`;
const L2 = `{ mode: 'practice', grade: 'm3', sea: 'consonant', level: 2, fleet: [{ size: 3, sounds: ['ㅂ', 'ㅃ', 'ㅍ'] }, { size: 2, sounds: ['ㄷ', 'ㄴ'] }, { size: 1, sounds: ['ㅎ'] }] }`;
const L2_SHOTS = `['ㅂ', 'ㄱ', 'ㅃ', { place: 'palatal', manner: 'stop', strength: 'tense' }, 'ㅍ', 'ㅁ', 'ㄴ']`;

const shots = [
  { name: 'prod-practice-1920', w: 1920, h: 1080, src: 'tests/pages/practice.html?manual=1&seen=1&clear=1&w=1920&h=1080', make: L1, fire: L1_SHOTS, open: 'fw.openPractice({ resume: true })' },
  { name: 'prod-practice-phone', w: 390, h: 844, src: 'tests/pages/practice.html?manual=1&seen=1&clear=1&w=390&h=844', make: L1, fire: L1_SHOTS, open: 'fw.openPractice({ resume: true })' },
  { name: 'prod-practice-hidden', w: 1920, h: 1080, src: 'tests/pages/practice.html?manual=1&seen=1&clear=1&w=1920&h=1080', make: L2, fire: L2_SHOTS, open: 'fw.openPractice({ resume: true })' },
  {
    name: 'prod-duel-1920', w: 1920, h: 1080, src: 'tests/pages/duel.html?manual=1&box=1920x1080',
    make: `{ mode: 'duel', grade: 'm3', sea: 'consonant', level: 2, fleets: { blue: [{ size: 3, sounds: ['ㄷ', 'ㄸ', 'ㅌ'] }, { size: 2, sounds: ['ㄱ', 'ㅇ'] }, { size: 1, sounds: ['ㄹ'] }], red: [{ size: 3, sounds: ['ㅈ', 'ㅉ', 'ㅊ'] }, { size: 2, sounds: ['ㅂ', 'ㅁ'] }, { size: 1, sounds: ['ㄴ'] }] } }`,
    duel: `[['blue', 'ㅂ'], ['red', 'ㄱ'], ['blue', 'ㅁ'], ['red', { place: 'palatal', manner: 'stop', strength: 'plain' }], ['blue', 'ㅅ'], ['red', 'ㅇ'], ['blue', 'ㅈ'], ['red', 'ㅎ']]`,
    open: 'fw.G.duel.open({ resume: true })',
  },
  {
    name: 'prod-soundmap-1920', w: 1920, h: 1080, src: 'tests/pages/app.html?reset=1&box=1920x1080',
    make: L1, fire: `['ㅅ', 'ㄱ', 'ㅈ', 'ㅇ', 'ㄹ', 'ㅁ']`, open: 'fw.G.app.finishGame(st)', nosave: true,
  },
];

let bad = 0;
for (const s of shots) {
  const id = s.name.replace(/-/g, '_');
  const build = s.duel
    ? `let st = fw.G.rules.newGame(Object.assign(${s.make}, { rng: fw.G.rules.makeRng(3) }));
       for (const [t, x] of ${s.duel}) st = fw.G.rules.fireTeam(st, t, typeof x === 'string' ? fw.G.rules.inputOf(x) : x).state;`
    : `let st = fw.G.rules.newGame(Object.assign(${s.make}, { rng: fw.G.rules.makeRng(3) }));
       for (const x of ${s.fire}) st = fw.G.rules.fire(st, typeof x === 'string' ? fw.G.rules.inputOf(x) : x).state;`;
  const code = `
const t_${id} = await openTab(${JSON.stringify(frame(s.w, s.h, s.src))});
await t_${id}.evaluate(() => window.frameReady);
await sleep(600);
const i_${id} = await t_${id}.evaluate(async () => {
  const fw = window.frameWin();
  ${build}
  st.id = fw.G.save.newGameId();
  ${s.nosave ? '' : 'fw.G.save.saveGame(st);'}
  fw.G.board.setImageBase('../../assets/img/'); // 점검 페이지는 tests/pages/ 아래(대결 점검 페이지는 그림 폴더를 안 정함)
  ${s.open};
  await new Promise((r) => setTimeout(r, 1500));
  return { s: Math.min(1, innerWidth / ${s.w}, innerHeight / ${s.h}), errs: (fw.__soriErrors || []).slice(0, 5), shots: JSON.stringify(Object.keys(st.teams).map((k) => st.teams[k].shots.length)) };
});
console.log('INFO ' + JSON.stringify(i_${id}));
await fs.mkdir('./artifacts', { recursive: true });
await fs.writeFile('./artifacts/${s.name}.png', await t_${id}.screenshot({ clip: { x: 0, y: 0, width: Math.floor(${s.w} * i_${id}.s), height: Math.floor(${s.h} * i_${id}.s) } }));
console.log('SHOTFILE:' + path.resolve('./artifacts/${s.name}.png'));
await closeTab(t_${id});
console.log(i_${id}.errs.length ? 'FAIL ' + i_${id}.errs.join(' | ') : 'PASS');
`;
  const r = runAside(code, { label: s.name });
  console.log(s.name, r.ok ? 'ok' : 'FAIL', (r.out.match(/INFO .*/) || [''])[0]);
  if (!r.ok) { bad++; console.log(r.out.slice(-800)); }
}
process.exit(bad ? 1 : 0);
