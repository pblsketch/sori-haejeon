// T20 판 시안 캡처(점검이 아님 — run-all에 들지 않는다). 서버를 먼저 켠다: node server.mjs 8820
//   BASE=http://127.0.0.1:8820/ node shot-board-concepts.mjs [a b c]
// 시안마다 가로(1920×1080)·휴대폰(390×844)·숨긴 2단계(1920×1080)를 찍어 tests/shots/bc-*.png로 옮긴다.
import { runAside, BASE } from './aside.mjs';

const which = process.argv.slice(2).length ? process.argv.slice(2) : ['a', 'b', 'c'];
const views = [['wide', 1920, 1080], ['phone', 390, 844], ['hidden', 1920, 1080]];
let bad = 0;
// c2(2차 시안 C)는 떨어진 두 칸 배 잇기 두 가지(점선 끌줄 / 번호 배지)를 판의 그 부분만 잘라 더 찍는다.
const extra = [['tow-dotted', 1920, 1080, 'wide&tow=dotted', true], ['tow-badges', 1920, 1080, 'wide&tow=badges', true]];
for (const c of which) {
  for (const [v, w, h, q, crop] of (c === 'c2' ? views.concat(extra) : views)) {
    const src = encodeURIComponent(`tests/pages/board-concepts.html?c=${c}&view=${q || v}`);
    const url = `${BASE}tests/pages/frame.html?w=${w}&h=${h}&src=${src}`;
    const name = `bc-${c}-${v}`;
    const id = `${c}_${v.replace(/-/g, '_')}`;
    const code = `
const t_${id} = await openTab(${JSON.stringify(url)});
await t_${id}.evaluate(() => window.frameReady);
await sleep(900);
const info_${id} = await t_${id}.evaluate(() => {
  const s = Math.min(1, innerWidth / ${w}, innerHeight / ${h});
  const fw = window.frameWin();
  return { s, iw: innerWidth, ih: innerHeight, ready: !!fw.__bcReady, errs: (fw.__soriErrors || []).length, sh: fw.document.documentElement.scrollHeight, tow: (fw.__towRects || [])[0] || null };
});
console.log('INFO ' + JSON.stringify(info_${id}));
const T_${id} = info_${id}.tow, K_${id} = info_${id}.s;
// (aside의 screenshot은 clip의 x·y를 무시한다 → 전체를 찍고, 끌줄 부분 자르기는 tools/process_top.py --crop-tow가 한다)
const clip_${id} = { x: 0, y: 0, width: Math.floor(${w} * K_${id}), height: Math.floor(${h} * K_${id}) };
await fs.mkdir('./artifacts', { recursive: true });
await fs.writeFile('./artifacts/${name}.png', await t_${id}.screenshot({ clip: clip_${id} }));
console.log('SHOTFILE:' + path.resolve('./artifacts/${name}.png'));
await closeTab(t_${id});
if (!info_${id}.ready) console.log('FAIL not ready'); else console.log('PASS');
`;
    const r = runAside(code, { label: name });
    console.log(name, r.ok ? 'ok' : 'FAIL', (r.out.match(/INFO .*/) || [''])[0]);
    if (!r.ok) { bad++; console.log(r.out.slice(-800)); }
  }
}
process.exit(bad ? 1 : 0);
