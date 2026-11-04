// 입력: 키보드 + 멀티터치 버튼 → 방향(-1/0/+1)
// 여러 개가 눌려 있으면 "가장 최근에 누르거나 미끄러져 들어온 쪽"이 이긴다 (엄지 굴리기로 빠른 방향 전환)
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  SF.createDirTracker = function () {
    const active = new Map(); // id → { dir, t }
    return {
      press(id, dir, t) { active.set(id, { dir, t }); },
      move(id, dir, t) {
        const a = active.get(id);
        if (a && a.dir !== dir) { a.dir = dir; a.t = t; }
      },
      release(id) { active.delete(id); },
      clear() { active.clear(); },
      getDir() {
        let best = null;
        for (const a of active.values()) if (!best || a.t > best.t) best = a;
        return best ? best.dir : 0;
      },
      activeDirs() {
        const s = new Set();
        for (const a of active.values()) s.add(a.dir);
        return s;
      },
    };
  };

  const KEYS = { ArrowLeft: -1, KeyA: -1, ArrowRight: +1, KeyD: +1 };

  // els: { controls, leftBtn, rightBtn }. onPress(dir)는 새로 누를 때마다 호출 (게임 시작 신호 등)
  SF.bindInput = function (tracker, els, onPress) {
    const now = () => performance.now();
    const refresh = () => {
      const ds = tracker.activeDirs();
      els.leftBtn.classList.toggle('pressed', ds.has(-1));
      els.rightBtn.classList.toggle('pressed', ds.has(+1));
    };
    const pressed = (dir) => { if (onPress) onPress(dir); refresh(); };

    const typing = (e) => e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    window.addEventListener('keydown', (e) => {
      const d = KEYS[e.code];
      if (!d || typing(e)) return;
      e.preventDefault();
      if (e.repeat) return;
      tracker.press('k:' + e.code, d, now());
      pressed(d);
    });
    window.addEventListener('keyup', (e) => {
      if (!KEYS[e.code]) return;
      tracker.release('k:' + e.code);
      refresh();
    });

    // 버튼 패널 전체가 터치 영역: 가운데 기준 왼쪽 절반 ◀, 오른쪽 절반 ▶
    const panel = els.controls;
    const dirAt = (clientX) => {
      const r = panel.getBoundingClientRect();
      return clientX < r.left + r.width / 2 ? -1 : +1;
    };
    panel.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { panel.setPointerCapture(e.pointerId); } catch (_) { /* 일부 브라우저 */ }
      const d = dirAt(e.clientX);
      tracker.press('p:' + e.pointerId, d, now());
      pressed(d);
    });
    panel.addEventListener('pointermove', (e) => {
      tracker.move('p:' + e.pointerId, dirAt(e.clientX), now());
      refresh();
    });
    const end = (e) => { tracker.release('p:' + e.pointerId); refresh(); };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => panel.addEventListener(t, end));
    panel.addEventListener('contextmenu', (e) => e.preventDefault());

    // 다른 앱으로 넘어가면 눌린 버튼을 모두 놓는다 (버튼이 눌린 채 남지 않게)
    const releaseAll = () => { tracker.clear(); refresh(); };
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  };
})(window.SF);
