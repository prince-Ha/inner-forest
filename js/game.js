// 게임 진행: 고정 간격 루프, 상태, 탭 이동, 콤보·효과음·말풍선, HUD
// (설계 문서 §12, 2026-10-15 완성본 1단계, 2026-10-16 2단계)
// 상태: home(처음 화면) → ready(◀▶ 안내) → playing ⇄ quiz / paused → finished·timeup
// 처음 화면·일시정지·선생님·증명서 상자는 ui.js가 이 파일의 game API로 다룬다
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  const cfg = window.GAME_CONFIG;
  const $ = (id) => document.getElementById(id);
  const els = {
    app: $('app'), canvas: $('game'), controls: $('controls'), left: $('btn-left'), right: $('btn-right'),
    floor: $('floor'), floorBox: $('floor-box'), combo: $('combo'), best: $('best'), timer: $('timer'),
    ready: $('ready'), finish: $('finish'), restart: $('restart'), mute: $('mute'),
    practice: $('practice'), practiceBtns: $('practice-btns'), finishTitle: $('finish-title'),
    scoreTable: $('score-table'), resultMeta: $('result-meta'),
    quiz: $('quiz'), quizHead: $('quiz-head'), quizQ: $('quiz-q'), quizChoices: $('quiz-choices'),
    quizResult: $('quiz-result'), quizVerdict: $('quiz-verdict'), quizExplain: $('quiz-explain'), quizContinue: $('quiz-continue'),
    quizSkip: $('quiz-skip'), readyWho: $('ready-who'), certBtn: $('cert-btn'), testBadge: $('test-badge'),
  };
  const PLAYING = (s) => s === 'home' || s === 'ready' || s === 'playing'; // 세상이 움직이는 상태
  const INPUT_OK = (s) => s === 'ready' || s === 'playing'; // ◀▶가 먹는 상태

  const renderer = SF.createRenderer(els.canvas, cfg);
  const camera = SF.createCamera(cfg);
  const tracker = SF.createDirTracker(); // 버튼 눌림 표시용
  const sound = SF.createSound();
  const STEP = cfg.physics.fixedStep;
  const freshAnim = () => ({ landT: 1, airT: 0, bumpT: 1, flashT: 1, hitT: 9, steps: 0 });

  const game = SF.game = {
    cfg, level: null, world: null, map: null, report: null,
    player: null, prev: { x: 0, y: 0 },
    stepper: SF.createStepper(), combo: SF.createCombo(), talk: SF.createTalk(),
    // climbTime: 등반 시간(퀴즈 중 멈춤, 15분 제한), totalTime: 퀴즈 포함 전체 시간
    state: 'home', stats: { climbTime: 0, totalTime: 0, falls: 0, hits: 0, bestFloor: 1, maxCombo: 0 },
    // 입장 정보와 고른 캐릭터, 일시정지 전 상태, 선생님 모드·테스트 모드, 마지막 판의 기록, 증명서 내용
    student: null, charId: null, pausedFrom: null, teacherUnlocked: false, testMode: false, lastRecord: null, certData: null,
    // 구글 시트: 문제은행(null이면 게임 안 문제), 이 판의 번호, 판이 끝나 기록이 생기면 부를 함수(sheet-ui.js가 채움)
    bank: null, runId: '', onRecord: null,
    quiz: null, quizQ: null, quizFloor: 0, quizAnswered: false,
    bot: false, debug: { hitbox: false },
    popups: [], particles: [], bubble: null, shakeTime: 0,
    anim: freshAnim(), sound,
    // 장애물: 시계(초), 금 간 발판 상태, 맞은 뒤 무적 시간, 튕겨 날아가는 중인지, 원숭이별 마지막 던짐 번호
    clock: 0, crumbles: null, grace: 0, knocked: false, throwK: new Map(),
    // 돌풍: 바람 속에서 서 있은 시간, 마지막으로 소리 낸 바람 단계, 돌풍 구간 첫 안내를 했는지
    gust: SF.createGustState(), gustKey: '', gustIntroDone: false,
    practiceFrom: 0, // 구간 연습이면 시작 층 (기록에 안 들어감)
  };

  let vp = null;
  let acc = 0;
  let lastT = 0;
  const hudCache = {};

  SF.formatTime = function (t) {
    const cs = Math.floor(t * 100 + 1e-6);
    const pad = (n) => String(n).padStart(2, '0');
    return pad(Math.floor(cs / 6000)) + ':' + pad(Math.floor(cs / 100) % 60) + '.' + pad(cs % 100);
  };
  // 분:초 (남은 시간은 올림: 0.4초 남았으면 0:01)
  const mmss = (t, up) => {
    const s = Math.max(0, up ? Math.ceil(t - 1e-6) : Math.floor(t + 1e-6));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  const limit = () => cfg.timeLimitSec || 0;

  // 설정·맵 문제를 화면에 보여준다 (휴대폰에서도 보이게, 콘솔이 아니라 화면에)
  function showNotice(messages, fatal) {
    const box = $('notice');
    if (!box || !messages.length) return;
    box.querySelector('h2').textContent = fatal ? '게임을 시작할 수 없어요' : '설정을 확인해 주세요';
    const list = box.querySelector('ul');
    list.textContent = '';
    for (const m of messages) list.appendChild(Object.assign(document.createElement('li'), { textContent: m }));
    box.querySelector('button').hidden = !!fatal;
    box.hidden = false;
  }

  // 맵을 만들어 바꿔 끼운다. 만들 수 없으면(prep.fatal) 이전 맵을 그대로 둔다. 안내는 부른 쪽이 띄운다
  function loadLevel(seed) {
    const prep = SF.prepareLevel(seed == null ? cfg : Object.assign({}, cfg, { seed }));
    if (prep.fatal) return prep;
    if (game.crumbles && game.level) SF.restoreCrumbles(game.crumbles, game.level);
    game.crumbles = null;
    game.level = prep.level;
    game.report = prep.report;
    game.world = new SF.World(prep.level.grid, cfg);
    game.map = SF.treadIndexMap(prep.level);
    renderer.setLevel(prep.level);
    return prep;
  }

  // 구간 연습 버튼: 장애물 구간 첫 층부터 바로 (테스트 모드에서만 보임)
  function buildPracticeButtons() {
    if (!els.practice) return;
    const list = SF.practiceStarts(cfg);
    els.practice.hidden = !list.length || !game.testMode;
    els.practiceBtns.textContent = '';
    for (const s of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s.floor + '층 ' + s.label;
      b.addEventListener('click', () => game.startPractice(s.floor, s.label));
      els.practiceBtns.appendChild(b);
    }
  }

  const bounds = () => ({ minTop: vp.viewH - cfg.world.cell, maxTop: (game.level.goalRow + 4) * cfg.world.cell });
  const centerY = (p) => p.y + p.h / 2;

  function setText(key, el, text) {
    if (hudCache[key] !== text) { hudCache[key] = text; el.textContent = text; }
  }
  function updateHud() {
    setText('floor', els.floor, String(SF.floorAt(game.player.y)));
    setText('best', els.best, (game.practiceFrom ? '연습 · 최고 ' : '최고 ') + game.stats.bestFloor + '층');
    // 제한이 있으면 남은 등반 시간, 없으면 지난 시간
    const left = limit() - game.stats.climbTime;
    setText('timer', els.timer, limit() ? '남은 ' + mmss(left, true) : SF.formatTime(game.stats.climbTime));
    const low = limit() && left <= 60 ? '1' : '0';
    if (hudCache.low !== low) { hudCache.low = low; els.timer.dataset.low = low; }
    const c = game.combo.count;
    setText('combo', els.combo, c >= 2 ? c + ' 콤보' : '');
    const tier = c >= 50 ? '3' : c >= 30 ? '2' : c >= 10 ? '1' : '0';
    if (hudCache.tier !== tier) { hudCache.tier = tier; els.combo.dataset.tier = tier; }
  }
  // 오를 때마다 큰 층수가 톡 튄다 (CSS 애니메이션 다시 시작)
  function popFloor() {
    els.floorBox.classList.remove('pop');
    void els.floorBox.offsetWidth;
    els.floorBox.classList.add('pop');
  }

  function say(text, life) {
    if (text) game.bubble = { text, age: 0, life: life || 1.6 };
  }

  function start() {
    if (game.state !== 'ready') return;
    game.state = 'playing';
    els.ready.classList.add('hidden');
    say(game.talk.line('start'), 1.4);
  }

  // 테스트 도구(이동·봇)는 완주·시간 종료 화면, 퀴즈·일시정지 중에도 다시 플레이 상태로 돌려놓는다
  function resume() {
    if (game.state === 'finished' || game.state === 'timeup') {
      game.state = 'ready';
      els.finish.classList.add('hidden');
    }
    if (game.state === 'quiz') closeQuiz(); // 안 푼 퀴즈는 그 층에 다시 서면 다시 나온다
    if (game.state === 'paused') game.state = game.pausedFrom || 'ready';
    start();
  }

  // 이번 판이 기록에 남지 않는가 (테스트 모드, 구간 연습)
  const notRecorded = () => game.testMode || !!game.practiceFrom;
  // 판이 끝날 때(완주·시간 종료·그만두기) 기록을 만들어 구글 시트로 보낸다 (test 표시가 있으면 안 보냄)
  function recordRun(finished, quit) {
    if (!game.student) return null;
    game.lastRecord = SF.makeRecord({ student: game.student, charId: game.charId, stats: game.stats, quiz: game.quiz,
      finished, quit, test: notRecorded(), runId: game.runId }, cfg, new Date());
    if (game.onRecord) game.onRecord(game.lastRecord);
    return game.lastRecord;
  }

  // 결과 상자: 완주(finished) 또는 시간 종료(timeup). 점수 내역 표와 시간·추락
  function showResult(finished) {
    const s = game.stats;
    const run = game.quiz;
    const sc = SF.computeScore({ bestFloor: s.bestFloor, finished, climbTime: s.climbTime, correct: run.correct, maxCombo: s.maxCombo }, cfg);
    const title = finished ? '완주!' : '시간 종료!';
    els.finishTitle.textContent = notRecorded() ? (game.testMode ? '테스트 ' : '연습 ') + title + ' (기록 안 남음)' : title;
    // 완주하면 증명서 (테스트·연습이면 '테스트' 표시가 들어감)
    game.certData = finished && game.student ? {
      name: game.student.name.trim(), grade: cfg.school.grade, classNo: Number(game.student.classNo), floors: cfg.totalFloors,
      date: new Date(), climbTime: s.climbTime, score: sc.total, correct: run.correct, total: run.total,
      test: notRecorded(), charId: game.charId,
    } : null;
    els.certBtn.hidden = !game.certData;
    const rows = [
      ['층 점수 (최고 ' + s.bestFloor + '층)', sc.floor],
      ['완주 보너스', sc.finish],
      ['빨리 도착' + (finished && limit() ? ' (' + mmss(limit() - s.climbTime) + ' 남김)' : ''), sc.speed],
      ['퀴즈 (' + run.correct + '/' + run.total + ' 정답)', sc.quiz],
      ['콤보 (최고 ' + s.maxCombo + ')', sc.combo],
    ];
    els.scoreTable.textContent = '';
    for (const [label, v] of rows.concat([['합계', sc.total]])) {
      const tr = document.createElement('tr');
      if (label === '합계') tr.className = 'total';
      tr.appendChild(Object.assign(document.createElement('th'), { textContent: label }));
      tr.appendChild(Object.assign(document.createElement('td'), { textContent: v.toLocaleString('ko-KR') }));
      els.scoreTable.appendChild(tr);
    }
    els.resultMeta.textContent = '등반 ' + mmss(s.climbTime) + ' · 전체 ' + mmss(s.totalTime) + ' · 추락 ' + s.falls + '회';
    els.finish.classList.remove('hidden');
    game.score = sc;
  }

  function finish() {
    game.state = 'finished';
    tracker.clear();
    game.bot = false;
    showResult(true);
    recordRun(true, false);
    sound.play('finish');
    say(game.talk.line('finish'), 3);
  }

  function timeUp() {
    game.state = 'timeup';
    tracker.clear();
    game.bot = false;
    game.stepper.queue.length = 0;
    showResult(false);
    recordRun(false, false);
    sound.play('miss');
    say(game.talk.line('timeup'), 3);
  }

  // ---------------------------------------------------------------- 처음 화면·일시정지·그만두기 (ui.js가 부름)
  // 입장 정보와 캐릭터로 새 판 준비 (◀▶ 안내 화면)
  game.begin = function (student, charId) {
    game.student = { name: String(student.name).trim(), classNo: Number(student.classNo) };
    game.charId = charId;
    game.reset();
  };
  // 처음 화면으로 (세상은 뒤에서 계속 움직인다)
  game.toHome = function () {
    game.reset();
    game.state = 'home';
    els.ready.classList.add('hidden');
    els.app.classList.add('is-home');
  };
  // 지금 판이 진행 중인가 (그만둘 때 확인을 받을지)
  game.inRun = () => ['playing', 'quiz'].includes(game.state === 'paused' ? game.pausedFrom : game.state);
  // 그만두고 처음 화면으로: 진행 중이던 판은 최고 층까지 미완주로 기록 (테스트·연습은 기록 안 함)
  game.quitToHome = function () {
    if (game.inRun()) recordRun(false, true);
    game.toHome();
  };
  game.pause = function () {
    if (!['ready', 'playing'].includes(game.state)) return false;
    game.pausedFrom = game.state;
    game.state = 'paused';
    tracker.clear();
    game.stepper.queue.length = 0;
    return true;
  };
  game.unpause = function () {
    if (game.state !== 'paused') return;
    game.state = game.pausedFrom || 'ready';
    game.pausedFrom = null;
    acc = 0;
  };
  // 테스트 모드: 구간 연습·층 이동·봇·퀴즈 건너뛰기, 기록 안 남음
  game.setTestMode = function (on) {
    game.testMode = !!on;
    els.testBadge.hidden = !game.testMode;
    els.quizSkip.hidden = !game.testMode;
    buildPracticeButtons();
  };
  game.sprites = renderer.sprites;

  // ---------------------------------------------------------------- 퀴즈 상자
  const LETTERS = ['A', 'B', 'C', 'D'];
  function openQuiz(q, floor) {
    game.state = 'quiz';
    game.quizQ = q;
    game.quizFloor = floor;
    game.quizAnswered = false;
    SF.openQuiz(game.stepper);
    tracker.clear();
    els.quizHead.textContent = '과학 퀴즈 ' + (game.quiz.next + 1) + '/' + game.quiz.total + ' · ' + floor + '층';
    els.quizQ.textContent = q.q;
    els.quizChoices.textContent = '';
    q.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'quiz-choice';
      b.appendChild(Object.assign(document.createElement('span'), { className: 'quiz-letter', textContent: LETTERS[i] }));
      b.appendChild(document.createTextNode(c));
      b.addEventListener('click', () => game.answer(i));
      els.quizChoices.appendChild(b);
    });
    els.quizResult.hidden = true;
    els.quiz.classList.remove('hidden');
    els.quiz.scrollTop = 0;
    sound.play('quiz');
  }
  function closeQuiz() {
    els.quiz.classList.add('hidden');
    game.quizQ = null;
    game.state = 'playing';
  }
  // 보기 고르기: 정답/오답과 해설을 보여 주고 [계속 오르기]를 기다린다 (오답 벌칙 없음, 점수만 못 받음)
  game.answer = function (choice) {
    if (game.state !== 'quiz' || game.quizAnswered) return;
    game.quizAnswered = true;
    const r = SF.answerQuiz(game.quiz, game.quizFloor, choice);
    [...els.quizChoices.children].forEach((b, i) => {
      b.disabled = true;
      if (i === r.answer) b.classList.add('right');
      else if (i === choice) b.classList.add('wrong');
    });
    els.quizVerdict.textContent = r.correct ? '정답! +' + cfg.score.perCorrect + '점' : '아쉬워요. 정답은 ' + LETTERS[r.answer];
    els.quizVerdict.className = 'quiz-verdict ' + (r.correct ? 'right' : 'wrong');
    els.quizExplain.textContent = r.explain;
    els.quizResult.hidden = false;
    sound.play(r.correct ? 'correct' : 'wrong');
    els.quizContinue.focus();
  };
  game.continueAfterQuiz = function () {
    if (game.state !== 'quiz' || !game.quizAnswered) return;
    closeQuiz();
  };

  function placePlayer(x, y) {
    const p = game.player;
    p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.grounded = true; p.airStartY = y;
    game.prev.x = x; game.prev.y = y;
    game.stepper = SF.createStepper();
    game.knocked = false;
    game.grace = 0;
    game.gust = SF.createGustState();
    if (vp) camera.snap(centerY(p), vp.viewH, bounds());
  }

  game.reset = function () {
    const s = game.level.spawn;
    game.player = SF.createPlayer(s.x, s.y);
    game.state = 'ready';
    game.stats = { climbTime: 0, totalTime: 0, falls: 0, hits: 0, bestFloor: 1, maxCombo: 0 };
    // 판마다 문제 순서가 다르게 (구글 시트 문제를 불러왔으면 그 문제로)
    game.quiz = SF.createQuizRun(game.bank || SF.QUESTIONS, cfg, SF.makeRng((Math.random() * 4294967296) >>> 0));
    // 판 번호: 기록이 두 번 저장되지 않게 (와이파이가 끊겨 다시 보낼 때도 같은 번호)
    game.runId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    game.quizQ = null;
    els.quiz.classList.add('hidden');
    game.combo = SF.createCombo();
    game.talk = SF.createTalk(null, game.charId); // 고른 캐릭터의 말투로
    game.popups.length = 0;
    game.particles.length = 0;
    game.bubble = null;
    game.shakeTime = 0;
    game.anim = freshAnim();
    if (game.crumbles) SF.restoreCrumbles(game.crumbles, game.level);
    game.crumbles = SF.createCrumbleState(game.level);
    game.clock = 0;
    game.grace = 0;
    game.knocked = false;
    game.throwK = new Map();
    game.gustKey = '';
    game.gustIntroDone = false;
    game.practiceFrom = 0;
    game.pausedFrom = null;
    game.bot = false;
    game.certData = null;
    acc = 0;
    tracker.clear();
    placePlayer(s.x, s.y);
    els.app.classList.remove('is-home');
    if (els.readyWho) {
      const who = game.student ? game.student.name + ' · ' + cfg.school.grade + '학년 ' + game.student.classNo + '반' : '';
      els.readyWho.textContent = who;
    }
    els.ready.classList.remove('hidden');
    els.finish.classList.add('hidden');
    updateHud();
  };

  // 디버그·테스트용: N층 디딤판의 들어서는 칸으로 옮긴다
  game.teleport = function (floor) {
    const t = game.level.treads.find((tr) => tr.row + 1 === floor);
    if (!t) { placePlayer(game.level.spawn.x, game.level.spawn.y); return; }
    const entry = t.dirIn > 0 ? t.c0 : t.c1;
    placePlayer(entry * cfg.world.cell + (cfg.world.cell - game.player.w) / 2, t.row * cfg.world.cell);
    resume();
  };

  // 구간 연습: 처음부터 다시, 그 구간 첫 층에서 바로 출발 (완주해도 기록이 아님)
  game.startPractice = function (floor, label) {
    game.reset();
    game.practiceFrom = floor;
    game.teleport(floor);
    say((label ? label + ' ' : '') + '연습 시작!', 1.6);
    updateHud();
  };

  game.regenerate = function (seed) {
    const prep = loadLevel(seed);
    showNotice(prep.messages, false); // 만들지 못해도 이전 맵으로 계속할 수 있다
    if (!prep.fatal) game.reset();
  };
  // 디버그·테스트용: 화면 없이 시간을 seconds초 흘린다 (탭이 가려져 그리기가 멈춰도 검사할 수 있게).
  // 퀴즈·완주·시간 종료가 되면 멈춘다
  game.advance = function (seconds) {
    for (let i = 0; i < Math.round(seconds / STEP) && PLAYING(game.state); i++) stepOnce();
  };
  game.setBot = function (on) { game.bot = !!on; if (game.bot) resume(); };

  // 발밑에서 흙먼지
  function dust(n, spread) {
    const p = game.player;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      game.particles.push({
        x: p.x + p.w / 2 + side * Math.random() * 4, y: p.y + 1,
        vx: side * (15 + Math.random() * spread), vy: 15 + Math.random() * 35,
        size: Math.random() < 0.4 ? 2 : 1, color: Math.random() < 0.5 ? '#dcc8a4' : '#b39470',
        age: 0, life: 0.3 + Math.random() * 0.25,
      });
    }
  }

  function onEvent(e) {
    const a = game.anim;
    const playing = game.state === 'playing';
    switch (e.type) {
      case 'hopStart':
        a.steps++;
        sound.play(e.kind === 'climb' ? 'step' : 'side', { combo: game.combo.count });
        break;
      case 'climb': {
        dust(2, 10);
        popFloor();
        if (!playing) break;
        const milestone = SF.comboStep(game.combo, cfg);
        game.stats.maxCombo = Math.max(game.stats.maxCombo, game.combo.count);
        if (milestone) {
          sound.play('combo');
          say(game.talk.line('combo', milestone), 1.6);
          a.flashT = 0;
        }
        break;
      }
      case 'bump':
        a.bumpT = 0;
        sound.play('bump');
        SF.comboBreak(game.combo);
        break;
      case 'miss':
        SF.comboBreak(game.combo);
        sound.play('miss');
        break;
      case 'hit':
        a.hitT = 0;
        if (playing) game.stats.hits++;
        SF.comboBreak(game.combo);
        sound.play('hit');
        game.shakeTime = Math.max(game.shakeTime, 0.15);
        say(game.talk.line('hit'), 1.4);
        break;
      case 'gustPush':
        if (e.fell) {
          SF.comboBreak(game.combo);
          sound.play('miss');
          say(game.talk.line('gust'), 1.4);
        } else {
          sound.play('side');
        }
        break;
      case 'break': {
        sound.play('crack');
        for (let i = 0; i < 6; i++) {
          game.particles.push({
            x: e.col * 16 + 2 + Math.random() * 12, y: e.row * 16 - 2,
            vx: (Math.random() * 2 - 1) * 20, vy: Math.random() * 20,
            size: Math.random() < 0.5 ? 2 : 1, color: Math.random() < 0.5 ? '#c47d3e' : '#93592a',
            age: 0, life: 0.5 + Math.random() * 0.3,
          });
        }
        break;
      }
      case 'land': {
        a.landT = 0;
        const drop = Math.max(0, e.dropFloors);
        dust(Math.min(14, 2 + drop * 2), 20 + drop * 4);
        sound.play('land', { drop });
        if (drop >= cfg.fall.countFloors) {
          if (playing) game.stats.falls++;
          const p = game.player;
          game.popups.push({ text: '−' + drop + '층!', x: p.x + p.w / 2, y: p.y + p.h + 6, age: 0, life: 1.2 });
          if (drop >= cfg.fall.shakeFloors) game.shakeTime = 0.3;
          say(game.talk.line('fall'), 1.6);
        }
        break;
      }
      default: break;
    }
  }

  // 원숭이가 막 던졌으면 휙 소리 (캐릭터 근처 원숭이만)
  function throwSounds() {
    const row = Math.round(game.player.y / 16);
    for (const h of game.level.hazards) {
      if (h.kind !== 'monkey' || Math.abs(h.row - row) > 8) continue;
      const k = SF.throwCount(h, cfg, game.clock);
      if (k >= 0 && game.throwK.get(h) !== k) {
        if (game.throwK.has(h)) sound.play('throw');
        game.throwK.set(h, k);
      }
    }
  }

  // 돌풍 구간에 있으면: 처음 들어설 때 안내, 예고·바람이 시작될 때 소리
  function gustCues() {
    const p = game.player;
    if (!SF.inGustZone(cfg, SF.floorAt(p.y))) return;
    if (!game.gustIntroDone && p.grounded && game.state === 'playing') {
      game.gustIntroDone = true;
      say(game.talk.line('gustIntro'), 2.4);
    }
    const g = SF.gustAt(game.level, cfg, game.clock);
    const key = g.k + ':' + g.phase;
    if (key === game.gustKey) return;
    game.gustKey = key;
    if (g.phase === 'warn') sound.play('gustWarn');
    else if (g.phase === 'blow') sound.play('gust');
  }

  function stepOnce() {
    const p = game.player;
    const st = game.stepper;
    if (game.bot && st.mode === 'idle' && st.queue.length === 0 && p.grounded) {
      const d = SF.carefulBotDir(game.level, game.map, p, cfg, game.clock); // 장애물 틈을 기다리는 봇
      if (d) SF.stepperPress(st, d, cfg);
    }
    game.prev.x = p.x;
    game.prev.y = p.y;
    game.clock += STEP;
    const events = SF.updateCrumbles(game.crumbles, game.level, p, cfg);
    for (const e of SF.updateStepper(st, p, game.world, cfg)) events.push(e);
    // 장애물에 맞기: 떨어지는 중·무적 중·완주 뒤에는 안 맞는다
    if (game.grace > 0) game.grace -= STEP;
    if (game.knocked && st.mode === 'idle') { game.knocked = false; game.grace = cfg.obstacles.graceTime; }
    if (!game.knocked && game.grace <= 0 && st.mode !== 'fall') {
      const hit = SF.hazardHit(game.level, cfg, game.clock, SF.playerHazardBox(p));
      if (hit) {
        SF.stepperKnock(st, p, SF.knockDir(hit, p), cfg);
        game.knocked = true;
        events.push({ type: 'hit', kind: hit.kind });
      }
    }
    for (const e of SF.updateGust(game.gust, game.level, cfg, game.clock, p, st)) events.push(e);
    throwSounds();
    gustCues();
    const a = game.anim;
    a.landT += STEP;
    a.bumpT += STEP;
    a.flashT += STEP;
    a.hitT += STEP;
    a.airT = p.grounded ? 0 : a.airT + STEP;
    if (game.state === 'playing') {
      game.stats.climbTime += STEP;
      game.stats.totalTime += STEP;
      SF.comboTick(game.combo, STEP, cfg);
    }
    for (const e of events) onEvent(e);
    const f = SF.floorAt(p.y);
    // 발 딛고 선 층이 바뀌면 알림 (같은 방 친구들에게 내 층 보내기: room.js). 떨어지는 중에는 안 보낸다
    if (p.grounded && f !== game.standFloor) {
      game.standFloor = f;
      if (game.onFloor) game.onFloor(f);
    }
    if (f > game.stats.bestFloor) {
      game.stats.bestFloor = f;
      // 과학 상식은 퀴즈 층(10·30·…)과 겹치지 않게 20층마다
      if (f % 20 === 0 && f < cfg.totalFloors) say(game.talk.fact(), 2.6);
    }
    if (game.state !== 'playing') return;
    if (p.grounded && st.mode === 'idle' && f >= cfg.totalFloors) { finish(); return; }
    if (limit() && game.stats.climbTime >= limit()) { timeUp(); return; }
    // 퀴즈 층에 처음 서면 퀴즈 (봇은 구경용이라 정답을 고르고 바로 지나간다)
    const q = SF.shouldAskQuiz(game.quiz, cfg, p, st);
    if (q) {
      if (game.bot) SF.answerQuiz(game.quiz, f, q.answer);
      else openQuiz(q, f);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame); // 먼저 예약: 한 프레임에서 오류가 나도 루프는 계속
    const dt = Math.min(0.25, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    if (PLAYING(game.state)) {
      const r = SF.advanceClock(acc, dt, STEP);
      acc = r.acc;
      for (let i = 0; i < r.steps && PLAYING(game.state); i++) stepOnce();
    } else if (game.state === 'quiz' || (game.state === 'paused' && game.pausedFrom === 'playing')) {
      game.stats.totalTime += dt; // 퀴즈·일시정지 중에는 세상이 멈추고 전체 시간만 흐른다
    }
    const p = game.player;
    const alpha = PLAYING(game.state) ? acc / STEP : 1;
    const ix = SF.lerp(game.prev.x, p.x, alpha);
    const iy = SF.lerp(game.prev.y, p.y, alpha);
    camera.update(iy + p.h / 2, p.vy, !p.grounded, vp.viewH, dt, bounds());

    for (const pop of game.popups) pop.age += dt;
    while (game.popups.length && game.popups[0].age >= game.popups[0].life) game.popups.shift();
    for (const pa of game.particles) {
      pa.age += dt;
      pa.x += pa.vx * dt;
      pa.y += pa.vy * dt;
      pa.vy -= 220 * dt;
    }
    game.particles = game.particles.filter((pa) => pa.age < pa.life);
    if (game.bubble) {
      game.bubble.age += dt;
      if (game.bubble.age >= game.bubble.life) game.bubble = null;
    }
    let shake = null;
    if (game.shakeTime > 0) {
      game.shakeTime -= dt;
      shake = { x: (Math.random() * 2 - 1) * 2, y: (Math.random() * 2 - 1) * 2 };
    }

    const st = game.stepper;
    renderer.draw({
      player: { x: ix, y: iy, w: p.w, h: p.h, facing: p.facing, grounded: p.grounded, vx: p.vx, vy: p.vy },
      move: { mode: st.mode, kind: st.kind, k: st.mode === 'hop' ? Math.min(1, st.t / cfg.step.hopTime) : 0 },
      cameraTop: camera.top, time: now / 1000, popups: game.popups, particles: game.particles, shake,
      anim: game.anim, bubble: game.bubble, debug: game.debug,
      clock: game.clock, crumbles: game.crumbles, blink: game.grace > 0 || game.knocked,
      gust: { at: SF.gustAt(game.level, cfg, game.clock), here: SF.inGustZone(cfg, SF.floorAt(p.y)),
        hold: cfg.obstacles.gust ? game.gust.idle / cfg.obstacles.gust.hold : 0 },
      quiz: game.quiz, charId: game.charId,
    });
    updateHud();
  }

  function resize() {
    const rect = els.app.getBoundingClientRect();
    vp = SF.computeViewport(rect.width, rect.height, window.devicePixelRatio || 1, cfg);
    els.controls.style.height = vp.controlsH + 'px';
    renderer.resize(vp);
    if (game.player) camera.snap(centerY(game.player), vp.viewH, bounds());
  }

  function syncMute() {
    els.mute.setAttribute('aria-pressed', sound.muted ? 'true' : 'false');
    els.mute.setAttribute('aria-label', sound.muted ? '소리 켜기' : '소리 끄기');
    els.mute.classList.toggle('off', sound.muted);
  }

  // 맵이 다 만들어진 뒤에 할 일 (조정 패널 등). 이미 만들어졌으면 바로
  const readyFns = [];
  SF.whenReady = (fn) => { if (game.level && game.player) fn(); else readyFns.push(fn); };

  function init() {
    const first = loadLevel();
    $('loading').hidden = true;
    showNotice(first.messages, first.fatal);
    if (first.fatal) return; // 맵을 만들 수 없으면 안내만 보여주고 멈춘다
    buildPracticeButtons();
    $('hint-time').textContent = limit() ? '등반 시간 ' + Math.round(limit() / 60) + '분' : '시간 제한 없음';
    window.addEventListener('resize', resize);
    resize();
    game.toHome(); // 처음 화면부터
    // 버튼을 누를 때마다 한 칸 (누르고 있어도 반복하지 않는다). 퀴즈·결과 화면에서는 무시
    SF.bindInput(tracker, { controls: els.controls, leftBtn: els.left, rightBtn: els.right }, (dir) => {
      sound.unlock();
      if (!INPUT_OK(game.state)) return;
      if (game.state === 'ready') start();
      if (!game.bot) SF.stepperPress(game.stepper, dir, cfg);
    });
    // 퀴즈: PC에서는 1~4(또는 A~D) 키로 고르고 Enter·Space로 계속
    window.addEventListener('keydown', (e) => {
      if (game.state !== 'quiz' || e.repeat) return;
      const k = e.key.toLowerCase();
      const i = ['1', '2', '3', '4'].indexOf(k) >= 0 ? Number(k) - 1 : ['a', 'b', 'c', 'd'].indexOf(k);
      if (!game.quizAnswered && i >= 0) { e.preventDefault(); game.answer(i); }
      else if (game.quizAnswered && (k === 'enter' || k === ' ')) { e.preventDefault(); game.continueAfterQuiz(); }
    });
    els.quizContinue.addEventListener('click', () => game.continueAfterQuiz());
    els.mute.addEventListener('click', () => { sound.unlock(); sound.setMuted(!sound.muted); syncMute(); });
    syncMute();
    els.restart.addEventListener('click', () => game.reset());
    requestAnimationFrame((t) => { lastT = t; requestAnimationFrame(frame); });
    for (const fn of readyFns.splice(0)) fn();
  }

  $('notice').querySelector('button').addEventListener('click', () => { $('notice').hidden = true; });
  // "숲을 만드는 중…"이 먼저 보이도록 한 박자 쉬고 맵을 만든다 (600층, 휴대폰에서 1~2초)
  $('loading').hidden = false;
  setTimeout(init, 30);
})(window.SF);
