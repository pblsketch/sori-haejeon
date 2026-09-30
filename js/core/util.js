'use strict';
// 모든 스크립트가 함께 쓰는 전역 이름 G와 작은 도구들. 가장 먼저 불러온다.
//   작업마다 이름 하나씩: G.rules, G.text, G.mouth, G.audio, G.save, G.board, G.controls, G.practice, G.duel, G.app
window.G = window.G || {};

// 점검용 오류 모음: 페이지에서 난 오류를 window.__soriErrors에 모아 둔다(점검 도구가 읽음).
(function () {
  const errs = (window.__soriErrors = window.__soriErrors || []);
  window.addEventListener('error', (e) => errs.push(String(e.message || e)));
  window.addEventListener('unhandledrejection', (e) => errs.push('rejection: ' + String((e.reason && e.reason.message) || e.reason)));
  const ce = console.error.bind(console);
  console.error = function (...a) { errs.push(a.map(String).join(' ')); return ce(...a); };
})();

G.util = {
  // 요소 만들기: el('div', { class: 'x', onclick: fn, 'aria-label': '…' }, [자식 또는 글])
  el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    if (children != null) (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return n;
  },
  svg(tag, attrs) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    return n;
  },
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  // 벡터 기호(글꼴에 기대지 않음): glyph('hit', 'sb-badge') → <svg class="sb-badge" data-glyph="hit">
  //   신호 기호 = hit 과녁 · h 가로줄 ↔ · v 세로줄 ↕ · hv 가로·세로 둘 다 · cell 같은 칸(겹친 네모) · eq 같은 줄(어느 줄인지 비공개)
  //              · miss × · dud ∅(없는 소리) / 그 밖 = lock 잠금(이번 단계에서 뺀 칸) · check 고름 표시
  glyph(name, cls) {
    const P = G.util.GLYPHS[name];
    const s = G.util.svg('svg', { class: cls || 'glyph', viewBox: '0 0 100 100', 'aria-hidden': 'true', focusable: 'false', 'data-glyph': name });
    s.innerHTML = P || '';
    return s;
  },
  lineDir(targets) {
    if (!targets || !targets.length) return 'eq';
    const k = new Set(targets.map((t) => (t.cell || t.pair ? 'cell' : t.place || t.column ? 'v' : 'h')));
    if (k.has('cell')) return 'cell';
    if (k.has('v') && k.has('h')) return 'hv';
    return k.has('v') ? 'v' : 'h';
  },
  GLYPHS: (function () {
    const ln = (d, w) => '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="' + (w || 11) + '" stroke-linecap="round" stroke-linejoin="round"/>';
    const H = 'M10 50H90M10 50l17-15M10 50l17 15M90 50l-17-15M90 50l-17 15';
    const V = 'M50 10V90M50 10L35 27M50 10l15 17M50 90L35 73M50 90l15-17';
    return {
      hit: '<circle cx="50" cy="50" r="39" fill="none" stroke="currentColor" stroke-width="10"/><circle cx="50" cy="50" r="21" fill="none" stroke="currentColor" stroke-width="10"/><circle cx="50" cy="50" r="6" fill="currentColor"/>',
      h: ln(H), v: ln(V), hv: ln(H, 10) + ln(V, 10),
      cell: '<rect x="8" y="8" width="54" height="54" rx="8" fill="none" stroke="currentColor" stroke-width="9"/><rect x="38" y="38" width="54" height="54" rx="8" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="9"/>',
      eq: ln('M18 36H82M18 64H82', 12),
      miss: ln('M22 22L78 78M78 22L22 78', 12),
      dud: '<circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" stroke-width="9"/>' + ln('M80 14L20 86', 9),
      lock: '<rect x="20" y="44" width="60" height="44" rx="9" fill="currentColor"/>' + ln('M33 44V33a17 17 0 0 1 34 0v11', 9),
      check: ln('M18 52l20 20 44-46', 13),
      up: ln('M18 64L50 32l32 32', 13),
      down: ln('M18 36L50 68l32-32', 13),
    };
  })(),
  // 움직임 줄이기: 설정 또는 기기 설정
  reducedMotion() {
    return document.documentElement.classList.contains('reduce-motion') ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  },
};
