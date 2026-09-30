// 소리 재생 엔진(js/core/audio.js) 점검(aside). 점검용 페이지 tests/pages/audio.html에서 엔진만 불러 본다.
//  1) 소리 파일이 없을 때: 재생·곡 바꾸기·효과음이 오류 없이 조용히 넘어가는지, 설정 값이 state()에 반영되는지
//  2) 점검용 작은 mp3(tests/pages/audio-fixture/)로: 실제 재생·겹쳐 바꾸기·끄면 안 틀기·효과음
//  3) fetch가 안 될 때(file:// 로 연 경우와 같은 길): <audio> 요소로 대신 재생하는지
//     aside는 file:// 주소를 열지 못하므로 점검 페이지의 ?nofetch=1 로 fetch를 막아 흉내 낸다.
import { step, url } from './aside.mjs';

const PAGE = url('tests/pages/audio.html');
const FIX = PAGE + '?base=audio-fixture/';
const NOFETCH = PAGE + '?base=audio-fixture/&nofetch=1';

step('파일이 없어도 조용히, 설정은 state()에 반영', `
const ta = await openTab(${JSON.stringify(PAGE + '?base=no-such-audio/')});
try {
  const a1 = await ta.evaluate(() => {
    const A = G.audio, r = {};
    r.api = ['play', 'stop', 'sfx', 'unlock', 'configure', 'state', 'preload', 'setBgmOn', 'setBgmVolume', 'setSfxOn', 'setSfxVolume', 'setBase']
      .filter((k) => typeof A[k] !== 'function');
    r.playBefore = A.play('practice');
    r.sBefore = A.state();
    return r;
  });
  if (a1.api.length) throw new Error('없는 함수: ' + a1.api.join(','));
  if (a1.sBefore.unlocked || a1.sBefore.playing !== null || a1.sBefore.track !== 'practice') throw new Error('잠금 전 상태 이상: ' + JSON.stringify(a1.sBefore));
  await ta.locator('#tap').click(); // 첫 터치 → 저절로 unlock
  await sleep(900);
  const a2 = await ta.evaluate(async () => {
    const A = G.audio, r = { thrown: null };
    const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
    try {
      r.sUnlocked = A.state();
      A.play('duel'); await wait(200);
      A.play('result'); A.play('practice'); A.play('duel');
      for (const n of ['fire', 'hit', 'miss', 'dud', 'sunk']) { A.sfx(n); A.sfx(n); }
      r.badPlay = A.play('없는곡'); r.badSfx = A.sfx('없는소리');
      A.play('result'); await wait(1800);
      A.stop(); await wait(300);
      r.sAfter = A.state();
      r.cfg1 = A.configure({ bgmOn: false, bgmVolume: 0.3, sfxOn: false, sfxVolume: 0.25 });
      r.sfxOff = A.sfx('fire');
      A.setBgmOn(true); A.setBgmVolume(5); A.setSfxOn(true); A.setSfxVolume(-1);
      r.cfg2 = A.state();
      r.cfg3 = A.configure({ bgmVolume: 'x', sfxOn: 'yes' }); // 잘못된 값은 무시
      A.configure(null); A.configure();
    } catch (e) { r.thrown = String(e && e.message || e); }
    r.errs = window.__soriErrors.slice();
    return r;
  });
  const fails1 = [];
  if (a2.thrown) fails1.push('예외: ' + a2.thrown);
  if (a2.errs.length) fails1.push('페이지 오류: ' + a2.errs.join(' | '));
  if (!a2.sUnlocked.unlocked) fails1.push('첫 터치 뒤에도 unlocked가 아님');
  if (a2.badPlay !== false || a2.badSfx !== false) fails1.push('알 수 없는 이름에 false가 아님');
  const miss1 = a2.sAfter.missing.join(',');
  for (const f of ['bgm-practice.mp3', 'bgm-duel.mp3', 'bgm-result.mp3', 'sfx-fire.mp3', 'sfx-sunk.mp3']) if (!miss1.includes(f)) fails1.push('없는 파일로 안 잡힘: ' + f);
  if (a2.sAfter.playing !== null || a2.sAfter.sfxPlayed !== 0) fails1.push('없는 파일인데 재생됨: ' + JSON.stringify(a2.sAfter));
  const c1 = a2.cfg1;
  if (!(c1.bgmOn === false && c1.bgmVolume === 0.3 && c1.sfxOn === false && c1.sfxVolume === 0.25)) fails1.push('configure 반영 안 됨: ' + JSON.stringify(c1));
  if (a2.sfxOff !== false) fails1.push('효과음을 껐는데 sfx()가 true');
  const c2 = a2.cfg2;
  if (!(c2.bgmOn === true && c2.bgmVolume === 1 && c2.sfxOn === true && c2.sfxVolume === 0)) fails1.push('setter/범위 자르기 이상: ' + JSON.stringify(c2));
  const c3 = a2.cfg3;
  if (!(c3.bgmVolume === 1 && c3.sfxOn === true)) fails1.push('잘못된 값이 들어감: ' + JSON.stringify(c3));
  if (fails1.length) console.log('FAIL ' + fails1.join('\\nFAIL '));
  else console.log('PASS');
} finally { await closeTab(ta); }
`);

