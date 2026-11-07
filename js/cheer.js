// 1000층 정복 축하: 빵빠레 + 움짤 여러 개가 화면 여기저기서 겹치며 차례로 커지듯 나타나고, 꽃가루가 쏟아진다
// 움짤은 하나가 한 번 다 움직인 뒤(cfg.cheer.gap초) 다음 것이 겹쳐 나온다. 화면을 누르거나 다 나오고 holdSeconds초가 지나면 사라지고 결과(증명서) 화면이 보인다
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  // 움짤 자리 정하기: 네 귀퉁이부터 채우고(빈 곳이 없게) 가운데·옆으로. 나오는 순서는 섞고, 크기·기울기를 조금씩 다르게
  // rng.next()가 0~1을 주는 함수. 값은 화면 비율(0~1)
  const SLOTS = [[0.27, 0.2], [0.73, 0.2], [0.27, 0.8], [0.73, 0.8], [0.5, 0.5], [0.27, 0.5], [0.73, 0.5], [0.5, 0.2], [0.5, 0.8]];
  SF.cheerLayout = function (n, rng, opts) {
    const o = opts || {};
    const gap = o.gap || 1.6; // 하나씩 나오는 간격(초): 앞의 움짤이 한 번 다 움직인 뒤에 다음 것이 겹쳐 나온다
    const slots = Array.from({ length: n }, (_, i) => SLOTS[i % SLOTS.length]);
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    return order.map((slot, k) => {
      const [cx, cy] = slots[slot];
      return {
        x: Math.min(0.92, Math.max(0.08, cx + (rng.next() - 0.5) * 0.08)),
        y: Math.min(0.88, Math.max(0.12, cy + (rng.next() - 0.5) * 0.06)),
        size: 0.5 + rng.next() * 0.12,      // 화면 가로의 비율 → 옆 것과 조금씩 겹친다
        rot: (rng.next() - 0.5) * 16,
        delay: 0.4 + k * gap,
        z: k + 1,
      };
    });
  };

  SF.createCheer = function (root, cfg, sound) {
    const C = cfg.cheer || {};
    const files = C.files || [];
    let timer = null;
    let onDone = null;
    // 축하 노래 (빵빠레와 같이). 소리를 켜 둔 기기에서만, 축하가 끝나면 멈춘다
    const song = C.song && typeof window.Audio === 'function' ? new window.Audio() : null;
    if (song) { song.preload = 'none'; song.volume = C.songVolume == null ? 0.8 : C.songVolume; }
    // 미리 받아 두기 (정복 순간에 바로 뜨게)
    const preload = () => {
      files.forEach((f) => { const im = new Image(); im.src = f; });
      if (song && !song.src) { song.src = C.song; song.preload = 'auto'; }
    };
    const stopSong = () => { if (song) { try { song.pause(); song.currentTime = 0; } catch (_) { /* 무시 */ } } if (C.onSongEnd) C.onSongEnd(); };

    function close() {
      if (!root.classList.contains('show')) return;
      clearTimeout(timer);
      stopSong();
      root.classList.add('leaving');
      setTimeout(() => { root.classList.remove('show', 'leaving'); root.textContent = ''; if (onDone) onDone(); }, 450);
    }

    function show(done) {
      onDone = done;
      clearTimeout(timer); // 앞에서 띄운 축하가 남긴 닫기 예약은 지운다 (다시 보기를 눌렀을 때 금방 닫히지 않게)
      root.classList.remove('leaving');
      root.textContent = '';
      const rng = SF.makeRng((Math.random() * 4294967296) >>> 0);
      // 꽃가루
      const colors = ['#E2B85C', '#F0C96A', '#ff6b81', '#7cc4ff', '#9DB882', '#ffffff', '#c58cff'];
      for (let i = 0; i < 70; i++) {
        const c = document.createElement('i');
        c.className = 'confetti';
        c.style.left = (rng.next() * 100) + '%';
        c.style.background = colors[i % colors.length];
        c.style.animationDelay = (rng.next() * 2.5) + 's';
        c.style.animationDuration = (2.4 + rng.next() * 2) + 's';
        c.style.setProperty('--sway', ((rng.next() - 0.5) * 80) + 'px');
        root.appendChild(c);
      }
      // 움짤들
      SF.cheerLayout(files.length, rng, { gap: C.gap }).forEach((s, i) => {
        const im = document.createElement('img');
        im.className = 'cheer-img';
        im.src = files[i];
        im.alt = '';
        im.style.left = (s.x * 100) + '%';
        im.style.top = (s.y * 100) + '%';
        im.style.width = (s.size * 100) + '%';
        im.style.zIndex = s.z;
        im.style.setProperty('--rot', s.rot + 'deg');
        im.style.animationDelay = s.delay + 's, ' + (s.delay + 0.7) + 's';
        root.appendChild(im);
      });
      // 큰 글자
      const t = document.createElement('div');
      t.className = 'cheer-title';
      t.innerHTML = '<b>1000층</b><span>정복!</span>';
      const allIn = 0.4 + files.length * (C.gap || 1.6); // 마지막 움짤까지 다 나온 시각
      t.style.animationDelay = allIn + 's';
      root.appendChild(t);
      const hint = document.createElement('p');
      hint.className = 'cheer-hint';
      hint.textContent = '화면을 누르면 증명서로';
      root.appendChild(hint);
      root.classList.add('show');
      if (song && !(sound && sound.muted)) {
        if (!song.src) song.src = C.song;
        try { song.currentTime = 0; const p = song.play(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* 브라우저가 막으면 빵빠레만 */ }
        if (C.onSongStart) C.onSongStart();
      }
      if (sound) { sound.play('fanfare'); setTimeout(() => sound.play('fanfare'), allIn * 1000); } // 처음과 "정복!" 글자가 뜰 때
      timer = setTimeout(close, (allIn + (C.holdSeconds || 4)) * 1000); // 다 나오고 나서 몇 초 더 보여 준다
    }

    root.addEventListener('pointerdown', (e) => { e.preventDefault(); close(); });
    return { show, close, preload, get open() { return root.classList.contains('show'); } };
  };
})(window.SF);
