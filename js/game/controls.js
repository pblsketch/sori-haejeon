'use strict';
// 조작부와 신호 기록장 G.controls (연습·대결 공용, spec 4 · 5.1 · 6.2 · 6.3)
//   불러오는 순서: js/core/util.js → js/data/* (text.js 포함) → js/core/rules.js → 이 파일. 모양은 css/controls.css.
//   입안 단면도는 그리지 않는다. 자리(자음) · 혀의 자리(모음)는 단면도(G.mouth)가 고른 값을 setPlace로 받는다.
//   세기 카드 흐림 · 발사 단추 켜짐은 G.rules.controls(단계, 고른 것)만 따른다(여기서 규칙을 다시 만들지 않는다).
//   없는 조합(목청 + 파열, 잇몸 + 마찰 + 거센, 앞·낮은·둥근 입술 …)도 막지 않는다 → 발사하면 onFire가 불린다.
//
// ── 쓰는 법 ─────────────────────────────────────────────────────────────
//   const ctl = G.controls.create(container, {
//     levelConfig,             // G.rules.level(바다, 단계) — 필수. 바다·세기 카드 유무·'따라 해 보기' 여부를 여기서 읽는다
//     sea,                     // (생략 가능) levelConfig.sea와 같아야 한다
//     grade: 'm3' | 'h1',      // 카드 이름(G.text.short)
//     mode: 'practice'|'duel', // 대결이면 문구 자리의 기본 줄이 "소리 내어 외치고 발사!"
//     onFire(input),           // 발사: 자음 { place, manner, strength|null } / 모음 { backness, height, lips } → G.rules.resolveShot에 그대로
//     onChange(selection, state), // 고른 것이 바뀔 때마다. state = G.rules.controls 결과
//     logContainer,            // (생략 가능) 신호 기록장을 넣을 곳. 없으면 조작부 안에 둔다
//     layout: 'auto'|'landscape'|'portrait', // 기본 'auto' = base.css와 같은 기준 (max-width: 760px), (orientation: portrait)
//   });
//   ctl.setPlace(id)       자음: 위치 id('velar' …) / 모음: 혀의 자리 'front-high'('앞뒤-높이', 순서 무관) 또는 { backness, height }. null이면 지움
//   ctl.reset()            한 발 뒤: 고른 것을 모두 지우고 잠금을 푼다(문구 자리의 신호 줄은 그대로 둔다)
//   ctl.setMessage(text)   한 줄 문구(발사 뒤 신호 줄 등). 학생이 다음에 무언가 고를 때까지 머문다. null이면 기본 줄로
//   ctl.showFollow(id)     '따라 해 보기' 한 줄을 그 소리로 띄운다(풀이 예시 등 직접 띄울 때). null이면 기본 줄로
//   ctl.setEnabled(bool)   애니메이션 중·상대 팀 차례에는 false(카드·발사 모두 잠김). 발사하면 스스로 잠기고 reset()이나 setEnabled(true)로 풀린다
//   ctl.log(entry)         신호 기록장에 한 줄 더하기. entry = G.rules의 Shot/resolveShot 결과({ sound, input, kind }) + (대결) team
//   ctl.setLog(entries)    기록장 통째로 다시 쓰기(이어서 하기) · ctl.clearLog()
//   ctl.setLayout(v)       'landscape' | 'portrait' | 'auto'
//   ctl.getSelection() / ctl.getState() / ctl.setSelection(sel) / ctl.fire()   (풀이 예시·점검용)
//   ctl.el                 조작부 뿌리 요소 · ctl.destroy()
//
// ── 한 줄 문구 자리(spec 4: 설명은 언제나 한 줄) ─────────────────────────
//   우선순위: setMessage/showFollow로 받은 줄 → (고르는 중) '따라 해 보기' → 기본 줄
//   '따라 해 보기': levelConfig.help.followAlong이 켜진 단계에서, 쏠 수 있게 고른 뒤(자음 자리 + 방법, 모음 혀 자리 + 입술)
//                  그 조합이 국어에 있는 소리일 때만. 없는 조합이면 중립 안내("준비됐으면 발사!")만 — 없다는 암시를 주지 않는다.
//   기본 줄: 연습 = 다음에 고를 것 안내(TEXT.prompt) / 대결 = "소리 내어 외치고 발사!"
//   넘치면 글씨를 줄이고(최소 12px) 그래도 넘치면 말줄임 — 줄바꿈은 하지 않는다.
//
// ── 배치 ────────────────────────────────────────────────────────────────
//   가로: 아래 가운데 한 줄 [방법 카드 5][세기 카드 3 또는 입술 카드 2][발사], 터치 목표 64px 이상.
//   세로(휴대폰): 두 줄 — 방법 카드 / 세기·입술 카드 + 발사 + 기록장 단추, 48px 이상. 신호 기록장은 접어 두고 단추로 편다.
window.G = window.G || {};
G.controls = (function () {
  const el = (...a) => G.util.el(...a);
  const T = () => window.TEXT;
  const PORTRAIT_MQ = '(max-width: 760px), (orientation: portrait)'; // css/base.css의 --touch 48px 기준과 같다
  const MIN_FONT = 12;

  function create(container, opts) {
    opts = opts || {};
    const lv = opts.levelConfig;
    if (!lv) throw new Error('G.controls.create: levelConfig가 없음');
    const sea = opts.sea || lv.sea;
    if (sea !== lv.sea) throw new Error('G.controls.create: sea와 levelConfig.sea가 다름');
    const grade = opts.grade === 'h1' ? 'h1' : 'm3';
    const mode = opts.mode === 'duel' ? 'duel' : 'practice';
    const S = window.SOUNDS;
    const vowel = sea === 'vowel';
    const hasStrength = !vowel && !!lv.strengthCards;

    // ── 상태 ──
    let sel = vowel ? { backness: null, height: null, lips: null } : { place: null, manner: null, strength: null };
    let enabled = true;
    let locked = false;        // 발사 뒤 잠김
    let override = null;       // { kind: 'text'|'follow', text, sound }
    let layoutPref = opts.layout || 'auto';
    let logOpen = false;
    let entries = [];
    const mq = window.matchMedia ? window.matchMedia(PORTRAIT_MQ) : null;

    // ── 요소 ──
    const msgText = el('span', { class: 'ctl-msg-text' });
    const msgLabel = el('span', { class: 'ctl-msg-label' }, T().followLabel);
    const msg = el('div', { class: 'ctl-msg', role: 'status', 'aria-live': 'polite' }, [msgLabel, msgText]);

    const mkCard = (group, id) => el('button', {
      type: 'button', class: 'ctl-card', 'data-group': group, 'data-id': id, 'aria-pressed': 'false',
      onclick: () => pick(group, id),
    }, el('span', { class: 'ctl-card-name' }, G.text.short(grade, group, id)));

    const groups = [];
    let mannerCards = [], secondCards = [];
    if (!vowel) {
      mannerCards = S.manners.map((m) => mkCard('manner', m));
      groups.push(el('div', { class: 'ctl-group ctl-group--manner', role: 'group', 'aria-label': G.text.short(grade, 'axis', 'manner') }, [
        el('span', { class: 'ctl-group-label' }, G.text.short(grade, 'axis', 'manner')),
        el('div', { class: 'ctl-cards' }, mannerCards),
      ]));
    }
    if (hasStrength || vowel) {
      const g = vowel ? 'lips' : 'strength';
      secondCards = (vowel ? S.lips : S.strengths).map((id) => mkCard(g, id));
      groups.push(el('div', { class: 'ctl-group ctl-group--' + g, role: 'group', 'aria-label': G.text.short(grade, 'axis', g) }, [
        el('span', { class: 'ctl-group-label' }, G.text.short(grade, 'axis', g)),
        el('div', { class: 'ctl-cards' }, secondCards),
      ]));
    }
    const fireBtn = el('button', { type: 'button', class: 'ctl-fire', disabled: true, onclick: () => fire() }, T().ui.play.fire);
    const logCount = el('span', { class: 'ctl-logtoggle-count' }, '0');
    const logToggle = el('button', {
      type: 'button', class: 'ctl-logtoggle', 'aria-expanded': 'false', 'aria-label': T().ui.play.logOpen,
      onclick: () => setLogOpen(!logOpen),
    }, [el('span', { class: 'ctl-logtoggle-name' }, T().ui.play.log), logCount]);
    const bar = el('div', { class: 'ctl-bar' }, groups.concat([fireBtn, logToggle]));

    const logList = el('ol', { class: 'ctl-log-list' });
    const logClose = el('button', { type: 'button', class: 'ctl-log-close', onclick: () => setLogOpen(false) }, T().ui.play.logClose);
    const logPanel = el('section', { class: 'ctl-log', 'aria-label': T().ui.play.log }, [
      el('div', { class: 'ctl-log-head' }, [el('span', { class: 'ctl-log-title' }, T().ui.play.log), logClose]),
      logList,
    ]);
    const root = el('div', { class: 'ctl ctl--' + sea + ' ctl--' + mode + (hasStrength ? ' ctl--strength' : '') }, [msg, bar]);
    const inRootLog = !opts.logContainer;
    if (inRootLog) { root.insertBefore(logPanel, msg); root.classList.add('ctl--log-inside'); }
    else opts.logContainer.appendChild(logPanel);
    container.appendChild(root);

    // ── 고르기 ──
    function state() { return G.rules.controls(lv, sel); }
    function changed() {
      override = null; // 학생이 새로 고르면 지난 신호 줄은 물러난다
      render();
      if (typeof opts.onChange === 'function') opts.onChange(getSelection(), state());
    }
    function pick(group, id) {
      if (!enabled || locked) return;
      if (group === 'strength' && state().strengthDisabled) return;
      sel[group] = id;
      changed();
    }
    function parseTongue(v) {
      if (v == null) return { backness: null, height: null };
      if (typeof v === 'object') return { backness: v.backness || null, height: v.height || null };
      const out = { backness: null, height: null };
      String(v).split(/[-_/ ]/).forEach((t) => {
        if (S.backs.indexOf(t) >= 0) out.backness = t;
        if (S.heights.indexOf(t) >= 0) out.height = t;
      });
      if (!out.backness || !out.height) throw new Error('모르는 혀의 자리: ' + v);
      return out;
    }
    function setPlace(id) {
      if (vowel) Object.assign(sel, parseTongue(id));
      else {
        if (id != null && S.places.indexOf(id) < 0) throw new Error('모르는 자리: ' + id);
        sel.place = id == null ? null : id;
      }
      changed();
    }
    function setSelection(s) {
      s = s || {};
      if (vowel) sel = { backness: s.backness || null, height: s.height || null, lips: s.lips || null };
      else sel = { place: s.place || null, manner: s.manner || null, strength: s.strength || null };
      changed();
    }
    function getSelection() { return Object.assign({}, sel); }
    // 발사할 조합(G.rules.resolveShot이 받는 모양). 세기 카드가 없거나 흐리면 strength = null
    function inputNow() {
      if (vowel) return { backness: sel.backness, height: sel.height, lips: sel.lips };
      const st = state();
      return { place: sel.place, manner: sel.manner, strength: st.strengthCards && !st.strengthDisabled ? sel.strength : null };
    }
    function fire() {
      if (!enabled || locked || !state().fireEnabled) return false;
      locked = true;
      render();
      if (typeof opts.onFire === 'function') opts.onFire(inputNow());
      return true;
    }
    function reset() {
      sel = vowel ? { backness: null, height: null, lips: null } : { place: null, manner: null, strength: null };
      locked = false;
      render();
    }
    function setEnabled(v) {
      enabled = !!v;
      if (enabled) locked = false;
      render();
    }

    // ── 한 줄 문구 ──
    function soundNow() {
      if (!state().fireEnabled) return null;
      try { return G.rules.compose(lv, inputNow()).sound; } catch (e) { return null; }
    }
    function defaultLine() {
      const P = T().prompt;
      const st = state();
      const follow = lv.help && lv.help.followAlong;
      if (st.fireEnabled && follow) {
        const s = soundNow();
        if (s && G.text.follow(s)) return { follow: true, text: G.text.follow(s) };
      }
      if (mode === 'duel') return { text: T().duel.shout };
      if (vowel) {
        if (!sel.backness || !sel.height) return { text: P.tongue };
        if (!sel.lips) return { text: P.lips };
        return { text: P.ready };
      }
      if (!sel.place) return { text: P.place };
      if (!sel.manner) return { text: P.manner };
      if (!st.fireEnabled) return { text: P.strength };
      return { text: P.ready };
    }
    function renderMsg() {
      let line;
      if (override && override.kind === 'follow') line = { follow: true, text: G.text.follow(override.sound) };
      else if (override) line = { text: override.text };
      else line = defaultLine();
      msgText.textContent = line.text || '';
      msg.classList.toggle('ctl-msg--follow', !!line.follow);
      msg.setAttribute('data-kind', line.follow ? 'follow' : override ? 'message' : mode === 'duel' ? 'shout' : 'prompt');
      fitMsg();
    }
    // 한 줄에 들어가게 글씨를 줄인다(최소 MIN_FONT). 그래도 넘치면 CSS 말줄임.
    function fitMsg() {
      msg.style.fontSize = '';
      if (!msg.isConnected || !msg.clientWidth) return;
      let size = parseFloat(getComputedStyle(msg).fontSize) || 18;
      let guard = 40;
      while (msg.scrollWidth > msg.clientWidth + 1 && size > MIN_FONT && guard--) {
        size -= 1;
        msg.style.fontSize = size + 'px';
      }
    }
    function setMessage(text) {
      override = text == null || text === '' ? null : { kind: 'text', text: String(text) };
      renderMsg();
    }
    function showFollow(id) {
      override = id && G.text.follow(id) ? { kind: 'follow', sound: id } : null;
      renderMsg();
    }

    // ── 그리기 ──
    function render() {
      const st = state();
      const off = !enabled || locked;
      mannerCards.concat(secondCards).forEach((b) => {
        const g = b.getAttribute('data-group');
        const dim = g === 'strength' && st.strengthDisabled;
        const on = !dim && sel[g] === b.getAttribute('data-id');
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.classList.toggle('is-on', on);
        b.classList.toggle('is-dim', dim);
        b.disabled = off || dim;
      });
      fireBtn.disabled = off || !st.fireEnabled;
      fireBtn.classList.toggle('is-ready', !off && st.fireEnabled);
      root.classList.toggle('is-disabled', !enabled);
      renderMsg();
    }

    // ── 신호 기록장 ──
    function comboLabel(input) {
      input = input || {};
      if (vowel) return [G.text.short(grade, 'backness', input.backness), G.text.short(grade, 'height', input.height), G.text.short(grade, 'lips', input.lips)].filter(Boolean).join('+');
      return [G.text.short(grade, 'place', input.place), G.text.short(grade, 'manner', input.manner), input.strength ? G.text.short(grade, 'strength', input.strength) : '']
        .filter(Boolean).join('+');
    }
    function entryNode(e, i) {
      const kind = e.kind || '';
      const what = e.sound ? G.text.sound(e.sound) : comboLabel(e.input);
      const sig = G.text.signalName(kind) || G.text.signal(kind);
      const team = e.team && T().teams[e.team] ? T().teams[e.team] : '';
      return el('li', { class: 'ctl-log-item k-' + kind + (e.team ? ' t-' + e.team : ''), 'data-kind': kind }, [
        el('span', { class: 'ctl-log-n' }, String(i + 1)),
        team ? el('span', { class: 'ctl-log-team' }, team) : null,
        el('span', { class: 'ctl-log-what' + (e.sound ? ' is-sound' : ' is-combo') }, what),
        el('span', { class: 'ctl-log-sig' }, sig),
      ]);
    }
    function renderLog() {
      logList.textContent = '';
      entries.forEach((e, i) => logList.appendChild(entryNode(e, i)));
      logCount.textContent = String(entries.length);
      logList.scrollTop = logList.scrollHeight;
      logList.scrollLeft = logList.scrollWidth;
    }
    function log(entry) { if (entry) { entries.push(entry); renderLog(); } }
    function setLog(list) { entries = Array.isArray(list) ? list.slice() : []; renderLog(); }
    function clearLog() { setLog([]); }
    function setLogOpen(v) {
      logOpen = !!v;
      root.classList.toggle('is-log-open', logOpen);
      logPanel.classList.toggle('is-open', logOpen);
      logToggle.setAttribute('aria-expanded', logOpen ? 'true' : 'false');
      logToggle.setAttribute('aria-label', logOpen ? T().ui.play.logClose : T().ui.play.logOpen);
      if (logOpen) renderLog();
    }

    // ── 배치 ──
    function currentLayout() {
      if (layoutPref === 'landscape' || layoutPref === 'portrait') return layoutPref;
      return mq && mq.matches ? 'portrait' : 'landscape';
    }
    function applyLayout() {
      const lay = currentLayout();
      root.classList.toggle('ctl--portrait', lay === 'portrait');
      root.classList.toggle('ctl--landscape', lay === 'landscape');
      logPanel.classList.toggle('ctl-log--portrait', lay === 'portrait');
      logPanel.classList.toggle('ctl-log--strip', lay === 'landscape' && inRootLog);
      if (lay === 'landscape' && logOpen) setLogOpen(false);
      fitMsg();
    }
    function setLayout(v) { layoutPref = v === 'landscape' || v === 'portrait' ? v : 'auto'; applyLayout(); }
    const onMq = () => applyLayout();
    if (mq) (mq.addEventListener ? mq.addEventListener('change', onMq) : mq.addListener(onMq));
    const ro = window.ResizeObserver ? new ResizeObserver(() => fitMsg()) : null;
    if (ro) ro.observe(msg);
    const onResize = () => fitMsg();
    if (!ro) window.addEventListener('resize', onResize);

    function destroy() {
      if (mq) (mq.removeEventListener ? mq.removeEventListener('change', onMq) : mq.removeListener(onMq));
      if (ro) ro.disconnect(); else window.removeEventListener('resize', onResize);
      if (root.parentNode) root.parentNode.removeChild(root);
      if (logPanel.parentNode) logPanel.parentNode.removeChild(logPanel);
    }

    applyLayout();
    render();

    return {
      el: root, logEl: logPanel,
      setPlace, reset, setMessage, showFollow, setEnabled, log, setLog, clearLog, setLayout,
      getSelection, getState: state, setSelection, fire, destroy,
      layout: currentLayout,
    };
  }

  return { create };
})();
