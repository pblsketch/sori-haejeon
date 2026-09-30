// 저장 점검(브라우저 없이) — plan T8, spec 6.1·6.3·6.4·6.5·9.
//   node tests/check-save.mjs
// 저장소를 흉내 낸 객체를 넣어 G.save를 확인한다: 설정 기본값과 적용, 마지막 선택, 진행 판 저장 → 복원,
// 망가진 값·다른 버전·끝난 판 버리기, 배치 중인 판은 배치를 저장하지 않음, 누적 소리 지도에 한 판 한 번만,
// 기록 지우기가 정해진 항목만 지우는지, 저장소가 막혀도 오류 없이 도는지(console.error 0).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadScripts, check, done, ROOT } from './lib/load.mjs';

const BASE_FILES = ['js/core/util.js', 'js/data/sounds.js', 'js/data/fleets.js', 'js/data/levels.js', 'js/core/rules.js'];
const SAVE_FILE = 'js/core/save.js';
const PREFIX = 'sori-haejeon:';
const J = (x) => JSON.stringify(x);
const eq = (a, b, msg) => check(J(a) === J(b), `${msg}: ${J(a)} ≠ ${J(b)}`);
const sortS = (a) => [...a].sort();

// ── 흉내 낸 저장소 ───────────────────────────────────────────
function makeStorage(opts = {}) {
  const m = new Map();
  const fail = (op) => { if (opts.throwAll || (opts.throwOn && opts.throwOn.includes(op))) { const e = new Error('SecurityError(흉내)'); e.name = 'SecurityError'; throw e; } };
  return {
    _m: m,
    getItem(k) { fail('get'); return m.has(String(k)) ? m.get(String(k)) : null; },
    setItem(k, v) { fail('set'); m.set(String(k), String(v)); },
    removeItem(k) { fail('remove'); m.delete(String(k)); },
    clear() { fail('clear'); m.clear(); },
    key(i) { fail('key'); return [...m.keys()][i] ?? null; },
    get length() { return m.size; },
  };
}

// ── 게임 불러오기(console.error를 모은다) ─────────────────────
// how: 'normal'(extra.localStorage = storage) | 'getter-throws'(localStorage에 닿기만 해도 오류)
function boot(storage, { how = 'normal', audio = true, doc = true } = {}) {
  const errors = [];
  const cons = { ...console, error: (...a) => errors.push(a.map(String).join(' ')), warn: () => {}, log: console.log };
  const cls = new Set();
  const classList = {
    add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c),
    toggle: (c, on) => { const v = on === undefined ? !cls.has(c) : !!on; if (v) cls.add(c); else cls.delete(c); return v; },
  };
  const extra = { console: cons };
  if (doc) extra.document = { documentElement: { classList } };
  if (how === 'normal') extra.localStorage = storage;
  let ctx;
  try {
    ctx = loadScripts(BASE_FILES, extra);
  } catch (e) {
    check(false, '바탕 스크립트 불러오기 실패: ' + e.message);
    done('저장 점검');
  }
  // 게임 안쪽(window)에서 정의해야 window.localStorage에 닿을 때 예외가 난다
  if (how === 'getter-throws') vm.runInContext("Object.defineProperty(window, 'localStorage', { get() { throw new Error('SecurityError(흉내 getter)'); }, configurable: true });", ctx);
  const calls = [];
  if (audio) ctx.G.audio = { configure: (o) => { calls.push(JSON.parse(J(o))); return o; } };
  let loadErr = null;
  try {
    vm.runInContext(fs.readFileSync(path.join(ROOT, SAVE_FILE), 'utf8'), ctx, { filename: SAVE_FILE });
  } catch (e) { loadErr = e; }
  return { ctx, S: ctx.G && ctx.G.save, R: ctx.G.rules, errors, cls, calls, loadErr };
}

// 첫 불러오기: save.js가 없거나 G.save가 없으면 여기서 멈춘다(RED)
{
  const b = boot(makeStorage());
  if (b.loadErr || !b.S) {
    check(false, 'js/core/save.js를 불러오지 못함 또는 G.save 없음: ' + (b.loadErr ? b.loadErr.message : 'G.save undefined'));
    done('저장 점검');
  }
  const need = ['getSettings', 'setSettings', 'applySettings', 'getSelection', 'setSelection', 'soundMap', 'addRecord',
    'seenExample', 'setSeenExample', 'saveGame', 'loadGame', 'hasGame', 'clearGame', 'clearRecords', 'newGameId', 'storageOk', 'mapGames'];
  for (const n of need) check(typeof b.S[n] === 'function', 'G.save.' + n + ' 함수');
}

