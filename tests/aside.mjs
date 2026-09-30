// aside로 브라우저 점검을 돌리는 도우미. (브라우저 점검 도구는 aside만 쓴다.)
//
// 시험해 보고 알게 된 aside의 성질 — 점검을 쓸 때 꼭 지킬 것:
//  1. `aside repl "<코드>"`는 점검이 실패해도 0으로 끝난다. 그래서 코드 끝에서 console.log('PASS')를 찍고,
//     실패는 throw 하거나 console.log('FAIL …')을 찍는다. 이 도우미가 출력을 읽어 판정한다.
//  2. 한 번의 호출은 120초 안에 끝나야 한다. 긴 흐름은 여러 번으로 나눈다(호출마다 새 탭을 연다).
//  3. 탭은 openTab(url)로 연다. about:blank에서 page.goto()는 멈춘다. 끝나면 꼭 closeTab(탭).
//  4. page.on('console') 이 오지 않는다. 게임 오류는 js/core/util.js가 모으는 window.__soriErrors를 읽는다.
//  5. 화면 크기를 바꾸지 못한다(setViewportSize 없음, 창은 대략 1440×900).
//     크기별 점검은 tests/pages/frame.html?w=390&h=844&src=... 안의 iframe으로 한다(frameWin()으로 접근).
//  6. aside의 fs는 따로 떨어진 폴더에 쓴다. 캡처는 await fs.writeFile('./artifacts/이름.png', await 탭.screenshot())
//     한 뒤 console.log('SHOTFILE:' + path.resolve('./artifacts/이름.png'))를 찍으면 이 도우미가 tests/shots/로 옮긴다.
//  7. 같은 호출 안에서 const/let 이름이 겹치지 않게 짓는다.
//  8. localStorage는 같은 주소의 탭끼리 이어진다. 점검 시작 때 필요하면 지운다.
//  9. 이 도우미는 동기 실행이라 같은 프로세스에서 서버를 띄우면 안 된다(run-all.mjs가 서버를 따로 띄움).
//     check 파일을 혼자 돌릴 때는 먼저 `node server.mjs 8791`을 켜 둔다.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
export const BASE = (process.env.BASE || 'http://127.0.0.1:8791/').replace(/\/?$/, '/');
export const SHOTS = path.join(DIR, 'shots');

const strip = (s) => String(s || '').replace(/\x1b\[[0-9;]*m/g, '');

// aside 실행 파일: 환경 변수 ASIDE > Windows 기본 설치 위치 > PATH의 aside
function asideBin() {
  if (process.env.ASIDE) return process.env.ASIDE;
  if (process.platform === 'win32') {
    const p = path.join(process.env.LOCALAPPDATA || '', 'Aside', 'CLI', 'current', 'aside.exe');
    if (fs.existsSync(p)) return p;
    return 'aside.exe';
  }
  return 'aside';
}

// 모든 조각 앞에 붙는 머리말: aside의 screenshot()은 가만히 있는 탭에서 가끔 시간 초과가 나므로
// openTab이 돌려주는 탭의 screenshot을 "화면을 살짝 건드리고 몇 번 다시 찍기"로 감싼다.
const PRELUDE = `
const __sori_openTab = openTab;
openTab = async (...__a) => {
  const __t = await __sori_openTab(...__a);
  const __shot = __t.screenshot.bind(__t);
  __t.screenshot = async (__opts) => {
    let __err = null;
    for (let __k = 0; __k < 4; __k++) {
      try { await __t.evaluate(() => { document.body.style.outline = document.body.style.outline ? '' : '0px solid transparent'; }); } catch (__e) {}
      await sleep(250);
      try { return await __shot(Object.assign({ timeout: 10000 }, __opts || {})); } catch (__e) { __err = __e; }
    }
    throw __err;
  };
  return __t;
};
`;

// 코드 한 조각을 aside로 돌린다. { ok, out } 을 돌려준다.
export function runAside(code, { label = '' } = {}) {
  const r = spawnSync(asideBin(), ['repl', PRELUDE + code], { encoding: 'utf8', timeout: 170000, windowsHide: true });
  const out = strip((r.stdout || '') + (r.stderr || ''));
  if (r.error) return { ok: false, out: out + '\n[도우미] aside 실행 실패: ' + r.error.message, label };
  for (const m of out.matchAll(/SHOTFILE:(.+\.png)/g)) {
    try {
      fs.mkdirSync(SHOTS, { recursive: true });
      const src = m[1].trim();
      fs.copyFileSync(src, path.join(SHOTS, path.basename(src)));
    } catch (e) { return { ok: false, out: out + '\n[도우미] 캡처 옮기기 실패: ' + e.message, label }; }
  }
  const bad = /\[error \|/.test(out) || /(^|\n)\s*FAIL\b/.test(out);
  const good = /(^|\n)\s*PASS\s*(\n|$)/.test(out);
  return { ok: good && !bad, out, label };
}

// 한 조각을 돌리고 결과를 찍는다. 실패하면 process.exitCode = 1.
export function step(label, code) {
  const r = runAside(code, { label });
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!r.ok) {
    const tail = r.out.split('\n').filter((l) => l.trim() && !/^✔︎|^\[system\]/.test(l.trim())).slice(-15).join('\n');
    console.log(tail);
    process.exitCode = 1;
  }
  return r;
}

// 게임 주소 만들기
export const url = (p = '') => BASE + p.replace(/^\//, '');
// 크기별 틀 주소: frame(390, 844, 'index.html')
export const frame = (w, h, src = 'index.html') => url(`tests/pages/frame.html?w=${w}&h=${h}&src=${encodeURIComponent(src)}`);
