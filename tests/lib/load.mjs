// 브라우저 없이 게임의 일반 스크립트(js/…)를 Node에서 불러 쓰는 도우미.
//   const ctx = loadScripts(['js/core/util.js', 'js/data/sounds.js', 'js/core/rules.js']);
//   ctx.G.rules..., ctx.SOUNDS ...
// 스크립트는 같은 전역(ctx)에서 차례로 실행된다. window === ctx. document는 없다(규칙·데이터 코드는 DOM을 쓰지 않아야 함).
// 주의: 스크립트 최상위의 const/let은 ctx의 속성이 되지 않는다. 데이터는 window.이름 = … 으로 내보낸다.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadScripts(files, extra = {}) {
  const ctx = { console, Math, JSON, Date, setTimeout, clearTimeout, ...extra };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.addEventListener = () => {};
  vm.createContext(ctx);
  for (const f of files) {
    const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  }
  return ctx;
}

// 아주 작은 점검 도구: check(조건, 설명) … done('이름')
let fails = 0, passes = 0;
export function check(cond, msg) { if (cond) passes++; else { fails++; console.log('  FAIL', msg); } }
export function done(name = '') { console.log(`${name} 통과 ${passes}, 실패 ${fails}`); process.exit(fails ? 1 : 0); }