// 판 만들기 도우미
const DEF_SETTINGS = { bgmOn: true, bgmVolume: 0.6, sfxOn: true, sfxVolume: 0.8, reduceMotion: false };
function practiceGame(R, sea = 'consonant', lvl = 3, seed = 11, nShots = 3) {
  let g = R.newGame({ mode: 'practice', grade: 'h1', sea, level: lvl, rng: R.makeRng(seed) });
  const targets = g.teams.enemy.fleet.flatMap((s) => s.sounds);
  const miss = (sea === 'consonant' ? ['ㅎ', 'ㄹ', 'ㅁ', 'ㄴ', 'ㅇ', 'ㅅ', 'ㅆ'] : ['ㅣ', 'ㅡ', 'ㅜ', 'ㅔ', 'ㅓ', 'ㅗ', 'ㅐ', 'ㅏ', 'ㅟ', 'ㅚ']).filter((id) => !targets.includes(id));
  const plan = [targets[0], miss[0], targets[1]].slice(0, nShots);
  for (const id of plan) g = R.fire(g, R.inputOf(id)).state;
  return g;
}
function duelGame(R, seed = 5) {
  let g = R.newGame({ mode: 'duel', grade: 'm3', sea: 'consonant', level: 3, rng: R.makeRng(seed) });
  const redSounds = g.teams.red.fleet.flatMap((s) => s.sounds);
  const blueSounds = g.teams.blue.fleet.flatMap((s) => s.sounds);
  const blueTarget = redSounds[0];
  const redTarget = blueSounds.find((id) => id !== blueTarget);
  // 한 라운드: 청팀은 홍팀 바다에, 홍팀은 청팀 바다에 동시에 명중
  g = R.fireRound(g, { blue: R.inputOf(blueTarget), red: R.inputOf(redTarget) }).state;
  return { g, blueTarget, redTarget };
}
const keysOf = (st) => [...st._m.keys()].sort();

// ───────────────────────── 1. 설정(spec 6.1) ─────────────────────────
{
  const st = makeStorage();
  const b = boot(st);
  eq(b.S.getSettings(), DEF_SETTINGS, '설정 기본값');
  b.S.setSettings({ bgmVolume: 0.3, reduceMotion: true });
  eq(b.S.getSettings(), { ...DEF_SETTINGS, bgmVolume: 0.3, reduceMotion: true }, '설정 바꾸기(준 것만)');
  // 다시 열기(같은 저장소)
  const b2 = boot(st);
  eq(b2.S.getSettings(), { ...DEF_SETTINGS, bgmVolume: 0.3, reduceMotion: true }, '설정이 다시 열어도 남음');
  // 이상한 값: 음량은 0~1로 자르고, 형식이 틀린 값은 무시
  b2.S.setSettings({ sfxVolume: 5, bgmVolume: 'x', bgmOn: 'yes', sfxOn: false });
  const s2 = b2.S.getSettings();
  check(s2.sfxVolume === 1, '음량 1보다 크면 1로: ' + s2.sfxVolume);
  check(s2.bgmVolume === 0.3, '숫자가 아닌 음량은 무시: ' + s2.bgmVolume);
  check(s2.bgmOn === true, '참/거짓이 아닌 켜기 값은 무시');
  check(s2.sfxOn === false, '효과음 끄기 저장');
  b2.S.setSettings({ bgmVolume: -2 });
  check(b2.S.getSettings().bgmVolume === 0, '음량 0보다 작으면 0으로');
  // 망가진 설정 → 기본값
  st.setItem(PREFIX + 'settings', '{망가짐');
  eq(boot(st).S.getSettings(), DEF_SETTINGS, '망가진 설정 값 → 기본값');
  st.setItem(PREFIX + 'settings', J({ s: 999, bgmOn: false }));
  eq(boot(st).S.getSettings(), DEF_SETTINGS, '다른 형식 버전의 설정 → 기본값');
  // getSettings가 돌려준 객체를 고쳐도 저장된 값은 그대로
  const b3 = boot(makeStorage());
  const tmp = b3.S.getSettings(); tmp.bgmOn = false;
  check(b3.S.getSettings().bgmOn === true, 'getSettings는 복사본을 돌려준다');
}

