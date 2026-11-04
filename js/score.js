// 점수 (설계 문서 2026-10-15 §2): 층 + 완주 보너스 + 빨리 도착(완주 때만, 남은 등반 시간) + 퀴즈 정답 + 최고 콤보
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  // r = { bestFloor, finished, climbTime(초), correct(정답 수), maxCombo }
  SF.computeScore = function (r, cfg) {
    const S = cfg.score;
    const limit = cfg.timeLimitSec || 0;
    const floor = r.bestFloor * S.perFloor;
    const finish = r.finished ? S.finishBonus : 0;
    const speed = r.finished && limit > 0 ? Math.floor(Math.max(0, limit - r.climbTime)) * S.perSecondLeft : 0;
    const quiz = r.correct * S.perCorrect;
    const combo = r.maxCombo * S.perCombo;
    return { floor, finish, speed, quiz, combo, total: floor + finish + speed + quiz + combo };
  };
})(window.SF);
