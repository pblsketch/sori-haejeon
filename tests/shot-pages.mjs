// 화면 캡처 도우미(점검 아님 — run-all에 들지 않는다). 서버를 먼저 켠다: node server.mjs 8820
//   BASE=http://127.0.0.1:8820/ node shot-pages.mjs 이름=가로x세로=주소 …
//   예) board-wide=1920x1080=tests/pages/board.html?view=wide   → tests/shots/이름.png (크기별 틀 frame.html 안에서)
import { runAside, BASE } from './aside.mjs';

let bad = 0;
for (const arg of process.argv.slice(2)) {
  const [name, wh, ...rest] = arg.split('=');
  const src = rest.join('=');
  const [w, h] = wh.split('x').map(Number);
  const url = `${BASE}tests/pages/frame.html?w=${w}&h=${h}&src=${encodeURIComponent(src)}`;
  const id = name.replace(/[^a-zA-Z0-9]/g, '_');
  const code = `
const t_${id} = await openTab(${JSON.stringify(url)});
await t_${id}.evaluate(() => window.frameReady);
await sleep(1500);
const i_${id} = await t_${id}.evaluate(() => { const s = Math.min(1, innerWidth / ${w}, innerHeight / ${h}); const fw = window.frameWin(); return { s, errs: (fw.__soriErrors || []).slice(0, 5) }; });
console.log('INFO ' + JSON.stringify(i_${id}));
await fs.mkdir('./artifacts', { recursive: true });
await fs.writeFile('./artifacts/${name}.png', await t_${id}.screenshot({ clip: { x: 0, y: 0, width: Math.floor(${w} * i_${id}.s), height: Math.floor(${h} * i_${id}.s) } }));
console.log('SHOTFILE:' + path.resolve('./artifacts/${name}.png'));
await closeTab(t_${id});
console.log(i_${id}.errs.length ? 'FAIL ' + i_${id}.errs.join(' | ') : 'PASS');
`;
  const r = runAside(code, { label: name });
  console.log(name, r.ok ? 'ok' : 'FAIL', (r.out.match(/INFO .*/) || [''])[0]);
  if (!r.ok) { bad++; console.log(r.out.slice(-600)); }
}
process.exit(bad ? 1 : 0);