// ───────────────────────── 2. 설정 적용(소리 엔진·움직임 줄이기) ─────────────────────────
{
  const st = makeStorage();
  const b = boot(st);
  b.S.applySettings();
  const last = b.calls[b.calls.length - 1];
  eq(last, { bgmOn: true, bgmVolume: 0.6, sfxOn: true, sfxVolume: 0.8 }, 'applySettings → G.audio.configure(소리 설정 네 값)');
  check(!b.cls.has('reduce-motion'), '움직임 줄이기 꺼짐 → reduce-motion 클래스 없음');
  b.S.setSettings({ reduceMotion: true, sfxOn: false });
  check(b.cls.has('reduce-motion'), 'setSettings가 바로 적용: reduce-motion 클래스 붙음');
  eq(b.calls[b.calls.length - 1], { bgmOn: true, bgmVolume: 0.6, sfxOn: false, sfxVolume: 0.8 }, 'setSettings가 바로 소리 엔진에 적용');
  b.S.setSettings({ reduceMotion: false });
  check(!b.cls.has('reduce-motion'), '움직임 줄이기 끄면 클래스 떨어짐');
  // G.audio도 document도 없어도 오류 없이
  const b2 = boot(makeStorage(), { audio: false, doc: false });
  let ok = true;
  try { b2.S.applySettings(); b2.S.setSettings({ reduceMotion: true }); } catch (e) { ok = false; }
  check(ok, 'G.audio·document 없이 applySettings 오류 없음');
  check(b2.errors.length === 0, 'G.audio·document 없을 때 console.error 0');
}

// ───────────────────────── 3. 마지막 선택(spec 6.1) ─────────────────────────
{
  const st = makeStorage();
  const b = boot(st);
  eq(b.S.getSelection(), { grade: 'm3', sea: 'consonant', level: 1, hideTime: false }, '마지막 선택 기본값');
  b.S.setSelection({ grade: 'h1', sea: 'vowel', level: 2, hideTime: true });
  eq(boot(st).S.getSelection(), { grade: 'h1', sea: 'vowel', level: 2, hideTime: true }, '마지막 선택이 다시 열어도 남음');
  b.S.setSelection({ sea: 'consonant' });
  eq(b.S.getSelection(), { grade: 'h1', sea: 'consonant', level: 2, hideTime: true }, '선택 일부만 바꾸기');
  b.S.setSelection({ sea: 'vowel', level: 3 }); // 모음 바다에는 3단계가 없다
  check(b.S.getSelection().level === 1, '바다에 없는 단계 → 1단계: ' + b.S.getSelection().level);
  b.S.setSelection({ grade: 'm9', sea: 'air', hideTime: 'yes' });
  const sel = b.S.getSelection();
  check(sel.grade === 'h1' && sel.sea === 'vowel' && sel.hideTime === true, '모르는 학년·바다·숨기기 값은 무시: ' + J(sel));
  st.setItem(PREFIX + 'selection', 'null');
  eq(boot(st).S.getSelection(), { grade: 'm3', sea: 'consonant', level: 1, hideTime: false }, '망가진 선택 → 기본값');
}

