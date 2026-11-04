// 화면 상자들: 처음(입장) 화면, 일시정지, 그만두기 확인, 선생님 모드, 완주 증명서 (설계 문서 2026-10-16)
// 구글 시트에 관한 화면(랭킹 보드·한마디·선생님 시트 부분)은 sheet-ui.js
// 게임 진행은 game.js의 game API(begin·pause·unpause·quitToHome·toHome·setTestMode…)만 부른다
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const show = (id) => $(id).classList.remove('hidden');
  const hide = (id) => $(id).classList.add('hidden');
  const isShown = (id) => !$(id).classList.contains('hidden');
  const storage = (() => { try { return window.localStorage; } catch (_) { return null; } })();

  // 맵이 만들어지기 전에는 시작 버튼을 막아 둔다
  $('home-start').disabled = true;
  if (SF.whenReady) SF.whenReady(setup);

  function setup() {
    const game = SF.game;
    const cfg = game.cfg;
    $('home-start').disabled = false;

    // ------------------------------------------------------------ 처음(입장) 화면
    $('grade-label').textContent = cfg.school.grade + '학년';
    const sel = $('in-class');
    sel.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: '반 고르기' }));
    for (const n of SF.classOptions(cfg)) sel.appendChild(Object.assign(document.createElement('option'), { value: String(n), textContent: n + '반' }));

    // 캐릭터 고르기: 서 있는 그림을 3배로
    let charId = SF.CHARACTERS[0].id;
    const pick = $('char-pick');
    const opts = SF.CHARACTERS.map((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'char-opt';
      b.setAttribute('role', 'radio');
      const cnv = document.createElement('canvas');
      cnv.width = 48; // 16×24 상자의 3배 (그림은 그 안에 맞춰 그려진다)
      cnv.height = 72;
      const paint = () => {
        const cg = cnv.getContext('2d');
        cg.clearRect(0, 0, cnv.width, cnv.height);
        cg.imageSmoothingEnabled = false;
        SF.drawSprite(cg, game.sprites.characters[c.id].right.idle[0], 0, 0, 3);
      };
      paint();
      if (SF.whenSpritesLoaded) SF.whenSpritesLoaded(paint); // 그림 파일이 늦게 읽히면 다시 그린다
      b.appendChild(cnv);
      b.appendChild(Object.assign(document.createElement('span'), { textContent: c.name }));
      b.addEventListener('click', () => choose(c.id));
      pick.appendChild(b);
      return [c.id, b];
    });
    function choose(id) {
      charId = id;
      if (game.state === 'home') game.charId = id; // 뒤에 서 있는 캐릭터도 미리 보기로 바꿔 준다
      for (const [cid, b] of opts) b.setAttribute('aria-checked', cid === id ? 'true' : 'false');
    }

    // 지난번 입장 정보
    const saved = SF.loadStudent(storage);
    if (saved) {
      $('in-name').value = saved.name;
      if (saved.classNo) sel.value = String(saved.classNo);
      if (SF.CHARACTERS.some((c) => c.id === saved.charId)) charId = saved.charId;
    }
    choose(charId);

    function startGame() {
      const s = { name: $('in-name').value, classNo: sel.value ? Number(sel.value) : null };
      const errors = SF.validateStudent(s, cfg);
      const err = $('home-error');
      err.hidden = !errors.length;
      err.textContent = errors.join(' ');
      if (errors.length) return;
      SF.saveStudent(storage, { name: s.name, classNo: s.classNo, charId });
      $('in-name').blur();
      hide('home');
      game.begin(s, charId);
    }
    $('home-start').addEventListener('click', startGame);
    $('in-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') startGame(); });

    function goHome() {
      for (const id of ['pause', 'confirm', 'cert', 'finish', 'board']) hide(id);
      show('home');
    }

    // ------------------------------------------------------------ 일시정지·그만두기
    function openPause() {
      if (!game.pause()) return;
      $('test-tools').hidden = !game.testMode;
      $('tool-bot').textContent = game.bot ? '봇 끄기' : '봇 켜기';
      show('pause');
    }
    function closePause() {
      hide('pause');
      game.unpause();
    }
    $('pause-btn').addEventListener('click', openPause);
    $('resume-btn').addEventListener('click', closePause);

    // 처음 화면으로: 진행 중인 판이면 확인 (최고 층은 기록된다는 안내)
    function askHome() {
      if (!game.inRun()) {
        game.toHome();
        goHome();
        return;
      }
      if (game.state !== 'paused') game.pause();
      $('confirm-text').textContent = '지금 판을 그만하고 처음 화면으로 갈까요? ' +
        (game.testMode || game.practiceFrom ? '(테스트라 기록은 남지 않아요)' : '지금까지 오른 최고 ' + game.stats.bestFloor + '층은 기록돼요.');
      show('confirm');
    }
    $('home-btn').addEventListener('click', () => {
      if (game.state === 'quiz' || isShown('confirm')) return;
      askHome();
    });
    $('pause-home').addEventListener('click', () => { hide('pause'); askHome(); });
    $('confirm-yes').addEventListener('click', () => {
      game.quitToHome();
      goHome();
    });
    $('confirm-no').addEventListener('click', () => {
      hide('confirm');
      game.unpause();
    });
    // Esc: 일시정지 켜고 끄기 (PC)
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || e.repeat) return;
      if (isShown('pause')) closePause();
      else if (game.state === 'playing') openPause();
    });

    // 테스트 도구 (일시정지 상자 안, 테스트 모드에서만)
    $('tool-go').addEventListener('click', () => {
      hide('pause');
      game.teleport(Math.max(1, Math.min(cfg.totalFloors, Number($('tool-floor').value) || 1)));
    });
    $('tool-bot').addEventListener('click', () => {
      hide('pause');
      game.setBot(!game.bot);
    });
    $('tool-minute').addEventListener('click', () => {
      if (cfg.timeLimitSec) game.stats.climbTime = Math.max(game.stats.climbTime, cfg.timeLimitSec - 60);
      closePause();
    });
    $('quiz-skip').addEventListener('click', () => {
      if (game.state !== 'quiz') return;
      if (!game.quizAnswered) game.answer(game.quizQ.answer);
      game.continueAfterQuiz();
    });

    // ------------------------------------------------------------ 결과 화면·증명서
    $('result-home').addEventListener('click', () => { game.toHome(); goHome(); });
    // 증명서 저장: claude.ai 화면 안에서는 그 화면의 저장 기능(downloads)으로, 그 밖(깃허브 페이지·파일)에서는 보통 다운로드 링크로
    let downloads = null;
    if (window.claude && typeof window.claude.use === 'function') {
      window.claude.use('downloads').then((d) => { downloads = d; }, () => {});
    }
    let certCanvas = null;
    $('cert-btn').addEventListener('click', () => {
      if (!game.certData) return;
      certCanvas = SF.drawCertificate(game.certData, game.sprites);
      const url = certCanvas.toDataURL('image/png');
      $('cert-img').src = url;
      const save = $('cert-save');
      save.href = url;
      save.download = '과학인내의숲_완주증명서_' + game.certData.name + '.png';
      $('cert-hint').textContent = '저장이 안 되면 증명서를 길게 눌러 저장하세요.';
      show('cert');
    });
    $('cert-save').addEventListener('click', (e) => {
      if (!downloads || !certCanvas) return; // 보통 다운로드 링크가 처리
      e.preventDefault();
      const filename = $('cert-save').download;
      certCanvas.toBlob((blob) => {
        if (!blob) return;
        downloads.save({ filename, data: blob }).catch((err) => {
          if (err && err.code === 'declined') return; // 저장 안 하기로 함
          $('cert-hint').textContent = '여기서는 저장할 수 없어요. 증명서를 길게 눌러 저장하세요.';
        });
      }, 'image/png');
    });
    $('cert-close').addEventListener('click', () => hide('cert'));

    // ------------------------------------------------------------ 선생님 모드
    function syncTeacher() {
      const t = $('test-toggle');
      t.textContent = game.testMode ? '테스트 모드 끄기' : '테스트 모드 켜기';
      t.setAttribute('aria-pressed', game.testMode ? 'true' : 'false');
      $('test-note').hidden = !game.testMode;
    }
    function fillSummary() {
      const S = cfg.score;
      const rows = [
        ['학년·반', cfg.school.grade + '학년 1~' + cfg.school.classCount + '반'],
        ['층수', cfg.totalFloors + '층'],
        ['퀴즈', SF.quizFloors(cfg).length + '문제 (' + cfg.quiz.firstFloor + '층부터 ' + cfg.quiz.every + '층마다)'],
        ['문제은행', game.bank ? '구글 시트 문제 ' + game.bank.length + '개' : '게임 안 기본 문제 ' + SF.QUESTIONS.length + '개'],
        ['시간 제한', cfg.timeLimitSec ? '등반 ' + Math.round(cfg.timeLimitSec / 60) + '분 (퀴즈·일시정지 제외)' : '없음'],
        ['점수', '층×' + S.perFloor + ' + 완주 ' + S.finishBonus.toLocaleString('ko-KR') + ' + 남은 초×' + S.perSecondLeft +
          ' + 정답×' + S.perCorrect + ' + 콤보×' + S.perCombo],
        ['맵', cfg.map && cfg.map.check === SF.mapFingerprint(cfg) ? '미리 검사됨 (빨리 열림)' : '검사 필요 (느리게 열림)'],
        ['비밀번호', 'config.js의 teacher.password'],
      ];
      const dl = $('settings-summary');
      dl.textContent = '';
      for (const [k, v] of rows) {
        dl.appendChild(Object.assign(document.createElement('dt'), { textContent: k }));
        dl.appendChild(Object.assign(document.createElement('dd'), { textContent: v }));
      }
    }
    function openTeacher() {
      fillSummary();
      syncTeacher();
      if (SF.sheetUi) SF.sheetUi.teacherOpened(); // 시트 연결 상태·완주자 목록·한마디 숨기기 (sheet-ui.js)
      show('teacher');
    }
    $('teacher-btn').addEventListener('click', () => {
      if (game.teacherUnlocked) { openTeacher(); return; }
      $('teacher-pw').value = '';
      $('teacher-error').hidden = true;
      show('teacher-login');
      $('teacher-pw').focus();
    });
    function tryLogin() {
      if (SF.checkTeacherPassword(cfg, $('teacher-pw').value)) {
        game.teacherUnlocked = true;
        if (SF.sheetUi) SF.sheetUi.teacherLogin($('teacher-pw').value); // 구글 쪽에서 다시 확인할 때 쓴다 (메모리에만)
        $('teacher-pw').blur();
        hide('teacher-login');
        openTeacher();
      } else {
        $('teacher-error').hidden = false;
        $('teacher-pw').select();
      }
    }
    $('teacher-ok').addEventListener('click', tryLogin);
    $('teacher-pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
    $('teacher-cancel').addEventListener('click', () => { $('teacher-pw').blur(); hide('teacher-login'); });
    $('test-toggle').addEventListener('click', () => { game.setTestMode(!game.testMode); syncTeacher(); });
    $('teacher-close').addEventListener('click', () => hide('teacher'));
    $('teacher-exit').addEventListener('click', () => {
      game.teacherUnlocked = false;
      if (SF.sheetUi) SF.sheetUi.teacherLogout();
      game.setTestMode(false);
      syncTeacher();
      hide('teacher');
    });
  }
})(window.SF);