step('점검용 mp3로 실제 재생·겹쳐 바꾸기·끄기', `
const tb = await openTab(${JSON.stringify(FIX)});
try {
  await tb.locator('#tap').click();
  const b1 = await tb.evaluate(async () => {
    const A = G.audio, r = { thrown: null };
    const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
    try {
      A.play('practice'); await wait(900);
      r.s1 = A.state();
      r.sfxOk = A.sfx('fire'); await wait(500);
      r.s2 = A.state();
      A.play('duel'); await wait(400);
      r.s3 = A.state();                 // 겹쳐 바꾸는 중: 새 곡이 돌고 옛 곡이 줄어드는 중
      await wait(2600);
      r.s4 = A.state();                 // 2초짜리 곡이 끝난 뒤에도 반복해서 돈다
      A.play('result'); await wait(2200); // 점검 폴더에 없는 곡 → 조용히 꺼짐
      r.s5 = A.state();
      A.play('practice'); await wait(800);
      A.configure({ bgmOn: false }); await wait(100);
      r.s6 = A.state();
      const starts = A.state().bgmStarts;
      A.play('duel'); await wait(700);
      r.s7 = A.state(); r.noStart = A.state().bgmStarts === starts;
      A.configure({ bgmOn: true }); await wait(800);
      r.s8 = A.state();
      A.configure({ sfxOn: false });
      const played = A.state().sfxPlayed;
      r.sfxOffRet = A.sfx('fire'); await wait(500);
      r.sfxOffSilent = A.state().sfxPlayed === played;
      A.stop(); await wait(1500);
      r.s9 = A.state();
    } catch (e) { r.thrown = String(e && e.message || e); }
    r.errs = window.__soriErrors.slice();
    return r;
  });
  const fails2 = [];
  const J = (o) => JSON.stringify(o);
  if (b1.thrown) fails2.push('예외: ' + b1.thrown);
  if (b1.errs.length) fails2.push('페이지 오류: ' + b1.errs.join(' | '));
  if (b1.s1.backend !== 'webaudio' || b1.s1.playing !== 'practice' || b1.s1.bgmMode !== 'buffer') fails2.push('웹 오디오 반복 재생 안 됨: ' + J(b1.s1));
  if (!b1.sfxOk || b1.s2.sfxPlayed !== 1) fails2.push('효과음 안 울림: ' + J(b1.s2));
  if (b1.s3.playing !== 'duel' || b1.s3.fading < 1) fails2.push('겹쳐 바꾸기 안 됨: ' + J(b1.s3));
  if (b1.s4.playing !== 'duel' || b1.s4.fading !== 0) fails2.push('반복 재생 유지 안 됨: ' + J(b1.s4));
  if (b1.s5.playing !== null || !b1.s5.missing.includes('bgm-result.mp3')) fails2.push('없는 곡 처리 이상: ' + J(b1.s5));
  if (b1.s6.playing !== null || b1.s6.bgmOn !== false) fails2.push('끄기 반영 안 됨: ' + J(b1.s6));
  if (b1.s7.playing !== null || b1.s7.track !== 'duel' || !b1.noStart) fails2.push('꺼진 상태에서 play()가 재생을 시작함: ' + J(b1.s7));
  if (b1.s8.playing !== 'duel') fails2.push('다시 켰을 때 원하던 곡이 안 돎: ' + J(b1.s8));
  if (b1.sfxOffRet !== false || !b1.sfxOffSilent) fails2.push('효과음을 껐는데 울림');
  if (b1.s9.playing !== null || b1.s9.track !== null) fails2.push('stop() 이상: ' + J(b1.s9));
  if (fails2.length) console.log('FAIL ' + fails2.join('\\nFAIL '));
  else console.log('PASS');
} finally { await closeTab(tb); }
`);

step('fetch가 안 되면 <audio> 요소로 대신 재생', `
const tc = await openTab(${JSON.stringify(NOFETCH)});
try {
  await tc.locator('#tap').click();
  const c1 = await tc.evaluate(async () => {
    const A = G.audio, r = { thrown: null };
    const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
    try {
      A.play('practice'); await wait(1200);
      r.s1 = A.state();
      A.sfx('fire'); A.sfx('fire'); await wait(300);
      A.play('result'); await wait(2500); // 없는 곡
      r.s2 = A.state();
    } catch (e) { r.thrown = String(e && e.message || e); }
    r.errs = window.__soriErrors.slice();
    return r;
  });
  const fails3 = [];
  if (c1.thrown) fails3.push('예외: ' + c1.thrown);
  if (c1.errs.length) fails3.push('페이지 오류: ' + c1.errs.join(' | '));
  if (c1.s1.bgmMode !== 'element' || c1.s1.playing !== 'practice') fails3.push('요소 재생 안 됨: ' + JSON.stringify(c1.s1));
  if (c1.s2.playing !== null || !c1.s2.missing.includes('bgm-result.mp3')) fails3.push('없는 곡 처리 이상: ' + JSON.stringify(c1.s2));
  if (fails3.length) console.log('FAIL ' + fails3.join('\\nFAIL '));
  else console.log('PASS');
} finally { await closeTab(tc); }
`);
