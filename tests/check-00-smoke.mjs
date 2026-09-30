// 첫 화면이 오류 없이 열리는지(aside).
import { step, url } from './aside.mjs';

step('첫 화면 열기', `
const t0 = await openTab(${JSON.stringify(url('index.html'))});
await sleep(800);
const e0 = await t0.evaluate(() => ({ errs: window.__soriErrors || null, G: typeof window.G }));
await closeTab(t0);
if (!e0.errs) throw new Error('오류 모음이 없음(js/core/util.js가 안 불림)');
if (e0.errs.length) throw new Error('페이지 오류: ' + e0.errs.join(' | '));
console.log('PASS');
`);
