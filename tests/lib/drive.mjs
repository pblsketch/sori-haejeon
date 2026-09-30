// 진짜 index.html을 크기별 틀(tests/pages/frame.html) 안에 띄우고 학생처럼 누르는 운전 도구(aside 점검 공용).
//   check-play.mjs · check-shots.mjs · check-screen-text.mjs가 쓴다.
//
//   aside 대본 안에서:
//     const t = await openTab(frame(1920, 1080, 'index.html'));
//     await t.evaluate(() => frameReady);
//     await t.evaluate(() => { ${DRIVER} });          ← 틀 페이지(바깥 창)에 window.D를 만든다
//     await t.evaluate(async () => { await D.fresh(); … return D.take(); });
//   D는 바깥 창에 있으므로 틀 안 게임을 새로고침해도(D.reload) 남는다. 게임 창은 늘 D.w()로 새로 얻는다.
//
//   누르기는 모두 진짜 조작부로 한다: 카드·단추는 가운데 좌표에 다른 것이 덮여 있지 않은지(elementFromPoint) 확인한 뒤 누른다
//   (입안 단면도는 보여 주기 전용이라 누르지 않는다). 대결의 동시 발사는 서로 다른
//   pointerId의 pointerdown/pointerup을 두 팀 발사 단추에 엇갈려 보낸다(여러 손가락).
//   숨은 함대는 점검 도구만 G.practice.debug() / G.duel.current.debug.state()에서 읽는다(화면에는 드러나지 않음).
//
//   CDP 한 번의 evaluate는 30초 안에 끝나야 한다 → 긴 판은 D.prRun(예산 ms)처럼 조각으로 나눠 부른다.
export const DRIVER = String.raw`
if (!window.D) {
  const D = (window.D = {});
  D.errs = [];
  D.bad = (m) => { D.errs.push(String(m)); };
  D.take = () => { D.noErr(); const e = D.errs.slice(); D.errs.length = 0; return e; };
  D.w = () => frameWin();
  D.d = () => frameWin().document;
  D.G = () => frameWin().G;
  D.T = () => frameWin().TEXT;
  D.$ = (s, r) => (r || D.d()).querySelector(s);
  D.$$ = (s, r) => Array.from((r || D.d()).querySelectorAll(s));
  D.wait = (ms) => new Promise((res) => setTimeout(res, ms));
  D.until = async (fn, ms, what) => {
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 10000)) { try { if (fn()) return true; } catch (e) { /* 넘어가는 중 */ } await D.wait(40); }
    D.bad('기다려도 안 됨: ' + what); return false;
  };
  D.box = (n) => n.getBoundingClientRect();
  D.visible = (n) => {
    if (!n || !n.getClientRects || !n.getClientRects().length) return false;
    const cs = D.w().getComputedStyle(n);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    const b = D.box(n);
    return b.width > 0 && b.height > 0;
  };
  // 게임 창의 페이지 오류(js/core/util.js가 모음). 새로고침하면 새 창이라 다시 0부터 센다
  D.errSeen = 0;
  D.noErr = (tag) => {
    const w = D.w();
    const e = (w && w.__soriErrors) || ['오류 모음 없음(js/core/util.js가 안 불림)'];
    if (w && w.__soriErrWin !== true) { w.__soriErrWin = true; D.errSeen = 0; }
    if (e.length > D.errSeen) { D.bad('페이지 오류' + (tag ? '(' + tag + ')' : '') + ': ' + e.slice(D.errSeen).join(' | ')); D.errSeen = e.length; }
  };
  D.cur = () => D.G().app.current();
  // 이 게임의 저장 값만 지운다(같은 주소의 다른 점검 값은 건드리지 않음)
  D.clearStore = () => {
    try { Object.keys(localStorage).filter((k) => k.indexOf('sori-haejeon:') === 0).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* 막힘 */ }
  };
  // 틀 안 게임을 새로고침(진짜 location.reload) → 새 게임 창이 시작 화면을 열 때까지
  D.reload = async () => {
    D.noErr('새로고침 전');
    const w = D.w();
    w.__old = true;
    w.location.reload();
    await D.until(() => { const x = D.w(); return x && !x.__old && x.document.readyState !== 'loading' && x.G && x.G.app && x.G.app.current(); }, 12000, '새로고침 뒤 첫 화면');
    D.errSeen = 0;
    await D.wait(250);
  };
  // 저장 값을 모두 지우고 새로 연다(판마다 처음 쓰는 기기처럼)
  D.fresh = async () => { D.clearStore(); await D.reload(); };
  D.resize = async (w, h) => {
    const f = document.getElementById('game');
    f.style.width = w + 'px'; f.style.height = h + 'px';
    dispatchEvent(new Event('resize'));
    await D.wait(350);
  };

  // ── 누르기 ──
  // 누르는 곳의 가운데 좌표에 그 요소가 맨 위에 있는지, 게임 화면 안인지 확인한다
  D.tapPoint = (n, what) => {
    const b = D.box(n); const x = b.left + b.width / 2, y = b.top + b.height / 2;
    const w = D.w(), d = D.d();
    if (x < 0 || y < 0 || x > w.innerWidth || y > w.innerHeight) D.bad(what + ': 화면 밖(' + Math.round(x) + ',' + Math.round(y) + ') — 스크롤해야 누를 수 있음');
    const hit = d.elementFromPoint(x, y);
    const svgHost = n.ownerSVGElement;
    const ok = hit && (hit === n || n.contains(hit) || (svgHost && (svgHost === hit || svgHost.contains(hit))));
    if (!ok) D.bad(what + ': 가운데를 누르면 다른 것이 눌림(' + (hit ? (hit.className && hit.className.baseVal != null ? hit.className.baseVal : hit.className) : 'null') + ')');
    return { x, y };
  };
  D.tap = (n, what) => {
    if (!n) { D.bad('없음: ' + what); return false; }
    if (!D.visible(n)) { D.bad('안 보임: ' + what); return false; }
    if (n.disabled) { D.bad('꺼져 있음: ' + what); return false; }
    // 결과·소리 지도·설정·출처처럼 읽는 화면은 휴대폰에서 스크롤해도 된다(학생이 내려서 누름). 판 화면은 스크롤 없이 눌려야 한다
    if (['result', 'soundmap', 'settings', 'credits'].indexOf(D.cur()) >= 0) {
      const b = D.box(n);
      if (b.top < 0 || b.bottom > D.w().innerHeight) { n.scrollIntoView({ block: 'center' }); }
    }
    D.tapPoint(n, what);
    n.click();
    return true;
  };
  D.tapSel = (sel, what) => D.tap(D.$(sel), what || sel);
  D.msgOf = (root) => { const m = D.$('.ctl-msg-text', root); return m ? m.textContent : ''; };

  // ── 조작부(연습·대결 공용, root = 그 자리). 세 가지 모두 아래 조작부의 카드로 고른다(spec 5.1). 단면도는 보여 주기 전용 ──
  D.card = (g, id, root) => D.$('.ctl-card[data-group="' + g + '"][data-id="' + id + '"]', root);
  // 소리 빚기: 자음 { place, manner, strength } → ① 자리 ② 방법 ③ 세기 / 모음 { backness, height, lips } → ① 높이 ② 앞뒤 ③ 입술
  D.compose = (input, root, what) => {
    what = what || JSON.stringify(input);
    if (input.backness) {
      D.tap(D.card('height', input.height, root), '높이 카드 ' + what);
      D.tap(D.card('backness', input.backness, root), '앞뒤 카드 ' + what);
      D.tap(D.card('lips', input.lips, root), '입술 카드 ' + what);
    } else {
      D.tap(D.card('place', input.place, root), '자리 카드 ' + what);
      D.tap(D.card('manner', input.manner, root), '방법 카드 ' + what);
      const sc = D.card('strength', input.strength, root);
      if (input.strength && sc && !sc.disabled) D.tap(sc, '세기 카드 ' + what);
    }
  };
  D.inp = (x) => (typeof x === 'string' ? D.G().rules.inputOf(x) : x);
  D.label = (x) => (typeof x === 'string' ? '/' + x + '/' : JSON.stringify(x));

  // ── 시작 화면 ──
  D.goTitleBtn = (k) => D.tapSel('[data-go="' + k + '"]', '시작 화면 ' + k);

  // ── 연습 ──
  D.pr = () => D.G().practice.debug();
  D.prSt = () => D.pr().state;
  D.prShots = () => (D.prSt() ? D.prSt().teams.player.shots : []);
  D.prFleet = () => [].concat(...D.prSt().teams.enemy.fleet.map((s) => s.sounds));
  D.turnsLeft = () => +((D.$('.pr-turns-n') || {}).textContent || NaN);
  D.prChoose = (grade, sea, level) => {
    const o = (k, v) => D.$('.pr-opt[data-key="' + k + '"][data-val="' + v + '"]');
    D.tap(o('grade', grade), '학년 ' + grade);
    D.tap(o('sea', sea), '바다 ' + sea);
    D.tap(o('level', String(level)), '단계 ' + level);
    for (const [k, v] of [['grade', grade], ['sea', sea], ['level', String(level)]]) if (o(k, v).getAttribute('aria-pressed') !== 'true') D.bad('고른 단추가 눌린 모양이 아님 ' + k);
  };
  // 한 발(연습): 빚기 → 발사 → 끝날 때까지. 돌려줌: { msg, turns }
  D.prShoot = async (x) => {
    const input = D.inp(x), what = D.label(x);
    D.compose(input, null, what);
    const fb = D.$('.ctl-fire');
    if (!fb || fb.disabled) { D.bad('발사 단추가 꺼져 있음: ' + what); return null; }
    D.tap(fb, '발사 ' + what);
    if (!D.pr().busy && D.pr().view === 'play') D.bad('발사했는데 잠기지 않음: ' + what);
    await D.until(() => !D.pr().busy, 9000, '발사 끝 ' + what);
    return { msg: D.msgOf(), turns: D.turnsLeft() };
  };
  // 한 판의 계획: [{ x: 소리 또는 조합, expect: 'notInSea'|'already'|'none'|'hit'|'any' }]
  D.prPlan = (kind) => {
    const G = D.G(), st = D.prSt(), fleet = D.prFleet();
    const lv = G.rules.level(st.sea, st.level);
    const others = lv.open.filter((id) => fleet.indexOf(id) < 0);
    const F = fleet.map((x) => ({ x, expect: 'hit' }));
    if (kind === 'c1') return [
      { x: { place: 'glottal', manner: 'fricative', strength: null }, expect: 'notInSea' },
      { x: others[0], expect: 'lineOrMiss' },
      { x: others[0], expect: 'already' },
      { x: { place: 'palatal', manner: 'stop', strength: null }, expect: 'none' },
    ].concat(F);
    if (kind === 'c2') return [
      { x: { place: 'alveolar', manner: 'fricative', strength: 'aspirated' }, expect: 'none' },
      { x: others[0], expect: 'lineOrMiss' },
      { x: 'RELOAD' },
    ].concat(F);
    if (kind === 'c3') return [{ x: others[0], expect: 'lineOrMiss' }, { x: { place: 'glottal', manner: 'stop', strength: 'plain' }, expect: 'none' }].concat(F);
    if (kind === 'v1') return [{ x: { backness: 'front', height: 'low', lips: 'rounded' }, expect: 'none' }].concat(F);
    if (kind === 'v2') { // 턴 소진: 없는 소리 2 + 배 아닌 소리 4 + 배 칸 2 = 8턴, 배를 다 찾지 못함
      return [{ x: { backness: 'back', height: 'low', lips: 'rounded' }, expect: 'none' }, { x: { backness: 'front', height: 'low', lips: 'rounded' }, expect: 'none' }]
        .concat(others.slice(0, 4).map((x) => ({ x, expect: 'lineOrMiss' })), F.slice(0, 2));
    }
    return F;
  };
  // 계획을 예산(ms) 안에서 이어 쏜다. 돌려줌: 'reload'(새로고침할 차례) | 'end'(판이 끝남) | 'more'(예산이 다 됨)
  D.prRun = async (budget) => {
    const t0 = Date.now(), TX = D.T();
    while (D.plan && D.plan.length) {
      if (D.pr().view !== 'play') return 'end';
      if (Date.now() - t0 > (budget || 18000)) return 'more';
      const s = D.plan.shift();
      if (s.x === 'RELOAD') return 'reload';
      const before = D.turnsLeft();
      const r = await D.prShoot(s.x);
      if (!r) continue;
      D.shotLog.push(r.msg);
      const what = D.label(s.x);
      const free = s.expect === 'notInSea' || s.expect === 'already';
      if (free && r.turns !== before) D.bad('턴을 쓰지 않아야 하는데 씀: ' + what);
      if (!free && D.pr().view === 'play' && r.turns !== before - 1) D.bad('턴이 하나 줄지 않음: ' + what + ' ' + before + '→' + r.turns);
      const want = { notInSea: [TX.signal.notInSea], already: [TX.signal.already], none: [TX.signal.none], lineOrMiss: [TX.signal.line, TX.signal.miss] }[s.expect];
      if (want && D.pr().view === 'play' && want.indexOf(r.msg) < 0) D.bad('신호 줄이 다름(' + s.expect + '): ' + what + ' → ' + r.msg);
      if (s.expect === 'hit' && D.pr().view === 'play' && !(r.msg === TX.signal.hit || Object.values(TX.sunk).indexOf(r.msg) >= 0)) D.bad('명중 줄이 다름: ' + what + ' → ' + r.msg);
      D.noErr(what);
    }
    return D.pr().view === 'play' ? 'more' : 'end';
  };

  // ── 결과 화면 ──
  D.mapCount = (sea) => D.G().save.mapGames(sea);
  D.checkResult = (o) => {
    const TX = D.T();
    if (D.cur() !== 'result') { D.bad('결과 화면이 아님: ' + D.cur()); return; }
    const h = D.$('.app-res-headline');
    const want = o.duel ? TX.ui.result.winner[o.winner || 'draw'] : o.success ? TX.ui.play.allFound : TX.ui.result.notAll;
    if (!h || h.textContent !== want) D.bad('결과 제목: ' + (h && h.textContent) + ' ≠ ' + want);
    const maps = D.$$('.app-res-map .sb');
    if (maps.length !== (o.duel ? 2 : 1)) D.bad('결과 소리 지도 수 ' + maps.length);
    if (o.turns != null) {
      const dd = D.$('.app-res-stats dd[data-k="turns"]');
      const tw = D.G().text.fill(TX.ui.result.turnsN, { n: o.turns });
      if (!dd || dd.textContent !== tw) D.bad('결과의 쓴 턴: ' + (dd && dd.textContent) + ' ≠ ' + tw);
    }
    if (D.$$('.app-res-question').length !== 1) D.bad('생각해 볼 질문이 하나가 아님');
    if (D.G().save.hasGame()) D.bad('결과 화면인데 진행 판이 남아 있음');
  };

  // ── 대결 ──
  D.du = () => D.G().duel.current && D.G().duel.current.debug;
  D.duSt = () => D.du().state();
  D.station = (t) => D.$('.duel-station.station-' + t);
  D.duFleet = (t) => [].concat(...D.duSt().teams[t].fleet.map((s) => s.sounds)); // t 팀이 숨긴 배
  D.duOpt = (g, v) => D.$('.duel-opt[data-group="' + g + '"][data-value="' + v + '"]');
  D.duChoose = (o) => {
    D.tap(D.duOpt('grade', o.grade), '대결 학년');
    D.tap(D.duOpt('sea', o.sea), '대결 바다');
    D.tap(D.duOpt('level', String(o.level)), '대결 단계');
    D.tap(D.duOpt('hideTime', String(!!o.hideTime)), '숨기기 시간');
  };
  // 두 팀이 동시에: 각자 빚고, 서로 다른 손가락(pointerId)으로 발사 단추를 엇갈려 눌렀다 뗀다
  D.fireBoth = async (xb, xr) => {
    const W = D.w();
    const teams = [];
    if (xb != null) teams.push(['blue', D.inp(xb)]);
    if (xr != null) teams.push(['red', D.inp(xr)]);
    teams.forEach(([t, input]) => D.compose(input, D.station(t), t + ' ' + JSON.stringify(input)));
    const pts = teams.map(([t], i) => {
      const b = D.$('.ctl-fire', D.station(t));
      if (!b || b.disabled) { D.bad(t + ' 발사 단추가 꺼져 있음'); return null; }
      const p = D.tapPoint(b, t + ' 발사');
      return { t, b, p, id: 31 + i };
    }).filter(Boolean);
    const ev = (type, q) => q.b.dispatchEvent(new W.PointerEvent(type, { clientX: q.p.x, clientY: q.p.y, bubbles: true, cancelable: true, pointerId: q.id, isPrimary: q.id === 31, pointerType: 'touch' }));
    pts.forEach((q) => ev('pointerdown', q));   // 두 손가락이 함께 누름
    pts.forEach((q) => ev('pointerup', q));     // 차례로 뗌 → 두 팀 모두 발사
    pts.forEach((q) => { if (!D.du().busy(q.t) && D.du().phase() === 'play') D.bad(q.t + ' 발사가 안 됨(동시 누름)'); });
    await Promise.all(pts.map((q) => D.du().whenIdle(q.t)));
    await D.wait(60);
  };
  D.duShots = (t) => D.duSt().teams[t].shots.length;
  D.duMsg = (t) => D.msgOf(D.station(t));

  // ── 크기·배치 ──
  D.desc = (e) => {
    const c = e.className && e.className.baseVal != null ? e.className.baseVal : e.className;
    return (e.tagName || '').toLowerCase() + '.' + String(c || '').split(' ').filter(Boolean).slice(0, 2).join('.') + ' "' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 16) + '"';
  };
  // 보이는 누르는 것(단추·링크·입력)이 모두 min px 이상인지. 돌려줌: 잰 개수
  D.targets = (min, tag) => {
    const els = D.$$('button, [role="button"], a[href], input, select').filter((e) => D.visible(e) && !e.closest('[aria-hidden="true"], .app-rotate'));
    els.forEach((e) => {
      const b = D.box(e);
      if (Math.min(b.width, b.height) < min - 0.5) D.bad(tag + ': 터치 목표 ' + Math.round(b.width) + '×' + Math.round(b.height) + ' < ' + min + 'px — ' + D.desc(e));
    });
    return els.length;
  };
  // 가로 스크롤 없음(+ vertical이면 세로 스크롤도 없음: 판 화면은 한 화면 안)
  D.noScroll = (tag, vertical) => {
    const de = D.d().documentElement, b = D.d().body;
    const sw = Math.max(de.scrollWidth, b.scrollWidth);
    if (sw > de.clientWidth + 1) D.bad(tag + ': 가로 스크롤 ' + sw + ' > ' + de.clientWidth);
    if (vertical) {
      const sh = Math.max(de.scrollHeight, b.scrollHeight);
      if (sh > de.clientHeight + 1) D.bad(tag + ': 세로 스크롤 ' + sh + ' > ' + de.clientHeight);
      const pr = D.$('.pr'); if (pr && pr.scrollHeight > pr.clientHeight + 1) D.bad(tag + ': 화면 안 스크롤 ' + pr.scrollHeight + ' > ' + pr.clientHeight);
    }
  };
  D.inView = (n, tag) => {
    if (!n) { D.bad(tag + ': 없음'); return false; }
    const b = D.box(n), w = D.w();
    if (b.top < -0.5 || b.left < -0.5 || b.bottom > w.innerHeight + 0.5 || b.right > w.innerWidth + 0.5) { D.bad(tag + ': 화면 밖 ' + JSON.stringify([b.left, b.top, b.right, b.bottom].map(Math.round))); return false; }
    return true;
  };

  // ── 화면 문자열 ──
  // 보이는 글(글 노드 + aria-label·title)을 모은다. 숨은 요소·aria-hidden 안은 뺀다
  D.visibleText = () => {
    const d = D.d(), w = D.w(), out = [];
    const walk = d.createTreeWalker(d.body, 4);
    let n;
    while ((n = walk.nextNode())) {
      const s = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (!s) continue;
      const p = n.parentElement;
      if (!p || p.closest('script,style,[aria-hidden="true"]')) continue;
      const rects = p.getClientRects();
      if (!rects.length) continue;
      const cs = w.getComputedStyle(p);
      if (cs.visibility !== 'visible' || +cs.opacity === 0) continue;
      out.push(s);
    }
    D.$$('[aria-label],[title]').forEach((e) => {
      if (!e.getClientRects().length || e.closest('[aria-hidden="true"]')) return;
      ['aria-label', 'title'].forEach((a) => { const v = e.getAttribute(a); if (v) out.push(v.trim()); });
    });
    return out;
  };
  // 한 줄 문구 자리: 보이는 문구 자리와 각 자리의 줄 수
  //   줄 수 = 글이 차지한 줄 상자의 수(위치가 3px 넘게 다르면 다른 줄). 조작부 문구 자리는 본문(.ctl-msg-text)으로 센다
  D.lineCount = (n) => {
    if (!n || !n.textContent.trim()) return 0;
    const r = D.d().createRange(); r.selectNodeContents(n);
    const tops = Array.from(r.getClientRects()).filter((q) => q.width > 0.5 && q.height > 0.5).map((q) => q.top).sort((a, b) => a - b);
    let lines = 0, last = -1e9;
    tops.forEach((t) => { if (t - last > 3) { lines++; last = t; } });
    return lines;
  };
  D.msgSlots = () => D.$$('.ctl-msg, .duel-line, .app-notice.is-on').filter(D.visible).map((m) => {
    const body = m.classList.contains('ctl-msg') ? D.$('.ctl-msg-text', m) : m;
    return { cls: m.className, text: m.textContent.trim(), lines: D.lineCount(body) };
  });
}
`;
