// 점검 전체 실행: tests/ 안의 check-*.mjs를 이름 순서대로 모두 돌린다. 하나라도 실패하면 1로 끝난다.
//   cd tests && npm test            (로컬 서버를 띄워 점검)
//   BASE=https://… npm test          (그 주소를 점검 — 브라우저 점검만 주소를 씀)
//   npm test -- rules board          (이름에 rules나 board가 들어간 점검만)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2);
const files = fs.readdirSync(DIR).filter((f) => /^check-.*\.mjs$/.test(f)).sort()
  .filter((f) => !only.length || only.some((o) => f.includes(o)));
if (!files.length) { console.log('점검 파일이 없습니다.'); process.exit(0); }

let server = null;
const env = { ...process.env };
if (!env.BASE) {
  const port = +(env.PORT || 8791);
  server = await startServer(port);
  env.BASE = server.base;
}
const results = [];
for (const f of files) {
  const t0 = Date.now();
  console.log(`\n=== ${f} ===`);
  // 서버가 이 프로세스 안에서 돌기 때문에 spawnSync로 막으면 응답을 못 한다 → 비동기로 기다린다
  const code = await new Promise((resolve) => {
    import('node:child_process').then(({ spawn }) => {
      const p = spawn(process.execPath, [path.join(DIR, f)], { cwd: DIR, env, stdio: 'inherit' });
      p.on('close', (c) => resolve(c));
    });
  });
  results.push({ f, code, sec: ((Date.now() - t0) / 1000).toFixed(1) });
}
if (server) server.srv.close();
console.log('\n=== 결과 ===');
for (const r of results) console.log(`${r.code === 0 ? 'PASS' : 'FAIL'}  ${r.f}  (exit ${r.code}, ${r.sec}s)`);
const failed = results.filter((r) => r.code !== 0);
console.log(failed.length ? `실패 ${failed.length}개` : '모두 통과');
process.exit(failed.length ? 1 : 0);
