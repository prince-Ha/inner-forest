// 조정 패널: 주소 끝에 ?debug 또는 #debug 를 붙였을 때만 나타난다 (선생님용 손맛 조정 도구)
// (claude.ai 링크에서는 ?debug가 전달되지 않으므로 #debug를 쓴다)
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  if (!/(^|[?&])debug\b/.test(location.search) && location.hash !== '#debug') return;
  // 맵을 다 만든 뒤에 패널을 붙인다 (맵을 만들지 못하면 붙이지 않음)
  if (SF.whenReady) SF.whenReady(setup);

  function setup() {
  const game = SF.game;
  const cfg = game.cfg;
  const stage = document.getElementById('stage');

  const el = (tag, props, kids) => {
    const n = document.createElement(tag);
    Object.assign(n, props || {});
    (kids || []).forEach((k) => n.appendChild(typeof k === 'string' ? document.createTextNode(k) : k));
    return n;
  };

  // [설정 경로, 이름, 최소, 최대, 간격]
  const SLIDERS = [
    ['step.hopTime', '한 칸 뛰는 시간(초)', 0.03, 0.3, 0.01],
    ['step.missSpeed', '잘못 눌렀을 때 튀어나가는 속도', 0, 160, 5],
    ['combo.timeout', '콤보 끊기는 시간(초)', 0.5, 4, 0.1],
    ['physics.gravity', '중력', 500, 2000, 10],
    ['physics.maxFallSpeed', '최대 낙하 속도', 200, 800, 10],
    ['camera.smoothTime', '카메라 부드러움', 0.05, 0.5, 0.01],
    ['obstacles.spikeBall.period', '가시공 왕복 시간(초)', 0.6, 4, 0.1],
    ['obstacles.banana.period', '바나나 던지는 간격(초)', 0.6, 4, 0.1],
    ['obstacles.banana.speed', '바나나 속도', 40, 250, 5],
    ['obstacles.acorn.period', '도토리 떨어지는 간격(초)', 0.6, 4, 0.1],
    ['obstacles.crumble.delay', '발판 부서지기까지(초)', 0.1, 1.5, 0.05],
    ['obstacles.knockSpeed', '맞았을 때 튕기는 속도', 20, 200, 5],
    ['obstacles.graceTime', '맞은 뒤 무적 시간(초)', 0, 2, 0.1],
    ['obstacles.gust.hold', '돌풍: 버틸 수 있는 시간(초)', 0.1, 1, 0.05],
    ['obstacles.gust.period', '돌풍: 부는 간격(초)', 2, 8, 0.5],
  ];
  // 'a.b.c' → 그 값이 든 객체와 마지막 키
  const at = (path) => {
    const keys = path.split('.');
    const last = keys.pop();
    return [keys.reduce((o, k) => o[k], cfg), last];
  };

  const toggle = el('button', { id: 'dbg-toggle', type: 'button', textContent: '⚙', title: '조정 패널' });
  const panel = el('div', { id: 'dbg-panel', className: 'hidden' });
  stage.appendChild(toggle);
  stage.appendChild(panel);
  toggle.addEventListener('click', () => panel.classList.toggle('hidden'));

  panel.appendChild(el('h2', { textContent: '조정 패널' }));
  for (const [path, label, min, max, step] of SLIDERS) {
    const [obj, key] = at(path);
    const value = el('span', { className: 'dbg-val', textContent: String(obj[key]) });
    const input = el('input', { type: 'range', min, max, step, value: obj[key] });
    input.addEventListener('input', () => {
      obj[key] = Number(input.value);
      value.textContent = input.value;
    });
    panel.appendChild(el('label', { className: 'dbg-row' }, [el('span', { textContent: label }), value, input]));
  }

  const out = el('textarea', { className: 'dbg-out hidden', readOnly: true, rows: 6 });
  const configText = () => {
    const fmt = (k, v) => (k === 'fixedStep' ? '1 / 120' : JSON.stringify(v).replace(/,/g, ', '));
    const lines = [];
    for (const group of ['step', 'combo', 'physics', 'camera', 'obstacles']) {
      lines.push('  ' + group + ': {');
      for (const k of Object.keys(cfg[group])) lines.push('    ' + k + ': ' + fmt(k, cfg[group][k]) + ',');
      lines.push('  },');
    }
    return lines.join('\n');
  };
  const copyBtn = el('button', { type: 'button', textContent: '설정 복사' });
  copyBtn.addEventListener('click', async () => {
    const text = configText();
    out.value = text;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = '복사됨! config.js에 붙여 넣기';
    } catch (_) {
      out.classList.remove('hidden');
      out.focus();
      out.select();
      copyBtn.textContent = '아래 글자를 직접 복사하세요';
    }
    setTimeout(() => { copyBtn.textContent = '설정 복사'; }, 2500);
  });

  const botBtn = el('button', { type: 'button' });
  const syncBot = () => { botBtn.textContent = game.bot ? '봇 끄기' : '봇 켜기 (자동 등반)'; };
  botBtn.addEventListener('click', () => { game.setBot(!game.bot); syncBot(); });
  syncBot();

  const floorIn = el('input', { type: 'number', min: 1, max: cfg.totalFloors, value: 45, className: 'dbg-num' });
  const goBtn = el('button', { type: 'button', textContent: '층으로 이동' });
  goBtn.addEventListener('click', () => game.teleport(Number(floorIn.value)));

  const seedIn = el('input', { type: 'number', value: cfg.seed, className: 'dbg-num dbg-seed' });
  const seedBtn = el('button', { type: 'button', textContent: '이 시드로 맵 만들기' });
  const info = el('div', { className: 'dbg-info' });
  const showInfo = () => {
    const r = game.report;
    const falls = r.falls.map((f) => f.floor + '층→' + f.fallFloors + '층').join(', ') || (r.fast ? '(미리 검사한 맵)' : '없음');
    const NAMES = { spikeBall: '가시공', monkey: '원숭이', acorn: '도토리' };
    const where = Object.keys(NAMES).map((k) => NAMES[k] + ' ' +
      game.level.hazards.filter((h) => h.kind === k).length + '개').join(', ');
    info.textContent = '맵 시드 ' + game.level.seed + (r.botSeconds == null ? '' : ' · 봇 완주 ' + r.botSeconds.toFixed(1) + '초') +
      '\n낭떠러지 추락 깊이: ' + falls +
      '\n장애물: ' + where + ', 금 간 발판 ' + game.level.crumbles.length + '칸' +
      (r.errors.length ? '\n검증 오류: ' + r.errors.join(' / ') : '');
  };
  // 바로 가기: 장애물 구간 첫 층
  const jumpBox = el('div', { className: 'dbg-btns' });
  for (const s of SF.practiceStarts(cfg)) {
    const b = el('button', { type: 'button', textContent: s.label + ' ' + s.floor + '층' });
    b.addEventListener('click', () => game.teleport(s.floor));
    jumpBox.appendChild(b);
  }
  seedBtn.addEventListener('click', () => { game.regenerate(Number(seedIn.value)); syncBot(); showInfo(); });

  // 지금 config.js 설정으로 맵을 처음부터 검사해서, config.js의 map 줄에 붙여 넣을 값을 만든다
  const mapBtn = el('button', { type: 'button', textContent: '맵 번호 다시 찾기' });
  mapBtn.addEventListener('click', () => {
    mapBtn.textContent = '검사 중… (몇 초)';
    setTimeout(() => {
      const B = SF.buildLevel(cfg);
      out.classList.remove('hidden');
      out.value = B.report.errors.length
        ? '이 설정으로는 검사를 통과한 맵을 찾지 못했어요: ' + B.report.errors.join(' / ')
        : SF.mapLine(B.level, cfg) + ',';
      mapBtn.textContent = '맵 번호 다시 찾기';
      try { navigator.clipboard.writeText(out.value); } catch (_) { /* 아래 칸에서 직접 복사 */ }
    }, 30);
  });

  const hitBtn = el('button', { type: 'button', textContent: '충돌 상자 보기' });
  hitBtn.addEventListener('click', () => {
    game.debug.hitbox = !game.debug.hitbox;
    hitBtn.textContent = game.debug.hitbox ? '충돌 상자 숨기기' : '충돌 상자 보기';
  });

  // 퀴즈 건너뛰기: 지금 퀴즈를 정답 처리하고 계속 / 1분 남기기: 시간 종료 화면 확인용
  const skipBtn = el('button', { type: 'button', textContent: '퀴즈 건너뛰기' });
  skipBtn.addEventListener('click', () => {
    if (game.state !== 'quiz') return;
    if (!game.quizAnswered) game.answer(game.quizQ.answer);
    game.continueAfterQuiz();
  });
  const minuteBtn = el('button', { type: 'button', textContent: '1분 남기기' });
  minuteBtn.addEventListener('click', () => {
    if (cfg.timeLimitSec) game.stats.climbTime = Math.max(game.stats.climbTime, cfg.timeLimitSec - 60);
  });

  panel.appendChild(el('div', { className: 'dbg-btns' }, [copyBtn, botBtn, hitBtn]));
  panel.appendChild(el('div', { className: 'dbg-btns' }, [skipBtn, minuteBtn]));
  panel.appendChild(out);
  panel.appendChild(el('div', { className: 'dbg-line' }, [floorIn, goBtn]));
  panel.appendChild(jumpBox);
  panel.appendChild(el('div', { className: 'dbg-line' }, [seedIn, seedBtn]));
  panel.appendChild(el('div', { className: 'dbg-btns' }, [mapBtn]));
  panel.appendChild(info);
  showInfo();

  // 완주하면 봇이 꺼지므로 버튼 글자를 맞춘다
  setInterval(syncBot, 500);
  }
})(window.SF);