// ───────────────────────── 4. 진행 판 저장 → 복원(spec 6.4) ─────────────────────────
{
  const st = makeStorage();
  const b = boot(st);
  const R = b.R;
  check(b.S.loadGame() === null && b.S.hasGame() === false, '처음에는 진행 판 없음');
  // 매 발 저장
  let g = R.newGame({ mode: 'practice', grade: 'h1', sea: 'consonant', level: 3, rng: R.makeRng(11) });
  g.id = b.S.newGameId();
  b.S.saveGame(g);
  const ids = g.teams.enemy.fleet.flatMap((s) => s.sounds);
  for (const id of [ids[0], 'ㅎ', ids[1]]) { g = R.fire(g, R.inputOf(id)).state; b.S.saveGame(g); }
  check(b.S.hasGame(), '저장 뒤 hasGame 참');
  const b2 = boot(st); // 새로고침
  const back = b2.S.loadGame();
  eq(back, JSON.parse(J(g)), '연습 판: 저장 → 다시 열어 복원하면 같은 판 상태(마지막 발까지)');
  check(back && back.id === g.id, '판 id도 함께 복원');
  check(back && back.teams.player.shots.length === 3, '쏜 기록 3발 복원');
  // 복원한 판으로 계속 쏠 수 있다
  let cont = null;
  try { cont = b2.R.fire(back, b2.R.inputOf(ids[2])); } catch (e) { cont = null; }
  check(cont && cont.state.teams.player.shots.length === 4, '복원한 판에서 이어서 쏘기');
  // 대결 판
  const { g: dg } = duelGame(R);
  b.S.saveGame(dg);
  eq(boot(st).S.loadGame(), JSON.parse(J(dg)), '대결 판: 저장 → 복원 같음');
  check(boot(st).S.loadGame().rounds === 1, '대결 판: 라운드 수도 복원');
  // 라운드 모양 확인: 두 팀 쏜 수가 다르면(번갈아 쏘던 옛 판) 이어 할 수 없음, rounds가 없으면 쏜 수로 채움
  {
    const odd = JSON.parse(J(dg)); odd.teams.red.shots.pop(); delete odd.rounds;
    const envOdd = { s: 1, savedAt: 1, state: odd };
    const stO = makeStorage(); stO._m.set('sori-haejeon:game', J(envOdd));
    check(boot(stO).S.loadGame() === null, '대결: 두 팀 쏜 수가 다른 판은 버림');
    const bad = JSON.parse(J(dg)); bad.rounds = 3;
    const stB = makeStorage(); stB._m.set('sori-haejeon:game', J({ s: 1, savedAt: 1, state: bad }));
    check(boot(stB).S.loadGame() === null, '대결: rounds가 쏜 수와 다른 판은 버림');
    const old = JSON.parse(J(dg)); delete old.rounds;
    const stL = makeStorage(); stL._m.set('sori-haejeon:game', J({ s: 1, savedAt: 1, state: old }));
    const back2 = boot(stL).S.loadGame();
    check(back2 && back2.rounds === 1, 'rounds가 없는 옛 대결 판은 쏜 수로 채워 복원');
    let cont2 = null;
    try { cont2 = R.fireRound(back2, { blue: R.inputOf(back2.teams.red.fleet[1].sounds[0]), red: R.inputOf(['ㅎ', 'ㄹ'].find((x) => !back2.teams.red.shots.some((s) => s.sound === x))) }); } catch (e) { cont2 = null; }
    check(cont2 && cont2.state.rounds === 2, '복원한 대결 판에서 다음 라운드');
  }
  // 진행 판은 기기당 하나: 새 판 저장이 옛 판을 덮는다
  const g2 = R.newGame({ mode: 'practice', grade: 'm3', sea: 'vowel', level: 1, rng: R.makeRng(3) });
  b.S.saveGame(g2);
  eq(boot(st).S.loadGame(), JSON.parse(J(g2)), '새 판을 저장하면 옛 진행 판은 버려짐');
  check(keysOf(st).filter((k) => k.includes('game')).length === 1, '진행 판 저장 항목은 하나');
  // saveGame에 준 판을 뒤에 고쳐도 저장된 값은 그대로
  const snap = J(g2); g2.teams.player.shots.push({ bogus: true });
  eq(b.S.loadGame(), JSON.parse(snap), '저장은 그때의 복사본');
  // 지우기
  b.S.clearGame();
  check(b.S.loadGame() === null && !b.S.hasGame(), 'clearGame 뒤 진행 판 없음');
  check(boot(st).S.loadGame() === null, 'clearGame 뒤 다시 열어도 없음');
}

// ───────────────────────── 5. 망가진 값·다른 버전·끝난 판은 버린다 ─────────────────────────
{
  const st = makeStorage();
  const b = boot(st);
  const R = b.R;
  const good = practiceGame(R);
  b.S.saveGame(good);
  const key = keysOf(st).find((k) => k.includes('game'));
  check(key && key.startsWith(PREFIX), '진행 판 저장 이름에 접두사: ' + key);
  const raw = st.getItem(key);
  const envelope = JSON.parse(raw);
  const tryRaw = (text, msg) => {
    st.setItem(key, text);
    const bb = boot(st);
    check(bb.S.loadGame() === null, msg + ' → null');
    check(bb.S.hasGame() === false, msg + ' → hasGame 거짓');
    check(st.getItem(key) === null, msg + ' → 저장소에서도 지움');
    check(bb.errors.length === 0, msg + ' → console.error 0');
  };
  tryRaw('{"s":1,"state":', '망가진 JSON');
  tryRaw('"문자열"', 'JSON이지만 객체가 아님');
  tryRaw(J({ ...envelope, s: envelope.s + 1 }), '다른 저장 형식 버전');
  tryRaw(J({ ...envelope, state: { ...envelope.state, v: 2 } }), '다른 판 형식 버전(v: 2)');
  tryRaw(J({ ...envelope, state: { ...envelope.state, v: undefined } }), '판 형식 버전 없음');
  tryRaw(J({ ...envelope, state: { ...envelope.state, phase: 'over', result: { success: true } } }), '끝난 판(phase over)');
  tryRaw(J({ ...envelope, state: { ...envelope.state, phase: 'dancing' } }), '모르는 phase');
  tryRaw(J({ ...envelope, state: { ...envelope.state, teams: null } }), 'teams 없음');
  tryRaw(J({ ...envelope, state: { ...envelope.state, teams: { player: { fleet: [], shots: [] } } } }), '연습 판에 enemy 없음');
  tryRaw(J({ ...envelope, state: { ...envelope.state, teams: { player: { fleet: [], shots: 'x' }, enemy: envelope.state.teams.enemy } } }), 'shots가 배열이 아님');
  tryRaw(J({ ...envelope, state: { ...envelope.state, level: 9 } }), '없는 단계');
  tryRaw(J({ ...envelope, state: { ...envelope.state, sea: 'air' } }), '없는 바다');
  tryRaw(J({ ...envelope, state: { ...envelope.state, mode: 'solo' } }), '모르는 모드');
  // 끝난 판을 saveGame에 주면 진행 판을 지운다(결과는 누적 지도로만 남음)
  b.S.saveGame(good);
  let over = good;
  const seaIds = over.teams.enemy.fleet.flatMap((s) => s.sounds);
  for (const id of seaIds) { if (over.phase !== 'playing') break; const r = R.fire(over, R.inputOf(id)); over = r.state; }
  check(over.phase === 'over', '(준비) 모든 배를 찾아 판이 끝남');
  b.S.saveGame(over);
  check(b.S.loadGame() === null && boot(st).S.loadGame() === null, '끝난 판을 저장하려 하면 진행 판이 지워짐');
  // 망가진 진행 판이 있어도 다른 저장 값은 멀쩡
  const st2 = makeStorage();
  const c = boot(st2);
  c.S.setSettings({ bgmOn: false });
  st2.setItem(PREFIX + 'game', '%%%');
  const c2 = boot(st2);
  check(c2.S.loadGame() === null && c2.S.getSettings().bgmOn === false, '망가진 진행 판은 설정에 영향 없음');
}

