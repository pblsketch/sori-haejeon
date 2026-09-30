// 음원 파일 점검(브라우저 없이, ffmpeg로 풀어서 잰다).
//   - 8개 파일이 모두 있고 풀린다
//   - 길이: 효과음은 짧게(신호 판단을 가리지 않게), 배경 음악은 적당한 길이·용량
//   - 배경 음악 반복 이음새: 끝 20ms와 처음 20ms의 소리 크기 차, 끝 샘플→첫 샘플 튐
//   - 배경 음악 3곡의 음량(LUFS)이 서로 가깝다
//   - 효과음이 찌그러지지(클리핑) 않는다
// ffmpeg가 필요하다(FFMPEG 환경 변수로 경로를, AUDIO_DIR로 점검할 폴더를 바꿀 수 있다).
// 기준값은 아래 LIMITS에서 조정한다.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = process.env.AUDIO_DIR || path.join(ROOT, 'assets', 'audio');
// ffmpeg 찾기: FFMPEG 환경 변수 → PATH의 ffmpeg → 흔한 설치 위치
const FFMPEG = [process.env.FFMPEG, 'ffmpeg',
  path.join(os.homedir(), 'ffmpeg', 'bin', 'ffmpeg.exe'), 'C:/ffmpeg/bin/ffmpeg.exe', '/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg']
  .filter(Boolean).find((c) => !spawnSync(c, ['-version'], { stdio: 'ignore' }).error) || 'ffmpeg';
const SR = 44100;

const LIMITS = {
  bgm: { minSec: 45, maxSec: 240, maxBytes: 4 * 1024 * 1024 },
  sfx: { 'sfx-fire': 1.25, 'sfx-hit': 2.05, 'sfx-miss': 1.55, 'sfx-dud': 1.25, 'sfx-sunk': 3.55 },
  seamRmsDb: 6,        // 끝 20ms와 처음 20ms의 RMS 차(dB) 최대
  seamJumpK: 2,        // 이음새 한 샘플 튐 ≤ K × (곡 안 보통 샘플 변화의 99.9 백분위)
  seamJumpAbs: 0.02,   // …또는 이 절댓값 이하면 통과
  bgmLufsSpread: 1.5,  // 배경 음악끼리 LUFS 차 최대
  sfxLufsSpread: 3,    // 효과음끼리 LUFS 차 최대
  peakMax: 0.966,      // 효과음 샘플 최댓값(약 -0.3 dBFS)
};

const BGM = ['bgm-practice', 'bgm-duel', 'bgm-result'];
const SFX = Object.keys(LIMITS.sfx);

const fails = [];
const fail = (m) => { fails.push(m); console.log('  FAIL ' + m); };

function ff(args, opts = {}) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', ...args], { maxBuffer: 256 * 1024 * 1024, ...opts });
  if (r.error) throw new Error(`ffmpeg를 실행할 수 없음(${FFMPEG}): ${r.error.message}`);
  return r;
}

// f32le로 풀기 → 채널별 Float32Array
function decode(file, ch) {
  const r = ff(['-v', 'error', '-i', file, '-f', 'f32le', '-ac', String(ch), '-ar', String(SR), '-']);
  if (r.status !== 0 || !r.stdout.length) throw new Error('풀기 실패: ' + r.stderr.toString());
  const buf = r.stdout;
  const all = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  const n = all.length / ch;
  const chans = Array.from({ length: ch }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) chans[c][i] = all[i * ch + c];
  return chans;
}

function lufs(file) {
  const r = ff(['-i', file, '-af', 'ebur128', '-f', 'null', '-']);
  const m = [...r.stderr.toString().matchAll(/I:\s+(-?[\d.]+) LUFS/g)];
  if (!m.length) throw new Error('LUFS를 못 읽음: ' + file);
  return +m[m.length - 1][1];
}

const rms = (a, s, e) => { let t = 0; for (let i = s; i < e; i++) t += a[i] * a[i]; return Math.sqrt(t / Math.max(1, e - s)); };
const db = (v) => 20 * Math.log10(v + 1e-12);

function p999AbsDiff(a) {
  // 보통 샘플 변화 크기: |x[i+1]-x[i]|의 99.9 백분위(히스토그램으로 근사)
  const bins = 4000, top = 2, h = new Uint32Array(bins);
  for (let i = 1; i < a.length; i++) h[Math.min(bins - 1, Math.floor(Math.abs(a[i] - a[i - 1]) / top * bins))]++;
  const want = (a.length - 1) * 0.999; let acc = 0;
  for (let b = 0; b < bins; b++) { acc += h[b]; if (acc >= want) return (b + 1) / bins * top; }
  return top;
}

