// T20 판 시안 캡처(점검이 아님 — run-all에 들지 않는다). 서버를 먼저 켠다: node server.mjs 8820
//   BASE=http://127.0.0.1:8820/ node shot-board-concepts.mjs [a b c]
// 시안마다 가로(1920×1080)·휴대폰(390×844)·숨긴 2단계(1920×1080)를 찍어 tests/shots/bc-*.png로 옮긴다.
import { runAside, BASE } from './aside.mjs';

const which = process.argv.slice(2).length ? process.argv.slice(2) : ['a', 'b', 'c'];
const views = [['wide', 1920, 1080], ['phone', 390, 844], ['hidden', 1920, 1080]];
let bad = 0;
for (const c of which) {
  for (const [v, w, h] of views) {
    const src = encodeURIComponent(`tests/pages/board-concepts.html?c=${c}&view=${v}`);
    const url = `${BASE}tests/pages/frame.html?w=${w}&h=${h}&src=${src}`;
    const name = `bc-${c}-${v}`;
    const code = `
const t_${c}_${v} = await openTab(${JSON.stringify(url)});
await t_${c}_${v}.evaluate(() => window.frameReady);
await sleep(900);
const info_${c}_${v} = await t_${c}_${v}.evaluate(() => {
  const s = Math.min(1, innerWidth / ${w}, innerHeight / ${h});
  const fw = window.frameWin();
  return { s, iw: innerWidth, ih: innerHeight, ready: !!fw.__bcReady, errs: (fw.__soriErrors || []).length, sh: fw.document.documentElement.scrollHeight };
});
console.log('INFO ' + JSON.stringify(info_${c}_${v}));
const clip_${c}_${v} = { x: 0, y: 0, width: Math.floor(${w} * info_${c}_${v}.s), height: Math.floor(${h} * info_${c}_${v}.s) };
await fs.mkdir('./artifacts', { recursive: true });
await fs.writeFile('./artifacts/${name}.png', await t_${c}_${v}.screenshot({ clip: clip_${c}_${v} }));
console.log('SHOTFILE:' + path.resolve('./artifacts/${name}.png'));
await closeTab(t_${c}_${v});
if (!info_${c}_${v}.ready) console.log('FAIL not ready'); else console.log('PASS');
`;
    const r = runAside(code, { label: name });
    console.log(name, r.ok ? 'ok' : 'FAIL', (r.out.match(/INFO .*/) || [''])[0]);
    if (!r.ok) { bad++; console.log(r.out.slice(-800)); }
  }
}
process.exit(bad ? 1 : 0);