// ───────────────────────── 6. 숨기기 시간 배치 중(spec 6.3) ─────────────────────────
{
  const st = makeStorage();
  const b = boot(st);
  const R = b.R;
  const old = practiceGame(R);
  b.S.saveGame(old);
  let d = R.newGame({ mode: 'duel', grade: 'm3', sea: 'consonant', level: 3, hideTime: true });
  d.id = b.S.newGameId();
  check(d.phase === 'placing' && d.placingTeam === 'blue', '(준비) 숨기기 시간 판은 청팀 배치부터');
  const first = R.placeableGroups(R.level('consonant', 3), [])[0];
  d = R.placeShip(d, first);
  check(d.teams.blue.fleet.length === 1, '(준비) 청팀이 배 하나를 놓음');
  b.S.saveGame(d);
  const back = boot(st).S.loadGame();
  check(back !== null, '배치 중인 판: 새 판은 남는다(옛 연습 판을 버리고)');
  check(back && back.mode === 'duel' && back.hideTime === true && back.phase === 'placing', '배치 중 새로고침 → 대결·숨기기 시간·배치 단계로 복원');
  check(back && back.placingTeam === 'blue', '배치 중 새로고침 → 청팀부터 다시');
  check(back && back.teams.blue.fleet.length === 0 && back.teams.red.fleet.length === 0, '배치(놓은 배)는 저장하지 않음');
  check(back && back.id === d.id, '배치 중 판도 판 id 유지');
  check(!st.getItem(keysOf(st).find((k) => k.includes('game'))).includes(J(first[0]).slice(1, -1) + '"'), '저장 문자열에 놓은 배의 소리가 없음');
  // 홍팀 배치 중이어도 마찬가지로 청팀부터
  d = R.finishPlacing(d, R.makeRng(1));
  check(d.placingTeam === 'red', '(준비) 홍팀 배치 차례');
  b.S.saveGame(d);
  const back2 = boot(st).S.loadGame();
  check(back2 && back2.placingTeam === 'blue' && back2.teams.blue.fleet.length === 0, '홍팀 배치 중 새로고침 → 청팀부터, 청팀 배도 버림');
  // 배치가 끝나 대결이 시작되면 보통대로 저장
  d = R.finishPlacing(d, R.makeRng(2));
  check(d.phase === 'playing', '(준비) 배치 끝 → 대결 시작');
  b.S.saveGame(d);
  eq(boot(st).S.loadGame(), JSON.parse(J(d)), '배치가 끝난 대결 판은 함대까지 저장');
}