// 1) 파일 존재
for (const n of [...BGM, ...SFX]) {
  const f = path.join(AUDIO, n + '.mp3');
  if (!fs.existsSync(f)) fail(`${n}.mp3 없음`);
}
if (!fs.existsSync(path.join(AUDIO, 'CREDITS.md'))) fail('CREDITS.md 없음');
if (fails.length) { console.log('FAIL'); process.exit(1); }

// 2) 배경 음악
const bgmL = {};
for (const n of BGM) {
  const f = path.join(AUDIO, n + '.mp3');
  const bytes = fs.statSync(f).size;
  const ch = decode(f, 2);
  const len = ch[0].length, sec = len / SR;
  const w = Math.round(0.02 * SR);
  let worstRms = 0, worstJump = 0, worstRatio = 0;
  for (const a of ch) {
    const dRms = Math.abs(db(rms(a, len - w, len)) - db(rms(a, 0, w)));
    const jump = Math.abs(a[0] - a[len - 1]);
    const typ = p999AbsDiff(a);
    worstRms = Math.max(worstRms, dRms);
    worstJump = Math.max(worstJump, jump);
    worstRatio = Math.max(worstRatio, jump / typ);
  }
  const L = lufs(f); bgmL[n] = L;
  console.log(`${n}: ${sec.toFixed(2)}s, ${(bytes / 1048576).toFixed(2)}MB, ${L.toFixed(1)} LUFS, 이음새 RMS차 ${worstRms.toFixed(2)}dB, 튐 ${worstJump.toFixed(4)} (보통 변화의 ${worstRatio.toFixed(2)}배)`);
  if (sec < LIMITS.bgm.minSec || sec > LIMITS.bgm.maxSec) fail(`${n} 길이 ${sec.toFixed(1)}s (허용 ${LIMITS.bgm.minSec}~${LIMITS.bgm.maxSec})`);
  if (bytes > LIMITS.bgm.maxBytes) fail(`${n} 용량 ${bytes}B > ${LIMITS.bgm.maxBytes}`);
  if (worstRms > LIMITS.seamRmsDb) fail(`${n} 이음새 RMS 차 ${worstRms.toFixed(2)}dB > ${LIMITS.seamRmsDb}`);
  if (worstJump > LIMITS.seamJumpAbs && worstRatio > LIMITS.seamJumpK) fail(`${n} 이음새 튐 ${worstJump.toFixed(4)} (보통 변화의 ${worstRatio.toFixed(2)}배)`);
}
const bv = Object.values(bgmL);
const bSpread = Math.max(...bv) - Math.min(...bv);
console.log(`배경 음악 LUFS 차: ${bSpread.toFixed(2)} LU`);
if (bSpread > LIMITS.bgmLufsSpread) fail(`배경 음악 음량 차 ${bSpread.toFixed(2)} LU > ${LIMITS.bgmLufsSpread}`);

// 3) 효과음
const sfxL = {};
for (const n of SFX) {
  const f = path.join(AUDIO, n + '.mp3');
  const ch = decode(f, 1);
  const a = ch[0], sec = a.length / SR;
  let peak = 0; for (let i = 0; i < a.length; i++) peak = Math.max(peak, Math.abs(a[i]));
  const L = lufs(f); sfxL[n] = L;
  console.log(`${n}: ${sec.toFixed(3)}s, 최댓값 ${db(peak).toFixed(1)} dBFS, ${L.toFixed(1)} LUFS`);
  if (sec > LIMITS.sfx[n]) fail(`${n} 길이 ${sec.toFixed(3)}s > ${LIMITS.sfx[n]}s`);
  if (sec < 0.2) fail(`${n} 너무 짧음 ${sec.toFixed(3)}s`);
  if (peak > LIMITS.peakMax) fail(`${n} 클리핑 위험: 최댓값 ${peak.toFixed(3)}`);
}
const sv = Object.values(sfxL);
const sSpread = Math.max(...sv) - Math.min(...sv);
console.log(`효과음 LUFS 차: ${sSpread.toFixed(2)} LU`);
if (sSpread > LIMITS.sfxLufsSpread) fail(`효과음 음량 차 ${sSpread.toFixed(2)} LU > ${LIMITS.sfxLufsSpread}`);

if (fails.length) { console.log(`FAIL (${fails.length})`); process.exit(1); }
console.log('PASS');
