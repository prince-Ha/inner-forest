// 배경음: config.bgm.files를 차례로 반복 재생. 스피커(음소거) 버튼과 같이 켜지고 꺼진다
//  - 처음엔 안 받아 둔다 (휴대폰 데이터 아끼기). 켤 때 첫 곡부터 받으면서 바로 튼다
//  - 한 곡이 끝나면 다음 곡, 마지막 곡 다음은 첫 곡. 못 읽는 곡은 건너뛴다
//  - 다른 앱으로 가면(화면이 가려지면) 멈추고, 돌아오면 다시 튼다
// opts.Audio / opts.doc 으로 바꿔 끼울 수 있다 (테스트용)
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  SF.createBgm = function (cfg, opts) {
    const o = opts || {};
    const files = (cfg && cfg.files) || [];
    const AudioCls = 'Audio' in o ? o.Audio : (typeof window.Audio === 'function' ? window.Audio : null);
    const doc = 'doc' in o ? o.doc : document;
    const b = { on: false, index: 0, player: null };
    if (!files.length || !AudioCls) { b.setOn = () => {}; return b; }

    const a = b.player = new AudioCls();
    a.preload = 'none';
    a.volume = cfg.volume == null ? 0.4 : cfg.volume;
    let loaded = false;
    const load = (i) => { b.index = ((i % files.length) + files.length) % files.length; a.src = files[b.index]; loaded = true; };
    const play = () => { try { const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* 브라우저가 막으면 다음 터치 때 다시 */ } };
    const next = () => { load(b.index + 1); if (b.on) play(); };
    a.addEventListener('ended', next);
    a.addEventListener('error', () => { if (files.length > 1) next(); });

    // 켜기·끄기 (여러 번 불러도 괜찮다)
    b.setOn = function (on) {
      b.on = !!on;
      if (b.on) { if (!loaded) load(0); play(); } else { try { a.pause(); } catch (_) { /* 무시 */ } }
    };
    if (doc && doc.addEventListener) {
      doc.addEventListener('visibilitychange', () => {
        if (!b.on) return;
        if (doc.hidden) { try { a.pause(); } catch (_) { /* 무시 */ } } else play();
      });
    }
    return b;
  };
})(window.SF);