// ───────────────────────── 7. 누적 소리 지도(spec 6.5) ─────────────────────────
{
  const st = makeStorage();
  const b = boot(st);
  const R = b.R;
  eq(b.S.soundMap('consonant'), [], '처음 자음 누적 지도 빈 목록');
  eq(b.S.soundMap('vowel'), [], '처음 모음 누적 지도 빈 목록');
  const g = practiceGame(R);
  const rec = R.makeRecord(g);
  check(rec.hitSoundsAll.length === 2, '(준비) 연습 판에서 두 소리 명중');
  check(b.S.addRecord(rec) === true, '첫 addRecord → 참');
  eq(sortS(b.S.soundMap('consonant')), sortS(rec.hitSoundsAll), '누적 지도 = 이번 판 맞힌 소리');
  check(b.S.addRecord(rec) === false, '같은 판 기록을 다시 더하면 거짓');
  check(b.S.addRecord(JSON.parse(J(rec))) === false, '같은 내용의 복사본도 다시 더하지 않음(결과 화면 새로고침)');
  check(boot(st).S.addRecord(rec) === false, '다시 열어도 같은 판은 더하지 않음');
  check(b.S.mapGames('consonant') === 1, '자음 바다 더한 판 수 1: ' + b.S.mapGames('consonant'));
  eq(b.S.soundMap('vowel'), [], '자음 판은 모음 지도에 안 더함');
  // 판 id로 구분: 같은 id면 내용이 달라도 한 번만
  const g2 = practiceGame(R, 'consonant', 3, 99);
  const rec2 = R.makeRecord(g2);
  check(b.S.addRecord(rec2, 'game-A') === true, 'id 있는 새 판 더함');
  check(b.S.addRecord(rec2, 'game-A') === false, '같은 id는 한 번만');
  const mapBefore = sortS(b.S.soundMap('consonant'));
  const other = ['ㅃ', 'ㄸ', 'ㅉ', 'ㅆ', 'ㄲ'].find((id) => !mapBefore.includes(id));
  check(b.S.addRecord({ ...rec2, hitSoundsAll: [other] }, 'game-A') === false, '같은 id면 내용이 달라도 한 번만');
  eq(sortS(b.S.soundMap('consonant')), mapBefore, '거절된 기록의 소리는 안 들어감');
  const recId = { ...R.makeRecord(practiceGame(R, 'consonant', 3, 123)), id: 'game-B' };
  check(b.S.addRecord(recId) === true && b.S.addRecord(recId) === false, '기록에 id 필드가 있으면 그것으로 한 번만');
  const union = new Set([...rec.hitSoundsAll, ...rec2.hitSoundsAll, ...recId.hitSoundsAll]);
  eq(sortS(b.S.soundMap('consonant')), sortS([...union]), '누적 지도 = 판들의 합집합(중복 없음)');
  check(b.S.mapGames('consonant') === 3, '자음 바다 더한 판 수 3');
  // 모음 바다는 따로
  const vg = practiceGame(R, 'vowel', 2, 7);
  const vrec = R.makeRecord(vg);
  check(vrec.hitSoundsAll.length > 0, '(준비) 모음 판 명중 있음');
  b.S.addRecord(vrec);
  eq(sortS(b.S.soundMap('vowel')), sortS(vrec.hitSoundsAll), '모음 누적 지도 따로');
  eq(sortS(boot(st).S.soundMap('consonant')), sortS([...union]), '누적 지도는 다시 열어도 남음');
  // 대결: 두 팀 합침(hitSoundsAll)
  const st2 = makeStorage();
  const c = boot(st2);
  const { g: dg, blueTarget, redTarget } = duelGame(c.R);
  const drec = c.R.makeRecord(dg);
  check(blueTarget !== redTarget, '(준비) 두 팀이 서로 다른 소리를 맞힘');
  c.S.addRecord(drec);
  const map = c.S.soundMap('consonant');
  check(map.includes(blueTarget) && map.includes(redTarget), '대결 기록: 청팀·홍팀이 맞힌 소리 모두 더함: ' + J(map));
  eq(sortS(map), sortS(drec.hitSoundsAll), '대결 기록 = hitSoundsAll(두 팀 합침)');
  // 망가진 기록은 무시
  let ok = true;
  try { c.S.addRecord(null); c.S.addRecord({}); c.S.addRecord({ sea: 'air', hitSoundsAll: ['ㄱ'] }); c.S.addRecord({ sea: 'vowel', hitSoundsAll: ['ㄱ', 'zz', 'ㅏ'] }); } catch (e) { ok = false; }
  check(ok, '망가진 기록에 오류 없음');
  eq(c.S.soundMap('vowel'), ['ㅏ'], '다른 바다의 소리·모르는 소리는 지도에 안 들어감');
  eq(c.S.soundMap('air'), [], '모르는 바다 지도는 빈 목록');
  // 돌려받은 지도를 고쳐도 저장값은 그대로
  const mm = c.S.soundMap('consonant'); mm.push('ㅎ');
  check(!c.S.soundMap('consonant').includes('ㅎ') || drec.hitSoundsAll.includes('ㅎ'), 'soundMap은 복사본');
  // 망가진 지도 값 → 빈 지도
  const mk = keysOf(st2).find((k) => k.includes('soundmap'));
  check(mk && mk.startsWith(PREFIX), '누적 지도 저장 이름에 접두사');
  st2.setItem(mk, '[[[');
  const c3 = boot(st2);
  eq(c3.S.soundMap('consonant'), [], '망가진 누적 지도 → 빈 지도');
  check(c3.S.addRecord(R.makeRecord(practiceGame(c3.R, 'consonant', 3, 5))) === true, '망가진 지도 뒤에도 더하기 동작');
}

