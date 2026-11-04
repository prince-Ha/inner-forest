// 콤보: 실수 없이 연속으로 오른 수. 추락·부딪힘·멈춤(combo.timeout초)이면 끊긴다
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  SF.createCombo = () => ({ count: 0, best: 0, idle: 0 });

  // 한 칸 올랐을 때. 축하할 콤보 수에 닿으면 그 수를, 아니면 0을 돌려준다
  SF.comboStep = function (c, cfg) {
    c.count++;
    c.idle = 0;
    if (c.count > c.best) c.best = c.count;
    return cfg.combo.milestones.indexOf(c.count) >= 0 ? c.count : 0;
  };

  // 끊기 직전 콤보 수를 돌려준다
  SF.comboBreak = function (c) {
    const had = c.count;
    c.count = 0;
    c.idle = 0;
    return had;
  };

  // 시간이 흐를 때. 이번에 끊겼으면 true
  SF.comboTick = function (c, dt, cfg) {
    if (c.count === 0) return false;
    c.idle += dt;
    if (c.idle >= cfg.combo.timeout) {
      SF.comboBreak(c);
      return true;
    }
    return false;
  };
})(window.SF);
