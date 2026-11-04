// 학생 정보(이름·반), 선생님 비밀번호, 한 판의 기록 (설계 문서 2026-10-16)
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  const KEY = 'sf-student';
  const NAME_MAX = 10;
  const cleanName = (name) => String(name == null ? '' : name).trim();
  const letters = (s) => Array.from(s).length; // 이모지·한글도 한 글자씩

  // 반 고르기 목록: 1 ~ classCount
  SF.classOptions = (cfg) => Array.from({ length: cfg.school.classCount }, (_, i) => i + 1);

  // 입장 정보 검사. 오류 문구 목록 (비면 통과)
  SF.validateStudent = function (s, cfg) {
    const out = [];
    const name = cleanName(s.name);
    if (!name) out.push('이름을 적어 주세요.');
    else if (letters(name) > NAME_MAX) out.push('이름은 ' + NAME_MAX + '글자까지 적을 수 있어요.');
    const c = Number(s.classNo);
    if (!Number.isInteger(c) || c < 1 || c > cfg.school.classCount) out.push('반을 골라 주세요.');
    return out;
  };

  // 학생 ID: 학년-반-이름 (랭킹·완주자 목록에서 같은 학생을 묶는 데 쓴다)
  SF.studentId = (s, cfg) => cfg.school.grade + '-' + Number(s.classNo) + '-' + cleanName(s.name);

  // 이 기기에 지난번 입장 정보 기억 (저장이 막혀 있어도 게임은 동작)
  SF.loadStudent = function (storage) {
    try {
      const v = storage && storage.getItem(KEY);
      if (!v) return null;
      const o = JSON.parse(v);
      return { name: String(o.name || ''), classNo: Number(o.classNo) || null, charId: o.charId || null };
    } catch (_) {
      return null;
    }
  };
  SF.saveStudent = function (storage, s) {
    try {
      if (storage) storage.setItem(KEY, JSON.stringify({ name: cleanName(s.name), classNo: Number(s.classNo), charId: s.charId }));
    } catch (_) { /* 기억 못 해도 동작 */ }
  };

  // 선생님 모드 비밀번호 (화면 잠금용. 기록 지우기 같은 중요한 일은 3단계에서 Apps Script가 다시 확인)
  SF.checkTeacherPassword = (cfg, input) => String(input == null ? '' : input).trim() !== '' &&
    String(input).trim() === String(cfg.teacher.password);

  // 한 판의 기록 (3단계에서 구글 시트로 보낸다. test: true면 절대 보내지 않음)
  SF.makeRecord = function (run, cfg, now) {
    const s = run.stats;
    const score = SF.computeScore({ bestFloor: s.bestFloor, finished: !!run.finished, climbTime: s.climbTime,
      correct: run.quiz.correct, maxCombo: s.maxCombo }, cfg);
    return {
      id: SF.studentId(run.student, cfg),
      name: cleanName(run.student.name),
      grade: cfg.school.grade,
      classNo: Number(run.student.classNo),
      charId: run.charId,
      bestFloor: s.bestFloor,
      finished: !!run.finished,
      climbTime: s.climbTime,
      totalTime: s.totalTime,
      correct: run.quiz.correct,
      wrong: run.quiz.wrong,
      falls: s.falls,
      maxCombo: s.maxCombo,
      score: score.total,
      quit: !!run.quit,
      test: !!run.test,
      runId: run.runId || '', // 판 번호: 같은 판이 두 번 저장되지 않게
      date: now.toISOString(),
    };
  };
})(window.SF);