// ───────────────────────── 8. 풀이 예시를 본 적 있는지 ─────────────────────────
{
  const st = makeStorage();
  const b = boot(st);
  check(b.S.seenExample() === false, '풀이 예시 기본: 안 봄');
  b.S.setSeenExample();
  check(b.S.seenExample() === true, 'setSeenExample() → 봄');
  check(boot(st).S.seenExample() === true, '다시 열어도 봄');
  b.S.setSeenExample(false);
  check(boot(st).S.seenExample() === false, 'setSeenExample(false) → 안 봄');
}

// ───────────────────────── 9. 기록 지우기(spec 6.1) ─────────────────────────
{
  const st = makeStorage();
  st.setItem('다른-앱:값', '그대로');
  const b = boot(st);
  const R = b.R;
  b.S.setSettings({ bgmVolume: 0.25, reduceMotion: true });
  b.S.setSelection({ grade: 'h1', sea: 'vowel', level: 2, hideTime: true });
  b.S.addRecord(R.makeRecord(practiceGame(R)));
  b.S.addRecord(R.makeRecord(practiceGame(R, 'vowel', 2, 7)));
  b.S.setSeenExample(true);
  b.S.saveGame(practiceGame(R, 'consonant', 3, 8));
  const before = keysOf(st);
  check(before.filter((k) => k.startsWith(PREFIX)).length >= 5, '(준비) 저장 항목 여러 개: ' + J(before));
  b.S.clearRecords();
  check(b.S.soundMap('consonant').length === 0 && b.S.soundMap('vowel').length === 0, '기록 지우기 → 누적 지도(자음·모음) 빔');
  check(b.S.mapGames('consonant') === 0, '기록 지우기 → 더한 판 수 0');
  check(b.S.seenExample() === false, '기록 지우기 → 풀이 예시 본 기록 지움');
  check(b.S.loadGame() === null, '기록 지우기 → 진행 판 지움');
  eq(b.S.getSettings(), { ...DEF_SETTINGS, bgmVolume: 0.25, reduceMotion: true }, '기록 지우기 → 설정은 그대로');
  eq(b.S.getSelection(), { grade: 'h1', sea: 'vowel', level: 2, hideTime: true }, '기록 지우기 → 마지막 선택은 그대로');
  eq(keysOf(st), sortS([PREFIX + 'settings', PREFIX + 'selection', '다른-앱:값']), '저장소에 남은 항목 = 설정·마지막 선택·다른 앱 값');
  check(st.getItem('다른-앱:값') === '그대로', '다른 앱의 값은 건드리지 않음');
  const b2 = boot(st);
  check(b2.S.soundMap('consonant').length === 0 && b2.S.seenExample() === false && b2.S.loadGame() === null, '다시 열어도 지워진 상태');
  // 지운 뒤 같은 판 기록을 다시 더하면 다시 들어간다(기록을 지웠으므로 새 출발)
  const rec = R.makeRecord(practiceGame(R));
  check(b2.S.addRecord(rec) === true, '기록 지우기 뒤에는 같은 기록도 새로 더함');
}

