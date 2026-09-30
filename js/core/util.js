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
  // 움직임 줄이기: 설정 또는 기기 설정
  reducedMotion() {
    return document.documentElement.classList.contains('reduce-motion') ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  },
};
