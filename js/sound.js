// 효과음: 소리 파일 없이 WebAudio로 합성한다. 첫 터치·키 입력 뒤에만 소리가 난다 (브라우저 규칙)
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  const VOLUME = 0.25;
  const KEY = 'sf-muted';

  // 계단 톡 소리의 음높이: 콤보가 쌓일수록 올라가고 24콤보에서 한 옥타브로 멈춘다
  SF.stepPitch = (combo) => 523.25 * Math.pow(2, Math.min(Math.max(combo, 0), 24) / 24);

  function defaultStorage() {
    try { return window.localStorage; } catch (_) { return null; }
  }

  // opts.storage / opts.AudioContext 로 바꿔 끼울 수 있다 (테스트용)
  SF.createSound = function (opts) {
    const o = opts || {};
    const storage = 'storage' in o ? o.storage : defaultStorage();
    const AC = 'AudioContext' in o ? o.AudioContext : (window.AudioContext || window.webkitAudioContext || null);
    let ctx = null;
    let master = null;

    // 처음에는 꺼져 있다 (스피커를 눌러 켜면 그 기기에 기억)
    const s = { muted: true };
    try { s.muted = !storage || storage.getItem(KEY) !== '0'; } catch (_) { s.muted = true; }

    s.setMuted = function (m) {
      s.muted = !!m;
      try { if (storage) storage.setItem(KEY, s.muted ? '1' : '0'); } catch (_) { /* 저장이 막혀 있어도 그대로 동작 */ }
      if (master) master.gain.value = s.muted ? 0 : VOLUME;
    };

    s.unlock = function () {
      if (!AC) return;
      try {
        if (!ctx) {
          ctx = new AC();
          master = ctx.createGain();
          master.gain.value = s.muted ? 0 : VOLUME;
          master.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
      } catch (_) {
        ctx = null;
      }
    };

    function tone(f0, dur, type, vol, f1, delay) {
      const t0 = ctx.currentTime + (delay || 0);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t0);
      if (f1) osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }

    // 바람 소리: 흰 잡음을 띠 필터로 걸러 높낮이를 쓸어 올린다
    let noiseBuf = null;
    function noise(dur, vol, f0, f1, delay) {
      if (!noiseBuf) {
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t0 = ctx.currentTime + (delay || 0);
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(f0, t0);
      bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(bp);
      bp.connect(g);
      g.connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    }

    s.play = function (name, info) {
      if (!ctx || s.muted) return;
      const i = info || {};
      try {
        switch (name) {
          case 'step': { const f = SF.stepPitch(i.combo || 0); tone(f, 0.08, 'triangle', 0.5, f * 1.3); break; }
          case 'side': tone(392, 0.06, 'triangle', 0.3, 440); break;
          case 'bump': tone(150, 0.09, 'square', 0.25, 90); break;
          case 'miss': tone(700, 0.35, 'sine', 0.35, 160); break;
          case 'land':
            tone(110, 0.12, 'sine', 0.6, 60);
            if ((i.drop || 0) >= 3) tone(70, 0.22, 'triangle', 0.5, 40);
            break;
          case 'combo': [659, 784, 1047].forEach((f, k) => tone(f, 0.09, 'triangle', 0.45, 0, k * 0.07)); break;
          case 'hit': tone(300, 0.15, 'square', 0.35, 110); tone(180, 0.2, 'triangle', 0.4, 70, 0.03); break;
          case 'crack': tone(900, 0.05, 'square', 0.18, 400); tone(500, 0.09, 'triangle', 0.3, 180, 0.04); break;
          case 'throw': tone(1300, 0.08, 'sine', 0.12, 700); break;
          case 'quiz': [880, 1175].forEach((f, k) => tone(f, 0.12, 'sine', 0.35, 0, k * 0.1)); break;
          case 'correct': [659, 880, 1319].forEach((f, k) => tone(f, 0.12, 'triangle', 0.45, 0, k * 0.08)); break;
          case 'wrong': tone(330, 0.18, 'square', 0.22, 220); tone(220, 0.3, 'square', 0.22, 150, 0.16); break;
          case 'gustWarn': noise(0.6, 0.12, 500, 900); break;
          case 'gust': noise(1.0, 0.45, 350, 1400); break;
          case 'finish': [523, 659, 784, 1047].forEach((f, k) => tone(f, k === 3 ? 0.45 : 0.12, 'triangle', 0.5, 0, k * 0.12)); break;
          // 1000층 정복 빵빠레: 짧은 팡파레 → 화음 길게 + 반짝이
          case 'fanfare': {
            [[523, 0], [523, 0.12], [523, 0.24], [659, 0.36], [784, 0.62], [659, 0.86], [784, 0.98]].forEach(([f, d]) => tone(f, 0.16, 'square', 0.32, 0, d));
            [523, 659, 784, 1047].forEach((f) => tone(f, 1.4, 'triangle', 0.4, 0, 1.2));
            for (let k = 0; k < 10; k++) tone(1400 + Math.random() * 1600, 0.12, 'sine', 0.18, 0, 1.3 + k * 0.11);
            break;
          }
          default: break;
        }
      } catch (_) { /* 소리는 실패해도 게임은 계속 */ }
    };

    return s;
  };
})(window.SF);