// ───────────────────────── 10. 저장소가 막힌 환경(spec 9) ─────────────────────────
function blockedSuite(label, b, st) {
  const R = b.R;
  let ok = true, msg = '';
  try {
    check(b.S.storageOk() === false, label + ': storageOk 거짓');
    eq(b.S.getSettings(), DEF_SETTINGS, label + ': 설정 기본값');
    b.S.setSettings({ sfxVolume: 0.2, reduceMotion: true });
    check(b.S.getSettings().sfxVolume === 0.2, label + ': 설정은 이번 세션 동안 기억');
    check(b.cls.has('reduce-motion'), label + ': 움직임 줄이기 적용');
    check(b.calls.length > 0 && b.calls[b.calls.length - 1].sfxVolume === 0.2, label + ': 소리 엔진에 적용');
    b.S.setSelection({ sea: 'vowel', level: 2 });
    check(b.S.getSelection().sea === 'vowel', label + ': 선택은 이번 세션 동안 기억');
    const g = practiceGame(R);
    b.S.saveGame(g);
    eq(b.S.loadGame(), JSON.parse(J(g)), label + ': 진행 판은 이번 세션 동안 기억');
    const rec = R.makeRecord(g);
    check(b.S.addRecord(rec) === true && b.S.addRecord(rec) === false, label + ': 누적 지도 한 번만');
    eq(sortS(b.S.soundMap('consonant')), sortS(rec.hitSoundsAll), label + ': 누적 지도 세션 기억');
    b.S.setSeenExample(true);
    check(b.S.seenExample() === true, label + ': 풀이 예시 본 기록 세션 기억');
    b.S.clearRecords();
    check(b.S.loadGame() === null && b.S.soundMap('consonant').length === 0 && b.S.seenExample() === false, label + ': 기록 지우기');
    check(b.S.getSettings().sfxVolume === 0.2, label + ': 기록 지우기 뒤 설정 남음');
    b.S.clearGame(); b.S.applySettings(); b.S.hasGame();
  } catch (e) { ok = false; msg = e.stack || e.message; }
  check(ok, label + ': 예외 없이 동작 ' + msg);
  check(b.errors.length === 0, label + ': console.error 0 — ' + J(b.errors));
  check((b.ctx.__soriErrors || []).length === 0, label + ': 페이지 오류 모음(__soriErrors) 0');
}
{
  const st = makeStorage({ throwAll: true });
  blockedSuite('저장소 메서드가 모두 예외', boot(st), st);
  blockedSuite('localStorage가 null', boot(null), null);
  const gt = boot(null, { how: 'getter-throws' });
  check(vm.runInContext("(function () { try { window.localStorage; return false; } catch (e) { return true; } })()", gt.ctx), '(준비) 흉내 getter가 실제로 예외를 냄');
  blockedSuite('localStorage에 닿기만 해도 예외', gt, null);
  // 쓰기만 막힘(용량 초과 등): 읽기는 되지만 쓰기가 실패해도 이번 세션 값은 유지
  const st2 = makeStorage();
  const pre = boot(st2); pre.S.setSettings({ bgmVolume: 0.4 });
  const quota = makeStorage({ throwOn: ['set'] });
  for (const [k, v] of st2._m) quota._m.set(k, v);
  const q = boot(quota);
  let ok = true;
  try {
    check(q.S.getSettings().bgmVolume === 0.4, '쓰기 막힘: 저장된 설정은 읽힘');
    q.S.setSettings({ bgmVolume: 0.9 });
    check(q.S.getSettings().bgmVolume === 0.9, '쓰기 막힘: 바꾼 설정은 세션 동안 유지');
    const g = practiceGame(q.R);
    q.S.saveGame(g);
    eq(q.S.loadGame(), JSON.parse(J(g)), '쓰기 막힘: 진행 판 세션 동안 유지');
    q.S.clearGame();
    check(q.S.loadGame() === null, '쓰기 막힘: clearGame');
  } catch (e) { ok = false; }
  check(ok, '쓰기 막힘: 예외 없음');
  check(q.errors.length === 0, '쓰기 막힘: console.error 0');
}

// ───────────────────────── 11. 전체: 정상 흐름에서도 console.error 0, 이름 접두사 ─────────────────────────
{
  const st = makeStorage();
  st.setItem('다른-앱:x', '1');
  const b = boot(st);
  const R = b.R;
  b.S.setSettings({ bgmOn: false }); b.S.setSelection({ level: 2 }); b.S.setSeenExample(true);
  const g = practiceGame(R); b.S.saveGame(g); b.S.addRecord(R.makeRecord(g));
  check(keysOf(st).filter((k) => k !== '다른-앱:x').every((k) => k.startsWith(PREFIX)), '모든 저장 이름이 ' + PREFIX + '로 시작: ' + J(keysOf(st)));
  check(b.S.storageOk() === true, '정상 저장소: storageOk 참');
  const id1 = b.S.newGameId(), id2 = b.S.newGameId();
  check(typeof id1 === 'string' && id1.length >= 8 && id1 !== id2, 'newGameId는 서로 다른 문자열');
  check(b.errors.length === 0 && (b.ctx.__soriErrors || []).length === 0, '정상 흐름 console.error 0');
}

done('저장 점검');
