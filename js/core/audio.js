'use strict';
// 소리 재생 엔진(G.audio): 녹음 음원(mp3)으로 배경 음악과 효과음을 낸다. 합성음은 쓰지 않는다(spec 8.3).
//
//  파일 이름(T6 약속) — 기본 폴더 assets/audio/
//    배경 음악: bgm-practice.mp3 · bgm-duel.mp3 · bgm-result.mp3   → G.audio.play('practice' | 'duel' | 'result')
//    효과음   : sfx-fire.mp3 · sfx-hit.mp3 · sfx-miss.mp3 · sfx-dud.mp3 · sfx-sunk.mp3 → G.audio.sfx('fire' | …)
//
//  재생 방식
//    - 웹 오디오(기본): fetch로 받아 풀어 둔 소리(버퍼)를 이음새 없이 반복한다(buffer loop).
//    - 오디오 요소(대신): file:// 로 열었거나 fetch가 안 되면 <audio loop>로 낸다.
//    - 곡을 바꾸면 새 곡이 준비되는 대로 옛 곡과 겹쳐 부드럽게 바꾼다(크로스페이드).
//      새 곡이 늦으면(1.5초) 옛 곡만 먼저 줄여 끈다.
//  설정(켜기/끄기·음량)은 여기서 저장하지 않는다. G.save가 configure()를 부른다.
//  브라우저 정책: 첫 pointerdown/keydown/touchend에서 unlock()이 저절로 불린다. 그 전의 play()는 기억만 해 둔다.
//  파일이 없거나 풀리지 않아도 조용히 넘어간다: 예외를 던지지 않고, console.error를 쓰지 않는다
//  (js/core/util.js가 console.error를 페이지 오류로 모으기 때문). 파일마다 console.warn 한 번만 남긴다.
(function () {
  const BGM = ['practice', 'duel', 'result'];
  const SFX = ['fire', 'hit', 'miss', 'dud', 'sunk'];
  const FADE = 1.2;        // 곡 바꾸기(겹쳐 바꾸기) 시간, 초
  const FADE_FIRST = 0.8;  // 조용하다가 처음 켤 때 올리는 시간, 초
  const WAIT_MAX = 1500;   // 새 곡을 기다리는 최대 시간(ms). 넘으면 옛 곡을 먼저 줄인다
  const SFX_LATE = 400;    // 효과음을 불러오는 데 이보다 오래 걸리면 그 번은 건너뛴다(ms) — 늦게 울리면 헷갈림
  const SFX_MAX = 8;       // 동시에 울리는 효과음 수 한도
  const BGM_CACHE = 2;     // 풀어 둔 배경 음악을 몇 곡까지 들고 있을지(저사양 칠판 메모리)

  const cfg = { bgmOn: true, bgmVolume: 0.6, sfxOn: true, sfxVolume: 0.8 };
  let base = 'assets/audio/';
  const noFetch = typeof location !== 'undefined' && location.protocol === 'file:';

  let ctx = null, bgmBus = null, sfxBus = null;
  let unlocked = false;
  const loads = {};    // 파일 이름 → Promise<소리 | null>   소리 = { buf, loopStart, loopEnd } 또는 { url }
  const missing = {};  // 쓸 수 없는 파일
  const warned = {};
  const bgmOrder = []; // 풀어 둔 배경 음악 순서(오래된 것부터 버림)

  let want = null;     // 화면이 원하는 곡
  let cur = null;      // 지금 들리는 곡 { name, file, kind, src, gain, el, level, … }
  let pending = null;  // 불러오는 중인 곡 이름
  let token = 0;       // 곡 요청 차례(늦게 온 옛 요청을 버리려고)
  const fading = new Set();
  let sfxVoices = 0, sfxPlayed = 0, bgmStarts = 0;

  const A = (G.audio = {});
  A.tracks = BGM.slice();
  A.effects = SFX.slice();

  // ───────── 작은 도구
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const fileOf = (kind, name) => (kind === 'bgm' ? 'bgm-' : 'sfx-') + name + '.mp3';
  const urlOf = (file) => base + file;
  // 공개 함수는 무슨 일이 있어도 던지지 않는다
  const safe = (fn, fallback) => function () { try { return fn.apply(this, arguments); } catch (e) { warnOnce('엔진', e && e.message); return fallback; } };
  function warnOnce(key, why) {
    if (warned[key]) return;
    warned[key] = true;
    try { console.warn('[소리] 건너뜀:', key, why || ''); } catch (e) { /* 무시 */ }
  }
  function markMissing(file, why) {
    missing[file] = true;
    loads[file] = Promise.resolve(null);
    warnOnce(file, why);
  }
  const quiet = (p) => { if (p && typeof p.catch === 'function') p.catch(() => {}); return p; };

  // ───────── 웹 오디오 준비(첫 터치 때)
  function initCtx() {
    if (ctx || noFetch) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; return null; }
    bgmBus = ctx.createGain(); bgmBus.gain.value = cfg.bgmVolume; bgmBus.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = cfg.sfxVolume; sfxBus.connect(ctx.destination);
    return ctx;
  }
  const backend = () => (ctx ? 'webaudio' : (typeof Audio === 'function' ? 'element' : 'none'));

  // ───────── 불러오기
  function decode(ab) {
    return new Promise((res, rej) => {
      try { quiet(ctx.decodeAudioData(ab, res, rej)); } catch (e) { rej(e); }
    });
  }
  // MP3 앞뒤에 붙는 완전한 무음(인코더 틈)을 반복 구간에서 뺀다. 소리가 있는 부분은 건드리지 않는다.
  function loopBounds(buf) {
    const lim = Math.floor(buf.sampleRate * 0.06), n = buf.length;
    const quietAt = (i) => { for (let c = 0; c < buf.numberOfChannels; c++) if (Math.abs(buf.getChannelData(c)[i]) > 1e-4) return false; return true; };
    let s = 0; while (s < lim && s < n - 1 && quietAt(s)) s++;
    let e = n; while (n - e < lim && e - 1 > s && quietAt(e - 1)) e--;
    if (e - s < buf.sampleRate * 0.05) return { loopStart: 0, loopEnd: buf.duration }; // 거의 무음이면 통째로
    return { loopStart: s / buf.sampleRate, loopEnd: e / buf.sampleRate };
  }
  function load(file, isBgm) {
    if (missing[file]) return Promise.resolve(null);
    if (loads[file]) return loads[file];
    const p = (async () => {
      if (ctx) {
        let res = null;
        try { res = await fetch(urlOf(file)); } catch (e) { res = null; } // file:// 이나 막힌 경우 → 요소로
        if (res) {
          if (!res.ok) { markMissing(file, 'HTTP ' + res.status); return null; }
          try {
            const buf = await decode(await res.arrayBuffer());
            const b = isBgm ? loopBounds(buf) : { loopStart: 0, loopEnd: buf.duration };
            return { buf, loopStart: b.loopStart, loopEnd: b.loopEnd };
          } catch (e) { markMissing(file, '풀 수 없음'); return null; }
        }
      }
      if (typeof Audio !== 'function') { markMissing(file, '오디오 없음'); return null; }
      return { url: urlOf(file) }; // 요소는 재생할 때 오류를 보고 없는 파일로 적는다
    })().catch((e) => { markMissing(file, e && e.message); return null; });
    loads[file] = p;
    if (isBgm) {
      const i = bgmOrder.indexOf(file); if (i >= 0) bgmOrder.splice(i, 1);
      bgmOrder.push(file);
      while (bgmOrder.length > BGM_CACHE) {
        const old = bgmOrder.find((f) => !(cur && cur.file === f) && f !== file);
        if (!old) break;
        bgmOrder.splice(bgmOrder.indexOf(old), 1);
        if (!missing[old]) delete loads[old];
      }
    }
    return p;
  }

  // 오디오 요소 하나 만들기(없는 파일이면 onBad)
  function makeEl(url, loop, onBad) {
    const el = new Audio();
    el.preload = 'auto'; el.loop = !!loop;
    el.addEventListener('error', () => onBad && onBad());
    el.src = url;
    return el;
  }
  function playEl(el, onBlocked) {
    try { const p = el.play(); if (p && p.catch) p.catch((e) => onBlocked && onBlocked(e)); } catch (e) { onBlocked && onBlocked(e); }
  }

  // ───────── 배경 음악
  const bgmVol = () => cfg.bgmVolume;
  // 곡 하나의 크기(0~1, 겹쳐 바꾸기용)를 target으로 sec초 동안 옮긴다
  function fadeTo(tr, target, sec, done) {
    if (tr.timer) { clearInterval(tr.timer); tr.timer = null; }
    if (tr.kind === 'buffer') {
      const g = tr.gain.gain, now = ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(target, now + sec);
      tr.level = target;
      if (done) setTimeout(done, sec * 1000 + 60);
      return;
    }
    const from = tr.level, t0 = Date.now(), ms = sec * 1000;
    tr.timer = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / ms);
      tr.level = from + (target - from) * k;
      try { tr.el.volume = clamp01(tr.level * bgmVol()); } catch (e) { /* 무시 */ }
      if (k >= 1) { clearInterval(tr.timer); tr.timer = null; if (done) done(); }
    }, 50);
  }
  function fadeOut(tr) {
    if (!tr || tr.dead) return;
    tr.dead = true;
    fading.add(tr);
    fadeTo(tr, 0, FADE, () => {
      fading.delete(tr);
      try {
        if (tr.kind === 'buffer') { tr.src.stop(); tr.src.disconnect(); tr.gain.disconnect(); }
        else tr.el.pause();
      } catch (e) { /* 무시 */ }
    });
  }
  function startBgm(name, file, snd, first) {
    const tr = { name, file, level: 0, dead: false, blocked: false, timer: null };
    if (snd.buf) {
      tr.kind = 'buffer';
      tr.gain = ctx.createGain(); tr.gain.gain.value = 0; tr.gain.connect(bgmBus);
      tr.src = ctx.createBufferSource();
      tr.src.buffer = snd.buf; tr.src.loop = true;
      tr.src.loopStart = snd.loopStart; tr.src.loopEnd = snd.loopEnd;
      tr.src.connect(tr.gain);
      tr.src.onended = () => { tr.ended = true; }; // 반복 중에는 오지 않는다(멈추면 옴)
      tr.src.start(0, snd.loopStart);
    } else {
      tr.kind = 'element';
      tr.el = makeEl(snd.url, true, () => {
        if (tr.dead) return;
        markMissing(file, '재생할 수 없음');
        if (cur === tr) cur = null;
        tr.dead = true; fading.delete(tr);
      });
      tr.el.volume = 0;
      tr.el.addEventListener('ended', () => { tr.ended = true; });
      playEl(tr.el, () => { tr.blocked = true; });
    }
    bgmStarts++;
    fadeTo(tr, 1, first ? FADE_FIRST : FADE);
    return tr;
  }
  // 지금 들려야 할 곡에 맞춘다
  function sync() {
    const target = unlocked && cfg.bgmOn && want ? want : null;
    if (cur && cur.name === target) { if (pending) { token++; pending = null; } return; }
    if (target && pending === target) return;
    const my = ++token;
    pending = target;
    if (!target) { fadeOut(cur); cur = null; return; }
    const file = fileOf('bgm', target);
    const old = cur;
    const guard = old ? setTimeout(() => { if (my === token && cur === old) { fadeOut(old); cur = null; } }, WAIT_MAX) : null;
    load(file, true).then((snd) => {
      if (guard) clearTimeout(guard);
      if (my !== token) return;
      pending = null;
      const had = !!cur;
      if (cur) { fadeOut(cur); cur = null; }
      if (!snd || !cfg.bgmOn || !unlocked) return; // 없는 곡이면 조용히
      try { cur = startBgm(target, file, snd, !had); } catch (e) { markMissing(file, e && e.message); cur = null; }
    });
  }

  // ───────── 효과음
  function playSfx(file, snd) {
    if (sfxVoices >= SFX_MAX) return;
    sfxVoices++; sfxPlayed++;
    let done = false;
    const end = () => { if (!done) { done = true; sfxVoices--; } };
    if (snd.buf) {
      const src = ctx.createBufferSource();
      src.buffer = snd.buf; src.connect(sfxBus);
      src.onended = () => { end(); try { src.disconnect(); } catch (e) { /* 무시 */ } };
      src.start(0);
      setTimeout(end, (snd.buf.duration + 1) * 1000); // 소리 틀이 멈춰 있어 끝 소식이 늦어도 자리는 돌려준다
    } else {
      const el = makeEl(snd.url, false, () => { markMissing(file, '재생할 수 없음'); end(); });
      el.volume = clamp01(cfg.sfxVolume);
      el.addEventListener('ended', end);
      playEl(el, end);
      setTimeout(end, 10000); // 끝 소식이 오지 않아도 자리는 돌려준다
    }
  }

  // ───────── 음량 반영
  function applyVolumes() {
    if (ctx) {
      const now = ctx.currentTime;
      for (const [bus, v] of [[bgmBus, cfg.bgmVolume], [sfxBus, cfg.sfxVolume]]) {
        bus.gain.cancelScheduledValues(now);
        bus.gain.setValueAtTime(bus.gain.value, now);
        bus.gain.linearRampToValueAtTime(v, now + 0.15);
      }
    }
    for (const tr of [cur, ...fading]) if (tr && tr.kind === 'element' && !tr.timer) {
      try { tr.el.volume = clamp01(tr.level * bgmVol()); } catch (e) { /* 무시 */ }
    }
  }

  // ───────── 다른 탭으로 가면 소리를 멈춘다(교실에서 여러 기기가 함께 울리지 않게)
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', safe(() => {
      if (ctx) quiet(document.hidden ? ctx.suspend() : (unlocked ? ctx.resume() : null));
      if (cur && cur.kind === 'element') { if (document.hidden) cur.el.pause(); else playEl(cur.el, () => { cur && (cur.blocked = true); }); }
    }));
  }

  // ───────── 공개 함수
  // 첫 터치 뒤 소리 켜기. 여러 번 불러도 된다.
  A.unlock = safe(function () {
    unlocked = true;
    initCtx();
    if (ctx) {
      if (ctx.state === 'suspended' && !document.hidden) quiet(ctx.resume());
      try { // iOS 사파리: 제스처 안에서 한 번 소리를 내야 풀린다(아주 짧은 무음)
        const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
      } catch (e) { /* 무시 */ }
      for (const n of SFX) load(fileOf('sfx', n), false); // 효과음은 미리 불러 둔다(짧음)
    }
    sync();
    return true;
  }, false);
  // 배경 음악 고르기('practice' | 'duel' | 'result'). 같은 곡이면 그대로 잇는다. 꺼져 있거나 잠겨 있으면 기억만 한다.
  A.play = safe(function (name) {
    if (BGM.indexOf(name) < 0) { warnOnce('곡 이름 ' + name, '알 수 없는 곡'); return false; }
    want = name;
    sync();
    return true;
  }, false);
  // 배경 음악 멈추기(부드럽게 줄여서)
  A.stop = safe(function () { want = null; sync(); return true; }, false);
  // 효과음('fire' | 'hit' | 'miss' | 'dud' | 'sunk'). 겹쳐 울려도 된다. 울리기 시작했으면 true.
  A.sfx = safe(function (name) {
    if (SFX.indexOf(name) < 0) { warnOnce('효과음 이름 ' + name, '알 수 없는 효과음'); return false; }
    if (!unlocked || !cfg.sfxOn || cfg.sfxVolume <= 0) return false;
    const file = fileOf('sfx', name);
    if (missing[file]) return false;
    const t0 = Date.now();
    load(file, false).then((snd) => {
      if (!snd || !cfg.sfxOn || Date.now() - t0 > SFX_LATE) return;
      try { playSfx(file, snd); } catch (e) { markMissing(file, e && e.message); }
    });
    return true;
  }, false);
  // 미리 불러 두기: preload('duel') 또는 preload('hit') — 잠기기 전에는 아무것도 하지 않는다
  A.preload = safe(function (...names) {
    if (!ctx) return false;
    for (const n of names) {
      if (BGM.indexOf(n) >= 0) load(fileOf('bgm', n), true);
      else if (SFX.indexOf(n) >= 0) load(fileOf('sfx', n), false);
    }
    return true;
  }, false);
  // 설정 한꺼번에: { bgmOn, bgmVolume(0~1), sfxOn, sfxVolume(0~1) } — 준 것만 바꾼다
  A.configure = safe(function (o) {
    if (!o || typeof o !== 'object') return A.state();
    if (typeof o.bgmOn === 'boolean') cfg.bgmOn = o.bgmOn;
    if (typeof o.sfxOn === 'boolean') cfg.sfxOn = o.sfxOn;
    if (typeof o.bgmVolume === 'number' && isFinite(o.bgmVolume)) cfg.bgmVolume = clamp01(o.bgmVolume);
    if (typeof o.sfxVolume === 'number' && isFinite(o.sfxVolume)) cfg.sfxVolume = clamp01(o.sfxVolume);
    applyVolumes();
    sync();
    return A.state();
  }, null);
  A.setBgmOn = (v) => A.configure({ bgmOn: !!v });
  A.setBgmVolume = (v) => A.configure({ bgmVolume: +v });
  A.setSfxOn = (v) => A.configure({ sfxOn: !!v });
  A.setSfxVolume = (v) => A.configure({ sfxVolume: +v });
  // 소리 파일 폴더 바꾸기(점검 페이지용). 끝에 / 를 붙인다.
  A.setBase = safe(function (b) {
    base = String(b || '').replace(/\/?$/, '/');
    for (const k in loads) delete loads[k];
    for (const k in missing) delete missing[k];
    bgmOrder.length = 0;
    return base;
  }, null);
  // 지금 상태 읽기(설정 화면·점검용)
  A.state = safe(function () {
    return {
      bgmOn: cfg.bgmOn, bgmVolume: cfg.bgmVolume, sfxOn: cfg.sfxOn, sfxVolume: cfg.sfxVolume,
      unlocked, backend: backend(), ctxState: ctx ? ctx.state : null,
      track: want,                                             // 화면이 원하는 곡
      playing: cur && !cur.dead && !cur.blocked && !cur.ended ? cur.name : null, // 실제로 틀어 둔 곡
      bgmMode: cur ? cur.kind : null,                          // 'buffer'(웹 오디오 반복) | 'element'(<audio loop>)
      loading: pending, fading: fading.size,
      sfxVoices, sfxPlayed, bgmStarts,
      missing: Object.keys(missing), base,
    };
  }, null);

  // 첫 터치에서 저절로 unlock(웹 오디오가 실제로 돌기 시작하면 듣기를 그만둔다)
  if (typeof window !== 'undefined' && window.addEventListener) {
    const evs = ['pointerdown', 'keydown', 'touchend'];
    const onFirst = safe(function () {
      A.unlock();
      if (!ctx || ctx.state === 'running') evs.forEach((ev) => window.removeEventListener(ev, onFirst, true));
    });
    evs.forEach((ev) => window.addEventListener(ev, onFirst, true));
  }
})();
